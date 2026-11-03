## Where people can walk or ride in a level, derived from the level itself (scene_spec.md §3), and
## paths across it, on more than one level: bridges over paths, steps, curbs. Nothing about it is
## written in the level file.
##
## Faces. Every cell (grid.cell metres square) keeps, looking straight down through its centre, every
## surface one could stand on: the height and colour slot of each upward face (normal y >= 0.7) of the
## level's objects and ground bands (GroundStrip), found at the cell centre. Faces nobody can walk on
## (water, roofs, bench seats) are kept too. A face is covered, and nobody stands on it, when within
## clearanceHeight above it there is any other non-vertical face: the ground under a plaza slab, a
## bench, inside a pier. Faces within heightTolerance of each other are one face.
##  - marking objects (group "marking") neither give faces nor block; nor does a backdrop node (group
##    "backdrop": scenery round the edges, drawn but outside where anyone goes);
##  - a crosswalk object (group "crosswalk") gives no faces; it makes the bands it lies on that walkers
##    cannot use walkable across its own width, at the "crosswalk" cost (on road modules, the road
##    faces from curb to curb: _cut_crossing_faces);
##  - paving objects (group "paving": plazas, paths, bridges, steps) are meant to be walked on: their
##    faces, like the ground bands', must be reachable (unreachable_areas()).
## Links. Two faces in neighbouring cells connect in a mode when their heights differ by at most one
## step (maxStep, per mode) and no vertical face (|normal y| < 0.7) stands between their centres in
## the heights from one step above the lower face to clearanceHeight above it: a railing blocks, a
## riser or a bridge's edge far overhead does not. Diagonal moves need both side moves. A face within
## clearance of a break (a side with no linked face in a neighbouring cell: an edge, a drop, a wall)
## is not used, which keeps people a body's width off walls and edges; the ends of the grid are not
## breaks, and a face merely unusable in a mode (a road, for walkers) is no break.
## Costs per surface and mode ("walk", "ride") are in core/walk_costs.json: a surface missing from a
## mode cannot be used in it. Paths are found with an AStar3D per mode (one point per usable face,
## weight = cost) and straightened between faces of the same height where a straight line stays on
## linked faces of that height no dearer than its ends; path points carry the faces' heights.
## Why not NavigationRegion3D (scene_spec §3's first idea): one region per cost means baking each
## surface separately, and every bake shrinks its region by the walker's radius, so neighbouring
## regions of different cost no longer touch and never connect.
extends RefCounted

const COSTS := "res://core/walk_costs.json"
const InkBuilder := preload("res://style/ink_builder.gd")
const MODES := ["walk", "ride"]
const FLOOR_NY := 0.7   # |normal y| at or above: a floor (up) or an underside (down); below: vertical
const PARAMS := ["cell", "clearance", "clearanceHeight", "exitMaxCost", "maxStep", "heightTolerance"]
const DIRS := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]

var error := ""
var cell: float
var x0: float           # world x of column 0's left edge
var z0: float           # world z of row 0's near edge
var cols: int
var rows: int
## Faces, bottom to top within each cell; cell i's faces are cell_start[i] .. cell_start[i + 1] - 1.
var cell_start: PackedInt32Array
var face_cell: PackedInt32Array
var face_y: PackedFloat32Array
var face_slot: Array[StringName] = []
var face_band: PackedInt32Array     # ground band index, -1 for an object's face
var face_must: PackedByteArray      # a ground band's or a paving object's face: must be reachable
var face_covered: PackedByteArray
var costs: Dictionary   # mode -> PackedFloat32Array per face (0 = not usable in that mode)
var graphs: Dictionary  # mode -> AStar3D, point id = face index
var exit_max_cost: float
var reachable: PackedByteArray   # per face, walk mode: 1 = can be got to from a way in
var _p: Dictionary
var _walk_table: Dictionary
var _strips: Array[GroundStrip] = []
## Band numbers of faces are strip index * BAND_STRIDE + band index, so bands of different strips differ.
const BAND_STRIDE := 1000
var _wall_a := PackedVector2Array()
var _wall_b := PackedVector2Array()
var _wall_c := PackedVector2Array()
var _wall_lo := PackedFloat32Array()
var _wall_hi := PackedFloat32Array()
var _cell_walls := {}   # cell -> Array of wall indices whose footprint touches the cell
## Read from the cache file instead of built (see _init).
var from_cache := false
var _cache := ""
var _print := ""

