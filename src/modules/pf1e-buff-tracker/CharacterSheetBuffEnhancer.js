/**
 * Roll20 Suite - 官方人物卡 Buff 增强注入器
 * 负责在官方人物卡 Buff 列表中动态注入“预置初始轮数/公式”输入框，
 * 采用原生“Buff 計算式”的原汁原味 HTML 模板结构，并与 Roll20 底层 Backbone 属性实现双向绑定。
 */
export class CharacterSheetBuffEnhancer {
    static isInitialized = false;

    /**
     * 全局初始化
     */
    static init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        console.log("[CharacterSheetBuffEnhancer] 启动官方人物卡 Buff 增强注入器...");

        // 1. 扫描当前已有的人物卡弹窗
        this.scanAllDialogs();

        // 2. 监听后续打开的人物卡弹窗
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.(".characterdialog, .ui-dialog") || node.querySelector?.(".characterdialog")) {
                            this.scanAllDialogs();
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // 3. 辅助轮询扫描（低频 1.5s），确保异步 iframe 与动态 tab 切换被 100% 捕获
        setInterval(() => {
            this.scanAllDialogs();
        }, 1500);
    }

    /**
     * 扫描所有当前打开的人物卡对话框
     */
    static scanAllDialogs() {
        const dialogEls = document.querySelectorAll(".characterdialog, .ui-dialog");
        dialogEls.forEach(el => this.enhanceDialog(el));
    }

    /**
     * 对单个对话框进行增强
     */
    static enhanceDialog(dialogEl) {
        if (!dialogEl) return;

        // 获取对应的 Character Backbone Model
        const character = this.findCharacterFromDialog(dialogEl);
        if (!character) return;

        // 处理直接嵌入的 DOM
        this.enhanceContainer(dialogEl, character);

        // 如果人物卡内部有 iframe，深入 iframe 内部增强
        const iframes = dialogEl.querySelectorAll("iframe");
        iframes.forEach(iframe => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    this.enhanceContainer(doc.body, character);
                }
            } catch (e) {
                // 跨域或安全受限忽略
            }
        });
    }

    /**
     * 从对话框元素中定位 Character Backbone Model
     */
    static findCharacterFromDialog(dialogEl) {
        if (!window.Campaign || !window.Campaign.characters) return null;

        // 1. 尝试从 dataset 中读取 characterid
        let charId = dialogEl.getAttribute("data-characterid") || 
                     dialogEl.querySelector("[data-characterid]")?.getAttribute("data-characterid");

        // 2. 尝试从 jQuery data 中获取
        if (!charId && window.$) {
            try {
                const charObj = window.$(dialogEl).data("character");
                if (charObj && charObj.id) return charObj;
            } catch (e) {}
        }

        // 3. 尝试从对话框 ID 或类名解析 (如 #character-123456)
        if (!charId) {
            const idAttr = dialogEl.id || "";
            const match = idAttr.match(/character-([a-zA-Z0-9_-]+)/);
            if (match) charId = match[1];
        }

        if (charId) {
            return window.Campaign.characters.get(charId);
        }

        return null;
    }

    /**
     * 在人物卡容器内寻找 repeating_buff2 重复列表并注入输入框
     */
    static enhanceContainer(containerEl, character) {
        // 查找所有 repeating_buff2 与 repeating_buff 的容器
        const repContainers = containerEl.querySelectorAll(
            'div.repcontainer[data-groupname="repeating_buff2"], div.repcontainer[data-groupname="repeating_buff"]'
        );

        repContainers.forEach(repContainer => {
            const groupName = repContainer.getAttribute("data-groupname") || "repeating_buff2";
            const repItems = repContainer.querySelectorAll("div.repitem");

            repItems.forEach(item => {
                this.enhanceRepItem(item, character, groupName);
            });

            // 监听该重复容器内动态新增/删除的行
            if (!repContainer._r20SuiteObserved) {
                repContainer._r20SuiteObserved = true;
                const itemObserver = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        for (const node of m.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains("repitem")) {
                                this.enhanceRepItem(node, character, groupName);
                            }
                        }
                    }
                });
                itemObserver.observe(repContainer, { childList: true });
            }
        });
    }

    /**
     * 增强单行 Buff 条目
     * 照抄原生“Buff 計算式” HTML 模板，不依赖运行时 DOM 是否已展开计算式
     */
    static enhanceRepItem(itemEl, character, groupName = "repeating_buff2") {
        if (!itemEl || !character) return;

        // 1. 获取 rowId
        let rowId = itemEl.getAttribute("data-reprowid");
        if (!rowId) {
            const namedInput = itemEl.querySelector('input[name*="_name"], input[name*="_row_id"]');
            if (namedInput) {
                const nameAttr = namedInput.getAttribute("name") || "";
                const match = nameAttr.match(/repeating_buff2?_([^_]+)_/);
                if (match) rowId = match[1];
            }
        }
        if (!rowId) return;

        // 2. 找到名称 label (起始锚点)
        const nameInput = itemEl.querySelector('input[name="attr_name"], input[name$="_name"]');
        if (!nameInput) return;

        const nameLabel = nameInput.closest("label");
        if (!nameLabel || !nameLabel.parentNode) return;

        // 避免重复注入
        if (nameLabel.parentNode.querySelector(".r20-suite-init-rounds-col, .r20-suite-init-rounds")) return;

        // 3. 确定说明文字语言风格
        const allText = itemEl.textContent || "";
        const labelText = (allText.includes("名称") || allText.includes("计算式")) 
            ? "轮数计算式" 
            : (allText.includes("Name") && !allText.includes("名稱") ? "Rounds Formula" : "輪數計算式");

        // 4. 照抄“Buff 計算式”的原生 HTML 结构模板 (单下划线底线透明输入框 + 加粗斜体居中文本)
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = `
<label class="r20-suite-init-rounds-col" style="display:inline-block; vertical-align:top; width:70px; text-align:center; margin:0 2px; box-sizing:border-box;">
    <input type="text" name="attr_init_rounds" class="r20-suite-init-rounds" placeholder="0" style="border:none; border-bottom:1px solid #000; border-radius:0; background:transparent; width:100%; height:24px; text-align:center; font-family:inherit; font-size:12px; color:inherit; box-sizing:border-box; padding:1px 2px;" title="预置初始轮数/公式（例如 10、@{level}*10、10+@{constitution_mod}）。开启 Buff 时借用原生引擎自动求值。">
    <span class="r20-suite-init-rounds-label" style="display:block; text-align:center; font-weight:bold; font-style:italic; font-size:9px; color:#333; margin-top:2px; white-space:nowrap;">${labelText}</span>
</label>
        `.trim();

        const newLabel = tempDiv.firstElementChild;
        const input = newLabel.querySelector("input");

        // 5. 顺延插入在类型下拉框之前 (或名称后面)
        const typeSelect = itemEl.querySelector('select[name="attr_bufftype"], select[name$="_bufftype"], select[name*="bufftype"]');
        const typeLabel = typeSelect ? typeSelect.closest("label") : null;
        const targetBeforeNode = (typeLabel && typeLabel.parentNode === nameLabel.parentNode)
            ? typeLabel
            : nameLabel.nextElementSibling;

        nameLabel.parentNode.insertBefore(newLabel, targetBeforeNode);

        // 6. 双向数据绑定
        const attrFullName = `${groupName}_${rowId}_init_rounds`;

        // 读取现有轮数公式值回填
        const initAttr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
        if (initAttr && initAttr.get("current") !== undefined && initAttr.get("current") !== null) {
            input.value = initAttr.get("current");
        }

        // 监听用户输入改动并写回 Backbone 属性
        const handleSave = () => {
            const val = input.value.trim();
            let attr = character.attribs?.models?.find(a => a.get("name") === attrFullName);
            if (!attr) {
                if (val !== "") {
                    character.attribs.create({
                        name: attrFullName,
                        current: val
                    });
                    console.log(`[CharacterSheetBuffEnhancer] 角色卡创建初始轮数公式属性 ${attrFullName} = ${val}`);
                }
            } else {
                if (attr.get("current") !== val) {
                    attr.save({ current: val });
                    console.log(`[CharacterSheetBuffEnhancer] 角色卡更新初始轮数公式属性 ${attrFullName} = ${val}`);
                }
            }
        };

        input.addEventListener("change", handleSave);
        input.addEventListener("blur", handleSave);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                input.blur();
            }
        });

        // 监听外部模型数据变更反向同步到 input
        if (character.attribs?.on) {
            const syncFromModel = (changedAttr) => {
                if (changedAttr.get("name") === attrFullName) {
                    const cur = changedAttr.get("current") || "";
                    if (input.value !== cur && document.activeElement !== input) {
                        input.value = cur;
                    }
                }
            };
            character.attribs.on("change:current", syncFromModel);
        }
    }
}
