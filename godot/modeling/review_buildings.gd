## Isolated building/shadow review, with no crowd or navigation simulation.
## -- --asset building_corner [--model res://...glb] [--yaw 25] [--shot absolute.png]
extends "res://core/level.gd"

const Bounds := preload("res://core/bounds.gd")

func option(key: String, default_value: String) -> String:
	var args := OS.get_cmdline_user_args()
	var i := args.find(key)
	return args[i + 1] if i >= 0 and i + 1 < args.size() else default_value

func _ready() -> void:
	var asset := option("--asset", "building_corner")
	var model: Node3D
	var source := option("--model", "")
	if source != "":
		var document := GLTFDocument.new()
		var state := GLTFState.new()
		var error := document.append_from_file(source, state)
		if error != OK:
			push_error("Cannot read review model: " + source)
			get_tree().quit(1)
			return
		model = document.generate_scene(state)
	else:
		var packed: PackedScene = load("res://models/" + asset + ".glb")
		if packed == null:
			get_tree().quit(1)
			return
		model = packed.instantiate()
	add_child(model)
	var bounds: AABB = Bounds.of_node(model)
	var max_side: float = maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	var ground := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(max_side * 8 + 8, 0.1, max_side * 8 + 8)
	var mat := StandardMaterial3D.new()
	mat.resource_name = "sidewalk"
	mesh.material = mat
	ground.mesh = mesh
	ground.position = Vector3(bounds.get_center().x, -0.05, 0)
	add_child(ground)
	palette = preload("res://palettes/gray.tres")
	_apply_look({})
	_add_environment()
	_add_corner_tint()
	add_child(preload("res://scenes/street_demo/view.tscn").instantiate())
	get_viewport().msaa_3d = Viewport.MSAA_4X
	var focus := option("--focus", "")
	if focus != "":
		var part := model.find_child(focus, true, false) as MeshInstance3D
		if part == null:
			push_error("Missing review focus mesh: " + focus)
			get_tree().quit(1)
			return
		bounds = part.global_transform * part.get_aabb()
		max_side = maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	var yaw := deg_to_rad(float(option("--yaw", "25")))
	var pitch := deg_to_rad(38.0)
	var direction := Vector3(sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch))
	var camera: Camera3D = get_viewport().get_camera_3d()
	var target := bounds.get_center()
	camera.position = target + direction * (max_side * 4 + 20)
	camera.look_at(target)
	camera.far = max_side * 20 + 100
	var low := Vector2(INF, INF)
	var high := Vector2(-INF, -INF)
	for i in range(8):
		var p: Vector3 = camera.global_transform.affine_inverse() * bounds.get_endpoint(i)
		low = low.min(Vector2(p.x, p.y))
		high = high.max(Vector2(p.x, p.y))
	var extent := high - low
	camera.size = maxf(extent.y, extent.x / (1920.0 / 1080.0)) * 1.38
	var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
	sun.look_at_from_position(Vector3(-0.55, 0.75, 0.63).normalized() * 30, Vector3.ZERO)
	print("BUILDING_REVIEW_READY ", asset)
