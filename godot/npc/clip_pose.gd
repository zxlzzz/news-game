## One Kimodo clip as an in-place pose source, for NPCs whose position is moved by someone else
## (a route, a leash plan) or who stay put (sitting, a stall). Output is the accepted mapping
## (skeleton_mapping.gd) in figure units; draw it under a node scaled by the body type.
##
## pose(phase): looping clips wrap; other clips hold their last pose at phase >= 1.
##  - the clip's steady forward progress is removed (the mapped hips minus a straight line from the
##    loop's start to its end), so what is left is the in-place body motion, including its sway;
##  - a travelling clip is turned so it travels along +Z; a clip that stays in place is turned so
##    the body faces +Z at its first frame.
## Moving the NPC by stride() * (change in phase) therefore reproduces the clip's own footfalls, so a
## caller that advances phase by distance / stride() never makes planted feet slide, at any speed.
## Clips that stay in place are played by time with phase = time / duration().
## A last frame that repeats the first (clip_endpoints.json "duplicate_endpoint") is played once; it may be
## shifted up or down as well as along the ground (stairs), and rise() is that shift per loop.
## Every frame is mapped once when the clip is first used (ClipPose.of(id) shares one per clip);
## pose() only interpolates between mapped frames.
extends RefCounted

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
const ContactPose := preload("res://npc/contact_pose.gd")
## A last frame within this distance of the first (all joints, root-aligned) repeats it (metres).
const REPEAT_TOLERANCE := 0.001
## A loop whose hips travel less than this (figure units) stays in place.
const IN_PLACE_TRAVEL := 0.05

static var _shared := {}

var error := ""
var P: Dictionary
var fps: float
var count: int        # native frame intervals from first to last (at least one)
var travel: Vector3   # mapped hips, loop end minus loop start (figure units, before turning)
var in_place := false
var id: String
## The last frame repeats the first (the clip loops without a jump); the pose keeps its height change
## within a loop and drops it at the wrap, so a caller that climbs adds rise() per loop.
var chains := false
var _rise := 0.0
var _mapper
var _mapped: Array    # per source frame: {segs, head, neck, handLeft, handRight}, progress removed, turned

## The shared ClipPose of a clip id (npc/motion/<id>.json). Check `error`.
static func of(clip: String):
	if not _shared.has(clip):
		_shared[clip] = new(clip)
	return _shared[clip]

func _init(clip: String) -> void:
	id = clip
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
	var rest: Array = got["value"]["frames"][NpcData.REST_FRAME]
	var mapper = SkeletonMapper.new(names, rest)
	_mapper = mapper
	if mapper.error != "":
		error = mapper.error
		return
	# Anatomical ankle-to-toe pitch is not the pitch of the sole. Calibrate it
	# from the shared standing reference, preserving animated toe-off and swing.
	var rest_pitch := []
	for side in ["Left", "Right"]:
		var ankle: Array = rest[mapper.J[side+"Foot"]]
		var toe: Array = rest[mapper.J[side+"ToeEnd"]]
		var delta := Vector3(toe[0]-ankle[0], toe[1]-ankle[1], toe[2]-ankle[2])
		rest_pitch.append(atan2(delta.y, Vector2(delta.x,delta.z).length()))
	error = NpcData.load_clip(clip, names.size(), got)
	if error != "":
		return
	var frames: Array = got["value"]["frames"]
	fps = got["value"]["fps"]
	var hips: int = mapper.J["Hips"]
	chains = frames.size() > 1 and _repeats(frames[0], frames[-1], hips)
	count = maxi(1, frames.size() - 1)
	var origin: Array = frames[0][hips]
	var raw := []
	for f in frames:
		raw.append(mapper.mapFrame(f, P, origin))
	var a: Array = raw[0]["H"]
	var b: Array = raw[mini(count, frames.size() - 1)]["H"]
	travel = Vector3(b[0] - a[0], 0, b[2] - a[2])
	var interaction_data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/interactions.json"))
	var fixed: bool = interaction_data.clips.get(clip,{}).get("stationary",false)
	var drift := travel
	if chains:
		_rise = b[1] - a[1]
	var turn: Basis
	if travel.length() >= IN_PLACE_TRAVEL and not fixed:
		turn = Basis(Vector3.UP, -atan2(travel.x, travel.z))
	else:
		in_place = true
		travel = Vector3.ZERO
		var fw: Array = mapper.torsoFrame(frames[0])[2]
		turn = Basis(Vector3.UP, -atan2(fw[0], fw[2]))
	for i in raw.size():
		var progress := (drift if fixed else travel) * (float(i) / count)
		var local := func(q: Array) -> Vector3: return turn * (Vector3(q[0] - origin[0], q[1], q[2] - origin[2]) - progress)
		var m: Dictionary = raw[i]
		var segs := []
		for sg in m["segs"]:
			segs.append([local.call(sg[0]), local.call(sg[1]), sg[2]])
		for side in 2:
			var foot: Array = segs[6 if side == 0 else 11]
			var delta: Vector3 = foot[1]-foot[0]
			var horizontal := Vector3(delta.x,0,delta.z).normalized()
			var pitch: float = atan2(delta.y,Vector2(delta.x,delta.z).length())-rest_pitch[side]
			foot[1] = foot[0]+(horizontal*cos(pitch)+Vector3.UP*sin(pitch))*delta.length()
		_mapped.append({"segs": segs, "head": local.call(m["head"]), "neck": local.call(m["N"]),
			"handLeft": local.call(m["handLeft"]), "handRight": local.call(m["handRight"]),
			"supportHands": m["supportHands"]})
	# Source feet are thin, while the figure uses thick strokes. Keep travelling
	# feet apart by the missing stroke clearance, preserving their height/pitch
	# and the two leg lengths. Do not alter deliberate crossed seated poses.
	if not in_place:
		for i in _mapped.size():
			var source_side: Array = mapper.torsoFrame(frames[i])[0]
			var lateral := turn*Vector3(source_side[0],0,source_side[2])
			separate_feet(_mapped[i], P.line, lateral.normalized())

