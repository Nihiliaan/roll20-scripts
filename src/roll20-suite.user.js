// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.7.1
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成双栏自适应延伸、物理折叠、图钉感应、三态直接高亮交互与云端原生角色卡完全同步
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.7.1...");

    // ==========================================
    // 1. Roll20Bridge 核心通信层
    // ==========================================
/**
 * Roll20Bridge.js
 * 封装与 Roll20 Jumpgate 现代架构的核心交互通道
 */
class Roll20Bridge {
    /**
     * 等待 Roll20 核心战役对象初始化就绪
     * @param {number} timeoutMs 超时时间(毫秒)
     * @returns {Promise<boolean>}
     */
    static waitForReady(timeoutMs = 30000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (
                    typeof window.Campaign !== "undefined" &&
                    window.Campaign.characters &&
                    window.Campaign.pages
                ) {
                    resolve(true);
                } else if (Date.now() - start > timeoutMs) {
                    console.warn("[Roll20Bridge] 等待 Roll20 就绪超时");
                    resolve(false);
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    }

    /**
     * 等待战役就绪 (别名兼容)
     */
    static waitForCampaign(timeoutMs = 30000) {
        return this.waitForReady(timeoutMs);
    }

    /**
     * 获取当前主战役模型
     */
    static getCampaign() {
        return window.Campaign;
    }

    /**
     * 获取当前玩家所在页面模型
     */
    static getCurrentPage() {
        const campaign = this.getCampaign();
        if (!campaign) return null;
        const pageId = campaign.get("playerpageid");
        return campaign.pages ? campaign.pages.get(pageId) : null;
    }

    /**
     * 根据 tokenId 获取当前地图上的 Token Graphic 模型
     * @param {string} tokenId
     * @param {string} pageId 可选页面ID，默认当前玩家页面
     */
    static getTokenGraphic(tokenId, pageId = null) {
        const campaign = this.getCampaign();
        if (!campaign || !campaign.pages) return null;

        if (pageId) {
            const page = campaign.pages.get(pageId);
            return page && page.thegraphics ? page.thegraphics.get(tokenId) : null;
        }

        // 遍历所有页面寻找该 Token
        for (let i = 0; i < campaign.pages.length; i++) {
            const page = campaign.pages.at(i);
            if (page && page.thegraphics) {
                const token = page.thegraphics.get(tokenId);
                if (token) return token;
            }
        }
        return null;
    }

    /**
     * 根据 Token 获取其关联的人物卡模型
     * @param {string|object} tokenOrId Token图元或TokenID
     * @returns {object|null} Character 模型
     */
    static getCharacterByToken(tokenOrId) {
        const token = typeof tokenOrId === "string" ? this.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return null;

        const charId = token.get("represents");
        if (!charId) return null;

        const campaign = this.getCampaign();
        return campaign && campaign.characters ? campaign.characters.get(charId) : null;
    }

    /**
     * 确保人物卡的属性集合与 Firebase 建立异步连接并填充到内存
     * @param {object} character Character Backbone 模型
     */
    static async ensureCharacterAttributes(character) {
        if (!character) return false;
        // 如果 attribs 集合为空，调用原生方法触发拉取
        if (!character.attribs || character.attribs.length === 0) {
            if (typeof character.connectAttributesAndAbilities === "function") {
                await character.connectAttributesAndAbilities();
            }
        }
        return true;
    }

    /**
     * 向 Roll20 聊天栏无损推送一条消息
     * @param {string} message 要发送的文本或宏模板
     */
    static sendChatMessage(message) {
        const textarea = document.querySelector("#textchat-input textarea");
        const sendBtn = document.querySelector("#chatSendBtn");
        if (textarea && sendBtn) {
            textarea.value = message;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            sendBtn.click();
        } else {
            console.warn("[Roll20Bridge] 无法找到聊天输入组件");
        }
    }
}

    // ==========================================
    // 2. Pf1eBuffManager (PF1e 角色卡数据管理层)
    // ==========================================
/**
 * Pf1eBuffManager.js
 * 负责扫描、添加、刷新、修改与关停 PF1e 角色卡上的原生 repeating_buff2 重复列表
 */
class Pf1eBuffManager {
    /**
     * 生成合乎 Roll20 标准的唯一 RowID（20 位 Base64 带时间戳，杜绝小写冲突）
     */
    static generateStandardRowId() {
        if (typeof window.generateUUID === "function") {
            return window.generateUUID();
        }
        // 回退实现：标准 Firebase/Roll20 Push ID 生成器
        const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        let now = new Date().getTime();
        const timeStampChars = new Array(8);
        for (let i = 7; i >= 0; i--) {
            timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
            now = Math.floor(now / 64);
        }
        let id = timeStampChars.join("");
        for (let i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
        }
        return id;
    }

    /**
     * 获取指定角色卡上所有当前处于勾选激活状态的 Buff
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 激活的 Buff 列表
     */
    static async getActiveBuffs(character) {
        const allBuffs = await this.getAllBuffs(character);
        return allBuffs.filter(b => b.enabled);
    }

    /**
     * 获取指定角色卡上所有的 Buff（无论是否激活启动）
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 包含启动和未启动的全部 Buff 列表
     */
    static async getAllBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);

        const buffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 查找所有 repeating_buff2_*_name
        const nameAttrs = character.attribs.models.filter(a => {
            const name = a.get("name") || "";
            return name.startsWith("repeating_buff2_") && name.endsWith("_name");
        });

        for (const nameAttr of nameAttrs) {
            const fullName = nameAttr.get("name");
            const prefix = fullName.substring(0, fullName.lastIndexOf("_name"));
            const rowId = prefix.replace("repeating_buff2_", "");

            const toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
            const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            const buffTypeAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_bufftype`);

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
            const buffType = buffTypeAttr ? buffTypeAttr.get("current") : "spell";

            buffs.push({
                rowId,
                prefix,
                name,
                enabled,
                rounds: (rounds !== null && !isNaN(rounds)) ? rounds : null,
                buffType,
                toggleAttr: toggleAttr || null,
                roundsAttr: roundsAttr || null
            });
        }

        return buffs;
    }

    /**
     * 施加或刷新 Buff（核心幂等方法）
     * 1. 以名称判断：如果卡片中已有同名 Buff，直接启用 (_enable_toggle=1) 并刷新剩余轮数，保留其原有加值计算公式；
     * 2. 若无同名 Buff，则自动新建一行符合官方标准规范的原生 Buff 并激活。
     * @param {object} character Character 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 额外的细目加值字典（如 b1_bonus, b1_val 等）
     */
    static async applyOrRefreshBuff(character, buffName, rounds = null, extraAttrs = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        // 遍历所有 repeating_buff2_*_name 寻找同名行
        const nameAttrs = character.attribs.models.filter(a => {
            const n = a.get("name") || "";
            return n.startsWith("repeating_buff2_") && n.endsWith("_name") && a.get("current") === cleanName;
        });

        if (nameAttrs.length > 0) {
            // 找到同名 Buff，直接启用并刷新轮数
            const nameAttr = nameAttrs[0];
            const prefix = nameAttr.get("name").replace("_name", "");
            const rowId = prefix.replace("repeating_buff2_", "");

            let toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
            if (!toggleAttr) {
                toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
            } else {
                toggleAttr.save({ current: 1 });
            }

            // 补全原生必需标签，防止角色卡报错
            this.ensureNativeRequiredAttrs(character, prefix, rowId);

            let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            if (rounds !== null && !isNaN(rounds)) {
                if (!roundsAttr) {
                    roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: Number(rounds), max: Number(rounds) });
                } else {
                    roundsAttr.save({ current: Number(rounds) });
                }
            } else if (roundsAttr) {
                // 设为常驻
                roundsAttr.save({ current: "" });
            }

            // 更新细目属性
            if (extraAttrs && typeof extraAttrs === "object") {
                for (const [k, v] of Object.entries(extraAttrs)) {
                    if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "row_id") continue;
                    const attrFullName = `${prefix}_${k}`;
                    let subAttr = character.attribs.models.find(a => a.get("name") === attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${rounds}`);
            return { rowId, prefix, name: cleanName, rounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs);
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const cleanName = (buffName || "新Buff").trim();
        const rowId = this.generateStandardRowId();
        const prefix = `repeating_buff2_${rowId}`;

        // 写入原生必需的核心字段
        const nameAttr = character.attribs.create({ name: `${prefix}_name`, current: cleanName });
        const toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
        const typeAttr = character.attribs.create({ name: `${prefix}_bufftype`, current: "spell" });

        // 必需的原生分类与渲染控制标记（杜绝 "You must delete this row" 错误）
        character.attribs.create({ name: `${prefix}_tabcat`, current: "spell" });
        character.attribs.create({ name: `${prefix}_tabcat2`, current: "1" });
        character.attribs.create({ name: `${prefix}_description-show`, current: 1 });
        character.attribs.create({ name: `${prefix}_row_id`, current: rowId.toLowerCase() });

