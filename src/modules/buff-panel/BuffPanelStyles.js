/**
 * BuffPanelStyles.js
 * 贴近 Roll20 原生浅色白底灰框质感的专属样式表
 * 包含：原生尺寸拖拽缩放、左右双栏标签、视口工具条、Debuff Popover 自适应流式标签云、Buff 自适应 Grid 多列排版、影子链接徽章与右键菜单
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
            /* ==========================================================================
               主悬浮窗与派生独立工作台容器（Roll20 原生浅色卡片外观，支持右下角自由缩放）
               ========================================================================== */
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
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
                color: #333333;
                user-select: none;
                box-sizing: border-box;
                display: flex !important;
                flex-direction: column !important;
                background: #ffffff !important;
                border: 1px solid #c7c7c7 !important;
                border-radius: 4px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            }

            /* 标题栏（拖拽句柄，Roll20 浅灰底） */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #f2f2f2;
                border-bottom: 1px solid #dcdcdc;
                cursor: grab;
                box-sizing: border-box;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
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
                color: #333333;
            }

            .r20-panel-controls {
                display: flex;
                align-items: center;
                gap: 3px;
            }

            /* Roll20 原生小按钮基底 */
            .r20-btn-icon, .r20-btn {
                background: #ffffff !important;
                border: 1px solid #d0d0d0 !important;
                color: #444444 !important;
                cursor: pointer;
                padding: 2px 6px !important;
                border-radius: 3px !important;
                font-size: 11px !important;
                line-height: 1.2 !important;
                font-family: inherit !important;
                transition: background 0.1s, border-color 0.1s, color 0.1s;
                box-sizing: border-box !important;
            }
            .r20-btn-icon:hover, .r20-btn:hover {
                background: #f5f5f5 !important;
                border-color: #b5b5b5 !important;
                color: #111111 !important;
            }
            .r20-btn-icon.pinned {
                color: #b45309 !important;
                background: #fef3c7 !important;
                border-color: #fcd34d !important;
            }

            /* 抽屉式内容折叠容器 */
            .r20-panel-content-drawer {
                background: #ffffff;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
            }

            /* ==========================================================================
               顶部选项卡栏（Roll20 风格浅灰标签槽）
               ========================================================================== */
            .r20-tab-strip {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: #ebebeb !important;
                padding: 4px 6px 0 6px !important;
                border-bottom: 1px solid #dcdcdc !important;
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

            /* 靠左动态选区标签容器 */
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
                scrollbar-color: #cccccc transparent !important;
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
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-thumb:hover {
                background: #aaaaaa !important;
            }

            /* 靠右固定常驻角色标签容器 */
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
                scrollbar-color: #cccccc transparent !important;
                padding: 0 0 2px 4px !important;
                margin: 0 !important;
                border-left: 1px solid #d5d5d5 !important;
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
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-thumb:hover {
                background: #aaaaaa !important;
            }
            .r20-tabs-pinned:empty {
                min-width: 24px !important;
                height: 36px !important;
                border: 1px dashed rgba(0, 0, 0, 0.2) !important;
                border-radius: 3px !important;
                margin-left: 3px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                opacity: 0.6 !important;
                transition: all 0.15s ease !important;
            }
            .r20-tabs-pinned:empty::after {
                content: "📌" !important;
                font-size: 11px !important;
                opacity: 0.5 !important;
                pointer-events: none !important;
            }
            .r20-tabs-pinned:empty:hover,
            .r20-tabs-pinned.r20-pin-zone-hover {
                opacity: 1 !important;
                background: #e0f2fe !important;
                border-color: #0284c7 !important;
            }

            /* 单个选项卡（方形棋子头像设计，微圆角 3px） */
            .r20-tab {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 36px !important;
                height: 36px !important;
                min-width: 36px !important;
                min-height: 36px !important;
                padding: 2px !important;
                background: #f9f9f9 !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                border: 1px solid #d0d0d0 !important;
                transition: background 0.1s, border-color 0.1s !important;
                position: relative !important;
                box-sizing: border-box !important;
                flex-shrink: 0 !important;
            }
            .r20-tab:hover {
                background: #ffffff !important;
                border-color: #b0b0b0 !important;
            }
            .r20-tab.active {
                background: #ffffff !important;
                border-color: #2563eb !important;
                border-width: 2px !important;
                padding: 1px !important;
                z-index: 2 !important;
            }
            .r20-tab.selected-highlight {
                border-color: #2563eb !important;
            }
            .r20-tab.active.selected-highlight {
                border-color: #1d4ed8 !important;
            }
            .r20-tab-avatar-box {
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: hidden !important;
                border-radius: 2px !important;
                pointer-events: none !important;
            }
            .r20-tab-avatar {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                display: block !important;
                border-radius: 2px !important;
            }
            .r20-tab-avatar-fallback {
                width: 100% !important;
                height: 100% !important;
                /* 显隐由内联 display 样式全权控制（getAvatarHtml 初始渲染与 img onerror 回调）：
                   此处绝不能声明 display，否则 !important 会压过内联 display:none，
                   导致有头像图时首字回退块与图片同时显示 */
                align-items: center !important;
                justify-content: center !important;
                background: #e2e8f0 !important;
                color: #475569 !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                border-radius: 2px !important;
            }
            .r20-tab-close,
            .r20-tab-pin {
                position: absolute !important;
                top: -4px !important;
                right: -4px !important;
                width: 14px !important;
                height: 14px !important;
                border-radius: 50% !important;
                background: #94a3b8 !important;
                color: #ffffff !important;
                font-size: 9px !important;
                line-height: 14px !important;
                text-align: center !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
                z-index: 5 !important;
                cursor: pointer !important;
                user-select: none !important;
            }
            .r20-tab:hover .r20-tab-close,
            .r20-tab:hover .r20-tab-pin {
                display: flex !important;
            }
            .r20-tab-close:hover {
                background: #ef4444 !important;
            }
            .r20-tab-pin:hover {
                background: #2563eb !important;
            }
            .r20-tab.r20-tab-drag-hover {
                background: #eff6ff !important;
                outline: 2px dashed #3b82f6;
            }

            /* ==========================================================================
               视口区与顶部操作条
               ========================================================================== */
            .r20-tab-viewport {
                flex: 1 1 auto;
                min-height: 0;
                padding: 6px 8px;
                overflow-y: auto;
                box-sizing: border-box;
                background: #ffffff;
            }

            .r20-viewport-toolbar {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 3px 0 5px 0 !important;
                margin-bottom: 5px !important;
                border-bottom: 1px solid #e5e5e5 !important;
                font-size: 11px !important;
                color: #666666 !important;
                flex-shrink: 0 !important;
                box-sizing: border-box !important;
            }
            .r20-toolbar-target-name {
                display: flex !important;
                align-items: center !important;
                font-weight: 600 !important;
                color: #333333 !important;
                max-width: 160px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                line-height: 1.2 !important;
                font-size: 12px !important;
            }

            /* Debuff 下拉触发按钮（Roll20 浅色粉红风格） */
            .r20-btn-debuff-trigger {
                background: #fff1f2 !important;
                border: 1px solid #fecdd3 !important;
                color: #e11d48 !important;
                font-size: 11px !important;
                height: 22px !important;
                line-height: 20px !important;
                padding: 0 6px !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                box-sizing: border-box !important;
                transition: background 0.1s, border-color 0.1s !important;
            }
            .r20-btn-debuff-trigger:hover,
            .r20-btn-debuff-trigger.active {
                background: #ffe4e6 !important;
                border-color: #fb7185 !important;
                color: #be123c !important;
            }

            /* ==========================================================================
               Debuff Popover Grid（流式标签云网格，Roll20 浅色白底风格）
               ========================================================================== */
            .r20-popover-grid-container {
                position: fixed !important;
                z-index: 10060 !important;
                width: 310px !important;
                max-width: 90vw !important;
                max-height: 280px !important;
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 4px !important;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
                box-sizing: border-box !important;
            }
            .r20-popover-grid-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 5px 8px !important;
                background: #f8fafc !important;
                border-bottom: 1px solid #e2e8f0 !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: #be123c !important;
                flex-shrink: 0 !important;
            }
            .r20-popover-grid-header .btn-close-popover {
                background: transparent !important;
                border: none !important;
                color: #888888 !important;
                cursor: pointer !important;
                font-size: 12px !important;
                padding: 0 4px !important;
            }
            .r20-popover-grid-header .btn-close-popover:hover {
                color: #111111 !important;
            }
            .r20-popover-grid-body {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 3px 4px !important;
                padding: 6px !important;
                overflow-y: auto !important;
                max-height: 220px !important;
                box-sizing: border-box !important;
                scrollbar-width: thin !important;
                scrollbar-color: #cccccc transparent !important;
            }
            .r20-popover-grid-body::-webkit-scrollbar {
                width: 4px !important;
            }
            .r20-popover-grid-body::-webkit-scrollbar-thumb {
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-popover-grid-item {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: auto !important;
                flex: 0 0 auto !important;
                background: #fff1f2 !important;
                border: 1px solid #fecdd3 !important;
                color: #be123c !important;
                font-size: 11px !important;
                line-height: 16px !important;
                padding: 2px 6px !important;
                border-radius: 2px !important;
                cursor: pointer !important;
                user-select: none !important;
                white-space: nowrap !important;
                transition: background 0.1s, border-color 0.1s, color 0.1s !important;
                box-sizing: border-box !important;
            }
            .r20-popover-grid-item:hover {
                background: #f43f5e !important;
                border-color: #e11d48 !important;
                color: #ffffff !important;
            }

            /* ==========================================================================
               Buff / Debuff 自适应响应式网格 (Auto-Fit CSS Grid)
               狭窄单列，拉宽自适应双列或三列
               ========================================================================== */
            .r20-buff-list,
            .r20-debuff-list {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
                gap: 3px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            /* Buff 与负面状态之间的极简分割线（无大标题） */
            .r20-buff-divider {
                height: 1px !important;
                background: #e5e5e5 !important;
                margin: 5px 0 !important;
                flex-shrink: 0 !important;
                width: 100% !important;
            }

            /* 单个 Buff/Debuff 条目卡片（紧凑高 26px，微圆角 3px，Roll20 原生浅色风格） */
            .r20-buff-item {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 3px 6px !important;
                border-radius: 3px !important;
                min-height: 26px !important;
                box-sizing: border-box !important;
                cursor: pointer !important;
                user-select: none !important;
                position: relative !important;
                transition: background 0.1s, border-color 0.1s !important;
                border: 1px solid transparent !important;
            }

            /* 未激活状态：柔和浅灰底 */
            .r20-buff-item.is-inactive {
                background: #f8fafc !important;
                border: 1px solid #e2e8f0 !important;
                border-left: 3px solid #94a3b8 !important;
                opacity: 0.85 !important;
            }
            .r20-buff-item.is-inactive:hover {
                background: #f1f5f9 !important;
                opacity: 1 !important;
            }
            .r20-buff-item.is-inactive .r20-buff-name {
                color: #475569 !important;
            }
            .r20-buff-item.is-inactive .r20-buff-rounds {
                color: #64748b !important;
            }

            /* 激活状态：正面 Buff（清爽淡蓝底 + 鲜明蓝字） */
            .r20-buff-item.is-active {
                background: #eff6ff !important;
                border: 1px solid #bfdbfe !important;
                border-left: 3px solid #2563eb !important;
            }
            .r20-buff-item.is-active:hover {
                background: #dbeafe !important;
            }
            .r20-buff-item.is-active .r20-buff-name {
                color: #1e3a8a !important;
                font-weight: 500 !important;
            }
            .r20-buff-item.is-active .r20-buff-rounds {
                color: #1d4ed8 !important;
            }

            /* 激活状态：负面 Debuff（柔和淡粉底 + 警示红字） */
            .r20-buff-item.is-debuff.is-active {
                background: #fef2f2 !important;
                border: 1px solid #fecaca !important;
                border-left: 3px solid #ef4444 !important;
            }
            .r20-buff-item.is-debuff.is-active:hover {
                background: #fee2e2 !important;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-name {
                color: #991b1b !important;
                font-weight: 500 !important;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-rounds {
                color: #b91c1c !important;
            }

            /* 选中状态：干净利落的聚焦蓝框 */
            .r20-buff-item.is-selected {
                outline: 1px solid #2563eb !important;
                outline-offset: -1px !important;
                z-index: 2 !important;
            }

            /* 拖拽排序指示线 */
            .r20-buff-item.r20-drag-insert-before {
                border-top: 2px solid #2563eb !important;
            }
            .r20-buff-item.r20-drag-insert-after {
                border-bottom: 2px solid #2563eb !important;
            }

            .r20-buff-left {
                display: flex !important;
                align-items: center !important;
                gap: 4px !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
            }
            .r20-buff-name {
                font-size: 11px !important;
                font-weight: 500 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
            }

            /* 轮数徽章 */
            .r20-buff-rounds {
                display: inline-flex !important;
                align-items: center !important;
                gap: 1px !important;
                font-size: 10px !important;
                color: #2563eb !important;
                white-space: nowrap !important;
                padding: 1px 4px !important;
                background: rgba(37, 99, 235, 0.08) !important;
                border-radius: 2px !important;
                flex-shrink: 0 !important;
                user-select: none !important;
            }
            .r20-buff-round-num {
                cursor: pointer !important;
                padding: 0 1px !important;
                border-radius: 2px !important;
            }
            .r20-buff-round-num:hover {
                background: rgba(37, 99, 235, 0.15) !important;
                color: #1d4ed8 !important;
                text-decoration: underline !important;
            }
            .r20-buff-round-sep {
                opacity: 0.5 !important;
                padding: 0 1px !important;
            }

            /* 就地轮数输入框 */
            .r20-input-round-inline {
                width: 36px !important;
                min-width: 28px !important;
                max-width: 60px !important;
                height: 16px !important;
                line-height: 16px !important;
                padding: 0 2px !important;
                font-size: 10px !important;
                font-family: inherit !important;
                text-align: center !important;
                border: 1px solid #2563eb !important;
                background: #ffffff !important;
                color: #1e3a8a !important;
                border-radius: 2px !important;
                outline: none !important;
                box-sizing: border-box !important;
            }
            .r20-buff-toggle {
                margin: 0 3px 0 0 !important;
                cursor: pointer !important;
                width: 13px !important;
                height: 13px !important;
                flex-shrink: 0 !important;
                accent-color: #2563eb !important;
            }

            /* 框选矩形 (Marquee Selection) */
            .r20-selection-marquee {
                position: fixed !important;
                border: 1px solid #2563eb !important;
                background: rgba(37, 99, 235, 0.12) !important;
                pointer-events: none !important;
                z-index: 999999 !important;
                border-radius: 2px !important;
            }

            /* 影子链接徽章 (🔗 + 头像) */
            .r20-buff-link-badge {
                display: inline-flex !important;
                align-items: center !important;
                gap: 2px !important;
                font-size: 10px !important;
                color: #2563eb !important;
                cursor: pointer !important;
                background: rgba(37, 99, 235, 0.08) !important;
                padding: 1px 3px !important;
                border-radius: 2px !important;
                flex-shrink: 0 !important;
            }
            .r20-buff-link-badge:hover {
                background: rgba(37, 99, 235, 0.2) !important;
                color: #1d4ed8 !important;
            }
            .r20-buff-host-avatar {
                width: 13px !important;
                height: 13px !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                vertical-align: middle !important;
            }

            /* ==========================================================================
               右键菜单与对话框模态层（Roll20 浅色原生弹窗风格）
               ========================================================================== */
            .r20-context-menu {
                position: fixed !important;
                z-index: 10050 !important;
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
                border-radius: 4px !important;
                padding: 4px 0 !important;
                min-width: 140px !important;
                font-size: 11px !important;
                color: #333333 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }
            .r20-context-menu-item {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 5px 12px !important;
                cursor: pointer !important;
                transition: background 0.1s !important;
            }
            .r20-context-menu-item:hover {
                background: #f1f5f9 !important;
                color: #2563eb !important;
            }
            .r20-context-menu-divider {
                height: 1px !important;
                background: #e5e5e5 !important;
                margin: 3px 0 !important;
            }

            /* 空状态提示 */
            .r20-empty-view {
                text-align: center !important;
                padding: 24px 12px !important;
                color: #888888 !important;
                font-size: 11px !important;
                line-height: 1.5 !important;
            }

            /* Toast 提示 */
            .r20-suite-toast {
                position: fixed !important;
                bottom: 24px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: #333333 !important;
                color: #ffffff !important;
                padding: 5px 12px !important;
                border-radius: 4px !important;
                font-size: 11px !important;
                box-shadow: 0 4px 14px rgba(0,0,0,0.2) !important;
                z-index: 10200 !important;
                border: 1px solid #444444 !important;
                border-left: 3px solid #2563eb !important;
                pointer-events: none !important;
                transition: opacity 0.2s ease !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }

            /* 对话框模态层（Roll20 原生弹窗规范） */
            .r20-dialog-mask {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.4) !important;
                z-index: 10100 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .r20-dialog-box {
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 4px !important;
                width: 440px !important;
                max-width: 90vw !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
                color: #333333 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }
            .r20-dialog-header {
                padding: 8px 12px !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                border-bottom: 1px solid #e5e5e5 !important;
                background: #f8fafc !important;
                color: #333333 !important;
            }
            .r20-dialog-body {
                padding: 10px 12px !important;
                overflow-y: auto !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            }
            .r20-dialog-footer {
                padding: 8px 12px !important;
                border-top: 1px solid #e5e5e5 !important;
                display: flex !important;
                justify-content: flex-end !important;
                gap: 6px !important;
                background: #f8fafc !important;
            }
            .r20-input-text {
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 3px !important;
                color: #333333 !important;
                padding: 4px 6px !important;
                font-size: 11px !important;
                outline: none !important;
            }
            .r20-input-text:focus {
                border-color: #2563eb !important;
            }
            .r20-textarea-json {
                background: #f8fafc !important;
                border: 1px solid #cccccc !important;
                border-radius: 3px !important;
                color: #166534 !important;
                font-family: monospace !important;
                padding: 4px 6px !important;
                font-size: 11px !important;
                height: 120px !important;
                outline: none !important;
                resize: vertical !important;
            }
            .r20-textarea-json:focus {
                border-color: #2563eb !important;
            }
            .r20-btn-apply {
                background: #2563eb !important;
                color: #ffffff !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                padding: 4px 10px !important;
                border-radius: 3px !important;
                border: 1px solid #1d4ed8 !important;
                cursor: pointer !important;
            }
            .r20-btn-apply:hover {
                background: #1d4ed8 !important;
            }

            /* ==========================================================================
               Roll20 侧边栏设置抽屉原生折叠箭头规范 (Font Awesome 5 Free)
               ========================================================================== */
            .r20-suite-settings-panel .accordion-toggle {
                display: block !important;
                text-decoration: none !important;
                color: #333333 !important;
            }
            .r20-suite-settings-panel .panel-heading:hover .accordion-toggle {
                text-decoration: underline !important;
            }
            .r20-suite-settings-panel .accordion-toggle::after {
                font-family: "Font Awesome 5 Free" !important;
                font-weight: 700 !important;
                content: "\\f077" !important;
                float: right !important;
                color: gray !important;
                font-size: 16px !important;
                line-height: inherit !important;
            }
            .r20-suite-settings-panel .accordion-toggle.collapsed::after {
                content: "\\f078" !important;
            }
        `;
    }
}
