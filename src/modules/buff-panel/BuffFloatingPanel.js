import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";
import { BuffPanelStyles } from "./BuffPanelStyles.js";
import { BuffPanelTemplates } from "./BuffPanelTemplates.js";
import { BuffPanelDragDrop } from "./BuffPanelDragDrop.js";

/**
 * BuffFloatingPanel.js
 * 状态Buff工作台主控制器：
 * 1. 拖动主体纯粹为标题栏，内容栏以标题栏位置为基准向上或向下展示；
 * 2. 物理折叠（- 缩成只有标题栏，标号变为 +；未固定时移出 400ms 自动折叠，移入展开）；
 * 3. 完美适配 Jumpgate 现代引擎原生选区与先攻联动；
 * 4. 角色卡原生 repeating_buff2 数据源双向实时同步。
 */
export class BuffFloatingPanel {
    static POS_KEY = "r20_suite_panel_pos_v7";
    static PIN_KEY = "r20_suite_panel_pinned_v7";
    static COLLAPSE_KEY = "r20_suite_panel_collapsed_v7";

    static panelEl = null;
    static isPinned = false;
    static isCollapsed = false;
    static isEditMode = false;
    static isTemplatePaneCollapsed = false;
    static isUnitPaneCollapsed = false;
    static isDirectionUp = false;

    static templates = [];
    static editSelectedIds = new Set();
    static _draggedData = null;
    static _leaveTimer = null;
    static _lastSelectedIdsStr = "";

    /**
     * 初始化悬浮面板
     */
    static async init() {
        BuffPanelStyles.inject();

        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.isCollapsed = localStorage.getItem(this.COLLAPSE_KEY) === "true";

        // 从云端原生角色卡加载模板
        this.templates = await SuiteConfigStore.loadTemplates();

        this.createPanelDOM();
        this.initHoverCollapse();
        this.initDragGestures();
        this.initSelectionListeners();
        this.initDatabaseCharacterWatcher();

        await this.renderAllPanes();
    }

    /**
     * 创建悬浮面板主 DOM
     */
    static createPanelDOM() {
        if (document.querySelector("#r20-buff-panel")) return;

        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";

        panel.innerHTML = BuffPanelTemplates.getMainPanelHTML({
            isPinned: this.isPinned,
            isCollapsed: this.isCollapsed,
            isTemplatePaneCollapsed: this.isTemplatePaneCollapsed,
            isUnitPaneCollapsed: this.isUnitPaneCollapsed
        });

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 应用初始折叠状态
        if (this.isCollapsed) {
            panel.classList.add("is-collapsed");
        }

        // 读取并应用持久化位置（纯 left / top）
        this.restorePanelPosition();

        // 绑定头部按钮
        panel.querySelector(".btn-toggle-pin").addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());

