## Procedural gait of the four-legged animals (design_route_animal_motion.md §2) as pure functions; the
## model animals (npc/animal.gd) walk with it. Every number comes from the parameter dictionary (npc/
## dog-params.json, or a model's, npc/animal_model.gd); no scene, route, clock or renderer access.
## Metres, +Y up; yaw 0 faces +Z.
##
##   var s = Dog.create(position, yaw, p)
##   s = Dog.step(s, {"speed": m/s, "yaw": rad, "gait": "auto"|"walk"|"trot", "ground": g}, dt, p)   # each frame
##       g: Callable(Vector3) -> float, the height of the surface under a point (core/walk_grid.gd
##       height_at in a level; a constant for flat ground). Paws land on it. The shoulders ride at the
##       mean height of the front paws, the hips at that of the hind paws (the body pitches about the
##       shoulder joints, s.pitch), each lower where a paw a step down would be out of reach and higher
##       where a planted paw a step up would fold its leg tighter than it can.
##   var pts = Dog.pose(s, p)            # 3D points of a stick dog; pts.collar is where a leash attaches
##
## Contact rules: a planted paw never moves; no bone ever changes length; a planted leg is never folded
## tighter than |a - b| (its two bones in line, folded back). Where the girdle's height cannot suit both
## legs of a pair (one paw a step above the other), the top of each leg slides up or down by up to
## p.slide (a shoulder blade, a hip hiked), back to its place while the paw swings. When a planted paw would be
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

## Height of the shoulder joints above s.position, and how much higher the hip joints are at rest.
static func _front_height(p: Dictionary) -> float:
	return p.body.shoulderY - p.legs.front.drop

static func _rise(p: Dictionary) -> float:
	return p.body.hipY - p.legs.hind.drop - _front_height(p)

## Girdle frame of one leg: hip or shoulder attachment (root) and the paw's rest spot (neutral). The
## hips swing up (s.pitch > 0) or down about the line through the shoulder joints.
static func _girdle(s: Dictionary, key: String, p: Dictionary) -> Dictionary:
	var hind := key[1] == "H"
	var yaw: float = s.hipYaw if hind else s.yaw
	var f := _forward(yaw)
	var l := _left(yaw)
	var side := 1.0 if key[0] == "L" else -1.0
	var limb := _leg(key, p)
	var root: Vector3 = s.position + Vector3.UP * (_front_height(p) + _slide(s, key))
	if hind:
		root += Basis(l, s.pitch) * (Vector3.UP * _rise(p) - f * p.body.length)
	var base: Vector3 = root - Vector3.UP * ((p.body.hipY if hind else p.body.shoulderY) - limb.drop + _slide(s, key))
	var neutral: float = lerpf(limb.neutral, limb.walkNeutral,
		clampf(s.get("speed", 0.0) / p.gaitReferenceSpeed, 0, 1))
	return {"f": f,
		"root": root + l * limb.get("halfWidth", p.body.halfWidth) * side,
		"neutral": base + f * neutral + l * limb.get("footWidth", p.body.footWidth) * side}

## How far the top of a leg has slid up (+) or down from its place on the girdle.
static func _slide(s: Dictionary, key: String) -> float:
	return s.feet[key].slide if s.has("feet") else 0.0

## Height of the ground under the hips the body rides at (s.position.y is that under the shoulders).
static func _hind_base(s: Dictionary, p: Dictionary) -> float:
	var l: float = p.body.length
	var r := _rise(p)
	return s.position.y + l * sin(s.pitch) + r * (cos(s.pitch) - 1)

## Shoulders at front_y, hips at hind_y: the position height and the pitch.
static func _set_heights(s: Dictionary, front_y: float, hind_y: float, p: Dictionary) -> void:
	var l: float = p.body.length
	var r := _rise(p)
	s.position.y = front_y
	s.pitch = clampf(asin(clampf((hind_y - front_y + r) / Vector2(l, r).length(), -1, 1)) - atan2(r, l),-p.motion.maxPitch,p.motion.maxPitch)

