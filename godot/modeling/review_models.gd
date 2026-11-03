## Model review only. Shares the game's palette, shaders, light and 27 m orthographic scale.
## -- --review a|b|crosswalk selects a close view; omit for the pair at the game scale.
extends "res://core/level.gd"

const A = preload("res://models/building_a.glb")
const B = preload("res://models/building_b.glb")
const CROSSWALK = preload("res://models/crosswalk.glb")

func _ready() -> void:
	palette = preload("res://palettes/gray.tres")
	view = preload("res://scenes/street_demo/view.tscn")
	population = preload("res://scenes/street_demo/population.tres")
	var args := OS.get_cmdline_user_args()
	var i := args.find("--review")
	var mode := args[i + 1] if i >= 0 and i + 1 < args.size() else "pair"
	var title := "BUILDING A + BUILDING B  /  THREE FLOORS + FOUR FLOORS WITH SETBACK"
	var target := Vector3(0, 6.5, 0)
	var camera_size := 27.0
	if mode == "a":
		place(A, Vector3.ZERO)
		title = "BUILDING A   /   12.44 x 8.87 x 11.07 m"
		target = Vector3(0, 6.5, -2)
		camera_size = 20.0
	elif mode == "b":
		place(B, Vector3.ZERO)
		title = "BUILDING B   /   14.46 x 10.12 x 13.56 m"
		target = Vector3(0, 8.3, -2)
		camera_size = 23.0
	elif mode == "crosswalk":
		place(CROSSWALK, Vector3(0, 0, 7))
		title = "CROSSWALK   /   4.50 x 6.00 m   /   ALPHA MASK"
		target = Vector3(0, 0, 7)
		camera_size = 10.0
	else:
		place(A, Vector3(-8, 0, 0))
		place(B, Vector3(8, 0, 0))
		place(CROSSWALK, Vector3(0, 0, 7))
	ground("sidewalk", Vector3(0, -0.10, -3), Vector3(64, 0.20, 14))
	ground("road", Vector3(0, -0.10, 7), Vector3(64, 0.20, 6))
	ground("sidewalk", Vector3(0, -0.10, 13), Vector3(64, 0.20, 6))
	super._ready()
	var cam: Camera3D = get_viewport().get_camera_3d()
	cam.size = camera_size
	# Same 38 degree pitch, 20 degree yaw; aim at the reviewed objects.
	var direction := Vector3(sin(deg_to_rad(20.0)) * cos(deg_to_rad(38.0)), sin(deg_to_rad(38.0)), cos(deg_to_rad(20.0)) * cos(deg_to_rad(38.0)))
	cam.position = target + direction * 60.0
	cam.look_at(target)
	var canvas := CanvasLayer.new()
	add_child(canvas)
	for strip_y in [0, 995]:
		var backing := ColorRect.new()
		backing.position = Vector2(0, strip_y)
		backing.size = Vector2(1920, 70 if strip_y == 0 else 85)
		backing.color = palette.background
		canvas.add_child(backing)
	var heading := Label.new()
	heading.text = title
	heading.position = Vector2(48, 35)
	heading.add_theme_color_override("font_color", Color(0.12, 0.12, 0.12))
	heading.add_theme_font_size_override("font_size", 26)
	canvas.add_child(heading)
	var footer := Label.new()
	footer.text = "MODEL REVIEW  /  GRAY PALETTE  /  GODOT INK + DIRECTIONAL SHADOWS  /  ORTHO HEIGHT %.0f m" % camera_size
	footer.position = Vector2(48, 1010)
	footer.add_theme_color_override("font_color", Color(0.12, 0.12, 0.12))
	footer.add_theme_font_size_override("font_size", 19)
	canvas.add_child(footer)

func place(scene: PackedScene, at: Vector3) -> void:
	var n: Node3D = scene.instantiate()
	n.position = at
	add_child(n)

func ground(slot: String, at: Vector3, size: Vector3) -> void:
	var n := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	var mat := StandardMaterial3D.new()
	mat.resource_name = slot
	mesh.material = mat
	n.mesh = mesh
	n.position = at
	add_child(n)
