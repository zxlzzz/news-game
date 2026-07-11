> **SNAPSHOT** — 2026-07-11. 已由 `docs/contracts/behavior.md` 取代（superseded by contracts/behavior.md）。引用的旧路径（js/BehaviorManager.js、js/NPC.js）已不存在；本文件保留作历史参考，不再维护。

# NPC 行为系统重构：分层架构 + Activity 统一模型

## 目标

将当前的单体 `BehaviorManager`（只管普通行人 7 个状态）重构为**分层、Profile 驱动、Activity 统一**的行为系统，让所有 NPC（包括 chess / dogwalker / athlete）纳入同一套框架，支持角色在不同行为域之间自由流转（如：棋手被激怒 → 离桌变普通行人 → 路人经过空桌 → 坐下成为新棋手）。

**本次只搭框架骨架，跑通现有行为即可。不新增任何 npc.md 里尚未实现的状态（如 lean_wall / squat / push / handshake 等），不实现镜头反应逻辑。**

---

## 现有代码概况（先读再改）

必须先阅读以下文件理解现有架构：

| 文件 | 作用 |
|------|------|
| `Claude.md` | 项目总览、分带常量、Entity 架构、编码规范 |
| `npc.md` | NPC 行为规格文档（目标蓝图，当前只实现了一部分） |
| `js/BehaviorManager.js` | 当前行人状态机（walk/run/stand/sit_bench/fall/lie_ground/talk + phone_look overlay + SocialBond） |
| `js/NPC.js` | NPC 实体，已有字段：state / overlay / bond / overlayPose / npcType / tags / roam / customUpdate |
| `js/Entity.js` | 实体基类 |
| `js/EntityManager.js` | 统一管理实体，每帧写 depthScale、按 Y 排序绘制 |
| `js/SceneConfig.js` | 分带常量（PARK_TOP/PARK_BOTTOM/CHESS_PLAZA/MINI_PARK 等） |
| `js/npcs/Pedestrians.js` | 行人 spawner，公园漫游者 + 前人行道行人 + 横穿者 |
| `js/npcs/Chess.js` | 棋局 spawner，2 棋手轮流落子 + 旁观者，用 customUpdate 硬编码 |
| `js/npcs/DogWalker.js` | 遛狗者 spawner，leashTarget 绑带系统 |
| `js/npcs/Athletes.js` | 运动者 spawner |
| `js/npcs/Vehicles.js` | 车辆 spawner（不纳入本次重构） |
| `js/scenes/StreetScene.js` | 主场景，搜索 `behaviorManager` 和 `spawn` 相关行了解接入方式 |

已有动画文件（`assets/animations/`）：walk, run, single, sit_bench, fall, lie_ground, jog, bike, mobile, chess, chess_onlookers, dogwalk, lean_wall, lie_bench, squat, get_up, idle, "squat down", "stand up"

---

## 新建文件结构

```
js/behavior/
├── NpcProfile.js           # Profile 数据定义 + 预设档案集合
├── BaseStateMachine.js     # 基础状态机（单个 NPC 的状态转换逻辑）
├── OverlayLayer.js         # 叠加动作层
├── SocialLayer.js          # 社交 / Activity 管理层
├── CameraReactionLayer.js  # 镜头反应层（本次只留空接口）
└── EnvironmentQuery.js     # 空间查询工具
```

修改文件：
- `js/BehaviorManager.js` → 重构为薄协调器，组合上述各层
- `js/npcs/Chess.js` → 去掉 customUpdate 硬编码，改用 ChessActivity
- `js/npcs/DogWalker.js` → 改用 DogWalkActivity
- `js/npcs/Athletes.js` → 注册进 BehaviorManager，用 athlete profile
- `js/npcs/Pedestrians.js` → 简化，只负责生成 + 指定 profile 名
- `js/scenes/StreetScene.js` → 接入方式微调（所有 NPC 统一注册）

不动的文件：NPC.js / Entity.js / EntityManager.js / StickRenderer.js / Viewfinder.js / VehicleEntity.js / SceneConfig.js

---

## 各模块详细设计

### 1. NpcProfile.js

