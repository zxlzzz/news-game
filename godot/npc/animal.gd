## A dog or cat with a real model: the procedural gait (npc/procedural_dog.gd) and the model's action
## clips (npc/animal-models.json actions), as one pure state. The state is a gait state (Dog.step works
## on it, so position, yaw, feet... are read as usual) plus the action fields below.
##
##   var m := AnimalModel.info(breed)
##   var s := Animal.create(position, yaw, m)
##   s = Animal.step(s, {"speed": m/s, "yaw": rad, "action": "" | name, "ground": g}, dt, m)
##   AnimalModel.pose(m, s)                 # bones, for npc/animal_body.gd
##
## Entry waits for planted paws. A stopped hold plays its authored exit; when its current free-paw
## pose is far from the exit's first pose, recovery connects those poses before the exit plays.
## A new action, walking intent or explicit urgent command cancels from the displayed pose instead.
## A one-shot finishes once and is not repeated until the requested action changes.
extends RefCounted

const Dog := preload("res://npc/procedural_dog.gd")
const AnimalModel := preload("res://npc/animal_model.gd")

static func create(position: Vector3, yaw: float, m: Dictionary) -> Dictionary:
	var s: Dictionary = Dog.create(position, yaw, m.p)
	s.merge({"phase_": "walk", "action": "", "done": "", "queue": [], "clip": "", "clip_time": 0.0, "clip_loop": false,
		"from_clip": "", "from_time": 0.0, "from_loop": false, "fade": 1.0, "weight": 0.0, "still": 1.0,
		"ground": null, "return_pose": [], "return_target": [], "return_linear": [], "return_spin": [],
		"return_contacts": [], "return_air": [], "return_normals": {}, "return_limits": {}, "return_time": 0.0, "return_duration": 0.0, "return_feet": {},
		"return_out": [], "return_urgent": false, "return_plan": {}, "return_inertia": 1.0, "return_projection_evaluations": 0, "last_dt": 0.0})
	return s

## What it is doing: walk | in | hold | out | fade (the clips fading out).
static func doing(s: Dictionary) -> String:
	return "hold" if s.phase_ == "in" and s.clip_loop else s.phase_

static func step(previous: Dictionary, command: Dictionary, dt: float, m: Dictionary) -> Dictionary:
	var c: Dictionary = AnimalModel.config()
	var want: String = command.get("action", "")
	assert(want == "" or want in c.species[m.species], "%s cannot %s" % [m.breed, want])
	var s: Dictionary = previous
	s = s.duplicate(true)
	s.ground = command.ground
	if want != s.done:
		s = s.duplicate(true)
		s.done = ""
	if s.phase_ == "walk":
		var go: bool = want == "" or want == s.done
		s = Dog.step(s, {"speed": command.get("speed", 0.0) if go else 0.0, "yaw": command.get("yaw", s.yaw),
			"ground": command.ground}, dt, m.p)
		s.still = move_toward(s.still, 1.0 if s.actualSpeed < m.p.motion.stillSpeed else 0.0, dt * c.blend.stillRate)
		if not go and s.actualSpeed < c.settleSpeed and s.feet.values().all(func(f): return not f.swing):
			var a: Dictionary = c.actions[want]
			s.action = want
			s.queue = a.get("in", []).duplicate()
			if a.has("hold"):
				s.queue.append(a.hold)
			s.phase_ = "in"
			_next(s, false)
		s.last_dt = dt
		return s
	var urgent: bool = command.get("urgent", false) or command.get("speed", 0.0) > c.settleSpeed
	var normal_stop: bool = want == "" and not urgent
	if s.phase_ == "return":
		# A normal exit bridge is also interruptible. Fleeing may request zero speed
		# while turning, so its urgency is independent of the current speed request.
		if (urgent and not s.return_urgent) or (not s.return_out.is_empty() and want != ""):
			_begin_return(s, m, urgent)
	elif want != s.action:
		if normal_stop and s.clip_loop:
			_normal_out(s, m)
		elif not (normal_stop and s.phase_ in ["out", "fade"]):
			_begin_return(s, m, urgent)
	s.time += dt
	if s.phase_ == "return":
		_return_step(s, m, dt)
		s.last_dt = dt
		return s
	s.clip_time += dt * c.playbackSpeed
	s.from_time += dt * c.playbackSpeed
	s.fade = minf(1, s.fade + dt / c.blend.change) if s.fade < 1 else 1.0
	var a: Dictionary = c.actions[s.action]
	match s.phase_:
		"in", "out":
			s.weight = minf(1, s.weight + dt / c.blend.in) if s.phase_ == "in" else 1.0
			if not s.clip_loop and s.clip_time >= m.clips[s.clip].length:
				if not _next(s, false):
					if s.phase_ == "in" and not a.has("hold"):
						s.done = s.action
					_finish(s, m)
		"fade":
			s.weight = maxf(0, s.weight - dt / c.blend.out)
			if s.weight <= 0:
				s.phase_ = "walk"
				s.action = ""
	s.last_dt = dt
	return s

