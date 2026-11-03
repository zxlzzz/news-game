## Mapping step 11 (hand contact) against steps 1-10, clip by clip (docs/asset-production/motions/npc-skeleton-mapping.md step 11).
##   godot --headless --path . -s res://tools/check_hand_contact.gd -- <clip> [<clip> ...] [--controls <clip> ...] [--out <abs json>]
## Per clip: where each hand rests on a point of npc/hand-contact.json (largest weight before smoothing, first and last
## frame of the resting frames), the frames far from every resting point (no weight above 0 within the smoothing
## reach, 2 x smoothSeconds, before and after), and the largest difference of any drawn point between step 11 and
## steps 1-10 on those far frames; it must be exactly 0. Clips after --controls (motions whose hands touch nothing,
## e.g. walk) must be the same as steps 1-10 on every frame. Prints HAND_CONTACT_OK, otherwise HAND_CONTACT_FAIL.
## --out writes the far frames per clip.
extends SceneTree

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
const Bake := preload("res://npc/motion_bake.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")

func _initialize() -> void:
	var args := Array(OS.get_cmdline_user_args())
	var out_path := ""
	var controls := []
	var ci := args.find("--controls")
	if ci >= 0:
		var end := ci + 1
		while end < args.size() and not args[end].begins_with("--"):
			controls.append(args[end])
			end += 1
		for k in end - ci:
			args.remove_at(ci)
	var i := args.find("--out")
	if i >= 0:
		out_path = args[i + 1]
		args.remove_at(i + 1)
		args.remove_at(i)
	var got := {}
	var e := NpcData.load_params(got)
	if e != "":
		return _fail(e)
	var P: Dictionary = got.value
	e = NpcData.load_contact(got)
	if e != "":
		return _fail(e)
	var C: Dictionary = got.value
	e = NpcData.load_joint_names(got)
	if e != "":
		return _fail(e)
	var names: Array = got.value
	e = NpcData.load_clip(NpcData.REST_CLIP, names.size(), got)
	if e != "":
		return _fail(e)
	var mapper = SkeletonMapper.new(names, got.value.frames[NpcData.REST_FRAME])
	if mapper.error != "":
		return _fail(mapper.error)
	var setup = ClipSetup.shared()
	if setup.error != "":
		return _fail(setup.error)
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var crowd = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	var scale: float = bodies[crowd.body].scale
	e = mapper.contactError(C)
	if e != "":
		return _fail(e)
	var points: Array = C.points.keys()
	var far_out := {}
	var worst := 0.0
	for clip in args + controls:
		e = NpcData.load_clip(clip, names.size(), got)
		if e != "":
			return _fail(e)
		var frames: Array = got.value.frames
		var fps: float = got.value.fps
		var hips: int = mapper.J["Hips"]
		var fixed: bool = got.value.get("source_frame", "") == "fixed"
		var origin: Array = [0.0, 0.0, 0.0] if fixed else frames[0][hips]
		var wrap: bool = frames.size() > 1 and Bake._repeats(frames[0], frames[-1], hips)
		var decl := Bake.declared(clip, setup)
		if not decl.pose.is_empty():
			print("%s: built from its pose declaration (npc/pose_build.gd), mapped with steps 1-10 only; not checked" % clip)
			continue
		var hr := Bake.held_tip(clip, setup, decl, C, frames, mapper, fixed, fixed or decl.stationary or decl.post != "", P, scale)
		if hr.has("error"):
			return _fail(hr.error)
		var held: Dictionary = hr.held
		var new: Array = mapper.mapClip(frames, P, origin, C, fps, wrap, held)
		var raw: Array = mapper.contactWeights(frames, P, C, fps, wrap, held)
		var reach := 2 * roundi(C.smoothSeconds * fps)
		var n := frames.size()
		var m := n - 1 if wrap else n
		var far := []
		for fi in n:
			var near := false
			for k in range(-reach, reach + 1):
				var j := posmod(fi + k, m) if wrap else fi + k
				if j < 0 or j >= n:
					continue
				for w in raw[j]:
					near = near or w > 0.0
			if not near:
				far.append(fi)
		var diff := 0.0
		for fi in far:
			var a: Dictionary = mapper.mapFrame(frames[fi], P, origin)
			var b: Dictionary = new[fi]
			var qa := [a.H, a.N, a.neckEnd, a.head, a.handLeft, a.handRight]
			var qb := [b.H, b.N, b.neckEnd, b.head, b.handLeft, b.handRight]
			for sg in a.segs:
				qa.append_array([sg[0], sg[1]])
			for sg in b.segs:
				qb.append_array([sg[0], sg[1]])
			for k in qa.size():
				for c in 3:
					diff = maxf(diff, absf(qa[k][c] - qb[k][c]))
		if clip in controls and far.size() != n:
			print("%s: a control clip, but %d frames come near a resting point" % [clip, n - far.size()])
			worst = maxf(worst, INF)
		worst = maxf(worst, diff)
		far_out[clip] = far
		var near_list := []
		for side in 2:
			for pk in points.size() + 1:
				var col := side * points.size() + pk if pk < points.size() else 2 * points.size()
				if pk == points.size() and side == 1:
					continue
				var top := 0.0
				var first := -1
				var last := -1
				for fi in n:
					if raw[fi][col] > 0.0:
						top = maxf(top, raw[fi][col])
						first = fi if first < 0 else first
						last = fi
				if top > 0.0:
					var label: String = ("hands" if pk == points.size() else ("L " if side == 0 else "R ") + points[pk])
					near_list.append("%s %.2f (%d-%d)" % [label, top, first, last])
		var holding := "" if held.is_empty() else " (%s hand judged by the %s's tip)" % [held.side, decl.item.type]
		print("%s%s%s: %d frames, %d far from every resting point, largest difference there %s; resting: %s" % [
			"control " if clip in controls else "", clip, holding, n, far.size(),
			str(diff), ", ".join(near_list) if not near_list.is_empty() else "nothing"])
	if out_path != "":
		var fa := FileAccess.open(out_path, FileAccess.WRITE)
		fa.store_string(JSON.stringify(far_out))
	print("HAND_CONTACT_OK" if worst == 0.0 else "HAND_CONTACT_FAIL largest difference %s" % str(worst))
	quit(0 if worst == 0.0 else 1)

func _fail(msg: String) -> void:
	printerr("HAND_CONTACT_FAIL " + msg)
	quit(1)
