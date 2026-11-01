import { Roll20Bridge } from "../../core/Roll20Bridge.js";
import { Pf1eConditionRegistry } from "../pf1e-buff-tracker/Pf1eConditionRegistry.js";

/**
 * CanvasMarkerHoverObserver.js
 * 负责在画布上检测鼠标是否悬停在特定棋子的状态标记上方
 * 0 DOM 污染，直接复用 <canvas>.title 原生展现传统黄底黑字提示
 */
export class CanvasMarkerHoverObserver {
    static isStarted = false;
    static _rafId = null;
    static _lastMatchedTag = null;

    /**
     * 启动画布标记悬停探测器
     */
    static start() {
        if (this.isStarted) return;

        const canvas = document.getElementById("babylonCanvas") || document.querySelector("canvas");
        if (!canvas) {
            console.warn("[CanvasMarkerHoverObserver] 未找到主渲染画布，延迟重试");
            setTimeout(() => this.start(), 1500);
            return;
        }

        // 1. 监听画布上的鼠标移动，节流命中检测
        canvas.addEventListener("mousemove", (e) => {
            if (this._rafId) return;
            this._rafId = requestAnimationFrame(() => {
                this._rafId = null;
                this.handleMouseMove(canvas, e.clientX, e.clientY);
            });
        }, { passive: true });

        // 2. 鼠标离开画布时清空 title
        canvas.addEventListener("mouseleave", () => {
            if (canvas.title !== "") {
                canvas.title = "";
                this._lastMatchedTag = null;
            }
        }, { passive: true });

        // 3. 增强标记选择面板 (Marker Menu Picker) 原生 title 汉化
        this.bindMarkerPickerEnhancer();

        // 4. 监听棋子标记手动变动，反向联动人物卡/先攻栏 Debuff
        this.bindTokenMarkerChangeListeners();

        this.isStarted = true;
        console.log("[CanvasMarkerHoverObserver] 画布标记悬停原生提示与双向联动已就绪");
    }

    /**
     * 监听棋子标记手动变动，实现棋子加/删标记自动反向联动人物卡/先攻栏 Debuff
     */
    static bindTokenMarkerChangeListeners() {
        const page = Roll20Bridge.getCurrentPage();
        if (!page || !page.thegraphics) return;

        const boundTokens = new Set();

        const attachToToken = (token) => {
            if (!token || boundTokens.has(token.id)) return;
            boundTokens.add(token.id);

            token.on("change:statusmarkers", async (t, newSM, options) => {
                // 若为脚本自主同步，彻底静音跳过，防止回路震荡
                if (options?.byScript || Pf1eBuffManager.isScriptMutating) return;

                const character = Roll20Bridge.getCharacterByToken(t);
                if (!character) return;

                const oldSM = t.previous("statusmarkers") || "";
                const oldTags = new Set(oldSM.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean));
                const newTags = new Set((newSM || "").split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean));

                // 1. 查找新增的 tags
                for (const tag of newTags) {
                    if (!oldTags.has(tag)) {
                        const baseName = tag.split("::")[0];
                        const def = Pf1eConditionRegistry.find(baseName) || Pf1eConditionRegistry.find(tag);
                        if (def) {
                            await Pf1eBuffManager.applyCondition(character, def.attrKey || def.id, -1);
                        }
                    }
                }

                // 2. 查找移除的 tags
                for (const tag of oldTags) {
                    if (!newTags.has(tag)) {
                        const baseName = tag.split("::")[0];
                        const def = Pf1eConditionRegistry.find(baseName) || Pf1eConditionRegistry.find(tag);
                        if (def) {
                            await Pf1eBuffManager.removeCondition(character, def.attrKey || def.id);
                        }
                    }
                }

                // 刷新先攻栏
                Pf1eBuffUI.requestTokenRefresh(t.id);
            });
        };

        page.thegraphics.each(attachToToken);
        page.thegraphics.on("add", attachToToken);
    }

    /**
     * 处理鼠标在画布上的移动并检测 Marker 命中
     */
    static handleMouseMove(canvas, mouseX, mouseY) {
        const campaign = Roll20Bridge.getCampaign();
        const page = Roll20Bridge.getCurrentPage();
        if (!campaign || !page || !page.thegraphics) return;

        let hitTag = null;
        let hitTooltip = null;

        // 遍历当前地图所有携带 statusmarkers 的 Token Graphic
        for (let i = 0; i < page.thegraphics.length; i++) {
            const token = page.thegraphics.at(i);
            const sm = token.get("statusmarkers");
            if (!sm || sm === "" || sm === "false") continue;

            const dec = token.view?.graphic?.tokenMarkerDecorator;
            const engine = token.view?.graphic?.engine;
            if (!dec || !engine || !dec.primaryNode) continue;

            const children = dec.primaryNode.getChildren ? dec.primaryNode.getChildren() : [];
            for (const node of children) {
                // 忽略非标记节点
                if (!node || !node.name || node.name.startsWith("instance-array")) continue;

                try {
                    const absPos = node.getAbsolutePosition ? node.getAbsolutePosition() : node.position;
                    if (!absPos || typeof absPos.clone !== "function") continue;

                    const screenPos = engine.getScreenPosition(absPos);
                    if (!screenPos) continue;

                    // 判断鼠标指针是否落在标记图标半径内 (约 15 像素半径)
                    const dist = Math.hypot(mouseX - screenPos.x, mouseY - screenPos.y);
                    if (dist <= 15) {
                        hitTag = node.name;
                        hitTooltip = Pf1eConditionRegistry.getTooltipForMarker(node.name);
                        break;
                    }
                } catch (e) {
                    // 忽略单个节点计算异常
                }
            }
            if (hitTag) break;
        }

        // 更新 canvas.title
        if (hitTag) {
            if (this._lastMatchedTag !== hitTag) {
                this._lastMatchedTag = hitTag;
                canvas.title = hitTooltip || hitTag;
            }
        } else {
            if (this._lastMatchedTag !== null || canvas.title !== "") {
                this._lastMatchedTag = null;
                canvas.title = "";
            }
        }
    }

    /**
     * 自动为选中的棋子标记选择菜单 (Marker Menu) 中的小图标注入原生 title 中文提示
     */
    static bindMarkerPickerEnhancer() {
        document.addEventListener("mouseover", (e) => {
            const target = e.target;
            if (!target) return;

            // 匹配标记选择菜单中的各个图标项 (Roll20 属性为 data-status-id 或 data-action-type)
            const markerItem = target.closest?.(".markermenu .statusicon, .markermenu div[data-status-id], .markermenu [data-action-type]");
            if (!markerItem || markerItem.dataset.titleInjected) return;

            // 优先从 data-status-id 提取准确的 marker 标识（绝不读取 className 兜底）
            let statusId = markerItem.dataset.statusId || "";
            if (!statusId && markerItem.dataset.actionType) {
                statusId = markerItem.dataset.actionType.replace(/^toggle_status_/, "");
            }

            if (statusId) {
                const tooltip = Pf1eConditionRegistry.getTooltipForMarker(statusId);
                if (tooltip) {
                    markerItem.title = tooltip;
                    markerItem.dataset.titleInjected = "true";
                }
            }
        }, true);
    }
}