        let roundsAttr = null;
        if (rounds !== null && !isNaN(rounds) && rounds > 0) {
            roundsAttr = character.attribs.create({
                name: `${prefix}_rounds`,
                current: Number(rounds),
                max: Number(rounds)
            });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}], 轮数: ${rounds}`);
        return { rowId, prefix, name: cleanName, rounds, toggleAttr, roundsAttr };
    }

    /**
     * 辅助方法：确保一行 Buff 拥有原生角色卡所需的全部标准元属性
     */
    static ensureNativeRequiredAttrs(character, prefix, rowId) {
        const checkAndCreate = (subKey, defaultVal) => {
            const fullKey = `${prefix}_${subKey}`;
            let attr = character.attribs.models.find(a => a.get("name") === fullKey);
            if (!attr) {
                character.attribs.create({ name: fullKey, current: defaultVal });
            }
        };

        checkAndCreate("tabcat", "spell");
        checkAndCreate("tabcat2", "1");
        checkAndCreate("description-show", 1);
        checkAndCreate("row_id", rowId.toLowerCase());
    }

    /**
     * 关停/解除指定角色身上的某个 Buff
     */
    static async removeBuff(character, rowId) {
        if (!character) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
        const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);

        if (toggleAttr) toggleAttr.save({ current: 0 });
        if (roundsAttr) roundsAttr.save({ current: 0 });

        console.log(`[Pf1eBuffManager] 已关停 ${character.get("name")} 的 Buff (${rowId})`);
        return true;
    }

    /**
     * 为指定的 Buff 行设置/更新剩余轮数
     */
    static async setBuffRounds(character, rowId, rounds) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const attrName = `repeating_buff2_${rowId}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === attrName);

        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: attrName, current: rounds, max: rounds });
        } else {
            roundsAttr.save({ current: rounds });
        }
        return roundsAttr;
    }

    /**
     * 当角色行动结束时，扣减其身上所有已设置轮数的活跃 Buff
     */
    static async tickBuffsOnTurnEnd(tokenId) {
        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const character = Roll20Bridge.getCharacterByToken(tokenId);
        if (!character) return [];

        const charName = character.get("name") || (token ? token.get("name") : "未知角色");
        const activeBuffs = await this.getActiveBuffs(character);
        const processed = [];

        for (const buff of activeBuffs) {
            if (buff.rounds === null) continue;

            const newRounds = buff.rounds - 1;

            if (newRounds <= 0) {
                await this.removeBuff(character, buff.rowId);
                const msg = `&{template:default} {{name=Buff 持续时间结束}} {{角色=${charName}}} {{效果=${buff.name}}} {{状态=持续时间归零，已自动取消生效。}}`;
                Roll20Bridge.sendChatMessage(msg);
                processed.push({ name: buff.name, status: "expired", remaining: 0 });
            } else {
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: newRounds });
                } else {
                    await this.setBuffRounds(character, buff.rowId, newRounds);
                }
                processed.push({ name: buff.name, status: "decremented", remaining: newRounds });
            }
        }

        return processed;
    }
}

    // ==========================================
    // 3. SuiteConfigStore 战役云端配置卡存储层
    // ==========================================
/**
 * SuiteConfigStore.js
 * 战役级云端配置角色卡读写层：
 * 1. 约定角色卡名称：=== R20_SUITE_DATABASE ===
 * 2. 角色卡为模板库的唯一真实来源（Single Source of Truth），所有 Buff 均以原生 repeating_buff2 存储；
 * 3. 严格数据真实性：若配置卡不存在，模板库直接为空，绝不注入本地预设；
 * 4. 树形拓扑结构保存在角色卡轻量属性 r20_suite_tree_structure 中，保证与原生编辑器双向实时同步。
 */
class SuiteConfigStore {
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
        return window.Campaign.characters.find(c => c.get("name") === this.DB_CHAR_NAME) || null;
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

        // 删除在原生卡上已不存在于模板树中的 Buff
        for (const [oldRowId] of existingRowMap) {
            if (!activeRowIdsInTemplates.has(oldRowId)) {
                await Pf1eBuffManager.removeBuff(dbChar, oldRowId);
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

        if (extraAttrs) {
            Object.entries(extraAttrs).forEach(([k, v]) => {
                if (k !== "name" && k !== "enable_toggle" && k !== "rounds" && k !== "tabcat" && k !== "tabcat2" && k !== "row_id") {
                    attrsToSet[`${prefix}_${k}`] = v;
                }
            });
        }

        const models = character.attribs ? character.attribs.models : [];
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

    // ==========================================
    // 4. TurnOrderObserver 先攻监听器
    // ==========================================
/**
 * TurnOrderObserver.js
 * 负责监听先攻条的所有变动，利用循环移位置换算法精确识别正向回合推进与操作意图
 */
class TurnOrderObserver {
    constructor() {
        this.cachedOrder = [];
        this.listeners = {
            turnEnded: [],
            turnStarted: [],
            orderChanged: []
        };
        this.isInitialized = false;
    }

    /**
     * 注册事件回调
     * @param {"turnEnded"|"turnStarted"|"orderChanged"} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * 开始监听先攻变动
     */
    start() {
        if (this.isInitialized || typeof window.Campaign === "undefined") return;

        // 初始化缓存
        const rawJson = window.Campaign.get("turnorder");
        this.cachedOrder = this.parseTurnorder(rawJson);

        // 绑定 Backbone 事件
        window.Campaign.on("change:turnorder", (campaign, newJson) => {
            this.handleTurnorderChange(newJson);
        });

        this.isInitialized = true;
        console.log("[TurnOrderObserver] 先攻事件监听器已就绪，当前排头:", this.getHeadTokenId());
    }

    /**
     * 解析先攻 JSON 数组
     */
    parseTurnorder(jsonStr) {
        try {
            return JSON.parse(jsonStr || "[]");
        } catch (e) {
            console.error("[TurnOrderObserver] 先攻数据解析失败:", e);
            return [];
        }
    }

    /**
     * 获取当前正在行动的 Token ID (排头)
     */
    getHeadTokenId() {
        return this.cachedOrder.length > 0 ? this.cachedOrder[0].id : null;
    }

    /**
     * 处理先攻变更
     */
    handleTurnorderChange(newJson) {
        const newList = this.parseTurnorder(newJson);
        const oldList = this.cachedOrder;

        // 若列表为空或元素数量变化（增删了怪物），仅更新缓存
        if (newList.length === 0 || oldList.length !== newList.length) {
            this.cachedOrder = newList;
            this.emit("orderChanged", { newList, oldList });
            return;
        }

        // 1. 判定正向轮转 (Next Turn): 循环左移 [A, B, C] -> [B, C, A]
        const isNextTurn = (newList[newList.length - 1].id === oldList[0].id) &&
                           (newList[0].id === oldList[1].id);

        // 2. 判定反向回退 (Previous Turn): 循环右移 [B, C, A] -> [A, B, C]
        const isPrevTurn = (oldList[oldList.length - 1].id === newList[0].id) &&
                           (oldList[0].id === newList[1].id);

        if (isNextTurn) {
            const endedTokenId = oldList[0].id;
            const startedTokenId = newList[0].id;

            console.log(`[TurnOrderObserver] 识别到正向回合结束: ${endedTokenId} -> 新排头: ${startedTokenId}`);
            
            // 派发回合结束与回合开始
            this.emit("turnEnded", { endedTokenId, startedTokenId, oldList, newList });
            this.emit("turnStarted", { startedTokenId, endedTokenId, newList });
        } else if (isPrevTurn) {
            console.log(`[TurnOrderObserver] 识别到先攻回退: ${oldList[0].id} <- ${newList[0].id}`);
        } else {
            console.log("[TurnOrderObserver] 识别到先攻排序或手动拖拽调整");
        }

        // 触发通用重排通知并更新缓存
        this.emit("orderChanged", { newList, oldList });
        this.cachedOrder = newList;
    }

    /**
     * 派发内部事件
     */
    emit(event, data) {
        const callbacks = this.listeners[event] || [];
        for (const cb of callbacks) {
            try {
                cb(data);
            } catch (err) {
                console.error(`[TurnOrderObserver] 回调异常 [${event}]:`, err);
            }
        }
    }
}

    // ==========================================
    // 5. TokenBuffManager (纯野怪 Token 状态引擎)
    // ==========================================
/**
 * TokenBuffManager.js
 * 专门处理无人物卡绑定的纯野怪/通用 Token 的 Buff 生命周期与持久化
 * 利用 Token 自身的 gmnotes 存储结构化 Buff 数据，并实时同步到 Firebase
 */
class TokenBuffManager {
    static COMMENT_PREFIX = "<!--r20_buffs:";
    static COMMENT_SUFFIX = "-->";

    /**
     * 从 Token 的 gmnotes 中提取当前所有激活的 Buff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ name, rounds, initialRounds }]
     */
    static getTokenBuffs(token) {
        if (!token) return [];
        const raw = token.get("gmnotes") || "";
        let decoded = "";
        try {
            decoded = decodeURIComponent(raw);
        } catch (e) {
            decoded = raw;
        }

        // 提取被注释包裹的 JSON 数据，避免干扰 GM 的正常备注
        const startIdx = decoded.indexOf(this.COMMENT_PREFIX);
        if (startIdx === -1) {
            // 兼容直接存 JSON 的情况
            if (decoded.trim().startsWith("[") && decoded.trim().endsWith("]")) {
                try { return JSON.parse(decoded.trim()); } catch (e) { return []; }
            }
            return [];
        }

        const endIdx = decoded.indexOf(this.COMMENT_SUFFIX, startIdx);
        if (endIdx === -1) return [];

        const jsonStr = decoded.substring(startIdx + this.COMMENT_PREFIX.length, endIdx);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("[TokenBuffManager] 解析 Token Buff 数据失败:", e);
            return [];
        }
    }

    /**
     * 将 Buff 列表安全保存回 Token 的 gmnotes 中
     * @param {object} token Graphic 模型
     * @param {Array} buffs 最新 Buff 列表
     */
    static saveTokenBuffs(token, buffs) {
        if (!token) return;
        const raw = token.get("gmnotes") || "";
        let decoded = "";
        try { decoded = decodeURIComponent(raw); } catch (e) { decoded = raw; }

        const jsonBlock = `${this.COMMENT_PREFIX}${JSON.stringify(buffs)}${this.COMMENT_SUFFIX}`;

        let newNotes = "";
        const startIdx = decoded.indexOf(this.COMMENT_PREFIX);
        if (startIdx !== -1) {
            const endIdx = decoded.indexOf(this.COMMENT_SUFFIX, startIdx);
            if (endIdx !== -1) {
                // 替换旧数据块
                newNotes = decoded.substring(0, startIdx) + jsonBlock + decoded.substring(endIdx + this.COMMENT_SUFFIX.length);
            } else {
                newNotes = decoded.substring(0, startIdx) + jsonBlock;
            }
        } else {
            // 追加在最后
            newNotes = decoded ? `${decoded}\n${jsonBlock}` : jsonBlock;
        }

        // 保存并自动推送到 Firebase
        token.save({ gmnotes: encodeURIComponent(newNotes) });
    }

    /**
     * 对纯 Token 施加或刷新 Buff（同名只刷新轮数，不同名追加）
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 细目属性字典
     */
    static applyOrRefreshBuff(token, buffName, rounds = null, extraAttrs = null) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        if (!cleanName) return false;

        const buffs = this.getTokenBuffs(token);
        const existing = buffs.find(b => b.name === cleanName);

        if (existing) {
            existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
            if (extraAttrs) existing.extraAttrs = extraAttrs;
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 剩余: ${rounds}轮`);
        } else {
            buffs.push({
                name: cleanName,
                rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null,
                extraAttrs: extraAttrs || null
            });
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 新增 Buff [${cleanName}], 轮数: ${rounds}`);
        }

        this.saveTokenBuffs(token, buffs);
        return true;
    }

