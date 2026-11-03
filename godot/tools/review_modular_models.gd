## Visual review of assembled model types; the shell alone is never the deliverable.
extends SceneTree
const Bounds = preload("res://core/bounds.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var input: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	DirAccess.make_dir_recursive_absolute(input.output)
	root.size = Vector2i(1280,640)
	var style := Level.new()
	style.palette = load("res://palettes/gray.tres")
	var views := []
	for side in 2:
		var viewport := SubViewport.new()
		viewport.size = Vector2i(640,590)
		viewport.own_world_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		viewport.msaa_3d = Viewport.MSAA_4X
		var container := SubViewportContainer.new()
		container.position = Vector2(side*640,50)
		container.add_child(viewport)
		root.add_child(container)
		var env := WorldEnvironment.new()
		env.environment = Environment.new()
		env.environment.background_mode = Environment.BG_COLOR
		env.environment.background_color = Color(.92,.92,.92)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.environment.ambient_light_energy = .6
		viewport.add_child(env)
		var light := DirectionalLight3D.new()
		light.rotation_degrees = Vector3(-35,-25,0)
		viewport.add_child(light)
		var camera := Camera3D.new()
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		viewport.add_child(camera)
		views.append({"viewport":viewport,"camera":camera})
	var label := Label.new()
	label.position = Vector2(15,8)
	label.add_theme_color_override("font_color",Color.BLACK)
	label.add_theme_font_size_override("font_size",22)
	root.add_child(label)
	for type_name in input.types:
		var instances := []
		for side in 2:
			var object: Node3D = load("res://types/"+type_name+".tscn").instantiate()
			views[side].viewport.add_child(object)
			style.apply_look_to({},object)
			instances.append(object)
			var box: AABB = Bounds.of_node(object)
			var centre := box.get_center()
			var extent := maxf(box.size.x,maxf(box.size.y,box.size.z))
			views[side].camera.size = extent*1.2
			views[side].camera.position = centre+([Vector3(.18,.15,1),Vector3(1,.15,.08)][side])*extent*2
			views[side].camera.look_at(centre)
		label.text = type_name+"    front / side    assembled parts"
		for warmup in 5:
			await process_frame
			await RenderingServer.frame_post_draw
		var error := root.get_texture().get_image().save_png(input.output.path_join(type_name+".png"))
		assert(error == OK,"Failed to save model review: "+type_name)
		if type_name=="window_single":
			for object in instances:
				object.set_process(false)
				object.hinge.rotation.y=deg_to_rad(object.config.open_degrees)
			for warmup in 3:
				await process_frame
				await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(input.output.path_join("window_single_open.png"))
		for object in instances: object.free()
		print("ASSEMBLY_RENDERED ",type_name)
	style.free()
	quit()
