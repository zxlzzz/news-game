## Draws where people can walk and ride in a level, as core/walk_grid.gd derives it, for checking a
## layout. godot --headless --path . -s res://tools/walk_grid_image.gd -- <level.tscn> <out.png>
## Top view, +X right, +Z down; one pixel per cell. One band of maps per layer (a cell's lowest
## uncovered face is layer 0, the next one up layer 1: a bridge deck over a path), each band walk then
## ride. White = cost 1, lighter to darker grey = dearer, black = unusable or no face on that layer.
## Red rows separate the maps.
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
	# layer of every face: its rank among the uncovered faces of its cell
	var layer := PackedInt32Array()
	layer.resize(g.face_y.size())
	var layers := 1
	for i in g.cols * g.rows:
		var k := 0
		for f in range(g.cell_start[i], g.cell_start[i + 1]):
			if not g.face_covered[f]:
				layer[f] = k
				k += 1
		layers = maxi(layers, k)
	var h := g.rows + 4
	var img := Image.create(g.cols, h * 2 * layers, false, Image.FORMAT_RGB8)
	img.fill(Color(0.8, 0.2, 0.2))
	for l in layers:
		for mode_i in 2:
			var top := (l * 2 + mode_i) * h
			img.fill_rect(Rect2i(0, top, g.cols, g.rows), Color.BLACK)
			var cost: PackedFloat32Array = g.costs[WalkGrid.MODES[mode_i]]
			for f in g.face_y.size():
				if g.face_covered[f] or layer[f] != l or cost[f] <= 0.0:
					continue
				var v := clampf(1.0 - (cost[f] - 1.0) / 6.0, 0.25, 1.0)
				img.set_pixel(g.face_cell[f] % g.cols, top + g.face_cell[f] / g.cols, Color(v, v, v))
	img.save_png(out)
	print("WALK_GRID ", out, " ", g.cols, "x", g.rows, " cells of ", g.cell, " m, ", layers, " layers; walk exits ", g.exits("walk").size(), ", ride exits ", g.exits("ride").size())
	quit()
	return true
