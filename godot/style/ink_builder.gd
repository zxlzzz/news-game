## Builds screen-space line meshes from ordinary meshes and applies the ink style to a node tree.

extends RefCounted

const LINE_SHADER := preload("res://style/ink_line.gdshader")
const FILL_SHADER := preload("res://style/ink_fill.gdshader")
const SHADOW_PROXY := preload("res://style/shadow_proxy.gdshader")

## Extract drawable edges of `mesh`.
## boundary edges and edges sharper than crease_deg are always drawn;
## smooth edges are kept as silhouette candidates; coplanar edges are dropped.
static func build_lines(mesh: Mesh, crease_deg: float, weld: float = 0.0005, skip_surfaces: Array = []) -> ArrayMesh:
	var key_to_id := {}
	var P := PackedVector3Array()
	var faces: Array[Vector3i] = []
	var fn := PackedVector3Array()
	for s in mesh.get_surface_count():
		if s in skip_surfaces:
			continue
		var arr := mesh.surface_get_arrays(s)
		var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var idx = arr[Mesh.ARRAY_INDEX]
		var remap := PackedInt32Array()
		remap.resize(verts.size())
		for i in verts.size():
			var v := verts[i]
			var k := Vector3i(roundi(v.x / weld), roundi(v.y / weld), roundi(v.z / weld))
			if not key_to_id.has(k):
				key_to_id[k] = P.size()
				P.append(v)
			remap[i] = key_to_id[k]
		var tri_count: int = (idx.size() if idx != null and idx.size() > 0 else verts.size()) / 3
		for t in tri_count:
			var ia: int; var ib: int; var ic: int
			if idx != null and idx.size() > 0:
				ia = idx[t * 3]; ib = idx[t * 3 + 1]; ic = idx[t * 3 + 2]
			else:
				ia = t * 3; ib = t * 3 + 1; ic = t * 3 + 2
			var a := remap[ia]; var b := remap[ib]; var c := remap[ic]
			if a == b or b == c or a == c:
				continue
			var nrm := (P[b] - P[a]).cross(P[c] - P[a])
			if nrm.length_squared() < 1e-14:
				continue
			faces.append(Vector3i(a, b, c))
			fn.append(nrm.normalized())
	var edges := {}
	for f in faces.size():
		var tri := faces[f]
		for e in [Vector2i(tri.x, tri.y), Vector2i(tri.y, tri.z), Vector2i(tri.z, tri.x)]:
			var k := Vector2i(mini(e.x, e.y), maxi(e.x, e.y))
			if edges.has(k):
				edges[k].append(f)
			else:
				edges[k] = [f]
	var cos_crease := cos(deg_to_rad(crease_deg))
	var V := PackedVector3Array(); var C0 := PackedFloat32Array(); var C1 := PackedFloat32Array(); var C2 := PackedFloat32Array()
	var I := PackedInt32Array()
	for k in edges:
		var fl: Array = edges[k]
		var na: Vector3; var nb: Vector3; var kind := 1.0
		if fl.size() == 2:
			na = fn[fl[0]]; nb = fn[fl[1]]
			var d := na.dot(nb)
			if d > 0.9995:
				continue
			if d > cos_crease:
				kind = 0.0
		else:
			na = fn[fl[0]]; nb = na
		var pa := P[k.x]; var pb := P[k.y]
		var base := V.size()
		for q in [[pa, pb, -1.0], [pa, pb, 1.0], [pb, pa, -1.0], [pb, pa, 1.0]]:
			V.append(q[0])
			C0.append_array([q[1].x, q[1].y, q[1].z, q[2]])
			C1.append_array([na.x, na.y, na.z, kind])
			C2.append_array([nb.x, nb.y, nb.z, 0.0])
		I.append_array([base, base + 1, base + 2, base, base + 2, base + 3])
	var out := ArrayMesh.new()
	if V.is_empty():
		return out
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
	out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, fmt)
	return out

