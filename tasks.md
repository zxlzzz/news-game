全局约束(每个 prompt 都带上这段)

单分支 claude/velocity-unification-v1-946h9l 顺序提交,一批一 commit。
禁止运行游戏/模拟/headless-sim。静态验证不限。
四个门必须全绿:scripts/check-invariants.mjs、scripts/check-behavior-data.mjs、
scripts/check-witness-distribution.mjs、sth/tools/validate.mjs(注意不在 scripts/ 下)。
每批同 commit 更新 roadmap.md 及受影响文档。不要加软兜底(?? 默认值、if 代替 throw)。

L-1 朝向改为实际位移派生

现在 updateFacing 在 steerRoam 末尾用转向意图速度,但实际位移之后还被 _separate、
_lookaheadDeflect、_slideMove 三处改写,所以朝向和位移是两个量。

- 删 BaseStateMachine.js 的 updateFacing 和 mot.dirCD。
- Motor.js 内新增唯一朝向住址,位置在位移写入之后,判据是真实 dx 累加。
- 迟滞改空间死区:阈值 10 骨架单位 × npc.scale,进 Motor 现有裁决表,不留裸常数。
- 只在 walk/run/jog/ride 生效,其余状态不写 direction。
- steerRoam 里的 dir_mismatch 计数搬过去,改成比真实 dx 符号。

不动:Npc.js、ClipLibrary.js、任何 clip JSON。
验收:grep updateFacing / dirCD 零命中;四门全绿。

L-2 循环相位改距离驱动

现在 Npc.update 按 anim.fps 推进,与速度和深度缩放无关。实测 walk.json 隐含
48 骨架单位/秒,而 npc.speed 换算后是 138/99/79(远/近/公园),快 1.65~2.9 倍。

- clip 加可选顶层字段 groundTravel(骨架单位/循环)。显式声明优先。
- 未声明则自动推导:逐帧取贴地脚的 Δx 最小值(最负者),沿循环累加。
- 推导值 <8 单位判为非位移循环,保持时间驱动(stand/sit/chess 等)。这是判据不是兜底。
- 左右支撑脚各算一次,相差 >20% 即 clip 缺陷,ClipLibrary 抛出。
  同一判据实现为 check-invariants 新规则(编号取可用的,Rule 16 已被悬空符号预留)。
- Npc.update 相位按「自上次推进以来的实际位移模长 / (groundTravel × npc.scale)」推进。
  Npc 自己记 prev x/y,不向 Motor 取,避免和帧内顺序耦合。
- 顺带:现在 fps 只取第 0 帧 dur,后续每帧 dur 全丢,改成累积时间表。
- 顺带:dog 骨架补 unit_height 字段(human 144 / child 100 都有)。

必须显式声明的三个:
  bike 470(脚在踏板不接触地面,无法推导;107px/s ÷ scale 0.197 = 544 单位/秒,
    470/圈 = 1.16 转/秒 = 69rpm,换算真实尺度 5.5 米/圈,是正常城市车传动比)
  walk_front 96(该 clip 脚只原地抬落,水平位移为零)
  dog_walk 55(临时值,注释标明)

dog_walk 会触发一致性判据:fl_lower 一循环后移 13、br_lower 净前移 16,
两腿说法矛盾;所有脚 y 在 -2~-9 从不接触 0。本 patch 不修 clip 数据,
用 55(狗身长约 50)让步频可看,docs 里登记「dog_walk 需重画」。

不动:Motor.js、BaseStateMachine.js。
验收:新规则输出每个 cycle clip 的 groundTravel 与左右脚偏差,walk 应报 96 / 偏差 0%;
      咬合验证(改 walk.json 某帧 l_foot x 15 单位后规则必须失败,验完还原);四门全绿。

L-3 竖直移动切正面 clip

walk_front / stand_front / idle_front / squat_front 已注册但全库零消费点
(PoseCacheBuilder 的 front/side 配对只服务 kind==='overlay' 的 trait,这几个是 cycle)。

