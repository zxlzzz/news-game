extends SceneTree

const Model := preload("res://npc/animal_model.gd")
const Animal := preload("res://npc/animal.gd")
const Pigeon := preload("res://npc/procedural_pigeon.gd")
const Preview := preload("res://tools/animal_behaviour_preview.gd")

func behaviour_audit(m: Dictionary, dog: Dictionary) -> Dictionary:
	var c: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/animal-behaviour.json"))
	var s := Preview.create(m, dog, c)
	var events := []
	var state := ""
	var modes := {}
	var blocked := 0
	var current := 0
	var longest := 0
	var maximum_radius := 0.0
	var minimum_gap := 1e9
	for k in int(c.review.behaviour_duration * 60):
		s = Preview.step(s, m, dog, c, 1.0 / 60.0)
		modes[s.brain.mode] = true
		var now: String = s.brain.mode + ":" + Animal.doing(s.animal) + ":" + s.animal.clip
		if now != state:
			events.append({"t": s.time, "state": now, "position": vec(s.animal.position), "speed": s.animal.actualSpeed,
				"rest_index": s.brain.rest_index, "mode_elapsed": s.brain.elapsed, "mode_duration": s.brain.duration})
			state = now
		if s.brain.mode == "flee" and Animal.doing(s.animal) != "walk":
			blocked += 1
			current += 1
			longest = maxi(longest, current)
		else:
			current = 0
		maximum_radius = maxf(maximum_radius, s.animal.position.length() + m.p.body.radius)
		if m.species == "cat": minimum_gap = minf(minimum_gap, Preview.body_gap(s, m, dog))
	return {"modes": modes.keys(), "flee_blocked_seconds": blocked / 60.0, "longest_flee_blocked_seconds": longest / 60.0,
		"maximum_radius": maximum_radius, "cat_dog_body_gap_min": minimum_gap if m.species == "cat" else null, "transitions": events}

func vec(v: Vector3) -> Array:
	return [v.x, v.y, v.z]

func transform(x: Transform3D) -> Array:
	return [vec(x.basis.x), vec(x.basis.y), vec(x.basis.z), vec(x.origin)]

func frame(m: Dictionary, s: Dictionary, time: float) -> Dictionary:
	var pose := Model.pose(m, s)
	var g := []
	for x in pose.globals:
		g.append(transform(x))
	var foot := {}
	for k in Model.LEGS:
		foot[k] = {"point": vec(s.feet[k].point), "swing": s.feet[k].swing}
	return {"t": time, "phase": Animal.doing(s), "clip": s.clip, "clip_time": s.clip_time,
		"weight": s.weight, "position": vec(s.position), "yaw": s.yaw, "speed": s.actualSpeed,
		"feet": foot, "globals": g, "root": transform(pose.root)}

func scenario(m: Dictionary, action: String, speed: float, yaw_curve: bool = false, custom_end: float = 10.0) -> Dictionary:
	var dt := 1.0 / 60.0
	var s := Animal.create(Vector3.ZERO, 0, m)
	var prev := []
	var states := []
	var sampled := []
	var fastest := {"speed": 0.0, "t": 0.0, "bone": ""}
	var moving_paw_max := 0.0
	var phase := ""
	var transitions := []
	var previous_frame := {}
	var ground := func(_p: Vector3) -> float: return 0.0
	for k in range(960):
		var t := (k + 1) * dt
		var want := action if t >= 2.0 and t < custom_end else ""
		var yaw := sin(t * 0.3) * 0.6 if yaw_curve else 0.0
		s = Animal.step(s, {"speed": speed, "yaw": yaw, "action": want, "ground": ground}, dt, m)
		var pose := Model.pose(m, s)
		var world := []
		for x in pose.globals:
			world.append(pose.root * (x.origin as Vector3))
		var state: String = Animal.doing(s) + ":" + s.clip
		if state != phase:
			transitions.append({"t": t, "from": phase, "to": state})
			if not previous_frame.is_empty(): sampled.append(previous_frame)
			sampled.append(frame(m, s, t))
			phase = state
		if not prev.is_empty():
			for i in world.size():
				var v: float = world[i].distance_to(prev[i]) / dt
				if v > fastest.speed:
					fastest = {"speed": v, "t": t, "bone": m.names[i], "state": state}
			if s.weight == 0.0:
				for key in Model.LEGS:
					var ids: Array = m.legs[key].ids
					if not s.feet[key].swing:
						moving_paw_max = maxf(moving_paw_max, world[ids[-1]].distance_to(prev[ids[-1]]) / dt)
		if k % 30 == 0:
			sampled.append(frame(m, s, t))
		previous_frame = frame(m, s, t) if k % 1 == 0 else {}
		prev = world
		if action == "" and not yaw_curve and t > 3.0:
			var local_paws := {}
			for key in Model.LEGS:
				local_paws[key] = vec(pose.globals[m.legs[key].ids[-1]].origin)
			states.append({"t": t, "phase": s.phase, "speed": s.actualSpeed, "paws": local_paws})
	return {"speed_requested": speed, "yaw_curve": yaw_curve, "action_end_requested": custom_end,
		"transitions": transitions, "fastest_bone": fastest, "planted_bone_speed_max": moving_paw_max,
		"final_state": Animal.doing(s), "frames": sampled, "gait_frames": states}

