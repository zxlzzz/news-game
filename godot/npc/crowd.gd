## The people of a level, added by core/level.gd (scene_spec.md §3: people follow from the objects
## and the population; the level file lists none).
##  - Free-roaming people, counted in the level's population.tres, come in where the walkable (or
##    rideable) area meets an end of the ground, visit a few random spots on pavement or paving,
##    and leave by another end. Paths come from core/walk_grid.gd, which derives where one can walk
##    from the ground bands and the objects; nothing about routes is written in the level.
##    Riders keep to the right-hand bike lane when crowd-params says keepRight.
##  - People at posts come from Marker3D nodes named post_<kind>[_n] inside object types (a bench
##    seat, behind a stall counter, a chess stool): whether a post is taken and what is played there
##    is in crowd-params.json "posts".
## Walking and jogging play their clip by distance (npc/clip_pose.gd); dog walkers are
## npc/dog_walker.gd; riders are a vehicle type plus npc/rider.gd. No avoidance between people.
## Any error in the data stops the game (like core/level.gd), nothing is skipped quietly.
extends Node3D

const ClipPose := preload("res://npc/clip_pose.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const Rider := preload("res://npc/rider.gd")
const WalkGrid := preload("res://core/walk_grid.gd")
const PARAMS := "res://npc/crowd-params.json"
## population.tres field -> kind
const POPULATION := {"pedestrians": "pedestrian", "joggers": "jogger", "dog_walkers": "dog_walker",
	"cyclists": "cyclist", "scooter_riders": "scooter_rider"}
## Simulation step (seconds): long frames are split into steps no longer than this; drawn once.
const STEP := 1.0 / 60
## Frames longer than this (a stall, the first frame) are shortened to it.
const MAX_FRAME := 0.1

var level: Node3D
var p: Dictionary
var body_scale: float
var ink: Color
var grid: WalkGrid
var exits := {}   # mode -> exits from walk_grid
var people: Array = []
var rng := RandomNumberGenerator.new()
var errors: Array[String] = []
var _skeleton: Dictionary
var _rider_params: Dictionary
var _draw := false

func _init(level_: Node3D) -> void:
	level = level_
	name = "Crowd"

func _fail(msg: String) -> void:
	errors.append(msg)

func _read(path: String):
	var v = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (v is Dictionary):
		_fail(path + ": missing or not a JSON object")
		return {}
	return v

func _ready() -> void:
	_setup()
	if not errors.is_empty():
		for e in errors:
			push_error("Crowd: " + e)
			printerr("Crowd: " + e)
		set_process(false)
		get_tree().quit(1)

func _setup() -> void:
	p = _read(PARAMS)
	var bodies: Dictionary = _read("res://npc/body-types.json")
	_skeleton = _read("res://npc/skeleton-params.json")
	if not errors.is_empty():
		return
	body_scale = bodies[p.body].scale
	ink = Color(p.ink[0], p.ink[1], p.ink[2])
	_rider_params = Rider.load_params()
	rng.seed = hash(level.name)
	_check_clips()
	var wanted := {}
	for field in POPULATION:
		var n: int = level.population.get(field)
		if n > 0:
			wanted[POPULATION[field]] = n
	if not wanted.is_empty():
		grid = WalkGrid.new(level, p.grid, level.slot_map)
		if grid.error != "":
			_fail(grid.error)
			return
		for a in grid.unreachable_areas(p.visitMaxCost, p.grid.pocketArea):
			_fail("pavement at x %.1f, z %.1f (%.1f x %.1f m) cannot be reached from any way in" % [a.centre.x, a.centre.z, a.size.x, a.size.y])
		for mode in WalkGrid.MODES:
			exits[mode] = grid.exits(mode)
		_check_exits(wanted)
	if not errors.is_empty():
		return
	for kind in wanted:
		for i in wanted[kind]:
			_spawn(kind, true)
	for m in level.find_children("post_*", "Marker3D", true, false):
		var kind: String = String(m.name).split("_")[1]
		if not p.posts.has(kind):
			_fail("no post kind %s in %s (marker %s)" % [kind, PARAMS, m.get_path()])
		elif rng.randf() < p.posts[kind].chance:
			people.append(_post_person(m, p.posts[kind]))

## Every clip named in crowd-params must load.
func _check_clips() -> void:
	var lists := []
	for k in p.walkers:
		lists.append(p.walkers[k].clips)
	for k in p.posts:
		lists.append(p.posts[k].clips)
	for clips in lists:
		for id in clips:
			var c = ClipPose.of(id)
			if c.error != "":
				_fail("clip %s: %s" % [id, c.error])

## Each mode in use needs a way in at both ends, and every way in must reach the other end.
func _check_exits(wanted: Dictionary) -> void:
	for kind in wanted:
		if not (p.walkers.has(kind) or kind == "dog_walker" or p.riders.has(kind)):
			_fail("unknown kind %s (population field) — not in %s" % [kind, PARAMS])
	for mode in WalkGrid.MODES:
		var users := wanted.keys().filter(func(k): return (k in p.riders) == (mode == "ride"))
		if users.is_empty():
			continue
		var ends: Array = exits[mode]
		var left := ends.filter(func(e): return e.side < 0)
		var right := ends.filter(func(e): return e.side > 0)
		if left.is_empty() or right.is_empty():
			_fail("%s: no way in at %s end of the ground (for %s)" % [mode, "the left" if left.is_empty() else "the right", users])
			continue
		for e in left:
			if right.all(func(r): return grid.plan(mode, e.point, r.point).is_empty()):
				_fail("%s: the way in at z %.1f reaches no way out at the other end" % [mode, e.point.z])

func _figure(scale_: float, parent: Node = self) -> Node3D:
	var f := InkFigure.new()
	parent.add_child(f)
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

# ---------------------------------------------------------------- paths

## A walked path: points, cumulative lengths.
func _path(pts: PackedVector3Array) -> Dictionary:
	var cum := PackedFloat32Array([0.0])
	for i in range(1, pts.size()):
		cum.append(cum[i - 1] + pts[i - 1].distance_to(pts[i]))
	return {"pts": pts, "cum": cum, "length": cum[-1]}

## [position, heading] at distance d along a path.
func _at(path: Dictionary, d: float) -> Array:
	var pts: PackedVector3Array = path.pts
	var cum: PackedFloat32Array = path.cum
	d = clampf(d, 0.0, path.length)
	var i := 0
	while i < pts.size() - 2 and cum[i + 1] < d:
		i += 1
	var seg: Vector3 = pts[i + 1] - pts[i]
	var t := (d - cum[i]) / maxf(seg.length(), 1e-6)
	return [pts[i].lerp(pts[i + 1], clampf(t, 0.0, 1.0)), atan2(seg.x, seg.z)]

## Distance along a path of the point nearest to q.
func _along(path: Dictionary, q: Vector3) -> float:
	var pts: PackedVector3Array = path.pts
	var best := 0.0
	var best_d := INF
	for i in pts.size() - 1:
		var c := Geometry3D.get_closest_point_to_segment(q, pts[i], pts[i + 1])
		var dd := c.distance_squared_to(q)
		if dd < best_d:
			best_d = dd
			best = path.cum[i] + pts[i].distance_to(c)
	return best

func _exit_point(e: Dictionary) -> Vector3:
	return Vector3(e.point.x, 0.0, rng.randf_range(e.span.x, e.span.y))

## Targets for one visit: some random spots on pavement, then an exit away from where one is.
func _trip(from: Vector3, visits: Array) -> Array:
	var legs := []
	for i in rng.randi_range(visits[0], visits[1]):
		var q = grid.random_point("walk", rng, p.visitMaxCost)
		if q != null:
			legs.append(q)
	var ends: Array = exits.walk
	var far := ends.filter(func(e): return absf(e.point.x - from.x) > 10.0)
	var pool := far if not far.is_empty() else ends
	legs.append(_exit_point(pool[rng.randi() % pool.size()]))
	return legs

## Plans the next leg of a walker's trip; false when the trip is over.
func _next_leg(person: Dictionary, from: Vector3) -> bool:
	while not person.legs.is_empty():
		var goal: Vector3 = person.legs.pop_front()
		var pts := grid.plan("walk", from, goal)
		if pts.size() >= 2:
			person.path = _path(pts)
			person.d = 0.0
			return true
		if from.distance_to(goal) > grid.cell * 2:
			# destinations are only picked where one can get to, so this is a bug, not a layout issue
			push_error("Crowd: no path from %s to %s" % [from, goal])
	return false

## Somewhere to start: anywhere on pavement at the beginning, else at an end of the ground.
func _start_point(anywhere: bool) -> Vector3:
	if anywhere:
		var q = grid.random_point("walk", rng, p.visitMaxCost)
		if q != null:
			return q
	var ends: Array = exits.walk
	return _exit_point(ends[rng.randi() % ends.size()])

# ---------------------------------------------------------------- spawning

func _spawn(kind: String, anywhere: bool) -> void:
	if p.walkers.has(kind):
		var person := {"type": "walker", "kind": kind, "figure": _figure(body_scale)}
		_new_walker_trip(person, _start_point(anywhere))
		people.append(person)
	elif kind == "dog_walker":
		var person := {"type": "dog", "kind": kind, "walker": _figure(body_scale), "dog": _figure(1.0), "rope": _figure(1.0)}
		_new_dog_trip(person, _start_point(anywhere))
		people.append(person)
	else:
		var rp: Dictionary = p.riders[kind]
		var vehicle: Node3D = load(rp.vehicle).instantiate()
		add_child(vehicle)
		var person := {"type": "rider", "kind": kind, "vehicle": vehicle, "figure": _figure(1.0, vehicle),
			"R": Rider.style(_rider_params, vehicle.rider_style), "state": Rider.start(),
			"speed": rng.randf_range(rp.speed[0], rp.speed[1]), "pedalling": true, "switch": 0.0}
		_new_ride(person, anywhere)
		people.append(person)

func _new_walker_trip(person: Dictionary, from: Vector3) -> void:
	var w: Dictionary = p.walkers[person.kind]
	var clip = ClipPose.of(_pick(w.clips))
	person.clip = clip
	person.phase = rng.randf()
	person.speed = clip.stride() * body_scale / clip.duration() * (1.0 + rng.randf_range(-w.speedJitter, w.speedJitter))
	person.yaw = INF
	person.legs = _trip(from, w.visits)
	if not _next_leg(person, from):
		person.path = _path(PackedVector3Array([from, from + Vector3(0.01, 0, 0)]))
		person.d = 0.0

func _new_dog_trip(person: Dictionary, from: Vector3) -> void:
	var dw := DogWalker.new(from, rng.randf() * TAU, body_scale)
	if dw.error != "":
		_fail("dog walker: " + dw.error)
		return
	person.dw = dw
	person.legs = _trip(from, p.dogWalker.visits)
	if not _next_leg(person, from):
		person.path = _path(PackedVector3Array([from, from + Vector3(0.01, 0, 0)]))

## A ride from one end of the ground to the other, in the right-hand lane if keepRight.
func _new_ride(person: Dictionary, anywhere: bool) -> void:
	var ends: Array = exits.ride
	var dir := -1 if rng.randf() < 0.5 else 1
	var starts := ends.filter(func(e): return e.side == -dir)
	var goals := ends.filter(func(e): return e.side == dir)
	var s: Dictionary = starts[rng.randi() % starts.size()]
	if p.riders.keepRight:
		# travelling +X the right hand is +Z
		starts.sort_custom(func(a, b): return a.point.z * dir > b.point.z * dir)
		s = starts[0]
	goals.sort_custom(func(a, b): return absf(a.point.z - s.point.z) < absf(b.point.z - s.point.z))
	var pts := grid.plan("ride", s.point, goals[0].point)
	if pts.size() < 2:  # _check_exits makes this impossible unless the level changed under us
		push_error("Crowd: no ride from z %.1f" % s.point.z)
		pts = PackedVector3Array([s.point, s.point + Vector3(dir * 0.01, 0, 0)])
	person.path = _path(pts)
	person.d = rng.randf() * person.path.length if anywhere else 0.0
	person.yaw = INF

func _post_person(m: Marker3D, post: Dictionary) -> Dictionary:
	var person := {"type": "post", "marker": m, "clips": post.clips, "figure": _figure(body_scale)}
	person.clip = ClipPose.of(_pick(post.clips))
	person.time = rng.randf() * person.clip.duration()
	return person

## Horizontal direction from the scene toward the camera (zero before the view exists).
func _toward_camera() -> Vector3:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return Vector3.ZERO
	var back := cam.global_basis.z
	return Vector3(back.x, 0, back.z).normalized()

func _turn(from: float, to: float, dt: float) -> float:
	if from == INF:
		return to
	return from + clampf(angle_difference(from, to), -p.turnRate * dt, p.turnRate * dt)

# ---------------------------------------------------------------- each frame

func _process(frame_dt: float) -> void:
	var dt := minf(frame_dt, MAX_FRAME)
	var n := ceili(dt / STEP)
	for k in n:
		_draw = k == n - 1
		for person in people:
			match person.type:
				"walker":
					_update_walker(person, dt / n)
				"dog":
					_update_dog(person, dt / n)
				"rider":
					_update_rider(person, dt / n)
				"post":
					_update_post(person, dt / n)

func _draw_figure(fig: Node3D, d: Dictionary) -> void:
	fig.draw(d.segments, d.discs, d.triangles)

func _update_walker(person: Dictionary, dt: float) -> void:
	var clip = person.clip
	var metres: float = person.speed * dt
	person.d += metres
	if person.d >= person.path.length:
		var end: Vector3 = person.path.pts[-1]
		if not _next_leg(person, end):
			_new_walker_trip(person, _start_point(false))
			clip = person.clip
	person.phase = fposmod(person.phase + metres / (clip.stride() * body_scale), 1.0)
	var here := _at(person.path, person.d)
	person.yaw = _turn(person.yaw, here[1], dt)
	if not _draw:
		return
	var fig: Node3D = person.figure
	fig.transform = Transform3D(Basis(Vector3.UP, person.yaw).scaled(Vector3.ONE * body_scale), here[0])
	_draw_figure(fig, clip.drawing(clip.pose(person.phase)))

func _update_dog(person: Dictionary, dt: float) -> void:
	var dw: DogWalker = person.dw
	var pos: Vector3 = dw.walker.position
	var path: Dictionary = person.path
	if pos.distance_to(path.pts[-1]) < p.dogWalker.arrive:
		if not _next_leg(person, pos):
			_new_dog_trip(person, _start_point(false))
			return
		path = person.path
	var target: Vector3 = _at(path, _along(path, pos) + p.dogWalker.lookAhead)[0]
	var to := target - pos
	dw.view = _toward_camera()
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
	person.d += person.speed * dt
	if person.d >= person.path.length:
		_new_ride(person, false)
	if rp.has("pedalSeconds"):
		person.switch -= dt
		if person.switch <= 0:
			person.pedalling = not person.pedalling
			var span: Array = rp.pedalSeconds if person.pedalling else rp.coastSeconds
			person.switch = rng.randf_range(span[0], span[1])
	var here := _at(person.path, person.d)
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
