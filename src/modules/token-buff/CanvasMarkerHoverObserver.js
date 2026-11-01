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

        this.isStarted = true;
        console.log("[CanvasMarkerHoverObserver] 画布标记悬停原生提示探测器已就绪");
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
        // 使用事件捕获监听点击或悬停进入 marker 菜单
        document.addEventListener("mouseover", (e) => {
            const target = e.target;
            if (!target) return;

            // 匹配标记选择菜单中的各个图标项
            const markerItem = target.closest?.(".markermenu .marker, [data-action='toggle-marker'], .markermenu div");
            if (!markerItem || markerItem.dataset.titleInjected) return;

            const tagName = markerItem.dataset.tag || markerItem.dataset.name || markerItem.className || "";
            if (tagName) {
                const tooltip = Pf1eConditionRegistry.getTooltipForMarker(tagName);
                if (tooltip) {
                    markerItem.title = tooltip;
                    markerItem.dataset.titleInjected = "true";
                }
            }
        }, true);
    }
}
