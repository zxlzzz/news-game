extends SceneTree

# Static object-only scene geometry evidence. No scene/model is changed.
const LEVEL_PARAMS = "res://core/level-params.json"
var output_path: String
var instances: Array = []
var floors: Array = []
var strips: Array = []
var dependencies: Dictionary = {}

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args = OS.get_cmdline_user_args()
	if args.size() != 2:
		push_error("Expected -- <res://level.tscn> <absolute-export.json>")
		quit(1)
		return
	var scene_path: String = args[0]
	output_path = args[1]
	_note_dependency_tree(scene_path)
	_note_file(LEVEL_PARAMS)
	var packed: PackedScene = load(scene_path)
	if packed == null:
		quit(1)
		return
	var raw: Node3D = packed.instantiate()
	var declared_population = raw.get("spawn_population")
	var declared_view = raw.get("view")
	var declared_palette = raw.get("palette")
	var declared_pop = raw.get("population")
	_note_file(scene_path)
	_note_file(LEVEL_PARAMS)
	if declared_view != null:
		_note_file(declared_view.resource_path)
	if declared_palette != null:
		_note_file(declared_palette.resource_path)
	if declared_pop != null:
		_note_file(declared_pop.resource_path)
	# Level merges meshes during _ready. Preserve its source tree for measurements.
	raw.set_script(null)
	root.add_child(raw)
	await process_frame
	var lp = JSON.parse_string(FileAccess.get_file_as_string(LEVEL_PARAMS))
	if not lp is Dictionary or not lp.has("sizeJitter"):
		push_error("Missing level size jitter")
		quit(1)
		return
	for n in get_nodes_in_group(&"size_jitter"):
		if raw.is_ancestor_of(n):
			var p: Vector3 = n.global_position
			var h = (int(round(p.x * 100.0)) * 73856093) ^ (int(round(p.z * 100.0)) * 19349663)
			var u = float(h & 0xffff) / 65535.0
			n.get_node("model").scale *= 1.0 + (u * 2.0 - 1.0) * float(lp.sizeJitter)
	_collect(raw, raw)
	var report = {"scene": scene_path, "declared_spawn_population": declared_population,
		"pre_merge_runtime_size_jitter_applied": true, "instances": instances,
		"ground_strips": strips, "floor_triangles": floors, "dependencies": dependencies,
		"limitations": ["Whole/component AABBs only identify candidates; they do not prove mesh intersection.",
			"Minimum-height vertices test sampled resting support, not the entire footprint or structural load path.",
			"Alpha decals are tested at mesh rectangle vertices; transparent corners require separate visible-mask interpretation.",
			"Upward ground/paving faces are potential support surfaces; gameplay navigation is not tested."]}
	raw.queue_free()
	await process_frame
	var live: Node3D = packed.instantiate()
	root.add_child(live)
	await process_frame
	await process_frame
	var cameras: Array = []
	var forbidden: Array = []
	var count = {"meshes": 0, "shader_material_surfaces": 0, "world_environments": 0}
	_runtime_walk(live, live, cameras, forbidden, count)
	report["runtime"] = {"cameras": cameras, "forbidden_population_nodes": forbidden, "counts": count,
		"spawn_population": live.get("spawn_population"), "camera_current_present": get_root().get_camera_3d() != null}
	_write(output_path, report)
	print("STATIC_GEOMETRY_EXPORTED instances=%d floors=%d" % [instances.size(), floors.size()])
	quit(0 if declared_population == false and forbidden.is_empty() and not cameras.is_empty() and count.shader_material_surfaces > 0 else 1)

func _collect(n: Node, scene_root: Node) -> void:
	if n is Node3D and n.scene_file_path.begins_with("res://types/"):
		_export_instance(n, scene_root)
		return
	if n is GroundStrip:
		var id = String(scene_root.get_path_to(n))
		var meshes: Array[MeshInstance3D] = []
		_meshes(n, meshes)
		for mi in meshes:
			_export_floor(mi, id)
		var bb = _box(meshes)
		strips.append({"owner": id, "bounds": _bb(bb), "length": n.length, "bands": n.bands.size()})
	for c in n.get_children():
		_collect(c, scene_root)