        // 双栏折叠监听
        panel.querySelector(".r20-template-pane .r20-pane-header").addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            this.isTemplatePaneCollapsed = !this.isTemplatePaneCollapsed;
            panel.querySelector(".r20-template-pane .toggle-icon").textContent = this.isTemplatePaneCollapsed ? "▶" : "▼";
            panel.querySelector(".r20-template-tree").style.display = this.isTemplatePaneCollapsed ? "none" : "flex";
        });

        panel.querySelector(".r20-unit-pane .r20-pane-header").addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            this.isUnitPaneCollapsed = !this.isUnitPaneCollapsed;
            panel.querySelector(".r20-unit-pane .toggle-icon").textContent = this.isUnitPaneCollapsed ? "▶" : "▼";
            panel.querySelector(".r20-unit-tree").style.display = this.isUnitPaneCollapsed ? "none" : "flex";
        });

        // 模板工具栏
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
        panel.querySelector(".btn-import-buffs").addEventListener("click", () => this.showImportFromCharacterDialog());
        panel.querySelector(".btn-batch-delete").addEventListener("click", () => this.deleteSelectedBuffs());

        this.updateLayoutDirection();
    }

    /**
     * 恢复持久化坐标（纯 left 与 top）
     */
    static restorePanelPosition() {
        const savedPos = localStorage.getItem(this.POS_KEY);
        let left = Math.max(10, window.innerWidth - 340);
        let top = 100;

        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                if (pos.left !== undefined) left = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
                if (pos.top !== undefined) top = Math.max(10, Math.min(window.innerHeight - 40, pos.top));
            } catch (e) {}
        }

        this.panelEl.style.left = `${left}px`;
        this.panelEl.style.top = `${top}px`;
        this.panelEl.style.right = "auto";
        this.panelEl.style.bottom = "auto";
        this.updateLayoutDirection(top);
    }

    /**
     * 更新布局展开方向（以标题栏在屏幕上下半区为纯粹基准）
     */
    static updateLayoutDirection(currentTop = null) {
        if (!this.panelEl) return;
        const top = currentTop !== null ? currentTop : this.panelEl.offsetTop;
        const middleY = window.innerHeight / 2;
        this.isDirectionUp = top > middleY;

        if (this.isDirectionUp) {
            this.panelEl.classList.add("direction-up");
            this.panelEl.classList.remove("direction-down");
        } else {
            this.panelEl.classList.add("direction-down");
            this.panelEl.classList.remove("direction-up");
        }
    }

    /**
     * 拖拽手势初始化
     */
    static initDragGestures() {
        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            (left, top) => {
                localStorage.setItem(this.POS_KEY, JSON.stringify({ left, top }));
                this.updateLayoutDirection(top);
            },
            (left, top) => {
                this.updateLayoutDirection(top);
            }
        );
    }

    /**
     * 鼠标移入展开、移出折叠（未钉住时 400ms 防抖）
     */
    static initHoverCollapse() {
        this.panelEl.addEventListener("mouseenter", async () => {
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapsed(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (this.isPinned) return;
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            this._leaveTimer = setTimeout(() => {
                if (!this.isPinned && !this.isCollapsed) {
                    this.setCollapsed(true);
                }
            }, 400);
        });
    }

    /**
     * 设置物理折叠状态
     */
    static setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        localStorage.setItem(this.COLLAPSE_KEY, String(collapsed));

        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (this.isCollapsed) {
            this.panelEl.classList.add("is-collapsed");
            if (minBtn) {
                minBtn.textContent = "+";
                minBtn.title = "展开面板";
            }
        } else {
            this.panelEl.classList.remove("is-collapsed");
            if (minBtn) {
                minBtn.textContent = "-";
                minBtn.title = "折叠面板(仅留标题)";
            }
            this.updateLayoutDirection();
        }
    }

    static toggleCollapse() {
        this.setCollapsed(!this.isCollapsed);
    }

    /**
     * 图钉固定切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        const btnPin = this.panelEl.querySelector(".btn-toggle-pin");

        if (this.isPinned) {
            btnPin.classList.add("pinned");
            btnPin.title = "取消固定(移出自动折叠)";
            if (this.isCollapsed) this.setCollapsed(false);
            this.showToast("📌 已固定悬浮窗显示", "info");
        } else {
            btnPin.classList.remove("pinned");
            btnPin.title = "固定常驻显示";
            this.showToast("📌 已开启鼠标移出自动折叠", "info");
        }
    }

    /**
     * 监听 Jumpgate 画布选区变化
     */
    static initSelectionListeners() {
        // 监听画布点击释放
        document.addEventListener("pointerup", () => this.checkSelectionChanged(), true);
        document.addEventListener("mouseup", () => this.checkSelectionChanged(), true);
        document.addEventListener("keyup", () => this.checkSelectionChanged(), true);

        // 先攻条点击联动
        const turnTracker = document.querySelector("#initiativewindow, .turn-tracker");
        if (turnTracker) {
            turnTracker.addEventListener("click", () => this.checkSelectionChanged(), true);
        }

        // 轻量定时轮询保障（350ms）
        setInterval(() => this.checkSelectionChanged(), 350);
    }

    /**
     * 检查选区是否发生实质变化
     */
    static checkSelectionChanged() {
        const tokens = this.getSelectedTokens();
        const idsStr = tokens.map(t => t.token?.id || t.char?.id || t.name).sort().join(",");
        if (idsStr !== this._lastSelectedIdsStr) {
            this._lastSelectedIdsStr = idsStr;
            this.renderAllPanes();
        }
    }

    /**
     * 监听数据库角色卡的原生属性变动（实时更新模板库）
     */
    static initDatabaseCharacterWatcher() {
        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar && dbChar.attribs) {
            dbChar.attribs.on("add change remove reset", () => {
                if (this._dbSyncTimer) clearTimeout(this._dbSyncTimer);
                this._dbSyncTimer = setTimeout(async () => {
                    this.templates = await SuiteConfigStore.loadTemplates();
                    await this.renderTemplatePane();
                }, 150);
            });
        }
    }

    /**
     * 获取 Jumpgate 现代架构下当前选中的 Tokens
     */
    static getSelectedTokens() {
        const result = [];
        const seenTokenIds = new Set();

        // 1. Jumpgate 原生核心选区接口
        const tt = window.Campaign?.engine?.tabletop;
        if (tt && typeof tt.getSelection === "function") {
            try {
                const selection = tt.getSelection();
                if (Array.isArray(selection) && selection.length > 0) {
                    for (const item of selection) {
                        const tokenId = item.id;
                        if (!tokenId || seenTokenIds.has(tokenId)) continue;
                        seenTokenIds.add(tokenId);

                        // 提取 Backbone Token Model
                        let tokenModel = item.model;
                        if (!tokenModel) {
                            tokenModel = Roll20Bridge.getTokenGraphic(tokenId);
                        }

                        if (tokenModel) {
                            const charId = tokenModel.get("represents");
                            if (charId && window.Campaign && window.Campaign.characters) {
                                const char = window.Campaign.characters.get(charId);
                                if (char) {
                                    result.push({ type: "character", char, token: tokenModel, name: char.get("name") });
                                    continue;
                                }
                            }
                            result.push({ type: "token", token: tokenModel, name: tokenModel.get("name") || "未命名棋子" });
                        }
                    }
                    return result;
                }
            } catch (e) {
                console.warn("[BuffFloatingPanel] Jumpgate getSelection 异常:", e);
            }
        }

        // 2. 回退机制：老版 Fabric 引擎
        if (window.d20 && window.d20.engine && window.d20.engine.canvas) {
            try {
                const active = window.d20.engine.canvas.getActiveObjects ? window.d20.engine.canvas.getActiveObjects() : [];
                for (const obj of active) {
                    if (obj.id && !seenTokenIds.has(obj.id)) {
                        seenTokenIds.add(obj.id);
                        const tokenModel = Roll20Bridge.getTokenGraphic(obj.id);
                        if (tokenModel) {
                            const charId = tokenModel.get("represents");
                            if (charId && window.Campaign && window.Campaign.characters) {
                                const char = window.Campaign.characters.get(charId);
                                if (char) {
                                    result.push({ type: "character", char, token: tokenModel, name: char.get("name") });
                                    continue;
                                }
                            }
                            result.push({ type: "token", token: tokenModel, name: tokenModel.get("name") || "未命名棋子" });
                        }
                    }
                }
            } catch (e) {}
        }

        return result;
    }

    /**
     * 收集选中单位的 Buff 详情
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        const allBuffRows = [];
        if (selectedTokens.length === 0) return { activeStats, allBuffRows };

        for (const item of selectedTokens) {
            let itemBuffs = [];
            if (item.type === "character" && item.char) {
                itemBuffs = await Pf1eBuffManager.getAllBuffs(item.char);
            } else if (item.token) {
                const tokenBuffs = TokenBuffManager.getTokenBuffs(item.token);
                itemBuffs = tokenBuffs.map(b => ({
                    name: b.name,
                    enabled: true,
                    rounds: b.rounds
                }));
            }

            const activeNames = itemBuffs.filter(b => b.enabled).map(b => b.name);
            const uniqueActiveNames = new Set(activeNames);
            for (const name of uniqueActiveNames) {
                if (!activeStats.has(name)) {
                    activeStats.set(name, { count: 1, total: selectedTokens.length });
                } else {
                    activeStats.get(name).count++;
                }
            }

            for (const b of itemBuffs) {
                let existing = allBuffRows.find(x => x.name === b.name);
                if (!existing) {
                    allBuffRows.push({
                        name: b.name,
                        enabledCount: b.enabled ? 1 : 0,
                        totalCount: 1,
                        rounds: b.rounds,
                        extraAttrs: b.extraAttrs || null
                    });
                } else {
                    existing.totalCount++;
                    if (b.enabled) existing.enabledCount++;
                }
            }
        }

        return { activeStats, allBuffRows };
    }

    /**
     * 编辑模式切换
     */
    static async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        const toolbar = this.panelEl.querySelector(".r20-panel-toolbar");

        if (this.isEditMode) {
            editBtn.classList.add("active");
            editBtn.textContent = "🔒 完成";
            toolbar.style.display = "flex";
            this.editSelectedIds.clear();
            this.showToast("✏️ 已进入编辑模式：点击多选待删，支持跨栏拖拽复制", "info");
        } else {
            editBtn.classList.remove("active");
            editBtn.textContent = "✏️ 编辑";
            toolbar.style.display = "none";
            this.editSelectedIds.clear();
        }

        await this.renderAllPanes();
    }

    /**
     * 渲染全部窗格
     */
    static async renderAllPanes() {
        await this.renderTemplatePane();
        await this.renderUnitPane();
    }

    /**
     * 渲染模板库栏
     */
    static async renderTemplatePane() {
        const treeEl = this.panelEl.querySelector(".r20-template-tree");
        if (!treeEl) return;
        treeEl.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();
        const { activeStats } = await this.getBuffStatsForSelected(selectedTokens);

        // 根目录放置区（编辑模式展示）
        const rootDropZone = document.createElement("div");
        rootDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        rootDropZone.textContent = "📥 拖拽到此处放置于根目录";
        BuffPanelDragDrop.setupRootDropZone({
            el: rootDropZone,
            templates: this.templates,
            getDraggedContext: () => this._draggedData,
            setDraggedContext: (ctx) => { this._draggedData = ctx; },
            onCrossCopyRoot: async (draggedNode) => {
                const copyNode = {
                    id: "b_" + Date.now(),
                    type: "buff",
                    name: draggedNode.name,
                    rounds: draggedNode.rounds,
                    extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                };
                this.templates.push(copyNode);
                await this.saveTemplates(true);
                await this.renderAllPanes();
                this.showToast(`📋 已复制 [${copyNode.name}] 到模板库`, "success");
            },
            onReorderRoot: async (draggedNode, sourceList, sourceIdx) => {
                sourceList.splice(sourceIdx, 1);
                this.templates.push(draggedNode);
                await this.saveTemplates(true);
                await this.renderTemplatePane();
            }
        });
        treeEl.appendChild(rootDropZone);

        // 如果没有模板，呈现说明
        if (this.templates.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "r20-empty-placeholder";
            emptyEl.innerHTML = `暂无模板数据<br><span style="font-size:10px; color:#546e7a;">点击上方的「✏️ 编辑」再点「+ Buff」即可创建原生配置卡并保存模板</span>`;
            treeEl.appendChild(emptyEl);
            return;
        }

        this.renderTemplateNodes(this.templates, treeEl, activeStats, selectedTokens);
    }

    /**
     * 递归渲染模板库节点
     */
    static renderTemplateNodes(nodes, container, activeStats, selectedTokens) {
        nodes.forEach((node, idx) => {
            if (node.type === "folder") {
                const folderEl = document.createElement("div");
                folderEl.className = "r20-tree-folder";

                const allChildBuffs = this.collectFolderBuffNames(node);
                let folderClass = "";
                if (!this.isEditMode && selectedTokens.length > 0 && allChildBuffs.length > 0) {
                    let totalMatches = 0;
                    allChildBuffs.forEach(name => {
                        const stat = activeStats.get(name);
                        if (stat && stat.count === stat.total) totalMatches++;
                    });
                    if (totalMatches === allChildBuffs.length) folderClass = "full-active";
                    else if (totalMatches > 0) folderClass = "partial-active";
                } else if (this.isEditMode && this.editSelectedIds.has(node.id)) {
                    folderClass = "edit-selected";
                }

                const header = document.createElement("div");
                header.className = `r20-folder-header ${folderClass}`;
                if (this.isEditMode) header.draggable = true;

                header.innerHTML = `
                    <div class="r20-folder-title">
                        <span class="folder-icon">${node.collapsed ? "📁" : "📂"}</span>
                        <span>${node.name}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `
                            <button class="r20-btn-icon btn-folder-rename" title="重命名">✏️</button>
                            <button class="r20-btn-icon danger btn-node-delete" title="删除文件夹">🗑️</button>
                        ` : ""}
                    </div>
                `;

                BuffPanelDragDrop.setupItemDrag({
                    el: header,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; },
                    onCrossCopy: async (draggedNode, targetNode) => {
                        const copyNode = {
                            id: "b_" + Date.now(),
                            type: "buff",
                            name: draggedNode.name,
                            rounds: draggedNode.rounds,
                            extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                        };
                        targetNode.children = targetNode.children || [];
                        targetNode.children.push(copyNode);
                        targetNode.collapsed = false;
                        await this.saveTemplates(true);
                        await this.renderAllPanes();
                        this.showToast(`📋 已将 [${copyNode.name}] 存入文件夹 [${targetNode.name}]`, "success");
                    },
                    onReorder: async (draggedNode, sourceList, sourceIdx, targetNode) => {
                        sourceList.splice(sourceIdx, 1);
                        targetNode.children = targetNode.children || [];
                        targetNode.children.push(draggedNode);
                        targetNode.collapsed = false;
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });

                header.addEventListener("click", async (e) => {
                    if (e.target.tagName === "BUTTON") return;
                    if (this.isEditMode) {
                        if (this.editSelectedIds.has(node.id)) this.editSelectedIds.delete(node.id);
                        else this.editSelectedIds.add(node.id);
                        this.renderTemplatePane();
                        return;
                    }

                    if (selectedTokens.length > 0) {
                        const shouldApplyAll = folderClass !== "full-active";
                        for (const bName of allChildBuffs) {
                            const foundBuff = this.findBuffNodeByName(node, bName);
                            await this.toggleBuffAction(bName, foundBuff?.rounds, foundBuff?.extraAttrs, shouldApplyAll);
                        }
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        node.collapsed = !node.collapsed;
                        await this.saveTemplates(false);
                        this.renderTemplatePane();
                    }
                });

                if (this.isEditMode) {
                    header.querySelector(".btn-folder-rename")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const newName = prompt("请输入新文件夹名称:", node.name);
                        if (newName && newName.trim()) {
                            node.name = newName.trim();
                            await this.saveTemplates(true);
                            this.renderTemplatePane();
                        }
                    });

                    header.querySelector(".btn-node-delete")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除文件夹 [${node.name}] 及其内部所有内容吗？`)) {
                            nodes.splice(idx, 1);
                            await this.saveTemplates(true);
                            await this.renderTemplatePane();
                        }
                    });
                }

                folderEl.appendChild(header);

                const childrenContainer = document.createElement("div");
                childrenContainer.className = "r20-folder-children";
                childrenContainer.style.display = node.collapsed ? "none" : "flex";

                if (node.children && node.children.length > 0) {
                    this.renderTemplateNodes(node.children, childrenContainer, activeStats, selectedTokens);
                }
                folderEl.appendChild(childrenContainer);
                container.appendChild(folderEl);

            } else if (node.type === "buff") {
                const itemEl = document.createElement("div");
                const stat = activeStats.get(node.name);
                const isFullActive = selectedTokens.length > 0 && stat && stat.count === selectedTokens.length;
                const isPartialActive = selectedTokens.length > 0 && stat && stat.count > 0 && !isFullActive;

                let itemClass = "";
                if (!this.isEditMode) {
                    if (isFullActive) itemClass = "full-active";
                    else if (isPartialActive) itemClass = "partial-active";
                } else if (this.editSelectedIds.has(node.id)) {
                    itemClass = "edit-selected";
                }

                itemEl.className = `r20-tree-item ${itemClass}`;
                if (this.isEditMode) itemEl.draggable = true;

                itemEl.innerHTML = `
                    <div class="r20-item-left">
                        <span class="r20-item-name">${node.name}</span>
                        <span class="r20-item-rounds">${node.rounds !== null ? node.rounds + '轮' : '永久'}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `
                            <button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>
                            <button class="r20-btn-icon btn-clone-buff" title="复制副本">📋</button>
                            <button class="r20-btn-icon danger btn-node-delete" title="删除">🗑️</button>
                        ` : ""}
                    </div>
                `;

                BuffPanelDragDrop.setupItemDrag({
                    el: itemEl,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; },
                    onCrossCopy: async (draggedNode, targetNode, parentList, targetIdx) => {
                        const copyNode = {
                            id: "b_" + Date.now(),
                            type: "buff",
                            name: draggedNode.name,
                            rounds: draggedNode.rounds,
                            extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                        };
                        parentList.splice(targetIdx, 0, copyNode);
                        await this.saveTemplates(true);
                        await this.renderAllPanes();
                        this.showToast(`📋 已复制 [${copyNode.name}]`, "success");
                    },
                    onReorder: async (draggedNode, sourceList, sourceIdx, targetNode, parentList, targetIdx) => {
                        sourceList.splice(sourceIdx, 1);
                        parentList.splice(targetIdx, 0, draggedNode);
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });

                itemEl.addEventListener("click", async (e) => {
                    if (e.target.tagName === "BUTTON") return;
                    if (this.isEditMode) {
                        if (this.editSelectedIds.has(node.id)) this.editSelectedIds.delete(node.id);
                        else this.editSelectedIds.add(node.id);
                        this.renderTemplatePane();
                        return;
                    }

                    if (selectedTokens.length > 0) {
                        const shouldApply = !isFullActive && !isPartialActive;
                        await this.toggleBuffAction(node.name, node.rounds, node.extraAttrs, shouldApply);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        this.showBuffEditorDialog(node);
                    }
                });

                if (this.isEditMode) {
                    itemEl.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.showBuffEditorDialog(node);
                    });
                    itemEl.querySelector(".btn-clone-buff")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        await this.cloneBuff(node, nodes, idx);
                    });
                    itemEl.querySelector(".btn-node-delete")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除 Buff [${node.name}] 吗？`)) {
                            nodes.splice(idx, 1);
                            await this.saveTemplates(true);
                            await this.renderTemplatePane();
                        }
                    });
                }

                container.appendChild(itemEl);
            }
        });
    }

    /**
     * 渲染当前单位生效 Buff 栏
     */
    static async renderUnitPane() {
        const treeEl = this.panelEl.querySelector(".r20-unit-tree");
        const summaryEl = this.panelEl.querySelector(".unit-pane-summary");
        if (!treeEl) return;
        treeEl.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();

        if (selectedTokens.length === 0) {
            summaryEl.textContent = "未选择棋子";
            treeEl.innerHTML = `<div class="r20-empty-placeholder">点击画布选中 1 个或多个棋子<br><span style="font-size:10px; color:#546e7a;">此处将实时展示棋子身上生效及未生效的 Buff</span></div>`;
            return;
        }

        summaryEl.textContent = selectedTokens.length === 1 ? `已选: ${selectedTokens[0].name}` : `已选中 ${selectedTokens.length} 个单位`;
        const { allBuffRows } = await this.getBuffStatsForSelected(selectedTokens);

        if (allBuffRows.length === 0) {
            treeEl.innerHTML = `<div class="r20-empty-placeholder">当前选中棋子身上暂无任何 Buff<br><span style="font-size:10px; color:#546e7a;">可点击上方模板库直接点按施加</span></div>`;
            return;
        }

        allBuffRows.forEach(item => {
            const itemEl = document.createElement("div");
            const isFullActive = item.enabledCount === selectedTokens.length;
            const isPartialActive = item.enabledCount > 0 && !isFullActive;
            const isInactive = item.enabledCount === 0;

            let itemClass = "";
            if (!this.isEditMode) {
                if (isFullActive) itemClass = "full-active";
                else if (isPartialActive) itemClass = "partial-active";
            } else if (this.editSelectedIds.has(`unit_${item.name}`)) {
                itemClass = "edit-selected";
            }

            itemEl.className = `r20-tree-item ${itemClass}`;
            if (this.isEditMode) itemEl.draggable = true;

            let statusBadge = "";
            let actionText = "";
            if (isInactive) {
                statusBadge = `<span style="font-size:10px; color:#90a4ae; background:rgba(255,255,255,0.06); padding:1px 4px; border-radius:3px;">○ 未启用</span>`;
                actionText = `<span style="font-size:10px; color:#81c784;">＋ 启用</span>`;
            } else if (isFullActive) {
                statusBadge = `<span class="r20-item-rounds">${item.rounds !== null ? item.rounds + '轮' : '永久'}</span>`;
                actionText = `<span style="font-size:10px; color:#ef5350;">✕ 解除</span>`;
            } else {
                statusBadge = `<span style="font-size:10px; color:#ffd54f;">部分(${item.enabledCount}/${selectedTokens.length})</span>`;
                actionText = `<span style="font-size:10px; color:#ef5350;">✕ 解除</span>`;
            }

            itemEl.innerHTML = `
                <div class="r20-item-left">
                    <span class="r20-item-name">${item.name}</span>
                    ${statusBadge}
                </div>
                ${this.isEditMode ? `<span style="font-size:10px; color:#ba68c8;">可拖至模板库复制</span>` : actionText}
            `;

            if (!this.isEditMode) {
                itemEl.addEventListener("click", async () => {
                    const shouldApply = isInactive;
                    await this.toggleBuffAction(item.name, item.rounds, item.extraAttrs, shouldApply);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                });
            } else {
                itemEl.addEventListener("click", () => {
                    const idKey = `unit_${item.name}`;
                    if (this.editSelectedIds.has(idKey)) this.editSelectedIds.delete(idKey);
                    else this.editSelectedIds.add(idKey);
                    this.renderUnitPane();
                });

                const nodeData = {
                    id: "unit_" + item.name,
                    name: item.name,
                    rounds: item.rounds,
                    extraAttrs: item.extraAttrs,
                    type: "buff"
                };
                BuffPanelDragDrop.setupItemDrag({
                    el: itemEl,
                    node: nodeData,
                    parentList: allBuffRows,
                    index: 0,
                    sourcePane: "unit",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; }
                });
            }

            treeEl.appendChild(itemEl);
        });
    }

    /**
     * 施加或解除指定 Buff
     */
    static async toggleBuffAction(buffName, rounds, extraAttrs, apply) {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) return;

        for (const item of selected) {
            if (apply) {
                if (item.type === "character" && item.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                } else if (item.token) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                }
            } else {
                if (item.type === "character" && item.char) {
                    const allBuffs = await Pf1eBuffManager.getAllBuffs(item.char);
                    const target = allBuffs.find(b => b.name === buffName);
                    if (target && target.rowId) {
                        await Pf1eBuffManager.removeBuff(item.char, target.rowId);
                    }
                } else if (item.token) {
                    TokenBuffManager.removeBuff(item.token, buffName);
                }
            }
        }
    }

    /**
     * 批量删除选中的项目
     */
    static async deleteSelectedBuffs() {
        if (this.editSelectedIds.size === 0) {
            this.showToast("⚠️ 请先在列表中点击要删除的项目（高亮选中）", "warn");
            return;
        }

        if (!confirm(`确定要批量删除选中的 ${this.editSelectedIds.size} 个项目吗？`)) return;

        const removeRecursive = (list) => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (this.editSelectedIds.has(list[i].id)) {
                    list.splice(i, 1);
                } else if (list[i].children) {
                    removeRecursive(list[i].children);
                }
            }
        };

        removeRecursive(this.templates);
        this.editSelectedIds.clear();
        await this.saveTemplates(true);
        await this.renderAllPanes();
        this.showToast("🗑️ 批量删除成功", "success");
    }

    /**
     * 复制一个 Buff 模板
     */
    static async cloneBuff(node, list, index) {
        const clone = {
            id: "b_" + Date.now(),
            type: "buff",
            name: `${node.name} (副本)`,
            rounds: node.rounds,
            extraAttrs: node.extraAttrs ? JSON.parse(JSON.stringify(node.extraAttrs)) : null
        };
        list.splice(index + 1, 0, clone);
        await this.saveTemplates(true);
        await this.renderTemplatePane();
    }

    /**
     * 新建文件夹
     */
    static async showNewFolderDialog() {
        const name = prompt("请输入新文件夹名称:");
        if (!name || !name.trim()) return;

        this.templates.push({
            id: "f_" + Date.now(),
            type: "folder",
            name: name.trim(),
            collapsed: false,
            children: []
        });
        await this.saveTemplates(true);
        await this.renderTemplatePane();
    }

    /**
     * 新建/编辑 Buff 弹窗
     */
    static showBuffEditorDialog(existingNode = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null && existingNode.rounds !== undefined ? existingNode.rounds : "";
        const currentJson = isEditing && existingNode.extraAttrs ? JSON.stringify(existingNode.extraAttrs, null, 2) :
`{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        mask.innerHTML = BuffPanelTemplates.getBuffEditorModalHTML({
            isEditing,
            currentName,
            currentRounds,
            currentJson
        });

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) { alert("请输入 Buff 名称"); return; }

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try { extraAttrs = JSON.parse(jsonText); }
                catch (err) { alert("JSON 细目格式错误:\n" + err.message); return; }
            }

            if (isEditing) {
                existingNode.name = name;
                existingNode.rounds = rounds;
                existingNode.extraAttrs = extraAttrs;
            } else {
                this.templates.push({
                    id: "b_" + Date.now(),
                    type: "buff",
                    name,
                    rounds,
                    extraAttrs
                });
            }

            const saved = await this.saveTemplates(true);
            if (saved) {
                await this.renderTemplatePane();
                mask.remove();
                this.showToast(`✅ 已保存 Buff [${name}] 到战役原生角色卡`, "success");
            }
        });
    }

    /**
     * 从角色卡导入 Buff 弹窗
     */
    static async showImportFromCharacterDialog() {
        const selected = this.getSelectedTokens();
        let character = null;

        if (selected.length > 0) {
            const charItem = selected.find(s => s.type === "character" && s.char);
            if (charItem) character = charItem.char;
        }

        if (!character) {
            if (!window.Campaign || !window.Campaign.characters || window.Campaign.characters.length === 0) {
                this.showToast("⚠️ 战役中暂无可用的角色卡", "warn");
                return;
            }
            character = window.Campaign.characters.at(0);
        }

        await Roll20Bridge.ensureCharacterAttributes(character);
        const cardBuffs = await Pf1eBuffManager.getAllBuffs(character);

        if (cardBuffs.length === 0) {
            this.showToast(`ℹ️ 角色 [${character.get("name")}] 卡上未找到任何 Buff 条目`, "warn");
            return;
        }

        const folders = [{ id: "root", name: "📁 根目录" }];
        const collectFolders = (nodes, depth = 0) => {
            nodes.forEach(n => {
                if (n.type === "folder") {
                    folders.push({ id: n.id, name: `${"　".repeat(depth + 1)}📁 ${n.name}`, ref: n });
                    if (n.children) collectFolders(n.children, depth + 1);
                }
            });
        };
        collectFolders(this.templates);

        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";
        mask.innerHTML = BuffPanelTemplates.getImportModalHTML({
            charName: character.get("name"),
            folders,
            cardBuffs
        });

        document.body.appendChild(mask);
        mask.querySelector(".cb-import-select-all").addEventListener("change", (e) => {
            const checked = e.target.checked;
            mask.querySelectorAll(".cb-import-item").forEach(cb => cb.checked = checked);
        });

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-confirm-import").addEventListener("click", async () => {
            const checkedBoxes = Array.from(mask.querySelectorAll(".cb-import-item:checked"));
            if (checkedBoxes.length === 0) { alert("请先勾选至少一个要导入的 Buff 条目"); return; }

            const targetFolderId = mask.querySelector(".select-target-folder").value;
            let targetList = this.templates;

            if (targetFolderId !== "root") {
                const targetObj = folders.find(f => f.id === targetFolderId);
                if (targetObj && targetObj.ref) {
                    targetObj.ref.children = targetObj.ref.children || [];
                    targetList = targetObj.ref.children;
                }
            }

            checkedBoxes.forEach(cb => {
                const idx = parseInt(cb.dataset.idx, 10);
                const b = cardBuffs[idx];
                targetList.push({
                    id: "b_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                    type: "buff",
                    name: b.name,
                    rounds: b.rounds,
                    extraAttrs: b.extraAttrs
                });
            });

            await this.saveTemplates(true);
            await this.renderTemplatePane();
            mask.remove();
            this.showToast(`🎉 已成功导入 ${checkedBoxes.length} 项 Buff！`, "success");
        });
    }

    /**
     * 保存模板
     */
    static async saveTemplates(promptIfMissing = false) {
        return await SuiteConfigStore.saveTemplates(this.templates, promptIfMissing);
    }

    static collectFolderBuffNames(folder) {
        const names = [];
        const walk = (nodes) => {
            nodes.forEach(n => {
                if (n.type === "buff") names.push(n.name);
                else if (n.children) walk(n.children);
            });
        };
        walk(folder.children || []);
        return names;
    }

    static findBuffNodeByName(container, name) {
        let found = null;
        const walk = (nodes) => {
            for (const n of nodes) {
                if (found) return;
                if (n.type === "buff" && n.name === name) { found = n; return; }
                if (n.children) walk(n.children);
            }
        };
        walk(container.children || [container]);
        return found;
    }

    static showToast(msg, type = "info") {
        let toast = document.querySelector("#r20-toast-global");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "r20-toast-global";
            toast.className = "r20-toast";
            document.body.appendChild(toast);
        }
        toast.className = `r20-toast ${type}`;
        toast.textContent = msg;
        toast.style.display = "block";
        toast.style.opacity = "1";

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.style.display = "none", 300);
        }, 2200);
    }
}
