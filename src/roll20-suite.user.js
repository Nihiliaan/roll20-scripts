// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.4.0
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成多级树状管理悬浮窗、拖拽排序、JSON细目编辑、卡上Buff导入、纯Token智能适配与同名幂等刷新
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.4.0...");

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
    // 2. TurnOrderObserver 先攻监听器
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
    // 3. TokenBuffManager (纯野怪 Token 状态引擎)
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
    // 4. Pf1eBuffManager (PF1e 角色卡数据管理层)
    // ==========================================
/**
 * Pf1eBuffManager.js
 * 负责扫描、添加、刷新、修改与关停 PF1e 角色卡上的原生 repeating_buff2 重复列表
 */
class Pf1eBuffManager {
    /**
     * 获取指定角色卡上所有当前处于勾选激活状态的 Buff
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 激活的 Buff 列表
     */
    static async getActiveBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);

        const activeBuffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 查找所有以 repeating_buff2_ 开头且以 _enable_toggle 结尾且等于 1 的属性
        const toggles = character.attribs.models.filter(a => {
            const name = a.get("name") || "";
            return name.startsWith("repeating_buff2_") && 
                   name.endsWith("_enable_toggle") && 
                   Number(a.get("current")) === 1;
        });

        for (const toggle of toggles) {
            const toggleName = toggle.get("name");
            const prefix = toggleName.substring(0, toggleName.lastIndexOf("_enable_toggle"));
            const rowId = prefix.replace("repeating_buff2_", "");

            const nameAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_name`);
            const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            const buffTypeAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_bufftype`);

            const name = nameAttr ? (nameAttr.get("current") || "未命名Buff") : "未命名Buff";
            const rounds = roundsAttr ? Number(roundsAttr.get("current")) : null;
            const buffType = buffTypeAttr ? buffTypeAttr.get("current") : "spell";

            activeBuffs.push({
                rowId,
                prefix,
                name,
                rounds: (rounds !== null && !isNaN(rounds)) ? rounds : null,
                buffType,
                toggleAttr: toggle,
                roundsAttr: roundsAttr || null
            });
        }

        return activeBuffs;
    }

    /**
     * 施加或刷新 Buff（核心幂等方法）
     * 1. 以名称判断：如果卡片中已有同名 Buff，直接启用 (_enable_toggle=1) 并刷新剩余轮数，保留其原有加值计算公式；
     * 2. 若无同名 Buff，则自动新建一行原生 Buff 并激活。
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
        const rowId = "-p" + Math.random().toString(36).substring(2, 12);
        const prefix = `repeating_buff2_${rowId}`;

        const nameAttr = character.attribs.create({ name: `${prefix}_name`, current: cleanName });
        const toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
        const typeAttr = character.attribs.create({ name: `${prefix}_bufftype`, current: "spell" });

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
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "bufftype" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生 Buff [${cleanName}], 轮数: ${rounds}`);
        return { rowId, prefix, name: cleanName, rounds, toggleAttr, roundsAttr };
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

        console.log(`[Pf1eBuffManager] 已解除 ${character.get("name")} 的 Buff (${rowId})`);
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
    // 5. Pf1eBuffUI 先攻条紧凑双行徽章
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
    // 6. BuffFloatingPanel (多级树状管理悬浮面板)
    // ==========================================
/**
 * BuffFloatingPanel.js
 * 核心悬浮窗组件：支持多级目录树管理、JSON 细目编辑、卡上 Buff 导入、
 * 文件夹独立全选、多选批量删除、双向拖拽（含移出到根目录）、纯 Token 智能适配。
 */
class BuffFloatingPanel {
    static STORAGE_KEY = "r20_buff_templates_v4";
    static POS_KEY = "r20_buff_panel_pos";

    static isEditMode = false;
    static isCollapsed = false;
    static panelEl = null;
    static templates = [];

