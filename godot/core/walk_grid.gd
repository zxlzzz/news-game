## Where people can walk or ride in a level, derived from the level itself (scene_spec.md §3), and
## paths across it. Nothing about it is written in the level file:
##  - the ground bands (GroundStrip) give each strip its surface: the band's colour slot;
##  - paving objects (group "paving": plazas, paths) lay their own surface over the bands, taken
##    from their actual ground-level triangles and their material slot;
##  - a crosswalk object (group "crosswalk") makes the bands it lies on that walkers cannot use
##    walkable across their full width, at the "crosswalk" cost;
##  - every other object blocks what it occupies below clearanceHeight (each mesh's box), grown by
##    clearance; flat markings (group "marking") block nothing.
## Costs per surface and mode ("walk", "ride") are in core/walk_costs.json: a surface missing from a
## mode cannot be used in it. Paths are found with an AStarGrid2D per mode (weight = cost) and
## straightened where a straight line crosses nothing dearer than its ends.
## Why not NavigationRegion3D (scene_spec §3's first idea): one region per cost means baking each
## surface separately, and every bake shrinks its region by the walker's radius, so neighbouring
## regions of different cost no longer touch and never connect.
extends RefCounted

const COSTS := "res://core/walk_costs.json"
const MODES := ["walk", "ride"]

var error := ""
var cell: float
var x0: float           # world x of column 0's left edge
var z0: float           # world z of row 0's near edge
var cols: int
var rows: int
var costs: Dictionary   # mode -> PackedFloat32Array (0 = unusable)
var grids: Dictionary   # mode -> AStarGrid2D
var exit_max_cost: float

## level: a core/level.gd node; p: {cell, clearance, clearanceHeight, exitMaxCost}.
func _init(level: Node3D, p: Dictionary) -> void:
	var table = JSON.parse_string(FileAccess.get_file_as_string(COSTS))
	if not (table is Dictionary):
		error = COSTS + ": not a JSON object"
		return
	for mode in MODES:
		if not table.has(mode):
			error = "%s: no %s table" % [COSTS, mode]
			return
	cell = p.cell
	exit_max_cost = p.exitMaxCost
	var strip: GroundStrip = null
	for c in level.get_children():
		if c is GroundStrip:
			strip = c
	if strip == null:
		error = "level has no GroundStrip"
		return
	var depth := 0.0
	for b in strip.bands:
		depth += b.width
	x0 = strip.position.x - strip.length / 2
	z0 = strip.position.z
	cols = ceili(strip.length / cell)
	rows = ceili(depth / cell)
	var n := cols * rows
	# surface slot of every cell: bands first, then paving on top
	var surface := []
	surface.resize(n)
	var band_of_row := []
	for r in rows:
		var z := (r + 0.5) * cell
		var acc := 0.0
		var slot := &""
		for b in strip.bands:
			if z < acc + b.width:
				slot = b.slot
				break
			acc += b.width
		band_of_row.append(slot)
		for c in cols:
			surface[r * cols + c] = slot
	var blocked := PackedByteArray()
	blocked.resize(n)
	var crossing := PackedByteArray()
	crossing.resize(n)
	for inst in level.get_children():
		if not (inst is Node3D) or not inst.scene_file_path.begins_with(Level.TYPES_DIR):
			continue
		if inst.is_in_group(&"paving"):
			_lay_paving(inst, surface)
		elif inst.is_in_group(&"crosswalk"):
			_cut_crossing(inst, band_of_row, table.walk, crossing)
		elif not inst.is_in_group(&"marking"):
			_block(inst, p.clearance, p.clearanceHeight, blocked)
	for mode in MODES:
		var t: Dictionary = table[mode]
		var cost := PackedFloat32Array()
		cost.resize(n)
		var g := AStarGrid2D.new()
		g.region = Rect2i(0, 0, cols, rows)
		g.cell_size = Vector2.ONE
		g.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
		g.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
		g.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
		g.update()
		for i in n:
			var k: float = t.get(String(surface[i]), 0.0)
			if mode == "walk" and k == 0.0 and crossing[i]:
				k = t.get("crosswalk", 0.0)
			if blocked[i]:
				k = 0.0
			cost[i] = k
			var id := Vector2i(i % cols, i / cols)
			if k <= 0.0:
				g.set_point_solid(id, true)
			else:
				g.set_point_weight_scale(id, k)
		costs[mode] = cost
		grids[mode] = g

