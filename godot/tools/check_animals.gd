## Checks the model animals (npc/animal.gd, npc/animal_model.gd) and their behaviour without drawing.
## Prints ANIMALS_OK or the failures.   godot --headless --path . -s res://tools/check_animals.gd
##  - every breed of npc/animal-models.json loads: bones, legs and every clip its species' actions use;
##  - the controller (npc/animal_controller.gd): it does not change its input, a dog moves away from a
##    near person, a cat does the threat action at a dog not too near and runs from a close one;
##  - every breed does every action of its species in the review scenario (walk, the action, walk on)
##    at 30/60/120 frames per second: no bone changes length, no joint moves faster than
##    checks.jointSpeed, while walking every paw is where the gait plants it, and it walks again after;
##  - the behaviour preview of each species is reproducible, keeps within its range, the cat never
##    touches the dog, and the dog both walks and rests, heading several ways.
extends SceneTree
const Animal = preload("res://npc/animal.gd")
const AnimalModel = preload("res://npc/animal_model.gd")
const Preview = preload("res://tools/animal_behaviour_preview.gd")
const Brain = preload("res://npc/animal_controller.gd")

var failures := []

func _fail(msg: String) -> void:
	failures.append(msg)
	printerr("  FAIL ", msg)

func _initialize() -> void:
	var c: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/animal-behaviour.json"))
	var models := {}
	for breed in AnimalModel.config().breeds:
		var m := AnimalModel.info(breed)
		if m.error != "":
			_fail(m.error)
		else:
			models[breed] = m
	if not failures.is_empty():
		_finish()
		return
	_check_brain(c, models[AnimalModel.breeds("dog")[0]], models[AnimalModel.breeds("cat")[0]])
	for breed in models:
		_check_actions(c, models[breed])
	for species in ["dog", "cat"]:
		_check_behaviour(c, models[AnimalModel.breeds(species)[0]], models[AnimalModel.breeds("dog")[0]])
	_finish()

func _finish() -> void:
	print("ANIMALS_OK" if failures.is_empty() else "ANIMALS_FAIL %d" % failures.size())
	quit(0 if failures.is_empty() else 1)

func _check_brain(c: Dictionary, dog: Dictionary, cat: Dictionary) -> void:
	var centre := Preview._v(c.review.range_center)
	var dog_r := Brain.body_radius(dog.p)
	var cat_r := Brain.body_radius(cat.p)
	var brain := Brain.create()
	var saved: Dictionary = brain.duplicate(true)
	var flee: Dictionary = Brain.step(brain, Vector3.ZERO, [{"position": Vector3(0, 0, c.brain.avoid_person / 2)}], [], c.review.dt, c, "dog", centre, c.review.range_radius, dog_r)
	if brain != saved:
		_fail("controller changed its input")
	if not (flee.velocity.z < 0 and flee.action == ""):
		_fail("a dog does not move away from a near person")
	var wary: Dictionary = Brain.step(brain, Vector3.ZERO, [], [{"position": Vector3(0, 0, (c.brain.avoid_animal + c.brain.flee_distance) / 2), "species": "dog", "radius": dog_r}], c.review.dt, c, "cat", centre, c.review.range_radius, cat_r)
	if wary.action != c.brain.threat_action:
		_fail("a cat does not %s at a dog not too near (does %s)" % [c.brain.threat_action, wary.action])
	var escape: Dictionary = Brain.step(brain, Vector3.ZERO, [], [{"position": Vector3(0, 0, c.brain.flee_distance / 2), "species": "dog", "radius": dog_r}], c.review.dt, c, "cat", centre, c.review.range_radius, cat_r)
	if escape.velocity.z >= 0:
		_fail("a cat does not run from a close dog")
	for species in c.brain.rest_actions:
		for action in c.brain.rest_actions[species]:
			if not action in AnimalModel.config().species[species]:
				_fail("brain rest action %s is not an action of %s" % [action, species])

