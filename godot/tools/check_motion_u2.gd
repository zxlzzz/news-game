## Read-only source-mapped/contact pose evidence at 30 Hz for the U2 review.
## Arguments: output JSON. No production assets are changed.
extends SceneTree
const Contact := preload("res://npc/contact_pose.gd")
const Bounds := preload("res://core/bounds.gd")

func _initialize() -> void:
	call_deferred("run")

func xyz(p: Vector3) -> Array:
	return [p.x,p.y,p.z]

func pose(p: Dictionary, transform: Transform3D) -> Dictionary:
	var result := {}
	for key in ["head","neck","handLeft","handRight"]:
		result[key]=xyz(transform*p[key])
	result["hip"]=xyz(transform*p.segs[0][0])
	for side in ["Left","Right"]:
		var j: int = 2 if side=="Left" else 7
		result["shoulder"+side]=xyz(transform*p.segs[j][0])
		result["elbow"+side]=xyz(transform*p.segs[j][1])
		var leg: int = 4 if side=="Left" else 9
		result["knee"+side]=xyz(transform*p.segs[leg][1])
		result["foot"+side]=xyz(transform*p.segs[leg+2][0])
	return result

func run() -> void:
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	var st = level.stage
	var result := {"coordinates":"world metres","samples_per_second":30,"clips":{}}
	for id in ["atm_take_cash","assist_elder_walk","fountain_drink","basketball_dribble"]:
		assert(st.select(id)=="")
		var duration: float = st.interactions.data.clips.get(id,{}).get("duration",st.main.clip.duration())
		st.cycle=maxf(st.cycle,duration+0.2)
		var rows := []
		var horizon: float = 2.0*duration+0.1 if id=="basketball_dribble" else duration+0.1
		st.cycle=maxf(st.cycle,horizon)
		for sample in ceili(horizon*30)+1:
			var time: float = sample/30.0
			st.seek(time)
			var row := {"t":time,"people":[]}
			for person in st.people:
				var phase: float = st.interactions.phase_of(person,time)
				var track_phase: float = st.interactions.track_phase_of(person,time)
				var tracks := {}
				for hand in person.interaction.get("hands",{}):
					var track: Dictionary = person.interaction.hands[hand]
					tracks[hand]={"weight":Contact.weight(track.window,track_phase) if track.has("window") else 1.0,
						"target":xyz(person.fig.global_transform*st.interactions.target(track,person,st.objects,st.people,track_phase,st.body_scale))}
				var props := []
				for prop in person.get("props",[]):
					var box := Bounds.of_node(prop.node)
					props.append({"type":prop.track.type,"origin":xyz(prop.node.global_position),"visible":prop.node.visible,"bounds_min":xyz(box.position),"bounds_max":xyz(box.end)})
				row.people.append({"id":person.clip_id,"phase":phase,"track_phase":track_phase,
					"pre":pose(person.clip.pose(phase),person.fig.global_transform),
					"final":pose(person.pose,person.fig.global_transform),"tracks":tracks,"props":props})
			rows.append(row)
		var boundaries := []
		var phases: Array = [.4,.45,.95,1.0] if id=="atm_take_cash" else [.125,.25,.375,.5,.625,.75,.875,1.0,1.125,1.25,1.375,1.5,1.625,1.75,1.875,2.0] if id=="basketball_dribble" else [1.0]
		for phase in phases:
			var samples := []
			for dt in [-0.0001,0.0,0.0001]:
				var time: float=duration*float(phase)+dt
				st.seek(maxf(0,time))
				var person=st.main
				var props := []
				for prop in person.get("props",[]):
					var box := Bounds.of_node(prop.node)
					props.append({"type":prop.track.type,"origin":xyz(prop.node.global_position),"visible":prop.node.visible,"bounds_min":xyz(box.position),"bounds_max":xyz(box.end)})
				samples.append({"t":time,"pose":pose(person.pose,person.fig.global_transform),"props":props})
			boundaries.append({"phase":phase,"samples":samples})
		result.clips[id]={"duration":duration,"source_duration":st.main.clip.duration(),"rows":rows,"boundaries":boundaries,"errors":st.interactions.errors.duplicate()}
	var args := OS.get_cmdline_user_args()
	assert(args.size()==1)
	var file := FileAccess.open(args[0],FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	file.close()
	print("U2_POSE_EVIDENCE ",args[0])
	quit()
