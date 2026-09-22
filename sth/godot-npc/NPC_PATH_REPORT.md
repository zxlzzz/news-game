# NPC 最小通路报告（2026-09-22）

一个火柴人用 npz 动作数据（phone_walk）、按 `npc-skeleton-mapping.md` 的映射、在 terrace 场景的画风下走一段。
最初一轮只写代码和静态检查；09-22 起已在 Godot 里跑过（见第 6 节第 3 条）。
**位置（09-22）**：项目已放进仓库 `sth/godot-npc/`（从 `Desktop/style_test/proj_npc` 复制，不含编辑器缓存 `.godot/`）。Desktop 上的 proj_npc 从此作废，以这里为准；原 `Desktop/style_test/proj` 仍未动过。

## 1. 怎么跑

以下 `godot` 指你本机的 Godot 4.7.2。Windows 上要在终端里看到 `print` 输出，用带 `_console` 的那个 exe。

| 做什么 | 命令（在仓库的 `sth/godot-npc` 下） |
|---|---|
| 看效果（窗口常驻，火柴人循环走） | `godot --path .` |
| 映射对拍 | `godot --path . --headless -- --check-mapping` |
| 原来的单帧出图（保留） | `godot --path . -- --params res://params/terrace.json --out output/x.png`（`output/` 不进 git） |

- 看效果时参数默认就是 `res://params/terrace.json`，也可加 `-- --params ...` 换。也可以在编辑器里导入 `sth/godot-npc/project.godot`，对 `main.tscn` 按 F6。
- `--check-mapping`：打印一行 `MAPPING_OK max_err=... over N values in 4 frames` 或 `MAPPING_FAIL ...`（带误差最大的点、期望值、实际值），然后退出；退出码 0 / 1。
- 重新导出动作数据（在仓库根目录）：
  `python scripts/export-npc-motion.py --skeleton-definition C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py --out sth/godot-npc/npc/motion`
- 重新生成对拍参考值（在 `sth/godot-npc` 下；直接 import 仓库里的原版 .mjs，不是副本）：
  `node tools/make_mapping_reference.mjs --mapping ../motion-study/skeleton-mapping.mjs`

## 2. 文件

仓库里新增 `scripts/export-npc-motion.py` 和本项目 `sth/godot-npc/`；已有文件只改了 `.gitignore`（09-22 加一条 `/sth/godot-npc/output/`；`.godot/`、`*.import` 原本就被忽略）。`npc/motion/` 是导出产物，但重新生成要用本机的 Kimodo `definitions.py`，所以和 `sth/motion-study/motions.json` 一样随仓库保存。Godot 编辑器打开过项目后生成的 `*.uid` 一并保存（仓库里其他 Godot 项目也是这样）；编辑器重写 `project.godot` 时去掉了两行等于默认值的设置（`forward_plus`、阴影柔化 2），效果不变。原 proj 没动（见第 7 节）。本项目相对原 proj：

| 文件 | 说明 |
|---|---|
| `npc/motion/index.json`、`npc/motion/<clip>.json`（63 条） | 导出脚本产物：16 个源关节 + 每条 fps |
| `npc/skeleton-params.json` | 仓库 `sth/motion-study/skeleton-params.json` 的逐字节副本 |
| `npc/skeleton_mapping.gd` | `skeleton-mapping.mjs` 的逐行移植（纯函数，参数只从 P 进来） |
| `npc/npc_data.gd` | 读文件 + 校验；缺文件/缺字段/格式不对一律报错，不兜底 |
| `npc/stick_npc.gd` | 一个 NPC：逐帧映射、画线和头、播放、循环位移 |
| `npc/mapping_check.gd` | `--check-mapping` 的逻辑 |
| `npc/mapping_reference.json` | node 跑原版 .mjs 得到的参考值 |
| `npc/npc_scene.json` | NPC 放哪、朝向、缩放、墨色（全部必填）；scale = 3（09-22 定，见第 6 节第 1 条） |
| `style/stick_line.gdshader` | `ink_line.gdshader` 的火柴人专用副本：圆头 + 按米算线宽 |
| `tools/make_mapping_reference.mjs` | 生成参考值 |
| `main.gd`（改） | 加了 `--check-mapping` 入口、加 NPC；**没有 `--out` 时不再截图退出**（原来默认写 `/home/claude/render.png` 后退出），每帧 `frame N` 打印也只在 `--out` 模式下出现 |
| `NPC_PATH_REPORT.md` | 本文件 |
| `models/stand_idle.json`（删） | 原来的静态火柴人素材（09-22 按你的要求删除；原 proj 里还有一份） |
| `params/terrace.json`、`street_q.json`、`dbg4.json`、`dbg5.json`（改） | 只删了引用上面那个素材的 `sticks` 条目，其余字节不变 |

