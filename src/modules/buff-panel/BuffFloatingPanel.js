import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { RecalcService } from "../../core/RecalcService.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { BuffPanelStyles } from "./BuffPanelStyles.js";
import { BuffPanelTemplates } from "./BuffPanelTemplates.js";
import { BuffDetachedWindow } from "./BuffDetachedWindow.js";

/**
 * BuffFloatingPanel.js
 * 现代化单栏多标签 Buff 调度器 (Chromium-style Tabbed Dispatcher)
 * - 单一内容视口：每次只展示当前激活 Tab 单个主体的 Buff
 * - 顶部标签栏：靠左展示选中单位动态 Tab，靠右展示固定角色常驻 Tab
 * - 动态升格：左侧选区 Tab 拖向右侧即升格为固定 Tab
 * - 跨 Tab 拖拽：拖拽 Buff 悬停于任意 Tab 自动切换并施加
 * - 影子链接：🔗 标识跟随主人头像，支持右键快捷菜单与点击断开链接
 * - 尺寸缩放：支持右下角自由 resize 与尺寸位置持久化
 * - 独立派生窗口：支持 Tab 拖离当前窗口撕裂派生独立窗口，或拖回合并
 */
export class BuffFloatingPanel {
    static POS_KEY = "r20_suite_buff_panel_pos";
    static SIZE_KEY = "r20_suite_buff_panel_size";
    static PINNED_CHARS_KEY = "r20_suite_pinned_char_ids";
    static PIN_KEY = "r20_suite_buff_panel_pinned";
    static isPinned = false;

    static panelEl = null;
    static isCollapsed = false;
    static activeTarget = null; // { type: "char" | "token", id: string, name: string }
    static pinnedCharIds = [];
    static selectedBuffRowIds = new Set(); // 视口中当前多选的 Buff rowId 集合
    static lastClickedRowId = null; // 用于 Shift 区间多选的基准锚点
    static _draggedContext = null; // { type: "buff" | "tab", data: any }
    static _tabHoverTimer = null;
    static _selectionSyncTimer = null;
    static _lastSelectedIdsStr = "";
    static _savedExpandedHeight = 380;
    static _renderEpoch = 0;

    /**
     * 初始化调度器工作台
     */
    static async init() {
        if (this.panelEl && document.body.contains(this.panelEl)) return;

        // 加载持久化的固定角色 ID 列表
        try {
            const rawPinned = localStorage.getItem(this.PINNED_CHARS_KEY);
            this.pinnedCharIds = rawPinned ? JSON.parse(rawPinned) : [];
        } catch (e) {
            this.pinnedCharIds = [];
        }

        // 注入现代工作台样式
        BuffPanelStyles.inject();

        // 注入径向菜单与宿主选区钩子
        this.hookRadialMenuTemplate();

        // 创建面板 DOM
        this.createPanelDOM();

        // 恢复位置、尺寸与吸附方向
        this.restorePanelPositionAndSize();

        // 恢复窗口固定状态与更新图钉样式
        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.updatePinState();

        // 绑定悬停自动展开/收起（完整复原上一版成熟交互）
        this.initHoverCollapse();

        // 若处于未固定状态，默认收拢为折叠条
        if (!this.isPinned) {
            this.setCollapse(true);
        }

        // 监听选区变化与快捷键
        this.initSelectionListeners();

        // 监听全局标签撕裂派生独立窗口
        this.initGlobalTearOffListener();

        // 监听插件设置变更以热刷新视口与调度器
        this._boundSettingChangedHandler = (e) => {
            if (e.detail?.key === "buff_show_checkbox") {
                this.renderViewport();
            } else if (e.detail?.key === "party_buffs_visible") {
                this.renderDispatcher();
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);

        // 初次渲染
        await this.renderDispatcher();

        console.log("[BuffFloatingPanel] 现代单栏多标签 Buff 调度器初始化就绪");
    }

    /**
     * 完全销毁工作台与所有派生独立窗口（热重载与完全卸载支持）
     */
    static destroy() {
        // 1. 销毁所有派生独立窗口
        if (typeof BuffDetachedWindow !== "undefined" && typeof BuffDetachedWindow.destroyAll === "function") {
            BuffDetachedWindow.destroyAll();
        }

        // 2. 解绑全局设置监听
        if (this._boundSettingChangedHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);
            this._boundSettingChangedHandler = null;
        }

        // 3. 解绑全局拖拽撕裂监听
        if (this._boundGlobalDragOver) {
            document.removeEventListener("dragover", this._boundGlobalDragOver, true);
            this._boundGlobalDragOver = null;
        }
        if (this._boundGlobalDrop) {
            document.removeEventListener("drop", this._boundGlobalDrop, true);
            this._boundGlobalDrop = null;
        }

        // 4. 清理定时器
        if (this._selectionDebounceTimer) {
            clearTimeout(this._selectionDebounceTimer);
            this._selectionDebounceTimer = null;
        }
        if (this._tabHoverTimer) {
            clearTimeout(this._tabHoverTimer);
            this._tabHoverTimer = null;
        }
        if (this._renderViewportDebounceTimer) {
            clearTimeout(this._renderViewportDebounceTimer);
            this._renderViewportDebounceTimer = null;
        }
        this._renderViewportPendingResolvers = [];

        // 5. 移除主面板 DOM
        if (this.panelEl) {
            this.panelEl.remove();
            this.panelEl = null;
        }
        document.querySelectorAll("#r20-buff-panel").forEach(el => el.remove());

        console.log("[BuffFloatingPanel] 调度器工作台与事件已成功卸载");
    }

    /**
     * 宿主选中 Token 时的回调入口（通知选区检测器立即同步）
     */
    static onTokenSelectedFromHost(tokenModel) {
        if (!tokenModel) return;
        this.checkSelectionChanged();
    }

    /**
     * 挂载径向菜单模板钩子（实现 Jumpgate 原生选区零延迟感知）
     */
    static hookRadialMenuTemplate() {
        const tmplEl = document.querySelector("#tmpl_radial_menu_token");
        if (tmplEl && !tmplEl.innerHTML.includes("_r20SuiteRadialHook")) {
            const hookCode = `<$ if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel) { window.Roll20Suite.BuffFloatingPanel.onTokenSelectedFromHost(this); } /* _r20SuiteRadialHook */ $>\n`;
            tmplEl.innerHTML = hookCode + tmplEl.innerHTML;
        }
    }

    /**
     * 创建工作台基础 DOM
     */
    static createPanelDOM() {
        document.querySelectorAll("#r20-buff-panel").forEach(el => el.remove());
        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";
        panel.className = "r20-buff-panel";
        panel.innerHTML = BuffPanelTemplates.getPanelHtml();
        document.body.appendChild(panel);
        this.panelEl = panel;

        // 拖拽窗口标题栏移动
        const header = panel.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;

        header.addEventListener("mousedown", (e) => {
            if (e.target.closest("button")) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = panel.offsetLeft;
            startTop = panel.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                panel.style.left = `${Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, startLeft + dx))}px`;
                panel.style.top = `${Math.max(10, Math.min(window.innerHeight - panel.offsetHeight - 10, startTop + dy))}px`;
                panel.style.right = "auto";
                panel.style.bottom = "auto";
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
                this.savePositionAndSize();
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        // 监听尺寸自由缩放并记忆
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if (!this.isCollapsed) {
                    this.savePositionAndSize();
                }
            });
            ro.observe(panel);
        }

