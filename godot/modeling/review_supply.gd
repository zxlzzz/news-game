## Isolated asset review. No changes to the game's scene, palette or slot definitions.
## -- --asset <catalog name> [--yaw degrees] [--shot absolute.png]
extends "res://core/level.gd"

const Bounds := preload("res://core/bounds.gd")

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var index := args.find("--asset")
	var asset: String = args[index + 1] if index >= 0 else "building_residential"
	var row := args.has("--row")
	var catalog: Array = JSON.parse_string(FileAccess.get_file_as_string("res://modeling/supply_catalog.json"))
	var entry: Dictionary = {}
	for item in catalog:
		if item.name == asset:
			entry = item
	if row:
		entry = {"group": "buildings"}
		asset = "building_lineup"
	if entry.is_empty():
		push_error("Unknown review asset: " + asset)
		get_tree().quit(1)
		return
	var bounds: AABB
	if row:
		var cursor := 0.0
		var first := true
		for item in catalog:
			if item.group != "buildings":
				continue
			var packed: PackedScene = load("res://models/" + item.name + ".glb")
			var model: Node3D = packed.instantiate()
			var box: AABB = Bounds.of_node(model)
			model.position.x = cursor - box.position.x
			box.position.x += model.position.x
			bounds = box if first else bounds.merge(box)
			first = false
			cursor += box.size.x + 0.2
			add_child(model)
	else:
		var packed: PackedScene = load("res://models/" + asset + ".glb")
		var model: Node3D = packed.instantiate()
		bounds = Bounds.of_node(model)
		add_child(model)
	palette = preload("res://palettes/gray.tres")
	view = preload("res://scenes/street_demo/view.tscn")
	population = preload("res://scenes/street_demo/population.tres")
	var max_side: float = maxf(bounds.size.x, maxf(bounds.size.y, bounds.size.z))
	var ground := MeshInstance3D.new()
	var ground_mesh := BoxMesh.new()
	ground_mesh.size = Vector3(max_side * 8.0 + 8.0, 0.1, max_side * 8.0 + 8.0)
	var mat := StandardMaterial3D.new()
	mat.resource_name = "road" if entry.group in ["vehicles", "ground"] else "sidewalk"
	ground_mesh.material = mat
	ground.mesh = ground_mesh
	ground.position.y = -0.05
	ground.position.x = bounds.get_center().x
	add_child(ground)
	super._ready()
	get_viewport().msaa_3d = Viewport.MSAA_4X
	var yaw := -55.0 if entry.group == "vehicles" else 25.0
	if row:
		yaw = 8.0
	index = args.find("--yaw")
	if index >= 0:
		yaw = float(args[index + 1])
	var pitch := 55.0 if entry.group == "ground" else 38.0
	var direction := Vector3(sin(deg_to_rad(yaw)) * cos(deg_to_rad(pitch)), sin(deg_to_rad(pitch)), cos(deg_to_rad(yaw)) * cos(deg_to_rad(pitch)))
	var camera: Camera3D = get_viewport().get_camera_3d()
	var target := bounds.get_center()
	camera.position = target + direction * (max_side * 4.0 + 20.0)
	camera.look_at(target)
	camera.far = max_side * 20.0 + 100.0
	var projected_min := Vector2(INF, INF)
	var projected_max := Vector2(-INF, -INF)
	for i in range(8):
		var p: Vector3 = camera.global_transform.affine_inverse() * bounds.get_endpoint(i)
		projected_min = projected_min.min(Vector2(p.x, p.y))
		projected_max = projected_max.max(Vector2(p.x, p.y))
	var extent := projected_max - projected_min
	camera.size = maxf(extent.y, extent.x / (1920.0 / 1080.0)) * 1.38
	var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
	sun.look_at_from_position(Vector3(-0.55, 0.75, 0.63).normalized() * 30.0, Vector3.ZERO)
	var canvas := CanvasLayer.new()
	add_child(canvas)
	for data in [[asset, 28.0, 30], ["X %.2f  /  Z %.2f  /  Y %.2f m    |    GRAY / INK / 4x MSAA    |    ORTHO %.2f m" % [bounds.size.x, bounds.size.z, bounds.size.y, camera.size], 1020.0, 22]]:
		var label := Label.new()
		label.text = data[0]
		label.position = Vector2(42, data[1])
		label.add_theme_font_size_override("font_size", data[2])
		label.add_theme_color_override("font_color", Color(0.05, 0.05, 0.05))
		canvas.add_child(label)
	print("REVIEW_READY ", asset)
