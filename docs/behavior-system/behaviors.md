# 高层行为表与动作拆解

2026-10-18，第一版设计。先完成 [底层动作清单](actions.md)，再据此整理本表。本文件是 Markdown 形式的高层行为文件，不是可加载 JSON；没有改变现有权重、素材或运行代码。新增名称、分数和规则是本版设计选择，不冒充过去已经确认或实现的内容。

当前使用方式以 [执行设计方案](execution-plan.md) 为准。本表是内容与分数盘点，不是全部启用的运行表。普通行为优先用一行 direct；工具、设施行为引用共用模板；只有真正多步／多人内容才补过程。未设计内容可明确停用，未绑定素材不等于语义未知。98 项不需要逐一达到购买案例精度。

## 1. 两部分文本怎样对应

| 上半框：选中的行为 | 下半框：当前具体动作 | 含义 |
|---|---|---|
| 跑步 `run` | 不重复显示；内部动作仍是 `run` | 行为和动作直接对应 |
| 买东西 `buy_stuff` | 走向水果摊 `walk` | 同一件事在接近目标 |
| 买东西 `buy_stuff` | 指选商品 `choose_item` | 到了摊位以后动作改变 |
| 买东西 `buy_stuff` | 付款展示 `present_payment_tool`（待对应） | 行为没变；本例不把整段 `pay` 当通用结账 |
| 买东西 `buy_stuff` | 接过商品 `receive_item` | 仍在做同一件事 |
| 正坐 `sit_bench` | 走向长椅 `walk` | 行为与当前动作不同，两部分都显示 |
| 正坐 `sit_bench` | 不重复显示；内部动作是 `sit_bench` | 已经进入目标姿态 |

上半框表示已经选中并在推进的事情；不是正在表演的动作名，也不显示“可能想做”的全部候选。目标对象是行为的参数，例如同为 `buy_stuff`，目标可以是不同摊位。下半框显示具体对象与动作的可读说明，动作 ID 则引用底层清单。

## 2. 全局评分与共用默认

自身、物件、周围的人与已有活动提供可选事情，仍在全局表中比较。普通行只需稳定键、base、action，必要时加 when／label；use 默认 direct。共享配置负责做一次／做一会、取消与重选，不要求每行写寿命、版本或许可。

分数为 base × 个人系数乘积 × half/(half+d)。sight 限制新目标发现，仍在执行的绑定目标不因出范围立即零分。A／B 目标仍独立可比；同一方案多处发现去重，多条有效处境取最高分，不相加。无当前事情时本次每个行为抽一次扰动并跨目标共享，当前实例保留扰动，挑战者不加；同帧后备复用原分数，不重抽。

- 同一行为的其他目标可以挑战当前目标，不照搬旧选择器排除整行的规则。
- 当前分不按时间自动降低。正常完成／明确无法执行后用共享 again 约束同一行为与目标，不为每行建立机会发生／重开协议。
- 默认中断结束当前未完成目的，保留实际世界。只有服务模板保存排队名次和已付未取；通话与角色不按当前事情统一删除。
- 所有模板（含 direct）共用同一组准备：空手、取工具、起身；拿着东西或坐着不会让普通行全部失效。
- 同帧统一检查占用，失败者最多选一次经再次核对的后备；没有跨轮申请／批准链。
- 多步过程先重选工作再续用动作，推进／准备优先于消遣；目标达成后的正常余段仍可切断，成功不回滚。
- 共同配合由模板直接核对双方当前意愿与实际准备；默认中断结束本次互动。无需每条行为填写版本、周期或授权链。
- 本表后面的箭头是内容盘点，不能替代已启用动作的语义；未知分支明确留空，不靠计时假作实物效果已完成。

### 分数和个人偏好

以下表中“沿用”表示当前文件已有对应行为的基础分；“新增”是本版的起始分，不是经过模拟调好的最终数值。为已有行为拆行时保留原基础分，不把原素材抽签比例换算成新的行为分。

已有标签继续使用 `stroll`、`leave`、`fidget`、`sit`、`wait`、`seller`、`shopper`、`chess`、`watch`。

盘点建议的标签包括 `move`、`social`、`help`、`phone`、`read`、`record`、`carry`、`facility`、`clean`、`exercise`、`care`、`perform`、`react`，并不要求先全部启用。简单新增行可不写 tags，空乘积为 1；复用已有标签不必改人物表。确实采用新标签时才补启用人物类型的系数，不能把缺少的系数静默当作 1。

工具、物品、伙伴和设施是否存在属于使用条件，不靠调低分数掩盖条件不成立。职业倾向仍用系数表达，例如 `seller: 0` 的人不接摊主行为。

## 3. 高层候选与权重

下列是每一类事情对应的行为行，动作拆解见第 4—8 节。同一底层动作可被多个行为复用；只有在确实代表不同事情时才新增高层名称。

### 3.1 移动、休息与等待

