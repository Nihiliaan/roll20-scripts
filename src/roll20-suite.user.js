// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/Nihiliaan/roll20-scripts
// @version      0.9.16
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成极简标题栏基准展开定位、Jumpgate原生选区联动、Vue响应式先攻徽章防护与原生角色卡完全同步
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @updateURL    https://update.greasyfork.org/scripts/603253/roll20-suite-pf1e-turnorder-buff-engine.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/603253/roll20-suite-pf1e-turnorder-buff-engine.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.9.16...");

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
     * 判断当前登录用户是否具备 GM 权限
     * @returns {boolean}
     */
    static isGM() {
        return !!window.is_gm;
    }

    /**
     * 获取当前登录玩家的唯一标识 ID
     * @returns {string|null}
     */
    static getCurrentPlayerId() {
        return window.currentPlayer ? window.currentPlayer.id : (window.d20_player_id || null);
    }

    /**
     * 判断当前用户对特定 Token/角色卡是否拥有完全控制或查看权限
     * （GM 拥有全域权限；普通玩家仅能控制自身或被授权全部人的单位）
     * @param {string|object} tokenOrId Token对象或TokenID
     * @returns {boolean}
     */
    static canControlToken(tokenOrId) {
        if (this.isGM()) return true;

        const token = typeof tokenOrId === "string" ? this.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return false;

        // 1. 若关联了人物卡，优先依据人物卡的控制权限判定
        const character = this.getCharacterByToken(token);
        if (character) {
            if (typeof character.currentPlayerControls === "function") {
                return character.currentPlayerControls();
            }
            const myPlayerId = this.getCurrentPlayerId();
            const controlledBy = (character.get("controlledby") || "").split(",");
            return controlledBy.includes(myPlayerId) || controlledBy.includes("all");
        }

        // 2. 若为纯野怪 Token，依据 Token 自身控制权判定
        const myPlayerId = this.getCurrentPlayerId();
        const tokenControlledBy = (token.get("controlledby") || "").split(",");
        return tokenControlledBy.includes(myPlayerId) || tokenControlledBy.includes("all");
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
     * 脚本自主修改状态锁（为 true 时抑制外部属性监听器响应）
     */
    static isScriptMutating = false;

    /**
     * 官方内置负面状态 (Conditions) 31 项白名单（精准匹配角色卡 UI，排除能量吸取与被纠缠联动派生的被缓慢）
     */
    static CONDITION_DEFINITIONS = {
        // 第一行 (15 项)
        "condition-Bleed": { zh: "流血", defaultTimed: true },
        "condition-Blinded": { zh: "目盲", defaultTimed: true },
        "condition-Cowering": { zh: "畏縮", defaultTimed: false },
        "condition-Dazed": { zh: "暈眩", defaultTimed: true },
        "condition-Dazzled": { zh: "目眩", defaultTimed: true },
        "condition-Dead": { zh: "死亡", defaultTimed: false },
        "condition-Deafened": { zh: "耳聾", defaultTimed: false },
        "condition-Disabled": { zh: "癱瘓", defaultTimed: false }, // UI 文本为瘫痪
        "condition-Drowning": { zh: "溺水", defaultTimed: true },
        "condition-Dying": { zh: "瀕死", defaultTimed: true },
        "condition-Entangled": { zh: "糾纏", defaultTimed: true },
        "condition-Exhausted": { zh: "力竭", defaultTimed: false },
        "condition-Fascinated": { zh: "迷魂", defaultTimed: true },
        "condition-Fatigued": { zh: "疲乏", defaultTimed: false },
        "condition-Flat-Footed": { zh: "措手不及", defaultTimed: false },

        // 第二行 (16 项)
        "condition-Grappled": { zh: "擒抱", defaultTimed: false },
        "condition-Helpless": { zh: "無助", defaultTimed: false },
        "condition-Incorporeal": { zh: "虛體", defaultTimed: false },
        "condition-Invisible": { zh: "隱形", defaultTimed: true },
        "condition-Nauseated": { zh: "反胃", defaultTimed: true },
        "condition-Paralyzed": { zh: "麻痺", defaultTimed: false }, // UI 文本为麻痹
        "condition-Petrified": { zh: "石化", defaultTimed: false },
        "condition-Pinned": { zh: "壓制", defaultTimed: false },
        "condition-Prone": { zh: "俯臥", defaultTimed: false }, // UI 文本为俯卧
        "condition-Fear": { zh: "恐懼", defaultTimed: true }, // UI 文本为恐懼 (任意)
        "condition-Sickened": { zh: "噁心", defaultTimed: true }, // UI 文本为噁心
        "condition-Stable": { zh: "穩定", defaultTimed: false }, // UI 文本为稳定
        "condition-Staggered": { zh: "恍惚", defaultTimed: true },
        "condition-Stunned": { zh: "Stunned", defaultTimed: true }, // UI 文本为 Stunned
        "condition-Suffocating": { zh: "窒息", defaultTimed: true },
        "condition-Unconscious": { zh: "昏迷", defaultTimed: false }
    };

    /**
     * 获取指定角色卡上所有当前处于激活状态的负面状态 (Conditions)
     * 负数轮数表示正计轮（已经过的轮数，如 -1 为第 1 轮，-2 为第 2 轮）
     * @param {object} character 
     * @returns {Promise<Array>}
     */
    static async getActiveConditions(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs || !character.attribs.models) return [];

        const conditions = [];

        for (const [condKey, def] of Object.entries(this.CONDITION_DEFINITIONS)) {
            const attr = character.attribs.models.find(a => a.get("name") === condKey);
            if (!attr) continue;

            const val = attr.get("current");
            const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;

            if (isActive) {
                const roundsKey = `${condKey}_rounds`;
                const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                let rounds = null;

                if (roundsAttr && roundsAttr.get("current") !== "" && roundsAttr.get("current") !== null) {
                    const rVal = Number(roundsAttr.get("current"));
                    if (!isNaN(rVal)) {
                        rounds = rVal;
                    }
                }

                conditions.push({
                    key: condKey,
                    name: def.zh,
                    isCondition: true,
                    isDebuff: true,
                    rounds,
                    roundsKey,
                    condAttr: attr,
                    roundsAttr
                });
            }
        }

        return conditions;
    }

    /**
     * 设置或更新指定负面状态的已过轮数（负数存储）
     */
    static async setConditionRounds(character, condKey, rounds) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const roundsKey = `${condKey}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);

        if (rounds === null || rounds === "" || isNaN(rounds)) {
            if (roundsAttr) roundsAttr.destroy();
            return;
        }

        // 统一负数正计轮规范：若用户传入 2，存为 -2
        const storedVal = -Math.abs(Number(rounds));
        if (roundsAttr) {
            roundsAttr.save({ current: storedVal });
        } else {
            character.attribs.create({ name: roundsKey, current: storedVal });
        }
    }

    /**
     * 关闭/解除指定负面状态
     */
    static async removeCondition(character, condKey) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const attr = character.attribs.models.find(a => a.get("name") === condKey);
        if (attr) {
            attr.save({ current: "0" });
        }
        const roundsKey = `${condKey}_rounds`;
        const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
        if (roundsAttr) {
            roundsAttr.destroy();
        }
    }
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
     * 切换/设置 Buff 的激活开关 (enable_toggle)
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     * @param {boolean|number} enable 是否激活
     */
    static async toggleBuff(character, rowId, enable = false) {
        if (!character) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;
        const lowerPrefix = `repeating_buff2_${rowId.toLowerCase()}`;

        let toggleAttr = character.attribs.models.find(a => {
            const n = a.get("name") || "";
            return n === `${targetPrefix}_enable_toggle` || n.toLowerCase() === `${lowerPrefix}_enable_toggle`;
        });

        const val = enable ? 1 : 0;
        if (!toggleAttr) {
            toggleAttr = character.attribs.create({ name: `${targetPrefix}_enable_toggle`, current: val });
        } else {
            toggleAttr.save({ current: val });
        }

        // 若关停，同步将轮数重置清零，防止僵尸轮数残留
        if (!enable) {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            if (roundsAttr) roundsAttr.save({ current: 0 });
        }

        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})`);
        return true;
    }

    /**
     * 关停/解除指定角色身上的某个 Buff (基于 rowId)
     */
    static async removeBuff(character, rowId) {
        return this.toggleBuff(character, rowId, false);
    }

    /**
     * 关停/解除指定角色身上的同名 Buff (基于名称)
     */
    static async removeBuffByName(character, buffName) {
        if (!character || !buffName) return false;
        const buffs = await this.getAllBuffs(character);
        const cleanTarget = buffName.trim().toLowerCase();
        const target = buffs.find(b => (b.name || "").trim().toLowerCase() === cleanTarget && b.enabled);
        if (target && target.rowId) {
            return this.toggleBuff(character, target.rowId, false);
        }
        return false;
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
     * 更新指定角色卡上的单行 Buff 数据（名称、轮数与细目扩展加值字典）
     */
    static async updateBuffRow(character, rowId, name, rounds, extraAttrs) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const prefixWithUnderscore = `${prefix}_`;

        // 1. 更新名称
        let nameAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_name`);
        if (!nameAttr) {
            nameAttr = character.attribs.create({ name: `${prefix}_name`, current: name });
        } else {
            nameAttr.save({ current: name });
        }

        // 2. 更新轮数
        let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
        const roundsVal = (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "";
        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: roundsVal });
        } else {
            roundsAttr.save({ current: roundsVal });
        }

        // 3. 补全原生必需属性
        this.ensureNativeRequiredAttrs(character, prefix, rowId);

        // 4. 更新细目加值字典 (extraAttrs)
        if (extraAttrs && typeof extraAttrs === "object") {
            // 清理不在新 extraAttrs 中的旧扩展字段
            const preservedKeys = new Set(["name", "enable_toggle", "rounds", "tabcat", "tabcat2", "row_id", "bufftype"]);
            for (const attr of [...character.attribs.models]) {
                const attrName = attr.get("name") || "";
                if (attrName.startsWith(prefixWithUnderscore)) {
                    const subKey = attrName.substring(prefixWithUnderscore.length);
                    if (!preservedKeys.has(subKey) && !(subKey in extraAttrs)) {
                        attr.destroy();
                    }
                }
            }

            // 写入或更新新的扩展字段
            for (const [subKey, val] of Object.entries(extraAttrs)) {
                const fullKey = `${prefix}_${subKey}`;
                let attr = character.attribs.models.find(a => a.get("name") === fullKey);
                if (!attr) {
                    character.attribs.create({ name: fullKey, current: val });
                } else {
                    attr.save({ current: val });
                }
            }
        }

        console.log(`[Pf1eBuffManager] 已更新 ${character.get("name")} 的 Buff [${name}] (${rowId})`);
        return true;
    }

    /**
     * 正向行动结束扣减活跃 Buff 轮数 (统一入口，兼容传入 Character 模型、Token 模型或 Token ID)
     */
    static async decrementBuffs(tokenOrChar) {
        let character = null;
        let token = null;

        if (typeof tokenOrChar === "string") {
            token = Roll20Bridge.getTokenGraphic(tokenOrChar);
            character = Roll20Bridge.getCharacterByToken(tokenOrChar);
        } else if (tokenOrChar && tokenOrChar.attribs) {
            character = tokenOrChar;
        } else if (tokenOrChar && typeof tokenOrChar.get === "function") {
            token = tokenOrChar;
            character = Roll20Bridge.getCharacterByToken(token);
        }

        if (!character) return [];

        this.isScriptMutating = true;
        try {
            const charName = character.get("name") || (token ? token.get("name") : "未知角色");
            const activeBuffs = await this.getActiveBuffs(character);
            const processed = [];

            // 1. 扣减常规正面 Buff (大于 0 归零时自动解除)
            for (const buff of activeBuffs) {
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const newRounds = buff.rounds - 1;

                if (newRounds <= 0) {
                    await this.removeBuff(character, buff.rowId);
                    processed.push({ name: buff.name, status: "expired", remaining: 0 });
                } else {
                    if (buff.roundsAttr) {
                        buff.roundsAttr.save({ current: newRounds }, { byScript: true });
                    } else {
                        await this.setBuffRounds(character, buff.rowId, newRounds);
                    }
                    processed.push({ name: buff.name, status: "decremented", remaining: newRounds });
                }
            }

            // 2. 推进负面状态轮数 (负数正计轮，rounds - 1，如 -1 -> -2)
            const activeConditions = await this.getActiveConditions(character);
            for (const cond of activeConditions) {
                if (cond.rounds === null || isNaN(cond.rounds)) continue;

                const newRounds = cond.rounds - 1; // 统一减法：-1 变为 -2
                if (cond.roundsAttr) {
                    cond.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setConditionRounds(character, cond.key, newRounds);
                }
                processed.push({ name: cond.name, status: "condition_advanced", elapsed: Math.abs(newRounds) });
            }

            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }
    }

    /**
     * 当角色行动结束时，扣减其身上所有已设置轮数的活跃 Buff (别名保持向前兼容)
     */
    static async tickBuffsOnTurnEnd(tokenId) {
        return this.decrementBuffs(tokenId);
    }

    /**
     * 反向倒先攻时，将被拉回排头的单位身上所有带轮数的 Buff 加回 1 轮
     */
    static async incrementBuffsOnTurnRevert(tokenOrChar) {
        let character = null;
        let token = null;

        if (typeof tokenOrChar === "string") {
            token = Roll20Bridge.getTokenGraphic(tokenOrChar);
            character = Roll20Bridge.getCharacterByToken(tokenOrChar);
        } else if (tokenOrChar && tokenOrChar.attribs) {
            character = tokenOrChar;
        } else if (tokenOrChar && typeof tokenOrChar.get === "function") {
            token = tokenOrChar;
            character = Roll20Bridge.getCharacterByToken(token);
        }

        if (!character) return [];

        this.isScriptMutating = true;
        try {
            const activeBuffs = await this.getActiveBuffs(character);
            const processed = [];

            // 1. 加回常规正面 Buff (rounds + 1)
            for (const buff of activeBuffs) {
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const newRounds = buff.rounds + 1;
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setBuffRounds(character, buff.rowId, newRounds);
                }
                processed.push({ name: buff.name, status: "incremented", remaining: newRounds });
            }

            // 2. 回退负面状态轮数 (rounds + 1，如 -2 -> -1)
            const activeConditions = await this.getActiveConditions(character);
            for (const cond of activeConditions) {
                if (cond.rounds === null || isNaN(cond.rounds)) continue;

                const newRounds = cond.rounds + 1; // 统一加法：-2 变为 -1
                if (cond.roundsAttr) {
                    cond.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setConditionRounds(character, cond.key, newRounds);
                }
                processed.push({ name: cond.name, status: "condition_reverted", elapsed: Math.abs(newRounds) });
            }

            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }

        console.log(`[Pf1eBuffManager] 先攻回退: 为 ${character.get("name")} 加回 Buff 轮数共 ${processed.length} 项`);
        return processed;
    }
}

    // ==========================================
    // 3. SuiteConfigStore 战役云端配置卡存储层
    // ==========================================
/**
 * SuiteConfigStore.js
 * 战役云端配置卡存储层（SSOT 单一真实数据源架构）
 * 1. 唯一真实数据源：=== R20_SUITE_DATABASE === 角色卡上的 repeating_buff2_* 原生属性；
 * 2. 拓扑属性 buff_tree_structure 仅记录目录层级与组织关系，绝不覆写原生属性，绝不盲目误杀卡上数据；
 * 3. 增删改查均采用原子操作，杜绝双状态竞争。
 */



class SuiteConfigStore {
    static DATABASE_CHARACTER_NAME = "=== R20_SUITE_DATABASE ===";
    static DB_CHAR_NAME = this.DATABASE_CHARACTER_NAME;
    static ATTR_TREE_STRUCTURE = "buff_tree_structure";

    /**
     * 判断当前登录玩家是否具备 GM (裁判) 权限
     */
    static isGM() {
        return window.isGM === true;
    }

    /**
     * 查找战役中专用于存储 Suite 配置的公共人物卡
     */
    static findDatabaseCharacter() {
        if (!window.Campaign || !window.Campaign.characters) return null;
        return window.Campaign.characters.models.find(
            c => c.get("name") === this.DATABASE_CHARACTER_NAME && !c.get("archived")
        ) || null;
    }

    /**
     * 自动新建战役配置人物卡（仅 GM 可调用）
     */
    static async createDatabaseCharacter() {
        if (!this.isGM()) {
            console.warn("[SuiteConfigStore] 仅 GM 裁判可创建配置角色卡");
            return null;
        }

        const newChar = window.Campaign.characters.create({
            name: this.DATABASE_CHARACTER_NAME,
            avatar: "",
            bio: "Roll20 Suite 战役全局状态 Buff 模板库存储卡。请勿手动修改本卡名称。",
            inplayerjournals: "all",
            controlledby: "all"
        });

        console.log("[SuiteConfigStore] 成功创建战役公共配置卡: " + this.DATABASE_CHARACTER_NAME);
        await Roll20Bridge.ensureCharacterAttributes(newChar);
        return newChar;
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
        let dbChar = this.findDatabaseCharacter();
        if (!dbChar && this.isGM()) {
            dbChar = await this.createDatabaseCharacter();
        }
        if (!dbChar) return false;

        await Roll20Bridge.ensureCharacterAttributes(dbChar);

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
    static async addBuffToDatabase(name, rounds = null, extraAttrs = null) {
        let dbChar = this.findDatabaseCharacter();
        if (!dbChar && this.isGM()) {
            dbChar = await this.createDatabaseCharacter();
        }
        if (!dbChar) return null;

        await Roll20Bridge.ensureCharacterAttributes(dbChar);

        const rowId = window.generateUUID ? window.generateUUID() : ("-R20" + Math.random().toString(36).substr(2, 16));
        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, extraAttrs);

        console.log("[SuiteConfigStore] 原子创建原生 Buff [" + name + "] (rowId: " + rowId + ")");
        return rowId;
    }

    /**
     * 原子更新数据库角色卡上的指定 Buff
     */
    static async updateBuffInDatabase(rowId, name, rounds = null, extraAttrs = null) {
        const dbChar = this.findDatabaseCharacter();
        if (!dbChar || !rowId) return false;

        await Roll20Bridge.ensureCharacterAttributes(dbChar);
        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, extraAttrs);

        console.log("[SuiteConfigStore] 原子更新原生 Buff [" + name + "] (rowId: " + rowId + ")");
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
    static async writeNativeBuffRow(character, rowId, name, rounds, extraAttrs) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = "repeating_buff2_" + rowId;
        const attrs = [
            { name: prefix + "_name", current: name || "未命名Buff" },
            { name: prefix + "_enable_toggle", current: 0 },
            { name: prefix + "_tabcat2", current: "1" },
            { name: prefix + "_rounds", current: (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "" },
            { name: prefix + "_bufftype", current: (extraAttrs && extraAttrs.bufftype) ? extraAttrs.bufftype : "spell" },
            { name: prefix + "_tabcat", current: (extraAttrs && extraAttrs.bufftype) ? extraAttrs.bufftype : "spell" },
            { name: prefix + "_row_id", current: rowId.toLowerCase() },
            { name: prefix + "_description-show", current: 1 }
        ];

        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [key, val] of Object.entries(extraAttrs)) {
                if (key !== "name" && key !== "enable_toggle" && key !== "rounds" && key !== "bufftype" && key !== "tabcat") {
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
                        extraAttrs: b.extraAttrs || null
                    });
                });
            }
        }
        return result;
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
            turnReverted: [],
            orderChanged: []
        };
        this.isInitialized = false;
        this._lastLocalIntent = { action: null, timestamp: 0 };
    }

    /**
     * 注册事件回调（安全按需动态创建）
     * @param {"turnEnded"|"turnStarted"|"turnReverted"|"orderChanged"} event 
     * @param {Function} callback 
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * 开始监听先攻变动与本地操作意图
     */
    start() {
        if (this.isInitialized || typeof window.Campaign === "undefined") return;

        // 初始化缓存
        const rawJson = window.Campaign.get("turnorder");
        this.cachedOrder = this.parseTurnorder(rawJson);

        // 1. 挂载本地用户操作捕获（委托到 document 捕获阶段，精准识别亲手点击）
        this.bindLocalIntentListeners();

        // 2. 绑定 Backbone 事件
        window.Campaign.on("change:turnorder", (campaign, newJson) => {
            this.handleTurnorderChange(newJson);
        });

        this.isInitialized = true;
        console.log("[TurnOrderObserver] 先攻事件监听器已就绪，当前排头:", this.getHeadTokenId());
    }

    /**
     * 监听本地先攻条前进/后退按钮点击，精准捕获本地发起者身份
     */
    bindLocalIntentListeners() {
        document.addEventListener("click", (e) => {
            const target = e.target;
            if (!target) return;

            // 前进按钮 (Next Turn)
            if (target.closest?.(".turn-tracker__forward, .ui-icon-seek-next, [data-action='next']")) {
                this._lastLocalIntent = { action: "forward", timestamp: Date.now() };
            }
            // 后退按钮 (Previous Turn)
            else if (target.closest?.(".turn-tracker__back, .ui-icon-seek-prev, [data-action='prev']")) {
                this._lastLocalIntent = { action: "back", timestamp: Date.now() };
            }
        }, true);
    }

    /**
     * 检查当前轮转是否由本地用户主动点击触发（1500ms 内有效）
     */
    checkAndConsumeLocalIntent(expectedAction) {
        const now = Date.now();
        const isMatch = this._lastLocalIntent.action === expectedAction && (now - this._lastLocalIntent.timestamp < 1500);
        // 消耗标记，防止单次点击重复生效
        this._lastLocalIntent = { action: null, timestamp: 0 };
        return isMatch;
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
            const isLocalUserAction = this.checkAndConsumeLocalIntent("forward");

            console.log(`[TurnOrderObserver] 识别到正向回合结束: ${endedTokenId} -> 新排头: ${startedTokenId} (本地操作: ${isLocalUserAction})`);
            
            // 派发回合结束与回合开始
            this.emit("turnEnded", { endedTokenId, startedTokenId, oldList, newList, isLocalUserAction });
            this.emit("turnStarted", { startedTokenId, endedTokenId, newList, isLocalUserAction });
        } else if (isPrevTurn) {
            const revertedTokenId = newList[0].id;
            const isLocalUserAction = this.checkAndConsumeLocalIntent("back");
            console.log(`[TurnOrderObserver] 识别到先攻回退: ${oldList[0].id} <- ${revertedTokenId} (本地操作: ${isLocalUserAction})`);
            this.emit("turnReverted", { revertedTokenId, oldList, newList, isLocalUserAction });
        } else {
            console.log("[TurnOrderObserver] 识别到先攻排序或手动拖拽调整");
            // 仅在非前进/回退的重排（如手动拖拽或增减人员）时派发 orderChanged
            this.emit("orderChanged", { newList, oldList });
        }

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
     * @param {string|object} tokenOrId Token ID 或 Token 模型
     */
    static decrementBuffs(tokenOrId) {
        const token = typeof tokenOrId === "string" ? Roll20Bridge.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        if (buffs.length === 0) return [];

        const tokenName = token.get("name") || "未命名棋子";
        const remainingBuffs = [];
        const processed = [];

        for (const buff of buffs) {
            if (buff.rounds === null || isNaN(buff.rounds)) {
                remainingBuffs.push(buff);
                continue;
            }

            const nextRounds = buff.rounds - 1;
            if (nextRounds <= 0) {
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

    /**
     * 兼容别名
     */
    static tickBuffsOnTurnEnd(tokenId) {
        return this.decrementBuffs(tokenId);
    }

    /**
     * 倒先攻时，将被拉回排头的 Token 身上的 Buff 加回 1 轮
     */
    static incrementBuffsOnTurnRevert(tokenOrId) {
        const token = typeof tokenOrId === "string" ? Roll20Bridge.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return [];

        const buffs = this.getTokenBuffs(token);
        if (buffs.length === 0) return [];

        const processed = [];
        for (const buff of buffs) {
            if (buff.rounds === null || isNaN(buff.rounds)) continue;
            buff.rounds = buff.rounds + 1;
            processed.push({ name: buff.name, status: "incremented", remaining: buff.rounds });
        }

        this.saveTokenBuffs(token, buffs);
        console.log(`[TokenBuffManager] 先攻回退: 为 Token [${token.get("name")}] 加回 Buff 轮数共 ${processed.length} 项`);
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

    // 便签板（微任务任务合并队列，彻底消除连环触发与并发竞态）
    static pendingTokenIds = new Set();
    static isFlushingScheduled = false;

    /**
     * 投递刷新请求到便签板（自动去重并微任务合并）
     * @param {string} tokenId 
     */
    static requestTokenRefresh(tokenId) {
        if (!tokenId) return;
        this.pendingTokenIds.add(tokenId);

        if (!this.isFlushingScheduled) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 微任务检查点：批量清空便签板并单次刷新
     */
    static async flushPendingRefreshes() {
        const tokenIds = Array.from(this.pendingTokenIds);
        this.pendingTokenIds.clear();
        this.isFlushingScheduled = false;

        for (const tid of tokenIds) {
            try {
                await this.refreshSingleTokenBadge(tid);
            } catch (err) {
                console.error(`[Pf1eBuffUI] 便签板刷新 Token [${tid}] 异常:`, err);
            }
        }
    }

    static injectStyles() {
        if (this.isStylesInjected) return;
        const style = document.createElement("style");
        style.id = "pf1e-buff-tracker-styles";
        style.textContent = `
            #vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token {
                flex-wrap: wrap !important;
                height: auto !important;
                min-height: 38px !important;
                padding-bottom: 4px !important;
            }
            .r20-buff-container {
                order: 99 !important;
                display: flex !important;
                flex-wrap: wrap !important;
                flex-basis: 100% !important;
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-top: 2px !important;
                gap: 2px 4px !important;
                line-height: 1 !important;
                overflow: hidden !important;
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
            .r20-buff-pill-debuff {
                display: inline-flex;
                align-items: center;
                background: #881337 !important;
                border-color: #f43f5e !important;
                color: #ffe4e6 !important;
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
            .r20-buff-pill-debuff:hover {
                background: #be123c !important;
                border-color: #fda4af !important;
                color: #ffffff !important;
            }
        `;
        document.head.appendChild(style);
        this.isStylesInjected = true;
    }

    /**
     * 启动持久 DOM 监听器（仅补充挂载新加入的角色节点，不干扰原生移动）
     */
    static startObserver() {
        if (this.isObserverStarted) return;
        this.injectStyles();

        // 1. 监听主窗口变动（优先发现全新加入先攻列表的单位）
        if (this._observer) this._observer.disconnect();

        this._observer = new MutationObserver((mutations) => {
            let hasNewUnmountedTokens = false;
            for (const m of mutations) {
                // 忽略自身 buff 容器引起的变动，杜绝回环震荡
                if (m.target?.closest?.(".r20-buff-container")) continue;

                if (m.type === "childList") {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.matches?.("li.token") && !node.querySelector(".r20-buff-container")) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.querySelector?.("li.token") && !node.querySelector(".r20-buff-container")) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.id === "vm-turn-order" || node.matches?.(".turn-tracker")) {
                                hasNewUnmountedTokens = true;
                                break;
                            }
                        }
                    }
                }
                if (hasNewUnmountedTokens) break;
            }

            if (hasNewUnmountedTokens) {
                if (this._debounceTimer) clearTimeout(this._debounceTimer);
                this._debounceTimer = setTimeout(() => {
                    this.refreshAllBadges();
                }, 80);
            }
        });

        // 优先监听 vm-turn-order 或 body
        const targetContainer = document.getElementById("vm-turn-order") || document.body;
        this._observer.observe(targetContainer, { childList: true, subtree: true });

        // 2. 仅在先攻窗口打开/切换时初始化，绝不重复监听 change:turnorder（交由 TurnOrderObserver 统一精准调度）
        if (window.Campaign && typeof window.Campaign.on === "function") {
            window.Campaign.on("change:initiativepage", () => {
                setTimeout(() => this.refreshAllBadges(), 100);
            });
        }

        // 3. 实时响应人物卡属性变动（即时更新负面状态与 Buff，无需走动先攻！）
        this.bindCharacterAttributeListeners();

        this.isObserverStarted = true;
        // 立即尝试一次初次刷新
        this.refreshAllBadges();
    }

    /**
     * 判定属性名是否属于 31 项白名单负面状态
     */
    static isConditionAttrName(name) {
        if (!name || !name.startsWith("condition-")) return false;
        const cleanName = name.endsWith("_rounds") ? name.replace("_rounds", "") : name;
        return cleanName in Pf1eBuffManager.CONDITION_DEFINITIONS;
    }

    /**
     * 判定属性名是否属于 Buff 核心控制字段（开关、名称、轮数）
     */
    static isBuffCoreAttrName(name) {
        if (!name || !name.startsWith("repeating_buff2_")) return false;
        return name.endsWith("_enable_toggle") || name.endsWith("_name") || name.endsWith("_rounds");
    }

    /**
     * 绑定人物卡属性变动监听，仅响应用户真人在人物卡上的手动编辑（静默过滤脚本操作）
     */
    static bindCharacterAttributeListeners() {
        if (!window.Campaign || !window.Campaign.characters) return;

        const boundChars = new Set();

        const attachToChar = (char) => {
            if (!char || boundChars.has(char.id)) return;
            boundChars.add(char.id);

            const handleAttrChange = (attrModel, val, options) => {
                // 1. 若为脚本自身的业务更新，或处于全局脚本变更锁中，彻底静音跳过
                if (options?.byScript || Pf1eBuffManager.isScriptMutating) {
                    return;
                }

                const attrName = attrModel?.get?.("name") || "";

                // 2. 超精细门禁：只允许 31 项负面状态与 Buff 核心 3 大字段通过
                const isRelevant = this.isConditionAttrName(attrName) || this.isBuffCoreAttrName(attrName);
                if (!isRelevant) return;

                // 3. 投递到便签板，由微任务统一合并刷新
                this.scheduleTokensRepresentingCharacter(char.id);
            };

            if (char.attribs) {
                char.attribs.on("change:current", handleAttrChange);
                char.attribs.on("destroy", handleAttrChange);
            }
        };

        window.Campaign.characters.forEach(attachToChar);
        window.Campaign.characters.on("add", attachToChar);
    }

    /**
     * 根据角色 ID 定位其在先攻栏中的 Token 并投递到便签板
     */
    static scheduleTokensRepresentingCharacter(charId) {
        if (!charId) return;
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        for (const row of rows) {
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                const char = Roll20Bridge.getCharacterByToken(tokenId);
                if (char && char.id === charId) {
                    this.requestTokenRefresh(tokenId);
                }
            }
        }
    }

    /**
     * 刷新整个先攻条上的徽章（具备签名机制，未变动的行 0 破坏、0 DOM 重绘）
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
     * 定向精准刷新单个 Token 徽章（仅修改变动的那一个，零触碰其余行）
     */
    static async refreshSingleTokenBadge(tokenId) {
        if (!tokenId) return;
        const selector = `#vm-turn-order li.token[data-tokenid="${tokenId}"], .turn-tracker li.token[data-tokenid="${tokenId}"], #initiativewindow li.token[data-tokenid="${tokenId}"]`;
        const row = document.querySelector(selector);
        if (row) {
            await this.refreshRowBadge(row, tokenId, { force: true });
        }
    }

    /**
     * 刷新单行徽章（签名守卫：未发生内容变动时跳过，保留原生节点不破坏）
     * 具备严格的权限脱敏检查：非 GM 玩家且无控制权的单位，绝不渲染任何 Buff，保护隐私与战争迷雾
     */
    static async refreshRowBadge(row, tokenId, options = {}) {
        // 清理任何残留的旧 + 号按钮
        row.querySelectorAll(".r20-add-buff-btn").forEach(el => el.remove());

        // 彻底防御异步并发竞态：仅保留行内唯一一个 .r20-buff-container，清理所有多余重复容器
        const existingContainers = Array.from(row.querySelectorAll(".r20-buff-container"));
        let container = existingContainers.length > 0 ? existingContainers[0] : null;
        if (existingContainers.length > 1) {
            for (let i = 1; i < existingContainers.length; i++) {
                existingContainers[i].remove();
            }
        }

        // 同步就地初始化容器节点，杜绝异步 await 期间竞态二次创建
        if (!container) {
            container = document.createElement("div");
            container.className = "r20-buff-container";
            row.appendChild(container);
        }

        // 1. 权限拦截脱敏守卫：如果当前用户不是 GM 且无法控制该 Token，直接隐藏且清空，严防偷看
        if (!Roll20Bridge.canControlToken(tokenId)) {
            container.innerHTML = "";
            container.dataset.signature = "unauthorized";
            container.style.display = "none";
            return;
        }

        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const character = Roll20Bridge.getCharacterByToken(tokenId);

        let activeItems = [];
        const isCharacter = !!character;

        if (isCharacter) {
            // 1. 优先提取负面状态 (排在所有 Buff 之前)
            const conditions = await Pf1eBuffManager.getActiveConditions(character);
            // 2. 提取常规 Buff
            const buffs = await Pf1eBuffManager.getActiveBuffs(character);
            // 负面状态严格排在所有正面 Buff 之前
            activeItems = [...conditions, ...buffs];
        } else if (token) {
            activeItems = TokenBuffManager.getTokenBuffs(token).map(b => ({
                name: b.name,
                rounds: b.rounds,
                rowId: null,
                isTokenOnly: true
            }));
        }

        // 计算当前签名
        const signature = activeItems.map(b => `${b.isDebuff ? 'd' : 'b'}:${b.name}:${b.rounds}`).join("|");

        // 若未强制刷新且签名未变，直接返回，保持原生 DOM 零重绘！
        if (!options.force && container.dataset.signature === signature) {
            return;
        }

        container.dataset.signature = signature;
        container.innerHTML = "";

        if (activeItems.length === 0) {
            container.style.display = "none";
            return;
        }
        container.style.display = "flex";

        // 渲染徽章（负面状态排在所有正面 Buff 之前）
        for (const item of activeItems) {
            const pill = document.createElement("span");
            const isDebuff = !!item.isDebuff;

            let text = item.name;
            let title = "";

            if (isDebuff) {
                // 负面状态徽章样式
                pill.className = "r20-buff-pill-debuff";
                if (item.rounds !== null && item.rounds < 0) {
                    const elapsed = Math.abs(item.rounds);
                    text = `${item.name} +${elapsed}`;
                    title = `${item.name} (已持续 ${elapsed} 轮)，点击修改或解除`;
                } else {
                    text = item.name;
                    title = `${item.name} (常驻/战术状态)，点击修改或解除`;
                }
            } else {
                // 正面 Buff 徽章样式
                const isExpiring = item.rounds !== null && item.rounds <= 1;
                const showRounds = item.rounds !== null && item.rounds <= 100;
                text = showRounds ? `${item.name} ${item.rounds}` : item.name;
                pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
                title = `${item.name} (剩余 ${item.rounds !== null ? item.rounds + '轮' : '常驻'})，点击修改或解除`;
            }

            pill.title = title;
            pill.textContent = text;

            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                if (isDebuff) {
                    this.showConditionEditModal(character, token, item, row, tokenId);
                } else {
                    this.showBuffEditModal(character, token, item, row, tokenId);
                }
            });

            container.appendChild(pill);
        }
    }

    /**
     * 安全触发状态工作台双向联动刷新
     */
    static async notifyPanelsRefresh() {
        try {
            if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel?.renderAllPanes) {
                await window.Roll20Suite.BuffFloatingPanel.renderAllPanes();
            } else if (typeof BuffFloatingPanel !== "undefined" && BuffFloatingPanel.renderAllPanes) {
                await BuffFloatingPanel.renderAllPanes();
            }
        } catch (e) {
            console.warn("[Pf1eBuffUI] 联动工作台刷新略过:", e);
        }
    }

    /**
     * 单个负面状态 (Condition) 点击快捷编辑已过轮数或解除弹窗
     */
    static showConditionEditModal(character, token, cond, row, tokenId) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentElapsedStr = (cond.rounds !== null && cond.rounds < 0) ? String(Math.abs(cond.rounds)) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header" style="color:#f43f5e;">负面状态: ${cond.name}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">已持续轮数 (正计轮，留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="${currentElapsedStr}" placeholder="如 1, 2, 3..." />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon danger btn-delete" style="padding:6px 12px; margin-right:auto;">✕ 解除状态</button>
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        // 解除负面状态
        mask.querySelector(".btn-delete").addEventListener("click", async () => {
            try {
                if (character) {
                    await Pf1eBuffManager.removeCondition(character, cond.key);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 解除 Condition 异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });

        // 保存已过轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            try {
                const val = mask.querySelector(".input-rounds").value.trim();
                const rounds = val === "" ? null : parseInt(val, 10);

                if (character) {
                    await Pf1eBuffManager.setConditionRounds(character, cond.key, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 保存 Condition 轮数异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
        });
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
            try {
                if (character) {
                    if (buff.rowId) {
                        await Pf1eBuffManager.toggleBuff(character, buff.rowId, false);
                    } else {
                        await Pf1eBuffManager.removeBuffByName(character, buff.name);
                    }
                } else if (token) {
                    TokenBuffManager.removeBuff(token, buff.name);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 关停解除 Buff 异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
        });

        // 保存轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            try {
                const val = mask.querySelector(".input-rounds").value.trim();
                const rounds = val === "" ? null : parseInt(val, 10);

                if (character && buff.rowId) {
                    await Pf1eBuffManager.setBuffRounds(character, buff.rowId, rounds);
                } else if (token) {
                    TokenBuffManager.applyOrRefreshBuff(token, buff.name, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 保存 Buff 轮数异常:", err);
            }
            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
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

            try {
                if (character) {
                    await Pf1eBuffManager.applyOrRefreshBuff(character, name, rounds);
                } else if (token) {
                    TokenBuffManager.applyOrRefreshBuff(token, name, rounds);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 添加 Buff 异常:", err);
            }

            mask.remove();
            await this.refreshRowBadge(row, tokenId);
            await this.notifyPanelsRefresh();
        });
    }
}

    // ==========================================
    // 7. BuffPanelStyles (面板静态 CSS 样式)
    // ==========================================
