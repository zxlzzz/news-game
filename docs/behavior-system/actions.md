# 底层动作清单

2026-10-18 的第一版动作盘点，2026-10-19 仅同步与执行设计方案直接冲突的声明。只有 Markdown，没有新增素材、运行数据或播放代码。先读 [主文档](execution-plan.md)，再查本表及 [高层行为盘点](behaviors.md)。

使用方式以 [主文档](execution-plan.md) 为准。本表是盘点，不是必须全部实现的前置清单。复用 once／hold 等共用动作声明即可支持普通一行行为；有物件效果、分支或真实配合才补相应语义。启用动作必须有定义，但可以未绑定素材；明确停用和 TODO 不伪装成已完成。

## 怎样使用这份清单

底层动作回答“这个人此刻身体在做什么”，用于文本框下半部分，以后对接动作素材。高层行为回答“这个人正在做哪件事”，用于上半部分和行为权重表。底层动作不是肌肉、关节或每次伸手的分解，而是一段能独立表达的动作，例如走、挑选、付款、接物。

- `run` 可以同时是高层行为和底层动作，两者相同就只显示一遍。
- `buy_stuff` 是本版采用的高层行为名，不是底层动作，也不是当前 JSON 已有的键。它可以使用 `walk`、`run`、`choose_item`、`pay`、`receive_item` 等动作。
- 合并同一动作的表演变体，不因步态僵硬、疲惫、挥手幅度或伸向不同方向而增加行为种类。正坐／瘫坐、给／接、站立／蹲下等区别保留。
- 同时做两件可见事情的动作先保留现有素材接口，例如 `phone_walk` 与 `walk` 不合并。这里不引入动作叠加系统。
- 所有动作都能随时切断。坐下、起身等动作可以在正常过程中出现，但不成为切换其他行为的强制通道。
- “已有对应”仅表示查到了素材名称，不表示画面已通过验收、已能串联或已接入街道。
- “待补”允许文字执行语义；不向素材生产队列自动增加任务，也不因缺素材删掉相应行为。动作开始、继续、实际效果和正常收尾分别声明；正常收尾可切断，结果不回滚。站姿对应不能静默当作坐姿，取消不清空实际持物。

当前对应依据：[运行素材索引](../../godot/npc/motion/index.json)、[素材声明](../../godot/npc/clip-setup.json)及需要澄清语义时查阅的源 `meta.json`。下面的名字是行为设计接口，素材文件不改名。

## 1. 移动

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `walk` | 走路；快慢、年龄和普通步态风格暂不分项 | `walk`, `walk_brisk`, `walk_slow`, `walk_elderly_short`, `walk_limp`, `walk_proud`, `walk_rigid`, `walk_tired`, `walk_one_arm_still`, `walk_hands_pockets`, `walk_one_pocket` |
| `run` | 跑；弯道跑不另立种类 | `run`, `run_curve` |
| `jog` | 慢跑；与跑、走保留区别 | `jog` |
| `walk_backward` | 后退 | `walk_backward`, `back_away` |
| `tiptoe_walk` | 踮脚走；与原地踮脚看区别保留 | 待补；现有 `tiptoe` 的源描述是原地踮脚观看 |
| `skip` | 蹦跳着前进 | `skip` |
| `hop` | 单次蹦跳 | `hop` |
| `pace` | 来回踱步 | `pace` |
| `walk_stairs_up` | 上楼梯 | `walk_stairs_up` |
| `walk_stairs_down` | 下楼梯 | `walk_stairs_down` |
| `walk_cane` | 拄拐走；有实际支撑物 | `walk_cane` |
| `start_walk` | 起步 | `start_walk` |
| `stop_walk` | 停步 | `stop_walk` |
| `turn` | 原地转向；左右和角度作为目标参数 | `turn_left_quarter`, `turn_right_quarter`, `turn_about` |
| `turn_walk` | 走动中转向 | `turn_walk` |
| `phone_walk` | 边走边看手机 | `phone_walk` |
| `walk_phone_call` | 边走边打电话 | `walk_phone_call` |
| `walk_check_watch` | 边走边看表 | `walk_check_watch` |
| `walk_look_up` | 边走边抬头看 | `walk_look_up` |
| `eat_walk` | 边走边吃 | `eat_walk` |
| `walk_drink` | 边走边喝 | `walk_drink` |
| `smoke_walk` | 边走边抽烟 | `smoke_walk` |
| `walk_talk` | 边走边说话 | `walk_talk` |
| `walk_cold` | 抱紧身体走路 | `walk_cold` |

`walk` 的合并只处理本轮不展开的表演变体；不删除拄拐需求、随身物或后续人物差异。上楼、下楼和后退也不能靠换一个普通走路名字冒充。

