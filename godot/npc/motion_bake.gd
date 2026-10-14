## The export step of docs/动作重做方案.md §4.3: one source clip -> the stick figure the game plays.
## In: npc/motion/<id>.json (Kimodo joints, written by scripts/export-npc-motion.py), the mapping
## (skeleton_mapping.gd + skeleton-params.json, docs/design-plans/npc-skeleton-mapping.md), the clip's
## declaration in npc/clip-setup.json and, for its contacts, the object and held types it names.
## Out: npc/baked/<id>.json, which npc/clip_pose.gd reads. tools/bake_motion.gd runs this; the game itself
## never maps or corrects a pose.
##
## Placement:
##  - source_frame "fixed" (copied from meta.json): the clip was generated with its stance (an object's post)
##    at the origin facing +Z, and is kept that way.
##  - otherwise the origin is the first frame's hips. A clip whose hips travel at least IN_PLACE_TRAVEL figure
##    units from its first to its last frame and that is not stationary (declared so, or played at a post)
##    travels: it is turned to travel along +Z and its steady progress is taken out (the player moves the
##    figure by stride() per loop, so planted feet do not slide). Any other clip stays in place, turned to face
##    +Z at its first frame; a stationary one also loses its straight-line drift.
## A last frame that repeats the first (root-aligned, REPEAT_TOLERANCE) makes the clip chain: it loops seamlessly,
## and rise is the height it climbs per loop (stairs).
##
## Contacts (clip-setup.json "contacts", in the stick figure, after the mapping):
##  - hip -> a marker of the post's object (made_at in the source: the type and post the clip was generated at;
##    otherwise the first type offering the post kind and its first post marker). The whole body moves by the
##    difference; the feet stay where they were and the knees bend again (two-bone IK, lengths kept).
##  - handLeft / handRight -> an object marker: the arm reaches it (two-bone IK from the neck, the elbow keeps
##    its bend direction).
##  - handLeft / handRight -> item:<node> (a node of the held type, e.g. grip_left): the held thing sits where the
##    game hangs it (both hands: their midpoint) and the hands are put on its grips. A thing held in both hands is
##    first moved forward, if needed, so it does not cut into the torso stroke (motion-bake.json itemGap).
## A contact with time [from, to] fades in over its ramp (or motion-bake.json ramp) before `from` and out after `to`
## over its release (default: the ramp) (a quick touch, like a slap the source already lands on time, wants a short
## ramp, and a longer release so the hand does not snap off the table in one frame); without
## time it holds for the whole clip. How far each contact had to move its joint is reported; more than
## maxCorrection means the source should be generated again (docs/动作重做方案.md §4.3 step 3); miss_m is the mean
## distance still to go while the contact holds, in the clip frame, for adjusting the next generation's key.
extends RefCounted

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
const ContactPose := preload("res://npc/contact_pose.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")
const PoseBuild := preload("res://npc/pose_build.gd")

const BAKED_DIR := "res://npc/baked"
const PARAMS := "res://npc/motion-bake.json"
## A last frame within this distance of the first (every joint, root-aligned, metres) repeats it.
const REPEAT_TOLERANCE := 0.001
## Hips travelling less than this (figure units) from first to last frame: the clip stays in place.
const IN_PLACE_TRAVEL := 0.05
## Code and numbers that decide every baked pose; their text is part of each clip's fingerprint.
const CODE := ["res://npc/motion_bake.gd", "res://npc/skeleton_mapping.gd", "res://npc/contact_pose.gd", "res://npc/pose_build.gd", PARAMS]
## The points stored per frame, in this order (figure units, +Z forward, +Y up).
const POINTS := ["hip", "neck", "neckEnd", "head", "elbowLeft", "handLeft", "kneeLeft", "ankleLeft", "toeLeft",
	"elbowRight", "handRight", "kneeRight", "ankleRight", "toeRight"]

static var _common := ""

## The declaration fields that change a baked clip.
static func declared(id: String, setup) -> Dictionary:
	var d: Dictionary = setup.clips.get(id, {})
	return {"post": d.get("post", ""), "stationary": d.get("stationary", false), "item": d.get("item", {}),
		"contacts": d.get("contacts", []), "pose": d.get("pose", {})}

## Type and model files whose markers a clip's contacts read (every type offering its post kind, its held type).
static func geometry_files(id: String, setup) -> Array:
	var d := declared(id, setup)
	var types := []
	if d.post != "":
		types.append_array(setup.offers.get(d.post, []))
	if not d.item.is_empty():
		types.append(setup.type_path(d.item.type))
	var files := []
	var glb := RegEx.create_from_string('path="(res://[^"]+\\.glb)"')
	for t in types:
		if t in files:
			continue
		files.append(t)
		for m in glb.search_all(FileAccess.get_file_as_string(t)):
			if not m.get_string(1) in files:
				files.append(m.get_string(1))
	return files

## A hash of everything a baked clip is made from. Stored in the baked file; the game compares it with
## the files it finds, so a clip whose inputs changed is never played stale.
static func fingerprint(id: String, setup) -> String:
	if _common == "":
		var paths: Array = CODE + [NpcData.PARAMS_PATH, "%s/%s.json" % [NpcData.MOTION_DIR, NpcData.REST_CLIP]]
		_common = _hash_files(paths, "")
	var files: Array = ["%s/%s.json" % [NpcData.MOTION_DIR, id]] + geometry_files(id, setup)
	return _hash_files(files, _common + JSON.stringify(declared(id, setup)))

static func _hash_files(paths: Array, extra: String) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	for path in paths:
		ctx.update(path.to_utf8_buffer())
		if path.ends_with(".glb"):
			var bytes := FileAccess.get_file_as_bytes(path)
			if not bytes.is_empty():
				ctx.update(bytes)
		else:
			# Line endings follow the checkout; the content does not.
			var text := FileAccess.get_file_as_string(path).replace("\r\n", "\n")
			if text != "":
				ctx.update(text.to_utf8_buffer())
	if extra != "":
		ctx.update(extra.to_utf8_buffer())
	return ctx.finish().hex_encode()