func _export_instance(n: Node3D, scene_root: Node) -> void:
	var id = String(scene_root.get_path_to(n))
	_note_file(n.scene_file_path)
	var meshes: Array[MeshInstance3D] = []
	_meshes(n, meshes)
	if meshes.is_empty():
		return
	var b = _box(meshes)
	var components: Array = []
	var all_vertices: Array = []
	var model_min = INF
	var model_max = -INF
	var world_min = INF
	for mi in meshes:
		_note_file(mi.mesh.resource_path.get_slice("::", 0))
		var cb = mi.global_transform * mi.mesh.get_aabb()
		components.append({"path": String(n.get_path_to(mi)), "bounds": _bb(cb)})
		for s in mi.mesh.get_surface_count():
			var arr = mi.mesh.surface_get_arrays(s)
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			for v in verts:
				var world: Vector3 = mi.global_transform * v
				all_vertices.append(world)
				world_min = minf(world_min, world.y)
				var own: Vector3 = n.global_transform.affine_inverse() * world
				model_min = minf(model_min, own.y)
				model_max = maxf(model_max, own.y)
	var low: Array = []
	var seen: Dictionary = {}
	for v: Vector3 in all_vertices:
		if absf(v.y - world_min) <= 0.000002:
			var key = "%.7f|%.7f|%.7f" % [v.x, v.y, v.z]
			if not seen.has(key):
				seen[key] = true
				low.append(_v(v))
	var provider = n.is_in_group(&"paving") or n.is_in_group(&"ground")
	# Inferred from real native mesh, restricted to planar marking types.
	var marking = n.is_in_group(&"marking") or n.is_in_group(&"crosswalk")
	var paint_lift = model_min if marking and model_max - model_min <= 0.0001 and model_min >= 0 and model_min <= 0.02 else 0.0
	instances.append({"owner": id, "type": n.scene_file_path, "groups": Array(n.get_groups()),
		"bounds": _bb(b), "components": components, "lowest_vertices": low,
		"actual_lowest_mesh_y": world_min,
		"native_planar_marking_lift": paint_lift, "paving_provider": provider,
		"origin": _v(n.global_position), "basis": [_v(n.global_basis.x), _v(n.global_basis.y), _v(n.global_basis.z)]})
	if provider:
		for mi in meshes:
			_export_floor(mi, id)

func _export_floor(mi: MeshInstance3D, owner_id: String) -> void:
	for s in mi.mesh.get_surface_count():
		if mi.mesh is ArrayMesh and mi.mesh.surface_get_primitive_type(s) != Mesh.PRIMITIVE_TRIANGLES:
			continue
		var arr = mi.mesh.surface_get_arrays(s)
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var indexes = arr[Mesh.ARRAY_INDEX]
		if indexes == null or indexes.is_empty():
			indexes = PackedInt32Array(range(verts.size()))
		for i in range(0, indexes.size(), 3):
			var a: Vector3 = mi.global_transform * verts[indexes[i]]
			var b: Vector3 = mi.global_transform * verts[indexes[i + 1]]
			var c: Vector3 = mi.global_transform * verts[indexes[i + 2]]
			# Godot front faces are clockwise. Use exported normals if available.
			var normal = (c - a).cross(b - a).normalized()
			if normal.y < 0.5:
				continue
			floors.append({"owner": owner_id, "mesh": String(mi.name), "a": _v(a), "b": _v(b), "c": _v(c)})

func _runtime_walk(n: Node, base: Node, cameras: Array, forbidden: Array, count: Dictionary) -> void:
	var script_path = n.get_script().resource_path if n.get_script() != null else ""
	if n.name == &"Crowd" or script_path.begins_with("res://npc/"):
		forbidden.append({"path": String(base.get_path_to(n)), "script": script_path})
	if n is Camera3D:
		cameras.append({"path": String(base.get_path_to(n)), "current": n.current, "size": n.size,
			"near": n.near, "far": n.far, "position": _v(n.global_position),
			"params_initialized": n.get("p") is Dictionary and not n.get("p").is_empty()})
		if n.get("params") is String:
			_note_file(n.get("params"))
	if n is WorldEnvironment:
		count.world_environments += 1
	if n is MeshInstance3D and n.mesh != null:
		count.meshes += 1
		for s in n.mesh.get_surface_count():
			if n.get_active_material(s) is ShaderMaterial:
				count.shader_material_surfaces += 1
	for c in n.get_children():
		_runtime_walk(c, base, cameras, forbidden, count)

func _meshes(n: Node, found: Array[MeshInstance3D]) -> void:
	if n is MeshInstance3D and n.mesh != null:
		found.append(n)
	for c in n.get_children():
		_meshes(c, found)

func _box(meshes: Array[MeshInstance3D]) -> AABB:
	var b: AABB = meshes[0].global_transform * meshes[0].mesh.get_aabb()
	for mi in meshes.slice(1):
		b = b.merge(mi.global_transform * mi.mesh.get_aabb())
	return b

func _v(v: Vector3) -> Array:
	return [v.x, v.y, v.z]

func _bb(b: AABB) -> Dictionary:
	return {"min": _v(b.position), "max": _v(b.end)}

func _note_file(path: String) -> void:
	if path.begins_with("res://") and FileAccess.file_exists(path):
		if not dependencies.has(path):
			dependencies[path] = {"absolute_path": ProjectSettings.globalize_path(path), "sha256": FileAccess.get_sha256(path)}

func _note_dependency_tree(path: String) -> void:
	if dependencies.has(path) or not FileAccess.file_exists(path):
		return
	_note_file(path)
	if not (path.ends_with(".tscn") or path.ends_with(".tres")):
		return
	var matcher = RegEx.new()
	matcher.compile('path="(res://[^\"]+)"')
	for hit in matcher.search_all(FileAccess.get_file_as_string(path)):
		_note_dependency_tree(hit.get_string(1))

func _write(path: String, value: Dictionary) -> void:
	var f = FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		push_error("Cannot write %s" % path)
		quit(1)
		return
	f.store_string(JSON.stringify(value))