## Start the next queued clip; false when there is none. change: fade from where the current one is.
static func _next(s: Dictionary, change: bool) -> bool:
	if s.queue.is_empty():
		return false
	var c: Dictionary = AnimalModel.config()
	s.from_clip = s.clip
	s.from_time = s.clip_time
	s.from_loop = s.clip_loop
	s.fade = 0.0 if change else 1.0
	s.clip = s.queue.pop_front()
	s.clip_time = 0.0
	s.clip_loop = c.actions[s.action].get("hold", "") == s.clip and s.phase_ == "in"
	return true

## The clips end standing, the paws where they stood before: fade the clips out.
static func _finish(s: Dictionary, m: Dictionary) -> void:
	var shown: Dictionary = AnimalModel.pose(m, s)
	for key in AnimalModel.LEGS:
		var contact: Vector3 = shown.root * AnimalModel.sole(m, shown.globals, key)
		contact.y = s.ground.call(Vector3(contact.x, s.position.y, contact.z))
		s.feet[key].point = contact
		s.feet[key].swing = false
	s.hipYaw = s.yaw
	s.speed = 0.0
	s.phase_ = "fade"

static func _normal_out(s: Dictionary, m: Dictionary) -> void:
	var queue: Array = AnimalModel.config().actions[s.action].get("out", []).duplicate()
	if queue.is_empty():
		_finish(s, m)
		return
	var target_state: Dictionary = s.duplicate(true)
	target_state.phase_ = "out"
	target_state.clip = queue[0]
	target_state.clip_time = 0.0
	target_state.clip_loop = false
	target_state.fade = 1.0
	target_state.weight = 1.0
	var target: Dictionary = AnimalModel.pose(m, target_state)
	var shown: Dictionary = AnimalModel.pose(m, s)
	var travel := 0.0
	for key in AnimalModel.LEGS:
		travel = maxf(travel, AnimalModel.sole(m, shown.globals, key).distance_to(AnimalModel.sole(m, target.globals, key)))
	# A raised scratching paw must return to its supporting pose before the authored
	# sit-to-stand exit. The ordinary clip crossfade cannot cover that distance safely.
	if travel > AnimalModel.config().recovery.footSpeed * AnimalModel.config().blend.change:
		_begin_return(s, m, false, queue, target)
	else:
		s.queue = queue
		s.phase_ = "out"
		_next(s, true)

