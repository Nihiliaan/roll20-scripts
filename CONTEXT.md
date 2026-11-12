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
- **下游子节点统一视图** — 宿主驱动子副本扣减/回退统一走 `_downstreamChildView`（返回 `{view, persist, onExpire, notify}`，人物卡/Token 双后端适配），上层循环不再写 char/token 双分支。
- **Token Buff 数据契约** — Token 自定义字段 `r20_suite_buffs`（JSON：`{ buffs: [...], debuffs: [...] }`）中的条目结构与人物卡 `getAllBuffs` 输出保持同一字段语义（`rowId/name/enabled/rounds/initRounds/extraAttrs/linkHostId/linkSourceRowId/linkChildren`）。所有写入方负责按此结构落盘，读取端直读直返、不做迁移清洗（测试版本，无旧数据包袱）。早期占用 gmnotes 的方案已废弃（用户编辑笔记会冲掉结构化数据）。
- **目标模式 (target mode)** — `Roll20Bridge.resolveBuffTargetMode` 判定单位是人物卡绑定 (`char`) 还是纯 Token，决定路由到哪个持久化后端。

## 架构接缝 (Seams)

- **BuffLifecycle**（`src/core/BuffLifecycle.js`）— Buff/Debuff 轮数生命周期的**纯算法核心**：判定下一状态（expired/decremented/counted/incremented），不做任何持久化。两个 Manager 是同一算法在不同持久化后端上的 adapter：
  - `Pf1eBuffManager` → 角色卡原生属性后端
  - `TokenBuffManager` → Token 自定义字段后端（`r20_suite_buffs`）
- **DragGestures**（`src/core/DragGestures.js`）— 统一拖拽手势工具（Pointer Capture）。只提供 start/move/end 生命周期，几何语义（钳制、锚定、吸附）留在调用方。使用方：调度器标题栏/缩放手柄、独立二级窗口标题栏。新的可拖拽组件一律复用它，不得手写 mousedown/mousemove/mouseup 手势。
- **Roll20Bridge** — 宿主平台（window.Campaign / Jumpgate）的唯一访问通道。
- **RecalcService** — 官方 sheet worker 重算的无头沙箱服务。
- **SuiteConfigStore** — 用户设置的唯一托管存储。
