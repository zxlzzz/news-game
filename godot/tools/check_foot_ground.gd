## Verify the visible stroke's lower edge, including frame interpolation and body scale.
extends SceneTree
const Scene = preload("res://scenes/empty_ground/level.tscn")
const Clip = preload("res://npc/clip_pose.gd")
const Contact = preload("res://npc/contact_pose.gd")
const DogWalker = preload("res://npc/dog_walker.gd")
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("run")

func check_clearance(id: String, pose: Dictionary, world: Transform3D, line: float, floor_query: Callable) -> void:
	for i in [6,11]:
		var radius: float = pose.segs[i][2]*line*world.basis.get_scale().x/2
		for j in 2:
			var q: Vector3 = world*pose.segs[i][j]
			if q.y-radius < floor_query.call(q)-0.0001:
				failures.append(id+": foot stroke intersects floor")

func run() -> void:
	var level = Scene.instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	var st = level.stage
	var flat := func(_q: Vector3) -> float: return 0.0
	var tested := 0
	for entry in st.entries:
		if entry.kind != "clip": continue
		var err: String = st.select(entry.id)
		if err != "": failures.append(err); continue
		for frame in st.main.clip.count*2:
			st.seek(st.cycle*frame/(st.main.clip.count*2.0))
			for person in st.people:
				check_clearance(entry.id,person.pose,person.fig.global_transform,person.clip.P.line,flat)
		tested += 1
		await process_frame
	# Actual ground callbacks at different world heights, slopes, scales and headings.
	var floor_query := func(q: Vector3) -> float: return 1.7+0.15*q.z
	for id in ["stand_idle","walk","walk_slow"]:
		var clip = Clip.of(id)
		for scale in [2.0,3.0,4.0]:
			for yaw in [0.0,1.2,3.1]:
				var world := Transform3D(Basis(Vector3.UP,yaw).scaled(Vector3.ONE*scale),Vector3(0,1.7,0))
				for frame in clip.count*2:
					var original: Dictionary = clip.pose(frame/(clip.count*2.0))
					var pose := original.duplicate(true)
					if Contact.ground_feet(pose,world,clip.P.line,floor_query)>0.0001:
						failures.append(id+": unreachable ground correction")
					check_clearance(id,pose,world,clip.P.line,floor_query)
					for i in pose.segs.size():
						if absf(pose.segs[i][0].distance_to(pose.segs[i][1])-original.segs[i][0].distance_to(original.segs[i][1]))*scale>0.0001:
							failures.append(id+": ground correction changed bone length")
	var rest: Dictionary = Clip.of("stand_idle").pose(0)
	for i in [6,11]:
		if absf(rest.segs[i][0].y-rest.segs[i][1].y)>0.00001:
			failures.append("standing reference foot is not level")
	var breeds: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/animal-models.json")).breeds
	var walkers_tested := 0
	for breed in breeds:
		if not breeds[breed] is Dictionary or breeds[breed].get("species","") != "dog": continue
		var walker = DogWalker.new(Vector3.ZERO,0.0,3.0,flat,breed)
		if walker.error != "": failures.append(walker.error); continue
		for side in ["Left","Right"]:
			walker.side = side
			for blend in [0.0,0.5,1.0]:
				walker.walker.still = blend
				for frame in walker.walk.count*2:
					walker.walker.phase = frame/(walker.walk.count*2.0)
					walker.walker.time = walker.walker.phase*walker.stand.duration()
					var drawing: Dictionary = walker.walker_drawing()
					check_clearance(breed,{"segs":drawing.segments},walker.walker_transform().scaled_local(Vector3.ONE*3.0),1.0,flat)
		if walker.error != "": failures.append(walker.error)
		walkers_tested += 1
	if walkers_tested == 0: failures.append("no dog walker tested")
	st._clear()
	level.queue_free()
	await process_frame
	if failures.is_empty(): print("FOOT_GROUND_OK ",tested," clips; ",walkers_tested," dog walkers; stroke clearance, slopes, scales, lengths, neutral pitch")
	else:
		for failure in failures.slice(0,20): printerr(failure)
		printerr("FOOT_GROUND_FAIL ",failures.size())
	quit(0 if failures.is_empty() else 1)
