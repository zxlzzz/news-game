## NPC mapping check: godot --headless --path godot -s res://tools/check_mapping.gd
## Prints MAPPING_OK / MAPPING_FAIL (npc/mapping_check.gd) and exits 0 / 1.
extends SceneTree

const MappingCheck := preload("res://npc/mapping_check.gd")

func _init() -> void:
	quit(MappingCheck.run())
