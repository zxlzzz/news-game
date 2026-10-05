## Full native-frame geometry and source-derived palm support; JS/GD parity at
## first/middle/last of every clip plus the specifically reported native times.
## Usage: --headless --path godot -s res://tools/check_mapping_relations.gd -- fixture.json report.json
extends SceneTree
const Data := preload("res://npc/npc_data.gd")
const Mapper := preload("res://npc/skeleton_mapping.gd")
const Contact := preload("res://npc/contact_pose.gd")

func _initialize() -> void:
	call_deferred("run")

func distance(a: Array, b: Array) -> float:
	return sqrt(pow(a[0]-b[0],2)+pow(a[1]-b[1],2)+pow(a[2]-b[2],2))

func fail(message: String) -> void:
	push_error(message)
	quit(1)

func run() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size()!=2:
		fail("check_mapping_relations needs fixture and report paths")
		return
	var fixture: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var got := {}
	var err: String = Data.load_params(got)
	if err!="":
		fail(err)
		return
	var P: Dictionary = got.value
	if P!=fixture.params:
		fail("parity fixture parameters changed")
		return
	err=Data.load_joint_names(got)
	if err!="":
		fail(err)
		return
	var names: Array=got.value
	err=Data.load_clip(Data.REST_CLIP,names.size(),got)
	if err!="":
		fail(err)
		return
	var mapper=Mapper.new(names,got.value.frames[Data.REST_FRAME])
	var index: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://npc/motion/index.json"))
	var expected := {}
	for c in fixture.cases:
		expected[c.clip+":"+str(int(c.frame))]=c.mapped
	var lengths := [P.torso,P.neck,P.upperArm,P.foreArm,P.thigh,P.shin,P.foot,P.upperArm,P.foreArm,P.thigh,P.shin,P.foot]
	var report := {"clips":{},"native_frames":0,"parity_frames":0,"parity_max_error":0.0,"native_max_bone_error_m":0.0,"handstand_min_wrist_y":INF,"handstand_min_head_bottom_y":INF,"support_clips":{}}
	for clip in index.clips:
		err=Data.load_clip(clip.id,names.size(),got)
		if err!="":
			fail(err)
			return
		var frames: Array=got.value.frames
		var origin: Array=frames[0][mapper.J.Hips]
		var stats := {"native_frames":frames.size(),"max_bone_error_m":0.0,"max_paired_support":0.0}
		for fi in frames.size():
			var m: Dictionary=mapper.mapFrame(frames[fi],P,origin)
			if m.supportHands.size()!=2:
				fail("supportHands must have two source-derived weights")
				return
			stats.max_paired_support=maxf(stats.max_paired_support,minf(m.supportHands[0],m.supportHands[1]))
			for w in m.supportHands:
				if not is_finite(w) or w<0 or w>1:
					fail("invalid source support weight: "+clip.id)
					return
			for si in m.segs.size():
				var sg: Array=m.segs[si]
				for end in 2:
					for x in sg[end]:
						if not is_finite(x):
							fail("nonfinite native mapping: "+clip.id)
							return
				stats.max_bone_error_m=maxf(stats.max_bone_error_m,absf(distance(sg[0],sg[1])-lengths[si]))
			var key: String=clip.id+":"+str(fi)
			if expected.has(key):
				var ex: Dictionary=expected[key]
				for point in ["H","N","head","neckEnd","supportHands"]:
					for k in m[point].size():
						report.parity_max_error=maxf(report.parity_max_error,absf(m[point][k]-ex[point][k]))
				for si in m.segs.size():
					for e in 2:
						for k in 3:
							report.parity_max_error=maxf(report.parity_max_error,absf(m.segs[si][e][k]-ex.segs[si][e][k]))
				report.parity_frames+=1
			if clip.id=="handstand":
				var segs := []
				for sg in m.segs:
					segs.append([Vector3(sg[0][0],sg[0][1],sg[0][2]),Vector3(sg[1][0],sg[1][1],sg[1][2]),sg[2]])
				var p := {"segs":segs,"head":Vector3(m.head[0],m.head[1],m.head[2]),"neck":Vector3(m.N[0],m.N[1],m.N[2]),"handLeft":segs[3][1],"handRight":segs[8][1],"supportHands":m.supportHands}
				Contact.ground_feet(p,Transform3D(Basis.IDENTITY.scaled(Vector3.ONE*3),Vector3.ZERO),P.line,func(_at:Vector3)->float:return 0.0)
				report.handstand_min_wrist_y=minf(report.handstand_min_wrist_y,minf(p.handLeft.y,p.handRight.y))
				report.handstand_min_head_bottom_y=minf(report.handstand_min_head_bottom_y,p.head.y-P.headR)
			report.native_frames+=1
		report.native_max_bone_error_m=maxf(report.native_max_bone_error_m,stats.max_bone_error_m)
		report.clips[clip.id]=stats
		if stats.max_paired_support>0.01:
			report.support_clips[clip.id]=stats.max_paired_support
	var file := FileAccess.open(args[1],FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	file.close()
	if report.parity_max_error>1e-8 or report.native_max_bone_error_m>1e-8 or report.handstand_min_wrist_y<P.line/2-1e-5 or report.handstand_min_head_bottom_y<0.0:
		fail("mapping geometry/support or JS/GD parity failed: "+JSON.stringify(report))
		return
	print("MAPPING_RELATIONS_OK clips=",report.clips.size()," native_frames=",report.native_frames," parity_frames=",report.parity_frames," parity_max=",report.parity_max_error," bone_max=",report.native_max_bone_error_m," wrist_y=",report.handstand_min_wrist_y," head_clearance=",report.handstand_min_head_bottom_y)
	quit()
