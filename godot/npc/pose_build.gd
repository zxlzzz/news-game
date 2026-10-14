## Builds the clips npc/clip-setup.json gives a "pose" (docs/动作重做方案.md "摆木偶"): the stick figure is put on its
## object directly — hips on the seat marker, soles on the foot markers, hands on markers or on its own body at the
## times the declaration names — and its arms and legs are solved with the figure's own lengths. Nothing of the
## Kimodo source decides where anything is; the source only lends the small sway of its torso and head ("life": what
## is left of their directions after a slow Gaussian trend is taken out), faded out at both ends so a clip that starts
## and ends in one pose chains.
## A target the figure cannot reach, a backrest it cannot lean on, a marker the object lacks or a path no lift clears
## is an error: the object or the declaration has to change, the result is never pulled into place.
## Lengths are figure units (skeleton-params.json) unless named metres; markers and boxes come in the clip frame (the
## post at the origin, +Z the way the person faces, +X the person's left). Numbers: motion-bake.json "pose".
##
## Declaration (all optional except seconds; times in seconds, angles in degrees):
##   seconds: the clip's length
##   seat: marker the hips rest on (the torso stroke on top of it); back: a marker on the backrest: the seated torso
##     leans back until its stroke rests on that board (at the farthest the life sway leans back); feet: [left marker, right marker] the soles stand on (a marker higher than Q.raised
##     holds a raised foot, the heel resting on it; "stance": that foot where the rest clip has it). Without seat the
##     figure stands, over its feet or, without feet, in the rest clip's stance at the post.
##   hip: [[t, "stand" | "seat"] ...] for sitting down and standing up: the hips move between standing over the feet
##     and the seat.
##   lean: [[t, deg] ...] forward (+); tilt: [[t, deg] ...] toward the figure's left (+). The torso also leans on its
##     own as far as a hand target needs (Q.reach).
##   hands: {left|right: [[t, target(, "hit")] ...]}: where the hand is at t; between two keys it travels (minimum
##     jerk; a key between two other targets is passed through without stopping; "hit": speeding up into the key, a
##     slap), lifted over anything in its way. The hand stops only where a target is held (the same target twice). A target is a marker of the
##     object (_rest_point: the hand touches the surface the marker is on; "<marker>^" rests on top of what stands
##     on it; "...@<cm>" hovers that high), or a body place (PARTS: the hand's own side, or "<part>:left|right";
##     "side" hangs as in the rest clip).
##   look: [[t, target] ...]: "ahead", a marker, or "hand:left|right"; the head turns part of the way.
##   rest: a marker: the standing body, one straight line from its stance, leans on what the marker is on (and the head
##     turns away from it as far as its disc needs).
##   carry: [{part, hand, time: [pick, drop]}]: a part of the object goes with the hand; show: [from, to]: the held
##     thing is in the hand only then; wrist: [[t, deg] ...]: the held thing turned at the wrist about the figure's
##     left-right axis, its top forward (+) (a fan waved, more than the forearm alone turns it) (_extras).
##   life: false leaves the source out.
extends RefCounted

const PARTS := ["side", "lap", "knee", "seat", "pocket", "mouth", "chin", "ear", "cheek", "chest", "front", "front_up", "belly", "inspect", "fan", "hang"]
## Body places on the head's edge (motion-bake.json pose.headParts) and in front of the body (pose.frontParts).
const HEAD_PARTS := ["mouth", "chin", "ear", "cheek"]
const FRONT_PARTS := ["chest", "front", "front_up", "belly", "inspect", "fan", "hang"]
const SIDES := ["left", "right"]

var error := ""
var d: Dictionary
var geo: Dictionary
var P: Dictionary
var Q: Dictionary
var fps: float
var unit: float          # metres per figure unit
var r: float             # limb stroke radius
var rt: float            # torso stroke radius
var gap: float
var stand: Dictionary    # rest: {hip_height, ankles: [L, R] relative to the hips, hands: [L, R] relative to the neck}
var seat_y := 0.0
var life_t: Array = []   # per source frame: Quaternion (torso sway)
var life_h: Array = []   # per source frame: Quaternion (head sway)
var life_back := 0.0     # radians: the farthest the torso sway leans back (a seated torso rests on the backrest there)
var _rest_cache := {}
var _lift := {}          # "side:key index" -> lift of the segment ending at that key

## {error, poses}: the figure of clip `id` from its pose declaration `decl`. geo: {markers: {name: Vector3}, boxes};
## source: the mapped source poses in the clip frame (life only); rest: the mapped first rest-clip frame (mapFrame
## dictionary) with its hips at the origin.
## Also {extras}: what moves with the hands (_extras); item_hand: the clip's held thing's hand ("" without one).
static func build(id: String, decl: Dictionary, geo_: Dictionary, source: Array, fps_: float, rest: Dictionary,
		P_: Dictionary, Q_: Dictionary, unit_: float, item_hand := "") -> Dictionary:
	var b := new()
	var poses: Array = b._build(decl, geo_, source, fps_, rest, P_, Q_, unit_)
	if b.error != "":
		return {"error": "%s: pose: %s" % [id, b.error]}
	var extras := b._extras(poses, item_hand)
	if b.error != "":
		return {"error": "%s: pose: %s" % [id, b.error]}
	return {"error": "", "poses": poses, "extras": extras}

