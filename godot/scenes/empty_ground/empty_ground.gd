## The empty ground: one flat band with the game's look and the orbit camera, and a list of everything
## that moves (every clip in npc/motion, the movers and animal actions of movers.json) to look at one by
## one. What is placed for an entry, and what dragging writes, is stage.gd; this file is the panel, the
## mouse and the command line (godot/README.md "空地").
##   godot --path . res://scenes/empty_ground/level.tscn [-- options]
##   --entry <id>          a clip id, a mover id of movers.json, or <species>:<action> (dog:sit)
##   --item <held type>    --object <type>    --breed <breed>      the swaps the panel offers
##   --time <s>  --speed <x>
##   --shot <abs png>      one still (core/shot.gd), paused at --time
##   --capture <abs dir> --frames <n> --every <k>   n PNGs, k steps of movers.json dt apart; prints EMPTY_GROUND_CAPTURED
##   --look <x> <z>  --yaw <deg>  --pitch <deg>  --size <m>   the camera (core/orbit_camera.gd); otherwise the
##                         view frames the entry, and follows movers and animals
## Mouse: drag a thing with the left button (with the vertical key of params.json: up and down), right-click
## removes one added by hand; the left button elsewhere and the middle button move the camera. Space: play / pause.
extends "res://core/level.gd"

const Stage := preload("res://scenes/empty_ground/stage.gd")
const KEYS := {"shift": KEY_SHIFT, "ctrl": KEY_CTRL, "alt": KEY_ALT}

var stage
var cam   # core/orbit_camera.gd
var ui := {}
var playing := true
var speed := 1.0
var follow := false
var capture_dir := ""
var capture_left := 0
var capture_every := 1
var _captured := 0
var _capturing := false
var _args: PackedStringArray
var _shown: Array = []   # entry ids in the list, in order
var _grab := {}
var _grab_point := Vector3.ZERO

## Passes unhandled input to the ground; added last, so it hears the mouse before the camera does.
class Catcher extends Node:
	var ground
	func _unhandled_input(event: InputEvent) -> void:
		ground._on_input(event)

func _arg(key: String, fallback: String) -> String:
	var i := _args.find(key)
	return _args[i + 1] if i >= 0 and i + 1 < _args.size() else fallback

func _die(msg: String) -> void:
	push_error("EmptyGround: " + msg)
	printerr("EmptyGround: " + msg)
	set_process(false)
	get_tree().quit(1)

func _ready() -> void:
	super._ready()
	cam = get_viewport().get_camera_3d()
	if cam == null:
		return  # level.gd found an error and is quitting
	_args = OS.get_cmdline_user_args()
	get_viewport().msaa_3d = Viewport.MSAA_4X
	stage = Stage.new()
	add_child(stage)
	var err: String = stage.setup_stage(self)
	if err != "":
		_die(err)
		return
	if not KEYS.has(stage.p.get("verticalKey")):
		_die("%s: verticalKey must be one of %s" % [Stage.PARAMS, KEYS.keys()])
		return
	capture_dir = _arg("--capture", "")
	capture_left = int(_arg("--frames", "0"))
	capture_every = int(_arg("--every", "4"))
	var still := _args.has("--shot") or capture_dir != ""
	_build_ui(still)
	var catcher := Catcher.new()
	catcher.ground = self
	add_child(catcher)
	var opts := {}
	if _args.has("--item"):
		opts.item = stage.setup.type_path(_arg("--item", ""))
	if _args.has("--object"):
		opts.object = stage.setup.type_path(_arg("--object", ""))
	if _args.has("--breed"):
		opts.breed = _arg("--breed", "")
	speed = float(_arg("--speed", "1"))
	_select(_arg("--entry", stage.entries[0].id), opts, true)
	stage.seek(float(_arg("--time", "0")))
	if follow:
		cam.frame(stage.focus())
	playing = not _args.has("--shot")
	if capture_dir != "":
		DirAccess.make_dir_recursive_absolute(capture_dir)