| 行为 ID | 上半框文字 | 候选来源与条件 | base／标签 |
|---|---|---|---|
| `walk` | 随处走走 | 自身；有可走的地方 | 2，`stroll`，沿用闲逛行；普通步态变体归并 |
| `run` | 跑步 | 自身；有可跑的空间 | 2，`move`，新增 |
| `jog` | 慢跑 | 自身；有可行进路线 | 2，`exercise`，新增 |
| `leave` | 离开这里 | 自身；有出口目标 | 1.2，`leave`，沿用 |
| `sit_bench` | 正坐休息 | 物件；有合适空座 | 3，`sit`，沿用坐下行后单独成项 |
| `slouch_bench` | 瘫坐休息 | 物件；座位允许前伸双腿 | 3，`sit`，从原坐下行拆出 |
| `sit_sideways` | 侧坐休息 | 物件；有可侧坐的座位 | 3，`sit`，新增 |
| `sit_step` | 坐台阶休息 | 物件；有可坐台阶 | 3，`sit`，新增 |
| `sit_on_ground` | 坐地休息 | 自身／地面；有可停留地面 | 2，`sit`，新增 |
| `sit_knees_up` | 抱膝坐着 | 自身／地面；有可停留地面 | 2，`sit`，新增 |
| `lie_ground_hold` | 躺下休息 | 自身／地面；有足够地面空间 | 2，`sit`，新增 |
| `lean_wall` | 靠墙休息 | 物件；有可倚靠位置 | 3，`sit`，新增 |
| `lean_sign` | 靠站牌休息 | 物件；有可倚靠位置 | 3，`sit`，新增 |
| `lean_railing` | 扶栏杆歇一会儿 | 物件；有可扶位置 | 3，`sit`，新增 |
| `wait_bus` | 等公交 | 物件；公交站 | 2.5，`wait`，沿用站点等待行 |
| `wait_person` | 等人 | 人／已有约定的地点；有等待对象 | 2.5，`wait`，新增；不引入日程或记忆系统 |
| `queue`（内部环节） | 上半框保留购买等原事情 | 所属服务活动的等待队列 | 不独立评分；使用所属事情的选择结果 |
| `fidget` | 原地活动一下 | 自身；没有专门目标要求 | 1.2，`fidget`，沿用小动作行 |

正坐、瘫坐、侧坐是不同候选。它们可以使用同一类座位，但不在选中“坐下”后再以 3:1 等比例随机决定哪一种。

### 3.2 交易、设施和工作

| 行为 ID | 上半框文字 | 候选来源与条件 | base／标签 |
|---|---|---|---|
| `buy_stuff` | 买东西 | 摊位；有货物和营业中的摊主，目标可达；忙碌时另看排队条件；本人在此摊已付未取时用处境 `paid` | 4，`shopper`，沿用顾客行并明确名称 |
| `browse_stall` | 看看摊上的东西 | 摊位；允许浏览，暂不要求购买 | 2.5，`shopper`，新增 |
| `tend_stall` | 看摊 | 摊位；有可站的摊主位置 | 5，`seller`，沿用摊主行 |
| `serve_customer`（内部环节） | 上半框仍是看摊 | 摊位活动；当前顾客可以被接待 | 不独立评分；由看摊过程的条件推进 |
| `buy_newspaper` | 买报纸 | 报摊；有报纸和相应服务 | 4，`shopper`，新增；拿报的底层动作是 `take_newspaper` |
| `use_vending` | 从机器买东西 | 售卖机；机器可用 | 4，`shopper`，新增 |
| `withdraw_cash` | 取钱 | ATM；设备可用 | 4，`facility`，新增 |
| `collect_parcel` | 取快递 | 取件柜；有自己的可取包裹 | 4，`facility`，新增；不设计账号或物流系统 |
| `post_letter` | 寄信 | 信箱；人带着要寄的信 | 4，`facility`，新增 |
| `post_notice` | 贴告示 | 可张贴位置；有纸张 | 4，`facility`，新增 |
| `read_notice` | 看公告 | 公告栏；有可看的内容 | 2.5，`read`，新增 |
| `use_fountain` | 到饮水处喝水 | 饮水设施；可使用 | 4，`facility`，新增 |
| `cafe_drink` | 坐下喝点东西 | 咖啡桌座位；有杯子与座位 | 4，`sit`，新增 |
| `use_payphone` | 用公用电话 | 电话亭；设备可用 | 4，`phone`，新增 |
| `pass_door`（内部工作） | 上半框保留既定去处 | 当前路线经过门，按需要开门／通过 | 不独立评分；归属行进事情 |
| `hold_door` | 给后面的人扶门 | 门口；有人正在跟随通过 | 5，`help`，新增 |
| `pick_up_object` | 捡起地上的东西 | 地面物品；可以接近并拾取 | 4，`facility`，新增 |
| `throw_trash` | 扔垃圾 | 垃圾桶；手里有垃圾 | 6，`facility`，新增，取自原设计示例 |
| `rummage_bin` | 翻找垃圾桶 | 垃圾桶；有可翻找位置 | 3，`facility`，新增 |
| `sweep_area` | 扫地 | 工作地点；有扫把 | 4，`clean`，新增 |
| `mop_area` | 拖地 | 工作地点；有拖把 | 4，`clean`，新增 |
| `water_plants` | 浇花 | 花槽；有水壶 | 4，`clean`，新增 |
| `hang_laundry` | 晾衣服 | 晾晒位置；有待晾衣物 | 4，`clean`，新增 |
| `wipe_table` | 擦桌子 | 桌面；有擦拭工具 | 4，`clean`，新增 |

