## Mapping check (run by tools/check_mapping.gd): recompute the frames listed in npc/mapping_reference.json with
## skeleton_mapping.gd and compare every output coordinate with what the original skeleton-mapping.mjs
## produced for the same data (tools/make_mapping_reference.mjs). Prints MAPPING_OK when the largest
## absolute difference is below TOLERANCE, otherwise MAPPING_FAIL and the worst point. Returns the exit code.
extends RefCounted

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
const REFERENCE_PATH := "res://npc/mapping_reference.json"
const TOLERANCE := 1e-4
const POINTS := ["H", "N", "neckEnd", "head"]

static func run() -> int:
	var got := {}
	var err := NpcData.read_json(REFERENCE_PATH, got)
	if err != "":
		return _fail(err)
	var ref = got["value"]
	err = _check_reference(ref)
	if err != "":
		return _fail(err)
	err = NpcData.load_params(got)
	if err != "":
		return _fail(err)
	var P: Dictionary = got["value"]
	for k in NpcData.PARAM_KEYS:
		if P[k] != ref["params"][k]:
			return _fail("%s: %s is %s, the reference was made with %s; regenerate it with tools/make_mapping_reference.mjs"
				% [NpcData.PARAMS_PATH, k, str(P[k]), str(ref["params"][k])])
	if ref["rest"]["clip"] != NpcData.REST_CLIP or ref["rest"]["frame"] != NpcData.REST_FRAME:
		return _fail("reference rest frame %s differs from %s frame %d" % [str(ref["rest"]), NpcData.REST_CLIP, NpcData.REST_FRAME])
	err = NpcData.load_joint_names(got)
	if err != "":
		return _fail(err)
	var names: Array = got["value"]
	err = NpcData.load_clip(NpcData.REST_CLIP, names.size(), got)
	if err != "":
		return _fail(err)
	var mapper = SkeletonMapper.new(names, got["value"]["frames"][NpcData.REST_FRAME])
	if mapper.error != "":
		return _fail(mapper.error)
	var worst := {"err": -1.0}
	var count := 0
	for c in ref["cases"]:
		err = NpcData.load_clip(c["clip"], names.size(), got)
		if err != "":
			return _fail(err)
		var frames: Array = got["value"]["frames"]
		var fi := int(c["frame"])
		if fi < 0 or fi >= frames.size():
			return _fail("%s has no frame %d" % [c["clip"], fi])
		var f: Dictionary = mapper.mapFrame(frames[fi], P, frames[0][mapper.J["Hips"]])
		var tag := "%s frame %d " % [c["clip"], fi]
		for name in POINTS:
			count += _compare(tag + name, c[name], f[name], worst)
		if f["segs"].size() != c["segs"].size():
			return _fail("%s: %d segments, reference has %d" % [tag, f["segs"].size(), c["segs"].size()])
		for si in c["segs"].size():
			count += _compare(tag + "segs[%d].start" % si, c["segs"][si][0], f["segs"][si][0], worst)
			count += _compare(tag + "segs[%d].end" % si, c["segs"][si][1], f["segs"][si][1], worst)
			count += _compare(tag + "segs[%d].widthMultiplier" % si, [c["segs"][si][2]], [f["segs"][si][2]], worst)
	if count == 0:
		return _fail("reference has nothing to compare")
	if worst["err"] < TOLERANCE:
		print("MAPPING_OK max_err=%s over %d values in %d frames (tolerance %s)"
			% [String.num_scientific(worst["err"]), count, ref["cases"].size(), String.num_scientific(TOLERANCE)])
		return 0
	print("MAPPING_FAIL max_err=%s at %s expected=%s got=%s (tolerance %s)"
		% [String.num_scientific(worst["err"]), worst["label"], str(worst["expected"]), str(worst["got"]), String.num_scientific(TOLERANCE)])
	return 1

## Largest |got - expected| over the coordinates of one point goes into worst (NaN counts as infinite).
static func _compare(label: String, expected: Array, got: Array, worst: Dictionary) -> int:
	for i in expected.size():
		var e := absf(float(got[i]) - float(expected[i]))
		if is_nan(e):
			e = INF
		if e > worst["err"]:
			worst["err"] = e
			worst["label"] = label
			worst["expected"] = expected
			worst["got"] = got
	return expected.size()

static func _check_reference(ref) -> String:
	if not (ref is Dictionary) or not ref.has("params") or not ref.has("rest") or not ref.has("cases"):
		return REFERENCE_PATH + ": needs params, rest and cases"
	for c in ref["cases"]:
		for k in ["clip", "frame", "segs"] + POINTS:
			if not c.has(k):
				return "%s: a case lacks %s" % [REFERENCE_PATH, k]
	return ""

static func _fail(msg: String) -> int:
	print("MAPPING_FAIL ", msg)
	return 1
