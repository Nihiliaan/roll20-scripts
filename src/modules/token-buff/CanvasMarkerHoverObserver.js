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
     * 监听棋子标记变动（完全基于集合生命周期：新建、拖拽、复制粘贴、批量入场、换页全自动装载）
     */
    static bindTokenMarkerChangeListeners() {
        const boundTokens = new Set();
        const tokenLastStatusMarkers = new Map();

        const attachToToken = (token) => {
            if (!token || boundTokens.has(token.id)) return;
            boundTokens.add(token.id);

            // 记录初始标记
            tokenLastStatusMarkers.set(token.id, token.get("statusmarkers") || "");

            token.on("change:statusmarkers", async (t, newSM, options) => {
                const prevKnown = tokenLastStatusMarkers.get(t.id) ?? t.previous("statusmarkers") ?? "";
                tokenLastStatusMarkers.set(t.id, newSM || "");

                // 若为脚本自主同步，彻底静音跳过，防止回路震荡
                if (options?.byScript || Pf1eBuffManager.isScriptMutating) return;

                const character = Roll20Bridge.getCharacterByToken(t);
                if (!character) return;

                const oldTags = new Set(prevKnown.split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean));
                const newTags = new Set((newSM || "").split(",").map(s => s.trim().replace(/@\d+$/, "")).filter(Boolean));

                // 1. 查找新增的 tags (玩家手动在棋子上点击添加标记)
                for (const tag of newTags) {
                    if (!oldTags.has(tag)) {
                        const def = Pf1eConditionRegistry.find(tag);
                        if (def) {
                            console.log(`[CanvasMarkerHoverObserver] 检测到棋子新增标记 [${tag}]，反向激活角色卡 Debuff: ${def.nameZh}`);
                            await Pf1eBuffManager.applyCondition(character, def.attrKey || def.id, -1);
                        }
                    }
                }

                // 2. 查找移除的 tags (玩家手动在棋子上点击移除标记)
                for (const tag of oldTags) {
                    if (!newTags.has(tag)) {
                        const def = Pf1eConditionRegistry.find(tag);
                        if (def) {
                            console.log(`[CanvasMarkerHoverObserver] 检测到棋子移除标记 [${tag}]，反向解除角色卡 Debuff: ${def.nameZh}`);
                            await Pf1eBuffManager.removeCondition(character, def.attrKey || def.id);
                        }
                    }
                }

                // 刷新先攻栏对应徽章
                Pf1eBuffUI.requestTokenRefresh(t.id);
            });
        };

        let boundPageId = null;

        const bindCurrentPageGraphics = () => {
            const page = Roll20Bridge.getCurrentPage();
            if (!page || !page.thegraphics) {
                // 环境尚未就绪，延迟重试直到就绪
                setTimeout(bindCurrentPageGraphics, 500);
                return;
            }

            // 1. 立即挂载当前地图全部已有棋子
            page.thegraphics.each(attachToToken);

            // 若已经给当前页面的 thegraphics 挂过集合级事件，避免重复绑定
            if (boundPageId === page.id) return;
            boundPageId = page.id;

            // 2. 监听新棋子进场（包括拖拽生成、Ctrl+C/V 复制粘贴）
            page.thegraphics.on("add", (token) => {
                attachToToken(token);
            });

            // 3. 监听批量数据载入（云端数据就绪、整页刷新）
            page.thegraphics.on("reset", () => {
                page.thegraphics.each(attachToToken);
            });
        };

        bindCurrentPageGraphics();

        // 4. 监听切换地图事件，自动切换到新地图并装配
        if (window.Campaign) {
            window.Campaign.on("change:playerpageid", () => {
                setTimeout(bindCurrentPageGraphics, 300);
            });
        }
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
     * 自动为选中的棋子标记选择菜单 (Marker Menu) 中的小图标注入原生 title 纯中文提示
     * 并彻底清洗历史遗留的 "statusicon" 错误污染
     */
    static bindMarkerPickerEnhancer() {
        const enhanceItem = (el) => {
            if (!el) return;

            // 优先从 data-status-id 提取准确的 marker 标识（绝不读取 className 兜底）
            let statusId = el.dataset.statusId || "";
            if (!statusId && el.dataset.actionType) {
                statusId = el.dataset.actionType.replace(/^toggle_status_/, "");
            }

            if (statusId) {
                const tooltip = Pf1eConditionRegistry.getTooltipForMarker(statusId);
                if (tooltip && el.title !== tooltip) {
                    el.title = tooltip;
                }
            } else if (el.title && el.title.includes("statusicon")) {
                // 清理历史残留的错误污染
                el.title = "";
            }
        };

        // 1. 鼠标悬停事件委托（极速响应单项）
        document.addEventListener("mouseover", (e) => {
            const target = e.target;
            if (!target) return;

            // 匹配标记选择菜单中的各个图标项 (Roll20 属性为 data-status-id 或 data-action-type)
            const markerItem = target.closest?.(".markermenu .statusicon, .markermenu div[data-status-id], .markermenu [data-action-type]");
            if (markerItem) {
                enhanceItem(markerItem);
            }
        }, true);

        // 2. 观察 DOM 变化，当 .markermenu 展开时一次性批量清洗全部图标 title
        const menuObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.classList?.contains("markermenu") || node.querySelector?.(".markermenu")) {
                        const items = node.querySelectorAll?.(".statusicon, div[data-status-id], [data-action-type]") || [];
                        items.forEach(enhanceItem);
                    }
                }
            }
        });

        menuObserver.observe(document.body, { childList: true, subtree: true });

        // 对页面当前已存在的 markermenu 图标立即执行一次清洗
        document.querySelectorAll(".markermenu .statusicon, .markermenu div[data-status-id]").forEach(enhanceItem);
    }
}
