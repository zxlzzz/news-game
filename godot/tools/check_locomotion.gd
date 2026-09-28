## Checks the procedural movers without drawing anything. Prints LOCOMOTION_OK or LOCOMOTION_FAIL.
## godot --headless --path . -s res://tools/check_locomotion.gd
##  - the gait of every animal model (npc/animal-models.json: dogs and the cat, leg lengths from the
##    skeleton), at 30/60/120 frames per second over five scenarios (60 s each, speeds as fractions of
##    its top speed): no bone changes length, planted paws never move, walking lifts the paws in liftAt
##    order, it keeps the commanded speed on a straight line; up and down a curb every leg reaches its
##    planted paw;
##  - every rideable type in types/ (group "rideable") for every body type: the model has all contact
##    nodes, and the rider reaches seat, grips and pedals/footrests all round the crank;
##  - pigeon, at 30/60/120 frames per second over six scenarios (60 s each): leg bones never change
##    length, planted feet never move and stand on the ground, walking lifts the feet left/right in
##    turn, the pigeon keeps the commanded speed on a straight line, the neck stays within its length
##    range, every hop lands where it was aimed (onto a kerb and back down too), every take-off ends
##    in a touchdown on the ground;
##  - dog walker, with every dog breed: two minutes of walking, turning and stopping; the rope is never
##    stretched; walking away from the camera side, the walker changes hands so the dog is on the camera
##    side.
extends SceneTree

