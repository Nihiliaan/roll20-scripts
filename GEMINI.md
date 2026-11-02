# 项目特定规范 (Project Specific Rules)

## 一、版本发布与 Git 推送控制
- **严禁自动推送与发布**：代码修改与功能调试阶段，严禁擅自执行 `git push`、创建 GitHub Release 或对外自动发布新版本。
- **显式指令驱动**：所有修改仅在本地打包与测试，直到用户明确发出“发布一个版本”或类似指令时，方可执行版本号自增、Git Tag 打标签及推送远端。

## 二、多端状态同步与调和规范 (Declarative Reconciliation)
面对 Roll20 棋子 (Token)、角色卡 (Character Sheet) 与先攻栏 (Initiative Tracker) 的多端双向联动，严禁使用散落的命令式互相调用（Imperative Feedback Loops）。统一遵循以下声明式调和准则：

1. **单向调和与来源戳记 (Source Attribution)**：
   - 全系统状态联动必须通过带来源戳记的统一调和入口驱动（例如 `reconcile(token, character, { origin: "token" | "character" })`）。
   - 若操作来源于棋子（`origin: "token"`），调和逻辑仅允许更新角色卡属性，**绝对禁止反向修改棋子**，以规避 Roll20 底层画布重绘导致的选择框失焦关闭。
   - 若操作来源于角色卡（`origin: "character"`），调和逻辑仅负责更新棋子。
2. **状态 Diff 调和与幂等性 (Idempotent Diffing)**：
   - 任何写操作前必须先计算目标状态与当前状态的差异（Diff）。
   - 若计算得出状态无实质差异，立即结案退出，严禁向 Roll20 派发无效的 `set()` 或变更事件。
3. **UI 纯只读展示原则 (Read-Only Views)**：
   - 先攻栏、悬浮窗等视图层仅作为下游消费者，严禁在渲染流程或局部刷新回调中包含任何业务写操作（如修改 Token 或写入角色卡）。

## 三、宿主原生能力优先原则 (Host Native Primitives First)
- **严禁重复自研求值与解析轮子**：凡 Roll20 宿主平台本身已成熟具备的能力（如宏属性替换、内联掷骰 `[[...]]`、`diceengine` 公式计算等），一律直接调用或借助宿主底层管道完成，严禁自行编写容易产生语法漏洞的私有 AST/数学求值器。

## 四、DOM 增强与注入规范 (DOM Injection & Proximity Anchoring)
面对宿主环境（如 Roll20 角色卡、画布容器等）的 DOM 结构扩展与元素注入：
1. **严禁依赖绝对路径**：严禁在生产逻辑中硬编码全路径绝对 XPath（如 `/div[1]/div/div[3]/...`）或脆弱的硬性数组下标，避免因宿主标签改版或上下文切换造成级联失效；
2. **就近语义锚点定位 (Proximity Semantic Anchoring)**：确定目标元素后，优先通过具有现实唯一业务语义的属性（如 `name="attr_..."`、独特 `class` 或 `data-*` 属性）就近定位基准锚点，通过相对关系（如 `.closest("label")`、`insertBefore(newEl, targetSibling)`）实现高韧性、自适应的插入与顺延。

## 五、原生 HTML 模板固化复刻规范 (Static Archetype Templating)
面对宿主环境动态表单与重复项列表的扩展注入：
1. **严禁依赖运行时动态 cloneNode**：宿主中的部分高级或可选字段（如“Buff 計算式”）在新建条目或紧凑视图下可能并不存在于 DOM 树中，依赖运行时查找并克隆极易造成新建项注入断路；
2. **静态 HTML 模板原汁原味固化**：在审查确认宿主目标控件的原生 HTML 结构与核心 CSS 后，直接将其提取为自洽的静态模板字符串固化在代码中，就地替换字段名与展示文本，确保无论是既有条目还是动态新增条目均能 100% 稳定生成。



