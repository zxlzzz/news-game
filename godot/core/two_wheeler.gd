## Root script of a rideable two-wheeler type (types/bicycle.tscn, types/scooter.tscn).
## Where the rider touches the vehicle is read from the model's node names, not typed in, so a new
## bicycle model works without new numbers (naming contract: modeling/模型制作说明.md "可骑的车"):
##   saddle                           seat: centre of its top face
##   handlebar                        grips: gripFromBarEnd (rider-params) in from each end, on its axis
##   wheel_front, wheel_rear          turned about their own origins; radius = half their height
##   crank_set, pedal_left/right      pedalled: cranks turn about crank_set's origin, pedals stay level;
##                                    foot contact = centre of the pedal's top face
##   footrest_left/right              not pedalled: foot contact = centre of the footrest's top face
## A Marker3D child named "seat" overrides the seat point (a long seat: say where on it one sits).
## Exported values are the choices a model cannot show.
extends Node3D

## Metres travelled per crank turn (the gearing). Only used when the model has cranks.
@export var travel_per_crank_turn := 4.5
## Rider style overrides for this vehicle, merged over npc/rider-params.json (see npc/rider.gd style()).
@export var rider_style := {}

var _model: Node3D
var _wheels: Array[Node3D] = []
var _wheel_radius := 0.0
var _seat: Vector3
var _bar: AABB
var _crank: Node3D
var _pedals := {}   # side -> {node, offset (from the axle at phase 0), top (above the pedal origin)}
var _footrests := {}  # side -> contact point
var error := ""
var _read := false

func _ready() -> void:
	_ensure()

## Reads the model once, on first use (so it also works before _ready, e.g. in a check tool).
func _ensure() -> void:
	if _read:
		return
	_read = true
	error = _read_model()
	if error != "":
		push_error("%s: %s" % [scene_file_path, error])

func _read_model() -> String:
	_model = get_node_or_null("model")
	if _model == null:
		return "no child named model"
	for n in ["wheel_front", "wheel_rear"]:
		var w := _model.find_child(n, true, false) as Node3D
		if w == null:
			return "model has no node " + n
		_wheels.append(w)
		_wheel_radius = maxf(_wheel_radius, _bounds(w).size.y / 2)
	var saddle := _model.find_child("saddle", true, false) as Node3D
	var bar := _model.find_child("handlebar", true, false) as Node3D
	if saddle == null or bar == null:
		return "model needs nodes saddle and handlebar"
	var marker := get_node_or_null("seat") as Marker3D
	var sb := _bounds(saddle)
	_seat = marker.position if marker else Vector3(sb.get_center().x, sb.end.y, sb.get_center().z)
	_bar = _bounds(bar)
	_crank = _model.find_child("crank_set", true, false) as Node3D
	for side in ["Left", "Right"]:
		var suffix: String = side.to_lower()
		if _crank:
			var pedal := _model.find_child("pedal_" + suffix, true, false) as Node3D
			if pedal == null:
				return "model has crank_set but no pedal_" + suffix
			var axle := _local_origin(_crank)
			var centre := _local_origin(pedal)
			_pedals[side] = {"node": pedal, "offset": centre - axle, "axle": axle,
				"top": _bounds(pedal).end.y - centre.y}
		else:
			var rest := _model.find_child("footrest_" + suffix, true, false) as Node3D
			if rest == null:
				return "model needs crank_set + pedals or footrest_left/right"
			var b := _bounds(rest)
			_footrests[side] = Vector3(b.get_center().x, b.end.y, b.get_center().z)
	return ""

## {wheelRadius, travelPerCrankTurn, pedalled} for npc/rider.gd step().
func info() -> Dictionary:
	_ensure()
	return {"wheelRadius": _wheel_radius, "travelPerCrankTurn": travel_per_crank_turn, "pedalled": _crank != null}

## Contact points in this node's space for a crank angle (radians; 0 = left pedal at the top, positive
## = pedalling forward). grip_inset: metres in from each bar end.
func contacts(crank_phase: float, grip_inset: float) -> Dictionary:
	_ensure()
	var y := _bar.get_center().y
	var z := _bar.get_center().z
	var c := {"seat": _seat,
		"gripLeft": Vector3(_bar.end.x - grip_inset, y, z),
		"gripRight": Vector3(_bar.position.x + grip_inset, y, z)}
	for side in ["Left", "Right"]:
		if _crank:
			var pd: Dictionary = _pedals[side]
			c["foot" + side] = pd.axle + pd.offset.rotated(Vector3.RIGHT, crank_phase) + Vector3(0, pd.top, 0)
		else:
			c["foot" + side] = _footrests[side]
	return c

## Turn the wheels and cranks (pedals counter-turn to stay level). Radians, positive = forward.
func set_motion(wheel_angle: float, crank_phase: float) -> void:
	_ensure()
	for w in _wheels:
		w.rotation.x = wheel_angle
	if _crank:
		_crank.rotation.x = crank_phase
		for side in _pedals:
			_pedals[side].node.rotation.x = -crank_phase

## Node origin in this node's space (works outside the scene tree).
func _local_origin(n: Node3D) -> Vector3:
	return _to_self(n).origin

func _to_self(n: Node) -> Transform3D:
	var t := Transform3D.IDENTITY
	while n != self and n != null:
		if n is Node3D:
			t = (n as Node3D).transform * t
		n = n.get_parent()
	return t

## Bounds of every mesh under n, in this node's space, at the model's rest pose.
func _bounds(n: Node) -> AABB:
	var out := AABB()
	var first := true
	var stack: Array[Node] = [n]
	while not stack.is_empty():
		var m: Node = stack.pop_back()
		stack.append_array(m.get_children())
		if m is MeshInstance3D and (m as MeshInstance3D).mesh:
			var box := _to_self(m) * (m as MeshInstance3D).mesh.get_aabb()
			out = box if first else out.merge(box)
			first = false
	return out
