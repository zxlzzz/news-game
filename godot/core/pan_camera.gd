## Camera of a view.tscn: slides along X over a level longer than one screen.
## Arrow keys / A-D, or drag with the left mouse button. The range is the level's ground length
## (GroundStrip.length) minus what one screen already shows. `-- --pan <metres>` on the command line
## starts there, `-- --top <size> [--top-z <z>]` looks straight down (both for screenshots with core/shot.gd).
extends Camera3D

## Metres per second with the keys.
@export var key_speed := 25.0

var _home_x := 0.0
var _pan := 0.0
var _limit := 0.0
var _dragging := false

func _ready() -> void:
	_home_x = position.x
	var level := get_parent().get_parent()
	for c in level.get_children():
		if c is GroundStrip:
			var half_view := size * get_viewport().get_visible_rect().size.aspect() / 2
			_limit = maxf(0.0, c.length / 2 - half_view * 0.9)
	var args := OS.get_cmdline_user_args()
	var i := args.find("--pan")
	if i >= 0 and i + 1 < args.size():
		_set_pan(float(args[i + 1]))
	# Layout check: straight down on the same spot, `-- --top <camera size>`.
	i = args.find("--top")
	if i >= 0 and i + 1 < args.size():
		var aim := position - global_basis.z * (position.y / global_basis.z.y)
		i = args.find("--top-z")
		if i >= 0 and i + 1 < args.size():
			aim.z = float(args[i + 1])
		look_at_from_position(aim + Vector3(0, 80, 0), aim, Vector3.FORWARD)
		size = float(args[i + 1])

func _set_pan(v: float) -> void:
	_pan = clampf(v, -_limit, _limit)
	position.x = _home_x + _pan

func _process(dt: float) -> void:
	var d := Input.get_axis("ui_left", "ui_right")
	if Input.is_key_pressed(KEY_A):
		d -= 1
	if Input.is_key_pressed(KEY_D):
		d += 1
	if d != 0:
		_set_pan(_pan + d * key_speed * dt)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging:
		# one screen width of drag = one screen width of street
		var metres_per_px := size / get_viewport().get_visible_rect().size.y
		_set_pan(_pan - event.relative.x * metres_per_px)
