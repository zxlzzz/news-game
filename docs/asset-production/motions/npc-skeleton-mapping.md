# NPC 火柴人：从 Kimodo 关节到画面的映射规则

Hsinlung 已于 2026-09-20 确认这套造型、比例和映射为当前基线。本文从临时交接材料整理，独立维护；临时文件后续覆盖不改变这里的规格。

> 2026-11-02：他验收了研究侧的新映射 `codex-iter/mapping-analysis/v10/`（第 8 轮）。它还没有接进 Godot，所以游戏现在跑的仍是本文的规则；做新素材的映射以 v10 为准。

这份文件规定从 Kimodo 动作数据到 NPC 火柴人画面这一步：画哪些点，每个点怎么从源关节算出来，参数取多少。它替代仓库里 `sth/motion-study` 的做法。

- 动作数据本身不改，仍是 `assets/animations/npz/*/motion.npz` 里的 `posed_joints`（77 个关节，单位米，Y 轴朝上）。
- 比例参数是 Hsinlung 在调参工具里自己调出来的。
- 参考实现是 `C:/Users/Hsinlung/Desktop/npc_skeleton/npc_skeleton/skeleton_tuner.html` 里的 `build()` 函数，本文件写的每一步都和它一一对应。有歧义时以代码为准。

## 1. 用到的源关节

下面是这些关节在 77 个关节里的编号。编号是拿已经导出的数据和 npz 逐个比对得到的，误差小于 0.01 毫米。正式代码请用 Kimodo `definitions.py` 里 `SOMASkeleton77` 的名字去查编号，下表只作核对用。

| 名字 | 编号 | 名字 | 编号 |
|---|---|---|---|
| Hips | 0 | Neck1 | 4 |
| Head | 6 | HeadEnd | 7 |
| LeftArm / RightArm | 12 / 40 | LeftForeArm / RightForeArm | 13 / 41 |
| LeftHand / RightHand | 14 / 42 | LeftShin / RightShin | 68 / 73 |
| LeftFoot / RightFoot | 69 / 74 | LeftToeEnd / RightToeEnd | 71 / 76 |

## 2. 画哪些点、怎么连

画出来的点有：胯 H、颈根 N、脖子末端、头（实心圆），以及左右各一套：肘、手、膝、踝、脚尖。

连线如下：

- 胯–颈根
- 颈根–脖子末端
- 每一侧：颈根–肘–手
- 每一侧：胯–膝–踝–脚尖

**不画的部分：** 肩膀横线、胯横线、胸口折点、手指、脸。

不画肩膀是试过以后定的。画了肩膀，肩宽了显得壮，窄了又显得位置不对；火柴人本来就是"四肢从两个点发散出去"的符号，加一段肩膀反而显得怪。

## 3. 计算步骤

下文中 `u(A→B)` 表示源数据里从 A 指向 B 的单位向量。

1. **腿长比例**：`r = (大腿 + 小腿) / (0.528 + 0.423)`。0.528 和 0.423 是源素材站立时量出的大腿、小腿长度。
2. **下半身整体按 r 缩放**。源数据的胯和踝都按 r 缩放：水平方向以本片段第一帧的 Hips 为原点，竖直方向以地面为原点。这样步幅和整体位移会跟腿长一起变短，脚不会打滑，也不会劈叉。
3. **腿**：从 H 到缩放后的踝，用两骨 IK（端点定位加余弦定理）解出膝，弯曲方向取源数据的 Shin。如果够不到，就把 H 往下降。
4. **躯干**：`N = H + u(Hips→Neck1) × 躯干长`。
5. **头和脖子**：方向取源数据中从 Neck1 指向头中心（Head 与 HeadEnd 的中点）的方向，并换算到躯干自己的坐标系里（上方 = Hips→Neck1，侧向 = RightArm→LeftArm）。然后扣掉站立时的固定前倾：源骨架站立时这个方向前倾约 17°，画成火柴人就像驼背。扣的量取 stand_idle 第一帧的值，所以站立时头正好在躯干的延长线上，低头、探头这类变化照样保留。脖子末端 = N + 该方向 × 脖子长；头中心再沿同一方向走一个头半径。
6. **胳膊**：源数据的"肩那一段"是 `c = LeftArm − Neck1`，按固定比例分给大臂和小臂：
   - 大臂方向 = `u( (LeftForeArm − LeftArm) + c × 肩分给大臂 )`
   - 小臂方向 = `u( (LeftHand − LeftForeArm) + c × (1 − 肩分给大臂) )`
   - 肘 = N + 大臂方向 × 上臂长；手 = 肘 + 小臂方向 × 前臂长
   - 右侧同理
