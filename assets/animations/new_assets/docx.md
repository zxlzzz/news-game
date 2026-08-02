所有newassets的json都可能需要校对以接地，校对的方式如下：对于某一帧，如果它最低的位置在地面以下，则只将它整体向上平移（即只左右移动不水平移动，水平无需校对），有注意事项我会提前写明，后续每个名字开头为该json文件的说明
1. 以下所有内容均为child状态，均为完整json(非overlay)
~~child_single 统一作为所有的小孩站立态骨架~~ 已在 A-2 删除：逐关节比对
确认它 11 个关节 delta 全部是同一个值 (-6,+18)，就是 stand.json 整体平移，
没有任何独立姿势信息。小孩不需要单独的 clip——assets/skeleton.json 新增了
`child` 骨架（复用 human 的 joints/defaultPose，直接吃现有全部 human clip），
见 docs/roadmap.md「A-2」行。
hand_stand_up 为小孩倒立
hand_stand_down 为小孩由倒立回到站立态

（原 "2. overlay" 小节的 lift.json 已在 A-1 完成接线并移出本目录，
见 assets/animations/overlay/lift.json + manifest.json + AttachmentDefs.js。
右手举起吉他的姿势、可走路——本批接线用作 ChainTask pose 步骤的静态站立
持握姿势，未利用其"可走路"这层设计余量，见 docs/roadmap.md「A-1」行说明。）
