## What the empty ground shows for one list entry, how it moves, and what dragging writes back
## (godot/README.md "空地"). The UI (empty_ground.gd) and tools/check_empty_ground.gd drive it.
##
## Entries, all read from data: every clip in npc/motion/index.json, the movers in movers.json (dog, dog
## walker, riders, pigeon) and, for each species in its animals, the scenarios ANIMAL_SCENARIOS and the
## actions npc/animal-models.json gives that species.
## A clip is placed from npc/clip-setup.json: a post kind puts an object type offering that post and the
## person on its marker; an item hangs a held type on the hand; a partner puts the second person where
## the first opens a place (a clip that is someone's partner shows the pair too). Things the setup names
## that do not exist are left out and listed in the entry's `missing` (the one exception to stopping).
## A clip that travels walks its own displacement; one whose last frame repeats its first keeps going
## (and climbing, on stairs) until params.replayAfter metres or params.replayRise metres up or down, then
## starts over; others start over each pass.
## Pushed objects (type group ClipSetup.PUSHED) follow the person's root instead of the person standing on them.
##
## Dragging moves things over the ground (vertical with shift: see empty_ground.gd). On release only
## relations are written: a person on an object -> that object type's post marker; a pushed object ->
## the same marker; a partner -> clip-setup.json; an item -> its held type's model offset. Moving an object
## with people on it, a person with a partner or a pushed object, or anything added by hand writes nothing.
extends Node3D

