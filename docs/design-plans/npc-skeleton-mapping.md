# NPC 火柴人：从 Kimodo 关节到画面的映射规则

Hsinlung 已于 2026-09-20 确认这套造型、比例和映射为当前基线。本文从临时交接材料整理，独立维护；临时文件后续覆盖不改变这里的规格。

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
9. **手的位置（2026-10-01 加，待 Hsinlung 看图确认）**。第 6、7 步只照抄方向；火柴人大臂短（0.096）、小臂长（0.124）、头大，照抄方向会把手放错地方：挠头、抱头、捂脸、捂嘴的手落到下巴和脖子，胸前拿书、拿相机的手被抬到下巴。所以第 6、7 步算出的手只作起点，再保住两种关系，然后用两骨 IK 从颈根重解肘和手（骨长不变）：
   - **高度**：手在躯干轴（Hips→Neck1）上的高度按身体部位分段对应：源 [站姿手、Hips、Neck1、头中心、HeadEnd] → 火柴人 [站姿手、胯、颈根、头中心、头顶]，两端按最近一段延长。站姿手两端取 `stand_idle` 第 0 帧，左右各自标定，所以站着时手的位置与第 6、7 步完全相同。手的前后、左右仍取第 6、7 步的结果（火柴人没有身体宽度，按比例缩放会把叉腰、插兜的手推离身体，试过不行）。
   - **贴头**（2026-10-02 修正）：源手掌点仍为 Hand 沿小臂方向再走 palm 米；源头中心和半径仍从 Head、HeadEnd 推导。目标方向取源头中心指向手掌的方向，目标距离是火柴人头半径加半线宽，再加源手掌到头表面的非负间隙 × 腿长比例 r。头的半径按火柴人比例取，手接近或离开的间隙按肢体比例取；不再把整个偏移都乘大头的倍率。headFar 到 headTouch 的贴头权重不变。
   - 高度映射可能先把手推入火柴人的大头区域。此时另保留源手的表面间隙：先算普通目标和上述贴头目标的差 error，再取 `excess = max(0, 1 - gap*r/error)`；以普通目标离火柴人头中心从两倍安全半径到安全半径的 smoothstep 权重乘 excess。贴头权重取这个几何补偿与源贴头权重的较大者。远处源手的间隙允许它保留普通方向，避免把所有靠近画面头部的手都吸向头。此处安全半径为 headR + line/2；error 的分母只加数值零保护。
   - **不穿头**：肘的弯向取第 6、7 步的肘，加一点源骨架自己的肘弯方向（大臂长 × 0.1）稳住接近伸直时的弯向。胳膊开始切进头圆（到头中心距离小于 0.9 × 头半径）时，肘改向外弯；仍切进且手不在贴头、也没有手撑地时，退回第 6、7 步的结果。两次过渡宽度仍为 0.25 × 头半径。它们是逐帧几何函数，没有时间低通；源肘、肩或手自身的突跳仍可能传入，不能据此保证任意素材相邻帧都连续。

10. **倒立的手支撑**（2026-10-02）：每侧从源手掌离地高度及躯干轴向下的程度推导 supportHands 权重，普通直立动作为 0，连续值随当前源姿态改变，不按动作名判定。两掌共同撑地时，用源上臂与前臂的伸展率、火柴人两腕的水平间隔和臂长推导颈根离支撑面的高度；相应升高整个身体，包括脚目标，保留腿形。手目标在地面上方半线宽处，两骨 IK 保臂长，手撑地时不退回张臂姿势。mapFrame 输出 `supportHands = [leftWeight, rightWeight]`；ClipPose 保存并逐侧混合它。

播放时的手支撑修正：`contact_pose.gd` 以 supportHands 权重把这两只手接到当前实际地面上方半线宽处，再按原骨长解肘。没有支撑权重的手保留原姿态。整个身体在映射时已按源伸展关系升高，所以倒立头自然离地，不靠抬头来假装手支撑。

播放时的头着地修正：头圆比身体线条粗得多，躺下时会陷进地面。`contact_pose.gd` 的脚底检查之后，若头圆下缘低于地面，绕颈根把头往上抬到刚好贴地，其余不动。

