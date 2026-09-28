# 动物模型和动作的制作工具

做出 `godot/models/animal_husky.glb`、`animal_shibainu.glb`、`animal_cat.glb`（ChatGPT 做，2026-09-28 入库）。不是游戏运行时代码；`modeling/animals/` 带 `.gdignore`，Godot 不导入这里的东西。

两步：

1. **转换**（`models/animal_<名>/`）：读 Quaternius 原始 `.blend`（在仓库外 `D:/Godot/assets/quaternius-*`，路径在 `profile.json`；哈士奇写在 `convert_husky.py` 里），烘焙原动作、删 IK 辅助骨、每点限 4 权重、按肩高等比缩放、加厚四肢（`silhouette.py`），导出 `animal_<名>.glb`（只有原动作）。这个 glb 是第二步的输入，留在这里。
2. **动作**（`motions/<名>_motion_library/`）：读第一步的 glb，按 `motion_specs.json` 离线摆出 `NG_` 开头的原地动作，在原数据后面追加动画，写到 `godot/models/animal_<名>.glb`。`contact_plan.npz`、`motion_report.json` 是同时写出的落脚计划和报告，检查要用。

哈士奇是第一件，转换、检查、动作用自己目录里的脚本（`convert_husky.py`、`verify_husky.py`、`motions/husky_motion_library/build_motions.py`）；柴犬和猫走本目录的共用代码：

- `convert_animal.py` / `conversion_core.py`：转换。
- `silhouette.py`：四肢、爪子加厚，参数在 SETTINGS。
- `motion_core.py`：动作。
- `glb.py`、`verify_animal.py`、`verify_motion.py`：不经 Blender、直接读 glb 的检查（骨架、尺寸、接地、权重；动作的落脚、循环首尾、衔接，按 60 fps 插值查）。
- `render_review.py`：极端姿势和三只同比例的截图。

## 重跑（仓库根目录，Blender 5.2.2）

```
B=D:/steam/steamapps/common/Blender/blender.exe
$B --background --python godot/modeling/animals/models/animal_cat/convert_cat.py
$B --background --python godot/modeling/animals/motions/cat_motion_library/build_motions.py
python godot/modeling/animals/models/animal_cat/verify_cat.py
python godot/modeling/animals/motions/cat_motion_library/verify_motions.py     # → MOTION_LIBRARY_OK
python godot/modeling/check_model.py godot/models/animal_cat.glb              # → PASS
```

`convert` 可加 `-- --out <目录>`，`build_motions` 可加 `-- --out <目录> --glb <文件>`，输出到别处而不覆盖；加 `--preview` 渲染逐帧图，再跑同目录 `make_previews.py` 拼动图和播放页（这些不入库）。2026-09-28 入库时从头重跑过三只，和入库文件逐字节相同。

交货说明、对比图存档在 `modeling/review/animals/`（里面写的 `delivery/...` 路径是交货时的位置）。
