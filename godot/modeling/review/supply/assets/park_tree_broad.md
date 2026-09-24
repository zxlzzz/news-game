# 宽冠公园树 · `park_tree_broad`

![Godot 实拍](../images/park_tree_broad.png)

- 模型：[GLB](../../../../models/park_tree_broad.glb)
- 重建脚本：[build_park_tree_broad.py](../../../build_park_tree_broad.py)；尺寸在开头 `P` 中。
- 依赖：[model_geometry.py](../../../model_geometry.py)
- 实测尺寸：X 宽 **6.65** × Z 深 **4.35** × Y 高 **7.3** 米。
- 色槽：`bark`, `foliage`。
- 原点：底部接触平面中心；立面和屋顶配件由场景另给安装高度。 +Y 向上，正面/车头/使用面朝 +Z。
- 几何：1816 三角面，7 个封闭零件或规范允许的贴花片。
- 设计：树冠为封闭团块；无叶片、贴图或随机几何。
- 交互参考：无预埋交互节点；由类型库以后标注。
- 来源：本项目原创脚本基本体建模；未使用第三方模型、纹理或生成服务。
- 检查：PASS；0 WARN。无警告。
- 复现：完整重跑后 GLB SHA-256 逐字节相同。

完整检查输出（同时保存为 [park_tree_broad.txt](park_tree_broad.txt)）：

```text
== C:\Users\Hsinlung\Desktop\news-game\godot\models\park_tree_broad.glb
   size  x 6.650  y 7.300  z 4.350 m
   box   min (-3.250, 0.000, -2.350)  max (3.400, 7.300, 2.000)
   triangles 1816: bark 496, foliage 1320
   PASS
   EXTRA: outward volume and normal/winding consistency PASS
   SHA256 cfd47d308fe050651caf86194412599b37ed90dd99104adef0aa4fa408e6c53f
   REBUILD IDENTICAL
```
