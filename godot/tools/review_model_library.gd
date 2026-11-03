## Render the complete library, including assembled buildings, without editing a scene.
extends SceneTree
const Bounds = preload("res://core/bounds.gd")
const DIRECTIONS = [Vector3(0,.24,1), Vector3(1,.24,0), Vector3(-.7,.7,-1)]
var review_directions: Array[Vector3] = []
var view_width := 512
var view_height := 470
var focus_nodes: Array[String] = []
var view_padding := 1.12

func _initialize() -> void:
	call_deferred("run")

func freeze(n: Node) -> void:
	n.set_process(false)
	n.set_physics_process(false)
	for c in n.get_children(): freeze(c)

func animal_material(n: Node) -> void:
	if n is MeshInstance3D:
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(.16,.16,.16)
		m.roughness = .9
		n.material_override = m
	for c in n.get_children(): animal_material(c)

func fit_camera(object: Node3D, camera: Camera3D, side: int) -> bool:
	var box: AABB = Bounds.of_node(object)
	for focus_index in focus_nodes.size():
		var subject := object.get_node_or_null(focus_nodes[focus_index]) as Node3D
		if subject == null:
			push_error("Missing requested model focus: "+focus_nodes[focus_index])
			quit(1)
			return false
		var region: AABB = subject.get_parent().global_transform * Bounds.of_node(subject)
		box = region if focus_index == 0 else box.merge(region)
	var centre := box.get_center()
	var extent := maxf(box.size.x,maxf(box.size.y,box.size.z))
	camera.position = centre+review_directions[side].normalized()*extent*3
	camera.look_at(centre)
	var width := 0.0
	var height := 0.0
	for x in [0,1]:
		for y in [0,1]:
			for z in [0,1]:
				var p := box.position+box.size*Vector3(x,y,z)-centre
				width = maxf(width,absf(p.dot(camera.basis.x))*2)
				height = maxf(height,absf(p.dot(camera.basis.y))*2)
	camera.size = maxf(height,width*float(view_height)/float(view_width))*view_padding
	return true

