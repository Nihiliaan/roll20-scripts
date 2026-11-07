import { Pf1eBuffManager } from "./Pf1eBuffManager.js";
import { CharacterSheetTitleCopier } from "./CharacterSheetTitleCopier.js";

/**
 * Roll20 Suite - 官方人物卡 Buff 增强注入器
 * 遵循“原生人物卡 DOM 模板注入规范”与“自定义数据联动宿主行为合流原则”：
 * 1. 直接在源头修改全局共享模板 (char.characterSheet.layouthtml) 以及原生 fieldset；
 * 2. 挂钩官方人物卡保存入口 (CharacterView.prototype.saveSheetValues)，将轮数设置与开关激活合并在宿主同一行动中！
 */
export class CharacterSheetBuffEnhancer {
    static isInitialized = false;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetBuffEnhancer] 启动官方人物卡源头 DOM 模板注入器...");

        // 1. 拦截官方人物卡 View 原型生命周期，确保任何卡片渲染前模板均已打好补丁
        this.hookCharacterViewPrototype();

        // 2. 直接对战役全局共享的 characterSheet 单例模板打补丁
        this.patchGlobalCharacterSheetTemplate();

        // 3. 对当前屏幕上已经打开的卡片进行一次性模板与既有项调和
        this.patchOpenDialogs();

        // 4. 启动官方人物卡 title 快捷复制功能（Alt+点击 / 滚轮中键）
        CharacterSheetTitleCopier.init();
    }

    /**
     * 拦截 CharacterView 原型生命周期 (postRender)，实现模板的零延时源头固化
     */
    static hookCharacterViewPrototype() {
        try {
            const char = window.Campaign?.characters?.at(0);
            const proto = char?.view ? Object.getPrototypeOf(char.view) : null;
            if (!proto || proto._r20SuiteTemplateHooked) return;

            const origPostRender = proto.postRender;
            if (typeof origPostRender === "function") {
                proto.postRender = function() {
                    try {
                        if (this.model?.characterSheet) {
                            CharacterSheetBuffEnhancer.patchLayoutHtml(this.model.characterSheet);
                        }
                    } catch (e) {
                        console.warn("[CharacterSheetBuffEnhancer] postRender 模板切面增强异常:", e);
                    }
                    return origPostRender.apply(this, arguments);
                };
            }

            // 挂钩 saveSheetValues：将官方人物卡 Enable 复选框开启与轮数重置合并在同一个原子行动中！
            const origSaveSheetValues = proto.saveSheetValues;
            if (typeof origSaveSheetValues === "function") {
                proto.saveSheetValues = function(el, source) {
                    const res = origSaveSheetValues.apply(this, arguments);
                    try {
                        if (el && window.$) {
                            const $el = window.$(el);
                            const nameAttr = $el.attr("name") || "";
                            if (nameAttr.includes("enable_toggle") && $el.is(":checked")) {
                                const repItem = $el.closest(".repitem");
                                const rowId = repItem.attr("data-reprowid");
                                if (rowId && this.model) {
                                    Pf1eBuffManager.resetBuffRoundsToInitial(this.model, rowId);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("[CharacterSheetBuffEnhancer] saveSheetValues 原生合流切面异常:", e);
                    }
                    return res;
                };
            }

            // 挂钩 deleteRepeatingRow：将官方人物卡删除 Repeating Row 完整收敛至插件级联销毁体系中！
            const origDeleteRepeatingRow = proto.deleteRepeatingRow;
            if (typeof origDeleteRepeatingRow === "function") {
                proto.deleteRepeatingRow = function(sectionName, rowId) {
                    if (sectionName === "repeating_buff2" && rowId && this.model) {
                        try {
                            const char = this.model;
                            const prefix = `repeating_buff2_${rowId}_`.toLowerCase();
                            const snapshot = {};
                            if (char.attribs && char.attribs.models) {
                                for (const a of char.attribs.models) {
                                    const n = (a.get("name") || "").toLowerCase();
                                    if (n.startsWith(prefix)) {
                                        snapshot[a.get("name")] = a.get("current");
                                    }
                                }
                            }

                            console.log(`[CharacterSheetBuffEnhancer] 官方人物卡删除 Buff [${rowId}]，由插件全套销毁体系一揽子接管...`);

                            // 一揽子接管：级联小弟自毁 + 向上除名 + 自身所有原生属性物理 destroy + 加值全量重算
                            Pf1eBuffManager.deleteBuffRowPermanently(char, rowId).then(() => {
                                if (typeof Pf1eBuffUI !== "undefined") {
                                    Pf1eBuffUI.requestTokenRefresh(char.id);
                                }
                                try {
                                    if (typeof window !== "undefined" && window.Roll20Suite?.BuffFloatingPanel) {
                                        window.Roll20Suite.BuffFloatingPanel.renderViewport();
                                    }
                                } catch (e) {}
                            });

                            // 顺带调用官方底层行移除广播，确保官方人物卡 Worker 正常收尾
                            const P = this;
                            if (P.d20?.journal?.notifyWorkersOfRowDeleted) {
                                P.d20.journal.notifyWorkersOfRowDeleted(char.id, sectionName, rowId, "player", snapshot);
                            } else if (window.d20?.journal?.notifyWorkersOfRowDeleted) {
                                window.d20.journal.notifyWorkersOfRowDeleted(char.id, sectionName, rowId, "player", snapshot);
                            }
                            return;
                        } catch (e) {
                            console.warn("[CharacterSheetBuffEnhancer] deleteRepeatingRow 切面异常，回退至原生:", e);
                        }
                    }
                    return origDeleteRepeatingRow.apply(this, arguments);
                };
            }

            proto._r20SuiteTemplateHooked = true;
            console.log("[CharacterSheetBuffEnhancer] 已成功挂钩 CharacterView 原型 postRender、saveSheetValues 与 deleteRepeatingRow 生命周期");
        } catch (err) {
            console.warn("[CharacterSheetBuffEnhancer] 挂钩 CharacterView 原型异常:", err);
        }
    }

    /**
     * 对当前全局共享的 characterSheet 对象进行模板打补丁
     */
    static patchGlobalCharacterSheetTemplate() {
        try {
            const chars = window.Campaign?.characters?.models || [];
            for (const char of chars) {
                if (char.characterSheet?.layouthtml) {
                    this.patchLayoutHtml(char.characterSheet);
                    break; // 所有角色卡共享同一个 characterSheet 引用，修改一次即可
                }
            }
        } catch (err) {
            console.warn("[CharacterSheetBuffEnhancer] 修改全局 characterSheet 模板异常:", err);
        }
    }

    /**
     * 核心：对 layouthtml 字符串中的 repeating_buff2 原生 fieldset 模板进行修改
     */
    static patchLayoutHtml(characterSheet) {
        if (!characterSheet || !characterSheet.layouthtml) return false;
        if (characterSheet.layouthtml.includes('name="attr_init_rounds"')) {
            return true; // 已打过补丁
        }

        const html = characterSheet.layouthtml;
        const fsPos = html.indexOf('fieldset class="repeating_buff2"');
        const altFsPos = html.indexOf("fieldset class='repeating_buff2'");
        const startPos = fsPos !== -1 ? fsPos : altFsPos;
        if (startPos === -1) return false;

        const endFsPos = html.indexOf("</fieldset>", startPos);
        if (endFsPos === -1) return false;

        const fsSnippet = html.substring(startPos, endFsPos);
        const nameIdx = fsSnippet.indexOf('name="attr_name"');
        if (nameIdx === -1) return false;

        // 确定语言标签风格
        const labelText = fsSnippet.includes("名稱") ? "輪數計算式" : (fsSnippet.includes("名称") ? "轮数计算式" : "Rounds Formula");
        const templateTag = this.buildTemplateHTML(labelText);

        // 定位 name 字段所属的闭合 </label> 标签
        const labelEndIdx = fsSnippet.indexOf("</label>", nameIdx);
        if (labelEndIdx === -1) return false;

        const insertOffset = startPos + labelEndIdx + "</label>".length;
        const newHtml = html.substring(0, insertOffset) + "\n" + templateTag + html.substring(insertOffset);

        characterSheet.layouthtml = newHtml;
        console.log("[CharacterSheetBuffEnhancer] 已成功将初始轮数输入框固化至官方源头 characterSheet.layouthtml 模板中");
        return true;
    }

    /**
     * 生成标准原汁原味模板 HTML
     */
    static buildTemplateHTML(labelText = "輪數計算式") {
        return `
<label class="small-label2 entry-med highlight r20-suite-init-rounds-col">
    <input class="macro-text-inline r20-suite-init-rounds" type="text" name="attr_init_rounds" placeholder="0" title="预置初始轮数/公式（例如 10、@{level}*10、10+@{constitution_mod}）。开启 Buff 时借用原生引擎自动求值。">
    <span class="super note-a">${labelText}</span>
</label>`.trim();
    }

    /**
     * 对当前屏幕上已有的卡片弹窗进行一次性兜底调和
     */
    static patchOpenDialogs() {
        const dialogEls = document.querySelectorAll(".characterdialog, .ui-dialog");
        dialogEls.forEach(dialogEl => {
            const iframes = dialogEl.querySelectorAll("iframe");
            iframes.forEach(iframe => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc && doc.body) {
                        this.patchDocumentDOM(doc, dialogEl);
                    }
                } catch (e) {}
            });
        });
    }

    /**
     * 对具体 document 内部已生成的 fieldset 容器及已有条目进行调和
     */
    static patchDocumentDOM(doc, dialogEl) {
        if (!doc) return;

        // 挂载 title 快捷复制功能到当前 document（带 WeakSet 防重）
        CharacterSheetTitleCopier.attachToDocument(doc);

        // 1. 如果该 iframe 内部的 fieldset 尚未包含该字段，就地修补 fieldset.innerHTML（供用户点击 +Add 时直接克隆）
        const fsList = doc.querySelectorAll('fieldset.repeating_buff2, fieldset[class*="repeating_buff2"]');
        fsList.forEach(fs => {
            if (!fs.innerHTML.includes('attr_init_rounds')) {
                const labelText = fs.innerHTML.includes("名稱") ? "輪數計算式" : (fs.innerHTML.includes("名称") ? "轮数计算式" : "Rounds Formula");
                const template = this.buildTemplateHTML(labelText);
                const nameLabelRegex = /(<label[^>]*class="[^"]*entry-25p-shrink[^"]*"[^>]*>[\s\S]*?<\/label>)/i;
                if (nameLabelRegex.test(fs.innerHTML)) {
                    fs.innerHTML = fs.innerHTML.replace(nameLabelRegex, `$1\n${template}`);
                }
            }
        });

        // 2. 对当前已渲染好的既有条目，如果尚未包含该列，就地补齐
        const character = this.findCharacterFromDialog(dialogEl);
        const repItems = doc.querySelectorAll('.repcontainer[data-groupname="repeating_buff2"] .repitem');
        repItems.forEach(item => {
            const existingCol = item.querySelector('.r20-suite-init-rounds-col');
            if (existingCol) {
                existingCol.classList.remove("sect");
                const na = existingCol.querySelector(".note-a");
                if (na && na.textContent.includes("(a)")) {
                    na.textContent = na.textContent.replace(/\(a\)/g, "").trim();
                }
                return;
            }
            if (item.querySelector('.r20-suite-init-rounds')) return;

            const nameInput = item.querySelector('input[name="attr_name"], input[name$="_name"]');
            if (!nameInput) return;
            const nameLabel = nameInput.closest("label");
            if (!nameLabel || !nameLabel.parentNode) return;

            const allText = item.textContent || "";
            const labelText = allText.includes("名稱") ? "輪數計算式" : (allText.includes("名称") ? "轮数计算式" : "Rounds Formula");

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = this.buildTemplateHTML(labelText);
            const newLabel = tempDiv.firstElementChild;
            const input = newLabel.querySelector("input");

            const typeSelect = item.querySelector('select[name="attr_bufftype"], select[name$="_bufftype"], select[name*="bufftype"]');
            const typeLabel = typeSelect ? typeSelect.closest("label") : null;
            const targetBeforeNode = (typeLabel && typeLabel.parentNode === nameLabel.parentNode)
                ? typeLabel
                : nameLabel.nextElementSibling;

            nameLabel.parentNode.insertBefore(newLabel, targetBeforeNode);

            // 回填属性值
            let rowId = item.getAttribute("data-reprowid");
            if (!rowId) {
                const namedInput = item.querySelector('input[name*="_name"], input[name*="_row_id"]');
                if (namedInput) {
                    const match = (namedInput.getAttribute("name") || "").match(/repeating_buff2?_([^_]+)_/);
                    if (match) rowId = match[1];
                }
            }
            if (character && rowId) {
                const attrFullName = `repeating_buff2_${rowId}_init_rounds`;
                const initAttr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
                if (initAttr && initAttr.get("current") !== undefined && initAttr.get("current") !== null) {
                    input.value = initAttr.get("current");
                }
            }
        });
    }

    /**
     * 从对话框元素中定位 Character Backbone Model
     */
    static findCharacterFromDialog(dialogEl) {
        if (!dialogEl || !window.Campaign?.characters) return null;

        let charId = dialogEl.getAttribute("data-characterid") || 
                     dialogEl.querySelector("[data-characterid]")?.getAttribute("data-characterid");

        if (!charId && window.$) {
            try {
                const charObj = window.$(dialogEl).data("character");
                if (charObj && charObj.id) return charObj;
            } catch (e) {}
        }

        if (!charId) {
            const idAttr = dialogEl.id || "";
            const match = idAttr.match(/character-([a-zA-Z0-9_-]+)/);
            if (match) charId = match[1];
        }

        return charId ? window.Campaign.characters.get(charId) : null;
    }
}