static func _begin_return(s: Dictionary, m: Dictionary, urgent: bool, out: Array = [], target: Dictionary = {}) -> void:
	var p: Dictionary = AnimalModel.config().recovery
	var shown := AnimalModel.pose(m, s)
	var previous: Dictionary = s.duplicate(true)
	s.return_pose = shown.locals.duplicate()
	var elapsed: float = s.last_dt
	previous.time = maxf(0, previous.time - elapsed)
	previous.clip_time = maxf(0, previous.clip_time - elapsed * AnimalModel.config().playbackSpeed)
	previous.from_time = maxf(0, previous.from_time - elapsed * AnimalModel.config().playbackSpeed)
	if previous.fade < 1:
		previous.fade = maxf(0, previous.fade - elapsed / AnimalModel.config().blend.change)
	if previous.phase_ == "in":
		previous.weight = maxf(0, previous.weight - elapsed / AnimalModel.config().blend.in)
	if previous.phase_ == "return":
		previous.return_time = maxf(0, previous.return_time - elapsed)
	var before := AnimalModel.pose(m, previous)
	s.return_linear = []
	s.return_spin = []
	for i in s.return_pose.size():
		var now: Transform3D = shown.locals[i]
		var old: Transform3D = before.locals[i]
		var q: Quaternion = old.basis.get_rotation_quaternion().inverse() * now.basis.get_rotation_quaternion()
		if q.w < 0:
			q = Quaternion(-q.x, -q.y, -q.z, -q.w)
		s.return_linear.append((now.origin - old.origin) / elapsed if elapsed > 0 and s.clip_time >= elapsed else Vector3.ZERO)
		s.return_spin.append(q.get_axis() * q.get_angle() / elapsed if elapsed > 0 and s.clip_time >= elapsed else Vector3.ZERO)
	# The grounding projection belongs to the captured pose too.
	var correction: Vector3 = shown.root.origin - s.position
	for i in s.return_pose.size():
		if m.parent[i] == -1:
			s.return_pose[i].origin += correction
	s.return_time = 0.0
	s.return_plan = {}
	s.return_inertia = 1.0
	s.return_duration = p.urgent if urgent else p.normal
	s.return_out = out.duplicate()
	s.return_urgent = urgent
	s.return_feet = {}
	s.return_contacts = []
	s.return_air = []
	var order: Array = AnimalModel.LEGS.duplicate()
	var destinations := {}
	for key in order:
		var to: Vector3 = target.root * AnimalModel.sole(m, target.globals, key) if not target.is_empty() else Dog._girdle(s, key, m.p).neutral
		if target.is_empty():
			to.y = s.ground.call(Vector3(to.x, s.position.y, to.z))
		destinations[key] = to
	# Replant the paws furthest from their standing support first. A sitting
	# hind paw cannot wait behind both forepaws while its hip moves past it.
	order.sort_custom(func(a, b):
		return ((shown.root * AnimalModel.sole(m, shown.globals, a)).distance_to(destinations[a]) >
			(shown.root * AnimalModel.sole(m, shown.globals, b)).distance_to(destinations[b])))
	for i in order.size():
		var key: String = order[i]
		var contact: Vector3 = shown.root * AnimalModel.sole(m, shown.globals, key)
		# Capture whether the drawn sole actually touches the floor. The former
		# 4 mm heuristic labelled a still-raised paw as planted, then IK lowered
		# its skin while the recovery plan retained the captured height.
		var airborne: bool = contact.y > s.ground.call(Vector3(contact.x, s.position.y, contact.z)) + AnimalModel.config().grounding.tolerance
		s.return_contacts.append(key)
		if airborne:
			s.return_air.append(key)
		var at: Vector3 = contact
		var to: Vector3 = destinations[key]
		var lift: float = p.lift * m.p.body.shoulderY
		var changes: bool = Vector2(at.x - to.x, at.z - to.z).length() > p.replantDistance * m.p.body.shoulderY
		var delay: float = p.stagger * i if changes else 0.0
		var travel: float = at.distance_to(to) / (p.footSpeed * s.return_duration)
		s.return_feet[key] = {"from": at, "to": to, "delay": delay,
			"end": minf(1, delay + maxf(p.stepFraction, travel)), "lift": lift if changes else 0.0}
		s.feet[key].point = at
		s.feet[key].swing = airborne
	var target_state: Dictionary = s.duplicate(true)
	target_state.phase_ = "walk"
	target_state.weight = 0.0
	target_state.speed = 0.0
	target_state.actualSpeed = 0.0
	target_state.still = 1.0
	target_state.hipYaw = target_state.yaw
	for key in AnimalModel.LEGS:
		target_state.feet[key].point = s.return_feet[key].to
		target_state.feet[key].swing = false
		target_state.feet[key].slide = 0.0
	var standing: Dictionary = AnimalModel.pose(m, target_state) if target.is_empty() else target
	s.return_normals = {}
	s.return_limits = {}
	for key in AnimalModel.LEGS:
		var start_normal := AnimalModel.bend_plane(m, shown.globals, key)
		var end_normal := AnimalModel.bend_plane(m, standing.globals, key)
		var start_frames: Array = AnimalModel.leg_frames(m, shown.globals, key)
		var end_frames: Array = AnimalModel.leg_frames(m, standing.globals, key)
		var leg: Dictionary = m.legs[key]
		var length: float = (shown.globals[leg.ids[2]].origin as Vector3).distance_to(shown.globals[leg.ids[0]].origin)
		var end_length: float = (standing.globals[leg.ids[2]].origin as Vector3).distance_to(standing.globals[leg.ids[0]].origin)
		s.return_limits[key] = [Vector2(maxf(0, length - absf(leg.a - leg.b)), maxf(0, leg.a + leg.b - length)),
			Vector2(maxf(0, end_length - absf(leg.a - leg.b)), maxf(0, leg.a + leg.b - end_length))]
		s.return_normals[key] = [start_normal, AnimalModel.leg_axis(m, shown.globals, key),
			end_normal, AnimalModel.leg_axis(m, standing.globals, key), start_frames[0], start_frames[1], end_frames[0], end_frames[1]]
	s.return_target = standing.locals.duplicate()
	var target_correction: Vector3 = standing.root.origin - s.position
	for i in s.return_target.size():
		if m.parent[i] == -1:
			s.return_target[i].origin += target_correction
	s.phase_ = "return"
	s.actualSpeed = 0.0
	s.speed = 0.0
	s.hipYaw = s.yaw
	s.still = 1.0

