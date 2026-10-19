import { Roll20Bridge } from "../../core/Roll20Bridge.js";

/**
 * Pf1eBuffManager.js
 * 负责扫描并管理 PF1e 角色卡上的原生 repeating_buff2 重复列表
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
            // 提取前缀，形如 "repeating_buff2_-P4JOasf4oi-30Rh78tV"
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
                roundsAttr: roundsAttr || null,
                icon: buffType === "spell" ? "✨" : "🛡️"
            });
        }

        return activeBuffs;
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
            // 如果玩家未给此 Buff 设置轮数（rounds 为 null），视为常驻 Buff，不扣减
            if (buff.rounds === null) continue;

            const newRounds = buff.rounds - 1;

            if (newRounds <= 0) {
                // 1. 轮数归零：自动关闭 PF1e 卡上的 enable_toggle 开关
                buff.toggleAttr.save({ current: 0 });
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: 0 });
                }

                // 2. 聊天栏播报法术效果结束
                const msg = `&{template:default} {{name=Buff 持续时间结束}} {{角色=${charName}}} {{效果=${buff.name}}} {{提示=持续时间已耗尽，已自动取消勾选生效。}}`;
                Roll20Bridge.sendChatMessage(msg);

                processed.push({ name: buff.name, status: "expired", remaining: 0 });
                console.log(`[Pf1eBuffManager] ${charName} 的 Buff [${buff.name}] 持续时间归零，已自动关闭`);
            } else {
                // 2. 轮数递减：更新卡片上的 rounds 字段
                if (buff.roundsAttr) {
                    buff.roundsAttr.save({ current: newRounds });
                } else {
                    await this.setBuffRounds(character, buff.rowId, newRounds);
                }

                processed.push({ name: buff.name, status: "decremented", remaining: newRounds });
                console.log(`[Pf1eBuffManager] ${charName} 的 Buff [${buff.name}] 扣减 1 轮，剩余 ${newRounds} 轮`);
            }
        }

        return processed;
    }
}