## {error} or {error: "", data, report}: data is the baked clip as written to npc/baked/<id>.json; report says how
## far the contacts moved joints ({contact: metres}, over: [contacts beyond maxCorrection], itemShift metres).
static func bake(id: String) -> Dictionary:
	var got := {}
	var e := NpcData.load_params(got)
	if e != "":
		return {"error": e}
	var P: Dictionary = got.value
	e = NpcData.read_json(PARAMS, got)
	if e != "":
		return {"error": e}
	var B: Dictionary = got.value
	e = NpcData.load_joint_names(got)
	if e != "":
		return {"error": e}
	var names: Array = got.value
	e = NpcData.load_clip(NpcData.REST_CLIP, names.size(), got)
	if e != "":
		return {"error": e}
	var rest: Array = got.value.frames[NpcData.REST_FRAME]
	var mapper = SkeletonMapper.new(names, rest)
	if mapper.error != "":
		return {"error": mapper.error}
	var setup = ClipSetup.shared()
	if setup.error != "":
		return {"error": setup.error}
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var crowd = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	var scale: float = bodies[crowd.body].scale
	# The ankle-to-toe line of the source skeleton is not the sole: take its standing pitch off,
	# keeping animated toe-off and swing.
	var rest_pitch := []
	for side in ["Left", "Right"]:
		var ankle: Array = rest[mapper.J[side + "Foot"]]
		var toe: Array = rest[mapper.J[side + "ToeEnd"]]
		rest_pitch.append(atan2(toe[1] - ankle[1], Vector2(toe[0] - ankle[0], toe[2] - ankle[2]).length()))
	e = NpcData.load_clip(id, names.size(), got)
	if e != "":
		return {"error": e}
	var source: Dictionary = got.value
	var frames: Array = source.frames
	var hips: int = mapper.J["Hips"]
	var decl := declared(id, setup)
	var fixed: bool = source.get("source_frame", "") == "fixed"
	var stationary: bool = fixed or decl.stationary or decl.post != ""
	var chains: bool = frames.size() > 1 and _repeats(frames[0], frames[-1], hips)
	var count := maxi(1, frames.size() - 1)
	var origin: Array = [0.0, 0.0, 0.0] if fixed else frames[0][hips]
	var raw := []
	for f in frames:
		raw.append(mapper.mapFrame(f, P, origin))
	var a: Array = raw[0].H
	var b: Array = raw[mini(count, frames.size() - 1)].H
	var net := Vector3(b[0] - a[0], 0, b[2] - a[2])
	var turn := Basis.IDENTITY
	var stride := Vector3.ZERO
	var removed := Vector3.ZERO
	var in_place := true
	if not fixed:
		if net.length() >= IN_PLACE_TRAVEL and not stationary:
			in_place = false
			turn = Basis(Vector3.UP, -atan2(net.x, net.z))
			stride = net
			removed = net
		else:
			var fw: Array = mapper.torsoFrame(frames[0])[2]
			if Vector2(fw[0], fw[2]).length_squared() < 1e-12:
				return {"error": id + ": first frame has no horizontal heading"}
			turn = Basis(Vector3.UP, -atan2(fw[0], fw[2]))
			if stationary:
				removed = net
	var o := Vector3(origin[0], 0, origin[2])
	var poses := []
	for i in raw.size():
		var progress := removed * (float(i) / count)
		var to_local := func(q: Array) -> Vector3: return turn * (Vector3(q[0], q[1], q[2]) - o - progress)
		var m: Dictionary = raw[i]
		var segs := []
		for sg in m.segs:
			segs.append([to_local.call(sg[0]), to_local.call(sg[1]), sg[2]])
		for side in 2:
			var foot: Array = segs[6 if side == 0 else 11]
			var delta: Vector3 = foot[1] - foot[0]
			var horizontal := Vector3(delta.x, 0, delta.z).normalized()
			var pitch: float = atan2(delta.y, Vector2(delta.x, delta.z).length()) - rest_pitch[side]
			foot[1] = foot[0] + (horizontal * cos(pitch) + Vector3.UP * sin(pitch)) * delta.length()
		poses.append({"segs": segs, "head": to_local.call(m.head), "neck": to_local.call(m.N),
			"handLeft": to_local.call(m.handLeft), "handRight": to_local.call(m.handRight), "supportHands": m.supportHands})
	if not decl.pose.is_empty():
		return _bake_built(id, setup, decl, poses, mapper, rest, P, B, scale, float(source.fps))
	var report := {}
	if not decl.contacts.is_empty():
		var geo := _contact_geometry(id, setup, source, decl, scale)
		if geo.error != "":
			return {"error": geo.error}
		report = _fix_contacts(poses, decl, geo, float(source.fps), P, B, scale)
	# Source feet are thin, the figure's strokes are thick: keep travelling feet apart by the missing
	# stroke clearance, keeping their height, pitch and both leg lengths. Seated crossed legs are left alone.
	if not in_place:
		for i in poses.size():
			var source_side: Array = mapper.torsoFrame(frames[i])[0]
			separate_feet(poses[i], P.line, (turn * Vector3(source_side[0], 0, source_side[2])).normalized())
	var collision := {}
	var cleared := {"largest": 0.0, "left": {}}
	if decl.post != "":
		var frame := _object_frame(id, setup, source, decl)
		if frame.has("error"):
			return {"error": frame.error}
		var boxes := _boxes(frame.root, frame.to_post, scale)
		frame.root.free()
		cleared = _clear_objects(poses, boxes, P, B, float(source.fps), chains, scale)
	if decl.post != "" or not decl.item.is_empty():
		collision = _collision(id, setup, source, decl, poses, P, scale)
		if collision.has("error"):
			return {"error": collision.error}
	var points := []
	var support := []
	var any_support := false
	for pose in poses:
		var row := []
		for q in pose_points(pose):
			row.append_array([snappedf(q.x, 0.000001), snappedf(q.y, 0.000001), snappedf(q.z, 0.000001)])
		points.append(row)
		support.append([snappedf(pose.supportHands[0], 0.001), snappedf(pose.supportHands[1], 0.001)])
		any_support = any_support or pose.supportHands[0] > 0.0 or pose.supportHands[1] > 0.0
	var data := {"id": id, "fps": float(source.fps), "frames": frames.size(), "chains": chains,
		"rise": snappedf(b[1] - a[1], 0.00001) if chains else 0.0, "in_place": in_place,
		"stride": snappedf(stride.length(), 0.00001), "inputs": fingerprint(id, setup), "points": points}
	if any_support:
		data.support = support
	if not report.is_empty():
		data.contacts = report
	if not collision.is_empty():
		collision.cleared_m = snappedf(cleared.largest * scale, 0.001)
		if not cleared.left.is_empty():
			collision.too_deep_m = cleared.left
		data.collision = collision
	var width := _half_width(setup, decl, poses, P, scale)
	if width > 0.0:
		data.half_width = width
	return {"error": "", "data": data, "report": report, "collision": collision}

