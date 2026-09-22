# Godot 技术调研（2026-09-20）

> **status: snapshot** — 只读调研，写完不再更新。后续变化以新文件替代。

目标通路：在 `assets/fromgodot/game-godot` 里做第一个最小通路——**一个火柴人，用
`assets/animations/npz` 里的动作，按 `docs/design-plans/npc-skeleton-mapping.md` 的映射
规则，在认可的画风下走一段**。本文只收集证据、列选项和代价，**不下最终结论**。

## 已定前提（本文不推翻）

| 前提 | 出处 |
|------|------|
| 源 npz 与 meta.json 保留不改 | `design_route_npc_motion_supply.md:7` — `当前交付是 assets/animations/npz/<name>/motion.npz 与 meta.json。素材保留源关节，显示造型在绘制时映射；不预先烘焙成最终火柴人坐标。` |
| 映射在绘制时做 | `docs/design-plans/npc-skeleton-mapping.md:93` — `不要把映射后的点写回资源文件。资源里只存源关节，画的时候再算。` |
| 映射写成纯函数，三方共用一份实现 | `npc-skeleton-mapping.md:91` — `映射写成一个纯函数：输入一帧源关节加一份参数，输出这一帧要画的点。调参工具、出图脚本、游戏运行时共用同一份实现，不要各写一份。` |
| 映射参数放独立 JSON | `npc-skeleton-mapping.md:92` — `参数放在一个单独的 JSON 文件里，不要散落在代码里。`；`design_route_npc_motion_supply.md:45` — `共用纯映射函数与独立参数 JSON 是已定实现要求；源资源不写回映射坐标。` |
| Godot 版本 | `建模规范与参数.md:3` — `适用：Godot 4.7.2，Forward+。` |

`<STYLE_DIR>` 在本文指 `C:/Users/Hsinlung/Desktop/style_test/proj`（该目录下有
`style/ink_builder.gd`，前置条件已核）。它是仓库外的独立 Godot 工程，
`git ls-files` 不含它。

## 一个必须先说的发现

**`<STYLE_DIR>` 的 `main.gd` 里已经有一条能跑的火柴人通路**，不是设想：

- `main.gd:130-132` 声明 `BONES` 十段骨骼（`body-neck`、`neck-head`、两臂各两段、两腿各两段）。
- `main.gd:134-186` 的 `_add_stick(s, fill)` 读一个 JSON 动作文件、取一帧、
  建线段网格 + 一个正对相机的实心头圆盘，材质用 `InkBuilder.LINE_SHADER`（`:180`）。
- `main.gd:195-219` 的 `_segments_mesh(segs)` 把线段打包成 `ink_line.gdshader` 要的
  CUSTOM0/1/2 顶点格式。
- 数据文件 `<STYLE_DIR>/models/stand_idle.json`，格式
  `{"fps":30, "frames":[{"body":[x,y,z], "neck":[…], "head":[…], "l_elbow":…, …}]}`
  （11 个关节名，米、Y 上）。
- 九个 `params/*.json` 全部含 `sticks` 段（`grep -ln 'sticks' params/*.json` 命中 9 个）。

**但它与本次目标通路有三处已知差距**，都可 grep 证实：

1. **它用的是 11 个已映射好的关节，不是源 npz 的 77 关节。** `main.gd:143-144` 直接
   `J[k] = Vector3(fr[k][0], fr[k][1], fr[k][2])` 按名字取，没有任何 IK、肩向量分配、
   头部去前倾、举臂外展——即 `skeleton-mapping.mjs` 做的全部工作都不在里面。
   这违反上表"映射在绘制时做"的前提（它消费的是别处已烘焙好的点）。
2. **它只画一帧**（`main.gd:136` — `data["frames"][int(s.get("frame", 0))]`），
   没有播放循环，也没有位移。
3. **它明确不给火柴人影子**：`main.gd:186` — `# (no shadow for stick figures, by decision 2026-09-19)`；
   头圆盘 `:174` 与线网格 `:184` 都设了 `SHADOW_CASTING_SETTING_OFF`。

所以最小通路要补的是：源数据进 Godot（Q1）、映射函数移植（Q4）、逐帧播放与位移、
以及影子政策（Q3）。**画线这一步的可行性已经被 `_add_stick` 证明**（Q2）。

---

## Q1 动作数据怎么进 Godot：Godot 能不能直接读 npz；不能的话在哪一步转成什么格式。

### 1.1 npz 到底是什么（实测，未改任何文件）

用 numpy/zipfile 只读打开 `assets/animations/npz/stand_idle/motion.npz`：

| 成员 | shape | dtype | 未压缩字节 | zip 压缩方式 |
|------|-------|-------|-----------|--------------|
| `local_rot_mats.npy` | (120, 77, 3, 3) | float32 | 332768 | 0（stored） |
| `global_rot_mats.npy` | (120, 77, 3, 3) | float32 | 332768 | 0（stored） |
| `posed_joints.npy` | (120, 77, 3) | float32 | 111008 | 0（stored） |
| `root_positions.npy` | (120, 3) | float32 | 1568 | 0（stored） |
| `smooth_root_pos.npy` | (120, 3) | float32 | 1568 | 0（stored） |
| `foot_contacts.npy` | (120, 6) | bool | 848 | 0（stored） |
| `global_root_heading.npy` | (120, 2) | float32 | 1088 | 0（stored） |

`posed_joints.npy` 的头 96 字节实测为：
`\x93NUMPY\x01\x00v\x00{'descr': '<f4', 'fortran_order': False, 'shape': (120, 77, 3), }` + 空格补齐。
即 **NPY v1.0 格式、小端 float32、C 序、头部是一个 Python 字面量字典**。

文件整体 782570 字节；全部 63 个 clip 合计 **39.4 MB**。

### 1.2 Godot 原生不认 npz

