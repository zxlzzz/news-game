## A real animal model (npc/animal-models.json): what is read from its skeleton and clips, and the pose
## of every bone for an animal state (npc/animal.gd). Pure functions over plain data; the node that
## shows it is npc/animal_body.gd.
##
##   var m := AnimalModel.info("husky")     # cached per breed; m.error is "" or why it cannot be used
##   m.p                                     # gait parameters for npc/procedural_dog.gd, legs from the skeleton
##   var pose := AnimalModel.pose(m, s)      # s: npc/animal.gd state
##   pose.root (world transform of the model), pose.locals (bone pose per bone), pose.globals (model
##   space), pose.collar (world)
##
## Walking: the model stands where the gait puts the front girdle (the model origin is on the ground
## under the front shoulder joints), turned to the gait's yaw; the hips and what hangs on them turn to
## the gait's hip yaw about that point. Each leg reaches the gait's paw with two-bone IK (upper and
## lower bone, bending the way the rest pose bends); the bones below keep their rest angle, so the
## sole sits on the paw point. The layered bones (neck, tail) play the walk clip by gait phase, mixed
## toward the stand clip as the animal stops. An action (in / hold / out clips) is faded over all this.
extends RefCounted

const Dog := preload("res://npc/procedural_dog.gd")
const PATH := "res://npc/animal-models.json"
const LEGS := ["LF", "RF", "LH", "RH"]

static var _cache := {}
static var _config := {}

static func config() -> Dictionary:
	if _config.is_empty():
		var v = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		assert(v is Dictionary, PATH + ": not a JSON object")
		_config = v
	return _config

## Breeds of a species ("dog" | "cat"), in file order.
static func breeds(species: String) -> Array:
	var c := config()
	return c.breeds.keys().filter(func(b): return c.breeds[b].species == species)

static func info(breed: String) -> Dictionary:
	if not _cache.has(breed):
		_cache[breed] = _load(breed)
	return _cache[breed]

static func _load(breed: String) -> Dictionary:
	var c := config()
	var m := {"breed": breed, "error": ""}
	if not c.breeds.has(breed):
		m.error = "%s: no breed %s" % [PATH, breed]
		return m
	var b: Dictionary = c.breeds[breed]
	m.species = b.species
	var packed = load(b.glb)
	if not packed is PackedScene:
		m.error = "%s: cannot load %s" % [breed, b.glb]
		return m
	var root: Node = packed.instantiate()
	var skeletons := root.find_children("*", "Skeleton3D", true, false)
	var players := root.find_children("*", "AnimationPlayer", true, false)
	var meshes := root.find_children("*", "MeshInstance3D", true, false)
	if skeletons.size() != 1 or players.size() != 1 or meshes.size() != 1:
		root.free()
		m.error = "%s: needs one skeleton, one animation player and one mesh" % b.glb
		return m
	var sk: Skeleton3D = skeletons[0]
	var n := sk.get_bone_count()
	m.names = []
	m.parent = []
	m.rest = []
	m.index = {}
	for i in n:
		m.names.append(sk.get_bone_name(i))
		m.parent.append(sk.get_bone_parent(i))
		m.rest.append(sk.get_bone_rest(i))
		m.index[sk.get_bone_name(i)] = i
	m.rest_global = _fk(m.parent, m.rest)
	m.aabb = meshes[0].get_aabb()
	var player: AnimationPlayer = players[0]
	m.clips = {}
	for name in player.get_animation_list():
		m.clips[name] = _clip(player.get_animation(name), m.index)
	root.free()
	for key in ["front", "look", "collar"]:
		if not m.index.has(b[key]):
			m.error = "%s: %s bone %s not in the skeleton" % [breed, key, b[key]]
			return m
		m[key] = m.index[b[key]]
	for clip in [b.walkClip, b.standClip]:
		if not m.clips.has(clip):
			m.error = "%s: no clip %s" % [breed, clip]
			return m
	m.walk_clip = b.walkClip
	m.stand_clip = b.standClip
	m.layered = []
	m.layered.resize(n)
	m.layered.fill(false)
	for name in b.layered:
		if not m.index.has(name):
			m.error = "%s: layered bone %s not in the skeleton" % [breed, name]
			return m
		for i in _subtree(m.parent, m.index[name]):
			m.layered[i] = true
	# Bones that turn with the hips: all but the front subtree.
	m.hind = []
	m.hind.resize(n)
	m.hind.fill(true)
	for i in _subtree(m.parent, m.front):
		m.hind[i] = false
	m.legs = {}
	var base: Dictionary = Dog.load_params(c.gait.from)
	for key in LEGS:
		var chain: Array = b.legs.get(key, [])
		if chain.size() < 3:
			m.error = "%s: leg %s needs upper, lower and paw bones" % [breed, key]
			return m
		var ids := []
		for name in chain:
			if not m.index.has(name):
				m.error = "%s: leg %s bone %s not in the skeleton" % [breed, key, name]
				return m
			ids.append(m.index[name])
		for k in range(1, ids.size()):
			if m.parent[ids[k]] != ids[k - 1]:
				m.error = "%s: leg %s: %s is not the child of %s" % [breed, key, chain[k], chain[k - 1]]
				return m
		if m.hind[ids[0]] != (key[1] == "H"):
			m.error = "%s: leg %s turns with the %s" % [breed, key, "hips" if m.hind[ids[0]] else "shoulders"]
			return m
		m.legs[key] = _leg(m.rest_global, ids, base.legs["hind" if key[1] == "H" else "front"].bend)
	for name in c.species[m.species]:
		for clip in _clips_of(c.actions[name]):
			if not m.clips.has(clip):
				m.error = "%s: action %s needs clip %s" % [breed, name, clip]
				return m
	m.p = _gait(m, c)
	return m

