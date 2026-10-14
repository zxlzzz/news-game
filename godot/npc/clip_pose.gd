## One clip as the game plays it: npc/baked/<id>.json, written by tools/bake_motion.gd (npc/motion_bake.gd)
## from npc/motion/<id>.json. Poses are stick-figure points in figure units (draw them under a node scaled by
## the body type), +Z forward. Nothing is mapped or corrected here (docs/动作重做方案.md §4.4).
##
## pose(phase): a chaining clip wraps; any other clip holds its last frame at phase >= 1.
##  - a travelling clip has its steady progress taken out: moving the NPC by stride() * (change in phase)
##    reproduces its footfalls, so a caller that advances phase by distance / stride() never makes planted
##    feet slide, at any speed;
##  - an in-place clip is played by time, phase = time / duration().
## A baked file whose inputs changed (source clip, mapping, parameters, declaration, bake code) is an error:
## run tools/bake_motion.gd again.
extends RefCounted

const NpcData := preload("res://npc/npc_data.gd")
const Bake := preload("res://npc/motion_bake.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")

static var _shared := {}

var error := ""
var id: String
var P: Dictionary
var fps: float
var count: int        # native frame intervals from first to last (at least one)
var in_place := true
## The last frame repeats the first: the clip loops seamlessly; it may climb rise() per loop (stairs).
var chains := false
## How far the figure reaches sideways from its hips (metres), for clips of a post kind with a seat span (crowd.gd
## seats people along the span this far apart and from its ends); 0 otherwise.
var half_width := 0.0
## What moves with the hands (npc/pose_build.gd _extras): per frame the held thing's turn; carried object parts;
## when the held thing is in the hand.
var _item_turn: Array = []   # per frame: Quaternion
var _parts := {}             # node name -> per frame: Vector3 (metres, post frame) or null
var _item_show: Array = []   # [from, to] seconds
var _stride := 0.0
var _rise := 0.0
var _poses: Array = []  # per frame: pose dictionary (segs, head, neck, handLeft, handRight, supportHands)

## The shared ClipPose of a clip id. Check `error`.
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
	P = got.value
	var path := "%s/%s.json" % [Bake.BAKED_DIR, clip]
	error = NpcData.read_json(path, got)
	if error != "":
		error += " (run tools/bake_motion.gd)"
		return
	var d = got.value
	if not (d is Dictionary and d.get("points") is Array and not d.points.is_empty()):
		error = path + ": not a baked clip"
		return
	var setup = ClipSetup.shared()
	if setup.error != "":
		error = setup.error
		return
	if d.get("inputs", "") != Bake.fingerprint(clip, setup):
		error = path + ": stale (its source, mapping, parameters or declaration changed) — run tools/bake_motion.gd"
		return
	fps = d.fps
	count = maxi(1, int(d.frames) - 1)
	chains = d.chains
	in_place = d.in_place
	_stride = d.stride
	_rise = d.rise
	half_width = d.get("half_width", 0.0)
	for q in d.get("item_turn", []):
		_item_turn.append(Quaternion(q[0], q[1], q[2], q[3]))
	for part in d.get("parts", {}):
		_parts[part] = d.parts[part].map(func(v): return null if v == null else Vector3(v[0], v[1], v[2]))
	_item_show = d.get("item_show", [])
	var support: Array = d.get("support", [])
	for i in d.points.size():
		var row: Array = d.points[i]
		if row.size() != Bake.POINTS.size() * 3:
			error = "%s: frame %d has %d numbers, not %d" % [path, i, row.size(), Bake.POINTS.size() * 3]
			return
		var q := []
		for k in range(0, row.size(), 3):
			q.append(Vector3(row[k], row[k + 1], row[k + 2]))
		_poses.append(Bake.pose_from_points(q, P.torsoLine, support[i] if not support.is_empty() else [0.0, 0.0]))

## Figure units per loop along +Z (multiply by the body scale for metres); 0 for in-place clips.
func stride() -> float:
	return _stride

func duration() -> float:
	return count / fps

