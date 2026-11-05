/**
 * SuiteConfigStore.js
 * 战役云端配置卡存储层（SSOT 单一真实数据源架构）
 * 1. 唯一真实数据源：=== R20_SUITE_DATABASE === 角色卡上的 repeating_buff2_* 原生属性；
 * 2. 拓扑属性 buff_tree_structure 仅记录目录层级与组织关系，绝不覆写原生属性，绝不盲目误杀卡上数据；
 * 3. 增删改查均采用原子操作，杜绝双状态竞争。
 */
import { Roll20Bridge } from "./Roll20Bridge.js";
import { Pf1eBuffManager } from "../modules/pf1e-buff-tracker/Pf1eBuffManager.js";

export class SuiteConfigStore {
    static DATABASE_CHARACTER_NAME = "=== R20_SUITE_DATABASE ===";
    static DB_CHAR_NAME = this.DATABASE_CHARACTER_NAME;
    static ATTR_TREE_STRUCTURE = "buff_tree_structure";
    static SETTINGS_STORAGE_KEY = "r20_suite_user_settings";

    static defaultSettings = {
        turnorder_buff_abbr: false, // 先攻条 Buff 首字缩写显示
        debounce_recalc_enabled: false, // 是否在无操作后自动重算
        debounce_recalc_ms: 2000, // 无操作多少毫秒后自动重算
        buff_show_checkbox: false // 是否在 Buff 列表显示快速启停复选框
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

    /**
     * 判断当前登录玩家是否具备 GM (裁判) 权限
     */
    static isGM() {
        return Roll20Bridge.isGM();
    }

    /**
     * 查找战役中专用于存储 Suite 配置的公共人物卡
     * 若当前为 GM，且发现既有卡片权限被放宽，自动执行静默收敛修复
     */
    static findDatabaseCharacter() {
        if (!window.Campaign || !window.Campaign.characters) return null;
        const dbChar = window.Campaign.characters.models.find(
            c => c.get("name") === this.DATABASE_CHARACTER_NAME && !c.get("archived")
        ) || null;

        if (dbChar && this.isGM()) {
            const currentJournals = dbChar.get("inplayerjournals") || "";
            const currentControlled = dbChar.get("controlledby") || "";
            if (currentJournals !== "" || currentControlled !== "") {
                dbChar.save({
                    inplayerjournals: "",
                    controlledby: ""
                });
                console.log("[SuiteConfigStore] 已静默收敛既有配置卡权限，恢复为仅 GM 独占 (inplayerjournals/controlledby 重置为空)");
            }
        }

        return dbChar;
    }

    /**
     * 自动新建战役配置人物卡（严格仅 GM 独占，杜绝 Journal 界面污染与越权修改）
     */
    static async createDatabaseCharacter() {
        if (!this.isGM()) {
            console.warn("[SuiteConfigStore] 仅 GM 裁判可创建配置角色卡");
            return null;
        }

        const newChar = window.Campaign.characters.create({
            name: this.DATABASE_CHARACTER_NAME,
            avatar: "",
            bio: "Roll20 Suite 战役全局状态 Buff 模板库存储卡。请勿手动修改本卡名称与权限设置。",
            inplayerjournals: "",
            controlledby: ""
        });

        console.log("[SuiteConfigStore] 成功创建仅 GM 专有配置卡: " + this.DATABASE_CHARACTER_NAME);
        await Roll20Bridge.ensureCharacterAttributes(newChar);
        if (typeof newChar.connectAttributesAndAbilities === "function" && (!newChar.attribs || newChar.attribs.length === 0)) {
            await newChar.connectAttributesAndAbilities();
        }
        return newChar;
    }

    /**
     * 确保数据库角色卡可用（若不存在且当前是 GM，则原子创建并初始化）
     * 无论是通过加号新建、拖拽复制、批量导入，往 Buff 模板库写入时均统一调用此入口
     */
    static async ensureDatabaseCharacter() {
        let dbChar = this.findDatabaseCharacter();
        if (!dbChar) {
            if (this.isGM()) {
                dbChar = await this.createDatabaseCharacter();
            } else {
                console.warn("[SuiteConfigStore] 未找到战役公共配置卡，且非 GM 用户无权创建");
                return null;
            }
        }
        if (dbChar) {
            await Roll20Bridge.ensureCharacterAttributes(dbChar);
            if (typeof dbChar.connectAttributesAndAbilities === "function" && (!dbChar.attribs || dbChar.attribs.length === 0)) {
                await dbChar.connectAttributesAndAbilities();
            }
        }
        return dbChar;
    }

    /**
     * 读取 Buff 模板数据（完全以数据库角色卡上的原生 repeating_buff2 为基准）
     */
    static async loadTemplates() {
        const isGMUser = this.isGM();
        const dbChar = this.findDatabaseCharacter();

        if (dbChar) {
            await Roll20Bridge.ensureCharacterAttributes(dbChar);
            if (typeof dbChar.connectAttributesAndAbilities === "function" && (!dbChar.attribs || dbChar.attribs.length === 0)) {
                await dbChar.connectAttributesAndAbilities();
            }

            // 1. 直接读取原生卡上所有 repeating_buff2 原生 Buff 条目
            const nativeBuffs = await Pf1eBuffManager.getAllBuffs(dbChar);
            const nativeBuffMap = new Map();
            nativeBuffs.forEach(b => {
                if (b.rowId) nativeBuffMap.set(b.rowId, b);
            });

            // 2. 读取纯拓扑结构（仅用于目录分类排版）
            let treeStructure = null;
            const treeAttr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_TREE_STRUCTURE);
            if (treeAttr && treeAttr.get("current")) {
                try {
                    treeStructure = JSON.parse(treeAttr.get("current"));
                } catch (e) {
                    console.warn("[SuiteConfigStore] 解析拓扑结构失败:", e);
                }
            }

            // 3. 将原生 Buff 按照拓扑树重建组织结构
            const usedRowIds = new Set();
            const reconstructTree = (nodes) => {
                const result = [];
                for (const node of nodes) {
                    if (node.type === "folder") {
                        result.push({
                            id: node.id || "f_" + Math.random().toString(36).substr(2, 6),
                            type: "folder",
                            name: node.name,
                            collapsed: !!node.collapsed,
                            children: node.children ? reconstructTree(node.children) : []
                        });
                    } else if (node.type === "buff") {
                        const rowId = node.rowId || node.id;
                        const native = nativeBuffMap.get(rowId);
                        if (native) {
                            usedRowIds.add(rowId);
                            result.push({
                                id: rowId,
                                rowId: rowId,
                                type: "buff",
                                name: native.name,
                                rounds: native.rounds,
                                initRounds: native.initRounds || null,
                                extraAttrs: native.extraAttrs || null
                            });
                        }
                    }
                }
                return result;
            };

            let finalTemplates = [];
            if (Array.isArray(treeStructure)) {
                finalTemplates = reconstructTree(treeStructure);
            }

            // 4. 所有未在拓扑树中归类的原生 Buff（例如用户在官方卡上直接新增的），全部天然直接呈现在根目录下！
            nativeBuffs.forEach(b => {
                if (!usedRowIds.has(b.rowId)) {
                    finalTemplates.push({
                        id: b.rowId,
                        rowId: b.rowId,
                        type: "buff",
                        name: b.name,
                        rounds: b.rounds,
                        initRounds: b.initRounds || null,
                        extraAttrs: b.extraAttrs || null
                    });
                }
            });

            return finalTemplates;
        }

        // 玩家模式回退：汇总自己控制的角色卡上的 Buff
        if (!isGMUser) {
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

        return [];
    }

    /**
     * 仅保存目录拓扑结构（绝不覆写或误杀角色卡上的任何原生属性）
     */
    static async saveTopology(templates) {
        const dbChar = await this.ensureDatabaseCharacter();
        if (!dbChar) return false;

        const extractTopology = (nodes) => {
            return nodes.map(n => {
                if (n.type === "folder") {
                    return {
                        id: n.id,
                        type: "folder",
                        name: n.name,
                        collapsed: !!n.collapsed,
                        children: n.children ? extractTopology(n.children) : []
                    };
                }
                return {
                    id: n.rowId || n.id,
                    rowId: n.rowId || n.id,
                    type: "buff"
                };
            });
        };

        const topology = extractTopology(templates);
        const topoJson = JSON.stringify(topology);

        let treeAttr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_TREE_STRUCTURE);
        if (!treeAttr) {
            dbChar.attribs.create({
                name: this.ATTR_TREE_STRUCTURE,
                current: topoJson
            });
        } else {
            treeAttr.save({ current: topoJson });
        }

        return true;
    }