## What moves with the hands, per frame: {item_turn: [[x, y, z, w]...] the held thing turned with the forearm holding
## it (two hands: the line between the hands and their mean forearm), as it turned from the first frame, where it sits
## as its held type was set up; parts: {object node: [[x, y, z] metres in the post frame, or null where it rests]}: a
## part carried (pose "carry": [{part, hand, time: [pick, drop]}]) keeps its offset from the hand from pick to drop and
## stays where it was put after; item_show: [from, to] seconds the held thing is in the hand (pose "show"), or none.
func _extras(poses: Array, item_hand: String) -> Dictionary:
	var out := {}
	var fore := func(p: Dictionary, side: String) -> Vector3:
		var k := 3 if side == "left" else 8
		return (p.segs[k][1] - p.segs[k][0]).normalized()
	var aim := func(p: Dictionary) -> Basis:
		match item_hand:
			"left", "right":
				var f: Vector3 = fore.call(p, item_hand)
				var side: Vector3 = p.segs[0][1] - p.segs[0][0]  # the torso, to fix the roll about the forearm
				return Basis.looking_at(f, side.normalized() if absf(f.dot(side.normalized())) < 0.99 else Vector3.BACK)
			"both":
				var across: Vector3 = (p.handLeft - p.handRight).normalized()
				var mean: Vector3 = (fore.call(p, "left") + fore.call(p, "right")).normalized()
				var up: Vector3 = across.cross(mean).normalized()
				return Basis.looking_at(mean, up if up.length() > 0.5 else Vector3.UP)
		return Basis.IDENTITY
	if item_hand in ["left", "right", "both"]:
		var first: Basis = aim.call(poses[0])
		var turns := []
		for p in poses:
			var wrist := deg_to_rad(_keyed(d.get("wrist", []), turns.size() / fps))
			var q := Quaternion(Vector3.RIGHT, wrist) * Quaternion((aim.call(p) * first.inverse()).orthonormalized())
			turns.append([snappedf(q.x, 0.00001), snappedf(q.y, 0.00001), snappedf(q.z, 0.00001), snappedf(q.w, 0.00001)])
		out.item_turn = turns
	if d.has("show"):
		out.item_show = d.show
	for c in d.get("carry", []):
		if not geo.get("nodes", {}).has(c.part):
			error = "the object has no part %s to carry" % c.part
			return out
		var rest: Vector3 = geo.nodes[c.part]
		var hand_key := "handLeft" if c.hand == "left" else "handRight"
		var pick := clampi(roundi(float(c.time[0]) * fps), 0, poses.size() - 1)
		var drop := clampi(roundi(float(c.time[1]) * fps), pick, poses.size() - 1)
		var track := []
		for i in poses.size():
			if i < pick:
				track.append(null)
				continue
			var held: Vector3 = poses[mini(i, drop)][hand_key] - poses[pick][hand_key]
			var at: Vector3 = (rest + held) * unit
			track.append([snappedf(at.x, 0.0001), snappedf(at.y, 0.0001), snappedf(at.z, 0.0001)])
		out.get_or_add("parts", {})[c.part] = track
	return out

func _build(decl: Dictionary, geo_: Dictionary, source: Array, fps_: float, rest: Dictionary, P_: Dictionary,
		Q_: Dictionary, unit_: float) -> Array:
	d = decl
	geo = geo_
	P = P_
	Q = Q_
	fps = fps_
	unit = unit_
	r = P.line * 0.5
	rt = P.line * P.torsoLine * 0.5
	gap = Q.gap / unit
	_read_rest(rest)
	if d.has("seat"):
		seat_y = _marker(d.seat).y
	if d.get("life", true):
		_read_life(source)
	if error != "":
		return []
	var n := roundi(float(d.seconds) * fps) + 1
	var feet := _feet()
	if error != "":
		return []
	# pass 1: everything but the lean a far hand target asks for; the lean it asks for, per frame
	var need := []
	for i in n:
		var t := i / fps
		var f := _frame(t, feet, Vector3.ZERO, false)
		if error != "":
			return []
		need.append(_reach_lean(f, t))
		if error != "":
			return []
	var lean := _smooth_widest(need, maxi(1, roundi(Q.leanSmooth * fps)))
	# the lifts of the hands' ways and the elbows' directions are found again on the leaning figure
	_lift.clear()
	for key in _rest_cache.keys():
		if String(key).contains(">"):
			_rest_cache.erase(key)
	# The lifts were found with the figure as it is at each way's start; where the leaning figure's arm still comes
	# nearer the object than half of Q.checkDepth on the way, that way is lifted one step more and the clip built again.
	for attempt in Q.liftTries:
		var poses := []
		var bumped := ""
		for i in n:
			var t := i / fps
			var f := _frame(t, feet, lean[i], true)
			if error != "":
				return []
			bumped = _bump_lift(f, t)
			if bumped != "":
				break
			poses.append(_pose(f))
		if bumped == "":
			return poses
	error = "the hands' ways still bring an arm into the object after lifting them %d times" % Q.liftTries
	return []

## When an arm of the figure f comes deeper into the object than half of Q.checkDepth while its hand travels between
## two different keys, lifts that way one Q.liftStep more and returns its name; "" otherwise.
func _bump_lift(f: Dictionary, t: float) -> String:
	var limit: float = Q.checkDepth * 0.5 / unit
	for k in 2:
		var side: String = SIDES[k]
		var keys: Array = d.get("hands", {}).get(side, [[0, "side"]])
		var i := _segment(keys, t)
		if i < 0 or i >= keys.size() - 1 or keys[i][1] == keys[i + 1][1]:
			continue
		var deepest := 0.0
		for j in 6:
			deepest = maxf(deepest, maxf(_depth(f.N.lerp(f.elbows[k], j / 5.0), r), _depth(f.elbows[k].lerp(f.hands[k], j / 5.0), r)))
		if deepest > limit:
			var key := "%s:%d" % [side, i]
			_lift[key] = [_lift[key][0], _lift[key][1] + Q.liftStep / unit]
			return key
	return ""

# ---------------------------------------------------------------- the rest clip and the source's life

func _read_rest(rest: Dictionary) -> void:
	var segs: Array = rest.segs
	var hip: Vector3 = _v(rest.H)
	var neck: Vector3 = _v(rest.N)
	stand = {"hip_height": hip.y, "ankles": [], "hands": [],
		"hip_half": (absf(_v(segs[4][1]).x - hip.x) + absf(_v(segs[9][1]).x - hip.x)) * 0.5}
	for k in [5, 10]:
		var a: Vector3 = _v(segs[k][1])
		stand.ankles.append(Vector3(a.x - hip.x, a.y, a.z - hip.z))
	for k in [3, 8]:
		stand.hands.append(_v(segs[k][1]) - neck)