## A clip with a pose declaration (npc/pose_build.gd): built on the figure at its post from the object's markers; the
## mapped source poses only lend their sway. Then confirmed: at every post of its kind in every type offering it (and
## along a seat span, at both ends the clip may sit) no stroke cuts into the object deeper than pose.checkDepth.
## A clip that fails is an error: its object or declaration is wrong, nothing is pushed into place.
static func _bake_built(id: String, setup, decl: Dictionary, source_poses: Array, mapper, rest: Array, P: Dictionary,
		B: Dictionary, scale: float, fps: float) -> Dictionary:
	var geo := _pose_geometry(id, setup, decl, scale)
	if geo.error != "":
		return {"error": geo.error}
	var hips: int = mapper.J["Hips"]
	var mapped: Dictionary = mapper.mapFrame(rest, P, rest[hips])
	var fw: Array = mapper.torsoFrame(rest)[2]
	var turn := Basis(Vector3.UP, -atan2(fw[0], fw[2]))
	var h := Vector3(mapped.H[0], 0, mapped.H[2])
	var local := func(q: Array) -> Vector3: return turn * (Vector3(q[0], q[1], q[2]) - h)
	var segs := []
	for sg in mapped.segs:
		segs.append([local.call(sg[0]), local.call(sg[1]), sg[2]])
	var rest_pose := {"H": local.call(mapped.H), "N": local.call(mapped.N), "segs": segs}
	var made := PoseBuild.build(id, decl.pose, geo, source_poses, fps, rest_pose, P, B.pose, scale, decl.item.get("hand", ""))
	if made.error != "":
		return {"error": made.error}
	var poses: Array = made.poses
	var width := _half_width(setup, decl, poses, P, scale)
	var check := _confirm(id, setup, decl, poses, P, scale, width)
	if check.has("error"):
		return {"error": check.error}
	if check.max_m > B.pose.checkDepth:
		return {"error": "%s: the built figure cuts %.3f m into %s (%s, frame %d, %s): fix its pose or the object" % [id,
			check.max_m, check.into, check.part, check.frame, check.where]}
	var points := []
	for pose in poses:
		var row := []
		for q in pose_points(pose):
			row.append_array([snappedf(q.x, 0.000001), snappedf(q.y, 0.000001), snappedf(q.z, 0.000001)])
		points.append(row)
	var chains: bool = points.size() > 1
	for k in points[0].size():
		chains = chains and absf(points[0][k] - points[-1][k]) <= REPEAT_TOLERANCE / scale
	var data := {"id": id, "fps": fps, "frames": poses.size(), "chains": chains, "rise": 0.0, "in_place": true,
		"stride": 0.0, "inputs": fingerprint(id, setup), "points": points, "built": true, "collision": check}
	if width > 0.0:
		data.half_width = width
	data.merge(made.extras)
	return {"error": "", "data": data, "report": {}, "collision": check}

## {error, markers: {name: Vector3}, boxes} of a built clip's object at its post (the first type offering the post kind
## and its first post marker of that kind, clip frame, figure units). Every other type offering the kind must have the
## markers the pose names at the same places around its post (one built clip is played at all of them).
static func _pose_geometry(id: String, setup, decl: Dictionary, scale: float) -> Dictionary:
	if decl.post == "":
		return {"error": "", "markers": {}, "boxes": [], "type": ""}  # a clip at no object: body places only
	var types: Array = setup.offers.get(decl.post, [])
	if types.is_empty():
		return {"error": "%s: no object type offers post %s" % [id, decl.post]}
	var names := _pose_markers(decl.pose)
	var first := {}
	for type in types:
		var kinds: Dictionary = setup.types[type].posts
		var markers: Array = kinds.keys().filter(func(n): return kinds[n] == decl.post)
		markers.sort()
		var root: Node3D = load(type).instantiate()
		var post := root.get_node_or_null(markers[0]) as Node3D
		var to_post := post.transform.affine_inverse()
		var found := {}
		var nodes := {}  # every node's origin: parts a pose may carry
		for n in root.find_children("*", "Node3D", true, false):
			nodes[String(n.name)] = (to_post * _to_root(n, root).origin) / scale
			if n is Marker3D or (n.get_class() == "Node3D" and n.get_child_count() == 0):
				found[String(n.name)] = nodes[String(n.name)]
		var boxes := _boxes(root, to_post, scale)
		root.free()
		if first.is_empty():
			first = {"error": "", "markers": found, "boxes": boxes, "type": type, "nodes": nodes}
			continue
		for name in names:
			if not found.has(name) or not first.markers.has(name):
				return {"error": "%s: %s and %s must both have marker %s (post kind %s)" % [id, first.type, type, name, decl.post]}
			var off: float = found[name].distance_to(first.markers[name]) * scale
			if off > 0.005:
				return {"error": "%s: marker %s is %.3f m elsewhere around the post in %s than in %s; the seats of one post kind must agree" % [id, name, off, type, first.type]}
	return first

## The marker names a pose declaration uses.
static func _pose_markers(pose: Dictionary) -> Array:
	var out := []
	for k in ["seat", "back"]:
		if pose.has(k):
			out.append(pose[k])
	out.append_array(pose.get("feet", []).filter(func(f): return f != "stance"))
	var targets := []
	for side in pose.get("hands", {}):
		for key in pose.hands[side]:
			targets.append(String(key[1]))
	for key in pose.get("look", []):
		targets.append(String(key[1]))
	for t in targets:
		var name: String = String(t).split("@")[0].trim_suffix("^")
		if name in ["ahead"] or name.begins_with("hand:") or name.split(":")[0] in PoseBuild.PARTS:
			continue
		if not name in out:
			out.append(name)
	return out

