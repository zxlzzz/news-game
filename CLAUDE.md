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

**参数化**（Z-2a）：上表数值、世界尺寸、深度锚点不再是硬编码常量，而是 `export let`，
由 `initLayout(sceneData)` 从 `scene.json` 的 `world` / `yBands` / `depth` 注入
（`StreetScene.create()` 内，`SceneRenderer` 之前）；Layout.js 里的字面量只是 fallback。
`yBands` 的键名必须与 Layout export 名一致。消费侧照常 `import { NEAR_Y }`——live binding。

**scene.json 布局配置**（数值唯一真相在 `yBands`，其余段落只写**名字**引用它）：

| 段 | 消费者 | 内容 |
|----|--------|------|
| `world` / `depth` / `yBands` | `Layout.initLayout` | 世界尺寸、深度锚点、12 个 Y 分带数值 |
| `zones`（Z-2b） | `NavGrid.bake` | bands / overlays / paving / crossings → zone 烘焙 |
| `ground`（Z-2c） | `SceneRenderer` | bands / edgeLines / tiling / grass → 地面色带 |
| `exits` / `spawnPoints`（Z-2e） | `SceneInitializer._spawnNPCs` | 出口/生成点几何：`side`(left/right)+`margin` 解出 X，`yBand`+`yOffset` 解出 Y |
| `features`（Z-2e） | `SceneInitializer` → `featureRegistry` | 可选场景内容数组，见下方「Feature registry」 |

符号解析：Y 边界写分带名经 `resolveY()`，颜色写调色板名经 `resolveColor()`（`Layout.js`），
拼错立刻抛错。**配置缺失一律抛错，不退回硬编码 fallback。**
`zones` 与 `ground` 是**两套不同划分**：远人行道铺装色画到 `FAR_Y`（含远自行车道），
而那段导航上是 `ZONE.ROAD`——视觉按材质切，zone 按通行性切，不可互相套用。

**⚠️ 禁止在模块顶层从 Layout 值派生量**（写成函数，或延后到 init 之后计算）：注入晚于
所有模块顶层求值，顶层派生会冻结在 fallback 默认值上。现存两处待偿：`NavGrid.js`
`COLS/ROWS`、`VehicleSpawner.js` `LANES`
（详见 `docs/roadmap.md#Z-2a`）。`WaitForBusLayer.js` 原 `WAIT_ZONES` 曾是第三处，
已随公交站坐标收口（见下方）一并改为构造函数内按 `busStops` 现算，不再冻结。

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
- `context` 字段：作画期元数据，声明 clip 依赖的参照物（`held`: 手持道具 id，`prop`: 环境物件 propType）；只写引用名，不抄几何。运行时不消费 context。
- overlay `participants` 数组：每个参与者对象包含 `role`（角色名）和可选 `dx`（与 role 0 的水平站位偏移，默认 70px）；`skeleton` 仅在非 human 时出现。

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

**自注册**（Z-2d propRegistry）：`PropEntity.draw/drawGround/_computeFootprint/getBounds`
不再是 `switch(this.propType)`，而是每个 prop 模块顶层调
`registerProp(type, { draw, drawGround, footprint, obstacle, visual, bounds, config })`。
`PropEntity.js` 不逐个 import draw 文件，只 import `propRegistry.js` +
`entity/props.all.js`（副作用 barrel，触发所有注册）。

```js
// entity/trash/trash.js（尾部）
import { registerProp } from '../../core/propRegistry.js';
import { drawTrash } from './drawTrash.js';
registerProp('trash', { draw: drawTrash, footprint, obstacle: true });
```

新增 prop 类型：在自己模块顶层 `registerProp()`，并把该模块加进 `props.all.js` 的
import 列表——漏加则该类型静默不绘制（`check-invariants.mjs` Rule 13 静态挡这个）。
`obstacle: true` 但缺 `footprint` 会在注册时立即抛错（Rule 5 另外核对 shape/blocks 字段）。

`busstop-roof/bench/sign` 不进 barrel：`busstop.js` 本身 import `PropEntity`，
若也被 barrel import 会成环；这三种改在各自 `draw*.js` 里注册。

