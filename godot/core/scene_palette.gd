## A colour scheme (scene_spec.md §1 palette.tres): colour per slot, the tone multipliers that
## change with the colours, line colour, corner tint and background. Several scenes may share one.
## Multipliers are sRGB-space factors on a slot's base colour (建模规范与参数.md 二).
class_name ScenePalette
extends Resource

## Base colour of every slot in core/slots.tres except the hidden ones.
@export var colors: Dictionary[StringName, Color] = {}
@export var mid_mul := Vector3(0.84, 0.84, 0.84)
@export var dark_mul := Vector3(0.6, 0.6, 0.6)
@export var stroke_mid_mul := Vector3(0.7, 0.7, 0.7)
@export var stroke_dark_mul := Vector3(0.45, 0.45, 0.45)
@export var line_color := Color(0.15, 0.15, 0.15)
@export var background := Color(0.9, 0.9, 0.9)
@export_group("Corner tint")
@export var tint_color := Color(0.5, 0.5, 0.5)
## Screen UV, (0, 1) = bottom-left corner.
@export var tint_center := Vector2(0.0, 1.0)
@export var tint_radius := 0.75
@export var tint_mix := 0.0
@export var tint_multiply := 0.0
