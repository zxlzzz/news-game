# 交付文件夹

做好的素材先放这里，不要直接放进游戏目录。Claude 检查通过后，再搬到正式位置（模型 → `godot/models/` + `godot/modeling/`，人的动作 → `assets/animations/npz/`，动物 → `godot/npc/`），并从这里删掉。

要做什么：`godot/素材清单.md` 的"第六批"。

## 放法

```
delivery/
  models/<名字>/        一个模型一个文件夹
    <名字>.glb
    build_<名字>.py
    说明.md             长宽高、色槽、原点和正面、交互位置、第三方来源（没有就写"无"）
    check.txt           python godot/modeling/check_model.py <名字>.glb 的完整输出，必须 PASS
    <名字>.png          可选：自己看过的截图
  motions/<名字>/       一个人体动作一个文件夹
    motion.npz
    meta.json           生成参数 + review（选中理由、试了几次、已知问题）
  animals/<名字>/       一种动物或一组动物动作的交付说明（代码不放这里，见下面"动物"）
    说明.md             做了哪些动作和行为、改了 / 新建了哪些文件、怎么打开预览、检查脚本输出
    预览动图 / 截图
  进度.md               做完一件记一行：名字、日期、一句话；暂缓的写原因
```

- 名字：英文小写加下划线，和清单一致。和已有模型、动作重名（不区分大小写）的不许用，换名字。
- 模型规则：`godot/modeling/模型制作说明.md`，色槽和尺寸都以它为准。
- 人体动作规则：`assets/动作生成任务清单.md` 的"执行约定"。要循环的动作按那里的循环做法：首尾同姿势，只差前进量，最后一帧重复第一帧。
- 模型里的手持物文件名以 `held_` 开头，见 `模型制作说明.md` 第 12 节。
- 不用等整批做完，做好一件放一件；Claude 会分批检查。
- 不合格的不要放进来凑数，在 `进度.md` 里写暂缓和原因就行。

## 动物

动物是代码，要在 Godot 工程里才能跑，所以**代码直接写进 `godot/`**，`delivery/animals/` 里只放说明和预览图。范围和边界：

- **可以新建**：`godot/npc/` 下新的动物文件（如 `procedural_cat.gd`、`cat-params.json`、行为控制器）、`godot/tools/` 下新的预览场景和检查脚本（如 `animal_review.tscn`、`check_animals.gd`）。
- **可以改**：`godot/npc/procedural_dog.gd`、`dog-params.json`（加原地动作和体型）、`godot/tools/check_locomotion.gd`（加检查）。改完 `check_locomotion.gd` 必须仍然 `LOCOMOTION_OK`，`dog_walker.gd` 用到的接口不能变（牵狗的人要照常能用）。
- **不要改**：`npc/crowd.gd`、`core/`、`scenes/`、`types/` 以及别的现有文件。接进街道场景是 Claude 之后的事。
- **验收看独立预览**：做一个预览场景（参照 `godot/tools/locomotion_review.tscn`），能单独看每个原地动作和过渡、每种体型、猫的全套；行为（流浪狗走走停停、有人靠近就走开、猫狗互动）在预览里用几个按固定路线走的假人演示。另录动图（参照 `godot/tools/record_review.py`）。
- 画法照现有的狗：纯黑剪影、3D 点每帧现算。数值全放 JSON，代码里不写。
- 说明里列出改了和新建的每个文件。


