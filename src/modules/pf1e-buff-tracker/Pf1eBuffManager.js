import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eConditionRegistry, PF1E_CONDITIONS } from "./Pf1eConditionRegistry.js";

/**
 * Pf1eBuffManager.js
 * 负责扫描、添加、刷新、修改与关停 PF1e 角色卡上的原生 repeating_buff2 重复列表
 */
export class Pf1eBuffManager {
    /**
     * 脚本自主修改状态锁（为 true 时抑制外部属性监听器响应）
     */
    static isScriptMutating = false;

    /**
     * 声明式调和全局事务锁（防止多端事件回流震荡）
     */
    static isReconciling = false;

    /**
     * 待结算的棋子标记调和会话表 (Token ID -> { character, token, timestamp })
     */
    static pendingTokenReconciles = new Map();

    /**
     * 兜底定时器表
     */
    static tokenSafetyTimers = new Map();

    /**
     * 官方内置负面状态 (Conditions) 31 项白名单（精准匹配角色卡 UI，排除能量吸取与被纠缠联动派生的被缓慢）
     */
    static CONDITION_DEFINITIONS = {
        // 第一行 (15 项)
        "condition-Bleed": { zh: "流血", defaultTimed: true },
        "condition-Blinded": { zh: "目盲", defaultTimed: true },
        "condition-Cowering": { zh: "畏縮", defaultTimed: false },
        "condition-Dazed": { zh: "暈眩", defaultTimed: true },
        "condition-Dazzled": { zh: "目眩", defaultTimed: true },
        "condition-Dead": { zh: "死亡", defaultTimed: false },
        "condition-Deafened": { zh: "耳聾", defaultTimed: false },
        "condition-Disabled": { zh: "癱瘓", defaultTimed: false }, // UI 文本为瘫痪
        "condition-Drowning": { zh: "溺水", defaultTimed: true },
        "condition-Dying": { zh: "瀕死", defaultTimed: true },
        "condition-Entangled": { zh: "糾纏", defaultTimed: true },
        "condition-Exhausted": { zh: "力竭", defaultTimed: false },
        "condition-Fascinated": { zh: "迷魂", defaultTimed: true },
        "condition-Fatigued": { zh: "疲乏", defaultTimed: false },
        "condition-Flat-Footed": { zh: "措手不及", defaultTimed: false },

        // 第二行 (16 项)
        "condition-Grappled": { zh: "擒抱", defaultTimed: false },
        "condition-Helpless": { zh: "無助", defaultTimed: false },
        "condition-Incorporeal": { zh: "虛體", defaultTimed: false },
        "condition-Invisible": { zh: "隱形", defaultTimed: true },
        "condition-Nauseated": { zh: "反胃", defaultTimed: true },
        "condition-Paralyzed": { zh: "麻痺", defaultTimed: false }, // UI 文本为麻痹
        "condition-Petrified": { zh: "石化", defaultTimed: false },
        "condition-Pinned": { zh: "壓制", defaultTimed: false },
        "condition-Prone": { zh: "俯臥", defaultTimed: false }, // UI 文本为俯卧
        "condition-Fear": { zh: "恐懼", defaultTimed: true }, // UI 文本为恐懼 (任意)
        "condition-Sickened": { zh: "噁心", defaultTimed: true }, // UI 文本为噁心
        "condition-Stable": { zh: "穩定", defaultTimed: false }, // UI 文本为稳定
        "condition-Staggered": { zh: "恍惚", defaultTimed: true },
        "condition-Stunned": { zh: "Stunned", defaultTimed: true }, // UI 文本为 Stunned
        "condition-Suffocating": { zh: "窒息", defaultTimed: true },
        "condition-Unconscious": { zh: "昏迷", defaultTimed: false }
    };

    /**
     * 获取指定角色卡上所有当前处于激活状态的负面状态 (Conditions)
     * 负数轮数表示正计轮（已经过的轮数，如 -1 为第 1 轮，-2 为第 2 轮）
     * @param {object} character 
     * @returns {Promise<Array>}
     */
    static async getActiveConditions(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs || !character.attribs.models) return [];

        // 确保挂载属性变更监听，实现角色卡 Debuff 开关的实时捕获
        this.bindCharacterAttributeListeners(character);

        const conditions = [];

        // 全面遍历 PF1E_CONDITIONS 34 项状态注册表
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

