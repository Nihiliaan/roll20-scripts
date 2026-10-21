// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.9.3
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成极简标题栏基准展开定位、Jumpgate原生选区联动、Vue响应式先攻徽章防护与原生角色卡完全同步
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.9.3...");

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
                const c = window.Campaign;
                if (
                    typeof c !== "undefined" &&
                    c.characters &&
                    c.pages &&
                    (c.gameFullyLoaded || c.bootstrapped || c.characters.length > 0 || Date.now() - start > 4000)
                ) {
                    resolve(true);
                } else if (Date.now() - start > timeoutMs) {
                    console.warn("[Roll20Bridge] 等待 Roll20 就绪超时，尝试降级启动");
                    resolve(typeof window.Campaign !== "undefined");
                } else {
                    setTimeout(check, 300);
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
    /**
     * 调起 Roll20 宿主原生的角色卡弹窗
     * @param {string} characterId
     */
    static openCharacterSheet(characterId) {
        if (!characterId) return false;
        const el = document.querySelector('.journalitem[data-itemid="' + characterId + '"] .namecontainer');
        if (el) {
            el.click();
            return true;
        }
        return false;
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

            // 提取该原生 Buff 条目下所有存储的扩展加值与修饰细目字典 (extraAttrs)
            const extraAttrs = {};
            const prefixWithUnderscore = `${prefix}_`;
            for (const attr of character.attribs.models) {
                const attrName = attr.get("name") || "";
                if (attrName.startsWith(prefixWithUnderscore)) {
                    const subKey = attrName.substring(prefixWithUnderscore.length);
                    if (
                        subKey !== "name" &&
                        subKey !== "enable_toggle" &&
                        subKey !== "rounds" &&
                        subKey !== "tabcat" &&
                        subKey !== "tabcat2" &&
                        subKey !== "row_id"
                    ) {
                        const raw = attr.get("current");
                        if (raw !== "" && raw !== null && raw !== undefined) {
                            extraAttrs[subKey] = (!isNaN(Number(raw)) && typeof raw !== "boolean" && String(raw).trim() !== "") ? Number(raw) : raw;
                        }
                    }
                }
            }

            buffs.push({
                rowId,
                prefix,
                name,
                enabled,
                rounds: (rounds !== null && !isNaN(rounds)) ? rounds : null,
                buffType,
                extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null,
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
     * 物理删除角色卡上的原生 repeating_buff2 一整行属性（彻底销毁，杜绝死灰复燃）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     */
    static async deleteBuffRowPermanently(character, rowId) {
        if (!character || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const prefixWithUnderscore = `${prefix}_`;
        const toDestroy = character.attribs.models.filter(a => {
            const n = a.get("name") || "";
            return n === prefix || n.startsWith(prefixWithUnderscore);
        });

        if (toDestroy.length === 0) return false;

        // 彻底物理销毁所有匹配的 Attribute 模型
        toDestroy.forEach(attr => attr.destroy());
        console.log(`[Pf1eBuffManager] 已物理彻底销毁 ${character.get("name")} 的 Buff [${rowId}] 共 ${toDestroy.length} 项原生属性`);
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
 * 配备持久化 MutationObserver 防御 Vue 响应式 DOM 重绘
 */
class Pf1eBuffUI {
    static isStylesInjected = false;
    static isObserverStarted = false;
    static _observer = null;
    static _debounceTimer = null;

    static injectStyles() {
        if (this.isStylesInjected) return;
        const style = document.createElement("style");
        style.id = "pf1e-buff-tracker-styles";
        style.textContent = `
            .r20-buff-container {
                display: inline-flex;
                flex-wrap: wrap;
                max-height: 28px;
                max-width: 160px;
                overflow: hidden;
                gap: 2px 4px;
                margin-left: 6px;
                vertical-align: middle;
                line-height: 1;
            }
            .r20-buff-pill-compact {
                display: inline-flex;
                align-items: center;
                background: #1e3a8a;
                color: #f1f5f9;
                font-size: 10px;
                font-weight: 600;
                padding: 1px 5px;
                border-radius: 3px;
                cursor: pointer;
                user-select: none;
                border: 1px solid rgba(255, 255, 255, 0.2);
                white-space: nowrap;
                transition: background 0.15s, border-color 0.15s;
            }
            .r20-buff-pill-compact:hover {
                background: #2563eb;
                border-color: #93c5fd;
                color: #ffffff;
            }
            .r20-buff-pill-compact.expiring {
                background: #7f1d1d;
                border-color: #f87171;
                color: #fecaca;
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
     * 启动持久 DOM 监听器（抵御 Vue.js 列表重新渲染擦除徽章）
     */
    static startObserver() {
        if (this.isObserverStarted) return;
        this.injectStyles();

        // 1. 监听主窗口变动（包含 Vue 动态渲染的 #vm-turn-order 和 .turn-tracker）
        if (this._observer) this._observer.disconnect();

        this._observer = new MutationObserver((mutations) => {
            let shouldRefresh = false;
            for (const m of mutations) {
                if (m.type === "childList") {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.matches?.("li.token") || node.querySelector?.("li.token") ||
                                node.matches?.(".turn-tracker") || node.querySelector?.(".turn-tracker") ||
                                node.id === "vm-turn-order") {
                                shouldRefresh = true;
                                break;
                            }
                        }
                    }
                }
                if (shouldRefresh) break;
            }

            if (shouldRefresh) {
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this.refreshAllBadges();
                }, 80);
            }
        });

        // 优先监听 vm-turn-order 或 body
        const targetContainer = document.getElementById("vm-turn-order") || document.body;
        this._observer.observe(targetContainer, { childList: true, subtree: true });

        // 2. 联动 Roll20 先攻数据变动事件
        if (window.Campaign && typeof window.Campaign.on === "function") {
            window.Campaign.on("change:turnorder change:initiativepage", () => {
                setTimeout(() => this.refreshAllBadges(), 100);
            });
        }

        this.isObserverStarted = true;
        // 立即尝试一次初次刷新
        this.refreshAllBadges();
    }

    /**
     * 刷新整个先攻条上的徽章
     */
    static async refreshAllBadges() {
        this.injectStyles();
        // 现代 Jumpgate 优先匹配 #vm-turn-order 与 .turn-tracker，兼顾旧版 #initiativewindow
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        if (!rows || rows.length === 0) return;

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
            activeBuffs = await Pf1eBuffManager.getActiveBuffs(character);
        } else if (token) {
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
     * 单个 Buff 点击快捷编辑/关停弹窗
     */
    static showBuffEditModal(character, token, buff, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentRoundsStr = buff.rounds !== null ? String(buff.rounds) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header">状态管理: ${buff.name}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">剩余持续轮数 (留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="${currentRoundsStr}" placeholder="轮数" />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon danger btn-delete" style="padding:6px 12px; margin-right:auto;">✕ 关停解除</button>
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        // 解除
        mask.querySelector(".btn-delete").addEventListener("click", async () => {
            if (character && buff.rowId) {
                await Pf1eBuffManager.toggleBuff(character, buff.rowId, false);
            } else if (token) {
                TokenBuffManager.removeBuff(token, buff.name);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });

        // 保存轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const val = mask.querySelector(".input-rounds").value.trim();
            const rounds = val === "" ? null : parseInt(val, 10);

            if (character && buff.rowId) {
                await Pf1eBuffManager.setBuffRounds(character, buff.rowId, rounds);
            } else if (token) {
                TokenBuffManager.applyOrRefreshBuff(token, buff.name, rounds);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
    }

    /**
     * 单行点击快捷添加 Buff 弹窗
     */
    static showSingleAddModal(character, token, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 340px;">
                <div class="r20-dialog-header">添加状态 Buff</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-name" placeholder="例如: 加速术、祝福术..." />

                    <label style="font-size:11px; color:#b0bec5;">持续轮数 (留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="10" placeholder="轮数" />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-confirm" style="padding:6px 14px;">添加并生效</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        mask.querySelector(".btn-confirm").addEventListener("click", async () => {
            const name = mask.querySelector(".input-name").value.trim();
            if (!name) { alert("请输入 Buff 名称"); return; }

            const val = mask.querySelector(".input-rounds").value.trim();
            const rounds = val === "" ? null : parseInt(val, 10);

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
 * 状态Buff工作台样式定义：极简基准定位模型 + 上下垂直排版 + 原生 details/summary 折叠
 */
class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static getCss() {
        return `
            /* 主悬浮窗容器（以标题栏为主体定位） */
            #r20-buff-panel {
                position: fixed;
                width: 320px;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #eceff1;
                user-select: none;
                box-sizing: border-box;
            }

            /* 标题栏（拖拽句柄） */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 10px;
                background: #232b34;
                border: 1px solid #323d47;
                cursor: grab;
                box-sizing: border-box;
                border-radius: 7px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            }

            /* 向下展开时：标题栏底角方正以贴合内容栏 */
            #r20-buff-panel.direction-down:not(.is-collapsed) .r20-panel-header {
                border-radius: 7px 7px 0 0;
                border-bottom: none;
            }

            /* 向上展开时：标题栏顶角方正以贴合上方内容栏 */
            #r20-buff-panel.direction-up:not(.is-collapsed) .r20-panel-header {
                border-radius: 0 0 7px 7px;
                border-top: none;
            }

            .r20-panel-title {
                font-size: 12px;
                font-weight: 600;
                color: #64b5f6;
                display: flex;
                align-items: center;
                gap: 6px;
                pointer-events: none;
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
                background: #1565c0 !important;
                color: #ffffff !important;
            }
            .r20-btn-icon.pinned {
                color: #ffd54f !important;
                background: rgba(255, 213, 79, 0.15);
            }
            .r20-btn-icon.danger { color: #ef5350; }
            .r20-btn-icon.danger:hover { background: #c62828; color: #ffffff; }

            /* 内容区容器 */
            .r20-panel-body {
                background: #1a1e24;
                border: 1px solid #323d47;
                box-sizing: border-box;
                display: flex;
                max-height: 75vh;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            }

            /* 折叠时直接隐藏内容栏 */
            #r20-buff-panel.is-collapsed .r20-panel-body {
                display: none !important;
            }

            /* 向下展开：内容紧贴标题栏底部并向下生长 */
            #r20-buff-panel.direction-down .r20-panel-body {
                position: relative;
                border-top: 1px solid #323d47;
                border-radius: 0 0 7px 7px;
            }

            /* 向上展开：内容绝对脱标定位于标题栏顶部，并向负 Y 方向生长 */
            #r20-buff-panel.direction-up .r20-panel-body {
                position: absolute;
                bottom: 100%;
                left: 0;
                width: 100%;
                border-bottom: 1px solid #323d47;
                border-radius: 7px 7px 0 0;
            }

            .r20-panel-content {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }

            /* 工具栏（默认隐藏，点击编辑后展开） */
            .r20-panel-toolbar {
                display: none;
                align-items: center;
                gap: 5px;
                padding: 6px 10px;
                background: #161a1f;
                border-bottom: 1px solid #2d3748;
                font-size: 11px;
                flex-wrap: wrap;
            }
            #r20-buff-panel.is-editing .r20-panel-toolbar {
                display: flex;
            }

            /* 双栏垂直上下排版布局 */
            .r20-panel-panes {
                display: flex;
                flex-direction: column;
                flex: 1;
                overflow: hidden;
                max-height: 70vh;
            }

            .r20-pane {
                display: flex;
                flex-direction: column;
                border-bottom: 1px solid #2d3748;
                overflow: hidden;
                min-height: 60px;
                max-height: 35vh;
            }
            .r20-pane:last-child {
                border-bottom: none;
            }

            .r20-pane-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #1f252e;
                border-bottom: 1px solid #2d3748;
                font-size: 11px;
                font-weight: 600;
                color: #b0bec5;
            }

            .r20-tree-container {
                flex: 1;
                overflow-y: auto;
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            /* 原生 details/summary 具名字典组容器 */
            details.r20-group {
                margin-bottom: 2px;
            }
            details.r20-group > summary {
                list-style: none;
                cursor: pointer;
                padding: 4px 6px;
                background: #242c37;
                border: 1px solid #323d47;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                color: #90caf9;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            details.r20-group > summary::-webkit-details-marker {
                display: none;
            }
            details.r20-group > summary::before {
                content: "▶";
                font-size: 8px;
                margin-right: 6px;
                transition: transform 0.15s ease;
                display: inline-block;
                color: #78909c;
            }
            details.r20-group[open] > summary::before {
                transform: rotate(90deg);
            }
            details.r20-group > .r20-group-content {
                margin-left: 10px;
                padding-left: 6px;
                border-left: 1px dashed #37474f;
                margin-top: 3px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            /* 树形子项 */
            .r20-tree-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: #20262f;
                border-radius: 3px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: background 0.15s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2a3340;
                border-color: #42a5f5;
                color: #ffffff;
            }
            .r20-tree-item.full-active {
                background: #1e3d59 !important;
                border-color: #42a5f5 !important;
                color: #ffffff !important;
            }
            .r20-tree-item.partial-active {
                background: #2e2a1b !important;
                border-color: #ffd54f !important;
                color: #fff8e1 !important;
            }

            .r20-item-label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            /* 复选框仅在编辑模式下展现 */
            .r20-cb-select {
                cursor: pointer;
                margin: 0;
                display: none !important;
            }
            #r20-buff-panel.is-editing .r20-cb-select {
                display: inline-block !important;
            }

            .r20-item-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
                white-space: nowrap;
            }

            /* 悬浮 Toast */
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
            .r20-empty-placeholder {
                padding: 14px;
                text-align: center;
                color: #78909c;
                font-size: 11px;
            }
        `;
    }

    static inject() {
        const existing = document.querySelector(`#${this.STYLESHEET_ID}`);
        if (existing) existing.remove();
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
 * 状态Buff工作台结构模板辅助类（现已全面由具名字典与原生 DOM 替代）
 */
