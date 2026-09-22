# 仓库只读盘点 — 面向 Godot 重写（2026-09-20）

> **status: snapshot** — 只读盘点，写完不再更新。后续变化以新文件替代。

## 前置条件核对

| 条件 | 结果 | 证据 |
|------|------|------|
| `CLAUDE.md` 前 3 行含 "js/ 这条线已冻结" | 通过 | `CLAUDE.md:1` — `> js/ 这条线已冻结，不开新批次。` |
| `design_route_npc_behavior.md` 第 1 行含 "status: finalized" | 通过 | `design_route_npc_behavior.md:1` — `> **status: finalized** — 未实现；不对应现有 js/ 代码` |

## 方法与口径

- 所有判断只基于文件里写着的文字。不使用提交时间、文件名语义或目录位置作推断。
- 第 1 部分覆盖 `git ls-files '*.md'` 的全部 53 个文件。
- 第 2 部分覆盖 `git ls-files 'js/*.js' 'js/**/*.js'` 的全部 149 个文件。
- 「是否被别的文档覆盖」只填**其它**文件里的文字；文件自己头部的 status／冻结声明记在第 2 列，不重复计入第 3 列。
- 「能否作为当前依据」的判据取自 `docs/contracts/docs.md:22` — `frozen`：暂停，不否决也不继续，文件不删；恢复时重新评估，在此之前不能当作当前依据。
- 本盘点未运行游戏、未运行 `scripts/headless-sim.mjs`、未启动 Godot。全部结论来自读文件与 grep。

---

## 1. 文档状态表

