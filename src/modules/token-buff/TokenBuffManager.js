import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { BuffLifecycle } from "../../core/BuffLifecycle.js";

/**
 * TokenBuffManager.js
 * 专门处理无人物卡绑定的纯野怪/通用 Token 的 Buff 生命周期与持久化
 * 利用 Token 自身的 gmnotes 存储结构化 Buff 数据，并实时同步到 Firebase
 *
 * 轮数扣减/回退算法统一委托至 BuffLifecycle（纯算法核心），
 * 本类只负责 gmnotes 编解码与持久化。
 */
export class TokenBuffManager {
    static COMMENT_PREFIX = "<!--r20_buffs:";
    static COMMENT_SUFFIX = "-->";
    static DEBUFF_PREFIX = "<!--r20_debuffs:";
    static DEBUFF_SUFFIX = "-->";

    /**
     * 解码 Token 的 gmnotes（兼容未 encodeURIComponent 的历史数据）
     */
    static _decodeGmnotes(token) {
        const raw = token.get("gmnotes") || "";
        try { return decodeURIComponent(raw); } catch (e) { return raw; }
    }

    /**
     * 将 JSON 数据块以注释形式拼接进 gmnotes 文本：
     * 已有同名数据块则原位替换，否则追加在末尾
     */
    static _spliceGmnotesBlock(decoded, prefix, suffix, json) {
        const jsonBlock = `${prefix}${json}${suffix}`;
        const startIdx = decoded.indexOf(prefix);
        if (startIdx !== -1) {
            const endIdx = decoded.indexOf(suffix, startIdx);
            if (endIdx !== -1) {
                // 替换旧数据块
                return decoded.substring(0, startIdx) + jsonBlock + decoded.substring(endIdx + suffix.length);
            }
            return decoded.substring(0, startIdx) + jsonBlock;
        }
        // 追加在最后
        return decoded ? `${decoded}\n${jsonBlock}` : jsonBlock;
    }

