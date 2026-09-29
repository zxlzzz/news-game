## Ground height of a real-place scene (godot/real_place/build_ground.py writes terrain.bin and
## terrain.json next to the level). A child of the level; anything that needs the ground height at a
## point asks it: the camera's look-at point, placing objects, people and animals.
##   Terrain.find(node) -> the Terrain of the level node is in, or null (flat levels have none).
##   height_at(x, z) -> metres, bilinear between the cell centres; outside the grid, the nearest edge.
class_name Terrain
extends Node3D

## Folder holding terrain.bin and terrain.json.
@export_dir var data_dir := ""

var _h := PackedFloat32Array()
var _x0 := 0.0
var _z0 := 0.0
var _cell := 1.0
var _w := 0
var _rows := 0

func _enter_tree() -> void:
	add_to_group(&"terrain")
	if _h.is_empty():
		_load()

func _load() -> void:
	var info = JSON.parse_string(FileAccess.get_file_as_string(data_dir.path_join("terrain.json")))
	if not (info is Dictionary and info.has_all(["x0", "z0", "cell", "width", "height"])):
		push_error("Terrain: %s/terrain.json missing or incomplete" % data_dir)
		return
	_x0 = info.x0
	_z0 = info.z0
	_cell = info.cell
	_w = int(info.width)
	_rows = int(info.height)
	_h = FileAccess.get_file_as_bytes(data_dir.path_join("terrain.bin")).to_float32_array()
	if _h.size() != _w * _rows:
		push_error("Terrain: terrain.bin has %d heights, terrain.json says %d x %d" % [_h.size(), _w, _rows])
		_h = PackedFloat32Array()

func height_at(x: float, z: float) -> float:
	if _h.is_empty():
		return 0.0
	var fx := clampf((x - _x0) / _cell - 0.5, 0.0, _w - 1.001)
	var fz := clampf((z - _z0) / _cell - 0.5, 0.0, _rows - 1.001)
	var c := int(fx)
	var r := int(fz)
	var tx := fx - c
	var tz := fz - r
	var i := r * _w + c
	var top := lerpf(_h[i], _h[i + 1], tx)
	var bottom := lerpf(_h[i + _w], _h[i + _w + 1], tx)
	return lerpf(top, bottom, tz)

static func find(node: Node) -> Terrain:
	if node == null or not node.is_inside_tree():
		return null
	return node.get_tree().get_first_node_in_group(&"terrain") as Terrain