Godot 没有 numpy/npy 的导入器或类（`class_` 列表里无对应项）。但 npz 就是 ZIP，
而 Godot 有 `ZIPReader`：`open()` / `get_files()` / `read_file()` / `file_exists()`，
可在运行时读磁盘上任意 zip
（https://docs.godotengine.org/en/stable/classes/class_zipreader.html ）。
配合 `PackedByteArray.to_float32_array()`（"each block of 4 bytes has been converted to a
32-bit float"）和 `slice()`
（https://docs.godotengine.org/en/stable/classes/class_packedbytearray.html ）
理论上可以在 Godot 内解 npz。

**代价与风险**：
- 要自己写 NPY 头解析（读 `descr`/`shape`，跳过 header 到数据区）。头是 Python
  字面量语法，不是 JSON——`JSON.parse_string` 解不了，得手写字符串切分。
- `to_float32_array()` 的字节序：Godot 文档明写 *"The way values are encoded is an
  implementation detail and shouldn't be relied upon when interacting with external apps."*
  （同上 PackedByteArray 页）。npy 声明的是小端 `<f4`。在 x86/ARM 小端机器上一致，
  但这是一条文档明确不保证的路径。**不确定**：是否有任何官方文档承诺
  `to_float32_array()` 按小端解。缺的证据：Godot 文档没有对该方法给出字节序声明，
  只能靠实测；本次禁止启动 Godot，未实测。
- 本次调研未在 Godot 内验证 `ZIPReader` 能否读 `compress_type=0`（stored）成员。
  **不确定**，缺的证据：ZIPReader 文档未列支持的压缩方法（fetch 结果明确说
  "The documentation does not specify which compression methods are supported"）。

### 1.3 现有导出脚本怎么做的

`scripts/export-motion-study.py`（55 行）是当前唯一的 npz → 可消费格式转换器。

**它需要的输入有两份，其中一份在仓库外**：

| 输入 | 来源 | 行 |
|------|------|-----|
| 骨架定义文件（必填命令行参数） | `C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py`——**仓库外** | `:3` 用法示例、`:28` `--skeleton-definition` required=True |
| `assets/animations/npz/<name>/motion.npz` + `meta.json` | 仓库内 | `:41-43` |

骨架定义的用法（`:30-36`）：用 `ast.parse` 静态解析那个 .py，取出
`SOMASkeleton77` 类里的 `bone_order_names_with_parents` 赋值，`ast.literal_eval` 成
`[(name, parent), …]`。**不 import、不加载 Kimodo 模型**（`:4` — `Requires numpy;
the Kimodo model is not loaded.`）。这意味着这个脚本只需要那一个 .py 文件的文本，
不需要整个 Kimodo 环境。

它做的事（`:37-50`）：
1. 从 77 个关节里按 `KEEP` 取 **26 个**（`:19-23`）——包含 Spine/Chest/Neck2/Shoulder/
   ToeBase 等，比映射函数实际需要的多。
2. 只取 `posed_joints` 和 `foot_contacts` 两个数组（`:44`、`:48`），
   **其余五个数组全部丢弃**（旋转矩阵、root 位置、heading 都没进导出）。
3. 断言全部有限且形状正确（`:45`）。
4. 坐标四舍五入到 5 位小数（`:47`）。
5. 输出单个 `sth/motion-study/motions.json`，含 `names`/`parents`/`units`/`clips`，
   `separators=(',',':')` 紧凑（`:38-39`、`:49-50`）。
6. 只导出 `CLIPS` 里写死的 **6 个** clip（`:14-18`）：`stand_idle`、`phone_walk`、
   `scratch_head`、`squat_watch`、`bow`、`wave_both_overhead`。仓库里实有 63 个 clip。

产物 `sth/motion-study/motions.json` 实测 464803 字节（6 clip × 26 关节）。

### 1.4 体积推算（实测，供权衡）

对 `stand_idle`（120 帧 × 77 关节）算出来：

| 形态 | 字节 |
|------|------|
| 原 npz（含全部 7 个数组） | 782570 |
| 全 77 关节、5 位小数 JSON | 243658 |
| 16 关节子集 JSON（按比例估算，非实测） | ≈ 50600 |

映射函数实际只需要 16 个源关节（见 `skeleton-mapping.mjs:7` 的存在性断言列表：
`Hips, Neck1, Head, HeadEnd` + 左右各 `Arm, ForeArm, Hand, Shin, Foot, ToeEnd`）。
按 16 关节导出比当前 26 关节的 `KEEP` 还能再省约 38%。

### 1.5 选项与代价

| 选项 | 做法 | 代价 | 是否满足"源 npz 不改" |
|------|------|------|----------------------|
| **A. 保持离线转换，产物换成 Godot 友好格式** | 扩展/复制 `export-motion-study.py`，输出 JSON（或 `.res`/二进制）到 `game-godot/` 下 | 需要 `C:/kimodo-trial/…/definitions.py` 在场（仓库外依赖，见 1.3）。转换是构建期一次性的；运行时零解析负担（JSON 除外） | 是——只读 npz |
| **B. 离线转成 Godot 原生资源** | Python 端出 JSON，再在 Godot 里写一个 `@tool` 脚本转成 `Resource`（`.tres`/`.res`） | 多一步；换来 `ResourceLoader` 的二进制加载与 PCK 打包，不用管非资源文件过滤（见下） | 是 |
| **C. Godot 运行时直读 npz** | `ZIPReader` + 手写 NPY 头解析 + `to_float32_array()` | 要自己实现 NPY 解析；字节序无文档保证（1.2）；ZIPReader 对 stored 成员的支持未验证。好处：彻底去掉 Python 步骤和仓库外依赖，39.4 MB 原始数据直接是素材 | 是——只读 |
| **D. 运行时读 JSON** | `FileAccess.get_file_as_string()` + `JSON.parse_string()` | 与 `<STYLE_DIR>/main.gd:18`、`:135` 现有做法一致，已验证可行 | 是 |

