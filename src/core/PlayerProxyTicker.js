import { Roll20Bridge } from "./Roll20Bridge.js";
import { BuffStore } from "./BuffStore.js";

/**
 * PlayerProxyTicker.js
 * 玩家端自理扣减（GM 端插件缺席时的自理路径）。
 *
 * 让位判据 = GM 插件公告（presence 旗 role="gm"）：GM 上线在自己的 presence 节点
 * 插旗、掉线由 Firebase onDisconnect 原生销毁。旗在 = 玩家端整体让位 GM 主路径；
 * 旗不在 = 先攻条轮到我控制的棋子时，我自己扣。
 *
 * 共卡仲裁 = presence 旗选举：多玩家共有同一棋子权限时，「有权控制 ∧ 插件在跑
 * （持有 role="player" 旗）」的玩家按确定性顺序选出唯一执行者——显式 controlledby
 * 列表按列表序、"all" 按玩家 ID 字典序——只有当选者扣减。旗即在线+运行双信号，
 * 当选者掉线自动失格，下一候选自动接管。
 *
 * 自理边界 = 写权限；跨权副本不可能存在于玩家自治部署中（副本落盘写在目标单位
 * 数据上，宿主规则天然阻断玩家跨权创建，applyBuffToTarget 另有目标写权准入）。
 *
 * 明示限制：隐藏 NPC 的自身 Buff 玩家无法代扣（写权限硬边界）；presence 在各端
 * 的传播存在亚秒级时差，极端时序窗口内极端情况下可能双扣一次。
 */
export class PlayerProxyTicker {
    /**
     * 回合开始入口（bundle 主入口接线；GM 端直接忽略，走 GM 主路径）
     */
    static onTurnStarted({ startedTokenId } = {}) {
        if (Roll20Bridge.isGM() || !startedTokenId) return;
        this._processTurn(startedTokenId, "tick").catch(err => {
            console.error("[Roll20Suite][PlayerProxy] 自理扣减编排异常:", err);
        });
    }

    /**
     * 先攻回退入口。affectedTokenId = 被拉回单位（原排头，其回合开始的扣减需被加回）
     */
    static onTurnReverted({ affectedTokenId } = {}) {
        if (Roll20Bridge.isGM() || !affectedTokenId) return;
        this._processTurn(affectedTokenId, "revert").catch(err => {
            console.error("[Roll20Suite][PlayerProxy] 自理回退编排异常:", err);
        });
    }

    /**
     * 自理执行主体：GM 旗判定 → 轮到我控制的棋子就扣/回退（共卡经旗选举唯一执行者）
     */
    static async _processTurn(affectedTokenId, kind) {
        // GM 旗在 → 我不管了
        const presence = await Roll20Bridge.readSuitePresence();
        if (presence.gmPresent) return;

        const tokenGraphic = Roll20Bridge.getTokenGraphic(affectedTokenId);
        if (!tokenGraphic) return;

        const resolved = Roll20Bridge.resolveBuffTargetMode(tokenGraphic);
        // 严格按 mode 构建互斥目标：杂兵集群 (mook) 的 resolved.char 非空，
        // 双字段同传会被 BuffStore.resolveMode 误路由到人物卡后端
        const selfTarget = resolved.mode === "char" ? { char: resolved.char } : { token: resolved.token };

        if ((selfTarget.char || selfTarget.token) && this._isSelfWritable(selfTarget, presence)) {
            if (selfTarget.char) await Roll20Bridge.ensureCharacterAttributes(selfTarget.char);
            try {
                if (kind === "tick") {
                    await BuffStore.tick(selfTarget);
                } else {
                    await BuffStore.revert(selfTarget);
                }
            } catch (err) {
                console.error(`[Roll20Suite][PlayerProxy] 自理${kind === "tick" ? "扣减" : "回退"}执行异常:`, err);
            }
        }
    }

    /**
     * 自理准入 + 共卡唯一执行者选举：
     * 候选 = 有权控制该单位（controlledby 显式列表 / "all" 全员名册）∧ 插件在跑
     * （持有 role="player" presence 旗，旗即在线+运行双信号，掉线自动失格）。
     * 当选序：显式列表按列表序、"all" 按玩家 ID 字典序，取首个候选——所有客户端
     * 对同一份数据解析结果一致，仅当选者扣减。
     */
    static _isSelfWritable(target, presence) {
        const ids = Roll20Bridge.getControllerIds(target.char || target.token);
        if (ids.length === 0) return false;
        const roster = ids.includes("all")
            ? presence.allPlayerIds.slice().sort()
            : ids.filter(id => id !== "all");
        const leader = roster.find(pid => presence.playerPids.includes(pid));
        return leader === Roll20Bridge.getCurrentPlayerId();
    }
}
