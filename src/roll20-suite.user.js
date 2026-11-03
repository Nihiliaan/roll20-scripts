// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/Nihiliaan/roll20-scripts
// @version      0.9.25
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

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.9.25...");

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

    /**
     * 借用 Roll20 原生骰子与宏管道计算公式
     * @param {string} formula 例如 "10", "@{level}", "10 + @{constitution_mod}", "[[1d4 + 1]]"
     * @param {object} character 目标角色卡模型
     * @returns {Promise<number|null>} 计算出的数值（非负整数轮数）
     */
    static async evalNativeFormula(formula, character = null) {
        if (!formula && formula !== 0) return null;
        let str = String(formula).trim();
        if (!str) return null;

        // 1. 若纯为数字，直接返回
        if (!isNaN(Number(str))) {
            return Math.max(0, Math.round(Number(str)));
        }

        // 2. 借用角色卡属性展开 @{attribute_name}
        if (character && character.attribs) {
            await this.ensureCharacterAttributes(character);
            for (let depth = 0; depth < 5; depth++) {
                const match = str.match(/@\{([^}]+)\}/);
                if (!match) break;
                const rawAttr = match[1].trim();
                const cleanAttrName = rawAttr.replace(/^(selected|target)\|/i, "");
                const attr = character.attribs.models.find(a => a.get("name") === cleanAttrName);
                const val = attr ? String(attr.get("current") ?? 0) : "0";
                str = str.replace(match[0], val);
            }
        }

        // 3. 剥离外层中括号 [[ ... ]]
        str = str.replace(/\[\[/g, "(").replace(/\]\]/g, ")").trim();

        // 4. 原生骰子引擎计算通道：优先调用 Roll20 原生 d20.textchat.diceengine
        const diceEngine = window.d20?.textchat?.diceengine;
        if (diceEngine && typeof diceEngine.process === "function") {
            try {
                const result = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("原生骰子引擎求值超时")), 1500);
                    try {
                        diceEngine.process(str, (res) => {
                            clearTimeout(timeout);
                            const total = res?.total ?? (typeof res === "number" ? res : null);
                            resolve(total);
                        }, (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                    } catch (e) {
                        clearTimeout(timeout);
                        reject(e);
                    }
                });
                if (result !== null && !isNaN(result)) {
                    return Math.max(0, Math.round(result));
                }
            } catch (err) {
                console.warn("[Roll20Bridge] 原生骰子引擎计算异常，使用安全回退:", err);
            }
        }

        // 5. 原生受限数学运算兜底
        try {
            const sanitized = str.replace(/[^0-9+\-*/().%\s,]/g, "");
            const evalFn = new Function("Math", `return (${sanitized});`);
            const val = evalFn(Math);
            if (!isNaN(val)) {
                return Math.max(0, Math.round(val));
            }
        } catch (e) {
            console.warn("[Roll20Bridge] 公式求值最终失败:", str, e);
        }

        return null;
    }
}

    // ==========================================
    // 2. Pf1eConditionRegistry (PF1e 完全状态注册表与标记字典)
    // ==========================================
/**
 * Pf1eConditionRegistry.js
 * 严格按照 Pathfinder 1e 核心规则书 (CRB, Appendix 1: Conditions) 整理的完全状态注册表
 * 集中管理状态元数据、角色卡属性映射、战役自定义棋子标记 (Token Markers) 与中文规则悬浮提示
 */