    /**
     * 原子新增一个 Buff 到数据库角色卡
     */
    static async addBuffToDatabase(name, rounds = null, extraAttrs = null, initRounds = null) {
        const dbChar = await this.ensureDatabaseCharacter();
        if (!dbChar) return null;

        const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs);
        const rowId = window.generateUUID ? window.generateUUID() : ("-R20" + Math.random().toString(36).substr(2, 16));
        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, cleanAttrs, initRounds);

        console.log("[SuiteConfigStore] 原子创建原生 Buff [" + name + "] (rowId: " + rowId + ", initRounds: " + initRounds + ")");
        return rowId;
    }

    /**
     * 原子更新数据库角色卡上的指定 Buff
     */
    static async updateBuffInDatabase(rowId, name, rounds = null, extraAttrs = null, initRounds = null) {
        const dbChar = await this.ensureDatabaseCharacter();
        if (!dbChar || !rowId) return false;

        const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs);
        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, cleanAttrs, initRounds);

        console.log("[SuiteConfigStore] 原子更新原生 Buff [" + name + "] (rowId: " + rowId + ", initRounds: " + initRounds + ")");
        return true;
    }

    /**
     * 原子删除一个 Buff（彻底物理销毁）
     */
    static async deleteBuffFromDatabase(rowId) {
        const dbChar = this.findDatabaseCharacter();
        if (!dbChar || !rowId) return false;

        await Roll20Bridge.ensureCharacterAttributes(dbChar);
        await Pf1eBuffManager.deleteBuffRowPermanently(dbChar, rowId);

        // 从拓扑属性中同步剔除
        const treeAttr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_TREE_STRUCTURE);
        if (treeAttr && treeAttr.get("current")) {
            try {
                let topo = JSON.parse(treeAttr.get("current"));
                const cleanNode = (nodes) => {
                    for (let i = nodes.length - 1; i >= 0; i--) {
                        if (nodes[i].type === "buff" && (nodes[i].id === rowId || nodes[i].rowId === rowId)) {
                            nodes.splice(i, 1);
                        } else if (nodes[i].children) {
                            cleanNode(nodes[i].children);
                        }
                    }
                };
                cleanNode(topo);
                treeAttr.save({ current: JSON.stringify(topo) });
            } catch (e) {}
        }

        console.log("[SuiteConfigStore] 原子彻底销毁原生 Buff (rowId: " + rowId + ")");
        return true;
    }

    /**
     * 兼容别名（统一收拢至 saveTopology）
     */
    static async saveTemplates(templates) {
        return this.saveTopology(templates);
    }

    /**
     * 将一条 Buff 写入原生 repeating_buff2_<rowId> 属性集
     */
    static async writeNativeBuffRow(character, rowId, name, rounds, extraAttrs, initRounds = null) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = "repeating_buff2_" + rowId;
        const attrs = [
            { name: prefix + "_name", current: name || "未命名Buff" },
            { name: prefix + "_enable_toggle", current: 0 },
            { name: prefix + "_tabcat2", current: "1" },
            { name: prefix + "_rounds", current: (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "" },
            { name: prefix + "_init_rounds", current: (initRounds !== null && initRounds !== undefined) ? initRounds : "" },
            { name: prefix + "_bufftype", current: (extraAttrs && extraAttrs.bufftype) ? extraAttrs.bufftype : "spell" },
            { name: prefix + "_tabcat", current: (extraAttrs && extraAttrs.bufftype) ? extraAttrs.bufftype : "spell" },
            { name: prefix + "_row_id", current: rowId.toLowerCase() },
            { name: prefix + "_description-show", current: 1 }
        ];

        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [key, val] of Object.entries(extraAttrs)) {
                if (key !== "name" && key !== "enable_toggle" && key !== "rounds" && key !== "init_rounds" && key !== "bufftype" && key !== "tabcat") {
                    attrs.push({ name: prefix + "_" + key, current: val });
                }
            }
        }

        for (const item of attrs) {
            let attr = character.attribs && character.attribs.models.find(a => a.get("name") === item.name);
            if (!attr) {
                character.attribs.create(item);
            } else {
                attr.save({ current: item.current });
            }
        }
        return true;
    }

    /**
     * 收集玩家控制卡上的 Buff
     */
    static async collectPlayerControlledBuffs() {
        const result = [];
        if (!window.Campaign || !window.Campaign.characters) return result;
        const currentUserId = window.Roll20?.getCurrentUserId?.() || "";

        for (const char of window.Campaign.characters.models) {
            const controlledby = char.get("controlledby") || "";
            const isControlled = controlledby.split(",").includes("all") || (currentUserId && controlledby.split(",").includes(currentUserId));

            if (isControlled && char.get("name") !== this.DATABASE_CHARACTER_NAME) {
                await Roll20Bridge.ensureCharacterAttributes(char);
                const buffs = await Pf1eBuffManager.getAllBuffs(char);
                buffs.forEach(b => {
                    result.push({
                        id: "pb_" + char.id + "_" + b.rowId,
                        rowId: b.rowId,
                        type: "buff",
                        name: b.name + " (" + char.get("name") + ")",
                        rounds: b.rounds,
                        initRounds: b.initRounds || null,
                        extraAttrs: b.extraAttrs || null
                    });
                });
            }
        }
        return result;
    }
}
