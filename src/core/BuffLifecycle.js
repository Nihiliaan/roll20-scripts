/**
 * BuffLifecycle.js
 * Buff / Debuff 轮数生命周期的纯算法核心（无任何宿主依赖，可直接单元测试）。
 *
 * 领域规则（单一事实来源，Pf1eBuffManager 与 TokenBuffManager 共用）：
 * - 扣减 (tick)：rounds 为 null/NaN 的常驻条目跳过；
 *   正数轮数逐轮 -1，归零即过期 (expire)；
 *   Debuff 允许 0/负数轮数持续正计轮 (0 -> -1 -> -2...)，记为 counted。
 * - 回退 (revert)：有效轮数统一 +1 (increment)。
 *
 * 本模块只负责"判定下一状态"，不做任何持久化；
 * 各 Manager 将返回的 status 映射到自己的持久化后端
 * （角色卡属性 / token gmnotes）。
 */
export class BuffLifecycle {
    /**
     * 判定一个条目扣减 1 轮后的下一状态（原地更新 entry.rounds，必要时 entry.enabled）
     * @param {object} entry { name, rounds, enabled? }
     * @param {object} [opts]
     * @param {boolean} [opts.isDebuff=false] Debuff 语义：跳过未激活条目、支持正计轮、过期时关停 enabled
     * @param {(entry: object) => string} [opts.formatName] 结果条目名称格式化（如 Debuff 前缀）
     * @returns {{name: string, status: "expired"|"decremented"|"counted", remaining: number}|null}
     *          null 表示该条目本回合不参与扣减（常驻/未激活/无轮数）
     */
    static decrementEntry(entry, { isDebuff = false, formatName = (e) => e.name } = {}) {
        if (!entry) return null;
        if (isDebuff && entry.enabled === false) return null;
        if (entry.rounds === null || entry.rounds === undefined || isNaN(entry.rounds)) return null;

        // Debuff 的 0/负数轮数：持续正计轮
        if (isDebuff && entry.rounds <= 0) {
            entry.rounds = entry.rounds - 1;
            return { name: formatName(entry), status: "counted", remaining: entry.rounds };
        }

        const nextRounds = entry.rounds - 1;
        if (nextRounds <= 0) {
            if (isDebuff) {
                entry.enabled = false;
                entry.rounds = 0;
                return { name: formatName(entry), status: "expired", remaining: 0 };
            }
            entry.rounds = nextRounds;
            return { name: formatName(entry), status: "expired", remaining: 0 };
        }

        entry.rounds = nextRounds;
        return { name: formatName(entry), status: "decremented", remaining: nextRounds };
    }

    /**
     * 判定一个条目回退（先攻倒转）加回 1 轮后的状态（原地更新 entry.rounds）
     * @param {object} entry { name, rounds, enabled? }
     * @param {object} [opts]
     * @param {boolean} [opts.isDebuff=false] Debuff 语义：跳过未激活条目
     * @returns {{status: "incremented", remaining: number}|null} null 表示不参与回退
     */
    static incrementEntry(entry, { isDebuff = false } = {}) {
        if (!entry) return null;
        if (isDebuff && entry.enabled === false) return null;
        if (entry.rounds === null || entry.rounds === undefined || isNaN(entry.rounds)) return null;

        entry.rounds = entry.rounds + 1;
        return { status: "incremented", remaining: entry.rounds };
    }
}