## The deepest cut of a figure into the object at every post of the clip's kind, in every type offering it; along a
## seat span (a post marker with a child "span": the seat runs from -span.x to span.x along the post's X) at both
## ends the clip may sit at and the middle. {max_m, part, frame, into, where} or {error}.
static func _confirm(id: String, setup, decl: Dictionary, poses: Array, P: Dictionary, scale: float, width: float) -> Dictionary:
	var names := ["torso", "neck", "upper arm L", "forearm L", "thigh L", "shin L", "foot L", "upper arm R", "forearm R", "thigh R", "shin R", "foot R"]
	var worst := {"max_m": 0.0, "part": "", "frame": -1, "into": "", "where": ""}
	for type in setup.offers.get(decl.post, []):
		var kinds: Dictionary = setup.types[type].posts
		for marker in kinds:
			if kinds[marker] != decl.post:
				continue
			var root: Node3D = load(type).instantiate()
			var post := root.get_node_or_null(marker) as Node3D
			var boxes := _boxes(root, post.transform.affine_inverse(), scale)
			var span := post.get_node_or_null("span") as Node3D
			root.free()
			var offsets := [0.0]
			if span != null:
				var room: float = span.position.x - width
				if room < 0.0:
					return {"error": "%s: the seat of %s is %.3f m too short for it" % [id, type, -room]}
				offsets = [-room / scale, 0.0, room / scale]
			for x in offsets:
				for i in poses.size():
					var p: Dictionary = poses[i]
					var probes := []
					for k in p.segs.size():
						var sg: Array = p.segs[k]
						for w in 11:
							probes.append([sg[0].lerp(sg[1], w / 10.0) + Vector3(x, 0, 0), P.line * sg[2] * 0.5, k])
					probes.append([p.head + Vector3(x, 0, 0), P.headR, -1])
					for probe in probes:
						for box in boxes:
							var depth: float = probe[1] - _box_distance(probe[0], box)
							if depth * scale > worst.max_m:
								worst = {"max_m": snappedf(depth * scale, 0.001), "part": "head" if probe[2] < 0 else names[probe[2]],
									"frame": i, "into": box.name, "where": "%s %s%s" % [type.get_file().get_basename(), marker,
									" at %+.2f m along the seat" % (x * scale) if span != null else ""]}
	return worst

## How far the figure reaches sideways from its hips (metres, strokes and head at their drawn width, plus the bake's
## clearGap), for a clip played on a seat span; 0 when its post kind has no span.
static func _half_width(setup, decl: Dictionary, poses: Array, P: Dictionary, scale: float) -> float:
	if decl.post == "":
		return 0.0
	var spans := false
	for type in setup.offers.get(decl.post, []):
		var root: Node3D = load(type).instantiate()
		for n in root.find_children("span", "Node3D", true, false):
			spans = spans or (n.get_parent() is Marker3D and String(n.get_parent().name).begins_with("post_" + decl.post))
		root.free()
	if not spans:
		return 0.0
	var most := 0.0
	for p in poses:
		for sg in p.segs:
			for q in [sg[0], sg[1]]:
				most = maxf(most, absf(q.x) + P.line * sg[2] * 0.5)
		most = maxf(most, absf(p.head.x) + P.headR)
	var params = JSON.parse_string(FileAccess.get_file_as_string(PARAMS))
	return snappedf(most * scale + params.clearGap, 0.001)

## How deep the drawn figure (strokes at their drawn width, the head disc) cuts into the object's meshes and the
## held thing, as boxes: {max_m, part, frame, into} (metres at adult scale). Only the hand ends of the forearms may
## touch the held thing (they hold it; the arms must not pass through it); everything may touch a surface, only going
## into it counts.
static func _collision(id: String, setup, source: Dictionary, decl: Dictionary, poses: Array, P: Dictionary, scale: float) -> Dictionary:
	var object_boxes := []
	if decl.post != "":
		var frame := _object_frame(id, setup, source, decl)
		if frame.has("error"):
			return frame
		object_boxes = _boxes(frame.root, frame.to_post, scale)
		frame.root.free()
	var item_boxes := []
	if not decl.item.is_empty():
		var root: Node3D = load(setup.type_path(decl.item.type)).instantiate()
		item_boxes = _boxes(root, Transform3D.IDENTITY, scale)
		root.free()
	var names := ["torso", "neck", "upper arm L", "forearm L", "thigh L", "shin L", "foot L", "upper arm R", "forearm R", "thigh R", "shin R", "foot R"]
	var forearms := [3, 8]
	var worst := {"max_m": 0.0, "part": "", "frame": -1, "into": ""}
	for i in poses.size():
		var p: Dictionary = poses[i]
		var origin: Vector3 = (p.handLeft + p.handRight) * 0.5
		match decl.item.get("hand", ""):
			"left": origin = p.handLeft
			"right": origin = p.handRight
			"back": origin = p.neck
		var probes := []
		for k in p.segs.size():
			var sg: Array = p.segs[k]
			for w in 6:
				probes.append([sg[0].lerp(sg[1], w / 5.0), P.line * sg[2] * 0.5, k, w])
		probes.append([p.head, P.headR, -1, 0])
		for probe in probes:
			for box in object_boxes:
				var depth: float = probe[1] - _box_distance(probe[0], box)
				if depth * scale > worst.max_m:
					worst = {"max_m": depth * scale, "part": "head" if probe[2] < 0 else names[probe[2]], "frame": i, "into": box.name}
			if probe[2] in forearms and probe[3] >= 4:
				continue  # the hand end of the forearm holds the thing
			for box in item_boxes:
				var moved: Dictionary = box.duplicate()
				moved.centre = box.centre + origin
				var depth: float = probe[1] - _box_distance(probe[0], moved)
				if depth * scale > worst.max_m:
					worst = {"max_m": depth * scale, "part": "head" if probe[2] < 0 else names[probe[2]], "frame": i, "into": "item " + box.name}
	worst.max_m = snappedf(worst.max_m, 0.001)
	return worst

