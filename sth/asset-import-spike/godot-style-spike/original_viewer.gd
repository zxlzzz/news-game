extends Node3D

const ORIGINAL_MODEL: PackedScene = preload("res://original_model/Building_Small_1.gltf")
const CONVERTED_MODEL: PackedScene = preload("res://assets/Building_Small_1.glb")
const OUTLINE_SHADER: Shader = preload("res://grayscale_outline.gdshader")

var pivot: Node3D
var camera: Camera3D
var model_height := 17.0
var rotation_enabled := true
var source_mode := "original"
var render_mode := "raw"
var external_glb_path := ""


func _ready() -> void:
	var user_args := OS.get_cmdline_user_args()
	if "--converted" in user_args:
		source_mode = "converted"
	if "--gray" in user_args:
		source_mode = "converted"
		render_mode = "gray"
	if "--outline" in user_args:
		source_mode = "converted"
		render_mode = "outline"
	if "--continuous" in user_args:
		source_mode = "converted"
		render_mode = "continuous"
	if "--neutral-gray" in user_args:
		source_mode = "converted"
		render_mode = "neutral_gray"
	if "--neutral-outline" in user_args:
		source_mode = "converted"
		render_mode = "neutral_outline"
	var external_index := user_args.find("--external-glb")
	if external_index >= 0 and external_index + 1 < user_args.size():
		source_mode = "baked_gray"
		render_mode = "raw"
		external_glb_path = user_args[external_index + 1]
	get_window().title = (
		"Baked grayscale GLB - raw Godot PBR"
		if source_mode == "baked_gray"
		else "Neutral continuous grayscale plus outlines - converted GLB"
		if render_mode == "neutral_outline"
		else "Neutral continuous grayscale - converted GLB - no outlines"
		if render_mode == "neutral_gray"
		else "Compressed continuous grayscale - converted GLB - no outlines"
		if render_mode == "continuous"
		else "Grayscale plus outlines - converted GLB"
		if render_mode == "outline"
		else "Grayscale only - converted GLB - no outlines"
		if render_mode == "gray"
		else (
			"Blender-converted GLB - raw Godot PBR"
			if source_mode == "converted"
			else "Original Quaternius glTF - raw Godot PBR"
		)
	)
	build_original_model_viewer()
	if "--capture" in user_args:
		await save_diagnostic_capture()
		get_tree().quit()


func _process(delta: float) -> void:
	if rotation_enabled:
		pivot.rotate_y(delta * 0.13)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_accept"):
		rotation_enabled = not rotation_enabled
	elif event is InputEventKey and event.pressed and event.keycode == KEY_R:
		pivot.rotation.y = 0.0


func build_original_model_viewer() -> void:
	pivot = Node3D.new()
	pivot.name = "Turntable"
	add_child(pivot)

	var model := instantiate_source_model()
	model.name = (
		"BakedGrayBuildingSmall1"
		if source_mode == "baked_gray"
		else "ConvertedBuildingSmall1"
		if source_mode == "converted"
		else "OriginalBuildingSmall1"
	)
	pivot.add_child(model)

	var bounds := calculate_mesh_bounds(model)
	var center := (bounds.position + bounds.end) * 0.5
	model_height = bounds.size.y
	model.position = Vector3(-center.x, -bounds.position.y, -center.z)

	add_floor(maxf(bounds.size.x, bounds.size.z) * 2.8)
	add_environment()
	add_lighting()
	add_camera(bounds.size)
	if render_mode in ["gray", "outline", "continuous", "neutral_gray", "neutral_outline"]:
		add_post_process(
			1.0 if render_mode in ["outline", "neutral_outline"] else 0.0,
			0.0 if render_mode in ["continuous", "neutral_gray", "neutral_outline"] else 5.0,
			0.0 if render_mode in ["neutral_gray", "neutral_outline"] else 0.30,
			1.0 if render_mode in ["neutral_gray", "neutral_outline"] else 0.88
		)
	add_overlay()


