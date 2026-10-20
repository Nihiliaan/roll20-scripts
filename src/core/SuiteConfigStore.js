import { Roll20Bridge } from "./Roll20Bridge.js";

/**
 * SuiteConfigStore.js
 * 战役级云端配置角色卡读写层：
 * 1. 约定角色卡名称：=== R20_SUITE_DATABASE ===
 * 2. GM 身份可读写该卡，若不存在不擅自创建，在首建 Buff 时弹窗征求用户同意；
 * 3. 玩家身份自动列出自己可控角色卡上的现有 Buff；
 * 4. 双层缓存：云端与本地 LocalStorage 协同容错。
 */
export class SuiteConfigStore {
    static DB_CHAR_NAME = "=== R20_SUITE_DATABASE ===";
    static ATTR_BUFF_TEMPLATES = "r20_suite_buff_templates";
    static LOCAL_BACKUP_KEY = "r20_buff_templates_v5";

    /**
     * 判断当前是否为 GM 身份
     */
    static isGM() {
        if (window.is_gm) return true;
        const myPlayerId = window.d20_player_id;
        if (window.Campaign && window.Campaign.players && myPlayerId) {
            const player = window.Campaign.players.get(myPlayerId);
            if (player && (player.get("displayname") === "GM" || player.get("is_gm"))) {
                return true;
            }
        }
        return false;
    }

    /**
     * 寻找配置角色卡
     */
    static findDatabaseCharacter() {
        if (!window.Campaign || !window.Campaign.characters) return null;
        return window.Campaign.characters.find(c => c.get("name") === this.DB_CHAR_NAME) || null;
    }

    /**
     * 创建配置角色卡（仅在用户确认新建时触发，保持原生默认权限，不擅自修改可控/可见）
     */
    static async createDatabaseCharacter() {
        if (!window.Campaign || !window.Campaign.characters) return null;
        const newChar = window.Campaign.characters.create({
            name: this.DB_CHAR_NAME
        });
        await Roll20Bridge.ensureCharacterAttributes(newChar);
        console.log(`[SuiteConfigStore] 已创建云端配置角色卡 [${this.DB_CHAR_NAME}]`);
        return newChar;
    }

    /**
     * 读取 Buff 模板数据
     */
    static async loadTemplates(defaultTemplates = []) {
        const isGMUser = this.isGM();
        const dbChar = this.findDatabaseCharacter();

        if (dbChar) {
            await Roll20Bridge.ensureCharacterAttributes(dbChar);
            const attr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_BUFF_TEMPLATES);
            if (attr && attr.get("current")) {
                try {
                    const parsed = JSON.parse(attr.get("current"));
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                } catch (e) {
                    console.error("[SuiteConfigStore] 解析云端配置失败，回退本地存储:", e);
                }
            }
        }

        // 如果是玩家且无配置卡，自动汇总玩家控制的所有角色卡上的 Buff
        if (!isGMUser && !dbChar) {
            const playerBuffs = await this.collectPlayerControlledBuffs();
            if (playerBuffs.length > 0) {
                return [
                    {
                        id: "f_player_auto",
                        type: "folder",
                        name: "我的角色Buff库",
                        collapsed: false,
                        children: playerBuffs
                    }
                ];
            }
        }

        // 回退本地 LocalStorage 或默认预设
        try {
            const localRaw = localStorage.getItem(this.LOCAL_BACKUP_KEY);
            if (localRaw) {
                return JSON.parse(localRaw);
            }
        } catch (e) {}

        return JSON.parse(JSON.stringify(defaultTemplates));
    }

    /**
     * 保存 Buff 模板数据
     * @param {Array} templates 模板列表
     * @param {boolean} promptIfMissing 若找不到卡且为 GM，是否弹窗询问创建
     */
    static async saveTemplates(templates, promptIfMissing = false) {
        // 先本地备份
        try {
            localStorage.setItem(this.LOCAL_BACKUP_KEY, JSON.stringify(templates));
        } catch (e) {}

        const isGMUser = this.isGM();
        let dbChar = this.findDatabaseCharacter();

        if (!dbChar && isGMUser && promptIfMissing) {
            const confirmCreate = confirm(`未检测到战役配置卡 [${this.DB_CHAR_NAME}]。\n是否立刻新建该卡以将状态 Buff 模板保存至云端？\n（点击【取消】可暂存本地，稍后自行导入或创建）`);
            if (confirmCreate) {
                dbChar = await this.createDatabaseCharacter();
            } else {
                return false;
            }
        }

        if (dbChar) {
            await Roll20Bridge.ensureCharacterAttributes(dbChar);
            let attr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_BUFF_TEMPLATES);
            const jsonStr = JSON.stringify(templates);
            if (!attr) {
                dbChar.attribs.create({
                    name: this.ATTR_BUFF_TEMPLATES,
                    current: jsonStr
                });
            } else {
                attr.save({ current: jsonStr });
            }
            console.log(`[SuiteConfigStore] 模板已成功持久化至云端角色卡 [${this.DB_CHAR_NAME}]`);
            return true;
        }

        return false;
    }

    /**
     * 玩家模式：扫描玩家有控制权的角色卡并聚合成 Buff 模板
     */
    static async collectPlayerControlledBuffs() {
        if (!window.Campaign || !window.Campaign.characters) return [];
        const myPlayerId = window.d20_player_id;
        const list = [];
        const seenNames = new Set();

        for (let i = 0; i < window.Campaign.characters.length; i++) {
            const char = window.Campaign.characters.at(i);
            const controlledBy = (char.get("controlledby") || "").split(",");
            const canControl = controlledBy.includes("all") || controlledBy.includes(myPlayerId);
            if (!canControl) continue;

            await Roll20Bridge.ensureCharacterAttributes(char);
            if (!char.attribs || !char.attribs.models) continue;

            char.attribs.models.forEach(a => {
                const attrName = a.get("name") || "";
                if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_name")) {
                    const prefix = attrName.substring(0, attrName.lastIndexOf("_name"));
                    const name = (a.get("current") || "").trim();
                    if (!name || seenNames.has(name)) return;
                    seenNames.add(name);

                    const roundsAttr = char.attribs.models.find(x => x.get("name") === `${prefix}_rounds`);
                    const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;

                    const extraAttrs = {};
                    char.attribs.models.forEach(m => {
                        const mName = m.get("name") || "";
                        if (mName.startsWith(`${prefix}_`)) {
                            const subKey = mName.substring(prefix.length + 1);
                            if (subKey !== "name" && subKey !== "enable_toggle" && subKey !== "rounds") {
                                extraAttrs[subKey] = m.get("current");
                            }
                        }
                    });

                    list.push({
                        id: "b_player_" + Math.random().toString(36).substr(2, 7),
                        type: "buff",
                        name,
                        rounds,
                        extraAttrs
                    });
                }
            });
        }

        return list;
    }
}