    /**
     * 默认预设模板树（多级目录）
     */
    static defaultTemplates = [
        {
            id: "f_divine",
            type: "folder",
            name: "常用神术",
            collapsed: false,
            children: [
                {
                    id: "b_divine_favor",
                    type: "buff",
                    name: "神恩",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "luck",
                        "b1_macro-text": "min(3, max(1, floor(@{level}/3)))",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "dmg",
                        b2_bonustype: "luck",
                        "b2_macro-text": "min(3, max(1, floor(@{level}/3)))",
                        b2_val: 1
                    }
                },
                {
                    id: "b_bless",
                    type: "buff",
                    name: "祝福术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "morale",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "save-fear",
                        b2_bonustype: "morale",
                        b2_val: 1
                    }
                },
                {
                    id: "b_prayer",
                    type: "buff",
                    name: "祈祷术",
                    rounds: 5,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "luck",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "dmg",
                        b2_bonustype: "luck",
                        b2_val: 1
                    }
                },
                {
                    id: "f_high_divine",
                    type: "folder",
                    name: "高阶神术",
                    collapsed: false,
                    children: [
                        { id: "b_righteous_might", type: "buff", name: "正气如虹", rounds: 10, extraAttrs: { bufftype: "spell" } },
                        { id: "b_holy_aura", type: "buff", name: "圣洁灵光", rounds: 10, extraAttrs: { bufftype: "spell" } }
                    ]
                }
            ]
        },
        {
            id: "f_arcane",
            type: "folder",
            name: "奥术与防护",
            collapsed: false,
            children: [
                {
                    id: "b_haste",
                    type: "buff",
                    name: "加速术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "attack",
                        b1_bonustype: "dodge",
                        b1_val: 1,
                        "b2-show": 1,
                        b2_bonus: "AC",
                        b2_bonustype: "dodge",
                        b2_val: 1
                    }
                },
                {
                    id: "b_shield",
                    type: "buff",
                    name: "护盾术",
                    rounds: 10,
                    extraAttrs: {
                        bufftype: "spell",
                        "b1-show": 1,
                        b1_bonus: "AC",
                        b1_bonustype: "shield",
                        b1_val: 4
                    }
                },
                { id: "b_barkskin", type: "buff", name: "树皮术", rounds: 100, extraAttrs: { bufftype: "spell" } },
                { id: "b_mage_armor", type: "buff", name: "法师护甲", rounds: 600, extraAttrs: { bufftype: "spell" } }
            ]
        },
        {
            id: "f_debuff",
            type: "folder",
            name: "负面与妨害",
            collapsed: false,
            children: [
                { id: "b_entangled", type: "buff", name: "纠缠", rounds: 5, extraAttrs: { bufftype: "condition" } },
                { id: "b_slow", type: "buff", name: "缓慢术", rounds: 10, extraAttrs: { bufftype: "spell" } }
            ]
        }
    ];

    /**
     * 初始化悬浮面板
     */
    static init() {
        this.loadTemplates();
        this.injectStyles();
        this.createPanelDOM();
        this.renderTree();
        this.initDragWindow();
        console.log("[BuffFloatingPanel] 悬浮面板已成功加载");
    }

    /**
     * 读取模板数据
     */
    static loadTemplates() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                this.templates = JSON.parse(raw);
            } else {
                this.templates = JSON.parse(JSON.stringify(this.defaultTemplates));
                this.saveTemplates();
            }
        } catch (e) {
            this.templates = JSON.parse(JSON.stringify(this.defaultTemplates));
        }
    }

    /**
     * 保存模板数据
     */
    static saveTemplates() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.templates));
    }

    /**
     * 屏幕底部轻量提示（Toast）
     */
    static showToast(message, type = "info") {
        let toast = document.querySelector("#r20-toast-notification");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "r20-toast-notification";
            document.body.appendChild(toast);
        }
        toast.className = `r20-toast ${type}`;
        toast.innerHTML = message;
        toast.style.display = "block";
        toast.style.opacity = "1";

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => { toast.style.display = "none"; }, 300);
        }, 2200);
    }

    /**
     * 获取画布上当前选中的所有 Token（信任 Roll20 内置权限机制，直接尝试操作选中的每一个 Token）
     */
    static getSelectedControllableTokens() {
        if (!window.Campaign.engine || typeof window.Campaign.engine.getSelection !== "function") return [];
        const sel = window.Campaign.engine.getSelection();
        if (!Array.isArray(sel) || sel.length === 0) return [];

        const page = window.Campaign.pages.get(window.Campaign.get("playerpageid"));
        if (!page || !page.thegraphics) return [];

        const validTokens = [];

        for (const item of sel) {
            const tokenId = item.id;
            const token = page.thegraphics.get(tokenId);
            if (!token) continue;

            const charId = token.get("represents");
            if (charId) {
                const char = window.Campaign.characters.get(charId);
                if (char) {
                    validTokens.push({ token, char, type: "character" });
                } else {
                    validTokens.push({ token, char: null, type: "token" });
                }
            } else {
                validTokens.push({ token, char: null, type: "token" });
            }
        }

        return validTokens;
    }

    /**
     * 注入全局样式
     */
    static injectStyles() {
        if (document.querySelector("#r20-floating-panel-styles")) return;
        const style = document.createElement("style");
        style.id = "r20-floating-panel-styles";
        style.textContent = `
            #r20-buff-panel {
                position: fixed;
                top: 80px;
                right: 320px;
                width: 310px;
                background: #1a1e24;
                border: 1px solid #323d47;
                border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                color: #eceff1;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                user-select: none;
                transition: height 0.2s ease, width 0.2s ease;
            }
            #r20-buff-panel.collapsed {
                width: auto;
                height: 36px;
                overflow: hidden;
            }
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: #232b34;
                border-bottom: 1px solid #323d47;
                cursor: grab;
                border-radius: 8px 8px 0 0;
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
                gap: 6px;
            }
            .r20-btn-icon {
                background: none;
                border: none;
                color: #90a4ae;
                font-size: 12px;
                cursor: pointer;
                padding: 3px 6px;
                border-radius: 3px;
                transition: background 0.15s, color 0.15s;
            }
            .r20-btn-icon:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .r20-btn-icon.active {
                background: #1565c0;
                color: #ffffff;
            }
            .r20-btn-icon.danger:hover {
                background: #c62828;
                color: #ffffff;
            }
            .r20-panel-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 10px;
                background: #161b20;
                border-bottom: 1px solid #263238;
                font-size: 11px;
            }
            .r20-panel-tree {
                max-height: 400px;
                overflow-y: auto;
                padding: 6px 8px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
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
            .r20-drop-zone-root.active-zone {
                display: block;
            }
            .r20-drop-zone-root.r20-drag-into {
                background: rgba(33, 150, 243, 0.2);
                border-color: #64b5f6;
                color: #ffffff;
            }
            .r20-tree-folder {
                display: flex;
                flex-direction: column;
                margin-bottom: 2px;
            }
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
            }
            .r20-folder-header:hover {
                background: #2a3440;
                color: #ffffff;
            }
            .r20-folder-title {
                display: flex;
                align-items: center;
                gap: 5px;
                overflow: hidden;
            }
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
                transition: background 0.15s;
                border: 1px solid transparent;
            }
            .r20-tree-item:hover {
                background: #2e3947;
                border-color: #64b5f6;
                color: #ffffff;
            }
            .r20-item-left {
                display: flex;
                align-items: center;
                gap: 6px;
                overflow: hidden;
            }
            .r20-item-name {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .r20-item-rounds {
                font-size: 10px;
                color: #90caf9;
                background: rgba(144, 202, 249, 0.1);
                padding: 1px 4px;
                border-radius: 3px;
            }
            .r20-item-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .r20-panel-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                background: #191f26;
                border-top: 1px solid #323d47;
                border-radius: 0 0 8px 8px;
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
            .r20-btn-danger {
                background: #c62828;
                color: #ffffff;
                font-size: 11px;
                font-weight: 600;
                padding: 5px 10px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
            }
            .r20-btn-danger:hover { background: #d32f2f; }

            /* 拖拽态高亮 */
            .r20-drag-over {
                border-top: 2px solid #64b5f6 !important;
            }
            .r20-drag-into {
                background: rgba(25, 118, 210, 0.3) !important;
            }

            /* Toast 提示 */
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
                z-index: 999999;
                pointer-events: none;
                transition: opacity 0.3s;
                display: none;
            }
            .r20-toast.warn { border-color: #ffb74d; color: #ffe082; }
            .r20-toast.success { border-color: #81c784; color: #c8e6c9; }

            /* JSON 与导入对话框通用样式 */
            .r20-dialog-mask {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.65);
                z-index: 1000000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .r20-dialog-box {
                background: #1e242c;
                border: 1px solid #37474f;
                border-radius: 8px;
                width: 420px;
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
        `;
        document.head.appendChild(style);
    }

    /**
     * 创建悬浮面板主 DOM
     */
    static createPanelDOM() {
        if (document.querySelector("#r20-buff-panel")) return;

        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";

        // 读取持久化位置
        const savedPos = localStorage.getItem(this.POS_KEY);
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                panel.style.top = `${pos.top}px`;
                panel.style.left = `${pos.left}px`;
                panel.style.right = "auto";
            } catch (e) {}
        }

        panel.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-panel-title">
                    <span>🛡️</span>
                    <span>状态Buff库</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-edit" title="打开/关闭编辑与排序模式">✏️ 编辑</button>
                    <button class="r20-btn-icon btn-minimize" title="最小化收起">─</button>
                </div>
            </div>
            <div class="r20-panel-body">
                <div class="r20-panel-toolbar" style="display: none;">
                    <div style="display:flex; gap:4px;">
                        <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                        <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                        <button class="r20-btn-icon btn-import-buffs" title="从选中角色卡导入现有Buff">📥 导入卡上Buff</button>
                    </div>
                    <button class="r20-btn-icon danger btn-batch-delete" title="批量删除勾选项">🗑️ 批量删除</button>
                </div>
                <div class="r20-panel-tree"></div>
                <div class="r20-panel-footer">
                    <label style="font-size:11px; display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" class="cb-select-all-buffs" />
                        <span>全选</span>
                    </label>
                    <button class="r20-btn-apply btn-batch-apply">🚀 施加选中Buff</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panelEl = panel;

        // 绑定最小化与编辑模式切换
        panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());
        panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());

        // 绑定全选与批量施加
        panel.querySelector(".cb-select-all-buffs").addEventListener("change", (e) => {
            const checked = e.target.checked;
            panel.querySelectorAll(".r20-buff-item-cb").forEach(cb => cb.checked = checked);
            panel.querySelectorAll(".r20-folder-select-cb").forEach(cb => cb.checked = checked);
        });

        panel.querySelector(".btn-batch-apply").addEventListener("click", () => this.applySelectedBuffs());

        // 编辑模式工具栏按钮
        panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showBuffEditorDialog());
        panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
        panel.querySelector(".btn-import-buffs").addEventListener("click", () => this.showImportFromCharacterDialog());
        panel.querySelector(".btn-batch-delete").addEventListener("click", () => this.deleteSelectedBuffs());
    }

    /**
     * 最小化折叠切换
     */
    static toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        const body = this.panelEl.querySelector(".r20-panel-body");
        const minBtn = this.panelEl.querySelector(".btn-minimize");
        if (this.isCollapsed) {
            body.style.display = "none";
            this.panelEl.classList.add("collapsed");
            minBtn.textContent = "▢";
        } else {
            body.style.display = "block";
            this.panelEl.classList.remove("collapsed");
            minBtn.textContent = "─";
        }
    }

    /**
     * 编辑模式切换
     */
    static toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        const editBtn = this.panelEl.querySelector(".btn-toggle-edit");
        const toolbar = this.panelEl.querySelector(".r20-panel-toolbar");
        if (this.isEditMode) {
            editBtn.classList.add("active");
            editBtn.textContent = "🔒 完成";
            toolbar.style.display = "flex";
        } else {
            editBtn.classList.remove("active");
            editBtn.textContent = "✏️ 编辑";
            toolbar.style.display = "none";
        }
        this.renderTree();
    }

    /**
     * 递归渲染目录树
     */
    static renderTree() {
        const treeContainer = this.panelEl.querySelector(".r20-panel-tree");
        if (!treeContainer) return;
        treeContainer.innerHTML = "";

        // 在树的最顶部增加一个“移出到根目录”放置区（仅编辑模式展示）
        const topDropZone = document.createElement("div");
        topDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        topDropZone.textContent = "⬆️ 拖到此处：移出到根目录最上方";
        this.setupRootDropZone(topDropZone, 0);
        treeContainer.appendChild(topDropZone);

        const renderNodes = (nodes, container) => {
            nodes.forEach((node, index) => {
                if (node.type === "folder") {
                    const folderEl = document.createElement("div");
                    folderEl.className = "r20-tree-folder";
                    folderEl.dataset.id = node.id;
                    if (this.isEditMode) folderEl.draggable = true;

                    const isClosed = !!node.collapsed;
                    folderEl.innerHTML = `
                        <div class="r20-folder-header">
                            <div class="r20-folder-title">
                                <span>${isClosed ? "▶" : "▼"}</span>
                                <span>📁 ${node.name}</span>
                            </div>
                            <div class="r20-item-actions">
                                <label style="font-size:10px; display:flex; align-items:center; gap:2px; cursor:pointer;" title="全选/反选本文件夹内所有Buff">
                                    <input type="checkbox" class="r20-folder-select-cb" data-folder-id="${node.id}" />
                                    <span>选</span>
                                </label>
                                ${this.isEditMode ? `<button class="r20-btn-icon btn-edit-folder" title="重命名目录">✏️</button>` : ""}
                            </div>
                        </div>
                        <div class="r20-folder-children" style="display: ${isClosed ? 'none' : 'flex'};"></div>
                    `;

                    // 展开/收折文件夹
                    folderEl.querySelector(".r20-folder-title").addEventListener("click", (e) => {
                        e.stopPropagation();
                        node.collapsed = !node.collapsed;
                        this.saveTemplates();
                        this.renderTree();
                    });

                    // 文件夹独立全选/反选
                    folderEl.querySelector(".r20-folder-select-cb").addEventListener("click", (e) => {
                        e.stopPropagation();
                    });
                    folderEl.querySelector(".r20-folder-select-cb").addEventListener("change", (e) => {
                        e.stopPropagation();
                        const isChecked = e.target.checked;
                        const childCheckboxes = folderEl.querySelectorAll(".r20-buff-item-cb");
                        childCheckboxes.forEach(cb => cb.checked = isChecked);
                    });

                    if (this.isEditMode) {
                        folderEl.querySelector(".btn-edit-folder").addEventListener("click", (e) => {
                            e.stopPropagation();
                            const newName = prompt("重命名文件夹:", node.name);
                            if (newName && newName.trim()) {
                                node.name = newName.trim();
                                this.saveTemplates();
                                this.renderTree();
                            }
                        });

                        this.setupDragEvents(folderEl, node, nodes, index);
                    }

                    const childrenContainer = folderEl.querySelector(".r20-folder-children");
                    if (node.children && node.children.length > 0) {
                        renderNodes(node.children, childrenContainer);
                    }

                    container.appendChild(folderEl);
                } else if (node.type === "buff") {
                    const itemEl = document.createElement("div");
                    itemEl.className = "r20-tree-item";
                    itemEl.dataset.id = node.id;
                    if (this.isEditMode) itemEl.draggable = true;

                    const showRounds = node.rounds !== null && !isNaN(node.rounds) && node.rounds <= 100;
                    const roundsLabel = (node.rounds === null || isNaN(node.rounds)) ? "永久" : (showRounds ? `${node.rounds}轮` : "永久");

                    itemEl.innerHTML = `
                        <div class="r20-item-left">
                            <input type="checkbox" class="r20-buff-item-cb" data-id="${node.id}" />
                            <span class="r20-item-name">${node.name}</span>
                            <span class="r20-item-rounds">${roundsLabel}</span>
                        </div>
                        ${this.isEditMode ? `
                            <div class="r20-item-actions">
                                <button class="r20-btn-icon btn-edit-buff" title="编辑细目属性">✏️</button>
                                <button class="r20-btn-icon btn-clone-buff" title="复制">📋</button>
                            </div>
                        ` : ""}
                    `;

                    // 复选框点击防止冒泡触发点击施加
                    itemEl.querySelector(".r20-buff-item-cb").addEventListener("click", (e) => {
                        e.stopPropagation();
                    });

                    if (!this.isEditMode) {
                        // 正常模式：点击条目直接施加
                        itemEl.addEventListener("click", (e) => {
                            if (e.target.tagName === "INPUT") return;
                            this.applySingleBuff(node.name, node.rounds, node.extraAttrs);
                        });
                    } else {
                        // 编辑模式操作
                        itemEl.querySelector(".btn-edit-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.showBuffEditorDialog(node);
                        });
                        itemEl.querySelector(".btn-clone-buff").addEventListener("click", (e) => {
                            e.stopPropagation();
                            this.cloneBuff(node, nodes, index);
                        });

                        this.setupDragEvents(itemEl, node, nodes, index);
                    }

                    container.appendChild(itemEl);
                }
            });
        };

        renderNodes(this.templates, treeContainer);

        // 在树的最底部增加一个“移出到根目录”放置区（仅编辑模式展示）
        const bottomDropZone = document.createElement("div");
        bottomDropZone.className = `r20-drop-zone-root ${this.isEditMode ? "active-zone" : ""}`;
        bottomDropZone.textContent = "⬇️ 拖到此处：移出到根目录最下方";
        this.setupRootDropZone(bottomDropZone, this.templates.length);
        treeContainer.appendChild(bottomDropZone);
    }

    /**
     * 根层级拖拽放置区（用于将子文件夹内部节点拖出）
     */
    static setupRootDropZone(el, targetIndex) {
        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("r20-drag-into");
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-into");
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-into");

            if (!this._draggedData) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            // 从源位置移除
            sourceList.splice(sourceIdx, 1);

            // 插入根列表对应位置
            const realIdx = Math.min(targetIndex, this.templates.length);
            this.templates.splice(realIdx, 0, draggedNode);

            this._draggedData = null;
            this.saveTemplates();
            this.renderTree();
            this.showToast(`✨ 已成功将 [${draggedNode.name}] 移出到根目录`, "success");
        });
    }

    /**
     * 施加单个 Buff 到选中的棋子
     */
    static async applySingleBuff(buffName, rounds, extraAttrs = null) {
        const selected = this.getSelectedControllableTokens();
        if (selected.length === 0) {
            this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
            return;
        }

        let appliedCount = 0;
        for (const item of selected) {
            if (item.type === "character" && item.char) {
                await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds, extraAttrs);
                appliedCount++;
            } else if (item.type === "token" && item.token) {
                TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds, extraAttrs);
                appliedCount++;
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        const roundsText = (rounds === null || isNaN(rounds) || rounds > 100) ? "永久" : `${rounds}轮`;
        this.showToast(`✨ 已为 ${appliedCount} 个棋子施加 [${buffName} ${roundsText}]`, "success");
    }

    /**
     * 批量应用复选框选中的 Buff
     */
    static async applySelectedBuffs() {
        const checkedBoxes = Array.from(this.panelEl.querySelectorAll(".r20-buff-item-cb:checked"));
        if (checkedBoxes.length === 0) {
            this.showToast("⚠️ 请先勾选要施加的 Buff 模板", "warn");
            return;
        }

        const selectedTokens = this.getSelectedControllableTokens();
        if (selectedTokens.length === 0) {
            this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
            return;
        }

        const buffIds = checkedBoxes.map(cb => cb.dataset.id);
        const buffsToApply = [];

        const findBuffs = (nodes) => {
            for (const n of nodes) {
                if (n.type === "buff" && buffIds.includes(n.id)) buffsToApply.push(n);
                if (n.type === "folder" && n.children) findBuffs(n.children);
            }
        };
        findBuffs(this.templates);

        for (const target of selectedTokens) {
            for (const buff of buffsToApply) {
                if (target.type === "character" && target.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(target.char, buff.name, buff.rounds, buff.extraAttrs);
                } else if (target.type === "token" && target.token) {
                    TokenBuffManager.applyOrRefreshBuff(target.token, buff.name, buff.rounds, buff.extraAttrs);
                }
            }
        }

        await Pf1eBuffUI.refreshAllBadges();
        this.showToast(`🚀 已为 ${selectedTokens.length} 个棋子批量施加 ${buffsToApply.length} 项 Buff！`, "success");
    }

    /**
     * 批量删除选中的 Buff 项
     */
    static deleteSelectedBuffs() {
        const checkedBoxes = Array.from(this.panelEl.querySelectorAll(".r20-buff-item-cb:checked"));
        if (checkedBoxes.length === 0) {
            this.showToast("⚠️ 请先勾选要批量删除的 Buff 项", "warn");
            return;
        }

        if (!confirm(`确定要批量删除选中的 ${checkedBoxes.length} 个 Buff 模板吗？`)) return;

        const idsToDelete = new Set(checkedBoxes.map(cb => cb.dataset.id));
        const removeRecursive = (list) => {
            for (let i = list.length - 1; i >= 0; i--) {
                if (idsToDelete.has(list[i].id)) {
                    list.splice(i, 1);
                } else if (list[i].children) {
                    removeRecursive(list[i].children);
                }
            }
        };

        removeRecursive(this.templates);
        this.saveTemplates();
        this.renderTree();
        this.showToast(`🗑️ 已成功批量删除 ${checkedBoxes.length} 项 Buff`, "success");
    }

    /**
     * HTML5 拖拽事件监听（支持排序与放入文件夹）
     */
    static setupDragEvents(el, node, parentList, index) {
        el.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            this._draggedData = { node, parentList, index };
            e.dataTransfer.setData("text/plain", node.id);
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

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");

            if (!this._draggedData || this._draggedData.node.id === node.id) return;

            const { node: draggedNode, parentList: sourceList, index: sourceIdx } = this._draggedData;

            // 1. 从源列表移除
            sourceList.splice(sourceIdx, 1);

            // 2. 放入目标位置
            if (node.type === "folder") {
                // 拖入文件夹内
                node.children = node.children || [];
                node.children.push(draggedNode);
                node.collapsed = false;
            } else {
                // 插在同级当前项之后
                parentList.splice(index, 0, draggedNode);
            }

            this._draggedData = null;
            this.saveTemplates();
            this.renderTree();
        });
    }

    /**
     * 复制一个 Buff 模板
     */
    static cloneBuff(node, list, index) {
        const clone = {
            id: "b_" + Date.now(),
            type: "buff",
            name: `${node.name} (副本)`,
            rounds: node.rounds,
            extraAttrs: node.extraAttrs ? JSON.parse(JSON.stringify(node.extraAttrs)) : null
        };
        list.splice(index + 1, 0, clone);
        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 新建文件夹弹窗
     */
    static showNewFolderDialog() {
        const name = prompt("请输入新文件夹名称:");
        if (!name || !name.trim()) return;

        this.templates.push({
            id: "f_" + Date.now(),
            type: "folder",
            name: name.trim(),
            collapsed: false,
            children: []
        });
        this.saveTemplates();
        this.renderTree();
    }

    /**
     * 新建/编辑 Buff 弹窗（带简易 JSON 细目编辑器与永久选项）
     */
    static showBuffEditorDialog(existingNode = null) {
        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? existingNode.name : "";
        const currentRounds = isEditing && existingNode.rounds !== null ? existingNode.rounds : "";
        const currentJson = isEditing && existingNode.extraAttrs ? JSON.stringify(existingNode.extraAttrs, null, 2) :
`{
  "bufftype": "spell",
  "b1-show": 1,
  "b1_bonus": "attack",
  "b1_bonustype": "luck",
  "b1_val": 1
}`;

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${isEditing ? "编辑 Buff 模板" : "新建 Buff 模板"}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-buff-name" value="${currentName}" placeholder="例如: 神恩、加速术..." />

                    <label style="font-size:11px; color:#b0bec5;">持续轮数 (留空视为永久):</label>
                    <input type="number" class="r20-input-text input-buff-rounds" value="${currentRounds}" placeholder="留空或大于100视为永久" />

                    <label style="font-size:11px; color:#b0bec5;">PF1e 细目加值字典 (JSON 格式):</label>
                    <textarea class="r20-textarea-json input-buff-json">${currentJson}</textarea>
                    <span style="font-size:10px; color:#78909c;">提示: 可配置 b1_bonus, b1_bonustype, b1_val, b1_macro-text 等人物卡原生字段。</span>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) {
                alert("请输入 Buff 名称");
                return;
            }

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try {
                    extraAttrs = JSON.parse(jsonText);
                } catch (err) {
                    alert("JSON 细目格式错误，请检查语法:\n" + err.message);
                    return;
                }
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

            this.saveTemplates();
            this.renderTree();
            mask.remove();
            this.showToast(`✅ 已成功保存 Buff [${name}]`, "success");
        });
    }

    /**
     * 从画布选中的角色卡导入 Buff 弹窗（可复选导入项，并可指定目标文件夹）
     */
    static async showImportFromCharacterDialog() {
        const selected = this.getSelectedControllableTokens();
        const charItem = selected.find(s => s.type === "character" && s.char);

        if (!charItem) {
            this.showToast("⚠️ 请先在画布上选择一个绑定了人物卡的棋子", "warn");
            return;
        }

        const character = charItem.char;
        await Roll20Bridge.ensureCharacterAttributes(character);

        // 扫描该卡上现有的所有 repeating_buff2
        const cardBuffs = [];
        if (character.attribs && character.attribs.models) {
            character.attribs.models.forEach(a => {
                const attrName = a.get("name") || "";
                if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_name")) {
                    const prefix = attrName.substring(0, attrName.lastIndexOf("_name"));
                    const rowId = prefix.replace("repeating_buff2_", "");
                    const name = a.get("current") || "未命名Buff";

                    const roundsAttr = character.attribs.models.find(x => x.get("name") === `${prefix}_rounds`);
                    const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;

                    // 收集细目
                    const extraAttrs = {};
                    character.attribs.models.forEach(m => {
                        const mName = m.get("name") || "";
                        if (mName.startsWith(`${prefix}_`)) {
                            const subKey = mName.substring(prefix.length + 1);
                            if (subKey !== "name" && subKey !== "enable_toggle" && subKey !== "rounds") {
                                extraAttrs[subKey] = m.get("current");
                            }
                        }
                    });

                    cardBuffs.push({
                        name,
                        rounds,
                        extraAttrs
                    });
                }
            });
        }

        if (cardBuffs.length === 0) {
            this.showToast(`ℹ️ 角色 [${character.get("name")}] 卡上未找到任何 Buff 条目`, "warn");
            return;
        }

        // 获取所有可用的目标文件夹列表
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
        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 480px;">
                <div class="r20-dialog-header">从 [${character.get("name")}] 导入 Buff</div>
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

        document.body.appendChild(mask);

        mask.querySelector(".cb-import-select-all").addEventListener("change", (e) => {
            const checked = e.target.checked;
            mask.querySelectorAll(".cb-import-item").forEach(cb => cb.checked = checked);
        });

        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        mask.querySelector(".btn-confirm-import").addEventListener("click", () => {
            const checkedBoxes = Array.from(mask.querySelectorAll(".cb-import-item:checked"));
            if (checkedBoxes.length === 0) {
                alert("请先勾选至少一个要导入的 Buff 条目");
                return;
            }

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

            this.saveTemplates();
            this.renderTree();
            mask.remove();
            this.showToast(`🎉 已成功导入 ${checkedBoxes.length} 项 Buff！`, "success");
        });
    }

    /**
     * 悬浮窗鼠标拖拽移动
     */
    static initDragWindow() {
        const header = this.panelEl.querySelector(".r20-panel-header");
        let isDragging = false;
        let startX, startY, initialX, initialY;

        header.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            isDragging = true;
            header.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            initialX = this.panelEl.offsetLeft;
            initialY = this.panelEl.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const newLeft = Math.max(10, Math.min(window.innerWidth - 320, initialX + dx));
                const newTop = Math.max(10, Math.min(window.innerHeight - 80, initialY + dy));

                this.panelEl.style.left = `${newLeft}px`;
                this.panelEl.style.top = `${newTop}px`;
                this.panelEl.style.right = "auto";
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    localStorage.setItem(this.POS_KEY, JSON.stringify({
                        left: this.panelEl.offsetLeft,
                        top: this.panelEl.offsetTop
                    }));
                }
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
    }
}

    // ==========================================
    // 7. 核心装配与启动主入口
    // ==========================================
    async function main() {
        console.log("[Roll20Suite] 等待 Roll20 核心对象就绪...");
        const ready = await Roll20Bridge.waitForReady();
        if (!ready) {
            console.error("[Roll20Suite] Roll20 初始化超时，脚本中止");
            return;
        }
        console.log("[Roll20Suite] Roll20 Jumpgate 环境就绪，初始化模块...");

        const observer = new TurnOrderObserver();

        // 回合结束：触发人物卡与纯 Token 双轨扣减
        observer.on("turnEnded", async ({ endedTokenId }) => {
            const character = Roll20Bridge.getCharacterByToken(endedTokenId);
            if (character) {
                await Pf1eBuffManager.tickBuffsOnTurnEnd(endedTokenId);
            } else {
                TokenBuffManager.tickBuffsOnTurnEnd(endedTokenId);
            }
            await Pf1eBuffUI.refreshAllBadges();
        });

        observer.on("orderChanged", async () => {
            setTimeout(async () => {
                await Pf1eBuffUI.refreshAllBadges();
            }, 60);
        });

        observer.start();

        // 初始化悬浮窗
        BuffFloatingPanel.init();

        setTimeout(async () => {
            await Pf1eBuffUI.refreshAllBadges();
        }, 800);

        console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.4.0 全部就绪！");
    }

    main();
})();
