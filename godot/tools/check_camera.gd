## Checks core/orbit_camera.gd with made-up mouse input over a flat 300 x 200 m level: wheel zooms
## about the ground point under the mouse, a left drag pans (the grabbed ground point follows the
## mouse), a left click does not move the camera, a middle drag turns and tilts within the limits,
## and the look-at point stays over the level. Prints CAMERA_OK or the failures; quits with 1 on failure.
##   godot --headless --path . -s res://tools/check_camera.gd
extends SceneTree

const VIEW := "res://scenes/walk_grid_test/view.tscn"

var failures: Array[String] = []
var level: Node3D
var cam: Camera3D

func _initialize() -> void:
	level = Node3D.new()
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(300, 200)
	ground.mesh = plane
	level.add_child(ground)
	var view: Node3D = load(VIEW).instantiate()
	level.add_child(view)
	cam = view.get_node("Camera")
	root.add_child.call_deferred(level)

func _process(_d: float) -> bool:
	if not cam.is_inside_tree():
		return false
	var mid := root.get_visible_rect().size / 2
	# Below the middle: near ground (in perspective a point high on the screen can be far off the level).
	var at := mid + Vector2(120, 60)

	# Wheel: zoom in about the mouse; that ground point stays under the mouse.
	var h0: float = cam.height
	var g0: Vector3 = cam._ground_at(at)
	_wheel(at, MOUSE_BUTTON_WHEEL_UP)
	_near(cam.height, h0 / cam.p.zoomStep, "wheel up zooms in by zoomStep")
	_near_v(cam._ground_at(at), g0, "zoom keeps the ground point under the mouse")

	# Left click without moving: nothing moves.
	var look0: Vector3 = cam.look
	_button(at, MOUSE_BUTTON_LEFT, true)
	_button(at, MOUSE_BUTTON_LEFT, false)
	_near_v(cam.look, look0, "a left click does not pan")

	# Left drag: the grabbed ground point follows the mouse.
	var grab: Vector3 = cam._ground_at(at)
	_button(at, MOUSE_BUTTON_LEFT, true)
	var to := at + Vector2(-150, 80)
	_motion(at, at + Vector2(-10, 0), 0)
	_motion(at + Vector2(-10, 0), to, 0)
	_button(to, MOUSE_BUTTON_LEFT, false)
	if cam.look.distance_to(look0) < 1.0:
		_fail("left drag did not pan")
	_near_v(cam._ground_at(to), grab, "left drag keeps the grabbed ground point under the mouse", 0.05 * cam.height)

	# Middle drag: turn all the way round, tilt stops at the limits.
	var yaw0: float = cam.yaw
	_button(mid, MOUSE_BUTTON_MIDDLE, true)
	_motion(mid, mid + Vector2(-1200 / cam.p.turnPerPixel / 3.0, 0), MOUSE_BUTTON_MASK_MIDDLE)  # 400 degrees
	_near(cam.yaw - yaw0, 400.0, "middle drag left-right turns freely")
	_motion(mid, mid + Vector2(0, 5000), MOUSE_BUTTON_MASK_MIDDLE)
	_near(cam.pitch, cam.p.pitch[1], "tilt stops at the upper limit")
	_motion(mid, mid + Vector2(0, -10000), MOUSE_BUTTON_MASK_MIDDLE)
	_near(cam.pitch, cam.p.pitch[0], "tilt stops at the lower limit")
	_button(mid, MOUSE_BUTTON_MIDDLE, false)

	# Keys and zoom limits: the look-at point stays over the level, zoom stays in range.
	for i in 60:
		_wheel(mid, MOUSE_BUTTON_WHEEL_DOWN)
	_near(cam.height, cam.p.height[1], "zoom out stops at the far limit")
	cam.look = Vector3(1000, 0, -1000)
	cam._apply()
	if absf(cam.look.x) > 150.001 or absf(cam.look.z) > 100.001:
		_fail("look-at point left the level: %s" % cam.look)
	var back: Vector3 = cam.global_basis.z
	_near(rad_to_deg(asin(back.y)), cam.pitch, "camera tilt matches pitch")

	if failures.is_empty():
		print("CAMERA_OK")
		quit(0)
	else:
		for f in failures:
			printerr("CAMERA: " + f)
		quit(1)
	return true

func _wheel(pos: Vector2, button: MouseButton) -> void:
	_button(pos, button, true)
	_button(pos, button, false)

func _button(pos: Vector2, button: MouseButton, pressed: bool) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = button
	e.pressed = pressed
	e.position = pos
	e.global_position = pos
	root.push_input(e)

func _motion(from: Vector2, to: Vector2, mask: int) -> void:
	var e := InputEventMouseMotion.new()
	e.position = to
	e.global_position = to
	e.relative = to - from
	e.button_mask = mask
	root.push_input(e)

func _near(a: float, b: float, what: String) -> void:
	if absf(a - b) > 1e-3:
		_fail("%s: %.4f, expected %.4f" % [what, a, b])

func _near_v(a: Vector3, b: Vector3, what: String, tol := 0.01) -> void:
	if a.distance_to(b) > tol:
		_fail("%s: %s, expected %s" % [what, a, b])

func _fail(s: String) -> void:
	failures.append(s)
