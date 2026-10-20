/**
 * BuffPanelStyles.js
 * 状态Buff工作台样式定义与注入器
 */
export class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static getCss() {
        return `
            /* 主悬浮窗容器 */
            #r20-buff-panel {
                position: fixed;
                width: 320px;
                background: #1a1e24;
                border: 1px solid #323d47;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #eceff1;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                user-select: none;
                box-sizing: border-box;
            }

            /* 向上展开时的布局翻转：标题栏在底，内容在顶 */
            #r20-buff-panel.direction-up {
                flex-direction: column-reverse;
            }

            /* 标题栏 */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 10px;
                background: #232b34;
                cursor: grab;
                box-sizing: border-box;
                border-radius: 7px 7px 0 0;
                border-bottom: 1px solid #323d47;
            }
            #r20-buff-panel.direction-up .r20-panel-header {
                border-radius: 0 0 7px 7px;
                border-top: 1px solid #323d47;
                border-bottom: none;
            }
            /* 折叠为纯标题时，四周完整圆角 */
            #r20-buff-panel.is-collapsed .r20-panel-header {
                border-radius: 7px;
                border-top: none;
                border-bottom: none;
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
                gap: 4px;
            }
            .r20-btn-icon {
                background: none;
                border: none;
                color: #90a4ae;
                font-size: 12px;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                transition: background 0.15s, color 0.15s;
                line-height: 1.2;
            }
            .r20-btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .r20-btn-icon.active {
                background: #1565c0;
                color: #ffffff;
            }
            .r20-btn-icon.pinned {
                color: #ffd54f !important;
                background: rgba(255, 213, 79, 0.15);
            }
            .r20-btn-icon.danger { color: #ef5350; }
            .r20-btn-icon.danger:hover { background: #c62828; color: #ffffff; }

            /* 面板主体 */
            .r20-panel-body {
                display: flex;
                flex-direction: column;
                gap: 0px;
                max-height: 80vh;
                overflow: visible;
                box-sizing: border-box;
            }
            #r20-buff-panel.is-collapsed .r20-panel-body {
                display: none !important;
            }
            #r20-buff-panel.direction-up .r20-panel-body {
                flex-direction: column-reverse;
            }

            /* 分立窗格通用样式 */
            .r20-split-pane {
                display: flex;
                flex-direction: column;
                background: #1a1e24;
                border-bottom: 1px solid #2a3440;
                box-sizing: border-box;
            }
            #r20-buff-panel.direction-up .r20-split-pane:first-child {
                border-bottom: none;
                border-top: 1px solid #2a3440;
            }
            .r20-pane-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #1e242c;
                font-size: 11px;
                font-weight: 600;
                color: #90caf9;
                cursor: pointer;
                border-top: 1px solid #2c3642;
                border-bottom: 1px solid #2c3642;
            }
            .r20-pane-header:hover {
                background: #252d37;
            }
            .r20-pane-title {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .r20-pane-content {
                max-height: 260px;
                overflow-y: auto;
                padding: 6px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                box-sizing: border-box;
            }

            /* 工具栏 */
            .r20-panel-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #161b20;
                border-bottom: 1px solid #263238;
                font-size: 11px;
            }

            /* 根目录放置区 */
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
            .r20-drop-zone-root.active-zone { display: block; }
            .r20-drop-zone-root.r20-drag-into {
                background: rgba(33, 150, 243, 0.2);
                border-color: #64b5f6;
                color: #ffffff;
            }

            /* 树状文件夹与项目 */
            .r20-tree-folder { display: flex; flex-direction: column; margin-bottom: 2px; }
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
                border: 1px solid transparent;
                transition: all 0.2s ease;
            }
            .r20-folder-header:hover { background: #2a3440; color: #ffffff; }
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
            .r20-folder-title { display: flex; align-items: center; gap: 5px; overflow: hidden; }
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
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2e3947;
                border-color: #64b5f6;
                color: #ffffff;
            }
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
            .r20-tree-item.edit-selected, .r20-tree-folder.edit-selected > .r20-folder-header {
                background: #4a148c !important;
                border-color: #ba68c8 !important;
                color: #f3e5f5 !important;
            }
            .r20-item-left { display: flex; align-items: center; gap: 6px; overflow: hidden; }
            .r20-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
            }
            .r20-item-actions { display: flex; align-items: center; gap: 4px; }

            .r20-drag-over { border-top: 2px solid #64b5f6 !important; }
            .r20-drag-into { background: rgba(25, 118, 210, 0.3) !important; }

            /* 空列表占位说明 */
            .r20-empty-placeholder {
                padding: 18px 12px;
                text-align: center;
                color: #78909c;
                font-size: 11px;
                line-height: 1.5;
            }

            /* Toast 提示条 */
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
                z-index: 1000000;
                pointer-events: none;
                transition: opacity 0.3s;
                display: none;
            }
            .r20-toast.warn { border-color: #ffb74d; color: #ffe082; }
            .r20-toast.success { border-color: #81c784; color: #c8e6c9; }

            /* 对话框模态层 */
            .r20-dialog-mask {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.65);
                z-index: 1000001;
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
    }

    static inject() {
        if (document.querySelector(`#${this.STYLESHEET_ID}`)) return;
        const style = document.createElement("style");
        style.id = this.STYLESHEET_ID;
        style.textContent = this.getCss();
        document.head.appendChild(style);
    }
}
