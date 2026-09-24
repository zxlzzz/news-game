## Isolated review of the procedural movers: the dog, a dog walker on a leash, riders. Not a game
## scene; the motion schedules in _advance() are test scenarios, the movers' own numbers live in
## npc/*.json and the vehicle types.
##
## godot --path . --resolution 960x640 res://tools/locomotion_review.tscn -- --mode dog|leash|bicycle|scooter
##     [--view side|high] [--yaw <deg>] [--time <s>]   camera; start after <s> s of simulated motion
##     [--shot <abs.png>]                               one still (core/shot.gd), motion frozen at --time
##     [--capture <abs dir> --frames <n> --every <k>]   n PNGs, k simulation steps of 1/60 s apart
## tools/record_review.py turns captures into GIFs. SPACE pauses. A rider reach error prints
## LOCOMOTION_REVIEW_ERROR and quits 1.
extends "res://core/level.gd"

const Dog := preload("res://npc/procedural_dog.gd")
const Rider := preload("res://npc/rider.gd")
const DogWalker := preload("res://npc/dog_walker.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const INK := Color(0.04, 0.04, 0.04)
const DT := 1.0 / 60

var mode := "dog"
var t := 0.0
var cam: Camera3D
var cam_dir: Vector3
var label: Label
var paused := false
var shot := false
var capture_dir := ""
var capture_left := 0
var capture_every := 1
var bodies: Dictionary
# dog
var dog_p: Dictionary
var dog: Dictionary
var dog_fig: Node3D
# leash
var dw: DogWalker
var walker_fig: Node3D
var rope_fig: Node3D
# riders
var vehicle: Node3D
var rider_fig: Node3D
var R: Dictionary
var P: Dictionary
var ride: Dictionary
var ride_yaw := 0.0

func _arg(key: String, fallback: String) -> String:
	var a := OS.get_cmdline_user_args()
	var i := a.find(key)
	return a[i + 1] if i >= 0 and i + 1 < a.size() else fallback

func _read(path: String) -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string(path))

func _ready() -> void:
	mode = _arg("--mode", "dog")
	assert(mode in ["dog", "leash", "bicycle", "scooter"], "unknown --mode " + mode)
	shot = OS.get_cmdline_user_args().has("--shot")
	capture_dir = _arg("--capture", "")
	capture_left = int(_arg("--frames", "0"))
	capture_every = int(_arg("--every", "4"))
	bodies = _read("res://npc/body-types.json")
	var ground := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(400, 0.1, 400)
	var mat := StandardMaterial3D.new()
	mat.resource_name = "sidewalk"
	box.material = mat
	ground.mesh = box
	ground.position.y = -0.05
	add_child(ground)
	if mode in ["bicycle", "scooter"]:
		vehicle = load("res://types/%s.tscn" % mode).instantiate()
		add_child(vehicle)
	palette = preload("res://palettes/gray.tres")
	view = preload("res://scenes/street_demo/view.tscn")
	population = Population.new()  # nobody else: this scene shows only the mover under review
	super._ready()
	get_viewport().msaa_3d = Viewport.MSAA_4X
	cam = get_viewport().get_camera_3d()
	var yaw := deg_to_rad(float(_arg("--yaw", "60")))
	var pitch := deg_to_rad(38.0 if _arg("--view", "high") == "high" else 8.0)
	cam_dir = Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	cam.size = 1.9 if mode == "dog" else 3.4
	var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
	sun.look_at_from_position(Vector3(-0.55, 0.75, 0.63) * 30, Vector3.ZERO)
	match mode:
		"dog":
			dog_p = Dog.load_params()
			dog = Dog.create(Vector3.ZERO, 0, dog_p)
			dog_fig = _figure(self)
		"leash":
			dw = DogWalker.new(Vector3.ZERO, 0.0, bodies.adult.scale)
			assert(dw.error == "", dw.error)
			dog_fig = _figure(self)
			rope_fig = _figure(self)
			walker_fig = _figure(self)
			walker_fig.scale = Vector3.ONE * dw.body_scale
		_:
			P = _read("res://npc/skeleton-params.json")
			R = Rider.style(Rider.load_params(), vehicle.rider_style)
			ride = Rider.start()
			rider_fig = _figure(vehicle)
	var canvas := CanvasLayer.new()
	add_child(canvas)
	label = Label.new()
	label.position = Vector2(24, 16)
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_color", Color(0.05, 0.05, 0.05))
	canvas.add_child(label)
	for i in roundi(float(_arg("--time", "0")) / DT):
		_advance()
	_draw_all()
	if capture_dir != "":
		DirAccess.make_dir_recursive_absolute(capture_dir)

