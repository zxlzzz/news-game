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
##  - With population.behaviour, pedestrians are agents instead: npc/behaviour.gd chooses what each
##    does next (stroll, leave, a gesture where they stand, or taking a post) and the posts are
##    theirs to take; nobody sits at a post by chance.
## Walking and jogging play their clip by distance (npc/clip_pose.gd); dog walkers are
## npc/dog_walker.gd; riders are a vehicle type plus npc/rider.gd. No avoidance between people.
## Clips are played as baked (tools/bake_motion.gd): nothing is solved here except lifting a foot that would be
## below the ground. A switch to another clip crossfades (npc/pose_fade.gd, crowd-params fade).
## Any error in the data stops the game (like core/level.gd), nothing is skipped quietly.
extends Node3D

const ClipPose := preload("res://npc/clip_pose.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const AnimalBody := preload("res://npc/animal_body.gd")
const Rider := preload("res://npc/rider.gd")
const WalkGrid := preload("res://core/walk_grid.gd")
const Behaviour := preload("res://npc/behaviour.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")
const ContactPose := preload("res://npc/contact_pose.gd")
const PoseFade := preload("res://npc/pose_fade.gd")
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
## The camera's frustum planes this frame (outward normals); empty before there is a camera.
var _view: Array[Plane] = []
## Seen from far off (a tall view), each walking figure's pose is rebuilt only every _every frames,
## in turn; its position still moves every frame.
var _every := 1
var _frame := 0
## Seconds since the start (crossfades are timed by it).
var _time := 0.0
var beh: Behaviour = null   # with population.behaviour
## Posts for agents: {marker, kind, object, agent (person or null), arrived}. A post marker with a child "span" is a
## seat span (a bench: one can sit anywhere from -span.x to span.x along the post's X): its entry never has an agent
## but has span (metres), need (half the width each sitter takes: the widest clip of the kind, ClipPose.half_width),
## seats (the places taken) and room (a Callable: is there a free place?). Taking it adds a seat, an ordinary post
## entry {..., of: the span, x} on a Marker3D made at that place; leaving removes it.
var posts: Array = []
var _seats_made := 0

func _init(level_: Node3D) -> void:
	level = level_
	name = "Crowd"

func _exit_tree() -> void:
	# Post reservations link dictionaries in both directions; release them before shutdown.
	for post in posts: post.agent=null
	for person in people:
		if person.has("action"): person.action=null
		person.erase("seat_next")

func _fail(msg: String) -> void:
	errors.append(msg)

## An error found while running (a path that should exist does not): stop the game.
func _die(msg: String) -> void:
	push_error("Crowd: " + msg)
	printerr("Crowd: " + msg)
	set_process(false)
	get_tree().quit(1)

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
	if level.population.behaviour:
		beh = Behaviour.new()
		if beh.error != "":
			_fail(beh.error)
			return
	var wanted := {}
	for field in POPULATION:
		var n: int = level.population.get(field)
		if n > 0:
			wanted[POPULATION[field]] = n
	if not wanted.is_empty():
		grid = WalkGrid.new(level, p.grid, level.slot_map, "user://walk_grid/%s.bin" % level.scene_file_path.get_base_dir().get_file())
		if grid.error != "":
			_fail(grid.error)
			return
		# a grid read from the cache passed these checks when it was built and saved
		if not grid.from_cache:
			for a in grid.unreachable_areas(p.visitMaxCost, p.grid.pocketArea):
				_fail("pavement at x %.1f, z %.1f (%.1f x %.1f m) cannot be reached from any way in" % [a.centre.x, a.centre.z, a.size.x, a.size.y])
		for mode in WalkGrid.MODES:
			exits[mode] = grid.exits(mode)
		if not grid.from_cache:
			_check_exits(wanted)
		if errors.is_empty():
			grid.save()
	if not errors.is_empty():
		return
	for m in level.find_children("post_*", "Marker3D", true, false):
		if m.is_in_group("pose_anchor"): continue
		var kind: String = String(m.name).split("_")[1]
		if beh != null:
			var post := {"marker": m, "kind": kind, "object": m.get_parent(), "agent": null, "arrived": false}
			var span := m.get_node_or_null("span") as Node3D
			if span != null:
				post.span = span.position.x
				post.need = _seat_need(kind)
				post.seats = []
				post.room = func() -> bool: return not is_nan(_free_seat_x(post, 0.0))
				if post.need > post.span:
					_fail("%s: the seat span (%.2f m each way) is narrower than one sitter (%.2f m)" % [m.get_path(), post.span, post.need])
			posts.append(post)
		elif not p.posts.has(kind):
			_fail("no post kind %s in %s (marker %s)" % [kind, PARAMS, m.get_path()])
		elif p.posts[kind].chance > 0 and not p.posts[kind].clips.is_empty() and rng.randf() < p.posts[kind].chance:
			people.append(_post_person(m, p.posts[kind]))
	for kind in wanted:
		for i in wanted[kind]:
			_spawn(kind, true)

## Half the width a sitter of post kind `kind` takes on a seat span: the widest of the clips agents play there (the
## behaviour rows of the kind and its seating transitions), as baked (ClipPose.half_width).
func _seat_need(kind: String) -> float:
	var ids := []
	for r in beh.t.rows:
		if r.from == "post:" + kind:
			ids.append_array(r.clips.keys())
	var pair: Dictionary = p.seating.transitions.get(kind, {})
	if not pair.is_empty():
		ids.append_array([pair.down, pair.up])
	var need := 0.0
	for id in ids:
		var c = ClipPose.of(id)
		if c.error == "" and c.half_width <= 0.0:
			_fail("clip %s is played on a seat span (post kind %s) but its baked file has no half_width" % [id, kind])
		need = maxf(need, c.half_width)
	return need

## The free place on a seat span nearest `prefer` (metres along the span from its middle), NAN when it is full:
## sitters keep 2 * need apart and need from the span's ends.
func _free_seat_x(span: Dictionary, prefer: float) -> float:
	var limit: float = span.span - span.need
	var tries := [clampf(prefer, -limit, limit), -limit, limit]
	for seat in span.seats:
		tries.append_array([seat.x - 2.0 * span.need, seat.x + 2.0 * span.need])
	var best := NAN
	for x in tries:
		if x < -limit - 1e-6 or x > limit + 1e-6:
			continue
		if span.seats.any(func(seat): return absf(seat.x - x) < 2.0 * span.need - 1e-6):
			continue
		if is_nan(best) or absf(x - prefer) < absf(best - prefer):
			best = x
	return best

## Takes the free place on seat span `span` nearest the person: a new seat post there, or null when the span is full.
func _take_seat(span: Dictionary, person: Dictionary):
	var marker: Marker3D = span.marker
	var prefer: float = (marker.global_transform.affine_inverse() * person.pos).x
	var x := _free_seat_x(span, prefer)
	if is_nan(x):
		return null
	_seats_made += 1
	var m := Marker3D.new()
	m.name = "seat_%d" % _seats_made
	span.object.add_child(m)
	m.transform = marker.transform * Transform3D(Basis.IDENTITY, Vector3(x, 0, 0))
	var approach := Marker3D.new()
	approach.name = "approach"
	approach.position = (marker.get_node("approach") as Node3D).position
	m.add_child(approach)
	var seat := {"marker": m, "kind": span.kind, "object": span.object, "agent": null, "arrived": false, "of": span, "x": x}
	span.seats.append(seat)
	posts.append(seat)
	return seat

func _leave_seat(seat: Dictionary) -> void:
	seat.of.seats.erase(seat)
	posts.erase(seat)
	seat.marker.queue_free()

## Every clip named in crowd-params must load and be used where npc/clip-setup.json allows (a clip
## declared for a post kind only in posts of that kind). Clips whose declaration names something
## missing are taken out of the lists here, so they are never played; a post kind left with none
## gets nobody.
func _check_clips() -> void:
	var setup = ClipSetup.shared()
	if setup.error != "":
		_fail(setup.error)
		return
	var needed: Array = [p.idleClip]
	for kind in p.seating.transitions:
		needed.append_array([p.seating.transitions[kind].down, p.seating.transitions[kind].up])
	for id in needed:
		if ClipPose.of(id).error != "":
			_fail("clip %s: %s" % [id, ClipPose.of(id).error])
	var lists := []
	for k in p.walkers:
		lists.append([p.walkers[k], "", "%s walkers.%s" % [PARAMS, k]])
	for k in p.posts:
		lists.append([p.posts[k], k, "%s posts.%s" % [PARAMS, k]])
	for l in lists:
		var ok := {}
		for id in l[0].clips:
			var c = ClipPose.of(id)
			if c.error != "":
				_fail("clip %s: %s" % [id, c.error])
			var e: String = setup.check_use(id, l[1], l[2])
			if e != "":
				_fail(e)
			if setup.missing(id).is_empty():
				ok[id] = l[0].clips[id]
		if ok.is_empty() and l[1] == "":
			_fail("%s: every clip misses something (npc/clip-setup.json); walkers need one" % l[2])
		l[0].clips = ok

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
	return grid.snap_point("walk", Vector3(e.point.x, e.point.y, rng.randf_range(e.span.x, e.span.y)))

## Targets for one visit: some random spots on pavement, then an exit away from where one is.
func _trip(from: Vector3, visits: Array) -> Array:
	var legs := []
	for i in rng.randi_range(visits[0], visits[1]):
		var q = grid.random_point("walk", rng, p.visitMaxCost)
		if q != null:
			legs.append(q)
	var ends: Array = exits.walk
	var far := ends.filter(func(e): return absf(e.point.x - from.x) > p.exitMinDistance)
	if far.is_empty():
		_die("no way out farther than exitMinDistance (%.1f m) from x %.1f" % [p.exitMinDistance, from.x])
		return legs
	legs.append(_exit_point(far[rng.randi() % far.size()]))
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
			_die("no path from %s to %s" % [from, goal])
			return false
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
	if kind == "pedestrian" and beh != null:
		var who: String = beh.kinds()[0]
		var person := {"type": "agent", "kind": who, "figure": _figure(body_scale), "pos": _start_point(anywhere),
			"yaw": rng.randf() * TAU, "action": null, "think": rng.randf() * beh.t.rethink, "clock": 0.0, "done": {}}
		people.append(person)
	elif p.walkers.has(kind):
		var person := {"type": "walker", "kind": kind, "figure": _figure(body_scale)}
		_new_walker_trip(person, _start_point(anywhere))
		people.append(person)
	elif kind == "dog_walker":
		var breed := _pick(p.dogWalker.breeds)
		var dog := AnimalBody.new()
		add_child(dog)
		dog.setup(breed)
		var person := {"type": "dog", "kind": kind, "walker": _figure(body_scale), "dog": dog, "breed": breed, "rope": _figure(1.0)}
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
		_die("walker trip from %s has nowhere to go" % from)

func _new_dog_trip(person: Dictionary, from: Vector3) -> void:
	var dw := DogWalker.new(from, rng.randf() * TAU, body_scale, grid.height_at, person.breed)
	if dw.error != "":
		_fail("dog walker: " + dw.error)
		return
	person.dw = dw
	person.legs = _trip(from, p.dogWalker.visits)
	if not _next_leg(person, from):
		_die("dog walker trip from %s has nowhere to go" % from)

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
		_die("no ride from z %.1f" % s.point.z)
		return
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
	_time += dt
	var n := ceili(dt / STEP)
	var cam := get_viewport().get_camera_3d()
	_view = cam.get_frustum() if cam != null else []
	_frame += 1
	_every = maxi(1, floori(_view_height(cam) / p.redrawMetres)) if cam != null else 1
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
	# agents only follow paths and play clips: one step a frame is enough (the dogs and riders above
	# balance and step, and need short steps)
	for person in people:
		if person.type == "agent":
			_update_agent(person, dt)

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
	if not _draw or _off_screen([person.figure], here[0]):
		return
	var fig: Node3D = person.figure
	fig.transform = Transform3D(Basis(Vector3.UP, person.yaw).scaled(Vector3.ONE * body_scale), here[0])
	if not _stale(fig):
		_draw_clip(person, clip, person.phase)

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
	if not _draw or _off_screen([person.walker, person.dog, person.rope], dw.walker.position):
		return
	var w: Node3D = person.walker
	w.transform = dw.walker_transform().scaled_local(Vector3.ONE * dw.body_scale)
	_draw_figure(w, dw.walker_drawing())
	var dog_pose := dw.dog_pose()
	person.dog.show_pose(dog_pose)
	_draw_figure(person.rope, dw.rope_drawing(dog_pose.collar))

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
	if not _draw or _off_screen([person.figure], here[0]):
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
	if not _draw or _off_screen([person.figure], person.marker.global_position):
		return
	var m: Marker3D = person.marker
	var fig: Node3D = person.figure
	fig.global_transform = Transform3D(m.global_basis.orthonormalized().scaled(Vector3.ONE * body_scale), m.global_position)
	_draw_clip(person, clip, person.time / clip.duration(), m.get_parent())

# ---------------------------------------------------------------- agents (population.behaviour)

func _update_agent(person: Dictionary, dt: float) -> void:
	person.clock += dt
	if person.has("seat_transition"):
		_update_seating(person,dt)
		return
	person.think -= dt
	if person.think <= 0.0:
		person.think = beh.t.rethink
		var next = beh.choose(person, posts, rng)
		if next != null:
			_start_action(person, next)
			if person.has("seat_transition"):
				_update_seating(person,dt)
				return
	var a = person.action
	if a == null:
		_draw_agent(person, null, 0.0)
		return
	if a.has("path"):
		_agent_walk(person, a, dt)
	else:
		a.time += dt
		var clip = ClipPose.of(a.clip)
		if a.time >= a.plays * clip.duration():
			_end_action(person)
			if person.has("seat_transition"):
				_update_seating(person,dt)
				return
			_draw_agent(person, null, 0.0)
			return
		_draw_agent(person, clip, a.time / clip.duration())

## Starts an action: releases the old post, takes the new one, plans the walk if there is one.
func _start_action(person: Dictionary, a: Dictionary) -> void:
	if person.action != null and person.action.get("seated",false):
		person["seat_next"]=a
		_begin_seating(person,false,false)
		return
	_end_action(person, false)
	person.action = a
	var goal = null
	match a.do:
		"go":
			goal = grid.random_point("walk", rng, p.visitMaxCost)
		"leave":
			var far := (exits.walk as Array).filter(func(e): return absf(e.point.x - person.pos.x) > p.exitMinDistance)
			if far.is_empty():
				_die("no way out farther than exitMinDistance from x %.1f" % person.pos.x)
				return
			goal = _exit_point(far[rng.randi() % far.size()])
			a.clip = beh.walk_clip(person.kind, rng)
		"use":
			if a.post.has("span"):
				var seat = _take_seat(a.post, person)
				if seat == null:  # filled up since it was chosen
					person.action = null
					person.think = 0.0
					return
				a.post = seat
			a.post.agent = person
			goal = a.post.marker.global_position
			if a.clip in p.seating.clips:
				var approach: Marker3D=a.post.marker.get_node("approach")
				a["seat_approach"]=approach.position
				goal += a.post.marker.global_basis*a.seat_approach
			a.play = a.clip
			a.clip = beh.walk_clip(person.kind, rng)
	if goal == null:
		return
	var pts := grid.plan("walk", person.pos, goal)
	if pts.size() == 1 or (pts.is_empty() and person.pos.distance_to(goal) < 1.0):
		# already there (both ends on one face, or standing on the post after using it)
		if a.do != "use":
			_end_action(person)
			return
		if person.pos.distance_to(goal) < 0.05:
			_arrive(person, a)
			return
		pts = PackedVector3Array([person.pos])  # a step or two straight onto the post
	if pts.is_empty():
		_die("no walk from %s to %s (%s)" % [person.pos, goal, a.post.marker.get_path() if a.post else a.do])
		return
	if a.do == "use" and pts[-1].distance_to(goal) < p.postStep:
		pts.append(goal)  # the last step onto the post itself (a seat, behind a counter): no jump
	var clip = ClipPose.of(a.clip)
	a.path = _path(pts)
	a.d = 0.0
	a.phase = rng.randf()
	a.speed = clip.stride() * body_scale / clip.duration() * (1.0 + rng.randf_range(-0.1, 0.1))

## Ends the current action: its post is free again. done: it was finished, not replaced (the row
## then sits out the person's choices for a while, behaviour.gd `again`).
func _end_action(person: Dictionary, done := true) -> void:
	var a = person.action
	if a == null:
		return
	if a.get("seated",false):
		_begin_seating(person,false,done)
		return
	if a.post != null and a.post.agent == person:
		a.post.agent = null
		a.post.arrived = false
		if a.post.has("of"):
			_leave_seat(a.post)
	if done:
		person.done[a.row] = person.clock
	person.action = null
	person.think = 0.0

func _agent_walk(person: Dictionary, a: Dictionary, dt: float) -> void:
	var clip = ClipPose.of(a.clip)
	var metres: float = a.speed * dt
	a.d += metres
	a.phase = fposmod(a.phase + metres / (clip.stride() * body_scale), 1.0)
	var here := _at(a.path, a.d)
	person.pos = here[0]
	var heading: float = here[1]
	if a.do == "use":
		var remaining: float = a.path.length-a.d
		var forward: Vector3 = a.post.marker.global_basis.z
		var face := atan2(forward.x,forward.z)
		var turn_distance: float = maxf(p.postApproachTurn,absf(angle_difference(heading,face))*a.speed/p.turnRate*1.5)
		var blend := 1.0-smoothstep(0.0,turn_distance,remaining)
		heading += angle_difference(heading,face)*blend
	person.yaw = _turn(person.yaw, heading, dt)
	if a.do == "use" and a.path.length-a.d <= p.postSnapRadius:
		_arrive(person,a)
		return
	if a.d >= a.path.length:
		match a.do:
			"go":
				_end_action(person)
			"leave":  # gone; someone else comes in at an end of the ground
				_end_action(person)
				person.pos = _start_point(false)
				person.done = {}
			"use":
				_arrive(person, a)
				return
	_draw_agent(person, clip, a.phase)

## At the post: stand on its marker, face its way, play the post's clip.
func _arrive(person: Dictionary, a: Dictionary) -> void:
	if a.has("seat_approach"):
		a.erase("path")
		a.clip=a.play
		a.time=0.0
		_begin_seating(person,true,false)
		return
	a.erase("path")
	a.clip = a.play
	a.time = 0.0
	a.post.arrived = true
	person.pos = a.post.marker.global_position
	var f: Vector3 = a.post.marker.global_basis.z
	a.face = atan2(f.x, f.z)
	person.yaw = a.face

func _begin_seating(person: Dictionary, entering: bool, done: bool) -> void:
	var a: Dictionary=person.action
	var f: Vector3=a.post.marker.global_basis.z
	person["seat_transition"]={"time":0.0,"entering":entering,"done":done,"face":atan2(f.x,f.z)}

## Sitting down and standing up are clips (crowd-params seating.transitions of the post kind: down, up), played
## once at the seat's post marker; they were made with the person standing at the post's approach marker. A post
## kind without them switches at once (the switch is faded).
func _update_seating(person: Dictionary, dt: float) -> void:
	var tr: Dictionary=person.seat_transition
	var a: Dictionary=person.action
	person.yaw=tr.face
	tr.time+=dt
	var pair: Dictionary=p.seating.transitions.get(a.post.kind,{})
	var u:=1.0
	if not pair.is_empty():
		var clip=ClipPose.of(pair.down if tr.entering else pair.up)
		u=clampf(tr.time/clip.duration(),0,1)
		var marker: Marker3D=a.post.marker
		if _draw and not _off_screen([person.figure],person.pos):
			person.figure.transform=Transform3D(marker.global_basis.orthonormalized().scaled(Vector3.ONE*body_scale),marker.global_position)
			_draw_clip(person,clip,u,a.post.object)
	if u<1: return
	var marker: Marker3D=a.post.marker
	person.erase("seat_transition")
	if tr.entering:
		person.pos=marker.global_position
		a["seated"]=true
		a.face=tr.face
		a.post.arrived=true
	else:
		person.pos=marker.global_position+marker.global_basis*a.seat_approach
		a.seated=false
		_end_action(person,tr.done)
		if person.has("seat_next"):
			var next: Dictionary=person.seat_next
			person.erase("seat_next")
			# Another agent may have taken the destination while this one stood up.
			if next.post==null or next.post.agent==null: _start_action(person,next)

func _draw_agent(person: Dictionary, clip, phase: float) -> void:
	if not _draw or _off_screen([person.figure], person.pos):
		return
	var fig: Node3D = person.figure
	fig.transform = Transform3D(Basis(Vector3.UP, person.yaw).scaled(Vector3.ONE * body_scale), person.pos)
	if _stale(fig):
		return
	if clip == null:  # between actions: standing
		clip = ClipPose.of(p.idleClip)
		phase = person.clock / clip.duration()
	var object = person.action.post.object if person.action != null and not person.action.has("path") and person.action.post != null else null
	_draw_clip(person, clip, phase, object)

## Draws one pose of a clip on the person's figure (already placed): a clip that does not chain plays its
## phase 0..1 once per play (phase 1..2 is the second play, and so on), each play fading in from the last.
func _draw_clip(person: Dictionary, clip, phase: float, object = null) -> void:
	var play := 0
	var local := phase
	if not clip.chains:
		play = maxi(0, ceili(phase) - 1)
		local = clampf(phase - play, 0.0, 1.0)
	var fig: Node3D = person.figure
	var key := "%s:%d:%d" % [clip.id, play, object.get_instance_id() if object != null else 0]
	var pose: Dictionary = PoseFade.apply(person, key, clip.pose(local), fig.transform, _time, p.fade).duplicate(true)
	_ground_feet(pose, fig, clip)
	PoseFade.remember(person, pose, fig.transform)
	_draw_figure(fig, clip.drawing(pose))
	var extras: Dictionary = clip.extras(local, false)
	_place_item(person, clip, pose, extras)
	_carry_parts(person, clip, extras, object)

## The held thing of the clip (npc/clip-setup.json item) on the hand, both hands' midpoint or the neck.
func _place_item(person: Dictionary, clip, pose: Dictionary, extras: Dictionary) -> void:
	var setup = ClipSetup.shared()
	var item: Dictionary = setup.clips.get(clip.id, {}).get("item", {})
	var want: String = item.get("type", "")
	if person.get("item_type", "") != want:
		if person.has("item_node"):
			person.item_node.queue_free()
			person.erase("item_node")
		person.item_type = want
		if want != "":
			var node: Node3D = load(setup.type_path(want)).instantiate()
			person.figure.add_child(node)
			node.top_level = true  # follows the hand, not the scaled figure; hidden with it
			level.apply_look_to(level.slot_map, node)
			person.item_node = node
	if want == "":
		return
	var q: Vector3 = pose.handRight
	match item.hand:
		"left": q = pose.handLeft
		"both": q = (pose.handLeft + pose.handRight) / 2
		"back": q = pose.neck
	var fig: Node3D = person.figure
	person.item_node.global_transform = Transform3D(fig.global_basis.orthonormalized() * Basis(extras.turn), fig.global_transform * q)
	person.item_node.visible = extras.shown

## Parts of the post's object the clip carries (npc/clip_pose.gd extras): where the clip has them, at rest otherwise;
## the parts this person moved are put back when it plays something else.
func _carry_parts(person: Dictionary, clip, extras: Dictionary, object) -> void:
	var moved: Dictionary = person.get("moved_parts", {})
	var marker: Node3D = null
	if object != null:
		var a = person.get("action")
		marker = a.post.marker if a != null and a.post != null else person.get("marker")
	for node in moved.keys():
		if not is_instance_valid(node):
			moved.erase(node)
		elif object == null or not String(node.name) in clip.carries():
			node.global_transform = moved[node]
			moved.erase(node)
	if object == null or marker == null:
		person.moved_parts = moved
		return
	for part in clip.carries():
		var node := (object as Node).find_child(part, true, false) as Node3D
		if node == null:
			_die("%s has no part %s (carried by %s)" % [object.name, part, clip.id])
			return
		if not moved.has(node):
			moved[node] = node.global_transform
		var rest: Transform3D = moved[node]
		node.global_transform = Transform3D(rest.basis, marker.global_transform * extras.parts[part]) if extras.parts.has(part) else rest
	person.moved_parts = moved

func _ground_feet(pose: Dictionary, figure: Node3D, clip) -> void:
	var floor_query := func(q: Vector3) -> float: return grid.height_at(q) if grid != null else figure.global_position.y
	if ContactPose.ground_feet(pose,figure.global_transform,clip.P.line,floor_query)>0.001:
		_die(clip.id+": unreachable ground contact")

## Off the screen (by more than a body's height): the figure is hidden and not posed or rebuilt this
## frame (rebuilding every stick figure's mesh is most of the crowd's cost). The people still move.
func _off_screen(figures: Array, at: Vector3) -> bool:
	var off := false
	for pl in _view:
		if pl.distance_to(at) > p.offScreenMargin:
			off = true
			break
	for f in figures:
		f.visible = not off
	return off

## Metres of ground the screen is tall where the camera looks: the orbit camera's zoom, else the
## orthogonal size, else (a perspective camera that is not the orbit camera) 0.
static func _view_height(cam: Camera3D) -> float:
	if "height" in cam:
		return cam.height
	return cam.size if cam.projection == Camera3D.PROJECTION_ORTHOGONAL else 0.0

## True when this figure keeps last frame's pose (see _every).
func _stale(fig: Node3D) -> bool:
	return (fig.get_instance_id() + _frame) % _every != 0