func run() -> void:
	var input: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	for model_name in input.models:
		if not ResourceLoader.exists("res://types/"+model_name+".tscn") and not ResourceLoader.exists("res://models/"+model_name+".glb"):
			push_error("Missing requested model: "+model_name)
			quit(1)
			return
	view_width = int(input.get("view_width",512))
	view_height = int(input.get("view_height",470))
	view_padding = float(input.get("view_padding",1.12))
	assert(view_width > 0 and view_height > 0,"Invalid review image dimensions")
	assert(view_padding >= 1.0,"Review padding cannot crop the requested subject")
	for direction in input.get("directions",[]):
		assert(direction.size() == 3,"Review direction requires three coordinates")
		var vector := Vector3(float(direction[0]),float(direction[1]),float(direction[2]))
		assert(vector.length_squared() > 0,"Review direction cannot be zero")
		review_directions.append(vector)
	if review_directions.is_empty(): review_directions.assign(DIRECTIONS)
	DirAccess.make_dir_recursive_absolute(input.output)
	root.size = Vector2i(view_width*review_directions.size(),view_height+50)
	var style := Level.new()
	style.palette = load("res://palettes/gray.tres")
	var views := []
	for side in review_directions.size():
		var viewport := SubViewport.new()
		viewport.size = Vector2i(view_width,view_height)
		viewport.own_world_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		viewport.msaa_3d = Viewport.MSAA_4X
		var container := SubViewportContainer.new()
		container.position = Vector2(side*view_width,50)
		container.add_child(viewport)
		root.add_child(container)
		var env := WorldEnvironment.new()
		env.environment = Environment.new()
		env.environment.background_mode = Environment.BG_COLOR
		env.environment.background_color = Color(.92,.92,.92)
		env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.environment.ambient_light_color = Color.WHITE
		env.environment.ambient_light_energy = .7
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
	label.add_theme_font_size_override("font_size",21)
	root.add_child(label)
	for model_name in input.models:
		var path: String = "res://types/"+model_name+".tscn"
		focus_nodes.clear()
		var requested_focus: Variant = input.get("focus_nodes",{}).get(model_name,[])
		if requested_focus is String:
			if not requested_focus.is_empty(): focus_nodes.append(requested_focus)
		else:
			assert(requested_focus is Array,"Model focus requires a node path or an array of paths")
			for path_to_focus in requested_focus:
				assert(path_to_focus is String and not path_to_focus.is_empty(),"Invalid focus node path")
				focus_nodes.append(path_to_focus)
		var assembled := ResourceLoader.exists(path)
		if not assembled: path = "res://models/"+model_name+".glb"
		var instances := []
		for side in review_directions.size():
			var object: Node3D = load(path).instantiate()
			views[side].viewport.add_child(object)
			freeze(object)
			if model_name.begins_with("animal_"): animal_material(object)
			else: style.apply_look_to({},object)
			instances.append(object)
			if not fit_camera(object,views[side].camera,side): return
		label.text = model_name+"   | requested views | "+("assembled type" if assembled else "GLB")
		for warmup in 4:
			await process_frame
			await RenderingServer.frame_post_draw
		var error := root.get_texture().get_image().save_png(input.output.path_join(model_name+".png"))
		assert(error == OK,"Failed to save model review: "+model_name)
		var moving_parts := preload("res://props/model_parts.gd").parts(instances[0])
		if not moving_parts.is_empty():
			for phase in input.get("model_part_phases",[]):
				assert(float(phase) >= 0.0 and float(phase) <= 100.0,"Part phase outside 0..100")
				for object in instances:
					for part in preload("res://props/model_parts.gd").parts(object):
						preload("res://props/model_parts.gd").set_ratio(part,float(phase)/100.0)
				for side in review_directions.size():
					if not fit_camera(instances[side],views[side].camera,side): return
				for warmup in 2:
					await process_frame
					await RenderingServer.frame_post_draw
				var phase_error := root.get_texture().get_image().save_png(input.output.path_join(model_name+"__parts_"+str(phase)+".png"))
				assert(phase_error == OK,"Failed to save articulated model review: "+model_name)
		var openable := []
		if input.get("open_windows",false) and model_name.begins_with("window_") and instances[0].has_method("set_open"):
			openable.append(instances[0])
		if input.get("open_building_windows",false) and model_name.begins_with("building_"):
			for node in instances[0].find_children("*","Node3D",true,false):
				if node.scene_file_path.begins_with("res://types/window_") and node.has_method("set_open"):
					openable.append(node)
		if not openable.is_empty():
			for object in instances:
				var windows: Array = [object] if model_name.begins_with("window_") else object.find_children("*","Node3D",true,false)
				for window in windows:
					if window.has_method("set_open") and (window == object or window.scene_file_path.begins_with("res://types/window_")):
						window.set_open(true)
						window._process(window.config.travel_seconds)
			for side in review_directions.size():
				if not fit_camera(instances[side],views[side].camera,side): return
			for warmup in 2:
				await process_frame
				await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(input.output.path_join(model_name+"_open.png"))
		if model_name == "door_single" or (input.get("open_building_doors",false) and model_name.begins_with("building_")):
			var has_doors := false
			for phase in [0.5,1.0]:
				for object in instances:
					var candidates: Array = [object] if model_name == "door_single" else object.find_children("*","Node3D",true,false)
					for door in candidates:
						if door.get_script() != null and door.get_script().resource_path == "res://props/door_single.gd":
							has_doors = true
							door.set_open(true)
							door.open_ratio = phase
							door._apply_pose()
				if not has_doors: break
				for side in review_directions.size():
					if not fit_camera(instances[side],views[side].camera,side): return
				for warmup in 2:
					await process_frame
					await RenderingServer.frame_post_draw
				var door_error := root.get_texture().get_image().save_png(input.output.path_join(model_name+"__doors_"+str(roundi(phase*100))+".png"))
				assert(door_error == OK,"Failed to save installed door review: "+model_name)
		for object in instances: object.free()
		print("MODEL_RENDERED ",model_name)
	style.free()
	for child in root.get_children(): child.queue_free()
	await process_frame
	await process_frame
	quit()