    /**
     * 移除纯 Token 上的某个 Buff
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     */
    static removeBuff(token, buffName) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        let buffs = this.getTokenBuffs(token);
        const beforeLen = buffs.length;
        buffs = buffs.filter(b => b.name !== cleanName);

        if (buffs.length !== beforeLen) {
            this.saveTokenBuffs(token, buffs);
            console.log(`[TokenBuffManager] 已解除 Token [${token.get("name")}] 的 Buff [${cleanName}]`);
            return true;
        }
        return false;
    }

    /**
     * 当纯 Token 行动结束时扣减 1 轮
     * @param {string} tokenId Token ID
     */
    static tickBuffsOnTurnEnd(tokenId) {
        const token = Roll20Bridge.getTokenGraphic(tokenId);
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        if (buffs.length === 0) return [];

        const tokenName = token.get("name") || "未命名棋子";
        const remainingBuffs = [];
        const processed = [];

        for (const buff of buffs) {
            if (buff.rounds === null) {
                remainingBuffs.push(buff);
                continue;
            }

            const nextRounds = buff.rounds - 1;
            if (nextRounds <= 0) {
                // 广播到期消息
                const msg = `&{template:default} {{name=Buff 持续时间结束}} {{单位=${tokenName}}} {{效果=${buff.name}}} {{状态=持续时间归零，已解除。}}`;
                Roll20Bridge.sendChatMessage(msg);
                processed.push({ name: buff.name, status: "expired" });
            } else {
                buff.rounds = nextRounds;
                remainingBuffs.push(buff);
                processed.push({ name: buff.name, status: "decremented", remaining: nextRounds });
            }
        }

        this.saveTokenBuffs(token, remainingBuffs);
        return processed;
    }
}

    // ==========================================
    // 6. Pf1eBuffUI (先攻列表徽章交互层)
    // ==========================================
/**
 * Pf1eBuffUI.js
 * 负责在先攻条注入极致紧凑的双行 Buff 徽章，同时无缝支持人物卡与纯野怪 Token
 */
class Pf1eBuffUI {
    static isStylesInjected = false;

    static injectStyles() {
        if (this.isStylesInjected) return;
        const style = document.createElement("style");
        style.id = "pf1e-buff-tracker-styles";
        style.textContent = `
            .r20-buff-container {
                display: inline-flex;
                flex-wrap: wrap;
                max-height: 34px;
                max-width: 180px;
                overflow: hidden;
                gap: 2px 3px;
                margin-left: 6px;
                vertical-align: middle;
                line-height: 1;
            }
            .r20-buff-pill-compact {
                display: inline-flex;
                align-items: center;
                background: #1f364d;
                color: #e0e6ed;
                font-size: 10px;
                font-weight: 500;
                padding: 1px 4px;
                border-radius: 3px;
                cursor: pointer;
                user-select: none;
                border: 1px solid rgba(255, 255, 255, 0.12);
                white-space: nowrap;
                transition: background 0.15s, border-color 0.15s;
            }
            .r20-buff-pill-compact:hover {
                background: #2a4d6f;
                border-color: #64b5f6;
                color: #ffffff;
            }
            .r20-buff-pill-compact.expiring {
                background: #5c1d1d;
                border-color: #e57373;
                color: #ffcdd2;
            }
            .r20-add-buff-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 15px;
                height: 15px;
                background: rgba(255, 255, 255, 0.08);
                color: #90a4ae;
                font-size: 11px;
                border-radius: 3px;
                cursor: pointer;
                margin-left: 4px;
                vertical-align: middle;
            }
            .r20-add-buff-btn:hover {
                background: #2e7d32;
                color: #ffffff;
            }
        `;
        document.head.appendChild(style);
        this.isStylesInjected = true;
    }

    /**
     * 刷新整个先攻条上的徽章
     */
    static async refreshAllBadges() {
        this.injectStyles();
        const tracker = document.querySelector(".turn-tracker");
        if (!tracker) return;

        const rows = tracker.querySelectorAll("li.token");
        for (const row of rows) {
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                await this.refreshRowBadge(row, tokenId);
            }
        }
    }

    /**
     * 刷新单行徽章（自适应人物卡与纯野怪 Token）
     */
    static async refreshRowBadge(row, tokenId) {
        const nameEl = row.querySelector(".name");
        if (!nameEl) return;

        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const character = Roll20Bridge.getCharacterByToken(tokenId);

        let activeBuffs = [];
        const isCharacter = !!character;

        if (isCharacter) {
            // 人物卡绑定单位
            activeBuffs = await Pf1eBuffManager.getActiveBuffs(character);
        } else if (token) {
            // 纯 Token 野怪单位
            activeBuffs = TokenBuffManager.getTokenBuffs(token).map(b => ({
                name: b.name,
                rounds: b.rounds,
                rowId: null,
                isTokenOnly: true
            }));
        }

        let container = row.querySelector(".r20-buff-container");
        if (!container) {
            container = document.createElement("span");
            container.className = "r20-buff-container";
            nameEl.appendChild(container);
        }

        container.innerHTML = "";

        // 渲染紧凑徽章
        for (const buff of activeBuffs) {
            const pill = document.createElement("span");
            const isExpiring = buff.rounds !== null && buff.rounds <= 1;
            const showRounds = buff.rounds !== null && buff.rounds <= 100;
            const text = showRounds ? `${buff.name} ${buff.rounds}` : buff.name;

            pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
            pill.title = `${buff.name} (剩余 ${buff.rounds !== null ? buff.rounds + '轮' : '常驻'})，点击修改或解除`;
            pill.textContent = text;

            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                this.showBuffEditModal(character, token, buff, row, tokenId);
            });

            container.appendChild(pill);
        }

        // 渲染单行快捷加号 [+]
        let addBtn = row.querySelector(".r20-add-buff-btn");
        if (!addBtn) {
            addBtn = document.createElement("span");
            addBtn.className = "r20-add-buff-btn";
            addBtn.textContent = "+";
            const targetName = character ? character.get("name") : (token ? token.get("name") : "单位");
            addBtn.title = `为 [${targetName}] 快速添加新Buff`;
            addBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.showSingleAddModal(character, token, row, tokenId);
            });
            nameEl.appendChild(addBtn);
        }
    }

    /**
     * 单项修改与快速解除弹窗
     */
    static showBuffEditModal(character, token, buff, row, tokenId) {
        const targetName = character ? character.get("name") : (token ? token.get("name") : "单位");
        const mask = document.createElement("div");
        mask.className = "r20-modal-mask";

        mask.innerHTML = `
            <div class="r20-modal-box">
                <div class="r20-modal-title">Buff 设置 - ${targetName}</div>
                <div class="r20-modal-row">
                    <span class="r20-modal-label">当前 Buff：<b>${buff.name}</b></span>
                </div>
                <div class="r20-modal-row">
                    <label class="r20-modal-label">剩余轮数 (大于100或留空视为常驻)：</label>
                    <input type="number" class="r20-modal-input edit-rounds-input" value="${buff.rounds !== null ? buff.rounds : ''}" placeholder="常驻" />
                </div>
                <div class="r20-modal-actions">
                    <button class="r20-btn r20-btn-danger btn-remove">🗑️ 解除/删除</button>
                    <button class="r20-btn r20-btn-cancel btn-cancel">取消</button>
                    <button class="r20-btn r20-btn-primary btn-save">保存轮数</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-remove").addEventListener("click", async () => {
            if (character && buff.rowId) {
                await Pf1eBuffManager.removeBuff(character, buff.rowId);
            } else if (token) {
                TokenBuffManager.removeBuff(token, buff.name);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const val = mask.querySelector(".edit-rounds-input").value.trim();
            const parsed = val === "" ? null : parseInt(val, 10);
            if (character && buff.rowId) {
                await Pf1eBuffManager.setBuffRounds(character, buff.rowId, parsed);
            } else if (token) {
                TokenBuffManager.applyOrRefreshBuff(token, buff.name, parsed);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
    }

    /**
     * 单行快速添加弹窗
     */
    static showSingleAddModal(character, token, row, tokenId) {
        const targetName = character ? character.get("name") : (token ? token.get("name") : "单位");
        const mask = document.createElement("div");
        mask.className = "r20-modal-mask";

        const presets = ["神恩", "加速术", "祝福术", "护盾术", "牛之力量", "树皮术", "法师护甲", "祈祷术"];

        mask.innerHTML = `
            <div class="r20-modal-box">
                <div class="r20-modal-title">添加 Buff - ${targetName}</div>
                <div class="r20-modal-row">
                    <label class="r20-modal-label">Buff 名称：</label>
                    <input type="text" class="r20-modal-input buff-name-input" placeholder="输入名称或点击下方快捷标签" />
                    <div class="r20-modal-tags">
                        ${presets.map(p => `<span class="r20-tag-pill">${p}</span>`).join("")}
                    </div>
                </div>
                <div class="r20-modal-row">
                    <label class="r20-modal-label">持续轮数 (默认10轮，大于100或留空视为常驻)：</label>
                    <input type="number" class="r20-modal-input buff-rounds-input" value="10" />
                </div>
                <div class="r20-modal-actions">
                    <button class="r20-btn r20-btn-cancel btn-cancel">取消</button>
                    <button class="r20-btn r20-btn-primary btn-confirm">确定添加</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);

        mask.querySelectorAll(".r20-tag-pill").forEach(tag => {
            tag.addEventListener("click", () => {
                mask.querySelector(".buff-name-input").value = tag.innerText;
            });
        });

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-confirm").addEventListener("click", async () => {
            const name = mask.querySelector(".buff-name-input").value.trim();
            if (!name) return;
            const roundsStr = mask.querySelector(".buff-rounds-input").value.trim();
            const rounds = roundsStr === "" ? null : parseInt(roundsStr, 10);

            if (character) {
                await Pf1eBuffManager.applyOrRefreshBuff(character, name, rounds);
            } else if (token) {
                TokenBuffManager.applyOrRefreshBuff(token, name, rounds);
            }

            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
    }
}

    // ==========================================
    // 7. BuffPanelStyles (面板静态 CSS 样式)
    // ==========================================
