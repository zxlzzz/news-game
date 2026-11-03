## Tests actual imported geometry, runtime physics, mid-motion reversal and endpoints.
extends SceneTree

var door: Node3D

func _initialize() -> void:
	call_deferred("run")

func check(value: bool, message: String) -> void:
	if not value:
		push_error(message)
		quit(1)
		assert(value, message)

func through_opening() -> Dictionary:
	return root.world_3d.direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(0,1,2),Vector3(0,1,-2)))

func run() -> void:
	door = load("res://types/door_single.tscn").instantiate()
	root.add_child(door)
	await physics_frame
	await physics_frame
	check(not through_opening().is_empty(), "Closed door must block doorway")
	var grip: Vector3 = door.grip_position()
	var pivot: Vector3 = door.hinge.global_position
	var radius := grip.distance_to(pivot)
	var leaf: MeshInstance3D = door.get_node("model").find_child("Leaf",true,false)
	var box: AABB = leaf.global_transform * leaf.get_aabb()
	check(box.position.x < -door.config.opening_width/2.0 and box.end.x > door.config.opening_width/2.0, "Closed door must overlap both jambs")
	check(box.position.y <= 0.00001 and box.end.y > door.config.opening_height, "Closed door must cover threshold and header")
	var merged: Array[MeshInstance3D] = []
	preload("res://core/level.gd")._mesh_instances(door, merged)
	check(merged.is_empty(), "Static merge must preserve a door nested in a building")
	for cycle in range(3):
		door.set_open(true)
		while door.open_ratio < 1.0:
			await physics_frame
			check(absf(door.grip_position().distance_to(pivot)-radius) < 0.0001,"Grip detached from hinge")
		await physics_frame
		check(through_opening().is_empty(), "Open door must clear doorway")
		var bounds: AABB = leaf.get_aabb()
		var c: Vector3 = leaf.global_transform * bounds.get_center()
		var normal: Vector3 = leaf.global_basis.z
		var hit := root.world_3d.direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(c+normal,c-normal))
		check(not hit.is_empty() and hit.collider == door.leaf_body,"Collision must follow open leaf")
		door.set_open(false)
		while door.open_ratio > 0.0:
			await physics_frame
		await physics_frame
		check(not through_opening().is_empty(),"Reclosed door lost collision")
		check(door.grip_position().distance_to(grip)<0.0001,"Door drifts after closing")
	door.set_open(true)
	while door.open_ratio < 0.4:
		await physics_frame
	var halfway: float = door.open_ratio
	door.set_open(false)
	await physics_frame
	await physics_frame
	check(door.open_ratio < halfway,"Reverse command must work mid-motion")
	while door.open_ratio > 0.0:
		await physics_frame
	print("DOOR_OK: closed coverage, clear opening, moving collision, grips, 3 cycles, reversal")
	quit()
