# News Game — 项目指南

2.5D 街道场景模拟器：PixiJS 5 原生（无打包器）+ ES modules，NPC 自主行为驱动。
运行：`start.bat`（Windows）或本地 HTTP 打开 `index.html`；无 TS，无测试框架。

---

## 坐标约定

**铁律**：`npc.y` / `entity.y` = 地面接触线（世界坐标）；关节空间 `y=0` = 地面，负值向上。

原因：StickRenderer 渲染公式 `screen_y = npc.y + joint[1] * scale`，接触点 y=0 才能精准落地。

```js
// screen_x = npc.x + joint[0] * scale * dir
// screen_y = npc.y + joint[1] * scale   ← joint y 为负=上方，0=地面线
```

cycle clip 的全帧全关节最大 abs_y 须 ≤ 0（即地面接触关节 ≈ 0）；
骑乘白名单 `MOUNTED_CLIPS = ['bike','mobike','mobile']` 例外（接触点经由车辆）。
ClipLibrary.resolve() 启动时断言，偏移 > ±5 发 `console.warn`，不阻断加载。
接触点偏差**修 clip JSON**，禁止在运行时用 `npc.y -= N` 补偿。

---

## 深度

**铁律**：`depthT(y)` 是唯一深度来源；所有派生量皆由它计算，禁止出现第二套深度公式。

```js
import { depthScale, depthGray, depthLineWidth } from '../core/Layout.js';
prop.scale = depthScale(prop.y);  // EntityManager 每帧对非静态实体自动调用
```

Y 分带（`js/core/Layout.js`）：

| 分带        | Y 范围   | 关键常量                            |
|-------------|----------|-------------------------------------|
| 天空        | 0–210    | `BUILDING_BASE_Y=210`               |
| 远人行道    | 210–248  | `SIDEWALK_FAR_Y=240`                |
| 远自行车道  | 248–268  | `BIKE_LANE_FAR_TOP=248`             |
| 机动车道    | 268–333  | `FAR_Y=268`，`NEAR_Y=333`           |
| 近自行车道  | 333–353  | `BIKE_LANE_NEAR_BOTTOM=353`         |
| 公园        | 353–520  | `PARK_TOP=353`                      |

NPC 漫游：远人行道（y≈240）和公园（y≈370–490）。机动车道禁止驻留（`isRoadZone` 守卫）。

---

## 动画命名

**铁律**：全库动画唯一标识 = manifest clip id（如 `stand`、`dog_walk`），无别名层。

原因：双注册表（ANIM_MAP + manifest）是历史负债，现已删除；clip id 即 StickRenderer key。

```js
// StreetScene.js — 以 clip id 直接注册，manifest 是唯一来源
for (const id of Object.keys(clipLibrary.manifest.clips)) {
  stickRenderer.loadAnimation(id, clipLibrary.resolve(id));
}
```

- `kind` 唯一权威在 `assets/manifest.json`；clip JSON 文件**不含** `kind` 字段
- NPC 默认动画：`'stand'`（不是 `'idle'`）；狗：`'dog_walk'`（不是 `'dogwalk'`）
- keyframe 只存 delta（相对 `skeleton.json defaultPose`）；省略关节 = 零 delta
- variant clip：ClipLibrary 取 **base** 的 keyframes × amp，variant 自身 keyframes 字段无效
- **defaultPose 历史注记**（2026-07-18 验证）：defaultPose 与 `joints.len` 比值全为 1.000，总高恰 144 单位，现为一致基准。
  历史：human defaultPose 坐标曾因透视感调整整体放大约 1.26×（约 2026-06 批次），clip keyframe 静默补偿；该补偿已不存在，clip 与 skeleton 现已对齐。
  铁律：JS 不得硬编码关节坐标；任何工具不得直接产出关节坐标，唯一路径是角度空间 → fk_bake → ClipLibrary 断言 + preview 目检。
- **`MOUNTED_CLIPS` 白名单**：`['bike','mobike','mobile']` 是唯一允许地面接触关节 abs_y > 0 的 clip 组（骑乘时接触点经由车辆对象），ClipLibrary 断言对此白名单豁免；新增骑乘 clip 须手动加入此列表

---

## 锚点 API

**铁律**：`npc.getAnchor(name)` 是唯一合法接口；骨架内部关节名（`body`、`r_hand`…）禁止在外部直接引用。

原因：getAnchor 统一处理 overlay 重锚、direction 翻转、scale；绕过会导致镜像/偏移 bug。

```js
const hand = npc.getAnchor('hand_r');  // ✓ 返回世界坐标 {x, y}
const hip  = npc.getAnchor('hip');     // ✓ 内部映射 'body' 关节
// anim.frames[0]['r_hand']            // ✗ 禁止：绕过 direction/scale/overlay
```

公开锚点名：`head`、`neck`、`hand_l`、`hand_r`、`hip`、`foot_l`、`foot_r`。
狗：`neck`、`head`、`hip`（映射 `body_back`）。

