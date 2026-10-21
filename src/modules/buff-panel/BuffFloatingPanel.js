/**
 * BuffFloatingPanel.js
 * 状态Buff工作台主控制器（SSOT 单一真实数据源 + 宿主原生能力驱动）
 * 1. 唯一真实数据源：=== R20_SUITE_DATABASE === 角色卡，面板直接基于角色卡引用，绝无独立脱节内存变量；
 * 2. 窗口拖拽直接调用宿主 jQuery UI window.$(el).draggable()；
 * 3. 树形折叠直接采用 HTML5 原生 <details><summary>，0 行手写监听；
 * 4. 垂直上下排版（上栏模板库，下栏当前单位）；
 * 5. 标题栏「✏️ 编辑」模式切换，进入后才展示工具栏与复选框；
 * 6. 增删均采用原子操作，杜绝全量覆盖与误杀。
 */
import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";
import { BuffPanelStyles } from "./BuffPanelStyles.js";
import { BuffPanelDragDrop } from "./BuffPanelDragDrop.js";

export class BuffFloatingPanel {
    static POS_KEY = "r20_suite_buff_panel_pos";
    static PIN_KEY = "r20_suite_buff_panel_pinned";

    static panelEl = null;
    static isPinned = false;
    static isCollapsed = false;
    static isEditMode = false;
    static currentTemplates = [];
    static isInternalSaving = false;
    static _dbWatcherBound = false;
    static _dbSyncTimer = null;
    static _draggedContext = null;
    static _lastSelectedIdsStr = "";

    /**
     * 初始化悬浮面板
     */
    static async init() {
        BuffPanelStyles.inject();
        this.createPanelDOM();

        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.updatePinState();

        this.restorePanelPosition();

        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            () => this.savePosition(),
            () => this.updateLayoutDirection()
        );

        this.initHoverCollapse();
        this.initSelectionListeners();
        this.initDatabaseCharacterWatcher();

        // 初始渲染两栏
        await this.renderAllPanes();

        // 绑定底部放置兜底（移动至根目录）
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        BuffPanelDragDrop.setupTreeContainerDrop({
            el: templateTree,
            getDraggedContext: () => this._draggedContext,
            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
            onCrossCopyRoot: async (draggedNode) => {
                await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                await this.renderTemplatePane();
            },
            onReorderRoot: async (draggedNode, sourceList, sourceIdx) => {
                sourceList.splice(sourceIdx, 1);
                this.currentTemplates.push(draggedNode);
                await SuiteConfigStore.saveTopology(this.currentTemplates);
                await this.renderTemplatePane();
            }
        });