**打包注意（B 与 A/D 的关键差异）**：Godot 导出时非资源文件默认不进 PCK。官方导出文档
说明第一个过滤器 *"allows non-resource files such as `.txt`, `.json` and `.csv` to be
exported with the project"*
（https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html ）。
所以走 A/C/D 都要在导出预设里手动加 `*.json`（或 `*.npz`）过滤器；
走 B 则自动包含。`.npz` 文档里没有点名，按同一规则应归入"非资源文件"，**不确定**
是否需要额外处理——缺的证据：Godot 文档未列 `.npz`，本次未实测导出。

**还没有证据的一点**：`foot_contacts`（6 列 bool）在 `export-motion-study.py:48`
被导出，但 `skeleton-mapping.mjs` 全文不读它（grep 该文件无 `contact`）。
最小通路要不要它，**不确定**——缺的证据：`npc-skeleton-mapping.md` 未提及接触列的用途，
"走一段"的位移方案（根位移从哪来）在任何已定文档里都没写。注意 `root_positions` /
`smooth_root_pos` / `global_root_heading` 这三个可能与位移直接相关的数组，
当前导出脚本**一个都没导**。

---

## Q2 火柴人的线条怎么画才能吃到画风

### 2.1 这套画风从场景里取什么（逐项引行号）

`<STYLE_DIR>/style/` 下实有**四个** `.gdshader` 加 `ink_builder.gd`
（`建模规范与参数.md:3` 说"三个 shader"，与磁盘上的四个对不上——
`grade.gdshader` 是全屏后期，可能不计入"画风三件套"，**不确定**，
缺的证据：该文档未列出是哪三个）。

#### `ink_builder.gd`（189 行）——线从几何里抽，不从深度/法线缓冲

`build_lines(mesh, crease_deg, weld, skip_surfaces)`（`ink_builder.gd:12-93`）取的是
**网格自身的顶点与索引**，不是任何屏幕缓冲：

| 取什么 | 行 |
|--------|-----|
| `mesh.get_surface_count()` 逐面组 | `:17` |
| `surface_get_arrays(s)[Mesh.ARRAY_VERTEX]` 顶点 | `:21` |
| `[Mesh.ARRAY_INDEX]` 索引（无索引时按 3 顶点一三角处理） | `:22`、`:32-38` |
| 顶点焊接：按 `weld=0.0005`（0.5 mm）量化成整数键去重 | `:27-31` |
| 每三角的面法线（叉积，退化面丢弃） | `:42-46` |
| 边 → 相邻面列表 | `:47-55` |

判边规则（`:59-70`），三条，与 `建模规范与参数.md:21-24` 的文字一一对应：
- 两面共享且 `dot(na,nb) > 0.9995` → **丢弃**（共面，`:65-66`）。
- 两面共享且 `dot > cos(crease_deg)` → `kind = 0.0`，**轮廓候选**（`:67-68`）。
- 其余（含只有一个面的开放边，`:69-70`）→ `kind = 1.0`，**永远画**。

输出一个 `ArrayMesh`，每条边展开成 4 顶点的 quad（`:73-78`），塞进三个
`ARRAY_CUSTOM` 通道（`:84-92`，格式 `ARRAY_CUSTOM_RGBA_FLOAT`）：
`CUSTOM0 = 另一端点 xyz + side(±1)`、`CUSTOM1 = 面 A 法线 + kind`、`CUSTOM2 = 面 B 法线`
（与 `ink_line.gdshader:2-4` 的注释一致）。

`apply(root, fill_params, line_mat, crease_deg, palette, slot_map, unmapped)`（`:124-183`）
对树里每个 `MeshInstance3D` 做四件事：
1. 逐 surface 取 `get_active_material(s)` 的 `resource_name`（`:134-135`），
   经 `resolve_slot`（`:113-119`，支持通配符 `String.match`）查到**色槽名**，
   再查 `palette`（`:137`）。查不到记进 `unmapped`（`:139`），回退到贴图平均色
   `material_color()`（`:96-110`，把 albedo 贴图 resize 到 1×1 取像素）。
2. 把该 surface 的材质整个换成 `FILL_SHADER` 的 `ShaderMaterial`（`:146-161`），
   写入 `base_color`、`flat_color`，必要时 `use_alpha_tex`/`alpha_tex`。
3. 建一个 `shadow_proxy` 子 `MeshInstance3D`，同一个 mesh，
   `SHADOW_CASTING_SETTING_SHADOWS_ONLY`；原 mesh 自己 `SHADOW_CASTING_SETTING_OFF`
   （`:168-175`）。
4. 建一个 `ink_lines` 子 `MeshInstance3D`，mesh 是 `build_lines` 的产物，
   `material_override = line_mat`，不投影（`:176-183`）。

`_collect`（`:185-189`）递归收集时**跳过**名为 `ink_lines` 和 `shadow_proxy` 的节点，
避免二次处理。

#### `ink_line.gdshader`（43 行）——屏幕空间等宽线

`render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled`（`:6`）。
uniform 三个：`line_color`、`width_px`（默认 1.5）、`depth_bias`（默认 0.03 米，`:8-10`）。

vertex 里（`:12-39`）：
- 读 `CUSTOM0.xyz` 当另一端点、`CUSTOM0.w` 当 side（`:13-14`）。
- **判正交还是透视**：`PROJECTION_MATRIX[3][3] > 0.5`（`:17`），
  正交时视线方向取 `(0,0,-1)`，透视时取 `normalize(v0)`（`:18`）。
- `CUSTOM1.w < 0.5`（轮廓候选）时判可见性：`dot(na,view)*dot(nb,view) < 0.0`，
  即两侧面一朝向一背向才画（`:20-24`）。
