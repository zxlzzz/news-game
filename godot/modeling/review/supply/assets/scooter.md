# 电动车 · `scooter`

![Godot 实拍](../images/scooter.png)

- 模型：[GLB](../../../../models/scooter.glb)
- 重建脚本：[build_scooter.py](../../../build_scooter.py)；尺寸在开头 `P` 中。
- 依赖：[model_geometry.py](../../../model_geometry.py)、[vehicle_geometry.py](../../../vehicle_geometry.py)
- 实测尺寸：X 宽 **0.68** × Z 深 **1.85** × Y 高 **1.155** 米。
- 色槽：`accent`, `metal`, `metal_dark`。
- 原点：底部接触平面中心；立面和屋顶配件由场景另给安装高度。 +Y 向上，正面/车头/使用面朝 +Z。
- 几何：2284 三角面，19 个封闭零件或规范允许的贴花片。
- 设计：清单“摩托 / 电动车”选择电动车一款；带电池车体、前挡板和前灯，暂不含骑手。
- 交互参考：座面约 (0,0.855,-0.27)，车头 +Z。
- 来源：本项目原创脚本基本体建模；未使用第三方模型、纹理或生成服务。
- 检查：PASS；0 WARN。无警告。
- 复现：完整重跑后 GLB SHA-256 逐字节相同。

完整检查输出（同时保存为 [scooter.txt](scooter.txt)）：

```text
== C:\Users\Hsinlung\Desktop\news-game\godot\models\scooter.glb
   size  x 0.680  y 1.155  z 1.850 m
   box   min (-0.340, 0.000, -0.925)  max (0.340, 1.155, 0.925)
   triangles 2284: accent 124, metal 1512, metal_dark 648
   PASS
   EXTRA: outward volume and normal/winding consistency PASS
   SHA256 51f71c059903b5d27df1e1b0a376e6758ed9d00e832eecd9bccd70c2dbd6e4cf
   REBUILD IDENTICAL
```
