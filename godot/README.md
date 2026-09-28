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
| 空地：一条条看动作（人、狗、牵狗、鸽子、猫、自行车、电动车） | `godot --path . res://scenes/empty_ground/level.tscn`；见下面"空地"一节 |
| 空地截图 | `godot --path . res://scenes/empty_ground/level.tscn -- --entry <条目> [--item <held_…>] [--object <类型>] [--breed <品种>] [--time <秒>] --shot <png 绝对路径>`，镜头参数同上（`--look`、`--yaw`、`--pitch`、`--size`） |
| 空地逐条检查 | `godot --headless --path . -s res://tools/check_empty_ground.gd` → `EMPTY_GROUND_OK`（逐条摆一遍、播一遍；缺东西的打印出来，其余错误都算失败） |
| 录成动图 | 狗、牵狗、骑车、鸽子：`python tools/record_review.py <输出目录> [条目 ...]`；猫、狗的原地动作和行为：`python tools/record_animals.py <输出目录> [种类:动作 ...]`（都录空地） |
| 猫、狗检查 | `godot --headless --path . -s res://tools/check_animals.gd` → `ANIMALS_OK`（三只模型能读、每个动作走一遍、行为） |

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
| `npc/` | 火柴人：映射移植、播放、169 条动作数据（`npc/motion/`，由 `../scripts/export-npc-motion.py` 从 `../assets/animations/npz/` 导出）、对拍参考值；狗和猫（真模型）、程序生成的鸽子、骑车的人、牵狗的人（见下） | |
| `npc/clip-setup.json` | 动作要什么：哪种位置（`post`）、拿什么配件用哪只手（`item`）、两人动作的另一人（`partner`）；读它的是 `npc/clip_setup.gd`。见下面"空地"一节 | |
| `types/held_*.tscn` | 配件类型：继承 `models/held_*.glb`，子节点 `model` 的位置 = 配件在手里的偏移 | §2 |
| `scenes/empty_ground/` | 空地：看动作、调相对位置的场景（见下） | |
| `models/` | 场景用到的 glb | |
| `modeling/` | 给建模方（ChatGPT）的说明、自检脚本 `check_model.py`、建模脚本范例；交来的 `build_<名字>.py` 也放这里，glb 放 `models/` | |
| `models/animal_husky.glb`、`animal_shibainu.glb`、`animal_cat.glb` | 狗和猫的真模型（Quaternius，CC0）：带骨骼和蒙皮，一个材质 `animal_ink`，原动作 + `NG_` 开头的原地动作（ChatGPT 做）。怎么用见下面"狗、猫"；制作脚本和重跑方法：`modeling/animals/animal_tools/README.md` | |
| `tools/` | 检查脚本；`dequantize_glb.mjs` 把 Godot 不认的压缩网格格式解开 | |

## 几个约定

- 类型的根节点不带缩放，缩放写在子节点 `model` 上。原因：关卡里一移动实例，编辑器会把根节点的整个变换（含缩放）存进关卡，类型里的缩放就被覆盖了。这是对规格"类型从 glb 继承"的具体做法。
- 关卡里的类型实例改了缩放，运行时报错退出（§4）。
- 地面带从 z = 0 开始往 +Z（朝镜头）一条条排，沿 X 居中；楼放在 z < 0，正面朝 +Z。
- 材质没映射到色槽、配色缺色槽颜色，运行时都报错，不兜底。
- 分组 `size_jitter` 的物件（树、灌木、石头）按所在位置算一个固定的缩放，幅度在 `core/level-params.json`（现在 ±12%）。
- 编辑器里看到的是模型原色；画风只在运行时套上。

## 狗、猫（真模型）；鸽子、骑车、牵狗（程序生成）

鸽子、骑车的人、牵狗的人的姿势每帧由代码算，不播动作文件。狗和猫是真模型：走路时仍由程序步态定爪子落点，腿用两节 IK 够到爪子；原地动作播模型里的片段。所有数值在 JSON 里，代码里不写。