- 向相机方向拉 `depth_bias` 米（`:25-27`）。
- 投到屏幕，沿屏幕法向偏移 `width_px * 0.5`（`:28-37`）——**线宽是屏幕像素，不随距离变细**。
- 不可见的边把顶点推到 `vec4(2,2,2,1)` 裁掉（`:38`）。

#### `ink_fill.gdshader`（52 行）——色槽 + 硬调子 + 屏幕空间排线

`render_mode specular_disabled, ambient_light_disabled`（`:8`）。
`fragment()` 只写 `ALBEDO = base_color` 并按 alpha 贴图 discard（`:29-32`）。
真正的调子在 `light()`（`:34-52`），取三样东西：

| 取什么 | 行 |
|--------|-----|
| `dot(NORMAL, LIGHT)` — 表面法线与光向 | `:35` |
| `ATTENUATION < shadow_threshold` — **是否在投影里** | `:36` |
| `FRAGCOORD.x + FRAGCOORD.y` — 屏幕坐标，做排线条纹 | `:38` |

四档分支（`:40-48`，与文件头 `:2-5` 的注释表一致）：受光正对 → 原色不排线；
受光掠射 → 中间色 + 稀排线（`cover_grazing=0.15`）；投影内正对 → 中间色 + 密排线
（`cover_shade=0.4`）；投影内掠射或 `ndl<=0` → 暗色 + 密排线（`cover_dark=0.4`）。
`flat_color` 为真时整个跳过（`:49`）。

**关键点**：`ink_fill` 的调子**依赖 `ATTENUATION`，也就是依赖这个表面能接收阴影**。
一个 `unshaded` 的东西根本不会进 `light()`，拿不到这四档。

#### `shadow_proxy.gdshader`（5 行）

`render_mode unshaded, cull_front`（`:3`）——**从背面投影**，注释说这样
"lit front faces never self-shadow (no acne, no bias needed)"（`:1`）。
`skip` 为真时 discard（`:4-5`）。这解释了 `建模规范与参数.md:34-36` 的
"必须是封闭实体、单张面片投不出影子"。

#### `grade.gdshader`（18 行）

`shader_type canvas_item`，读 `hint_screen_texture`（`:3`），按到 `tint_center` 的径向
距离混一个色调（`:11-17`）。对填充和线条一视同仁。挂法见 `main.gd:114-127`。

### 2.2 结论：这套画风对"人物"能提供什么

| 画风能力 | 依赖什么 | 火柴人能不能用 |
|----------|----------|----------------|
| 自动抽线描边（`build_lines`） | 输入必须是有面、有法线的 **Mesh**（`ink_builder.gd:20-22` 读 ARRAY_VERTEX/INDEX） | 只有做成实体几何才行 |
| 等宽屏幕空间线（`ink_line`） | 只要顶点带 CUSTOM0/1/2 三通道即可，**不要求是真实体** | 能——`main.gd:195-219` 已证明可以手工构造这个格式 |
| 色槽 + 排线调子（`ink_fill`） | 需要材质名 → slot 映射，且表面参与 `light()`（要 `ATTENUATION`） | 只有非 unshaded 的实体表面才行 |
| 全屏色调（`grade`） | 屏幕纹理，与对象无关 | 能——无条件 |

### 2.3 在 3D 场景里画线条人物的可行做法

#### 做法 1：手工构造线段 quad，直接喂 `ink_line.gdshader`（现状）

`main.gd:134-186` + `:195-219` 已实现。每根骨头 → 1 个 quad（4 顶点 / 2 三角），
CUSTOM1 固定写 `(0,1,0,1)`（`:204`），即 `kind=1.0`，**永远画、不做轮廓判定**。

- **能被这套画风描边吗**：能，而且它**就是**描边——线本身由 `ink_line` 渲染，
  与环境的边线完全同一个 shader、同一个 `line_color`/`width_px`，视觉上天然一致。
- **能吃到 `ink_fill` 的色槽/排线吗**：**不能**。`ink_line` 是 `unshaded`（`:6`），
  不进 `light()`；头圆盘更是用 `StandardMaterial3D` + `SHADING_MODE_UNSHADED`
  （`main.gd:169`）。整个火柴人是纯色的。
- **代价**：每帧要重建网格（关节动了，quad 顶点就得变）。几何量极小——
  10 根骨头（`main.gd:130-132`）+ 24 段头圆盘（`main.gd:157`），
  合计约 48 线顶点 + 72 圆盘顶点。
- **额外成本**：头圆盘要正对相机，`main.gd:154` 每次取
  `root.global_transform.basis.inverse() * cam.global_transform.basis`——
  相机一动就得重算。现在只建一次（只画一帧）；做成动画后这是每帧的事。

#### 做法 2：每根骨头一个真实体（胶囊/圆柱），走完整 `InkBuilder.apply()`

- **能被描边吗**：能，且是自动抽线——但抽出来的是**圆柱侧影 + 两端封口环**，
  不是一根中线。`建模规范与参数.md:31` 明写"圆的东西一圈至少 12 段，否则每条棱都出线"，
  所以一根胳膊会出两条轮廓线（左右侧影），中间是填充面，**不是一根线**。
  这与 `npc-skeleton-mapping.md:81`（`线条是等宽的圆头线`）的描述不同。
