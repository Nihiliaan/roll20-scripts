import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "./Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";

/**
 * Pf1eBuffUI.js
 * 负责在先攻条注入极致紧凑的双行 Buff 徽章，同时无缝支持人物卡与纯野怪 Token
 * 配备持久化 MutationObserver 防御 Vue 响应式 DOM 重绘
 */
export class Pf1eBuffUI {
    static isStylesInjected = false;
    static isObserverStarted = false;
    static _observer = null;
    static _debounceTimer = null;

    // 便签板（微任务任务合并队列，彻底消除连环触发与并发竞态）
    static pendingTokenIds = new Set();
    static isFlushingScheduled = false;

    /**
     * 投递刷新请求到便签板（自动去重并微任务合并）
     * @param {string} tokenId 
     */
    static requestTokenRefresh(tokenId) {
        if (!tokenId) return;
        this.pendingTokenIds.add(tokenId);

        if (!this.isFlushingScheduled) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 微任务检查点：批量清空便签板并单次刷新
     */
    static async flushPendingRefreshes() {
        const tokenIds = Array.from(this.pendingTokenIds);
        this.pendingTokenIds.clear();
        this.isFlushingScheduled = false;

        for (const tid of tokenIds) {
            try {
                await this.refreshSingleTokenBadge(tid);
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
        `;
        document.head.appendChild(style);
        this.isStylesInjected = true;
    }

    /**
     * 启动持久 DOM 监听器（仅补充挂载新加入的角色节点，不干扰原生移动）
     */
    static startObserver() {
        if (this.isObserverStarted) return;
        this.injectStyles();

        // 1. 监听主窗口变动（优先发现全新加入先攻列表的单位）
        if (this._observer) this._observer.disconnect();

        this._observer = new MutationObserver((mutations) => {
            let hasNewUnmountedTokens = false;
            for (const m of mutations) {
                // 忽略自身 buff 容器引起的变动，杜绝回环震荡
                if (m.target?.closest?.(".r20-buff-container")) continue;

                if (m.type === "childList") {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.matches?.("li.token") && !node.querySelector(".r20-buff-container")) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.querySelector?.("li.token") && !node.querySelector(".r20-buff-container")) {
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
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this.refreshAllBadges();
                }, 80);
            }
        });

        // 优先监听 vm-turn-order 或 body
        const targetContainer = document.getElementById("vm-turn-order") || document.body;
        this._observer.observe(targetContainer, { childList: true, subtree: true });

        // 2. 仅在先攻窗口打开/切换时初始化，绝不重复监听 change:turnorder（交由 TurnOrderObserver 统一精准调度）
        if (window.Campaign && typeof window.Campaign.on === "function") {
            window.Campaign.on("change:initiativepage", () => {
                setTimeout(() => this.refreshAllBadges(), 100);
            });
        }

        // 3. 实时响应人物卡属性变动（即时更新负面状态与 Buff，无需走动先攻！）
        this.bindCharacterAttributeListeners();

        this.isObserverStarted = true;
        // 立即尝试一次初次刷新
        this.refreshAllBadges();
    }

    /**
     * 判定属性名是否属于 31 项白名单负面状态
     */
    static isConditionAttrName(name) {
        if (!name || !name.startsWith("condition-")) return false;
        const cleanName = name.endsWith("_rounds") ? name.replace("_rounds", "") : name;
        return cleanName in Pf1eBuffManager.CONDITION_DEFINITIONS;
    }

    /**
     * 判定属性名是否属于 Buff 核心控制字段（开关、名称、轮数）
     */
    static isBuffCoreAttrName(name) {
        if (!name || !name.startsWith("repeating_buff2_")) return false;
        return name.endsWith("_enable_toggle") || name.endsWith("_name") || name.endsWith("_rounds");
    }

    /**
     * 绑定人物卡属性变动监听，仅响应用户真人在人物卡上的手动编辑（静默过滤脚本操作）
     */
    static bindCharacterAttributeListeners() {
        if (!window.Campaign || !window.Campaign.characters) return;

        const boundChars = new Set();

        const attachToChar = (char) => {
            if (!char || boundChars.has(char.id)) return;
            boundChars.add(char.id);

            const handleAttrChange = (attrModel, val, options) => {
                // 1. 若为脚本自身的业务更新，或处于全局脚本变更锁中，彻底静音跳过
                if (options?.byScript || Pf1eBuffManager.isScriptMutating) {
                    return;
                }

                const attrName = attrModel?.get?.("name") || "";

                // 2. 超精细门禁：只允许 31 项负面状态与 Buff 核心 3 大字段通过
                const isRelevant = this.isConditionAttrName(attrName) || this.isBuffCoreAttrName(attrName);
                if (!isRelevant) return;

                // 3. 投递到便签板，由微任务统一合并刷新
                this.scheduleTokensRepresentingCharacter(char.id);
            };

            if (char.attribs) {
                char.attribs.on("change:current", handleAttrChange);
                char.attribs.on("destroy", handleAttrChange);
            }
        };

        window.Campaign.characters.forEach(attachToChar);
        window.Campaign.characters.on("add", attachToChar);
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
                    this.requestTokenRefresh(tokenId);
                }
            }
        }
    }

    /**
     * 刷新整个先攻条上的徽章（具备签名机制，未变动的行 0 破坏、0 DOM 重绘）
     */
    static async refreshAllBadges() {
        this.injectStyles();
        // 现代 Jumpgate 优先匹配 #vm-turn-order 与 .turn-tracker，兼顾旧版 #initiativewindow
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        if (!rows || rows.length === 0) return;

        for (const row of rows) {
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                await this.refreshRowBadge(row, tokenId);
            }
        }
    }

    /**
     * 定向精准刷新单个 Token 徽章（仅修改变动的那一个，零触碰其余行）
     */
    static async refreshSingleTokenBadge(tokenId) {
        if (!tokenId) return;
        const selector = `#vm-turn-order li.token[data-tokenid="${tokenId}"], .turn-tracker li.token[data-tokenid="${tokenId}"], #initiativewindow li.token[data-tokenid="${tokenId}"]`;
        const row = document.querySelector(selector);
        if (row) {
            await this.refreshRowBadge(row, tokenId, { force: true });
        }
    }

    /**
     * 刷新单行徽章（签名守卫：未发生内容变动时跳过，保留原生节点不破坏）
     * 具备严格的权限脱敏检查：非 GM 玩家且无控制权的单位，绝不渲染任何 Buff，保护隐私与战争迷雾
     */
    static async refreshRowBadge(row, tokenId, options = {}) {
        // 清理任何残留的旧 + 号按钮
        row.querySelectorAll(".r20-add-buff-btn").forEach(el => el.remove());

        // 彻底防御异步并发竞态：仅保留行内唯一一个 .r20-buff-container，清理所有多余重复容器
        const existingContainers = Array.from(row.querySelectorAll(".r20-buff-container"));
        let container = existingContainers.length > 0 ? existingContainers[0] : null;
        if (existingContainers.length > 1) {
            for (let i = 1; i < existingContainers.length; i++) {
                existingContainers[i].remove();
            }
        }

        // 同步就地初始化容器节点，杜绝异步 await 期间竞态二次创建
        if (!container) {
            container = document.createElement("div");
            container.className = "r20-buff-container";
            row.appendChild(container);
        }

        // 1. 权限拦截脱敏守卫：如果当前用户不是 GM 且无法控制该 Token，直接隐藏且清空，严防偷看
        if (!Roll20Bridge.canControlToken(tokenId)) {
            container.innerHTML = "";
            container.dataset.signature = "unauthorized";
            container.style.display = "none";
            return;
        }

        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const character = Roll20Bridge.getCharacterByToken(tokenId);

        let activeItems = [];
        const isCharacter = !!character;

        if (isCharacter) {
            // 1. 优先提取负面状态 (排在所有 Buff 之前)
            const conditions = await Pf1eBuffManager.getActiveConditions(character);
            // 2. 提取常规 Buff
            const buffs = await Pf1eBuffManager.getActiveBuffs(character);
            // 负面状态严格排在所有正面 Buff 之前
            activeItems = [...conditions, ...buffs];
        } else if (token) {
            activeItems = TokenBuffManager.getTokenBuffs(token).map(b => ({
                name: b.name,
                rounds: b.rounds,
                rowId: null,
                isTokenOnly: true
            }));
        }

        // 计算当前签名
        const signature = activeItems.map(b => `${b.isDebuff ? 'd' : 'b'}:${b.name}:${b.rounds}`).join("|");

        // 若未强制刷新且签名未变，直接返回，保持原生 DOM 零重绘！
        if (!options.force && container.dataset.signature === signature) {
            return;
        }

        container.dataset.signature = signature;
        container.innerHTML = "";

        if (activeItems.length === 0) {
            container.style.display = "none";
            return;
        }
        container.style.display = "flex";

        // 渲染徽章（负面状态排在所有正面 Buff 之前）
        for (const item of activeItems) {
            const pill = document.createElement("span");
            const isDebuff = !!item.isDebuff;

            let text = item.name;
            let title = "";

            if (isDebuff) {
                // 负面状态徽章样式
                pill.className = "r20-buff-pill-debuff";
                if (item.rounds !== null && item.rounds < 0) {
                    const elapsed = Math.abs(item.rounds);
                    text = `${item.name} +${elapsed}`;
                    title = `${item.name} (已持续 ${elapsed} 轮)，点击修改或解除`;
                } else {
                    text = item.name;
                    title = `${item.name} (常驻/战术状态)，点击修改或解除`;
                }
            } else {
                // 正面 Buff 徽章样式
                const isExpiring = item.rounds !== null && item.rounds <= 1;
                const showRounds = item.rounds !== null && item.rounds <= 100;
                text = showRounds ? `${item.name} ${item.rounds}` : item.name;
                pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
                title = `${item.name} (剩余 ${item.rounds !== null ? item.rounds + '轮' : '常驻'})，点击修改或解除`;
            }

            pill.title = title;
            pill.textContent = text;

            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                if (isDebuff) {
                    this.showConditionEditModal(character, token, item, row, tokenId);
                } else {
                    this.showBuffEditModal(character, token, item, row, tokenId);
                }
            });

            container.appendChild(pill);
        }
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

    /**
     * 单个负面状态 (Condition) 点击快捷编辑已过轮数或解除弹窗
     */
    static showConditionEditModal(character, token, cond, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentElapsedStr = (cond.rounds !== null && cond.rounds < 0) ? String(Math.abs(cond.rounds)) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header" style="color:#f43f5e;">负面状态: ${cond.name}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">已持续轮数 (正计轮，留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="${currentElapsedStr}" placeholder="如 1, 2, 3..." />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon danger btn-delete" style="padding:6px 12px; margin-right:auto;">✕ 解除状态</button>
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        // 解除负面状态
        mask.querySelector(".btn-delete").addEventListener("click", async () => {
            try {
                if (character) {
                    await Pf1eBuffManager.removeCondition(character, cond.key);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 解除 Condition 异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });

        // 保存已过轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            try {
                const val = mask.querySelector(".input-rounds").value.trim();
                const rounds = val === "" ? null : parseInt(val, 10);

                if (character) {
                    await Pf1eBuffManager.setConditionRounds(character, cond.key, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 保存 Condition 轮数异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
    }

    /**
     * 单个 Buff 点击快捷编辑/关停弹窗
     */
    static showBuffEditModal(character, token, buff, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentRoundsStr = buff.rounds !== null ? String(buff.rounds) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header">状态管理: ${buff.name}</div>
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
                if (character) {
                    if (buff.rowId) {
                        await Pf1eBuffManager.toggleBuff(character, buff.rowId, false);
                    } else {
                        await Pf1eBuffManager.removeBuffByName(character, buff.name);
                    }
                } else if (token) {
                    TokenBuffManager.removeBuff(token, buff.name);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 关停解除 Buff 异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
        });

        // 保存轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            try {
                const val = mask.querySelector(".input-rounds").value.trim();
                const rounds = val === "" ? null : parseInt(val, 10);

                if (character && buff.rowId) {
                    await Pf1eBuffManager.setBuffRounds(character, buff.rowId, rounds);
                } else if (token) {
                    TokenBuffManager.applyOrRefreshBuff(token, buff.name, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 保存 Buff 轮数异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
        });
    }

    /**
     * 单行点击快捷添加 Buff 弹窗
     */
    static showSingleAddModal(character, token, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 340px;">
                <div class="r20-dialog-header">添加状态 Buff</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-name" placeholder="例如: 加速术、祝福术..." />

                    <label style="font-size:11px; color:#b0bec5;">持续轮数 (留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="10" placeholder="轮数" />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-confirm" style="padding:6px 14px;">添加并生效</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        mask.querySelector(".btn-confirm").addEventListener("click", async () => {
            const name = mask.querySelector(".input-name").value.trim();
            if (!name) { alert("请输入 Buff 名称"); return; }

            const val = mask.querySelector(".input-rounds").value.trim();
            const rounds = val === "" ? null : parseInt(val, 10);

            try {
                if (character) {
                    await Pf1eBuffManager.applyOrRefreshBuff(character, name, rounds);
                } else if (token) {
                    TokenBuffManager.applyOrRefreshBuff(token, name, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 添加 Buff 异常:", err);
            }

            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
        });
    }
}
