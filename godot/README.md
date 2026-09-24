# godot/ — 游戏工程（Godot 4.7.2，Forward+）

场景规格见仓库根目录 `scene_spec.md`，模型要求见 `modeling/模型制作说明.md`（依据 `建模规范与参数.md`），要做的素材见 `素材清单.md`。
2026-09-23 起取代 `sth/godot-npc/`（已删除，历史在 git 里）。

## 运行

`godot` 指 `D:/Godot/Godot_v4.7.2-stable_win64_console.exe`（带 `_console` 的才能在终端看到输出）。都在本目录下执行。

| 做什么 | 命令 |
|---|---|
| 编辑器打开 | `godot --path . -e`（第一次打开会导入模型） |
| 看街道 demo | `godot --path .` |
| 截一帧图后退出 | `godot --path . -- --shot <png 绝对路径>` |
| 只导入模型 | `godot --headless --path . --import` |
| 打印各物件类型尺寸 | `godot --headless --path . -s res://tools/print_bounds.gd` |
| 检查一个模型是否合规 | `python modeling/check_model.py <glb>` → `PASS` / `FAIL` |
| 火柴人映射对拍 | `godot --headless --path . -s res://tools/check_mapping.gd` → `MAPPING_OK` / `MAPPING_FAIL` |

## 目录

| 位置 | 内容 | 规格对应 |
|---|---|---|
| `scenes/<场景>/level.tscn` | 地面带 + 物件实例；指向配色、视角、人口 | §1 |
| `scenes/<场景>/view.tscn` | 相机 + 方向光 | §1 |
| `scenes/<场景>/population.tres` | 各类路人数量 | §1 |
| `palettes/*.tres` | 配色（可被多个场景共用）；现在只有 `gray.tres` 黑白灰 | §1 |
| `types/*.tscn` | 物件类型库：外层节点（标签 = 节点分组）+ 子节点 `model`（glb，缩放在这里设） | §2 |
| `core/slots.tres` | 全局色槽及其标记 | §2 |
| `core/material_maps/*.tres` | 第三方材质名 → 色槽，一个素材包一份 | §2 |
| `core/style.tres` | 全局画风参数 | §2 |
| `core/level.gd` | 关卡根节点：运行时检查规矩、算推导量、上画风、放相机和光 | §3、§4 |
| `core/ground_strip.gd` / `ground_band.gd` | 地面带节点（编辑器里改了立刻重建） | §1 |
| `core/bounds.gd` | 物件尺寸 = 模型包围盒 | §3 |
| `style/` | 画风 shader 和抽线代码（从 sth/godot-npc 原样搬来，只改了颜色输入格式） | |
| `npc/` | 火柴人：映射移植、播放、63 条动作数据、对拍参考值 | |
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

## 现在还没做

寻路和走动代价、斑马线切区域、出口和生成点、路人、固定岗位的人、跑步和遛狗路线。等 `素材清单.md` 里第一批素材到了再做。
