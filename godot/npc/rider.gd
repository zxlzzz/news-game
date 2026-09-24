## A stick-figure rider on any two-wheeler, as pure functions. Nothing here knows a particular
## vehicle: the pose is solved every frame from the contact points the vehicle reports
## (types/two_wheeler.gd contacts(): seat, grips, feet — pedals or footrests) and from the figure's
## fixed limb lengths (skeleton-params.json x body scale). Style numbers are in npc/rider-params.json;
## a vehicle type may override any of them (two_wheeler.gd rider_style).
##
##   var st = Rider.start()
##   st = Rider.step(st, {"speed": m/s, "yawRate": rad/s, "pedalling": bool}, dt, vehicle.info(), R)
##   vehicle.set_motion(st.wheelAngle, st.crankPhase); vehicle.rotation.z = st.roll (lean into turns)
##   var pose = Rider.solve(vehicle.contacts(st.crankPhase), P, scale, R, st)
##   figure.draw(pose.segments, pose.discs, [])      # figure is a child of the vehicle, scale 1
##
## Vehicle axes: +Z forward, +Y up, +X the rider's left. The hips sit on the seat, hands on the grips,
## feet on the pedals or footrests; the torso lean is found so the arms reach the grips with a slight
## bend. Anything out of reach is reported in pose.errors (never fixed by moving the rider off a
## contact); tools/check_locomotion.gd fails on it.
extends RefCounted

static func load_params(path := "res://npc/rider-params.json") -> Dictionary:
	var p = JSON.parse_string(FileAccess.get_file_as_string(path))
	assert(p is Dictionary, "%s: not a JSON object" % path)
	return p

## Rider params with a vehicle's overrides merged in (one level deep).
static func style(R: Dictionary, overrides: Dictionary) -> Dictionary:
	var out := R.duplicate(true)
	for k in overrides:
		if out.get(k) is Dictionary and overrides[k] is Dictionary:
			out[k].merge(overrides[k], true)
		else:
			out[k] = overrides[k]
	return out

static func start() -> Dictionary:
	return {"distance": 0.0, "wheelAngle": 0.0, "crankPhase": 0.0, "roll": 0.0, "time": 0.0, "speed": 0.0}

## vehicle: two_wheeler.gd info() -> {wheelRadius, travelPerCrankTurn, pedalled}.
## Pedalling turns the cranks with the wheel (gearing); coasting freewheels them to level pedals.
static func step(st: Dictionary, input: Dictionary, dt: float, vehicle: Dictionary, R: Dictionary) -> Dictionary:
	var s := st.duplicate()
	var speed: float = input.get("speed", 0.0)
	var d := speed * dt
	s.time += dt
	s.speed = speed
	s.distance += d
	s.wheelAngle = fposmod(s.wheelAngle + d / vehicle.wheelRadius, TAU)
	if vehicle.pedalled:
		if input.get("pedalling", true) and speed > 0:
			s.crankPhase = fposmod(s.crankPhase + TAU * d / vehicle.travelPerCrankTurn, TAU)
		else:
			# Level pedals: the left pedal (top at phase 0) is level at a quarter or three quarters turn.
			var level := PI / 2 if absf(angle_difference(s.crankPhase, PI / 2)) < PI / 2 else 3 * PI / 2
			s.crankPhase = fposmod(move_toward_angle(s.crankPhase, level, R.coast.settleRate * dt), TAU)
	var tl: Dictionary = R.turnLean
	var target := clampf(atan(speed * input.get("yawRate", 0.0) / tl.gravity), -tl.max, tl.max)
	s.roll += (target - s.roll) * (1 - exp(-dt * tl.rate))
	return s

static func move_toward_angle(from: float, to: float, delta: float) -> float:
	var diff := angle_difference(from, to)
	return from + clampf(diff, -delta, delta)

## Two-bone IK: joint between a and b for lengths l1, l2, bent toward pole. Out-of-range distances
## are clamped (the caller reports them).
static func _joint(a: Vector3, b: Vector3, l1: float, l2: float, pole: Vector3) -> Vector3:
	var dv := b - a
	var r := clampf(dv.length(), absf(l1 - l2) + 1e-5, l1 + l2 - 1e-5)
	var u := dv.normalized()
	var v := pole - u * pole.dot(u)
	if v.length() < 1e-6:
		v = Vector3.FORWARD - u * u.z
	var x := (l1 * l1 + r * r - l2 * l2) / (2 * r)
	return a + u * x + v.normalized() * sqrt(maxf(0, l1 * l1 - x * x))

