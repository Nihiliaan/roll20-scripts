import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";

/**
 * BuffFloatingPanel.js
 * 核心悬浮窗组件：支持多级目录树管理、JSON 细目编辑、卡上 Buff 导入、
 * 文件夹独立全选、多选批量删除、双向拖拽（含移出到根目录）、纯 Token 智能适配。
 */
export class BuffFloatingPanel {
    static STORAGE_KEY = "r20_buff_templates_v4";
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
                {
                    id: "b_divine_favor",
                    type: "buff",
                    name: "神恩",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "luck",
                        "b1_macro-text": "min(3, max(1, floor(@{level}/3)))",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "dmg",
                        b2_bonustype: "luck",
                        "b2_macro-text": "min(3, max(1, floor(@{level}/3)))",
                        b2_val: 1
                    }
                },
                {
                    id: "b_bless",
                    type: "buff",
                    name: "祝福术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "morale",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "save-fear",
                        b2_bonustype: "morale",
                        b2_val: 1
                    }
                },
                {
                    id: "b_prayer",
                    type: "buff",
                    name: "祈祷术",
                    rounds: 5,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "luck",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "dmg",
                        b2_bonustype: "luck",
                        b2_val: 1
                    }
                },
                {
                    id: "f_high_divine",
                    type: "folder",
                    name: "高阶神术",
                    collapsed: false,
                    children: [
                        { id: "b_righteous_might", type: "buff", name: "正气如虹", rounds: 10, extraAttrs: { bufftype: "spell" } },
                        { id: "b_holy_aura", type: "buff", name: "圣洁灵光", rounds: 10, extraAttrs: { bufftype: "spell" } }
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
                {
                    id: "b_haste",
                    type: "buff",
                    name: "加速术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "dodge",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "AC",
                        b2_bonustype: "dodge",
                        b2_val: 1
                    }
                },
                {
                    id: "b_shield",
                    type: "buff",
                    name: "护盾术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "AC",
                        b1_bonustype: "shield",
                        b1_val: 4
                    }
                },
                { id: "b_barkskin", type: "buff", name: "树皮术", rounds: 100, extraAttrs: { bufftype: "spell" } },
                { id: "b_mage_armor", type: "buff", name: "法师护甲", rounds: 600, extraAttrs: { bufftype: "spell" } }
            ]
        },
        {
            id: "f_debuff",
            type: "folder",
            name: "负面与妨害",
            collapsed: false,
            children: [
                { id: "b_entangled", type: "buff", name: "纠缠", rounds: 5, extraAttrs: { bufftype: "condition" } },
                { id: "b_slow", type: "buff", name: "缓慢术", rounds: 10, extraAttrs: { bufftype: "spell" } }
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
     * 屏幕底部轻量提示（Toast）
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
     * 获取画布上当前选中的所有 Token（信任 Roll20 内置权限机制，直接尝试操作选中的每一个 Token）
     */
    static getSelectedControllableTokens() {
        if (!window.Campaign.engine || typeof window.Campaign.engine.getSelection !== "function") return [];
        const sel = window.Campaign.engine.getSelection();
        if (!Array.isArray(sel) || sel.length === 0) return [];

        const page = window.Campaign.pages.get(window.Campaign.get("playerpageid"));
        if (!page || !page.thegraphics) return [];

        const validTokens = [];

        for (const item of sel) {
            const tokenId = item.id;
            const token = page.thegraphics.get(tokenId);
            if (!token) continue;

            const charId = token.get("represents");
            if (charId) {
                const char = window.Campaign.characters.get(charId);
                if (char) {
                    validTokens.push({ token, char, type: "character" });
                } else {
                    validTokens.push({ token, char: null, type: "token" });
                }
            } else {
                validTokens.push({ token, char: null, type: "token" });
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
                width: 310px;
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
                font-size: 12px;
                cursor: pointer;
                padding: 3px 6px;
                border-radius: 3px;
                transition: background 0.15s, color 0.15s;
            }
            .r20-btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .r20-btn-icon.active {
                background: #1565c0;
                color: #ffffff;
            }
            .r20-btn-icon.danger:hover {
                background: #c62828;
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
                max-height: 400px;
                overflow-y: auto;
                padding: 6px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .r20-drop-zone-root {
                padding: 4px;
                border: 1px dashed #37474f;
                border-radius: 4px;
                text-align: center;
                font-size: 10px;
                color: #78909c;
                margin: 2px 0;
                display: none;
                transition: background 0.2s, border-color 0.2s;
            }
            .r20-drop-zone-root.active-zone {
                display: block;
            }
            .r20-drop-zone-root.r20-drag-into {
                background: rgba(33, 150, 243, 0.2);
                border-color: #64b5f6;
                color: #ffffff;
            }
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
                overflow: hidden;
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
            .r20-btn-danger {
                background: #c62828;
                color: #ffffff;
                font-size: 11px;
                font-weight: 600;
                padding: 5px 10px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
            }
            .r20-btn-danger:hover { background: #d32f2f; }

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

            /* JSON 与导入对话框通用样式 */
            .r20-dialog-mask {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.65);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .r20-dialog-box {
                background: #1e242c;
                border: 1px solid #37474f;
                border-radius: 8px;
                width: 420px;
                max-width: 90vw;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                color: #eceff1;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .r20-dialog-header {
                padding: 10px 14px;
                font-size: 13px;
                font-weight: 600;
                border-bottom: 1px solid #323d47;
                background: #242c37;
                color: #64b5f6;
            }
            .r20-dialog-body {
                padding: 12px 14px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .r20-dialog-footer {
                padding: 10px 14px;
                border-top: 1px solid #323d47;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                background: #191f26;
            }
            .r20-input-text {
                background: #121519;
                border: 1px solid #37474f;
                border-radius: 4px;
                color: #ffffff;
                padding: 6px 8px;
                font-size: 12px;
                outline: none;
            }
            .r20-textarea-json {
                background: #121519;
                border: 1px solid #37474f;
                border-radius: 4px;
                color: #81c784;
                font-family: monospace;
                padding: 6px 8px;
                font-size: 11px;
                height: 120px;
                outline: none;
                resize: vertical;
            }
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
                    <div style="display:flex; gap:4px;">
                        <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                        <button class="r20-btn-icon btn-import-buffs" title="从选中角色卡导入现有Buff">📥 导入卡上Buff</button>
                    </div>
                    <button class="r20-btn-icon danger btn-batch-delete" title="批量删除勾选项">🗑️ 批量删除</button>
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
            panel.querySelectorAll(".r20-folder-select-cb").forEach(cb => cb.checked = checked);
        });

        panel.querySelector(".btn-batch-apply").addEventListener("click", () => this.applySelectedBuffs());

        // 编辑模式工具栏按钮
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
        panel.querySelector(".btn-import-buffs").addEventListener("click", () => this.showImportFromCharacterDialog());
        panel.querySelector(".btn-batch-delete").addEventListener("click", () => this.deleteSelectedBuffs());
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

        // 在树的最顶部增加一个“移出到根目录”放置区（仅编辑模式展示）
        const topDropZone = document.createElement("div");
        topDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        topDropZone.textContent = "⬆️ 拖到此处：移出到根目录最上方";
        this.setupRootDropZone(topDropZone, 0);
        treeContainer.appendChild(topDropZone);

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
                            <div class="r20-item-actions">
                                <label style="font-size:10px; display:flex; align-items:center; gap:2px; cursor:pointer;" title="全选/反选本文件夹内所有Buff">
                                    <input type="checkbox" class="r20-folder-select-cb" data-folder-id="${node.id}" />
                                    <span>选</span>
                                </label>
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-folder" title="重命名目录">✏️</button>` : ""}
                            </div>
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

                    // 文件夹独立全选/反选
                    folderEl.querySelector(".r20-folder-select-cb").addEventListener("click", (e) => {
                        e.stopPropagation();
                    });
                    folderEl.querySelector(".r20-folder-select-cb").addEventListener("change", (e) => {
                        e.stopPropagation();
                        const isChecked = e.target.checked;
                        const childCheckboxes = folderEl.querySelectorAll(".r20-buff-item-cb");
                        childCheckboxes.forEach(cb => cb.checked = isChecked);
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

                    const showRounds = node.rounds !== null && !isNaN(node.rounds) && node.rounds <= 100;
                    const roundsLabel = (node.rounds === null || isNaN(node.rounds)) ? "永久" : (showRounds ? `${node.rounds}轮` : "永久");

                    itemEl.innerHTML = `
                        <div class="r20-item-left">
                            <input type="checkbox" class="r20-buff-item-cb" data-id="${node.id}" />
                            <span class="r20-item-name">${node.name}</span>
                            <span class="r20-item-rounds">${roundsLabel}</span>
                        </div>
                        ${this.isEditMode ? `
                            <div class="r20-item-actions">
                                <button class="r20-btn-icon btn-edit-buff" title="编辑细目属性">✏️</button>
                                <button class="r20-btn-icon btn-clone-buff" title="复制">📋</button>
                            </div>
                        ` : ""}
                    `;

                    // 复选框点击防止冒泡触发点击施加
                    itemEl.querySelector(".r20-buff-item-cb").addEventListener("click", (e) => {
                        e.stopPropagation();
                    });

                    if (!this.isEditMode) {
                        // 正常模式：点击条目直接施加
                        itemEl.addEventListener("click", (e) => {
                            if (e.target.tagName === "INPUT") return;
                            this.applySingleBuff(node.name, node.rounds, node.extraAttrs);
                        });
                    } else {
                        // 编辑模式操作
                        itemEl.querySelector(".btn-edit-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.showBuffEditorDialog(node);
                        });
                        itemEl.querySelector(".btn-clone-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.cloneBuff(node, nodes, index);
                        });

                        this.setupDragEvents(itemEl, node, nodes, index);
                    }

                    container.appendChild(itemEl);
                }
            });
        };

        renderNodes(this.templates, treeContainer);

        // 在树的最底部增加一个“移出到根目录”放置区（仅编辑模式展示）
        const bottomDropZone = document.createElement("div");
        bottomDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        bottomDropZone.textContent = "⬇️ 拖到此处：移出到根目录最下方";
        this.setupRootDropZone(bottomDropZone, this.templates.length);
        treeContainer.appendChild(bottomDropZone);
    }

    /**
     * 根层级拖拽放置区（用于将子文件夹内部节点拖出）
     */
    static setupRootDropZone(el, targetIndex) {
        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("r20-drag-into");
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-into");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-into");

            if (!this._draggedData) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            // 从源位置移除
            sourceList.splice(sourceIdx, 1);

            // 插入根列表对应位置
            const realIdx = Math.min(targetIndex, this.templates.length);
            this.templates.splice(realIdx, 0, draggedNode);

            this._draggedData = null;
            this.saveTemplates();
            this.renderTree();
            this.showToast(`✨ 已成功将 [${draggedNode.name}] 移出到根目录`, "success");
        });
    }

    /**
     * 施加单个 Buff 到选中的棋子
     */
    static async applySingleBuff(buffName, rounds, extraAttrs = null) {
        const selected = this.getSelectedControllableTokens();
        if (selected.length === 0) {
            this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
            return;
        }

        let appliedCount = 0;
        for (const item of selected) {
            if (item.type === "character" && item.char) {
                await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                appliedCount++;
            } else if (item.type === "token" && item.token) {
                TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                appliedCount++;
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        const roundsText = (rounds === null || isNaN(rounds) || rounds > 100) ? "永久" : `${rounds}轮`;
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
                    await Pf1eBuffManager.applyOrRefreshBuff(target.char, buff.name, buff.rounds, buff.extraAttrs);
                } else if (target.type === "token" && target.token) {
                    TokenBuffManager.applyOrRefreshBuff(target.token, buff.name, buff.rounds, buff.extraAttrs);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        this.showToast(`🚀 已为 ${selectedTokens.length} 个棋子批量施加 ${buffsToApply.length} 项 Buff！`, "success");
    }

    /**
     * 批量删除选中的 Buff 项
     */
    static deleteSelectedBuffs() {
        const checkedBoxes = Array.from(this.panelEl.querySelectorAll(".r20-buff-item-cb:checked"));
        if (checkedBoxes.length === 0) {
            this.showToast("⚠️ 请先勾选要批量删除的 Buff 项", "warn");
            return;
        }

        if (!confirm(`确定要批量删除选中的 ${checkedBoxes.length} 个 Buff 模板吗？`)) return;

        const idsToDelete = new Set(checkedBoxes.map(cb => cb.dataset.id));
        const removeRecursive = (list) => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (idsToDelete.has(list[i].id)) {
                    list.splice(i, 1);
                } else if (list[i].children) {
                    removeRecursive(list[i].children);
                }
            }
        };

        removeRecursive(this.templates);
        this.saveTemplates();
        this.renderTree();
        this.showToast(`🗑️ 已成功批量删除 ${checkedBoxes.length} 项 Buff`, "success");
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
     * 复制一个 Buff 模板
     */
    static cloneBuff(node, list, index) {
        const clone = {
            id: "b_" + Date.now(),
            type: "buff",
            name: `${node.name} (副本)`,
            rounds: node.rounds,
            extraAttrs: node.extraAttrs ? JSON.parse(JSON.stringify(node.extraAttrs)) : null
        };
        list.splice(index + 1, 0, clone);
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
     * 新建/编辑 Buff 弹窗（带简易 JSON 细目编辑器与永久选项）
     */
    static showBuffEditorDialog(existingNode = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null ? existingNode.rounds : "";
        const currentJson = isEditing && existingNode.extraAttrs ? JSON.stringify(existingNode.extraAttrs, null, 2) :
`{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${isEditing ? "编辑 Buff 模板" : "新建 Buff 模板"}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-buff-name" value="${currentName}" placeholder="例如: 神恩、加速术..." />

                    <label style="font-size:11px; color:#b0bec5;">持续轮数 (留空视为永久):</label>
                    <input type="number" class="r20-input-text input-buff-rounds" value="${currentRounds}" placeholder="留空或大于100视为永久" />

                    <label style="font-size:11px; color:#b0bec5;">PF1e 细目加值字典 (JSON 格式):</label>
                    <textarea class="r20-textarea-json input-buff-json">${currentJson}</textarea>
                    <span style="font-size:10px; color:#78909c;">提示: 可配置 b1_bonus, b1_bonustype, b1_val, b1_macro-text 等人物卡原生字段。</span>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) {
                alert("请输入 Buff 名称");
                return;
            }

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try {
                    extraAttrs = JSON.parse(jsonText);
                } catch (err) {
                    alert("JSON 细目格式错误，请检查语法:\n" + err.message);
                    return;
                }
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

            this.saveTemplates();
            this.renderTree();
            mask.remove();
            this.showToast(`✅ 已成功保存 Buff [${name}]`, "success");
        });
    }

    /**
     * 从画布选中的角色卡导入 Buff 弹窗（可复选导入项，并可指定目标文件夹）
     */
    static async showImportFromCharacterDialog() {
        const selected = this.getSelectedControllableTokens();
        const charItem = selected.find(s => s.type === "character" && s.char);

        if (!charItem) {
            this.showToast("⚠️ 请先在画布上选择一个绑定了人物卡的棋子", "warn");
            return;
        }

        const character = charItem.char;
        await Roll20Bridge.ensureCharacterAttributes(character);

        // 扫描该卡上现有的所有 repeating_buff2
        const cardBuffs = [];
        if (character.attribs && character.attribs.models) {
            character.attribs.models.forEach(a => {
                const attrName = a.get("name") || "";
                if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_name")) {
                    const prefix = attrName.substring(0, attrName.lastIndexOf("_name"));
                    const rowId = prefix.replace("repeating_buff2_", "");
                    const name = a.get("current") || "未命名Buff";

                    const roundsAttr = character.attribs.models.find(x => x.get("name") === `${prefix}_rounds`);
                    const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;

                    // 收集细目
                    const extraAttrs = {};
                    character.attribs.models.forEach(m => {
                        const mName = m.get("name") || "";
                        if (mName.startsWith(`${prefix}_`)) {
                            const subKey = mName.substring(prefix.length + 1);
                            if (subKey !== "name" && subKey !== "enable_toggle" && subKey !== "rounds") {
                                extraAttrs[subKey] = m.get("current");
                            }
                        }
                    });

                    cardBuffs.push({
                        name,
                        rounds,
                        extraAttrs
                    });
                }
            });
        }

        if (cardBuffs.length === 0) {
            this.showToast(`ℹ️ 角色 [${character.get("name")}] 卡上未找到任何 Buff 条目`, "warn");
            return;
        }

        // 获取所有可用的目标文件夹列表
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
        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 480px;">
                <div class="r20-dialog-header">从 [${character.get("name")}] 导入 Buff</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">导入至目标文件夹:</label>
                    <select class="r20-input-text select-target-folder">
                        ${folders.map(f => `<option value="${f.id}">${f.name}</option>`).join("")}
                    </select>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                        <span style="font-size:11px; color:#b0bec5;">选择要导入的 Buff 条目:</span>
                        <label style="font-size:11px; cursor:pointer;">
                            <input type="checkbox" class="cb-import-select-all" checked />
                            <span>全选</span>
                        </label>
                    </div>

                    <div class="import-buff-list" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding:4px; background:#121519; border-radius:4px; border:1px solid #37474f;">
                        ${cardBuffs.map((b, idx) => `
                            <label style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; background:#1e242c; border-radius:3px; font-size:11px; cursor:pointer;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <input type="checkbox" class="cb-import-item" data-idx="${idx}" checked />
                                    <span>${b.name}</span>
                                </div>
                                <span style="color:#90caf9; font-size:10px;">${b.rounds !== null ? b.rounds + '轮' : '永久'}</span>
                            </label>
                        `).join("")}
                    </div>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-confirm-import" style="padding:6px 14px;">确认导入</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);

        mask.querySelector(".cb-import-select-all").addEventListener("change", (e) => {
            const checked = e.target.checked;
            mask.querySelectorAll(".cb-import-item").forEach(cb => cb.checked = checked);
        });

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        mask.querySelector(".btn-confirm-import").addEventListener("click", () => {
            const checkedBoxes = Array.from(mask.querySelectorAll(".cb-import-item:checked"));
            if (checkedBoxes.length === 0) {
                alert("请先勾选至少一个要导入的 Buff 条目");
                return;
            }

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

            this.saveTemplates();
            this.renderTree();
            mask.remove();
            this.showToast(`🎉 已成功导入 ${checkedBoxes.length} 项 Buff！`, "success");
        });
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
                const newLeft = Math.max(10, Math.min(window.innerWidth - 320, initialX + dx));
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