## Push strokes that cut into the object's boxes out again: the generation already keeps the figure out of them
## (scene guidance), this takes what its final steps put back. Each stroke belongs to an end that can move it: an arm
## to its hand, a leg to its foot (along the floor, and only as far as the cut faces sideways: a leg cutting into a top
## is not mended by sliding the foot), the torso, neck and head to the hips (the whole body). A limb has two joints to
## move, the elbow or knee ("mid") and the hand or ankle ("tip"): a cut in the upper segment moves both, a cut in the
## lower one moves the joint it is nearer (a forearm over a table edge lifts the elbow, a hand in the top lifts the
## hand), a cut in the foot moves the ankle. A frame's push of a joint is the deepest cut that moves it, along the way
## out of the box (_box_push).
## Up to six passes: each adds the pushes still needed to what the earlier passes found, and the poses are made again
## from the source poses with moves that change smoothly over time (_smooth_pushes), so a corrected joint never jumps
## from one frame to the next and a frame next to one that needs a lot is moved by it once, not on every pass. An end
## whose first push is deeper than clearMax, or whose joints end up farther than clearMove from where they were, is
## left alone: the clip was not made against this object and cuts deep into it, and pushing that out is no repair
## (2026-10-14: the old per-frame push threw elbows, hands and whole bodies 0.1-0.6 m about in 87 clips). _collision
## still reports the cut, for a new generation.
## Returns {largest: the farthest a joint was moved (figure units), left: {end: how far it would have had to move
## (metres)}}.
static func _clear_objects(poses: Array, boxes: Array, P: Dictionary, B: Dictionary, fps: float, chains: bool, scale: float) -> Dictionary:
	var result := {"largest": 0.0, "left": {}}
	if boxes.is_empty():
		return result
	var ends := ["hip", "handLeft", "handRight", "footLeft", "footRight"]
	var window := maxi(1, roundi(fps * B.clearSmooth))
	# a chaining clip's last frame is its first again: the moves go round one loop
	var period: int = poses.size() - 1 if chains and poses.size() > 2 else poses.size()
	var original := poses.duplicate(true)
	var need := []  # per frame {end: [mid, tip]}: the pushes found so far, added up
	for i in poses.size():
		var d := {}
		for e in ends:
			d[e] = [Vector3.ZERO, Vector3.ZERO]
		need.append(d)
	var skip := {}
	for pass_ in 6:
		var pushes := _pushes(poses, boxes, P, B.clearGap / scale)
		if pass_ == 0:
			for e in ends:
				var deepest := 0.0
				for push in pushes:
					deepest = maxf(deepest, maxf(push[e][0].length(), push[e][1].length()))
				if deepest * scale > B.clearMax:
					skip[e] = true
					result.left[e] = snappedf(deepest * scale, 0.001)
		var any := false
		for i in pushes.size():
			for e in ends:
				for c in 2:
					if not skip.has(e) and pushes[i][e][c].length() > 1e-6:
						any = true
						need[i][e][c] += pushes[i][e][c]
		if not any:
			break
		while true:
			_apply_needs(poses, original, need, skip, window, period)
			var over := []
			var moved := _moved(poses, original)
			result.largest = 0.0
			for e in moved:
				if not skip.has(e) and moved[e] * scale > B.clearMove:
					over.append(e)
				elif not skip.has(e):
					result.largest = maxf(result.largest, moved[e])
			if over.is_empty():
				break
			for e in over:
				skip[e] = true
				result.left[e] = snappedf(moved[e] * scale, 0.001)
	return result

## Per frame {end: [mid push, tip push]} (the hips use the first) of _clear_objects for the poses as they are now.
static func _pushes(poses: Array, boxes: Array, P: Dictionary, gap: float) -> Array:
	var ends := ["hip", "handLeft", "handRight", "footLeft", "footRight"]
	var owner := {0: "hip", 1: "hip", 2: "handLeft", 3: "handLeft", 4: "footLeft", 5: "footLeft", 6: "footLeft",
		7: "handRight", 8: "handRight", 9: "footRight", 10: "footRight", 11: "footRight", -1: "hip"}
	var lower := [3, 8, 5, 10]  # forearms and shins
	var feet := [6, 11]
	var pushes := []
	for p in poses:
		var push := {}
		for e in ends:
			push[e] = [Vector3.ZERO, Vector3.ZERO]
		# the side a stroke came in from: the neck's for arms, torso and head, the hips' for legs
		var roots := {"hip": p.segs[0][1], "handLeft": p.segs[0][1], "handRight": p.segs[0][1],
			"footLeft": p.segs[0][0], "footRight": p.segs[0][0]}
		var probes := []
		for k in p.segs.size():
			var sg: Array = p.segs[k]
			for w in 6:
				probes.append([sg[0].lerp(sg[1], w / 5.0), P.line * sg[2] * 0.5, k, w])
		probes.append([p.head, P.headR, -1, 0])
		for probe in probes:
			var e: String = owner[probe[2]]
			for box in boxes:
				var way := _box_push(probe[0], probe[1], box, roots[e])
				var depth: float = way[1] + gap
				if depth <= 0.0:
					continue
				var n: Vector3 = way[0]
				if e.begins_with("foot"):
					var flat := Vector3(n.x, 0, n.z)
					n = flat.normalized() * smoothstep(0.3, 0.7, flat.length()) if flat.length() > 1e-6 else Vector3.ZERO
				var v: Vector3 = n * depth
				var t: float = probe[3] / 5.0
				var shares := [1.0, 1.0]
				if probe[2] in lower:
					shares = [clampf(2.0 * (1.0 - t), 0.0, 1.0), clampf(2.0 * t, 0.0, 1.0)]
				elif probe[2] in feet:
					shares = [0.0, 1.0]
				for c in 2:
					if (v * shares[c]).length() > push[e][c].length():
						push[e][c] = v * shares[c]
		pushes.append(push)
	return pushes

