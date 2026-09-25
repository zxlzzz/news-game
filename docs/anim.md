# 动物动作与骨架供给路线（2026-09-21）

配套文档：`design_route_npc_motion_supply.md`（人的动作供给）。本文只讲动物，人的部分不重复。

---

## 1. 问题

街景里要有动物。需要解决两件事：动物骨架长什么样，动作数据从哪来。

结论先写：**不走生成器，走"免费 rig + 本地模型从视频提取动作"。**

理由是成本结构和人不一样。人那边要 Kimodo 是因为动作语义无限、数量不可妥协。一只猫在街景里总共就那么几件事（走、跑、坐、趴、舔、受惊窜走），为这个规模搭生成管线不划算。

---

## 2. 按拓扑分，不按物种

需要的是两套骨架拓扑，不是 N 个物种：

| 拓扑 | 覆盖 |
|---|---|
| 四足 + 尾 + 头颈，每条腿两骨链 | 猫、狗、鼠 |
| 两足 + 翼 + 尾 | 鸽子、麻雀 |

猫和狗在关节层面是同一套东西，区别落在比例和脊背曲线上——那是绘制端的参数，不是数据里的东西。鼠同理，蹭四足拓扑改比例，接近零成本。

不做马、牛、羊：街景里不出现。

鸽子的价值比猫狗高：成群、被惊飞是一个**画面事件**，和新闻摄影主题直接咬合。（这条是 Claude 提的，未拍板。）

### 结构上的真问题

**鸟飞起来的时候没有地面接触。** 我们定的端点 IK（四肢端点 + 弯曲方向 + 骨长，余弦定理重建）、脚接地、groundTravel，整套建立在有支撑点上。

- 四足：**接地成立，但腿链不成立**——见下一小节，2026-09-21 实测
- 鸟落地走：接地成立
- 鸟飞行：不成立，需要另一套处理

这一条还没定。

### 四足腿链实测结果（2026-09-21）

拿 Quaternius Shiba 的 rig 量过（`python scripts/rig_dump_glb.py <glb> --rigid`），
**"每条腿两骨链、照搬人的做法"这句要作废**：

```
前腿  FrontShoulder → FrontUpperLeg → FrontLowerLeg ──?── FF（爪，接地点）
后腿  BackShoulder → BackLeg → BackUpperLeg → BackLowerLeg ──?── FFB（爪，接地点）
```

1. **前腿两骨、后腿三骨**，骨节数不同，不是同一套公式。
2. **两条腿都没有爪子那根骨头。** 最后一段（`──?──`）的两端距离**不是常数**：
   安静动作里几乎不变（Idle 0.4%），跑跳时拉长到 **39%**（前）/ **21%**（后）。
   真骨头那几段在全部 12 条动画里恒定到 **0.0%**，对比极干净——所以这一段确实不是骨头，
   是 IK 解算的富余量。
3. 后果：**不能把爪子当"端点"直接反解腿**。余弦定理要求根到端点之间每段骨长已知且固定，
   这里最后一段长度不定，方程缺一个已知量。

好消息是接地点本身没问题：`FF/FFB` 在全骨架最低处（rest y≈0.069，注意不在 y=0），
且它们的父骨 `IKFrontLeg/IKBackLeg` 在每条动画里都有 K 帧，脚的世界坐标可完整还原。

**所以"我们自己的动物骨架"必须自己补一节脚（掌骨/系部），不能照抄源 rig 的骨节划分。**
这条现在可以先记着，等 §6 说的"跟人的最终骨架一起定"时一并处理。

---

## 3. 素材（rig 来源）

我们只要骨头树和关节世界坐标，mesh、蒙皮、贴图全扔。但 MoCapAnything 需要一个"目标 rig"当 prompt，所以这些模型文件还是要下载。

### 四足 — Quaternius《Ultimate Animated Animals》 ✅ 已下载

- https://quaternius.com/packs/ultimateanimatedanimals.html
- 12 种动物，每种 12 条以上动画，FBX / OBJ / Blend / glTF
- **CC0**
- 含 Shiba Inu、Husky、Fox、Wolf、Deer、Stag、Horse、Cow、Bull、Donkey、Alpaca。另有 Farm 包含 Pug、Pig、Sheep、Zebra
- 自带的 12 条是**游戏战斗向**（Attack、Death、Kicks、Gallops、Jump），缺闲置动作。但闲置动作从视频来，所以不影响它当 rig 用

**落地情况（2026-09-21）**：12 个 GLB 全部在 `assets/rigs/quaternius-animals/`，来源、许可、
实测数字见 `assets/rigs/README.md`。官方 Google Drive 当时报 `Quota exceeded`（热门公开文件
限流），实取自 CC0 镜像仓库 `trebeljahr/quaternius-showcase`——**是第三方再发布**，
若日后与官方包对不上以官方为准。

