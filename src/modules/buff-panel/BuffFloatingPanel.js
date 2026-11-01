/**
 * BuffFloatingPanel.js
 * 状态Buff工作台主控制器（SSOT 单一真实数据源 + 宿主原生能力驱动）
 * 1. 唯一真实数据源：=== R20_SUITE_DATABASE === 角色卡，面板直接基于角色卡引用；
 * 2. 窗口拖拽直接调用宿主 jQuery UI window.$(el).draggable()；
 * 3. 树形折叠直接采用 HTML5 原生 <details><summary>，0 行手写监听；
 * 4. 垂直上下排版（上栏模板库，下栏当前单位）；
 * 5. 标题栏「✏️ 编辑」模式切换，点击整行高亮多选（彻底拔除 Checkbox）；
 * 6. 属性变动事件 + 签名心跳比对双重保障，100% 实时无感同步。
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
    static selectedNodeIds = new Set();
    static isInternalSaving = false;
    static _dbWatcherBound = false;
    static _dbSyncTimer = null;
    static _lastSignature = "";
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
        this.updateLayoutDirection();

        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            () => this.savePosition(),
            () => this.updateLayoutDirection()
        );

        this.initHoverCollapse();
        this.initSelectionListeners();
        this.initDatabaseCharacterWatcher();

        window.addEventListener("resize", () => this.updateLayoutDirection());

        // 初始渲染两栏
        await this.renderAllPanes();
        this.updateLayoutDirection();

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

        console.log("[BuffFloatingPanel] SSOT 极简工作台初始化就绪 (整行高亮多选 + 实时同步)");
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
                        <button class="r20-btn-icon danger btn-delete-selected" title="删除选中的Buff">🗑️ 批量删除</button>
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
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog(null));
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
    static async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.panelEl.classList.toggle("is-editing", this.isEditMode);
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        if (editBtn) {
            editBtn.classList.toggle("active", this.isEditMode);
            editBtn.textContent = this.isEditMode ? "🔒 完成" : "✏️ 编辑";
        }

        // 无论是进入还是退出编辑模式，始终清空多选状态与高亮
        this.selectedNodeIds.clear();
        this.updateDeleteButtonText();

        // 重新渲染全部窗口：让模板栏与单位栏同步响应编辑模式切换
        await this.renderAllPanes();

        this.showToast(this.isEditMode ? "✏️ 已进入编辑模式（点击条目高亮多选，可批量删除/编辑）" : "🔒 已退出编辑模式", "info");
    }

    /**
     * 更新批量删除按钮文本与数字
     */
    static updateDeleteButtonText() {
        const btn = this.panelEl.querySelector(".btn-delete-selected");
        if (!btn) return;
        const count = this.selectedNodeIds.size;
        btn.textContent = count > 0 ? ("🗑️ 删除选中 (" + count + ")") : "🗑️ 批量删除";
    }

    /**
     * 极简事件委托：非编辑模式直接应用；编辑模式点击整行切换高亮多选
     */
    static initPaneEvents() {
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        const unitTree = this.panelEl.querySelector(".r20-unit-tree");

        // 模板栏点击
        templateTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            if (e.target.closest(".btn-edit-buff")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const selectId = item.dataset.selectId || `t_${item.dataset.id}`;

            // 编辑模式下点击整行切换高亮多选
            if (this.isEditMode) {
                if (this.selectedNodeIds.has(selectId)) {
                    this.selectedNodeIds.delete(selectId);
                    item.classList.remove("selected");
                } else {
                    this.selectedNodeIds.add(selectId);
                    item.classList.add("selected");
                }
                this.updateDeleteButtonText();
                return;
            }

            // 非编辑模式下点击直接施加/移除
            const name = item.dataset.name;
            const rounds = item.dataset.rounds ? parseInt(item.dataset.rounds) : null;
            const extraAttrs = item._extraAttrs || null;

            await this.toggleBuffOnSelected(name, rounds, extraAttrs);
        });

        // 单位栏点击
        unitTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            if (e.target.closest(".btn-edit-buff")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const charId = item.dataset.charId;
            const buffId = item.dataset.buffId;
            const buffName = item.dataset.name;
            const tokenId = item.dataset.tokenId;
            const selectId = item.dataset.selectId;

            // 编辑模式下用于整行高亮多选（用于批量物理删除）
            if (this.isEditMode) {
                if (selectId) {
                    if (this.selectedNodeIds.has(selectId)) {
                        this.selectedNodeIds.delete(selectId);
                        item.classList.remove("selected");
                    } else {
                        this.selectedNodeIds.add(selectId);
                        item.classList.add("selected");
                    }
                    this.updateDeleteButtonText();
                }
                return;
            }

            // 非编辑模式下日常双向开关切换（已激活->关停，未激活->开启）
            if (charId && buffId) {
                const char = window.Campaign?.characters?.get(charId);
                if (char) {
                    const currentlyActive = item.classList.contains("full-active");
                    const targetState = !currentlyActive;
                    await Pf1eBuffManager.toggleBuff(char, buffId, targetState);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast(`已${targetState ? "✨ 激活" : "❌ 关停"} ${char.get("name")} 的 [${buffName}]`, "info");
                }
            } else if (tokenId && buffName) {
                const token = Roll20Bridge.getTokenGraphic(tokenId);
                if (token) {
                    TokenBuffManager.removeBuff(token, buffName);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast("已从 Token 移除 [" + buffName + "]", "info");
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
     * 调出 Buff 编辑/新建弹窗 (支持模板与角色卡原生 Buff)
     */
    static showBuffEditorDialog(existingNode = null, charTarget = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null && existingNode.rounds !== undefined ? existingNode.rounds : "";
        const currentJson = isEditing
            ? JSON.stringify(existingNode.extraAttrs || {}, null, 2)
            : `{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        const headerTitle = isEditing
            ? (charTarget ? `编辑单位 Buff: ${charTarget.get("name")}` : "编辑 Buff 模板")
            : "新建 Buff 模板";

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${headerTitle}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-buff-name" value="${currentName}" placeholder="例如: 神恩、加速术..." />

                    <label style="font-size:11px; color:#b0bec5;">持续轮数 (留空视为永久):</label>
                    <input type="number" class="r20-input-text input-buff-rounds" value="${currentRounds}" placeholder="留空或大于100视为永久" />

                    <label style="font-size:11px; color:#b0bec5;">PF1e 细目加值字典 (JSON 格式):</label>
                    <textarea class="r20-textarea-json input-buff-json">${currentJson}</textarea>
                    <span style="font-size:10px; color:#78909c;">提示: 可配置 b1_bonus, b1_bonustype, b1_val, b1_macro-text 等原生字段。</span>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

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

            this.isInternalSaving = true;
            try {
                if (isEditing) {
                    if (charTarget) {
                        // 1. 编辑角色卡身上的原生 Buff
                        const rowId = existingNode.rowId || existingNode.id;
                        await Pf1eBuffManager.updateBuffRow(charTarget, rowId, name, rounds, extraAttrs);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 " + charTarget.get("name") + " 的 Buff [" + name + "]", "success");
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        // 2. 编辑模板库中的 Buff 模板
                        const rowId = existingNode.rowId || existingNode.id;
                        await SuiteConfigStore.updateBuffInDatabase(rowId, name, rounds, extraAttrs);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 Buff 模板 [" + name + "]", "success");
                        await this.renderTemplatePane();
                    }
                } else {
                    const newRowId = await SuiteConfigStore.addBuffToDatabase(name, rounds, extraAttrs);
                    if (newRowId) {
                        this.currentTemplates.push({
                            id: newRowId,
                            rowId: newRowId,
                            type: "buff",
                            name,
                            rounds,
                            extraAttrs
                        });
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                    }
                    this.showToast("✨ 已创建 Buff [" + name + "]", "success");
                    await this.renderTemplatePane();
                }
                mask.remove();
            } finally {
                setTimeout(() => { this.isInternalSaving = false; }, 300);
            }
        });
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
     * 全域原子批量物理删除选中的 Buff 条目（同时支持模板库与角色卡原生 repeating 属性彻底销毁）
     */
    static async deleteSelectedTemplates() {
        if (this.selectedNodeIds.size === 0) {
            this.showToast("⚠️ 请先在列表中点击要删除的 Buff 条目以高亮选中", "warn");
            return;
        }

        const count = this.selectedNodeIds.size;
        if (!confirm("确定要彻底销毁选中的 " + count + " 个 Buff 项吗？\n(包含角色卡身上的原生Buff也将物理彻底抹除)")) return;

        this.isInternalSaving = true;

        for (const selectId of this.selectedNodeIds) {
            if (selectId.startsWith("t_")) {
                // 模板库项: t_{rowId}
                const rowId = selectId.substring(2);
                await SuiteConfigStore.deleteBuffFromDatabase(rowId);
            } else if (selectId.startsWith("u_")) {
                // 角色卡原生 Buff: u_{charId}_{rowId}
                const raw = selectId.substring(2);
                const firstUnder = raw.indexOf("_");
                if (firstUnder !== -1) {
                    const charId = raw.substring(0, firstUnder);
                    const rowId = raw.substring(firstUnder + 1);
                    const char = window.Campaign?.characters?.get(charId);
                    if (char) {
                        await Pf1eBuffManager.deleteBuffRowPermanently(char, rowId);
                    }
                }
            } else if (selectId.startsWith("k_")) {
                // 野怪 Token 项: k_{tokenId}_{buffName}
                const raw = selectId.substring(2);
                const firstUnder = raw.indexOf("_");
                if (firstUnder !== -1) {
                    const tokenId = raw.substring(0, firstUnder);
                    const buffName = decodeURIComponent(raw.substring(firstUnder + 1));
                    const token = Roll20Bridge.getTokenGraphic(tokenId);
                    if (token) {
                        TokenBuffManager.removeBuff(token, buffName);
                    }
                }
            } else {
                // 兼容纯 rowId
                await SuiteConfigStore.deleteBuffFromDatabase(selectId);
            }
        }

        this.selectedNodeIds.clear();
        this.updateDeleteButtonText();
        this.isInternalSaving = false;

        await this.renderAllPanes();
        await Pf1eBuffUI.refreshAllBadges();
        this.showToast("🗑️ 已彻底物理销毁 " + count + " 项 Buff", "success");
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
                const rowId = node.rowId || node.id;
                const selectId = `t_${rowId}`;
                const stat = activeStats.get(node.name);
                // 编辑模式下不渲染 Token 激活态高亮，确保编辑视图纯净无干扰
                const isFull = !this.isEditMode && selectedTokens.length > 0 && stat && stat.count === stat.total;
                const isPartial = !this.isEditMode && selectedTokens.length > 0 && stat && stat.count > 0 && !isFull;
                const isSelected = this.isEditMode && (this.selectedNodeIds.has(selectId) || this.selectedNodeIds.has(rowId));

                const item = document.createElement("div");
                item.className = "r20-tree-item" + 
                    (isSelected ? " selected" : "") +
                    (isFull ? " full-active" : isPartial ? " partial-active" : "");
                item.dataset.name = node.name;
                item.dataset.id = rowId;
                item.dataset.selectId = selectId;
                if (node.rounds) item.dataset.rounds = node.rounds;
                item._extraAttrs = node.extraAttrs || null;
                item.draggable = true;

                const roundsText = (node.rounds !== null && node.rounds !== undefined && node.rounds !== "") ? (node.rounds + "轮") : "永久";

                item.innerHTML = `
                    <div class="r20-item-left">
                        <span class="r20-item-name">${node.name}</span>
                        <span class="r20-item-rounds">${roundsText}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                    </div>
                `;

                if (this.isEditMode) {
                    item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.showBuffEditorDialog(node);
                    });
                }

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
     * 渲染右侧单位栏（按 Token 原生 details 分组，直观对称，严格权限过滤）
     */
    static async renderUnitPane() {
        const container = this.panelEl.querySelector(".r20-unit-tree");
        if (!container) return;

        const allSelectedTokens = this.getSelectedTokens();
        if (allSelectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder">未选中任何地图单位<br>在画布上点击或多选 Token</div>';
            return;
        }

        // 严格权限过滤：非 GM 玩家只能查看和操作自己拥有控制权的 Token
        const selectedTokens = allSelectedTokens.filter(t => Roll20Bridge.canControlToken(t.token));

        if (selectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder" style="color:#ef5350;">🔒 无控制权限<br>仅能查看受控角色或伙伴的 Buff</div>';
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
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(卡上暂无配置Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        const isEnabled = !!b.enabled;
                        const selectId = `u_${char.id}_${b.rowId}`;
                        const isSelected = this.isEditMode && this.selectedNodeIds.has(selectId);

                        item.className = "r20-tree-item" + 
                            (isSelected ? " selected" : "") +
                            (isEnabled ? " full-active" : " is-inactive");
                        item.dataset.charId = char.id;
                        item.dataset.buffId = b.rowId;
                        item.dataset.selectId = selectId;
                        item.dataset.name = b.name;
                        item.title = this.isEditMode ? "编辑模式: 点击选中/取消选中" : (isEnabled ? "已激活，点击关停" : "未激活，点击开启");
                        item.draggable = true;

                        const roundsText = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? (b.rounds + "轮") : "永久";
                        const statusBadge = isEnabled
                            ? `<span class="r20-item-rounds" style="color:#90caf9;">${roundsText}</span>`
                            : `<span class="r20-item-rounds" style="color:#78909c;">未激活</span>`;

                        item.innerHTML = `
                            <div class="r20-item-left">
                                <span class="r20-item-name">${b.name}</span>
                                ${statusBadge}
                            </div>
                            <div class="r20-item-actions">
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                            </div>
                        `;

                        if (this.isEditMode) {
                            item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.showBuffEditorDialog(b, char);
                            });
                        }

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
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                                if (newRowId) {
                                    await this.renderTemplatePane();
                                }
                            }
                        });
                    });
                }
            } else if (tokenItem.token) {
                const buffs = TokenBuffManager.getTokenBuffs(tokenItem.token);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(暂无激活Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        const selectId = `k_${tokenItem.token.id}_${encodeURIComponent(b.name)}`;
                        const isSelected = this.isEditMode && this.selectedNodeIds.has(selectId);

                        item.className = "r20-tree-item full-active" + (isSelected ? " selected" : "");
                        item.dataset.tokenId = tokenItem.token.id;
                        item.dataset.name = b.name;
                        item.dataset.selectId = selectId;
                        item.title = this.isEditMode ? "编辑模式: 点击选中/取消选中" : "已激活，点击移除";
                        item.draggable = true;

                        const roundsText = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? (b.rounds + "轮") : "永久";

                        item.innerHTML = `
                            <div class="r20-item-left">
                                <span class="r20-item-name">${b.name}</span>
                                <span class="r20-item-rounds" style="color:#90caf9;">${roundsText}</span>
                            </div>
                            <div class="r20-item-actions">
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                            </div>
                        `;

                        if (this.isEditMode) {
                            item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.showBuffEditorDialog(b, null);
                            });
                        }

                        content.appendChild(item);

                        BuffPanelDragDrop.setupItemDrag({
                            el: item,
                            node: b,
                            parentList: null,
                            index: 0,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                                if (newRowId) {
                                    await this.renderTemplatePane();
                                }
                            }
                        });
                    });
                }
            } else {
                content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(无关联数据)</div>';
            }

            // 支持从模板库拖拽至单位分组直接施加 Buff
            details.addEventListener("dragover", (e) => {
                const dragged = this._draggedContext;
                if (dragged && dragged.sourcePane === "template") {
                    e.preventDefault();
                    details.classList.add("r20-drag-container-over");
                }
            });
            details.addEventListener("dragleave", (e) => {
                if (!details.contains(e.relatedTarget)) {
                    details.classList.remove("r20-drag-container-over");
                }
            });
            details.addEventListener("drop", async (e) => {
                const dragged = this._draggedContext;
                if (dragged && dragged.sourcePane === "template") {
                    e.preventDefault();
                    details.classList.remove("r20-drag-container-over");
                    const node = dragged.node;
                    if (char) {
                        await Pf1eBuffManager.applyOrRefreshBuff(char, node.name, node.rounds, node.extraAttrs);
                    } else if (tokenItem.token) {
                        TokenBuffManager.applyOrRefreshBuff(tokenItem.token, node.name, node.rounds, node.extraAttrs);
                    }
                    this._draggedContext = null;
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast(`✨ 已为 [${tokenName}] 施加 Buff [${node.name}]`, "success");
                }
            });

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
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                } else {
                    const buffs = await Pf1eBuffManager.getAllBuffs(item.char);
                    const b = buffs.find(x => x.name === buffName && x.enabled);
                    if (b) {
                        await Pf1eBuffManager.removeBuff(item.char, b.rowId);
                    }
                }
            } else if (item.token) {
                if (shouldApply) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                } else {
                    TokenBuffManager.removeBuff(item.token, buffName);
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
            let activeBuffs = [];
            if (item.char) {
                activeBuffs = await Pf1eBuffManager.getActiveBuffs(item.char);
            } else if (item.token) {
                activeBuffs = TokenBuffManager.getTokenBuffs(item.token);
            }
            activeBuffs.forEach(b => {
                const cur = activeStats.get(b.name) || { count: 0, total: selectedTokens.length };
                cur.count++;
                activeStats.set(b.name, cur);
            });
        }
        return { activeStats };
    }

    /**
     * 监听数据库角色卡属性变动（事件绑定 + 签名比对双重保障）
     */
    static initDatabaseCharacterWatcher() {
        if (this._dbWatcherBound) return;
        this._dbWatcherBound = true;

        const attachToChar = (char) => {
            if (!char) return;

            const bindEvents = () => {
                if (!char.attribs) return;
                char.attribs.on("add change remove reset", () => {
                    if (this.isInternalSaving) return;
                    if (this._dbSyncTimer) clearTimeout(this._dbSyncTimer);
                    this._dbSyncTimer = setTimeout(async () => {
                        if (this.isInternalSaving) return;
                        await this.renderTemplatePane();
                    }, 150);
                });
            };

            bindEvents();
            if (typeof char.connectAttributesAndAbilities === "function" && (!char.attribs || char.attribs.length === 0)) {
                char.connectAttributesAndAbilities().then(() => bindEvents());
            }
        };

        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) attachToChar(dbChar);

        if (window.Campaign?.characters) {
            window.Campaign.characters.on("add", (c) => {
                if (c.get("name") === SuiteConfigStore.DATABASE_CHARACTER_NAME) attachToChar(c);
            });
        }

        // 双重保障守护心跳：每 1.2 秒比对一次卡上 repeating_buff2 签名，确保跨 iframe 或外部变更 100% 自动无缝感知
        setInterval(async () => {
            if (this.isInternalSaving) return;
            const targetChar = SuiteConfigStore.findDatabaseCharacter();
            if (!targetChar || !targetChar.attribs) return;

            const buffAttrs = targetChar.attribs.models.filter(a => {
                const n = a.get("name") || "";
                return n.startsWith("repeating_buff2_") && (n.endsWith("_name") || n.endsWith("_rounds"));
            });

            const sig = buffAttrs.map(a => a.get("name") + "=" + a.get("current")).sort().join(";");
            if (sig !== this._lastSignature) {
                if (this._lastSignature !== "") {
                    console.log("[BuffFloatingPanel] 检测到角色卡数据变动，触发自愈刷新...");
                    await this.renderTemplatePane();
                }
                this._lastSignature = sig;
            }
        }, 1200);
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

        // 只要标题栏处于屏幕下半区，为了防止内容向下溢出视口，始终向上展开
        if (headerTop > windowHeight / 2) {
            this.panelEl.classList.remove("direction-down");
            this.panelEl.classList.add("direction-up");
        } else {
            this.panelEl.classList.remove("direction-up");
            this.panelEl.classList.add("direction-down");
        }
    }

    /**
     * 恢复持久化位置并立即更新生长朝向
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
        this.updateLayoutDirection();
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