func _figure(parent: Node) -> Node3D:
	var f := InkFigure.new()
	parent.add_child(f)
	f.setup(INK, 0.03)
	return f

## Test scenarios: dog walks, trots, stands, walks on; the walker walks 12 s and stands 4 s while
## wandering; riders cruise on a gentle S-curve, pedalling 7 s and coasting 3 s of every 10.
func _advance() -> void:
	t += DT
	match mode:
		"dog":
			var c := fposmod(t, 20.0)
			var speed := 0.5 if c < 7 else (1.3 if c < 13 else (0.0 if c < 16 else 0.4))
			dog = Dog.step(dog, {"speed": speed, "yaw": sin(t * 0.25) * 1.2}, DT, dog_p)
		"leash":
			dw.step(dw.walk_speed() if fposmod(t, 16.0) < 12 else 0.0, sin(t * 0.12) * 1.0, DT)
		_:
			var cruise := 3.0 if mode == "bicycle" else 4.5
			var yaw_rate := 0.25 * sin(t * 0.3)
			ride = Rider.step(ride, {"speed": cruise, "yawRate": yaw_rate, "pedalling": fposmod(t, 10.0) < 7},
				DT, vehicle.info(), R)
			ride_yaw += yaw_rate * DT
			vehicle.position += Vector3(sin(ride_yaw), 0, cos(ride_yaw)) * cruise * DT
			vehicle.rotation = Vector3(0, ride_yaw, 0)
			vehicle.rotate_object_local(Vector3.BACK, -ride.roll)

func _draw_all() -> void:
	var focus := Vector3.ZERO
	var info := ""
	match mode:
		"dog":
			var sil := Dog.silhouette(Dog.pose(dog, dog_p), dog_p)
			dog_fig.draw(sil.segments, sil.discs, sil.triangles)
			focus = dog.position + Vector3(0, 0.3, 0)
			info = "%s  %.2f m/s" % [dog.gait, dog.actualSpeed]
		"leash":
			for pair in [[dog_fig, dw.dog_drawing()], [rope_fig, dw.rope_drawing()], [walker_fig, dw.walker_drawing()]]:
				pair[0].draw(pair[1].segments, pair[1].discs, pair[1].triangles)
			walker_fig.transform = dw.walker_transform().scaled_local(Vector3.ONE * dw.body_scale)
			focus = (dw.walker.position + dw.dog.position) / 2 + Vector3(0, 0.7, 0)
			info = "walker %.2f m/s   dog %s %.2f m/s   rope %.2f / %.2f m" % [dw.walker.speed, dw.dog.gait,
				dw.dog.actualSpeed, dw.separation, dw.leash_p.ropeLength]
		_:
			var pose := Rider.solve(vehicle.contacts(ride.crankPhase, R.gripFromBarEnd), P, bodies[R.body].scale, R, ride)
			if not pose.errors.is_empty():
				printerr("LOCOMOTION_REVIEW_ERROR ", mode, " ", pose.errors)
				get_tree().quit(1)
			vehicle.set_motion(ride.wheelAngle, ride.crankPhase)
			rider_fig.draw(pose.segments, pose.discs, [])
			focus = vehicle.position + Vector3(0, 0.9, 0)
			info = "%s   lean %.0f°   roll %.0f°" % ["pedalling" if fposmod(t, 10.0) < 7 else "coasting",
				rad_to_deg(pose.points.lean), rad_to_deg(ride.roll)]
	cam.position = focus + cam_dir * 30
	cam.look_at(focus)
	label.text = "%s   %.2f s   %s" % [mode, t, info]

func _process(_delta: float) -> void:
	if shot or paused:
		return
	if capture_dir != "":
		_capture()
		return
	_advance()
	_draw_all()

var _capturing := false
var _captured := 0
func _capture() -> void:
	if _capturing:
		return
	_capturing = true
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(capture_dir.path_join("%04d.png" % _captured))
	_captured += 1
	if _captured >= capture_left:
		print("LOCOMOTION_CAPTURED ", mode, " ", _captured)
		get_tree().quit()
		return
	for i in capture_every:
		_advance()
	_draw_all()
	_capturing = false

func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_pressed() and (event as InputEventKey).keycode == KEY_SPACE:
		paused = not paused