`style/ink_line.gdshader`、`ink_builder.gd`、`terrace.glb` 都没改；其余 params 没改。`main.gd` 里画静态火柴人的 `_add_stick` 代码留着（现在没有 params 用它，但 `stick_npc.gd` 是照它写的，注释也指向它）；生成那个素材的 `tools/npz_to_stick.py` 也留着。

## 3. 根节点

**结论：`posed_joints` 已经包含根节点位移。** 63 条 clip 全部检查：`posed_joints[:, Hips]` 与 `root_positions` 逐位相同（最大差 0.0，不是“很小”，是完全相等），即 `posed_joints` 是世界坐标，Hips 那一列就是根轨迹。例如 phone_walk 的 Hips 在 4 秒里水平走了 (0.090, 1.725) m，和 `root_positions` 一样。

所以导出只取 `posed_joints` 的 16 个关节（映射要用的就是这 16 个，Hips 在里面），**不另导 `root_positions`**。导出脚本对每条 clip 断言这个相等关系，哪天有素材不满足就直接报错停下，不会静默导错。（顺带：`smooth_root_pos` 有 1 条 clip 没有，本路线不用它。关节编号用 `definitions.py` 的名字查出，和映射规格第 1 节的对照表完全一致。）

播放端怎么消费（`design_route_npc_motion_supply.md` 第 73 行）：

- 映射本身会把胯和踝按腿长比例 r 缩放，水平以片段第一帧 Hips 为原点（规格 §3.2）。r = (0.12+0.13)/(0.528+0.423) = 0.2629。
- 画的时候每个点减掉片段第一帧 Hips 的水平坐标（竖直不动，地面仍是 y=0），挂在 NPC 节点下。**节点的 position 就是“这一遍开始时 NPC 所在的位置”**，片段内的相对位移由映射后的点自己带出来（已乘 r，所以脚不打滑）。素材的绝对坐标不直接使用。
- 每循环一次，position 加上这一遍的位移（最后一帧映射后的 H 减第一帧的 H，只取水平）。所以不会跳回原点。phone_walk 每遍在人物局部走 0.454 m，4 秒一遍；现在 scale = 3，世界里每遍 1.36 m，约 0.34 m/s。
- 接缝：第 119 帧和下一遍第 0 帧的根位置相同，所以那一帧（1/30 秒）没有前进。姿势会跳一下，因为 phone_walk 生成时没有首尾约束（meta 里 `endpoints: false`）；按第 73 行，这不要求素材解决。
- 2026-09-22 首尾规则已改，见 `design_route_npc_motion_supply.md` §5。
- 只消费位移，不消费转向。phone_walk 片段内朝向在 80°–100° 之间摆动，整遍的位移方向偏 +Z 约 3°；循环累加后就是一条直线，不会转圈。

## 4. 线宽

规格里 `line = 0.035`、`torsoLine = 1.15` 都是**米**，跟人物一起缩放。实现：

- 每段的宽度 = `line × 倍数`（躯干和脖子的倍数是 `torsoLine`，四肢是 1），和 `study.mjs` 的 `P.line*it.k` 一样。这个值以“人物局部米”写进每段顶点（CUSTOM1.x），不写死像素。
- 换算成像素在 shader 里做：`像素 = 宽度 × 节点缩放 × |PROJECTION[1][1]| × 视口高/2 ÷ w`。正交相机下 `PROJECTION[1][1] = 2/size`、`w = 1`，所以就是
  **像素宽 = 宽度(米) × scale × 视口高(像素) ÷ 相机 size**。