const PF1E_CONDITIONS = {
    "bleed": {
        id: "bleed",
        nameZh: "流血",
        nameEn: "Bleed",
        isNativeSheet: true,
        attrKey: "condition-Bleed",
        roundsKey: "condition-Bleed_rounds",
        markerName: "Bleeding Out",
        fallbackMarker: "death-zone",
        aliases: ["Bleeding Out", "Bleeding_Out", "Bleed", "death-zone"],
        description: "每轮开始受持续伤害，直至受DC 15医疗检定或治疗法术"
    },
    "blinded": {
        id: "blinded",
        nameZh: "目盲",
        nameEn: "Blinded",
        isNativeSheet: true,
        attrKey: "condition-Blinded",
        roundsKey: "condition-Blinded_rounds",
        markerName: "Blinded",
        fallbackMarker: "bleeding-eye",
        aliases: ["Blinded", "Blind", "bleeding-eye"],
        description: "AC -2，失去敏捷加值，察觉检定自动失败，全隐蔽(50%失手)"
    },
    "confused": {
        id: "confused",
        nameZh: "困惑",
        nameEn: "Confused",
        isNativeSheet: false, // CRB 核心状态，卡面无原生复选框
        attrKey: "custom_cond_confused",
        roundsKey: "custom_cond_confused_rounds",
        markerName: "Confused",
        fallbackMarker: "brain-freeze",
        aliases: ["Confused", "brain-freeze"],
        description: "无法自主行动，每轮掷 d100 决定行为(攻击盟友/发呆/正常)"
    },
    "cowering": {
        id: "cowering",
        nameZh: "畏縮",
        nameEn: "Cowering",
        isNativeSheet: true,
        attrKey: "condition-Cowering",
        roundsKey: "condition-Cowering_rounds",
        markerName: "Cowering",
        fallbackMarker: "broken-skull",
        aliases: ["Cowering", "broken-skull"],
        description: "极度恐惧冻结，AC -2，失去敏捷加值，无法采取任何动作"
    },
    "dazed": {
        id: "dazed",
        nameZh: "暈眩",
        nameEn: "Dazed",
        isNativeSheet: true,
        attrKey: "condition-Dazed",
        roundsKey: "condition-Dazed_rounds",
        markerName: "half-haze",
        fallbackMarker: "half-haze",
        aliases: ["Dazed", "half-haze"],
        description: "无法采取任何动作，AC 不受直接减值"
    },
    "dazzled": {
        id: "dazzled",
        nameZh: "目眩",
        nameEn: "Dazzled",
        isNativeSheet: true,
        attrKey: "condition-Dazzled",
        roundsKey: "condition-Dazzled_rounds",
        markerName: "aura",
        fallbackMarker: "aura",
        aliases: ["Dazzled", "aura"],
        description: "强光致盲，攻击检定与视力察觉检定承受 -1 减值"
    },
    "dead": {
        id: "dead",
        nameZh: "死亡",
        nameEn: "Dead",
        isNativeSheet: true,
        attrKey: "condition-Dead",
        roundsKey: "condition-Dead_rounds",
        markerName: "006-Dead",
        fallbackMarker: "dead",
        aliases: ["006-Dead", "dead", "skull"],
        description: "生命值降至负体质值以下，无法行动与自行恢复"
    },
    "deafened": {
        id: "deafened",
        nameZh: "耳聾",
        nameEn: "Deafened",
        isNativeSheet: true,
        attrKey: "condition-Deafened",
        roundsKey: "condition-Deafened_rounds",
        markerName: "Deafened",
        fallbackMarker: "edge-crack",
        aliases: ["Deafened", "edge-crack"],
        description: "先攻检定 -4，听力察觉自动失败，言语成分法术 20% 失败率"
    },
    "disabled": {
        id: "disabled",
        nameZh: "癱瘓",
        nameEn: "Disabled",
        isNativeSheet: true,
        attrKey: "condition-Disabled",
        roundsKey: "condition-Disabled_rounds",
        markerName: "Disabled",
        fallbackMarker: "snail",
        aliases: ["Disabled", "snail"],
        description: "生命恰为 0，每轮只能做单个移动或标动，做标动受 1 伤害转濒死"
    },
    "drowning": {
        id: "drowning",
        nameZh: "溺水",
        nameEn: "Drowning",
        isNativeSheet: true,
        attrKey: "condition-Drowning",
        roundsKey: "condition-Drowning_rounds",
        markerName: "bubble",
        fallbackMarker: "bubble",
        aliases: ["Drowning", "bubble"],
        description: "溺水缺氧，无法呼吸，陷入昏迷与濒死"
    },
    "dying": {
        id: "dying",
        nameZh: "瀕死",
        nameEn: "Dying",
        isNativeSheet: true,
        attrKey: "condition-Dying",
        roundsKey: "condition-Dying_rounds",
        markerName: "half-heart",
        fallbackMarker: "half-heart",
        aliases: ["Dying", "half-heart"],
        description: "生命值为负，处于昏迷无助，每轮需体质检定否则流失生命"
    },
    "entangled": {
        id: "entangled",
        nameZh: "糾纏",
        nameEn: "Entangled",
        isNativeSheet: true,
        attrKey: "condition-Entangled",
        roundsKey: "condition-Entangled_rounds",
        markerName: "Entangle",
        fallbackMarker: "fishing-net",
        aliases: ["Entangle", "Entangled", "601-Entangled-Grappled", "fishing-net"],
        description: "移动半速无法奔跑，敏捷 -4，攻击检定 -2，施法需集中检定"
    },
    "exhausted": {
        id: "exhausted",
        nameZh: "力竭",
        nameEn: "Exhausted",
        isNativeSheet: true,
        attrKey: "condition-Exhausted",
        roundsKey: "condition-Exhausted_rounds",
        markerName: "Exhausted",
        fallbackMarker: "broken-shield",
        aliases: ["Exhausted", "broken-shield"],
        description: "移动半速，力量和敏捷受到 -6 减值，休息 1 小时转为疲乏"
    },
    "fascinated": {
        id: "fascinated",
        nameZh: "迷魂",
        nameEn: "Fascinated",
        isNativeSheet: true,
        attrKey: "condition-Fascinated",
        roundsKey: "condition-Fascinated_rounds",
        markerName: "Charmed",
        fallbackMarker: "all-for-one",
        aliases: ["Fascinated", "Charmed", "all-for-one"],
        description: "驻足注视目标，察觉等技能受到 -4 减值，受到潜在威胁解除"
    },
    "fatigued": {
        id: "fatigued",
        nameZh: "疲乏",
        nameEn: "Fatigued",
        isNativeSheet: true,
        attrKey: "condition-Fatigued",
        roundsKey: "condition-Fatigued_rounds",
        markerName: "Fatigued",
        fallbackMarker: "back-pain",
        aliases: ["Fatigued", "back-pain"],
        description: "无法奔跑或冲锋，力量和敏捷受到 -2 减值，休息 8 小时解除"
    },
    "flat_footed": {
        id: "flat_footed",
        nameZh: "措手不及",
        nameEn: "Flat-Footed",
        isNativeSheet: true,
        attrKey: "condition-Flat-Footed",
        roundsKey: "condition-Flat-Footed_rounds",
        markerName: "arrowed",
        fallbackMarker: "arrowed",
        aliases: ["Flat-Footed", "Flat_Footed", "FlatFooted", "arrowed"],
        description: "未行动前失去敏捷加值与直觉动作，无法借机攻击"
    },
    "frightened": {
        id: "frightened",
        nameZh: "恐慌",
        nameEn: "Frightened",
        isNativeSheet: true,
        attrKey: "condition-Fear",
        roundsKey: "condition-Fear_rounds",
        markerName: "Frightened",
        fallbackMarker: "screaming",
        aliases: ["Frightened", "Cause of Fear", "Cause_of_Fear", "Fear", "screaming"],
        description: "恐惧逃离源头，攻击检定/豁免/技能受到 -2 减值，无法自主接近威胁"
    },
    "grappled": {
        id: "grappled",
        nameZh: "擒抱",
        nameEn: "Grappled",
        isNativeSheet: true,
        attrKey: "condition-Grappled",
        roundsKey: "condition-Grappled_rounds",
        markerName: "Grappled",
        fallbackMarker: "grab",
        aliases: ["Grappled", "601-Entangled-Grappled", "grab"],
        description: "无法移动，敏捷 -4，攻击与战技检定 -2，施法需集中检定"
    },
    "helpless": {
        id: "helpless",
        nameZh: "無助",
        nameEn: "Helpless",
        isNativeSheet: true,
        attrKey: "condition-Helpless",
        roundsKey: "condition-Helpless_rounds",
        markerName: "Helpless",
        fallbackMarker: "chained-heart",
        aliases: ["Helpless", "chained-heart"],
        description: "完全无法防卫，敏捷视同为 0 (-5 AC)，近战受击可被政变"
    },
    "incorporeal": {
        id: "incorporeal",
        nameZh: "虛體",
        nameEn: "Incorporeal",
        isNativeSheet: true,
        attrKey: "condition-Incorporeal",
        roundsKey: "condition-Incorporeal_rounds",
        markerName: "Incorporeal",
        fallbackMarker: "white-tower",
        aliases: ["Incorporeal", "white-tower"],
        description: "无实体，免疫非魔法攻击，魔法武器伤害半额，可穿透实物"
    },
    "invisible": {
        id: "invisible",
        nameZh: "隱形",
        nameEn: "Invisible",
        isNativeSheet: true,
        attrKey: "condition-Invisible",
        roundsKey: "condition-Invisible_rounds",
        markerName: "Invisible",
        fallbackMarker: "ninja-mask",
        aliases: ["Invisible", "ninja-mask"],
        description: "视觉不可见，拥有全隐蔽(50%失手)，攻击有视觉目标 +2"
    },
    "nauseated": {
        id: "nauseated",
        nameZh: "反胃",
        nameEn: "Nauseated",
        isNativeSheet: true,
        attrKey: "condition-Nauseated",
        roundsKey: "condition-Nauseated_rounds",
        markerName: "Nauseated",
        fallbackMarker: "chemical-bolt",
        aliases: ["Nauseated", "Nausea", "Sick", "chemical-bolt"],
        description: "极度胃部不适，每轮只能做单个移动动作，不可攻击或施法"
    },
    "panicked": {
        id: "panicked",
        nameZh: "驚懼",
        nameEn: "Panicked",
        isNativeSheet: false, // CRB 核心状态
        attrKey: "custom_cond_panicked",
        roundsKey: "custom_cond_panicked_rounds",
        markerName: "Panicked",
        fallbackMarker: "fluffy-wing",
        aliases: ["Panicked", "fluffy-wing"],
        description: "扔下持有物全速逃离危险，防御检定承受 -2 减值，被逼角落时陷入畏缩"
    },
    "paralyzed": {
        id: "paralyzed",
        nameZh: "麻痺",
        nameEn: "Paralyzed",
        isNativeSheet: true,
        attrKey: "condition-Paralyzed",
        roundsKey: "condition-Paralyzed_rounds",
        markerName: "Paralyzed",
        fallbackMarker: "pummeled",
        aliases: ["Paralyzed", "pummeled"],
        description: "肌肉僵直，力量敏捷视同为 0，完全无助，无法移动或发声"
    },
    "petrified": {
        id: "petrified",
        nameZh: "石化",
        nameEn: "Petrified",
        isNativeSheet: true,
        attrKey: "condition-Petrified",
        roundsKey: "condition-Petrified_rounds",
        markerName: "Petrified",
        fallbackMarker: "frozen-orb",
        aliases: ["Petrified", "frozen-orb", "interdiction"],
        description: "身躯化为石质，完全无助昏迷，硬度 8，具有伤害减免"
    },
    "pinned": {
        id: "pinned",
        nameZh: "壓制",
        nameEn: "Pinned",
        isNativeSheet: true,
        attrKey: "condition-Pinned",
        roundsKey: "condition-Pinned_rounds",
        markerName: "Pinned",
        fallbackMarker: "padlock",
        aliases: ["Pinned", "padlock"],
        description: "紧紧受制无法移动，AC -4 并失去敏捷加值，无法施展躯体法术"
    },
    "prone": {
        id: "prone",
        nameZh: "俯臥",
        nameEn: "Prone",
        isNativeSheet: true,
        attrKey: "condition-Prone",
        roundsKey: "condition-Prone_rounds",
        markerName: "Prone",
        fallbackMarker: "tread",
        aliases: ["Prone", "101-KnockedDown", "tread"],
        description: "倒地卧姿，近战攻击检定 -4，近战受击 AC -4，远程受击 AC +4"
    },
    "shaken": {
        id: "shaken",
        nameZh: "戰慄",
        nameEn: "Shaken",
        isNativeSheet: false, // CRB 核心状态
        attrKey: "custom_cond_shaken",
        roundsKey: "custom_cond_shaken_rounds",
        markerName: "Shaken",
        fallbackMarker: "broken-heart",
        aliases: ["Shaken", "broken-heart"],
        description: "轻微恐惧，攻击检定、豁免检定与技能检定承受 -2 减值"
    },
    "sickened": {
        id: "sickened",
        nameZh: "噁心",
        nameEn: "Sickened",
        isNativeSheet: true,
        attrKey: "condition-Sickened",
        roundsKey: "condition-Sickened_rounds",
        markerName: "Sickened",
        fallbackMarker: "drink-me",
        aliases: ["Sickened", "Sick", "drink-me", "three-leaves"],
        description: "身体不适恶心，攻击检定、武器伤害、豁免与技能检定承受 -2 减值"
    },
    "stable": {
        id: "stable",
        nameZh: "穩定",
        nameEn: "Stable",
        isNativeSheet: true,
        attrKey: "condition-Stable",
        roundsKey: "condition-Stable_rounds",
        markerName: "Stabilized",
        fallbackMarker: "spanner",
        aliases: ["Stabilized", "Stable", "spanner"],
        description: "濒死但伤势稳定，不再每轮流失生命，生命恢复正值前仍昏迷"
    },
    "staggered": {
        id: "staggered",
        nameZh: "恍惚",
        nameEn: "Staggered",
        isNativeSheet: true,
        attrKey: "condition-Staggered",
        roundsKey: "condition-Staggered_rounds",
        markerName: "Staggered",
        fallbackMarker: "stopwatch",
        aliases: ["Staggered", "stopwatch"],
        description: "重创踉跄，每轮只能执行单个标动或移动动作，可做直觉动作"
    },
    "stunned": {
        id: "stunned",
        nameZh: "震懾",
        nameEn: "Stunned",
        isNativeSheet: true,
        attrKey: "condition-Stunned",
        roundsKey: "condition-Stunned_rounds",
        markerName: "Stunned",
        fallbackMarker: "fist",
        aliases: ["Stunned", "fist", "lightning-helix"],
        description: "掉落持有物，无法采取动作，AC -2 并失去敏捷加值"
    },
    "suffocating": {
        id: "suffocating",
        nameZh: "窒息",
        nameEn: "Suffocating",
        isNativeSheet: true,
        attrKey: "condition-Suffocating",
        roundsKey: "condition-Suffocating_rounds",
        markerName: "bubble",
        fallbackMarker: "bubble",
        aliases: ["Suffocating", "bubble"],
        description: "严重缺氧，逐轮消耗体质，进入濒死并迅速死亡"
    },
    "unconscious": {
        id: "unconscious",
        nameZh: "昏迷",
        nameEn: "Unconscious",
        isNativeSheet: true,
        attrKey: "condition-Unconscious",
        roundsKey: "condition-Unconscious_rounds",
        markerName: "Unconcious",
        fallbackMarker: "sleepy",
        aliases: ["Unconscious", "Unconcious", "005-Unconscious", "sleepy"],
        description: "失去知觉并倒地，完全无助，无法采取任何动作"
    }
};

/**
 * 状态注册管理类
 */
class Pf1eConditionRegistry {
    /**
     * 字符串归一化（去除 ::id，替换 _ 和 - 为无符号小写纯字母）
     */
    static normalizeKey(str) {
        if (!str) return "";
        return String(str)
            .split("::")[0]
            .trim()
            .toLowerCase()
            .replace(/[_-\s]+/g, "");
    }

    /**
     * 根据任意键名、属性名、中文名、自定义 Tag 或别名匹配状态定义
     */
    static find(keyOrName) {
        if (!keyOrName) return null;
        let rawKey = String(keyOrName).trim();

        // 0. 尝试在当前战役 token_markers 中通过完整 tag 逆向获取自定义标记名称
        if (window.Campaign) {
            try {
                const markers = JSON.parse(window.Campaign.get("token_markers") || "[]");
                if (Array.isArray(markers)) {
                    const cleanTag = rawKey.replace(/@\d+$/, "");
                    const found = markers.find(m => m && (m.tag === rawKey || m.tag === cleanTag));
                    if (found && found.name) {
                        rawKey = found.name;
                    }
                }
            } catch (e) {}
        }

        const raw = rawKey.split("::")[0].trim();
        const lower = raw.toLowerCase();
        const norm = this.normalizeKey(raw);

        // 1. 直接 ID 匹配
        if (PF1E_CONDITIONS[lower]) return PF1E_CONDITIONS[lower];
        if (PF1E_CONDITIONS[norm]) return PF1E_CONDITIONS[norm];

        // 2. 遍历匹配各项属性与别名
        for (const def of Object.values(PF1E_CONDITIONS)) {
            if (def.id === lower || def.id === norm) return def;
            if (def.attrKey && (def.attrKey.toLowerCase() === lower || this.normalizeKey(def.attrKey) === norm)) return def;
            if (def.nameZh && def.nameZh === raw) return def;
            if (def.nameEn && (def.nameEn.toLowerCase() === lower || this.normalizeKey(def.nameEn) === norm)) return def;
            if (def.markerName && (def.markerName.toLowerCase() === lower || this.normalizeKey(def.markerName) === norm)) return def;
            if (def.fallbackMarker && (def.fallbackMarker.toLowerCase() === lower || this.normalizeKey(def.fallbackMarker) === norm)) return def;

            // 3. 别名列表匹配
            if (Array.isArray(def.aliases)) {
                for (const alias of def.aliases) {
                    if (alias.toLowerCase() === lower || this.normalizeKey(alias) === norm) {
                        return def;
                    }
                }
            }
        }
        return null;
    }

