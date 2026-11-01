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
