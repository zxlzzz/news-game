## Regression checks for contact bend reversal and mid-frame limb shortening.
## This is geometry verification, not animation acting/visual acceptance.
extends SceneTree

const Clip := preload("res://npc/clip_pose.gd")
const Contact := preload("res://npc/contact_pose.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var duck = Clip.of("duck_cover")
	var before: Dictionary = duck.pose(2.26666666666667/duck.duration(),false)
	var after: Dictionary = duck.pose(2.3/duck.duration(),false)
	var u: Vector3 = before.segs[2][1]-before.neck
	var v: Vector3 = after.segs[2][1]-after.neck
	assert(u.angle_to(v)<deg_to_rad(10),"Head clearance flips the duck-cover arm between smooth source frames")
	# Two close target directions straddle the old upper-arm projection.
	# An unchanged source bend must not reverse between these targets.
	var source := []
	for i in 12: source.append([Vector3.ZERO,Vector3.ZERO,1.0])
	source[2] = [Vector3.ZERO,Vector3(0,0.05,0.05),1.0]
	source[3] = [source[2][1],Vector3(0,0.1,0),1.0]
	var a := {"segs":source.duplicate(true),"handLeft":source[3][1]}
	var b := a.duplicate(true)
	Contact.limb(a,"handLeft",Vector3(0,0.05,0.0499))
	Contact.limb(b,"handLeft",Vector3(0,0.05,0.0501))
	assert(a.segs[2][1].distance_to(b.segs[2][1])<0.001,"Contact bend reversed for a 0.2 mm target change")
	var index: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/motion/index.json"))
	var checked := 0
	for entry in index.clips:
		var clip = Clip.of(entry.id)
		assert(clip.error=="",clip.error)
		var expected := [clip.P.torso,clip.P.neck,clip.P.upperArm,clip.P.foreArm,clip.P.thigh,clip.P.shin,clip.P.foot,clip.P.upperArm,clip.P.foreArm,clip.P.thigh,clip.P.shin,clip.P.foot]
		for k in clip.count:
			var pose: Dictionary = clip.pose((k+0.5)/clip.count,false)
			for j in expected.size():
				var length_: float = pose.segs[j][0].distance_to(pose.segs[j][1])
				assert(absf(length_-expected[j])<0.00001,"%s: segment %d shortens between native frames" % [entry.id,j])
			assert(pose.handLeft==pose.segs[3][1] and pose.handRight==pose.segs[8][1],"Hand landmarks disconnected")
			checked += 1
	print("MOTION_CONTINUITY_OK contact bend regression; %d clips, %d mid-frame poses retain lengths" % [index.clips.size(),checked])
	quit(0)
