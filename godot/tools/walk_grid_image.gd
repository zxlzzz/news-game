## Draws where people can walk and ride in a level, as core/walk_grid.gd derives it, for checking a
## layout. godot --headless --path . -s res://tools/walk_grid_image.gd -- <level.tscn> <out.png>
## Top view, +X right, +Z down; one pixel per cell. Walk: white = cost 1, lighter to darker grey =
## dearer, black = unusable. Ride-only cells are marked with a mid tone stripe below the walk map.
extends SceneTree

const WalkGrid := preload("res://core/walk_grid.gd")
var level: Node3D
var out := ""

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	out = a[1]
	level = load(a[0]).instantiate()
	level.set_script(null)  # no look, no crowd: only the layout
	root.add_child.call_deferred(level)

func _process(_d: float) -> bool:
	if level == null or not level.is_inside_tree():
		return false
	var p = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	var g := WalkGrid.new(level, p.grid, Level._load_material_maps([]))
	if g.error != "":
		printerr("WALK_GRID_FAIL ", g.error)
		quit(1)
		return true
	var img := Image.create(g.cols, g.rows * 2 + 4, false, Image.FORMAT_RGB8)
	img.fill(Color(0.8, 0.2, 0.2))
	for mode_i in 2:
		var cost: PackedFloat32Array = g.costs[WalkGrid.MODES[mode_i]]
		for r in g.rows:
			for c in g.cols:
				var k := cost[r * g.cols + c]
				var v := 0.0 if k <= 0.0 else clampf(1.0 - (k - 1.0) / 6.0, 0.25, 1.0)
				img.set_pixel(c, r + mode_i * (g.rows + 4), Color(v, v, v))
	img.save_png(out)
	print("WALK_GRID ", out, " ", g.cols, "x", g.rows, " cells of ", g.cell, " m; walk exits ", g.exits("walk").size(), ", ride exits ", g.exits("ride").size())
	quit()
	return true
