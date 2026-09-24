# 自行车 · `bicycle`

![Godot 实拍](../images/bicycle.png)

- 模型：[GLB](../../../../models/bicycle.glb)
- 重建脚本：[build_bicycle.py](../../../build_bicycle.py)；尺寸在开头 `P` 中。
- 依赖：[model_geometry.py](../../../model_geometry.py)、[vehicle_geometry.py](../../../vehicle_geometry.py)
- 实测尺寸：X 宽 **0.57** × Z 深 **1.8** × Y 高 **1.065** 米。
- 色槽：`metal`, `metal_dark`。
- 原点：底部接触平面中心；立面和屋顶配件由场景另给安装高度。 +Y 向上，正面/车头/使用面朝 +Z。
- 几何：2780 三角面，23 个封闭零件或规范允许的贴花片。
- 设计：双三角车架、空心轮胎、三根粗辐条、车座与车把；少量承重细杆低于 5 cm 是辨识轮廓所需。
- 交互参考：座面约 (0,0.9775,-0.24)，把手 y=1.04；骑乘匹配以后做。
- 来源：本项目原创脚本基本体建模；未使用第三方模型、纹理或生成服务。
- 检查：PASS；0 WARN。无警告。
- 复现：完整重跑后 GLB SHA-256 逐字节相同。

完整检查输出（同时保存为 [bicycle.txt](bicycle.txt)）：

```text
== C:\Users\Hsinlung\Desktop\news-game\godot\models\bicycle.glb
   size  x 0.570  y 1.065  z 1.800 m
   box   min (-0.285, -0.000, -0.900)  max (0.285, 1.065, 0.900)
   triangles 2780: metal 1984, metal_dark 796
   PASS
   EXTRA: outward volume and normal/winding consistency PASS
   SHA256 fd792de50d41adf2e6dce20daae10744e690027ac77ec5d8726cc5858e581936
   REBUILD IDENTICAL
```