    /**
     * 为指定角色绑定属性变动监听，捕获角色卡上开关 Debuff 的动作，单端静默同步棋子标记与先攻徽章
     */
    static bindCharacterAttributeListeners(character) {
        if (!character || !character.attribs || character._pf1eAttribsBound) return;
        character._pf1eAttribsBound = true;

        const handleAttributeMutation = async (attr, options) => {
            if (!attr) return;
            // 忽略脚本自主更新、批量修改或当前处于调和事务中，彻底切断震荡回路
            if (options?.byScript || Pf1eBuffManager.isScriptMutating || Pf1eBuffManager.isReconciling) return;

            const attrName = attr.get("name") || "";

            // 0. 响应常规 repeating_buff2_*_enable_toggle 开启，自动根据预置公式初始化轮数
            if (attrName.startsWith("repeating_buff2_") && attrName.endsWith("_enable_toggle")) {
                const isToggledOn = Number(attr.get("current")) === 1;
                if (isToggledOn) {
                    const prefix = attrName.replace("_enable_toggle", "");
                    const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
                    const curRounds = roundsAttr ? roundsAttr.get("current") : "";
                    const isRoundsEmpty = curRounds === "" || curRounds === null || Number(curRounds) === 0;

                    if (isRoundsEmpty) {
                        const initRoundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
                        const formula = initRoundsAttr ? initRoundsAttr.get("current") : "";
                        if (formula) {
                            const val = await Roll20Bridge.evalNativeFormula(formula, character);
                            if (val !== null && !isNaN(val)) {
                                console.log(`[Pf1eBuffManager] 角色卡开启 Buff (${prefix})，借用原生机制求值公式 [${formula}] = ${val}`);
                                if (!roundsAttr) {
                                    character.attribs.create({ name: `${prefix}_rounds`, current: val });
                                } else {
                                    roundsAttr.save({ current: val });
                                }
                            }
                        }
                    }
                }
                // 刷新代表该角色的先攻条徽章
                const page = Roll20Bridge.getCurrentPage();
                if (page && page.thegraphics) {
                    page.thegraphics.each(g => {
                        if (g.get("represents") === character.id) {
                            Pf1eBuffUI.requestTokenRefresh(g.id);
                        }
                    });
                }
                return;
            }

            // 仅对 condition- 开头的状态属性响应
            if (!attrName.startsWith("condition-")) return;
            // 忽略轮数属性本身的变动，仅关注开关值变动
            if (attrName.endsWith("_rounds")) return;

            console.log(`[Pf1eBuffManager] 捕获到角色 ${character.get("name")} 的 Debuff 开关变动: ${attrName} = ${attr.get("current")}`);

            // 1. 声明式调和棋子标记 (单向调和: character -> token)
            await Pf1eBuffManager.reconcileConditions(character, null, { origin: "character" });

            // 2. 刷新代表该角色的先攻条徽章
            const page = Roll20Bridge.getCurrentPage();
            if (page && page.thegraphics) {
                page.thegraphics.each(g => {
                    if (g.get("represents") === character.id) {
                        Pf1eBuffUI.requestTokenRefresh(g.id);
                    }
                });
            }
        };

        // 同时监听属性值变更 (change:current) 与卡面首次勾选新建属性 (add)
        character.attribs.on("change:current", handleAttributeMutation);
        character.attribs.on("add", (attr, collection, options) => handleAttributeMutation(attr, options));
    }