- terrace.json：1920×1080，正交 `size = 10.5`，即每米 1080/10.5 = 102.86 像素。现在 `npc_scene.json` 的 `scale = 3`：
  - 四肢 0.035×3 = 0.105 m → **10.8 px**；躯干/脖子 0.035×1.15×3 = 0.121 m → **12.4 px**
  - 头直径 0.12×3 = 0.36 m → 37 px
  - 站立身高 0.58×3 = 1.74 m → 竖直约 179 px；相机俯视 36°，竖直方向在屏幕上再乘 cos36°，看到的大约 145 px 高
  - scale = 1 时这些数都除以 3（四肢 3.6 px、躯干 4.14 px）。作对比：已删掉的旧静态火柴人是固定 4 px，环境线是 1.5 px。
  - 以上按视口 1080 高算。窗口实际更矮时按比例缩小（09-22 那张截图里大约是一半，即视口约 540 高）。
- 窗口改大小、改相机 size、改 scale，线宽都自动跟着变（每帧在 shader 里算），始终保持“线宽/身高”比例不变。
- 圆头：每段的四边形往两端各多伸出半个线宽，fragment 里把胶囊形以外的像素丢掉，得到等宽圆头线。环境用的 `ink_line` 仍是原样（没有圆头，两端各伸出 1/4 线宽）。

## 5. 画法对照规格 §5

- 头：实心圆，面朝相机，做法照搬 `main.gd` 的 `_add_stick`（同样往相机方向挪 0.02），半径取 `headR`，每帧移到映射出的头中心。
- 线：等宽圆头，`stick_line.gdshader`，线段数据沿用 `_segments_mesh` 的结构（每段 4 个顶点 2 个三角形，CUSTOM0 不变）。
- 不画影子：线和头都 `cast_shadow = OFF`；不接受阴影：两者都是 unshaded（线的 shader 本来就是 unshaded + shadows_disabled，头的材质另外设了 `disable_receive_shadows`）。
- “各段按深度从远到近画，头也参与排序”：**没有显式排序，靠深度缓冲**。理由：全身是同一个不透明的墨色，远近谁先画结果一样。如果以后头和线用不同颜色，或者要半透明，就得改成显式排序。
- 墨色 `[0.1,0.1,0.1]` 和 `depth_bias 0.03` 抄自 terrace.json 里原静态火柴人的 `line`（那个条目现已删除，数值留在 `npc_scene.json`）。

## 6. 没把握的地方

1. **人物缩放：09-22 定为 `scale = 3`**（最初按规格字面放的是 1，实机看太小）。3 倍时身高 1.74 m，约等于 Kimodo 原始演员的 1.76 m；膝高 0.44 m，对得上普通座椅高度（这个场景的测试长椅面是 0.51 m，稍高）；胯高 0.79 m，0.95 m 的栏杆在腰上方。代价是线很粗（四肢约 11 px，1080p 下），这是已确认的“线宽/身高”比例带来的；如果嫌重，该改的是 `line` 参数（属于映射规格，由你定），而不是再把人缩小。改 `npc/npc_scene.json` 的 `scale`，步幅、速度、线宽、头都会一起按比例变。
2. **对拍覆盖不全。** 按要求取的 4 帧（phone_walk、stand_idle 各第 0 帧和第 60 帧）**不会走到“举手推开”和“够不着时降胯”这两个分支**；而 phone_walk 播放时有 21/120 帧会走到降胯分支。所以 Godot 这边报 MAPPING_OK，只能证明主路径没错。
   我在 Godot 之外做了补充检查：把 `skeleton_mapping.gd` 用正则机械地转成 Python（不手改），和 node 跑原版 .mjs 比较全部 63 条、6330 帧，最大差 1.4e-15，其中举手推开 1169 次、降胯 1324 次都覆盖到了。但这只验证了逻辑，没验证 Godot 运行时。想让 Godot 端也覆盖到，可以在 `tools/make_mapping_reference.mjs` 的帧列表里加上 phone_walk 会降胯的帧和 wave_both_overhead 的帧，重新生成参考值（这超出了本次指定的范围，所以我没加）。
