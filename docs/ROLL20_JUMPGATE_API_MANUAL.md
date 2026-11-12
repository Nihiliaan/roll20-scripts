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

---

## 三、Jumpgate 画布选区系统与原子操作通道 (Selection System)

在 Jumpgate 现代引擎中，传统 Fabric.js 画布的 `canvas.getActiveObjects()` 与 `selection:created/updated/cleared` 事件已彻底失效。Jumpgate 采用 Babylon.js 渲染管线与专有的 Tabletop 选区控制器。

### 1. 核心选区容器与数据获取

Jumpgate 的全局选区由 `window.Campaign.engine.tabletop` 单例统一管理。
* **数据源**：调用 `tabletop.getSelection()`。
* **数据结构**：返回一个数组，元素为选中的图元对象（TransformNode 封装项），其关键字段如下：
  ```javascript
  const selection = window.Campaign?.engine?.tabletop?.getSelection() || [];
  // selection: Array<Item>
  // item.id: 图元唯一 ID (即 Token ID，如 "-P57VGeufiAOCIs8SfbI")
  // item.model: 关联的 Backbone Token Graphic 模型 (部分多选或图元未缓存时可能为空)
  ```
* **单选与多选的统一性**：
  经逆向与现场探测，`tabletop.getSelection()` 内部直接返回底层选区容器的 `children` 数组。**无论是单选 1 个棋子，还是按住 Shift 连选、或通过拉框（Marquee Select）多选多个棋子，所有选中项均统一保存在该数组中**，不存在额外隔离的“多选专用容器”。
* **Token Model 稳健提取方式**：
  若 `item.model` 未就绪，统一通过 `Roll20Bridge.getTokenGraphic(item.id)` 或当前活动页面的 `thegraphics.get(item.id)` 提取图元模型，确保 100% 映射到对应的角色卡（`item.model.get("represents")`）。

### 2. 选区变动的三个原子操作通道

Jumpgate 底层**并没有向外部暴露通用的 `engine.on("selection:change")` 事件**（`tabletop` 实例不具备 `.on()` 方法）。所有选区变动在原型链（`Object.getPrototypeOf(tabletop)`）上完全收敛于以下三个原子操作：

| 原型方法 | 触发场景 | 业务行为 |
| :--- | :--- | :--- |
| `tabletop.addToSelection(node)` | 单选棋子、Shift 加选棋子、框选收集棋子 | 将指定图元加入底层选区容器 |
| `tabletop.removeFromSelection(node)` | Shift 减选棋子、脚本程序化移出单个棋子 | 将指定图元移出底层选区容器 |
| `tabletop.clearSelection()` | 点击画布空白处、单选切换前置清理、框选重置 | 清空底层选区容器中的所有图元 |

### 3. 高性能选区响应式感知最佳实践

为杜绝死循环定时器（setInterval）与高频空跑的鼠标事件监听（如 canvas `mouseup`），在扩展插件中推荐直接在 `Tabletop.prototype` 上透明包装上述三个原子方法，并施加轻量防抖（20~30ms），合并框选时密集触发的多次 `addToSelection`：

```javascript
function initJumpgateSelectionWatcher(onSelectionChanged) {
    const tt = window.Campaign?.engine?.tabletop;
    if (!tt) return;

    const proto = Object.getPrototypeOf(tt);
    if (!proto || proto._r20SuiteSelectionHooked) return;

    let debounceTimer = null;
    const notifyDebounced = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            onSelectionChanged(tt.getSelection() || []);
        }, 25);
    };

    const origAdd = proto.addToSelection;
    if (typeof origAdd === "function") {
        proto.addToSelection = function(...args) {
            const res = origAdd.apply(this, args);
            notifyDebounced();
            return res;
        };
    }

    const origRemove = proto.removeFromSelection;
    if (typeof origRemove === "function") {
        proto.removeFromSelection = function(...args) {
            const res = origRemove.apply(this, args);
            notifyDebounced();
            return res;
        };
    }

    const origClear = proto.clearSelection;
    if (typeof origClear === "function") {
        proto.clearSelection = function(...args) {
            const res = origClear.apply(this, args);
            notifyDebounced();
            return res;
        };
    }

    proto._r20SuiteSelectionHooked = true;
}
```

### 4. 程序化取消选中规范

需要取消选区中的某单个棋子时（如用户在调度器中点击该单位 Tab 的关闭按钮）：
* **严禁**：私设外部排除黑名单（如 `_deselectedTokenIds`），避免状态不同步导致再次框选失效；
* **正确做法**：直接在 `tabletop.getSelection()` 中检索目标项，调用 `tabletop.removeFromSelection(item)` 将其移出官方选区。框架完成图元状态更新后，通过上述原型钩子自动触发下游 UI 调和。

---

## 四、Roll20 原生属性保存管道与来源报告架构 (Attribute Persistence & Source Attribution)

在扩展开发中，若在战役中为多个角色的集合盲目注册 Backbone 事件监听（如 `char.attribs.on(...)`），会带来高昂的内存占用、碎片化事件风暴以及无法预知的竞态死循环（例如在 `change` 与 `add` 间的时序漏洞）。

经对 Jumpgate 底层 Backbone 架构逆向审查，所有人物卡属性的变更与保存，在底层原型链上高度收敛于单一通道。

### 1. 原生属性保存的三个底层入口

所有角色属性对象（`Attribute`）均继承自 `Backbone.Model`，其实例原型上挂载了 Roll20 专有的同步保存方法：

| 原型方法 | 触发场景 | 底层行为 |
| :--- | :--- | :--- |
| `Attribute.prototype.advancedSheetSave(data, callback)` | 原生人物卡编辑器（Sheet Worker）修改属性 | 专用于人物卡表单与 Worker 计算提交，内部调用 `this.save(data, { patch: true })` |
| `Attribute.prototype.syncedSave(attrs)` | 棋子属性关联同步（如 Token 属性栏变动） | 触发属性保存，并同步调用 `updateTokensByName` 更新画布 Token |
| `Attribute.prototype.save(key, val, options)` | 外部宏（Macro）、API 脚本及插件自身调用 | Backbone 标准保存入口，序列化后推送到 Firebase 实时数据库 |

### 2. 来源报告更新架构 (Source Attribution Pattern)

利用底层调用的必然收敛性，全系统无须对战役角色分散建立多重监听，而是采用“来源报告器”架构：

1. **插件自身发起的修改（显式调用，0 监听）**：
   * 插件在修改 Buff 或 Debuff 属性时，显式传递来源戳记 `{ bySuite: true }`；
   * 操作完成时就地显式调用渲染函数，绝对不依赖被动事件，0 延时且完全无竞争。
2. **官方人物卡与外部宏的修改（底层源头统一报告）**：
   * 在 `Attribute.prototype.save`（及 `advancedSheetSave`）上挂载透明拦截器；
   * 若变动携带 `{ bySuite: true }`，直接放行，杜绝反向二次触发；
   * 若变动来源于原生人物卡编辑器或宏，且属性属于关心的业务字段（如 `condition-` 或 `repeating_buff2_`）：
     由源头直接派发轻量报告事件，调度器施加 25ms 防抖后，仅针对受影响的角色定向刷新先攻条徽章与当前激活的悬浮面板。

