// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.3.0
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，集成多级树状管理悬浮窗、拖拽排序、纯Token智能适配与同名幂等刷新
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.3.0...");

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
    // 3. TokenBuffManager (纯野怪 Token 状态引擎)
    // ==========================================
    class TokenBuffManager {
        static COMMENT_PREFIX = "<!--r20_buffs:";
        static COMMENT_SUFFIX = "-->";

        static getTokenBuffs(token) {
            if (!token) return [];
            const raw = token.get("gmnotes") || "";
            let decoded = "";
            try { decoded = decodeURIComponent(raw); } catch (e) { decoded = raw; }

            const startIdx = decoded.indexOf(this.COMMENT_PREFIX);
            if (startIdx === -1) {
                if (decoded.trim().startsWith("[") && decoded.trim().endsWith("]")) {
                    try { return JSON.parse(decoded.trim()); } catch (e) { return []; }
                }
                return [];
            }

            const endIdx = decoded.indexOf(this.COMMENT_SUFFIX, startIdx);
            if (endIdx === -1) return [];

            const jsonStr = decoded.substring(startIdx + this.COMMENT_PREFIX.length, endIdx);
            try { return JSON.parse(jsonStr); } catch (e) { return []; }
        }

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
                    newNotes = decoded.substring(0, startIdx) + jsonBlock + decoded.substring(endIdx + this.COMMENT_SUFFIX.length);
                } else {
                    newNotes = decoded.substring(0, startIdx) + jsonBlock;
                }
            } else {
                newNotes = decoded ? `${decoded}\n${jsonBlock}` : jsonBlock;
            }
            token.save({ gmnotes: encodeURIComponent(newNotes) });
        }

        static applyOrRefreshBuff(token, buffName, rounds = null) {
            if (!token) return false;
            const cleanName = (buffName || "").trim();
            if (!cleanName) return false;

            const buffs = this.getTokenBuffs(token);
            const existing = buffs.find(b => b.name === cleanName);

            if (existing) {
                existing.rounds = (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null;
                console.log(`[TokenBuffManager] Token [${token.get("name")}] 刷新同名 Buff [${cleanName}], 轮数: ${rounds}`);
            } else {
                buffs.push({
                    name: cleanName,
                    rounds: (rounds !== null && !isNaN(rounds)) ? Number(rounds) : null
                });
                console.log(`[TokenBuffManager] Token [${token.get("name")}] 新增 Buff [${cleanName}], 轮数: ${rounds}`);
            }

            this.saveTokenBuffs(token, buffs);
            return true;
        }

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
                    roundsAttr: roundsAttr || null
                });
            }

            return activeBuffs;
        }

        static async applyOrRefreshBuff(character, buffName, rounds = null) {
            if (!character) return null;
            await Roll20Bridge.ensureCharacterAttributes(character);

            const cleanName = (buffName || "").trim();
            if (!cleanName) return null;

            // 查找同名 Buff
            const nameAttrs = character.attribs.models.filter(a => {
                const n = a.get("name") || "";
                return n.startsWith("repeating_buff2_") && n.endsWith("_name") && a.get("current") === cleanName;
            });

            if (nameAttrs.length > 0) {
                // 已有同名，直接激活开关并刷新轮数
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
                    roundsAttr.save({ current: "" });
                }

                console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${rounds}`);
                return { rowId, prefix, name: cleanName, rounds, isRefreshed: true };
            } else {
                // 无同名，新增行
                const newBuff = await this.addBuff(character, cleanName, rounds);
                return { ...newBuff, isRefreshed: false };
            }
        }

        static async addBuff(character, buffName, rounds = null) {
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

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生 Buff [${cleanName}], 轮数: ${rounds}`);
            return { rowId, prefix, name: cleanName, rounds, toggleAttr, roundsAttr };
        }

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

        static async refreshAllBadges() {
            this.injectStyles();
            const tracker = document.querySelector(".turn-tracker");
            if (!tracker) return;

            const rows = tracker.querySelectorAll("li.token");
            for (const row of rows) {
                const tokenId = row.dataset.tokenid;
                if (tokenId) await this.refreshRowBadge(row, tokenId);
            }
        }

        static async refreshRowBadge(row, tokenId) {
            const nameEl = row.querySelector(".name");
            if (!nameEl) return;

            const token = Roll20Bridge.getTokenGraphic(tokenId);
            const character = Roll20Bridge.getCharacterByToken(tokenId);

            let activeBuffs = [];
            if (character) {
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
    class BuffFloatingPanel {
        static STORAGE_KEY = "r20_buff_templates_v3";
        static POS_KEY = "r20_buff_panel_pos";

        static isEditMode = false;
        static isCollapsed = false;
        static panelEl = null;
        static templates = [];

        static defaultTemplates = [
            {
                id: "f_divine",
                type: "folder",
                name: "常用神术",
                collapsed: false,
                children: [
                    { id: "b_divine_favor", type: "buff", name: "神恩", rounds: 5 },
                    { id: "b_bless", type: "buff", name: "祝福术", rounds: 10 },
                    { id: "b_prayer", type: "buff", name: "祈祷术", rounds: 5 },
                    {
                        id: "f_high_divine",
                        type: "folder",
                        name: "高阶神术",
                        collapsed: false,
                        children: [
                            { id: "b_righteous_might", type: "buff", name: "正气如虹", rounds: 10 },
                            { id: "b_holy_aura", type: "buff", name: "圣洁灵光", rounds: 10 }
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
                    { id: "b_haste", type: "buff", name: "加速术", rounds: 10 },
                    { id: "b_shield", type: "buff", name: "护盾术", rounds: 10 },
                    { id: "b_barkskin", type: "buff", name: "树皮术", rounds: 100 },
                    { id: "b_mage_armor", type: "buff", name: "法师护甲", rounds: 600 }
                ]
            },
            {
                id: "f_debuff",
                type: "folder",
                name: "负面与妨害",
                collapsed: false,
                children: [
                    { id: "b_entangled", type: "buff", name: "纠缠", rounds: 5 },
                    { id: "b_slow", type: "buff", name: "缓慢术", rounds: 10 }
                ]
            }
        ];

        static init() {
            this.loadTemplates();
            this.injectStyles();
            this.createPanelDOM();
            this.renderTree();
            this.initDragWindow();
            console.log("[BuffFloatingPanel] 悬浮面板已成功加载");
        }

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

        static saveTemplates() {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.templates));
        }

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

        static getSelectedControllableTokens() {
            if (!window.Campaign.engine || typeof window.Campaign.engine.getSelection !== "function") return [];
            const sel = window.Campaign.engine.getSelection();
            if (!Array.isArray(sel) || sel.length === 0) return [];

            const page = window.Campaign.pages.get(window.Campaign.get("playerpageid"));
            if (!page || !page.thegraphics) return [];

            const isGM = !!window.isGM;
            const myPlayerId = window.d20_player_id;
            const validTokens = [];

            for (const item of sel) {
                const tokenId = item.id;
                const token = page.thegraphics.get(tokenId);
                if (!token) continue;

                const charId = token.get("represents");
                if (charId) {
                    const char = window.Campaign.characters.get(charId);
                    if (char) {
                        const controlledBy = (char.get("controlledby") || "").split(",");
                        const canControl = isGM || controlledBy.includes("all") || controlledBy.includes(myPlayerId);
                        if (canControl) validTokens.push({ token, char, type: "character" });
                    }
                } else {
                    const controlledBy = (token.get("controlledby") || "").split(",");
                    const canControl = isGM || controlledBy.includes("all") || controlledBy.includes(myPlayerId);
                    if (canControl) validTokens.push({ token, char: null, type: "token" });
                }
            }

            return validTokens;
        }

        static injectStyles() {
            if (document.querySelector("#r20-floating-panel-styles")) return;
            const style = document.createElement("style");
            style.id = "r20-floating-panel-styles";
            style.textContent = `
                #r20-buff-panel {
                    position: fixed;
                    top: 80px;
                    right: 320px;
                    width: 290px;
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
                    font-size: 13px;
                    cursor: pointer;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                .r20-btn-icon:hover {
                    background: rgba(255,255,255,0.1);
                    color: #ffffff;
                }
                .r20-btn-icon.active {
                    background: #1565c0;
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
                    max-height: 380px;
                    overflow-y: auto;
                    padding: 6px 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
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
                .r20-drag-over { border-top: 2px solid #64b5f6 !important; }
                .r20-drag-into { background: rgba(25, 118, 210, 0.3) !important; }

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
            `;
            document.head.appendChild(style);
        }

        static createPanelDOM() {
            if (document.querySelector("#r20-buff-panel")) return;

            const panel = document.createElement("div");
            panel.id = "r20-buff-panel";

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
                        <span>Buff 模板库</span>
                    </div>
                    <div class="r20-panel-controls">
                        <button class="r20-btn-icon btn-toggle-edit" title="打开/关闭编辑与排序模式">✏️ 编辑</button>
                        <button class="r20-btn-icon btn-minimize" title="最小化收起">─</button>
                    </div>
                </div>
                <div class="r20-panel-body">
                    <div class="r20-panel-toolbar" style="display: none;">
                        <span style="color:#90a4ae;">编辑模式已开启</span>
                        <div style="display:flex; gap:6px;">
                            <button class="r20-btn-icon btn-new-buff" title="新建 Buff 模板">+ Buff</button>
                            <button class="r20-btn-icon btn-new-folder" title="新建文件夹">+ 目录</button>
                        </div>
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

            panel.querySelector(".btn-minimize").addEventListener("click", () => this.toggleCollapse());
            panel.querySelector(".btn-toggle-edit").addEventListener("click", () => this.toggleEditMode());

            panel.querySelector(".cb-select-all-buffs").addEventListener("change", (e) => {
                const checked = e.target.checked;
                panel.querySelectorAll(".r20-buff-item-cb").forEach(cb => cb.checked = checked);
            });

            panel.querySelector(".btn-batch-apply").addEventListener("click", () => this.applySelectedBuffs());
            panel.querySelector(".btn-new-buff").addEventListener("click", () => this.showNewBuffDialog());
            panel.querySelector(".btn-new-folder").addEventListener("click", () => this.showNewFolderDialog());
        }

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

        static renderTree() {
            const treeContainer = this.panelEl.querySelector(".r20-panel-tree");
            if (!treeContainer) return;
            treeContainer.innerHTML = "";

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
                                ${this.isEditMode ? `
                                    <div class="r20-item-actions">
                                        <button class="r20-btn-icon btn-edit-folder" title="重命名">✏️</button>
                                        <button class="r20-btn-icon btn-delete-folder" title="删除目录">🗑️</button>
                                    </div>
                                ` : ""}
                            </div>
                            <div class="r20-folder-children" style="display: ${isClosed ? 'none' : 'flex'};"></div>
                        `;

                        folderEl.querySelector(".r20-folder-title").addEventListener("click", (e) => {
                            e.stopPropagation();
                            node.collapsed = !node.collapsed;
                            this.saveTemplates();
                            this.renderTree();
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

                            folderEl.querySelector(".btn-delete-folder").addEventListener("click", (e) => {
                                e.stopPropagation();
                                if (confirm(`确定删除文件夹 [${node.name}] 及其内部所有 Buff 吗？`)) {
                                    this.deleteNodeById(node.id);
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

                        const showRounds = node.rounds !== null && node.rounds <= 100;
                        const roundsLabel = node.rounds === null ? "常驻" : (showRounds ? `${node.rounds}轮` : "常驻");

                        itemEl.innerHTML = `
                            <div class="r20-item-left">
                                ${!this.isEditMode ? `<input type="checkbox" class="r20-buff-item-cb" data-id="${node.id}" />` : ""}
                                <span class="r20-item-name">${node.name}</span>
                                <span class="r20-item-rounds">${roundsLabel}</span>
                            </div>
                            ${this.isEditMode ? `
                                <div class="r20-item-actions">
                                    <button class="r20-btn-icon btn-edit-buff" title="编辑">✏️</button>
                                    <button class="r20-btn-icon btn-clone-buff" title="复制">📋</button>
                                    <button class="r20-btn-icon btn-delete-buff" title="删除">🗑️</button>
                                </div>
                            ` : ""}
                        `;

                        if (!this.isEditMode) {
                            itemEl.addEventListener("click", (e) => {
                                if (e.target.tagName === "INPUT") return;
                                this.applySingleBuff(node.name, node.rounds);
                            });
                        } else {
                            itemEl.querySelector(".btn-edit-buff").addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.showEditBuffDialog(node);
                            });
                            itemEl.querySelector(".btn-clone-buff").addEventListener("click", (e) => {
                                e.stopPropagation();
                                this.cloneBuff(node, nodes, index);
                            });
                            itemEl.querySelector(".btn-delete-buff").addEventListener("click", (e) => {
                                e.stopPropagation();
                                if (confirm(`确定删除 Buff 模板 [${node.name}] 吗？`)) {
                                    nodes.splice(index, 1);
                                    this.saveTemplates();
                                    this.renderTree();
                                }
                            });

                            this.setupDragEvents(itemEl, node, nodes, index);
                        }

                        container.appendChild(itemEl);
                    }
                });
            };

            renderNodes(this.templates, treeContainer);
        }

        static async applySingleBuff(buffName, rounds) {
            const selected = this.getSelectedControllableTokens();
            if (selected.length === 0) {
                this.showToast("⚠️ 请先在画布上选择要施加 Buff 的棋子", "warn");
                return;
            }

            let appliedCount = 0;
            for (const item of selected) {
                if (item.type === "character" && item.char) {
                    await Pf1eBuffManager.applyOrRefreshBuff(item.char, buffName, rounds);
                    appliedCount++;
                } else if (item.type === "token" && item.token) {
                    TokenBuffManager.applyOrRefreshBuff(item.token, buffName, rounds);
                    appliedCount++;
                }
            }

            await Pf1eBuffUI.refreshAllBadges();
            const roundsText = rounds > 100 || rounds === null ? "常驻" : `${rounds}轮`;
            this.showToast(`✨ 已为 ${appliedCount} 个棋子施加 [${buffName} ${roundsText}]`, "success");
        }

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
                        await Pf1eBuffManager.applyOrRefreshBuff(target.char, buff.name, buff.rounds);
                    } else if (target.type === "token" && target.token) {
                        TokenBuffManager.applyOrRefreshBuff(target.token, buff.name, buff.rounds);
                    }
                }
            }

            await Pf1eBuffUI.refreshAllBadges();
            this.showToast(`🚀 已为 ${selectedTokens.length} 个棋子批量施加 ${buffsToApply.length} 项 Buff！`, "success");
        }

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
                sourceList.splice(sourceIdx, 1);

                if (node.type === "folder") {
                    node.children = node.children || [];
                    node.children.push(draggedNode);
                    node.collapsed = false;
                } else {
                    parentList.splice(index, 0, draggedNode);
                }

                this._draggedData = null;
                this.saveTemplates();
                this.renderTree();
            });
        }

        static deleteNodeById(id) {
            const removeRecursive = (list) => {
                for (let i = 0; i < list.length; i++) {
                    if (list[i].id === id) {
                        list.splice(i, 1);
                        return true;
                    }
                    if (list[i].children && removeRecursive(list[i].children)) return true;
                }
                return false;
            };
            removeRecursive(this.templates);
        }

        static cloneBuff(node, list, index) {
            const clone = {
                id: "b_" + Date.now(),
                type: "buff",
                name: `${node.name} (副本)`,
                rounds: node.rounds
            };
            list.splice(index + 1, 0, clone);
            this.saveTemplates();
            this.renderTree();
        }

        static showNewBuffDialog() {
            const name = prompt("请输入新 Buff 名称:");
            if (!name || !name.trim()) return;
            const roundsStr = prompt("请输入默认持续轮数 (大于100或留空视为常驻):", "10");
            const rounds = roundsStr && !isNaN(parseInt(roundsStr, 10)) ? parseInt(roundsStr, 10) : null;

            this.templates.push({
                id: "b_" + Date.now(),
                type: "buff",
                name: name.trim(),
                rounds
            });
            this.saveTemplates();
            this.renderTree();
        }

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

        static showEditBuffDialog(node) {
            const newName = prompt("修改 Buff 名称:", node.name);
            if (newName && newName.trim()) node.name = newName.trim();

            const currentRoundsStr = node.rounds !== null ? String(node.rounds) : "";
            const roundsStr = prompt("修改默认持续轮数 (大于100或留空视为常驻):", currentRoundsStr);
            if (roundsStr !== null) {
                node.rounds = roundsStr && !isNaN(parseInt(roundsStr, 10)) ? parseInt(roundsStr, 10) : null;
            }

            this.saveTemplates();
            this.renderTree();
        }

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
                    const newLeft = Math.max(10, Math.min(window.innerWidth - 300, initialX + dx));
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

        console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.3.0 全部就绪！");
    }

    main();
})();
