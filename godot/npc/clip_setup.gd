## What a clip needs around it: npc/clip-setup.json (format in its _note). Read and checked once
## (ClipSetup.shared()); the object types are scanned from their .tscn text for post markers and groups,
## so nothing has to be instantiated to know which types offer which post.
##  - error: a data error (a key that is not known, a hand that is not one of HANDS, a declared clip or
##    item name that is malformed, a post marker whose name has no kind). Callers stop on it.
##  - missing(clip): the one exception to stopping (CLAUDE.md 规矩): what the declaration names that does
##    not exist yet (no type offers the post kind, no types/held_<name>.tscn, no partner clip file).
##    Such a clip is shown greyed in scenes/empty_ground and never picked by the game.
## Writes: set_partner_at() rewrites clip-setup.json (scenes/empty_ground, when the partner is dragged).
extends RefCounted

const PATH := "res://npc/clip-setup.json"
const TYPES_DIR := "res://types/"
const MOTION_DIR := "res://npc/motion"
const HANDS := ["left", "right", "both", "back"]
## Type group of things a person pushes (a cart, a stroller): the object follows the person's root.
const PUSHED := "pushed"
const KEYS := ["post", "item", "partner", "stationary", "contacts", "pose"]
## Keys of a "pose" (npc/pose_build.gd builds the clip on the figure from it).
const POSE_KEYS := ["seconds", "seat", "back", "feet", "hip", "lean", "tilt", "hands", "look", "life", "carry", "show", "rest", "wrist"]
## Joints a contact may move at export (npc/motion_bake.gd).
const CONTACT_JOINTS := ["hip", "handLeft", "handRight"]

static var _shared = null

var error := ""
var note := ""
## clip -> {post: String, item: {type, hand}, partner: {clip, at: Vector2, yaw}, stationary: true,
##   contacts: [{joint, to, time}]} (only the keys given)
var clips := {}
## post kind -> [type paths] offering it, sorted
var offers := {}
## type path -> {posts: {marker name: kind}, groups: [String]}
var types := {}

## The shared, checked setup (read once). reload: read the files again (after one was written).
static func shared(reload := false):
	if _shared == null or reload:
		_shared = new()
	return _shared

func _init() -> void:
	_scan_types()
	if error != "":
		return
	load_data(JSON.parse_string(FileAccess.get_file_as_string(PATH)))

## Parse formal and process-local candidate setup through the same checked path.
## Input stays raw JSON; partner coordinates become Vector2 only on success.
func load_data(v) -> String:
	error = ""
	if not (v is Dictionary and v.get("clips") is Dictionary):
		error = PATH + ": missing, not a JSON object, or no clips object"
		return error
	note = v.get("_note", "")
	var checked := {}
	for clip in v.clips:
		var e = v.clips[clip]
		var where := "%s: %s" % [PATH, clip]
		if not (e is Dictionary) or e.is_empty():
			error = where + ": must be an object naming post, item, partner, stationary and/or contacts"
			return error
		if not FileAccess.file_exists("%s/%s.json" % [MOTION_DIR, clip]):
			error = where + ": no such clip in " + MOTION_DIR
			return error
		var s := {}
		for k in e:
			if not k in KEYS:
				error = "%s: unknown key %s (only %s)" % [where, k, KEYS]
				return error
		if e.has("post"):
			if not (e.post is String and _is_kind(e.post)):
				error = where + ": post must be a kind name (one word, no _)"
				return error
			s.post = e.post
		if e.has("item"):
			var it = e.item
			if not (it is Dictionary and it.get("type") is String and String(it.type).begins_with("held_") and it.get("hand") in HANDS and it.size() == 2):
				error = "%s: item must be {type: held_<name>, hand: one of %s}" % [where, HANDS]
				return error
			s.item = {"type": it.type, "hand": it.hand}
		if e.has("partner"):
			var pa = e.partner
			if not (pa is Dictionary and pa.get("clip") is String and pa.clip != clip and pa.get("at") is Array and pa.at.size() == 2 \
					and _is_number(pa.at[0]) and _is_number(pa.at[1]) and _is_number(pa.get("yaw")) \
					and (pa.size() == 3 or (pa.size() == 4 and pa.has("reverse_preview"))) and pa.get("reverse_preview", true) is bool):
				error = where + ": partner must be {clip: another clip, at: [x, z], yaw: degrees, optional reverse_preview: bool}"
				return error
			s.partner = {"clip": pa.clip, "at": Vector2(pa.at[0], pa.at[1]), "yaw": float(pa.yaw)}
			if pa.has("reverse_preview"):
				s.partner.reverse_preview = pa.reverse_preview
		if e.has("contacts"):
			if not (e.contacts is Array and not e.contacts.is_empty()):
				error = where + ": contacts must be a non-empty list"
				return error
			var list := []
			for c in e.contacts:
				var ok: bool = c is Dictionary and c.get("joint") in CONTACT_JOINTS and c.get("to") is String and c.to != ""
				for k in c if c is Dictionary else {}:
					ok = ok and k in ["joint", "to", "time", "ramp", "release", "on"]
				if ok and c.has("time"):
					ok = c.time is Array and c.time.size() == 2 and _is_number(c.time[0]) and _is_number(c.time[1]) and c.time[0] <= c.time[1]
				if ok and c.has("on"):
					ok = c.on == "top"
				if ok and c.has("ramp"):
					ok = c.has("time") and _is_number(c.ramp) and c.ramp >= 0
				if ok and c.has("release"):
					ok = c.has("time") and _is_number(c.release) and c.release >= 0
				if not ok:
					error = "%s: a contact must be {joint: one of %s, to: a marker name or item:<node>, optional time: [from, to] seconds, optional ramp and release: seconds (with time)}" % [where, CONTACT_JOINTS]
					return error
				if String(c.to).begins_with("item:") and not e.has("item"):
					error = where + ": a contact to item:... needs an item"
					return error
				if not String(c.to).begins_with("item:") and not e.has("post"):
					error = where + ": a contact to an object marker needs a post"
					return error
				list.append(c.duplicate(true))
			s.contacts = list
		if e.has("stationary"):
			if not (e.stationary is bool and e.stationary):
				error = where + ": stationary must be true (leave it out otherwise)"
				return error
			s.stationary = true
		if e.has("pose"):
			if e.has("contacts"):
				error = where + ": a pose replaces contacts"
				return error
			var pe := _pose_error(e.pose)
			if pe != "":
				error = "%s: pose: %s" % [where, pe]
				return error
			s.pose = e.pose.duplicate(true)
		checked[clip] = s
	clips = checked
	return ""