/**
 * BuffPanelStyles.js
 * 状态Buff工作台样式定义：极简基准定位模型 + 上下垂直排版 + 原生 details/summary 折叠 + 纯粹整行高亮多选
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

            /* 向上展开时：内容与双栏顺序反转，使选中单位栏始终处于离标题较远的一侧（顶部），模板库与工具栏靠近标题（底部） */
            #r20-buff-panel.direction-up .r20-panel-content {
                flex-direction: column-reverse;
            }
            #r20-buff-panel.direction-up .r20-panel-toolbar {
                border-top: 1px solid #2d3748;
                border-bottom: none;
            }
            #r20-buff-panel.direction-up .r20-panel-panes {
                flex-direction: column-reverse;
            }
            #r20-buff-panel.direction-up .r20-pane.r20-unit-pane {
                border-bottom: 1px solid #2d3748;
            }
            #r20-buff-panel.direction-up .r20-pane.r20-template-pane {
                border-bottom: none;
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

            /* 树形条目（干净纯粹无复选框） */
            .r20-tree-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #20262f;
                border-radius: 4px;
                font-size: 11px;
                color: #cfd8dc;
                cursor: pointer;
                transition: all 0.15s ease;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2a3340;
                border-color: #42a5f5;
                color: #ffffff;
            }
            /* 激活态（已生效在选中Token身上） */
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
            /* 未激活态（角色卡已存在但当前关停） */
            .r20-tree-item.is-inactive {
                opacity: 0.65;
                background: #181d24;
                border: 1px dashed #37474f;
                color: #90a4ae;
            }
            .r20-tree-item.is-inactive:hover {
                opacity: 0.95;
                background: #212934;
                border-color: #78909c;
                color: #cfd8dc;
            }
            /* 编辑模式下彻底清除日常 Token 激活态高亮，保证编辑视图纯净无干扰 */
            #r20-buff-panel.is-editing .r20-tree-item.full-active,
            #r20-buff-panel.is-editing .r20-tree-item.partial-active {
                background: #1b2128 !important;
                border-color: transparent !important;
                color: #eceff1 !important;
                box-shadow: none !important;
            }
            /* 编辑多选高亮态（在编辑模式下选中的待删/操作条目：醒目的珊瑚红发光边框，与常规激活态截然区分） */
            .r20-tree-item.selected,
            #r20-buff-panel.is-editing .r20-tree-item.selected {
                background: rgba(239, 83, 80, 0.25) !important;
                border-color: #ef5350 !important;
                box-shadow: 0 0 6px rgba(239, 83, 80, 0.4) !important;
                color: #ffffff !important;
            }

            .r20-item-left {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1;
                overflow: hidden;
            }
            .r20-item-name {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
                white-space: nowrap;
                margin-left: 6px;
            }
            .r20-item-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: 6px;
            }
            .btn-edit-buff {
                padding: 1px 4px !important;
                font-size: 11px !important;
                border-radius: 3px;
                background: rgba(255, 255, 255, 0.08);
            }
            .btn-edit-buff:hover {
                background: #1976d2 !important;
                color: #ffffff !important;
            }

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
     * 初始化窗口标题栏拖拽移动（严格以标题栏尺寸与视口边缘进行约束，杜绝误用整窗高度）
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
        const header = panelEl.querySelector(".r20-panel-header");

        // 统一以标题栏为物理边界的 Clamp 算法
        const clampPosition = (left, top) => {
            const headerH = header ? header.offsetHeight : 34;
            const panelW = panelEl.offsetWidth || 320;
            const minLeft = 10;
            const maxLeft = Math.max(minLeft, window.innerWidth - panelW - 10);
            const minTop = 10;
            const maxTop = Math.max(minTop, window.innerHeight - headerH - 10);

            return {
                left: Math.max(minLeft, Math.min(maxLeft, left)),
                top: Math.max(minTop, Math.min(maxTop, top))
            };
        };

        if (window.$ && typeof window.$.fn.draggable === "function") {
            window.$(panelEl).draggable({
                handle: ".r20-panel-header",
                // 移除内置的 containment: "window"，避免其用展开后的 panel 整体高度将标题栏卡死在半空中
                drag: (event, ui) => {
                    const clamped = clampPosition(ui.position.left, ui.position.top);
                    ui.position.left = clamped.left;
                    ui.position.top = clamped.top;

                    if (onDragging) onDragging(clamped.left, clamped.top);
                },
                stop: (event, ui) => {
                    const clamped = clampPosition(ui.position.left, ui.position.top);
                    panelEl.style.left = `${clamped.left}px`;
                    panelEl.style.top = `${clamped.top}px`;
                    panelEl.style.bottom = "auto";
                    panelEl.style.right = "auto";
                    if (onDragEnd) onDragEnd(clamped.left, clamped.top);
                }
            });
            return;
        }

        // 降级原生 DOM 拖拽方案（同样以标题栏为边界）
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
                const clamped = clampPosition(initialLeft + dx, initialTop + dy);

                panelEl.style.left = `${clamped.left}px`;
                panelEl.style.top = `${clamped.top}px`;
                panelEl.style.bottom = "auto";
                panelEl.style.right = "auto";

                if (onDragging) onDragging(clamped.left, clamped.top);
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
 * 状态Buff工作台主控制器（SSOT 单一真实数据源 + 宿主原生能力驱动）
 * 1. 唯一真实数据源：=== R20_SUITE_DATABASE === 角色卡，面板直接基于角色卡引用；
 * 2. 窗口拖拽直接调用宿主 jQuery UI window.$(el).draggable()；
 * 3. 树形折叠直接采用 HTML5 原生 <details><summary>，0 行手写监听；
 * 4. 垂直上下排版（上栏模板库，下栏当前单位）；
 * 5. 标题栏「✏️ 编辑」模式切换，点击整行高亮多选（彻底拔除 Checkbox）；
 * 6. 属性变动事件 + 签名心跳比对双重保障，100% 实时无感同步。
 */








