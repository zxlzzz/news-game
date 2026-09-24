## Checks the procedural movers without drawing anything. Prints LOCOMOTION_OK or LOCOMOTION_FAIL.
## godot --headless --path . -s res://tools/check_locomotion.gd
##  - dog, at 30/60/120 frames per second over five scenarios (60 s each): no bone changes length,
##    planted paws never move, walking lifts the paws in dog-params liftAt order, the dog keeps the
##    commanded speed on a straight line;
##  - every rideable type in types/ (group "rideable") for every body type: the model has all contact
##    nodes, and the rider reaches seat, grips and pedals/footrests all round the crank;
##  - dog walker: two minutes of walking, turning and stopping; the rope is never stretched.
extends SceneTree

const Dog := preload("res://npc/procedural_dog.gd")
const Rider := preload("res://npc/rider.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const TYPES_DIR := "res://types/"
const CRANK_SAMPLES := 72

var failures: Array[String] = []

func _fail(msg: String) -> void:
	failures.append(msg)
	printerr("  FAIL ", msg)

func _initialize() -> void:
	_check_dog()
	_check_riders()
	_check_dog_walker()
	print("LOCOMOTION_OK" if failures.is_empty() else "LOCOMOTION_FAIL %d" % failures.size())
	quit(0 if failures.is_empty() else 1)

func _check_dog() -> void:
	var p := Dog.load_params()
	var walk_order := ["LH", "LF", "RH", "RF"]
	walk_order.sort_custom(func(a, b): return p.gaits.walk.liftAt[a] < p.gaits.walk.liftAt[b])
	var scenarios := {
		"walk": func(_t): return {"speed": 0.5, "yaw": 0.0, "gait": "walk"},
		"trot": func(_t): return {"speed": 1.3, "yaw": 0.0},
		"stop-go": func(t): return {"speed": 1.8 if int(t / 5) % 2 == 0 else 0.0, "yaw": 0.0},
		"turning": func(t): return {"speed": 1.0, "yaw": sin(t * 0.5) * 2.0},
		"standing": func(_t): return {"speed": 0.0, "yaw": 0.0},
	}
	var worst_bone := 0.0
	var worst_drift := 0.0
	for fps in [30, 60, 120]:
		for name in scenarios:
			var s := Dog.create(Vector3.ZERO, 0.0, p)
			var lifts := []
			var travelled := 0.0
			for i in 60 * fps:
				var t: float = float(i) / fps
				var prev := s
				s = Dog.step(prev, scenarios[name].call(t), 1.0 / fps, p)
				if t > 5:
					travelled += s.position.distance_to(prev.position)
				for e in s.events:
					if e.type == "lift":
						lifts.append(e.leg)
				var pts := Dog.pose(s, p)
				for key in Dog.LEGS:
					var limb: Dictionary = p.legs.hind if key[1] == "H" else p.legs.front
					var lens := [limb.a, limb.b, limb.c]
					for j in 3:
						worst_bone = maxf(worst_bone, absf(pts[key][j].distance_to(pts[key][j + 1]) - lens[j]))
					if not prev.feet[key].swing and not s.feet[key].swing:
						worst_drift = maxf(worst_drift, prev.feet[key].point.distance_to(s.feet[key].point))
			if name == "walk":
				var steady := lifts.slice(8, 40)
				var start := steady.find(walk_order[0])
				for k in range(start, steady.size()):
					if steady[k] != walk_order[(k - start) % 4]:
						_fail("dog walk at %d fps lifts %s, expected order %s" % [fps, steady.slice(start, start + 8), walk_order])
						break
			if name in ["walk", "trot"]:
				var avg := travelled / 55.0
				var want: float = scenarios[name].call(0).speed
				if avg < want * 0.97:
					_fail("dog %s at %d fps averages %.2f m/s, commanded %.2f" % [name, fps, avg, want])
	if worst_bone > 1e-4:
		_fail("dog bone length changes by %.5f m" % worst_bone)
	if worst_drift > 0.0:
		_fail("dog planted paw moves by %.5f m" % worst_drift)
	print("dog: bone error %.6f m, planted drift %.6f m" % [worst_bone, worst_drift])

func _check_riders() -> void:
	var P = JSON.parse_string(FileAccess.get_file_as_string("res://npc/skeleton-params.json"))
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var base := Rider.load_params()
	var found := 0
	for f in DirAccess.get_files_at(TYPES_DIR):
		if not f.ends_with(".tscn"):
			continue
		var inst: Node = load(TYPES_DIR + f).instantiate()
		if not inst.is_in_group(&"rideable"):
			inst.free()
			continue
		found += 1
		root.add_child(inst)
		inst.info()  # reads the contact nodes
		if inst.error != "":
			_fail("%s: %s" % [f, inst.error])
			inst.queue_free()
			continue
		var R := Rider.style(base, inst.rider_style)
		for body in bodies:
			if body.begins_with("_"):
				continue
			var s: float = bodies[body].scale
			var ext := [INF, 0.0]
			for i in CRANK_SAMPLES:
				var phase := TAU * i / CRANK_SAMPLES
				var pose := Rider.solve(inst.contacts(phase, R.gripFromBarEnd), P, s, R, {"crankPhase": phase})
				for e in pose.errors:
					_fail("%s, %s rider, crank %.0f°: %s" % [f, body, rad_to_deg(phase), e])
				for sd in ["Left", "Right"]:
					ext = [minf(ext[0], pose.points["legExtension" + sd]), maxf(ext[1], pose.points["legExtension" + sd])]
				if not inst.info().pedalled:
					break
			print("%s, %s rider: leg extension %.2f-%.2f" % [f, body, ext[0], ext[1]])
		inst.queue_free()
	if found == 0:
		_fail("no rideable type in " + TYPES_DIR)

func _check_dog_walker() -> void:
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var dw := DogWalker.new(Vector3.ZERO, 0.0, bodies.adult.scale)
	if dw.error != "":
		_fail("dog walker: " + dw.error)
		return
	var worst := 0.0
	var dt := 1.0 / 60
	for i in 120 * 60:
		var t: float = i * dt
		dw.step(dw.walk_speed() if fposmod(t, 16.0) < 12 else 0.0, sin(t * 0.12) * 1.5, dt)
		worst = maxf(worst, dw.separation)
	if worst > dw.leash_p.ropeLength:
		_fail("leash stretched to %.2f m (rope %.2f m)" % [worst, dw.leash_p.ropeLength])
	print("dog walker: longest hand-collar distance %.2f of %.2f m" % [worst, dw.leash_p.ropeLength])
