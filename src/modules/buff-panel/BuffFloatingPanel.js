import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";

/**
 * BuffFloatingPanel.js
 * 核心悬浮窗组件：支持多级目录树管理、编辑拖拽排序、收放自如、多选批量添加与纯 Token 智能适配
 */
export class BuffFloatingPanel {
    static STORAGE_KEY = "r20_buff_templates_v3";
    static POS_KEY = "r20_buff_panel_pos";

    static isEditMode = false;
    static isCollapsed = false;
    static panelEl = null;
    static templates = [];

    /**
     * 默认预设模板树（多级目录）
     */
    static defaultTemplates = [
        {
            id: "f_divine",
            type: "folder",
            name: "常用神术",
            collapsed: false,
            children: [
                { id: "b_divine_favor", type: "buff", name: "神恩", rounds: 5 },
                { id: "b_bless", type: "buff", name: "祝福术", rounds: 10 },
                { id: "b_prayer", type: "buff", name: "祈祷术", rounds: 5 },
                {
                    id: "f_high_divine",
                    type: "folder",
                    name: "高阶神术",
                    collapsed: false,
                    children: [
                        { id: "b_righteous_might", type: "buff", name: "正气如虹", rounds: 10 },
                        { id: "b_holy_aura", type: "buff", name: "圣洁灵光", rounds: 10 }
                    ]
                }
            ]
        },
        {
            id: "f_arcane",
            type: "folder",
            name: "奥术与防护",
            collapsed: false,
            children: [
                { id: "b_haste", type: "buff", name: "加速术", rounds: 10 },
                { id: "b_shield", type: "buff", name: "护盾术", rounds: 10 },
                { id: "b_barkskin", type: "buff", name: "树皮术", rounds: 100 },
                { id: "b_mage_armor", type: "buff", name: "法师护甲", rounds: 600 }
            ]
        },
        {
            id: "f_debuff",
            type: "folder",
            name: "负面与妨害",
            collapsed: false,
            children: [
                { id: "b_entangled", type: "buff", name: "纠缠", rounds: 5 },
                { id: "b_slow", type: "buff", name: "缓慢术", rounds: 10 }
            ]
        }
    ];

    /**
     * 初始化悬浮面板
     */
    static init() {
        this.loadTemplates();
        this.injectStyles();
        this.createPanelDOM();
        this.renderTree();
        this.initDragWindow();
        console.log("[BuffFloatingPanel] 悬浮面板已成功加载");
    }