    /**
     * 动态匹配当前战役中可用的 Marker Tag (优先自定义 Marker，回退默认)
     * @param {string} condId 状态 ID
     * @param {Array} campaignMarkers 当前战役 Campaign.get("token_markers") 数组
     * @returns {string} 可直接写入 statusmarkers 的 Tag
     */
    static resolveMarkerTag(condId, campaignMarkers = null) {
        const def = this.find(condId);
        if (!def) return "";

        let markers = campaignMarkers;
        if (!markers && window.Campaign) {
            try {
                markers = JSON.parse(window.Campaign.get("token_markers") || "[]");
            } catch (e) {
                markers = [];
            }
        }

        // 1. 尝试在当前战役的自定义标记包中寻找匹配项 (通过 markerName 与 aliases 归一化双向匹配)
        if (Array.isArray(markers)) {
            const targets = [def.markerName, ...(def.aliases || [])].filter(Boolean);
            for (const target of targets) {
                const normTarget = this.normalizeKey(target);
                const match = markers.find(m => {
                    if (!m.name) return false;
                    return m.name.toLowerCase() === target.toLowerCase() || this.normalizeKey(m.name) === normTarget;
                });
                if (match && match.tag) {
                    return match.tag;
                }
            }
        }

        // 2. 回退到默认内置标记
        return def.fallbackMarker || def.markerName || "";
    }

    /**
     * 规范化 statusmarkers 字符串：绝不添加数字，自动滤除已有数字 (@数字)
     * @param {string} currentMarkers 当前 statusmarkers 字符串
     * @param {string} tagToAdd 拟添加的标记 Tag
     * @param {boolean} add 是否添加 (true 为添加，false 为移除)
     * @returns {string} 干净的 statusmarkers 字符串
     */
    static mutateStatusmarkers(currentMarkers, tagToAdd, add = true) {
        if (!tagToAdd) return currentMarkers || "";

        // 拆分现有标记，并一律剥离 @数字
        const existing = (currentMarkers || "")
            .split(",")
            .map(s => s.trim().replace(/@\d+$/, ""))
            .filter(Boolean);

        const cleanTag = tagToAdd.replace(/@\d+$/, "").trim();

        const tagSet = new Set(existing);
        if (add) {
            tagSet.add(cleanTag);
        } else {
            tagSet.delete(cleanTag);
            // 同时兼容无 tag 后缀的简写名称移除
            const namePart = cleanTag.split("::")[0];
            for (const item of [...tagSet]) {
                if (item === namePart || item.startsWith(`${namePart}::`)) {
                    tagSet.delete(item);
                }
            }
        }

        return Array.from(tagSet).join(",");
    }

    /**
     * 将单个 markerTag 解析为纯中文名称（精简无英文无冒号效果）
     * @param {string} tag 例如 "Blinded::6485443" 或 "skull"
     * @returns {string} 例如 "目盲"
     */
    static getTooltipForMarker(tag) {
        if (!tag) return "";
        const cleanTag = tag.split("::")[0].trim();
        const normalizedTag = cleanTag.replace(/_/g, " ");

        // 1. 尝试从 34 项核心状态注册表中匹配
        const def = this.find(cleanTag) || this.find(normalizedTag) || this.find(tag);
        if (def) {
            return def.nameZh;
        }

        // 2. 战役常见扩展 Buff/Debuff、官方经典图标与自定义包纯中文映射字典
        const EXTRA_ZH_MAP = {
            // 基础颜色球
            "red": "紅", "blue": "藍", "green": "綠", "brown": "棕",
            "purple": "紫", "pink": "粉", "yellow": "黃", "dead": "死亡",

            // 战役常见状态与法术 (支持驼峰与下划线)
            "Hex": "惡咒", "Poisoned": "中毒", "Raging": "狂暴", "Blessed": "祝福術",
            "Hasted": "加速術", "Slowed": "緩慢", "Flying": "飛行", "MageArmor": "法師護甲",
            "Shield of Faith": "虔誠之盾", "Shield_of_Faith": "虔誠之盾",
            "Bulls Strength": "公牛之力", "Bulls_Strength": "公牛之力",
            "Cats Grace": "貓之優雅", "Cats_Grace": "貓之優雅",
            "Bears Endurance": "巨熊堅韌", "Bears_Endurance": "巨熊堅韌",
            "Foxs Cunning": "狐之狡黠", "Foxs_Cunning": "狐之狡黠",
            "Owls Wisdom": "梟之睿智", "Owls_Wisdom": "梟之睿智",
            "Eagles Splendor": "鷹之光彩", "Eagles_Splendor": "鷹之光彩",
            "Advantage": "優勢", "Disadvantage": "劣勢",
            "OnFire": "著火", "Possessed": "附身", "Symbio": "共生",
            "Blink": "閃現術", "Blur": "朦朧術", "Mirror Image": "鏡像術", "Mirror_Image": "鏡像術",
            "Sanctuary": "聖域術", "Truesight": "真知術",
            "Spirit Guardians": "守護之靈", "Spirit_Guardians": "守護之靈",
            "DivineFavor": "神恩", "Stabilized": "傷勢穩定", "Unconcious": "昏迷",
            "Cause_of_Fear": "恐懼", "Cause of Fear": "恐懼",
            "Bleeding_Out": "流血", "Bleeding Out": "流血",
            "Concentration": "專注", "Petrified": "石化",
            "Slayers_Prey": "獵手印記", "Slayers Prey": "獵手印記",
            "Warding_Bond": "守護之鏈", "Warding Bond": "守護之鏈",
            "Shifted": "變形", "Natural_Armor": "天生防禦", "Natural Armor": "天生防禦",
            "Incorporeal": "虛體", "Gaze": "凝視", "Highlighted": "高亮", "Inspired": "激勵",
            "Reaction_Used": "已反應", "Reaction Used": "已反應",
            "Dodge_Action": "全迴避", "Dodge Action": "全迴避",
            "Hexblades_Curse": "咒刃詛咒", "Hexblades Curse": "咒刃詛咒",
            "Baned": "破滅術", "Mark": "標記", "cobweb": "蛛網", "flying-flag": "戰旗",
            "strong": "強韌", "bolt-shield": "護盾", "drink-me": "藥劑",

            // Roll20 原生内置经典图标
            "skull": "顱骨", "sleepy": "沉睡", "half-heart": "半心", "half-haze": "迷濛",
            "interdiction": "禁制", "snail": "緩慢", "lightning-helix": "閃電", "spanner": "扳手",
            "chained-heart": "鎖心", "chemical-bolt": "化學箭", "death-zone": "死亡領域",
            "edge-crack": "碎裂", "ninja-mask": "忍者面罩", "stopwatch": "碼錶", "fishing-net": "漁網",
            "overdrive": "超載", "fist": "重拳", "padlock": "鎖具", "three-leaves": "三葉",
            "fluffy-wing": "羽翼", "pummeled": "痛擊", "tread": "踐踏", "arrowed": "中箭",
            "aura": "光環", "back-pain": "背痛", "black-flag": "黑旗", "bleeding-eye": "流血之眼",
            "broken-heart": "碎心", "broken-shield": "破盾", "radioactive": "輻射", "trophy": "獎盃",
            "broken-skull": "碎顱", "frozen-orb": "冰球", "rolling-bomb": "炸彈", "white-tower": "白塔",
            "grab": "擒拿", "screaming": "尖叫", "grenade": "手榴彈", "sentry-gun": "哨戒砲",
            "all-for-one": "萬眾一心", "angel-outfit": "天使", "archery-target": "箭靶"
        };

        if (EXTRA_ZH_MAP[cleanTag]) return EXTRA_ZH_MAP[cleanTag];
        if (EXTRA_ZH_MAP[normalizedTag]) return EXTRA_ZH_MAP[normalizedTag];

        // 3. 自定义编号前缀处理 (如 403-Attack-Debuff -> 攻擊減值)
        if (cleanTag.includes("-")) {
            const stripped = cleanTag.replace(/^\d+-/, "");
            if (EXTRA_ZH_MAP[stripped]) return EXTRA_ZH_MAP[stripped];
        }

        // 绝不回退到 className 或 statusicon，仅返回最干净的可读名称
        return cleanTag;
    }

    /**
     * 将当前 Token 拥有的状态标记解析为纯中文文本列表（供悬浮 Tooltip 提示）
     * @param {string} statusmarkersStr 
     * @returns {string[]} 中文状态名称数组
     */
    static getReadableNamesFromMarkers(statusmarkersStr) {
        if (!statusmarkersStr) return [];
        const tags = statusmarkersStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);
        const names = [];

