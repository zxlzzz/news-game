## Isolated functional preview: a real opening through a wall, no interior furniture.
extends "res://core/level.gd"

var door: Node3D
var status: Label

func block(label: String, size: Vector3, center: Vector3, slot: String) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var material := StandardMaterial3D.new()
	material.resource_name = slot
	mesh.material = material
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	instance.position = center
	add_child(instance)
	var body := StaticBody3D.new()
	instance.add_child(body)
	var collider := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collider.shape = shape
	body.add_child(collider)

func _ready() -> void:
	door = preload("res://types/door_single.tscn").instantiate()
	add_child(door)
	var p: Dictionary = door.config
	var v: Dictionary = p.preview
	var frame_w: float = p.opening_width + 2.0*p.frame_width
	var frame_h: float = p.opening_height + p.frame_width
	var side_w: float = (v.wall_width-frame_w)/2.0
	for side in [-1,1]:
		block("WallSide" + str(side), Vector3(side_w,v.wall_height,v.wall_depth), Vector3(side*(frame_w+side_w)/2.0,v.wall_height/2.0,-v.wall_depth/2.0), "wall_plaster")
	block("Lintel", Vector3(frame_w,v.wall_height-frame_h,v.wall_depth), Vector3(0,(v.wall_height+frame_h)/2.0,-v.wall_depth/2.0), "wall_plaster")
	block("Ground", Vector3(v.ground_size,0.1,v.ground_size), Vector3(0,-0.05,0), "sidewalk")
	palette = preload("res://palettes/gray.tres")
	_apply_look({})
	_add_environment()
	_add_corner_tint()
	add_child(preload("res://scenes/street_demo/view.tscn").instantiate())
	var camera := get_viewport().get_camera_3d()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = v.camera_size
	camera.position = Vector3(v.camera_position[0],v.camera_position[1],v.camera_position[2])
	camera.look_at(Vector3(v.camera_target[0],v.camera_target[1],v.camera_target[2]))
	var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
	sun.look_at_from_position(Vector3(-4,7,6),Vector3.ZERO)
	get_viewport().msaa_3d = Viewport.MSAA_4X
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var panel := VBoxContainer.new()
	panel.position = Vector2(24,24)
	canvas.add_child(panel)
	status = Label.new()
	status.add_theme_color_override("font_color", Color.BLACK)
	status.add_theme_font_size_override("font_size",26)
	panel.add_child(status)
	var button := Button.new()
	button.text = "开 / 关（空格）"
	button.add_theme_font_size_override("font_size",24)
	button.pressed.connect(door.toggle)
	panel.add_child(button)
	if "--open-door" in OS.get_cmdline_user_args():
		door.set_open(true)
	print("DOOR_PREVIEW_READY")

func _process(_delta: float) -> void:
	if status:
		status.text = "单扇平开门 · " + ("已关闭" if door.open_ratio == 0.0 else "已打开" if door.open_ratio == 1.0 else "开关中")

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_SPACE:
		door.toggle()
