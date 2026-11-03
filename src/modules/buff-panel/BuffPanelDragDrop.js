/**
 * BuffPanelDragDrop.js
 * 状态Buff工作台拖拽手势与交互处理器（宿主 jQuery UI 窗口拖拽、栏内排序、跨栏复制）
 */
export class BuffPanelDragDrop {
    /**
     * 初始化窗口标题栏拖拽移动（严格以标题栏尺寸与视口边缘进行约束，杜绝误用整窗高度）
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
        const header = panelEl.querySelector(".r20-panel-header");

        // 统一以标题栏为物理边界的 Clamp 算法
        const clampPosition = (left, top) => {
            const headerH = header ? header.offsetHeight : 34;
            const panelW = panelEl.offsetWidth || 320;
            const minLeft = 10;
            const maxLeft = Math.max(minLeft, window.innerWidth - panelW - 10);
            const minTop = 10;
            const maxTop = Math.max(minTop, window.innerHeight - headerH - 10);

            return {
                left: Math.max(minLeft, Math.min(maxLeft, left)),
                top: Math.max(minTop, Math.min(maxTop, top))
            };
        };

        if (window.$ && typeof window.$.fn.draggable === "function") {
            window.$(panelEl).draggable({
                handle: ".r20-panel-header",
                // 移除内置的 containment: "window"，避免其用展开后的 panel 整体高度将标题栏卡死在半空中
                drag: (event, ui) => {
                    const clamped = clampPosition(ui.position.left, ui.position.top);
                    ui.position.left = clamped.left;
                    ui.position.top = clamped.top;

                    if (onDragging) onDragging(clamped.left, clamped.top);
                },
                stop: (event, ui) => {
                    const clamped = clampPosition(ui.position.left, ui.position.top);
                    panelEl.style.left = `${clamped.left}px`;
                    panelEl.style.top = `${clamped.top}px`;
                    panelEl.style.bottom = "auto";
                    panelEl.style.right = "auto";
                    if (onDragEnd) onDragEnd(clamped.left, clamped.top);
                }
            });
            return;
        }

        // 降级原生 DOM 拖拽方案（同样以标题栏为边界）
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener("mousedown", (e) => {
            if (e.target.tagName === "BUTTON") return;
            e.stopPropagation();
            e.preventDefault();

            isDragging = true;
            header.style.cursor = "grabbing";
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = panelEl.offsetLeft;
            initialTop = panelEl.offsetTop;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                const clamped = clampPosition(initialLeft + dx, initialTop + dy);

                panelEl.style.left = `${clamped.left}px`;
                panelEl.style.top = `${clamped.top}px`;
                panelEl.style.bottom = "auto";
                panelEl.style.right = "auto";

                if (onDragging) onDragging(clamped.left, clamped.top);
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    if (onDragEnd) onDragEnd(panelEl.offsetLeft, panelEl.offsetTop);
                }
                document.removeEventListener("mousemove", onMouseMove, true);
                document.removeEventListener("mouseup", onMouseUp, true);
            };

            document.addEventListener("mousemove", onMouseMove, true);
            document.addEventListener("mouseup", onMouseUp, true);
        });
    }

    /**
     * 为树节点挂载拖拽手势
     */
    static setupItemDrag({ el, node, parentList, index, sourcePane, getDraggedContext, setDraggedContext, onCrossCopy, onReorder }) {
        el.addEventListener("dragstart", (e) => {
            e.stopPropagation();
            setDraggedContext({ node, parentList, index, sourcePane });
            e.dataTransfer.setData("text/plain", node.name);
            el.style.opacity = "0.5";
        });

        el.addEventListener("dragend", (e) => {
            e.stopPropagation();
            el.style.opacity = "1";
            document.querySelectorAll(".r20-drag-over, .r20-drag-into").forEach(item => {
                item.classList.remove("r20-drag-over", "r20-drag-into");
            });
        });

        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (node.type === "folder") {
                const rect = el.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                if (offsetX < 36) {
                    el.classList.remove("r20-drag-into");
                    el.classList.add("r20-drag-over");
                } else {
                    el.classList.remove("r20-drag-over");
                    el.classList.add("r20-drag-into");
                }
            } else {
                el.classList.add("r20-drag-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-over", "r20-drag-into");
        });

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = el.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const isPeerDrop = node.type === "folder" ? (offsetX < 36) : true;

            el.classList.remove("r20-drag-over", "r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            if (fromPane === "unit" && sourcePane === "template") {
                if (onCrossCopy) await onCrossCopy(draggedNode, node, parentList, index, isPeerDrop);
                setDraggedContext(null);
                return;
            }

            if (fromPane === "unit" && sourcePane === "unit") {
                if ((draggedNode.rowId && draggedNode.rowId === node.rowId) || (draggedNode.id && draggedNode.id === node.id)) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index);
                setDraggedContext(null);
                return;
            }

            if (fromPane === "template" && sourcePane === "template" && sourceList) {
                if (draggedNode.id === node.id) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index, isPeerDrop);
                setDraggedContext(null);
            }
        });
    }

    /**
     * 为模板树容器挂载兜底空白区放置监听
     */
    static setupTreeContainerDrop({ el, getDraggedContext, setDraggedContext, onCrossCopyRoot, onReorderRoot }) {
        el.addEventListener("dragover", (e) => {
            if (e.target === el || el.contains(e.target)) {
                e.preventDefault();
                el.classList.add("r20-drag-container-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove("r20-drag-container-over");
            }
        });

        el.addEventListener("drop", async (e) => {
            if (e.target === el || el.contains(e.target)) {
                e.preventDefault();
                el.classList.remove("r20-drag-container-over");
                const dragged = getDraggedContext();
                if (!dragged) return;
                const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

                if (fromPane === "unit") {
                    if (onCrossCopyRoot) await onCrossCopyRoot(draggedNode);
                } else if (fromPane === "template" && sourceList) {
                    if (onReorderRoot) await onReorderRoot(draggedNode, sourceList, sourceIdx);
                }
                setDraggedContext(null);
            }
        });
    }
}
