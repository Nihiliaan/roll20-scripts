import { Roll20Bridge } from "./Roll20Bridge.js";
import { Pf1eBuffManager } from "../modules/pf1e-buff-tracker/Pf1eBuffManager.js";
import { TokenBuffManager } from "../modules/token-buff/TokenBuffManager.js";

/**
 * BuffStore.js
 * 统一存取层 (Storage Facade)：把 Pf1eBuffManager（人物卡原生属性后端）与
 * TokenBuffManager（Token 自定义字段后端）的存取 API 合一，向上层暴露单一目标语义。
 *
 * 目标 (target) 形如 { char, token }——恰好其一非空，由调用方经
 * Roll20Bridge.resolveBuffTargetMode / 面板选中上下文给出。所有方法内部
 * 按 resolveMode 路由到正确后端，上层不再书写 char/token 双分支。
 *
 * 形状契约：
 * - Buff 条目: { rowId, name, enabled, rounds, initRounds, extraAttrs,
 *                linkHostId, linkSourceRowId, linkChildren }（双后端同一字段语义）
 * - Debuff 条目: { rowId, key, name, enabled, rounds, initRounds, isDebuff,
 *                  linkHostId, linkSourceRowId, linkChildren }
 * - toggleBuff / removeBuff 的条目定位：char 后端按 rowId，token 后端按 rowId(或名称)，
 *   统一传条目对象 { rowId, name }，由本层选择后端主键。
 *
 * 注意：bulk 保存 (saveBuffs/saveDebuffs) 仅 Token 后端存在整表写语义；
 * 人物卡后端是属性级存储，对 char 目标调用会显式抛错，防止上层误用。
 */
export class BuffStore {
    /**
     * 判定目标后端模式
     * @param {{char?: object, token?: object}} target
     * @returns {"char"|"token"|null}
     */
    static resolveMode(target) {
        if (!target) return null;
        if (target.char) return "char";
        if (target.token) return "token";
        return null;
    }

    static _assertMode(mode) {
        if (!mode) throw new Error("[BuffStore] 目标为空：target 中 char 与 token 均未提供");
        return mode;
    }

    // ==========================================
    // 读取
    // ==========================================

    /**
     * 读取目标全量 Buff 列表（面板渲染用；char 为 async 属性扫描，token 为字段直读）
     */
    static async getBuffs(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.getAllBuffs(target.char);
        return TokenBuffManager.getTokenBuffs(target.token).filter(b => !b.isDebuff);
    }

    /**
     * 读取目标全量 Debuff 登记列表（含未激活；形状双后端一致）
     */
    static async getDebuffs(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.getAllDebuffsSync(target.char);
        return TokenBuffManager.getTokenDebuffs(target.token).map(b => ({
            rowId: b.rowId || b.key || b.name,
            key: b.key || b.name,
            name: b.name,
            enabled: b.enabled === true,
            rounds: (b.rounds !== undefined && b.rounds !== null) ? b.rounds : null,
            initRounds: b.initRounds || null,
            isDebuff: true,
            linkHostId: b.linkHostId || null,
            linkSourceRowId: b.linkSourceRowId || null,
            linkChildren: b.linkChildren || []
        }));
    }

    /**
     * 读取目标当前激活的 Debuff（先攻条徽章渲染用）
     */
    static async getActiveDebuffs(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.getAllDebuffsSync(target.char).filter(d => d.enabled);
        return (await this.getDebuffs(target)).filter(d => d.enabled);
    }

    /**
     * 读取目标当前激活的 Buff（先攻条徽章渲染用）
     */
    static async getActiveBuffs(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.getActiveBuffs(target.char);
        return (await this.getBuffs(target)).filter(b => b.enabled);
    }

    // ==========================================
    // Buff 写操作
    // ==========================================

    /**
     * 施加或刷新 Buff（同名刷新轮数，不同名追加）
     */
    static async applyOrRefreshBuff(target, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.applyOrRefreshBuff(target.char, buffName, rounds, extraAttrs, initRounds);
        return TokenBuffManager.applyOrRefreshBuff(target.token, buffName, rounds, extraAttrs, initRounds);
    }

