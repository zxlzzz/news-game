## Root node of every scenes/<name>/level.tscn (scene_spec.md §1). The level file holds the
## ground bands and object instances and points at a palette, a view and a population.
## When the game runs this script checks the scene rules, derives what the files do not say
## (size jitter, the people: npc/crowd.gd), applies the ink look, then adds the view, environment
## and corner tint.
## Nothing here runs in the editor: there the models show with their own materials.
class_name Level
extends Node3D

const InkBuilder := preload("res://style/ink_builder.gd")
const Crowd := preload("res://npc/crowd.gd")
const GRADE_SHADER := preload("res://style/grade.gdshader")
const SLOTS: SlotDefs = preload("res://core/slots.tres")
const STYLE: StyleParams = preload("res://core/style.tres")
const MATERIAL_MAP_DIR := "res://core/material_maps"
## Object types live here; a level instance of one must keep scale 1 (scene_spec.md §4).
const TYPES_DIR := "res://types/"
## Objects in group "size_jitter" (trees, bushes, rocks) get a fixed small scale change (how much: sizeJitter in LEVEL_PARAMS)
## computed from where they stand: the same spot always gives the same size (scene_spec.md §3).
const LEVEL_PARAMS := "res://core/level-params.json"

@export var palette: ScenePalette
@export var view: PackedScene
@export var population: Population
## Third-party material name -> slot, from core/material_maps (read by the look and by core/walk_grid.gd).
var slot_map: Dictionary

func _ready() -> void:
	var errors: Array[String] = []
	slot_map = _load_material_maps(errors)
	var lp = JSON.parse_string(FileAccess.get_file_as_string(LEVEL_PARAMS))
	if not (lp is Dictionary and lp.get("sizeJitter") is float and lp.get("mergeTile") is float):
		errors.append("%s: missing, not a JSON object, or no number sizeJitter / mergeTile" % LEVEL_PARAMS)
	_check(errors)
	if not errors.is_empty():
		for e in errors:
			push_error("Level %s: %s" % [name, e])
			printerr("Level %s: %s" % [name, e])
		get_tree().quit(1)
		return
	_apply_size_jitter(lp.sizeJitter)
	_merge_road_modules(self)
	for c in get_children():
		if c.is_in_group(&"backdrop"):
			_merge_road_modules(c)
	# People before the look: riders bring vehicle models that need the ink look too.
	# (Their stick figures have no mesh until their first frame, so the look pass skips them.)
	add_child(Crowd.new(self))
	if lp.mergeTile > 0:
		_merge_static(self, lp.mergeTile)
		for c in get_children():
			if c.is_in_group(&"backdrop"):
				_merge_static(c, lp.mergeTile)
	_apply_look(slot_map)
	add_child(view.instantiate())
	_add_environment()
	_add_corner_tint()

func _check(errors: Array[String]) -> void:
	if palette == null or view == null or population == null:
		errors.append("palette, view and population must all be set")
		return
	for slot in SLOTS.slots:
		for f in SLOTS.slots[slot]:
			if not f in SlotDefs.FLAGS:
				errors.append("slot %s has unknown flag %s" % [slot, f])
		if not "hide" in SLOTS.slots[slot] and not palette.colors.has(slot):
			errors.append("palette %s has no colour for slot %s" % [palette.resource_path, slot])
	for slot in palette.colors:
		if not SLOTS.slots.has(slot):
			errors.append("palette %s colours unknown slot %s" % [palette.resource_path, slot])
	for c in get_children():
		if c is GroundStrip:
			for b in c.bands:
				if b != null and not SLOTS.slots.has(b.slot):
					errors.append("ground band slot %s is not in core/slots.tres" % b.slot)
		elif c is Node3D and c.scene_file_path.begins_with(TYPES_DIR):
			if not c.basis.get_scale().is_equal_approx(Vector3.ONE):
				errors.append("%s changes the scale of its type; set scale in %s instead" % [c.name, c.scene_file_path])

static func _load_material_maps(errors: Array[String]) -> Dictionary:
	var merged := {}
	for f in DirAccess.get_files_at(MATERIAL_MAP_DIR):
		if not f.ends_with(".tres"):
			continue
		var m: MaterialMap = load(MATERIAL_MAP_DIR.path_join(f))
		for k in m.map:
			if merged.has(k) and merged[k] != m.map[k]:
				errors.append("material %s maps to both %s and %s" % [k, merged[k], m.map[k]])
			merged[k] = String(m.map[k])  # ink_builder looks slots up by String
			if not SLOTS.slots.has(m.map[k]):
				errors.append("%s maps %s to unknown slot %s" % [f, k, m.map[k]])
	return merged