```
[业务操作来源]
  ├── 插件自研面板/弹窗操作 ────(显式传入 bySuite: true)───> 原地驱动视图更新 (0 外部监听)
  └── 官方原生人物卡/宏操作 ───(拦截 Attribute.prototype)──> 底层单一源头报告 ──(25ms防抖)──> 定向刷新
```

### 3. 内存变量与 DOM 视图渲染分工

* **先攻条（宿主原生 Vue 容器）**：先攻条属于宿主 DOM 树，且条目只展示渲染后的静态徽章，因此当角色数据发生变动时，必须接收报告并执行局部的 DOM 重绘；
* **插件自研面板（Direct Memory Views）**：插件自身持有的悬浮窗视口，应在用户交互发生时直接读取与修改当前内存中的 Backbone Model 引用，实现就地瞬时响应，无须等待网络回环或外部事件通知。

---

## 五、Jumpgate Vue 3 先攻条渲染机理与零闪烁原生同步架构 (Vue 3 Initiative Reactive Architecture)

### 1. 先攻条 Vue 3 组件层级结构

在 Jumpgate 引擎中，先攻条完全采用 **Vue 3** 单文件组件（SFC）构建，DOM 与组件映射关系如下：

```
DOM: #vm-turn-order (__vue_app__)
└── Root Component: TurnTrackerApp
    └── SubTree Component: TurnTracker (props: { entries, isGm, autoSort, initialLocation })
        └── Template Fragment (v-for entries)
            └── Child Component: TurnTrackerEntry (props: { entry, isGm, isEditing, ... })
                └── DOM: li.token[data-tokenid="..."]
                    ├── div.avatar (头像)
                    ├── div.name (角色名)
                    ├── div.initiative.editable (先攻点数输入框)
                    ├── Symbol(v-cmt) (Off-flow probe 注释)
                    └── span.name-measure (宽度探测占位)
```

### 2. 先攻前进与排序闪烁的深层根因逆向分析

在扩展开发早期，先攻前进或排序时画面会出现约 80ms ~ 100ms 的肉眼可见闪烁（标签全部消失后重新跳出）。经微秒级断点追踪与 Vue 3 渲染栈审查，查明两大根因：

1. **Roll20 原生 Key 拼接缺陷导致全量 DOM 销毁**：
   Roll20 在 `TurnTracker` 遍历渲染子项时，为 `TurnTrackerEntry` 分配的 key 并非单纯的 Token ID，而是：
   ```javascript
   key: `${entry.id}-${index}`  // 如 "-P57VGeyWuEonbyOoqJv-0"
   ```
   当点击“前进（Next Turn）”或“排序（Sort）”时，条目在列表中的数组下标全部移位（例如排头下标从 0 变更为 5）。Vue 3 的列表 Diff 算法比对发现**所有项的 Key 均与上一帧完全不匹配**，判定旧节点全部失效，底层调用 `nodeOps.remove` 将整个列表的所有 `li.token` DOM 节点彻底从树中拔除，随后重新全量创建并挂载新节点！
2. **异步防抖导致的断档空白期**：
   旧逻辑使用 `MutationObserver` 监听 DOM 树的重新插入，但人为施加了 80ms 防抖（`setTimeout(..., 80)`）以防连环触发。从 Vue 3 插入光秃秃的原生节点，到 80ms 防抖到期重新塞入 Buff 徽章，这中间产生了整整 84 毫秒的空白断档，直接在屏幕上表现为剧烈的视觉闪烁。

### 3. 零闪烁纯同步原生调和架构 (Zero-Latency Sync Reconciliation)

为了彻底根除闪烁并实现“纯内存直引”，我们放弃散落的异步 DOM 监听，直接接轨 Vue 3 原生组件生命周期：

```
Roll20 先攻数据变动 (Campaign.set("turnorder"))
    │
    ▼
Vue 3 TurnTracker 重新 patch 先攻列表并生成新 li.token
    │
    ▼ 【同一微任务执行帧，浏览器尚未 Paint 画面】
Vue 3 updated / mounted 生命周期钩子同步触发 (trackerComp.u / trackerComp.m)
    │
    ▼
Pf1eBuffUI.syncPatchAllBadges() 纯同步就地直引
    ├── 从 character.attribs.models 纯同步提取 Buff/Debuff (耗时 < 0.01ms，零 Promise)
    ├── 签名指纹比对 (未变动行 0 破坏)
    └── 瞬间就地挂载 .r20-debuff-container 与 .r20-buff-container
    │
    ▼
浏览器 Compositor 合成并向屏幕呈现第一帧
【呈现的首帧即原生包含完整 Buff/Debuff，闪烁彻底归零 (0ms)】
```

#### 关键技术实现要点：
1. **组件生命周期劫持 (`hookVueTurnTracker`)**：
   在先攻条渲染根节点 `#vm-turn-order._vnode.component.subTree.component` 上，将其内部原生的 `u`（updated）与 `m`（mounted）回调数组中注册纯同步挂载函数；
2. **纯同步内存数据直引 (`getActiveBuffsSync` / `getActiveDebuffsSync`)**：
   先攻列表的推进与排序**仅仅是视口条目的位置重排，并未改变任何角色的 Buff 内容**。渲染逻辑坚决移除所有 `async / await` 链条与 `ensureCharacterAttributes` 异步等待，直接从当前已驻留内存的角色属性模型中即时提取，实现微秒级瞬间生成；
3. **双重保险机制**：
   `Campaign.initiativewindow.rebuildInitiativeList` 原生方法挂钩 + 同步 `MutationObserver` 兜底，确保无论先攻条是初次打开、窗口缩放还原、还是翻页切换，Vue 3 组件钩子与同步调和 100% 自动绑定。

---

## 六、状态工作台交互规范与原生 Repeating Section 重排机理 (Buff Workbench & Repeating Section Reordering)

### 1. 原生 Repeating Section 顺序持久化机制 (`_reporder`)

在 Roll20 官方人物卡（PF1e Sheet）中，重复项列表（Repeating Section，如 `repeating_buff2`）的呈现顺序并非依赖属性在 Collection 中的物理索引，而是由一个专有的元数据属性统一控制：
* **属性名称**：`_reporder_repeating_<section_name>`（如 `_reporder_repeating_buff2`）；
* **存储格式**：逗号分隔的各条目唯一 Row ID 字符串（全部小写），例如：
  ```
  "-p5mmif6ezw-kegkmne-,-p5lr4jve8ix3e3jgzbd,-p5mmi0bwb2ngpmafkry"
  ```
* **工作台重排实现**：
  当用户在工作台视口内拖拽 Buff 调整顺序时，插件计算落点并更新该属性的字符串，官方人物卡与工作台视图同步获得官方原生级的重排生效。

### 2. 拖拽意图识别与自链接防御不变量 (Self-Link Defense Invariant)

当在视口中拖拽 Buff 项时，必须严格根据来源宿主与放置目标进行二元意图解耦：

| 拖拽场景 | 判定条件 | 业务意图 | 处理策略 |
| :--- | :--- | :--- | :--- |
| **同一角色条目间拖拽** | `sourceTarget.id === currentTarget.id` 且置于某项上下半区 | **调整显示顺序 (Reorder)** | 阻止冒泡到视口，调用 `reorderBuffs` 重新排列，**绝对禁止创建链接** |
| **同一角色视口空白处拖拽** | `sourceTarget.id === currentTarget.id` 且置于视口空白区 | **无效操作 / 防御兜底** | 拦截 drop，**绝对禁止调用 `applyBuffToTarget` 创建自身到自身的影子链接** |
| **跨角色条目/视口拖拽** | `sourceTarget.id !== currentTarget.id` | **跨单位施加 (Apply / Link)** | 创建同调影子链接副本，打上 `link_host_id` 标签 |

