/**
 * Roll20Bridge.js
 * 封装与 Roll20 Jumpgate 现代架构的核心交互通道
 */
import { SuiteConfigStore } from "./SuiteConfigStore.js";
/**
 * 转义 HTML 特殊字符，防范 XSS 漏洞
 * @param {*} str 待转义的原始字符串
 * @returns {string} 转义后的安全字符串
 */
export function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export class Roll20Bridge {
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

    /**
     * 解析就地轮数输入（就地编辑 onCommit 样板的单行收敛）：
     * 数字直取；非常量字符串借用原生引擎求值（失败回退原文）；
     * 空输入 / 常驻 / 永久 / - 一律按 emptyValue 返回（char 轮数惯用 ""，Token 惯用 null）
     * @param {string} raw 用户输入原文
     * @param {object|null} character 求值上下文角色（可空）
     * @param {*} [emptyValue=""] 空语义值
     */
    static async parseRoundsInput(raw, character = null, emptyValue = "") {
        if (raw === "" || raw === "常驻" || raw === "永久" || raw === "-") return emptyValue;
        if (!isNaN(Number(raw))) return Number(raw);
        try {
            const evaled = await this.evalNativeFormula(raw, character);
            return (evaled !== null && !isNaN(Number(evaled))) ? Number(evaled) : raw;
        } catch (err) {
            return raw;
        }
    }
}