func _select(id: String, opts: Dictionary, frame_view: bool) -> void:
	var err: String = stage.select(id, opts)
	if err != "":
		_die(err)
		return
	var e: Dictionary = stage.entry
	if ui.has("list"):
		var i := _shown.find(id)
		if i >= 0:
			ui.list.select(i)
			ui.list.ensure_current_is_visible()
		_fill_choice(ui.item, stage.item_choices(), stage.options.get("item", stage.person_item_type()))
		_fill_choice(ui.object, stage.object_choices(), stage.options.get("object", stage.object_type()))
		_fill_choice(ui.breed, stage.breed_choices(), stage.options.get("breed", ""))
		ui.slider.max_value = stage.cycle
		ui.status.text = ("缺：" + "；".join(e.missing)) if not e.missing.is_empty() else ""
	if frame_view:
		var fr: Array = stage.framing()
		cam.frame(cam.look if _args.has("--look") else fr[0], -1.0 if _args.has("--size") else fr[1])
		follow = stage.follows() and not _args.has("--look")
		if ui.has("follow"):
			ui.follow.set_pressed_no_signal(follow)

func _process(delta: float) -> void:
	if stage == null or stage.error != "":
		if stage != null:
			_die(stage.error)
		return
	if capture_dir != "":
		_capture()
		return
	if playing:
		stage.advance(delta * speed)
	if follow:
		cam.frame(stage.focus())
	_show_time()

func _show_time() -> void:
	ui.slider.set_value_no_signal(stage.t)
	ui.time.text = "%.2f / %.2f s" % [stage.t, stage.cycle]
	ui.caption.text = "%s   %.2f s   %s" % [stage.entry.id, stage.t, stage.mover_state()]

func _capture() -> void:
	if _capturing:
		return
	_capturing = true
	_show_time()
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(capture_dir.path_join("%04d.png" % _captured))
	_captured += 1
	if _captured >= capture_left:
		print("EMPTY_GROUND_CAPTURED ", stage.entry.id, " ", _captured)
		get_tree().quit()
		return
	for i in capture_every:
		stage.advance(stage.m.dt * speed)
	if follow:
		cam.frame(stage.focus())
	_capturing = false

# ------------------------------------------------------------------ panel

func _build_ui(still: bool) -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var theme := Theme.new()
	theme.default_font_size = int(stage.p.fontSize)
	ui.caption = Label.new()
	ui.caption.theme = theme
	ui.caption.add_theme_color_override("font_color", Color(0.05, 0.05, 0.05))
	ui.caption.position = Vector2(16, 12) if still else Vector2(stage.p.panelWidth + 24, 12)
	layer.add_child(ui.caption)
	var panel := PanelContainer.new()
	panel.theme = theme
	panel.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	panel.offset_right = stage.p.panelWidth
	panel.visible = not still
	layer.add_child(panel)
	var box := VBoxContainer.new()
	panel.add_child(box)
	ui.filter = LineEdit.new()
	ui.filter.placeholder_text = "筛选"
	ui.filter.text_changed.connect(func(_s): _fill_list())
	box.add_child(ui.filter)
	ui.list = ItemList.new()
	ui.list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	ui.list.item_selected.connect(func(i): _select(_shown[i], {}, true))
	box.add_child(ui.list)
	var row := HBoxContainer.new()
	box.add_child(row)
	ui.play = Button.new()
	ui.play.text = "播放 / 暂停"
	ui.play.pressed.connect(func(): playing = not playing)
	row.add_child(ui.play)
	var sp := SpinBox.new()
	sp.min_value = stage.p.speed[0]
	sp.max_value = stage.p.speed[1]
	sp.step = stage.p.speed[2]
	sp.value = float(_arg("--speed", "1"))
	sp.suffix = "倍速"
	sp.value_changed.connect(func(v): speed = v)
	row.add_child(sp)
	ui.slider = HSlider.new()
	ui.slider.step = 0.001
	ui.slider.value_changed.connect(func(v): stage.seek(v))
	box.add_child(ui.slider)
	ui.time = Label.new()
	box.add_child(ui.time)
	ui.item = _choice(box, "配件", "item")
	ui.object = _choice(box, "物件", "object")
	ui.breed = _choice(box, "品种", "breed")
	ui.follow = CheckBox.new()
	ui.follow.text = "镜头跟随"
	ui.follow.toggled.connect(func(on): follow = on)
	box.add_child(ui.follow)
	var add := Button.new()
	add.text = "加一个人（播当前动作）"
	add.pressed.connect(func(): _status(stage.add_person(_manual_spot())))
	box.add_child(add)
	var row2 := HBoxContainer.new()
	box.add_child(row2)
	var types := OptionButton.new()
	types.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	types.fit_to_longest_item = false
	for t in stage.all_types():
		types.add_item(String(t).get_file().get_basename())
		types.set_item_metadata(types.item_count - 1, t)
	row2.add_child(types)
	var add_obj := Button.new()
	add_obj.text = "加物件"
	add_obj.pressed.connect(func(): _status(stage.add_object(types.get_item_metadata(types.selected), _manual_spot())))
	row2.add_child(add_obj)
	ui.status = Label.new()
	ui.status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ui.status.custom_minimum_size = Vector2(stage.p.panelWidth - 16, 0)
	box.add_child(ui.status)
	var hint := Label.new()
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.custom_minimum_size = Vector2(stage.p.panelWidth - 16, 0)
	hint.modulate = Color(1, 1, 1, 0.6)
	hint.text = "左键拖东西：在地面上挪；按住 %s 拖：上下。松手写回相对位置（人在物件上、配件在手里、两人之间）。右键删掉手加的。空格播放 / 暂停。" % stage.p.verticalKey
	box.add_child(hint)
	_fill_list()