7. **举手时不让胳膊钻进头里**。这是比例带来的问题：头大、大臂短时，胳膊竖直举起会整段藏在头后面，看上去像头上长了两根角。所以大臂方向和头方向（第 5 步）的夹角 a 不得小于"举手最小张角"θ。
   - 当 a < θ + 20° 时，把目标夹角平滑地抬到 h(a)。h 是三次 Hermite 曲线：a = 0 时 h = θ，a = θ + 20° 时 h = a，两端导数分别为 0 和 1，过渡时不会跳。
   - 往外推时只沿侧向推：保留大臂原有的前后分量，只增大朝向自己这一侧的分量。
   - （2026-10-02）原大臂朝内时，不能在 a 刚低于 θ + 20° 的一帧直接把侧分量改成朝外：这会在 h − a 接近 0 时仍翻臂。a 在 θ 到 θ + 20° 之间时，侧向方位沿头轴周围的圆锥按 smoothstep 逐渐转向朝外；a ≤ θ 时保留原来完整的张臂结果。改变方位时保持 h，不从头的中心穿过去。cheer 和 cross_arms 的本次逐帧映射结果与修复前一致。
   - 小臂跟着大臂做同一个旋转，肘的弯曲形状不变。
   - 手在头旁边的动作（挠头、打电话、揉眼、捂脸、喝水）大臂接近水平，不会触发这条规则。
8. **脚尖** = 踝 + u(LeftFoot→LeftToeEnd) × 脚长。
9. 手的端点不落在头里。第 6、7 步算出的手端如果落进头的圆（到头中心的距离小于头半径 + 半线宽），就放到圆的边上。放在哪一侧，取源数据里手掌相对头中心的方向（手掌 = Hand 沿小臂方向再走 palm 米；方向按源头轴到火柴人头轴的转动换过来）。距离在“边 ± 0.25 × 头半径”之间平滑过渡。手端移动后从颈根用两骨 IK 重解，肘的弯向取第 6、7 步的肘。手端没进头、也不撑地时，第 6、7 步的结果原样输出。小臂可以和头的圆重叠。

10. **倒立的手支撑**（2026-10-02）：每侧从源手掌离地高度及躯干轴向下的程度推导 supportHands 权重，普通直立动作为 0，连续值随当前源姿态改变，不按动作名判定。两掌共同撑地时，用源上臂与前臂的伸展率、火柴人两腕的水平间隔和臂长推导颈根离支撑面的高度；相应升高整个身体，包括脚目标，保留腿形。手目标在地面上方半线宽处，两骨 IK 保臂长，手撑地时不退回张臂姿势。mapFrame 输出 `supportHands = [leftWeight, rightWeight]`；ClipPose 保存并逐侧混合它。