已验证：Fox 与 Wolf 关节名集合**完全相同**，Husky / Shiba 只少几节尾骨和耳骨，
§2「猫狗同拓扑、区别落在比例上」**成立**。
另：自带的 Walk **有足部滑移**（前脚支撑相走 1.01、后脚走 1.66，差 39%），
按 L-2 `groundTravel` 口径会判 clip 缺陷——不影响它当 rig 用，但**自带动画不能当动作素材**。

### 鸟 — dudecon 的低模鸽子 ✅ 已下载

- https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30
- Blender 源文件：peripheralarbor.com/bird.blend
- **Public Domain**
- 5 条动画：滑翔、扇翅、地面待机（三条循环）+ 起飞 + 降落
- 起飞/降落正好是"有接触 → 无接触"的过渡段，免费版直接给了
- 作者说这个 rig 缩放换贴图就能当别的鸟种

**落地情况（2026-09-21）**：在 `assets/rigs/pigeon/bird.blend`，Blender 3.06 存档、zstd 压缩
（文件头是 `28 B5 2F FD` 不是 `BLENDER`，直接看会以为文件坏了）。
用 `python scripts/rig_dump_blend.py` 读出来，**不需要装 Blender**。

5 条动画名核对无误（Flapping / Gliding / Standing Idle / Takeoff / Landing，另有一条
`Pigeon Proportions` 是比例调节不是动作）。**注意地面只有 Standing Idle，没有行走 clip。**

但这**不是**一个轻量 rig：是 Rigify，共 **422 根骨头**，其中 `DEF-` 变形骨 76 根、
`ORG-` 72、`MCH-` 45，其余是 fk/ik/tweak 控制骨。核心结构：

```
翼   DEF-shoulder → DEF-Wing → DEF-Wing.001 → DEF-Wing.002   三骨链 + 每侧 4 根羽毛骨
腿   DEF-pelvis → thigh(+.001) → shin(+.001) → foot(+.001) → toe + 每脚 4 组趾骨
脊   DEF-spine → .001….006（7 节）→ neck.001 → head
```

翼是**三骨链**，不是 §5 里 Truebones Pigeon 那种两骨链；腿也远比"只有一根"丰富。
用之前**要降维**，降到几根等 §8「我们自己的动物骨架」一起定。

### 猫

自由许可的很薄。BlendSwap 上 JonasDichelle 那只（CC-BY，只有走和跑循环）是能找到的最好的。

但猫不需要单独找——Fox 和 Cat 在关节层面是同一套拓扑，改比例即可。

---

## 4. 本地模型（动作来源）

需要独显。他 09-21 确认实验室机器有独显，显存未知。

### 主选：MoCapAnything V2

**单目视频 + 目标 rig → BVH 关节旋转。**

- 代码 https://github.com/phongdaot/MocapAnything
- 权重 https://huggingface.co/kehong/MoCapAnythingV2-weights
- 主模型 `video2pose2rot`，端到端单网络，一个 checkpoint 约 464MB
- 输入还要一帧同物种的参考姿势，用来定骨架和尺度——这是它泛化到没见过的动物的方式
- **推理不需要数据集预处理**
- 不依赖任何物种专属身体模型，动物/人/物件/自定义 rig 都收

**为什么选它**：三个候选里唯一同时满足"官方权重已放 + 推理不用数据集 + 不用先买 Truebones + 挑什么视频就得到什么动作"。另外两个要么拿不到权重，要么只能生成"这个物种一般怎么动"。

这条路把成本从"找素材"换成"找视频"。猫坐着舔爪子、狗抖毛、鸽子啄地的视频无限多，而这恰恰是动捕库最贵的那部分。

**运行时会自动从 HF 拉两个依赖：**

| 依赖 | 状态 |
|---|---|
| `facebook/dinov2-large` | 开放 |
| `briaai/RMBG-1.4` | **gated**。要 HF 账号 + 填表（姓名/单位/国家/邮箱 + 勾同意），即时放行，不是 Llama-3-8B 那种等审批。许可非商用 |

HF 要能连，走新加坡 VPN。

### 备选：AnyTop

- https://github.com/Anytop2025/Anytop
- 官方预训练权重已放
- 按子集分模型：Bipeds / Quadrupeds / Millipeds-Snakes / **Flying**
- 喂 BVH 就能处理没见过的骨架，论文说每个拓扑三条训练样例就能泛化
- 支持补中间帧、局部编辑
- 处理后的数据集因许可问题没放，只放权重和依赖

和 MoCapAnything 的区别：不需要视频，但**点不了具体动作**——生成的是"这个物种一般怎么动"。

### 盯着：UniMate（现在用不了）

- https://github.com/Friedrich-M/UniMate
- **rigged 资产 + 文字 prompt → 动作**，任意骨架，不需要针对每个骨架微调，也不需要推理时优化
- 训练集 UniML3D 13006 条，覆盖 bipedal / quadrupedal / **avian** / marine / insectoid / serpentine
- 支持零样本跨拓扑迁移、补中间帧、文字引导编辑

这是"动物版 Kimodo"，体验上最省事。**但官方权重看起来没放**——HF 上 `tarn59/UniMate-Weights` 是第三方拿作者代码单卡从头训的，自己声明不是官方 checkpoint、论文数字不适用。自己训的话 UniML3D 的动物部分要先买 Truebones（pipeline 直接吃 `Truebone_Z-OO` 原始目录结构）。

