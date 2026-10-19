// ==UserScript==
// @name         Roll20 Suite - PF1e Turnorder Buff Engine
// @namespace    https://github.com/nihil/roll20-scripts
// @version      0.2.0
// @description  Roll20 Jumpgate 现代架构下的回合制多Buff生命周期与先攻追踪引擎，支持批量添加、快速解除、紧凑双行显示与宏命令
// @author       Nihil & Antigravity
// @match        https://app.roll20.net/editor/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    console.log("[Roll20Suite] 启动 Roll20 Suite 外挂脚本引擎 v0.2.0...");

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
                    roundsAttr: roundsAttr || null
                });
            }

            return activeBuffs;
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

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增 Buff [${cleanName}], 轮数: ${rounds}`);
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
                if (buff.rounds === null) continue; // 常驻 Buff 不扣除

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
                    width: 16px;
                    height: 16px;
                    background: rgba(255, 255, 255, 0.08);
                    color: #90a4ae;
                    font-size: 11px;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-left: 4px;
                    vertical-align: middle;
                    transition: all 0.15s;
                }
                .r20-add-buff-btn:hover {
                    background: #2e7d32;
                    color: #ffffff;
                }
                .r20-header-batch-btn {
                    display: inline-flex;
                    align-items: center;
                    background: #1565c0;
                    color: #ffffff !important;
                    font-size: 11px;
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-left: 8px;
                    font-weight: 600;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                }
                .r20-header-batch-btn:hover {
                    background: #1976d2;
                }
                .r20-modal-mask {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.65);
                    z-index: 999999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .r20-modal-box {
                    background: #1e222b;
                    border: 1px solid #37474f;
                    border-radius: 6px;
                    padding: 16px;
                    width: 360px;
                    color: #eceff1;
                    font-family: sans-serif;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                }
                .r20-modal-title {
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 12px;
                    color: #90caf9;
                    border-bottom: 1px solid #263238;
                    padding-bottom: 6px;
                }
                .r20-modal-row { margin-bottom: 10px; }
                .r20-modal-label { display: block; font-size: 11px; color: #b0bec5; margin-bottom: 4px; }
                .r20-modal-input {
                    width: 100%; box-sizing: border-box; background: #12141a;
                    border: 1px solid #455a64; color: #ffffff; padding: 6px 8px;
                    border-radius: 4px; font-size: 12px;
                }
                .r20-modal-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
                .r20-tag-pill {
                    font-size: 10px; background: #263238; color: #b0bec5;
                    padding: 2px 6px; border-radius: 3px; cursor: pointer;
                }
                .r20-tag-pill:hover { background: #37474f; color: #ffffff; }
                .r20-modal-targets {
                    max-height: 120px; overflow-y: auto; background: #12141a;
                    border: 1px solid #37474f; border-radius: 4px; padding: 6px; margin-top: 4px;
                }
                .r20-target-item { display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 4px; }
                .r20-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
                .r20-btn {
                    padding: 5px 12px; border-radius: 4px; font-size: 11px;
                    cursor: pointer; border: none; font-weight: 500;
                }
                .r20-btn-primary { background: #1976d2; color: #fff; }
                .r20-btn-primary:hover { background: #2196f3; }
                .r20-btn-danger { background: #c62828; color: #fff; }
                .r20-btn-danger:hover { background: #d32f2f; }
                .r20-btn-cancel { background: #37474f; color: #cfd8dc; }
                .r20-btn-cancel:hover { background: #455a64; }
            `;
            document.head.appendChild(style);
            this.isStylesInjected = true;
        }

        static async refreshAllBadges() {
            this.injectStyles();
            const tracker = document.querySelector(".turn-tracker");
            if (!tracker) return;

            this.ensureHeaderBatchButton(tracker);

            const rows = tracker.querySelectorAll("li.token");
            for (const row of rows) {
                const tokenId = row.dataset.tokenid;
                if (tokenId) {
                    await this.refreshRowBadge(row, tokenId);
                }
            }
        }

        static ensureHeaderBatchButton(tracker) {
            let topBar = tracker.querySelector(".initiative_top_section") || tracker.querySelector(".block-submenu-header");
            if (!topBar) return;

            if (!topBar.querySelector(".r20-header-batch-btn")) {
                const btn = document.createElement("span");
                btn.className = "r20-header-batch-btn";
                btn.innerHTML = "+ 批量加Buff";
                btn.title = "勾选多个目标批量施加 Buff";
                btn.addEventListener("click", () => this.showBatchAddModal());
                topBar.appendChild(btn);
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
                    this.showBuffEditModal(character, buff, row, tokenId);
                });

                container.appendChild(pill);
            }

            let addBtn = row.querySelector(".r20-add-buff-btn");
            if (!addBtn) {
                addBtn = document.createElement("span");
                addBtn.className = "r20-add-buff-btn";
                addBtn.textContent = "+";
                addBtn.title = `为 ${character.get("name")} 添加新Buff`;
                addBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.showSingleAddModal(character, row, tokenId);
                });
                nameEl.appendChild(addBtn);
            }
        }

        static showBuffEditModal(character, buff, row, tokenId) {
            const charName = character.get("name");
            const mask = document.createElement("div");
            mask.className = "r20-modal-mask";

            mask.innerHTML = `
                <div class="r20-modal-box">
                    <div class="r20-modal-title">Buff 设置 - ${charName}</div>
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
                await Pf1eBuffManager.removeBuff(character, buff.rowId);
                mask.remove();
                await this.refreshRowBadge(row, tokenId);
            });
            mask.querySelector(".btn-save").addEventListener("click", async () => {
                const val = mask.querySelector(".edit-rounds-input").value.trim();
                const parsed = val === "" ? null : parseInt(val, 10);
                await Pf1eBuffManager.setBuffRounds(character, buff.rowId, parsed);
                mask.remove();
                await this.refreshRowBadge(row, tokenId);
            });
        }

        static showSingleAddModal(character, row, tokenId) {
            const charName = character.get("name");
            const mask = document.createElement("div");
            mask.className = "r20-modal-mask";

            const presets = ["神恩", "加速术", "祝福术", "护盾术", "牛之力量", "树皮术", "法师护甲", "祈祷术"];

            mask.innerHTML = `
                <div class="r20-modal-box">
                    <div class="r20-modal-title">添加 Buff - ${charName}</div>
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

                await Pf1eBuffManager.addBuff(character, name, rounds);
                mask.remove();
                await this.refreshRowBadge(row, tokenId);
            });
        }

        static showBatchAddModal() {
            const tracker = document.querySelector(".turn-tracker");
            if (!tracker) return;

            const rows = Array.from(tracker.querySelectorAll("li.token"));
            const targets = [];

            rows.forEach(row => {
                const tokenId = row.dataset.tokenid;
                const char = Roll20Bridge.getCharacterByToken(tokenId);
                const token = Roll20Bridge.getTokenGraphic(tokenId);
                if (char) {
                    targets.push({
                        tokenId,
                        charId: char.id,
                        char,
                        name: char.get("name") || (token ? token.get("name") : "未知单位")
                    });
                }
            });

            if (targets.length === 0) {
                alert("先攻列表中未找到绑定的有效角色卡！");
                return;
            }

            const presets = ["加速术", "祝福术", "祈祷术", "牛之力量", "英雄气概", "防护邪恶"];
            const mask = document.createElement("div");
            mask.className = "r20-modal-mask";

            mask.innerHTML = `
                <div class="r20-modal-box" style="width: 400px;">
                    <div class="r20-modal-title">批量施加 Buff</div>
                    <div class="r20-modal-row">
                        <label class="r20-modal-label">选择目标 (共 ${targets.length} 个单位)：
                            <a href="javascript:void(0)" class="btn-select-all" style="color: #64b5f6; font-size:10px; margin-left: 8px;">全选</a>
                            <a href="javascript:void(0)" class="btn-deselect-all" style="color: #64b5f6; font-size:10px; margin-left: 6px;">取消全选</a>
                        </label>
                        <div class="r20-modal-targets">
                            ${targets.map(t => `
                                <label class="r20-target-item">
                                    <input type="checkbox" class="target-cb" data-char-id="${t.charId}" checked />
                                    <span>${t.name}</span>
                                </label>
                            `).join("")}
                        </div>
                    </div>
                    <div class="r20-modal-row">
                        <label class="r20-modal-label">Buff 名称：</label>
                        <input type="text" class="r20-modal-input batch-name-input" placeholder="输入名称或点击下方快捷标签" />
                        <div class="r20-modal-tags">
                            ${presets.map(p => `<span class="r20-tag-pill">${p}</span>`).join("")}
                        </div>
                    </div>
                    <div class="r20-modal-row">
                        <label class="r20-modal-label">持续轮数 (默认10轮，大于100或留空视为常驻)：</label>
                        <input type="number" class="r20-modal-input batch-rounds-input" value="10" />
                    </div>
                    <div class="r20-modal-actions">
                        <button class="r20-btn r20-btn-cancel btn-cancel">取消</button>
                        <button class="r20-btn r20-btn-primary btn-confirm">批量应用</button>
                    </div>
                </div>
            `;

            document.body.appendChild(mask);

            mask.querySelector(".btn-select-all").addEventListener("click", () => {
                mask.querySelectorAll(".target-cb").forEach(cb => cb.checked = true);
            });
            mask.querySelector(".btn-deselect-all").addEventListener("click", () => {
                mask.querySelectorAll(".target-cb").forEach(cb => cb.checked = false);
            });

            mask.querySelectorAll(".r20-tag-pill").forEach(tag => {
                tag.addEventListener("click", () => {
                    mask.querySelector(".batch-name-input").value = tag.innerText;
                });
            });

            mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());
            mask.querySelector(".btn-confirm").addEventListener("click", async () => {
                const name = mask.querySelector(".batch-name-input").value.trim();
                if (!name) return;
                const roundsStr = mask.querySelector(".batch-rounds-input").value.trim();
                const rounds = roundsStr === "" ? null : parseInt(roundsStr, 10);

                const selectedBoxes = Array.from(mask.querySelectorAll(".target-cb:checked"));
                mask.remove();

                for (const box of selectedBoxes) {
                    const charId = box.dataset.charId;
                    const char = window.Campaign.characters.get(charId);
                    if (char) {
                        await Pf1eBuffManager.addBuff(char, name, rounds);
                    }
                }

                await this.refreshAllBadges();
            });
        }
    }

    // ==========================================
    // 5. 宏命令监听器 (!buff 快捷指令)
    // ==========================================
    function setupMacroCommands(observer) {
        const textarea = document.querySelector("#textchat-input textarea");
        if (!textarea) return;

        textarea.addEventListener("keydown", async (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                const text = textarea.value.trim();
                if (text.startsWith("!buff")) {
                    e.preventDefault();
                    e.stopPropagation();
                    textarea.value = "";

                    // 解析指令: !buff [名称] [轮数]
                    // 例如: !buff 加速术 10
                    const parts = text.split(/\s+/).slice(1);
                    if (parts.length === 0) {
                        console.warn("[Roll20Suite] !buff 格式错误，用法: !buff <名称> [轮数]");
                        return;
                    }
                    const buffName = parts[0];
                    const rounds = parts.length > 1 ? parseInt(parts[1], 10) : 10;

                    // 默认对当前先攻排头的角色施加
                    const headId = observer.getHeadTokenId();
                    if (!headId) {
                        alert("先攻列表中无活动单位！");
                        return;
                    }
                    const char = Roll20Bridge.getCharacterByToken(headId);
                    if (char) {
                        await Pf1eBuffManager.addBuff(char, buffName, rounds);
                        await Pf1eBuffUI.refreshAllBadges();
                        Roll20Bridge.sendChatMessage(`&{template:default} {{name=施加 Buff}} {{目标=${char.get("name")}}} {{效果=${buffName} (${rounds > 100 ? '常驻' : rounds + '轮'})}}`);
                    }
                }
            }
        }, true);
    }

    // ==========================================
    // 6. 核心装配与启动主入口
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

        observer.on("turnEnded", async ({ endedTokenId }) => {
            await Pf1eBuffManager.tickBuffsOnTurnEnd(endedTokenId);
            await Pf1eBuffUI.refreshAllBadges();
        });

        observer.on("orderChanged", async () => {
            setTimeout(async () => {
                await Pf1eBuffUI.refreshAllBadges();
            }, 60);
        });

        observer.start();
        setupMacroCommands(observer);

        setTimeout(async () => {
            await Pf1eBuffUI.refreshAllBadges();
        }, 800);

        console.log("[Roll20Suite] PF1e Turnorder Buff 引擎 v0.2.0 已就绪！");
    }

    main();
})();
