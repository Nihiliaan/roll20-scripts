import { Roll20Bridge } from "../../src/core/Roll20Bridge.js";
import { Pf1eConditionRegistry, PF1E_CONDITIONS } from "./Pf1eConditionRegistry.js";

/**
 * Pf1eConditionMarkerSync.js (ARCHIVED - 封存模块，不参与编译)
 * 原负责 PF1e 负面状态 (Debuff / Condition) 与 Roll20 棋子标记 (Token Status Markers) 的双向调和与同步
 * 按照用户指令已于 2026-11-05 彻底停用并封存于此。
 */
export class Pf1eConditionMarkerSync {
    static isReconciling = false;
    static pendingTokenReconciles = new Map();
    static tokenSafetyTimers = new Map();

    static CONDITION_DEFINITIONS = {
        "condition-Bleed": { zh: "流血", defaultTimed: true },
        "condition-Blinded": { zh: "目盲", defaultTimed: true },
        "condition-Cowering": { zh: "畏縮", defaultTimed: false },
        "condition-Dazed": { zh: "暈眩", defaultTimed: true },
        "condition-Dazzled": { zh: "目眩", defaultTimed: true },
        "condition-Dead": { zh: "死亡", defaultTimed: false },
        "condition-Deafened": { zh: "耳聾", defaultTimed: false },
        "condition-Disabled": { zh: "癱瘓", defaultTimed: false },
        "condition-Drowning": { zh: "溺水", defaultTimed: true },
        "condition-Dying": { zh: "瀕死", defaultTimed: true },
        "condition-Entangled": { zh: "糾纏", defaultTimed: true },
        "condition-Exhausted": { zh: "力竭", defaultTimed: false },
        "condition-Fascinated": { zh: "迷魂", defaultTimed: true },
        "condition-Fatigued": { zh: "疲乏", defaultTimed: false },
        "condition-Flat-Footed": { zh: "措手不及", defaultTimed: false },
        "condition-Grappled": { zh: "擒抱", defaultTimed: false },
        "condition-Helpless": { zh: "無助", defaultTimed: false },
        "condition-Incorporeal": { zh: "虛體", defaultTimed: false },
        "condition-Invisible": { zh: "隱形", defaultTimed: true },
        "condition-Nauseated": { zh: "反胃", defaultTimed: true },
        "condition-Paralyzed": { zh: "麻痺", defaultTimed: false },
        "condition-Petrified": { zh: "石化", defaultTimed: false },
        "condition-Pinned": { zh: "壓制", defaultTimed: false },
        "condition-Prone": { zh: "俯臥", defaultTimed: false },
        "condition-Fear": { zh: "恐懼", defaultTimed: true },
        "condition-Sickened": { zh: "噁心", defaultTimed: true },
        "condition-Stable": { zh: "穩定", defaultTimed: false },
        "condition-Staggered": { zh: "恍惚", defaultTimed: true },
        "condition-Stunned": { zh: "Stunned", defaultTimed: true },
        "condition-Suffocating": { zh: "窒息", defaultTimed: true },
        "condition-Unconscious": { zh: "昏迷", defaultTimed: false }
    };

    static async getActiveConditions(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs || !character.attribs.models) return [];