    /**
     * 读取模板数据
     */
    static loadTemplates() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                this.templates = JSON.parse(raw);
            } else {
                this.templates = JSON.parse(JSON.stringify(this.defaultTemplates));
                this.saveTemplates();
            }
        } catch (e) {
            this.templates = JSON.parse(JSON.stringify(this.defaultTemplates));
        }
    }

    /**
     * 保存模板数据
     */
    static saveTemplates() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.templates));
    }

    /**
     * 屏幕底部不打扰轻量提示（Toast）
     */
    static showToast(message, type = "info") {
        let toast = document.querySelector("#r20-toast-notification");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "r20-toast-notification";
            document.body.appendChild(toast);
        }
        toast.className = `r20-toast ${type}`;
        toast.innerHTML = message;
        toast.style.display = "block";
        toast.style.opacity = "1";

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => { toast.style.display = "none"; }, 300);
        }, 2200);
    }

    /**
     * 获取画布上当前选中的所有可用棋子
     */
    static getSelectedControllableTokens() {
        if (!window.Campaign.engine || typeof window.Campaign.engine.getSelection !== "function") return [];
        const sel = window.Campaign.engine.getSelection();
        if (!Array.isArray(sel) || sel.length === 0) return [];

        const page = window.Campaign.pages.get(window.Campaign.get("playerpageid"));
        if (!page || !page.thegraphics) return [];

        const isGM = !!window.isGM;
        const myPlayerId = window.d20_player_id;
        const validTokens = [];

        for (const item of sel) {
            const tokenId = item.id;
            const token = page.thegraphics.get(tokenId);
            if (!token) continue;

            const charId = token.get("represents");
            if (charId) {
                // 有绑定人物卡
                const char = window.Campaign.characters.get(charId);
                if (char) {
                    const controlledBy = (char.get("controlledby") || "").split(",");
                    const canControl = isGM || controlledBy.includes("all") || controlledBy.includes(myPlayerId);
                    if (canControl) validTokens.push({ token, char, type: "character" });
                }
            } else {
                // 无人物卡的纯 Token（野怪）
                const controlledBy = (token.get("controlledby") || "").split(",");
                const canControl = isGM || controlledBy.includes("all") || controlledBy.includes(myPlayerId);
                if (canControl) validTokens.push({ token, char: null, type: "token" });
            }
        }

        return validTokens;
    }

    /**
     * 注入全局样式
     */
    static injectStyles() {
        if (document.querySelector("#r20-floating-panel-styles")) return;
        const style = document.createElement("style");
        style.id = "r20-floating-panel-styles";
        style.textContent = `
            #r20-buff-panel {
                position: fixed;
                top: 80px;
                right: 320px;
                width: 290px;
                background: #1a1e24;
                border: 1px solid #323d47;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                color: #eceff1;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                user-select: none;
                transition: height 0.2s ease, width 0.2s ease;
            }
            #r20-buff-panel.collapsed {
                width: auto;
                height: 36px;
                overflow: hidden;
            }
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: #232b34;
                border-bottom: 1px solid #323d47;
                cursor: grab;
                border-radius: 8px 8px 0 0;
            }
            .r20-panel-title {
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .r20-panel-controls {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .r20-btn-icon {
                background: none;
                border: none;
                color: #90a4ae;
                font-size: 13px;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 3px;
            }
            .r20-btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .r20-btn-icon.active {
                background: #1565c0;
                color: #ffffff;
            }
            .r20-panel-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #161b20;
                border-bottom: 1px solid #263238;
                font-size: 11px;
            }
            .r20-panel-tree {
                max-height: 380px;
                overflow-y: auto;
                padding: 6px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            /* 树状目录结构 */
            .r20-tree-folder {
                display: flex;
                flex-direction: column;
                margin-bottom: 2px;
            }
            .r20-folder-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 6px;
                background: #202730;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                color: #b0bec5;
                cursor: pointer;
            }
            .r20-folder-header:hover {
                background: #2a3440;
                color: #ffffff;
            }
            .r20-folder-title {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .r20-folder-children {
                margin-left: 12px;
                border-left: 1px dashed #37474f;
                padding-left: 6px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-top: 2px;
            }
            /* Buff 条目 */
            .r20-tree-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: #242c37;
                border-radius: 4px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: background 0.15s;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2e3947;
                border-color: #64b5f6;
                color: #ffffff;
            }
            .r20-item-left {
                display: flex;
                align-items: center;
                gap: 6px;
                overflow: hidden;
            }
            .r20-item-name {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
            }
            .r20-item-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            /* 底部操作区 */
            .r20-panel-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                background: #191f26;
                border-top: 1px solid #323d47;
                border-radius: 0 0 8px 8px;
            }
            .r20-btn-apply {
                background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
                color: #ffffff;
                font-size: 11px;
                font-weight: 600;
                padding: 5px 12px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
            }
            .r20-btn-apply:hover { filter: brightness(1.15); }

            /* 拖拽态高亮 */
            .r20-drag-over {
                border-top: 2px solid #64b5f6 !important;
            }
            .r20-drag-into {
                background: rgba(25, 118, 210, 0.3) !important;
            }

            /* Toast 提示 */
            .r20-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(26, 30, 36, 0.95);
                color: #ffffff;
                border: 1px solid #37474f;
                padding: 8px 18px;
                border-radius: 20px;
                font-size: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                z-index: 999999;
                pointer-events: none;
                transition: opacity 0.3s;
                display: none;
            }
            .r20-toast.warn { border-color: #ffb74d; color: #ffe082; }
            .r20-toast.success { border-color: #81c784; color: #c8e6c9; }
        `;
        document.head.appendChild(style);
    }

    /**
     * 创建悬浮面板主 DOM
     */
    static createPanelDOM() {
        if (document.querySelector("#r20-buff-panel")) return;

        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";

        // 读取持久化位置
        const savedPos = localStorage.getItem(this.POS_KEY);
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                panel.style.top = `${pos.top}px`;
                panel.style.left = `${pos.left}px`;
                panel.style.right = "auto";
            } catch (e) {}
        }

        panel.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff库</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-edit" title="打开/关闭编辑与排序模式">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="最小化收起">─</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <div class="r20-panel-toolbar" style="display: none;">
                    <span style="color:#90a4ae;">编辑模式已开启</span>
                    <div style="display:flex; gap:6px;">
                        <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                    </div>
                </div>
                <div class="r20-panel-tree"></div>
                <div class="r20-panel-footer">
                    <label style="font-size:11px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" class="cb-select-all-buffs" />
                        <span>全选</span>
                    </label>
                    <button class="r20-btn-apply btn-batch-apply">🚀 施加选中Buff</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 绑定最小化与编辑模式切换
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());

        // 绑定全选与批量施加
        panel.querySelector(".cb-select-all-buffs").addEventListener("change", (e) => {
            const checked = e.target.checked;
            panel.querySelectorAll(".r20-buff-item-cb").forEach(cb => cb.checked = checked);
        });

        panel.querySelector(".btn-batch-apply").addEventListener("click", () => this.applySelectedBuffs());

        // 编辑模式按钮
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showNewBuffDialog());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
    }

    /**
     * 最小化折叠切换
     */
    static toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        const body = this.panelEl.querySelector(".r20-panel-body");
        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (this.isCollapsed) {
            body.style.display = "none";
            this.panelEl.classList.add("collapsed");
            minBtn.textContent = "▢";
        } else {
            body.style.display = "block";
            this.panelEl.classList.remove("collapsed");
            minBtn.textContent = "─";
        }
    }

    /**
     * 编辑模式切换
     */
    static toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        const toolbar = this.panelEl.querySelector(".r20-panel-toolbar");
        if (this.isEditMode) {
            editBtn.classList.add("active");
            editBtn.textContent = "🔒 完成";
            toolbar.style.display = "flex";
        } else {
            editBtn.classList.remove("active");
            editBtn.textContent = "✏️ 编辑";
            toolbar.style.display = "none";
        }
        this.renderTree();
    }

    /**
     * 递归渲染目录树
     */
    static renderTree() {
        const treeContainer = this.panelEl.querySelector(".r20-panel-tree");
        if (!treeContainer) return;
        treeContainer.innerHTML = "";

        const renderNodes = (nodes, container) => {
            nodes.forEach((node, index) => {
                if (node.type === "folder") {
                    const folderEl = document.createElement("div");
                    folderEl.className = "r20-tree-folder";
                    folderEl.dataset.id = node.id;
                    if (this.isEditMode) folderEl.draggable = true;

                    const isClosed = !!node.collapsed;
                    folderEl.innerHTML = `
                        <div class="r20-folder-header">
                            <div class="r20-folder-title">
                                <span>${isClosed ? "▶" : "▼"}</span>
                                <span>📁 ${node.name}</span>
                            </div>
                            ${this.isEditMode ? `
                                <div class="r20-item-actions">
                                    <button class="r20-btn-icon btn-edit-folder" title="重命名">✏️</button>
                                    <button class="r20-btn-icon btn-delete-folder" title="删除目录">🗑️</button>
                                </div>
                            ` : ""}
                        </div>
                        <div class="r20-folder-children" style="display: ${isClosed ? 'none' : 'flex'};"></div>
                    `;

                    // 展开/收折文件夹
                    folderEl.querySelector(".r20-folder-title").addEventListener("click", (e) => {
                        e.stopPropagation();
                        node.collapsed = !node.collapsed;
                        this.saveTemplates();
                        this.renderTree();
                    });

                    if (this.isEditMode) {
                        folderEl.querySelector(".btn-edit-folder").addEventListener("click", (e) => {
                            e.stopPropagation();
                            const newName = prompt("重命名文件夹:", node.name);
                            if (newName && newName.trim()) {
                                node.name = newName.trim();
                                this.saveTemplates();
                                this.renderTree();
                            }
                        });

                        folderEl.querySelector(".btn-delete-folder").addEventListener("click", (e) => {
                            e.stopPropagation();
                            if (confirm(`确定删除文件夹 [${node.name}] 及其内部所有 Buff 吗？`)) {
                                this.deleteNodeById(node.id);
                                this.saveTemplates();
                                this.renderTree();
                            }
                        });

                        this.setupDragEvents(folderEl, node, nodes, index);
                    }

                    const childrenContainer = folderEl.querySelector(".r20-folder-children");
                    if (node.children && node.children.length > 0) {
                        renderNodes(node.children, childrenContainer);
                    }

                    container.appendChild(folderEl);
                } else if (node.type === "buff") {
                    const itemEl = document.createElement("div");
                    itemEl.className = "r20-tree-item";
                    itemEl.dataset.id = node.id;
                    if (this.isEditMode) itemEl.draggable = true;

                    const showRounds = node.rounds !== null && node.rounds <= 100;
                    const roundsLabel = node.rounds === null ? "常驻" : (showRounds ? `${node.rounds}轮` : "常驻");

                    itemEl.innerHTML = `
                        <div class="r20-item-left">
                            ${!this.isEditMode ? `<input type="checkbox" class="r20-buff-item-cb" data-id="${node.id}" />` : ""}
                            <span class="r20-item-name">${node.name}</span>
                            <span class="r20-item-rounds">${roundsLabel}</span>
                        </div>
                        ${this.isEditMode ? `
                            <div class="r20-item-actions">
                                <button class="r20-btn-icon btn-edit-buff" title="编辑">✏️</button>
                                <button class="r20-btn-icon btn-clone-buff" title="复制">📋</button>
                                <button class="r20-btn-icon btn-delete-buff" title="删除">🗑️</button>
                            </div>
                        ` : ""}
                    `;

                    if (!this.isEditMode) {
                        // 正常模式：点击条目直接施加
                        itemEl.addEventListener("click", (e) => {
                            if (e.target.tagName === "INPUT") return;
                            this.applySingleBuff(node.name, node.rounds);
                        });
                    } else {
                        // 编辑模式操作
                        itemEl.querySelector(".btn-edit-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.showEditBuffDialog(node);
                        });
                        itemEl.querySelector(".btn-clone-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.cloneBuff(node, nodes, index);
                        });
                        itemEl.querySelector(".btn-delete-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            if (confirm(`确定删除 Buff 模板 [${node.name}] 吗？`)) {
                                nodes.splice(index, 1);
                                this.saveTemplates();
                                this.renderTree();
                            }
                        });

                        this.setupDragEvents(itemEl, node, nodes, index);
                    }

                    container.appendChild(itemEl);
                }
            });
        };

        renderNodes(this.templates, treeContainer);
    }

    /**
     * 施加单个 Buff 到选中的棋子
     */
    static async applySingleBuff(buffName, rounds) {
        const selected = this.getSelectedControllableTokens();
        if (selected.length === 0) {
            this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
            return;
        }

        let appliedCount = 0;
        for (const item of selected) {
            if (item.type === "character" && item.char) {
                await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds);
                appliedCount++;
            } else if (item.type === "token" && item.token) {
                TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds);
                appliedCount++;
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        const roundsText = rounds > 100 || rounds === null ? "常驻" : `${rounds}轮`;
        this.showToast(`✨ 已为 ${appliedCount} 个棋子施加 [${buffName} ${roundsText}]`, "success");
    }

    /**
     * 批量应用复选框选中的 Buff
     */
    static async applySelectedBuffs() {
        const checkedBoxes = Array.from(this.panelEl.querySelectorAll(".r20-buff-item-cb:checked"));
        if (checkedBoxes.length === 0) {
            this.showToast("⚠️ 请先勾选要施加的 Buff 模板", "warn");
            return;
        }

        const selectedTokens = this.getSelectedControllableTokens();
        if (selectedTokens.length === 0) {
            this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
            return;
        }

        const buffIds = checkedBoxes.map(cb => cb.dataset.id);
        const buffsToApply = [];

        const findBuffs = (nodes) => {
            for (const n of nodes) {
                if (n.type === "buff" && buffIds.includes(n.id)) buffsToApply.push(n);
                if (n.type === "folder" && n.children) findBuffs(n.children);
            }
        };
        findBuffs(this.templates);

        for (const target of selectedTokens) {
            for (const buff of buffsToApply) {
                if (target.type === "character" && target.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(target.char, buff.name, buff.rounds);
                } else if (target.type === "token" && target.token) {
                    TokenBuffManager.applyOrRefreshBuff(target.token, buff.name, buff.rounds);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        this.showToast(`🚀 已为 ${selectedTokens.length} 个棋子批量施加 ${buffsToApply.length} 项 Buff！`, "success");
    }

    /**
     * HTML5 拖拽事件监听（支持排序与放入文件夹）
     */
    static setupDragEvents(el, node, parentList, index) {
        el.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            this._draggedData = { node, parentList, index };
            e.dataTransfer.setData("text/plain", node.id);
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.type === "folder") {
                el.classList.add("r20-drag-into");
            } else {
                el.classList.add("r20-drag-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");

            if (!this._draggedData || this._draggedData.node.id === node.id) return;

            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            // 1. 从源列表移除
            sourceList.splice(sourceIdx, 1);

            // 2. 放入目标位置
            if (node.type === "folder") {
                // 拖入文件夹内
                node.children = node.children || [];
                node.children.push(draggedNode);
                node.collapsed = false;
            } else {
                // 插在同级当前项之后
                parentList.splice(index, 0, draggedNode);
            }

            this._draggedData = null;
            this.saveTemplates();
            this.renderTree();
        });
    }

    /**
     * 递归删除节点
     */
    static deleteNodeById(id) {
        const removeRecursive = (list) => {
            for (let i = 0; i < list.length; i++) {
                if (list[i].id === id) {
                    list.splice(i, 1);
                    return true;
                }
                if (list[i].children && removeRecursive(list[i].children)) return true;
            }
            return false;
        };
        removeRecursive(this.templates);
    }

    /**
     * 复制一个 Buff 模板
     */
    static cloneBuff(node, list, index) {
        const clone = {
            id: "b_" + Date.now(),
            type: "buff",
            name: `${node.name} (副本)`,
            rounds: node.rounds
        };
        list.splice(index + 1, 0, clone);
        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 新建 Buff 弹窗
     */
    static showNewBuffDialog() {
        const name = prompt("请输入新 Buff 名称:");
        if (!name || !name.trim()) return;
        const roundsStr = prompt("请输入默认持续轮数 (大于100或留空视为常驻):", "10");
        const rounds = roundsStr && !isNaN(parseInt(roundsStr, 10)) ? parseInt(roundsStr, 10) : null;

        this.templates.push({
            id: "b_" + Date.now(),
            type: "buff",
            name: name.trim(),
            rounds
        });
        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 新建文件夹弹窗
     */
    static showNewFolderDialog() {
        const name = prompt("请输入新文件夹名称:");
        if (!name || !name.trim()) return;

        this.templates.push({
            id: "f_" + Date.now(),
            type: "folder",
            name: name.trim(),
            collapsed: false,
            children: []
        });
        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 编辑 Buff 模板
     */
    static showEditBuffDialog(node) {
        const newName = prompt("修改 Buff 名称:", node.name);
        if (newName && newName.trim()) node.name = newName.trim();

        const currentRoundsStr = node.rounds !== null ? String(node.rounds) : "";
        const roundsStr = prompt("修改默认持续轮数 (大于100或留空视为常驻):", currentRoundsStr);
        if (roundsStr !== null) {
            node.rounds = roundsStr && !isNaN(parseInt(roundsStr, 10)) ? parseInt(roundsStr, 10) : null;
        }

        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 悬浮窗鼠标拖拽移动
     */
    static initDragWindow() {
        const header = this.panelEl.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX, startY, initialX, initialY;

        header.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            isDragging = true;
            header.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            initialX = this.panelEl.offsetLeft;
            initialY = this.panelEl.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const newLeft = Math.max(10, Math.min(window.innerWidth - 300, initialX + dx));
                const newTop = Math.max(10, Math.min(window.innerHeight - 80, initialY + dy));

                this.panelEl.style.left = `${newLeft}px`;
                this.panelEl.style.top = `${newTop}px`;
                this.panelEl.style.right = "auto";
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    localStorage.setItem(this.POS_KEY, JSON.stringify({
                        left: this.panelEl.offsetLeft,
                        top: this.panelEl.offsetTop
                    }));
                }
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    }
}