## Makes the poses again from the source poses, with the smoothed moves of every end not in `skip`.
static func _apply_needs(poses: Array, original: Array, need: Array, skip: Dictionary, window: int, period: int) -> void:
	var moves := {}
	for e in need[0]:
		if not skip.has(e):
			moves[e] = [_smooth_pushes(need, e, 0, window, period), _smooth_pushes(need, e, 1, window, period)]
	for i in poses.size():
		var p: Dictionary = original[i].duplicate(true)
		if moves.has("hip") and moves.hip[0][i].length() > 1e-9:
			_move_hip(p, moves.hip[0][i])
		for e in moves:
			if e == "hip":
				continue
			var m: Vector3 = moves[e][0][i]
			var tm: Vector3 = moves[e][1][i]
			if m.length() > 1e-9 or tm.length() > 1e-9:
				_push_limb(p, e, m, tm)
		poses[i] = p

## How far each end's joints are from where they were, at most over the frames (figure units): the hips, and the
## elbow or knee and hand or ankle relative to the hips (a whole-body move is the hips' own).
static func _moved(poses: Array, original: Array) -> Dictionary:
	var moved := {"hip": 0.0, "handLeft": 0.0, "handRight": 0.0, "footLeft": 0.0, "footRight": 0.0}
	var first := {"handLeft": 2, "handRight": 7, "footLeft": 4, "footRight": 9}
	for i in poses.size():
		var a: Array = original[i].segs
		var b: Array = poses[i].segs
		var shift: Vector3 = b[0][0] - a[0][0]
		moved.hip = maxf(moved.hip, shift.length())
		for e in first:
			var k: int = first[e]
			moved[e] = maxf(moved[e], maxf(a[k][1].distance_to(b[k][1] - shift), a[k + 1][1].distance_to(b[k + 1][1] - shift)))
	return moved

## Moves a limb's elbow or knee by `mid_move` and its hand or ankle by `tip_move` without solving it: the elbow or knee
## goes as far towards its moved place as its upper segment lets it, then the hand or ankle towards its own on the
## lower segment (lengths kept; the foot keeps its pitch). A two-bone solve would straighten an arm pushed past its
## reach and snap the elbow out again when the push eases (the elbows of pull_door, push_door, ride_bicycle,
## chess_move_far); this has no full reach to snap against.
static func _push_limb(p: Dictionary, end: String, mid_move: Vector3, tip_move: Vector3) -> void:
	var arm := end.begins_with("hand")
	var i: int = (2 if end.ends_with("Left") else 7) if arm else (4 if end.ends_with("Left") else 9)
	var root: Vector3 = p.segs[i][0]
	var mid: Vector3 = p.segs[i][1]
	var tip: Vector3 = p.segs[i + 1][1]
	var new_mid := root + (mid + mid_move - root).normalized() * root.distance_to(mid)
	var new_tip := new_mid + (tip + tip_move - new_mid).normalized() * mid.distance_to(tip)
	p.segs[i][1] = new_mid
	p.segs[i + 1][0] = new_mid
	p.segs[i + 1][1] = new_tip
	if arm:
		p[end] = new_tip
	else:
		var toe: Vector3 = p.segs[i + 2][1] - tip
		p.segs[i + 2][0] = new_tip
		p.segs[i + 2][1] = new_tip + toe

## One joint's pushes (pushes[frame][end][channel]) as a move that covers each frame's push and changes smoothly: every
## frame takes, along each axis, the largest push within `window` frames (by axis, so a hand at a table's edge that
## needs to go up in one frame and back in the next gets both), then those are averaged over the same span (triangle
## weights). Frame indices go round `period` when it is shorter than the clip (a chaining clip: its last frame is its
## first).
static func _smooth_pushes(pushes: Array, e: String, channel: int, window: int, period: int) -> Array:
	var n := pushes.size()
	var loop := period < n
	var span := period if loop else n
	var widest := []
	for i in span:
		var best := Vector3.ZERO
		for j in range(i - window, i + window + 1):
			if not loop and (j < 0 or j >= n):
				continue
			var v: Vector3 = pushes[posmod(j, period) if loop else j][e][channel]
			for a in 3:
				if absf(v[a]) > absf(best[a]):
					best[a] = v[a]
		widest.append(best)
	var moves := []
	for i in n:
		var c := posmod(i, period) if loop else i
		var acc := Vector3.ZERO
		var total := 0.0
		for j in range(c - window, c + window + 1):
			if not loop and (j < 0 or j >= n):
				continue
			var w := 1.0 - absf(j - c) / float(window + 1)
			acc += widest[posmod(j, period) if loop else j] * w
			total += w
		moves.append(acc / total)
	return moves

## Which way and how far a stroke point of radius r must move to clear a box: [direction, distance] (distance <= 0:
## clear already). With its centre outside the box: straight away from the nearest point. Inside: out through the
## nearest pair of faces, on the side of `root` (where the stroke comes from). A thick stroke resting on a thin top
## can have its centre past the middle of the top, and the nearest face would then push it down through the top
## in some frames and up in others (the forearms on the chess table, 2026-10-14).
static func _box_push(p: Vector3, r: float, box: Dictionary, root: Vector3) -> Array:
	var axes: Basis = box.axes
	var q: Vector3 = axes.transposed() * (p - box.centre)
	var d: Vector3 = q.abs() - box.half
	if maxf(d.x, maxf(d.y, d.z)) > 0.0:
		var outside := Vector3(signf(q.x) * maxf(d.x, 0), signf(q.y) * maxf(d.y, 0), signf(q.z) * maxf(d.z, 0))
		return [(axes * outside).normalized(), r - outside.length()]
	var axis := 0 if d.x >= d.y and d.x >= d.z else (1 if d.y >= d.z else 2)
	var side := signf((axes.transposed() * (root - box.centre))[axis])
	if side == 0.0:
		side = signf(q[axis]) if q[axis] != 0.0 else 1.0
	var n := Vector3.ZERO
	n[axis] = side
	return [axes * n, r + box.half[axis] - side * q[axis]]

