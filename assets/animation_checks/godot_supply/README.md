# Godot 街道人体动作验收（2026-09-24）

已交 14 条（库内累计 77 条），位于 `../../animations/npz/`，与原 63 条存放在一起。生成器为本机 Docker 中的 Kimodo-SOMA-RP-v1.1（NF4 文本编码器），30 fps、100 步、CFG 2/2、官方后处理。未修改生成后的关节数据和映射参数。之后已用进街道 demo（`godot/scenes/street_demo/`，人由 `godot/npc/crowd.gd` 放，用哪些动作见 `godot/npc/crowd-params.json`）。

以下是数据绘图验收，**不是 Godot 实机截图**：现有映射的正面／侧面使用倍率 3；下方显示源全骨架侧面和完整手部俯视。道具灰块按本轮模型的尺寸提供参照：柜台 0.9 米、棋桌 0.75 米、座面 0.45 米。棋桌凳子在图中仅作尺寸参照；看棋 NPC 实际应站在桌子侧面，避开凳子。

| 动作 | 图片 | 数据 |
|---|---|---|
| 正常走路 `walk` | [正侧面与手部](walk_mapped.png) · [循环预览](walk_mapped.gif) | [检查值](walk_mapped_metrics.json) |
| 背手慢走 `walk_slow` | [正侧面与手部](walk_slow_mapped.png) · [循环预览](walk_slow_mapped.gif) | [检查值](walk_slow_mapped_metrics.json) |
| 长椅坐姿 `sit_bench` | [正侧面与手部](sit_bench_mapped.png) · [循环预览](sit_bench_mapped.gif) | [检查值](sit_bench_mapped_metrics.json) |
| 后仰瘫坐 `slouch_bench` | [正侧面与手部](slouch_bench_mapped.png) · [循环预览](slouch_bench_mapped.gif) | [检查值](slouch_bench_mapped_metrics.json) |
| 慢跑 `jog` | [正侧面与手部](jog_mapped.png) · [循环预览](jog_mapped.gif) | [检查值](jog_mapped_metrics.json) |
| 牵狗步态（仅人） `walk_dog` | [正侧面与手部](walk_dog_mapped.png) · [循环预览](walk_dog_mapped.gif) | [检查值](walk_dog_mapped_metrics.json) |
| 摊主吆喝 `vendor_call` | [正侧面与手部](vendor_call.png) | [检查值](vendor_call_metrics.json) |
| 整理货品 `vendor_tidy` | [正侧面与手部](vendor_tidy.png) | [检查值](vendor_tidy_metrics.json) |
| 向前递物 `give_item` | [正侧面与手部](give_item.png) | [检查值](give_item_metrics.json) |
| 伸手接物 `receive_item` | [正侧面与手部](receive_item.png) | [检查值](receive_item_metrics.json) |
| 指选商品 `choose_item` | [正侧面与手部](choose_item.png) | [检查值](choose_item_metrics.json) |
| 取钱付款 `pay` | [正侧面与手部](pay.png) | [检查值](pay_metrics.json) |
| 坐着落子 `chess_move` | [正侧面与手部](chess_move.png) | [检查值](chess_move_metrics.json) |
| 站着看棋 `chess_watch` | [正侧面与手部](chess_watch.png) | [检查值](chess_watch_metrics.json) |

[落子第 50–76 帧细查](chess_move_focus.png)：落子停留段手高约 0.761–0.780 米，对照桌面 0.75 米；落点在棋盘近侧。髋高约 0.435–0.456 米，对照凳面 0.45 米。源模型不提供精细捏取手势；不包含棋子、钱、货物或握持验证。接物动作收手后下放，没有持续抱物。

[统一数值验证](validation.json)：14 条、1415 帧；数组结构、有限性、首尾、骨长和 SHA-256 全部通过。骨长最大变化 0.952 毫米；最大单帧关节位移 0.248 米出现在慢跑摆腿。四条移动循环的根位移全程向前，端点对齐误差小于 0.001 毫米。首尾同姿势不代表全身速度严格连续或完全无滑脚。

`choose_item`、`pay`、`chess_move` 使用源姿势关键帧或手部约束改善语义。约束目标保存在 meta 中；手部约束并非精确 IK，最终按映射结果验收。逐条经过与不足见[动作素材清单](../../动作素材清单.md)。

## 循环使用与限制