## Clip time as a pose phase. Only a chaining clip wraps; any clip can be played once with repeat = false.
func phase_at(time: float, repeat: bool = true) -> float:
	var phase := time / duration()
	return fposmod(phase, 1.0) if repeat and chains else clampf(phase, 0.0, 1.0)

## Figure units the hips climb per loop (stairs); 0 unless the clip chains.
func rise() -> float:
	return _rise

## {segs: [[a, b, widthMultiplier]...], head, neck, handLeft, handRight, supportHands} in figure units.
## The dictionary is shared: duplicate(true) it before changing it.
func pose(phase: float, repeat: bool = true) -> Dictionary:
	var sample_phase := fposmod(phase, 1.0) if repeat and chains else clampf(phase, 0.0, 1.0)
	var x := sample_phase * count
	var i := mini(floori(x), _poses.size() - 1)
	var j := mini(i + 1, _poses.size() - 1)
	return blend(_poses[i], _poses[j], x - i)

## {turn: Quaternion of the held thing (relative to the person's frame), shown: bool, parts: {name: Vector3 metres in
## the post frame}} at a phase (played like pose()).
func extras(phase: float, repeat: bool = true) -> Dictionary:
	var sample_phase := fposmod(phase, 1.0) if repeat and chains else clampf(phase, 0.0, 1.0)
	var x := sample_phase * count
	var i := mini(floori(x), maxi(0, _poses.size() - 1))
	var j := mini(i + 1, _poses.size() - 1)
	var w := x - i
	var out := {"turn": Quaternion.IDENTITY, "shown": true, "parts": {}}
	if not _item_turn.is_empty():
		out.turn = (_item_turn[i] as Quaternion).slerp(_item_turn[j], w)
	if not _item_show.is_empty():
		var t := sample_phase * duration()
		out.shown = t >= _item_show[0] and t <= _item_show[1]
	for part in _parts:
		var a = _parts[part][i]
		var b = _parts[part][j]
		if a != null and b != null:
			out.parts[part] = (a as Vector3).lerp(b, w)
		elif a != null:
			out.parts[part] = a
	return out

func carries() -> Array:
	return _parts.keys()

## Crossfade two poses of the same figure, w = 0 -> a, 1 -> b. Directions are blended on the unit sphere and the
## connected figure rebuilt from the hips, so bending limbs keep their length mid-way.
static func blend(a: Dictionary, b: Dictionary, w: float) -> Dictionary:
	if w <= 0.0:
		return a
	if w >= 1.0:
		return b
	var segs := []
	for i in a.segs.size():
		var da: Vector3 = a.segs[i][1] - a.segs[i][0]
		var db: Vector3 = b.segs[i][1] - b.segs[i][0]
		var delta := da.normalized().slerp(db.normalized(), w) * lerpf(da.length(), db.length(), w)
		var start: Vector3
		match i:
			0: start = a.segs[0][0].lerp(b.segs[0][0], w)
			1, 2, 7: start = segs[0][1]
			4, 9: start = segs[0][0]
			_: start = segs[i - 1][1]
		segs.append([start, start + delta, a.segs[i][2]])
	var ha: Vector3 = a.head - a.segs[1][0]
	var hb: Vector3 = b.head - b.segs[1][0]
	var head: Vector3 = segs[1][0] + ha.normalized().slerp(hb.normalized(), w) * lerpf(ha.length(), hb.length(), w)
	return {"segs": segs, "head": head, "neck": segs[0][1], "handLeft": segs[3][1], "handRight": segs[8][1],
		"supportHands": [lerpf(a.supportHands[0], b.supportHands[0], w), lerpf(a.supportHands[1], b.supportHands[1], w)]}

## Ink drawing of a pose: line widths from skeleton-params (line x multiplier), head disc.
func drawing(pose_: Dictionary) -> Dictionary:
	var segs := []
	for sg in pose_.segs:
		segs.append([sg[0], sg[1], P["line"] * sg[2]])
	return {"segments": segs, "discs": [[pose_.head, P["headR"]]], "triangles": []}
