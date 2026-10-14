## The export step (docs/动作重做方案.md §4.3): bake clips of npc/motion into npc/baked (npc/motion_bake.gd).
##   godot --headless --path . -s res://tools/bake_motion.gd                 bake every clip -> BAKE_OK
##   godot --headless --path . -s res://tools/bake_motion.gd -- walk sit_bench   only these clips
##   godot --headless --path . -s res://tools/bake_motion.gd -- --check      write nothing; BAKE_OK or BAKE_STALE
## Baking every clip also removes baked files whose clip is gone. When a baked clip already existed, the
## largest move of any stored point is printed (metres at the adult body scale): every clip listed under
## "changed" looks different now and has to be looked at again (docs/动作重做方案.md §4.7).
## For a clip with contacts (npc/clip-setup.json) it prints how far each contact moved its joint (metres); a contact
## beyond motion-bake.json maxCorrection is listed under "generate again" (§4.3 step 3).
## "cuts into objects": the figure still cuts into its post's object or held thing by more than 1 cm; "left alone" names
## the ends the export did not push out (too deep, motion-bake.json clearMax / clearMove): generate the clip again.
## "jumps": a stored point moves in one frame farther than motion-bake.json jumpMin and jumpRatio times its steps in
## the frames around it (the body twitches). "(the source jumps too)": the generation did it, generate again; otherwise
## the export did it, and the export is what to fix (2026-10-14: its push-out made 87 clips tremble).
extends SceneTree

const Bake := preload("res://npc/motion_bake.gd")
const NpcData := preload("res://npc/npc_data.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")
## A stored point moving less than this (metres at adult scale) is not a visible change.
const CHANGED_M := 0.002

func _initialize() -> void:
	var args := Array(OS.get_cmdline_user_args())
	var check := args.has("--check")
	var only: Array = args.filter(func(a): return a != "--check")
	var got := {}
	var e := NpcData.read_json(NpcData.MOTION_DIR + "/index.json", got)
	if e != "":
		_fail(e)
		return
	var all: Array = got.value.clips.map(func(c): return c.id)
	for id in only:
		if not id in all:
			_fail("no clip %s in %s/index.json" % [id, NpcData.MOTION_DIR])
			return
	var ids: Array = only if not only.is_empty() else all
	var bodies = JSON.parse_string(FileAccess.get_file_as_string("res://npc/body-types.json"))
	var crowd = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	var scale: float = bodies[crowd.body].scale
	var setup = ClipSetup.shared()
	if setup.error != "":
		_fail(setup.error)
		return
	e = NpcData.read_json(Bake.PARAMS, got)
	if e != "":
		_fail(e)
		return
	var B: Dictionary = got.value
	e = NpcData.load_joint_names(got)
	if e != "":
		_fail(e)
		return
	var joint_count: int = got.value.size()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(Bake.BAKED_DIR))
	var stale := []
	var changed := []
	var again := []
	var cut := []
	var jumpy := []
	for id in ids:
		var path := "%s/%s.json" % [Bake.BAKED_DIR, id]
		var old = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
		if check:
			if not (old is Dictionary) or old.get("inputs", "") != Bake.fingerprint(id, setup):
				stale.append(id)
			continue
		var r: Dictionary = Bake.bake(id)
		if r.error != "":
			_fail("%s: %s" % [id, r.error])
			return
		if not r.report.is_empty():
			print("%s contacts: moved %s, miss while holding %s, out of reach after the fix %s, held thing moved forward %.3f m" % [id, r.report.moved_m, r.report.miss_m, r.report.left_m, r.report.item_shift_m])
			for key in r.report.over:
				again.append("%s %s (%.3f m)" % [id, key, r.report.moved_m[key]])
		if not r.collision.is_empty() and r.collision.max_m > 0.01:
			var deep: String = "; left alone %s" % r.collision.too_deep_m if r.collision.has("too_deep_m") else ""
			cut.append("%s %.3f m (%s into %s, frame %d; pushed out up to %.3f m%s)" % [id, r.collision.max_m, r.collision.part, r.collision.into, r.collision.frame, r.collision.get("cleared_m", 0.0), deep])
		var mine := _jumps(_metres(r.data.points, scale), B)
		if not mine.is_empty():
			e = NpcData.load_clip(id, joint_count, got)
			if e != "":
				_fail(e)
				return
			var source := {}
			for j in _jumps(got.value.frames.map(func(f): return f.map(func(q): return Vector3(q[0], q[1], q[2]))), B):
				source[j[0]] = true
			var worst: Array = mine[0]
			var frames := {}
			var also := false
			for j in mine:
				frames[j[0]] = true
				also = also or source.has(j[0] - 1) or source.has(j[0]) or source.has(j[0] + 1)
				if j[2] > worst[2]:
					worst = j
			jumpy.append("%s %d frames, worst %.2f m %s at frame %d%s" % [id, frames.size(), worst[2], Bake.POINTS[worst[1]], worst[0], " (the source jumps too)" if also else ""])
		if old is Dictionary:
			var moved := _largest_move(old, r.data) * scale
			if moved >= CHANGED_M:
				changed.append("%s (%.3f m)" % [id, moved])
		var f := FileAccess.open(path, FileAccess.WRITE)
		if f == null:
			_fail("cannot write " + path)
			return
		f.store_string(JSON.stringify(r.data) + "\n")
		f.close()
	if check:
		if stale.is_empty():
			print("BAKE_OK (%d clips current)" % ids.size())
			quit(0)
		else:
			print("stale or missing: ", " ".join(stale))
			print("BAKE_STALE (%d of %d) — run tools/bake_motion.gd" % [stale.size(), ids.size()])
			quit(1)
		return
	if only.is_empty():
		for file in DirAccess.get_files_at(Bake.BAKED_DIR):
			if file.ends_with(".json") and not file.get_basename() in all:
				DirAccess.remove_absolute(ProjectSettings.globalize_path(Bake.BAKED_DIR + "/" + file))
				print("removed baked file of a clip that is gone: ", file)
	if not changed.is_empty():
		print("changed (look again): ", ", ".join(changed))
	if not cut.is_empty():
		print("cuts into objects (more than 1 cm): ", ", ".join(cut))
	if not again.is_empty():
		print("generate again (contact moved a joint too far): ", ", ".join(again))
	if not jumpy.is_empty():
		print("jumps (look at these frames): ", ", ".join(jumpy))
	print("BAKE_OK (%d clips baked)" % ids.size())
	quit(0)

