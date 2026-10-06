# 动作统一清单（草案，2026-10-06）

用来定"要哪几种动作"。底下的数据量法和 [motion_chain_review_2026-10-06.md](motion_chain_review_2026-10-06.md) 一样：手肘、手、膝、脚 8 个关节，去掉根位置和朝向后的最大差。括号里是厘米。

## 做法

- **静止姿势**：一帧 json。每条动作的首帧、末帧都必须是某个静止姿势（钉死，不是"差不多"）。
- 静止姿势尽量从已有素材的某一帧取，这样那条素材本身就不用动。
- 每个静止姿势配三样：
  - **循环**：首末都是它；
  - **进入**：从上一级静止姿势到它的转换动作；
  - **退出**：从它回上一级的转换动作。
- 上一级一般是"站"。坐地、躺这类按级走：站 ↔ 坐地 ↔ 躺。
- 一个静止姿势上可以挂好几条循环，比如"右手拿着小东西"上挂抽烟、喝、吃。
- 没有停留姿势的动作（鞠躬、打喷嚏）只有一条，首末都是"站"。
- 走、跑没有真正静止的一帧，取步态里固定的一帧当它的"静止姿势"，形式一样，也是一帧 json。
- **合并的标准**：停留姿势相差约 30 cm 以内、内容是同一类的，并到一个静止姿势上，各自作为上面的不同循环。文件完全相同的只留一个名字。

标记：

- ✓：已有，端点和静止姿势相差 15 cm 以内；
- △：已有，但端点对不上，要钉到这个静止姿势重出，或者换起点重剪；
- ✗：缺。

## 一、站（总枢纽）

- **静止姿势**：`stand_idle` 第 0 帧。
- **循环**：`stand_idle` ✓。`stand_hunched`（驼背站）单独算一个静止姿势，见第二节。

## 二、站着的变化（上一级都是"站"）