- 选择住址与 L-1 朝向同一处,复用同一个位移累加器:|累计 dy| > |累计 dx| 时选 _front。
- 变体存在性从 manifest 查,不存在保持当前 clip。
- 切换时相位归零(walk 20 帧 / walk_front 13 帧,帧数不同)。
- 迟滞复用 L-1 的空间死区参数,不新增阈值。

不动:PoseCacheBuilder 的 trait 配对。
验收:grep walk_front 在 js/ 下有非注释命中(改前为零);四门全绿;单独 commit 可 revert。

U-1 接触量改骨架单位(C-2 前置)

TalkActivity.js:110 把 cfg.designGap 直接当世界像素用。它来自 PoseCacheBuilder 的
participants[1].dx,是编辑器坐标即骨架单位,默认 70。近侧 scale≈0.262 时该渲染成
18px,现在站开 70px,约 4 倍,手碰不到,且错的倍数随 y 变。

- TalkActivity 消费 designGap 时乘 a 与 b 两者 scale 的平均。
- decodeSubEvent 输出上标注 designGap 单位为骨架单位。
- docs 里写死约定:C-2 所有接触量(配对目标距离、接触阈值、reach 距离)一律骨架单位,
  消费时乘 npc.scale。同时删掉设计文档里那个「≤2px」——它是像素量,只在一个深度成立。

不动:_applyLerpPose / _captureBasePose(那条路走 modifier,已乘过 scale,是对的)。
验收:designGap 所在行含 scale;四门全绿。

U-2 walkSpeed 与到达阈值改骨架单位

walkSpeed rand(20,34) 是世界像素且与 y 无关;ARRIVAL_RULES 也全是固定像素
(nav_waypoint 8px 在远近两端等于 43 vs 24 骨架单位,宽松度差 1.75 倍)。

迁移基准:近侧人行道有效 scale 0.262,换算后该深度行为不变。换算过程写进 commit message。

- walkSpeed 语义改骨架单位/秒,rand(20,34) → rand(76,130)。
- npc.speed 仍是世界像素/秒,由 Motor 每帧从 speedK × walkSpeed × npc.scale 重算
  (scale 随 y 变,不能在 setState 算一次)。Motor 仍是唯一写入点。
- ARRIVAL_RULES 改骨架单位并给 arrived() 加 scale 入参:
  nav_waypoint 8→30、walk_goal 6→23、bench_radius 80→305、
  exit_building 20→76、exit_offworld 8→30。
- WalkMode.js:130 的竖直速度、_routeToExit 超时分母的兜底 26 同步改语义。
- Athletes 的 r.speed 与 CyclistSpawner 的 rand(95,120)/(110,130) 一并换算,
  scene.json 里标注单位。

不要保留双语义并存或加开关。这批会动导航超时与过街时长,验收靠静态门和用户实机。
验收:grep 'rand(20, 34)' 零命中;ARRIVAL_RULES 每条带单位注释;四门全绿
     (check-witness-distribution 仍过是重点——Perception.js 的距离硬截断是另一套量,
      本批不该影响它;如果影响了说明有隐式耦合,报告不要自行修)。

U-3 单位规则入法(可与 U-2 同 commit)

规则:有长度量纲的常数只允许两种住址——骨架单位(消费时乘 npc.scale)
或 NavGrid 格。世界像素不是常数的合法单位。

- check-invariants 新增一条规则(编号取可用的):ARRIVAL_RULES、SAFETY_RULES、
  PoseCacheBuilder 输出中的长度常数必须带单位标注,缺失即失败。
- 规则注释里指名引用 _separate 的 baseRadius * (scale / atScale) 作为正确范式。
- 必须做咬合验证(临时加一个无标注的长度常数,规则必须失败,验完还原),
  commit message 写明做过。

不要为过规则批量加空洞注释,标注必须写明是骨架单位还是 NavGrid 格。

顺序:L-1 → L-2 → L-3 → U-1 → U-2+U-3。U-1 和其余全部零文件重叠,想插队随时插。

L-2 落地后实机会看到:脚不滑了,但远处的人步频明显比近处快。这是预期的中间态,U-2 收口。