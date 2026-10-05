## Scan source-rate travelling poses for feet merged by retargeting and all
## poses for forearms inside the enlarged head. This is geometry, not acting QA.
extends SceneTree
const Clip := preload("res://npc/clip_pose.gd")
var report := {"clips":{}, "failures":[], "frames":0}

func _initialize() -> void:
	call_deferred("run")

func segment_distance(a: Vector3, b: Vector3, point: Vector3) -> float:
	var ab := b-a
	return (a+ab*clampf((point-a).dot(ab)/maxf(ab.length_squared(),1e-12),0,1)).distance_to(point)

func run() -> void:
	var index: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/motion/index.json"))
	for entry in index.clips:
		var c = Clip.of(entry.id)
		assert(c.error == "",c.error)
		var foot_gap := INF
		var head_gap := INF
		var jump := 0.0
		var previous := {}
		for i in c.count+1:
			var pose_: Dictionary = c.pose(float(i)/c.count,false)
			for arm in [3,8]:
				head_gap = minf(head_gap,segment_distance(pose_.segs[arm][0],pose_.segs[arm][1],pose_.head)-c.P.headR-c.P.line/2)
			if not c.in_place:
				var a: Array = pose_.segs[6]
				var b: Array = pose_.segs[11]
				var close := Geometry3D.get_closest_points_between_segments(a[0],a[1],b[0],b[1])
				foot_gap = minf(foot_gap,close[0].distance_to(close[1])-c.P.line)
			if not previous.is_empty():
				for arm in [2,7]:
					jump = maxf(jump,pose_.segs[arm][1].distance_to(previous.segs[arm][1]))
			previous = pose_
			report.frames += 1
		if head_gap < -0.00001: report.failures.append(entry.id+": forearm intersects head")
		if not c.in_place and foot_gap < -0.00001: report.failures.append(entry.id+": feet intersect")
		report.clips[entry.id] = {"foot_gap":foot_gap if not c.in_place else null,"head_gap":head_gap,"elbow_max_step":jump}
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		var file := FileAccess.open(args[0],FileAccess.WRITE)
		file.store_string(JSON.stringify(report,"\t"))
		file.close()
	print("MOTION_CLEARANCE_%s frames=%d failures=%s" % ["OK" if report.failures.is_empty() else "FAIL",report.frames,report.failures])
	quit(0 if report.failures.is_empty() else 1)