## 2. 姿态与姿态变化

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `stand_idle` | 自然站立 | `stand_idle` |
| `stand_hunched` | 弓背站着 | `stand_hunched` |
| `sit_bench` | 正坐在座位上 | `sit_bench` |
| `slouch_bench` | 瘫坐在座位上 | `slouch_bench` |
| `sit_sideways` | 侧身坐 | 有同名 `sit_sideways`；源文字只描述后靠坐姿，侧身语义对应待核实 |
| `sit_step` | 坐在台阶上 | `sit_step` |
| `sit_knees_up` | 坐地抱膝 | `sit_knees_up` |
| `sit_ground` | 从站立坐到地上；不是坐地保持 | `sit_ground` |
| `sit_ground_hold` | 普通坐地保持 | 待补：不能把 `sit_ground` 的坐下过程当成保持 |
| `sit_ground_dazed` | 蹲坐到地上、显得不适 | `sit_ground_dazed` |
| `sit_ground_dazed_hold` | 坐地不适、扶着身体 | `sit_ground_dazed_hold` |
| `lie_ground_hold` | 躺在地上 | `lie_ground_hold` |
| `squat` | 蹲着 | `squat` |
| `squat_down` | 蹲下 | `squat_down` |
| `kneel_hold` | 跪着 | `kneel_hold` |
| `sit_down` | 在座位前坐下 | `sit_down` |
| `stand_up` | 从座位起身；扶背版本先归为同一动作 | `stand_up`, `stand_up_support_back` |
| `get_up_ground` | 从普通坐地／躺地状态起身 | 待补：不拿椅子起身素材当作已对应 |
| `lean_wall` | 靠墙站 | `lean_wall` |
| `lean_sign` | 靠站牌站 | `lean_sign` |
| `lean_railing` | 扶栏杆前倾 | `lean_railing` |
| `cross_arms` | 抱臂站 | `cross_arms` |
| `hands_on_hips` | 叉腰站 | `hands_on_hips` |
| `hands_in_pockets` | 插兜站 | `hands_in_pockets` |
| `hands_behind_back` | 背手站 | `hands_behind_back` |
| `hands_on_head` | 双手抱头 | `hands_on_head`, `hands_on_head_hold` |
| `hands_up` | 举起双手 | `hands_up`, `hands_up_hold` |

正坐、瘫坐、侧坐既是不同底层动作，也可以是不同高层选择。坐下／起身是过程中可用的动作，不是另加一套不可中断规则。

## 3. 小动作、观察与表达

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `scratch_head` | 挠头 | `scratch_head` |
| `scratch_back` | 挠背 | `scratch_back` |
| `rub_eye` | 揉眼 | `rub_eye` |
| `rub_hands` | 搓手 | `rub_hands` |
| `pat_dust` | 拍掉身上的灰 | `pat_dust`, `brush_clothes` |
| `adjust_clothes` | 整理衣服 | `adjust_clothes` |
| `stretch` | 伸懒腰 | `stretch` |
| `yawn` | 打哈欠 | `yawn` |
| `cough` | 咳嗽 | `cough` |
| `sneeze` | 打喷嚏 | `sneeze` |
| `wipe_sweat` | 擦汗 | `wipe_sweat` |
| `fan_self` | 给自己扇风 | `fan_self` |
| `check_watch` | 看手表 | `check_watch` |
| `shake_foot` | 抖脚 | `shake_foot` |
| `look_up` | 抬头看 | `look_up` |
| `look_down` | 低头看 | `look_down` |
| `look_away` | 移开视线 | `look_away` |
| `look_around_nervous` | 不安地四处张望；不替代普通观察 | `look_around_nervous` |
| `stand_watch` | 站着观看 | `stand_watch` |
| `squat_watch` | 蹲着观看 | `squat_watch` |
| `crane_neck` | 伸脖子看 | `crane_neck` |
| `peek_side` | 侧身探看 | `peek_side` |
| `tiptoe` | 原地踮脚观看；不等于踮脚走 | `tiptoe` |
| `point` | 指向某处 | `point` |
| `point_shout` | 指着喊 | `point_shout` |
| `wave` | 挥手；高低、单双手和幅度暂不分项 | `wave`, `wave_overhead`, `wave_overhead_v2`, `wave_overhead_v3`, `wave_both_overhead` |
| `beckon` | 招手示意过来 | `beckon` |
| `bow` | 鞠躬 | `bow` |
| `shrug` | 摊手 | `shrug` |
| `laugh` | 发笑 | `laugh` |
| `cheer` | 欢呼 | `cheer` |
| `sigh` | 叹气 | `sigh` |
| `cover_face` | 掩面 | `cover_face` |
| `shout` | 大声喊 | `shout` |
| `stop_hand` | 举手示意停下 | `stop_hand` |
| `present` | 用手示意介绍一侧的东西 | `present` |
| `lecture` | 面向听众讲述、配合手势 | `lecture` |
| `nod` | 点头回应 | 待补；未因已有挥手而视为已覆盖 |
| `shake_head` | 摇头否认 | 待补 |

