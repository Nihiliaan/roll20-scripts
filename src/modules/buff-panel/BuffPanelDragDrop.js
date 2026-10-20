/**
 * BuffPanelDragDrop.js
 * 状态Buff工作台拖拽手势与交互处理器（极简标题栏拖拽、栏内排序、跨栏复制）
 */
export class BuffPanelDragDrop {
    /**
     * 初始化窗口标题栏拖拽移动（拖动主体纯粹为标题栏，绝不跳变）
     */
    static initWindowDrag(panelEl, onDragEnd, onDragging) {
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
                moveEvent.stopPropagation();
                moveEvent.preventDefault();

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

            const onMouseUp = (upEvent) => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = "grab";
                    upEvent.stopPropagation();
                    upEvent.preventDefault();

                    const finalLeft = panelEl.offsetLeft;
                    const finalTop = panelEl.offsetTop;
                    if (onDragEnd) onDragEnd(finalLeft, finalTop);
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
            setDraggedContext({
                node,
                parentList,
                index,
                sourcePane
            });
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
                el.classList.add("r20-drag-into");
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
            el.classList.remove("r20-drag-over", "r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            // 1. 跨栏拖拽：单位栏 -> 模板库 (复制另存为新模板)
            if (fromPane === "unit" && sourcePane === "template") {
                if (onCrossCopy) await onCrossCopy(draggedNode, node, parentList, index);
                setDraggedContext(null);
                return;
            }

            // 2. 栏内排序：模板库 -> 模板库
            if (fromPane === "template" && sourcePane === "template" && sourceList) {
                if (draggedNode.id === node.id) return;
                if (onReorder) await onReorder(draggedNode, sourceList, sourceIdx, node, parentList, index);
                setDraggedContext(null);
            }
        });
    }

    /**
     * 模板库根目录放置区
     */
    static setupRootDropZone({ el, templates, getDraggedContext, setDraggedContext, onCrossCopyRoot, onReorderRoot }) {
        el.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("r20-drag-into");
        });

        el.addEventListener("dragleave", (e) => {
            e.stopPropagation();
            el.classList.remove("r20-drag-into");
        });

        el.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("r20-drag-into");

            const dragged = getDraggedContext();
            if (!dragged) return;
            const { node: draggedNode, parentList: sourceList, index: sourceIdx, sourcePane: fromPane } = dragged;

            if (fromPane === "unit") {
                if (onCrossCopyRoot) await onCrossCopyRoot(draggedNode);
                setDraggedContext(null);
                return;
            }

            if (fromPane === "template" && sourceList) {
                if (onReorderRoot) await onReorderRoot(draggedNode, sourceList, sourceIdx);
                setDraggedContext(null);
            }
        });
    }
}
