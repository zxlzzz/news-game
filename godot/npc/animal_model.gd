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
## lower bone, retaining the source leg's bending plane); the bones below keep level sole orientation.
## The whole source walk plays by gait phase, mixed toward standing as the animal stops. The actual
## skinned sole supplies contact, and the complete final skin supplies ground penetration checks.
## In-place clips and interruptible recovery are mixed before that final ground projection.
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
		assert(v.has("playbackSpeed") and (v.playbackSpeed is float or v.playbackSpeed is int) and v.playbackSpeed > 0, PATH + ": invalid playbackSpeed")
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
	m.skin_all = _skin_points(meshes[0], m.index)
	m.skin_points = m.skin_all
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
	_sole_points(m, c.grounding)
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
		"root": root, "wrist": wrist, "sole": sole, "sole_local": (g[ids[-1]] as Transform3D).affine_inverse() * sole, "bend": bend}

## Rest-space skin influences, kept once per model. Final contact uses the actual mesh,
## including the authorised wider paws, rather than a bone head standing in for its sole.
static func _skin_points(mesh: MeshInstance3D, index: Dictionary) -> Array:
	var skin: Skin = mesh.skin
	assert(skin != null, "animal mesh needs a skin")
	var bones := []
	for i in skin.get_bind_count():
		var name := String(skin.get_bind_name(i))
		assert(index.has(name), "animal skin bone %s is not mapped" % name)
		bones.append(index[name])
	var out := []
	var unique := {}
	for surface in mesh.mesh.get_surface_count():
		var arrays: Array = mesh.mesh.surface_get_arrays(surface)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var ids: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
		var count: int = ids.size() / vertices.size()
		for v in vertices.size():
			var influences := []
			var signature := PackedFloat32Array()
			for j in count:
				var w: float = weights[v * count + j]
				if w > 0:
					var bind: int = ids[v * count + j]
					var point: Vector3 = skin.get_bind_pose(bind) * vertices[v]
					influences.append([bones[bind], point, w])
					signature.append_array(PackedFloat32Array([bones[bind], point.x, point.y, point.z, w]))
			if not unique.has(signature):
				unique[signature] = true
				out.append(influences)
	return out

static func sole(m: Dictionary, g: Array, key: String) -> Vector3:
	var centre := Vector3.ZERO
	var bottom := INF
	for influences in m.skin_feet[key]:
		var point := Vector3.ZERO
		for item in influences:
			point += (g[item[0]] * item[1]) * item[2]
		centre += point
		bottom = minf(bottom, point.y)
	centre /= m.skin_feet[key].size()
	centre.y = bottom
	return centre

static func bend_plane(m: Dictionary, g: Array, key: String) -> Vector3:
	var leg: Dictionary = m.legs[key]
	var ids: Array = leg.ids
	var root: Vector3 = g[ids[0]].origin
	var normal: Vector3 = (g[ids[2]].origin - root).cross((g[ids[1]].origin as Vector3) - root)
	if normal.length_squared() < 1e-10:
		var rest_normal: Vector3 = (leg.wrist - leg.root).cross(Vector3(0, 0, leg.bend)).normalized()
		normal = g[ids[0]].basis * (m.rest_global[ids[0]].basis as Basis).inverse() * rest_normal
	return normal.normalized()

static func leg_axis(m: Dictionary, g: Array, key: String) -> Vector3:
	var ids: Array = m.legs[key].ids
	return ((g[ids[2]].origin as Vector3) - (g[ids[0]].origin as Vector3)).normalized()

static func leg_frames(m: Dictionary, g: Array, key: String) -> Array:
	var ids: Array = m.legs[key].ids
	var normal := bend_plane(m, g, key)
	var upper: Basis = _frame((g[ids[1]].origin as Vector3) - (g[ids[0]].origin as Vector3), normal)
	var lower: Basis = _frame((g[ids[2]].origin as Vector3) - (g[ids[1]].origin as Vector3), normal)
	return [(upper.inverse() * (g[ids[0]].basis as Basis)).get_rotation_quaternion(),
		(lower.inverse() * (g[ids[1]].basis as Basis)).get_rotation_quaternion()]

