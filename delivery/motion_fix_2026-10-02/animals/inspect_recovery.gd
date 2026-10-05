extends SceneTree
const Model = preload("res://npc/animal_model.gd")
const Animal = preload("res://npc/animal.gd")

func _initialize() -> void:
	var result := {"frames": []}
	if OS.get_cmdline_user_args().size()>1:
		Model.config().grounding.solePasses=int(OS.get_cmdline_user_args()[1])
	result.sole_passes=Model.config().grounding.solePasses
	if OS.get_cmdline_user_args().size()>4:
		Model.config().grounding.passes=int(OS.get_cmdline_user_args()[4])
	var requested: String = OS.get_cmdline_user_args()[2] if OS.get_cmdline_user_args().size()>2 else "scratch"
	var breeds: Array = OS.get_cmdline_user_args()[3].split(",") if OS.get_cmdline_user_args().size()>3 else ["husky","shibainu"]
	for breed in breeds:
		var m: Dictionary = Model.info(breed)
		for urgent in [false, true]:
			var s: Dictionary = Animal.create(Vector3.ZERO, 0, m)
			var ground = func(_p: Vector3) -> float: return 0.0
			for frame in 1300:
				var t: float = frame / 120.0
				s = Animal.step(s, {"speed": 0.35 if t < 10 or urgent else 0.0, "action": requested if t >= 2 and t < 10 else "", "yaw": 0.0, "ground": ground}, 1.0 / 120, m)
				if frame not in [1228,1229,1244,1251,1255,1259]:
					continue
				if s.phase_ != "return":
					continue
				var pose: Dictionary = Model.pose(m, s)
				var raw: Array = s.return_plan.globals
				var row := {"breed":breed,"urgent":urgent,"frame":frame,"time":t,"return_time":s.return_time,"root_raise":pose.root.origin.y-s.position.y,"return_air":s.return_air,"raw_low":_low(m,raw),"final_low":_low(m,pose.globals),"legs":{}}
				for key in Model.LEGS:
					var leg: Dictionary = m.legs[key]
					row.legs[key] = {"planned":_v(s.feet[key].point-s.position),"raw_sole":_v(Model.sole(m,raw,key)),"actual_sole":_v(Model.sole(m,pose.globals,key)),"raw_root":_v(raw[leg.ids[0]].origin),"actual_root":_v(pose.globals[leg.ids[0]].origin),"raw_wrist":_v(raw[leg.ids[2]].origin),"actual_wrist":_v(pose.globals[leg.ids[2]].origin),"limits":_v2(Model._reach_limits(m,s,key)),"path":s.return_feet[key]}
				result.frames.append(row)
	var f := FileAccess.open(OS.get_cmdline_user_args()[0],FileAccess.WRITE)
	f.store_string(JSON.stringify(result,"  "))
	quit()

func _low(m: Dictionary, g: Array) -> Dictionary:
	var lowest := INF
	var record := {}
	for influences in m.skin_all:
		var p := Vector3.ZERO
		var source := []
		for item in influences:
			p += (g[item[0]] * item[1]) * item[2]
			source.append({"bone":m.names[item[0]],"weight":item[2],"bind":_v(item[1])})
		if p.y < lowest:
			lowest=p.y
			record={"point":_v(p),"influences":source}
	return record

func _v(p: Vector3) -> Array:
	return [p.x,p.y,p.z]

func _v2(p: Vector2) -> Array:
	return [p.x,p.y]
