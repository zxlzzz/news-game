## NPC data files and their validated loading, shared by the stick NPC and --check-mapping.
## Every loader returns "" on success (the result in out["value"]) or an error message; nothing is
## defaulted, a missing or malformed file or field is an error.
extends RefCounted

## Copy of news-game sth/motion-study/skeleton-params.json (15 mapping parameters).
const PARAMS_PATH := "res://npc/skeleton-params.json"
## Written by news-game scripts/export-npc-motion.py: index.json + one <clip>.json per npz clip.
const MOTION_DIR := "res://npc/motion"
## Mapping spec section 3.5: the rest-pose head lean is taken from stand_idle frame 0.
const REST_CLIP := "stand_idle"
const REST_FRAME := 0
const PARAM_KEYS := ["headR", "neck", "torso", "clavSplit", "minSpread", "upperArm", "foreArm",
	"thigh", "shin", "foot", "line", "torsoLine", "palm", "headTouch", "headFar"]

static func read_json(path: String, out: Dictionary) -> String:
	if not FileAccess.file_exists(path):
		return "missing file " + path
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		return "%s: JSON error at line %d: %s" % [path, json.get_error_line(), json.get_error_message()]
	out["value"] = json.data
	return ""

static func is_number(v) -> bool:
	return v is float or v is int

static func load_params(out: Dictionary) -> String:
	var got := {}
	var err := read_json(PARAMS_PATH, got)
	if err != "":
		return err
	var p = got["value"]
	if not (p is Dictionary):
		return PARAMS_PATH + ": not a JSON object"
	for k in PARAM_KEYS:
		if not p.has(k):
			return "%s: missing %s" % [PARAMS_PATH, k]
		if not is_number(p[k]):
			return "%s: %s is not a number" % [PARAMS_PATH, k]
	out["value"] = p
	return ""

## Hand contact (mapping step 11): every key required, nothing defaulted.
const CONTACT_PATH := "res://npc/hand-contact.json"
const CONTACT_KEYS := ["palm", "smoothSeconds", "elbowFront", "headClear", "upperArmClear", "elbowSamples", "pushMax", "nearShare", "stillSpeed", "speedSeconds", "holdSeconds", "held", "pair", "points"]

