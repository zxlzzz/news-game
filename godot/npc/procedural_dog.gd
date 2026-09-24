## Procedural dog (design_route_animal_motion.md §2): gait, pose and silhouette as pure functions.
## Every number comes from the parameter dictionary (npc/dog-params.json); no scene, route, clock or
## renderer access. Metres, +Y up; yaw 0 faces +Z.
##
##   var s = Dog.create(position, yaw, p)
##   s = Dog.step(s, {"speed": m/s, "yaw": rad, "gait": "auto"|"walk"|"trot"}, dt, p)   # each frame
##   var pts = Dog.pose(s, p)            # 3D points; pts.collar is where a leash attaches
##   var draw = Dog.silhouette(pts, p)   # {segments, discs, triangles} for ink_figure.gd
##
## Contact rules: a planted paw never moves; no bone ever changes length. When a planted paw would be
## out of reach the body is held back this frame and the worst-stretched paw is lifted early, so the
## dog slows for a moment instead of stretching a leg. step() reports lift/land events.
extends RefCounted

const LEGS := ["LH", "LF", "RH", "RF"]

static func load_params(path := "res://npc/dog-params.json") -> Dictionary:
	var p = JSON.parse_string(FileAccess.get_file_as_string(path))
	assert(p is Dictionary, "%s: not a JSON object" % path)
	return p

static func _forward(yaw: float) -> Vector3:
	return Vector3(sin(yaw), 0, cos(yaw))

static func _left(yaw: float) -> Vector3:
	return Vector3(cos(yaw), 0, -sin(yaw))

static func _wrap(a: float) -> float:
	return atan2(sin(a), cos(a))

static func _leg(key: String, p: Dictionary) -> Dictionary:
	return p.legs.hind if key[1] == "H" else p.legs.front

## Girdle frame of one leg: hip or shoulder attachment (root) and the paw's rest spot (neutral).
static func _girdle(s: Dictionary, key: String, p: Dictionary) -> Dictionary:
	var hind := key[1] == "H"
	var yaw: float = s.hipYaw if hind else s.yaw
	var f := _forward(yaw)
	var centre: Vector3 = s.position - f * p.body.length if hind else s.position
	var side := 1.0 if key[0] == "L" else -1.0
	var limb := _leg(key, p)
	var height: float = p.body.hipY if hind else p.body.shoulderY
	return {"f": f,
		"root": centre + Vector3(0, height - limb.drop, 0) + _left(yaw) * p.body.halfWidth * side,
		"neutral": centre + f * limb.neutral + _left(yaw) * p.body.footWidth * side}

## The leg's last segment (hock/pastern) keeps a fixed direction in the girdle's vertical plane.
static func _wrist(s: Dictionary, key: String, p: Dictionary, paw: Vector3) -> Vector3:
	var g := _girdle(s, key, p)
	var limb := _leg(key, p)
	var d := Vector2(limb.dir[0], limb.dir[1]).normalized()
	return paw + g.f * d.x * limb.c + Vector3(0, d.y * limb.c, 0)

static func _reach(key: String, p: Dictionary) -> float:
	var limb := _leg(key, p)
	return limb.a + limb.b - p.reachMargin

static func _reachable(s: Dictionary, key: String, p: Dictionary, paw: Vector3) -> bool:
	return _wrist(s, key, p, paw).distance_to(_girdle(s, key, p).root) <= _reach(key, p)

## A swinging paw is pulled in horizontally until the leg can reach it.
static func _reachable_paw(s: Dictionary, key: String, p: Dictionary, paw: Vector3) -> Vector3:
	var d: Vector3 = _wrist(s, key, p, paw) - _girdle(s, key, p).root
	var r := _reach(key, p)
	var allowed := sqrt(maxf(0, r * r - d.y * d.y))
	var h := Vector2(d.x, d.z).length()
	if h <= allowed:
		return paw
	var k := allowed / maxf(h, 1e-9)
	return Vector3(paw.x + d.x * (k - 1), paw.y, paw.z + d.z * (k - 1))

