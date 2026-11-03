## Global colour-slot definitions (scene_spec.md §2): every slot the game knows and how that kind
## of surface is drawn. Flags: flat (ignores light), no_lines, no_shadow (casts none),
## hide (not drawn, no lines, no shadow). Colours are not here: they belong to palettes.
class_name SlotDefs
extends Resource

const FLAGS: Array[String] = ["flat", "no_lines", "no_shadow", "hide"]

@export var slots: Dictionary[StringName, PackedStringArray] = {}