| 路径 | 文件自己声明的状态 | 是否被别的文档覆盖 | 能否作为当前依据 |
|------|--------------------|--------------------|------------------|
| `.agents/skills/run-game/SKILL.md` | 无声明（YAML frontmatter 只有 `name` / `description`） | 未发现。`CLAUDE.md:567` 引用的是 `.claude/skills/run-game/SKILL.md`，与本文件路径不同，不构成覆盖证据 | 不确定 — 缺少任何一方说明这两个路径是否同一份文件 |
| `CLAUDE.md` | 无声明（无 status 头；前 3 行是引用块形式的项目级约束） | 未发现 | 是 |
| `action_inventory.md` | 第 1 行 — `> **status: draft** — 作者的随手工作稿，不是规范` | `assets/动作生成任务清单.md:5` — `本清单汇总根目录 action_inventory.md、assets/animations/ 现有 JSON，以及本轮已选中的 NPZ。`（引用，非覆盖） | 否 — 自称「不是规范」 |
| `assets/animation_checks/endpoint_constraints/说明.md` | 无声明。第 3 行 — `实验日期：2026-09-19。此目录是原始实验记录，不替换 animations/npz 中的已选素材。` | 未发现 | 是（限于「原始实验记录」范围，文件自述不替换已选素材） |
| `assets/animations/new_assets/docx.md` | 无声明 | `CLAUDE.md:666` 列为「快照」，说明栏：`原 4 个待处理 clip（lift/child_single/hand_stand_up/hand_stand_down）已在 A-1~A-3 全部处理完` | 否 — 描述的是 clip JSON 的校对流程，服务于 `CLAUDE.md:1` 已冻结的 js/ 线 |
| `assets/fromgodot/game-godot/README.md` | 无声明。第 1–4 行自述是「a deliberately small composition and style test」 | 未发现 | 是 |
| `assets/fromgodot/street-selected/SOURCES.md` | 无声明。第 3 行自述「尚未接入场景」「此处只完成源模型筛选」 | 未发现 | 是 |
| `assets/动作生成任务清单.md` | 无声明。第 3 行 `更新：2026-09-19。` | 未发现 | 是 |
| `assets/动作素材清单.md` | 无声明。第 3 行 `更新日期：2026-09-19。` | `docs/roadmap.md:8` 列入「新路线文档」 | 是 |
| `design route 9.6.md` | 第 3 行 — `> **status: snapshot**`；第 1 行另有 `本文中的直接 77→11 抽点、旧比例/肩部方案、线条或体积待选等表述不再作为当前实现依据`；第 4 行 `§5 与 §7 所说的"Kimodo 未在本机运行过"已过时` | `design_motion_supply.md:3` — `> superseded by design route 9.6.md 与 design_route_npc_motion_supply.md`（反向引用，指本文件是后继）；`sth/asset-import-spike/PIPELINE.md:1` — `三渲二 / 进入 PixiJS 的部分已被 design route 9.6.md §2 取代` | 不确定 — 文件自己声明 §5/§7 与 NPC 映射部分失效、其余为 snapshot，但没有逐节效力清单可据以分辨 |
| `design_motion_supply.md` | 第 3 行 — `> superseded by design route 9.6.md 与 design_route_npc_motion_supply.md`；第 1 行 — `本文保留早期分析 … 不再作为当前实现依据` | 未发现（覆盖声明写在本文件自身第 3 行） | 否 |
| `design_route_npc_behavior.md` | 第 1 行 — `> **status: finalized** — 未实现；不对应现有 js/ 代码` | `docs/roadmap.md:8` 列为新路线文档；`docs/design-plans/belief-layer-v0.md:1`、`chain-task-design.md:1`、`duet-interaction-design-v1.md:1`、`photo2entity-plan.md:1`、`semantic-destination-design.md:1` 五处均写 `NPC 行为新路线见 design_route_npc_behavior.md`（反向引用） | 是 |
| `design_route_npc_motion_supply.md` | 无 status 头。第 1 行 — `> **当前状态（2026-09-20）**：… 共用映射模块和独立参数 JSON 已在 sth/motion-study/ 落实，六条样例已接入预览；游戏集成尚未落实。` | `design_motion_supply.md:3` 声明被本文件取代；`design route 9.6.md:4` — `动作供给方案以 design_route_npc_motion_supply.md 为准`；`docs/roadmap.md:8` 列为新路线文档 | 是 |
| `docs/audits/behavior-redundancy-2026-07.md` | 第 3 行 — `**类型：** snapshot（不原地更新）` | `docs/design-plans/goal-pipeline-v1.md:11` — `**取代**：docs/audits/behavior-redundancy-2026-07.md 附录 C（作废）`；同文件 `:216` — `附录 C 全部作废（含 C-1～C-5…）` | 否 — snapshot，附录 C 明文作废，对象是已冻结的 js/ 行为层 |
| `docs/audits/velocity-unification-closing-2026-07.md` | 无 status 头。第 3–5 行给日期 2026-07-19、分支、覆盖范围 | `CLAUDE.md:659` 列为「快照」 | 否 — 审计对象是已冻结的 js/ 速度统一批次 |
| `docs/audits/代码审查报告-2026-08-05.md` | 无 status 头。第 3 行 — `审查范围：js/ 全部源码 + index.html / main.js / CLAUDE.md` | 未发现 | 否 — 审查对象整体是 `CLAUDE.md:1` 已冻结的 js/ 线 |
| `docs/baselines/2026-07-12-27a45503-s42-post.md` | 无 status 头。第 3 行 — `**date**: 2026-07-12  **sha**: 27a45503  **seed**: 42  **minutes**: 10` | `CLAUDE.md:661` 列为「快照」 | 否 — 针对已冻结 js/ 线的 headless sim 基线 |
| `docs/baselines/2026-07-12-ddd9eb2f-s42-pre.md` | 无 status 头。第 3 行 — `**date**: 2026-07-12  **sha**: ddd9eb2f  **seed**: 42  **minutes**: 10` | `CLAUDE.md:660` 列为「快照」 | 否 — 同上 |
| `docs/baselines/2026-07-13-e3c9ec1c-s42-pre.md` | 无 status 头。第 3 行 — `**date**: 2026-07-13  **sha**: e3c9ec1c  **seed**: 42  **minutes**: 2` | `CLAUDE.md:662` 列为「快照」 | 否 — 同上 |
| `docs/behavior-design.md` | 第 1 行 — `> **SNAPSHOT** — 2026-07-11. 准确内容已迁入 docs/contracts/behavior.md；本文件保留作历史参考，不再维护。` | `CLAUDE.md:643` 列为「快照」，说明栏：`行为系统目标架构蓝图（准确内容已迁入 contracts/behavior.md）` | 否 |
| `docs/contracts/activity-lifecycle-v1.md` | 第 3 行 — `> **状态**：§8 落地顺序 1～6 全部完成（Patch E / F+G / G / H / D / A）` | `CLAUDE.md:637` 列为「规范性」 | 否 — 规范对象是已冻结的 js/ 行为层 |
| `docs/contracts/behavior.md` | 第 5 行 — `Normative. Code changes that affect any section must update this file in the`；第 3 行 `verified at 8f691609a02528495426ff4ea21abcfa9152065b` | `CLAUDE.md:635` 列为「规范性」；`docs/behavior-design.md:1`、`docs/npc-behavior-system-v0.md:1`、`docs/npc-states.md:1` 三处声明内容已迁入／被本文件取代 | 否 — normative，但约束对象是 `CLAUDE.md:1` 已冻结的 js/ 代码；可作为「旧实现是什么」的记录 |
| `docs/contracts/docs.md` | 无 status 头。文件本身即文档分类策略：`:21` 枚举 status 取值，`:22` 定义 frozen 语义 | `CLAUDE.md:634` 列为「规范性」 | 是 — 规定的是文档规则本身，不依赖 js/ 代码 |
| `docs/contracts/known-violations.md` | 无 status 头。第 3–5 行自述记录 check-invariants.mjs 之前遗留的违规及迁移路径 | `CLAUDE.md:638` 列为「规范性」 | 否 — 条目全部指向已冻结的 js/ 代码 |
| `docs/contracts/movement-dataflow.md` | 第 3 行 — `> Normative. Updated through N-3c; routing chain deleted; Npc.js inline movement deleted; …` | `CLAUDE.md:649` 列为「规范性」 | 否 — normative，但约束对象是已冻结的 js/ 移动管线 |
| `docs/contracts/movement.md` | 第 3 行 — `> **⚠️ M-1「信任路径」重构后记（超越下方部分行）**：已删除三层反应式避障 + 位置分离 + 卡死重规划` | `CLAUDE.md:636` 列为「规范性」 | 否 — 同上；文件另自述部分行已被自身后记超越 |
| `docs/design-plans/activity-event-emission-v1.md` | 第 3 行 — `> 状态：implemented（how-to，记录现存代码路径，不提出新架构）。` | 未发现 | 否 — 记录的「现存代码路径」全在已冻结的 js/ 内 |
| `docs/design-plans/belief-layer-v0.md` | 第 1 行 — `> **status: frozen** — 旧架构线暂停；NPC 行为新路线见 design_route_npc_behavior.md`；第 3 行 — `> **status: draft** — 占位草案；正式设计在新闻管线 MVP 稳定后展开。` | `CLAUDE.md:3` — `docs/ 里 status 为 frozen 的文档不能当作当前依据。`；`CLAUDE.md:654` 列为「设计稿（draft）」 | 否 |
| `docs/design-plans/chain-task-design.md` | 第 1 行 — `> **status: frozen** — 旧架构线暂停；NPC 行为新路线见 design_route_npc_behavior.md`；第 3 行 — `> **status: finalized** — 2026-07-22 定稿；B-①a / B-①b / B-② 批次待实施。` | `CLAUDE.md:3`；`CLAUDE.md:642` 列为「设计稿（finalized）」 | 否 |
| `docs/design-plans/duet-interaction-design-v1.md` | 第 1 行 — `> **status: frozen** — 旧架构线暂停；NPC 行为新路线见 design_route_npc_behavior.md`；第 5 行 — `> 冻结决策记录。日期：2026-07-25。` | `CLAUDE.md:3`；`CLAUDE.md:663` 列为「设计稿（finalized）」 | 否 |
| `docs/design-plans/editor-reference-layer-v1.md` | 第 3 行 — `> 冻结决策记录。日期：2026-07-25。`（无 `status:` 头） | `CLAUDE.md:664` 列为「设计稿（finalized）」 | 不确定 — 「冻结决策记录」不在 `docs/contracts/docs.md:21` 的 status 枚举内，无法判定它等同 `frozen` 还是等同 `snapshot`；缺一份说明这个措辞对应哪个枚举值的文字 |
| `docs/design-plans/goal-pipeline-v1.md` | 第 3 行 — `> **⚠️ M-1 后记（信任路径重构，晚于本文）**：本文描述的恢复层已大幅缩减` | `CLAUDE.md:653` 列为「规范性」 | 否 — 文件自述核心内容已被 M-1 重构超越，且对象是已冻结的 js/ |
| `docs/design-plans/news-pipeline-mvp.md` | 第 1 行 — `> **status: finalized** — 设计已定稿，实施跟踪见各分支提交记录。` | `CLAUDE.md:639` 列为「设计稿（finalized）」 | 不确定 — 自称 finalized 且无冻结声明，但实现落点 `js/news/` 属已冻结线；缺一份说明新闻管线在 Godot 路线下是否沿用的文字 |
| `docs/design-plans/npc-skeleton-mapping.md` | 无 status 头。第 3 行 — `Hsinlung 已于 2026-09-20 确认这套造型、比例和映射为当前基线。本文从临时交接材料整理，独立维护；临时文件后续覆盖不改变这里的规格。` | `design route 9.6.md:1`、`design_motion_supply.md:1`、`design_route_npc_motion_supply.md:1` 均写 `现行规格见 [NPC 映射规格](docs/design-plans/npc-skeleton-mapping.md)`；`sth/motion-study/README.md:5` — `已接入 Hsinlung 定下的 [映射规格](../../docs/design-plans/npc-skeleton-mapping.md)`（均为反向引用，指本文件是当前基线） | 是 |
| `docs/design-plans/photo2entity-plan.md` | 第 1 行 — `> **status: frozen** — 旧架构线暂停；NPC 行为新路线见 design_route_npc_behavior.md`；第 3 行 — `> **status: draft** — 占位草案；正式设计在 AI 场景生成阶段展开。` | `CLAUDE.md:3`；`CLAUDE.md:640` 列为「设计稿（draft）」 | 否 |
| `docs/design-plans/semantic-destination-design.md` | 第 1 行 — `> **status: frozen** — 旧架构线暂停；NPC 行为新路线见 design_route_npc_behavior.md`；第 3 行 — `> **status: 部分实施（①② 已落地，③ 未动）** — v2 设计已定稿；批次 A-①② 已合入主干。` | `CLAUDE.md:3`；`CLAUDE.md:641` 列为「设计稿（finalized）」 | 否 |
| `docs/design-plans/velocity-representation-survey.md` | 第 4 行 — `- **status**: snapshot` | `CLAUDE.md:650` 列为「快照」 | 否 — 普查对象是已冻结 js/ 的字段消费者 |
| `docs/design-plans/velocity-unification-design-v1.md` | 第 6 行 — `- **status**: finalized — 根修方向已确认；本文为速度统一唯一权威设计稿。`；第 7 行 — `（2026-07-14 收尾批次曾误产同名补丁级方案，已删除；其 V-1/V-2/V-3 编号作废）` | `CLAUDE.md:651` 列为「设计稿（finalized）」，说明栏 `V-1 ✅ / V-2 ✅ / V-3 待实施` | 否 — 方案对象是已冻结的 js/ 速度表示 |
| `docs/design-plans/witness-memory-v1.md` | 第 3 行 — `> 冻结决策记录。v1.0 日期：2026-08-02；v1.1（槽级 provenance 改造，W-7c）同日追加。`（无 `status:` 头） | `CLAUDE.md:655` 列为「设计稿（finalized）」 | 不确定 — 同 `editor-reference-layer-v1.md`：「冻结决策记录」不在 `docs/contracts/docs.md:21` 的枚举内，无法判定等同 frozen 还是 snapshot |
| `docs/npc-behavior-system-v0.md` | 第 1 行 — `> **SNAPSHOT** — 2026-07-11. 已由 docs/contracts/behavior.md 取代（superseded by contracts/behavior.md）。引用的旧路径（js/BehaviorManager.js、js/NPC.js）已不存在；本文件保留作历史参考，不再维护。` | `CLAUDE.md:645` 列为「快照」，说明栏：`行为系统重构 V0 设计（已由 contracts/behavior.md 取代）` | 否 |
| `docs/npc-states.md` | 第 1 行 — `> **SNAPSHOT** — 2026-07-11. 经核对的 STATE_DEFS 与 Profile 表已迁入 docs/contracts/behavior.md；本文件含若干非现行状态（bike、mobile、handshake 等），保留作历史参考，不再维护。` | `CLAUDE.md:644` 列为「快照」，说明栏：`状态机规格历史文档（含已淘汰状态，如 bike/mobile）` | 否 |
| `docs/npcstate-migration.md` | 第 1 行 — `> **SNAPSHOT** — 2026-07-11. 迁移已完成；本文件为历史记录，不再维护。` | `CLAUDE.md:646` 列为「快照」 | 否 |
| `docs/roadmap.md` | 第 1 行 — `> **status: snapshot** — 盘点截止 2026-08-12；新增功能批次请同步更新本表。`；第 7 行 — `PixiJS 线收官于 O-8，冻结；表中所有未完成的批次视为 frozen。` | `CLAUDE.md:658` 列为「快照」；`design route 9.6.md:4` — `§8 的"下一步未定"见 docs/roadmap.md` | 不确定 — 表体是已冻结批次的 snapshot（不能当依据），但第 6–10 行「2026-09 路线状态」小节是「未决／暂缓」事项的唯一成文清单；文件本身没有说明两部分效力是否相同 |
| `docs/sorty-audit.md` | 第 1 行 — `> **SNAPSHOT** — 审计日期 2026-07-11. 本报告不再更新；后续深度问题以新审计文件替代。` | `CLAUDE.md:647` 列为「快照」 | 否 |
| `docs/v3-audit.md` | 第 1 行 — `> **SNAPSHOT** — 审计日期 2026-07-11. 本报告不再更新；后续视觉合规问题以新审计文件替代。` | `CLAUDE.md:648` 列为「快照」 | 否 |
| `kimodo_trial.md` | 第 1 行 — `> **status: finalized**`；第 2 行 — `> **过期提示（2026-09-19）**：本机已试用 Kimodo，单人动作可用；下文保留试用前整理的步骤，不作为本机实测记录。最终骨架的关节数尚未确定，§7 的"挑 11 个关节"不是已定规格。` | `docs/roadmap.md:8` 列入新路线文档 | 不确定 — 头部同时写 finalized 与过期提示，并明文否定 §7；缺逐节效力清单 |
| `sth.md` | 无声明 | `docs/design-plans/npc-skeleton-mapping.md:3` — `本文从临时交接材料整理，独立维护；临时文件后续覆盖不改变这里的规格。` | 不确定 — `sth.md:1` 与 `npc-skeleton-mapping.md:1` 标题逐字相同、`sth.md:3` 与 `npc-skeleton-mapping.md:5` 内容相同，看似即上述「临时交接材料」，但没有任何一方用文字点名 `sth.md` 这个路径；缺少书面对应关系 |
| `sth/asset-import-spike/PIPELINE.md` | 第 1 行 — `> 三渲二 / 进入 PixiJS 的部分已被 design route 9.6.md §2 取代；221 个 GLB 工作库、Blender 封装与转换脚本、清理规则、许可证记录、Godot 街角场景、米制/原点/朝向规范仍有效。` | 未发现（覆盖声明写在本文件自身第 1 行） | 不确定 — 文件明文分成「已被取代」与「仍有效」两部分，但两部分没有逐节边界，无法按节判定 |
| `sth/asset-import-spike/SOURCE.md` | 无声明。内容是单个素材（`tree_oak.glb`）的来源记录 | 未发现 | 是 |
| `sth/asset-import-spike/godot-style-spike/THIRD_PARTY.md` | 无声明。内容是两个 Quaternius 模型的来源记录 | 未发现 | 是 |
| `sth/motion-study/README.md` | 无声明。第 5 行 — `已接入 Hsinlung 定下的 [映射规格](../../docs/design-plans/npc-skeleton-mapping.md)，默认双手挥动；提供正面与自由视角、播放/暂停、逐帧、调参和恢复默认。` | `docs/design-plans/npc-skeleton-mapping.md:5` — `它替代仓库里 sth/motion-study 的做法。` | 不确定 — `npc-skeleton-mapping.md:5` 说替代 `sth/motion-study` 的做法，本 README 第 5 行说已接入该规格；两句互相矛盾，缺第三份文字裁决 |
| `sth/stick-puppet/README.md` | 无声明 | `CLAUDE.md:665` 列为「快照」，说明栏：`StickPuppet 工具启动、操作与 clip 导出说明` | 否 — 工具产出的 clip JSON 由已冻结的 js/ 线消费 |
| `建模规范与参数.md` | 无声明。第 3 行 — `适用：Godot 4.7.2，Forward+。工程里 style/ 下的三个 shader 加上 ink_builder.gd 就是整套画风；params/*.json 存参数。` | 未发现 | 不确定 — 内容面向 Godot，但它描述的 `style/`、`ink_builder.gd`、`params/*.json` 在本仓库 `git ls-files` 里不存在；缺少该工程与本仓库关系的说明 |