| 文件 | 做什么 |
|---|---|
| `npc/procedural_dog.gd` + `dog-params.json` | 四条腿的步态（走 / 小跑按速度切换），狗和猫都用。脚着地不滑、腿长不变；腿够不着时身体先慢下来并提早换脚；前后两段身体各按脚下的高度走，上下路沿、台阶时身体前后倾，踩实的腿不伸过头也不折过头。`dog-params.json` 的身体和腿是调步态时参照的那只狗，模型换成自己的骨长，步幅按腿能前后摆多远缩放 |
| `npc/procedural_pigeon.gd` + `pigeon-params.json` | 鸽子：走（头停住、身体走过去、再往前一探，每步一次）、站着转头张望、啄地、蹦到指定点（可上下路沿）、起飞 / 飞 / 滑翔 / 落地（落前抬身刹车、放腿）、黑色剪影。脚着地不滑、腿长不变。翅膀形状来自 `pigeon-wings.json`（收起、滑翔、一次扑翅），由 `scripts/export_pigeon_wings.py` 从公有领域鸽子 `assets/rigs/pigeon/bird.blend` 取出，不手改 |
| `npc/animal-models.json` | 三只模型（哈士奇、柴犬、猫）：哪几根骨头是腿、肩、脖子、尾巴，每个动作由哪几段片段组成（进入 / 保持 / 起身），每种动物有哪些动作，淡入淡出时间 |
| `npc/animal_model.gd` | 读模型：从骨架量出腿长、肩高、爪子站位，换算步态参数；采样片段；给出每根骨头的姿势（步态 + 腿部 IK，脖子和尾巴叠原版 Walk / 站立呼吸片段，动作片段淡入淡出） |
| `npc/animal.gd` | 一只狗或猫的状态：走路（程序步态）和动作（停稳后播进入片段 → 循环保持 → 不要了就播起身片段 → 淡回走路） |
| `npc/animal_body.gd` | 显示：模型实例、纯黑、不投影，每帧设骨头；套画风时跳过（`style/ink_builder.gd` 的 `SELF_INKED` 分组） |
| `npc/animal_controller.gd` + `animal-behaviour.json` | 流浪狗和猫的行为：走走停停、有人靠近就走开、猫见狗警觉或跑开；歇脚时轮流做的动作在 `animal-behaviour.json` 的 `rest_actions`。纯函数，输入自身和附近的人和动物，输出想要的速度、朝向和原地动作。还没接进街道 |
| `npc/rider.gd` + `rider-params.json` | 骑车的人：按车给的接触点现算——胯在车座上、手在车把上、脚在脚踏/踏板上，身体前倾由车把位置推出；蹬车时曲柄跟轮子转，不蹬时滑行、脚踏回到水平；转弯时连人带车倾斜。车的类型可以覆盖其中的参数（`rider_style`） |
| `npc/dog_walker.gd` + `leash-params.json` | 牵狗的人：人按走过的距离播 `walk_dog`、停下时渐变到 `stand_idle`；狗（模型，街上哈士奇、柴犬各半，`crowd-params.json` 的 `dogWalker.breeds`）跟在牵绳手那一侧；绳子拴在模型脖子上；绳子快绷紧时人放慢，绳子只负责画（松了下垂，紧了拉直），不拖动任何一方 |
| `npc/clip_pose.gd` | 任一动作按"走过的距离"原地播放（去掉动作自带的前进量），供导航驱动的人用 |
| `npc/ink_figure.gd` | 画上面这些：等宽圆头线、朝向镜头的实心圆、实心三角，和火柴人同一个线条 shader |
| `npc/body-types.json` | 体型缩放（成人 3 倍） |

在空地里看（下面"空地"一节）；要动图用 `tools/record_review.py`。

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


## 空地（`scenes/empty_ground/`，2026-09-27）

