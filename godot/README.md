# godot/ — 游戏工程（Godot 4.7.2，Forward+）

场景规格见仓库 `docs/scene_spec.md`，模型要求见 `modeling/模型制作说明.md`（依据 `docs/建模规范与参数.md`），要做的素材见 `素材清单.md`。
2026-09-23 起取代 `sth/godot-npc/`（已删除，历史在 git 里）。

## 运行

`godot` 指 `D:/Godot/Godot_v4.7.2-stable_win64_console.exe`（带 `_console` 的才能在终端看到输出）。都在本目录下执行。

| 做什么 | 命令 |
|---|---|
| 编辑器打开 | `godot --path . -e`（第一次打开会导入模型） |
| 看街道 demo | `godot --path .`；方向键 / A、D / 按住左键拖动，左右平移镜头 |
| 看两条街 | `godot --path . res://scenes/two_streets/level.tscn`；WASD / 方向键 / 按住左键拖动平移，按住中键拖动转视角和俯仰，滚轮缩放（`core/orbit_camera.gd`，数值 `core/camera-params.json`） |
| 截一帧图后退出 | `godot --path . -- --shot <png 绝对路径>`；可加 `--shot-after <秒>`（先跑一会儿）、`--pan <米>`（镜头平移）、`--size <米>`（画面高多少米，默认 42，越小越近）、`--top <画面高度米> [--top-z <z>]`（正上方俯视，查布局）。能转视角的场景（`orbit_camera.gd`）用 `--look <x> <z>`（注视点）、`--yaw <度>`、`--pitch <度>`（90 = 正俯视）、`--size <米>` |
| 只导入模型 | `godot --headless --path . --import` |
| 打印各物件类型尺寸 | `godot --headless --path . -s res://tools/print_bounds.gd` |
| 检查一个模型是否合规 | `python modeling/check_model.py <glb>` → `PASS` / `FAIL` |
| 火柴人映射对拍 | `godot --headless --path . -s res://tools/check_mapping.gd` → `MAPPING_OK` / `MAPPING_FAIL` |
| 狗、鸽子、骑车、牵狗检查 | `godot --headless --path . -s res://tools/check_locomotion.gd` → `LOCOMOTION_OK` / `LOCOMOTION_FAIL` |
| 可走区域检查（桥上桥下、台阶、路沿、栏杆） | `godot --headless --path . -s res://tools/check_walk_grid.gd` → `WALK_GRID_OK`；用 `scenes/walk_grid_test/`（方块拼的测试场景），再确认 street_demo 和 two_streets 能建出网格、两条街之间走得通 |
| 能转的镜头检查 | `godot --headless --path . -s res://tools/check_camera.gd` → `CAMERA_OK`（模拟鼠标：缩放、拖动平移、单击不动、中键转动和俯仰限位） |
| 行为统计（两条街） | `godot --headless --path . -s res://tools/check_behaviour.gd` → `BEHAVIOUR_OK`（模拟 5 分钟，打印每 10 秒各行为人数和各行为开始次数；场景里每种位置都要有人用过） |
| 看狗、鸽子、骑车、牵狗 | `godot --path . --resolution 960x640 res://tools/locomotion_review.tscn -- --mode dog\|pigeon\|leash\|bicycle\|scooter`（参数见脚本开头） |
| 录成动图 | `python tools/record_review.py <输出目录> [mode ...]` |
| 看猫、狗的原地动作和行为 | `godot --path . res://tools/animal_review.tscn -- --species dog\|cat --breed small\|medium\|large --action sit\|…\|behaviour`（参数见脚本开头）；检查 `godot --headless --path . -s res://tools/check_animals.gd` → `ANIMALS_OK`；录动图 `python tools/record_animals.py` |

## 目录

