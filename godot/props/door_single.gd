## A reusable outward-swinging door; geometry, grips and collision share one hinge.
## Public contract for future door types: set_open(bool), toggle(), open_ratio,
## target_open and opened/closed signals. Does not claim to align NPC animations.
extends Node3D

signal opened
signal closed

const CONFIG_PATH := "res://modeling/door_single.json"
var open_ratio := 0.0
var target_open := false
var config: Dictionary
var hinge: Node3D
var leaf_body: AnimatableBody3D

func _ready() -> void:
	config = JSON.parse_string(FileAccess.get_file_as_string(CONFIG_PATH))
	assert(config.travel_seconds > 0.0)
	hinge = $model.find_child("Hinge", true, false)
	assert(hinge != null, "Door model has no Hinge")
	for part in ["FrameLeft", "FrameRight", "FrameTop", "Leaf"]:
		var mesh := $model.find_child(part, true, false) as MeshInstance3D
		assert(mesh != null, "Door model is missing " + part)
		var body: PhysicsBody3D
		if part == "Leaf":
			leaf_body = AnimatableBody3D.new()
			leaf_body.sync_to_physics = false
			body = leaf_body
		else:
			body = StaticBody3D.new()
		body.name = part + "Collision"
		mesh.add_child(body)
		var shape := BoxShape3D.new()
		var bounds := mesh.get_aabb()
		shape.size = bounds.size
		var collider := CollisionShape3D.new()
		collider.shape = shape
		collider.position = bounds.get_center()
		body.add_child(collider)
	_apply_pose()

func set_open(value: bool) -> void:
	target_open = value

func toggle() -> void:
	set_open(not target_open)

func _physics_process(delta: float) -> void:
	var target := 1.0 if target_open else 0.0
	if open_ratio == target:
		return
	open_ratio = move_toward(open_ratio, target, delta / float(config.travel_seconds))
	_apply_pose()
	if open_ratio == target:
		if target_open:
			opened.emit()
		else:
			closed.emit()

func _apply_pose() -> void:
	hinge.rotation.y = deg_to_rad(float(config.open_degrees)) * smoothstep(0.0, 1.0, open_ratio)

func grip_position(front: bool = true) -> Vector3:
	return (hinge.find_child("grip_front" if front else "grip_back", true, false) as Node3D).global_position