const ClipPose := preload("res://npc/clip_pose.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const Pigeon := preload("res://npc/procedural_pigeon.gd")
const Rider := preload("res://npc/rider.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const Animal := preload("res://npc/animal.gd")
const AnimalModel := preload("res://npc/animal_model.gd")
const AnimalBody := preload("res://npc/animal_body.gd")
const Preview := preload("res://tools/animal_behaviour_preview.gd")
const Bounds := preload("res://core/bounds.gd")
const PARAMS := "res://scenes/empty_ground/params.json"
const MOVERS := "res://scenes/empty_ground/movers.json"
const CROWD := "res://npc/crowd-params.json"
const INDEX := "res://npc/motion/index.json"
const BEHAVIOUR := "res://npc/animal-behaviour.json"
const MOVER_KINDS := ["dog", "leash", "rider", "pigeon"]
## Animal list entries that are review scenarios rather than actions of animal-models.json.
const ANIMAL_SCENARIOS := ["walk", "trot", "behaviour"]
const FLAT := 0.0

var level          # the empty ground (core/level.gd): apply_look_to, slot_map
var error := ""
var p: Dictionary
var m: Dictionary  # movers.json
var setup          # npc/clip_setup.gd
var body_scale: float
var ink: Color
var depth_bias: float
var entries: Array = []   # {id, kind (clip | mover | animal), label, missing, ...}
var by_id := {}
var partner_of := {}      # clip -> the clip that declares it as its partner
var entry := {}
var options := {}         # item (held type path), object (type path), breed
var t := 0.0              # time in the entry, 0 .. cycle
var cycle := 1.0
var clock := 0.0          # people added by hand play on their own clock
var people: Array = []    # {fig, clip, clip_id, start, anchor, item, manual, root, pose}
var objects: Array = []   # {node, type, manual, pusher, marker}
var main = null           # the person of the selected clip
var ms := {}              # mover / animal state
var extras: Array = []    # other nodes placed for the entry (figures of movers, grid lines, platform)
var _stale := {}          # type files written this session: loaded fresh next time

## Reads and checks everything; "" or the error.
func setup_stage(level_) -> String:
	level = level_
	name = "Stage"
	p = _read(PARAMS)
	m = _read(MOVERS)
	var crowd := _read(CROWD)
	var bodies := _read("res://npc/body-types.json")
	var index := _read(INDEX)
	if error != "":
		return error
	for k in ["replayAfter", "replayRise", "frame", "manualOffset", "pickMargin", "speed", "panelWidth", "fontSize", "verticalKey"]:
		if not p.has(k):
			return _fail("%s: no %s" % [PARAMS, k])
	body_scale = bodies[crowd.body].scale
	ink = Color(crowd.ink[0], crowd.ink[1], crowd.ink[2])
	depth_bias = crowd.depthBias
	setup = ClipSetup.shared()
	if setup.error != "":
		return _fail(setup.error)
	for c in setup.clips:
		if setup.clips[c].has("partner"):
			partner_of[setup.clips[c].partner.clip] = c
	for c in index.clips:
		var id: String = c.id
		var s: Dictionary = setup.clips.get(id, {})
		var tags := []
		if s.has("post"):
			tags.append("post:" + s.post)
		if s.has("item"):
			tags.append("%s %s" % [s.item.type, s.item.hand])
		if s.has("partner"):
			tags.append("+ " + s.partner.clip)
		elif partner_of.has(id):
			tags.append("partner of " + partner_of[id])
		_add({"id": id, "kind": "clip", "clip": id, "missing": setup.missing(id),
			"label": id + ("   · " + ", ".join(tags) if not tags.is_empty() else "")})
	if not (m.get("movers") is Dictionary and m.get("animals") is Dictionary and m.get("dt") is float):
		return _fail(MOVERS + ": needs dt, movers and animals")
	for id in m.movers:
		var d: Dictionary = m.movers[id]
		if not (d.get("kind") in MOVER_KINDS and d.get("label") is String and d.get("cycle") is float and d.get("frame") is float and d.get("follow") is bool):
			return _fail("%s: mover %s needs kind (one of %s), label, cycle, frame, follow" % [MOVERS, id, MOVER_KINDS])
		_add({"id": id, "kind": "mover", "label": d.label, "missing": []})
	var species: Dictionary = AnimalModel.config().species
	for sp in m.animals:
		var a: Dictionary = m.animals[sp]
		if not (species.has(sp) and a.get("label") is String and not AnimalModel.breeds(sp).is_empty()):
			return _fail("%s: animals.%s needs a label and a species with breeds in npc/animal-models.json" % [MOVERS, sp])
		for action in ANIMAL_SCENARIOS + species[sp]:
			_add({"id": "%s:%s" % [sp, action], "kind": "animal", "species": sp, "action": action,
				"label": "%s · %s" % [a.label, action], "missing": []})
	return error

func _add(e: Dictionary) -> void:
	if by_id.has(e.id):
		_fail("two list entries named " + e.id)
		return
	entries.append(e)
	by_id[e.id] = e

func _fail(msg: String) -> String:
	if error == "":
		error = msg
	return error

func _read(path: String) -> Dictionary:
	var v = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (v is Dictionary):
		_fail(path + ": missing or not a JSON object")
		return {}
	return v

# ------------------------------------------------------------------ choices

## Types that could stand in for the entry's object (all offering its post kind), [] if none.
func object_choices() -> Array:
	var kind: String = setup.post_of(_first_clip()) if entry.get("kind") == "clip" else ""
	return setup.offers.get(kind, []) if kind != "" else []

## Held types that could stand in for the entry's item ([] when the clip holds nothing).
func item_choices() -> Array:
	if entry.get("kind") != "clip" or not setup.clips.get(_first_clip(), {}).has("item"):
		return []
	return setup.held_types()

## Breeds (npc/animal-models.json) for an animal entry or a dog / dog walker mover, else [].
func breed_choices() -> Array:
	if entry.get("kind") == "animal":
		return AnimalModel.breeds(entry.species)
	if entry.get("kind") == "mover" and m.movers[entry.id].kind in ["dog", "leash"]:
		return AnimalModel.breeds("dog")
	return []

## The breed the entry shows: the chosen one, else the species' first.
func _breed(species: String) -> String:
	var breeds := AnimalModel.breeds(species)
	var b: String = options.get("breed", breeds[0])
	if not b in breeds:
		b = breeds[0]  # a breed chosen for another species' entry
	return b

## The model body of a breed, placed for this entry.
func _animal_body(breed: String) -> Node3D:
	var body := AnimalBody.new()
	add_child(body)
	body.setup(breed)
	extras.append(body)
	return body

## The held type on the entry's first person, "" if none.
func person_item_type() -> String:
	for person in people:
		if not person.manual and person.item != null:
			return person.item.type
	return ""

## The type of the object placed for the entry, "" if none.
func object_type() -> String:
	for o in objects:
		if not o.manual:
			return o.type
	return ""

## The clip that is arranged first: a clip that is only someone's partner shows that someone's setup.
func _first_clip() -> String:
	var id: String = entry.clip
	return partner_of[id] if not setup.clips.get(id, {}).has("partner") and partner_of.has(id) else id

# ------------------------------------------------------------------ select

## Shows the entry (things placed for the last one are removed; things added by hand stay).
## opts: item / object (type paths), breed. Returns "" or the error.
func select(id: String, opts := {}) -> String:
	if not by_id.has(id):
		return _fail("no list entry " + id)
	_clear()
	entry = by_id[id]
	options = opts
	t = 0.0
	match entry.kind:
		"clip":
			_arrange_clip()
		"mover":
			_start_mover()
		"animal":
			_start_animal()
	if error == "":
		seek(0.0)
	return error

func _clear() -> void:
	for person in people.duplicate():
		if not person.manual:
			_free_person(person)
	for o in objects.duplicate():
		if not o.manual:
			objects.erase(o)
			o.node.queue_free()
	for n in extras:
		n.queue_free()
	extras.clear()
	ms = {}
	main = null

func _free_person(person: Dictionary) -> void:
	people.erase(person)
	person.fig.queue_free()
	if person.item != null:
		person.item.node.queue_free()

func _arrange_clip() -> void:
	var first := _first_clip()
	var s: Dictionary = setup.clips.get(first, {})
	var lead = _person(first, Transform3D.IDENTITY, false)
	if lead == null:
		return
	if s.has("post") and setup.offers.has(s.post):
		var type: String = options.get("object", setup.offers[s.post][0])
		if not type in setup.offers[s.post]:
			_fail("%s does not offer post %s" % [type, s.post])
			return
		var o := _object(type, false)
		var markers: Array = setup.types[type].posts.keys().filter(func(n): return setup.types[type].posts[n] == s.post)
		markers.sort()
		var mk: Node3D = o.node.get_node(markers[0])
		if ClipSetup.PUSHED in setup.types[type].groups:
			o.pusher = lead
			o.marker = markers[0]
		else:
			o.node.transform = lead.start * _marker(o, markers[0]).affine_inverse()
			lead.anchor = {"object": o, "marker": mk.name}
	if s.has("item") and (options.has("item") or setup.types.has(setup.type_path(s.item.type))):
		var held: String = options.get("item", setup.type_path(s.item.type))
		if not held in setup.held_types():
			_fail("%s is not a held type" % held)
			return
		_hold(lead, held, s.item.hand)
	main = lead
	if s.has("partner") and setup.missing(first).all(func(x): return not x.begins_with("no partner")):
		var other = _person(s.partner.clip, Transform3D.IDENTITY, false)
		if other == null:
			return
		other.anchor = {"giver": lead, "clip": first}
		if s.partner.clip == entry.clip:
			main = other
	cycle = _cycle(main)

func _person(clip_id: String, start: Transform3D, manual: bool):
	var clip = ClipPose.of(clip_id)
	if clip.error != "":
		_fail("clip %s: %s" % [clip_id, clip.error])
		return null
	var fig := _figure(ink, depth_bias)
	var person := {"fig": fig, "clip": clip, "clip_id": clip_id, "start": start, "anchor": null, "item": null,
		"manual": manual, "root": start, "pose": {}}
	people.append(person)
	return person

func _figure(color: Color, bias: float, parent: Node = self) -> Node3D:
	var f := InkFigure.new()
	parent.add_child(f)
	f.setup(color, bias)
	return f

## An instance of an object type, given the ink look.
func _object(type: String, manual: bool) -> Dictionary:
	var o := {"node": _instance(type), "type": type, "manual": manual, "pusher": null, "marker": ""}
	objects.append(o)
	return o

func _instance(type: String) -> Node3D:
	var node: Node3D = _load(type).instantiate()
	add_child(node)
	level.apply_look_to(level.slot_map, node)
	return node

func _load(path: String) -> PackedScene:
	if _stale.has(path):
		_stale.erase(path)
		return ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_REPLACE)
	return load(path)

func _marker(o: Dictionary, marker: String) -> Transform3D:
	var mk: Node3D = o.node.get_node(marker)
	return Transform3D(mk.transform.basis.orthonormalized(), mk.transform.origin)

func _hold(person: Dictionary, held: String, hand: String) -> void:
	person.item = {"node": _instance(held), "type": held, "hand": hand}

## Seconds until the entry starts over (see the header).
func _cycle(person: Dictionary) -> float:
	var c = person.clip
	var stride: float = c.stride() * body_scale
	if stride == 0.0 or not c.chains:
		return c.duration()
	return _loops(c, stride) * c.duration()

## Loops a chaining clip plays before it starts over.
func _loops(c, stride: float) -> int:
	var n := maxi(1, ceili(p.replayAfter / stride))
	var rise: float = absf(c.rise() * body_scale)
	return mini(n, maxi(1, floori(p.replayRise / rise + 1e-6))) if rise > 1e-3 else n

# ------------------------------------------------------------------ people

## Where the person stands at the clip's start (not scaled).
func _start(person: Dictionary) -> Transform3D:
	var a = person.anchor
	if a == null:
		return person.start
	if a.has("object"):
		return a.object.node.transform * _marker(a.object, a.marker)
	var pa: Dictionary = setup.clips[a.clip].partner
	return _start(a.giver) * Transform3D(Basis(Vector3.UP, deg_to_rad(pa.yaw)), Vector3(pa.at.x, 0, pa.at.y))

## [root transform, phase] of a person at `time`.
func _root(person: Dictionary, time: float) -> Array:
	var c = person.clip
	var d: float = c.duration()
	var stride: float = c.stride() * body_scale
	var off := Vector3.ZERO
	var phase: float
	if stride == 0.0 or not c.chains:
		phase = fposmod(time, d) / d
		off.z = stride * phase
	else:
		var n := _loops(c, stride)
		var tt := fposmod(time, n * d)
		var k := floori(tt / d)
		phase = tt / d - k
		off = Vector3(0, c.rise() * body_scale * k, stride * (k + phase))
	return [_start(person) * Transform3D(Basis(), off), phase]

func _pose_people() -> void:
	for person in people:
		var rp := _root(person, clock if person.manual else t)
		var root: Transform3D = rp[0]
		person.root = root
		person.pose = person.clip.pose(rp[1])
		person.fig.transform = Transform3D(root.basis.scaled(Vector3.ONE * body_scale), root.origin)
		var d: Dictionary = person.clip.drawing(person.pose)
		person.fig.draw(d.segments, d.discs, d.triangles)
		if person.item != null:
			var q: Vector3
			match person.item.hand:
				"left":
					q = person.pose.handLeft
				"right":
					q = person.pose.handRight
				"both":
					q = (person.pose.handLeft + person.pose.handRight) / 2
				"back":
					q = person.pose.neck
			person.item.node.transform = Transform3D(root.basis, person.fig.transform * q)
	for o in objects:
		if o.pusher != null:
			o.node.transform = o.pusher.root * _marker(o, o.marker).affine_inverse()

# ------------------------------------------------------------------ time

## Moves on by `dt` seconds of the entry (wrapping at its cycle); people added by hand keep their own clock.
func advance(dt: float) -> void:
	clock += dt
	var next := t + dt
	if next >= cycle:
		next = fposmod(next, cycle)
	seek(next)

## Shows the entry at `time` seconds (movers are simulated up to it, from the start when going back).
func seek(time: float) -> void:
	t = clampf(time, 0.0, cycle)
	match entry.get("kind", ""):
		"mover":
			_mover_to(t)
		"animal":
			_animal_to(t)
	_pose_people()

## Where the camera should look while following, and the view height for the entry.
func focus() -> Vector3:
	if not ms.is_empty():
		return ms.focus
	return main.root.origin + Vector3.UP if main != null else Vector3.ZERO

func follows() -> bool:
	return m.movers[entry.id].follow if entry.get("kind") == "mover" else entry.get("kind") == "animal"

## [look-at point, view height] that shows the whole entry.
func framing() -> Array:
	if entry.kind == "mover":
		return [ms.get("look", ms.focus), m.movers[entry.id].frame]
	if entry.kind == "animal":
		var r: Dictionary = ms.c.review
		var box: AABB = ms.m.aabb
		return [ms.focus, r.behaviour_camera_size if entry.action == "behaviour" else r.frame * maxf(box.size.x, maxf(box.size.y, box.size.z))]
	var box := AABB()
	var any := false
	for o in objects:
		if not o.manual:
			var b := Bounds.of_node(o.node)
			box = b if not any else box.merge(b)
			any = true
	for person in people:
		if person.manual:
			continue
		for time in [0.0, cycle * 0.999]:
			var at: Vector3 = _root(person, time)[0].origin
			box = AABB(at, Vector3(0, 1.8, 0)) if not any else box.expand(at).expand(at + Vector3(0, 1.8, 0))
			any = true
	var size: float = maxf(box.size.x, maxf(box.size.y, box.size.z)) * p.frame.margin
	return [box.get_center(), clampf(size, p.frame.min, p.frame.max)]

# ------------------------------------------------------------------ added by hand

## A person playing the current clip (or nothing when the entry is not a clip), kept across entries.
func add_person(at: Vector3) -> String:
	if entry.get("kind") != "clip":
		return "only a clip entry can add a person (it plays that clip)"
	_person(entry.clip, Transform3D(Basis(), at), true)
	_pose_people()
	return error

func add_object(type: String, at: Vector3) -> String:
	var o := _object(type, true)
	o.node.position = at
	return error

func all_types() -> Array:
	return setup.types.keys()

# ------------------------------------------------------------------ dragging

## What is under a screen point: {what: item | person | object, ref} or {}. Items first, then people,
## then objects; the smallest on screen wins. Movers are not draggable.
func pick(screen: Vector2, cam: Camera3D) -> Dictionary:
	var margin: float = p.pickMargin
	for tier in ["item", "person", "object"]:
		var best := {}
		var best_area := INF
		var list: Array = people.filter(func(q): return q.item != null) if tier == "item" else (people if tier == "person" else objects)
		for ref in list:
			var node: Node3D = ref.item.node if tier == "item" else (ref.fig if tier == "person" else ref.node)
			var r := _screen_rect(Bounds.of_node(node), cam).grow(margin)
			if r.has_point(screen) and r.get_area() < best_area:
				best = {"what": tier, "ref": ref}
				best_area = r.get_area()
		if not best.is_empty():
			return best
	return {}

static func _screen_rect(b: AABB, cam: Camera3D) -> Rect2:
	var r := Rect2(cam.unproject_position(b.position), Vector2.ZERO)
	for i in 8:
		r = r.expand(cam.unproject_position(b.get_endpoint(i)))
	return r

## A point of the handle (world), for the drag plane.
func handle_point(h: Dictionary) -> Vector3:
	match h.what:
		"item":
			return h.ref.item.node.get_node("model").global_position
		"person":
			return _start(h.ref).origin
	return h.ref.node.global_position

## Moves the handle by `delta` (world metres); only the view changes until release().
func drag(h: Dictionary, delta: Vector3) -> void:
	var ref: Dictionary = h.ref
	match h.what:
		"item":
			var model: Node3D = ref.item.node.get_node("model")
			model.position += ref.item.node.basis.inverse() * delta
		"person":
			var a = ref.anchor
			var at: Vector3 = _start(ref).origin + delta
			if a == null:
				ref.start.origin += delta
			elif a.has("object"):
				a.object.node.get_node(a.marker).position = a.object.node.transform.affine_inverse() * at
			else:
				var local: Vector3 = _start(a.giver).affine_inverse() * at
				setup.clips[a.clip].partner.at = Vector2(local.x, local.z)
		"object":
			if ref.pusher != null:
				# the object is root * marker^-1: moving it moves the person's place on it the other way
				var moved: Transform3D = ref.node.transform.translated(delta)
				ref.node.get_node(ref.marker).position = moved.affine_inverse() * ref.pusher.root.origin
			else:
				ref.node.position += delta
	_pose_people()

## Ends a drag: writes the relation that changed (see the header). Returns {error, wrote}.
func release(h: Dictionary) -> Dictionary:
	var ref: Dictionary = h.ref
	match h.what:
		"item":
			var model: Node3D = ref.item.node.get_node("model")
			return _write_node(ref.item.type, "model", model.transform)
		"person":
			var a = ref.anchor
			if a == null:
				return {"error": "", "wrote": ""}
			if a.has("object"):
				return _write_node(a.object.type, a.marker, a.object.node.get_node(a.marker).transform)
			var e: String = setup.set_partner_at(a.clip, setup.clips[a.clip].partner.at)
			return {"error": e, "wrote": "" if e != "" else "%s %s partner.at" % [ClipSetup.PATH, a.clip]}
		"object":
			if ref.pusher != null:
				return _write_node(ref.type, ref.marker, ref.node.get_node(ref.marker).transform)
	return {"error": "", "wrote": ""}

## Only things added by hand can be removed.
func remove(h: Dictionary) -> bool:
	if h.what == "person" and h.ref.manual:
		_free_person(h.ref)
		return true
	if h.what == "object" and h.ref.manual:
		objects.erase(h.ref)
		h.ref.node.queue_free()
		return true
	return false

## Writes node `node_name`'s transform into the type file and into every live instance of that type.
func _write_node(type: String, node_name: String, xf: Transform3D) -> Dictionary:
	var e := write_transform(type, node_name, xf)
	if e != "":
		return {"error": e, "wrote": ""}
	_stale[type] = true
	for o in objects:
		if o.type == type:
			o.node.get_node(node_name).transform = xf
	for person in people:
		if person.item != null and person.item.type == type:
			person.item.node.get_node(node_name).transform = xf
	_pose_people()
	return {"error": "", "wrote": "%s %s" % [type, node_name]}

## Sets `transform = ...` of a direct child node (parent=".") in a .tscn file, keeping everything else.
static func write_transform(path: String, node_name: String, xf: Transform3D) -> String:
	var text := FileAccess.get_file_as_string(path)
	var out := set_transform_text(text, node_name, xf)
	if out == "":
		return "%s: no node %s under the root" % [path, node_name]
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		return "cannot write " + path
	f.store_string(out)
	f.close()
	return ""

## The .tscn text with node `node_name`'s transform line set (added when it has none); "" if no such node.
static func set_transform_text(text: String, node_name: String, xf: Transform3D) -> String:
	var nl := "\r\n" if "\r\n" in text else "\n"
	var lines := text.replace("\r\n", "\n").split("\n")
	var line := "transform = " + transform_text(xf)
	for i in lines.size():
		if lines[i].begins_with('[node name="%s" ' % node_name) and 'parent="."' in lines[i]:
			var j := i + 1
			while j < lines.size() and not lines[j].begins_with("["):
				if lines[j].begins_with("transform = "):
					lines[j] = line
					return nl.join(lines)
				j += 1
			lines.insert(i + 1, line)
			return nl.join(lines)
	return ""

## Transform3D as a .tscn writes it: the basis row by row, then the origin; 4 decimals.
static func transform_text(xf: Transform3D) -> String:
	var b := xf.basis
	var o := xf.origin
	var v := [b.x.x, b.y.x, b.z.x, b.x.y, b.y.y, b.z.y, b.x.z, b.y.z, b.z.z, o.x, o.y, o.z]
	return "Transform3D(%s)" % ", ".join(v.map(func(x): return _num(x)))

static func _num(x: float) -> String:
	var r := snappedf(x, 0.0001)
	if is_zero_approx(r):
		return "0"
	return str(int(r)) if r == roundf(r) else String.num(r, 4)

# ------------------------------------------------------------------ movers (movers.json)

func _start_mover() -> void:
	var d: Dictionary = m.movers[entry.id]
	ms = {"d": d, "sim": INF, "focus": Vector3.ZERO}
	cycle = d.cycle
	match d.kind:
		"dog":
			ms.m = AnimalModel.info(_breed("dog"))
			if ms.m.error != "":
				_fail(ms.m.error)
				return
			ms.body = _animal_body(ms.m.breed)
		"pigeon":
			ms.p = Pigeon.load_params()
			_ground_grid(d.grid)
			ms.fig = _extra_figure()
		"leash":
			ms.breed = _breed("dog")
			ms.dog_body = _animal_body(ms.breed)
			ms.rope_fig = _extra_figure()
			ms.walker_fig = _extra_figure()
		"rider":
			ms.vehicle = _instance(d.vehicle)
			extras.append(ms.vehicle)
			ms.P = _read("res://npc/skeleton-params.json")
			ms.R = Rider.style(Rider.load_params(), ms.vehicle.rider_style)
			ms.bodies = _read("res://npc/body-types.json")
			ms.fig = _figure(ink, depth_bias, ms.vehicle)
	if d.has("lookAt"):
		_mover_to(d.lookAt)
		ms.look = ms.focus + Vector3.UP * d.lookHeight

func _extra_figure() -> Node3D:
	var f := _figure(ink, depth_bias)
	extras.append(f)
	return f

## Grey lines on the ground every `step` metres, so height and travel show against it (pigeon).
func _ground_grid(step: float) -> void:
	var g := InkFigure.new()
	add_child(g)
	extras.append(g)
	var q: Dictionary = m.grid
	g.setup(Color(q.color[0], q.color[1], q.color[2]), 0.0)
	var segs := []
	var n := int(q.half / step)
	for i in range(-n, n + 1):
		var k := i * step
		segs.append([Vector3(k, 0.002, -q.half), Vector3(k, 0.002, q.half), q.width])
		segs.append([Vector3(-q.half, 0.002, k), Vector3(q.half, 0.002, k), q.width])
	g.draw(segs, [], [])

func _mover_reset() -> void:
	var d: Dictionary = ms.d
	ms.sim = 0.0
	ms.yaw = 0.0
	match d.kind:
		"dog":
			ms.dog = Animal.create(Vector3.ZERO, 0, ms.m)
		"pigeon":
			ms.pig = Pigeon.create(Vector3.ZERO, 0, ms.p)
		"leash":
			ms.dw = DogWalker.new(Vector3.ZERO, 0.0, body_scale, func(_q: Vector3) -> float: return FLAT, ms.breed)
			if ms.dw.error != "":
				_fail(ms.dw.error)
		"rider":
			ms.ride = Rider.start()
			ms.vehicle.transform = Transform3D.IDENTITY

func _mover_to(time: float) -> void:
	var dt: float = m.dt
	if time < ms.sim - 1e-6 or ms.sim == INF:
		_mover_reset()
	while ms.sim + dt <= time + 1e-6 and error == "":
		ms.sim += dt
		_mover_step(ms.sim, dt)
	_mover_draw()

## The review scenarios (numbers in movers.json): the dog walks, trots, stands, walks on; the walker
## walks then stands while wandering; riders cruise an S-curve, pedalling then coasting; the pigeon walks,
## stands looking about, feeds, hops twice, takes off, flies a circle, lands and stands.
func _mover_step(time: float, dt: float) -> void:
	var d: Dictionary = ms.d
	match d.kind:
		"dog":
			var speed := 0.0
			for s in d.speeds:
				if time < s[0]:
					speed = s[1]
					break
			ms.dog = Animal.step(ms.dog, {"speed": speed, "yaw": sin(time * d.turnFrequency) * d.turnAmplitude,
				"ground": func(_q: Vector3) -> float: return FLAT}, dt, ms.m)
		"leash":
			ms.dw.step(ms.dw.walk_speed() if time < d.walkUntil else 0.0, sin(time * d.turnFrequency) * d.turnAmplitude, dt)
		"rider":
			var yaw_rate: float = d.yawRateAmplitude * sin(time * d.yawRateFrequency)
			ms.ride = Rider.step(ms.ride, {"speed": d.cruise, "yawRate": yaw_rate, "pedalling": time < d.pedalUntil}, dt, ms.vehicle.info(), ms.R)
			ms.yaw += yaw_rate * dt
			var v: Node3D = ms.vehicle
			v.position += Vector3(sin(ms.yaw), 0, cos(ms.yaw)) * d.cruise * dt
			v.rotation = Vector3(0, ms.yaw, 0)
			v.rotate_object_local(Vector3.BACK, -ms.ride.roll)
		"pigeon":
			var pig: Dictionary = ms.pig
			var flying: bool = time >= d.fly[0] and time < d.fly[1]
			var hop = null
			for at in d.hops:
				if time - dt < at and at <= time:
					hop = pig.position + Vector3(sin(pig.yaw), 0, cos(pig.yaw)) * d.hopDistance
			var feeding: bool = time >= d.peck[0] and time < d.peck[1]
			var speed: float = d.walkSpeed if time < d.walkUntil else (d.peckSpeed if feeding else (d.flySpeed if time >= d.fly[0] and pig.mode != "ground" else 0.0))
			var yaw: float = (time - d.fly[0]) * d.circleRate if time >= d.fly[0] else sin(time * d.wanderFrequency) * d.wanderAmplitude
			ms.pig = Pigeon.step(pig, {"speed": speed, "yaw": yaw, "ground": FLAT, "peck": feeding, "fly": flying,
				"altitude": d.altitude, "hop": hop}, dt, ms.p)

func _mover_draw() -> void:
	match ms.d.kind:
		"dog":
			ms.body.show_pose(AnimalModel.pose(ms.m, ms.dog))
			ms.focus = ms.dog.position + Vector3.UP * ms.m.p.body.shoulderY
		"pigeon":
			var sil := Pigeon.silhouette(Pigeon.pose(ms.pig, ms.p), ms.p)
			ms.fig.draw(sil.segments, sil.discs, sil.triangles)
			var flying: bool = ms.pig.mode in ["takeoff", "air", "landing"]
			ms.focus = Vector3(ms.pig.position.x, ms.pig.position.y if flying else ms.pig.ground, ms.pig.position.z)
		"leash":
			var dw = ms.dw
			var dog_pose: Dictionary = dw.dog_pose()
			ms.dog_body.show_pose(dog_pose)
			for pair in [[ms.rope_fig, dw.rope_drawing(dog_pose.collar)], [ms.walker_fig, dw.walker_drawing()]]:
				pair[0].draw(pair[1].segments, pair[1].discs, pair[1].triangles)
			ms.walker_fig.transform = dw.walker_transform().scaled_local(Vector3.ONE * dw.body_scale)
			ms.focus = (dw.walker.position + dw.dog.position) / 2 + Vector3.UP * 0.7
		"rider":
			var pose := Rider.solve(ms.vehicle.contacts(ms.ride.crankPhase, ms.R.gripFromBarEnd), ms.P, ms.bodies[ms.R.body].scale, ms.R, ms.ride)
			if not pose.errors.is_empty():
				_fail("%s: rider %s" % [entry.id, pose.errors])
				return
			ms.vehicle.set_motion(ms.ride.wheelAngle, ms.ride.crankPhase)
			ms.fig.draw(pose.segments, pose.discs, [])
			ms.focus = ms.vehicle.position + Vector3.UP * 0.9

## One line for the UI: what the mover is doing.
func mover_state() -> String:
	if ms.is_empty():
		return ""
	match ms.get("d", {}).get("kind", ""):
		"dog":
			return "%s  %.2f m/s" % [ms.dog.gait, ms.dog.actualSpeed]
		"pigeon":
			return "%s  %.2f m/s" % [ms.pig.mode, ms.pig.speed]
		"leash":
			return "walker %.2f m/s   dog %s   rope %.2f / %.2f m" % [ms.dw.walker.speed, ms.dw.dog.gait, ms.dw.separation, ms.dw.leash_p.ropeLength]
		"rider":
			return "roll %.0f°" % rad_to_deg(ms.ride.roll)
	if ms.has("animal"):
		return "%s  %s  %.2f m/s" % [ms.m.breed, Animal.doing(ms.animal), ms.animal.actualSpeed] + (" / " + ms.brain.mode if entry.action == "behaviour" else "")
	return ""

# ------------------------------------------------------------------ animals (animal-behaviour.json review block)

func _start_animal() -> void:
	var c: Dictionary = _read(BEHAVIOUR)
	ms = {"c": c, "sim": INF, "focus": Vector3.ZERO}
	ms.m = AnimalModel.info(_breed(entry.species))
	ms.dog_m = AnimalModel.info(AnimalModel.breeds("dog")[0])
	for info in [ms.m, ms.dog_m]:
		if info.error != "":
			_fail(info.error)
			return
	ms.body = _animal_body(ms.m.breed)
	ms.humans = []
	if entry.action == "behaviour":
		if entry.species == "cat":
			ms.other_body = _animal_body(ms.dog_m.breed)
		for i in c.review.people.size():
			ms.humans.append(_extra_figure())
	cycle = c.review.behaviour_duration if entry.action == "behaviour" else c.review.cycle

func _animal_reset() -> void:
	ms.sim = 0.0
	ms.animal = Animal.create(Vector3.ZERO, 0, ms.m)
	ms.brain = {"mode": ""}
	ms.behaviour = Preview.create(ms.m, ms.dog_m, ms.c)

func _animal_to(time: float) -> void:
	var dt: float = ms.c.review.dt
	if time < ms.sim - 1e-6 or ms.sim == INF:
		_animal_reset()
	while ms.sim + dt <= time + 1e-6:
		ms.sim += dt
		_animal_step(ms.sim)
	_animal_draw()

## The animal review scenario: walk, do the action between walk_until and hold_until, walk on; walk / trot
## wander; behaviour lets the controller react to scripted passers-by (and, for the cat, an
## approaching dog).
func _animal_step(time: float) -> void:
	var q: Dictionary = ms.c.review
	var action: String = entry.action
	if action == "behaviour":
		ms.behaviour = Preview.step(ms.behaviour, ms.m, ms.dog_m, ms.c, q.dt)
		ms.animal = ms.behaviour.animal
		ms.brain = ms.behaviour.brain
		return
	var active: bool = time >= q.walk_until and time < q.hold_until
	var command := {"speed": q.speed, "yaw": 0.0, "action": action if active else "", "ground": func(_q: Vector3) -> float: return FLAT}
	if action in ["walk", "trot"]:
		command.speed = q.speed if action == "walk" else ms.m.p.motion.maxSpeed * q.trot_speed_fraction
		command.yaw = sin(time * q.turn_frequency) * q.turn_amplitude
		command.action = ""
	ms.animal = Animal.step(ms.animal, command, q.dt, ms.m)

func _animal_draw() -> void:
	var q: Dictionary = ms.c.review
	ms.body.show_pose(AnimalModel.pose(ms.m, ms.animal))
	ms.focus = ms.animal.position
	if entry.action != "behaviour":
		return
	var people_now := Preview.people_at(ms.sim, ms.c)
	for i in people_now.size():
		var pos: Vector3 = people_now[i].position
		var phase: float = sin(ms.sim * q.person_step_frequency + i)
		var hip: Vector3 = pos + Vector3.UP * q.person_hip
		var segments: Array = [[hip, pos + Vector3.UP * q.person_neck, q.person_width]]
		for sign in [-1, 1]:
			segments.append([hip, pos + Vector3(sign * q.person_stride * phase, 0, sign * q.person_arm_side / 2), q.person_width])
			var shoulder: Vector3 = pos + Vector3(0, q.person_shoulder, sign * q.person_arm_side)
			segments.append([shoulder, shoulder + Vector3(-sign * q.person_stride * phase, -q.person_arm, 0), q.person_width])
		ms.humans[i].draw(segments, [[pos + Vector3.UP * q.person_head, q.person_head_radius]], [])
	if entry.species == "cat":
		ms.other_body.show_pose(AnimalModel.pose(ms.dog_m, ms.behaviour.other))
