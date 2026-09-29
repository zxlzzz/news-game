## Camera of a view.tscn that can be turned: it circles a look-at point on the ground
## (docs/design-plans/two-streets.md §1). The pose set in view.tscn is the starting view.
##   WASD / arrow keys, or drag with the left button: move over the ground.
##   Drag with the middle button: turn (left-right, all the way round) and tilt (up-down, within limits).
##   Wheel: zoom about the ground point under the mouse.
## A left or right click that does not drag is left unhandled, for gameplay.
## The look-at point stays over the level (not its backdrop). Numbers: core/camera-params.json, or the
## file named by `params` in the view (scenes/empty_ground looks closer).
## frame(point, height) moves the look-at point and zoom from code (scenes/empty_ground follows a mover).
## Command line (for core/shot.gd): `-- --look <x> <z>`, `--yaw <deg>`, `--pitch <deg>` (90 = straight
## down), `--size <metres of screen height>`.
extends Camera3D

@export_file("*.json") var params := "res://core/camera-params.json"
const Bounds := preload("res://core/bounds.gd")

var p: Dictionary
var look := Vector3.ZERO
var yaw := 0.0
var pitch := 0.0
## Metres of ground the screen is tall at the look-at point (the zoom).
var height := 0.0
var _area := Rect2()
var _left_down := false
var _left_dragging := false
var _left_from := Vector2.ZERO
var _turning := false
## Set by `--pitch`: a screenshot may look straight down, past the tilt limits.
var _pitch_given := false

func _ready() -> void:
	p = _load_params()
	if p.is_empty():
		get_tree().quit(1)
		return
	var back := global_basis.z
	pitch = rad_to_deg(asin(clampf(back.y, -1, 1)))
	yaw = rad_to_deg(atan2(back.x, back.z))
	look = global_position - back * (global_position.y / back.y)
	height = size
	# the look-at point stays over the level, not over its backdrop (group "backdrop")
	var box := AABB()
	var any := false
	for c in get_parent().get_parent().get_children():
		if c is Node3D and not c.is_in_group(&"backdrop") and c != get_parent():
			var b: AABB = Bounds.of_node(c)
			if b.size != Vector3.ZERO:
				box = b if not any else box.merge(b)
				any = true
	_area = Rect2(box.position.x, box.position.z, box.size.x, box.size.z)
	_read_command_line()
	_apply()

func _load_params() -> Dictionary:
	var d = JSON.parse_string(FileAccess.get_file_as_string(params))
	var need := ["projection", "fov", "distance", "pitch", "height", "keySpeed", "dragStart", "turnPerPixel", "tiltPerPixel", "zoomStep"]
	if not d is Dictionary or need.any(func(k): return not d.has(k)) or not d.projection in ["orthogonal", "perspective"]:
		push_error("%s: not a JSON object with %s (projection orthogonal or perspective)" % [params, need])
		return {}
	return d

func _read_command_line() -> void:
	var args := OS.get_cmdline_user_args()
	var i := args.find("--look")
	if i >= 0 and i + 2 < args.size():
		look = Vector3(float(args[i + 1]), 0, float(args[i + 2]))
	i = args.find("--yaw")
	if i >= 0 and i + 1 < args.size():
		yaw = float(args[i + 1])
	i = args.find("--pitch")
	if i >= 0 and i + 1 < args.size():
		pitch = float(args[i + 1])
		_pitch_given = true
	i = args.find("--size")
	if i >= 0 and i + 1 < args.size():
		height = float(args[i + 1])

## Places the camera from look, yaw, pitch and height, kept inside the params and over the level.
func _apply() -> void:
	if not _pitch_given:
		pitch = clampf(pitch, p.pitch[0], p.pitch[1])
	height = clampf(height, p.height[0], p.height[1])
	look.x = clampf(look.x, _area.position.x, _area.end.x)
	look.z = clampf(look.z, _area.position.y, _area.end.y)
	var terrain := Terrain.find(self)
	look.y = terrain.height_at(look.x, look.z) if terrain else 0.0
	basis = Basis(Vector3.UP, deg_to_rad(yaw)) * Basis(Vector3.RIGHT, -deg_to_rad(pitch))
	var distance: float = p.distance
	if p.projection == "orthogonal":
		projection = PROJECTION_ORTHOGONAL
		size = height
	else:
		projection = PROJECTION_PERSPECTIVE
		fov = p.fov
		distance = height / 2 / tan(deg_to_rad(fov) / 2)
	position = look + basis.z * distance

## Looks at `point` (its height is ignored); height > 0 also sets the zoom.
func frame(point: Vector3, height_: float = -1.0) -> void:
	look = Vector3(point.x, 0, point.z)
	if height_ > 0:
		height = height_
	_apply()

## Where the ray under a screen point meets the level plane through the look-at point (y = 0 on a
## flat level; the ground height there on a level with a Terrain).
func _ground_at(screen: Vector2) -> Vector3:
	var o := project_ray_origin(screen)
	var n := project_ray_normal(screen)
	return o - n * ((o.y - look.y) / n.y) if absf(n.y) > 1e-4 else look

func _process(dt: float) -> void:
	var d := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_down", "ui_up"))
	d.x += float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
	d.y += float(Input.is_key_pressed(KEY_W)) - float(Input.is_key_pressed(KEY_S))
	if d == Vector2.ZERO:
		return
	var right := Vector3(basis.x.x, 0, basis.x.z).normalized()
	var up := Vector3(-basis.z.x, 0, -basis.z.z).normalized()
	if up == Vector3.ZERO:  # straight down: screen up is the camera's up
		up = Vector3(basis.y.x, 0, basis.y.z).normalized()
	look += (right * d.x + up * d.y).limit_length(1) * p.keySpeed * height * dt
	_apply()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		match event.button_index:
			MOUSE_BUTTON_LEFT:
				_left_down = event.pressed
				_left_from = event.position
				if not event.pressed and _left_dragging:
					_left_dragging = false
					get_viewport().set_input_as_handled()
			MOUSE_BUTTON_MIDDLE:
				_turning = event.pressed
				get_viewport().set_input_as_handled()
			MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN:
				if event.pressed:
					_zoom(event.position, 1.0 / p.zoomStep if event.button_index == MOUSE_BUTTON_WHEEL_UP else p.zoomStep)
				get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion:
		if _turning:
			_pitch_given = false
			yaw -= event.relative.x * p.turnPerPixel
			pitch += event.relative.y * p.tiltPerPixel
			_apply()
			get_viewport().set_input_as_handled()
		elif _left_down:
			if not _left_dragging and event.position.distance_to(_left_from) >= p.dragStart:
					_left_dragging = true
			if _left_dragging:
				look += _ground_at(event.position - event.relative) - _ground_at(event.position)
				_apply()
				get_viewport().set_input_as_handled()

## Zooms by `factor` keeping the ground point under the mouse where it is.
func _zoom(screen: Vector2, factor: float) -> void:
	var before := _ground_at(screen)
	height *= factor
	_apply()
	look += before - _ground_at(screen)
	_apply()