class BuffFloatingPanel {
    static POS_KEY = "r20_suite_buff_panel_pos";
    static PIN_KEY = "r20_suite_buff_panel_pinned";

    static panelEl = null;
    static isPinned = false;
    static isCollapsed = false;
    static isEditMode = false;
    static currentTemplates = [];
    static selectedNodeIds = new Set();
    static isInternalSaving = false;
    static _dbWatcherBound = false;
    static _dbSyncTimer = null;
    static _lastSignature = "";
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
        this.updateLayoutDirection();

        BuffPanelDragDrop.initWindowDrag(
            this.panelEl,
            () => this.savePosition(),
            () => this.updateLayoutDirection()
        );

        this.initHoverCollapse();
        this.initSelectionListeners();
        this.initDatabaseCharacterWatcher();

        window.addEventListener("resize", () => this.updateLayoutDirection());

        // 初始渲染两栏
        await this.renderAllPanes();
        this.updateLayoutDirection();

        // 绑定底部放置兜底（移动至根目录）
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        BuffPanelDragDrop.setupTreeContainerDrop({
            el: templateTree,
            getDraggedContext: () => this._draggedContext,
            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
            onCrossCopyRoot: async (draggedNode) => {
                await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                await this.renderTemplatePane();
            },
            onReorderRoot: async (draggedNode, sourceList, sourceIdx) => {
                sourceList.splice(sourceIdx, 1);
                this.currentTemplates.push(draggedNode);
                await SuiteConfigStore.saveTopology(this.currentTemplates);
                await this.renderTemplatePane();
            }
        });

