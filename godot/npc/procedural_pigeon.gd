## Procedural pigeon (design_route_animal_motion.md §2 item 7): walking, pecking, hopping and flying as
## pure functions, like procedural_dog.gd. Every number comes from npc/pigeon-params.json; the wing
## shapes come from npc/pigeon-wings.json (extracted from a public-domain rig by
## scripts/export_pigeon_wings.py). No scene, route, clock or renderer access. Metres, +Y up;
## yaw 0 faces +Z.
##
##   var p = Pigeon.load_params()
##   var s = Pigeon.create(position, yaw, p)
##   s = Pigeon.step(s, input, dt, p)     # each frame; input is a complete dictionary:
##       speed (m/s wanted), yaw (rad wanted), ground (floor height under the bird),
##       peck (bool: feed while on the ground), fly (bool: be in the air), altitude (y to fly at),
##       hop (null, or a Vector3 to hop onto; read only on the frame it appears)
##   var pts = Pigeon.pose(s, p)            # 3D points
##   var draw = Pigeon.silhouette(pts, p)   # {segments, discs, triangles} for ink_figure.gd
##
## s.mode: "ground", "hop", "takeoff", "air", "landing". step() reports events: lift/land (a foot),
## hop, takeoff, touchdown.
## Contact rules on the ground: a planted foot never moves; leg bones never change length (a foot the
## leg cannot reach is lifted early). The head holds still in the world while the body walks under it
## and then thrusts forward, once per step.
extends RefCounted

const FEET := ["L", "R"]

static func load_params(path := "res://npc/pigeon-params.json") -> Dictionary:
	var p = JSON.parse_string(FileAccess.get_file_as_string(path))
	assert(p is Dictionary, "%s: not a JSON object" % path)
	var w = JSON.parse_string(FileAccess.get_file_as_string(p.wings.file))
	assert(w is Dictionary, "%s: not a JSON object" % p.wings.file)
	p.wingShapes = w
	return p

static func _forward(yaw: float) -> Vector3:
	return Vector3(sin(yaw), 0, cos(yaw))

static func _left(yaw: float) -> Vector3:
	return Vector3(cos(yaw), 0, -sin(yaw))

static func _wrap(a: float) -> float:
	return atan2(sin(a), cos(a))

static func _ease(x: float, target: float, rate: float, dt: float) -> float:
	return x + (target - x) * (1 - exp(-dt * rate))

static func _toward(x: float, target: float, step: float) -> float:
	return target if absf(target - x) <= step else x + signf(target - x) * step

## Deterministic random number in [0, 1) that advances the state's seed.
static func _rand(s: Dictionary) -> float:
	s.seed = (s.seed * 1103515245 + 12345) % 2147483648
	return float(s.seed) / 2147483648.0

## Body frame: hip (the leg joints' midpoint), bf along the back line, bu square to it, left level.
static func _body(s: Dictionary, p: Dictionary) -> Dictionary:
	var f := _forward(s.yaw)
	var bf := f * cos(s.pitch) + Vector3.UP * sin(s.pitch)
	var bu := Vector3.UP * cos(s.pitch) - f * sin(s.pitch)
	var hip: Vector3 = s.position + Vector3.UP * (p.body.hipY - s.crouch)
	return {"f": f, "left": _left(s.yaw), "bf": bf, "bu": bu, "hip": hip}

static func _at(b: Dictionary, q: Array) -> Vector3:
	return b.hip + b.bf * q[0] + b.bu * q[1]

## Where the head rests: above the neck base, upright whatever the body's pitch.
static func _head_rest(s: Dictionary, b: Dictionary, p: Dictionary) -> Vector3:
	var r: Array = p.head.air if s.mode in ["air", "takeoff", "landing"] else p.head.rest
	return _at(b, p.body.neck) + b.f * r[0] + Vector3.UP * r[1]

static func _foot_rest(s: Dictionary, key: String, p: Dictionary) -> Vector3:
	var side := 1.0 if key == "L" else -1.0
	return s.position + _left(s.yaw) * side * p.legs.footHalfWidth

