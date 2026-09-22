## Style test harness: builds a scene from params JSON plus one walking NPC stick figure (npc/).
## Watch:     godot --path .      (params default to res://params/terrace.json; keeps running)
## One frame: godot --path . -- --params res://params/terrace.json --out /tmp/x.png   (renders, saves PNG, quits)
## Mapping:   godot --path . --headless -- --check-mapping   (prints MAPPING_OK / MAPPING_FAIL, quits)
extends Node3D
const InkBuilder = preload("res://style/ink_builder.gd")
const NpcData = preload("res://npc/npc_data.gd")
const StickNpc = preload("res://npc/stick_npc.gd")
const MappingCheck = preload("res://npc/mapping_check.gd")
## The walking NPC: clip, placement, size, ink (see npc/stick_npc.gd).
const NPC_CONFIG := "res://npc/npc_scene.json"

var P: Dictionary
var out_path := ""
var frame := 0
var cam: Camera3D

func _ready() -> void:
	if "--check-mapping" in OS.get_cmdline_user_args() or "--check-mapping" in OS.get_cmdline_args():
		get_tree().quit(MappingCheck.run())
		return
	print("t0 ", Time.get_ticks_msec())
	var args := OS.get_cmdline_user_args()
	var ppath := "res://params/terrace.json"
	for i in args.size():
		if args[i] == "--params": ppath = args[i + 1]
		if args[i] == "--out": out_path = args[i + 1]
	P = JSON.parse_string(FileAccess.get_file_as_string(ppath))
	var res: Array = P.get("resolution", [1920, 1080])
	get_window().size = Vector2i(res[0], res[1])
	_setup_env()
	_setup_light()
	_setup_camera()
	var line_mat := ShaderMaterial.new()
	line_mat.shader = InkBuilder.LINE_SHADER
	for k in P["line"]:
		line_mat.set_shader_parameter(k, _v(P["line"][k], k))
	var fill := {}
	for k in P["fill"]:
		fill[k] = _v(P["fill"][k], k)
	var palette: Dictionary = P.get("palette", {})
	var slot_map: Dictionary = P.get("slot_map", {})
	var unmapped := {}
	for m in P["models"]:
		var node := _load_glb(m["file"])
		if node == null: continue
		var t: Array = m.get("pos", [0, 0, 0])
		node.position = Vector3(t[0], t[1], t[2])
		node.rotation_degrees.y = m.get("yaw", 0.0)
		var sc: float = m.get("scale", 1.0)
		node.scale = Vector3.ONE * sc
		add_child(node)
		InkBuilder.apply(node, fill, line_mat, P.get("crease_deg", 35.0), palette, slot_map, unmapped)
	if not unmapped.is_empty():
		print("UNMAPPED MATERIALS (using texture average): ", unmapped.keys())
	for s in P.get("sticks", []):
		_add_stick(s, fill)
	if not _add_npc():
		return
	_setup_grade()
	print("built ", Time.get_ticks_msec())

func _v(x, key := ""):
	if x is Array and key.ends_with("color"):
		return Color(x[0], x[1], x[2])
	if x is Array:
		if x.size() == 3: return Vector3(x[0], x[1], x[2])
		if x.size() == 2: return Vector2(x[0], x[1])
		if x.size() == 4: return Vector4(x[0], x[1], x[2], x[3])
	return x

func _load_glb(path: String) -> Node3D:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var err := doc.append_from_file(ProjectSettings.globalize_path(path), st)
	if err != OK:
		push_error("load failed " + path)
		return null
	return doc.generate_scene(st)

func _setup_env() -> void:
	var we := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	var bg: Array = P.get("background", [0.5, 0.5, 0.5])
	e.background_color = Color(bg[0], bg[1], bg[2])
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color.BLACK
	e.ambient_light_energy = 0.0
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	we.environment = e
	add_child(we)

func _setup_light() -> void:
	var L := DirectionalLight3D.new()
	var l: Dictionary = P["light"]
	L.rotation_degrees = Vector3(l["pitch"], l["yaw"], 0)
	L.shadow_enabled = l.get("shadows", true)
	L.directional_shadow_mode = [DirectionalLight3D.SHADOW_ORTHOGONAL, DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS, DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS][int(l.get("shadow_mode", 0))]
	L.directional_shadow_max_distance = l.get("shadow_distance", 120.0)
	L.shadow_bias = l.get("shadow_bias", 0.03)
	L.shadow_normal_bias = l.get("shadow_normal_bias", 1.0)
	L.light_energy = 1.0
	if l.has("shadow_blur"): L.shadow_blur = l["shadow_blur"]
	if l.has("split"): L.directional_shadow_split_1 = l["split"]
	add_child(L)

func _setup_camera() -> void:
	cam = Camera3D.new()
	var c: Dictionary = P["camera"]
	var tgt: Array = c["target"]
	var target := Vector3(tgt[0], tgt[1], tgt[2])
	var yaw := deg_to_rad(c["yaw"]); var pitch := deg_to_rad(c["pitch"])
	var dir := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	cam.position = target + dir * c.get("distance", 60.0)
	add_child(cam)
	cam.look_at(target)
	if c.get("ortho", true):
		cam.projection = Camera3D.PROJECTION_ORTHOGONAL
		cam.size = c["size"]
	else:
		cam.fov = c.get("fov", 30.0)
	cam.near = 0.5; cam.far = 300.0
	cam.current = true

