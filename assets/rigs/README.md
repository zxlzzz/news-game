# 源 rig（动物）

`anim.md` §6 里的**第 1 个 rig**——MoCapAnything 的 reference asset，以及 BVH 输出所依据的骨头树。
**不是**我们自己的动物骨架（那是第 2 个，`anim.md` §6 说等人的最终骨架一起定，现在不该做）。

这里的文件只用来读骨头树和关节坐标，mesh / 蒙皮 / 贴图全部不消费。

---

## quaternius-animals/ — 四足

- 来源包：Quaternius《Ultimate Animated Animals》 https://quaternius.com/packs/ultimateanimatedanimals.html
- 许可：**CC0**（https://creativecommons.org/publicdomain/zero/1.0/）
- 取得途径：官方 Google Drive 当时报 "Quota exceeded"（热门公开文件限流，官方说最多 24 小时恢复），
  改从 CC0 镜像 `trebeljahr/quaternius-showcase` 的 `public/glb/animals_pack/` 取 GLB，12 个文件全部拿到。
  **注意**：镜像是第三方再发布，若发现与官方包有出入，以官方 Drive 为准重下。
- 格式：GLB（glTF 二进制），骨架与动画都在文件内，读 JSON chunk 即可，**不需要 Blender**

12 个文件：Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf

### 已验证（2026-09-21）

**拓扑分组**（按关节名集合 + 父子边签名）：

| 组 | 成员 | joints |
|---|---|---|
| canid | ShibaInu(46) / Husky(49) / Fox(51) / Wolf(51) | 差异**仅在** Tail4–Tail8 节数与耳朵 |
| equid | Donkey / Horse / Horse_White | 50 |
| bovid | Bull / Cow | 42（无耳骨） |
| cervid | Alpaca / Deer(46) / Stag(38) | — |

→ `anim.md` §2「猫和狗在关节层面是同一套东西，区别落在比例上」**成立**。
Fox 与 Wolf 关节名集合完全相同，Shiba 只少几节尾骨。

**关节构成**（ShibaInu 46 个为例）：解剖骨 34 + **IK 控制骨 12**
（`PoleTarget(Back).L/R` 4 根、`IKFrontLeg/IKBackLeg.L/R` 4 根、`FF.L/R` `FFB.L/R` 4 根）。
IK 控制骨在 `skins[0].joints` 里，直接取"全部 joint 世界坐标"会混进 12 根非解剖骨，**必须过滤**。

**接地点**：`FF.L/R`（前爪）、`FFB.L/R`（后爪），rest 世界 y ≈ 0.069–0.072，是全骨架最低点。
它们是 `IKFrontLeg/IKBackLeg` 的子骨，而 `IK*` 在 Walk 里**有 K 帧**，所以脚的世界位置可完整还原。
注意地面不在 y=0 而在 y≈0.069。

**腿链结构（与 `anim.md` §2 假设不符）**：

```
前腿  FrontShoulder → FrontUpperLeg → FrontLowerLeg →(1.036 无骨)→ FF     两骨 + 末端断档
后腿  BackShoulder → BackLeg → BackUpperLeg → BackLowerLeg →(0.629 无骨)→ FFB   三骨 + 末端断档
```

前后腿骨节数不同（2 vs 3），且**两条腿都没有脚/爪关节**——变形骨链末端离地面还有
0.6–1.0（前腿这段比大腿本身还长）。"每条腿两骨链、照搬人的做法"这条需要重新设计。

**那段断档不是骨头，会伸缩**（`--rigid`，12 条动画 × 60 帧，量两端点距离的
`(max−min)/mean`）：

| 段 | Idle | Walk | Gallop_Jump | 判定 |
|---|---|---|---|---|
| FrontShoulder→FrontUpperLeg | 0.0% | 0.0% | 0.0% | 刚性骨 |
| FrontUpperLeg→FrontLowerLeg | 0.0% | 0.0% | 0.0% | 刚性骨 |
| **FrontLowerLeg→FF** | 0.4% | 7.9% | **38.5%** | **非刚性** |
| BackShoulder→BackLeg | 0.0% | 0.0% | 0.0% | 刚性骨 |
| BackLeg→BackUpperLeg | 0.0% | 0.0% | 0.0% | 刚性骨 |
| BackUpperLeg→BackLowerLeg | 0.0% | 0.0% | 0.0% | 刚性骨 |
| **BackLowerLeg→FFB** | 1.8% | 20.9% | 14.1% | **非刚性** |

真骨头恒定到 0.0%，断档段最大伸缩 39%（前）/ 21%（后），对比干净，结论无歧义。