---

## 2. js/ 模块表

### 渲染依赖判定口径

按题目给的判据（文件内出现 `PIXI.`，或 import 了出现 `PIXI.` 的文件）逐项 grep，结果只有 **3 个文件**命中，且这 3 个构成一个闭包（没有第四个文件 import 它们）：

| 文件 | 命中方式 |
|------|----------|
| `js/core/PixiText.js` | 文件内直接出现 `PIXI.`，首处 `js/core/PixiText.js:3` |
| `js/scenes/StreetScene.js` | 文件内直接出现 `PIXI.`，首处 `js/scenes/StreetScene.js:17`；另 `js/scenes/StreetScene.js:33` — `import { PixiText } from '../core/PixiText.js';` |
| `js/main.js` | 文件内直接出现 `PIXI.`，首处 `js/main.js:10`；另 `js/main.js:5` — `import { StreetScene } from './scenes/StreetScene.js';` |

`grep -rn 'import.*PixiText' js/` 只有 `StreetScene.js:33` 一条；`grep -rn 'import.*StreetScene' js/` 只有 `main.js:5` 一条；`grep -rn "from '.*main.js'" js/` 零命中。因此表中其余 146 个文件在这条判据下一律记「否」。

**口径的已知局限（不外推，仅记录）**：这条判据是一跳的，且只认 `PIXI.` 字面量。全部 `draw*.js` 与 `StickRenderer.js` 接收一个外部传入的 graphics 对象并调用 `lineStyle` / `drawRect` 等方法，但文件内不出现 `PIXI.`，也不 import 上述三个文件中的任何一个——按给定判据它们记「否」。本盘点不判断这些文件在 Godot 下是否需要重写，那需要另一条判据。