### 3. 多选高亮与双态正交视觉模型 (Multi-Selection & Orthogonal States)

工作台彻底清退了传统的 Checkbox 复选框，采用高度紧凑的现代化正交双态模型：

```
条目状态维度：
├── 激活状态 (业务数据层: is-active vs is-inactive)
│   ├── is-active  ──> 内部深蓝高亮背景 (background: #1e3a8a, box-shadow 内发光)
│   └── is-inactive ──> 暗底静默 (background: #1e293b, opacity: 0.75)
└── 选中状态 (界面交互层: is-selected)
    └── is-selected ──> 天蓝色高亮外框描边 (outline: 2px solid #38bdf8, 外发光)
```

* **双态可自由叠加**：一个 Buff 可以是“激活且选中”、“激活且未选”、“关停且选中”或“关停且未选”；
* **快捷交互**：
  * **单击**：单选；支持 `Ctrl` / `Meta` 自由多选追加与移出；支持 `Shift` 区间连选与视口空白处拉框（Marquee Selection）；
  * **双击 (`dblclick`)**：单手极速切换激活/关停状态；
  * **右键菜单**：支持针对当前选中的所有 Buff 批量执行“⚡ 激活选中Buff”、“⛔ 关停选中Buff”，以及全选区跨角色“🛑 关停所有选中单位同名Buff”。

---

## 第七章：宿主免疫级合成失焦规范与瞬态 UI 外部交互模式 (Host-Immune Synthetic Blur Architecture)

### 1. 宿主环境事件流阻断机制与原生 `blur` 失效根因

在 Roll20 Jumpgate 现代画布（Canvas）与复杂的侧边栏、工具栏环境中，原生的失焦交互面临严重的运行障碍：
* **`e.preventDefault()` 导致的焦点死锁**：
  Roll20 的主虚拟桌面画布（`#editor-wrapper`）以及许多原生按钮在监听鼠标按下（`pointerdown` / `mousedown`）时，为阻止浏览器默认的文字选择与滚动条拖蓝，普遍显式调用了 `e.preventDefault()`；
* **浏览器的焦点转移前提**：
  在 W3C 标准中，只有当鼠标按下动作没有被 `preventDefault()` 阻止时，浏览器才会把输入焦点从当前的 `<input>` 转移走并触发 `blur` 事件。因此，当用户在输入框内输完内容并点击 Roll20 画布地图时，输入框永远无法失去焦点，原生的 `blur` 回调永远不会被派发；
* **`e.stopPropagation()` 导致的冒泡监听截断**：
  若在 `document` 上挂载冒泡阶段的点击监听器（如常规的 click-outside 实现），Roll20 内部的各图元处理代码会在事件冒泡路径上直接阻断，导致外部悬浮的右键菜单或输入框无法收到关闭信号。

### 2. 捕获阶段前置感知与 `AbortController` 原子注销模型

为解决上述焦点死锁与冒泡截断问题，Roll20 Suite 抽象出了“宿主免疫级合成失焦原语”：
1. **顶层 `window` 捕获阶段（Capture Phase）**：
   在事件从 `window` 向目标元素下行的阶段拦截指针（`useCapture: true`）。此时 Roll20 的画布代码尚未介入，无法通过 `preventDefault()` 或 `stopPropagation()` 屏蔽我们；
2. **`AbortController` 信号源托管**：
   将瞬态 UI 开启期间挂载的所有临时监听器（`pointerdown`, `contextmenu`, `blur`）统一绑定至同一个 `AbortSignal`；一旦命中外部交互或主动取消，调用 `ac.abort()` 即可由浏览器底层原子级释放所有监听器，实现 0 内存残留与 0 空跑性能消耗；
3. **DOM 类型安全判定**：
   在指针目标判定时，严格校验 `e.target instanceof Node`，防范在点击 `window`、跨域 iframe 或未挂载的特殊对象时调用 `contains()` 抛出 DOMException 异常。

### 3. 通用原语封装：`Roll20Bridge.watchDismissal`

通信层将该模式封装为标准 API，供所有瞬态 UI（Transient UI）统一调用：

```javascript
/**
 * 宿主免疫级失焦与点击外部监听器
 * @param {Element} targetEl 保持聚焦的目标 DOM 元素（输入框、菜单容器等）
 * @param {Function} onDismiss 命中外部交互时的失焦回调
 * @param {Object} [options]
 * @returns {Function} 允许调用方提前主动注销监听的 cleanup() 函数
 */
Roll20Bridge.watchDismissal(targetEl, onDismiss, options);
```

### 4. 标准落地场景

| 场景组件 | 交互意图 | 统一落地实现 |
| :--- | :--- | :--- |
| **右键上下文菜单** (`BuffFloatingPanel.showBuffContextMenu`) | 点击菜单外部（包括 Roll20 地图、先攻栏、聊天窗）时自动平滑关闭菜单 | `Roll20Bridge.watchDismissal(menu, () => menu.remove());` |
| **调度器就地轮数编辑** (`BuffFloatingPanel` / `BuffDetachedWindow`) | 点击输入框外部任何位置立即保存数值或公式并重排恢复视口 | `Roll20Bridge.watchDismissal(input, () => commit());` |
| **先攻栏徽章轮数就地编辑** (`Pf1eBuffUI.refreshRowBadgeSync`) | 徽章轮数原地变输入框，输完后点击屏幕任何位置立即完成保存写回 | `Roll20Bridge.watchDismissal(input, () => commit());` |

---

## 八、原生人物卡 DOM 模板注入规范 (Native Sheet Template Patching)

Roll20 官方人物卡系统在底层维护着所有角色卡共享的单例模板对象，对人物卡进行功能扩展时，应当遵循“源头模板一次性打补丁”原则，杜绝针对运行时 DOM 的繁琐监听。

### 1. 官方人物卡渲染与 Repeating Section 底层机理

通过逆向审查 Roll20 官方人物卡视图控制器（`CharacterView`），其人物卡渲染与数据流遵循以下标准管线：

1. **战役全局单例共享模板**：
   战役内所有 `Character` 模型共享同一个 `characterSheet` 单例对象，其原始 HTML 结构固化在 `char.characterSheet.layouthtml` 字符串中。任何人物卡窗口被打开时，官方视图执行：
   ```javascript
   this.$charsheet.html(this.model.characterSheet.layouthtml);
   ```
2. **隐藏的 `<fieldset>` 即 DOM 模板容器**：
   在官方人物卡 HTML 中，所有重复列表（如 Buff 列表 `repeating_buff2`、武器 `repeating_weapon`、法术 `repeating_spells` 等）均由一个隐藏的 `<fieldset class="repeating_<groupname>">` 定义原型。官方在 `setupRepeatingControls()` 执行后将其 `hide()`。
