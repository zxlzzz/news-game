## Checks core/walk_grid.gd on scenes/walk_grid_test (a bridge over a path, steps up to it, a curb,
## a planter, a railing, a bench, a plaza slab, a platform and a bump on the bike lane) and that
## street_demo and two_streets still build their grids, and that a cached grid reads back the same. Prints WALK_GRID_OK or the failures, and quits with 1 on failure.
##   godot --headless --path . -s res://tools/check_walk_grid.gd
extends SceneTree

const WalkGrid := preload("res://core/walk_grid.gd")
const TEST := "res://scenes/walk_grid_test/level.tscn"
const DEMO := "res://scenes/street_demo/level.tscn"
const TWO := "res://scenes/two_streets/level.tscn"

var failures: Array[String] = []
var levels := {}
var p: Dictionary

func _initialize() -> void:
	p = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	for path in [TEST, DEMO, TWO]:
		var level: Node3D = load(path).instantiate()
		level.set_script(null)  # no look, no crowd: only the layout
		levels[path] = level
		root.add_child.call_deferred(level)

func _process(_d: float) -> bool:
	for path in levels:
		if not levels[path].is_inside_tree():
			return false
	var t0 := Time.get_ticks_msec()
	var g := WalkGrid.new(levels[TEST], p.grid, Level._load_material_maps([]))
	if g.error != "":
		_fail("test scene: " + g.error)
	else:
		_check_test(g)
	t0 = Time.get_ticks_msec()
	var demo := WalkGrid.new(levels[DEMO], p.grid, Level._load_material_maps([]))
	print("street_demo grid %dx%d, %d faces, built in %d ms" % [demo.cols, demo.rows, demo.face_y.size(), Time.get_ticks_msec() - t0])
	if demo.error != "":
		_fail("street_demo: " + demo.error)
	else:
		for a in demo.unreachable_areas(p.visitMaxCost, p.grid.pocketArea):
			_fail("street_demo: pavement at %s cannot be reached" % a.centre)
		for mode in WalkGrid.MODES:
			var sides := {}
			for e in demo.exits(mode):
				sides[e.side] = true
			if sides.size() != 2:
				_fail("street_demo: %s has no way in at one end" % mode)
	_check_cache(demo)
	t0 = Time.get_ticks_msec()
	var two := WalkGrid.new(levels[TWO], p.grid, Level._load_material_maps([]))
	print("two_streets grid %dx%d, %d faces, built in %d ms" % [two.cols, two.rows, two.face_y.size(), Time.get_ticks_msec() - t0])
	if two.error != "":
		_fail("two_streets: " + two.error)
	else:
		for a in two.unreachable_areas(p.visitMaxCost, p.grid.pocketArea):
			_fail("two_streets: pavement at %s cannot be reached" % a.centre)
		# an alley links the two streets' block-side sidewalks on foot
		var path := two.plan("walk", Vector3(-35, 0.15, 32), Vector3(-35, 0.15, -32))
		if path.is_empty() or path[-1].distance_to(Vector3(-35, 0.15, -32)) > 1.0:
			_fail("two_streets: no walk from street A to street B")
		# every way in on foot leads to every other: no island of pavement off an edge of the scene
		var ways: Array = two.exits("walk")
		for e in ways.slice(1):
			if two.plan("walk", ways[0].point, e.point).is_empty():
				_fail("two_streets: the way in at %s cannot be walked to from the one at %s" % [e.point, ways[0].point])
		# the crosswalks at x = -5 take walkers over street A (road modules: cut curb to curb)
		var over := two.plan("walk", Vector3(-5, 0.15, 48.5), Vector3(-5, 0.15, 31.5))
		if over.is_empty() or over[-1].distance_to(Vector3(-5, 0.15, 31.5)) > 1.0:
			_fail("two_streets: no walk over the crosswalk at x -5")
		else:
			var length := 0.0
			for i in over.size() - 1:
				length += over[i].distance_to(over[i + 1])
			if length > 25.0:
				_fail("two_streets: the walk over street A at x -5 goes round (%.1f m), not over the crosswalk" % length)
	if failures.is_empty():
		print("WALK_GRID_OK")
	else:
		for f in failures:
			printerr("FAIL ", f)
	quit(1 if not failures.is_empty() else 0)
	return true

## A grid saved to the cache and read back answers like the one built.
func _check_cache(built: WalkGrid) -> void:
	var file := "user://check_walk_grid.bin"
	DirAccess.remove_absolute(ProjectSettings.globalize_path(file))
	var first := WalkGrid.new(levels[DEMO], p.grid, Level._load_material_maps([]), file)
	first.save()
	var t0 := Time.get_ticks_msec()
	var again := WalkGrid.new(levels[DEMO], p.grid, Level._load_material_maps([]), file)
	print("street_demo grid read from the cache in %d ms" % (Time.get_ticks_msec() - t0))
	if first.from_cache or not again.from_cache:
		_fail("cache: the first grid should be built, the second read back")
		return
	if again.face_y != built.face_y or again.costs.walk != built.costs.walk or again.reachable != built.reachable:
		_fail("cache: faces, costs or reachability differ after reading back")
	var a := Vector3(-60, 0, 2)
	var b := Vector3(60, 0, 19)
	for mode in WalkGrid.MODES:
		if again.plan(mode, a, b) != built.plan(mode, a, b):
			_fail("cache: %s path differs after reading back" % mode)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(file))