func _choice(box: Control, title: String, key: String) -> OptionButton:
	var row := HBoxContainer.new()
	box.add_child(row)
	var l := Label.new()
	l.text = title
	row.add_child(l)
	var o := OptionButton.new()
	o.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	o.fit_to_longest_item = false
	o.item_selected.connect(func(i): _swap(key, o.get_item_metadata(i)))
	row.add_child(o)
	return o

func _fill_choice(o: OptionButton, choices: Array, current: String) -> void:
	o.clear()
	for c in choices:
		o.add_item(String(c).get_file().get_basename())
		o.set_item_metadata(o.item_count - 1, c)
		if c == current:
			o.select(o.item_count - 1)
	o.disabled = choices.is_empty()

## Another item, object type or breed for the current entry: placed again, time kept, view kept.
func _swap(key: String, value) -> void:
	var opts: Dictionary = stage.options.duplicate()
	opts[key] = value
	var keep: float = stage.t
	_select(stage.entry.id, opts, false)
	stage.seek(keep)

func _fill_list() -> void:
	ui.list.clear()
	_shown.clear()
	var f: String = ui.filter.text.strip_edges()
	for e in stage.entries:
		if f != "" and not f in e.label:
			continue
		var text: String = e.label + ("   — 缺：" + "；".join(e.missing) if not e.missing.is_empty() else "")
		var i: int = ui.list.add_item(text)
		if not e.missing.is_empty():
			ui.list.set_item_custom_fg_color(i, Color(0.55, 0.55, 0.55))
		_shown.append(e.id)
	var cur := _shown.find(stage.entry.get("id", "")) if stage != null else -1
	if cur >= 0:
		ui.list.select(cur)

func _status(msg: String) -> void:
	ui.status.text = msg

## Where a person or object added by hand appears: in front of the view centre, on the ground.
func _manual_spot() -> Vector3:
	var back := Vector3(cam.global_basis.z.x, 0, cam.global_basis.z.z).normalized()
	return Vector3(cam.look.x, 0, cam.look.z) + back * stage.p.manualOffset

# ------------------------------------------------------------------ mouse

func _on_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_SPACE:
		playing = not playing
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			var h: Dictionary = stage.pick(event.position, cam)
			if not h.is_empty():
				_grab = h
				_grab_point = stage.handle_point(h)
				get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_LEFT and not event.pressed and not _grab.is_empty():
			var r: Dictionary = stage.release(_grab)
			_grab = {}
			_status(r.error if r.error != "" else ("已写回 " + r.wrote if r.wrote != "" else ""))
			get_viewport().set_input_as_handled()
		elif event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
			var h: Dictionary = stage.pick(event.position, cam)
			if not h.is_empty() and stage.remove(h):
				get_viewport().set_input_as_handled()
	elif event is InputEventMouseMotion and not _grab.is_empty():
		var delta: Vector3
		if Input.is_key_pressed(KEYS[stage.p.verticalKey]):
			delta = Vector3(0, -event.relative.y * cam.size / get_viewport().get_visible_rect().size.y, 0)
		else:
			delta = _on_plane(event.position, _grab_point.y) - _on_plane(event.position - event.relative, _grab_point.y)
			delta.y = 0
		stage.drag(_grab, delta)
		_grab_point += delta
		get_viewport().set_input_as_handled()

func _on_plane(screen: Vector2, y: float) -> Vector3:
	var o: Vector3 = cam.project_ray_origin(screen)
	var n: Vector3 = cam.project_ray_normal(screen)
	return o + n * ((y - o.y) / n.y) if absf(n.y) > 1e-4 else o