### 3.3 个人活动和携物出行

| 行为 ID | 上半框文字 | 候选来源与条件 | base／标签 |
|---|---|---|---|
| `eat_snack` | 吃东西 | 自身；有食物 | 2，`fidget`，新增 |
| `drink` | 喝水 | 自身；有饮料 | 2，`fidget`，新增 |
| `smoke` | 抽烟 | 自身；有香烟 | 2，`fidget`，新增 |
| `phone_browse` | 看手机 | 自身；有手机 | 2，`phone`，新增 |
| `phone_call` | 打电话 | 自身；有手机与当前通话 | 3，`phone`，新增 |
| `read_book` | 看书 | 自身；有书 | 2，`read`，新增 |
| `read_newspaper` | 看报 | 自身；有报纸 | 2，`read`，新增 |
| `take_photo` | 拍照 | 人／物／当前事件；有拍摄设备与目标 | 3，`record`，新增 |
| `film_phone` | 录像 | 人／物／当前事件；有手机与目标 | 3，`record`，新增 |
| `selfie` | 自拍 | 自身；有设备 | 2，`record`，新增 |
| `carry_to_place` | 把东西带过去 | 自身／物件；有携带物和目的地 | 3，`carry`，新增 |
| `walk_with_umbrella` | 撑伞出行 | 自身；有伞与目的地 | 3，`carry`，新增；不要求先造天气系统 |
| `push_cart` | 推车过去 | 物件；有购物车和目的地 | 3，`carry`，新增 |
| `push_stroller` | 推婴儿车散步 | 物件；有婴儿车 | 3，`care`，新增 |
| `pull_suitcase` | 拉行李出行 | 自身；有行李箱和目的地 | 3，`carry`，新增 |
| `ride_bicycle` | 骑自行车出行 | 自行车；有车和目的地 | 3，`move`，新增 |
| `ride_scooter` | 骑车出行 | 对应车辆；可使用、有目的地 | 3，`move`，新增 |
| `hail_taxi` | 打车并上车 | 道路；有可招呼的出租车；获接受后沿同次乘车目的接近并上车 | 3，`move`，新增 |
| `enter_car` | 上车 | 仅有独立来源的上车目的，例如场景给定的当前乘车任务；打车中的上车不另造候选 | 4，`move`，新增；只用于独立来源 |
| `exit_car` | 下车 | 所在车辆；能离开座位 | 4，`move`，新增 |

移动中的看手机、喝水、打电话等是这些事情的具体动作分支，不因已有一条组合素材就额外制造一个上半框行为。没有保持移动的原因时使用原地动作；有现存行进目的地、工具相容时才用移动版本。

### 3.4 对人、共同活动、运动和反应