纯数据模块，导出一个 `PROFILES` 字典和一个 `getProfile(name)` 函数。

每个 profile 对象结构：

```js
{
  name: 'pedestrian',
  
  // 允许的基础状态集合（不在此集合内的状态不允许进入）
  allowedStates: ['walk', 'run', 'stand', 'sit_bench', 'fall', 'lie_ground'],
  
  // 状态转换权重表：当前状态 → { 目标状态: 权重, ... }
  // 权重是相对值，转换时按权重随机选择；特殊条件（如 nearBench）在 BaseStateMachine 里检查
  transitions: {
    walk:       { stand: 0.7, sit_bench: 0.2, run: 0.1 },
    run:        { walk: 0.9, fall: 0.1 },
    stand:      { walk: 0.9, sit_bench: 0.1 },
    sit_bench:  { stand: 1.0 },
    fall:       { lie_ground: 1.0 },
    lie_ground: { stand: 1.0 },
  },
  
  // 允许的 overlay 及其兼容的基础状态
  overlays: {
    phone_look: { on: ['walk', 'stand'], chance: 0.004, dur: [5, 25] },
  },
  
  // 允许参与的 Activity 类型
  activities: ['talk'],
  
  // 性格特征（影响概率/时长的修饰符，后续扩展用）
  traits: {},
  
  // 镜头反应倾向（后续扩展用）
  cameraReaction: 'neutral',
}
```

本次需要的预设 profile：
- `pedestrian` — 当前行人的行为复刻
- `businessman` — 同 pedestrian，可加 phone_look 概率更高
- `tourist` — 同 pedestrian
- `chess_player` — allowedStates: ['walk', 'stand', 'sit_bench']，activities: ['talk', 'chess']
- `chess_onlooker` — allowedStates: ['walk', 'stand']，activities: ['chess_watch']
- `dog_owner` — allowedStates: ['walk', 'stand']，activities: ['dog_walk']
- `athlete` — allowedStates: ['walk', 'run', 'jog', 'stand']，activities: []

### 2. EnvironmentQuery.js

包装 EntityManager 的空间查询，提供语义化接口：

```js
class EnvironmentQuery {
  constructor(entityManager) { ... }
  
  nearestProp(npc, propType, radius)  // 最近的指定类型道具
  nearbyNPCs(npc, radius)             // 附近的 NPC 列表
  isNearWall(npc, threshold)          // 是否靠近建筑墙面
  isNearBench(npc, threshold)         // 附近有长椅吗
  findVacantProp(propType, radius, center)  // 找无人占用的道具（如空棋桌）
}
```

道具"被占用"的判定：Activity 开始时标记占用的道具 ID（`prop._occupiedBy = activityId`），结束时释放。EnvironmentQuery 检查此标记。

### 3. BaseStateMachine.js

**不是一个全局单例**，而是一个纯函数/类，给单个 NPC tick 一帧：

```js
// 被 BehaviorManager 对每个未被 Activity 锁定的 NPC 每帧调用
function tickBaseState(npc, profile, envQuery, dt) → void
```

逻辑：
1. `npc.stateTimer += dt`
2. 如果 `stateTimer >= stateDur`，从 `profile.transitions[currentState]` 按权重随机选下一状态
3. 选中状态前检查环境前置条件（sit_bench 需要 `envQuery.isNearBench(npc)`，否则 fallback 到 stand）
4. 进入新状态：设置 npc.state / animation / speed / vy / frameIndex 等（复用当前 `_setState` 的逻辑）
5. 漫游 NPC（`npc.roam`）在 walk/run 态调用转向逻辑（复用当前 `_steerRoam`）

特殊状态处理：
- `fall` → 动画播完（`animDone`）自动进入 `lie_ground`
- `lie_ground` → 计时结束进入 `stand`
- `run` → 极低概率触发 `fall`

### 4. OverlayLayer.js

每帧对未被 Activity 锁定的 NPC tick overlay：

```js
function tickOverlay(npc, profile, dt) → void
```

逻辑基本复用当前 `_tickOverlay`，但改为读 `profile.overlays` 的配置（哪些 overlay 可用、兼容哪些基础状态、触发概率、持续时长）。

