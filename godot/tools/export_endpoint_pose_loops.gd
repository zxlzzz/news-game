## Rebuild standalone endpoint loops from actual corrected preview poses.
## Each resource can be loaded and sampled independently of the source clip.
extends SceneTree

const Loop := preload("res://npc/endpoint_pose_loop.gd")
const Model := preload("res://npc/animal_model.gd")
const AnimalClip := preload("res://tools/animal_clip_preview.gd")
const Bird := preload("res://npc/pigeon_motion.gd")
const DIRECTORY := "res://npc/pose_loops"
var catalog := {"format": "endpoint_hold_v1", "clips": {}}
var level

func same(a, b) -> bool:
	if a is Vector3: return a.distance_to(b) < 0.000001
	if a is Transform3D: return a.is_equal_approx(b)
	if a is float: return absf(a-b) < 0.000001
	if a is Dictionary:
		if a.size() != b.size(): return false
		for key in a:
			if not b.has(key) or not same(a[key],b[key]): return false
		return true
	if a is Array:
		if a.size() != b.size(): return false
		for i in a.size():
			if not same(a[i],b[i]): return false
		return true
	return a == b

func _initialize() -> void:
	call_deferred("run")

func write_loop(id: String, kind: String, pose_: Dictionary, context: Dictionary, endpoint: String) -> String:
	var path := DIRECTORY+"/"+id.validate_filename()+"__"+endpoint+".tres"
	var resource := Loop.new()
	resource.source = id
	resource.actor_kind = kind
	resource.endpoint = endpoint
	resource.frames.assign([pose_.duplicate(true), pose_.duplicate(true)])
	resource.context = context
	assert(ResourceSaver.save(resource,path) == OK, "cannot save "+path)
	var loaded = load(path)
	assert(same(loaded.sample(0.0),pose_) and same(loaded.sample(100.5),pose_), "loop changed its endpoint: "+path)
	return path

func run() -> void:
	var args := OS.get_cmdline_user_args()
	assert(args.is_empty() or (args.size()==1 and args[0]=="human"),"Optional export scope must be human")
	var human_only := not args.is_empty()
	if human_only:
		catalog = JSON.parse_string(FileAccess.get_file_as_string(DIRECTORY+"/index.json"))
		assert(catalog is Dictionary and catalog.has("clips"),"Human-only refresh requires the existing catalog")
	DirAccess.make_dir_recursive_absolute(DIRECTORY)
	level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.playing = false
	level.set_process(false)
	var st = level.stage
	for entry in st.entries:
		if entry.kind == "mover": continue
		if human_only and entry.kind != "clip": continue
		var choices: Array = Model.breeds(entry.species) if entry.kind == "animal" else [""]
		for breed in choices:
			var opts := {"breed": breed} if breed != "" else {}
			assert(st.select(entry.id,opts) == "", st.error)
			var id: String = breed+"__"+entry.clip if breed != "" else entry.id
			var record := {"preview": entry.id, "options": opts, "duration": st.cycle}
			for endpoint in ["start", "end"]:
				st.seek(0.0 if endpoint == "start" else st.cycle)
				var pose_: Dictionary
				var context := {}
				match entry.kind:
					"clip":
						pose_ = st.main.pose.duplicate(true)
						context = {"root": st.main.root, "body_scale": st.body_scale,
							"setup": st.setup.clips.get(entry.id,{}), "options": st.options,
							"drawing_params": st.main.clip.P, "requires_context": not st.setup.clips.get(entry.id,{}).is_empty()}
					"animal":
						pose_ = AnimalClip.pose(st.ms.m, entry.clip, st.t)
						context = {"breed": breed, "glb": Model.config().breeds[breed].glb}
					"pigeon_motion":
						pose_ = st.ms.pose.duplicate(true)
						context = {"params": st.ms.p, "root": st.ms.fig.transform}
				record[endpoint] = write_loop(id,entry.kind,pose_,context,endpoint)
			catalog.clips[id] = record
	var file := FileAccess.open(DIRECTORY+"/index.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(catalog,"\t"))
	file.close()
	print("ENDPOINT_LOOPS_OK ",catalog.clips.size()," actions, ",catalog.clips.size()*2," independent loops")
	quit(0)