3. **点击“+Add”新增行的克隆机制**：
   当用户在人物卡内点击 `+Add` 按钮时，官方事件处理函数直接读取紧邻的前置 fieldset 原型并生成新节点：
   ```javascript
   const R = P.prev("fieldset").html();
   const O = $(`<div>${R}</div>`);
   P.append(`<div class='repitem' data-reprowid='${I}'>...${O.html()}</div>`);
   ```
4. **属性自动回填与失焦自动持久化**：
   官方通过 `baseUpdateSheetValues()` 扫描重复列表中的每一个属性。只要输入控件的 `name` 严格遵循官方命名规则（如 `name="attr_init_rounds"`）：
   - **读取回填**：官方引擎自动读取底层属性 `repeating_buff2_${rowId}_init_rounds` 并回显到输入框中；
   - **存盘写回**：官方在 iframe 顶层绑定了统一的 `handleBlur` 监听器，只要用户失焦，自动调用 `saveSheetValues(this)` 提交给底层 Backbone 属性并同步到 Firebase 云端。

### 2. 源头模板一次性打补丁最佳实践 (`CharacterSheetBuffEnhancer`)

基于上述第一性原理，扩展字段的注入应在页面加载后对模板源头一次性执行：

```javascript
// 1. 挂钩 CharacterView 原型 postRender 生命周期
const char = window.Campaign?.characters?.at(0);
const proto = char?.view ? Object.getPrototypeOf(char.view) : null;
if (proto && !proto._r20SuiteTemplateHooked) {
    proto._r20SuiteTemplateHooked = true;
    const origPostRender = proto.postRender;
    proto.postRender = function() {
        if (this.model?.characterSheet) {
            CharacterSheetBuffEnhancer.patchLayoutHtml(this.model.characterSheet);
        }
        return origPostRender.apply(this, arguments);
    };
}

// 2. 直接对全局共享模板 characterSheet.layouthtml 注入扩展控件
CharacterSheetBuffEnhancer.patchLayoutHtml(char.characterSheet);
```

### 3. 架构收益

* **零 DOM 监听消耗**：彻底移除针对人物卡 DOM 树的 `MutationObserver` 与轮询定时器；
* **天然原生融合**：所有后续打开的人物卡、切换标签页、以及点击 `+Add` 新增的条目，全由官方原生引擎从被增强后的模板自动生成并管理数据，实现 100% 宿主原生支持。

---

## 九、自定义数据联动宿主行为合流原则 (Custom Data Host-Action Merging)

当自定义扩展数据与宿主核心实体状态存在联动关系时（典型场景：Buff 开启激活时，当前剩余轮数必须重置为初始预设轮数），严禁采用外围事后监听补丁，统一采用宿主行为源头合流架构。

### 1. 传统外围补丁的架构缺陷

在传统思维中，开发者常通过在属性上挂载 `change` 监听、或在界面点击事件外部启动一个异步定时器来“检测开关变动并补设轮数”。这种模式存在严重缺陷：
* **时序缝隙 (Race Conditions)**：开关已开启，但轮数尚未重置，先攻条或悬浮窗在微任务帧中已渲染了脏数据；
* **状态分裂 (State Inconsistency)**：原生人物卡内点击 Enable 时，如果外围监听器因事件未冒泡而漏检，导致只有自研面板开启能重置轮数，原生卡片开启无法重置；
* **逻辑冗余与易漏性**：每一个激活 Buff 的调用点都要手动重复编写“重置轮数”代码，一旦新增业务入口就会遗漏。

### 2. 三位一体的源头合流架构

Roll20 Suite 建立了“视图层-业务层-模型层”三位一体的原生合流机制：

```
用户触发开关 (原生卡片勾选 / 悬浮窗点击 / 脚本调用)
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
[原生视图保存]     [自研统一业务入口]  [底层模型持久化]
saveSheetValues    toggleBuff         syncedSave
    │                │                │
    └────────────────┴────────────────┘
                     │ (同一个原子行动)
                     ├── 1. 计算初始公式并设置 rounds = initRounds
                     ├── 2. 设置原生开关 enable_toggle = 1
                     ├── 3. 驱动官方 Sheet Worker 加值加减重算
                     └── 4. 自动推送广播至所有下游订阅者
```

1. **业务层原子行动收敛 (`Pf1eBuffManager.toggleBuff`)**：
   将 Buff 激活解耦为原子行动：激活时无条件求值 `init_rounds` 并写入 `rounds`，随后开启 `enable_toggle` 并驱动官方加值重算；关停时自动将 `rounds` 归零，杜绝僵尸轮数残留。
2. **原生人物卡视图层拦截 (`CharacterView.prototype.saveSheetValues`)**：
   挂钩官方人物卡保存入口。当玩家在官方人物卡上点击 `attr_enable_toggle` 勾选开启时，切面在官方保存开关的同一微任务帧内，直接就地求值并将满轮数写入 `attr_rounds`，与官方加值计算浑然一体。
3. **数据模型层兜底守卫 (`Attribute.prototype.syncedSave`)**：
   在底层的属性写入切面中，只要捕获到 `repeating_buff2_<rowId>_enable_toggle` 变为 1，自动守卫性地完成轮数初始化，实现全系统 100% 统一。

---

## 十、基于 is_npc 与 Token 唯一性的双轨存储分流规范 (Dual-Track Buff Storage)

面对战役中复杂的棋子-人物卡多对一与多图投射关系，系统统一遵循以下两级判定分流准则：

### 1. 业务逻辑核心仲裁流

```
输入实体: Token (棋子)
         │
         ▼
该 Token 是否关联人物卡 (token.get("represents"))?
         ├── 否 ──> 纯图元/无卡野怪模式: 独立持久化至 Token 自身 (TokenBuffManager / 自定义字段 r20_suite_buffs)
         └── 是
              │
              ▼
人物卡是否勾选 "THIS is an NPC OR MONSTER" (attr_is_npc === "1")?
              ├── 否 (玩家卡 PC) ──> 无论当前地图或全战役有几个代表棋子，全系统统一持久化至人物卡 (repeating_buff2)
              └── 是 (怪物卡 NPC)
                   │
                   ▼
当前作战地图中代表该卡片的棋子数量 (tokenCount)?
                   ├── tokenCount === 1 (独占有名怪 / Boss) ──> 持久化至人物卡 (repeating_buff2)
                   └── tokenCount > 1 (非独占杂兵集群 / Mooks) ──> 自动隔离持久化至各棋子自身 (TokenBuffManager / 自定义字段 r20_suite_buffs)
```

### 2. 架构设计不变量 (Architectural Invariants)

1. **玩家卡绝对优先 (PC Invariant)**：
   若人物卡未勾选“THIS is an NPC OR MONSTER”（`is_npc !== "1"`），判定为玩家实体。无论当前地图或全战役存在多少代表该实体的棋子（如镜像、多视角、跨图），Buff 统一持久化至人物卡（`repeating_buff2`），享受官方属性求值；
2. **怪物卡拓扑降级 (NPC Mook Demotion)**：
   若人物卡为怪物卡（`is_npc === "1"`），系统检测当前作战地图中代表该卡片的棋子数量：
   - **独占棋子 (`tokenCount === 1`)**：作为独占 Boss 记录于人物卡；
   - **非独占多棋子 (`tokenCount > 1`)**：判定为共用模板的杂兵集群，Buff 自动隔离存储于各棋子自身（`TokenBuffManager` / 自定义字段 `r20_suite_buffs`），杜绝状态互相污染与多重先攻扣轮雪崩；