/**
 * BuffPanelStyles.js
 * 状态Buff工作台样式定义与注入器
 */
class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static getCss() {
        return `
            /* 主悬浮窗容器 */
            #r20-buff-panel {
                position: fixed;
                width: 320px;
                background: #1a1e24;
                border: 1px solid #323d47;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #eceff1;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                user-select: none;
                box-sizing: border-box;
            }

            /* 向上展开时的布局翻转：标题栏在底，内容在顶 */
            #r20-buff-panel.direction-up {
                flex-direction: column-reverse;
            }

            /* 标题栏 */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 10px;
                background: #232b34;
                cursor: grab;
                box-sizing: border-box;
                border-radius: 7px 7px 0 0;
                border-bottom: 1px solid #323d47;
            }
            #r20-buff-panel.direction-up .r20-panel-header {
                border-radius: 0 0 7px 7px;
                border-top: 1px solid #323d47;
                border-bottom: none;
            }
            /* 折叠为纯标题时，四周完整圆角 */
            #r20-buff-panel.is-collapsed .r20-panel-header {
                border-radius: 7px;
                border-top: none;
                border-bottom: none;
            }

            .r20-panel-title {
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .r20-panel-controls {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .r20-btn-icon {
                background: none;
                border: none;
                color: #90a4ae;
                font-size: 12px;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                transition: background 0.15s, color 0.15s;
                line-height: 1.2;
            }
            .r20-btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .r20-btn-icon.active {
                background: #1565c0;
                color: #ffffff;
            }
            .r20-btn-icon.pinned {
                color: #ffd54f !important;
                background: rgba(255, 213, 79, 0.15);
            }
            .r20-btn-icon.danger { color: #ef5350; }
            .r20-btn-icon.danger:hover { background: #c62828; color: #ffffff; }

            /* 面板主体 */
            .r20-panel-body {
                display: flex;
                flex-direction: column;
                gap: 0px;
                max-height: 80vh;
                overflow: visible;
                box-sizing: border-box;
            }
            #r20-buff-panel.is-collapsed .r20-panel-body {
                display: none !important;
            }
            #r20-buff-panel.direction-up .r20-panel-body {
                flex-direction: column-reverse;
            }

            /* 分立窗格通用样式 */
            .r20-split-pane {
                display: flex;
                flex-direction: column;
                background: #1a1e24;
                border-bottom: 1px solid #2a3440;
                box-sizing: border-box;
            }
            #r20-buff-panel.direction-up .r20-split-pane:first-child {
                border-bottom: none;
                border-top: 1px solid #2a3440;
            }
            .r20-pane-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #1e242c;
                font-size: 11px;
                font-weight: 600;
                color: #90caf9;
                cursor: pointer;
                border-top: 1px solid #2c3642;
                border-bottom: 1px solid #2c3642;
            }
            .r20-pane-header:hover {
                background: #252d37;
            }
            .r20-pane-title {
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .r20-pane-content {
                max-height: 260px;
                overflow-y: auto;
                padding: 6px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                box-sizing: border-box;
            }

            /* 工具栏 */
            .r20-panel-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #161b20;
                border-bottom: 1px solid #263238;
                font-size: 11px;
            }

            /* 根目录放置区 */
            .r20-drop-zone-root {
                padding: 4px;
                border: 1px dashed #37474f;
                border-radius: 4px;
                text-align: center;
                font-size: 10px;
                color: #78909c;
                margin: 2px 0;
                display: none;
                transition: background 0.2s, border-color 0.2s;
            }
            .r20-drop-zone-root.active-zone { display: block; }
            .r20-drop-zone-root.r20-drag-into {
                background: rgba(33, 150, 243, 0.2);
                border-color: #64b5f6;
                color: #ffffff;
            }

            /* 树状文件夹与项目 */
            .r20-tree-folder { display: flex; flex-direction: column; margin-bottom: 2px; }
            .r20-folder-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 6px;
                background: #202730;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                color: #b0bec5;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s ease;
            }
            .r20-folder-header:hover { background: #2a3440; color: #ffffff; }
            .r20-folder-header.full-active {
                background: #1b4931 !important;
                border-color: #4caf50 !important;
                color: #e8f5e9 !important;
            }
            .r20-folder-header.partial-active {
                background: #3b3920 !important;
                border-color: #fbc02d !important;
                color: #fffde7 !important;
            }
            .r20-folder-title { display: flex; align-items: center; gap: 5px; overflow: hidden; }
            .r20-folder-children {
                margin-left: 12px;
                border-left: 1px dashed #37474f;
                padding-left: 6px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-top: 2px;
            }

            .r20-tree-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: #242c37;
                border-radius: 4px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2e3947;
                border-color: #64b5f6;
                color: #ffffff;
            }
            .r20-tree-item.full-active {
                background: #1e3d59 !important;
                border-color: #42a5f5 !important;
                color: #ffffff !important;
                box-shadow: inset 0 0 8px rgba(66, 165, 245, 0.4);
            }
            .r20-tree-item.partial-active {
                background: #2e2a1b !important;
                border-color: #ffd54f !important;
                color: #fff8e1 !important;
                border-style: dashed !important;
            }
            .r20-tree-item.edit-selected, .r20-tree-folder.edit-selected > .r20-folder-header {
                background: #4a148c !important;
                border-color: #ba68c8 !important;
                color: #f3e5f5 !important;
            }
            .r20-item-left { display: flex; align-items: center; gap: 6px; overflow: hidden; }
            .r20-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
            }
            .r20-item-actions { display: flex; align-items: center; gap: 4px; }

            .r20-drag-over { border-top: 2px solid #64b5f6 !important; }
            .r20-drag-into { background: rgba(25, 118, 210, 0.3) !important; }

            /* 空列表占位说明 */
            .r20-empty-placeholder {
                padding: 18px 12px;
                text-align: center;
                color: #78909c;
                font-size: 11px;
                line-height: 1.5;
            }

            /* Toast 提示条 */
            .r20-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(26, 30, 36, 0.95);
                color: #ffffff;
                border: 1px solid #37474f;
                padding: 8px 18px;
                border-radius: 20px;
                font-size: 12px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                z-index: 1000000;
                pointer-events: none;
                transition: opacity 0.3s;
                display: none;
            }
            .r20-toast.warn { border-color: #ffb74d; color: #ffe082; }
            .r20-toast.success { border-color: #81c784; color: #c8e6c9; }

            /* 对话框模态层 */
            .r20-dialog-mask {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.65);
                z-index: 1000001;
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
                box-shadow: 0 10px 30px rgba(0,0,0,0.8);
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

    static inject() {
        if (document.querySelector(`#${this.STYLESHEET_ID}`)) return;
        const style = document.createElement("style");
        style.id = this.STYLESHEET_ID;
        style.textContent = this.getCss();
        document.head.appendChild(style);
    }
}

    // ==========================================
    // 8. BuffPanelTemplates (面板静态 HTML 模板)
    // ==========================================
/**
 * BuffPanelTemplates.js
 * 状态Buff工作台 HTML 结构模板生成器
 */
class BuffPanelTemplates {
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

