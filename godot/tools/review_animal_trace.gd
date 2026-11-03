## Render recorded runtime bone matrices, without re-running a controller.
## Request: {trace:runtime.json, output:folder, entries:[{breed,label,start,duration,samples}]}
extends SceneTree

const Model := preload("res://npc/animal_model.gd")

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var args := OS.get_cmdline_user_args()
	assert(args.size() == 1, "Animal trace capture requires a request JSON")
	var request: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var trace: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(request.trace))
	assert(trace.inputs_before == trace.inputs_after, "Runtime trace mixed input versions")
	DirAccess.make_dir_recursive_absolute(request.output)
	root.size = Vector2i(768, 768)
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.playing = false
	level.set_process(false)
	level.cam.set_process(false)
	level.cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	for panel in level.find_children("*", "PanelContainer", true, false): panel.hide()
	var manifest := []
	var views: Array = request.get("views", [35.0, 90.0, 270.0])
	var cell: int = request.get("cell", 256)
	var cols: int = request.get("columns", 12)
	for entry in request.entries:
		var info: Dictionary = trace.breeds[entry.breed]
		var matches: Array = info.scenarios.filter(func(s): return s.label == entry.label)
		assert(matches.size() == 1, "Unknown or duplicated runtime scenario")
		var scenario: Dictionary = matches[0]
		var file := FileAccess.open(scenario.file, FileAccess.READ)
		assert(file != null, "Missing runtime matrix data")
		var matrices := file.get_buffer(file.get_length()).to_float32_array()
		file.close()
		var bones: int = info.names.size()
		assert(matrices.size() == scenario.states.size() * bones * 12, "Runtime matrix size mismatch")
		var model := Model.info(entry.breed)
		var glb: String = Model.config().breeds[entry.breed].glb
		assert(trace.inputs_before.get(glb, "") == FileAccess.get_sha256(glb), "Runtime model file differs from captured trace")
		assert(model.names.size() == bones and model.parent.size() == bones, "Runtime skeleton size mismatch")
		for i in bones:
			assert(model.names[i] == info.names[i] and model.parent[i] == int(info.parent[i]), "Runtime skeleton differs from current model")
		assert(level.stage.select(model.species + ":" + model.stand_clip, {"breed": entry.breed}) == "")
		var samples: int = entry.samples
		var rows: int = ceili(float(samples) / cols)
		var sheet := Image.create(cols * cell, rows * cell * views.size(), false, Image.FORMAT_RGB8)
		var label: String = entry.breed + "_" + entry.get("output_label", entry.label)
		var record := {"id": label, "label": label, "samples": samples, "columns": cols, "cell": cell,
			"views": views, "start": entry.start, "duration": entry.duration, "times": [],
			"trace": request.trace, "trace_inputs": trace.inputs_before, "matrix_sha256": FileAccess.get_sha256(scenario.file)}
		for vi in views.size():
			for k in samples:
				var at: int = roundi((entry.start + entry.duration * k / samples) * trace.fps)
				assert(at >= 0 and at < scenario.states.size(), "Requested time outside recorded runtime trace")
				var globals := []
				var locals := []
				for i in bones:
					var p: int = (at * bones + i) * 12
					globals.append(Transform3D(Basis(Vector3(matrices[p], matrices[p+1], matrices[p+2]),
						Vector3(matrices[p+3], matrices[p+4], matrices[p+5]), Vector3(matrices[p+6], matrices[p+7], matrices[p+8])),
						Vector3(matrices[p+9], matrices[p+10], matrices[p+11])))
				for i in bones:
					var parent: int = int(info.parent[i])
					locals.append(globals[parent].affine_inverse() * globals[i] if parent >= 0 else globals[i])
				level.stage.ms.body.show_pose({"root": Transform3D.IDENTITY, "locals": locals})
				var center: Vector3 = globals[model.front].origin
				var yaw := deg_to_rad(float(views[vi]))
				var pitch := deg_to_rad(float(request.get("pitch", 12.0)))
				level.cam.position = center + Vector3(sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch))*30.0
				level.cam.look_at(center)
				level.cam.size = entry.get("size", 1.6)
				var time: float = scenario.states[at].time
				level.ui.caption.text = "%s %.3fs %s" % [label, time, scenario.states[at].phase]
				await process_frame
				await RenderingServer.frame_post_draw
				var shot: Image = root.get_texture().get_image()
				shot.convert(Image.FORMAT_RGB8)
				shot.resize(cell, cell, Image.INTERPOLATE_LANCZOS)
				sheet.blit_rect(shot, Rect2i(0, 0, cell, cell), Vector2i((k % cols)*cell, (vi*rows+k/cols)*cell))
				if vi == 0: record.times.append(time)
		sheet.save_png(request.output.path_join(label + ".png"))
		manifest.append(record)
		print("ANIMAL_TRACE_CAPTURED ", label)
	var out := FileAccess.open(request.output.path_join("manifest.json"), FileAccess.WRITE)
	out.store_string(JSON.stringify(manifest))
	out.close()
	quit()