static func separate_feet(pose_: Dictionary, width: float, side: Vector3) -> void:
	for attempt in 8:
		var a: Array = pose_.segs[6]
		var b: Array = pose_.segs[11]
		var gap := minf(a[0].dot(side),a[1].dot(side))-maxf(b[0].dot(side),b[1].dot(side))
		if gap >= width-0.000001:
			return
		var correction := maxf(0.0,width-gap)*0.5
		ContactPose.limb(pose_, "footLeft", a[0]+side*correction)
		ContactPose.limb(pose_, "footRight", b[0]-side*correction)

static func _repeats(f0: Array, f1: Array, hips: int) -> bool:
	var shift := Vector3(f1[hips][0] - f0[hips][0], f1[hips][1] - f0[hips][1], f1[hips][2] - f0[hips][2])
	for j in f0.size():
		if Vector3(f1[j][0], f1[j][1], f1[j][2]).distance_to(Vector3(f0[j][0], f0[j][1], f0[j][2]) + shift) > REPEAT_TOLERANCE:
			return false
	return true

## Figure units per loop along +Z (multiply by the body scale for metres); 0 for in-place clips.
func stride() -> float:
	return travel.length()

func duration() -> float:
	return count / fps

## Clip time expressed as a pose phase. Only a repeated endpoint can wrap seamlessly.
## A caller may play any clip once (for example an interaction) with repeat = false.
func phase_at(time: float, repeat: bool = true) -> float:
	var phase := time / duration()
	return fposmod(phase, 1.0) if repeat and chains else clampf(phase, 0.0, 1.0)

## Figure units the hips climb per loop (stairs); 0 unless the clip chains.
func rise() -> float:
	return _rise

## {segs: [[a, b, widthMultiplier]...], head, neck, handLeft, handRight} as Vector3 in figure units.
func pose(phase: float, repeat: bool = true) -> Dictionary:
	var sample_phase := fposmod(phase, 1.0) if repeat and chains else clampf(phase, 0.0, 1.0)
	var x := sample_phase * count
	var i := mini(floori(x), _mapped.size() - 1)
	var j := mini(i + 1, _mapped.size() - 1)
	var result := blend(_mapped[i], _mapped[j], x - i)
	# Direction interpolation retains lengths, but a curved hand path can still
	# cross the enlarged head between two clear native poses. Correct this
	# sampled geometry before callers apply their object contacts.
	if i == j or x-i <= 0.0:
		return result
	result = result.duplicate(true)
	var n: Vector3 = result.neck
	var to_array := func(q: Vector3) -> Array: return [q.x,q.y,q.z]
	for side in 2:
		var index := 2 if side == 0 else 7
		var arm := {"knee":to_array.call(result.segs[index][1]),"end":to_array.call(result.segs[index+1][1])}
		var corrected: Dictionary = _mapper.clearArm(to_array.call(n),to_array.call(result.head),arm,P,[1 if side==0 else -1,0,0])
		var elbow := Vector3(corrected.knee[0],corrected.knee[1],corrected.knee[2])
		var hand := Vector3(corrected.end[0],corrected.end[1],corrected.end[2])
		result.segs[index][1] = elbow
		result.segs[index+1][0] = elbow
		result.segs[index+1][1] = hand
		result["handLeft" if side==0 else "handRight"] = hand
	return result

## Crossfade two poses of the same mapping (same segment list), w = 0 -> a, 1 -> b.
static func blend(a: Dictionary, b: Dictionary, w: float) -> Dictionary:
	if w <= 0.0:
		return a
	if w >= 1.0:
		return b
	var segs := []
	for i in a.segs.size():
		# Blend directions on the unit sphere, then rebuild the connected
		# hierarchy. Lerp of endpoints shortens every bending limb mid-frame.
		var da: Vector3 = a.segs[i][1]-a.segs[i][0]
		var db: Vector3 = b.segs[i][1]-b.segs[i][0]
		var delta := da.normalized().slerp(db.normalized(),w)*lerpf(da.length(),db.length(),w)
		var start: Vector3
		match i:
			0: start = a.segs[0][0].lerp(b.segs[0][0],w)
			1,2,7: start = segs[0][1]
			4,9: start = segs[0][0]
			_: start = segs[i-1][1]
		segs.append([start,start+delta,a.segs[i][2]])
	var ha: Vector3 = a.head-a.segs[1][0]
	var hb: Vector3 = b.head-b.segs[1][0]
	var head: Vector3 = segs[1][0]+ha.normalized().slerp(hb.normalized(),w)*lerpf(ha.length(),hb.length(),w)
	return {"segs": segs, "head": head, "neck": segs[0][1],
		"handLeft": segs[3][1], "handRight": segs[8][1],
		"supportHands": [lerpf(a.supportHands[0], b.supportHands[0], w), lerpf(a.supportHands[1], b.supportHands[1], w)]}

## Ink drawing of a pose: line widths from skeleton-params (line x multiplier), head disc.
func drawing(pose_: Dictionary) -> Dictionary:
	var segs := []
	for sg in pose_.segs:
		segs.append([sg[0], sg[1], P["line"] * sg[2]])
	return {"segments": segs, "discs": [[pose_.head, P["headR"]]], "triangles": []}