## The source's torso and head sway: rotation from each direction's slow trend to the direction itself.
func _read_life(source: Array) -> void:
	var torso := []
	var head := []
	for p in source:
		torso.append((p.segs[0][1] - p.segs[0][0]).normalized())
		head.append((p.head - p.segs[0][1]).normalized())
	var slow_t := _gauss(torso, Q.lifeSlow * fps)
	var slow_h := _gauss(head, Q.lifeSlow * fps)
	for i in source.size():
		life_t.append(Quaternion(slow_t[i], torso[i]))
		life_h.append(Quaternion(slow_h[i], head[i]))
		var up: Vector3 = life_t[i] * Vector3.UP
		life_back = maxf(life_back, atan2(-up.z, up.y) * Q.lifeScale)

static func _gauss(dirs: Array, sigma: float) -> Array:
	var out := []
	var reach := ceili(sigma * 3.0)
	for i in dirs.size():
		var acc := Vector3.ZERO
		for j in range(i - reach, i + reach + 1):
			var k := clampi(j, 0, dirs.size() - 1)
			acc += dirs[k] * exp(-0.5 * pow((j - i) / maxf(sigma, 1e-6), 2))
		out.append(acc.normalized())
	return out

func _life(t: float) -> Array:
	if life_t.is_empty():
		return [Quaternion.IDENTITY, Quaternion.IDENTITY]
	var length := (life_t.size() - 1) / fps
	var edge: float = Q.lifeEdge
	var w: float = Q.lifeScale * smoothstep(0.0, edge, t) * smoothstep(0.0, edge, float(d.seconds) - t)
	# the source is played forth and back when the clip is longer than it
	var ts := pingpong(t, length) if length > 0.0 else 0.0
	var k := clampi(roundi(ts * fps), 0, life_t.size() - 1)
	return [Quaternion.IDENTITY.slerp(life_t[k], w), Quaternion.IDENTITY.slerp(life_h[k], w)]

# ---------------------------------------------------------------- one frame

## The figure at time t: {H, T, N, D, neckEnd, head, knees, ankles, toes, hands, elbows}. lean: the extra lean
## (rotation vector) for far hand targets; final: false skips what pass 1 does not need.
func _frame(t: float, feet: Dictionary, lean: Vector3, final: bool) -> Dictionary:
	var f := {}
	var s := _hip_share(t)  # 0 standing, 1 seated
	var stand_hip: Vector3 = feet.hip
	var seat_hip := Vector3.ZERO
	var seat_torso := Vector3.UP
	if d.has("seat"):
		seat_hip = _marker(d.seat) + Vector3.UP * rt
		seat_torso = Basis(Vector3.RIGHT, life_back) * _back_lean(seat_hip) if d.has("back") else Vector3.UP
	var arc: float = 4.0 * s * (1.0 - s) * Q.hipArc / unit if d.has("hip") else 0.0
	f.H = stand_hip.lerp(seat_hip, s) + Vector3.UP * arc if d.has("seat") else stand_hip
	if not d.has("hip") and d.has("seat"):
		f.H = seat_hip
	var T: Vector3 = Vector3.UP.slerp(seat_torso, s) if d.has("seat") else Vector3.UP
	if d.has("rest") and not d.has("seat"):
		var leaning := _rest_lean(feet)
		f.H = leaning[0]
		T = leaning[1]
	T = Basis(Vector3.RIGHT, deg_to_rad(_keyed(d.get("lean", []), t))) * T
	T = Basis(Vector3.BACK, -deg_to_rad(_keyed(d.get("tilt", []), t))) * T
	if lean.length() > 1e-9:
		T = Basis(lean.normalized(), lean.length()) * T
	var life := _life(t) if final else [Quaternion.IDENTITY, Quaternion.IDENTITY]
	T = (life[0] * T).normalized()
	f.T = T
	f.N = f.H + T * P.torso
	f.fwd = (Vector3.BACK - T * T.z).normalized()
	f.lat = T.cross(f.fwd).normalized()  # the figure's left
	# legs
	f.ankles = feet.ankles
	f.toes = []
	f.knees = _knees(f.H, feet.ankles)
	for k in 2:
		var leg := _two_bone(f.H, feet.ankles[k], P.thigh, P.shin, Vector3.BACK)
		if leg[2] * unit > Q.missMax:
			error = "t %.2f: the %s foot is %.3f m out of the leg's reach (hips %s)" % [t, SIDES[k], leg[2] * unit, f.H * unit]
			return f
		f.toes.append(feet.ankles[k] + feet.toe_dirs[k] * P.foot)
	# head: kept nearer upright than the torso (Q.headUpright), then tilted by a share of how far the eyes turn from
	# looking straight ahead to what they look at
	var base := T.slerp(Vector3.UP, Q.headUpright)
	f.D = base
	f.neckEnd = f.N + f.D * P.neck
	f.head = f.neckEnd + f.D * P.headR
	var look: Vector3 = _look_point(f, t)
	if error != "":
		return f
	var turn := Quaternion(Vector3(f.fwd.x, 0, f.fwd.z).normalized(), (look - f.head).normalized())
	if turn.get_angle() > 1e-6:
		turn = Quaternion(turn.get_axis().normalized(), minf(turn.get_angle() * Q.lookShare, deg_to_rad(Q.lookMax)))
		f.D = (turn * base).normalized()
	f.D = (life[1] * f.D).normalized()
	if d.has("rest"):
		f.D = _head_clear(f.N, f.D)
	f.neckEnd = f.N + f.D * P.neck
	f.head = f.neckEnd + f.D * P.headR
	# arms
	f.hands = []
	f.elbows = []
	f.targets = []
	for k in 2:
		var at := _hand_at(SIDES[k], t, f)
		if error != "":
			return f
		f.targets.append(at[0])
		var pole: Vector3 = f.lat * (1.0 if k == 0 else -1.0) * at[1].x + T * at[1].y + f.fwd * at[1].z
		var arm := _two_bone(f.N, at[0], P.upperArm, P.foreArm, pole)
		if final and arm[2] * unit > Q.missMax:
			error = "t %.2f: the %s hand is %.3f m short of its target %s" % [t, SIDES[k], arm[2] * unit, _key_name(SIDES[k], t)]
			return f
		f.elbows.append(arm[0])
		f.hands.append(arm[1])
	return f