static func _knee(a: Vector3, b: Vector3, l1: float, l2: float, pole: Vector3) -> Vector3:
	var d := b - a
	var r := d.length()
	assert(r <= l1 + l2 + 1e-5 and r >= absf(l1 - l2) - 1e-5, "dog leg out of reach")
	var u := d.normalized()
	var h := (l1 * l1 + r * r - l2 * l2) / (2 * maxf(r, 1e-9))
	var v := pole - u * pole.dot(u)
	if v.length() < 1e-7:
		v = Vector3.RIGHT - u * u.x
	return a + u * h + v.normalized() * sqrt(maxf(0, l1 * l1 - h * h))

static func create(position: Vector3, yaw: float, p: Dictionary) -> Dictionary:
	var s := {"position": position, "yaw": yaw, "hipYaw": yaw, "speed": 0.0, "actualSpeed": 0.0,
		"time": 0.0, "phase": 0.0, "gait": "walk", "feet": {}, "look": 0.0, "events": []}
	for key in LEGS:
		s.feet[key] = {"point": _girdle(s, key, p).neutral, "swing": false, "elapsed": 0.0,
			"duration": 0.0, "start": Vector3.ZERO, "target": Vector3.ZERO}
	return s

## Step length grows with speed, so faster means longer steps, not only quicker legs.
static func _stride(gait: Dictionary, speed: float) -> float:
	return gait.stride.base + gait.stride.perSpeed * speed

static func _swing_time(gait: Dictionary, frequency: float) -> float:
	var w: Dictionary = gait.swing
	return clampf(w.k / maxf(frequency, w.minFrequency), w.min, w.max)

static func _lift(s: Dictionary, key: String, p: Dictionary, frequency: float, swing_time: float) -> void:
	var foot: Dictionary = s.feet[key]
	var period := 1.0 / frequency if frequency > 0 else 0.0
	# Land ahead of the rest spot by the travel during the swing plus half the stance, so the paw
	# passes under its girdle mid-stance.
	var travel: Vector3 = _forward(s.yaw) * s.speed * (swing_time + 0.5 * maxf(0, period - swing_time))
	foot.swing = true
	foot.elapsed = 0.0
	foot.duration = swing_time
	foot.start = foot.point
	foot.target = _girdle(s, key, p).neutral + travel
	s.events.append({"type": "lift", "leg": key})

static func _place(s: Dictionary, p: Dictionary, from: Dictionary, turn: float, dt: float, t: float) -> void:
	s.yaw = from.yaw + turn * t
	s.hipYaw = from.hipYaw + _wrap(s.yaw - from.hipYaw) * (1 - exp(-dt * p.motion.hipFollowRate)) * t
	s.position = from.position + _forward(s.yaw) * s.speed * dt * t

static func _planted_fit(s: Dictionary, p: Dictionary) -> bool:
	for key in LEGS:
		if not s.feet[key].swing and not _reachable(s, key, p, s.feet[key].point):
			return false
	return true