| 行为 ID | 上半框文字 | 候选来源与条件 | base／标签 |
|---|---|---|---|
| `greet` | 打招呼 | 人；对方可被招呼 | 4，`social`，新增 |
| `chat` | 聊天 | 人／当前活动；可以先提出邀聊，双方实际交谈另核对意愿与当前动作条件 | 4，`social`，新增 |
| `whisper` | 低声说话 | 人／当前交谈活动；对方在近处 | 4，`social`，新增 |
| `argue` | 争论 | 当前交谈／争执活动；有具体分歧 | 6，`social`，新增；不自动给两人生成仇恨关系 |
| `handshake` | 握手 | 人；可发起；对方正向我邀握时用处境 `invited` | 2，被邀时 6，`social`，新增 |
| `give_object` | 把东西交给对方 | 人；有指定物件与接收对象 | 5，`social`，新增 |
| `receive_object` | 接对方给的东西 | 对方的递物邀请（相当于 invited） | 5，`social`，新增 |
| `distribute_flyer` | 发传单 | 自身／附近的人；有传单 | 4，`social`，新增 |
| `receive_flyer` | 接传单 | 对方的发放邀请 | 4，`social`，新增 |
| `interview` | 询问经过 | 人；可以先发起采访，不以对方已愿意回答为候选门槛；共同开始另核对意愿 | 5，`social`，新增 |
| `answer_interview` | 回答询问 | 对方的询问邀请／活动 | 5，`social`，新增 |
| `assist_person` | 搀扶行走 | 人；对方需要帮助，可以先发起；共同执行另须双方选择与准备 | 6，`help`，新增 |
| `accept_assistance` | 接受搀扶 | 对方的帮助邀请；自身可以配合 | 6，`help`，新增 |
| `walk_with_child` | 牵孩子走 | 人；有同行对象与共同目的地 | 4，`care`，新增 |
| `follow_adult` | 牵着成人的手走 | 同行活动中的儿童一方 | 4，`care`，新增 |
| `walk_dog` | 遛狗 | 人与狗的同行条件已具备 | 4，`care`，新增 |
| `pet_dog` | 摸狗 | 附近的狗；可接近并允许接触 | 3，`care`，新增 |
| `play_chess` | 下棋 | 棋桌；有可参与的棋局或可开局的对手 | 5，`chess`，沿用 |
| `watch_chess` | 看人下棋 | 棋桌；有人正在下棋 | 4.5，`watch`，沿用 |
| `watch_event` | 围观 | 当前事件；可看到共同焦点 | 3，`watch`，新增；争执等明显事件用 7，仍是同一行为的另一处境行 |
| `exercise` | 活动身体 | 自身／活动场地；有空间 | 3，`exercise`，新增 |
| `leg_stretch` | 压腿 | 物件；有可搭脚的支撑 | 3，`exercise`，新增 |
| `tai_chi` | 打太极 | 自身；有空间 | 3，`exercise`，新增 |
| `handstand` | 倒立 | 自身；有空间 | 3，`exercise`，新增 |
| `use_air_walker` | 玩漫步机 | 物件；设施空闲 | 3，`exercise`，新增 |
| `use_waist_twister` | 用扭腰器 | 物件；设施空闲 | 3，`exercise`，新增 |
| `do_pullups` | 做引体向上 | 物件；有空闲单杠 | 3，`exercise`，新增 |
| `swing_seated` | 荡秋千 | 物件；有空闲秋千 | 3，`exercise`，新增 |
| `slide_seated` | 玩滑梯 | 物件；有可用滑道 | 3，`exercise`，新增 |
| `play_seesaw` | 玩跷跷板 | 物件；有另一参与者或可邀请的人 | 3，`exercise`，新增 |
| `perform_guitar` | 弹吉他 | 自身；有吉他和可停留位置 | 3，`perform`，新增 |
| `react_startle` | 受惊 | 眼前明确的突发情况 | 8，`react`，新增 |
| `protect_self` | 躲避保护自己 | 眼前有威胁、可躲避 | 9，`react`，新增 |
| `recover_balance` | 失衡后稳住自己 | 当前出现失衡情况 | 8，`react`，新增 |
| `rest_after_fall` | 倒地后缓一缓 | 已经倒地／坐地不适 | 5，`react`，新增 |
| `help_fallen` | 扶起倒地的人 | 人；这次倒地仍需要帮助，可以先发起；共同执行另须双方愿意且实际到位；缺共同身体支撑执行能力前保持停用 | 6，`help`，新增 |

分数高不等于不可打断。绊倒和被推倒本身是已发生情况对应的动作，不加入“想摔倒”的随机候选；`recover_balance` 表示人对此作出的反应。

## 4. 移动、休息和等待怎样拆

所有动作 ID 都来自底层清单。`→` 表示条件满足后的一种正常推进，`／` 表示按情况选一项，不是无条件随机；任何地方都可以切换到其他高层行为。

| 高层行为 | 使用的底层动作与推进条件 |
|---|---|
| `walk` | `walk`；选定可走的局部去处。转向可用 `turn_walk`，到达可用 `stop_walk`。普通步态差异不改上半框 |
| `run` | `run`；自主跑步时上半框与动作相同。买东西途中跑起来则上半框仍为买东西，不另切成自主跑步 |
| `jog` | `jog`；相同规则，不强制先经过走、再慢跑、再跑的动画图 |
| `leave` | 朝出口 `walk`，确有赶路条件时 `run`；上下楼分别用 `walk_stairs_up`／`walk_stairs_down`。离开后不继续留一个活动文本框 |
| `sit_bench` | 到空座 `walk` → 需要坐下时 `sit_down` → `sit_bench`。正常自行起身可用 `stand_up`，切断不必等它播完 |
| `slouch_bench` | 到适合座位 `walk` → `sit_down` → `slouch_bench`。已经坐着就直接换成瘫坐，不重新走一遍 |
| `sit_sideways` | 到座位 `walk` → `sit_down` → `sit_sideways`；已坐下时直接改变坐姿 |
| `sit_step` | 到台阶 `walk` → `sit_step`；目前同名素材作为完整可见动作，保持／衔接需求不阻塞文字表达 |
| `sit_on_ground` | `walk` 到合适地面 → `sit_ground` → `sit_ground_hold`；原地合适则省略走过去 |
| `sit_knees_up` | 到合适地面 `walk` → `sit_ground` → `sit_knees_up`；已经坐地则直接抱膝 |
| `lie_ground_hold` | 到合适地面 `walk` → `lie_ground_hold`；本版不要求先补躺下动画才能表示躺着 |
| `lean_wall`／`lean_sign`／`lean_railing` | `walk` 到相应位置 → 对应同名倚靠动作；不是随机找一种倚靠替代选中的行为 |
| `wait_bus` | `walk` 到站点 → `stand_idle`。站着时可做 `check_watch`／`phone_browse`；车到了且能上车时 `walk` → `board_bus`，不规定等满几轮才准走 |
| `wait_person` | `walk` 到相约位置 → `stand_idle`；可用 `check_watch`、`look_around_nervous`、`pace` 表达不同当前情况。对方到了才产生打招呼／交谈等候选 |
| `queue`（内部环节） | 原事情保留目标，`walk` 到队尾 → `stand_idle`；前方让出位置才 `walk` 前移。自己轮到后推进原事情中的具体服务环节；轮到时购买已不是当前事情就跳过、名次作废。排队本身不含付款素材 |
| `fidget` | 原地选一个 `scratch_head`／`rub_eye`／`pat_dust`／`stretch`／`check_watch`／`look_up`／`yawn`，沿用现有“看不出选择原因的微小差别才可随机”的原则。擦汗等有明确原因的动作由对应情况提供，不能混进无条件抽签 |

