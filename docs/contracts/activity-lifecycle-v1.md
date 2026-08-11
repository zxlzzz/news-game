# Activity Lifecycle Contract (v1)

> **状态**：§8 落地顺序 1～6 全部完成（Patch E / F+G / G / H / D / A）：基类 `Activity`
> 现含 `admit`/`dismiss`/`requiredRoster`/`handoff`，Talk/Chess/Stall 的成员配置/退场已
> 收口到 admit/dismiss；Chess 换 `ClipPlayer`（Patch F）；`push`/`give_item`/`handshake`/
> `point_at` 从 TalkActivity 抽成独立 `ContactActivity`+`DuetStager`（Patch G）；UseProp
> 已内联进 `UseSmartPropTask`、chess 旁观者已移出成 `ChessOnlookerTask`，均不再是 Activity
> 成员；stall 卖家独自守摊已移出成 `StallSellerTask`，`StallActivity` 现在只在买家已经
> 到位时才 Create、roster 从一开始就是满的（Patch H，prop-as-host）。买家路由本身仍是
> 已知空缺（无人真的把买家送到槽位，见 `BehaviorManager.js` 头注释），不影响本文档
> 描述的契约正确性。**WaitBusActivity 已删除**（Patch C，见 tasks.md）：等车改走单人
> `WaitBusTask`，`WaitBusActivity` 不再是 Activity 系统成员，§7 表中原有的"单人违规"
> 行随之移除。全部落地后 `file#symbol` 锚点补齐，本行删除。
>
> 锚点用 `file#symbol`，**不写行号**（行号腐烂比符号名快）。

---

## 1. 目的与边界

Activity 是**多个 NPC（+道具）共同参与、需要跨 NPC 协调**的高层行为单元。一个 NPC `join`
进 Activity 后 `npc.mem('social').activity` 置位，`BehaviorManager` 的 `if sc.activity continue`
门跳过它的 BSM 与 modifiers，由 Activity **独占接管**其 state / 位置 / 关节；`release` 后归还 BSM。

**边界铁律（判据：这件事要不要第二个 NPC 才能运作？）**

- Activity = 严格 **≥2 NPC** 的协调。
- 单人顺序行为 → **ChainTask**（协作式：`pose` 用 `setState + stateDur=Infinity` 挂住，BSM 仍在，
  不接管）。单人**不该**是 Activity。
- 旁观者 / 目击者 / 反应者 = **单人 ChainTask + 一个前置条件**（如「桌上有活局」
  `table._occupiedBy` 非空——Activity.occupy()/destroy() 已经维护的占用标记，见
  `ChessOnlookerTask`），**永远不是 Activity 成员**。

---

## 2. 分类依据

phase 不按「发生了什么」列（那会把「播动画」这种*能力*和「散场」这种*时刻*混为一类）。按两轴切：

- **作用域**：对**整个 activity** 一次性，还是对**单个成员**？
- **时机**：**一次性**（诞生/死亡）、**持续**（每帧）、还是**事件触发**（某成员进/出那一刻）？

两轴交叉落出的每个格子 = 一种性质不同的控制权变更 = 一个 phase。据此，「动画」和「配对/相遇」
都不是 phase（见 §6）。

---

## 3. 五个 phase

### ① Create — 建立（整体 · 一次性 · 诞生）

- **职责**：绑定初始 roster + 占用道具 + 分配 id。**不碰 NPC 姿势**（那是 Admit）。
- **单一住址**：基类 `Activity` 构造函数——负责 `join`（每个初始成员）+ `occupy`（每个道具）。
  子类构造函数只存引用、声明 `requiredRoster`，并对每个初始成员调用 Admit。
- **契约**：
  - 允许**部分 roster**（如 stall 只有卖家先建）；`participants.length < requiredRoster` 是合法态。
  - 禁止在此设 state / 播动画 / 设 tag——一律推给 Admit。
- **例**：`createActivity('chess', [player_a, player_b], [table])` 绑两名玩家和棋桌、占桌，到此为止。

### ② Admit — 成员入场配置（单成员 · 事件触发 · 每次有人加入）

- **职责**：**每当一个 NPC 进入**，把它摆进一个合法、无冲突的起始配置——`setState`、清掉会打架的
  非 trait modifier、设朝向、设 `mem('social').tags`。
- **单一住址**：基类方法 `admit(npc, role)`，各 activity 实现。**初始成员和后来加入的成员走同一个
  Admit**——这正是它必须独立于 Create 的原因。
- **契约**：
  - Admit 是设成员初始态的**唯一**入口；构造函数不得旁路设成员姿势。
  - 只碰「这个成员」的状态，不碰活动整体逻辑。