| 静止姿势 | 取自 | 循环 | 进入（站→） | 退出（→站） |
|---|---|---|---|---|
| 驼背 | `stand_hunched` 末帧 | 驼背站着 ✗ | `stand_hunched` △（首帧离站 13，要钉到站） | ✗ |
| 抱臂 | `cross_arms` 首帧 | `cross_arms` ✓ | ✗ | ✗ |
| 叉腰 | `hands_on_hips` 首帧 | `hands_on_hips` ✓ | ✗ | ✗ |
| 背手 | `hands_behind_back` 首帧 | `hands_behind_back` ✓；左右张望 `look_around_nervous` △（25） | ✗ | ✗ |
| 插兜 | `hands_in_pockets` 末帧 | 站着插兜 ✗ | `hands_in_pockets` △（首帧离站 19） | ✗ |
| 双手抱头 | `hands_on_head_hold` 首帧 | `hands_on_head_hold` ✓ | ✗ | ✗ |
| 捂脸 | `cover_face` 首帧 | ✗ | ✗ | `cover_face` ✓ |
| 右手在头侧（挠头） | `scratch_head` 首帧 | 挠头 ✗ | ✗ | `scratch_head` ✓ |
| 双手举过头 | `hands_up_hold` 首帧 | `hands_up_hold` ✓；挥双手 `wave_both_overhead` 举起后那段 △（16）；欢呼 `cheer` △（27）；举相机拍 `photo_overhead` △（40） | `hands_up` ✓（3）；`wave_both_overhead` 前段 △ | `cheer` 后段 △ |
| 左手高举 | `wave_overhead` 末帧 | 挥手 `wave_overhead_v2` △（现在首末差 28，不是循环） | `wave_overhead` ✓ | `wave_overhead_v3` △（首帧接 v2 末帧，0） |
| 手在领口 | `adjust_clothes` 首帧 | 整理领口 ✗ | ✗ | `adjust_clothes` ✓ |
| 手在衣摆 | 新做 | 拉衣角 ✗ | 领口→衣摆 ✗ | ✗ |
| 右手拿着小东西在胸前 | `grab_snatch` 末帧 | 抽烟 `smoke` △（24）；吃 `eat_snack` △（首 31，末 16）；喝 `drink` △；扇风 `fan_self` △；低头看手里的东西 `inspect_item` △（首 16） | 捡起 `pick_up` ✓（15）；买报 `buy_newspaper` ✓（14）；抢 `grab_snatch` ✓；取钱 `atm_take_cash` △（19）；掏钱包 `wallet_takeout` △（21）；早餐摊买 `breakfast_buy` △（21） | ✗ |
| 打电话（右手在耳边） | `phone_call` 首帧 | 通话 ✗（`phone_call` 首末差 18 △） | `phone_booth_call` ✓（15） | ✗ |
| 双手在胸前拿着 | `film_phone` 首帧 | 拍视频 `film_phone` ✓；翻页 `turn_page` ✓（12）；看书 `read_book` ✓（15）；拍照 `take_photo` △（18）；看报 `read_newspaper` △（21）；搓手 ✗ | 搓手 `rub_hands` ✓（11） | ✗ |
| 看表（左小臂横在胸前） | `check_watch` 中段 | ✗ | ✗ | ✗ |
| 右手向前伸着 | `hail_taxi` 末帧 | 招车 ✗；指着 ✗；拦 ✗ | `hail_taxi` ✓；`point_shout` △（24）；`interrupt` △（22）；`stop_hand` △（32） | ✗ |
| 握手位 | `handshake_offer` 中段 | ✗ | ✗ | ✗ |
| 双臂侧平举（拦路） | `block_way` 首帧 | `block_way` △（首末差 27） | ✗ | ✗ |
| 双手护在胸前 | `recoil` 首帧 | 受惊后缩 `recoil` ✓ | ✗ | ✗ |
| 采访递话筒 | `interview_question` 末帧 | 举着话筒 ✗ | 抬起：`interview_question`、`interview_followup`、`interview_listen` △（首帧都不是站，三者末帧互差 45–92，可能得分成两个姿势） | 放下 ✗ |
| 举手机自拍 | `selfie` 末帧 | 举着自拍 ✗ | 抬起：`selfie` △（首帧不是站） | 放下 ✗ |
| 手向侧伸展示 | `present` 中段 | 伸着展示 ✗ | 抬起 ✗ | 放下 ✗（`present` 整条保留不删） |
| 扛在肩上 | `carry_shoulder` 首帧 | `carry_shoulder` ✓ | 扛起 ✗ | 放下 ✗ |
| 抱箱 | `carry_box` 首帧 | `carry_box` ✓ | 搬起 ✗ | 放下 ✗ |
| 撑伞 | `hold_umbrella` 首帧 | `hold_umbrella` ✓ | 撑开 ✗ | 收起 ✗ |
| 抱吉他 | `hold_guitar` 首帧 | `hold_guitar` ✓ | ✗ | ✗ |
| 双手握杆 | `mop_ground` 首帧 | 拖地 `mop_ground` ✓；扫地 `sweep_ground` △（27） | ✗ | ✗ |
| 撑门 | `hold_door` 首帧 | `hold_door` ✓ | ✗ | ✗ |
| 浇水 | `water_planter_hold` 首帧 | `water_planter_hold` ✓ | ✗ | ✗ |
| 扶栏前倾 | `lean_railing` 首帧 | `lean_railing` ✓ | ✗ | ✗ |
| 扶牌 | `lean_sign` 首帧 | `lean_sign` ✓ | ✗ | ✗ |
| 背靠墙 | `lean_wall` 首帧 | `lean_wall` ✓ | ✗ | ✗ |
| 压腿 | `leg_stretch` 首帧 | `leg_stretch` ✓ | ✗ | ✗ |
| 弯腰翻找 | `rummage_bin` 末帧 | ✗ | `rummage_bin` ✓ | ✗ |
| 侧身探看 | `peek_side` 末帧 | ✗ | `peek_side` ✓ | ✗ |
| 凑近看告示 | `read_notice` 末帧 | ✗ | `read_notice` ✓ | ✗ |
| 双手扶后腰 | `stand_up_support_back` 末帧 | ✗ | 从坐地来：`stand_up_support_back` △（首帧离"坐地"35） | ✗ |
| 夹着报纸 | 新做 | ✗ | ✗ | ✗ |
| 挎着包 | 新做 | ✗ | ✗ | ✗ |
| 抓着背包带 | 新做 | ✗ | ✗ | ✗ |
| 握着推把（购物车、婴儿车） | 新做 | ✗ | ✗ | ✗ |
| 扶着自行车 | 新做 | ✗ | ✗ | ✗ |
| 拉着箱子 | 新做 | ✗ | ✗ | ✗ |
| 牵着狗 | 新做 | ✗ | ✗ | ✗ |

