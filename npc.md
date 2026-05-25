# NPC 行为状态机规格文档

## 状态总览
（默认所有动作（如果不特殊提起）都是向右，
### 移动类（连贯循环）
| 状态 | 描述 | 火柴人表现 |
|------|------|-----------|
| walk | 普通步行 | 四肢小幅交替摆动，速度慢 |
| run | 跑步 | 四肢大幅摆动，身体前倾，速度快 |
| jog | 慢跑 | 小幅度摆动，速度慢 |
| bike | 骑车 | 骑在自行车上，腿部做蹬踏动作 |
| mobile| 骑电动车| 骑在电动车上，脚部不动|
| get_up | 起身 | 从平躺起来，用于躺下和摔倒|

### 静止类（仅播放一次，结束后应当维持最后一帧或仅json）
一帧）
| 状态 | 描述 | 火柴人表现 |
|------|------|-----------|
| single | 站立 | 直立不动，双手自然垂落，（正面） |
| cross_arm | 站立双臂环抱胸前 | 直立不动，双手环抱（正面） |
| sit_bench | 坐在长椅上 | 臀部锚点对齐长椅seat锚点，腿自然弯曲，双手放在大腿上 |
| sit_ground | 坐在地上 | 正面，盘腿坐在地上 |
| squat | 蹲着 | 膝盖弯曲，重心下移（正面） |
| lean_wall | 靠墙站 | 身体倾斜，背部靠建筑外墙，仅在建筑附近触发 |
| lie_bench | 躺在长椅上 | 身体水平，头在长椅一端 |
| lie_ground | 躺在地上 | 身体水平贴地 |

### 日常动作类（叠加在静止/移动状态之上，代码实现，仅修改部分肢体）
| 状态 | 描述 | 可叠加的基础状态 |
|------|------|-----------------|
| phone_call | 打电话 | stand, walk, sit_bench, lean_wall |
| phone_look | 看手机 | stand, walk, sit_bench, sit_ground, squat, lean_wall |
| hold_bag | 拿包/袋子 | walk, run, stand |
| smoke | 抽烟 | stand, lean_wall, sit_bench |
| walk_dog | 遛狗 | walk（附带狗实体，牵绳连接hand锚点到狗） |
| take_photo | 拍照 | stand（手举到面前） |

### 社交类（需要2个NPC配合，代码实现，需要同步）
| 状态 | 描述 | 触发条件 |
|------|------|---------|
| talk | 两人对话 | 两NPC面对面，距离<阈值，双方都是stand状态 |
| handshake | 握手 | 从talk状态触发，短暂动作后回到talk或分开 |
| push | 推搡 | 从talk状态触发，概率极低，一方对另一方施力 |
| point_at | 指向对方 | 从talk状态触发，一人手臂伸直指向另一人 |
| give_item | 递东西 | 从talk状态触发，一人hand锚点移向另一人hand锚点 |

### 特殊类
| 状态 | 描述 | 触发条件 |
|------|------|---------|
| fall | 摔倒 | （向左）从run/cycle随机触发，进入lie_ground（最后一帧） |
| bend_pick | 弯腰捡东西 | 从walk/stand随机触发，短暂动作 |
| hold_sign | 举牌子 | 特殊NPC专有，stand+双手举起牌子道具 |
| wall_write | 往墙上写/贴 | 特殊NPC专有，面向建筑墙面，hand锚点在墙面高处 |

### 场景动作
| 状态 | 描述 | 触发条件 |
|--|--|--|
| chess | 下棋（单人向右） | 无 |
| chess_onlooker | 观众（不连贯）| 第一帧为站立，最后一帧为（向右）俯身看（棋盘），播放这个动作，然后定格到最后一帧，过几秒npc走几步（短距离），然后再次播放 |

---

## 状态转换规则

### 移动类内部转换

```
walk → run
  条件：随机触发（低概率）/ 被push后 / 镜头反应（低稳定度下逃离取景框）
  表现：步幅和频率逐渐加大，身体前倾过渡

run → walk
  条件：持续run一段时间后自然减速 / 到达目的地附近
  表现：步幅逐渐缩小

walk → cycle
  条件：NPC路径经过停放的自行车道具 + 该NPC有cyclist属性
  表现：走到车旁 → 短暂stand → 上车

cycle → walk
  条件：到达目的地 / 遇到人群密集区
  表现：减速 → 下车 → 自行车变为停放道具
```

### 移动→静止转换

```
walk → stand
  条件：到达兴趣点（建筑门口/道具旁/另一NPC附近）/ 随机停下
  持续：3~15秒后重新选择行为

walk → sit_bench
  条件：路径经过长椅 + 随机触发
  持续：10~30秒

walk → squat
  条件：随机触发（低概率）
  表现：在当前位置蹲下
  持续：5~15秒

stand → lean_wall
  条件：当前位置靠近建筑外墙（距离<阈值）
  表现：身体侧向墙面倾斜

stand → sit_ground
  条件：随机触发（极低概率）/ 附近无长椅但NPC需要休息
  表现：原地坐下

stand → lie_bench
  条件：当前sit_bench状态持续足够久 + 随机触发（低概率）
  关联标签：homeless, resting, tired（增加新闻歧义性）

walk → lie_ground
  条件：仅从fall转换而来，不会直接从walk转到lie_ground
  
fall → lie_ground
  条件：fall动画播完后直接进入
  持续：5~10秒后尝试stand
  关联标签：injured, unconscious, drunk（高歧义）
```

### 静止→移动转换