## Rotation vector of the lean that brings every marker target of the hands at t within Q.reach of the arm.
func _reach_lean(f: Dictionary, t: float) -> Vector3:
	var best := Vector3.ZERO
	var reach: float = Q.reach * (P.upperArm + P.foreArm)
	for k in 2:
		if not _key_is_marker(SIDES[k], t):
			continue
		var x: Vector3 = f.targets[k]
		if f.N.distance_to(x) <= reach:
			continue
		var flat := Vector3(x.x - f.H.x, 0, x.z - f.H.z)
		if flat.length() < 1e-6:
			continue
		var axis := Vector3.UP.cross(flat.normalized())
		var lo := 0.0
		var hi := deg_to_rad(Q.leanMax)
		if (f.H + Basis(axis, hi) * (f.N - f.H)).distance_to(x) > reach:
			error = "t %.2f: the %s hand's target %s is out of reach even leaning %d degrees" % [t, SIDES[k], _key_name(SIDES[k], t), Q.leanMax]
			return best
		for step in 30:
			var mid := (lo + hi) * 0.5
			if (f.H + Basis(axis, mid) * (f.N - f.H)).distance_to(x) > reach:
				lo = mid
			else:
				hi = mid
		if hi > best.length():
			best = axis * hi
	return best

func _pose(f: Dictionary) -> Dictionary:
	var segs := [[f.H, f.N, P.torsoLine], [f.N, f.neckEnd, P.torsoLine]]
	for k in 2:
		segs.append_array([[f.N, f.elbows[k], 1.0], [f.elbows[k], f.hands[k], 1.0], [f.H, f.knees[k], 1.0],
			[f.knees[k], f.ankles[k], 1.0], [f.ankles[k], f.toes[k], 1.0]])
	return {"segs": segs, "head": f.head, "neck": f.N, "handLeft": f.hands[0], "handRight": f.hands[1], "supportHands": [0.0, 0.0]}

# ---------------------------------------------------------------- hips and feet

## The knees for hips h and ankles. Like the shoulders folded into the arms (mapping spec step 6), the hip width goes
## into the thighs' direction: each leg is solved as if it started half the hip width out to its side (the rest clip's
## standing knees, stand.hip_half), and the drawn thigh, from the one hip point and at its own length, points where that
## knee is.
func _knees(h: Vector3, ankles: Array) -> Array:
	var knees := []
	for k in 2:
		var joint: Vector3 = h + Vector3.RIGHT * stand.hip_half * (1.0 if k == 0 else -1.0)
		var wide := _two_bone(joint, ankles[k], P.thigh, P.shin, Vector3.BACK)
		knees.append(_two_bone(h, ankles[k], P.thigh, P.shin, wide[0] - h)[0])
	return knees

## 0 standing .. 1 seated at t.
func _hip_share(t: float) -> float:
	if not d.has("hip"):
		return 1.0 if d.has("seat") else 0.0
	var keys := []
	for k in d.hip:
		keys.append([k[0], 1.0 if k[1] == "seat" else 0.0])
	return _keyed(keys, t)

## {ankles, toe_dirs, hip}: the soles and the standing hips (over the feet on the floor, moved toward a raised foot as
## far as its leg needs).
func _feet() -> Dictionary:
	var out := {"ankles": [], "toe_dirs": [], "hip": Vector3.ZERO}
	var raised := [false, false]
	for k in 2:
		if d.has("feet") and d.feet[k] != "stance":
			var m := _marker(d.feet[k])
			raised[k] = m.y * unit > Q.raised
			out.ankles.append(m + Vector3.UP * r)
		else:
			out.ankles.append(stand.ankles[k])
		out.toe_dirs.append((Vector3.BACK * 0.5 + Vector3.UP * 0.866).normalized() if raised[k] else Vector3.BACK)
	if error != "":
		return out
	var floor := []
	for k in 2:
		if not raised[k]:
			floor.append(k)
	if floor.is_empty():
		error = "both feet are raised"
		return out
	# the rest clip's hips over the middle of its stance, put over the feet that stand
	var rest_mid: Vector3 = (stand.ankles[0] + stand.ankles[1]) * 0.5
	var mid := Vector3.ZERO
	for k in floor:
		mid += out.ankles[k] - (stand.ankles[k] - rest_mid if floor.size() == 1 else Vector3.ZERO)
	mid /= floor.size()
	var hip := Vector3(mid.x - rest_mid.x, stand.hip_height, mid.z - rest_mid.z)
	var leg: float = (P.thigh + P.shin) * Q.legReach
	for k in 2:
		if not raised[k]:
			continue
		var heel: Vector3 = out.ankles[k]
		var flat := Vector3(heel.x - hip.x, 0, heel.z - hip.z)
		var lo := 0.0
		var hi := flat.length()
		for step in 30:
			var m := (lo + hi) * 0.5
			if (hip + flat.normalized() * m).distance_to(heel) > leg:
				lo = m
			else:
				hi = m
		hip += flat.normalized() * hi
		if hip.distance_to(heel) > leg + 1e-4:
			error = "the raised %s foot's marker is out of the leg's reach" % SIDES[k]
			return out
	for k in floor:
		var a: Vector3 = out.ankles[k]
		var horizontal := Vector2(hip.x - a.x, hip.z - a.z).length()
		var height := sqrt(maxf(0.0, leg * leg - horizontal * horizontal)) + a.y
		if hip.y > height:
			hip.y = height
	out.hip = hip
	return out