**Feature registry**（Z-2e）：目标是「一个 JSON 文件即可独立构建一个场景」（学校/街区/
商业街）。`SceneInitializer` 分两层：**infra**（NavGrid bake / BehaviorManager /
ExitRegistry / Director）是每个场景都必须有的引导代码，留在类方法里不进 registry；
**feature**（pedestrians / park_idlers / chess / stall_sellers / dog_walker /
athletes / vehicles / bus_stops / ambient_affordance）是可选场景内容，改为
`scene.json#features` 数组驱动，每条 `{type, ...cfg}` 经 `featureRegistry.getFeatureInit(type)`
查到初始化函数执行。

```json
{ "type": "pedestrians", "count": 18 }
```

注册写在 `js/scenes/sceneFeatures.js`（单一包装层，非 propRegistry 那种各模块自注册——
这 9 个 spawn 函数签名各异、散落在 npc/ 和 entity/vehicle/，塞进各自模块会强改 5+ 文件
且徒增循环依赖风险）：

```js
registerFeature('pedestrians', (ctx, cfg) => {
  spawnPedestrians(ctx.em, ctx.sr, ctx.bm, ctx.spawnPoints, cfg.count ?? 18);
});
```

`ctx`（SceneInitializer 构建，只读）：`{em, sr, bm, scene, layout, sceneData, propManager,
navGrid, spawnPoints, worldWidth}`。**features 数组顺序 = 初始化顺序 = `Math.random()`
消费顺序**——调换顺序会改变具体生成结果（位置/数量），即使各 feature 逻辑上互不依赖；
无跨 feature 依赖机制，`vehicles` 与其绑定的 `WaitForBusLayer` 因此捆成一个 feature。
未声明某 feature（如学校场景不要 `vehicles`）时下游必须防御——`Director` 的
`busStops: scene.trafficManager?.busStops ?? []` 是样例。

`vehicles` feature 内的 `initVehicleSystem(em, sr, bm, busStopsCfg)` 现直接读
`layout.busStops`（scene.json `layout.busStops`，即 `bus_stops` feature 渲染顶棚/长椅
用的同一份数据）构建 `BusStop`，`WaitForBusLayer` 的等候区（原 `WAIT_ZONES`）也在构造
函数内按同一批 `busStops.x` ± 半宽现算——公交站坐标不再有多份互相冲突的硬编码副本。
（历史注记：曾有 `vehicleSpawner.js` 硬编码 x=500/1500 与 `layout.busStops` 的
x=650/1500 不一致的已知 bug，已随此次收口一并修复。）

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
  ├── SocialLayer       — Talk / Chess / Stall 配对
  ├── ModifierLayer     — 叠加动作（phone / smoke / gesture）
  └── EnvironmentQuery  — 空间查询（只读）

nav/PlanService — Planning 层横切服务，不隶属上述任一子层。
消费者：BaseStateMachine、BehaviorManager、GotoTask / StrollTask / ExitSceneTask、
SceneInitializer、WaitForBusLayer。`publishGoal` 是唯一目标入口；`mot.path` 唯一写入方。

Perception.js — 感知裁决横切服务（视觉/听觉双通道，纯函数，不写 npc.mem）。
`perceive(witness, eventX, eventY) → {channel, q} | null`；视距/听距上限唯一住址
在本文件内（`SIGHT_MAX_DIST` / `SOUND_MAX_DIST`），硬截断，不得在别处复制。
消费者：`Belief.js`（W-5）。

WorldEventLog.js — 世界事件流水账（W-1）。`emitEvent({kind, actors, x, y})`
是唯一写入点，`kind` 须在 `js/behavior/data/EventDefs.js#EVENT_DEFS` 声明过，
未声明直接抛错；结构 `{id, kind, actors[], x, y, t}`（`t` 取自 `GameClock.
gameClock()`）。`emitEvent()` 调用点只允许出现在 `js/behavior/activities/`
下（check-invariants Rule 14）。目前唯一调用方是 `TalkActivity.js`（push /
push_land / give_item / handshake / point_at 五种 kind，取代旧版直接挂在
NPC 上的私有标签字段）。只记录不消费——本模块自己不接 Belief.js，两者仍是
独立地基，接哪个事件源触发目击生成是后续批次的接线工作。

