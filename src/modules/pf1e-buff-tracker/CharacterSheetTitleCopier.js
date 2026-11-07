/**
 * Roll20 Suite - 官方人物卡控件 Title 宏属性快速复制助手
 * 
 * 核心功能：
 * 1. 双通道快捷复制：Alt + 鼠标左键点击 或 鼠标滚轮中键点击 任意带有 title 属性的控件/标签，直接复制 title 内容到系统剪贴板；
 * 2. 智能解析 repeating section：若 title 中包含 $X，自动向上追溯 .repitem 替换为当前行真实的 data-reprowid；
 * 3. 即时 Toast 反馈：在光标点击位置上方弹出轻量 HUD 气泡，提示“已复制: @{...}”并在 1.2 秒内平滑淡出，附带目标微光高亮；
 * 4. 事件委托与 iframe 全局穿透：自动监听当前与后续所有动态打开的人物卡 iframe，零性能开销。
 */
export class CharacterSheetTitleCopier {
    static isInitialized = false;
    static boundDocuments = new WeakSet();
    static observer = null;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetTitleCopier] 启动官方人物卡 Title 属性快捷复制助手 (Alt+点击 / 滚轮中键)...");

        // 1. 监听主窗口 document（针对非 iframe 渲染的卡片与原生弹窗）
        if (typeof document !== "undefined") {
            this.attachToDocument(document);
        }

        // 2. 扫描并监听当前已打开的所有人物卡 iframe
        this.scanAndAttachAllFrames();

        // 3. 启动 MutationObserver 监听未来动态打开的人物卡弹窗与 iframe
        this.startFrameObserver();
    }

    /**
     * 将事件委托挂载到指定的 document 上
     */
    static attachToDocument(doc) {
        if (!doc || !doc.body) return;
        if (this.boundDocuments.has(doc)) return;
        this.boundDocuments.add(doc);

        // 注入 Toast 与高亮动画所需的轻量 CSS
        this.injectStyles(doc);

        // 统一在捕获阶段监听 click 与 auxclick 事件
        const clickHandler = (e) => this.handleEvent(e, doc);
        
        doc.addEventListener("click", clickHandler, true);
        doc.addEventListener("auxclick", clickHandler, true);
    }

    /**
     * 核心事件处理逻辑
     */
    static handleEvent(e, doc) {
        // 判定触发条件：Alt + 左键 (button 0) 或 滚轮中键 (button 1)
        const isAltLeft = e.altKey && e.button === 0;
        const isMiddleClick = e.button === 1;
        if (!isAltLeft && !isMiddleClick) return;

        // 查找目标控件及 title 属性
        const targetInfo = this.findTargetTitle(e.target);
        if (!targetInfo || !targetInfo.rawTitle) return;

        // 阻止默认行为与原生事件冒泡，避免误触表单提交、打字选区或勾选框翻转
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") {
            e.stopImmediatePropagation();
        }

        // 智能解析宏公式语法（展开 repeating 行中的 $X）
        const resolvedText = this.resolveMacroTitle(targetInfo.rawTitle, targetInfo.element);

        // 执行剪贴板复制
        this.copyToClipboard(resolvedText, doc).then((success) => {
            if (success) {
                this.showFeedback(resolvedText, targetInfo.element, e, doc);
            }
        });
    }

    /**
     * 精确查找带有有效 title 的目标元素
     */
    static findTargetTitle(startEl) {
        if (!startEl || typeof startEl.getAttribute !== "function") return null;

        // 1. 直接检查自身
        const directTitle = startEl.getAttribute("title");
        if (directTitle && directTitle.trim()) {
            return { element: startEl, rawTitle: directTitle.trim() };
        }

        // 2. 如果点击的是 label 或 label 内的文本，优先检查内部的输入控件
        const label = startEl.closest("label");
        if (label) {
            const innerCtrl = label.querySelector("input[title], select[title], textarea[title], button[title]");
            if (innerCtrl) {
                const innerTitle = innerCtrl.getAttribute("title");
                if (innerTitle && innerTitle.trim()) {
                    return { element: innerCtrl, rawTitle: innerTitle.trim() };
                }
            }
            const labelTitle = label.getAttribute("title");
            if (labelTitle && labelTitle.trim()) {
                return { element: label, rawTitle: labelTitle.trim() };
            }
        }

        // 3. 向上回溯查找最近的父级（最多 3 层）
        let curr = startEl.parentElement;
        let depth = 0;
        while (curr && depth < 3) {
            if (curr.tagName === "BODY" || curr.tagName === "HTML" || curr.classList?.contains("characterdialog")) {
                break;
            }
            const parentTitle = curr.getAttribute("title");
            if (parentTitle && parentTitle.trim()) {
                return { element: curr, rawTitle: parentTitle.trim() };
            }
            curr = curr.parentElement;
            depth++;
        }

        return null;
    }

    /**
     * 智能宏文本解析：自动将 Repeating Section 中的 $X 替换为具体 rowId
     */
    static resolveMacroTitle(rawTitle, element) {
        let text = rawTitle.trim();

        if (/\$[Xx]/.test(text)) {
            const repItem = element.closest(".repitem");
            if (repItem) {
                let rowId = repItem.getAttribute("data-reprowid");
                if (!rowId) {
                    const namedInput = repItem.querySelector('input[name*="repeating_"]');
                    if (namedInput) {
                        const m = (namedInput.getAttribute("name") || "").match(/repeating_[^_]+_([^_]+)_/);
                        if (m) rowId = m[1];
                    }
                }
                if (rowId) {
                    text = text.replace(/\$[Xx]/g, rowId);
                }
            }
        }

        return text;
    }

    /**
     * 跨环境剪贴板复制，具备多层容错
     */
    static async copyToClipboard(text, doc = document) {
        if (!text) return false;

        // 优先使用主窗口的 navigator.clipboard
        try {
            if (window.navigator?.clipboard?.writeText) {
                await window.navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {}

        // 回退机制：使用临时 textarea 元素触发 execCommand('copy')
        try {
            const targetDoc = doc || document;
            const ta = targetDoc.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            ta.style.pointerEvents = "none";
            ta.style.left = "-9999px";
            ta.style.top = "-9999px";
            (targetDoc.body || targetDoc.documentElement).appendChild(ta);
            ta.focus();
            ta.select();
            const res = targetDoc.execCommand("copy");
            ta.remove();
            if (res) return true;
        } catch (err) {
            console.warn("[CharacterSheetTitleCopier] execCommand 复制失败:", err);
        }

        return false;
    }

    /**
     * 显示视觉反馈（Toast 气泡与控件高亮）
     */
    static showFeedback(copiedText, element, event, doc) {
        try {
            // 1. 控件高亮微光动画
            if (element && element.classList) {
                element.classList.remove("r20-suite-copied-highlight");
                void element.offsetWidth; // 触发 reflow 重置动画
                element.classList.add("r20-suite-copied-highlight");
                if (typeof setTimeout !== "undefined") {
                    setTimeout(() => {
                        try { element.classList.remove("r20-suite-copied-highlight"); } catch (e) {}
                    }, 800);
                }
            }

            // 2. 移除旧 Toast（防止快速连击导致堆叠）
            const oldToast = doc.getElementById("r20-suite-title-toast");
            if (oldToast) oldToast.remove();

            // 3. 构建全新 Toast DOM
            const toast = doc.createElement("div");
            toast.id = "r20-suite-title-toast";
            toast.className = "r20-suite-title-toast";

            // 格式化展示文本（超长截断展示，实际已全量复制）
            const displaySnippet = copiedText.length > 40 ? copiedText.substring(0, 37) + "..." : copiedText;
            const safeDisplay = typeof Roll20Bridge !== "undefined" && Roll20Bridge.escapeHtml 
                ? Roll20Bridge.escapeHtml(displaySnippet) 
                : displaySnippet.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

            toast.innerHTML = `<span style="color:#60a5fa;margin-right:4px;">📋 已复制:</span><strong style="color:#fcd34d;">${safeDisplay}</strong>`;

            // 计算精准定位坐标
            let posX = event?.pageX;
            let posY = event?.pageY;

            if (posX === undefined || posY === undefined) {
                const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
                const scrollX = doc.defaultView?.pageXOffset || doc.documentElement?.scrollLeft || 0;
                const scrollY = doc.defaultView?.pageYOffset || doc.documentElement?.scrollTop || 0;
                posX = rect.left + rect.width / 2 + scrollX;
                posY = rect.top + scrollY;
            }

            toast.style.left = `${posX}px`;
            toast.style.top = `${Math.max(8, posY - 30)}px`;

            const container = doc.body || doc.documentElement;
            if (container && typeof container.appendChild === "function") {
                container.appendChild(toast);
            }

            // 1.2 秒后自动销毁
            if (typeof setTimeout !== "undefined") {
                setTimeout(() => {
                    if (toast && toast.parentNode) {
                        toast.remove();
                    }
                }, 1200);
            }
        } catch (e) {
            console.warn("[CharacterSheetTitleCopier] 显示 Toast 反馈异常:", e);
        }
    }

    /**
     * 注入自洽样式
     */
    static injectStyles(doc) {
        try {
            if (!doc || doc.getElementById("r20-suite-title-copier-style")) return;
            const style = doc.createElement("style");
            style.id = "r20-suite-title-copier-style";
            style.textContent = `
@keyframes r20SuiteToastFadeUp {
    0% { opacity: 0; transform: translate(-50%, 6px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    80% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -10px); }
}
@keyframes r20SuitePulseBorder {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); outline: 1px solid #3b82f6; }
    50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3); outline: 1px solid #60a5fa; }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); outline: none; }
}
.r20-suite-title-toast {
    position: absolute;
    z-index: 9999999;
    background: rgba(18, 22, 28, 0.95);
    border: 1px solid #3b82f6;
    border-radius: 5px;
    color: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    font-size: 11px;
    line-height: 1.4;
    padding: 4px 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: r20SuiteToastFadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    white-space: nowrap;
    max-width: 380px;
    text-overflow: ellipsis;
    overflow: hidden;
}
.r20-suite-copied-highlight {
    animation: r20SuitePulseBorder 0.6s ease-out !important;
}
`;
            (doc.head || doc.body || doc.documentElement).appendChild(style);
        } catch (e) {}
    }

    /**
     * 扫描并挂载所有已有的 iframe
     */
    static scanAndAttachAllFrames() {
        try {
            if (typeof document === "undefined") return;
            const iframes = document.querySelectorAll(".characterdialog iframe, iframe.charactersheet, iframe");
            iframes.forEach(iframe => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc && doc.body) {
                        this.attachToDocument(doc);
                    }
                    // 监听 iframe 的 load 事件，确保重新加载后依然挂载
                    iframe.removeEventListener("load", iframe._r20SuiteFrameLoadHandler);
                    iframe._r20SuiteFrameLoadHandler = () => {
                        try {
                            const newDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (newDoc && newDoc.body) {
                                CharacterSheetTitleCopier.attachToDocument(newDoc);
                            }
                        } catch (err) {}
                    };
                    iframe.addEventListener("load", iframe._r20SuiteFrameLoadHandler);
                } catch (e) {}
            });
        } catch (e) {}
    }

    /**
     * 监听后续动态打开的人物卡 iframe
     */
    static startFrameObserver() {
        if (this.observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return;

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) { // ELEMENT_NODE
                            if (node.tagName === "IFRAME") {
                                this.handleIframeNode(node);
                            } else if (node.querySelectorAll) {
                                const iframes = node.querySelectorAll("iframe");
                                iframes.forEach(frame => this.handleIframeNode(frame));
                            }
                        }
                    }
                }
            }
        });

        if (document.body) {
            this.observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    static handleIframeNode(iframe) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc && doc.body) {
                this.attachToDocument(doc);
            }
            iframe.addEventListener("load", () => {
                try {
                    const newDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (newDoc && newDoc.body) {
                        this.attachToDocument(newDoc);
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    /**
     * 销毁与注销
     */
    static destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.isInitialized = false;
    }
}
