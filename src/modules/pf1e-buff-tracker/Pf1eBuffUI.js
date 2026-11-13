import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { Pf1eBuffManager } from "./Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { escapeHtml } from "../../core/Roll20Bridge.js";

/**
 * Pf1eBuffUI.js
 * 负责在先攻条注入极致紧凑的双行 Buff 徽章，同时无缝支持人物卡与纯野怪 Token
 * 配备持久化 MutationObserver 防御 Vue 响应式 DOM 重绘
 */
export class Pf1eBuffUI {
    static isStylesInjected = false;
    static isObserverStarted = false;
    static _observer = null;

    // 便签板（微任务任务合并队列，彻底消除连环触发与并发竞态）
    static pendingTokenIds = new Set();
    static isFlushingScheduled = false;

    /**
     * 投递刷新请求到便签板（自动去重并微任务合并）
     * 兼顾传入 Token ID、Token 模型、Character ID 或 Character 模型，自适应拓扑解析并准确定向投递！
     * @param {string|object} tokenOrCharOrId 
     */
    static requestTokenRefresh(tokenOrCharOrId) {
        if (!tokenOrCharOrId) return;

        let tokenId = null;
        let charId = null;

        if (typeof tokenOrCharOrId === "object") {
            if (tokenOrCharOrId.attribs) {
                // Character Backbone 模型
                charId = tokenOrCharOrId.id;
            } else if (typeof tokenOrCharOrId.get === "function") {
                // Graphic Token 模型
                tokenId = tokenOrCharOrId.id;
                charId = tokenOrCharOrId.get("represents");
            }
        } else if (typeof tokenOrCharOrId === "string") {
            const rawId = tokenOrCharOrId.trim();
            // 先尝试在当前先攻 DOM 查找对应 Token 节点
            const hasRow = document.querySelector(`#vm-turn-order li.token[data-tokenid="${rawId}"], .turn-tracker li.token[data-tokenid="${rawId}"], #initiativewindow li.token[data-tokenid="${rawId}"]`);
            if (hasRow) {
                tokenId = rawId;
            } else {
                // 若找不到直接匹配的 Token，则视为角色 ID 自动查找其在先攻栏中的对应 Token
                charId = rawId;
            }
        }

        if (tokenId) {
            this.pendingTokenIds.add(tokenId);
        }
        if (charId) {
            this.scheduleTokensRepresentingCharacter(charId);
        }

        if (!this.isFlushingScheduled && this.pendingTokenIds.size > 0) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 微任务检查点：批量清空便签板并单次刷新
     */
    static flushPendingRefreshes() {
        const tokenIds = Array.from(this.pendingTokenIds);
        this.pendingTokenIds.clear();
        this.isFlushingScheduled = false;

        for (const tid of tokenIds) {
            try {
                this.refreshSingleTokenBadgeSync(tid, { force: true });
            } catch (err) {
                console.error(`[Pf1eBuffUI] 便签板刷新 Token [${tid}] 异常:`, err);
            }
        }
    }

    static injectStyles() {
        if (this.isStylesInjected) return;
        const style = document.createElement("style");
        style.id = "pf1e-buff-tracker-styles";
        style.textContent = `
            #vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token {
                flex-wrap: wrap !important;
                height: auto !important;
                min-height: 38px !important;
                padding-bottom: 4px !important;
                padding-top: 2px !important;
            }
            .r20-debuff-container {
                order: -1 !important;
                display: flex !important;
                flex-wrap: wrap !important;
                flex-basis: 100% !important;
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-bottom: 2px !important;
                gap: 2px 4px !important;
                line-height: 1 !important;
                overflow: hidden !important;
            }
            .r20-buff-container {
                order: 99 !important;
                display: flex !important;
                flex-wrap: wrap !important;
                flex-basis: 100% !important;
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-top: 2px !important;
                gap: 2px 4px !important;
                line-height: 1 !important;
                overflow: hidden !important;
            }
            .r20-buff-pill-compact {
                display: inline-flex;
                align-items: center;
                background: #1e3a8a;
                color: #f1f5f9;
                font-size: 10px;
                font-weight: 600;
                padding: 1px 5px;
                border-radius: 3px;
                cursor: pointer;
                user-select: none;
                border: 1px solid rgba(255, 255, 255, 0.2);
                white-space: nowrap;
                transition: background 0.15s, border-color 0.15s;
            }
            .r20-buff-pill-compact:hover {
                background: #2563eb;
                border-color: #93c5fd;
                color: #ffffff;
            }
            .r20-buff-pill-compact.expiring {
                background: #7f1d1d;
                border-color: #f87171;
                color: #fecaca;
            }
            .r20-buff-pill-debuff {
                display: inline-flex;
                align-items: center;
                background: #881337 !important;
                border-color: #f43f5e !important;
                color: #ffe4e6 !important;
                font-size: 10px;
                font-weight: 600;
                padding: 1px 5px;
                border-radius: 3px;
                cursor: pointer;
                user-select: none;
                border: 1px solid rgba(255, 255, 255, 0.2);
                white-space: nowrap;
                transition: background 0.15s, border-color 0.15s;
            }
            .r20-buff-pill-debuff:hover {
                background: #be123c !important;
                border-color: #fda4af !important;
                color: #ffffff !important;
            }
            .r20-pill-name {
                cursor: pointer;
            }
            .r20-pill-round {
                margin-left: 3px;
                padding: 0 2px;
                border-radius: 2px;
                background: rgba(0, 0, 0, 0.25);
                font-weight: 700;
                cursor: pointer;
                transition: background 0.12s, color 0.12s;
            }
            .r20-pill-round:hover {
                background: rgba(56, 189, 248, 0.4);
                color: #ffffff;
                text-decoration: underline;
            }
            .r20-input-round-inline-pill {
                width: 32px;
                min-width: 24px;
                max-width: 50px;
                height: 14px;
                line-height: 14px;
                padding: 0 1px;
                font-size: 9px;
                font-family: inherit;
                text-align: center;
                border: 1px solid #38bdf8;
                background: #0f172a;
                color: #f8fafc;
                border-radius: 2px;
                outline: none;
                box-shadow: 0 0 4px rgba(56, 189, 248, 0.6);
                box-sizing: border-box;
                margin-left: 2px;
            }
        `;
        document.head.appendChild(style);
        this.isStylesInjected = true;
    }

    /**
     * 劫持 Vue 3 先攻条核心组件生命周期 (TurnTracker 的 updated 与 mounted)
     * 在 Vue 3 完成 DOM patch 渲染同一微任务帧内，纯同步就地挂载 Buff，从物理上 0ms 根除闪烁！
     */
    static hookVueTurnTracker() {
        try {
            const el = document.getElementById("vm-turn-order");
            const appComp = el?._vnode?.component;
            const trackerComp = appComp?.subTree?.component;
            if (!trackerComp) return false;

            if (trackerComp._r20SuiteHooked) return true;

            const onSyncPatch = () => {
                Pf1eBuffUI.syncPatchAllBadges();
            };

            if (!trackerComp.u) trackerComp.u = [];
            trackerComp.u.push(onSyncPatch);

            if (!trackerComp.m) trackerComp.m = [];
            trackerComp.m.push(onSyncPatch);

            trackerComp._r20SuiteHooked = true;
            return true;
        } catch (e) {
            console.warn("[Pf1eBuffUI] 挂钩 Vue 3 先攻组件异常:", e);
            return false;
        }
    }

    /**
     * 劫持原生先攻窗口控制器 (Campaign.initiativewindow.rebuildInitiativeList)
     */
    static hookInitiativeWindow() {
        try {
            const iw = window.Campaign?.initiativewindow;
            if (!iw || iw._r20SuiteHooked) return;

            const origRebuild = iw.rebuildInitiativeList;
            if (typeof origRebuild === "function") {
                iw.rebuildInitiativeList = function() {
                    const res = origRebuild.apply(this, arguments);
                    Pf1eBuffUI.hookVueTurnTracker();
                    queueMicrotask(() => Pf1eBuffUI.syncPatchAllBadges());
                    return res;
                };
            }
            iw._r20SuiteHooked = true;
        } catch (e) {
            console.warn("[Pf1eBuffUI] 挂钩先攻窗口控制器异常:", e);
        }
    }

    /**
     * 启动持久 DOM 监听器（仅作为 Vue 3 生命周期外的双保险纯同步兜底）
     */
    static startObserver() {
        if (this.isObserverStarted) return;
        this.injectStyles();
        this.hookInitiativeWindow();
        this.hookVueTurnTracker();

        // 1. 监听主窗口变动（纯同步即时补全，彻底移除 80ms 延时！）
        if (this._observer) this._observer.disconnect();

        this._observer = new MutationObserver((mutations) => {
            let hasNewUnmountedTokens = false;
            for (const m of mutations) {
                // 忽略自身 buff 容器引起的变动，杜绝回环震荡
                if (m.target?.closest?.(".r20-buff-container") || m.target?.closest?.(".r20-debuff-container")) continue;

                if (m.type === "childList") {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.matches?.("li.token") && (!node.querySelector(".r20-buff-container") || !node.querySelector(".r20-debuff-container"))) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.querySelector?.("li.token") && (!node.querySelector(".r20-buff-container") || !node.querySelector(".r20-debuff-container"))) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.id === "vm-turn-order" || node.matches?.(".turn-tracker")) {
                                hasNewUnmountedTokens = true;
                                break;
                            }
                        }
                    }
                }
                if (hasNewUnmountedTokens) break;
            }

            if (hasNewUnmountedTokens) {
                this.hookVueTurnTracker();
                this.syncPatchAllBadges();
            }
        });

        // 优先监听 vm-turn-order 或 body
        const targetContainer = document.getElementById("vm-turn-order") || document.body;
        this._observer.observe(targetContainer, { childList: true, subtree: true });

        // 2. 先攻窗口打开/切换时初始化
        if (window.Campaign && typeof window.Campaign.on === "function") {
            this._boundInitiativePageHandler = () => {
                this.hookInitiativeWindow();
                this.hookVueTurnTracker();
                queueMicrotask(() => this.syncPatchAllBadges());
            };
            window.Campaign.on("change:initiativepage", this._boundInitiativePageHandler);
        }

        // 3. 监听全局用户偏好设置变动（如首字缩写开关、队友 Buff 互见开关）
        this._boundSettingChangedHandler = (e) => {
            if (e.detail?.key === "turnorder_buff_abbr" || e.detail?.key === "party_buffs_visible") {
                this.syncPatchAllBadges({ force: true });
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);

        this.isObserverStarted = true;
        this.hookAttributePersistence();
        // 立即尝试一次初次刷新
        this.syncPatchAllBadges();
    }

    /**
     * 停止先攻条 DOM 监听与事件（热重载清理支持）
     */
    static stopObserver() {
        if (!this.isObserverStarted) return;
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        if (this._boundInitiativePageHandler && window.Campaign && typeof window.Campaign.off === "function") {
            window.Campaign.off("change:initiativepage", this._boundInitiativePageHandler);
            this._boundInitiativePageHandler = null;
        }
        if (this._boundSettingChangedHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);
            this._boundSettingChangedHandler = null;
        }
        this.isObserverStarted = false;
        console.log("[Pf1eBuffUI] 先攻条 DOM 响应式监听与事件已成功卸载");
    }

    static get PF1E_DEBUFF_DEFINITIONS() {
        return (typeof Pf1eBuffManager !== "undefined" && Pf1eBuffManager.PF1E_DEBUFF_DEFINITIONS) ? Pf1eBuffManager.PF1E_DEBUFF_DEFINITIONS : [];
    }

    /**
     * 纯同步：提取角色身上所有已登记/被追踪的负面状态 (供调度器工作台全量渲染)
     * 存储逻辑已下沉至 Pf1eBuffManager.getAllDebuffsSync，此处仅保留委托别名
     */
    static getAllDebuffsSync(character) {
        return Pf1eBuffManager.getAllDebuffsSync(character);
    }

    /**
     * 纯同步：从角色底层内存对象中提取当前实际处于“激活”状态的负面状态 (供先攻条与 Token 角标徽章渲染)
     */
    static getActiveDebuffsSync(character) {
        return this.getAllDebuffsSync(character).filter(d => d.enabled);
    }

    /**
     * 异步：提取角色身上所有已登记的 Debuff (包含已激活与已关停，供视口渲染)
     */
    static async getAllDebuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        return this.getAllDebuffsSync(character);
    }

    /**
     * 纯同步：从角色底层内存对象中瞬时提取当前激活的正面 Buff 状态（0ms 零延迟、单次 O(N) 索引扫描）
     */
    static getActiveBuffsSync(character) {
        if (!character || !character.attribs || !character.attribs.models) return [];
        const models = character.attribs.models;
        const activeMap = new Map();

        for (let i = 0; i < models.length; i++) {
            const a = models[i];
            const attrName = a.get("name") || "";
            if (!attrName.startsWith("repeating_buff2_")) continue;
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) continue;
            const rowId = match[1];
            const subKey = match[2];

            let item = activeMap.get(rowId);
            if (!item) {
                item = { rowId, prefix: `repeating_buff2_${rowId}`, enabled: false, name: "", rounds: null };
                activeMap.set(rowId, item);
            }

            if (subKey === "enable_toggle") {
                const val = a.get("current");
                item.enabled = (val === 1 || val === "1" || val === true);
            } else if (subKey === "name") {
                item.name = a.get("current") || "";
            } else if (subKey === "rounds") {
                const cur = a.get("current");
                if (cur !== "" && cur !== null && cur !== undefined) {
                    const r = Number(cur);
                    if (!isNaN(r)) item.rounds = r;
                }
            }
        }

        const buffs = [];
        for (const item of activeMap.values()) {
            if (item.enabled) {
                buffs.push({
                    rowId: item.rowId,
                    prefix: item.prefix,
                    name: item.name || "未命名Buff",
                    enabled: true,
                    rounds: item.rounds
                });
            }
        }
        return buffs;
    }

    /**
     * 判定属性名是否属于 Buff 或 Debuff 核心控制字段
     */
    static isBuffCoreAttrName(name) {
        if (!name) return false;
        if (name.startsWith("condition-")) return true;
        if (name.startsWith("repeating_buff2_")) return true;
        return false;
    }

    static _pendingDownstreamSyncMap = new Map();
    static _downstreamSyncTimer = null;
    static _focusoutHooked = false;

    /**
     * 初始化失焦驱动与交互结算监听（确保与原生及 iframe 失焦协同）
     */
    static initFocusoutDownstreamSync() {
        if (this._focusoutHooked || typeof window === "undefined") return;
        this._focusoutHooked = true;

        const onDismissOrBlur = (e) => {
            if (this._pendingDownstreamSyncMap.size > 0) {
                this.triggerPendingDownstreamSync("blur_interaction");
            }
        };

        window.addEventListener("focusout", onDismissOrBlur, { capture: true, passive: true });
        window.addEventListener("pointerdown", onDismissOrBlur, { capture: true, passive: true });
    }

    /**
     * 结算并触发所有暂存的下游自动同步
     */
    static async triggerPendingDownstreamSync(reason = "blur") {
        if (this._downstreamSyncTimer) {
            clearTimeout(this._downstreamSyncTimer);
            this._downstreamSyncTimer = null;
        }
        if (this._pendingDownstreamSyncMap.size === 0) return;

        const tasks = Array.from(this._pendingDownstreamSyncMap.values());
        this._pendingDownstreamSyncMap.clear();

        for (const { char, rowId } of tasks) {
            try {
                const count = await Pf1eBuffManager.broadcastDownstreamSync(char, rowId);
                if (count > 0) {
                    console.log(`[Pf1eBuffUI] 结合失焦与云端同步事件，已自动向 ${count} 个下游副本同步最新细目 (契机: ${reason})`);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 自动同步下游异常:", err);
            }
        }
    }

    /**
     * 挂载底层属性持久化单一源头报告器（彻底取代散乱的人物卡事件监听）
     * 拦截原生人物卡编辑器 (advancedSheetSave) 与标准保存 (save/syncedSave)，由源头直接报告变动
     */
    static hookAttributePersistence() {
        this.initFocusoutDownstreamSync();
        const char = window.Campaign?.characters?.at(0);
        const modelClass = char?.attribs?.model;
        const proto = modelClass?.prototype;
        if (!proto || proto._r20SuiteAttrHooked) return true;

        const origAdvancedSave = proto.advancedSheetSave;
        if (typeof origAdvancedSave === "function") {
            proto.advancedSheetSave = function(data, callback) {
                const res = origAdvancedSave.apply(this, arguments);
                Pf1eBuffUI.reportAttributeMutationFromSource(this, "advancedSheetSave");
                return res;
            };
        }

        const origSyncedSave = proto.syncedSave;
        if (typeof origSyncedSave === "function") {
            proto.syncedSave = function(attrs) {
                const res = origSyncedSave.apply(this, arguments);
                Pf1eBuffUI.reportAttributeMutationFromSource(this, "syncedSave");
                return res;
            };
        }

        const origSave = proto.save;
        if (typeof origSave === "function") {
            proto.save = function(key, val, options) {
                const res = origSave.apply(this, arguments);
                const opts = (typeof key === "object" ? val : options) || {};
                if (!opts.bySuite && !opts.bySuiteSync && !Pf1eBuffManager.isScriptMutating) {
                    Pf1eBuffUI.reportAttributeMutationFromSource(this, "save");
                }
                return res;
            };
        }

        proto._r20SuiteAttrHooked = true;
        return true;
    }

    /**
     * 属性变动统一源头报告：仅在原生人物卡或外部修改关键字段时，定向通知先攻条、视口以及下游自动同步
     */
    static reportAttributeMutationFromSource(attrModel, sourceAction = "save") {
        if (!attrModel) return;
        const attrName = attrModel.get ? attrModel.get("name") : "";
        if (!this.isBuffCoreAttrName(attrName)) return;

        const charId = attrModel.collection?.character?.id;
        if (!charId) return;

        // 1. 定向通知先攻条徽章便签板微任务合并刷新
        this.scheduleTokensRepresentingCharacter(charId);

        // 2. 若当前自研悬浮窗正好聚焦该角色，同步刷新当前视口呈现最新内存变量
        try {
            if (typeof window !== "undefined") {
                const P = window.Roll20Suite?.BuffFloatingPanel;
                if (P && P.activeTarget && P.activeTarget.id === charId) {
                    P.renderViewport();
                }
            }
        } catch (e) {}

        // 3. 宿主源 Buff 下游自动同步调度：结合 syncedSave 与失焦事件
        if (attrName.startsWith("repeating_buff2_")) {
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) return;
            const rowId = match[1];
            const subKey = match[2];
            const prefix = `repeating_buff2_${rowId}`;

            // 若为原生开关激活（enable_toggle 变为 1），直接在底层源头合并执行初始轮数重置！
            if (subKey === "enable_toggle") {
                const curVal = attrModel.get ? attrModel.get("current") : null;
                if (curVal === 1 || curVal === "1" || curVal === true) {
                    const char = attrModel.collection?.character || window.Campaign?.characters?.get(charId);
                    if (char && !Pf1eBuffManager.isScriptMutating) {
                        Pf1eBuffManager.resetBuffRoundsToInitial(char, rowId);
                    }
                }
                return;
            }

            // 严格排除本地独立字段（剩余轮数）以及链接元属性
            if (subKey === "rounds" || subKey.startsWith("link_")) {
                return;
            }

            const char = attrModel.collection?.character || window.Campaign?.characters?.get(charId);
            if (!char || !char.attribs) return;

            // 排除子链接副本，防止回环广播
            const isChild = char.attribs.models.some(a => a.get("name") === `${prefix}_link_host_id`);
            if (isChild) return;

            // 暂存待广播任务（在 triggerPendingDownstreamSync -> broadcastDownstreamSync 内部具备拓扑自愈下游能力）
            const syncKey = `${charId}:${rowId}`;
            this._pendingDownstreamSyncMap.set(syncKey, { char, rowId });

            // 启动防抖静止倒计时（600ms 内无后续修改且未显式触发失焦时兜底完成结算）
            if (this._downstreamSyncTimer) clearTimeout(this._downstreamSyncTimer);
            this._downstreamSyncTimer = setTimeout(() => {
                this.triggerPendingDownstreamSync("debounce_quiet");
            }, 600);
        }
    }

    /**
     * 根据角色 ID 定位其在先攻栏中的 Token 并投递到便签板
     */
    static scheduleTokensRepresentingCharacter(charId) {
        if (!charId) return;
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        for (const row of rows) {
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                const char = Roll20Bridge.getCharacterByToken(tokenId);
                if (char && char.id === charId) {
                    this.pendingTokenIds.add(tokenId);
                }
            }
        }

        if (!this.isFlushingScheduled && this.pendingTokenIds.size > 0) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 纯同步：全量扫描先攻列表并就地调和徽章（具备签名机制，未变动的行 0 破坏、0 DOM 重绘）
     */
    static syncPatchAllBadges(options = {}) {
        this.injectStyles();
        this.hookAttributePersistence();
        this.hookVueTurnTracker();

        // 现代 Jumpgate 优先匹配 #vm-turn-order 与 .turn-tracker，兼顾旧版 #initiativewindow
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        if (!rows || rows.length === 0) return;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                this.refreshRowBadgeSync(row, tokenId, options);
            }
        }
    }

    /**
     * 刷新整个先攻条上的徽章（兼容旧版外部调用）
     */
    static async refreshAllBadges(options = {}) {
        this.syncPatchAllBadges(options);
    }

    /**
     * 纯同步：定向精准刷新单个 Token 徽章（仅修改变动的那一个，零触碰其余行）
     */
    static refreshSingleTokenBadgeSync(tokenId, options = {}) {
        if (!tokenId) return;
        const selector = `#vm-turn-order li.token[data-tokenid="${tokenId}"], .turn-tracker li.token[data-tokenid="${tokenId}"], #initiativewindow li.token[data-tokenid="${tokenId}"]`;
        const row = document.querySelector(selector);
        if (row) {
            this.refreshRowBadgeSync(row, tokenId, { force: true, ...options });
        }
    }


    /**
     * 纯同步：刷新单行徽章（签名守卫：未发生内容变动时跳过，保留原生节点不破坏）
     * 统一双行布局：Debuff 在人物头像/名称/先攻上面一行，正面 Buff 在下面一行
     */
    static refreshRowBadgeSync(row, tokenId, options = {}) {
        if (!row || !tokenId) return;

        // 清理任何残留的旧 + 号按钮
        row.querySelectorAll(".r20-add-buff-btn").forEach(el => el.remove());

        // 1. 初始化或提取独立的 Debuff 容器 (order: -1，置于头像名称上一行)
        const existingDebuffContainers = Array.from(row.querySelectorAll(".r20-debuff-container"));
        let debuffContainer = existingDebuffContainers.length > 0 ? existingDebuffContainers[0] : null;
        if (existingDebuffContainers.length > 1) {
            for (let i = 1; i < existingDebuffContainers.length; i++) existingDebuffContainers[i].remove();
        }
        if (!debuffContainer) {
            debuffContainer = document.createElement("div");
            debuffContainer.className = "r20-debuff-container";
            row.insertBefore(debuffContainer, row.firstChild);
        }

        // 2. 初始化或提取独立的正面 Buff 容器 (order: 99，置于头像名称下一行)
        const existingBuffContainers = Array.from(row.querySelectorAll(".r20-buff-container"));
        let buffContainer = existingBuffContainers.length > 0 ? existingBuffContainers[0] : null;
        if (existingBuffContainers.length > 1) {
            for (let i = 1; i < existingBuffContainers.length; i++) existingBuffContainers[i].remove();
        }
        if (!buffContainer) {
            buffContainer = document.createElement("div");
            buffContainer.className = "r20-buff-container";
            row.appendChild(buffContainer);
        }

        // 3. 权限拦截脱敏守卫：如果当前用户不是 GM 且无权查看该 Token 的 Buff（非自己控制且非可见队友），直接隐藏且清空，严防偷看
        if (!Roll20Bridge.canViewTokenBuffs(tokenId)) {
            debuffContainer.innerHTML = "";
            debuffContainer.style.display = "none";
            buffContainer.innerHTML = "";
            buffContainer.dataset.signature = "unauthorized";
            buffContainer.style.display = "none";
            return;
        }

        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const targetMode = Roll20Bridge.resolveBuffTargetMode(token);
        const character = targetMode.mode === "char" ? targetMode.char : null;

        let activeBuffs = [];
        let activeDebuffs = [];

        if (targetMode.mode === "char" && targetMode.char) {
            activeBuffs = this.getActiveBuffsSync(targetMode.char);
            activeDebuffs = this.getActiveDebuffsSync(targetMode.char);
        } else if (token) {
            activeBuffs = TokenBuffManager.getTokenBuffs(token).map(b => ({
                name: b.name,
                rounds: b.rounds,
                rowId: b.rowId || null,
                isTokenOnly: true
            }));
            activeDebuffs = TokenBuffManager.getTokenDebuffs(token)
                .filter(d => !!d.enabled)
                .map(d => ({
                    name: d.name,
                    key: d.key,
                    rounds: d.rounds,
                    rowId: d.rowId || d.key,
                    isTokenOnly: true
                }));
        }

        const isAbbr = !!SuiteConfigStore.getSetting("turnorder_buff_abbr", false);

        // 计算当前签名（合并 Debuff 与 Buff 状态）
        const buffSig = activeBuffs.map(b => `${b.name}:${b.rounds}`).join("|");
        const debuffSig = activeDebuffs.map(d => `${d.name}:${d.rounds}`).join("|");
        const signature = `abbr:${isAbbr}|B:${buffSig}|D:${debuffSig}`;

        // 若未强制刷新且签名未变，直接返回，保持原生 DOM 零重绘！
        if (!options.force && buffContainer.dataset.signature === signature) {
            return;
        }

        buffContainer.dataset.signature = signature;
        debuffContainer.innerHTML = "";
        buffContainer.innerHTML = "";

        // 4. 渲染上面的 Debuff 徽章行
        if (activeDebuffs.length === 0) {
            debuffContainer.style.display = "none";
        } else {
            debuffContainer.style.display = "flex";
            for (let i = 0; i < activeDebuffs.length; i++) {
                const debuff = activeDebuffs[i];
                const pill = document.createElement("span");
                const displayName = isAbbr ? (debuff.name ? debuff.name.charAt(0) : "减") : debuff.name;
                const showRounds = debuff.rounds !== null && debuff.rounds <= 100;

                pill.className = "r20-buff-pill-debuff";
                pill.title = `${debuff.name} (负面状态${showRounds ? ' 剩余' + debuff.rounds + '轮' : ' 常驻'})，点击修改轮数，右键关停解除`;
                pill.innerHTML = `
                    <span class="r20-pill-name">${escapeHtml(displayName)}</span>
                    ${showRounds ? `<span class="r20-pill-round" title="点击就地快速修改轮数">${escapeHtml(debuff.rounds)}</span>` : ""}
                `;

                // 就地快速编辑轮数（无弹窗）
                const roundSpan = pill.querySelector(".r20-pill-round");
                const startInlineEdit = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    Roll20Bridge.attachInlineRoundEditor(roundSpan || pill.querySelector(".r20-pill-name"), {
                        initialValue: showRounds ? debuff.rounds : "",
                        placeholder: "轮数",
                        className: "r20-input-round-inline-pill",
                        container: pill,
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, character);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }

                            try {
                                if (character) {
                                    const condKey = `${debuff.key}_rounds`;
                                    let attr = Roll20Bridge.findAttr(character, condKey);
                                    if (newRounds !== null) {
                                        if (attr) {
                                            attr.save({ current: newRounds });
                                        } else {
                                            character.attribs.create({ name: condKey, current: newRounds, max: "" });
                                        }
                                    } else {
                                        if (attr) attr.destroy();
                                    }
                                } else if (token) {
                                    const list = TokenBuffManager.getTokenDebuffs(token);
                                    const target = list.find(b => (b.key || b.name) === debuff.key);
                                    if (target) {
                                        target.rounds = newRounds;
                                        TokenBuffManager.saveTokenDebuffs(token, list);
                                    }
                                }
                            } catch (err) {
                                console.error("[Pf1eBuffUI] 保存 Debuff 轮数异常:", err);
                            }
                            this.refreshRowBadgeSync(row, tokenId, { force: true });
                            await this.notifyPanelsRefresh();
                        }
                    });
                };

                roundSpan?.addEventListener("click", startInlineEdit);
                pill.querySelector(".r20-pill-name")?.addEventListener("click", startInlineEdit);

                // 右键快速关停解除
                pill.addEventListener("contextmenu", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (character) {
                            await Pf1eBuffManager.toggleCondition(character, debuff.key, false);
                        } else if (token) {
                            TokenBuffManager.toggleDebuff(token, debuff.key, false);
                        }
                    } catch (err) {
                        console.error("[Pf1eBuffUI] 关停解除 Debuff 异常:", err);
                    }
                    this.refreshRowBadgeSync(row, tokenId, { force: true });
                    await this.notifyPanelsRefresh();
                });

                debuffContainer.appendChild(pill);
            }
        }

        // 5. 渲染下面的正面 Buff 徽章行
        if (activeBuffs.length === 0) {
            buffContainer.style.display = "none";
        } else {
            buffContainer.style.display = "flex";
            for (let i = 0; i < activeBuffs.length; i++) {
                const item = activeBuffs[i];
                const pill = document.createElement("span");
                const displayName = isAbbr ? (item.name ? item.name.charAt(0) : "增") : item.name;
                const isExpiring = item.rounds !== null && item.rounds <= 1;
                const showRounds = item.rounds !== null && item.rounds <= 100;

                pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
                pill.title = `${item.name} (${showRounds ? '剩余 ' + item.rounds + ' 轮' : '常驻'})，点击修改轮数，右键关停解除`;
                pill.innerHTML = `
                    <span class="r20-pill-name">${escapeHtml(displayName)}</span>
                    ${showRounds ? `<span class="r20-pill-round" title="点击就地快速修改轮数">${escapeHtml(item.rounds)}</span>` : ""}
                `;

                // 就地快速编辑轮数（无弹窗）
                const roundSpan = pill.querySelector(".r20-pill-round");
                const startInlineEdit = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    Roll20Bridge.attachInlineRoundEditor(roundSpan || pill.querySelector(".r20-pill-name"), {
                        initialValue: showRounds ? item.rounds : "",
                        placeholder: "轮数",
                        className: "r20-input-round-inline-pill",
                        container: pill,
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, character);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }

                            try {
                                if (character && item.rowId) {
                                    await Pf1eBuffManager.setBuffRounds(character, item.rowId, newRounds);
                                } else if (token) {
                                    TokenBuffManager.applyOrRefreshBuff(token, item.name, newRounds);
                                }
                            } catch (err) {
                                console.error("[Pf1eBuffUI] 保存 Buff 轮数异常:", err);
                            }
                            this.refreshRowBadgeSync(row, tokenId, { force: true });
                            await this.notifyPanelsRefresh();
                        }
                    });
                };

                roundSpan?.addEventListener("click", startInlineEdit);
                pill.querySelector(".r20-pill-name")?.addEventListener("click", startInlineEdit);

                // 右键快速关停解除
                pill.addEventListener("contextmenu", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (character && item.rowId) {
                            await Pf1eBuffManager.toggleBuff(character, item.rowId, false);
                        } else if (character) {
                            await Pf1eBuffManager.removeBuffByName(character, item.name);
                        } else if (token) {
                            TokenBuffManager.removeBuff(token, item.name);
                        }
                    } catch (err) {
                        console.error("[Pf1eBuffUI] 关停解除 Buff 异常:", err);
                    }
                    this.refreshRowBadgeSync(row, tokenId, { force: true });
                    await this.notifyPanelsRefresh();
                });

                buffContainer.appendChild(pill);
            }
        }
    }


    /**
     * 单个 Debuff 点击快捷修改轮数/关停弹窗
     */
    static showDebuffEditModal(character, debuff, tokenId) {
        if (!character) return;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";
        const currentRoundsStr = debuff.rounds !== null ? String(debuff.rounds) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header" style="color:#f43f5e;">负面状态: ${Roll20Bridge.escapeHtml(debuff.name)}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">剩余持续轮数 (留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="${currentRoundsStr}" placeholder="轮数" />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon danger btn-delete" style="padding:6px 12px; margin-right:auto;">✕ 关停解除</button>
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        // 解除
        mask.querySelector(".btn-delete").addEventListener("click", async () => {
            try {
                const condAttr = Roll20Bridge.findAttr(character, debuff.key);
                if (condAttr) condAttr.save({ current: "0" });
                const roundsAttr = Roll20Bridge.findAttr(character, `${debuff.key}_rounds`);
                if (roundsAttr) roundsAttr.destroy();
                this.requestTokenRefresh(tokenId);
            } catch (err) {
                console.error("[Pf1eBuffUI] 解除 Debuff 异常:", err);
            } finally {
                mask.remove();
                this.notifyPanelsRefresh();
            }
        });

        // 保存轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const inputVal = mask.querySelector(".input-rounds").value.trim();
            try {
                const roundsKey = `${debuff.key}_rounds`;
                let roundsAttr = Roll20Bridge.findAttr(character, roundsKey);
                if (inputVal === "" || isNaN(Number(inputVal))) {
                    if (roundsAttr) roundsAttr.destroy();
                } else {
                    const r = Number(inputVal);
                    if (roundsAttr) {
                        roundsAttr.save({ current: r });
                    } else {
                        character.attribs?.create({ name: roundsKey, current: r, max: "" });
                    }
                }
                this.requestTokenRefresh(tokenId);
            } catch (err) {
                console.error("[Pf1eBuffUI] 更新 Debuff 轮数异常:", err);
            } finally {
                mask.remove();
                this.notifyPanelsRefresh();
            }
        });
    }

    /**
     * 安全触发状态工作台双向联动刷新
     */
    static async notifyPanelsRefresh() {
        try {
            if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel?.renderAllPanes) {
                await window.Roll20Suite.BuffFloatingPanel.renderAllPanes();
            } else if (typeof BuffFloatingPanel !== "undefined" && BuffFloatingPanel.renderAllPanes) {
                await BuffFloatingPanel.renderAllPanes();
            }
        } catch (e) {
            console.warn("[Pf1eBuffUI] 联动工作台刷新略过:", e);
        }
    }
}