func _setup_grade() -> void:
	if not P.has("grade"): return
	var layer := CanvasLayer.new()
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	var m := ShaderMaterial.new()
	m.shader = preload("res://style/grade.gdshader")
	for k in P["grade"]:
		m.set_shader_parameter(k, _v(P["grade"][k], k))
	var res: Array = P.get("resolution", [1920, 1080])
	m.set_shader_parameter("aspect", float(res[0]) / res[1])
	rect.material = m
	layer.add_child(rect)
	add_child(layer)

# ---------- stick figure ----------
const BONES := [["body", "neck"], ["neck", "head"], ["neck", "l_elbow"], ["l_elbow", "l_hand"],
	["neck", "r_elbow"], ["r_elbow", "r_hand"], ["body", "l_knee"], ["l_knee", "l_foot"],
	["body", "r_knee"], ["r_knee", "r_foot"]]

func _add_stick(s: Dictionary, fill: Dictionary) -> void:
	var data = JSON.parse_string(FileAccess.get_file_as_string(s["file"]))
	var fr: Dictionary = data["frames"][int(s.get("frame", 0))]
	var root := Node3D.new()
	var t: Array = s["pos"]
	root.position = Vector3(t[0], t[1], t[2])
	root.rotation_degrees.y = s.get("yaw", 0.0)
	add_child(root)
	var J := {}
	for k in fr:
		J[k] = Vector3(fr[k][0], fr[k][1], fr[k][2])
	var head_r: float = s.get("head_radius", 0.13)
	var head_c: Vector3 = J["head"] - Vector3(0, head_r, 0)
	var segs := []
	for b in BONES:
		var a: Vector3 = J[b[0]]; var e: Vector3 = J[b[1]]
		if b[1] == "head":
			e = head_c - (head_c - J["neck"]).normalized() * head_r
		segs.append([a, e])
	# solid head disc, facing the camera (in the root's local frame)
	var cb := root.global_transform.basis.inverse() * cam.global_transform.basis
	var ux := cb.x.normalized(); var uy := cb.y.normalized(); var uz := cb.z.normalized()
	var disc := PackedVector3Array()
	var n := 24
	for i in n:
		var a0 := TAU * i / n; var a1 := TAU * (i + 1) / n
		disc.append_array([head_c + uz * 0.02, head_c + uz * 0.02 + (ux * cos(a0) + uy * sin(a0)) * head_r, head_c + uz * 0.02 + (ux * cos(a1) + uy * sin(a1)) * head_r])
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
	var lc: Array = s["line"]["line_color"]
	dmat.albedo_color = Color(lc[0], lc[1], lc[2])
	di.material_override = dmat
	di.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(di)
	var lm := _segments_mesh(segs)
	var li := MeshInstance3D.new()
	li.mesh = lm
	var mat := ShaderMaterial.new()
	mat.shader = InkBuilder.LINE_SHADER
	for k in s["line"]:
		mat.set_shader_parameter(k, _v(s["line"][k], k))
	li.material_override = mat
	li.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(li)
	# (no shadow for stick figures, by decision 2026-09-19)

## One NPC stick figure playing a clip with the accepted mapping (npc/stick_npc.gd), settings in NPC_CONFIG.
## Any missing or malformed data stops the program with an error.
func _add_npc() -> bool:
	var got := {}
	var err: String = NpcData.read_json(NPC_CONFIG, got)
	if err == "":
		if not (got["value"] is Dictionary):
			err = NPC_CONFIG + ": not a JSON object"
		else:
			var npc := StickNpc.new()
			npc.name = "npc"
			add_child(npc)
			err = npc.setup(got["value"], cam)
	if err != "":
		push_error("NPC: " + err)
		printerr("NPC: ", err)
		get_tree().quit(1)
		return false
	return true

func _basis_y(up: Vector3) -> Basis:
	var x := up.cross(Vector3.FORWARD)
	if x.length() < 0.01: x = up.cross(Vector3.RIGHT)
	x = x.normalized()
	var z := x.cross(up).normalized()
	return Basis(x, up, z)

func _segments_mesh(segs: Array) -> ArrayMesh:
	var V := PackedVector3Array(); var C0 := PackedFloat32Array(); var C1 := PackedFloat32Array(); var C2 := PackedFloat32Array()
	var I := PackedInt32Array()
	for sgm in segs:
		var pa: Vector3 = sgm[0]; var pb: Vector3 = sgm[1]
		var base := V.size()
		for q in [[pa, pb, -1.0], [pa, pb, 1.0], [pb, pa, -1.0], [pb, pa, 1.0]]:
			V.append(q[0])
			C0.append_array([q[1].x, q[1].y, q[1].z, q[2]])
			C1.append_array([0.0, 1.0, 0.0, 1.0])
			C2.append_array([0.0, 1.0, 0.0, 0.0])
		I.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = V
	arrays[Mesh.ARRAY_CUSTOM0] = C0
	arrays[Mesh.ARRAY_CUSTOM1] = C1
	arrays[Mesh.ARRAY_CUSTOM2] = C2
	arrays[Mesh.ARRAY_INDEX] = I
	var fmt := (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM0_SHIFT) \
		| (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM1_SHIFT) \
		| (Mesh.ARRAY_CUSTOM_RGBA_FLOAT << Mesh.ARRAY_FORMAT_CUSTOM2_SHIFT)
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, fmt)
	return m

func _process(_d: float) -> void:
	if out_path == "":
		return  # no --out: keep running so the NPC plays
	frame += 1
	print("frame ", frame, " ", Time.get_ticks_msec())
	if frame == 6:
		var img := get_viewport().get_texture().get_image()
		img.save_png(out_path)
		get_tree().quit()