    /**
     * 设置或更新指定负面状态的已过轮数（负数存储）
     */
    static async setConditionRounds(character, condKey, rounds, options = {}) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const roundsKey = `${condKey}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);

        if (rounds === null || rounds === "" || isNaN(rounds)) {
            if (roundsAttr) roundsAttr.destroy();
            return;
        }

        // 统一负数正计轮规范：若用户传入 2，存为 -2
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

    /**
     * 关闭/解除指定负面状态
     */
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

    /**
     * 施加/激活指定负面状态（支持原生与补充状态，带默认正计轮）
     */
    static async applyCondition(character, condKey, rounds = -1, options = {}) {
        if (!character || !condKey) return;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const def = Pf1eConditionRegistry.find(condKey);
        const actualAttrKey = def?.attrKey || condKey;

        if (def?.isNativeSheet) {
            // 原生属性赋予标准惩罚值
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

    /**
     * 声明式多端状态调和引擎 (Declarative Condition Reconciliation Engine)
     * 遵循单向数据流与来源戳记准则，杜绝一切多端震荡与界面失焦。
     * @param {object} character Character Backbone 模型
     * @param {object} token Token Graphic Backbone 模型
     * @param {object} options 调和选项 { origin: "token" | "character" }
     */
    static async reconcileConditions(character, token = null, options = {}) {
        if (!character && !token) return;
        if (this.isReconciling) return;

        this.isReconciling = true;
        try {
            const origin = options.origin || "character";

            // 1. 若变动来源于棋子 (origin: "token")
            // 方案 A 会话生命周期感知：若标记栏处于打开状态，挂起调和，绝不修改角色卡与 DOM，保证选框永不失焦；
            // 待用户操作完毕关闭标记栏时，立即 0 延迟原子执行调和结算！
            if (origin === "token") {
                if (!token || !character) return;

                const isMarkerMenuOpen = !!document.querySelector(".markermenu");
                if (isMarkerMenuOpen) {
                    this.pendingTokenReconciles.set(token.id, { character, token, timestamp: Date.now() });
                    console.log(`[Pf1eBuffManager] 标记栏处于活动会话中，挂起调和请求，等待面板关闭后结算 (Token ID: ${token.id})`);

                    // 设置 5 秒防呆兜底定时器：若极端情况下未收到关闭事件，自动检查并安全结算
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

                // 标记栏未打开（宏调用、快捷键或外部调用），直接原子调和
                await this._executeTokenReconciliation(character, token);
                return;
            }

            // 2. 若变动来源于角色卡 (origin: "character")
            // 铁律：角色卡当前状态即为真理源，仅单向调和棋子标记！
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

                // 计算当前应该挂载的纯净 Tag 集合
                const activeConditions = await this.getActiveConditions(character);
                const desiredTags = new Set();
                for (const cond of activeConditions) {
                    const tag = Pf1eConditionRegistry.resolveMarkerTag(cond.key);
                    if (tag) desiredTags.add(tag);
                }

                for (const t of tokens) {
                    const currentStr = t.get("statusmarkers") || "";
                    const currentList = currentStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);

                    // 保留原有列表中未被解除的标记与非托管自定义标记，完全维持原有自然顺序
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

                    // 纯集合差异比对：若无差异，绝不触碰棋子，杜绝任何多余重写与弹窗失焦
                    const oldSet = new Set(currentList);
                    const newSet = new Set(preservedList);
                    const isIdentical = oldSet.size === newSet.size && [...oldSet].every(x => newSet.has(x));

                    if (!isIdentical) {
                        const newStr = preservedList.join(",");
                        console.log(`[Pf1eBuffManager] 调和棋子标记: ${currentStr} -> ${newStr}`);
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

    /**
     * 结算所有挂起的棋子调和会话（0 延迟原子执行）
     */
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
                console.error("[Pf1eBuffManager] 执行会话结算调和失败:", err);
            }
        }
    }

    /**
     * 棋子标记防抖结算后的底层原子调和
     * 仅单向将棋子上的标记变更落实到角色卡属性，绝对禁止反向修改棋子
     */
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

            // 解析棋子上所有已挂载的 tags 对应的负面状态属性 Key
            const desiredCondAttrKeys = new Set();
            for (const tag of currentTags) {
                const def = Pf1eConditionRegistry.find(tag);
                if (def && def.attrKey) {
                    desiredCondAttrKeys.add(def.attrKey);
                }
            }

            let characterChanged = false;

            // 遍历系统所有支持的 34 项状态注册表，进行 Diff 调和
            for (const def of Object.values(PF1E_CONDITIONS)) {
                const attrKey = def.attrKey;
                if (!attrKey) continue;

                const attr = character.attribs.models.find(a => a.get("name") === attrKey);
                const isCurrentlyActive = attr && attr.get("current") !== "0" && attr.get("current") !== 0 && attr.get("current") !== "" && attr.get("current") !== null && attr.get("current") !== undefined && attr.get("current") !== false;
                const shouldBeActive = desiredCondAttrKeys.has(attrKey);

                // 状态一致，无差异跳过
                if (isCurrentlyActive === shouldBeActive) continue;

                characterChanged = true;
                if (shouldBeActive) {
                    console.log(`[Pf1eBuffManager] 防抖结算调和: 激活 ${character.get("name")} 的 ${def.nameZh} (${attrKey})`);
                    const defaultVal = attrKey === "condition-Blinded" ? "2" : (attrKey === "condition-Prone" ? "4" : "1");
                    if (!attr) {
                        character.attribs.create({ name: attrKey, current: defaultVal });
                    } else {
                        attr.save({ current: defaultVal }, { byScript: true });
                    }
                    // 补齐默认正计轮 (-1)
                    const roundsKey = `${attrKey}_rounds`;
                    let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
                    if (!roundsAttr) {
                        character.attribs.create({ name: roundsKey, current: -1 });
                    } else {
                        roundsAttr.save({ current: -1 }, { byScript: true });
                    }
                } else {
                    console.log(`[Pf1eBuffManager] 防抖结算调和: 解除 ${character.get("name")} 的 ${def.nameZh} (${attrKey})`);
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

            // 仅刷新下游纯展示视图（先攻条徽章），棋子绝不碰触
            if (characterChanged) {
                Pf1eBuffUI.requestTokenRefresh(token.id);
            }
        } finally {
            queueMicrotask(() => {
                this.isReconciling = false;
            });
        }
    }

    /**
     * 将角色当前处于激活状态的负面效果同步到棋子标记 (单端管辖，尊重原生顺序，绝不颠倒重排)
     */
    static async syncTokenStatusmarkers(character, token = null) {
        return this.reconcileConditions(character, token, { origin: "character" });
    }
    static generateStandardRowId() {
        if (typeof window.generateUUID === "function") {
            return window.generateUUID();
        }
        // 回退实现：标准 Firebase/Roll20 Push ID 生成器
        const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
        let now = new Date().getTime();
        const timeStampChars = new Array(8);
        for (let i = 7; i >= 0; i--) {
            timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
            now = Math.floor(now / 64);
        }
        let id = timeStampChars.join("");
        for (let i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
        }
        return id;
    }

    /**
     * 获取指定角色卡上所有当前处于勾选激活状态的 Buff
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 激活的 Buff 列表
     */
    static async getActiveBuffs(character) {
        const allBuffs = await this.getAllBuffs(character);
        return allBuffs.filter(b => b.enabled);
    }

    /**
     * 获取指定角色卡上所有的 Buff（无论是否激活启动）
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 包含启动和未启动的全部 Buff 列表
     */
    static async getAllBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);

        const buffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 查找所有 repeating_buff2_*_name
        const nameAttrs = character.attribs.models.filter(a => {
            const name = a.get("name") || "";
            return name.startsWith("repeating_buff2_") && name.endsWith("_name");
        });

        for (const nameAttr of nameAttrs) {
            const fullName = nameAttr.get("name");
            const prefix = fullName.substring(0, fullName.lastIndexOf("_name"));
            const rowId = prefix.replace("repeating_buff2_", "");

            const toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
            const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            const initRoundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
            const buffTypeAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_bufftype`);

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
            const initRounds = initRoundsAttr && initRoundsAttr.get("current") !== "" ? String(initRoundsAttr.get("current")) : null;
            const buffType = buffTypeAttr ? buffTypeAttr.get("current") : "spell";

            // 提取该原生 Buff 条目下所有存储的扩展加值与修饰细目字典 (extraAttrs)
            const extraAttrs = {};
            const prefixWithUnderscore = `${prefix}_`;
            for (const attr of character.attribs.models) {
                const attrName = attr.get("name") || "";
                if (attrName.startsWith(prefixWithUnderscore)) {
                    const subKey = attrName.substring(prefixWithUnderscore.length);
                    if (
                        subKey !== "name" &&
                        subKey !== "enable_toggle" &&
                        subKey !== "rounds" &&
                        subKey !== "init_rounds" &&
                        subKey !== "tabcat" &&
                        subKey !== "tabcat2" &&
                        subKey !== "row_id"
                    ) {
                        const raw = attr.get("current");
                        if (raw !== "" && raw !== null && raw !== undefined) {
                            extraAttrs[subKey] = (!isNaN(Number(raw)) && typeof raw !== "boolean" && String(raw).trim() !== "") ? Number(raw) : raw;
                        }
                    }
                }
            }

            buffs.push({
                rowId,
                prefix,
                name,
                enabled,
                rounds: (rounds !== null && !isNaN(rounds)) ? rounds : null,
                initRounds: initRounds || null,
                buffType,
                extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null,
                toggleAttr: toggleAttr || null,
                roundsAttr: roundsAttr || null,
                initRoundsAttr: initRoundsAttr || null
            });
        }

        // 按照 Roll20 官方 _reporder_repeating_buff2 顺序重排
        const orderAttr = character.attribs.models.find(a => a.get("name") === "_reporder_repeating_buff2");
        if (orderAttr && orderAttr.get("current")) {
            const orderList = orderAttr.get("current").split(",").map(id => id.trim().toLowerCase()).filter(Boolean);
            const orderMap = new Map();
            orderList.forEach((id, idx) => orderMap.set(id, idx));

            buffs.sort((a, b) => {
                const idxA = orderMap.has(a.rowId.toLowerCase()) ? orderMap.get(a.rowId.toLowerCase()) : 9999;
                const idxB = orderMap.has(b.rowId.toLowerCase()) ? orderMap.get(b.rowId.toLowerCase()) : 9999;
                return idxA - idxB;
            });
        }

        return buffs;
    }

    /**
     * 触发角色卡的 Sheet Worker 全量重算 (PFSheet.recalculate)
     * 自动刷新攻击力、防御、豁免等所有骰子宏引用的计算属性
     * @param {object} character 
     */
    static async triggerRecalculate(character) {
        if (!character) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs) return;

        console.log(`[Pf1eBuffManager] 正在自动触发角色 [${character.get("name")}] 的加值重算 (recalc1)...`);

        // 1. 设置底层属性 recalc1 触发 Sheet Worker (on("change:recalc1"))
        let recalcAttr = character.attribs.models.find(a => a.get("name") === "recalc1");
        if (!recalcAttr) {
            character.attribs.create({ name: "recalc1", current: "1" });
        } else {
            if (recalcAttr.get("current") === "1" || recalcAttr.get("current") === 1) {
                recalcAttr.set({ current: "0" }, { silent: true });
            }
            recalcAttr.save({ current: "1" });
        }

        // 2. 检查是否有处于打开状态的人物卡窗口，如果有，直接触发 DOM 原生点击以加速双重响应
        try {
            const charId = character.id;
            const dialogs = document.querySelectorAll(`.characterdialog[data-characterid="${charId}"], .characterdialog`);
            dialogs.forEach(dlg => {
                const recalcBtn = dlg.querySelector('input[name="attr_recalc1"], input[name$="_recalc1"]');
                if (recalcBtn) {
                    recalcBtn.click();
                }
                const iframes = dlg.querySelectorAll("iframe");
                iframes.forEach(iframe => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow?.document;
                        const frameBtn = doc?.querySelector('input[name="attr_recalc1"], input[name$="_recalc1"]');
                        if (frameBtn) frameBtn.click();
                    } catch (e) {}
                });
            });
        } catch (domErr) {}
    }

    /**
     * 施加或刷新 Buff（核心幂等方法）
     * 1. 以名称判断：如果卡片中已有同名 Buff，直接启用 (_enable_toggle=1) 并刷新剩余轮数，保留其原有加值计算公式；
     * 2. 若无同名 Buff，则自动新建一行符合官方标准规范的原生 Buff 并激活。
     * @param {object} character Character 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数 (若为 null 且有预置公式，将借用原生求值自动计算)
     * @param {object|null} extraAttrs 额外的细目加值字典（如 b1_bonus, b1_val 等）
     * @param {string|null} initRounds 预置初始轮数或公式 (如 "10", "@{level}*10")
     */
    static async applyOrRefreshBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        // 遍历所有 repeating_buff2_*_name 寻找同名行
        const nameAttrs = character.attribs.models.filter(a => {
            const n = a.get("name") || "";
            return n.startsWith("repeating_buff2_") && n.endsWith("_name") && a.get("current") === cleanName;
        });

        if (nameAttrs.length > 0) {
            // 找到同名 Buff，直接启用并刷新轮数
            const nameAttr = nameAttrs[0];
            const prefix = nameAttr.get("name").replace("_name", "");
            const rowId = prefix.replace("repeating_buff2_", "");

            let toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
            if (!toggleAttr) {
                toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
            } else {
                toggleAttr.save({ current: 1 });
            }

            // 补全原生必需标签，防止角色卡报错
            this.ensureNativeRequiredAttrs(character, prefix, rowId);

            // 更新或保存预置初始轮数/公式
            if (initRounds !== null && initRounds !== undefined) {
                let initAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`);
                if (!initAttr) {
                    if (initRounds !== "") character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
                } else {
                    initAttr.save({ current: initRounds });
                }
            }

            let effectiveRounds = rounds;
            if (effectiveRounds === null || isNaN(effectiveRounds)) {
                // 借用原生机制求值预置公式
                const targetFormula = initRounds || (character.attribs.models.find(a => a.get("name") === `${prefix}_init_rounds`)?.get("current"));
                if (targetFormula) {
                    const evalVal = await Roll20Bridge.evalNativeFormula(targetFormula, character);
                    if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
                }
            }

            let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            if (effectiveRounds !== null && !isNaN(effectiveRounds)) {
                if (!roundsAttr) {
                    roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: Number(effectiveRounds), max: Number(effectiveRounds) });
                } else {
                    roundsAttr.save({ current: Number(effectiveRounds) });
                }
            } else if (roundsAttr) {
                // 设为常驻
                roundsAttr.save({ current: "" });
            }

            // 更新细目属性
            if (extraAttrs && typeof extraAttrs === "object") {
                for (const [k, v] of Object.entries(extraAttrs)) {
                    if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "row_id") continue;
                    const attrFullName = `${prefix}_${k}`;
                    let subAttr = character.attribs.models.find(a => a.get("name") === attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${effectiveRounds}`);
            await this.triggerRecalculate(character);
            return { rowId, prefix, name: cleanName, rounds: effectiveRounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs, initRounds);
            await this.triggerRecalculate(character);
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const cleanName = (buffName || "新Buff").trim();
        const rowId = this.generateStandardRowId();
        const prefix = `repeating_buff2_${rowId}`;

        // 写入原生必需的核心字段
        const nameAttr = character.attribs.create({ name: `${prefix}_name`, current: cleanName });
        const toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
        const typeAttr = character.attribs.create({ name: `${prefix}_bufftype`, current: "spell" });

        // 必需的原生分类与渲染控制标记（杜绝 "You must delete this row" 错误）
        character.attribs.create({ name: `${prefix}_tabcat`, current: "spell" });
        character.attribs.create({ name: `${prefix}_tabcat2`, current: "1" });
        character.attribs.create({ name: `${prefix}_description-show`, current: 1 });
        character.attribs.create({ name: `${prefix}_row_id`, current: rowId.toLowerCase() });

        // 保存初始预置轮数/公式
        if (initRounds !== null && initRounds !== undefined && initRounds !== "") {
            character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
        }

        let effectiveRounds = rounds;
        if ((effectiveRounds === null || isNaN(effectiveRounds)) && initRounds) {
            const evalVal = await Roll20Bridge.evalNativeFormula(initRounds, character);
            if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
        }

        let roundsAttr = null;
        if (effectiveRounds !== null && !isNaN(effectiveRounds) && effectiveRounds > 0) {
            roundsAttr = character.attribs.create({
                name: `${prefix}_rounds`,
                current: Number(effectiveRounds),
                max: Number(effectiveRounds)
            });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}], 轮数: ${effectiveRounds}`);
        return { rowId, prefix, name: cleanName, rounds: effectiveRounds, toggleAttr, roundsAttr };
    }

    /**
     * 辅助方法：确保一行 Buff 拥有原生角色卡所需的全部标准元属性
     */
    static ensureNativeRequiredAttrs(character, prefix, rowId) {
        const checkAndCreate = (subKey, defaultVal) => {
            const fullKey = `${prefix}_${subKey}`;
            let attr = character.attribs.models.find(a => a.get("name") === fullKey);
            if (!attr) {
                character.attribs.create({ name: fullKey, current: defaultVal });
            }
        };

        checkAndCreate("tabcat", "spell");
        checkAndCreate("tabcat2", "1");
        checkAndCreate("description-show", 1);
        checkAndCreate("row_id", rowId.toLowerCase());
    }

    /**
     * 切换/设置 Buff 的激活开关 (enable_toggle)
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     * @param {boolean|number} enable 是否激活
     */
    static async toggleBuff(character, rowId, enable = false) {
        if (!character) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;
        const lowerPrefix = `repeating_buff2_${rowId.toLowerCase()}`;

        let toggleAttr = character.attribs.models.find(a => {
            const n = a.get("name") || "";
            return n === `${targetPrefix}_enable_toggle` || n.toLowerCase() === `${lowerPrefix}_enable_toggle`;
        });

        const val = enable ? 1 : 0;
        if (!toggleAttr) {
            toggleAttr = character.attribs.create({ name: `${targetPrefix}_enable_toggle`, current: val });
        } else {
            toggleAttr.save({ current: val });
        }

        // 若开启，检查是否需自动根据预置公式初始化轮数
        if (enable) {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            const curVal = roundsAttr ? roundsAttr.get("current") : "";
            const isRoundsEmpty = curVal === "" || curVal === null || Number(curVal) === 0;

            if (isRoundsEmpty) {
                const initRoundsAttr = character.attribs.models.find(a => {
                    const n = a.get("name") || "";
                    return n === `${targetPrefix}_init_rounds` || n.toLowerCase() === `${lowerPrefix}_init_rounds`;
                });
                const formula = initRoundsAttr ? initRoundsAttr.get("current") : "";
                if (formula) {
                    const val = await Roll20Bridge.evalNativeFormula(formula, character);
                    if (val !== null && !isNaN(val)) {
                        console.log(`[Pf1eBuffManager] 启用 Buff (${rowId})，借用原生求值公式 [${formula}] = ${val}`);
                        if (!roundsAttr) {
                            character.attribs.create({ name: `${targetPrefix}_rounds`, current: val });
                        } else {
                            roundsAttr.save({ current: val });
                        }
                    }
                }
            }
        }

        // 若关停，同步将轮数重置清零，防止僵尸轮数残留
        if (!enable) {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            if (roundsAttr) roundsAttr.save({ current: 0 });
        }

        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})`);
        await this.triggerRecalculate(character);
        return true;
    }

    /**
     * 关停/解除指定角色身上的某个 Buff (基于 rowId)
     */
    static async removeBuff(character, rowId) {
        return this.toggleBuff(character, rowId, false);
    }

    /**
     * 关停/解除指定角色身上的同名 Buff (基于名称)
     */
    static async removeBuffByName(character, buffName) {
        if (!character || !buffName) return false;
        const buffs = await this.getAllBuffs(character);
        const cleanTarget = buffName.trim().toLowerCase();
        const target = buffs.find(b => (b.name || "").trim().toLowerCase() === cleanTarget && b.enabled);
        if (target && target.rowId) {
            return this.toggleBuff(character, target.rowId, false);
        }
        return false;
    }

    /**
     * 物理删除角色卡上的原生 repeating_buff2 一整行属性（彻底销毁，杜绝死灰复燃）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     */
    static async deleteBuffRowPermanently(character, rowId) {
        if (!character || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const prefixWithUnderscore = `${prefix}_`;
        const toDestroy = character.attribs.models.filter(a => {
            const n = a.get("name") || "";
            return n === prefix || n.startsWith(prefixWithUnderscore);
        });

        if (toDestroy.length === 0) return false;

        // 彻底物理销毁所有匹配的 Attribute 模型
        toDestroy.forEach(attr => attr.destroy());
        console.log(`[Pf1eBuffManager] 已物理彻底销毁 ${character.get("name")} 的 Buff [${rowId}] 共 ${toDestroy.length} 项原生属性`);
        await this.triggerRecalculate(character);
        return true;
    }

    /**
     * 为指定的 Buff 行设置/更新剩余轮数
     */
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

    /**
     * 更新指定角色卡上的单行 Buff 数据（名称、轮数与细目扩展加值字典）
     */
    static async updateBuffRow(character, rowId, name, rounds, extraAttrs, initRounds = null) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const prefixWithUnderscore = `${prefix}_`;

        // 1. 更新名称
        let nameAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_name`);
        if (!nameAttr) {
            nameAttr = character.attribs.create({ name: `${prefix}_name`, current: name });
        } else {
            nameAttr.save({ current: name });
        }

        // 2. 更新轮数
        let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
        const roundsVal = (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "";
        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: roundsVal });
        } else {
            roundsAttr.save({ current: roundsVal });
        }

        // 3. 更新预置初始轮数/公式
        if (initRounds !== null && initRounds !== undefined) {
            const initKey = `${prefix}_init_rounds`;
            let initAttr = character.attribs.models.find(a => a.get("name") === initKey);
            if (!initAttr) {
                if (initRounds !== "") character.attribs.create({ name: initKey, current: initRounds });
            } else {
                initAttr.save({ current: initRounds });
            }
        }

        // 4. 补全原生必需属性
        this.ensureNativeRequiredAttrs(character, prefix, rowId);

        // 5. 更新细目加值字典 (extraAttrs)
        if (extraAttrs && typeof extraAttrs === "object") {
            // 清理不在新 extraAttrs 中的旧扩展字段
            const preservedKeys = new Set(["name", "enable_toggle", "rounds", "init_rounds", "tabcat", "tabcat2", "row_id", "bufftype"]);
            for (const attr of [...character.attribs.models]) {
                const attrName = attr.get("name") || "";
                if (attrName.startsWith(prefixWithUnderscore)) {
                    const subKey = attrName.substring(prefixWithUnderscore.length);
                    if (!preservedKeys.has(subKey) && !(subKey in extraAttrs)) {
                        attr.destroy();
                    }
                }
            }

            // 写入或更新新的扩展字段
            for (const [subKey, val] of Object.entries(extraAttrs)) {
                const fullKey = `${prefix}_${subKey}`;
                let attr = character.attribs.models.find(a => a.get("name") === fullKey);
                if (!attr) {
                    character.attribs.create({ name: fullKey, current: val });
                } else {
                    attr.save({ current: val });
                }
            }
        }

        console.log(`[Pf1eBuffManager] 已更新 ${character.get("name")} 的 Buff [${name}] (${rowId})`);
        await this.triggerRecalculate(character);
        return true;
    }

    /**
     * 正向行动结束扣减活跃 Buff 轮数 (统一入口，兼容传入 Character 模型、Token 模型或 Token ID)
     */
    static async decrementBuffs(tokenOrChar) {
        let character = null;
        let token = null;

        if (typeof tokenOrChar === "string") {
            token = Roll20Bridge.getTokenGraphic(tokenOrChar);
            character = Roll20Bridge.getCharacterByToken(tokenOrChar);
        } else if (tokenOrChar && tokenOrChar.attribs) {
            character = tokenOrChar;
        } else if (tokenOrChar && typeof tokenOrChar.get === "function") {
            token = tokenOrChar;
            character = Roll20Bridge.getCharacterByToken(token);
        }

        if (!character) return [];

        this.isScriptMutating = true;
        try {
            const charName = character.get("name") || (token ? token.get("name") : "未知角色");
            const activeBuffs = await this.getActiveBuffs(character);
            const processed = [];

            // 1. 扣减常规正面 Buff (大于 0 归零时自动解除)
            for (const buff of activeBuffs) {
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const newRounds = buff.rounds - 1;

                if (newRounds <= 0) {
                    await this.removeBuff(character, buff.rowId);
                    processed.push({ name: buff.name, status: "expired", remaining: 0 });
                } else {
                    if (buff.roundsAttr) {
                        buff.roundsAttr.save({ current: newRounds }, { byScript: true });
                    } else {
                        await this.setBuffRounds(character, buff.rowId, newRounds);
                    }
                    processed.push({ name: buff.name, status: "decremented", remaining: newRounds });
                }
            }

            // 2. 推进负面状态轮数 (负数正计轮，rounds - 1，如 -1 -> -2)
            const activeConditions = await this.getActiveConditions(character);
            for (const cond of activeConditions) {
                if (cond.rounds === null || isNaN(cond.rounds)) continue;

                const newRounds = cond.rounds - 1; // 统一减法：-1 变为 -2
                if (cond.roundsAttr) {
                    cond.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setConditionRounds(character, cond.key, newRounds);
                }
                processed.push({ name: cond.name, status: "condition_advanced", elapsed: Math.abs(newRounds) });
            }

            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }
    }

    /**
     * 当角色行动结束时，扣减其身上所有已设置轮数的活跃 Buff (别名保持向前兼容)
     */
    static async tickBuffsOnTurnEnd(tokenId) {
        return this.decrementBuffs(tokenId);
    }

    /**
     * 反向倒先攻时，将被拉回排头的单位身上所有带轮数的 Buff 加回 1 轮
     */
    static async incrementBuffsOnTurnRevert(tokenOrChar) {
        let character = null;
        let token = null;

        if (typeof tokenOrChar === "string") {
            token = Roll20Bridge.getTokenGraphic(tokenOrChar);
            character = Roll20Bridge.getCharacterByToken(tokenOrChar);
        } else if (tokenOrChar && tokenOrChar.attribs) {
            character = tokenOrChar;
        } else if (tokenOrChar && typeof tokenOrChar.get === "function") {
            token = tokenOrChar;
            character = Roll20Bridge.getCharacterByToken(token);
        }

        if (!character) return [];

        this.isScriptMutating = true;
        try {
            const activeBuffs = await this.getActiveBuffs(character);
            const processed = [];

            // 1. 加回常规正面 Buff (rounds + 1)
            for (const buff of activeBuffs) {
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const newRounds = buff.rounds + 1;
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setBuffRounds(character, buff.rowId, newRounds);
                }
                processed.push({ name: buff.name, status: "incremented", remaining: newRounds });
            }

            // 2. 回退负面状态轮数 (rounds + 1，如 -2 -> -1)
            const activeConditions = await this.getActiveConditions(character);
            for (const cond of activeConditions) {
                if (cond.rounds === null || isNaN(cond.rounds)) continue;

                const newRounds = cond.rounds + 1; // 统一加法：-2 变为 -1
                if (cond.roundsAttr) {
                    cond.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setConditionRounds(character, cond.key, newRounds);
                }
                processed.push({ name: cond.name, status: "condition_reverted", elapsed: Math.abs(newRounds) });
            }

            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }

        console.log(`[Pf1eBuffManager] 先攻回退: 为 ${character.get("name")} 加回 Buff 轮数共 ${processed.length} 项`);
        return processed;
    }
}
