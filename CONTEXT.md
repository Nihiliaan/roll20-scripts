# CONTEXT.md — 领域词汇表

Roll20 Suite 的领域语言。架构讨论（模块命名、接口设计、代码评审）统一使用以下术语。

## 领域概念

- **Buff** — 施加在角色卡（PF1e repeating_buff2 行）或纯 Token（自定义字段 `r20_suite_buffs` 条目）上的增益状态，可有持续轮数或常驻。
- **Debuff** — 负面状态（PF1e 官方 condition-* 字典或 Token 自定义字段中的 isDebuff 条目）。
- **轮数 (rounds)** — 剩余持续回合数。`null`/空 表示**常驻**（不参与回合扣减）。
- **回合扣减 (tick)** — 单位回合开始时，其身上有效轮数的 Buff/Debuff 统一 -1；归零即**过期 (expired)**。Debuff 允许 0/负数轮数**持续正计轮 (counted)**（0 → -1 → -2...），期间状态保持激活。
- **先攻回退 (revert)** — 倒回先攻排头时，被拉回单位身上的有效轮数统一 +1。
- **影子链接 (shadow link)** — 施法者主 Buff 向受术者远程投放的副本。受术者副本带 `link_host_id`（认老大），宿主带 `link_children`（记小弟）。链接副本绝不在受术者自己回合扣轮，而由施法者回合统一驱动。下游可以是人物卡，也可以是纯 Token（自定义字段条目，`link_children.charId` 存 Token id）。
- **拓扑自愈时机** — 父子链接的自愈（幽灵登记剔除 + 缺失索引反向重建）只在 **GM 加载房间完成后运行一次**（`Pf1eBuffManager.healDownstreamTopology`，bundle 主入口调用）；加减 Buff 时不再运行。
- **插件 presence 公告 (presence announcement)** — 插件在线判据与共卡选举资格，载体为 Roll20 原生 Firebase presence 节点 `{campaign}/players/{playerId}`（auth 声明 `fbauthinfo.auth.currentcampaign` 定位）：上线时在自己的节点写入 `r20suite = {role, pid, at}` 并注册 `onDisconnect().remove()`（`Roll20Bridge.startSuitePresenceBroadcast`）——上线写入、掉线由 Firebase 原生自动销毁、重连经 `.info/connected` 自动重写，零自建监控与新鲜度窗口。角色：`role="gm"`（GM 插件在场，玩家端整体让位）| `role="player"`（玩家插件在跑，共卡选举候选资格）。该节点本就是客户端自写域（online/lastActive 及各偏好字段同域），真机已验证自定义字段写入与 onDisconnect 均被规则放行、跨端可读。
- **玩家自理扣减 (player proxy tick)** — GM 旗（role="gm"）缺席时，玩家端自理先攻轮扣减/回退（`src/core/PlayerProxyTicker.js`）：先攻轮到「我写权内」的单位就扣/回退自身 Buff，立即执行、无延迟无挂起。共卡仲裁 = presence 旗选举：候选 = 有权控制（controlledby 显式列表 / "all" 全员名册）∧ 持玩家旗，显式列表按列表序、"all" 按玩家 ID 字典序取首个当选者，仅当选者扣减；旗即在线+运行双信号，当选者掉线自动失格、次候选接管。跨权链接副本在玩家自治部署中不可能存在——副本落盘写在目标单位数据上，宿主写规则天然阻断玩家跨权创建（施加入口的目标写权准入另从源头杜绝），因此无需代驱他人副本的逻辑；隐藏 NPC 自身 Buff 玩家永远无法代扣（写权限硬边界）。
- **施加目标写权准入** — `BuffFloatingPanel.applyBuffToTarget` 是全部施加路径（链接/复制菜单、Buff 拖拽、独立窗口）的唯一入口：无目标控制权者一律入口拒绝（GM 放行）。副本落盘写在目标单位数据上而宿主索引写在施法者自己卡上（必然成功）——不设准入会产生「索引已登记、副本服务端不存在」的幽灵索引，且 UI 误报施加成功。
- **下游子节点统一视图** — 宿主驱动子副本扣减/回退统一走 `_downstreamChildView`（返回 `{view, persist, onExpire, notify}`，人物卡/Token 双后端适配），上层循环不再写 char/token 双分支。
- **Token Buff 数据契约** — Token 自定义字段 `r20_suite_buffs`（JSON：`{ buffs: [...], debuffs: [...] }`）中的条目结构与人物卡 `getAllBuffs` 输出保持同一字段语义（`rowId/name/enabled/rounds/initRounds/extraAttrs/linkHostId/linkSourceRowId/linkChildren`）。所有写入方负责按此结构落盘，读取端直读直返、不做迁移清洗（测试版本，无旧数据包袱）。早期占用 gmnotes 的方案已废弃（用户编辑笔记会冲掉结构化数据）。
- **目标模式 (target mode)** — `Roll20Bridge.resolveBuffTargetMode` 判定单位是人物卡绑定 (`char`) 还是纯 Token，决定路由到哪个持久化后端。**互斥目标铁律**：传给 `BuffStore` 的 target 必须按 `resolved.mode` 严格构建 `{ char }` 或 `{ token }` 单字段对象——杂兵集群 (mook) 的返回值 `char` 字段非空，双字段同传会被 `BuffStore.resolveMode` 的 char 优先短路误路由到人物卡后端。
- **宿主驱动单一业务入口** — 下游子副本的扣减/回退统一走 `Pf1eBuffManager.drivenDecrement / drivenIncrement`：生命周期判定 → 落盘/过期副作用 → 刷新。decrementBuffs/incrementBuffsOnTurnRevert 的下游循环共用此入口；写权限由调用方路由与宿主 Firebase 规则共同保障（玩家向无权副本发起的写入被服务端拒绝且不落库）。