# ---------------------------------------------------------------- building the grid

func _col(x: float) -> int:
	return clampi(floori((x - x0) / cell), 0, cols - 1)

func _row(z: float) -> int:
	return clampi(floori((z - z0) / cell), 0, rows - 1)

func _centre(c: int, r: int) -> Vector3:
	return Vector3(x0 + (c + 0.5) * cell, 0.0, z0 + (r + 0.5) * cell)

func _meshes(n: Node, out: Array) -> void:
	if n is MeshInstance3D and (n as MeshInstance3D).mesh:
		out.append(n)
	for c in n.get_children():
		_meshes(c, out)

## Paving: every upward ground-level triangle of the object sets its cells to the triangle's slot.
func _lay_paving(inst: Node3D, surface: Array) -> void:
	var ms := []
	_meshes(inst, ms)
	for mi in ms:
		var mesh: Mesh = mi.mesh
		var xf: Transform3D = mi.global_transform
		for s in mesh.get_surface_count():
			var mat: Material = mi.get_active_material(s)
			var slot := StringName(mat.resource_name) if mat else &""
			var arr: Array = mesh.surface_get_arrays(s)
			var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array()
			var count := idx.size() if idx.size() > 0 else v.size()
			for t in range(0, count, 3):
				var a: Vector3 = xf * v[idx[t] if idx.size() > 0 else t]
				var b: Vector3 = xf * v[idx[t + 1] if idx.size() > 0 else t + 1]
				var c: Vector3 = xf * v[idx[t + 2] if idx.size() > 0 else t + 2]
				if (b - a).cross(c - a).normalized().y > -0.7 and (b - a).cross(c - a).normalized().y < 0.7:
					continue  # walls and curb sides
				if maxf(a.y, maxf(b.y, c.y)) > 0.3:
					continue
				_fill_triangle(Vector2(a.x, a.z), Vector2(b.x, b.z), Vector2(c.x, c.z), surface, slot)

func _fill_triangle(a: Vector2, b: Vector2, c: Vector2, surface: Array, slot: StringName) -> void:
	var c0 := _col(minf(a.x, minf(b.x, c.x)))
	var c1 := _col(maxf(a.x, maxf(b.x, c.x)))
	var r0 := _row(minf(a.y, minf(b.y, c.y)))
	var r1 := _row(maxf(a.y, maxf(b.y, c.y)))
	for r in range(r0, r1 + 1):
		for col in range(c0, c1 + 1):
			var p3 := _centre(col, r)
			if Geometry2D.point_is_inside_triangle(Vector2(p3.x, p3.z), a, b, c):
				surface[r * cols + col] = slot

## World box of an object's meshes that reach below `below` metres (all meshes if below is INF).
func _boxes(inst: Node3D, below: float) -> Array:
	var ms := []
	_meshes(inst, ms)
	var out := []
	for mi in ms:
		var box: AABB = mi.global_transform * mi.mesh.get_aabb()
		if box.position.y < below:
			out.append(box)
	return out

## A crosswalk spans, over its own width, every band it touches that walkers cannot use.
func _cut_crossing(inst: Node3D, band_of_row: Array, walk: Dictionary, crossing: PackedByteArray) -> void:
	for box in _boxes(inst, INF):
		var c0 := _col(box.position.x)
		var c1 := _col(box.end.x)
		var hit := {}
		for r in range(_row(box.position.z), _row(box.end.z) + 1):
			if not walk.has(String(band_of_row[r])):
				hit[band_of_row[r]] = true
		for r in rows:
			if hit.has(band_of_row[r]):
				for col in range(c0, c1 + 1):
					crossing[r * cols + col] = 1

