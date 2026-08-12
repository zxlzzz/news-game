# 动作供给方案 v1

状态：草案，待拷打
基线：`claude/velocity-unification-v1-946h9l` @ `a99f16e`
作者：Claude（架构分析），最终决策权在 Hsinlung

---

## 0. 这份文档解决什么

不解决画面好不好看，不解决核心循环闭不闭合。只解决一件事：

> 目标是几百个动作，当前单个动作的成本是半小时起、且会反复微调。这个量级手工产不出来。

以及由它衍生的一个结构问题：**当前 clip 格式能不能承载"几百个动作"这个目标**。

---

## 1. 已验证的事实

以下全部来自本次真实读码，不是记忆。

### 1.1 骨架

`assets/skeleton.json` 定义三套骨架：`human` / `child` / `dog`。human 的内容：

- 11 个关节：`body neck head l_elbow r_elbow l_hand r_hand l_knee r_knee l_foot r_foot`
- 拓扑：手臂挂在 `neck`，腿挂在 `body`。**没有肩、没有髋、没有脚趾**
- `joints` 字段已声明每根骨头的 `parent` + `len`（neck 50 / head 25 / elbow 29.8 / hand 25 / knee 35.2 / foot 35.1）
- `unit_height: 144`、`headRadius: 12`、`scale: 0.85`
- `defaultPose` 是一套绝对坐标的静止姿势

**结论：一套带父子关系和固定骨长的骨架已经存在。它唯一缺的是第三个轴。**

### 1.2 clip 格式

```json
{ "facing": "front", "groundTravel": 96,
  "keyframes": [ { "l_elbow": [7,4], "r_elbow": [-7,4], "dur": 0.1 } ] }
```

- 每个关节是 `[dx, dy]`，**相对 `defaultPose` 的 delta**，不是绝对坐标
- 省略的关节 = 零 delta
- `dur` 逐帧
- y 负值向上，`y=0` = 地面接触线（CLAUDE.md 铁律）
- 顶层可选：`facing` / `groundTravel` / `skeleton` / `globalBend` / `participants`

overlay clip 额外有 `activeJoints`（只覆盖列出的关节），多人 clip 用 `participants: [{role:'a'},{role:'b'}]`，帧内按 role 分组。

### 1.3 库存

manifest 共 67 条。cycle 23 / transition 8 / overlay 33 / variant.older 3。
`facing` 只有两种取值：`front`（12 条）和缺省（57 条，即侧视）。

**没有背面。** 左右靠 `StickRenderer` 里 `joint[0] * scale * dir` 镜像。
所以现状是"侧视镜像 + 正面"共三个朝向，不是四个。

### 1.4 已存在但零消费

- `globalBend`：StickRenderer 支持骨骼弯曲（法向偏移 + 二次贝塞尔），**零个 clip 使用**
- `new_assets/stumble.json`：JSON 解析失败（未注册，暂不处理）

### 1.5 门对 clip 的硬约束

任何新产 clip 必须同时满足：

| 来源 | 约束 |
|---|---|
| `validate.mjs:282` | 逐帧骨长偏差 ≤ `BONE_LEN_TOL` |
| CLAUDE.md / ClipLibrary | cycle clip 全帧全关节 `abs_y ≤ 0`（`MOUNTED_CLIPS` 白名单豁免） |
| check-invariants Rule 2 | clip JSON 不得含 `kind` |
| check-invariants Rule 4 | speedK>0 的 clip `|meanX| ≤ 4` |
| check-invariants Rule 16 | `groundTravel` 自动推导时左右腿贡献偏差 ≤ 20% |

**骨长被真的校验**这一条最关键：它意味着任何外部动作数据进来都必须先做骨长归一化，不能直接投影了事。

---

## 2. 供给方案：三层分工

动作不是一类东西。按"能不能外购"切：

| 层 | 例子 | 供给方式 | 量级 |
|---|---|---|---|
| **环境动作** | 走、站、等、坐、蹲、刷手机、遛狗、撑伞 | 动捕库 / 自拍动捕 | 几十~几百，便宜 |
| **接触姿势** | 推、扶、搂肩、递物、下棋对坐 | 手工摆（stick-puppet） | 十几个，贵但值 |
| **道具对接** | 开门、按按钮、抓栏杆 | 运行时 IK | 不是 clip |

三层的理由：

- 环境动作自由度高但**没有语义要求**，只要"看着像那么回事"，正是动捕擅长的。
- 接触姿势是你机制的承重部分（推 vs 扶的歧义对），而且要求两副骨架在一致相对坐标里。双人动捕数据极稀缺（Inter-X / Hi4D 都是研究数据集）。**这一层动捕帮不上忙，stick-puppet 不会死，它换岗。**
- 道具对接根本不是动作问题。手必须真的在门把上，而门把在 scene.json 里。烘死的 clip 里手的位置是写死的像素，永远对不上。

---

