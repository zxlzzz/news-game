## Focused, read-only pose/contact evidence. Coordinates are world metres.
## godot --headless --path godot -s res://tools/check_motion_prop_fixes.gd -- <out.json>
extends SceneTree
const Contact := preload("res://npc/contact_pose.gd")

func _initialize() -> void:
	call_deferred("run")

func xyz(p: Vector3) -> Array:
	return [p.x,p.y,p.z]

func run() -> void:
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	var st = level.stage
	var result := {}
	for id in ["chess_move","take_back_piece","fruit_weigh","distribute_flyer","photo_overhead","hang_laundry","walk_backpack_straps","elder_assisted_walk","phone_urgent"]:
		var err: String = st.select(id)
		assert(err=="",err)
		var duration: float = st.interactions.data.clips.get(id,{}).get("duration",st.main.clip.duration())
		var rows := []
		var phases := []
		for i in 121: phases.append(i/120.0)
		for boundary in [.32,.55,.60,.62,.65]:
			for offset in [-0.000001,0.0,0.000001,0.000002]:
				phases.append(boundary+offset)
		phases.sort()
		for sample_phase in phases:
			st.seek(duration*sample_phase)
			var row := {"phase":sample_phase,"t":st.t,"people":[],"props":[]}
			for p in st.people:
				var phase: float = st.interactions.phase_of(p,st.t)
				var hands := {}
				for hand in p.interaction.get("hands",{}):
					var track: Dictionary = p.interaction.hands[hand]
					var goal: Vector3 = st.interactions.target(track,p,st.objects,st.people,phase,st.body_scale)
					var actual: Vector3 = p.pose[hand]
					var j: int = 2 if hand=="handLeft" else 7
					hands[hand] = {"goal":xyz(p.fig.global_transform*goal),"actual":xyz(p.fig.global_transform*actual),
						"weight":Contact.weight(track.window,phase) if track.has("window") else 1.0,
						"error_m":actual.distance_to(goal)*st.body_scale,
						"shoulder":xyz(p.fig.global_transform*p.pose.segs[j][0]),
						"span_m":(p.pose.segs[j][0].distance_to(p.pose.segs[j][1])+p.pose.segs[j+1][0].distance_to(p.pose.segs[j+1][1]))*st.body_scale}
				var markers := {}
				if p.item != null:
					for marker in p.item.node.find_children("grip*","Node3D",true,false): markers[marker.name] = xyz(marker.global_position)
				row.people.append({"clip":p.clip_id,"hands":hands,"head":xyz(p.fig.global_transform*p.pose.head),"handLeft":xyz(p.fig.global_transform*p.pose.handLeft),"handRight":xyz(p.fig.global_transform*p.pose.handRight),"item_markers":markers})
				for prop in p.props:
					row.props.append({"owner":p.clip_id,"type":prop.track.type,"origin":xyz(prop.node.global_position)})
			rows.append(row)
		result[id] = rows
	var args := OS.get_cmdline_user_args()
	assert(not args.is_empty(),"Output path required")
	var output := FileAccess.open(args[0],FileAccess.WRITE)
	output.store_string(JSON.stringify(result))
	output.close()
	print("PROP_FIX_EVIDENCE ",args[0])
	quit()