- **例（必须用后期加入者说明）**：Stall 的买家是活动开始后才走来的，Admit 设 `stand`、`filter`
  非 trait modifier、tags = `['transaction','shopping']`、转脸朝卖家——与卖家初始入场同一契约。

### ③ Drive — 驱动（整体 · 持续 · 每帧）

- **职责**：每帧推进本 activity 的内部逻辑。**「播动画」是它调用的服务（§6），不是 Drive 本身。**
- **单一住址**：`update(dt)`。
- **契约**：
  - 只推内部状态 + 调用动画服务（ClipPlayer / DuetStager，§6）。
  - **禁止**在 Drive 里做成员初始配置（归 Admit）或成员/整体拆除（归 Dismiss / End）。
  - `participants.length < requiredRoster` 时 Drive 走**待机变体**（§5）。
- **例**：Chess 的回合制——当前玩家播棋招、`animDone` 冻结、等 3.5s、切手、对家冻在第 0 帧。
  （对比 WaitBus 的 Drive 只是 stand↔loiter 抖动计时——同 phase，繁简差很多，说明 Drive 是
  留给子类填的坑。**但注意 WaitBus 是单人，按 §1 根本不该是 Activity。**）

### ④ Dismiss — 单成员提前退场（单成员 · 事件触发 · 活动仍继续）

- **职责**：放走**一个**成员、交还 BSM（`release` + `setState('walk')` + 还原它占的槽位），
  **activity 本体继续活**。这与散场（整体死）是两回事。
- **单一住址**：基类方法 `dismiss(npc, reason)`——单个成员退场的**唯一**入口。
- **契约**：
  - 只处理「这一个成员」的退场与槽位还原；不得触碰其余成员或活动整体。
  - 还原后的槽位必须回到 Admit 期望的初始态（这样「补位」= Dismiss 后再 Admit，免费，§5）。
- **例（TalkActivity 无此 phase，两人同生共死，故换例）**：Chess 旁观者看 15–40s 后离场、两名
  棋手照下；或 Stall 买家交易完走人、卖家继续叫卖等下一个。

### ⑤ End — 散场（整体 · 一次性 · 死亡）

- **职责**：整个 activity 结束——把**所有剩余**成员交还 BSM、释放所有道具、清 tag / 槽位。
- **单一住址**：基类 `destroy()`。
- **契约**：
  - **三个入口汇到同一套收场动作**：自然结束（`update` → false）、外部 `interrupt`、参与者死亡。
  - 「成员在活动中途死亡」是 End 必须覆盖的入口——不得靠外层（如 SocialLayer）打补丁回收。
- **例**：Stall 的 `destroy` 清买卖双方 ClipPlayer、买家设 `walk`、清卖家 tags、`prop._stallActivity=null`。

---

## 4. 生命周期不变量

- 任一时刻，一个 NPC 至多属于一个 Activity（`mem('social').activity` 单值）。
- 成员进出只经 Admit / Dismiss / End 三个方法，别处不得直接改 `participants` 或
  `mem('social').activity`。
- 每个占用的道具由唯一 activity 持有（`prop._occupiedBy = this.id`），End 必须解占。
- 收场后每个成员的 state 必回落到 BSM 可接管的态（默认 `walk`）。

---

## 5. 部分 roster / 待机 / 补位

- **requiredRoster**：activity 声明所需成员数/角色。`participants < requiredRoster` 是合法态。
- **待机**：roster 未满时 Drive 走待机变体（可简单到「都站着」）。
- **补位**：一个成员 Dismiss 后，同一槽位可再 Admit 填入——**免费**，因为 Dismiss 已把槽位还原成
  Admit 期望的初始态（同一槽位的逆操作）。
- **设备当房主（prop-as-host，✅ Patch H 已落地）**：stall 卖家独自守摊已改由 `StallSellerTask`
  （ChainTask）负责——`StallActivity` 只在买家已经到位时才 `Create`，roster 从一开始就是满的，
  不再是「部分 roster 的 Activity 跑降级 Drive」。买家离场即整场 Activity `End`，卖家由
  `destroy()` 重新交回一个 `StallSellerTask`，对称于 Create 侧的"满员才建"。`SocialLayer` 的
  `slotWait*` 等待机器与 `onSlotArrival` 默认凑齐分支已删除——经核实两者在落地前就已是死代码
  （chess 玩家永远走 `spawnChess` 直接 Create 满员两人，从不经槽位；chess 旁观者走
  `ChessOnlookerTask` 直接消费 onlooker 槽，不经 `onSlotArrival`；stall 买家路由至今未接线），
  故删除不影响任何已观测行为。`onSlotArrival` 机制本身保留（`SocialLayer.onSlotArrival` +
  各 activity 的注册项 `onSlotArrival` 钩子），作为"买家路由建成那天"的正确落点。
  **talk 类主动配对不受影响。**

  **更新（tasks.md P-4，买家路由建成）**：上一段"stall 买家路由至今未接线"已成历史——
  `StallBuyerTask`（`js/behavior/tasks/StallBuyerTask.js`）经 `BehaviorScripts.js#stall_buyer`
  → `ChainTask` 的 `use` 原语接入，走到 buyer 槽位后调 `SocialLayer.onSlotArrival()`，
  正是当年保留这套机制时设想的落点，无需改动 `SocialLayer`/`StallActivity` 任何一行。