func _fail(msg: String) -> void:
	failures.append(msg)

## Faces of the cell at (x, z).
func _faces(g: WalkGrid, x: float, z: float) -> Array:
	var i: int = g._row(z) * g.cols + g._col(x)
	return range(g.cell_start[i], g.cell_start[i + 1])

func _check_test(g: WalkGrid) -> void:
	var step: float = p.grid.maxStep.walk
	# 1. under the bridge from one end to the other, on the ground all the way
	var under := g.plan("walk", Vector3(-10, 0, 6), Vector3(10, 0, 6))
	if under.size() < 2:
		_fail("1: no path under the bridge")
	for q in under:
		if absf(q.y) > 1e-4:
			_fail("1: the path under the bridge goes up to %.2f m at %s" % [q.y, q])
			break
	# 2. from the ground up to the deck by the steps, one step at a time
	var up := g.plan("walk", Vector3(0, 0, 17), Vector3(0, 3, 6))
	if up.size() < 2 or absf(up[-1].y - 3.0) > 1e-4:
		_fail("2: no path from the ground up onto the deck (ends at %s)" % (up[-1] if up.size() > 0 else "nowhere"))
	for i in up.size() - 1:
		if absf(up[i + 1].y - up[i].y) > step + 1e-4:
			_fail("2: the path climbs %.2f m at once between %s and %s" % [up[i + 1].y - up[i].y, up[i], up[i + 1]])
			break
	# 3. across the railing (x -12..-6 at z 16): around its ends, never through it
	var across := g.plan("walk", Vector3(-9, 0, 14.5), Vector3(-9, 0, 17.5))
	if across.size() < 2:
		_fail("3: no path around the railing")
	for i in across.size() - 1:
		var a: Vector3 = across[i]
		var b: Vector3 = across[i + 1]
		if (a.z - 16) * (b.z - 16) < 0:
			var x := lerpf(a.x, b.x, (16 - a.z) / (b.z - a.z))
			if x > -12.04 and x < -5.96:
				_fail("3: the path goes through the railing at x %.2f" % x)
	# 4. nobody under the bench or inside the planter; the plaza top is used, the band under it is gone
	for q in [Vector2(7, 2.25), Vector2(-7, 13)]:
		for f in _faces(g, q.x, q.y):
			if g.face_y[f] < 0.3 and g.costs.walk[f] > 0.0:
				_fail("4: the ground at %s (under the bench / in the planter) is usable" % q)
	for f in _faces(g, -7, 13):
		if g.face_y[f] > 0.3 and g.reachable[f]:
			_fail("4: the planter top can be walked to")
	var plaza := _faces(g, -10, 4)
	if plaza.size() != 2 or g.face_covered[plaza[0]] == 0 or g.face_covered[plaza[1]] == 1 or g.costs.walk[plaza[1]] <= 0.0:
		_fail("4: the plaza cell should be a covered band under a usable slab top")
	# 5. riders stay off the steps, the deck and the 0.15 m platform, but take the 0.04 m bump
	for f in g.face_y.size():
		if g.costs.ride[f] > 0.0 and g.face_y[f] > 0.2:
			_fail("5: riders can use a face %.2f m up at %s" % [g.face_y[f], g.face_pos(f)])
			break
	if not g.plan("ride", Vector3(-10, 0, 21.5), Vector3(-2, 0.15, 21.5)).is_empty():
		_fail("5: a rider gets onto the 0.15 m platform")
	if g.plan("ride", Vector3(-3, 0.15, 21.5), Vector3(6, 0.04, 21.5)).is_empty() and g.plan("ride", Vector3(12, 0, 21.5), Vector3(6, 0.04, 21.5)).is_empty():
		_fail("5: a rider cannot get onto the 0.04 m bump")
	# 6. a point on the deck snaps onto the deck, not onto the path under it
	var s := g.snap("walk", Vector3(0, 3.05, 6))
	if s < 0 or absf(g.face_y[s] - 3.0) > 1e-4:
		_fail("6: a point on the deck snaps to %s" % (g.face_pos(s) if s >= 0 else "nothing"))
	# paving is reachable: the steps and the deck are no island
	for a in g.unreachable_areas(p.visitMaxCost, p.grid.pocketArea):
		_fail("paving at %s cannot be reached" % a.centre)
	# the curb can be stepped onto
	var curb := g.plan("walk", Vector3(3, 0, 15), Vector3(8, 0.15, 15))
	if curb.is_empty() or absf(curb[-1].y - 0.15) > 1e-4:
		_fail("no path up onto the curb")
