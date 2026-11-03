# 动作与模型制作

| 内容 | 文档 |
|---|---|
| 共用 | [制作反思](asset-production-mistakes.md)、[场景素材需求](素材清单.md) |
| 模型 | [规范与画风参数](models/建模规范与参数.md)、[制作说明](models/模型制作说明.md) |
| 人体动作：制作方法 | [素材生成方法](motions/素材生成方法.md) |
| 人体动作：映射 | [已确认的火柴人基线规格](motions/npc-skeleton-mapping.md)；新映射研究与正式化要求见生成方法第 4、11 节 |
| 人体动作：需求与已有素材 | [生成任务清单](motions/动作生成任务清单.md)、[素材清单](motions/动作素材清单.md) |
| 人体动作：已有实现与早期路线 | [摆木偶方案](motions/动作重做方案.md)、[素材供给路线](motions/design_route_npc_motion_supply.md) |
| 动物 | [动作路线](animals/design_route_animal_motion.md)、[骨架与动作来源研究](animals/rig-and-motion-sources.md) |

人的动作制作以《素材生成方法》为准。旧摆木偶方案仍用于解释现有游戏实现，替换范围见生成方法第 10 节；清单中的历史执行约定与新方法冲突时，以新方法为准。

素材和工具保留在原来的 `assets/`、`godot/`、`scripts/`；方法试验与审查证据保留在 [codex-iter](../../codex-iter/)。NPC 的行为选择和动作语义见[行为系统](../behavior-system/README.md)。