        const conditions = [];
        for (const def of Object.values(PF1E_CONDITIONS)) {
            const condKey = def.attrKey;
            if (!condKey) continue;

            const attr = character.attribs.models.find(a => a.get("name") === condKey);
            if (!attr) continue;

            const val = attr.get("current");
            const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;

            if (isActive) {
                const roundsKey = def.roundsKey || `${condKey}_rounds`;
                const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                let rounds = null;

                if (roundsAttr && roundsAttr.get("current") !== "" && roundsAttr.get("current") !== null) {
                    const rVal = Number(roundsAttr.get("current"));
                    if (!isNaN(rVal)) {
                        rounds = rVal;
                    }
                }

                conditions.push({
                    key: condKey,
                    name: def.nameZh,
                    isCondition: true,
                    isDebuff: true,
                    rounds,
                    roundsKey,
                    condAttr: attr,
                    roundsAttr
                });
            }
        }
        return conditions;
    }

    static async setConditionRounds(character, condKey, rounds, options = {}) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const roundsKey = `${condKey}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);

        if (rounds === null || rounds === "" || isNaN(rounds)) {
            if (roundsAttr) roundsAttr.destroy();
            return;
        }

        const storedVal = -Math.abs(Number(rounds));
        if (roundsAttr) {
            roundsAttr.save({ current: storedVal }, { byScript: true });
        } else {
            character.attribs.create({ name: roundsKey, current: storedVal });
        }

        if (!options.skipTokenSync) {
            await this.syncTokenStatusmarkers(character);
        }
    }

    static async removeCondition(character, condKey, options = {}) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const attr = character.attribs.models.find(a => a.get("name") === condKey);
        if (attr) {
            attr.save({ current: "0" }, { byScript: true });
        }
        const roundsKey = `${condKey}_rounds`;
        const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
        if (roundsAttr) {
            roundsAttr.destroy();
        }

        if (!options.skipTokenSync) {
            await this.syncTokenStatusmarkers(character);
        }
    }

    static async applyCondition(character, condKey, rounds = -1, options = {}) {
        if (!character || !condKey) return;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const def = Pf1eConditionRegistry.find(condKey);
        const actualAttrKey = def?.attrKey || condKey;

        if (def?.isNativeSheet) {
            const defaultVal = actualAttrKey === "condition-Blinded" ? "2" : (actualAttrKey === "condition-Prone" ? "4" : "1");
            let attr = character.attribs.models.find(a => a.get("name") === actualAttrKey);
            if (!attr) {
                character.attribs.create({ name: actualAttrKey, current: defaultVal });
            } else {
                attr.save({ current: defaultVal }, { byScript: true });
            }
        }

        await this.setConditionRounds(character, actualAttrKey, rounds, options);
    }

    static async reconcileConditions(character, token = null, options = {}) {
        if (!character && !token) return;
        if (this.isReconciling) return;

        this.isReconciling = true;
        try {
            const origin = options.origin || "character";

            if (origin === "token") {
                if (!token || !character) return;

                const isMarkerMenuOpen = !!document.querySelector(".markermenu");
                if (isMarkerMenuOpen) {
                    this.pendingTokenReconciles.set(token.id, { character, token, timestamp: Date.now() });
                    if (this.tokenSafetyTimers.has(token.id)) {
                        clearTimeout(this.tokenSafetyTimers.get(token.id));
                    }
                    const safetyTimer = setTimeout(() => {
                        this.tokenSafetyTimers.delete(token.id);
                        if (!document.querySelector(".markermenu")) {
                            this.flushPendingTokenReconciles();
                        }
                    }, 5000);
                    this.tokenSafetyTimers.set(token.id, safetyTimer);
                    return;
                }

                await this._executeTokenReconciliation(character, token);
                return;
            }

            if (origin === "character") {
                if (!character) return;
                const page = Roll20Bridge.getCurrentPage();
                if (!page || !page.thegraphics) return;

                const tokens = [];
                if (token) {
                    tokens.push(token);
                } else {
                    page.thegraphics.each(g => {
                        if (g.get("represents") === character.id) {
                            tokens.push(g);
                        }
                    });
                }

                if (tokens.length === 0) return;

                const activeConditions = await this.getActiveConditions(character);
                const desiredTags = new Set();
                for (const cond of activeConditions) {
                    const tag = Pf1eConditionRegistry.resolveMarkerTag(cond.key);
                    if (tag) desiredTags.add(tag);
                }

                for (const t of tokens) {
                    const currentStr = t.get("statusmarkers") || "";
                    const currentList = currentStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);

                    const remainingDesired = new Set(desiredTags);
                    const preservedList = [];
                    for (const item of currentList) {
                        const def = Pf1eConditionRegistry.find(item);
                        if (!def) {
                            preservedList.push(item);
                        } else {
                            const resolvedTag = Pf1eConditionRegistry.resolveMarkerTag(def.attrKey || def.id);
                            if (remainingDesired.has(item) || remainingDesired.has(resolvedTag)) {
                                preservedList.push(item);
                                remainingDesired.delete(item);
                                remainingDesired.delete(resolvedTag);
                            }
                        }
                    }

                    for (const tag of remainingDesired) {
                        preservedList.push(tag);
                    }

                    const oldSet = new Set(currentList);
                    const newSet = new Set(preservedList);
                    const isIdentical = oldSet.size === newSet.size && [...oldSet].every(x => newSet.has(x));

                    if (!isIdentical) {
                        const newStr = preservedList.join(",");
                        t.set({ statusmarkers: newStr }, { byScript: true });
                    }
                }
            }
        } finally {
            queueMicrotask(() => {
                this.isReconciling = false;
            });
        }
    }

    static async flushPendingTokenReconciles() {
        if (this.pendingTokenReconciles.size === 0) return;
        const entries = Array.from(this.pendingTokenReconciles.values());
        this.pendingTokenReconciles.clear();

        for (const item of entries) {
            try {
                if (this.tokenSafetyTimers.has(item.token.id)) {
                    clearTimeout(this.tokenSafetyTimers.get(item.token.id));
                    this.tokenSafetyTimers.delete(item.token.id);
                }
                await this._executeTokenReconciliation(item.character, item.token);
            } catch (err) {
                console.error("[Pf1eConditionMarkerSync] 执行会话结算调和失败:", err);
            }
        }
    }

    static async _executeTokenReconciliation(character, token) {
        if (!character || !token) return;
        this.isReconciling = true;
        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            const currentMarkersStr = token.get("statusmarkers") || "";
            const currentTags = currentMarkersStr
                .split(",")
                .map(s => s.trim().replace(/@\d+$/, ""))
                .filter(Boolean);

            const desiredCondAttrKeys = new Set();
            for (const tag of currentTags) {
                const def = Pf1eConditionRegistry.find(tag);
                if (def && def.attrKey) {
                    desiredCondAttrKeys.add(def.attrKey);
                }
            }

            for (const def of Object.values(PF1E_CONDITIONS)) {
                const attrKey = def.attrKey;
                if (!attrKey) continue;

                const attr = character.attribs.models.find(a => a.get("name") === attrKey);
                const isCurrentlyActive = attr && attr.get("current") !== "0" && attr.get("current") !== 0 && attr.get("current") !== "" && attr.get("current") !== null && attr.get("current") !== undefined && attr.get("current") !== false;
                const shouldBeActive = desiredCondAttrKeys.has(attrKey);

                if (isCurrentlyActive === shouldBeActive) continue;

                if (shouldBeActive) {
                    const defaultVal = attrKey === "condition-Blinded" ? "2" : (attrKey === "condition-Prone" ? "4" : "1");
                    if (!attr) {
                        character.attribs.create({ name: attrKey, current: defaultVal });
                    } else {
                        attr.save({ current: defaultVal }, { byScript: true });
                    }
                    const roundsKey = `${attrKey}_rounds`;
                    let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                    if (!roundsAttr) {
                        character.attribs.create({ name: roundsKey, current: -1 });
                    } else {
                        roundsAttr.save({ current: -1 }, { byScript: true });
                    }
                } else {
                    if (attr) {
                        attr.save({ current: "0" }, { byScript: true });
                    }
                    const roundsKey = `${attrKey}_rounds`;
                    const roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                    if (roundsAttr) {
                        roundsAttr.destroy();
                    }
                }
            }
        } finally {
            queueMicrotask(() => {
                this.isReconciling = false;
            });
        }
    }

    static async syncTokenStatusmarkers(character, token = null) {
        return this.reconcileConditions(character, token, { origin: "character" });
    }
}
