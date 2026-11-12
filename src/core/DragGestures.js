/**
 * DragGestures.js
 * 项目内统一的拖拽手势工具（零依赖，Pointer Capture 实现）。
 *
 * 设计约束：
 * - 指针捕获（setPointerCapture）：按下后指针离开元素，pointermove 仍持续派发到该元素，
 *   无需向 document 注册/注销 mousemove/mouseup；pointercancel 兜底（浏览器接管手势时）。
 * - 只提供手势生命周期（start/move/end），几何语义（钳制、锚定、吸附）全部留在调用方。
 * - 主键按下才启动；isIgnored 用于放行元素内部的原生交互（如标题栏里的按钮）。
 *
 * 使用方：BuffFloatingPanel 标题栏/缩放手柄、BuffDetachedWindow 标题栏。
 */
export class DragGestures {
    /**
     * 绑定拖拽手势
     * @param {Element} handle 按下即开始拖拽的元素（需与接收 move/end 事件的元素为同一个）
     * @param {object} handlers
     * @param {(e: PointerEvent) => boolean} [handlers.isIgnored] 返回 true 则本次按下不启动拖拽
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onStart] 拖拽启动（已捕获指针）
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onMove] 拖拽移动
     * @param {(e: PointerEvent, start: {x: number, y: number}) => void} [handlers.onEnd] 拖拽结束（含 pointercancel）
     * @returns {() => void} 解绑函数
     */
    static bind(handle, { isIgnored, onStart, onMove, onEnd } = {}) {
        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            if (isIgnored && isIgnored(e)) return;

            const start = { x: e.clientX, y: e.clientY };
            try {
                handle.setPointerCapture(e.pointerId);
            } catch (err) { /* 元素可能已脱离 DOM，忽略 */ }
            if (onStart) onStart(e, start);

            const onPointerMove = (ev) => {
                if (onMove) onMove(ev, start);
            };
            const onPointerUp = (ev) => {
                handle.removeEventListener("pointermove", onPointerMove);
                handle.removeEventListener("pointerup", onPointerUp);
                handle.removeEventListener("pointercancel", onPointerUp);
                if (onEnd) onEnd(ev, start);
            };
            handle.addEventListener("pointermove", onPointerMove);
            handle.addEventListener("pointerup", onPointerUp);
            handle.addEventListener("pointercancel", onPointerUp);
        };

        handle.addEventListener("pointerdown", onPointerDown);
        return () => handle.removeEventListener("pointerdown", onPointerDown);
    }
}