- **能吃到色槽吗**：能——这是唯一能进 `ink_fill.light()` 拿到四档调子的做法。
- **代价**：`build_lines` 是 O(三角数) 的 GDScript 循环（`ink_builder.gd:17-78`），
  跑在每个 `MeshInstance3D` 上。对静态环境是加载期一次性；
  **对每帧变形的人物，等于每帧重跑一次抽边**。这是本做法最大的未量化风险——
  本次禁止启动 Godot，未实测。**不确定**其每帧代价。
  绕开的办法是骨骼蒙皮（`Skeleton3D` + `MeshInstance3D.skin`）让网格拓扑不变、
  只变换顶点，则 `build_lines` 可以只跑一次；但 `build_lines` 读的是
  `surface_get_arrays` 的**静态**顶点（`:21`），抽出来的线不会跟着蒙皮动——
  **不确定**能否让线网格也吃到同一套骨骼权重，缺的证据：`ink_builder.gd` 没有
  搬运 `ARRAY_BONES`/`ARRAY_WEIGHTS` 的代码，Godot 文档未查该组合。

#### 做法 3：`ImmediateMesh` 每帧重建

Godot 官方程序化几何页对四个工具的定位：ArrayMesh 最快但 API 复杂、SurfaceTool 略慢、
MeshDataTool 最慢、**ImmediateMesh 适合每帧都变的几何**——
*"if you need the geometry to change every frame anyway, it provides a much easier
interface"*，且可能比每帧重建 ArrayMesh 更快
（https://docs.godotengine.org/en/stable/tutorials/3d/procedural_geometry/index.html ）。
ImmediateMesh 类页同时有一句反向表述：*"it is slow because the geometry is rebuilt every
frame. It is most useful for adding simple geometry for visual debugging"*
（https://docs.godotengine.org/en/stable/tutorials/3d/procedural_geometry/immediatemesh.html ）。
两处口径不完全一致，本文如实并列，不调和。

- **能被描边吗**：ImmediateMesh 不提供 `ARRAY_CUSTOM` 通道（它是
  `surface_add_vertex` 式的 OpenGL 1.x 风格 API），**喂不了 `ink_line.gdshader`
  要的 CUSTOM0/1/2**。要用它就得改 shader 或换编码方式（如把另一端点塞进 UV2/COLOR）。
- **能吃到色槽吗**：取决于挂什么材质，与几何无关。

#### 做法 4：`Sprite3D` / 广告牌贴图

- **能被描边吗**：不能。`build_lines` 需要网格几何；一张贴图没有边可抽。
  线条只能画进贴图本身，与环境线的 `width_px`/`line_color` 不共享参数，
  远近还会跟着透视变粗细（`ink_line` 的线是屏幕等宽，`:36`）。
- **能吃到色槽吗**：不能（除非自己另写材质）。
- 本做法等于把 `js/` 那套 2D 广告牌原样搬过来，**与"在 3D 场景里"的目标相抵**。

#### 做法 5：`MultiMesh`

官方定位是"上百万个相似对象"的一次性绘制，且
*"there is no screen or frustum culling possible for individual instances"*
（https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html ）。
一个火柴人用不上；但**如果以后场上有几十上百个 NPC**，把"每根骨头一个胶囊"
做成 MultiMesh 实例是有意义的方向。该页同时指出高效更新全部实例状态需要
GDExtension/C++ 走 `RenderingServer` 的线性内存路径——与 Q4 相关。

### 2.4 一句话对照表

| 做法 | 被 `ink_line` 描边 | 进 `ink_fill` 色槽/排线 | 每帧代价 | 与 `npc-skeleton-mapping.md:81`「等宽圆头线」一致 |
|------|:---:|:---:|------|:---:|
| 1 手工 quad（现状） | **是**（线即本体） | 否（unshaded） | 重建 ~120 顶点 | 是（`width_px` 等宽；圆头需另做，见下） |
| 2 骨头实体 + `apply()` | 是（但出的是侧影双线） | **是** | 每帧重跑 `build_lines`，未量化 | 否 |
| 3 ImmediateMesh | 否（无 CUSTOM 通道） | 视材质 | 官方两处口径不一 | — |
| 4 Sprite3D | 否 | 否 | 低 | 贴图内自定，不共享参数 |
| 5 MultiMesh | 同做法 2 | 同做法 2 | 适合多 NPC，非单个 | 否 |

**圆头线的缺口**：`npc-skeleton-mapping.md:81` 要求"等宽的**圆头**线"。
`ink_line.gdshader:36` 的 `off = (n * side - d * 0.5) * width_px * 0.5` 只做了
沿线方向的半宽外扩（方头/略带延长），**没有圆头**。`main.gd:195-219` 也没补。
**不确定**现有观感是否已被接受为"圆头"——缺的证据：`建模规范与参数.md` 未提线端造型，
`<STYLE_DIR>` 里没有渲染出来的对照图可读（`output/` 被 `.gitignore` 排除、
本次也不许启动 Godot 重新出图）。

---

## Q3 影子

`design route 9.6.md:141` 提的原问题：

> 1. **影子。** 环境实时 3D 有真影子，人若只是线条就没影子——一屋子有影子的东西里站着几个没影子的人。三条出路：环境也不开影子 / 给人一个不绘制的几何代理专供投影 / 接受人没影子。只能看图，但它决定 Godot 场景灯光要不要开。

### 3.1 Godot 侧的机制事实

`GeometryInstance3D.ShadowCastingSetting` 四个取值
（https://docs.godotengine.org/en/stable/classes/class_geometryinstance3d.html ）：

| 值 | 官方原文 |
|----|----------|
| `SHADOW_CASTING_SETTING_OFF` | "Will not cast any shadows. Use this to improve performance for small geometry that is unlikely to cast noticeable shadows (such as debris)." |
| `SHADOW_CASTING_SETTING_ON` | "Will cast shadows from all visible faces… Will take culling into account" |
| `SHADOW_CASTING_SETTING_DOUBLE_SIDED` | "Will cast shadows from all visible faces… Will not take culling into account" |
| `SHADOW_CASTING_SETTING_SHADOWS_ONLY` | "Will only show the shadows casted from this object. In other words, the actual mesh will not be visible, only the shadows casted from the mesh will be." |