## [hips, torso direction] of a standing figure resting on something ("rest": a marker on it): the body one straight
## line from the middle of its stance (hips at their standing height along it), leaning toward the marker until the
## torso stroke rests on the box the marker is on. Found once.
func _rest_lean(feet: Dictionary) -> Array:
	if _rest_cache.has("#rest"):
		return _rest_cache["#rest"]
	var e := _marker(d.rest)
	var box = _box_near(e)
	var mid: Vector3 = (feet.ankles[0] + feet.ankles[1]) * 0.5
	var foot := Vector3(mid.x, 0.0, mid.z)
	var toward := Vector3(e.x - foot.x, 0.0, e.z - foot.z).normalized()
	var axis := Vector3.UP.cross(toward).normalized()
	var height: float = feet.hip.y
	var leg: float = (P.thigh + P.shin) * Q.legReach
	var body := func(angle: float) -> Array:
		var dir := Basis(axis, angle) * Vector3.UP
		var along := height
		# lowered along the line until both feet are in reach
		while along > 0.0 and ((foot + dir * along).distance_to(feet.ankles[0]) > leg or (foot + dir * along).distance_to(feet.ankles[1]) > leg):
			along -= 0.001
		return [foot + dir * along, dir]
	var clear := func(angle: float) -> float:
		var b: Array = body.call(angle)
		var nearest := INF
		for j in 21:  # the torso and the neck above it
			nearest = minf(nearest, box_distance(b[0] + b[1] * (P.torso + P.neck) * j / 20.0, box))
		return nearest - rt - gap
	# the first lean (in 1 degree steps) at which the torso touches, then narrowed down
	var lo := 0.0
	var hi := -1.0
	if clear.call(lo) <= 0.0:
		error = "the upright body already touches %s" % d.rest
		return [feet.hip, Vector3.UP]
	for k in range(1, int(Q.leanMax) + 1):
		if clear.call(deg_to_rad(k)) <= 0.0:
			hi = deg_to_rad(k)
			break
		lo = deg_to_rad(k)
	if hi < 0.0:
		error = "the body cannot lean on %s from its stance leaning up to %d degrees" % [d.rest, Q.leanMax]
		return [feet.hip, Vector3.UP]
	for step in 40:
		var m := (lo + hi) * 0.5
		if clear.call(m) > 0.0:
			lo = m
		else:
			hi = m
	_rest_cache["#rest"] = body.call(lo)
	return _rest_cache["#rest"]

## The head direction turned away from what the body rests on, as little as keeps the head disc out of it.
func _head_clear(neck: Vector3, dir: Vector3) -> Vector3:
	var box = _box_near(_marker(d.rest))
	var reach: float = P.neck + P.headR
	var away := Vector3(neck.x - box.centre.x, 0.0, neck.z - box.centre.z).normalized()
	var axis := dir.cross(away).normalized()
	if axis.length() < 0.5:
		return dir
	var cut := func(angle: float) -> float:
		return P.headR + gap - box_distance(neck + dir.rotated(axis, angle) * reach, box)
	if cut.call(0.0) <= 0.0:
		return dir
	var lo := 0.0
	var hi := deg_to_rad(Q.headAwayMax)
	if cut.call(hi) > 0.0:
		error = "the head cannot clear %s turning %d degrees away" % [d.rest, Q.headAwayMax]
		return dir
	for step in 30:
		var m := (lo + hi) * 0.5
		if cut.call(m) > 0.0:
			lo = m
		else:
			hi = m
	return dir.rotated(axis, hi)

func _box_near(p: Vector3):
	var best = null
	for box in geo.boxes:
		if best == null or box_distance(p, box) < box_distance(p, best):
			best = box
	return best

## The seated torso direction (leaning back in the clip's side plane) whose stroke rests on the backrest: the box the
## back marker is on, touched by the torso segment from the hips to the neck wherever it first meets it (the top edge,
## or the face lower down when the hips sit far forward).
func _back_lean(hip: Vector3) -> Vector3:
	var e := _marker(d.back)
	var rest_box = null
	for box in geo.boxes:
		if rest_box == null or box_distance(e, box) < box_distance(e, rest_box):
			rest_box = box
	var clear := func(angle: float) -> float:
		var dir := Basis(Vector3.RIGHT, -angle) * Vector3.UP
		var nearest := INF
		for j in 21:
			nearest = minf(nearest, box_distance(hip + dir * P.torso * j / 20.0, rest_box))
		return nearest - rt - gap
	var lo := 0.0
	var hi := deg_to_rad(Q.leanMax)
	if clear.call(lo) <= 0.0:
		error = "the backrest %s is in the upright torso's way" % d.back
		return Vector3.UP
	if clear.call(hi) > 0.0:
		error = "the backrest %s is out of the torso's reach leaning back %d degrees" % [d.back, Q.leanMax]
		return Vector3.UP
	for step in 40:
		var mid := (lo + hi) * 0.5
		if clear.call(mid) > 0.0:
			lo = mid
		else:
			hi = mid
	return Basis(Vector3.RIGHT, -lo) * Vector3.UP

# ---------------------------------------------------------------- hands

## [target point, pole (out, up, forward)] of a hand at t.
func _hand_at(side: String, t: float, f: Dictionary) -> Array:
	var keys: Array = d.get("hands", {}).get(side, [[0, "side"]])
	var i := _segment(keys, t)
	var a := _target(side, keys[maxi(i, 0)][1], f, maxi(i, 0))
	if i < 0 or i >= keys.size() - 1:
		var last := a if i < 0 else _target(side, keys[-1][1], f, keys.size() - 1)
		return [last[0], last[1]]
	var b := _target(side, keys[i + 1][1], f, i + 1)
	if keys[i][1] == keys[i + 1][1]:
		return [a[0], a[1]]
	var u: float = (t - keys[i][0]) / maxf(keys[i + 1][0] - keys[i][0], 1e-6)
	var way: Array = _segment_lift(side, i, keys, f)
	if error != "":
		return [a[0], a[1]]
	var speeds := _key_speeds(side, i, keys, f)
	if speeds.is_empty():
		var s: float = u * u * u * (10.0 - 15.0 * u + 6.0 * u * u)
		return [_along(a[0], b[0], s, way[0], way[1]), a[1].lerp(b[1], s)]
	return [_hermite(a[0], b[0], speeds[0], speeds[1], u, way[1]), a[1].lerp(b[1], u * u * (3.0 - 2.0 * u))]

