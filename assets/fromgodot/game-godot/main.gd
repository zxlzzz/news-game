extends Node3D

const BUILDING_SMALL: PackedScene = preload("res://assets/Building_Small_1.glb")
const BUILDING_MEDIUM: PackedScene = preload("res://assets/Building_Medium_2_001.glb")
const BUILDING_LARGE: PackedScene = preload("res://assets/Building_Large_2.glb")
const TREE_ONE: PackedScene = preload("res://assets/CommonTree_1.glb")
const TREE_THREE: PackedScene = preload("res://assets/CommonTree_3.glb")
const BUSH: PackedScene = preload("res://assets/Bush_Common.glb")
const FLOWERING_BUSH: PackedScene = preload("res://assets/Bush_Common_Flowers.glb")
const PLANTER: PackedScene = preload("res://assets/Sidewalk_Planter.glb")
const BOLLARD: PackedScene = preload("res://assets/Prop_Bollard.glb")
const FILTER_NAMES := ["原色", "黑白灰清线"]
const FILTER_MATERIALS := [null, preload("res://filters/monochrome_clearline.tres")]
const FILTER_KEYS := [KEY_0, KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9]

var camera: Camera3D
var style_pass: MeshInstance3D
var filter_label: Label
var active_filter := 0
var _materials: Dictionary = {}


func _ready() -> void:
	assert(FILTER_NAMES.size() == FILTER_MATERIALS.size())
	assert(FILTER_NAMES.size() <= FILTER_KEYS.size())
	build_street_corner()
	var arguments := OS.get_cmdline_user_args()
	if arguments.has("--capture"):
		set_filter(0 if arguments.has("--raw") else 1)
		await settle_frames(24)
		var filename := "street_corner.png" if arguments.has("--raw") else "street_corner_monochrome.png"
		await save_capture(filename)
		print("STREET_CORNER_STUDY_DONE")
		get_tree().quit()
	else:
		build_filter_ui()
		set_filter(0)


func build_street_corner() -> void:
	build_environment()
	build_ground()
	build_architecture()
	build_landscape()
	build_camera()


func build_environment() -> void:
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("bfcfd2")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("d8d4c9")
	environment.ambient_light_energy = 0.72
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC

	var world_environment := WorldEnvironment.new()
	world_environment.name = "NaturalEnvironment"
	world_environment.environment = environment
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "LateMorningSun"
	sun.rotation_degrees = Vector3(-49.0, -34.0, 0.0)
	sun.light_color = Color("fff1d6")
	sun.light_energy = 1.18
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0
	add_child(sun)


func build_ground() -> void:
	add_box("Ground", Vector3(78.0, 0.28, 62.0), Vector3(0.0, -0.25, 4.0), Color("82906f"))
	add_box("BuildingApron", Vector3(68.0, 0.18, 18.0), Vector3(0.0, -0.08, -7.0), Color("b6ad9e"))
	add_box("FarSidewalk", Vector3(68.0, 0.24, 6.5), Vector3(0.0, 0.00, 4.5), Color("c8c1b4"))
	add_box("FarCurb", Vector3(68.0, 0.40, 0.34), Vector3(0.0, 0.06, 7.74), Color("ded8cb"))
	add_box("Road", Vector3(68.0, 0.20, 15.5), Vector3(0.0, -0.11, 15.65), Color("4e5353"))
	add_box("NearCurb", Vector3(68.0, 0.40, 0.34), Vector3(0.0, 0.06, 23.56), Color("ded8cb"))
	add_box("NearSidewalk", Vector3(68.0, 0.22, 5.0), Vector3(0.0, -0.01, 26.2), Color("c4bdae"))

	for x in range(-30, 31, 8):
		add_box("LaneDash", Vector3(4.6, 0.035, 0.16), Vector3(float(x), 0.015, 15.65), Color("e6c75b"))

	add_box("RoadEdgeFar", Vector3(68.0, 0.035, 0.10), Vector3(0.0, 0.012, 9.15), Color("e3ddd0"))
	add_box("RoadEdgeNear", Vector3(68.0, 0.035, 0.10), Vector3(0.0, 0.012, 22.15), Color("e3ddd0"))

	for z in range(10, 22, 2):
		add_box("CrosswalkStripe", Vector3(3.4, 0.045, 0.72), Vector3(9.0, 0.025, float(z)), Color("e7e2d7"))


