# 目击记忆 Claim Schema v1.0

> 冻结决策记录。日期：2026-08-02。
> 范围：claim 五槽 schema、感知质量 → 填槽裁决表、mutation 转移表、目击者数量设计目标。
> 不含：审问接线（W-6，未实施）。
> W-1（`WorldEventLog.js#emitEvent` + `EventDefs.js`）已实施，但 `EVENT_DEFS`
> 目前只有 `TalkActivity.js` 迁移过来的 5 个 kind，不是完整的世界事件词表——
> 其他事件源接入 `emitEvent()` 时按需在 `EventDefs.js` 里加新 kind。
> W-5（`Belief.js#generateClaims` + `ClaimDecisionTables.js`）已实施，但尚无
> 调用方把 `WorldEventLog` 的事件接到 `generateClaims()`——两个地基还没接线，
> 这是留给后续批次的工作，不在本文档范围。
> 本文档只锁 schema 与数值表，供后续批次按此表实现，实现前禁止另起一套字段名/取值域。

## 背景

`docs/design-plans/belief-layer-v0.md` 给过一版 claim 占位结构
`{subject, predicate, object, confidence, source, timestamp}`，是自由字符串三元组，
没有回答"目击质量差的时候该模糊哪一块"这个核心问题。本文档把它替换为一个显式的
**五槽事件结构**（Davidsonian event：谁对谁在哪做了什么、什么时候），并把"质量差时
该丢哪个槽"钉成一张裁决表，而不是留给实现者临场发挥。

`js/behavior/Perception.js`（W-4，已实施）提供上游输入：
`perceive(witness, eventX, eventY) → {channel: 'sight'|'sound', q} | null`。
本文档的裁决表消费的就是这个 `{channel, q}`。

---

## 一、Claim 五槽 schema

```js
{
  actor:  string | null,   // 触发事件的主体
  action: string | null,   // 事件类型（verb）
  target: string | null,   // 动作的对象/协作者
  place:  string | null,   // 发生地点
  time:   number | null,   // 发生时刻
  q:      number,          // 目击质量 [0,1]，产出时的原始值，不随复述改变
  channel:'sight'|'sound', // 目击通道
  source: 'witness',       // v1 只覆盖亲眼/亲耳目击；'news'/'rumor' 是 belief-layer-v0 的后续来源，本文档不重复定义
}
```

每槽的取值域：

| 槽 | 细粒度（fine） | 粗粒度（coarse） | null 语义 |
|----|---------------|------------------|-----------|
| `actor`  | entity_id（如 `npc_42`） | tag（如 `'jogger'`，只知道类别不知道具体是谁） | 未能识别主体 |
| `action` | 具体动作字符串（`EventDefs.js#EVENT_DEFS` 的 kind 键，如 `'push'`/`'handshake'`） | `EVENT_DEFS[kind].category`（如 `'social'`/`'conflict'`），只知道"发生了社交/冲突类的事"不知道具体是什么 | 完全没看清在做什么 |
| `target` | entity_id \| tag，同 `actor` | 同 `actor` | 两种成因不区分记录（见「已知简化」）：①动作本身无对象（如 `'sit'`）②未能感知到对象 |
| `place`  | prop id / 精确坐标 | yBand 名（如 `'park'`/`'sidewalk_far'`） | 完全没定位到地点 |
| `time`   | 绝对 timestamp | 粗桶（`'just_now'`/`'a_while_ago'`/`'long_ago'`） | 几乎不出现在产出时（见下方 channel 表），只会在复述 mutation 后出现 |

---

## 二、Channel × 槽 可填表（硬约束 vs 概率）

| 槽 | sight 通道 | sound 通道 |
|----|-----------|-----------|
| `actor`  | 按 q 裁决表概率填 | **恒为 `null`——硬约束，不是概率**（纯听觉无法确认身份，见下方裁决表标注） |
| `action` | 按 q 裁决表概率填，可到细粒度 | 按 q 裁决表概率填，**上限是粗粒度**（声音只能分辨"吵架/大笑/寒暄"这类类别，分辨不到具体动作） |
| `target` | 按 q 裁决表概率填 | 按 q 裁决表概率填，但概率显著低于 sight（能听出"有两个人"不代表能听出"是谁跟谁"） |
| `place`  | 按 q 裁决表概率填，可到细粒度 | 按 q 裁决表概率填，**上限是粗粒度**（声源定位不精确，只能到方向/分带） |
| `time`   | 恒有值（感知到即当下） | 恒有值（同左） |

`actor` 在 sound 通道的硬 null 是本设计唯一的**非概率**规则：其余所有槽的缺失都是
"以某个概率发生"的随机结果，只有这一条在实现里必须是无条件分支（`if channel==='sound'
then actor=null`），不得混进裁决表的概率抽样逻辑，避免小概率下"听到了却猜对是谁"这种
不该发生的情况。

---

## 三、目击质量 q → 填槽裁决表

q 来自 `Perception.perceive()` 的输出。**q < 0.20 视为阈下，不产出 claim**（对应
`Perception.js` 里 `_distFactor` 硬截断之外的"软阈值"；`Belief.js#WITNESS_Q_THRESHOLD`
已按此值实现，表结构本身的数值住址仍在 `ClaimDecisionTables.js`，不在 `Belief.js` 里）。

