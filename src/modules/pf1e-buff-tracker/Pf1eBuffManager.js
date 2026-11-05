import { Roll20Bridge } from "../../core/Roll20Bridge.js";

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
     * 为指定角色绑定属性变动监听，捕获卡面手动开启 Buff 的动作，自动按预置公式初始化轮数
     */
    static bindCharacterBuffFormulaListener(character) {
        if (!character || !character.attribs || character._pf1eBuffFormulaBound) return;
        character._pf1eBuffFormulaBound = true;

        const handleAttributeMutation = async (attr, options) => {
            if (!attr) return;
            if (options?.byScript || Pf1eBuffManager.isScriptMutating) return;

            const attrName = attr.get("name") || "";

            // 响应常规 repeating_buff2_*_enable_toggle 开启，自动根据预置公式初始化轮数
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
            }
        };

        character.attribs.on("change:current", handleAttributeMutation);
        character.attribs.on("add", (attr, collection, options) => handleAttributeMutation(attr, options));
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

            let linkChildren = [];
            if (extraAttrs.link_children) {
                try {
                    linkChildren = typeof extraAttrs.link_children === "string"
                        ? JSON.parse(extraAttrs.link_children)
                        : extraAttrs.link_children;
                } catch (e) {
                    linkChildren = [];
                }
            }

            // 拓扑自愈：若宿主未持久化 link_children 且自身为主 Buff，自动做一次同步内存反查
            if ((!Array.isArray(linkChildren) || linkChildren.length === 0) && !extraAttrs.link_host_id) {
                const chars = window.Campaign?.characters?.models || [];
                const discovered = [];
                for (const c of chars) {
                    if (!c.attribs || c.id === character.id) continue;
                    for (const a of c.attribs.models) {
                        const an = a.get("name") || "";
                        if (an.endsWith("_link_host_id") && a.get("current") === character.id) {
                            const pfx = an.replace("_link_host_id", "");
                            const srcAttr = c.attribs.models.find(m => m.get("name") === `${pfx}_link_source_row_id`);
                            if (srcAttr && srcAttr.get("current") === rowId) {
                                discovered.push({ charId: c.id, rowId: pfx.replace("repeating_buff2_", "") });
                            }
                        }
                    }
                }
                if (discovered.length > 0) {
                    linkChildren = discovered;
                    // 异步写回宿主属性，固化索引
                    const attrName = `${prefix}_link_children`;
                    const jsonStr = JSON.stringify(discovered);
                    let ca = character.attribs.models.find(m => m.get("name") === attrName);
                    if (!ca) {
                        character.attribs.create({ name: attrName, current: jsonStr });
                    } else {
                        ca.save({ current: jsonStr });
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
                initRoundsAttr: initRoundsAttr || null,
                linkHostId: extraAttrs.link_host_id || null,
                linkSourceRowId: extraAttrs.link_source_row_id || null,
                linkChildren: Array.isArray(linkChildren) ? linkChildren : []
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
     * 对角色卡上的 Repeating Buff 条目进行拖拽重排序
     * 遵循 Roll20 原生规范更新 _reporder_repeating_buff2
     * @param {object} character 
     * @param {string} sourceRowId 
     * @param {string} targetRowId 
     * @param {boolean} placeBefore 是否插入在目标之前
     */
    static async reorderBuffs(character, sourceRowId, targetRowId, placeBefore = true) {
        if (!character || !sourceRowId || !targetRowId || sourceRowId === targetRowId) return;
        await Roll20Bridge.ensureCharacterAttributes(character);
        if (!character.attribs || !character.attribs.models) return;

        const allBuffs = await this.getAllBuffs(character);
        let orderList = allBuffs.map(b => b.rowId.toLowerCase());

        const sId = sourceRowId.toLowerCase();
        const tId = targetRowId.toLowerCase();

        // 移除被拖拽项
        orderList = orderList.filter(id => id !== sId);

        // 定位目标项并插入
        const targetIdx = orderList.indexOf(tId);
        if (targetIdx === -1) {
            orderList.push(sId);
        } else {
            const insertIdx = placeBefore ? targetIdx : targetIdx + 1;
            orderList.splice(insertIdx, 0, sId);
        }

        const newOrderStr = orderList.join(",");
        let orderAttr = character.attribs.models.find(a => a.get("name") === "_reporder_repeating_buff2");
        if (orderAttr) {
            orderAttr.save({ current: newOrderStr });
        } else {
            character.attribs.create({
                name: "_reporder_repeating_buff2",
                current: newOrderStr,
                max: ""
            });
        }
        console.log(`[Pf1eBuffManager] 已更新角色 [${character.get("name")}] Buff 排序:`, newOrderStr);
        return orderList;
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

        // 恪守宿主原生能力规范：纯属性原子切换触发官方 Sheet Worker，绝不搞 DOM 穿透点击
        let recalcAttr = character.attribs.models.find(a => a.get("name") === "recalc1");
        if (!recalcAttr) {
            character.attribs.create({ name: "recalc1", current: "1" });
        } else {
            const cur = recalcAttr.get("current");
            const nextVal = (cur === "1" || cur === 1) ? "0" : "1";
            recalcAttr.save({ current: nextVal }, { silent: false });
        }
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

            // 若本次刷新为独立普通副本（未包含 link_host_id），清除该条目可能残留的旧影子链接
            if (!extraAttrs || !extraAttrs.link_host_id) {
                const oldHostAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_host_id`);
                const oldSrcAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_source_row_id`);
                const oldHostId = oldHostAttr ? oldHostAttr.get("current") : null;
                const oldSrcRowId = oldSrcAttr ? oldSrcAttr.get("current") : null;
                if (oldHostAttr) oldHostAttr.destroy();
                if (oldSrcAttr) oldSrcAttr.destroy();
                if (oldHostId && oldSrcRowId) {
                    const oldHostChar = window.Campaign?.characters?.get(oldHostId);
                    if (oldHostChar) {
                        await this.removeDownstreamLink(oldHostChar, oldSrcRowId, character.id, rowId);
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
     * 将指定 Buff 的当前剩余轮数原子级重置为其预置初始轮数 (init_rounds)
     * 无论 Buff 以何种方式被激活（面板复选框、右键菜单、批量施加、原生人物卡勾选等），统一调用此单一收敛入口！
     * 自动支持公式求值（如 @{level}*10、10+@{constitution_mod} 等）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId Buff 唯一行标识
     * @returns {Promise<number|null>} 重置后的轮数值（若无初始轮数或求值失败则返回 null）
     */
    static async resetBuffRoundsToInitial(character, rowId) {
        if (!character || !rowId) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;
        const lowerPrefix = `repeating_buff2_${rowId.toLowerCase()}`;

        // 1. 读取该 Buff 的预置初始轮数/公式 (init_rounds)
        const initRoundsAttr = character.attribs.models.find(a => {
            const n = a.get("name") || "";
            return n === `${targetPrefix}_init_rounds` || n.toLowerCase() === `${lowerPrefix}_init_rounds`;
        });

        const formula = initRoundsAttr ? String(initRoundsAttr.get("current") ?? "").trim() : "";
        let finalRounds = null;

        if (formula !== "") {
            // 若为纯数字字符串直接解析，避免多余的原生求值开销
            if (!isNaN(Number(formula))) {
                finalRounds = Number(formula);
            } else {
                // 借助宿主原生能力进行公式求值
                const evalResult = await Roll20Bridge.evalNativeFormula(formula, character);
                if (evalResult !== null && !isNaN(evalResult)) {
                    finalRounds = Number(evalResult);
                }
            }
        }

        // 2. 找到或创建当前剩余轮数属性 (rounds) 并赋值
        let roundsAttr = character.attribs.models.find(a => {
            const n = a.get("name") || "";
            return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
        });

        if (finalRounds !== null && !isNaN(finalRounds)) {
            if (!roundsAttr) {
                roundsAttr = character.attribs.create({
                    name: `${targetPrefix}_rounds`,
                    current: finalRounds,
                    max: finalRounds
                });
            } else {
                roundsAttr.save({ current: finalRounds, max: finalRounds });
            }
            console.log(`[Pf1eBuffManager] Buff (${rowId}) 激活合流：当前轮数已重置为初始轮数 [${formula}] = ${finalRounds}`);
        } else {
            // 若没有预置初始轮数（即常驻 Buff），确保清除残留数字，保持为 null/空
            if (roundsAttr && roundsAttr.get("current") !== "") {
                roundsAttr.save({ current: "" });
            }
        }

        return finalRounds;
    }

    /**
     * 切换/设置 Buff 的激活开关 (enable_toggle)
     * 遵循“自定义数据联动宿主行为合流原则”：将设置轮数、开启开关、加值重算、下游广播合并在一个原子行动中执行！
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     * @param {boolean|number} enable 是否激活
     */
    static async toggleBuff(character, rowId, enable = false) {
        if (!character || !rowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const targetPrefix = `repeating_buff2_${rowId}`;
        const lowerPrefix = `repeating_buff2_${rowId.toLowerCase()}`;

        // 合并行动一：若开启，强制原子重置为初始满轮数；若关停，轮数清零防僵尸残留
        if (enable) {
            await this.resetBuffRoundsToInitial(character, rowId);
        } else {
            const roundsAttr = character.attribs.models.find(a => {
                const n = a.get("name") || "";
                return n === `${targetPrefix}_rounds` || n.toLowerCase() === `${lowerPrefix}_rounds`;
            });
            if (roundsAttr && roundsAttr.get("current") !== 0 && roundsAttr.get("current") !== "0") {
                roundsAttr.save({ current: 0 });
            }
        }

        // 合并行动二：设置原生激活开关 enable_toggle
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

        // 合并行动三：驱动官方加值重算管线 (让官方脚本去给整张人物卡设置加值/减值)
        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})，正在联动重算加值...`);
        await this.triggerRecalculate(character);

        // 合并行动四：自动广播同步下游受术者副本
        await this.broadcastDownstreamSync(character, rowId);

        return true;
    }

    /**
     * PF1e 官方人物卡 31 项原生负面状态 (Conditions / Debuffs) 字典
     */
    static PF1E_DEBUFF_DEFINITIONS = [
        { key: "condition-Bleed", name: "流血" },
        { key: "condition-Blinded", name: "目盲" },
        { key: "condition-Cowering", name: "畏縮" },
        { key: "condition-Dazed", name: "暈眩" },
        { key: "condition-Dazzled", name: "目眩" },
        { key: "condition-Dead", name: "死亡" },
        { key: "condition-Deafened", name: "耳聾" },
        { key: "condition-Disabled", name: "癱瘓" },
        { key: "condition-Drowning", name: "溺水" },
        { key: "condition-Dying", name: "瀕死" },
        { key: "condition-Entangled", name: "糾纏" },
        { key: "condition-Exhausted", name: "力竭" },
        { key: "condition-Fascinated", name: "迷魂" },
        { key: "condition-Fatigued", name: "疲乏" },
        { key: "condition-Flat-Footed", name: "措手不及" },
        { key: "condition-Grappled", name: "擒抱" },
        { key: "condition-Helpless", name: "無助" },
        { key: "condition-Incorporeal", name: "虛體" },
        { key: "condition-Invisible", name: "隱形" },
        { key: "condition-Nauseated", name: "反胃" },
        { key: "condition-Paralyzed", name: "麻痺" },
        { key: "condition-Petrified", name: "石化" },
        { key: "condition-Pinned", name: "壓制" },
        { key: "condition-Prone", name: "俯臥" },
        { key: "condition-Fear", name: "恐懼" },
        { key: "condition-Sickened", name: "噁心" },
        { key: "condition-Stable", name: "穩定" },
        { key: "condition-Staggered", name: "恍惚" },
        { key: "condition-Stunned", name: "震懾" },
        { key: "condition-Suffocating", name: "窒息" },
        { key: "condition-Unconscious", name: "昏迷" }
    ];

    /**
     * 切换/设置原生 Condition 负面状态 (Debuff)
     * @param {object} character Character Backbone 模型
     * @param {string} conditionKey 如 "condition-Bleed"
     * @param {boolean} enable 是否开启
     * @param {number|null} rounds 持续轮数 (可选)
     */
    /**
     * 获取人物卡上已明确登记的 Debuff 列表
     * @param {object} character Character Backbone 模型
     * @returns {string[]} conditionKey 数组
     */
    static getTrackedDebuffs(character) {
        if (!character || !character.attribs) return [];
        const attr = character.attribs.models.find(a => a.get("name") === "tracked_debuffs");
        if (!attr || !attr.get("current")) return [];
        try {
            const parsed = JSON.parse(attr.get("current"));
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * 将某个 Debuff 登记到人物卡的 tracked_debuffs 属性中
     */
    static async addTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        let attr = character.attribs.models.find(a => a.get("name") === "tracked_debuffs");
        let list = [];
        if (attr && attr.get("current")) {
            try { list = JSON.parse(attr.get("current")); } catch (e) { list = []; }
        }
        if (!Array.isArray(list)) list = [];
        if (!list.includes(conditionKey)) {
            list.push(conditionKey);
            const jsonStr = JSON.stringify(list);
            if (!attr) {
                character.attribs.create({ name: "tracked_debuffs", current: jsonStr });
            } else {
                attr.save({ current: jsonStr });
            }
        }
        return true;
    }

    /**
     * 从人物卡的 tracked_debuffs 属性中除名某个 Debuff
     */
    static async removeTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        let attr = character.attribs.models.find(a => a.get("name") === "tracked_debuffs");
        if (!attr || !attr.get("current")) return false;
        let list = [];
        try { list = JSON.parse(attr.get("current")); } catch (e) { list = []; }
        if (!Array.isArray(list)) return false;
        const filtered = list.filter(k => k !== conditionKey);
        if (filtered.length === 0) {
            attr.destroy();
        } else {
            attr.save({ current: JSON.stringify(filtered) });
        }
        return true;
    }

    static async toggleCondition(character, conditionKey, enable = false, rounds = null) {
        if (!character || !conditionKey) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        let condAttr = character.attribs.models.find(a => a.get("name") === conditionKey);
        const val = enable ? 1 : 0;
        if (!condAttr) {
            condAttr = character.attribs.create({ name: conditionKey, current: val });
        } else {
            condAttr.save({ current: val });
        }

        const roundsKey = `${conditionKey}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === roundsKey);
        if (rounds !== null && rounds !== undefined && rounds !== "") {
            if (!roundsAttr) {
                character.attribs.create({ name: roundsKey, current: rounds });
            } else {
                roundsAttr.save({ current: rounds });
            }
        } else if (!roundsAttr) {
            // 确保具有追踪属性，即便不开启也能在调度器中维持显示
            character.attribs.create({ name: roundsKey, current: "" });
        }

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
     * 关停当前 Buff/Debuff 以及其在全战役中的所有下游受术者副本 (仅限有下游的 Buff/Debuff 使用)
     * @param {object} hostChar 宿主角色卡
     * @param {string} hostRowId 宿主 Buff 行唯一标识或 Condition Key (如 condition-Blind)
     */
    static async deactivateBuffAndDownstream(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);

        const isDebuff = hostRowId.startsWith("condition-");

        // 1. 关停宿主自身该 Buff / Debuff
        if (isDebuff) {
            await this.toggleCondition(hostChar, hostRowId, false);
        } else {
            await this.toggleBuff(hostChar, hostRowId, false);
        }

        // 2. 获取并自动拓扑自愈下游受术者列表
        const attrName = isDebuff ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        let childrenAttr = hostChar.attribs.models.find(a => a.get("name") === attrName);
        let children = [];
        if (childrenAttr && childrenAttr.get("current")) {
            try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
        }
        if (!Array.isArray(children) || children.length === 0) {
            if (!isDebuff) {
                children = await this.discoverDownstreamLinks(hostChar.id, hostRowId);
            }
        }

        let count = 0;
        if (Array.isArray(children)) {
            for (const item of children) {
                const targetChar = window.Campaign?.characters?.get(item.charId);
                if (targetChar) {
                    if (isDebuff || item.rowId.startsWith("condition-")) {
                        await this.toggleCondition(targetChar, item.rowId, false);
                        const hAttr = targetChar.attribs.models.find(a => a.get("name") === `${item.rowId}_link_host_id`);
                        if (hAttr) hAttr.destroy();
                    } else {
                        await this.toggleBuff(targetChar, item.rowId, false);
                    }
                    if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                    count++;
                }
            }
        }
        console.log(`[Pf1eBuffManager] 已关停 [${hostChar.get("name")}] 的主 ${isDebuff ? "Debuff" : "Buff"} (${hostRowId}) 及其 ${count} 个下游受术者副本`);
        return true;
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
     * 宿主源 Buff / Debuff 记录下游受术者订阅关系 (双向索引)
     */
    static async recordDownstreamLink(hostChar, hostRowId, childCharId, childRowId) {
        if (!hostChar || !hostRowId || !childCharId || !childRowId || !hostChar.attribs) return;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const attrName = hostRowId.startsWith("condition-") ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        let attr = hostChar.attribs.models.find(a => a.get("name") === attrName);
        let children = [];
        if (attr && attr.get("current")) {
            try { children = JSON.parse(attr.get("current")); } catch (e) { children = []; }
        }
        if (!Array.isArray(children)) children = [];
        if (!children.some(c => c.charId === childCharId && c.rowId === childRowId)) {
            children.push({ charId: childCharId, rowId: childRowId });
        }
        const jsonStr = JSON.stringify(children);
        if (!attr) {
            hostChar.attribs.create({ name: attrName, current: jsonStr });
        } else {
            attr.save({ current: jsonStr });
        }
    }

    /**
     * 宿主源 Buff / Debuff 移除下游受术者订阅关系
     */
    static async removeDownstreamLink(hostChar, hostRowId, childCharId, childRowId) {
        if (!hostChar || !hostRowId || !hostChar.attribs) return;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const attrName = hostRowId.startsWith("condition-") ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        let attr = hostChar.attribs.models.find(a => a.get("name") === attrName);
        if (!attr || !attr.get("current")) return;
        let children = [];
        try { children = JSON.parse(attr.get("current")); } catch (e) { children = []; }
        if (!Array.isArray(children)) return;
        const filtered = children.filter(c => !(c.charId === childCharId && (c.rowId === childRowId || (!c.rowId && childRowId === hostRowId))));
        if (filtered.length === 0) {
            attr.destroy();
        } else {
            attr.save({ current: JSON.stringify(filtered) });
        }
    }

    /**
     * 断开指定 Buff / Debuff 的影子链接，将其转为完全独立的本地副本（并从宿主订阅表中除名）
     */
    static async unlinkBuff(character, rowId) {
        if (!character || !rowId || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const isDebuff = rowId.startsWith("condition-");
        const prefix = isDebuff ? rowId : `repeating_buff2_${rowId}`;
        const hostAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_host_id`);
        const srcAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_source_row_id`);

        const hostId = hostAttr ? hostAttr.get("current") : null;
        const srcRowId = srcAttr ? srcAttr.get("current") : null;

        if (hostAttr) hostAttr.destroy();
        if (srcAttr) srcAttr.destroy();

        // 通知宿主将本子条目从下游记录中移除
        if (hostId && srcRowId) {
            const hostChar = window.Campaign?.characters?.get(hostId);
            if (hostChar) {
                await this.removeDownstreamLink(hostChar, srcRowId, character.id, rowId);
            }
        }

        console.log(`[Pf1eBuffManager] 已断开 ${character.get("name")} 的 ${isDebuff ? "Debuff" : "Buff"} (${rowId}) 影子链接，转为独立副本`);
        return true;
    }

    /**
     * 彻底净化 Buff 细目属性字典，剔除所有影子链接相关的元属性
     * 确保生成的副本为 100% 独立 Buff（既不带 link_host_id 认老大，也不带 link_children 认小弟）
     * 遵循原则：无论是谁，复制之后得独立成一个Buff，不包括任何链接，复制小弟不能有老大，复制老大不能有小弟。
     * @param {object|null} extraAttrs 原始细目字典
     * @returns {object|null} 净化后的细目字典
     */
    static sanitizeExtraAttrsForClone(extraAttrs) {
        if (!extraAttrs || typeof extraAttrs !== "object") return null;
        const clean = {};
        for (const [k, v] of Object.entries(extraAttrs)) {
            if (
                k === "rounds" ||
                k === "enable_toggle" ||
                k === "name" ||
                k === "init_rounds" ||
                k === "row_id" ||
                k.startsWith("link_") ||
                k === "linkHostId" ||
                k === "linkSourceRowId" ||
                k === "linkChildren" ||
                k === "link_host_id" ||
                k === "link_source_row_id" ||
                k === "link_children" ||
                k === "link_child_name" ||
                k === "link_upstream_name"
            ) {
                continue;
            }
            clean[k] = v;
        }
        return Object.keys(clean).length > 0 ? clean : null;
    }

    /**
     * 为目标角色施加或刷新 Debuff，支持影子链接参数 (受术者登记宿主，宿主登记下游)
     */
    static async applyOrRefreshDebuff(targetChar, conditionKey, rounds = null, linkHostId = null, linkSourceRowId = null) {
        if (!targetChar || !conditionKey) return false;
        await Roll20Bridge.ensureCharacterAttributes(targetChar);

        // 1. 登记至 tracked_debuffs 并激活设定轮数
        await this.addTrackedDebuff(targetChar, conditionKey);
        await this.toggleCondition(targetChar, conditionKey, true, rounds);

        // 2. 若指定了宿主，写入影子链接元属性并向宿主反向登记下游
        const hostAttrName = `${conditionKey}_link_host_id`;
        const srcAttrName = `${conditionKey}_link_source_row_id`;

        if (linkHostId) {
            let hostAttr = targetChar.attribs.models.find(a => a.get("name") === hostAttrName);
            if (!hostAttr) {
                targetChar.attribs.create({ name: hostAttrName, current: linkHostId });
            } else {
                hostAttr.save({ current: linkHostId });
            }

            const srcRowId = linkSourceRowId || conditionKey;
            let srcAttr = targetChar.attribs.models.find(a => a.get("name") === srcAttrName);
            if (!srcAttr) {
                targetChar.attribs.create({ name: srcAttrName, current: srcRowId });
            } else {
                srcAttr.save({ current: srcRowId });
            }

            const hostChar = window.Campaign?.characters?.get(linkHostId);
            if (hostChar) {
                await this.recordDownstreamLink(hostChar, srcRowId, targetChar.id, conditionKey);
            }
        } else {
            // 普通副本施加：彻底斩断该 Debuff 可能存在的旧影子链接（通知旧宿主除名并销毁元属性）
            const oldHostAttr = targetChar.attribs.models.find(a => a.get("name") === hostAttrName);
            const oldSrcAttr = targetChar.attribs.models.find(a => a.get("name") === srcAttrName);
            const oldHostId = oldHostAttr ? oldHostAttr.get("current") : null;
            const oldSrcRowId = oldSrcAttr ? oldSrcAttr.get("current") : null;

            if (oldHostAttr) oldHostAttr.destroy();
            if (oldSrcAttr) oldSrcAttr.destroy();

            if (oldHostId && oldSrcRowId) {
                const oldHostChar = window.Campaign?.characters?.get(oldHostId);
                if (oldHostChar) {
                    await this.removeDownstreamLink(oldHostChar, oldSrcRowId, targetChar.id, conditionKey);
                }
            }
        }
        return true;
    }

    /**
     * 物理删除角色卡上的原生 repeating_buff2 一整行属性（彻底销毁，杜绝死灰复燃）
     * @param {object} character Character Backbone 模型
     * @param {string} rowId 行唯一标识
     */
    static async deleteBuffRowPermanently(character, rowId, visited = null) {
        if (!character || !rowId || !character.attribs) return false;
        if (typeof visited === "boolean" || !visited) visited = new Set();
        const visitKey = `${character.id}:${rowId}`;
        if (visited.has(visitKey)) return false;
        visited.add(visitKey);

        const isRootOperation = (visited.size === 1);
        if (isRootOperation) this.isScriptMutating = true;

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            const prefix = `repeating_buff2_${rowId}`;
            const prefixWithUnderscore = `${prefix}_`;

            // === 阶段一：老大只需循环调用小弟自毁，直到自己小弟一个都不剩 ===
            const childrenAttrName = `${prefix}_link_children`;
            while (true) {
                const childrenAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
                if (!childrenAttr || !childrenAttr.get("current")) break;
                let children = [];
                try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
                if (!Array.isArray(children) || children.length === 0) break;

                const item = children[0];
                if (!item || item.charId === character.id) {
                    await this.removeDownstreamLink(character, rowId, item?.charId || character.id, item?.rowId || rowId);
                    continue;
                }

                const cChar = window.Campaign?.characters?.get(item.charId);
                if (cChar) {
                    if (item.rowId && item.rowId.startsWith("condition-")) {
                        await this.deleteDebuffPermanently(cChar, item.rowId, visited);
                    } else {
                        await this.deleteBuffRowPermanently(cChar, item.rowId, visited);
                    }
                } else {
                    // 若小弟角色已从战役移除（孤儿脏数据），直接在老大处除名
                    await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                }

                // 防御性校验：若小弟自毁后由于历史异常未能主动除名，老大强制将其剔除，确保循环必收敛
                const checkAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
                if (checkAttr && checkAttr.get("current")) {
                    let curChildren = [];
                    try { curChildren = JSON.parse(checkAttr.get("current")); } catch (e) { curChildren = []; }
                    if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && c.rowId === item.rowId)) {
                        await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                    }
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自身也是某个上一级宿主的子条目，在自身自毁时自然向上一级宿主除名
            const hostAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_host_id`);
            const srcAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_link_source_row_id`);
            if (hostAttr && srcAttr) {
                const hostId = hostAttr.get("current");
                const srcRowId = srcAttr.get("current");
                if (hostId && srcRowId) {
                    const hostChar = window.Campaign?.characters?.get(hostId);
                    if (hostChar) {
                        await this.removeDownstreamLink(hostChar, srcRowId, character.id, rowId);
                    }
                }
            }

            // 2. 彻底销毁自身行所辖的全部原生属性（包括可能残留的 link_children 等）
            const toDestroy = character.attribs.models.filter(a => {
                const n = a.get("name") || "";
                return n === prefix || n.startsWith(prefixWithUnderscore);
            });

            if (toDestroy.length > 0) {
                toDestroy.forEach(attr => attr.destroy());
                console.log(`[Pf1eBuffManager] 已物理彻底销毁 ${character.get("name")} 的 Buff [${rowId}] 共 ${toDestroy.length} 项原生属性`);
                await this.triggerRecalculate(character);
            }
            return true;
        } finally {
            if (isRootOperation) {
                queueMicrotask(() => {
                    this.isScriptMutating = false;
                });
            }
        }
    }

    /**
     * 彻底删除/解除角色身上的 Debuff 状态及其全部影子链接关系
     * 遵循严格自下而上注销与两阶段级联销毁规范：
     * 阶段一（通知小弟自毁）：施法者老大只需循环调用小弟自毁，直到自己小弟一个都不剩；受术者销毁时向上汇报并在老大处除名；
     * 阶段二（老大终局自毁）：受术者全部除名后，施法者老大自身关停状态并销毁轮数与元属性。
     * @param {object} character Character Backbone 模型
     * @param {string} conditionKey 如 condition-Blinded
     * @param {Set} [visited] 全局防环记录集
     */
    static async deleteDebuffPermanently(character, conditionKey, visited = null) {
        if (!character || !conditionKey || !character.attribs) return false;
        if (typeof visited === "boolean" || !visited) visited = new Set();
        const visitKey = `${character.id}:${conditionKey}`;
        if (visited.has(visitKey)) return false;
        visited.add(visitKey);

        const isRootOperation = (visited.size === 1);
        if (isRootOperation) this.isScriptMutating = true;

        try {
            await Roll20Bridge.ensureCharacterAttributes(character);

            // === 阶段一：老大只需循环调用小弟自毁，直到自己小弟一个都不剩 ===
            const childrenAttrName = `${conditionKey}_link_children`;
            while (true) {
                const childrenAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
                if (!childrenAttr || !childrenAttr.get("current")) break;
                let children = [];
                try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
                if (!Array.isArray(children) || children.length === 0) break;

                const item = children[0];
                if (!item || item.charId === character.id) {
                    await this.removeDownstreamLink(character, conditionKey, item?.charId || character.id, item?.rowId || conditionKey);
                    continue;
                }

                const targetChar = window.Campaign?.characters?.get(item.charId);
                if (targetChar) {
                    if (item.rowId && item.rowId.startsWith("condition-")) {
                        await this.deleteDebuffPermanently(targetChar, item.rowId, visited);
                    } else {
                        await this.deleteBuffRowPermanently(targetChar, item.rowId, visited);
                    }
                } else {
                    // 若受术者已离线或被删除，直接除名
                    await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                }

                // 防御性校验：确保必定收敛剔除
                const checkAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
                if (checkAttr && checkAttr.get("current")) {
                    let curChildren = [];
                    try { curChildren = JSON.parse(checkAttr.get("current")); } catch (e) { curChildren = []; }
                    if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && (c.rowId === item.rowId || (!c.rowId && item.rowId === conditionKey)))) {
                        await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                    }
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自己是受术者（记录了 link_host_id），在自毁时向上级施法者汇报并在其 link_children 中除名
            const hostAttrName = `${conditionKey}_link_host_id`;
            const srcAttrName = `${conditionKey}_link_source_row_id`;
            let hostAttr = character.attribs.models.find(a => a.get("name") === hostAttrName);
            let srcAttr = character.attribs.models.find(a => a.get("name") === srcAttrName);
            const hostId = hostAttr ? hostAttr.get("current") : null;
            const srcRowId = srcAttr ? srcAttr.get("current") : null;

            if (hostId && srcRowId) {
                const hostChar = window.Campaign?.characters?.get(hostId);
                if (hostChar) {
                    await this.removeDownstreamLink(hostChar, srcRowId, character.id, conditionKey);
                }
            }
            if (hostAttr) hostAttr.destroy();
            if (srcAttr) srcAttr.destroy();

            // 2. 销毁自身可能残留的 link_children 索引属性
            let leftChildrenAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
            if (leftChildrenAttr) leftChildrenAttr.destroy();

            // 3. 关停自身该状态并销毁轮数
            await this.toggleCondition(character, conditionKey, false);
            const roundsAttr = character.attribs.models.find(a => a.get("name") === `${conditionKey}_rounds`);
            if (roundsAttr) roundsAttr.destroy();

            // 4. 从 tracked_debuffs 属性中彻底除名
            await this.removeTrackedDebuff(character, conditionKey);

            if (typeof Pf1eBuffUI !== "undefined") {
                Pf1eBuffUI.requestTokenRefresh(character.id);
            }

            console.log(`[Pf1eBuffManager] 已物理彻底销毁 [${character.get("name")}] 的 Debuff [${conditionKey}] 及其链接关系`);
            return true;
        } finally {
            if (isRootOperation) {
                queueMicrotask(() => {
                    this.isScriptMutating = false;
                });
            }
        }
    }

    static async syncBuffToDownstream(hostChar, hostRowId, targetChar, childRowId) {
        if (!hostChar || !targetChar || !hostRowId || !childRowId) return false;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        await Roll20Bridge.ensureCharacterAttributes(targetChar);

        const hostBuffs = await this.getAllBuffs(hostChar);
        const hostBuff = hostBuffs.find(b => b.rowId === hostRowId);
        if (!hostBuff) return false;

        // 读取下游当前的 rounds，保证下游剩余轮数绝对不被宿主重置覆盖！
        const childPrefix = `repeating_buff2_${childRowId}`;
        const childRoundsAttr = targetChar.attribs.models.find(a => a.get("name") === `${childPrefix}_rounds`);
        const childCurrentRounds = childRoundsAttr ? childRoundsAttr.get("current") : "";

        // 提取加值细目：严格排除本地独立字段（rounds, enable_toggle, link_*）
        const cleanExtraAttrs = {};
        if (hostBuff.extraAttrs) {
            for (const [k, v] of Object.entries(hostBuff.extraAttrs)) {
                if (k === "rounds" || k === "enable_toggle" || k.startsWith("link_") || k === "name" || k === "init_rounds") continue;
                cleanExtraAttrs[k] = v;
            }
        }

        // 调用更新：保持下游当前的 rounds，并在 preservedKeys 中保留 enable_toggle 与 link_* 字段
        await this.updateBuffRow(
            targetChar,
            childRowId,
            hostBuff.name,
            childCurrentRounds,
            cleanExtraAttrs,
            hostBuff.initRounds
        );
        return true;
    }

    /**
     * 拓扑自愈：从全战役角色卡反向发现指向宿主 Buff 的所有下游订阅项
     */
    static async discoverDownstreamLinks(hostCharId, hostRowId) {
        if (!hostCharId || !hostRowId || !window.Campaign?.characters) return [];
        const chars = window.Campaign.characters.models || [];
        const found = [];

        for (const c of chars) {
            if (!c.attribs || c.id === hostCharId) continue;
            const hostIdAttrs = c.attribs.models.filter(a => (a.get("name") || "").endsWith("_link_host_id"));
            for (const ha of hostIdAttrs) {
                if (ha.get("current") === hostCharId) {
                    const prefix = ha.get("name").replace("_link_host_id", "");
                    const sourceRowAttr = c.attribs.models.find(a => a.get("name") === `${prefix}_link_source_row_id`);
                    if (sourceRowAttr && sourceRowAttr.get("current") === hostRowId) {
                        const childRowId = prefix.replace("repeating_buff2_", "");
                        found.push({ charId: c.id, rowId: childRowId });
                    }
                }
            }
        }
        return found;
    }

    /**
     * 从宿主广播同步给所有下游订阅副本 (具备索引缺失自动反向发现与拓扑自愈能力)
     */
    static async broadcastDownstreamSync(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return 0;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const prefix = `repeating_buff2_${hostRowId}`;
        let childrenAttr = hostChar.attribs.models.find(a => a.get("name") === `${prefix}_link_children`);

        let children = [];
        if (childrenAttr && childrenAttr.get("current")) {
            try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
        }

        // 拓扑自愈：若宿主未登记下游（如老版本建立的链接），全量反查战役自愈修复索引
        if (!Array.isArray(children) || children.length === 0) {
            children = await this.discoverDownstreamLinks(hostChar.id, hostRowId);
            if (children.length > 0) {
                const jsonStr = JSON.stringify(children);
                if (!childrenAttr) {
                    childrenAttr = hostChar.attribs.create({ name: `${prefix}_link_children`, current: jsonStr });
                } else {
                    childrenAttr.save({ current: jsonStr });
                }
                console.log(`[Pf1eBuffManager] 拓扑自愈：为 [${hostChar.get("name")}] 自动恢复 ${children.length} 个下游链接索引`);
            }
        }

        if (!Array.isArray(children) || children.length === 0) return 0;

        let count = 0;
        for (const item of children) {
            const targetChar = window.Campaign?.characters?.get(item.charId);
            if (targetChar) {
                const ok = await this.syncBuffToDownstream(hostChar, hostRowId, targetChar, item.rowId);
                if (ok) {
                    count++;
                    if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                }
            }
        }
        return count;
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
     * 为指定的 Buff 行设置/更新预置初始轮数或公式
     */
    static async setBuffInitRounds(character, rowId, initRounds) {
        if (!character || !rowId) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const attrName = `repeating_buff2_${rowId}_init_rounds`;
        let initAttr = character.attribs.models.find(a => a.get("name") === attrName);
        const val = (initRounds !== null && initRounds !== undefined) ? String(initRounds).trim() : "";

        if (!initAttr) {
            if (val !== "") {
                initAttr = character.attribs.create({ name: attrName, current: val });
            }
        } else {
            initAttr.save({ current: val });
        }
        return initAttr;
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
            // 清理不在新 extraAttrs 中的旧扩展字段（绝对保护本地状态与链接索引）
            const preservedKeys = new Set([
                "name", "enable_toggle", "rounds", "init_rounds", "tabcat", "tabcat2", "row_id", "bufftype",
                "link_host_id", "link_source_row_id", "link_children"
            ]);
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
     * 回合开始时扣减当前行动单位的 Buff / Debuff 轮数，并精准驱动扣减其名下所有主 Buff 的下游链接副本
     * 遵循规范：
     * 1. 链接 Buff (isLinkedChild) 绝不在受术者自己的先攻位扣轮，而在施法者回合开始时扣减；
     * 2. 施法者名下所有主 Buff 的下游受术者副本统一扣减 1 轮（即便主 Buff 未开启或轮数不足），受术者归零时自动解除；
     * 3. 激活的 Debuff：正数逐轮倒扣至 0 解除；0 或负数则持续正计轮 (0 -> -1 -> -2...)。
     * @param {object|string} tokenOrChar 
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
            const allBuffs = await this.getAllBuffs(character);
            const processed = [];

            // 1. 扣减自身常规正面 Buff
            // 链接 Buff (记录了 linkHostId) 绝不在此处扣减，跳过
            for (const buff of allBuffs) {
                if (!buff.enabled) continue;
                if (buff.linkHostId && buff.linkSourceRowId) continue;
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

            // 2. 施法者主 Buff 驱动下游受术者扣轮
            // 无论主 Buff 自身是否开启，名下所有已建立链接的受术者副本统一扣减 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const targetChar = window.Campaign?.characters?.get(childRef.charId);
                    if (!targetChar || !targetChar.attribs) continue;
                    await Roll20Bridge.ensureCharacterAttributes(targetChar);

                    const childPrefix = `repeating_buff2_${childRef.rowId}`;
                    const childToggleAttr = targetChar.attribs.models.find(a => a.get("name") === `${childPrefix}_enable_toggle`);
                    const childRoundsAttr = targetChar.attribs.models.find(a => a.get("name") === `${childPrefix}_rounds`);

                    // 仅当受术者身上该 Buff 处于激活状态时才扣减轮数
                    const isChildEnabled = childToggleAttr ? (Number(childToggleAttr.get("current")) === 1) : false;
                    if (!isChildEnabled) continue;

                    const currentVal = childRoundsAttr ? childRoundsAttr.get("current") : "";
                    if (currentVal !== "" && currentVal !== null && !isNaN(Number(currentVal))) {
                        const childRounds = Number(currentVal);
                        const nextRounds = childRounds - 1;
                        if (nextRounds <= 0) {
                            await this.removeBuff(targetChar, childRef.rowId);
                            processed.push({
                                name: `${buff.name} (受术者: ${targetChar.get("name")})`,
                                status: "expired",
                                remaining: 0
                            });
                        } else {
                            childRoundsAttr.save({ current: nextRounds }, { byScript: true });
                            processed.push({
                                name: `${buff.name} (受术者: ${targetChar.get("name")})`,
                                status: "decremented",
                                remaining: nextRounds
                            });
                        }
                        if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                    }
                }
            }

            // 2.2 施法者 Debuff 驱动下游受术者扣轮
            // 施法者名下所有建立链接的 Debuff，无论施法者自身是否处于该状态，统一驱动扣减受术者 1 轮
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const childrenAttr = character.attribs.models.find(a => a.get("name") === `${def.key}_link_children`);
                if (!childrenAttr || !childrenAttr.get("current")) continue;
                let children = [];
                try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
                if (!Array.isArray(children) || children.length === 0) continue;

                for (const childRef of children) {
                    const targetChar = window.Campaign?.characters?.get(childRef.charId);
                    if (!targetChar || !targetChar.attribs) continue;
                    await Roll20Bridge.ensureCharacterAttributes(targetChar);

                    // 检查受术者身上该状态是否开启
                    const targetCondAttr = targetChar.attribs.models.find(a => a.get("name") === def.key);
                    const isTargetActive = targetCondAttr && targetCondAttr.get("current") !== "0" && targetCondAttr.get("current") !== 0 && targetCondAttr.get("current") !== "" && targetCondAttr.get("current") !== false && targetCondAttr.get("current") !== null;
                    if (!isTargetActive) continue;

                    let targetRoundsAttr = targetChar.attribs.models.find(a => a.get("name") === `${def.key}_rounds`);
                    const rawRounds = targetRoundsAttr ? targetRoundsAttr.get("current") : "";
                    const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                    const currentRounds = hasRounds ? Number(rawRounds) : 0;

                    if (currentRounds > 0) {
                        const nextRounds = currentRounds - 1;
                        if (nextRounds <= 0) {
                            await this.toggleCondition(targetChar, def.key, false);
                            const hostAttr = targetChar.attribs.models.find(a => a.get("name") === `${def.key}_link_host_id`);
                            if (hostAttr) hostAttr.destroy();
                            processed.push({
                                name: `[Debuff链接] ${def.name} (受术者: ${targetChar.get("name")})`,
                                status: "expired",
                                remaining: 0
                            });
                        } else {
                            targetRoundsAttr.save({ current: nextRounds }, { byScript: true });
                            processed.push({
                                name: `[Debuff链接] ${def.name} (受术者: ${targetChar.get("name")})`,
                                status: "decremented",
                                remaining: nextRounds
                            });
                        }
                    } else {
                        // 0 或负数持续负计轮
                        const nextRounds = currentRounds - 1;
                        if (!targetRoundsAttr) {
                            targetChar.attribs.create({ name: `${def.key}_rounds`, current: nextRounds });
                        } else {
                            targetRoundsAttr.save({ current: nextRounds }, { byScript: true });
                        }
                        processed.push({
                            name: `[Debuff链接] ${def.name} (受术者: ${targetChar.get("name")})`,
                            status: "counted",
                            remaining: nextRounds
                        });
                    }
                    if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                }
            }

            // 3. 扣减 / 累加自身 Debuff (负面状态 condition-*)
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = character.attribs.models.find(a => a.get("name") === def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;
                if (!isActive) continue;

                // 若该 Debuff 是影子链接副本 (由施法者远程驱动)，受术者自己回合绝不自扣！
                const hostAttr = character.attribs.models.find(a => a.get("name") === `${def.key}_link_host_id`);
                if (hostAttr && hostAttr.get("current")) {
                    continue;
                }

                let roundsAttr = character.attribs.models.find(a => a.get("name") === `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                const currentRounds = hasRounds ? Number(rawRounds) : 0;

                if (currentRounds > 0) {
                    // 正数倒计轮
                    const nextRounds = currentRounds - 1;
                    if (nextRounds <= 0) {
                        await this.toggleCondition(character, def.key, false);
                        processed.push({ name: `[Debuff] ${def.name}`, status: "expired", remaining: 0 });
                    } else {
                        roundsAttr.save({ current: nextRounds }, { byScript: true });
                        processed.push({ name: `[Debuff] ${def.name}`, status: "decremented", remaining: nextRounds });
                    }
                } else {
                    // 0 或负数正计轮 (0 -> -1 -> -2...)
                    const nextRounds = currentRounds - 1;
                    if (!roundsAttr) {
                        character.attribs.create({
                            name: `${def.key}_rounds`,
                            current: nextRounds
                        });
                    } else {
                        roundsAttr.save({ current: nextRounds }, { byScript: true });
                    }
                    processed.push({ name: `[Debuff] ${def.name}`, status: "counted", remaining: nextRounds });
                }
            }

            console.log(`[Pf1eBuffManager] 回合开始: 为 ${charName} 扣减/联动 Buff/Debuff 共 ${processed.length} 项`);
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
     * 反向倒先攻时，将被拉回排头的单位及其主 Buff 下游受术者加回 1 轮
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
            const allBuffs = await this.getAllBuffs(character);
            const processed = [];

            // 1. 加回自身常规正面 Buff (跳过链接副本)
            for (const buff of allBuffs) {
                if (!buff.enabled) continue;
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (buff.rounds === null || isNaN(buff.rounds)) continue;

                const newRounds = buff.rounds + 1;
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: newRounds }, { byScript: true });
                } else {
                    await this.setBuffRounds(character, buff.rowId, newRounds);
                }
                processed.push({ name: buff.name, status: "incremented", remaining: newRounds });
            }

            // 2. 施法者主 Buff 驱动下游受术者加回 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const targetChar = window.Campaign?.characters?.get(childRef.charId);
                    if (!targetChar || !targetChar.attribs) continue;
                    await Roll20Bridge.ensureCharacterAttributes(targetChar);

                    const childPrefix = `repeating_buff2_${childRef.rowId}`;
                    const childToggleAttr = targetChar.attribs.models.find(a => a.get("name") === `${childPrefix}_enable_toggle`);
                    const childRoundsAttr = targetChar.attribs.models.find(a => a.get("name") === `${childPrefix}_rounds`);

                    const isChildEnabled = childToggleAttr ? (Number(childToggleAttr.get("current")) === 1) : false;
                    if (!isChildEnabled) continue;

                    const currentVal = childRoundsAttr ? childRoundsAttr.get("current") : "";
                    if (currentVal !== "" && currentVal !== null && !isNaN(Number(currentVal))) {
                        const childRounds = Number(currentVal);
                        const nextRounds = childRounds + 1;
                        childRoundsAttr.save({ current: nextRounds }, { byScript: true });
                        if (typeof Pf1eBuffUI !== "undefined") Pf1eBuffUI.requestTokenRefresh(targetChar.id);
                        processed.push({
                            name: `${buff.name} (受术者: ${targetChar.get("name")})`,
                            status: "incremented",
                            remaining: nextRounds
                        });
                    }
                }
            }

            // 3. 加回自身 Debuff
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = character.attribs.models.find(a => a.get("name") === def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;
                if (!isActive) continue;

                let roundsAttr = character.attribs.models.find(a => a.get("name") === `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                if (hasRounds) {
                    const currentRounds = Number(rawRounds);
                    const nextRounds = currentRounds + 1;
                    roundsAttr.save({ current: nextRounds }, { byScript: true });
                    processed.push({ name: `[Debuff] ${def.name}`, status: "incremented", remaining: nextRounds });
                }
            }

            console.log(`[Pf1eBuffManager] 先攻回退: 为 ${character.get("name")} 加回 Buff/Debuff 轮数共 ${processed.length} 项`);
            return processed;
        } finally {
            queueMicrotask(() => {
                this.isScriptMutating = false;
            });
        }
    }
}