## The object type and post marker of a clip: {root (instance, free it), to_post} or {error}.
static func _object_frame(id: String, setup, source: Dictionary, decl: Dictionary) -> Dictionary:
	var type := ""
	var post := ""
	if source.has("made_at"):
		type = setup.type_path(source.made_at.object)
		post = source.made_at.post
	elif setup.offers.has(decl.post):
		type = setup.offers[decl.post][0]
		var kinds: Dictionary = setup.types[type].posts
		var markers: Array = kinds.keys().filter(func(n): return kinds[n] == decl.post)
		markers.sort()
		post = markers[0]
	else:
		return {"error": "%s: no object type offers post %s" % [id, decl.post]}
	if not ResourceLoader.exists(type):
		return {"error": "%s: no object type %s" % [id, type]}
	var root: Node3D = load(type).instantiate()
	var marker := root.get_node_or_null(post) as Node3D
	if marker == null:
		root.free()
		return {"error": "%s: %s has no post marker %s" % [id, type, post]}
	return {"root": root, "to_post": marker.transform.affine_inverse()}

## Every mesh of an instance as a box {name, centre, axes (orthonormal Basis), half} in figure units.
static func _boxes(root: Node3D, to_frame: Transform3D, scale: float) -> Array:
	var out := []
	for mesh in root.find_children("*", "MeshInstance3D", true, false):
		var m := mesh as MeshInstance3D
		if m.mesh == null:
			continue
		var aabb := m.mesh.get_aabb()
		if aabb.size.x < 0.03 and aabb.size.y < 0.03 and aabb.size.z < 0.03:
			continue
		var xf: Transform3D = to_frame * _to_root(m, root)
		out.append({"name": String(m.name), "centre": xf * aabb.get_center() / scale,
			"axes": xf.basis.orthonormalized(), "half": aabb.size * 0.5 * xf.basis.get_scale() / scale})
	return out

static func _box_distance(p: Vector3, box: Dictionary) -> float:
	var axes: Basis = box.axes
	var q: Vector3 = axes.transposed() * (p - box.centre)
	var d: Vector3 = q.abs() - box.half
	return Vector3(maxf(d.x, 0), maxf(d.y, 0), maxf(d.z, 0)).length() + minf(maxf(d.x, maxf(d.y, d.z)), 0.0)

## Where the contacts point, in the clip's frame (figure units): {error, markers: {name: Vector3},
## grips: {name: Vector3 relative to the held thing's origin}, box: AABB of the held thing around that origin}.
static func _contact_geometry(id: String, setup, source: Dictionary, decl: Dictionary, scale: float) -> Dictionary:
	var geo := {"error": "", "markers": {}, "grips": {}, "box": AABB()}
	var wants_object := false
	var wants_item := false
	for c in decl.contacts:
		if String(c.to).begins_with("item:"):
			wants_item = true
		else:
			wants_object = true
	if wants_object:
		var type := ""
		var post := ""
		if source.has("made_at"):
			type = setup.type_path(source.made_at.object)
			post = source.made_at.post
		elif setup.offers.has(decl.post):
			type = setup.offers[decl.post][0]
			var kinds: Dictionary = setup.types[type].posts
			var markers: Array = kinds.keys().filter(func(n): return kinds[n] == decl.post)
			markers.sort()
			post = markers[0]
		else:
			return {"error": "%s: no object type offers post %s for its contacts" % [id, decl.post]}
		if not ResourceLoader.exists(type):
			return {"error": "%s: no object type %s" % [id, type]}
		var root: Node3D = load(type).instantiate()
		var marker := root.get_node_or_null(post) as Node3D
		if marker == null:
			root.free()
			return {"error": "%s: %s has no post marker %s" % [id, type, post]}
		var to_post := marker.transform.affine_inverse()
		for c in decl.contacts:
			if String(c.to).begins_with("item:"):
				continue
			var n := root.find_child(c.to, true, false) as Node3D
			if n == null:
				root.free()
				return {"error": "%s: %s has no marker %s" % [id, type, c.to]}
			geo.markers[c.to] = (to_post * _to_root(n, root).origin) / scale
		root.free()
	if wants_item:
		var path: String = setup.type_path(decl.item.type)
		if not ResourceLoader.exists(path):
			return {"error": "%s: no held type %s" % [id, path]}
		var root: Node3D = load(path).instantiate()
		for c in decl.contacts:
			if not String(c.to).begins_with("item:"):
				continue
			var node_name: String = String(c.to).trim_prefix("item:")
			var n := root.find_child(node_name, true, false) as Node3D
			if n == null:
				root.free()
				return {"error": "%s: %s has no node %s" % [id, path, node_name]}
			geo.grips[c.to] = _to_root(n, root).origin / scale
		var box := AABB()
		var first := true
		for mesh in root.find_children("*", "MeshInstance3D", true, false):
			var xf := _to_root(mesh, root)
			var bb: AABB = xf * (mesh as MeshInstance3D).mesh.get_aabb()
			box = bb if first else box.merge(bb)
			first = false
		root.free()
		geo.box = AABB(box.position / scale, box.size / scale)
	return geo

## The transform of a node relative to `root` (the instance not being in a tree).
static func _to_root(n: Node, root: Node) -> Transform3D:
	var xf := Transform3D.IDENTITY
	while n != null and n != root:
		if n is Node3D:
			xf = (n as Node3D).transform * xf
		n = n.get_parent()
	return xf

static func _weight(c: Dictionary, t: float, ramp: float, release: float) -> float:
	if not c.has("time"):
		return 1.0
	var w_in := 1.0 if t >= c.time[0] else (smoothstep(c.time[0] - ramp, c.time[0], t) if ramp > 0.0 else 0.0)
	var w_out := 1.0 if t <= c.time[1] else (1.0 - smoothstep(c.time[1], c.time[1] + release, t) if release > 0.0 else 0.0)
	return w_in * w_out

