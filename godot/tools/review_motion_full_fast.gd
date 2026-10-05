## Exhaustive diagnostic capture; optionally hides props after all pose/contact solves.
## Read-only batch capture of actual empty-ground playback. Request supplies entries,
## samples per view, output folder and views. Production assets are never written.
extends SceneTree

var level

func _initialize() -> void:
	call_deferred("run")

func save_json(path: String, data) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	file.store_string(JSON.stringify(data))
	file.close()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		push_error("review_motion_batch: request JSON required")
		quit(1)
		return
	var request = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	if not request is Dictionary or not request.has("entries") or not request.has("output"):
		push_error("review_motion_batch: entries and output required")
		quit(1)
		return
	var out: String = request.output
	var inputs := {}
	for path in request.get("provenance", []):
		assert(FileAccess.file_exists(path), "capture input missing: %s" % path)
		inputs[path] = FileAccess.get_sha256(path)
	# Keep camera projection and resized cells at the same aspect ratio.
	# Resizing a landscape viewport into square cells distorts accepted proportions.
	var viewport_side: int = request.get("viewport", 768)
	root.size = Vector2i(viewport_side, viewport_side)
	DirAccess.make_dir_recursive_absolute(out)
	level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.playing = false
	level.set_process(false)
	level.cam.set_process(false)
	level.cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	for panel in level.find_children("*", "PanelContainer", true, false):
		panel.hide()
	level.ui.caption.add_theme_font_size_override("font_size", 19)
	var st = level.stage
	var default_samples: int = request.get("samples", 24)
	var cols: int = request.get("columns", 6)
	var cell: int = request.get("cell", 256)
	var views: Array = request.get("views", [0.0, 90.0])
	var pitch: float = request.get("pitch", 15.0)
	var manifest := []
	for entry in request.entries:
		var samples: int = entry.get("samples", default_samples) if entry is Dictionary else default_samples
		assert(samples > 0 and cols > 0, "capture sample/column count must be positive")
		var rows: int = ceili(float(samples) / cols)
		var id: String = entry if entry is String else entry.id
		var opts: Dictionary = {} if entry is String else entry.get("options", {})
		var label: String = id.replace(":", "_") if entry is String else entry.get("label", id.replace(":", "_"))
		var err: String = st.select(id, opts)
		if err != "":
			push_error(err)
			quit(1)
			return
		if entry is Dictionary and entry.has("review"):
			push_error("Named motion capture does not accept controller overrides")
			quit(1)
			return
		await process_frame
		var duration: float = st.cycle
		if st.entry.kind == "clip":
			duration = minf(duration, st.interactions.data.clips.get(id, {}).get("duration", st.main.clip.duration()))
		if entry is Dictionary:
			duration = entry.get("duration", duration)
		var start: float = 0.0 if entry is String else entry.get("start", 0.0)
		var source_cycle: float = st.cycle
		# seek clamps to the preview horizon. Expand only the diagnostic horizon so
		# requested second cycles and post-action holds are actually simulated.
		st.cycle = maxf(st.cycle, start + duration)
		var size: float = 3.0 if st.entry.kind == "clip" else st.framing()[1]
		var follow_pose: bool = entry is Dictionary and entry.get("follow_pose", false)
		var target_height: float = (0.0 if follow_pose else 0.85) if st.entry.kind == "clip" else (0.0 if st.entry.kind == "pigeon_motion" else size * 0.18)
		if entry is Dictionary:
			size = entry.get("size", size)
			target_height = entry.get("target_height", target_height)
		var sheet := Image.create(cols * cell, rows * cell * views.size(), false, Image.FORMAT_RGB8)
		var record := {"id": id, "label": label, "options": opts, "cycle": source_cycle, "capture_cycle": st.cycle, "duration": duration, "start": start,
			"views": views, "samples": samples, "columns": cols, "cell": cell, "viewport": [root.size.x, root.size.y], "times": [], "missing": st.entry.missing, "inputs_sha256": inputs, "review_overrides": entry.get("review", {}) if entry is Dictionary else {}}
		for vi in views.size():
			for k in samples:
				var intervals: int = samples-1 if request.get("include_endpoint",false) and samples>1 else samples
				var time: float = start + duration * k / intervals
				st.seek(time)
				var center: Vector3 = st.focus()
				var heading := 0.0
				var view_size: float = size
				if st.entry.kind == "clip":
					center = Vector3.ZERO
					for person in st.people:
						center += person.fig.global_transform * person.pose.segs[0][0] if follow_pose else person.root.origin
					center /= st.people.size()
					center.y += target_height
					var forward: Vector3 = st.main.root.basis.z
					heading = atan2(forward.x, forward.z)
					for person in st.people:
						var person_at: Vector3 = person.fig.global_transform * person.pose.segs[0][0] if follow_pose else person.root.origin
						view_size = maxf(view_size, 2.0 * Vector2(person_at.x - center.x, person_at.z - center.z).length() + 2.3)
				else:
					center.y += target_height
					if st.ms.has("animal"):
						heading = st.ms.animal.yaw
				var yaw: float = deg_to_rad(float(views[vi])) + heading
				var tilt: float = deg_to_rad(pitch)
				level.cam.position = center + Vector3(sin(yaw) * cos(tilt), sin(tilt), cos(yaw) * cos(tilt)) * 30.0
				level.cam.look_at(center)
				level.cam.size = view_size
				level.ui.caption.text = "%s  %.3fs  v%d" % [label, time, vi]
				if request.get("body_only",false):
					for object in st.objects: object.node.hide()
					for person in st.people:
						if person.item!=null: person.item.node.hide()
						for prop in person.get("props",[]): prop.node.hide()
				await process_frame
				RenderingServer.force_sync()
				RenderingServer.force_draw(false)
				var shot: Image = root.get_texture().get_image()
				shot.convert(Image.FORMAT_RGB8)
				shot.resize(cell, cell, Image.INTERPOLATE_LANCZOS)
				sheet.blit_rect(shot, Rect2i(0, 0, cell, cell), Vector2i((k % cols) * cell, (vi * rows + k / cols) * cell))
				if vi == 0:
					record.times.append(time)
		sheet.save_png(out.path_join(label + ".png"))
		manifest.append(record)
		save_json(out.path_join("manifest.json"), manifest)
		print("MOTION_CAPTURED ", label)
	for path in inputs:
		if FileAccess.get_sha256(path) != inputs[path]:
			push_error("capture input changed during recording: %s" % path)
			quit(1)
			return
	quit()
