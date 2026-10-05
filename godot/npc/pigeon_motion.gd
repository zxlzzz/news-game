## Named, stateless local pigeon poses/transitions. No route, displacement,
## destination, autonomous action switch or random clock. Caller owns root transform.
## entries() -> [{id,label,duration,loop,start_pose,end_pose,variant,...}]
## sample(id,time,ProceduralPigeon.load_params(),context={}) -> drawable pose
## context.velocity is the caller's velocity (only climb angle/speed are read),
## turn_rate is signed heading radians/s (positive toward +X), brake is [0,1].
extends RefCounted

const Pigeon = preload("res://npc/procedural_pigeon.gd")
const FILE = "res://npc/pigeon-motion.json"
static var _data: Dictionary = {}

static func library() -> Dictionary:
	if not _data.is_empty(): return _data
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(FILE))
	assert(parsed is Dictionary, FILE + ": expected object")
	_data = parsed
	for id in _data.motions:
		var entry: Dictionary = _data.motions[id]
		assert(entry.duration > 0 and entry.keys.size() >= 2, id + ": invalid timing")
		assert(entry.keys[0].phase == 0 and entry.keys[-1].phase == 1, id + ": missing endpoints")
		assert(entry.keys[0].pose == entry.start_pose and entry.keys[-1].pose == entry.end_pose, id + ": endpoint mismatch")
		assert(_values(entry.keys[0]) == _values({"pose": entry.start_pose}) and _values(entry.keys[-1]) == _values({"pose": entry.end_pose}), id + ": endpoint overrides change named pose")
		if entry.loop: assert(entry.start_pose == entry.end_pose, id + ": loop endpoints differ")
		var previous := -1.0
		for key in entry.keys:
			assert(key.phase > previous and key.phase <= 1, id + ": unordered keys")
			previous = key.phase
			_values(key)
	return _data

static func entries() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for id in library().motions:
		var m: Dictionary = _data.motions[id]
		var preview: Dictionary = _data.preview[m.support]
		out.append({"id": id, "label": m.label, "duration": m.duration, "loop": m.loop,
			"start_pose": m.start_pose, "end_pose": m.end_pose, "variant": m.variant,
			"support": m.support, "frame": preview.frame, "root_height": preview.root_height,
			"target_height": preview.target_height})
	return out

static func duration(id: String) -> float:
	assert(library().motions.has(id), "Unknown pigeon motion: " + id)
	return _data.motions[id].duration

static func loop(id: String) -> bool:
	assert(library().motions.has(id), "Unknown pigeon motion: " + id)
	return _data.motions[id].loop

static func _values(key: Dictionary) -> Dictionary:
	assert(_data.poses.has(key.pose), "Unknown pigeon pose: " + str(key.pose))
	var out: Dictionary = _data.defaults.duplicate(true)
	for source in [_data.poses[key.pose], key.get("values", {})]:
		for channel in source:
			assert(out.has(channel) and (source[channel] is float or source[channel] is int),
				"Unknown/non-numeric pigeon channel: " + str(channel))
			out[channel] = float(source[channel])
			assert(is_finite(out[channel]), "Invalid pigeon value: " + str(channel))
	return out

static func channels(id: String, time: float, repeat := true) -> Dictionary:
	assert(library().motions.has(id), "Unknown pigeon motion: " + id)
	var m: Dictionary = _data.motions[id]
	var phase := fposmod(time / m.duration, 1.0) if m.loop and repeat else clampf(time / m.duration, 0, 1)
	var out: Dictionary = {}
	for i in range(m.keys.size() - 1):
		var a: Dictionary = m.keys[i]
		var b: Dictionary = m.keys[i + 1]
		if phase > b.phase: continue
		var first := _values(a)
		var last := _values(b)
		var blend := smoothstep(0.0, 1.0, (phase - a.phase) / (b.phase - a.phase))
		for channel in first: out[channel] = lerpf(first[channel], last[channel], blend)
		break
	assert(not out.is_empty(), id + ": unsampled motion")
	out.wing_frame += m.get("flap_cycles", 0) * _data.wing_frame_count * phase
	out.gait_phase += m.get("gait_cycles", 0) * phase
	return out