最后 7 个是给"拿着东西走"起步、停步用的（见第四节）。

## 三、低姿势（按级接）

标"先不做"的是器械，这次不做，也不算进数量。

| 静止姿势 | 上一级 | 取自 | 循环 | 进入 | 退出 |
|---|---|---|---|---|---|
| 坐椅 | 站 | `sit_bench` 首帧 | `sit_bench` ✓；下棋 `chess_move` ✓（0）；跷跷板 `seesaw_seated`（器械，先不做）；喝咖啡 `cafe_sit_drink` △（24）；拿回棋子 `take_back_piece` △（39） | 坐下 ✗（现在用程序插值 `seat_transition.gd`） | 起身 ✗（同上） |
| 瘫坐 | 坐椅 | `slouch_bench` 首帧 | `slouch_bench` ✓ | ✗ | ✗ |
| 侧身坐 | 坐椅 | `sit_sideways` 首帧 | `sit_sideways` ✓ | ✗ | ✗ |
| 坐台阶 | 站 | `sit_step` 首帧 | `sit_step` ✓ | ✗ | ✗ |
| 坐地（手撑后） | 站 | `sit_ground` 末帧 | 坐地 ✗ | `sit_ground` ✓；向后摔坐 `fall_back` ✓（14） | `slide_seated` ✓（9）；扶腰起身 `stand_up_support_back` △（35） |
| 坐地抱膝 | 坐地 | `sit_knees_up` 首帧 | `sit_knees_up` ✓ | ✗ | ✗ |
| 坐地发呆 | 坐地 | `sit_ground_dazed_hold` 首帧 | `sit_ground_dazed_hold` ✓ | `sit_ground_dazed` △（末帧 ✓ 3，首帧离"坐地"64） | ✗ |
| 深蹲 | 站 | `squat_down` 末帧 | 蹲着 `squat` △（32） | `squat_down` ✓ | `stand_up` ✓（0） |
| 蹲着前压看 | 深蹲 | `crouch_check_hold` 首帧 | `crouch_check_hold` ✓；`squat_watch` △（19） | 从站直接来：`crouch_check` ✓（12） | ✗ |
| 蹲着抱头 | 深蹲 | `duck_cover_hold` 首帧 | `duck_cover_hold` ✓ | 从站直接来：`duck_cover` ✓（13） | ✗ |
| 单膝跪 | 站 | `kneel_hold` 首帧 | `kneel_hold` ✓ | ✗ | ✗ |
| 躺 | 坐地 | `lie_ground_hold` 首帧 | `lie_ground_hold` ✓ | ✗ | ✗ |
| 趴 | 站（摔） | `trip_fall` 末帧 | ✗ | 绊倒 `trip_fall` △（首帧在走路中） | 爬起 ✗ |
| 倒立 | 站 | `handstand` 首帧 | `handstand` ✓ | ✗ | ✗ |
| 吊杠（先不做） | 站 | `pullup_hold` 首帧 | `pullup_hold` ✓；引体向上 `pullup_raise` ✓（0） | 跳上杠 ✗ | 下杠 ✗ |
| 漫步机上（先不做） | 站 | `air_walker` 首帧 | `air_walker` △（根部移了 6.5 m，应在原地） | 上器械 ✗ | 下器械 ✗ |
| 扭腰器上（先不做） | 站 | `waist_twister` 首帧 | `waist_twister` ✓ | 上器械 ✗ | 下器械 ✗ |
| 秋千上（先不做） | 站 | 新做 | ✗（`swing_seated` 数据里是站着的，不能用） | ✗ | ✗ |