func _block(inst: Node3D, clearance: float, height: float, blocked: PackedByteArray) -> void:
	for box in _boxes(inst, height):
		if box.size.y < 0.03:
			continue  # flat: nothing to bump into
		for r in range(_row(box.position.z - clearance), _row(box.end.z + clearance) + 1):
			for col in range(_col(box.position.x - clearance), _col(box.end.x + clearance) + 1):
				blocked[r * cols + col] = 1

# ---------------------------------------------------------------- queries

func cost_at(mode: String, p: Vector3) -> float:
	return costs[mode][_row(p.z) * cols + _col(p.x)]

## The nearest usable cell centre to p (searching outward), or null.
func snap(mode: String, p: Vector3):
	var c := _col(p.x)
	var r := _row(p.z)
	var cost: PackedFloat32Array = costs[mode]
	for ring in range(0, 40):
		for dr in range(-ring, ring + 1):
			for dc in range(-ring, ring + 1):
				if maxi(absi(dr), absi(dc)) != ring:
					continue
				var rr := r + dr
				var cc := c + dc
				if rr >= 0 and rr < rows and cc >= 0 and cc < cols and cost[rr * cols + cc] > 0.0:
					return Vector2i(cc, rr)
	return null

## World points from a to b (both snapped to usable cells), straightened; empty if unreachable.
func plan(mode: String, a: Vector3, b: Vector3) -> PackedVector3Array:
	var sa = snap(mode, a)
	var sb = snap(mode, b)
	if sa == null or sb == null:
		return PackedVector3Array()
	var ids: Array[Vector2i] = grids[mode].get_id_path(sa, sb)
	if ids.is_empty():
		return PackedVector3Array()
	var keep: Array[Vector2i] = [ids[0]]
	var i := 0
	while i < ids.size() - 1:
		var j := ids.size() - 1
		while j > i + 1 and not _clear(mode, ids[i], ids[j]):
			j -= 1
		keep.append(ids[j])
		i = j
	var out := PackedVector3Array()
	for id in keep:
		out.append(_centre(id.x, id.y))
	return out

## A straight walk from a to b crosses only usable cells no dearer than its dearer end.
func _clear(mode: String, a: Vector2i, b: Vector2i) -> bool:
	var cost: PackedFloat32Array = costs[mode]
	var limit := maxf(cost[a.y * cols + a.x], cost[b.y * cols + b.x])
	var steps := maxi(absi(b.x - a.x), absi(b.y - a.y)) * 2
	for s in range(1, steps):
		var t := float(s) / steps
		var k := cost[roundi(lerpf(a.y, b.y, t)) * cols + roundi(lerpf(a.x, b.x, t))]
		if k <= 0.0 or k > limit:
			return false
	return true

## Where a mode's usable area meets the left or right end of the ground: [{point, side, span}],
## side -1 left / +1 right, span the run's z extent. Walking exits only on surfaces no dearer than
## exitMaxCost (a pavement, not the lawn).
func exits(mode: String) -> Array:
	var out := []
	var cost: PackedFloat32Array = costs[mode]
	for side in [-1, 1]:
		var c := 0 if side < 0 else cols - 1
		var start := -1
		for r in rows + 1:
			var k := cost[r * cols + c] if r < rows else 0.0
			var ok := k > 0.0 and (mode != "walk" or k <= exit_max_cost)
			if ok and start < 0:
				start = r
			elif not ok and start >= 0:
				var a := _centre(c, start)
				var b := _centre(c, r - 1)
				out.append({"point": (a + b) / 2, "side": side, "span": Vector2(a.z, b.z)})
				start = -1
	return out

## A random usable point no dearer than max_cost, or null after many misses.
func random_point(mode: String, rng: RandomNumberGenerator, max_cost: float):
	var cost: PackedFloat32Array = costs[mode]
	for attempt in 2000:
		var i := rng.randi() % cost.size()
		if cost[i] > 0.0 and cost[i] <= max_cost:
			return _centre(i % cols, i / cols)
	return null
