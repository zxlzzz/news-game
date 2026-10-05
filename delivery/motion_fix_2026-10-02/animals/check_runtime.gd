extends SceneTree

const Model = preload("res://npc/animal_model.gd")
const Animal = preload("res://npc/animal.gd")

func _initialize() -> void:
	var started := Time.get_ticks_msec()
	var output := {"breeds": {}}
	var args := OS.get_cmdline_user_args()
	var out: String = args[0]
	var settings: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[1]))
	var fps: float = settings.get("fps", 60.0)
	output.fps = fps
	output.inputs_before = _inputs(settings.breeds)
	for breed in settings.breeds:
		var m: Dictionary = Model.info(breed)
		if m.error != "":
			printerr(m.error)
			quit(1)
			return
		for scenario in settings.scenarios:
			var requested: String = scenario.get("action", "")
			if requested != "" and not requested in Model.config().species[m.species]:
				printerr("%s cannot %s" % [breed, requested])
				quit(1)
				return
		var info := {"names": m.names, "parent": m.parent, "gait": m.p, "drop": m.drop, "offset": [m.walk_offset.x, m.walk_offset.y, m.walk_offset.z], "scenarios": []}
		info.soles = {}
		for key in Model.LEGS:
			var points := []
			for influences in m.skin_feet[key]:
				var items := []
				for item in influences:
					var p: Vector3 = item[1]
					items.append([item[0], [p.x,p.y,p.z], item[2]])
				points.append(items)
			info.soles[key] = points
		for scenario in settings.scenarios:
			var frames := PackedFloat32Array()
			var states := []
			var s: Dictionary = Animal.create(Vector3.ZERO, 0, m)
			var previous := []
			var fastest := {"speed": 0.0}
			for k in int(scenario.seconds * fps):
				var t: float = float(k) / fps
				var action: String = scenario.get("action", "") if t >= scenario.get("begin", 2.0) and t < scenario.get("end", 10.0) else ""
				var base_speed: float = scenario.speed_fraction * m.p.motion.maxSpeed if scenario.has("speed_fraction") else scenario.speed
				var speed: float = base_speed if t < scenario.get("end", INF) else scenario.get("speed_after", base_speed)
				var urgent: bool = scenario.get("urgent_after", false) and t >= scenario.get("end", INF)
				for command in scenario.get("commands", []):
					if t >= command.time:
						action = command.get("action", action)
						speed = command.get("speed", speed)
						urgent = command.get("urgent", urgent)
				var ground := func(_p: Vector3) -> float: return 0.0
				s = Animal.step(s, {"speed": speed, "yaw": 0.0, "action": action, "urgent": urgent, "ground": ground}, 1.0 / fps, m)
				var pose: Dictionary = Model.pose(m, s)
				var world := []
				for bone in pose.globals:
					var x: Transform3D = pose.root * bone
					frames.append_array(PackedFloat32Array([x.basis.x.x,x.basis.x.y,x.basis.x.z,x.basis.y.x,x.basis.y.y,x.basis.y.z,x.basis.z.x,x.basis.z.y,x.basis.z.z,x.origin.x,x.origin.y,x.origin.z]))
					world.append(x.origin)
				if not previous.is_empty():
					for i in world.size():
						var bone_speed: float = world[i].distance_to(previous[i]) * fps
						if bone_speed > fastest.speed:
							fastest = {"speed": bone_speed, "time": t, "bone": m.names[i], "phase": s.phase_}
				previous = world
				var feet := {}
				for key in Model.LEGS:
					var p: Vector3 = s.feet[key].point
					feet[key] = {"point": [p.x,p.y,p.z], "swing": s.feet[key].swing}
				states.append({"time": t, "phase": s.phase_, "clip": s.clip, "clip_time": s.clip_time, "action": s.action,
					"weight": s.weight, "speed": s.actualSpeed, "cycle": s.phase, "feet": feet, "return_contacts": s.return_contacts,
					"inertia_weight": s.return_inertia,"projection_evaluations":s.return_projection_evaluations})
			var label: String = scenario.label
			var path: String = out + "/" + breed + "_" + label + ".f32"
			var file := FileAccess.open(path, FileAccess.WRITE)
			file.store_buffer(frames.to_byte_array())
			info.scenarios.append({"file": path, "label": label, "fastest": fastest, "states": states})
			print("RUNTIME_DUMP ", breed, " ", label, " ", states.size(), " frames")
		output.breeds[breed] = info
	var file := FileAccess.open(out + "/runtime.json", FileAccess.WRITE)
	output.inputs_after = _inputs(settings.breeds)
	file.store_string(JSON.stringify(output))
	print("RUNTIME_SECONDS ", float(Time.get_ticks_msec() - started) / 1000)
	if output.inputs_before != output.inputs_after:
		printerr("RUNTIME_INPUTS_CHANGED")
		quit(1)
	else:
		quit()

func _inputs(breeds: Array) -> Dictionary:
	var hashes := {}
	for path in ["res://npc/animal.gd", "res://npc/animal_model.gd", "res://npc/procedural_dog.gd",
		"res://npc/animal-models.json", "res://npc/dog-params.json"]:
		hashes[path] = FileAccess.get_sha256(path)
	for breed in breeds:
		var path: String = Model.config().breeds[breed].glb
		hashes[path] = FileAccess.get_sha256(path)
	return hashes