func instantiate_source_model() -> Node3D:
	if source_mode != "baked_gray":
		var source_scene := CONVERTED_MODEL if source_mode == "converted" else ORIGINAL_MODEL
		return source_scene.instantiate() as Node3D
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_file(external_glb_path, state)
	if error != OK:
		push_error("Could not load external GLB %s: %s" % [external_glb_path, error_string(error)])
		return Node3D.new()
	var generated := document.generate_scene(state)
	if generated == null:
		push_error("Godot could parse but not instantiate external GLB: %s" % external_glb_path)
		return Node3D.new()
	print("GODOT_GLTF_OK ", external_glb_path)
	return generated as Node3D


func calculate_mesh_bounds(root: Node3D) -> AABB:
	var mesh_nodes: Array[MeshInstance3D] = []
	collect_mesh_nodes(root, mesh_nodes)
	var minimum := Vector3(INF, INF, INF)
	var maximum := Vector3(-INF, -INF, -INF)
	for mesh_node in mesh_nodes:
		if mesh_node.mesh == null:
			continue
		var local_bounds := mesh_node.mesh.get_aabb()
		for x_index in 2:
			for y_index in 2:
				for z_index in 2:
					var corner := local_bounds.position + Vector3(
						local_bounds.size.x * x_index,
						local_bounds.size.y * y_index,
						local_bounds.size.z * z_index
					)
					var point := root.to_local(mesh_node.to_global(corner))
					minimum = minimum.min(point)
					maximum = maximum.max(point)
	return AABB(minimum, maximum - minimum)


func collect_mesh_nodes(node: Node, output: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		output.append(node)
	for child in node.get_children():
		collect_mesh_nodes(child, output)


func add_floor(span: float) -> void:
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(span, span)
	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color(0.42, 0.44, 0.46)
	floor_material.roughness = 0.9
	floor_mesh.material = floor_material
	var floor_instance := MeshInstance3D.new()
	floor_instance.name = "NeutralFloor"
	floor_instance.mesh = floor_mesh
	floor_instance.position.y = -0.015
	add_child(floor_instance)


func add_environment() -> void:
	var sky_material := ProceduralSkyMaterial.new()
	if source_mode == "baked_gray":
		sky_material.sky_top_color = Color(0.22, 0.22, 0.22)
		sky_material.sky_horizon_color = Color(0.78, 0.78, 0.78)
		sky_material.ground_bottom_color = Color(0.19, 0.19, 0.19)
		sky_material.ground_horizon_color = Color(0.56, 0.56, 0.56)
	else:
		sky_material.sky_top_color = Color(0.16, 0.22, 0.31)
		sky_material.sky_horizon_color = Color(0.72, 0.77, 0.82)
		sky_material.ground_bottom_color = Color(0.18, 0.19, 0.20)
		sky_material.ground_horizon_color = Color(0.54, 0.56, 0.58)
	var sky := Sky.new()
	sky.sky_material = sky_material

	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = 0.7
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)


func add_lighting() -> void:
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-48.0, -32.0, 0.0)
	sun.light_color = Color.WHITE if source_mode == "baked_gray" else Color(1.0, 0.93, 0.84)
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 100.0
	add_child(sun)


func add_camera(model_size: Vector3) -> void:
	camera = Camera3D.new()
	camera.name = "InspectionCamera"
	camera.projection = Camera3D.PROJECTION_PERSPECTIVE
	camera.fov = 34.0
	camera.near = 0.1
	camera.far = 250.0
	var radius := maxf(model_size.x, model_size.z)
	var distance := maxf(model_height * 1.35, radius * 2.2)
	var target := Vector3(0.0, model_height * 0.46, 0.0)
	camera.position = Vector3(distance * 0.76, model_height * 0.72, distance)
	camera.look_at_from_position(camera.position, target, Vector3.UP)
	camera.current = true
	add_child(camera)


