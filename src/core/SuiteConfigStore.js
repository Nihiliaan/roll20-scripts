/**
 * SuiteConfigStore.js
 * 负责用户本地偏好设置管理与变更广播 (Settings Store)
 */
export class SuiteConfigStore {
    static SETTINGS_STORAGE_KEY = "r20_suite_user_settings";

    static defaultSettings = {
        turnorder_buff_abbr: false, // 先攻条 Buff 首字缩写显示
        debounce_recalc_enabled: false, // 是否在无操作后自动重算
        debounce_recalc_ms: 2000, // 无操作多少毫秒后自动重算
        buff_show_checkbox: false, // 是否在 Buff 列表显示快速启停复选框
        party_buffs_visible: false // 队友之间的 Buff 互相可见 (队员只读互查)
    };

    /**
     * 获取全部用户偏好设置
     */
    static getSettings() {
        try {
            const raw = localStorage.getItem(this.SETTINGS_STORAGE_KEY);
            return raw ? { ...this.defaultSettings, ...JSON.parse(raw) } : { ...this.defaultSettings };
        } catch (e) {
            return { ...this.defaultSettings };
        }
    }

    /**
     * 获取单项用户偏好设置
     */
    static getSetting(key, defaultVal) {
        const settings = this.getSettings();
        return settings[key] !== undefined ? settings[key] : (defaultVal !== undefined ? defaultVal : this.defaultSettings[key]);
    }

    /**
     * 更新单项用户偏好设置并向全局广播事件
     */
    static setSetting(key, val) {
        const settings = this.getSettings();
        settings[key] = val;
        try {
            localStorage.setItem(this.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {}
        window.dispatchEvent(new CustomEvent("r20_suite_setting_changed", { detail: { key, val, settings } }));
    }
}