    /**
     * 从 Token 的 gmnotes 中提取当前已登记的 Debuff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ key, name, rounds, enabled, ... }]
     */
    static getTokenDebuffs(token) {
        if (!token) return [];
        const decoded = this._decodeGmnotes(token);

        const startIdx = decoded.indexOf(this.DEBUFF_PREFIX);
        if (startIdx === -1) {
            // 兼容旧版混在 r20_buffs 里的情况
            const allBuffs = this.getTokenBuffs(token);
            return allBuffs.filter(b => !!b.isDebuff);
        }

        const endIdx = decoded.indexOf(this.DEBUFF_SUFFIX, startIdx);
        if (endIdx === -1) return [];

        const jsonStr = decoded.substring(startIdx + this.DEBUFF_PREFIX.length, endIdx);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("[TokenBuffManager] 解析 Token Debuff 数据失败:", e);
            return [];
        }
    }

    /**
     * 将 Debuff 列表持久化回 Token 的 gmnotes
     */
    static saveTokenDebuffs(token, debuffs) {
        if (!token) return;
        const newNotes = this._spliceGmnotesBlock(
            this._decodeGmnotes(token),
            this.DEBUFF_PREFIX,
            this.DEBUFF_SUFFIX,
            JSON.stringify(debuffs)
        );
        token.save({ gmnotes: encodeURIComponent(newNotes) });
    }

    /**
     * 将 Debuff 登记到 Token 的 Debuff 列表中
     */
    static addTrackedDebuff(token, debuffData) {
        if (!token || !debuffData) return false;
        const list = this.getTokenDebuffs(token);
        const key = debuffData.key || debuffData.name;
        const existing = list.find(d => (d.key || d.name) === key);
        if (existing) {
            if (debuffData.rounds !== undefined) existing.rounds = debuffData.rounds;
            if (debuffData.enabled !== undefined) existing.enabled = debuffData.enabled;
        } else {
            list.push({
                key: key,
                rowId: key,
                name: debuffData.name || key,
                rounds: debuffData.rounds !== undefined ? debuffData.rounds : 0,
                initialRounds: debuffData.initialRounds !== undefined ? debuffData.initialRounds : 0,
                enabled: debuffData.enabled !== undefined ? debuffData.enabled : false,
                isDebuff: true
            });
        }
        this.saveTokenDebuffs(token, list);
        return true;
    }

    /**
     * 从 Token 的 Debuff 列表中除名某个 Debuff
     */
    static removeTrackedDebuff(token, key) {
        if (!token || !key) return false;
        let list = this.getTokenDebuffs(token);
        const filtered = list.filter(d => (d.key || d.name) !== key);
        this.saveTokenDebuffs(token, filtered);
        return true;
    }

    /**
     * 切换 Token 上某个 Debuff 的激活/关停状态
     */
    static toggleDebuff(token, key, enable) {
        if (!token || !key) return false;
        const list = this.getTokenDebuffs(token);
        const target = list.find(d => (d.key || d.name) === key);
        if (target) {
            target.enabled = !!enable;
            this.saveTokenDebuffs(token, list);
            return true;
        }
        return false;
    }

    /**
     * 切换纯 Token 上指定 Buff 的激活状态
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {boolean} enable 是否开启
     */
    static toggleBuff(token, buffName, enable) {
        if (!token || !buffName) return false;
        const list = this.getTokenBuffs(token);
        const target = list.find(b => b.name === buffName);
        if (target) {
            target.enabled = !!enable;
            this.saveTokenBuffs(token, list);
            return true;
        }
        return false;
    }

    /**
     * 从 Token 的 gmnotes 中提取当前所有激活的 Buff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ name, rounds, initialRounds }]
     */
    static getTokenBuffs(token) {
        if (!token) return [];
        const decoded = this._decodeGmnotes(token);

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
        const newNotes = this._spliceGmnotesBlock(
            this._decodeGmnotes(token),
            this.COMMENT_PREFIX,
            this.COMMENT_SUFFIX,
            JSON.stringify(buffs)
        );
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
        const cleanAttrs = (extraAttrs && typeof extraAttrs === "object")
            ? Object.fromEntries(Object.entries(extraAttrs).filter(([k]) => !k.startsWith("link_") && !k.startsWith("link")))
            : null;

        if (existing) {
            existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
            if (cleanAttrs) existing.extraAttrs = cleanAttrs;
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 剩余: ${rounds}轮`);
        } else {
            buffs.push({
                name: cleanName,
                rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null,
                extraAttrs: cleanAttrs || null
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
     * @param {string|object} tokenOrId Token ID 或 Token 模型
     */
    static decrementBuffs(tokenOrId) {
        const token = typeof tokenOrId === "string" ? Roll20Bridge.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        const debuffs = this.getTokenDebuffs(token);
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];

        // 1. 处理正面 Buff（过期条目直接从列表除名）
        if (buffs.length > 0) {
            const remainingBuffs = [];
            for (const buff of buffs) {
                const result = BuffLifecycle.decrementEntry(buff);
                if (!result) {
                    remainingBuffs.push(buff);
                    continue;
                }
                if (result.status === "expired") {
                    processed.push({ name: buff.name, status: "expired" });
                } else {
                    remainingBuffs.push(buff);
                    processed.push(result);
                }
            }
            this.saveTokenBuffs(token, remainingBuffs);
        }

        // 2. 处理 Debuff 轮数倒计与到期关停
        if (debuffs.length > 0) {
            let debuffsModified = false;
            for (const debuff of debuffs) {
                const result = BuffLifecycle.decrementEntry(debuff, {
                    isDebuff: true,
                    formatName: (e) => `[Debuff] ${e.name}`
                });
                if (!result) continue;
                debuffsModified = true;
                processed.push(result);
            }
            if (debuffsModified) {
                this.saveTokenDebuffs(token, debuffs);
            }
        }

        return processed;
    }

    /**
     * 兼容别名
     */
    static tickBuffsOnTurnEnd(tokenId) {
        return this.decrementBuffs(tokenId);
    }

    /**
     * 倒先攻时，将被拉回排头的 Token 身上的 Buff/Debuff 加回 1 轮
     */
    static incrementBuffsOnTurnRevert(tokenOrId) {
        const token = typeof tokenOrId === "string" ? Roll20Bridge.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        const debuffs = this.getTokenDebuffs(token);
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];
        for (const buff of buffs) {
            if (!BuffLifecycle.incrementEntry(buff)) continue;
            processed.push({ name: buff.name, status: "incremented", remaining: buff.rounds });
        }
        if (buffs.length > 0) {
            this.saveTokenBuffs(token, buffs);
        }

        let debuffsModified = false;
        for (const debuff of debuffs) {
            if (!BuffLifecycle.incrementEntry(debuff, { isDebuff: true })) continue;
            processed.push({ name: `[Debuff] ${debuff.name}`, status: "incremented", remaining: debuff.rounds });
            debuffsModified = true;
        }
        if (debuffsModified) {
            this.saveTokenDebuffs(token, debuffs);
        }

        console.log(`[TokenBuffManager] 先攻回退: 为 Token [${token.get("name")}] 加回 Buff/Debuff 轮数共 ${processed.length} 项`);
        return processed;
    }
}
