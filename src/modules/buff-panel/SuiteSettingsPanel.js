import { SuiteConfigStore } from "../../core/SuiteConfigStore.js";

/**
 * SuiteSettingsPanel.js
 * 负责在 Roll20 侧边栏设置页面 (#settings-accordion / #mysettings) 中注入专属设置栏目
 * 严格对齐 Roll20 官方 Vue 3 / Element Plus 设置抽屉规范 (//*[@id="settings-accordion"]/div[2])
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

        panel.innerHTML = `
            <div id="panel_heading_suite" class="panel-heading collapsed" data-toggle="collapse" data-parent="#settings-accordion" href="#collapseRoll20Suite" aria-expanded="false" style="cursor: pointer; user-select: none;">
                <h4 class="panel-title">
                    <a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#settings-accordion" href="#collapseRoll20Suite" aria-expanded="false">
                        Roll20 Suite 插件設置
                    </a>
                </h4>
            </div>
            <div id="collapseRoll20Suite" class="panel-collapse collapse" aria-expanded="false" style="height: 0px;">
                <div class="panel-body" style="padding: 12px 16px;">
                    <div>
                        <!-- 设置项 1: 先攻条 Buff 首字缩写 -->
                        <div class="flex-box-row stretch" style="margin-bottom: 12px;">
                            <label for="setting_turnorder_buff_abbr" class="legacy-label" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; margin-bottom: 0;">
                                <div style="padding-right: 12px;">
                                    <span class="prefix-text" style="font-weight: 600; color: #333333; font-size: 12px;">先攻条 Buff 首字缩写</span>
                                    <div style="font-size: 11px; color: #777777; line-height: 1.3; margin-top: 2px;">在先攻栏仅显示首字，鼠标悬停 Tooltip 呈现完整名称与轮数</div>
                                </div>
                                <div class="el-switch ${settings.turnorder_buff_abbr ? "is-checked" : ""}" role="switch" id="switch_turnorder_buff_abbr">
                                    <input class="el-switch__input" type="checkbox" role="switch" aria-checked="${!!settings.turnorder_buff_abbr}" id="setting_turnorder_buff_abbr" ${settings.turnorder_buff_abbr ? "checked" : ""}>
                                    <span class="el-switch__core">
                                        <div class="el-switch__action"></div>
                                    </span>
                                </div>
                            </label>
                        </div>

                        <!-- 设置项 2: 防抖自动重算 -->
                        <div class="flex-box-row stretch" style="margin-bottom: 4px;">
                            <label for="setting_debounce_recalc_enabled" class="legacy-label" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; margin-bottom: 0;">
                                <div style="padding-right: 12px;">
                                    <span class="prefix-text" style="font-weight: 600; color: #333333; font-size: 12px;">Buff 修改后防抖自动重算</span>
                                    <div style="font-size: 11px; color: #777777; line-height: 1.3; margin-top: 2px;">连续修改 Buff 时不频繁计算，静止指定延时后自动触发</div>
                                </div>
                                <div class="el-switch ${settings.debounce_recalc_enabled ? "is-checked" : ""}" role="switch" id="switch_debounce_recalc_enabled">
                                    <input class="el-switch__input" type="checkbox" role="switch" aria-checked="${!!settings.debounce_recalc_enabled}" id="setting_debounce_recalc_enabled" ${settings.debounce_recalc_enabled ? "checked" : ""}>
                                    <span class="el-switch__core">
                                        <div class="el-switch__action"></div>
                                    </span>
                                </div>
                            </label>
                        </div>
                        <div id="wrapper_debounce_ms" style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #555555; padding: 0 4px 12px 4px; ${settings.debounce_recalc_enabled ? "" : "opacity: 0.5; pointer-events: none;"}">
                            <span>静止触发延时 (毫秒)</span>
                            <div class="el-input" style="width: 80px;">
                                <div class="el-input__wrapper">
                                    <input class="el-input__inner" type="number" id="setting_debounce_recalc_ms" value="${settings.debounce_recalc_ms || 2000}" min="500" max="10000" step="500" style="text-align: right; height: 24px;">
                                </div>
                            </div>
                        </div>

                        <!-- 设置项 3: Buff 列表快捷复选框 -->
                        <div class="flex-box-row stretch" style="margin-bottom: 12px;">
                            <label for="setting_buff_show_checkbox" class="legacy-label" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; margin-bottom: 0;">
                                <div style="padding-right: 12px;">
                                    <span class="prefix-text" style="font-weight: 600; color: #333333; font-size: 12px;">显示 Buff 快捷启停复选框</span>
                                    <div style="font-size: 11px; color: #777777; line-height: 1.3; margin-top: 2px;">在 Buff 条目名称前呈现勾选框以快捷启停；关闭时可通过双击条目快速切换</div>
                                </div>
                                <div class="el-switch ${settings.buff_show_checkbox ? "is-checked" : ""}" role="switch" id="switch_buff_show_checkbox">
                                    <input class="el-switch__input" type="checkbox" role="switch" aria-checked="${!!settings.buff_show_checkbox}" id="setting_buff_show_checkbox" ${settings.buff_show_checkbox ? "checked" : ""}>
                                    <span class="el-switch__core">
                                        <div class="el-switch__action"></div>
                                    </span>
                                </div>
                            </label>
                        </div>

                        <!-- 设置项 4: 队友之间的 Buff 互相可见 -->
                        <div class="flex-box-row stretch">
                            <label for="setting_party_buffs_visible" class="legacy-label" style="display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; margin-bottom: 0;">
                                <div style="padding-right: 12px;">
                                    <span class="prefix-text" style="font-weight: 600; color: #333333; font-size: 12px;">队友之间的 Buff 互相可见</span>
                                    <div style="font-size: 11px; color: #777777; line-height: 1.3; margin-top: 2px;">允许队伍成员（角色卡已勾选“隊員”）在面板与先攻栏互相查看 Buff 状态（只读）</div>
                                </div>
                                <div class="el-switch ${settings.party_buffs_visible ? "is-checked" : ""}" role="switch" id="switch_party_buffs_visible">
                                    <input class="el-switch__input" type="checkbox" role="switch" aria-checked="${!!settings.party_buffs_visible}" id="setting_party_buffs_visible" ${settings.party_buffs_visible ? "checked" : ""}>
                                    <span class="el-switch__core">
                                        <div class="el-switch__action"></div>
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 原生折叠/展开过渡动画机制
        const heading = panel.querySelector("#panel_heading_suite");
        const bodyCollapse = panel.querySelector("#collapseRoll20Suite");
        const toggleLink = panel.querySelector(".accordion-toggle");

        heading.addEventListener("click", (e) => {
            e.preventDefault();
            if (window.$ && typeof window.$.fn?.collapse === "function") {
                window.$(bodyCollapse).collapse("toggle");
            } else {
                // 原生 fallback
                const isOpen = bodyCollapse.classList.contains("in");
                if (isOpen) {
                    bodyCollapse.classList.remove("in");
                    bodyCollapse.style.display = "none";
                    heading.classList.add("collapsed");
                    toggleLink?.classList.add("collapsed");
                    heading.setAttribute("aria-expanded", "false");
                    toggleLink?.setAttribute("aria-expanded", "false");
                } else {
                    bodyCollapse.classList.add("in");
                    bodyCollapse.style.display = "block";
                    heading.classList.remove("collapsed");
                    toggleLink?.classList.remove("collapsed");
                    heading.setAttribute("aria-expanded", "true");
                    toggleLink?.setAttribute("aria-expanded", "true");
                }
            }
        });

        // 监听 Bootstrap Collapse 事件更新原生 collapsed 状态与 aria 属性
        if (window.$) {
            window.$(bodyCollapse).on("show.bs.collapse", () => {
                heading.classList.remove("collapsed");
                toggleLink?.classList.remove("collapsed");
                heading.setAttribute("aria-expanded", "true");
                toggleLink?.setAttribute("aria-expanded", "true");
            });
            window.$(bodyCollapse).on("hide.bs.collapse", () => {
                heading.classList.add("collapsed");
                toggleLink?.classList.add("collapsed");
                heading.setAttribute("aria-expanded", "false");
                toggleLink?.setAttribute("aria-expanded", "false");
            });
        }

        // 绑定 Element Switch 开关条交互辅助函数
        const bindSwitch = (switchId, inputId, settingKey, onChangeCallback) => {
            const switchEl = panel.querySelector(`#${switchId}`);
            const inputEl = panel.querySelector(`#${inputId}`);
            if (!switchEl || !inputEl) return;

            const updateState = (checked) => {
                inputEl.checked = checked;
                inputEl.setAttribute("aria-checked", String(checked));
                if (checked) {
                    switchEl.classList.add("is-checked");
                } else {
                    switchEl.classList.remove("is-checked");
                }
                SuiteConfigStore.setSetting(settingKey, checked);
                if (onChangeCallback) onChangeCallback(checked);
            };

            switchEl.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const nextState = !inputEl.checked;
                updateState(nextState);
            });

            inputEl.addEventListener("change", (e) => {
                updateState(e.target.checked);
            });
        };

        // 绑定各项开关
        bindSwitch("switch_turnorder_buff_abbr", "setting_turnorder_buff_abbr", "turnorder_buff_abbr");

        const wrapperMs = panel.querySelector("#wrapper_debounce_ms");
        const inputMs = panel.querySelector("#setting_debounce_recalc_ms");
        bindSwitch("switch_debounce_recalc_enabled", "setting_debounce_recalc_enabled", "debounce_recalc_enabled", (enabled) => {
            if (wrapperMs) {
                wrapperMs.style.opacity = enabled ? "1" : "0.5";
                wrapperMs.style.pointerEvents = enabled ? "auto" : "none";
            }
        });

        inputMs?.addEventListener("change", (e) => {
            const val = Math.max(500, Math.min(10000, Number(e.target.value) || 2000));
            inputMs.value = val;
            SuiteConfigStore.setSetting("debounce_recalc_ms", val);
        });

        bindSwitch("switch_buff_show_checkbox", "setting_buff_show_checkbox", "buff_show_checkbox");
        bindSwitch("switch_party_buffs_visible", "setting_party_buffs_visible", "party_buffs_visible");

        container.appendChild(panel);
    }
}
