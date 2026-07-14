> **status: finalized** — 设计已定稿；实施跟踪见各阶段验收条件。

# 速度/朝向表示统一 — 设计文档 v1

> 背景：`docs/design-plans/velocity-representation-survey.md`（2026-07-13）普查了
> `npc.direction`、`npc.speed`、`npc.vy`、`mot.vel` 的全部消费者（34 处）。
> 本文在普查基础上提出三阶段统一方案，目标是消除 `mot.vel.vy` 死代码并收紧标量路径的语义。

---

## 1. 问题陈述

| 字段 | 语义 | 问题 |
|------|------|------|
| `mot.vel.vx` | goal-directed X 速度（px/s） | 正常，被 integratePhysics 消费 |
| `mot.vel.vy` | goal-directed Y 速度（px/s） | **死代码**：`mot.vel=null`（line 288）后 `if(!mot.vel)`（line 303）恒真，实际 vy 通道走 `npc.vy` |
| `npc.speed` | 标量速度（`hypot(vx,vy)`） | 标量路径（无 walkMode / steer 跳过时）用此值，含膨胀问题（见 movement-dataflow.md §4-a） |
| `npc.direction` | ±1 符号 | 渲染（7处）+ 物理（5处）+ 审计（2处）+ 门控（2处），耦合度高 |

运行验证工具以 roadmap 盘点结果为准。

---

## 2. 三阶段方案

### V-1 审计与文档化（已完成）

**范围**：只读代码，零逻辑改动。

交付物：
- `docs/design-plans/velocity-representation-survey.md`：全库消费者普查（34处），含死代码标记
- `docs/contracts/movement-dataflow.md`：帧序 13 步、变量清单、`mot.vel.vy` 死代码证明、3 个冲突区

验收：文档中每处断言可通过 `grep -n` 在对应文件行号处找到实现代码。

---

### V-2 死代码清理（待实施）

**范围**：`js/behavior/Motor.js` 的 `integratePhysics` 函数内部，仅删除一行死代码。

目标：删除 `Motor.js` line 287 的 `dy = mot.vel.vy * dt`（该行结果无论如何都被 line 303 覆盖）。

**改动边界**：
- 只删一行，不改周围逻辑
- `mot.vel` 对象的 `vy` 字段可保留（steerRoam 继续写入，删除写入需 V-3）
- 不改任何 `steerRoam` 逻辑

验收（静态）：
- `Motor.js` 中 `mot.vel.vy` 不再出现在 `dy =` 赋值右侧
- `grep -n "mot\.vel\.vy" js/behavior/Motor.js` 仅应出现在写入侧（steerRoam 的 `mot.vel = {vx, vy}`）

验收（运行，需用户授权）：
- `node scripts/headless-sim.mjs --minutes 5 --seed 42` 全部断言通过

---

### V-3 标量路径膨胀修复（待设计）

**范围**：`Motor.js` 标量 fallback 路径（integratePhysics line 289–295）和 `steerRoam` 写入侧。

背景问题（movement-dataflow.md §4-a）：`steer 跳过` 时 integratePhysics 走标量路径
`dx = npc.direction × npc.speed × dt`，其中 `npc.speed = hypot(vx, vy)` 是向量长度，
导致纯水平运动速度被 vy 分量膨胀。

**候选方案**（设计阶段选一）：
- A：标量路径改用 `npc.vx`（新增字段，steerRoam 写入 `npc.vx = vx`）
- B：标量路径用 `npc.speed × Math.cos(Math.atan2(npc.vy, npc.speed))`（近似，无新字段）
- C：steerRoam 分开写 `npc.speedX = Math.abs(vx)`，标量路径用 `speedX`

**前置条件**：V-2 完成；check-invariants.sh 加 gate 覆盖新字段写者。

验收：`audit.dir_mismatch` 和 `audit.speed0_walk` 在 headless-sim 中不增加；
`SIDEWALK_FAR_Y` 跑步者不出现横向速度膨胀（可通过 StuckProbe 快照 `spd` 字段核实）。

---

## D6 · 依赖与门控

| 门 | 检查脚本 | 规则 |
|----|----------|------|
| D6-S1 | `check-invariants.sh` | `mot.vel.vy` 不出现在 `dy =` 赋值右侧（V-2 后加入） |
| D6-S2 | `check-invariants.sh` | V-3 新增字段写者白名单（设计阶段确定后补充） |

---

## 铁律

- **零逻辑改动原则（V-1）**：普查阶段绝对不改任何 `.js` 逻辑，只读代码写文档
- **CyclistSpawner 不动**：cyclist NPC 的 `.direction`/`.speed` 走 VehicleEntity 独立路径，不在统一范围内
- **`_slideMove` 不动**：碰撞积分函数签名与内部逻辑不属于速度表示层
- **sth/ 工具链不受影响**：survey §6 已确认 anim-preview / stick-puppet 不访问 live NPC 字段
