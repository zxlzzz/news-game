extends SceneTree
const Model = preload("res://npc/animal_model.gd")
const Animal = preload("res://npc/animal.gd")
func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var breed: String = args[0]
	var action: String = args[1]
	var fraction: float = float(args[2])
	var fps: float = float(args[3])
	var m: Dictionary = Model.info(breed)
	var stage: String = args[5] if args.size()>5 else "hold"
	var specification: Dictionary = Model.config().actions[action]
	var clip: String = args[6] if args.size()>6 else (specification.hold if stage=="hold" else specification[stage][0])
	var s: Dictionary = Animal.create(Vector3.ZERO,0,m)
	var ground = func(_p:Vector3)->float:return 0.0
	var stop := false
	for frame in int(20*fps):
		if stage=="out" and s.clip_loop:stop=true
		s=Animal.step(s,{"speed":0.0,"action":"" if stop else action,"yaw":0.0,"ground":ground},1.0/fps,m)
		if s.clip==clip and (stage!="out" or s.phase_=="out"):break
	for frame in int(m.clips[clip].length*fraction*fps):
		s=Animal.step(s,{"speed":0.0,"action":"" if stop else action,"yaw":0.0,"ground":ground},1.0/fps,m)
	var captured: Dictionary = Model.pose(m,s)
	var result := {"breed":breed,"action":action,"clip":clip,"stage":stage,"fraction":fraction,"fps":fps,"frames":[],"captured_distal":{},"captured_bones":{},
		"inputs":{"animal":FileAccess.get_sha256("res://npc/animal.gd"),"model":FileAccess.get_sha256("res://npc/animal_model.gd"),"glb":FileAccess.get_sha256(Model.config().breeds[breed].glb)}}
	for i in m.names.size():
		result.captured_bones[m.names[i]]=_x(captured.root*captured.globals[i])
	for key in Model.LEGS:
		var ids: Array = m.legs[key].ids
		if ids.size()<4:continue
		var relative: Transform3D = (captured.globals[ids[2]] as Transform3D).affine_inverse()*captured.globals[ids[3]]
		var rest: Transform3D = (m.rest_global[ids[2]] as Transform3D).affine_inverse()*m.rest_global[ids[3]]
		result.captured_distal[key]={"bone":m.names[ids[3]],"captured":_x(relative),"rest":_x(rest),
			"rest_difference_degrees":rad_to_deg(relative.basis.get_rotation_quaternion().angle_to(rest.basis.get_rotation_quaternion()))}
	var previous: Dictionary = captured
	for frame in int(fps):
		s=Animal.step(s,{"speed":0.35,"action":"","urgent":true,"yaw":0.0,"ground":ground},1.0/fps,m)
		var pose: Dictionary = Model.pose(m,s)
		var row := {"frame":frame,"time":frame/fps,"phase":s.phase_,"root_clearance":pose.root.origin.y-s.position.y,"return_air":s.return_air,"feet":{},"bones":{},"max_speed":0.0,"max_turn_degrees":0.0,
			"return_inertia":s.return_inertia,"projection_evaluations":s.return_projection_evaluations,"return_feet":s.return_feet,"unprojected":{}}
		for key in Model.LEGS:
			var actual: Vector3 = pose.root*Model.sole(m,pose.globals,key)
			row.feet[key]={"point":_v(s.feet[key].point),"actual":_v(actual),"swing":s.feet[key].swing}
		for i in m.names.size():
			if s.phase_=="return":row.unprojected[m.names[i]]=_x(s.return_plan.globals[i])
			var now: Transform3D = pose.root*pose.globals[i]
			var old: Transform3D = previous.root*previous.globals[i]
			var speed: float = now.origin.distance_to(old.origin)*fps
			var turn: float = rad_to_deg(now.basis.get_rotation_quaternion().angle_to(old.basis.get_rotation_quaternion()))
			row.max_speed=maxf(row.max_speed,speed)
			row.max_turn_degrees=maxf(row.max_turn_degrees,turn)
			row.bones[m.names[i]]={"world":_x(now),"speed":speed,"turn_degrees":turn}
		result.frames.append(row)
		previous=pose
	var file := FileAccess.open(args[4],FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	print("CANCEL_INSPECT ",breed," ",action," ",fps," fps, first max turn ",result.frames[0].max_turn_degrees)
	quit()

func _v(p:Vector3)->Array:return [p.x,p.y,p.z]
func _x(x:Transform3D)->Array:return [_v(x.basis.x),_v(x.basis.y),_v(x.basis.z),_v(x.origin)]