static func _sole_points(m: Dictionary, p: Dictionary) -> void:
	m.skin_feet = {"LF": [], "RF": [], "LH": [], "RH": []}
	for influences in m.skin_all:
		var point := Vector3.ZERO
		for item in influences:
			point += (m.rest_global[item[0]] * item[1]) * item[2]
		var key := ""
		var nearest := INF
		for leg in LEGS:
			var at: Vector3 = m.legs[leg].sole
			var distance := Vector2(point.x - at.x, point.z - at.z).length_squared()
			if distance < nearest:
				nearest = distance
				key = leg
		var last: int = m.legs[key].ids[-1]
		var height: float = m.rest_global[last].origin.y + m.rest_global[m.legs.LF.ids[0]].origin.y * p.soleRegionHeight
		if point.y <= height:
			m.skin_feet[key].append(influences)
	for key in LEGS:
		assert(not m.skin_feet[key].is_empty(), "%s has no sole vertices for %s" % [m.breed, key])
		var at := sole(m, m.rest_global, key)
		at.y = 0
		m.legs[key].sole = at
		m.legs[key].sole_local = (m.rest_global[m.legs[key].ids[-1]] as Transform3D).affine_inverse() * at

## The gait parameters: gait.from, lengths and speeds scaled to this model, the body from its skeleton.
static func _gait(m: Dictionary, c: Dictionary) -> Dictionary:
	var p: Dictionary = Dog.load_params(c.gait.from)
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
	_native_gait(m, p, c.gait.native)
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

## The source cycle supplies cadence, footfall phases, lift and torso movement. The standing
## skeleton's paw offset is not a stride budget: in the cat it leaves the hind wrist behind
## the hip and consumes almost all backward reach. Centre a moving wrist in its reach sphere;
## stopping restores the original standing paw positions one foot at a time.
static func _native_gait(m: Dictionary, p: Dictionary, tuning: Dictionary) -> void:
	var count: int = tuning.samples
	var length: float = m.clips[m.walk_clip].length
	var values := {}
	var front_mean := Vector3.ZERO
	for key in LEGS:
		values[key] = {"heights": [], "low": INF, "high": -INF}
	for frame_index in count:
		var at: float = float(frame_index) / (count - 1)
		var g := _fk(m.parent, sample(m, m.walk_clip, at * length, false))
		front_mean += ((g[m.legs.LF.ids[0]].origin as Vector3) + (g[m.legs.RF.ids[0]].origin as Vector3)) / (2 * count)
		for key in LEGS:
			var leg: Dictionary = m.legs[key]
			var paw: Vector3 = g[leg.ids[-1]].origin
			var relative: Vector3 = paw - (g[leg.ids[0]].origin as Vector3)
			values[key].heights.append(paw.y)
			values[key].low = minf(values[key].low, relative.z)
			values[key].high = maxf(values[key].high, relative.z)
	var rest_front: Vector3 = (m.legs.LF.root + m.legs.RF.root) / 2
	m.walk_offset = rest_front - front_mean
	var fore_sweep := 0.0
	var swing_fraction := 0.0
	for key in LEGS:
		var v: Dictionary = values[key]
		var low: float = v.heights.min()
		var high: float = v.heights.max()
		var threshold: float = lerpf(low, high, tuning.contactHeightFraction)
		var airborne := 0
		var lift_index := -1
		for i in count - 1:
			if v.heights[i] >= threshold:
				airborne += 1
			if v.heights[i] < threshold and v.heights[i + 1] >= threshold:
				lift_index = i
		assert(lift_index >= 0, "%s %s source walk has no lift" % [m.breed, key])
		p.gaits.walk.liftAt[key] = float(lift_index) / (count - 1)
		if key[1] == "F":
			fore_sweep += (v.high - v.low) / 2
			swing_fraction += float(airborne) / (count - 1) / 2
	for pair in [["front", "LF", "RF"], ["hind", "LH", "RH"]]:
		var limb: Dictionary = p.legs[pair[0]]
		limb.walkNeutral = -limb.dir[0] * limb.c
		limb.lift = ((values[pair[1]].heights.max() - values[pair[1]].heights.min()) +
			(values[pair[2]].heights.max() - values[pair[2]].heights.min())) / 2
	var native_stride: float = fore_sweep / (1 - swing_fraction)
	p.gaitReferenceSpeed = native_stride / length
	var room: float = _room(p) * tuning.reachFraction
	for kind in ["walk", "trot"]:
		var gait: Dictionary = p.gaits[kind]
		var fraction: float = swing_fraction if kind == "walk" else tuning.trot[m.species].swing
		var stride: float = native_stride if kind == "walk" else native_stride * tuning.trot[m.species].stride
		gait.stride.base = stride * (1 - tuning.strideGrowth)
		gait.stride.perSpeed = stride * tuning.strideGrowth / p.gaitReferenceSpeed
		gait.stride.maximum = 2 * room / (1 - fraction)
		gait.stride.maximumStance = 2 * room
		gait.swing.k = fraction
		gait.swing.minFrequency = 1 / length
		gait.swing.max = length * fraction

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
	var s := {"position": Vector3.ZERO, "yaw": 0.0, "hipYaw": 0.0, "pitch": 0.0, "speed": p.gaitReferenceSpeed}
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