### 是否已被根目录 `design_route_*.md` 规定替换

`git ls-files` 匹配 `design_route_*.md` 的根目录文件有两个：`design_route_npc_behavior.md`、`design_route_npc_motion_supply.md`。对两者 grep `js/` 与 `.js`，命中共 4 行：

- `design_route_npc_behavior.md:1` — `> **status: finalized** — 未实现；不对应现有 js/ 代码`
- `design_route_npc_behavior.md:5` — `> 素材接口说明（2026-09-20）：本文的"动作 json"表示待播放的动作片段，不规定最终存储格式。`
- `design_route_npc_motion_supply.md:7` — `当前交付是 assets/animations/npz/<name>/motion.npz 与 meta.json。`
- `design_route_npc_motion_supply.md:38` — `→ 保留源 motion.npz + meta.json`

**没有一行点名任何一个 `js/` 下的文件。** 因此第 4 列对全部 149 个文件均为「无」。

旁注（不计入第 4 列，因为该文件不匹配 `design_route_*.md` 这个 glob）：`design route 9.6.md:77` — `**作废**：Pixi 渲染层、drawObliqueBox 手工三面体、ClipLibrary.js:191 的 v.length !== 2 卡口。` 这是仓库里唯一一处按名字点到 js/ 实现物的作废声明，但它只点到 `ClipLibrary.js` 一个文件名与两个概念（Pixi 渲染层、`drawObliqueBox`），不构成逐文件的替换规定。

### 表

第 3 列「是否依赖渲染」按上述口径填写；第 4 列全为「无」，原因见上。

