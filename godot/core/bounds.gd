## Object size comes from the model's bounding box (scene_spec.md §3), never from a file.
extends RefCounted

## Axis-aligned box of every mesh under `node`, in `node`'s parent space (the node's own
## transform included). Works before the node is added to the tree.
static func of_node(node: Node3D) -> AABB:
	var acc := {"box": AABB(), "any": false}
	_walk(node, node.transform, acc)
	return acc["box"]

static func _walk(n: Node, xf: Transform3D, acc: Dictionary) -> void:
	if n is MeshInstance3D and n.mesh != null:
		var b: AABB = xf * n.mesh.get_aabb()
		acc["box"] = b if not acc["any"] else acc["box"].merge(b)
		acc["any"] = true
	for c in n.get_children():
		if c is Node3D:
			_walk(c, xf * c.transform, acc)
