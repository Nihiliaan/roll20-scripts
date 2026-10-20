/**
 * BuffPanelTemplates.js
 * 状态Buff工作台 HTML 结构模板生成器
 */
export class BuffPanelTemplates {
    /**
     * 生成主面板 HTML 骨架
     */
    static getMainPanelHTML({ isPinned, isCollapsed, isTemplatePaneCollapsed, isUnitPaneCollapsed }) {
        const pinTitle = isPinned ? "取消固定(移出自动折叠)" : "固定常驻显示";
        const minimizeIcon = isCollapsed ? "+" : "-";
        const minimizeTitle = isCollapsed ? "展开面板" : "折叠面板(仅留标题)";

        return `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff工作台</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-pin ${isPinned ? "pinned" : ""}" title="${pinTitle}">📌</button>
                    <button class="r20-btn-icon btn-toggle-edit" title="进入/退出编辑模式">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="${minimizeTitle}">${minimizeIcon}</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <!-- 模板库栏 -->
                <div class="r20-split-pane r20-template-pane">
                    <div class="r20-pane-header">
                        <div class="r20-pane-title">
                            <span class="toggle-icon">${isTemplatePaneCollapsed ? "▶" : "▼"}</span>
                            <span>📚 Buff 模板库</span>
                        </div>
                    </div>
                    <div class="r20-panel-toolbar" style="display: none;">
                        <div style="display:flex; gap:4px;">
                            <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                            <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                            <button class="r20-btn-icon btn-import-buffs" title="从战役角色卡导入Buff">📥 导入卡上Buff</button>
                        </div>
                        <button class="r20-btn-icon danger btn-batch-delete" title="批量删除选中的高亮项">🗑️ 批量删除</button>
                    </div>
                    <div class="r20-pane-content r20-template-tree" style="display: ${isTemplatePaneCollapsed ? 'none' : 'flex'};"></div>
                </div>

                <!-- 当前单位生效 Buff 栏 -->
                <div class="r20-split-pane r20-unit-pane">
                    <div class="r20-pane-header">
                        <div class="r20-pane-title">
                            <span class="toggle-icon">${isUnitPaneCollapsed ? "▶" : "▼"}</span>
                            <span>🎯 当前单位 Buff</span>
                        </div>
                        <span class="unit-pane-summary" style="font-size:10px; color:#90caf9;">未选择棋子</span>
                    </div>
                    <div class="r20-pane-content r20-unit-tree" style="display: ${isUnitPaneCollapsed ? 'none' : 'flex'};"></div>
                </div>
            </div>
        `;
    }

    /**
     * 生成新建/编辑 Buff 对话框 HTML
     */
    static getBuffEditorModalHTML({ isEditing, currentName, currentRounds, currentJson }) {
        return `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${isEditing ? "编辑 Buff 模板" : "新建 Buff 模板"}</div>
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
    }

    /**
     * 生成导入对话框 HTML
     */
    static getImportModalHTML({ charName, folders, cardBuffs }) {
        return `
            <div class="r20-dialog-box" style="width: 480px;">
                <div class="r20-dialog-header">从 [${charName}] 导入 Buff</div>
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
    }
}
