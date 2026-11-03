# News Game — 项目指南

街头新闻游戏：先做一个可复用的街道社会模拟（火柴人 NPC 自主行动），再在上面做"拍照 → 写报道 → 报道改变目击者记忆"的玩法。
游戏工程在 `godot/`（Godot 4.7.2，Forward+）。旧的 PixiJS 版（`js/`）已于 2026-09-25 删除，需要时查 git 历史。

## 从哪看起

| 文件 | 内容 |
|---|---|
| `docs/README.md` | 按主题找文档：动作与模型制作、NPC 行为、场景与寻路、画风参考 |
| `godot/README.md` | 运行、查看动作／模型、截图、跑检查和工程目录 |
| `docs/asset-production/README.md` | 制作区入口：规范、方法、素材清单、反思；模型由 ChatGPT 制作、Claude 审查 |
| `docs/asset-production/models/建模规范与参数.md`、`docs/asset-production/models/模型制作说明.md`、`docs/asset-production/素材清单.md` | 模型要求、制作步骤和素材需求 |
| `docs/asset-production/motions/npc-skeleton-mapping.md` | 已确认的火柴人映射基线规则和参数的唯一来源 |
| `docs/asset-production/motions/动作生成任务清单.md`、`docs/asset-production/motions/动作素材清单.md` | 人体动作生成任务与已有素材；制作方法见制作区入口 |
| `docs/behavior-system/README.md` | NPC 行为设计、动作语义、独立文字原型和实现报告 |
| `docs/scenes/scene_spec.md`、`docs/scenes/two-streets.md`、`docs/scenes/walk-grid-layers.md` | 场景规格、两条街的布局与镜头、分层可走网格 |
| `godot/npc/clip-setup.json`、`godot/scenes/empty_ground/` | 动作需要的位置、配件和另一人；在空地逐条看动作、拖动调整相对位置，用法见 `godot/README.md`“空地” |
| `docs/scenes/scene_reconstruction_workflow.md`、`research/sdu_weihai/复刻记录.md` | 真实地点制作的三步流程；山大威海校区每步的资料、做法和缺口 |
| `memory.md` | 跨会话备忘，只在 Hsinlung 要求“更新memo”时修改 |

其他：`docs/visual-reference/` 是画风参考截图（图不进 git，按 `来源.txt` 重新下载）；`assets/`、`scripts/`、`sth/` 是做动作素材和研究用的，游戏运行时不读。`delivery/` 是 ChatGPT 交货的暂存处（放法见 `delivery/README.md`）：检查通过的搬到正式位置并从这里删掉。

## 规矩

- 文件只记推不出来的，其余由代码推导；数值放 JSON / `.tres`，不写死在代码里。
- 数据有错（材质没映射、动作名写错、走不到的区域……）直接报错退出，不兜底、不静默跳过。
  - 唯一的例外是"缺东西"：`npc/clip-setup.json` 里一条动作的声明引用的物件类型（没有类型提供那种 `post_<种类>`）、配件类型、另一人的动作文件还不存在时，不退出：空地列表里照样显示、灰掉并写明缺什么，游戏里这条动作不进候选。其余数据错误照旧报错退出。
- 位置信息只写一处，写在不动的那一方身上：人在物件上的站位 → 物件类型的 `post_<种类>` 标记；配件在手里 → `types/held_<名>.tscn` 的 `model` 偏移；两人之间 → `clip-setup.json` 的 `partner`。动作的声明只写名字，不写几何。
- 模型：单位米、原点在底面接地点、正面朝 +Z、材质名即色槽名、只等比缩放；类型根节点不带缩放，缩放在子节点 `model` 上。每个模型配一个能重跑出同一 glb 的 `build_<名字>.py`。
- 画风（灰度、描线）只在运行时套，不烘焙进模型。
- 不要自己改 `scenes/street_demo`，除非 Hsinlung 要求。

## 检查（都在 `godot/` 下）

- `godot --headless --path . -s res://tools/check_mapping.gd` → `MAPPING_OK`
- `godot --headless --path . -s res://tools/check_locomotion.gd` → `LOCOMOTION_OK`
- `godot --headless --path . -s res://tools/check_animals.gd` → `ANIMALS_OK`（猫、狗的原地动作和行为）
- `godot --headless --path . -s res://tools/check_walk_grid.gd` → `WALK_GRID_OK`（测试场景 `scenes/walk_grid_test/`：桥、台阶、路沿、栏杆等；另查 street_demo、two_streets 能建网格）
- `godot --headless --path . -s res://tools/check_camera.gd` → `CAMERA_OK`（能转的镜头）
- `godot --headless --path . -s res://tools/check_behaviour.gd` → `BEHAVIOUR_OK`（两条街的行为表：各种行为都有人做）
- `godot --headless --path . -s res://tools/check_empty_ground.gd` → `EMPTY_GROUND_OK`（空地 `scenes/empty_ground/`：列表里每一项逐条摆一遍、播一遍，缺东西的打印出来）
- `python modeling/check_model.py <glb>` → `PASS`
- `godot` = `D:/Godot/Godot_v4.7.2-stable_win64_console.exe`；跑 Godot 要在 Hsinlung 给的授权范围内（见 `memory.md`「Running the game」）。

## 工作方式

- 需求先一起分析，再出方案；拿不准的列出来问，不猜。
- 不自动提交，等 Hsinlung 说了再 commit；分支用 `claude/` 前缀。
- 回复用简短的中文；技术细节写进文档。他看画面验收，汇报"画面变了什么、该看哪里"。
- 新装的软件放 D 盘，装之前先问。
- 第三方模型库（Quaternius Downtown / Stylized Nature）已从仓库删掉；需要时原始下载在 `D:\Godot\assets\`，或到 quaternius.com 下载。
