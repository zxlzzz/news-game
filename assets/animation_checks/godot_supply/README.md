# Godot 街道人体动作验收（2026-09-24）

已交 8 条，位于 `../../animations/npz/`，与原 63 条存放在一起。生成器为本机 Docker 中的 Kimodo-SOMA-RP-v1.1（NF4 文本编码器），30 fps、100 步、CFG 2/2、官方后处理。未修改生成后的关节数据，未修改映射参数或接入游戏。

以下是数据绘图验收，**不是 Godot 实机截图**：现有映射的正面／侧面使用倍率 3；下方显示源全骨架侧面和完整手部俯视。道具灰块按本轮模型的尺寸提供参照：柜台 0.9 米、棋桌 0.75 米、座面 0.45 米。棋桌凳子在图中仅作尺寸参照；看棋 NPC 实际应站在桌子侧面，避开凳子。

| 动作 | 图片 | 数据 |
|---|---|---|
| 摊主吆喝 `vendor_call` | [正侧面与手部](vendor_call.png) | [检查值](vendor_call_metrics.json) |
| 整理货品 `vendor_tidy` | [正侧面与手部](vendor_tidy.png) | [检查值](vendor_tidy_metrics.json) |
| 向前递物 `give_item` | [正侧面与手部](give_item.png) | [检查值](give_item_metrics.json) |
| 伸手接物 `receive_item` | [正侧面与手部](receive_item.png) | [检查值](receive_item_metrics.json) |
| 指选商品 `choose_item` | [正侧面与手部](choose_item.png) | [检查值](choose_item_metrics.json) |
| 取钱付款 `pay` | [正侧面与手部](pay.png) | [检查值](pay_metrics.json) |
| 坐着落子 `chess_move` | [正侧面与手部](chess_move.png) | [检查值](chess_move_metrics.json) |
| 站着看棋 `chess_watch` | [正侧面与手部](chess_watch.png) | [检查值](chess_watch_metrics.json) |

[落子第 50–76 帧细查](chess_move_focus.png)：落子停留段手高约 0.761–0.780 米，对照桌面 0.75 米；落点在棋盘近侧。髋高约 0.435–0.456 米，对照凳面 0.45 米。源模型不提供精细捏取手势；不包含棋子、钱、货物或握持验证。接物动作收手后下放，没有持续抱物。

[统一数值验证](validation.json)：8 条、945 帧；数组结构、有限性、首尾、骨长和 SHA-256 全部通过。首尾一致仅表示本批一次性手势恢复入口姿势，不证明循环接缝速度连续。

`choose_item`、`pay`、`chess_move` 使用源姿势关键帧或手部约束改善语义。约束目标保存在 meta 中；手部约束并非精确 IK，最终按映射结果验收。逐条经过与不足见[动作素材清单](../../动作素材清单.md)。

## 尚未交付

`walk`、`walk_slow`、`sit_bench`、`slouch_bench`（可选）、`jog`、`walk_dog`。memo 与 9 月 22 日路线对循环首尾的规定冲突，已询问 Hsinlung；收到答复后继续。普通走路已有交替步态试片；坐姿试片已接近 0.45 米座面。它们仍在临时工作区，不计入素材库。

狗的画法与动作另走动物路线；本批只处理人体。
