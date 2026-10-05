## Actual geometry through two mop cycles, plus unchanged sweep reference.
extends SceneTree
const Bounds := preload("res://core/bounds.gd")

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
	for id in ["mop_ground","sweep_ground"]:
		assert(st.select(id)=="")
		var duration: float = st.main.clip.duration()
		st.cycle = maxf(st.cycle,2.0*duration)
		var rows := []
		for i in 241:
			st.seek(duration*i/120.0)
			var p: Dictionary = st.main
			var item: Node3D = p.item.node
			var hands := {}
			for hand in ["handLeft","handRight"]:
				var actual: Vector3 = p.fig.global_transform*p.pose[hand]
				var marker: Node3D = item.find_child("grip_high" if hand=="handLeft" else "grip_low",true,false)
				hands[hand] = {"position":xyz(actual),"marker_gap_m":actual.distance_to(marker.global_position) if marker!=null else null}
			rows.append({"t":st.t,"phase":st.interactions.phase_of(p,st.t),"hands":hands,
				"head":xyz(p.fig.global_transform*p.pose.head),"neck":xyz(p.fig.global_transform*p.pose.neck),
				"hip":xyz(p.fig.global_transform*p.pose.segs[0][0]),
				"feet":[xyz(p.fig.global_transform*p.pose.segs[6][0]),xyz(p.fig.global_transform*p.pose.segs[11][0])],
				"item_origin":xyz(item.global_position),"item_up":xyz(item.global_basis.y),
				"floor_y":Bounds.of_node(item).position.y,
				"mop_head":xyz(item.global_transform*Vector3(0,-0.8,0))})
		result[id] = {"duration":duration,"rows":rows}
	var args := OS.get_cmdline_user_args()
	assert(not args.is_empty())
	var file := FileAccess.open(args[0],FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	print("MOP_GEOMETRY_EVIDENCE ",args[0])
	quit()