## contacts: vehicle-local {seat, gripLeft, gripRight, footLeft, footRight}; P: skeleton-params;
## scale: body scale; st: step() state (for the pedal-stroke sway).
## Returns {segments, discs, points, errors}.
static func solve(c: Dictionary, P: Dictionary, scale: float, R: Dictionary, st: Dictionary) -> Dictionary:
	var up := Vector3.UP
	var fwd := Vector3.BACK  # +Z
	var left := Vector3.RIGHT  # +X
	var errors := []
	var hip: Vector3 = c.seat + up * R.hipAboveSeat * scale - fwd * R.hipBehindSeat * scale
	hip += up * R.sway.bob * scale * sin(2 * st.crankPhase)
	var torso: float = P.torso * scale
	var arm: float = (P.upperArm + P.foreArm) * scale
	var grips: Vector3 = (c.gripLeft + c.gripRight) / 2
	# Lean: the angle (forward of vertical) at which the shoulder-to-grip distance is armReach x arm.
	var want: float = R.lean.armReach * arm
	var dir := func(a: float) -> Vector3: return (up * cos(a) + fwd * sin(a))
	var lo: float = R.lean.min
	var hi: float = R.lean.max
	var lean := lo
	if (hip + dir.call(lo) * torso).distance_to(grips) <= want:
		lean = lo
	elif (hip + dir.call(hi) * torso).distance_to(grips) >= want:
		lean = hi
	else:
		for i in 30:
			lean = (lo + hi) / 2
			if (hip + dir.call(lean) * torso).distance_to(grips) > want:
				lo = lean
			else:
				hi = lean
	# Side-to-side rock with each pedal stroke (twice per crank turn), about the hip.
	var tdir: Vector3 = dir.call(lean).rotated(fwd, R.sway.roll * sin(st.crankPhase))
	var neck: Vector3 = hip + tdir * torso
	var head_dir: Vector3 = tdir.lerp(up, R.head.upBlend).normalized()
	var neck_end: Vector3 = neck + head_dir * P.neck * scale
	var head: Vector3 = neck_end + head_dir * P.headR * scale
	var line: float = P.line * scale
	var segs := [[hip, neck, line * P.torsoLine], [neck, neck_end, line * P.torsoLine]]
	var points := {"hip": hip, "neck": neck, "head": head, "lean": lean}
	var ep: Dictionary = R.elbowPole
	var kp: Dictionary = R.kneePole
	var ft: Dictionary = R.foot
	var foot_dir: Vector3 = (fwd * cos(ft.pitch) - up * sin(ft.pitch))
	var leg: float = (P.thigh + P.shin) * scale
	for sd in ["Left", "Right"]:
		var out := left if sd == "Left" else -left
		var grip: Vector3 = c["grip" + sd]
		var reach := neck.distance_to(grip)
		if reach > arm * R.limits.armExtension:
			errors.append("%s hand %.3f m short of the grip" % [sd.to_lower(), reach - arm * R.limits.armExtension])
		var elbow := _joint(neck, grip, P.upperArm * scale, P.foreArm * scale, out * ep.out + up * ep.up + fwd * ep.forward)
		# The ball of the foot on the contact; the line sits on top of the pedal/footrest.
		var contact: Vector3 = c["foot" + sd] + up * line / 2
		var ankle: Vector3 = contact - foot_dir * P.foot * scale * ft.ballAt
		var toe: Vector3 = ankle + foot_dir * P.foot * scale
		var span := hip.distance_to(ankle)
		if span > leg * R.limits.legExtension:
			errors.append("%s foot %.3f m short of its %s" % [sd.to_lower(), span - leg * R.limits.legExtension, "contact"])
		if span < leg * R.limits.limbFold:
			errors.append("%s knee folded tighter than limits.limbFold" % sd.to_lower())
		var knee := _joint(hip, ankle, P.thigh * scale, P.shin * scale, fwd * kp.forward + out * kp.out)
		segs.append_array([[neck, elbow, line], [elbow, grip, line], [hip, knee, line], [knee, ankle, line], [ankle, toe, line]])
		points["elbow" + sd] = elbow
		points["knee" + sd] = knee
		points["ankle" + sd] = ankle
		points["legExtension" + sd] = span / leg
		points["armExtension" + sd] = reach / arm
	return {"segments": segs, "discs": [[head, P.headR * scale]], "points": points, "errors": errors}