class BuffPanelTemplates {}

    // ==========================================
    // 9. BuffPanelDragDrop (面板拖拽手势交互)
    // ==========================================
/**
 * BuffPanelDragDrop.js
 * 状态Buff工作台拖拽手势与交互处理器（宿主 jQuery UI 窗口拖拽、栏内排序、跨栏复制）
 */
class BuffPanelDragDrop {
    /**
     * 初始化窗口标题栏拖拽移动（调用宿主 jQuery UI，零手写监听）
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
        if (window.$ && typeof window.$.fn.draggable === "function") {
            window.$(panelEl).draggable({
                handle: ".r20-panel-header",
                containment: "window",
                drag: (event, ui) => {
                    if (onDragging) onDragging(ui.position.left, ui.position.top);
                },
                stop: (event, ui) => {
                    panelEl.style.bottom = "auto";
                    panelEl.style.right = "auto";
                    if (onDragEnd) onDragEnd(ui.position.left, ui.position.top);
                }
            });
            return;
        }

        // 降级兜底方案
        const header = panelEl.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            e.stopPropagation();
            e.preventDefault();

            isDragging = true;
            header.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = panelEl.offsetLeft;
            initialTop = panelEl.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const newLeft = Math.max(10, Math.min(window.innerWidth - 330, initialLeft + dx));
                const newTop = Math.max(10, Math.min(window.innerHeight - 40, initialTop + dy));

                panelEl.style.left = `${newLeft}px`;
                panelEl.style.top = `${newTop}px`;
                panelEl.style.bottom = "auto";
                panelEl.style.right = "auto";

                if (onDragging) onDragging(newLeft, newTop);
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    if (onDragEnd) onDragEnd(panelEl.offsetLeft, panelEl.offsetTop);
                }
                document.removeEventListener("mousemove", onMouseMove, true);
                document.removeEventListener("mouseup", onMouseUp, true);
            };

            document.addEventListener("mousemove", onMouseMove, true);
            document.addEventListener("mouseup", onMouseUp, true);
        });
    }

    /**
     * 为树节点挂载拖拽手势
     */
    static setupItemDrag({ el, node, parentList, index, sourcePane, getDraggedContext, setDraggedContext, onCrossCopy, onReorder }) {
        el.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            setDraggedContext({ node, parentList, index, sourcePane });
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
                const rect = el.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                if (offsetX < 36) {
                    el.classList.remove("r20-drag-into");
                    el.classList.add("r20-drag-over");
                } else {
                    el.classList.remove("r20-drag-over");
                    el.classList.add("r20-drag-into");
                }
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

            const rect = el.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const isPeerDrop = node.type === "folder" ? (offsetX < 36) : true;

            el.classList.remove("r20-drag-over", "r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            if (fromPane === "unit" && sourcePane === "template") {
                if (onCrossCopy) await onCrossCopy(draggedNode, node, parentList, index, isPeerDrop);
                setDraggedContext(null);
                return;
            }

            if (fromPane === "template" && sourcePane === "template" && sourceList) {
                if (draggedNode.id === node.id) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index, isPeerDrop);
                setDraggedContext(null);
            }
        });
    }

    /**
     * 为模板树容器挂载兜底空白区放置监听
     */
    static setupTreeContainerDrop({ el, getDraggedContext, setDraggedContext, onCrossCopyRoot, onReorderRoot }) {
        el.addEventListener("dragover", (e) => {
            if (e.target === el || e.target.classList.contains("r20-template-tree")) {
                e.preventDefault();
                el.classList.add("r20-drag-container-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            if (e.target === el) {
                el.classList.remove("r20-drag-container-over");
            }
        });

        el.addEventListener("drop", async (e) => {
            if (e.target === el || e.target.classList.contains("r20-template-tree")) {
                e.preventDefault();
                el.classList.remove("r20-drag-container-over");
                const dragged = getDraggedContext();
                if (!dragged) return;
                const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

                if (fromPane === "unit") {
                    if (onCrossCopyRoot) await onCrossCopyRoot(draggedNode);
                } else if (fromPane === "template" && sourceList) {
                    if (onReorderRoot) await onReorderRoot(draggedNode, sourceList, sourceIdx);
                }
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
 * 状态Buff工作台主控制器（极简具名字典模型 + 宿主原生能力驱动）
 * 1. 窗口拖拽直接调用宿主 jQuery UI window.$(el).draggable()；
 * 2. 树形折叠直接采用 HTML5 原生 <details><summary>，0 行手写监听；
 * 3. 严格遵循垂直上下排版（上栏模板库，下栏当前单位）；
 * 4. 标题栏常驻「✏️ 编辑」模式切换，进入后才展示工具栏与复选框；
 * 5. 完善 Firebase 异步注水自愈机制，初次加载自动秒刷。
 */








class BuffFloatingPanel {
    static POS_KEY = "r20_suite_buff_panel_pos";
    static PIN_KEY = "r20_suite_buff_panel_pinned";

    static panelEl = null;
    static isPinned = false;
    static isCollapsed = false;
    static isEditMode = false;
    static templates = [];
    static isInternalSaving = false;
    static _dbWatcherBound = false;
    static _dbSyncTimer = null;
    static _draggedContext = null;
    static _lastSelectedIdsStr = "";

    /**
     * 初始化悬浮面板
     */
    static async init() {
        BuffPanelStyles.inject();
        this.createPanelDOM();

        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.updatePinState();

        this.restorePanelPosition();

        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            () => this.savePosition(),
            () => this.updateLayoutDirection()
        );

        this.initHoverCollapse();
        this.initSelectionListeners();
        this.initDatabaseCharacterWatcher();

        // 初始加载模板数据并自愈补刷（应对 Firebase 异步注水延迟）
        await this.refreshTemplates(false);
        if (this.templates.length === 0) {
            setTimeout(async () => {
                const dbChar = SuiteConfigStore.findDatabaseCharacter();
                if (dbChar) await Roll20Bridge.ensureCharacterAttributes(dbChar);
                await this.refreshTemplates(false);
            }, 600);
            setTimeout(async () => {
                await this.refreshTemplates(false);
            }, 1800);
        }

        // 绑定底部放置兜底
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        BuffPanelDragDrop.setupTreeContainerDrop({
            el: templateTree,
            getDraggedContext: () => this._draggedContext,
            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
            onCrossCopyRoot: async (draggedNode) => {
                this.templates.push({
                    id: "tpl_" + Math.random().toString(36).substr(2, 9),
                    type: "buff",
                    name: draggedNode.name,
                    rounds: draggedNode.rounds,
                    extraAttrs: draggedNode.extraAttrs || null
                });
                await this.saveTemplates(true);
                await this.renderTemplatePane();
            },
            onReorderRoot: async (draggedNode, sourceList, sourceIdx) => {
                sourceList.splice(sourceIdx, 1);
                this.templates.push(draggedNode);
                await this.saveTemplates(true);
                await this.renderTemplatePane();
            }
        });

        console.log("[BuffFloatingPanel] 极简工作台初始化就绪 (上下排版 + 编辑模式)");
    }

    /**
     * 构建极简面板主 DOM (垂直上下双栏排版)
     */
    static createPanelDOM() {
        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";
        panel.className = "direction-down";

        panel.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff工作台</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-pin" title="固定面板">📌</button>
                    <button class="r20-btn-icon btn-toggle-edit" title="进入编辑模式">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="折叠/展开">-</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <div class="r20-panel-content">
                    <div class="r20-panel-toolbar">
                        <button class="r20-btn-icon btn-refresh-templates" title="刷新模板">🔄 刷新</button>
                        <button class="r20-btn-icon btn-new-buff" title="新建Buff">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建目录">+ 目录</button>
                        <button class="r20-btn-icon btn-open-sheet" title="在官方角色卡中配置加值">📋 角色卡</button>
                        <button class="r20-btn-icon danger btn-delete-selected" title="删除勾选的Buff">🗑️ 删除选中</button>
                    </div>
                    <div class="r20-panel-panes">
                        <div class="r20-pane r20-template-pane">
                            <div class="r20-pane-header">
                                <span>📚 Buff 模板库</span>
                            </div>
                            <div class="r20-tree-container r20-template-tree"></div>
                        </div>
                        <div class="r20-pane r20-unit-pane">
                            <div class="r20-pane-header">
                                <span>🎯 选中单位 Buff</span>
                            </div>
                            <div class="r20-tree-container r20-unit-tree"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="r20-toast" id="r20-buff-toast"></div>
        `;

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 绑定顶部控制
        panel.querySelector(".btn-toggle-pin").addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());

        // 绑定工具栏
        panel.querySelector(".btn-refresh-templates").addEventListener("click", () => this.refreshTemplates(true));
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.createBuffPrompt());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.createFolderPrompt());
        panel.querySelector(".btn-open-sheet").addEventListener("click", () => this.openDatabaseSheet());
        panel.querySelector(".btn-delete-selected").addEventListener("click", () => this.deleteSelectedTemplates());

        // 双栏事件委托监听
        this.initPaneEvents();
        this.updateLayoutDirection();
    }

    /**
     * 切换编辑模式
     */
    static toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.panelEl.classList.toggle("is-editing", this.isEditMode);
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        if (editBtn) {
            editBtn.classList.toggle("active", this.isEditMode);
            editBtn.textContent = this.isEditMode ? "🔒 完成" : "✏️ 编辑";
        }
        this.showToast(this.isEditMode ? "✏️ 已进入编辑模式（可勾选删除/新增）" : "🔒 已退出编辑模式", "info");
    }

    /**
     * 极简事件委托：非编辑状态点击直接切换施加；编辑状态支持勾选
     */
    static initPaneEvents() {
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        const unitTree = this.panelEl.querySelector(".r20-unit-tree");

        // 模板栏点击
        templateTree.addEventListener("click", async (e) => {
            // 点击复选框或折叠标题直接放行
            if (e.target.classList.contains("r20-cb-select") || e.target.closest("summary")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            // 编辑模式下点击整行切换勾选
            if (this.isEditMode) {
                const cb = item.querySelector(".r20-cb-select");
                if (cb && e.target !== cb) {
                    cb.checked = !cb.checked;
                }
                return;
            }

            // 非编辑模式下点击直接施加/移除
            const name = item.dataset.name;
            const rounds = item.dataset.rounds ? parseInt(item.dataset.rounds) : null;
            const extraAttrs = item._extraAttrs || null;

            await this.toggleBuffOnSelected(name, rounds, extraAttrs);
        });

        // 单位栏点击（点击快速扣减或移除）
        unitTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const charId = item.dataset.charId;
            const buffName = item.dataset.name;

            if (charId && buffName) {
                const char = window.Campaign?.characters?.get(charId);
                if (char) {
                    await TokenBuffManager.removeBuff(char, buffName);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast(`已从 ${char.get("name")} 移除 ${buffName}`, "info");
                }
            }
        });
    }

    /**
     * 调起官方角色卡窗口进行原汁原味的加值配置
     */
    static openDatabaseSheet() {
        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) {
            const ok = Roll20Bridge.openCharacterSheet(dbChar.id);
            if (ok) {
                this.showToast("📋 已调起 === R20_SUITE_DATABASE === 角色卡", "success");
            } else {
                this.showToast("⚠️ 无法在 Journal 中定位到数据库卡", "warn");
            }
        } else {
            this.showToast("⚠️ 未找到战役数据库角色卡", "warn");
        }
    }

    /**
     * 极简新建 Buff
     */
    static async createBuffPrompt() {
        const name = prompt("请输入 Buff 名称:");
        if (!name || !name.trim()) return;

        const roundsInput = prompt("请输入持续轮数 (留空为永久):", "");
        let rounds = null;
        if (roundsInput && !isNaN(parseInt(roundsInput))) {
            rounds = parseInt(roundsInput);
        }

        const newBuff = {
            id: "tpl_" + Math.random().toString(36).substr(2, 9),
            type: "buff",
            name: name.trim(),
            rounds: rounds,
            extraAttrs: {
                bufftype: "spell",
                "b1-show": 1,
                b1_bonus: "attack",
                b1_bonustype: "luck",
                b1_val: 1
            }
        };

        this.templates.push(newBuff);
        await this.saveTemplates(true);
        await this.renderTemplatePane();
        this.showToast(`✨ Buff [${name.trim()}] 创建成功`, "success");
    }

    /**
     * 极简新建目录
     */
    static async createFolderPrompt() {
        const folderName = prompt("请输入新目录名称:");
        if (!folderName || !folderName.trim()) return;

        this.templates.push({
            id: "f_" + Math.random().toString(36).substr(2, 6),
            type: "folder",
            name: folderName.trim(),
            children: []
        });

        await this.saveTemplates(true);
        await this.renderTemplatePane();
        this.showToast(`📁 目录 [${folderName.trim()}] 创建成功`, "success");
    }

    /**
     * 批量删除选中的模板项（物理销毁属性并同步）
     */
    static async deleteSelectedTemplates() {
        const checkboxes = Array.from(this.panelEl.querySelectorAll(".r20-template-tree .r20-cb-select:checked"));
        if (checkboxes.length === 0) {
            this.showToast("⚠️ 请先勾选要删除的 Buff 条目", "warn");
            return;
        }

        if (!confirm(`确定要彻底删除选中的 ${checkboxes.length} 个 Buff 项吗？`)) return;

        this.isInternalSaving = true;
        const dbChar = SuiteConfigStore.findDatabaseCharacter();

        for (const cb of checkboxes) {
            const id = cb.value;
            this.deleteNodeById(this.templates, id);
            if (dbChar) {
                await Pf1eBuffManager.destroyBuff(dbChar, id);
            }
        }

        await this.saveTemplates(true);
        this.isInternalSaving = false;
        await this.renderTemplatePane();
        this.showToast(`🗑️ 已彻底删除 ${checkboxes.length} 项`, "success");
    }

    /**
     * 从具名字典树中递归删除指定 ID 的节点
     */
    static deleteNodeById(list, id) {
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].id === id || list[i].rowId === id) {
                list.splice(i, 1);
                return true;
            }
            if (list[i].children && this.deleteNodeById(list[i].children, id)) return true;
        }
        return false;
    }

    /**
     * 渲染全部窗格
     */
    static async renderAllPanes() {
        await this.renderTemplatePane();
        await this.renderUnitPane();
    }

    /**
     * 渲染模板库（基于具名字典与原生 <details><summary>）
     */
    static async renderTemplatePane() {
        const container = this.panelEl.querySelector(".r20-template-tree");
        if (!container) return;

        if (this.templates.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder">暂无模板数据<br>点击上方「✏️ 编辑」再点「+ Buff」新建</div>';
            return;
        }

        const selectedTokens = this.getSelectedTokens();
        const { activeStats } = await this.getBuffStatsForSelected(selectedTokens);

        container.innerHTML = "";
        this.renderTemplateNodes(this.templates, container, activeStats, selectedTokens);
    }

    /**
     * 递归将具名字典树渲染为原生 details/summary DOM
     */
    static renderTemplateNodes(nodes, container, activeStats, selectedTokens) {
        nodes.forEach((node, idx) => {
            if (node.type === "folder") {
                const details = document.createElement("details");
                details.className = "r20-group";
                details.open = true;

                const summary = document.createElement("summary");
                summary.innerHTML = `<span>📁 ${node.name}</span>`;
                details.appendChild(summary);

                const groupContent = document.createElement("div");
                groupContent.className = "r20-group-content";

                if (node.children && node.children.length > 0) {
                    this.renderTemplateNodes(node.children, groupContent, activeStats, selectedTokens);
                }
                details.appendChild(groupContent);
                container.appendChild(details);

                // 挂载文件夹拖拽支持
                BuffPanelDragDrop.setupItemDrag({
                    el: details,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedContext,
                    setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                    onReorder: async (draggedNode, srcList, srcIdx, targetNode, tgtList, tgtIdx, isPeer) => {
                        srcList.splice(srcIdx, 1);
                        if (isPeer) {
                            tgtList.splice(tgtIdx, 0, draggedNode);
                        } else {
                            if (!targetNode.children) targetNode.children = [];
                            targetNode.children.push(draggedNode);
                        }
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });
            } else {
                const stat = activeStats.get(node.name);
                const isFull = selectedTokens.length > 0 && stat && stat.count === stat.total;
                const isPartial = selectedTokens.length > 0 && stat && stat.count > 0 && !isFull;

                const item = document.createElement("div");
                item.className = "r20-tree-item" + (isFull ? " full-active" : isPartial ? " partial-active" : "");
                item.dataset.name = node.name;
                item.dataset.id = node.id || node.rowId;
                if (node.rounds) item.dataset.rounds = node.rounds;
                item._extraAttrs = node.extraAttrs || null;
                item.draggable = true;

                item.innerHTML = `
                    <label class="r20-item-label" title="${node.name}">
                        <input type="checkbox" class="r20-cb-select" value="${node.id || node.rowId}">
                        <span class="r20-item-name">${node.name}</span>
                    </label>
                    <span class="r20-item-rounds">${node.rounds ? node.rounds + '轮' : '永久'}</span>
                `;

                container.appendChild(item);

                // 挂载条目拖拽支持
                BuffPanelDragDrop.setupItemDrag({
                    el: item,
                    node,
                    parentList: nodes,
                    index: idx,
                    sourcePane: "template",
                    getDraggedContext: () => this._draggedContext,
                    setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                    onReorder: async (draggedNode, srcList, srcIdx, targetNode, tgtList, tgtIdx) => {
                        srcList.splice(srcIdx, 1);
                        tgtList.splice(tgtIdx, 0, draggedNode);
                        await this.saveTemplates(true);
                        await this.renderTemplatePane();
                    }
                });
            }
        });
    }

    /**
     * 渲染右侧单位栏（按 Token 原生 details 分组，直观对称）
     */
    static async renderUnitPane() {
        const container = this.panelEl.querySelector(".r20-unit-tree");
        if (!container) return;

        const selectedTokens = this.getSelectedTokens();
        if (selectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder">未选中任何地图单位<br>在画布上点击或多选 Token</div>';
            return;
        }

        container.innerHTML = "";

        for (const tokenItem of selectedTokens) {
            const char = tokenItem.char;
            const tokenName = tokenItem.token?.get("name") || char?.get("name") || "未命名单位";

            const details = document.createElement("details");
            details.className = "r20-group";
            details.open = true;

            const summary = document.createElement("summary");
            summary.innerHTML = `<span>🛡️ ${tokenName}</span>`;
            details.appendChild(summary);

            const content = document.createElement("div");
            content.className = "r20-group-content";

            if (char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(char);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(暂无Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        item.className = "r20-tree-item";
                        item.dataset.charId = char.id;
                        item.dataset.buffId = b.id;
                        item.dataset.name = b.name;
                        item.title = "点击从单位身上移除";
                        item.draggable = true;

                        item.innerHTML = `
                            <span class="r20-item-name">${b.name}</span>
                            <span class="r20-item-rounds" style="color:#ef5350;">${b.rounds ? b.rounds + '轮' : '永久'} ×</span>
                        `;

                        content.appendChild(item);

                        // 支持从单位栏反向拖拽至模板库另存为模板
                        BuffPanelDragDrop.setupItemDrag({
                            el: item,
                            node: b,
                            parentList: null,
                            index: 0,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onCrossCopy: async (draggedNode, targetNode, parentList, idx) => {
                                const newTpl = {
                                    id: "tpl_" + Math.random().toString(36).substr(2, 9),
                                    type: "buff",
                                    name: draggedNode.name,
                                    rounds: draggedNode.rounds,
                                    extraAttrs: draggedNode.extraAttrs || null
                                };
                                if (targetNode.type === "folder") {
                                    if (!targetNode.children) targetNode.children = [];
                                    targetNode.children.push(newTpl);
                                } else {
                                    parentList.splice(idx, 0, newTpl);
                                }
                                await this.saveTemplates(true);
                                await this.renderTemplatePane();
                            }
                        });
                    });
                }
            } else {
                content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(无关联人物卡)</div>';
            }

            details.appendChild(content);
            container.appendChild(details);
        }
    }

    /**
     * 为选中的单位批量施加或移除 Buff
     */
    static async toggleBuffOnSelected(buffName, rounds, extraAttrs) {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) {
            this.showToast("⚠️ 请先在画布上选择目标 Token", "warn");
            return;
        }

        const { activeStats } = await this.getBuffStatsForSelected(selected);
        const stat = activeStats.get(buffName);
        const isFull = stat && stat.count === stat.total;
        const shouldApply = !isFull;

        for (const item of selected) {
            if (item.char) {
                if (shouldApply) {
                    await TokenBuffManager.applyBuff(item.char, buffName, rounds, extraAttrs);
                } else {
                    await TokenBuffManager.removeBuff(item.char, buffName);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        await this.renderAllPanes();
        this.showToast(`${shouldApply ? "✨ 施加" : "❌ 移除"} Buff [${buffName}]`, "success");
    }

    /**
     * 统计当前选中 Token 对特定 Buff 的激活覆盖率
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        if (selectedTokens.length === 0) return { activeStats };

        for (const item of selectedTokens) {
            if (item.char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(item.char);
                buffs.forEach(b => {
                    const cur = activeStats.get(b.name) || { count: 0, total: selectedTokens.length };
                    cur.count++;
                    activeStats.set(b.name, cur);
                });
            }
        }
        return { activeStats };
    }

    /**
     * 刷新并加载模板库
     */
    static async refreshTemplates(showNotice = false) {
        try {
            this.templates = await SuiteConfigStore.loadTemplates();
            await this.renderAllPanes();
            if (showNotice) this.showToast("🔄 模板库与数据库卡同步就绪", "success");
        } catch (e) {
            console.error("[BuffFloatingPanel] 刷新模板库失败:", e);
        }
    }

    /**
     * 保存模板库
     */
    static async saveTemplates(syncToDatabase = true) {
        try {
            await SuiteConfigStore.saveTemplates(this.templates, syncToDatabase);
        } catch (e) {
            console.error("[BuffFloatingPanel] 保存模板失败:", e);
        }
    }

    /**
     * 监听数据库角色卡属性变动
     */
    static initDatabaseCharacterWatcher() {
        if (this._dbWatcherBound) return;
        this._dbWatcherBound = true;

        const attachToChar = (char) => {
            if (!char) return;
            if (char.attribs) {
                char.attribs.on("add change remove reset", () => {
                    if (this.isInternalSaving) return;
                    if (this._dbSyncTimer) clearTimeout(this._dbSyncTimer);
                    this._dbSyncTimer = setTimeout(async () => {
                        if (this.isInternalSaving) return;
                        await this.refreshTemplates(false);
                    }, 300);
                });
            }
        };

        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) attachToChar(dbChar);

        if (window.Campaign?.characters) {
            window.Campaign.characters.on("add", (c) => {
                if (c.get("name") === SuiteConfigStore.DATABASE_CHARACTER_NAME) attachToChar(c);
            });
        }
    }

    /**
     * 选区变动监听
     */
    static initSelectionListeners() {
        const checkChanged = () => {
            const tokens = this.getSelectedTokens();
            const idsStr = tokens.map(t => t.token?.id || t.char?.id || t.name).sort().join(",");
            if (idsStr !== this._lastSelectedIdsStr) {
                this._lastSelectedIdsStr = idsStr;
                this.renderAllPanes();
            }
        };

        const engine = window.Campaign?.engine?.tabletop;
        if (engine && typeof engine.on === "function") {
            engine.on("selection:change", checkChanged);
        }

        window.addEventListener("selectionchange", checkChanged);
        document.addEventListener("selectionchange", checkChanged);
        setInterval(checkChanged, 600);
    }

    /**
     * 提取当前画布选中的 Token 与角色模型
     */
    static getSelectedTokens() {
        const result = [];
        const seen = new Set();
        const tt = window.Campaign?.engine?.tabletop;

        if (tt && typeof tt.getSelection === "function") {
            const selection = tt.getSelection() || [];
            for (const item of selection) {
                const tokenId = item.id;
                if (!tokenId || seen.has(tokenId)) continue;
                seen.add(tokenId);

                const tokenModel = item.model || Roll20Bridge.getTokenGraphic(tokenId);
                if (tokenModel) {
                    const charId = tokenModel.get("represents");
                    const char = charId ? window.Campaign.characters.get(charId) : null;
                    result.push({ token: tokenModel, char, name: tokenModel.get("name") || "Token" });
                }
            }
        }
        return result;
    }

    /**
     * 悬浮吸附收起与展开
     */
    static initHoverCollapse() {
        let hoverTimer = null;
        this.panelEl.addEventListener("mouseenter", () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapsed(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (!this.isPinned && !this.isCollapsed) {
                hoverTimer = setTimeout(() => {
                    if (!this.isPinned) this.setCollapsed(true);
                }, 400);
            }
        });
    }

    /**
     * 固定状态切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        this.updatePinState();
        if (this.isPinned) this.setCollapsed(false);
    }

    static updatePinState() {
        const pinBtn = this.panelEl.querySelector(".btn-toggle-pin");
        if (pinBtn) {
            pinBtn.classList.toggle("pinned", this.isPinned);
            pinBtn.title = this.isPinned ? "已固定（鼠标移开不自动收起）" : "未固定（鼠标移开后自动收起）";
        }
    }

    /**
     * 折叠/展开控制
     */
    static toggleCollapse() {
        this.setCollapsed(!this.isCollapsed);
    }

    static setCollapsed(collapsed) {
        this.isCollapsed = collapsed;
        this.panelEl.classList.toggle("is-collapsed", collapsed);
        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (minBtn) minBtn.textContent = collapsed ? "+" : "-";
        this.updateLayoutDirection();
    }

    /**
     * 根据视口边界更新向上或向下生长方向
     */
    static updateLayoutDirection() {
        if (!this.panelEl) return;
        const rect = this.panelEl.getBoundingClientRect();
        const headerTop = rect.top;
        const windowHeight = window.innerHeight;

        // 若标题栏位于屏幕下半区（离底部不足 380px 且上方空间充裕），向上展示
        if (headerTop > windowHeight / 2 && (windowHeight - headerTop < 380)) {
            this.panelEl.classList.remove("direction-down");
            this.panelEl.classList.add("direction-up");
        } else {
            this.panelEl.classList.remove("direction-up");
            this.panelEl.classList.add("direction-down");
        }
    }

    /**
     * 恢复持久化位置
     */
    static restorePanelPosition() {
        const saved = localStorage.getItem(this.POS_KEY);
        let left = Math.max(10, window.innerWidth - 340);
        let top = 100;

        if (saved) {
            try {
                const pos = JSON.parse(saved);
                if (pos.left !== undefined) left = Math.max(10, Math.min(window.innerWidth - 340, pos.left));
                if (pos.top !== undefined) top = Math.max(10, Math.min(window.innerHeight - 40, pos.top));
            } catch (e) {}
        }

        this.panelEl.style.left = `${left}px`;
        this.panelEl.style.top = `${top}px`;
    }

    static savePosition() {
        const pos = { left: this.panelEl.offsetLeft, top: this.panelEl.offsetTop };
        localStorage.setItem(this.POS_KEY, JSON.stringify(pos));
        this.updateLayoutDirection();
    }

    /**
     * 简易 Toast 提示条
     */
    static showToast(msg, type = "info") {
        const toast = this.panelEl.querySelector("#r20-buff-toast");
        if (!toast) return;
        toast.textContent = msg;
        toast.className = "r20-toast " + type;
        toast.style.display = "block";
        setTimeout(() => { toast.style.display = "none"; }, 2500);
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

            // 3. 启动先攻条 DOM 响应式监听与全量刷新
            try {
                Pf1eBuffUI.startObserver();
                await Pf1eBuffUI.refreshAllBadges();
                console.log("[Roll20Suite] Pf1eBuffUI 先攻徽章与 MutationObserver 挂载就绪");
            } catch (uiErr) {
                console.error("[Roll20Suite] 先攻条徽章挂载失败:", uiErr);
            }

            console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.9.3 全部就绪！");
        } catch (fatalErr) {
            console.error("[Roll20Suite] 引擎主入口遭遇致命异常:", fatalErr);
        }
    }

    main().catch(e => console.error("[Roll20Suite] main 未捕获 Promise 异常:", e));
})();
