import { Roll20Bridge } from "../../core/Roll20Bridge.js";

/**
 * TokenBuffManager.js
 * 专门处理无人物卡绑定的纯野怪/通用 Token 的 Buff 生命周期与持久化
 * 利用 Token 自身的 gmnotes 存储结构化 Buff 数据，并实时同步到 Firebase
 */
export class TokenBuffManager {
    static COMMENT_PREFIX = "<!--r20_buffs:";
    static COMMENT_SUFFIX = "-->";

    /**
     * 从 Token 的 gmnotes 中提取当前所有激活的 Buff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ name, rounds, initialRounds }]
     */
    static getTokenBuffs(token) {
        if (!token) return [];
        const raw = token.get("gmnotes") || "";
        let decoded = "";
        try {
            decoded = decodeURIComponent(raw);
        } catch (e) {
            decoded = raw;
        }

        // 提取被注释包裹的 JSON 数据，避免干扰 GM 的正常备注
        const startIdx = decoded.indexOf(this.COMMENT_PREFIX);
        if (startIdx === -1) {
            // 兼容直接存 JSON 的情况
            if (decoded.trim().startsWith("[") && decoded.trim().endsWith("]")) {
                try { return JSON.parse(decoded.trim()); } catch (e) { return []; }
            }
            return [];
        }

        const endIdx = decoded.indexOf(this.COMMENT_SUFFIX, startIdx);
        if (endIdx === -1) return [];

        const jsonStr = decoded.substring(startIdx + this.COMMENT_PREFIX.length, endIdx);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("[TokenBuffManager] 解析 Token Buff 数据失败:", e);
            return [];
        }
    }

    /**
     * 将 Buff 列表安全保存回 Token 的 gmnotes 中
     * @param {object} token Graphic 模型
     * @param {Array} buffs 最新 Buff 列表
     */
    static saveTokenBuffs(token, buffs) {
        if (!token) return;
        const raw = token.get("gmnotes") || "";
        let decoded = "";
        try { decoded = decodeURIComponent(raw); } catch (e) { decoded = raw; }

        const jsonBlock = `${this.COMMENT_PREFIX}${JSON.stringify(buffs)}${this.COMMENT_SUFFIX}`;

        let newNotes = "";
        const startIdx = decoded.indexOf(this.COMMENT_PREFIX);
        if (startIdx !== -1) {
            const endIdx = decoded.indexOf(this.COMMENT_SUFFIX, startIdx);
            if (endIdx !== -1) {
                // 替换旧数据块
                newNotes = decoded.substring(0, startIdx) + jsonBlock + decoded.substring(endIdx + this.COMMENT_SUFFIX.length);
            } else {
                newNotes = decoded.substring(0, startIdx) + jsonBlock;
            }
        } else {
            // 追加在最后
            newNotes = decoded ? `${decoded}\n${jsonBlock}` : jsonBlock;
        }

        // 保存并自动推送到 Firebase
        token.save({ gmnotes: encodeURIComponent(newNotes) });
    }

    /**
     * 对纯 Token 施加或刷新 Buff（同名只刷新轮数，不同名追加）
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 细目属性字典
     */
    static applyOrRefreshBuff(token, buffName, rounds = null, extraAttrs = null) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        if (!cleanName) return false;

        const buffs = this.getTokenBuffs(token);
        const existing = buffs.find(b => b.name === cleanName);

        if (existing) {
            existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
            if (extraAttrs) existing.extraAttrs = extraAttrs;
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 剩余: ${rounds}轮`);
        } else {
            buffs.push({
                name: cleanName,
                rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null,
                extraAttrs: extraAttrs || null
            });
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 新增 Buff [${cleanName}], 轮数: ${rounds}`);
        }

        this.saveTokenBuffs(token, buffs);
        return true;
    }

    /**
     * 移除纯 Token 上的某个 Buff
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     */
    static removeBuff(token, buffName) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        let buffs = this.getTokenBuffs(token);
        const beforeLen = buffs.length;
        buffs = buffs.filter(b => b.name !== cleanName);

        if (buffs.length !== beforeLen) {
            this.saveTokenBuffs(token, buffs);
            console.log(`[TokenBuffManager] 已解除 Token [${token.get("name")}] 的 Buff [${cleanName}]`);
            return true;
        }
        return false;
    }

    /**
     * 当纯 Token 行动结束时扣减 1 轮
     * @param {string} tokenId Token ID
     */
    static tickBuffsOnTurnEnd(tokenId) {
        const token = Roll20Bridge.getTokenGraphic(tokenId);
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        if (buffs.length === 0) return [];

        const tokenName = token.get("name") || "未命名棋子";
        const remainingBuffs = [];
        const processed = [];

        for (const buff of buffs) {
            if (buff.rounds === null) {
                remainingBuffs.push(buff);
                continue;
            }

            const nextRounds = buff.rounds - 1;
            if (nextRounds <= 0) {
                // 广播到期消息
                const msg = `&{template:default} {{name=Buff 持续时间结束}} {{单位=${tokenName}}} {{效果=${buff.name}}} {{状态=持续时间归零，已解除。}}`;
                Roll20Bridge.sendChatMessage(msg);
                processed.push({ name: buff.name, status: "expired" });
            } else {
                buff.rounds = nextRounds;
                remainingBuffs.push(buff);
                processed.push({ name: buff.name, status: "decremented", remaining: nextRounds });
            }
        }

        this.saveTokenBuffs(token, remainingBuffs);
        return processed;
    }
}
