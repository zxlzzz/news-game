## One NPC stick figure: plays a clip from res://npc/motion frame by frame at the clip's fps, looping.
## Every shown frame is mapped live with skeleton_mapping.gd (port of the accepted mapping) and drawn the
## way main.gd _add_stick draws: segments through a line shader (stick_line: round caps, width in figure
## metres), a solid head disc facing the camera.
## Root motion (design_route_npc_motion_supply.md line 73): the node position is where the NPC stood when
## the current pass of the clip began; within a pass the figure consumes the clip's own root displacement
## relative to its first frame (never the clip's absolute coordinates); at each loop the position advances
## by that pass's displacement, so the NPC carries on from where it is instead of jumping back.
## No shadow casting, no shadow receiving.
extends Node3D

const NpcData := preload("res://npc/npc_data.gd")
const SkeletonMapper := preload("res://npc/skeleton_mapping.gd")
const STICK_LINE_SHADER := preload("res://style/stick_line.gdshader")

var P: Dictionary        # skeleton-params.json
var mapper               # skeleton_mapping.gd instance
var frames: Array        # source frames of the clip (metres, Y up)
var fps: float
var origin: Array        # clip frame 0 Hips = the mapping's clipOrigin
var pass_disp: Vector3   # node-local: mapped root H (xz) at the last frame minus at the first frame
var clip_time := 0.0
var shown := -1
var line_mi: MeshInstance3D
var head_mi: MeshInstance3D

## cfg: contents of npc_scene.json. Call after the node is in the tree (the head disc faces cam).
## Returns "" when playing, otherwise the error message (the NPC then stays stopped).
func setup(cfg: Dictionary, cam: Camera3D) -> String:
	set_process(false)
	var err := _check_config(cfg)
	if err != "":
		return err
	var got := {}
	err = NpcData.load_params(got)
	if err != "":
		return err
	P = got["value"]
	err = NpcData.load_joint_names(got)
	if err != "":
		return err
	var names: Array = got["value"]
	err = NpcData.load_clip(NpcData.REST_CLIP, names.size(), got)
	if err != "":
		return err
	mapper = SkeletonMapper.new(names, got["value"]["frames"][NpcData.REST_FRAME])
	if mapper.error != "":
		return mapper.error
	err = NpcData.load_clip(cfg["clip"], names.size(), got)
	if err != "":
		return err
	frames = got["value"]["frames"]
	fps = got["value"]["fps"]
	origin = frames[0][mapper.J["Hips"]]
	var last: Dictionary = mapper.mapFrame(frames[frames.size() - 1], P, origin)
	pass_disp = Vector3(last["H"][0] - origin[0], 0.0, last["H"][2] - origin[2])
	var t: Array = cfg["pos"]
	position = Vector3(t[0], t[1], t[2])
	rotation_degrees.y = cfg["yaw"]
	scale = Vector3.ONE * cfg["scale"]
	var lc: Array = cfg["line_color"]
	var ink := Color(lc[0], lc[1], lc[2])
	var mat := ShaderMaterial.new()
	mat.shader = STICK_LINE_SHADER
	mat.set_shader_parameter("line_color", ink)
	mat.set_shader_parameter("depth_bias", cfg["depth_bias"])
	line_mi = MeshInstance3D.new()
	line_mi.material_override = mat
	line_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(line_mi)
	head_mi = _head_disc(cam, P["headR"], ink)
	add_child(head_mi)
	_show(0)
	set_process(true)
	return ""

func _check_config(cfg: Dictionary) -> String:
	for k in ["clip", "pos", "yaw", "scale", "line_color", "depth_bias"]:
		if not cfg.has(k):
			return "npc config: missing " + k
	if not (cfg["clip"] is String):
		return "npc config: clip must be a clip id"
	for k in ["pos", "line_color"]:
		var v = cfg[k]
		if not (v is Array) or v.size() != 3 or not (NpcData.is_number(v[0]) and NpcData.is_number(v[1]) and NpcData.is_number(v[2])):
			return "npc config: %s must be [a, b, c]" % k
	for k in ["yaw", "scale", "depth_bias"]:
		if not NpcData.is_number(cfg[k]):
			return "npc config: %s must be a number" % k
	if cfg["scale"] <= 0:
		return "npc config: scale must be positive"
	return ""