static func _clips_of(action: Dictionary) -> Array:
	var out: Array = action.get("in", []).duplicate()
	if action.has("hold"):
		out.append(action.hold)
	out.append_array(action.get("out", []))
	return out

## One clip: per track the bone and whether it moves or turns it.
static func _clip(a: Animation, index: Dictionary) -> Dictionary:
	var tracks := []
	for t in a.get_track_count():
		var type := a.track_get_type(t)
		if type != Animation.TYPE_POSITION_3D and type != Animation.TYPE_ROTATION_3D:
			continue
		var bone := String(a.track_get_path(t).get_concatenated_subnames())
		if index.has(bone):
			tracks.append([index[bone], type, t])
	return {"animation": a, "length": a.length, "tracks": tracks}

## Leg geometry at rest (model space). ids: upper, lower, then down to the paw.
static func _leg(g: Array, ids: Array, bend: float) -> Dictionary:
	var root: Vector3 = g[ids[0]].origin
	var knee: Vector3 = g[ids[1]].origin
	var wrist: Vector3 = g[ids[2]].origin
	var paw: Vector3 = g[ids[-1]].origin
	var sole := Vector3(paw.x, 0, paw.z)
	return {"ids": ids, "a": root.distance_to(knee), "b": knee.distance_to(wrist),
		"root": root, "wrist": wrist, "sole": sole, "bend": bend}

## The gait parameters: gait.from, lengths and speeds scaled to this model, the body from its skeleton.
static func _gait(m: Dictionary, c: Dictionary) -> Dictionary:
	var p: Dictionary = Dog.load_params(c.gait.from)
	var room_from := _room(p)
	var legs: Dictionary = m.legs
	var front_y: float = (legs.LF.root.y + legs.RF.root.y) / 2
	_scale(p, c.gait.scaled, front_y / (p.body.shoulderY - p.legs.front.drop))
	var hind_y: float = (legs.LH.root.y + legs.RH.root.y) / 2
	var hind_z: float = (legs.LH.root.z + legs.RH.root.z) / 2
	var front_z: float = (legs.LF.root.z + legs.RF.root.z) / 2
	# Lower the body until every leg at rest is bent to at most walkExtension of its length.
	var drop := 0.0
	for key in LEGS:
		var l: Dictionary = legs[key]
		var h := Vector2(l.root.x - l.wrist.x, l.root.z - l.wrist.z).length()
		var most: float = c.breeds[m.breed].get("walkExtension", c.gait.walkExtension) * (l.a + l.b)
		drop = maxf(drop, (l.root.y - l.wrist.y) - sqrt(maxf(0, most * most - h * h)))
	m.drop = drop
	p.body.shoulderY = front_y
	p.body.hipY = hind_y
	p.body.length = front_z - hind_z
	for pair in [["front", "LF", "RF", front_z], ["hind", "LH", "RH", hind_z]]:
		var l: Dictionary = legs[pair[1]]
		var r: Dictionary = legs[pair[2]]
		var limb: Dictionary = p.legs[pair[0]]
		var up: Vector3 = ((l.wrist - l.sole) + (r.wrist - r.sole)) / 2
		limb.a = (l.a + r.a) / 2
		limb.b = (l.b + r.b) / 2
		limb.c = Vector2(up.z, up.y).length()
		limb.dir = [up.z / limb.c, up.y / limb.c] if limb.c > 1e-6 else [0.0, 1.0]
		limb.drop = drop
		limb.halfWidth = (l.root.x - r.root.x) / 2
		limb.footWidth = (l.sole.x - r.sole.x) / 2
		limb.neutral = (l.sole.z + r.sole.z) / 2 - pair[3]
		limb.bend = l.bend
	_scale(p, c.gait.scaledByRoom, _room(p) / room_from)
	var collar: Vector3 = m.rest_global[m.collar].origin
	var head: Vector3 = m.rest_global[m.look].origin
	p.head.neckBase = [collar.z - front_z, collar.y - front_y]
	p.head.head = [maxf(collar.z - head.z, 0.01), 0.0]
	p.head.collarAt = 0.0
	# Horizontal reach of the body from the model origin, for keeping animals apart.
	var box: AABB = m.aabb
	var reach := 0.0
	for x in [box.position.x, box.end.x]:
		for z in [box.position.z, box.end.z]:
			reach = maxf(reach, Vector2(x, z).length())
	p.body.radius = reach
	return p

