/**
 * BuffPanelStyles.js
 * 现代化单栏多标签 Buff 调度器专用样式表
 * 包含：原生尺寸拖拽缩放 (resize: both)、左右标签栏、视口工具条、影子链接标识、头像徽章与右键菜单
 */
export class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static inject() {
        const existing = document.getElementById(this.STYLESHEET_ID);
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = this.STYLESHEET_ID;
        style.textContent = this.getCss();
        document.head.appendChild(style);
    }

    static getCss() {
        return `
            /* 主悬浮窗与派生独立工作台容器（支持右下角自由缩放） */
            #r20-buff-panel, .r20-detached-window {
                position: fixed !important;
                width: 360px;
                height: 380px;
                min-width: 280px;
                min-height: 200px;
                max-width: 90vw;
                max-height: 85vh;
                resize: both;
                overflow: hidden;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #eceff1;
                user-select: none;
                box-sizing: border-box;
                display: flex !important;
                flex-direction: column !important;
                background: #1e262f !important;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
            }

            /* 标题栏（拖拽句柄） */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #141b22;
                border-bottom: 1px solid #2d3846;
                cursor: grab;
                box-sizing: border-box;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
                flex-shrink: 0;
            }
            .r20-panel-header:active {
                cursor: grabbing;
            }

            .r20-panel-title {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
            }

            .r20-panel-controls {
                display: flex;
                align-items: center;
                gap: 3px;
            }

            .r20-btn-icon {
                background: transparent;
                border: none;
                color: #90a4ae;
                cursor: pointer;
                padding: 2px 5px;
                border-radius: 4px;
                font-size: 12px;
                line-height: 1;
                transition: all 0.15s ease;
            }
            .r20-btn-icon:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
            }
            .r20-btn-icon.pinned {
                color: #ffd54f !important;
                background: rgba(255, 213, 79, 0.18) !important;
            }

            /* 抽屉式内容折叠容器 */
            .r20-panel-content-drawer {
                background: #1e262f;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
            }

            /* 浏览器式顶部标签栏 */
            .r20-tab-strip {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: #0d1217 !important;
                padding: 4px 6px 0 6px !important;
                border-bottom: 1px solid #2d3846 !important;
                overflow-x: auto !important;
                scrollbar-width: none !important;
                gap: 6px !important;
                flex-shrink: 0 !important;
                box-sizing: border-box !important;
                width: 100% !important;
            }
            .r20-tab-strip::-webkit-scrollbar {
                display: none !important;
            }

            /* 靠左动态选区标签容器（支持横向滚动，极细滚动条） */
            .r20-tabs-dynamic {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 3px !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: thin !important;
                scrollbar-color: #37474f transparent !important;
                padding-bottom: 2px !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar {
                height: 3px !important;
                display: block !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-thumb {
                background: #37474f !important;
                border-radius: 3px !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-thumb:hover {
                background: #607d8b !important;
            }

            /* 靠右固定角色标签容器（自适应最小宽度，支持溢出滚动） */
            .r20-tabs-pinned {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 3px !important;
                flex: 0 0 auto !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: 50% !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: thin !important;
                scrollbar-color: #37474f transparent !important;
                padding: 0 0 2px 4px !important;
                margin: 0 !important;
                border-left: 1px solid #263238 !important;
                box-sizing: border-box !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar {
                height: 3px !important;
                display: block !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-thumb {
                background: #37474f !important;
                border-radius: 3px !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-thumb:hover {
                background: #607d8b !important;
            }
            /* 钉选区域空态占位 */
            .r20-tabs-pinned:empty {
                min-width: 24px !important;
                height: 38px !important;
                border: 1px dashed rgba(55, 71, 79, 0.6) !important;
                border-radius: 4px !important;
                margin-left: 3px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                opacity: 0.5 !important;
                transition: all 0.2s ease !important;
            }
            .r20-tabs-pinned:empty::after {
                content: "📌" !important;
                font-size: 11px !important;
                opacity: 0.4 !important;
                pointer-events: none !important;
            }
            .r20-tabs-pinned:empty:hover,
            .r20-tabs-pinned.r20-pin-zone-hover {
                opacity: 1 !important;
                background: rgba(33, 150, 243, 0.15) !important;
                border-color: #2196f3 !important;
            }

            /* 单个选项卡（方形人物图标设计，尺寸大，手感舒适） */
            .r20-tab {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 38px !important;
                height: 38px !important;
                min-width: 38px !important;
                min-height: 38px !important;
                padding: 2px !important;
                background: #171f28 !important;
                border-radius: 6px !important;
                cursor: pointer !important;
                border: 1px solid #2d3846 !important;
                transition: all 0.15s ease !important;
                position: relative !important;
                box-sizing: border-box !important;
                flex-shrink: 0 !important;
            }
            .r20-tab:hover {
                background: #202b37 !important;
                border-color: #455a64 !important;
                transform: translateY(-1px);
            }
            .r20-tab.active {
                background: #1e3a5f !important;
                border-color: #38bdf8 !important;
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.45) !important;
                z-index: 2 !important;
            }
            /* 画布选中单位在常驻固定标签上的选中高亮态 */
            .r20-tab.selected-highlight {
                box-shadow: 0 0 0 2px #38bdf8, 0 0 10px rgba(56, 189, 248, 0.4) !important;
                border-color: #38bdf8 !important;
            }
            .r20-tab.active.selected-highlight {
                box-shadow: 0 0 0 2px #0284c7, 0 0 12px rgba(2, 132, 199, 0.6) !important;
                background: #1c3653 !important;
            }
            /* 头像容器与图片 */
            .r20-tab-avatar-box {
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: hidden !important;
                border-radius: 4px !important;
                pointer-events: none !important;
            }
            .r20-tab-avatar {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                display: block !important;
                border-radius: 4px !important;
            }
            .r20-tab-avatar-fallback {
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: linear-gradient(135deg, #263238 0%, #37474f 100%) !important;
                color: #eceff1 !important;
                font-size: 15px !important;
                font-weight: 700 !important;
                border-radius: 4px !important;
            }
            /* 悬停或常驻小叉号 / 钉选小图钉 */
            .r20-tab-close,
            .r20-tab-pin {
                position: absolute !important;
                top: -5px !important;
                right: -5px !important;
                width: 15px !important;
                height: 15px !important;
                border-radius: 50% !important;
                background: #37474f !important;
                color: #eceff1 !important;
                font-size: 9px !important;
                line-height: 15px !important;
                text-align: center !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.6) !important;
                z-index: 5 !important;
                cursor: pointer !important;
                user-select: none !important;
            }
            .r20-tab:hover .r20-tab-close,
            .r20-tab:hover .r20-tab-pin {
                display: flex !important;
            }
            .r20-tab-close:hover {
                background: #ef5350 !important;
                color: #fff !important;
            }
            .r20-tab-pin:hover {
                background: #1976d2 !important;
                color: #fff !important;
            }

            /* 拖拽悬停高亮 */
            .r20-tab.r20-tab-drag-hover {
                background: #1565c0 !important;
                color: #fff !important;
                outline: 2px dashed #42a5f5;
            }
            .r20-tabs-pinned.r20-pin-zone-hover {
                background: rgba(33, 150, 243, 0.15);
                outline: 1px dashed #2196f3;
                border-radius: 4px;
            }

            /* 单栏内容视口区 */
            .r20-tab-viewport {
                flex: 1 1 auto;
                min-height: 0;
                padding: 8px 10px;
                overflow-y: auto;
                box-sizing: border-box;
            }

            /* 视口顶部操作条（当前角色概要 + 快捷操作，紧凑自适应最小高度） */
            .r20-viewport-toolbar {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 2px 0 !important;
                margin-bottom: 4px !important;
                border-bottom: 1px solid #2d3846 !important;
                font-size: 11px !important;
                color: #90a4ae !important;
                flex-shrink: 0 !important;
                min-height: 0 !important;
                height: auto !important;
                box-sizing: border-box !important;
            }
            .r20-toolbar-target-name {
                display: flex !important;
                align-items: center !important;
                font-weight: 600 !important;
                color: #eceff1 !important;
                max-width: 170px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                line-height: 1 !important;
                font-size: 11px !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            .r20-select-quick-debuff {
                background: #1e293b !important;
                color: #fda4af !important;
                border: 1px solid #475569 !important;
                border-radius: 3px !important;
                font-size: 10px !important;
                padding: 0 4px !important;
                margin: 0 !important;
                height: 20px !important;
                min-height: 20px !important;
                max-height: 20px !important;
                line-height: 18px !important;
                outline: none !important;
                cursor: pointer !important;
                width: auto !important;
                max-width: 62px !important;
                vertical-align: middle !important;
                display: inline-block !important;
                box-sizing: border-box !important;
            }
            .r20-viewport-toolbar .r20-btn-icon {
                margin: 0 !important;
                height: 20px !important;
                min-height: 20px !important;
                line-height: 18px !important;
                padding: 0 5px !important;
                font-size: 10px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-sizing: border-box !important;
            }

            /* Buff 列表项 */
            .r20-buff-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                margin-bottom: 4px;
                border-radius: 4px;
                transition: background 0.12s ease, outline 0.12s ease, box-shadow 0.12s ease;
                cursor: pointer;
                user-select: none;
                position: relative;
            }

            /* 内部高亮：激活状态 */
            .r20-buff-item.is-active {
                background: #1e3a8a !important;
                border-left: 3px solid #60a5fa !important;
                box-shadow: inset 0 0 12px rgba(59, 130, 246, 0.25) !important;
            }
            .r20-buff-item.is-active:hover {
                background: #2563eb !important;
            }
            .r20-buff-item.is-active .r20-buff-name {
                color: #ffffff !important;
                font-weight: 600;
            }
            .r20-buff-item.is-active .r20-buff-rounds {
                color: #93c5fd !important;
            }

            /* Debuff 专属警示红底高亮：激活状态 */
            .r20-buff-item.is-debuff.is-active {
                background: #881337 !important;
                border-left: 3px solid #f43f5e !important;
                box-shadow: inset 0 0 12px rgba(244, 63, 94, 0.25) !important;
            }
            .r20-buff-item.is-debuff.is-active:hover {
                background: #9f1239 !important;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-name {
                color: #ffe4e6 !important;
                font-weight: 600;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-rounds {
                color: #fca5a5 !important;
            }

            /* 未激活状态：暗底静默 */
            .r20-buff-item.is-inactive {
                background: #1e293b !important;
                border-left: 3px solid #475569 !important;
                opacity: 0.75;
            }
            .r20-buff-item.is-inactive:hover {
                background: #334155 !important;
                opacity: 1;
            }
            .r20-buff-item.is-inactive .r20-buff-name {
                color: #cbd5e1 !important;
            }
            .r20-buff-item.is-inactive .r20-buff-rounds {
                color: #64748b !important;
            }

            /* 外框高亮：选中状态 (可与激活/未激活叠加) */
            .r20-buff-item.is-selected {
                outline: 2px solid #38bdf8 !important;
                outline-offset: -1px !important;
                box-shadow: 0 0 8px rgba(56, 189, 248, 0.6) !important;
                z-index: 2;
            }

            /* 拖拽排序落点指示线 */
            .r20-buff-item.r20-drag-insert-before {
                border-top: 2px solid #38bdf8 !important;
            }
            .r20-buff-item.r20-drag-insert-after {
                border-bottom: 2px solid #38bdf8 !important;
            }

            .r20-buff-left {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1 1 auto;
                min-width: 0;
            }
            .r20-buff-name {
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .r20-buff-rounds {
                display: inline-flex;
                align-items: center;
                gap: 1px;
                font-size: 10px;
                color: #90caf9;
                white-space: nowrap;
                padding: 1px 4px;
                background: rgba(144, 202, 249, 0.12);
                border-radius: 3px;
                flex-shrink: 0;
                user-select: none;
            }
            .r20-buff-round-num {
                cursor: pointer;
                padding: 0 2px;
                border-radius: 2px;
                transition: background 0.12s ease, color 0.12s ease;
            }
            .r20-buff-round-num:hover {
                background: rgba(56, 189, 248, 0.25);
                color: #38bdf8 !important;
                text-decoration: underline;
            }
            .r20-buff-round-sep {
                opacity: 0.6;
                padding: 0 1px;
            }
            .r20-input-round-inline {
                width: 38px;
                min-width: 28px;
                max-width: 65px;
                height: 16px;
                line-height: 16px;
                padding: 0 2px;
                font-size: 10px;
                font-family: inherit;
                text-align: center;
                border: 1px solid #38bdf8;
                background: #0f172a;
                color: #f8fafc;
                border-radius: 2px;
                outline: none;
                box-shadow: 0 0 5px rgba(56, 189, 248, 0.5);
                box-sizing: border-box;
            }
            .r20-buff-toggle {
                margin: 0 4px 0 0;
                cursor: pointer;
                width: 14px;
                height: 14px;
                flex-shrink: 0;
                accent-color: #38bdf8;
            }
            .r20-selection-marquee {
                position: fixed;
                border: 1px solid #38bdf8;
                background: rgba(56, 189, 248, 0.18);
                pointer-events: none;
                z-index: 999999;
                border-radius: 2px;
                box-shadow: 0 0 6px rgba(56, 189, 248, 0.4);
            }

            /* 链接标识 (🔗 + Token 头像) */
            .r20-buff-link-badge {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                font-size: 10px;
                color: #81d4fa;
                cursor: pointer;
                background: rgba(2, 136, 209, 0.15);
                padding: 1px 4px;
                border-radius: 3px;
                margin-left: 4px;
                flex-shrink: 0;
            }
            .r20-buff-link-badge:hover {
                background: rgba(2, 136, 209, 0.35);
                color: #e1f5fe;
            }
            .r20-buff-host-avatar {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                object-fit: cover;
                vertical-align: middle;
            }

            /* 负面状态 (Debuff / Condition) 胶囊徽章 */
            .r20-buff-pill-debuff {
                display: inline-flex !important;
                align-items: center !important;
                background: #881337 !important;
                border: 1px solid #f43f5e !important;
                color: #ffe4e6 !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                padding: 2px 7px !important;
                border-radius: 4px !important;
                cursor: pointer !important;
                user-select: none !important;
                white-space: nowrap !important;
                transition: background 0.15s, border-color 0.15s !important;
            }
            .r20-buff-pill-debuff:hover {
                background: #be123c !important;
                border-color: #fda4af !important;
                color: #ffffff !important;
            }

            /* 右键上下文菜单 */
            .r20-context-menu {
                position: fixed;
                z-index: 10050;
                background: #1a232c;
                border: 1px solid #37474f;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                border-radius: 6px;
                padding: 4px 0;
                min-width: 150px;
                font-size: 12px;
                color: #cfd8dc;
            }
            .r20-context-menu-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                cursor: pointer;
                transition: background 0.1s;
            }
            .r20-context-menu-item:hover {
                background: #263238;
                color: #90caf9;
            }
            .r20-context-menu-divider {
                height: 1px;
                background: #2d3846;
                margin: 4px 0;
            }

            /* 空状态占位 */
            .r20-empty-view {
                text-align: center;
                padding: 30px 15px;
                color: #78909c;
                font-size: 11px;
                line-height: 1.6;
            }

            /* 提示 Toast */
            .r20-suite-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(20, 27, 34, 0.95);
                color: #fff;
                padding: 6px 14px;
                border-radius: 6px;
                font-size: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                z-index: 10200;
                border-left: 3px solid #29b6f6;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }

            /* 对话框模态层（原汁原味继承 e3a4247，z-index 10100 克制安全） */
            .r20-dialog-mask {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.65);
                z-index: 10100;
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
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
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
}