### 5. SocialLayer.js — Activity 系统（核心）

这是最重要的新增部分。

#### Activity 基类

```js
class Activity {
  constructor(id, type, participants, props) {
    this.id = id;
    this.type = type;              // 'talk' | 'chess' | 'dog_walk' | ...
    this.participants = [];        // [{ npc, role }]  role 如 'player_a', 'onlooker', 'owner', 'dog'
    this.occupiedProps = [];       // 占用的道具实体
    this.timer = 0;
    this.subState = 'init';        // 内部子状态
    this.alive = true;
  }
  
  // 加入参与者（锁定 NPC，阻止 BaseStateMachine 接管）
  join(npc, role) { ... npc._activity = this; ... }
  
  // 释放参与者（解锁，还给 BaseStateMachine）
  release(npc) { ... npc._activity = null; ... }
  
  // 每帧更新（子类覆盖）
  update(dt) → boolean  // 返回 false 表示 Activity 结束
  
  // Activity 被外部打断（如掀棋盘）
  interrupt(reason) { ... }
  
  // 清理：释放所有参与者 + 道具
  destroy() { ... }
}
```

#### TalkActivity（替代当前 SocialBond）

两人面对面对话。子状态：`talking` → 计时结束 → 双方释放回 walk。
本次只需复刻当前 SocialBond 的行为即可。后续扩展 handshake / push / point_at / give_item 作为子状态。

#### ChessActivity（替代 Chess.js 的 customUpdate）

参与者：player_a（direction=1）、player_b（direction=-1）、0~N 个 onlooker。
占用道具：chess_table + 两把 chair。
子状态机：
```
init → playing（轮流 playOnce 落子动画，非活跃方冻结首帧）
     → 自然结束 / 被打断 → cleanup（释放参与者 + 道具）
```
旁观者有自己的子行为：站立 → 播放 chess_onlooker 动画 → 短距离走动 → 再次观看（循环）。

**重要**：Chess.js 里创建棋桌/椅子道具的代码保留在 spawner 里，但棋手的行为逻辑迁移到 ChessActivity。spawner 负责创建 NPC + 道具，然后把它们交给 SocialLayer 创建 ChessActivity。

#### DogWalkActivity

参与者：owner + dog（leash 绑带）。
本次只需包装现有的 leashTarget 逻辑即可，owner 走路时 dog 跟随。后续扩展狗的半独立行为（嗅地面/吠叫/拉扯）。

#### SocialLayer 管理器

```js
class SocialLayer {
  constructor(envQuery) { ... }
  
  activities = [];  // 所有活跃 Activity
  
  update(npcs, dt) {
    // 1. tick 所有活跃 Activity；结束的 destroy
    // 2. 周期性扫描：尝试配对新的 TalkActivity（复用当前 _tryPairTalk 逻辑）
    // 3. 周期性扫描：路人经过空棋桌 → 概率加入新 ChessActivity（后续实现，本次可留桩）
  }
  
  // 外部触发：创建指定类型的 Activity
  createActivity(type, participants, props) { ... }
  
  // 外部触发：打断某个 Activity
  interruptActivity(activityId, reason) { ... }
}
```

### 6. CameraReactionLayer.js

本次只导出一个空壳：

```js
export class CameraReactionLayer {
  update(npcs, viewfinder, stability, dt) {
    // TODO: 根据 stability 值对框内 NPC 施加行为修改
  }
}
```

### 7. BehaviorManager.js 重构

变成薄协调器：