这些动作不是全部都要各配一条高层欲望。例如挠头可以是“原地小动作”的候选；点头可以是交谈中的回应。动作表保留区别，高层表决定何时使用。

## 4. 随身物与个人活动

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `carry_bag` | 原地提一个袋子 | `carry_bag` |
| `carry_bags` | 原地提多个袋子 | `carry_bags` |
| `carry_box` | 原地抱箱 | `carry_box` |
| `carry_bucket` | 提桶 | `carry_bucket` |
| `carry_shoulder` | 肩扛物件 | `carry_shoulder` |
| `carry_shoulder_bag` | 扶住肩包背带走路；不是原地保持 | `carry_shoulder_bag` |
| `walk_carry_bag` | 提袋走 | `walk_carry_bag` |
| `walk_carry_bags` | 提多个袋子走 | `walk_carry_bags` |
| `walk_carry_box` | 抱箱走 | `walk_carry_box` |
| `walk_briefcase` | 提公文包走 | `walk_briefcase` |
| `walk_backpack_straps` | 扶背包带走 | `walk_backpack_straps` |
| `walk_newspaper_underarm` | 夹着报纸走 | `walk_newspaper_underarm` |
| `walk_newspaper` | 边走边看报 | `walk_newspaper` |
| `walk_hold_front` | 双手在身前持物走 | `walk_hold_front` |
| `walk_closed_umbrella` | 拿着收起的伞走 | `walk_closed_umbrella` |
| `hold_umbrella` | 原地撑伞 | `hold_umbrella` |
| `walk_umbrella` | 撑伞走 | `walk_umbrella` |
| `pull_suitcase` | 拉行李箱走 | 有同名 `pull_suitcase`；源文字却描述提袋，语义对应待核实 |
| `drink` | 站着喝水 | `drink` |
| `eat_snack` | 站着吃东西 | `eat_snack` |
| `smoke` | 原地抽烟 | `smoke` |
| `phone_call` | 原地打电话；急切表演先并入同一动作 | `phone_call`, `phone_urgent` |
| `phone_browse` | 原地看手机 | 待补；`phone_walk` 是边走边看，不能直接登记为原地素材 |
| `read_book` | 站姿持打开的书阅读；坐读另缺素材 | `read_book` 仅站姿对应；当前运行声明仅站姿，不把坐读加入允许姿势 |
| `turn_page` | 持书翻页 | `turn_page` |
| `read_newspaper` | 原地看报 | `read_newspaper` |
| `take_photo` | 拍照；普通与举高手拍摄先合并 | `take_photo`, `photo_overhead` |
| `selfie` | 自拍 | `selfie` |
| `film_phone` | 举手机录像 | `film_phone` |
| `hold_guitar` | 持吉他；不表示已经弹奏 | `hold_guitar` |
| `wallet_takeout` | 取出钱包、打开查看、关闭并收回的整段 | `wallet_takeout`；源描述 6 秒结束双手空，不是工具就绪保持 |

## 5. 物件、服务和交易中的动作

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `choose_item` | 指选商品 | `choose_item` |
| `inspect_item` | 拿起翻看商品 | `inspect_item` |
| `hesitate_reach` | 伸手又缩回 | `hesitate_reach` |
| `pay` | 从右裤袋取钱、放到柜台并收手 | `pay`；源描述 3.5 秒，不是对方手接，不等于通用 checkout |
| `give_item` | 向对方递物；物件参数可以是货物或零钱 | `give_item` |
| `receive_item` | 从对方手里接物 | `receive_item` |
| `vendor_call` | 吆喝招徕 | `vendor_call` |
| `vendor_tidy` | 整理货品 | `vendor_tidy` |
| `fruit_choose` | 拿起水果查看再放回 | `fruit_choose` |
| `fruit_weigh` | 把水果放到秤上 | `fruit_weigh` |
| `browse_bookstall` | 在书摊翻看 | `browse_bookstall` |
| `take_newspaper` | 从报摊拿起报纸；素材不含完整付款 | `buy_newspaper` |
| `pick_up` | 从地面捡物后站起 | `pick_up` |
| `put_down` | 把手中物件放到指定支撑面上 | 待补通用素材；不以 `fruit_choose` 的特定放回当作全部覆盖 |
| `throw_trash` | 向垃圾桶投垃圾 | `throw_trash` |
| `rummage_bin` | 翻找垃圾桶 | `rummage_bin` |
| `press_button` | 按设施按钮 | `press_button` |
| `vending_collect` | 从低处出货口取物 | `vending_collect` |
| `atm_keypad` | 操作 ATM 键盘 | `atm_keypad` |
| `atm_take_cash` | 从 ATM 取出现金 | `atm_take_cash` |
| `post_letter` | 投信 | `post_letter` |
| `post_notice` | 张贴纸张 | `post_notice` |
| `read_notice` | 看公告 | `read_notice` |
| `fountain_drink` | 俯身使用饮水设施 | `fountain_drink` |
| `cafe_sit_drink` | 坐着拿杯喝一口并放回桌面 | `cafe_sit_drink` |
| `push_door` | 推门 | `push_door` |
| `pull_door` | 拉门 | `pull_door` |
| `hold_door` | 扶住门让人通过 | `hold_door` |
| `sweep_ground` | 扫地 | `sweep_ground` |
| `mop_ground` | 拖地 | `mop_ground` |
| `water_planter_hold` | 持水壶浇花 | `water_planter_hold` |
| `hang_laundry` | 晾挂衣物 | `hang_laundry` |
| `wipe_table` | 擦桌子 | 待补 |
| `phone_booth_call` | 拿起公用电话、通话并放回 | `phone_booth_call` |
| `parcel_terminal` | 操作取件柜并取出包裹 | `parcel_terminal` |
| `bike_scan_unlock` | 对自行车扫码 | `bike_scan_unlock` |
| `car_enter` | 开车门并坐进车内 | `car_enter` |
| `car_exit` | 从车内出来 | `car_exit` |
| `hail_taxi` | 招出租车 | `hail_taxi` |
| `board_bus` | 上公交车 | 待补 |
| `alight_bus` | 下公交车 | 待补 |

