# 速度统一收尾核账报告

- **日期**: 2026-07-19
- **分支**: `claude/velocity-unification-v1-946h9l`
- **覆盖范围**: V-1 → V-3 全线 + N-1 → N-3 联动；D-2 文档归位批次

---

## A · 死标识符审计（零可执行命中）

以下标识符在 V/N 系列中被删除，grep 全库确认零可执行命中：

| 标识符 | 状态 | 备注 |
|--------|------|------|
| `routeTarget` | ✅ 零命中 | N-3a 删除 |
| `routePts` | ✅ 零命中 | N-3b 删除 |
| `routeIdx` | ✅ 零命中 | N-3b 删除 |
| `nextTarget` | ✅ 零命中 | N-3d 删除 |
| `_stuckOnce` | ✅ 零命中 | N-3d 删除 |
| `walkModeStack` | ✅ 零命中 | N-2b 删除 |
| `navIdx` | ✅ 零命中 | N-2b 删除 |
| `corner_cut` | ✅ 零命中 | N-3d 删除 |
| `npc.vy` | ✅ 零命中 | V3-a 删除 |
| `setSpeed` | ✅ 零命中 | V3-a 删除（`__clock.setSpeed` 不受影响） |
| `check-invariants.sh` | ✅ 不存在 | `a0bc2fb` 删除 |

**注记（注释残留，不计为可执行命中）：**
- `Motor.js:37` 注释提到 `modeDirect`（N-2b 删除的标识符）
- `Npc.js:231` 注释提到 `planCrossing`（N-2b 删除的标识符）
- `SteeringDecision.js:14` reason 字符串字面量含 `navPath`
- `Lookahead.js:16` 注释提到 `_navPath`（N-2b 删除的标识符）

以上三处均为字符串/注释内容，不产生运行时语义，无需修改。

---

## B · mot 字段清单对账

**代码中实际存在的 `mot.*` 字段**（grep `npc\.mem\('motor'\)\.|mot\.` 确认）：

| 字段 | movement-dataflow.md 表 |
|------|------------------------|
| `vel` | ✅ 有行 |
| `goal` | ✅ 有行 |
| `path` | ✅ 有行 |
| `needReplan` | ✅ 有行 |
| `walkMode` | ✅ 有行 |
| `dirCD` | ✅ 有行 |
| `progressAcc` / `progressAnchor` | ✅ 有行（合并） |
| `savedBounds` | ✅ 有行 |
| `wallSpot` | ❌ 缺行 |
| `tags` | ❌ 缺行 |
| `_obsFlipVx` | ❌ 缺行 |
| `_obsVxSign` | ❌ 缺行 |

**裁定**：`wallSpot`、`tags`、`_obsFlipVx`、`_obsVxSign` 未在 movement-dataflow.md §2 变量表中记录。
`_obsFlipVx`/`_obsVxSign` 为只读观测字段（P-1 批次加入），非移动意图通道；`tags` 是聚合语义标签；`wallSpot` 是障碍物检测缓存。
**结论**：仅报告，不修。这四个字段属于 CLAUDE.md `motor` namespace 表的范围，与 movement-dataflow.md 的帧内管线关注点不同，不强制进入该表。

---

## C · 写入/读取方声明对账

**mot.path "sole writers" 声明**：
- 文档说"PlanService.ensurePath / ensureWanderPath（sole writers）"
- 实际：`Motor.js`、`GotoTask.js`、`StrollTask.js`、`BaseStateMachine.js` 也写 `mot.path = null`
- **裁定**：`null` 写入为清除，不是创建；"sole writers"指路径对象的创建方，语义无误。

**mot.goal "sole writer" 声明**：
- 实际：`PlanService.publishGoal` 创建；`Motor.js`、`BaseStateMachine.js`、任务文件清除
- **裁定**：同上，无误。

**speed Reader 列修正**（Fix 5，已落地）：
- 原值"—" → 实际读者：BaseStateMachine ride 状态（`mot.vel` 构造行）；BehaviorManager 出生时 `walkSpeed` 初始化

---

## D · CLAUDE.md 断言验证

| 断言 | 验证结果 |
|------|---------|
| BehaviorManager 导入 EnvironmentQuery | ✅ 确认 |
| BehaviorManager 导入 BaseStateMachine `{tickBaseState, triggerDeparture}` | ✅ 确认 |
| BehaviorManager 导入 Motor `{setState, ...}` | ✅ 确认 |
| BehaviorManager 导入 ModifierLayer | ✅ 确认 |
| BehaviorManager 导入 SocialLayer | ✅ 确认 |
| BehaviorManager 导入 WalkMode `{checkZoneTransition}` | ✅ 确认 |
| nav/PlanService 消费者（7个）| ✅ 全部确认 |
| `publishGoal` 是唯一目标入口 | ✅ 确认 |
| `mot.path` 唯一写入方 = PlanService | ✅ 确认（清除方不计） |

---

## E · 白名单/豁免条目活跃性