---

## 6. 两个不是 phase 的东西

- **动画**：是 Admit（摆初始姿势）和 Drive（每帧播）调用的**服务**，不占独立时刻。约定：
  收敛到 **`ClipPlayer`**（干净的单人「帧 → held modifier」）。Chess 的 `playOnce`/`animDone`
  裸标志已换 `ClipPlayer`（Patch F）。**双人接触** = `DuetStager`（`js/behavior/DuetStager.js`，
  reach→play→release + designGap 站位 + `ejectRole` 声明式后效；不是字面上的"两个 ClipPlayer"，
  是同一套关节写入手法但一个类里管两个角色，因为 reach/release 阶段的位置插值是跨两人的相对
  关系，拆成两个独立 ClipPlayer 反而没法共享 t）；编排不塞进 ClipPlayer；`ContactActivity`
  持一个 `DuetStager` 实例驱动，自己管 join/dismiss/emit（Patch G，已落地）。
- **配对 / 相遇**：发生在 Create **之前**、跨 NPC，不属于任何单个 activity 的内部流程，单列在五
  phase 之外。见 `duet-interaction-design-v1.md` D6：泛化的配对表 → 给两人发接近 Goal（复用四层
  goal 管线，`profile.separate` 回归防撞旁人本职）→ 都到 gap 且相向 → Create。**Patch G 简化
  落地**：没有做独立的 goto 相遇阶段，`TalkActivity` 掷骰命中后直接检查起始间距是否在
  `designGap` 的 `REACH_SLACK` 倍以内，够近才 `handoff('contact',...)`，够近之后由 `DuetStager`
  的 reach 阶段插值补齐剩余间距——D6 描述的真正相遇层仍是待办，见 `duet-interaction-design-v1.md`
  「M-1 后附记」。

---

## 7. 现有 activity 一致性差距（Patch A/D/E/F/G/H 落地后）

| activity | Create | Admit | Drive | Dismiss | End | 违背边界？ |
|---|---|---|---|---|---|---|
| **TalkActivity** | 构造绑 2 speaker，走 `admit` | ✓ `admit` override（setState('talk')+清 modifier） | ✓ 说话手势轮播（ClipPlayer）+ 掷骰；子事件本体已抽给 ContactActivity | 无（两人同生共死，无单成员退场场景；push 早退已随 Patch G 移出成 ContactActivity 的 `_onEject`） | ✓ `destroy`（区分 handoff/正常两条收场路径，见文件内注释） | 否 |
| **ChessActivity** | ✓ 2 player+桌，走 `admit` | ✓ `admit` override（setState('chess')） | ✓ 回合制（ClipPlayer，Patch F） | 无（旁观者已移出成 `ChessOnlookerTask`，两名 player 同生共死，无单成员退场场景） | ✓ `destroy` | 否（旁观者违规已随 Patch D 消除） |
| **StallActivity**（Patch H 改版） | ✓ 买家已到位才建（seller+buyer 双人同时 `admit`，roster 从一开始就满） | ✓ `admit` override（按 role 分派 seller/buyer 姿势） | ✓ 卖家手势循环 + 买家分相（ClipPlayer） | 无（买家走 = 整场 End，不再有"买家走、卖家续"的单成员退场——原 `dismiss`/`addBuyer`/`_endBuyer` 已随 prop-as-host 删除） | ✓ `destroy`（卖家存活则重新交回 `StallSellerTask`，回到独自守摊态） | 否 |
| **ContactActivity**（Patch G 新增） | ✓ 2 参与者，role 名来自 clip 自身（如 `receiver`/`approacher`），走 `admit` | 不 override 基类（join-only）——DuetStager 的 reach 阶段要从"当前姿势"平滑过渡，Admit 若清 modifier/重设 state 反而破坏过渡 | ✓ 委托 `DuetStager.tick()`（reach→play→release） | ✓ 基类默认版足够——`ejectRole` 命中时自己的 `_onEject` 直接 release/setState/emit，不经通用 `dismiss()`（落地态因 clip 而异，如 `fall`，不是 `dismiss()` 硬编码的 `walk`） | ✓ `destroy`（`DuetStager.cancel()` 复位未弹出的一方） | 否 |