func _check_actions(c: Dictionary, m: Dictionary) -> void:
	var q: Dictionary = c.review
	var k: Dictionary = c.checks
	var flat := func(_p: Vector3) -> float: return 0.0
	var worst_bone := 0.0
	var worst_speed := 0.0
	var worst_speed_at := ""
	var worst_paw := 0.0
	for action in AnimalModel.config().species[m.species]:
		for fps in [30, 60, 120]:
			var dt: float = 1.0 / fps
			var s := Animal.create(Vector3.ZERO, 0.0, m)
			var prev := []
			var did := false
			for frame in int(q.cycle * fps):
				var t: float = float(frame) / fps
				var active: bool = t >= q.walk_until and t < q.hold_until
				s = Animal.step(s, {"speed": q.speed, "yaw": 0.0, "action": action if active else "", "ground": flat}, dt, m)
				did = did or Animal.doing(s) != "walk"
				var pose := AnimalModel.pose(m, s)
				var world := []
				for i in pose.globals.size():
					var x: Transform3D = pose.locals[i]
					if not (x.origin.is_finite() and x.basis.is_finite()):
						_fail("%s %s: bone %s not finite" % [m.breed, action, m.names[i]])
						return
					world.append(pose.root * (pose.globals[i].origin as Vector3))
				for key in AnimalModel.LEGS:
					var ids: Array = m.legs[key].ids
					for j in range(1, ids.size()):
						worst_bone = maxf(worst_bone, absf((pose.locals[ids[j]].origin as Vector3).length() - (m.rest[ids[j]].origin as Vector3).length()))
					if s.weight == 0:
						var turn := Basis(Vector3.UP, s.yaw if key[1] == "F" else s.hipYaw)
						var want: Vector3 = s.feet[key].point + turn * ((m.rest_global[ids[-1]].origin as Vector3) - m.legs[key].sole)
						worst_paw = maxf(worst_paw, world[ids[-1]].distance_to(want))
				if not prev.is_empty():
					for i in world.size():
						var v: float = world[i].distance_to(prev[i]) / dt
						if v > worst_speed:
							worst_speed = v
							worst_speed_at = "%s %s %d fps t=%.2f %s (%s)" % [m.breed, action, fps, t, m.names[i], Animal.doing(s)]
				prev = world
			if not did:
				_fail("%s never did %s" % [m.breed, action])
			if Animal.doing(s) != "walk":
				_fail("%s does not walk again after %s (%s)" % [m.breed, action, Animal.doing(s)])
	if worst_bone > k.bone:
		_fail("%s: a leg bone changes length by %.5f m" % [m.breed, worst_bone])
	if worst_paw > k.paw:
		_fail("%s: a walking paw is %.4f m from where the gait planted it" % [m.breed, worst_paw])
	if worst_speed > k.jointSpeed:
		_fail("%s: a joint moves at %.1f m/s at %s" % [m.breed, worst_speed, worst_speed_at])
	print("%s: bone error %.6f m, walking paw error %.5f m, fastest joint %.2f m/s at %s" % [m.breed, worst_bone, worst_paw, worst_speed, worst_speed_at])

func _check_behaviour(c: Dictionary, m: Dictionary, dog: Dictionary) -> void:
	for fps in [30, 60, 120]:
		var state := Preview.create(m, dog, c)
		var repeat := Preview.create(m, dog, c)
		var minimum_gap := INF
		var maximum_radius := 0.0
		var modes := {}
		var directions := {}
		for frame in int(c.review.behaviour_duration * fps):
			state = Preview.step(state, m, dog, c, 1.0 / fps)
			repeat = Preview.step(repeat, m, dog, c, 1.0 / fps)
			if state != repeat:
				_fail("%s behaviour is not reproducible" % m.species)
				return
			var position: Vector3 = state.animal.position
			maximum_radius = maxf(maximum_radius, position.distance_to(Preview._v(c.review.range_center)) + Brain.body_radius(m.p))
			modes[state.brain.mode] = true
			directions[roundi(state.brain.yaw)] = true
			if m.species == "cat":
				minimum_gap = minf(minimum_gap, Preview.body_gap(state, m, dog))
		if maximum_radius > c.review.range_radius:
			_fail("%s roams outside its range (%.2f of %.2f m)" % [m.species, maximum_radius, c.review.range_radius])
		if m.species == "cat" and minimum_gap <= 0:
			_fail("cat touches the dog")
		if m.species == "dog" and (not modes.has("rest") or not modes.has("walk") or directions.size() < 3):
			_fail("dog roaming lacks stops or distinct headings")
		print("behaviour %s %d fps: radius %.2f / %.2f, body gap %.3f m, headings %d, modes %s" % [m.species, fps, maximum_radius, c.review.range_radius, minimum_gap, directions.size(), modes.keys()])