## The stored points of a baked clip in metres: per frame an Array of Vector3.
static func _metres(points: Array, scale: float) -> Array:
	var out := []
	for row in points:
		var q := []
		for k in range(0, row.size(), 3):
			q.append(Vector3(row[k], row[k + 1], row[k + 2]) * scale)
		out.append(q)
	return out

## Where points jump (frames: per frame an Array of Vector3, metres): a step from one frame to the next longer than
## B.jumpMin and B.jumpRatio times the median of the point's steps in the three frames before and after.
## [[frame, point index, metres]...]
static func _jumps(frames: Array, B: Dictionary) -> Array:
	var out := []
	var n := frames.size()
	if n < 3:
		return out
	for k in frames[0].size():
		var steps := []
		for i in n - 1:
			steps.append(frames[i][k].distance_to(frames[i + 1][k]))
		for i in steps.size():
			if steps[i] <= B.jumpMin:
				continue
			var around := []
			for j in range(maxi(0, i - 3), mini(steps.size(), i + 4)):
				if j != i:
					around.append(steps[j])
			around.sort()
			var m := around.size()
			var median: float = around[m / 2] if m % 2 == 1 else (around[m / 2 - 1] + around[m / 2]) * 0.5
			if steps[i] > B.jumpRatio * maxf(median, 0.001):
				out.append([i, k, steps[i]])
	return out

## Largest distance any stored point moved (figure units); a different frame count counts as everything.
static func _largest_move(a: Dictionary, b: Dictionary) -> float:
	if a.get("frames", 0) != b.frames or a.get("points", []).size() != b.points.size():
		return INF
	var most := 0.0
	for i in b.points.size():
		var p: Array = a.points[i]
		var q: Array = b.points[i]
		for k in range(0, q.size(), 3):
			most = maxf(most, Vector3(p[k], p[k + 1], p[k + 2]).distance_to(Vector3(q[k], q[k + 1], q[k + 2])))
	return most

func _fail(msg: String) -> void:
	printerr(msg)
	print("BAKE_FAIL")
	quit(1)
