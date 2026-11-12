import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { BuffLifecycle } from "../../core/BuffLifecycle.js";

/**
 * TokenBuffManager.js
 * 专门处理无人物卡绑定的纯野怪/通用 Token 的 Buff 生命周期与持久化
 *
 * 存储介质：Token Graphic 模型上的自定义字段 `r20_suite_buffs`
 * （JSON: { buffs: [...], debuffs: [...] }，经实验验证可随 Firebase 持久化并跨页面刷新存活）。
 * 不占用 gmnotes——那是用户可见可编辑的笔记空间，混入结构化数据会被用户编辑冲掉。
 *
 * 数据结构与人物卡 (Pf1eBuffManager.getAllBuffs) 保持完全一致的字段语义：
 * { rowId, name, enabled, rounds, initRounds, extraAttrs, linkHostId, linkSourceRowId, linkChildren }
 * 所有写入方负责按此结构落盘；读取端直读直返，不做迁移清洗。
 *
 * 轮数扣减/回退算法统一委托至 BuffLifecycle（纯算法核心），
 * 本类只负责自定义字段的读写。
 */
export class TokenBuffManager {
    static FIELD = "r20_suite_buffs";

    /**
     * 读取整份数据（缺失/损坏时返回空结构）
     */
    static _load(token) {
        let data = null;
        try { data = JSON.parse(token.get(this.FIELD) || "null"); } catch (e) { data = null; }
        if (!data || typeof data !== "object") data = {};
        if (!Array.isArray(data.buffs)) data.buffs = [];
        if (!Array.isArray(data.debuffs)) data.debuffs = [];
        return data;
    }

    /**
     * 整份数据写回自定义字段（推送到 Firebase）
     */
    static _save(token, data) {
        token.save({ [this.FIELD]: JSON.stringify(data) });
    }

    /**
     * 从 Token 的自定义字段中提取 Buff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} 标准结构条目 [{ rowId, name, enabled, rounds, initRounds, ... }]
     */
    static getTokenBuffs(token) {
        if (!token) return [];
        return this._load(token).buffs;
    }

    /**
     * 将 Buff 列表持久化回 Token 的自定义字段
     */
    static saveTokenBuffs(token, buffs) {
        if (!token) return;
        const data = this._load(token);
        data.buffs = buffs;
        this._save(token, data);
    }

    /**
     * 从 Token 的自定义字段中提取当前已登记的 Debuff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ key, rowId, name, rounds, enabled, isDebuff }]
     */
    static getTokenDebuffs(token) {
        if (!token) return [];
        return this._load(token).debuffs;
    }

