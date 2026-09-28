## Shared deterministic behaviour preview step (npc/animal-behaviour.json review block): a stray animal
## driven by npc/animal_controller.gd among scripted passers-by, and for a cat a dog walking up to it.
## Used by the empty ground and by tools/check_animals.gd.
extends RefCounted
const Brain = preload("res://npc/animal_controller.gd")
const Animal = preload("res://npc/animal.gd")
const AnimalModel = preload("res://npc/animal_model.gd")

static func _v(values: Array) -> Vector3:
	return Vector3(values[0], values[1], values[2])

static func _flat(_q: Vector3) -> float:
	return 0.0

## m: the animal's model info; dog: the approaching dog's (used for a cat).
static func create(m: Dictionary, dog: Dictionary, c: Dictionary) -> Dictionary:
	return {"animal": Animal.create(Vector3.ZERO, 0, m), "brain": Brain.create(),
		"other": Animal.create(_v(c.review.approach_start), 0, dog), "time": 0.0}

static func people_at(time: float, c: Dictionary) -> Array:
	var people = []
	for route in c.review.people:
		people.append({"position": Vector3(route[0] + route[2] * fposmod(time, c.review.people_period), 0, route[1])})
	return people

static func step(previous: Dictionary, m: Dictionary, dog: Dictionary, c: Dictionary, dt: float) -> Dictionary:
	var s = previous.duplicate()
	s.time += dt
	var own: Vector3 = s.animal.position
	var neighbours = []
	var own_radius = Brain.body_radius(m.p)
	var other_radius = Brain.body_radius(dog.p)
	if m.species == "cat":
		var gap = own.distance_to(s.other.position) - own_radius - other_radius
		var approach_speed = minf(c.review.approach_speed, maxf(0, gap - c.brain.clearance) / c.brain.response_time)
		s.other = Animal.step(s.other, {"speed": approach_speed, "yaw": atan2(own.x - s.other.position.x, own.z - s.other.position.z),
			"ground": _flat}, dt, dog)
		neighbours.append({"position": s.other.position, "species": "dog", "radius": other_radius})
	var command = Brain.step(s.brain, own, people_at(s.time, c), neighbours, dt, c, m.species,
		_v(c.review.range_center), c.review.range_radius, own_radius)
	s.brain = command.state
	var current_yaw: float = s.animal.yaw
	# Brake before a large turn; the gait cannot instantly adopt the requested heading.
	var turn_factor = maxf(0, cos(command.yaw - current_yaw))
	var requested_speed = command.velocity.length() * turn_factor
	if m.species == "cat":
		var toward_other: Vector3 = s.other.position - own
		var forward = Vector3(sin(current_yaw), 0, cos(current_yaw))
		if toward_other.dot(forward) > 0:
			var clearance = toward_other.length() - own_radius - other_radius
			requested_speed = minf(requested_speed, maxf(0, clearance - c.brain.clearance) / c.brain.response_time)
	s.animal = Animal.step(s.animal, {"speed": requested_speed, "yaw": command.yaw, "action": command.action, "ground": _flat}, dt, m)
	return s

## Positive: the two bodies cannot overlap, whichever way they face.
static func body_gap(s: Dictionary, m: Dictionary, dog: Dictionary) -> float:
	return s.animal.position.distance_to(s.other.position) - Brain.body_radius(m.p) - Brain.body_radius(dog.p)
