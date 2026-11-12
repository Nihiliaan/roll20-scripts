// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/Nihiliaan/roll20-scripts
// @version      0.9.28
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成极简标题栏基准展开定位、Jumpgate原生选区联动、Vue响应式先攻徽章防护与原生角色卡完全同步
// @author       Nihil & Antigravity
// @license      MIT
// @homepageURL  https://github.com/Nihiliaan/roll20-scripts
// @supportURL   https://github.com/Nihiliaan/roll20-scripts/issues
// @match        https://app.roll20.net/editor/*
// @noframes
// @updateURL    https://update.greasyfork.org/scripts/603253/roll20-suite-pf1e-turnorder-buff-engine.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/603253/roll20-suite-pf1e-turnorder-buff-engine.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 0. 单例守卫与热重载注销：若页面上已存在旧实例，先触发完全卸载，规避事件重复注册导致的双重扣轮事故
    if (window.Roll20Suite && typeof window.Roll20Suite.__teardown === "function") {
        console.log("[Roll20Suite] 检测到已存在运行实例，执行热重载清理旧生命周期...");
        try {
            window.Roll20Suite.__teardown();
        } catch (teardownErr) {
            console.error("[Roll20Suite] 旧实例 teardown 异常:", teardownErr);
        }
    }

    const cleanups = [];
    function registerCleanup(fn) {
        if (typeof fn === "function") {
            cleanups.push(fn);
        }
    }

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.9.28...");

    // 致命异常浮动通知横条
    function showFatalErrorBanner(reason, details) {
        if (typeof document === "undefined" || document.getElementById("r20-suite-fatal-banner")) return;
        const banner = document.createElement("div");
        banner.id = "r20-suite-fatal-banner";
        banner.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:999999;max-width:420px;padding:12px 16px;background:#2b1b1b;border:1px solid #d9534f;border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,0.5);color:#f8d7da;font-family:sans-serif;font-size:12px;line-height:1.5;";
        const safeReason = (typeof Roll20Bridge !== "undefined" && Roll20Bridge.escapeHtml) ? Roll20Bridge.escapeHtml(reason) : reason;
        banner.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <strong style="color:#ff6b6b;font-size:13px;">⚠️ Roll20 Suite (v0.9.28) 启动受阻</strong>
                <button id="r20-fatal-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;padding:0 4px;line-height:1;">&times;</button>
            </div>
            <div style="margin-bottom:8px;color:#eee;">${safeReason}</div>
            <div style="display:flex;gap:8px;">
                <button id="r20-fatal-copy" style="background:#d9534f;color:#fff;border:none;border-radius:3px;padding:4px 8px;cursor:pointer;font-size:11px;">复制诊断信息</button>
            </div>
        `;
        document.body.appendChild(banner);
        const closeBtn = banner.querySelector("#r20-fatal-close");
        if (closeBtn) closeBtn.onclick = () => banner.remove();
        const copyBtn = banner.querySelector("#r20-fatal-copy");
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                const diag = {
                    version: "0.9.28",
                    time: new Date().toISOString(),
                    href: window.location.href,
                    hasCampaign: typeof window.Campaign !== "undefined",
                    hasJumpgate: typeof window.d20 !== "undefined",
                    reason: reason,
                    details: details ? (details.stack || details.message || String(details)) : null,
                    userAgent: navigator.userAgent
                };
                navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).then(() => {
                    e.target.textContent = "已复制！";
                    setTimeout(() => { if (e.target) e.target.textContent = "复制诊断信息"; }, 2000);
                }).catch(() => {
                    console.error("[Roll20Suite] 复制失败，诊断信息:", diag);
                });
            };
        }
    }

    // ==========================================
    // 1. Roll20Bridge 核心通信层
    // ==========================================
/**
 * Roll20Bridge.js
 * 封装与 Roll20 Jumpgate 现代架构的核心交互通道
 */

/**
 * 转义 HTML 特殊字符，防范 XSS 漏洞
 * @param {*} str 待转义的原始字符串
 * @returns {string} 转义后的安全字符串
 */
function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

class Roll20Bridge {
    /**
     * 转义 HTML 特殊字符 (委托给 escapeHtml)
     */
    static escapeHtml(str) {
        return escapeHtml(str);
    }
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

        // 1. 优先命中当前玩家页面 (99% 场景，O(1) 瞬时哈希定位)
        const curPage = this.getCurrentPage();
        if (curPage && curPage.thegraphics) {
            const token = curPage.thegraphics.get(tokenId);
            if (token) return token;
        }

        // 2. 跨图兜底：遍历其他页面寻找该 Token
        for (let i = 0; i < campaign.pages.length; i++) {
            const page = campaign.pages.at(i);
            if (page && page !== curPage && page.thegraphics) {
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
    static resolveBuffTargetMode(tokenOrId) {
        const token = typeof tokenOrId === "string" ? this.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) {
            return { mode: "token", char: null, token: null, isMook: false };
        }

        const char = this.getCharacterByToken(token);
        if (!char) {
            // 无人物卡的纯图元
            return { mode: "token", char: null, token, isMook: false };
        }

        // 1. 检查人物卡是否为 NPC / Monster ("THIS is an NPC OR MONSTER" -> is_npc === "1")
        const isNpcAttr = char.attribs ? char.attribs.models.find(a => a.get("name") === "is_npc") : null;
        const isNpcVal = isNpcAttr ? String(isNpcAttr.get("current") ?? "").trim() : "";
        const isNpc = isNpcVal === "1";

        if (!isNpc) {
            // 玩家角色卡 (PC)：无论当前地图或全战役有几个棋子（如镜像、多视角、跨图），始终代表同一人，统一持久化至人物卡
            return { mode: "char", char, token, isMook: false };
        }

        // 2. 怪物卡 (NPC)：检查当前作战地图/所属集合中的棋子数量
        let tokenCountOnPage = 1;
        const charId = char.id;

        if (token.collection && Array.isArray(token.collection.models)) {
            tokenCountOnPage = token.collection.models.filter(g => g.get("represents") === charId).length;
        } else {
            const pageId = token.get("page_id") || token.get("_pageid");
            const campaign = this.getCampaign();
            if (campaign && campaign.pages && pageId) {
                const page = campaign.pages.get(pageId);
                if (page && page.thegraphics) {
                    tokenCountOnPage = page.thegraphics.filter(g => g.get("represents") === charId).length;
                }
            }
        }

        if (tokenCountOnPage > 1) {
            // 多棋子杂兵集群 (Mooks)：自动隔离降级至 Token 本地独立存储 (TokenBuffManager)
            return { mode: "token", char, token, isMook: true };
        }

        // 独占有名怪 / Boss：走人物卡持久化
        return { mode: "char", char, token, isMook: false };
    }

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
        if (window.currentPlayer && window.currentPlayer.id) {
            return window.currentPlayer.id;
        }
        if (window.currentPlayer && typeof window.currentPlayer.get === "function") {
            const id = window.currentPlayer.get("id") || window.currentPlayer.id;
            if (id) return id;
        }
        if (window.d20_player_id) {
            return window.d20_player_id;
        }
        if (window.Campaign && window.Campaign.currentPlayer && window.Campaign.currentPlayer.id) {
            return window.Campaign.currentPlayer.id;
        }
        return null;
    }

    /**
     * 判断当前用户对特定角色卡是否拥有完全控制权限
     * @param {string|object} charOrId 角色卡对象或角色卡ID
     * @returns {boolean}
     */
    static canControlCharacter(charOrId) {
        if (this.isGM()) return true;
        if (!charOrId) return false;
        let char = null;
        if (typeof charOrId === "string") {
            const campaign = this.getCampaign();
            char = campaign && campaign.characters ? campaign.characters.get(charOrId) : null;
        } else if (charOrId && typeof charOrId.get === "function") {
            char = charOrId;
        }
        if (!char) return false;

        const rawControlledBy = char.get ? char.get("controlledby") : char.controlledby;
        if (!rawControlledBy || typeof rawControlledBy !== "string") return false;

        const controlledBy = rawControlledBy.split(",").map(id => id.trim()).filter(Boolean);
        if (controlledBy.includes("all")) return true;

        const myPlayerId = this.getCurrentPlayerId();
        return !!(myPlayerId && controlledBy.includes(myPlayerId));
    }

    /**
     * 判断当前用户对特定 Token/角色卡是否拥有完全控制或查看权限
     * （GM 拥有全域权限；普通玩家仅能控制自身或被授权全部人的单位）
     * @param {string|object} tokenOrId Token对象或TokenID或角色卡ID
     * @returns {boolean}
     */
    static canControlToken(tokenOrId) {
        if (this.isGM()) return true;

        const token = typeof tokenOrId === "string" ? this.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) {
            // 兼容性：如果传入的 ID 为人物卡 ID 或直接为人物卡模型
            if (typeof tokenOrId === "string" || (tokenOrId && typeof tokenOrId.get === "function")) {
                return this.canControlCharacter(tokenOrId);
            }
            return false;
        }

        // 1. 若关联了人物卡，优先依据人物卡的控制权限判定
        const character = this.getCharacterByToken(token);
        if (character) {
            return this.canControlCharacter(character);
        }

        // 2. 若为纯野怪 Token，依据 Token 自身控制权判定
        const rawControlledBy = token.get ? token.get("controlledby") : token.controlledby;
        if (!rawControlledBy || typeof rawControlledBy !== "string") return false;

        const tokenControlledBy = rawControlledBy.split(",").map(id => id.trim()).filter(Boolean);
        if (tokenControlledBy.includes("all")) return true;

        const myPlayerId = this.getCurrentPlayerId();
        return !!(myPlayerId && tokenControlledBy.includes(myPlayerId));
    }

    /**
     * 判断特定对象（角色卡/Token）是否被标记为队伍成员（隊員，即 inParty === true）
     * 对应角色卡设置中的 .character-party-toggle 复选框
     * @param {string|object} target
     * @returns {boolean}
     */
    static isPartyMember(target) {
        if (!target) return false;
        let char = null;
        if (typeof target === "string") {
            const campaign = this.getCampaign();
            char = campaign?.characters?.get(target);
            if (!char) {
                const token = this.getTokenGraphic(target);
                if (token) char = this.getCharacterByToken(token);
            }
        } else if (target.get && typeof target.get === "function") {
            if (target.get("represents") !== undefined) {
                // Token graphic 模型
                char = this.getCharacterByToken(target);
            } else {
                // Character 模型
                char = target;
            }
        }
        if (!char) return false;
        const inParty = char.get ? char.get("inParty") : char.inParty;
        return inParty === true || inParty === "true" || inParty === 1 || inParty === "1";
    }

    /**
     * 判断当前登录玩家是否为队伍成员（名下控制至少一个 inParty === true 的角色）
     * @returns {boolean}
     */
    static isCurrentPlayerInParty() {
        if (this.isGM()) return true;
        const campaign = this.getCampaign();
        const characters = campaign?.characters?.models || [];
        for (const c of characters) {
            if (this.canControlCharacter(c) && this.isPartyMember(c)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断当前用户对特定角色卡是否具备 Buff 查看权限（读权限）
     * GM、拥有控制权者、以及开启队友互见设置后的合法队伍成员均具备查看权限
     * @param {string|object} charOrId
     * @returns {boolean}
     */
    static canViewCharacterBuffs(charOrId) {
        if (this.isGM()) return true;
        if (this.canControlCharacter(charOrId)) return true;

        const partyBuffsVisible = typeof SuiteConfigStore !== "undefined"
            ? SuiteConfigStore.getSetting("party_buffs_visible", false)
            : false;

        if (partyBuffsVisible) {
            if (this.isCurrentPlayerInParty() && this.isPartyMember(charOrId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判断当前用户对特定 Token 是否具备 Buff 查看权限（读权限）
     * @param {string|object} tokenOrId
     * @returns {boolean}
     */
    static canViewTokenBuffs(tokenOrId) {
        if (this.isGM()) return true;
        if (this.canControlToken(tokenOrId)) return true;

        const partyBuffsVisible = typeof SuiteConfigStore !== "undefined"
            ? SuiteConfigStore.getSetting("party_buffs_visible", false)
            : false;

        if (partyBuffsVisible) {
            if (this.isCurrentPlayerInParty() && this.isPartyMember(tokenOrId)) {
                return true;
            }
        }
        return false;
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

    /**
     * 宿主免疫级失焦与点击外部监听器 (Host-Immune Synthetic Blur / Dismissal)
     * 针对 Roll20 画布频繁调用 e.preventDefault() / e.stopPropagation() 的特殊环境，
     * 在顶层 window 捕获阶段前置感知指针按下，结合 AbortController 实现原子级无残留注销。
     * 
     * @param {Element} targetEl 保持聚焦的目标 DOM 元素（输入框、菜单容器等）
     * @param {Function} onDismiss 命中外部交互时的失焦回调
     * @param {Object} [options]
     * @param {boolean} [options.watchBlur=true] 是否同时监听切屏/切窗口 (window.blur)
     * @param {boolean} [options.watchContext=true] 是否同时监听外部右击 (contextmenu)
     * @returns {Function} 允许调用方提前主动注销监听的 cleanup() 函数
     */
    static watchDismissal(targetEl, onDismiss, options = {}) {
        if (!targetEl || typeof onDismiss !== "function") return () => {};

        const { watchBlur = true, watchContext = true } = options;
        const ac = new AbortController();
        const { signal } = ac;
        let isCleanedUp = false;

        const cleanup = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            ac.abort(); // 浏览器底层原子级全量注销该 signal 绑定的所有事件
        };

        const handlePointer = (e) => {
            try {
                if (!e.target || !(e.target instanceof Node) || !targetEl.contains(e.target)) {
                    cleanup();
                    onDismiss(e);
                }
            } catch (err) {
                cleanup();
                onDismiss(err);
            }
        };

        // 延迟 10ms 挂载，防止触发当前菜单/进入编辑同一瞬间的手势自击穿
        setTimeout(() => {
            if (isCleanedUp) return;
            window.addEventListener("pointerdown", handlePointer, { capture: true, signal });
            if (watchContext) {
                window.addEventListener("contextmenu", handlePointer, { capture: true, signal });
            }
            if (watchBlur) {
                window.addEventListener("blur", () => {
                    cleanup();
                    onDismiss(new Event("blur"));
                }, { signal });
            }
        }, 10);

        return cleanup;
    }

    /**
     * 为指定展示元素挂载就地编辑输入框 (Inline Editor)
     * 自动处理事件隔离 (stopPropagation)、Enter 确认、Escape 取消与失焦持久化
     * @param {HTMLElement} triggerEl 触发编辑的展示元素 (通常为轮数 span)
     * @param {object} options
     * @param {string|number|null} options.initialValue 初始值
     * @param {string} [options.placeholder="轮数"] 输入框 placeholder
     * @param {string} [options.className="r20-input-round-inline"] 自定义 class
     * @param {HTMLElement} [options.container] 挂载容器，默认 triggerEl.parentElement
     * @param {Function} options.onCommit 提交回调: async (rawText) => void
     */
    static attachInlineRoundEditor(triggerEl, options = {}) {
        if (!triggerEl) return;
        const container = options.container || triggerEl.parentElement;
        if (!container) return;

        // 防重入：若当前容器内已存在处于编辑态的输入框，直接聚焦返回
        const existingInput = container.querySelector(".r20-input-round-inline, .r20-input-round-inline-pill");
        if (existingInput) {
            existingInput.focus();
            existingInput.select?.();
            return;
        }

        const {
            initialValue = "",
            placeholder = "轮数",
            className = "r20-input-round-inline",
            onCommit
        } = options;

        const input = document.createElement("input");
        input.type = "text";
        input.className = className;
        input.value = (initialValue !== null && initialValue !== undefined) ? String(initialValue) : "";
        input.placeholder = placeholder;

        ["click", "dblclick", "mousedown", "contextmenu"].forEach(evtName => {
            input.addEventListener(evtName, ev => ev.stopPropagation());
        });

        let isCommitted = false;
        let isCancelled = false;

        const restoreDOM = () => {
            if (input.parentNode === container) {
                input.replaceWith(triggerEl);
            } else {
                input.remove();
            }
        };

        const commit = async () => {
            if (isCommitted || isCancelled) return;
            isCommitted = true;
            const raw = input.value.trim();
            restoreDOM();
            if (typeof onCommit === "function") {
                await onCommit(raw);
            }
        };

        const cancel = () => {
            if (isCommitted || isCancelled) return;
            isCancelled = true;
            restoreDOM();
        };

        input.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                input.blur(); // 触发 blur 提交
            } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
            }
        });

        input.addEventListener("blur", () => {
            commit();
        });

        // 替换展示元素为输入框，并聚焦全选
        triggerEl.replaceWith(input);
        input.focus();
        input.select();
    }

    /**
     * 按属性全名查找 Character 的属性模型（未找到返回 null）
     * 收敛全项目重复的 attribs.models.find(a => a.get("name") === X) 样板
     */
    static findAttr(character, name) {
        return character?.attribs?.models?.find(a => a.get("name") === name) || null;
    }

    /**
     * 大小写不敏感版本（Roll20 官方卡对 repeating 行 ID 存在大小写漂移）
     */
    static findAttrCI(character, name) {
        const lower = String(name).toLowerCase();
        return character?.attribs?.models?.find(a => {
            const n = a.get("name") || "";
            return n === name || n.toLowerCase() === lower;
        }) || null;
    }

    /**
     * 生成标准 Roll20 行 ID（人物卡 repeating 行与 Token 自定义字段条目共用）
     */
    static generateStandardRowId() {
        let id = "";
        if (typeof window !== "undefined" && typeof window.generateUUID === "function") {
            id = window.generateUUID();
        }
        if (!id) {
            // 回退实现：标准 Roll20 Push ID 生成器（严格剔除下划线 _，防止破坏 repeating_section_([^_]+) 正则分割）
            const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
            let now = new Date().getTime();
            const timeStampChars = new Array(8);
            for (let i = 7; i >= 0; i--) {
                timeStampChars[i] = PUSH_CHARS.charAt(now % 63);
                now = Math.floor(now / 63);
            }
            id = timeStampChars.join("");
            for (let i = 0; i < 12; i++) {
                id += PUSH_CHARS.charAt(Math.floor(Math.random() * 63));
            }
        }
        // 核心工业级约束：坚决剔除下划线 _（替换为合法字母 a），防止截断 Roll20 官方 repeating_buff2_([^_]+) 正则
        id = id.replace(/_/g, "a");
        // 规避 Roll20 Jumpgate 坏行检测判定：
        // Jumpgate 规则：若 ID 以 '-' 开头且全为纯小写 (le.substring(0,1)==='-' && le.toLowerCase()===le)，
        // 则会将其判定为坏死行并注入 'repitembroken' 样式类导致弹出红字报错。
        // 因此必须保留天然大小写，且若首字符为 '-' 时确保包含大写字母。
        if (id.startsWith("-") && id.toLowerCase() === id) {
            id = id.substring(0, 1) + id.charAt(1).toUpperCase() + id.substring(2);
        }
        return id;
    }

    /**
     * 查找或创建/更新属性（create-or-save 样板的单行收敛）
     * 行为与手写样板逐位一致：无则 create（可带 max），有则无条件 save
     * @param {object} opts { max: 属性上限, bySuite: 标记 bySuite 选项 }
     * @returns {object|null} 属性模型
     */
    static upsertAttr(character, name, current, opts = {}) {
        if (!character?.attribs) return null;
        let attr = opts.ci ? this.findAttrCI(character, name) : this.findAttr(character, name);
        if (!attr) {
            const data = { name, current };
            if (opts.max !== undefined) data.max = opts.max;
            attr = character.attribs.create(data, opts.bySuite ? { bySuite: true } : undefined);
        } else {
            attr.save({ current }, opts.bySuite ? { bySuite: true } : undefined);
        }
        return attr;
    }

    /**
     * 读取 JSON 属性（解析失败/缺失/类型不符时返回 fallback）
     * @param {*} [fallback] 默认 []
     */
    static readJsonAttr(character, name, fallback = []) {
        const attr = this.findAttr(character, name);
        if (!attr || !attr.get("current")) return fallback;
        try {
            const parsed = JSON.parse(attr.get("current"));
            return parsed ?? fallback;
        } catch (e) {
            return fallback;
        }
    }

    /**
     * 将 JSON 值写入属性（序列化 + upsert 单行收敛）
     * @param {object} opts { destroyIfEmpty: 值为空数组时销毁属性 }
     */
    static writeJsonAttr(character, name, value, opts = {}) {
        const serialized = JSON.stringify(value);
        if (opts.destroyIfEmpty && Array.isArray(value) && value.length === 0) {
            const attr = this.findAttr(character, name);
            if (attr) attr.destroy();
            return null;
        }
        return this.upsertAttr(character, name, serialized);
    }
}

    // ==========================================
    // 2. RecalcService 官方加值重算无头沙箱服务
    // ==========================================
/**
 * 官方人物卡原生下拉框缺省字典表 (Neceros 官方 SheetWorker 规范)
 * 当角色卡属性尚未在 DOM 中被用户显式改动时，用作原生兜底，确保 BAB 与关键属性加值不为 0
 */
const MANUAL_DROPDOWN_DEFAULTS = {
    "HP-ability": "CON-mod",
    "init-ability": "DEX-mod",
    "Fort-ability": "CON-mod",
    "Ref-ability": "DEX-mod",
    "Will-ability": "WIS-mod",
    "melee-ability": "STR-mod",
    "melee2-ability": "0",
    "ranged-ability": "DEX-mod",
    "ranged2-ability": "0",
    "melee_bab": "bab",
    "melee2_bab": "bab",
    "ranged_bab": "bab",
    "ranged2_bab": "bab",
    "cmb_bab": "bab",
    "cmb2_bab": "bab",
    "sanity-ability": "0",
    "concentration-0-ability": "0",
    "concentration-1-ability": "0",
    "concentration-2-ability": "0",
    "AC-ability": "DEX-mod",
    "FF-ability": "0",
    "CMD-ability": "0",
    "CMD-ability1": "STR-mod",
    "CMD-ability2": "DEX-mod",
    "selected-ability-psionic-power": "0",
    "kineticist_ability": "CON-mod"
};

/**
 * RecalcService.js
 * 负责官方人物卡攻防、豁免等衍生属性全量重新计算的单源服务
 * 
 * 核心架构：常驻“在线引用无头重算单例沙箱” (Headless Worker Singleton Sandbox)
 * 1. 零本地代码冗余与零外部上传：战役加载后，直接就地在线引用 Roll20 官方下发的原生脚本 (Campaign.characters[0].characterSheet.workerScripts[0])；
 * 2. 在常驻后台隐藏 iframe 中通过标准 Blob URL 外部库引用 (<script src="blob:...">) 挂载，彻底规避 eval；
 * 3. 建立 Roll20 原生 SheetWorker 7 大宿主桩 (on, getAttrs, setAttrs, getSectionIDs, getTranslationByKey, getTranslationLanguage, generateRowID)；
 * 4. 采用单例动态上下文 (currentContextChar) + 串行任务队列 (Sequential Job Queue)，毫秒级顺序计算各角色；
 * 5. 无论卡片在屏幕上开没开，修改 Buff 后统一向该沙箱派发带 sourceType="player" 的 change:recalc1 事件；
 * 6. 监听 setAttrs 回写 recalc1: 0 判定计算完成，原汁原味运行官方 ju()，属性秒级回写到 character.attribs 内存中；
 * 7. 具备角色维度 300ms 防抖合并 (Coalescing)，避免多 Buff 连续操作导致的并发雪崩。
 */
class RecalcService {
    static isInitialized = false;
    static workerScriptCode = null;
    static sandboxIframe = null;
    static listeners = {};
    static currentContextChar = null;
    static currentJobResolve = null;

    // 串行执行任务队列与并发锁
    static queue = [];
    static isProcessing = false;

    // 角色维度的防抖任务表 (Map: characterId -> timerId)
    static pendingRequests = new Map();
    static COALESCE_DELAY_MS = 300;

    /**
     * 全局初始化：在线获取官方 Worker 脚本并启动无头沙箱
     */
    static async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[RecalcService] 正在初始化官方重算在线单例沙箱...");
        try {
            // 从 Campaign 中就地读取 Roll20 官方在线加载好的 worker 脚本
            this.workerScriptCode = this.extractWorkerScriptFromCampaign();
            if (this.workerScriptCode) {
                this.bootSandbox(this.workerScriptCode);
            } else {
                console.log("[RecalcService] 官方 worker 脚本暂未就绪，启动轮询等待在线模板加载...");
                this.pollForWorkerScript();
            }
        } catch (err) {
            console.error("[RecalcService] 初始化沙箱异常:", err);
        }
    }

    /**
     * 从 Campaign.characters 中就地在线提取官方已加载的 worker 源码
     */
    static extractWorkerScriptFromCampaign() {
        if (typeof window === "undefined" || !window.Campaign?.characters?.models) return null;
        for (const char of window.Campaign.characters.models) {
            // 1. 优先直接读取 Roll20 官方在线下载并解析完毕的 workerScripts 数组
            const ws = char.characterSheet?.workerScripts;
            if (Array.isArray(ws) && ws[0] && typeof ws[0] === "string" && ws[0].length > 1000) {
                console.log(`[RecalcService] 成功在线获取官方 Worker 脚本 (从 workerScripts[0]，长度: ${ws[0].length} 字符)`);
                return ws[0];
            }
            // 2. 兜底：若尚未被 Roll20 提取进 workerScripts，则从 layouthtml 原生标签中提取
            const html = char.characterSheet?.layouthtml;
            if (html && html.includes("text/worker")) {
                const match = html.match(/<script[^>]*type=["']text\/worker["'][^>]*>([\s\S]*?)<\/script>/i);
                if (match && match[1]) {
                    console.log(`[RecalcService] 成功在线提取官方 Worker 脚本 (从 layouthtml 模板，长度: ${match[1].length} 字符)`);
                    return match[1];
                }
            }
        }
        return null;
    }

    /**
     * 轮询等待 Roll20 官方模板在线加载完成
     */
    static pollForWorkerScript(retries = 30) {
        let count = 0;
        const intervalId = setInterval(() => {
            count++;
            const code = this.extractWorkerScriptFromCampaign();
            if (code) {
                clearInterval(intervalId);
                this.workerScriptCode = code;
                this.bootSandbox(code);
            } else if (count >= retries) {
                clearInterval(intervalId);
                console.warn("[RecalcService] 等待官方在线模板超时，将在首次开卡时延迟挂载沙箱");
            }
        }, 500);
    }

    /**
     * 启动隐藏执行沙箱 iframe（采用标准 Blob URL 外部库引用方式加载，零 eval）
     */
    static bootSandbox(scriptCode) {
        if (typeof document === "undefined") return;
        if (this.sandboxIframe) {
            try { this.sandboxIframe.remove(); } catch (e) {}
            this.sandboxIframe = null;
        }

        const iframe = document.createElement("iframe");
        iframe.id = "r20-suite-recalc-sandbox";
        iframe.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(iframe);
        this.sandboxIframe = iframe;

        // 通过 doc.open()/write()/close() 强制同步建立干净上下文
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
            doc.close();
        }

        const iwin = iframe.contentWindow;
        if (!iwin) return;

        // 注入宿主已有的原生 Underscore.js 依赖
        iwin._ = (typeof window !== "undefined" ? window._ : null) || (typeof unsafeWindow !== "undefined" ? unsafeWindow._ : null) || (typeof _ !== "undefined" ? _ : null);

        this.listeners = {};

        // 1. 实现 on(events, cb)
        iwin.on = (events, cb) => {
            (events || "").split(" ").forEach(evt => {
                const clean = evt.trim();
                if (!clean) return;
                if (!this.listeners[clean]) this.listeners[clean] = [];
                this.listeners[clean].push(cb);
            });
        };

        // 2. 实现 getAttrs(names, cb)
        iwin.getAttrs = (names, cb) => {
            const char = this.currentContextChar;
            const res = {};
            if (!char || !char.attribs) {
                if (typeof cb === "function") setTimeout(() => cb(res), 0);
                return;
            }
            const models = char.attribs.models || [];
            const map = new Map();
            for (let i = 0; i < models.length; i++) {
                const a = models[i];
                map.set(a.get("name"), a.get("current"));
            }
            for (let i = 0; i < names.length; i++) {
                const n = names[i];
                // 核心修复点 1：沙箱重算期间查询 recalc1 时，必须返回 "1"，确保官方 ju() 分支判定为需要全量重算
                if (n === "recalc1") {
                    res[n] = "1";
                    continue;
                }
                const val = map.get(n);
                if (val !== undefined && val !== null && val !== "") {
                    res[n] = String(val);
                } else if (MANUAL_DROPDOWN_DEFAULTS[n] !== undefined) {
                    // 核心修复点 2：官方下拉框默认值（如 melee_bab: "bab", melee-ability: "STR-mod"）
                    res[n] = MANUAL_DROPDOWN_DEFAULTS[n];
                } else {
                    res[n] = (val !== undefined && val !== null) ? String(val) : "";
                }
            }
            if (typeof cb === "function") {
                setTimeout(() => cb(res), 0);
            }
        };

        // 3. 实现 setAttrs(values, options, cb)
        iwin.setAttrs = (vals, opts, cb) => {
            if (typeof opts === "function") { cb = opts; opts = {}; }
            const char = this.currentContextChar;
            if (char && char.attribs && vals) {
                const silent = !!(opts && opts.silent);
                const existingMap = new Map();
                for (const a of (char.attribs.models || [])) {
                    existingMap.set(a.get("name"), a);
                }
                for (const [k, v] of Object.entries(vals)) {
                    const cur = (v !== undefined && v !== null) ? String(v) : "";
                    let attr = existingMap.get(k);
                    if (!attr) {
                        const newAttr = char.attribs.create({ name: k, current: cur });
                        if (newAttr) existingMap.set(k, newAttr);
                    } else if (String(attr.get("current")) !== cur) {
                        attr.save({ current: cur }, { silent: silent, byScript: true });
                    }
                }
            }

            if (typeof cb === "function") {
                setTimeout(cb, 0);
            }

            // 监听官方 ju() 结束信号：当写入 recalc1 === 0 时，代表本轮所有属性已全量收敛写回完毕
            if (vals && (vals.recalc1 === 0 || vals.recalc1 === "0" || vals.recalc1 === false)) {
                if (this.currentJobResolve) {
                    const resolve = this.currentJobResolve;
                    this.currentJobResolve = null;
                    setTimeout(resolve, 0);
                }
            }
        };

        // 4. 实现 getSectionIDs(section, cb)
        iwin.getSectionIDs = (section, cb) => {
            const char = this.currentContextChar;
            if (!char || !char.attribs) {
                if (typeof cb === "function") setTimeout(() => cb([]), 0);
                return;
            }
            const cleanSec = section.replace(/^repeating_/, "");
            const prefix = `repeating_${cleanSec}_`;
            const ids = new Set();
            const models = char.attribs.models || [];
            for (let i = 0; i < models.length; i++) {
                const name = models[i].get("name") || "";
                if (name.startsWith(prefix)) {
                    const rest = name.substring(prefix.length);
                    const idx = rest.indexOf("_");
                    if (idx > 0) {
                        ids.add(rest.substring(0, idx));
                    }
                }
            }
            const res = Array.from(ids);
            if (typeof cb === "function") {
                setTimeout(() => cb(res), 0);
            }
        };

        // 5. 实现国际化与行 ID 辅助桩
        iwin.getTranslationByKey = (k) => k || "";
        iwin.getTranslationLanguage = () => "en";
        iwin.generateRowID = () => "-" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);

        // 6. 标准“在线库引用”：使用 Blob URL 生成同源外部脚本文件，通过 <script src="..."> 加载，严禁使用 eval
        try {
            const blob = new Blob([scriptCode], { type: "text/javascript" });
            const blobUrl = URL.createObjectURL(blob);
            const scriptEl = doc.createElement("script");
            scriptEl.src = blobUrl;
            scriptEl.onload = () => {
                URL.revokeObjectURL(blobUrl);
                console.log(`[RecalcService] 官方重算引擎作为独立库文件加载就绪 (Blob URL)，已注册规则数: ${Object.keys(this.listeners).length}`);
            };
            scriptEl.onerror = (e) => {
                URL.revokeObjectURL(blobUrl);
                console.error("[RecalcService] 挂载官方脚本库异常:", e);
            };
            doc.head.appendChild(scriptEl);
        } catch (scriptErr) {
            console.error("[RecalcService] 创建脚本 Blob URL 异常:", scriptErr);
        }
    }

    /**
     * 请求对指定角色进行攻防加值全量重新计算
     * 具备 300ms 角色维度防抖合并
     * @param {object} character Character Backbone 模型
     * @param {object} options { reason: string }
     */
    static request(character, { reason = "buff_mutation" } = {}) {
        if (!character || !character.id) return;

        // 若沙箱尚未初始化，补救提取与挂载
        if (!this.sandboxIframe && !this.workerScriptCode) {
            this.workerScriptCode = this.extractWorkerScriptFromCampaign();
            if (this.workerScriptCode) this.bootSandbox(this.workerScriptCode);
        }

        const charId = character.id;
        if (this.pendingRequests.has(charId)) {
            clearTimeout(this.pendingRequests.get(charId));
        }

        const timerId = setTimeout(async () => {
            this.pendingRequests.delete(charId);
            await this.enqueue(character, { reason });
        }, this.COALESCE_DELAY_MS);

        this.pendingRequests.set(charId, timerId);
    }

    /**
     * 将重算任务提交至全局单例串行执行队列
     * @param {object} character 
     * @param {object} options 
     * @returns {Promise<void>}
     */
    static enqueue(character, { reason = "enqueue" } = {}) {
        return new Promise((resolve) => {
            // 合并相同角色的排队任务，避免队列积压
            const existingIdx = this.queue.findIndex(j => j.character.id === character.id);
            if (existingIdx >= 0) {
                const oldJob = this.queue[existingIdx];
                oldJob.reason = `${oldJob.reason}+${reason}`;
                oldJob.subResolves.push(resolve);
                return;
            }

            this.queue.push({
                character,
                reason,
                resolve,
                subResolves: []
            });
            this.processNext();
        });
    }

    /**
     * 串行消费任务队列核心调度器
     */
    static async processNext() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const job = this.queue.shift();
        const { character, reason, resolve, subResolves } = job;
        const completeJob = () => {
            resolve();
            for (const r of subResolves) {
                try { r(); } catch (e) {}
            }
        };

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            // 预先确保缺失的下拉框默认值（如 melee_bab、melee-ability 等）在 character.attribs 中建立
            // 避免未在卡片手动点选过的实体缺少 BAB/属性源导致近战/远程加值为 0
            if (character.attribs && character.attribs.models) {
                const existingNames = new Set(character.attribs.models.map(a => a.get("name")));
                const canCreate = typeof character.attribs.create === "function";
                for (const [defKey, defVal] of Object.entries(MANUAL_DROPDOWN_DEFAULTS)) {
                    if (!existingNames.has(defKey) && canCreate) {
                        character.attribs.create({ name: defKey, current: defVal });
                        existingNames.add(defKey);
                    }
                }
                let recalcAttr = character.attribs.models.find(a => a.get("name") === "recalc1");
                if (!recalcAttr && canCreate) {
                    character.attribs.create({ name: "recalc1", current: "1" });
                } else if (recalcAttr) {
                    if (typeof recalcAttr.set === "function") {
                        recalcAttr.set("current", "1");
                    } else {
                        recalcAttr.current = "1";
                    }
                }
            }

            const recalcListeners = this.listeners["change:recalc1"] || [];
            if (this.sandboxIframe && recalcListeners.length > 0) {
                console.log(`[RecalcService] 正在单例沙箱中为 [${character.get("name")}] 执行官方原生重算 (原因: ${reason})...`);
                const startTime = Date.now();
                this.currentContextChar = character;

                await new Promise((done) => {
                    let finished = false;
                    const timeoutId = setTimeout(() => {
                        if (!finished) {
                            finished = true;
                            console.warn(`[RecalcService] 角色 [${character.get("name")}] 沙箱重算超时(4000ms)，触发自动恢复`);
                            done();
                        }
                    }, 4000);

                    this.currentJobResolve = () => {
                        if (!finished) {
                            finished = true;
                            clearTimeout(timeoutId);
                            done();
                        }
                    };

                    const eventObj = {
                        sourceAttribute: "recalc1",
                        sourceType: "player", // 👈 必须传 player 穿透官方白名单门禁！
                        previousValue: "0",
                        newValue: "1"
                    };

                    for (const fn of recalcListeners) {
                        try {
                            fn(eventObj);
                        } catch (fnErr) {
                            console.error("[RecalcService] 沙箱回调执行异常:", fnErr);
                        }
                    }
                });

                const elapsed = Date.now() - startTime;
                console.log(`[RecalcService] [${character.get("name")}] 官方重算完毕，总耗时: ${elapsed}ms`);
                this.currentContextChar = null;
                completeJob();
            } else {
                // 沙箱未就绪时的幂等属性兜底写入
                console.warn(`[RecalcService] 沙箱未就绪，使用幂等属性写入兜底 [${character.get("name")}] recalc1="1"`);
                let recalcAttr = character.attribs?.models?.find(a => a.get("name") === "recalc1");
                if (!recalcAttr && character.attribs) {
                    character.attribs.create({ name: "recalc1", current: "1" });
                } else if (recalcAttr) {
                    recalcAttr.save({ current: "1" }, { silent: false });
                }
                completeJob();
            }
        } catch (err) {
            console.error(`[RecalcService] 处理 [${character.get("name")}] 重算任务异常:`, err);
            this.currentContextChar = null;
            completeJob();
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }

    /**
     * 立即强制执行角色重算 (绕过防抖，直接排队)
     * @param {object} character 
     * @param {object} options
     */
    static async flush(character, { reason = "manual_flush" } = {}) {
        if (!character || !character.id) return;
        const charId = character.id;
        if (this.pendingRequests.has(charId)) {
            clearTimeout(this.pendingRequests.get(charId));
            this.pendingRequests.delete(charId);
        }

        return this.enqueue(character, { reason });
    }

    /**
     * 资源清理与注销 (热重载支持)
     */
    static destroy() {
        for (const timerId of this.pendingRequests.values()) {
            clearTimeout(timerId);
        }
        this.pendingRequests.clear();
        this.queue = [];
        this.isProcessing = false;

        if (this.currentJobResolve) {
            try { this.currentJobResolve(); } catch (e) {}
            this.currentJobResolve = null;
        }

        if (this.sandboxIframe) {
            try { this.sandboxIframe.remove(); } catch (e) {}
            this.sandboxIframe = null;
        }
        this.listeners = {};
        this.currentContextChar = null;
        this.isInitialized = false;
        console.log("[RecalcService] 服务已注销并清理沙箱资源");
    }
}

    // ==========================================
    // 3. BuffLifecycle Buff/Debuff 轮数生命周期纯算法核心
    // ==========================================
/**
 * BuffLifecycle.js
 * Buff / Debuff 轮数生命周期的纯算法核心（无任何宿主依赖，可直接单元测试）。
 *
 * 领域规则（单一事实来源，Pf1eBuffManager 与 TokenBuffManager 共用）：
 * - 扣减 (tick)：rounds 为 null/NaN 的常驻条目跳过；
 *   正数轮数逐轮 -1，归零即过期 (expire)；
 *   Debuff 允许 0/负数轮数持续正计轮 (0 -> -1 -> -2...)，记为 counted。
 * - 回退 (revert)：有效轮数统一 +1 (increment)。
 *
 * 本模块只负责"判定下一状态"，不做任何持久化；
 * 各 Manager 将返回的 status 映射到自己的持久化后端
 * （角色卡属性 / Token 自定义字段）。
 */
class BuffLifecycle {
    /**
     * 判定一个条目扣减 1 轮后的下一状态（原地更新 entry.rounds，必要时 entry.enabled）
     * @param {object} entry { name, rounds, enabled? }
     * @param {object} [opts]
     * @param {boolean} [opts.isDebuff=false] Debuff 语义：跳过未激活条目、支持正计轮、过期时关停 enabled
     * @param {(entry: object) => string} [opts.formatName] 结果条目名称格式化（如 Debuff 前缀）
     * @returns {{name: string, status: "expired"|"decremented"|"counted", remaining: number}|null}
     *          null 表示该条目本回合不参与扣减（常驻/未激活/无轮数）
     */
    static decrementEntry(entry, { isDebuff = false, formatName = (e) => e.name } = {}) {
        if (!entry) return null;
        if (isDebuff && entry.enabled === false) return null;
        if (entry.rounds === null || entry.rounds === undefined || isNaN(entry.rounds)) return null;

        // Debuff 的 0/负数轮数：持续正计轮
        if (isDebuff && entry.rounds <= 0) {
            entry.rounds = entry.rounds - 1;
            return { name: formatName(entry), status: "counted", remaining: entry.rounds };
        }

        const nextRounds = entry.rounds - 1;
        if (nextRounds <= 0) {
            if (isDebuff) {
                entry.enabled = false;
                entry.rounds = 0;
                return { name: formatName(entry), status: "expired", remaining: 0 };
            }
            entry.rounds = nextRounds;
            return { name: formatName(entry), status: "expired", remaining: 0 };
        }

        entry.rounds = nextRounds;
        return { name: formatName(entry), status: "decremented", remaining: nextRounds };
    }

    /**
     * 判定一个条目回退（先攻倒转）加回 1 轮后的状态（原地更新 entry.rounds）
     * @param {object} entry { name, rounds, enabled? }
     * @param {object} [opts]
     * @param {boolean} [opts.isDebuff=false] Debuff 语义：跳过未激活条目
     * @returns {{status: "incremented", remaining: number}|null} null 表示不参与回退
     */
    static incrementEntry(entry, { isDebuff = false } = {}) {
        if (!entry) return null;
        if (isDebuff && entry.enabled === false) return null;
        if (entry.rounds === null || entry.rounds === undefined || isNaN(entry.rounds)) return null;

        entry.rounds = entry.rounds + 1;
        return { status: "incremented", remaining: entry.rounds };
    }
}

    // ==========================================
    // 4. DragGestures 统一拖拽手势工具 (Pointer Capture)
    // ==========================================
/**
 * DragGestures.js
 * 项目内统一的拖拽手势工具（零依赖，Pointer Capture 实现）。
 *
 * 设计约束：
 * - 指针捕获（setPointerCapture）：按下后指针离开元素，pointermove 仍持续派发到该元素，
 *   无需向 document 注册/注销 mousemove/mouseup；pointercancel 兜底（浏览器接管手势时）。
 * - 只提供手势生命周期（start/move/end），几何语义（钳制、锚定、吸附）全部留在调用方。
 * - 主键按下才启动；isIgnored 用于放行元素内部的原生交互（如标题栏里的按钮）。
 *
 * 使用方：BuffFloatingPanel 标题栏/缩放手柄、BuffDetachedWindow 标题栏。
 */
class DragGestures {
    /**
     * 绑定拖拽手势
     * @param {Element} handle 按下即开始拖拽的元素（需与接收 move/end 事件的元素为同一个）
     * @param {object} handlers
     * @param {(e: PointerEvent) => boolean} [handlers.isIgnored] 返回 true 则本次按下不启动拖拽
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onStart] 拖拽启动（已捕获指针）
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onMove] 拖拽移动
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onEnd] 拖拽结束（含 pointercancel）
     * @returns {() => void} 解绑函数
     */
    static bind(handle, { isIgnored, onStart, onMove, onEnd } = {}) {
        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            if (isIgnored && isIgnored(e)) return;

            const start = { x: e.clientX, y: e.clientY };
            try {
                handle.setPointerCapture(e.pointerId);
            } catch (err) { /* 元素可能已脱离 DOM，忽略 */ }
            if (onStart) onStart(e, start);

            const onPointerMove = (ev) => {
                if (onMove) onMove(ev, start);
            };
            const onPointerUp = (ev) => {
                handle.removeEventListener("pointermove", onPointerMove);
                handle.removeEventListener("pointerup", onPointerUp);
                handle.removeEventListener("pointercancel", onPointerUp);
                if (onEnd) onEnd(ev, start);
            };
            handle.addEventListener("pointermove", onPointerMove);
            handle.addEventListener("pointerup", onPointerUp);
            handle.addEventListener("pointercancel", onPointerUp);
        };

        handle.addEventListener("pointerdown", onPointerDown);
        return () => handle.removeEventListener("pointerdown", onPointerDown);
    }
}

    // ==========================================
    // 5. Pf1eBuffManager (PF1e 角色卡数据管理层)
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
     * 为指定角色绑定属性变动监听，捕获卡面手动开启 Buff 的动作，自动按预置公式初始化轮数
     */
    static bindCharacterBuffFormulaListener(character) {
        if (!character || !character.attribs || character._pf1eBuffFormulaBound) return;
        character._pf1eBuffFormulaBound = true;

        const handleAttributeMutation = async (attr, options) => {
            if (!attr) return;
            if (options?.byScript || Pf1eBuffManager.isScriptMutating) return;

            const attrName = attr.get("name") || "";

            // 响应常规 repeating_buff2_*_enable_toggle 开启，自动根据预置公式初始化轮数
            if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_enable_toggle")) {
                const isToggledOn = Number(attr.get("current")) === 1;
                if (isToggledOn) {
                    const prefix = attrName.replace("_enable_toggle", "");
                    const roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
                    const curRounds = roundsAttr ? roundsAttr.get("current") : "";
                    const isRoundsEmpty = curRounds === "" || curRounds === null || Number(curRounds) === 0;

                    if (isRoundsEmpty) {
                        const initRoundsAttr = Roll20Bridge.findAttr(character, `${prefix}_init_rounds`);
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
            }
        };

        character.attribs.on("change:current", handleAttributeMutation);
        character.attribs.on("add", (attr, collection, options) => handleAttributeMutation(attr, options));
    }

    /**
     * 收敛全项目的「Buff/Debuff 变更 → 刷新先攻条徽章」防御性调用
     * （Pf1eBuffUI 存在循环导入风险，故以 typeof 守卫）
     */
    static notifyTokenRefresh(character) {
        if (character && typeof Pf1eBuffUI !== "undefined") {
            Pf1eBuffUI.requestTokenRefresh(character.id);
        }
    }

    /**
     * 判定 Condition 属性当前值是否为激活态（"0"/0/""/null/undefined/false 均视为关停）
     */
    static isConditionValueActive(val) {
        return val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;
    }

    static generateStandardRowId() {
        return Roll20Bridge.generateStandardRowId();
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
     * 自动检测并修复/自愈历史遗留的带有下划线 _ 的畸形坏死 Buff 属性
     * 将包含下划线的 rowId 平滑迁移为合法 ID，并清理导致官方人物卡锁死的幽灵残破行
     * @param {object} character Character Backbone 模型
     * @returns {Promise<number>} 修复的行数
     */
    static async sanitizeMalformedBuffRows(character) {
        if (!character || !character.attribs || !character.attribs.models) return 0;

        const malformedMap = new Map(); // rawRowId -> { cleanRowId, attrs: [] }

        for (const a of [...character.attribs.models]) {
            const name = a.get("name") || "";
            if (!name.startsWith("repeating_buff2_-")) continue;
            
            // Firebase Push ID 长度恒为 20 (以 '-' 开头)
            // 属性全名格式：repeating_buff2_<20位rowId>_<subKey>
            const rowIdCandidate = name.slice(16, 36);
            if (name.charAt(36) === "_" && rowIdCandidate.includes("_")) {
                const rawRowId = rowIdCandidate;
                const subKey = name.slice(37);

                let entry = malformedMap.get(rawRowId);
                if (!entry) {
                    const cleanRowId = rawRowId.replace(/_/g, "a").toLowerCase();
                    entry = { cleanRowId, attrs: [] };
                    malformedMap.set(rawRowId, entry);
                }
                entry.attrs.push({ attr: a, subKey, val: a.get("current"), max: a.get("max") });
            }
        }

        if (malformedMap.size === 0) return 0;

        console.warn(`[Pf1eBuffManager] [自愈系统] 为 [${character.get("name")}] 检测到 ${malformedMap.size} 个含下划线的坏死 Buff 行，启动自动迁移...`);
        let fixedCount = 0;

        for (const [malformedRowId, { cleanRowId, attrs }] of malformedMap.entries()) {
            for (const { attr, subKey, val, max } of attrs) {
                const newName = `repeating_buff2_${cleanRowId}_${subKey}`;
                let existingNew = character.attribs.models.find(m => m.get("name") === newName);
                if (!existingNew) {
                    character.attribs.create({
                        name: newName,
                        current: subKey === "row_id" ? cleanRowId.toLowerCase() : val,
                        max: max || ""
                    }, { bySuite: true });
                }
                try {
                    attr.destroy();
                } catch (e) {
                    console.warn("[Pf1eBuffManager] 销毁坏死属性异常:", e);
                }
            }
            fixedCount++;
        }

        // 同步更新 _reporder_repeating_buff2
        const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
        if (orderAttr && orderAttr.get("current")) {
            let curOrder = String(orderAttr.get("current"));
            for (const [malformedRowId, { cleanRowId }] of malformedMap.entries()) {
                curOrder = curOrder.replace(malformedRowId, cleanRowId);
                const truncatedId = malformedRowId.split("_")[0];
                if (truncatedId && curOrder.includes(truncatedId)) {
                    curOrder = curOrder.replace(truncatedId, cleanRowId);
                }
            }
            orderAttr.save({ current: curOrder }, { bySuite: true });
        }

        // 清理打开的人物卡中锁死红字的坏死 DOM 元素
        try {
            const iframes = document.querySelectorAll(".characterdialog iframe, .ui-dialog iframe");
            iframes.forEach(iframe => {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) return;
                for (const malformedRowId of malformedMap.keys()) {
                    const truncatedId = malformedRowId.split("_")[0];
                    const badItems = doc.querySelectorAll(`.repitem[data-reprowid="${truncatedId}"], .repitem[data-reprowid="${malformedRowId}"]`);
                    badItems.forEach(item => {
                        item.remove();
                        console.log(`[Pf1eBuffManager] 已从人物卡 DOM 中清除坏死节点 [${truncatedId}]`);
                    });
                }
            });
        } catch (e) {}

        console.log(`[Pf1eBuffManager] [自愈系统] [${character.get("name")}] 坏死 Buff 行修复完毕，共迁移 ${fixedCount} 行`);
        return fixedCount;
    }

    /**
     * 获取指定角色卡上所有的 Buff（无论是否激活启动）
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 包含启动和未启动的全部 Buff 列表
     */
    static async getAllBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        await this.sanitizeMalformedBuffRows(character);

        const buffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 单次遍历属性集合，建立按 rowId 分组的哈希索引表 (O(N) 纯单遍扫描替代 O(B*N) 多重线性查找)
        const buffMap = new Map();
        for (const a of character.attribs.models) {
            const attrName = a.get("name") || "";
            if (!attrName.startsWith("repeating_buff2_")) continue;
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) continue;
            const rowId = match[1];
            const subKey = match[2];

            let entry = buffMap.get(rowId);
            if (!entry) {
                entry = {
                    rowId,
                    prefix: `repeating_buff2_${rowId}`,
                    nameAttr: null,
                    toggleAttr: null,
                    roundsAttr: null,
                    initRoundsAttr: null,
                    buffTypeAttr: null,
                    extraAttrs: {}
                };
                buffMap.set(rowId, entry);
            }

            if (subKey === "name") {
                entry.nameAttr = a;
            } else if (subKey === "enable_toggle") {
                entry.toggleAttr = a;
            } else if (subKey === "rounds") {
                entry.roundsAttr = a;
            } else if (subKey === "init_rounds") {
                entry.initRoundsAttr = a;
            } else if (subKey === "bufftype") {
                entry.buffTypeAttr = a;
            } else if (
                subKey !== "tabcat" &&
                subKey !== "tabcat2" &&
                subKey !== "row_id"
            ) {
                const raw = a.get("current");
                if (raw !== "" && raw !== null && raw !== undefined) {
                    entry.extraAttrs[subKey] = (!isNaN(Number(raw)) && typeof raw !== "boolean" && String(raw).trim() !== "") ? Number(raw) : raw;
                }
            }
        }

        // 遍历索引表组装 Buff 实体 (纯只读查询，无任何副作用与写回)
        for (const entry of buffMap.values()) {
            const { rowId, prefix, nameAttr, toggleAttr, roundsAttr, initRoundsAttr, buffTypeAttr, extraAttrs } = entry;
            if (!nameAttr) continue;

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
            const initRounds = initRoundsAttr && initRoundsAttr.get("current") !== "" ? String(initRoundsAttr.get("current")) : null;
            const buffType = buffTypeAttr ? buffTypeAttr.get("current") : "spell";

            let linkChildren = [];
            if (extraAttrs.link_children) {
                try {
                    linkChildren = typeof extraAttrs.link_children === "string"
                        ? JSON.parse(extraAttrs.link_children)
                        : extraAttrs.link_children;
                } catch (e) {
                    linkChildren = [];
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
                initRoundsAttr: initRoundsAttr || null,
                linkHostId: extraAttrs.link_host_id || null,
                linkSourceRowId: extraAttrs.link_source_row_id || null,
                linkChildren: Array.isArray(linkChildren) ? linkChildren : []
            });
        }

        // 按照 Roll20 官方 _reporder_repeating_buff2 顺序重排
        const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
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
     * 对角色卡上的 Repeating Buff 条目进行拖拽重排序
     * 遵循 Roll20 原生规范更新 _reporder_repeating_buff2
     * @param {object} character 
     * @param {string} sourceRowId 
     * @param {string} targetRowId 
     * @param {boolean} placeBefore 是否插入在目标之前
     */
    static async reorderBuffs(character, sourceRowId, targetRowId, placeBefore = true) {
        if (!character || !sourceRowId || !targetRowId || sourceRowId === targetRowId) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs || !character.attribs.models) return;

        const allBuffs = await this.getAllBuffs(character);
        let orderList = allBuffs.map(b => b.rowId);

        const sId = sourceRowId.toLowerCase();
        const tId = targetRowId.toLowerCase();

        // 移除被拖拽项
        orderList = orderList.filter(id => id.toLowerCase() !== sId);

        // 定位目标项并插入
        const targetIdx = orderList.findIndex(id => id.toLowerCase() === tId);
        if (targetIdx === -1) {
            orderList.push(sourceRowId);
        } else {
            const insertIdx = placeBefore ? targetIdx : targetIdx + 1;
            orderList.splice(insertIdx, 0, sourceRowId);
        }

        const newOrderStr = orderList.join(",");
        let orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
        if (orderAttr) {
            orderAttr.save({ current: newOrderStr });
        } else {
            character.attribs.create({
                name: "_reporder_repeating_buff2",
                current: newOrderStr,
                max: ""
            });
        }
        console.log(`[Pf1eBuffManager] 已更新角色 [${character.get("name")}] Buff 排序:`, newOrderStr);
        return orderList;
    }

    /**
     * 触发角色卡的 Sheet Worker 全量重算 (PFSheet.recalculate)
     * 统一委托至 RecalcService 单源重算服务 (300ms 角色维度防抖合并)
     * @param {object} character 
     */
    static async triggerRecalculate(character) {
        if (!character) return;
        if (typeof RecalcService !== "undefined") {
            RecalcService.request(character, { reason: "trigger_recalculate" });
        }
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
        await this.sanitizeMalformedBuffRows(character);

        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        console.log(`[Pf1eBuffManager] [DEBUG_APPLY_OR_REFRESH] 角色: [${character.get("name")}], 拟施加 Buff: [${cleanName}], 现有条目数: ${character.attribs?.models?.filter(a => a.get("name")?.startsWith("repeating_buff2_")).length || 0}`);

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

            let toggleAttr = Roll20Bridge.findAttr(character, `${prefix}_enable_toggle`);
            if (!toggleAttr) {
                toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
            } else {
                toggleAttr.save({ current: 1 });
            }

            // 补全原生必需标签，防止角色卡报错
            this.ensureNativeRequiredAttrs(character, prefix, rowId);

            // 更新或保存预置初始轮数/公式
            if (initRounds !== null && initRounds !== undefined) {
                let initAttr = Roll20Bridge.findAttr(character, `${prefix}_init_rounds`);
                if (!initAttr) {
                    if (initRounds !== "") character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
                } else {
                    initAttr.save({ current: initRounds });
                }
            }

            let effectiveRounds = rounds;
            if (effectiveRounds === null || isNaN(effectiveRounds)) {
                // 借用原生机制求值预置公式
                const targetFormula = initRounds || (Roll20Bridge.findAttr(character, `${prefix}_init_rounds`)?.get("current"));
                if (targetFormula) {
                    const evalVal = await Roll20Bridge.evalNativeFormula(targetFormula, character);
                    if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
                }
            }

            let roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
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
                    let subAttr = Roll20Bridge.findAttr(character, attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            // 若本次刷新为独立普通副本（未包含 link_host_id），清除该条目可能残留的旧影子链接
            if (!extraAttrs || !extraAttrs.link_host_id) {
                const oldHostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
                const oldSrcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);
                const oldHostId = oldHostAttr ? oldHostAttr.get("current") : null;
                const oldSrcRowId = oldSrcAttr ? oldSrcAttr.get("current") : null;
                if (oldHostAttr) oldHostAttr.destroy();
                if (oldSrcAttr) oldSrcAttr.destroy();
                if (oldHostId && oldSrcRowId) {
                    const oldHostChar = window.Campaign?.characters?.get(oldHostId);
                    if (oldHostChar) {
                        await this.removeDownstreamLink(oldHostChar, oldSrcRowId, character.id, rowId);
                    }
                }
            }

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${effectiveRounds}`);
            RecalcService.request(character, { reason: "refresh_buff" });
            return { rowId, prefix, name: cleanName, rounds: effectiveRounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs, initRounds);
            RecalcService.request(character, { reason: "add_buff" });
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);
        await this.sanitizeMalformedBuffRows(character);

        const cleanName = (buffName || "新Buff").trim();
        const rowId = this.generateStandardRowId();
        const prefix = `repeating_buff2_${rowId}`;

        console.log(`[Pf1eBuffManager] [DEBUG_ADD_BUFF] 正在为 [${character.get("name")}] 新增规范 Buff: [${cleanName}], rowId: [${rowId}], 字符安全性校验: ${!rowId.includes("_") ? "PASS" : "FAIL"}`);

        // 写入原生必需的核心字段（标记 bySuite 防止中间切面误触）
        const nameAttr = character.attribs.create({ name: `${prefix}_name`, current: cleanName }, { bySuite: true });
        const toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 }, { bySuite: true });
        const typeAttr = character.attribs.create({ name: `${prefix}_bufftype`, current: "spell" }, { bySuite: true });

        // 必需的原生分类与渲染控制标记（杜绝 "You must delete this row" 错误）
        character.attribs.create({ name: `${prefix}_tabcat`, current: "spell" }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_tabcat2`, current: "1" }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_description-show`, current: 1 }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_row_id`, current: rowId }, { bySuite: true });

        // 保存初始预置轮数/公式
        if (initRounds !== null && initRounds !== undefined && initRounds !== "") {
            character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds }, { bySuite: true });
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
            }, { bySuite: true });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v }, { bySuite: true });
            }
        }

        // 同步规范维护 _reporder_repeating_buff2 顺序
        let orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
        if (!orderAttr) {
            character.attribs.create({
                name: "_reporder_repeating_buff2",
                current: rowId
            }, { bySuite: true });
        } else {
            const curVal = String(orderAttr.get("current") || "").trim();
            const ids = curVal ? curVal.split(",").map(s => s.trim()).filter(Boolean) : [];
            if (!ids.some(id => id.toLowerCase() === rowId.toLowerCase())) {
                ids.push(rowId);
                orderAttr.save({ current: ids.join(",") }, { bySuite: true });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}] 完毕, rowId: ${rowId}, 轮数: ${effectiveRounds}`);
        return { rowId, prefix, name: cleanName, rounds: effectiveRounds, toggleAttr, roundsAttr };
    }

    /**
     * 辅助方法：确保一行 Buff 拥有原生角色卡所需的全部标准元属性
     */
    static ensureNativeRequiredAttrs(character, prefix, rowId) {
        const checkAndCreate = (subKey, defaultVal) => {
            const fullKey = `${prefix}_${subKey}`;
            let attr = Roll20Bridge.findAttr(character, fullKey);
            if (!attr) {
                character.attribs.create({ name: fullKey, current: defaultVal });
            }
        };

        checkAndCreate("tabcat", "spell");
        checkAndCreate("tabcat2", "1");
        checkAndCreate("description-show", 1);
        checkAndCreate("row_id", rowId);
    }

    /**
     * 将指定 Buff 的当前剩余轮数原子级重置为其预置初始轮数 (init_rounds)
     * 无论 Buff 以何种方式被激活（面板复选框、右键菜单、批量施加、原生人物卡勾选等），统一调用此单一收敛入口！
     * 自动支持公式求值（如 @{level}*10、10+@{constitution_mod} 等）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId Buff 唯一行标识
     * @returns {Promise<number|null>} 重置后的轮数值（若无初始轮数或求值失败则返回 null）
     */
    static async resetBuffRoundsToInitial(character, rowId) {
        if (!character || !rowId) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;

        // 1. 读取该 Buff 的预置初始轮数/公式 (init_rounds)
        const initRoundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_init_rounds`);

        const formula = initRoundsAttr ? String(initRoundsAttr.get("current") ?? "").trim() : "";
        let finalRounds = null;

        if (formula !== "") {
            // 若为纯数字字符串直接解析，避免多余的原生求值开销
            if (!isNaN(Number(formula))) {
                finalRounds = Number(formula);
            } else {
                // 借助宿主原生能力进行公式求值
                const evalResult = await Roll20Bridge.evalNativeFormula(formula, character);
                if (evalResult !== null && !isNaN(evalResult)) {
                    finalRounds = Number(evalResult);
                }
            }
        }

        // 2. 找到或创建当前剩余轮数属性 (rounds) 并赋值
        let roundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_rounds`);

        if (finalRounds !== null && !isNaN(finalRounds)) {
            if (!roundsAttr) {
                roundsAttr = character.attribs.create({
                    name: `${targetPrefix}_rounds`,
                    current: finalRounds,
                    max: finalRounds
                });
            } else {
                roundsAttr.save({ current: finalRounds, max: finalRounds });
            }
            console.log(`[Pf1eBuffManager] Buff (${rowId}) 激活合流：当前轮数已重置为初始轮数 [${formula}] = ${finalRounds}`);
        } else {
            // 若没有预置初始轮数（即常驻 Buff），确保清除残留数字，保持为 null/空
            if (roundsAttr && roundsAttr.get("current") !== "") {
                roundsAttr.save({ current: "" });
            }
        }

        return finalRounds;
    }

    /**
     * 切换/设置 Buff 的激活开关 (enable_toggle)
     * 遵循“自定义数据联动宿主行为合流原则”：将设置轮数、开启开关、加值重算、下游广播合并在一个原子行动中执行！
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     * @param {boolean|number} enable 是否激活
     */
    static async toggleBuff(character, rowId, enable = false) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;

        // 合并行动一：若开启，强制原子重置为初始满轮数；若关停，轮数清零防僵尸残留
        if (enable) {
            await this.resetBuffRoundsToInitial(character, rowId);
        } else {
            const roundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_rounds`);
            if (roundsAttr && roundsAttr.get("current") !== 0 && roundsAttr.get("current") !== "0") {
                roundsAttr.save({ current: 0 });
            }
        }

        // 合并行动二：设置原生激活开关 enable_toggle
        const val = enable ? 1 : 0;
        Roll20Bridge.upsertAttr(character, `${targetPrefix}_enable_toggle`, val, { ci: true });

        // 合并行动三：驱动官方加值重算管线 (让官方脚本去给整张人物卡设置加值/减值)
        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})，正在联动重算加值...`);
        RecalcService.request(character, { reason: enable ? "enable_buff" : "disable_buff" });

        // 合并行动四：自动广播同步下游受术者副本
        await this.broadcastDownstreamSync(character, rowId);

        return true;
    }

    /**
     * PF1e 官方人物卡 31 项原生负面状态 (Conditions / Debuffs) 字典
     */
    static PF1E_DEBUFF_DEFINITIONS = [
        { key: "condition-Bleed", name: "流血" },
        { key: "condition-Blinded", name: "目盲" },
        { key: "condition-Cowering", name: "畏縮" },
        { key: "condition-Dazed", name: "暈眩" },
        { key: "condition-Dazzled", name: "目眩" },
        { key: "condition-Dead", name: "死亡" },
        { key: "condition-Deafened", name: "耳聾" },
        { key: "condition-Disabled", name: "癱瘓" },
        { key: "condition-Drowning", name: "溺水" },
        { key: "condition-Dying", name: "瀕死" },
        { key: "condition-Entangled", name: "糾纏" },
        { key: "condition-Exhausted", name: "力竭" },
        { key: "condition-Fascinated", name: "迷魂" },
        { key: "condition-Fatigued", name: "疲乏" },
        { key: "condition-Flat-Footed", name: "措手不及" },
        { key: "condition-Grappled", name: "擒抱" },
        { key: "condition-Helpless", name: "無助" },
        { key: "condition-Incorporeal", name: "虛體" },
        { key: "condition-Invisible", name: "隱形" },
        { key: "condition-Nauseated", name: "反胃" },
        { key: "condition-Paralyzed", name: "麻痺" },
        { key: "condition-Petrified", name: "石化" },
        { key: "condition-Pinned", name: "壓制" },
        { key: "condition-Prone", name: "俯臥" },
        { key: "condition-Fear", name: "恐懼" },
        { key: "condition-Sickened", name: "噁心" },
        { key: "condition-Stable", name: "穩定" },
        { key: "condition-Staggered", name: "恍惚" },
        { key: "condition-Stunned", name: "震懾" },
        { key: "condition-Suffocating", name: "窒息" },
        { key: "condition-Unconscious", name: "昏迷" }
    ];

    /**
     * 切换/设置原生 Condition 负面状态 (Debuff)
     * @param {object} character Character Backbone 模型
     * @param {string} conditionKey 如 "condition-Bleed"
     * @param {boolean} enable 是否开启
     * @param {number|null} rounds 持续轮数 (可选)
     */
    /**
     * 获取人物卡上已明确登记的 Debuff 列表
     * @param {object} character Character Backbone 模型
     * @returns {string[]} conditionKey 数组
     */
    static getTrackedDebuffs(character) {
        if (!character || !character.attribs) return [];
        const parsed = Roll20Bridge.readJsonAttr(character, "tracked_debuffs", null);
        return Array.isArray(parsed) ? parsed : [];
    }

    /**
     * 将某个 Debuff 登记到人物卡的 tracked_debuffs 属性中
     */
    static async addTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        let list = Roll20Bridge.readJsonAttr(character, "tracked_debuffs");
        if (!Array.isArray(list)) list = [];
        if (!list.includes(conditionKey)) {
            list.push(conditionKey);
            Roll20Bridge.writeJsonAttr(character, "tracked_debuffs", list);
        }
        return true;
    }

    /**
     * 从人物卡的 tracked_debuffs 属性中除名某个 Debuff
     */
    static async removeTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const list = Roll20Bridge.readJsonAttr(character, "tracked_debuffs", null);
        if (!Array.isArray(list)) return false;
        const filtered = list.filter(k => k !== conditionKey);
        Roll20Bridge.writeJsonAttr(character, "tracked_debuffs", filtered, { destroyIfEmpty: true });
        return true;
    }

    static async toggleCondition(character, conditionKey, enable = false, rounds = null) {
        if (!character || !conditionKey) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        let condAttr = Roll20Bridge.findAttr(character, conditionKey);
        const val = enable ? 1 : 0;
        if (!condAttr) {
            condAttr = character.attribs.create({ name: conditionKey, current: val });
        } else {
            condAttr.save({ current: val });
        }

        const roundsKey = `${conditionKey}_rounds`;
        let roundsAttr = Roll20Bridge.findAttr(character, roundsKey);
        if (rounds !== null && rounds !== undefined && rounds !== "") {
            if (!roundsAttr) {
                character.attribs.create({ name: roundsKey, current: rounds });
            } else {
                roundsAttr.save({ current: rounds });
            }
        } else if (!roundsAttr) {
            // 确保具有追踪属性，即便不开启也能在调度器中维持显示
            character.attribs.create({ name: roundsKey, current: "" });
        }

        RecalcService.request(character, { reason: enable ? "enable_condition" : "disable_condition" });
        return true;
    }

    /**
     * 关停/解除指定角色身上的某个 Buff (基于 rowId)
     */
    static async removeBuff(character, rowId) {
        return this.toggleBuff(character, rowId, false);
    }

    /**
     * 关停当前 Buff/Debuff 以及其在全战役中的所有下游受术者副本 (仅限有下游的 Buff/Debuff 使用)
     * @param {object} hostChar 宿主角色卡
     * @param {string} hostRowId 宿主 Buff 行唯一标识或 Condition Key (如 condition-Blind)
     */
    static async deactivateBuffAndDownstream(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);

        const isDebuff = hostRowId.startsWith("condition-");

        // 1. 关停宿主自身该 Buff / Debuff
        if (isDebuff) {
            await this.toggleCondition(hostChar, hostRowId, false);
        } else {
            await this.toggleBuff(hostChar, hostRowId, false);
        }
        this.notifyTokenRefresh(hostChar);

        // 2. 获取下游受术者列表（拓扑自愈由 GM 加载房间后的 healDownstreamTopology 统一执行）
        const attrName = isDebuff ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        const children = Roll20Bridge.readJsonAttr(hostChar, attrName);

        let count = 0;
        if (Array.isArray(children)) {
            for (const item of children) {
                const targetChar = window.Campaign?.characters?.get(item.charId);
                if (targetChar) {
                    if (isDebuff || item.rowId.startsWith("condition-")) {
                        await this.toggleCondition(targetChar, item.rowId, false);
                        const hAttr = Roll20Bridge.findAttr(targetChar, `${item.rowId}_link_host_id`);
                        if (hAttr) hAttr.destroy();
                    } else {
                        await this.toggleBuff(targetChar, item.rowId, false);
                    }
                    this.notifyTokenRefresh(targetChar);
                    count++;
                    continue;
                }

                // 下游为纯 Token：移除其自定义字段中的对应条目（Buff 与 Debuff 都查，链接随条目消失）
                const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                if (!targetToken) continue;
                const buffsList = TokenBuffManager.getTokenBuffs(targetToken);
                const debuffsList = TokenBuffManager.getTokenDebuffs(targetToken);
                const buffsFiltered = buffsList.filter(e => e.rowId !== item.rowId);
                const debuffsFiltered = debuffsList.filter(e => (e.rowId || e.key) !== item.rowId);
                if (buffsFiltered.length !== buffsList.length || debuffsFiltered.length !== debuffsList.length) {
                    TokenBuffManager.saveTokenBuffs(targetToken, buffsFiltered);
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffsFiltered);
                    this.notifyTokenRefresh(targetToken);
                    count++;
                }
            }
        }
        console.log(`[Pf1eBuffManager] 已关停 [${hostChar.get("name")}] 的主 ${isDebuff ? "Debuff" : "Buff"} (${hostRowId}) 及其 ${count} 个下游受术者副本`);
        return true;
    }

    /**
     * 删除主 Buff / Debuff 的全部下游链接子副本，但保留宿主自身行（与彻底删除的区别：老大不随之销毁）
     * 遵循与 deleteBuffRowPermanently 相同的自下而上注销规范：
     * 人物卡子副本走其自身的级联自毁（deleteBuffRowPermanently / deleteDebuffPermanently，可顺带清理孙辈）；
     * 纯 Token 子副本直接移除自定义字段条目；每删一个即向宿主 link_children 除名，确保循环收敛。
     * @param {object} hostChar 宿主 Character 模型
     * @param {string} hostRowId 宿主 Buff 行 ID 或 condition- key
     * @returns {Promise<number>} 实际删除的子副本数量
     */
    static async deleteDownstreamChildren(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return 0;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);

        const isDebuff = hostRowId.startsWith("condition-");
        const childrenAttrName = isDebuff ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        let count = 0;

        while (true) {
            const children = Roll20Bridge.readJsonAttr(hostChar, childrenAttrName, null);
            if (!Array.isArray(children) || children.length === 0) break;

            const item = children[0];
            if (!item || item.charId === hostChar.id) {
                await this.removeDownstreamLink(hostChar, hostRowId, item?.charId || hostChar.id, item?.rowId || hostRowId);
                continue;
            }

            const cChar = window.Campaign?.characters?.get(item.charId);
            if (cChar) {
                if (item.rowId && item.rowId.startsWith("condition-")) {
                    await this.deleteDebuffPermanently(cChar, item.rowId);
                } else {
                    await this.deleteBuffRowPermanently(cChar, item.rowId);
                }
            } else {
                // 下游为纯 Token：移除其自定义字段中的对应条目（Buff 与 Debuff 都查，链接随条目一起消失）
                const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                if (targetToken) {
                    const buffsList = TokenBuffManager.getTokenBuffs(targetToken);
                    const debuffsList = TokenBuffManager.getTokenDebuffs(targetToken);
                    const buffsFiltered = buffsList.filter(e => e.rowId !== item.rowId);
                    const debuffsFiltered = debuffsList.filter(e => (e.rowId || e.key) !== item.rowId);
                    if (buffsFiltered.length !== buffsList.length) TokenBuffManager.saveTokenBuffs(targetToken, buffsFiltered);
                    if (debuffsFiltered.length !== debuffsList.length) TokenBuffManager.saveTokenDebuffs(targetToken, debuffsFiltered);
                    this.notifyTokenRefresh(targetToken);
                }
                await this.removeDownstreamLink(hostChar, hostRowId, item.charId, item.rowId);
            }
            count++;

            // 防御性校验：若子副本自毁后由于历史异常未能主动除名，宿主强制将其剔除，确保循环必收敛
            const curChildren = Roll20Bridge.readJsonAttr(hostChar, childrenAttrName, null);
            if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && (c.rowId === item.rowId || (!c.rowId && !item.rowId)))) {
                await this.removeDownstreamLink(hostChar, hostRowId, item.charId, item.rowId);
            }
        }

        console.log(`[Pf1eBuffManager] 已删除 [${hostChar.get("name")}] 主 ${isDebuff ? "Debuff" : "Buff"} (${hostRowId}) 的 ${count} 个下游链接副本 (宿主行保留)`);
        return count;
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
     * 宿主源 Buff / Debuff 记录下游受术者订阅关系 (双向索引)
     */
    static async recordDownstreamLink(hostChar, hostRowId, childCharId, childRowId) {
        if (!hostChar || !hostRowId || !childCharId || !childRowId || !hostChar.attribs) return;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const attrName = hostRowId.startsWith("condition-") ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        let children = Roll20Bridge.readJsonAttr(hostChar, attrName);
        if (!Array.isArray(children)) children = [];
        if (!children.some(c => c.charId === childCharId && c.rowId === childRowId)) {
            children.push({ charId: childCharId, rowId: childRowId });
        }
        Roll20Bridge.writeJsonAttr(hostChar, attrName, children);
    }

    /**
     * 宿主源 Buff / Debuff 移除下游受术者订阅关系
     */
    static async removeDownstreamLink(hostChar, hostRowId, childCharId, childRowId) {
        if (!hostChar || !hostRowId || !hostChar.attribs) return;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const attrName = hostRowId.startsWith("condition-") ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        const children = Roll20Bridge.readJsonAttr(hostChar, attrName, null);
        if (!Array.isArray(children)) return;
        const filtered = children.filter(c => !(c.charId === childCharId && (c.rowId === childRowId || (!c.rowId && childRowId === hostRowId))));
        Roll20Bridge.writeJsonAttr(hostChar, attrName, filtered, { destroyIfEmpty: true });
    }

    /**
     * 断开指定 Buff / Debuff 的影子链接，将其转为完全独立的本地副本（并从宿主订阅表中除名）
     */
    static async unlinkBuff(character, rowId) {
        if (!character || !rowId || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const isDebuff = rowId.startsWith("condition-");
        const prefix = isDebuff ? rowId : `repeating_buff2_${rowId}`;
        const hostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
        const srcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);

        const hostId = hostAttr ? hostAttr.get("current") : null;
        const srcRowId = srcAttr ? srcAttr.get("current") : null;

        if (hostAttr) hostAttr.destroy();
        if (srcAttr) srcAttr.destroy();

        // 通知宿主将本子条目从下游记录中移除
        if (hostId && srcRowId) {
            const hostChar = window.Campaign?.characters?.get(hostId);
            if (hostChar) {
                await this.removeDownstreamLink(hostChar, srcRowId, character.id, rowId);
            }
        }

        console.log(`[Pf1eBuffManager] 已断开 ${character.get("name")} 的 ${isDebuff ? "Debuff" : "Buff"} (${rowId}) 影子链接，转为独立副本`);
        return true;
    }

    /**
     * 彻底净化 Buff 细目属性字典，剔除所有影子链接相关的元属性
     * 确保生成的副本为 100% 独立 Buff（既不带 link_host_id 认老大，也不带 link_children 认小弟）
     * 遵循原则：无论是谁，复制之后得独立成一个Buff，不包括任何链接，复制小弟不能有老大，复制老大不能有小弟。
     * @param {object|null} extraAttrs 原始细目字典
     * @returns {object|null} 净化后的细目字典
     */
    static sanitizeExtraAttrsForClone(extraAttrs) {
        if (!extraAttrs || typeof extraAttrs !== "object") return null;
        const clean = {};
        for (const [k, v] of Object.entries(extraAttrs)) {
            if (
                k === "rounds" ||
                k === "enable_toggle" ||
                k === "name" ||
                k === "init_rounds" ||
                k === "row_id" ||
                k.startsWith("link_") ||
                k === "linkHostId" ||
                k === "linkSourceRowId" ||
                k === "linkChildren" ||
                k === "link_host_id" ||
                k === "link_source_row_id" ||
                k === "link_children" ||
                k === "link_child_name" ||
                k === "link_upstream_name"
            ) {
                continue;
            }
            clean[k] = v;
        }
        return Object.keys(clean).length > 0 ? clean : null;
    }

    /**
     * 为目标角色施加或刷新 Debuff，支持影子链接参数 (受术者登记宿主，宿主登记下游)
     */
    static async applyOrRefreshDebuff(targetChar, conditionKey, rounds = null, linkHostId = null, linkSourceRowId = null) {
        if (!targetChar || !conditionKey) return false;
        await Roll20Bridge.ensureCharacterAttributes(targetChar);

        // 1. 登记至 tracked_debuffs 并激活设定轮数
        await this.addTrackedDebuff(targetChar, conditionKey);
        await this.toggleCondition(targetChar, conditionKey, true, rounds);

        // 2. 若指定了宿主，写入影子链接元属性并向宿主反向登记下游
        const hostAttrName = `${conditionKey}_link_host_id`;
        const srcAttrName = `${conditionKey}_link_source_row_id`;

        if (linkHostId) {
            let hostAttr = Roll20Bridge.findAttr(targetChar, hostAttrName);
            if (!hostAttr) {
                targetChar.attribs.create({ name: hostAttrName, current: linkHostId });
            } else {
                hostAttr.save({ current: linkHostId });
            }

            const srcRowId = linkSourceRowId || conditionKey;
            let srcAttr = Roll20Bridge.findAttr(targetChar, srcAttrName);
            if (!srcAttr) {
                targetChar.attribs.create({ name: srcAttrName, current: srcRowId });
            } else {
                srcAttr.save({ current: srcRowId });
            }

            const hostChar = window.Campaign?.characters?.get(linkHostId);
            if (hostChar) {
                await this.recordDownstreamLink(hostChar, srcRowId, targetChar.id, conditionKey);
            }
        } else {
            // 普通副本施加：彻底斩断该 Debuff 可能存在的旧影子链接（通知旧宿主除名并销毁元属性）
            const oldHostAttr = Roll20Bridge.findAttr(targetChar, hostAttrName);
            const oldSrcAttr = Roll20Bridge.findAttr(targetChar, srcAttrName);
            const oldHostId = oldHostAttr ? oldHostAttr.get("current") : null;
            const oldSrcRowId = oldSrcAttr ? oldSrcAttr.get("current") : null;

            if (oldHostAttr) oldHostAttr.destroy();
            if (oldSrcAttr) oldSrcAttr.destroy();

            if (oldHostId && oldSrcRowId) {
                const oldHostChar = window.Campaign?.characters?.get(oldHostId);
                if (oldHostChar) {
                    await this.removeDownstreamLink(oldHostChar, oldSrcRowId, targetChar.id, conditionKey);
                }
            }
        }
        return true;
    }

    /**
     * 物理删除角色卡上的原生 repeating_buff2 一整行属性（彻底销毁，杜绝死灰复燃）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     */
    static async deleteBuffRowPermanently(character, rowId, visited = null) {
        if (!character || !rowId || !character.attribs) return false;
        if (typeof visited === "boolean" || !visited) visited = new Set();
        const visitKey = `${character.id}:${rowId}`;
        if (visited.has(visitKey)) return false;
        visited.add(visitKey);

        const isRootOperation = (visited.size === 1);
        if (isRootOperation) this.isScriptMutating = true;

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            const prefix = `repeating_buff2_${rowId}`;
            const prefixWithUnderscore = `${prefix}_`;

            // === 阶段一：老大只需循环调用小弟自毁，直到自己小弟一个都不剩 ===
            const childrenAttrName = `${prefix}_link_children`;
            while (true) {
                const children = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (!Array.isArray(children) || children.length === 0) break;

                const item = children[0];
                if (!item || item.charId === character.id) {
                    await this.removeDownstreamLink(character, rowId, item?.charId || character.id, item?.rowId || rowId);
                    continue;
                }

                const cChar = window.Campaign?.characters?.get(item.charId);
                if (cChar) {
                    if (item.rowId && item.rowId.startsWith("condition-")) {
                        await this.deleteDebuffPermanently(cChar, item.rowId, visited);
                    } else {
                        await this.deleteBuffRowPermanently(cChar, item.rowId, visited);
                    }
                } else {
                    // 下游为纯 Token：移除其自定义字段中的对应条目（链接随条目一起消失）
                    const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                    if (targetToken) {
                        const entries = TokenBuffManager.getTokenBuffs(targetToken);
                        const filtered = entries.filter(e => e.rowId !== item.rowId);
                        if (filtered.length !== entries.length) {
                            TokenBuffManager.saveTokenBuffs(targetToken, filtered);
                        }
                    }
                    // 除名
                    await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                }

                // 防御性校验：若小弟自毁后由于历史异常未能主动除名，老大强制将其剔除，确保循环必收敛
                const curChildren = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && c.rowId === item.rowId)) {
                    await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自身也是某个上一级宿主的子条目，在自身自毁时自然向上一级宿主除名
            const hostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
            const srcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);
            if (hostAttr && srcAttr) {
                const hostId = hostAttr.get("current");
                const srcRowId = srcAttr.get("current");
                if (hostId && srcRowId) {
                    const hostChar = window.Campaign?.characters?.get(hostId);
                    if (hostChar) {
                        await this.removeDownstreamLink(hostChar, srcRowId, character.id, rowId);
                    }
                }
            }

            // 2. 彻底销毁自身行所辖的全部原生属性（包括可能残留的 link_children 等）
            const toDestroy = character.attribs.models.filter(a => {
                const n = a.get("name") || "";
                return n === prefix || n.startsWith(prefixWithUnderscore);
            });

            if (toDestroy.length > 0) {
                toDestroy.forEach(attr => attr.destroy());
                console.log(`[Pf1eBuffManager] 已物理彻底销毁 ${character.get("name")} 的 Buff [${rowId}] 共 ${toDestroy.length} 项原生属性`);

                // 同步从 _reporder_repeating_buff2 顺序列表中移除
                const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
                if (orderAttr && orderAttr.get("current")) {
                    const curVal = String(orderAttr.get("current"));
                    const filtered = curVal.split(",").filter(id => id.trim().toLowerCase() !== rowId.toLowerCase()).join(",");
                    if (filtered !== curVal) {
                        orderAttr.save({ current: filtered }, { bySuite: true });
                    }
                }

                RecalcService.request(character, { reason: "delete_buff_permanently" });
            }
            return true;
        } finally {
            if (isRootOperation) {
                queueMicrotask(() => {
                    this.isScriptMutating = false;
                });
            }
        }
    }

    /**
     * 彻底删除/解除角色身上的 Debuff 状态及其全部影子链接关系
     * 遵循严格自下而上注销与两阶段级联销毁规范：
     * 阶段一（通知小弟自毁）：施法者老大只需循环调用小弟自毁，直到自己小弟一个都不剩；受术者销毁时向上汇报并在老大处除名；
     * 阶段二（老大终局自毁）：受术者全部除名后，施法者老大自身关停状态并销毁轮数与元属性。
     * @param {object} character Character Backbone 模型
     * @param {string} conditionKey 如 condition-Blinded
     * @param {Set} [visited] 全局防环记录集
     */
    static async deleteDebuffPermanently(character, conditionKey, visited = null) {
        if (!character || !conditionKey || !character.attribs) return false;
        if (typeof visited === "boolean" || !visited) visited = new Set();
        const visitKey = `${character.id}:${conditionKey}`;
        if (visited.has(visitKey)) return false;
        visited.add(visitKey);

        const isRootOperation = (visited.size === 1);
        if (isRootOperation) this.isScriptMutating = true;

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            // === 阶段一：老大只需循环调用小弟自毁，直到自己小弟一个都不剩 ===
            const childrenAttrName = `${conditionKey}_link_children`;
            while (true) {
                const children = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (!Array.isArray(children) || children.length === 0) break;

                const item = children[0];
                if (!item || item.charId === character.id) {
                    await this.removeDownstreamLink(character, conditionKey, item?.charId || character.id, item?.rowId || conditionKey);
                    continue;
                }

                const targetChar = window.Campaign?.characters?.get(item.charId);
                if (targetChar) {
                    if (item.rowId && item.rowId.startsWith("condition-")) {
                        await this.deleteDebuffPermanently(targetChar, item.rowId, visited);
                    } else {
                        await this.deleteBuffRowPermanently(targetChar, item.rowId, visited);
                    }
                } else {
                    // 下游为纯 Token：移除其自定义字段中的对应 Debuff 登记
                    const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                    if (targetToken) {
                        TokenBuffManager.removeTrackedDebuff(targetToken, item.rowId || conditionKey);
                    }
                    // 除名
                    await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                }

                // 防御性校验：确保必定收敛剔除
                const curChildren = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && (c.rowId === item.rowId || (!c.rowId && item.rowId === conditionKey)))) {
                    await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自己是受术者（记录了 link_host_id），在自毁时向上级施法者汇报并在其 link_children 中除名
            const hostAttrName = `${conditionKey}_link_host_id`;
            const srcAttrName = `${conditionKey}_link_source_row_id`;
            let hostAttr = Roll20Bridge.findAttr(character, hostAttrName);
            let srcAttr = Roll20Bridge.findAttr(character, srcAttrName);
            const hostId = hostAttr ? hostAttr.get("current") : null;
            const srcRowId = srcAttr ? srcAttr.get("current") : null;

            if (hostId && srcRowId) {
                const hostChar = window.Campaign?.characters?.get(hostId);
                if (hostChar) {
                    await this.removeDownstreamLink(hostChar, srcRowId, character.id, conditionKey);
                }
            }
            if (hostAttr) hostAttr.destroy();
            if (srcAttr) srcAttr.destroy();

            // 2. 销毁自身可能残留的 link_children 索引属性
            let leftChildrenAttr = Roll20Bridge.findAttr(character, childrenAttrName);
            if (leftChildrenAttr) leftChildrenAttr.destroy();

            // 3. 关停自身该状态并销毁轮数
            await this.toggleCondition(character, conditionKey, false);
            const roundsAttr = Roll20Bridge.findAttr(character, `${conditionKey}_rounds`);
            if (roundsAttr) roundsAttr.destroy();

            // 4. 从 tracked_debuffs 属性中彻底除名
            await this.removeTrackedDebuff(character, conditionKey);

            this.notifyTokenRefresh(character);

            console.log(`[Pf1eBuffManager] 已物理彻底销毁 [${character.get("name")}] 的 Debuff [${conditionKey}] 及其链接关系`);
            return true;
        } finally {
            if (isRootOperation) {
                queueMicrotask(() => {
                    this.isScriptMutating = false;
                });
            }
        }
    }

    static async syncBuffToDownstream(hostChar, hostRowId, targetChar, childRowId) {
        if (!hostChar || !targetChar || !hostRowId || !childRowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        await Roll20Bridge.ensureCharacterAttributes(targetChar);

        const hostBuffs = await this.getAllBuffs(hostChar);
        const hostBuff = hostBuffs.find(b => b.rowId === hostRowId);
        if (!hostBuff) return false;

        // 读取下游当前的 rounds，保证下游剩余轮数绝对不被宿主重置覆盖！
        const childPrefix = `repeating_buff2_${childRowId}`;
        const childRoundsAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_rounds`);
        const childCurrentRounds = childRoundsAttr ? childRoundsAttr.get("current") : "";

        // 提取加值细目：严格排除本地独立字段（rounds, enable_toggle, link_*）
        const cleanExtraAttrs = {};
        if (hostBuff.extraAttrs) {
            for (const [k, v] of Object.entries(hostBuff.extraAttrs)) {
                if (k === "rounds" || k === "enable_toggle" || k.startsWith("link_") || k === "name" || k === "init_rounds") continue;
                cleanExtraAttrs[k] = v;
            }
        }

        // 调用更新：保持下游当前的 rounds，并在 preservedKeys 中保留 enable_toggle 与 link_* 字段
        await this.updateBuffRow(
            targetChar,
            childRowId,
            hostBuff.name,
            childCurrentRounds,
            cleanExtraAttrs,
            hostBuff.initRounds
        );
        return true;
    }

    /**
     * 拓扑自愈：从全战役角色卡反向发现指向宿主 Buff 的所有下游订阅项
     */
    static async discoverDownstreamLinks(hostCharId, hostRowId) {
        if (!hostCharId || !hostRowId || !window.Campaign?.characters) return [];
        const chars = window.Campaign.characters.models || [];
        const found = [];

        for (const c of chars) {
            if (!c.attribs || c.id === hostCharId) continue;
            const hostIdAttrs = c.attribs.models.filter(a => (a.get("name") || "").endsWith("_link_host_id"));
            for (const ha of hostIdAttrs) {
                if (ha.get("current") === hostCharId) {
                    const prefix = ha.get("name").replace("_link_host_id", "");
                    const sourceRowAttr = Roll20Bridge.findAttr(c, `${prefix}_link_source_row_id`);
                    if (sourceRowAttr && sourceRowAttr.get("current") === hostRowId) {
                        const childRowId = prefix.replace("repeating_buff2_", "");
                        found.push({ charId: c.id, rowId: childRowId });
                    }
                }
            }
        }
        return found;
    }

    /**
     * 下游副本是否仍然存在（人物卡子行 / Token 自定义字段条目 / Debuff 登记）。
     * 仅目标存在而子副本已被删除 → 视为幽灵登记。
     */
    static _downstreamCopyAlive(childRef) {
        const char = window.Campaign?.characters?.get(childRef.charId);
        if (char && char.attribs) {
            return !!Roll20Bridge.findAttr(char, `repeating_buff2_${childRef.rowId}_name`);
        }
        const token = Roll20Bridge.getTokenGraphic(childRef.charId);
        if (token) {
            if (TokenBuffManager.getTokenBuffs(token).some(e => e.rowId === childRef.rowId)) return true;
            return TokenBuffManager.getTokenDebuffs(token).some(d => (d.rowId || d.key) === childRef.rowId);
        }
        return false;
    }

    /**
     * 父子 Buff 链接拓扑自愈：以 GM 身份加载房间后运行一次（不再随每次加减 Buff 运行）。
     * 1. 幽灵剔除：link_children 中下游副本已不存在的登记被清除（目标存在但子行已删也算幽灵）；
     * 2. 索引重建：下游索引缺失时，全战役反向发现并重建。
     * @returns {number} 发生过修复的宿主条目数
     */
    static async healDownstreamTopology() {
        if (!window.Campaign?.characters) return 0;
        let healed = 0;
        for (const host of window.Campaign.characters.models) {
            try {
                await Roll20Bridge.ensureCharacterAttributes(host);

                // 正面 Buff 宿主
                const buffs = await this.getAllBuffs(host);
                for (const buff of buffs) {
                    if (buff.linkHostId && buff.linkSourceRowId) continue; // 自己是子节点，跳过
                    const attrName = `repeating_buff2_${buff.rowId}_link_children`;
                    const raw = Array.isArray(buff.linkChildren) ? buff.linkChildren : [];
                    // 1. 幽灵剔除：下游副本已不存在
                    const kids = raw.filter(k => this._downstreamCopyAlive(k));
                    // 2. 索引缺失重建
                    if (kids.length === 0) {
                        const found = await this.discoverDownstreamLinks(host.id, buff.rowId);
                        if (found.length > 0) kids.push(...found);
                    }
                    if (kids.length !== raw.length || (raw.length === 0 && kids.length > 0)) {
                        const existing = Roll20Bridge.findAttr(host, attrName);
                        const json = JSON.stringify(kids);
                        if (existing) existing.save({ current: json });
                        else host.attribs.create({ name: attrName, current: json });
                        healed++;
                        console.log(`[Pf1eBuffManager] 拓扑自愈：[${host.get("name")}] 的 Buff [${buff.name}] 清理至 ${kids.length} 个有效下游索引`);
                    }
                }

                // Debuff 宿主
                const debuffs = Pf1eBuffUI.getAllDebuffsSync(host);
                for (const d of debuffs) {
                    const attrName = `${d.key}_link_children`;
                    let raw = [];
                    const existing = Roll20Bridge.findAttr(host, attrName);
                    if (existing && existing.get("current")) {
                        try { raw = JSON.parse(existing.get("current")); } catch (e) { raw = []; }
                    }
                    if (!Array.isArray(raw)) raw = [];
                    const kids = raw.filter(k => this._downstreamCopyAlive(k));
                    if (kids.length === 0) {
                        const found = await this.discoverDownstreamLinks(host.id, d.key);
                        if (found.length > 0) kids.push(...found);
                    }
                    if (kids.length !== raw.length || (raw.length === 0 && kids.length > 0)) {
                        const json = JSON.stringify(kids);
                        if (kids.length > 0) {
                            if (existing) existing.save({ current: json });
                            else host.attribs.create({ name: attrName, current: json });
                        } else if (existing) {
                            existing.destroy();
                        }
                        healed++;
                        console.log(`[Pf1eBuffManager] 拓扑自愈：[${host.get("name")}] 的 Debuff [${d.name}] 清理至 ${kids.length} 个有效下游索引`);
                    }
                }
            } catch (e) {
                console.error(`[Pf1eBuffManager] 拓扑自愈异常 ([${host.get("name")}]):`, e);
            }
        }
        return healed;
    }

    /**
     * 从宿主广播同步给所有下游订阅副本 (拓扑自愈由 GM 加载房间后的 healDownstreamTopology 统一执行)
     */
    static async broadcastDownstreamSync(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return 0;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const prefix = `repeating_buff2_${hostRowId}`;
        const children = Roll20Bridge.readJsonAttr(hostChar, `${prefix}_link_children`);
        if (!Array.isArray(children) || children.length === 0) return 0;

        const hostBuffs = await this.getAllBuffs(hostChar);
        const hostBuff = hostBuffs.find(b => b.rowId === hostRowId);
        if (!hostBuff) return 0;

        let count = 0;
        for (const item of children) {
            const targetChar = window.Campaign?.characters?.get(item.charId);
            if (targetChar) {
                const ok = await this.syncBuffToDownstream(hostChar, hostRowId, targetChar, item.rowId);
                if (ok) {
                    count++;
                    this.notifyTokenRefresh(targetChar);
                }
                continue;
            }

            // 下游为纯 Token：同步名称与细目加值（严格保留下游剩余轮数，绝不被宿主覆盖）
            const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
            if (!targetToken) continue;
            const entries = TokenBuffManager.getTokenBuffs(targetToken);
            const entry = entries.find(e => e.rowId === item.rowId);
            if (!entry) continue;

            entry.name = hostBuff.name;
            const cleanAttrs = {};
            if (hostBuff.extraAttrs) {
                for (const [k, v] of Object.entries(hostBuff.extraAttrs)) {
                    if (k === "rounds" || k === "enable_toggle" || k === "name" || k === "init_rounds" || k.startsWith("link_")) continue;
                    cleanAttrs[k] = v;
                }
            }
            entry.extraAttrs = Object.keys(cleanAttrs).length > 0 ? cleanAttrs : null;
            TokenBuffManager.saveTokenBuffs(targetToken, entries);
            count++;
            this.notifyTokenRefresh(targetToken);
        }
        return count;
    }

    /**
     * 为指定的 Buff 行设置/更新剩余轮数
     */
    static async setBuffRounds(character, rowId, rounds) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const attrName = `repeating_buff2_${rowId}_rounds`;
        let roundsAttr = Roll20Bridge.findAttr(character, attrName);

        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: attrName, current: rounds, max: rounds });
        } else {
            roundsAttr.save({ current: rounds });
        }
        return roundsAttr;
    }

    /**
     * 为指定的 Buff 行设置/更新预置初始轮数或公式
     */
    static async setBuffInitRounds(character, rowId, initRounds) {
        if (!character || !rowId) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const attrName = `repeating_buff2_${rowId}_init_rounds`;
        let initAttr = Roll20Bridge.findAttr(character, attrName);
        const val = (initRounds !== null && initRounds !== undefined) ? String(initRounds).trim() : "";

        if (!initAttr) {
            if (val !== "") {
                initAttr = character.attribs.create({ name: attrName, current: val });
            }
        } else {
            initAttr.save({ current: val });
        }
        return initAttr;
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
        let nameAttr = Roll20Bridge.findAttr(character, `${prefix}_name`);
        if (!nameAttr) {
            nameAttr = character.attribs.create({ name: `${prefix}_name`, current: name });
        } else {
            nameAttr.save({ current: name });
        }

        // 2. 更新轮数
        let roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
        const roundsVal = (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "";
        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: roundsVal });
        } else {
            roundsAttr.save({ current: roundsVal });
        }

        // 3. 更新预置初始轮数/公式
        if (initRounds !== null && initRounds !== undefined) {
            const initKey = `${prefix}_init_rounds`;
            let initAttr = Roll20Bridge.findAttr(character, initKey);
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
            // 清理不在新 extraAttrs 中的旧扩展字段（绝对保护本地状态与链接索引）
            const preservedKeys = new Set([
                "name", "enable_toggle", "rounds", "init_rounds", "tabcat", "tabcat2", "row_id", "bufftype",
                "link_host_id", "link_source_row_id", "link_children"
            ]);
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
                let attr = Roll20Bridge.findAttr(character, fullKey);
                if (!attr) {
                    character.attribs.create({ name: fullKey, current: val });
                } else {
                    attr.save({ current: val });
                }
            }
        }

        console.log(`[Pf1eBuffManager] 已更新 ${character.get("name")} 的 Buff [${name}] (${rowId})`);
        RecalcService.request(character, { reason: "update_buff_row" });
        return true;
    }

    /**
     * 下游子节点（人物卡 / 纯 Token 双后端）的统一条目视图。
     * view 为 BuffLifecycle 兼容的 { name, rounds, enabled }；persist() 落盘；onExpire() 过期副作用；notify() 刷新 UI。
     * 目标既非人物卡也非 Token 时返回 null。
     */
    static async _downstreamChildView(childRef, { isDebuff = false, conditionKey = null, buffName = "", hostCharacter = null, hostRowId = null } = {}) {
        const targetChar = window.Campaign?.characters?.get(childRef.charId);

        // ---- 人物卡后端 ----
        if (targetChar && targetChar.attribs) {
            await Roll20Bridge.ensureCharacterAttributes(targetChar);
            const targetName = targetChar.get("name") || "未知角色";

            if (isDebuff) {
                const key = conditionKey || childRef.rowId;
                const condAttr = Roll20Bridge.findAttr(targetChar, key);
                const isActive = condAttr && this.isConditionValueActive(condAttr.get("current"));
                if (!isActive) return null;
                const roundsAttr = Roll20Bridge.findAttr(targetChar, `${key}_rounds`);
                const raw = roundsAttr ? roundsAttr.get("current") : "";
                const view = {
                    name: `[Debuff链接] ${buffName} (受术者: ${targetName})`,
                    rounds: (raw !== "" && raw !== null && !isNaN(Number(raw))) ? Number(raw) : 0,
                    enabled: true
                };
                return {
                    view,
                    persist: async () => {
                        if (roundsAttr) roundsAttr.save({ current: view.rounds }, { byScript: true });
                        else targetChar.attribs.create({ name: `${key}_rounds`, current: view.rounds });
                    },
                    onExpire: async () => {
                        await this.toggleCondition(targetChar, key, false);
                        const hostAttr = Roll20Bridge.findAttr(targetChar, `${key}_link_host_id`);
                        if (hostAttr) hostAttr.destroy();
                    },
                    notify: () => this.notifyTokenRefresh(targetChar)
                };
            }

            const childPrefix = `repeating_buff2_${childRef.rowId}`;
            const toggleAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_enable_toggle`);
            if (!toggleAttr || Number(toggleAttr.get("current")) !== 1) return null;
            const roundsAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_rounds`);
            const raw = roundsAttr ? roundsAttr.get("current") : "";
            const view = {
                name: `${buffName} (受术者: ${targetName})`,
                rounds: (raw !== "" && raw !== null && !isNaN(Number(raw))) ? Number(raw) : null,
                enabled: true
            };
            return {
                view,
                persist: async () => {
                    if (roundsAttr) roundsAttr.save({ current: view.rounds }, { byScript: true });
                    else await this.setBuffRounds(targetChar, childRef.rowId, view.rounds);
                },
                onExpire: async () => { await this.removeBuff(targetChar, childRef.rowId); },
                notify: () => this.notifyTokenRefresh(targetChar)
            };
        }

        // ---- 纯 Token 后端 ----
        const targetToken = Roll20Bridge.getTokenGraphic(childRef.charId);
        if (!targetToken) return null;
        const targetName = targetToken.get("name") || "未知棋子";

        if (isDebuff) {
            const key = conditionKey || childRef.rowId;
            const debuffList = TokenBuffManager.getTokenDebuffs(targetToken);
            const entry = debuffList.find(d => (d.key || d.rowId) === key);
            if (!entry || entry.enabled === false) return null;
            const view = {
                name: `[Debuff链接] ${buffName} (受术者: ${targetName})`,
                rounds: entry.rounds,
                enabled: entry.enabled
            };
            return {
                view,
                persist: async () => {
                    entry.rounds = view.rounds;
                    entry.enabled = view.enabled;
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffList);
                },
                onExpire: async () => {
                    // 与人物卡语义一致：关停状态并断开影子链接（条目保留为已关停登记）
                    entry.enabled = false;
                    entry.rounds = 0;
                    entry.linkHostId = null;
                    entry.linkSourceRowId = null;
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffList);
                },
                notify: () => this.notifyTokenRefresh(targetToken)
            };
        }

        const buffList = TokenBuffManager.getTokenBuffs(targetToken);
        const entry = buffList.find(e => e.rowId === childRef.rowId);
        if (!entry || entry.enabled === false) return null;
        const view = {
            name: `${buffName} (受术者: ${targetName})`,
            rounds: entry.rounds,
            enabled: entry.enabled
        };
        return {
            view,
            persist: async () => {
                entry.rounds = view.rounds;
                entry.enabled = view.enabled;
                TokenBuffManager.saveTokenBuffs(targetToken, buffList);
            },
            onExpire: async () => {
                const idx = buffList.indexOf(entry);
                if (idx >= 0) buffList.splice(idx, 1);
                TokenBuffManager.saveTokenBuffs(targetToken, buffList);
                // 条目已随过期移除，同步向宿主除名，杜绝幽灵计数
                if (hostCharacter && hostRowId) {
                    await this.removeDownstreamLink(hostCharacter, hostRowId, childRef.charId, childRef.rowId);
                }
            },
            notify: () => this.notifyTokenRefresh(targetToken)
        };
    }

    /**
     * 回合开始时扣减当前行动单位的 Buff / Debuff 轮数，并精准驱动扣减其名下所有主 Buff 的下游链接副本
     * 遵循规范：
     * 1. 链接 Buff (isLinkedChild) 绝不在受术者自己的先攻位扣轮，而在施法者回合开始时扣减；
     * 2. 施法者名下所有主 Buff 的下游受术者副本统一扣减 1 轮（即便主 Buff 未开启或轮数不足），受术者归零时自动解除；
     * 3. 激活的 Debuff：正数逐轮倒扣至 0 解除；0 或负数则持续正计轮 (0 -> -1 -> -2...)。
     * 轮数判定规则统一委托至 BuffLifecycle，本方法只负责属性持久化与下游联动。
     * @param {object|string} tokenOrChar
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
            const allBuffs = await this.getAllBuffs(character);
            const processed = [];

            // 1. 扣减自身常规正面 Buff
            // 链接 Buff (记录了 linkHostId) 绝不在此处扣减，跳过
            for (const buff of allBuffs) {
                if (!buff.enabled) continue;
                if (buff.linkHostId && buff.linkSourceRowId) continue;

                const result = BuffLifecycle.decrementEntry(buff);
                if (!result) continue;

                if (result.status === "expired") {
                    await this.removeBuff(character, buff.rowId);
                    processed.push({ name: buff.name, status: "expired", remaining: 0 });
                } else {
                    if (buff.roundsAttr) {
                        buff.roundsAttr.save({ current: result.remaining }, { byScript: true });
                    } else {
                        await this.setBuffRounds(character, buff.rowId, result.remaining);
                    }
                    processed.push(result);
                }
            }

            // 2. 施法者主 Buff 驱动下游受术者扣轮
            // 无论主 Buff 自身是否开启，名下所有已建立链接的受术者副本统一扣减 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const child = await this._downstreamChildView(childRef, { buffName: buff.name, hostCharacter: character, hostRowId: buff.rowId });
                    if (!child) continue;

                    const result = BuffLifecycle.decrementEntry(child.view);
                    if (!result) continue;

                    if (result.status === "expired") {
                        await child.onExpire();
                        processed.push({ name: child.view.name, status: "expired", remaining: 0 });
                    } else {
                        await child.persist();
                        processed.push(result);
                    }
                    child.notify();
                }
            }

            // 2.2 施法者 Debuff 驱动下游受术者扣轮
            // 施法者名下所有建立链接的 Debuff，无论施法者自身是否处于该状态，统一驱动扣减受术者 1 轮
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const children = Roll20Bridge.readJsonAttr(character, `${def.key}_link_children`);
                if (!Array.isArray(children) || children.length === 0) continue;

                for (const childRef of children) {
                    const child = await this._downstreamChildView(childRef, { isDebuff: true, conditionKey: def.key, buffName: def.name });
                    if (!child) continue;

                    const result = BuffLifecycle.decrementEntry(child.view, { isDebuff: true });
                    if (!result) continue;

                    if (result.status === "expired") {
                        await child.onExpire();
                        processed.push({ name: child.view.name, status: "expired", remaining: 0 });
                    } else {
                        await child.persist();
                        processed.push(result);
                    }
                    child.notify();
                }
            }

            // 3. 扣减 / 累加自身 Debuff (负面状态 condition-*)
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = Roll20Bridge.findAttr(character, def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = this.isConditionValueActive(val);
                if (!isActive) continue;

                // 若该 Debuff 是影子链接副本 (由施法者远程驱动)，受术者自己回合绝不自扣！
                const hostAttr = Roll20Bridge.findAttr(character, `${def.key}_link_host_id`);
                if (hostAttr && hostAttr.get("current")) {
                    continue;
                }

                let roundsAttr = Roll20Bridge.findAttr(character, `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                // 缺失轮数属性按 0 轮处理（进入正计轮分支）
                const result = BuffLifecycle.decrementEntry(
                    { name: `[Debuff] ${def.name}`, rounds: hasRounds ? Number(rawRounds) : 0 },
                    { isDebuff: true }
                );
                if (!result) continue;

                if (result.status === "expired") {
                    await this.toggleCondition(character, def.key, false);
                    processed.push({ name: `[Debuff] ${def.name}`, status: "expired", remaining: 0 });
                } else if (result.status === "counted" && !roundsAttr) {
                    character.attribs.create({
                        name: `${def.key}_rounds`,
                        current: result.remaining
                    });
                    processed.push(result);
                } else {
                    roundsAttr.save({ current: result.remaining }, { byScript: true });
                    processed.push(result);
                }
            }

            console.log(`[Pf1eBuffManager] 回合开始: 为 ${charName} 扣减/联动 Buff/Debuff 共 ${processed.length} 项`);
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
     * 反向倒先攻时，将被拉回排头的单位及其主 Buff 下游受术者加回 1 轮
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
            const allBuffs = await this.getAllBuffs(character);
            const processed = [];

            // 1. 加回自身常规正面 Buff (跳过链接副本)
            for (const buff of allBuffs) {
                if (!buff.enabled) continue;
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const result = BuffLifecycle.incrementEntry(buff);
                if (!result) continue;

                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: result.remaining }, { byScript: true });
                } else {
                    await this.setBuffRounds(character, buff.rowId, result.remaining);
                }
                processed.push({ name: buff.name, status: "incremented", remaining: result.remaining });
            }

            // 2. 施法者主 Buff 驱动下游受术者加回 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const child = await this._downstreamChildView(childRef, { buffName: buff.name, hostCharacter: character, hostRowId: buff.rowId });
                    if (!child) continue;

                    const result = BuffLifecycle.incrementEntry(child.view);
                    if (!result) continue;

                    await child.persist();
                    child.notify();
                    processed.push({ name: child.view.name, status: "incremented", remaining: result.remaining });
                }
            }

            // 3. 加回自身 Debuff
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = Roll20Bridge.findAttr(character, def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = this.isConditionValueActive(val);
                if (!isActive) continue;

                let roundsAttr = Roll20Bridge.findAttr(character, `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                if (!hasRounds) continue;

                const result = BuffLifecycle.incrementEntry({ name: `[Debuff] ${def.name}`, rounds: Number(rawRounds) });
                if (!result) continue;

                roundsAttr.save({ current: result.remaining }, { byScript: true });
                processed.push({ name: `[Debuff] ${def.name}`, status: "incremented", remaining: result.remaining });
            }

            console.log(`[Pf1eBuffManager] 先攻回退: 为 ${character.get("name")} 加回 Buff/Debuff 轮数共 ${processed.length} 项`);
            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }
    }
}

    // ==========================================
    // 6. SuiteConfigStore 战役云端配置卡存储层
    // ==========================================
/**
 * SuiteConfigStore.js
 * 负责用户本地偏好设置管理与变更广播 (Settings Store)
 */
class SuiteConfigStore {
    static SETTINGS_STORAGE_KEY = "r20_suite_user_settings";

    static defaultSettings = {
        turnorder_buff_abbr: false, // 先攻条 Buff 首字缩写显示
        debounce_recalc_enabled: false, // 是否在无操作后自动重算
        debounce_recalc_ms: 2000, // 无操作多少毫秒后自动重算
        buff_show_checkbox: true, // 是否在 Buff 列表显示快速启停复选框 (默认开启)
        party_buffs_visible: true // 队友之间的 Buff 互相可见 (队员只读互查，默认开启)
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

    // ==========================================
    // 7. TurnOrderObserver 先攻监听器
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

        // 2. 绑定 Backbone 事件（保存引用以支持 teardown 解绑，杜绝多实例双重扣轮）
        this._boundCampaignHandler = (campaign, newJson) => {
            this.handleTurnorderChange(newJson);
        };
        window.Campaign.on("change:turnorder", this._boundCampaignHandler);

        this.isInitialized = true;
        console.log("[TurnOrderObserver] 先攻事件监听器已就绪，当前排头:", this.getHeadTokenId());
    }

    /**
     * 停止监听并注销所有事件（热重载清理支持）
     */
    stop() {
        if (!this.isInitialized) return;
        if (this._boundCampaignHandler && typeof window.Campaign !== "undefined" && typeof window.Campaign.off === "function") {
            window.Campaign.off("change:turnorder", this._boundCampaignHandler);
            this._boundCampaignHandler = null;
        }
        if (this._boundClickListener) {
            document.removeEventListener("click", this._boundClickListener, true);
            this._boundClickListener = null;
        }
        this.isInitialized = false;
        console.log("[TurnOrderObserver] 先攻事件监听器已成功卸载");
    }

    /**
     * 监听本地先攻条前进/后退按钮点击，精准捕获本地发起者身份
     */
    bindLocalIntentListeners() {
        if (this._boundClickListener) {
            document.removeEventListener("click", this._boundClickListener, true);
        }
        this._boundClickListener = (e) => {
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
        };
        document.addEventListener("click", this._boundClickListener, true);
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

        // 1. 判定正向轮转 (Next Turn): 
        // 正常循环左移 [A, B, C] -> [B, C, A]
        // 单战斗单位特判 (P0-4): [A] -> [A] 且有本地点击前进操作
        const isSingleUnit = oldList.length === 1 && newList.length === 1 && oldList[0].id === newList[0].id;
        const isNextTurn = (isSingleUnit && this._lastLocalIntent.action === "forward" && (Date.now() - this._lastLocalIntent.timestamp < 1500)) ||
                           (!isSingleUnit &&
                            (newList[newList.length - 1].id === oldList[0].id) &&
                            (newList[0].id === oldList[1].id));

        // 2. 判定反向回退 (Previous Turn): 
        // 正常循环右移 [B, C, A] -> [A, B, C]
        // 单战斗单位特判 (P0-4): [A] -> [A] 且有本地点击后退操作
        const isPrevTurn = !isNextTurn && (
                           (isSingleUnit && this._lastLocalIntent.action === "back" && (Date.now() - this._lastLocalIntent.timestamp < 1500)) ||
                           (!isSingleUnit &&
                            (oldList[oldList.length - 1].id === newList[0].id) &&
                            (oldList[0].id === newList[1].id)));

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
    // 8. TokenBuffManager (纯野怪 Token 状态引擎)
    // ==========================================
/**
 * TokenBuffManager.js
 * 专门处理无人物卡绑定的纯野怪/通用 Token 的 Buff 生命周期与持久化
 *
 * 存储介质：Token Graphic 模型上的自定义字段 `r20_suite_buffs`
 * （JSON: { buffs: [...], debuffs: [...] }，经实验验证可随 Firebase 持久化并跨页面刷新存活）。
 * 不占用 gmnotes——那是用户可见可编辑的笔记空间，混入结构化数据会被用户编辑冲掉。
 *
 * 数据结构与人物卡 (Pf1eBuffManager.getAllBuffs) 保持完全一致的字段语义：
 * { rowId, name, enabled, rounds, initRounds, extraAttrs, linkHostId, linkSourceRowId, linkChildren }
 * 所有写入方负责按此结构落盘；读取端直读直返，不做迁移清洗。
 *
 * 轮数扣减/回退算法统一委托至 BuffLifecycle（纯算法核心），
 * 本类只负责自定义字段的读写。
 */
class TokenBuffManager {
    static FIELD = "r20_suite_buffs";

    /**
     * 读取整份数据（缺失/损坏时返回空结构）
     */
    static _load(token) {
        let data = null;
        try { data = JSON.parse(token.get(this.FIELD) || "null"); } catch (e) { data = null; }
        if (!data || typeof data !== "object") data = {};
        if (!Array.isArray(data.buffs)) data.buffs = [];
        if (!Array.isArray(data.debuffs)) data.debuffs = [];
        return data;
    }

    /**
     * 整份数据写回自定义字段（推送到 Firebase）
     */
    static _save(token, data) {
        token.save({ [this.FIELD]: JSON.stringify(data) });
    }

    /**
     * 从 Token 的自定义字段中提取 Buff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} 标准结构条目 [{ rowId, name, enabled, rounds, initRounds, ... }]
     */
    static getTokenBuffs(token) {
        if (!token) return [];
        return this._load(token).buffs;
    }

    /**
     * 将 Buff 列表持久化回 Token 的自定义字段
     */
    static saveTokenBuffs(token, buffs) {
        if (!token) return;
        const data = this._load(token);
        data.buffs = buffs;
        this._save(token, data);
    }

    /**
     * 从 Token 的自定义字段中提取当前已登记的 Debuff 列表
     * @param {object} token Graphic Backbone 模型
     * @returns {Array} [{ key, rowId, name, rounds, enabled, isDebuff }]
     */
    static getTokenDebuffs(token) {
        if (!token) return [];
        return this._load(token).debuffs;
    }

    /**
     * 将 Debuff 列表持久化回 Token 的自定义字段
     */
    static saveTokenDebuffs(token, debuffs) {
        if (!token) return;
        const data = this._load(token);
        data.debuffs = debuffs;
        this._save(token, data);
    }

    /**
     * 将 Debuff 登记到 Token 的 Debuff 列表中
     */
    static addTrackedDebuff(token, debuffData) {
        if (!token || !debuffData) return false;
        const list = this.getTokenDebuffs(token);
        const key = debuffData.key || debuffData.name;
        const existing = list.find(d => (d.key || d.name) === key);
        if (existing) {
            if (debuffData.rounds !== undefined) existing.rounds = debuffData.rounds;
            if (debuffData.enabled !== undefined) existing.enabled = debuffData.enabled;
            if (debuffData.linkHostId !== undefined) existing.linkHostId = debuffData.linkHostId;
            if (debuffData.linkSourceRowId !== undefined) existing.linkSourceRowId = debuffData.linkSourceRowId;
        } else {
            list.push({
                key: key,
                rowId: debuffData.rowId || key,
                name: debuffData.name || key,
                rounds: debuffData.rounds !== undefined ? debuffData.rounds : 0,
                initRounds: debuffData.initRounds !== undefined ? debuffData.initRounds : 0,
                enabled: debuffData.enabled !== undefined ? debuffData.enabled : false,
                linkHostId: debuffData.linkHostId || null,
                linkSourceRowId: debuffData.linkSourceRowId || null,
                linkChildren: [],
                isDebuff: true
            });
        }
        this.saveTokenDebuffs(token, list);
        return true;
    }

    /**
     * 从 Token 的 Debuff 列表中除名某个 Debuff
     */
    static removeTrackedDebuff(token, key) {
        if (!token || !key) return false;
        let list = this.getTokenDebuffs(token);
        const filtered = list.filter(d => (d.key || d.name) !== key);
        this.saveTokenDebuffs(token, filtered);
        return true;
    }

    /**
     * 切换 Token 上某个 Debuff 的激活/关停状态
     */
    static toggleDebuff(token, key, enable) {
        if (!token || !key) return false;
        const list = this.getTokenDebuffs(token);
        const target = list.find(d => (d.key || d.name) === key);
        if (target) {
            target.enabled = !!enable;
            this.saveTokenDebuffs(token, list);
            return true;
        }
        return false;
    }

    /**
     * 切换纯 Token 上指定 Buff 的激活状态
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {boolean} enable 是否开启
     */
    static toggleBuff(token, buffName, enable) {
        if (!token || !buffName) return false;
        const list = this.getTokenBuffs(token);
        const target = list.find(b => b.name === buffName);
        if (target) {
            target.enabled = !!enable;
            this.saveTokenBuffs(token, list);
            return true;
        }
        return false;
    }

    /**
     * 对纯 Token 施加或刷新 Buff（同名只刷新轮数，不同名追加）
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 细目属性字典
     * @param {string|null} initRounds 预置初始轮数或公式
     * @returns {object|null} 落盘后的条目
     */
    static applyOrRefreshBuff(token, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!token) return null;
        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        const buffs = this.getTokenBuffs(token);
        const existing = buffs.find(b => b.name === cleanName);
        const cleanAttrs = (extraAttrs && typeof extraAttrs === "object")
            ? Object.fromEntries(Object.entries(extraAttrs).filter(([k]) => !k.startsWith("link_") && !k.startsWith("link")))
            : null;

        let entry;
        if (existing) {
            existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
            if (initRounds !== null && initRounds !== undefined) existing.initRounds = initRounds;
            if (cleanAttrs) existing.extraAttrs = cleanAttrs;
            existing.enabled = true;
            entry = existing;
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 剩余: ${rounds}轮`);
        } else {
            entry = {
                rowId: Roll20Bridge.generateStandardRowId(),
                name: cleanName,
                enabled: true,
                rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null,
                initRounds: initRounds ?? null,
                buffType: "spell",
                extraAttrs: cleanAttrs || null,
                linkHostId: null,
                linkSourceRowId: null,
                linkChildren: []
            };
            buffs.push(entry);
            console.log(`[TokenBuffManager] Token [${token.get("name")}] 新增 Buff [${cleanName}], 轮数: ${rounds}`);
        }

        this.saveTokenBuffs(token, buffs);
        return entry;
    }

    /**
     * 移除纯 Token 上的某个 Buff
     * @param {object} token Graphic 模型
     * @param {string} buffName Buff 名称或 rowId
     */
    static removeBuff(token, buffName) {
        if (!token) return false;
        const cleanName = (buffName || "").trim();
        let buffs = this.getTokenBuffs(token);
        const beforeLen = buffs.length;
        // 兼容两种定位方式：条目名或 rowId（归一化后两者可能不同）
        buffs = buffs.filter(b => b.name !== cleanName && b.rowId !== cleanName);

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

        const data = this._load(token);
        const { buffs, debuffs } = data;
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];

        // 1. 处理正面 Buff（过期条目直接从列表除名；未激活条目跳过，与人物卡语义一致）
        // 链接副本 (linkHostId + linkSourceRowId) 绝不在受术者自己的回合扣减，
        // 只由施法者主 Buff 回合开始时统一驱动（影子链接语义，与 Pf1eBuffManager 对齐）
        if (buffs.length > 0) {
            const remainingBuffs = [];
            for (const buff of buffs) {
                if (buff.enabled === false) { remainingBuffs.push(buff); continue; }
                if (buff.linkHostId && buff.linkSourceRowId) { remainingBuffs.push(buff); continue; }
                const result = BuffLifecycle.decrementEntry(buff);
                if (!result) {
                    remainingBuffs.push(buff);
                    continue;
                }
                if (result.status === "expired") {
                    processed.push({ name: buff.name, status: "expired" });
                } else {
                    remainingBuffs.push(buff);
                    processed.push(result);
                }
            }
            data.buffs = remainingBuffs;
        }

        // 2. 处理 Debuff 轮数倒计与到期关停（链接副本同样只由宿主驱动，本回合跳过）
        if (debuffs.length > 0) {
            for (const debuff of debuffs) {
                if (debuff.linkHostId && debuff.linkSourceRowId) continue;
                const result = BuffLifecycle.decrementEntry(debuff, {
                    isDebuff: true,
                    formatName: (e) => `[Debuff] ${e.name}`
                });
                if (!result) continue;
                processed.push(result);
            }
        }

        if (processed.length > 0) {
            this._save(token, data);
        }

        return processed;
    }

    /**
     * 兼容别名
     */
    static tickBuffsOnTurnEnd(tokenId) {
        return this.decrementBuffs(tokenId);
    }

    /**
     * 倒先攻时，将被拉回排头的 Token 身上的 Buff/Debuff 加回 1 轮
     */
    static incrementBuffsOnTurnRevert(tokenOrId) {
        const token = typeof tokenOrId === "string" ? Roll20Bridge.getTokenGraphic(tokenOrId) : tokenOrId;
        if (!token) return [];

        const data = this._load(token);
        const { buffs, debuffs } = data;
        if (buffs.length === 0 && debuffs.length === 0) return [];

        const processed = [];
        for (const buff of buffs) {
            if (buff.enabled === false) continue;
            // 链接副本的轮数由施法者宿主统一回退，受术者自己回合不重复加回
            if (buff.linkHostId && buff.linkSourceRowId) continue;
            if (!BuffLifecycle.incrementEntry(buff)) continue;
            processed.push({ name: buff.name, status: "incremented", remaining: buff.rounds });
        }

        for (const debuff of debuffs) {
            if (debuff.linkHostId && debuff.linkSourceRowId) continue;
            if (!BuffLifecycle.incrementEntry(debuff, { isDebuff: true })) continue;
            processed.push({ name: `[Debuff] ${debuff.name}`, status: "incremented", remaining: debuff.rounds });
        }

        if (processed.length > 0) {
            this._save(token, data);
        }

        console.log(`[TokenBuffManager] 先攻回退: 为 Token [${token.get("name")}] 加回 Buff/Debuff 轮数共 ${processed.length} 项`);
        return processed;
    }
}

    // ==========================================
    // 9. Pf1eBuffUI (先攻列表徽章交互层)
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
    static _isHookingVue = false;

    // 便签板（微任务任务合并队列，彻底消除连环触发与并发竞态）
    static pendingTokenIds = new Set();
    static isFlushingScheduled = false;

    /**
     * 投递刷新请求到便签板（自动去重并微任务合并）
     * 兼顾传入 Token ID、Token 模型、Character ID 或 Character 模型，自适应拓扑解析并准确定向投递！
     * @param {string|object} tokenOrCharOrId 
     */
    static requestTokenRefresh(tokenOrCharOrId) {
        if (!tokenOrCharOrId) return;

        let tokenId = null;
        let charId = null;

        if (typeof tokenOrCharOrId === "object") {
            if (tokenOrCharOrId.attribs) {
                // Character Backbone 模型
                charId = tokenOrCharOrId.id;
            } else if (typeof tokenOrCharOrId.get === "function") {
                // Graphic Token 模型
                tokenId = tokenOrCharOrId.id;
                charId = tokenOrCharOrId.get("represents");
            }
        } else if (typeof tokenOrCharOrId === "string") {
            const rawId = tokenOrCharOrId.trim();
            // 先尝试在当前先攻 DOM 查找对应 Token 节点
            const hasRow = document.querySelector(`#vm-turn-order li.token[data-tokenid="${rawId}"], .turn-tracker li.token[data-tokenid="${rawId}"], #initiativewindow li.token[data-tokenid="${rawId}"]`);
            if (hasRow) {
                tokenId = rawId;
            } else {
                // 若找不到直接匹配的 Token，则视为角色 ID 自动查找其在先攻栏中的对应 Token
                charId = rawId;
            }
        }

        if (tokenId) {
            this.pendingTokenIds.add(tokenId);
        }
        if (charId) {
            this.scheduleTokensRepresentingCharacter(charId);
        }

        if (!this.isFlushingScheduled && this.pendingTokenIds.size > 0) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 微任务检查点：批量清空便签板并单次刷新
     */
    static flushPendingRefreshes() {
        const tokenIds = Array.from(this.pendingTokenIds);
        this.pendingTokenIds.clear();
        this.isFlushingScheduled = false;

        for (const tid of tokenIds) {
            try {
                this.refreshSingleTokenBadgeSync(tid, { force: true });
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
                padding-top: 2px !important;
            }
            .r20-debuff-container {
                order: -1 !important;
                display: flex !important;
                flex-wrap: wrap !important;
                flex-basis: 100% !important;
                width: 100% !important;
                max-width: 100% !important;
                margin-left: 0 !important;
                margin-bottom: 2px !important;
                gap: 2px 4px !important;
                line-height: 1 !important;
                overflow: hidden !important;
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
            .r20-pill-name {
                cursor: pointer;
            }
            .r20-pill-round {
                margin-left: 3px;
                padding: 0 2px;
                border-radius: 2px;
                background: rgba(0, 0, 0, 0.25);
                font-weight: 700;
                cursor: pointer;
                transition: background 0.12s, color 0.12s;
            }
            .r20-pill-round:hover {
                background: rgba(56, 189, 248, 0.4);
                color: #ffffff;
                text-decoration: underline;
            }
            .r20-input-round-inline-pill {
                width: 32px;
                min-width: 24px;
                max-width: 50px;
                height: 14px;
                line-height: 14px;
                padding: 0 1px;
                font-size: 9px;
                font-family: inherit;
                text-align: center;
                border: 1px solid #38bdf8;
                background: #0f172a;
                color: #f8fafc;
                border-radius: 2px;
                outline: none;
                box-shadow: 0 0 4px rgba(56, 189, 248, 0.6);
                box-sizing: border-box;
                margin-left: 2px;
            }
        `;
        document.head.appendChild(style);
        this.isStylesInjected = true;
    }

    /**
     * 劫持 Vue 3 先攻条核心组件生命周期 (TurnTracker 的 updated 与 mounted)
     * 在 Vue 3 完成 DOM patch 渲染同一微任务帧内，纯同步就地挂载 Buff，从物理上 0ms 根除闪烁！
     */
    static hookVueTurnTracker() {
        try {
            const el = document.getElementById("vm-turn-order");
            const appComp = el?._vnode?.component;
            const trackerComp = appComp?.subTree?.component;
            if (!trackerComp) return false;

            if (trackerComp._r20SuiteHooked) return true;

            const onSyncPatch = () => {
                Pf1eBuffUI.syncPatchAllBadges();
            };

            if (!trackerComp.u) trackerComp.u = [];
            trackerComp.u.push(onSyncPatch);

            if (!trackerComp.m) trackerComp.m = [];
            trackerComp.m.push(onSyncPatch);

            trackerComp._r20SuiteHooked = true;
            return true;
        } catch (e) {
            console.warn("[Pf1eBuffUI] 挂钩 Vue 3 先攻组件异常:", e);
            return false;
        }
    }

    /**
     * 劫持原生先攻窗口控制器 (Campaign.initiativewindow.rebuildInitiativeList)
     */
    static hookInitiativeWindow() {
        try {
            const iw = window.Campaign?.initiativewindow;
            if (!iw || iw._r20SuiteHooked) return;

            const origRebuild = iw.rebuildInitiativeList;
            if (typeof origRebuild === "function") {
                iw.rebuildInitiativeList = function() {
                    const res = origRebuild.apply(this, arguments);
                    Pf1eBuffUI.hookVueTurnTracker();
                    queueMicrotask(() => Pf1eBuffUI.syncPatchAllBadges());
                    return res;
                };
            }
            iw._r20SuiteHooked = true;
        } catch (e) {
            console.warn("[Pf1eBuffUI] 挂钩先攻窗口控制器异常:", e);
        }
    }

    /**
     * 启动持久 DOM 监听器（仅作为 Vue 3 生命周期外的双保险纯同步兜底）
     */
    static startObserver() {
        if (this.isObserverStarted) return;
        this.injectStyles();
        this.hookInitiativeWindow();
        this.hookVueTurnTracker();

        // 1. 监听主窗口变动（纯同步即时补全，彻底移除 80ms 延时！）
        if (this._observer) this._observer.disconnect();

        this._observer = new MutationObserver((mutations) => {
            let hasNewUnmountedTokens = false;
            for (const m of mutations) {
                // 忽略自身 buff 容器引起的变动，杜绝回环震荡
                if (m.target?.closest?.(".r20-buff-container") || m.target?.closest?.(".r20-debuff-container")) continue;

                if (m.type === "childList") {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.matches?.("li.token") && (!node.querySelector(".r20-buff-container") || !node.querySelector(".r20-debuff-container"))) {
                                hasNewUnmountedTokens = true;
                                break;
                            } else if (node.querySelector?.("li.token") && (!node.querySelector(".r20-buff-container") || !node.querySelector(".r20-debuff-container"))) {
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
                this.hookVueTurnTracker();
                this.syncPatchAllBadges();
            }
        });

        // 优先监听 vm-turn-order 或 body
        const targetContainer = document.getElementById("vm-turn-order") || document.body;
        this._observer.observe(targetContainer, { childList: true, subtree: true });

        // 2. 先攻窗口打开/切换时初始化
        if (window.Campaign && typeof window.Campaign.on === "function") {
            this._boundInitiativePageHandler = () => {
                this.hookInitiativeWindow();
                this.hookVueTurnTracker();
                queueMicrotask(() => this.syncPatchAllBadges());
            };
            window.Campaign.on("change:initiativepage", this._boundInitiativePageHandler);
        }

        // 3. 监听全局用户偏好设置变动（如首字缩写开关、队友 Buff 互见开关）
        this._boundSettingChangedHandler = (e) => {
            if (e.detail?.key === "turnorder_buff_abbr" || e.detail?.key === "party_buffs_visible") {
                this.syncPatchAllBadges({ force: true });
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);

        this.isObserverStarted = true;
        this.hookAttributePersistence();
        // 立即尝试一次初次刷新
        this.syncPatchAllBadges();
    }

    /**
     * 停止先攻条 DOM 监听与事件（热重载清理支持）
     */
    static stopObserver() {
        if (!this.isObserverStarted) return;
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        if (this._boundInitiativePageHandler && window.Campaign && typeof window.Campaign.off === "function") {
            window.Campaign.off("change:initiativepage", this._boundInitiativePageHandler);
            this._boundInitiativePageHandler = null;
        }
        if (this._boundSettingChangedHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);
            this._boundSettingChangedHandler = null;
        }
        this.isObserverStarted = false;
        console.log("[Pf1eBuffUI] 先攻条 DOM 响应式监听与事件已成功卸载");
    }

    static get PF1E_DEBUFF_DEFINITIONS() {
        return (typeof Pf1eBuffManager !== "undefined" && Pf1eBuffManager.PF1E_DEBUFF_DEFINITIONS) ? Pf1eBuffManager.PF1E_DEBUFF_DEFINITIONS : [];
    }

    /**
     * 纯同步：提取角色身上所有已登记/被追踪的负面状态 (Debuff / Condition)，包括已激活与已关停 (供调度器工作台全量渲染)
     */
    static getAllDebuffsSync(character) {
        if (!character || !character.attribs || !character.attribs.models) return [];
        const models = character.attribs.models;
        const debuffs = [];

        // 优先读取人物卡上的 tracked_debuffs 明确登记列表
        let trackedKeys = Roll20Bridge.readJsonAttr(character, "tracked_debuffs");
        if (!Array.isArray(trackedKeys)) trackedKeys = [];
        const trackedSet = new Set(trackedKeys);

        for (let i = 0; i < this.PF1E_DEBUFF_DEFINITIONS.length; i++) {
            const def = this.PF1E_DEBUFF_DEFINITIONS[i];
            const attr = models.find(a => a.get("name") === def.key);
            const val = attr ? attr.get("current") : null;
            const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;

            // 影子链接与轮数元属性提取
            const hostAttr = models.find(a => a.get("name") === `${def.key}_link_host_id`);
            const srcAttr = models.find(a => a.get("name") === `${def.key}_link_source_row_id`);
            const childrenAttr = models.find(a => a.get("name") === `${def.key}_link_children`);
            const roundsAttr = models.find(a => a.get("name") === `${def.key}_rounds`);

            const linkHostId = hostAttr ? hostAttr.get("current") : null;
            const linkSourceRowId = srcAttr ? srcAttr.get("current") : null;
            let linkChildren = [];
            if (childrenAttr && childrenAttr.get("current")) {
                try { linkChildren = JSON.parse(childrenAttr.get("current")); } catch (e) { linkChildren = []; }
            }

            // 判定是否属于已登记追踪状态：
            // 只要在 tracked_debuffs 属性中登记、或者处于激活状态、或者存在 rounds 属性、或者持有上/下游链接关系，均代表该 Debuff 属于该角色
            const isTracked = trackedSet.has(def.key) || isActive || roundsAttr || linkHostId || (Array.isArray(linkChildren) && linkChildren.length > 0);
            if (isTracked) {
                let rounds = null;
                if (roundsAttr && roundsAttr.get("current") !== "" && roundsAttr.get("current") !== null) {
                    const r = Number(roundsAttr.get("current"));
                    if (!isNaN(r)) rounds = r;
                }
                debuffs.push({
                    rowId: def.key,
                    key: def.key,
                    name: def.name,
                    enabled: !!isActive,
                    rounds,
                    initRounds: null,
                    isDebuff: true,
                    linkHostId,
                    linkSourceRowId,
                    linkChildren
                });
            }
        }
        return debuffs;
    }

    /**
     * 纯同步：从角色底层内存对象中提取当前实际处于“激活”状态的负面状态 (供先攻条与 Token 角标徽章渲染)
     */
    static getActiveDebuffsSync(character) {
        return this.getAllDebuffsSync(character).filter(d => d.enabled);
    }

    /**
     * 异步：提取角色身上所有已登记的 Debuff (包含已激活与已关停，供视口渲染)
     */
    static async getAllDebuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        return this.getAllDebuffsSync(character);
    }

    /**
     * 纯同步：从角色底层内存对象中瞬时提取当前激活的正面 Buff 状态（0ms 零延迟、单次 O(N) 索引扫描）
     */
    static getActiveBuffsSync(character) {
        if (!character || !character.attribs || !character.attribs.models) return [];
        const models = character.attribs.models;
        const activeMap = new Map();

        for (let i = 0; i < models.length; i++) {
            const a = models[i];
            const attrName = a.get("name") || "";
            if (!attrName.startsWith("repeating_buff2_")) continue;
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) continue;
            const rowId = match[1];
            const subKey = match[2];

            let item = activeMap.get(rowId);
            if (!item) {
                item = { rowId, prefix: `repeating_buff2_${rowId}`, enabled: false, name: "", rounds: null };
                activeMap.set(rowId, item);
            }

            if (subKey === "enable_toggle") {
                const val = a.get("current");
                item.enabled = (val === 1 || val === "1" || val === true);
            } else if (subKey === "name") {
                item.name = a.get("current") || "";
            } else if (subKey === "rounds") {
                const cur = a.get("current");
                if (cur !== "" && cur !== null && cur !== undefined) {
                    const r = Number(cur);
                    if (!isNaN(r)) item.rounds = r;
                }
            }
        }

        const buffs = [];
        for (const item of activeMap.values()) {
            if (item.enabled) {
                buffs.push({
                    rowId: item.rowId,
                    prefix: item.prefix,
                    name: item.name || "未命名Buff",
                    enabled: true,
                    rounds: item.rounds
                });
            }
        }
        return buffs;
    }

    /**
     * 提取角色当前激活的原生负面状态 (Debuff / Condition) (兼容异步调用)
     */
    static async getActiveDebuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        return this.getActiveDebuffsSync(character);
    }

    /**
     * 判定属性名是否属于 Buff 或 Debuff 核心控制字段
     */
    static isBuffCoreAttrName(name) {
        if (!name) return false;
        if (name.startsWith("condition-")) return true;
        if (name.startsWith("repeating_buff2_")) return true;
        return false;
    }

    static _pendingDownstreamSyncMap = new Map();
    static _downstreamSyncTimer = null;
    static _focusoutHooked = false;

    /**
     * 初始化失焦驱动与交互结算监听（确保与原生及 iframe 失焦协同）
     */
    static initFocusoutDownstreamSync() {
        if (this._focusoutHooked || typeof window === "undefined") return;
        this._focusoutHooked = true;

        const onDismissOrBlur = (e) => {
            if (this._pendingDownstreamSyncMap.size > 0) {
                this.triggerPendingDownstreamSync("blur_interaction");
            }
        };

        window.addEventListener("focusout", onDismissOrBlur, { capture: true, passive: true });
        window.addEventListener("pointerdown", onDismissOrBlur, { capture: true, passive: true });
    }

    /**
     * 结算并触发所有暂存的下游自动同步
     */
    static async triggerPendingDownstreamSync(reason = "blur") {
        if (this._downstreamSyncTimer) {
            clearTimeout(this._downstreamSyncTimer);
            this._downstreamSyncTimer = null;
        }
        if (this._pendingDownstreamSyncMap.size === 0) return;

        const tasks = Array.from(this._pendingDownstreamSyncMap.values());
        this._pendingDownstreamSyncMap.clear();

        for (const { char, rowId } of tasks) {
            try {
                const count = await Pf1eBuffManager.broadcastDownstreamSync(char, rowId);
                if (count > 0) {
                    console.log(`[Pf1eBuffUI] 结合失焦与云端同步事件，已自动向 ${count} 个下游副本同步最新细目 (契机: ${reason})`);
                }
            } catch (err) {
                console.error("[Pf1eBuffUI] 自动同步下游异常:", err);
            }
        }
    }

    /**
     * 挂载底层属性持久化单一源头报告器（彻底取代散乱的人物卡事件监听）
     * 拦截原生人物卡编辑器 (advancedSheetSave) 与标准保存 (save/syncedSave)，由源头直接报告变动
     */
    static hookAttributePersistence() {
        this.initFocusoutDownstreamSync();
        const char = window.Campaign?.characters?.at(0);
        const modelClass = char?.attribs?.model;
        const proto = modelClass?.prototype;
        if (!proto || proto._r20SuiteAttrHooked) return true;

        const origAdvancedSave = proto.advancedSheetSave;
        if (typeof origAdvancedSave === "function") {
            proto.advancedSheetSave = function(data, callback) {
                const res = origAdvancedSave.apply(this, arguments);
                Pf1eBuffUI.reportAttributeMutationFromSource(this, "advancedSheetSave");
                return res;
            };
        }

        const origSyncedSave = proto.syncedSave;
        if (typeof origSyncedSave === "function") {
            proto.syncedSave = function(attrs) {
                const res = origSyncedSave.apply(this, arguments);
                Pf1eBuffUI.reportAttributeMutationFromSource(this, "syncedSave");
                return res;
            };
        }

        const origSave = proto.save;
        if (typeof origSave === "function") {
            proto.save = function(key, val, options) {
                const res = origSave.apply(this, arguments);
                const opts = (typeof key === "object" ? val : options) || {};
                if (!opts.bySuite && !opts.bySuiteSync && !Pf1eBuffManager.isScriptMutating) {
                    Pf1eBuffUI.reportAttributeMutationFromSource(this, "save");
                }
                return res;
            };
        }

        proto._r20SuiteAttrHooked = true;
        return true;
    }

    /**
     * 属性变动统一源头报告：仅在原生人物卡或外部修改关键字段时，定向通知先攻条、视口以及下游自动同步
     */
    static reportAttributeMutationFromSource(attrModel, sourceAction = "save") {
        if (!attrModel) return;
        const attrName = attrModel.get ? attrModel.get("name") : "";
        if (!this.isBuffCoreAttrName(attrName)) return;

        const charId = attrModel.collection?.character?.id;
        if (!charId) return;

        // 1. 定向通知先攻条徽章便签板微任务合并刷新
        this.scheduleTokensRepresentingCharacter(charId);

        // 2. 若当前自研悬浮窗正好聚焦该角色，同步刷新当前视口呈现最新内存变量
        try {
            if (typeof window !== "undefined") {
                const P = window.Roll20Suite?.BuffFloatingPanel;
                if (P && P.activeTarget && P.activeTarget.id === charId) {
                    P.renderViewport();
                }
            }
        } catch (e) {}

        // 3. 宿主源 Buff 下游自动同步调度：结合 syncedSave 与失焦事件
        if (attrName.startsWith("repeating_buff2_")) {
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) return;
            const rowId = match[1];
            const subKey = match[2];
            const prefix = `repeating_buff2_${rowId}`;

            // 若为原生开关激活（enable_toggle 变为 1），直接在底层源头合并执行初始轮数重置！
            if (subKey === "enable_toggle") {
                const curVal = attrModel.get ? attrModel.get("current") : null;
                if (curVal === 1 || curVal === "1" || curVal === true) {
                    const char = attrModel.collection?.character || window.Campaign?.characters?.get(charId);
                    if (char && !Pf1eBuffManager.isScriptMutating) {
                        Pf1eBuffManager.resetBuffRoundsToInitial(char, rowId);
                    }
                }
                return;
            }

            // 严格排除本地独立字段（剩余轮数）以及链接元属性
            if (subKey === "rounds" || subKey.startsWith("link_")) {
                return;
            }

            const char = attrModel.collection?.character || window.Campaign?.characters?.get(charId);
            if (!char || !char.attribs) return;

            // 排除子链接副本，防止回环广播
            const isChild = char.attribs.models.some(a => a.get("name") === `${prefix}_link_host_id`);
            if (isChild) return;

            // 暂存待广播任务（在 triggerPendingDownstreamSync -> broadcastDownstreamSync 内部具备拓扑自愈下游能力）
            const syncKey = `${charId}:${rowId}`;
            this._pendingDownstreamSyncMap.set(syncKey, { char, rowId });

            // 启动防抖静止倒计时（600ms 内无后续修改且未显式触发失焦时兜底完成结算）
            if (this._downstreamSyncTimer) clearTimeout(this._downstreamSyncTimer);
            this._downstreamSyncTimer = setTimeout(() => {
                this.triggerPendingDownstreamSync("debounce_quiet");
            }, 600);
        }
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
                    this.pendingTokenIds.add(tokenId);
                }
            }
        }

        if (!this.isFlushingScheduled && this.pendingTokenIds.size > 0) {
            this.isFlushingScheduled = true;
            queueMicrotask(() => {
                this.flushPendingRefreshes();
            });
        }
    }

    /**
     * 纯同步：全量扫描先攻列表并就地调和徽章（具备签名机制，未变动的行 0 破坏、0 DOM 重绘）
     */
    static syncPatchAllBadges(options = {}) {
        this.injectStyles();
        this.hookAttributePersistence();
        this.hookVueTurnTracker();

        // 现代 Jumpgate 优先匹配 #vm-turn-order 与 .turn-tracker，兼顾旧版 #initiativewindow
        const rows = document.querySelectorAll("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
        if (!rows || rows.length === 0) return;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                this.refreshRowBadgeSync(row, tokenId, options);
            }
        }
    }

    /**
     * 刷新整个先攻条上的徽章（兼容旧版外部调用）
     */
    static async refreshAllBadges(options = {}) {
        this.syncPatchAllBadges(options);
    }

    /**
     * 纯同步：定向精准刷新单个 Token 徽章（仅修改变动的那一个，零触碰其余行）
     */
    static refreshSingleTokenBadgeSync(tokenId, options = {}) {
        if (!tokenId) return;
        const selector = `#vm-turn-order li.token[data-tokenid="${tokenId}"], .turn-tracker li.token[data-tokenid="${tokenId}"], #initiativewindow li.token[data-tokenid="${tokenId}"]`;
        const row = document.querySelector(selector);
        if (row) {
            this.refreshRowBadgeSync(row, tokenId, { force: true, ...options });
        }
    }

    /**
     * 定向精准刷新单个 Token 徽章（兼容旧版异步调用）
     */
    static async refreshSingleTokenBadge(tokenId, options = {}) {
        this.refreshSingleTokenBadgeSync(tokenId, options);
    }

    /**
     * 纯同步：刷新单行徽章（签名守卫：未发生内容变动时跳过，保留原生节点不破坏）
     * 统一双行布局：Debuff 在人物头像/名称/先攻上面一行，正面 Buff 在下面一行
     */
    static refreshRowBadgeSync(row, tokenId, options = {}) {
        if (!row || !tokenId) return;

        // 清理任何残留的旧 + 号按钮
        row.querySelectorAll(".r20-add-buff-btn").forEach(el => el.remove());

        // 1. 初始化或提取独立的 Debuff 容器 (order: -1，置于头像名称上一行)
        const existingDebuffContainers = Array.from(row.querySelectorAll(".r20-debuff-container"));
        let debuffContainer = existingDebuffContainers.length > 0 ? existingDebuffContainers[0] : null;
        if (existingDebuffContainers.length > 1) {
            for (let i = 1; i < existingDebuffContainers.length; i++) existingDebuffContainers[i].remove();
        }
        if (!debuffContainer) {
            debuffContainer = document.createElement("div");
            debuffContainer.className = "r20-debuff-container";
            row.insertBefore(debuffContainer, row.firstChild);
        }

        // 2. 初始化或提取独立的正面 Buff 容器 (order: 99，置于头像名称下一行)
        const existingBuffContainers = Array.from(row.querySelectorAll(".r20-buff-container"));
        let buffContainer = existingBuffContainers.length > 0 ? existingBuffContainers[0] : null;
        if (existingBuffContainers.length > 1) {
            for (let i = 1; i < existingBuffContainers.length; i++) existingBuffContainers[i].remove();
        }
        if (!buffContainer) {
            buffContainer = document.createElement("div");
            buffContainer.className = "r20-buff-container";
            row.appendChild(buffContainer);
        }

        // 3. 权限拦截脱敏守卫：如果当前用户不是 GM 且无权查看该 Token 的 Buff（非自己控制且非可见队友），直接隐藏且清空，严防偷看
        if (!Roll20Bridge.canViewTokenBuffs(tokenId)) {
            debuffContainer.innerHTML = "";
            debuffContainer.style.display = "none";
            buffContainer.innerHTML = "";
            buffContainer.dataset.signature = "unauthorized";
            buffContainer.style.display = "none";
            return;
        }

        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const targetMode = Roll20Bridge.resolveBuffTargetMode(token);
        const character = targetMode.mode === "char" ? targetMode.char : null;

        let activeBuffs = [];
        let activeDebuffs = [];

        if (targetMode.mode === "char" && targetMode.char) {
            activeBuffs = this.getActiveBuffsSync(targetMode.char);
            activeDebuffs = this.getActiveDebuffsSync(targetMode.char);
        } else if (token) {
            activeBuffs = TokenBuffManager.getTokenBuffs(token).map(b => ({
                name: b.name,
                rounds: b.rounds,
                rowId: b.rowId || null,
                isTokenOnly: true
            }));
            activeDebuffs = TokenBuffManager.getTokenDebuffs(token)
                .filter(d => !!d.enabled)
                .map(d => ({
                    name: d.name,
                    key: d.key,
                    rounds: d.rounds,
                    rowId: d.rowId || d.key,
                    isTokenOnly: true
                }));
        }

        const isAbbr = !!SuiteConfigStore.getSetting("turnorder_buff_abbr", false);

        // 计算当前签名（合并 Debuff 与 Buff 状态）
        const buffSig = activeBuffs.map(b => `${b.name}:${b.rounds}`).join("|");
        const debuffSig = activeDebuffs.map(d => `${d.name}:${d.rounds}`).join("|");
        const signature = `abbr:${isAbbr}|B:${buffSig}|D:${debuffSig}`;

        // 若未强制刷新且签名未变，直接返回，保持原生 DOM 零重绘！
        if (!options.force && buffContainer.dataset.signature === signature) {
            return;
        }

        buffContainer.dataset.signature = signature;
        debuffContainer.innerHTML = "";
        buffContainer.innerHTML = "";

        // 4. 渲染上面的 Debuff 徽章行
        if (activeDebuffs.length === 0) {
            debuffContainer.style.display = "none";
        } else {
            debuffContainer.style.display = "flex";
            for (let i = 0; i < activeDebuffs.length; i++) {
                const debuff = activeDebuffs[i];
                const pill = document.createElement("span");
                const displayName = isAbbr ? (debuff.name ? debuff.name.charAt(0) : "减") : debuff.name;
                const showRounds = debuff.rounds !== null && debuff.rounds <= 100;

                pill.className = "r20-buff-pill-debuff";
                pill.title = `${debuff.name} (负面状态${showRounds ? ' 剩余' + debuff.rounds + '轮' : ' 常驻'})，点击修改轮数，右键关停解除`;
                pill.innerHTML = `
                    <span class="r20-pill-name">${escapeHtml(displayName)}</span>
                    ${showRounds ? `<span class="r20-pill-round" title="点击就地快速修改轮数">${escapeHtml(debuff.rounds)}</span>` : ""}
                `;

                // 就地快速编辑轮数（无弹窗）
                const roundSpan = pill.querySelector(".r20-pill-round");
                const startInlineEdit = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    Roll20Bridge.attachInlineRoundEditor(roundSpan || pill.querySelector(".r20-pill-name"), {
                        initialValue: showRounds ? debuff.rounds : "",
                        placeholder: "轮数",
                        className: "r20-input-round-inline-pill",
                        container: pill,
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, character);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }

                            try {
                                if (character) {
                                    const condKey = `${debuff.key}_rounds`;
                                    let attr = Roll20Bridge.findAttr(character, condKey);
                                    if (newRounds !== null) {
                                        if (attr) {
                                            attr.save({ current: newRounds });
                                        } else {
                                            character.attribs.create({ name: condKey, current: newRounds, max: "" });
                                        }
                                    } else {
                                        if (attr) attr.destroy();
                                    }
                                } else if (token) {
                                    const list = TokenBuffManager.getTokenDebuffs(token);
                                    const target = list.find(b => (b.key || b.name) === debuff.key);
                                    if (target) {
                                        target.rounds = newRounds;
                                        TokenBuffManager.saveTokenDebuffs(token, list);
                                    }
                                }
                            } catch (err) {
                                console.error("[Pf1eBuffUI] 保存 Debuff 轮数异常:", err);
                            }
                            await this.refreshRowBadge(row, tokenId, { force: true });
                            await this.notifyPanelsRefresh();
                        }
                    });
                };

                roundSpan?.addEventListener("click", startInlineEdit);
                pill.querySelector(".r20-pill-name")?.addEventListener("click", startInlineEdit);

                // 右键快速关停解除
                pill.addEventListener("contextmenu", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (character) {
                            await Pf1eBuffManager.toggleCondition(character, debuff.key, false);
                        } else if (token) {
                            TokenBuffManager.toggleDebuff(token, debuff.key, false);
                        }
                    } catch (err) {
                        console.error("[Pf1eBuffUI] 关停解除 Debuff 异常:", err);
                    }
                    await this.refreshRowBadge(row, tokenId, { force: true });
                    await this.notifyPanelsRefresh();
                });

                debuffContainer.appendChild(pill);
            }
        }

        // 5. 渲染下面的正面 Buff 徽章行
        if (activeBuffs.length === 0) {
            buffContainer.style.display = "none";
        } else {
            buffContainer.style.display = "flex";
            for (let i = 0; i < activeBuffs.length; i++) {
                const item = activeBuffs[i];
                const pill = document.createElement("span");
                const displayName = isAbbr ? (item.name ? item.name.charAt(0) : "增") : item.name;
                const isExpiring = item.rounds !== null && item.rounds <= 1;
                const showRounds = item.rounds !== null && item.rounds <= 100;

                pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
                pill.title = `${item.name} (${showRounds ? '剩余 ' + item.rounds + ' 轮' : '常驻'})，点击修改轮数，右键关停解除`;
                pill.innerHTML = `
                    <span class="r20-pill-name">${escapeHtml(displayName)}</span>
                    ${showRounds ? `<span class="r20-pill-round" title="点击就地快速修改轮数">${escapeHtml(item.rounds)}</span>` : ""}
                `;

                // 就地快速编辑轮数（无弹窗）
                const roundSpan = pill.querySelector(".r20-pill-round");
                const startInlineEdit = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    Roll20Bridge.attachInlineRoundEditor(roundSpan || pill.querySelector(".r20-pill-name"), {
                        initialValue: showRounds ? item.rounds : "",
                        placeholder: "轮数",
                        className: "r20-input-round-inline-pill",
                        container: pill,
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, character);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }

                            try {
                                if (character && item.rowId) {
                                    await Pf1eBuffManager.setBuffRounds(character, item.rowId, newRounds);
                                } else if (token) {
                                    TokenBuffManager.applyOrRefreshBuff(token, item.name, newRounds);
                                }
                            } catch (err) {
                                console.error("[Pf1eBuffUI] 保存 Buff 轮数异常:", err);
                            }
                            await this.refreshRowBadge(row, tokenId, { force: true });
                            await this.notifyPanelsRefresh();
                        }
                    });
                };

                roundSpan?.addEventListener("click", startInlineEdit);
                pill.querySelector(".r20-pill-name")?.addEventListener("click", startInlineEdit);

                // 右键快速关停解除
                pill.addEventListener("contextmenu", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        if (character && item.rowId) {
                            await Pf1eBuffManager.toggleBuff(character, item.rowId, false);
                        } else if (character) {
                            await Pf1eBuffManager.removeBuffByName(character, item.name);
                        } else if (token) {
                            TokenBuffManager.removeBuff(token, item.name);
                        }
                    } catch (err) {
                        console.error("[Pf1eBuffUI] 关停解除 Buff 异常:", err);
                    }
                    await this.refreshRowBadge(row, tokenId, { force: true });
                    await this.notifyPanelsRefresh();
                });

                buffContainer.appendChild(pill);
            }
        }
    }

    /**
     * 刷新单行徽章（兼容异步调用）
     */
    static async refreshRowBadge(row, tokenId, options = {}) {
        this.refreshRowBadgeSync(row, tokenId, options);
    }

    /**
     * 单个 Debuff 点击快捷修改轮数/关停弹窗
     */
    static showDebuffEditModal(character, debuff, tokenId) {
        if (!character) return;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";
        const currentRoundsStr = debuff.rounds !== null ? String(debuff.rounds) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header" style="color:#f43f5e;">负面状态: ${Roll20Bridge.escapeHtml(debuff.name)}</div>
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
                const condAttr = Roll20Bridge.findAttr(character, debuff.key);
                if (condAttr) condAttr.save({ current: "0" });
                const roundsAttr = Roll20Bridge.findAttr(character, `${debuff.key}_rounds`);
                if (roundsAttr) roundsAttr.destroy();
                this.requestTokenRefresh(tokenId);
            } catch (err) {
                console.error("[Pf1eBuffUI] 解除 Debuff 异常:", err);
            } finally {
                mask.remove();
                this.notifyPanelsRefresh();
            }
        });

        // 保存轮数
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const inputVal = mask.querySelector(".input-rounds").value.trim();
            try {
                const roundsKey = `${debuff.key}_rounds`;
                let roundsAttr = Roll20Bridge.findAttr(character, roundsKey);
                if (inputVal === "" || isNaN(Number(inputVal))) {
                    if (roundsAttr) roundsAttr.destroy();
                } else {
                    const r = Number(inputVal);
                    if (roundsAttr) {
                        roundsAttr.save({ current: r });
                    } else {
                        character.attribs?.create({ name: roundsKey, current: r, max: "" });
                    }
                }
                this.requestTokenRefresh(tokenId);
            } catch (err) {
                console.error("[Pf1eBuffUI] 更新 Debuff 轮数异常:", err);
            } finally {
                mask.remove();
                this.notifyPanelsRefresh();
            }
        });
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
}

    // ==========================================
    // 10. CharacterSheetTitleCopier (官方人物卡 Title 属性快捷复制助手)
    // ==========================================
/**
 * Roll20 Suite - 官方人物卡控件 Title 宏属性快速复制助手
 * 
 * 核心功能：
 * 1. 双通道快捷复制：Alt + 鼠标左键点击 或 鼠标滚轮中键点击 任意带有 title 属性的控件/标签，直接复制 title 内容到系统剪贴板；
 * 2. 智能解析 repeating section：若 title 中包含 $X，自动向上追溯 .repitem 替换为当前行真实的 data-reprowid；
 * 3. 即时 Toast 反馈：在光标点击位置上方弹出轻量 HUD 气泡，提示“已复制: @{...}”并在 1.2 秒内平滑淡出，附带目标微光高亮；
 * 4. 事件委托与 iframe 全局穿透：自动监听当前与后续所有动态打开的人物卡 iframe，零性能开销。
 */
class CharacterSheetTitleCopier {
    static isInitialized = false;
    static boundDocuments = new WeakSet();
    static observer = null;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetTitleCopier] 启动官方人物卡 Title 属性快捷复制助手 (Alt+点击 / 滚轮中键)...");

        // 1. 监听主窗口 document（针对非 iframe 渲染的卡片与原生弹窗）
        if (typeof document !== "undefined") {
            this.attachToDocument(document);
        }

        // 2. 扫描并监听当前已打开的所有人物卡 iframe
        this.scanAndAttachAllFrames();

        // 3. 启动 MutationObserver 监听未来动态打开的人物卡弹窗与 iframe
        this.startFrameObserver();
    }

    /**
     * 将事件委托挂载到指定的 document 上
     */
    static attachToDocument(doc) {
        if (!doc || !doc.body) return;
        if (this.boundDocuments.has(doc)) return;
        this.boundDocuments.add(doc);

        // 注入 Toast 与高亮动画所需的轻量 CSS
        this.injectStyles(doc);

        // 统一在捕获阶段监听 click 与 auxclick 事件
        const clickHandler = (e) => this.handleEvent(e, doc);
        
        doc.addEventListener("click", clickHandler, true);
        doc.addEventListener("auxclick", clickHandler, true);
    }

    /**
     * 核心事件处理逻辑
     */
    static handleEvent(e, doc) {
        // 判定触发条件：Alt + 左键 (button 0) 或 滚轮中键 (button 1)
        const isAltLeft = e.altKey && e.button === 0;
        const isMiddleClick = e.button === 1;
        if (!isAltLeft && !isMiddleClick) return;

        // 查找目标控件及 title 属性
        const targetInfo = this.findTargetTitle(e.target);
        if (!targetInfo || !targetInfo.rawTitle) return;

        // 阻止默认行为与原生事件冒泡，避免误触表单提交、打字选区或勾选框翻转
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
            e.stopImmediatePropagation();
        }

        // 智能解析宏公式语法（展开 repeating 行中的 $X）
        const resolvedText = this.resolveMacroTitle(targetInfo.rawTitle, targetInfo.element);

        // 执行剪贴板复制
        this.copyToClipboard(resolvedText, doc).then((success) => {
            if (success) {
                this.showFeedback(resolvedText, targetInfo.element, e, doc);
            }
        });
    }

    /**
     * 精确查找带有有效 title 的目标元素
     */
    static findTargetTitle(startEl) {
        if (!startEl || typeof startEl.getAttribute !== "function") return null;

        // 1. 直接检查自身
        const directTitle = startEl.getAttribute("title");
        if (directTitle && directTitle.trim()) {
            return { element: startEl, rawTitle: directTitle.trim() };
        }

        // 2. 如果点击的是 label 或 label 内的文本，优先检查内部的输入控件
        const label = startEl.closest("label");
        if (label) {
            const innerCtrl = label.querySelector("input[title], select[title], textarea[title], button[title]");
            if (innerCtrl) {
                const innerTitle = innerCtrl.getAttribute("title");
                if (innerTitle && innerTitle.trim()) {
                    return { element: innerCtrl, rawTitle: innerTitle.trim() };
                }
            }
            const labelTitle = label.getAttribute("title");
            if (labelTitle && labelTitle.trim()) {
                return { element: label, rawTitle: labelTitle.trim() };
            }
        }

        // 3. 向上回溯查找最近的父级（最多 3 层）
        let curr = startEl.parentElement;
        let depth = 0;
        while (curr && depth < 3) {
            if (curr.tagName === "BODY" || curr.tagName === "HTML" || curr.classList?.contains("characterdialog")) {
                break;
            }
            const parentTitle = curr.getAttribute("title");
            if (parentTitle && parentTitle.trim()) {
                return { element: curr, rawTitle: parentTitle.trim() };
            }
            curr = curr.parentElement;
            depth++;
        }

        return null;
    }

    /**
     * 智能宏文本解析：自动将 Repeating Section 中的 $X 替换为具体 rowId
     */
    static resolveMacroTitle(rawTitle, element) {
        let text = rawTitle.trim();

        if (/\$[Xx]/.test(text)) {
            const repItem = element.closest(".repitem");
            if (repItem) {
                let rowId = repItem.getAttribute("data-reprowid");
                if (!rowId) {
                    const namedInput = repItem.querySelector('input[name*="repeating_"]');
                    if (namedInput) {
                        const m = (namedInput.getAttribute("name") || "").match(/repeating_[^_]+_([^_]+)_/);
                        if (m) rowId = m[1];
                    }
                }
                if (rowId) {
                    text = text.replace(/\$[Xx]/g, rowId);
                }
            }
        }

        return text;
    }

    /**
     * 跨环境剪贴板复制，具备多层容错
     */
    static async copyToClipboard(text, doc = document) {
        if (!text) return false;

        // 优先使用主窗口的 navigator.clipboard
        try {
            if (window.navigator?.clipboard?.writeText) {
                await window.navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {}

        // 回退机制：使用临时 textarea 元素触发 execCommand('copy')
        try {
            const targetDoc = doc || document;
            const ta = targetDoc.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            ta.style.pointerEvents = "none";
            ta.style.left = "-9999px";
            ta.style.top = "-9999px";
            (targetDoc.body || targetDoc.documentElement).appendChild(ta);
            ta.focus();
            ta.select();
            const res = targetDoc.execCommand("copy");
            ta.remove();
            if (res) return true;
        } catch (err) {
            console.warn("[CharacterSheetTitleCopier] execCommand 复制失败:", err);
        }

        return false;
    }

    /**
     * 显示视觉反馈（Toast 气泡与控件高亮）
     */
    static showFeedback(copiedText, element, event, doc) {
        try {
            // 1. 控件高亮微光动画
            if (element && element.classList) {
                element.classList.remove("r20-suite-copied-highlight");
                void element.offsetWidth; // 触发 reflow 重置动画
                element.classList.add("r20-suite-copied-highlight");
                if (typeof setTimeout !== "undefined") {
                    setTimeout(() => {
                        try { element.classList.remove("r20-suite-copied-highlight"); } catch (e) {}
                    }, 800);
                }
            }

            // 2. 移除旧 Toast（防止快速连击导致堆叠）
            const oldToast = doc.getElementById("r20-suite-title-toast");
            if (oldToast) oldToast.remove();

            // 3. 构建全新 Toast DOM
            const toast = doc.createElement("div");
            toast.id = "r20-suite-title-toast";
            toast.className = "r20-suite-title-toast";

            // 格式化展示文本（超长截断展示，实际已全量复制）
            const displaySnippet = copiedText.length > 40 ? copiedText.substring(0, 37) + "..." : copiedText;
            const safeDisplay = typeof Roll20Bridge !== "undefined" && Roll20Bridge.escapeHtml 
                ? Roll20Bridge.escapeHtml(displaySnippet) 
                : displaySnippet.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

            toast.innerHTML = `<span style="color:#60a5fa;margin-right:4px;">📋 已复制:</span><strong style="color:#fcd34d;">${safeDisplay}</strong>`;

            // 计算精准定位坐标
            let posX = event?.pageX;
            let posY = event?.pageY;

            if (posX === undefined || posY === undefined) {
                const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
                const scrollX = doc.defaultView?.pageXOffset || doc.documentElement?.scrollLeft || 0;
                const scrollY = doc.defaultView?.pageYOffset || doc.documentElement?.scrollTop || 0;
                posX = rect.left + rect.width / 2 + scrollX;
                posY = rect.top + scrollY;
            }

            toast.style.left = `${posX}px`;
            toast.style.top = `${Math.max(8, posY - 30)}px`;

            const container = doc.body || doc.documentElement;
            if (container && typeof container.appendChild === "function") {
                container.appendChild(toast);
            }

            // 1.2 秒后自动销毁
            if (typeof setTimeout !== "undefined") {
                setTimeout(() => {
                    if (toast && toast.parentNode) {
                        toast.remove();
                    }
                }, 1200);
            }
        } catch (e) {
            console.warn("[CharacterSheetTitleCopier] 显示 Toast 反馈异常:", e);
        }
    }

    /**
     * 注入自洽样式
     */
    static injectStyles(doc) {
        try {
            if (!doc || doc.getElementById("r20-suite-title-copier-style")) return;
            const style = doc.createElement("style");
            style.id = "r20-suite-title-copier-style";
            style.textContent = `
@keyframes r20SuiteToastFadeUp {
    0% { opacity: 0; transform: translate(-50%, 6px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    80% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -10px); }
}
@keyframes r20SuitePulseBorder {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); outline: 1px solid #3b82f6; }
    50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); outline: 1px solid #60a5fa; }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); outline: none; }
}
.r20-suite-title-toast {
    position: absolute;
    z-index: 9999999;
    background: rgba(18, 22, 28, 0.95);
    border: 1px solid #3b82f6;
    border-radius: 5px;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    font-size: 11px;
    line-height: 1.4;
    padding: 4px 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: r20SuiteToastFadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    white-space: nowrap;
    max-width: 380px;
    text-overflow: ellipsis;
    overflow: hidden;
}
.r20-suite-copied-highlight {
    animation: r20SuitePulseBorder 0.6s ease-out !important;
}
`;
            (doc.head || doc.body || doc.documentElement).appendChild(style);
        } catch (e) {}
    }

    /**
     * 扫描并挂载所有已有的 iframe
     */
    static scanAndAttachAllFrames() {
        try {
            if (typeof document === "undefined") return;
            const iframes = document.querySelectorAll(".characterdialog iframe, iframe.charactersheet, iframe");
            iframes.forEach(iframe => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc && doc.body) {
                        this.attachToDocument(doc);
                    }
                    // 监听 iframe 的 load 事件，确保重新加载后依然挂载
                    iframe.removeEventListener("load", iframe._r20SuiteFrameLoadHandler);
                    iframe._r20SuiteFrameLoadHandler = () => {
                        try {
                            const newDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (newDoc && newDoc.body) {
                                CharacterSheetTitleCopier.attachToDocument(newDoc);
                            }
                        } catch (err) {}
                    };
                    iframe.addEventListener("load", iframe._r20SuiteFrameLoadHandler);
                } catch (e) {}
            });
        } catch (e) {}
    }

    /**
     * 监听后续动态打开的人物卡 iframe
     */
    static startFrameObserver() {
        if (this.observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return;

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // ELEMENT_NODE
                            if (node.tagName === "IFRAME") {
                                this.handleIframeNode(node);
                            } else if (node.querySelectorAll) {
                                const iframes = node.querySelectorAll("iframe");
                                iframes.forEach(frame => this.handleIframeNode(frame));
                            }
                        }
                    }
                }
            }
        });

        if (document.body) {
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    static handleIframeNode(iframe) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && doc.body) {
                this.attachToDocument(doc);
            }
            iframe.addEventListener("load", () => {
                try {
                    const newDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (newDoc && newDoc.body) {
                        this.attachToDocument(newDoc);
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    /**
     * 销毁与注销
     */
    static destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isInitialized = false;
    }
}

    // ==========================================
    // 11. CharacterSheetBuffEnhancer (官方人物卡 Buff 预置初始轮数注入增强器)
    // ==========================================
/**
 * Roll20 Suite - 官方人物卡 Buff 增强注入器
 * 遵循“原生人物卡 DOM 模板注入规范”与“自定义数据联动宿主行为合流原则”：
 * 1. 直接在源头修改全局共享模板 (char.characterSheet.layouthtml) 以及原生 fieldset；
 * 2. 挂钩官方人物卡保存入口 (CharacterView.prototype.saveSheetValues)，将轮数设置与开关激活合并在宿主同一行动中！
 */
class CharacterSheetBuffEnhancer {
    static isInitialized = false;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetBuffEnhancer] 启动官方人物卡源头 DOM 模板注入器...");

        // 1. 拦截官方人物卡 View 原型生命周期，确保任何卡片渲染前模板均已打好补丁
        this.hookCharacterViewPrototype();

        // 2. 直接对战役全局共享的 characterSheet 单例模板打补丁
        this.patchGlobalCharacterSheetTemplate();

        // 3. 对当前屏幕上已经打开的卡片进行一次性模板与既有项调和
        this.patchOpenDialogs();

        // 4. 启动官方人物卡 title 快捷复制功能（Alt+点击 / 滚轮中键）
        CharacterSheetTitleCopier.init();
    }

    /**
     * 拦截 CharacterView 原型生命周期 (postRender)，实现模板的零延时源头固化
     */
    static hookCharacterViewPrototype() {
        try {
            const char = window.Campaign?.characters?.at(0);
            const proto = char?.view ? Object.getPrototypeOf(char.view) : null;
            if (!proto || proto._r20SuiteTemplateHooked) return;

            const origPostRender = proto.postRender;
            if (typeof origPostRender === "function") {
                proto.postRender = function() {
                    try {
                        if (this.model?.characterSheet) {
                            CharacterSheetBuffEnhancer.patchLayoutHtml(this.model.characterSheet);
                        }
                    } catch (e) {
                        console.warn("[CharacterSheetBuffEnhancer] postRender 模板切面增强异常:", e);
                    }
                    return origPostRender.apply(this, arguments);
                };
            }

            // 挂钩 saveSheetValues：将官方人物卡 Enable 复选框开启与轮数重置合并在同一个原子行动中！
            const origSaveSheetValues = proto.saveSheetValues;
            if (typeof origSaveSheetValues === "function") {
                proto.saveSheetValues = function(el, source) {
                    const res = origSaveSheetValues.apply(this, arguments);
                    try {
                        if (el && window.$) {
                            const $el = window.$(el);
                            const nameAttr = $el.attr("name") || "";
                            if (nameAttr.includes("enable_toggle") && $el.is(":checked")) {
                                const repItem = $el.closest(".repitem");
                                const rowId = repItem.attr("data-reprowid");
                                if (rowId && this.model) {
                                    Pf1eBuffManager.resetBuffRoundsToInitial(this.model, rowId);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("[CharacterSheetBuffEnhancer] saveSheetValues 原生合流切面异常:", e);
                    }
                    return res;
                };
            }

            // 挂钩 deleteRepeatingRow：将官方人物卡删除 Repeating Row 完整收敛至插件级联销毁体系中！
            const origDeleteRepeatingRow = proto.deleteRepeatingRow;
            if (typeof origDeleteRepeatingRow === "function") {
                proto.deleteRepeatingRow = function(sectionName, rowId) {
                    if (sectionName === "repeating_buff2" && rowId && this.model) {
                        try {
                            const char = this.model;
                            const prefix = `repeating_buff2_${rowId}_`.toLowerCase();
                            const snapshot = {};
                            if (char.attribs && char.attribs.models) {
                                for (const a of char.attribs.models) {
                                    const n = (a.get("name") || "").toLowerCase();
                                    if (n.startsWith(prefix)) {
                                        snapshot[a.get("name")] = a.get("current");
                                    }
                                }
                            }

                            console.log(`[CharacterSheetBuffEnhancer] 官方人物卡删除 Buff [${rowId}]，由插件全套销毁体系一揽子接管...`);

                            // 一揽子接管：级联小弟自毁 + 向上除名 + 自身所有原生属性物理 destroy + 加值全量重算
                            Pf1eBuffManager.deleteBuffRowPermanently(char, rowId).then(() => {
                                if (typeof Pf1eBuffUI !== "undefined") {
                                    Pf1eBuffUI.requestTokenRefresh(char.id);
                                }
                                try {
                                    if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel) {
                                        window.Roll20Suite.BuffFloatingPanel.renderViewport();
                                    }
                                } catch (e) {}
                            });

                            // 顺带调用官方底层行移除广播，确保官方人物卡 Worker 正常收尾
                            const P = this;
                            if (P.d20?.journal?.notifyWorkersOfRowDeleted) {
                                P.d20.journal.notifyWorkersOfRowDeleted(char.id, sectionName, rowId, "player", snapshot);
                            } else if (window.d20?.journal?.notifyWorkersOfRowDeleted) {
                                window.d20.journal.notifyWorkersOfRowDeleted(char.id, sectionName, rowId, "player", snapshot);
                            }
                            return;
                        } catch (e) {
                            console.warn("[CharacterSheetBuffEnhancer] deleteRepeatingRow 切面异常，回退至原生:", e);
                        }
                    }
                    return origDeleteRepeatingRow.apply(this, arguments);
                };
            }

            proto._r20SuiteTemplateHooked = true;
            console.log("[CharacterSheetBuffEnhancer] 已成功挂钩 CharacterView 原型 postRender、saveSheetValues 与 deleteRepeatingRow 生命周期");
        } catch (err) {
            console.warn("[CharacterSheetBuffEnhancer] 挂钩 CharacterView 原型异常:", err);
        }
    }

    /**
     * 对当前全局共享的 characterSheet 对象进行模板打补丁
     */
    static patchGlobalCharacterSheetTemplate() {
        try {
            const chars = window.Campaign?.characters?.models || [];
            for (const char of chars) {
                if (char.characterSheet?.layouthtml) {
                    this.patchLayoutHtml(char.characterSheet);
                    break; // 所有角色卡共享同一个 characterSheet 引用，修改一次即可
                }
            }
        } catch (err) {
            console.warn("[CharacterSheetBuffEnhancer] 修改全局 characterSheet 模板异常:", err);
        }
    }

    /**
     * 核心：对 layouthtml 字符串中的 repeating_buff2 原生 fieldset 模板进行修改
     */
    static patchLayoutHtml(characterSheet) {
        if (!characterSheet || !characterSheet.layouthtml) return false;
        if (characterSheet.layouthtml.includes('name="attr_init_rounds"')) {
            return true; // 已打过补丁
        }

        const html = characterSheet.layouthtml;
        const fsPos = html.indexOf('fieldset class="repeating_buff2"');
        const altFsPos = html.indexOf("fieldset class='repeating_buff2'");
        const startPos = fsPos !== -1 ? fsPos : altFsPos;
        if (startPos === -1) return false;

        const endFsPos = html.indexOf("</fieldset>", startPos);
        if (endFsPos === -1) return false;

        const fsSnippet = html.substring(startPos, endFsPos);
        const nameIdx = fsSnippet.indexOf('name="attr_name"');
        if (nameIdx === -1) return false;

        // 确定语言标签风格
        const labelText = fsSnippet.includes("名稱") ? "輪數計算式" : (fsSnippet.includes("名称") ? "轮数计算式" : "Rounds Formula");
        const templateTag = this.buildTemplateHTML(labelText);

        // 定位 name 字段所属的闭合 </label> 标签
        const labelEndIdx = fsSnippet.indexOf("</label>", nameIdx);
        if (labelEndIdx === -1) return false;

        const insertOffset = startPos + labelEndIdx + "</label>".length;
        const newHtml = html.substring(0, insertOffset) + "\n" + templateTag + html.substring(insertOffset);

        characterSheet.layouthtml = newHtml;
        console.log("[CharacterSheetBuffEnhancer] 已成功将初始轮数输入框固化至官方源头 characterSheet.layouthtml 模板中");
        return true;
    }

    /**
     * 生成标准原汁原味模板 HTML
     */
    static buildTemplateHTML(labelText = "輪數計算式") {
        return `
<label class="small-label2 entry-med highlight r20-suite-init-rounds-col">
    <input class="macro-text-inline r20-suite-init-rounds" type="text" name="attr_init_rounds" placeholder="0" title="预置初始轮数/公式（例如 10、@{level}*10、10+@{constitution_mod}）。开启 Buff 时借用原生引擎自动求值。">
    <span class="super note-a">${labelText}</span>
</label>`.trim();
    }

    /**
     * 对当前屏幕上已有的卡片弹窗进行一次性兜底调和
     */
    static patchOpenDialogs() {
        const dialogEls = document.querySelectorAll(".characterdialog, .ui-dialog");
        dialogEls.forEach(dialogEl => {
            const iframes = dialogEl.querySelectorAll("iframe");
            iframes.forEach(iframe => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc && doc.body) {
                        this.patchDocumentDOM(doc, dialogEl);
                    }
                } catch (e) {}
            });
        });
    }

    /**
     * 对具体 document 内部已生成的 fieldset 容器及已有条目进行调和
     */
    static patchDocumentDOM(doc, dialogEl) {
        if (!doc) return;

        // 挂载 title 快捷复制功能到当前 document（带 WeakSet 防重）
        CharacterSheetTitleCopier.attachToDocument(doc);

        // 1. 如果该 iframe 内部的 fieldset 尚未包含该字段，就地修补 fieldset.innerHTML（供用户点击 +Add 时直接克隆）
        const fsList = doc.querySelectorAll('fieldset.repeating_buff2, fieldset[class*="repeating_buff2"]');
        fsList.forEach(fs => {
            if (!fs.innerHTML.includes('attr_init_rounds')) {
                const labelText = fs.innerHTML.includes("名稱") ? "輪數計算式" : (fs.innerHTML.includes("名称") ? "轮数计算式" : "Rounds Formula");
                const template = this.buildTemplateHTML(labelText);
                const nameLabelRegex = /(<label[^>]*class="[^"]*entry-25p-shrink[^"]*"[^>]*>[\s\S]*?<\/label>)/i;
                if (nameLabelRegex.test(fs.innerHTML)) {
                    fs.innerHTML = fs.innerHTML.replace(nameLabelRegex, `$1\n${template}`);
                }
            }
        });

        // 2. 对当前已渲染好的既有条目，如果尚未包含该列，就地补齐
        const character = this.findCharacterFromDialog(dialogEl);
        const repItems = doc.querySelectorAll('.repcontainer[data-groupname="repeating_buff2"] .repitem');
        repItems.forEach(item => {
            const existingCol = item.querySelector('.r20-suite-init-rounds-col');
            if (existingCol) {
                existingCol.classList.remove("sect");
                const na = existingCol.querySelector(".note-a");
                if (na && na.textContent.includes("(a)")) {
                    na.textContent = na.textContent.replace(/\(a\)/g, "").trim();
                }
                return;
            }
            if (item.querySelector('.r20-suite-init-rounds')) return;

            const nameInput = item.querySelector('input[name="attr_name"], input[name$="_name"]');
            if (!nameInput) return;
            const nameLabel = nameInput.closest("label");
            if (!nameLabel || !nameLabel.parentNode) return;

            const allText = item.textContent || "";
            const labelText = allText.includes("名稱") ? "輪數計算式" : (allText.includes("名称") ? "轮数计算式" : "Rounds Formula");

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = this.buildTemplateHTML(labelText);
            const newLabel = tempDiv.firstElementChild;
            const input = newLabel.querySelector("input");

            const typeSelect = item.querySelector('select[name="attr_bufftype"], select[name$="_bufftype"], select[name*="bufftype"]');
            const typeLabel = typeSelect ? typeSelect.closest("label") : null;
            const targetBeforeNode = (typeLabel && typeLabel.parentNode === nameLabel.parentNode)
                ? typeLabel
                : nameLabel.nextElementSibling;

            nameLabel.parentNode.insertBefore(newLabel, targetBeforeNode);

            // 回填属性值
            let rowId = item.getAttribute("data-reprowid");
            if (!rowId) {
                const namedInput = item.querySelector('input[name*="_name"], input[name*="_row_id"]');
                if (namedInput) {
                    const match = (namedInput.getAttribute("name") || "").match(/repeating_buff2?_([^_]+)_/);
                    if (match) rowId = match[1];
                }
            }
            if (character && rowId) {
                const attrFullName = `repeating_buff2_${rowId}_init_rounds`;
                const initAttr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
                if (initAttr && initAttr.get("current") !== undefined && initAttr.get("current") !== null) {
                    input.value = initAttr.get("current");
                }
            }
        });
    }

    /**
     * 从对话框元素中定位 Character Backbone Model
     */
    static findCharacterFromDialog(dialogEl) {
        if (!dialogEl || !window.Campaign?.characters) return null;

        let charId = dialogEl.getAttribute("data-characterid") || 
                     dialogEl.querySelector("[data-characterid]")?.getAttribute("data-characterid");

        if (!charId && window.$) {
            try {
                const charObj = window.$(dialogEl).data("character");
                if (charObj && charObj.id) return charObj;
            } catch (e) {}
        }

        if (!charId) {
            const idAttr = dialogEl.id || "";
            const match = idAttr.match(/character-([a-zA-Z0-9_-]+)/);
            if (match) charId = match[1];
        }

        return charId ? window.Campaign.characters.get(charId) : null;
    }
}

    // ==========================================
    // 12. BuffPanelStyles (面板静态 CSS 样式)
    // ==========================================
/**
 * BuffPanelStyles.js
 * 贴近 Roll20 原生浅色白底灰框质感的专属样式表
 * 包含：原生尺寸拖拽缩放、左右双栏标签、视口工具条、Debuff Popover 自适应流式标签云、Buff 自适应 Grid 多列排版、影子链接徽章与右键菜单
 */
class BuffPanelStyles {
    static STYLESHEET_ID = "r20-floating-panel-styles";

    static inject() {
        const existing = document.getElementById(this.STYLESHEET_ID);
        if (existing) existing.remove();
        const style = document.createElement("style");
        style.id = this.STYLESHEET_ID;
        style.textContent = this.getCss();
        document.head.appendChild(style);
    }

    static getCss() {
        return `
            /* ==========================================================================
               主悬浮窗与派生独立工作台容器（Roll20 原生浅色卡片外观，支持右下角自由缩放）
               ========================================================================== */
            #r20-buff-panel, .r20-detached-window {
                position: fixed !important;
                width: 360px;
                height: 380px;
                min-width: 280px;
                min-height: 200px;
                max-width: 90vw;
                max-height: 85vh;
                resize: both;
                overflow: hidden;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
                color: #333333;
                user-select: none;
                box-sizing: border-box;
                display: flex !important;
                flex-direction: column;
                background: #ffffff !important;
                border: 1px solid #c7c7c7 !important;
                border-radius: 4px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            }

            /* 标题栏（拖拽句柄，Roll20 浅灰底） */
            .r20-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 8px;
                background: #f2f2f2;
                border-bottom: 1px solid #dcdcdc;
                cursor: grab;
                box-sizing: border-box;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
                flex-shrink: 0;
            }
            .r20-panel-header:active {
                cursor: grabbing;
            }

            .r20-panel-title {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: #333333;
            }

            .r20-panel-controls {
                display: flex;
                align-items: center;
                gap: 3px;
            }

            /* Roll20 原生小按钮基底 */
            .r20-btn-icon, .r20-btn {
                background: #ffffff !important;
                border: 1px solid #d0d0d0 !important;
                color: #444444 !important;
                cursor: pointer;
                padding: 2px 6px !important;
                border-radius: 3px !important;
                font-size: 11px !important;
                line-height: 1.2 !important;
                font-family: inherit !important;
                transition: background 0.1s, border-color 0.1s, color 0.1s;
                box-sizing: border-box !important;
            }
            .r20-btn-icon:hover, .r20-btn:hover {
                background: #f5f5f5 !important;
                border-color: #b5b5b5 !important;
                color: #111111 !important;
            }
            .r20-btn-icon.pinned {
                color: #b45309 !important;
                background: #fef3c7 !important;
                border-color: #fcd34d !important;
            }

            /* 抽屉式内容折叠容器 */
            /* ==========================================================================
               方向性展开：向上展开 = 子节点顺序颠倒（column-reverse，抽屉在上、标题栏
               在下）+ 面板底边锚定（setCollapse 内联 top:auto/bottom:X），标题栏屏幕
               位置不动。面板是唯一尺寸载体，方向类只影响节点顺序与手柄位置。
               ========================================================================== */
            #r20-buff-panel {
                resize: none;
            }

            #r20-buff-panel.direction-up {
                flex-direction: column-reverse;
            }

            .r20-panel-content-drawer {
                background: #ffffff;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
            }

            /* 统一缩放手柄：贴面板外侧角（向下=右下，向上=右上） */
            .r20-resize-handle {
                position: absolute;
                right: 0;
                bottom: 0;
                width: 16px;
                height: 16px;
                z-index: 6;
                cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 0 55%, #b0b0b0 55% 65%, transparent 65% 75%, #b0b0b0 75% 85%, transparent 85%);
            }
            #r20-buff-panel.direction-up .r20-resize-handle {
                top: 0;
                bottom: auto;
                cursor: nesw-resize;
            }
            #r20-buff-panel.is-collapsed .r20-resize-handle {
                display: none;
            }
            .r20-resize-handle:hover {
                background: linear-gradient(135deg, transparent 0 55%, #555555 55% 65%, transparent 65% 75%, #555555 75% 85%, transparent 85%);
            }

            /* ==========================================================================
               顶部选项卡栏（Roll20 风格浅灰标签槽）
               ========================================================================== */
            .r20-tab-strip {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                background: #ebebeb !important;
                padding: 4px 6px 0 6px !important;
                border-bottom: 1px solid #dcdcdc !important;
                overflow-x: auto !important;
                scrollbar-width: none !important;
                gap: 6px !important;
                flex-shrink: 0 !important;
                box-sizing: border-box !important;
                width: 100% !important;
            }
            .r20-tab-strip::-webkit-scrollbar {
                display: none !important;
            }

            /* 靠左动态选区标签容器 */
            .r20-tabs-dynamic {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 3px !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: thin !important;
                scrollbar-color: #cccccc transparent !important;
                padding-bottom: 2px !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar {
                height: 3px !important;
                display: block !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-thumb {
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-tabs-dynamic::-webkit-scrollbar-thumb:hover {
                background: #aaaaaa !important;
            }

            /* 靠右固定常驻角色标签容器 */
            .r20-tabs-pinned {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 3px !important;
                flex: 0 0 auto !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: 50% !important;
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: thin !important;
                scrollbar-color: #cccccc transparent !important;
                padding: 0 0 2px 4px !important;
                margin: 0 !important;
                border-left: 1px solid #d5d5d5 !important;
                box-sizing: border-box !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar {
                height: 3px !important;
                display: block !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-track {
                background: transparent !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-thumb {
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-tabs-pinned::-webkit-scrollbar-thumb:hover {
                background: #aaaaaa !important;
            }
            .r20-tabs-pinned:empty {
                min-width: 24px !important;
                height: 36px !important;
                border: 1px dashed rgba(0, 0, 0, 0.2) !important;
                border-radius: 3px !important;
                margin-left: 3px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                opacity: 0.6 !important;
                transition: all 0.15s ease !important;
            }
            .r20-tabs-pinned:empty::after {
                content: "📌" !important;
                font-size: 11px !important;
                opacity: 0.5 !important;
                pointer-events: none !important;
            }
            .r20-tabs-pinned:empty:hover,
            .r20-tabs-pinned.r20-pin-zone-hover {
                opacity: 1 !important;
                background: #e0f2fe !important;
                border-color: #0284c7 !important;
            }

            /* 单个选项卡（方形棋子头像设计，微圆角 3px） */
            .r20-tab {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 36px !important;
                height: 36px !important;
                min-width: 36px !important;
                min-height: 36px !important;
                padding: 2px !important;
                background: #f9f9f9 !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                border: 1px solid #d0d0d0 !important;
                transition: background 0.1s, border-color 0.1s !important;
                position: relative !important;
                box-sizing: border-box !important;
                flex-shrink: 0 !important;
            }
            .r20-tab:hover {
                background: #ffffff !important;
                border-color: #b0b0b0 !important;
            }
            .r20-tab.active {
                background: #ffffff !important;
                border-color: #2563eb !important;
                border-width: 2px !important;
                padding: 1px !important;
                z-index: 2 !important;
            }
            .r20-tab.selected-highlight {
                border-color: #2563eb !important;
            }
            .r20-tab.active.selected-highlight {
                border-color: #1d4ed8 !important;
            }
            .r20-tab-avatar-box {
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: hidden !important;
                border-radius: 2px !important;
                pointer-events: none !important;
            }
            .r20-tab-avatar {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                display: block !important;
                border-radius: 2px !important;
            }
            .r20-tab-avatar-fallback {
                width: 100% !important;
                height: 100% !important;
                /* 显隐由内联 display 样式全权控制（getAvatarHtml 初始渲染与 img onerror 回调）：
                   此处绝不能声明 display，否则 !important 会压过内联 display:none，
                   导致有头像图时首字回退块与图片同时显示 */
                align-items: center !important;
                justify-content: center !important;
                background: #e2e8f0 !important;
                color: #475569 !important;
                font-size: 14px !important;
                font-weight: 700 !important;
                border-radius: 2px !important;
            }
            .r20-tab-close,
            .r20-tab-pin {
                position: absolute !important;
                top: -4px !important;
                right: -4px !important;
                width: 14px !important;
                height: 14px !important;
                border-radius: 50% !important;
                background: #94a3b8 !important;
                color: #ffffff !important;
                font-size: 9px !important;
                line-height: 14px !important;
                text-align: center !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
                z-index: 5 !important;
                cursor: pointer !important;
                user-select: none !important;
            }
            .r20-tab:hover .r20-tab-close,
            .r20-tab:hover .r20-tab-pin {
                display: flex !important;
            }
            .r20-tab-close:hover {
                background: #ef4444 !important;
            }
            .r20-tab-pin:hover {
                background: #2563eb !important;
            }
            .r20-tab.r20-tab-drag-hover {
                background: #eff6ff !important;
                outline: 2px dashed #3b82f6;
            }

            /* ==========================================================================
               视口区与顶部操作条
               ========================================================================== */
            .r20-tab-viewport {
                flex: 1 1 auto;
                min-height: 0;
                padding: 6px 8px;
                overflow-y: auto;
                box-sizing: border-box;
                background: #ffffff;
            }

            .r20-viewport-toolbar {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 3px 0 5px 0 !important;
                margin-bottom: 5px !important;
                border-bottom: 1px solid #e5e5e5 !important;
                font-size: 11px !important;
                color: #666666 !important;
                flex-shrink: 0 !important;
                box-sizing: border-box !important;
            }
            .r20-toolbar-target-name {
                display: flex !important;
                align-items: center !important;
                font-weight: 600 !important;
                color: #333333 !important;
                max-width: 160px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                line-height: 1.2 !important;
                font-size: 12px !important;
            }

            /* Debuff 下拉触发按钮（Roll20 浅色粉红风格） */
            .r20-btn-debuff-trigger {
                background: #fff1f2 !important;
                border: 1px solid #fecdd3 !important;
                color: #e11d48 !important;
                font-size: 11px !important;
                height: 22px !important;
                line-height: 20px !important;
                padding: 0 6px !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                box-sizing: border-box !important;
                transition: background 0.1s, border-color 0.1s !important;
            }
            .r20-btn-debuff-trigger:hover,
            .r20-btn-debuff-trigger.active {
                background: #ffe4e6 !important;
                border-color: #fb7185 !important;
                color: #be123c !important;
            }

            /* ==========================================================================
               Debuff Popover Grid（流式标签云网格，Roll20 浅色白底风格）
               ========================================================================== */
            .r20-popover-grid-container {
                position: fixed !important;
                z-index: 10060 !important;
                width: 310px !important;
                max-width: 90vw !important;
                max-height: 280px !important;
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 4px !important;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
                box-sizing: border-box !important;
            }
            .r20-popover-grid-header {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 5px 8px !important;
                background: #f8fafc !important;
                border-bottom: 1px solid #e2e8f0 !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: #be123c !important;
                flex-shrink: 0 !important;
            }
            .r20-popover-grid-header .btn-close-popover {
                background: transparent !important;
                border: none !important;
                color: #888888 !important;
                cursor: pointer !important;
                font-size: 12px !important;
                padding: 0 4px !important;
            }
            .r20-popover-grid-header .btn-close-popover:hover {
                color: #111111 !important;
            }
            .r20-popover-grid-body {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 3px 4px !important;
                padding: 6px !important;
                overflow-y: auto !important;
                max-height: 220px !important;
                box-sizing: border-box !important;
                scrollbar-width: thin !important;
                scrollbar-color: #cccccc transparent !important;
            }
            .r20-popover-grid-body::-webkit-scrollbar {
                width: 4px !important;
            }
            .r20-popover-grid-body::-webkit-scrollbar-thumb {
                background: #cccccc !important;
                border-radius: 2px !important;
            }
            .r20-popover-grid-item {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: auto !important;
                flex: 0 0 auto !important;
                background: #fff1f2 !important;
                border: 1px solid #fecdd3 !important;
                color: #be123c !important;
                font-size: 11px !important;
                line-height: 16px !important;
                padding: 2px 6px !important;
                border-radius: 2px !important;
                cursor: pointer !important;
                user-select: none !important;
                white-space: nowrap !important;
                transition: background 0.1s, border-color 0.1s, color 0.1s !important;
                box-sizing: border-box !important;
            }
            .r20-popover-grid-item:hover {
                background: #f43f5e !important;
                border-color: #e11d48 !important;
                color: #ffffff !important;
            }

            /* ==========================================================================
               Buff / Debuff 自适应响应式网格 (Auto-Fit CSS Grid)
               狭窄单列，拉宽自适应双列或三列
               ========================================================================== */
            .r20-buff-list,
            .r20-debuff-list {
                display: grid !important;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
                gap: 3px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            /* Buff 与负面状态之间的极简分割线（无大标题） */
            .r20-buff-divider {
                height: 1px !important;
                background: #e5e5e5 !important;
                margin: 5px 0 !important;
                flex-shrink: 0 !important;
                width: 100% !important;
            }

            /* 单个 Buff/Debuff 条目卡片（紧凑高 26px，微圆角 3px，Roll20 原生浅色风格） */
            .r20-buff-item {
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 3px 6px !important;
                border-radius: 3px !important;
                min-height: 26px !important;
                box-sizing: border-box !important;
                cursor: pointer !important;
                user-select: none !important;
                position: relative !important;
                transition: background 0.1s, border-color 0.1s !important;
                border: 1px solid transparent !important;
            }

            /* 未激活状态：柔和浅灰底 */
            .r20-buff-item.is-inactive {
                background: #f8fafc !important;
                border: 1px solid #e2e8f0 !important;
                border-left: 3px solid #94a3b8 !important;
                opacity: 0.85 !important;
            }
            .r20-buff-item.is-inactive:hover {
                background: #f1f5f9 !important;
                opacity: 1 !important;
            }
            .r20-buff-item.is-inactive .r20-buff-name {
                color: #475569 !important;
            }
            .r20-buff-item.is-inactive .r20-buff-rounds {
                color: #64748b !important;
            }

            /* 激活状态：正面 Buff（清爽淡蓝底 + 鲜明蓝字） */
            .r20-buff-item.is-active {
                background: #eff6ff !important;
                border: 1px solid #bfdbfe !important;
                border-left: 3px solid #2563eb !important;
            }
            .r20-buff-item.is-active:hover {
                background: #dbeafe !important;
            }
            .r20-buff-item.is-active .r20-buff-name {
                color: #1e3a8a !important;
                font-weight: 500 !important;
            }
            .r20-buff-item.is-active .r20-buff-rounds {
                color: #1d4ed8 !important;
            }

            /* 激活状态：负面 Debuff（柔和淡粉底 + 警示红字） */
            .r20-buff-item.is-debuff.is-active {
                background: #fef2f2 !important;
                border: 1px solid #fecaca !important;
                border-left: 3px solid #ef4444 !important;
            }
            .r20-buff-item.is-debuff.is-active:hover {
                background: #fee2e2 !important;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-name {
                color: #991b1b !important;
                font-weight: 500 !important;
            }
            .r20-buff-item.is-debuff.is-active .r20-buff-rounds {
                color: #b91c1c !important;
            }

            /* 选中状态：干净利落的聚焦蓝框 */
            .r20-buff-item.is-selected {
                outline: 1px solid #2563eb !important;
                outline-offset: -1px !important;
                z-index: 2 !important;
            }

            /* 拖拽排序指示线 */
            .r20-buff-item.r20-drag-insert-before {
                border-top: 2px solid #2563eb !important;
            }
            .r20-buff-item.r20-drag-insert-after {
                border-bottom: 2px solid #2563eb !important;
            }

            .r20-buff-left {
                display: flex !important;
                align-items: center !important;
                gap: 4px !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
            }
            .r20-buff-name {
                font-size: 11px !important;
                font-weight: 500 !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                flex: 1 1 auto !important;
                min-width: 0 !important;
            }

            /* 轮数徽章 */
            .r20-buff-rounds {
                display: inline-flex !important;
                align-items: center !important;
                gap: 1px !important;
                font-size: 10px !important;
                color: #2563eb !important;
                white-space: nowrap !important;
                padding: 1px 4px !important;
                background: rgba(37, 99, 235, 0.08) !important;
                border-radius: 2px !important;
                flex-shrink: 0 !important;
                user-select: none !important;
            }
            .r20-buff-round-num {
                cursor: pointer !important;
                padding: 0 1px !important;
                border-radius: 2px !important;
            }
            .r20-buff-round-num:hover {
                background: rgba(37, 99, 235, 0.15) !important;
                color: #1d4ed8 !important;
                text-decoration: underline !important;
            }
            .r20-buff-round-sep {
                opacity: 0.5 !important;
                padding: 0 1px !important;
            }

            /* 就地轮数输入框 */
            .r20-input-round-inline {
                width: 36px !important;
                min-width: 28px !important;
                max-width: 60px !important;
                height: 16px !important;
                line-height: 16px !important;
                padding: 0 2px !important;
                font-size: 10px !important;
                font-family: inherit !important;
                text-align: center !important;
                border: 1px solid #2563eb !important;
                background: #ffffff !important;
                color: #1e3a8a !important;
                border-radius: 2px !important;
                outline: none !important;
                box-sizing: border-box !important;
            }
            .r20-buff-toggle {
                margin: 0 3px 0 0 !important;
                cursor: pointer !important;
                width: 13px !important;
                height: 13px !important;
                flex-shrink: 0 !important;
                accent-color: #2563eb !important;
            }

            /* 框选矩形 (Marquee Selection) */
            .r20-selection-marquee {
                position: fixed !important;
                border: 1px solid #2563eb !important;
                background: rgba(37, 99, 235, 0.12) !important;
                pointer-events: none !important;
                z-index: 999999 !important;
                border-radius: 2px !important;
            }

            /* 影子链接徽章 (🔗 + 头像) */
            .r20-buff-link-badge {
                display: inline-flex !important;
                align-items: center !important;
                gap: 2px !important;
                font-size: 10px !important;
                color: #2563eb !important;
                cursor: pointer !important;
                background: rgba(37, 99, 235, 0.08) !important;
                padding: 1px 3px !important;
                border-radius: 2px !important;
                flex-shrink: 0 !important;
            }
            .r20-buff-link-badge:hover {
                background: rgba(37, 99, 235, 0.2) !important;
                color: #1d4ed8 !important;
            }
            .r20-buff-host-avatar {
                width: 13px !important;
                height: 13px !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                vertical-align: middle !important;
            }

            /* ==========================================================================
               右键菜单与对话框模态层（Roll20 浅色原生弹窗风格）
               ========================================================================== */
            .r20-context-menu {
                position: fixed !important;
                z-index: 10050 !important;
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18) !important;
                border-radius: 4px !important;
                padding: 4px 0 !important;
                min-width: 140px !important;
                font-size: 11px !important;
                color: #333333 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }
            .r20-context-menu-item {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 5px 12px !important;
                cursor: pointer !important;
                transition: background 0.1s !important;
            }
            .r20-context-menu-item:hover {
                background: #f1f5f9 !important;
                color: #2563eb !important;
            }
            .r20-context-menu-divider {
                height: 1px !important;
                background: #e5e5e5 !important;
                margin: 3px 0 !important;
            }

            /* 空状态提示 */
            .r20-empty-view {
                text-align: center !important;
                padding: 24px 12px !important;
                color: #888888 !important;
                font-size: 11px !important;
                line-height: 1.5 !important;
            }

            /* Toast 提示 */
            .r20-suite-toast {
                position: fixed !important;
                bottom: 24px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: #333333 !important;
                color: #ffffff !important;
                padding: 5px 12px !important;
                border-radius: 4px !important;
                font-size: 11px !important;
                box-shadow: 0 4px 14px rgba(0,0,0,0.2) !important;
                z-index: 10200 !important;
                border: 1px solid #444444 !important;
                border-left: 3px solid #2563eb !important;
                pointer-events: none !important;
                transition: opacity 0.2s ease !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }

            /* 对话框模态层（Roll20 原生弹窗规范） */
            .r20-dialog-mask {
                position: fixed !important;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.4) !important;
                z-index: 10100 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .r20-dialog-box {
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 4px !important;
                width: 440px !important;
                max-width: 90vw !important;
                max-height: 85vh !important;
                display: flex !important;
                flex-direction: column !important;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
                color: #333333 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
            }
            .r20-dialog-header {
                padding: 8px 12px !important;
                font-size: 12px !important;
                font-weight: 600 !important;
                border-bottom: 1px solid #e5e5e5 !important;
                background: #f8fafc !important;
                color: #333333 !important;
            }
            .r20-dialog-body {
                padding: 10px 12px !important;
                overflow-y: auto !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 8px !important;
            }
            .r20-dialog-footer {
                padding: 8px 12px !important;
                border-top: 1px solid #e5e5e5 !important;
                display: flex !important;
                justify-content: flex-end !important;
                gap: 6px !important;
                background: #f8fafc !important;
            }
            .r20-input-text {
                background: #ffffff !important;
                border: 1px solid #cccccc !important;
                border-radius: 3px !important;
                color: #333333 !important;
                padding: 4px 6px !important;
                font-size: 11px !important;
                outline: none !important;
            }
            .r20-input-text:focus {
                border-color: #2563eb !important;
            }
            .r20-textarea-json {
                background: #f8fafc !important;
                border: 1px solid #cccccc !important;
                border-radius: 3px !important;
                color: #166534 !important;
                font-family: monospace !important;
                padding: 4px 6px !important;
                font-size: 11px !important;
                height: 120px !important;
                outline: none !important;
                resize: vertical !important;
            }
            .r20-textarea-json:focus {
                border-color: #2563eb !important;
            }
            .r20-btn-apply {
                background: #2563eb !important;
                color: #ffffff !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                padding: 4px 10px !important;
                border-radius: 3px !important;
                border: 1px solid #1d4ed8 !important;
                cursor: pointer !important;
            }
            .r20-btn-apply:hover {
                background: #1d4ed8 !important;
            }

            /* ==========================================================================
               Roll20 侧边栏设置抽屉原生折叠箭头规范 (Font Awesome 5 Free)
               ========================================================================== */
            .r20-suite-settings-panel .accordion-toggle {
                display: block !important;
                text-decoration: none !important;
                color: #333333 !important;
            }
            .r20-suite-settings-panel .panel-heading:hover .accordion-toggle {
                text-decoration: underline !important;
            }
            .r20-suite-settings-panel .accordion-toggle::after {
                font-family: "Font Awesome 5 Free" !important;
                font-weight: 700 !important;
                content: "\\f077" !important;
                float: right !important;
                color: gray !important;
                font-size: 16px !important;
                line-height: inherit !important;
            }
            .r20-suite-settings-panel .accordion-toggle.collapsed::after {
                content: "\\f078" !important;
            }
        `;
    }
}

    // ==========================================
    // 13. BuffPanelTemplates (面板静态 HTML 模板)
    // ==========================================
/**
 * BuffPanelTemplates.js
 * 现代化浏览器式单栏多标签工作台 DOM 模板
 */
class BuffPanelTemplates {
    /**
     * 生成主调度工作台基础 HTML 骨架
     */
    static getPanelHtml() {
        return `
            <div class="r20-panel-header" title="按住拖拽移动工作台">
                <div class="r20-panel-title">
                    <span>Buff 调度器</span>
                </div>
                <div class="r20-panel-controls">
                    <button class="r20-btn-icon btn-toggle-pin" title="固定面板（鼠标移开不自动收起）">📌</button>
                    <button class="r20-btn-icon btn-recalc-all" title="手动重新计算所有选中单位的加值 (recalc1)">🔄</button>
                    
                </div>
            </div>
            <div class="r20-panel-content-drawer">
                <div class="r20-tab-strip">
                    <div class="r20-tabs-dynamic" title="当前画布选中单位（靠左展示，可向右拖拽固定）"></div>
                    <div class="r20-tabs-pinned" title="固定常驻角色（靠右展示，可拖拽或点击棋子钉选）"></div>
                </div>
                <div class="r20-tab-viewport">
                    <div class="r20-empty-view">正在连接单位数据...</div>
                </div>
            </div>
        `.trim();
    }
}

    // ==========================================
    // 14. BuffDetachedWindow (独立二级工作台窗口)
    // ==========================================
/**
 * BuffDetachedWindow.js
 * 独立的派生 Buff 调度器窗口 (Detached Secondary Window)
 * - 支持标签从主窗口拖离撕裂生成
 * - 拥有独立的选项卡栏与视口
 * - 支持 Tab 拖回主窗口合并或在多个窗口间转移
 * - 支持 Buff 跨窗口互相拖拽施加
 * - 允许自由调整尺寸与位置
 */
class BuffDetachedWindow {
    static instances = new Map();

    /**
     * 获取所有独立窗口中当前持有的全部角色 ID（用于主面板排重：同一人物仅出现一次）
     */
    static getAllDetachedTargetIds() {
        const ids = new Set();
        for (const win of this.instances.values()) {
            for (const id of win.charIds) {
                ids.add(id);
            }
        }
        return ids;
    }

    /**
     * 通知主面板调和刷新（恢复或移除 Tab）
     */
    notifyMainPanelRefresh() {
        try {
            if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel?.renderDispatcher) {
                window.Roll20Suite.BuffFloatingPanel.renderDispatcher();
            }
        } catch (e) {}
    }

    /**
     * 在指定坐标创建一个新的独立窗口
     * @param {number} x 
     * @param {number} y 
     * @param {string} initialCharId 
     */
    static create(x, y, initialCharId) {
        if (!initialCharId) return null;
        const winId = "detached_" + Math.random().toString(36).substr(2, 8);
        const win = new BuffDetachedWindow(winId, x, y, [initialCharId]);
        this.instances.set(winId, win);
        return win;
    }

    constructor(id, x, y, charIds = []) {
        this.id = id;
        this.charIds = [...charIds];
        this.activeCharId = charIds[0] || null;
        this.selectedBuffRowIds = new Set();
        this.lastClickedRowId = null;
        this.domEl = null;
        this._renderEpoch = 0;

        this.initDOM(x, y);
        this.render();

        this._boundSettingHandler = (e) => {
            if (e.detail?.key === "buff_show_checkbox") {
                this.renderViewport();
            } else if (e.detail?.key === "party_buffs_visible") {
                this.renderTabs();
                this.renderViewport();
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingHandler);
    }

    initDOM(x, y) {
        const el = document.createElement("div");
        el.id = `r20-buff-win-${this.id}`;
        el.className = "r20-buff-panel r20-detached-window";
        el.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, x))}px`;
        el.style.top = `${Math.max(10, Math.min(window.innerHeight - 250, y))}px`;
        el.style.width = "340px";
        el.style.height = "380px";
        el.style.zIndex = "10000";

        el.innerHTML = `
            <div class="r20-panel-header">
                <div class="r20-header-left">
                    <span class="r20-panel-title">独立工作台</span>
                </div>
                <div class="r20-header-controls">
                    <button class="r20-btn-icon btn-close-win" title="关闭窗口">✕</button>
                </div>
            </div>
            <div class="r20-tab-strip">
                <div class="r20-tabs-dynamic r20-detached-tabs" style="flex:1; border-right:none;"></div>
            </div>
            <div class="r20-tab-viewport"></div>
        `;

        document.body.appendChild(el);
        this.domEl = el;

        // 窗口拖动（统一手势工具：指针捕获，几何钳制留在本模块）
        const header = el.querySelector(".r20-panel-header");
        header.style.touchAction = "none";
        let dragState = null;
        DragGestures.bind(header, {
            isIgnored: (e) => !!e.target.closest("button"),
            onStart: (e, start) => {
                dragState = { startLeft: el.offsetLeft, startTop: el.offsetTop };
            },
            onMove: (e, start) => {
                if (!dragState) return;
                el.style.left = `${Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, dragState.startLeft + (e.clientX - start.x)))}px`;
                el.style.top = `${Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, dragState.startTop + (e.clientY - start.y)))}px`;
            },
            onEnd: () => {
                dragState = null;
            }
        });

        // 关闭窗口
        el.querySelector(".btn-close-win").addEventListener("click", () => {
            this.destroy();
        });

        // 标签栏接收 Tab 拖入
        const tabStrip = el.querySelector(".r20-detached-tabs");
        tabStrip.addEventListener("dragover", (e) => {
            const ctx = BuffFloatingPanel._draggedContext;
            if (ctx?.type === "tab") {
                e.preventDefault();
            }
        });

        tabStrip.addEventListener("drop", (e) => {
            const ctx = BuffFloatingPanel._draggedContext;
            if (ctx?.type === "tab" && ctx.id) {
                e.preventDefault();
                ctx._hasSpawned = true; // 锁定防重
                if (ctx.tabType === "pinned") {
                    BuffFloatingPanel.removePinnedChar(ctx.id);
                } else if (ctx.tabType === "detached" && ctx.winId && ctx.winId !== this.id) {
                    const sourceWin = BuffDetachedWindow.instances.get(ctx.winId);
                    if (sourceWin) sourceWin.removeTab(ctx.id);
                }
                this.addTab(ctx.id);
            }
        });

        // 视口区域一次性接收拖拽放置 Buff
        const viewport = el.querySelector(".r20-tab-viewport");
        if (viewport) {
            viewport.addEventListener("dragover", (e) => {
                if (BuffFloatingPanel._draggedContext?.type === "buff") e.preventDefault();
            });
            viewport.addEventListener("drop", async (e) => {
                if (BuffFloatingPanel._draggedContext?.type === "buff") {
                    e.preventDefault();
                    const buff = BuffFloatingPanel._draggedContext.data;
                    const sourceHostId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                    const char = this.activeCharId ? window.Campaign?.characters?.get(this.activeCharId) : null;
                    const name = char ? (char.get("name") || "未命名") : "(未知角色)";
                    if (char) {
                        await BuffFloatingPanel.applyBuffToTarget(buff, { type: "char", id: char.id, name }, sourceHostId);
                        await this.renderViewport();
                    }
                }
            });

            BuffFloatingPanel.setupViewportMarqueeSelection(viewport, this);
        }
    }

    addTab(charId) {
        if (!this.charIds.includes(charId)) {
            this.charIds.push(charId);
            this.activeCharId = charId;
            this.render();
            this.notifyMainPanelRefresh();
        }
    }

    removeTab(charId) {
        this.charIds = this.charIds.filter(id => id !== charId);
        if (this.charIds.length === 0) {
            this.destroy();
            return;
        }
        if (this.activeCharId === charId) {
            this.activeCharId = this.charIds[0];
        }
        this.render();
        this.notifyMainPanelRefresh();
    }

    destroy() {
        if (this._boundSettingHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingHandler);
            this._boundSettingHandler = null;
        }
        if (this._renderViewportDebounceTimer) {
            clearTimeout(this._renderViewportDebounceTimer);
            this._renderViewportDebounceTimer = null;
        }
        this._renderViewportPendingResolvers = [];
        if (this.domEl) {
            this.domEl.remove();
            this.domEl = null;
        }
        BuffDetachedWindow.instances.delete(this.id);
        this.notifyMainPanelRefresh();
    }

    /**
     * 销毁并回收所有活动的独立窗口（热重载与完全卸载支持）
     */
    static destroyAll() {
        for (const [id, win] of Array.from(this.instances.entries())) {
            try {
                win.destroy();
            } catch (e) {
                console.error("[BuffDetachedWindow] 销毁独立窗口异常:", id, e);
            }
        }
        this.instances.clear();
    }

    render() {
        if (!this.domEl) return;
        this.renderTabs();
        this.renderViewport();
    }

    renderTabs() {
        const tabsContainer = this.domEl.querySelector(".r20-detached-tabs");
        if (!tabsContainer) return;
        tabsContainer.innerHTML = "";

        this.charIds.forEach((charId, idx) => {
            if (!Roll20Bridge.canViewCharacterBuffs(charId)) return;
            const char = window.Campaign?.characters?.get(charId);
            const name = char ? (char.get("name") || "未命名") : "(未知角色)";
            const isActive = this.activeCharId === charId;

            const avatarUrl = BuffFloatingPanel.getAvatarUrl(char, null);
            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}`;
            tab.draggable = true;
            tab.title = `${name} (独立窗口角色)`;
            tab.innerHTML = `
                ${BuffFloatingPanel.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-close" title="移出此窗口">✕</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-close")) {
                    e.stopPropagation();
                    this.removeTab(charId);
                    return;
                }
                this.activeCharId = charId;
                this.render();
            });

            // 拖出 Tab
            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                BuffFloatingPanel._draggedContext = {
                    type: "tab",
                    tabType: "detached",
                    winId: this.id,
                    id: charId,
                    name,
                    startX: e.clientX,
                    startY: e.clientY,
                    _hasSpawned: false
                };
                e.dataTransfer.setData("text/plain", name);
                tab.style.opacity = "0.5";
            });

            tab.addEventListener("dragend", (e) => {
                tab.style.opacity = "1";
                const ctx = BuffFloatingPanel._draggedContext;
                BuffFloatingPanel._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return;

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.removeTab(ctx.id);
                        BuffFloatingPanel.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            // 悬停自动切换与接收 Buff
            BuffFloatingPanel.bindTabBuffHover(tab, { type: "char", id: charId, name });

            tabsContainer.appendChild(tab);
        });
    }

    /**
     * 渲染独立视口区
     * 具备 35ms 微任务批处理防抖：多属性连击修改时仅执行一次完整 DOM 构建与读取
     */
    renderViewport(options = {}) {
        if (!this.domEl) return Promise.resolve();
        if (options.force) {
            return this._doRenderViewport();
        }
        return new Promise((resolve) => {
            if (!this._renderViewportPendingResolvers) this._renderViewportPendingResolvers = [];
            this._renderViewportPendingResolvers.push(resolve);
            if (this._renderViewportDebounceTimer) return;
            this._renderViewportDebounceTimer = setTimeout(async () => {
                this._renderViewportDebounceTimer = null;
                const resolvers = this._renderViewportPendingResolvers;
                this._renderViewportPendingResolvers = [];
                try {
                    await this._doRenderViewport();
                } catch (err) {
                    console.error("[BuffDetachedWindow] renderViewport 执行异常:", err);
                } finally {
                    for (const r of resolvers) {
                        try { r(); } catch (e) {}
                    }
                }
            }, 35);
        });
    }

    async _doRenderViewport() {
        if (!this.domEl) return;
        const viewport = this.domEl.querySelector(".r20-tab-viewport");
        if (!viewport) return;

        const currentEpoch = ++this._renderEpoch;

        if (!this.activeCharId) {
            viewport.innerHTML = `<div class="r20-empty-view">请选择或拖入角色标签</div>`;
            return;
        }

        if (!Roll20Bridge.isGM() && !Roll20Bridge.canViewCharacterBuffs(this.activeCharId)) {
            viewport.innerHTML = `<div class="r20-empty-view">🔒 无权查看该角色的 Buff 信息</div>`;
            return;
        }

        const char = window.Campaign?.characters?.get(this.activeCharId);
        const name = char ? (char.get("name") || "未命名") : "(未知角色)";

        if (!char) {
            viewport.innerHTML = `<div class="r20-empty-view">角色未找到或已被移除</div>`;
            return;
        }

        const buffs = await Pf1eBuffManager.getAllBuffs(char);
        const debuffs = await Pf1eBuffUI.getAllDebuffs(char);

        // 事务版本守卫：若已有更新的渲染进场，本次作废
        if (currentEpoch !== this._renderEpoch) return;

        const fragment = document.createDocumentFragment();

        // 工具条
        const toolbar = document.createElement("div");
        toolbar.className = "r20-viewport-toolbar";
        toolbar.innerHTML = `
            <div class="r20-toolbar-target-name">
                <span>${Roll20Bridge.escapeHtml(name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:3px;">
                <button class="r20-btn-debuff-trigger" title="选择并施加负面状态 (Debuff)">Debuff ▾</button>
                <button class="r20-btn-icon btn-deactivate-all" title="一键取消激活该单位身上的所有 Buff" style="color:#f59e0b;">🚫 全关</button>
                <button class="r20-btn-icon btn-add-buff-to-active" title="为此角色添加新 Buff">➕ Buff</button>
            </div>
        `;

        const debuffTriggerBtn = toolbar.querySelector(".r20-btn-debuff-trigger");
        debuffTriggerBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            BuffFloatingPanel.showDebuffPopover(debuffTriggerBtn, { type: "char", id: char.id, char }, () => this.renderViewport());
        });

        toolbar.querySelector(".btn-deactivate-all")?.addEventListener("click", async () => {
            const activeBuffs = await Pf1eBuffManager.getActiveBuffs(char);
            for (const b of activeBuffs) {
                await Pf1eBuffManager.toggleBuff(char, b.rowId, false);
            }
            BuffFloatingPanel.showNotice(`已取消激活 [${name}] 的全部 Buff`);
            if (typeof Pf1eBuffUI !== "undefined") {
                Pf1eBuffUI.requestTokenRefresh(char.id);
            }
            await this.renderViewport();
        });

        toolbar.querySelector(".btn-add-buff-to-active")?.addEventListener("click", () => {
            BuffFloatingPanel.showBuffEditorDialog(null, char);
        });

        fragment.appendChild(toolbar);

        // 渲染专属负面状态 (Debuff / Condition) 区块
        if (debuffs.length > 0) {
            const listEl = document.createElement("div");
            listEl.className = "r20-debuff-list";
            debuffs.forEach(d => {
                const pill = document.createElement("span");
                pill.className = "r20-buff-pill-debuff";
                const roundsText = (d.rounds !== null && d.rounds !== undefined) ? ` ${d.rounds}轮` : "";
                pill.textContent = `${d.name}${roundsText} ✕`;
                pill.title = `${d.name} (点击修改轮数或关停解除)`;
                pill.style.cursor = "pointer";
                pill.addEventListener("click", () => {
                    Pf1eBuffUI.showDebuffEditModal(char, d, null);
                });
                listEl.appendChild(pill);
            });
            fragment.appendChild(listEl);

            // 若同时存在正面 Buff，简单以极细分割线隔开
            if (buffs.length > 0) {
                const divider = document.createElement("div");
                divider.className = "r20-buff-divider";
                fragment.appendChild(divider);
            }
        }

        if (buffs.length === 0) {
            if (debuffs.length === 0) {
                const emptyEl = document.createElement("div");
                emptyEl.className = "r20-empty-view";
                emptyEl.innerHTML = `该单位当前无任何 Buff<br>从其他标签拖拽 Buff 放置即可施加`;
                fragment.appendChild(emptyEl);
            }
        } else {
            const showCheckbox = SuiteConfigStore.getSetting("buff_show_checkbox", false);
            const buffListEl = document.createElement("div");
            buffListEl.className = "r20-buff-list";
            buffs.forEach(b => {
                const item = document.createElement("div");
                const isEnabled = !!b.enabled;
                const isSelected = this.selectedBuffRowIds.has(b.rowId);
                item.className = `r20-buff-item ${isEnabled ? "is-active" : "is-inactive"} ${isSelected ? "is-selected" : ""}`;
                item.dataset.rowid = b.rowId;
                item.draggable = true;

                const toggleCheckboxHtml = showCheckbox
                    ? `<input type="checkbox" class="r20-buff-toggle" ${isEnabled ? "checked" : ""} title="快速启停 Buff">`
                    : "";

                const curVal = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? b.rounds : null;
                const initVal = (b.initRounds !== null && b.initRounds !== undefined && b.initRounds !== "") ? b.initRounds : null;
                const curDisplay = curVal !== null ? `${curVal}` : "永久";
                const initDisplay = initVal !== null ? `${initVal}` : "-";
                const roundsHtml = `
                    <span class="r20-buff-rounds">
                        <span class="r20-buff-round-num r20-buff-round-cur" title="点击就地修改当前轮数">${curDisplay}</span>
                        <span class="r20-buff-round-sep">/</span>
                        <span class="r20-buff-round-num r20-buff-round-init" title="点击就地修改初始轮数或公式">${initDisplay}</span>
                    </span>
                `;

                let linkBadgeHtml = "";
                if (b.linkHostId) {
                    const hostChar = window.Campaign?.characters?.get(b.linkHostId);
                    linkBadgeHtml = BuffFloatingPanel.getLinkBadgeHtml(hostChar);
                }

                item.innerHTML = `
                    <div class="r20-buff-left">
                        ${toggleCheckboxHtml}
                        <span class="r20-buff-name" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                        ${linkBadgeHtml}
                        ${roundsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="r20-btn-icon btn-edit-buff-row" title="编辑细目">✏️</button>
                    </div>
                `;

                // 快速启停复选框
                item.querySelector(".r20-buff-toggle")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.toggleBuff(char, b.rowId, e.target.checked);
                        BuffFloatingPanel.notifyBuffMutation();
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    }
                });

                // 点击当前轮数：在原本数字所在位置就地渲染输入框快速编辑
                const curEl = item.querySelector(".r20-buff-round-cur");
                curEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char) return;

                    Roll20Bridge.attachInlineRoundEditor(curEl, {
                        initialValue: curVal !== null ? curVal : "",
                        placeholder: "永久",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            let newRounds = "";
                            if (raw !== "" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, char);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }
                            await Pf1eBuffManager.setBuffRounds(char, b.rowId, newRounds);
                            BuffFloatingPanel.notifyBuffMutation();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击初始轮数：在原本数字所在位置就地渲染输入框快速编辑
                const initEl = item.querySelector(".r20-buff-round-init");
                initEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char) return;

                    Roll20Bridge.attachInlineRoundEditor(initEl, {
                        initialValue: initVal !== null ? initVal : "",
                        placeholder: "-",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            await Pf1eBuffManager.setBuffInitRounds(char, b.rowId, raw);
                            BuffFloatingPanel.notifyBuffMutation();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 解除链接（直接断开，无需二次确认）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    await Pf1eBuffManager.unlinkBuff(char, b.rowId);
                    BuffFloatingPanel.showNotice(`已断开 [${b.name}] 链接`);
                    await this.renderViewport();
                });

                // 编辑
                item.querySelector(".btn-edit-buff-row")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    BuffFloatingPanel.showBuffEditorDialog(b, char);
                });

                // 单击条目多选高亮 (支持 Shift 区间连选与 Ctrl/Cmd 追加)
                item.addEventListener("click", (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;

                    if (e.shiftKey && this.lastClickedRowId) {
                        const allItemEls = Array.from(viewport.querySelectorAll(".r20-buff-item"));
                        const lastIdx = allItemEls.findIndex(el => el.dataset.rowid === this.lastClickedRowId);
                        const currIdx = allItemEls.findIndex(el => el.dataset.rowid === b.rowId);
                        if (lastIdx !== -1 && currIdx !== -1) {
                            const start = Math.min(lastIdx, currIdx);
                            const end = Math.max(lastIdx, currIdx);
                            if (!e.ctrlKey && !e.metaKey) {
                                this.selectedBuffRowIds.clear();
                            }
                            for (let i = start; i <= end; i++) {
                                this.selectedBuffRowIds.add(allItemEls[i].dataset.rowid);
                            }
                        }
                    } else {
                        this.lastClickedRowId = b.rowId;
                        if (e.ctrlKey || e.metaKey) {
                            if (this.selectedBuffRowIds.has(b.rowId)) {
                                this.selectedBuffRowIds.delete(b.rowId);
                            } else {
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        } else {
                            if (this.selectedBuffRowIds.has(b.rowId) && this.selectedBuffRowIds.size === 1) {
                                this.selectedBuffRowIds.clear();
                            } else {
                                this.selectedBuffRowIds.clear();
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        }
                    }
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        const rId = el.dataset.rowid;
                        if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                        else el.classList.remove("is-selected");
                    });
                });

                // 双击条目快速切换激活/关停
                item.addEventListener("dblclick", async (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;
                    await Pf1eBuffManager.toggleBuff(char, b.rowId, !isEnabled);
                    BuffFloatingPanel.notifyBuffMutation();
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 右键菜单
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.selectedBuffRowIds.has(b.rowId)) {
                        if (!e.ctrlKey && !e.metaKey) {
                            this.selectedBuffRowIds.clear();
                        }
                        this.selectedBuffRowIds.add(b.rowId);
                        viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                            const rId = el.dataset.rowid;
                            if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                            else el.classList.remove("is-selected");
                        });
                    }
                    BuffFloatingPanel.showBuffContextMenu(e.clientX, e.clientY, b, char, Array.from(this.selectedBuffRowIds));
                });

                // 同一角色内部拖拽排序落点监听
                item.addEventListener("dragover", (e) => {
                    if (BuffFloatingPanel._draggedContext?.type === "buff") {
                        const sTargetId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = item.getBoundingClientRect();
                            const isTop = (e.clientY - rect.top) < (rect.height / 2);
                            if (isTop) {
                                item.classList.add("r20-drag-insert-before");
                                item.classList.remove("r20-drag-insert-after");
                            } else {
                                item.classList.add("r20-drag-insert-after");
                                item.classList.remove("r20-drag-insert-before");
                            }
                        }
                    }
                });

                item.addEventListener("dragleave", () => {
                    item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                });

                item.addEventListener("drop", async (e) => {
                    if (BuffFloatingPanel._draggedContext?.type === "buff") {
                        const sTargetId = BuffFloatingPanel._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation(); // 阻止冒泡到视口，严防自链接！
                            item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");

                            const draggedBuff = BuffFloatingPanel._draggedContext.data;
                            if (draggedBuff && draggedBuff.rowId !== b.rowId) {
                                const rect = item.getBoundingClientRect();
                                const placeBefore = (e.clientY - rect.top) < (rect.height / 2);
                                await Pf1eBuffManager.reorderBuffs(char, draggedBuff.rowId, b.rowId, placeBefore);
                                BuffFloatingPanel.showNotice(`已调整 Buff [${draggedBuff.name}] 排序`);
                                await this.renderViewport();
                            }
                        }
                    }
                });

                // 发起拖拽
                item.addEventListener("dragstart", (e) => {
                    e.stopPropagation();
                    BuffFloatingPanel._draggedContext = {
                        type: "buff",
                        sourceTarget: { type: "char", id: char.id, name },
                        data: b
                    };
                    e.dataTransfer.setData("text/plain", b.name);
                    item.style.opacity = "0.5";
                });

                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    BuffFloatingPanel._draggedContext = null;
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        el.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                    });
                });

                buffListEl.appendChild(item);
            });
            fragment.appendChild(buffListEl);
        }

        if (currentEpoch === this._renderEpoch) {
            viewport.replaceChildren(fragment);
        }
    }
}

    // ==========================================
    // 15. SuiteSettingsPanel (Roll20 房间设置面板注入)
    // ==========================================
/**
 * SuiteSettingsPanel.js
 * 负责在 Roll20 侧边栏设置页面 (#settings-accordion / #mysettings) 中注入专属设置栏目
 * 严格对齐 Roll20 官方 Vue 3 / Element Plus 设置抽屉规范 (//*[@id="settings-accordion"]/div[2])
 */
class SuiteSettingsPanel {
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

    // ==========================================
    // 16. BuffFloatingPanel (单栏多标签 Buff 调度器控制器)
    // ==========================================
/**
 * BuffFloatingPanel.js
 * 现代化单栏多标签 Buff 调度器 (Chromium-style Tabbed Dispatcher)
 * - 单一内容视口：每次只展示当前激活 Tab 单个主体的 Buff
 * - 顶部标签栏：靠左展示选中单位动态 Tab，靠右展示固定角色常驻 Tab
 * - 动态升格：左侧选区 Tab 拖向右侧即升格为固定 Tab
 * - 跨 Tab 拖拽：拖拽 Buff 悬停于任意 Tab 自动切换并施加
 * - 影子链接：🔗 标识跟随主人头像，支持右键快捷菜单与点击断开链接
 * - 尺寸缩放：支持右下角自由 resize 与尺寸位置持久化
 * - 独立派生窗口：支持 Tab 拖离当前窗口撕裂派生独立窗口，或拖回合并
 */
class BuffFloatingPanel {
    static POS_KEY = "r20_suite_buff_panel_pos";
    static SIZE_KEY = "r20_suite_buff_panel_size";
    static PINNED_CHARS_KEY = "r20_suite_pinned_char_ids";
    static PIN_KEY = "r20_suite_buff_panel_pinned";
    static isPinned = false;

    static panelEl = null;
    static isCollapsed = false;
    static activeTarget = null; // { type: "char" | "token", id: string, name: string }
    static pinnedCharIds = [];
    static selectedBuffRowIds = new Set(); // 视口中当前多选的 Buff rowId 集合
    static lastClickedRowId = null; // 用于 Shift 区间多选的基准锚点
    static _draggedContext = null; // { type: "buff" | "tab", data: any }
    static _tabHoverTimer = null;
    static _selectionSyncTimer = null;
    static _lastSelectedIdsStr = "";
    static _savedExpandedHeight = 380;
    static _renderEpoch = 0;
    static _debounceRecalcTimer = null; // 「延迟重新计算」防抖定时器 (SuiteSettingsPanel 的 debounce_recalc 设置)

    /**
     * 初始化调度器工作台
     */
    static async init() {
        if (this.panelEl && document.body.contains(this.panelEl)) return;

        // 加载持久化的固定角色 ID 列表
        try {
            const rawPinned = localStorage.getItem(this.PINNED_CHARS_KEY);
            this.pinnedCharIds = rawPinned ? JSON.parse(rawPinned) : [];
        } catch (e) {
            this.pinnedCharIds = [];
        }

        // 注入现代工作台样式
        BuffPanelStyles.inject();

        // 注入径向菜单与宿主选区钩子
        this.hookRadialMenuTemplate();

        // 创建面板 DOM
        this.createPanelDOM();

        // 恢复位置、尺寸与吸附方向
        this.restorePanelPositionAndSize();

        // 恢复窗口固定状态与更新图钉样式
        this.isPinned = localStorage.getItem(this.PIN_KEY) === "true";
        this.updatePinState();

        // 绑定悬停自动展开/收起（完整复原上一版成熟交互）
        this.initHoverCollapse();

        // 固定状态直接展开套用几何，未固定状态收拢为折叠条（两种状态都走统一入口）
        this.setCollapse(!this.isPinned);

        // 监听选区变化与快捷键
        this.initSelectionListeners();

        // 监听全局标签撕裂派生独立窗口
        this.initGlobalTearOffListener();

        // 监听插件设置变更以热刷新视口与调度器
        this._boundSettingChangedHandler = (e) => {
            if (e.detail?.key === "buff_show_checkbox") {
                this.renderViewport();
            } else if (e.detail?.key === "party_buffs_visible") {
                this.renderDispatcher();
            }
        };
        window.addEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);

        // 初次渲染
        await this.renderDispatcher();

        console.log("[BuffFloatingPanel] 现代单栏多标签 Buff 调度器初始化就绪");
    }

    /**
     * 完全销毁工作台与所有派生独立窗口（热重载与完全卸载支持）
     */
    static destroy() {
        // 1. 销毁所有派生独立窗口
        if (typeof BuffDetachedWindow !== "undefined" && typeof BuffDetachedWindow.destroyAll === "function") {
            BuffDetachedWindow.destroyAll();
        }

        // 2. 解绑全局设置监听
        if (this._boundSettingChangedHandler) {
            window.removeEventListener("r20_suite_setting_changed", this._boundSettingChangedHandler);
            this._boundSettingChangedHandler = null;
        }

        // 3. 解绑全局拖拽撕裂监听
        if (this._boundGlobalDragOver) {
            document.removeEventListener("dragover", this._boundGlobalDragOver, true);
            this._boundGlobalDragOver = null;
        }
        if (this._boundGlobalDrop) {
            document.removeEventListener("drop", this._boundGlobalDrop, true);
            this._boundGlobalDrop = null;
        }

        // 4. 清理定时器
        if (this._selectionDebounceTimer) {
            clearTimeout(this._selectionDebounceTimer);
            this._selectionDebounceTimer = null;
        }
        if (this._tabHoverTimer) {
            clearTimeout(this._tabHoverTimer);
            this._tabHoverTimer = null;
        }
        if (this._renderViewportDebounceTimer) {
            clearTimeout(this._renderViewportDebounceTimer);
            this._renderViewportDebounceTimer = null;
        }
        this._renderViewportPendingResolvers = [];

        // 5. 移除主面板 DOM
        if (this.panelEl) {
            this.panelEl.remove();
            this.panelEl = null;
        }
        document.querySelectorAll("#r20-buff-panel").forEach(el => el.remove());

        console.log("[BuffFloatingPanel] 调度器工作台与事件已成功卸载");
    }

    /**
     * 宿主选中 Token 时的回调入口（通知选区检测器立即同步）
     */
    static onTokenSelectedFromHost(tokenModel) {
        if (!tokenModel) return;
        this.checkSelectionChanged();
    }

    /**
     * 挂载径向菜单模板钩子（实现 Jumpgate 原生选区零延迟感知）
     */
    static hookRadialMenuTemplate() {
        const tmplEl = document.querySelector("#tmpl_radial_menu_token");
        if (tmplEl && !tmplEl.innerHTML.includes("_r20SuiteRadialHook")) {
            const hookCode = `<$ if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel) { window.Roll20Suite.BuffFloatingPanel.onTokenSelectedFromHost(this); } /* _r20SuiteRadialHook */ $>\n`;
            tmplEl.innerHTML = hookCode + tmplEl.innerHTML;
        }
    }

    /**
     * 创建工作台基础 DOM
     */
    static createPanelDOM() {
        document.querySelectorAll("#r20-buff-panel").forEach(el => el.remove());
        const panel = document.createElement("div");
        panel.id = "r20-buff-panel";
        panel.className = "r20-buff-panel";
        panel.innerHTML = BuffPanelTemplates.getPanelHtml();
        document.body.appendChild(panel);
        this.panelEl = panel;

        // 图片加载失败统一降级（捕获阶段监听：error 不冒泡；CSP 禁止内联 onerror，必须用 addEventListener）
        document.addEventListener("error", (e) => {
            const t = e.target;
            if (!t || !t.classList) return;
            if (t.classList.contains("r20-tab-avatar")) {
                t.style.display = "none";
                const fb = t.nextElementSibling;
                if (fb && fb.classList.contains("r20-tab-avatar-fallback")) fb.style.display = "flex";
            } else if (t.classList.contains("r20-buff-host-avatar")) {
                t.style.display = "none";
            }
        }, true);

        // 拖拽窗口标题栏移动
        const header = panel.querySelector(".r20-panel-header");
        // 标题栏拖拽：面板本体实时跟手（指针捕获），松手后判向落位
        header.style.touchAction = "none";
        let headerDragState = null;
        DragGestures.bind(header, {
            isIgnored: (e) => !!e.target.closest("button"),
            onStart: (e, start) => {
                this._headerDragging = true;
                headerDragState = {
                    grabDX: start.x - panel.offsetLeft,
                    grabDY: start.y - header.getBoundingClientRect().top
                };
            },
            onMove: (e) => {
                if (!headerDragState) return;
                const headerH = header.offsetHeight || 30;
                // 标题栏锚定钳制：锚点值（向下=top，向上=bottom）保证标题栏完整留在窗口内
                const headerTop = Math.max(10, Math.min(window.innerHeight - headerH - 10, e.clientY - headerDragState.grabDY));
                panel.style.left = `${Math.max(10, Math.min(window.innerWidth - panel.offsetWidth - 10, e.clientX - headerDragState.grabDX))}px`;
                panel.style.right = "auto";
                if (this.isDirectionUp) {
                    panel.style.top = "auto";
                    panel.style.bottom = `${Math.max(10, window.innerHeight - headerTop - headerH)}px`;
                } else {
                    panel.style.bottom = "auto";
                    panel.style.top = `${headerTop}px`;
                }
            },
            onEnd: () => {
                this._headerDragging = false;
                headerDragState = null;
                this.placePanel(header.getBoundingClientRect().top);
                this.savePositionAndSize();
            }
        });

        // 监听尺寸自由缩放并记忆
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                if (!this.isCollapsed) {
                    this.savePositionAndSize();
                }
            });
            ro.observe(panel);
        }

        // 统一缩放手柄：面板是唯一尺寸载体，直接改面板宽高；
        // 手柄贴面板外侧角（向下=右下，向上=右上），方向类只翻转位置与光标形状
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "r20-resize-handle";
        resizeHandle.title = "拖拽调整窗口大小";
        resizeHandle.style.touchAction = "none";
        let resizeState = null;
        DragGestures.bind(resizeHandle, {
            onStart: (e, start) => {
                resizeState = { startW: panel.offsetWidth, startH: panel.offsetHeight };
            },
            onMove: (e, start) => {
                if (!resizeState) return;
                const nextW = Math.max(280, Math.min(window.innerWidth - 20, resizeState.startW + (e.clientX - start.x)));
                // 向下展开面板向下生长 (+dy)，向上展开底边锚定向上生长 (-dy)
                const dir = this.isDirectionUp ? -1 : 1;
                const nextH = Math.max(200, Math.min(window.innerHeight - 40, resizeState.startH + dir * (e.clientY - start.y)));
                panel.style.width = `${nextW}px`;
                panel.style.height = `${nextH}px`;
            },
            onEnd: () => {
                resizeState = null;
                this.savePositionAndSize();
            }
        });
        panel.appendChild(resizeHandle);

        // 标题栏操作：固定窗口、批量重新计算选中单位
        panel.querySelector(".btn-toggle-pin")?.addEventListener("click", () => this.togglePin());
        panel.querySelector(".btn-recalc-all")?.addEventListener("click", async () => {
            await this.recalculateAllSelected();
        });

        // 标题栏操作：折叠与关闭
        panel.querySelector(".btn-toggle-collapse")?.addEventListener("click", () => this.toggleCollapse());
        panel.querySelector(".btn-close-panel")?.addEventListener("click", () => {
            panel.style.display = "none";
        });

        // 标签栏滚轮水平横向滚动支持（直接用鼠标滚轮在棋子栏滑动查看溢出棋子）
        const setupHorizontalScroll = (el) => {
            if (!el) return;
            el.addEventListener("wheel", (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        };
        setupHorizontalScroll(panel.querySelector(".r20-tabs-dynamic"));
        setupHorizontalScroll(panel.querySelector(".r20-tabs-pinned"));

        // 右侧固定区域监听动态 Tab 拖入（升格）或独立窗口 Tab 拖回合并
        const pinnedContainer = panel.querySelector(".r20-tabs-pinned");
        pinnedContainer.addEventListener("dragover", (e) => {
            if (this._draggedContext?.type === "tab" && (this._draggedContext.tabType === "dynamic" || this._draggedContext.tabType === "detached")) {
                e.preventDefault();
                pinnedContainer.classList.add("r20-pin-zone-hover");
            }
        });
        pinnedContainer.addEventListener("dragleave", (e) => {
            if (!pinnedContainer.contains(e.relatedTarget)) {
                pinnedContainer.classList.remove("r20-pin-zone-hover");
            }
        });
        pinnedContainer.addEventListener("drop", async (e) => {
            pinnedContainer.classList.remove("r20-pin-zone-hover");
            if (this._draggedContext?.type === "tab" && (this._draggedContext.tabType === "dynamic" || this._draggedContext.tabType === "detached")) {
                e.preventDefault();
                const ctx = this._draggedContext;
                ctx._hasSpawned = true; // 锁定防止误触发窗口撕裂

                if (ctx.tabType === "dynamic") {
                    // 与 📌 按钮共用同一准入与钉选实现：无人物卡的纯 Token 拒绝并提示，
                    // 有人物卡的棋子（ctx.id 为人物卡 id）或 represents 角色的 Token 正常钉选
                    const pinnedId = this.pinTargetToken(
                        ctx.token || Roll20Bridge.getTokenGraphic(ctx.id),
                        { type: ctx.targetType || "token", id: ctx.id, name: ctx.name, char: ctx.char || null }
                    );
                    if (!pinnedId) return;
                    return;
                }

                // 独立窗口 Tab 拖回常驻栏合并（ctx.id 恒为人物卡 id）
                const charId = ctx.id;
                if (charId && !this.pinnedCharIds.includes(charId)) {
                    this.pinnedCharIds.push(charId);
                    this.savePinnedChars();
                    if (ctx.winId) {
                        const win = BuffDetachedWindow.instances.get(ctx.winId);
                        if (win) win.removeTab(charId);
                    }
                    this.showNotice(`已将角色钉选至常驻标签栏`);
                    await this.renderDispatcher();
                }
            }
        });

        // 视口区域一次性绑定接收从其他 Tab 拖入放置 Buff
        const viewport = panel.querySelector(".r20-tab-viewport");
        if (viewport) {
            viewport.addEventListener("dragover", (e) => {
                if (this._draggedContext?.type === "buff") {
                    e.preventDefault();
                }
            });
            viewport.addEventListener("drop", async (e) => {
                if (this._draggedContext?.type === "buff") {
                    e.preventDefault();
                    const buff = this._draggedContext.data;
                    const sourceHostId = this._draggedContext.sourceTarget?.id;
                    await this.applyBuffToTarget(buff, this.activeTarget, sourceHostId);
                }
            });

            // 视口区域绑定桌面级框选手势 (Marquee Box Selection)
            this.setupViewportMarqueeSelection(viewport, this);
        }
    }

    /**
     * 为视口挂载框选多选交互 (Marquee Box Selection)
     * 支持在视口空白处按下并拖拽出半透明发光矩形框，实时碰撞选中 Buff 条目
     * 亦支持按住 Alt 键在条目区域直接拉框
     */
    static setupViewportMarqueeSelection(viewport, targetInstance = null) {
        if (!viewport || viewport._hasMarqueeBound) return;
        viewport._hasMarqueeBound = true;

        const getTarget = () => targetInstance || BuffFloatingPanel;

        viewport.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return; // 仅限鼠标左键
            // 排除交互控件：按钮、输入框、复选框、链接徽章、就地编辑文本、工具栏等
            if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-buff-toggle, .r20-viewport-toolbar, .r20-input-round-inline")) {
                return;
            }

            const clickedItem = e.target.closest(".r20-buff-item");
            // 若点击在具体条目上且未按住 Alt 键，交由条目自身单击高亮或 HTML5 拖拽处理
            if (clickedItem && !e.altKey) {
                return;
            }

            const inst = getTarget();

            // 若点击在空白处且未按 Ctrl/Shift，立即清空先前选中条目
            if (!clickedItem && !e.ctrlKey && !e.shiftKey) {
                inst.selectedBuffRowIds.clear();
                viewport.querySelectorAll(".r20-buff-item").forEach(el => el.classList.remove("is-selected"));
            }

            e.preventDefault(); // 阻止浏览器原生文字选中
            const startX = e.clientX;
            const startY = e.clientY;

            let marquee = null;
            let hasDragged = false;
            const initialSelection = new Set((e.ctrlKey || e.shiftKey) ? inst.selectedBuffRowIds : []);

            const onMouseMove = (moveEvt) => {
                const currentX = moveEvt.clientX;
                const currentY = moveEvt.clientY;
                const dist = Math.hypot(currentX - startX, currentY - startY);
                if (!hasDragged && dist < 4) return; // 4px 移动死区防误触

                if (!hasDragged) {
                    hasDragged = true;
                    marquee = document.createElement("div");
                    marquee.className = "r20-selection-marquee";
                    document.body.appendChild(marquee);
                }

                const boxLeft = Math.min(startX, currentX);
                const boxTop = Math.min(startY, currentY);
                const boxWidth = Math.abs(currentX - startX);
                const boxHeight = Math.abs(currentY - startY);

                marquee.style.left = `${boxLeft}px`;
                marquee.style.top = `${boxTop}px`;
                marquee.style.width = `${boxWidth}px`;
                marquee.style.height = `${boxHeight}px`;

                const boxRect = {
                    left: boxLeft,
                    top: boxTop,
                    right: boxLeft + boxWidth,
                    bottom: boxTop + boxHeight
                };

                // 实时针对当前视口条目进行几何相交检测 (AABB Collision)
                viewport.querySelectorAll(".r20-buff-item").forEach(itemEl => {
                    const iRect = itemEl.getBoundingClientRect();
                    const intersects = !(
                        iRect.right < boxRect.left ||
                        iRect.left > boxRect.right ||
                        iRect.bottom < boxRect.top ||
                        iRect.top > boxRect.bottom
                    );
                    const rId = itemEl.dataset.rowid;
                    if (intersects) {
                        inst.selectedBuffRowIds.add(rId);
                        itemEl.classList.add("is-selected");
                    } else if (!initialSelection.has(rId)) {
                        inst.selectedBuffRowIds.delete(rId);
                        itemEl.classList.remove("is-selected");
                    }
                });
            };

            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                if (marquee) {
                    marquee.remove();
                    marquee = null;
                }
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        });
    }

    /**
     * 兼容接口：刷新主工作台视口以及所有活跃的独立派生窗口
     */
    static async renderAllPanes() {
        await this.renderDispatcher();
        for (const win of BuffDetachedWindow.instances.values()) {
            win.render();
        }
    }

    /**
     * 获取单位的有效头像 URL（直击 Jumpgate WebGL 渲染器与 Character 原生资产管道）
     */
    static getAvatarUrl(char, token) {
        // 1. 若显式传入棋子（如左侧动态选区棋子），优先取 Jumpgate WebGL 渲染器实际成功加载的真实地址
        if (token) {
            const tabletop = window.Campaign?.engine?.tabletop;
            const ttObj = tabletop?.tabletopObjects?.get(token.id || token);
            const rendererUrl = ttObj?.imageRenderer?.loadedUrl || ttObj?.imageRenderer?.url;
            if (rendererUrl) return rendererUrl;
        }

        // 2. 若为常驻固定角色（char 实体），优先调用 Roll20 官方原生立绘管道 char.getAvatar()
        if (char) {
            const avatar = typeof char.getAvatar === "function" ? char.getAvatar() : "";
            if (avatar) return avatar;

            // 若无专属立绘，回退至官方原生默认棋子图标 char.getTokenURL()
            const defaultTokenUrl = typeof char.getTokenURL === "function" ? char.getTokenURL() : "";
            if (defaultTokenUrl) return defaultTokenUrl;
        }

        // 3. 兜底回退：若当前地图完全无实体或方法不可用，回退至数据模型原始字段并清洗
        let raw = token?.get?.("imgsrc") || char?.get?.("avatar") || "";
        if (raw) {
            raw = raw.replace(/^https?:\/\/s3\.amazonaws\.com\/files\.d20\.io\//, "https://files.d20.io/");
            if (raw.startsWith("//")) raw = "https:" + raw;
        }
        return raw;
    }

    /**
     * 生成 Tab 纯净 Token 图标结构（带失败优雅降级首字 fallback）
     * 注意：不使用内联 onerror（Roll20 CSP 禁止内联事件处理器），加载失败降级由
     * createPanelDOM 里 document 捕获阶段的 error 监听器统一处理
     */
    static getAvatarHtml(name, avatarUrl) {
        const initial = (name || "?").trim().charAt(0).toUpperCase();
        return `
            <div class="r20-tab-avatar-box">
                ${avatarUrl ? `<img class="r20-tab-avatar" src="${escapeHtml(avatarUrl)}" alt="" />` : ""}
                <div class="r20-tab-avatar-fallback" style="${avatarUrl ? 'display:none;' : 'display:flex;'}">${escapeHtml(initial)}</div>
            </div>
        `.trim();
    }

    /**
     * 生成「链接自施法者」影子链接徽章（🔗 + 施法者头像，头像加载失败自动隐藏）
     * 单一实现供主面板 Buff 行 / Debuff 行与独立二级窗口共用，修改徽章样式只改这里
     */
    static getLinkBadgeHtml(hostChar) {
        const hostAvatar = hostChar?.getAvatar ? hostChar.getAvatar() : (hostChar?.get("avatar") || "");
        const hostName = hostChar?.get("name") || "未知施法者";
        return `
            <span class="r20-buff-link-badge btn-unlink" title="🔗 链接自 [${escapeHtml(hostName)}]，点击解除链接转为独立副本">
                🔗
                ${hostAvatar ? `<img src="${escapeHtml(hostAvatar)}" class="r20-buff-host-avatar" alt="${escapeHtml(hostName)}">` : ""}
            </span>
        `.trim();
    }

    /**
     * 从当前选区中取消选择某个 Token（直接调用 Jumpgate 官方框架 removeFromSelection）
     */
    static deselectToken(tokenModel) {
        if (!tokenModel) return;
        const tokenId = tokenModel.id || tokenModel;

        const tt = window.Campaign?.engine?.tabletop;
        if (tt && typeof tt.getSelection === "function") {
            const currentSelection = tt.getSelection() || [];
            const item = currentSelection.find(i => i.id === tokenId || i.model === tokenModel || i.model?.id === tokenId);
            if (item && typeof tt.removeFromSelection === "function") {
                try {
                    tt.removeFromSelection(item);
                } catch (e) {}
            }
        }
        if (Array.isArray(window.selected_tokens)) {
            window.selected_tokens = window.selected_tokens.filter(id => id !== tokenId);
        }
        this.checkSelectionChanged();
        this.renderDispatcher();
    }

    /**
     * 核心渲染入口：同时刷新 Tabs 与内容视口
     */
    static async renderDispatcher() {
        if (!this.panelEl) return;
        this.renderTabs();
        await this.renderViewport();
    }

    /**
     * 渲染顶部选项卡栏 (左侧动态选区 Tab + 右侧固定常驻 Tab)
     */
    static renderTabs() {
        const dynamicContainer = this.panelEl.querySelector(".r20-tabs-dynamic");
        const pinnedContainer = this.panelEl.querySelector(".r20-tabs-pinned");
        if (!dynamicContainer || !pinnedContainer) return;

        dynamicContainer.innerHTML = "";
        pinnedContainer.innerHTML = "";

        const selectedTokens = this.getSelectedTokens();
        const detachedCharIds = BuffDetachedWindow.getAllDetachedTargetIds();

        // 1. 构建左侧动态选区 Tab（严格排重：凡已钉选角色或已在独立窗口中的角色绝不在此重复出现）
        selectedTokens.forEach(t => {
            const token = t.token;
            // 权限守卫：非 GM 玩家无权查看的单位跳过渲染
            if (!Roll20Bridge.canViewTokenBuffs(token)) return;

            const targetMode = Roll20Bridge.resolveBuffTargetMode(token);
            const type = targetMode.mode; // "char" 或 "token"
            const char = targetMode.mode === "char" ? targetMode.char : null;
            const id = type === "char" ? targetMode.char.id : token.id;
            const name = token?.get("name") || t.char?.get("name") || "未命名";

            // 全系统任一实体的 Tab 始终只能有 1 个：已钉选或已在独立窗口中的角色均排除
            if (type === "char" && (this.pinnedCharIds.includes(id) || detachedCharIds.has(id))) {
                return;
            }
            if (type === "token" && detachedCharIds.has(id)) {
                return;
            }

            const isActive = this.activeTarget && this.activeTarget.id === id && this.activeTarget.type === type;
            const avatarUrl = this.getAvatarUrl(char, token);

            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}`;
            tab.title = `${name} (选区单位，点击右上角 📌 钉选)`;
            tab.draggable = true;
            tab.innerHTML = `
                ${this.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-pin" title="钉选此角色到常驻栏">📌</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-pin")) {
                    e.stopPropagation();
                    this.pinTargetToken(token, { type, id, name, char });
                    return;
                }
                this.activeTarget = { type, id, name };
                this.renderDispatcher();
            });

            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                this._draggedContext = {
                    type: "tab",
                    tabType: "dynamic",
                    id,
                    name,
                    targetType: type,
                    token,
                    char,
                    startX: e.clientX,
                    startY: e.clientY,
                    _hasSpawned: false
                };
                e.dataTransfer.setData("text/plain", name);
                tab.style.opacity = "0.5";
            });

            tab.addEventListener("dragend", (e) => {
                tab.style.opacity = "1";
                const ctx = this._draggedContext;
                this._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return; // 单次防重锁拦截

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            this.bindTabBuffHover(tab, { type, id, name });
            dynamicContainer.appendChild(tab);
        });

        // 2. 构建右侧常驻固定角色 Tab（若在选区中则呈现选中高亮；若已在独立窗口中则排除）
        this.pinnedCharIds.forEach((charId, pIdx) => {
            if (detachedCharIds.has(charId)) return;

            const char = window.Campaign?.characters?.get(charId);
            if (!char) {
                // 自愈：钉选 ID 无法解析为人物卡（历史脏数据 / 误钉选的无卡棋子 token id），
                // 从常驻栏静默清除，避免渲染出"(未知角色)"左括号僵尸 Tab
                console.info(`[BuffFloatingPanel] 常驻栏钉选 ID [${charId}] 无法解析为人物卡，已自动清除`);
                this.pinnedCharIds = this.pinnedCharIds.filter(id => id !== charId);
                this.savePinnedChars();
                return;
            }
            // 权限守卫：非 GM 玩家无权查看该角色时，严防泄漏，跳过渲染
            if (!Roll20Bridge.canViewCharacterBuffs(charId)) return;

            const name = char.get("name") || "未命名";
            const isActive = this.activeTarget && this.activeTarget.id === charId && this.activeTarget.type === "char";
            const isSelected = selectedTokens.some(st => (st.char?.id === charId) || (st.token?.id === charId));

            const avatarUrl = this.getAvatarUrl(char, null);
            const tab = document.createElement("div");
            tab.className = `r20-tab${isActive ? " active" : ""}${isSelected ? " selected-highlight" : ""}`;
            tab.title = `${name} (固定常驻角色${isSelected ? " - 画布当前已选中" : ""})`;
            tab.draggable = true;
            tab.innerHTML = `
                ${this.getAvatarHtml(name, avatarUrl)}
                <span class="r20-tab-close" title="取消钉选">✕</span>
            `;

            tab.addEventListener("click", (e) => {
                if (e.target.classList.contains("r20-tab-close")) {
                    e.stopPropagation();
                    this.removePinnedChar(charId);
                    return;
                }
                this.activeTarget = { type: "char", id: charId, name };
                this.renderDispatcher();
            });

            tab.addEventListener("dragstart", (e) => {
                e.stopPropagation();
                this._draggedContext = {
                    type: "tab",
                    tabType: "pinned",
                    index: pIdx,
                    id: charId,
                    name,
                    startX: e.clientX,
                    startY: e.clientY,
                    _hasSpawned: false
                };
                e.dataTransfer.setData("text/plain", name);
                tab.style.opacity = "0.5";
            });

            tab.addEventListener("dragend", (e) => {
                tab.style.opacity = "1";
                const ctx = this._draggedContext;
                this._draggedContext = null;

                if (!ctx || ctx.type !== "tab") return;
                if (ctx._hasSpawned) return; // 单次防重锁拦截

                const targetUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                const insidePanel = targetUnderMouse?.closest(".r20-buff-panel");

                if (!insidePanel) {
                    const dist = Math.hypot(e.clientX - ctx.startX, e.clientY - ctx.startY);
                    if (dist > 25) {
                        this.spawnDetachedWindow(e.clientX, e.clientY, ctx.id, ctx);
                    }
                }
            });

            tab.addEventListener("dragover", (e) => {
                if (this._draggedContext?.type === "tab" && this._draggedContext.tabType === "pinned") {
                    e.preventDefault();
                    tab.classList.add("r20-tab-drag-hover");
                }
            });

            tab.addEventListener("dragleave", () => {
                tab.classList.remove("r20-tab-drag-hover");
            });

            tab.addEventListener("drop", (e) => {
                tab.classList.remove("r20-tab-drag-hover");
                if (this._draggedContext?.type === "tab" && this._draggedContext.tabType === "pinned") {
                    e.preventDefault();
                    const fromIdx = this._draggedContext.index;
                    const toIdx = pIdx;
                    if (fromIdx !== toIdx) {
                        const [moved] = this.pinnedCharIds.splice(fromIdx, 1);
                        this.pinnedCharIds.splice(toIdx, 0, moved);
                        this.savePinnedChars();
                        this.renderDispatcher();
                    }
                }
            });

            this.bindTabBuffHover(tab, { type: "char", id: charId, name });
            pinnedContainer.appendChild(tab);
        });

        // ➕ 钉选角色搜索按钮（常驻栏末尾；renderTabs 每次清空容器后需重建）
        const addPinnedBtn = document.createElement("button");
        addPinnedBtn.className = "r20-btn-icon btn-add-pinned-char";
        addPinnedBtn.title = "钉选指定角色到常驻标签栏";
        addPinnedBtn.textContent = "➕";
        addPinnedBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showAddPinnedCharMenu(addPinnedBtn);
        });
        pinnedContainer.appendChild(addPinnedBtn);

        // 3. 自动调和与回退当前激活的 Tab 目标
        this.reconcileActiveTarget(selectedTokens);
    }

    /**
     * 为 Tab 绑定 Buff 拖拽悬停自动切换逻辑 (Hover-to-Switch)
     */
    static bindTabBuffHover(tabEl, targetInfo) {
        tabEl.addEventListener("dragover", (e) => {
            if (this._draggedContext?.type === "buff") {
                e.preventDefault();
                tabEl.classList.add("r20-tab-drag-hover");

                if (!this._tabHoverTimer && (!this.activeTarget || this.activeTarget.id !== targetInfo.id)) {
                    this._tabHoverTimer = setTimeout(async () => {
                        this.activeTarget = targetInfo;
                        await this.renderDispatcher();
                    }, 200);
                }
            }
        });

        tabEl.addEventListener("dragleave", (e) => {
            if (!tabEl.contains(e.relatedTarget)) {
                tabEl.classList.remove("r20-tab-drag-hover");
                if (this._tabHoverTimer) {
                    clearTimeout(this._tabHoverTimer);
                    this._tabHoverTimer = null;
                }
            }
        });

        tabEl.addEventListener("drop", async (e) => {
            tabEl.classList.remove("r20-tab-drag-hover");
            if (this._tabHoverTimer) {
                clearTimeout(this._tabHoverTimer);
                this._tabHoverTimer = null;
            }

            if (this._draggedContext?.type === "buff") {
                e.preventDefault();
                const buff = this._draggedContext.data;
                const sourceHostId = this._draggedContext.sourceTarget?.id;
                await this.applyBuffToTarget(buff, targetInfo, sourceHostId);
            }
        });
    }

    /**
     * 自动调和与回退当前激活的目标（遵循动态选区与常驻角色全局唯一规则）
     */
    static reconcileActiveTarget(selectedTokens) {
        const availableTargets = [];
        const detachedCharIds = BuffDetachedWindow.getAllDetachedTargetIds();

        // 1. 动态选区目标（已钉选或已在独立窗口中的角色不在动态栏中重复出现）
        selectedTokens.forEach(t => {
            const char = t.char;
            const token = t.token;
            if (char && (this.pinnedCharIds.includes(char.id) || detachedCharIds.has(char.id))) return;
            if (detachedCharIds.has(token.id)) return;
            const id = char ? char.id : token.id;
            const type = char ? "char" : "token";
            const name = token?.get("name") || char?.get("name") || "未命名";
            availableTargets.push({ type, id, name });
        });

        // 2. 常驻固定角色目标（已在独立窗口中的角色排除）
        this.pinnedCharIds.forEach(id => {
            if (detachedCharIds.has(id)) return;
            // 权限守卫：非 GM 玩家跳过无权查看的目标
            if (!Roll20Bridge.canViewCharacterBuffs(id)) return;
            const char = window.Campaign?.characters?.get(id);
            if (char) {
                availableTargets.push({ type: "char", id, name: char.get("name") || "未命名" });
            }
        });

        // 维持当前激活目标（若仍在可用列表中）
        if (this.activeTarget && availableTargets.some(t => t.id === this.activeTarget.id && t.type === this.activeTarget.type)) {
            return;
        }

        // 否则回退至第一个可用目标
        if (availableTargets.length > 0) {
            this.activeTarget = availableTargets[0];
        } else {
            this.activeTarget = null;
        }
    }

    static _renderViewportDebounceTimer = null;
    static _renderViewportPendingResolvers = [];

    /**
     * 渲染单栏视口区 (展示当前活跃目标的唯一 Buff 列表)
     * 具备微任务批处理防抖：多属性连击修改时仅执行一次完整 DOM 构建与读取
     */
    static renderViewport(options = {}) {
        if (options.force) {
            return this._doRenderViewport();
        }
        return new Promise((resolve) => {
            this._renderViewportPendingResolvers.push(resolve);
            if (this._renderViewportDebounceTimer) return;
            this._renderViewportDebounceTimer = setTimeout(async () => {
                this._renderViewportDebounceTimer = null;
                const resolvers = this._renderViewportPendingResolvers;
                this._renderViewportPendingResolvers = [];
                try {
                    await this._doRenderViewport();
                } catch (err) {
                    console.error("[BuffFloatingPanel] renderViewport 执行异常:", err);
                } finally {
                    for (const r of resolvers) {
                        try { r(); } catch (e) {}
                    }
                }
            }, 35);
        });
    }

    static async _doRenderViewport() {
        const viewport = this.panelEl?.querySelector(".r20-tab-viewport");
        if (!viewport) return;

        const currentEpoch = ++this._renderEpoch;

        if (!this.activeTarget) {
            viewport.innerHTML = `
                <div class="r20-empty-view">
                    🕹️ 画布未选中任何单位<br>
                    在地图点击棋子展示 Buff，或点击右上角 ➕ 钉选常驻角色
                </div>
            `;
            return;
        }

        const { type, id, name } = this.activeTarget;

        // 权限脱敏拦截守卫：非 GM 玩家无权查看该目标时，严防泄漏，直接展示未授权提示
        if (!Roll20Bridge.isGM()) {
            const canView = type === "char" ? Roll20Bridge.canViewCharacterBuffs(id) : Roll20Bridge.canViewTokenBuffs(id);
            if (!canView) {
                viewport.innerHTML = `
                    <div class="r20-empty-view">
                        🔒 无权查看 [${Roll20Bridge.escapeHtml(name || "该单位")}] 的 Buff 信息
                    </div>
                `;
                return;
            }
        }

        let char = null;
        let token = null;

        if (type === "char") {
            char = window.Campaign?.characters?.get(id);
        } else {
            token = Roll20Bridge.getTokenGraphic(id);
        }

        // 读取 Buff 列表与 Debuff 列表（内存数据直接读取）
        let buffs = [];
        let debuffs = [];
        if (char) {
            buffs = await Pf1eBuffManager.getAllBuffs(char);
            debuffs = await Pf1eBuffUI.getAllDebuffs(char);
        } else if (token) {
            // Token 数据已在 TokenBuffManager 读取时归一化（结构与人物卡一致），此处直接使用
            buffs = TokenBuffManager.getTokenBuffs(token).filter(b => !b.isDebuff);
            debuffs = TokenBuffManager.getTokenDebuffs(token).map(b => ({
                rowId: b.rowId || b.key || b.name,
                key: b.key || b.name,
                name: b.name,
                enabled: b.enabled === true,
                rounds: (b.rounds !== undefined && b.rounds !== null) ? b.rounds : null,
                initRounds: b.initRounds || null,
                isDebuff: true,
                linkHostId: b.linkHostId || null,
                linkSourceRowId: b.linkSourceRowId || null,
                linkChildren: b.linkChildren || []
            }));
        }

        // 事务版本守卫：如果在读取等待期间已有更新的渲染事务触发，本次作废退出，绝不碰触 DOM！
        if (currentEpoch !== this._renderEpoch) {
            return;
        }

        const fragment = document.createDocumentFragment();

        // 视口顶部工具条（目标名、快速施加状态、一键全关、新建 Buff）
        const toolbar = document.createElement("div");
        toolbar.className = "r20-viewport-toolbar";

        toolbar.innerHTML = `
            <div class="r20-toolbar-target-name">
                <span>${Roll20Bridge.escapeHtml(name)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:3px;">
                <button class="r20-btn-debuff-trigger" title="选择并施加负面状态 (Debuff)">Debuff ▾</button>
                <button class="r20-btn-icon btn-deactivate-all" title="一键取消激活该单位身上的所有 Buff 与状态" style="color:#f59e0b;">🚫 全关</button>
                <button class="r20-btn-icon btn-add-buff-to-active" title="为此角色添加新 Buff">➕ Buff</button>
            </div>
        `;

        // 快速施加状态：多列网格浮层选择器
        const debuffTriggerBtn = toolbar.querySelector(".r20-btn-debuff-trigger");
        debuffTriggerBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showDebuffPopover(debuffTriggerBtn, this.activeTarget, () => this.renderViewport());
        });

        // 一键全关当前主体身上的所有 Buff 与 Debuff
        toolbar.querySelector(".btn-deactivate-all")?.addEventListener("click", async () => {
            if (char) {
                const activeBuffs = await Pf1eBuffManager.getActiveBuffs(char);
                for (const b of activeBuffs) {
                    await Pf1eBuffManager.toggleBuff(char, b.rowId, false);
                }
                const activeDebuffs = Pf1eBuffUI.getActiveDebuffsSync(char);
                for (const d of activeDebuffs) {
                    await Pf1eBuffManager.toggleCondition(char, d.key, false);
                }
                this.showNotice(`已取消激活 [${name}] 的全部 Buff 与状态`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                TokenBuffManager.saveTokenBuffs(token, []);
                TokenBuffManager.saveTokenDebuffs(token, []);
                this.showNotice(`已清空 [${name}] 的全部 Buff 与状态`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        toolbar.querySelector(".btn-add-buff-to-active")?.addEventListener("click", () => {
            this.showBuffEditorDialog(null, char, token);
        });

        fragment.appendChild(toolbar);

        // 提前单次读取启停复选框设置，规避条目遍历内高频重复访问 localStorage 与 JSON.parse
        const showCheckbox = SuiteConfigStore.getSetting("buff_show_checkbox", false);

        // 渲染专属负面状态 (Debuff / Condition) 区块
        if (debuffs.length > 0) {
            const listEl = document.createElement("div");
            listEl.className = "r20-debuff-list";
            debuffs.forEach(d => {
                const item = document.createElement("div");
                const isEnabled = !!d.enabled;
                const isSelected = this.selectedBuffRowIds.has(d.rowId);
                item.className = `r20-buff-item is-debuff ${isEnabled ? "is-active" : "is-inactive"} ${isSelected ? "is-selected" : ""}`;
                item.dataset.rowid = d.rowId;
                item.dataset.isdebuff = "true";
                item.draggable = true;

                const toggleCheckboxHtml = showCheckbox
                    ? `<input type="checkbox" class="r20-buff-toggle" ${isEnabled ? "checked" : ""} title="快速启停负面状态">`
                    : "";

                const curVal = (d.rounds !== null && d.rounds !== undefined && d.rounds !== "") ? d.rounds : null;
                const curDisplay = curVal !== null ? `${curVal}轮` : "常驻";
                const roundsHtml = `
                    <span class="r20-buff-rounds">
                        <span class="r20-buff-round-num r20-buff-round-cur" style="color:#fda4af;" title="点击就地修改持续轮数">${curDisplay}</span>
                    </span>
                `;

                // 影子链接徽章渲染（🔗 + 施法者头像或下游计数）
                let linkBadgeHtml = "";
                if (d.linkHostId) {
                    const hostChar = window.Campaign?.characters?.get(d.linkHostId);
                    linkBadgeHtml = this.getLinkBadgeHtml(hostChar);
                } else if (Array.isArray(d.linkChildren) && d.linkChildren.length > 0) {
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge" style="color:#f43f5e;" title="🔗 名下维持着 ${d.linkChildren.length} 个受术者的 Debuff 链接">
                            🔗 (${d.linkChildren.length})
                        </span>
                    `;
                }

                item.innerHTML = `
                    <div class="r20-buff-left">
                        ${toggleCheckboxHtml}
                        <span class="r20-buff-name" style="color:#f43f5e; font-weight:600;" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                        ${linkBadgeHtml}
                        ${roundsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="r20-btn-icon btn-remove-debuff" title="解除此负面状态" style="color:#f43f5e;">✕</button>
                    </div>
                `;

                // 绑定复选框启停
                item.querySelector(".r20-buff-toggle")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.toggleCondition(char, d.key, e.target.checked);
                    } else if (token) {
                        TokenBuffManager.toggleDebuff(token, d.key, e.target.checked);
                    }
                    await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 点击当前轮数：在原本数字所在位置就地渲染输入框快速编辑
                const curEl = item.querySelector(".r20-buff-round-cur");
                curEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char && !token) return;

                    Roll20Bridge.attachInlineRoundEditor(curEl, {
                        initialValue: curVal !== null ? curVal : "",
                        placeholder: "常驻",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            let newRounds = null;
                            if (raw !== "" && raw !== "常驻" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, char);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }
                            if (char) {
                                const roundsKey = `${d.key}_rounds`;
                                let roundsAttr = Roll20Bridge.findAttr(char, roundsKey);
                                const roundVal = newRounds !== null ? newRounds : "";
                                if (roundsAttr) roundsAttr.save({ current: roundVal });
                                else char.attribs.create({ name: roundsKey, current: roundVal });
                            } else if (token) {
                                const list = TokenBuffManager.getTokenDebuffs(token);
                                const target = list.find(b => (b.key || b.name) === d.key);
                                if (target) {
                                    target.rounds = newRounds;
                                    TokenBuffManager.saveTokenDebuffs(token, list);
                                }
                            }
                                        await Pf1eBuffUI.refreshAllBadges();
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 图标解绑（直接断开）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.unlinkBuff(char, d.rowId);
                        this.showNotice(`已断开 [${d.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    }
                });

                // 点击 ✕ 按钮彻底解除/删除
                item.querySelector(".btn-remove-debuff")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.deleteDebuffPermanently(char, d.key);
                        this.showNotice(`已彻底解除/删除 [${d.name}] 状态`);
                    } else if (token) {
                        TokenBuffManager.removeTrackedDebuff(token, d.key);
                        this.showNotice(`已彻底解除/删除 [${d.name}] 状态`);
                    }
                        await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 单击条目多选高亮
                item.addEventListener("click", (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;
                    this.lastClickedRowId = d.rowId;
                    if (e.ctrlKey || e.metaKey) {
                        if (this.selectedBuffRowIds.has(d.rowId)) this.selectedBuffRowIds.delete(d.rowId);
                        else this.selectedBuffRowIds.add(d.rowId);
                    } else {
                        if (this.selectedBuffRowIds.has(d.rowId) && this.selectedBuffRowIds.size === 1) {
                            this.selectedBuffRowIds.clear();
                        } else {
                            this.selectedBuffRowIds.clear();
                            this.selectedBuffRowIds.add(d.rowId);
                        }
                    }
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        const rId = el.dataset.rowid;
                        if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                        else el.classList.remove("is-selected");
                    });
                });

                // 双击条目快速切换激活/关停
                item.addEventListener("dblclick", async (e) => {
                    if (e.target.closest("button, .btn-unlink, .r20-input-round-inline")) return;
                    if (char) {
                        await Pf1eBuffManager.toggleCondition(char, d.key, !isEnabled);
                    } else if (token) {
                        TokenBuffManager.toggleDebuff(token, d.key, !isEnabled);
                    }
                        await Pf1eBuffUI.refreshAllBadges();
                    await this.renderViewport();
                });

                // 拖拽发起 (Dragstart)
                item.addEventListener("dragstart", (e) => {
                    this._draggedContext = {
                        type: "buff",
                        data: d,
                        sourceTarget: this.activeTarget
                    };
                    e.dataTransfer.setData("text/plain", d.name);
                    item.style.opacity = "0.5";
                });
                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    this._draggedContext = null;
                });

                // 右键上下文菜单
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.selectedBuffRowIds.has(d.rowId)) {
                        if (!e.ctrlKey && !e.metaKey) this.selectedBuffRowIds.clear();
                        this.selectedBuffRowIds.add(d.rowId);
                        viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                            const rId = el.dataset.rowid;
                            if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                            else el.classList.remove("is-selected");
                        });
                    }
                    this.showBuffContextMenu(e.clientX, e.clientY, d, char, Array.from(this.selectedBuffRowIds), token);
                });

                listEl.appendChild(item);
            });
            fragment.appendChild(listEl);

            // 若同时存在正面 Buff，简单以极细分割线隔开
            if (buffs.length > 0) {
                const divider = document.createElement("div");
                divider.className = "r20-buff-divider";
                fragment.appendChild(divider);
            }
        }

        if (buffs.length === 0) {
            if (debuffs.length === 0) {
                const emptyEl = document.createElement("div");
                emptyEl.className = "r20-empty-view";
                emptyEl.innerHTML = `该单位当前无任何 Buff<br>从其他标签拖拽 Buff 放置即可施加`;
                fragment.appendChild(emptyEl);
            }
        } else {
            const buffListEl = document.createElement("div");
            buffListEl.className = "r20-buff-list";
            buffs.forEach(b => {
                const item = document.createElement("div");
                const isEnabled = !!b.enabled;
                const isSelected = this.selectedBuffRowIds.has(b.rowId);
                item.className = `r20-buff-item ${isEnabled ? "is-active" : "is-inactive"} ${isSelected ? "is-selected" : ""}`;
                item.dataset.rowid = b.rowId;
                item.draggable = true;

                const toggleCheckboxHtml = showCheckbox
                    ? `<input type="checkbox" class="r20-buff-toggle" ${isEnabled ? "checked" : ""} title="快速启停 Buff">`
                    : "";

                const curVal = (b.rounds !== null && b.rounds !== undefined && b.rounds !== "") ? b.rounds : null;
                const initVal = (b.initRounds !== null && b.initRounds !== undefined && b.initRounds !== "") ? b.initRounds : null;
                const curDisplay = curVal !== null ? `${curVal}` : "永久";
                const initDisplay = initVal !== null ? `${initVal}` : "-";
                const roundsHtml = `
                    <span class="r20-buff-rounds">
                        <span class="r20-buff-round-num r20-buff-round-cur" title="点击就地修改当前轮数">${curDisplay}</span>
                        <span class="r20-buff-round-sep">/</span>
                        <span class="r20-buff-round-num r20-buff-round-init" title="点击就地修改初始轮数或公式">${initDisplay}</span>
                    </span>
                `;

                // 影子链接徽章渲染（🔗 + 主人头像 或 🔗 下游计数）
                let linkBadgeHtml = "";
                if (b.linkHostId) {
                    const hostChar = window.Campaign?.characters?.get(b.linkHostId);
                    linkBadgeHtml = this.getLinkBadgeHtml(hostChar);
                } else if (Array.isArray(b.linkChildren) && b.linkChildren.length > 0) {
                    linkBadgeHtml = `
                        <span class="r20-buff-link-badge" style="color:#60a5fa;" title="🔗 名下维持着 ${b.linkChildren.length} 个受术者的子链接 Buff">
                            🔗 (${b.linkChildren.length})
                        </span>
                    `;
                }

                item.innerHTML = `
                    <div class="r20-buff-left">
                        ${toggleCheckboxHtml}
                        <span class="r20-buff-name" title="${escapeHtml(b.name)}">${escapeHtml(b.name)}</span>
                        ${linkBadgeHtml}
                        ${roundsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <button class="r20-btn-icon btn-edit-buff-row" title="编辑细目">✏️</button>
                    </div>
                `;

                // 快速启停复选框
                item.querySelector(".r20-buff-toggle")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.toggleBuff(char, b.rowId, e.target.checked);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    } else if (token) {
                        TokenBuffManager.toggleBuff(token, b.name, e.target.checked);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    }
                });

                // 点击当前轮数：在原本数字所在位置就地渲染输入框快速编辑
                const curEl = item.querySelector(".r20-buff-round-cur");
                curEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char && !token) return;

                    // 纯 Token：直接改写自定义字段中的轮数（清空 = 常驻）
                    if (token) {
                        Roll20Bridge.attachInlineRoundEditor(curEl, {
                            initialValue: curVal !== null ? curVal : "",
                            placeholder: "常驻",
                            className: "r20-input-round-inline",
                            onCommit: async (raw) => {
                                const newRounds = (raw !== "" && !isNaN(Number(raw))) ? Number(raw) : null;
                                const list = TokenBuffManager.getTokenBuffs(token);
                                const target = list.find(x => x.name === b.name);
                                if (target) {
                                    target.rounds = newRounds;
                                    TokenBuffManager.saveTokenBuffs(token, list);
                                }
                                await Pf1eBuffUI.refreshAllBadges();
                                await this.renderViewport();
                            }
                        });
                        return;
                    }

                    Roll20Bridge.attachInlineRoundEditor(curEl, {
                        initialValue: curVal !== null ? curVal : "",
                        placeholder: "永久",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            let newRounds = "";
                            if (raw !== "" && raw !== "永久" && raw !== "-") {
                                if (!isNaN(Number(raw))) {
                                    newRounds = Number(raw);
                                } else {
                                    try {
                                        const evaled = await Roll20Bridge.evalNativeFormula(raw, char);
                                        newRounds = (!isNaN(Number(evaled)) && evaled !== null) ? Number(evaled) : raw;
                                    } catch (err) {
                                        newRounds = raw;
                                    }
                                }
                            }
                            await Pf1eBuffManager.setBuffRounds(char, b.rowId, newRounds);
                            await this.renderViewport();
                        }
                    });
                });

                // 点击初始轮数：在原本数字所在位置就地渲染输入框快速编辑
                const initEl = item.querySelector(".r20-buff-round-init");
                initEl?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!char && !token) return;

                    // 纯 Token：直接改写自定义字段中的初始轮数（清空 = 无预置轮数）
                    if (token) {
                        Roll20Bridge.attachInlineRoundEditor(initEl, {
                            initialValue: initVal !== null ? initVal : "",
                            placeholder: "-",
                            className: "r20-input-round-inline",
                            onCommit: async (raw) => {
                                const newInit = (raw !== "" && !isNaN(Number(raw))) ? Number(raw) : null;
                                const list = TokenBuffManager.getTokenBuffs(token);
                                const target = list.find(x => x.name === b.name);
                                if (target) {
                                    target.initRounds = newInit;
                                    TokenBuffManager.saveTokenBuffs(token, list);
                                }
                                await this.renderViewport();
                            }
                        });
                        return;
                    }

                    Roll20Bridge.attachInlineRoundEditor(initEl, {
                        initialValue: initVal !== null ? initVal : "",
                        placeholder: "-",
                        className: "r20-input-round-inline",
                        onCommit: async (raw) => {
                            await Pf1eBuffManager.setBuffInitRounds(char, b.rowId, raw);
                            await this.renderViewport();
                        }
                    });
                });

                // 点击 🔗 图标解绑（直接断开，无需二次确认）
                item.querySelector(".btn-unlink")?.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (char) {
                        await Pf1eBuffManager.unlinkBuff(char, b.rowId);
                        this.showNotice(`已断开 [${b.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    } else if (token && b.linkHostId) {
                        // 纯 Token：清顶层链接字段，并向宿主除名
                        const list = TokenBuffManager.getTokenBuffs(token);
                        const target = list.find(x => x.rowId === b.rowId);
                        if (target) {
                            const srcRowId = target.linkSourceRowId;
                            const hostId = target.linkHostId;
                            target.linkHostId = null;
                            target.linkSourceRowId = null;
                            TokenBuffManager.saveTokenBuffs(token, list);
                            const hostChar = window.Campaign?.characters?.get(hostId);
                            if (hostChar && srcRowId) {
                                await Pf1eBuffManager.removeDownstreamLink(hostChar, srcRowId, token.id, b.rowId);
                            }
                        }
                        this.showNotice(`已断开 [${b.name}] 链接，转为独立副本`);
                        await this.renderViewport();
                    }
                });

                // 编辑细目
                item.querySelector(".btn-edit-buff-row")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.showBuffEditorDialog(b, char, token);
                });

                // 单击条目多选高亮 (支持 Shift 区间连选与 Ctrl/Cmd 追加)
                item.addEventListener("click", (e) => {
                    if (e.target.closest("button, input, select, textarea, .btn-unlink, .r20-buff-round-num, .r20-input-round-inline, .r20-buff-toggle")) return;

                    if (e.shiftKey && this.lastClickedRowId) {
                        const allItemEls = Array.from(viewport.querySelectorAll(".r20-buff-item"));
                        const lastIdx = allItemEls.findIndex(el => el.dataset.rowid === this.lastClickedRowId);
                        const currIdx = allItemEls.findIndex(el => el.dataset.rowid === b.rowId);
                        if (lastIdx !== -1 && currIdx !== -1) {
                            const start = Math.min(lastIdx, currIdx);
                            const end = Math.max(lastIdx, currIdx);
                            if (!e.ctrlKey && !e.metaKey) {
                                this.selectedBuffRowIds.clear();
                            }
                            for (let i = start; i <= end; i++) {
                                this.selectedBuffRowIds.add(allItemEls[i].dataset.rowid);
                            }
                        }
                    } else {
                        this.lastClickedRowId = b.rowId;
                        if (e.ctrlKey || e.metaKey) {
                            if (this.selectedBuffRowIds.has(b.rowId)) {
                                this.selectedBuffRowIds.delete(b.rowId);
                            } else {
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        } else {
                            if (this.selectedBuffRowIds.has(b.rowId) && this.selectedBuffRowIds.size === 1) {
                                this.selectedBuffRowIds.clear();
                            } else {
                                this.selectedBuffRowIds.clear();
                                this.selectedBuffRowIds.add(b.rowId);
                            }
                        }
                    }
                    // 即时局部更新 DOM 高亮样式，零闪烁
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        const rId = el.dataset.rowid;
                        if (this.selectedBuffRowIds.has(rId)) {
                            el.classList.add("is-selected");
                        } else {
                            el.classList.remove("is-selected");
                        }
                    });
                });

                // 双击条目快速切换激活/关停
                item.addEventListener("dblclick", async (e) => {
                    if (e.target.closest("button, .btn-unlink, .r20-buff-toggle, input, select, textarea")) return;
                    if (char) {
                        await Pf1eBuffManager.toggleBuff(char, b.rowId, !isEnabled);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    } else if (token) {
                        TokenBuffManager.toggleBuff(token, b.name, !isEnabled);
                        await Pf1eBuffUI.refreshAllBadges();
                        await this.renderViewport();
                    }
                });

                // 右键上下文菜单
                item.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!this.selectedBuffRowIds.has(b.rowId)) {
                        if (!e.ctrlKey && !e.metaKey) {
                            this.selectedBuffRowIds.clear();
                        }
                        this.selectedBuffRowIds.add(b.rowId);
                        viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                            const rId = el.dataset.rowid;
                            if (this.selectedBuffRowIds.has(rId)) el.classList.add("is-selected");
                            else el.classList.remove("is-selected");
                        });
                    }
                    this.showBuffContextMenu(e.clientX, e.clientY, b, char, Array.from(this.selectedBuffRowIds), token);
                });

                // 同一角色内部拖拽排序落点监听
                item.addEventListener("dragover", (e) => {
                    if (this._draggedContext?.type === "buff") {
                        const sTargetId = this._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = item.getBoundingClientRect();
                            const isTop = (e.clientY - rect.top) < (rect.height / 2);
                            if (isTop) {
                                item.classList.add("r20-drag-insert-before");
                                item.classList.remove("r20-drag-insert-after");
                            } else {
                                item.classList.add("r20-drag-insert-after");
                                item.classList.remove("r20-drag-insert-before");
                            }
                        }
                    }
                });

                item.addEventListener("dragleave", () => {
                    item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                });

                item.addEventListener("drop", async (e) => {
                    if (this._draggedContext?.type === "buff") {
                        const sTargetId = this._draggedContext.sourceTarget?.id;
                        if (sTargetId && char && sTargetId === char.id) {
                            e.preventDefault();
                            e.stopPropagation(); // 阻止冒泡到视口，彻底杜绝创建自链接！
                            item.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");

                            const draggedBuff = this._draggedContext.data;
                            if (draggedBuff && draggedBuff.rowId !== b.rowId) {
                                const rect = item.getBoundingClientRect();
                                const placeBefore = (e.clientY - rect.top) < (rect.height / 2);
                                await Pf1eBuffManager.reorderBuffs(char, draggedBuff.rowId, b.rowId, placeBefore);
                                this.showNotice(`已调整 Buff [${draggedBuff.name}] 排序`);
                                await this.renderViewport();
                            }
                        }
                    }
                });

                // Buff 发起拖拽
                item.addEventListener("dragstart", (e) => {
                    e.stopPropagation();
                    this._draggedContext = {
                        type: "buff",
                        sourceTarget: this.activeTarget,
                        data: b
                    };
                    e.dataTransfer.setData("text/plain", b.name);
                    item.style.opacity = "0.5";
                });

                item.addEventListener("dragend", () => {
                    item.style.opacity = "1";
                    this._draggedContext = null;
                    viewport.querySelectorAll(".r20-buff-item").forEach(el => {
                        el.classList.remove("r20-drag-insert-before", "r20-drag-insert-after");
                    });
                });

                buffListEl.appendChild(item);
            });
            fragment.appendChild(buffListEl);
        }

        // 最终原子级一次性替换视口内容，彻底杜绝先清空后追加的竞态与视觉闪烁
        if (currentEpoch === this._renderEpoch) {
            viewport.replaceChildren(fragment);
        }
    }

    /**
     * 弹出 Buff 右键快捷菜单 (多选激活/多选关停/全选中同名关停/编辑/施加/同步)
     */
    static showBuffContextMenu(x, y, buff, char, selectedRowIds = [], token = null) {
        document.querySelector(".r20-buff-context-menu")?.remove();

        const menu = document.createElement("div");
        menu.className = "r20-context-menu r20-buff-context-menu";
        menu.style.left = `${Math.min(window.innerWidth - 220, x)}px`;
        menu.style.top = `${Math.min(window.innerHeight - 340, y)}px`;

        const isGM = Roll20Bridge.isGM();
        const isDebuff = !!buff.isDebuff || (typeof buff.rowId === "string" && buff.rowId.startsWith("condition-"));
        const isLinkedChild = !!(buff.linkHostId && buff.linkSourceRowId);
        const hasDownstream = Array.isArray(buff.linkChildren) && buff.linkChildren.length > 0;
        const selIds = (selectedRowIds && selectedRowIds.length > 0) ? selectedRowIds : [buff.rowId];
        const countLabel = selIds.length > 1 ? ` (${selIds.length})` : "";
        const delIds = (selIds.length > 1 && selIds.includes(buff.rowId)) ? selIds : [buff.rowId];
        const delCountLabel = delIds.length > 1 ? ` (${delIds.length})` : "";

        // 统一接入宿主免疫级失焦与外部交互原语 (Host-Immune Dismissal)
        const cleanupDismiss = Roll20Bridge.watchDismissal(menu, () => {
            menu.remove();
        });

        const cleanup = () => {
            cleanupDismiss();
            menu.remove();
        };

        menu.innerHTML = `
            <div class="r20-context-menu-item btn-ctx-activate-selected" style="color:#60a5fa;">
                <span>⚡</span><span>激活选中${isDebuff ? "状态" : "Buff"}${countLabel}</span>
            </div>
            <div class="r20-context-menu-item btn-ctx-deactivate-selected" style="color:#94a3b8;">
                <span>⛔</span><span>关停选中${isDebuff ? "状态" : "Buff"}${countLabel}</span>
            </div>
            ${isGM ? `
            <div class="r20-context-menu-item btn-ctx-deactivate-all-homonym" style="color:#f87171;">
                <span>🛑</span><span>关停所有选中单位同名${isDebuff ? "状态" : "Buff"} [${Roll20Bridge.escapeHtml(buff.name)}]</span>
            </div>` : ""}
            <div class="r20-context-menu-divider"></div>
            ${!isLinkedChild ? `
            <div class="r20-context-menu-item btn-ctx-link-selected"><span>🔗</span><span>施加给所有选中单位 (创建链接)</span></div>` : ""}
            <div class="r20-context-menu-item btn-ctx-apply-selected"><span>✨</span><span>施加给所有选中单位 (普通副本)</span></div>
            <div class="r20-context-menu-divider"></div>
            ${!isDebuff ? `
            <div class="r20-context-menu-item btn-ctx-edit"><span>✏️</span><span>编辑细目</span></div>
            <div class="r20-context-menu-item btn-ctx-clone"><span>📋</span><span>复制为独立副本</span></div>` : ""}
            ${isLinkedChild ? `
            ${!isDebuff ? `<div class="r20-context-menu-item btn-ctx-sync-host" style="color:#64b5f6;"><span>🔄</span><span>从宿主同步最新细目</span></div>` : ""}
            <div class="r20-context-menu-item btn-ctx-unlink" style="color:#f59e0b;"><span>🔗</span><span>断开链接转为独立副本</span></div>` : ""}
            ${!isLinkedChild && hasDownstream ? `
            <div class="r20-context-menu-item btn-ctx-deactivate-downstream" style="color:#fb7185;"><span>🛑</span><span>关停当前及所有下游${isDebuff ? "状态" : "Buff"} (${buff.linkChildren.length})</span></div>
            ${!isDebuff ? `<div class="r20-context-menu-item btn-ctx-sync-downstream" style="color:#81c784;"><span>🔄</span><span>同步更新所有下游链接副本 (${buff.linkChildren.length})</span></div>` : ""}
            <div class="r20-context-menu-item btn-ctx-delete-downstream" style="color:#ef5350;"><span>🧹</span><span>删除所有下游链接副本 (宿主保留) (${buff.linkChildren.length})</span></div>` : ""}
            <div class="r20-context-menu-divider"></div>
            <div class="r20-context-menu-item btn-ctx-delete" style="color:#ef5350;"><span>🗑️</span><span>彻底解除/删除${delCountLabel}</span></div>
        `;

        // 激活选中Buff / Debuff
        menu.querySelector(".btn-ctx-activate-selected").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of selIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.toggleCondition(char, rId, true);
                    } else {
                        await Pf1eBuffManager.toggleBuff(char, rId, true);
                    }
                }
                this.showNotice(`已激活 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                for (const rId of selIds) {
                    TokenBuffManager.toggleDebuff(token, rId, true);
                }
                this.showNotice(`已激活 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        // 关停选中Buff / Debuff
        menu.querySelector(".btn-ctx-deactivate-selected").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of selIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.toggleCondition(char, rId, false);
                    } else {
                        await Pf1eBuffManager.toggleBuff(char, rId, false);
                    }
                }
                this.showNotice(`已关停 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                for (const rId of selIds) {
                    TokenBuffManager.toggleDebuff(token, rId, false);
                }
                this.showNotice(`已关停 ${selIds.length} 个选中项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        // 关停所有选中单位同名Buff / Debuff (仅 GM 独占操作)
        menu.querySelector(".btn-ctx-deactivate-all-homonym")?.addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            let count = 0;
            const targetBuffName = buff.name.trim().toLowerCase();
            for (const t of selected) {
                let affected = false;
                if (t.char) {
                    if (isDebuff) {
                        const def = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS.find(d => d.name.trim().toLowerCase() === targetBuffName || d.key === buff.rowId);
                        if (def) {
                            await Pf1eBuffManager.toggleCondition(t.char, def.key, false);
                            count++;
                            affected = true;
                        }
                    } else {
                        const allB = await Pf1eBuffManager.getAllBuffs(t.char);
                        for (const cb of allB) {
                            if (cb.name.trim().toLowerCase() === targetBuffName && cb.enabled) {
                                await Pf1eBuffManager.toggleBuff(t.char, cb.rowId, false);
                                count++;
                                affected = true;
                            }
                        }
                    }
                    if (affected && typeof Pf1eBuffUI !== "undefined") {
                        Pf1eBuffUI.requestTokenRefresh(t.char.id);
                    }
                } else if (t.token) {
                    TokenBuffManager.removeBuff(t.token, buff.name);
                    count++;
                    if (typeof Pf1eBuffUI !== "undefined") {
                        Pf1eBuffUI.requestTokenRefresh(t.token.id);
                    }
                }
            }
            this.showNotice(`已关停 ${count} 个选中单位的 [${buff.name}]`);
            await this.renderAllPanes();
        });

        // 施加给选中单位 (创建链接) - 若为 Debuff 则默认排除施法者自身！
        menu.querySelector(".btn-ctx-link-selected")?.addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            const buffsToApply = await this.resolveBuffsForBatchApply(buff, char, token, selectedRowIds);
            let count = 0;
            const selfActivatedNames = [];
            for (const t of selected) {
                // 人物卡单位走角色卡后端；纯 Token 单位走自定义字段后端（链接 Debuff 对 Token 退化为独立副本）
                const target = t.char
                    ? { type: "char", id: t.char.id, name: t.char.get("name") }
                    : (t.token ? { type: "token", id: t.token.id, name: t.token.get("name") } : null);
                if (!target) continue;
                if (t.char && t.char.id === char.id) {
                    // 自身：逐个激活选中的正面条目（Debuff 排除施法者自身）
                    for (const b of buffsToApply) {
                        const bIsDebuff = !!b.isDebuff || (typeof b.rowId === "string" && b.rowId.startsWith("condition-"));
                        if (bIsDebuff) continue;
                        if (!b.enabled) {
                            await Pf1eBuffManager.toggleBuff(char, b.rowId, true);
                            b.enabled = true;
                            selfActivatedNames.push(b.name);
                        }
                    }
                } else {
                    for (const b of buffsToApply) {
                        await this.applyBuffToTarget(b, target, char.id);
                        count++;
                    }
                }
            }
            if (selfActivatedNames.length > 0) this.notifyTokenRefresh(char);
            const msg = selfActivatedNames.length > 0
                ? `已激活自身 ${selfActivatedNames.length} 项，并为 ${count} 个目标施加链接（${buffsToApply.length} 项 × 选中单位）`
                : `已为 ${count} 个目标施加链接（${buffsToApply.length} 项 × 选中单位）`;
            this.showNotice(msg);
            await this.renderViewport();
        });

        // 施加给选中单位 (普通副本) - 若为 Debuff 则默认排除施法者自身！
        menu.querySelector(".btn-ctx-apply-selected").addEventListener("click", async () => {
            cleanup();
            const selected = this.getSelectedTokens();
            if (selected.length === 0) {
                this.showNotice("未选中任何目标单位");
                return;
            }
            const buffsToApply = await this.resolveBuffsForBatchApply(buff, char, token, selectedRowIds);
            let count = 0;
            const selfActivatedNames = [];
            for (const t of selected) {
                const target = t.char
                    ? { type: "char", id: t.char.id, name: t.char.get("name") }
                    : (t.token ? { type: "token", id: t.token.id, name: t.token.get("name") } : null);
                if (!target) continue;
                if (t.char && t.char.id === char.id) {
                    // 自身：逐个激活选中的正面条目（Debuff 排除施法者自身）
                    for (const b of buffsToApply) {
                        const bIsDebuff = !!b.isDebuff || (typeof b.rowId === "string" && b.rowId.startsWith("condition-"));
                        if (bIsDebuff) continue;
                        if (!b.enabled) {
                            await Pf1eBuffManager.toggleBuff(char, b.rowId, true);
                            b.enabled = true;
                            selfActivatedNames.push(b.name);
                        }
                    }
                } else {
                    for (const b of buffsToApply) {
                        await this.applyBuffToTarget(b, target, null);
                        count++;
                    }
                }
            }
            if (selfActivatedNames.length > 0) this.notifyTokenRefresh(char);
            const msg = selfActivatedNames.length > 0
                ? `已激活自身 ${selfActivatedNames.length} 项，并为 ${count} 个目标施加普通副本（${buffsToApply.length} 项 × 选中单位）`
                : `已为 ${count} 个目标施加普通副本（${buffsToApply.length} 项 × 选中单位）`;
            this.showNotice(msg);
            await this.renderViewport();
        });

        // 编辑
        menu.querySelector(".btn-ctx-edit")?.addEventListener("click", () => {
            cleanup();
            this.showBuffEditorDialog(buff, char);
        });

        // 复制为独立副本
        menu.querySelector(".btn-ctx-clone")?.addEventListener("click", async () => {
            cleanup();
            if (char) {
                const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(buff.extraAttrs);
                const cloneName = await this.generateUniqueCloneName(char, buff.name);
                await Pf1eBuffManager.addBuff(char, cloneName, buff.rounds, cleanAttrs, buff.initRounds);
                this.showNotice(`已复制独立副本 [${cloneName}]`);
                await this.renderViewport();
            }
        });

        // 从宿主同步最新细目 (保持自身当前轮数与开关状态独立)
        menu.querySelector(".btn-ctx-sync-host")?.addEventListener("click", async () => {
            cleanup();
            if (!char || !buff.linkHostId) return;
            const hostChar = window.Campaign?.characters?.get(buff.linkHostId);
            if (!hostChar) {
                this.showNotice("未找到对应的施法者宿主角色");
                return;
            }
            const ok = await Pf1eBuffManager.syncBuffToDownstream(hostChar, buff.linkSourceRowId, char, buff.rowId);
            if (ok) {
                this.showNotice(`已从 [${hostChar.get("name")}] 同步最新细目 (保持自身轮数与开关)`);
                await this.renderViewport();
            } else {
                this.showNotice("宿主角色卡上未找到对应的源 Buff");
            }
        });

        // 断开链接转为独立副本
        menu.querySelector(".btn-ctx-unlink")?.addEventListener("click", async () => {
            cleanup();
            if (char && buff.rowId) {
                await Pf1eBuffManager.unlinkBuff(char, buff.rowId);
                this.showNotice(`已断开 [${buff.name}] 链接，转为独立副本`);
                await this.renderViewport();
            }
        });

        // 关停当前及所有下游Buff / Debuff
        menu.querySelector(".btn-ctx-deactivate-downstream")?.addEventListener("click", async () => {
            cleanup();
            if (!char) return;
            await Pf1eBuffManager.deactivateBuffAndDownstream(char, buff.rowId);
            this.showNotice(`已关停当前及所有下游链接副本 (${buff.linkChildren.length})`);
            await this.renderAllPanes();
        });

        // 删除所有下游链接子副本（宿主行保留）
        menu.querySelector(".btn-ctx-delete-downstream")?.addEventListener("click", async () => {
            cleanup();
            if (!char) return;
            const n = await Pf1eBuffManager.deleteDownstreamChildren(char, buff.rowId);
            this.showNotice(`已删除 [${buff.name}] 的 ${n} 个下游链接副本 (宿主保留)`);
            await this.renderAllPanes();
        });

        // 同步更新所有下游链接副本
        menu.querySelector(".btn-ctx-sync-downstream")?.addEventListener("click", async () => {
            cleanup();
            if (!char) return;
            const count = await Pf1eBuffManager.broadcastDownstreamSync(char, buff.rowId);
            this.showNotice(`已将最新细目同步至 ${count} 个下游链接副本`);
            await this.renderViewport();
        });

        // 彻底删除 / 解除（支持多选批量删除）
        menu.querySelector(".btn-ctx-delete").addEventListener("click", async () => {
            cleanup();
            if (char) {
                for (const rId of delIds) {
                    if (typeof rId === "string" && rId.startsWith("condition-")) {
                        await Pf1eBuffManager.deleteDebuffPermanently(char, rId);
                    } else {
                        await Pf1eBuffManager.deleteBuffRowPermanently(char, rId);
                    }
                    this.selectedBuffRowIds.delete(rId);
                }
                this.showNotice(`已彻底解除/删除 ${delIds.length} 项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (token) {
                for (const rId of delIds) {
                    // 若条目是链接副本，先向宿主除名（否则宿主子计数残留幽灵）
                    const list = TokenBuffManager.getTokenBuffs(token);
                    const victim = list.find(e => e.rowId === rId || e.name === rId);
                    if (victim && victim.linkHostId) {
                        const hostChar = window.Campaign?.characters?.get(victim.linkHostId);
                        if (hostChar && victim.linkSourceRowId) {
                            await Pf1eBuffManager.removeDownstreamLink(hostChar, victim.linkSourceRowId, token.id, victim.rowId);
                        }
                    }
                    TokenBuffManager.removeTrackedDebuff(token, rId);
                    TokenBuffManager.removeBuff(token, rId);
                    this.selectedBuffRowIds.delete(rId);
                }
                this.showNotice(`已彻底解除/删除 ${delIds.length} 项`);
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            }
        });

        document.body.appendChild(menu);
    }

    /**
     * 将 Buff / Debuff 施加至目标（支持传入 sourceHostId 自动打上影子链接）
     * 根本约束：施法者严禁向自身创建链接/副本
     */
    static async applyBuffToTarget(buff, target, sourceHostId = null) {
        if (!buff || !target || (sourceHostId && target.id === sourceHostId)) return;
        console.log(`[BuffFloatingPanel] [DEBUG_APPLY] 目标: [${target.name}] (type: ${target.type}, id: ${target.id}), Buff: [${buff.name}], sourceHostId: [${sourceHostId}]`);
        const targetChar = target.type === "char" ? window.Campaign?.characters?.get(target.id) : null;
        const targetToken = target.type === "token" ? Roll20Bridge.getTokenGraphic(target.id) : null;

        const isDebuff = !!buff.isDebuff || (typeof buff.rowId === "string" && buff.rowId.startsWith("condition-"));

        if (isDebuff) {
            const condKey = buff.key || buff.rowId;
            if (targetChar) {
                await Pf1eBuffManager.applyOrRefreshDebuff(targetChar, condKey, buff.rounds, sourceHostId, buff.rowId);
                this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} 负面状态 [${buff.name}]`);
                if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                await this.renderViewport();
            } else if (targetToken) {
                TokenBuffManager.addTrackedDebuff(targetToken, {
                    key: condKey,
                    name: buff.name,
                    rounds: buff.rounds,
                    initRounds: null,
                    enabled: true,
                    linkHostId: sourceHostId || null,
                    linkSourceRowId: sourceHostId ? buff.rowId : null
                });
                if (sourceHostId) {
                    const hostChar = window.Campaign?.characters?.get(sourceHostId);
                    if (hostChar) {
                        await Pf1eBuffManager.recordDownstreamLink(hostChar, condKey, targetToken.id, condKey);
                    }
                }
                this.showNotice(`已为 [${target.name}] 施加负面状态 [${buff.name}]`);
                if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetToken.id);
                await this.renderViewport();
            }
            return;
        }

        let extraAttrs = { ...(buff.extraAttrs || {}) };
        if (sourceHostId) {
            // 链接 Buff：设置宿主信息，并清除原有的 link_children（防止下游继承老大的小弟）
            delete extraAttrs.link_children;
            extraAttrs.link_host_id = sourceHostId;
            if (buff.rowId) extraAttrs.link_source_row_id = buff.rowId;
        } else {
            // 普通副本：彻底净化所有影子链接元属性，确保下游副本 100% 独立！
            extraAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs) || {};
        }

        if (targetChar) {
            const res = await Pf1eBuffManager.applyOrRefreshBuff(
                targetChar,
                buff.name,
                buff.rounds,
                extraAttrs,
                buff.initRounds
            );
            if (sourceHostId && buff.rowId && res && res.rowId) {
                const hostChar = window.Campaign?.characters?.get(sourceHostId);
                if (hostChar) {
                    await Pf1eBuffManager.recordDownstreamLink(hostChar, buff.rowId, targetChar.id, res.rowId);
                }
            }
            this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} Buff [${buff.name}]`);
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
            await this.renderViewport();
        } else if (targetToken) {
            // 纯 Token：链接 Buff 记录影子链接元数据并向宿主登记下游；普通副本彻底独立
            const entry = TokenBuffManager.applyOrRefreshBuff(targetToken, buff.name, buff.rounds, null, buff.initRounds);
            if (entry && sourceHostId && buff.rowId) {
                // 关键：applyOrRefreshBuff 内部已保存，必须重新读取列表、按 rowId 定位到
                // 刚落盘的条目再写入链接元数据——直接改旧对象会被随后的保存覆盖丢失
                const list = TokenBuffManager.getTokenBuffs(targetToken);
                const stored = list.find(x => x.rowId === entry.rowId);
                if (stored) {
                    // 链接元数据写在顶层字段（与人物卡 getAllBuffs 输出一致），extraAttrs 只存细目
                    stored.linkHostId = sourceHostId;
                    stored.linkSourceRowId = buff.rowId;
                    TokenBuffManager.saveTokenBuffs(targetToken, list);
                }
                const hostChar = window.Campaign?.characters?.get(sourceHostId);
                if (hostChar) {
                    await Pf1eBuffManager.recordDownstreamLink(hostChar, buff.rowId, targetToken.id, entry.rowId);
                }
            }
            this.showNotice(`已为 [${target.name}] 施加 ${sourceHostId ? "链接" : ""} Buff [${buff.name}]`);
            if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetToken.id);
            await this.renderViewport();
        }
    }

    /**
     * 解析批量施加的条目列表：右键行在多选中且选中不止一行 → 施加全部选中条目；否则只施加右键行
     */
    static async resolveBuffsForBatchApply(buff, char, token, selectedRowIds) {
        const sel = new Set(selectedRowIds || []);
        if (!sel.has(buff.rowId) || sel.size <= 1) return [buff];
        const all = char
            ? [...(await Pf1eBuffManager.getAllBuffs(char)), ...Pf1eBuffUI.getAllDebuffsSync(char)]
            : [...TokenBuffManager.getTokenBuffs(token), ...TokenBuffManager.getTokenDebuffs(token)];
        const matched = all.filter(b => sel.has(b.rowId));
        return matched.length > 0 ? matched : [buff];
    }

    /**
     * 响应 Buff 变更，根据设置面板「延迟重新计算」偏好 (debounce_recalc_enabled / debounce_recalc_ms)
     * 决定是否在无操作静止一段时间后自动重算所有选中单位的加值。
     * 本方法是与 SuiteSettingsPanel 的设置项之间唯一的消费契约，
     * BuffDetachedWindow 的 buff 变更处理器也依赖此方法，绝不可删除！
     */
    static notifyBuffMutation() {
        const enabled = SuiteConfigStore.getSetting("debounce_recalc_enabled", false);
        if (!enabled) return;

        const delayMs = SuiteConfigStore.getSetting("debounce_recalc_ms", 2000);
        if (this._debounceRecalcTimer) {
            clearTimeout(this._debounceRecalcTimer);
        }

        this._debounceRecalcTimer = setTimeout(async () => {
            console.log(`[BuffFloatingPanel] 静止 ${delayMs}ms，触发防抖自动重新计算加值`);
            await this.recalculateAllSelected();
        }, delayMs);
    }

    /**
     * 手动批量重新计算所有当前选中的单位加值
     */
    static async recalculateAllSelected() {
        const selected = this.getSelectedTokens();
        if (selected.length === 0) {
            if (this.activeTarget?.type === "char") {
                const char = window.Campaign?.characters?.get(this.activeTarget.id);
                if (char) {
                    await RecalcService.flush(char, { reason: "manual_topbar_click" });
                    this.showNotice(`已强制触发 [${this.activeTarget.name}] 官方加值重算`);
                }
            } else {
                this.showNotice("未选中任何单位");
            }
            return;
        }

        for (const t of selected) {
            if (t.char) {
                await RecalcService.flush(t.char, { reason: "manual_topbar_click" });
            }
        }
        this.showNotice(`已强制触发 ${selected.length} 个选中单位的官方加值重算`);
    }

    /**
     * 为克隆的独立副本生成不冲突的专属名称
     * 提取已有 "(副本)" 或 "(副本 N)" 后缀，智能递增为唯一名称，杜绝重名冲突
     */
    static async generateUniqueCloneName(character, baseName) {
        if (!character) return `${baseName || "新Buff"} (副本)`;
        const existingBuffs = await Pf1eBuffManager.getAllBuffs(character) || [];
        const existingNames = new Set(existingBuffs.map(b => (b.name || "").trim().toLowerCase()));

        let cleanBase = (baseName || "新Buff").trim();
        // 匹配 "(副本)" 或 "(副本 2)"、"(副本 3)"
        const copyMatch = cleanBase.match(/^(.*?)\s*\(副本(?:\s*(\d+))?\)$/);
        if (copyMatch) {
            cleanBase = copyMatch[1].trim();
        }

        let candidate = `${cleanBase} (副本)`;
        if (!existingNames.has(candidate.toLowerCase())) {
            return candidate;
        }

        let index = 2;
        while (existingNames.has(`${cleanBase} (副本 ${index})`.toLowerCase())) {
            index++;
        }
        return `${cleanBase} (副本 ${index})`;
    }

    /**
     * 将动态选区的单位钉选至常驻标签栏
     * @returns {string|null} 成功钉选（或已被钉选）的人物卡 id；无人物卡等准入失败返回 null
     */
    static pinTargetToken(token, { type, id, name, char }) {
        let charId = null;
        if (type === "char") {
            charId = id;
        } else if (char?.id) {
            charId = char.id;
        } else if (token) {
            const resolvedChar = Roll20Bridge.getCharacterByToken(token);
            if (resolvedChar?.id) {
                charId = resolvedChar.id;
            }
        }

        if (!charId) {
            this.showNotice(`该单位未关联人物卡，无法钉选`);
            return null;
        }

        if (!this.pinnedCharIds.includes(charId)) {
            this.pinnedCharIds.push(charId);
            this.savePinnedChars();
            this.showNotice(`已将【${name}】钉选至常驻标签栏`);
            this.renderDispatcher();
        }
        return charId;
    }

    /**
     * 移除固定角色
     */
    static removePinnedChar(charId) {
        this.pinnedCharIds = this.pinnedCharIds.filter(id => id !== charId);
        this.savePinnedChars();
        this.renderDispatcher();
    }

    /**
     * 保存固定角色 ID 列表
     */
    static savePinnedChars() {
        try {
            localStorage.setItem(this.PINNED_CHARS_KEY, JSON.stringify(this.pinnedCharIds));
        } catch (e) {}
    }

    /**
     * 弹出添加固定角色菜单（带实时搜索框、滚动条与边界自适应翻转）
     * 恢复自 v0.9.26：下方空间不足时自动向上翻转展开
     */
    static showAddPinnedCharMenu(anchorBtn) {
        document.querySelector(".r20-pinned-char-picker")?.remove();

        const characters = window.Campaign?.characters?.models || [];
        const unpinned = characters.filter(c => !c.get("archived") && !this.pinnedCharIds.includes(c.id));

        const menu = document.createElement("div");
        menu.className = "r20-context-menu r20-pinned-char-picker";
        menu.style.width = "220px";
        menu.style.maxHeight = "320px";
        menu.style.display = "flex";
        menu.style.flexDirection = "column";
        menu.style.padding = "6px";
        menu.style.boxSizing = "border-box";
        menu.style.zIndex = "10050";

        // 智能定位：下方空间不足时向上翻转
        const rect = anchorBtn.getBoundingClientRect();
        const pickerHeight = 300;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < pickerHeight && rect.top > pickerHeight) {
            menu.style.top = `${rect.top - pickerHeight - 4}px`;
        } else {
            menu.style.top = `${rect.bottom + 4}px`;
        }
        menu.style.right = `${Math.max(10, window.innerWidth - rect.right)}px`;

        // 搜索输入框
        const searchBox = document.createElement("div");
        searchBox.style.cssText = "margin-bottom:6px; flex-shrink:0;";
        searchBox.innerHTML = `
            <input type="text" class="r20-pinned-search" placeholder="🔍 搜索角色名称..."
                style="width:100%; box-sizing:border-box; background:#ffffff; border:1px solid #d0d0d0; color:#333333; padding:5px 8px; border-radius:4px; font-size:11px; outline:none;">
        `;
        menu.appendChild(searchBox);

        // 滚动列表容器
        const listContainer = document.createElement("div");
        listContainer.style.cssText = "flex:1 1 auto; overflow-y:auto; max-height:240px; scrollbar-width:thin;";

        if (unpinned.length === 0) {
            listContainer.innerHTML = `<div style="padding:10px; color:#94a3b8; font-size:11px; text-align:center;">无可用未钉选角色</div>`;
        } else {
            const itemNodes = [];
            unpinned.forEach(c => {
                const name = c.get("name") || "未命名";
                const item = document.createElement("div");
                item.className = "r20-context-menu-item";
                item.style.cssText = "padding:5px 8px; border-radius:3px; cursor:pointer;";
                item.innerHTML = `<span>🛡️</span><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Roll20Bridge.escapeHtml(name)}</span>`;
                item.addEventListener("click", async () => {
                    menu.remove();
                    this.pinnedCharIds.push(c.id);
                    this.savePinnedChars();
                    await this.renderDispatcher();
                });
                listContainer.appendChild(item);
                itemNodes.push({ el: item, name });
            });

            // 搜索过滤
            const searchInput = searchBox.querySelector(".r20-pinned-search");
            searchInput.addEventListener("input", (e) => {
                const q = e.target.value.trim().toLowerCase();
                itemNodes.forEach(({ el, name }) => {
                    const match = !q || name.toLowerCase().includes(q);
                    el.style.display = match ? "flex" : "none";
                });
            });

            setTimeout(() => searchInput.focus(), 50);
        }

        menu.appendChild(listContainer);

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== anchorBtn) {
                menu.remove();
                document.removeEventListener("mousedown", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);

        document.body.appendChild(menu);
    }

    /**
     * 原子级派生独立工作台窗口（单次防重锁 SSOT）
     */
    static spawnDetachedWindow(x, y, charId, ctx = null) {
        if (!charId) return null;
        if (ctx) {
            if (ctx._hasSpawned) return null;
            ctx._hasSpawned = true;
        }

        // 如果是常驻固定角色，拖离成为独立窗口后从固定栏中移出
        if (this.pinnedCharIds.includes(charId)) {
            this.removePinnedChar(charId);
        }

        const win = BuffDetachedWindow.create(x, y, charId);
        this.showNotice("已创建独立工作台窗口");
        this.renderDispatcher();
        return win;
    }

    /**
     * 全局标签撕裂监听：在窗口外部释放 Tab 时派生独立二级窗口（捕获阶段优先拦截）
     */
    static initGlobalTearOffListener() {
        if (this._boundGlobalDragOver) {
            document.removeEventListener("dragover", this._boundGlobalDragOver, true);
        }
        if (this._boundGlobalDrop) {
            document.removeEventListener("drop", this._boundGlobalDrop, true);
        }

        this._boundGlobalDragOver = (e) => {
            if (this._draggedContext?.type === "tab") {
                e.preventDefault();
            }
        };

        this._boundGlobalDrop = (e) => {
            if (this._draggedContext?.type === "tab") {
                if (e.target.closest(".r20-buff-panel")) return;

                e.preventDefault();
                const tabCtx = this._draggedContext;
                const charId = tabCtx.id;
                if (!charId) return;

                if (tabCtx.tabType === "detached" && tabCtx.winId) {
                    const win = BuffDetachedWindow.instances.get(tabCtx.winId);
                    if (win) win.removeTab(charId);
                }

                this.spawnDetachedWindow(e.clientX, e.clientY, charId, tabCtx);
            }
        };

        document.addEventListener("dragover", this._boundGlobalDragOver, true);
        document.addEventListener("drop", this._boundGlobalDrop, true);
    }

    /**
     * 选区变动检测入口（轻量比对 ID 序列）
     */
    static checkSelectionChanged() {
        const tokens = this.getSelectedTokens();
        const idsStr = tokens.map(t => t.token?.id || t.char?.id || t.name).sort().join(",");
        if (idsStr !== this._lastSelectedIdsStr) {
            this._lastSelectedIdsStr = idsStr;
            this.onSelectionChanged(tokens);
        }
    }

    /**
     * 处理选区实质变动（仅调和更新标签与视口数据，严禁随意干预窗口折叠收起状态）
     */
    static onSelectionChanged(selectedTokens) {
        this.renderDispatcher();
    }

    /**
     * 监听画布选区变动（直击 Roll20 Jumpgate Tabletop 选区原型原子方法）
     */
    static initSelectionListeners() {
        const check = () => this.checkSelectionChanged();

        // 1. 深度对齐 Jumpgate Tabletop 原型选区三剑客（原子操作拦截，零轮询、零鼠标事件）
        const hookTabletopProto = () => {
            const tt = window.Campaign?.engine?.tabletop;
            if (!tt) return false;
            const proto = Object.getPrototypeOf(tt);
            if (!proto || proto._r20SuiteSelectionHooked) return true;

            const notifyDebounced = () => {
                if (this._selectionDebounceTimer) clearTimeout(this._selectionDebounceTimer);
                this._selectionDebounceTimer = setTimeout(check, 25);
            };

            const origAdd = proto.addToSelection;
            if (typeof origAdd === "function") {
                proto.addToSelection = function(...args) {
                    const res = origAdd.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            const origRemove = proto.removeFromSelection;
            if (typeof origRemove === "function") {
                proto.removeFromSelection = function(...args) {
                    const res = origRemove.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            const origClear = proto.clearSelection;
            if (typeof origClear === "function") {
                proto.clearSelection = function(...args) {
                    const res = origClear.apply(this, args);
                    notifyDebounced();
                    return res;
                };
            }

            proto._r20SuiteSelectionHooked = true;
            return true;
        };

        if (!hookTabletopProto()) {
            const retryInterval = setInterval(() => {
                if (hookTabletopProto()) clearInterval(retryInterval);
            }, 500);
        }

        // 2. 先攻条 Token 点击联动
        document.addEventListener("click", (e) => {
            const tokenRow = e.target.closest("#vm-turn-order li.token, .turn-tracker li.token, #initiativewindow li.token");
            if (tokenRow && tokenRow.dataset.tokenid) {
                setTimeout(check, 60);
            }
        });
    }

    /**
     * 提取当前画布选中的所有 Token 与角色模型（通过 Jumpgate 原生 getSelection 与权限鉴权）
     */
    static getSelectedTokens() {
        const result = [];
        const seen = new Set();
        const tt = window.Campaign?.engine?.tabletop;

        // 1. 优先调用 Jumpgate 原生选区 API
        if (tt && typeof tt.getSelection === "function") {
            const selection = tt.getSelection() || [];
            for (const item of selection) {
                const tokenId = item.id;
                if (!tokenId || seen.has(tokenId)) continue;
                seen.add(tokenId);

                const tokenModel = item.model || Roll20Bridge.getTokenGraphic(tokenId);
                if (tokenModel) {
                    if (!Roll20Bridge.canViewTokenBuffs(tokenModel)) continue;
                    const charId = tokenModel.get("represents");
                    const char = charId ? window.Campaign?.characters?.get(charId) : null;
                    result.push({ token: tokenModel, char, name: tokenModel.get("name") || char?.get("name") || "Token" });
                }
            }
        }

        // 2. 兼顾 Fallback 回退通道（兼容传统画布或未就绪环境）
        if (result.length === 0) {
            const page = Roll20Bridge.getCurrentPage() || window.curPage;
            const selectedIds = window.selected_tokens || [];
            if (page && page.thegraphics && Array.isArray(selectedIds)) {
                for (const id of selectedIds) {
                    if (seen.has(id)) continue;
                    const token = page.thegraphics.get(id);
                    if (!token) continue;
                    if (!Roll20Bridge.canViewTokenBuffs(token)) continue;
                    seen.add(id);
                    const charId = token.get("represents");
                    const char = charId ? window.Campaign?.characters?.get(charId) : null;
                    result.push({ token, char, name: token.get("name") || char?.get("name") || "Token" });
                }
            }
        }

        return result;
    }

    /**
     * 更新布局展开方向（恢复自 v0.8.0）：以标题栏在屏幕上/下半区为纯粹基准
     * direction-up：面板停靠屏幕下半区时，内容抽屉在标题栏上方向上展开
     */
    /**
     * 落位与朝向判定（唯一实现）：
     * 比较标题栏下方到屏幕底部的剩余空间与面板高度——
     * 剩余空间更大 → 抽屉放标题栏之后（向下展开，top 锚定）；
     * 面板高度更大 → 抽屉挪到标题栏之前（direction-up 类翻转节点顺序，bottom 锚定），
     * 两种情况标题栏的屏幕位置都保持在 headerClientY 不动。
     * @param {number} headerClientY 标题栏目标屏幕 Y
     */
    static placePanel(headerClientY) {
        if (!this.panelEl) return;
        const headerEl = this.panelEl.querySelector(".r20-panel-header");
        const headerH = headerEl ? headerEl.offsetHeight : 30;
        const panelH = this._savedExpandedHeight || 380;
        const spaceBelow = window.innerHeight - headerClientY - headerH;

        // 节点顺序由 direction 类驱动（CSS: .direction-up { flex-direction: column-reverse }）
        this.isDirectionUp = spaceBelow < panelH;
        this.panelEl.classList.toggle("direction-up", this.isDirectionUp);
        this.panelEl.classList.toggle("direction-down", !this.isDirectionUp);

        // 锚定：向下锚标题栏顶边，向上锚标题栏底边，标题栏位置不动
        if (this.isDirectionUp) {
            this.panelEl.style.top = "auto";
            this.panelEl.style.bottom = `${Math.max(10, window.innerHeight - headerClientY - headerH)}px`;
        } else {
            this.panelEl.style.bottom = "auto";
            this.panelEl.style.top = `${Math.max(10, headerClientY)}px`;
        }
        if (!this.isCollapsed) {
            this.panelEl.style.height = `${panelH}px`;
        }
    }

    /**
     * 明确展开/折叠面板状态（规范高度状态机，避免遗留巨大空白黑框）
     */
    /**
     * 明确展开/折叠面板状态。
     * 统一几何模型：面板是唯一的尺寸载体（正常 flex 文档流）；向上展开 = 子节点
     * 顺序颠倒（direction-up 类 → column-reverse，抽屉在上、标题栏在下）+ 面板
     * 改用底边锚定（top:auto/bottom:X），标题栏在屏幕上的位置保持不动。
     */
    static setCollapse(collapsed) {
        if (!this.panelEl) return;
        this.isCollapsed = !!collapsed;
        const drawer = this.panelEl.querySelector(".r20-panel-content-drawer");
        const btn = this.panelEl.querySelector(".btn-toggle-collapse");
        this.panelEl.classList.toggle("is-collapsed", this.isCollapsed);

        if (this.isCollapsed) {
            if (drawer) drawer.style.display = "none";
            if (btn) btn.textContent = "▸";
            this.panelEl.style.height = "auto";
            this.panelEl.style.minHeight = "0px"; // 压过基础 CSS 的 min-height:200px，避免折叠后残留大白框
            return;
        }

        // 展开即落位：以标题栏当前位置为锚，朝向由「下方剩余空间 vs 面板高度」判定
        if (btn) btn.textContent = "▾";
        if (drawer) drawer.style.display = "";
        this.panelEl.style.minHeight = "";
        const headerEl = this.panelEl.querySelector(".r20-panel-header");
        this.placePanel(headerEl ? headerEl.getBoundingClientRect().top : this.panelEl.offsetTop);
    }

    /**
     * 切换展开/折叠面板
     */
    static toggleCollapse() {
        this.setCollapse(!this.isCollapsed);
    }

    /**
     * 窗口固定状态切换
     */
    static togglePin() {
        this.isPinned = !this.isPinned;
        localStorage.setItem(this.PIN_KEY, String(this.isPinned));
        this.updatePinState();
        if (this.isPinned) {
            this.setCollapse(false);
            this.showNotice("已固定面板（鼠标移开不自动收起）");
        } else {
            this.showNotice("已取消固定（鼠标移开后自动收起）");
        }
    }

    /**
     * 更新标题栏图钉按钮样式与提示
     */
    static updatePinState() {
        const pinBtn = this.panelEl?.querySelector(".btn-toggle-pin");
        if (pinBtn) {
            pinBtn.classList.toggle("pinned", this.isPinned);
            pinBtn.title = this.isPinned ? "已固定（鼠标移开不自动收起）" : "未固定（鼠标移开后自动收起）";
        }
    }

    /**
     * 悬浮吸附收起与展开（完整继承上一版成熟的鼠标悬停交互）
     */
    static initHoverCollapse() {
        let hoverTimer = null;
        this.panelEl.addEventListener("mouseenter", () => {
            if (hoverTimer) clearTimeout(hoverTimer);
            if (!this.isPinned && this.isCollapsed) {
                this.setCollapse(false);
            }
        });

        this.panelEl.addEventListener("mouseleave", () => {
            if (this._headerDragging) return; // 原生拖拽标题栏期间不自动折叠
            if (!this.isPinned && !this.isCollapsed) {
                hoverTimer = setTimeout(() => {
                    if (!this.isPinned) this.setCollapse(true);
                }, 400);
            }
        });
    }

    /**
     * 恢复面板位置与尺寸
     */
    static restorePanelPositionAndSize() {
        if (!this.panelEl) return;
        try {
            const savedPos = localStorage.getItem(this.POS_KEY);
            if (savedPos) {
                const { left, top } = JSON.parse(savedPos);
                // 恢复标题栏屏幕位置；朝向与锚定交由 setCollapse 展开时的 placePanel 统一判定
                this.panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, left))}px`;
                this.panelEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 40, top))}px`;
                this.panelEl.style.right = "auto";
                this.panelEl.style.bottom = "auto";
            } else {
                this.panelEl.style.top = "60px";
                this.panelEl.style.right = "80px";
                this.panelEl.style.left = "auto";
            }

            const savedSize = localStorage.getItem(this.SIZE_KEY);
            if (savedSize) {
                const { width, height } = JSON.parse(savedSize);
                this.panelEl.style.width = `${Math.max(280, Math.min(window.innerWidth - 20, width))}px`;
                // 高度唯一真源：只写入 _savedExpandedHeight（面板高度由 setCollapse 落位时统一设置）
                if (height > 50) {
                    this._savedExpandedHeight = Math.max(200, Math.min(window.innerHeight - 40, height));
                }
            }
        } catch (e) {}
    }

    /**
     * 保存面板位置与尺寸
     */
    static savePositionAndSize() {
        if (!this.panelEl) return;
        try {
            // 持久化标题栏的屏幕 Y（向上展开模式下面板 offsetTop 是盒子顶边而非标题栏）
            const headerEl = this.panelEl.querySelector(".r20-panel-header");
            localStorage.setItem(this.POS_KEY, JSON.stringify({
                left: this.panelEl.offsetLeft,
                top: headerEl ? Math.round(headerEl.getBoundingClientRect().top) : this.panelEl.offsetTop
            }));
            // 高度唯一真源：展开时面板可实测，折叠时沿用记忆高度
            if (!this.isCollapsed && this.panelEl.offsetHeight > 50) {
                this._savedExpandedHeight = this.panelEl.offsetHeight;
            }
            localStorage.setItem(this.SIZE_KEY, JSON.stringify({
                width: this.panelEl.offsetWidth,
                height: this._savedExpandedHeight || 380
            }));
        } catch (e) {}
    }

    /**
     * 弹出 Roll20 原生风格多列负面状态 (Debuff) 网格选择面板 (Popover Grid)
     */
    static showDebuffPopover(triggerBtn, target, onApplied) {
        const existing = document.querySelector(".r20-popover-grid-container");
        if (existing) {
            const wasSameTrigger = existing._triggerBtn === triggerBtn;
            existing._cleanup?.();
            existing.remove();
            if (wasSameTrigger) return;
        }

        const char = target?.type === "char" ? (target.char || window.Campaign?.characters?.get(target.id)) : null;
        const token = target?.type === "token"
            ? (target.token || Roll20Bridge.getTokenGraphic(target.id))
            : (target && typeof target.get === "function" ? target : null);
        const name = target?.name || (char ? char.get("name") : (token ? token.get("name") : "当前单位"));

        const popover = document.createElement("div");
        popover.className = "r20-popover-grid-container";
        popover._triggerBtn = triggerBtn;

        const defs = Pf1eBuffUI.PF1E_DEBUFF_DEFINITIONS;
        const itemsHtml = defs.map(d => `
            <div class="r20-popover-grid-item" data-key="${d.key}" title="${Roll20Bridge.escapeHtml(d.name)}">
                ${Roll20Bridge.escapeHtml(d.name)}
            </div>
        `).join("");

        popover.innerHTML = `
            <div class="r20-popover-grid-header">
                <span>添加负面状态 (${defs.length})</span>
                <button class="btn-close-popover" title="关闭">✕</button>
            </div>
            <div class="r20-popover-grid-body">
                ${itemsHtml}
            </div>
        `;

        document.body.appendChild(popover);

        // 计算定位坐标，就近挂载在触发按钮下方
        const rect = triggerBtn.getBoundingClientRect();
        const popWidth = 310;
        let left = rect.left;
        if (left + popWidth > window.innerWidth - 10) {
            left = Math.max(10, window.innerWidth - popWidth - 10);
        }
        let top = rect.bottom + 4;
        const popHeight = Math.min(290, popover.offsetHeight || 260);
        if (top + popHeight > window.innerHeight - 10) {
            top = Math.max(10, rect.top - popHeight - 4);
        }
        popover.style.left = `${Math.round(left)}px`;
        popover.style.top = `${Math.round(top)}px`;

        triggerBtn.classList.add("active");

        const closePopover = () => {
            triggerBtn.classList.remove("active");
            popover.remove();
            document.removeEventListener("mousedown", onOutsideClick, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
        popover._cleanup = closePopover;

        const onOutsideClick = (e) => {
            if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
                closePopover();
            }
        };

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                closePopover();
            }
        };

        document.addEventListener("mousedown", onOutsideClick, true);
        document.addEventListener("keydown", onKeyDown, true);

        popover.querySelector(".btn-close-popover")?.addEventListener("click", () => {
            closePopover();
        });

        popover.querySelectorAll(".r20-popover-grid-item").forEach(itemEl => {
            itemEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                const condKey = itemEl.dataset.key;
                const def = defs.find(d => d.key === condKey);
                const dName = def ? def.name : condKey;

                closePopover();

                if (char) {
                    await Pf1eBuffManager.addTrackedDebuff(char, condKey);
                    await Pf1eBuffManager.toggleCondition(char, condKey, false, 0);
                    BuffFloatingPanel.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                    await Pf1eBuffUI.refreshAllBadges();
                    if (onApplied) await onApplied();
                } else if (token) {
                    TokenBuffManager.addTrackedDebuff(token, {
                        key: condKey,
                        name: dName,
                        rounds: 0,
                        initRounds: 0,
                        enabled: false
                    });
                    BuffFloatingPanel.showNotice(`已为 [${name}] 添加状态 [${dName}] (0轮, 未激活)`);
                    await Pf1eBuffUI.refreshAllBadges();
                    if (onApplied) await onApplied();
                }
            });
        });
    }

    /**
     * 悬浮提示 Toast
     */
    static showNotice(msg) {
        let toast = document.querySelector(".r20-suite-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "r20-suite-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = "1";
        setTimeout(() => {
            toast.style.opacity = "0";
        }, 2200);
    }

    /**
     * 调出 Buff 编辑细目弹窗 (完整继承 e3a4247 原版：支持名称、初始轮数/公式、当前轮数与 JSON 加值细目字典)
     */
    static showBuffEditorDialog(existingNode = null, charTarget = null, tokenTarget = null) {
        document.querySelector(".r20-dialog-mask")?.remove();
        document.querySelector(".r20-buff-editor-dialog")?.remove();

        const isEditing = !!existingNode;
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentName = isEditing ? (existingNode.name || "") : "";
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

        const targetName = charTarget ? (charTarget.get("name") || "未命名角色") : "";
        const headerTitle = isEditing
            ? (charTarget ? `编辑单位 Buff 细目: ${escapeHtml(targetName)}` : "编辑 Buff 模板细目")
            : (charTarget ? `为 [${escapeHtml(targetName)}] 新建 Buff` : "新建 Buff");

        mask.innerHTML = `
            <div class="r20-dialog-box">
                <div class="r20-dialog-header">${headerTitle}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">Buff 名称:</label>
                    <input type="text" class="r20-input-text input-buff-name" value="${escapeHtml(currentName)}" placeholder="例如: 神恩、加速术..." />

                    <label style="font-size:11px; color:#b0bec5;">预置初始轮数 / 公式 (每次开启自动求值):</label>
                    <input type="text" class="r20-input-text input-buff-init-rounds" value="${escapeHtml(currentInitRounds)}" placeholder="例如: 10、@{level}*10、10+@{constitution_mod}" />
                    <span style="font-size:10px; color:#78909c;">支持常数或 @{attr} 属性引用公式，开启时借用 Roll20 原生引擎自动求值。</span>

                    <label style="font-size:11px; color:#b0bec5;">当前剩余轮数 (留空视为永久):</label>
                    <input type="number" class="r20-input-text input-buff-rounds" value="${escapeHtml(currentRounds)}" placeholder="留空或大于100视为永久" />

                    <label style="font-size:11px; color:#b0bec5;">PF1e 细目加值字典 (JSON 格式):</label>
                    <textarea class="r20-textarea-json input-buff-json">${escapeHtml(currentJson)}</textarea>
                    <span style="font-size:10px; color:#78909c;">提示: 可配置 b1_bonus, b1_bonustype, b1_val, b1_macro-text 等原生字段。</span>
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px; background:#37474f;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const name = mask.querySelector(".input-buff-name").value.trim();
            if (!name) {
                alert("请输入 Buff 名称");
                return;
            }

            const initRoundsVal = mask.querySelector(".input-buff-init-rounds").value.trim();
            const initRounds = initRoundsVal === "" ? null : initRoundsVal;

            const roundsVal = mask.querySelector(".input-buff-rounds").value.trim();
            const rounds = roundsVal === "" ? null : parseInt(roundsVal, 10);

            let extraAttrs = null;
            const jsonText = mask.querySelector(".input-buff-json").value.trim();
            if (jsonText) {
                try {
                    extraAttrs = JSON.parse(jsonText);
                } catch (err) {
                    alert("JSON 细目格式错误:\n" + err.message);
                    return;
                }
            }

            mask.remove();

            if (charTarget) {
                if (isEditing) {
                    const rowId = existingNode.rowId || existingNode.id;
                    await Pf1eBuffManager.updateBuffRow(charTarget, rowId, name, rounds, extraAttrs, initRounds);
                    const syncCount = await Pf1eBuffManager.broadcastDownstreamSync(charTarget, rowId);
                    if (syncCount > 0) {
                        this.showNotice(`✅ 已更新 [${name}] 细目，并自动同步至 ${syncCount} 个下游链接`);
                    } else {
                        this.showNotice(`✅ 已更新 [${name}] 细目`);
                    }
                } else {
                    const cleanAttrs = Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs);
                    await Pf1eBuffManager.addBuff(charTarget, name, rounds, cleanAttrs, initRounds);
                    this.showNotice(`✅ 已新增 Buff [${name}]`);
                }
                await Pf1eBuffUI.refreshAllBadges();
                await this.renderViewport();
            } else if (tokenTarget) {
                // 纯 Token：新增直接追加条目；编辑按原名称定位自定义字段中的条目后整体改写
                const list = TokenBuffManager.getTokenBuffs(tokenTarget);
                if (isEditing) {
                    const target = list.find(x => x.name === existingNode.name);
                    if (target) {
                        target.name = name;
                        target.rounds = rounds === "" ? null : rounds;
                        target.initRounds = initRounds === "" ? null : initRounds;
                        target.extraAttrs = Object.keys(extraAttrs).length > 0 ? extraAttrs : null;
                        this.showNotice(`✅ 已更新 Token Buff [${name}]`);
                    }
                } else {
                    list.push({
                        name,
                        rounds: rounds === "" ? null : rounds,
                        initRounds: initRounds === "" ? null : initRounds,
                        extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null
                    });
                    this.showNotice(`✅ 已新增 Token Buff [${name}]`);
                }
                TokenBuffManager.saveTokenBuffs(tokenTarget, list);
                await this.renderViewport();
            }
        });
    }
}

    // ==========================================
    // 17. 引擎主入口启动流程
    // ==========================================
    async function main() {
        try {
            console.log("[Roll20Suite] 正在等待 Roll20 Jumpgate 战役环境就绪...");
            const ready = await Roll20Bridge.waitForReady(30000);
            if (!ready) {
                console.error("[Roll20Suite] Roll20 Jumpgate 环境未就绪，停止初始化");
                showFatalErrorBanner("Roll20 战役环境未在 30 秒内就绪，脚本已停止初始化。请刷新页面重试。", null);
                return;
            }

            console.log("[Roll20Suite] Roll20 Jumpgate 环境就绪，开始挂载子系统...");

            // 0. 初始化无头重算沙箱服务
            try {
                await RecalcService.init();
                registerCleanup(() => RecalcService.destroy());
                console.log("[Roll20Suite] RecalcService 官方加值重算沙箱挂载成功");
            } catch (recalcErr) {
                console.error("[Roll20Suite] RecalcService 初始化异常:", recalcErr);
            }

            // 1. 初始化并挂载先攻追踪器
            try {
                const observer = new TurnOrderObserver();
                observer.on("turnStarted", async ({ startedTokenId, endedTokenId, isLocalUserAction }) => {
                    if (Roll20Bridge.isGM() && isLocalUserAction) {
                        try {
                            const tokenGraphic = Roll20Bridge.getTokenGraphic(startedTokenId);
                            if (tokenGraphic) {
                                const targetMode = Roll20Bridge.resolveBuffTargetMode(tokenGraphic);
                                if (targetMode.mode === "char" && targetMode.char) {
                                    await Pf1eBuffManager.decrementBuffs(targetMode.char);
                                } else {
                                    TokenBuffManager.decrementBuffs(tokenGraphic);
                                }
                            }
                        } catch (err) {
                            console.error("[Roll20Suite] 先攻回合开始扣减异常:", err);
                        }
                    }
                    await Pf1eBuffUI.refreshAllBadges();
                    await BuffFloatingPanel.renderAllPanes();
                });

                observer.on("turnReverted", async ({ revertedTokenId, oldList, isLocalUserAction }) => {
                    const targetTokenId = (oldList && oldList.length > 0) ? oldList[0].id : revertedTokenId;
                    if (Roll20Bridge.isGM() && isLocalUserAction) {
                        try {
                            const tokenGraphic = Roll20Bridge.getTokenGraphic(targetTokenId);
                            if (tokenGraphic) {
                                const targetMode = Roll20Bridge.resolveBuffTargetMode(tokenGraphic);
                                if (targetMode.mode === "char" && targetMode.char) {
                                    await Pf1eBuffManager.incrementBuffsOnTurnRevert(targetMode.char);
                                } else {
                                    TokenBuffManager.incrementBuffsOnTurnRevert(tokenGraphic);
                                }
                            }
                        } catch (err) {
                            console.error("[Roll20Suite] 先攻回退加回轮数异常:", err);
                        }
                    }
                    await Pf1eBuffUI.refreshAllBadges();
                    await BuffFloatingPanel.renderAllPanes();
                });

                observer.on("orderChanged", async () => {
                    await Pf1eBuffUI.refreshAllBadges();
                });

                observer.start();
                registerCleanup(() => observer.stop());
                console.log("[Roll20Suite] TurnOrderObserver 先攻监听器挂载成功");
            } catch (obsErr) {
                console.error("[Roll20Suite] 先攻追踪器初始化失败:", obsErr);
            }

            // 2. 初始化三态悬浮工作台
            try {
                await BuffFloatingPanel.init();
                registerCleanup(() => BuffFloatingPanel.destroy());
                console.log("[Roll20Suite] BuffFloatingPanel 状态工作台挂载成功");
            } catch (panelErr) {
                console.error("[Roll20Suite] 悬浮工作台初始化失败:", panelErr);
            }

            // 2.5 GM 链接拓扑自愈：每次以 GM 身份加载房间仅运行一次
            try {
                if (Roll20Bridge.isGM()) {
                    const healed = await Pf1eBuffManager.healDownstreamTopology();
                    console.log("[Roll20Suite] 链接拓扑自愈完成, 修复条目: " + healed);
                }
            } catch (healErr) {
                console.error("[Roll20Suite] 链接拓扑自愈异常:", healErr);
            }

            // 3. 启动先攻条 DOM 响应式监听与全量刷新
            try {
                Pf1eBuffUI.startObserver();
                registerCleanup(() => Pf1eBuffUI.stopObserver());
                await Pf1eBuffUI.refreshAllBadges();
                console.log("[Roll20Suite] Pf1eBuffUI 先攻徽章与 MutationObserver 挂载就绪");
            } catch (uiErr) {
                console.error("[Roll20Suite] 先攻条徽章挂载失败:", uiErr);
            }

            // 4. 启动官方人物卡 Buff 预置初始轮数增强注入器
            try {
                CharacterSheetBuffEnhancer.init();
                registerCleanup(() => CharacterSheetTitleCopier.destroy());
                console.log("[Roll20Suite] CharacterSheetBuffEnhancer 官方人物卡增强器挂载成功");
            } catch (enhancerErr) {
                console.error("[Roll20Suite] CharacterSheetBuffEnhancer 挂载异常:", enhancerErr);
            }

            // 5. 启动 Roll20 房间设置面板注入
            try {
                SuiteSettingsPanel.init();
                console.log("[Roll20Suite] SuiteSettingsPanel 设置面板注入成功");
            } catch (settingsErr) {
                console.error("[Roll20Suite] SuiteSettingsPanel 注入异常:", settingsErr);
            }

            // 6. 挂载命名空间供外部或开发者排查联动
            window.Roll20Suite = {
                __version: "0.9.28",
                __teardown: () => {
                    console.log("[Roll20Suite] 正在执行全系统注销与资源清理...");
                    while (cleanups.length > 0) {
                        const cleanup = cleanups.pop();
                        try {
                            cleanup();
                        } catch (e) {
                            console.error("[Roll20Suite] 清理回调执行异常:", e);
                        }
                    }
                },
                Roll20Bridge,
                RecalcService,
                BuffLifecycle,
                Pf1eBuffManager,
                SuiteConfigStore,
                TurnOrderObserver,
                TokenBuffManager,
                Pf1eBuffUI,
                CharacterSheetTitleCopier,
                CharacterSheetBuffEnhancer,
                BuffDetachedWindow,
                SuiteSettingsPanel,
                BuffFloatingPanel
            };

            console.log("[Roll20Suite] PF1e Turnorder Buff 引擎全部就绪！");
        } catch (fatalErr) {
            console.error("[Roll20Suite] 引擎主入口遭遇致命异常:", fatalErr);
            showFatalErrorBanner("初始化发生未捕获异常: " + (fatalErr ? fatalErr.message : "未知错误"), fatalErr);
        }
    }

    main().catch(e => {
        console.error("[Roll20Suite] main 未捕获 Promise 异常:", e);
        showFatalErrorBanner("main 运行时抛出未捕获 Promise 异常: " + (e ? e.message : "未知错误"), e);
    });
})();
