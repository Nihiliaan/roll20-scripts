import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";
import { BuffFloatingPanel } from "./BuffFloatingPanel.js";

/**
 * BuffDetachedWindow.js
 * 独立的派生 Buff 调度器窗口 (Detached Secondary Window)
 * - 支持标签从主窗口拖离撕裂生成
 * - 拥有独立的选项卡栏与视口
 * - 支持 Tab 拖回主窗口合并或在多个窗口间转移
 * - 支持 Buff 跨窗口互相拖拽施加
 * - 允许自由调整尺寸与位置
 */
export class BuffDetachedWindow {
    static instances = new Map();

    /**
     * 获取所有独立窗口中当前持有的全部角色 ID（用于主面板排重：同一人物仅出现一次）
     */
    static getAllDetachedTargetIds() {
        const ids = new Set();
        for (const win of this.instances.values()) {
            for (const id of win.charIds) {
                ids.add(id);
            }
        }
        return ids;
    }

    /**
     * 通知主面板调和刷新（恢复或移除 Tab）
     */
    notifyMainPanelRefresh() {
        try {
            if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel?.renderDispatcher) {
                window.Roll20Suite.BuffFloatingPanel.renderDispatcher();
            }
        } catch (e) {}
    }

    /**
     * 在指定坐标创建一个新的独立窗口
     * @param {number} x 
     * @param {number} y 
     * @param {string} initialCharId 
     */
    static create(x, y, initialCharId) {
        if (!initialCharId) return null;
        const winId = "detached_" + Math.random().toString(36).substr(2, 8);
        const win = new BuffDetachedWindow(winId, x, y, [initialCharId]);
        this.instances.set(winId, win);
        return win;
    }

    constructor(id, x, y, charIds = []) {
        this.id = id;
        this.charIds = [...charIds];
        this.activeCharId = charIds[0] || null;
        this.selectedBuffRowIds = new Set();
        this.lastClickedRowId = null;
        this.domEl = null;
        this._renderEpoch = 0;

        this.initDOM(x, y);
        this.render();

        this._boundSettingHandler = (e) => {
            if (e.detail?.key === "buff_show_checkbox") {
                this.renderViewport();
            } else if (e.detail?.key === "party_buffs_visible") {
                this.renderTabs();
                this.renderViewport();
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingHandler);
    }

    initDOM(x, y) {
        const el = document.createElement("div");
        el.id = `r20-buff-win-${this.id}`;
        el.className = "r20-buff-panel r20-detached-window";
        el.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, x))}px`;
        el.style.top = `${Math.max(10, Math.min(window.innerHeight - 250, y))}px`;
        el.style.width = "340px";
        el.style.height = "380px";
        el.style.zIndex = "10000";

        el.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-header-left">
                    <span class="r20-panel-title">独立工作台</span>
                </div>
                <div class="r20-header-controls">
                    <button class="r20-btn-icon btn-close-win" title="关闭窗口">✕</button>
                </div>
            </div>
            <div class="r20-tab-strip">
                <div class="r20-tabs-dynamic r20-detached-tabs" style="flex:1; border-right:none;"></div>
            </div>
            <div class="r20-tab-viewport"></div>
        `;

        document.body.appendChild(el);
        this.domEl = el;

        // 窗口拖动
        const header = el.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        header.addEventListener("mousedown", (e) => {
            if (e.target.closest("button")) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = el.offsetLeft;
            startTop = el.offsetTop;

            const onMouseMove = (me) => {
                if (!isDragging) return;
                el.style.left = `${Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, startLeft + (me.clientX - startX)))}px`;
                el.style.top = `${Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, startTop + (me.clientY - startY)))}px`;
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        // 关闭窗口
        el.querySelector(".btn-close-win").addEventListener("click", () => {
            this.destroy();
        });

        // 标签栏接收 Tab 拖入
        const tabStrip = el.querySelector(".r20-detached-tabs");
        tabStrip.addEventListener("dragover", (e) => {
            const ctx = BuffFloatingPanel._draggedContext;
            if (ctx?.type === "tab") {
                e.preventDefault();
            }
        });

        tabStrip.addEventListener("drop", (e) => {
            const ctx = BuffFloatingPanel._draggedContext;
            if (ctx?.type === "tab" && ctx.id) {
                e.preventDefault();
                ctx._hasSpawned = true; // 锁定防重
                if (ctx.tabType === "pinned") {
                    BuffFloatingPanel.removePinnedChar(ctx.id);
                } else if (ctx.tabType === "detached" && ctx.winId && ctx.winId !== this.id) {
                    const sourceWin = BuffDetachedWindow.instances.get(ctx.winId);
                    if (sourceWin) sourceWin.removeTab(ctx.id);
                }
                this.addTab(ctx.id);
            }
        });

        // 视口区域一次性接收拖拽放置 Buff
        const viewport = el.querySelector(".r20-tab-viewport");
        if (viewport) {
            viewport.addEventListener("dragover", (e) => {
                if (BuffFloatingPanel._draggedContext?.type === "buff") e.preventDefault();
            });
            viewport.addEventListener("drop", async (e) => {
                if (BuffFloatingPanel._draggedContext?.type === "buff") {
                    e.preventDefault();
                    const buff = BuffFloatingPanel._draggedContext.data;
                    const sourceHostId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                    const char = this.activeCharId ? window.Campaign?.characters?.get(this.activeCharId) : null;
                    const name = char ? (char.get("name") || "未命名") : "(未知角色)";
                    if (char) {
                        await BuffFloatingPanel.applyBuffToTarget(buff, { type: "char", id: char.id, name }, sourceHostId);
                        await this.renderViewport();
                    }
                }
            });

            BuffFloatingPanel.setupViewportMarqueeSelection(viewport, this);
        }
    }

    addTab(charId) {
        if (!this.charIds.includes(charId)) {
            this.charIds.push(charId);
            this.activeCharId = charId;
            this.render();
            this.notifyMainPanelRefresh();
        }
    }

    removeTab(charId) {
        this.charIds = this.charIds.filter(id => id !== charId);
        if (this.charIds.length === 0) {
            this.destroy();
            return;
        }
        if (this.activeCharId === charId) {
            this.activeCharId = this.charIds[0];
        }
        this.render();
        this.notifyMainPanelRefresh();
    }

    destroy() {
        if (this._boundSettingHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingHandler);
            this._boundSettingHandler = null;
        }
        if (this._renderViewportDebounceTimer) {
            clearTimeout(this._renderViewportDebounceTimer);
            this._renderViewportDebounceTimer = null;
        }
        this._renderViewportPendingResolvers = [];
        if (this.domEl) {
            this.domEl.remove();
            this.domEl = null;
        }
        BuffDetachedWindow.instances.delete(this.id);
        this.notifyMainPanelRefresh();
    }

    /**
     * 销毁并回收所有活动的独立窗口（热重载与完全卸载支持）
     */
    static destroyAll() {
        for (const [id, win] of Array.from(this.instances.entries())) {
            try {
                win.destroy();
            } catch (e) {
                console.error("[BuffDetachedWindow] 销毁独立窗口异常:", id, e);
            }
        }
        this.instances.clear();
    }

    render() {
        if (!this.domEl) return;
        this.renderTabs();
        this.renderViewport();
    }

    renderTabs() {
        const tabsContainer = this.domEl.querySelector(".r20-detached-tabs");
        if (!tabsContainer) return;
        tabsContainer.innerHTML = "";

        this.charIds.forEach((charId, idx) => {
            if (!Roll20Bridge.canViewCharacterBuffs(charId)) return;
            const char = window.Campaign?.characters?.get(charId);
            const name = char ? (char.get("name") || "未命名") : "(未知角色)";
            const isActive = this.activeCharId === charId;

            const avatarUrl = BuffFloatingPanel.getAvatarUrl(char, null);
            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}`;
            tab.draggable = true;
            tab.title = `${name} (独立窗口角色)`;
            tab.innerHTML = `
                ${BuffFloatingPanel.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-close" title="移出此窗口">✕</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-close")) {
                    e.stopPropagation();
                    this.removeTab(charId);
                    return;
                }
                this.activeCharId = charId;
                this.render();
            });

            // 拖出 Tab
            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                BuffFloatingPanel._draggedContext = {
                    type: "tab",
                    tabType: "detached",
                    winId: this.id,
                    id: charId,
                    name,
                    startX: e.clientX,
                    startY: e.clientY,
                    _hasSpawned: false
                };
                e.dataTransfer.setData("text/plain", name);
                tab.style.opacity = "0.5";
            });

            tab.addEventListener("dragend", (e) => {
                tab.style.opacity = "1";
                const ctx = BuffFloatingPanel._draggedContext;
                BuffFloatingPanel._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return;

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.removeTab(ctx.id);
                        BuffFloatingPanel.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            // 悬停自动切换与接收 Buff
            BuffFloatingPanel.bindTabBuffHover(tab, { type: "char", id: charId, name });

            tabsContainer.appendChild(tab);
        });
    }

    /**
     * 渲染独立视口区
     * 具备 35ms 微任务批处理防抖：多属性连击修改时仅执行一次完整 DOM 构建与读取
     */
    renderViewport(options = {}) {
        if (!this.domEl) return Promise.resolve();
        if (options.force) {
            return this._doRenderViewport();
        }
        return new Promise((resolve) => {
            if (!this._renderViewportPendingResolvers) this._renderViewportPendingResolvers = [];
            this._renderViewportPendingResolvers.push(resolve);
            if (this._renderViewportDebounceTimer) return;
            this._renderViewportDebounceTimer = setTimeout(async () => {
                this._renderViewportDebounceTimer = null;
                const resolvers = this._renderViewportPendingResolvers;
                this._renderViewportPendingResolvers = [];
                try {
                    await this._doRenderViewport();
                } catch (err) {
                    console.error("[BuffDetachedWindow] renderViewport 执行异常:", err);
                } finally {
                    for (const r of resolvers) {
                        try { r(); } catch (e) {}
                    }
                }
            }, 35);
        });
    }

    async _doRenderViewport() {
        if (!this.domEl) return;
        const viewport = this.domEl.querySelector(".r20-tab-viewport");
        if (!viewport) return;

        const currentEpoch = ++this._renderEpoch;

        if (!this.activeCharId) {
            viewport.innerHTML = `<div class="r20-empty-view">请选择或拖入角色标签</div>`;
            return;
        }

        if (!Roll20Bridge.isGM() && !Roll20Bridge.canViewCharacterBuffs(this.activeCharId)) {
            viewport.innerHTML = `<div class="r20-empty-view">🔒 无权查看该角色的 Buff 信息</div>`;
            return;
        }

        const char = window.Campaign?.characters?.get(this.activeCharId);
        const name = char ? (char.get("name") || "未命名") : "(未知角色)";

        if (!char) {
            viewport.innerHTML = `<div class="r20-empty-view">角色未找到或已被移除</div>`;
            return;
        }

        const buffs = await Pf1eBuffManager.getAllBuffs(char);
        const debuffs = await Pf1eBuffUI.getAllDebuffs(char);

        // 事务版本守卫：若已有更新的渲染进场，本次作废
        if (currentEpoch !== this._renderEpoch) return;

        const fragment = document.createDocumentFragment();

        // 工具条
        const toolbar = document.createElement("div");
        toolbar.className = "r20-viewport-toolbar";
        toolbar.innerHTML = `
            <div class="r20-toolbar-target-name">
                <span>${Roll20Bridge.escapeHtml(name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <button class="r20-btn-icon btn-deactivate-all" title="一键取消激活该单位身上的所有 Buff" style="color:#ffb74d;">🚫 全关</button>
                <button class="r20-btn-icon btn-add-buff-to-active" title="为此角色添加新 Buff">➕ Buff</button>
            </div>
        `;

        toolbar.querySelector(".btn-deactivate-all")?.addEventListener("click", async () => {
            const activeBuffs = await Pf1eBuffManager.getActiveBuffs(char);
            for (const b of activeBuffs) {
                await Pf1eBuffManager.toggleBuff(char, b.rowId, false);
            }
            BuffFloatingPanel.showNotice(`已取消激活 [${name}] 的全部 Buff`);
            if (typeof Pf1eBuffUI !== "undefined") {
                Pf1eBuffUI.requestTokenRefresh(char.id);
            }
            await this.renderViewport();
        });

        toolbar.querySelector(".btn-add-buff-to-active")?.addEventListener("click", () => {
            BuffFloatingPanel.showBuffEditorDialog(null, char);
        });

        fragment.appendChild(toolbar);

        // 渲染专属负面状态 (Debuff / Condition) 区块
        if (debuffs.length > 0) {
            const debuffSec = document.createElement("div");
            debuffSec.className = "r20-debuff-section";
            debuffSec.innerHTML = `
                <div class="r20-debuff-header" style="display:flex; align-items:center; justify-content:space-between; margin:4px 0; padding:2px 0;">
                    <span style="font-size:11px; font-weight:bold; color:#fda4af;">负面状态 (${debuffs.length})</span>
                </div>
                <div class="r20-debuff-list" style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;"></div>
            `;
            const listEl = debuffSec.querySelector(".r20-debuff-list");
            debuffs.forEach(d => {
                const pill = document.createElement("span");
                pill.className = "r20-buff-pill-debuff";
                const roundsText = (d.rounds !== null && d.rounds !== undefined) ? ` ${d.rounds}轮` : "";
                pill.textContent = `${d.name}${roundsText} ✕`;
                pill.title = `${d.name} (点击修改轮数或关停解除)`;
                pill.style.cursor = "pointer";
                pill.addEventListener("click", () => {
                    Pf1eBuffUI.showDebuffEditModal(char, d, null);
                });
                listEl.appendChild(pill);
            });
            fragment.appendChild(debuffSec);
        }

        if (buffs.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "r20-empty-view";
            emptyEl.innerHTML = debuffs.length > 0
                ? `该单位当前无正面 Buff`
                : `该单位当前无任何 Buff<br>从其他标签拖拽 Buff 放置即可施加`;
            fragment.appendChild(emptyEl);
        } else {
            const showCheckbox = SuiteConfigStore.getSetting("buff_show_checkbox", false);
            buffs.forEach(b => {
                const item = document.createElement("div");
                const isEnabled = !!b.enabled;
                const isSelected = this.selectedBuffRowIds.has(b.rowId);
                item.className = `r20-buff-item ${isEnabled ? "is-active" : "is-inactive"} ${isSelected ? "is-selected" : ""}`;
                item.dataset.rowid = b.rowId;
                item.draggable = true;

                const toggleCheckboxHtml = showCheckbox
                    ? `<input type="checkbox" class="r20-buff-toggle" ${isEnabled ? "checked" : ""} title="快速启停 Buff">`
                    : "";

                const curVal = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? b.rounds : null;
                const initVal = (b.initRounds !== null && b.initRounds !== undefined && b.initRounds !== "") ? b.initRounds : null;
                const curDisplay = curVal !== null ? `${curVal}` : "永久";
                const initDisplay = initVal !== null ? `${initVal}` : "-";
                const roundsHtml = `
                    <span class="r20-buff-rounds">
                        <span class="r20-buff-round-num r20-buff-round-cur" title="点击就地修改当前轮数">${curDisplay}</span>
                        <span class="r20-buff-round-sep">/</span>
                        <span class="r20-buff-round-num r20-buff-round-init" title="点击就地修改初始轮数或公式">${initDisplay}</span>
                    </span>
                `;

                let linkBadgeHtml = "";
                if (b.linkHostId) {
                    const hostChar = window.Campaign?.characters?.get(b.linkHostId);
                    const hostAvatar = hostChar?.get("avatar") || "";
                    const hostName = hostChar?.get("name") || "未知施法者";
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge btn-unlink" title="🔗 链接自 [${escapeHtml(hostName)}]，点击解除链接转为独立副本">
                            🔗
                            ${hostAvatar ? `<img src="${escapeHtml(hostAvatar)}" class="r20-buff-host-avatar" alt="${escapeHtml(hostName)}">` : ""}
                        </span>
                    `;
                }

                item.innerHTML = `
                    <div class="r20-buff-left">
                        ${toggleCheckboxHtml}
                        <span class="r20-buff-name" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                        ${linkBadgeHtml}
                        ${roundsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="r20-btn-icon btn-edit-buff-row" title="编辑细目">✏️</button>
                    </div>
                `;

                // 快速启停复选框
                item.querySelector(".r20-buff-toggle")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.toggleBuff(char, b.rowId, e.target.checked);
                        BuffFloatingPanel.notifyBuffMutation();
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    }
                });

                // 点击当前轮数：在原本数字所在位置就地渲染输入框快速编辑
                const curEl = item.querySelector(".r20-buff-round-cur");
                curEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char) return;

                    Roll20Bridge.attachInlineRoundEditor(curEl, {
                        initialValue: curVal !== null ? curVal : "",
                        placeholder: "永久",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            let newRounds = "";
                            if (raw !== "" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, char);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }
                            await Pf1eBuffManager.setBuffRounds(char, b.rowId, newRounds);
                            BuffFloatingPanel.notifyBuffMutation();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击初始轮数：在原本数字所在位置就地渲染输入框快速编辑
                const initEl = item.querySelector(".r20-buff-round-init");
                initEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char) return;

                    Roll20Bridge.attachInlineRoundEditor(initEl, {
                        initialValue: initVal !== null ? initVal : "",
                        placeholder: "-",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            await Pf1eBuffManager.setBuffInitRounds(char, b.rowId, raw);
                            BuffFloatingPanel.notifyBuffMutation();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 解除链接（直接断开，无需二次确认）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    await Pf1eBuffManager.unlinkBuff(char, b.rowId);
                    BuffFloatingPanel.showNotice(`已断开 [${b.name}] 链接`);
                    await this.renderViewport();
                });

                // 编辑
                item.querySelector(".btn-edit-buff-row")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    BuffFloatingPanel.showBuffEditorDialog(b, char);
                });

                // 单击条目多选高亮 (支持 Shift 区间连选与 Ctrl/Cmd 追加)
                item.addEventListener("click", (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;

                    if (e.shiftKey && this.lastClickedRowId) {
                        const allItemEls = Array.from(viewport.querySelectorAll(".r20-buff-item"));
                        const lastIdx = allItemEls.findIndex(el => el.dataset.rowid === this.lastClickedRowId);
                        const currIdx = allItemEls.findIndex(el => el.dataset.rowid === b.rowId);
                        if (lastIdx !== -1 && currIdx !== -1) {
                            const start = Math.min(lastIdx, currIdx);
                            const end = Math.max(lastIdx, currIdx);
                            if (!e.ctrlKey && !e.metaKey) {
                                this.selectedBuffRowIds.clear();
                            }
                            for (let i = start; i <= end; i++) {
                                this.selectedBuffRowIds.add(allItemEls[i].dataset.rowid);
                            }
                        }
                    } else {
                        this.lastClickedRowId = b.rowId;
                        if (e.ctrlKey || e.metaKey) {
                            if (this.selectedBuffRowIds.has(b.rowId)) {
                                this.selectedBuffRowIds.delete(b.rowId);
                            } else {
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        } else {
                            if (this.selectedBuffRowIds.has(b.rowId) && this.selectedBuffRowIds.size === 1) {
                                this.selectedBuffRowIds.clear();
                            } else {
                                this.selectedBuffRowIds.clear();
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        }
                    }
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        const rId = el.dataset.rowid;
                        if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                        else el.classList.remove("is-selected");
                    });
                });

                // 双击条目快速切换激活/关停
                item.addEventListener("dblclick", async (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;
                    await Pf1eBuffManager.toggleBuff(char, b.rowId, !isEnabled);
                    BuffFloatingPanel.notifyBuffMutation();
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 右键菜单
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.selectedBuffRowIds.has(b.rowId)) {
                        if (!e.ctrlKey && !e.metaKey) {
                            this.selectedBuffRowIds.clear();
                        }
                        this.selectedBuffRowIds.add(b.rowId);
                        viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                            const rId = el.dataset.rowid;
                            if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                            else el.classList.remove("is-selected");
                        });
                    }
                    BuffFloatingPanel.showBuffContextMenu(e.clientX, e.clientY, b, char, Array.from(this.selectedBuffRowIds));
                });

                // 同一角色内部拖拽排序落点监听
                item.addEventListener("dragover", (e) => {
                    if (BuffFloatingPanel._draggedContext?.type === "buff") {
                        const sTargetId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = item.getBoundingClientRect();
                            const isTop = (e.clientY - rect.top) < (rect.height / 2);
                            if (isTop) {
                                item.classList.add("r20-drag-insert-before");
                                item.classList.remove("r20-drag-insert-after");
                            } else {
                                item.classList.add("r20-drag-insert-after");
                                item.classList.remove("r20-drag-insert-before");
                            }
                        }
                    }
                });

                item.addEventListener("dragleave", () => {
                    item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                });

                item.addEventListener("drop", async (e) => {
                    if (BuffFloatingPanel._draggedContext?.type === "buff") {
                        const sTargetId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation(); // 阻止冒泡到视口，严防自链接！
                            item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");

                            const draggedBuff = BuffFloatingPanel._draggedContext.data;
                            if (draggedBuff && draggedBuff.rowId !== b.rowId) {
                                const rect = item.getBoundingClientRect();
                                const placeBefore = (e.clientY - rect.top) < (rect.height / 2);
                                await Pf1eBuffManager.reorderBuffs(char, draggedBuff.rowId, b.rowId, placeBefore);
                                BuffFloatingPanel.showNotice(`已调整 Buff [${draggedBuff.name}] 排序`);
                                await this.renderViewport();
                            }
                        }
                    }
                });

                // 发起拖拽
                item.addEventListener("dragstart", (e) => {
                    e.stopPropagation();
                    BuffFloatingPanel._draggedContext = {
                        type: "buff",
                        sourceTarget: { type: "char", id: char.id, name },
                        data: b
                    };
                    e.dataTransfer.setData("text/plain", b.name);
                    item.style.opacity = "0.5";
                });

                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    BuffFloatingPanel._draggedContext = null;
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        el.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                    });
                });

                fragment.appendChild(item);
            });
        }

        if (currentEpoch === this._renderEpoch) {
            viewport.replaceChildren(fragment);
        }
    }
}
