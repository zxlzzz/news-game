## Collision boxes of an object type for motion generation (docs/动作重做方案.md): every visible mesh of the type
## as an oriented box, in the frame of one of its post markers (the person's stance: origin on the floor, +Z the
## way the person faces), metres. scripts/kimodo_motion_batch.py "scene" keeps the generated stick figure out of them.
##   godot --headless --path . -s res://tools/export_scene_boxes.gd -- <type> <post marker> <out.json> [min size m]
## A held type (types/held_*.tscn) is exported around its own origin (the hold point): give "-" as the post marker.
## Also writes every marker of the type in the same frame ("markers": {name: [x, y, z]}).
## Meshes smaller than min size (default 0.03 m) in every direction are left out (chess pieces, labels).
extends SceneTree

func _initialize() -> void:
	var args := Array(OS.get_cmdline_user_args())
	if args.size() < 3:
		printerr("usage: -- <type> <post marker | -> <out.json> [min size]")
		quit(1)
		return
	var path: String = "res://types/%s.tscn" % args[0]
	if not ResourceLoader.exists(path):
		printerr("no type " + path)
		quit(1)
		return
	var minimum: float = float(args[3]) if args.size() > 3 else 0.03
	var root: Node3D = load(path).instantiate()
	var to_post := Transform3D.IDENTITY
	if args[1] != "-":
		var marker := root.get_node_or_null(args[1]) as Node3D
		if marker == null:
			printerr("%s has no %s" % [path, args[1]])
			quit(1)
			return
		to_post = marker.transform.affine_inverse()
	var boxes := []
	for mesh in root.find_children("*", "MeshInstance3D", true, false):
		var m := mesh as MeshInstance3D
		if m.mesh == null:
			continue
		var aabb := m.mesh.get_aabb()
		if aabb.size.x < minimum and aabb.size.y < minimum and aabb.size.z < minimum:
			continue
		var xf: Transform3D = to_post * _to_root(m, root)
		var centre: Vector3 = xf * aabb.get_center()
		var b := xf.basis
		var scale := b.get_scale()
		var r := b.orthonormalized()
		var half := aabb.size * 0.5 * scale
		# rows of the rotation: columns are the box axes in the stance frame
		boxes.append({"name": String(m.name), "centre": [centre.x, centre.y, centre.z],
			"axes": [[r.x.x, r.x.y, r.x.z], [r.y.x, r.y.y, r.y.z], [r.z.x, r.z.y, r.z.z]],
			"half": [half.x, half.y, half.z]})
	# every marker (post_*, hip_seat, table_press, ...) at its place in the same frame: where hands and hips go
	var markers := {}
	for marker in root.find_children("*", "Node3D", true, false):
		# Marker3D nodes of the type and the empties of its model (hip_seat, table_press, grip_left ...)
		if not (marker is Marker3D or (marker.get_class() == "Node3D" and marker.get_child_count() == 0)):
			continue
		var at: Vector3 = to_post * _to_root(marker, root).origin
		markers[String(marker.name)] = [at.x, at.y, at.z]
	root.free()
	var f := FileAccess.open(args[2], FileAccess.WRITE)
	f.store_string(JSON.stringify({"type": args[0], "post": args[1], "boxes": boxes, "markers": markers}, "  "))
	f.close()
	print("SCENE_BOXES %d -> %s" % [boxes.size(), args[2]])
	quit(0)

static func _to_root(n: Node, root: Node) -> Transform3D:
	var xf := Transform3D.IDENTITY
	while n != null and n != root:
		if n is Node3D:
			xf = (n as Node3D).transform * xf
		n = n.get_parent()
	return xf