11. **手贴身**（2026-10-15 试验，未提交）：真人的手贴着自己身上某处，火柴人的手就贴着自己身上同一处。只改 Godot 这份（`godot/npc/skeleton_mapping.gd` 的 `mapClip` / `applyContact`；`sth/motion-study` 的 mjs 不动，`mapFrame` 仍是第 1–10 步原样，`check_mapping.gd` 照旧对 mjs 参考）。**全部数值在 `godot/npc/hand-contact.json`**，读取时每个键都必须有（`npc_data.gd` `load_contact`），缺键报错。
   - **两边的点**一一对应：嘴 mouth、眼 eyes、头顶 crown、头左右 headLeft/headRight、后脑 headBack、胸口 chest、肚子 belly、腰后 lowerBack、前后兜 pocketFront/BackLeft/Right、腰侧 waistLeft/Right（叉腰）、对侧大臂中点 upperArmLeft/Right（抱臂）。另一只手也算一个点（pair）。
   - **真人的点**从 Kimodo 关节推：`source.at` 是几个关节的加权和，`source.offset` 是再挪的 [左右, 上下, 前后]。头上的点用头坐标系（上 = 第 5 步的头方向，左右 = 两眼连线与它正交，前 = 左右 × 上），单位是真人头半径 |HeadEnd − Head| / 2；躯干上的用第 5 步的躯干坐标系，单位是真人躯干长 |Neck1 − Hips|。初始推法：嘴 = Jaw 往前 0.5 头半径；眼 = 两眼中点；头顶 = HeadEnd；头两侧 / 后脑 = 头心（Head 与 HeadEnd 中点）往左右 / 后 1 个头半径；胸口 = Chest 与 Neck1 的 6:4 点往前 0.25 躯干长；肚子 / 腰后 = Spine1、Spine2 中点往前 0.25 / 往后 0.2；兜 = 大腿根 LeftLeg/RightLeg 往外 0.08、往上 0.15、往前 0.18 或往后 0.12（量过：真人插兜手在胯两侧、与胯同高，前兜后兜前后差约 25 cm，所以前后各一个点）；腰侧 = 大腿根往外 0.04、往上 0.4、往前 0.1；大臂中点 = Arm 与 ForeArm 中点。手的点（palm）= Hand 与 HandMiddle2（指根）中点，即掌心。
   - **火柴人的点**：头上的给方向 [左右, 上下, 前后]（同一个头坐标系）+ 离球心多远（headR 的倍数，初始都是 1，即在圆头边上）；嘴略低于正前（[0, −0.35, 0.94]），眼略高于正前，头顶正上，两侧正左右，后脑正后。躯干上的给 along（0 = 胯，1 = 颈根）+ side + forward（躯干长的倍数）：胸口 0.655（与真人点在躯干上的高度比例相同）、肚子和腰后 0.19，前后贴在躯干线表面（forward ±0.112 = 躯干线半宽 / 躯干长）；兜在胯处、左右 0.22（火柴人没有胯宽，放在躯干线旁边）、前后 ±0.11；腰侧 along 0.2、左右 0.2、往前 0.08；大臂点在该侧大臂（第 1–10 步的）一半处。这些都是初始值，在 JSON 里调。
   - **算不算贴着**（整条动作导出时预先算好，播放不现算）：手离某点不超过 near + band，**并且**相对那个点（pair：相对另一只手）的速度不超过 stillSpeed（在 speedSeconds 内量），**并且**这样连续至少 holdSeconds，这一段才算贴着；路过、垂着、摆动经过都不算。贴着的帧里，权重 = 距离从 near 到 near + band 的平滑过渡（near 以内为 1）。然后每个权重在时间上平滑：先取前后 smoothSeconds 内的最大值，再在同样范围内做 Hann 平均；所以手会提前一点开始贴上去、晚一点离开，不跳。
   - **手里拿着东西**（2026-10-15 第二轮）：`hand-contact.json` 的 `held` 列出哪些东西会用一头碰到身上、那一头是类型里的哪个节点（杯子 `lip`，手机 `upper_speaker`）。动作在 `clip-setup.json` 里声明单手拿着其中一样时，这只手"贴没贴"、离点多远都按那一头算：真人那边把同一个东西按真实尺寸挂在掌心，火柴人那边把那一头放到点上，手在它后面隔着东西的真实尺寸（东西不跟着大头放大）。东西挂在手上的样子和游戏里一样：竖直、朝动作的朝向（导出时先按导出的朝向算，导出后再核一遍，不一致报错）。列出的类型缺那个节点就报错；双手拿着的不走这条。
   - **放法**：手离点的偏移乘两个身体在那一处的尺寸比（头上：headR / 真人头半径；躯干上：torso / 真人躯干长），加到火柴人的同一个点上。几个点同时贴着时，越近的点占比越大（比最近的点每远 nearShare 米，占比乘 1/e），因为两个头形状不同，各点给的位置会差一点。整体权重（各点最大）从第 1–10 步的手平滑过渡到这个位置。
   - **两只手**：两手贴着时（pair），保住两手的相对位置（真人两掌之差乘躯干比）；主要挪没贴身的那只手（左手不动的份额 = 0.5 + 0.5 × (左手贴身权重 − 右手贴身权重)）。这一步在最小张角（第 7 步）之后，所以两手位置赢过 70°：贴着的手不再走第 7 步的结果。
   - **肘**：手定了以后从颈根两骨 IK 解肘，弯向取真人的肘（肘离"肩–手"连线的方向）；手在颈根前方时，弯向里朝后的分量去掉（肘不朝后，memory.md 的肘规矩）；手在颈根后方超过 elbowFront（如背手）时允许朝后，中间平滑过渡。
   - **不穿头**：小臂和手的中线离头心不小于 headR + headClear，大臂不小于 headR + upperArmClear（大臂起点颈根本身离圆头只有 neck = 0.015，所以大臂只能要求不进圆头本身）。穿了就把肘沿它能在的圆周转到最近的不穿位置；转一圈都不行，就把手从头轴往外挪最少的距离（最多 pushMax）；挪到 pushMax 还不行就不挪，肘取最不穿的位置。
   - 贴身的帧里，第 11 步对手和肘的改动量再按同样的 Hann 平均一次后重解（只平均改动量，不平均动作本身），防止避头时肘换边造成跳帧。
   - **离所有点都远的帧，结果与第 1–10 步逐位相同**：没有任何贴着的权重落在平滑范围内的帧直接用第 1–10 步，不重算。核对：`godot --headless --path . -s res://tools/check_hand_contact.gd -- <动作…> --controls walk point` → `HAND_CONTACT_OK`（列出每条哪段贴着哪个点；远处帧新旧差必须为 0；`--controls` 后面的动作每一帧都必须相同）。
   - 导出：`scripts/export-npc-motion.py` 在原来 16 个关节后面追加第 11 步要读的 Spine1、Spine2、Chest、Jaw、两眼、两大腿根、两手 HandMiddle2（原 16 列不变）。`motion_bake.gd` 对普通动作用 `mapClip`（第 1–11 步）；带 `pose` 的摆出来的动作（`pose_build.gd`）仍用第 1–10 步取源动作的晃动和停顿，结果不变。`hand-contact.json` 也算导出指纹，改了要重跑 `tools/bake_motion.gd`。导出文件多存每帧躯干和头的左右方向（`axes`），只给空地画点用。
   - 空地面板勾"画手贴身的点"（或命令行 `--contact-points`），火柴人身上画出这些点（橙色）；改了 JSON 重导出后再看。