## level: a core/level.gd node (its direct children are the objects); p: crowd-params "grid"
## (PARAMS); slot_map: material name -> slot (Level.slot_map). Check `error` after construction.
## cache: a user:// file. The grid follows from files only (the level, its types and models, the
## parameters, this code), so a grid built once is saved there with a fingerprint of those files and
## read back while they are unchanged (from_cache), else built; save() writes it once the caller
## has checked the built grid. "" always builds (the checks do).
func _init(level: Node3D, p: Dictionary, slot_map: Dictionary, cache := "") -> void:
	for k in PARAMS:
		if not p.has(k):
			error = "grid parameters have no %s" % k
			return
	for mode in MODES:
		if not (p.maxStep is Dictionary and p.maxStep.has(mode)):
			error = "grid.maxStep has no %s" % mode
			return
	_p = p
	var table = JSON.parse_string(FileAccess.get_file_as_string(COSTS))
	if not (table is Dictionary):
		error = COSTS + ": not a JSON object"
		return
	for mode in MODES:
		if not table.has(mode):
			error = "%s: no %s table" % [COSTS, mode]
			return
	_walk_table = table.walk
	cell = p.cell
	exit_max_cost = p.exitMaxCost
	if cache != "":
		_cache = cache
		_print = _fingerprint(level, p)
		if _load(cache, _print):
			from_cache = true
			return
	_build(level, slot_map, table)

func _build(level: Node3D, slot_map: Dictionary, table: Dictionary) -> void:
	var tris := _Tris.new()
	var crosswalks := []
	for c in level.get_children():
		if not (c is Node3D):
			continue
		if c is GroundStrip:
			if not c.basis.is_equal_approx(Basis.IDENTITY):
				error = "GroundStrip %s is turned or scaled: strips may only be moved" % c.name
				return
			_strips.append(c)
			_gather(c, _strips.size() - 1, true, slot_map, tris)
		elif c.is_in_group(&"marking") or c.is_in_group(&"backdrop"):
			continue
		elif c.is_in_group(&"crosswalk"):
			crosswalks.append(c)
		else:
			_gather(c, -1, c.is_in_group(&"paving"), slot_map, tris)
		if error != "":
			return
	if not tris.has_floor:
		error = "nothing to stand on: the level has no upward faces"
		return
	x0 = tris.lo.x
	z0 = tris.lo.y
	cols = maxi(1, ceili((tris.hi.x - x0) / cell))
	rows = maxi(1, ceili((tris.hi.y - z0) / cell))
	_build_faces(tris)
	for w in tris.wall_count():
		_add_wall(tris, w)
	var crossing := PackedByteArray()
	crossing.resize(face_y.size())
	for cw in crosswalks:
		_cut_crossing(cw, crossing)
		if error != "":
			return
	for mode in MODES:
		_build_mode(mode, table[mode], crossing)
	_flood_walk()

# ---------------------------------------------------------------- cache

## Files the grid follows from: this code and the level code, the ground strip, the cost table, the
## material maps, the level file, and every type the level places with what it loads (models and
## their import settings: the import decides the exact vertices).
func _fingerprint(level: Node3D, p: Dictionary) -> String:
	var files := {"res://core/walk_grid.gd": 1, "res://core/level.gd": 1, "res://core/ground_strip.gd": 1,
		"res://core/ground_band.gd": 1, COSTS: 1, level.scene_file_path: 1}
	for f in DirAccess.get_files_at(Level.MATERIAL_MAP_DIR):
		files[Level.MATERIAL_MAP_DIR.path_join(f)] = 1
	for c in level.get_children():
		if c.scene_file_path == "" or files.has(c.scene_file_path):
			continue
		files[c.scene_file_path] = 1
		for dep in ResourceLoader.get_dependencies(c.scene_file_path):
			var path: String = dep.get_slice("::", 2) if dep.contains("::") else dep
			files[path] = 1
			if FileAccess.file_exists(path + ".import"):
				files[path + ".import"] = 1
	var keys := files.keys()
	keys.sort()
	var parts := PackedStringArray([JSON.stringify(p, "", true)])
	for f in keys:
		parts.append("%s %s" % [f, FileAccess.get_md5(f)])
	return "
".join(parts).md5_text()

