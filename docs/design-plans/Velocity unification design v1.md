# 速度表示统一 — 根修设计稿 v1

- **date**: 2026-07-13
- **status**: draft（用户批准后 → finalized）
- **依据**: `docs/contracts/movement-dataflow.md`（帧内数据流）、
  `docs/design-plans/velocity-representation-survey.md`（全库消费者清单）

> 目标：删除 `direction × speed` 移动范式，`mot.vel` 成为托管 NPC 唯一物理输入。
> 验收哲学：`speed0_walk` / `dir_mismatch` / 水平漂移**按构造不可能发生**，而非被补丁压低。

---

## 0 · 现状（三条积分范式并存）

| 路径 | 谁在用 | 碰撞 | 病灶 |
|---|---|---|---|
| Motor vel 通道 | 托管 NPC，steer 正常帧 | `_slideMove` ✓ | `vel.vy` 死代码，vy 实走 `npc.vy` 复制通道 |
| Motor 标量回退 | 托管 NPC，steer 被跳帧 | `_slideMove` ✓ | `speed=hypot(vx,vy)` → 全速纯水平漂移 |
| Npc 内联 | 骑手（铁律区）、未来装饰实体 | **无** | 与托管范式共用字段名，字段语义被两套系统争抢 |

所有已观测移动 bug 均为范式 1/2 之间信息压缩与回退的投影。

---

## 1 · 决策

### D1 — `mot.vel` 唯一物理输入（托管 NPC）

- `steerRoam`（及一切移动意图源）每帧写 `mot.vel = {vx, vy}`；不想动就写 `{0,0}` 或不写。
- `integratePhysics` 重写为：`mot.vel` 存在 → `_slideMove(vel.vx*dt, vel.vy*dt)`；
  不存在 → **静止**。删除整个 `direction × speed` 回退分支。
  - 按构造消灭冲突区 a：steer 被跳帧 = 不动，而非水平漂移。
- `mot.vel` 帧末置 null 保留（消费即清），但语义变为"本帧无意图 = 静止"。
- Y 边界钳制从 `npc.vy` 迁到 `vel.vy`（或下沉进 `_slideMove`，实现时二选一，
  以改动最小者为准）；`walkMode` 下钳 0 的语义原样保留。

### D2 — `npc.direction` 降级为纯渲染朝向

- 唯一写入点：facing 逻辑一处（由 `vel.vx` 派生，保留 0.35 阈值 + 0.45s 迟滞）。
- 物理层永不读写：
  - 标量回退 dx（随 D1 删除）；
  - `integratePhysics` 边界翻转（随 D1 删除）；
  - 卡死监视器 `direction = -direction`（改为清 path/goal 令 steer 重规划，
    朝向由下一帧 vel 自然派生）。
- 渲染消费者不动：`Npc#draw`、`CigaretteProp`、`drawBicycle`、`seat#sitDown`。

### D3 — `npc.speed` 物理角色删除

- `integratePhysics` 不再读（随 D1 删除）。
- 保留为派生只读量或直接删除字段，取决于消费者迁移成本：
  - `StuckProbe` 入口门 → 改读 `hypot(vel)` 或 state ∈ MOVING；
  - `speed0_walk` / `dir_mismatch` 审计 → 语义失效，改为**断言恒零**，
    浸泡一个观察期后删除计数器；
  - `BehaviorManager.register` 的 `walkSpeed` 播种 → 生成期配置读取，改读生成参数，
    不依赖运行时 `npc.speed`。
- `setSpeed` API 与 Motor 写保护同步收缩。

### D4 — `npc.vy` 托管角色删除

- 托管路径的 Y 意图全部经 `vel.vy`；`steerRoam` 不再复制 `npc.vy = vy`。
- `checkZoneTransition` 的 `goingDown` 门 → 改读 `vel.vy`。
- `setState(vy=0)` 等残余写入随迁移清除。
- 字段本身保留给非托管内联路径（见 D5）。

### D5 — 内联路径显式隔离（非托管通道）

- `Npc.update` 内联分支保留原样，职责重新声明：
  **仅供不进 BehaviorManager 的装饰实体使用（当前：骑手）**。
- `direction / speed / vy` 在此通道内的语义归此通道私有，与托管范式无共享含义。
- 结构保证已存在（`_motorInstalled` 分流）；补文件头 CONTRACT 声明 + 铁律引用。
- 狗的 leash 分支不动。

### D6 — 新不变量（进 check-invariants.mjs，静态可查）

- **V1**: `js/behavior/`、`js/npc/`（内联分支白名单除外）中禁止出现
  `\.x\s*[+\-]?=` / `\.y\s*[+\-]?=` 对 NPC 的直接位置写入——
  托管位置只经 `_slideMove` / `setXY` / `nudgeXY`。
- **V2**: `Motor.js` / `BaseStateMachine.js` 中禁止读 `npc.direction` 参与位移计算
  （grep 白名单：facing 派生一处）。
- **V3**: `steerRoam` walk 分支禁止写 `npc.vy` / `setSpeed`（迁移完成后生效）。

---

## 2 · 迁移切片（3 个 CC batch，顺序执行）

| Batch | 内容 | 验收（静态） |
|---|---|---|
| **V-1** | integratePhysics 重写（D1）；steer 停写 `npc.vy`/`setSpeed`，只写 `mot.vel`；Y 钳制迁移 | 标量回退分支不存在于代码中；`grep 'direction \* .*speed'` 在 Motor 零命中 |
| **V-2** | 消费者迁移（D2/D3/D4）：StuckProbe、zone 门、卡死反转改重规划、审计改断言、facing 单点化 | survey 中 [物理积分] 标签下 `direction/speed/vy` 条目全部消失或改读 vel |
| **V-3** | 清理 + 不变量（D5/D6）：内联路径 CONTRACT、check-invariants 加 V1–V3、死字段/死 API 删除 | `check-invariants.mjs` 全绿；survey 重跑对账 |

每个 batch 交付后本对话静态审计；运行验证（harness 确定性冒烟三件套）
是否执行、何时执行由用户决定。

---

## 3 · 明确不动

- `CyclistSpawner` 及内联路径的移动逻辑（铁律）；
- `_slideMove` / NavGrid 烘焙 / A* / Lookahead 内部；
- leash 跟随；
- ExitRegistry / seat / slot 系统。

## 4 · 风险与回退

- 最大风险面：卡死反转从"翻 direction"改"清 path 重规划"，行为可能变化
  （原地小幅震荡 vs 大幅折返）。V-2 交付时此改动单独成 commit，可独立 revert。
- `npc.speed` 若有本 survey 未捕获的隐性消费者（如序列化/存档），
  V-2 保留派生只读 getter 一个观察期兜底。