static func _hip_joint(b: Dictionary, key: String, p: Dictionary) -> Vector3:
	var side := 1.0 if key == "L" else -1.0
	return b.hip + b.left * side * p.legs.hipHalfWidth

static func _reach(p: Dictionary) -> float:
	return p.legs.a + p.legs.b

## Two-bone leg: the joint between the bones (the pigeon's heel) bends toward `pole`.
static func _knee(a: Vector3, b: Vector3, l1: float, l2: float, pole: Vector3) -> Vector3:
	var d := b - a
	var dist := clampf(d.length(), absf(l1 - l2) + 1e-4, l1 + l2 - 1e-5)
	var u := d.normalized()
	var x := (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
	var h := sqrt(maxf(0.0, l1 * l1 - x * x))
	var side := (pole - u * pole.dot(u)).normalized()
	return a + u * x + side * h

static func create(position: Vector3, yaw: float, p: Dictionary) -> Dictionary:
	var s := {
		"position": position, "yaw": yaw, "speed": 0.0, "vy": 0.0, "ground": position.y,
		"mode": "ground", "modeTime": 0.0, "time": 0.0, "phase": 0.0, "pitch": p.pitch.stand,
		"crouch": 0.0, "tuck": 0.0, "wingOpen": 0.0, "wingPhase": 0.0, "wingFrame": -1.0, "glide": 0.0,
		"tailSpread": 0.0, "peck": 0.0, "peckPhase": 0.0, "look": 0.0, "lookTarget": 0.0,
		"lookTimer": 0.0, "hop": {}, "headOffset": 0.0, "seed": 1 + int(absf(position.x) * 1000 + absf(position.z) * 7919) % 100000,
		"feet": {}, "events": [],
	}
	for key in FEET:
		s.feet[key] = {"point": _foot_rest(s, key, p), "swing": false, "from": Vector3.ZERO, "t": 0.0, "duration": 0.0}
	s.headOffset = 0.0
	return s

static func step(previous: Dictionary, input: Dictionary, dt: float, p: Dictionary) -> Dictionary:
	for k in ["speed", "yaw", "ground", "peck", "fly", "altitude", "hop"]:
		assert(input.has(k), "pigeon input without '%s'" % k)
	var s: Dictionary = previous.duplicate(true)
	s.events = []
	s.time += dt
	s.modeTime += dt
	var m: Dictionary = p.motion
	s.yaw = _wrap(s.yaw + clampf(_wrap(input.yaw - s.yaw), -m.turnRate * dt, m.turnRate * dt))
	match s.mode:
		"ground":
			_ground(s, input, dt, p)
		"hop":
			_hop(s, dt, p)
		_:
			_air(s, input, dt, p)
	_wings(s, dt, p)
	_head(s, input, dt, p)
	return s

# ---------------------------------------------------------------- on the ground

static func _ground(s: Dictionary, input: Dictionary, dt: float, p: Dictionary) -> void:
	var m: Dictionary = p.motion
	s.ground = input.ground
	s.vy = 0.0
	s.crouch = _ease(s.crouch, 0.0, p.fly.crouchRecover, dt)
	s.tuck = _ease(s.tuck, 0.0, p.fly.tuckRate, dt)
	if input.fly:
		s.mode = "takeoff"
		s.modeTime = 0.0
		s.events.append({"type": "takeoff"})
		return
	if input.hop != null:
		_start_hop(s, input.hop, p)
		return
	var wanted := clampf(input.speed, 0.0, m.maxSpeed)
	s.speed = _toward(s.speed, wanted, (m.acceleration if wanted > s.speed else m.braking) * dt)
	var f := _forward(s.yaw)
	var moving: bool = s.speed > m.stillSpeed
	var feeding: bool = input.peck
	var pitch_target: float = p.pitch.walk if moving else p.pitch.stand
	s.pitch = _ease(s.pitch, lerpf(pitch_target, p.pitch.peck, s.peck), m.pitchRate, dt)
	s.position += f * s.speed * dt
	s.position.y = s.ground
	var g: Dictionary = p.gait
	var freq: float = g.frequency.base + g.frequency.perSpeed * s.speed
	var swing_time: float = g.swing / freq
	var stance_time: float = (1.0 - g.swing) / freq
	if moving:
		var before: float = s.phase
		s.phase = fmod(s.phase + freq * dt, 1.0)
		for key in FEET:
			var at: float = g.liftAt[key]
			var crossed: bool = (before <= at and at < s.phase) if s.phase >= before else (at >= before or at < s.phase)
			if crossed and not s.feet[key].swing and not s.feet[_other(key)].swing:
				_lift(s, key, swing_time)
	else:
		# standing: step a foot back under the body when it is off its rest spot, one at a time
		for key in FEET:
			var foot: Dictionary = s.feet[key]
			if not foot.swing and not s.feet[_other(key)].swing:
				var off: Vector3 = foot.point - _foot_rest(s, key, p)
				off.y = 0
				if off.length() > p.legs.settleDistance:
					_lift(s, key, p.legs.settleTime)
					break
	# a planted foot the leg can no longer reach is lifted early (the body never stretches a leg)
	var b := _body(s, p)
	for key in FEET:
		var foot: Dictionary = s.feet[key]
		if not foot.swing and not s.feet[_other(key)].swing:
			if foot.point.distance_to(_hip_joint(b, key, p)) > _reach(p) * p.legs.liftAtReach:
				_lift(s, key, swing_time)
				s.phase = g.liftAt[key]  # keep the step rhythm on this foot, so the feet stay alternate
	for key in FEET:
		var foot: Dictionary = s.feet[key]
		if not foot.swing:
			continue
		foot.t += dt
		var u := clampf(foot.t / foot.duration, 0.0, 1.0)
		var remaining: float = maxf(0.0, foot.duration - foot.t)
		var target: Vector3 = _foot_rest(s, key, p) + f * s.speed * (remaining + stance_time * 0.5)
		target.y = s.ground
		var point: Vector3 = foot.from.lerp(target, smoothstep(0.0, 1.0, u))
		point.y = lerpf(foot.from.y, s.ground, u) + p.legs.lift * sin(PI * u)
		foot.point = point
		if u >= 1.0:
			foot.point = target
			foot.swing = false
			s.events.append({"type": "land", "foot": key})
	_peck_amount(s, feeding, dt, p)

static func _other(key: String) -> String:
	return "R" if key == "L" else "L"

static func _lift(s: Dictionary, key: String, duration: float) -> void:
	var foot: Dictionary = s.feet[key]
	foot.swing = true
	foot.from = foot.point
	foot.t = 0.0
	foot.duration = duration
	s.events.append({"type": "lift", "foot": key})

static func _peck_amount(s: Dictionary, feeding: bool, dt: float, p: Dictionary) -> void:
	var pk: Dictionary = p.head.peck
	s.peck = _ease(s.peck, 1.0 if feeding else 0.0, pk.rate, dt)
	if s.peck > 0.01:
		s.peckPhase = fmod(s.peckPhase + pk.frequency * dt, 1.0)
	else:
		s.peckPhase = 0.0

# ---------------------------------------------------------------- hopping

static func _start_hop(s: Dictionary, to: Vector3, p: Dictionary) -> void:
	var h: Dictionary = p.hop
	var flat := Vector3(to.x - s.position.x, 0, to.z - s.position.z)
	if flat.length() > 0.01:
		s.yaw = atan2(flat.x, flat.z)
	var duration: float = maxf(h.minTime, flat.length() / h.speed)
	s.hop = {"from": s.position, "to": to, "t": 0.0, "duration": duration,
		"height": maxf(0.0, to.y - s.position.y) + h.height}
	s.mode = "hop"
	s.modeTime = 0.0
	s.speed = 0.0
	s.events.append({"type": "hop"})

static func _hop(s: Dictionary, dt: float, p: Dictionary) -> void:
	var hp: Dictionary = s.hop
	hp.t += dt
	var u := clampf(hp.t / hp.duration, 0.0, 1.0)
	var flat: Vector3 = hp.from.lerp(hp.to, u)
	# a parabola through both ends that peaks `height` above the start
	var a: float = hp.height
	var b: float = hp.to.y - hp.from.y
	var y: float = hp.from.y + (4 * a - b) * u - (4 * a - 2 * b) * u * u
	s.position = Vector3(flat.x, y, flat.z)
	s.pitch = _ease(s.pitch, p.pitch.hop, p.motion.pitchRate, dt)
	s.crouch = p.hop.crouch * sin(PI * u)
	for key in FEET:
		var foot: Dictionary = s.feet[key]
		foot.swing = false
		foot.point = _foot_rest(s, key, p) + Vector3.UP * p.hop.feetUp * sin(PI * u)
	if u >= 1.0:
		s.position = hp.to
		s.ground = hp.to.y
		s.mode = "ground"
		s.modeTime = 0.0
		s.hop = {}
		for key in FEET:
			s.feet[key].point = _foot_rest(s, key, p)
		s.events.append({"type": "land", "foot": "both"})

# ---------------------------------------------------------------- flying

static func _air(s: Dictionary, input: Dictionary, dt: float, p: Dictionary) -> void:
	var fl: Dictionary = p.fly
	s.ground = input.ground
	var f := _forward(s.yaw)
	match s.mode:
		"takeoff":
			if s.modeTime < fl.crouchTime:
				s.crouch = fl.crouch * s.modeTime / fl.crouchTime
				s.pitch = _ease(s.pitch, p.pitch.takeoff, p.motion.pitchRate, dt)
				return
			if s.vy == 0.0:
				s.vy = fl.launchSpeed
				for key in FEET:
					s.feet[key].swing = false
			s.crouch = _ease(s.crouch, 0.0, fl.crouchRecover, dt)
			s.pitch = _ease(s.pitch, p.pitch.takeoff, p.motion.pitchRate, dt)
			_fly_toward(s, input.speed, input.altitude, dt, p)
			if s.modeTime > fl.takeoffTime:
				s.mode = "air"
				s.modeTime = 0.0
		"air":
			if not input.fly:
				s.mode = "landing"
				s.modeTime = 0.0
			else:
				_fly_toward(s, input.speed, input.altitude, dt, p)
				s.pitch = _ease(s.pitch, p.pitch.air + p.pitch.airPerClimb * s.vy, p.motion.pitchRate, dt)
		"landing":
			var height: float = s.position.y - s.ground
			if height > fl.flareHeight:
				_fly_toward(s, minf(input.speed, fl.approachSpeed), s.ground, dt, p)
				s.pitch = _ease(s.pitch, p.pitch.air + p.pitch.airPerClimb * s.vy, p.motion.pitchRate, dt)
			else:
				s.speed = _toward(s.speed, 0.0, fl.brake * dt)
				s.vy = _ease(s.vy, -fl.touchSpeed, fl.verticalRate, dt)
				s.pitch = _ease(s.pitch, p.pitch.flare, p.motion.pitchRate, dt)
			if height <= 0.0 and s.vy < 0.0:
				_touchdown(s, p)
				return
	s.position += f * s.speed * dt + Vector3.UP * s.vy * dt
	var flaring: bool = s.mode == "landing" and s.position.y - s.ground <= fl.flareHeight
	s.tuck = _ease(s.tuck, 0.0 if flaring else 1.0, fl.tuckRate, dt)

static func _fly_toward(s: Dictionary, speed: float, altitude: float, dt: float, p: Dictionary) -> void:
	var fl: Dictionary = p.fly
	s.speed = _toward(s.speed, clampf(speed, 0.0, fl.maxSpeed), fl.accel * dt)
	var vy := clampf((altitude - s.position.y) * fl.altitudeGain, -fl.descent, fl.climb)
	s.vy = _ease(s.vy, vy, fl.verticalRate, dt)

static func _touchdown(s: Dictionary, p: Dictionary) -> void:
	s.position.y = s.ground
	s.vy = 0.0
	s.speed = 0.0
	s.crouch = p.fly.landCrouch
	s.mode = "ground"
	s.modeTime = 0.0
	s.tuck = 0.0
	for key in FEET:
		s.feet[key] = {"point": _foot_rest(s, key, p), "swing": false, "from": Vector3.ZERO, "t": 0.0, "duration": 0.0}
	s.events.append({"type": "touchdown"})

# ---------------------------------------------------------------- wings, tail, head

static func _wings(s: Dictionary, dt: float, p: Dictionary) -> void:
	var w: Dictionary = p.wings
	var fl: Dictionary = p.fly
	var frames: int = p.wingShapes.flap.size()
	match s.mode:
		"ground":
			s.wingOpen = _ease(s.wingOpen, 0.0, w.foldRate, dt)
			s.glide = 0.0
			s.wingFrame = -1.0
			s.tailSpread = _ease(s.tailSpread, 0.0, p.tail.rate, dt)
		"hop":
			var u: float = s.hop.t / s.hop.duration
			s.wingOpen = w.hopOpen * sin(PI * u)
			s.wingFrame = w.hopFrame
			s.tailSpread = sin(PI * u)
		_:
			var flaring: bool = s.mode == "landing" and s.position.y - s.ground <= fl.flareHeight
			var rate: float = fl.flapRate.cruise
			if s.mode == "takeoff":
				rate = fl.flapRate.takeoff
			elif flaring:
				rate = fl.flapRate.flare
			var gliding: bool = s.mode != "takeoff" and not flaring and s.vy < fl.glideBelow
			s.glide = _ease(s.glide, 1.0 if gliding else 0.0, w.glideRate, dt)
			if s.glide < 0.98:
				s.wingPhase = fmod(s.wingPhase + p.wingShapes.flapFps * rate * dt, frames)
			s.wingFrame = s.wingPhase
			s.wingOpen = _ease(s.wingOpen, 1.0, w.openRate, dt)
			s.tailSpread = _ease(s.tailSpread, 1.0, p.tail.rate, dt)

static func _head(s: Dictionary, input: Dictionary, dt: float, p: Dictionary) -> void:
	var hd: Dictionary = p.head
	var walking: bool = s.mode == "ground" and s.speed > p.motion.stillSpeed
	# s.headOffset: how far the head is ahead of its rest spot along the heading
	if walking:
		# once per step: thrust ahead of the rest spot, then hold still in the world while the body walks on
		var g: Dictionary = p.gait
		var freq: float = g.frequency.base + g.frequency.perSpeed * s.speed
		var step_phase := fmod(s.phase * 2.0, 1.0)
		var lead: float = s.speed / (2.0 * freq) * hd.bob.lead
		if step_phase < hd.bob.thrust:
			var left_time: float = (hd.bob.thrust - step_phase) / (2.0 * freq)
			s.headOffset = lerpf(s.headOffset, lead, clampf(dt / maxf(left_time, dt), 0.0, 1.0))
		else:
			s.headOffset -= s.speed * dt
		s.headOffset = clampf(s.headOffset, -hd.bob.maxLag, lead)
	else:
		s.headOffset = _ease(s.headOffset, 0.0, hd.rate, dt)
	# where the beak points: jerky head turns while standing, straight ahead otherwise
	s.lookTimer -= dt
	var lk: Dictionary = hd.look
	if s.lookTimer <= 0.0:
		s.lookTimer = lerpf(lk.interval[0], lk.interval[1], _rand(s))
		s.lookTarget = (_rand(s) * 2 - 1) * lk.max if s.mode == "ground" and not walking else 0.0
	if s.peck > 0.05 or s.mode != "ground":
		s.lookTarget = 0.0
	s.look = _ease(s.look, s.lookTarget, lk.rate, dt)

## The head with the peck applied (a pulse down to the ground in front of the feet), neck length kept.
static func _head_now(s: Dictionary, b: Dictionary, p: Dictionary) -> Vector3:
	var pk: Dictionary = p.head.peck
	var head: Vector3 = _head_rest(s, b, p) + b.f * s.headOffset
	if s.peck > 0.0:
		var ground: Vector3 = Vector3(s.position.x, s.ground, s.position.z) + b.f * pk.reach + Vector3.UP * pk.height
		var pulse := _peck_pulse(s.peckPhase, pk.down)
		head = head.lerp(ground, pulse * s.peck)
	var neck := _at(b, p.body.neck)
	var d := head - neck
	var n: Array = p.head.neck
	return neck + d.normalized() * clampf(d.length(), n[0], n[1])

## 0 -> 1 -> 0 over the first `down` of the cycle, then 0 (the head stays up between pecks).
static func _peck_pulse(phase: float, down: float) -> float:
	return sin(PI * phase / down) if phase < down else 0.0

static func _wing_points(s: Dictionary, p: Dictionary) -> Array:
	var ws: Dictionary = p.wingShapes
	var fold: Array = ws.fold
	var spread: Array
	if s.wingFrame < 0.0:
		spread = fold
	else:
		var n: int = ws.flap.size()
		var i0 := int(floor(s.wingFrame)) % n
		var i1 := (i0 + 1) % n
		var t: float = s.wingFrame - floor(s.wingFrame)
		spread = []
		for k in fold.size():
			var a: Array = ws.flap[i0][k]
			var c: Array = ws.flap[i1][k]
			spread.append([lerpf(a[0], c[0], t), lerpf(a[1], c[1], t), lerpf(a[2], c[2], t)])
		if s.glide > 0.0:
			for k in fold.size():
				var g: Array = ws.glide[k]
				spread[k] = [lerpf(spread[k][0], g[0], s.glide), lerpf(spread[k][1], g[1], s.glide), lerpf(spread[k][2], g[2], s.glide)]
	var out := []
	for k in fold.size():
		var a: Array = fold[k]
		var c: Array = spread[k]
		out.append([lerpf(a[0], c[0], s.wingOpen), lerpf(a[1], c[1], s.wingOpen), lerpf(a[2], c[2], s.wingOpen)])
	return out

static func pose(s: Dictionary, p: Dictionary) -> Dictionary:
	var b := _body(s, p)
	var bd: Dictionary = p.body
	var hd: Dictionary = p.head
	var neck := _at(b, bd.neck)
	var rump := _at(b, bd.rump)
	var shoulder := _at(b, bd.shoulder)
	var head := _head_now(s, b, p)
	var pulse: float = _peck_pulse(s.peckPhase, hd.peck.down) * s.peck
	var face: Vector3 = (b.f * cos(s.look) + b.left * sin(s.look)).rotated(b.left, hd.peck.beakDown * pulse).normalized()
	var beak_up := Vector3.UP.rotated(b.left, hd.peck.beakDown * pulse)
	var pts := {
		"neck": [neck, head],
		"beak": [head, head + face * hd.beak[0] + beak_up * hd.beak[1]],
		"body": [],
	}
	# the body's outline: discs along it from the breast to the rump, [along, up, radius] each
	for q in bd.profile:
		pts.body.append([_at(b, [q[0], q[1]]), float(q[2])])
	# tail: a fan behind the rump, spread wider in the air
	var tl: Dictionary = p.tail
	var tdir: Vector3 = (-b.bf * cos(tl.lift) + b.bu * sin(tl.lift)).normalized()
	var tip: Vector3 = rump + tdir * tl.length
	var half: float = lerpf(tl.tipHalfWidth.ground, tl.tipHalfWidth.air, s.tailSpread)
	pts.tail = [rump + b.left * tl.root, rump - b.left * tl.root, tip - b.left * half, tip + b.left * half, tip, rump.lerp(tip, 0.5)]
	# legs: hip joint -> heel -> foot, then toes on the ground
	var lg: Dictionary = p.legs
	for key in FEET:
		var hj := _hip_joint(b, key, p)
		var side := 1.0 if key == "L" else -1.0
		var foot: Vector3
		if s.mode in ["ground", "hop"]:
			foot = s.feet[key].point
		else:
			var tucked: Vector3 = _at(b, lg.tuck) + b.left * side * lg.hipHalfWidth
			var hang: Vector3 = hj + Vector3.DOWN * _reach(p) * lg.hang + b.f * lg.hangForward
			foot = hang.lerp(tucked, s.tuck)
		var d := foot - hj
		if d.length() > _reach(p):
			foot = hj + d.normalized() * _reach(p)
		var heel := _knee(hj, foot, lg.a, lg.b, -b.f)
		var toes := []
		var curl: float = s.tuck if not s.mode in ["ground", "hop"] else 0.0
		for a in [-lg.toeSpread, 0.0, lg.toeSpread]:
			var dir: Vector3 = b.f.rotated(Vector3.UP, a + side * lg.toeOut)
			toes.append(foot + dir.rotated(b.left, curl * 1.2) * lg.toe)
		toes.append(foot - b.f.rotated(b.left, -curl * 1.2) * lg.backToe)
		pts[key] = [hj, heel, foot]
		pts["toes" + key] = toes
	# wings: shapes in the body frame, from the shoulder midpoint
	var wp := _wing_points(s, p)
	for key in FEET:
		var side := 1.0 if key == "L" else -1.0
		var ring := []
		for q in wp:
			ring.append(shoulder + b.left * side * q[0] + b.bu * q[1] + b.bf * q[2])
		pts["wing" + key] = ring
	pts.wingOpen = s.wingOpen
	return pts

## Black silhouette: a chain of discs for the body, discs for the head, thick segments for neck, beak and legs,
## solid triangles for the tail fan and the wings (their leading edge also as a line, so a wing seen
## edge-on still shows).
static func silhouette(pts: Dictionary, p: Dictionary) -> Dictionary:
	var sh: Dictionary = p.silhouette
	var segs := []
	var discs := []
	# consecutive body discs joined by a bar as wide as the smaller one: one smooth outline from any side
	for i in pts.body.size():
		discs.append(pts.body[i])
		if i > 0:
			segs.append([pts.body[i - 1][0], pts.body[i][0], 2.0 * minf(pts.body[i - 1][1], pts.body[i][1])])
	discs.append([pts.neck[1], sh.head])
	segs.append([pts.neck[0], pts.neck[1], sh.neck])
	segs.append([pts.beak[0], pts.beak[1], sh.beak])
	for key in FEET:
		segs.append([pts[key][0], pts[key][1], sh.leg])
		segs.append([pts[key][1], pts[key][2], sh.leg])
		for t in pts["toes" + key]:
			segs.append([pts[key][2], t, sh.toe])
	var tris := []
	var tl: Array = pts.tail
	tris.append([tl[0], tl[1], tl[2]])
	tris.append([tl[0], tl[2], tl[3]])
	# the tail seen edge-on: thick at the root, thin at the tip
	segs.append([(tl[0] + tl[1]) / 2, tl[5], sh.tail[0]])
	segs.append([tl[5], tl[4], sh.tail[1]])
	for key in FEET:
		var w: Array = pts["wing" + key]
		# ring: 0 shoulder, 1 elbow, 2 wrist, 3 hand tip, 4..7 feather tips outer->inner, 8 inner root
		var hub: Vector3 = w[2]
		for i in [0, 3, 4, 5, 6, 7]:
			tris.append([hub, w[i], w[i + 1]])
		tris.append([hub, w[8], w[0]])
		if pts.wingOpen > 0.05:
			for e in [[0, 1], [1, 2], [2, 4]]:
				segs.append([w[e[0]], w[e[1]], sh.wingEdge * pts.wingOpen])
	return {"segments": segs, "discs": discs, "triangles": tris}
