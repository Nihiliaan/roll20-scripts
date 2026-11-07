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

## 六、标准版本发布流与禁则 (Release Workflow Standards)
面对发布指令（如“发布一个版本”）：
1. **严格遵循四步流水线 (Strict Four-Step Pipeline)**：
   - 第一步（自增与打包）：在 `scripts/bundle.js` 中递增版本号，运行 `node scripts/bundle.js` 生成 `src/roll20-suite.user.js`，并运行 `node -c src/roll20-suite.user.js` 通过语法校验；
   - 第二步（暂存与提交）：执行 `git add src/ scripts/bundle.js`，提交语义化 Commit（`git commit -m "..."`）；
   - 第三步（本地打标签）：执行 `git tag -a v<版本号> -m "Release v<版本号>: ..."`；
   - 第四步（推送远端）：执行 `git push origin master --tags`，至此发布流程即刻结案。
2. **严禁节外生枝与多余工具链调用 (No Extraneous Tooling Overhead)**：
   - 本项目通过 GitHub 仓库主干与 Greasy Fork 管道直接分发，严禁擅自调用 GitHub CLI（如 `gh release create` 等）创建 Web Release 页面；
   - 严禁在非必要的外围工具链上耗费时间排查网络代理或证书错误，确保发布过程极致精简、确定与高效。

## 七、权限与安全边界不变量原则 (Permission & Security Invariants)
- **严禁擅自变更权限策略**：严禁为了实现局部功能或绕过数据读取限制，擅自修改任何实体、接口、数据源或角色的权限配置（如 Roll20 角色卡的 `controlledby`、`inplayerjournals`、文件访问模式、鉴权等级等）；
- **用户显式指令驱动**：所有权限与访问控制边界的变更，必须由用户明确提出，严禁在排错或重构过程中擅自“顺手”放宽或修改；
- **偏好设置与数据权限隔离**：用户偏好设置由 `SuiteConfigStore` 严格托管于本地客户端 `localStorage`，不触碰或创建全局公共卡片，杜绝 Journal 界面污染与越权修改风险。

## 八、通俗原理解析与工作汇报契约 (Plain-Language Engineering Report)
在完成任何功能开发、逻辑重构或缺陷修补后，向用户汇报时：
1. **严禁停留于功能表象**：严禁单纯罗列“实现了什么表面功能”等用户早已知晓的既定需求；
2. **通俗讲透底层机制**：必须使用通俗直白、严谨平实的“人话”，向用户讲清楚：
   - 底层的具体代码机理与数据流向是什么；
   - 到底是通过什么技术手段和 API 调用做到的；
   - 关键变量和逻辑分支是如何运转并解决问题的。

## 九、原生人物卡 DOM 模板注入规范 (Native Sheet Template Patching)
Roll20 官方人物卡系统在底层维护着所有角色卡共享的单例模板对象（`char.characterSheet.layouthtml`），其重复项（Repeating Sections，如 `repeating_buff2`）以隐藏的 `<fieldset class="repeating_xxx">` 作为 DOM 生成模板。为保证扩展字段的稳定注入与极简架构：
1. **源头模板一次性打补丁 (Source Template Single Patching)**：
   - 严禁对人物卡内部 DOM 建立繁重的持久 MutationObserver 或高频轮询；
   - 在页面初始化时，直接拦截并修改全局共享模板 `characterSheet.layouthtml`，将扩展字段固化写入对应 fieldset 中；
2. **宿主原生生命周期与数据管道自动托管 (Native Pipeline Entrustment)**：
   - 扩展输入框严格遵循 `name="attr_<字段名>"` 标准命名；
   - 注入后由 Roll20 官方底层引擎自动完成：首次打开卡片批量构建、属性回填（`baseUpdateSheetValues`）、点击“+Add”新增行动态克隆、以及失焦持久化保存（`handleBlur` -> `saveSheetValues`），实现零额外监听与原生级融合。

## 十、自定义数据联动宿主行为合流原则 (Custom Data Host-Action Merging)
凡自定义扩展数据与宿主状态存在依赖或联动关系时（例如 Buff 开关联动当前轮数）：
1. **严禁外围异步监听补丁**：严禁在外部建立独立的异步监听器、延时定时器或外围观察者来“事后”修补联动状态；
2. **合并进入宿主原生行动源头 (Direct Action Merging)**：必须直接切入宿主产生该状态变更的原生源头方法（如视图层 `CharacterView.prototype.saveSheetValues`、模型层 `Attribute.prototype.syncedSave`、以及底层统一业务 Action `toggleBuff`），将自定义数据的计算与赋值完全合并在宿主打开/切换的同一个原子行动中执行，确保状态变更的一致性、即时性与零时序差。

## 十一、基于 is_npc 与 Token 唯一性的双轨存储分流规范 (Dual-Track Buff Storage)
面对战役中复杂的棋子-人物卡多对一与多图投射关系，系统统一遵循以下两级判定分流准则：
1. **玩家卡绝对优先 (PC Invariant)**：
   若人物卡未勾选“THIS is an NPC OR MONSTER”（`is_npc !== "1"`），判定为玩家实体。无论当前地图或全战役存在多少代表该实体的棋子（如镜像、多视角、跨图），Buff 统一持久化至人物卡（`repeating_buff2`），享受官方属性求值；
2. **怪物卡拓扑降级 (NPC Mook Demotion)**：
   若人物卡为怪物卡（`is_npc === "1"`），系统检测当前作战地图中代表该卡片的棋子数量：
   - **独占棋子 (`tokenCount === 1`)**：作为独占 Boss 记录于人物卡；
   - **非独占多棋子 (`tokenCount > 1`)**：判定为共用模板的杂兵集群，Buff 自动隔离存储于各棋子自身（`TokenBuffManager` / `gmnotes`），杜绝状态互相污染与多重先攻扣轮雪崩；
3. **纯图元兜底**：无对应人物卡的棋子始终由棋子自身持久化。








