# Activity Lifecycle Contract (v1)

> **状态**：§8 落地顺序中 1（五 phase 契约化）/5（旁观者移出成员制）/6（单人移出）已完成
> （Patch E / D / A）：基类 `Activity` 现含 `admit`/`dismiss`/`requiredRoster`，Talk/Chess/Stall
> 的成员配置/退场已收口到这两个方法；UseProp 已内联进 `UseSmartPropTask`、chess 旁观者已
> 移出成 `ChessOnlookerTask`，均不再是 Activity 成员。2（动画统一）/3（ContactActivity 抽离）/
> 4（prop-as-host）尚未落地——下文 §7 一致性差距表已按当前状态更新。全部落地后
> `file#symbol` 锚点补齐，本行删除。
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
  `table._chessActivity` 存活），**永远不是 Activity 成员**。

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
- **设备当房主（prop-as-host，后续单独批次）**：chess / stall 这类道具锚定的活动，改由 prop 用类似
  `use` 的槽位机制凑人、**roster 满才 Create**；单占者的待机（卖家叫卖、独坐等对手）降级为**单人道具
  use（ChainTask）**，不再是「部分 roster 的 Activity 跑降级 Drive」。落地后可删掉 SocialLayer 的
  `slotWait*` 等待机器。**talk 类主动配对不受影响。**

---

## 6. 两个不是 phase 的东西

- **动画**：是 Admit（摆初始姿势）和 Drive（每帧播）调用的**服务**，不占独立时刻。约定：
  收敛到 **`ClipPlayer`**（干净的单人「帧 → held modifier」）。Chess 的 `playOnce`/`animDone`
  裸标志、Talk 的手搓逐帧（`_applyFrame`/`_tickSubEvent`）都是重复它，应替换。**双人接触** =
  两个 `ClipPlayer`（一角色一个）+ 一层薄 **DuetStager**（reach→play→release + designGap 站位 +
  emit）；编排不塞进 ClipPlayer。
- **配对 / 相遇**：发生在 Create **之前**、跨 NPC，不属于任何单个 activity 的内部流程，单列在五
  phase 之外。见 `duet-interaction-design-v1.md` D6：泛化的配对表 → 给两人发接近 Goal（复用四层
  goal 管线，`profile.separate` 回归防撞旁人本职）→ 都到 gap 且相向 → Create。

---

## 7. 现有 activity 一致性差距（Patch A/D/E 落地后）

| activity | Create | Admit | Drive | Dismiss | End | 违背边界？ |
|---|---|---|---|---|---|---|
| **TalkActivity** | 构造绑 2 speaker，走 `admit` | ✓ `admit` override（setState('talk')+清 modifier） | 手搓（应换 ClipPlayer/DuetStager，Talk 的说话手势轮播已换 ClipPlayer，子事件逐帧仍手搓） | △ push 分支临时 `release` 受害者=事实上的 Dismiss，但落地态是 `fall` 不是 `dismiss()` 硬编码的 `walk`，语义不同不能借道，留给 ContactActivity 抽离 | 依赖基类 + 子事件 release | 否 |
| **ChessActivity** | ✓ 2 player+桌，走 `admit` | ✓ `admit` override（setState('chess')） | 回合制（裸标志，应换 ClipPlayer，见 Patch F） | 无（旁观者已移出成 `ChessOnlookerTask`，两名 player 同生共死，无单成员退场场景） | ✓ `destroy` | 否（旁观者违规已随 Patch D 消除） |
| **StallActivity** | ✓ 卖家先建（部分 roster），走 `admit` | ✓ `admit` override（按 role 分派 seller/buyer 姿势） | ✓ 卖家手势循环 + 买家分相（ClipPlayer） | ✓ `dismiss` override（买家走、卖家续，原 `_endBuyer`） | ✓ `destroy` | 否（卖家待机应改单人 use，§5，未落地） |
| **WaitBusActivity** | 构造绑 1 NPC（绕过注册表） | — | stand↔loiter 抖动 | — | `destroy` | **是**（单人，应移出成 Task/BSM 态，Patch C 待定见下方注记） |

要点：UsePropActivity 已随 Patch A 内联进 `UseSmartPropTask` 删除，不再在此表列出。Chess 旁观者
已随 Patch D 移出成单人 `ChessOnlookerTask`。Talk/Chess/Stall 的 Admit/Dismiss 已收口到基类契约
（Patch E）；Talk 仍缺 Dismiss（push 分支的落地态语义与 `dismiss()` 冲突，待 ContactActivity 抽离时
一并处理）；三者的 Drive 仍各自手搓动画（ClipPlayer 化见 §8 item 2 / Patch F）。WaitBus 仍违背单人
边界，是否重新界定为「NPC+公交车」的合法 ≥2 方例外由用户决定（见 tasks.md Patch C）。

---

## 8. 落地顺序（后续 patch，不在本文档实现）

1. ✅ **五 phase 契约化**（Patch E）：基类 `Activity` 提供 `admit`/`dismiss`/`requiredRoster` +
   三入口汇聚的 End；Talk/Chess/Stall 迁到契约（未改行为，四门 patch 前后逐字节一致）。
2. **动画统一**：Chess 换 ClipPlayer（Patch F）；Talk 子事件逐帧手搓仍不动；建 DuetStager（§6）。
3. **ContactActivity 抽离**：把 reach/play/release + emit 从 TalkActivity 抽成独立 ≥2 NPC Activity，
   Talk 降为消费者（`createActivity('contact')`）；push 统一为 clip 声明的 per-role 后效。
   **硬前置**：先用 C-1b 编辑器带参照层画一个真接触姿势，量出真 gap + 接触关节距离
   （现设计文档里的 ≤2px 是估的）。
4. **prop-as-host**（§5，chess / stall）：设备凑人满员才 Create，删 `slotWait*`。
5. ✅ **旁观者移出成员制**（Patch D）：ChessActivity 删 `addOnlooker`/`onlooker` 数组，改单人
   `ChessOnlookerTask` + 前置条件（`table._occupiedBy`，即棋局是否存活）。
6. ✅ **单人移出**（Patch A）：UseProp → 内联进 `UseSmartPropTask`；WaitBus → 未落地，待定
   （见 tasks.md Patch C 的边界讨论：上车是否算「NPC+公交车」的合法 ≥2 方例外）。

> 依赖关系：3 依赖 2（要先有 DuetStager）；3 的接触调参依赖那一个手绘接触姿势；其余可较独立推进。