        for (const tag of tags) {
            const tagName = tag.split("::")[0];
            const def = this.find(tagName) || this.find(tag);
            if (def) {
                names.push(`${def.nameZh} (${def.nameEn})`);
            } else {
                names.push(tagName);
            }
        }
        return names;
    }
}

    // ==========================================
    // 3. Pf1eBuffManager (PF1e 角色卡数据管理层)
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
     * 声明式调和全局事务锁（防止多端事件回流震荡）
     */
    static isReconciling = false;

    /**
     * 待结算的棋子标记调和会话表 (Token ID -> { character, token, timestamp })
     */
    static pendingTokenReconciles = new Map();

    /**
     * 兜底定时器表
     */
    static tokenSafetyTimers = new Map();

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

        // 确保挂载属性变更监听，实现角色卡 Debuff 开关的实时捕获
        this.bindCharacterAttributeListeners(character);

        const conditions = [];

        // 全面遍历 PF1E_CONDITIONS 34 项状态注册表
        for (const def of Object.values(PF1E_CONDITIONS)) {
            const condKey = def.attrKey;
            if (!condKey) continue;

            const attr = character.attribs.models.find(a => a.get("name") === condKey);
            if (!attr) continue;

            const val = attr.get("current");
            const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;

            if (isActive) {
                const roundsKey = def.roundsKey || `${condKey}_rounds`;
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
                    name: def.nameZh,
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
     * 为指定角色绑定属性变动监听，捕获角色卡上开关 Debuff 的动作，单端静默同步棋子标记与先攻徽章
     */
    static bindCharacterAttributeListeners(character) {
        if (!character || !character.attribs || character._pf1eAttribsBound) return;
        character._pf1eAttribsBound = true;

        const handleAttributeMutation = async (attr, options) => {
            if (!attr) return;
            // 忽略脚本自主更新、批量修改或当前处于调和事务中，彻底切断震荡回路
            if (options?.byScript || Pf1eBuffManager.isScriptMutating || Pf1eBuffManager.isReconciling) return;

            const attrName = attr.get("name") || "";

            // 0. 响应常规 repeating_buff2_*_enable_toggle 开启，自动根据预置公式初始化轮数
            if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_enable_toggle")) {
                const isToggledOn = Number(attr.get("current")) === 1;
                if (isToggledOn) {
                    const prefix = attrName.replace("_enable_toggle", "");
                    const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
                    const curRounds = roundsAttr ? roundsAttr.get("current") : "";
                    const isRoundsEmpty = curRounds === "" || curRounds === null || Number(curRounds) === 0;

                    if (isRoundsEmpty) {
                        const initRoundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
                        const formula = initRoundsAttr ? initRoundsAttr.get("current") : "";
                        if (formula) {
                            const val = await Roll20Bridge.evalNativeFormula(formula, character);
                            if (val !== null && !isNaN(val)) {
                                console.log(`[Pf1eBuffManager] 角色卡开启 Buff (${prefix})，借用原生机制求值公式 [${formula}] = ${val}`);
                                if (!roundsAttr) {
                                    character.attribs.create({ name: `${prefix}_rounds`, current: val });
                                } else {
                                    roundsAttr.save({ current: val });
                                }
                            }
                        }
                    }
                }
                // 刷新代表该角色的先攻条徽章
                const page = Roll20Bridge.getCurrentPage();
                if (page && page.thegraphics) {
                    page.thegraphics.each(g => {
                        if (g.get("represents") === character.id) {
                            Pf1eBuffUI.requestTokenRefresh(g.id);
                        }
                    });
                }
                return;
            }

            // 仅对 condition- 开头的状态属性响应
            if (!attrName.startsWith("condition-")) return;
            // 忽略轮数属性本身的变动，仅关注开关值变动
            if (attrName.endsWith("_rounds")) return;

            console.log(`[Pf1eBuffManager] 捕获到角色 ${character.get("name")} 的 Debuff 开关变动: ${attrName} = ${attr.get("current")}`);

            // 1. 声明式调和棋子标记 (单向调和: character -> token)
            await Pf1eBuffManager.reconcileConditions(character, null, { origin: "character" });

            // 2. 刷新代表该角色的先攻条徽章
            const page = Roll20Bridge.getCurrentPage();
            if (page && page.thegraphics) {
                page.thegraphics.each(g => {
                    if (g.get("represents") === character.id) {
                        Pf1eBuffUI.requestTokenRefresh(g.id);
                    }
                });
            }
        };

        // 同时监听属性值变更 (change:current) 与卡面首次勾选新建属性 (add)
        character.attribs.on("change:current", handleAttributeMutation);
        character.attribs.on("add", (attr, collection, options) => handleAttributeMutation(attr, options));
    }

    /**
     * 设置或更新指定负面状态的已过轮数（负数存储）
     */
    static async setConditionRounds(character, condKey, rounds, options = {}) {
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
            roundsAttr.save({ current: storedVal }, { byScript: true });
        } else {
            character.attribs.create({ name: roundsKey, current: storedVal });
        }

        if (!options.skipTokenSync) {
            await this.syncTokenStatusmarkers(character);
        }
    }

    /**
     * 关闭/解除指定负面状态
     */
    static async removeCondition(character, condKey, options = {}) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const attr = character.attribs.models.find(a => a.get("name") === condKey);
        if (attr) {
            attr.save({ current: "0" }, { byScript: true });
        }
        const roundsKey = `${condKey}_rounds`;
        const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
        if (roundsAttr) {
            roundsAttr.destroy();
        }

        if (!options.skipTokenSync) {
            await this.syncTokenStatusmarkers(character);
        }
    }

    /**
     * 施加/激活指定负面状态（支持原生与补充状态，带默认正计轮）
     */
    static async applyCondition(character, condKey, rounds = -1, options = {}) {
        if (!character || !condKey) return;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const def = Pf1eConditionRegistry.find(condKey);
        const actualAttrKey = def?.attrKey || condKey;

        if (def?.isNativeSheet) {
            // 原生属性赋予标准惩罚值
            const defaultVal = actualAttrKey === "condition-Blinded" ? "2" : (actualAttrKey === "condition-Prone" ? "4" : "1");
            let attr = character.attribs.models.find(a => a.get("name") === actualAttrKey);
            if (!attr) {
                character.attribs.create({ name: actualAttrKey, current: defaultVal });
            } else {
                attr.save({ current: defaultVal }, { byScript: true });
            }
        }

        await this.setConditionRounds(character, actualAttrKey, rounds, options);
    }

    /**
     * 声明式多端状态调和引擎 (Declarative Condition Reconciliation Engine)
     * 遵循单向数据流与来源戳记准则，杜绝一切多端震荡与界面失焦。
     * @param {object} character Character Backbone 模型
     * @param {object} token Token Graphic Backbone 模型
     * @param {object} options 调和选项 { origin: "token" | "character" }
     */
    static async reconcileConditions(character, token = null, options = {}) {
        if (!character && !token) return;
        if (this.isReconciling) return;

        this.isReconciling = true;
        try {
            const origin = options.origin || "character";

            // 1. 若变动来源于棋子 (origin: "token")
            // 方案 A 会话生命周期感知：若标记栏处于打开状态，挂起调和，绝不修改角色卡与 DOM，保证选框永不失焦；
            // 待用户操作完毕关闭标记栏时，立即 0 延迟原子执行调和结算！
            if (origin === "token") {
                if (!token || !character) return;

                const isMarkerMenuOpen = !!document.querySelector(".markermenu");
                if (isMarkerMenuOpen) {
                    this.pendingTokenReconciles.set(token.id, { character, token, timestamp: Date.now() });
                    console.log(`[Pf1eBuffManager] 标记栏处于活动会话中，挂起调和请求，等待面板关闭后结算 (Token ID: ${token.id})`);

                    // 设置 5 秒防呆兜底定时器：若极端情况下未收到关闭事件，自动检查并安全结算
                    if (this.tokenSafetyTimers.has(token.id)) {
                        clearTimeout(this.tokenSafetyTimers.get(token.id));
                    }
                    const safetyTimer = setTimeout(() => {
                        this.tokenSafetyTimers.delete(token.id);
                        if (!document.querySelector(".markermenu")) {
                            this.flushPendingTokenReconciles();
                        }
                    }, 5000);
                    this.tokenSafetyTimers.set(token.id, safetyTimer);
                    return;
                }

                // 标记栏未打开（宏调用、快捷键或外部调用），直接原子调和
                await this._executeTokenReconciliation(character, token);
                return;
            }

            // 2. 若变动来源于角色卡 (origin: "character")
            // 铁律：角色卡当前状态即为真理源，仅单向调和棋子标记！
            if (origin === "character") {
                if (!character) return;
                const page = Roll20Bridge.getCurrentPage();
                if (!page || !page.thegraphics) return;

                const tokens = [];
                if (token) {
                    tokens.push(token);
                } else {
                    page.thegraphics.each(g => {
                        if (g.get("represents") === character.id) {
                            tokens.push(g);
                        }
                    });
                }

                if (tokens.length === 0) return;

                // 计算当前应该挂载的纯净 Tag 集合
                const activeConditions = await this.getActiveConditions(character);
                const desiredTags = new Set();
                for (const cond of activeConditions) {
                    const tag = Pf1eConditionRegistry.resolveMarkerTag(cond.key);
                    if (tag) desiredTags.add(tag);
                }

                for (const t of tokens) {
                    const currentStr = t.get("statusmarkers") || "";
                    const currentList = currentStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);

                    // 保留原有列表中未被解除的标记与非托管自定义标记，完全维持原有自然顺序
                    const remainingDesired = new Set(desiredTags);
                    const preservedList = [];
                    for (const item of currentList) {
                        const def = Pf1eConditionRegistry.find(item);
                        if (!def) {
                            preservedList.push(item);
                        } else {
                            const resolvedTag = Pf1eConditionRegistry.resolveMarkerTag(def.attrKey || def.id);
                            if (remainingDesired.has(item) || remainingDesired.has(resolvedTag)) {
                                preservedList.push(item);
                                remainingDesired.delete(item);
                                remainingDesired.delete(resolvedTag);
                            }
                        }
                    }

                    for (const tag of remainingDesired) {
                        preservedList.push(tag);
                    }

                    // 纯集合差异比对：若无差异，绝不触碰棋子，杜绝任何多余重写与弹窗失焦
                    const oldSet = new Set(currentList);
                    const newSet = new Set(preservedList);
                    const isIdentical = oldSet.size === newSet.size && [...oldSet].every(x => newSet.has(x));

                    if (!isIdentical) {
                        const newStr = preservedList.join(",");
                        console.log(`[Pf1eBuffManager] 调和棋子标记: ${currentStr} -> ${newStr}`);
                        t.set({ statusmarkers: newStr }, { byScript: true });
                    }
                }
            }
        } finally {
            queueMicrotask(() => {
                this.isReconciling = false;
            });
        }
    }

    /**
     * 结算所有挂起的棋子调和会话（0 延迟原子执行）
     */
    static async flushPendingTokenReconciles() {
        if (this.pendingTokenReconciles.size === 0) return;
        const entries = Array.from(this.pendingTokenReconciles.values());
        this.pendingTokenReconciles.clear();

        for (const item of entries) {
            try {
                if (this.tokenSafetyTimers.has(item.token.id)) {
                    clearTimeout(this.tokenSafetyTimers.get(item.token.id));
                    this.tokenSafetyTimers.delete(item.token.id);
                }
                await this._executeTokenReconciliation(item.character, item.token);
            } catch (err) {
                console.error("[Pf1eBuffManager] 执行会话结算调和失败:", err);
            }
        }
    }

    /**
     * 棋子标记防抖结算后的底层原子调和
     * 仅单向将棋子上的标记变更落实到角色卡属性，绝对禁止反向修改棋子
     */
    static async _executeTokenReconciliation(character, token) {
        if (!character || !token) return;
        this.isReconciling = true;
        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            const currentMarkersStr = token.get("statusmarkers") || "";
            const currentTags = currentMarkersStr
                .split(",")
                .map(s => s.trim().replace(/@\d+$/, ""))
                .filter(Boolean);

            // 解析棋子上所有已挂载的 tags 对应的负面状态属性 Key
            const desiredCondAttrKeys = new Set();
            for (const tag of currentTags) {
                const def = Pf1eConditionRegistry.find(tag);
                if (def && def.attrKey) {
                    desiredCondAttrKeys.add(def.attrKey);
                }
            }

            let characterChanged = false;

            // 遍历系统所有支持的 34 项状态注册表，进行 Diff 调和
            for (const def of Object.values(PF1E_CONDITIONS)) {
                const attrKey = def.attrKey;
                if (!attrKey) continue;

                const attr = character.attribs.models.find(a => a.get("name") === attrKey);
                const isCurrentlyActive = attr && attr.get("current") !== "0" && attr.get("current") !== 0 && attr.get("current") !== "" && attr.get("current") !== null && attr.get("current") !== undefined && attr.get("current") !== false;
                const shouldBeActive = desiredCondAttrKeys.has(attrKey);

                // 状态一致，无差异跳过
                if (isCurrentlyActive === shouldBeActive) continue;

                characterChanged = true;
                if (shouldBeActive) {
                    console.log(`[Pf1eBuffManager] 防抖结算调和: 激活 ${character.get("name")} 的 ${def.nameZh} (${attrKey})`);
                    const defaultVal = attrKey === "condition-Blinded" ? "2" : (attrKey === "condition-Prone" ? "4" : "1");
                    if (!attr) {
                        character.attribs.create({ name: attrKey, current: defaultVal });
                    } else {
                        attr.save({ current: defaultVal }, { byScript: true });
                    }
                    // 补齐默认正计轮 (-1)
                    const roundsKey = `${attrKey}_rounds`;
                    let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                    if (!roundsAttr) {
                        character.attribs.create({ name: roundsKey, current: -1 });
                    } else {
                        roundsAttr.save({ current: -1 }, { byScript: true });
                    }
                } else {
                    console.log(`[Pf1eBuffManager] 防抖结算调和: 解除 ${character.get("name")} 的 ${def.nameZh} (${attrKey})`);
                    if (attr) {
                        attr.save({ current: "0" }, { byScript: true });
                    }
                    const roundsKey = `${attrKey}_rounds`;
                    const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                    if (roundsAttr) {
                        roundsAttr.destroy();
                    }
                }
            }

            // 仅刷新下游纯展示视图（先攻条徽章），棋子绝不碰触
            if (characterChanged) {
                Pf1eBuffUI.requestTokenRefresh(token.id);
            }
        } finally {
            queueMicrotask(() => {
                this.isReconciling = false;
            });
        }
    }

    /**
     * 将角色当前处于激活状态的负面效果同步到棋子标记 (单端管辖，尊重原生顺序，绝不颠倒重排)
     */
    static async syncTokenStatusmarkers(character, token = null) {
        return this.reconcileConditions(character, token, { origin: "character" });
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
            const initRoundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
            const buffTypeAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_bufftype`);

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
            const initRounds = initRoundsAttr && initRoundsAttr.get("current") !== "" ? String(initRoundsAttr.get("current")) : null;
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
                        subKey !== "init_rounds" &&
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
                initRounds: initRounds || null,
                buffType,
                extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null,
                toggleAttr: toggleAttr || null,
                roundsAttr: roundsAttr || null,
                initRoundsAttr: initRoundsAttr || null
            });
        }

        // 按照 Roll20 官方 _reporder_repeating_buff2 顺序重排
        const orderAttr = character.attribs.models.find(a => a.get("name") === "_reporder_repeating_buff2");
        if (orderAttr && orderAttr.get("current")) {
            const orderList = orderAttr.get("current").split(",").map(id => id.trim().toLowerCase()).filter(Boolean);
            const orderMap = new Map();
            orderList.forEach((id, idx) => orderMap.set(id, idx));

            buffs.sort((a, b) => {
                const idxA = orderMap.has(a.rowId.toLowerCase()) ? orderMap.get(a.rowId.toLowerCase()) : 9999;
                const idxB = orderMap.has(b.rowId.toLowerCase()) ? orderMap.get(b.rowId.toLowerCase()) : 9999;
                return idxA - idxB;
            });
        }

        return buffs;
    }

    /**
     * 触发角色卡的 Sheet Worker 全量重算 (PFSheet.recalculate)
     * 自动刷新攻击力、防御、豁免等所有骰子宏引用的计算属性
     * @param {object} character 
     */
    static async triggerRecalculate(character) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs) return;

        console.log(`[Pf1eBuffManager] 正在自动触发角色 [${character.get("name")}] 的加值重算 (recalc1)...`);

        // 1. 设置底层属性 recalc1 触发 Sheet Worker (on("change:recalc1"))
        let recalcAttr = character.attribs.models.find(a => a.get("name") === "recalc1");
        if (!recalcAttr) {
            character.attribs.create({ name: "recalc1", current: "1" });
        } else {
            if (recalcAttr.get("current") === "1" || recalcAttr.get("current") === 1) {
                recalcAttr.set({ current: "0" }, { silent: true });
            }
            recalcAttr.save({ current: "1" });
        }

        // 2. 检查是否有处于打开状态的人物卡窗口，如果有，直接触发 DOM 原生点击以加速双重响应
        try {
            const charId = character.id;
            const dialogs = document.querySelectorAll(`.characterdialog[data-characterid="${charId}"], .characterdialog`);
            dialogs.forEach(dlg => {
                const recalcBtn = dlg.querySelector('input[name="attr_recalc1"], input[name$="_recalc1"]');
                if (recalcBtn) {
                    recalcBtn.click();
                }
                const iframes = dlg.querySelectorAll("iframe");
                iframes.forEach(iframe => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow?.document;
                        const frameBtn = doc?.querySelector('input[name="attr_recalc1"], input[name$="_recalc1"]');
                        if (frameBtn) frameBtn.click();
                    } catch (e) {}
                });
            });
        } catch (domErr) {}
    }

    /**
     * 施加或刷新 Buff（核心幂等方法）
     * 1. 以名称判断：如果卡片中已有同名 Buff，直接启用 (_enable_toggle=1) 并刷新剩余轮数，保留其原有加值计算公式；
     * 2. 若无同名 Buff，则自动新建一行符合官方标准规范的原生 Buff 并激活。
     * @param {object} character Character 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数 (若为 null 且有预置公式，将借用原生求值自动计算)
     * @param {object|null} extraAttrs 额外的细目加值字典（如 b1_bonus, b1_val 等）
     * @param {string|null} initRounds 预置初始轮数或公式 (如 "10", "@{level}*10")
     */
    static async applyOrRefreshBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
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

            // 更新或保存预置初始轮数/公式
            if (initRounds !== null && initRounds !== undefined) {
                let initAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
                if (!initAttr) {
                    if (initRounds !== "") character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
                } else {
                    initAttr.save({ current: initRounds });
                }
            }

            let effectiveRounds = rounds;
            if (effectiveRounds === null || isNaN(effectiveRounds)) {
                // 借用原生机制求值预置公式
                const targetFormula = initRounds || (character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`)?.get("current"));
                if (targetFormula) {
                    const evalVal = await Roll20Bridge.evalNativeFormula(targetFormula, character);
                    if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
                }
            }

            let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            if (effectiveRounds !== null && !isNaN(effectiveRounds)) {
                if (!roundsAttr) {
                    roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: Number(effectiveRounds), max: Number(effectiveRounds) });
                } else {
                    roundsAttr.save({ current: Number(effectiveRounds) });
                }
            } else if (roundsAttr) {
                // 设为常驻
                roundsAttr.save({ current: "" });
            }

            // 更新细目属性
            if (extraAttrs && typeof extraAttrs === "object") {
                for (const [k, v] of Object.entries(extraAttrs)) {
                    if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "row_id") continue;
                    const attrFullName = `${prefix}_${k}`;
                    let subAttr = character.attribs.models.find(a => a.get("name") === attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${effectiveRounds}`);
            await this.triggerRecalculate(character);
            return { rowId, prefix, name: cleanName, rounds: effectiveRounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs, initRounds);
            await this.triggerRecalculate(character);
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
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

        // 保存初始预置轮数/公式
        if (initRounds !== null && initRounds !== undefined && initRounds !== "") {
            character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
        }

        let effectiveRounds = rounds;
        if ((effectiveRounds === null || isNaN(effectiveRounds)) && initRounds) {
            const evalVal = await Roll20Bridge.evalNativeFormula(initRounds, character);
            if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
        }

        let roundsAttr = null;
        if (effectiveRounds !== null && !isNaN(effectiveRounds) && effectiveRounds > 0) {
            roundsAttr = character.attribs.create({
                name: `${prefix}_rounds`,
                current: Number(effectiveRounds),
                max: Number(effectiveRounds)
            });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}], 轮数: ${effectiveRounds}`);
        return { rowId, prefix, name: cleanName, rounds: effectiveRounds, toggleAttr, roundsAttr };
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

        // 若开启，检查是否需自动根据预置公式初始化轮数
        if (enable) {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            const curVal = roundsAttr ? roundsAttr.get("current") : "";
            const isRoundsEmpty = curVal === "" || curVal === null || Number(curVal) === 0;

            if (isRoundsEmpty) {
                const initRoundsAttr = character.attribs.models.find(a => {
                    const n = a.get("name") || "";
                    return n === `${targetPrefix}_init_rounds` || n.toLowerCase() === `${lowerPrefix}_init_rounds`;
                });
                const formula = initRoundsAttr ? initRoundsAttr.get("current") : "";
                if (formula) {
                    const val = await Roll20Bridge.evalNativeFormula(formula, character);
                    if (val !== null && !isNaN(val)) {
                        console.log(`[Pf1eBuffManager] 启用 Buff (${rowId})，借用原生求值公式 [${formula}] = ${val}`);
                        if (!roundsAttr) {
                            character.attribs.create({ name: `${targetPrefix}_rounds`, current: val });
                        } else {
                            roundsAttr.save({ current: val });
                        }
                    }
                }
            }
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
        await this.triggerRecalculate(character);
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
        await this.triggerRecalculate(character);
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
    static async updateBuffRow(character, rowId, name, rounds, extraAttrs, initRounds = null) {
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

        // 3. 更新预置初始轮数/公式
        if (initRounds !== null && initRounds !== undefined) {
            const initKey = `${prefix}_init_rounds`;
            let initAttr = character.attribs.models.find(a => a.get("name") === initKey);
            if (!initAttr) {
                if (initRounds !== "") character.attribs.create({ name: initKey, current: initRounds });
            } else {
                initAttr.save({ current: initRounds });
            }
        }

        // 4. 补全原生必需属性
        this.ensureNativeRequiredAttrs(character, prefix, rowId);

        // 5. 更新细目加值字典 (extraAttrs)
        if (extraAttrs && typeof extraAttrs === "object") {
            // 清理不在新 extraAttrs 中的旧扩展字段
            const preservedKeys = new Set(["name", "enable_toggle", "rounds", "init_rounds", "tabcat", "tabcat2", "row_id", "bufftype"]);
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
        await this.triggerRecalculate(character);
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
    // 4. SuiteConfigStore 战役云端配置卡存储层
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
        return Roll20Bridge.isGM();
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

        const rowId = window.generateUUID ? window.generateUUID() : ("-R20" + Math.random().toString(36).substr(2, 16));
        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, extraAttrs, initRounds);

        console.log("[SuiteConfigStore] 原子创建原生 Buff [" + name + "] (rowId: " + rowId + ", initRounds: " + initRounds + ")");
        return rowId;
    }

    /**
     * 原子更新数据库角色卡上的指定 Buff
     */
    static async updateBuffInDatabase(rowId, name, rounds = null, extraAttrs = null, initRounds = null) {
        const dbChar = await this.ensureDatabaseCharacter();
        if (!dbChar || !rowId) return false;

        await this.writeNativeBuffRow(dbChar, rowId, name, rounds, extraAttrs, initRounds);

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

    // ==========================================
    // 5. TurnOrderObserver 先攻监听器
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
    // 6. TokenBuffManager (纯野怪 Token 状态引擎)
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
    // 7. Pf1eBuffUI (先攻列表徽章交互层)
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
    // 8. CanvasMarkerHoverObserver (画布标记悬停原生提示探测器)
    // ==========================================
/**
 * CanvasMarkerHoverObserver.js
 * 负责在画布上检测鼠标是否悬停在特定棋子的状态标记上方
 * 0 DOM 污染，直接复用 <canvas>.title 原生展现传统黄底黑字提示
 */
class CanvasMarkerHoverObserver {
    static isStarted = false;
    static _rafId = null;
    static _lastMatchedTag = null;

    /**
     * 启动画布标记悬停探测器
     */
    static start() {
        if (this.isStarted) return;

        const canvas = document.getElementById("babylonCanvas") || document.querySelector("canvas");
        if (!canvas) {
            console.warn("[CanvasMarkerHoverObserver] 未找到主渲染画布，延迟重试");
            setTimeout(() => this.start(), 1500);
            return;
        }

        // 1. 监听画布上的鼠标移动，节流命中检测
        canvas.addEventListener("mousemove", (e) => {
            if (this._rafId) return;
            this._rafId = requestAnimationFrame(() => {
                this._rafId = null;
                this.handleMouseMove(canvas, e.clientX, e.clientY);
            });
        }, { passive: true });

        // 2. 鼠标离开画布时清空 title
        canvas.addEventListener("mouseleave", () => {
            if (canvas.title !== "") {
                canvas.title = "";
                this._lastMatchedTag = null;
            }
        }, { passive: true });

        // 3. 增强标记选择面板 (Marker Menu Picker) 原生 title 汉化
        this.bindMarkerPickerEnhancer();

        // 4. 监听棋子标记手动变动，反向联动人物卡/先攻栏 Debuff
        this.bindTokenMarkerChangeListeners();

        this.isStarted = true;
        console.log("[CanvasMarkerHoverObserver] 画布标记悬停原生提示与双向联动已就绪");
    }

    /**
     * 监听棋子标记变动（完全基于集合生命周期：新建、拖拽、复制粘贴、批量入场、换页全自动装载）
     */
    static bindTokenMarkerChangeListeners() {
        const boundTokens = new Set();
        const tokenLastStatusMarkers = new Map();

        const attachToToken = (token) => {
            if (!token || boundTokens.has(token.id)) return;
            boundTokens.add(token.id);

            // 记录初始标记
            tokenLastStatusMarkers.set(token.id, token.get("statusmarkers") || "");

            token.on("change:statusmarkers", async (t, newSM, options) => {
                const prevKnown = tokenLastStatusMarkers.get(t.id) ?? t.previous("statusmarkers") ?? "";
                tokenLastStatusMarkers.set(t.id, newSM || "");

                // 若为脚本自主同步或正处于调和事务中，彻底静音跳过，防止回路震荡
                if (options?.byScript || Pf1eBuffManager.isScriptMutating || Pf1eBuffManager.isReconciling) return;

                const character = Roll20Bridge.getCharacterByToken(t);
                if (!character) return;

                // 声明式单向调和：由棋子驱动角色卡，绝对禁止反向修改棋子，杜绝选框失焦
                await Pf1eBuffManager.reconcileConditions(character, t, { origin: "token" });
            });
        };

        let boundPageId = null;

        const bindCurrentPageGraphics = () => {
            const page = Roll20Bridge.getCurrentPage();
            if (!page || !page.thegraphics) {
                // 环境尚未就绪，延迟重试直到就绪
                setTimeout(bindCurrentPageGraphics, 500);
                return;
            }

            // 1. 立即挂载当前地图全部已有棋子
            page.thegraphics.each(attachToToken);

            // 若已经给当前页面的 thegraphics 挂过集合级事件，避免重复绑定
            if (boundPageId === page.id) return;
            boundPageId = page.id;

            // 2. 监听新棋子进场（包括拖拽生成、Ctrl+C/V 复制粘贴）
            page.thegraphics.on("add", (token) => {
                attachToToken(token);
            });

            // 3. 监听批量数据载入（云端数据就绪、整页刷新）
            page.thegraphics.on("reset", () => {
                page.thegraphics.each(attachToToken);
            });
        };

        bindCurrentPageGraphics();

        // 4. 监听切换地图事件，自动切换到新地图并装配
        if (window.Campaign) {
            window.Campaign.on("change:playerpageid", () => {
                setTimeout(bindCurrentPageGraphics, 300);
            });
        }
    }

    /**
     * 处理鼠标在画布上的移动并检测 Marker 命中
     */
    static handleMouseMove(canvas, mouseX, mouseY) {
        const campaign = Roll20Bridge.getCampaign();
        const page = Roll20Bridge.getCurrentPage();
        if (!campaign || !page || !page.thegraphics) return;

        let hitTag = null;
        let hitTooltip = null;

        // 遍历当前地图所有携带 statusmarkers 的 Token Graphic
        for (let i = 0; i < page.thegraphics.length; i++) {
            const token = page.thegraphics.at(i);
            const sm = token.get("statusmarkers");
            if (!sm || sm === "" || sm === "false") continue;

            const dec = token.view?.graphic?.tokenMarkerDecorator;
            const engine = token.view?.graphic?.engine;
            if (!dec || !engine || !dec.primaryNode) continue;

            const children = dec.primaryNode.getChildren ? dec.primaryNode.getChildren() : [];
            for (const node of children) {
                // 忽略非标记节点
                if (!node || !node.name || node.name.startsWith("instance-array")) continue;

                try {
                    const absPos = node.getAbsolutePosition ? node.getAbsolutePosition() : node.position;
                    if (!absPos || typeof absPos.clone !== "function") continue;

                    const screenPos = engine.getScreenPosition(absPos);
                    if (!screenPos) continue;

                    // 判断鼠标指针是否落在标记图标半径内 (约 15 像素半径)
                    const dist = Math.hypot(mouseX - screenPos.x, mouseY - screenPos.y);
                    if (dist <= 15) {
                        hitTag = node.name;
                        hitTooltip = Pf1eConditionRegistry.getTooltipForMarker(node.name);
                        break;
                    }
                } catch (e) {
                    // 忽略单个节点计算异常
                }
            }
            if (hitTag) break;
        }

        // 更新 canvas.title
        if (hitTag) {
            if (this._lastMatchedTag !== hitTag) {
                this._lastMatchedTag = hitTag;
                canvas.title = hitTooltip || hitTag;
            }
        } else {
            if (this._lastMatchedTag !== null || canvas.title !== "") {
                this._lastMatchedTag = null;
                canvas.title = "";
            }
        }
    }

    /**
     * 自动为选中的棋子标记选择菜单 (Marker Menu) 中的小图标注入原生 title 纯中文提示
     * 并彻底清洗历史遗留的 "statusicon" 错误污染
     */
    static bindMarkerPickerEnhancer() {
        const enhanceItem = (el) => {
            if (!el) return;

            // 优先从 data-status-id 提取准确的 marker 标识（绝不读取 className 兜底）
            let statusId = el.dataset.statusId || "";
            if (!statusId && el.dataset.actionType) {
                statusId = el.dataset.actionType.replace(/^toggle_status_/, "");
            }

            if (statusId) {
                const tooltip = Pf1eConditionRegistry.getTooltipForMarker(statusId);
                if (tooltip && el.title !== tooltip) {
                    el.title = tooltip;
                }
            } else if (el.title && el.title.includes("statusicon")) {
                // 清理历史残留的错误污染
                el.title = "";
            }
        };

        // 1. 鼠标悬停事件委托（极速响应单项）
        document.addEventListener("mouseover", (e) => {
            const target = e.target;
            if (!target) return;

            // 匹配标记选择菜单中的各个图标项 (Roll20 属性为 data-status-id 或 data-action-type)
            const markerItem = target.closest?.(".markermenu .statusicon, .markermenu div[data-status-id], .markermenu [data-action-type]");
            if (markerItem) {
                enhanceItem(markerItem);
            }
        }, true);

        // 2. 观察 DOM 变化，当 .markermenu 展开时清洗 title，关闭时立即触发 0 延迟原子调和
        const menuObserver = new MutationObserver((mutations) => {
            let menuRemoved = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.classList?.contains("markermenu") || node.querySelector?.(".markermenu")) {
                        const items = node.querySelectorAll?.(".statusicon, div[data-status-id], [data-action-type]") || [];
                        items.forEach(enhanceItem);
                    }
                }
                for (const node of m.removedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.classList?.contains("markermenu") || node.querySelector?.(".markermenu")) {
                        menuRemoved = true;
                    }
                }
            }

            if (menuRemoved) {
                // 检查当前 DOM 树是否已经没有打开的 .markermenu
                if (!document.querySelector(".markermenu")) {
                    console.log("[CanvasMarkerHoverObserver] 检测到标记菜单关闭，立即触发挂起的调和会话");
                    Pf1eBuffManager.flushPendingTokenReconciles();
                }
            }
        });

        menuObserver.observe(document.body, { childList: true, subtree: true });

        // 3. 点击外部区域兜底：当在标记菜单之外点击画布时，排队微任务检查关闭并结算
        document.addEventListener("pointerdown", (e) => {
            if (!e.target?.closest?.(".markermenu")) {
                requestAnimationFrame(() => {
                    if (!document.querySelector(".markermenu") && Pf1eBuffManager.pendingTokenReconciles.size > 0) {
                        Pf1eBuffManager.flushPendingTokenReconciles();
                    }
                });
            }
        }, true);

        // 对页面当前已存在的 markermenu 图标立即执行一次清洗
        document.querySelectorAll(".markermenu .statusicon, .markermenu div[data-status-id]").forEach(enhanceItem);
    }
}

    // ==========================================
    // 9. CharacterSheetBuffEnhancer (官方人物卡 Buff 预置初始轮数注入增强器)
    // ==========================================