### sight 通道

| q 区间 | actor | action | target | place | time |
|--------|-------|--------|--------|-------|------|
| ≥ 0.75 | 1.0 @ fine | 1.0 @ fine | 1.0 @ fine | 1.0 @ fine | 1.0 |
| 0.45–0.75 | 0.9 @ fine / 0.1 @ tag | 1.0 @ fine | 0.85 @ fine / 0.15 @ tag | 1.0 @ coarse | 1.0 |
| 0.20–0.45 | 0.3 @ fine / 0.5 @ tag / 0.2 @ null | 0.8 @ coarse | 0.3 @ tag / 0.7 @ null | 0.9 @ coarse | 1.0 |
| < 0.20 | — 不产出 claim — |

### sound 通道

| q 区间 | actor | action | target | place | time |
|--------|-------|--------|--------|-------|------|
| ≥ 0.75 | **0（硬约束）** | 0.8 @ coarse | 0.4 @ tag / 0.6 @ null | 0.7 @ coarse | 1.0 |
| 0.45–0.75 | **0（硬约束）** | 0.6 @ coarse | 0.15 @ tag / 0.85 @ null | 0.5 @ coarse | 1.0 |
| 0.20–0.45 | **0（硬约束）** | 0.25 @ coarse | 0.05 @ tag / 0.95 @ null | 0.25 @ coarse（"附近"级） | 1.0 |
| < 0.20 | — 不产出 claim — |

表内数值是占位值（与 `Perception.js` 的距离/衰减系数同等地位），需 headless-sim 跑分布
敏感性分析后调整；但**表的结构**（哪个 q 区间该有哪些槽、sound.actor 恒零）是本次冻结
的设计决策，调数值不需要重新过一遍设计评审，改结构需要。

---

## 四、Mutation 转移表（复述失真，参照 Talk of the Town）

claim 经 NPC 间复述传播时，每跳按槽独立抽样是否失真。**只对"当前有值"的槽生效**——
本来就是 `null`（无论是结构性 null 还是 sound.actor 的硬约束 null）不参与本表，不会凭空
"变出"一个值。

| 槽 | 不变 | 退化（fine→coarse/tag） | 置换（记错成别的实体/地点） | 丢失（→null） |
|----|------|------------------------|----------------------------|---------------|
| `actor`  | 0.80 | 0.10 | 0.06 | 0.04 |
| `action` | 0.82 | 0.12 | 0.04 | 0.02 |
| `target` | 0.78 | 0.10 | 0.08 | 0.04 |
| `place`  | 0.75 | 0.15 | 0.05 | 0.05 |
| `time`   | 0.90 | 0.07 | 0.01 | 0.02 |

每行概率和为 1.0。`time` 的"不变"概率最高、`place` 最低——记忆研究里空间细节比时间顺序
更容易在转述中漂移，这条先验直接抄自 Talk of the Town 的既有取舍，不是本项目的新发现。

---

## 五、设计目标：每事件 2–4 名质量各异的目击者

`Belief.js#selectWitnesses()` 已按此目标实现：对候选池逐个跑 `Perception.perceive()`，
q≥0.20 才计入候选，按 q 降序取样，候选数 <2 时如实反映（不强行凑数），候选充足时在
[2,4] 内随机取数。`scripts/check-witness-distribution.mjs` 静态采样验证该分布。

理由：
- 少于 2 人：事件近乎不可能被社交传播开（SIR 模型里 `I` 起始状态过小，传播链条随时可能
  在第一跳就断）。
- 多于 4 人：几乎所有在场 NPC 都知道，社交传播失去"信息不对称"这个能制造戏剧性的前提
  （谁知道、谁不知道，本身就是可玩的信息）。
- 2–4 之间还天然产出**质量分布**（前面裁决表决定了同一事件的不同目击者可能拿到完全不同
  的槽组合），这是后续"新闻报道 vs 目击者说法冲突"这类玩法的地基。

---

## 六、已知简化 / 待定

- `target` 的 `null` 不区分"动作本身无对象"和"未感知到对象"两种成因，claim 结构上看不出
  差异。如果后续需要区分（比如"NPC 明确记得看到有人但没看清是谁" vs "NPC 没意识到有第二
  个人"这两种叙事效果不同），需要扩展 schema，本 v1 不做。
- 裁决表和 mutation 表的具体数值都是占位值，待 headless-sim 敏感性分析调整；表结构本身
  是冻结项。
- `action` 的 fine/coarse 两级枚举已有权威来源（`EventDefs.js#EVENT_DEFS` 的
  `kind` / `category`），但目前只覆盖 `TalkActivity.js` 的 5 个 kind——其他事件源
  （非 talk 触发的冲突/交通事故等）接入 `emitEvent()` 时才会把词表填完整，
  本文档不预先假设一个尚不存在的完整列表。
- claim 到 `npc.mem('belief').claims` 的实际写入时机、SIR 传播的具体触发点（Talk
  activity 配对时？）沿用 `belief-layer-v0.md` 的 I-1/I-3 集成点草案，本文档不重复展开。
