## Prints every object type's size from its model bounding box (core/bounds.gd):
## godot --headless --path godot -s res://tools/print_bounds.gd
extends SceneTree

const Bounds := preload("res://core/bounds.gd")

func _init() -> void:
	for f in DirAccess.get_files_at("res://types"):
		if not f.ends_with(".tscn"):
			continue
		var n: Node3D = load("res://types/" + f).instantiate()
		var b: AABB = Bounds.of_node(n)
		print("%-16s size %6.2f x %6.2f x %6.2f   min (%6.2f, %6.2f, %6.2f)" % [f.get_basename(), b.size.x, b.size.y, b.size.z, b.position.x, b.position.y, b.position.z])
		n.free()
	quit()