其他低层姿态如 `cross_arms`、`hands_in_pockets`、`hands_behind_back` 可以作为原地停留的具体动作；要让人物主动选择某种姿态时，可用同名直接行为行，base 1.2、标签 `fidget`。它们不伪装成正坐／瘫坐的变体。

## 5. 买卖和物件使用怎样拆

### 5.1 买东西与摊主

`buy_stuff` 的目标参数是一个摊位，双方共用摊位上的活动状态。下面列的是条件关系，不是每次强制完整播放的固定流程。

| 当前情况 | 顾客仍为 `buy_stuff`，下半框动作 | 摊主的行为与动作 | 下一步依据 |
|---|---|---|---|
| 尚未到摊前 | `walk`；确实赶路时可 `run` | `tend_stall`：`vendor_call`／`vendor_tidy` | 顾客到达、摊主可服务后进入接待 |
| 摊主正在接待别人 | 维持 `buy_stuff`，进入 `queue` 等候环节；也可改做别的事情 | 看摊中的 `serve_customer` 环节服务当前顾客 | 不把“摊主存在”当成“摊主此刻有空” |
| 还没选好 | `choose_item`／`inspect_item`；水果可用 `fruit_choose`，书摊可用 `browse_bookstall` | `serve_customer`：`present`／`stand_idle` | 选定商品才进入后续，犹豫可 `hesitate_reach`；不要求每次都翻看或犹豫 |
| 商品需要处理 | `stand_idle`／`inspect_item`，取决于是否还在查看 | 需要称重才 `fruit_weigh`，早餐才 `prepare_food`，需要包装才 `pack_goods` | 按所选货物决定，不强制所有购买都称重或做早餐 |
| 可以结账 | 准备工具语义 `prepare_payment_tool`，就绪后展示 `present_payment_tool`；对应待补 | 共同结账中的 `confirm_checkout`；不是自动接到纸币 | 本次条款和所需准备成立，双方当前愿意且实际就位后共同开始；确认即在摊位记已付未取。详见主文档，不把整段 `wallet_takeout`／`pay` 当作本例绑定 |
| 商品可以交付 | `receive_item` | `give_item`；货若已放下，先 `take_item` | 双方当前选择相容、实际准备到位后才共同执行，不等对方已开始；交付成立即删去已付未取 |
| 需要找零 | `receive_item` | `give_item`，对象为零钱 | 不需要找零就省略；付款方式是当前交易条件 |
| 已取得本次商品 | 禁用重复付款／接物；仍为当前事情可正常收尾并走离服务区 | 完成当前配合，按规则服务下一位 | 达成依据保留；收尾中断即成功结束。身体未走仍占位置，不能把下一顾客写进同一点 |

顾客先来和摊主先吆喝都可以形成接待。吆喝使附近人产生相应摊位的购买候选或提高其处境分；本版先用 `buy_stuff` 基础分 4、吆喝期间 5 的明确处境行，两者取适用一行，不相加。吆喝不是向每个人强制派单。

`browse_stall` 复用接近与查看部分，未决定购买就可以离开；决定购买时切到同摊位的 `buy_stuff`，已到达就不重新走路。`tend_stall` 表示看摊这件事情，`serve_customer` 是它在当前顾客可接待时进入的内部环节，不靠另一条行为抢赢看摊的分数。停止当前身体配合不统一删掉摊主职责、营业和队列。服务中途被打断，本次服务就结束：未结账不留记录，回来按新购买；已结账则摊位保留已付未取，回来照常排队，轮到时只做交付，不重付。摊主中途要用手就把那份货 `put_down` 到摊位放置点。结果和正常收尾见主文档。