| 路径 | 一句话 | 是否依赖渲染 | design_route_*.md 是否规定替换 |
|------|--------|--------------|--------------------------------|
| `js/behavior/ActivityRegistry.js` | Activity 工厂注册表（独立文件，防循环依赖） | 否 | 无 |
| `js/behavior/Agenda.js` | 单 NPC 的目标选取系统 | 否 | 无 |
| `js/behavior/BaseStateMachine.js` | NPC 状态机；自述 OWNS `steerRoam` 与 `mot.path` idx 推进 | 否 | 无 |
| `js/behavior/BehaviorManager.js` | 行为系统薄协调器 | 否 | 无 |
| `js/behavior/Belief.js` | `npc.mem('belief')` 的唯一 owner（W-5/W-6/W-7c/P-6/P-7） | 否 | 无 |
| `js/behavior/ClipPlayer.js` | 把一段 gesture clip 的 keyframes 驱动为 NPC 上的一个 held modifier | 否 | 无 |
| `js/behavior/DebugLog.js` | 行为系统结构化日志（console） | 否 | 无 |
| `js/behavior/Director.js` | 人流源汇调度器（替换 SpawnManager） | 否 | 无 |
| `js/behavior/DuetStager.js` | 双人接触编排引擎（Patch G，从 TalkActivity#_tickSubEvent 抽出） | 否 | 无 |
| `js/behavior/EnvironmentQuery.js` | 空间查询工具 | 否 | 无 |
| `js/behavior/ModifierLayer.js` | 叠加修饰器层（替代 OverlayLayer） | 否 | 无 |
| `js/behavior/Motor.js` | NPC 字段唯一写入层 | 否 | 无 |
| `js/behavior/Perception.js` | 双通道感知裁决（视觉 / 听觉） | 否 | 无 |
| `js/behavior/PoseCacheBuilder.js` | 从 ClipLibrary 自动构建 poseCache | 否 | 无 |
| `js/behavior/SocialLayer.js` | 社交 / Activity 统一模型 | 否 | 无 |
| `js/behavior/SteeringDecision.js` | 到达裁决表（Steering 层唯一距离判定住址） | 否 | 无 |
| `js/behavior/StuckProbe.js` | 卡死探针：每 2s 扫描，归类冻结 NPC，30s 打一次汇总 | 否 | 无 |
| `js/behavior/TaskRunner.js` | 单 NPC 的三槽任务执行器 | 否 | 无 |
| `js/behavior/VehicleSpawner.js` | 车辆边缘入场管理器 | 否 | 无 |
| `js/behavior/WalkMode.js` | 自述 OWNS `npc.roamTarget` 生命周期与 `WALK_PATHS` 模块字典 | 否 | 无 |
| `js/behavior/WorldEventLog.js` | 世界事件流水账 | 否 | 无 |
| `js/behavior/activities/Activity.js` | Activity 基类 — 多 NPC 共同参与的高层行为单元 | 否 | 无 |
| `js/behavior/activities/ChessActivity.js` | 下棋 Activity；回合切换时按 `CHESS_EVENT_PROB` 发 `chess_move` 事件 | 否 | 无 |
| `js/behavior/activities/ContactActivity.js` | 双人接触互动（`push`/`give_item`/`handshake`/`point_at`，Patch G 从 TalkActivity 抽出） | 否 | 无 |
| `js/behavior/activities/StallActivity.js` | 摊位买卖 Activity（继承 `Activity`） | 否 | 无 |
| `js/behavior/activities/TalkActivity.js` | 对话 Activity；子事件掷骰命中后 handoff 给 `contact` | 否 | 无 |
| `js/behavior/data/AttachmentDefs.js` | 可持握道具声明表（纯数据，无 import） | 否 | 无 |
| `js/behavior/data/BehaviorScripts.js` | 链条行为脚本表（纯数据，零 import） | 否 | 无 |
| `js/behavior/data/ClaimDecisionTables.js` | 目击质量 q → 填槽裁决表（纯数据，无 import） | 否 | 无 |
| `js/behavior/data/EventDefs.js` | 世界事件类型声明表（纯数据，无 import） | 否 | 无 |
| `js/behavior/data/MemoryMutationTables.js` | 记忆演化变异概率表 + 报道回流传播规则（纯数据，无 import） | 否 | 无 |
| `js/behavior/data/StallPoseStore.js` | StallActivity 与 StallSellerTask 共享的 `stall_gestures` 存取点 | 否 | 无 |
| `js/behavior/nav/NavGrid.js` | 自述 OWNS NavGrid 单例、zone map 编码（`ZONE.*`）与 `DEFAULT_ZONE_COSTS` | 否 | 无 |
| `js/behavior/nav/PathPlanner.js` | 自述 OWNS 从世界坐标到 `[{x,y}]` 路点数组的 A* 规划；纯函数 | 否 | 无 |
| `js/behavior/nav/PlanService.js` | Intent 层 → Planning 层胶水 | 否 | 无 |
| `js/behavior/tasks/ChainTask.js` | 链条行为脚本解释器（六原语 goto/attach/detach/pose/use/loop） | 否 | 无 |
| `js/behavior/tasks/ChessOnlookerTask.js` | 棋局旁观者（单人，Patch D：不再是 ChessActivity 成员） | 否 | 无 |
| `js/behavior/tasks/ExitSceneTask.js` | 驱动 NPC 按 exitBias 离场 | 否 | 无 |
| `js/behavior/tasks/GotoTask.js` | 导航到目标点（含跨侧过马路） | 否 | 无 |
| `js/behavior/tasks/StallBuyerTask.js` | 走到摊位的 buyer 槽位，到达后交给 `SocialLayer.onSlotArrival` | 否 | 无 |
| `js/behavior/tasks/StallSellerTask.js` | 摊主独自守摊／叫卖（prop-as-host，Patch H） | 否 | 无 |
| `js/behavior/tasks/StrollLoopTask.js` | 沿 `park_loop_cw` 路线走 N 段后返回 done | 否 | 无 |
| `js/behavior/tasks/StrollTask.js` | NavGrid 感知漫游 | 否 | 无 |
| `js/behavior/tasks/TalkToTask.js` | 占住 primary 槽，等 TalkActivity 自然结束 | 否 | 无 |
| `js/behavior/tasks/UseBenchTask.js` | 走到最近空椅子并坐下休息 | 否 | 无 |
| `js/behavior/tasks/UseSmartPropTask.js` | 走到 Smart Object 槽位并直接播放使用手势 | 否 | 无 |
| `js/behavior/tasks/VisitTask.js` | 泛用「到点做事」任务，输入是 `drawAffordance` 的返回值 | 否 | 无 |
| `js/behavior/tasks/WaitBusTask.js` | 公交站等车（单人 ChainTask，Patch C 从 Activity 移出） | 否 | 无 |
| `js/camera/Viewfinder.js` | 可拖动取景框：检测框内所有实体（NPC、建筑、道具）并收集标签 | 否 | 无 |
| `js/core/AffordanceDefaults.js` | per-propType 默认 affordance 描述符表 | 否 | 无 |
| `js/core/ClipLibrary.js` | 单例资产库，统一读取 `assets/manifest.json` + `assets/skeleton.json` | 否 | 无 |
| `js/core/Entity.js` | 所有场景可交互实体的基类 | 否 | 无 |
| `js/core/EntityManager.js` | 实体列表管理与每帧 draw 分发（楼／火柴人／车／道具白名单四类判定） | 否 | 无 |
| `js/core/GameClock.js` | 虚拟游戏时钟（全局单例） | 否 | 无 |
| `js/core/Layout.js` | 场景骨架参数（纵向分带／世界尺寸／颜色／深度辅助） | 否 | 无 |
| `js/core/PixiText.js` | 最小化模拟 Phaser `GameObjects.Text` 的链式 API；自身是一个 `PIXI.Container` | **是** — `js/core/PixiText.js:3` 出现 `PIXI.` | 无 |
| `js/core/Projection.js` | O 系列斜投影的全项目唯一投影住址（世界坐标 → 屏幕像素） | 否 | 无 |
| `js/core/PropEntity.js` | 道具实体类（`extends Entity`），draw/footprint/getBounds 经 propRegistry 分发 | 否 | 无 |
| `js/core/StickRenderer.js` | 读取 StickPuppet JSON 动画数据实时绘制角色；支持 human 与 dog 两种骨架 | 否（文件内无 `PIXI.`，也不 import 上表三文件；见口径局限） | 无 |
| `js/core/featureRegistry.js` | feature type → init 函数注册表（Z-2e） | 否 | 无 |
| `js/core/propDefaults.js` | 道具类型级默认值权威（含 `PROP_DEPTH` / `halfDepth`） | 否 | 无 |
| `js/core/propRegistry.js` | propType → 能力表（Z-2d） | 否 | 无 |
| `js/core/sceneData.js` | 场景 JSON 展开器 | 否 | 无 |
| `js/debug/MovementAudit.js` | 移动审计器，导出单例 `audit`；含 Y 分带表面标签 | 否 | 无 |
| `js/debug/WitnessDebugPanel.js` | 一次性调试工具：在游戏里制造接触事件、观察证词管线全过程 | 否 | 无 |
| `js/entity/building/BuildingEntity.js` | 俯视角「老街区」沿街楼实体，6 种原型 | 否 | 无 |
| `js/entity/building/building.js` | 建筑行为模块（独占写 `_leanLeft` / `_leanRight`） | 否 | 无 |
| `js/entity/building/buildingKinds.js` | 建筑 kind → tags 映射表（单一数据源） | 否 | 无 |
| `js/entity/building/drawBuilding.js` | 建筑绘制，统一线稿风格 | 否 | 无 |
| `js/entity/busstop/WaitForBusLayer.js` | 公交站乘客行为管理 | 否 | 无 |
| `js/entity/busstop/busstop.js` | 公交站 Smart Object（独占写 `_occupant`） | 否 | 无 |
| `js/entity/busstop/drawBusStopBay.js` | 港湾停靠区地面铺装绘制，走地面代理 | 否 | 无 |
| `js/entity/busstop/drawBusStopRoof.js` | 候车亭顶棚绘制（O-4 第一批转换） | 否 | 无 |
| `js/entity/busstop/drawBusStopSign.js` | 站牌绘制：一根杆 + 顶端一块牌子 | 否 | 无 |
| `js/entity/chess-table/chessTable.js` | 棋桌行为模块（`_slots` 的 reserved/ready/npc 字段） | 否 | 无 |
| `js/entity/chess-table/drawChessPlaza.js` | 棋局广场地面绘制，走地面代理 | 否 | 无 |
| `js/entity/chess-table/drawChessTable.js` | 棋桌绘制：桌面为悬空薄板（`baseH`），四条腿是线 | 否 | 无 |
| `js/entity/drain/drawDrain.js` | 排水沟绘制，纯贴地元素，走地面代理 | 否 | 无 |
| `js/entity/fountain/drawFountain.js` | 喷泉绘制：贴地水盘走地面代理，喷嘴+水柱走正面代理 | 否 | 无 |
| `js/entity/fountain/fountain.js` | 喷泉行为模块；`footprint()` 给落地接触面半宽/半深 | 否 | 无 |
| `js/entity/hydrant/drawHydrant.js` | 消防栓绘制：底座 + 主体 + 圆顶 + 顶栓 + 两侧出水口 | 否 | 无 |
| `js/entity/hydrant/hydrant.js` | 消防栓行为模块；`footprint()` 对应 `drawHydrant` 的 `baseW=30*s` | 否 | 无 |
| `js/entity/lamp/drawLamp.js` | 路灯绘制：底座／灯杆／灯箱三个体块 + 一条悬臂线 | 否 | 无 |
| `js/entity/mailbox/drawMailbox.js` | 邮筒绘制：立柱 + 悬空箱体 + 顶盖 | 否 | 无 |
| `js/entity/mailbox/mailbox.js` | 邮筒行为模块；`footprint()` 对应箱体 `bw=40*s` | 否 | 无 |
| `js/entity/manhole/drawManhole.js` | 井盖绘制（导出 `drawManhole(g, p)`） | 否 | 无 |
| `js/entity/mini-park/drawMiniPark.js` | 小绿地绘制，贴地，走地面代理 | 否 | 无 |
| `js/entity/newsrack/drawNewsRack.js` | 报刊架绘制：机身盒子 + 顶部檐口盒子 | 否 | 无 |
| `js/entity/newsrack/newsrack.js` | 报刊架行为模块；`footprint()` 对应 `w=70*s` | 否 | 无 |
| `js/entity/park-path/drawParkPath.js` | 公园小径与广场绘制（导出 `drawParkPaths` / `drawParkPlaza`） | 否 | 无 |
| `js/entity/phonebooth/drawPhoneBooth.js` | 电话亭绘制：机身走盒子模板 | 否 | 无 |
| `js/entity/phonebooth/phonebooth.js` | 电话亭行为模块；`footprint()` 对应 `w=80*s` | 否 | 无 |
| `js/entity/planter/drawPlanter.js` | 花箱绘制：本体走盒子，枝叶走正面广告牌 | 否 | 无 |
| `js/entity/planter/planter.js` | 花箱行为模块；`footprint()` 对应 `w=80*s` | 否 | 无 |
| `js/entity/props.all.js` | prop 类型注册 barrel（Z-2d，副作用 import 触发全部 `registerProp`） | 否 | 无 |
| `js/entity/seat/drawBench.js` | 长椅绘制（导出 `drawBench(g, p)`） | 否 | 无 |
| `js/entity/seat/drawBusStopBench.js` | 候车亭长椅绘制：座板为悬空薄板，腿是两条线 | 否 | 无 |
| `js/entity/seat/drawChairL.js` | 折叠椅（靠背在座面右侧，`d=-1`），转调 `drawChairSide` | 否 | 无 |
| `js/entity/seat/drawChairR.js` | 折叠椅（靠背在座面左侧，`d=+1`），转调 `drawChairSide` | 否 | 无 |
| `js/entity/seat/drawChairSide.js` | 棋桌折叠椅的合并实现，带 `d` 参数 | 否 | 无 |
| `js/entity/seat/seat.js` | 可坐道具行为模块（bench / chair 共用），含 `sitDown` | 否 | 无 |
| `js/entity/sign/drawSign.js` | 挂墙招牌绘制：薄板走盒子模板 | 否 | 无 |
| `js/entity/sign/sign.js` | 街道标牌行为模块；不阻挡，Y 排序偏移 +9 | 否 | 无 |
| `js/entity/stall/drawStall.js` | 摊位绘制：柜台贴地盒子 + 雨棚悬空盒子 + 中间支柱 | 否 | 无 |
| `js/entity/stall/stall.js` | 摊位行为模块；`footprint()` 对应 `w=290*s` | 否 | 无 |
| `js/entity/trash/drawTrash.js` | 垃圾桶绘制：桶身拉直成等宽盒子，收腰靠正面细节 | 否 | 无 |
| `js/entity/trash/trash.js` | 垃圾桶行为模块；`footprint()` 对应 `botW=30*s` | 否 | 无 |
| `js/entity/tree/drawTree.js` | 树绘制，统一线稿 | 否 | 无 |
| `js/entity/tree/tree.js` | 树行为模块；`footprint()` 对应 `trunkW≈20*s` | 否 | 无 |
| `js/entity/vehicle/CyclistSpawner.js` | 非机动车道动态出入场管理器 | 否 | 无 |
| `js/entity/vehicle/TrafficManager.js` | 车辆交通统一协调器 | 否 | 无 |
| `js/entity/vehicle/VehicleEntity.js` | 侧视车辆实体，kind 为 `car`/`taxi`/`bus`/`moto` | 否 | 无 |
| `js/entity/vehicle/VehicleStateMachine.js` | 单辆机动车行为状态机 | 否 | 无 |
| `js/entity/vehicle/drawBicycle.js` | 自行车／电动车绘制（导出 `drawBicycle` / `drawEbike`） | 否 | 无 |
| `js/entity/vehicle/drawVehicle.js` | 机动车绘制（导出 `drawVehicle(g, vehicle)`，含 `_bodyBox`） | 否 | 无 |
| `js/entity/vehicle/initVehicleSystem.js` | 车流系统一次性装配：TrafficManager + CyclistSpawner + BusStop + VehicleSpawner | 否 | 无 |
| `js/entity/vehicle/vehicle.js` | 车辆行为模块（含 `VEHICLE_DEPTH`） | 否 | 无 |
| `js/entity/vending/drawVending.js` | 自动贩卖机绘制：立体走盒子模板，正面细节走正面代理 | 否 | 无 |
| `js/entity/vending/vending.js` | 自动贩卖机行为模块 | 否 | 无 |
| `js/fx/ParticleEmitter.js` | 轻量 2D 粒子系统（注释写 for Phaser Graphics） | 否 | 无 |
| `js/fx/SmokeEmitter.js` | 香烟顶端升起的烟雾 | 否 | 无 |
| `js/main.js` | 游戏入口（PixiJS） | **是** — `js/main.js:10` 出现 `PIXI.`；`js/main.js:5` import `StreetScene.js` | 无 |
| `js/news/NewsArchive.js` | 文章存档；单一咽喉函数 `publishArticle` | 否 | 无 |
| `js/news/NewsBackflow.js` | 报道回流：按 `eventId` 把目击者分组互相补槽 | 否 | 无 |
| `js/news/NewsUI.js` | HTML overlay 成稿面板 + 存档面板 + 设置面板 | 否 | 无 |
| `js/news/providers.js` | vision / text / interrogate provider 层 | 否 | 无 |
| `js/npc/Athletes.js` | 健身人群；每个 runner 沿 `layout.walkPaths` 的一条路线往返／绕圈 | 否 | 无 |
| `js/npc/Chess.js` | 象棋对弈组（2 棋手 + 棋桌 + 两椅 + 旁观者）的 spawn | 否 | 无 |
| `js/npc/DogWalker.js` | 遛狗者 + 狗（绳索绑带系统）的 spawn | 否 | 无 |
| `js/npc/ExitRegistry.js` | 场景出口注册表（`findExit`） | 否 | 无 |
| `js/npc/LoiterBehavior.js` | Loiter 状态的微行为循环（从 BaseStateMachine 拆出） | 否 | 无 |
| `js/npc/Npc.js` | NPC 实体类（`extends Entity`），渲染委托给构造时注入的 StickRenderer | 否 | 无 |
| `js/npc/NpcProfile.js` | NPC 行为档案（纯数据模块），含各类型 `speedRange` | 否 | 无 |
| `js/npc/Pedestrians.js` | 普通行人的 spawn | 否 | 无 |
| `js/npc/despawn.js` | `npc.alive = false` 的唯一写入点 | 否 | 无 |
| `js/npc/npcUtil.js` | NPC 工厂工具，统一注入 renderer、默认 minY/maxY、随机初始帧 | 否 | 无 |
| `js/npc/props/BagProp.js` | 挂在 NPC 左手的包 | 否 | 无 |
| `js/npc/props/CigaretteProp.js` | `hand_r` 处的细棍 + 发光烟头 + 烟雾粒子 | 否 | 无 |
| `js/npc/props/LeashProp.js` | 从主人左手到狗颈锚点的绳线 | 否 | 无 |
| `js/npc/props/NpcProp.js` | 挂在 NPC 锚点上的视觉道具基类 | 否 | 无 |
| `js/npc/props/NpcPropManager.js` | NPC 视觉道具的生命周期管理器 | 否 | 无 |
| `js/npc/props/PhoneProp.js` | `phone_look` / `phone_call` 时画在 NPC 右手的小矩形 | 否 | 无 |
| `js/npc/props/SimpleProp.js` | 按 `AttachmentDefs` 的 draw 描述符绘制简单几何道具 | 否 | 无 |
| `js/scenes/SceneInitializer.js` | 场景初始化：infra 引导 + 按 `scene.json#features` 驱动 feature 初始化 | 否 | 无 |
| `js/scenes/SceneRenderer.js` | 天空 + 地面底图绘制 | 否 | 无 |
| `js/scenes/StreetScene.js` | 主场景（PixiJS 版）：2.5D 俯视角街道 + 统一 Entity 系统 + 取景框 + 拍照/发布 | **是** — `js/scenes/StreetScene.js:17` 出现 `PIXI.`；`:33` import `PixiText.js` | 无 |
| `js/scenes/drawSkyline.js` | 远景天际线平贴层 | 否 | 无 |
| `js/scenes/sceneFeatures.js` | 既有 spawn 函数 → featureRegistry 契约的包装层 | 否 | 无 |
| `js/ui/DebugOverlay.js` | 行为系统可视调试层（按 D 键切换） | 否 | 无 |