3. **纯图元兜底**：无对应人物卡的棋子始终由棋子自身持久化。









## 十一、队列消耗式主从级联销毁规范 (Queue-Drain Cascade Lifecycle)

### 1. 业务拓扑与传统遍历陷阱
在状态调度系统（Buff Tracker）中，存在施法者（宿主/老大）与受术者（下游/小弟）的树状订阅拓扑关系：
- 老大身上记录其所管辖的全部下游受术者索引：`repeating_buff2_${rowId}_link_children` 或 `${conditionKey}_link_children`（JSON 数组形式，存储各小弟的 `charId` 与 `rowId`）；
- 小弟身上记录所属宿主指针：`_link_host_id` 与 `_link_source_row_id`。

**传统快照遍历与人工截断标记的陷阱**：
若宿主在销毁时，先生成小弟列表的快照数组（如 `[...children]`）进行 `for` 循环遍历，并试图传递 `isCascade = true` 等人工标记强制要求小弟“不准向宿主除名”，极易破坏状态对称性与单责任契约；一旦小弟内部销毁时序略有差异或宿主提前删除了索引属性，将引发未捕获的重入异常、脏数据孤儿残留，甚至造成 Roll20 页面冻结。

### 2. 队列消耗核心模式 (Drain over Iteration)
严格规整后的生命周期销毁流程，将老大的阶段一销毁建模为**纯粹的队列消耗（Queue-Drain）**：
1. **工作队列语义**：老大的 `link_children` 列表本质上就是待销毁任务的工作队列；
2. **无需快照与索引递增**：老大无需复制快照，也无需任何 `for` 循环遍历。只需以 `while (true)` 持续轮询自身当前的 `link_children` 属性；
3. **只调用队头 delete**：只要队列中存在小弟，老大仅需取出队头元素（`children[0]`），直接调用该小弟自身的正规原生 `delete` 方法；
4. **小弟自毁除名驱动队列收敛 (Self-Reporting Convergence)**：小弟在执行正规自毁时，必定会向上级宿主发送汇报并调用 `removeDownstreamLink(老大)`，这一步会自动将小弟自己从老大的 `link_children` 中注销剔除。当下一次 `while` 循环到来时，老大的小弟名单已经自动减去 1 项，下一项自然移到队头；
5. **小弟归零方可终局自毁 (Bottom-Up Invariant)**：循环持续消耗，直到老大的 `link_children` 被小弟们全部排空并彻底销毁属性。此时，老大确认自己名下已无任何小弟，方才从容进入阶段二：物理销毁自身的原生行属性并触发人物卡重算。

### 3. 标准实现范式
```javascript
// === 阶段一：老大只需循环调用小弟自毁，直到自己小弟一个都不剩 ===
const childrenAttrName = `${prefix}_link_children`;
while (true) {
    const childrenAttr = character.attribs.models.find(a => a.get("name") === childrenAttrName);
    if (!childrenAttr || !childrenAttr.get("current")) break;
    
    let children = [];
    try { children = JSON.parse(childrenAttr.get("current")); } catch (e) { children = []; }
    if (!Array.isArray(children) || children.length === 0) break;

    const item = children[0];
    const cChar = window.Campaign?.characters?.get(item.charId);
    if (cChar) {
        // 直接调用小弟自身的原生 delete 方法；小弟自毁时会在本宿主处除名 (removeDownstreamLink)
        if (item.rowId && item.rowId.startsWith("condition-")) {
            await this.deleteDebuffPermanently(cChar, item.rowId, visited);
        } else {
            await this.deleteBuffRowPermanently(cChar, item.rowId, visited);
        }
    } else {
        // 针对孤儿脏数据（角色已离线/被删），直接强制除名推进队列
        await this.removeDownstreamLink(character, rowId, item.charId, item.rowId);
    }
}
// === 阶段二：小弟已一个不剩，宿主自身彻底自毁 ===
```

## 十二、Debuff 显式登记持久化与全生命周期规范 (Tracked Debuffs Architecture)

### 1. 设计哲学：白名单登记而非状态推断
Roll20 官方 Pathfinder 1e 人物卡预置了 30 余种负面状态（Condition）。若仅凭状态的布尔开关（`condition-XXX` 是否为 1）作为调度器列表的显示判定，将导致致命缺陷：一旦用户取消勾选关停状态，该状态便从调度器视口中彻底蒸发，用户再也无法从调度器中重新勾选激活或编辑轮数。

为了使 Debuff 享受与原生正面 Buff（`repeating_buff2`）完全对等的生命周期体验，系统统一建立**显式白名单登记模型**：
> **核心不变量**：只要用户将 Debuff 加入进列表，只要没有主动点“✕”移除它，它就必须一直显示在工作台中。

### 2. 人物卡与 Token 双轨存储实现

#### (1) 人物卡存储：`tracked_debuffs` 原生属性
- **属性名**：`tracked_debuffs`（存储于 `character.attribs` 集合中）；
- **数据结构**：JSON 字符串化数组，例如 `["condition-Blinded", "condition-Shaken"]`；
- **加入生命周期**：
  - 用户从下拉选单选中 Debuff 时，调用 `Pf1eBuffManager.addTrackedDebuff(char, condKey)` 将其推入数组；
  - 默认状态设为 `0`（未激活），并设置预设轮数 `condition-XXX_rounds`；
- **展示生命周期**：
  - 工作台渲染读取 `Pf1eBuffUI.getAllDebuffsSync(char)`；
  - 只要 `tracked_debuffs` 包含该 key，即便当前开关为 `0`，依然以未激活态（`.is-inactive`、复选框未勾选）稳定呈现在“负面状态 Debuffs”列表中，随时等待用户勾选激活或就地编辑轮数；
- **销毁生命周期**：
  - 唯有当用户显式点击卡片右侧的“✕”按钮（`deleteDebuffPermanently`）时，调用 `removeTrackedDebuff(char, condKey)` 将其从 `tracked_debuffs` 中剔除，并物理销毁其轮数与元属性，从视口中彻底注销。

#### (2) 纯 Token 存储：自定义字段 `r20_suite_buffs`
- **存储介质**：Token Graphic 模型上的自定义字段 `r20_suite_buffs`（JSON：`{ buffs: [...], debuffs: [...] }`，经实验验证可随 Firebase 持久化并跨刷新存活）；
  - 早期方案占用 `gmnotes`，但该字段是用户可见可编辑的笔记空间，混入结构化数据会被用户编辑冲掉，已废弃；
- **数据契约**：条目结构与人物卡 `getAllBuffs` 输出保持同一字段语义（`rowId/name/enabled/rounds/initRounds/extraAttrs/linkHostId/linkSourceRowId/linkChildren`）；所有写入方负责按此结构落盘，读取端直读直返、不做迁移清洗；
- **状态维护**：
  - 加入时：`TokenBuffManager.addTrackedDebuff(token, { key, name, rounds: 10, enabled: false })`，默认未激活；
  - 关停/激活时：`TokenBuffManager.toggleDebuff(token, key, enable)` 仅修改对应条目的 `enabled` 字段，绝对不从列表中删除；
  - 彻底销毁时：`TokenBuffManager.removeTrackedDebuff(token, key)` 从数组中移除并保存回自定义字段。

