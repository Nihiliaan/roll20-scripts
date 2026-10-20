import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";
import { Pf1eBuffManager } from "../pf1e-buff-tracker/Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";
import { Pf1eBuffUI } from "../pf1e-buff-tracker/Pf1eBuffUI.js";

/**
 * BuffFloatingPanel.js (v0.5.0)
 * 核心悬浮窗组件：
 * 1. 响应式三态高亮联动：未高亮 / 半高亮 / 完全高亮；
 * 2. 直接操作范式：点击即施加 / 即取消，彻底移除复选框与一键施加确认按钮；
 * 3. 常驻顶置不可删除文件夹：【🎯 当前选中单位生效Buff】；
 * 4. 文件夹级联三态高亮与一键全组开启/关闭；
 * 5. 编辑模式门槛：只有画布无选中棋子时显示编辑按钮，编辑模式下支持多选高亮批量删除与拖拽重排；
 * 6. 支持云端配置卡存储与玩家身份降级自动提取。
 */
export class BuffFloatingPanel {
    static POS_KEY = "r20_buff_panel_pos";

    static isEditMode = false;
    static isCollapsed = false;
    static panelEl = null;
    static templates = [];
    static editSelectedIds = new Set(); // 编辑模式下被选中的待删 ID 集合
    static lastSelectedTokenIds = [];

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
    static async init() {
        this.templates = await SuiteConfigStore.loadTemplates(this.defaultTemplates);
        this.injectStyles();
        this.createPanelDOM();
        this.renderTree();
        this.initDragWindow();
        this.startSelectionObserver();
        console.log("[BuffFloatingPanel] 悬浮面板 v0.5.0 已成功加载");
    }

    /**
     * 保存模板数据
     */
    static async saveTemplates(promptIfMissing = false) {
        await SuiteConfigStore.saveTemplates(this.templates, promptIfMissing);
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
     * 获取画布上当前选中的所有可用棋子
     */
    static getSelectedTokens() {
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
                validTokens.push({ token, char: char || null, type: char ? "character" : "token", id: tokenId });
            } else {
                validTokens.push({ token, char: null, type: "token", id: tokenId });
            }
        }

