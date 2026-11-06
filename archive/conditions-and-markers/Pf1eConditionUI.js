/**
 * Pf1eConditionUI.js (ARCHIVED - 封存模块，不参与编译)
 * 原负责先攻条中负面状态 (Debuff / Condition) 徽章样式渲染、点击编辑已过轮数弹窗与解除逻辑
 * 按照用户指令已于 2026-11-05 彻底停用并封存于此。
 */
export class Pf1eConditionUI {
    /**
     * 单个负面状态 (Condition) 点击快捷编辑已过轮数或解除弹窗
     */
    static showConditionEditModal(character, token, cond, row, tokenId, onMutation) {
        const mask = document.createElement("div");
        mask.className = "r20-dialog-mask";

        const currentElapsedStr = (cond.rounds !== null && cond.rounds < 0) ? String(Math.abs(cond.rounds)) : "";

        mask.innerHTML = `
            <div class="r20-dialog-box" style="width: 320px;">
                <div class="r20-dialog-header" style="color:#f43f5e;">负面状态: ${cond.name}</div>
                <div class="r20-dialog-body">
                    <label style="font-size:11px; color:#b0bec5;">已持续轮数 (正计轮，留空为常驻):</label>
                    <input type="number" class="r20-input-text input-rounds" value="${currentElapsedStr}" placeholder="如 1, 2, 3..." />
                </div>
                <div class="r20-dialog-footer">
                    <button class="r20-btn-icon danger btn-delete" style="padding:6px 12px; margin-right:auto;">✕ 解除状态</button>
                    <button class="r20-btn-icon btn-cancel" style="padding:6px 12px;">取消</button>
                    <button class="r20-btn-apply btn-save" style="padding:6px 14px;">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(mask);
        mask.querySelector(".btn-cancel").addEventListener("click", () => mask.remove());

        mask.querySelector(".btn-delete").addEventListener("click", async () => {
            try {
                if (character && window.Roll20Suite?.Pf1eBuffManager?.removeCondition) {
                    await window.Roll20Suite.Pf1eBuffManager.removeCondition(character, cond.key);
                }
            } catch (err) {
                console.error("[Pf1eConditionUI] 解除状态异常:", err);
            } finally {
                mask.remove();
                if (typeof onMutation === "function") onMutation();
            }
        });

        mask.querySelector(".btn-save").addEventListener("click", async () => {
            const inputVal = mask.querySelector(".input-rounds").value.trim();
            try {
                if (character && window.Roll20Suite?.Pf1eBuffManager?.setConditionRounds) {
                    const parsedRounds = inputVal === "" ? null : Number(inputVal);
                    await window.Roll20Suite.Pf1eBuffManager.setConditionRounds(character, cond.key, parsedRounds);
                }
            } catch (err) {
                console.error("[Pf1eConditionUI] 更新状态轮数异常:", err);
            } finally {
                mask.remove();
                if (typeof onMutation === "function") onMutation();
            }
        });
    }
}