## Average color of a material: albedo_color x mean of albedo texture (if any).
static func material_color(mat: Material) -> Color:
	if mat is BaseMaterial3D:
		var c: Color = mat.albedo_color
		var tex: Texture2D = mat.albedo_texture
		if tex != null:
			var img := tex.get_image()
			if img != null:
				if img.is_compressed():
					img.decompress()
				img = img.duplicate()
				img.resize(1, 1, Image.INTERPOLATE_BILINEAR)
				var t := img.get_pixel(0, 0)
				c = Color(c.r * t.r, c.g * t.g, c.b * t.b, c.a)
		return c
	return Color(0.8, 0.8, 0.8)

## Resolve a material name to a slot: exact name first, then wildcard patterns ("MI_RedBrick*").
static func resolve_slot(mat_name: String, slot_map: Dictionary) -> String:
	if slot_map.has(mat_name):
		return slot_map[mat_name]
	for pat in slot_map:
		if mat_name.match(pat):
			return slot_map[pat]
	return mat_name

## Replace every surface material in `root` with the fill shader and add a line child per mesh.
## palette: slot (String) -> {color: Color, flat, hide, no_lines, no_shadow: bool}; built by core/level.gd
## slot_map: material name (or wildcard) -> slot. A material whose name is itself a palette slot needs no entry.
static func apply(root: Node, fill_params: Dictionary, line_mat: ShaderMaterial, crease_deg: float, palette := {}, slot_map := {}, unmapped := {}) -> void:
	var meshes: Array[MeshInstance3D] = []
	_collect(root, meshes)
	for mi in meshes:
		var mesh := mi.mesh
		if mesh == null:
			continue
		var skip_lines := []
		var proxy_mats := []
		for s in mesh.get_surface_count():
			var src := mi.get_active_material(s)
			var mname := String(src.resource_name) if src != null else ""
			var slot := resolve_slot(mname, slot_map)
			var entry: Dictionary = palette.get(slot, {})
			if entry.is_empty():
				unmapped[mname] = true
			var col: Color
			if entry.has("color"):
				col = entry["color"]
			else:
				col = material_color(src)
			var m := ShaderMaterial.new()
			m.shader = FILL_SHADER
			for p in fill_params:
				m.set_shader_parameter(p, fill_params[p])
			m.set_shader_parameter("base_color", Color(col.r, col.g, col.b))
			m.set_shader_parameter("flat_color", entry.get("flat", false))
			if src is BaseMaterial3D and src.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED and src.albedo_texture != null:
				m.set_shader_parameter("use_alpha_tex", true)
				m.set_shader_parameter("alpha_tex", src.albedo_texture)
			if entry.get("hide", false):
				var hm := ShaderMaterial.new()
				hm.shader = SHADOW_PROXY
				hm.set_shader_parameter("skip", true)
				mi.set_surface_override_material(s, hm)
			else:
				mi.set_surface_override_material(s, m)
			if entry.get("hide", false) or entry.get("no_lines", false):
				skip_lines.append(s)
			var pm := ShaderMaterial.new()
			pm.shader = SHADOW_PROXY
			pm.set_shader_parameter("skip", entry.get("hide", false) or entry.get("no_shadow", false))
			proxy_mats.append(pm)
		var proxy := MeshInstance3D.new()
		proxy.name = "shadow_proxy"
		proxy.mesh = mesh
		for s in proxy_mats.size():
			proxy.set_surface_override_material(s, proxy_mats[s])
		proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.add_child(proxy)
		var lm := build_lines(mesh, crease_deg, 0.0005, skip_lines)
		if lm.get_surface_count() > 0:
			var li := MeshInstance3D.new()
			li.name = "ink_lines"
			li.mesh = lm
			li.material_override = line_mat
			li.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.add_child(li)

static func _collect(n: Node, out: Array[MeshInstance3D]) -> void:
	if n is MeshInstance3D and n.name != "ink_lines" and n.name != "shadow_proxy":
		out.append(n)
	for c in n.get_children():
		_collect(c, out)
