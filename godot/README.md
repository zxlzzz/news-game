# godot/ — 游戏工程（Godot 4.7.2，Forward+）

场景规格见仓库根目录 `scene_spec.md`，模型要求见 `modeling/模型制作说明.md`（依据 `建模规范与参数.md`），要做的素材见 `素材清单.md`。
2026-09-23 起取代 `sth/godot-npc/`（已删除，历史在 git 里）。

## 运行

`godot` 指 `D:/Godot/Godot_v4.7.2-stable_win64_console.exe`（带 `_console` 的才能在终端看到输出）。都在本目录下执行。

| 做什么 | 命令 |
|---|---|
| 编辑器打开 | `godot --path . -e`（第一次打开会导入模型） |
| 看街道 demo | `godot --path .`；方向键 / A、D / 按住左键拖动，左右平移镜头 |
| 截一帧图后退出 | `godot --path . -- --shot <png 绝对路径>`；可加 `--shot-after <秒>`（先跑一会儿）、`--pan <米>`（镜头平移）、`--top <画面高度米> [--top-z <z>]`（正上方俯视，查布局） |
| 只导入模型 | `godot --headless --path . --import` |
| 打印各物件类型尺寸 | `godot --headless --path . -s res://tools/print_bounds.gd` |
| 检查一个模型是否合规 | `python modeling/check_model.py <glb>` → `PASS` / `FAIL` |
| 火柴人映射对拍 | `godot --headless --path . -s res://tools/check_mapping.gd` → `MAPPING_OK` / `MAPPING_FAIL` |
| 狗、骑车、牵狗检查 | `godot --headless --path . -s res://tools/check_locomotion.gd` → `LOCOMOTION_OK` / `LOCOMOTION_FAIL` |
| 看狗、骑车、牵狗 | `godot --path . --resolution 960x640 res://tools/locomotion_review.tscn -- --mode dog\|leash\|bicycle\|scooter`（参数见脚本开头） |
| 录成动图 | `python tools/record_review.py <输出目录> [mode ...]` |

## 目录

| 位置 | 内容 | 规格对应 |
|---|---|---|
| `scenes/<场景>/level.tscn` | 地面带 + 物件实例；指向配色、视角、人口 | §1 |
| `scenes/<场景>/view.tscn` | 相机（`core/pan_camera.gd`，可左右平移）+ 方向光 | §1 |
| `scenes/<场景>/population.tres` | 各类自由走动的人的数量：路人、慢跑、遛狗、骑自行车、骑电动车 | §1 |
| `palettes/*.tres` | 配色（可被多个场景共用）；现在只有 `gray.tres` 黑白灰 | §1 |
| `types/*.tscn` | 物件类型库：外层节点（标签 = 节点分组）+ 子节点 `model`（glb，缩放在这里设） | §2 |
| `core/slots.tres` | 全局色槽及其标记 | §2 |
| `core/material_maps/*.tres` | 第三方材质名 → 色槽，一个素材包一份 | §2 |
| `core/style.tres` | 全局画风参数 | §2 |
| `core/level.gd` | 关卡根节点：运行时检查规矩、算推导量、放人（`npc/crowd.gd`）、上画风、放相机和光 | §3、§4 |
| `core/ground_strip.gd` / `ground_band.gd` | 地面带节点（编辑器里改了立刻重建） | §1 |
| `core/bounds.gd` | 物件尺寸 = 模型包围盒 | §3 |
| `core/two_wheeler.gd` | 可骑的车（`types/bicycle.tscn`、`scooter.tscn`）：按节点名从模型读车座/车把/脚踏，转轮子和曲柄 | §2、§3 |
| `style/` | 画风 shader 和抽线代码（从 sth/godot-npc 原样搬来，只改了颜色输入格式） | |
| `npc/` | 火柴人：映射移植、播放、77 条动作数据、对拍参考值；程序生成的狗、骑车的人、牵狗的人（见下） | |
| `models/` | 场景用到的 glb | |
| `modeling/` | 给建模方（ChatGPT）的说明、自检脚本 `check_model.py`、建模脚本范例；交来的 `build_<名字>.py` 也放这里，glb 放 `models/` | |
| `tools/` | 检查脚本；`dequantize_glb.mjs` 把 Godot 不认的压缩网格格式解开 | |
| `docs/npc_path_report.md` | 火柴人最小通路报告（09-22，原 `sth/godot-npc/NPC_PATH_REPORT.md`，里面的路径是旧的） | |

## 几个约定