## [velocity leaving key i, arriving at key i + 1] (figure units per unit of the segment) when the hand does not stop
## at one of them: a key between two other targets is passed through (its velocity points from the target before to
## the one after), a "hit" key is arrived at speeding up (twice the segment's mean speed). [] when it stops at both.
func _key_speeds(side: String, i: int, keys: Array, f: Dictionary) -> Array:
	var through := func(k: int) -> bool:
		return k > 0 and k < keys.size() - 1 and keys[k - 1][1] != keys[k][1] and keys[k + 1][1] != keys[k][1] 			and not (keys[k].size() > 2 and keys[k][2] == "hit")
	var hit: bool = keys[i + 1].size() > 2 and keys[i + 1][2] == "hit"
	if not through.call(i) and not through.call(i + 1) and not hit:
		return []
	var dt: float = keys[i + 1][0] - keys[i][0]
	var a: Vector3 = _target(side, keys[i][1], f, i)[0]
	var b: Vector3 = _target(side, keys[i + 1][1], f, i + 1)[0]
	var speed := func(k: int) -> Vector3:
		var before: Vector3 = _target(side, keys[k - 1][1], f, k - 1)[0]
		var after: Vector3 = _target(side, keys[k + 1][1], f, k + 1)[0]
		return (after - before) / maxf(keys[k + 1][0] - keys[k - 1][0], 1e-6) * dt
	var va: Vector3 = speed.call(i) if through.call(i) else Vector3.ZERO
	var vb: Vector3 = (b - a) * 2.0 if hit else (speed.call(i + 1) if through.call(i + 1) else Vector3.ZERO)
	return [va, vb]

## Cubic Hermite from a to b with end velocities va, vb (per unit of u), lifted by `lift` at most in the middle.
static func _hermite(a: Vector3, b: Vector3, va: Vector3, vb: Vector3, u: float, lift: float) -> Vector3:
	var u2 := u * u
	var u3 := u2 * u
	return a * (2.0 * u3 - 3.0 * u2 + 1.0) + va * (u3 - 2.0 * u2 + u) + b * (-2.0 * u3 + 3.0 * u2) + vb * (u3 - u2) 		+ Vector3.UP * lift * 4.0 * u * (1.0 - u)

## A point s (0..1) of the way from a to b: shape 0 goes level, 1 rises first (out from under or behind an edge), 2
## comes down last (into a crate, onto a piece); lifted by `lift` at most in the middle.
static func _along(a: Vector3, b: Vector3, s: float, shape: int, lift: float) -> Vector3:
	var h := s
	var v := s
	if shape == 1:
		h = s * s
		v = 1.0 - (1.0 - s) * (1.0 - s)
	elif shape == 2:
		h = 1.0 - (1.0 - s) * (1.0 - s)
		v = s * s
	var flat := Vector2(a.x, a.z).lerp(Vector2(b.x, b.z), h)
	return Vector3(flat.x, lerpf(a.y, b.y, v) + lift * 4.0 * s * (1.0 - s), flat.y)

## Index of the key segment t is in: -1 before the first key, keys.size() - 1 at or after the last.
static func _segment(keys: Array, t: float) -> int:
	if t < keys[0][0]:
		return -1
	for i in range(keys.size() - 1):
		if t < keys[i + 1][0]:
			return i
	return keys.size() - 1

func _key_name(side: String, t: float) -> String:
	var keys: Array = d.get("hands", {}).get(side, [[0, "side"]])
	return str(keys[clampi(_segment(keys, t), 0, keys.size() - 1)][1])

func _key_is_marker(side: String, t: float) -> bool:
	var keys: Array = d.get("hands", {}).get(side, [[0, "side"]])
	var i := _segment(keys, t)
	for k in [maxi(i, 0), mini(i + 1, keys.size() - 1)]:
		if _is_marker(String(keys[k][1])):
			return true
	return false

static func _is_marker(target: String) -> bool:
	return not target.split(":")[0] in PARTS

## [point, pole] of a hand target in the figure f.
func _target(side: String, target: String, f: Dictionary, slot := -1) -> Array:
	var poles: Dictionary = Q.poles
	if _is_marker(target):
		var point := _rest_point(target)
		return [point, _marker_pole(side, "%s#%d" % [target, slot], point, f)]
	var parts := target.split(":")
	var on: String = parts[1] if parts.size() > 1 else side
	var k := 0 if on == "left" else 1
	var sgn := 1.0 if on == "left" else -1.0
	match parts[0]:
		"side":
			var rest: Vector3 = stand.hands[k]
			return [f.N + Quaternion(Vector3.UP, f.T) * rest, _vec(poles.side)]
		"lap":
			return [f.H.lerp(f.knees[k], Q.lapAt) + Vector3.UP * (2.0 * r + gap), _vec(poles.body)]
		"knee":
			return [f.H.lerp(f.knees[k], Q.kneeAt) + Vector3.UP * (2.0 * r + gap), _vec(poles.body)]
		"seat":
			return [Vector3(f.H.x + sgn * Q.seatOut / unit, seat_y + r + gap, f.H.z), _vec(poles.body)]
		"pocket":
			return [f.H + f.lat * sgn * (rt + r + gap) + Vector3.DOWN * Q.pocketDown / unit, _vec(poles.body)]
		"mouth", "chin", "ear", "cheek":
			var angles: Array = Q.headParts[parts[0]]  # [down from straight ahead, toward the hand's side], degrees
			var down := deg_to_rad(angles[0])
			var turn := deg_to_rad(angles[1]) * sgn
			var dir: Vector3 = (f.fwd * cos(down) - f.D * sin(down)).rotated(f.D, turn)
			return [f.head + dir * (P.headR + r + gap), _vec(poles.get(parts[0], poles.head))]  # chin: the elbow down in front (on the table)
		"chest", "front", "front_up", "belly", "inspect", "fan", "hang":
			var at: Array = Q.frontParts[parts[0]]  # [forward, up, toward the hand's side] from the neck, metres
			var point: Vector3 = f.N + (f.fwd * at[0] + f.T * at[1] + f.lat * sgn * at[2]) / unit
			# the elbow out and down (or as Q.poles names for that place: hanging by the body under a fan), or in front
			# of the body for a hand across to the other side (folded arms); where the object is in that arm's way (a
			# pole the shoulder rests on), the first of the marker directions that clears it
			var first: Array = poles.fold if on != side else poles.get(parts[0], poles.marker[0])
			if geo.boxes.is_empty():
				return [point, _vec(first)]
			return [point, _marker_pole(side, "%s#%d" % [target, slot], point, f, [first] + Q.poles.marker + [poles.fold])]
	error = "unknown hand target %s" % target
	return [Vector3.ZERO, Vector3.ZERO]