**`SHADOWS_ONLY` 正是 `design route 9.6.md:141` 说的"不绘制的几何代理专供投影"**，
而且 `<STYLE_DIR>` 已经在用它——`ink_builder.gd:173` 给每个环境物件建的 `shadow_proxy`
就是 `SHADOW_CASTING_SETTING_SHADOWS_ONLY`，原 mesh 设 `OFF`（`:174`）。
**这套代理机制现成可复用，不需要新发明。**

**接收阴影**是另一回事：上述四个取值**只管投射，不管接收**（该页无接收相关设置）。
在这套画风里，"接收阴影"具体表现为 `ink_fill.gdshader:36` 读到的 `ATTENUATION`——
一个 `unshaded` 材质根本不会执行 `light()`，因此既不参与调子分档也无所谓接收。
另有一条已知 Godot 问题：给 shader 加 `render_mode shadows_disabled;` 在
Compatibility 渲染器下不生效（https://github.com/godotengine/godot/issues/84386 ）；
本项目用 Forward+（`建模规范与参数.md:3`、`game-godot/project.godot` 的
`config/features=PackedStringArray("4.7", "Forward Plus")`），**不确定**该问题是否
影响 Forward+，缺的证据：该 issue 标题限定 Compatibility，未查 Forward+ 下的行为。

### 3.2 逐做法对照

| 做法 | 能投影吗 | 能接收阴影吗 | 需要额外的什么 |
|------|----------|--------------|----------------|
| **1 手工 quad 线（现状）** | **默认不能**：`ink_line.gdshader:6` 是 `render_mode unshaded, shadows_disabled`，且 `main.gd:184` 显式 `SHADOW_CASTING_SETTING_OFF`。即使改成 `ON`，投出来的也是"十根扁 quad 的影子"——quad 是零厚度面片，而 `shadow_proxy.gdshader:3` 用 `cull_front` 从背面投，单面片没有背面（`建模规范与参数.md:36` 明写"单张面片投不出影子；薄板要给厚度 ≥ 2 cm"） | **不能**：`unshaded` 不进 `light()`，`ink_fill` 的四档调子完全不适用 | 要影子必须另加一个不可见的投影代理（见做法 1+代理） |
| **1+代理** 线照画，另挂一个 `SHADOWS_ONLY` 的封闭简单体（胶囊串／一个粗糙人形） | **能** | 仍不能（线本身还是 unshaded） | ①一套代理几何，每帧跟着关节走；②代理必须是封闭体、法线朝外（`建模规范与参数.md:36`）；③若沿用 `shadow_proxy.gdshader` 的 `cull_front` 约定，代理也得是实体。代价：几何量翻倍，且代理形状与线条形状的偏差会直接暴露在地面影子上 |
| **2 骨头实体** | **能**，走与环境完全相同的路径（`ink_builder.gd:168-175` 自动建 proxy） | **能**——这是唯一能吃到 `ink_fill` 四档调子的做法，人身上会有和环境一致的排线明暗 | 胶囊必须是封闭体、段数 ≥ 12（`建模规范与参数.md:31`），否则每条棱出线 |
| **3 ImmediateMesh** | 取决于几何是否封闭，与做法 1/2 同理 | 取决于材质 | 同上 |
| **4 Sprite3D** | 能（Godot 的 SpriteBase3D 有 alpha 裁剪投影），但投出来是**一张平片的影子**，随相机角度变形 | 不能（贴图是预渲染的） | — |
| **环境也关影子** | — | — | 只需把 `DirectionalLight3D.shadow_enabled` 关掉（`game-godot/main.gd:68` 现在是 `true`）。代价：`ink_fill.light()` 的"投影内"两档（`:42-45`）永远不触发，整套画风只剩"受光正对/掠射"两档，环境的排线密度层次损失一半 |
| **接受人没影子** | — | — | 零成本。这正是 `<STYLE_DIR>/main.gd:186` 已经做的决定（`# (no shadow for stick figures, by decision 2026-09-19)`）。**不确定**这条 2026-09-19 的决定是否仍然有效、是否覆盖本次最小通路——缺的证据：该决定只写在代码注释里，任何 `.md` 都没有记录它，也没有记录当时看的是哪张图 |

### 3.3 对"灯光要不要开"的直接影响

`design route 9.6.md:141` 说这个问题"决定 Godot 场景灯光要不要开"。证据链是：

- 关掉 `DirectionalLight3D.shadow_enabled` → `ATTENUATION` 恒为 1 →
  `ink_fill.gdshader:36` 的 `shadowed` 恒 false → `:40`/`:42` 两个分支永不进入。
- 完全去掉光 → `light()` 根本不执行 → `DIFFUSE_LIGHT`（`:50`）不写 →
  整个画风退化成 `fragment()` 里那句 `ALBEDO = base_color`（`:30`），即纯平涂。

所以**关灯不是一个只影响人物的局部选择**，它会拿掉 `ink_fill` 一半到全部的调子层次。
`game-godot/main.gd:63-70` 当前配置是开的（`shadow_enabled = true`，`:68`）。

---

## Q4 映射函数用 GDScript 还是 C#

### 4.1 要移植的是什么（规模实测）

`sth/motion-study/skeleton-mapping.mjs`，85 行，5567 字节。结构：

- 工厂 `createSkeletonMapper(names, restFrame)`（`:5`）返回闭包 `mapFrame`（`:84`）。
- 启动时校验 16 个必需源关节存在，缺一个就抛（`:7-9`）。
- 常量 `SRC = {thigh:.528, shin:.423}`（源站姿腿长，米，`:10`）。
- 纯向量工具：`add/sub/mul/dot/len/unit/mix/cross`（`:11-13`、`:33`）——
  在 Godot 里这些**全部有原生 `Vector3` 等价物**，可以整段删掉。