播放时的手支撑修正：`contact_pose.gd` 以 supportHands 权重把这两只手接到当前实际地面上方半线宽处，再按原骨长解肘。没有支撑权重的手保留原姿态。整个身体在映射时已按源伸展关系升高，所以倒立头自然离地，不靠抬头来假装手支撑。

播放时的头着地修正：头圆比身体线条粗得多，躺下时会陷进地面。`contact_pose.gd` 的脚底检查之后，若头圆下缘低于地面，绕颈根把头往上抬到刚好贴地，其余不动。

脚底倾角：导出时（`npc/motion_bake.gd`）从 `stand_idle` 第 0 帧推导左右脚各自的静止倾角，在上述映射后扣除；脚长和水平朝向不变，保留动作相对静止姿态的抬脚、蹬地倾角。

播放时的脚底修正：`contact_pose.gd` 的 `ground_feet` 按当前人物比例和线宽的一半检查脚踝、脚尖下缘；仅在穿入地面时抬脚并重解膝盖，保持腿长、上身与手部位置。空地、街道人群和牵狗人共用，地面高度不改。这是游戏运行时唯一的姿势修改（见第 6 节）。

## 4. 参数（Hsinlung 定的）

长度单位是米，线宽也是米，跟人物一起缩放。站立身高约 0.58 米，约 4.9 个头高。画风偏可爱，身材矮是有意的。

| 参数 | 值 |
|---|---|
| 头半径 headR | 0.06 |
| 脖子长 neck | 0.015 |
| 躯干长 torso | 0.18 |
| 肩分给大臂 clavSplit | 0.8 |
| 举手最小张角 minSpread | 70° |
| 上臂 upperArm | 0.096 |
| 前臂 foreArm | 0.124 |
| 大腿 thigh | 0.12 |
| 小腿 shin | 0.13 |
| 脚长 foot | 0.05 |
| 线宽 line | 0.035 |
| 躯干线宽倍数 torsoLine | 1.15（躯干和脖子的线宽 = 线宽 × 1.15） |
| 手掌长 palm | 0.09（源数据，米；第 9 步贴头判断用） |
| headTouch | 0.04（源数据，米；只给第 10 步倒立撑地用：手掌离地不高于它时，撑地权重取满） |
| headFar | 0.16（源数据，米；只给第 10 步倒立撑地用：手掌离地高于它时，撑地权重为 0） |

## 5. 画法

- 头是实心圆，不画脸。
- 线条是等宽的圆头线。
- 各段按深度从远到近画，头也参与排序。
- 不画影子。

## 6. 实现要求