## 十三、Buff 副本克隆与拓扑链接彻底解耦规范 (Buff Clone Link Stripping & Name Isolation)

### 1. 核心业务不变量 (Core Invariants)
> **“无论是谁，复制之后得独立成一个Buff，不包括任何链接，复制小弟不能有老大，复制老大不能有小弟。”**

面对复杂的主从影子链接（Master-Follower Link）网络：
1. **复制小弟不能有老大 (Follower Clones Have No Master)**：
   - 当受术者（小弟）名下的链接 Buff 被复制为副本时，副本条目必须彻底剥离 `link_host_id`、`link_source_row_id` 等一切向上寻亲的属性；
   - 副本绝对不能自动登记在上游施法者（老大）的 `link_children` 订阅列表中；
   - 杜绝因拓扑反查导致老大名下多出一个重复小弟，更杜绝老大下发全量同步时将副本名强行还原覆盖。
2. **复制老大不能有小弟 (Master Clones Have No Followers)**：
   - 当施法者（老大）名下的主 Buff 被复制为副本时，副本条目必须彻底剥离 `link_children` 等一切向下管辖的属性；
   - 副本绝对不能接管原老大的下游受术者；
   - 原小弟只属于原老大，与复制出的新老大没有任何拓扑关系。
3. **名称唯一隔离原则 (Name Isolation Principle)**：
   - 独立副本绝对不能与原受术者同名共用名字；
   - 复制时提取主体名，智能识别并递增 `(副本)`、`(副本 2)`、`(副本 3)` 保证局部唯一性；
   - 彻底杜绝重名导致的属性刷新覆盖与检索混淆。

### 2. 代码实现机理与净化管道
系统在模型层封装 `Pf1eBuffManager.sanitizeExtraAttrsForClone(extraAttrs)`，对任何进入克隆或普通副本管道的加值字典进行彻底洗洁：
```javascript
static sanitizeExtraAttrsForClone(extraAttrs) {
    if (!extraAttrs || typeof extraAttrs !== "object") return null;
    const clean = {};
    for (const [k, v] of Object.entries(extraAttrs)) {
        if (
            k === "rounds" ||
            k === "enable_toggle" ||
            k === "name" ||
            k === "init_rounds" ||
            k === "row_id" ||
            k.startsWith("link_") ||
            k === "linkHostId" ||
            k === "linkSourceRowId" ||
            k === "linkChildren" ||
            k === "link_host_id" ||
            k === "link_source_row_id" ||
            k === "link_children" ||
            k === "link_child_name" ||
            k === "link_upstream_name"
        ) {
            continue;
        }
        clean[k] = v;
    }
    return Object.keys(clean).length > 0 ? clean : null;
}
```
同时在应用到其他目标单位（`applyBuffToTarget`）时，严格分流：
- **普通副本 (`sourceHostId === null`)**：执行 `sanitizeExtraAttrsForClone`，生成 100% 独立的纯净新条目；
- **创建影子链接 (`sourceHostId !== null`)**：仅注入当前施法者的 `link_host_id` 与 `link_source_row_id`，同时强制删除 `link_children`，防止下游继承宿主的管辖权。


---

## 八、Roll20 官方人物卡 Sheet Worker 重算链路与无头沙箱引擎 (Headless Sheet Worker Sandbox)

### 1. 官方 Sheet Worker 的事件白名单门禁与传统写入失效机理
Roll20 官方人物卡系统（如 PF1e 社区卡 / 官方卡）底层在浏览器内部通过 Web Worker 或 iframe 运行人物卡专属的 Sheet Worker 脚本（约 516 KB 逻辑闭包）。其主重算逻辑（`ju()` / `PFSheet.recalculate()`）包含如下白名单事件门禁：

```javascript
// 反编译自官方卡 pathfinder_community.html
on("change:recalc1 change:migrate1", n().callback((function(e) {
    n().debug("caught " + e.sourceAttribute + " event: " + e.sourceType),
    "player" !== e.sourceType && "api" !== e.sourceType || ju()
})))
```

#### 传统外部属性写入失效的根因：
1. **`sourceType` 拦截**：外部用户脚本在 Roll20 顶层编辑页操作 Backbone 模型（`attr.save()` / `attribs.create()`），属性变更经由 Firebase 同步至卡片 iframe 时，Roll20 宿主分发的事件既非卡内 UI 交互的 `"player"`、亦非官方 Pro 订阅服务器沙箱的 `"api"`，导致官方 Worker **直接静默丢弃**；
2. **`recalc1` 奇偶翻转矛盾**：官方 `ju()` 内部以 `parseInt(r.recalc1, 10)` 判断是否置位全量重算标记 `l = true`，一旦外部将其翻转为 `"0"` 则必然空转；且官方计算完毕后会自动静默重置 `recalc1 = 0`；
3. **闭卡不执行**：当人物卡未在屏幕上打开时，其对应的 DOM 与 iframe 在页面中物理不存在，无法通过常规 DOM 模拟点击触发。

### 2. 无头重算单例沙箱与串行任务队列 (Headless Singleton Sandbox & Sequential Queue)
为实现“无论角色卡在屏幕上是否打开，任何 Buff 变动均能毫秒级触发官方原生加值重算”，系统构建了全局常驻单例服务 `RecalcService`（位于 `src/core/RecalcService.js`）：

```
[初始化阶段]
  1. 零本地冗余与零外部上传：战役加载后，直接就地在线引用 Roll20 官方下发的原生脚本 (Campaign.characters[0].characterSheet.workerScripts[0])；
  2. 在后台挂载隐藏的常驻单例沙箱 iframe (id="r20-suite-recalc-sandbox", display:none)；
  3. 为沙箱注入 Roll20 官方 7 大 SheetWorker 宿主桩与 Underscore 闭包：
     ├─ on(events, cb)               → 收集官方脚本注册的 2,187 项监听器 (如 change:recalc1)；
     ├─ getAttrs(names, cb)          → 动态桥接至当前上下文角色 currentContextChar.attribs 内存哈希读取；
     ├─ setAttrs(values, opts, cb)   → 动态批量写回当前上下文角色，捕获 recalc1: 0 判定计算完成；
     ├─ getSectionIDs(sec, cb)       → 动态提取当前上下文角色 repeating_xxx 的唯一 rowIds；
     ├─ getTranslationByKey(k)       → 国际化健壮性桩；
     ├─ getTranslationLanguage()     → 语言配置桩 ("en")；
     └─ generateRowID()              → Roll20 原生行 ID 生成算法；
  4. 采用 Blob URL 外部库引用技术 (<script src="blob:...">) 挂载官方脚本，彻底规避 eval，建立官方事件监听表。

[运行阶段：修改 Buff]
  Pf1eBuffManager 业务修改 (toggleBuff / toggleCondition / applyOrRefreshBuff / ...)
      ↓
  RecalcService.request(character, { reason })
      ↓ 角色维度 300ms 防抖合并 (Coalescing)
  RecalcService.enqueue(character, { reason })
      ↓ 进排队队列，若同角色已有排队项则自动合并
  RecalcService.processNext()
      ↓
  将沙箱 currentContextChar 指向目标角色，直接派发事件：
  fireEvent("change:recalc1", {
      sourceAttribute: "recalc1",
      sourceType: "player",      // 👈 注入合法身份，100% 穿透官方白名单门禁！
      previousValue: "0",
      newValue: "1"
  })
      ↓
  官方 ju() / PFSheet.recalculate() 在无头沙箱中完成运算（耗时仅 10~30ms）！
      ↓
  最新攻防、AC、豁免、属性修正通过 setAttrs 回写至 character.attribs，并写入 recalc1: 0。
      ↓
  捕获 recalc1: 0 信号，当前角色任务结案，currentContextChar 指针清空，自动调度队头下一个角色！
```