static func sample(id: String, time: float, params: Dictionary, context: Dictionary = {}, repeat := true) -> Dictionary:
	var q := channels(id, time, repeat)
	var m: Dictionary = _data.motions[id]
	assert(params.wingShapes.flap.size() == _data.wing_frame_count, "Pigeon wing shape count differs from motion data")
	for key in context: assert(key in ["velocity", "turn_rate", "brake"], "Pigeon motion context has no route/transform: " + str(key))
	if m.adaptation == "air":
		var a: Dictionary = _data.adaptation
		var velocity: Vector3 = context.get("velocity", Vector3.ZERO)
		assert(velocity.is_finite(), "Invalid pigeon velocity")
		var horizontal := Vector2(velocity.x, velocity.z).length()
		var climb_angle := atan2(velocity.y, maxf(horizontal, a.minimum_horizontal_speed))
		var turn_rate: float = context.get("turn_rate", 0.0)
		var brake: float = context.get("brake", 0.0)
		assert(is_finite(turn_rate) and is_finite(brake), "Invalid pigeon attitude context")
		q.pitch = clampf(q.pitch + q.air_weight * clampf(climb_angle * a.climb_pitch_gain, -a.maximum_pitch_offset, a.maximum_pitch_offset), a.pitch_limits[0], a.pitch_limits[1])
		q.roll = clampf(q.roll - q.air_weight * turn_rate * a.turn_roll_gain, -a.maximum_roll, a.maximum_roll)
		var braking: float = q.air_weight * clampf(brake, 0, 1)
		q.pitch = clampf(q.pitch + braking * a.brake_pitch, a.pitch_limits[0], a.pitch_limits[1])
		q.tuck = clampf(q.tuck - braking * a.brake_extend_feet, 0, 1)
		q.toe_curl = clampf(q.toe_curl - braking * a.brake_extend_feet, 0, 1)
		q.tail_spread = lerpf(q.tail_spread, 1.0, braking)
		q.glide = lerpf(q.glide, 1.0, braking * a.brake_glide)
	var s := Pigeon.create(Vector3.ZERO, 0.0, params)
	s.pitch = q.pitch
	s.crouch = q.crouch
	s.position.y = q.body_lift
	s.wingOpen = q.wing_open
	s.wingFrame = q.wing_frame
	s.glide = q.glide
	s.tailSpread = q.tail_spread
	s.tuck = q.tuck
	s.headAir = q.head_air
	s.headOffset = q.head_offset
	s.look = q.look
	s.peck = q.peck
	s.peckPhase = params.head.peck.down * 0.5
	s.toeCurl = q.toe_curl
	s.footPoints = {}
	var frame := Pigeon._body(s, params)
	var gait: Dictionary = _data.gait
	for key in Pigeon.FEET:
		var side := 1.0 if key == "L" else -1.0
		var hip := Pigeon._hip_joint(frame, key, params)
		var ground := Vector3(side * params.legs.footHalfWidth, 0, 0)
		var phase := fposmod(q.gait_phase + (0.0 if key == "L" else 0.5), 1.0)
		var travel: float
		var lift := 0.0
		if phase < gait.swing_fraction:
			var u: float = phase / gait.swing_fraction
			travel = lerpf(-gait.half_stride, gait.half_stride, smoothstep(0, 1, u))
			lift = gait.foot_lift * sin(PI * u)
		else:
			travel = lerpf(gait.half_stride, -gait.half_stride, (phase - gait.swing_fraction) / (1 - gait.swing_fraction))
		ground.z += travel * q.gait_weight
		ground.y += lift * q.gait_weight
		var tucked: Vector3 = Pigeon._at(frame, params.legs.tuck) + frame.left * side * params.legs.hipHalfWidth
		var hanging: Vector3 = hip + Vector3.DOWN * Pigeon._reach(params) * params.legs.hang + frame.f * params.legs.hangForward
		s.footPoints[key] = ground.lerp(hanging.lerp(tucked, q.tuck), q.foot_air)
	var pts := Pigeon.pose(s, params)
	# Bank around the local body line, not a translated/curved world trajectory.
	if q.roll != 0:
		for key in ["neck", "beak", "tail", "L", "R", "toesL", "toesR", "wingL", "wingR"]:
			for i in pts[key].size(): pts[key][i] = frame.hip + (pts[key][i] - frame.hip).rotated(frame.bf, q.roll)
		for disc in pts.body: disc[0] = frame.hip + (disc[0] - frame.hip).rotated(frame.bf, q.roll)
	return pts