    /**
     * 将 Debuff 列表持久化回 Token 的自定义字段
     */
    static saveTokenDebuffs(token, debuffs) {
        if (!token) return;
        const data = this._load(token);
        data.debuffs = debuffs;
        this._save(token, data);
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
            if (debuffData.linkHostId !== undefined) existing.linkHostId = debuffData.linkHostId;
            if (debuffData.linkSourceRowId !== undefined) existing.linkSourceRowId = debuffData.linkSourceRowId;
        } else {
            list.push({
                key: key,
                rowId: debuffData.rowId || key,
                name: debuffData.name || key,
                rounds: debuffData.rounds !== undefined ? debuffData.rounds : 0,
                initRounds: debuffData.initRounds !== undefined ? debuffData.initRounds : 0,
                enabled: debuffData.enabled !== undefined ? debuffData.enabled : false,
                linkHostId: debuffData.linkHostId || null,
                linkSourceRowId: debuffData.linkSourceRowId || null,
                linkChildren: [],
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
     * 对纯 Token 施加或刷新 Buff（同名只刷新轮数，不同名追加）
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 细目属性字典
     * @param {string|null} initRounds 预置初始轮数或公式
     * @returns {object|null} 落盘后的条目
     */
    static applyOrRefreshBuff(token, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!token) return null;
        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        const buffs = this.getTokenBuffs(token);
        const existing = buffs.find(b => b.name === cleanName);
        const cleanAttrs = (extraAttrs && typeof extraAttrs === "object")
            ? Object.fromEntries(Object.entries(extraAttrs).filter(([k]) => !k.startsWith("link_") && !k.startsWith("link")))
            : null;

        let entry;
        if (existing) {
            existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
            if (initRounds !== null && initRounds !== undefined) existing.initRounds = initRounds;
            if (cleanAttrs) existing.extraAttrs = cleanAttrs;
            existing.enabled = true;
            entry = existing;
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 剩余: ${rounds}轮`);
        } else {
            entry = {
                rowId: Roll20Bridge.generateStandardRowId(),
                name: cleanName,
                enabled: true,
                rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null,
                initRounds: initRounds ?? null,
                buffType: "spell",
                extraAttrs: cleanAttrs || null,
                linkHostId: null,
                linkSourceRowId: null,
                linkChildren: []
            };
            buffs.push(entry);
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 新增 Buff [${cleanName}], 轮数: ${rounds}`);
        }

        this.saveTokenBuffs(token, buffs);
        return entry;
    }

    /**
     * 移除纯 Token 上的某个 Buff
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称或 rowId
     */
    static removeBuff(token, buffName) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        let buffs = this.getTokenBuffs(token);
        const beforeLen = buffs.length;
        // 兼容两种定位方式：条目名或 rowId（归一化后两者可能不同）
        buffs = buffs.filter(b => b.name !== cleanName && b.rowId !== cleanName);

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

        const data = this._load(token);
        const { buffs, debuffs } = data;
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];

        // 1. 处理正面 Buff（过期条目直接从列表除名；未激活条目跳过，与人物卡语义一致）
        // 链接副本 (linkHostId + linkSourceRowId) 绝不在受术者自己的回合扣减，
        // 只由施法者主 Buff 回合开始时统一驱动（影子链接语义，与 Pf1eBuffManager 对齐）
        if (buffs.length > 0) {
            const remainingBuffs = [];
            for (const buff of buffs) {
                if (buff.enabled === false) { remainingBuffs.push(buff); continue; }
                if (buff.linkHostId && buff.linkSourceRowId) { remainingBuffs.push(buff); continue; }
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
            data.buffs = remainingBuffs;
        }

        // 2. 处理 Debuff 轮数倒计与到期关停（链接副本同样只由宿主驱动，本回合跳过）
        if (debuffs.length > 0) {
            for (const debuff of debuffs) {
                if (debuff.linkHostId && debuff.linkSourceRowId) continue;
                const result = BuffLifecycle.decrementEntry(debuff, {
                    isDebuff: true,
                    formatName: (e) => `[Debuff] ${e.name}`
                });
                if (!result) continue;
                processed.push(result);
            }
        }

        if (processed.length > 0) {
            this._save(token, data);
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

        const data = this._load(token);
        const { buffs, debuffs } = data;
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];
        for (const buff of buffs) {
            if (buff.enabled === false) continue;
            // 链接副本的轮数由施法者宿主统一回退，受术者自己回合不重复加回
            if (buff.linkHostId && buff.linkSourceRowId) continue;
            if (!BuffLifecycle.incrementEntry(buff)) continue;
            processed.push({ name: buff.name, status: "incremented", remaining: buff.rounds });
        }

        for (const debuff of debuffs) {
            if (debuff.linkHostId && debuff.linkSourceRowId) continue;
            if (!BuffLifecycle.incrementEntry(debuff, { isDebuff: true })) continue;
            processed.push({ name: `[Debuff] ${debuff.name}`, status: "incremented", remaining: debuff.rounds });
        }

        if (processed.length > 0) {
            this._save(token, data);
        }

        console.log(`[TokenBuffManager] 先攻回退: 为 Token [${token.get("name")}] 加回 Buff/Debuff 轮数共 ${processed.length} 项`);
        return processed;
    }
}