### 3. 角色维度防抖合并 (Coalescing) 机制
为杜绝用户在浮动面板批量勾选/修改多个 Buff 时引发并发重算雪崩，`RecalcService` 维护了一张角色维度的任务映射表：
* `pendingRequests = new Map<charId, timerId>`；
* 每次调用 `request(character)` 时，若该角色已有处于 300ms 窗口内的倒计时，则重置定时器；
* 连续开启 10 项 Buff 仅在 300ms 静止后执行 **1 次** 全量官方重算。

### 4. 离线幂等真值兜底 (Offline Fallback)
若无头沙箱处于未就绪状态（如战役刚加载、官方模板正在传输中），`RecalcService.flush` 自动触发幂等真值兜底：
* 直接向 `character.attribs` 写入 `recalc1 = "1"`（绝对不写入 "0"）；
* 官方人物卡自带 `on("sheet:opened", ju)` 监听器；
* 当该角色卡未来首次在屏幕上被打开时，官方卡打开入口自动读出 `recalc1 === "1"`，当场补算全量属性并自动归零复位，形成无缝双保险。

### 5. 无头重算中官方分支决策门禁与属性缺省陷阱 (Deep Worker Internals)

#### 陷阱一：官方 `ju()` 的 `parseInt(r.recalc1, 10)` 早期退出门禁
在官方 Worker 中，事件派发虽然传入了 `eventObj.newValue = "1"`，但 `ju()` 并不读取事件传参，而是立即调用 `getAttrs(["recalc1", "PFSheet_Version", ...], (r) => { ... })`：
```javascript
// 官方 ju() 内部关键分支判定
e ? l = !0 : (parseInt(r.recalc1, 10) && (l = !0));
...
c ? Hu(t) : s ? Bu(...) : l ? Uu(u = -1, t, !0) : t()
```
* **失效现象**：若 `character.attribs` 中的 `recalc1` 为 `"0"`，则 `parseInt(r.recalc1, 10)` 判定为 `false`（`l = false`），官方引擎会直接跳过 `Uu()`（全量重算），走最后的 `t()` 退出分支立即返回 `setAttrs({ recalc1: 0 })`，导致重算在 1ms 内虚假完成，任何 Buff 和衍生属性均未更新！
* **架构解法**：在沙箱 `getAttrs` 桩中，凡查询 `recalc1` 必须无条件返回 `"1"`，强制引导官方状态机进入 `l = true` -> `Uu(u=-1, t, !0)` 全量重算流水线。

#### 陷阱二：DOM 缺省下拉框在无头环境下的未初始化断流 (MANUAL_DROPDOWN_DEFAULTS)
官方人物卡前端存在诸如下拉框（`<select name="attr_melee_bab">` 默认选中 `bab`、`attr_melee-ability` 默认选中 `STR-mod`）：
* **失效现象**：若该角色从未在 Roll20 卡片编辑器中手动展开并点击过这些下拉框，Roll20 不会在 `character.attribs` 中创建对应的键值对；
* 在无头沙箱中，`getAttrs(["melee_bab"])` 返回空字符串 `""`；官方下拉联动函数 `un()` 因而把 `melee_bab-mod`、`melee-ability-mod` 算为 `""`（即 0），最终近战攻击公式 `BAB(0) + STR(0) + Buff(3) = 3`，造成基础攻击加值丢失；
* **架构解法**：
  1. 在 `RecalcService` 中固化官方 `MANUAL_DROPDOWN_DEFAULTS` 字典表（包含 `melee_bab: "bab"`, `melee-ability: "STR-mod"`, `HP-ability: "CON-mod"` 等 25 项官方缺省映射）；
  2. 在沙箱 `getAttrs` 桩中对空缺属性实施缺省值回退；
  3. 在 `processNext` 调度开始前，以幂等方式预先在 `character.attribs` 中补全缺失键，确保无论是无头重算还是聊天框原生宏求值，均能准确提取完整的 BAB 与属性加值。

---

## 七、Jumpgate 重复列表 (Repeating Sections) 渲染管线与 Row ID 命名校验规范

### 1. Jumpgate 重复项渲染流水线与 `_reporder`
在 Roll20 Jumpgate 生产环境运行时（`vtt.bundle.js`），角色卡中的 repeating section（如 `repeating_buff2`）通过以下流程解析与注入 DOM：
1. 遍历 `character.attribs`，按前缀 `repeating_<section>_` 收集所有属性，以属性名中的第三段（下划线分割后的 `[2]`）作为 `rowId` 汇总至对象 `ee`：
   ```javascript
   const he = `${le.get("name")}`.split("_")[2];
   ```
2. 调用 `repeatingKeyOrder(ee, section)` 结合 `_reporder_<section>` 确定行的渲染次序数组 `Y`；
3. 遍历 `Y`，对每个渲染出的 DOM 元素 `.repitem` 执行数据属性注入与坏行判定。

### 2. Jumpgate 坏行检测判定陷阱 (`repitembroken`)
Roll20 Jumpgate 在遍历行次序数组 `Y` 时，内置了如下判定规则：
```javascript
let J = 0;
_.each(Y, le => {
    const ge = V.find(".repitem").eq(J);
    ge.attr("data-reprowid", le),
    le.substring(0, 1) === "-" && le.toLowerCase() === le && ge.addClass("repitembroken"),
    J++
});
```
* **核心规则**：若行 ID 以短横线 `-` 开头（标准 Firebase Push ID 格式），且**完全等于其自身的小写形式（即全为纯小写，不包含任何大写字母）**，Roll20 判定该条目为被非法脚本破坏或降级的损坏数据，并立即为其 DOM 容器注入样式类 `.repitembroken`；
* **宿主 CSS 报错机制**：
  人物卡原生 CSS 规则规定：
  ```css
  .charsheet .repitem:not(.repitembroken) .error { display: none; }
  ```
  一旦节点被注入 `.repitembroken`，`:not(.repitembroken)` 伪类立即失效，其内部固化的红字错误即刻显形：
  `Error! You must delete this row before editing any items in this section.`。

### 3. Row ID 生成与维护的不变量准则
为杜绝触发 Roll20 坏行判定及解析割裂，所有在脚本层生成或维护的 Repeating Row ID 必须遵循以下工业级不变量：
1. **严禁包含下划线 `_`**：
   Roll20 底层依赖 `name.split("_")[2]` 提取 `rowId`。若 ID 自身包含下划线，将导致分割索引错位，破坏属性解析与回填。所有生成的 UUID 必须执行 `id.replace(/_/g, "a")` 清洗；
2. **严禁全小写化（保留天然大小写）**：
   原生 `window.generateUUID()` 生成的字符串首位为 `-`，其后由 Base64 字符编码，天然包含大写字母。严禁对 ID 执行 `.toLowerCase()`；
