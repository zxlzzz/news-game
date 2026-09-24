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
## Objects in group "size_jitter" (trees, bushes, rocks) get a fixed small scale change
## computed from where they stand: the same spot always gives the same size (scene_spec.md §3).
const SIZE_JITTER := 0.12

@export var palette: ScenePalette
@export var view: PackedScene
@export var population: Population
## Third-party material name -> slot, from core/material_maps (read by the look and by core/walk_grid.gd).
var slot_map: Dictionary

func _ready() -> void:
	var errors: Array[String] = []
	slot_map = _load_material_maps(errors)
	_check(errors)
	if not errors.is_empty():
		for e in errors:
			push_error("Level %s: %s" % [name, e])
			printerr("Level %s: %s" % [name, e])
		get_tree().quit(1)
		return
	_apply_size_jitter()
	# People before the look: riders bring vehicle models that need the ink look too.
	# (Their stick figures have no mesh until their first frame, so the look pass skips them.)
	add_child(Crowd.new(self))
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

func _apply_size_jitter() -> void:
	for n in get_tree().get_nodes_in_group(&"size_jitter"):
		if not is_ancestor_of(n):
			continue
		var model: Node3D = n.get_node("model")
		var p: Vector3 = n.global_position
		var h := (int(round(p.x * 100.0)) * 73856093) ^ (int(round(p.z * 100.0)) * 19349663)
		var u := float(h & 0xffff) / 65535.0
		model.scale *= 1.0 + (u * 2.0 - 1.0) * SIZE_JITTER

func _apply_look(map: Dictionary) -> void:
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
	InkBuilder.apply(self, fill, line_mat, STYLE.crease_deg, entries, map, unmapped)
	if not unmapped.is_empty():
		push_error("Level %s: materials with no slot (add them to a map in %s): %s" % [name, MATERIAL_MAP_DIR, unmapped.keys()])

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