```js
import { getProfile } from './behavior/NpcProfile.js';
import { EnvironmentQuery } from './behavior/EnvironmentQuery.js';
import { tickBaseState } from './behavior/BaseStateMachine.js';
import { tickOverlay } from './behavior/OverlayLayer.js';
import { SocialLayer } from './behavior/SocialLayer.js';
import { CameraReactionLayer } from './behavior/CameraReactionLayer.js';

export class BehaviorManager {
  constructor(entityManager) {
    this.em = entityManager;
    this.envQuery = new EnvironmentQuery(entityManager);
    this.socialLayer = new SocialLayer(this.envQuery);
    this.cameraLayer = new CameraReactionLayer();
    this.npcs = [];
  }
  
  // 注册 NPC，传入 profile 名
  register(npc, profileName = 'pedestrian') {
    npc._profile = getProfile(profileName);
    npc._activity = null;  // 当前参与的 Activity（null = 自由）
    // ... 初始化 walkSpeed 等
    this.npcs.push(npc);
  }
  
  update(delta) {
    const dt = delta / 1000;
    
    // 1. SocialLayer（tick 所有 Activity + 尝试新配对）
    this.socialLayer.update(this.npcs, dt);
    
    // 2. 自由 NPC（未被 Activity 锁定）走 BaseStateMachine + OverlayLayer
    for (const npc of this.npcs) {
      if (!npc.alive || npc._activity) continue;
      tickBaseState(npc, npc._profile, this.envQuery, dt);
      tickOverlay(npc, npc._profile, dt);
    }
    
    // 3. CameraReactionLayer（暂空）
    // this.cameraLayer.update(this.npcs, viewfinder, stability, dt);
  }
}
```

---

## Spawner 改造

### Pedestrians.js
- 生成 NPC 后调用 `behaviorManager.register(npc, 'pedestrian')` （或 'businessman' / 'tourist'）
- 去掉 `n.roam = zone` 之外的行为代码（roam 信息保留，BaseStateMachine 读取它做转向）
- 横穿者暂保留 customUpdate 不动（它不属于行为系统，是路径脚本）

### Chess.js
- 道具创建（棋桌/椅子）保留
- 棋手 NPC 创建后 `register(npc, 'chess_player')`
- 旁观者 NPC 创建后 `register(npc, 'chess_onlooker')`
- 调用 `socialLayer.createActivity('chess', [{npc: playerA, role: 'player_a'}, ...], [table, chair1, chair2])`
- **删除 customUpdate 硬编码**

### DogWalker.js
- owner `register(npc, 'dog_owner')`
- dog 不注册进 BehaviorManager（它是 leash 绑带从属，由 DogWalkActivity 管理）
- 调用 `socialLayer.createActivity('dog_walk', [{npc: owner, role: 'owner'}, {npc: dog, role: 'dog'}])`

### Athletes.js
- `register(npc, 'athlete')`
- 不需要 Activity，BaseStateMachine 用 athlete profile 驱动（jog/run/walk/stand）

### StreetScene.js
- 把 `this.behaviorManager = new BehaviorManager(em)` 提前到所有 spawn 之前
- 所有 spawn 函数接收 `behaviorManager` 引用（或直接接收 register 回调）
- 去掉 `for (const p of managedPeds) this.behaviorManager.register(p)` 这段（在 spawner 内部注册）

---

## 验证标准

重构完成后，游戏的表现应该**和重构前完全一致**：
1. 公园行人正常漫游、停下、坐长椅、偶尔跑、极小概率摔倒、看手机
2. 前人行道行人正常横向行走
3. 横穿者正常过马路
4. 棋手正常轮流落子、旁观者正常观棋
5. 遛狗者正常走路、狗跟随
6. 运动者正常跑步/慢跑
7. 两人靠近时仍会触发对话
8. 取景框捕获标签仍然正常工作

不应出现新的 bug 或行为差异。

---

## 注意事项

- 中文注释，类 PascalCase，函数/变量 camelCase
- NPC.js 上已有的字段（state / overlay / bond / npcType / roam / customUpdate / overlayPose）不要改名或删除，新增字段用下划线前缀（`_profile` / `_activity`）避免冲突
- `npc.bond` 字段保留兼容，TalkActivity 创建时同时设置 `npc.bond`（NPC.getTags() 里检查了它）；后续可以统一迁移到 `_activity`
- 不要动 StickRenderer.js（无状态渲染器，已锁定）
- 不要改 VehicleEntity.js 和车辆系统
- 不要实现 npc.md 中标注"暂不实现"或"后续可扩展"的状态
- 所有 Activity 子类都要实现 `interrupt(reason)` 接口，即使本次不会被调用
- EnvironmentQuery 的道具占用标记用 `prop._occupiedBy`，不要在 PropEntity 上加新的公开属性