Belief.js — npc.mem('belief').claims 唯一 owner（W-5/W-6）。`generateClaims(event,
actorNpcs, candidateNpcs)` 是"witness"来源 claim 的唯一写入点：对候选池逐个跑
`Perception.perceive()`，q≥0.20 才计入候选，按 `witness-memory-v1.md` §5 的
[2,4] 目标取样，再按 `ClaimDecisionTables.js` 的 q→填槽表决定每槽 fine/coarse/
tag/null。`selectWitnesses()` 单独导出，供
`scripts/check-witness-distribution.mjs` 静态采样验证数量分布，不依赖
NavGrid/EntityManager，可脱离游戏运行。消费者：暂无调用方接入
`generateClaims()`（W-5 地基阶段，WorldEventLog 尚未接到这里，无行为变化）。

`injectSuggestion(npc, slot, value)` 是"suggested"来源 claim 的唯一写入点
（W-6，与 `generateClaims()` 严格分开，provenance 不能混）：`NewsUI` 的审问
面板调 `providers.interrogate.ask()` 把玩家提问解析成 `{slot,value}`（LLM 只
翻译，不直接写 belief），再调本函数写入；同一 (slot,value) 重复注入只加
`strength` 不重复建 claim。`claimsToTestimony(npc)` 把 claims 转成人类可读
字符串数组，喂给 `providers.text.compose({testimony})`——`testimony` 不再
硬编码 `[]`。
```

关键约定：帧率归一 `Math.random() < p * dt * 60`；区域守卫 `isRoadZone(npc.y)`；
槽位释放 `releaseAllHoldings(npc, envQuery)`；`crossing / jaywalking` 标签由 NavGrid
zone 空间派生（`Npc.getTags()` 判 `grid.zone(gx,gy) === ZONE.ROAD`）；不存在过街子程序。
骑手 profile：`{agenda:false, separate:false, initial:'ride'}`（N-3 集成）。

**导航两层结构**（Z-1 zone-profile split）：NavGrid 只烘焙 **zone 语义 ID**
（`ZONE = {BLOCKED:0, SIDEWALK:1, GRASS:2, ROAD:3, CROSSWALK:4}`），不含任何代价数字；
有效代价经 zone→cost 表查得。`grid.zone(gx,gy)` 是唯一格访问器（无 `grid.cost()`）。
代价表装配唯一住址 = `PlanService._zoneCostsFor()`：
`DEFAULT_ZONE_COSTS`（NavGrid.js）→ `profile.zoneCosts` 覆盖 → jaywalk 覆盖（`ROAD → 3`）；
表值 `0` 即不可通行。`PathPlanner.plan()` 第 6 参收 `zoneCosts`，自身不持有代价政策。
铁律：NavGrid 不得出现代价数字，PathPlanner 不得自带代价政策——表一律由参数传入。
Z-2b 追加：NavGrid 亦不得出现 Y 分带数字——烘焙几何一律来自 `scene.json#zones`。
拉直另有 `ZONE_ROUGHNESS`（`PathPlanner.js`，铺装 1 / 草 2 / ROAD·BLOCKED 999）：
中间格 roughness 超两端 max 即拒绝拉直，保证铺装点之间不抄草坪；roughness 不参与 A*。

**affordance 池**：`EnvironmentQuery.drawAffordance(npc, radius)` 加权随机抽取目的地；
声明来源：`AffordanceDefaults.js`（propType 默认）、`entity.affordances`（scene.json 覆盖）、`registerAmbientAffordance`（区域型 POI）。
`_affOcc` 唯一写入点 = `occupyAffordance / releaseAffordance`（EnvironmentQuery.js）；park_idler NPC 用 `{agendaTemplate:'park_idler'}` profile 驱动 stroll→visit 循环。