### 5.2 其他物件与服务

| 高层行为 | 底层动作与条件 |
|---|---|
| `buy_newspaper` | 到报摊后按该类服务的结账语义处理，再 `take_newspaper` 或由对方递出时 `receive_item`，不重复拿一份。柜台现金 `pay` 只在语义相符时对应，不假定素材已包含交易全程 |
| `use_vending` | 到机器后按设备规则选货／结账并等实际出货，再 `vending_collect`；机器付款语义待明确对应，不套用柜台放现金的 `pay`，也不同时强播两种相反顺序 |
| `withdraw_cash` | `walk` → `atm_keypad` → 设备可出钞才 `atm_take_cash`；不凭空补出已有刷卡动作 |
| `collect_parcel` | `walk` → `parcel_terminal`；现有对应是一整段操作并取件，本轮不假装已拆出独立柜门动作 |
| `post_letter`／`post_notice`／`read_notice` | 接近用 `walk`，到对应位置后用同名动作；没有目标物或纸张时不产生该候选 |
| `use_fountain` | `walk` 到可用饮水设施 → `fountain_drink` |
| `cafe_drink` | `walk` 到桌边座位 → `sit_down` → `cafe_sit_drink`；两口之间可 `sit_bench`，不在每口之后站起 |
| `use_payphone` | `walk` 到电话 → `phone_booth_call`；整段包含拿起和放回听筒，文字不额外重复这些步骤 |
| `pass_door`（内部工作） | 为既定去处走到路线上的门，按需 `push_door`／`pull_door` 后通过；门已开则省略操作。上半框仍是原去处，不独立争分、不无故找门 |
| `hold_door` | 在门边用 `hold_door`；后面的人通过／放弃后，这个处境结束 |
| `pick_up_object` | `walk` 到地面物品 → `pick_up`；桌面拿取用 `take_item`，不挪用地面深蹲动作 |
| `throw_trash` | 手里有垃圾才 `walk` 到桶边 → `throw_trash`；上半框不会因为途中走路变成闲逛 |
| `rummage_bin` | `walk` 到可翻找位置 → `rummage_bin` |
| `sweep_area`／`mop_area` | 已有工具时 `walk` 到工作位置 → `sweep_ground`／`mop_ground`；需要换位置时再走，重新就位后继续，不为了凑链条每轮去取工具 |
| `water_plants` | 带水壶 `walk` 到花槽 → `water_planter_hold` |
| `hang_laundry` | 带衣物到晾晒点 `walk` → `hang_laundry` |
| `wipe_table` | 带擦拭工具到桌边 `walk` → `wipe_table`；对应素材待补，文字可以先显示 |

## 6. 个人事情和出行怎样拆

| 高层行为 | 底层动作与条件 |
|---|---|
| `eat_snack` | 停留时 `eat_snack`；已有可继续的行进目的地时可 `eat_walk`。没有食物不产生候选 |
| `drink` | 停留时 `drink`；在行进且当前饮料适合时 `walk_drink`。坐桌前喝杯中物使用 `cafe_drink`，不把站姿素材当成坐姿 |
| `smoke` | 停留时 `smoke`；已有行进去处时 `smoke_walk` |
| `phone_browse` | 原地 `phone_browse`；在行进时 `phone_walk`。`phone_browse` 的原地素材待补，不阻塞文字 |
| `phone_call` | 停留时 `phone_call`；已有行进目的地时 `walk_phone_call`；急切表演仍属同一动作语义 |
| `read_book` | 按实际站／坐姿及持书条件执行阅读和 `turn_page`；现有站姿素材不覆盖坐读，坐姿对应暂缺但语义可执行。坐着读书人仍坐着，不累计休息量，不从素材结束推出读完 |
| `read_newspaper` | 停留时 `read_newspaper`；有继续行进的原因时 `walk_newspaper` |
| `take_photo`／`film_phone` | 必要时 `walk` 换到能看见目标的位置 → 对应拍摄动作；当前目标消失后不继续对着空处拍 |
| `selfie` | `selfie`；不要求先走到特定物件 |
| `carry_to_place` | 按现有物件使用 `walk_carry_bag`、`walk_carry_bags`、`walk_carry_box`、`walk_briefcase`、`walk_backpack_straps`、`walk_newspaper_underarm`、`walk_hold_front`、`walk_closed_umbrella` 或 `carry_shoulder_bag`。停下时按对象用 `carry_bag`／`carry_bags`／`carry_box`／`carry_bucket`／`carry_shoulder`；没有对应的组合或保持素材先登记缺口，例如不能把扶肩包走路当成原地保持，不用空手走冒充已有持物素材。目的地要求放下才 `put_down` |
| `walk_with_umbrella` | 行进时 `walk_umbrella`，停留时 `hold_umbrella`。收起伞后走路可用 `walk_closed_umbrella`，不表示伞自动消失 |
| `push_cart`／`push_stroller`／`pull_suitcase` | 到对应物件前可 `walk`，开始携带后用相应同名动作；停下依旧保持物件上下文。`pull_suitcase` 的现有同名素材语义冲突保留待核实 |
| `ride_bicycle` | 到车边 `walk`；只有需要扫码时 `bike_scan_unlock`；推行用 `push_bicycle`，骑行用 `ride_bicycle`，停止踩踏但仍前进时 `coast_bicycle`。上／下车细分素材尚未对应，不宣称已齐 |
| `ride_scooter` | 使用对应车辆时 `ride_scooter`，不混同自行车 |
| `hail_taxi` | 保留同次打车目的：路边招车 → 车接受停靠 → 到获选车辆门边 → 上车；每步看事实推进，不另生 `enter_car` 高层候选，招手不等于车辆答应 |
| `enter_car`／`exit_car` | 有独立来源时可单独成为事情；打车流程则内部复用 `car_enter`。到门边并满足车辆条件才执行，不能从招手直接判定上车；车辆行驶另由车辆执行 |