    /**
     * 切换目标身上某个 Buff 的启停
     * @param {{rowId: string, name?: string}} entry 条目对象（char 按 rowId，token 按 rowId 或名称定位）
     */
    static async toggleBuff(target, entry, enable) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.toggleBuff(target.char, entry.rowId, enable);
        return TokenBuffManager.toggleBuff(target.token, entry.name || entry.rowId, enable);
    }

    /**
     * 按行 ID 切换启停（多选批量操作用，调用方手里只有 rowId 字符串）：
     * char 按 condition- 前缀路由 Debuff/Buff 通道；token 依次查 Buff 字段列表（rowId 或名称）
     * 与 Debuff 列表，命中即切换。
     */
    static async toggleById(target, rowId, enable) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") {
            if (typeof rowId === "string" && rowId.startsWith("condition-")) {
                return Pf1eBuffManager.toggleCondition(target.char, rowId, enable);
            }
            return Pf1eBuffManager.toggleBuff(target.char, rowId, enable);
        }
        const buffs = TokenBuffManager.getTokenBuffs(target.token);
        const buff = buffs.find(b => b.rowId === rowId || b.name === rowId);
        if (buff) {
            buff.enabled = !!enable;
            TokenBuffManager.saveTokenBuffs(target.token, buffs);
            return true;
        }
        return TokenBuffManager.toggleDebuff(target.token, rowId, enable);
    }

    /**
     * 关停目标身上与指定 Buff/Debuff 同名的所有激活条目（GM 跨单位同名关停用）
     * @returns {Promise<number>} 受影响条目数
     */
    static async deactivateHomonym(target, buff, isDebuff) {
        const mode = this._assertMode(this.resolveMode(target));
        const targetName = (buff.name || "").trim().toLowerCase();
        if (mode === "token") {
            return (await this.removeBuff(target, buff)) ? 1 : 0;
        }
        const char = target.char;
        let count = 0;
        if (isDebuff) {
            const def = Pf1eBuffManager.PF1E_DEBUFF_DEFINITIONS.find(d => d.name.trim().toLowerCase() === targetName || d.key === buff.rowId);
            if (def) {
                await Pf1eBuffManager.toggleCondition(char, def.key, false);
                count++;
            }
            return count;
        }
        const allBuffs = await Pf1eBuffManager.getAllBuffs(char);
        for (const cb of allBuffs) {
            if ((cb.name || "").trim().toLowerCase() === targetName && cb.enabled) {
                await Pf1eBuffManager.toggleBuff(char, cb.rowId, false);
                count++;
            }
        }
        return count;
    }

    /**
     * 修改目标身上某个 Buff 的剩余轮数
     */
    static async setBuffRounds(target, entry, rounds) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.setBuffRounds(target.char, entry.rowId, rounds);
        const list = TokenBuffManager.getTokenBuffs(target.token);
        const t = list.find(x => x.name === (entry.name || entry.rowId) || x.rowId === entry.rowId);
        if (!t) return false;
        t.rounds = rounds;
        TokenBuffManager.saveTokenBuffs(target.token, list);
        return true;
    }

    /**
     * 修改目标身上某个 Buff 的预置初始轮数/公式（就地编辑用；token 端非数字写 null）
     */
    static async setBuffInitRounds(target, entry, val) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.setBuffInitRounds(target.char, entry.rowId, val);
        const list = TokenBuffManager.getTokenBuffs(target.token);
        const t = list.find(x => x.name === (entry.name || entry.rowId) || x.rowId === entry.rowId);
        if (!t) return false;
        t.initRounds = (val !== "" && val !== null && val !== undefined && !isNaN(Number(val))) ? Number(val) : null;
        TokenBuffManager.saveTokenBuffs(target.token, list);
        return true;
    }

    /**
     * 移除目标身上的某个 Buff（双后端统一为物理删除语义）：
     * char 物理删除整行属性（含链接关系级联）；token 物理删除字段条目
     */
    static async removeBuff(target, entry) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.deleteBuffRowPermanently(target.char, entry.rowId);
        return TokenBuffManager.removeBuff(target.token, entry.name || entry.rowId);
    }

    /**
     * 断开目标身上某个 Buff 的影子链接，转为独立副本
     * （char 走 unlinkBuff；token 清顶层链接字段并向宿主除名）
     */
    static async unlinkBuff(target, entry) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.unlinkBuff(target.char, entry.rowId);

        const token = target.token;
        if (!entry.linkHostId) return false;
        const list = TokenBuffManager.getTokenBuffs(token);
        const t = list.find(x => x.rowId === entry.rowId) || list.find(x => x.name === entry.name);
        if (!t) return false;
        const srcRowId = t.linkSourceRowId;
        const hostId = t.linkHostId;
        t.linkHostId = null;
        t.linkSourceRowId = null;
        TokenBuffManager.saveTokenBuffs(token, list);
        const hostChar = window.Campaign?.characters?.get(hostId);
        if (hostChar && srcRowId) {
            await Pf1eBuffManager.removeDownstreamLink(hostChar, srcRowId, token.id, t.rowId);
        }
        return true;
    }

    /**
     * 一键关停/清空目标身上的全部 Buff 与 Debuff
     * （char 逐个关停激活项保留登记；token 直接清空两份字段列表）
     */
    static async clearAll(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") {
            const char = target.char;
            const activeBuffs = await Pf1eBuffManager.getActiveBuffs(char);
            for (const b of activeBuffs) {
                await Pf1eBuffManager.toggleBuff(char, b.rowId, false);
            }
            const activeDebuffs = Pf1eBuffManager.getAllDebuffsSync(char).filter(d => d.enabled);
            for (const d of activeDebuffs) {
                await Pf1eBuffManager.toggleCondition(char, d.key, false);
            }
            return true;
        }
        TokenBuffManager.saveTokenBuffs(target.token, []);
        TokenBuffManager.saveTokenDebuffs(target.token, []);
        return true;
    }

    /**
     * 整表写回 Buff 列表（仅 Token 后端；char 后端为属性级存储，禁止整表写）
     */
    static saveBuffs(target, list) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode !== "token") throw new Error("[BuffStore] saveBuffs 仅支持 Token 后端（char 后端请用 toggleBuff/setBuffRounds/removeBuff 属性级操作）");
        TokenBuffManager.saveTokenBuffs(target.token, list);
    }

    // ==========================================
    // Debuff 写操作
    // ==========================================

    /**
     * 切换目标身上某个 Debuff / Condition 的启停
     * @param {string} key condition key (如 "condition-Bleed") 或 Token 条目 key
     */
    static async toggleDebuff(target, key, enable) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.toggleCondition(target.char, key, enable);
        return TokenBuffManager.toggleDebuff(target.token, key, enable);
    }

    /**
     * 修改目标身上某个 Debuff 的轮数（就地编辑用；char 后端 null 清空写为 ""）
     */
    static async setDebuffRounds(target, key, rounds) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") {
            const char = target.char;
            const roundVal = rounds !== null && rounds !== undefined ? rounds : "";
            const roundsAttr = Roll20Bridge.findAttr(char, `${key}_rounds`);
            if (roundsAttr) {
                roundsAttr.save({ current: roundVal }, { byScript: true });
            } else {
                char.attribs.create({ name: `${key}_rounds`, current: roundVal });
            }
            return true;
        }
        const list = TokenBuffManager.getTokenDebuffs(target.token);
        const t = list.find(d => (d.key || d.name) === key);
        if (!t) return false;
        t.rounds = rounds;
        TokenBuffManager.saveTokenDebuffs(target.token, list);
        return true;
    }

    /**
     * 彻底解除目标的某个 Debuff（char 为级联删除含链接关系；token 为除名登记）
     */
    static async deleteDebuffPermanently(target, key) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.deleteDebuffPermanently(target.char, key);
        return TokenBuffManager.removeTrackedDebuff(target.token, key);
    }

    /**
     * 按 rowId 彻底删除目标身上的条目（多选批量删除用；链接副本删除前先向宿主除名防幽灵）
     */
    static async deleteById(target, rowId) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") {
            if (typeof rowId === "string" && rowId.startsWith("condition-")) {
                return Pf1eBuffManager.deleteDebuffPermanently(target.char, rowId);
            }
            return Pf1eBuffManager.deleteBuffRowPermanently(target.char, rowId);
        }
        const token = target.token;
        // 若条目是链接副本，先向宿主除名（否则宿主子计数残留幽灵）
        const buffs = TokenBuffManager.getTokenBuffs(token);
        const victim = buffs.find(e => e.rowId === rowId || e.name === rowId);
        if (victim && victim.linkHostId) {
            const hostChar = window.Campaign?.characters?.get(victim.linkHostId);
            if (hostChar && victim.linkSourceRowId) {
                await Pf1eBuffManager.removeDownstreamLink(hostChar, victim.linkSourceRowId, token.id, victim.rowId);
            }
        }
        TokenBuffManager.removeTrackedDebuff(token, rowId);
        return TokenBuffManager.removeBuff(token, rowId);
    }

    /**
     * 登记 Debuff 到目标的追踪列表（char 写 tracked_debuffs；token 写字段 debuffs 登记）
     */
    static async addTrackedDebuff(target, key) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.addTrackedDebuff(target.char, key);
        return TokenBuffManager.addTrackedDebuff(target.token, { key, name: key, rounds: 0, enabled: false });
    }

    /**
     * 从目标的追踪列表中除名 Debuff
     */
    static async removeTrackedDebuff(target, key) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.removeTrackedDebuff(target.char, key);
        return TokenBuffManager.removeTrackedDebuff(target.token, key);
    }

    /**
     * 整表写回 Debuff 列表（仅 Token 后端；同 saveBuffs）
     */
    static saveDebuffs(target, list) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode !== "token") throw new Error("[BuffStore] saveDebuffs 仅支持 Token 后端（char 后端请用 toggleDebuff/setDebuffRounds/removeTrackedDebuff 属性级操作）");
        TokenBuffManager.saveTokenDebuffs(target.token, list);
    }

    // ==========================================
    // 生命周期（回合驱动）
    // ==========================================

    /**
     * 回合开始扣减：按目标模式路由（内部已含链接副本跳过与宿主驱动联动）
     */
    static async tick(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.decrementBuffs(target.char);
        return TokenBuffManager.decrementBuffs(target.token);
    }

    /**
     * 先攻回退加轮：按目标模式路由
     */
    static async revert(target) {
        const mode = this._assertMode(this.resolveMode(target));
        if (mode === "char") return Pf1eBuffManager.incrementBuffsOnTurnRevert(target.char);
        return TokenBuffManager.incrementBuffsOnTurnRevert(target.token);
    }

    // ==========================================
    // 刷新通知
    // ==========================================

    /**
     * 目标状态变更后通知徽章/面板刷新（统一走 Pf1eBuffUI.requestTokenRefresh）
     */
    static notifyRefresh(target) {
        const mode = this.resolveMode(target);
        if (mode === "char" && target.char?.id) {
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(target.char.id);
        } else if (mode === "token" && target.token?.id) {
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(target.token.id);
        }
    }
}
