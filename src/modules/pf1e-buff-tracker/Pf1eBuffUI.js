import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "./Pf1eBuffManager.js";

/**
 * Pf1eBuffUI.js
 * 负责在先攻条每一行中注入和刷新 Buff 胶囊徽章
 */
export class Pf1eBuffUI {
    static isStylesInjected = false;

    /**
     * 注入全局样式表
     */
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
                padding: 2px 6px;
                border-radius: 10px;
                cursor: pointer;
                user-select: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transition: transform 0.15s, filter 0.15s;
            }
            .r20-buff-pill:hover {
                transform: translateY(-1px);
                filter: brightness(1.15);
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

    /**
     * 刷新整个先攻条上所有可见 Token 的 Buff 徽章
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
     * 刷新单行的徽章
     * @param {HTMLElement} row li.token 节点
     * @param {string} tokenId Token ID
     */
    static async refreshRowBadge(row, tokenId) {
        const nameEl = row.querySelector(".name");
        if (!nameEl) return;

        const character = Roll20Bridge.getCharacterByToken(tokenId);
        if (!character) return;

        const activeBuffs = await Pf1eBuffManager.getActiveBuffs(character);

        // 获取或创建容器
        let container = row.querySelector(".r20-buff-container");
        if (!container) {
            container = document.createElement("span");
            container.className = "r20-buff-container";
            nameEl.appendChild(container);
        }

        // 清空旧节点重建
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

            // 点击可直接修改或设置剩余轮数
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