## [shape, lift] of the hand's way from key i to key i + 1 (_along): of the three shapes, the one that clears the
## object with the least lift (in steps of Q.liftStep; level first on a tie), the hand stroke kept out of every box.
## Found once per segment, from the figure at the segment's start.
func _segment_lift(side: String, i: int, keys: Array, f: Dictionary) -> Array:
	var key := "%s:%d" % [side, i]
	if _lift.has(key):
		return _lift[key]
	var ta := _target(side, keys[i][1], f, i)
	var tb := _target(side, keys[i + 1][1], f, i + 1)
	var a: Vector3 = ta[0]
	var b: Vector3 = tb[0]
	var step: float = Q.liftStep / unit
	var lift := 0.0
	var speeds := _key_speeds(side, i, keys, f)
	while lift <= Q.liftMax / unit + 1e-9:
		for shape in (3 if speeds.is_empty() else 1):
			var clear := true
			for j in range(1, 40):
				var u := j / 40.0
				var p := _along(a, b, u, shape, lift) if speeds.is_empty() else _hermite(a, b, speeds[0], speeds[1], u, lift)
				if not _arm_clear(f, side, p, ta[1].lerp(tb[1], u)):
					clear = false
					break
			if clear:
				_lift[key] = [shape, lift]
				return _lift[key]
		lift += step
	var where := ""
	for j in range(1, 40):
		var p := _along(a, b, j / 40.0, 0, Q.liftMax / unit)
		if _depth(p, r) > 1e-4:
			where = "at %d%% of the way (level), %s (%.3f m deep)" % [j * 100 / 40, _deepest(p, r), _depth(p, r) * unit]
			break
	error = "the %s hand's way from %s %s to %s %s is blocked even lifted %.2f m: %s" % [side, keys[i][1], a * unit,
		keys[i + 1][1], b * unit, Q.liftMax, where]
	return [0, 0.0]

## The elbow direction for a hand on a marker: the first of Q.poles.marker (in order of preference) whose arm, reaching
## the point from the figure as it is the first time that key is used, stays out of the object. Chosen once per key
## of the hand (the same marker twice in a clip may get two), so the elbow never flips from frame to frame.
func _marker_pole(side: String, target: String, point: Vector3, f: Dictionary, options: Array = []) -> Vector3:
	var key := side + ">" + target
	if _rest_cache.has(key):
		return _rest_cache[key]
	# the arm kept Q.poleMargin clear (the figure leans differently by the time the hand gets there); failing that,
	# the direction that comes least deep
	if options.is_empty():
		options = Q.poles.marker
	var best := _vec(options[0])
	var least := INF
	var sgn := 1.0 if side == "left" else -1.0
	for o in options:
		var pole := _vec(o)
		var arm := _two_bone(f.N, point, P.upperArm, P.foreArm, f.lat * sgn * pole.x + f.T * pole.y + f.fwd * pole.z)
		var deepest := -INF
		for j in 6:
			deepest = maxf(deepest, maxf(_depth(f.N.lerp(arm[0], j / 5.0), r + Q.poleMargin / unit),
				_depth(arm[0].lerp(arm[1], j / 4.0 * 0.8), r + Q.poleMargin / unit)))
		if deepest <= 0.0:
			best = pole
			break
		if deepest < least:
			least = deepest
			best = pole
	_rest_cache[key] = best
	return best

## Whether the arm reaching hand point p (elbow toward pole, in the figure f's frame) stays out of the object: the
## hand stroke clear, the forearm and upper arm no deeper than 0.4 Q.checkDepth (they may rest on what the hand rests
## on; the rest of checkDepth is room for the lean the final pass adds).
func _arm_clear(f: Dictionary, side: String, p: Vector3, pole: Vector3) -> bool:
	if _depth(p, r) > 1e-4:
		return false
	var sgn := 1.0 if side == "left" else -1.0
	var arm := _two_bone(f.N, p, P.upperArm, P.foreArm, f.lat * sgn * pole.x + f.T * pole.y + f.fwd * pole.z)
	var limit: float = Q.checkDepth * 0.4 / unit  # room for the lean the final pass adds
	for j in 6:
		if _depth(f.N.lerp(arm[0], j / 5.0), r) > limit or _depth(arm[0].lerp(arm[1], j / 5.0), r) > limit:
			return false
	return true

## Where a hand goes for a marker: at the marker, moved out of every box its stroke would cut into (a marker on a
## table top puts the hand on the top, one on a button's face in front of it). "<marker>^": on top of whatever stands
## on the marker (a chess piece, apples in a crate): the hand let down from Q.restAbove above until it touches;
## "...@<cm>": hovering that many centimetres higher.
func _rest_point(target: String) -> Vector3:
	if _rest_cache.has(target):
		return _rest_cache[target]
	var parts := target.split("@")
	var on_top: bool = parts[0].ends_with("^")
	var m := _marker(parts[0].trim_suffix("^"))
	var p := m
	if on_top:
		# the hand stroke let down from above the marker until it touches something
		var y: float = m.y + Q.restAbove / unit
		var bottom: float = m.y - Q.restBelow / unit
		var step: float = Q.restStep / unit
		if _depth(Vector3(m.x, y, m.z), r + gap) > 0.0:
			error = "%s: something is above the marker; nothing to rest on top of" % target
			return m
		while y - step >= bottom and _depth(Vector3(m.x, y - step, m.z), r + gap) <= 0.0:
			y -= step
		p = Vector3(m.x, y, m.z)
	p = _push_out(p, r + gap)
	if _depth(p, r) > 1e-4:
		error = "%s: the hand cannot be put there without cutting %.3f m into %s" % [target, _depth(p, r) * unit, _deepest(p, r)]
		return p
	if parts.size() > 1:
		p += Vector3.UP * float(parts[1]) / 100.0 / unit
	_rest_cache[target] = p
	return p

