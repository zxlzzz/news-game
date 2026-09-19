# Kimodo 单人动作生成：交接给 GPT

项目是一个街景社会模拟，需要大量 NPC 单人日常动作。Kimodo 是动作素材的主要来源，你负责写提示词、帮忙批量出动作。Kimodo 本身的资料你自己去搜，这里只写搜不到的：我们的环境、实测结果和推测。

## 环境（已跑通）

- Windows 11 笔记本，Docker，用的是量化版 fork `matbeedotcom/kimodo`，文字编码器是 NF4 版（`matbee/kimodo-llm2vec-nf4`）。**所有结果都出自量化编码器，不是原版。**
- 模型用 **Kimodo-SOMA-RP-v1.1**。界面默认可能选到 SMPLX，那个版本是研发许可，不要用。
- 国内下载模型走 `HF_ENDPOINT=https://hf-mirror.com`，不需要挂代理。
- 一条动作生成只要几秒，可以放心多试。

## 实测（09-19，在界面里切到骨架显示看）

| 描述 | 结果 |
|---|---|
| A person scratches their head. | 能看出来 |
| A person walks while looking at their phone. | 很像，没有手机这个物体也能看出来 |
| A person throws trash into a bin. | 不明显。原因推测是场景里没有物体可以对照，只改描述解决不了 |
| An elderly person walks. | 能看出是老人，但**太过了**，全程扶着腰 |
| A middle-aged person walks. / A slightly older person walks with a mild stoop. | 又太像普通人了 |

**要教的结论：**
- 单人日常动作，只靠描述就够用。
- **风格的轻重只能靠措辞粗调**，而且容易从一头跳到另一头，中间程度要靠试措辞慢慢找。他的尺子是"大概率能满足需求"，不追求每条都调到完美。先保证覆盖面，再慢慢打磨措辞。
- **和物件有接触的动作**（扔东西、开门、坐长椅）不能只靠描述，要加手或脚的末端约束。这一项还没实测。

## 约束怎么用（推测，没实测）

- 界面底部的 Full-Body / 2D Root / Left Hand 等轨道，直接加一个关键帧，只会记下当前动作在那一帧的位置，**本身不控制任何东西**。
- 要控制，推测的步骤是：加关键帧 → Enter Editing Mode → 拖动控制柄 → 退出编辑模式 → 重新 Generate。
- 需要精确坐标时，用 Load/Save 存一个约束文件，改里面的数字再加载回去。文件格式还没看过。

## 输出

npz 文件里的 `posed_joints` 是 [帧数, 77, 3]：单位米，Y 轴朝上，30 帧每秒，每根骨头的长度在所有帧里保持不变。`foot_contacts` 是 6 列，不是 4 列。转成游戏里用的 json 由 Claude 那边负责，你只要交出 npz，外加生成它用的描述原文和 seed。

## 先不碰的

- **双人接触**（握手、搀扶）：还没验证，另有测试方案，不在你的范围内。
- 首帧和尾帧怎么规范、怎么和前后动作衔接：还没定，不要自己定规则。