一块平地（现有画风、能转的镜头），左边列表列出能动的一切，全从数据读：`npc/motion/` 的每条动作；`movers.json` 里的狗、牵狗、自行车、电动车、鸽子；`movers.json` 的 `animals` 列的猫、狗：走、小跑、行为，加上 `npc/animal-models.json` 给这种动物的每个动作（时间安排在 `npc/animal-behaviour.json` 的 `review`）。这两类原来各有一个审阅场景，2026-09-27 起都并进空地，那两个场景删了。代码：`stage.gd`（摆什么、怎么动、拖了写哪里），`empty_ground.gd`（面板、鼠标、命令行），数值在 `params.json`，镜头数值在 `camera-params.json`（比街上能拉得更近）。

- **打开**：`godot --path . res://scenes/empty_ground/level.tscn`。点列表一条，自动摆好、镜头框住；空格或按钮播放 / 暂停，拖进度条，改倍速。筛选框按名字过滤。
- **自动摆**（按 `npc/clip-setup.json`）：要位置的，放一个有这种 `post_<种类>` 标记的物件类型，人站到标记上；拿配件的，把 `types/held_<名>.tscn` 挂到手上（左 / 右手、双手中点、背着 = 颈根）；两人动作，另一人站到声明里的偏移上，两人同步播。只是别人的 `partner` 的动作（`receive_item`）选中时也摆出这一对。推着走的物件（类型分组 `pushed`：购物车、婴儿车）跟着人的根位置走。会移动的动作按自己的位移走：首尾能接上的一直走（台阶上一直爬），走出 `params.json` 的 `replayAfter`（6 米）或升降够 `replayRise`（0.9 米，台阶）后回起点；接不上的每遍回起点。
- **换**：面板上"配件"可换成任意 `held_*`（只对声明了配件的动作）；"物件"可换成任意提供同种位置的类型；狗、牵狗、狗的动作可换品种（哈士奇、柴犬）。
- **手加的**："加一个人"加一个播当前动作的人，"加物件"加任意类型，都放在镜头中心前面；切到别的动作时保留，右键删掉。自动摆的，切到下一条就删掉。
- **拖**：左键按住东西拖，在地面上平移；按住 Shift 拖是上下（`params.json` 的 `verticalKey`）。只挪位置不转。松手就写回文件，画面上同类型的实例立刻跟着变，写回的只有相对关系：
  - 人（站在物件上的）→ 那个物件类型里这个 `post_<种类>` 标记的位置；推着走的物件被拖 → 同一个标记。
  - 配件 → `types/held_<名>.tscn` 里 `model` 节点的位置（配件在手里的偏移）。
  - 两人动作里的另一人 → `npc/clip-setup.json` 里这条的 `partner.at`。
  - 整体挪（拖物件带着上面的人、拖第一个人带着另一人或推的车、拖手加的东西）不写任何文件。
- **缺东西**：声明引用的位置没有物件类型提供、配件类型不存在、另一人的动作文件不存在时，列表里这条灰掉，后面写"缺：…"；选中照样能看（缺的那样不摆）。游戏里这条动作不进候选（`npc/behaviour.gd`、`npc/crowd.gd`）。现在缺的：`hold_door` / `push_door` / `pull_door`（没有门的类型，等门模型）、`carry_shoulder`（没有 `held_rolled_carpet`）。
- **命令行**：`-- --entry <条目>`（动作名、`movers.json` 的 id、或 `dog:sit` 这样的 `种类:动作`）、`--item <held_名>`、`--object <类型名>`、`--breed <品种>`、`--time <秒>`、`--speed <倍>`、`--shot <png>`（停在 `--time` 截一张）、`--capture <目录> --frames <n> --every <k>`（录帧，`record_*.py` 用）。给了 `--look` / `--size` 就不自动框镜头。