- 类型的根节点不带缩放，缩放写在子节点 `model` 上。原因：关卡里一移动实例，编辑器会把根节点的整个变换（含缩放）存进关卡，类型里的缩放就被覆盖了。这是对规格"类型从 glb 继承"的具体做法。
- 关卡里的类型实例改了缩放，运行时报错退出（§4）。
- 地面带从 z = 0 开始往 +Z（朝镜头）一条条排，沿 X 居中；楼放在 z < 0，正面朝 +Z。
- 材质没映射到色槽、配色缺色槽颜色，运行时都报错，不兜底。
- 分组 `size_jitter` 的物件（树、灌木、石头）按所在位置算一个固定的 ±12% 缩放。
- 编辑器里看到的是模型原色；画风只在运行时套上。

## 狗、骑车、牵狗（程序生成）

姿势每帧由代码算，不播动作文件；所有数值在 JSON 里，代码里不写。

| 文件 | 做什么 |
|---|---|
| `npc/procedural_dog.gd` + `dog-params.json` | 狗：步态（走 / 小跑按速度切换）、姿势、黑色剪影。脚着地不滑、腿长不变；腿够不着时身体先慢下来并提早换脚 |
| `npc/rider.gd` + `rider-params.json` | 骑车的人：按车给的接触点现算——胯在车座上、手在车把上、脚在脚踏/踏板上，身体前倾由车把位置推出；蹬车时曲柄跟轮子转，不蹬时滑行、脚踏回到水平；转弯时连人带车倾斜。车的类型可以覆盖其中的参数（`rider_style`） |
| `npc/dog_walker.gd` + `leash-params.json` | 牵狗的人：人按走过的距离播 `walk_dog`、停下时渐变到 `stand_idle`；狗跟在牵绳手那一侧；绳子快绷紧时人放慢，绳子只负责画（松了下垂，紧了拉直），不拖动任何一方 |
| `npc/clip_pose.gd` | 任一动作按"走过的距离"原地播放（去掉动作自带的前进量），供导航驱动的人用 |
| `npc/ink_figure.gd` | 画上面这些：等宽圆头线、朝向镜头的实心圆、实心三角，和火柴人同一个线条 shader |
| `npc/body-types.json` | 体型缩放（成人 3 倍） |

效果图和动图在 `../assets/animation_checks/godot_supply/README.md` 的"狗、牵狗、骑车"一节。

## 街道 demo（`scenes/street_demo/`，2026-09-24）

一条 125 米的街和对面的公园，布局照旧项目 `assets/scene.json` 换算成米：11 栋临街楼、人行道设施、两个公交站、斑马线和路面标线、路边停着的车；公园里有环形小径、棋桌广场、喷泉小园、摊位、长椅、树和灌木。地面比楼长（150 米），镜头平移到头也不露空。

人由 `npc/crowd.gd` 放，关卡文件里不写人，也不写路线：
- **哪里能走、能骑**由 `core/walk_grid.gd` 从关卡推出来（规格 §3）：地面带的色槽定每条带的地面，铺装物件（分组 `paving`：小径、广场）按模型实际的地面形状盖在上面，斑马线（分组 `crosswalk`）把它压着的、人不能走的带在它的宽度上切成可走，其余物件按贴近地面的部分挖成障碍再留出人身宽度；贴花（分组 `marking`）不挡路。每种地面在"走 / 骑"两种方式下的代价在 `core/walk_costs.json`，表里没有的就不能用（自行车道有自己的色槽 `bike_lane`，只给骑车用）。路径用 AStarGrid2D 算；规格里提的 NavigationRegion3D 不用，原因写在 `walk_grid.gd` 开头。
- **自由走动的人**（数量在 `population.tres`）从能走区域碰到地面两端的地方进来，去几处随机的人行道或铺装，再从另一端离开；骑车的人靠右走自己那条车道。路人随机用 `walk` / `walk_slow` / `phone_walk` / `eat_walk`，按走过的距离播放。
- **固定岗位的人**跟着物件：类型库里的 `post_<种类>` 标记（长椅和公交站的座位、摊位后面和前面、棋凳、棋桌旁），有没有人、播什么动作在 `npc/crowd-params.json`。
- 数据有错（动作名写错、某一端没有入口、入口走不到另一端）就报错退出，和 `core/level.gd` 一样，不跳过。
- 看推出来的可走区域：`godot --headless --path . -s res://tools/walk_grid_image.gd -- res://scenes/street_demo/level.tscn <png 绝对路径>`。

简化了的地方（够 demo 用，以后要再改）：人和人之间不避让；进出只在地面两端，还没有门；车停着不开；公交站有人坐、没人上车。

## 现在还没做

门（从楼里进出）、人与人避让、车辆行驶。