func _apply_size_jitter(jitter: float) -> void:
	for n in get_tree().get_nodes_in_group(&"size_jitter"):
		if not is_ancestor_of(n):
			continue
		var model: Node3D = n.get_node("model")
		var p: Vector3 = n.global_position
		var h := (int(round(p.x * 100.0)) * 73856093) ^ (int(round(p.z * 100.0)) * 19349663)
		var u := float(h & 0xffff) / 65535.0
		model.scale *= 1.0 + (u * 2.0 - 1.0) * jitter

## Road modules (group "road_module"; 素材清单.md 第六批 一、道路模块) have no thickness and leave their
## joining ends open, so drawn one by one every joint would get an ink line. Before the grid and the
## look they become one mesh with one surface per material: the joints weld and draw nothing. The
## level's own modules and those in a backdrop node (group "backdrop") are merged separately.
func _merge_road_modules(parent: Node3D) -> void:
	var modules: Array[Node3D] = []
	for c in parent.get_children():
		if c is Node3D and c.is_in_group(&"road_module"):
			modules.append(c)
	if modules.is_empty():
		return
	var parts := {}  # material name -> {mat, v, n, i}; plain Arrays (packed ones in a Dictionary copy on write)
	var to_level := parent.global_transform.affine_inverse()
	for m in modules:
		var ms: Array[MeshInstance3D] = []
		_mesh_instances(m, ms)
		for mi in ms:
			var xf := to_level * mi.global_transform
			var nb := xf.basis.inverse().transposed()
			for s in mi.mesh.get_surface_count():
				var mat := mi.get_active_material(s)
				var key := String(mat.resource_name) if mat else ""
				if not parts.has(key):
					parts[key] = {"mat": mat, "v": [], "n": [], "i": []}
				var part: Dictionary = parts[key]
				var arr := mi.mesh.surface_get_arrays(s)
				var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
				var base: int = part.v.size()
				for v in verts:
					part.v.append(xf * v)
				for n in arr[Mesh.ARRAY_NORMAL]:
					part.n.append((nb * n).normalized())
				var idx = arr[Mesh.ARRAY_INDEX]
				if idx == null or idx.is_empty():
					for k in verts.size():
						part.i.append(base + k)
				else:
					for k in idx:
						part.i.append(base + k)
	var mesh := ArrayMesh.new()
	for key in parts:
		var part: Dictionary = parts[key]
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = PackedVector3Array(part.v)
		arrays[Mesh.ARRAY_NORMAL] = PackedVector3Array(part.n)
		arrays[Mesh.ARRAY_INDEX] = PackedInt32Array(part.i)
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		mesh.surface_set_material(mesh.get_surface_count() - 1, part.mat)
	for m in modules:
		parent.remove_child(m)
		m.free()
	var roads := Node3D.new()
	roads.name = "Roads"
	roads.add_to_group(&"paving")
	var mi := MeshInstance3D.new()
	mi.name = "surface"
	mi.mesh = mesh
	roads.add_child(mi)
	parent.add_child(roads)

## Drawing cost: every mesh of every object is drawn on its own (fill, lines, shadow), which makes
## thousands of draw calls in a big level. After the walk grid is built (it reads the objects), the
## meshes of objects that never move are joined per tile (mergeTile metres square, so the camera
## still skips tiles out of view) and per material into one mesh a tile; the objects stay (their
## post markers are still used) without meshes. Left alone: ground strips (each band is its own
## mesh for its edge lines), a real-place ground (group "ground": one mesh per surface, so its
## edges draw where surfaces meet, not along tile seams), the merged roads, the people, objects with a script (vehicles people
## ride) and the backdrop, which is joined on its own.
func _merge_static(parent: Node3D, tile: float) -> void:
	var parts := {}  # "tile|material" -> {mat, count, and lists of v, n, uv, i pieces, joined at the end}
	var to_parent := parent.global_transform.affine_inverse()
	var sources: Array[MeshInstance3D] = []
	for c in parent.get_children():
		if not (c is Node3D) or c is GroundStrip or c.get_script() != null or c.name in [&"Crowd", &"Roads"] 				or c.is_in_group(&"backdrop") or c.is_in_group(&"ground"):
			continue
		_mesh_instances(c, sources)
	for mi in sources:
		var xf := to_parent * mi.global_transform
		var centre := xf * mi.mesh.get_aabb().get_center()
		var cell := "%d,%d" % [floori(centre.x / tile), floori(centre.z / tile)]
		var nxf := Transform3D(xf.basis.inverse().transposed(), Vector3.ZERO)
		for s in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(s)
			var tex = mat.albedo_texture if mat is BaseMaterial3D else null
			var key := "%s|%s|%s" % [cell, mat.resource_name if mat else "", tex.resource_path if tex else ""]
			if not parts.has(key):
				parts[key] = {"mat": mat, "v": [], "n": [], "uv": [], "i": [], "count": 0}
			var part: Dictionary = parts[key]
			var arr := mi.mesh.surface_get_arrays(s)
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var base: int = part.count
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(verts.size()))
			for k in idx.size():
				idx[k] += base
			var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV] if arr[Mesh.ARRAY_TEX_UV] != null else PackedVector2Array()
			uv.resize(verts.size())
			part.v.append(xf * verts)
			part.n.append(nxf * (arr[Mesh.ARRAY_NORMAL] as PackedVector3Array))
			part.uv.append(uv)
			part.i.append(idx)
			part.count += verts.size()
		mi.mesh = null
	var nodes := {}
	for key in parts:
		var part: Dictionary = parts[key]
		var cell: String = key.get_slice("|", 0)
		if not nodes.has(cell):
			var mi := MeshInstance3D.new()
			mi.name = "static_%s" % cell.replace(",", "_").replace("-", "m")
			mi.mesh = ArrayMesh.new()
			nodes[cell] = mi
		var v := PackedVector3Array()
		var n := PackedVector3Array()
		var uv := PackedVector2Array()
		var i := PackedInt32Array()
		for k in part.v.size():
			v.append_array(part.v[k])
			n.append_array(part.n[k])
			uv.append_array(part.uv[k])
			i.append_array(part.i[k])
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = v
		arrays[Mesh.ARRAY_NORMAL] = n
		arrays[Mesh.ARRAY_TEX_UV] = uv
		arrays[Mesh.ARRAY_INDEX] = i
		var mesh: ArrayMesh = nodes[cell].mesh
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		mesh.surface_set_material(mesh.get_surface_count() - 1, part.mat)
	var holder := Node3D.new()
	holder.name = "Static"
	for cell in nodes:
		holder.add_child(nodes[cell])
	parent.add_child(holder)

