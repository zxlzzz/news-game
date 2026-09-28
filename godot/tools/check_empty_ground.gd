## Places every entry of the empty ground list once, headless (scenes/empty_ground/stage.gd), and plays it
## through its cycle: each clip with what npc/clip-setup.json names (and again with every other object type
## that offers its post), every held type in a hand, every mover and animal action. Entries whose setup
## names something that does not exist yet are printed with what is missing; any other error fails.
## Also: every models/held_*.glb has its types/held_*.tscn, and the .tscn transform writer changes only
## the one line (tried on a copy in memory, nothing is written).
##   godot --headless --path . -s res://tools/check_empty_ground.gd   -> EMPTY_GROUND_OK / EMPTY_GROUND_FAIL
extends SceneTree

const SCENE := "res://scenes/empty_ground/level.tscn"
const Stage := preload("res://scenes/empty_ground/stage.gd")
## Points of each cycle the entry is shown at.
const SAMPLES := 6

## Frames to wait for the scene to be ready before failing.
const WAIT_FRAMES := 600

var level
var waited := 0
var done := false
var fails: Array[String] = []

func _initialize() -> void:
	level = load(SCENE).instantiate()
	root.add_child.call_deferred(level)

func _process(_d: float) -> bool:
	if done:
		return true
	if level == null or not level.is_inside_tree() or level.get("stage") == null:
		waited += 1
		if waited > WAIT_FRAMES:
			_fail("%s did not start (see the errors above)" % SCENE)
			done = true
			return _finish()
		return false
	done = true
	level.set_process(false)
	var st = level.stage
	if st.error != "":
		_fail(st.error)
		return _finish()
	_check_held_types(st)
	_check_writer()
	var missing := 0
	for e in st.entries:
		if not e.missing.is_empty():
			missing += 1
			print("MISSING %s: %s" % [e.id, "; ".join(e.missing)])
		_play(st, e.id, {})
		if e.kind != "clip":
			continue
		for type in st.object_choices():
			if type != st.object_type():
				_play(st, e.id, {"object": type})
	# every held type once in a hand, on the first clip that holds something
	var holder := ""
	for c in st.setup.clips:
		if st.setup.clips[c].has("item") and st.setup.missing(c).is_empty():
			holder = c
			break
	if holder == "":
		_fail("no clip in npc/clip-setup.json holds an item")
	else:
		for held in st.setup.held_types():
			_play(st, holder, {"item": held})
	print("%d entries (%d clips), %d with something missing" % [st.entries.size(),
		st.entries.filter(func(e): return e.kind == "clip").size(), missing])
	return _finish()

func _play(st, id: String, opts: Dictionary) -> void:
	var where := "%s %s" % [id, opts if not opts.is_empty() else ""]
	var err: String = st.select(id, opts)
	if err != "":
		_fail("%s: %s" % [where, err])
		st.error = ""
		return
	var e: Dictionary = st.entry
	if e.kind == "clip":
		_check_clip(st, e, opts, where)
	var gaps := []
	for i in SAMPLES + 1:
		st.seek(st.cycle * i / SAMPLES)
		if st.error != "":
			_fail("%s at %.2f s: %s" % [where, st.t, st.error])
			st.error = ""
			return
		for o in st.objects:
			if o.pusher != null:
				gaps.append(o.node.transform.origin - o.pusher.root.origin)
	# a pushed object keeps its place in front of the person while both move
	for g in gaps:
		if not g.is_equal_approx(gaps[0]) and st.main.root.basis.is_equal_approx(Basis()):
			_fail("%s: the pushed object does not keep its place relative to the person" % where)
			break
	for person in st.people:
		if person.pose.is_empty() or not person.root.origin.is_finite():
			_fail("%s: a person was not posed" % where)
	if not st.ms.is_empty() and not st.ms.focus.is_finite():
		_fail("%s: the mover left the ground (focus %s)" % [where, st.ms.focus])

## What the setup names is there (unless it is listed missing).
func _check_clip(st, e: Dictionary, opts: Dictionary, where: String) -> void:
	var first: String = st._first_clip()
	var s: Dictionary = st.setup.clips.get(first, {})
	var auto: Array = st.people.filter(func(q): return not q.manual)
	var objs: Array = st.objects.filter(func(o): return not o.manual)
	if st.main == null or st.main.clip_id != e.clip:
		_fail("%s: the selected clip is not played" % where)
	if s.has("post") and st.setup.offers.has(s.post):
		if objs.size() != 1:
			_fail("%s: expected one object offering post %s, got %d" % [where, s.post, objs.size()])
		elif objs[0].pusher == null and (auto[0].anchor == null or not auto[0].anchor.has("object")):
			_fail("%s: the person is not on the object's post" % where)
	elif not objs.is_empty():
		_fail("%s: an object was placed without a post" % where)
	var holds: bool = s.has("item") and (opts.has("item") or st.setup.types.has(st.setup.type_path(s.item.type)))
	if holds != (auto[0].item != null):
		_fail("%s: item %s" % [where, "missing" if holds else "not declared but placed"])
	elif holds and auto[0].item.node.get_node_or_null("model") == null:
		_fail("%s: %s has no model node" % [where, auto[0].item.type])
	var pair: bool = s.has("partner") and st.setup.missing(first).all(func(x): return not x.begins_with("no partner"))
	if auto.size() != (2 if pair else 1):
		_fail("%s: %d people placed, expected %d" % [where, auto.size(), 2 if pair else 1])

func _check_held_types(st) -> void:
	for f in DirAccess.get_files_at("res://models"):
		if f.begins_with("held_") and f.ends_with(".glb"):
			var type: String = st.setup.type_path(f.get_basename())
			if not st.setup.types.has(type):
				_fail("models/%s has no %s" % [f, type])

func _check_writer() -> void:
	var path := "res://types/bench.tscn"
	var text := FileAccess.get_file_as_string(path)
	var xf := Transform3D(Basis(Vector3.UP, PI / 2), Vector3(0.1, 0, -0.25))
	var out := Stage.set_transform_text(text, "post_sit_0", xf)
	var a := text.replace("\r\n", "\n").split("\n")
	var b := out.replace("\r\n", "\n").split("\n")
	var changed := 0
	for i in mini(a.size(), b.size()):
		if a[i] != b[i]:
			changed += 1
	var want := "transform = " + Stage.transform_text(xf)
	if out == "" or a.size() != b.size() or changed != 1 or not want in b:
		_fail("tscn writer: setting post_sit_0 in %s did not change exactly its transform line" % path)
	if Stage.transform_text(xf) != "Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 0.1, 0, -0.25)":
		_fail("tscn writer: a 90 degree yaw is written as %s (rows of the basis, then the origin)" % Stage.transform_text(xf))
	if Stage.set_transform_text(text, "no_such_node", xf) != "":
		_fail("tscn writer: an unknown node was not refused")

func _fail(msg: String) -> void:
	fails.append(msg)
	printerr("EMPTY_GROUND: " + msg)

func _finish() -> bool:
	if fails.is_empty():
		print("EMPTY_GROUND_OK")
		quit(0)
	else:
		printerr("EMPTY_GROUND_FAIL: %d problems" % fails.size())
		quit(1)
	return true