要点：UsePropActivity 已随 Patch A 内联进 `UseSmartPropTask` 删除，不再在此表列出。Chess 旁观者
已随 Patch D 移出成单人 `ChessOnlookerTask`；Stall 卖家独自守摊已随 Patch H 移出成单人
`StallSellerTask`，`StallActivity` 不再允许部分 roster；等车已随 Patch C 移出成单人
`WaitBusTask`，`WaitBusActivity` 整个删除，不再在此表列出（原表最后一行"是否重新界定为
NPC+公交车合法例外"的开放问题，最终选择是不界定——直接按单人 ChainTask 边界铁律处理）。
Talk/Chess/Stall/Contact 的 Admit 已收口到基类契约（Patch E/G/H）；四者的 Drive 均已用
`ClipPlayer`/`DuetStager` 统一动画（Patch F/G）。`push`/`give_item`/`handshake`/`point_at`
从 TalkActivity 抽成独立 `ContactActivity`，Talk 降为消费者（`handoff('contact', ...)`，
Patch G）。至此表中不再有违背单人边界的 Activity。

---

## 8. 落地顺序（后续 patch，不在本文档实现）

1. ✅ **五 phase 契约化**（Patch E）：基类 `Activity` 提供 `admit`/`dismiss`/`requiredRoster` +
   三入口汇聚的 End；Talk/Chess/Stall 迁到契约（未改行为，四门 patch 前后逐字节一致）。
2. ✅ **动画统一**（Patch F/G）：Chess 换 ClipPlayer（Patch F）；建 DuetStager，Talk 子事件
   逐帧手搓随 Patch G 一并抽走。
3. ✅ **ContactActivity 抽离**（Patch G）：把 reach/play/release + emit 从 TalkActivity 抽成独立
   ≥2 NPC Activity（`js/behavior/activities/ContactActivity.js`），Talk 降为消费者
   （`this.handoff('contact', participants, {clip:type})`，基类新增 `handoff()`，
   `SocialLayer.update()` 在 `destroy()` 之后统一消费创建后继）；push 统一为 clip 声明的
   `ejectRole` 后效。硬前置（C-1b 参照层画真接触姿势）已由用户完成，产出新版
   `handshake.json`（9 帧，`receiver`/`approacher`）替换原 1 帧占位；`push`/`give_item`/
   `point_at` 三个仍是占位，机制已通用但没有真实接触数据。相遇层用 `TalkActivity.js`
   的 `REACH_SLACK` 简化（见 §6「配对/相遇」），不是 D6 描述的独立 goto 相遇阶段。
4. ✅ **prop-as-host**（§5，Patch H）：stall 卖家独自守摊移出成 `StallSellerTask`
   （ChainTask），`StallActivity` 只在买家已到位时才 `Create`；删 `SocialLayer` 的
   `slotWait*` 与 `onSlotArrival` 默认凑齐分支（经核实两者落地前已是死代码，见 §5）。
   chess 本就永远由 `spawnChess` 直接 Create 满员两人，不受影响。
5. ✅ **旁观者移出成员制**（Patch D）：ChessActivity 删 `addOnlooker`/`onlooker` 数组，改单人
   `ChessOnlookerTask` + 前置条件（`table._occupiedBy`，即棋局是否存活）。
6. ✅ **单人移出**（Patch A + Patch C）：UseProp → 内联进 `UseSmartPropTask`（Patch A）；
   WaitBus → 内联进 `WaitBusTask`（Patch C）：不采纳「NPC+公交车」例外，改按单人边界铁律
   处理——等待纯粹是单人 stand/loiter，上车那一刻的"NPC+公交车"协调不需要 Activity 式的
   锁定/共享 tick，公交车到站直接 `runner.setPrimary(new GotoTask(...走向车门...), npc, cb)`
   顶替等待 task 即可，不需要为此单独立一类"非 NPC 协调方"的 Activity。

> 依赖关系：3 依赖 2（要先有 DuetStager）——已一起在 Patch G 落地；3 的接触调参依赖那一个手绘
> 接触姿势——已由用户在 C-1b 编辑器完成；4（prop-as-host）与 6 的 WaitBus 半段彼此独立，
> 均已推进完毕。