---

## 3. Godot 现有资产

### `assets/fromgodot/` 内容（git 追踪的 31 个文件）

**`assets/fromgodot/game-godot/`** — 一个可运行的 Godot 工程，追踪 12 个文件：

| 文件 | 说明 |
|------|------|
| `project.godot` | 工程配置 |
| `main.tscn` | 主场景 |
| `main.gd` | 主场景脚本，见下节 |
| `main.gd.uid` | Godot 4 的 UID 伴随文件 |
| `moebius_monochrome.gdshader` | 黑白 shader |
| `moebius_monochrome.gdshader.uid` | 同上的 UID |
| `filters/monochrome_clearline.tres` | 「黑白灰清线」滤镜材质 |
| `icon.svg` | 工程图标 |
| `README.md` | 自述：`This Godot project is a deliberately small composition and style test.` |
| `.gitignore` / `.gitattributes` / `.editorconfig` | 工程杂项 |

该工程的 3D 素材**不在 git 里**：`.gitignore:23-24` 明文忽略 `/assets/fromgodot/game-godot/assets/` 与 `/assets/fromgodot/game-godot/output/`（经 `git check-ignore -v` 确认）。这两个目录在工作区磁盘上存在，含 GLB + 贴图 PNG + `.import` 文件。所以克隆一份干净仓库拿不到 `main.gd:3-11` 那 9 个 `preload` 指向的文件。