→ **不能把爪子当端点反解腿**：余弦定理要求根到端点之间每段骨长已知且固定，
这里最后一段长度不定，方程缺一个已知量。我们自己的动物骨架必须自己补一节脚。

**自带 Walk 有足部滑移**（240 帧采样，接地判据 y ≤ restY+0.01）：

| 脚 | 接地占比 | 支撑相累计 Δz |
|---|---|---|
| FF.L / FF.R | 54% / 50% | −1.017 / −1.006 |
| FFB.L / FFB.R | 58% / 61% | −1.664 / −1.665 |

左右对称极好（<1%），但**前后脚差 64%**——同一个循环里前脚认为身体走了 1.02、后脚认为走了 1.67。
按仓库 L-2 `groundTravel` 的自动推导口径（相对偏差 >20% 即判 clip 缺陷），这条会被判缺陷。
Body 的 z 恒为 0.001，是原地循环、无根位移。

→ 自带 12 条动画**不能直接当动作素材用**。但这不影响本目录的用途：按 `anim.md`，
动作来自视频 + MoCapAnything，这些文件只当 rig。
另注：四足需要**四脚一致性检查**，仓库现有的左右对称检查（Rule 16）覆盖不到前后差异。

**动画清单**：canid 组 12 条 —— Attack, Death, Eating, Gallop, Gallop_Jump, Idle, Idle_2,
Idle_2_HeadLow, Idle_HitReact_Left/Right, Jump_ToIdle, Walk。通道只有 rotation + translation，无 scale。

---

## pigeon/ — 鸟

- 来源：dudecon 的低模鸽子，Blender 源文件 https://peripheralarbor.com/bird.blend
  （Sketchfab 页 https://sketchfab.com/3d-models/animated-bird-pigeon-797d27b68af3453e865149435df6aa30）
- 许可：**Public Domain**
- 格式：`.blend`，Blender 3.06 存档，**zstd 压缩**（magic `28 B5 2F FD`，不是 `BLENDER`，
  直接看文件头会误判为损坏）。解压后 3.87 MB。

### 已验证（2026-09-21）

**是 Rigify 控制骨架，共 422 根骨头**，其中 `DEF-` 变形骨 76 根、`ORG-` 72 根、`MCH-` 45 根，
其余是 `_fk` / `_ik` / `tweak_` 控制骨。要用的是 **DEF- 那 76 根**，且其中大半是羽毛/脚趾/喙/舌头。

核心结构：

```
脊椎   DEF-spine → .001 … .006（7 节）→ DEF-neck.001 → DEF-head
翼     DEF-shoulder → DEF-Wing → DEF-Wing.001 → DEF-Wing.002        三骨链
       + DEF-w_feather.001–.004（每侧 4 根羽毛骨）
腿     DEF-pelvis → DEF-thigh(+.001) → DEF-shin(+.001) → DEF-foot(+.001) → DEF-toe
       + 每只脚 t_index / t_middle / t_ring / t_thumb 各 2–3 节（趾骨）
尾     DEF-t_feather.L/R
```

翼是**三骨链**，不是 `anim.md` §5 里 Truebones Pigeon 那种两骨链；腿也远比"只有一根"丰富。
这套 rig 比 Truebones 的 9 关节鸽子精细得多，**需要降维**才能进火柴人。

**5 条动画**（+1 条 `Pigeon Proportions` 是比例调节，不是动作）：
`Flapping`、`Gliding`、`Standing Idle`、`Takeoff`、`Landing`。与文档描述一致。
注意：**没有地面行走 clip**，地面只有 Standing Idle。

---

## 未取得

- Quaternius 的 FBX / Blend / OBJ 版本（Drive 限流，glTF 已够用，未再尝试）
- itch.io 与 poly.pizza 均被 Cloudflare 拦（curl 403），若需官方原包要用真实浏览器

## 复现上面所有数字

```sh
python scripts/rig_dump_glb.py assets/rigs/quaternius-animals/ShibaInu.glb            # 骨架树 + 动画清单
python scripts/rig_dump_glb.py assets/rigs/quaternius-animals/ShibaInu.glb --rigid    # 每段骨长是否恒定
python scripts/rig_dump_glb.py assets/rigs/quaternius-animals/ShibaInu.glb --stance Walk  # 支撑相接地
python scripts/rig_dump_blend.py assets/rigs/pigeon/bird.blend                        # 鸽子骨架树 + 动作
python scripts/rig_dump_blend.py assets/rigs/pigeon/bird.blend --deform               # 只看 DEF- 变形骨
```

两个脚本都不依赖 Blender / three.js，只要 numpy（`.blend` 另需 zstandard 解压）。