        // 标题栏操作：固定窗口、批量重新计算选中单位
        panel.querySelector(".btn-toggle-pin")?.addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-recalc-all")?.addEventListener("click", async () => {
            await this.recalculateAllSelected();
        });

        // 标题栏操作：折叠与关闭
        panel.querySelector(".btn-toggle-collapse")?.addEventListener("click", () => this.toggleCollapse());
        panel.querySelector(".btn-close-panel")?.addEventListener("click", () => {
            panel.style.display = "none";
        });

        // 钉选新角色按钮
        panel.querySelector(".btn-add-pinned-char")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showAddPinnedCharMenu(e.currentTarget);
        });

        // 右侧固定区域监听动态 Tab 拖入（升格）或独立窗口 Tab 拖回合并
        const pinnedContainer = panel.querySelector(".r20-tabs-pinned");
        pinnedContainer.addEventListener("dragover", (e) => {
            if (this._draggedContext?.type === "tab" && (this._draggedContext.tabType === "dynamic" || this._draggedContext.tabType === "detached")) {
                e.preventDefault();
                pinnedContainer.classList.add("r20-pin-zone-hover");
            }
        });
        pinnedContainer.addEventListener("dragleave", (e) => {
            if (!pinnedContainer.contains(e.relatedTarget)) {
                pinnedContainer.classList.remove("r20-pin-zone-hover");
            }
        });
        pinnedContainer.addEventListener("drop", async (e) => {
            pinnedContainer.classList.remove("r20-pin-zone-hover");
            if (this._draggedContext?.type === "tab" && (this._draggedContext.tabType === "dynamic" || this._draggedContext.tabType === "detached")) {
                e.preventDefault();
                const ctx = this._draggedContext;
                ctx._hasSpawned = true; // 锁定防止误触发窗口撕裂
                const charId = ctx.id;
                if (charId && !this.pinnedCharIds.includes(charId)) {
                    this.pinnedCharIds.push(charId);
                    this.savePinnedChars();
                    if (ctx.tabType === "detached" && ctx.winId) {
                        const win = BuffDetachedWindow.instances.get(ctx.winId);
                        if (win) win.removeTab(charId);
                    }
                    this.showNotice(`已将角色钉选至常驻标签栏`);
                    await this.renderDispatcher();
                }
            }
        });

        // 视口区域一次性绑定接收从其他 Tab 拖入放置 Buff
        const viewport = panel.querySelector(".r20-tab-viewport");
        if (viewport) {
            viewport.addEventListener("dragover", (e) => {
                if (this._draggedContext?.type === "buff") {
                    e.preventDefault();
                }
            });
            viewport.addEventListener("drop", async (e) => {
                if (this._draggedContext?.type === "buff") {
                    e.preventDefault();
                    const buff = this._draggedContext.data;
                    const sourceHostId = this._draggedContext.sourceTarget?.id;
                    await this.applyBuffToTarget(buff, this.activeTarget, sourceHostId);
                }
            });

            // 视口区域绑定桌面级框选手势 (Marquee Box Selection)
            this.setupViewportMarqueeSelection(viewport, this);
        }
    }

    /**
     * 为视口挂载框选多选交互 (Marquee Box Selection)
     * 支持在视口空白处按下并拖拽出半透明发光矩形框，实时碰撞选中 Buff 条目
     * 亦支持按住 Alt 键在条目区域直接拉框
     */
    static setupViewportMarqueeSelection(viewport, targetInstance = null) {
        if (!viewport || viewport._hasMarqueeBound) return;
        viewport._hasMarqueeBound = true;

        const getTarget = () => targetInstance || BuffFloatingPanel;

        viewport.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return; // 仅限鼠标左键
            // 排除交互控件：按钮、输入框、复选框、链接徽章、就地编辑文本、工具栏等
            if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-buff-toggle, .r20-viewport-toolbar, .r20-input-round-inline")) {
                return;
            }

            const clickedItem = e.target.closest(".r20-buff-item");
            // 若点击在具体条目上且未按住 Alt 键，交由条目自身单击高亮或 HTML5 拖拽处理
            if (clickedItem && !e.altKey) {
                return;
            }

            const inst = getTarget();

            // 若点击在空白处且未按 Ctrl/Shift，立即清空先前选中条目
            if (!clickedItem && !e.ctrlKey && !e.shiftKey) {
                inst.selectedBuffRowIds.clear();
                viewport.querySelectorAll(".r20-buff-item").forEach(el => el.classList.remove("is-selected"));
            }

            e.preventDefault(); // 阻止浏览器原生文字选中
            const startX = e.clientX;
            const startY = e.clientY;

            let marquee = null;
            let hasDragged = false;
            const initialSelection = new Set((e.ctrlKey || e.shiftKey) ? inst.selectedBuffRowIds : []);

            const onMouseMove = (moveEvt) => {
                const currentX = moveEvt.clientX;
                const currentY = moveEvt.clientY;
                const dist = Math.hypot(currentX - startX, currentY - startY);
                if (!hasDragged && dist < 4) return; // 4px 移动死区防误触

                if (!hasDragged) {
                    hasDragged = true;
                    marquee = document.createElement("div");
                    marquee.className = "r20-selection-marquee";
                    document.body.appendChild(marquee);
                }

                const boxLeft = Math.min(startX, currentX);
                const boxTop = Math.min(startY, currentY);
                const boxWidth = Math.abs(currentX - startX);
                const boxHeight = Math.abs(currentY - startY);

                marquee.style.left = `${boxLeft}px`;
                marquee.style.top = `${boxTop}px`;
                marquee.style.width = `${boxWidth}px`;
                marquee.style.height = `${boxHeight}px`;

                const boxRect = {
                    left: boxLeft,
                    top: boxTop,
                    right: boxLeft + boxWidth,
                    bottom: boxTop + boxHeight
                };

                // 实时针对当前视口条目进行几何相交检测 (AABB Collision)
                viewport.querySelectorAll(".r20-buff-item").forEach(itemEl => {
                    const iRect = itemEl.getBoundingClientRect();
                    const intersects = !(
                        iRect.right < boxRect.left ||
                        iRect.left > boxRect.right ||
                        iRect.bottom < boxRect.top ||
                        iRect.top > boxRect.bottom
                    );
                    const rId = itemEl.dataset.rowid;
                    if (intersects) {
                        inst.selectedBuffRowIds.add(rId);
                        itemEl.classList.add("is-selected");
                    } else if (!initialSelection.has(rId)) {
                        inst.selectedBuffRowIds.delete(rId);
                        itemEl.classList.remove("is-selected");
                    }
                });
            };

            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                if (marquee) {
                    marquee.remove();
                    marquee = null;
                }
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        });
    }

    /**
     * 兼容接口：刷新主工作台视口以及所有活跃的独立派生窗口
     */
    static async renderAllPanes() {
        await this.renderDispatcher();
        for (const win of BuffDetachedWindow.instances.values()) {
            win.render();
        }
    }

    /**
     * 获取单位的人物头像 URL（优先使用棋子 Token 图标）
     */
    static getAvatarUrl(char, token) {
        return token?.get("imgsrc") || char?.get("avatar") || "";
    }

    /**
     * 生成 Tab 纯净 Token 图标结构（仅使用原生棋子图像，无任何文字与 fallback）
     */
    static getAvatarHtml(name, avatarUrl) {
        return `
            <div class="r20-tab-avatar-box">
                <img class="r20-tab-avatar" src="${escapeHtml(avatarUrl || '')}" alt="" />
            </div>
        `.trim();
    }

    /**
     * 从当前选区中取消选择某个 Token（直接调用 Jumpgate 官方框架 removeFromSelection）
     */
    static deselectToken(tokenModel) {
        if (!tokenModel) return;
        const tokenId = tokenModel.id || tokenModel;

        const tt = window.Campaign?.engine?.tabletop;
        if (tt && typeof tt.getSelection === "function") {
            const currentSelection = tt.getSelection() || [];
            const item = currentSelection.find(i => i.id === tokenId || i.model === tokenModel || i.model?.id === tokenId);
            if (item && typeof tt.removeFromSelection === "function") {
                try {
                    tt.removeFromSelection(item);
                } catch (e) {}
            }
        }
        if (Array.isArray(window.selected_tokens)) {
            window.selected_tokens = window.selected_tokens.filter(id => id !== tokenId);
        }
        this.checkSelectionChanged();
        this.renderDispatcher();
    }

    /**
     * 核心渲染入口：同时刷新 Tabs 与内容视口
     */
    static async renderDispatcher() {
        if (!this.panelEl) return;
        this.renderTabs();
        await this.renderViewport();
    }

    /**
     * 渲染顶部选项卡栏 (左侧动态选区 Tab + 右侧固定常驻 Tab)
     */
    static renderTabs() {
        const dynamicContainer = this.panelEl.querySelector(".r20-tabs-dynamic");
        const pinnedContainer = this.panelEl.querySelector(".r20-tabs-pinned");
        const addBtn = pinnedContainer.querySelector(".btn-add-pinned-char");
        if (!dynamicContainer || !pinnedContainer) return;

        dynamicContainer.innerHTML = "";
        // 清理除 ➕ 按钮以外的固定标签
        Array.from(pinnedContainer.querySelectorAll(".r20-tab")).forEach(el => el.remove());

        const selectedTokens = this.getSelectedTokens();
        const detachedCharIds = BuffDetachedWindow.getAllDetachedTargetIds();

        // 1. 构建左侧动态选区 Tab（严格排重：凡已钉选角色或已在独立窗口中的角色绝不在此重复出现）
        selectedTokens.forEach(t => {
            const token = t.token;
            // 权限守卫：非 GM 玩家无权查看的单位跳过渲染
            if (!Roll20Bridge.canViewTokenBuffs(token)) return;

            const targetMode = Roll20Bridge.resolveBuffTargetMode(token);
            const type = targetMode.mode; // "char" 或 "token"
            const char = targetMode.mode === "char" ? targetMode.char : null;
            const id = type === "char" ? targetMode.char.id : token.id;
            const name = token?.get("name") || t.char?.get("name") || "未命名";

            // 全系统任一实体的 Tab 始终只能有 1 个：已钉选或已在独立窗口中的角色均排除
            if (type === "char" && (this.pinnedCharIds.includes(id) || detachedCharIds.has(id))) {
                return;
            }
            if (type === "token" && detachedCharIds.has(id)) {
                return;
            }

            const isActive = this.activeTarget && this.activeTarget.id === id && this.activeTarget.type === type;
            const avatarUrl = this.getAvatarUrl(char, token);

            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}`;
            tab.title = `${name} (选区单位，可拖至右侧固定)`;
            tab.draggable = true;
            tab.innerHTML = `
                ${this.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-close" title="取消选中此单位">✕</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-close")) {
                    e.stopPropagation();
                    this.deselectToken(token);
                    return;
                }
                this.activeTarget = { type, id, name };
                this.renderDispatcher();
            });

            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                this._draggedContext = {
                    type: "tab",
                    tabType: "dynamic",
                    id,
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
                const ctx = this._draggedContext;
                this._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return; // 单次防重锁拦截

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            this.bindTabBuffHover(tab, { type, id, name });
            dynamicContainer.appendChild(tab);
        });

        // 2. 构建右侧常驻固定角色 Tab（若在选区中则呈现选中高亮；若已在独立窗口中则排除）
        this.pinnedCharIds.forEach((charId, pIdx) => {
            if (detachedCharIds.has(charId)) return;
            // 权限守卫：非 GM 玩家无权查看该角色时，严防泄漏，跳过渲染
            if (!Roll20Bridge.canViewCharacterBuffs(charId)) return;

            const char = window.Campaign?.characters?.get(charId);
            const name = char ? (char.get("name") || "未命名") : "(未知角色)";
            const isActive = this.activeTarget && this.activeTarget.id === charId && this.activeTarget.type === "char";
            const isSelected = selectedTokens.some(st => (st.char?.id === charId) || (st.token?.id === charId));

            const avatarUrl = this.getAvatarUrl(char, null);
            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}${isSelected ? " selected-highlight" : ""}`;
            tab.title = `${name} (固定常驻角色${isSelected ? " - 画布当前已选中" : ""})`;
            tab.draggable = true;
            tab.innerHTML = `
                ${this.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-close" title="取消钉选">✕</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-close")) {
                    e.stopPropagation();
                    this.removePinnedChar(charId);
                    return;
                }
                this.activeTarget = { type: "char", id: charId, name };
                this.renderDispatcher();
            });

            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                this._draggedContext = {
                    type: "tab",
                    tabType: "pinned",
                    index: pIdx,
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
                const ctx = this._draggedContext;
                this._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return; // 单次防重锁拦截

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            tab.addEventListener("dragover", (e) => {
                if (this._draggedContext?.type === "tab" && this._draggedContext.tabType === "pinned") {
                    e.preventDefault();
                    tab.classList.add("r20-tab-drag-hover");
                }
            });

            tab.addEventListener("dragleave", () => {
                tab.classList.remove("r20-tab-drag-hover");
            });

            tab.addEventListener("drop", (e) => {
                tab.classList.remove("r20-tab-drag-hover");
                if (this._draggedContext?.type === "tab" && this._draggedContext.tabType === "pinned") {
                    e.preventDefault();
                    const fromIdx = this._draggedContext.index;
                    const toIdx = pIdx;
                    if (fromIdx !== toIdx) {
                        const [moved] = this.pinnedCharIds.splice(fromIdx, 1);
                        this.pinnedCharIds.splice(toIdx, 0, moved);
                        this.savePinnedChars();
                        this.renderDispatcher();
                    }
                }
            });

            this.bindTabBuffHover(tab, { type: "char", id: charId, name });
            pinnedContainer.insertBefore(tab, addBtn);
        });

        // 3. 自动调和与回退当前激活的 Tab 目标
        this.reconcileActiveTarget(selectedTokens);
    }

    /**
     * 为 Tab 绑定 Buff 拖拽悬停自动切换逻辑 (Hover-to-Switch)
     */
    static bindTabBuffHover(tabEl, targetInfo) {
        tabEl.addEventListener("dragover", (e) => {
            if (this._draggedContext?.type === "buff") {
                e.preventDefault();
                tabEl.classList.add("r20-tab-drag-hover");

                if (!this._tabHoverTimer && (!this.activeTarget || this.activeTarget.id !== targetInfo.id)) {
                    this._tabHoverTimer = setTimeout(async () => {
                        this.activeTarget = targetInfo;
                        await this.renderDispatcher();
                    }, 200);
                }
            }
        });

        tabEl.addEventListener("dragleave", (e) => {
            if (!tabEl.contains(e.relatedTarget)) {
                tabEl.classList.remove("r20-tab-drag-hover");
                if (this._tabHoverTimer) {
                    clearTimeout(this._tabHoverTimer);
                    this._tabHoverTimer = null;
                }
            }
        });

        tabEl.addEventListener("drop", async (e) => {
            tabEl.classList.remove("r20-tab-drag-hover");
            if (this._tabHoverTimer) {
                clearTimeout(this._tabHoverTimer);
                this._tabHoverTimer = null;
            }

            if (this._draggedContext?.type === "buff") {
                e.preventDefault();
                const buff = this._draggedContext.data;
                const sourceHostId = this._draggedContext.sourceTarget?.id;
                await this.applyBuffToTarget(buff, targetInfo, sourceHostId);
            }
        });
    }

    /**
     * 自动调和与回退当前激活的目标（遵循动态选区与常驻角色全局唯一规则）
     */
    static reconcileActiveTarget(selectedTokens) {
        const availableTargets = [];
        const detachedCharIds = BuffDetachedWindow.getAllDetachedTargetIds();

        // 1. 动态选区目标（已钉选或已在独立窗口中的角色不在动态栏中重复出现）
        selectedTokens.forEach(t => {
            const char = t.char;
            const token = t.token;
            if (char && (this.pinnedCharIds.includes(char.id) || detachedCharIds.has(char.id))) return;
            if (detachedCharIds.has(token.id)) return;
            const id = char ? char.id : token.id;
            const type = char ? "char" : "token";
            const name = token?.get("name") || char?.get("name") || "未命名";
            availableTargets.push({ type, id, name });
        });

        // 2. 常驻固定角色目标（已在独立窗口中的角色排除）
        this.pinnedCharIds.forEach(id => {
            if (detachedCharIds.has(id)) return;
            // 权限守卫：非 GM 玩家跳过无权查看的目标
            if (!Roll20Bridge.canViewCharacterBuffs(id)) return;
            const char = window.Campaign?.characters?.get(id);
            if (char) {
                availableTargets.push({ type: "char", id, name: char.get("name") || "未命名" });
            }
        });

        // 维持当前激活目标（若仍在可用列表中）
        if (this.activeTarget && availableTargets.some(t => t.id === this.activeTarget.id && t.type === this.activeTarget.type)) {
            return;
        }

        // 否则回退至第一个可用目标
        if (availableTargets.length > 0) {
            this.activeTarget = availableTargets[0];
        } else {
            this.activeTarget = null;
        }
    }

    static _renderViewportDebounceTimer = null;
    static _renderViewportPendingResolvers = [];

    /**
     * 渲染单栏视口区 (展示当前活跃目标的唯一 Buff 列表)
     * 具备微任务批处理防抖：多属性连击修改时仅执行一次完整 DOM 构建与读取
     */
    static renderViewport(options = {}) {
        if (options.force) {
            return this._doRenderViewport();
        }
        return new Promise((resolve) => {
            this._renderViewportPendingResolvers.push(resolve);
            if (this._renderViewportDebounceTimer) return;
            this._renderViewportDebounceTimer = setTimeout(async () => {
                this._renderViewportDebounceTimer = null;
                const resolvers = this._renderViewportPendingResolvers;
                this._renderViewportPendingResolvers = [];
                try {
                    await this._doRenderViewport();
                } catch (err) {
                    console.error("[BuffFloatingPanel] renderViewport 执行异常:", err);
                } finally {
                    for (const r of resolvers) {
                        try { r(); } catch (e) {}
                    }
                }
            }, 35);
        });
    }

    static async _doRenderViewport() {
        const viewport = this.panelEl?.querySelector(".r20-tab-viewport");
        if (!viewport) return;

        const currentEpoch = ++this._renderEpoch;

        if (!this.activeTarget) {
            viewport.innerHTML = `
                <div class="r20-empty-view">
                    🕹️ 画布未选中任何单位<br>
                    在地图点击棋子展示 Buff，或点击右上角 ➕ 钉选常驻角色
                </div>
            `;
            return;
        }

        const { type, id, name } = this.activeTarget;

        // 权限脱敏拦截守卫：非 GM 玩家无权查看该目标时，严防泄漏，直接展示未授权提示
        if (!Roll20Bridge.isGM()) {
            const canView = type === "char" ? Roll20Bridge.canViewCharacterBuffs(id) : Roll20Bridge.canViewTokenBuffs(id);
            if (!canView) {
                viewport.innerHTML = `
                    <div class="r20-empty-view">
                        🔒 无权查看 [${Roll20Bridge.escapeHtml(name || "该单位")}] 的 Buff 信息
                    </div>
                `;
                return;
            }
        }

        let char = null;
        let token = null;

        if (type === "char") {
            char = window.Campaign?.characters?.get(id);
        } else {
            token = Roll20Bridge.getTokenGraphic(id);
        }

        // 读取 Buff 列表与 Debuff 列表（内存数据直接读取）
        let buffs = [];
        let debuffs = [];
        if (char) {
            buffs = await Pf1eBuffManager.getAllBuffs(char);
            debuffs = await Pf1eBuffUI.getAllDebuffs(char);
        } else if (token) {
            buffs = TokenBuffManager.getTokenBuffs(token).filter(b => !b.isDebuff);
            debuffs = TokenBuffManager.getTokenDebuffs(token).map(b => ({
                rowId: b.rowId || b.key || b.name,
                key: b.key || b.name,
                name: b.name,
                enabled: b.enabled === true,
                rounds: (b.rounds !== undefined && b.rounds !== null) ? b.rounds : null,
                initRounds: b.initialRounds || null,
                isDebuff: true,
                linkHostId: b.linkHostId || null,
                linkSourceRowId: b.linkSourceRowId || null,
                linkChildren: b.linkChildren || []
            }));
        }

        // 事务版本守卫：如果在读取等待期间已有更新的渲染事务触发，本次作废退出，绝不碰触 DOM！
        if (currentEpoch !== this._renderEpoch) {
            return;
        }

        const fragment = document.createDocumentFragment();

        // 视口顶部工具条（目标名、快速施加状态、一键全关、新建 Buff）
        const toolbar = document.createElement("div");
        toolbar.className = "r20-viewport-toolbar";
        const conditionOptionsHtml = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS.map(def => `<option value="${def.key}">${def.name}</option>`).join("");

        toolbar.innerHTML = `
            <div class="r20-toolbar-target-name">
                <span>${Roll20Bridge.escapeHtml(name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
                <select class="r20-select-quick-debuff" style="background:#1e293b; color:#fda4af; border:1px solid #475569; border-radius:3px; font-size:10px; padding:2px 2px; outline:none; cursor:pointer; width:auto; max-width:62px;" title="快速为该单位施加负面状态">
                    <option value="">Debuff</option>
                    ${conditionOptionsHtml}
                </select>
                <button class="r20-btn-icon btn-deactivate-all" title="一键取消激活该单位身上的所有 Buff 与状态" style="color:#ffb74d;">🚫 全关</button>
                <button class="r20-btn-icon btn-add-buff-to-active" title="为此角色添加新 Buff">➕ Buff</button>
            </div>
        `;

        // 快速施加状态下拉选单
        toolbar.querySelector(".r20-select-quick-debuff")?.addEventListener("change", async (e) => {
            const condKey = e.target.value;
            if (!condKey) return;
            const def = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS.find(d => d.key === condKey);
            const dName = def ? def.name : (e.target.options[e.target.selectedIndex]?.text || condKey);

            if (char) {
                // 1. 明确记录到人物卡的 tracked_debuffs 属性中
                await Pf1eBuffManager.addTrackedDebuff(char, condKey);
                // 2. 默认不开启 (enable = false), 预设 10 轮持续时间
                await Pf1eBuffManager.toggleCondition(char, condKey, false, 0);
                this.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                // 明确记录到 Token 的 tracked_debuffs (<!--r20_debuffs:...-->) 属性中
                TokenBuffManager.addTrackedDebuff(token, {
                    key: condKey,
                    name: dName,
                    rounds: 0,
                    initialRounds: 0,
                    enabled: false
                });
                this.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
            e.target.value = "";
        });

        // 一键全关当前主体身上的所有 Buff 与 Debuff
        toolbar.querySelector(".btn-deactivate-all")?.addEventListener("click", async () => {
            if (char) {
                const activeBuffs = await Pf1eBuffManager.getActiveBuffs(char);
                for (const b of activeBuffs) {
                    await Pf1eBuffManager.toggleBuff(char, b.rowId, false);
                }
                const activeDebuffs = Pf1eBuffUI.getActiveDebuffsSync(char);
                for (const d of activeDebuffs) {
                    await Pf1eBuffManager.toggleCondition(char, d.key, false);
                }
                this.showNotice(`已取消激活 [${name}] 的全部 Buff 与状态`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                TokenBuffManager.saveTokenBuffs(token, []);
                this.showNotice(`已清空 [${name}] 的全部 Buff 与状态`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        toolbar.querySelector(".btn-add-buff-to-active")?.addEventListener("click", () => {
            if (char) this.showBuffEditorDialog(null, char);
        });

        fragment.appendChild(toolbar);

        // 提前单次读取启停复选框设置，规避条目遍历内高频重复访问 localStorage 与 JSON.parse
        const showCheckbox = SuiteConfigStore.getSetting("buff_show_checkbox", false);

        // 渲染专属负面状态 (Debuff / Condition) 区块 - 全面作为一等公民卡片
        if (debuffs.length > 0) {
            const debuffSec = document.createElement("div");
            debuffSec.className = "r20-debuff-section";
            debuffSec.innerHTML = `
                <div class="r20-debuff-header" style="display:flex; align-items:center; justify-content:space-between; margin:6px 0 4px 0; padding:2px 4px; border-bottom:1px solid rgba(244,63,94,0.25);">
                    <span style="font-size:11px; font-weight:bold; color:#fda4af;">负面状态 Debuffs (${debuffs.length})</span>
                    <span style="font-size:10px; color:#94a3b8;">支持右键、拖拽与影子链接</span>
                </div>
                <div class="r20-debuff-list" style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px;"></div>
            `;
            const listEl = debuffSec.querySelector(".r20-debuff-list");
            debuffs.forEach(d => {
                const item = document.createElement("div");
                const isEnabled = !!d.enabled;
                const isSelected = this.selectedBuffRowIds.has(d.rowId);
                item.className = `r20-buff-item is-debuff ${isEnabled ? "is-active" : "is-inactive"} ${isSelected ? "is-selected" : ""}`;
                item.dataset.rowid = d.rowId;
                item.dataset.isdebuff = "true";
                item.draggable = true;

                const toggleCheckboxHtml = showCheckbox
                    ? `<input type="checkbox" class="r20-buff-toggle" ${isEnabled ? "checked" : ""} title="快速启停负面状态">`
                    : "";

                const curVal = (d.rounds !== null && d.rounds !== undefined && d.rounds !== "") ? d.rounds : null;
                const curDisplay = curVal !== null ? `${curVal}轮` : "常驻";
                const roundsHtml = `
                    <span class="r20-buff-rounds">
                        <span class="r20-buff-round-num r20-buff-round-cur" style="color:#fda4af;" title="点击就地修改持续轮数">${curDisplay}</span>
                    </span>
                `;

                // 影子链接徽章渲染（🔗 + 施法者头像或下游计数）
                let linkBadgeHtml = "";
                if (d.linkHostId) {
                    const hostChar = window.Campaign?.characters?.get(d.linkHostId);
                    const hostAvatar = hostChar?.get("avatar") || "";
                    const hostName = hostChar?.get("name") || "未知施法者";
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge btn-unlink" title="🔗 链接自 [${escapeHtml(hostName)}]，点击解除链接转为独立副本">
                            🔗
                            ${hostAvatar ? `<img src="${escapeHtml(hostAvatar)}" class="r20-buff-host-avatar" alt="${escapeHtml(hostName)}">` : ""}
                        </span>
                    `;
                } else if (Array.isArray(d.linkChildren) && d.linkChildren.length > 0) {
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge" style="color:#f43f5e;" title="🔗 名下维持着 ${d.linkChildren.length} 个受术者的 Debuff 链接">
                            🔗 (${d.linkChildren.length})
                        </span>
                    `;
                }

                item.innerHTML = `
                    <div class="r20-buff-left">
                        ${toggleCheckboxHtml}
                        <span class="r20-buff-name" style="color:#f43f5e; font-weight:600;" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                        ${linkBadgeHtml}
                        ${roundsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="r20-btn-icon btn-remove-debuff" title="解除此负面状态" style="color:#f43f5e;">✕</button>
                    </div>
                `;

                // 绑定复选框启停
                item.querySelector(".r20-buff-toggle")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.toggleCondition(char, d.key, e.target.checked);
                    } else if (token) {
                        TokenBuffManager.toggleDebuff(token, d.key, e.target.checked);
                    }
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 点击当前轮数：在原本数字所在位置就地渲染输入框快速编辑
                const curEl = item.querySelector(".r20-buff-round-cur");
                curEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char && !token) return;

                    Roll20Bridge.attachInlineRoundEditor(curEl, {
                        initialValue: curVal !== null ? curVal : "",
                        placeholder: "常驻",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
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
                            if (char) {
                                const roundsKey = `${d.key}_rounds`;
                                let roundsAttr = char.attribs.models.find(a => a.get("name") === roundsKey);
                                const roundVal = newRounds !== null ? newRounds : "";
                                if (roundsAttr) roundsAttr.save({ current: roundVal });
                                else char.attribs.create({ name: roundsKey, current: roundVal });
                            } else if (token) {
                                const list = TokenBuffManager.getTokenDebuffs(token);
                                const target = list.find(b => (b.key || b.name) === d.key);
                                if (target) {
                                    target.rounds = newRounds;
                                    TokenBuffManager.saveTokenDebuffs(token, list);
                                }
                            }
                                        await Pf1eBuffUI.refreshAllBadges();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 图标解绑（直接断开）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.unlinkBuff(char, d.rowId);
                        this.showNotice(`已断开 [${d.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    }
                });

                // 点击 ✕ 按钮彻底解除/删除
                item.querySelector(".btn-remove-debuff")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.deleteDebuffPermanently(char, d.key);
                        this.showNotice(`已彻底解除/删除 [${d.name}] 状态`);
                    } else if (token) {
                        TokenBuffManager.removeTrackedDebuff(token, d.key);
                        this.showNotice(`已彻底解除/删除 [${d.name}] 状态`);
                    }
                        await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 单击条目多选高亮
                item.addEventListener("click", (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;
                    this.lastClickedRowId = d.rowId;
                    if (e.ctrlKey || e.metaKey) {
                        if (this.selectedBuffRowIds.has(d.rowId)) this.selectedBuffRowIds.delete(d.rowId);
                        else this.selectedBuffRowIds.add(d.rowId);
                    } else {
                        if (this.selectedBuffRowIds.has(d.rowId) && this.selectedBuffRowIds.size === 1) {
                            this.selectedBuffRowIds.clear();
                        } else {
                            this.selectedBuffRowIds.clear();
                            this.selectedBuffRowIds.add(d.rowId);
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
                    if (e.target.closest("button, .btn-unlink, .r20-input-round-inline")) return;
                    if (char) {
                        await Pf1eBuffManager.toggleCondition(char, d.key, !isEnabled);
                    } else if (token) {
                        TokenBuffManager.toggleDebuff(token, d.key, !isEnabled);
                    }
                        await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 拖拽发起 (Dragstart)
                item.addEventListener("dragstart", (e) => {
                    this._draggedContext = {
                        type: "buff",
                        data: d,
                        sourceTarget: this.activeTarget
                    };
                    e.dataTransfer.setData("text/plain", d.name);
                    item.style.opacity = "0.5";
                });
                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    this._draggedContext = null;
                });

                // 右键上下文菜单
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.selectedBuffRowIds.has(d.rowId)) {
                        if (!e.ctrlKey && !e.metaKey) this.selectedBuffRowIds.clear();
                        this.selectedBuffRowIds.add(d.rowId);
                        viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                            const rId = el.dataset.rowid;
                            if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                            else el.classList.remove("is-selected");
                        });
                    }
                    this.showBuffContextMenu(e.clientX, e.clientY, d, char, Array.from(this.selectedBuffRowIds));
                });

                listEl.appendChild(item);
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

                // 影子链接徽章渲染（🔗 + 主人头像 或 🔗 下游计数）
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
                } else if (Array.isArray(b.linkChildren) && b.linkChildren.length > 0) {
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge" style="color:#60a5fa;" title="🔗 名下维持着 ${b.linkChildren.length} 个受术者的子链接 Buff">
                            🔗 (${b.linkChildren.length})
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
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    } else if (token) {
                        TokenBuffManager.toggleBuff(token, b.name, e.target.checked);
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
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 图标解绑（直接断开，无需二次确认）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.unlinkBuff(char, b.rowId);
                        this.showNotice(`已断开 [${b.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    }
                });

                // 编辑细目
                item.querySelector(".btn-edit-buff-row")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.showBuffEditorDialog(b, char);
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
                    // 即时局部更新 DOM 高亮样式，零闪烁
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        const rId = el.dataset.rowid;
                        if (this.selectedBuffRowIds.has(rId)) {
                            el.classList.add("is-selected");
                        } else {
                            el.classList.remove("is-selected");
                        }
                    });
                });

                // 双击条目快速切换激活/关停
                item.addEventListener("dblclick", async (e) => {
                    if (e.target.closest("button, .btn-unlink, .r20-buff-toggle, input, select, textarea")) return;
                    if (char) {
                        await Pf1eBuffManager.toggleBuff(char, b.rowId, !isEnabled);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    } else if (token) {
                        TokenBuffManager.toggleBuff(token, b.name, !isEnabled);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    }
                });

                // 右键上下文菜单
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
                    this.showBuffContextMenu(e.clientX, e.clientY, b, char, Array.from(this.selectedBuffRowIds));
                });

                // 同一角色内部拖拽排序落点监听
                item.addEventListener("dragover", (e) => {
                    if (this._draggedContext?.type === "buff") {
                        const sTargetId = this._draggedContext.sourceTarget?.id;
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
                    if (this._draggedContext?.type === "buff") {
                        const sTargetId = this._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation(); // 阻止冒泡到视口，彻底杜绝创建自链接！
                            item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");

                            const draggedBuff = this._draggedContext.data;
                            if (draggedBuff && draggedBuff.rowId !== b.rowId) {
                                const rect = item.getBoundingClientRect();
                                const placeBefore = (e.clientY - rect.top) < (rect.height / 2);
                                await Pf1eBuffManager.reorderBuffs(char, draggedBuff.rowId, b.rowId, placeBefore);
                                this.showNotice(`已调整 Buff [${draggedBuff.name}] 排序`);
                                await this.renderViewport();
                            }
                        }
                    }
                });

                // Buff 发起拖拽
                item.addEventListener("dragstart", (e) => {
                    e.stopPropagation();
                    this._draggedContext = {
                        type: "buff",
                        sourceTarget: this.activeTarget,
                        data: b
                    };
                    e.dataTransfer.setData("text/plain", b.name);
                    item.style.opacity = "0.5";
                });

                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    this._draggedContext = null;
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        el.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                    });
                });

                fragment.appendChild(item);
            });
        }

        // 最终原子级一次性替换视口内容，彻底杜绝先清空后追加的竞态与视觉闪烁
        if (currentEpoch === this._renderEpoch) {
            viewport.replaceChildren(fragment);
        }
    }

    /**
     * 弹出 Buff 右键快捷菜单 (多选激活/多选关停/全选中同名关停/编辑/施加/同步)
     */
    static showBuffContextMenu(x, y, buff, char, selectedRowIds = []) {
        document.querySelector(".r20-buff-context-menu")?.remove();

        const menu = document.createElement("div");
        menu.className = "r20-context-menu r20-buff-context-menu";
        menu.style.left = `${Math.min(window.innerWidth - 220, x)}px`;
        menu.style.top = `${Math.min(window.innerHeight - 340, y)}px`;

        const isGM = Roll20Bridge.isGM();
        const isDebuff = !!buff.isDebuff || (typeof buff.rowId === "string" && buff.rowId.startsWith("condition-"));
        const isLinkedChild = !!(buff.linkHostId && buff.linkSourceRowId);
        const hasDownstream = Array.isArray(buff.linkChildren) && buff.linkChildren.length > 0;
        const selIds = (selectedRowIds && selectedRowIds.length > 0) ? selectedRowIds : [buff.rowId];
        const countLabel = selIds.length > 1 ? ` (${selIds.length})` : "";
        const delIds = (selIds.length > 1 && selIds.includes(buff.rowId)) ? selIds : [buff.rowId];
        const delCountLabel = delIds.length > 1 ? ` (${delIds.length})` : "";

        // 统一接入宿主免疫级失焦与外部交互原语 (Host-Immune Dismissal)
        const cleanupDismiss = Roll20Bridge.watchDismissal(menu, () => {
            menu.remove();
        });

        const cleanup = () => {
            cleanupDismiss();
            menu.remove();
        };

        menu.innerHTML = `
            <div class="r20-context-menu-item btn-ctx-activate-selected" style="color:#60a5fa;">
                <span>⚡</span><span>激活选中${isDebuff ? "状态" : "Buff"}${countLabel}</span>
            </div>
            <div class="r20-context-menu-item btn-ctx-deactivate-selected" style="color:#94a3b8;">
                <span>⛔</span><span>关停选中${isDebuff ? "状态" : "Buff"}${countLabel}</span>
            </div>
            ${isGM ? `
            <div class="r20-context-menu-item btn-ctx-deactivate-all-homonym" style="color:#f87171;">
                <span>🛑</span><span>关停所有选中单位同名${isDebuff ? "状态" : "Buff"} [${Roll20Bridge.escapeHtml(buff.name)}]</span>
            </div>` : ""}
            <div class="r20-context-menu-divider"></div>
            ${!isLinkedChild ? `
            <div class="r20-context-menu-item btn-ctx-link-selected"><span>🔗</span><span>施加给所有选中单位 (创建链接)</span></div>` : ""}
            <div class="r20-context-menu-item btn-ctx-apply-selected"><span>✨</span><span>施加给所有选中单位 (普通副本)</span></div>
            <div class="r20-context-menu-divider"></div>
            ${!isDebuff ? `
            <div class="r20-context-menu-item btn-ctx-edit"><span>✏️</span><span>编辑细目</span></div>
            <div class="r20-context-menu-item btn-ctx-clone"><span>📋</span><span>复制为独立副本</span></div>` : ""}
            ${isLinkedChild ? `
            ${!isDebuff ? `<div class="r20-context-menu-item btn-ctx-sync-host" style="color:#64b5f6;"><span>🔄</span><span>从宿主同步最新细目</span></div>` : ""}
            <div class="r20-context-menu-item btn-ctx-unlink" style="color:#f59e0b;"><span>🔗</span><span>断开链接转为独立副本</span></div>` : ""}
            ${!isLinkedChild && hasDownstream ? `
            <div class="r20-context-menu-item btn-ctx-deactivate-downstream" style="color:#fb7185;"><span>🛑</span><span>关停当前及所有下游${isDebuff ? "状态" : "Buff"} (${buff.linkChildren.length})</span></div>
            ${!isDebuff ? `<div class="r20-context-menu-item btn-ctx-sync-downstream" style="color:#81c784;"><span>🔄</span><span>同步更新所有下游链接副本 (${buff.linkChildren.length})</span></div>` : ""}` : ""}
            <div class="r20-context-menu-divider"></div>
            <div class="r20-context-menu-item btn-ctx-delete" style="color:#ef5350;"><span>🗑️</span><span>彻底解除/删除${delCountLabel}</span></div>
        `;

        // 激活选中Buff / Debuff
        menu.querySelector(".btn-ctx-activate-selected").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of selIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.toggleCondition(char, rId, true);
                    } else {
                        await Pf1eBuffManager.toggleBuff(char, rId, true);
                    }
                }
                this.showNotice(`已激活 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        // 关停选中Buff / Debuff
        menu.querySelector(".btn-ctx-deactivate-selected").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of selIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.toggleCondition(char, rId, false);
                    } else {
                        await Pf1eBuffManager.toggleBuff(char, rId, false);
                    }
                }
                this.showNotice(`已关停 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        // 关停所有选中单位同名Buff / Debuff (仅 GM 独占操作)
        menu.querySelector(".btn-ctx-deactivate-all-homonym")?.addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            let count = 0;
            const targetBuffName = buff.name.trim().toLowerCase();
            for (const t of selected) {
                let affected = false;
                if (t.char) {
                    if (isDebuff) {
                        const def = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS.find(d => d.name.trim().toLowerCase() === targetBuffName || d.key === buff.rowId);
                        if (def) {
                            await Pf1eBuffManager.toggleCondition(t.char, def.key, false);
                            count++;
                            affected = true;
                        }
                    } else {
                        const allB = await Pf1eBuffManager.getAllBuffs(t.char);
                        for (const cb of allB) {
                            if (cb.name.trim().toLowerCase() === targetBuffName && cb.enabled) {
                                await Pf1eBuffManager.toggleBuff(t.char, cb.rowId, false);
                                count++;
                                affected = true;
                            }
                        }
                    }
                    if (affected && typeof Pf1eBuffUI !== "undefined") {
                        Pf1eBuffUI.requestTokenRefresh(t.char.id);
                    }
                } else if (t.token) {
                    TokenBuffManager.removeBuff(t.token, buff.name);
                    count++;
                    if (typeof Pf1eBuffUI !== "undefined") {
                        Pf1eBuffUI.requestTokenRefresh(t.token.id);
                    }
                }
            }
            this.showNotice(`已关停 ${count} 个选中单位的 [${buff.name}]`);
            await this.renderAllPanes();
        });

        // 施加给选中单位 (创建链接) - 若为 Debuff 则默认排除施法者自身！
        menu.querySelector(".btn-ctx-link-selected")?.addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            let count = 0;
            let selfActivated = false;
            for (const t of selected) {
                if (!t.char) continue;
                if (t.char.id === char.id) {
                    if (isDebuff) {
                        // 负面状态施加给选中目标时，默认排除施法者自身！
                        continue;
                    }
                    // 正面 Buff：当前角色也是选中单位，激活自身该 Buff！
                    if (!buff.enabled) {
                        await Pf1eBuffManager.toggleBuff(char, buff.rowId, true);
                        buff.enabled = true;
                        selfActivated = true;
                    }
                } else {
                    await this.applyBuffToTarget(buff, { type: "char", id: t.char.id, name: t.char.get("name") }, char.id);
                    count++;
                }
            }
            if (selfActivated && typeof Pf1eBuffUI !== "undefined") {
                Pf1eBuffUI.requestTokenRefresh(char.id);
            }
            const msg = selfActivated 
                ? `已激活自身 Buff，并为 ${count} 个其他选中单位施加链接 Buff`
                : `已为 ${count} 个选中单位施加链接 ${isDebuff ? "负面状态" : "Buff"}`;
            this.showNotice(msg);
            await this.renderViewport();
        });

        // 施加给选中单位 (普通副本) - 若为 Debuff 则默认排除施法者自身！
        menu.querySelector(".btn-ctx-apply-selected").addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            let count = 0;
            let selfActivated = false;
            for (const t of selected) {
                if (!t.char) continue;
                if (t.char.id === char.id) {
                    if (isDebuff) {
                        // 负面状态施加给选中目标时，默认排除施法者自身！
                        continue;
                    }
                    // 正面 Buff：当前角色也是选中单位，激活自身该 Buff！
                    if (!buff.enabled) {
                        await Pf1eBuffManager.toggleBuff(char, buff.rowId, true);
                        buff.enabled = true;
                        selfActivated = true;
                    }
                } else {
                    await this.applyBuffToTarget(buff, { type: "char", id: t.char.id, name: t.char.get("name") }, null);
                    count++;
                }
            }
            if (selfActivated && typeof Pf1eBuffUI !== "undefined") {
                Pf1eBuffUI.requestTokenRefresh(char.id);
            }
            const msg = selfActivated 
                ? `已激活自身 Buff，并为 ${count} 个其他选中单位施加普通 Buff 副本`
                : `已为 ${count} 个选中单位施加普通 ${isDebuff ? "负面状态" : "Buff"} 副本`;
            this.showNotice(msg);
            await this.renderViewport();
        });

        // 编辑
        menu.querySelector(".btn-ctx-edit")?.addEventListener("click", () => {
            cleanup();
            this.showBuffEditorDialog(buff, char);
        });

        // 复制为独立副本
        menu.querySelector(".btn-ctx-clone")?.addEventListener("click", async () => {
            cleanup();
            if (char) {
                const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(buff.extraAttrs);
                const cloneName = await this.generateUniqueCloneName(char, buff.name);
                await Pf1eBuffManager.addBuff(char, cloneName, buff.rounds, cleanAttrs, buff.initRounds);
                this.showNotice(`已复制独立副本 [${cloneName}]`);
                await this.renderViewport();
            }
        });

        // 从宿主同步最新细目 (保持自身当前轮数与开关状态独立)
        menu.querySelector(".btn-ctx-sync-host")?.addEventListener("click", async () => {
            cleanup();
            if (!char || !buff.linkHostId) return;
            const hostChar = window.Campaign?.characters?.get(buff.linkHostId);
            if (!hostChar) {
                this.showNotice("未找到对应的施法者宿主角色");
                return;
            }
            const ok = await Pf1eBuffManager.syncBuffToDownstream(hostChar, buff.linkSourceRowId, char, buff.rowId);
            if (ok) {
                this.showNotice(`已从 [${hostChar.get("name")}] 同步最新细目 (保持自身轮数与开关)`);
                await this.renderViewport();
            } else {
                this.showNotice("宿主角色卡上未找到对应的源 Buff");
            }
        });

        // 断开链接转为独立副本
        menu.querySelector(".btn-ctx-unlink")?.addEventListener("click", async () => {
            cleanup();
            if (char && buff.rowId) {
                await Pf1eBuffManager.unlinkBuff(char, buff.rowId);
                this.showNotice(`已断开 [${buff.name}] 链接，转为独立副本`);
                await this.renderViewport();
            }
        });

        // 关停当前及所有下游Buff / Debuff
        menu.querySelector(".btn-ctx-deactivate-downstream")?.addEventListener("click", async () => {
            cleanup();
            if (!char) return;
            await Pf1eBuffManager.deactivateBuffAndDownstream(char, buff.rowId);
            this.showNotice(`已关停当前及所有下游链接副本 (${buff.linkChildren.length})`);
            await this.renderAllPanes();
        });

        // 同步更新所有下游链接副本
        menu.querySelector(".btn-ctx-sync-downstream")?.addEventListener("click", async () => {
            cleanup();
            if (!char) return;
            const count = await Pf1eBuffManager.broadcastDownstreamSync(char, buff.rowId);
            this.showNotice(`已将最新细目同步至 ${count} 个下游链接副本`);
            await this.renderViewport();
        });

        // 彻底删除 / 解除（支持多选批量删除）
        menu.querySelector(".btn-ctx-delete").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of delIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.deleteDebuffPermanently(char, rId);
                    } else {
                        await Pf1eBuffManager.deleteBuffRowPermanently(char, rId);
                    }
                    this.selectedBuffRowIds.delete(rId);
                }
                this.showNotice(`已彻底解除/删除 ${delIds.length} 项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        document.body.appendChild(menu);
    }

    /**
     * 将 Buff / Debuff 施加至目标（支持传入 sourceHostId 自动打上影子链接）
     * 根本约束：施法者严禁向自身创建链接/副本
     */
    static async applyBuffToTarget(buff, target, sourceHostId = null) {
        if (!buff || !target || (sourceHostId && target.id === sourceHostId)) return;
        console.log(`[BuffFloatingPanel] [DEBUG_APPLY] 目标: [${target.name}] (type: ${target.type}, id: ${target.id}), Buff: [${buff.name}], sourceHostId: [${sourceHostId}]`);
        const targetChar = target.type === "char" ? window.Campaign?.characters?.get(target.id) : null;
        const targetToken = target.type === "token" ? Roll20Bridge.getTokenGraphic(target.id) : null;

        const isDebuff = !!buff.isDebuff || (typeof buff.rowId === "string" && buff.rowId.startsWith("condition-"));

        if (isDebuff) {
            const condKey = buff.key || buff.rowId;
            if (targetChar) {
                await Pf1eBuffManager.applyOrRefreshDebuff(targetChar, condKey, buff.rounds, sourceHostId, buff.rowId);
                this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} 负面状态 [${buff.name}]`);
                if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                await this.renderViewport();
            } else if (targetToken) {
                const list = TokenBuffManager.getTokenBuffs(targetToken);
                list.push({ name: buff.name, rounds: buff.rounds, initialRounds: null, isDebuff: true });
                TokenBuffManager.saveTokenBuffs(targetToken, list);
                this.showNotice(`已为 [${target.name}] 施加负面状态 [${buff.name}]`);
                if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetToken.id);
                await this.renderViewport();
            }
            return;
        }

        let extraAttrs = { ...(buff.extraAttrs || {}) };
        if (sourceHostId) {
            // 链接 Buff：设置宿主信息，并清除原有的 link_children（防止下游继承老大的小弟）
            delete extraAttrs.link_children;
            extraAttrs.link_host_id = sourceHostId;
            if (buff.rowId) extraAttrs.link_source_row_id = buff.rowId;
        } else {
            // 普通副本：彻底净化所有影子链接元属性，确保下游副本 100% 独立！
            extraAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs) || {};
        }

        if (targetChar) {
            const res = await Pf1eBuffManager.applyOrRefreshBuff(
                targetChar,
                buff.name,
                buff.rounds,
                extraAttrs,
                buff.initRounds
            );
            if (sourceHostId && buff.rowId && res && res.rowId) {
                const hostChar = window.Campaign?.characters?.get(sourceHostId);
                if (hostChar) {
                    await Pf1eBuffManager.recordDownstreamLink(hostChar, buff.rowId, targetChar.id, res.rowId);
                }
            }
            this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} Buff [${buff.name}]`);
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
            await this.renderViewport();
        } else if (targetToken) {
            const list = TokenBuffManager.getTokenBuffs(targetToken);
            list.push({ name: buff.name, rounds: buff.rounds, initialRounds: buff.initRounds });
            TokenBuffManager.saveTokenBuffs(targetToken, list);
            this.showNotice(`已为 [${target.name}] 施加 Buff [${buff.name}]`);
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetToken.id);
            await this.renderViewport();
        }
    }

    /**
     * 手动批量重新计算所有当前选中的单位加值
     */
    static async recalculateAllSelected() {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) {
            if (this.activeTarget?.type === "char") {
                const char = window.Campaign?.characters?.get(this.activeTarget.id);
                if (char) {
                    await RecalcService.flush(char, { reason: "manual_topbar_click" });
                    this.showNotice(`已强制触发 [${this.activeTarget.name}] 官方加值重算`);
                }
            } else {
                this.showNotice("未选中任何单位");
            }
            return;
        }

        for (const t of selected) {
            if (t.char) {
                await RecalcService.flush(t.char, { reason: "manual_topbar_click" });
            }
        }
        this.showNotice(`已强制触发 ${selected.length} 个选中单位的官方加值重算`);
    }

    /**
     * 为克隆的独立副本生成不冲突的专属名称
     * 提取已有 "(副本)" 或 "(副本 N)" 后缀，智能递增为唯一名称，杜绝重名冲突
     */
    static async generateUniqueCloneName(character, baseName) {
        if (!character) return `${baseName || "新Buff"} (副本)`;
        const existingBuffs = await Pf1eBuffManager.getAllBuffs(character) || [];
        const existingNames = new Set(existingBuffs.map(b => (b.name || "").trim().toLowerCase()));

        let cleanBase = (baseName || "新Buff").trim();
        // 匹配 "(副本)" 或 "(副本 2)"、"(副本 3)"
        const copyMatch = cleanBase.match(/^(.*?)\s*\(副本(?:\s*(\d+))?\)$/);
        if (copyMatch) {
            cleanBase = copyMatch[1].trim();
        }

        let candidate = `${cleanBase} (副本)`;
        if (!existingNames.has(candidate.toLowerCase())) {
            return candidate;
        }

        let index = 2;
        while (existingNames.has(`${cleanBase} (副本 ${index})`.toLowerCase())) {
            index++;
        }
        return `${cleanBase} (副本 ${index})`;
    }

    /**
     * 弹出添加固定角色菜单（带实时搜索框、滚动条与边界自适应翻转）
     */
    static showAddPinnedCharMenu(anchorBtn) {
        document.querySelector(".r20-pinned-char-picker")?.remove();

        const characters = window.Campaign?.characters?.models || [];
        const unpinned = characters.filter(c => {
            if (c.get("archived")) return false;
            if (this.pinnedCharIds.includes(c.id)) return false;
            if (!Roll20Bridge.canViewCharacterBuffs(c)) return false;
            return true;
        });

        const menu = document.createElement("div");
        menu.className = "r20-context-menu r20-pinned-char-picker";
        menu.style.width = "220px";
        menu.style.maxHeight = "320px";
        menu.style.display = "flex";
        menu.style.flexDirection = "column";
        menu.style.padding = "6px";
        menu.style.boxSizing = "border-box";
        menu.style.zIndex = "10050";

        // 智能定位：下方空间不足时向上翻转
        const rect = anchorBtn.getBoundingClientRect();
        const pickerHeight = 300;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < pickerHeight && rect.top > pickerHeight) {
            menu.style.top = `${rect.top - pickerHeight - 4}px`;
        } else {
            menu.style.top = `${rect.bottom + 4}px`;
        }
        menu.style.right = `${Math.max(10, window.innerWidth - rect.right)}px`;

        // 搜索输入框
        const searchBox = document.createElement("div");
        searchBox.style.cssText = "margin-bottom:6px; flex-shrink:0;";
        searchBox.innerHTML = `
            <input type="text" class="r20-pinned-search" placeholder="🔍 搜索角色名称..." 
                style="width:100%; box-sizing:border-box; background:#141b22; border:1px solid #37474f; color:#fff; padding:5px 8px; border-radius:4px; font-size:11px; outline:none;">
        `;
        menu.appendChild(searchBox);

        // 滚动列表容器
        const listContainer = document.createElement("div");
        listContainer.style.cssText = "flex:1 1 auto; overflow-y:auto; max-height:240px; scrollbar-width:thin;";

        if (unpinned.length === 0) {
            listContainer.innerHTML = `<div style="padding:10px; color:#78909c; font-size:11px; text-align:center;">无可用未钉选角色</div>`;
        } else {
            const itemNodes = [];
            unpinned.forEach(c => {
                const name = c.get("name") || "未命名";
                const item = document.createElement("div");
                item.className = "r20-context-menu-item";
                item.style.cssText = "padding:5px 8px; border-radius:3px; cursor:pointer;";
                item.innerHTML = `<span>🛡️</span><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</span>`;
                item.addEventListener("click", async () => {
                    menu.remove();
                    this.pinnedCharIds.push(c.id);
                    this.savePinnedChars();
                    await this.renderDispatcher();
                });
                listContainer.appendChild(item);
                itemNodes.push({ el: item, name });
            });

            // 搜索过滤
            const searchInput = searchBox.querySelector(".r20-pinned-search");
            searchInput.addEventListener("input", (e) => {
                const q = e.target.value.trim().toLowerCase();
                itemNodes.forEach(({ el, name }) => {
                    const match = !q || name.toLowerCase().includes(q);
                    el.style.display = match ? "flex" : "none";
                });
            });

            setTimeout(() => searchInput.focus(), 50);
        }

        menu.appendChild(listContainer);

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== anchorBtn) {
                menu.remove();
                document.removeEventListener("mousedown", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);

        document.body.appendChild(menu);
    }

    /**
     * 移除固定角色
     */
    static removePinnedChar(charId) {
        this.pinnedCharIds = this.pinnedCharIds.filter(id => id !== charId);
        this.savePinnedChars();
        this.renderDispatcher();
    }

    /**
     * 保存固定角色 ID 列表
     */
    static savePinnedChars() {
        try {
            localStorage.setItem(this.PINNED_CHARS_KEY, JSON.stringify(this.pinnedCharIds));
        } catch (e) {}
    }

    /**
     * 原子级派生独立工作台窗口（单次防重锁 SSOT）
     */
    static spawnDetachedWindow(x, y, charId, ctx = null) {
        if (!charId) return null;
        if (ctx) {
            if (ctx._hasSpawned) return null;
            ctx._hasSpawned = true;
        }

        // 如果是常驻固定角色，拖离成为独立窗口后从固定栏中移出
        if (this.pinnedCharIds.includes(charId)) {
            this.removePinnedChar(charId);
        }

        const win = BuffDetachedWindow.create(x, y, charId);
        this.showNotice("已创建独立工作台窗口");
        this.renderDispatcher();
        return win;
    }

    /**
     * 全局标签撕裂监听：在窗口外部释放 Tab 时派生独立二级窗口（捕获阶段优先拦截）
     */
    static initGlobalTearOffListener() {
        if (this._boundGlobalDragOver) {
            document.removeEventListener("dragover", this._boundGlobalDragOver, true);
        }
        if (this._boundGlobalDrop) {
            document.removeEventListener("drop", this._boundGlobalDrop, true);
        }

        this._boundGlobalDragOver = (e) => {
            if (this._draggedContext?.type === "tab") {
                e.preventDefault();
            }
        };

        this._boundGlobalDrop = (e) => {
            if (this._draggedContext?.type === "tab") {
                if (e.target.closest(".r20-buff-panel")) return;

                e.preventDefault();
                const tabCtx = this._draggedContext;
                const charId = tabCtx.id;
                if (!charId) return;

                if (tabCtx.tabType === "detached" && tabCtx.winId) {
                    const win = BuffDetachedWindow.instances.get(tabCtx.winId);
                    if (win) win.removeTab(charId);
                }

                this.spawnDetachedWindow(e.clientX, e.clientY, charId, tabCtx);
            }
        };

        document.addEventListener("dragover", this._boundGlobalDragOver, true);
        document.addEventListener("drop", this._boundGlobalDrop, true);
    }

    /**
     * 选区变动检测入口（轻量比对 ID 序列）
     */
    static checkSelectionChanged() {
        const tokens = this.getSelectedTokens();
        const idsStr = tokens.map(t => t.token?.id || t.char?.id || t.name).sort().join(",");
        if (idsStr !== this._lastSelectedIdsStr) {
            this._lastSelectedIdsStr = idsStr;
            this.onSelectionChanged(tokens);
        }
    }

    /**
     * 处理选区实质变动（仅调和更新标签与视口数据，严禁随意干预窗口折叠收起状态）
     */
    static onSelectionChanged(selectedTokens) {
        this.renderDispatcher();
    }

    /**
     * 监听画布选区变动（直击 Roll20 Jumpgate Tabletop 选区原型原子方法）
     */
    static initSelectionListeners() {
        const check = () => this.checkSelectionChanged();

        // 1. 深度对齐 Jumpgate Tabletop 原型选区三剑客（原子操作拦截，零轮询、零鼠标事件）
        const hookTabletopProto = () => {
            const tt = window.Campaign?.engine?.tabletop;
            if (!tt) return false;
            const proto = Object.getPrototypeOf(tt);
            if (!proto || proto._r20SuiteSelectionHooked) return true;

            const notifyDebounced = () => {
                if (this._selectionDebounceTimer) clearTimeout(this._selectionDebounceTimer);
                this._selectionDebounceTimer = setTimeout(check, 25);
            };

            const origAdd = proto.addToSelection;
            if (typeof origAdd === "function") {
                proto.addToSelection = function(...args) {
                    const res = origAdd.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            const origRemove = proto.removeFromSelection;
            if (typeof origRemove === "function") {
                proto.removeFromSelection = function(...args) {
                    const res = origRemove.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            const origClear = proto.clearSelection;
            if (typeof origClear === "function") {
                proto.clearSelection = function(...args) {
                    const res = origClear.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            proto._r20SuiteSelectionHooked = true;
            return true;
        };

        if (!hookTabletopProto()) {
            const retryInterval = setInterval(() => {
                if (hookTabletopProto()) clearInterval(retryInterval);
            }, 500);
        }

        // 2. 先攻条 Token 点击联动
        document.addEventListener("click", (e) => {
            const tokenRow = e.target.closest("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
            if (tokenRow && tokenRow.dataset.tokenid) {
                setTimeout(check, 60);
            }
        });
    }

    /**
     * 提取当前画布选中的所有 Token 与角色模型（通过 Jumpgate 原生 getSelection 与权限鉴权）
     */
    static getSelectedTokens() {
        const result = [];
        const seen = new Set();
        const tt = window.Campaign?.engine?.tabletop;

        // 1. 优先调用 Jumpgate 原生选区 API
        if (tt && typeof tt.getSelection === "function") {
            const selection = tt.getSelection() || [];
            for (const item of selection) {
                const tokenId = item.id;
                if (!tokenId || seen.has(tokenId)) continue;
                seen.add(tokenId);

                const tokenModel = item.model || Roll20Bridge.getTokenGraphic(tokenId);
                if (tokenModel) {
                    if (!Roll20Bridge.canViewTokenBuffs(tokenModel)) continue;
                    const charId = tokenModel.get("represents");
                    const char = charId ? window.Campaign?.characters?.get(charId) : null;
                    result.push({ token: tokenModel, char, name: tokenModel.get("name") || char?.get("name") || "Token" });
                }
            }
        }

        // 2. 兼顾 Fallback 回退通道（兼容传统画布或未就绪环境）
        if (result.length === 0) {
            const page = Roll20Bridge.getCurrentPage() || window.curPage;
            const selectedIds = window.selected_tokens || [];
            if (page && page.thegraphics && Array.isArray(selectedIds)) {
                for (const id of selectedIds) {
                    if (seen.has(id)) continue;
                    const token = page.thegraphics.get(id);
                    if (!token) continue;
                    if (!Roll20Bridge.canViewTokenBuffs(token)) continue;
                    seen.add(id);
                    const charId = token.get("represents");
                    const char = charId ? window.Campaign?.characters?.get(charId) : null;
                    result.push({ token, char, name: token.get("name") || char?.get("name") || "Token" });
                }
            }
        }

        return result;
    }

    /**
     * 明确展开/折叠面板状态（规范高度状态机，避免遗留巨大空白黑框）
     */
    static setCollapse(collapsed) {
        if (!this.panelEl) return;
        this.isCollapsed = !!collapsed;
        const drawer = this.panelEl.querySelector(".r20-panel-content-drawer");
        const btn = this.panelEl.querySelector(".btn-toggle-collapse");

        if (this.isCollapsed) {
            // 折叠：记忆当前真实高度，将容器收拢为 auto，禁用 resize
            if (this.panelEl.offsetHeight > 50) {
                this._savedExpandedHeight = this.panelEl.offsetHeight;
            }
            if (drawer) drawer.style.display = "none";
            if (btn) btn.textContent = "▸";
            this.panelEl.style.height = "auto";
            this.panelEl.style.minHeight = "0px";
            this.panelEl.style.resize = "none";
        } else {
            // 展开：恢复记忆高度，启用 resize
            if (drawer) drawer.style.display = "flex";
            if (btn) btn.textContent = "▾";
            this.panelEl.style.height = `${this._savedExpandedHeight || 380}px`;
            this.panelEl.style.minHeight = "200px";
            this.panelEl.style.resize = "both";
        }
    }

    /**
     * 切换展开/折叠面板
     */
    static toggleCollapse() {
        this.setCollapse(!this.isCollapsed);
    }

    /**
     * 窗口固定状态切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        this.updatePinState();
        if (this.isPinned) {
            this.setCollapse(false);
            this.showNotice("已固定面板（鼠标移开不自动收起）");
        } else {
            this.showNotice("已取消固定（鼠标移开后自动收起）");
        }
    }

    /**
     * 更新标题栏图钉按钮样式与提示
     */
    static updatePinState() {
        const pinBtn = this.panelEl?.querySelector(".btn-toggle-pin");
        if (pinBtn) {
            pinBtn.classList.toggle("pinned", this.isPinned);
            pinBtn.title = this.isPinned ? "已固定（鼠标移开不自动收起）" : "未固定（鼠标移开后自动收起）";
        }
    }

    /**
     * 悬浮吸附收起与展开（完整继承上一版成熟的鼠标悬停交互）
     */
    static initHoverCollapse() {
        let hoverTimer = null;
        this.panelEl.addEventListener("mouseenter", () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapse(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (!this.isPinned && !this.isCollapsed) {
                hoverTimer = setTimeout(() => {
                    if (!this.isPinned) this.setCollapse(true);
                }, 400);
            }
        });
    }

    /**
     * 恢复面板位置与尺寸
     */
    static restorePanelPositionAndSize() {
        if (!this.panelEl) return;
        try {
            const savedPos = localStorage.getItem(this.POS_KEY);
            if (savedPos) {
                const { left, top } = JSON.parse(savedPos);
                this.panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, left))}px`;
                this.panelEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 200, top))}px`;
                this.panelEl.style.right = "auto";
                this.panelEl.style.bottom = "auto";
            } else {
                this.panelEl.style.top = "60px";
                this.panelEl.style.right = "80px";
                this.panelEl.style.left = "auto";
            }

            const savedSize = localStorage.getItem(this.SIZE_KEY);
            if (savedSize) {
                const { width, height } = JSON.parse(savedSize);
                this.panelEl.style.width = `${Math.max(280, Math.min(window.innerWidth - 20, width))}px`;
                this.panelEl.style.height = `${Math.max(200, Math.min(window.innerHeight - 20, height))}px`;
            }
        } catch (e) {}
    }

    /**
     * 保存面板位置与尺寸
     */
    static savePositionAndSize() {
        if (!this.panelEl) return;
        try {
            localStorage.setItem(this.POS_KEY, JSON.stringify({
                left: this.panelEl.offsetLeft,
                top: this.panelEl.offsetTop
            }));
            localStorage.setItem(this.SIZE_KEY, JSON.stringify({
                width: this.panelEl.offsetWidth,
                height: this.panelEl.offsetHeight
            }));
        } catch (e) {}
    }

    /**
     * 悬浮提示 Toast
     */
    static showNotice(msg) {
        let toast = document.querySelector(".r20-suite-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "r20-suite-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        setTimeout(() => {
            toast.style.opacity = "0";
        }, 2200);
    }

    /**
     * 调出 Buff 编辑细目弹窗 (完整继承 e3a4247 原版：支持名称、初始轮数/公式、当前轮数与 JSON 加值细目字典)
     */
    static showBuffEditorDialog(existingNode = null, charTarget = null) {
        document.querySelector(".r20-dialog-mask")?.remove();
        document.querySelector(".r20-buff-editor-dialog")?.remove();

        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? (existingNode.name || "") : "";
        const currentRounds = isEditing && existingNode.rounds !== null && existingNode.rounds !== undefined ? existingNode.rounds : "";
        const currentInitRounds = isEditing && existingNode.initRounds ? existingNode.initRounds : "";
        const currentJson = isEditing
            ? JSON.stringify(existingNode.extraAttrs || {}, null, 2)
            : `{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        const targetName = charTarget ? (charTarget.get("name") || "未命名角色") : "";
        const headerTitle = isEditing
            ? (charTarget ? `编辑单位 Buff 细目: ${escapeHtml(targetName)}` : "编辑 Buff 模板细目")
            : (charTarget ? `为 [${escapeHtml(targetName)}] 新建 Buff` : "新建 Buff");

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${headerTitle}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-buff-name" value="${escapeHtml(currentName)}" placeholder="例如: 神恩、加速术..." />

                    <label style="font-size:11px; color:#b0bec5;">预置初始轮数 / 公式 (每次开启自动求值):</label>
                    <input type="text" class="r20-input-text input-buff-init-rounds" value="${escapeHtml(currentInitRounds)}" placeholder="例如: 10、@{level}*10、10+@{constitution_mod}" />
                    <span style="font-size:10px; color:#78909c;">支持常数或 @{attr} 属性引用公式，开启时借用 Roll20 原生引擎自动求值。</span>

                    <label style="font-size:11px; color:#b0bec5;">当前剩余轮数 (留空视为永久):</label>
                    <input type="number" class="r20-input-text input-buff-rounds" value="${escapeHtml(currentRounds)}" placeholder="留空或大于100视为永久" />

                    <label style="font-size:11px; color:#b0bec5;">PF1e 细目加值字典 (JSON 格式):</label>
                    <textarea class="r20-textarea-json input-buff-json">${escapeHtml(currentJson)}</textarea>
                    <span style="font-size:10px; color:#78909c;">提示: 可配置 b1_bonus, b1_bonustype, b1_val, b1_macro-text 等原生字段。</span>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px; background:#37474f;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) {
                alert("请输入 Buff 名称");
                return;
            }

            const initRoundsVal = mask.querySelector(".input-buff-init-rounds").value.trim();
            const initRounds = initRoundsVal === "" ? null : initRoundsVal;

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try {
                    extraAttrs = JSON.parse(jsonText);
                } catch (err) {
                    alert("JSON 细目格式错误:\n" + err.message);
                    return;
                }
            }

            mask.remove();

            if (charTarget) {
                if (isEditing) {
                    const rowId = existingNode.rowId || existingNode.id;
                    await Pf1eBuffManager.updateBuffRow(charTarget, rowId, name, rounds, extraAttrs, initRounds);
                    const syncCount = await Pf1eBuffManager.broadcastDownstreamSync(charTarget, rowId);
                    if (syncCount > 0) {
                        this.showNotice(`✅ 已更新 [${name}] 细目，并自动同步至 ${syncCount} 个下游链接`);
                    } else {
                        this.showNotice(`✅ 已更新 [${name}] 细目`);
                    }
                } else {
                    const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs);
                    await Pf1eBuffManager.addBuff(charTarget, name, rounds, cleanAttrs, initRounds);
                    this.showNotice(`✅ 已新增 Buff [${name}]`);
                }
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });
    }
}