static func _mesh_instances(n: Node, out: Array[MeshInstance3D]) -> void:
	# Doors nested inside buildings must retain their moving meshes and hinge tree.
	if n.is_in_group(&"operable_door"):
		return
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		out.append(n)
	for c in n.get_children():
		_mesh_instances(c, out)

func _apply_look(map: Dictionary) -> void:
	apply_look_to(map, self)

## The ink look on every mesh under `root` (the whole level at start; scenes/empty_ground calls it for
## objects it adds later).
func apply_look_to(map: Dictionary, root: Node) -> void:
	var entries := {}
	for slot in SLOTS.slots:
		var e := {}
		for f in SLOTS.slots[slot]:
			e[f] = true
		if palette.colors.has(slot):
			e["color"] = palette.colors[slot]
		entries[String(slot)] = e
	var fill := {
		"band_ndl": STYLE.band_ndl, "hatch_period_px": STYLE.hatch_period_px,
		"cover_grazing": STYLE.cover_grazing, "cover_shade": STYLE.cover_shade,
		"cover_dark": STYLE.cover_dark, "light_scale": STYLE.light_scale,
		"mid_mul": palette.mid_mul, "dark_mul": palette.dark_mul,
		"stroke_mid_mul": palette.stroke_mid_mul, "stroke_dark_mul": palette.stroke_dark_mul,
	}
	var line_mat := ShaderMaterial.new()
	line_mat.shader = InkBuilder.LINE_SHADER
	line_mat.set_shader_parameter("line_color", palette.line_color)
	line_mat.set_shader_parameter("width_px", STYLE.line_width_px)
	line_mat.set_shader_parameter("depth_bias", STYLE.line_depth_bias)
	var unmapped := {}
	InkBuilder.apply(root, fill, line_mat, STYLE.crease_deg, entries, map, unmapped)
	if not unmapped.is_empty():
		var msg := "Level %s: materials with no slot (add them to a map in %s): %s" % [name, MATERIAL_MAP_DIR, unmapped.keys()]
		push_error(msg)
		printerr(msg)
		get_tree().quit(1)

func _add_environment() -> void:
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = palette.background
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color.BLACK
	e.ambient_light_energy = 0.0
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = e
	add_child(we)

func _add_corner_tint() -> void:
	if palette.tint_mix == 0.0 and palette.tint_multiply == 0.0:
		return
	var m := ShaderMaterial.new()
	m.shader = GRADE_SHADER
	m.set_shader_parameter("tint_color", palette.tint_color)
	m.set_shader_parameter("tint_center", palette.tint_center)
	m.set_shader_parameter("tint_radius", palette.tint_radius)
	m.set_shader_parameter("tint_mix", palette.tint_mix)
	m.set_shader_parameter("tint_multiply", palette.tint_multiply)
	var vp := get_viewport().get_visible_rect().size
	m.set_shader_parameter("aspect", vp.x / vp.y)
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.material = m
	var layer := CanvasLayer.new()
	layer.add_child(rect)
	add_child(layer)