func _process(delta: float) -> void:
	clip_time += delta
	var period := frames.size() / fps
	while clip_time >= period:
		clip_time -= period
		position += basis * pass_disp  # next pass starts where this one ended
	var i := mini(int(clip_time * fps), frames.size() - 1)
	if i != shown:
		_show(i)

func _show(i: int) -> void:
	shown = i
	var f: Dictionary = mapper.mapFrame(frames[i], P, origin)
	var segs := []
	for sg in f["segs"]:
		segs.append([_local(sg[0]), _local(sg[1]), P["line"] * sg[2]])
	line_mi.mesh = _segments_mesh(segs)
	head_mi.position = _local(f["head"])

## Mapped point (metres, clip space) -> node-local: horizontal relative to the clip's first-frame Hips,
## vertical unchanged (the mapping keeps the ground at y = 0).
func _local(p: Array) -> Vector3:
	return Vector3(p[0] - origin[0], p[1], p[2] - origin[2])

## Solid head disc facing the camera, as in main.gd _add_stick; built once around the local origin and
## moved to the mapped head centre each frame (the node only translates after setup).
func _head_disc(cam: Camera3D, head_r: float, ink: Color) -> MeshInstance3D:
	var cb := global_transform.basis.inverse() * cam.global_transform.basis
	var ux := cb.x.normalized(); var uy := cb.y.normalized(); var uz := cb.z.normalized()
	var disc := PackedVector3Array()
	var n := 24
	for i in n:
		var a0 := TAU * i / n; var a1 := TAU * (i + 1) / n
		disc.append_array([uz * 0.02, uz * 0.02 + (ux * cos(a0) + uy * sin(a0)) * head_r, uz * 0.02 + (ux * cos(a1) + uy * sin(a1)) * head_r])
	var darr := []
	darr.resize(Mesh.ARRAY_MAX)
	darr[Mesh.ARRAY_VERTEX] = disc
	var dm := ArrayMesh.new()
	dm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, darr)
	var di := MeshInstance3D.new()
	di.mesh = dm
	var dmat := StandardMaterial3D.new()
	dmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dmat.cull_mode = BaseMaterial3D.CULL_DISABLED
	dmat.disable_receive_shadows = true
	dmat.albedo_color = ink
	di.material_override = dmat
	di.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return di

## main.gd _segments_mesh re-packed for stick_line.gdshader: same 4 vertices / 2 triangles per segment and
## the same CUSTOM0 (other endpoint + side); CUSTOM1 = (width in figure metres, 0 at the start / 1 at the
## end of the segment, 0, 0) replaces the face normals, which stick segments never used.
func _segments_mesh(segs: Array) -> ArrayMesh:
	var V := PackedVector3Array(); var C0 := PackedFloat32Array(); var C1 := PackedFloat32Array()
	var I := PackedInt32Array()
	for sgm in segs:
		var pa: Vector3 = sgm[0]; var pb: Vector3 = sgm[1]; var w: float = sgm[2]
		var base := V.size()
		for q in [[pa, pb, -1.0, 0.0], [pa, pb, 1.0, 0.0], [pb, pa, -1.0, 1.0], [pb, pa, 1.0, 1.0]]:
			V.append(q[0])
			C0.append_array([q[1].x, q[1].y, q[1].z, q[2]])
			C1.append_array([w, q[3], 0.0, 0.0])
		I.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = V
	arrays[Mesh.ARRAY_CUSTOM0] = C0
	arrays[Mesh.ARRAY_CUSTOM1] = C1
	arrays[Mesh.ARRAY_INDEX] = I
	var fmt := (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) \
		| (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT)
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, fmt)
	return m