func build_architecture() -> void:
	add_asset(BUILDING_SMALL, "CornerBrickBuilding", Vector3(-17.0, 0.0, -5.8), 0.0)
	add_asset(BUILDING_MEDIUM, "MiddleBuilding", Vector3(-1.5, 0.0, -6.5), 0.0)
	add_asset(BUILDING_LARGE, "LargeBuilding", Vector3(16.0, 0.0, -7.0), 0.0)

	add_asset(PLANTER, "PlanterLeft", Vector3(-9.5, 0.18, 3.5), 0.0)
	add_asset(PLANTER, "PlanterRight", Vector3(16.5, 0.18, 3.5), 0.0)

	for x in [-5.0, -3.2, -1.4, 0.4, 2.2]:
		add_asset(BOLLARD, "Bollard", Vector3(x, 0.18, 7.0), 0.0)


func build_landscape() -> void:
	add_asset(TREE_ONE, "TreeLeft", Vector3(-28.0, 0.0, 0.6), 0.0)
	add_asset(TREE_THREE, "TreeRight", Vector3(27.0, 0.0, 0.4), -18.0)

	for item in [
		[BUSH, Vector3(-24.7, 0.0, 2.3), 0.95],
		[FLOWERING_BUSH, Vector3(-21.8, 0.0, 2.5), 1.10],
		[BUSH, Vector3(23.5, 0.0, 2.1), 1.15],
		[FLOWERING_BUSH, Vector3(20.8, 0.0, 2.5), 0.92],
	]:
		var plant := add_asset(item[0], "Shrub", item[1], 0.0)
		plant.scale = Vector3.ONE * item[2]


func build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FixedOrthographicCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 38.0
	camera.near = 0.1
	camera.far = 180.0
	camera.position = Vector3(38.0, 31.0, 46.0)
	camera.look_at_from_position(camera.position, Vector3(0.0, 5.6, 6.0), Vector3.UP)
	camera.current = true
	add_child(camera)

	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	quad.flip_faces = true
	style_pass = MeshInstance3D.new()
	style_pass.name = "MonochromeLineStyle"
	style_pass.mesh = quad
	style_pass.extra_cull_margin = 10000.0
	camera.add_child(style_pass)


func build_filter_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "FilterControls"
	add_child(layer)

	filter_label = Label.new()
	filter_label.position = Vector2(20.0, 16.0)
	filter_label.add_theme_color_override("font_color", Color("f4f2ed"))
	filter_label.add_theme_color_override("font_outline_color", Color("202327"))
	filter_label.add_theme_constant_override("outline_size", 6)
	filter_label.add_theme_font_size_override("font_size", 18)
	layer.add_child(filter_label)


func set_filter(index: int) -> void:
	if index < 0 or index >= FILTER_NAMES.size():
		return
	active_filter = index
	style_pass.material_override = FILTER_MATERIALS[index]
	style_pass.visible = index != 0
	if filter_label != null:
		var shortcuts: Array[String] = []
		for filter_index in FILTER_NAMES.size():
			shortcuts.append("%d %s" % [filter_index, FILTER_NAMES[filter_index]])
		filter_label.text = "当前滤镜：%s\n%s" % [FILTER_NAMES[index], "   ·   ".join(shortcuts)]


func _unhandled_key_input(event: InputEvent) -> void:
	if not event is InputEventKey:
		return
	var key_event := event as InputEventKey
	if not key_event.pressed or key_event.echo:
		return
	var index := FILTER_KEYS.find(key_event.keycode)
	if index < 0:
		index = FILTER_KEYS.find(key_event.physical_keycode)
	if index >= 0 and index < FILTER_NAMES.size():
		set_filter(index)


func add_asset(scene: PackedScene, node_name: String, position: Vector3, yaw: float) -> Node3D:
	var instance := scene.instantiate() as Node3D
	instance.name = node_name
	instance.position = position
	instance.rotation_degrees.y = yaw
	add_child(instance)
	return instance


func add_box(node_name: String, size: Vector3, position: Vector3, color: Color) -> MeshInstance3D:
	var box := BoxMesh.new()
	box.size = size
	box.material = get_material(color)

	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = box
	instance.position = position
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(instance)
	return instance


func get_material(color: Color) -> StandardMaterial3D:
	var key := color.to_html(false)
	if _materials.has(key):
		return _materials[key]

	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.92
	material.metallic = 0.0
	_materials[key] = material
	return material


func settle_frames(count: int) -> void:
	for _index in count:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw


func save_capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var output_directory := ProjectSettings.globalize_path("res://output")
	DirAccess.make_dir_recursive_absolute(output_directory)
	var output_path := output_directory.path_join(filename)
	var image := get_viewport().get_texture().get_image()
	var error := image.save_png(output_path)
	if error != OK:
		push_error("Could not save %s: %s" % [output_path, error_string(error)])
	else:
		print("WROTE_CAPTURE ", output_path)
