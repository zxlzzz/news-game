## NPC data files and their validated loading, shared by the stick NPC and --check-mapping.
## Every loader returns "" on success (the result in out["value"]) or an error message; nothing is
## defaulted, a missing or malformed file or field is an error.
extends RefCounted

## Copy of news-game sth/motion-study/skeleton-params.json (12 mapping parameters).
const PARAMS_PATH := "res://npc/skeleton-params.json"
## Written by news-game scripts/export-npc-motion.py: index.json + one <clip>.json per npz clip.
const MOTION_DIR := "res://npc/motion"
## Mapping spec section 3.5: the rest-pose head lean is taken from stand_idle frame 0.
const REST_CLIP := "stand_idle"
const REST_FRAME := 0
const PARAM_KEYS := ["headR", "neck", "torso", "clavSplit", "minSpread", "upperArm", "foreArm",
	"thigh", "shin", "foot", "line", "torsoLine"]

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
