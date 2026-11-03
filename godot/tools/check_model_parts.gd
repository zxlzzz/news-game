## Exercise actual model-page controls, seeking and articulated mesh transforms.
extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func _check(condition: bool, message: String) -> void:
	if not condition:
		push_error(message)
		quit(1)
		assert(condition,message)

func _owned_meshes(driver: Node3D, drivers: Array) -> Array[Node3D]:
	var candidates: Array = driver.find_children("*","MeshInstance3D",true,false)
	if driver is MeshInstance3D: candidates.push_front(driver)
	var result: Array[Node3D] = []
	for mesh in candidates:
		if mesh.mesh == null: continue
		var parent: Node = mesh
		while parent != driver and parent not in drivers: parent = parent.get_parent()
		if parent == driver: result.append(mesh)
	return result

func _mesh_pose(meshes: Array) -> Array[Transform3D]:
	var result: Array[Transform3D] = []
	for mesh in meshes:
		mesh.node.force_update_transform()
		result.append(mesh.node.global_transform)
	return result

func _check_mesh_pose(meshes: Array, reference: Array, moved: bool, context: String) -> void:
	var pose := _mesh_pose(meshes)
	for index in meshes.size():
		_check(pose[index].is_equal_approx(reference[index]) != moved,
			"Mesh pose incorrect: "+context+"/"+str(meshes[index].node.name))
		var expected: Transform3D = meshes[index].driver.global_transform * meshes[index].binding
		_check(pose[index].is_equal_approx(expected),
			"Mesh detached from its driver: "+context+"/"+str(meshes[index].node.name))

func run() -> void:
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	_check(level.is_processing() and level.can_process(),"Model page disables its playback update")
	# Drive the level clock with known positive deltas, independent of loading
	# stalls. Its children still receive real frames during the pause check.
	level.set_process(false)
	await process_frame
	level.ui.tabs.current_tab = 1
	_check(level._models,"Model tab did not select its model list")
	level.playing = false
	var total := 0
	var articulated := 0
	var mesh_total := 0
	for entry in level.stage.entries:
		if entry.kind != "model": continue
		level._select(entry.id,{},true)
		_check(level.stage.error == "",level.stage.error)
		var model: Node3D = level.stage.objects.filter(func(object): return not object.manual)[0].node
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = true
		click.position = level.cam.unproject_position(level.stage.Bounds.of_node(model).get_center())
		level._on_input(click)
		_check(level._grab.is_empty(),"Model-page click captured an editable asset")
		total += 1
		if level.stage.cycle == 0.0:
			_check(not level.ui.play.get_parent().visible,"Static model exposes playback")
			continue
		articulated += 1
		_check(level.ui.play.get_parent().visible and level.ui.slider.visible,"Part controls are hidden")
		_check(not level.ui.item.get_parent().visible,"Model page exposes actor controls")
		var drivers: Array = level.stage.model_parts.duplicate()
		for joint in level.stage.model_joints:
			if joint.get("window_hinges") != null: drivers.append_array(joint.window_hinges)
			else: drivers.append(joint.hinge)
		var start: Array = []
		for driver in drivers: start.append(driver.transform)
		_check(not drivers.is_empty(),"Articulated model has no drivers: "+entry.id)
		var meshes: Array = []
		for driver in drivers:
			var owned := _owned_meshes(driver,drivers)
			_check(not owned.is_empty(),"Empty moving pivot: "+entry.id+"/"+str(driver.name))
			for mesh in owned:
				meshes.append({"node":mesh,"driver":driver,
					"binding":driver.global_transform.affine_inverse()*mesh.global_transform})
		mesh_total += meshes.size()
		var start_meshes := _mesh_pose(meshes)
		level.ui.play.pressed.emit()
		_check(level.playing,"Playback button did not start")
		var before_play: float = level.stage.t
		level._process(level.stage.cycle*0.1)
		await process_frame
		await process_frame
		_check(level.stage.t > before_play,"Playback did not advance time: "+entry.id)
		_check_mesh_pose(meshes,start_meshes,true,entry.id+" playback")
		level.ui.play.pressed.emit()
		_check(not level.playing,"Pause button did not stop: "+entry.id)
		level.ui.slider.value = level.stage.cycle * 0.5
		for index in drivers.size():
			_check(not drivers[index].transform.is_equal_approx(start[index]),"Part did not move: "+entry.id+"/"+str(drivers[index].name))
		_check_mesh_pose(meshes,start_meshes,true,entry.id+" half seek")
		var paused_time: float = level.stage.t
		var paused_meshes := _mesh_pose(meshes)
		# A half-open leaf must remain still across real frames. A window's own
		# process callback closing it behind the preview controls fails here.
		await create_timer(0.03).timeout
		await process_frame
		_check(is_equal_approx(level.stage.t,paused_time),"Paused time advanced: "+entry.id)
		_check_mesh_pose(meshes,paused_meshes,false,entry.id+" paused half seek")
		level.ui.play.pressed.emit()
		_check(level.playing and is_equal_approx(level.stage.t,paused_time),"Resume reset the seek pose: "+entry.id)
		level._process(level.stage.cycle*0.1)
		_check(level.stage.t > paused_time,"Resume did not advance: "+entry.id)
		_check_mesh_pose(meshes,paused_meshes,true,entry.id+" resume")
		level.ui.slider.value = level.stage.cycle
		level._process(0.0)
		_check(not level.playing,"Model playback did not hold its endpoint")
		level.ui.play.pressed.emit()
		_check(level.playing and level.stage.t == 0.0,"Replay did not return to the start")
		_check_mesh_pose(meshes,start_meshes,false,entry.id+" replay start")
		level.ui.play.pressed.emit()
		_check(not level.playing,"Pause button did not stop replay: "+entry.id)
		level.ui.slider.value = level.stage.cycle * 0.25
		level.ui.slider.value = 0.0
		for index in drivers.size():
			_check(drivers[index].transform.is_equal_approx(start[index]),"Seeking did not restore the initial pose: "+entry.id)
		_check_mesh_pose(meshes,start_meshes,false,entry.id+" seek start")
		await process_frame
	print("MODEL_PARTS_OK ",total," models; ",articulated," articulated previews; ",mesh_total," moving meshes")
	quit()
