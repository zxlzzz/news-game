> **status: finalized**
> **过期提示（2026-09-19）**：本机已试用 Kimodo，单人动作可用；下文保留试用前整理的步骤，不作为本机实测记录。最终骨架的关节数尚未确定，§7 的“挑 11 个关节”不是已定规格。

# Kimodo 试用说明

目的：看 Kimodo 能不能当 NPC 动作 json 的来源。设计背景见 `design_route_npc_motion_supply.md`。

以下步骤整理自官方 README、官方文档和 ROBOTIS 的第三方安装指南。**Claude 没有在任何机器上跑过**，命令有出入以 `--help` 和官方文档为准。

---

## 0. 先办：可能要等审批

文字编码器用的是 Meta 的 Llama-3-8B，这个模型在 Hugging Face 上**需要申请访问**。

1. 注册 Hugging Face 账号，在设置里建一个 access token。
2. 打开 `meta-llama/Meta-Llama-3-8B-Instruct` 的页面申请访问，等批准。
3. 在要跑的机器上登录：
   ```bash
   pip install --upgrade huggingface_hub
   hf auth login
   ```
4. 访问 Hugging Face 不通就要走代理。用镜像站拿这种要审批的模型可能会失败（推断，没验证）。

模型下载完之后，生成就完全在本地跑。

---

## 1. 你这台机器

- **显存**：完整跑在 GPU 上要约 17GB，4060 Laptop 装不下。**文字编码器必须放到 CPU**，这样 GPU 只需不到 3GB。
- **内存**：8B 模型放 CPU 跑很吃内存。按半精度推算大概要 16GB 以上，官方没给数字。内存不够会非常慢或直接失败。
- **系统**：官方主要在 Linux 上测。Windows 推荐走 Docker，需要 Docker Desktop、WSL2 和 NVIDIA GPU 支持。

---

## 2. 安装（二选一）

### A. Docker

```bash
git clone https://github.com/nv-tlabs/kimodo.git
cd kimodo
git clone https://github.com/nv-tlabs/kimodo-viser.git
docker compose up -d --build
```

- 第一次要下载镜像、依赖和模型，需要一段时间。
- 显存不够：打开 `docker-compose.yaml`，在文字编码器那个服务的环境变量里把 `TEXT_ENCODER_DEVICE` 设成 `cpu`。具体字段 Claude 没核实，以文件内容为准。

### B. Python 环境

```bash
conda create -n kimodo python=3.10
conda activate kimodo
# 按 pytorch.org 的选择器装一个和你 CUDA 版本匹配的 PyTorch
git clone https://github.com/nv-tlabs/kimodo.git
cd kimodo
pip install -e ".[all]"
git clone https://github.com/nv-tlabs/kimodo-viser.git
pip install -e kimodo-viser
```

---

## 3. 跑起来

**终端 1：文字编码器常驻。** 这样每次生成不用重新加载 8B 模型。

```bash
# Linux / WSL
TEXT_ENCODER_DEVICE=cpu kimodo_textencoder
```
```powershell
# Windows PowerShell
$env:TEXT_ENCODER_DEVICE="cpu"; kimodo_textencoder
```

**终端 2（同一个环境）：二选一。**

交互界面：
```bash
kimodo_demo
```
然后浏览器打开 `http://127.0.0.1:7860`。

命令行：
```bash
kimodo_gen "A person scratches their head." --model Kimodo-SOMA-RP-v1.1 --duration 3.0 --num_samples 3 --output output/scratch_head
```

- 模型名报错就用 `kimodo_gen --help` 查可选名。ROBOTIS 指南里写的是 `Kimodo-SOMA-RP-v1`。
- 用 Docker 的话，命令前加 `docker compose exec demo`。
- 常用参数：
  - `--num_samples`：一次出几条，方便挑
  - `--seed`：固定随机数，结果可复现
  - `--constraints`：传约束文件
- 后处理（修脚底打滑、贴合约束）默认开着，**别加 `--no-postprocess`**。

---

## 4. 描述怎么写

- 用 "A person …" 开头；要风格就写 "An old person …" 或 "A tired person …"。
- 中等细节。一条只写一到两个动作，太短太笼统不行，逐个部位描述也不行。
- 一条最长 10 秒，长的拆成几条。拆开时每条都要能单独读懂，别写 "Then he stops" 这种依赖上一条的句子。
- 训练数据覆盖走跑、手势、日常活动、常见物件交互，以及各种情绪和状态风格。超出这些的效果会差。

---

## 5. 这次看三件事

按顺序看。前一件不行，后面的就不用看了。

1. **小幅度日常动作能不能读出来。** 生成挠头、扔垃圾、边走边看手机、老人走。界面里切成**骨架显示**来看（不要看蒙皮人），骨架最接近火柴人的样子。
2. **手的末端约束准不准。** 在时间轴的手脚末端轨道上，给某一帧定一个手的位置，看生成出来手落没落到那里。
3. **（可选）双人拼接像不像。** 先生成 A 并导出，读出 A 手的位置，写成 B 的末端约束，再生成 B。约束文件的格式：先在界面里存一个，打开看结构再改数字。字段 Claude 没核实。

---

## 6. 输出文件里有什么

默认输出 `.npz`。一次出多条时，文件名会带 `_00`、`_01` 这样的后缀，以 output 目录里的实际文件名为准。

| 字段 | 形状 | 含义 |
|---|---|---|
| `posed_joints` | [帧数, 77, 3] | 每个关节的全局三维坐标（**我们要的**） |
| `foot_contacts` | [帧数, 4] | 左脚跟、左脚尖、右脚跟、右脚尖是否触地 |
| `root_positions` | [帧数, 3] | 根关节（骨盆）轨迹 |
| `global_rot_mats` / `local_rot_mats` | [帧数, 77, 3, 3] | 旋转矩阵，暂时用不上 |

快速检查：
```python
import numpy as np
d = np.load("output/scratch_head_00.npz")
print(d.files)
print(d["posed_joints"].shape)
```

---

## 7. 试完带回来的东西

原样给就行，不用整理：

- 录屏或截图（骨架显示），外加当时用的描述原文
- 卡住时的报错原文
- 一条生成花了多久，内存和显存占用
- 一两个 `.npz` 文件：Claude 这边能直接读出关节数据，拿去做挑 11 个关节和骨长对齐