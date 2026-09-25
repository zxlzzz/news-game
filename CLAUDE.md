# News Game — 项目指南

街头新闻游戏：先做一个可复用的街道社会模拟（火柴人 NPC 自主行动），再在上面做"拍照 → 写报道 → 报道改变目击者记忆"的玩法。
游戏工程在 `godot/`（Godot 4.7.2，Forward+）。旧的 PixiJS 版（`js/`）已于 2026-09-25 删除，需要时查 git 历史。

## 从哪看起

| 文件 | 内容 |
|---|---|
| `godot/README.md` | **入口**：怎么运行、截图、跑检查；目录说明；街道 demo 现状 |
| `docs/scene_spec.md` | 场景规格：一个场景 = 一个文件夹，文件只记推不出来的 |
| `docs/建模规范与参数.md`、`godot/modeling/模型制作说明.md`、`godot/素材清单.md` | 模型要求和要做的模型（模型由 ChatGPT 做，这边只审） |
| `docs/design_route_npc_behavior.md`、`docs/design_route_npc_motion_supply.md`、`docs/design_route_animal_motion.md`、`docs/anim.md` | NPC 行为、人和动物动作的设计路线 |
| `docs/design-plans/npc-skeleton-mapping.md` | 火柴人映射规则和参数（唯一来源） |
| `assets/动作生成任务清单.md`、`assets/动作素材清单.md` | Kimodo 动作素材的任务队列和已交付情况 |
| `memory.md` | 跨会话备忘（英文），只在 Hsinlung 说"更新memo"时改 |

其他：`docs/巴别塔圣歌-游戏实拍/` 是画风参考截图（图不进 git，按 `来源.txt` 重新下载）；`assets/`、`scripts/`、`sth/` 是做动作素材和研究用的，游戏运行时不读。

## 规矩

- 文件只记推不出来的，其余由代码推导；数值放 JSON / `.tres`，不写死在代码里。
- 数据有错（材质没映射、动作名写错、走不到的区域……）直接报错退出，不兜底、不静默跳过。
- 模型：单位米、原点在底面接地点、正面朝 +Z、材质名即色槽名、只等比缩放；类型根节点不带缩放，缩放在子节点 `model` 上。每个模型配一个能重跑出同一 glb 的 `build_<名字>.py`。
- 画风（灰度、描线）只在运行时套，不烘焙进模型。
- 不要自己改 `scenes/street_demo`，除非 Hsinlung 要求。

## 检查（都在 `godot/` 下）

- `godot --headless --path . -s res://tools/check_mapping.gd` → `MAPPING_OK`
- `godot --headless --path . -s res://tools/check_locomotion.gd` → `LOCOMOTION_OK`
- `python modeling/check_model.py <glb>` → `PASS`
- `godot` = `D:/Godot/Godot_v4.7.2-stable_win64_console.exe`；跑 Godot 要在 Hsinlung 给的授权范围内（见 `memory.md`「Running the game」）。

## 工作方式

- 需求先一起分析，再出方案；拿不准的列出来问，不猜。
- 不自动提交，等 Hsinlung 说了再 commit；分支用 `claude/` 前缀。
- 回复用简短的中文；技术细节写进文档。他看画面验收，汇报"画面变了什么、该看哪里"。
- 新装的软件放 D 盘，装之前先问。
- 第三方模型库（Quaternius Downtown / Stylized Nature）已从仓库删掉；需要时原始下载在 `D:\Godot\assets\`，或到 quaternius.com 下载。
