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
| `docs/design-plans/two-streets.md` | 两条街大场景的要求：镜头操作、布局、先做的技术项（场景在 `godot/scenes/two_streets/`） |
| `godot/npc/clip-setup.json`、`godot/scenes/empty_ground/` | 动作要什么（位置、配件、另一人）；空地：一条条看动作、拖着调相对位置（说明在 `godot/README.md`"空地"） |
| `assets/动作生成任务清单.md`、`assets/动作素材清单.md` | Kimodo 动作素材的任务队列和已交付情况 |
| `docs/scene_reconstruction_workflow.md`、`research/sdu_weihai/复刻记录.md` | 照真实地点做场景的三步流程；山大威海校区的做法和每步所需信息（场景 `godot/scenes/sdu_weihai/`，脚本 `godot/real_place/`） |
| `memory.md` | 跨会话备忘（英文），只在 Hsinlung 说"更新memo"时改 |

其他：`docs/巴别塔圣歌-游戏实拍/` 是画风参考截图（图不进 git，按 `来源.txt` 重新下载）；`assets/`、`scripts/`、`sth/` 是做动作素材和研究用的，游戏运行时不读。`delivery/` 是 ChatGPT 交货的暂存处（放法见 `delivery/README.md`）：检查通过的搬到正式位置并从这里删掉。

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