/**
 * Roll20 Suite - 官方人物卡 Buff 增强注入器
 * 负责在官方人物卡 Buff 列表中动态注入“预置初始轮数/公式”输入框，
 * 采用原生“Buff 計算式”的原汁原味 HTML 模板结构，并与 Roll20 底层 Backbone 属性实现双向绑定。
 */
class CharacterSheetBuffEnhancer {
    static isInitialized = false;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetBuffEnhancer] 启动官方人物卡 Buff 增强注入器...");

        // 1. 扫描当前已有的人物卡弹窗
        this.scanAllDialogs();

        // 2. 监听后续打开的人物卡弹窗
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.(".characterdialog, .ui-dialog") || node.querySelector?.(".characterdialog")) {
                            this.scanAllDialogs();
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // 3. 辅助轮询扫描（低频 1.5s），确保异步 iframe 与动态 tab 切换被 100% 捕获
        setInterval(() => {
            this.scanAllDialogs();
        }, 1500);
    }

    /**
     * 扫描所有当前打开的人物卡对话框
     */
    static scanAllDialogs() {
        const dialogEls = document.querySelectorAll(".characterdialog, .ui-dialog");
        dialogEls.forEach(el => this.enhanceDialog(el));
    }

    /**
     * 对单个对话框进行增强
     */
    static enhanceDialog(dialogEl) {
        if (!dialogEl) return;

        // 获取对应的 Character Backbone Model
        const character = this.findCharacterFromDialog(dialogEl);
        if (!character) return;

        // 处理直接嵌入的 DOM
        this.enhanceContainer(dialogEl, character);

        // 如果人物卡内部有 iframe，深入 iframe 内部增强
        const iframes = dialogEl.querySelectorAll("iframe");
        iframes.forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    this.enhanceContainer(doc.body, character);
                }
            } catch (e) {
                // 跨域或安全受限忽略
            }
        });
    }

    /**
     * 从对话框元素中定位 Character Backbone Model
     */
    static findCharacterFromDialog(dialogEl) {
        if (!window.Campaign || !window.Campaign.characters) return null;

        // 1. 尝试从 dataset 中读取 characterid
        let charId = dialogEl.getAttribute("data-characterid") || 
                     dialogEl.querySelector("[data-characterid]")?.getAttribute("data-characterid");

        // 2. 尝试从 jQuery data 中获取
        if (!charId && window.$) {
            try {
                const charObj = window.$(dialogEl).data("character");
                if (charObj && charObj.id) return charObj;
            } catch (e) {}
        }

        // 3. 尝试从对话框 ID 或类名解析 (如 #character-123456)
        if (!charId) {
            const idAttr = dialogEl.id || "";
            const match = idAttr.match(/character-([a-zA-Z0-9_-]+)/);
            if (match) charId = match[1];
        }

        if (charId) {
            return window.Campaign.characters.get(charId);
        }

        return null;
    }

    /**
     * 在人物卡容器内寻找 repeating_buff2 重复列表并注入输入框
     */
    static enhanceContainer(containerEl, character) {
        // 查找所有 repeating_buff2 与 repeating_buff 的容器
        const repContainers = containerEl.querySelectorAll(
            'div.repcontainer[data-groupname="repeating_buff2"], div.repcontainer[data-groupname="repeating_buff"]'
        );

        repContainers.forEach(repContainer => {
            const groupName = repContainer.getAttribute("data-groupname") || "repeating_buff2";
            const repItems = repContainer.querySelectorAll("div.repitem");

            repItems.forEach(item => {
                this.enhanceRepItem(item, character, groupName);
            });

            // 监听该重复容器内动态新增/删除的行
            if (!repContainer._r20SuiteObserved) {
                repContainer._r20SuiteObserved = true;
                const itemObserver = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("repitem")) {
                                this.enhanceRepItem(node, character, groupName);
                            }
                        }
                    }
                });
                itemObserver.observe(repContainer, { childList: true });
            }
        });
    }

    /**
     * 增强单行 Buff 条目
     * 原汁原味复刻原生“Buff 計算式” HTML 模板，不依赖内联样式，借力宿主原生浮动与输入框排版
     */
    static enhanceRepItem(itemEl, character, groupName = "repeating_buff2") {
        if (!itemEl || !character) return;

        // 1. 获取 rowId
        let rowId = itemEl.getAttribute("data-reprowid");
        if (!rowId) {
            const namedInput = itemEl.querySelector('input[name*="_name"], input[name*="_row_id"]');
            if (namedInput) {
                const nameAttr = namedInput.getAttribute("name") || "";
                const match = nameAttr.match(/repeating_buff2?_([^_]+)_/);
                if (match) rowId = match[1];
            }
        }
        if (!rowId) return;

        // 2. 找到名称 label (即 label[1]，起始基准锚点)
        const nameInput = itemEl.querySelector('input[name="attr_name"], input[name$="_name"]');
        if (!nameInput) return;

        const nameLabel = nameInput.closest("label");
        if (!nameLabel || !nameLabel.parentNode) return;

        // 避免重复注入
        if (nameLabel.parentNode.querySelector(".r20-suite-init-rounds-col, .r20-suite-init-rounds")) return;

        // 3. 确定说明文字语言风格
        const allText = itemEl.textContent || "";
        const labelText = (allText.includes("名称") || allText.includes("计算式")) 
            ? "轮数计算式" 
            : (allText.includes("Name") && !allText.includes("名稱") ? "Rounds Formula" : "輪數計算式");

        // 4. 原汁原味固化复刻原生“Buff 計算式” HTML 模板 (small-label2 sect entry-med highlight)
        // 借用原生 CSS 样式，杜绝任何冗余的 style 声明
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = `
<label class="small-label2 sect entry-med highlight r20-suite-init-rounds-col">
    <input class="macro-text-inline r20-suite-init-rounds" type="text" name="attr_init_rounds" placeholder="0" title="预置初始轮数/公式（例如 10、@{level}*10、10+@{constitution_mod}）。开启 Buff 时借用原生引擎自动求值。">
    <span class="super note-a">${labelText}(a)</span>
</label>
        `.trim();

        const newLabel = tempDiv.firstElementChild;
        const input = newLabel.querySelector("input");

        // 5. 顺延插入：注入到 label[2] 位置，把原本的 label[2]（类型下拉框）向后顺延
        const typeSelect = itemEl.querySelector('select[name="attr_bufftype"], select[name$="_bufftype"], select[name*="bufftype"]');
        const typeLabel = typeSelect ? typeSelect.closest("label") : null;
        const targetBeforeNode = (typeLabel && typeLabel.parentNode === nameLabel.parentNode)
            ? typeLabel
            : nameLabel.nextElementSibling;

        nameLabel.parentNode.insertBefore(newLabel, targetBeforeNode);

        // 6. 双向数据绑定
        const attrFullName = `${groupName}_${rowId}_init_rounds`;

        // 读取现有轮数公式值回填
        const initAttr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
        if (initAttr && initAttr.get("current") !== undefined && initAttr.get("current") !== null) {
            input.value = initAttr.get("current");
        }

        // 监听用户输入改动并写回 Backbone 属性
        const handleSave = () => {
            const val = input.value.trim();
            let attr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
            if (!attr) {
                if (val !== "") {
                    character.attribs.create({
                        name: attrFullName,
                        current: val
                    });
                    console.log(`[CharacterSheetBuffEnhancer] 角色卡创建初始轮数公式属性 ${attrFullName} = ${val}`);
                }
            } else {
                if (attr.get("current") !== val) {
                    attr.save({ current: val });
                    console.log(`[CharacterSheetBuffEnhancer] 角色卡更新初始轮数公式属性 ${attrFullName} = ${val}`);
                }
            }
        };

        input.addEventListener("change", handleSave);
        input.addEventListener("blur", handleSave);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                input.blur();
            }
        });

        // 监听外部模型数据变更反向同步到 input
        if (character.attribs?.on) {
            const syncFromModel = (changedAttr) => {
                if (changedAttr.get("name") === attrFullName) {
                    const cur = changedAttr.get("current") || "";
                    if (input.value !== cur && document.activeElement !== input) {
                        input.value = cur;
                    }
                }
            };
            character.attribs.on("change:current", syncFromModel);
        }
    }
}

    // ==========================================
    // 10. BuffPanelStyles (面板静态 CSS 样式)
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
    // 11. BuffPanelTemplates (面板静态 HTML 模板)
    // ==========================================