static func _is_number(v) -> bool:
	return v is float or v is int

## "" or what is wrong with a pose declaration (its form only; markers are checked when the clip is built).
static func _pose_error(p) -> String:
	if not (p is Dictionary and _is_number(p.get("seconds")) and p.seconds > 0):
		return "must be an object with seconds > 0"
	for k in p:
		if not k in POSE_KEYS:
			return "unknown key %s (only %s)" % [k, POSE_KEYS]
	for k in ["seat", "back"]:
		if p.has(k) and not (p[k] is String and p[k] != ""):
			return k + " must be a marker name"
	if p.has("back") and not p.has("seat"):
		return "back needs seat"
	if p.has("feet") and not (p.feet is Array and p.feet.size() == 2 and p.feet.all(func(x): return x is String and x != "")):
		return "feet must be [left marker, right marker]"
	if p.has("life") and not p.life is bool:
		return "life must be true or false"
	if p.has("show") and not (p.show is Array and p.show.size() == 2 and _is_number(p.show[0]) and _is_number(p.show[1]) and p.show[0] <= p.show[1]):
		return "show must be [from, to] seconds"
	if p.has("rest") and not (p.rest is String and p.rest != ""):
		return "rest must be a marker name"
	for c in (p.carry if p.get("carry") is Array else [null]) if p.has("carry") else []:
		if not (c is Dictionary and c.get("part") is String and c.get("hand") in ["left", "right"] and c.get("time") is Array 				and c.time.size() == 2 and _is_number(c.time[0]) and _is_number(c.time[1]) and c.time[0] <= c.time[1]):
			return "carry must be a list of {part: object node, hand: left|right, time: [pick, drop]}"
	var lists := {}
	for k in ["hip", "lean", "tilt", "look", "wrist"]:
		if p.has(k):
			lists[k] = p[k]
	if p.has("hands"):
		if not (p.hands is Dictionary and not p.hands.is_empty() and p.hands.keys().all(func(x): return x in ["left", "right"])):
			return "hands must be {left and/or right: keys}"
		for side in p.hands:
			lists["hands." + side] = p.hands[side]
	if p.has("hip") and not p.has("seat"):
		return "hip needs seat"
	for k in lists:
		var keys = lists[k]
		if not (keys is Array and not keys.is_empty()):
			return k + " must be a non-empty list of [seconds, value]"
		var last := -INF
		for key in keys:
			if not (key is Array and key.size() >= 2 and _is_number(key[0]) and key[0] >= last and key[0] <= p.seconds):
				return "%s: keys must be [seconds, value] in order, within 0..seconds" % k
			last = key[0]
			var v = key[1]
			var ok: bool
			match k:
				"hip": ok = v in ["stand", "seat"] and key.size() == 2
				"lean", "tilt", "wrist": ok = _is_number(v) and key.size() == 2
				"look": ok = v is String and v != "" and key.size() == 2
				_: ok = v is String and v != "" and (key.size() == 2 or (key.size() == 3 and key[2] == "hit"))
			if not ok:
				return "%s: bad key %s" % [k, JSON.stringify(key)]
	return ""