static func _fix_contacts(poses: Array, decl: Dictionary, geo: Dictionary, fps: float, P: Dictionary, B: Dictionary, scale: float) -> Dictionary:
	var ramp: float = B.ramp
	var moved := {}
	var left := {}  # contact -> largest distance still left after the fix (out of reach), metres
	var gap := {}  # contact -> [sum of (target - joint) over full-weight frames, count]
	var over := []
	var item_hands: Array = decl.contacts.filter(func(c): return String(c.to).begins_with("item:"))
	# A thing held in both hands must stay in front of the torso stroke: one forward shift for the whole clip.
	var forward := 0.0
	if not item_hands.is_empty() and decl.item.hand == "both":
		var radius: float = P.line * P.torsoLine * 0.5 + B.itemGap / scale
		for p in poses:
			var mid: Vector3 = (p.handLeft + p.handRight) * 0.5
			var low: float = mid.y + geo.box.position.y
			var high: float = mid.y + geo.box.end.y
			var front := -INF
			for k in 9:
				var q: Vector3 = p.segs[0][0].lerp(p.segs[0][1], k / 8.0)
				if q.y >= low and q.y <= high:
					front = maxf(front, q.z + radius)
			if front > -INF:
				forward = maxf(forward, front - (mid.z + geo.box.position.z))
	for i in poses.size():
		var p: Dictionary = poses[i]
		var t := i / fps
		var mid: Vector3 = (p.handLeft + p.handRight) * 0.5 + Vector3(0, 0, forward)
		for c in decl.contacts:
			var w := _weight(c, t, c.get("ramp", ramp), c.get("release", c.get("ramp", ramp)))
			if w <= 0.0:
				continue
			var key: String = "%s->%s" % [c.joint, c.to]
			var target: Vector3
			if String(c.to).begins_with("item:"):
				var origin: Vector3 = mid if decl.item.hand == "both" else (p.neck if decl.item.hand == "back" else p["hand" + String(decl.item.hand).capitalize()])
				target = origin + geo.grips[c.to]
			else:
				target = geo.markers[c.to]
				if c.get("on", "") == "top":
					# the stroke rests on the surface, not in it: the hip carries the thicker torso stroke
					target += Vector3.UP * P.line * (P.torsoLine if c.joint == "hip" else 1.0) * 0.5
			var now: Vector3 = p.segs[0][0] if c.joint == "hip" else p[c.joint]
			moved[key] = maxf(moved.get(key, 0.0), now.distance_to(target) * w * scale)
			if w >= 1.0:
				var g: Array = gap.get(key, [Vector3.ZERO, 0])
				gap[key] = [g[0] + (target - now) * scale, g[1] + 1]
			if c.joint == "hip":
				_move_hip(p, (target - now) * w)
			else:
				left[key] = maxf(left.get(key, 0.0), ContactPose.limb(p, c.joint, target, w) * scale)
	for key in moved:
		moved[key] = snappedf(moved[key], 0.001)
		if moved[key] > B.maxCorrection:
			over.append(key)
	# The mean miss while the contact holds, in the clip frame (x right... +Z forward): what a new generation
	# should add to its key target (scaled to the source skeleton) to land closer.
	var miss := {}
	for key in gap:
		var m: Vector3 = gap[key][0] / maxi(1, gap[key][1])
		miss[key] = [snappedf(m.x, 0.001), snappedf(m.y, 0.001), snappedf(m.z, 0.001)]
	for key in left:
		left[key] = snappedf(left[key], 0.001)
	return {"moved_m": moved, "miss_m": miss, "left_m": left, "over": over, "item_shift_m": snappedf(forward * scale, 0.001)}

## Moves the whole figure by `delta`, then puts both feet back where they were (the knees bend again).
static func _move_hip(p: Dictionary, delta: Vector3) -> void:
	var old_hip: Vector3 = p.segs[0][0]
	var legs := []
	for i in [4, 9]:
		legs.append([p.segs[i][1], p.segs[i + 1][1], p.segs[i + 2][1] - p.segs[i + 1][1]])
	ContactPose.translate(p, delta)
	var hip: Vector3 = p.segs[0][0]
	for k in 2:
		var i: int = [4, 9][k]
		var knee: Vector3 = legs[k][0]
		var ankle: Vector3 = legs[k][1]
		var r := ContactPose.solve(hip, hip + (knee - old_hip), hip + (ankle - old_hip), ankle, knee - old_hip)
		p.segs[i] = [hip, r[0], p.segs[i][2]]
		p.segs[i + 1] = [r[0], r[1], p.segs[i + 1][2]]
		p.segs[i + 2] = [r[1], r[1] + legs[k][2], p.segs[i + 2][2]]

## The POINTS of a pose dictionary (the segs layout of skeleton_mapping.gd mapFrame).
static func pose_points(p: Dictionary) -> Array:
	var s: Array = p.segs
	return [s[0][0], s[0][1], s[1][1], p.head, s[2][1], s[3][1], s[4][1], s[5][1], s[6][1],
		s[7][1], s[8][1], s[9][1], s[10][1], s[11][1]]

## A pose dictionary from stored POINTS (14 Vector3) and the line width multiplier of torso and neck.
static func pose_from_points(q: Array, torso_line: float, support: Array) -> Dictionary:
	var segs := [[q[0], q[1], torso_line], [q[1], q[2], torso_line],
		[q[1], q[4], 1.0], [q[4], q[5], 1.0], [q[0], q[6], 1.0], [q[6], q[7], 1.0], [q[7], q[8], 1.0],
		[q[1], q[9], 1.0], [q[9], q[10], 1.0], [q[0], q[11], 1.0], [q[11], q[12], 1.0], [q[12], q[13], 1.0]]
	return {"segs": segs, "head": q[3], "neck": q[1], "handLeft": q[5], "handRight": q[10], "supportHands": support}

static func separate_feet(pose_: Dictionary, width: float, side: Vector3) -> void:
	for attempt in 8:
		var a: Array = pose_.segs[6]
		var b: Array = pose_.segs[11]
		var gap := minf(a[0].dot(side), a[1].dot(side)) - maxf(b[0].dot(side), b[1].dot(side))
		if gap >= width - 0.000001:
			return
		var correction := maxf(0.0, width - gap) * 0.5
		ContactPose.limb(pose_, "footLeft", a[0] + side * correction)
		ContactPose.limb(pose_, "footRight", b[0] - side * correction)

static func _repeats(f0: Array, f1: Array, hips: int) -> bool:
	var shift := Vector3(f1[hips][0] - f0[hips][0], f1[hips][1] - f0[hips][1], f1[hips][2] - f0[hips][2])
	for j in f0.size():
		if Vector3(f1[j][0], f1[j][1], f1[j][2]).distance_to(Vector3(f0[j][0], f0[j][1], f0[j][2]) + shift) > REPEAT_TOLERANCE:
			return false
	return true
