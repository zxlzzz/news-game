## Read-only native-phase cup geometry and playback evidence.
extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func xyz(v: Vector3) -> Array:
	return [v.x,v.y,v.z]

func run() -> void:
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	var st = level.stage
	var result := {}
	for id in ["drink","walk_drink","cafe_sit_drink"]:
		assert(st.select(id)=="")
		var duration: float = st.interactions.data.clips.get(id,{}).get("duration",st.main.clip.duration())
		var rows := []
		for i in 241:
			st.seek(duration*i/120.0)
			var p: Dictionary = st.main
			var item: Node3D = p.item.node
			var hand: Vector3 = p.fig.global_transform*p.pose.handRight
			var head: Vector3 = p.fig.global_transform*p.pose.head
			# Physical sleeve contact and rear lip point of the existing cup.
			var grip: Vector3 = item.global_transform*Vector3(-0.049,-0.015,0)
			var lip: Vector3 = item.global_transform*Vector3(0,0.0885,-0.057)
			rows.append({"t":st.t,"phase":st.interactions.phase_of(p,st.t),"head":xyz(head),"hand":xyz(hand),
				"grip":xyz(grip),"lip":xyz(lip),"item":xyz(item.global_position),"up":xyz(item.global_basis.y),
				"head_radius":p.clip.P.headR*st.body_scale,
				"grip_error_m":grip.distance_to(hand),
				"mouth":xyz(head+p.root.basis*Vector3(0,-0.055,0.171391)),
				"lip_mouth_error_m":lip.distance_to(head+p.root.basis*Vector3(0,-0.055,0.171391))})
		result[id] = {"duration":duration,"chains":st.main.clip.chains,"rows":rows}
	var args := OS.get_cmdline_user_args()
	assert(not args.is_empty())
	var file := FileAccess.open(args[0],FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	print("CUP_GEOMETRY_EVIDENCE ",args[0])
	quit()
