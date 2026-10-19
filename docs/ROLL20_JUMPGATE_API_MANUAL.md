# Roll20 Jumpgate 现代架构与客户端开发技术手册

> **版本**：2024–2026 Jumpgate Engine
> **运行环境**：Chrome / Tampermonkey (油猴脚本)
> **验证方式**：通过 Chrome DevTools 实时现场探测与源码逆向验证

---

## 一、架构全景与核心全局对象

Roll20 在开启 **Jumpgate（新版引擎）** 后，彻底重构了全局命名空间：
* 废弃了旧时代的 `window.d20`；
* 将战役核心主模型提升挂载为顶层全局对象 **`window.Campaign`**；
* 引入了新的渲染与画布引擎对象 **`window.vttEngine`**；
* 保留了与 Firebase 实时数据库的双向同步机制（基于 Backbone.js 模型体系）。

```
window
├── JUMPGATE_ENABLED (boolean: true)
├── vttEngine (Jumpgate 专属视口与渲染引擎)
├── Campaign (单例 Backbone.Model: 战役根对象)
│   ├── get("turnorder")              // 先攻序列 JSON 字符串
│   ├── get("playerpageid")           // 玩家当前所在页面 ID
│   ├── get("initiativepage")         // 当前开启先攻的页面 ID
│   │
│   ├── characters (Backbone.Collection: 人物卡模型集合)
│   │   └── Character (Backbone.Model)
│   │       ├── id                    // 角色卡 ID (如 "-P35IXylI_HV_ir1Lwqk")
│   │       ├── get("name")           // 角色名
│   │       ├── connectAttributesAndAbilities() // 异步拉取属性核心方法！
│   │       ├── attribs (Collection: 人物属性集合)
│   │       │   └── Attribute (Model)
│   │       │       ├── get("name")   // 属性名 (如 "ac", "hp", "strength")
│   │       │       ├── get("current")// 当前值
│   │       │       ├── get("max")    // 最大值
│   │       │       └── save({ current: val }) // 保存并实时同步到 Firebase
│   │       └── abilities (Collection: 角色专属宏命令)
│   │
│   └── pages (Backbone.Collection: 地图分页集合)
│       └── Page (Model)
│           └── thegraphics (Collection: 当前页面 Token 集合)
│               └── Graphic (Model: 每一个棋子 Token)
│                   ├── id            // Token 唯一 ID (如 "-P3f8i8StN2dZ5a1BuBk")
│                   ├── get("name")   // Token 名字
│                   ├── get("represents") // 绑定的角色卡 ID！
│                   ├── get("statusmarkers") // 状态标记与数字 (如 "red@5")
│                   └── save({ statusmarkers: val }) // 保存并实时同步
│
└── DOM 控制入口
    ├── #textchat-input textarea      // 聊天框输入区
    ├── #chatSendBtn                  // 聊天发送按钮
    └── #initiativewindow             // 先攻窗口
```

---

## 二、关键生命周期与调用规范

### 1. 先攻监听与推进捕获
在 Jumpgate 中，先攻窗口已经被重构为现代化组件（位于 `#vm-turn-order`，外层类名为 `.turn-tracker`）。
底层的先攻数据保存在 `window.Campaign.get("turnorder")`，它是一个序列化的 JSON 数组：
```json
[
  { "id": "-P3f8i8StN2dZ5a1BuBk", "pr": "21.1", "custom": "", "_pageid": "-P30v1xAutOWVw3u6i6d" },
  { "id": "-P3f8i8VhPXWfvjXgFjQ", "pr": "19.07", "custom": "", "_pageid": "-P30v1xAutOWVw3u6i6d" },
  { "id": "-P3fAJAlLPiz1bG5nAEK", "pr": "14.95", "custom": "", "_pageid": "-P30v1xAutOWVw3u6i6d" }
]
```

#### 事件派发机制：统一的 `change:turnorder`
在 Roll20 的响应式设计中，**无论是“下一个”、“上一个”、“排序”还是“手动拖拽”，底层派发的都是同一个 Backbone 事件**：
```javascript
window.Campaign.on("change:turnorder", (campaign, newTurnOrderJson, options) => {
    // 每次先攻列表发生任何变动（前进/后退/排序/拖拽/增删），均在此处触发
});
```

#### 如何精确识别操作类型？
因为所有操作都触发 `change:turnorder`，我们需要根据旧数组与新数组的**队列置换特征**来精确区分业务意图：

