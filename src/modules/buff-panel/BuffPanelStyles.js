/**
 * BuffPanelStyles.js
 * 状态Buff工作台样式定义：极简基准定位模型 + 上下垂直排版 + 原生 details/summary 折叠 + 纯粹整行高亮多选
 */
export class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static getCss() {
        return `
            /* 主悬浮窗容器（以标题栏为主体定位） */
            #r20-buff-panel {
                position: fixed;
                width: 320px;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #eceff1;
                user-select: none;
                box-sizing: border-box;
            }

            /* 标题栏（拖拽句柄） */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 10px;
                background: #232b34;
                border: 1px solid #323d47;
                cursor: grab;
                box-sizing: border-box;
                border-radius: 7px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            }

            /* 向下展开时：标题栏底角方正以贴合内容栏 */
            #r20-buff-panel.direction-down:not(.is-collapsed) .r20-panel-header {
                border-radius: 7px 7px 0 0;
                border-bottom: none;
            }

            /* 向上展开时：标题栏顶角方正以贴合上方内容栏 */
            #r20-buff-panel.direction-up:not(.is-collapsed) .r20-panel-header {
                border-radius: 0 0 7px 7px;
                border-top: none;
            }

            .r20-panel-title {
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
                display: flex;
                align-items: center;
                gap: 6px;
                pointer-events: none;
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
                background: #1565c0 !important;
                color: #ffffff !important;
            }
            .r20-btn-icon.pinned {
                color: #ffd54f !important;
                background: rgba(255, 213, 79, 0.15);
            }
            .r20-btn-icon.danger { color: #ef5350; }
            .r20-btn-icon.danger:hover { background: #c62828; color: #ffffff; }

            /* 内容区容器 */
            .r20-panel-body {
                background: #1a1e24;
                border: 1px solid #323d47;
                box-sizing: border-box;
                display: flex;
                max-height: 75vh;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }

            /* 折叠时直接隐藏内容栏 */
            #r20-buff-panel.is-collapsed .r20-panel-body {
                display: none !important;
            }

            /* 向下展开：内容紧贴标题栏底部并向下生长 */
            #r20-buff-panel.direction-down .r20-panel-body {
                position: relative;
                border-top: 1px solid #323d47;
                border-radius: 0 0 7px 7px;
            }

            /* 向上展开：内容绝对脱标定位于标题栏顶部，并向负 Y 方向生长 */
            #r20-buff-panel.direction-up .r20-panel-body {
                position: absolute;
                bottom: 100%;
                left: 0;
                width: 100%;
                border-bottom: 1px solid #323d47;
                border-radius: 7px 7px 0 0;
            }

            .r20-panel-content {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            /* 工具栏（默认隐藏，点击编辑后展开） */
            .r20-panel-toolbar {
                display: none;
                align-items: center;
                gap: 5px;
                padding: 6px 10px;
                background: #161a1f;
                border-bottom: 1px solid #2d3748;
                font-size: 11px;
                flex-wrap: wrap;
            }
            #r20-buff-panel.is-editing .r20-panel-toolbar {
                display: flex;
            }

            /* 双栏垂直上下排版布局 */
            .r20-panel-panes {
                display: flex;
                flex-direction: column;
                flex: 1;
                overflow: hidden;
                max-height: 70vh;
            }

            .r20-pane {
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid #2d3748;
                overflow: hidden;
                min-height: 60px;
                max-height: 35vh;
            }
            .r20-pane:last-child {
                border-bottom: none;
            }

            .r20-pane-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #1f252e;
                border-bottom: 1px solid #2d3748;
                font-size: 11px;
                font-weight: 600;
                color: #b0bec5;
            }

            .r20-tree-container {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            /* 原生 details/summary 具名字典组容器 */
            details.r20-group {
                margin-bottom: 2px;
            }
            details.r20-group > summary {
                list-style: none;
                cursor: pointer;
                padding: 4px 6px;
                background: #242c37;
                border: 1px solid #323d47;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                color: #90caf9;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            details.r20-group > summary::-webkit-details-marker {
                display: none;
            }
            details.r20-group > summary::before {
                content: "▶";
                font-size: 8px;
                margin-right: 6px;
                transition: transform 0.15s ease;
                display: inline-block;
                color: #78909c;
            }
            details.r20-group[open] > summary::before {
                transform: rotate(90deg);
            }
            details.r20-group > .r20-group-content {
                margin-left: 10px;
                padding-left: 6px;
                border-left: 1px dashed #37474f;
                margin-top: 3px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            /* 树形条目（干净纯粹无复选框） */
            .r20-tree-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #20262f;
                border-radius: 4px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: all 0.15s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2a3340;
                border-color: #42a5f5;
                color: #ffffff;
            }
            /* 激活态（已生效在选中Token身上） */
            .r20-tree-item.full-active {
                background: #1e3d59 !important;
                border-color: #42a5f5 !important;
                color: #ffffff !important;
            }
            .r20-tree-item.partial-active {
                background: #2e2a1b !important;
                border-color: #ffd54f !important;
                color: #fff8e1 !important;
            }
            /* 编辑多选高亮态（整行精致高亮，彻底取代生硬复选框） */
            .r20-tree-item.selected {
                background: rgba(21, 101, 192, 0.45) !important;
                border-color: #64b5f6 !important;
                box-shadow: 0 0 6px rgba(100, 181, 246, 0.4);
                color: #ffffff !important;
            }

            .r20-item-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
                white-space: nowrap;
                margin-left: 6px;
            }

            /* 悬浮 Toast */
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
            .r20-empty-placeholder {
                padding: 14px;
                text-align: center;
                color: #78909c;
                font-size: 11px;
            }
        `;
    }

    static inject() {
        const existing = document.querySelector(`#${this.STYLESHEET_ID}`);
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = this.STYLESHEET_ID;
        style.textContent = this.getCss();
        document.head.appendChild(style);
    }
}