每人只有一件当前事情。移动组合只能使用当前事情明确采用的行进目标，不暗中继续已结束事情的路线。排队时的通话是购买内部可用的消遣，被叫号抢占但不自动挂断；若通话本身是当前事情，购买须在高层比较中赢回，轮到时购买不是当前事情就跳过、名次作废。两件事争用身体或双手时不强行叠加；不引入任意自动多任务系统。

## 7. 多人互动怎样拆

需要另一人实际配合时引用共同模板。模板直接检查双方当前选择；对方的邀请作为 invited 处境计入回应一方的分数，等待到 invite_wait 仍未回应就结束本次尝试并用共享重试间隔。不设单独的“接受”候选，也不替对方选择。跨帧移动／执行不意味着要建立跨轮授权消息。

| 高层行为／双方 | 底层动作与推进条件 |
|---|---|
| `greet` | 朝对方 `wave`／`bow`；需要招对方过来时 `beckon`。对方可以回应、继续走或另做别的，不强制转入聊天 |
| `chat` | 先允许邀聊；双方选择相容、位置准备成立后才开始交谈。说时 `talk_gesture`、对方说时 `listen`，按实际回应选动作；不等待一个保持动作播完才换回合 |
| `whisper` | 接近对方 `walk` → `whisper`；对方听时 `listen`。可见动作不足不妨碍文字显示双方状态 |
| `argue` | 按当前发言／回应使用 `talk_accuse`、`interrupt`、`point_shout`、`shout`、`stop_hand`、`shrug`、`hands_on_hips`；退让可 `walk_backward`。不同人的指责和回应不要求同步抽同一动作 |
| `handshake` | 一方发起后保持等待；对方按 invited 处境比较是否回应。双方选择相容并就位后，共同执行阶段使用 `handshake_offer`／`handshake_reply`。现有源描述包含整段握动，不能直接把发起方素材当成单方邀握；如需表现伸手等待，须另有明确片段或待补对应。到时未回应就结束本次尝试，不立即重复；任何阶段仍可中断 |
| `give_object`／`receive_object` | 双方在合适位置才 `give_item`／`receive_item`；接收者可以不接。掉头走人就使接物条件消失，不虚构已经交换完成 |
| `distribute_flyer`／`receive_flyer` | 发放者 `distribute_flyer`，接受者 `receive_flyer`；路人不接就继续原事。纸张消耗等结算细节不在本轮展开 |
| `interview`／`answer_interview` | 可以先发起采访；对方独立选择是否回应。双方当前选择相容且到位才提问／回答；描述、追问、指地点按回合事实选对应动作，不把六个片段固定循环 |
| `assist_person`／`accept_assistance` | 接近用 `walk` → 双方选择相容后 `assist_elder_walk`／`elder_assisted_walk`；任一方离开即停止依赖配合的动作 |
| `walk_with_child`／`follow_adult` | 接近并形成同行 → 成人 `walk_child_hand_down`，儿童 `child_hold_hand_walk`。儿童对应素材待补；文字框能先显示双方。较矮不是直接缩放成人素材的制作指令 |
| `walk_dog` | 人用 `walk_dog`，双方共享行进目标；狗的动作仍由动物系统表达，不用人的动作清单伪造 |
| `pet_dog` | 接近用 `walk` → 狗可接触时 `pet_dog`；狗离开就停止 |
| `help_fallen` | `walk` 到对方 → 双方选择相容才用 `help_up`，另一方 `helped_up`。这不是普通椅子起身，也不冒充已有双方素材；首版缺共同身体支撑执行能力，未实现前保持停用 |

### 下棋和围观