static func load_contact(out: Dictionary) -> String:
	var got := {}
	var err := read_json(CONTACT_PATH, got)
	if err != "":
		return err
	var c = got["value"]
	var at := func(where: String, w) -> String:
		if not (w is Dictionary) or w.is_empty():
			return "%s: %s must be a non-empty {joint: weight}" % [CONTACT_PATH, where]
		for j in w:
			if not is_number(w[j]):
				return "%s: %s weight of %s is not a number" % [CONTACT_PATH, where, j]
		return ""
	var vec := func(v) -> bool: return v is Array and v.size() == 3 and v.all(func(x): return is_number(x))
	var near := func(where: String, d) -> String:
		for k in ["near", "band"]:
			if not d.has(k) or not is_number(d[k]):
				return "%s: %s needs a number %s" % [CONTACT_PATH, where, k]
		if d.band <= 0:
			return "%s: %s band must be above 0" % [CONTACT_PATH, where]
		return ""
	if not (c is Dictionary):
		return CONTACT_PATH + ": not a JSON object"
	for k in CONTACT_KEYS:
		if not c.has(k):
			return "%s: missing %s" % [CONTACT_PATH, k]
	for k in ["smoothSeconds", "elbowFront", "headClear", "upperArmClear", "elbowSamples", "pushMax", "nearShare", "stillSpeed", "speedSeconds", "holdSeconds"]:
		if not is_number(c[k]):
			return "%s: %s is not a number" % [CONTACT_PATH, k]
	err = at.call("palm", c.palm)
	if err != "":
		return err
	if not (c.held is Dictionary):
		return CONTACT_PATH + ": held must be {held type: tip marker}"
	for t in c.held:
		if not (c.held[t] is String) or c.held[t] == "":
			return "%s: held.%s must name the type's tip marker" % [CONTACT_PATH, t]
	if not (c.pair is Dictionary):
		return CONTACT_PATH + ": pair must be an object"
	err = near.call("pair", c.pair)
	if err != "":
		return err
	if not (c.points is Dictionary) or c.points.is_empty():
		return CONTACT_PATH + ": points must be a non-empty object"
	for name in c.points:
		var d = c.points[name]
		var where := "points.%s" % name
		if not (d is Dictionary):
			return "%s: %s is not an object" % [CONTACT_PATH, where]
		for k in ["part", "source", "figure", "near", "band"]:
			if not d.has(k):
				return "%s: %s missing %s" % [CONTACT_PATH, where, k]
		if not d.part in ["head", "torso"]:
			return "%s: %s part must be head or torso" % [CONTACT_PATH, where]
		err = near.call(where, d)
		if err != "":
			return err
		if not (d.source is Dictionary) or not d.source.has("at") or not d.source.has("offset"):
			return "%s: %s source needs at and offset" % [CONTACT_PATH, where]
		err = at.call(where + ".source.at", d.source.at)
		if err != "":
			return err
		if not vec.call(d.source.offset):
			return "%s: %s source.offset must be [side, up, forward]" % [CONTACT_PATH, where]
		var f = d.figure
		if not (f is Dictionary):
			return "%s: %s figure is not an object" % [CONTACT_PATH, where]
		if d.part == "head":
			if not f.has("dir") or not vec.call(f.dir) or not f.has("dist") or not is_number(f.dist):
				return "%s: %s figure needs dir [side, up, forward] and dist" % [CONTACT_PATH, where]
		elif f.has("arm"):
			if not f.arm in ["Left", "Right"] or not f.has("at") or not is_number(f.at):
				return "%s: %s figure needs arm Left or Right and a number at" % [CONTACT_PATH, where]
		else:
			for k in ["along", "side", "forward"]:
				if not f.has(k) or not is_number(f[k]):
					return "%s: %s figure needs along, side, forward (or arm and at)" % [CONTACT_PATH, where]
	out["value"] = c
	return ""

## Source joint names, in the order the clip frames store them.
static func load_joint_names(out: Dictionary) -> String:
	var path := MOTION_DIR + "/index.json"
	var got := {}
	var err := read_json(path, got)
	if err != "":
		return err
	var index = got["value"]
	if not (index is Dictionary) or not index.has("names") or not (index["names"] is Array) or index["names"].is_empty():
		return path + ": no names list"
	for n in index["names"]:
		if not (n is String):
			return path + ": joint name is not a string"
	out["value"] = index["names"]
	return ""

## A clip: {"fps": float > 0, "frames": [frame][joint] = [x, y, z]} with joint_count joints per frame.
static func load_clip(clip: String, joint_count: int, out: Dictionary) -> String:
	var path := MOTION_DIR + "/" + clip + ".json"
	var got := {}
	var err := read_json(path, got)
	if err != "":
		return err
	var c = got["value"]
	if not (c is Dictionary) or not c.has("fps") or not c.has("frames"):
		return path + ": needs fps and frames"
	if not is_number(c["fps"]) or c["fps"] <= 0:
		return path + ": fps must be a positive number"
	if not (c["frames"] is Array) or c["frames"].is_empty():
		return path + ": frames must be a non-empty list"
	for fi in c["frames"].size():
		var fr = c["frames"][fi]
		if not (fr is Array) or fr.size() != joint_count:
			return "%s: frame %d does not have %d joints" % [path, fi, joint_count]
		for p in fr:
			if not (p is Array) or p.size() != 3 or not (is_number(p[0]) and is_number(p[1]) and is_number(p[2])):
				return "%s: frame %d has a joint that is not [x, y, z]" % [path, fi]
	out["value"] = c
	return ""
