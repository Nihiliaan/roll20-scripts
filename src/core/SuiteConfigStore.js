import { Roll20Bridge } from "./Roll20Bridge.js";
import { Pf1eBuffManager } from "../modules/pf1e-buff-tracker/Pf1eBuffManager.js";

/**
 * SuiteConfigStore.js
 * 战役级云端配置角色卡读写层：
 * 1. 约定角色卡名称：=== R20_SUITE_DATABASE ===
 * 2. 角色卡为模板库的唯一真实来源（Single Source of Truth），所有 Buff 均以原生 repeating_buff2 存储；
 * 3. 严格数据真实性：若配置卡不存在，模板库直接为空，绝不注入本地预设；
 * 4. 树形拓扑结构保存在角色卡轻量属性 r20_suite_tree_structure 中，保证与原生编辑器双向实时同步。
 */
export class SuiteConfigStore {
    static DB_CHAR_NAME = "=== R20_SUITE_DATABASE ===";
    static ATTR_TREE_STRUCTURE = "r20_suite_tree_structure";

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
        return window.Campaign.characters.find(c => {
            const n = (c.get("name") || "").trim();
            return n === this.DB_CHAR_NAME || n.toLowerCase() === this.DB_CHAR_NAME.toLowerCase();
        }) || null;
    }

    /**
     * 创建配置角色卡（保持原生默认权限，不擅自修改可控/可见）
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
     * 若配置角色卡不存在，严格返回空数组（玩家模式回退读取自己可控卡）
     */
    static async loadTemplates() {
        const isGMUser = this.isGM();
        const dbChar = this.findDatabaseCharacter();

        if (dbChar) {
            await Roll20Bridge.ensureCharacterAttributes(dbChar);
            if (typeof dbChar.connectAttributesAndAbilities === "function" && (!dbChar.attribs || dbChar.attribs.length === 0)) {
                await dbChar.connectAttributesAndAbilities();
            }

            // 1. 读取原生角色卡上的所有 repeating_buff2 条目
            const nativeBuffs = await Pf1eBuffManager.getAllBuffs(dbChar);
            const nativeBuffMap = new Map();
            nativeBuffs.forEach(b => {
                if (b.rowId) nativeBuffMap.set(b.rowId, b);
            });

            // 2. 读取树形拓扑映射
            let treeStructure = null;
            const treeAttr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_TREE_STRUCTURE);
            if (treeAttr && treeAttr.get("current")) {
                try {
                    treeStructure = JSON.parse(treeAttr.get("current"));
                } catch (e) {
                    console.warn("[SuiteConfigStore] 解析拓扑结构失败，将平铺展示原生Buff:", e);
                }
            }

            // 3. 根据拓扑树重建带有原生属性的模板树
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

            // 4. 将在原生角色卡上直接新增、未录入拓扑树的原生 Buff 追加到根列表
            nativeBuffs.forEach(b => {
                if (!usedRowIds.has(b.rowId)) {
                    finalTemplates.push({
                        id: b.rowId,
                        rowId: b.rowId,
                        type: "buff",
                        name: b.name,
                        rounds: b.rounds,
                        extraAttrs: b.extraAttrs || null
                    });
                }
            });

            return finalTemplates;
        }

        // 如果是玩家且无配置卡，自动汇总玩家控制的所有角色卡上的 Buff
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

        // 绝不回退任何假数据或内置常量
        return [];
    }

    /**
     * 保存 Buff 模板数据至原生角色卡
     * @param {Array} templates 模板树列表
     * @param {boolean} promptIfMissing 若找不到卡且为 GM，是否弹窗询问创建
     */
    static async saveTemplates(templates, promptIfMissing = false) {
        const isGMUser = this.isGM();
        let dbChar = this.findDatabaseCharacter();

        if (!dbChar && isGMUser && promptIfMissing) {
            const confirmCreate = confirm(`未检测到战役配置卡 [${this.DB_CHAR_NAME}]。\n是否立刻新建该卡以将状态 Buff 模板保存至云端原生角色卡？\n（点击【取消】将放弃本次保存）`);
            if (confirmCreate) {
                dbChar = await this.createDatabaseCharacter();
            } else {
                return false;
            }
        }

        if (!dbChar) return false;

        await Roll20Bridge.ensureCharacterAttributes(dbChar);
        const existingBuffs = await Pf1eBuffManager.getAllBuffs(dbChar);
        const existingRowMap = new Map();
        existingBuffs.forEach(b => {
            if (b.rowId) existingRowMap.set(b.rowId, b);
        });

        const activeRowIdsInTemplates = new Set();

        // 递归同步 Buff 条目至原生 repeating_buff2 属性
        const syncNodesToNative = async (nodes) => {
            for (const node of nodes) {
                if (node.type === "folder") {
                    if (node.children) await syncNodesToNative(node.children);
                } else if (node.type === "buff") {
                    let rowId = node.rowId || node.id;
                    const isExisting = rowId && existingRowMap.has(rowId);

                    if (!isExisting) {
                        // 新建原生条目
                        rowId = window.generateUUID ? window.generateUUID() : ("-R20" + Math.random().toString(36).substr(2, 16));
                        node.id = rowId;
                        node.rowId = rowId;
                    }

                    activeRowIdsInTemplates.add(rowId);
                    await this.writeNativeBuffRow(dbChar, rowId, node.name, node.rounds, node.extraAttrs);
                }
            }
        };

        await syncNodesToNative(templates);

        // 删除在原生卡上已不存在于模板树中的 Buff（物理彻底销毁）
        for (const [oldRowId] of existingRowMap) {
            if (!activeRowIdsInTemplates.has(oldRowId)) {
                await Pf1eBuffManager.deleteBuffRowPermanently(dbChar, oldRowId);
            }
        }

        // 保存纯拓扑树映射
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
        let treeAttr = dbChar.attribs && dbChar.attribs.models.find(a => a.get("name") === this.ATTR_TREE_STRUCTURE);
        const topoJson = JSON.stringify(topology);
        if (!treeAttr) {
            dbChar.attribs.create({
                name: this.ATTR_TREE_STRUCTURE,
                current: topoJson
            });
        } else {
            treeAttr.save({ current: topoJson });
        }

        console.log(`[SuiteConfigStore] 已全量同步 ${activeRowIdsInTemplates.size} 条原生 Buff 到角色卡 [${this.DB_CHAR_NAME}]`);
        return true;
    }

    /**
     * 将一条 Buff 写入原生 repeating_buff2_<rowId> 属性集
     */
    static async writeNativeBuffRow(character, rowId, name, rounds, extraAttrs) {
        const prefix = `repeating_buff2_${rowId}`;
        const attrsToSet = {
            [`${prefix}_name`]: name || "未命名Buff",
            [`${prefix}_enable_toggle`]: 0, // 模板卡默认不激活
            [`${prefix}_rounds`]: rounds !== null && rounds !== undefined ? rounds : "",
            [`${prefix}_bufftype`]: (extraAttrs && extraAttrs.bufftype) || "spell",
            [`${prefix}_tabcat`]: "spell",
            [`${prefix}_tabcat2`]: "1",
            [`${prefix}_row_id`]: rowId.toLowerCase(),
            [`${prefix}_description-show`]: 1
        };

        if (extraAttrs && typeof extraAttrs === "object") {
            Object.entries(extraAttrs).forEach(([k, v]) => {
                if (k !== "name" && k !== "enable_toggle" && k !== "rounds" && k !== "tabcat" && k !== "tabcat2" && k !== "row_id") {
                    attrsToSet[`${prefix}_${k}`] = v;
                }
            });
        }

        const models = character.attribs ? character.attribs.models : [];
        const prefixWithUnderscore = `${prefix}_`;

        // 1. 设置或更新所有属性
        Object.entries(attrsToSet).forEach(([attrName, attrVal]) => {
            const existing = models.find(m => m.get("name") === attrName);
            if (existing) {
                existing.save({ current: attrVal });
            } else {
                character.attribs.create({
                    name: attrName,
                    current: attrVal
                });
            }
        });

        // 2. 清理在本次编辑中被显式删除的细目属性，保持与角色卡完全同步
        const newKeys = new Set(Object.keys(attrsToSet));
        const obsoleteAttrs = models.filter(m => {
            const n = m.get("name") || "";
            return n.startsWith(prefixWithUnderscore) && !newKeys.has(n);
        });
        obsoleteAttrs.forEach(a => a.destroy());
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

            const cardBuffs = await Pf1eBuffManager.getAllBuffs(char);
            cardBuffs.forEach(b => {
                if (!seenNames.has(b.name)) {
                    seenNames.add(b.name);
                    list.push({
                        id: "b_player_" + Math.random().toString(36).substr(2, 7),
                        type: "buff",
                        name: b.name,
                        rounds: b.rounds,
                        extraAttrs: b.extraAttrs
                    });
                }
            });
        }

        return list;
    }
}