        return validTokens;
    }

    /**
     * 启动画布选中变化监听器（每 200ms 检测一次选中的变化）
     */
    static startSelectionObserver() {
        setInterval(async () => {
            const currentSelected = this.getSelectedTokens();
            const currentIds = currentSelected.map(t => t.id).sort().join(",");
            const lastIds = this.lastSelectedTokenIds.sort().join(",");

            if (currentIds !== lastIds) {
                this.lastSelectedTokenIds = currentSelected.map(t => t.id);
                // 更新编辑按钮显隐：无选中时显示编辑按钮，有选中时隐藏
                this.updateEditButtonVisibility(currentSelected.length === 0);
                if (currentSelected.length > 0 && this.isEditMode) {
                    // 若进入编辑模式后用户在画布选中了棋子，自动退出编辑模式
                    this.isEditMode = false;
                    this.updateToolbarVisibility();
                }
                await this.renderTree();
            }
        }, 200);
    }

    /**
     * 更新编辑按钮显示状态
     */
    static updateEditButtonVisibility(show) {
        if (!this.panelEl) return;
        const btnEdit = this.panelEl.querySelector(".btn-toggle-edit");
        if (btnEdit) {
            btnEdit.style.display = show ? "inline-block" : "none";
        }
    }

    /**
     * 更新工具栏显示状态
     */
    static updateToolbarVisibility() {
        if (!this.panelEl) return;
        const toolbar = this.panelEl.querySelector(".r20-panel-toolbar");
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        if (this.isEditMode) {
            if (editBtn) {
                editBtn.classList.add("active");
                editBtn.textContent = "🔒 完成";
            }
            if (toolbar) toolbar.style.display = "flex";
        } else {
            if (editBtn) {
                editBtn.classList.remove("active");
                editBtn.textContent = "✏️ 编辑";
            }
            if (toolbar) toolbar.style.display = "none";
            this.editSelectedIds.clear();
        }
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
            .r20-btn-icon.danger {
                color: #ef5350;
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
                max-height: 420px;
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
                padding: 5px 8px;
                background: #202730;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                color: #b0bec5;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s ease;
            }
            .r20-folder-header:hover {
                background: #2a3440;
                color: #ffffff;
            }
            /* 文件夹三态高亮 */
            .r20-folder-header.full-active {
                background: #1b4931 !important;
                border-color: #4caf50 !important;
                color: #e8f5e9 !important;
            }
            .r20-folder-header.partial-active {
                background: #3b3920 !important;
                border-color: #fbc02d !important;
                color: #fffde7 !important;
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
                padding: 5px 8px;
                background: #242c37;
                border-radius: 4px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2e3947;
                border-color: #64b5f6;
                color: #ffffff;
            }
            /* 条目三态高亮 */
            .r20-tree-item.full-active {
                background: #1e3d59 !important;
                border-color: #42a5f5 !important;
                color: #ffffff !important;
                box-shadow: inset 0 0 8px rgba(66, 165, 245, 0.4);
            }
            .r20-tree-item.partial-active {
                background: #2e2a1b !important;
                border-color: #ffd54f !important;
                color: #fff8e1 !important;
                border-style: dashed !important;
            }
            /* 编辑模式下的选中态 */
            .r20-tree-item.edit-selected, .r20-tree-folder.edit-selected > .r20-folder-header {
                background: #4a148c !important;
                border-color: #ba68c8 !important;
                color: #f3e5f5 !important;
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

            /* 对话框 */
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
                width: 440px;
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

        // 读取持久化位置并做安全边界校验，防止超出当前窗口可视范围
        const savedPos = localStorage.getItem(this.POS_KEY);
        let safeLeft = null;
        let safeTop = null;
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                const maxLeft = Math.max(10, window.innerWidth - 330);
                const maxTop = Math.max(10, window.innerHeight - 100);
                if (pos.left !== undefined && pos.left < maxLeft && pos.left >= 0) {
                    safeLeft = Math.max(10, pos.left);
                }
                if (pos.top !== undefined && pos.top < maxTop && pos.top >= 0) {
                    safeTop = Math.max(10, pos.top);
                }
            } catch (e) {}
        }

        if (safeLeft !== null && safeTop !== null) {
            panel.style.top = `${safeTop}px`;
            panel.style.left = `${safeLeft}px`;
            panel.style.right = "auto";
        } else {
            // 默认停靠在右上角安全区域
            panel.style.top = "80px";
            panel.style.right = "320px";
            panel.style.left = "auto";
        }

        panel.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff库</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-edit" title="进入编辑与排序模式" style="display:inline-block;">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="最小化收起">─</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <div class="r20-panel-toolbar" style="display: none;">
                    <div style="display:flex; gap:4px;">
                        <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                        <button class="r20-btn-icon btn-import-buffs" title="从战役角色卡导入Buff">📥 导入卡上Buff</button>
                    </div>
                    <button class="r20-btn-icon danger btn-batch-delete" title="批量删除选中的高亮项">🗑️ 批量删除</button>
                </div>
                <div class="r20-panel-tree"></div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panelEl = panel;

        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());

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
     * 编辑模式切换（只有无选中棋子时允许触发）
     */
    static toggleEditMode() {
        const selected = this.getSelectedTokens();
        if (selected.length > 0) {
            this.showToast("⚠️ 只有在未选中任何棋子时才可以进入编辑模式", "warn");
            return;
        }

        this.isEditMode = !this.isEditMode;
        this.updateToolbarVisibility();
        this.renderTree();
    }

    /**
     * 收集当前所有选中棋子身上的所有 Buff（包括生效中与未启动的）
     * @returns {Promise<{activeStats: Map<string, {count: number, total: number}>, allBuffRows: Array}>}
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        const allBuffRows = []; // 包含 enabled 与 disabled 的全部条目详情
        if (selectedTokens.length === 0) return { activeStats, allBuffRows };

        for (const item of selectedTokens) {
            let itemBuffs = [];
            if (item.type === "character" && item.char) {
                itemBuffs = await Pf1eBuffManager.getAllBuffs(item.char);
            } else if (item.token) {
                const tokenBuffs = TokenBuffManager.getTokenBuffs(item.token);
                itemBuffs = tokenBuffs.map(b => ({
                    name: b.name,
                    enabled: true, // 纯 Token 默认均为生效
                    rounds: b.rounds
                }));
            }

            // 统计生效中的 Buff
            const activeNames = itemBuffs.filter(b => b.enabled).map(b => b.name);
            const uniqueActiveNames = new Set(activeNames);
            for (const name of uniqueActiveNames) {
                if (!activeStats.has(name)) {
                    activeStats.set(name, { count: 1, total: selectedTokens.length });
                } else {
                    activeStats.get(name).count++;
                }
            }

            // 收集所有条目（包含未启动）
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
     * 计算 Buff 状态高亮类名：'full-active' | 'partial-active' | ''
     */
    static getHighlightClass(name, activeStats, isSelectedCount) {
        if (isSelectedCount === 0 || !activeStats.has(name)) return "";
        const stat = activeStats.get(name);
        if (stat.count === isSelectedCount) return "full-active";
        if (stat.count > 0) return "partial-active";
        return "";
    }

    /**
     * 递归渲染目录树
     */
    static async renderTree() {
        const treeContainer = this.panelEl.querySelector(".r20-panel-tree");
        if (!treeContainer) return;
        treeContainer.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();
        const { activeStats, allBuffRows } = await this.getBuffStatsForSelected(selectedTokens);
        const selCount = selectedTokens.length;

        // 1. 如果选中了棋子，顶置常驻【🎯 当前选中单位生效Buff】文件夹（不可删除/拖拽，包含已启用与未启用）
        if (selCount > 0) {
            const activeFolderEl = this.createCurrentActiveFolderDOM(selectedTokens, activeStats, allBuffRows);
            treeContainer.appendChild(activeFolderEl);
        }

        // 2. 根放置区（仅编辑模式展示）
        const topDropZone = document.createElement("div");
        topDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        topDropZone.textContent = "⬆️ 拖到此处：移出到根目录最上方";
        this.setupRootDropZone(topDropZone, 0);
        treeContainer.appendChild(topDropZone);

        // 3. 递归渲染主模板树
        const renderNodes = (nodes, container) => {
            nodes.forEach((node, index) => {
                if (node.type === "folder") {
                    const folderEl = document.createElement("div");
                    folderEl.className = "r20-tree-folder";
                    folderEl.dataset.id = node.id;
                    if (this.isEditMode) folderEl.draggable = true;

                    // 计算该文件夹下所有 Buff 的统计状态以决定文件夹头部的高亮
                    const folderBuffs = [];
                    const collectLeafs = (fn) => {
                        if (fn.children) {
                            fn.children.forEach(c => {
                                if (c.type === "buff") folderBuffs.push(c);
                                else collectLeafs(c);
                            });
                        }
                    };
                    collectLeafs(node);

                    let folderActiveState = "";
                    if (selCount > 0 && folderBuffs.length > 0) {
                        const states = folderBuffs.map(b => this.getHighlightClass(b.name, activeStats, selCount));
                        const allFull = states.every(s => s === "full-active");
                        const anyActive = states.some(s => s === "full-active" || s === "partial-active");
                        if (allFull) folderActiveState = "full-active";
                        else if (anyActive) folderActiveState = "partial-active";
                    }

                    const isFolderSelectedInEdit = this.isEditMode && this.editSelectedIds.has(node.id);
                    if (isFolderSelectedInEdit) folderEl.classList.add("edit-selected");

                    const isClosed = !!node.collapsed;
                    folderEl.innerHTML = `
                        <div class="r20-folder-header ${folderActiveState}">
                            <div class="r20-folder-title">
                                <span class="arrow-toggle">${isClosed ? "▶" : "▼"}</span>
                                <span>📁 ${node.name}</span>
                            </div>
                            <div class="r20-item-actions">
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-folder" title="重命名目录">✏️</button>` : ""}
                            </div>
                        </div>
                        <div class="r20-folder-children" style="display: ${isClosed ? 'none' : 'flex'};"></div>
                    `;

                    // 点击折叠箭头
                    folderEl.querySelector(".arrow-toggle").addEventListener("click", (e) => {
                        e.stopPropagation();
                        node.collapsed = !node.collapsed;
                        this.saveTemplates(false);
                        this.renderTree();
                    });

                    // 点击文件夹头部：非编辑模式下一键全加/全解；编辑模式下切换待选
                    folderEl.querySelector(".r20-folder-header").addEventListener("click", async (e) => {
                        if (e.target.tagName === "BUTTON") return;
                        if (this.isEditMode) {
                            // 编辑模式：标记选中待删
                            if (this.editSelectedIds.has(node.id)) {
                                this.editSelectedIds.delete(node.id);
                            } else {
                                this.editSelectedIds.add(node.id);
                            }
                            this.renderTree();
                            return;
                        }

                        // 正常模式：文件夹三态点击行为
                        if (selCount === 0) {
                            node.collapsed = !node.collapsed;
                            this.saveTemplates(false);
                            this.renderTree();
                            return;
                        }

                        if (folderActiveState === "full-active" || folderActiveState === "partial-active") {
                            // 一键全部取消
                            for (const b of folderBuffs) {
                                await this.toggleBuffAction(b.name, null, null, false);
                            }
                            this.showToast(`✨ 已批量清除 [${node.name}] 内所有状态`, "info");
                        } else {
                            // 一键全部施加
                            for (const b of folderBuffs) {
                                await this.toggleBuffAction(b.name, b.rounds, b.extraAttrs, true);
                            }
                            this.showToast(`🚀 已批量施加 [${node.name}] 内所有 Buff`, "success");
                        }
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderTree();
                    });

                    if (this.isEditMode) {
                        folderEl.querySelector(".btn-edit-folder").addEventListener("click", (e) => {
                            e.stopPropagation();
                            const newName = prompt("重命名文件夹:", node.name);
                            if (newName && newName.trim()) {
                                node.name = newName.trim();
                                this.saveTemplates(true);
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

                    // 计算高亮状态
                    const highlightClass = this.getHighlightClass(node.name, activeStats, selCount);
                    if (highlightClass) itemEl.classList.add(highlightClass);

                    const isItemSelectedInEdit = this.isEditMode && this.editSelectedIds.has(node.id);
                    if (isItemSelectedInEdit) itemEl.classList.add("edit-selected");

                    const showRounds = node.rounds !== null && !isNaN(node.rounds) && node.rounds <= 100;
                    const roundsLabel = (node.rounds === null || isNaN(node.rounds)) ? "永久" : (showRounds ? `${node.rounds}轮` : "永久");

                    itemEl.innerHTML = `
                        <div class="r20-item-left">
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

                    if (!this.isEditMode) {
                        // 正常模式：点击即施加 / 即取消
                        itemEl.addEventListener("click", async () => {
                            if (selCount === 0) {
                                this.showToast("⚠️ 请先在画布上选择要施加或关闭 Buff 的棋子", "warn");
                                return;
                            }
                            const shouldRemove = (highlightClass === "full-active" || highlightClass === "partial-active");
                            await this.toggleBuffAction(node.name, node.rounds, node.extraAttrs, !shouldRemove);
                            await Pf1eBuffUI.refreshAllBadges();
                            await this.renderTree();
                        });
                    } else {
                        // 编辑模式：点击条目切换勾选高亮（用于批量删除）
                        itemEl.addEventListener("click", (e) => {
                            if (e.target.tagName === "BUTTON") return;
                            if (this.editSelectedIds.has(node.id)) {
                                this.editSelectedIds.delete(node.id);
                            } else {
                                this.editSelectedIds.add(node.id);
                            }
                            this.renderTree();
                        });

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

        // 4. 底部根放置区（仅编辑模式展示）
        const bottomDropZone = document.createElement("div");
        bottomDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        bottomDropZone.textContent = "⬇️ 拖到此处：移出到根目录最下方";
        this.setupRootDropZone(bottomDropZone, this.templates.length);
        treeContainer.appendChild(bottomDropZone);
    }

    /**
     * 生成【🎯 当前选中单位生效Buff】常驻顶置文件夹 DOM（包含生效中与未启动条目）
     */
    static createCurrentActiveFolderDOM(selectedTokens, activeStats, allBuffRows) {
        const folderEl = document.createElement("div");
        folderEl.className = "r20-tree-folder";

        const count = allBuffRows.length;
        const activeCount = activeStats.size;

        folderEl.innerHTML = `
            <div class="r20-folder-header full-active" style="border-left: 3px solid #64b5f6 !important;">
                <div class="r20-folder-title">
                    <span>🎯</span>
                    <span>当前单位Buff (${activeCount}生效 / ${count}总数)</span>
                </div>
                <span style="font-size:10px; color:#90caf9;">点击一键清除生效</span>
            </div>
            <div class="r20-folder-children" style="display: flex;"></div>
        `;

        const childrenContainer = folderEl.querySelector(".r20-folder-children");

        if (count === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.style.cssText = "font-size:11px; color:#78909c; padding:4px 8px;";
            emptyEl.textContent = "当前选中的棋子身上暂无任何 Buff 记录";
            childrenContainer.appendChild(emptyEl);
        } else {
            for (const item of allBuffRows) {
                const itemEl = document.createElement("div");
                const isFullActive = item.enabledCount === selectedTokens.length;
                const isPartialActive = item.enabledCount > 0 && !isFullActive;
                const isInactive = item.enabledCount === 0;

                let itemClass = "";
                if (isFullActive) itemClass = "full-active";
                else if (isPartialActive) itemClass = "partial-active";

                itemEl.className = `r20-tree-item ${itemClass}`;
                itemEl.style.cursor = "pointer";

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
                    actionText = `<span style="font-size:10px; color:#ef5350;">✕ 全部解除</span>`;
                }

                itemEl.innerHTML = `
                    <div class="r20-item-left">
                        <span class="r20-item-name">${item.name}</span>
                        ${statusBadge}
                    </div>
                    ${actionText}
                `;

                // 点击：若未启用则立即激活启用；若已启用则关闭解除
                itemEl.addEventListener("click", async () => {
                    const shouldApply = isInactive;
                    await this.toggleBuffAction(item.name, item.rounds, item.extraAttrs, shouldApply);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderTree();
                });

                childrenContainer.appendChild(itemEl);
            }
        }

        // 点击常驻文件夹头部：一键解除当前生效的全部 Buff
        folderEl.querySelector(".r20-folder-header").addEventListener("click", async () => {
            if (activeCount === 0) return;
            for (const name of activeStats.keys()) {
                await this.toggleBuffAction(name, null, null, false);
            }
            this.showToast("🧹 已解除当前选中棋子身上的所有生效 Buff！", "info");
            await Pf1eBuffUI.refreshAllBadges();
            await this.renderTree();
        });

        return folderEl;
    }

    /**
     * 触发对当前所有选中棋子的 Buff 增加或移除
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 细目字典
     * @param {boolean} apply 是否施加（true 施加/刷新，false 移除）
     */
    static async toggleBuffAction(buffName, rounds, extraAttrs, apply) {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) return;

        for (const item of selected) {
            if (apply) {
                // 施加/激活
                if (item.type === "character" && item.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                } else if (item.token) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                }
            } else {
                // 移除/解除
                if (item.type === "character" && item.char) {
                    const activeBuffs = await Pf1eBuffManager.getActiveBuffs(item.char);
                    const target = activeBuffs.find(b => b.name === buffName);
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
     * 批量删除选中的项目（编辑模式下被点击高亮的项目）
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
        this.renderTree();
        this.showToast("🗑️ 批量删除成功", "success");
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

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-into");

            if (!this._draggedData) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            sourceList.splice(sourceIdx, 1);
            const realIdx = Math.min(targetIndex, this.templates.length);
            this.templates.splice(realIdx, 0, draggedNode);

            this._draggedData = null;
            await this.saveTemplates(true);
            this.renderTree();
            this.showToast(`✨ 已成功将 [${draggedNode.name}] 移至根目录`, "success");
        });
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

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");

            if (!this._draggedData || this._draggedData.node.id === node.id) return;

            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            sourceList.splice(sourceIdx, 1);

            if (node.type === "folder") {
                node.children = node.children || [];
                node.children.push(draggedNode);
                node.collapsed = false;
            } else {
                parentList.splice(index, 0, draggedNode);
            }

            this._draggedData = null;
            await this.saveTemplates(true);
            this.renderTree();
        });
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
        this.renderTree();
    }

    /**
     * 新建文件夹弹窗
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
        mask.querySelector(".btn-save").addEventListener("click", async () => {
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

            // 用户创建或修改首个 Buff 时，若未找到配置卡会主动提示是否新建
            await this.saveTemplates(true);
            this.renderTree();
            mask.remove();
            this.showToast(`✅ 已成功保存 Buff [${name}]`, "success");
        });
    }

    /**
     * 从角色卡导入 Buff 弹窗（可复选导入项，并可指定目标文件夹）
     */
    static async showImportFromCharacterDialog() {
        const selected = this.getSelectedTokens();
        let character = null;

        if (selected.length > 0) {
            const charItem = selected.find(s => s.type === "character" && s.char);
            if (charItem) character = charItem.char;
        }

        // 若无选中棋子，允许从战役全量角色列表中下拉选择角色卡
        if (!character) {
            if (!window.Campaign || !window.Campaign.characters || window.Campaign.characters.length === 0) {
                this.showToast("⚠️ 战役中暂无可用的角色卡", "warn");
                return;
            }
            character = window.Campaign.characters.at(0);
        }

        await Roll20Bridge.ensureCharacterAttributes(character);

        const cardBuffs = [];
        if (character.attribs && character.attribs.models) {
            character.attribs.models.forEach(a => {
                const attrName = a.get("name") || "";
                if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_name")) {
                    const prefix = attrName.substring(0, attrName.lastIndexOf("_name"));
                    const name = a.get("current") || "未命名Buff";

                    const roundsAttr = character.attribs.models.find(x => x.get("name") === `${prefix}_rounds`);
                    const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;

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

                    cardBuffs.push({ name, rounds, extraAttrs });
                }
            });
        }

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

        mask.querySelector(".btn-confirm-import").addEventListener("click", async () => {
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

            await this.saveTemplates(true);
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
