# 厚灯箱招牌 · `shop_sign_box`

![Godot 实拍](../images/shop_sign_box.png)

- 模型：[GLB](../../../../models/shop_sign_box.glb)
- 重建脚本：[build_shop_sign_box.py](../../../build_shop_sign_box.py)；尺寸在开头 `P` 中。
- 依赖：[model_geometry.py](../../../model_geometry.py)
- 实测尺寸：X 宽 **2.6** × Z 深 **0.32** × Y 高 **0.8** 米。
- 色槽：`metal`, `trim_dark`。
- 原点：底部接触平面中心；立面和屋顶配件由场景另给安装高度。 +Y 向上，正面/车头/使用面朝 +Z。
- 几何：24 三角面，2 个封闭零件或规范允许的贴花片。
- 设计：空白独立招牌；以底边中心为安装锚点，场景提供安装高度。
- 交互参考：无预埋交互节点；由类型库以后标注。
- 来源：本项目原创脚本基本体建模；未使用第三方模型、纹理或生成服务。
- 检查：PASS；0 WARN。无警告。
- 复现：完整重跑后 GLB SHA-256 逐字节相同。

完整检查输出（同时保存为 [shop_sign_box.txt](shop_sign_box.txt)）：

```text
== C:\Users\Hsinlung\Desktop\news-game\godot\models\shop_sign_box.glb
   size  x 2.600  y 0.800  z 0.320 m
   box   min (-1.300, 0.000, -0.150)  max (1.300, 0.800, 0.170)
   triangles 24: metal 12, trim_dark 12
   PASS
   EXTRA: outward volume and normal/winding consistency PASS
   SHA256 71301bde4c261d890d5b3ac1b5501b8c7bedbab0ed917bbc26986cfa9fb7ced3
   REBUILD IDENTICAL
```