        console.log("[BuffFloatingPanel] SSOT 极简工作台初始化就绪 (整行高亮多选 + 实时同步)");
    }

    /**
     * 构建面板主 DOM (垂直上下双栏排版)
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
                        <button class="r20-btn-icon danger btn-delete-selected" title="删除选中的Buff">🗑️ 批量删除</button>
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
        panel.querySelector(".btn-refresh-templates").addEventListener("click", () => this.renderTemplatePane(true));
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog(null));
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
    static async toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        this.panelEl.classList.toggle("is-editing", this.isEditMode);
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        if (editBtn) {
            editBtn.classList.toggle("active", this.isEditMode);
            editBtn.textContent = this.isEditMode ? "🔒 完成" : "✏️ 编辑";
        }

        // 无论是进入还是退出编辑模式，始终清空多选状态与高亮
        this.selectedNodeIds.clear();
        this.updateDeleteButtonText();

        // 重新渲染全部窗口：让模板栏与单位栏同步响应编辑模式切换
        await this.renderAllPanes();

        this.showToast(this.isEditMode ? "✏️ 已进入编辑模式（点击条目高亮多选，可批量删除/编辑）" : "🔒 已退出编辑模式", "info");
    }

    /**
     * 更新批量删除按钮文本与数字
     */
    static updateDeleteButtonText() {
        const btn = this.panelEl.querySelector(".btn-delete-selected");
        if (!btn) return;
        const count = this.selectedNodeIds.size;
        btn.textContent = count > 0 ? ("🗑️ 删除选中 (" + count + ")") : "🗑️ 批量删除";
    }

    /**
     * 极简事件委托：非编辑模式直接应用；编辑模式点击整行切换高亮多选
     */
    static initPaneEvents() {
        const templateTree = this.panelEl.querySelector(".r20-template-tree");
        const unitTree = this.panelEl.querySelector(".r20-unit-tree");

        // 模板栏点击
        templateTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            if (e.target.closest(".btn-edit-buff")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const selectId = item.dataset.selectId || `t_${item.dataset.id}`;

            // 编辑模式下点击整行切换高亮多选
            if (this.isEditMode) {
                if (this.selectedNodeIds.has(selectId)) {
                    this.selectedNodeIds.delete(selectId);
                    item.classList.remove("selected");
                } else {
                    this.selectedNodeIds.add(selectId);
                    item.classList.add("selected");
                }
                this.updateDeleteButtonText();
                return;
            }

            // 非编辑模式下点击直接施加/移除
            const name = item.dataset.name;
            const rounds = item.dataset.rounds ? parseInt(item.dataset.rounds) : null;
            const extraAttrs = item._extraAttrs || null;

            await this.toggleBuffOnSelected(name, rounds, extraAttrs);
        });

        // 单位栏点击
        unitTree.addEventListener("click", async (e) => {
            if (e.target.closest("summary")) return;
            if (e.target.closest(".btn-edit-buff")) return;

            const item = e.target.closest(".r20-tree-item");
            if (!item) return;

            const charId = item.dataset.charId;
            const buffId = item.dataset.buffId;
            const buffName = item.dataset.name;
            const tokenId = item.dataset.tokenId;
            const selectId = item.dataset.selectId;

            // 编辑模式下用于整行高亮多选（用于批量物理删除）
            if (this.isEditMode) {
                if (selectId) {
                    if (this.selectedNodeIds.has(selectId)) {
                        this.selectedNodeIds.delete(selectId);
                        item.classList.remove("selected");
                    } else {
                        this.selectedNodeIds.add(selectId);
                        item.classList.add("selected");
                    }
                    this.updateDeleteButtonText();
                }
                return;
            }

            // 非编辑模式下日常双向开关切换（已激活->关停，未激活->开启）
            if (charId && buffId) {
                const char = window.Campaign?.characters?.get(charId);
                if (char) {
                    const currentlyActive = item.classList.contains("full-active");
                    const targetState = !currentlyActive;
                    await Pf1eBuffManager.toggleBuff(char, buffId, targetState);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast(`已${targetState ? "✨ 激活" : "❌ 关停"} ${char.get("name")} 的 [${buffName}]`, "info");
                }
            } else if (tokenId && buffName) {
                const token = Roll20Bridge.getTokenGraphic(tokenId);
                if (token) {
                    TokenBuffManager.removeBuff(token, buffName);
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast("已从 Token 移除 [" + buffName + "]", "info");
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
     * 调出 Buff 编辑/新建弹窗 (支持模板与角色卡原生 Buff)
     */
    static showBuffEditorDialog(existingNode = null, charTarget = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null && existingNode.rounds !== undefined ? existingNode.rounds : "";
        const currentJson = isEditing
            ? JSON.stringify(existingNode.extraAttrs || {}, null, 2)
            : `{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        const headerTitle = isEditing
            ? (charTarget ? `编辑单位 Buff: ${charTarget.get("name")}` : "编辑 Buff 模板")
            : "新建 Buff 模板";

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${headerTitle}</div>
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

            this.isInternalSaving = true;
            try {
                if (isEditing) {
                    if (charTarget) {
                        // 1. 编辑角色卡身上的原生 Buff
                        const rowId = existingNode.rowId || existingNode.id;
                        await Pf1eBuffManager.updateBuffRow(charTarget, rowId, name, rounds, extraAttrs);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 " + charTarget.get("name") + " 的 Buff [" + name + "]", "success");
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        // 2. 编辑模板库中的 Buff 模板
                        const rowId = existingNode.rowId || existingNode.id;
                        await SuiteConfigStore.updateBuffInDatabase(rowId, name, rounds, extraAttrs);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 Buff 模板 [" + name + "]", "success");
                        await this.renderTemplatePane();
                    }
                } else {
                    const newRowId = await SuiteConfigStore.addBuffToDatabase(name, rounds, extraAttrs);
                    if (newRowId) {
                        this.currentTemplates.push({
                            id: newRowId,
                            rowId: newRowId,
                            type: "buff",
                            name,
                            rounds,
                            extraAttrs
                        });
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                    }
                    this.showToast("✨ 已创建 Buff [" + name + "]", "success");
                    await this.renderTemplatePane();
                }
                mask.remove();
            } finally {
                setTimeout(() => { this.isInternalSaving = false; }, 300);
            }
        });
    }

    /**
     * 极简新建目录（保存至拓扑属性）
     */
    static async createFolderPrompt() {
        const folderName = prompt("请输入新目录名称:");
        if (!folderName || !folderName.trim()) return;

        this.currentTemplates.push({
            id: "f_" + Math.random().toString(36).substr(2, 6),
            type: "folder",
            name: folderName.trim(),
            children: []
        });

        await SuiteConfigStore.saveTopology(this.currentTemplates);
        await this.renderTemplatePane();
        this.showToast("📁 目录 [" + folderName.trim() + "] 创建成功", "success");
    }

    /**
     * 全域原子批量物理删除选中的 Buff 条目（同时支持模板库与角色卡原生 repeating 属性彻底销毁）
     */
    static async deleteSelectedTemplates() {
        if (this.selectedNodeIds.size === 0) {
            this.showToast("⚠️ 请先在列表中点击要删除的 Buff 条目以高亮选中", "warn");
            return;
        }

        const count = this.selectedNodeIds.size;
        if (!confirm("确定要彻底销毁选中的 " + count + " 个 Buff 项吗？\n(包含角色卡身上的原生Buff也将物理彻底抹除)")) return;

        this.isInternalSaving = true;

        for (const selectId of this.selectedNodeIds) {
            if (selectId.startsWith("t_")) {
                // 模板库项: t_{rowId}
                const rowId = selectId.substring(2);
                await SuiteConfigStore.deleteBuffFromDatabase(rowId);
            } else if (selectId.startsWith("u_")) {
                // 角色卡原生 Buff: u_{charId}_{rowId}
                const raw = selectId.substring(2);
                const firstUnder = raw.indexOf("_");
                if (firstUnder !== -1) {
                    const charId = raw.substring(0, firstUnder);
                    const rowId = raw.substring(firstUnder + 1);
                    const char = window.Campaign?.characters?.get(charId);
                    if (char) {
                        await Pf1eBuffManager.deleteBuffRowPermanently(char, rowId);
                    }
                }
            } else if (selectId.startsWith("k_")) {
                // 野怪 Token 项: k_{tokenId}_{buffName}
                const raw = selectId.substring(2);
                const firstUnder = raw.indexOf("_");
                if (firstUnder !== -1) {
                    const tokenId = raw.substring(0, firstUnder);
                    const buffName = decodeURIComponent(raw.substring(firstUnder + 1));
                    const token = Roll20Bridge.getTokenGraphic(tokenId);
                    if (token) {
                        TokenBuffManager.removeBuff(token, buffName);
                    }
                }
            } else {
                // 兼容纯 rowId
                await SuiteConfigStore.deleteBuffFromDatabase(selectId);
            }
        }

        this.selectedNodeIds.clear();
        this.updateDeleteButtonText();
        this.isInternalSaving = false;

        await this.renderAllPanes();
        await Pf1eBuffUI.refreshAllBadges();
        this.showToast("🗑️ 已彻底物理销毁 " + count + " 项 Buff", "success");
    }

    /**
     * 渲染全部窗格
     */
    static async renderAllPanes() {
        await this.renderTemplatePane();
        await this.renderUnitPane();
    }

    /**
     * 渲染模板库（现场从角色卡直接读取，SSOT 单一真实源）
     */
    static async renderTemplatePane(showNotice = false) {
        const container = this.panelEl.querySelector(".r20-template-tree");
        if (!container) return;

        try {
            // 直接现场读取角色卡最新数据
            const templates = await SuiteConfigStore.loadTemplates();
            this.currentTemplates = templates;

            if (templates.length === 0) {
                container.innerHTML = '<div class="r20-empty-placeholder">暂无模板数据<br>点击上方「✏️ 编辑」再点「+ Buff」新建</div>';
                return;
            }

            const selectedTokens = this.getSelectedTokens();
            const { activeStats } = await this.getBuffStatsForSelected(selectedTokens);

            container.innerHTML = "";
            this.renderTemplateNodes(templates, container, activeStats, selectedTokens);

            if (showNotice) this.showToast("🔄 模板库已与原生卡完全同步", "success");
        } catch (e) {
            console.error("[BuffFloatingPanel] 渲染模板库异常:", e);
        }
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
                summary.innerHTML = "<span>📁 " + node.name + "</span>";
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
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                        await this.renderTemplatePane();
                    }
                });
            } else {
                const rowId = node.rowId || node.id;
                const selectId = `t_${rowId}`;
                const stat = activeStats.get(node.name);
                // 编辑模式下不渲染 Token 激活态高亮，确保编辑视图纯净无干扰
                const isFull = !this.isEditMode && selectedTokens.length > 0 && stat && stat.count === stat.total;
                const isPartial = !this.isEditMode && selectedTokens.length > 0 && stat && stat.count > 0 && !isFull;
                const isSelected = this.isEditMode && (this.selectedNodeIds.has(selectId) || this.selectedNodeIds.has(rowId));

                const item = document.createElement("div");
                item.className = "r20-tree-item" + 
                    (isSelected ? " selected" : "") +
                    (isFull ? " full-active" : isPartial ? " partial-active" : "");
                item.dataset.name = node.name;
                item.dataset.id = rowId;
                item.dataset.selectId = selectId;
                if (node.rounds) item.dataset.rounds = node.rounds;
                item._extraAttrs = node.extraAttrs || null;
                item.draggable = true;

                const roundsText = (node.rounds !== null && node.rounds !== undefined && node.rounds !== "") ? (node.rounds + "轮") : "永久";

                item.innerHTML = `
                    <div class="r20-item-left">
                        <span class="r20-item-name">${node.name}</span>
                        <span class="r20-item-rounds">${roundsText}</span>
                    </div>
                    <div class="r20-item-actions">
                        ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                    </div>
                `;

                if (this.isEditMode) {
                    item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.showBuffEditorDialog(node);
                    });
                }

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
                        await SuiteConfigStore.saveTopology(this.currentTemplates);
                        await this.renderTemplatePane();
                    }
                });
            }
        });
    }

    /**
     * 渲染右侧单位栏（按 Token 原生 details 分组，直观对称，严格权限过滤）
     */
    static async renderUnitPane() {
        const container = this.panelEl.querySelector(".r20-unit-tree");
        if (!container) return;

        const allSelectedTokens = this.getSelectedTokens();
        if (allSelectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder">未选中任何地图单位<br>在画布上点击或多选 Token</div>';
            return;
        }

        // 严格权限过滤：非 GM 玩家只能查看和操作自己拥有控制权的 Token
        const selectedTokens = allSelectedTokens.filter(t => Roll20Bridge.canControlToken(t.token));

        if (selectedTokens.length === 0) {
            container.innerHTML = '<div class="r20-empty-placeholder" style="color:#ef5350;">🔒 无控制权限<br>仅能查看受控角色或伙伴的 Buff</div>';
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
            summary.innerHTML = "<span>🛡️ " + tokenName + "</span>";
            details.appendChild(summary);

            const content = document.createElement("div");
            content.className = "r20-group-content";

            if (char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(char);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(卡上暂无配置Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        const isEnabled = !!b.enabled;
                        const selectId = `u_${char.id}_${b.rowId}`;
                        const isSelected = this.isEditMode && this.selectedNodeIds.has(selectId);

                        item.className = "r20-tree-item" + 
                            (isSelected ? " selected" : "") +
                            (isEnabled ? " full-active" : " is-inactive");
                        item.dataset.charId = char.id;
                        item.dataset.buffId = b.rowId;
                        item.dataset.selectId = selectId;
                        item.dataset.name = b.name;
                        item.title = this.isEditMode ? "编辑模式: 点击选中/取消选中" : (isEnabled ? "已激活，点击关停" : "未激活，点击开启");
                        item.draggable = true;

                        const roundsText = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? (b.rounds + "轮") : "永久";
                        const statusBadge = isEnabled
                            ? `<span class="r20-item-rounds" style="color:#90caf9;">${roundsText}</span>`
                            : `<span class="r20-item-rounds" style="color:#78909c;">未激活</span>`;

                        item.innerHTML = `
                            <div class="r20-item-left">
                                <span class="r20-item-name">${b.name}</span>
                                ${statusBadge}
                            </div>
                            <div class="r20-item-actions">
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                            </div>
                        `;

                        if (this.isEditMode) {
                            item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.showBuffEditorDialog(b, char);
                            });
                        }

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
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                                if (newRowId) {
                                    await this.renderTemplatePane();
                                }
                            }
                        });
                    });
                }
            } else if (tokenItem.token) {
                const buffs = TokenBuffManager.getTokenBuffs(tokenItem.token);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(暂无激活Buff)</div>';
                } else {
                    buffs.forEach(b => {
                        const item = document.createElement("div");
                        const selectId = `k_${tokenItem.token.id}_${encodeURIComponent(b.name)}`;
                        const isSelected = this.isEditMode && this.selectedNodeIds.has(selectId);

                        item.className = "r20-tree-item full-active" + (isSelected ? " selected" : "");
                        item.dataset.tokenId = tokenItem.token.id;
                        item.dataset.name = b.name;
                        item.dataset.selectId = selectId;
                        item.title = this.isEditMode ? "编辑模式: 点击选中/取消选中" : "已激活，点击移除";
                        item.draggable = true;

                        const roundsText = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? (b.rounds + "轮") : "永久";

                        item.innerHTML = `
                            <div class="r20-item-left">
                                <span class="r20-item-name">${b.name}</span>
                                <span class="r20-item-rounds" style="color:#90caf9;">${roundsText}</span>
                            </div>
                            <div class="r20-item-actions">
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-buff" title="编辑细目">✏️</button>` : ""}
                            </div>
                        `;

                        if (this.isEditMode) {
                            item.querySelector(".btn-edit-buff")?.addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.showBuffEditorDialog(b, null);
                            });
                        }

                        content.appendChild(item);

                        BuffPanelDragDrop.setupItemDrag({
                            el: item,
                            node: b,
                            parentList: null,
                            index: 0,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs);
                                if (newRowId) {
                                    await this.renderTemplatePane();
                                }
                            }
                        });
                    });
                }
            } else {
                content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(无关联数据)</div>';
            }

            // 支持从模板库拖拽至单位分组直接施加 Buff
            details.addEventListener("dragover", (e) => {
                const dragged = this._draggedContext;
                if (dragged && dragged.sourcePane === "template") {
                    e.preventDefault();
                    details.classList.add("r20-drag-container-over");
                }
            });
            details.addEventListener("dragleave", (e) => {
                if (!details.contains(e.relatedTarget)) {
                    details.classList.remove("r20-drag-container-over");
                }
            });
            details.addEventListener("drop", async (e) => {
                const dragged = this._draggedContext;
                if (dragged && dragged.sourcePane === "template") {
                    e.preventDefault();
                    details.classList.remove("r20-drag-container-over");
                    const node = dragged.node;
                    if (char) {
                        await Pf1eBuffManager.applyOrRefreshBuff(char, node.name, node.rounds, node.extraAttrs);
                    } else if (tokenItem.token) {
                        TokenBuffManager.applyOrRefreshBuff(tokenItem.token, node.name, node.rounds, node.extraAttrs);
                    }
                    this._draggedContext = null;
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderAllPanes();
                    this.showToast(`✨ 已为 [${tokenName}] 施加 Buff [${node.name}]`, "success");
                }
            });

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
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                } else {
                    const buffs = await Pf1eBuffManager.getAllBuffs(item.char);
                    const b = buffs.find(x => x.name === buffName && x.enabled);
                    if (b) {
                        await Pf1eBuffManager.removeBuff(item.char, b.rowId);
                    }
                }
            } else if (item.token) {
                if (shouldApply) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                } else {
                    TokenBuffManager.removeBuff(item.token, buffName);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        await this.renderAllPanes();
        this.showToast((shouldApply ? "✨ 施加" : "❌ 移除") + " Buff [" + buffName + "]", "success");
    }

    /**
     * 统计当前选中 Token 对特定 Buff 的激活覆盖率
     */
    static async getBuffStatsForSelected(selectedTokens) {
        const activeStats = new Map();
        if (selectedTokens.length === 0) return { activeStats };

        for (const item of selectedTokens) {
            let activeBuffs = [];
            if (item.char) {
                activeBuffs = await Pf1eBuffManager.getActiveBuffs(item.char);
            } else if (item.token) {
                activeBuffs = TokenBuffManager.getTokenBuffs(item.token);
            }
            activeBuffs.forEach(b => {
                const cur = activeStats.get(b.name) || { count: 0, total: selectedTokens.length };
                cur.count++;
                activeStats.set(b.name, cur);
            });
        }
        return { activeStats };
    }

    /**
     * 监听数据库角色卡属性变动（事件绑定 + 签名比对双重保障）
     */
    static initDatabaseCharacterWatcher() {
        if (this._dbWatcherBound) return;
        this._dbWatcherBound = true;

        const attachToChar = (char) => {
            if (!char) return;

            const bindEvents = () => {
                if (!char.attribs) return;
                char.attribs.on("add change remove reset", () => {
                    if (this.isInternalSaving) return;
                    if (this._dbSyncTimer) clearTimeout(this._dbSyncTimer);
                    this._dbSyncTimer = setTimeout(async () => {
                        if (this.isInternalSaving) return;
                        await this.renderTemplatePane();
                    }, 150);
                });
            };

            bindEvents();
            if (typeof char.connectAttributesAndAbilities === "function" && (!char.attribs || char.attribs.length === 0)) {
                char.connectAttributesAndAbilities().then(() => bindEvents());
            }
        };

        const dbChar = SuiteConfigStore.findDatabaseCharacter();
        if (dbChar) attachToChar(dbChar);

        if (window.Campaign?.characters) {
            window.Campaign.characters.on("add", (c) => {
                if (c.get("name") === SuiteConfigStore.DATABASE_CHARACTER_NAME) attachToChar(c);
            });
        }

        // 双重保障守护心跳：每 1.2 秒比对一次卡上 repeating_buff2 签名，确保跨 iframe 或外部变更 100% 自动无缝感知
        setInterval(async () => {
            if (this.isInternalSaving) return;
            const targetChar = SuiteConfigStore.findDatabaseCharacter();
            if (!targetChar || !targetChar.attribs) return;

            const buffAttrs = targetChar.attribs.models.filter(a => {
                const n = a.get("name") || "";
                return n.startsWith("repeating_buff2_") && (n.endsWith("_name") || n.endsWith("_rounds"));
            });

            const sig = buffAttrs.map(a => a.get("name") + "=" + a.get("current")).sort().join(";");
            if (sig !== this._lastSignature) {
                if (this._lastSignature !== "") {
                    console.log("[BuffFloatingPanel] 检测到角色卡数据变动，触发自愈刷新...");
                    await this.renderTemplatePane();
                }
                this._lastSignature = sig;
            }
        }, 1200);
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

        // 只要标题栏处于屏幕下半区，为了防止内容向下溢出视口，始终向上展开
        if (headerTop > windowHeight / 2) {
            this.panelEl.classList.remove("direction-down");
            this.panelEl.classList.add("direction-up");
        } else {
            this.panelEl.classList.remove("direction-up");
            this.panelEl.classList.add("direction-down");
        }
    }

    /**
     * 恢复持久化位置并立即更新生长朝向
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
        this.updateLayoutDirection();
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
                observer.on("turnEnded", async ({ endedTokenId, startedTokenId, isLocalUserAction }) => {
                    // 仅当本地是 GM 且亲手点击了先攻前进时，才执行扣减！
                    if (Roll20Bridge.isGM() && isLocalUserAction) {
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
                    }
                    // 统一通过便签板只读刷新画面（微任务合并，绝不触碰数据）
                    Pf1eBuffUI.requestTokenRefresh(endedTokenId);
                    await BuffFloatingPanel.renderAllPanes();
                });

                observer.on("turnReverted", async ({ revertedTokenId, isLocalUserAction }) => {
                    // 仅当本地是 GM 且亲手点击了先攻回退时，才执行加回！
                    if (Roll20Bridge.isGM() && isLocalUserAction) {
                        try {
                            const tokenGraphic = Roll20Bridge.getTokenGraphic(revertedTokenId);
                            if (tokenGraphic) {
                                const character = Roll20Bridge.getCharacterByToken(tokenGraphic);
                                if (character) {
                                    await Pf1eBuffManager.incrementBuffsOnTurnRevert(character);
                                } else {
                                    TokenBuffManager.incrementBuffsOnTurnRevert(tokenGraphic);
                                }
                            }
                        } catch (err) {
                            console.error("[Roll20Suite] 先攻回退加回轮数异常:", err);
                        }
                    }
                    Pf1eBuffUI.requestTokenRefresh(revertedTokenId);
                    await BuffFloatingPanel.renderAllPanes();
                });

                observer.on("orderChanged", async () => {
                    await Pf1eBuffUI.refreshAllBadges();
                    await BuffFloatingPanel.renderAllPanes();
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

            // 4. 挂载命名空间供外部或开发者排查联动
            window.Roll20Suite = {
                Roll20Bridge,
                Pf1eBuffManager,
                SuiteConfigStore,
                TurnOrderObserver,
                TokenBuffManager,
                Pf1eBuffUI,
                BuffFloatingPanel
            };

            console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.9.16 全部就绪！");
        } catch (fatalErr) {
            console.error("[Roll20Suite] 引擎主入口遭遇致命异常:", fatalErr);
        }
    }

    main().catch(e => console.error("[Roll20Suite] main 未捕获 Promise 异常:", e));
})();
