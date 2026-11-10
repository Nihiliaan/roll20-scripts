# CONTEXT.md — 领域词汇表

Roll20 Suite 的领域语言。架构讨论（模块命名、接口设计、代码评审）统一使用以下术语。

## 领域概念

- **Buff** — 施加在角色卡（PF1e repeating_buff2 行）或纯 Token（gmnotes 数据块）上的增益状态，可有持续轮数或常驻。
- **Debuff** — 负面状态（PF1e 官方 condition-* 字典或 Token gmnotes 中的 isDebuff 条目）。
- **轮数 (rounds)** — 剩余持续回合数。`null`/空 表示**常驻**（不参与回合扣减）。
- **回合扣减 (tick)** — 单位回合开始时，其身上有效轮数的 Buff/Debuff 统一 -1；归零即**过期 (expired)**。Debuff 允许 0/负数轮数**持续正计轮 (counted)**（0 → -1 → -2...），期间状态保持激活。
- **先攻回退 (revert)** — 倒回先攻排头时，被拉回单位身上的有效轮数统一 +1。
- **影子链接 (shadow link)** — 施法者主 Buff 向受术者远程投放的副本。受术者副本带 `link_host_id`（认老大），宿主带 `link_children`（记小弟）。链接副本绝不在受术者自己回合扣轮，而由施法者回合统一驱动。
- **目标模式 (target mode)** — `Roll20Bridge.resolveBuffTargetMode` 判定单位是人物卡绑定 (`char`) 还是纯 Token，决定路由到哪个持久化后端。

## 架构接缝 (Seams)

- **BuffLifecycle**（`src/core/BuffLifecycle.js`）— Buff/Debuff 轮数生命周期的**纯算法核心**：判定下一状态（expired/decremented/counted/incremented），不做任何持久化。两个 Manager 是同一算法在不同持久化后端上的 adapter：
  - `Pf1eBuffManager` → 角色卡原生属性后端
  - `TokenBuffManager` → Token gmnotes 后端
- **Roll20Bridge** — 宿主平台（window.Campaign / Jumpgate）的唯一访问通道。
- **RecalcService** — 官方 sheet worker 重算的无头沙箱服务。
- **SuiteConfigStore** — 用户设置的唯一托管存储。