static func _return_step(s: Dictionary, m: Dictionary, dt: float) -> void:
	s.return_time = minf(s.return_duration, s.return_time + dt)
	var u: float = s.return_time / s.return_duration
	s.return_inertia = 1.0
	s.return_projection_evaluations = 0
	_plan_recovery(s,m)
	if u < 1 and not _recovery_feasible(s,m):
		# Inertial continuation must stay inside the complete-skin and planted-leg
		# domain. Preserve the largest feasible contribution; do not raise every
		# supporting paw when a fully extended leg blocks a penetrating body.
		s.return_inertia = 0.0
		_plan_recovery(s,m)
		if _recovery_feasible(s,m):
			var safe := 0.0
			var unsafe := 1.0
			for iteration in int(AnimalModel.config().recovery.inertiaProjectionSteps):
				s.return_inertia = (safe+unsafe)/2
				_plan_recovery(s,m)
				if _recovery_feasible(s,m):
					safe=s.return_inertia
				else:
					unsafe=s.return_inertia
			s.return_inertia=safe
		else:
			# A failure of the base pose is independent of inertia and must remain
			# visible to validation rather than silently replacing the motion.
			s.return_inertia=1.0
		_plan_recovery(s,m)
	if u >= 1:
		if not s.return_out.is_empty():
			s.phase_ = "out"
			s.queue = s.return_out.duplicate()
			s.weight = 1.0
			_next(s, false)
		else:
			s.phase_ = "walk"
			s.action = ""
			s.clip = ""
			s.weight = 0.0
		s.return_pose = []
		s.return_target = []
		s.return_linear = []
		s.return_spin = []
		s.return_contacts = []
		s.return_air = []
		s.return_normals = {}
		s.return_limits = {}
		s.return_feet = {}
		s.return_out = []
		s.return_urgent = false
		s.return_plan = {}
		s.return_inertia = 1.0

static func _recovery_feasible(s: Dictionary, m: Dictionary) -> bool:
	s.return_projection_evaluations += 1
	var shown: Dictionary = AnimalModel.pose(m,s)
	return shown.root.origin.y-s.position.y<=AnimalModel.config().grounding.tolerance