---

## 绘制铁律

1. 每个 `draw*()` 函数**入口第一行**调 `g.lineStyle(0)`（清除前一次残留线条）
2. 只用灰阶调色板；禁止三面光或伪 3D 阴影

```js
import { FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
         ENV_LINE_LIGHT, ENV_LINE_DARK, depthLineWidth } from '../core/Layout.js';
// FILL_PAPER=0xd8d8d8  FILL_LIGHT=0xc4c4c4  FILL_MID=0xaaaaaa  FILL_SHADE=0x888888
```

3. `g.drawEllipse(cx, cy, rx, ry)` 参数是**半轴**（非直径）
4. 线宽/线色用 `lenv(g, baseY)` 辅助（参见 `entity/seat/drawBench.js`）

---

## Entity 模式

**铁律**：`entity/<name>/draw<Name>.js`（纯绘制，无状态）+ `<name>.js`（行为 + `INTRINSIC` + `footprint()` + spawner）。

原因：绘制与行为分离，`PropEntity.draw()` 统一分发，不需要子类多态。

```js
// entity/seat/seat.js
export const INTRINSIC = { width: 300, height: 80, seatH: 40, legH: 23 };
export function footprint(e) { ... }       // 碰撞半轴
export function sitDown(npc, bench) { ... } // 行为副作用
// entity/seat/drawBench.js
export function drawBench(g, p) { g.lineStyle(0); ... } // 纯绘制
```

新增道具：坐标写进 `assets/scene.json` 的 `props` 数组，禁止硬编码坐标到 JS。

---

## 数据纪律

**铁律**：关节坐标只来自 `assets/animations/*.json`；JS 文件禁止硬编码任何关节坐标。

原因：硬编码坐标在 clip 调整后立即失效，且无法被 ClipLibrary 断言发现。

```js
// ✓ 坐标从 clip 数据读取
const frame = clipLibrary.resolve('chess').frames[0];
const footY = frame['l_foot'][1];  // abs_y（展开后）
// ✗ const SIT_BODY_Y = -42;       // 禁止硬编码关节坐标
```

overlay 运行时按帧对链根（`neck`/`body`）重锚后叠加关节 delta；
keyframe 中省略的关节 = 零 delta；修改 clip 地面接触后须物化所有关节（避免撕裂）。

---

## 出口语义

**铁律**：NPC 离场走 `ExitRegistry.findExit(npc)`，禁止硬编码消失坐标或 teleport。

原因：出口与场景布局绑定；硬编码坐标在场景更新时静默失效。

```js
import { findExit } from '../npc/ExitRegistry.js';
const exit = findExit(npc, 'edge');
if (exit) { npc.x = exit.x; npc.alive = false; }
```

---

## 行为系统

```
BehaviorManager
  ├── BaseStateMachine  — 状态机（setState / tickBaseState）
  ├── WalkMode          — wander / path_follow
  │     └── nav/PlanService  — A* 规划；publishGoal 是唯一目标入口
  ├── SocialLayer       — Talk / Chess / Stall 配对
  ├── ModifierLayer     — 叠加动作（phone / smoke / gesture）
  └── EnvironmentQuery  — 空间查询（只读）
```

关键约定：帧率归一 `Math.random() < p * dt * 60`；区域守卫 `isRoadZone(npc.y)`；
槽位释放 `releaseAllHoldings(npc, envQuery)`；`crossing / jaywalking` 标签由 NavGrid
格代价空间派生（`Npc.getTags()` 读格 cost，`PathPlanner.PLANNING_RULES` 中
`crosswalkCost / jaywalkRoadCost`）；不存在过街子程序。
骑手 profile：`{agenda:false, separate:false, initial:'ride'}`（N-3 集成）。

---

## 工作流

- CC 分支命名：`claude/<slug>` 前缀
- Windows MINGW64 环境：交付**完整文件内容**，不走 patch/diff 格式
- 调试：`js/behavior/DebugLog.js` + DebugOverlay
- **禁止运行**：默认禁止运行游戏 / harness / 模拟验证；静态验证（`check-invariants.mjs`、读代码、grep）不受限；运行验证仅在用户明确要求时执行
- **静态验证优先**：有疑问先 grep/读代码，确认后再改；不确定时列出不确定点交用户决策，不猜
- **验收标准先行**：每个子任务开始前在 CLAUDE.md 或 PR 描述中写清楚验收条件；没有验收标准的任务禁止提交
- **时序锚点**：涉及帧内执行顺序的描述须附 `StreetScene.js:行号` 锚点；帧序以 `movement-dataflow.md §1` 为权威，不另起炉灶
- **契约同步**：改 `js/` 逻辑时同步更新 `docs/contracts/`；改合约时须能用 grep 在代码中找到对应实现，找不到视为草案不得升 normative