static func _scale(p: Dictionary, paths: Array, k: float) -> void:
	for path in paths:
		var keys: PackedStringArray = path.split(".")
		var d: Dictionary = p
		for i in keys.size() - 1:
			d = d[keys[i]]
		var v = d[keys[-1]]
		d[keys[-1]] = v.map(func(x): return x * k) if v is Array else v * k

## How far a paw can travel forward or back from its rest spot while walking (the least over the
## legs): what bounds the step length.
static func _room(p: Dictionary) -> float:
	var s := {"position": Vector3.ZERO, "yaw": 0.0, "hipYaw": 0.0, "pitch": 0.0}
	var room := INF
	for key in LEGS:
		var g: Dictionary = Dog._girdle(s, key, p)
		var d: Vector3 = Dog._wrist(s, key, p, g.neutral) - g.root
		var reach: float = Dog._reach(key, p)
		room = minf(room, sqrt(maxf(0, reach * reach - d.y * d.y - d.x * d.x)) - absf(d.z))
	return room

static func _subtree(parent: Array, top: int) -> Array:
	var out := [top]
	for i in parent.size():
		var q: int = parent[i]
		while q != -1 and q != top:
			q = parent[q]
		if q == top and i != top:
			out.append(i)
	return out

static func _fk(parent: Array, locals: Array) -> Array:
	var g := []
	g.resize(locals.size())
	for i in locals.size():  # glTF lists parents before children
		g[i] = locals[i] if parent[i] == -1 else g[parent[i]] * locals[i]
	return g

## Local bone poses of a clip at time t (clamped; loop: wrapped). Bones without a track rest.
static func sample(m: Dictionary, clip: String, t: float, loop: bool) -> Array:
	var c: Dictionary = m.clips[clip]
	var a: Animation = c.animation
	var time: float = fposmod(t, c.length) if loop else clampf(t, 0, c.length)
	var out: Array = m.rest.duplicate()
	for tr in c.tracks:
		var x: Transform3D = out[tr[0]]
		if tr[1] == Animation.TYPE_POSITION_3D:
			x.origin = a.position_track_interpolate(tr[2], time)
		else:
			x.basis = Basis(a.rotation_track_interpolate(tr[2], time))
		out[tr[0]] = x
	return out

static func blend(a: Array, b: Array, w: float) -> Array:
	if w <= 0:
		return a
	if w >= 1:
		return b
	var out := []
	out.resize(a.size())
	for i in a.size():
		var x: Transform3D = a[i]
		var y: Transform3D = b[i]
		out[i] = Transform3D(Basis(x.basis.get_rotation_quaternion().slerp(y.basis.get_rotation_quaternion(), w)), x.origin.lerp(y.origin, w))
	return out

## The pose of every bone for animal state s (npc/animal.gd).
static func pose(m: Dictionary, s: Dictionary) -> Dictionary:
	var root := Transform3D(Basis(Vector3.UP, s.yaw), s.position)
	var locals: Array = _walking(m, s)
	if s.weight > 0:
		var clip: Array = sample(m, s.clip, s.clip_time, s.clip_loop)
		if s.fade < 1:
			clip = blend(sample(m, s.from_clip, s.from_time, s.from_loop), clip, s.fade)
		locals = blend(locals, clip, smoothstep(0, 1, s.weight))
	var g := _fk(m.parent, locals)
	return {"root": root, "locals": locals, "globals": g, "collar": root * (g[m.collar].origin as Vector3)}