func add_post_process(
	outline_strength: float,
	tone_steps: float,
	gray_min: float,
	gray_max: float
) -> void:
	var material := ShaderMaterial.new()
	material.shader = OUTLINE_SHADER
	material.set_shader_parameter("edge_colour", Color(0.075, 0.075, 0.075))
	material.set_shader_parameter("edge_width", 2.0)
	material.set_shader_parameter("depth_edge_threshold", 0.05)
	material.set_shader_parameter("max_dist", 150.0)
	material.set_shader_parameter("outline_strength", outline_strength)
	material.set_shader_parameter("tone_steps", tone_steps)
	material.set_shader_parameter("gray_min", gray_min)
	material.set_shader_parameter("gray_max", gray_max)
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	quad.flip_faces = true
	var post_process := MeshInstance3D.new()
	post_process.name = "GrayscalePostProcess"
	post_process.mesh = quad
	post_process.material_override = material
	post_process.extra_cull_margin = 10000.0
	camera.add_child(post_process)


func add_overlay() -> void:
	var panel := ColorRect.new()
	panel.color = Color(0.02, 0.02, 0.025, 0.76)
	panel.position = Vector2(20.0, 20.0)
	panel.size = Vector2(560.0, 74.0)
	var label := Label.new()
	label.position = Vector2(16.0, 11.0)
	label.text = (
		"H: BAKED GRAYSCALE GLB\nFinal standalone asset | raw Godot PBR | no screen-space grayscale"
		if source_mode == "baked_gray"
		else "G: NEUTRAL GRAYSCALE + DEPTH OUTLINES\nConverted GLB | full 0-1 range | no quantization | 2 px depth outlines"
		if render_mode == "neutral_outline"
		else "F: NEUTRAL CONTINUOUS GRAYSCALE\nConverted GLB | full 0-1 luminance range | no quantization | no outlines"
		if render_mode == "neutral_gray"
		else "E: COMPRESSED CONTINUOUS GRAYSCALE\nConverted GLB | 0.30-0.88 range | no tone quantization | no outlines"
		if render_mode == "continuous"
		else "D: GRAYSCALE + DEPTH OUTLINES\nConverted GLB | five-tone grayscale | 2 px depth-discontinuity outlines"
		if render_mode == "outline"
		else "C: GRAYSCALE ONLY\nConverted GLB | five-tone grayscale | outlines completely disabled"
		if render_mode == "gray"
		else (
			"B: BLENDER-CONVERTED COPY\nRe-exported GLB | raw PBR | no grayscale | no outline/post-process"
			if source_mode == "converted"
			else "A: ORIGINAL SOURCE MODEL\nDirect glTF + original PBR textures | no Blender | no outline/post-process"
		)
	)
	label.add_theme_font_size_override("font_size", 18)
	label.add_theme_color_override("font_color", Color(0.96, 0.96, 0.96))
	panel.add_child(label)
	var hint := Label.new()
	hint.position = Vector2(20.0, 106.0)
	hint.text = "Slow auto-rotation  |  Space: pause  |  R: reset angle"
	hint.add_theme_font_size_override("font_size", 16)
	hint.add_theme_color_override("font_color", Color(0.95, 0.95, 0.95))
	add_child(panel)
	add_child(hint)


func save_diagnostic_capture() -> void:
	for _frame in 24:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var directory := ProjectSettings.globalize_path("res://output")
	DirAccess.make_dir_recursive_absolute(directory)
	var filename := "diagnostic_%s_%s.png" % [source_mode, render_mode]
	var path := directory.path_join(filename)
	var image := get_viewport().get_texture().get_image()
	var error := image.save_png(path)
	if error != OK:
		push_error("Could not save %s: %s" % [path, error_string(error)])
	else:
		print("WROTE_CAPTURE ", path)
