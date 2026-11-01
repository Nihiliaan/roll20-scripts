/**
 * TurnOrderObserver.js
 * 负责监听先攻条的所有变动，利用循环移位置换算法精确识别正向回合推进与操作意图
 */
export class TurnOrderObserver {
    constructor() {
        this.cachedOrder = [];
        this.listeners = {
            turnEnded: [],
            turnStarted: [],
            turnReverted: [],
            orderChanged: []
        };
        this.isInitialized = false;
        this._lastLocalIntent = { action: null, timestamp: 0 };
    }

    /**
     * 注册事件回调（安全按需动态创建）
     * @param {"turnEnded"|"turnStarted"|"turnReverted"|"orderChanged"} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * 开始监听先攻变动与本地操作意图
     */
    start() {
        if (this.isInitialized || typeof window.Campaign === "undefined") return;

        // 初始化缓存
        const rawJson = window.Campaign.get("turnorder");
        this.cachedOrder = this.parseTurnorder(rawJson);

        // 1. 挂载本地用户操作捕获（委托到 document 捕获阶段，精准识别亲手点击）
        this.bindLocalIntentListeners();

        // 2. 绑定 Backbone 事件
        window.Campaign.on("change:turnorder", (campaign, newJson) => {
            this.handleTurnorderChange(newJson);
        });

        this.isInitialized = true;
        console.log("[TurnOrderObserver] 先攻事件监听器已就绪，当前排头:", this.getHeadTokenId());
    }

    /**
     * 监听本地先攻条前进/后退按钮点击，精准捕获本地发起者身份
     */
    bindLocalIntentListeners() {
        document.addEventListener("click", (e) => {
            const target = e.target;
            if (!target) return;

            // 前进按钮 (Next Turn)
            if (target.closest?.(".turn-tracker__forward, .ui-icon-seek-next, [data-action='next']")) {
                this._lastLocalIntent = { action: "forward", timestamp: Date.now() };
            }
            // 后退按钮 (Previous Turn)
            else if (target.closest?.(".turn-tracker__back, .ui-icon-seek-prev, [data-action='prev']")) {
                this._lastLocalIntent = { action: "back", timestamp: Date.now() };
            }
        }, true);
    }

    /**
     * 检查当前轮转是否由本地用户主动点击触发（1500ms 内有效）
     */
    checkAndConsumeLocalIntent(expectedAction) {
        const now = Date.now();
        const isMatch = this._lastLocalIntent.action === expectedAction && (now - this._lastLocalIntent.timestamp < 1500);
        // 消耗标记，防止单次点击重复生效
        this._lastLocalIntent = { action: null, timestamp: 0 };
        return isMatch;
    }

    /**
     * 解析先攻 JSON 数组
     */
    parseTurnorder(jsonStr) {
        try {
            return JSON.parse(jsonStr || "[]");
        } catch (e) {
            console.error("[TurnOrderObserver] 先攻数据解析失败:", e);
            return [];
        }
    }

    /**
     * 获取当前正在行动的 Token ID (排头)
     */
    getHeadTokenId() {
        return this.cachedOrder.length > 0 ? this.cachedOrder[0].id : null;
    }

    /**
     * 处理先攻变更
     */
    handleTurnorderChange(newJson) {
        const newList = this.parseTurnorder(newJson);
        const oldList = this.cachedOrder;

        // 若列表为空或元素数量变化（增删了怪物），仅更新缓存
        if (newList.length === 0 || oldList.length !== newList.length) {
            this.cachedOrder = newList;
            this.emit("orderChanged", { newList, oldList });
            return;
        }

        // 1. 判定正向轮转 (Next Turn): 循环左移 [A, B, C] -> [B, C, A]
        const isNextTurn = (newList[newList.length - 1].id === oldList[0].id) &&
                           (newList[0].id === oldList[1].id);

        // 2. 判定反向回退 (Previous Turn): 循环右移 [B, C, A] -> [A, B, C]
        const isPrevTurn = (oldList[oldList.length - 1].id === newList[0].id) &&
                           (oldList[0].id === newList[1].id);

        if (isNextTurn) {
            const endedTokenId = oldList[0].id;
            const startedTokenId = newList[0].id;
            const isLocalUserAction = this.checkAndConsumeLocalIntent("forward");

            console.log(`[TurnOrderObserver] 识别到正向回合结束: ${endedTokenId} -> 新排头: ${startedTokenId} (本地操作: ${isLocalUserAction})`);
            
            // 派发回合结束与回合开始
            this.emit("turnEnded", { endedTokenId, startedTokenId, oldList, newList, isLocalUserAction });
            this.emit("turnStarted", { startedTokenId, endedTokenId, newList, isLocalUserAction });
        } else if (isPrevTurn) {
            const revertedTokenId = newList[0].id;
            const isLocalUserAction = this.checkAndConsumeLocalIntent("back");
            console.log(`[TurnOrderObserver] 识别到先攻回退: ${oldList[0].id} <- ${revertedTokenId} (本地操作: ${isLocalUserAction})`);
            this.emit("turnReverted", { revertedTokenId, oldList, newList, isLocalUserAction });
        } else {
            console.log("[TurnOrderObserver] 识别到先攻排序或手动拖拽调整");
            // 仅在非前进/回退的重排（如手动拖拽或增减人员）时派发 orderChanged
            this.emit("orderChanged", { newList, oldList });
        }

        this.cachedOrder = newList;
    }

    /**
     * 派发内部事件
     */
    emit(event, data) {
        const callbacks = this.listeners[event] || [];
        for (const cb of callbacks) {
            try {
                cb(data);
            } catch (err) {
                console.error(`[TurnOrderObserver] 回调异常 [${event}]:`, err);
            }
        }
    }
}
