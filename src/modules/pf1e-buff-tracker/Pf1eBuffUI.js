import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eBuffManager } from "./Pf1eBuffManager.js";

/**
 * Pf1eBuffUI.js
 * 负责在先攻条注入极致紧凑的 Buff 徽章、单体快捷加减、以及批量加 Buff 面板
 */
export class Pf1eBuffUI {
    static isStylesInjected = false;

    /**
     * 注入全局紧凑样式表与弹窗样式
     */
    static injectStyles() {
        if (this.isStylesInjected) return;
        const style = document.createElement("style");
        style.id = "pf1e-buff-tracker-styles";
        style.textContent = `
            /* 徽章容器：紧凑双行排版 */
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
            /* 徽章胶囊：极简、无图标、高密度 */
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
            /* 单行加 Buff 微型按钮 */
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
            /* 先攻窗口顶部批量按钮 */
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

            /* 通用模态弹窗 */
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
            .r20-modal-row {
                margin-bottom: 10px;
            }
            .r20-modal-label {
                display: block;
                font-size: 11px;
                color: #b0bec5;
                margin-bottom: 4px;
            }
            .r20-modal-input {
                width: 100%;
                box-sizing: border-box;
                background: #12141a;
                border: 1px solid #455a64;
                color: #ffffff;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            .r20-modal-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 6px;
            }
            .r20-tag-pill {
                font-size: 10px;
                background: #263238;
                color: #b0bec5;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
            }
            .r20-tag-pill:hover {
                background: #37474f;
                color: #ffffff;
            }
            .r20-modal-targets {
                max-height: 120px;
                overflow-y: auto;
                background: #12141a;
                border: 1px solid #37474f;
                border-radius: 4px;
                padding: 6px;
                margin-top: 4px;
            }
            .r20-target-item {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                margin-bottom: 4px;
            }
            .r20-modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 14px;
            }
            .r20-btn {
                padding: 5px 12px;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                border: none;
                font-weight: 500;
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

    /**
     * 刷新整个先攻条上的徽章与快捷按钮
     */
    static async refreshAllBadges() {
        this.injectStyles();
        const tracker = document.querySelector(".turn-tracker");
        if (!tracker) return;

        // 1. 确保顶部批量加 Buff 按钮存在
        this.ensureHeaderBatchButton(tracker);

        // 2. 遍历所有 Token 行
        const rows = tracker.querySelectorAll("li.token");
        for (const row of rows) {
            const tokenId = row.dataset.tokenid;
            if (tokenId) {
                await this.refreshRowBadge(row, tokenId);
            }
        }
    }

    /**
     * 在先攻窗口顶部注入【+批量加Buff】按钮
     */
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

    /**
     * 刷新单行徽章
     */
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

        // 1. 渲染徽章列表
        for (const buff of activeBuffs) {
            const pill = document.createElement("span");
            const isExpiring = buff.rounds !== null && buff.rounds <= 1;

            // 规则：大于 100 轮或未设轮数只显示文字，不显示轮数
            const showRounds = buff.rounds !== null && buff.rounds <= 100;
            const text = showRounds ? `${buff.name} ${buff.rounds}` : buff.name;

            pill.className = `r20-buff-pill-compact ${isExpiring ? "expiring" : ""}`;
            pill.title = `${buff.name} (剩余 ${buff.rounds !== null ? buff.rounds + '轮' : '常驻'})，点击修改或解除`;
            pill.textContent = text;

            // 点击徽章弹出修改/解除面板
            pill.addEventListener("click", (e) => {
                e.stopPropagation();
                this.showBuffEditModal(character, buff, row, tokenId);
            });

            container.appendChild(pill);
        }

        // 2. 渲染单行快捷 [+] 按钮
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

    /**
     * 弹出单项 Buff 修改与解除弹窗
     */
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

        // 事件绑定
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

    /**
     * 弹出单体快速加 Buff 弹窗
     */
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

        // 点击标签自动填入
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

    /**
     * 弹出批量加 Buff 弹窗 (多目标勾选)
     */
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
                        ${targets.map((t, idx) => `
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

        // 全选 / 取消全选
        mask.querySelector(".btn-select-all").addEventListener("click", () => {
            mask.querySelectorAll(".target-cb").forEach(cb => cb.checked = true);
        });
        mask.querySelector(".btn-deselect-all").addEventListener("click", () => {
            mask.querySelectorAll(".target-cb").forEach(cb => cb.checked = false);
        });

        // 标签填充
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

            // 获取选中的角色
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