## The unprojected recovery body is shared by the foot planner and rendered IK.
## Its standing endpoint follows the current breathing / look phase.
static func recovery_pose(m: Dictionary, s: Dictionary) -> Dictionary:
	var u: float = s.return_time / s.return_duration
	var destination: Array = s.return_target
	var recovery_normals: Dictionary = s.return_normals
	if s.return_out.is_empty():
		# Standing keeps breathing and looking while recovery runs. A snapshot
		# of the old idle phase would jump to the new phase on the final frame.
		var target_state: Dictionary = s.duplicate(true)
		target_state.phase_ = "walk"
		target_state.weight = 0.0
		for key in LEGS:
			target_state.feet[key].point = s.return_feet[key].to
			target_state.feet[key].swing = false
			target_state.feet[key].slide = 0.0
		var target: Dictionary = pose(m, target_state)
		destination = target.locals.duplicate()
		for i in destination.size():
			if m.parent[i] == -1:
				destination[i].origin += target.root.origin - s.position
		recovery_normals = {}
		for key in LEGS:
			var start_normal: Vector3 = s.return_normals[key][0]
			var frames: Array = leg_frames(m, target.globals, key)
			recovery_normals[key] = [start_normal, s.return_normals[key][1],
				bend_plane(m, target.globals, key), leg_axis(m, target.globals, key),
				s.return_normals[key][4], s.return_normals[key][5], frames[0], frames[1]]
	var locals: Array = blend(s.return_pose, destination, smoothstep(0, 1, u))
	var inertial: float = s.return_time * exp(-s.return_time / config().recovery.inertiaTime) * (1 - u) * (1 - u) * s.return_inertia
	for i in locals.size():
		var x: Transform3D = locals[i]
		var spin: Vector3 = s.return_spin[i]
		if spin.length_squared() > 1e-10:
			x.basis = x.basis * Basis(spin.normalized(), spin.length() * inertial)
		x.origin += (s.return_linear[i] as Vector3) * inertial
		locals[i] = x
	_normalize_leg_offsets(m, locals)
	var globals := _fk(m.parent, locals)
	var destination_globals := _fk(m.parent, destination)
	var captured_globals := _fk(m.parent, s.return_pose)
	for key in s.return_air:
		# A raised paw must orient for support on its own landing schedule.
		# The trunk can recover more slowly: retaining its rotation clock would
		# put the wrist below ground even with the drawn sole exactly planted.
		var f: Dictionary = s.return_feet[key]
		var progress: float = smoothstep(0, 1, clampf((u-f.delay)/(f.end-f.delay),0,1))
		var ids: Array = m.legs[key].ids
		var wrist: Vector3 = globals[ids[2]].origin
		var orientation: Basis = Basis((captured_globals[ids[2]].basis as Basis).get_rotation_quaternion().slerp((destination_globals[ids[2]].basis as Basis).get_rotation_quaternion(),progress))
		globals[ids[2]]=Transform3D(orientation,wrist)
		# The paw may have its own authored rotation relative to the wrist. Keep
		# that captured articulation at the start and land the entire distal chain;
		# replacing it with rest offsets would snap a scratching paw on cancellation.
		for j in range(3,ids.size()):
			var id: int = ids[j]
			var from: Transform3D = s.return_pose[id]
			var to: Transform3D = destination[id]
			var basis := Basis(from.basis.get_rotation_quaternion().slerp(to.basis.get_rotation_quaternion(),progress))
			var offset: Vector3 = from.origin.lerp(to.origin,progress).normalized()*(m.rest[id].origin as Vector3).length()
			globals[id]=(globals[m.parent[id]] as Transform3D)*Transform3D(basis,offset)
	locals=_locals(m,globals)
	return {"time": s.time, "locals": locals, "globals": globals, "normals": recovery_normals}

