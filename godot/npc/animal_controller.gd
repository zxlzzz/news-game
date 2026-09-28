## Pure deterministic roaming controller. Caller owns position and locomotion.
## step(state, position, people, animals, dt, config, species, centre, radius, body_radius)
## Neighbours provide position, species and radius. Every choice is carried in state.
extends RefCounted

static func create(yaw: float = 0) -> Dictionary:
	return {"time": 0.0, "mode": "walk", "elapsed": 0.0, "yaw": yaw,
		"away": Vector3.ZERO, "rest_index": 0, "rng_state": 0, "duration": 0.0,
		"target": Vector3.ZERO, "has_target": false}

static func body_radius(p: Dictionary) -> float:
	# Horizontal reach of the model about its origin (npc/animal_model.gd), any way it faces.
	return p.body.radius

static func _choose(s: Dictionary, p: Dictionary, centre: Vector3, radius: float) -> void:
	var rng = RandomNumberGenerator.new()
	rng.seed = int(p.seed)
	if s.rng_state != 0:
		rng.state = s.rng_state
	var angle = rng.randf_range(-PI, PI)
	var distance = sqrt(rng.randf()) * maxf(0, radius - p.range_turn_margin)
	s.target = centre + Vector3(sin(angle), 0, cos(angle)) * distance
	s.duration = rng.randf_range(p.walk_time_min, p.walk_time_max) if s.mode == "walk" else rng.randf_range(p.rest_time_min, p.rest_time_max)
	s.rng_state = rng.state
	s.has_target = true

static func step(previous: Dictionary, own: Vector3, people: Array, animals: Array,
		dt: float, c: Dictionary, species: String, centre: Vector3,
		radius: float, own_radius: float) -> Dictionary:
	assert(radius > own_radius + c.brain.range_stop_margin)
	var s = previous.duplicate(true)
	var p: Dictionary = c.brain
	s.time += dt
	s.elapsed += dt
	if not s.has_target:
		_choose(s, p, centre, radius - own_radius)
	var threat = Vector3.ZERO
	var nearest = INF
	var dog_near = false
	var animal_gap = INF
	var animal_away = Vector3.ZERO
	for person in people:
		var distance = own.distance_to(person.position)
		if distance < p.avoid_person and distance < nearest:
			nearest = distance
			threat = own - person.position
	for animal in animals:
		var distance = own.distance_to(animal.position)
		var gap = distance - own_radius - animal.radius
		if gap < animal_gap:
			animal_gap = gap
			animal_away = own - animal.position
		if species == "cat" and animal.species == "dog" and distance < p.avoid_animal and distance < nearest:
			nearest = distance
			threat = own - animal.position
			dog_near = true
	if nearest < INF:
		threat.y = 0
		if threat.length_squared() == 0:
			threat = Vector3(sin(s.yaw), 0, cos(s.yaw))
		s.away = threat.normalized()
		s.yaw = atan2(s.away.x, s.away.z)
		var new_mode = "arch" if dog_near and nearest > p.flee_distance else "flee"
		if s.mode != new_mode:
			s.mode = new_mode
			s.elapsed = 0.0
	elif s.mode in ["flee", "arch"]:
		if s.elapsed > p.escape_timeout:
			s.mode = "walk"
			s.elapsed = 0.0
			_choose(s, p, centre, radius - own_radius)
	elif s.elapsed > s.duration or (s.mode == "walk" and own.distance_to(s.target) < p.arrival_distance):
		s.mode = "rest" if s.mode == "walk" else "walk"
		s.elapsed = 0.0
		s.rest_index += 1
		_choose(s, p, centre, radius - own_radius)
	var speed = 0.0
	var action = ""
	if s.mode == "walk":
		var toward: Vector3 = s.target - own
		s.yaw = atan2(toward.x, toward.z)
		speed = p.walk_speed
	elif s.mode == "flee":
		speed = p.flee_speed
	elif s.mode == "arch":
		action = p.threat_action
	else:
		var rest: Array = p.rest_actions[species]
		action = rest[int(s.rest_index) % rest.size()]
	if species == "cat" and animal_gap < p.separation_priority_gap:
		# Body separation overrides a passer-by so fleeing cannot run into the dog.
		s.yaw = atan2(animal_away.x, animal_away.z)
		speed = p.flee_speed
		action = ""
		s.mode = "flee"
	var offset = own - centre
	var available = radius - own_radius - offset.length()
	if available < p.range_turn_margin:
		# Turn before reaching the boundary, and reserve room for the gait to brake.
		var inward = -offset.normalized()
		s.yaw = atan2(inward.x, inward.z)
		speed = minf(speed, maxf(0, available - p.range_stop_margin) / p.response_time)
	if species == "dog":
		speed = minf(speed, maxf(0, animal_gap - p.clearance) / p.response_time)
	return {"state": s, "velocity": Vector3(sin(s.yaw), 0, cos(s.yaw)) * speed,
		"yaw": s.yaw, "action": action}
