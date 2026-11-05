/**
 * Roll20Bridge.js
 * 封装与 Roll20 Jumpgate 现代架构的核心交互通道
 */
export class Roll20Bridge {
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
}