## A planted leg folded back no tighter than this (root to wrist).
static func _fold(key: String, p: Dictionary) -> float:
	var limb := _leg(key, p)
	return absf(limb.a - limb.b) + p.reachMargin

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
	var length := _wrist(s, key, p, paw).distance_to(_girdle(s, key, p).root)
	return length <= _reach(key, p) and length >= _fold(key,p)

## A swinging paw is pulled in horizontally until the leg can reach it.
static func _reachable_paw(s: Dictionary, key: String, p: Dictionary, paw: Vector3) -> Vector3:
	var d: Vector3 = _wrist(s, key, p, paw) - _girdle(s, key, p).root
	var r := _reach(key, p)
	# A free paw waits above a lower tread until the trunk can descend far enough.
	var vertical := clampf(d.y,-r,r)
	paw.y+=vertical-d.y
	d.y=vertical
	var allowed := sqrt(maxf(0, r * r - d.y * d.y))
	var h := Vector2(d.x, d.z).length()
	if h <= allowed:
		var minimum := _fold(key,p)
		if d.length()<minimum:
			var horizontal:=Vector3(d.x,0,d.z)
			var axis: Vector3=horizontal.normalized() if h>1e-9 else _girdle(s,key,p).f
			return paw+axis*(sqrt(maxf(0,minimum*minimum-d.y*d.y))-h)
		return paw
	var k := allowed / maxf(h, 1e-9)
	return Vector3(paw.x + d.x * (k - 1), paw.y, paw.z + d.z * (k - 1))

## Alternating reach and ground projection also clears vertical stair risers during a swing.
static func _swing_paw(s: Dictionary, key: String, p: Dictionary, point: Vector3, ground: Callable) -> Vector3:
	for i in int(p.foothold.clearancePasses):
		point.y=maxf(point.y,ground.call(point))
		point=_reachable_paw(s,key,p,point)
		if point.y>=ground.call(point)-1e-6: break
	return point

## A leg may come up to OVERREACH short of its paw, only while the body rises back after a step
## (a curb): the leg is then straight and the paw that far off. tools/check_locomotion.gd holds the gait
## to it on curbs and stairs, including the swing over each riser.
const OVERREACH := 0.015

## A paw out of reach (a leg too short, or asked to fold tighter than it can): the leg straightens or
## folds as far as it goes toward it.
static func _knee(a: Vector3, b: Vector3, l1: float, l2: float, pole: Vector3) -> Vector3:
	var d := b - a
	var r := clampf(d.length(), absf(l1 - l2), l1 + l2)
	var u := d.normalized()
	var h := (l1 * l1 + r * r - l2 * l2) / (2 * maxf(r, 1e-9))
	var v := pole - u * pole.dot(u)
	if v.length() < 1e-7:
		v = Vector3.RIGHT - u * u.x
	return a + u * h + v.normalized() * sqrt(maxf(0, l1 * l1 - h * h))

static func create(position: Vector3, yaw: float, p: Dictionary) -> Dictionary:
	var s := {"position": position, "yaw": yaw, "hipYaw": yaw, "pitch": 0.0, "speed": 0.0, "actualSpeed": 0.0,
		"time": 0.0, "phase": 0.0, "gait": "walk", "feet": {}, "look": 0.0, "events": []}
	for key in LEGS:
		s.feet[key] = {"point": Vector3.ZERO, "swing": false, "elapsed": 0.0, "slide": 0.0,
			"duration": 0.0, "start": Vector3.ZERO, "target": Vector3.ZERO}
	for key in LEGS:
		s.feet[key].point = _girdle(s, key, p).neutral
	return s