---

## NpcState 槽位系统

**铁律**：NPC 临时状态必须经 `npc.mem(ns)` 读写，禁止直接在 `npc` 上挂 `_xxx` 字段。

```js
// 读写（惰性创建命名空间对象）
npc.mem('motor').walkMode = ...;
npc.mem('social').activity = act;

// 退出状态时清理命名空间
npc.clearMem('loiter');
```

**命名空间与 owner：**

| namespace  | owner / 写者            | 典型字段                                              |
|------------|-------------------------|-------------------------------------------------------|
| `motor`    | Motor.js / WalkMode.js  | walkMode、goal、path、vel、dirCD、savedBounds、needReplan、progressAcc、progressAnchor、wallSpot、tags（`_obsFlipVx / _obsVxSign` 只读观测，非状态位） |
| `loiter`   | LoiterBehavior.js       | dir、dur、elapsed、overlay、microPhase、microPhaseName、microTimer、tags |
| `social`   | Activity / SocialLayer / WaitForBusLayer | activity、bench、boardingBus、waitingBusStop、waitTimer、nextFidget、slotWaitProp、slotWaitTimer、chessSlot、onlookerTimer、onlookerDur、tags |
| `agenda`   | BehaviorManager / Director | profile、runner、agenda、lifespan、ageTimer、departing、pendingDeparture、preferExitType、exitRegistry、waitForBusLayer、busStops |
| `modifier` | ModifierLayer.js        | heldCooldown、gestureCooldown                        |

**规则：**
- 写者即 owner；跨 namespace 只读
- tags 字段：各 owner 写 `npc.mem(ns).tags`；`npc.getTags()` 聚合 `_mem[*].tags`
- `npc.modifiers.find(...)` 禁止在 ModifierLayer 外部使用；改用 `getHeldModifier(npc)`（从 ModifierLayer.js 导入）
- `_sortY`、`_motorInstalled`、`_motor` 不迁移（渲染接口 / 热路径守卫）
- 待迁出：`agenda.exitRegistry/waitForBusLayer/busStops` 是场景级服务引用，应上收到 behavior context；本次机械迁移保留，下次动状态机签名时收掉

---

## 文档索引

| 文件 | 类型 | 范围 |
|------|------|------|
| `docs/contracts/docs.md` | 规范性 | 文档分类策略：normative vs snapshot，写前判据，contracts/ 硬上限 |
| `docs/contracts/movement.md` | 规范性 | 移动子系统字段所有权、Motor 写保护门、NavGrid、WalkMode 协议 |
| `docs/contracts/behavior.md` | 规范性 | 行为层栈、STATE_DEFS、NPC Profile、状态转换表、Activity/WalkMode/Modifier/Separation |
| `docs/contracts/known-violations.md` | 规范性 | check-invariants 已知例外白名单 |
| `docs/design-plans/news-pipeline-mvp.md` | 设计稿（finalized） | 新闻管线 MVP：截图 T2、Provider T3、成稿流 T4 |
| `docs/design-plans/photo2entity-plan.md` | 设计稿（draft） | 现实照片 → AI 生成场景物体，占位草案 |
| `docs/design-plans/semantic-destination-design.md` | 设计稿（draft） | 语义目的地层 v2，affordance 池设计 |
| `docs/behavior-design.md` | 快照 | 行为系统目标架构蓝图（准确内容已迁入 contracts/behavior.md） |
| `docs/npc-states.md` | 快照 | 状态机规格历史文档（含已淘汰状态，如 bike/mobile） |
| `docs/npc-behavior-system-v0.md` | 快照 | 行为系统重构 V0 设计（已由 contracts/behavior.md 取代） |
| `docs/npcstate-migration.md` | 快照 | NPC `_` 字段迁移至 `npc.mem()` 的扫描记录（迁移已完成） |
| `docs/sorty-audit.md` | 快照 | `_sortY` 深度键审计报告，2026-07-11 |
| `docs/v3-audit.md` | 快照 | v3 视觉合规审计（draw*.js），2026-07-11 |
| `docs/contracts/movement-dataflow.md` | 规范性 | 帧内移动管线逐步执行顺序（13步）、变量清单、`mot.vel.vy` 死代码证明、三个冲突区 |
| `docs/design-plans/velocity-representation-survey.md` | 快照 | `npc.direction/speed/vy`、`mot.vel` 全库消费者普查（2026-07-13） |
| `docs/design-plans/velocity-unification-design-v1.md` | 设计稿（finalized） | 速度表示统一三阶段方案（V-1 ✅ / V-2 ✅ / V-3 待实施） |
| `docs/roadmap.md` | 快照 | 功能批次落地状态一览（规范性路线图跟踪） |
| `docs/design-plans/belief-layer-v0.md` | 设计稿（draft） | 信念层 v0 占位草案：符号化事件声明、LLM 证人污染防护、SIR 传播 |