        console.log("[BuffFloatingPanel] SSOT 极简工作台初始化就绪");
    }

    /**
     * 构建面板主 DOM (垂直上下双栏排版)
     */
    static createPanelDOM() {
        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";
        panel.className = "direction-down";

        panel.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff工作台</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-pin" title="固定面板">📌</button>
                    <button class="r20-btn-icon btn-toggle-edit" title="进入编辑模式">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="折叠/展开">-</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <div class="r20-panel-content">
                    <div class="r20-panel-toolbar">
                        <button class="r20-btn-icon btn-refresh-templates" title="刷新模板">🔄 刷新</button>
                        <button class="r20-btn-icon btn-new-buff" title="新建Buff">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建目录">+ 目录</button>
                        <button class="r20-btn-icon btn-open-sheet" title="在官方角色卡中配置加值">📋 角色卡</button>
                        <button class="r20-btn-icon danger btn-delete-selected" title="删除勾选的Buff">🗑️ 删除选中</button>
                    </div>
                    <div class="r20-panel-panes">
                        <div class="r20-pane r20-template-pane">
                            <div class="r20-pane-header">
                                <span>📚 Buff 模板库</span>
                            </div>
                            <div class="r20-tree-container r20-template-tree"></div>
                        </div>
                        <div class="r20-pane r20-unit-pane">
                            <div class="r20-pane-header">
                                <span>🎯 选中单位 Buff</span>
                            </div>
                            <div class="r20-tree-container r20-unit-tree"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="r20-toast" id="r20-buff-toast"></div>
        `;

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 绑定顶部控制
        panel.querySelector(".btn-toggle-pin").addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());

        // 绑定工具栏
        panel.querySelector(".btn-refresh-templates").addEventListener("click", () => this.renderTemplatePane(true));
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.createBuffPrompt());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.createFolderPrompt());
        panel.querySelector(".btn-open-sheet").addEventListener("click", () => this.openDatabaseSheet());
        panel.querySelector(".btn-delete-selected").addEventListener("click", () => this.deleteSelectedTemplates());

        // 双栏事件委托监听
        this.initPaneEvents();
        this.updateLayoutDirection();
    }

    /**
     * 切换编辑模式
     */
    static toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.panelEl.classList.toggle("is-editing", this.isEditMode);
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        if (editBtn) {
            editBtn.classList.toggle("active", this.isEditMode);
            editBtn.textContent = this.isEditMode ? "🔒 完成" : "✏️ 编辑";
        }
        this.showToast(this.isEditMode ? "✏️ 已进入编辑模式（可勾选删除/新增）" : "🔒 已退出编辑模式", "info");
    }

    /**
     * 极简事件委托：非编辑模式直接应用；编辑模式点击切换勾选
     */
    static initPaneEvents() {
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        const unitTree = this.panelEl.querySelector(".r20-unit-tree");

        // 模板栏点击
        templateTree.addEventListener("click", async (e) => {
            if (e.target.classList.contains("r20-cb-select") || e.target.closest("summary")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            // 编辑模式下点击整行切换勾选
            if (this.isEditMode) {
                const cb = item.querySelector(".r20-cb-select");
                if (cb && e.target !== cb) {
                    cb.checked = !cb.checked;
                }
                return;
            }

            // 非编辑模式下点击直接施加/移除
            const name = item.dataset.name;
            const rounds = item.dataset.rounds ? parseInt(item.dataset.rounds) : null;
            const extraAttrs = item._extraAttrs || null;

            await this.toggleBuffOnSelected(name, rounds, extraAttrs);
        });

        // 单位栏点击（点击从单位身上移除）
        unitTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const charId = item.dataset.charId;
            const buffName = item.dataset.name;

            if (charId && buffName) {
                const char = window.Campaign?.characters?.get(charId);
                if (char) {
                    await TokenBuffManager.removeBuff(char, buffName);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast("已从 " + char.get("name") + " 移除 " + buffName, "info");
                }
            }
        });
    }

    /**
     * 调起官方角色卡窗口进行原汁原味的加值配置
     */
    static openDatabaseSheet() {
        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) {
            const ok = Roll20Bridge.openCharacterSheet(dbChar.id);
            if (ok) {
                this.showToast("📋 已调起 === R20_SUITE_DATABASE === 角色卡", "success");
            } else {
                this.showToast("⚠️ 无法在 Journal 中定位到数据库卡", "warn");
            }
        } else {
            this.showToast("⚠️ 未找到战役数据库角色卡", "warn");
        }
    }

    /**
     * 原子创建 Buff（直接在角色卡上新建，绝无中间变量覆盖）
     */
    static async createBuffPrompt() {
        const name = prompt("请输入 Buff 名称:");
        if (!name || !name.trim()) return;

        const roundsInput = prompt("请输入持续轮数 (留空为永久):", "");
        let rounds = null;
        if (roundsInput && !isNaN(parseInt(roundsInput))) {
            rounds = parseInt(roundsInput);
        }

        const defaultExtraAttrs = {
            bufftype: "spell",
            "b1-show": 1,
            b1_bonus: "attack",
            b1_bonustype: "luck",
            b1_val: 1
        };

        const rowId = await SuiteConfigStore.addBuffToDatabase(name.trim(), rounds, defaultExtraAttrs);
        if (rowId) {
            await this.renderTemplatePane();
            this.showToast("✨ Buff [" + name.trim() + "] 已在角色卡上原子创建成功", "success");
        } else {
            this.showToast("⚠️ 创建 Buff 失败，请确保战役配置卡存在", "warn");
        }
    }

    /**
     * 极简新建目录（保存至拓扑属性）
     */
    static async createFolderPrompt() {
        const folderName = prompt("请输入新目录名称:");
        if (!folderName || !folderName.trim()) return;

        this.currentTemplates.push({
            id: "f_" + Math.random().toString(36).substr(2, 6),
            type: "folder",
            name: folderName.trim(),
            children: []
        });

        await SuiteConfigStore.saveTopology(this.currentTemplates);
        await this.renderTemplatePane();
        this.showToast("📁 目录 [" + folderName.trim() + "] 创建成功", "success");
    }

    /**
     * 原子批量删除选中的 Buff 条目（直接从卡上物理销毁，绝无复活可能）
     */
    static async deleteSelectedTemplates() {
        const checkboxes = Array.from(this.panelEl.querySelectorAll(".r20-template-tree .r20-cb-select:checked"));
        if (checkboxes.length === 0) {
            this.showToast("⚠️ 请先勾选要删除的 Buff 条目", "warn");
            return;
        }

        if (!confirm("确定要彻底销毁选中的 " + checkboxes.length + " 个 Buff 项吗？")) return;

        this.isInternalSaving = true;

        for (const cb of checkboxes) {
            const rowId = cb.value;
            await SuiteConfigStore.deleteBuffFromDatabase(rowId);
        }

        this.isInternalSaving = false;
        await this.renderTemplatePane();
        this.showToast("🗑️ 已彻底销毁 " + checkboxes.length + " 项原生 Buff", "success");
    }

    /**
     * 渲染全部窗格
     */
    static async renderAllPanes() {
        await this.renderTemplatePane();
        await this.renderUnitPane();
    }

    /**
     * 渲染模板库（现场从角色卡直接读取，SSOT 单一真实源）
     */
    static async renderTemplatePane(showNotice = false) {
        const container = this.panelEl.querySelector(".r20-template-tree");
        if (!container) return;

        try {
            // 直接现场读取角色卡最新数据
            const templates = await SuiteConfigStore.loadTemplates();
            this.currentTemplates = templates;

            if (templates.length === 0) {
                container.innerHTML = '<div class="r20-empty-placeholder">暂无模板数据<br>点击上方「✏️ 编辑」再点「+ Buff」新建</div>';
                return;
            }

            const selectedTokens = this.getSelectedTokens();
            const { activeStats } = await this.getBuffStatsForSelected(selectedTokens);

            container.innerHTML = "";
            this.renderTemplateNodes(templates, container, activeStats, selectedTokens);

            if (showNotice) this.showToast("🔄 模板库已与原生卡完全同步", "success");
        } catch (e) {
            console.error("[BuffFloatingPanel] 渲染模板库异常:", e);
        }
    }

    /**
     * 递归将具名字典树渲染为原生 details/summary DOM
     */
    static renderTemplateNodes(nodes, container, activeStats, selectedTokens) {
        nodes.forEach((node, idx) => {
            if (node.type === "folder") {
                const details = document.createElement("details");
                details.className = "r20-group";
                details.open = true;

                const summary = document.createElement("summary");
                summary.innerHTML = "<span>📁 " + node.name + "</span>";
                details.appendChild(summary);

                const groupContent = document.createElement("div");
                groupContent.className = "r20-group-content";

                if (node.children && node.children.length > 0) {
                    this.renderTemplateNodes(node.children, groupContent, activeStats, selectedTokens);
                }
                details.appendChild(groupContent);
                container.appendChild(details);

                // 挂载文件夹拖拽支持
                BuffPanelDragDrop.setupItemDrag({
                    el: details,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedContext,
                    setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                    onReorder: async (draggedNode, srcList, srcIdx, targetNode, tgtList, tgtIdx, isPeer) => {
                        srcList.splice(srcIdx, 1);
                        if (isPeer) {
                            tgtList.splice(tgtIdx, 0, draggedNode);
                        } else {
                            if (!targetNode.children) targetNode.children = [];
                            targetNode.children.push(draggedNode);
                        }
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                        await this.renderTemplatePane();
                    }
                });
            } else {
                const stat = activeStats.get(node.name);
                const isFull = selectedTokens.length > 0 && stat && stat.count === stat.total;
                const isPartial = selectedTokens.length > 0 && stat && stat.count > 0 && !isFull;

                const item = document.createElement("div");
                item.className = "r20-tree-item" + (isFull ? " full-active" : isPartial ? " partial-active" : "");
                item.dataset.name = node.name;
                item.dataset.id = node.id || node.rowId;
                if (node.rounds) item.dataset.rounds = node.rounds;
                item._extraAttrs = node.extraAttrs || null;
                item.draggable = true;

                const roundsText = (node.rounds !== null && node.rounds !== undefined && node.rounds !== "") ? (node.rounds + "轮") : "永久";
                const rowId = node.rowId || node.id;

                item.innerHTML = `
                    <label class="r20-item-label" title="${node.name}">
                        <input type="checkbox" class="r20-cb-select" value="${rowId}">
                        <span class="r20-item-name">${node.name}</span>
                    </label>
                    <span class="r20-item-rounds">${roundsText}</span>
                `;

                container.appendChild(item);

                // 挂载条目拖拽支持
                BuffPanelDragDrop.setupItemDrag({
                    el: item,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedContext,
                    setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                    onReorder: async (draggedNode, srcList, srcIdx, targetNode, tgtList, tgtIdx) => {
                        srcList.splice(srcIdx, 1);
                        tgtList.splice(tgtIdx, 0, draggedNode);
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                        await this.renderTemplatePane();
                    }
                });
            }
        });
    }

    /**
     * 渲染右侧单位栏（按 Token 原生 details 分组，直观对称）
     */
    static async renderUnitPane() {
        const container = this.panelEl.querySelector(".r20-unit-tree");
        if (!container) return;

        const selectedTokens = this.getSelectedTokens();
        if (selectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder">未选中任何地图单位<br>在画布上点击或多选 Token</div>';
            return;
        }

        container.innerHTML = "";

        for (const tokenItem of selectedTokens) {
            const char = tokenItem.char;
            const tokenName = tokenItem.token?.get("name") || char?.get("name") || "未命名单位";

            const details = document.createElement("details");
            details.className = "r20-group";
            details.open = true;

            const summary = document.createElement("summary");
            summary.innerHTML = "<span>🛡️ " + tokenName + "</span>";
            details.appendChild(summary);

            const content = document.createElement("div");
            content.className = "r20-group-content";

            if (char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(char);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(暂无Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        item.className = "r20-tree-item";
                        item.dataset.charId = char.id;
                        item.dataset.buffId = b.id;
                        item.dataset.name = b.name;
                        item.title = "点击从单位身上移除";
                        item.draggable = true;

                        const roundsText = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? (b.rounds + "轮") : "永久";

                        item.innerHTML = `
                            <span class="r20-item-name">${b.name}</span>
                            <span class="r20-item-rounds" style="color:#ef5350;">${roundsText} ×</span>
                        `;

                        content.appendChild(item);

                        // 支持从单位栏反向拖拽至模板库另存为模板
                        BuffPanelDragDrop.setupItemDrag({
                            el: item,
                            node: b,
                            parentList: null,
                            index: 0,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onCrossCopy: async (draggedNode, targetNode, parentList, idx) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                                if (newRowId) {
                                    await this.renderTemplatePane();
                                }
                            }
                        });
                    });
                }
            } else {
                content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(无关联人物卡)</div>';
            }

            details.appendChild(content);
            container.appendChild(details);
        }
    }

    /**
     * 为选中的单位批量施加或移除 Buff
     */
    static async toggleBuffOnSelected(buffName, rounds, extraAttrs) {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) {
            this.showToast("⚠️ 请先在画布上选择目标 Token", "warn");
            return;
        }

        const { activeStats } = await this.getBuffStatsForSelected(selected);
        const stat = activeStats.get(buffName);
        const isFull = stat && stat.count === stat.total;
        const shouldApply = !isFull;

        for (const item of selected) {
            if (item.char) {
                if (shouldApply) {
                    await TokenBuffManager.applyBuff(item.char, buffName, rounds, extraAttrs);
                } else {
                    await TokenBuffManager.removeBuff(item.char, buffName);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        await this.renderAllPanes();
        this.showToast((shouldApply ? "✨ 施加" : "❌ 移除") + " Buff [" + buffName + "]", "success");
    }

    /**
     * 统计当前选中 Token 对特定 Buff 的激活覆盖率
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        if (selectedTokens.length === 0) return { activeStats };

        for (const item of selectedTokens) {
            if (item.char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(item.char);
                buffs.forEach(b => {
                    const cur = activeStats.get(b.name) || { count: 0, total: selectedTokens.length };
                    cur.count++;
                    activeStats.set(b.name, cur);
                });
            }
        }
        return { activeStats };
    }

    /**
     * 监听数据库角色卡属性变动（实时双向联动）
     */
    static initDatabaseCharacterWatcher() {
        if (this._dbWatcherBound) return;
        this._dbWatcherBound = true;

        const attachToChar = (char) => {
            if (!char) return;
            const bind = () => {
                if (!char.attribs) return;
                char.attribs.on("add change remove reset", () => {
                    if (this.isInternalSaving) return;
                    if (this._dbSyncTimer) clearTimeout(this._dbSyncTimer);
                    this._dbSyncTimer = setTimeout(async () => {
                        if (this.isInternalSaving) return;
                        await this.renderTemplatePane();
                    }, 200);
                });
            };

            bind();
            if (typeof char.connectAttributesAndAbilities === "function" && (!char.attribs || char.attribs.length === 0)) {
                char.connectAttributesAndAbilities().then(() => bind());
            }
        };

        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) attachToChar(dbChar);

        if (window.Campaign?.characters) {
            window.Campaign.characters.on("add", (c) => {
                if (c.get("name") === SuiteConfigStore.DATABASE_CHARACTER_NAME) attachToChar(c);
            });
        }
    }

    /**
     * 选区变动监听
     */
    static initSelectionListeners() {
        const checkChanged = () => {
            const tokens = this.getSelectedTokens();
            const idsStr = tokens.map(t => t.token?.id || t.char?.id || t.name).sort().join(",");
            if (idsStr !== this._lastSelectedIdsStr) {
                this._lastSelectedIdsStr = idsStr;
                this.renderAllPanes();
            }
        };

        const engine = window.Campaign?.engine?.tabletop;
        if (engine && typeof engine.on === "function") {
            engine.on("selection:change", checkChanged);
        }

        window.addEventListener("selectionchange", checkChanged);
        document.addEventListener("selectionchange", checkChanged);
        setInterval(checkChanged, 600);
    }

    /**
     * 提取当前画布选中的 Token 与角色模型
     */
    static getSelectedTokens() {
        const result = [];
        const seen = new Set();
        const tt = window.Campaign?.engine?.tabletop;

        if (tt && typeof tt.getSelection === "function") {
            const selection = tt.getSelection() || [];
            for (const item of selection) {
                const tokenId = item.id;
                if (!tokenId || seen.has(tokenId)) continue;
                seen.add(tokenId);

                const tokenModel = item.model || Roll20Bridge.getTokenGraphic(tokenId);
                if (tokenModel) {
                    const charId = tokenModel.get("represents");
                    const char = charId ? window.Campaign.characters.get(charId) : null;
                    result.push({ token: tokenModel, char, name: tokenModel.get("name") || "Token" });
                }
            }
        }
        return result;
    }

    /**
     * 悬浮吸附收起与展开
     */
    static initHoverCollapse() {
        let hoverTimer = null;
        this.panelEl.addEventListener("mouseenter", () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapsed(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (!this.isPinned && !this.isCollapsed) {
                hoverTimer = setTimeout(() => {
                    if (!this.isPinned) this.setCollapsed(true);
                }, 400);
            }
        });
    }

    /**
     * 固定状态切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        this.updatePinState();
        if (this.isPinned) this.setCollapsed(false);
    }

    static updatePinState() {
        const pinBtn = this.panelEl.querySelector(".btn-toggle-pin");
        if (pinBtn) {
            pinBtn.classList.toggle("pinned", this.isPinned);
            pinBtn.title = this.isPinned ? "已固定（鼠标移开不自动收起）" : "未固定（鼠标移开后自动收起）";
        }
    }

    /**
     * 折叠/展开控制
     */
    static toggleCollapse() {
        this.setCollapsed(!this.isCollapsed);
    }

    static setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        this.panelEl.classList.toggle("is-collapsed", collapsed);
        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (minBtn) minBtn.textContent = collapsed ? "+" : "-";
        this.updateLayoutDirection();
    }

    /**
     * 根据视口边界更新向上或向下生长方向
     */
    static updateLayoutDirection() {
        if (!this.panelEl) return;
        const rect = this.panelEl.getBoundingClientRect();
        const headerTop = rect.top;
        const windowHeight = window.innerHeight;

        if (headerTop > windowHeight / 2 && (windowHeight - headerTop < 380)) {
            this.panelEl.classList.remove("direction-down");
            this.panelEl.classList.add("direction-up");
        } else {
            this.panelEl.classList.remove("direction-up");
            this.panelEl.classList.add("direction-down");
        }
    }

    /**
     * 恢复持久化位置
     */
    static restorePanelPosition() {
        const saved = localStorage.getItem(this.POS_KEY);
        let left = Math.max(10, window.innerWidth - 340);
        let top = 100;

        if (saved) {
            try {
                const pos = JSON.parse(saved);
                if (pos.left !== undefined) left = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
                if (pos.top !== undefined) top = Math.max(10, Math.min(window.innerHeight - 40, pos.top));
            } catch (e) {}
        }

        this.panelEl.style.left = `${left}px`;
        this.panelEl.style.top = `${top}px`;
    }

    static savePosition() {
        const pos = { left: this.panelEl.offsetLeft, top: this.panelEl.offsetTop };
        localStorage.setItem(this.POS_KEY, JSON.stringify(pos));
        this.updateLayoutDirection();
    }

    /**
     * 简易 Toast 提示条
     */
    static showToast(msg, type = "info") {
        const toast = this.panelEl.querySelector("#r20-buff-toast");
        if (!toast) return;
        toast.textContent = msg;
        toast.className = "r20-toast " + type;
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 2500);
    }
}