static func step(previous: Dictionary, input: Dictionary, dt: float, p: Dictionary) -> Dictionary:
	assert(dt > 0 and dt <= 0.05, "dog step: dt must be in (0, 0.05]")
	var m: Dictionary = p.motion
	var s := previous.duplicate(true)
	s.time += dt
	s.events = []
	var wanted := clampf(input.get("speed", 0.0), 0, m.maxSpeed)
	s.speed += clampf(wanted - s.speed, -m.braking * dt, m.acceleration * dt)
	var turn := clampf(_wrap(input.get("yaw", s.yaw) - s.yaw), -m.turnRate * dt, m.turnRate * dt)
	var requested: String = input.get("gait", "auto")
	if not p.gaits.has(requested):
		var sw: Dictionary = p.gaitSwitch
		if s.gait == "walk":
			requested = "trot" if s.speed > sw.walkToTrotAbove else "walk"
		else:
			requested = "walk" if s.speed < sw.trotToWalkBelow else "trot"
	var frequency: float = s.speed / _stride(p.gaits[s.gait], s.speed) if s.speed > m.stillSpeed else 0.0
	var old_phase: float = s.phase
	var advance := frequency * dt
	s.phase = fposmod(s.phase + advance, 1.0)
	# Gait changes only at a cycle boundary (or standing), so no paw is dropped mid-swing.
	if s.phase < old_phase or frequency == 0:
		s.gait = requested
	var gait: Dictionary = p.gaits[s.gait]
	var swing_time := _swing_time(gait, frequency)
	for key in LEGS:
		var until := fposmod(gait.liftAt[key] - old_phase, 1.0)
		if not s.feet[key].swing and frequency > 0 and (until < advance or until < 1e-9):
			_lift(s, key, p, frequency, swing_time)
	# Standing: step the paw farthest from its rest spot until all four are back under the body.
	var airborne := false
	for key in LEGS:
		airborne = airborne or s.feet[key].swing
	if frequency == 0 and not airborne:
		var worst := ""
		var worst_d := 0.0
		for key in LEGS:
			var d: float = s.feet[key].point.distance_to(_girdle(s, key, p).neutral)
			if d > worst_d:
				worst = key
				worst_d = d
		if worst_d > p.settleDistance:
			_lift(s, worst, p, frequency, swing_time)
	# Move the body; if a planted paw would be out of reach, move only as far as it allows.
	var from := {"position": s.position, "yaw": s.yaw, "hipYaw": s.hipYaw}
	_place(s, p, from, turn, dt, 1.0)
	if not _planted_fit(s, p):
		var lo := 0.0
		var hi := 1.0
		for i in 24:
			var mid := (lo + hi) / 2
			_place(s, p, from, turn, dt, mid)
			if _planted_fit(s, p):
				lo = mid
			else:
				hi = mid
		_place(s, p, from, turn, dt, lo)
		var planted := []
		for key in LEGS:
			if not s.feet[key].swing:
				planted.append(key)
		if planted.size() >= 3:
			var q: String = planted[0]
			for key in planted:
				if _wrist(s, key, p, s.feet[key].point).distance_to(_girdle(s, key, p).root) \
						> _wrist(s, q, p, s.feet[q].point).distance_to(_girdle(s, q, p).root):
					q = key
			_lift(s, q, p, frequency, swing_time)
	s.actualSpeed = s.position.distance_to(from.position) / dt
	for key in LEGS:
		var foot: Dictionary = s.feet[key]
		if not foot.swing:
			continue
		foot.elapsed += dt
		var t := minf(1, foot.elapsed / foot.duration)
		var point: Vector3 = foot.start.lerp(foot.target, t * t * (3 - 2 * t))
		point.y = _leg(key, p).lift * sin(PI * t)
		foot.point = _reachable_paw(s, key, p, point)
		if t >= 1:
			foot.point.y = 0
			foot.swing = false
			s.events.append({"type": "land", "leg": key})
	var look: Dictionary = p.head.look
	s.look += (clampf(turn / dt * look.turnGain, -look.max, look.max) - s.look) * (1 - exp(-dt * look.rate))
	return s

## Quadratic Bezier from hip to shoulder, raised by body.spineArch in the middle.
static func _spine(hip: Vector3, shoulder: Vector3, arch: float, t: float) -> Vector3:
	var c := (hip + shoulder) / 2 + Vector3(0, 2 * arch, 0)
	return hip * (1 - t) * (1 - t) + c * 2 * t * (1 - t) + shoulder * t * t