## 3. 核心分叉：烘焙 vs 三维骨架

这是本文档要你拍板的唯一一件事。

### 方案 A —— 烘焙（骨架保持二维）

动捕 → 重定向到 11 关节 → 骨长归一化 → **投影压成二维** → 写成现有 delta 格式。

- 运行时零改动。StickRenderer、ClipLibrary、门、stick-puppet 全部不动
- 每个朝向要单独烘一份
- 拿不到：运行时 IK、连续朝向、遮挡关系

### 方案 B —— 骨架升三维

`defaultPose` 每个关节加一个 z；clip 存 `[dx,dy,dz]`；**投影发生在绘制时**。

关键在于代价比想象中低，因为：

1. **StickRenderer 已经在做投影了**，已经 import 了 `toScreen`/`toScreenLength`
2. `BONES` 连线表不变，还是那 10 根
3. delta 格式形状不变，只多一个数
4. `validate.mjs` 的骨长校验从 `hypot(dx,dy)` 改成三维，一行
5. **现有 67 个 clip 全部是合法的三维 clip（z 恒为 0）。向后兼容，不需要转换任何东西**

第 5 条是重点：**这不是重写，是扩展。**旧 clip 继续当扁平 clip 用，新 clip 才带 z。

### B 真正要动的东西

**投影铁律要改。** CLAUDE.md 现在写：人是竖直广告牌，关节偏移是"平长度"，只过 `toScreenLength`，不参与 shear/tilt。

加了 z 之后必须变成：

```
joint x（横向） → screen x
joint y（高度） → screen y，不压缩          ← 这条不变，是 O 系列的核心
joint z（纵深） → screen x += z*SHEAR
                 screen y += z*sin(TILT)   ← 新增
```

这跟 `Projection.js` 的规则是同一条，只是现在也施加到关节偏移的 z 上，而不只是脚下那个地面点。**逻辑上更统一，不是例外。**

其余连带：

- `dir` 镜像 → 旋转。要区分哪些 clip 是广告牌（继续镜像）、哪些是三维（旋转）。建议顶层加 `billboard: true`，缺省即三维
- `groundTravel` 自动推导的贴地判据要连带看 z
- Rule 4 的 `|meanX| ≤ 4` 可能需要 z 的对应版本
- **stick-puppet 要长出 z 轴**。这是 B 最难受的一处：在二维界面里摆三维姿势不好受。缓解办法是先用动捕出近似姿势再手调，而不是从零摆
- `dog` 骨架是侧视四足，建议先标 `billboard: true` 不动它

### B 换来什么

- **朝向连续**，不是三档。背面白送（现在根本没有）
- **运行时 IK**：两根骨头的 IK 是三十行数学。开门、按按钮、抓栏杆从"不可能"变成"参数"
- **遮挡可解**：每根骨线段有 z，按 z 排序 + 前段描背景色边。你在工作台上看到的"手臂交叠分不清前后"在这里免费解决，二维烘死的 clip 解决不了
- **体型参数化**：`child` 骨架现在是独立一套；三维下高矮胖瘦是骨长参数。顺带能解决 `Npc.js:360` 颜色只是 y 的函数、四个 profile 视觉上完全相同的老问题
- `globalBend` 那个零消费的功能有了真实用途（三维下骨骼弯曲才有意义）

### 关键：A 和 B 共用同一条管线

```
动捕源 → 11 关节重定向 → 骨长归一化 → ┬→ 投影丢 z → 二维 delta   (A)
                                      └→ 保留 z   → 三维 delta   (B)
```

**只有最后一步不同。**所以先建管线不等于选边，可以把决策推迟到管线跑通、真看到东西之后。

**这是本文档的实际建议：先做管线，A/B 延后。**

---

## 4. 管线要做的事

### 4.1 重定向（源骨架 → 11 关节）

Mixamo / CMU / 自拍动捕的骨架都是 Mixamo 那种超集（Hips/Spine/Neck/Head/Arm/ForeArm/Hand/UpLeg/Leg/Foot）。映射到你的 11 关节是**挑选，不是求解**：

| 你的关节 | 源 |
|---|---|
| `body` | Hips |
| `neck` | Neck |
| `head` | Head，圆心沿 neck→head 方向再顶一个 headRadius |
| `l_elbow` / `r_elbow` | LeftForeArm / RightForeArm |
| `l_hand` / `r_hand` | LeftHand / RightHand |
| `l_knee` / `r_knee` | LeftLeg / RightLeg |
| `l_foot` / `r_foot` | LeftFoot / RightFoot |

注意：**源里的锁骨和肩关节整个丢弃**。你的手臂直接挂 neck。这也是工作台上"多一节手臂"的成因——我当时按源的拓扑画了三段。

### 4.2 骨长归一化（不可跳过）

对每条 `joints` 里声明的骨头：取源的**方向**，用 `skeleton.json` 的**长度**，从 `body` 沿父子链向外重建。
这是为了过 `validate.mjs` 的骨长门，也是保证不同来源的动作放在一起时体型一致。