func _load(path: String, print_: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var fa := FileAccess.open(path, FileAccess.READ)
	var d = fa.get_var() if fa else null
	if not (d is Dictionary) or d.get("fingerprint") != print_:
		return false
	x0 = d.x0
	z0 = d.z0
	cols = d.cols
	rows = d.rows
	cell_start = d.cell_start
	face_cell = d.face_cell
	face_y = d.face_y
	face_slot.assign(Array(d.face_slot).map(func(s): return StringName(s)))
	face_band = d.face_band
	face_must = d.face_must
	face_covered = d.face_covered
	reachable = d.reachable
	for mode in MODES:
		var cost: PackedFloat32Array = d.costs[mode]
		var edges: PackedInt32Array = d.edges[mode]
		var g := AStar3D.new()
		g.reserve_space(cost.size())
		for f in cost.size():
			if cost[f] > 0.0:
				g.add_point(f, face_pos(f), cost[f])
		for k in range(0, edges.size(), 2):
			g.connect_points(edges[k], edges[k + 1])
		costs[mode] = cost
		graphs[mode] = g
	return true

## Writes the built grid to the cache given at construction (nothing without one).
func save() -> void:
	if _cache == "" or from_cache or error != "":
		return
	var path := _cache
	var print_ := _print
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var edges := {}
	for mode in MODES:
		var g: AStar3D = graphs[mode]
		var e := PackedInt32Array()
		for f in g.get_point_ids():
			for j in g.get_point_connections(f):
				if j > f:
					e.append(f)
					e.append(j)
		edges[mode] = e
	var slots := PackedStringArray()
	for s in face_slot:
		slots.append(String(s))
	var d := {"fingerprint": print_, "x0": x0, "z0": z0, "cols": cols, "rows": rows,
		"cell_start": cell_start, "face_cell": face_cell, "face_y": face_y, "face_slot": slots,
		"face_band": face_band, "face_must": face_must, "face_covered": face_covered,
		"reachable": reachable, "costs": costs, "edges": edges}
	var fa := FileAccess.open(path, FileAccess.WRITE)
	if fa == null:
		push_error("walk grid: cannot write cache %s" % path)
		return
	fa.store_var(d)

# ---------------------------------------------------------------- building the grid

## World triangles of the level, split into floors (up and down) and vertical faces.
class _Tris:
	var fv := PackedVector3Array()   # floors, 3 vertices each
	var f_slot: Array[StringName] = []
	var f_band := PackedInt32Array()
	var f_must := PackedByteArray()
	var f_down := PackedByteArray()
	var wv := PackedVector3Array()   # vertical faces, 3 vertices each
	var lo := Vector2(INF, INF)      # x, z extent of the upward faces
	var hi := Vector2(-INF, -INF)
	var has_floor := false
	func wall_count() -> int:
		return wv.size() / 3

func _meshes(n: Node, out: Array) -> void:
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		out.append(n)
	for c in n.get_children():
		_meshes(c, out)

## strip: this object's index in _strips when it is a GroundStrip, else -1.
func _gather(obj: Node3D, strip: int, must: bool, slot_map: Dictionary, t: _Tris) -> void:
	var ms := []
	_meshes(obj, ms)
	for mi in ms:
		var band := -1
		if strip >= 0:
			band = strip * BAND_STRIDE + String(mi.name).split("_")[1].to_int()  # GroundStrip names them band_<i>_<slot>
		var mesh: Mesh = mi.mesh
		var xf: Transform3D = mi.global_transform
		for s in mesh.get_surface_count():
			var mat: Material = mi.get_active_material(s)
			var mname := String(mat.resource_name) if mat else ""
			var slot := StringName(InkBuilder.resolve_slot(mname, slot_map))
			if not Level.SLOTS.slots.has(slot):
				error = "%s: material '%s' maps to no colour slot (core/material_maps)" % [obj.name, mname]
				return
			var arr: Array = mesh.surface_get_arrays(s)
			var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			if arr[Mesh.ARRAY_NORMAL] == null:
				error = "%s: mesh %s has no normals" % [obj.name, mi.name]
				return
			var nrm: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
			var count := idx.size() if idx.size() > 0 else v.size()
			for k in range(0, count, 3):
				var i0 := idx[k] if idx.size() > 0 else k
				var i1 := idx[k + 1] if idx.size() > 0 else k + 1
				var i2 := idx[k + 2] if idx.size() > 0 else k + 2
				var a: Vector3 = xf * v[i0]
				var b: Vector3 = xf * v[i1]
				var c: Vector3 = xf * v[i2]
				var g := (b - a).cross(c - a)
				if g.length_squared() < 1e-14:
					continue
				g = g.normalized()
				# winding decides nothing: the side is the one the vertex normals point to
				if g.dot(xf.basis * (nrm[i0] + nrm[i1] + nrm[i2])) < 0:
					g = -g
				if absf(g.y) >= FLOOR_NY:
					t.fv.append(a)
					t.fv.append(b)
					t.fv.append(c)
					t.f_slot.append(slot)
					t.f_band.append(band)
					t.f_must.append(1 if must else 0)
					t.f_down.append(1 if g.y < 0 else 0)
					if g.y > 0:
						t.has_floor = true
						t.lo = Vector2(minf(t.lo.x, minf(a.x, minf(b.x, c.x))), minf(t.lo.y, minf(a.z, minf(b.z, c.z))))
						t.hi = Vector2(maxf(t.hi.x, maxf(a.x, maxf(b.x, c.x))), maxf(t.hi.y, maxf(a.z, maxf(b.z, c.z))))
				else:
					t.wv.append(a)
					t.wv.append(b)
					t.wv.append(c)

func _col(x: float) -> int:
	return clampi(floori((x - x0) / cell), 0, cols - 1)

func _row(z: float) -> int:
	return clampi(floori((z - z0) / cell), 0, rows - 1)

func _centre2(i: int) -> Vector2:
	return Vector2(x0 + (i % cols + 0.5) * cell, z0 + (i / cols + 0.5) * cell)

## World position of a face: its cell centre at its height.
func face_pos(f: int) -> Vector3:
	var c := _centre2(face_cell[f])
	return Vector3(c.x, face_y[f], c.y)

## Every floor triangle sampled at the cell centres it covers; then per cell: merge, cover, keep.
func _build_faces(t: _Tris) -> void:
	var n := cols * rows
	var s_cell := PackedInt32Array()
	var s_y := PackedFloat32Array()
	var s_tri := PackedInt32Array()
	for k in t.fv.size() / 3:
		var a := t.fv[3 * k]
		var b := t.fv[3 * k + 1]
		var c := t.fv[3 * k + 2]
		var d := (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
		if absf(d) < 1e-12:
			continue
		var c0 := maxi(0, ceili((minf(a.x, minf(b.x, c.x)) - x0) / cell - 0.5))
		var c1 := mini(cols - 1, floori((maxf(a.x, maxf(b.x, c.x)) - x0) / cell - 0.5))
		var r0 := maxi(0, ceili((minf(a.z, minf(b.z, c.z)) - z0) / cell - 0.5))
		var r1 := mini(rows - 1, floori((maxf(a.z, maxf(b.z, c.z)) - z0) / cell - 0.5))
		for r in range(r0, r1 + 1):
			var z := z0 + (r + 0.5) * cell
			for col in range(c0, c1 + 1):
				var x := x0 + (col + 0.5) * cell
				var l1 := ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d
				var l2 := ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d
				var l3 := 1.0 - l1 - l2
				if l1 < -1e-6 or l2 < -1e-6 or l3 < -1e-6:
					continue
				s_cell.append(r * cols + col)
				s_y.append(l1 * a.y + l2 * b.y + l3 * c.y)
				s_tri.append(k)
	# samples grouped by cell (counting sort)
	var start := PackedInt32Array()
	start.resize(n + 1)
	for i in s_cell.size():
		start[s_cell[i] + 1] += 1
	for i in n:
		start[i + 1] += start[i]
	var fill := start.duplicate()
	var order := PackedInt32Array()
	order.resize(s_cell.size())
	for i in s_cell.size():
		order[fill[s_cell[i]]] = i
		fill[s_cell[i]] += 1
	var tol: float = _p.heightTolerance
	var clear_h: float = _p.clearanceHeight
	cell_start.resize(n + 1)
	for i in n:
		cell_start[i] = face_y.size()
		var ups: Array[int] = []
		for k in range(start[i], start[i + 1]):
			if not t.f_down[s_tri[order[k]]]:
				ups.append(order[k])
		ups.sort_custom(func(p, q): return s_y[p] < s_y[q])
		var g := 0
		while g < ups.size():
			# one face from the samples within tol of the group's lowest; an object's face over a band's
			var pick: int = ups[g]
			var e := g + 1
			while e < ups.size() and s_y[ups[e]] - s_y[ups[g]] <= tol:
				if t.f_band[s_tri[pick]] >= 0 and t.f_band[s_tri[ups[e]]] < 0:
					pick = ups[e]
				e += 1
			var y: float = s_y[pick]
			var covered := 0
			for k in range(start[i], start[i + 1]):
				var sy: float = s_y[order[k]]
				if (sy > y + tol and sy <= y + clear_h) or (t.f_down[s_tri[order[k]]] and absf(sy - y) <= tol):
					covered = 1
					break
			face_cell.append(i)
			face_y.append(y)
			face_slot.append(t.f_slot[s_tri[pick]])
			face_band.append(t.f_band[s_tri[pick]])
			face_must.append(t.f_must[s_tri[pick]])
			face_covered.append(covered)
			g = e
	cell_start[n] = face_y.size()

func _add_wall(t: _Tris, w: int) -> void:
	var a := t.wv[3 * w]
	var b := t.wv[3 * w + 1]
	var c := t.wv[3 * w + 2]
	var i := _wall_a.size()
	_wall_a.append(Vector2(a.x, a.z))
	_wall_b.append(Vector2(b.x, b.z))
	_wall_c.append(Vector2(c.x, c.z))
	_wall_lo.append(minf(a.y, minf(b.y, c.y)))
	_wall_hi.append(maxf(a.y, maxf(b.y, c.y)))
	var e := 1e-4
	for r in range(_row(minf(a.z, minf(b.z, c.z)) - e), _row(maxf(a.z, maxf(b.z, c.z)) + e) + 1):
		for col in range(_col(minf(a.x, minf(b.x, c.x)) - e), _col(maxf(a.x, maxf(b.x, c.x)) + e) + 1):
			var k := r * cols + col
			if not _cell_walls.has(k):
				_cell_walls[k] = []
			_cell_walls[k].append(i)

## A vertical face crosses the segment p-q (cells ca, cb) somewhere in heights lo..hi.
func _walled(ca: int, cb: int, p: Vector2, q: Vector2, lo: float, hi: float) -> bool:
	for k in [ca, cb]:
		if not _cell_walls.has(k):
			continue
		for w in _cell_walls[k]:
			if _wall_lo[w] >= hi or _wall_hi[w] <= lo:
				continue
			var a := _wall_a[w]
			var b := _wall_b[w]
			var c := _wall_c[w]
			if Geometry2D.segment_intersects_segment(p, q, a, b) != null \
					or Geometry2D.segment_intersects_segment(p, q, b, c) != null \
					or Geometry2D.segment_intersects_segment(p, q, c, a) != null \
					or Geometry2D.point_is_inside_triangle(p, a, b, c):
				return true
	return false

## Band number (strip * BAND_STRIDE + band) of the band at world x, z, or -1.
func _band_at(x: float, z: float) -> int:
	for si in _strips.size():
		var st := _strips[si]
		if absf(x - st.global_position.x) > st.length / 2:
			continue
		var acc := st.global_position.z
		for i in st.bands.size():
			if z >= acc and z < acc + st.bands[i].width:
				return si * BAND_STRIDE + i
			acc += st.bands[i].width
	return -1

func _band_slot(band: int) -> String:
	return String(_strips[band / BAND_STRIDE].bands[band % BAND_STRIDE].slot)

## A crosswalk spans, over its own width, each band it lies on that walkers cannot use (that band
## only: another band with the same slot elsewhere stays uncut). A crosswalk that lies on no band
## (on road modules) cuts the faces instead: see _cut_crossing_faces.
func _cut_crossing(obj: Node3D, crossing: PackedByteArray) -> void:
	var centre: Vector3 = obj.global_position
	if _band_at(centre.x, centre.z) < 0:
		_cut_crossing_faces(obj, crossing)
		return
	var ms := []
	_meshes(obj, ms)
	for mi in ms:
		var box: AABB = mi.global_transform * mi.mesh.get_aabb()
		var hit := {}
		var z := box.position.z
		while z <= box.end.z:
			var b := _band_at(box.get_center().x, z)
			if b >= 0 and not _walk_table.has(_band_slot(b)):
				hit[b] = true
			z += cell / 2
		if hit.is_empty():
			error = "crosswalk %s lies on no ground band walkers cannot use: it has nothing to cut" % obj.name
			return
		var c0 := _col(box.position.x)
		var c1 := _col(box.end.x)
		for f in face_y.size():
			var col := face_cell[f] % cols
			if face_band[f] >= 0 and hit.has(face_band[f]) and col >= c0 and col <= c1:
				crossing[f] = 1

## A crosswalk on road modules. Its stripes run along the model's Z (along the traffic), so people
## cross along its X: over the stripes' length (local Z), the faces at its height that walkers cannot
## use, from curb to curb along local X: the run of such faces is followed past the last stripe until a
## usable face or none, as a band crossing spans its whole band.
func _cut_crossing_faces(obj: Node3D, crossing: PackedByteArray) -> void:
	var ms := []
	_meshes(obj, ms)
	var box := AABB()
	for i in ms.size():
		var b: AABB = obj.global_transform.affine_inverse() * ms[i].global_transform * ms[i].mesh.get_aabb()
		box = b if i == 0 else box.merge(b)
	var centre: Vector3 = obj.global_transform * box.get_center()
	var along := Vector3(obj.global_basis.x.x, 0, obj.global_basis.x.z).normalized()
	var across := Vector3(obj.global_basis.z.x, 0, obj.global_basis.z.z).normalized()
	var half_w := box.size.z / 2
	var road_at := func(q: Vector3) -> bool:
		var i := _row(q.z) * cols + _col(q.x)
		for f in range(cell_start[i], cell_start[i + 1]):
			if absf(face_y[f] - centre.y) <= _p.maxStep.walk and not _walk_table.has(String(face_slot[f])):
				return true
		return false
	var lo := -box.size.x / 2
	var hi := box.size.x / 2
	if not road_at.call(centre):
		error = "crosswalk %s lies on no road: nothing to cut" % obj.name
		return
	while road_at.call(centre + along * (hi + cell)):
		hi += cell
	while road_at.call(centre + along * (lo - cell)):
		lo -= cell
	var corners := [centre + across * half_w + along * lo, centre + across * half_w + along * hi,
		centre - across * half_w + along * lo, centre - across * half_w + along * hi]
	var c0 := cols
	var c1 := 0
	var r0 := rows
	var r1 := 0
	for q in corners:
		c0 = mini(c0, _col(q.x))
		c1 = maxi(c1, _col(q.x))
		r0 = mini(r0, _row(q.z))
		r1 = maxi(r1, _row(q.z))
	for r in range(r0, r1 + 1):
		for c in range(c0, c1 + 1):
			var i := r * cols + c
			var d := Vector3(_centre2(i).x, centre.y, _centre2(i).y) - centre
			var u := d.dot(across)
			var v := d.dot(along)
			if absf(u) > half_w or v < lo - cell / 2 or v > hi + cell / 2:
				continue
			for f in range(cell_start[i], cell_start[i + 1]):
				if absf(face_y[f] - centre.y) <= _p.maxStep.walk and not _walk_table.has(String(face_slot[f])):
					crossing[f] = 1

## The face in cell `to` that face f links to in this mode, or -1 (heights within a step, no wall).
func _link(f: int, to: int, step: float) -> int:
	var clear_h: float = _p.clearanceHeight
	for g in range(cell_start[to], cell_start[to + 1]):
		if face_covered[g] or absf(face_y[g] - face_y[f]) > step:
			continue
		var low := minf(face_y[f], face_y[g])
		if _walled(face_cell[f], to, _centre2(face_cell[f]), _centre2(to), low + step, low + clear_h):
			return -1
		return g
	return -1

func _build_mode(mode: String, t: Dictionary, crossing: PackedByteArray) -> void:
	var step: float = _p.maxStep[mode]
	var clearance: float = _p.clearance
	var nf := face_y.size()
	var links := PackedInt32Array()   # 4 per face, DIRS order; -1 = none
	links.resize(nf * 4)
	links.fill(-1)
	for f in nf:
		if face_covered[f]:
			continue
		var c := face_cell[f] % cols
		var r := face_cell[f] / cols
		if c + 1 < cols:
			var g := _link(f, face_cell[f] + 1, step)
			if g >= 0:
				links[f * 4] = g
				links[g * 4 + 1] = f
		if r + 1 < rows:
			var g := _link(f, face_cell[f] + cols, step)
			if g >= 0:
				links[f * 4 + 2] = g
				links[g * 4 + 3] = f
	# faces within clearance of a break are not used
	var near := PackedByteArray()
	near.resize(nf)
	var reach := ceili(clearance / cell) + 1
	var h := cell / 2
	for f in nf:
		if face_covered[f]:
			continue
		var c := face_cell[f] % cols
		var r := face_cell[f] / cols
		for d in 4:
			var nc: int = c + DIRS[d].x
			var nr: int = r + DIRS[d].y
			if nc < 0 or nc >= cols or nr < 0 or nr >= rows or links[f * 4 + d] >= 0:
				continue
			var m := _centre2(face_cell[f]) + Vector2(DIRS[d]) * h
			var side := Vector2(-DIRS[d].y, DIRS[d].x) * h
			var todo: Array[int] = [f]
			var seen := {f: true}
			while not todo.is_empty():
				var k: int = todo.pop_back()
				if Geometry2D.get_closest_point_to_segment(_centre2(face_cell[k]), m - side, m + side).distance_to(_centre2(face_cell[k])) < clearance:
					near[k] = 1
				for e in 4:
					var j := links[k * 4 + e]
					if j >= 0 and not seen.has(j) and absi(face_cell[j] % cols - c) <= reach and absi(face_cell[j] / cols - r) <= reach:
						seen[j] = true
						todo.append(j)
	var cost := PackedFloat32Array()
	cost.resize(nf)
	var astar := AStar3D.new()
	for f in nf:
		if face_covered[f] or near[f]:
			continue
		var k: float = t.get(String(face_slot[f]), 0.0)
		if mode == "walk" and k == 0.0 and crossing[f]:
			k = t.get("crosswalk", 0.0)
		cost[f] = k
		if k > 0.0:
			astar.add_point(f, face_pos(f), k)
	for f in nf:
		if cost[f] <= 0.0:
			continue
		for d in [0, 2]:
			var g := links[f * 4 + d]
			if g >= 0 and cost[g] > 0.0:
				astar.connect_points(f, g)
		# diagonals: both side moves must be usable and meet in the same face
		var e := links[f * 4]
		if e < 0 or cost[e] <= 0.0:
			continue
		for d in [2, 3]:
			var s := links[f * 4 + d]
			if s < 0 or cost[s] <= 0.0:
				continue
			var via_e := links[e * 4 + d]
			if via_e >= 0 and via_e == links[s * 4] and cost[via_e] > 0.0:
				astar.connect_points(f, via_e)
	costs[mode] = cost
	graphs[mode] = astar

# ---------------------------------------------------------------- queries

## The usable face nearest to p (height counts), or -1.
func snap(mode: String, p: Vector3) -> int:
	var c := _col(p.x)
	var r := _row(p.z)
	var cost: PackedFloat32Array = costs[mode]
	var best := -1
	var best_d := INF
	for ring in range(0, 40):
		if best >= 0 and pow(maxf(0.0, (ring - 1) * cell), 2) > best_d:
			break
		for dr in range(-ring, ring + 1):
			for dc in range(-ring, ring + 1):
				if maxi(absi(dr), absi(dc)) != ring:
					continue
				var rr := r + dr
				var cc := c + dc
				if rr < 0 or rr >= rows or cc < 0 or cc >= cols:
					continue
				var i := rr * cols + cc
				for f in range(cell_start[i], cell_start[i + 1]):
					if cost[f] > 0.0:
						var d := face_pos(f).distance_squared_to(p)
						if d < best_d:
							best_d = d
							best = f
	return best

## World points from a to b (both snapped to usable faces), straightened; empty if unreachable.
func plan(mode: String, a: Vector3, b: Vector3) -> PackedVector3Array:
	var sa := snap(mode, a)
	var sb := snap(mode, b)
	if sa < 0 or sb < 0:
		return PackedVector3Array()
	var ids: PackedInt64Array = graphs[mode].get_id_path(sa, sb)
	if ids.is_empty():
		return PackedVector3Array()
	var keep: Array[int] = [ids[0]]
	var i := 0
	while i < ids.size() - 1:
		var j := ids.size() - 1
		while j > i + 1 and not _clear(mode, ids[i], ids[j]):
			j -= 1
		keep.append(ids[j])
		i = j
	var out := PackedVector3Array()
	for f in keep:
		out.append(face_pos(f))
	return out

## A straight walk from face a to face b stays on linked faces of a's height, none dearer than the
## dearer end.
func _clear(mode: String, a: int, b: int) -> bool:
	var tol: float = _p.heightTolerance
	if absf(face_y[a] - face_y[b]) > tol:
		return false
	var cost: PackedFloat32Array = costs[mode]
	var g: AStar3D = graphs[mode]
	var limit := maxf(cost[a], cost[b])
	var ca := Vector2i(face_cell[a] % cols, face_cell[a] / cols)
	var cb := Vector2i(face_cell[b] % cols, face_cell[b] / cols)
	var steps := maxi(absi(cb.x - ca.x), absi(cb.y - ca.y)) * 2
	var here := a
	for s in range(1, steps + 1):
		var t := float(s) / steps
		var i := roundi(lerpf(ca.y, cb.y, t)) * cols + roundi(lerpf(ca.x, cb.x, t))
		if i == face_cell[here]:
			continue
		var next := -1
		for f in range(cell_start[i], cell_start[i + 1]):
			if cost[f] > 0.0 and cost[f] <= limit and absf(face_y[f] - face_y[a]) <= tol and g.are_points_connected(here, f):
				next = f
				break
		if next < 0:
			return false
		here = next
	return here == b

## The usable face nearest to p, as a world point (p itself if the mode has none: check with snap).
func snap_point(mode: String, p: Vector3) -> Vector3:
	var f := snap(mode, p)
	return face_pos(f) if f >= 0 else p

## Height of the surface under p, for feet (a dog's paws) and ropes: the face nearest p within one
## walking step of p's height, in p's cell or else in the nearest cell around it that has one (covered
## faces count: the ground under a bench is still there). A paw over a building's footprint or a drop
## so lands on the pavement it came from, not on the roof or the ground far below.
func height_at(p: Vector3) -> float:
	var step: float = _p.maxStep.walk
	var c := _col(p.x)
	var r := _row(p.z)
	var best := INF
	var best_d := INF
	for ring in 3:
		for dr in range(-ring, ring + 1):
			for dc in range(-ring, ring + 1):
				if maxi(absi(dr), absi(dc)) != ring or r + dr < 0 or r + dr >= rows or c + dc < 0 or c + dc >= cols:
					continue
				var i := (r + dr) * cols + c + dc
				for f in range(cell_start[i], cell_start[i + 1]):
					if absf(face_y[f] - p.y) <= step:
						var d := face_pos(f).distance_squared_to(p)
						if d < best_d:
							best_d = d
							best = face_y[f]
		if best < INF:
			return best
	push_error("walk grid: no surface within a step of %s" % p)
	return p.y

## Where a mode's usable faces meet the left or right end of the grid: [{point, side, span, faces}],
## side -1 left / +1 right, span the run's z extent, a run being faces linked one row to the next.
## Walking exits only on surfaces no dearer than exitMaxCost (a pavement, not the lawn).
func exits(mode: String) -> Array:
	var out := []
	var cost: PackedFloat32Array = costs[mode]
	var g: AStar3D = graphs[mode]
	for side in [-1, 1]:
		var c := 0 if side < 0 else cols - 1
		var runs := []   # open runs: PackedInt32Array of faces, row by row
		for r in rows + 1:
			var ext := []
			if r < rows:
				var i := r * cols + c
				for f in range(cell_start[i], cell_start[i + 1]):
					if cost[f] <= 0.0 or (mode == "walk" and cost[f] > exit_max_cost):
						continue
					var run = null
					for q in runs:
						if g.are_points_connected(q[-1], f):
							run = q
							break
					if run != null:
						runs.erase(run)
						run.append(f)
						ext.append(run)
					else:
						ext.append(PackedInt32Array([f]))
			for q in runs:
				var a := face_pos(q[0])
				var b := face_pos(q[-1])
				out.append({"point": face_pos(q[q.size() / 2]), "side": side, "span": Vector2(a.z, b.z), "faces": q})
			runs = ext
	return out

## A random point no dearer than max_cost that can be got to from a way in (walk mode), or null.
func random_point(mode: String, rng: RandomNumberGenerator, max_cost: float):
	var cost: PackedFloat32Array = costs[mode]
	for attempt in 2000:
		var f := rng.randi() % cost.size()
		if cost[f] > 0.0 and cost[f] <= max_cost and (mode != "walk" or reachable[f]):
			return face_pos(f)
	return null

## Walk mode: mark every usable face connected to a way in.
func _flood_walk() -> void:
	var g: AStar3D = graphs.walk
	reachable = PackedByteArray()
	reachable.resize(face_y.size())
	var todo: Array[int] = []
	for e in exits("walk"):
		for f in e.faces:
			if not reachable[f]:
				reachable[f] = 1
				todo.append(f)
	while not todo.is_empty():
		for j in g.get_point_connections(todo.pop_back()):
			if not reachable[j]:
				reachable[j] = 1
				todo.append(j)

## Ground-band and paving faces (walk cost up to max_cost) that cannot be got to from any way in, in
## pieces of at least min_area square metres (smaller pockets between objects are ignored):
## [{centre, size}] in metres. Other objects' tops (roofs, planters) need not be reachable.
func unreachable_areas(max_cost: float, min_area: float) -> Array:
	var cost: PackedFloat32Array = costs.walk
	var g: AStar3D = graphs.walk
	var want := func(f: int) -> bool: return face_must[f] and not reachable[f] and cost[f] > 0.0 and cost[f] <= max_cost
	var seen := PackedByteArray()
	seen.resize(cost.size())
	var out := []
	for i in cost.size():
		if seen[i] or not want.call(i):
			continue
		var lo := Vector3(INF, INF, INF)
		var hi := -lo
		var count := 0
		var todo: Array[int] = [i]
		seen[i] = 1
		while not todo.is_empty():
			var k: int = todo.pop_back()
			count += 1
			lo = lo.min(face_pos(k))
			hi = hi.max(face_pos(k))
			for j in g.get_point_connections(k):
				if not seen[j] and want.call(j):
					seen[j] = 1
					todo.append(j)
		if count * cell * cell >= min_area:
			out.append({"centre": (lo + hi) / 2, "size": Vector2(hi.x - lo.x + cell, hi.z - lo.z + cell)})
	return out
