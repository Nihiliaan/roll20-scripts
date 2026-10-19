import { Roll20Bridge } from "../../core/Roll20Bridge.js";

/**
 * Pf1eBuffManager.js
 * 负责扫描、添加、修改与关停 PF1e 角色卡上的原生 repeating_buff2 重复列表
 */
export class Pf1eBuffManager {
    /**
     * 获取指定角色卡上所有当前处于勾选激活状态的 Buff
     * @param {object} character Character Backbone 模型
     * @returns {Promise<Array>} 激活的 Buff 列表
     */
    static async getActiveBuffs(character) {
        if (!character) return [];
        await Roll20Bridge.ensureCharacterAttributes(character);

        const activeBuffs = [];
        if (!character.attribs || !character.attribs.models) return [];

        // 查找所有以 repeating_buff2_ 开头且以 _enable_toggle 结尾的属性
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

    /**
     * 为角色卡新增一个原生 Buff 行并激活
     * @param {object} character Character 模型
     * @param {string} buffName Buff 名称
     * @param {number|null} rounds 持续轮数 (null 表示常驻)
     */
    static async addBuff(character, buffName, rounds = null) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const cleanName = (buffName || "新Buff").trim();
        // 生成 Roll20 风格随机 rowId
        const rowId = "-p" + Math.random().toString(36).substring(2, 12);
        const prefix = `repeating_buff2_${rowId}`;

        // 创建行基础属性
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

    /**
     * 关停/解除指定角色身上的某个 Buff
     * @param {object} character Character 模型
     * @param {string} rowId Buff 行ID
     */
    static async removeBuff(character, rowId) {
        if (!character) return false;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const prefix = `repeating_buff2_${rowId}`;
        const toggleAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_enable_toggle`);
        const roundsAttr = character.attribs.models.find(a => a.get("name") === `${prefix}_rounds`);

        if (toggleAttr) {
            // 将开关置 0，PF1e 自带的 Sheet Worker 会自动撤销该 Buff 的全部数值加值
            toggleAttr.save({ current: 0 });
        }
        if (roundsAttr) {
            roundsAttr.save({ current: 0 });
        }

        console.log(`[Pf1eBuffManager] 已解除 ${character.get("name")} 的 Buff (${rowId})`);
        return true;
    }

    /**
     * 为指定的 Buff 行设置/更新剩余轮数
     * @param {object} character Character 模型
     * @param {string} rowId Buff行ID
     * @param {number} rounds 剩余轮数
     */
    static async setBuffRounds(character, rowId, rounds) {
        if (!character) return null;
        await Roll20Bridge.ensureCharacterAttributes(character);

        const attrName = `repeating_buff2_${rowId}_rounds`;
        let roundsAttr = character.attribs.models.find(a => a.get("name") === attrName);

        if (!roundsAttr) {
            roundsAttr = character.attribs.create({
                name: attrName,
                current: rounds,
                max: rounds
            });
        } else {
            roundsAttr.save({ current: rounds });
        }

        return roundsAttr;
    }

    /**
     * 当角色行动结束时，扣减其身上所有已设置轮数的活跃 Buff
     * @param {string} tokenId 行动结束的 Token ID
     * @returns {Promise<Array>} 处理结果汇总
     */
    static async tickBuffsOnTurnEnd(tokenId) {
        const token = Roll20Bridge.getTokenGraphic(tokenId);
        const character = Roll20Bridge.getCharacterByToken(tokenId);
        if (!character) return [];

        const charName = character.get("name") || (token ? token.get("name") : "未知角色");
        const activeBuffs = await this.getActiveBuffs(character);
        const processed = [];

        for (const buff of activeBuffs) {
            // 如果未设置轮数（常驻 Buff），不扣减
            if (buff.rounds === null) continue;

            const newRounds = buff.rounds - 1;

            if (newRounds <= 0) {
                // 轮数归零：自动关闭 PF1e 卡上的开关
                await this.removeBuff(character, buff.rowId);

                // 聊天栏播报法术效果结束
                const msg = `&{template:default} {{name=Buff 持续时间结束}} {{角色=${charName}}} {{效果=${buff.name}}} {{提示=持续时间归零，已自动取消生效。}}`;
                Roll20Bridge.sendChatMessage(msg);

                processed.push({ name: buff.name, status: "expired", remaining: 0 });
            } else {
                // 轮数递减
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