**`assets/fromgodot/street-selected/`** — 18 个自包含 GLB 源模型 + 一份 `SOURCES.md`：
`Bench_Park`、`Bench_Street`、`Bicycle_Quaternius`、`Bin_Street`、`Bus_City`、`Bus_Shelter`、`Bus_Stop_Pole`、`Car_City`、`Chess_Table`、`Fire_Hydrant`、`Fountain_Town`、`Lamp_Street`、`News_Box`、`Phonebooth`、`Road_Sign_Set`、`Stall_Market`、`Traffic_Light`、`Vending_Drinks`。
`SOURCES.md:3` 自述这些是「经 Blender 打开检查外形、尺寸和可动部件后留下的**源模型**，供以后统一转换画风、确定摆位与人物接触点。尚未接入场景。」`SOURCES.md:5` 补充：全部 CC0，自包含 GLB，按米计量，地面接触点约为零，正面朝 +Z。

### `main.gd` 实际做了什么

`main.gd` 是一个 `extends Node3D`（`:1`）的脚本，它在 `_ready()`（`:23`）里调 `build_street_corner()`（`:26`），用**纯代码**搭出一个固定的街角场景，然后分两条路走：带 `--capture` 命令行参数时截一张图就退出（`:27-34`），否则建一个滤镜切换 UI 并停在交互模式（`:35-37`）。