### 4.3 落地归零

平移整套姿势，使全帧最低点 `y = 0`。cycle clip 必须满足 `abs_y ≤ 0`。
`scripts/rezero-clips.py` 已存在，可复用其判据。

### 4.4 写成 delta

`delta[joint] = 归一化后的绝对坐标 − defaultPose[joint]`。
零 delta 的关节可省略（overlay 用 `activeJoints`）。

### 4.5 `groundTravel`

优先让自动推导跑通（Rule 16 要求左右腿贡献偏差 ≤20%）；推不出来的显式声明。

---

## 5. 动捕来源

| 来源 | 成本 | 覆盖 | 深度 |
|---|---|---|---|
| Mixamo | 免费，约 2500 条 | 偏战斗/舞蹈，日常行为待实测 | 真三维 |
| CMU Mocap | 免费，2061 条序列 | 日常活动较多，需清理抖动 | 真三维 |
| Rokoko Vision | 单摄像头免费 | 自定义 | **估计的**，不是测量的 |
| FreeMoCap | 免费开源，多摄像头 | 自定义 | 真三维 |
| 自有深度相机（灵触随行） | 已有，待规划 | 自定义 | 真三维 |

**深度那一列是选型的唯一判据。**方案 B 的全部红利都建立在 z 是真的之上。单摄像头方案（MediaPipe 类）输出的是 2.5D——真二维加估计的相对深度，转 90° 会露馅。

自拍动捕的一条重要有利因素：目标是 11 关节火柴人，没有手指、表情、脚掌翻滚、蒙皮形变。**动捕质量要求跟渲染精度挂钩，而你在最底层。**别人要花大力气清理的东西，你平滑一下就没了。

---

## 6. 阶段划分

| 阶段 | 内容 | 门 | 出口判据 |
|---|---|---|---|
| M-0 | 管线原型：一个 Mixamo FBX → 一个合法 clip JSON，六门全绿 | 全部 | 游戏里能播，肉眼过得去 |
| M-1 | 批量：十条日常动作跑一遍，量成本 | 全部 | 单条成本 < 5 分钟 |
| M-2 | **决策点：A 还是 B** | — | 基于 M-1 的实物 |
| M-3a（选 A） | 批量烘焙，三个朝向各一份 | 全部 | — |
| M-3b（选 B） | skeleton.json 加 z / StickRenderer 投影改造 / validate 三维骨长 / stick-puppet 加 z 轴 | 全部 + 旧 clip 回归 | 67 个旧 clip 表现不变 |
| M-4 | 接触姿势仍走 stick-puppet；道具对接上 IK | — | 开门时手真的在门把上 |

M-0 和 M-1 对 A/B 都是必需的，先做这两个不承担任何选边风险。

---

## 7. 风险与止损

| 风险 | 触发条件 | 止损 |
|---|---|---|
| 动捕库没有平庸社会行为 | Mixamo 搜 sitting/waiting/talking 凑不出十几个能用的 | 整个方案作废，回手工 |
| 骨长归一化后姿势失真 | 归一化前后目视差异大到读不懂 | 考虑放宽 `BONE_LEN_TOL`，或改存角度 |
| 二维火柴人前后遮挡不可读 | 手臂交叠帧分不清前后 | **这条只有 B 能救**，等于强制选 B |
| stick-puppet 三维化不可用 | 摆一个接触姿势比现在还慢 | 接触姿势降级为"动捕近似 + 二维微调"，放弃精确三维摆位 |
| 单摄像头 z 不可用 | 转 90° 后姿势畸变 | 只用库里的真三维数据，自拍留给灵触随行的深度相机 |

**最便宜的止损点是 M-0 之前**：Mixamo 上搜十个词，五分钟，不写一行代码。

---

## 8. 待你决定 / 我不知道的

1. **背面要不要？**现在完全没有背面 clip。A 里要单独烘，B 里免费。这个需求存在与否直接加权 A/B。
2. **`dog` 和 `child` 怎么办？**建议 B 阶段先标 `billboard: true` 不动，但你可能有别的打算。
3. **stick-puppet 的定位。**继续当主力工具（则必须三维化），还是退到只做接触姿势（则可以维持二维）？
4. **`globalBend` 零消费**是历史遗留还是有计划？B 会给它真实用途。
5. **`new_assets/stumble.json` 解析失败**——要修还是先不管？
6. **摄像头方案（灵触随行）的时间线**，决定自拍动捕要不要进 v1 范围。

---

## 9. 本文档没有验证的

按 CLAUDE.md 的规矩，以下需要真实运行/目视才能确认，我没有也不会自行验证：

- 归一化后的姿势在游戏里目视是否可接受
- Mixamo / CMU 对日常社会行为的实际覆盖
- 三维投影后火柴人的前后遮挡可读性
- B 改造后 67 个旧 clip 的回归表现