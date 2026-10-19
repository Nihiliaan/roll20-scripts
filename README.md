# Roll20 Suite - PF1e Turnorder Buff Engine

基于 **Roll20 Jumpgate（2024–2026 现代架构）** 的模块化外挂脚本套件。

本项目专为解决跑团中“多 Buff 回合管理极其繁琐、官方 Pro 会员 API 门槛高”的核心痛点而设计。无需任何付费订阅，纯前端客户端驱动，深度联动 **Pathfinder 1e 角色卡原生 Buff 引擎（`repeating_buff2`）**。

---

## 🌟 核心功能

1. **自动先攻回合结算（Turnorder Automation）**：
   * 基于队列循环移位（Cyclic Shift）算法，精准识别“下一个回合”；
   * 自动判定谁的回合结束，无需手动记录或点击；
   * 对“上一个回合（撤销回退）”和“手动拖拽/按点数重排”具有天然免疫防误触机制。
2. **PF1e 原生卡片深度联动（Sheet Worker Integration）**：
   * 直接读取 PF1e 官方卡片的 `repeating_buff2` 重复段落；
   * **无需额外计算数值**：充分利用卡片自带的 Sheet Worker 计算引擎；
   * **到期自动关停**：当持续轮数归零时，自动将 `enable_toggle` 设为 `0`，卡片自动撤销命中/伤害/AC等全部加值；
   * 并在 Roll20 聊天栏自动发送法术结束通知。
3. **原生云端持久化（Cloud Persistence）**：
   * 将剩余轮数天然保存在该 Buff 所在行的 `repeating_buff2_${rowId}_rounds` 属性中；
   * 借助 Roll20 自带的 Firebase 双向绑定总线自动入库；
   * **即使意外关闭网页、刷新页面或换机登录，剩余轮数永不丢失**。
4. **先攻条行内 UI 注入（Turn Tracker HUD）**：
   * 在 Jumpgate 先攻条的每个角色名字右侧直接挂载渐变色胶囊徽章：
     `哈卡 ✨ 神恩 [4轮]`；
   * 随先攻轮转实时响应刷新；
   * **支持即时交互**：鼠标单击任意徽章，直接弹窗修改或设定剩余轮数。

---

## 📂 项目结构

```
d:\Projects\Roll20Scripts\
│
├── docs/
│   └── ROLL20_JUMPGATE_API_MANUAL.md     # Jumpgate 现代架构与逆向接口手册
│
├── src/
│   ├── core/                              # 平台核心基座
│   │   ├── Roll20Bridge.js                # 与 Campaign/Token/Character 通信桥梁
│   │   └── TurnOrderObserver.js           # 先攻循环移位监听器
│   │
│   ├── modules/                           # 业务功能模块
│   │   └── pf1e-buff-tracker/             # PF1e 原生 Buff 追踪子系统
│   │       ├── Pf1eBuffManager.js         # Buff 数据状态与扣减逻辑
│   │       └── Pf1eBuffUI.js              # 先攻条徽章注入与交互
│   │
│   └── roll20-suite.user.js               # 完整的单文件油猴脚本入口
│
└── README.md
```

---

## 🚀 安装与使用

### 方式一：Tampermonkey（油猴脚本）
1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 插件；
2. 新建脚本，将 [roll20-suite.user.js](file:///d:/Projects/Roll20Scripts/src/roll20-suite.user.js) 的全部内容复制粘贴进去并保存；
3. 打开或刷新 Roll20 战役页面（`https://app.roll20.net/editor/*`）；
4. 打开先攻条，即可看到每个勾选了 Buff 的角色后方自动出现了实时徽章！

---

## 🛠️ 技术原理

详细的 Jumpgate 数据拓扑结构、DOM 属性规范与通信模型请参考：
👉 [ROLL20_JUMPGATE_API_MANUAL.md](file:///d:/Projects/Roll20Scripts/docs/ROLL20_JUMPGATE_API_MANUAL.md)
