import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "./Pf1eBuffManager.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";

/**
 * Pf1eBuffUI.js
 * 负责在先攻条注入极致紧凑的双行 Buff 徽章，同时无缝支持人物卡与纯野怪 Token
 */
export class Pf1eBuffUI {
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