static func _normalize_leg_offsets(m: Dictionary, locals: Array) -> void:
	# A pose blend must use anatomical child offsets before both the planner and
	# IK read it. Restoring a shortened distal offset only after IK moves the skin
	# sole away from the contact that was just solved.
	for key in LEGS:
		var ids: Array = m.legs[key].ids
		for i in range(1, ids.size()):
			var x: Transform3D = locals[ids[i]]
			x.origin = x.origin.normalized() * (m.rest[ids[i]].origin as Vector3).length()
			locals[ids[i]] = x

## The pose of every bone for animal state s (npc/animal.gd).
static func pose(m: Dictionary, s: Dictionary) -> Dictionary:
	var root := Transform3D(Basis(Vector3.UP, s.yaw), s.position)
	var locals: Array = _walking(m, s) if s.phase_ != "return" else []
	var recovery_normals := {}
	if s.phase_ == "return":
		var recovered: Dictionary = s.return_plan if not s.return_plan.is_empty() and s.return_plan.time == s.time else recovery_pose(m, s)
		locals = recovered.locals.duplicate()
		recovery_normals = recovered.normals
		var returned: Array = recovered.globals.duplicate()
		returned = _plant(m, s, returned, returned.duplicate(), s.return_contacts, recovery_normals)
		locals = _locals(m, returned)
	elif s.weight > 0:
		var clip: Array = sample(m, s.clip, s.clip_time, s.clip_loop)
		if s.fade < 1:
			clip = blend(sample(m, s.from_clip, s.from_time, s.from_loop), clip, s.fade)
		locals = blend(locals, clip, smoothstep(0, 1, s.weight))
	# TRS interpolation between two fixed-length joint-offset vectors can shorten
	# their length even though both endpoints are anatomical.
	_normalize_leg_offsets(m, locals)
	var g := _fk(m.parent, locals)
	# Clip/IK mixing is not closed under contact: project the final skinned result.
	# Moving/recovering paws retain their planned contacts while the torso is raised.
	var ground_passes: int = config().grounding.recoveryGroundPasses if s.phase_ == "return" else config().grounding.passes
	for pass_index in ground_passes:
		var depth := penetration(m, g, root, s.ground)
		if depth <= config().grounding.tolerance:
			break
		var raised := g.duplicate()
		for i in raised.size():
			raised[i] = Transform3D(raised[i].basis, raised[i].origin + Vector3.UP * depth)
		if s.weight == 0 or s.phase_ == "return":
			g = _plant(m, s, raised, raised.duplicate(), s.return_contacts if s.phase_ == "return" else LEGS, recovery_normals)
		else:
			g = raised
		locals = _locals(m, g)
	var residual := penetration(m, g, root, s.ground)
	if residual > config().grounding.tolerance:
		root.origin.y += residual
	return {"root": root, "locals": locals, "globals": g, "collar": root * (g[m.collar].origin as Vector3)}