static func _plan_recovery(s: Dictionary, m: Dictionary) -> void:
	var u: float = s.return_time / s.return_duration
	s.return_plan = AnimalModel.recovery_pose(m, s)
	var raw: Array = s.return_plan.globals
	var root := Transform3D(Basis(Vector3.UP, s.yaw), s.position)
	for key in AnimalModel.LEGS:
		var f: Dictionary = s.return_feet[key]
		var t := clampf((u - f.delay) / (f.end - f.delay), 0, 1)
		var point: Vector3 = f.from.lerp(f.to, smoothstep(0, 1, t))
		var excursion := Vector2(f.to.x - f.from.x, f.to.z - f.from.z)
		for pass_index in int(AnimalModel.config().grounding.solePasses):
			var progress: float = clampf(Vector2(point.x - f.from.x, point.z - f.from.z).dot(excursion) / excursion.length_squared(), 0, 1) if not excursion.is_zero_approx() else smoothstep(0, 1, t)
			point.y = lerpf(f.from.y, f.to.y, progress) + f.lift * sin(PI * progress)
			if key in s.return_contacts and u < 1:
				# A folded limb cannot pull its wrist through the inner reach sphere.
				# Keep its free paw outside until the actual body has risen enough;
				# the step's lift follows that spatial progress, so it does not drag.
				var leg: Dictionary = m.legs[key]
				var at: Vector3 = raw[leg.ids[0]].origin
				var skin_offset: Vector3 = AnimalModel.sole(m, raw, key) - (raw[leg.ids[2]].origin as Vector3)
				var wrist: Vector3 = root.affine_inverse() * point - skin_offset
				var inner: float = AnimalModel._reach_limits(m, s, key).x
				var dy: float = wrist.y - at.y
				var horizontal := Vector2(wrist.x - at.x, wrist.z - at.z)
				var required: float = sqrt(maxf(0, inner * inner - dy * dy))
				if horizontal.length() < required and not horizontal.is_zero_approx():
					var correction: Vector2 = horizontal.normalized() * required - horizontal
					point += root.basis * Vector3(correction.x, 0, correction.y)
				if key in s.return_air:
					# A paw captured in the air also follows its actual sole trajectory.
					# Keep it within the body's outer reach instead of dropping its free
					# FK chain through the ground and lifting all other supporting paws.
					wrist = root.affine_inverse() * point - skin_offset
					var outward: Vector3 = wrist - at
					var outer: float = AnimalModel._reach_limits(m, s, key).y
					if outward.length() > outer:
						point += root.basis * (outward.normalized() * outer - outward)
		s.feet[key].point = point
		s.feet[key].swing = point.distance_to(f.to) > AnimalModel.config().grounding.tolerance and (t > 0 or point.y > s.ground.call(Vector3(point.x, s.position.y, point.z)) + AnimalModel.config().grounding.tolerance)
		if t >= 1 and point.distance_to(f.to) <= AnimalModel.config().grounding.tolerance:
			s.feet[key].point = f.to
			s.feet[key].swing = false
	if u < 1 and s.return_contacts.any(func(key): return s.feet[key].swing):
		# Supporting legs and complete-skin clearance both constrain the trunk.
		# Plan each currently free paw against that fitted displayed body, including
		# its clearance projection, rather than against unprojected FK alone.
		for pass_index in int(AnimalModel.config().grounding.passes):
			var display: Dictionary = AnimalModel.pose(m,s)
			var fitted: Array = display.globals
			var clearance: float = display.root.origin.y-s.position.y
			for key in s.return_contacts:
				if not s.feet[key].swing:
					continue
				var leg: Dictionary = m.legs[key]
				var at: Vector3 = fitted[leg.ids[0]].origin+Vector3.UP*clearance
				var offset: Vector3 = AnimalModel.sole(m,fitted,key)-(fitted[leg.ids[2]].origin as Vector3)
				var point: Vector3 = root.affine_inverse()*s.feet[key].point
				var wrist: Vector3 = point-offset
				var limits: Vector2 = AnimalModel._reach_limits(m,s,key)
				var horizontal := Vector2(wrist.x-at.x,wrist.z-at.z)
				var required: float = sqrt(maxf(0,limits.x*limits.x-(wrist.y-at.y)*(wrist.y-at.y)))
				if horizontal.length()<required and not horizontal.is_zero_approx():
					var correction: Vector2 = horizontal.normalized()*required-horizontal
					point+=Vector3(correction.x,0,correction.y)
				wrist=point-offset
				var outward: Vector3 = wrist-at
				if outward.length()>limits.y:
					point+=outward.normalized()*limits.y-outward
				s.feet[key].point=root*point
