import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { RecalcService } from "../../core/RecalcService.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";
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
    static _debounceRecalcTimer = null; // 「延迟重新计算」防抖定时器 (SuiteSettingsPanel 的 debounce_recalc 设置)

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

        // 固定状态直接展开套用几何，未固定状态收拢为折叠条（两种状态都走统一入口）
        this.setCollapse(!this.isPinned);

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

        // 图片加载失败统一降级（捕获阶段监听：error 不冒泡；CSP 禁止内联 onerror，必须用 addEventListener）
        document.addEventListener("error", (e) => {
            const t = e.target;
            if (!t || !t.classList) return;
            if (t.classList.contains("r20-tab-avatar")) {
                t.style.display = "none";
                const fb = t.nextElementSibling;
                if (fb && fb.classList.contains("r20-tab-avatar-fallback")) fb.style.display = "flex";
            } else if (t.classList.contains("r20-buff-host-avatar")) {
                t.style.display = "none";
            }
        }, true);

        // 拖拽窗口标题栏移动
        const header = panel.querySelector(".r20-panel-header");
        // 标题栏拖拽：面板本体实时跟手（指针捕获），松手后判向落位
        header.style.touchAction = "none";
        let headerDragState = null;
        DragGestures.bind(header, {
            isIgnored: (e) => !!e.target.closest("button"),
            onStart: (e, start) => {
                this._headerDragging = true;
                headerDragState = {
                    grabDX: start.x - panel.offsetLeft,
                    grabDY: start.y - header.getBoundingClientRect().top
                };
            },
            onMove: (e) => {
                if (!headerDragState) return;
                const headerH = header.offsetHeight || 30;
                // 标题栏锚定钳制：锚点值（向下=top，向上=bottom）保证标题栏完整留在窗口内
                const headerTop = Math.max(10, Math.min(window.innerHeight - headerH - 10, e.clientY - headerDragState.grabDY));
                panel.style.left = `${Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, e.clientX - headerDragState.grabDX))}px`;
                panel.style.right = "auto";
                if (this.isDirectionUp) {
                    panel.style.top = "auto";
                    panel.style.bottom = `${Math.max(10, window.innerHeight - headerTop - headerH)}px`;
                } else {
                    panel.style.bottom = "auto";
                    panel.style.top = `${headerTop}px`;
                }
            },
            onEnd: () => {
                this._headerDragging = false;
                headerDragState = null;
                this.placePanel(header.getBoundingClientRect().top);
                this.savePositionAndSize();
            }
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

        // 统一缩放手柄：面板是唯一尺寸载体，直接改面板宽高；
        // 手柄贴面板外侧角（向下=右下，向上=右上），方向类只翻转位置与光标形状
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "r20-resize-handle";
        resizeHandle.title = "拖拽调整窗口大小";
        resizeHandle.style.touchAction = "none";
        let resizeState = null;
        DragGestures.bind(resizeHandle, {
            onStart: (e, start) => {
                resizeState = { startW: panel.offsetWidth, startH: panel.offsetHeight };
            },
            onMove: (e, start) => {
                if (!resizeState) return;
                const nextW = Math.max(280, Math.min(window.innerWidth - 20, resizeState.startW + (e.clientX - start.x)));
                // 向下展开面板向下生长 (+dy)，向上展开底边锚定向上生长 (-dy)
                const dir = this.isDirectionUp ? -1 : 1;
                const nextH = Math.max(200, Math.min(window.innerHeight - 40, resizeState.startH + dir * (e.clientY - start.y)));
                panel.style.width = `${nextW}px`;
                panel.style.height = `${nextH}px`;
            },
            onEnd: () => {
                resizeState = null;
                this.savePositionAndSize();
            }
        });
        panel.appendChild(resizeHandle);

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

        // 标签栏滚轮水平横向滚动支持（直接用鼠标滚轮在棋子栏滑动查看溢出棋子）
        const setupHorizontalScroll = (el) => {
            if (!el) return;
            el.addEventListener("wheel", (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        };
        setupHorizontalScroll(panel.querySelector(".r20-tabs-dynamic"));
        setupHorizontalScroll(panel.querySelector(".r20-tabs-pinned"));

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

                if (ctx.tabType === "dynamic") {
                    // 与 📌 按钮共用同一准入与钉选实现：无人物卡的纯 Token 拒绝并提示，
                    // 有人物卡的棋子（ctx.id 为人物卡 id）或 represents 角色的 Token 正常钉选
                    const pinnedId = this.pinTargetToken(
                        ctx.token || Roll20Bridge.getTokenGraphic(ctx.id),
                        { type: ctx.targetType || "token", id: ctx.id, name: ctx.name, char: ctx.char || null }
                    );
                    if (!pinnedId) return;
                    return;
                }

                // 独立窗口 Tab 拖回常驻栏合并（ctx.id 恒为人物卡 id）
                const charId = ctx.id;
                if (charId && !this.pinnedCharIds.includes(charId)) {
                    this.pinnedCharIds.push(charId);
                    this.savePinnedChars();
                    if (ctx.winId) {
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
     * 获取单位的有效头像 URL（直击 Jumpgate WebGL 渲染器与 Character 原生资产管道）
     */
    static getAvatarUrl(char, token) {
        // 1. 若显式传入棋子（如左侧动态选区棋子），优先取 Jumpgate WebGL 渲染器实际成功加载的真实地址
        if (token) {
            const tabletop = window.Campaign?.engine?.tabletop;
            const ttObj = tabletop?.tabletopObjects?.get(token.id || token);
            const rendererUrl = ttObj?.imageRenderer?.loadedUrl || ttObj?.imageRenderer?.url;
            if (rendererUrl) return rendererUrl;
        }

        // 2. 若为常驻固定角色（char 实体），优先调用 Roll20 官方原生立绘管道 char.getAvatar()
        if (char) {
            const avatar = typeof char.getAvatar === "function" ? char.getAvatar() : "";
            if (avatar) return avatar;

            // 若无专属立绘，回退至官方原生默认棋子图标 char.getTokenURL()
            const defaultTokenUrl = typeof char.getTokenURL === "function" ? char.getTokenURL() : "";
            if (defaultTokenUrl) return defaultTokenUrl;
        }

        // 3. 兜底回退：若当前地图完全无实体或方法不可用，回退至数据模型原始字段并清洗
        let raw = token?.get?.("imgsrc") || char?.get?.("avatar") || "";
        if (raw) {
            raw = raw.replace(/^https?:\/\/s3\.amazonaws\.com\/files\.d20\.io\//, "https://files.d20.io/");
            if (raw.startsWith("//")) raw = "https:" + raw;
        }
        return raw;
    }

    /**
     * 生成 Tab 纯净 Token 图标结构（带失败优雅降级首字 fallback）
     * 注意：不使用内联 onerror（Roll20 CSP 禁止内联事件处理器），加载失败降级由
     * createPanelDOM 里 document 捕获阶段的 error 监听器统一处理
     */
    static getAvatarHtml(name, avatarUrl) {
        const initial = (name || "?").trim().charAt(0).toUpperCase();
        return `
            <div class="r20-tab-avatar-box">
                ${avatarUrl ? `<img class="r20-tab-avatar" src="${escapeHtml(avatarUrl)}" alt="" />` : ""}
                <div class="r20-tab-avatar-fallback" style="${avatarUrl ? 'display:none;' : 'display:flex;'}">${escapeHtml(initial)}</div>
            </div>
        `.trim();
    }

    /**
     * 生成「链接自施法者」影子链接徽章（🔗 + 施法者头像，头像加载失败自动隐藏）
     * 单一实现供主面板 Buff 行 / Debuff 行与独立二级窗口共用，修改徽章样式只改这里
     */
    static getLinkBadgeHtml(hostChar) {
        const hostAvatar = hostChar?.getAvatar ? hostChar.getAvatar() : (hostChar?.get("avatar") || "");
        const hostName = hostChar?.get("name") || "未知施法者";
        return `
            <span class="r20-buff-link-badge btn-unlink" title="🔗 链接自 [${escapeHtml(hostName)}]，点击解除链接转为独立副本">
                🔗
                ${hostAvatar ? `<img src="${escapeHtml(hostAvatar)}" class="r20-buff-host-avatar" alt="${escapeHtml(hostName)}">` : ""}
            </span>
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
        if (!dynamicContainer || !pinnedContainer) return;

        dynamicContainer.innerHTML = "";
        pinnedContainer.innerHTML = "";

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
            tab.title = `${name} (选区单位，点击右上角 📌 钉选)`;
            tab.draggable = true;
            tab.innerHTML = `
                ${this.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-pin" title="钉选此角色到常驻栏">📌</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-pin")) {
                    e.stopPropagation();
                    this.pinTargetToken(token, { type, id, name, char });
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
                    targetType: type,
                    token,
                    char,
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

            const char = window.Campaign?.characters?.get(charId);
            if (!char) {
                // 自愈：钉选 ID 无法解析为人物卡（历史脏数据 / 误钉选的无卡棋子 token id），
                // 从常驻栏静默清除，避免渲染出"(未知角色)"左括号僵尸 Tab
                console.info(`[BuffFloatingPanel] 常驻栏钉选 ID [${charId}] 无法解析为人物卡，已自动清除`);
                this.pinnedCharIds = this.pinnedCharIds.filter(id => id !== charId);
                this.savePinnedChars();
                return;
            }
            // 权限守卫：非 GM 玩家无权查看该角色时，严防泄漏，跳过渲染
            if (!Roll20Bridge.canViewCharacterBuffs(charId)) return;

            const name = char.get("name") || "未命名";
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
            pinnedContainer.appendChild(tab);
        });

        // ➕ 钉选角色搜索按钮（常驻栏末尾；renderTabs 每次清空容器后需重建）
        const addPinnedBtn = document.createElement("button");
        addPinnedBtn.className = "r20-btn-icon btn-add-pinned-char";
        addPinnedBtn.title = "钉选指定角色到常驻标签栏";
        addPinnedBtn.textContent = "➕";
        addPinnedBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showAddPinnedCharMenu(addPinnedBtn);
        });
        pinnedContainer.appendChild(addPinnedBtn);

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
            // Token 数据已在 TokenBuffManager 读取时归一化（结构与人物卡一致），此处直接使用
            buffs = TokenBuffManager.getTokenBuffs(token).filter(b => !b.isDebuff);
            debuffs = TokenBuffManager.getTokenDebuffs(token).map(b => ({
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

        // 事务版本守卫：如果在读取等待期间已有更新的渲染事务触发，本次作废退出，绝不碰触 DOM！
        if (currentEpoch !== this._renderEpoch) {
            return;
        }

        const fragment = document.createDocumentFragment();

        // 视口顶部工具条（目标名、快速施加状态、一键全关、新建 Buff）
        const toolbar = document.createElement("div");
        toolbar.className = "r20-viewport-toolbar";

        toolbar.innerHTML = `
            <div class="r20-toolbar-target-name">
                <span>${Roll20Bridge.escapeHtml(name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:3px;">
                <button class="r20-btn-debuff-trigger" title="选择并施加负面状态 (Debuff)">Debuff ▾</button>
                <button class="r20-btn-icon btn-deactivate-all" title="一键取消激活该单位身上的所有 Buff 与状态" style="color:#f59e0b;">🚫 全关</button>
                <button class="r20-btn-icon btn-add-buff-to-active" title="为此角色添加新 Buff">➕ Buff</button>
            </div>
        `;

        // 快速施加状态：多列网格浮层选择器
        const debuffTriggerBtn = toolbar.querySelector(".r20-btn-debuff-trigger");
        debuffTriggerBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showDebuffPopover(debuffTriggerBtn, this.activeTarget, () => this.renderViewport());
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
                TokenBuffManager.saveTokenDebuffs(token, []);
                this.showNotice(`已清空 [${name}] 的全部 Buff 与状态`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        toolbar.querySelector(".btn-add-buff-to-active")?.addEventListener("click", () => {
            this.showBuffEditorDialog(null, char, token);
        });

        fragment.appendChild(toolbar);

        // 提前单次读取启停复选框设置，规避条目遍历内高频重复访问 localStorage 与 JSON.parse
        const showCheckbox = SuiteConfigStore.getSetting("buff_show_checkbox", false);

        // 渲染专属负面状态 (Debuff / Condition) 区块
        if (debuffs.length > 0) {
            const listEl = document.createElement("div");
            listEl.className = "r20-debuff-list";
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
                    linkBadgeHtml = this.getLinkBadgeHtml(hostChar);
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
                                let roundsAttr = Roll20Bridge.findAttr(char, roundsKey);
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
                    this.showBuffContextMenu(e.clientX, e.clientY, d, char, Array.from(this.selectedBuffRowIds), token);
                });

                listEl.appendChild(item);
            });
            fragment.appendChild(listEl);

            // 若同时存在正面 Buff，简单以极细分割线隔开
            if (buffs.length > 0) {
                const divider = document.createElement("div");
                divider.className = "r20-buff-divider";
                fragment.appendChild(divider);
            }
        }

        if (buffs.length === 0) {
            if (debuffs.length === 0) {
                const emptyEl = document.createElement("div");
                emptyEl.className = "r20-empty-view";
                emptyEl.innerHTML = `该单位当前无任何 Buff<br>从其他标签拖拽 Buff 放置即可施加`;
                fragment.appendChild(emptyEl);
            }
        } else {
            const buffListEl = document.createElement("div");
            buffListEl.className = "r20-buff-list";
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
                    linkBadgeHtml = this.getLinkBadgeHtml(hostChar);
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
                    if (!char && !token) return;

                    // 纯 Token：直接改写自定义字段中的轮数（清空 = 常驻）
                    if (token) {
                        Roll20Bridge.attachInlineRoundEditor(curEl, {
                            initialValue: curVal !== null ? curVal : "",
                            placeholder: "常驻",
                            className: "r20-input-round-inline",
                            onCommit: async (raw) => {
                                const newRounds = (raw !== "" && !isNaN(Number(raw))) ? Number(raw) : null;
                                const list = TokenBuffManager.getTokenBuffs(token);
                                const target = list.find(x => x.name === b.name);
                                if (target) {
                                    target.rounds = newRounds;
                                    TokenBuffManager.saveTokenBuffs(token, list);
                                }
                                await Pf1eBuffUI.refreshAllBadges();
                                await this.renderViewport();
                            }
                        });
                        return;
                    }

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
                    if (!char && !token) return;

                    // 纯 Token：直接改写自定义字段中的初始轮数（清空 = 无预置轮数）
                    if (token) {
                        Roll20Bridge.attachInlineRoundEditor(initEl, {
                            initialValue: initVal !== null ? initVal : "",
                            placeholder: "-",
                            className: "r20-input-round-inline",
                            onCommit: async (raw) => {
                                const newInit = (raw !== "" && !isNaN(Number(raw))) ? Number(raw) : null;
                                const list = TokenBuffManager.getTokenBuffs(token);
                                const target = list.find(x => x.name === b.name);
                                if (target) {
                                    target.initRounds = newInit;
                                    TokenBuffManager.saveTokenBuffs(token, list);
                                }
                                await this.renderViewport();
                            }
                        });
                        return;
                    }

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
                    } else if (token && b.linkHostId) {
                        // 纯 Token：清顶层链接字段，并向宿主除名
                        const list = TokenBuffManager.getTokenBuffs(token);
                        const target = list.find(x => x.rowId === b.rowId);
                        if (target) {
                            const srcRowId = target.linkSourceRowId;
                            const hostId = target.linkHostId;
                            target.linkHostId = null;
                            target.linkSourceRowId = null;
                            TokenBuffManager.saveTokenBuffs(token, list);
                            const hostChar = window.Campaign?.characters?.get(hostId);
                            if (hostChar && srcRowId) {
                                await Pf1eBuffManager.removeDownstreamLink(hostChar, srcRowId, token.id, b.rowId);
                            }
                        }
                        this.showNotice(`已断开 [${b.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    }
                });

                // 编辑细目
                item.querySelector(".btn-edit-buff-row")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.showBuffEditorDialog(b, char, token);
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
                    this.showBuffContextMenu(e.clientX, e.clientY, b, char, Array.from(this.selectedBuffRowIds), token);
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

                buffListEl.appendChild(item);
            });
            fragment.appendChild(buffListEl);
        }

        // 最终原子级一次性替换视口内容，彻底杜绝先清空后追加的竞态与视觉闪烁
        if (currentEpoch === this._renderEpoch) {
            viewport.replaceChildren(fragment);
        }
    }

    /**
     * 弹出 Buff 右键快捷菜单 (多选激活/多选关停/全选中同名关停/编辑/施加/同步)
     */
    static showBuffContextMenu(x, y, buff, char, selectedRowIds = [], token = null) {
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
            } else if (token) {
                for (const rId of selIds) {
                    TokenBuffManager.toggleDebuff(token, rId, true);
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
            } else if (token) {
                for (const rId of selIds) {
                    TokenBuffManager.toggleDebuff(token, rId, false);
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
            const buffsToApply = await this.resolveBuffsForBatchApply(buff, char, token, selectedRowIds);
            let count = 0;
            const selfActivatedNames = [];
            for (const t of selected) {
                // 人物卡单位走角色卡后端；纯 Token 单位走自定义字段后端（链接 Debuff 对 Token 退化为独立副本）
                const target = t.char
                    ? { type: "char", id: t.char.id, name: t.char.get("name") }
                    : (t.token ? { type: "token", id: t.token.id, name: t.token.get("name") } : null);
                if (!target) continue;
                if (t.char && t.char.id === char.id) {
                    // 自身：逐个激活选中的正面条目（Debuff 排除施法者自身）
                    for (const b of buffsToApply) {
                        const bIsDebuff = !!b.isDebuff || (typeof b.rowId === "string" && b.rowId.startsWith("condition-"));
                        if (bIsDebuff) continue;
                        if (!b.enabled) {
                            await Pf1eBuffManager.toggleBuff(char, b.rowId, true);
                            b.enabled = true;
                            selfActivatedNames.push(b.name);
                        }
                    }
                } else {
                    for (const b of buffsToApply) {
                        await this.applyBuffToTarget(b, target, char.id);
                        count++;
                    }
                }
            }
            if (selfActivatedNames.length > 0) this.notifyTokenRefresh(char);
            const msg = selfActivatedNames.length > 0
                ? `已激活自身 ${selfActivatedNames.length} 项，并为 ${count} 个目标施加链接（${buffsToApply.length} 项 × 选中单位）`
                : `已为 ${count} 个目标施加链接（${buffsToApply.length} 项 × 选中单位）`;
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
            const buffsToApply = await this.resolveBuffsForBatchApply(buff, char, token, selectedRowIds);
            let count = 0;
            const selfActivatedNames = [];
            for (const t of selected) {
                const target = t.char
                    ? { type: "char", id: t.char.id, name: t.char.get("name") }
                    : (t.token ? { type: "token", id: t.token.id, name: t.token.get("name") } : null);
                if (!target) continue;
                if (t.char && t.char.id === char.id) {
                    // 自身：逐个激活选中的正面条目（Debuff 排除施法者自身）
                    for (const b of buffsToApply) {
                        const bIsDebuff = !!b.isDebuff || (typeof b.rowId === "string" && b.rowId.startsWith("condition-"));
                        if (bIsDebuff) continue;
                        if (!b.enabled) {
                            await Pf1eBuffManager.toggleBuff(char, b.rowId, true);
                            b.enabled = true;
                            selfActivatedNames.push(b.name);
                        }
                    }
                } else {
                    for (const b of buffsToApply) {
                        await this.applyBuffToTarget(b, target, null);
                        count++;
                    }
                }
            }
            if (selfActivatedNames.length > 0) this.notifyTokenRefresh(char);
            const msg = selfActivatedNames.length > 0
                ? `已激活自身 ${selfActivatedNames.length} 项，并为 ${count} 个目标施加普通副本（${buffsToApply.length} 项 × 选中单位）`
                : `已为 ${count} 个目标施加普通副本（${buffsToApply.length} 项 × 选中单位）`;
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
            } else if (token) {
                for (const rId of delIds) {
                    // 若条目是链接副本，先向宿主除名（否则宿主子计数残留幽灵）
                    const list = TokenBuffManager.getTokenBuffs(token);
                    const victim = list.find(e => e.rowId === rId || e.name === rId);
                    if (victim && victim.linkHostId) {
                        const hostChar = window.Campaign?.characters?.get(victim.linkHostId);
                        if (hostChar && victim.linkSourceRowId) {
                            await Pf1eBuffManager.removeDownstreamLink(hostChar, victim.linkSourceRowId, token.id, victim.rowId);
                        }
                    }
                    TokenBuffManager.removeTrackedDebuff(token, rId);
                    TokenBuffManager.removeBuff(token, rId);
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
                TokenBuffManager.addTrackedDebuff(targetToken, {
                    key: condKey,
                    name: buff.name,
                    rounds: buff.rounds,
                    initRounds: null,
                    enabled: true,
                    linkHostId: sourceHostId || null,
                    linkSourceRowId: sourceHostId ? buff.rowId : null
                });
                if (sourceHostId) {
                    const hostChar = window.Campaign?.characters?.get(sourceHostId);
                    if (hostChar) {
                        await Pf1eBuffManager.recordDownstreamLink(hostChar, condKey, targetToken.id, condKey);
                    }
                }
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
            // 纯 Token：链接 Buff 记录影子链接元数据并向宿主登记下游；普通副本彻底独立
            const entry = TokenBuffManager.applyOrRefreshBuff(targetToken, buff.name, buff.rounds, null, buff.initRounds);
            if (entry && sourceHostId && buff.rowId) {
                // 关键：applyOrRefreshBuff 内部已保存，必须重新读取列表、按 rowId 定位到
                // 刚落盘的条目再写入链接元数据——直接改旧对象会被随后的保存覆盖丢失
                const list = TokenBuffManager.getTokenBuffs(targetToken);
                const stored = list.find(x => x.rowId === entry.rowId);
                if (stored) {
                    // 链接元数据写在顶层字段（与人物卡 getAllBuffs 输出一致），extraAttrs 只存细目
                    stored.linkHostId = sourceHostId;
                    stored.linkSourceRowId = buff.rowId;
                    TokenBuffManager.saveTokenBuffs(targetToken, list);
                }
                const hostChar = window.Campaign?.characters?.get(sourceHostId);
                if (hostChar) {
                    await Pf1eBuffManager.recordDownstreamLink(hostChar, buff.rowId, targetToken.id, entry.rowId);
                }
            }
            this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} Buff [${buff.name}]`);
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetToken.id);
            await this.renderViewport();
        }
    }

    /**
     * 解析批量施加的条目列表：右键行在多选中且选中不止一行 → 施加全部选中条目；否则只施加右键行
     */
    static async resolveBuffsForBatchApply(buff, char, token, selectedRowIds) {
        const sel = new Set(selectedRowIds || []);
        if (!sel.has(buff.rowId) || sel.size <= 1) return [buff];
        const all = char
            ? [...(await Pf1eBuffManager.getAllBuffs(char)), ...Pf1eBuffUI.getAllDebuffsSync(char)]
            : [...TokenBuffManager.getTokenBuffs(token), ...TokenBuffManager.getTokenDebuffs(token)];
        const matched = all.filter(b => sel.has(b.rowId));
        return matched.length > 0 ? matched : [buff];
    }

    /**
     * 响应 Buff 变更，根据设置面板「延迟重新计算」偏好 (debounce_recalc_enabled / debounce_recalc_ms)
     * 决定是否在无操作静止一段时间后自动重算所有选中单位的加值。
     * 本方法是与 SuiteSettingsPanel 的设置项之间唯一的消费契约，
     * BuffDetachedWindow 的 buff 变更处理器也依赖此方法，绝不可删除！
     */
    static notifyBuffMutation() {
        const enabled = SuiteConfigStore.getSetting("debounce_recalc_enabled", false);
        if (!enabled) return;

        const delayMs = SuiteConfigStore.getSetting("debounce_recalc_ms", 2000);
        if (this._debounceRecalcTimer) {
            clearTimeout(this._debounceRecalcTimer);
        }

        this._debounceRecalcTimer = setTimeout(async () => {
            console.log(`[BuffFloatingPanel] 静止 ${delayMs}ms，触发防抖自动重新计算加值`);
            await this.recalculateAllSelected();
        }, delayMs);
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
     * 将动态选区的单位钉选至常驻标签栏
     * @returns {string|null} 成功钉选（或已被钉选）的人物卡 id；无人物卡等准入失败返回 null
     */
    static pinTargetToken(token, { type, id, name, char }) {
        let charId = null;
        if (type === "char") {
            charId = id;
        } else if (char?.id) {
            charId = char.id;
        } else if (token) {
            const resolvedChar = Roll20Bridge.getCharacterByToken(token);
            if (resolvedChar?.id) {
                charId = resolvedChar.id;
            }
        }

        if (!charId) {
            this.showNotice(`该单位未关联人物卡，无法钉选`);
            return null;
        }

        if (!this.pinnedCharIds.includes(charId)) {
            this.pinnedCharIds.push(charId);
            this.savePinnedChars();
            this.showNotice(`已将【${name}】钉选至常驻标签栏`);
            this.renderDispatcher();
        }
        return charId;
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
     * 弹出添加固定角色菜单（带实时搜索框、滚动条与边界自适应翻转）
     * 恢复自 v0.9.26：下方空间不足时自动向上翻转展开
     */
    static showAddPinnedCharMenu(anchorBtn) {
        document.querySelector(".r20-pinned-char-picker")?.remove();

        const characters = window.Campaign?.characters?.models || [];
        const unpinned = characters.filter(c => !c.get("archived") && !this.pinnedCharIds.includes(c.id));

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
                style="width:100%; box-sizing:border-box; background:#ffffff; border:1px solid #d0d0d0; color:#333333; padding:5px 8px; border-radius:4px; font-size:11px; outline:none;">
        `;
        menu.appendChild(searchBox);

        // 滚动列表容器
        const listContainer = document.createElement("div");
        listContainer.style.cssText = "flex:1 1 auto; overflow-y:auto; max-height:240px; scrollbar-width:thin;";

        if (unpinned.length === 0) {
            listContainer.innerHTML = `<div style="padding:10px; color:#94a3b8; font-size:11px; text-align:center;">无可用未钉选角色</div>`;
        } else {
            const itemNodes = [];
            unpinned.forEach(c => {
                const name = c.get("name") || "未命名";
                const item = document.createElement("div");
                item.className = "r20-context-menu-item";
                item.style.cssText = "padding:5px 8px; border-radius:3px; cursor:pointer;";
                item.innerHTML = `<span>🛡️</span><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Roll20Bridge.escapeHtml(name)}</span>`;
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
     * 更新布局展开方向（恢复自 v0.8.0）：以标题栏在屏幕上/下半区为纯粹基准
     * direction-up：面板停靠屏幕下半区时，内容抽屉在标题栏上方向上展开
     */
    /**
     * 落位与朝向判定（唯一实现）：
     * 比较标题栏下方到屏幕底部的剩余空间与面板高度——
     * 剩余空间更大 → 抽屉放标题栏之后（向下展开，top 锚定）；
     * 面板高度更大 → 抽屉挪到标题栏之前（direction-up 类翻转节点顺序，bottom 锚定），
     * 两种情况标题栏的屏幕位置都保持在 headerClientY 不动。
     * @param {number} headerClientY 标题栏目标屏幕 Y
     */
    static placePanel(headerClientY) {
        if (!this.panelEl) return;
        const headerEl = this.panelEl.querySelector(".r20-panel-header");
        const headerH = headerEl ? headerEl.offsetHeight : 30;
        const panelH = this._savedExpandedHeight || 380;
        const spaceBelow = window.innerHeight - headerClientY - headerH;

        // 节点顺序由 direction 类驱动（CSS: .direction-up { flex-direction: column-reverse }）
        this.isDirectionUp = spaceBelow < panelH;
        this.panelEl.classList.toggle("direction-up", this.isDirectionUp);
        this.panelEl.classList.toggle("direction-down", !this.isDirectionUp);

        // 锚定：向下锚标题栏顶边，向上锚标题栏底边，标题栏位置不动
        if (this.isDirectionUp) {
            this.panelEl.style.top = "auto";
            this.panelEl.style.bottom = `${Math.max(10, window.innerHeight - headerClientY - headerH)}px`;
        } else {
            this.panelEl.style.bottom = "auto";
            this.panelEl.style.top = `${Math.max(10, headerClientY)}px`;
        }
        if (!this.isCollapsed) {
            this.panelEl.style.height = `${panelH}px`;
        }
    }

    /**
     * 明确展开/折叠面板状态（规范高度状态机，避免遗留巨大空白黑框）
     */
    /**
     * 明确展开/折叠面板状态。
     * 统一几何模型：面板是唯一的尺寸载体（正常 flex 文档流）；向上展开 = 子节点
     * 顺序颠倒（direction-up 类 → column-reverse，抽屉在上、标题栏在下）+ 面板
     * 改用底边锚定（top:auto/bottom:X），标题栏在屏幕上的位置保持不动。
     */
    static setCollapse(collapsed) {
        if (!this.panelEl) return;
        this.isCollapsed = !!collapsed;
        const drawer = this.panelEl.querySelector(".r20-panel-content-drawer");
        const btn = this.panelEl.querySelector(".btn-toggle-collapse");
        this.panelEl.classList.toggle("is-collapsed", this.isCollapsed);

        if (this.isCollapsed) {
            if (drawer) drawer.style.display = "none";
            if (btn) btn.textContent = "▸";
            this.panelEl.style.height = "auto";
            this.panelEl.style.minHeight = "0px"; // 压过基础 CSS 的 min-height:200px，避免折叠后残留大白框
            return;
        }

        // 展开即落位：以标题栏当前位置为锚，朝向由「下方剩余空间 vs 面板高度」判定
        if (btn) btn.textContent = "▾";
        if (drawer) drawer.style.display = "";
        this.panelEl.style.minHeight = "";
        const headerEl = this.panelEl.querySelector(".r20-panel-header");
        this.placePanel(headerEl ? headerEl.getBoundingClientRect().top : this.panelEl.offsetTop);
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
            if (this._headerDragging) return; // 原生拖拽标题栏期间不自动折叠
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
                // 恢复标题栏屏幕位置；朝向与锚定交由 setCollapse 展开时的 placePanel 统一判定
                this.panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, left))}px`;
                this.panelEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 40, top))}px`;
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
                // 高度唯一真源：只写入 _savedExpandedHeight（面板高度由 setCollapse 落位时统一设置）
                if (height > 50) {
                    this._savedExpandedHeight = Math.max(200, Math.min(window.innerHeight - 40, height));
                }
            }
        } catch (e) {}
    }

    /**
     * 保存面板位置与尺寸
     */
    static savePositionAndSize() {
        if (!this.panelEl) return;
        try {
            // 持久化标题栏的屏幕 Y（向上展开模式下面板 offsetTop 是盒子顶边而非标题栏）
            const headerEl = this.panelEl.querySelector(".r20-panel-header");
            localStorage.setItem(this.POS_KEY, JSON.stringify({
                left: this.panelEl.offsetLeft,
                top: headerEl ? Math.round(headerEl.getBoundingClientRect().top) : this.panelEl.offsetTop
            }));
            // 高度唯一真源：展开时面板可实测，折叠时沿用记忆高度
            if (!this.isCollapsed && this.panelEl.offsetHeight > 50) {
                this._savedExpandedHeight = this.panelEl.offsetHeight;
            }
            localStorage.setItem(this.SIZE_KEY, JSON.stringify({
                width: this.panelEl.offsetWidth,
                height: this._savedExpandedHeight || 380
            }));
        } catch (e) {}
    }

    /**
     * 弹出 Roll20 原生风格多列负面状态 (Debuff) 网格选择面板 (Popover Grid)
     */
    static showDebuffPopover(triggerBtn, target, onApplied) {
        const existing = document.querySelector(".r20-popover-grid-container");
        if (existing) {
            const wasSameTrigger = existing._triggerBtn === triggerBtn;
            existing._cleanup?.();
            existing.remove();
            if (wasSameTrigger) return;
        }

        const char = target?.type === "char" ? (target.char || window.Campaign?.characters?.get(target.id)) : null;
        const token = target?.type === "token"
            ? (target.token || Roll20Bridge.getTokenGraphic(target.id))
            : (target && typeof target.get === "function" ? target : null);
        const name = target?.name || (char ? char.get("name") : (token ? token.get("name") : "当前单位"));

        const popover = document.createElement("div");
        popover.className = "r20-popover-grid-container";
        popover._triggerBtn = triggerBtn;

        const defs = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS;
        const itemsHtml = defs.map(d => `
            <div class="r20-popover-grid-item" data-key="${d.key}" title="${Roll20Bridge.escapeHtml(d.name)}">
                ${Roll20Bridge.escapeHtml(d.name)}
            </div>
        `).join("");

        popover.innerHTML = `
            <div class="r20-popover-grid-header">
                <span>添加负面状态 (${defs.length})</span>
                <button class="btn-close-popover" title="关闭">✕</button>
            </div>
            <div class="r20-popover-grid-body">
                ${itemsHtml}
            </div>
        `;

        document.body.appendChild(popover);

        // 计算定位坐标，就近挂载在触发按钮下方
        const rect = triggerBtn.getBoundingClientRect();
        const popWidth = 310;
        let left = rect.left;
        if (left + popWidth > window.innerWidth - 10) {
            left = Math.max(10, window.innerWidth - popWidth - 10);
        }
        let top = rect.bottom + 4;
        const popHeight = Math.min(290, popover.offsetHeight || 260);
        if (top + popHeight > window.innerHeight - 10) {
            top = Math.max(10, rect.top - popHeight - 4);
        }
        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(top)}px`;

        triggerBtn.classList.add("active");

        const closePopover = () => {
            triggerBtn.classList.remove("active");
            popover.remove();
            document.removeEventListener("mousedown", onOutsideClick, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
        popover._cleanup = closePopover;

        const onOutsideClick = (e) => {
            if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
                closePopover();
            }
        };

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                closePopover();
            }
        };

        document.addEventListener("mousedown", onOutsideClick, true);
        document.addEventListener("keydown", onKeyDown, true);

        popover.querySelector(".btn-close-popover")?.addEventListener("click", () => {
            closePopover();
        });

        popover.querySelectorAll(".r20-popover-grid-item").forEach(itemEl => {
            itemEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                const condKey = itemEl.dataset.key;
                const def = defs.find(d => d.key === condKey);
                const dName = def ? def.name : condKey;

                closePopover();

                if (char) {
                    await Pf1eBuffManager.addTrackedDebuff(char, condKey);
                    await Pf1eBuffManager.toggleCondition(char, condKey, false, 0);
                    BuffFloatingPanel.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                    await Pf1eBuffUI.refreshAllBadges();
                    if (onApplied) await onApplied();
                } else if (token) {
                    TokenBuffManager.addTrackedDebuff(token, {
                        key: condKey,
                        name: dName,
                        rounds: 0,
                        initRounds: 0,
                        enabled: false
                    });
                    BuffFloatingPanel.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                    await Pf1eBuffUI.refreshAllBadges();
                    if (onApplied) await onApplied();
                }
            });
        });
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
    static showBuffEditorDialog(existingNode = null, charTarget = null, tokenTarget = null) {
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
            } else if (tokenTarget) {
                // 纯 Token：新增直接追加条目；编辑按原名称定位自定义字段中的条目后整体改写
                const list = TokenBuffManager.getTokenBuffs(tokenTarget);
                if (isEditing) {
                    const target = list.find(x => x.name === existingNode.name);
                    if (target) {
                        target.name = name;
                        target.rounds = rounds === "" ? null : rounds;
                        target.initRounds = initRounds === "" ? null : initRounds;
                        target.extraAttrs = Object.keys(extraAttrs).length > 0 ? extraAttrs : null;
                        this.showNotice(`✅ 已更新 Token Buff [${name}]`);
                    }
                } else {
                    list.push({
                        name,
                        rounds: rounds === "" ? null : rounds,
                        initRounds: initRounds === "" ? null : initRounds,
                        extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null
                    });
                    this.showNotice(`✅ 已新增 Token Buff [${name}]`);
                }
                TokenBuffManager.saveTokenBuffs(tokenTarget, list);
                await this.renderViewport();
            }
        });
    }
}
