import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";

/**
 * SuiteSettingsPanel.js
 * 负责在 Roll20 侧边栏设置页面 (#settings-accordion / #mysettings) 中注入专属设置栏目
 * 严格遵循 DOM 就近语义锚点规范与高韧性注入原则
 */
export class SuiteSettingsPanel {
    static isInitialized = false;
    static observer = null;

    /**
     * 初始化设置面板注入
     */
    static init() {
        if (this.isInitialized) return;
        this.injectSettingsSection();
        this.startObserver();
        this.isInitialized = true;
        console.log("[SuiteSettingsPanel] 房间设置面板注入模块已就绪");
    }

    /**
     * 持久监听设置页 DOM，防止页面或标签切换导致注入元素脱失
     */
    static startObserver() {
        if (this.observer) this.observer.disconnect();

        this.observer = new MutationObserver((mutations) => {
            const target = document.querySelector("#settings-accordion") || document.querySelector("#mysettings");
            if (target && !document.querySelector("#panel_roll20_suite")) {
                this.injectSettingsSection();
            }
        });

        const sidebar = document.querySelector("#rightsidebar") || document.body;
        this.observer.observe(sidebar, { childList: true, subtree: true });
    }

    /**
     * 执行具体 DOM 注入
     */
    static injectSettingsSection() {
        const container = document.querySelector("#settings-accordion") || document.querySelector("#mysettings");
        if (!container || document.querySelector("#panel_roll20_suite")) return;

        const settings = SuiteConfigStore.getSettings();

        const panel = document.createElement("div");
        panel.id = "panel_roll20_suite";
        panel.className = "panel panel-default r20-suite-settings-panel";
        panel.style.cssText = "margin-bottom: 5px; border: 1px solid #37474f; background: #1e293b; border-radius: 4px; overflow: hidden;";

        panel.innerHTML = `
            <div id="panel_heading_suite" class="panel-heading" style="cursor: pointer; padding: 10px 15px; background: #0f172a; border-bottom: 1px solid #334155; user-select: none;">
                <h4 class="panel-title" style="margin: 0; font-size: 13px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
                    <span>🛠️ Roll20 Suite 插件设置</span>
                    <span class="r20-suite-arrow" style="font-size: 11px; color: #94a3b8;">▾</span>
                </h4>
            </div>
            <div id="collapseRoll20Suite" class="panel-collapse" style="display: block; padding: 12px 16px; font-size: 12px; color: #e2e8f0;">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- 设置项 1: 先攻条 Buff 首字缩写 -->
                    <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin: 0; font-weight: normal;">
                        <div style="padding-right: 8px;">
                            <span style="font-weight: 600; color: #f8fafc; font-size: 12px;">先攻条 Buff 首字缩写</span>
                            <div style="font-size: 11px; color: #94a3b8; line-height: 1.3; margin-top: 2px;">在先攻栏仅显示首字，鼠标悬停 Tooltip 呈现完整名称与轮数</div>
                        </div>
                        <input type="checkbox" id="setting_turnorder_buff_abbr" ${settings.turnorder_buff_abbr ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px; flex-shrink: 0;">
                    </label>

                    <div style="height: 1px; background: #334155;"></div>

                    <!-- 设置项 2: 防抖自动重算 -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin: 0; font-weight: normal;">
                            <div style="padding-right: 8px;">
                                <span style="font-weight: 600; color: #f8fafc; font-size: 12px;">Buff 修改后防抖自动重算</span>
                                <div style="font-size: 11px; color: #94a3b8; line-height: 1.3; margin-top: 2px;">连续修改 Buff 时不频繁计算，静止指定延时后自动触发</div>
                            </div>
                            <input type="checkbox" id="setting_debounce_recalc_enabled" ${settings.debounce_recalc_enabled ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px; flex-shrink: 0;">
                        </label>
                        <div id="wrapper_debounce_ms" style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #cbd5e1; padding-left: 8px; ${settings.debounce_recalc_enabled ? "" : "opacity: 0.5; pointer-events: none;"}">
                            <span>静止触发延时 (毫秒)</span>
                            <input type="number" id="setting_debounce_recalc_ms" value="${settings.debounce_recalc_ms || 2000}" min="500" max="10000" step="500" style="width: 75px; padding: 2px 6px; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 12px; text-align: right;">
                        </div>
                    </div>

                    <div style="height: 1px; background: #334155;"></div>

                    <!-- 设置项 3: Buff 列表快捷复选框 -->
                    <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin: 0; font-weight: normal;">
                        <div style="padding-right: 8px;">
                            <span style="font-weight: 600; color: #f8fafc; font-size: 12px;">显示 Buff 快捷启停复选框</span>
                            <div style="font-size: 11px; color: #94a3b8; line-height: 1.3; margin-top: 2px;">在 Buff 条目名称前呈现勾选框以快捷启停；关闭时可通过双击条目快速切换</div>
                        </div>
                        <input type="checkbox" id="setting_buff_show_checkbox" ${settings.buff_show_checkbox ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px; flex-shrink: 0;">
                    </label>

                    <div style="height: 1px; background: #334155;"></div>

                    <!-- 设置项 4: 队友之间的 Buff 互相可见 -->
                    <label style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin: 0; font-weight: normal;">
                        <div style="padding-right: 8px;">
                            <span style="font-weight: 600; color: #f8fafc; font-size: 12px;">队友之间的 Buff 互相可见</span>
                            <div style="font-size: 11px; color: #94a3b8; line-height: 1.3; margin-top: 2px;">允许队伍成员（角色卡已勾选“隊員”）在面板与先攻栏互相查看 Buff 状态（只读）</div>
                        </div>
                        <input type="checkbox" id="setting_party_buffs_visible" ${settings.party_buffs_visible ? "checked" : ""} style="cursor: pointer; width: 16px; height: 16px; flex-shrink: 0;">
                    </label>
                </div>
            </div>
        `;

        // 折叠/展开切换
        const heading = panel.querySelector("#panel_heading_suite");
        const bodyCollapse = panel.querySelector("#collapseRoll20Suite");
        const arrow = panel.querySelector(".r20-suite-arrow");
        let isBodyCollapsed = false;

        heading.addEventListener("click", () => {
            isBodyCollapsed = !isBodyCollapsed;
            bodyCollapse.style.display = isBodyCollapsed ? "none" : "block";
            arrow.textContent = isBodyCollapsed ? "▸" : "▾";
        });

        // 绑定事件
        const chkAbbr = panel.querySelector("#setting_turnorder_buff_abbr");
        chkAbbr.addEventListener("change", (e) => {
            SuiteConfigStore.setSetting("turnorder_buff_abbr", e.target.checked);
        });

        const chkDebounce = panel.querySelector("#setting_debounce_recalc_enabled");
        const wrapperMs = panel.querySelector("#wrapper_debounce_ms");
        const inputMs = panel.querySelector("#setting_debounce_recalc_ms");

        chkDebounce.addEventListener("change", (e) => {
            const enabled = e.target.checked;
            SuiteConfigStore.setSetting("debounce_recalc_enabled", enabled);
            wrapperMs.style.opacity = enabled ? "1" : "0.5";
            wrapperMs.style.pointerEvents = enabled ? "auto" : "none";
        });

        inputMs.addEventListener("change", (e) => {
            const val = Math.max(500, Math.min(10000, Number(e.target.value) || 2000));
            inputMs.value = val;
            SuiteConfigStore.setSetting("debounce_recalc_ms", val);
        });

        const chkShowCheckbox = panel.querySelector("#setting_buff_show_checkbox");
        chkShowCheckbox?.addEventListener("change", (e) => {
            SuiteConfigStore.setSetting("buff_show_checkbox", e.target.checked);
        });

        const chkPartyBuffs = panel.querySelector("#setting_party_buffs_visible");
        chkPartyBuffs?.addEventListener("change", (e) => {
            SuiteConfigStore.setSetting("party_buffs_visible", e.target.checked);
        });

        container.appendChild(panel);
    }
}