`phone_booth_call`、`parcel_terminal`、`car_enter` 暂保留整段素材对应，不把所有手部变化机械拆成行为。实际效果可以先于整段结束提交；只有目标已经达成后的正常余段才是可中断收尾，拿起听筒等局部效果不代表整件事情完成。整段对应不免除条件、结果和重入声明。现有素材 `buy_newspaper` 的源文字只描述拿报，本表底层语义采用 `take_newspaper`，与高层买报区分，素材不改名。

## 6. 对人动作与双方角色

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `talk_gesture` | 配合手势说话 | `talk_gesture`, `talk_excited`, `talk_shy` |
| `talk_accuse` | 指责对方；与普通交谈保留区别 | `talk_accuse` |
| `whisper` | 凑近低声说话 | `whisper` |
| `interrupt` | 插话 | `interrupt` |
| `handshake_offer` | 握手的发起方执行，包含伸手、握动、收手；不是仅伸手等回应 | `handshake_offer`；单方邀握需另有明确片段或待补对应 |
| `handshake_reply` | 握手的回应方执行，包含伸手、握动、收手 | `handshake_reply` |
| `distribute_flyer` | 递传单 | `distribute_flyer` |
| `receive_flyer` | 接传单 | `receive_flyer` |
| `interview_question` | 提问 | `interview_question` |
| `interview_answer` | 简短回答 | `interview_answer` |
| `interview_followup` | 追问 | `interview_followup` |
| `interview_listen` | 听对方描述 | `interview_listen` |
| `interview_describe` | 描述经过 | `interview_describe` |
| `interview_point` | 指向相关地点 | `interview_point` |
| `assist_elder_walk` | 搀扶另一人走 | `assist_elder_walk` |
| `elder_assisted_walk` | 被另一人搀扶着走 | `elder_assisted_walk` |
| `walk_child_hand_down` | 牵着较矮同伴走，成人一方 | `walk_child_hand_down` |
| `child_hold_hand_walk` | 被成人牵着走，儿童一方 | 待补；不把成人一方当成双方都已具备 |
| `walk_dog` | 人握牵引绳走；狗是另一参与者 | `walk_dog` |
| `block_way` | 挡住对方去路 | `block_way` |
| `grab_snatch` | 迅速伸手抓取并收回；不代表已抢到物品 | `grab_snatch` |
| `reach_after` | 向离去的人／物伸手 | `reach_after` |
| `help_up` | 把倒地的人扶起来，施助一方 | 待补 |
| `helped_up` | 被别人扶起来，受助一方 | 待补 |

给／接、提问／回答、施助／受助都保留双方动作，不用一个同名动作代替两人的状态。单人已有素材不证明双人配合已经可用。