## 四、走、跑（静止姿势取步态里固定的一帧）

现有的起步、停步都接不上走路：`start_walk` 末帧和 `walk` 任何一帧最少差 21，`stop_walk` 首帧最少差 45。

走路的各种风格分三种处理。括号里的数，是在两条循环里各找最像的一帧、在那一刻切换时差多少：

1. **和"走"直接切换，不做转换动作**：手里没拿东西，或者只是垂手提着，切换时差 27 以内。
2. **和"走"之间单独做过渡**：没拿东西但差得大的 `walk_cold`（61），以及提桶 `carry_bucket`（33）。
3. **拿着东西走**：从对应的"站·拿着东西"起步、停步（第二节），不和"走"切换。

| 静止姿势 | 取自 | 循环 | 进入 | 退出 |
|---|---|---|---|---|
| 走 | `walk` 首帧 | `walk` ✓；绕着踱步 `pace` ✓（0） | 起步 `start_walk` △；转身起步 `turn_walk` △ | 停步 `stop_walk` △ |
| 风格走（20 种，各自首帧，和"走"直接切换） | 各自首帧 | 倒退 `walk_backward`（5）、边走边说 `walk_talk`（7）、僵硬 `walk_rigid`（8）、快走 `walk_brisk`（9）、累 `walk_tired`（9）、仰头 `walk_look_up`（11）、瘸 `walk_limp`（12）、拄拐 `walk_cane`（14）、牵小孩 `walk_child_hand_down`（15）、一臂不摆 `walk_one_arm_still`（16）、单手插兜 `walk_one_pocket`（17）、老人小步 `walk_elderly_short`（20）、双手插兜 `walk_hands_pockets`（21）、看表 `walk_check_watch`（24）、昂首 `walk_proud`（24）、慢走 `walk_slow`（27）、提包 `walk_carry_bag`（7）、公文包 `walk_briefcase`（19）、两手提袋 `walk_carry_bags`（20）、提收起的伞 `walk_closed_umbrella`（20） ✓ | 不做 | 不做 |
| 缩着身子走 | `walk_cold` 首帧 | `walk_cold` ✓ | 走→缩着走 ✗ | 缩着走→走 ✗ |
| 提桶走 | `carry_bucket` 首帧 | `carry_bucket` ✓ | 走→提桶走 ✗ | 提桶走→走 ✗ |
| 走·右手拿着小东西 | `eat_walk` 首帧 | `eat_walk` ✓；边走边喝 `walk_drink` △；边走边抽 `smoke_walk` △ | 从"站·右手拿着小东西"起步 ✗ | 停步回去 ✗ |
| 走·看手机 | `phone_walk` 首帧 | `phone_walk` ✓ | 从"站·右手拿着小东西"起步 ✗ | 停步回去 ✗ |
| 走·打电话 | `walk_phone_call` 首帧 | `walk_phone_call` ✓；来回踱着打 `phone_urgent` △ | 从"站·打电话"起步 ✗ | 停步回去 ✗ |
| 走·双手在胸前拿着 | `walk_hold_front` 首帧 | `walk_hold_front` ✓；`walk_newspaper` △（18） | 从"站·双手在胸前拿着"起步 ✗ | 停步回去 ✗ |
| 走·抱箱 | `walk_carry_box` 首帧 | `walk_carry_box` ✓ | 从"站·抱箱"起步 ✗ | 停步回去 ✗ |
| 走·撑伞 | `walk_umbrella` 首帧 | `walk_umbrella` ✓ | 从"站·撑伞"起步 ✗ | 停步回去 ✗ |
| 走·夹报纸 | `walk_newspaper_underarm` 首帧 | `walk_newspaper_underarm` ✓ | 从"站·夹着报纸"起步 ✗ | 停步回去 ✗ |
| 走·挎包 | `carry_shoulder_bag` 首帧 | `carry_shoulder_bag` ✓ | 从"站·挎着包"起步 ✗ | 停步回去 ✗ |
| 走·抓背包带 | `walk_backpack_straps` 首帧 | `walk_backpack_straps` ✓ | 从"站·抓着背包带"起步 ✗ | 停步回去 ✗ |
| 走·推车 | `push_cart` 首帧 | 购物车 `push_cart` ✓；婴儿车 `push_stroller` ✓（2，同一条动作换配件） | 从"站·握着推把"起步 ✗ | 停步回去 ✗ |
| 走·推自行车 | `push_bicycle` 首帧 | `push_bicycle` ✓ | 从"站·扶着自行车"起步 ✗ | 停步回去 ✗ |
| 走·拖箱子 | `pull_suitcase` 首帧 | `pull_suitcase` ✓ | 从"站·拉着箱子"起步 ✗ | 停步回去 ✗ |
| 走·牵狗 | `walk_dog` 首帧 | `walk_dog` ✓ | 从"站·牵着狗"起步 ✗ | 停步回去 ✗ |
| 上台阶 | `walk_stairs_up` 首帧 | `walk_stairs_up` ✓ | 平地走→上台阶 ✗ | 上台阶→平地走 ✗ |
| 下台阶 | `walk_stairs_down` 首帧 | `walk_stairs_down` ✓ | 平地走→下台阶 ✗ | 下台阶→平地走 ✗ |
| 慢跑 | `jog` 首帧 | `jog` ✓ | 走→慢跑 ✗ | 慢跑→走 ✗ |
| 跑 | `run` 首帧 | `run` ✓；绕圈跑 `run_curve` ✓（0） | 慢跑→跑 ✗ | 跑→慢跑 ✗ |
| 蹦跳步 | `skip` 首帧 | `skip` ✓ | 走→蹦跳 ✗ | 蹦跳→走 ✗ |
| 原地踏步 | `march_in_place` 首帧 | `march_in_place` ✓ | 站→踏步 ✗ | 踏步→站 ✗ |
| 开合跳 | `exercise` 首帧 | `exercise` ✓；`hop` △（40，内容几乎一样，可合并成一条） | 站→开合跳 ✗ | 开合跳→站 ✗ |

