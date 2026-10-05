## Independent actual render of caller context on one named local bird motion.
## No stage, route, simulation, displacement or automatic action selection.
## Run with a request JSON; production motion/renderer inputs are read-only.
extends SceneTree

const Motion = preload("res://npc/pigeon_motion.gd")
const Pigeon = preload("res://npc/procedural_pigeon.gd")
const Figure = preload("res://npc/ink_figure.gd")

func _initialize() -> void:
	call_deferred("run")

func array3(v: Vector3) -> Array:
	return [v.x, v.y, v.z]

func save_json(path: String, data) -> void:
	var file := FileAccess.open(path, FileAccess.WRITE)
	assert(file != null, "Cannot write pigeon context evidence: " + path)
	file.store_string(JSON.stringify(data, "  ") + "\n")

func run() -> void:
	var args := OS.get_cmdline_user_args()
	assert(args.size() == 1, "review_pigeon_context: one request JSON required")
	var request: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var inputs := {}
	for path in request.provenance:
		assert(FileAccess.file_exists(path), "Pigeon context input missing: " + path)
		inputs[path] = FileAccess.get_sha256(path)
	inputs[args[0]] = FileAccess.get_sha256(args[0])
	var out: String = request.output
	assert(DirAccess.make_dir_recursive_absolute(out) == OK, "Cannot create pigeon context output")
	var preview: Dictionary = request.preview
	var viewport: int = preview.viewport
	root.size = Vector2i(viewport, viewport)
	var world := Node3D.new()
	root.add_child(world)
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	var bg: Array = preview.background
	environment.environment.background_color = Color(bg[0], bg[1], bg[2])
	world.add_child(environment)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = preview.frame
	cam.current = true
	world.add_child(cam)
	var crowd: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	var fig := Figure.new()
	world.add_child(fig)
	fig.setup(Color(crowd.ink[0], crowd.ink[1], crowd.ink[2]), crowd.depthBias)
	# This transform is owned by this diagnostic caller and never integrated.
	fig.position = Vector3(0, preview.root_height, 0)
	var fixed_root: Transform3D = fig.global_transform
	var grid := Figure.new()
	world.add_child(grid)
	var grid_color: Array = preview.grid_color
	grid.setup(Color(grid_color[0], grid_color[1], grid_color[2]), 0)
	var lines := []
	var n: int = preview.grid_count
	var step: float = preview.grid_step
	for k in range(-n, n + 1):
		lines.append([Vector3(k * step, 0, -n * step), Vector3(k * step, 0, n * step), preview.grid_width])
		lines.append([Vector3(-n * step, 0, k * step), Vector3(n * step, 0, k * step), preview.grid_width])
	grid.draw(lines, [], [])
	var canvas := CanvasLayer.new()
	root.add_child(canvas)
	var caption := Label.new()
	canvas.add_child(caption)
	caption.add_theme_color_override("font_color", Color(crowd.ink[0], crowd.ink[1], crowd.ink[2]))
	caption.add_theme_font_size_override("font_size", preview.font_size)
	caption.position = Vector2(preview.caption_margin, preview.caption_margin)
	var params := Pigeon.load_params()
	var manifest := []
	var center := Vector3(0, preview.target_height, 0)
	var cell: int = preview.cell
	var columns: int = preview.columns
	var views: Array = preview.views
	await process_frame
	for entry in request.entries:
		var id: String = entry.id
		var label: String = entry.label
		var raw_context: Dictionary = entry.context
		var context: Dictionary = raw_context.duplicate(true)
		if context.has("velocity"):
			var velocity: Array = context.velocity
			assert(velocity.size() == 3, "Pigeon context velocity needs three components")
			context.velocity = Vector3(velocity[0], velocity[1], velocity[2])
		var samples: int = entry.samples
		var duration: float = entry.duration
		assert(samples > 0 and duration > 0 and columns > 0, "Invalid pigeon context capture timing")
		var rows := ceili(float(samples) / columns)
		var sheet := Image.create(columns * cell, rows * cell * views.size(), false, Image.FORMAT_RGB8)
		var record := {"id": id, "label": label, "context": raw_context, "duration": duration,
			"samples": samples, "columns": columns, "cell": cell, "views": views,
			"viewport": [viewport, viewport], "times": [], "inputs_sha256": inputs,
			"root_origin": array3(fixed_root.origin), "root_basis": [array3(fixed_root.basis.x), array3(fixed_root.basis.y), array3(fixed_root.basis.z)],
			"heading": 0.0, "root_transform_unchanged_all_samples": true, "pose_trace": []}
		for vi in views.size():
			var yaw := deg_to_rad(float(views[vi]))
			var pitch := deg_to_rad(float(preview.pitch))
			cam.position = center + Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * preview.camera_distance
			cam.look_at(center)
			for k in samples:
				var time := duration * k / samples
				var pose := Motion.sample(id, time, params, context)
				var drawing := Pigeon.silhouette(pose, params)
				fig.draw(drawing.segments, drawing.discs, drawing.triangles)
				assert(fig.global_transform == fixed_root, "Pigeon context capture moved its root")
				caption.text = "%s  %.3fs  v%d" % [label, time, vi]
				await process_frame
				await RenderingServer.frame_post_draw
				var image: Image = root.get_texture().get_image()
				image.convert(Image.FORMAT_RGB8)
				image.resize(cell, cell, Image.INTERPOLATE_LANCZOS)
				sheet.blit_rect(image, Rect2i(0, 0, cell, cell), Vector2i((k % columns) * cell, (vi * rows + k / columns) * cell))
				if vi == 0:
					record.times.append(time)
					record.pose_trace.append({"time": time, "root_origin": array3(fig.global_position),
						"body_centers": [array3(pose.body[0][0]), array3(pose.body[1][0])],
						"feet": [array3(pose.L[2]), array3(pose.R[2])],
						"wing_tips": [array3(pose.wingL[-1]), array3(pose.wingR[-1])]})
		assert(sheet.save_png(out.path_join(label + ".png")) == OK, "Cannot save pigeon context sheet")
		manifest.append(record)
		save_json(out.path_join("manifest.json"), manifest)
		print("PIGEON_CONTEXT_CAPTURED ", label)
	for path in inputs:
		assert(FileAccess.get_sha256(path) == inputs[path], "Pigeon context input changed during capture: " + path)
	print("PIGEON_CONTEXT_CAPTURE_OK ", manifest.size(), " entries; fixed root and heading")
	quit(0)
