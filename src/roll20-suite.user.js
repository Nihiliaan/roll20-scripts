// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.1.0
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，深度联动 PF1e 角色卡原生 Buff
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎...");

    // ==========================================
    // 1. Roll20Bridge 核心通信层
    // ==========================================
    class Roll20Bridge {
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

        static getCampaign() {
            return window.Campaign;
        }

        static getTokenGraphic(tokenId, pageId = null) {
            const campaign = this.getCampaign();
            if (!campaign || !campaign.pages) return null;

            if (pageId) {
                const page = campaign.pages.get(pageId);
                return page && page.thegraphics ? page.thegraphics.get(tokenId) : null;
            }

            for (let i = 0; i < campaign.pages.length; i++) {
                const page = campaign.pages.at(i);
                if (page && page.thegraphics) {
                    const token = page.thegraphics.get(tokenId);
                    if (token) return token;
                }
            }
            return null;
        }

        static getCharacterByToken(tokenOrId) {
            const token = typeof tokenOrId === "string" ? this.getTokenGraphic(tokenOrId) : tokenOrId;
            if (!token) return null;
            const charId = token.get("represents");
            if (!charId) return null;
            const campaign = this.getCampaign();
            return campaign && campaign.characters ? campaign.characters.get(charId) : null;
        }

        static async ensureCharacterAttributes(character) {
            if (!character) return false;
            if (!character.attribs || character.attribs.length === 0) {
                if (typeof character.connectAttributesAndAbilities === "function") {
                    await character.connectAttributesAndAbilities();
                }
            }
            return true;
        }

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
    class TurnOrderObserver {
        constructor() {
            this.cachedOrder = [];
            this.listeners = { turnEnded: [], turnStarted: [], orderChanged: [] };
            this.isInitialized = false;
        }

        on(event, callback) {
            if (this.listeners[event]) this.listeners[event].push(callback);
        }

        start() {
            if (this.isInitialized || typeof window.Campaign === "undefined") return;
            const rawJson = window.Campaign.get("turnorder");
            this.cachedOrder = this.parseTurnorder(rawJson);

            window.Campaign.on("change:turnorder", (campaign, newJson) => {
                this.handleTurnorderChange(newJson);
            });

            this.isInitialized = true;
            console.log("[TurnOrderObserver] 先攻事件监听就绪");
        }

        parseTurnorder(jsonStr) {
            try { return JSON.parse(jsonStr || "[]"); } 
            catch (e) { return []; }
        }

        handleTurnorderChange(newJson) {
            const newList = this.parseTurnorder(newJson);
            const oldList = this.cachedOrder;

            if (newList.length === 0 || oldList.length !== newList.length) {
                this.cachedOrder = newList;
                this.emit("orderChanged", { newList, oldList });
                return;
            }

            // 循环左移：正向回合推进 [A, B, C] -> [B, C, A]
            const isNextTurn = (newList[newList.length - 1].id === oldList[0].id) &&
                               (newList[0].id === oldList[1].id);

            if (isNextTurn) {
                const endedTokenId = oldList[0].id;
                const startedTokenId = newList[0].id;
                this.emit("turnEnded", { endedTokenId, startedTokenId, oldList, newList });
                this.emit("turnStarted", { startedTokenId, endedTokenId, newList });
            }

            this.emit("orderChanged", { newList, oldList });
            this.cachedOrder = newList;
        }

        emit(event, data) {
            const callbacks = this.listeners[event] || [];
            for (const cb of callbacks) {
                try { cb(data); } catch (err) { console.error(`[TurnOrderObserver] 异常 [${event}]:`, err); }
            }
        }
    }

    // ==========================================
    // 3. Pf1eBuffManager 数据管理层
    // ==========================================
    class Pf1eBuffManager {
        static async getActiveBuffs(character) {
            if (!character) return [];
            await Roll20Bridge.ensureCharacterAttributes(character);

            const activeBuffs = [];
            if (!character.attribs || !character.attribs.models) return [];

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
                    roundsAttr: roundsAttr || null,
                    icon: buffType === "spell" ? "✨" : "🛡️"
                });
            }

            return activeBuffs;
        }

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

        static async tickBuffsOnTurnEnd(tokenId) {
            const token = Roll20Bridge.getTokenGraphic(tokenId);
            const character = Roll20Bridge.getCharacterByToken(tokenId);
            if (!character) return [];

            const charName = character.get("name") || (token ? token.get("name") : "未知角色");
            const activeBuffs = await this.getActiveBuffs(character);
            const processed = [];

            for (const buff of activeBuffs) {
                if (buff.rounds === null) continue; // 常驻 Buff 不扣除

                const newRounds = buff.rounds - 1;

                if (newRounds <= 0) {
                    // 轮数归零：自动关闭 PF1e 卡上的开关
                    buff.toggleAttr.save({ current: 0 });
                    if (buff.roundsAttr) buff.roundsAttr.save({ current: 0 });

                    // 广播消息
                    const msg = `&{template:default} {{name=Buff 持续时间结束}} {{角色=${charName}}} {{效果=${buff.name}}} {{状态=持续时间归零，已自动取消生效。}}`;
                    Roll20Bridge.sendChatMessage(msg);

                    processed.push({ name: buff.name, status: "expired" });
                    console.log(`[Pf1eBuffManager] ${charName} 的 Buff [${buff.name}] 持续时间归零，已自动解除`);
                } else {
                    // 扣减 1 轮
                    if (buff.roundsAttr) {
                        buff.roundsAttr.save({ current: newRounds });
                    } else {
                        await this.setBuffRounds(character, buff.rowId, newRounds);
                    }
                    processed.push({ name: buff.name, status: "decremented", remaining: newRounds });
                    console.log(`[Pf1eBuffManager] ${charName} 的 Buff [${buff.name}] 扣减 1 轮，剩余 ${newRounds} 轮`);
                }
            }

            return processed;
        }
    }

    // ==========================================
    // 4. Pf1eBuffUI 先攻条 UI 徽章渲染器
    // ==========================================
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
                    gap: 4px;
                    margin-left: 6px;
                    vertical-align: middle;
                }
                .r20-buff-pill {
                    display: inline-flex;
                    align-items: center;
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 500;
                    line-height: 1.2;
                    padding: 2px 7px;
                    border-radius: 10px;
                    cursor: pointer;
                    user-select: none;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    transition: transform 0.15s, filter 0.15s;
                }
                .r20-buff-pill:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.2);
                }
                .r20-buff-pill.permanent {
                    background: linear-gradient(135deg, #434343 0%, #282828 100%);
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .r20-buff-pill.expiring {
                    background: linear-gradient(135deg, #e53935 0%, #b71c1c 100%);
                    animation: pulse-warn 1.5s infinite;
                }
                @keyframes pulse-warn {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(style);
            this.isStylesInjected = true;
        }

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

        static async refreshRowBadge(row, tokenId) {
            const nameEl = row.querySelector(".name");
            if (!nameEl) return;

            const character = Roll20Bridge.getCharacterByToken(tokenId);
            if (!character) return;

            const activeBuffs = await Pf1eBuffManager.getActiveBuffs(character);

            let container = row.querySelector(".r20-buff-container");
            if (!container) {
                container = document.createElement("span");
                container.className = "r20-buff-container";
                nameEl.appendChild(container);
            }

            container.innerHTML = "";
            if (activeBuffs.length === 0) return;

            for (const buff of activeBuffs) {
                const pill = document.createElement("span");
                const isPerm = buff.rounds === null;
                const isExpiring = !isPerm && buff.rounds <= 1;

                pill.className = `r20-buff-pill ${isPerm ? "permanent" : ""} ${isExpiring ? "expiring" : ""}`;
                pill.title = isPerm ? `${buff.name} (常驻/未设轮数，点击设定)` : `${buff.name} (剩余 ${buff.rounds} 轮，点击修改)`;
                
                const roundsText = isPerm ? "常驻" : `${buff.rounds}轮`;
                pill.innerHTML = `${buff.icon} ${buff.name} <b>[${roundsText}]</b>`;

                pill.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const currentStr = isPerm ? "5" : String(buff.rounds);
                    const input = window.prompt(`【${character.get("name")}】Buff 设置\n修改 [${buff.name}] 的剩余轮数 (输入数字):`, currentStr);
                    if (input !== null) {
                        const parsed = parseInt(input, 10);
                        if (!isNaN(parsed) && parsed >= 0) {
                            await Pf1eBuffManager.setBuffRounds(character, buff.rowId, parsed);
                            await this.refreshRowBadge(row, tokenId);
                        }
                    }
                });

                container.appendChild(pill);
            }
        }
    }

    // ==========================================
    // 5. 核心装配与启动主入口
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

        // 1. 监听回合结束：触发 Buff 扣减
        observer.on("turnEnded", async ({ endedTokenId }) => {
            console.log(`[Roll20Suite] 行动结束，结算 Buff: ${endedTokenId}`);
            await Pf1eBuffManager.tickBuffsOnTurnEnd(endedTokenId);
            await Pf1eBuffUI.refreshAllBadges();
        });

        // 2. 监听先攻列表变动（排序、移位、推进）：刷新 UI 徽章
        observer.on("orderChanged", async () => {
            // 稍作延迟确保 Vue DOM 渲染完毕
            setTimeout(async () => {
                await Pf1eBuffUI.refreshAllBadges();
            }, 50);
        });

        observer.start();

        // 初次加载时刷新一次 UI
        setTimeout(async () => {
            await Pf1eBuffUI.refreshAllBadges();
        }, 1000);

        console.log("[Roll20Suite] PF1e Turnorder Buff 引擎已成功挂载运行！");
    }

    main();
})();