## Step length grows with speed, so faster means longer steps, not only quicker legs.
static func _stride(gait: Dictionary, speed: float) -> float:
	var stride: float = minf(gait.stride.base + gait.stride.perSpeed * speed, gait.stride.maximum)
	# At a slow pace the swing is capped at its natural duration, so stance occupies
	# more of the cycle. Bound actual stance travel, not a fixed duty-fraction estimate.
	for i in 2:
		var swing: float = _swing_time(gait, speed / stride)
		stride = minf(stride, gait.stride.maximumStance + speed * swing)
	return stride

static func _swing_time(gait: Dictionary, frequency: float) -> float:
	var w: Dictionary = gait.swing
	return clampf(w.k / maxf(frequency, w.minFrequency), w.min, w.max)

static func _lift(s: Dictionary, key: String, p: Dictionary, frequency: float, swing_time: float, ground: Callable, event_delay: float = 0.0) -> void:
	var foot: Dictionary = s.feet[key]
	var period := 1.0 / frequency if frequency > 0 else 0.0
	# Land ahead of the rest spot by the travel during the swing plus half the stance, so the paw
	# passes under its girdle mid-stance.
	var travel: Vector3 = _forward(s.yaw) * s.speed * (event_delay + swing_time + 0.5 * maxf(0, period - swing_time))
	foot.swing = true
	foot.elapsed = -event_delay
	foot.duration = swing_time
	foot.start = foot.point
	foot.target = _girdle(s, key, p).neutral + travel
	foot.target.y = ground.call(foot.target)
	# Do not skip a stair tread: the farthest admissible foothold before the next riser.
	var start_height: float = ground.call(foot.start)
	var candidate: Vector3 = foot.start
	for i in range(1,int(p.foothold.samples)+1):
		var sample: Vector3 = foot.start.lerp(foot.target,float(i)/p.foothold.samples)
		sample.y=ground.call(sample)
		if absf(sample.y-start_height)>p.foothold.maxStep: break
		candidate=sample
	foot.target=candidate
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
	assert(input.get("ground") is Callable, "dog step: input needs ground, a Callable(Vector3) -> height")
	var ground: Callable = input.ground
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
			_lift(s, key, p, frequency, swing_time, ground, until / frequency)
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
			_lift(s, worst, p, frequency, swing_time, ground)
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
			_lift(s, q, p, frequency, swing_time, ground)
	s.actualSpeed = s.position.distance_to(from.position) / dt
	for key in LEGS:
		var foot: Dictionary = s.feet[key]
		if not foot.swing:
			continue
		foot.elapsed += dt
		var t := minf(1, foot.elapsed / foot.duration)
		var point: Vector3 = foot.start.lerp(foot.target, t * t * (3 - 2 * t))
		point.y += _leg(key, p).lift * sin(PI * t)
		foot.point = _swing_paw(s, key, p, point,ground)
		if t >= 1:
			var landing: Vector3=foot.point
			landing.y=ground.call(landing)
			if _reachable(s,key,p,landing):
				foot.point=landing
				foot.swing = false
				s.events.append({"type": "land", "leg": key})
			else:
				# The other feet moved the trunk while this paw was waiting; choose a current tread.
				_lift(s,key,p,frequency,swing_time,ground)
	var was := {"F": s.position.y, "H": _hind_base(s, p)}
	var old_slides := {}
	for key in LEGS: old_slides[key]=s.feet[key].slide
	var mean := {"F": 0.0, "H": 0.0}
	for key in LEGS:
		mean[key[1]] += (s.feet[key].target.y if s.feet[key].swing else s.feet[key].point.y) / 2
	_set_heights(s, mean.F, mean.H, p)
	# On a step (a curb) the mean can leave a paw out of reach: one on the lower side, or a planted
	# one while the girdle rises after a paw left the lower side. Each girdle stays low enough for its
	# planted paws and its paws below the others (level ground keeps the mean: planted paws were fitted
	# at this height above), and high enough that no planted leg folds tighter than it can.
	var height: Dictionary = mean.duplicate()
	for girdle in ["F", "H"]:
		var sink := 0.0
		var lift := 0.0
		for key in LEGS:
			if key[1] != girdle:
				continue
			var paw: Vector3 = s.feet[key].point  # where it is now: a paw swinging up a step starts low
			if s.feet[key].swing and paw.y > mean[girdle] - 0.01:
				continue
			var d: Vector3 = _wrist(s, key, p, paw) - _girdle(s, key, p).root
			var r := _reach(key, p)
			var q := _fold(key, p)
			var h := Vector2(d.x, d.z).length()
			if h < r and -d.y > sqrt(r * r - h * h):
				sink = maxf(sink, -d.y - sqrt(r * r - h * h))
			if not s.feet[key].swing and h < q and -d.y < sqrt(q * q - h * h):
				lift = maxf(lift, sqrt(q * q - h * h) + d.y)
		# It sinks at once but rises no faster than riseSpeed (up a step, or back up after one), except
		# as far as a planted leg needs not to fold too tight (a paw just landed on a step up).
		height[girdle] = minf(height[girdle] - sink, was[girdle] + p.motion.riseSpeed * dt)
		if lift > 0:
			# A leg that would stretch too far and one that would fold too tight (paws a step apart on a
			# leg pair whose reach spans less than the step): the girdle goes between, each off by half.
			height[girdle] = mean[girdle] + (lift - sink) / 2 if sink > 0 else maxf(height[girdle], mean[girdle] + lift)
	_set_heights(s, height.F, height.H, p)
	# What the girdle's height leaves over, the top of each planted leg takes up by sliding.
	for key in LEGS:
		var foot: Dictionary = s.feet[key]
		if foot.swing:
			foot.slide = move_toward(foot.slide, 0.0, p.slideRate * dt)
			continue
		foot.slide = 0.0
		var d: Vector3 = _wrist(s, key, p, foot.point) - _girdle(s, key, p).root
		var r := _reach(key, p)
		var q := _fold(key, p)
		var h := Vector2(d.x, d.z).length()
		if h < r and -d.y > sqrt(r * r - h * h):
			foot.slide = -minf(-d.y - sqrt(r * r - h * h), p.slide)
		elif h < q and -d.y < sqrt(q * q - h * h):
			foot.slide = minf(sqrt(q * q - h * h) + d.y, p.slide)
	# Pitch also moves the hips horizontally. Preserve planted reach while the front descends.
	if not _planted_fit(s,p):
		var wanted_heights := Vector2(s.position.y,_hind_base(s,p))
		var wanted_slides := {}
		for key in LEGS:
			wanted_slides[key]=s.feet[key].slide
			s.feet[key].slide=old_slides[key]
		_set_heights(s,was.F,was.H,p)
		if _planted_fit(s,p):
			var lo := 0.0
			var hi := 1.0
			for i in 20:
				var t: float=(lo+hi)/2
				for key in LEGS: s.feet[key].slide=lerpf(old_slides[key],wanted_slides[key],t)
				_set_heights(s,lerpf(was.F,wanted_heights.x,t),lerpf(was.H,wanted_heights.y,t),p)
				if _planted_fit(s,p):lo=t
				else:hi=t
			for key in LEGS: s.feet[key].slide=lerpf(old_slides[key],wanted_slides[key],lo)
			_set_heights(s,lerpf(was.F,wanted_heights.x,lo),lerpf(was.H,wanted_heights.y,lo),p)
		else:
			for key in LEGS: s.feet[key].slide=wanted_slides[key]
			_set_heights(s,wanted_heights.x,wanted_heights.y,p)
	# The girdles moved: a swinging paw stays within reach of where they are now.
	for key in LEGS:
		if s.feet[key].swing:
			s.feet[key].point = _swing_paw(s, key, p, s.feet[key].point,ground)
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
	var hip: Vector3 = (_girdle(s, "LH", p).root + _girdle(s, "RH", p).root) / 2 + up * p.legs.hind.drop
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