## 7. 观看、下棋、活动设施

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `chess_move` | 移动棋子；方向、远近先合并 | `chess_move`, `chess_move_diagonal`, `chess_move_side`, `chess_move_far` |
| `chess_capture` | 吃子；与普通移子区别保留 | `chess_capture` |
| `chess_think` | 看棋盘思考 | `chess_think` |
| `chess_watch` | 看棋并向棋盘示意 | `chess_watch` |
| `take_back_piece` | 取回刚走的棋子 | `take_back_piece` |
| `slap_table` | 拍桌 | `slap_table` |
| `exercise` | 原地做开合跳；高层锻炼也可用别的动作 | `exercise` |
| `leg_stretch` | 脚搭高处压腿 | `leg_stretch` |
| `march_in_place` | 原地踏步 | `march_in_place` |
| `tai_chi` | 打太极 | `tai_chi` |
| `handstand` | 保持倒立 | `handstand` |
| `spin` | 原地转圈 | `spin` |
| `air_walker` | 使用漫步机 | `air_walker` |
| `waist_twister` | 使用扭腰器 | `waist_twister` |
| `pullup_hold` | 悬挂单杠 | `pullup_hold` |
| `pullup_raise` | 做一次引体向上 | `pullup_raise` |
| `swing_seated` | 坐着荡秋千 | `swing_seated` |
| `slide_seated` | 坐姿滑下滑梯 | `slide_seated` |
| `seesaw_seated` | 跷跷板一方 | `seesaw_seated` |
| `seesaw_partner` | 跷跷板另一方 | `seesaw_partner` |
| `push_bicycle` | 推自行车 | `push_bicycle` |
| `ride_bicycle` | 踩踏骑自行车 | `ride_bicycle` |
| `coast_bicycle` | 自行车滑行 | `coast_bicycle` |
| `ride_scooter` | 坐姿骑踏板摩托车；不是站姿滑板车 | `ride_scooter` |
| `push_cart` | 推购物车 | `push_cart` |
| `push_stroller` | 推婴儿车 | `push_stroller` |

## 8. 受惊、保护和失衡

| 底层动作 ID | 下半框文字／区别 | 已有对应素材 ID |
|---|---|---|
| `startle` | 受惊一缩 | `startle` |
| `recoil` | 畏缩躲闪 | `recoil` |
| `duck_cover` | 蹲下护头并保持；本轮不拆表演段 | `duck_cover`, `duck_cover_hold` |
| `crouch_check` | 蹲下察看并保持；本轮不拆表演段 | `crouch_check`, `crouch_check_hold` |
| `stumble` | 踉跄失衡 | `stumble` |
| `trip_fall` | 向前绊倒 | `trip_fall` |
| `fall_back` | 向后倒下 | `fall_back` |

实际撞倒／失衡先更新身体与支撑，再影响行为资格，不等一个高分候选赢了才发生。自主恢复与外部身体事实分开；不需要增加“恐惧值”等系统。

## 9. 已有整段素材的处理

| 已有素材 ID | 已知内容 | 本版处理 |
|---|---|---|
| `breakfast_buy` | 顾客付款并接早餐袋 | 保留为旧的整段对应；高层 `buy_stuff` 的早餐情形仍拆 `pay`、`receive_item` 等语义。不能把这段同时冒充每个单独动作已经有素材 |
| `breakfast_sell` | 摊主准备食物并递早餐袋 | 保留为旧的整段对应；准备／递出分别在高层服务流程中表达，不要求现在剪素材 |

这两段没有加入新的底层动作 ID。动作语义清单与现有素材可以暂时不是一对一；这里记录差异，文字模拟照常设计。准备早餐如需独立显示，采用下面的待补动作。

## 10. 为高层拆解补出的动作

| 底层动作 ID | 下半框文字 | 素材对应 |
|---|---|---|
| `prepare_payment_tool` | 按选择时已知的工具配置准备并保持，实际就绪只读实际持物；不等称重后的条款 | 待对应；完整 `wallet_takeout` 会收回，不能直接绑定为就绪 |
| `present_payment_tool` | 使用已就绪工具配合本次结账，不重复从口袋取出 | 待对应；现有 `pay` 含取钱放柜台，不能无条件接在准备后 |
| `confirm_checkout` | 卖方配合确认本次条款的演示结账 | 待对应；不冒充 `receive_item` 已与现有 `pay` 配对，不模拟现金交接帧 |
| `take_tool` | 从本人声明存放位置取工具到可用手位；已在手时不重取 | 待通用对应；供 use_tool 复用，实际持物与取得结果同一步写入 |
| `stow_item` | 把当前手持物收进声明的随身存放位置 | 待补通用对应；只在物品与存放位置条件成立时可用，不在取消时自动藏物 |
| `take_item` | 从台面等可及支撑面拿起物件到手；地面捡物仍用 `pick_up` | 待补通用对应；供服务交付前摊主取回放下的货等共用准备复用 |
| `prepare_food` | 在摊位准备食物 | 待补独立对应；`breakfast_sell` 含这部分，但未拆分 |
| `pack_goods` | 打包商品 | 待补 |
| `listen` | 面向对方听他说话 | 待补通用对应；`interview_listen` 保留为采访专用，`stand_idle` 只可表示站立 |
| `pet_dog` | 伸手抚摸狗 | 待补 |
| `play_guitar` | 弹吉他 | 待补；`hold_guitar` 只是持握 |

动物自身的行为与动作继续参考 [动物路线](../asset-production/animals/design_route_animal_motion.md)，本表先列文本框代表的人的动作。新增动物动作清单、球类打斗等素材生产不由这次 Markdown 拆解自动展开。

## 11. 素材覆盖边界

本表通过“已有对应”以及第 9 节的整段素材说明，收录了本次读取的运行索引中全部 239 个素材 ID。这个数字是名称去向核对，不是 239 个独立底层语义，也不是画面验收数量。