/**
 * BuffPanelTemplates.js
 * 状态Buff工作台结构模板辅助类（现已全面由具名字典与原生 DOM 替代）
 */
class BuffPanelTemplates {}

    // ==========================================
    // 12. BuffPanelDragDrop (面板拖拽手势交互)
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

            if (fromPane === "unit" && sourcePane === "unit") {
                if ((draggedNode.rowId && draggedNode.rowId === node.rowId) || (draggedNode.id && draggedNode.id === node.id)) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index);
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
            if (e.target === el || el.contains(e.target)) {
                e.preventDefault();
                el.classList.add("r20-drag-container-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove("r20-drag-container-over");
            }
        });

        el.addEventListener("drop", async (e) => {
            if (e.target === el || el.contains(e.target)) {
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
    // 13. BuffFloatingPanel (状态Buff悬浮工作台控制器)
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
                const newRowId = await SuiteConfigStore.addBuffToDatabase(
                    draggedNode.name, 
                    draggedNode.rounds, 
                    draggedNode.extraAttrs, 
                    draggedNode.initRounds
                );
                if (newRowId) {
                    this.showNotice(`已将 [${draggedNode.name}] 存入 Buff 模板库`);
                    await this.renderTemplatePane();
                } else {
                    this.showNotice("⚠️ 存入模板库失败：仅主持人 (GM) 具备创建模板角色卡权限");
                }
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
            const initRounds = item.dataset.initRounds || null;
            const extraAttrs = item._extraAttrs || null;

            await this.toggleBuffOnSelected(name, rounds, extraAttrs, initRounds);
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
        const currentInitRounds = isEditing && existingNode.initRounds ? existingNode.initRounds : "";
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

                    <label style="font-size:11px; color:#b0bec5;">预置初始轮数 / 公式 (每次开启自动求值):</label>
                    <input type="text" class="r20-input-text input-buff-init-rounds" value="${currentInitRounds}" placeholder="例如: 10、@{level}*10、10+@{constitution_mod}" />
                    <span style="font-size:10px; color:#78909c;">支持常数或 @{attr} 属性引用公式，开启时借用 Roll20 原生引擎自动求值。</span>

                    <label style="font-size:11px; color:#b0bec5;">当前剩余轮数 (留空视为永久):</label>
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

            const initRoundsVal = mask.querySelector(".input-buff-init-rounds").value.trim();
            const initRounds = initRoundsVal === "" ? null : initRoundsVal;

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
                        await Pf1eBuffManager.updateBuffRow(charTarget, rowId, name, rounds, extraAttrs, initRounds);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.initRounds = initRounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 " + charTarget.get("name") + " 的 Buff [" + name + "]", "success");
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderAllPanes();
                    } else {
                        // 2. 编辑模板库中的 Buff 模板
                        const rowId = existingNode.rowId || existingNode.id;
                        await SuiteConfigStore.updateBuffInDatabase(rowId, name, rounds, extraAttrs, initRounds);
                        existingNode.name = name;
                        existingNode.rounds = rounds;
                        existingNode.initRounds = initRounds;
                        existingNode.extraAttrs = extraAttrs;
                        this.showToast("✅ 已更新 Buff 模板 [" + name + "]", "success");
                        await this.renderTemplatePane();
                    }
                } else {
                    const newRowId = await SuiteConfigStore.addBuffToDatabase(name, rounds, extraAttrs, initRounds);
                    if (!newRowId) {
                        this.showToast("⚠️ 创建模板失败：战役未初始化公共配置卡，仅主持人 (GM) 具备自动创建权限。", "warn");
                        return;
                    }
                    this.currentTemplates.push({
                        id: newRowId,
                        rowId: newRowId,
                        type: "buff",
                        name,
                        rounds,
                        initRounds,
                        extraAttrs
                    });
                    await SuiteConfigStore.saveTopology(this.currentTemplates);
                    this.showToast("✨ 已创建 Buff 模板 [" + name + "]", "success");
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
                    },
                    onCrossCopy: async (draggedNode, targetFolder) => {
                        const newRowId = await SuiteConfigStore.addBuffToDatabase(
                            draggedNode.name,
                            draggedNode.rounds,
                            draggedNode.extraAttrs,
                            draggedNode.initRounds
                        );
                        if (newRowId) {
                            if (!targetFolder.children) targetFolder.children = [];
                            targetFolder.children.push({
                                id: newRowId,
                                rowId: newRowId,
                                type: "buff",
                                name: draggedNode.name,
                                rounds: draggedNode.rounds,
                                initRounds: draggedNode.initRounds,
                                extraAttrs: draggedNode.extraAttrs
                            });
                            await SuiteConfigStore.saveTopology(this.currentTemplates);
                            this.showNotice(`已将 [${draggedNode.name}] 存入文件夹 [${targetFolder.name}]`);
                            await this.renderTemplatePane();
                        } else {
                            this.showNotice("⚠️ 存入模板库失败：仅主持人 (GM) 具备创建模板角色卡权限");
                        }
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
                if (node.initRounds) item.dataset.initRounds = node.initRounds;
                item._extraAttrs = node.extraAttrs || null;
                item.draggable = true;

                const roundsText = (node.rounds !== null && node.rounds !== undefined && node.rounds !== "") 
                    ? (node.rounds + "轮") 
                    : (node.initRounds ? `[${node.initRounds}]` : "永久");

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
                    },
                    onCrossCopy: async (draggedNode, targetNode, parentList, targetIdx) => {
                        const newRowId = await SuiteConfigStore.addBuffToDatabase(
                            draggedNode.name,
                            draggedNode.rounds,
                            draggedNode.extraAttrs,
                            draggedNode.initRounds
                        );
                        if (newRowId) {
                            if (parentList) {
                                parentList.splice(targetIdx + 1, 0, {
                                    id: newRowId,
                                    rowId: newRowId,
                                    type: "buff",
                                    name: draggedNode.name,
                                    rounds: draggedNode.rounds,
                                    initRounds: draggedNode.initRounds,
                                    extraAttrs: draggedNode.extraAttrs
                                });
                                await SuiteConfigStore.saveTopology(this.currentTemplates);
                            }
                            this.showNotice(`已将 [${draggedNode.name}] 存入 Buff 模板库`);
                            await this.renderTemplatePane();
                        } else {
                            this.showNotice("⚠️ 存入模板库失败：仅主持人 (GM) 具备创建模板角色卡权限");
                        }
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
            summary.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <span>🛡️ ${tokenName}</span>
                    ${char ? `<button class="r20-btn-icon btn-recalc-char" title="强制触发角色卡加值重算 (recalc1)" style="font-size:11px; padding:0 4px; margin-right:4px; opacity:0.8;">🔄</button>` : ""}
                </div>
            `;
            if (char) {
                summary.querySelector(".btn-recalc-char")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    await Pf1eBuffManager.triggerRecalculate(char);
                    this.showNotice(`已触发 [${tokenName}] 加值重算`);
                });
            }
            details.appendChild(summary);

            const content = document.createElement("div");
            content.className = "r20-group-content";

            if (char) {
                const buffs = await Pf1eBuffManager.getAllBuffs(char);
                if (buffs.length === 0) {
                    content.innerHTML = '<div style="color:#78909c; font-size:10px; padding:4px;">(卡上暂无配置Buff)</div>';
                } else {
                    buffs.forEach((b, bIdx) => {
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

                        // 挂载拖拽排序与跨面板保存
                        BuffPanelDragDrop.setupItemDrag({
                            el: item,
                            node: b,
                            parentList: buffs,
                            index: bIdx,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onReorder: async (draggedNode, sourceList, sourceIdx, targetNode, targetList, targetIdx) => {
                                if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0) return;
                                const reordered = [...buffs];
                                const [moved] = reordered.splice(sourceIdx, 1);
                                reordered.splice(targetIdx, 0, moved);
                                const rowIds = reordered.map(item => item.rowId).filter(Boolean).join(",");
                                let orderAttr = char.attribs.models.find(a => a.get("name") === "_reporder_repeating_buff2");
                                if (!orderAttr) {
                                    char.attribs.create({ name: "_reporder_repeating_buff2", current: rowIds });
                                } else {
                                    orderAttr.save({ current: rowIds });
                                }
                                await this.renderUnitPane();
                            },
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs, draggedNode.initRounds);
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
                    buffs.forEach((b, bIdx) => {
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
                            parentList: buffs,
                            index: bIdx,
                            sourcePane: "unit",
                            getDraggedContext: () => this._draggedContext,
                            setDraggedContext: (ctx) => { this._draggedContext = ctx; },
                            onReorder: async (draggedNode, sourceList, sourceIdx, targetNode, targetList, targetIdx) => {
                                if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0) return;
                                const reordered = [...buffs];
                                const [moved] = reordered.splice(sourceIdx, 1);
                                reordered.splice(targetIdx, 0, moved);
                                TokenBuffManager.saveTokenBuffs(tokenItem.token, reordered);
                                await this.renderUnitPane();
                            },
                            onCrossCopy: async (draggedNode) => {
                                const newRowId = await SuiteConfigStore.addBuffToDatabase(draggedNode.name, draggedNode.rounds, draggedNode.extraAttrs, draggedNode.initRounds);
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
                        await Pf1eBuffManager.applyOrRefreshBuff(char, node.name, node.rounds, node.extraAttrs, node.initRounds);
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
    static async toggleBuffOnSelected(buffName, rounds, extraAttrs, initRounds = null) {
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
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs, initRounds);
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
    // 14. 引擎主入口启动流程
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

            // 4. 启动画布标记悬停原生提示探测器 (0 DOM 污染)
            try {
                CanvasMarkerHoverObserver.start();
                console.log("[Roll20Suite] CanvasMarkerHoverObserver 画布标记悬停探测器挂载成功");
            } catch (hoverErr) {
                console.error("[Roll20Suite] CanvasMarkerHoverObserver 挂载异常:", hoverErr);
            }

            // 5. 启动官方人物卡 Buff 预置初始轮数增强注入器
            try {
                CharacterSheetBuffEnhancer.init();
                console.log("[Roll20Suite] CharacterSheetBuffEnhancer 官方人物卡增强器挂载成功");
            } catch (enhancerErr) {
                console.error("[Roll20Suite] CharacterSheetBuffEnhancer 挂载异常:", enhancerErr);
            }

            // 6. 挂载命名空间供外部或开发者排查联动
            window.Roll20Suite = {
                Roll20Bridge,
                Pf1eConditionRegistry,
                Pf1eBuffManager,
                SuiteConfigStore,
                TurnOrderObserver,
                TokenBuffManager,
                Pf1eBuffUI,
                CanvasMarkerHoverObserver,
                CharacterSheetBuffEnhancer,
                BuffFloatingPanel
            };

            console.log("[Roll20Suite] PF1e Turnorder Buff 引擎全部就绪！");
        } catch (fatalErr) {
            console.error("[Roll20Suite] 引擎主入口遭遇致命异常:", fatalErr);
        }
    }

    main().catch(e => console.error("[Roll20Suite] main 未捕获 Promise 异常:", e));
})();