3. **首字符为 `-` 时必须具备大写字母防护**：
   若因回退算法或其他因素生成的 ID 首字符为 `-` 且恰好全为小写，必须强制将其首个字母字符转为大写（如 `id.substring(0, 1) + id.charAt(1).toUpperCase() + id.substring(2)`），确保 `le.toLowerCase() === le` 恒为 `false`；
4. **`_reporder` 与 `_row_id` 大小写一致性**：
   向 `_reporder_<section>` 写入及在 `${prefix}_row_id` 登记时，必须统一保持原始大小写字串；比较与去重操作则通过 `id.toLowerCase() === target.toLowerCase()` 保持大小写不敏感。

---

## 八、纯 Token 状态持久化与原生侧边栏抽屉规范

### 1. 纯 Token (野怪/图元) 专属 Debuff 持久化管道
对于无人物卡绑定的纯 Token 或多棋子怪物集群（Mook）：
- 数据持久化统一托管于 Token 自身的自定义字段 `r20_suite_buffs`（JSON：`{ buffs: [...], debuffs: [...] }`），条目结构与人物卡 `getAllBuffs` 输出保持同一字段语义；
- 在获取目标 Graphic 模型时，必须统一通过 `Roll20Bridge.getTokenGraphic(tokenId)`（或在 Jumpgate 画布中通过 `thegraphics.get(tokenId)`）检索，严禁虚构不存在的查找函数；
- 扣轮与倒先攻处理：在 `TokenBuffManager.decrementBuffs` 与 `incrementBuffsOnTurnRevert` 中，同时对正面 Buff 与已启用的 Debuff 数组进行轮数递减与到期关停（`rounds <= 0 -> enabled: false`）。

### 2. Roll20 侧边栏设置抽屉原生视觉对标
在 `#settings-accordion` 注入自定义面板时：
- 原生折叠箭头统一使用 `Font Awesome 5 Free` 伪元素：展开时 `content: "\f077"`（chevron-up），折叠时 `content: "\f078"`（chevron-down），字号 `16px`，粗细 `700`，颜色 `gray`，靠右浮动；
- 默认初始状态必须与官方全部 8 个原生栏目严格保持一致（默认折叠，带 `.collapsed` 类名与 `aria-expanded="false"`，高度 `0px`），交由 Bootstrap Collapse 插件驱动平滑过渡动画。

---

## 九、Jumpgate 图像资产渲染管道与 Character 原生资产方法 (WebGL Tabletop & Character Asset Pipeline)

### 1. 资产双轨架构与原始字段脆弱性
Roll20 将实体分为**棋子（Token Graphic）**与**角色卡（Character）**两套模型体系：
* **棋子图像**：在数据层表现为 `token.get("imgsrc")`，在画布上由 Jumpgate WebGL 渲染管线装载；
* **角色卡图像**：在数据层表现为 `char.get("avatar")`（立绘/头像）与 `char.get("defaulttoken")`（默认棋子 JSON Blob）。

#### 原始数据字段的裂图根因：
1. **历史 S3 直连存储桶拦截**：大量旧卡片字段中存储的是形如 `https://s3.amazonaws.com/files.d20.io/images/...` 的早期直连地址，直接赋给 DOM `<img>` 标签会触发 AWS S3 防盗链与跨域资源共享（CORS）拦截，导致图片加载失败；
2. **地图残留死棋子 404**：若在常驻角色显示时盲目在 `tabletop.tabletopObjects` 中检索棋子，由于地图上可能残留已被删除资产的历史废弃棋子，容易命中 404 死链接，导致头像彻底裂开。

### 2. 宿主第一性原理：双轨原生资产管道

#### 2.1 棋子端：直连 Jumpgate WebGL 原生渲染器
当实体为当前画布棋子时，直接从底层 WebGL 原生实体 Map 读取真实已解码就绪的纹理源：
```javascript
const tabletop = window.Campaign?.engine?.tabletop;
const ttObj = tabletop?.tabletopObjects?.get(token.id || token);
const rendererUrl = ttObj?.imageRenderer?.loadedUrl || ttObj?.imageRenderer?.url;
```
* **特性**：经官方 `AssetManager` 自动清洗与尺寸变体计算，直接复用已加载完毕的内存缓存，实现 0 网络开销。

#### 2.2 角色端：接入 Character 模型原生资产方法
Roll20 官方在 Backbone Character 原型链上原生封装了资产清洗管道（内部调用 `(0, _endpoint.pF)(...)` 过滤器），严禁直接读取未清洗的原始 `avatar` 字符串：
1. **`char.getAvatar()`**：官方原生立绘方法，自动将任何旧桶路径转换为官方 CDN（`https://files.d20.io/images/...`）下的有效立绘地址（实测有效率 100%）；
2. **`char.getTokenURL()`**：官方原生默认棋子图标方法，自动解析内部 `defaulttoken` Blob 并返回已清洗的 Token 图标地址。

### 3. 标准自适应提取流水线 (`getAvatarUrl`)
针对 UI 容器（如 Tab 标签、浮动卡片、影子链接徽章），统一遵循以下确定性流转逻辑：
```javascript
static getAvatarUrl(char, token) {
    // 1. 若显式传入棋子（如左侧动态选区），优先直取 WebGL 渲染器实际成功加载的真实地址
    if (token) {
        const tabletop = window.Campaign?.engine?.tabletop;
        const ttObj = tabletop?.tabletopObjects?.get(token.id || token);
        const rendererUrl = ttObj?.imageRenderer?.loadedUrl || ttObj?.imageRenderer?.url;
        if (rendererUrl) return rendererUrl;
    }

    // 2. 若为常驻固定角色（char 实体），优先调用官方原生立绘管道 char.getAvatar()
    if (char) {
        const avatar = typeof char.getAvatar === "function" ? char.getAvatar() : "";
        if (avatar) return avatar;

        // 若无立绘，回退至官方原生默认棋子图标 char.getTokenURL()
        const defaultTokenUrl = typeof char.getTokenURL === "function" ? char.getTokenURL() : "";
        if (defaultTokenUrl) return defaultTokenUrl;
    }

    // 3. 兜底回退：若当前地图完全无实体或方法不可用，回退至数据模型原始字段并清洗
    let raw = token?.get?.("imgsrc") || char?.get?.("avatar") || "";
    if (raw) {
        raw = raw.replace(/^https?:\/\/s3\.amazonaws\.com\/files\.d20\.io\//, "https://files.d20.io/");
        if (raw.startsWith("//")) raw = "https:" + raw;
    }
    return raw;
}
```

### 4. DOM 加载失败防御与首字徽章兜底
在 `getAvatarHtml` 及所有图像渲染节点中，增加 `onerror` 容错监听，与 `.r20-tab-avatar-fallback` 徽章平滑联动：
```javascript
<div class="r20-tab-avatar-box">
    ${avatarUrl ? `<img class="r20-tab-avatar" src="${escapeHtml(avatarUrl)}" alt="" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />` : ""}
    <div class="r20-tab-avatar-fallback" style="${avatarUrl ? 'display:none;' : 'display:flex;'}">${escapeHtml(initial)}</div>
</div>
```
即使遇到极端网络抖动或冷门无效资产，也能自动降级显示高辨识度的人物首字优雅徽章，彻底绝缘浏览器原生破损裂开图标。