**官方 checkpoint 一放出来就该重新评估。**

### 已否：DeepLabCut SuperAnimal-Quadruped

零样本、不用标注、39 个关键点、45+ 物种、侧视角、成熟、显存要求低。

两个硬伤，当不了主力：
- **输出是 2D**，和 09-06 定的"json 存三维关节"对不上
- **没有鸟**，官方说鸟/昆虫/鱼是以后的计划

---

## 5. 付费选项：Truebones Zoo（暂不买）

- https://truebones.gumroad.com/l/skZMC
- $100，997MB，74 个骨架、1097 条 clip、统一 30fps，rig 9–143 关节，每种中位数 12 条
- royalty free，但 **Terms of Use 明确不可转售、不可再分发**

**免费预览**：HF 上 `tanish434/Truebones-ZOO-Annotations` 把动作文件之外的全放出来了——每条 clip 的四视角 MP4、每个物种的 rest pose 渲染图、每条一句英文描述、per-species 骨骼名单。买之前可以把 1097 条全看一遍。

它的骨骼确实已经在火柴人量级，例如 Pigeon 的完整骨骼是 9 个关节：

```
Hips, Spine, LeftArm, LeftForeArm, RightArm, RightForeArm,
LeftLeg, RightLeg, Tail01
```

翅膀是两骨链，腿只有一根。不用降维。

**为什么暂不买**：
1. $100 买的主要是"闲置动作"（坐、趴、嗅、抖毛），而本地部署之后这些能从视频自己造
2. 许可。我们仓库是公开的，从它导出关节 json 提交进去算不算"再分发"说不清。Quaternius 是 CC0、鸽子是 PD，这个问题根本不存在

MoCapAnything 和 AnyTop 都是拿 Truebones 训的，但放出来的是**权重**，我们不碰数据文件，输出是自己视频算的——这条路绕开了许可问题。

---

## 6. 管线

```
免费 rig（Quaternius 狗 / dudecon 鸽子）
        ↓  当 MoCapAnything 的 reference asset
网上视频（猫坐、狗抖毛、鸽子啄地）
        ↓  MoCapAnything V2
BVH（源 rig 的骨头树 + 逐帧旋转）
        ↓  读关节世界坐标（three.js 当纯解算器那条路，见 09-06）
关节三维坐标序列
        ↓  降到我们自己的动物骨架
动作 json
```

两个 rig 别混：

1. **源 rig** — Quaternius 的狗、那只鸽子。MoCapAnything 输出的 BVH 是这个骨头树的。**已有**
2. **我们自己的动物骨架** — 最后画火柴人用的那几个关节。**还没有**

第 2 个现在不该做：人的最终骨架 09-19 还没定死（"不一定是 11 点，也不一定是 77 关节"），动物骨架应该跟着人的一起定，单独先定一份会白做。（这条是 Claude 的判断，未拍板。）

---

## 7. 未验证 / 待办

修正（2026-09-21）：原写"Claude 这边网络出不去、也没有机器"**不成立**——CC 跑在开发本本上，
`curl` 能出去（HF / GitHub 200），本机有 **RTX 4060 Laptop 8GB**、torch 2.3.0+cu121、CUDA 可用。
下载与静态解析这类事 CC 能自己做完；剩下真正卡人的是下面几条。

- ~~Quaternius 的 rig 具体几根骨头、骨头怎么命名~~ ✅ **已验**，见 §2 与 §3、`assets/rigs/README.md`
- 显存。MoCapAnything 的需求论文和 repo 都没给数字，dinov2-large + 4D 重建那一步是大头，估不出可信值。
  本本只有 8GB，**很可能不够**；实验室机器的显存仍未知
- `briaai/RMBG-1.4` 是 gated，要**本人** HF 账号登录 + 填表勾同意（非商用）。CC 不能代替接受许可协议
- MoCapAnything 对参考资产的静止姿势有没有要求（T-pose 之类）
- 鸟的表现。有一篇评述提到"非四足物种上差距特别明显"，但没写清是更好还是更差，不能当依据。要知道只能跑一遍鸽子看结果
- 鸽子那套 Rigify 的 IK 控制骨要转成纯 FK 才好进管线，这一步**需要装 Blender**（本机没有）

## 8. 未定

- 鸟飞行段怎么处理（没有地面接触，端点 IK + groundTravel 不成立）。
  有了鸽子的 Takeoff / Landing 两条 clip，这是现成的"有接触 → 无接触"过渡样本，
  设计时可以量实物而不是靠猜
- 我们自己的动物骨架几个关节、怎么连（等人的最终骨架一起定）。
  **已知约束**：必须自己补一节脚，前后腿要分别定骨节数——见 §2 实测
- 四足的接地校验要**四只脚互比**，仓库现有 Rule 16 只比左右，覆盖不到前后差异
- 鼠要不要做
- 动物的行为系统怎么接（本文只管资源供给，不涉及行为）