场景搭建分五步（`:40-45`）。`build_environment()`（`:48-70`）建一个 `WorldEnvironment`（纯色天空 `bfcfd2`、filmic tonemap）加一盏 `DirectionalLight3D`（`:63`，角度 `(-49, -34, 0)`，开阴影）。`build_ground()`（`:73-89`）用 7 个 `BoxMesh` 硬编码出地面／楼前铺装／远人行道／远路缘／车道／近路缘／近人行道（`:74-80`），再用两个 `for` 循环铺出车道虚线（`:82-83`）和斑马线条（`:88-89`），另加两条路沿线（`:85-86`）——这些盒子的尺寸、位置、颜色全是字面量，没有任何配置文件。`build_architecture()`（`:92-101`）实例化三栋楼、两个花箱、五根系柱；`build_landscape()`（`:104-115`）放两棵树和四丛灌木。`build_camera()`（`:118-128`）建一台**正交**相机（`:121` `PROJECTION_ORTHOGONAL`，`:122` `size = 38.0`），放在 `(38, 31, 46)` 看向 `(0, 5.6, 6)`，并在相机下挂一个翻面的 `QuadMesh`（`:130-137`）当全屏 style pass——滤镜材质就是覆写这个 quad 的 `material_override`（`:158`）。

滤镜只有两档：`FILTER_NAMES`（`:12`）是 `["原色", "黑白灰清线"]`，`FILTER_MATERIALS`（`:13`）对应 `[null, preload("res://filters/monochrome_clearline.tres")]`。`set_filter()`（`:154-164`）换材质并在 index 为 0 时隐藏 quad。`_unhandled_key_input()`（`:167-177`）把数字键 0–9 映射成滤镜索引。注意 `main.gd:13` preload 的是 `filters/monochrome_clearline.tres`，而工程里另有一个 `moebius_monochrome.gdshader`——`main.gd` **没有**直接引用后者；两者是否有关联需要读 `.tres` 才能判定，本盘点未做。

截图路径：`settle_frames(24)`（`:216-219`）等 24 帧再等一次 `frame_post_draw`，`save_capture()`（`:222-232`）把 viewport texture 存成 PNG 写到 `res://output/`，成功打印 `WROTE_CAPTURE`，失败 `push_error`；`_ready()` 最后打印 `STREET_CORNER_STUDY_DONE` 并 `get_tree().quit()`（`:33-34`）。`--raw` 参数决定用原色还是黑白滤镜、以及输出文件名（`:29`、`:31`）。

两个工具函数：`add_asset()`（`:180-186`）实例化 PackedScene 并设位置/偏航；`add_box()`（`:189-200`）建带材质的 `BoxMesh` 并开投影，材质经 `get_material()`（`:203-213`）按颜色 HTML 串缓存复用。

**这个脚本不含任何 NPC、行为、动画或交互逻辑**——没有角色、没有每帧 `_process`，只有静态几何摆放、光照、正交相机和一个全屏滤镜 quad。它与 `README.md` 自述的「composition and style test」一致。
