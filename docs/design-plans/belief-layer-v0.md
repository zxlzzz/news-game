> **status: draft** — 占位草案；正式设计在新闻管线 MVP 稳定后展开。

# 信念层 v0 — 设计草案

> 状态：占位草案。正式设计待前置条件满足后展开：
> - 新闻管线 MVP（providers.js / NewsArchive.js）稳定上线
> - entitySnapshot schema 确定（实体 id + tags 结构固化）

## 目标

让 NPC 持有对场景事件的**符号化信念**，并在社交互动中传播（包含失真）。
玩家发布的新闻可以修改 NPC 信念，制造与地面真相的偏差，使新闻报道的"立场"影响成为可观测的世界反馈。

---

## 核心数据结构（草案）

```js
// 单条信念声明（symbolic claim）
{
  subject:    string,   // entity id 或 tag（如 'npc_42'、'jogger'）
  predicate:  string,   // 动词（如 'was_at'、'did'、'is'）
  object:     string,   // 宾语（如 'bench_3'、'fighting'、'hero'）
  confidence: number,   // [0,1]，1 = 亲眼所见，< 0.5 = 道听途说
  source:     'witness' | 'news' | 'rumor',
  timestamp:  number,   // 事件发生时刻（非记录时刻）
}
```

每个 NPC 持有 `npc.mem('belief').claims`（数组），由信念层读写。

---

## LLM 污染防护（Loftus 效应）

Elizabeth Loftus 的研究表明，事后信息（post-event misinformation）会改写目击者记忆。
本设计在架构上对应：

- **witness memory**（亲眼所见）：来自 `SocialLayer` 或 `ActivityLog` 的第一手事件，`source='witness'`，`confidence` 初始 1.0。
- **news 注入**：`publishArticle()` 后，文章立场可将部分 NPC 的相关 claim `confidence` 向 0 或 1 偏移，或写入新 claim（`source='news'`）。
- **污染防护铁律**：LLM（vision/text provider）**只做翻译**（事件 → 文字），**不直接写 belief**；belief 写入只能通过游戏内机制（witness + SocialLayer + publishArticle），禁止 LLM 输出直接 JSON patch 进 `claims` 数组。

---

## 四个集成点（草案）

| 集成点 | 触发时机 | 操作 |
|--------|----------|------|
| I-1 事件录制 | Activity/SocialLayer 观察到显著事件时 | 向参与 NPC + 目击圈写入 `source='witness'` claim |
| I-2 新闻注入 | `publishArticle()` 调用时 | 按文章立场向受众 NPC 写入/修改 claim（`source='news'`） |
| I-3 社交传播 | Talk activity 配对时 | 以 SIR 衰减模型传播 claim（confidence 按跳数递减） |
| I-4 行为影响 | NPC 选目标/反应时（Agenda.tick） | 读 claim 影响 desire 权重（如 `is=hero` → 靠近意愿+） |

---

## 传播模型参考（SIR / Gossip）

```
S（未知）→ I（持有 claim）→ R（遗忘 / 信念固化）
```

每次 Talk 交互：
- I → S 传播概率 `p_spread = claim.confidence × 0.4`
- 传播时 `confidence *= 0.85`（每跳衰减）
- `confidence < 0.05` → 自动丢弃（不再传播）

参数为占位值，需在 headless-sim 中跑敏感性分析后调整。

---

## 待定

- claim schema 的规范化（subject/predicate/object 枚举还是自由字符串？）
- 与 NewsArchive 的具体接线（`publishArticle` 回调 vs. 观察者模式）
- 行为影响权重如何与 Agenda desire system 接合
- belief 的持久化（场景重载后是否保留）
- UI 层：是否允许玩家查看 NPC 当前信念（调试视图 / 游戏内交互）
