## Ground made of parallel bands (scene_spec.md §1 地面带). Every band runs along X for `length`
## metres centred on x = 0; bands are laid back to front along +Z starting at z = 0, so buildings
## stand behind z = 0 and face +Z like every model. Runs in the editor: changing a band rebuilds
## the ground at once. The generated meshes have no owner, so they are never saved into the scene.
## Each band is its own mesh so its edges draw as lines (a shared edge inside one mesh would not).
@tool
class_name GroundStrip
extends Node3D

@export var length := 40.0:
	set(v):
		length = v
		_queue_rebuild()
@export var bands: Array[GroundBand] = []:
	set(v):
		for b in bands:
			if b != null and b.changed.is_connected(_queue_rebuild):
				b.changed.disconnect(_queue_rebuild)
		bands = v
		for b in bands:
			if b != null and not b.changed.is_connected(_queue_rebuild):
				b.changed.connect(_queue_rebuild)
		_queue_rebuild()

var _built: Array[Node] = []
var _queued := false

func _ready() -> void:
	_rebuild()  # synchronous: the level applies the look right after its children are ready

## Z range [from, to] of every band using `slot`, back to front.
func band_ranges(slot: StringName) -> Array[Vector2]:
	var out: Array[Vector2] = []
	var z := 0.0
	for b in bands:
		if b != null and b.slot == slot:
			out.append(Vector2(z, z + b.width))
		if b != null:
			z += b.width
	return out

func _queue_rebuild() -> void:
	if _queued or not is_inside_tree():
		return
	_queued = true
	_rebuild.call_deferred()

func _rebuild() -> void:
	_queued = false
	for n in _built:
		n.queue_free()
	_built.clear()
	var z := 0.0
	for i in bands.size():
		var b := bands[i]
		if b == null or b.width <= 0.0 or b.slot == &"":
			push_error("GroundStrip %s: band %d needs a width > 0 and a slot" % [name, i])
			continue
		var plane := PlaneMesh.new()
		plane.size = Vector2(length, b.width)
		var mat := StandardMaterial3D.new()
		mat.resource_name = b.slot  # the look finds the colour slot by material name
		plane.material = mat
		var mi := MeshInstance3D.new()
		mi.name = "band_%d_%s" % [i, b.slot]
		mi.mesh = plane
		mi.position = Vector3(0.0, 0.0, z + b.width * 0.5)
		add_child(mi)
		_built.append(mi)
		z += b.width
