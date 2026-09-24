## Draws a figure given as 3D points, in this node's local space, all in one ink colour:
##  - segments [a, b, width]: equal-width round-capped lines (stick_line.gdshader, same as StickNpc);
##  - discs [centre, radius]: solid discs that always face the camera (heads, the dog's hip/chest);
##  - triangles [a, b, c]: solid (the dog's ears).
## Widths and radii are in local units, so they scale with the node like the stick lines do.
## Used by every figure whose pose is computed rather than played from a clip: the dog, riders, the
## leash owner, the leash itself. No shadows cast or received.
extends Node3D

const StickNpc := preload("res://npc/stick_npc.gd")
const STICK_LINE_SHADER := preload("res://style/stick_line.gdshader")
const DISC_SIDES := 24

var _lines: MeshInstance3D
var _solids: MeshInstance3D
var _disc_mesh: ArrayMesh
var _disc_mat: StandardMaterial3D
var _discs: Array[MeshInstance3D] = []

## ink: the figure colour; depth_bias: metres the lines are pulled toward the camera (StickNpc uses 0.03).
func setup(ink: Color, depth_bias: float) -> void:
	var line_mat := ShaderMaterial.new()
	line_mat.shader = STICK_LINE_SHADER
	line_mat.set_shader_parameter("line_color", ink)
	line_mat.set_shader_parameter("depth_bias", depth_bias)
	_lines = _instance(line_mat)
	_solids = _instance(_solid_material(ink, false))
	_disc_mat = _solid_material(ink, true)
	var v := PackedVector3Array()
	for i in DISC_SIDES:
		var a0 := TAU * i / DISC_SIDES
		var a1 := TAU * (i + 1) / DISC_SIDES
		v.append_array([Vector3.ZERO, Vector3(cos(a0), sin(a0), 0), Vector3(cos(a1), sin(a1), 0)])
	_disc_mesh = _triangles_mesh(v)

func draw(segments: Array, discs: Array, triangles: Array) -> void:
	_lines.mesh = StickNpc.segments_mesh(segments) if not segments.is_empty() else null
	var v := PackedVector3Array()
	for t in triangles:
		v.append_array([t[0], t[1], t[2]])
	_solids.mesh = _triangles_mesh(v) if not v.is_empty() else null
	while _discs.size() < discs.size():
		var d := _instance(_disc_mat)
		d.mesh = _disc_mesh
		_discs.append(d)
	for i in _discs.size():
		_discs[i].visible = i < discs.size()
		if i < discs.size():
			_discs[i].position = discs[i][0]
			_discs[i].scale = Vector3.ONE * discs[i][1]

func _instance(mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi

static func _solid_material(ink: Color, billboard: bool) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.disable_receive_shadows = true
	m.albedo_color = ink
	if billboard:
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.billboard_keep_scale = true
	return m

static func _triangles_mesh(v: PackedVector3Array) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m