func pigeon_audit() -> Dictionary:
	var p := Pigeon.load_params()
	var s := Pigeon.create(Vector3.ZERO, 0.0, p)
	var prev := {}
	var transitions := []
	var frames := []
	var mode := ""
	var fastest := {"speed": 0.0, "t": 0.0, "point": ""}
	var ground_mesh := {"beak_tip_min": 1e9, "head_min": 1e9, "body_min": 1e9, "peck_frames": 0, "beak_below_ground_frames": 0}
	for k in 1560:
		var dt := 1.0 / 60.0
		var t: float = k * dt
		var flying: bool = t >= 15 and t < 20.5
		var peck: bool = t >= 9 and t < 12.5
		var hop = null
		for at in [13.0, 14.0]:
			if t - dt < at and at <= t:
				hop = s.position + Vector3(sin(s.yaw), 0, cos(s.yaw)) * 0.3
		var speed: float = 0.3 if t < 5 else (0.06 if peck else (1.6 if t >= 15 and s.mode != "ground" else 0.0))
		var yaw: float = (t - 15) * 0.9 if t >= 15 else sin(t * 0.3) * 1.0
		s = Pigeon.step(s, {"speed": speed, "yaw": yaw, "ground": 0.0, "peck": peck,
			"hop": hop, "fly": flying, "altitude": 1.2}, dt, p)
		var pose: Dictionary = Pigeon.pose(s, p)
		if s.mode == "ground" and peck:
			ground_mesh.peck_frames += 1
			var tip_height: float = pose.beak[1].y
			if tip_height < ground_mesh.beak_tip_min:
				ground_mesh.beak_tip_min = tip_height
				ground_mesh.beak_tip_min_at = t
			if tip_height < 0: ground_mesh.beak_below_ground_frames += 1
			ground_mesh.head_min = minf(ground_mesh.head_min, pose.neck[1].y - p.silhouette.head)
			for part in pose.body: ground_mesh.body_min = minf(ground_mesh.body_min, part[0].y - part[1])
		if s.mode != mode:
			transitions.append({"t": t, "from": mode, "to": s.mode})
			mode = s.mode
		var points := {}
		for key in ["neck", "beak", "L", "R", "wingL", "wingR", "tail"]:
			for j in pose[key].size():
				points[key + str(j)] = pose[key][j]
		for key in points:
			if prev.has(key):
				var v: float = points[key].distance_to(prev[key]) / dt
				if v > fastest.speed: fastest = {"speed": v, "t": t, "point": key, "mode": mode}
		if k % 15 == 0:
			var serialized := {}
			for key in points: serialized[key] = vec(points[key])
			frames.append({"t": t, "mode": s.mode, "position": vec(s.position), "speed": s.speed,
				"vy": s.vy, "points": serialized, "peck": s.peck, "tuck": s.tuck})
		prev = points
	return {"transitions": transitions, "fastest_point": fastest, "peck_ground": ground_mesh, "frames": frames}

func _initialize() -> void:
	var result := {"breeds": {}}
	var c := Model.config()
	if OS.get_cmdline_user_args().size() > 1 and OS.get_cmdline_user_args()[1] == "behaviour":
		for breed in c.breeds:
			result.breeds[breed] = behaviour_audit(Model.info(breed), Model.info("husky"))
		var file := FileAccess.open(OS.get_cmdline_user_args()[0], FileAccess.WRITE)
		file.store_string(JSON.stringify(result))
		quit()
		return
	if OS.get_cmdline_user_args().size() > 1 and OS.get_cmdline_user_args()[1] == "pigeon":
		var file := FileAccess.open(OS.get_cmdline_user_args()[0], FileAccess.WRITE)
		file.store_string(JSON.stringify(pigeon_audit()))
		quit()
		return
	if OS.get_cmdline_user_args().size() > 1:
		for breed in c.breeds:
			var m := Model.info(breed)
			result.breeds[breed] = {}
			for action in ["sit", "sleep", "shake", "startle"]:
				result.breeds[breed][action] = scenario(m, action, 0.35, false, 3.0)
		var file := FileAccess.open(OS.get_cmdline_user_args()[0], FileAccess.WRITE)
		file.store_string(JSON.stringify(result))
		quit()
		return
	for breed in c.breeds:
		var m := Model.info(breed)
		assert(m.error == "", m.error)
		var record := {"names": m.names, "parent": m.parent, "drop": m.drop, "gait": m.p,
			"walk_clip": m.walk_clip, "stand_clip": m.stand_clip, "clips": {}, "actions": {}, "gaits": {}}
		for name in m.clips: record.clips[name] = {"length": m.clips[name].length, "tracks": m.clips[name].tracks.size()}
		for action in c.species[m.species]:
			record.actions[action] = scenario(m, action, 0.35)
		for speed in [0.15, 0.35, 0.7, 1.3]:
			record.gaits[str(speed)] = scenario(m, "", speed)
		record.gaits["turn"] = scenario(m, "", 0.35, true)
		record.actions["sit_short_request"] = scenario(m, "sit", 0.35, false, 2.2)
		record.actions["sleep_short_request"] = scenario(m, "sleep", 0.35, false, 2.2)
		result.breeds[breed] = record
		print("AUDITED ", breed, " actions ", c.species[m.species].size())
	result.pigeon = pigeon_audit()
	var path := OS.get_cmdline_user_args()[0]
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	file.close()
	print("ANIMAL_AUDIT_DUMP ", path)
	quit()
