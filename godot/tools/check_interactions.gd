## Numerical regression checks complement visual playback; they do not certify acting quality.
extends SceneTree
const Scene = preload("res://scenes/empty_ground/level.tscn")
const Clip = preload("res://npc/clip_pose.gd")
const SeatTransition = preload("res://npc/seat_transition.gd")
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func snapshot(st) -> Array:
	var result := []
	for p in st.people:
		for s in p.pose.segs: result.append(s[0]); result.append(s[1])
		if p.item != null: result.append(p.item.node.transform)
		for prop in p.props: result.append(prop.node.transform); result.append(prop.node.visible)
	for part in st.interactions.parts: result.append(part.node.transform)
	return result

func run() -> void:
	var level = Scene.instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	var st=level.stage
	if st.error!="": printerr(st.error); quit(1); return
	var tested := 0
	for id in st.interactions.data.clips:
		var err: String=st.select(id)
		if err!="": failures.append(id+": "+err); continue
		for i in 61:
			st.seek(st.cycle*i/60.0)
			if not st.interactions.errors.is_empty():
				failures.append(id+": unreachable contact "+str(st.interactions.errors[0])); break
			for p in st.people:
				var c: Dictionary=p.interaction
				var source=Clip.of(c.get("base",p.clip_id))
				var original: Dictionary=source.pose(st._root(p,st.t)[1])
				for j in p.pose.segs.size():
					var segment: Array=p.pose.segs[j]
					if not segment[0].is_finite() or not segment[1].is_finite(): failures.append(id+": invalid joint")
					var length: float=segment[0].distance_to(segment[1])
					var expected: float=original.segs[j][0].distance_to(original.segs[j][1])
					if absf(length-expected)*st.body_scale>0.0001: failures.append(id+": changed bone length "+str(j))
		st.seek(st.cycle*.37)
		var forward := snapshot(st)
		st.seek(st.cycle*.91)
		st.seek(st.cycle*.37)
		var reverse := snapshot(st)
		if forward.size()!=reverse.size(): failures.append(id+": seek changed resource count")
		else:
			for j in forward.size():
				if forward[j] is bool:
					if forward[j]!=reverse[j]: failures.append(id+": nondeterministic visibility")
				elif not forward[j].is_equal_approx(reverse[j]): failures.append(id+": nondeterministic seek")
		tested+=1
		await process_frame
	var seating: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json")).seating
	for id in seating.clips:
		var err: String=st.select(id)
		if err!="": failures.append(err); continue
		st.seek(0)
		var seated: Dictionary=st.main.pose.duplicate(true)
		var approach: Array=seating.approach["chess" if id=="chess_move" else "sit"]
		for i in 61:
			var pose: Dictionary=SeatTransition.pose(seated,i/60.0,Vector3(approach[0],approach[1],approach[2]),st.body_scale,seating)
			for j in pose.segs.size():
				var difference: float=absf(pose.segs[j][0].distance_to(pose.segs[j][1])-seated.segs[j][0].distance_to(seated.segs[j][1]))*st.body_scale
				if difference>0.0001: failures.append(id+": seat transition changed bone length")
	st._clear()
	level.queue_free()
	await process_frame
	if failures.is_empty(): print("INTERACTIONS_OK ",tested," clips; 61 phases; lengths, contacts, seek")
	else:
		for failure in failures: printerr(failure)
		printerr("INTERACTIONS_FAIL ",failures.size())
	quit(0 if failures.is_empty() else 1)
