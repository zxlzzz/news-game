所有newassets的json都可能需要校对以接地，校对的方式如下：对于某一帧，如果它最低的位置在地面以下，则只将它整体向上平移（即只左右移动不水平移动，水平无需校对），有注意事项我会提前写明，后续每个名字开头为该json文件的说明
1. 以下所有内容均为child状态，均为完整json(非overlay)
~~child_single 统一作为所有的小孩站立态骨架~~ 已在 A-2 删除：逐关节比对
确认它 11 个关节 delta 全部是同一个值 (-6,+18)，就是 stand.json 整体平移，
没有任何独立姿势信息。小孩不需要单独的 clip——assets/skeleton.json 新增了
`child` 骨架（复用 human 的 joints/defaultPose，直接吃现有全部 human clip），
见 docs/roadmap.md「A-2」行。
~~hand_stand_up 为小孩倒立~~ / ~~hand_stand_down 为小孩由倒立回到站立态~~
已在 A-3 用 scripts/rezero-clips.py 归零接地、移入
assets/animations/transition/ 并注册进 manifest.json（未手改任何关节坐标）。
两者各自仍有 1 条"首帧未接地"警告未消除——那是动作中段悬空姿势的正常表现
（保证全片段不穿地这条正确算法的必然副作用），不是遗留 bug，详见
docs/roadmap.md「A-3」行的完整说明。

（原 "2. overlay" 小节的 lift.json 已在 A-1 完成接线并移出本目录，
见 assets/animations/overlay/lift.json + manifest.json + AttachmentDefs.js。
右手举起吉他的姿势、可走路——本批接线用作 ChainTask pose 步骤的静态站立
持握姿势，未利用其"可走路"这层设计余量，见 docs/roadmap.md「A-1」行说明。）

## 多帧 sub-event overlay 格式（SE-2）

`overlay` + `participants` 的 duet clip（`push` / `give_item` / `handshake` / `point_at`
及新增的 `shakehand` 一类）现支持多帧关键帧序列，不再局限于单帧静态叠加：

- `participants[]`：每项 `{role, dx?}`。`role` 对应 keyframe 里的子对象 key
  （`TalkActivity.js` 固定把 `participants[0]` 当 `a`、`participants[1]` 当 `b`）；
  `dx` 是该角色相对 `role 0`（隐式 `dx=0`）的设计站位间距，缺省回退编辑器默认值
  70px（`sth/stick-puppet/js/app.js` `DUET_DEFAULT_DX`）。两个角色的 `dx` 之差就是
  `PoseCacheBuilder.decodeSubEvent()` 算出的 `designGap`——运行时 `TalkActivity`
  在 reach 阶段把两个 NPC 的 x 收拢到这个间距、release 阶段再还原回原位，中点不变。
- `keyframes[]`：每帧 `{a: {...}, b: {...}, dur?}`，`a`/`b` 内容和单帧格式一样是
  相对 defaultPose 的关节 delta。多帧即让这条 duet clip 变成一段可播放序列，而不是
  一个瞬间姿势。
- `dur`（可选，每帧独立）：该帧播放时长（秒）。省略时：单帧旧格式回退到
  `TalkActivity.js` `SUB_EVENTS` 里按事件类型配置的 `hold`/`holdRange`；多帧新格式
  回退到 0.15s。
- `sustain`（可选，布尔，默认 `false`）：播完最后一帧后的行为。`false`＝自动进入
  release 淡出；`true`＝停在末帧姿势，一直等到外部把这个 `TalkActivity` `destroy()`
  掉才释放（用于"一直保持某姿势直到对话结束"这类场景，而不是固定时长后自动收尾）。

**与单帧旧格式的兼容**：旧格式就是"只有 1 帧、没有 `sustain` 字段"的特例——
`decodeSubEvent()` 不区分新旧，统一解码成 `frames` 数组；`TalkActivity._tickSubEvent()`
的 reach → play → release 三段式对 1 帧输入退化成原来的 reach → hold → release，
时长来源也退化成原来的 `SUB_EVENTS` 配置，播放效果与改动前逐帧等价（`push` /
`give_item` / `handshake` / `point_at` 四个既有 clip 不用改 JSON 就能继续工作）。
