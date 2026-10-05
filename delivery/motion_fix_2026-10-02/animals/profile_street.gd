## Read-only timing of the original two-streets population. CPU process time excludes rendering.
## Root may also run this with a visible renderer; whole-frame FPS is then recorded separately.
extends SceneTree
const Model = preload("res://npc/animal_model.gd")
var crowd: Node
var level: Node3D
var settings: Dictionary
var output: String
var frame := 0
var costs := []
var actual_fps := []
var frame_deltas := []
var render_cpu := []
var render_gpu := []
var counts := {}
var inputs_before := {}

func _inputs() -> Dictionary:
	var result := {}
	for path in ["res://npc/animal.gd", "res://npc/animal_model.gd", "res://npc/animal-models.json", "res://npc/procedural_dog.gd", "res://npc/dog-params.json", "res://npc/crowd.gd", "res://models/animal_cat.glb", "res://models/animal_husky.glb", "res://models/animal_shibainu.glb", "res://scenes/two_streets/population.tres", "res://project.godot"]:
		result[path] = FileAccess.get_sha256(path)
	return result

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	inputs_before = _inputs()
	output = args[0]
	settings = JSON.parse_string(FileAccess.get_file_as_string(args[1]))
	if DisplayServer.get_name() != "headless":
		RenderingServer.viewport_set_measure_render_time(root.get_viewport_rid(), true)
	level = load("res://scenes/two_streets/level.tscn").instantiate()
	root.add_child.call_deferred(level)

func _process(delta: float) -> bool:
	if crowd == null:
		if level.is_inside_tree():
			crowd = level.get_node_or_null("Crowd")
		return false
	crowd.set_process(false)
	var before := Time.get_ticks_usec()
	crowd._process(settings.step)
	var elapsed := Time.get_ticks_usec() - before
	if frame >= settings.warmup_frames:
		costs.append(float(elapsed) / 1000)
		actual_fps.append(Performance.get_monitor(Performance.TIME_FPS))
		frame_deltas.append(delta * 1000)
		if DisplayServer.get_name() != "headless":
			render_cpu.append(RenderingServer.viewport_get_measured_render_time_cpu(root.get_viewport_rid()))
			render_gpu.append(RenderingServer.viewport_get_measured_render_time_gpu(root.get_viewport_rid()))
	frame += 1
	if frame < settings.warmup_frames + settings.frames:
		return false
	for person in crowd.people:
		counts[person.type] = counts.get(person.type, 0) + 1
	var meshes := {}
	for breed in Model.config().breeds:
		meshes[breed] = Model.info(breed).skin_all.size()
	var inputs_after := _inputs()
	assert(inputs_before == inputs_after, "Street profile inputs changed during measurement")
	var result := {"inputs_before": inputs_before, "inputs_after": inputs_after, "display_server": DisplayServer.get_name(), "population_file": "res://scenes/two_streets/population.tres",
		"engine": Engine.get_version_info(), "gpu": RenderingServer.get_video_adapter_name(), "gpu_vendor": RenderingServer.get_video_adapter_vendor(),
		"graphics_api_version": RenderingServer.get_video_adapter_api_version(),
		"configured_renderer": ProjectSettings.get_setting("rendering/renderer/rendering_method"),
		"window_mode": DisplayServer.window_get_mode(), "window_size": str(DisplayServer.window_get_size()),
		"vsync_mode": DisplayServer.window_get_vsync_mode(),
		"population_sha256": FileAccess.get_sha256("res://scenes/two_streets/population.tres"), "people_by_type": counts,
		"unique_skin_vertices": meshes, "frames": costs.size(), "step": settings.step,
		"crowd_cpu_ms": _statistics(costs), "whole_frame_delta_ms": _statistics(frame_deltas), "monitor_fps": _statistics(actual_fps),
		"viewport_render_cpu_ms": _statistics(render_cpu) if not render_cpu.is_empty() else null,
		"viewport_render_gpu_ms": _statistics(render_gpu) if not render_gpu.is_empty() else null,
		"note": "Crowd CPU excludes rendering and other scene callbacks. Headless FPS measures an unrendered loop; windowed FPS includes rendering but can be affected by background focus and system load."}
	var file := FileAccess.open(output, FileAccess.WRITE)
	file.store_string(JSON.stringify(result))
	print("STREET_PROFILE ", JSON.stringify(result))
	quit()
	return true

func _statistics(values: Array) -> Dictionary:
	values.sort()
	var sum := 0.0
	for value in values:
		sum += value
	return {"mean": sum / values.size(), "p50": values[values.size() / 2], "p95": values[int(values.size() * 0.95)], "max": values[-1]}