    // ==========================================
    // 9. BuffPanelDragDrop (面板拖拽手势交互)
    // ==========================================
/**
 * BuffPanelDragDrop.js
 * 状态Buff工作台拖拽手势与交互处理器（窗口拖拽、栏内排序、跨栏复制）
 */
class BuffPanelDragDrop {
    /**
     * 初始化窗口标题栏拖拽移动
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
        const header = panelEl.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX, startY, initialX, initialY;

        header.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            isDragging = true;
            header.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            initialX = panelEl.offsetLeft;
            initialY = panelEl.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const newLeft = Math.max(10, Math.min(window.innerWidth - 340, initialX + dx));
                const newTop = Math.max(10, Math.min(window.innerHeight - 60, initialY + dy));

                panelEl.style.left = `${newLeft}px`;
                panelEl.style.top = `${newTop}px`;
                panelEl.style.right = "auto";
                if (onDragging) onDragging(newLeft, newTop);
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    if (onDragEnd) onDragEnd(panelEl.offsetLeft, panelEl.offsetTop);
                }
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    }

    /**
     * 为树节点挂载拖拽手势
     */
    static setupItemDrag({ el, node, parentList, index, sourcePane, getDraggedContext, setDraggedContext, onCrossCopy, onReorder }) {
        el.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            setDraggedContext({
                node,
                parentList,
                index,
                sourcePane
            });
            e.dataTransfer.setData("text/plain", node.name);
            el.style.opacity = "0.5";
        });

        el.addEventListener("dragend", (e) => {
            e.stopPropagation();
            el.style.opacity = "1";
            document.querySelectorAll(".r20-drag-over, .r20-drag-into").forEach(item => {
                item.classList.remove("r20-drag-over", "r20-drag-into");
            });
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (node.type === "folder") {
                el.classList.add("r20-drag-into");
            } else {
                el.classList.add("r20-drag-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");
        });

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            // 1. 跨栏拖拽：单位栏 -> 模板库 (复制另存为新模板)
            if (fromPane === "unit" && sourcePane === "template") {
                if (onCrossCopy) await onCrossCopy(draggedNode, node, parentList, index);
                setDraggedContext(null);
                return;
            }

            // 2. 栏内排序：模板库 -> 模板库
            if (fromPane === "template" && sourcePane === "template" && sourceList) {
                if (draggedNode.id === node.id) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index);
                setDraggedContext(null);
            }
        });
    }

    /**
     * 模板库根目录放置区
     */
    static setupRootDropZone({ el, templates, getDraggedContext, setDraggedContext, onCrossCopyRoot, onReorderRoot }) {
        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("r20-drag-into");
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-into");
        });

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            if (fromPane === "unit") {
                if (onCrossCopyRoot) await onCrossCopyRoot(draggedNode);
                setDraggedContext(null);
                return;
            }

            if (fromPane === "template" && sourceList) {
                if (onReorderRoot) await onReorderRoot(draggedNode, sourceList, sourceIdx);
                setDraggedContext(null);
            }
        });
    }
}

    // ==========================================
    // 10. BuffFloatingPanel (状态Buff悬浮工作台控制器)
    // ==========================================
/**
 * BuffFloatingPanel.js
 * 状态Buff工作台主控制器：
 * 1. 上下双栏独立延伸、重心自适应反转（底端固定、向上生长）；
 * 2. 物理折叠（- 缩成只有标题栏，标号变为 +；未固定时移出 400ms 自动折叠，移入展开）；
 * 3. 三态直接点按高亮交互与未启用 Buff 展示；
 * 4. 角色卡原生 repeating_buff2 数据源实时全量同步，空卡即为空库；
 * 5. 编辑模式解绑与跨栏拖拽复制。
 */
class BuffFloatingPanel {
    static POS_KEY = "r20_suite_panel_pos_v6";
    static PIN_KEY = "r20_suite_panel_pinned_v6";
    static COLLAPSE_KEY = "r20_suite_panel_collapsed_v6";

    static panelEl = null;
    static isPinned = false;
    static isCollapsed = false;
    static isEditMode = false;
    static isTemplatePaneCollapsed = false;
    static isUnitPaneCollapsed = false;
    static isDirectionUp = false;

    static templates = [];
    static editSelectedIds = new Set();
    static _draggedData = null;
    static _leaveTimer = null;

    /**
     * 初始化悬浮面板
     */
    static async init() {
        BuffPanelStyles.inject();

        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.isCollapsed = localStorage.getItem(this.COLLAPSE_KEY) === "true";

        // 从云端原生角色卡加载模板
        this.templates = await SuiteConfigStore.loadTemplates();

        this.createPanelDOM();
        this.initHoverCollapse();
        this.initDragGestures();

        // 监听画布 Token 选区变化
        if (window.d20 && window.d20.engine) {
            window.d20.engine.canvas.on("selection:created", () => this.onSelectionChange());
            window.d20.engine.canvas.on("selection:updated", () => this.onSelectionChange());
            window.d20.engine.canvas.on("selection:cleared", () => this.onSelectionChange());
        }

        await this.renderAllPanes();
    }

    /**
     * 选区变化防抖
     */
    static onSelectionChange() {
        if (this._selTimer) clearTimeout(this._selTimer);
        this._selTimer = setTimeout(async () => {
            await this.renderAllPanes();
        }, 120);
    }

    /**
     * 创建悬浮面板主 DOM
     */
    static createPanelDOM() {
        if (document.querySelector("#r20-buff-panel")) return;

        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";

        panel.innerHTML = BuffPanelTemplates.getMainPanelHTML({
            isPinned: this.isPinned,
            isCollapsed: this.isCollapsed,
            isTemplatePaneCollapsed: this.isTemplatePaneCollapsed,
            isUnitPaneCollapsed: this.isUnitPaneCollapsed
        });

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 应用初始折叠状态
        if (this.isCollapsed) {
            panel.classList.add("is-collapsed");
        }

        // 读取持久化位置并设置锚点
        this.restorePanelPosition();

        // 绑定头部按钮
        panel.querySelector(".btn-toggle-pin").addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());

