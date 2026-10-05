## Read-only boundary diagnostic using the same direct Animal/Model as check_animals.
extends SceneTree
const Model = preload("res://npc/animal_model.gd")
const Animal = preload("res://npc/animal.gd")

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var breed: String = args[0]
	var action: String = args[1]
	var fps: float = float(args[2])
	if args.size()>3:
		Model.config().recovery.inertiaTime=float(args[3])
	var c: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/animal-behaviour.json"))
	var m: Dictionary = Model.info(breed)
	var s: Dictionary = Animal.create(Vector3.ZERO,0,m)
	var flat = func(_p:Vector3)->float:return 0.0
	for frame in int((c.review.hold_until+0.2)*fps):
		var t: float = frame/fps
		var active: bool = t>=c.review.walk_until and t<c.review.hold_until
		s=Animal.step(s,{"speed":c.review.speed,"action":action if active else "","yaw":0.0,"ground":flat},1.0/fps,m)
		if t<c.review.hold_until-2/fps:
			continue
		var pose: Dictionary = Model.pose(m,s)
		print("FRAME ",frame," time=",t," phase=",s.phase_," return_time=",s.return_time," air=",s.return_air," root_clearance=",pose.root.origin.y-s.position.y," inertia_weight=",s.return_inertia," projection_evaluations=",s.return_projection_evaluations)
		if s.phase_=="return":
			var lowest: float = INF
			var low: Dictionary = {}
			for influences in m.skin_all:
				var p := Vector3.ZERO
				var source := []
				for item in influences:
					p+=(pose.globals[item[0]]*item[1])*item[2]
					source.append([m.names[item[0]],item[2]])
				if p.y<lowest:
					lowest=p.y
					low={"point":p,"bones":source}
			print("LOW_PRE_ROOT ",low)
		for key in Model.LEGS:
			var point: Vector3 = s.feet[key].point
			var actual: Vector3 = pose.root*Model.sole(m,pose.globals,key)
			var f: Dictionary = s.return_feet.get(key,{})
			print(key," point=",point," actual=",actual," delta=",actual-point," swing=",s.feet[key].swing," plan=",f,
				" point_from=",point-(f.from as Vector3) if not f.is_empty() else Vector3.ZERO)
			if s.phase_=="return":
				var ids: Array = m.legs[key].ids
				print("GEOMETRY ",key," raw_hip=",s.return_plan.globals[ids[0]].origin," hip=",pose.globals[ids[0]].origin,
					" wrist=",pose.globals[ids[2]].origin," limits=",Model._reach_limits(m,s,key))
	quit()