| 位置 | 内容 | 规格对应 |
|---|---|---|
| `scenes/<场景>/level.tscn` | 地面带 + 物件实例；指向配色、视角、人口 | §1 |
| `scenes/<场景>/view.tscn` | 相机 + 方向光。相机二选一：`core/pan_camera.gd`（只能左右平移，street_demo）或 `core/orbit_camera.gd`（平移、转、缩放，两条街和测试场景）；相机在 view.tscn 里的位置就是起始视角 | §1 |
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
| `npc/` | 火柴人：映射移植、播放、77 条动作数据、对拍参考值；程序生成的狗、鸽子、骑车的人、牵狗的人（见下） | |
| `models/` | 场景用到的 glb | |
| `modeling/` | 给建模方（ChatGPT）的说明、自检脚本 `check_model.py`、建模脚本范例；交来的 `build_<名字>.py` 也放这里，glb 放 `models/` | |
| `tools/` | 检查脚本；`dequantize_glb.mjs` 把 Godot 不认的压缩网格格式解开 | |
| `docs/npc_path_report.md` | 火柴人最小通路报告（09-22，原 `sth/godot-npc/NPC_PATH_REPORT.md`，里面的路径是旧的） | |

## 几个约定

- 类型的根节点不带缩放，缩放写在子节点 `model` 上。原因：关卡里一移动实例，编辑器会把根节点的整个变换（含缩放）存进关卡，类型里的缩放就被覆盖了。这是对规格"类型从 glb 继承"的具体做法。
- 关卡里的类型实例改了缩放，运行时报错退出（§4）。
- 地面带从 z = 0 开始往 +Z（朝镜头）一条条排，沿 X 居中；楼放在 z < 0，正面朝 +Z。
- 材质没映射到色槽、配色缺色槽颜色，运行时都报错，不兜底。
- 分组 `size_jitter` 的物件（树、灌木、石头）按所在位置算一个固定的缩放，幅度在 `core/level-params.json`（现在 ±12%）。
- 编辑器里看到的是模型原色；画风只在运行时套上。

## 狗、鸽子、骑车、牵狗（程序生成）

姿势每帧由代码算，不播动作文件；所有数值在 JSON 里，代码里不写。

| 文件 | 做什么 |
|---|---|
| `npc/procedural_dog.gd` + `dog-params.json` | 狗：步态（走 / 小跑按速度切换）、姿势、黑色剪影。脚着地不滑、腿长不变；腿够不着时身体先慢下来并提早换脚 |
| `npc/procedural_pigeon.gd` + `pigeon-params.json` | 鸽子：走（头停住、身体走过去、再往前一探，每步一次）、站着转头张望、啄地、蹦到指定点（可上下路沿）、起飞 / 飞 / 滑翔 / 落地（落前抬身刹车、放腿）、黑色剪影。脚着地不滑、腿长不变。翅膀形状来自 `pigeon-wings.json`（收起、滑翔、一次扑翅），由 `scripts/export_pigeon_wings.py` 从公有领域鸽子 `assets/rigs/pigeon/bird.blend` 取出，不手改 |
| `npc/animal_actions.gd` + `animal-actions.json`、`animal-breeds.json` | 狗的原地动作（坐、趴、侧躺、嗅地、抖毛、挠痒、抬腿、摇尾、蹲坐等人），每个有"走 → 进入 → 保持 → 起身走"的过渡；三种体型（小 / 中 / 大）只换参数。第五批由 ChatGPT 做，效果图在 `../assets/animation_checks/animals/` |
| `npc/procedural_cat.gd` + `cat-params.json` | 猫：走、小跑、坐、揣手趴、侧躺、舔毛、伸懒腰、跳上跳下矮台 |
| `npc/animal_controller.gd` | 流浪狗和猫的行为：走走停停、有人靠近就走开、猫见狗弓背或跑开；纯函数，输入自身和附近的人和动物，输出想要的速度、朝向和原地动作。还没接进街道 |
| `npc/rider.gd` + `rider-params.json` | 骑车的人：按车给的接触点现算——胯在车座上、手在车把上、脚在脚踏/踏板上，身体前倾由车把位置推出；蹬车时曲柄跟轮子转，不蹬时滑行、脚踏回到水平；转弯时连人带车倾斜。车的类型可以覆盖其中的参数（`rider_style`） |
| `npc/dog_walker.gd` + `leash-params.json` | 牵狗的人：人按走过的距离播 `walk_dog`、停下时渐变到 `stand_idle`；狗跟在牵绳手那一侧；绳子快绷紧时人放慢，绳子只负责画（松了下垂，紧了拉直），不拖动任何一方 |
| `npc/clip_pose.gd` | 任一动作按"走过的距离"原地播放（去掉动作自带的前进量），供导航驱动的人用 |
| `npc/ink_figure.gd` | 画上面这些：等宽圆头线、朝向镜头的实心圆、实心三角，和火柴人同一个线条 shader |
| `npc/body-types.json` | 体型缩放（成人 3 倍） |

