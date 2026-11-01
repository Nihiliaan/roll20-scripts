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

        const conditions = [];

        for (const [condKey, def] of Object.entries(this.CONDITION_DEFINITIONS)) {
            const attr = character.attribs.models.find(a => a.get("name") === condKey);
            if (!attr) continue;

            const val = attr.get("current");
            const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;

            if (isActive) {
                const roundsKey = `${condKey}_rounds`;
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
                    name: def.zh,
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
     * 设置或更新指定负面状态的已过轮数（负数存储）
     */
    static async setConditionRounds(character, condKey, rounds) {
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
        this.syncTokenStatusmarkers(character);
    }

    /**
     * 关闭/解除指定负面状态
     */
    static async removeCondition(character, condKey) {
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
        this.syncTokenStatusmarkers(character);
    }

    /**
     * 施加/激活指定负面状态（支持原生与补充状态，带默认正计轮）
     */
    static async applyCondition(character, condKey, rounds = -1) {
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

        await this.setConditionRounds(character, actualAttrKey, rounds);
        await this.syncTokenStatusmarkers(character);
    }

    /**
     * 将角色当前处于激活状态的负面效果同步到棋子标记 statusmarkers (绝不添加数字，纯图标)
     */
    static async syncTokenStatusmarkers(character, token = null) {
        if (!character) return;
        const page = Roll20Bridge.getCurrentPage();
        if (!page || !page.thegraphics) return;

        // 寻找所有代表此角色的 Token
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
            // 保留不属于 PF1e 状态字典的其它自定义标记
            const currentList = currentStr.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean);
            const merged = new Set(desiredTags);

            for (const item of currentList) {
                const baseName = item.split("::")[0];
                const isManaged = !!Pf1eConditionRegistry.find(baseName);
                if (!isManaged) {
                    merged.add(item);
                }
            }

            const newStr = Array.from(merged).join(",");
            if (currentStr !== newStr) {
                t.save({ statusmarkers: newStr }, { byScript: true });
            }
        }
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
            const buffTypeAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_bufftype`);

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
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
                buffType,
                extraAttrs: Object.keys(extraAttrs).length > 0 ? extraAttrs : null,
                toggleAttr: toggleAttr || null,
                roundsAttr: roundsAttr || null
            });
        }

        return buffs;
    }

    /**
     * 施加或刷新 Buff（核心幂等方法）
     * 1. 以名称判断：如果卡片中已有同名 Buff，直接启用 (_enable_toggle=1) 并刷新剩余轮数，保留其原有加值计算公式；
     * 2. 若无同名 Buff，则自动新建一行符合官方标准规范的原生 Buff 并激活。
     * @param {object} character Character 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数
     * @param {object|null} extraAttrs 额外的细目加值字典（如 b1_bonus, b1_val 等）
     */
    static async applyOrRefreshBuff(character, buffName, rounds = null, extraAttrs = null) {
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

            let roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);
            if (rounds !== null && !isNaN(rounds)) {
                if (!roundsAttr) {
                    roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: Number(rounds), max: Number(rounds) });
                } else {
                    roundsAttr.save({ current: Number(rounds) });
                }
            } else if (roundsAttr) {
                // 设为常驻
                roundsAttr.save({ current: "" });
            }

            // 更新细目属性
            if (extraAttrs && typeof extraAttrs === "object") {
                for (const [k, v] of Object.entries(extraAttrs)) {
                    if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "row_id") continue;
                    const attrFullName = `${prefix}_${k}`;
                    let subAttr = character.attribs.models.find(a => a.get("name") === attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 激活并刷新已有同名 Buff [${cleanName}], 轮数: ${rounds}`);
            return { rowId, prefix, name: cleanName, rounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs);
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null) {
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

        let roundsAttr = null;
        if (rounds !== null && !isNaN(rounds) && rounds > 0) {
            roundsAttr = character.attribs.create({
                name: `${prefix}_rounds`,
                current: Number(rounds),
                max: Number(rounds)
            });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}], 轮数: ${rounds}`);
        return { rowId, prefix, name: cleanName, rounds, toggleAttr, roundsAttr };
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

        // 若关停，同步将轮数重置清零，防止僵尸轮数残留
        if (!enable) {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            if (roundsAttr) roundsAttr.save({ current: 0 });
        }

        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})`);
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
    static async updateBuffRow(character, rowId, name, rounds, extraAttrs) {
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

        // 3. 补全原生必需属性
        this.ensureNativeRequiredAttrs(character, prefix, rowId);

        // 4. 更新细目加值字典 (extraAttrs)
        if (extraAttrs && typeof extraAttrs === "object") {
            // 清理不在新 extraAttrs 中的旧扩展字段
            const preservedKeys = new Set(["name", "enable_toggle", "rounds", "tabcat", "tabcat2", "row_id", "bufftype"]);
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
