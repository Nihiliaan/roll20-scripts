/**
 * BuffPanelTemplates.js
 * 现代化浏览器式单栏多标签工作台 DOM 模板
 */
export class BuffPanelTemplates {
    /**
     * 生成主调度工作台基础 HTML 骨架
     */
    static getPanelHtml() {
        return `
            <div class="r20-panel-header" title="按住拖拽移动工作台">
                <div class="r20-panel-title">
                    <span>Buff 调度器</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-pin" title="固定面板（鼠标移开不自动收起）">📌</button>
                    <button class="r20-btn-icon btn-recalc-all" title="手动重新计算所有选中单位的加值 (recalc1)">🔄</button>
                    
                </div>
            </div>
            <div class="r20-panel-content-drawer">
                <div class="r20-tab-strip">
                    <div class="r20-tabs-dynamic" title="当前画布选中单位（靠左展示，可向右拖拽固定）"></div>
                    <div class="r20-tabs-pinned" title="固定常驻角色（靠右展示，可拖拽或点击棋子钉选）"></div>
                </div>
                <div class="r20-tab-viewport">
                    <div class="r20-empty-view">正在连接单位数据...</div>
                </div>
            </div>
        `.trim();
    }
}