static func _is_kind(k: String) -> bool:
	return k != "" and not "_" in k and not " " in k

## Every types/*.tscn: the Marker3D post_<kind>[_<n>] nodes and the root node's groups.
func _scan_types() -> void:
	var marker := RegEx.create_from_string('\\[node name="(post_[^"]*)" type="Marker3D"')
	var root := RegEx.create_from_string('\\[node name="[^"]*" type="[^"]*"( groups=\\[([^\\]]*)\\])?\\]')
	var files := Array(DirAccess.get_files_at(TYPES_DIR)).filter(func(f): return f.ends_with(".tscn"))
	files.sort()
	for f in files:
		var path: String = TYPES_DIR + f
		var text := FileAccess.get_file_as_string(path)
		var info := {"posts": {}, "groups": []}
		var r := root.search(text)
		if r != null and r.get_string(2) != "":
			for g in r.get_string(2).split(","):
				info.groups.append(g.strip_edges().trim_prefix('"').trim_suffix('"'))
		for m in marker.search_all(text):
			var name := m.get_string(1)
			var kind := name.split("_")[1] if name.split("_").size() > 1 else ""
			if not _is_kind(kind):
				error = "%s: marker %s has no post kind (post_<kind>[_<n>])" % [path, name]
				return
			info.posts[name] = kind
			if not offers.has(kind):
				offers[kind] = []
			if not path in offers[kind]:
				offers[kind].append(path)
		types[path] = info

func type_path(name: String) -> String:
	return TYPES_DIR + name + ".tscn"

## Paths of every types/held_*.tscn.
func held_types() -> Array:
	return types.keys().filter(func(t): return String(t).get_file().begins_with("held_"))

func post_of(clip: String) -> String:
	return clips.get(clip, {}).get("post", "")

## What the clip's declaration names that does not exist yet (empty when all is there).
func missing(clip: String) -> Array[String]:
	var out: Array[String] = []
	var s: Dictionary = clips.get(clip, {})
	if s.has("post") and not offers.has(s.post):
		out.append("no object type has a post_%s marker" % s.post)
	if s.has("item") and not types.has(type_path(s.item.type)):
		out.append("no %s" % type_path(s.item.type))
	if s.has("partner") and not FileAccess.file_exists("%s/%s.json" % [MOTION_DIR, s.partner.clip]):
		out.append("no partner clip %s/%s.json" % [MOTION_DIR, s.partner.clip])
	return out

## A clip used where a person plays it: `kind` is the post kind of the place ("" = not at a post).
## A clip declared for a post kind may only be used at that kind. Returns "" or the error.
func check_use(clip: String, kind: String, where: String) -> String:
	var want := post_of(clip)
	if want != "" and want != kind:
		return "%s: clip %s is declared for post:%s in %s, so it can only be used there (here: %s)" % [where, clip, want,
			PATH, "post:" + kind if kind != "" else "not at a post"]
	return ""

## The partner of `clip` moved to `at` (metres, x and z in the clip person's frame): written to the file.
func set_partner_at(clip: String, at: Vector2) -> String:
	clips[clip].partner.at = Vector2(snappedf(at.x, 0.001), snappedf(at.y, 0.001))
	return _write()

func _write() -> String:
	var lines := ["{", '  "_note": %s,' % JSON.stringify(note), '  "clips": {']
	var names := clips.keys()
	for i in names.size():
		var s: Dictionary = clips[names[i]]
		var parts := []
		for k in KEYS:
			if s.has(k):
				parts.append('"%s": %s' % [k, _one_line(s[k])])
		lines.append('    "%s": { %s }%s' % [names[i], ", ".join(parts), "," if i < names.size() - 1 else ""])
	lines.append_array(["  }", "}", ""])
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f == null:
		return "cannot write " + PATH
	f.store_string("\n".join(lines))
	f.close()
	return ""

static func _one_line(v) -> String:
	if v is Dictionary:
		var parts := []
		for k in v:
			parts.append('"%s": %s' % [k, _one_line(v[k])])
		return "{ %s }" % ", ".join(parts)
	if v is Vector2:
		return "[%s, %s]" % [_num(v.x), _num(v.y)]
	if v is float or v is int:
		return _num(v)
	return JSON.stringify(v)

static func _num(x: float) -> String:
	return str(int(x)) if x == roundf(x) else str(snappedf(x, 0.001))