源库中额外的进入／退出／保持段不机械地全部变成新的行为种类。需要区分坐下和坐着时明确列出；同一语义的动画衔接加工仍属于播放端。后续加素材时，应先判断落到哪个已有动作语义，再决定是否新增底层动作。
## 文字系统登记的素材需求

仅登记确有行为会用到的缺口，不自动加入素材生产队列。坐姿需求不表示当前声明已允许坐姿。

| 动作 | 待补版本 | 用途与当前边界 |
|---|---|---|
| `adjust_clothes` | 坐姿 | 有具体原因时整理衣服；当前行为停用，动作仅声明站姿 |
| `scratch_head`、`rub_eye`、`check_watch` | 坐姿 | fidget 的坐姿小动作；当前这些动作仅声明站姿 |
| `phone_browse` | 原地站姿、坐姿 | 原地看手机；当前仅声明站姿，不能用 phone_walk 代替；坐姿待补后再启用对应姿势 |
| `read_book` | 坐姿 | 第三批收紧为 standing；坐着选中后共用起身，坐姿片段补好后才能扩允许范围 |
| `handshake_wait` | 单方伸手等待的站姿 hold，可随时收断 | 现有 `handshake_offer` 是整段握动；等待请求 clip 为空，只有双方就绪才共同执行 offer/reply |
| `pair_wait` | 持钱包／持商品等站立等待配合 hold | 空手条件绑定 stand_idle；持物版本明确未绑定，条件仍继承即将执行的动作；不把空手片段当持物版本 |
| `prepare_payment_tool`、`take_tool(wallet)` | 取出钱包并保持在手、支付就绪的站姿对应 | 文字复用通用 take_tool；就绪只读实际持物；不绑定会收回钱包的完整 wallet_takeout |
| `present_payment_tool`、`confirm_checkout` | 买方展示已在手的支付工具、卖方空手确认条款的配合片段 | 两者 clip 为空；不绑定 pay/receive_item，不虚构纸币交接帧 |
| `take_item` | 从可及台面取到空手的站姿 once | 已实现物件从指定台面到手的文字效果；不得用地面 pick_up 代替 |
| `pack_goods` | 包装的独立片段及完整流程 | 本批商品配置明确 TODO；到此结束本次服务，不付款、不交货 |
| `give_item`／`receive_item` | 摊位跨台递接的适配与接触时刻核对 | 当前引用 give_item.partner 的独立递接站位，和 market_stall 的 customer 标记不同；未证明跨柜台接触或两个片段的交接帧已同步，接播放前必须核对，不能仅凭文字共同提交宣称素材已可直接连播 |

## 12. Third-batch executable semantics and binding corrections

The inventory above retains source correspondences. The current allowed posture/hand contract is in `table.json`; every declaration and source reference is audited in [catalog-audit-3.md](catalog-audit-3.md) and [asset-audit-3.json](asset-audit-3.json). A known source is not an unconditional binding. Text-only actions can have an explicit missing clip; they must not silently play a different source.

| Action ID | Text semantics / actual-state requirement | Binding or material need |
|---|---|---|
| `leave` | Walk to an actual exit, then mark the person gone | Alias of walk; empty-hand source only, held-object gait missing |
| `queue_wait` | Wait inside the service queue | Empty hands: stand_idle; held-object variants missing |
| `service_wait` | Wait for the current service work | Empty hands: stand_idle; held-object variants missing |
| `wait_standing` | Stand at a declared bus-wait place | Empty hands: stand_idle; held-object variants missing; no bus boarding is invented |
| `lie_down` | Standing to lying; commit actual ground posture once | Missing transition; lie_ground_hold is only the hold |
| `seat_lower` | Sit at the declared step/chess/cafe marker; commit that support once | Missing marker-adapted transition; bench sit_down is not reused at another height/layout |
| `seat_rise` | Rise from that same non-bench seat | Missing marker-adapted transition; bench stand_up is not reused |
| `give_held` | Give the scene-specified item actually held; receiver has an empty hand | Generic object grip/contact variant missing; ownership changes only at shared commit |
| `walk_open_book` | Carry an open book to the current destination | Missing; existing walk_hold_front carries a closed book, represented separately as closed_book |

Additional material requests and restrictions, synchronized with batch 3:

| Action / family | Required version or correction | Evidence / current handling |
|---|---|---|
| `sit_bench`, `slouch_bench` | Held-object versions if later wanted | Current source hands rest on thighs/seat; declarations now require empty hands |
| `stand_idle`, `walk`, `leave`, waits, `look_up`, `read_notice`, bench transitions | Compatible held-object variants | `bindings` allows the existing source only with empty hands; held cases return null instead of playing it |
| `stow_item`, `take_tool`, `put_down` | Standing, seat and ground preparation clips | Defined text transfers work in those actual poses; all remain unbound |
| `get_up_ground` | Self-rise from ground sitting/lying, with empty hands | Never binds chair stand_up; cannot run when can_rise is false |
| `sit_ground_hold` | Plain seated-on-ground hold | sit_ground is an entry transition, not this hold |
| `sit_sideways` | Genuine sideways sitting | Same-name meta describes reclining on a bench; clip explicitly null |
| `walk_umbrella` | Genuine open-umbrella gait | Same-name meta describes a phone beside the ear; clip explicitly null despite umbrella prop setup |
| `parcel_terminal` | Actual compartment retrieval and parcel held at completion | Current clip-setup pose only touches the screen; clip explicitly null for the collect semantic |
| `atm_take_cash` | Collect-to-hand fragment, or a future process with a matching declared storage output | Existing pose moves cash to pocket; the finite text collect-to-hand action is unbound |
| `pick_up` | Ground collection adapted to the selected item shape/grip | Existing source is one small fallen fruit; generic collection is unbound |
| `interview_listen` | Listening with microphone at the short-answer layout | Available partner setup uses interview_describe at 1.2 m; question/answer uses 0.9 m. Current short-answer encounter leaves listening unbound |
| `listen` | Ordinary standing listener | Missing; interview_listen requires a microphone and is not a generic substitute |
| `child_hold_hand_walk` | Child-side hand-holding gait and pair placement | Missing; adult-side walk_child_hand_down is retained only for the adult |
| `walk_dog` | Leash/dog coupling and stopped holding behavior | Human gait source exists; the independent text animal adapter does not validate animal playback or leash geometry |
| `play_guitar` | Actual playing with the held guitar | Missing; hold_guitar is not a playing clip |
| `wipe_table` | Standing wiping with the declared cloth | Missing |
| `hang_laundry` | Held garment released onto the rail | Existing source is used as a once deposit, not a hold. Cloth attachment/contact still needs playback integration |
| `sweep_ground`, `mop_ground` | Two-hand prop contact confirmation | Source uses both hands; setup attaches prop to the right hand. One object is represented, but attachment alone does not establish the second contact |

Batch 4 defined shared-support help, palm/hanging support, vehicle/cart driving and mechanical support in the independent text executor. Its flyer-stack exclusion is superseded by batch5 below. No motion production queue or playback code is changed by these inventory updates.

The manufactured fall uses the face-up `lying` state and references `fall_back` as an external-body source fact. Forward `trip_fall` ends prone and is not paired with the supine `lie_ground_hold`; prone-state recovery remains outside this implementation. The scene records the physical fact immediately and does not play either fall clip.

## Batch 4 support and connection contracts / material requests

Every action, including existing declarations, is preserved with source text, setup,
posture/hand constraints and exact declaration location in [asset-audit-4.json](asset-audit-4.json).
`supported_seated`, `hanging` and `inverted` are distinct support poses. They never
give a standing or ordinary chair clip additional permission. All support-contact
actions require empty hands: gripping an external handle is a device contact,
not an invented item in the hand inventory.

| Action / family | Defined text contract and required material |
|---|---|
| `support_prepare` | Standing, empty-hand finite preparation at a real device port. Unbound; shared seat rise/stow/walk occurs first. |
| `support_latch` | Unbound attachment/entry along the declared support path; allowed across the profile's actual poses. Need mounting, passenger boarding, suspension grip entry and palm entry variants. The all-pose declaration is text semantics only. |
| `support_release` | Unbound safe unloading from actual position. Need bicycle/scooter dismount, passenger exit, swing settling/exit, slide-bottom exit, bar lowering, palm lowering and shared-weight release variants. |
| `support_wait` | Unbound waiting at the actual entry posture. Missing clips do not imply a generic standing clip is legal everywhere. |
| `open_fixture` | Unbound standing, empty-hand manual operation at a route obstruction. Need actual door-side push/pull contact adapted to its provider markers; existing push_door/pull_door are not bound at an arbitrary text gate point. A live crosser alone does not open a manual door. |
| `car_ride` | Unbound seated passenger hold. Existing car_enter/car_exit source text is specifically the low **driver** seat; passenger boarding/exit and seated ride hold are missing. |
| `push_cart`, `push_stroller` | Existing standing two-hand handle gaits; empty hands. Attachment/release and turns remain separate requirements. |
| `pull_suitcase` | Unbound: source meta describes carrying a heavy shopping bag in the right hand, not pulling a case. Need actual wheeled-case handle gait. |
| `ride_bicycle`, `ride_scooter` | Existing seated handlebar actions; empty hands. Scooter is a seated motor scooter, not a standing kick scooter. Need entry/exit and turning variants. |
| `swing_seated`, `slide_seated`, `seesaw_seated`, `seesaw_partner` | Existing seated mechanical-support actions, both hands available for the fixture. Need support-motion/contact synchronization and transitions; the text track is not a playback result. |
| `pullup_raise`, `handstand` | Existing hanging / inverted holds respectively, empty hands. Their sources do not include safe entry/interrupted return to ground. |
| `assist_elder_walk`, `elder_assisted_walk` | Existing upright paired gaits; exact source partner offset is retained. Need stopped shared support, attachment and safe release/ground-lowering transitions. |
| `help_up`, `helped_up` | Both missing; unbound helper and **lying** recipient transfer. |
| `helped_up_ground_seated` | Missing ground-seated recipient variant; same shared weight-transfer controller, one behavior row. Prone lifting remains undefined because prone body state is outside the existing fall contract. |
| `hold_door` | Existing standing empty-hand contact with an already open door; opening is a separate internal portal operation. Need shared text-world door integration and stopped/released contact. |
| `phone_call`, `walk_phone_call` | Existing **standing** / walking right-hand phone sources, tool=phone. No seated phone permission. Connection lifetime is independent of either body fragment. |