六条新循环登记在 [clip_endpoints.json](../../animations/clip_endpoints.json)。末帧与首帧是同一姿势，连续播放只播一次重复端点；周期用 `(帧数 - 1) / fps`。正常走路 2.2 秒，慢走 2.4 秒，慢跑 2.6 秒，牵狗步态约 2.33 秒；两条坐姿约 2.97 秒。移动素材保留源根位移（含少量横移），播放端应接在当前位置，不能每圈跳回绝对原点。街道 demo 按这些规则播放：去掉动作自带的前进量、按走过的距离推进，人接在当前位置（`godot/npc/clip_pose.gd`）。

[正常走路接缝细查](walk_seam.png)与[慢跑完整步态周期](jog_mapped_focus.png)补充普通抽样。走路的生成曾出现第一帧回退；最终按自然试片周期约束中间相位和首尾邻帧，四条移动成品均无根前进方向回退。GIF 使用现有映射、镜头跟随髋部、跳过重复端点；不是游戏录像。

直坐髋高约 0.434–0.436 米，瘫坐约 0.450–0.452 米，对照 0.45 米座面；瘫坐腿向前多伸约 0.15 米。直坐的源手在腿上，现有比例映射后手高约 0.62–0.64 米，尚不精确贴腿。瘫坐双臂下垂，摆位需给手臂与靠背留空。四条移动素材映射脚尖最低约负 0.3–2 厘米，未做额外接地修正。

`walk_dog` 仅包含人的右手牵绳姿势，不含狗、绳子或精细握绳手指。

## 狗、牵狗、骑车（程序生成，2026-09-24）

姿势由 Godot 代码每帧现算，不播动作文件；路线见 [design_route_animal_motion.md](../../../design_route_animal_motion.md) §2（暂定采纳）。代码和参数说明在 [godot/README.md](../../../godot/README.md)"狗、骑车、牵狗"一节。以下动图都是 Godot 实机录制（审阅场景 `godot/tools/locomotion_review.tscn`，游戏同款画风），每种一个侧面、一个游戏俯角。

| 内容 | 侧面 | 俯角 | 录的是什么 |
|---|---|---|---|
| 狗 | [dog_side.gif](dog_side.gif) | [dog_high.gif](dog_high.gif) | 边走边转弯 → 小跑 → 停下站定 → 慢走 |
| 牵狗 | [leash_side.gif](leash_side.gif) | [leash_high.gif](leash_high.gif) | 人走 12 秒、停 4 秒，路线慢慢拐弯；狗在右手一侧 |
| 自行车 | [bicycle_side.gif](bicycle_side.gif) | [bicycle_high.gif](bicycle_high.gif) | 3 米/秒 S 形路线，蹬 7 秒、滑行 3 秒 |
| 电动车 | [scooter_side.gif](scooter_side.gif) | [scooter_high.gif](scooter_high.gif) | 4.5 米/秒 S 形路线 |

每个动图同名的 `.png` 是其中三分之一处的一帧。

**检查**（`godot/tools/check_locomotion.gd`，结果 `LOCOMOTION_OK`）：
- 狗：30/60/120 帧每秒各跑 5 种情况、每种 60 秒——骨长误差 0.000007 米（浮点精度），着地脚移动 0；走路按左后→左前→右后→右前抬脚；直线上实际速度等于给定速度。
- 骑车：类型库里每辆可骑的车、每种体型，曲柄转一圈取 72 个角度——手够得着车把、脚够得着脚踏，腿伸直程度 0.48–0.85（自行车）、0.76（电动车），不超过上限 0.97。
- 牵狗：走走停停 2 分钟，手到项圈最远 1.34 米，没有超过绳长 1.35 米。

**和 ChatGPT 版本的区别**：它为了让脚够到踏板，把人往前挪出了车座（自行车 18 厘米、电动车 38 厘米）；现在人一直坐在座上，够不着就由检查报错。骑姿不再绑定某一辆车：车座、车把、脚踏的位置按节点名从模型读（约定见 `godot/modeling/模型制作说明.md` 第 11 节），换车不用改代码。狗的求解沿用了它的做法（腿够不着时身体减速、提早换脚），参数全部挪进 JSON，补了弓背和项圈点。电动车模型改成踏板式：车身只在座下，座前是放脚的低踏板，否则膝盖会插进车身。

**还没有**：狗的坐、趴、嗅地等原地动作；上下车；骑车人的上身只有随蹬踏的轻微左右晃，没有转头等小动作（可以以后从 Kimodo 取）。狗、牵狗、骑车已经用进街道 demo。