两人走（扶老人 `assist_elder_walk` / 被扶 `elder_assisted_walk`）先不做。

## 五、站→站 一次性动作（不拆，首末都钉"站"）

- **已经钉在"站"上（< 1 mm）的 17 条**：`beckon`、`bow`、`chess_watch`、`choose_item`、`give_item`、`laugh`、`lecture`、`look_away`、`point`、`present`、`receive_item`、`sigh`、`startle`、`talk_gesture`、`talk_shy`、`whisper`；`receive_flyer` 与 `receive_item` 是同一个文件，留一个名字。
- **端点在 15 cm 内、没钉死（✓，接缝处会有小跳）**：
  - `atm_keypad`、`breakfast_sell`、`brush_clothes`、`car_enter`、`carry_bags`、`distribute_flyer`
  - `fountain_drink`、`fruit_choose`、`fruit_weigh`、`hesitate_reach`、`interview_point`、`parcel_terminal`、`pay`
  - `post_letter`、`post_notice`、`press_button`、`push_door`、`reach_after`、`rub_eye`、`shrug`、`sneeze`
  - `spin`、`stumble`、`talk_accuse`、`tiptoe`、`turn_about`、`turn_left_quarter`、`turn_right_quarter`
  - `vending_collect`、`vendor_call`、`vendor_tidy`、`wave`、`wipe_sweat`、`look_down`、`look_up`
  
  其中 `car_enter`（上车）这次先不做。
- **差一点回到站姿，要钉到"站"重出（△）**：
  - `cough`（末 17）、`yawn`（末 17）、`scratch_back`（末 16）、`crane_neck`（首 17）、`pat_dust`（首 33）
  - `shout`（首末 17–18）、`browse_bookstall`（17/18）、`slap_table`（27）、`throw_trash`（32）、`bike_scan_unlock`（33/31）
  
  这些现在被当成循环，实际是站着做完一件事。
- **站→站 但中间有停留，按"有停留就拆三条"的规矩要拆（整条保留不删）**：

