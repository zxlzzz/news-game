## Audit dump (delivery/human_motion_audit/): for every clip entry of the empty ground, the poses at
## sampled times, for comparing stages. Writes JSON, changes nothing.
##   godot --headless --path . -s res://tools/audit_dump.gd -- <out.json> [samples] [clip ...] [--patch=<json>]
## pre: the clip's own ClipPose (mapping + foot pitch); final: after interactions and ground contact.
## things: item / props / objects as oriented box corners in the person's figure frame.
## --patch: {clip: config | null} replaces (or removes) interactions.json entries for this run only.
extends SceneTree

const SCENE := "res://scenes/empty_ground/level.tscn"
const Bounds := preload("res://core/bounds.gd")
var level
var done := false
var waited := 0

func _initialize() -> void:
	level = load(SCENE).instantiate()
	root.add_child.call_deferred(level)

func _v(v: Vector3) -> Array:
	return [snappedf(v.x, 1e-5), snappedf(v.y, 1e-5), snappedf(v.z, 1e-5)]

func _pose(p: Dictionary) -> Dictionary:
	var segs := []
	for s in p.segs:
		segs.append([_v(s[0]), _v(s[1])])
	return {"segs": segs, "head": _v(p.head), "neck": _v(p.neck), "handLeft": _v(p.handLeft), "handRight": _v(p.handRight)}

func _box(node: Node3D, inv: Transform3D) -> Array:
	var acc := {"box": AABB(), "any": false}
	Bounds._walk(node, Transform3D.IDENTITY, acc)
	var b: AABB = acc.box
	var out := []
	for i in 8:
		out.append(_v(inv * (node.global_transform * b.get_endpoint(i))))
	return out

func _process(_d: float) -> bool:
	if done:
		return true
	if level == null or not level.is_inside_tree() or level.get("stage") == null:
		waited += 1
		return waited > 600
	done = true
	level.set_process(false)
	var args := OS.get_cmdline_user_args()
	var out_path: String = args[0]
	var samples: int = int(args[1]) if args.size() > 1 else 24
	var only: Array = []
	var patch := {}
	for a in args.slice(2):
		if a.begins_with("--patch="):
			patch = JSON.parse_string(FileAccess.get_file_as_string(a.substr(8)))
		else:
			only.append(a)
	var st = level.stage
	for id in patch:
		if patch[id] == null:
			st.interactions.data.clips.erase(id)
		else:
			st.interactions.data.clips[id] = patch[id]
	var result := {}
	for e in st.entries:
		if e.kind != "clip":
			continue
		if not only.is_empty() and not e.id in only:
			continue
		var err: String = st.select(e.id, {})
		if err != "":
			result[e.id] = {"error": err}
			st.error = ""
			continue
		var rec := {"cycle": st.cycle, "frames": []}
		for k in samples:
			var t: float = st.cycle * k / samples
			st.seek(t)
			var fr := {"t": t, "people": []}
			for person in st.people:
				var inv: Transform3D = person.fig.global_transform.affine_inverse()
				var cfg: Dictionary = st.interactions.data.clips.get(person.clip_id, {})
				var phase: float = st.interactions.phase_of(person, t)
				var src_phase: float = minf(phase, float(person.clip.count-1)/person.clip.count) if cfg.get("playback","")=="once" else phase
				var pd := {"clip": person.clip_id, "phase": phase, "main": person == st.main,
					"pre": _pose(person.clip.pose(src_phase)), "final": _pose(person.pose),
					"root": [_v(person.root.origin), _v(person.root.basis.z)], "things": []}
				if person.item != null:
					pd.things.append({"name": person.item.type.get_file(), "box": _box(person.item.node, inv), "visible": person.item.node.visible})
				for pr in person.get("props", []):
					pd.things.append({"name": pr.track.type, "box": _box(pr.node, inv), "visible": pr.node.visible})
				if person == st.main:
					for o in st.objects:
						pd.things.append({"name": o.type.get_file(), "box": _box(o.node, inv), "visible": o.node.visible, "object": true})
				fr.people.append(pd)
			rec.frames.append(fr)
		result[e.id] = rec
	var f := FileAccess.open(out_path, FileAccess.WRITE)
	f.store_string(JSON.stringify(result))
	f.close()
	print("AUDIT_DUMP_DONE %d" % result.size())
	quit()
	return true
