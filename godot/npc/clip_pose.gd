## One Kimodo clip as an in-place pose source, for NPCs whose position is moved by someone else
## (a route, a leash plan) or who stay put (sitting, a stall). Output is the accepted mapping
## (skeleton_mapping.gd) in figure units; draw it under a node scaled by the body type.
##
## pose(phase), phase in [0, 1) over one loop:
##  - the clip's steady forward progress is removed (the mapped hips minus a straight line from the
##    loop's start to its end), so what is left is the in-place body motion, including its sway;
##  - a travelling clip is turned so it travels along +Z; a clip that stays in place is turned so
##    the body faces +Z at its first frame.
## Moving the NPC by stride() * (change in phase) therefore reproduces the clip's own footfalls, so a
## caller that advances phase by distance / stride() never makes planted feet slide, at any speed.
## Clips that stay in place are played by time with phase = time / duration().
## A last frame that repeats the first (clip_endpoints.json "duplicate_endpoint") is played once.
## Every frame is mapped once when the clip is first used (ClipPose.of(id) shares one per clip);
## pose() only interpolates between mapped frames.
extends RefCounted

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
## A last frame within this distance of the first (all joints, root-aligned) repeats it (metres).
const REPEAT_TOLERANCE := 0.001
## A loop whose hips travel less than this (figure units) stays in place.
const IN_PLACE_TRAVEL := 0.05

static var _shared := {}

var error := ""
var P: Dictionary
var fps: float
var count: int        # frames in one loop
var travel: Vector3   # mapped hips, loop end minus loop start (figure units, before turning)
var in_place := false
var _mapped: Array    # per source frame: {segs, head, handLeft, handRight}, progress removed, turned

## The shared ClipPose of a clip id (npc/motion/<id>.json). Check `error`.
static func of(clip: String):
	if not _shared.has(clip):
		_shared[clip] = new(clip)
	return _shared[clip]

func _init(clip: String) -> void:
	var got := {}
	error = NpcData.load_params(got)
	if error != "":
		return
	P = got["value"]
	error = NpcData.load_joint_names(got)
	if error != "":
		return
	var names: Array = got["value"]
	error = NpcData.load_clip(NpcData.REST_CLIP, names.size(), got)
	if error != "":
		return
	var mapper = SkeletonMapper.new(names, got["value"]["frames"][NpcData.REST_FRAME])
	if mapper.error != "":
		error = mapper.error
		return
	error = NpcData.load_clip(clip, names.size(), got)
	if error != "":
		return
	var frames: Array = got["value"]["frames"]
	fps = got["value"]["fps"]
	var hips: int = mapper.J["Hips"]
	count = frames.size() - 1 if frames.size() > 1 and _repeats(frames[0], frames[-1], hips) else frames.size()
	var origin: Array = frames[0][hips]
	var raw := []
	for f in frames:
		raw.append(mapper.mapFrame(f, P, origin))
	var a: Array = raw[0]["H"]
	var b: Array = raw[mini(count, frames.size() - 1)]["H"]
	travel = Vector3(b[0] - a[0], 0, b[2] - a[2])
	var turn: Basis
	if travel.length() >= IN_PLACE_TRAVEL:
		turn = Basis(Vector3.UP, -atan2(travel.x, travel.z))
	else:
		in_place = true
		travel = Vector3.ZERO
		var fw: Array = mapper.torsoFrame(frames[0])[2]
		turn = Basis(Vector3.UP, -atan2(fw[0], fw[2]))
	for i in raw.size():
		var progress := travel * (float(i) / count)
		var local := func(q: Array) -> Vector3: return turn * (Vector3(q[0] - origin[0], q[1], q[2] - origin[2]) - progress)
		var m: Dictionary = raw[i]
		var segs := []
		for sg in m["segs"]:
			segs.append([local.call(sg[0]), local.call(sg[1]), sg[2]])
		_mapped.append({"segs": segs, "head": local.call(m["head"]), "handLeft": local.call(m["handLeft"]),
			"handRight": local.call(m["handRight"])})

static func _repeats(f0: Array, f1: Array, hips: int) -> bool:
	var shift := Vector3(f1[hips][0] - f0[hips][0], 0, f1[hips][2] - f0[hips][2])
	for j in f0.size():
		if Vector3(f1[j][0], f1[j][1], f1[j][2]).distance_to(Vector3(f0[j][0], f0[j][1], f0[j][2]) + shift) > REPEAT_TOLERANCE:
			return false
	return true

## Figure units per loop along +Z (multiply by the body scale for metres); 0 for in-place clips.
func stride() -> float:
	return travel.length()

func duration() -> float:
	return count / fps

## {segs: [[a, b, widthMultiplier]...], head, handLeft, handRight} as Vector3 in figure units.
func pose(phase: float) -> Dictionary:
	var x := fposmod(phase, 1.0) * count
	var i := floori(x)
	# After the last frame of a loop comes its repeated end frame, or frame 0 when there is none.
	var j := i + 1 if i + 1 < _mapped.size() else 0
	return blend(_mapped[i], _mapped[j], x - i)

## Crossfade two poses of the same mapping (same segment list), w = 0 -> a, 1 -> b.
static func blend(a: Dictionary, b: Dictionary, w: float) -> Dictionary:
	if w <= 0.0:
		return a
	if w >= 1.0:
		return b
	var segs := []
	for i in a.segs.size():
		segs.append([a.segs[i][0].lerp(b.segs[i][0], w), a.segs[i][1].lerp(b.segs[i][1], w), a.segs[i][2]])
	return {"segs": segs, "head": a.head.lerp(b.head, w), "handLeft": a.handLeft.lerp(b.handLeft, w),
		"handRight": a.handRight.lerp(b.handRight, w)}

## Ink drawing of a pose: line widths from skeleton-params (line x multiplier), head disc.
func drawing(pose_: Dictionary) -> Dictionary:
	var segs := []
	for sg in pose_.segs:
		segs.append([sg[0], sg[1], P["line"] * sg[2]])
	return {"segments": segs, "discs": [[pose_.head, P["headR"]]], "triangles": []}
