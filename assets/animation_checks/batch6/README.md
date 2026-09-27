# 第六批人体动作检查

2026-09-26 验收。入库 7 条：`push_door`、`pull_door`、`push_stroller`、`push_cart`、`walk_cane`、`walk_stairs_up`、`walk_stairs_down`（`pull_door` 返工一次、`walk_stairs_down` 返工两次），在 `../../animations/npz/`。交货时的逐条统计见 [检查结果.json](检查结果.json)（返工的两条在各自文件夹的 `audit.json`）。

- `<名字>/review.gif`：Claude 验收时渲染的动图（左侧面、右俯视，俯视上方为前进方向），带门、车、拐杖。`preview.png`、`source_review.png`、`contact_check.json` 是 ChatGPT 交货时的检查图和数据。
- `walk_stairs_up/heel_check.json`：按虚拟脚跟（踝点下移站直时的踝高 4.6 厘米）量的结果；`partial_check.json` 是交货时的部分检查。
- `pull_door/`：返工版的检查（`rework_check.json`、`sequence.png`、`audit.json`）；`review.gif` 是 ChatGPT 渲染的。
- `walk_stairs_down/`：第二次返工版的检查（分阶段接触、落脚膝角 `landing_detail.png`、`说明.md`）；前两版的失败记录已删。

## 本轮解决的问题

拉门返工修正了局部约束接口：Kimodo 收尾校正忽略通用 `end-effector` 名称，现改用具名手脚约束类。新增连续 1 秒全身关键帧密度审计与带实时步速的 `scripts/render_door_review.py`。已入库素材不因这次工具修正自动重做。

Kimodo 的末端约束会扩展 Hand→Hand+MiddleEnd、Foot→Foot+ToeBase。偏移需平移整个组，已修正 `scripts/kimodo_motion_batch.py`。全身关键帧还需保证位置与全局旋转一致；仅改手肘位置会被后处理的旋转重建抵消。采用少量一致的全身姿势加局部手约束后，两条推车通过，无需改映射或源输出。

门的关节点避让通过不代表整条手臂通过。`scripts/review_door_contact.py` 对骨段和有限门板矩形做解析裁剪，检查骨段是否穿板。

拄拐采用刚性 0.82 m 杖身和自然倾斜。支撑阶段围绕一个固定着地点拟合旋转，按真实刚性杖尖重新量高度和滑动，不缩放杖身，不改人体输出。

## 重查

在仓库根运行。检查脚本会往所给目录里（门、拐杖）或旁边（车，`<名字>_cart.json/.png`）写检查文件，素材目录里只该有 NPZ、meta、support，重查完把这些文件删掉：

```text
python scripts/review_cart_contact.py assets/animations/npz/push_stroller --model baby_stroller
python scripts/review_cart_contact.py assets/animations/npz/push_cart --model shopping_cart
python scripts/review_door_contact.py assets/animations/npz/push_door
python scripts/review_cane_contact.py assets/animations/npz/walk_cane
python godot/modeling/check_model.py godot/models/held_cane.glb
```

这些是离线映射检查，没有运行或修改街道场景。比例改变后必须重新检查接触。