- `ik(root, l1, l2, target, kneeHint)`（`:14-20`）：两骨余弦定理 IK，膝盖朝向取自源膝。
- `torsoFrame(s)`（`:23-25`）：由 Hips→Neck1 定 up、左右 Arm 定 lat、叉积定 fw。
- `rotTo`（`:29-32`）/ `rotAxis`（`:34`）：罗德里格斯旋转。
- `headDir`（`:35-36`）：头向量转到躯干局部系、去掉站姿前倾（`REST`，`:28`）。
- `mapFrame(s, P, origin)`（`:37-82`）主函数。

**每帧每人的实际计算量**（按代码结构点数，非实测）：
一次 `torsoFrame` + 一次 `headDir`（内含一次 `rotTo`）+ 左右两侧各一次两骨 IK、
一次可选的举臂外展（`:60-72`，含一次 `rotAxis`）。全部是**直线代码**，
没有对大数组的循环——最外层循环只有 `for(const sd of ['Left','Right'])` 两次迭代。
输出 `segs` 最多 12 段（`:52`、`:78-79`：躯干 2 + 每侧 5）。
量级：**每人每帧几百次浮点运算**。这个估算是按行数与向量操作数点出来的，
**没有实测**，本次禁止启动 Godot。

参数 `sth/motion-study/skeleton-params.json` 12 项（headR / neck / torso / clavSplit /
minSpread / upperArm / foreArm / thigh / shin / foot / line / torsoLine），221 字节。

### 4.2 GDScript 的实际代价

**性能证据**：
- 官方静态类型文档只有一句定性说法：*"typed GDScript improves performance by using
  optimized opcodes when operand/argument types are known at compile time"*，
  **没有给任何数字**（https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html ）。
- 唯一能找到的、直接针对"每帧大量向量/矩阵运算"的官方 issue 是
  godotengine/godot#46029（https://github.com/godotengine/godot/issues/46029 ）：
  报告者用 ImmediateGeometry 做程序化头发，GDScript 版"在 profiler 里有明显开销"，
  换 C# 后"main project 提升约 10 fps"。**该 issue 没有给出每帧操作次数，
  也没有给出精确的毫秒对比，且已被标记为 archived/discussion 关闭。**
  它是一条弱证据，不是基准测试。
- 更精确的第三方基准本次没有找到可引用的一手数据。**不确定**：
  "几百次浮点运算 × N 个 NPC"在 GDScript 里的实际每帧毫秒数。
  缺的证据：需要在目标机器上跑一次实测，而本次禁止启动 Godot。

**读 JSON 参数**：`FileAccess.get_file_as_string(path)` + `JSON.parse_string(content)`，
返回 Dictionary。`<STYLE_DIR>/main.gd:18` 就是这么读参数的
（`P = JSON.parse_string(FileAccess.get_file_as_string(ppath))`），
`main.gd:135` 读火柴人动作数据也是同一套。**这条路径在本项目里已验证可用。**
导出时要注意 `.json` 属非资源文件，默认不进 PCK，须加过滤器
（https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html ）。

**其他代价**：
- 原生 `Vector3` 可以替掉 `skeleton-mapping.mjs:11-13`、`:33` 的全部手写向量工具
  （约 4 行密集代码），移植后反而更短。
- `Vector3` 在 Godot 里是值类型，没有 JS 那种数组别名问题。
- Godot 的 `Basis` 可以直接表达 `torsoFrame` 返回的 `[lat, up, fw]` 三元组
  （`skeleton-mapping.mjs:25`），`toLocal`/`toWorld`（`:27`）可换成
  `basis.inverse() * v` / `basis * v`。`<STYLE_DIR>/main.gd:154` 已在用这个写法。
- **语言一致性**：`<STYLE_DIR>` 与 `assets/fromgodot/game-godot` 现有代码
  （`ink_builder.gd`、两个 `main.gd`、`smoke.gd`）**全部是 GDScript，零 C# 文件**
  （`ls` 两个工程目录无 `.cs`）。选 C# 意味着这条通路要跨两种语言。

### 4.3 C# 的实际代价

**编辑器要求**：*"The standard Godot executable does not contain C# support out of the
box. Instead, to enable C# support for your project you need to download a .NET version
of the editor from the Godot website."*
（https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html ）
即必须换一个 Godot 编辑器构建。

**平台限制**（同一页）：
- *"Since Godot 4.2, projects written in C# support all desktop platforms (Windows, Linux,
  and macOS), as well as Android and iOS."*
- *"Android support is currently experimental"*；*"iOS support is currently experimental
  and has a few limitations"*，且 *"Exporting to iOS can only be done from a macOS device."*
- ***"Currently, projects written in C# cannot be exported to the web platform."*** —
  这是最硬的一条。web 导出追踪 issue 见
  https://github.com/godotengine/godot/issues/70796 。

这条对本项目的意义要单独说清楚：`design route 9.6.md:145` 把引擎选择记为未决，
两个候选是 "Godot（要换语言）vs 浏览器内 3D（保住 `js/`）"。**选 C# 等于把
"以后还能导到浏览器"这条退路关掉**；选 GDScript 则保留它（Godot 4.7 的 web 导出
本身在继续演进——4.7 加了 Wasm64，把 32 位 WebAssembly 的 4 GB 堆上限抬高了，
https://godotengine.org/releases/4.7/ ）。**不确定**本项目是否真的需要 web 导出——
缺的证据：任何已定文档都没写目标发行平台。

**性能**：见 4.2 的 #46029。方向上 C# 在紧密数值循环里更快是共识，
但本次没有找到针对"每帧几百次向量运算 × 几十个对象"这个具体量级的一手基准。
注意 `<STYLE_DIR>` 里真正的重计算是 `ink_builder.gd` 的 `build_lines`
（O(三角数)，`:17-78`），不是映射函数——**如果要为性能换语言，先量的应该是它**。