const Dog := preload("res://npc/procedural_dog.gd")
const Pigeon := preload("res://npc/procedural_pigeon.gd")
const Rider := preload("res://npc/rider.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const AnimalModel := preload("res://npc/animal_model.gd")
const TYPES_DIR := "res://types/"
const CRANK_SAMPLES := 72

var failures: Array[String] = []
## The checks walk on flat ground at height 0.
var flat_ground := func(_q: Vector3) -> float: return 0.0

func _fail(msg: String) -> void:
	failures.append(msg)
	printerr("  FAIL ", msg)

func _initialize() -> void:
	for breed in AnimalModel.config().breeds:
		var m := AnimalModel.info(breed)
		if m.error != "":
			_fail(m.error)
			continue
		_check_dog(breed, m.p)
		_check_dog_curb(breed, m.p)
	_check_pigeon()
	_check_riders()
	for breed in AnimalModel.breeds("dog"):
		_check_dog_walker(breed)
	print("LOCOMOTION_OK" if failures.is_empty() else "LOCOMOTION_FAIL %d" % failures.size())
	quit(0 if failures.is_empty() else 1)

## Up and down a 0.15 m curb, straight and slanting, at any speed: every leg reaches its paw (within
## procedural_dog.gd OVERREACH), no planted leg folds tighter than it can (within the same), and every
## planted paw stands on the ground under it. Four 0.15 x 0.3 m stairs at walking speeds: only printed,
## not failed (known limit, godot/README.md: the gait does not pick its footholds by the steps, so a
## dog's paws can land two steps apart, more than its legs span).
func _check_dog_curb(breed: String, p: Dictionary) -> void:
	# name: [ground, where it starts below, where it starts on top, the top height, speeds (-1: stop
	# and go at the last one)]
	var grounds := {
		"curb": [func(q: Vector3) -> float: return 0.15 if q.z > 0.0 else 0.0, -0.6, 0.6, 0.15, [0.5, 1.0, 1.6, -1.0, 1.2]],
		"stairs": [func(q: Vector3) -> float: return clampf(floorf(q.z / 0.3) + 1, 0, 4) * 0.15, -0.6, 1.8, 0.6, [0.5, 0.8, -1.0, 0.8]],
	}
	var worst := 0.0
	var worst_fold := 0.0
	var worst_float := 0.0
	var by_kind := {}  # "curb 0" .. "stairs 88" -> [short, folded]
	var cases := []
	for g in grounds:
		for up in [true, false]:
			for yaw_deg in [0.0, 30.0, 60.0, 80.0, 88.0]:
				var speeds: Array = grounds[g][4]
				for speed in speeds.slice(0, -1):
					cases.append([up, yaw_deg, speed, g])
	for c in cases:
		var yaw: float = deg_to_rad(c[1]) if c[0] else PI + deg_to_rad(c[1])
		var gr: Array = grounds[c[3]]
		var ground: Callable = gr[0]
		var s := Dog.create(Vector3(0, 0.0 if c[0] else gr[3], gr[1] if c[0] else gr[2]), yaw, p)
		for i in 480:
			var v: float = c[2] if c[2] > 0 else (gr[4][-1] if (i / 40) % 2 == 0 else 0.0)
			s = Dog.step(s, {"speed": v, "yaw": yaw, "ground": ground}, 1.0 / 60, p)
			for key in s.feet:
				var paw: Vector3 = s.feet[key].point
				var l: Dictionary = Dog._leg(key, p)
				var kind := "%s %d" % [c[3], c[1]]
				var strict: bool = c[3] == "curb"
				var e: Vector3 = Dog._wrist(s, key, p, paw) - Dog._girdle(s, key, p).root
				var k: Array = by_kind.get(kind, [0.0, 0.0])
				k[0] = maxf(k[0], e.length() - l.a - l.b)
				if not s.feet[key].swing:
					k[1] = maxf(k[1], absf(l.a - l.b) - e.length())
				by_kind[kind] = k
				var span: float = (Dog._wrist(s, key, p, paw) - Dog._girdle(s, key, p).root).length()
				var over: float = span - l.a - l.b
				if strict and not s.feet[key].swing and absf(l.a - l.b) - span > worst_fold:
					worst_fold = absf(l.a - l.b) - span
					if worst_fold > Dog.OVERREACH:
						print("  %s case %s frame %d leg %s folded %.4f too tight, pitch %.2f" % [breed, c, i, key, worst_fold, s.pitch])
				if strict and over > worst:
					worst = over
					if over > Dog.OVERREACH:
						print("  %s case %s frame %d leg %s swing %s over %.4f body y %.3f paws %s" % [breed, c, i, key, s.feet[key].swing, over, s.position.y, s.feet.keys().map(func(k): return "%s %.3f%s" % [k, s.feet[k].point.y, "~" if s.feet[k].swing else ""])])
				if not s.feet[key].swing:
					worst_float = maxf(worst_float, absf(paw.y - ground.call(paw)))
	if worst > Dog.OVERREACH:
		_fail("%s on a curb: a leg is %.4f m short of its paw" % [breed, worst])
	if worst_fold > Dog.OVERREACH:
		_fail("%s on a curb: a planted leg is folded %.4f m tighter than it can" % [breed, worst_fold])
	if worst_float > 1e-4:
		_fail("%s on a curb or stairs: a planted paw is %.4f m off the ground" % [breed, worst_float])
	print("%s by ground and angle (short, folded): %s" % [breed, by_kind.keys().map(func(k): return "%s: %.3f %.3f" % [k, by_kind[k][0], by_kind[k][1]])])
	print("%s on a curb: legs at most %.4f m short, planted legs at most %.4f m too folded" % [breed, maxf(worst, 0), maxf(worst_fold, 0)])

func _check_dog(breed: String, p: Dictionary) -> void:
	var top: float = p.motion.maxSpeed
	var walk_order := ["LH", "LF", "RH", "RF"]
	walk_order.sort_custom(func(a, b): return p.gaits.walk.liftAt[a] < p.gaits.walk.liftAt[b])
	var scenarios := {
		"walk": func(_t): return {"speed": 0.25 * top, "yaw": 0.0, "gait": "walk"},
		"trot": func(_t): return {"speed": 0.65 * top, "yaw": 0.0},
		"stop-go": func(t): return {"speed": 0.9 * top if int(t / 5) % 2 == 0 else 0.0, "yaw": 0.0},
		"turning": func(t): return {"speed": 0.5 * top, "yaw": sin(t * 0.5) * 2.0},
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
				var input: Dictionary = scenarios[name].call(t)
				input.ground = flat_ground
				s = Dog.step(prev, input, 1.0 / fps, p)
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
						_fail("%s walk at %d fps lifts %s, expected order %s" % [breed, fps, steady.slice(start, start + 8), walk_order])
						break
			if name in ["walk", "trot"]:
				var avg := travelled / 55.0
				var want: float = scenarios[name].call(0).speed
				if avg < want * 0.97:
					_fail("%s %s at %d fps averages %.2f m/s, commanded %.2f" % [breed, name, fps, avg, want])
	if worst_bone > 1e-4:
		_fail("%s bone length changes by %.5f m" % [breed, worst_bone])
	if worst_drift > 0.0:
		_fail("%s planted paw moves by %.5f m" % [breed, worst_drift])
	print("%s: bone error %.6f m, planted drift %.6f m" % [breed, worst_bone, worst_drift])

func _check_pigeon() -> void:
	var p := Pigeon.load_params()
	var fwd := func(s: Dictionary, d: float) -> Vector3: return s.position + Vector3(sin(s.yaw), 0, cos(s.yaw)) * d
	# each scenario: t, state -> input (hop targets alternate onto a 0.15 m kerb and back down)
	var base := {"speed": 0.0, "yaw": 0.0, "ground": 0.0, "peck": false, "fly": false, "altitude": 1.5, "hop": null}
	var scenarios := {
		"walk": func(_t, _s): return base.merged({"speed": 0.3}, true),
		"turning": func(t, _s): return base.merged({"speed": 0.25, "yaw": sin(t * 0.6) * 2.0}, true),
		"stop-go": func(t, _s): return base.merged({"speed": 0.45 if int(t / 3) % 2 == 0 else 0.0}, true),
		"feeding": func(t, _s): return base.merged({"speed": 0.06 if int(t / 2) % 2 == 0 else 0.0, "peck": true}, true),
		"hops": func(t, s): return base.merged({"ground": s.ground}, true),
		"flying": func(t, _s): return base.merged({"speed": 3.0, "yaw": t * 0.3, "fly": fposmod(t, 12.0) > 2.0 and fposmod(t, 12.0) < 8.0}, true),
	}
	var worst_bone := 0.0
	var worst_drift := 0.0
	var worst_float := 0.0
	var neck_out := 0.0
	for fps in [30, 60, 120]:
		var dt: float = 1.0 / fps
		for name in scenarios:
			var s := Pigeon.create(Vector3.ZERO, 0.0, p)
			var lifts := []
			var travelled := 0.0
			var takeoffs := 0
			var touchdowns := 0
			var hop_to = null
			var next_hop := 1.0
			var kerb := false
			for i in 60 * fps:
				var t: float = float(i) * dt
				var input: Dictionary = scenarios[name].call(t, s)
				if name == "hops" and t >= next_hop and s.mode == "ground":
					kerb = not kerb
					hop_to = fwd.call(s, 0.3)
					hop_to.y = 0.15 if kerb else 0.0
					input.hop = hop_to
					next_hop = t + 1.5
				var prev := s
				s = Pigeon.step(prev, input, dt, p)
				if name in ["walk"] and t > 5:
					travelled += Vector2(s.position.x, s.position.z).distance_to(Vector2(prev.position.x, prev.position.z))
				for e in s.events:
					match e.type:
						"lift": lifts.append(e.foot)
						"takeoff": takeoffs += 1
						"touchdown": touchdowns += 1
						"land":
							if e.foot == "both" and hop_to != null:
								var miss: float = s.position.distance_to(hop_to)
								if miss > 0.005:
									_fail("pigeon hop at %d fps lands %.3f m from where it was aimed" % [fps, miss])
				var pts := Pigeon.pose(s, p)
				for key in Pigeon.FEET:
					worst_bone = maxf(worst_bone, absf(pts[key][0].distance_to(pts[key][1]) - p.legs.a))
					worst_bone = maxf(worst_bone, absf(pts[key][1].distance_to(pts[key][2]) - p.legs.b))
					if s.mode == "ground" and prev.mode == "ground" and not s.feet[key].swing and not prev.feet[key].swing:
						worst_drift = maxf(worst_drift, s.feet[key].point.distance_to(prev.feet[key].point))
						worst_float = maxf(worst_float, absf(s.feet[key].point.y - s.ground))
				var neck: float = pts.neck[0].distance_to(pts.neck[1])
				neck_out = maxf(neck_out, maxf(p.head.neck[0] - neck, neck - p.head.neck[1]))
			if name == "walk":
				var steady := lifts.slice(4)
				for k in range(1, steady.size()):
					if steady[k] == steady[k - 1]:
						_fail("pigeon walk at %d fps lifts %s twice in a row" % [fps, steady[k]])
						break
				var avg := travelled / 55.0
				if absf(avg - 0.3) > 0.01:
					_fail("pigeon walk at %d fps averages %.3f m/s, commanded 0.30" % [fps, avg])
			if name == "flying":
				if takeoffs == 0 or takeoffs != touchdowns or s.mode != "ground" or absf(s.position.y) > 1e-4:
					_fail("pigeon flying at %d fps: %d take-offs, %d touchdowns, ends %s at y %.3f" % [fps, takeoffs, touchdowns, s.mode, s.position.y])
	if worst_bone > 1e-4:
		_fail("pigeon leg bone length changes by %.5f m" % worst_bone)
	if worst_drift > 1e-6:
		_fail("pigeon planted foot moves by %.5f m" % worst_drift)
	if worst_float > 1e-4:
		_fail("pigeon planted foot %.4f m off the ground" % worst_float)
	if neck_out > 1e-4:
		_fail("pigeon neck leaves its length range by %.4f m" % neck_out)
	print("pigeon: leg bones within %.6f m, planted feet move %.6f m" % [worst_bone, worst_drift])

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

func _check_dog_walker(breed: String) -> void:
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var dw := DogWalker.new(Vector3.ZERO, 0.0, bodies.adult.scale, flat_ground, breed)
	if dw.error != "":
		_fail("dog walker: " + dw.error)
		return
	var worst := 0.0
	var dt := 1.0 / 60
	for i in 120 * 60:
		var t: float = i * dt
		dw.step(dw.walk_speed() if fposmod(t, 16.0) < 12 else 0.0, sin(t * 0.12) * 1.5, dt)
		worst = maxf(worst, dw.separation)
	# walking toward -X with the camera on the +Z side: the dog must end up on the camera side
	var side_test := DogWalker.new(Vector3.ZERO, -PI / 2, bodies.adult.scale, flat_ground, breed)
	side_test.view = Vector3(0, 0, 1)
	for i in 20 * 60:
		side_test.step(side_test.walk_speed(), -PI / 2, dt)
	var ahead: float = side_test.dog.position.z - side_test.walker.position.z
	if ahead <= 0.2:
		_fail("%s walker heading -X keeps the dog %.2f m toward the camera (should be on the camera side)" % [breed, ahead])
	print("%s walker: dog %.2f m on the camera side after changing hands (holding %s)" % [breed, ahead, side_test.side])
	if worst > dw.leash_p.ropeLength:
		_fail("%s walker: leash stretched to %.2f m (rope %.2f m)" % [breed, worst, dw.leash_p.ropeLength])
	print("%s walker: longest hand-collar distance %.2f of %.2f m" % [breed, worst, dw.leash_p.ropeLength])