| 高层行为 | 底层动作与条件 |
|---|---|
| `play_chess` | 到棋桌 `walk` → `sit_down`；未轮到或思考时 `chess_think`，轮到且决定移子时 `chess_move`，当前棋局允许吃子才 `chess_capture`。悔棋情形才 `take_back_piece`；争论时可产生 `argue` 候选。没有另一个参与者就等待／邀请，不让单人自动演成双人局 |
| `watch_chess` | `walk` 到观看位置 → `stand_watch`／`chess_watch`；前方挡住时可 `crane_neck`／`peek_side`／`tiptoe`。没有遮挡时不随机踮脚，棋局结束后对应围观条件消失 |
| `watch_event` | 接近焦点 `walk` → `stand_watch`；低处目标可 `squat_watch`，被挡时 `crane_neck`／`peek_side`／`tiptoe`。向同伴低声交流可产生 `whisper` 候选，看到明显情况可产生指示／反应候选，不强制围观者都做同一种动作 |

棋局规则本轮只需要提供“谁参与、轮到谁、可以做什么”的状态，不在动作拆解中实现合法棋步引擎。`slap_table`、`cheer` 等保留为情况明确时的表达动作，不等于每局必拍桌或每步必欢呼。

## 8. 运动设施和反应怎样拆

| 高层行为 | 底层动作与条件 |
|---|---|
| `exercise` | 需要热身可 `stretch`，活动内容按场合 `exercise`／`march_in_place`／`spin`／`hop`；不是把所有活动素材依次播一遍 |
| `leg_stretch`／`tai_chi`／`handstand` | 到需要的位置后用同名动作；倒立也允许切断，不要求先制作退出动画 |
| `use_air_walker`／`use_waist_twister` | `walk` 到设施 → `air_walker`／`waist_twister`，设施不可用则不产生动作 |
| `do_pullups` | 到单杠 `walk` → `pullup_hold`，做一次时 `pullup_raise`，悬挂间歇回到 `pullup_hold`；动作次数不硬编码成高层行为分数 |
| `swing_seated`／`slide_seated` | 接近后使用对应同名动作；滑到底等设施条件控制是否继续，不能用动画循环次数代替滑道位置 |
| `play_seesaw` | 两侧各有参与者，分别 `seesaw_seated`／`seesaw_partner`；另一方离开，双人使用条件消失 |
| `perform_guitar` | 到停留位置 `walk` → `hold_guitar`，实际弹奏时 `play_guitar`。后者待补；不能用持琴素材声称已经有弹奏动作 |
| `react_startle` | `startle`；后续可出现继续原事、离开或自保等候选，不强制每次都逃跑 |
| `protect_self` | 看得见的威胁决定 `recoil`／`walk_backward`／`duck_cover`／`hands_on_head`／`hands_up`，需要远离才 `run`。没有威胁不靠高基础分常驻抢走其他行为 |
| `recover_balance` | 稳住身体可使用 `stumble` 等恢复动作；实际跌倒先由外部身体事实发生，并按方向显示 `trip_fall`／`fall_back`，不等本候选赢分才倒。随后可产生 `rest_after_fall` 或恢复／求助选择 |
| `rest_after_fall` | 当前坐地不适用 `sit_ground_dazed`／`sit_ground_dazed_hold`，已经躺着用 `lie_ground_hold`，能自行起身时 `get_up_ground`；有人帮扶时可参与 `help_fallen` 的受助一方 |

## 9. 不强行升级成高层欲望的底层动作

下列保留为具体情境的动作供应，不自动加入平时闲逛的随机候选：

- 身体不适／环境表现：`cough`、`sneeze`、`wipe_sweat`、`fan_self`、`rub_hands`、`scratch_back`、`adjust_clothes`、`shake_foot`、`stand_hunched`、`walk_cold`。
- 观察／回应：`look_down`、`look_away`、`look_around_nervous`、`point`、`present`、`laugh`、`cheer`、`sigh`、`cover_face`、`lecture`。
- 针对明确对象的冲突或查看：`block_way`、`grab_snatch`、`reach_after`、`crouch_check`；例如当前争执中阻拦离开的人可以产生相应候选，但不会因为库里有“抢”就让每个路人无条件去抢。
- 地点／姿态细节：`tiptoe_walk`、`skip`、`walk_cane`、`squat`、`squat_down`、`kneel_hold`、`get_up_ground`。它们按当前情况被行为引用，不需要各自新造一个心理目标。

需要明确原因时才加对应的处境行；不为使每个素材都有一行“想做”而制造无缘由行为。把它们放在这里也不等于缺少素材导致暂停设计。主文档里 `adjust_clothes` 的一行示例只用于演示新增成本，是否启用另看这里。

## 10. 当前交付边界

已形成底层动作 ID、素材名称对应、缺口标记，以及引用这些动作的高层候选、基础分、条件和过程拆解。未生成 JSON、计时配置、实际场景或 UI，也未更新素材制作任务。

主文档以最小新增样例、共享默认和模板为入口。本表可继续保留未设计项目，只启用能用现有动作／模板表达的部分；不要求全部条目补成手写过程。首次实现仍需共用执行器与模板；本次没有运行数据、原型或游戏验证。