## The gait pose: layered clips on the neck and tail, hips turned, legs reaching the paws.
static func _walking(m: Dictionary, s: Dictionary) -> Array:
	var walk: Array = sample(m, m.walk_clip, s.phase * m.clips[m.walk_clip].length, true)
	var stand: Array = sample(m, m.stand_clip, s.time, true)
	var layer: Array = blend(walk, stand, s.still)
	var locals: Array = m.rest.duplicate()
	for i in locals.size():
		if m.layered[i]:
			locals[i] = layer[i]
	var g := _fk(m.parent, locals)
	var low := Transform3D(Basis.IDENTITY, Vector3.DOWN * m.drop)
	for i in g.size():
		g[i] = low * g[i]
	var twist := Transform3D(Basis(Vector3.UP, angle_difference(s.yaw, s.hipYaw)), Vector3.ZERO)
	# The hips swing up or down about the shoulder joints (the gait's pitch).
	var pivot: Vector3 = Vector3.UP * (m.p.body.shoulderY - m.drop)
	var pitch: Transform3D = twist * Transform3D(Basis.IDENTITY, pivot) * Transform3D(Basis(Vector3.RIGHT, s.pitch), Vector3.ZERO) * Transform3D(Basis.IDENTITY, -pivot)
	# Turning its head into the turn while walking, looking about while standing.
	var look_yaw: float = lerpf(s.look, m.p.head.look.idleAmplitude * sin(s.time * m.p.head.look.idleFrequency), s.still)
	var head: Vector3 = g[m.look].origin
	var look := Transform3D(Basis.IDENTITY, head) * Transform3D(Basis(Vector3.UP, look_yaw), Vector3.ZERO) * Transform3D(Basis.IDENTITY, -head)
	var turns_head := _subtree(m.parent, m.look)
	for i in turns_head:
		g[i] = look * g[i]
	var flat := g.duplicate()  # hind bones turned but not pitched: the paws stay level
	for i in g.size():
		if m.hind[i]:
			flat[i] = twist * g[i]
			g[i] = pitch * g[i]
	var to_model := Transform3D(Basis(Vector3.UP, s.yaw), s.position).affine_inverse()
	for key in LEGS:
		var leg: Dictionary = m.legs[key]
		var ids: Array = leg.ids
		var turn: Basis = twist.basis if key[1] == "H" else Basis.IDENTITY
		var k0: Vector3 = g[ids[1]].origin
		var r: Vector3 = g[ids[0]].origin
		var n0: Vector3 = (g[ids[2]].origin - r).cross(turn * Vector3(0, 0, leg.bend)).normalized()
		var k0_from: Vector3 = k0 - r
		r += Vector3.UP * (s.feet[key].slide as float)  # the top of the leg slid (procedural_dog.gd)
		var w0: Vector3 = g[ids[2]].origin
		var w: Vector3 = to_model * (s.feet[key].point as Vector3) + turn * (leg.wrist - leg.sole)
		var pole: Vector3 = turn * Vector3(0, 0, leg.bend)
		var k := _knee(r, w, leg.a, leg.b, pole)
		var n1 := (w - r).cross(pole).normalized()
		var upper := _frame(k - r, n1) * _frame(k0_from, n0).inverse()
		var lower := _frame(w - k, n1) * _frame(w0 - k0, n0).inverse()
		g[ids[0]] = Transform3D(upper * g[ids[0]].basis, r)
		g[ids[1]] = Transform3D(lower * g[ids[1]].basis, k)
		var shift: Vector3 = w - flat[ids[2]].origin
		for j in range(2, ids.size()):
			g[ids[j]] = Transform3D(flat[ids[j]].basis, flat[ids[j]].origin + shift)
	var out := []
	out.resize(g.size())
	for i in g.size():
		var q: int = m.parent[i]
		out[i] = g[i] if q == -1 else (g[q] as Transform3D).affine_inverse() * g[i]
	return out

## Knee of a two-bone leg from root r to wrist w (lengths a, b), bending toward pole. Out of reach, the
## leg straightens toward w.
static func _knee(r: Vector3, w: Vector3, a: float, b: float, pole: Vector3) -> Vector3:
	var d := w - r
	var dist := clampf(d.length(), absf(a - b) + 1e-5, a + b - 1e-5)
	var u := d.normalized()
	var h := (a * a + dist * dist - b * b) / (2 * dist)
	var v := pole - u * pole.dot(u)
	return r + u * h + v.normalized() * sqrt(maxf(0, a * a - h * h))

static func _frame(u: Vector3, n: Vector3) -> Basis:
	var x := u.normalized()
	var y := (n - x * n.dot(x)).normalized()
	return Basis(x, y, x.cross(y))