| 动作 | 停留姿势 | 拆出来要补的 |
|---|---|---|
| `hands_on_head` | 双手抱头 | 见第二节"双手抱头" |
| `check_watch` | 看表 | 见第二节"看表" |
| `handshake_offer` / `handshake_reply` | 握手位（两人） | 两人动作，先不做 |
| `point`、`interview_point` | 手向前伸着 | 见第二节"右手向前伸着" |
| `hang_laundry`、`stretch` | 双手举过头 | 归到"双手举过头" |
| `present` | 手向侧伸展示 | 见第二节"手向侧伸展示" |

## 六、其他已有素材的归属

- **两人、器械、上下车（这次先不做）**：跷跷板 `seesaw_partner` / `seesaw_seated`（同一个文件）、握手 `handshake_*`、上下车 `car_enter` / `car_exit`、扶老人 `assist_elder_walk` / `elder_assisted_walk`、吊杠 `pullup_*`、漫步机 `air_walker`、扭腰器 `waist_twister`、秋千 `swing_seated`。
- **球类、打斗、舞蹈、表演（2026-10-06 已删并冻结）**：`badminton_swing`、`basketball_dribble`、`basketball_shoot`、`football_juggle`、`table_tennis_play`、`table_tennis_partner`、`shadow_box`、`square_dance`、`magic_gesture`、`guard`、`dodge`。不进这份清单，见 `assets/动作生成任务清单.md`"冻结"一节。
- **太极 `tai_chi`**：要重做，单独一项，不进这份清单。
- **开门（在范围里）**：`push_door` 是站→站 ✓；`pull_door` 首末都在迈步中，改首末帧钉到"站" △。
- **剩下的转换动作**：
  - 首末都不在任何静止姿势上、没处归的：`interview_answer`、`interview_describe`、`stand_watch`、`talk_excited`、`shake_foot`、`stop_hand` 末帧（并进"右手向前伸着"）、`back_away`（后退护身，首末在退步中）。
  - 都按第七节第 1 条改首末帧，当站→站一次性动作用 △。
- **`eat_walk`**：已列在"走·右手拿着小东西"。

## 七、已定（Hsinlung，2026-10-06）

1. **端点对不上的（△）**：大多不重新生成，只改首帧或前几帧（末帧同理），把首末帧改到静止姿势上。差得大的（比如 `adjust_clothes` 首帧离站 64、`pat_dust` 33），只改几帧会不自然，这种直接重出也行。
2. **端点钉死**：首末帧和静止姿势完全一样。标 ✓ 的（差 3–15 cm）也照第 1 条改首末几帧。
3. **驼背站**（`stand_hunched`）：单独一个静止姿势，配进入、退出。
4. **走路的各种风格**：按第四节分三种：20 种和"走"直接切换；`walk_cold`、`carry_bucket` 和"走"之间单独做过渡；拿着东西走的从对应的"站·拿着东西"起步、停步。
5. **展示、递话筒、自拍**：拆开，都按抬起 → 循环 → 放下三段做（见第二节对应三行）。
6. **范围**：两人动作、器械、上下车这次先不做，只做单人的站、低姿势、走。

## 数量（按第七节已定的算，不含"先不做"的）

| 项 | 数量 |
|---|--:|
| 静止姿势 | 103：站 1 + 站着的变化 45 + 低姿势 14 + 走跑 43（其中风格走 20） |
| 要新做的动作 | 164：循环 29，进入、退出 135 |
| 现有素材在范围里的 | 215 条（现有 230 条，去掉先不做的 13 条、重复的 `receive_flyer`、待重做的 `tai_chi`） |

- 现有素材里，已经钉死在"站"上的 17 条不用动；其余的按第七节第 1 条改首帧或末帧，有的只改一头。表里 △ 后面数字超过 30 的，只改几帧可能不自然，得看画面决定要不要重出。
- 新做的大头是各种姿势的进入、退出。行为表里实际用到的动作只有 20 条，建议先补它们涉及的姿势：站、坐椅、瘫坐、走、慢走、右手拿着小东西、看表。
