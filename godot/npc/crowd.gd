## The people of a level, added by core/level.gd (scene_spec.md §3: people follow from the objects
## and the population, the level file lists none).
##  - Free-roaming people, counted in the level's population.tres, follow the level's routes: Path3D
##    children of a node named "Routes". Each route says who uses it in metadata "people" (kinds from
##    crowd-params.json), "loop" (a closed round) and "reversible" (walked either way). People on an
##    open route leave at its end and come back in at the start of another route of their kind.
##  - People at posts come from Marker3D nodes named post_<kind>[_n] inside object types (a bench
##    seat, behind a stall counter, a chess stool): whether a post is taken and what is played there
##    is in crowd-params.json "posts".
## Walking and jogging play their clip by distance (npc/clip_pose.gd); dog walkers are
## npc/dog_walker.gd; riders are a vehicle type plus npc/rider.gd. No avoidance between people.
extends Node3D

const ClipPose := preload("res://npc/clip_pose.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const Rider := preload("res://npc/rider.gd")
const PARAMS := "res://npc/crowd-params.json"
## population.tres field -> crowd-params kind
const POPULATION := {"pedestrians": "pedestrian", "joggers": "jogger", "dog_walkers": "dog_walker",
	"cyclists": "cyclist", "scooter_riders": "scooter_rider"}

var level: Node3D
var p: Dictionary
var body_scale: float
var ink: Color
var routes := {}   # kind -> Array[Path3D]
var people: Array = []
var rng := RandomNumberGenerator.new()
var _skeleton: Dictionary
var _rider_params: Dictionary

func _init(level_: Node3D) -> void:
	level = level_
	name = "Crowd"

func _ready() -> void:
	p = JSON.parse_string(FileAccess.get_file_as_string(PARAMS))
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	body_scale = bodies[p.body].scale
	ink = Color(p.ink[0], p.ink[1], p.ink[2])
	_skeleton = JSON.parse_string(FileAccess.get_file_as_string("res://npc/skeleton-params.json"))
	_rider_params = Rider.load_params()
	rng.seed = hash(level.name)
	var holder := level.get_node_or_null("Routes")
	if holder:
		for r in holder.get_children():
			if r is Path3D:
				for kind in r.get_meta("people", []):
					if not routes.has(kind):
						routes[kind] = []
					routes[kind].append(r)
	for field in POPULATION:
		var kind: String = POPULATION[field]
		var n: int = level.population.get(field) if level.population else 0
		if n > 0 and not routes.has(kind):
			push_error("Crowd: population has %d %s but no route lists %s" % [n, field, kind])
			continue
		for i in n:
			_spawn_roaming(kind)
	for m in level.find_children("post_*", "Marker3D", true, false):
		var kind: String = String(m.name).split("_")[1]
		var post: Dictionary = p.posts.get(kind, {})
		if post.is_empty():
			push_error("Crowd: no post kind %s in %s (marker %s)" % [kind, PARAMS, m.get_path()])
		elif rng.randf() < post.chance:
			people.append(_post_person(m, post))

func _figure(scale_: float) -> Node3D:
	var f := InkFigure.new()
	add_child(f)
	f.setup(ink, p.depthBias)
	f.scale = Vector3.ONE * scale_
	return f

func _pick(weights: Dictionary) -> String:
	var total := 0.0
	for k in weights:
		total += weights[k]
	var x := rng.randf() * total
	for k in weights:
		x -= weights[k]
		if x <= 0:
			return k
	return weights.keys()[-1]

# ---------------------------------------------------------------- route following

## Where on a route: {route, d (metres along), dir (+1/-1), side (lateral metres)}.
func _place_on_route(kind: String, anywhere: bool) -> Dictionary:
	var choices: Array = routes[kind]
	if not anywhere:
		choices = choices.filter(func(r): return not r.get_meta("loop", false))
		if choices.is_empty():
			choices = routes[kind]
	var r: Path3D = choices[rng.randi() % choices.size()]
	var length := r.curve.get_baked_length()
	var dir := -1 if r.get_meta("reversible", false) and rng.randf() < 0.5 else 1
	var d := rng.randf() * length if anywhere else (0.0 if dir > 0 else length)
	return {"route": r, "d": d, "dir": dir, "length": length}

## World position and heading at distance d along a route, shifted sideways by `side` metres.
func _route_at(at: Dictionary, side: float) -> Array:
	var r: Path3D = at.route
	var c := r.curve
	var d: float = at.d
	var loop: bool = r.get_meta("loop", false)
	var ahead: float = d + 0.4 * at.dir
	if loop:
		d = fposmod(d, at.length)
		ahead = fposmod(ahead, at.length)
	var a := r.global_transform * c.sample_baked(clampf(d, 0, at.length))
	var b := r.global_transform * c.sample_baked(clampf(ahead, 0, at.length))
	var t := b - a
	if t.length() < 1e-4:
		t = Vector3(at.dir, 0, 0)
	var yaw := atan2(t.x, t.z)
	var right := Vector3(-cos(yaw), 0, sin(yaw))
	return [a + right * side, yaw]

## Advances along the route; returns false when an open route has ended.
func _advance(at: Dictionary, metres: float) -> bool:
	at.d += metres * at.dir
	if at.route.get_meta("loop", false):
		at.d = fposmod(at.d, at.length)
		return true
	return at.d >= 0 and at.d <= at.length

func _spawn_roaming(kind: String) -> void:
	var at := _place_on_route(kind, true)
	if p.walkers.has(kind):
		var w: Dictionary = p.walkers[kind]
		var person := {"type": "walker", "kind": kind, "at": at, "figure": _figure(body_scale)}
		_new_walk(person, w)
		people.append(person)
	elif kind == "dog_walker":
		var pos: Array = _route_at(at, 0.0)
		var dw := DogWalker.new(pos[0], pos[1], body_scale)
		people.append({"type": "dog", "kind": kind, "at": at, "dw": dw,
			"walker": _figure(body_scale), "dog": _figure(1.0), "rope": _figure(1.0)})
	elif p.riders.has(kind):
		var rp: Dictionary = p.riders[kind]
		var vehicle: Node3D = load(rp.vehicle).instantiate()
		add_child(vehicle)
		var fig := InkFigure.new()
		vehicle.add_child(fig)
		fig.setup(ink, p.depthBias)
		people.append({"type": "rider", "kind": kind, "at": at, "vehicle": vehicle, "figure": fig,
			"R": Rider.style(_rider_params, vehicle.rider_style), "state": Rider.start(),
			"speed": rng.randf_range(rp.speed[0], rp.speed[1]), "pedalling": true, "switch": 0.0, "yaw": INF})
	else:
		push_error("Crowd: unknown kind " + kind)

## A new clip, speed and lane for a walker (also on re-entering).
func _new_walk(person: Dictionary, w: Dictionary) -> void:
	var clip = ClipPose.of(_pick(w.clips))
	person.clip = clip
	person.phase = rng.randf()
	person.speed = clip.stride() * body_scale / clip.duration() * (1.0 + rng.randf_range(-w.speedJitter, w.speedJitter))
	person.side = rng.randf_range(-w.laneJitter, w.laneJitter)
	person.yaw = INF

func _turn(from: float, to: float, dt: float) -> float:
	if from == INF:
		return to
	return from + clampf(angle_difference(from, to), -p.turnRate * dt, p.turnRate * dt)

# ---------------------------------------------------------------- posts

func _post_person(m: Marker3D, post: Dictionary) -> Dictionary:
	var person := {"type": "post", "marker": m, "clips": post.clips, "figure": _figure(body_scale), "time": 0.0}
	person.clip = ClipPose.of(_pick(post.clips))
	person.time = rng.randf() * person.clip.duration()
	return person

# ---------------------------------------------------------------- each frame

## Simulation step (seconds): long frames are split into steps no longer than this; drawn once.
const STEP := 1.0 / 60
## Frames longer than this (a stall, the first frame) are shortened to it.
const MAX_FRAME := 0.1
var _draw := false

func _process(frame_dt: float) -> void:
	var n := ceili(minf(frame_dt, MAX_FRAME) / STEP)
	for k in n:
		_draw = k == n - 1
		_step(minf(frame_dt, MAX_FRAME) / n)

func _step(dt: float) -> void:
	for person in people:
		match person.type:
			"walker":
				_update_walker(person, dt)
			"dog":
				_update_dog(person, dt)
			"rider":
				_update_rider(person, dt)
			"post":
				_update_post(person, dt)

func _draw_figure(fig: Node3D, d: Dictionary) -> void:
	fig.draw(d.segments, d.discs, d.triangles)

func _update_walker(person: Dictionary, dt: float) -> void:
	var clip = person.clip
	var metres: float = person.speed * dt
	if not _advance(person.at, metres):
		person.at = _place_on_route(person.kind, false)
		_new_walk(person, p.walkers[person.kind])
	person.phase = fposmod(person.phase + metres / (clip.stride() * body_scale), 1.0)
	var here := _route_at(person.at, person.side)
	person.yaw = _turn(person.yaw, here[1], dt)
	if not _draw:
		return
	var fig: Node3D = person.figure
	fig.transform = Transform3D(Basis(Vector3.UP, person.yaw).scaled(Vector3.ONE * body_scale), here[0])
	_draw_figure(fig, clip.drawing(clip.pose(person.phase)))

func _update_dog(person: Dictionary, dt: float) -> void:
	var dw: DogWalker = person.dw
	var at: Dictionary = person.at
	at.d = at.route.curve.get_closest_offset(at.route.global_transform.affine_inverse() * dw.walker.position)
	var target: Array = _route_at({"route": at.route, "d": at.d + 1.5 * at.dir, "dir": at.dir, "length": at.length}, 0.0)
	var to: Vector3 = target[0] - dw.walker.position
	dw.step(dw.walk_speed(), atan2(to.x, to.z), dt)
	if not _draw:
		return
	var w: Node3D = person.walker
	w.transform = dw.walker_transform().scaled_local(Vector3.ONE * dw.body_scale)
	_draw_figure(w, dw.walker_drawing())
	_draw_figure(person.dog, dw.dog_drawing())
	_draw_figure(person.rope, dw.rope_drawing())

func _update_rider(person: Dictionary, dt: float) -> void:
	var rp: Dictionary = p.riders[person.kind]
	if not _advance(person.at, person.speed * dt):
		person.at = _place_on_route(person.kind, false)
		person.yaw = INF
	if rp.has("pedalSeconds"):
		person.switch -= dt
		if person.switch <= 0:
			person.pedalling = not person.pedalling
			var span: Array = rp.pedalSeconds if person.pedalling else rp.coastSeconds
			person.switch = rng.randf_range(span[0], span[1])
	var here := _route_at(person.at, 0.0)
	var old: float = person.yaw
	person.yaw = _turn(person.yaw, here[1], dt)
	var yaw_rate: float = 0.0 if old == INF else angle_difference(old, person.yaw) / dt
	var vehicle: Node3D = person.vehicle
	person.state = Rider.step(person.state, {"speed": person.speed, "yawRate": yaw_rate, "pedalling": person.pedalling},
		dt, vehicle.info(), person.R)
	vehicle.position = here[0]
	vehicle.rotation = Vector3(0, person.yaw, 0)
	vehicle.rotate_object_local(Vector3.BACK, -person.state.roll)
	if not _draw:
		return
	vehicle.set_motion(person.state.wheelAngle, person.state.crankPhase)
	var R: Dictionary = person.R
	var pose := Rider.solve(vehicle.contacts(person.state.crankPhase, R.gripFromBarEnd), _skeleton, body_scale, R, person.state)
	person.figure.draw(pose.segments, pose.discs, [])

func _update_post(person: Dictionary, dt: float) -> void:
	person.time += dt
	var clip = person.clip
	if person.time >= clip.duration():
		person.time -= clip.duration()
		person.clip = ClipPose.of(_pick(person.clips))
		clip = person.clip
	if not _draw:
		return
	var m: Marker3D = person.marker
	var fig: Node3D = person.figure
	fig.global_transform = Transform3D(m.global_basis.orthonormalized().scaled(Vector3.ONE * body_scale), m.global_position)
	_draw_figure(fig, clip.drawing(clip.pose(person.time / clip.duration())))
