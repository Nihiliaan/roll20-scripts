import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { RecalcService } from "../../core/RecalcService.js";
import { BuffLifecycle } from "../../core/BuffLifecycle.js";
import { TokenBuffManager } from "../token-buff/TokenBuffManager.js";

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
                    const roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
                    const curRounds = roundsAttr ? roundsAttr.get("current") : "";
                    const isRoundsEmpty = curRounds === "" || curRounds === null || Number(curRounds) === 0;

                    if (isRoundsEmpty) {
                        const initRoundsAttr = Roll20Bridge.findAttr(character, `${prefix}_init_rounds`);
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

    /**
     * 收敛全项目的「Buff/Debuff 变更 → 刷新先攻条徽章」防御性调用
     * （Pf1eBuffUI 存在循环导入风险，故以 typeof 守卫）
     */
    static notifyTokenRefresh(character) {
        if (character && typeof Pf1eBuffUI !== "undefined") {
            Pf1eBuffUI.requestTokenRefresh(character.id);
        }
    }

    /**
     * 判定 Condition 属性当前值是否为激活态（"0"/0/""/null/undefined/false 均视为关停）
     */
    static isConditionValueActive(val) {
        return val !== "0" && val !== 0 && val !== "" && val !== null && val !== undefined && val !== false;
    }

    static generateStandardRowId() {
        return Roll20Bridge.generateStandardRowId();
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
     * 自动检测并修复/自愈历史遗留的带有下划线 _ 的畸形坏死 Buff 属性
     * 将包含下划线的 rowId 平滑迁移为合法 ID，并清理导致官方人物卡锁死的幽灵残破行
     * @param {object} character Character Backbone 模型
     * @returns {Promise<number>} 修复的行数
     */
    static async sanitizeMalformedBuffRows(character) {
        if (!character || !character.attribs || !character.attribs.models) return 0;

        const malformedMap = new Map(); // rawRowId -> { cleanRowId, attrs: [] }

        for (const a of [...character.attribs.models]) {
            const name = a.get("name") || "";
            if (!name.startsWith("repeating_buff2_-")) continue;
            
            // Firebase Push ID 长度恒为 20 (以 '-' 开头)
            // 属性全名格式：repeating_buff2_<20位rowId>_<subKey>
            const rowIdCandidate = name.slice(16, 36);
            if (name.charAt(36) === "_" && rowIdCandidate.includes("_")) {
                const rawRowId = rowIdCandidate;
                const subKey = name.slice(37);

                let entry = malformedMap.get(rawRowId);
                if (!entry) {
                    const cleanRowId = rawRowId.replace(/_/g, "a").toLowerCase();
                    entry = { cleanRowId, attrs: [] };
                    malformedMap.set(rawRowId, entry);
                }
                entry.attrs.push({ attr: a, subKey, val: a.get("current"), max: a.get("max") });
            }
        }

        if (malformedMap.size === 0) return 0;

        console.warn(`[Pf1eBuffManager] [自愈系统] 为 [${character.get("name")}] 检测到 ${malformedMap.size} 个含下划线的坏死 Buff 行，启动自动迁移...`);
        let fixedCount = 0;

        for (const [malformedRowId, { cleanRowId, attrs }] of malformedMap.entries()) {
            for (const { attr, subKey, val, max } of attrs) {
                const newName = `repeating_buff2_${cleanRowId}_${subKey}`;
                let existingNew = character.attribs.models.find(m => m.get("name") === newName);
                if (!existingNew) {
                    character.attribs.create({
                        name: newName,
                        current: subKey === "row_id" ? cleanRowId.toLowerCase() : val,
                        max: max || ""
                    }, { bySuite: true });
                }
                try {
                    attr.destroy();
                } catch (e) {
                    console.warn("[Pf1eBuffManager] 销毁坏死属性异常:", e);
                }
            }
            fixedCount++;
        }

        // 同步更新 _reporder_repeating_buff2
        const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
        if (orderAttr && orderAttr.get("current")) {
            let curOrder = String(orderAttr.get("current"));
            for (const [malformedRowId, { cleanRowId }] of malformedMap.entries()) {
                curOrder = curOrder.replace(malformedRowId, cleanRowId);
                const truncatedId = malformedRowId.split("_")[0];
                if (truncatedId && curOrder.includes(truncatedId)) {
                    curOrder = curOrder.replace(truncatedId, cleanRowId);
                }
            }
            orderAttr.save({ current: curOrder }, { bySuite: true });
        }

        // 清理打开的人物卡中锁死红字的坏死 DOM 元素
        try {
            const iframes = document.querySelectorAll(".characterdialog iframe, .ui-dialog iframe");
            iframes.forEach(iframe => {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc) return;
                for (const malformedRowId of malformedMap.keys()) {
                    const truncatedId = malformedRowId.split("_")[0];
                    const badItems = doc.querySelectorAll(`.repitem[data-reprowid="${truncatedId}"], .repitem[data-reprowid="${malformedRowId}"]`);
                    badItems.forEach(item => {
                        item.remove();
                        console.log(`[Pf1eBuffManager] 已从人物卡 DOM 中清除坏死节点 [${truncatedId}]`);
                    });
                }
            });
        } catch (e) {}

        console.log(`[Pf1eBuffManager] [自愈系统] [${character.get("name")}] 坏死 Buff 行修复完毕，共迁移 ${fixedCount} 行`);
        return fixedCount;
    }

    /**
     * 获取指定角色卡上所有的 Buff（无论是否激活启动）
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 包含启动和未启动的全部 Buff 列表
     */
    static async getAllBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);
        await this.sanitizeMalformedBuffRows(character);

        const buffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 单次遍历属性集合，建立按 rowId 分组的哈希索引表 (O(N) 纯单遍扫描替代 O(B*N) 多重线性查找)
        const buffMap = new Map();
        for (const a of character.attribs.models) {
            const attrName = a.get("name") || "";
            if (!attrName.startsWith("repeating_buff2_")) continue;
            const match = attrName.match(/^repeating_buff2_([^_]+)_(.+)$/);
            if (!match) continue;
            const rowId = match[1];
            const subKey = match[2];

            let entry = buffMap.get(rowId);
            if (!entry) {
                entry = {
                    rowId,
                    prefix: `repeating_buff2_${rowId}`,
                    nameAttr: null,
                    toggleAttr: null,
                    roundsAttr: null,
                    initRoundsAttr: null,
                    buffTypeAttr: null,
                    extraAttrs: {}
                };
                buffMap.set(rowId, entry);
            }

            if (subKey === "name") {
                entry.nameAttr = a;
            } else if (subKey === "enable_toggle") {
                entry.toggleAttr = a;
            } else if (subKey === "rounds") {
                entry.roundsAttr = a;
            } else if (subKey === "init_rounds") {
                entry.initRoundsAttr = a;
            } else if (subKey === "bufftype") {
                entry.buffTypeAttr = a;
            } else if (
                subKey !== "tabcat" &&
                subKey !== "tabcat2" &&
                subKey !== "row_id"
            ) {
                const raw = a.get("current");
                if (raw !== "" && raw !== null && raw !== undefined) {
                    entry.extraAttrs[subKey] = (!isNaN(Number(raw)) && typeof raw !== "boolean" && String(raw).trim() !== "") ? Number(raw) : raw;
                }
            }
        }

        // 遍历索引表组装 Buff 实体 (纯只读查询，无任何副作用与写回)
        for (const entry of buffMap.values()) {
            const { rowId, prefix, nameAttr, toggleAttr, roundsAttr, initRoundsAttr, buffTypeAttr, extraAttrs } = entry;
            if (!nameAttr) continue;

            const name = nameAttr.get("current") || "未命名Buff";
            const enabled = toggleAttr ? Number(toggleAttr.get("current")) === 1 : false;
            const rounds = roundsAttr && roundsAttr.get("current") !== "" ? Number(roundsAttr.get("current")) : null;
            const initRounds = initRoundsAttr && initRoundsAttr.get("current") !== "" ? String(initRoundsAttr.get("current")) : null;
            const buffType = buffTypeAttr ? buffTypeAttr.get("current") : "spell";

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
        const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
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
        let orderList = allBuffs.map(b => b.rowId);

        const sId = sourceRowId.toLowerCase();
        const tId = targetRowId.toLowerCase();

        // 移除被拖拽项
        orderList = orderList.filter(id => id.toLowerCase() !== sId);

        // 定位目标项并插入
        const targetIdx = orderList.findIndex(id => id.toLowerCase() === tId);
        if (targetIdx === -1) {
            orderList.push(sourceRowId);
        } else {
            const insertIdx = placeBefore ? targetIdx : targetIdx + 1;
            orderList.splice(insertIdx, 0, sourceRowId);
        }

        const newOrderStr = orderList.join(",");
        let orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
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
     * 统一委托至 RecalcService 单源重算服务 (300ms 角色维度防抖合并)
     * @param {object} character 
     */
    static async triggerRecalculate(character) {
        if (!character) return;
        if (typeof RecalcService !== "undefined") {
            RecalcService.request(character, { reason: "trigger_recalculate" });
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
        await this.sanitizeMalformedBuffRows(character);

        const cleanName = (buffName || "").trim();
        if (!cleanName) return null;

        console.log(`[Pf1eBuffManager] [DEBUG_APPLY_OR_REFRESH] 角色: [${character.get("name")}], 拟施加 Buff: [${cleanName}], 现有条目数: ${character.attribs?.models?.filter(a => a.get("name")?.startsWith("repeating_buff2_")).length || 0}`);

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

            let toggleAttr = Roll20Bridge.findAttr(character, `${prefix}_enable_toggle`);
            if (!toggleAttr) {
                toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 });
            } else {
                toggleAttr.save({ current: 1 });
            }

            // 补全原生必需标签，防止角色卡报错
            this.ensureNativeRequiredAttrs(character, prefix, rowId);

            // 更新或保存预置初始轮数/公式
            if (initRounds !== null && initRounds !== undefined) {
                let initAttr = Roll20Bridge.findAttr(character, `${prefix}_init_rounds`);
                if (!initAttr) {
                    if (initRounds !== "") character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds });
                } else {
                    initAttr.save({ current: initRounds });
                }
            }

            let effectiveRounds = rounds;
            if (effectiveRounds === null || isNaN(effectiveRounds)) {
                // 借用原生机制求值预置公式
                const targetFormula = initRounds || (Roll20Bridge.findAttr(character, `${prefix}_init_rounds`)?.get("current"));
                if (targetFormula) {
                    const evalVal = await Roll20Bridge.evalNativeFormula(targetFormula, character);
                    if (evalVal !== null && !isNaN(evalVal)) effectiveRounds = evalVal;
                }
            }

            let roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
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
                    let subAttr = Roll20Bridge.findAttr(character, attrFullName);
                    if (!subAttr) {
                        character.attribs.create({ name: attrFullName, current: v });
                    } else {
                        subAttr.save({ current: v });
                    }
                }
            }

            // 若本次刷新为独立普通副本（未包含 link_host_id），清除该条目可能残留的旧影子链接
            if (!extraAttrs || !extraAttrs.link_host_id) {
                const oldHostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
                const oldSrcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);
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
            RecalcService.request(character, { reason: "refresh_buff" });
            return { rowId, prefix, name: cleanName, rounds: effectiveRounds, isRefreshed: true };
        } else {
            // 不存在同名 Buff，新增一行
            const newBuff = await this.addBuff(character, cleanName, rounds, extraAttrs, initRounds);
            RecalcService.request(character, { reason: "add_buff" });
            return { ...newBuff, isRefreshed: false };
        }
    }

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     */
    static async addBuff(character, buffName, rounds = null, extraAttrs = null, initRounds = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);
        await this.sanitizeMalformedBuffRows(character);

        const cleanName = (buffName || "新Buff").trim();
        const rowId = this.generateStandardRowId();
        const prefix = `repeating_buff2_${rowId}`;

        console.log(`[Pf1eBuffManager] [DEBUG_ADD_BUFF] 正在为 [${character.get("name")}] 新增规范 Buff: [${cleanName}], rowId: [${rowId}], 字符安全性校验: ${!rowId.includes("_") ? "PASS" : "FAIL"}`);

        // 写入原生必需的核心字段（标记 bySuite 防止中间切面误触）
        const nameAttr = character.attribs.create({ name: `${prefix}_name`, current: cleanName }, { bySuite: true });
        const toggleAttr = character.attribs.create({ name: `${prefix}_enable_toggle`, current: 1 }, { bySuite: true });
        const typeAttr = character.attribs.create({ name: `${prefix}_bufftype`, current: "spell" }, { bySuite: true });

        // 必需的原生分类与渲染控制标记（杜绝 "You must delete this row" 错误）
        character.attribs.create({ name: `${prefix}_tabcat`, current: "spell" }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_tabcat2`, current: "1" }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_description-show`, current: 1 }, { bySuite: true });
        character.attribs.create({ name: `${prefix}_row_id`, current: rowId }, { bySuite: true });

        // 保存初始预置轮数/公式
        if (initRounds !== null && initRounds !== undefined && initRounds !== "") {
            character.attribs.create({ name: `${prefix}_init_rounds`, current: initRounds }, { bySuite: true });
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
            }, { bySuite: true });
        }

        // 写入细目属性
        if (extraAttrs && typeof extraAttrs === "object") {
            for (const [k, v] of Object.entries(extraAttrs)) {
                if (k === "name" || k === "enable_toggle" || k === "rounds" || k === "init_rounds" || k === "bufftype" || k === "tabcat" || k === "tabcat2" || k === "row_id") continue;
                character.attribs.create({ name: `${prefix}_${k}`, current: v }, { bySuite: true });
            }
        }

        // 同步规范维护 _reporder_repeating_buff2 顺序
        let orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
        if (!orderAttr) {
            character.attribs.create({
                name: "_reporder_repeating_buff2",
                current: rowId
            }, { bySuite: true });
        } else {
            const curVal = String(orderAttr.get("current") || "").trim();
            const ids = curVal ? curVal.split(",").map(s => s.trim()).filter(Boolean) : [];
            if (!ids.some(id => id.toLowerCase() === rowId.toLowerCase())) {
                ids.push(rowId);
                orderAttr.save({ current: ids.join(",") }, { bySuite: true });
            }
        }

        console.log(`[Pf1eBuffManager] 为 ${character.get("name")} 新增原生规范 Buff [${cleanName}] 完毕, rowId: ${rowId}, 轮数: ${effectiveRounds}`);
        return { rowId, prefix, name: cleanName, rounds: effectiveRounds, toggleAttr, roundsAttr };
    }

    /**
     * 辅助方法：确保一行 Buff 拥有原生角色卡所需的全部标准元属性
     */
    static ensureNativeRequiredAttrs(character, prefix, rowId) {
        const checkAndCreate = (subKey, defaultVal) => {
            const fullKey = `${prefix}_${subKey}`;
            let attr = Roll20Bridge.findAttr(character, fullKey);
            if (!attr) {
                character.attribs.create({ name: fullKey, current: defaultVal });
            }
        };

        checkAndCreate("tabcat", "spell");
        checkAndCreate("tabcat2", "1");
        checkAndCreate("description-show", 1);
        checkAndCreate("row_id", rowId);
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

        // 1. 读取该 Buff 的预置初始轮数/公式 (init_rounds)
        const initRoundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_init_rounds`);

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
        let roundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_rounds`);

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

        // 合并行动一：若开启，强制原子重置为初始满轮数；若关停，轮数清零防僵尸残留
        if (enable) {
            await this.resetBuffRoundsToInitial(character, rowId);
        } else {
            const roundsAttr = Roll20Bridge.findAttrCI(character, `${targetPrefix}_rounds`);
            if (roundsAttr && roundsAttr.get("current") !== 0 && roundsAttr.get("current") !== "0") {
                roundsAttr.save({ current: 0 });
            }
        }

        // 合并行动二：设置原生激活开关 enable_toggle
        const val = enable ? 1 : 0;
        Roll20Bridge.upsertAttr(character, `${targetPrefix}_enable_toggle`, val, { ci: true });

        // 合并行动三：驱动官方加值重算管线 (让官方脚本去给整张人物卡设置加值/减值)
        console.log(`[Pf1eBuffManager] 已${enable ? "启用" : "关停"} ${character.get("name")} 的 Buff (${rowId})，正在联动重算加值...`);
        RecalcService.request(character, { reason: enable ? "enable_buff" : "disable_buff" });

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
        const parsed = Roll20Bridge.readJsonAttr(character, "tracked_debuffs", null);
        return Array.isArray(parsed) ? parsed : [];
    }

    /**
     * 将某个 Debuff 登记到人物卡的 tracked_debuffs 属性中
     */
    static async addTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        let list = Roll20Bridge.readJsonAttr(character, "tracked_debuffs");
        if (!Array.isArray(list)) list = [];
        if (!list.includes(conditionKey)) {
            list.push(conditionKey);
            Roll20Bridge.writeJsonAttr(character, "tracked_debuffs", list);
        }
        return true;
    }

    /**
     * 从人物卡的 tracked_debuffs 属性中除名某个 Debuff
     */
    static async removeTrackedDebuff(character, conditionKey) {
        if (!character || !conditionKey || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);
        const list = Roll20Bridge.readJsonAttr(character, "tracked_debuffs", null);
        if (!Array.isArray(list)) return false;
        const filtered = list.filter(k => k !== conditionKey);
        Roll20Bridge.writeJsonAttr(character, "tracked_debuffs", filtered, { destroyIfEmpty: true });
        return true;
    }

    static async toggleCondition(character, conditionKey, enable = false, rounds = null) {
        if (!character || !conditionKey) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        let condAttr = Roll20Bridge.findAttr(character, conditionKey);
        const val = enable ? 1 : 0;
        if (!condAttr) {
            condAttr = character.attribs.create({ name: conditionKey, current: val });
        } else {
            condAttr.save({ current: val });
        }

        const roundsKey = `${conditionKey}_rounds`;
        let roundsAttr = Roll20Bridge.findAttr(character, roundsKey);
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

        RecalcService.request(character, { reason: enable ? "enable_condition" : "disable_condition" });
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
        this.notifyTokenRefresh(hostChar);

        // 2. 获取下游受术者列表（拓扑自愈由 GM 加载房间后的 healDownstreamTopology 统一执行）
        const attrName = isDebuff ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        const children = Roll20Bridge.readJsonAttr(hostChar, attrName);

        let count = 0;
        if (Array.isArray(children)) {
            for (const item of children) {
                const targetChar = window.Campaign?.characters?.get(item.charId);
                if (targetChar) {
                    if (isDebuff || item.rowId.startsWith("condition-")) {
                        await this.toggleCondition(targetChar, item.rowId, false);
                        const hAttr = Roll20Bridge.findAttr(targetChar, `${item.rowId}_link_host_id`);
                        if (hAttr) hAttr.destroy();
                    } else {
                        await this.toggleBuff(targetChar, item.rowId, false);
                    }
                    this.notifyTokenRefresh(targetChar);
                    count++;
                    continue;
                }

                // 下游为纯 Token：移除其自定义字段中的对应条目（Buff 与 Debuff 都查，链接随条目消失）
                const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                if (!targetToken) continue;
                const buffsList = TokenBuffManager.getTokenBuffs(targetToken);
                const debuffsList = TokenBuffManager.getTokenDebuffs(targetToken);
                const buffsFiltered = buffsList.filter(e => e.rowId !== item.rowId);
                const debuffsFiltered = debuffsList.filter(e => (e.rowId || e.key) !== item.rowId);
                if (buffsFiltered.length !== buffsList.length || debuffsFiltered.length !== debuffsList.length) {
                    TokenBuffManager.saveTokenBuffs(targetToken, buffsFiltered);
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffsFiltered);
                    this.notifyTokenRefresh(targetToken);
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
        let children = Roll20Bridge.readJsonAttr(hostChar, attrName);
        if (!Array.isArray(children)) children = [];
        if (!children.some(c => c.charId === childCharId && c.rowId === childRowId)) {
            children.push({ charId: childCharId, rowId: childRowId });
        }
        Roll20Bridge.writeJsonAttr(hostChar, attrName, children);
    }

    /**
     * 宿主源 Buff / Debuff 移除下游受术者订阅关系
     */
    static async removeDownstreamLink(hostChar, hostRowId, childCharId, childRowId) {
        if (!hostChar || !hostRowId || !hostChar.attribs) return;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const attrName = hostRowId.startsWith("condition-") ? `${hostRowId}_link_children` : `repeating_buff2_${hostRowId}_link_children`;
        const children = Roll20Bridge.readJsonAttr(hostChar, attrName, null);
        if (!Array.isArray(children)) return;
        const filtered = children.filter(c => !(c.charId === childCharId && (c.rowId === childRowId || (!c.rowId && childRowId === hostRowId))));
        Roll20Bridge.writeJsonAttr(hostChar, attrName, filtered, { destroyIfEmpty: true });
    }

    /**
     * 断开指定 Buff / Debuff 的影子链接，将其转为完全独立的本地副本（并从宿主订阅表中除名）
     */
    static async unlinkBuff(character, rowId) {
        if (!character || !rowId || !character.attribs) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const isDebuff = rowId.startsWith("condition-");
        const prefix = isDebuff ? rowId : `repeating_buff2_${rowId}`;
        const hostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
        const srcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);

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
            let hostAttr = Roll20Bridge.findAttr(targetChar, hostAttrName);
            if (!hostAttr) {
                targetChar.attribs.create({ name: hostAttrName, current: linkHostId });
            } else {
                hostAttr.save({ current: linkHostId });
            }

            const srcRowId = linkSourceRowId || conditionKey;
            let srcAttr = Roll20Bridge.findAttr(targetChar, srcAttrName);
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
            const oldHostAttr = Roll20Bridge.findAttr(targetChar, hostAttrName);
            const oldSrcAttr = Roll20Bridge.findAttr(targetChar, srcAttrName);
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
                const children = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
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
                    // 下游为纯 Token：移除其自定义字段中的对应条目（链接随条目一起消失）
                    const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                    if (targetToken) {
                        const entries = TokenBuffManager.getTokenBuffs(targetToken);
                        const filtered = entries.filter(e => e.rowId !== item.rowId);
                        if (filtered.length !== entries.length) {
                            TokenBuffManager.saveTokenBuffs(targetToken, filtered);
                        }
                    }
                    // 除名
                    await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                }

                // 防御性校验：若小弟自毁后由于历史异常未能主动除名，老大强制将其剔除，确保循环必收敛
                const curChildren = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && c.rowId === item.rowId)) {
                    await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自身也是某个上一级宿主的子条目，在自身自毁时自然向上一级宿主除名
            const hostAttr = Roll20Bridge.findAttr(character, `${prefix}_link_host_id`);
            const srcAttr = Roll20Bridge.findAttr(character, `${prefix}_link_source_row_id`);
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

                // 同步从 _reporder_repeating_buff2 顺序列表中移除
                const orderAttr = Roll20Bridge.findAttr(character, "_reporder_repeating_buff2");
                if (orderAttr && orderAttr.get("current")) {
                    const curVal = String(orderAttr.get("current"));
                    const filtered = curVal.split(",").filter(id => id.trim().toLowerCase() !== rowId.toLowerCase()).join(",");
                    if (filtered !== curVal) {
                        orderAttr.save({ current: filtered }, { bySuite: true });
                    }
                }

                RecalcService.request(character, { reason: "delete_buff_permanently" });
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
                const children = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
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
                    // 下游为纯 Token：移除其自定义字段中的对应 Debuff 登记
                    const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
                    if (targetToken) {
                        TokenBuffManager.removeTrackedDebuff(targetToken, item.rowId || conditionKey);
                    }
                    // 除名
                    await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                }

                // 防御性校验：确保必定收敛剔除
                const curChildren = Roll20Bridge.readJsonAttr(character, childrenAttrName, null);
                if (Array.isArray(curChildren) && curChildren.some(c => c.charId === item.charId && (c.rowId === item.rowId || (!c.rowId && item.rowId === conditionKey)))) {
                    await this.removeDownstreamLink(character, conditionKey, item.charId, item.rowId || conditionKey);
                }
            }

            // === 阶段二：小弟全部除名销毁后，自身再行销毁 ===
            // 1. 若自己是受术者（记录了 link_host_id），在自毁时向上级施法者汇报并在其 link_children 中除名
            const hostAttrName = `${conditionKey}_link_host_id`;
            const srcAttrName = `${conditionKey}_link_source_row_id`;
            let hostAttr = Roll20Bridge.findAttr(character, hostAttrName);
            let srcAttr = Roll20Bridge.findAttr(character, srcAttrName);
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
            let leftChildrenAttr = Roll20Bridge.findAttr(character, childrenAttrName);
            if (leftChildrenAttr) leftChildrenAttr.destroy();

            // 3. 关停自身该状态并销毁轮数
            await this.toggleCondition(character, conditionKey, false);
            const roundsAttr = Roll20Bridge.findAttr(character, `${conditionKey}_rounds`);
            if (roundsAttr) roundsAttr.destroy();

            // 4. 从 tracked_debuffs 属性中彻底除名
            await this.removeTrackedDebuff(character, conditionKey);

            this.notifyTokenRefresh(character);

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
        const childRoundsAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_rounds`);
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
                    const sourceRowAttr = Roll20Bridge.findAttr(c, `${prefix}_link_source_row_id`);
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
     * 下游副本是否仍然存在（人物卡子行 / Token 自定义字段条目 / Debuff 登记）。
     * 仅目标存在而子副本已被删除 → 视为幽灵登记。
     */
    static _downstreamCopyAlive(childRef) {
        const char = window.Campaign?.characters?.get(childRef.charId);
        if (char && char.attribs) {
            return !!Roll20Bridge.findAttr(char, `repeating_buff2_${childRef.rowId}_name`);
        }
        const token = Roll20Bridge.getTokenGraphic(childRef.charId);
        if (token) {
            if (TokenBuffManager.getTokenBuffs(token).some(e => e.rowId === childRef.rowId)) return true;
            return TokenBuffManager.getTokenDebuffs(token).some(d => (d.rowId || d.key) === childRef.rowId);
        }
        return false;
    }

    /**
     * 父子 Buff 链接拓扑自愈：以 GM 身份加载房间后运行一次（不再随每次加减 Buff 运行）。
     * 1. 幽灵剔除：link_children 中下游副本已不存在的登记被清除（目标存在但子行已删也算幽灵）；
     * 2. 索引重建：下游索引缺失时，全战役反向发现并重建。
     * @returns {number} 发生过修复的宿主条目数
     */
    static async healDownstreamTopology() {
        if (!window.Campaign?.characters) return 0;
        let healed = 0;
        for (const host of window.Campaign.characters.models) {
            try {
                await Roll20Bridge.ensureCharacterAttributes(host);

                // 正面 Buff 宿主
                const buffs = await this.getAllBuffs(host);
                for (const buff of buffs) {
                    if (buff.linkHostId && buff.linkSourceRowId) continue; // 自己是子节点，跳过
                    const attrName = `repeating_buff2_${buff.rowId}_link_children`;
                    const raw = Array.isArray(buff.linkChildren) ? buff.linkChildren : [];
                    // 1. 幽灵剔除：下游副本已不存在
                    const kids = raw.filter(k => this._downstreamCopyAlive(k));
                    // 2. 索引缺失重建
                    if (kids.length === 0) {
                        const found = await this.discoverDownstreamLinks(host.id, buff.rowId);
                        if (found.length > 0) kids.push(...found);
                    }
                    if (kids.length !== raw.length || (raw.length === 0 && kids.length > 0)) {
                        const existing = Roll20Bridge.findAttr(host, attrName);
                        const json = JSON.stringify(kids);
                        if (existing) existing.save({ current: json });
                        else host.attribs.create({ name: attrName, current: json });
                        healed++;
                        console.log(`[Pf1eBuffManager] 拓扑自愈：[${host.get("name")}] 的 Buff [${buff.name}] 清理至 ${kids.length} 个有效下游索引`);
                    }
                }

                // Debuff 宿主
                const debuffs = Pf1eBuffUI.getAllDebuffsSync(host);
                for (const d of debuffs) {
                    const attrName = `${d.key}_link_children`;
                    let raw = [];
                    const existing = Roll20Bridge.findAttr(host, attrName);
                    if (existing && existing.get("current")) {
                        try { raw = JSON.parse(existing.get("current")); } catch (e) { raw = []; }
                    }
                    if (!Array.isArray(raw)) raw = [];
                    const kids = raw.filter(k => this._downstreamCopyAlive(k));
                    if (kids.length === 0) {
                        const found = await this.discoverDownstreamLinks(host.id, d.key);
                        if (found.length > 0) kids.push(...found);
                    }
                    if (kids.length !== raw.length || (raw.length === 0 && kids.length > 0)) {
                        const json = JSON.stringify(kids);
                        if (kids.length > 0) {
                            if (existing) existing.save({ current: json });
                            else host.attribs.create({ name: attrName, current: json });
                        } else if (existing) {
                            existing.destroy();
                        }
                        healed++;
                        console.log(`[Pf1eBuffManager] 拓扑自愈：[${host.get("name")}] 的 Debuff [${d.name}] 清理至 ${kids.length} 个有效下游索引`);
                    }
                }
            } catch (e) {
                console.error(`[Pf1eBuffManager] 拓扑自愈异常 ([${host.get("name")}]):`, e);
            }
        }
        return healed;
    }

    /**
     * 从宿主广播同步给所有下游订阅副本 (拓扑自愈由 GM 加载房间后的 healDownstreamTopology 统一执行)
     */
    static async broadcastDownstreamSync(hostChar, hostRowId) {
        if (!hostChar || !hostRowId) return 0;
        await Roll20Bridge.ensureCharacterAttributes(hostChar);
        const prefix = `repeating_buff2_${hostRowId}`;
        const children = Roll20Bridge.readJsonAttr(hostChar, `${prefix}_link_children`);
        if (!Array.isArray(children) || children.length === 0) return 0;

        const hostBuffs = await this.getAllBuffs(hostChar);
        const hostBuff = hostBuffs.find(b => b.rowId === hostRowId);
        if (!hostBuff) return 0;

        let count = 0;
        for (const item of children) {
            const targetChar = window.Campaign?.characters?.get(item.charId);
            if (targetChar) {
                const ok = await this.syncBuffToDownstream(hostChar, hostRowId, targetChar, item.rowId);
                if (ok) {
                    count++;
                    this.notifyTokenRefresh(targetChar);
                }
                continue;
            }

            // 下游为纯 Token：同步名称与细目加值（严格保留下游剩余轮数，绝不被宿主覆盖）
            const targetToken = Roll20Bridge.getTokenGraphic(item.charId);
            if (!targetToken) continue;
            const entries = TokenBuffManager.getTokenBuffs(targetToken);
            const entry = entries.find(e => e.rowId === item.rowId);
            if (!entry) continue;

            entry.name = hostBuff.name;
            const cleanAttrs = {};
            if (hostBuff.extraAttrs) {
                for (const [k, v] of Object.entries(hostBuff.extraAttrs)) {
                    if (k === "rounds" || k === "enable_toggle" || k === "name" || k === "init_rounds" || k.startsWith("link_")) continue;
                    cleanAttrs[k] = v;
                }
            }
            entry.extraAttrs = Object.keys(cleanAttrs).length > 0 ? cleanAttrs : null;
            TokenBuffManager.saveTokenBuffs(targetToken, entries);
            count++;
            this.notifyTokenRefresh(targetToken);
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
        let roundsAttr = Roll20Bridge.findAttr(character, attrName);

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
        let initAttr = Roll20Bridge.findAttr(character, attrName);
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
        let nameAttr = Roll20Bridge.findAttr(character, `${prefix}_name`);
        if (!nameAttr) {
            nameAttr = character.attribs.create({ name: `${prefix}_name`, current: name });
        } else {
            nameAttr.save({ current: name });
        }

        // 2. 更新轮数
        let roundsAttr = Roll20Bridge.findAttr(character, `${prefix}_rounds`);
        const roundsVal = (rounds !== null && rounds !== undefined && rounds !== "") ? rounds : "";
        if (!roundsAttr) {
            roundsAttr = character.attribs.create({ name: `${prefix}_rounds`, current: roundsVal });
        } else {
            roundsAttr.save({ current: roundsVal });
        }

        // 3. 更新预置初始轮数/公式
        if (initRounds !== null && initRounds !== undefined) {
            const initKey = `${prefix}_init_rounds`;
            let initAttr = Roll20Bridge.findAttr(character, initKey);
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
                let attr = Roll20Bridge.findAttr(character, fullKey);
                if (!attr) {
                    character.attribs.create({ name: fullKey, current: val });
                } else {
                    attr.save({ current: val });
                }
            }
        }

        console.log(`[Pf1eBuffManager] 已更新 ${character.get("name")} 的 Buff [${name}] (${rowId})`);
        RecalcService.request(character, { reason: "update_buff_row" });
        return true;
    }

    /**
     * 下游子节点（人物卡 / 纯 Token 双后端）的统一条目视图。
     * view 为 BuffLifecycle 兼容的 { name, rounds, enabled }；persist() 落盘；onExpire() 过期副作用；notify() 刷新 UI。
     * 目标既非人物卡也非 Token 时返回 null。
     */
    static async _downstreamChildView(childRef, { isDebuff = false, conditionKey = null, buffName = "", hostCharacter = null, hostRowId = null } = {}) {
        const targetChar = window.Campaign?.characters?.get(childRef.charId);

        // ---- 人物卡后端 ----
        if (targetChar && targetChar.attribs) {
            await Roll20Bridge.ensureCharacterAttributes(targetChar);
            const targetName = targetChar.get("name") || "未知角色";

            if (isDebuff) {
                const key = conditionKey || childRef.rowId;
                const condAttr = Roll20Bridge.findAttr(targetChar, key);
                const isActive = condAttr && this.isConditionValueActive(condAttr.get("current"));
                if (!isActive) return null;
                const roundsAttr = Roll20Bridge.findAttr(targetChar, `${key}_rounds`);
                const raw = roundsAttr ? roundsAttr.get("current") : "";
                const view = {
                    name: `[Debuff链接] ${buffName} (受术者: ${targetName})`,
                    rounds: (raw !== "" && raw !== null && !isNaN(Number(raw))) ? Number(raw) : 0,
                    enabled: true
                };
                return {
                    view,
                    persist: async () => {
                        if (roundsAttr) roundsAttr.save({ current: view.rounds }, { byScript: true });
                        else targetChar.attribs.create({ name: `${key}_rounds`, current: view.rounds });
                    },
                    onExpire: async () => {
                        await this.toggleCondition(targetChar, key, false);
                        const hostAttr = Roll20Bridge.findAttr(targetChar, `${key}_link_host_id`);
                        if (hostAttr) hostAttr.destroy();
                    },
                    notify: () => this.notifyTokenRefresh(targetChar)
                };
            }

            const childPrefix = `repeating_buff2_${childRef.rowId}`;
            const toggleAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_enable_toggle`);
            if (!toggleAttr || Number(toggleAttr.get("current")) !== 1) return null;
            const roundsAttr = Roll20Bridge.findAttr(targetChar, `${childPrefix}_rounds`);
            const raw = roundsAttr ? roundsAttr.get("current") : "";
            const view = {
                name: `${buffName} (受术者: ${targetName})`,
                rounds: (raw !== "" && raw !== null && !isNaN(Number(raw))) ? Number(raw) : null,
                enabled: true
            };
            return {
                view,
                persist: async () => {
                    if (roundsAttr) roundsAttr.save({ current: view.rounds }, { byScript: true });
                    else await this.setBuffRounds(targetChar, childRef.rowId, view.rounds);
                },
                onExpire: async () => { await this.removeBuff(targetChar, childRef.rowId); },
                notify: () => this.notifyTokenRefresh(targetChar)
            };
        }

        // ---- 纯 Token 后端 ----
        const targetToken = Roll20Bridge.getTokenGraphic(childRef.charId);
        if (!targetToken) return null;
        const targetName = targetToken.get("name") || "未知棋子";

        if (isDebuff) {
            const key = conditionKey || childRef.rowId;
            const debuffList = TokenBuffManager.getTokenDebuffs(targetToken);
            const entry = debuffList.find(d => (d.key || d.rowId) === key);
            if (!entry || entry.enabled === false) return null;
            const view = {
                name: `[Debuff链接] ${buffName} (受术者: ${targetName})`,
                rounds: entry.rounds,
                enabled: entry.enabled
            };
            return {
                view,
                persist: async () => {
                    entry.rounds = view.rounds;
                    entry.enabled = view.enabled;
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffList);
                },
                onExpire: async () => {
                    // 与人物卡语义一致：关停状态并断开影子链接（条目保留为已关停登记）
                    entry.enabled = false;
                    entry.rounds = 0;
                    entry.linkHostId = null;
                    entry.linkSourceRowId = null;
                    TokenBuffManager.saveTokenDebuffs(targetToken, debuffList);
                },
                notify: () => this.notifyTokenRefresh(targetToken)
            };
        }

        const buffList = TokenBuffManager.getTokenBuffs(targetToken);
        const entry = buffList.find(e => e.rowId === childRef.rowId);
        if (!entry || entry.enabled === false) return null;
        const view = {
            name: `${buffName} (受术者: ${targetName})`,
            rounds: entry.rounds,
            enabled: entry.enabled
        };
        return {
            view,
            persist: async () => {
                entry.rounds = view.rounds;
                entry.enabled = view.enabled;
                TokenBuffManager.saveTokenBuffs(targetToken, buffList);
            },
            onExpire: async () => {
                const idx = buffList.indexOf(entry);
                if (idx >= 0) buffList.splice(idx, 1);
                TokenBuffManager.saveTokenBuffs(targetToken, buffList);
                // 条目已随过期移除，同步向宿主除名，杜绝幽灵计数
                if (hostCharacter && hostRowId) {
                    await this.removeDownstreamLink(hostCharacter, hostRowId, childRef.charId, childRef.rowId);
                }
            },
            notify: () => this.notifyTokenRefresh(targetToken)
        };
    }

    /**
     * 回合开始时扣减当前行动单位的 Buff / Debuff 轮数，并精准驱动扣减其名下所有主 Buff 的下游链接副本
     * 遵循规范：
     * 1. 链接 Buff (isLinkedChild) 绝不在受术者自己的先攻位扣轮，而在施法者回合开始时扣减；
     * 2. 施法者名下所有主 Buff 的下游受术者副本统一扣减 1 轮（即便主 Buff 未开启或轮数不足），受术者归零时自动解除；
     * 3. 激活的 Debuff：正数逐轮倒扣至 0 解除；0 或负数则持续正计轮 (0 -> -1 -> -2...)。
     * 轮数判定规则统一委托至 BuffLifecycle，本方法只负责属性持久化与下游联动。
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

                const result = BuffLifecycle.decrementEntry(buff);
                if (!result) continue;

                if (result.status === "expired") {
                    await this.removeBuff(character, buff.rowId);
                    processed.push({ name: buff.name, status: "expired", remaining: 0 });
                } else {
                    if (buff.roundsAttr) {
                        buff.roundsAttr.save({ current: result.remaining }, { byScript: true });
                    } else {
                        await this.setBuffRounds(character, buff.rowId, result.remaining);
                    }
                    processed.push(result);
                }
            }

            // 2. 施法者主 Buff 驱动下游受术者扣轮
            // 无论主 Buff 自身是否开启，名下所有已建立链接的受术者副本统一扣减 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const child = await this._downstreamChildView(childRef, { buffName: buff.name, hostCharacter: character, hostRowId: buff.rowId });
                    if (!child) continue;

                    const result = BuffLifecycle.decrementEntry(child.view);
                    if (!result) continue;

                    if (result.status === "expired") {
                        await child.onExpire();
                        processed.push({ name: child.view.name, status: "expired", remaining: 0 });
                    } else {
                        await child.persist();
                        processed.push(result);
                    }
                    child.notify();
                }
            }

            // 2.2 施法者 Debuff 驱动下游受术者扣轮
            // 施法者名下所有建立链接的 Debuff，无论施法者自身是否处于该状态，统一驱动扣减受术者 1 轮
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const children = Roll20Bridge.readJsonAttr(character, `${def.key}_link_children`);
                if (!Array.isArray(children) || children.length === 0) continue;

                for (const childRef of children) {
                    const child = await this._downstreamChildView(childRef, { isDebuff: true, conditionKey: def.key, buffName: def.name });
                    if (!child) continue;

                    const result = BuffLifecycle.decrementEntry(child.view, { isDebuff: true });
                    if (!result) continue;

                    if (result.status === "expired") {
                        await child.onExpire();
                        processed.push({ name: child.view.name, status: "expired", remaining: 0 });
                    } else {
                        await child.persist();
                        processed.push(result);
                    }
                    child.notify();
                }
            }

            // 3. 扣减 / 累加自身 Debuff (负面状态 condition-*)
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = Roll20Bridge.findAttr(character, def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = this.isConditionValueActive(val);
                if (!isActive) continue;

                // 若该 Debuff 是影子链接副本 (由施法者远程驱动)，受术者自己回合绝不自扣！
                const hostAttr = Roll20Bridge.findAttr(character, `${def.key}_link_host_id`);
                if (hostAttr && hostAttr.get("current")) {
                    continue;
                }

                let roundsAttr = Roll20Bridge.findAttr(character, `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                // 缺失轮数属性按 0 轮处理（进入正计轮分支）
                const result = BuffLifecycle.decrementEntry(
                    { name: `[Debuff] ${def.name}`, rounds: hasRounds ? Number(rawRounds) : 0 },
                    { isDebuff: true }
                );
                if (!result) continue;

                if (result.status === "expired") {
                    await this.toggleCondition(character, def.key, false);
                    processed.push({ name: `[Debuff] ${def.name}`, status: "expired", remaining: 0 });
                } else if (result.status === "counted" && !roundsAttr) {
                    character.attribs.create({
                        name: `${def.key}_rounds`,
                        current: result.remaining
                    });
                    processed.push(result);
                } else {
                    roundsAttr.save({ current: result.remaining }, { byScript: true });
                    processed.push(result);
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

                const result = BuffLifecycle.incrementEntry(buff);
                if (!result) continue;

                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: result.remaining }, { byScript: true });
                } else {
                    await this.setBuffRounds(character, buff.rowId, result.remaining);
                }
                processed.push({ name: buff.name, status: "incremented", remaining: result.remaining });
            }

            // 2. 施法者主 Buff 驱动下游受术者加回 1 轮
            for (const buff of allBuffs) {
                if (buff.linkHostId && buff.linkSourceRowId) continue;
                if (!buff.linkChildren || buff.linkChildren.length === 0) continue;

                for (const childRef of buff.linkChildren) {
                    const child = await this._downstreamChildView(childRef, { buffName: buff.name, hostCharacter: character, hostRowId: buff.rowId });
                    if (!child) continue;

                    const result = BuffLifecycle.incrementEntry(child.view);
                    if (!result) continue;

                    await child.persist();
                    child.notify();
                    processed.push({ name: child.view.name, status: "incremented", remaining: result.remaining });
                }
            }

            // 3. 加回自身 Debuff
            await Roll20Bridge.ensureCharacterAttributes(character);
            for (const def of this.PF1E_DEBUFF_DEFINITIONS) {
                const condAttr = Roll20Bridge.findAttr(character, def.key);
                if (!condAttr) continue;
                const val = condAttr.get("current");
                const isActive = this.isConditionValueActive(val);
                if (!isActive) continue;

                let roundsAttr = Roll20Bridge.findAttr(character, `${def.key}_rounds`);
                const rawRounds = roundsAttr ? roundsAttr.get("current") : "";
                const hasRounds = rawRounds !== "" && rawRounds !== null && !isNaN(Number(rawRounds));
                if (!hasRounds) continue;

                const result = BuffLifecycle.incrementEntry({ name: `[Debuff] ${def.name}`, rounds: Number(rawRounds) });
                if (!result) continue;

                roundsAttr.save({ current: result.remaining }, { byScript: true });
                processed.push({ name: `[Debuff] ${def.name}`, status: "incremented", remaining: result.remaining });
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