播放时的脚底修正：`clip_pose.gd` 从 `stand_idle` 第 0 帧推导左右脚各自的静止倾角，在上述映射后扣除；脚长和水平朝向不变，保留动作相对静止姿态的抬脚、蹬地倾角。`contact_pose.gd` 在交互接触处理后，按当前人物比例和线宽的一半检查脚踝、脚尖下缘；仅在穿入地面时抬脚并重解膝盖，保持腿长、上身与手部位置。空地、街道人群和牵狗人共用这两步，地面高度不改。

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
| 完全贴头距离 headTouch | 0.04（源数据，米） |
| 开始贴头距离 headFar | 0.16（源数据，米） |

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
- **不要把映射后的点写回资源文件**。资源里只存源关节，画的时候再算。这样比例以后再改，所有动作自动跟着变。

## 7. 已知的取舍（已接受，不用修）

- 欢呼（cheer）中间几帧，源动作是双手在头顶合拢；最小张角会把两只手分开。
- 抱臂（cross_arms）从正面看像胸前一个"十"字，斜着看好一些。任何火柴人画抱臂都有这个问题。
- 举高拍照（photo_overhead）的胳膊是往前上方举的，正面看会挡在脸前，这是真实的前后关系。
- （2026-10-01）第 9 步之后，photo_overhead 的手机举到头顶上方；手往正上方伸直的动作（stretch、hands_up）仍按最小张角张开，手到不了头顶正上方：火柴人臂长 0.22、头顶离颈根 0.135，伸直向上必然穿头。

## 8. 参考材料与检验范围

### Required visual review: upper-arm / forearm shape and continuity

Hsinlung explicitly added this review on 2026-10-03. Visually inspect every human motion for hand-line popping, sudden elbow bend changes, upper-arm/forearm folding that looks wrong, and awkward sustained elbow shapes. View the moving sequence from front, side and an oblique view where projection is ambiguous. Compare source Kimodo joints, mapped figure and final contact-corrected figure at the same moments before assigning the cause. A strange screen silhouette alone does not establish a bad 3D joint angle; a valid 3D angle alone does not establish a readable natural silhouette.

This is human visual judgment, not a new angle/speed threshold check. Bone-length, parity, clearance and continuity tests do not certify believable arm folding. Record the motion name, visible problem, affected side/portion and evidence; distinguish an observed problem from its suspected cause. If only filmstrips were inspected, state that coverage and its limits. Keep the previously accepted crossed-arm, cheer and overhead-photo tradeoffs separate from newly observed defects. Do not mark this review complete from mechanical checks.

以下旧参考图片位于 `C:/Users/Hsinlung/Desktop/npc_skeleton/npc_skeleton/`。调参 HTML 内置 6 条动作、660 帧；当时默认参数检查未发现无效坐标，骨段长度与缩放后踝目标误差仅浮点精度。此检查不是通用防穿模或手掌接触保证。

2026-10-02 共用映射回归：`godot/tools/check_mapping_relations.gd` 覆盖全 239 条的 25,340 个原生帧骨长、有限坐标和支撑权重；另将每条首/中/末与已报问题的精确帧共 742 个结果同 JS 对照。原生接缝和实际播放仍需分开看。修复证据及可重跑工具在 `delivery/motion_fix_2026-10-02/mapping/`；数值检查不替代实际画面验收。

- `stand_idle.png`、`phone_walk.png`、`scratch_head.png`、`squat_watch.png`、`bow.png`、`wave_both_overhead.png`、`stretch.png`、`cheer.png`：每张是一条动作，5 帧，每帧画三个视角（正面 -8°、侧面、斜上 -35°/15°）。
- `overview_1.png` 到 `overview_3.png`：全部 63 条动作，每条均匀取 5 帧，正面视角。


## 2026-10-03 clearance repair

The final head-clearance pass now rotates the complete arm about N, retaining both lengths and its elbow shape. The elbow-circle search could alternate between wrist displacement and a distant elbow solution on adjacent smooth source frames (duck_cover). The new pass uses the closest forearm point to select the rotation away from the head and solves only the required clearance angle. No temporal smoothing or clip-name exception is used. ClipPose also applies this clearance to interpolated samples before object contacts; clear native frames do not guarantee clear interpolated forearms. JS/GD implementations remain paired. Object contacts can still reintroduce head overlap; final acting and contact acceptance remain open. Evidence: delivery/motion_self_audit_2026-10-03/repair_round2.md.