```
stand/sit_bench/sit_ground/squat/lean_wall → walk
  条件：静止状态持续超过最大时长 / 被社交事件打断 / 镜头反应触发
  
lie_bench → sit_bench → stand → walk
  条件：依次过渡，不跳级

lie_ground → squat → stand → walk
  条件：依次过渡，不跳级（表现为慢慢爬起来）
```

### 日常动作叠加/卸载

```
任意可叠加基础状态 → +phone_call
  条件：随机触发
  持续：10~20秒
  结束后：回到纯基础状态

任意可叠加基础状态 → +phone_look
  条件：随机触发（概率高于phone_call）
  持续：5~25秒
  特殊：phone_look状态下NPC对取景框的感知范围缩小（在看手机，没注意到被拍）

任意可叠加基础状态 → +smoke
  条件：仅限有smoker属性的NPC
  持续：15~30秒
  位置偏好：lean_wall时概率最高

walk → +walk_dog
  条件：NPC生成时绑定，全程携带
  特殊：狗的行为半独立——会拉扯牵绳、嗅地面、对其他NPC吠叫
```

### 社交状态转换

```
stand + stand（两NPC距离<阈值且面对面）→ talk
  条件：双方都没有处于社交状态
  持续：10~30秒
  
talk → handshake
  条件：talk持续超过5秒后随机触发（中等概率）
  持续：2秒动画
  结束后：回到talk或分开（各自walk）

talk → push
  条件：talk持续超过10秒后随机触发（极低概率）
  持续：1秒动画
  结束后：被推的NPC进入stumble（踉跄）→ 可能fall → lie_ground
         推人的NPC可能run离开或继续stand
  关联标签：conflict, violence, assault（高新闻价值）

talk → point_at
  条件：talk持续超过5秒后随机触发（低概率）
  持续：3秒
  关联标签：argument, accusation（中等歧义——可以是指路，也可以是指责）

talk → give_item
  条件：talk持续超过5秒后随机触发（低概率）
  持续：3秒动画
  关联标签：transaction, exchange, bribe（高歧义——可以是还钱，也可以是行贿）
```

### 特殊状态触发

```
run → fall
  条件：随机（极低概率）/ run状态经过障碍物
  结束后：lie_ground → 慢慢恢复

cycle → fall
  条件：随机（极低概率）
  结束后：lie_ground + 自行车倒在旁边
  关联标签：accident, injury, cyclist

stand（靠近建筑墙面）→ wall_write
  条件：仅限特殊NPC类型（activist标签）
  持续：5~10秒
  结束后：墙面出现涂鸦/海报道具
  关联标签：vandalism, protest, graffiti, activism
```


---

## 镜头反应系统（叠加在所有状态之上）

NPC在取景框内时，根据社会稳定度不同，叠加以下反应：

### 低稳定度（0~30%）

```
感知到取景框 → 触发回避行为：
  stand → 转身背对镜头 / 用手遮脸（hand锚点移到head附近）
  walk → 加速 + 改变方向远离取景框
  sit → 低头看地面 / 用手挡脸
  talk → 中断对话，双方分开walk离开
  所有动作 → 表情变为不悦/警惕

感知范围：取景框面积 × 1.5（NPC在框外就开始回避）
感知延迟：0.5~1.5秒（不是瞬间反应）
```

### 中稳定度（30~70%）

```
感知到取景框 → 轻微反应：
  大部分NPC无反应，继续当前行为
  少数NPC短暂看一眼镜头方向然后继续
  社交状态不受影响

感知范围：取景框面积 × 1.0
这是最适合拍摄的区间——NPC行为自然，不回避也不迎合
```

### 高稳定度（70~100%）

```
感知到取景框 → 迎合行为：
  stand → 面向镜头 + 挥手 / 比V
  walk → 减速甚至停下来面对镜头
  talk → 双方都转向镜头微笑
  所有动作 → 表情变为微笑

感知范围：取景框面积 × 1.2
问题：拍出来的照片都是摆拍感，真实性评分可能受影响
```


---

## 标签生成规则

每个NPC在被取景框捕获时，系统根据以下信息生成标签集合：

```
标签来源 = NPC自身属性标签
         + 当前行为状态标签
         + 叠加动作标签
         + 空间关系标签（near:building_type, on:crosswalk等）
         + 社交对象标签（如果有的话）
         + 镜头反应标签（avoiding_camera, posing等）
```

示例：
```
一个有businessman属性的NPC
当前状态：stand + phone_call
位置：银行门口
稳定度：低 → 正在遮脸

生成标签集合：
[businessman, standing, phone_call, near:bank, near:finance,
 avoiding_camera, suspicious, nervous]

可能的新闻解读范围：
  - 如实："商务人士在银行门口打电话" → 真实性高，吸引力低
  - 歪曲："银行内部人士神秘通话，刻意回避媒体" → 真实性低，吸引力高
```


---

## 后续可扩展的状态（暂不实现）

- 吃东西 / 喝水
- 演奏乐器（街头艺人）
- 排队（一列NPC）
- 打伞（天气系统）
- 搬运重物
- 被警察拦住
- 撑拐杖 / 坐轮椅

---

## 实现优先级建议

第一批（跑通流程）：walk, run, stand, sit_bench, fall, lie_ground, talk, phone_look
第二批（丰富场景）：cycle, squat, lean_wall, phone_call, smoke, push, point_at
第三批（增加深度）：sit_ground, lie_bench, give_item, hold_sign, wall_write, walk_dog, bend_pick, handshake, take_photo