/**
 * BuffPanelDragDrop.js
 * 状态Buff工作台拖拽手势与交互处理器（宿主 jQuery UI 窗口拖拽、栏内排序、跨栏复制）
 */
export class BuffPanelDragDrop {
    /**
     * 初始化窗口标题栏拖拽移动（调用宿主 jQuery UI，零手写监听）
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
        if (window.$ && typeof window.$.fn.draggable === "function") {
            window.$(panelEl).draggable({
                handle: ".r20-panel-header",
                containment: "window",
                drag: (event, ui) => {
                    if (onDragging) onDragging(ui.position.left, ui.position.top);
                },
                stop: (event, ui) => {
                    panelEl.style.bottom = "auto";
                    panelEl.style.right = "auto";
                    if (onDragEnd) onDragEnd(ui.position.left, ui.position.top);
                }
            });
            return;
        }

        // 降级兜底方案
        const header = panelEl.querySelector(".r20-panel-header");
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
                const newLeft = Math.max(10, Math.min(window.innerWidth - 330, initialLeft + dx));
                const newTop = Math.max(10, Math.min(window.innerHeight - 40, initialTop + dy));

                panelEl.style.left = `${newLeft}px`;
                panelEl.style.top = `${newTop}px`;
                panelEl.style.bottom = "auto";
                panelEl.style.right = "auto";

                if (onDragging) onDragging(newLeft, newTop);
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
            if (e.target === el || e.target.classList.contains("r20-template-tree")) {
                e.preventDefault();
                el.classList.add("r20-drag-container-over");
            }
        });

        el.addEventListener("dragleave", (e) => {
            if (e.target === el) {
                el.classList.remove("r20-drag-container-over");
            }
        });

        el.addEventListener("drop", async (e) => {
            if (e.target === el || e.target.classList.contains("r20-template-tree")) {
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