3. **已在 Godot 里跑过（09-22）。** 你实机跑通了画面；`--check-mapping` 用 `D:/Godot/Godot_v4.7.2-stable_win64_console.exe` 跑出 `MAPPING_OK max_err=6.5e-17 over 384 values in 4 frames`，退出码 0。第 2 条的覆盖范围问题仍然存在。
4. **移植时改动的写法**（只是 GDScript 的限制，逻辑没改）：`createSkeletonMapper` 闭包改成一个对象（`new(names, restFrame)` 然后 `mapFrame()`）；`throw` 改成设 `error` 字段，调用方检查后报错退出；`len` 是 GDScript 内置函数，改名 `length`；GDScript 不许内层块变量和外层同名，所以 mapFrame 里两个名字改了：降胯循环里的 `o` → `ov`，手的点 `hd` → `hand`；`{knee,end}=ik()` 拆开写。向量用 64 位 float 数组（和 JS 一致），不用 Vector3（32 位），只在画的时候转成 Vector3。
5. **位置和朝向是我选的**：`pos (-3, 0, -2)`、`yaw 87`，让它沿世界 +X 走（素材是朝 +Z 偏 3° 走，转 87° 后正好朝 +X）。这条线上没有障碍（柱子前脸在 z = -2.6，栏杆在 z ≈ 0；3 倍时身体侧向最多伸出 0.25 m，算上线宽最靠里到 z ≈ -2.36，离柱子还有 0.24 m），右手拿手机那一侧朝向相机。按 0.34 m/s，约 38 秒后走出右侧平台（x = 10）继续往空中走——没有寻路或停止逻辑（不在这次范围里），想再看就重开。
6. **原来的静态火柴人已删（09-22）。** 素材是 `models/stand_idle.json`（旧的 11 关节原始比例数据，由 `tools/npz_to_stick.py` 生成）。terrace、street_q、dbg4、dbg5 四个 params 都引用它，已一并删掉这些 `sticks` 条目，否则用这几个 params 启动会去读一个不存在的文件。要找回的话，原 proj 里还有这个文件和原来的 params。
7. **逐帧播放**：按要求 30 fps 一帧一帧地播，帧与帧之间不插值（`study.mjs` 的预览是插值的），在 60 Hz 屏幕上看会有点一顿一顿的。
8. **透视相机**：像素换算和圆头在正交相机下是精确的（terrace.json 用的是正交）。换成透视相机时，一段线两头的半径会略有不同，四边形变成梯形，圆头会有很小的变形。
9. **导出精度**：和 `export-motion-study.py` 一样四舍五入到 5 位小数（0.01 mm）。参考值和 Godot 读的是同一批文件，对拍不受影响；和原始 npz 的差 ≤ 5e-6 m。
10. **参数改了要重新生成参考值**：`--check-mapping` 会先比对参数副本和生成参考值时用的参数，不一致就报 `MAPPING_FAIL`，并提示重新生成参考值，不会拿错参数去比。
11. `--check-mapping` 写在 `--` 前面也能识别（两种参数列表都查了），这点无害。

## 7. 静态检查记录

- 前置条件 4 条都满足（映射规格第 3 行有“2026-09-20 确认”；路线文档第 73 行原文；两个路径都存在）。
- 仓库 `git status` 只多了 `scripts/export-npc-motion.py`（其余未跟踪项是本次之前就有的）。npz 导出前后 sha256 一致。
- 原 proj：复制前记录了 24 个文件的 sha256 和修改时间，收尾时逐个比对。
- `cmp proj/style/ink_line.gdshader proj_npc/style/ink_line.gdshader` 为空。
- `MAPPING_OK` / `MAPPING_FAIL` / `--check-mapping` 都出现在 proj_npc 的 .gd 里；`npc_data.gd` 读 `skeleton-params.json`；`skeleton_mapping.gd` 里没有 12 个参数中任何一个的数值（文件里的数字只有 0、0.0、0.423、0.5、0.528、1、1.0、2、3、20、180、1e-4、1e-6、1e-9，以及注释里的 17、32、64）。
- 转写成 Python 后对照原版 .mjs：4 个参考帧误差 7e-17；全部 6330 帧误差 1.4e-15。
