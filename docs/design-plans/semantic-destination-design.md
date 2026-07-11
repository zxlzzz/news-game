> **status: draft** — v2 设计草案，尚未实施。

# 语义目的地层 — 设计稿 v2（affordance 池）

> 目标：消灭"裸坐标目的地"。目的地永远是"某实体/区域的某个用法"。
> v2 核心变更：kind 硬编码 switch → **实体声明 affordance，池子做聚合投影**
> （与 getTags() 同模式；与 photo2entity"交互只做声明"直接对接）。
> 范围外（留钩子）：中途吸引、需求生长、persona 加权。

---

## 1. 声明端 — affordance 是纯数据

### 描述符

```js
{
  kind:         'tree_shade',      // 语义名，仅用于日志/tags/调试，系统不 switch 它
  dx: [12,20], dy: [2,6],          // 锚点派生：相对实体的偏移采样（或 ring:[r0,r1] 环形）
  arrivalState: 'loiter',          // 到达后 setState 的状态
  dur:          [8,20],            // 停留时长区间（秒）
  weight:       0.30,              // 抽取权重
  slots:        2,                 // 容量（同时几人）
  facing:       'entity'|'away'|null,
  use:          'visit',           // 'visit'(默认) | 'bench' | 'smart_prop' —— task 路由
  weightMul:    (npc, env) => 1,   // 可选动态乘数钩子（persona 加权未来插座）
}
```

### 两个来源（均为数据，不碰系统代码）

1. **`AffordanceDefaults.js`**：按 propType 的默认声明表，一行一个。
   现有实体首批：tree(tree_shade)、fountain(fountain_edge)、bench(use:'bench')、
   vending/trash(use:'smart_prop')、stall(stall_browse)、chess-table(watch_chess)。
2. **scene.json 单实体 `affordances` 字段**：覆盖/追加。
3. **ambient 声明**：无实体的区域型 POI（grass_rest）由 SceneInitializer
   向池子塞同格式声明，anchor 为区域采样函数而非实体。

**加新东西的成本 = 表里一行 / 实体配置一个字段。消费端零改动。**
photo2entity 生成的实体带 affordances 字段即插即用。

### 首批声明清单

| 宿主 | kind | arrivalState | weight | slots | 备注 |
|---|---|---|---|---|---|
| tree | tree_shade | loiter | 0.30 | 2 | |
| fountain | fountain_edge | loiter | 0.30 | 3 | facing:entity |
| bench | rest | sit_bench | 0.55 | — | use:'bench'，占用走 seat 模块 |
| vending / trash | use_vending / use_trash | — | 0.50 / 0.45 | — | use:'smart_prop' |
| stall | stall_browse | stand | 0.35 | 现有slot | facing:entity |
| chess-table | watch_chess | chess_onlooker | 0.30 | 现有slot | 重接被删路由 |
| ambient(公园) | grass_rest | sit_ground | 0.10 | — | weightMul：长椅有空位 ×0.3 → 实效≈0.03 |

---

## 2. 消费端 — 池子与抽取

`drawAffordance(npc, radius=350)`（EnvironmentQuery 内）：

1. 收集半径内存活实体的声明实例 + ambient 声明；
2. 过滤：容量已满（`entity._affOcc[kind] >= slots`）、净空检查失败、同侧约束；
3. 剩余候选按 `weight × weightMul(npc, env)` 加权随机抽一个；
4. 返回 `{x, y, entity, aff}`（坐标此刻才从声明派生）。

调试：按键 console.table 当前 NPC 半径内池子（kind/weight/实效权重/被过滤原因），
缓解"权重散在声明里不好配平"的代价。

### 净空检查 `isClearSpot(x, y, R=16)`

1. 格净空：R 内所有 NavGrid 格 cost > 0（道具已烘焙 BLOCKED，天然覆盖）；
2. NPC 净空：R 内无非移动 NPC（state ∉ {walk,run,jog}）。

时机：**抽取时**过一次（失败换候选，池内连续 5 次失败返回 null）；
**到达时**复检一次（路上被占 → stand 1~2s → 重新 drawAffordance 换点，
重试 2 次仍失败 → task 'abort'，接 Agenda 现有 MAX_ABORTS 放弃逻辑）。

---

## 3. VisitTask — 泛用"到点做事"

`new VisitTask(poi, runnerOpts)`；状态机：
`seeking`（寻路）→ `arriving`（净空复检，占 `_affOcc`）→ `doing`（arrivalState + dur 计时）
→ done（释放 `_affOcc`）。复检失败 → seeking（重试++）。

`use:'bench'|'smart_prop'` 的声明不走 VisitTask，被抽中后实例化对应现有 task，
座位/slot 机制原样保留。池子只管"选中"，不管"怎么用"。

---

## 4. Agenda 模板 — v1 的 utility 表删除

### passerby（人行道默认，60% 纯过路）

- 生成时定：入口边 → 对侧语义出口（ExitRegistry）；
- 60%：零停留，穿越 + 离场；
- 40%：**途中停留不预抽**——行进中按间隔掷骰，命中则对当前半径
  `drawAffordance`，抽到什么停什么（路过谁旁边才可能停谁）；上限 2 次；
- 停留额度用尽/走完 → `_readyToExit` → ExitSceneTask（现有链路原样）。

### park_idler（公园默认）

- 出生滚 1~3 个"停留额度"，每次额度到期时现场 drawAffordance；
- 默认移动形态 = stroll_loop：modePathFollow 走 park_loop 最近路点起 rand(2,4) 段；
- 额度用尽 → 离场判定（或续借，按 lifespan）。

### stroll 处置

`sampleWalkableNear` 随机撒点退出 Agenda 目标来源（函数保留给兜底/探针）。

---

## 5. 触点 / 不动

改：新 `AffordanceDefaults.js`、新 `tasks/VisitTask.js`、
`EnvironmentQuery.js`（drawAffordance + isClearSpot）、`Agenda.js`（模板替换 utility 表）、
`SceneInitializer.js`（ambient 声明 + 生成侧出生上下文）、chess onlooker 路由重接。

不动：TaskRunner、Motor、_slideMove、NavGrid 烘焙、ExitRegistry、
seat/slot 系统内部、UseBenchTask/UseSmartPropTask 实现。

## 6. 已知代价与缓解

- 权重散在声明 → 调试键 console.table 池子快照；
- `_affOcc` 是新的运行时占用记账 → 只在 VisitTask 占/释，NPC 死亡剪枝时需释放
  （EntityManager 剪枝已有周期，VisitTask onAbort 释放即可覆盖）。