        // 双栏折叠监听
        panel.querySelector(".r20-template-pane .r20-pane-header").addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            this.isTemplatePaneCollapsed = !this.isTemplatePaneCollapsed;
            panel.querySelector(".r20-template-pane .toggle-icon").textContent = this.isTemplatePaneCollapsed ? "▶" : "▼";
            panel.querySelector(".r20-template-tree").style.display = this.isTemplatePaneCollapsed ? "none" : "flex";
            this.updateLayoutDirection();
        });

        panel.querySelector(".r20-unit-pane .r20-pane-header").addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") return;
            this.isUnitPaneCollapsed = !this.isUnitPaneCollapsed;
            panel.querySelector(".r20-unit-pane .toggle-icon").textContent = this.isUnitPaneCollapsed ? "▶" : "▼";
            panel.querySelector(".r20-unit-tree").style.display = this.isUnitPaneCollapsed ? "none" : "flex";
            this.updateLayoutDirection();
        });

        // 模板工具栏
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
        panel.querySelector(".btn-import-buffs").addEventListener("click", () => this.showImportFromCharacterDialog());
        panel.querySelector(".btn-batch-delete").addEventListener("click", () => this.deleteSelectedBuffs());

        this.updateLayoutDirection();
    }

    /**
     * 恢复持久化坐标并安全钳制
     */
    static restorePanelPosition() {
        const savedPos = localStorage.getItem(this.POS_KEY);
        let left = Math.max(10, window.innerWidth - 340);
        let top = 100;

        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                if (pos.left !== undefined) left = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
                if (pos.top !== undefined) top = Math.max(10, Math.min(window.innerHeight - 80, pos.top));
            } catch (e) {}
        }

        this.applyPosition(left, top);
    }

    /**
     * 应用坐标并自动判定上/下展开模式
     * 关键逻辑：若在下半区（direction-up），以底部锚定（bottom），使高度伸缩完全向上生长
     */
    static applyPosition(left, top) {
        if (!this.panelEl) return;
        const middleY = window.innerHeight / 2;
        this.isDirectionUp = top > middleY;

        this.panelEl.style.left = `${left}px`;
        this.panelEl.style.right = "auto";

        if (this.isDirectionUp) {
            this.panelEl.classList.add("direction-up");
            this.panelEl.classList.remove("direction-down");

            // 锁定标题栏在视口的位置：让底端对齐 (window.innerHeight - (top + 34))
            const bottomOffset = Math.max(10, window.innerHeight - (top + 34));
            this.panelEl.style.top = "auto";
            this.panelEl.style.bottom = `${bottomOffset}px`;
        } else {
            this.panelEl.classList.add("direction-down");
            this.panelEl.classList.remove("direction-up");

            this.panelEl.style.bottom = "auto";
            this.panelEl.style.top = `${top}px`;
        }
    }

    /**
     * 更新布局反转与伸展方向
     */
    static updateLayoutDirection() {
        if (!this.panelEl) return;
        const rect = this.panelEl.getBoundingClientRect();
        const middleY = window.innerHeight / 2;
        const isUp = rect.top > middleY || (rect.bottom > middleY && rect.top > 150);

        if (isUp !== this.isDirectionUp) {
            this.isDirectionUp = isUp;
            if (this.isDirectionUp) {
                this.panelEl.classList.add("direction-up");
                this.panelEl.classList.remove("direction-down");
            } else {
                this.panelEl.classList.add("direction-down");
                this.panelEl.classList.remove("direction-up");
            }
        }
    }

    /**
     * 拖拽手势初始化
     */
    static initDragGestures() {
        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            (left, top) => {
                // 拖拽结束：持久化坐标并重新定锚
                localStorage.setItem(this.POS_KEY, JSON.stringify({ left, top }));
                this.applyPosition(left, top);
            },
            (left, top) => {
                this.updateLayoutDirection();
            }
        );
    }

    /**
     * 鼠标移入展开、移出折叠（未钉住时 400ms 防抖）
     */
    static initHoverCollapse() {
        this.panelEl.addEventListener("mouseenter", () => {
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapsed(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (this.isPinned) return;
            if (this._leaveTimer) clearTimeout(this._leaveTimer);
            this._leaveTimer = setTimeout(() => {
                if (!this.isPinned && !this.isCollapsed) {
                    this.setCollapsed(true);
                }
            }, 400);
        });
    }

    /**
     * 设置物理折叠状态
     */
    static setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        localStorage.setItem(this.COLLAPSE_KEY, String(collapsed));

        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (this.isCollapsed) {
            this.panelEl.classList.add("is-collapsed");
            if (minBtn) {
                minBtn.textContent = "+";
                minBtn.title = "展开面板";
            }
        } else {
            this.panelEl.classList.remove("is-collapsed");
            if (minBtn) {
                minBtn.textContent = "-";
                minBtn.title = "折叠面板(仅留标题)";
            }
            this.updateLayoutDirection();
        }
    }

    /**
     * 切换最小化折叠
     */
    static toggleCollapse() {
        this.setCollapsed(!this.isCollapsed);
    }

    /**
     * 图钉固定切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        const btnPin = this.panelEl.querySelector(".btn-toggle-pin");

        if (this.isPinned) {
            btnPin.classList.add("pinned");
            btnPin.title = "取消固定(移出自动折叠)";
            if (this.isCollapsed) this.setCollapsed(false);
            this.showToast("📌 已固定悬浮窗显示", "info");
        } else {
            btnPin.classList.remove("pinned");
            btnPin.title = "固定常驻显示";
            this.showToast("📌 已开启鼠标移出自动折叠", "info");
        }
    }

    /**
     * 编辑模式切换
     */
    static async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        const toolbar = this.panelEl.querySelector(".r20-panel-toolbar");

        if (this.isEditMode) {
            editBtn.classList.add("active");
            editBtn.textContent = "🔒 完成";
            toolbar.style.display = "flex";
            this.editSelectedIds.clear();
            this.showToast("✏️ 已进入编辑模式：点击多选待删，支持跨栏拖拽复制", "info");
        } else {
            editBtn.classList.remove("active");
            editBtn.textContent = "✏️ 编辑";
            toolbar.style.display = "none";
            this.editSelectedIds.clear();
        }

        await this.renderAllPanes();
    }

    /**
     * 渲染全部窗格
     */
    static async renderAllPanes() {
        await this.renderTemplatePane();
        await this.renderUnitPane();
        this.updateLayoutDirection();
    }

    /**
     * 获取画布选中的 Tokens
     */
    static getSelectedTokens() {
        if (!window.d20 || !window.d20.engine || !window.d20.engine.canvas) return [];
        const active = window.d20.engine.canvas.getActiveObjects ? window.d20.engine.canvas.getActiveObjects() : [];
        const result = [];

        for (const obj of active) {
            const tokenModel = (window.Campaign && window.Campaign.pages)
                ? window.Campaign.pages.get(window.currentEditingPageID || (window.Campaign.activePage && window.Campaign.activePage.id))
                    ?.thegraphics?.get(obj.id)
                : null;

            if (tokenModel) {
                const charId = tokenModel.get("represents");
                if (charId && window.Campaign && window.Campaign.characters) {
                    const char = window.Campaign.characters.get(charId);
                    if (char) {
                        result.push({ type: "character", char, token: tokenModel, name: char.get("name") });
                        continue;
                    }
                }
                result.push({ type: "token", token: tokenModel, name: tokenModel.get("name") || "未命名棋子" });
            }
        }

        return result;
    }

    /**
     * 收集选中单位的 Buff 详情
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        const allBuffRows = [];
        if (selectedTokens.length === 0) return { activeStats, allBuffRows };

        for (const item of selectedTokens) {
            let itemBuffs = [];
            if (item.type === "character" && item.char) {
                itemBuffs = await Pf1eBuffManager.getAllBuffs(item.char);
            } else if (item.token) {
                const tokenBuffs = TokenBuffManager.getTokenBuffs(item.token);
                itemBuffs = tokenBuffs.map(b => ({
                    name: b.name,
                    enabled: true,
                    rounds: b.rounds
                }));
            }

            const activeNames = itemBuffs.filter(b => b.enabled).map(b => b.name);
            const uniqueActiveNames = new Set(activeNames);
            for (const name of uniqueActiveNames) {
                if (!activeStats.has(name)) {
                    activeStats.set(name, { count: 1, total: selectedTokens.length });
                } else {
                    activeStats.get(name).count++;
                }
            }

            for (const b of itemBuffs) {
                let existing = allBuffRows.find(x => x.name === b.name);
                if (!existing) {
                    allBuffRows.push({
                        name: b.name,
                        enabledCount: b.enabled ? 1 : 0,
                        totalCount: 1,
                        rounds: b.rounds,
                        extraAttrs: b.extraAttrs || null
                    });
                } else {
                    existing.totalCount++;
                    if (b.enabled) existing.enabledCount++;
                }
            }
        }

        return { activeStats, allBuffRows };
    }

    /**
     * 渲染模板库栏
     */
    static async renderTemplatePane() {
        const treeEl = this.panelEl.querySelector(".r20-template-tree");
        if (!treeEl) return;
        treeEl.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();
        const { activeStats } = await this.getBuffStatsForSelected(selectedTokens);

        // 根目录放置区（编辑模式展示）
        const rootDropZone = document.createElement("div");
        rootDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        rootDropZone.textContent = "📥 拖拽到此处放置于根目录";
        BuffPanelDragDrop.setupRootDropZone({
            el: rootDropZone,
            templates: this.templates,
            getDraggedContext: () => this._draggedData,
            setDraggedContext: (ctx) => { this._draggedData = ctx; },
            onCrossCopyRoot: async (draggedNode) => {
                const copyNode = {
                    id: "b_" + Date.now(),
                    type: "buff",
                    name: draggedNode.name,
                    rounds: draggedNode.rounds,
                    extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                };
                this.templates.push(copyNode);
                await this.saveTemplates(true);
                await this.renderAllPanes();
                this.showToast(`📋 已复制 [${copyNode.name}] 到模板库`, "success");
            },
            onReorderRoot: async (draggedNode, sourceList, sourceIdx) => {
                sourceList.splice(sourceIdx, 1);
                this.templates.push(draggedNode);
                await this.saveTemplates(true);
                await this.renderTemplatePane();
            }
        });
        treeEl.appendChild(rootDropZone);

        // 如果没有模板，呈现说明
        if (this.templates.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "r20-empty-placeholder";
            emptyEl.innerHTML = `暂无模板数据<br><span style="font-size:10px; color:#546e7a;">点击上方的「✏️ 编辑」再点「+ Buff」即可创建原生配置卡并保存模板</span>`;
            treeEl.appendChild(emptyEl);
            return;
        }

        this.renderTemplateNodes(this.templates, treeEl, activeStats, selectedTokens);
    }

    /**
     * 递归渲染模板库节点
     */
    static renderTemplateNodes(nodes, container, activeStats, selectedTokens) {
        nodes.forEach((node, idx) => {
            if (node.type === "folder") {
                const folderEl = document.createElement("div");
                folderEl.className = "r20-tree-folder";

                const allChildBuffs = this.collectFolderBuffNames(node);
                let folderClass = "";
                if (!this.isEditMode && selectedTokens.length > 0 && allChildBuffs.length > 0) {
                    let totalMatches = 0;
                    allChildBuffs.forEach(name => {
                        const stat = activeStats.get(name);
                        if (stat && stat.count === stat.total) totalMatches++;
                    });
                    if (totalMatches === allChildBuffs.length) folderClass = "full-active";
                    else if (totalMatches > 0) folderClass = "partial-active";
                } else if (this.isEditMode && this.editSelectedIds.has(node.id)) {
                    folderClass = "edit-selected";
                }

                const header = document.createElement("div");
                header.className = `r20-folder-header ${folderClass}`;
                if (this.isEditMode) header.draggable = true;

                header.innerHTML = `
                    <div class="r20-folder-title">
                        <span class="folder-icon">${node.collapsed ? "📁" : "📂"}</span>
                        <span>${node.name}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `
                            <button class="r20-btn-icon btn-folder-rename" title="重命名">✏️</button>
                            <button class="r20-btn-icon danger btn-node-delete" title="删除文件夹">🗑️</button>
                        ` : ""}
                    </div>
                `;

                // 挂载拖拽手势
                BuffPanelDragDrop.setupItemDrag({
                    el: header,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; },
                    onCrossCopy: async (draggedNode, targetNode) => {
                        const copyNode = {
                            id: "b_" + Date.now(),
                            type: "buff",
                            name: draggedNode.name,
                            rounds: draggedNode.rounds,
                            extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                        };
                        targetNode.children = targetNode.children || [];
                        targetNode.children.push(copyNode);
                        targetNode.collapsed = false;
                        await this.saveTemplates(true);
                        await this.renderAllPanes();
                        this.showToast(`📋 已将 [${copyNode.name}] 存入文件夹 [${targetNode.name}]`, "success");
                    },
                    onReorder: async (draggedNode, sourceList, sourceIdx, targetNode) => {
                        sourceList.splice(sourceIdx, 1);
                        targetNode.children = targetNode.children || [];
                        targetNode.children.push(draggedNode);
                        targetNode.collapsed = false;
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });

                // 点击事件
                header.addEventListener("click", async (e) => {
                    if (e.target.tagName === "BUTTON") return;
                    if (this.isEditMode) {
                        if (this.editSelectedIds.has(node.id)) this.editSelectedIds.delete(node.id);
                        else this.editSelectedIds.add(node.id);
                        this.renderTemplatePane();
                        return;
                    }

                    if (selectedTokens.length > 0) {
                        const shouldApplyAll = folderClass !== "full-active";
                        for (const bName of allChildBuffs) {
                            const foundBuff = this.findBuffNodeByName(node, bName);
                            await this.toggleBuffAction(bName, foundBuff?.rounds, foundBuff?.extraAttrs, shouldApplyAll);
                        }
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        node.collapsed = !node.collapsed;
                        await this.saveTemplates(false);
                        this.renderTemplatePane();
                    }
                });

                // 编辑模式内按钮
                if (this.isEditMode) {
                    header.querySelector(".btn-folder-rename")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const newName = prompt("请输入新文件夹名称:", node.name);
                        if (newName && newName.trim()) {
                            node.name = newName.trim();
                            await this.saveTemplates(true);
                            this.renderTemplatePane();
                        }
                    });

                    header.querySelector(".btn-node-delete")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除文件夹 [${node.name}] 及其内部所有内容吗？`)) {
                            nodes.splice(idx, 1);
                            await this.saveTemplates(true);
                            await this.renderTemplatePane();
                        }
                    });
                }

                folderEl.appendChild(header);

                // 子容器
                const childrenContainer = document.createElement("div");
                childrenContainer.className = "r20-folder-children";
                childrenContainer.style.display = node.collapsed ? "none" : "flex";

                if (node.children && node.children.length > 0) {
                    this.renderTemplateNodes(node.children, childrenContainer, activeStats, selectedTokens);
                }
                folderEl.appendChild(childrenContainer);
                container.appendChild(folderEl);

            } else if (node.type === "buff") {
                const itemEl = document.createElement("div");
                const stat = activeStats.get(node.name);
                const isFullActive = selectedTokens.length > 0 && stat && stat.count === selectedTokens.length;
                const isPartialActive = selectedTokens.length > 0 && stat && stat.count > 0 && !isFullActive;

                let itemClass = "";
                if (!this.isEditMode) {
                    if (isFullActive) itemClass = "full-active";
                    else if (isPartialActive) itemClass = "partial-active";
                } else if (this.editSelectedIds.has(node.id)) {
                    itemClass = "edit-selected";
                }

                itemEl.className = `r20-tree-item ${itemClass}`;
                if (this.isEditMode) itemEl.draggable = true;

                itemEl.innerHTML = `
                    <div class="r20-item-left">
                        <span class="r20-item-name">${node.name}</span>
                        <span class="r20-item-rounds">${node.rounds !== null ? node.rounds + '轮' : '永久'}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `
                            <button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>
                            <button class="r20-btn-icon btn-clone-buff" title="复制副本">📋</button>
                            <button class="r20-btn-icon danger btn-node-delete" title="删除">🗑️</button>
                        ` : ""}
                    </div>
                `;

                // 挂载拖拽
                BuffPanelDragDrop.setupItemDrag({
                    el: itemEl,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; },
                    onCrossCopy: async (draggedNode, targetNode, parentList, targetIdx) => {
                        const copyNode = {
                            id: "b_" + Date.now(),
                            type: "buff",
                            name: draggedNode.name,
                            rounds: draggedNode.rounds,
                            extraAttrs: draggedNode.extraAttrs ? JSON.parse(JSON.stringify(draggedNode.extraAttrs)) : null
                        };
                        parentList.splice(targetIdx, 0, copyNode);
                        await this.saveTemplates(true);
                        await this.renderAllPanes();
                        this.showToast(`📋 已复制 [${copyNode.name}]`, "success");
                    },
                    onReorder: async (draggedNode, sourceList, sourceIdx, targetNode, parentList, targetIdx) => {
                        sourceList.splice(sourceIdx, 1);
                        parentList.splice(targetIdx, 0, draggedNode);
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });

                // 点击交互
                itemEl.addEventListener("click", async (e) => {
                    if (e.target.tagName === "BUTTON") return;
                    if (this.isEditMode) {
                        if (this.editSelectedIds.has(node.id)) this.editSelectedIds.delete(node.id);
                        else this.editSelectedIds.add(node.id);
                        this.renderTemplatePane();
                        return;
                    }

                    if (selectedTokens.length > 0) {
                        const shouldApply = !isFullActive && !isPartialActive;
                        await this.toggleBuffAction(node.name, node.rounds, node.extraAttrs, shouldApply);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        this.showBuffEditorDialog(node);
                    }
                });

                if (this.isEditMode) {
                    itemEl.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.showBuffEditorDialog(node);
                    });
                    itemEl.querySelector(".btn-clone-buff")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        await this.cloneBuff(node, nodes, idx);
                    });
                    itemEl.querySelector(".btn-node-delete")?.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (confirm(`确定要删除 Buff [${node.name}] 吗？`)) {
                            nodes.splice(idx, 1);
                            await this.saveTemplates(true);
                            await this.renderTemplatePane();
                        }
                    });
                }

                container.appendChild(itemEl);
            }
        });
    }

    /**
     * 渲染当前单位生效 Buff 栏
     */
    static async renderUnitPane() {
        const treeEl = this.panelEl.querySelector(".r20-unit-tree");
        const summaryEl = this.panelEl.querySelector(".unit-pane-summary");
        if (!treeEl) return;
        treeEl.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();

        if (selectedTokens.length === 0) {
            summaryEl.textContent = "未选择棋子";
            treeEl.innerHTML = `<div class="r20-empty-placeholder">点击画布选中 1 个或多个棋子<br><span style="font-size:10px; color:#546e7a;">此处将实时展示棋子身上生效及未生效的 Buff</span></div>`;
            return;
        }

        summaryEl.textContent = selectedTokens.length === 1 ? `已选: ${selectedTokens[0].name}` : `已选中 ${selectedTokens.length} 个单位`;
        const { allBuffRows } = await this.getBuffStatsForSelected(selectedTokens);

        if (allBuffRows.length === 0) {
            treeEl.innerHTML = `<div class="r20-empty-placeholder">当前选中棋子身上暂无任何 Buff<br><span style="font-size:10px; color:#546e7a;">可点击上方模板库直接点按施加</span></div>`;
            return;
        }

        allBuffRows.forEach(item => {
            const itemEl = document.createElement("div");
            const isFullActive = item.enabledCount === selectedTokens.length;
            const isPartialActive = item.enabledCount > 0 && !isFullActive;
            const isInactive = item.enabledCount === 0;

            let itemClass = "";
            if (!this.isEditMode) {
                if (isFullActive) itemClass = "full-active";
                else if (isPartialActive) itemClass = "partial-active";
            } else if (this.editSelectedIds.has(`unit_${item.name}`)) {
                itemClass = "edit-selected";
            }

            itemEl.className = `r20-tree-item ${itemClass}`;
            if (this.isEditMode) itemEl.draggable = true;

            let statusBadge = "";
            let actionText = "";
            if (isInactive) {
                statusBadge = `<span style="font-size:10px; color:#90a4ae; background:rgba(255,255,255,0.06); padding:1px 4px; border-radius:3px;">○ 未启用</span>`;
                actionText = `<span style="font-size:10px; color:#81c784;">＋ 启用</span>`;
            } else if (isFullActive) {
                statusBadge = `<span class="r20-item-rounds">${item.rounds !== null ? item.rounds + '轮' : '永久'}</span>`;
                actionText = `<span style="font-size:10px; color:#ef5350;">✕ 解除</span>`;
            } else {
                statusBadge = `<span style="font-size:10px; color:#ffd54f;">部分(${item.enabledCount}/${selectedTokens.length})</span>`;
                actionText = `<span style="font-size:10px; color:#ef5350;">✕ 解除</span>`;
            }

            itemEl.innerHTML = `
                <div class="r20-item-left">
                    <span class="r20-item-name">${item.name}</span>
                    ${statusBadge}
                </div>
                ${this.isEditMode ? `<span style="font-size:10px; color:#ba68c8;">可拖至模板库复制</span>` : actionText}
            `;

            if (!this.isEditMode) {
                itemEl.addEventListener("click", async () => {
                    const shouldApply = isInactive;
                    await this.toggleBuffAction(item.name, item.rounds, item.extraAttrs, shouldApply);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                });
            } else {
                itemEl.addEventListener("click", () => {
                    const idKey = `unit_${item.name}`;
                    if (this.editSelectedIds.has(idKey)) this.editSelectedIds.delete(idKey);
                    else this.editSelectedIds.add(idKey);
                    this.renderUnitPane();
                });

                // 编辑模式拖拽
                const nodeData = {
                    id: "unit_" + item.name,
                    name: item.name,
                    rounds: item.rounds,
                    extraAttrs: item.extraAttrs,
                    type: "buff"
                };
                BuffPanelDragDrop.setupItemDrag({
                    el: itemEl,
                    node: nodeData,
                    parentList: allBuffRows,
                    index: 0,
                    sourcePane: "unit",
                    getDraggedContext: () => this._draggedData,
                    setDraggedContext: (ctx) => { this._draggedData = ctx; }
                });
            }

            treeEl.appendChild(itemEl);
        });
    }

    /**
     * 施加或解除指定 Buff
     */
    static async toggleBuffAction(buffName, rounds, extraAttrs, apply) {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) return;

        for (const item of selected) {
            if (apply) {
                if (item.type === "character" && item.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                } else if (item.token) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                }
            } else {
                if (item.type === "character" && item.char) {
                    const allBuffs = await Pf1eBuffManager.getAllBuffs(item.char);
                    const target = allBuffs.find(b => b.name === buffName);
                    if (target && target.rowId) {
                        await Pf1eBuffManager.removeBuff(item.char, target.rowId);
                    }
                } else if (item.token) {
                    TokenBuffManager.removeBuff(item.token, buffName);
                }
            }
        }
    }

    /**
     * 批量删除选中的项目
     */
    static async deleteSelectedBuffs() {
        if (this.editSelectedIds.size === 0) {
            this.showToast("⚠️ 请先在列表中点击要删除的项目（高亮选中）", "warn");
            return;
        }

        if (!confirm(`确定要批量删除选中的 ${this.editSelectedIds.size} 个项目吗？`)) return;

        const removeRecursive = (list) => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (this.editSelectedIds.has(list[i].id)) {
                    list.splice(i, 1);
                } else if (list[i].children) {
                    removeRecursive(list[i].children);
                }
            }
        };

        removeRecursive(this.templates);
        this.editSelectedIds.clear();
        await this.saveTemplates(true);
        await this.renderAllPanes();
        this.showToast("🗑️ 批量删除成功", "success");
    }

    /**
     * 复制一个 Buff 模板
     */
    static async cloneBuff(node, list, index) {
        const clone = {
            id: "b_" + Date.now(),
            type: "buff",
            name: `${node.name} (副本)`,
            rounds: node.rounds,
            extraAttrs: node.extraAttrs ? JSON.parse(JSON.stringify(node.extraAttrs)) : null
        };
        list.splice(index + 1, 0, clone);
        await this.saveTemplates(true);
        await this.renderTemplatePane();
    }

    /**
     * 新建文件夹
     */
    static async showNewFolderDialog() {
        const name = prompt("请输入新文件夹名称:");
        if (!name || !name.trim()) return;

        this.templates.push({
            id: "f_" + Date.now(),
            type: "folder",
            name: name.trim(),
            collapsed: false,
            children: []
        });
        await this.saveTemplates(true);
        await this.renderTemplatePane();
    }

    /**
     * 新建/编辑 Buff 弹窗
     */
    static showBuffEditorDialog(existingNode = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null && existingNode.rounds !== undefined ? existingNode.rounds : "";
        const currentJson = isEditing && existingNode.extraAttrs ? JSON.stringify(existingNode.extraAttrs, null, 2) :
`{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        mask.innerHTML = BuffPanelTemplates.getBuffEditorModalHTML({
            isEditing,
            currentName,
            currentRounds,
            currentJson
        });

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) { alert("请输入 Buff 名称"); return; }

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try { extraAttrs = JSON.parse(jsonText); }
                catch (err) { alert("JSON 细目格式错误:\n" + err.message); return; }
            }

            if (isEditing) {
                existingNode.name = name;
                existingNode.rounds = rounds;
                existingNode.extraAttrs = extraAttrs;
            } else {
                this.templates.push({
                    id: "b_" + Date.now(),
                    type: "buff",
                    name,
                    rounds,
                    extraAttrs
                });
            }

            const saved = await this.saveTemplates(true);
            if (saved) {
                await this.renderTemplatePane();
                mask.remove();
                this.showToast(`✅ 已保存 Buff [${name}] 到战役原生角色卡`, "success");
            }
        });
    }

    /**
     * 从角色卡导入 Buff 弹窗
     */
    static async showImportFromCharacterDialog() {
        const selected = this.getSelectedTokens();
        let character = null;

        if (selected.length > 0) {
            const charItem = selected.find(s => s.type === "character" && s.char);
            if (charItem) character = charItem.char;
        }

        if (!character) {
            if (!window.Campaign || !window.Campaign.characters || window.Campaign.characters.length === 0) {
                this.showToast("⚠️ 战役中暂无可用的角色卡", "warn");
                return;
            }
            character = window.Campaign.characters.at(0);
        }

        await Roll20Bridge.ensureCharacterAttributes(character);
        const cardBuffs = await Pf1eBuffManager.getAllBuffs(character);

        if (cardBuffs.length === 0) {
            this.showToast(`ℹ️ 角色 [${character.get("name")}] 卡上未找到任何 Buff 条目`, "warn");
            return;
        }

        const folders = [{ id: "root", name: "📁 根目录" }];
        const collectFolders = (nodes, depth = 0) => {
            nodes.forEach(n => {
                if (n.type === "folder") {
                    folders.push({ id: n.id, name: `${"　".repeat(depth + 1)}📁 ${n.name}`, ref: n });
                    if (n.children) collectFolders(n.children, depth + 1);
                }
            });
        };
        collectFolders(this.templates);

        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";
        mask.innerHTML = BuffPanelTemplates.getImportModalHTML({
            charName: character.get("name"),
            folders,
            cardBuffs
        });

        document.body.appendChild(mask);
        mask.querySelector(".cb-import-select-all").addEventListener("change", (e) => {
            const checked = e.target.checked;
            mask.querySelectorAll(".cb-import-item").forEach(cb => cb.checked = checked);
        });

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-confirm-import").addEventListener("click", async () => {
            const checkedBoxes = Array.from(mask.querySelectorAll(".cb-import-item:checked"));
            if (checkedBoxes.length === 0) { alert("请先勾选至少一个要导入的 Buff 条目"); return; }

            const targetFolderId = mask.querySelector(".select-target-folder").value;
            let targetList = this.templates;

            if (targetFolderId !== "root") {
                const targetObj = folders.find(f => f.id === targetFolderId);
                if (targetObj && targetObj.ref) {
                    targetObj.ref.children = targetObj.ref.children || [];
                    targetList = targetObj.ref.children;
                }
            }

            checkedBoxes.forEach(cb => {
                const idx = parseInt(cb.dataset.idx, 10);
                const b = cardBuffs[idx];
                targetList.push({
                    id: "b_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
                    type: "buff",
                    name: b.name,
                    rounds: b.rounds,
                    extraAttrs: b.extraAttrs
                });
            });

            await this.saveTemplates(true);
            await this.renderTemplatePane();
            mask.remove();
            this.showToast(`🎉 已成功导入 ${checkedBoxes.length} 项 Buff！`, "success");
        });
    }

    /**
     * 保存模板
     */
    static async saveTemplates(promptIfMissing = false) {
        return await SuiteConfigStore.saveTemplates(this.templates, promptIfMissing);
    }

    /**
     * 辅助工具
     */
    static collectFolderBuffNames(folder) {
        const names = [];
        const walk = (nodes) => {
            nodes.forEach(n => {
                if (n.type === "buff") names.push(n.name);
                else if (n.children) walk(n.children);
            });
        };
        walk(folder.children || []);
        return names;
    }

    static findBuffNodeByName(container, name) {
        let found = null;
        const walk = (nodes) => {
            for (const n of nodes) {
                if (found) return;
                if (n.type === "buff" && n.name === name) { found = n; return; }
                if (n.children) walk(n.children);
            }
        };
        walk(container.children || [container]);
        return found;
    }

    static showToast(msg, type = "info") {
        let toast = document.querySelector("#r20-toast-global");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "r20-toast-global";
            toast.className = "r20-toast";
            document.body.appendChild(toast);
        }
        toast.className = `r20-toast ${type}`;
        toast.textContent = msg;
        toast.style.display = "block";
        toast.style.opacity = "1";

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.style.display = "none", 300);
        }, 2200);
    }
}

    // ==========================================
    // 11. 引擎主入口启动流程
    // ==========================================
    async function main() {
        try {
            console.log("[Roll20Suite] 正在等待 Roll20 Jumpgate 战役环境就绪...");
            const ready = await Roll20Bridge.waitForReady(30000);
            if (!ready) {
                console.error("[Roll20Suite] Roll20 Jumpgate 环境未就绪，停止初始化");
                return;
            }

            console.log("[Roll20Suite] Roll20 Jumpgate 环境就绪，开始挂载子系统...");

            // 1. 初始化并挂载先攻追踪器
            try {
                const observer = new TurnOrderObserver();
                observer.on("turnEnded", async ({ endedTokenId, startedTokenId }) => {
                    try {
                        const tokenGraphic = Roll20Bridge.getTokenGraphic(endedTokenId);
                        if (tokenGraphic) {
                            const character = Roll20Bridge.getCharacterByToken(tokenGraphic);
                            if (character) {
                                await Pf1eBuffManager.decrementBuffs(character);
                            } else {
                                TokenBuffManager.decrementBuffs(tokenGraphic);
                            }
                        }
                    } catch (err) {
                        console.error("[Roll20Suite] 先攻回合结束扣减异常:", err);
                    }
                    setTimeout(async () => {
                        await Pf1eBuffUI.refreshAllBadges();
                    }, 60);
                });

                observer.on("orderChanged", async () => {
                    await Pf1eBuffUI.refreshAllBadges();
                });

                observer.start();
                console.log("[Roll20Suite] TurnOrderObserver 先攻监听器挂载成功");
            } catch (obsErr) {
                console.error("[Roll20Suite] 先攻追踪器初始化失败:", obsErr);
            }

            // 2. 初始化三态悬浮工作台
            try {
                await BuffFloatingPanel.init();
                console.log("[Roll20Suite] BuffFloatingPanel 状态工作台挂载成功");
            } catch (panelErr) {
                console.error("[Roll20Suite] 悬浮工作台初始化失败:", panelErr);
            }

            // 3. 首次全量刷新先攻条徽章
            setTimeout(async () => {
                try {
                    await Pf1eBuffUI.refreshAllBadges();
                } catch (uiErr) {
                    console.error("[Roll20Suite] 先攻条徽章初次刷新失败:", uiErr);
                }
            }, 800);

            console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.7.1 全部就绪！");
        } catch (fatalErr) {
            console.error("[Roll20Suite] 引擎主入口遭遇致命异常:", fatalErr);
        }
    }

    main().catch(e => console.error("[Roll20Suite] main 未捕获 Promise 异常:", e));
})();