static func pose(s: Dictionary, p: Dictionary) -> Dictionary:
	var hd: Dictionary = p.head
	var f := _forward(s.yaw)
	var fh := _forward(s.hipYaw)
	var up := Vector3.UP
	var shoulder: Vector3 = s.position + up * p.body.shoulderY
	var hip: Vector3 = s.position - fh * p.body.length + up * p.body.hipY
	var neck_base: Vector3 = shoulder + f * hd.neckBase[0] + up * hd.neckBase[1]
	var still: bool = s.actualSpeed < p.motion.stillSpeed
	var look: float = hd.look.idleAmplitude * sin(s.time * hd.look.idleFrequency) if still else s.look
	var face := (f * cos(look) + _left(s.yaw) * sin(look)).normalized()
	var head: Vector3 = neck_base + face * hd.head[0] + up * hd.head[1]
	var arch: float = p.body.spineArch
	var pts := {
		"spine": [hip, _spine(hip, shoulder, arch, 1.0 / 3), _spine(hip, shoulder, arch, 2.0 / 3), shoulder, neck_base],
		"neck": [neck_base, neck_base.lerp(head, 0.5), head],
		"muzzle": [head, head + face * hd.muzzle[0] + up * hd.muzzle[1]],
		"collar": neck_base.lerp(head, hd.collarAt),
		"tail": [],
	}
	var tl: Dictionary = p.tail
	var wag: float = (tl.wag.idle if still else tl.wag.moving) * sin(s.time * tl.wag.frequency)
	var point: Vector3 = hip + fh * tl.root[0] + up * tl.root[1]
	for i in int(tl.points):
		pts.tail.append(point)
		var elevation: float = tl.elevation - tl.elevationStep * i
		point += (-fh * cos(elevation) + up * sin(elevation) + _left(s.hipYaw) * wag * (tl.wag.base + tl.wag.growth * i)).normalized() * tl.segment
	for key in LEGS:
		var g := _girdle(s, key, p)
		var limb := _leg(key, p)
		var paw: Vector3 = s.feet[key].point
		var w := _wrist(s, key, p, paw)
		pts[key] = [g.root, _knee(g.root, w, limb.a, limb.b, g.f * limb.bend), w, paw]
	return pts

## Black silhouette: thick segments for legs/spine/neck/tail, discs for hip, chest and head, two ears.
static func silhouette(pts: Dictionary, p: Dictionary) -> Dictionary:
	var sh: Dictionary = p.silhouette
	var segs := []
	for key in LEGS:
		var widths: Array = sh.hind if key[1] == "H" else sh.front
		for i in 3:
			segs.append([pts[key][i], pts[key][i + 1], widths[i]])
	for i in pts.tail.size() - 1:
		segs.append([pts.tail[i], pts.tail[i + 1], sh.tail[mini(i, sh.tail.size() - 1)]])
	for i in pts.spine.size() - 1:
		segs.append([pts.spine[i], pts.spine[i + 1], sh.spine])
	for i in pts.neck.size() - 1:
		segs.append([pts.neck[i], pts.neck[i + 1], sh.neck])
	segs.append([pts.muzzle[0], pts.muzzle[1], sh.muzzle])
	var head: Vector3 = pts.muzzle[0]
	var u: Vector3 = (pts.muzzle[1] - head).normalized()
	var v := (Vector3.UP - u * u.y).normalized()
	var side := u.cross(v).normalized()
	var ear: Dictionary = sh.ear
	var tris := []
	for sgn in [-1.0, 1.0]:
		var tri := []
		for j in 3:
			var q: Array = ear.points[j]
			var spread: float = ear.tipSpread if j == 1 else 1.0
			tri.append(head + side * ear.side * sgn * spread + v * q[0] + u * q[1])
		tris.append(tri)
	var chest: Vector3 = pts.spine[pts.spine.size() - 2] - Vector3(0, sh.chestDrop, 0)
	return {"segments": segs, "discs": [[pts.spine[0], sh.hipDisc], [chest, sh.chestDisc], [head, sh.headDisc]], "triangles": tris}
