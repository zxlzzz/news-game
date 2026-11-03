## Export the actual assembled type geometry for offline intersection review.
extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func freeze(node: Node) -> void:
	node.set_process(false)
	node.set_physics_process(false)
	for child in node.get_children(): freeze(child)

func collect(node: Node, owner: Node3D, stream: FileAccess, parts: Array) -> void:
	assert(node.is_inside_tree(),"Detached/duplicated node in model: "+node.name)
	if node is MeshInstance3D and node.mesh != null:
		node.force_update_transform()
		for surface in node.mesh.get_surface_count():
			if node.mesh.surface_get_primitive_type(surface) != Mesh.PRIMITIVE_TRIANGLES: continue
			var arrays: Array = node.mesh.surface_get_arrays(surface)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			if indices.is_empty():
				for index in vertices.size(): indices.append(index)
			var world := PackedFloat32Array()
			for vertex in vertices:
				var point: Vector3 = node.global_transform * vertex
				world.append_array([point.x,point.y,point.z])
			var material: Material = node.mesh.surface_get_material(surface)
			parts.append({"name":str(owner.get_path_to(node)),"surface":surface,
				"slot":material.resource_name if material != null else "",
				"offset":stream.get_position(),"vertices":vertices.size(),"indices":indices.size()})
			stream.store_buffer(world.to_byte_array())
			stream.store_buffer(indices.to_byte_array())
	for child in node.get_children(): collect(child,owner,stream,parts)

func save_geometry(object: Node3D, output: String, model_name: String, assembled: bool) -> void:
	var stream := FileAccess.open(output.path_join(model_name+".bin"),FileAccess.WRITE)
	assert(stream != null,"Cannot export geometry: "+model_name)
	var parts: Array = []
	collect(object,object,stream,parts)
	stream.close()
	var meta := FileAccess.open(output.path_join(model_name+".json"),FileAccess.WRITE)
	var joints: Array = []
	window_joints(object,object,joints)
	var doors: Array = []
	door_joints(object,object,doors)
	meta.store_string(JSON.stringify({"name":model_name,"assembled":assembled,"parts":parts,"joints":joints,"door_joints":doors}))
	meta.close()

func door_joints(node: Node, owner: Node3D, joints: Array) -> void:
	if node.has_method("set_open") and node.get("hinge") != null and node.hinge.name == "Hinge":
		var point: Vector3 = node.hinge.global_position
		joints.append({"name":str(owner.get_path_to(node.hinge)),
			"pivot":[point.x,point.y,point.z],"model":node.scene_file_path.get_file().get_basename(),
			"open_degrees":node.config.open_degrees})
	for child in node.get_children(): door_joints(child,owner,joints)

func window_joints(node: Node, owner: Node3D, joints: Array) -> void:
	if node.has_method("set_open") and node.get("hinge") != null and node.hinge.name == "SashHinge":
		var hinges: Array = node.window_hinges
		var motions: Array = node.window_motions
		assert(not hinges.is_empty() and hinges.size() == motions.size(),"Incomplete window joint metadata: "+str(node.get_path()))
		for index in hinges.size():
			var joint: Node3D = hinges[index]
			var motion: Dictionary = motions[index]
			var local_axis := Vector3(float(motion.axis[0]),float(motion.axis[1]),float(motion.axis[2]))
			assert(local_axis.length_squared() > 0.0,"Window joint has no rotation axis: "+joint.name)
			var axis: Vector3 = (joint.global_basis * local_axis.normalized()).normalized()
			var point: Vector3 = joint.global_position
			var degrees: float = float(motion.degrees[1])
			joints.append({"name":str(owner.get_path_to(joint)),"joint_name":str(joint.name),
				"window":str(owner.get_path_to(node)),"pivot":[point.x,point.y,point.z],
				"axis":[axis.x,axis.y,axis.z],"model":node.scene_file_path.get_file().get_basename(),
				"degrees":motion.degrees,"end_degrees":degrees,"open_degrees":degrees})
	for child in node.get_children(): window_joints(child,owner,joints)

func open_windows(node: Node, phase: float) -> int:
	var count := 0
	if node.has_method("set_open") and node.get("open_ratio") != null and node.get("hinge") != null and node.hinge.name == "SashHinge":
		node.set_open(true)
		node.open_ratio = phase / 100.0
		node._apply_pose()
		count += 1
	for child in node.get_children(): count += open_windows(child,phase)
	return count

func open_doors(node: Node, phase: float) -> int:
	var count := 0
	if node.has_method("set_open") and node.get("hinge") != null and node.hinge.name == "Hinge":
		node.open_ratio = phase / 100.0
		node._apply_pose()
		count += 1
	for child in node.get_children(): count += open_doors(child,phase)
	return count

func run() -> void:
	var request: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OS.get_cmdline_user_args()[0]))
	DirAccess.make_dir_recursive_absolute(request.output)
	for model_name in request.models:
		var path: String = "res://types/"+model_name+".tscn"
		var assembled := ResourceLoader.exists(path)
		if not assembled: path = "res://models/"+model_name+".glb"
		var object: Node3D = load(path).instantiate()
		root.add_child(object)
		freeze(object)
		save_geometry(object,request.output,model_name,assembled)
		if model_name.begins_with("window_") or request.get("assembled_window_phases",false):
			for phase in request.get("window_phases",[]):
				if open_windows(object,float(phase)) > 0:
					save_geometry(object,request.output,model_name+"__open_"+str(phase),assembled)
		if model_name == "door_single" or request.get("assembled_door_phases",false):
			for phase in request.get("door_phases",[]):
				if open_doors(object,float(phase)) > 0:
					save_geometry(object,request.output,model_name+"__door_open_"+str(phase),assembled)
		var moving_parts: Array = preload("res://props/model_parts.gd").parts(object)
		if not moving_parts.is_empty():
			for phase in request.get("model_part_phases",[]):
				for part in moving_parts:
					preload("res://props/model_parts.gd").set_ratio(part,float(phase)/100.0)
				save_geometry(object,request.output,model_name+"__parts_"+str(phase),assembled)
		object.free()
	print("MODEL_GEOMETRY_EXPORTED ",request.models.size())
	quit()