static func penetration(m: Dictionary, g: Array, root: Transform3D, ground, full: bool = false) -> float:
	var depth := 0.0
	for influences in m.skin_all if full else m.skin_points:
		var point := Vector3.ZERO
		for item in influences:
			point += (g[item[0]] * item[1]) * item[2]
		var world: Vector3 = root * point
		var floor_y: float = ground.call(Vector3(world.x, root.origin.y, world.z)) if ground is Callable else root.origin.y
		depth = maxf(depth, floor_y - world.y)
	return depth

static func _locals(m: Dictionary, g: Array) -> Array:
	var out := []
	out.resize(g.size())
	for i in g.size():
		var q: int = m.parent[i]
		out[i] = g[i] if q == -1 else (g[q] as Transform3D).affine_inverse() * g[i]
	return out

## Keep the source walk's whole torso, shoulder and hip reaction, while contact IK supplies
## navigation-aware feet. Distal segments remain level during stance rather than rolling a
## rest-space sole through the floor with an independently timed source paw.
static func _walking(m: Dictionary, s: Dictionary) -> Array:
	var walk: Array = sample(m, m.walk_clip, s.phase * m.clips[m.walk_clip].length, true)
	var stand: Array = sample(m, m.stand_clip, s.time, true)
	var layer: Array = blend(walk, stand, s.still)
	var locals: Array = layer
	var g := _fk(m.parent, locals)
	var low := Transform3D(Basis.IDENTITY, m.walk_offset * (1 - s.still) - Vector3.UP * m.drop)
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
	for key in LEGS:
		var ids: Array = m.legs[key].ids
		var turn: Basis = twist.basis if key[1] == "H" else Basis.IDENTITY
		var wrist: Vector3 = flat[ids[2]].origin
		for j in range(2, ids.size()):
			flat[ids[j]] = Transform3D(turn * m.rest_global[ids[j]].basis,
				wrist + turn * ((m.rest_global[ids[j]].origin as Vector3) - (m.rest_global[ids[2]].origin as Vector3)))
	return _locals(m, _plant(m, s, g, flat))

static func _plant(m: Dictionary, s: Dictionary, g: Array, flat: Array, active: Array = LEGS, normals: Dictionary = {}) -> Array:
	if active.is_empty():
		return g
	var corrections := {"LF": Vector3.ZERO, "RF": Vector3.ZERO, "LH": Vector3.ZERO, "RH": Vector3.ZERO}
	# Recovering paw skin also responds to the constrained upper/lower bend plane.
	# Continue that coupled solve to the same tolerance; ordinary gait keeps its budget.
	var passes: int = config().grounding.recoverySolePasses if s.phase_ == "return" else config().grounding.solePasses
	for pass_index in passes:
		g = _solve_legs(m, s, g, flat, corrections, active, normals)
		var worst := 0.0
		var root := Transform3D(Basis(Vector3.UP, s.yaw), s.position)
		for key in active:
			var wanted: Vector3 = root.affine_inverse() * (s.feet[key].point as Vector3)
			var actual: Vector3 = sole(m, g, key)
			var error: Vector3 = wanted - actual
			var depth := _foot_depth(m, g, root, s.ground, key)
			# Contact belongs to the whole drawn sole. On a slope or at a tread edge
			# the supporting corner is above the gait point at the sole's centre.
			error.y = maxf(error.y, depth) if s.feet[key].swing else depth
			corrections[key] += error
			worst = maxf(worst, error.length())
		if worst < config().grounding.tolerance:
			break
	return g

