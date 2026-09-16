extends Node3D

const BUILDING_SCENE: PackedScene = preload("res://assets/Building_Small_1.glb")
const TREE_SCENE: PackedScene = preload("res://assets/CommonTree_1.glb")
const OUTLINE_SHADER: Shader = preload("res://grayscale_outline.gdshader")

var sun: DirectionalLight3D


func _ready() -> void:
	build_scene()
	await settle_frames(18)
	await save_capture("with_shadows.png")
	sun.shadow_enabled = false
	await settle_frames(10)
	await save_capture("without_shadows.png")
	print("STYLE_SPIKE_DONE")
	get_tree().quit()


func build_scene() -> void:
	var building := BUILDING_SCENE.instantiate()
	building.name = "BuildingSmall"
	add_child(building)

	var tree := TREE_SCENE.instantiate()
	tree.name = "CommonTree"
	tree.position = Vector3(10.0, 0.0, 4.5)
	add_child(tree)

	var floor_mesh := BoxMesh.new()
	floor_mesh.size = Vector3(160.0, 0.2, 160.0)
	var floor_material := StandardMaterial3D.new()
	floor_material.albedo_color = Color(0.68, 0.68, 0.68)
	floor_material.roughness = 1.0
	floor_mesh.material = floor_material
	var floor_instance := MeshInstance3D.new()
	floor_instance.name = "Ground"
	floor_instance.mesh = floor_mesh
	floor_instance.position = Vector3(0.0, -0.11, 1.0)
	add_child(floor_instance)

	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.86, 0.86, 0.86)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.82, 0.82, 0.82)
	environment.ambient_light_energy = 0.62
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	var world_environment := WorldEnvironment.new()
	world_environment.environment = environment
	add_child(world_environment)

	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-52.0, -38.0, 0.0)
	sun.light_color = Color(1.0, 1.0, 1.0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0
	add_child(sun)

	var camera := Camera3D.new()
	camera.name = "Camera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 30.0
	camera.near = 0.1
	camera.far = 180.0
	camera.position = Vector3(29.0, 24.0, 31.0)
	camera.look_at_from_position(camera.position, Vector3(0.0, 7.0, 0.0), Vector3.UP)
	camera.current = true
	add_child(camera)

	var outline_material := ShaderMaterial.new()
	outline_material.shader = OUTLINE_SHADER
	outline_material.set_shader_parameter("edge_colour", Color(0.075, 0.075, 0.075))
	outline_material.set_shader_parameter("edge_width", 2.0)
	outline_material.set_shader_parameter("depth_edge_threshold", 0.05)
	outline_material.set_shader_parameter("max_dist", 150.0)
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	quad.flip_faces = true
	var post_process := MeshInstance3D.new()
	post_process.name = "GrayscaleOutline"
	post_process.mesh = quad
	post_process.material_override = outline_material
	post_process.extra_cull_margin = 10000.0
	camera.add_child(post_process)


func settle_frames(count: int) -> void:
	for _index in count:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw


func save_capture(filename: String) -> void:
	await RenderingServer.frame_post_draw
	var directory := ProjectSettings.globalize_path("res://output")
	DirAccess.make_dir_recursive_absolute(directory)
	var path := directory.path_join(filename)
	var image := get_viewport().get_texture().get_image()
	var error := image.save_png(path)
	if error != OK:
		push_error("Could not save %s: %s" % [path, error_string(error)])
	else:
		print("WROTE_CAPTURE ", path)