效果图和动图在 `../assets/animation_checks/godot_supply/README.md` 的"狗、牵狗、骑车"和"鸽子"两节。

## 街道 demo（`scenes/street_demo/`，2026-09-24）

一条 125 米的街和对面的公园，布局照旧项目 `assets/scene.json` 换算成米：11 栋临街楼、人行道设施、两个公交站、斑马线和路面标线、路边停着的车；公园里有环形小径、棋桌广场、喷泉小园、摊位、长椅、树和灌木。地面比楼长（150 米），镜头平移到头也不露空。

人由 `npc/crowd.gd` 放，关卡文件里不写人，也不写路线：
- **哪里能走、能骑**由 `core/walk_grid.gd` 从关卡推出来（规格 §3），分上下层：每格竖着看记下所有朝上的面（地面带、铺装、桥面、台阶、屋顶……）的高度和色槽，头顶 `clearanceHeight` 以内还有东西的面（长椅下、广场板下）不能站；相邻格的面高差不超过一级台阶（`crowd-params.json` 的 `grid.maxStep`，走 0.25 米、骑 0.05 米）、中间没有栏杆墙壁挡着才连通，所以桥上桥下分得开、台阶一级级能上、骑车不上路沿；离边缘、落差、墙 `clearance` 以内的面不用。斑马线（分组 `crosswalk`）把它压着的、人不能走的带在它的宽度上切成可走；贴花（分组 `marking`）不算面也不挡路；铺装（分组 `paving`：小径、广场、桥、台阶）是给人走的，走不到就报错。每种地面在"走 / 骑"两种方式下的代价在 `core/walk_costs.json`，表里没有的就不能用（自行车道有自己的色槽 `bike_lane`，只给骑车用）。路径用 AStar3D 算，路径点带所站面的高度；狗的脚和牵绳按 `height_at` 落在所站的面上。规格里提的 NavigationRegion3D 不用，原因写在 `walk_grid.gd` 开头。
- **自由走动的人**（数量在 `population.tres`）从能走区域碰到地面两端的地方进来，去几处随机的人行道或铺装，再从另一端离开；骑车的人靠右走自己那条车道。路人随机用 `walk` / `walk_slow` / `phone_walk` / `eat_walk`，按走过的距离播放。
- **固定岗位的人**跟着物件：类型库里的 `post_<种类>` 标记（长椅和公交站的座位、摊位后面和前面、棋凳、棋桌旁），有没有人、播什么动作在 `npc/crowd-params.json`。
- 数据有错就报错退出，和 `core/level.gd` 一样，不跳过：动作名写错；某一端没有入口，或入口走不到另一端；有一块人行道或铺装被物件围死、从入口走不到（小于 `crowd-params.json` 里 `grid.pocketArea` 平方米的小角落不算）；参与的物件的材质经材质映射后不是色槽；放了斑马线却没有地面带。随机目的地只从入口走得到的地方挑。
- 遛狗的人牵绳的手不固定：狗在背对镜头那一侧超过 `leash-params.json` 的 `switchSideAfter` 秒，就换手（姿势左右镜像），狗到靠镜头的一侧，不被人挡住。
- 推出来的可走区域见 [docs/street_demo_walk_grid.png](docs/street_demo_walk_grid.png)（每层一组：最下面那层面在最上，下一组是再往上一层，每组先走后骑；白 = 代价 1，灰 = 更贵，黑 = 不能用或这层没有面）。改了布局重画一张：`godot --headless --path . -s res://tools/walk_grid_image.gd -- res://scenes/street_demo/level.tscn <png 绝对路径>`。