**加东西的做法**：
- 加一种位置：在物件类型 `.tscn` 里加 `Marker3D`，名字 `post_<种类>`（种类一个词、不带下划线，同类型有几个就 `post_<种类>_<n>`），位置是人站的地方、+Z 是人面朝的方向；再在 `clip-setup.json` 给用它的动作写 `"post": "<种类>"`。行为表里要用，就加一行 `"from": "post:<种类>"`；声明了位置种类的动作只能出现在同种类的行里（`behaviour.gd`、`crowd.gd` 查，违反就报错退出）。非行为场景（street_demo）里出现的位置种类都要在 `crowd-params.json` 的 `posts` 里有一项。
- 加一种配件：模型 `models/held_<名>.glb`（`modeling/模型制作说明.md` 第 12 节），再建 `types/held_<名>.tscn`（照现有的抄，分组 `held`，`model` 不带变换）；`clip-setup.json` 写 `"item": { "type": "held_<名>", "hand": "left|right|both|back" }`。
- 加一个两人动作：在开位置的那条写 `"partner": { "clip": "<另一人的动作>", "at": [x, z], "yaw": <度> }`（相对第一个人：+Z 是他面朝的方向），距离先给个大概，在空地里拖另一人调。
- 手要碰的点：物件类型上的 `touch_<动作>_<关节>` 标记（物件坐标），从原 `support.json` 转来，现在只存不用，等以后做 IK。推车的握点在模型里（`grip_left` / `grip_right`），不另存。

**从 support.json 转来的**（2026-09-27，原文件已删，在 git 历史 e55fd50）：位置按源数据换算到火柴人的坐标系（减去第一帧的胯、按躯干朝向转正，和 `npc/clip_pose.gd` 一样），没有按映射后的手重新量，所以要在空地里看、拖。新位置种类：`rail`（`sidewalk_guardrail`）、`pole`（`bus_stop_sign`）、`wall`（`compound_wall_solid`）、`stretch`（`bench`）、`button`（`vending_machine`）、`notice`（`notice_board`）、`step`（`building_bank` 门口台阶）、`table`（`cafe_table`，站着）、`trash`（`trash_bin`）、`push`（`shopping_cart`、`baby_stroller`）、`upstairs` / `downstairs`（`outdoor_steps_8`；这两个标记是人根节点在动作第一帧的位置，动作第一帧本来就站在台阶中间，所以标记挪了整数个循环、带高度：上台阶从第 1 级起、`y = -0.3`，下台阶从第 6 级起、`y = 0.6`，三个循环正好在 8 级台阶上）。`sit_sideways` 用长椅已有的 `sit`，`take_back_piece` 用棋桌已有的 `chess`（原数据按咖啡桌量的，人离桌心 0.6 米，棋桌的位置是 0.84 米）。没带过来的：门的每帧转角、拐杖的每帧角度、下台阶每帧脚的阶段（播放用不上，要时从 git 历史取）。

## 现在还没做

- 门（从楼里进出）：等门的模型；有了门的类型再加 `doorhold` / `doorpush` / `doorpull` 位置。
- 候选来源"周围的人"：双人请求、活动记账、吆喝抬分（`docs/design_route_npc_behavior.md` §3）；结伴走。
- 看向哪：在任意动作上叠加头朝目标转。
- 多种人：`npc/behaviour-people.json` 只有 `passerby`，`npc/body-types.json` 只有 `adult`，缺小孩体型。
- 避让：人、骑车的、狗之间都不避让；狗的位置不查可走网格。
- 狗上下楼梯：步态选落脚点时不看台阶，走快了两只爪可能落在相差两级的台阶上，超出模型腿能伸缩的范围（尤其哈士奇、柴犬前腿上臂很短），那一下爪子会离台阶面几厘米（下楼梯 0.8 米/秒时最多约 11 厘米）。路沿没有这个问题（检查按 1.5 厘米卡）。`tools/check_locomotion.gd` 只打印楼梯的误差，不算失败。
- 车辆行驶、红绿灯、公交（停着、有人坐，不上车）。
- NPC 在街上带配件（配件只在空地里挂）；猫、鸽子进场景（只在空地里）。
- IK：让手去够物件上的 `touch_…` 点。
- 动作转换图（哪个动作后面能接哪个，见行为文档 §5.2），表示方式未定。
- 已知穿模：入座时直线穿过椅子；坐姿原地转身；起身后留在椅子里；`pat_dust`、`look_up` 首尾偏 6 厘米，被当成会走的动作而转向。