**读 JSON**：C# 侧可用 Godot 的 `Json` 类，也可用 `System.Text.Json`。
**不确定**后者在 Godot 的 .NET 运行时下有无额外限制——缺的证据：本次未查该组合的文档。

**版本**：Godot 4.7 于 2026-06-18 发布（https://godotengine.org/releases/4.7/ ）。
`建模规范与参数.md:3` 指定 4.7.2。上述 C# 平台支持页是 stable 文档，
**不确定**其内容是否已对应 4.7.x——缺的证据：该页未标注具体适用版本，
本次未逐版本核对 changelog。

### 4.4 并列对照

| 维度 | GDScript | C# |
|------|----------|-----|
| 编辑器 | 标准构建即可 | 必须下载 .NET 版编辑器（官方文档原文见 4.3） |
| 与现有代码一致 | **一致**——两个工程 0 个 `.cs` | 引入第二种语言 |
| 原生 Vector3/Basis | 有，可删掉 `.mjs:11-13,:33` 的手写工具 | 同样有（`Godot.Vector3`） |
| 读 JSON 参数 | `FileAccess` + `JSON.parse_string`，`main.gd:18` 已验证 | `Json` 类或 `System.Text.Json`（后者未验证） |
| 桌面导出 | 支持 | 支持 |
| Android / iOS | 支持 | 实验性；iOS 只能从 macOS 导 |
| **Web 导出** | 支持（4.7 新增 Wasm64） | **不支持** |
| 每帧数值性能 | 无官方数字；typed 有定性提升 | 方向上更快；唯一可引的 issue 是定性的 #46029 |
| 本函数的实际瓶颈风险 | 低（每人每帧几百次浮点，直线代码，无大循环） | 同左 |

### 4.5 一个尚未被两种语言方案覆盖的问题

`npc-skeleton-mapping.md:91` 要求"调参工具、出图脚本、游戏运行时**共用同一份实现**，
不要各写一份"。现状是：调参工具（`sth/motion-study/study.mjs:1` import
`skeleton-mapping.mjs`）用 JS，出图脚本用 Python
（`scripts/export-motion-study.py`，但它只抽关节、不做映射），
游戏运行时将是 GDScript 或 C#。

**把 `.mjs` 移植到任何一种 Godot 语言，都会产生第二份实现**，
除非同时把 `sth/motion-study/` 的调参工具也搬进 Godot、或用 GDExtension 之类的
共享机制。**本文未找到任何已定文档说明这一点怎么解决**——
`design_route_npc_motion_supply.md:45` 只说"共用纯映射函数……仓库预览已提取共用模块，
游戏集成仍未完成"，没说游戏集成后两份怎么合一。这是 Q4 之外、但由 Q4 触发的未决项。

---

## 汇总：最小通路上未解决的问题

按本文的证据，做这条通路之前还缺的东西：

| # | 缺什么 | 为什么现在答不了 |
|---|--------|------------------|
| 1 | "走一段"的**位移**从哪来 | `export-motion-study.py` 没导 `root_positions`/`smooth_root_pos`/`global_root_heading`（`:44`、`:48` 只取两个数组）；`skeleton-mapping.mjs` 也不读它们。任何文档都没写位移方案 |
| 2 | 63 个 clip 里哪条是"走" | `CLIPS`（`export-motion-study.py:14-18`）的 6 条里没有纯走路；`npz/` 目录里有 `phone_walk`、`eat_walk`、`turn_walk`，但没有单独的 `walk` |
| 3 | 圆头线怎么实现 | `ink_line.gdshader:36` 只做方头外扩，`npc-skeleton-mapping.md:81` 要圆头（见 Q2 末） |
| 4 | 火柴人到底要不要影子 | `<STYLE_DIR>/main.gd:186` 有一条 2026-09-19 的"不要"决定，但只在代码注释里，无文档、无对照图 |
| 5 | `build_lines` 每帧重跑的代价 | 只有做法 2 需要，本次禁止启动 Godot，未实测 |
| 6 | 映射函数移植后的"同一份实现"怎么维持 | 见 4.5 |
| 7 | `C:/kimodo-trial/…/definitions.py` 的长期可用性 | 它是仓库外文件，`export-motion-study.py:28` 把它设成必填参数；丢了就重跑不了导出 |

---

## 来源

仓库内与 `<STYLE_DIR>` 内的证据一律以 `文件:行号` 就地标注，不重复列。外部来源：

- Godot 官方 — C# 基础与平台支持：https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html
- Godot 官方 — GDScript 静态类型：https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- Godot 官方 — 程序化几何工具对比：https://docs.godotengine.org/en/stable/tutorials/3d/procedural_geometry/index.html
- Godot 官方 — ImmediateMesh：https://docs.godotengine.org/en/stable/tutorials/3d/procedural_geometry/immediatemesh.html
- Godot 官方 — MultiMesh：https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html
- Godot 官方 — GeometryInstance3D（ShadowCastingSetting）：https://docs.godotengine.org/en/stable/classes/class_geometryinstance3d.html
- Godot 官方 — ZIPReader：https://docs.godotengine.org/en/stable/classes/class_zipreader.html
- Godot 官方 — PackedByteArray：https://docs.godotengine.org/en/stable/classes/class_packedbytearray.html
- Godot 官方 — 导出项目（非资源文件过滤器）：https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html
- Godot 官方 — 4.7 发布说明（2026-06-18，含 Wasm64）：https://godotengine.org/releases/4.7/
- GitHub issue — GDScript 每帧大量向量/矩阵运算的性能（定性，已 archived）：https://github.com/godotengine/godot/issues/46029
- GitHub issue — C# web 导出支持追踪：https://github.com/godotengine/godot/issues/70796
- GitHub issue — `render_mode shadows_disabled` 在 Compatibility 渲染器下不生效：https://github.com/godotengine/godot/issues/84386

本文未引用任何论坛帖子。
