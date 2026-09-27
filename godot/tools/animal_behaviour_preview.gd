## Shared deterministic behaviour preview step; used by both the renderer and whole-run checks.
extends RefCounted
const Brain = preload("res://npc/animal_controller.gd")
const Dog = preload("res://npc/procedural_dog.gd")
const Animal = preload("res://npc/animal_actions.gd")
const Cat = preload("res://npc/procedural_cat.gd")

static func create(species: String, p: Dictionary, c: Dictionary) -> Dictionary:
	var dog_p = Dog.load_params()
	return {"animal": Cat.create(Vector3.ZERO, 0, p) if species == "cat" else Animal.create(Vector3.ZERO, 0, p),
		"brain": Brain.create(), "other": Dog.create(Animal._v(c.review.approach_start), 0, dog_p),
		"other_p": dog_p, "time": 0.0}

static func people_at(time: float, c: Dictionary) -> Array:
	var people = []
	for route in c.review.people:
		people.append({"position": Vector3(route[0] + route[2] * fposmod(time, c.review.people_period), 0, route[1])})
	return people

static func step(previous: Dictionary, species: String, p: Dictionary, c: Dictionary, dt: float) -> Dictionary:
	var s = previous.duplicate(true)
	s.time += dt
	var own: Vector3 = s.animal.base.walk.position if species == "cat" else s.animal.walk.position
	var neighbours = []
	var own_radius = Brain.body_radius(p)
	if species == "cat":
		var other_radius = Brain.body_radius(s.other_p)
		var gap = own.distance_to(s.other.position) - own_radius - other_radius
		var approach_speed = minf(c.review.approach_speed, maxf(0, gap - c.brain.clearance) / c.brain.response_time)
		s.other = Dog.step(s.other, {"speed": approach_speed, "yaw": atan2(own.x - s.other.position.x, own.z - s.other.position.z), "ground": func(_q: Vector3) -> float: return 0.0}, dt, s.other_p)
		neighbours.append({"position": s.other.position, "species": "dog", "radius": other_radius})
	var command = Brain.step(s.brain, own, people_at(s.time, c), neighbours, dt, c, species,
		Animal._v(c.review.range_center), c.review.range_radius, own_radius)
	s.brain = command.state
	var current_yaw: float = s.animal.base.walk.yaw if species == "cat" else s.animal.walk.yaw
	# Brake before a large turn; the gait cannot instantly adopt the requested heading.
	var turn_factor = maxf(0, cos(command.yaw - current_yaw))
	var requested_speed = command.velocity.length() * turn_factor
	if species == "cat":
		var toward_other: Vector3 = s.other.position - own
		var forward = Vector3(sin(current_yaw), 0, cos(current_yaw))
		if toward_other.dot(forward) > 0:
			var clearance = toward_other.length() - own_radius - Brain.body_radius(s.other_p)
			requested_speed = minf(requested_speed, maxf(0, clearance - c.brain.clearance) / c.brain.response_time)
	var request = {"speed": requested_speed, "yaw": command.yaw, "action": command.action}
	s.animal = Cat.step(s.animal, request, dt, p, c) if species == "cat" else Animal.step(s.animal, request, dt, p, c)
	return s

static func body_gap(s: Dictionary, p: Dictionary) -> float:
	# The circumscribed body envelopes are wider than the actual torso/head silhouette.
	# A positive gap proves the bodies cannot overlap, regardless of their current yaw.
	return s.animal.base.walk.position.distance_to(s.other.position) - Brain.body_radius(p) - Brain.body_radius(s.other_p)