1. **“下一个回合（Next Turn）”**：
   * **特征**：标准的队列循环左移（Cyclic Shift）：`[A, B, C] -> [B, C, A]`。
   * **判定条件**：
     ```javascript
     const isNextTurn = (oldList.length === newList.length) &&
                        (newList[newList.length - 1].id === oldList[0].id) &&
                        (newList[0].id === oldList[1].id);
     if (isNextTurn) {
         // 确认为正向回合推进！此时 oldList[0] 的回合正式结束，扣减其身上 Buff 轮数
     }
     ```
2. **“上一个回合（Previous Turn）”**：
   * **特征**：队列循环右移：`[B, C, A] -> [A, B, C]`。
   * **判定条件**：`oldList[oldList.length - 1].id === newList[0].id`。
   * **处理**：通常为 DM 误点回退，此时应跳过扣减（或触发回退补偿）。
3. **“排序 / 拖拽重排”**：
   * **特征**：数组内部顺序调换，但不符合循环移位特征（例如原排头没有移到队尾，或者列表长度变动）。
   * **处理**：仅更新内部缓存的先攻序列，不触发回合结算逻辑。


### 2. 人物卡属性的按需异步拉取（关键突破）
在 Jumpgate 中，战役载入时并不会将所有角色卡的全部属性（数百项）一次性加载到内存中以节省开销。
**必须在操作属性前调用异步连接方法**：
```javascript
const char = window.Campaign.characters.get(characterId);
if (char) {
    // 异步拉取属性与能力到本地 Backbone 集合中
    await char.connectAttributesAndAbilities();
    
    // 此时 char.attribs 已填充完毕
    console.log(`已加载 ${char.attribs.length} 个属性`);
}
```

### 3. 修改属性并同步至云端
```javascript
// 查找指定属性 (如 ac)
const attr = char.attribs.models.find(a => a.get("name") === targetAttrName);
if (attr) {
    const oldValue = attr.get("current");
    // 修改并同步，自动推送到所有在场玩家与 GM 屏幕
    attr.save({ current: Number(oldValue) + bonusValue });
}
```

### 4. Token 状态标记与轮数角标
Token 的状态标记格式为：`"标记名@轮数"` 或逗号分隔的多状态。
* 例如：`"red@5,blue@2"`
* 读取标记：`token.get("statusmarkers")`
* 倒计时扣减与保存：
  ```javascript
  // 持续轮数减 1
  const newMarkers = "red@4";
  token.save({ statusmarkers: newMarkers });
  ```

### 5. 先攻条 UI 注入规范（Vue.js 容器）
Jumpgate 的先攻条采用 Vue.js 渲染（挂载在 `.turn-tracker`），其每一行具备天然的专属属性选择器：
```html
<li class="token" data-tokenid="-P3f8i8StN2dZ5a1BuBk" data-current-index="0">
  <div class="avatar"><img src="..." /></div>
  <div class="name">哈卡</div>
  <div class="initiative editable">21.1</div>
</li>
```
* **注入定位**：直接通过 `li.token[data-tokenid="${tokenId}"] .name` 或 `.avatar` 即可精确定位特定角色的先攻行。
* **重绘守卫（Re-render Guard）**：
  由于 Vue 在先攻轮转时会更新 DOM 列表，我们只需将 UI 渲染函数挂载在 `change:turnorder` 事件或使用 `MutationObserver` 监听 `.token_list_outer`：
  ```javascript
  function renderTurnorderBuffs(tokenId, buffs) {
      const row = document.querySelector(`.turn-tracker li.token[data-tokenid='${tokenId}']`);
      if (!row) return;
      const nameEl = row.querySelector(".name");
      let container = row.querySelector(".custom-buff-container");
      if (!container) {
          container = document.createElement("span");
          container.className = "custom-buff-container";
          nameEl.appendChild(container);
      }
      container.innerHTML = buffs.map(b => `<span class="buff-pill">${b.icon} ${b.name} (${b.duration}轮)</span>`).join("");
  }
  ```

### 6. 聊天栏播报（Jumpgate 稳健方案）

通过直接填充聊天输入区并触发发送按钮，完全规避内部混淆函数：
```javascript
function sendChatMessage(text) {
    const textarea = document.querySelector("#textchat-input textarea");
    const sendBtn = document.querySelector("#chatSendBtn");
    if (textarea && sendBtn) {
        textarea.value = text;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        sendBtn.click();
    }
}
```