static func _foot_depth(m: Dictionary, g: Array, root: Transform3D, ground, key: String) -> float:
	var depth := -INF
	for influences in m.skin_feet[key]:
		var point := Vector3.ZERO
		for item in influences:
			point += (g[item[0]] * item[1]) * item[2]
		var world: Vector3 = root * point
		var floor_y: float = ground.call(Vector3(world.x, root.origin.y, world.z)) if ground is Callable else root.origin.y
		depth = maxf(depth, floor_y - world.y)
	return depth

static func _solve_legs(m: Dictionary, s: Dictionary, g: Array, flat: Array, corrections: Dictionary, active: Array, normals: Dictionary) -> Array:
	var twist := Transform3D(Basis(Vector3.UP, angle_difference(s.yaw, s.hipYaw)), Vector3.ZERO)
	var to_model := Transform3D(Basis(Vector3.UP, s.yaw), s.position).affine_inverse()
	# The source shoulder/hip reaction can move above the gait's mean girdle height.
	# Fit the trunk to both limits of every active leg. A short upper bone and long
	# lower bone leave an inner unreachable sphere as well as an outer reach limit.
	# Raising a supporting girdle out of that sphere keeps the skin-sole correction
	# from pushing its wrist through the hip and reversing the leg for one frame.
	var lowest := -INF
	var highest := INF
	for key in active:
		var leg: Dictionary = m.legs[key]
		var ids: Array = leg.ids
		var r: Vector3 = g[ids[0]].origin + Vector3.UP * (s.feet[key].slide as float)
		var w: Vector3 = _wrist_target(m, s, key, flat, to_model) + corrections[key]
		var horizontal: float = Vector2(r.x - w.x, r.z - w.z).length()
		var limits := _reach_limits(m, s, key)
		var reach: float = limits.y
		if horizontal < reach:
			var vertical: float = sqrt(maxf(0, reach * reach - horizontal * horizontal))
			lowest = maxf(lowest, w.y - vertical - r.y)
			highest = minf(highest, w.y + vertical - r.y)
		if horizontal < limits.x:
			var folded: float = sqrt(maxf(0, limits.x * limits.x - horizontal * horizontal))
			if s.phase_ == "return" and key in s.return_air and r.y < w.y:
				# A captured free paw may be above its hip. Retain that branch while
				# its reachable path descends; do not force the body above the paw.
				highest = minf(highest, w.y - folded - r.y)
			else:
				lowest = maxf(lowest, w.y + folded - r.y)
	if lowest <= highest:
		var shift := Vector3.UP * clampf(0, lowest, highest)
		if not shift.is_zero_approx():
			for i in g.size():
				g[i] = Transform3D(g[i].basis, g[i].origin + shift)
				flat[i] = Transform3D(flat[i].basis, flat[i].origin + shift)
	for key in active:
		var leg: Dictionary = m.legs[key]
		var ids: Array = leg.ids
		var turn: Basis = twist.basis if key[1] == "H" else Basis.IDENTITY
		var k0: Vector3 = g[ids[1]].origin
		var r: Vector3 = g[ids[0]].origin
		var rest_normal: Vector3 = (m.legs[key].wrist - m.legs[key].root).cross(Vector3(0, 0, leg.bend)).normalized()
		var n0: Vector3 = (g[ids[2]].origin - r).cross(k0 - r)
		if n0.length_squared() < 1e-10:
			n0 = g[ids[0]].basis * (m.rest_global[ids[0]].basis as Basis).inverse() * rest_normal
		n0 = n0.normalized()
		var k0_from: Vector3 = k0 - r
		r += Vector3.UP * (s.feet[key].slide as float)  # the top of the leg slid (procedural_dog.gd)
		var w0: Vector3 = g[ids[2]].origin
		var w: Vector3 = _wrist_target(m, s, key, flat, to_model) + corrections[key]
		var d: Vector3 = w - r
		# During recovery the held/sleeping body's pose and a paw's safe landing path
		# need not have a simultaneous exact IK solution. Preserve anatomy and let the
		# paw approach its landing as the trunk recovers; never stretch a bone to force it.
		var limits := _reach_limits(m, s, key)
		w = r + d.normalized() * clampf(d.length(), limits.x, limits.y)
		var axis: Vector3 = (w - r).normalized()
		var desired_normal: Vector3 = n0
		if normals.has(key):
			var u: float = s.return_time / s.return_duration
			var start_normal: Vector3 = normals[key][0]
			var start_axis: Vector3 = normals[key][1]
			var end_normal: Vector3 = normals[key][2]
			var end_axis: Vector3 = normals[key][3]
			# Transport the bending plane with the leg axis, then gradually untwist
			# it toward the target. Interpolating a world-space normal can pass through
			# the current axis, where its projected pole becomes singular and spins.
			var transported: Vector3 = Quaternion(start_axis, axis) * start_normal
			var end_transport: Vector3 = Quaternion(start_axis, end_axis) * start_normal
			var twist_angle: float = end_transport.signed_angle_to(end_normal, end_axis)
			desired_normal = Basis(axis, twist_angle * smoothstep(0, 1, u)) * transported
		var n1 := desired_normal - axis * desired_normal.dot(axis)
		if n1.length_squared() < 1e-10:
			var fallback: Vector3 = g[ids[0]].basis.x
			n1 = fallback - axis * fallback.dot(axis)
		n1 = n1.normalized()
		var pole := n1.cross(axis).normalized()
		var k := _knee(r, w, leg.a, leg.b, pole)
		var upper := _frame(k - r, n1) * _frame(k0_from, n0).inverse()
		var lower := _frame(w - k, n1) * _frame(w0 - k0, n0).inverse()
		if normals.has(key):
			# Keep calibrated bone axes from the displayed and target poses. The
			# intermediate unconstrained FK leg can pass through straight, where its
			# geometric plane is a poor reference for axial bone rotation.
			var u: float = smoothstep(0, 1, s.return_time / s.return_duration)
			var upper_offset: Quaternion = (normals[key][4] as Quaternion).slerp(normals[key][6], u)
			var lower_offset: Quaternion = (normals[key][5] as Quaternion).slerp(normals[key][7], u)
			g[ids[0]] = Transform3D(_frame(k - r, n1) * Basis(upper_offset), r)
			g[ids[1]] = Transform3D(_frame(w - k, n1) * Basis(lower_offset), k)
		else:
			g[ids[0]] = Transform3D(upper * g[ids[0]].basis, r)
			g[ids[1]] = Transform3D(lower * g[ids[1]].basis, k)
		var shift: Vector3 = w - flat[ids[2]].origin
		for j in range(2, ids.size()):
			g[ids[j]] = Transform3D(flat[ids[j]].basis, flat[ids[j]].origin + shift)
	return g

static func _reach_limits(m: Dictionary, s: Dictionary, key: String) -> Vector2:
	var leg: Dictionary = m.legs[key]
	var minimum: float = m.p.reachMargin
	var maximum: float = m.p.reachMargin
	if s.phase_ == "return":
		# An authored planted pose may use a straighter leg than locomotion.
		# Restore the walking reserve gradually instead of bending it on the first frame.
		var u: float = smoothstep(0, 1, s.return_time / s.return_duration)
		var initial: Vector2 = s.return_limits[key][0]
		var target: Vector2 = s.return_limits[key][1]
		minimum = lerpf(minf(minimum, initial.x), minf(minimum, target.x), u)
		maximum = lerpf(minf(maximum, initial.y), minf(maximum, target.y), u)
	return Vector2(absf(leg.a - leg.b) + minimum, leg.a + leg.b - maximum)

static func _wrist_target(m: Dictionary, s: Dictionary, key: String, flat: Array, to_model: Transform3D) -> Vector3:
	var leg: Dictionary = m.legs[key]
	var paw: Transform3D = flat[leg.ids[-1]]
	return to_model * (s.feet[key].point as Vector3) - paw.basis * leg.sole_local - (paw.origin - (flat[leg.ids[2]] as Transform3D).origin)

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