规则已经确定；仓库 `sth/motion-study/` 已接入六条样例。共用映射为 `skeleton-mapping.mjs`，12 项参数存于 `skeleton-params.json`，调参预览在绘制时调用；源 NPZ 不改。游戏与其余动作尚未接入。

后面还要做单个动作的微调，这几条是为那一步留的口子：

- **映射写成一个纯函数**：输入一帧源关节加一份参数，输出这一帧要画的点。调参工具、出图脚本、游戏运行时共用同一份实现，不要各写一份。
- **参数放在一个单独的 JSON 文件里**，不要散落在代码里。
- ~~不要把映射后的点写回资源文件~~（2026-10-13 Hsinlung 同意改掉，见 `docs/asset-production/motions/动作重做方案.md` 第 3.3 节及第 4 节）：源 NPZ 仍只存源关节、不改；映射和接触修正在**导出**时做（`godot/npc/motion_bake.gd`，`godot/tools/bake_motion.gd`），结果存在 `godot/npc/baked/<动作>.json`，游戏只读它。每个导出文件记着输入（源动作、映射代码、参数、动作声明）的指纹，输入一变游戏就报错要求重导出，所以比例以后再改，重跑一次导出所有动作就跟着变；导出工具会列出画面变了的动作，变了的要重新看。

## 7. 已知的取舍（已接受，不用修）

- 欢呼（cheer）中间几帧，源动作是双手在头顶合拢；最小张角会把两只手分开。
- 抱臂（cross_arms）从正面看像胸前一个"十"字，斜着看好一些。任何火柴人画抱臂都有这个问题。
- 举高拍照（photo_overhead）的胳膊是往前上方举的，正面看会挡在脸前，这是真实的前后关系。
- （2026-10-01）第 9 步之后，photo_overhead 的手机举到头顶上方；手往正上方伸直的动作（stretch、hands_up）仍按最小张角张开，手到不了头顶正上方：火柴人臂长 0.22、头顶离颈根 0.135，伸直向上必然穿头。
- （2026-10-06）第 9 步简化后，胸前动作（rub_hands、adjust_clothes、eat_snack、hold_umbrella 等）的手在正面看会叠在头的下沿，侧面看手在头的前方，不是碰到下巴，不修。

## 8. 参考材料与检验范围

### Required visual review: upper-arm / forearm shape and continuity

Hsinlung explicitly added this review on 2026-10-03. Visually inspect every human motion for hand-line popping, sudden elbow bend changes, upper-arm/forearm folding that looks wrong, and awkward sustained elbow shapes. View the moving sequence from front, side and an oblique view where projection is ambiguous. Compare source Kimodo joints, mapped figure and final contact-corrected figure at the same moments before assigning the cause. A strange screen silhouette alone does not establish a bad 3D joint angle; a valid 3D angle alone does not establish a readable natural silhouette.

This is human visual judgment, not a new angle/speed threshold check. Bone-length, parity, clearance and continuity tests do not certify believable arm folding. Record the motion name, visible problem, affected side/portion and evidence; distinguish an observed problem from its suspected cause. If only filmstrips were inspected, state that coverage and its limits. Keep the previously accepted crossed-arm, cheer and overhead-photo tradeoffs separate from newly observed defects. Do not mark this review complete from mechanical checks.

以下旧参考图片位于 `C:/Users/Hsinlung/Desktop/npc_skeleton/npc_skeleton/`。调参 HTML 内置 6 条动作、660 帧；当时默认参数检查未发现无效坐标，骨段长度与缩放后踝目标误差仅浮点精度。此检查不是通用防穿模或手掌接触保证。

2026-10-02 共用映射回归：`godot/tools/check_mapping_relations.gd` 覆盖全 239 条的 25,340 个原生帧骨长、有限坐标和支撑权重；另将每条首/中/末与已报问题的精确帧共 742 个结果同 JS 对照。原生接缝和实际播放仍需分开看。修复证据及可重跑工具在 `delivery/motion_fix_2026-10-02/mapping/`；数值检查不替代实际画面验收。

- `stand_idle.png`、`phone_walk.png`、`scratch_head.png`、`squat_watch.png`、`bow.png`、`wave_both_overhead.png`、`stretch.png`、`cheer.png`：每张是一条动作，5 帧，每帧画三个视角（正面 -8°、侧面、斜上 -35°/15°）。
- `overview_1.png` 到 `overview_3.png`：全部 63 条动作，每条均匀取 5 帧，正面视角。