## 架构接缝 (Seams)

- **BuffLifecycle**（`src/core/BuffLifecycle.js`）— Buff/Debuff 轮数生命周期的**纯算法核心**：判定下一状态（expired/decremented/counted/incremented），不做任何持久化。两个 Manager 是同一算法在不同持久化后端上的 adapter：
  - `Pf1eBuffManager` → 角色卡原生属性后端
  - `TokenBuffManager` → Token 自定义字段后端（`r20_suite_buffs`）
- **DragGestures**（`src/core/DragGestures.js`）— 统一拖拽手势工具（Pointer Capture）。只提供 start/move/end 生命周期，几何语义（钳制、锚定、吸附）留在调用方。使用方：调度器标题栏/缩放手柄、独立二级窗口标题栏。新的可拖拽组件一律复用它，不得手写 mousedown/mousemove/mouseup 手势。
- **BuffStore**（`src/core/BuffStore.js`）— **统一存取层门面**：把 Pf1eBuffManager（人物卡属性后端）与 TokenBuffManager（Token 自定义字段后端）的存取 API 合一。目标形如 `{char, token}`（经 `Roll20Bridge.resolveBuffTargetMode` 得出），方法内部按 `resolveMode` 路由，上层不再书写 char/token 双分支。条目形状双后端一致（`rowId/name/enabled/rounds/initRounds/extraAttrs/linkHostId/linkSourceRowId/linkChildren`）。整表写（`saveBuffs/saveDebuffs`）仅 Token 后端可用，对 char 目标显式抛错。已迁移的调用点：回合扣减/回退（bundle 主入口）、调度器面板的读取/开关/轮数/解绑/删除/同名关停/多选启停。
- **就地轮数输入解析** — `Roll20Bridge.parseRoundsInput(raw, char, emptyValue)`：就地编辑 onCommit 的单一收敛点（数字直取、公式借用原生求值、空/常驻/永久/- 按 emptyValue 返回；char 惯用 `""`，Token 惯用 `null`）。
- **Tab 撕裂手势** — `BuffFloatingPanel.handleTabDragTearOff(e, ctx, {beforeSpawn})`：动态 Tab / 钉选 Tab / 独立窗口三处共用的拖离判距（落点在面板外且位移 >25px → 撕离为二级窗口）。
- **Roll20Bridge** — 宿主平台（window.Campaign / Jumpgate）的唯一访问通道。
- **RecalcService** — 官方 sheet worker 重算的无头沙箱服务。
- **SuiteConfigStore** — 用户设置的唯一托管存储。