func _look_point(f: Dictionary, t: float) -> Vector3:
	var keys: Array = d.get("look", [[0, "ahead"]])
	var i := _segment(keys, t)
	var a := _look_target(keys[maxi(i, 0)][1], f, t)
	if i < 0 or i >= keys.size() - 1:
		return a if i < 0 else _look_target(keys[-1][1], f, t)
	var b := _look_target(keys[i + 1][1], f, t)
	var u: float = (t - keys[i][0]) / maxf(keys[i + 1][0] - keys[i][0], 1e-6)
	return a.lerp(b, u * u * u * (10.0 - 15.0 * u + 6.0 * u * u))

func _look_target(target: String, f: Dictionary, t: float) -> Vector3:
	if target == "ahead":
		return f.N + Vector3(f.fwd.x, 0, f.fwd.z).normalized() * 10.0
	if target.begins_with("hand:"):
		return _hand_at(target.substr(5), t, f)[0]
	return _rest_point(target)

# ---------------------------------------------------------------- the object

func _marker(name: String) -> Vector3:
	if not geo.markers.has(name):
		error = "the object has no marker %s" % name
		return Vector3.ZERO
	return geo.markers[name]

func _inside(p: Vector3) -> bool:
	for box in geo.boxes:
		var q: Vector3 = box.axes.transposed() * (p - box.centre)
		if absf(q.x) <= box.half.x and absf(q.y) <= box.half.y and absf(q.z) <= box.half.z:
			return true
	return false

## How deep a sphere at p of radius rad cuts into the deepest box (<= 0: clear).
func _depth(p: Vector3, rad: float) -> float:
	var worst := -INF
	for box in geo.boxes:
		worst = maxf(worst, rad - box_distance(p, box))
	return worst

func _deepest(p: Vector3, rad: float) -> String:
	var name := ""
	var worst := -INF
	for box in geo.boxes:
		if rad - box_distance(p, box) > worst:
			worst = rad - box_distance(p, box)
			name = box.name
	return name

func _push_out(p: Vector3, rad: float) -> Vector3:
	for pass_ in 30:
		var moved := false
		for box in geo.boxes:
			var axes: Basis = box.axes
			var q: Vector3 = axes.transposed() * (p - box.centre)
			var e: Vector3 = q.abs() - box.half
			if maxf(e.x, maxf(e.y, e.z)) > 0.0:
				var outside := Vector3(signf(q.x) * maxf(e.x, 0), signf(q.y) * maxf(e.y, 0), signf(q.z) * maxf(e.z, 0))
				if outside.length() < rad:
					p += axes * outside.normalized() * (rad - outside.length())
					moved = true
			else:
				# out through the face nearest to the centre; a face whose way out points down costs Q.downCost more
				# (a marker on the bottom of a chess piece goes up through the piece, not down through the board)
				var best := INF
				var n := Vector3.ZERO
				for axis in 3:
					for sgn in [-1.0, 1.0]:
						var normal := Vector3.ZERO
						normal[axis] = sgn
						var way: Vector3 = axes * normal
						var cost: float = box.half[axis] - sgn * q[axis] + (Q.downCost / unit if way.y < -0.5 else 0.0)
						if cost < best:
							best = cost
							n = normal
				var axis_n := 0 if n.x != 0.0 else (1 if n.y != 0.0 else 2)
				p += axes * n * (rad + box.half[axis_n] - n[axis_n] * q[axis_n])
				moved = true
		if not moved:
			break
	return p

static func box_distance(p: Vector3, box: Dictionary) -> float:
	var axes: Basis = box.axes
	var q: Vector3 = axes.transposed() * (p - box.centre)
	var e: Vector3 = q.abs() - box.half
	return Vector3(maxf(e.x, 0), maxf(e.y, 0), maxf(e.z, 0)).length() + minf(maxf(e.x, maxf(e.y, e.z)), 0.0)

# ---------------------------------------------------------------- helpers

## [middle joint, end, how far the end stays short of the target]: two bones from root toward target, bending
## toward the pole.
static func _two_bone(root: Vector3, target: Vector3, l1: float, l2: float, pole: Vector3) -> Array:
	var delta := target - root
	var dist := delta.length()
	var axis := delta / dist if dist > 1e-9 else Vector3.DOWN
	var reach := clampf(dist, absf(l1 - l2) + 1e-6, l1 + l2 - 1e-6)
	var x := (l1 * l1 - l2 * l2 + reach * reach) / (2.0 * reach)
	var h := sqrt(maxf(0.0, l1 * l1 - x * x))
	var side := pole - axis * pole.dot(axis)
	if side.length_squared() < 1e-12:
		side = Vector3.BACK - axis * axis.z
	var end := root + axis * reach
	return [root + axis * x + side.normalized() * h, end, end.distance_to(target)]

## A keyed number at t: minimum jerk between keys, held before the first and after the last.
static func _keyed(keys: Array, t: float) -> float:
	if keys.is_empty():
		return 0.0
	var i := _segment(keys, t)
	if i < 0:
		return float(keys[0][1])
	if i >= keys.size() - 1:
		return float(keys[-1][1])
	var u: float = (t - keys[i][0]) / maxf(keys[i + 1][0] - keys[i][0], 1e-6)
	return lerpf(float(keys[i][1]), float(keys[i + 1][1]), u * u * u * (10.0 - 15.0 * u + 6.0 * u * u))

## Per frame a vector that covers each frame's need and changes smoothly: per axis the largest need within `window`
## frames, then averaged over the same span (triangle weights).
static func _smooth_widest(need: Array, window: int) -> Array:
	var n := need.size()
	var widest := []
	for i in n:
		var best := Vector3.ZERO
		for j in range(maxi(0, i - window), mini(n, i + window + 1)):
			var v: Vector3 = need[j]
			for a in 3:
				if absf(v[a]) > absf(best[a]):
					best[a] = v[a]
		widest.append(best)
	var out := []
	for i in n:
		var acc := Vector3.ZERO
		var total := 0.0
		for j in range(maxi(0, i - window), mini(n, i + window + 1)):
			var w := 1.0 - absf(j - i) / float(window + 1)
			acc += widest[j] * w
			total += w
		out.append(acc / total)
	return out

static func _v(a) -> Vector3:
	return a if a is Vector3 else Vector3(a[0], a[1], a[2])

static func _vec(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2])