**可走网格缓存**：已做（2026-09-27），见下面"两条街"一节。斑马线也已能切道路模块。

**道路模块合并描线**（2026-09-26 已做，`core/level.gd` 的 `_merge_road_modules`）。道路模块不带厚度、拼接面上不封口（见 `素材清单.md` 第六批"一、道路模块"），单独描线的话每块两端的开口边都会画成横线。摆好后把所有道路模块合成一个网格再建描线，拼接处焊在一起，这些边就成了共面边，不再画线。
- 道路 glb 导入时要关网格压缩（`.import` 里 `meshes/force_disable_compression=true`），否则 Godot 内部压缩会把顶点挪零点几毫米，焊不上。

简化了的地方（够 demo 用，以后要再改）：人和人之间不避让；进出只在地面两端，还没有门；车停着不开；公交站有人坐、没人上车。

## 两条街（`scenes/two_streets/`，2026-09-27）

布局和镜头的要求见 `docs/design-plans/two-streets.md`。布局由 `tools/two_streets_layout.py` 按规则生成 `level.tscn`（重跑会覆盖在编辑器里的手改）。两条 200 米的街（道路模块拼成），中间 60 米的街区两排楼背靠背、各朝自己那条街，中间院子；街区东头一条横路，中间两条小巷；一侧商业楼，一侧公园，公园两头是影院和超市。镜头 `core/orbit_camera.gd`（平移、转、俯仰、缩放）。

- **地面**：街区、商业区的地面带放在 y = 0.15，和人行道齐平（楼和院子都立在上面）；公园在 y = 0。一个场景可以有几条地面带（只能平移）。
- **斑马线**铺在道路模块上：模型的条纹沿它的 Z 方向（顺着车流），人沿它的 X 方向过街；在两条街上转 90° 摆，三块拼满 13 米的车道加非机动车道。`walk_grid.gd` 从路沿到路沿切开车道（`_cut_crossing_faces`）。旧街道 demo 里的斑马线摆反了（条纹顺着过街方向），没改。
- **骑车的**在路口借机动车道（`walk_costs.json` ride 里 road 代价 3），平时走非机动车道。
- **人**：`population.tres` 里 `behaviour = true`，路人由行为表驱动（`npc/behaviour.gd`、`npc/behaviour-table.json`、`npc/behaviour-people.json`，说明在 `docs/design_route_npc_behavior.md` 开头）。长椅、公交站、摊位、棋桌的位置由路人自己去占，不再按概率摆人。
- **可走网格缓存**已做：`walk_grid.gd` 的 `_fingerprint` / `_load` / `save()`，存在 `user://walk_grid/<场景名>.bin`。这个场景建一次约 11 秒，读缓存约 1 秒；改了场景、类型、模型、导入设置、代价表或网格代码都会自动重建。
- **背景**（`Backdrop` 节点，分组 `backdrop`）：四周各延伸 100 米的地面和两条街、行道树，只画不走：可走网格不读它，镜头的注视点也不越过场景本身。
- **街面**：路边停车（不开），每处斑马线两头有红绿灯和行人信号灯。院子的地面用人行道的颜色，小巷是水泥色，看得出巷子。
- **帧率**：这台机器 1600×900 窗口约 60 帧（100 个路人加骑车、遛狗、慢跑）。做了三件事：开场把不动的物件按 40 米一块、按材质合成大网格（`level.gd` 的 `_merge_static`，`level-params.json` 的 `mergeTile`，绘制调用从约 1.3 万降到约 1300）；画面外的人不重建网格（`crowd-params.json` 的 `offScreenMargin`）；镜头拉远时人的姿势隔几帧才重建一次、轮流进行（`redrawMetres`）。路人的行为每帧只算一次，狗和骑车的仍按 1/60 秒小步算。打开约 6 秒（可走网格有缓存时）。


## 现在还没做

门（从楼里进出）、人与人避让、车辆行驶。