**链条行为系统**（B-①②已落地）：
三概念分工：Task（ChainTask 单 NPC 顺序行为）/ Activity（SocialLayer 多 NPC 协调，不动）/ State（BSM 姿势转换，被上两层驱动）。
`ChainTask` 解释器六原语：goto / attach / detach / pose / use / loop。脚本纯数据在 `BehaviorScripts.js`。
`AttachmentDefs.js` 声明道具（anchor / heldPose / acquire / dispose），attach 走 ModifierLayer held 通道（不新建道具写入点）。
`interruptible` 控制社交劫持；处置由 `runner.hold` 统一兜底。
**passerby 模板**（B-②）：60% 直通（single stroll → exit）/ 40% 途中停留（`_stopCredits` 1-2 次）；desire 池改为 `BEHAVIOR_SCRIPTS` 键；`check-behavior-data.mjs` 静态校验 profile.desires 所有 id 存在于脚本表。
**B-③ passerby desires 集成**：`_tryDesire` 提取为独立方法（加权随机 + 30% 跳过）；`_pickPasserbyGoal` stroll 回调优先从 desires 池抽 ChainTask，fallback affordance draw；`_pickGoal` 复用 `_tryDesire`。
设计文档：`docs/design-plans/chain-task-design.md`。

---

## 工作流

- CC 分支命名：`claude/<slug>` 前缀
- Windows MINGW64 环境：交付**完整文件内容**，不走 patch/diff 格式
- 调试：`js/behavior/DebugLog.js` + DebugOverlay；键 'o' → `envQuery.debugPool(npcs[0])` 打印 affordance 候选池快照（kind/weight/eff_w/reason）
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
| `belief`   | Belief.js                | claims（目击 claim 数组，schema 见 witness-memory-v1.md） |

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
| `docs/design-plans/semantic-destination-design.md` | 设计稿（finalized） | 语义目的地层 v2，affordance 池设计 |
| `docs/design-plans/chain-task-design.md` | 设计稿（finalized） | 链条行为系统：ChainTask / AttachmentDefs / BehaviorScripts |
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
| `docs/design-plans/goal-pipeline-v1.md` | 规范性 | 四层目标管线立法；三铁律；ARRIVAL/RECOVERY/SAFETY/PLANNING 裁决表；N-1/N-2/N-3 刀序；四数验收表 |
| `docs/design-plans/belief-layer-v0.md` | 设计稿（draft） | 信念层 v0 占位草案：符号化事件声明、LLM 证人污染防护、SIR 传播 |
| `docs/design-plans/witness-memory-v1.md` | 设计稿（finalized） | 目击记忆 claim 五槽 schema；channel×槽可填表（sound.actor 硬 null）；q→填槽裁决表；mutation 转移表；2–4 目击者设计目标 |
| `Visual design spec.md` | 规范性 | 全场景视觉规范：纯 2D 平面黑白灰，draw*.js 合规基线 |
| `Visual spec cc.md` | 规范性 | 视觉规范实施参考（CC 用）：公共函数模板、draw 改造清单 |
| `docs/audits/behavior-redundancy-2026-07.md` | 快照 | 行为层冗余机制审计（2026-07），Cleanup-1 输入文件 |
| `docs/audits/velocity-unification-closing-2026-07.md` | 快照 | 速度统一收尾核账报告（2026-07-19） |
| `docs/baselines/2026-07-12-ddd9eb2f-s42-pre.md` | 快照 | check-invariants 基线快照 s42 前（2026-07-12） |
| `docs/baselines/2026-07-12-27a45503-s42-post.md` | 快照 | check-invariants 基线快照 s42 后（2026-07-12） |
| `docs/baselines/2026-07-13-e3c9ec1c-s42-pre.md` | 快照 | check-invariants 基线快照（2026-07-13） |
| `docs/design-plans/duet-interaction-design-v1.md` | 设计稿（finalized） | 双人互动设计 v1：overlay 参与者 dx 偏移、duet clip 格式、编辑器 newDuetClip() |
| `docs/design-plans/editor-reference-layer-v1.md` | 设计稿（finalized） | 编辑器参照层设计 v1：context 字段、held/prop 参照物可视化 |
| `sth/stick-puppet/README.md` | 快照 | StickPuppet 工具启动、操作与 clip 导出说明 |
| `assets/animations/new_assets/docx.md` | 快照 | new_assets/ 校对说明：接地规则、child 骨架说明、待处理 clip 清单 |