Missing material does not prevent these defined text behaviors. This register does
not authorize creating clips, altering clip-setup or changing playback code.

## Batch 5 current tasks, purchases and two-hand supply

Six behavior rows are enabled; all90 prior enabled declarations and135 prior
actions stay unchanged. These12 additions are ordinary action/preparation
declarations, not12 scored behaviors. Standing remains standing. Material/state
audit for every declaration: [asset-audit-5.json](asset-audit-5.json).

| Action | Posture / hand contract | Material and missing work |
|---|---|---|
| `walk_loaded` | Standing movement; independent left/right real objects | Unbound. Need a two-object carrying gait; empty-hand walk is not substituted. |
| `pet_contact` | Standing, both hands empty; real animal permission and stopped anchor | Missing humanoid dog-contact clip. Dog remains an animal adapter, not a humanoid action. |
| `wait_current_person` | Standing; {"entry": "empty", "result": {}} | Standing empty-hand stand_idle, alternating with existing standing check_watch through the current-task action pool. Arrival remains an actual subject event; nervous looking/pace are optional situation-specific materials, not invented anxiety. |
| `select_product` | Standing; left available, right may hold payment phone | Unbound selection at the declared provider. One actual stock item is selected; no purchase or output yet. Need matching held-phone selection variant. |
| `pay_terminal` | Standing, right-hand phone; left empty | Missing phone-terminal payment. The cash-on-counter `pay` clip has different semantics. Finite scene authorization is debited once; no complete economy is simulated. |
| `await_stock_output` | Standing wait; current held state | Unbound provider response. The paid provider advances independently of buyer body/purpose, moving its EXISTING item to output once. The body waits for actual output. Machine availability/capacity are rechecked; no stock is created. |
| `take_newspaper` | Standing; {"entry": "empty", "result": {"kind": "newspaper", "hand": "right"}} | Bound buy_newspaper: standing empty-hand entry, one real paid folded newspaper becomes right-held at assigned native right-hand speed minimum f32. Whole native 70-frame source retained; normal interruptible tail follows the committed pickup. Checkout is separate. |
| `vending_collect` | Standing; {"entry": "empty", "result": {"kind": "cup", "hand": "right"}} | Bound existing lidded-coffee-CUP retrieval: standing empty entry, actual transaction product cup, right pickup at assigned low forward reversal f39. Added held_coffee_cup/right result setup; provider output already exists before collecting. Whole 70-frame source retained. |
| `draw_container_item` | Standing; {"right": "paper_stack", "left": "empty"} | Missing finite-container draw: RIGHT stack/LEFT empty. Native pictures show LEFT extensions while RIGHT stays beside hip; no visible hand-to-stack draw. Existing whole source is not borrowed for a separate preparation. |
| `offer_sheet` | Standing; {"right": "paper_stack", "left": "paper"} | Unbound RIGHT-stack/LEFT-sheet offer. Native distribute_flyer makes three distinct extensions (f18,83,111–117), not one clear draw/offer/retract. Source text hand claim is wrong; existing RIGHT-stack setup already matches passive hand and is unchanged. A single matched offer source remains needed. |
| `accept_sheet` | Standing; {"entry": "empty", "result": {"kind": "paper", "hand": "right"}} | Bound existing receive_flyer: standing empty entry, RIGHT hand first forward low-speed pause at assigned f26, then withdraws. Added right held_flyer result attachment. Physical pair contact remains unverified while giver material is missing; this binding identifies the usable receiving-side source. |
| `hold_supply` | Standing; {"right": "paper_stack", "left": "any"} | Missing standing RIGHT-stack/LEFT-optional holding wait. Empty-hand idle/wait material does not cover this state. |

One `distribute_flyer` row owns prepare/draw/offer and one `receive_flyer` row
owns acceptance. A refused or cut offer leaves the drawn sheet and stack in their
actual hands. Re-entry can use that same sheet; transfer consumes one contained
sheet, not a minted object. Any required animation fragments are material work
inside this purpose, not extra lottery rows. Physical paired contact remains unverified; text tests establish actual finite inventory/permission transitions and assigned material-event timing.