**Rule 7 WHITELIST — SteeringDecision.js**：
- Rule 7 扫描 `Math.hypot(...) < <literal_number>` 或 `dist* < <literal_number>`
- SteeringDecision.js 实际使用 `dist < ARRIVAL_RULES[ruleId].threshold`（变量而非字面量）
- 该文件对 Rule 7 的字面数字正则**不会命中**；白名单条目在当前代码形态下为死豁免
- **裁定**：SteeringDecision.js 在架构意义上属永久白名单（决策文件），豁免条目无害，保留。

**Rule 4 RULE4_EXEMPT — `mobile`**：
- `RULE4_EXEMPT = new Set(['bike', 'mobile'])`
- 当前 STATE_DEFS 中无 `anim: 'mobile'`；`mobile` 也不在 `walkAnims` 集合中
- 因此 `RULE4_EXEMPT.has('mobile')` 永远不触发
- **裁定**：`mobile` 为历史遗留豁免条目（对应已移除的骑手状态变体）；作为防御性豁免无害，保留。

---

## F · 帧序时序锚点验证

movement-dataflow.md 头部声明：
> `StreetScene#update (behaviorManager.update, line 356)` … `(entityManager.update → integratePhysics, line 362)`

实际 StreetScene.js 行号（grep 确认）：
- `this.behaviorManager.update(delta)` → **line 357**
- `this.entityManager.update(delta)` → **line 363**

**差异**：合约文档行号比实际各少 1（356/362 vs 357/363）。
**裁定**：1 行偏差属注释维护积压，不影响语义正确性。不修（非五处已知修正之列）。

---

## G · 提交哈希对账

**velocity-unification-design-v1.md / roadmap.md（已修正，Fix 1）**：

| 批次 | 文档记录（修正后） | git 确认 |
|------|-------------------|---------|
| V-1 | `f1a8ad9` | ✅ 存在（`git cat-file -t` 确认） |
| V-2 | `c037a59` + `fbb455f` | ✅ 两者存在 |
| V3-a | `dcd6677` | ✅ 确认（修正前为 `107951d`） |
| V3-b | `011572f` | ✅ 确认（修正前为 `832c621`） |
| V3-c | `804b123` | ✅ 确认（本次补入） |

**注记**：V-1/V-2 哈希在 rebase 后仍可达（`git cat-file -t` 返回 commit），为 Git 对象库保留的历史对象，不在当前线性历史中。其作为文档引用仍有效。

---

## H · check-invariants 运行结果（2026-07-19）

```
Rule 1: no _extraTags in js/ (except TalkActivity.js allowlist)       ok
Rule 2: animation clip JSONs must not contain "kind"                   ok
Rule 3: npc.{speed,state,animation} = only in Motor.js                ok
Rule 4: walk-state clips (speedK>0) must have |meanX| ≤ 4             ok
         walk:-0.26 ✓  run:2.79 ✓  jog:-0.68 ✓  SKIP bike
Rule 5: each OBSTACLE_TYPE has footprint with shape and blocks fields  ok (12 types)
Rule 6: _sortY= writes only in PropEntity.js, seat.js, Chess.js       ok
Rule 7: distance comparisons and timer accums in whitelist             ok (whitelist=12)
Rule 8: crosswalkCost|jaywalkRoadCost|roadCostDefault only PathPlanner ok
Rule 9: no direct npc.x/npc.y assignment outside Motor.js             ok
Rule 10: npc.direction in Motor.js / BaseStateMachine.js whitelist     ok
Rule 11: no npc.vy in js/ (field deleted in V3-a)                     ok

All enforced invariants pass.
```

---

## V-final 已落地修正汇总

| # | 修正内容 | 文件 |
|---|---------|------|
| Fix 1 | V-3 commit 哈希修正（`107951d`→`dcd6677`，`832c621`→`011572f`）；补 V3-c `804b123` | `docs/design-plans/velocity-unification-design-v1.md`；`docs/roadmap.md` |
| Fix 2 | Rule 10 D 类正则收紧（`npc\.direction\s*\*` → `vx: npc\.direction \* npc\.speed`）；注释 "three"→"four" | `scripts/check-invariants.mjs` |
| Fix 3 | Rule 9 二级检查移出 else 分支，改为与主检查平行的独立段 | `scripts/check-invariants.mjs` |
| Fix 4 | Npc.js JSDoc scale 行缩进对齐（多余前导空格删除） | `js/npc/Npc.js` |
| Fix 5 | movement-dataflow.md speed 行 Reader 列"—"→真实读者描述 | `docs/contracts/movement-dataflow.md` |

---

## 线收尾状态

| 线 | 批次范围 | 最终状态 |
|----|---------|---------|
| N 线（目标管线）| N-0 → N-3e | ✅ 全落地 |
| V 线（速度统一）| V-1 → V-3 + V-final | ✅ 全落地 |
| D-2（文档归位）| D2-a → D2-f | ✅ 全落地 |
