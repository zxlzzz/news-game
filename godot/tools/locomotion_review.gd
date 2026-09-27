## Isolated review of the procedural movers: the dog, a dog walker on a leash, riders, the pigeon. Not a game
## scene; the motion schedules in _advance() are test scenarios, the movers' own numbers live in
## npc/*.json and the vehicle types.
##
## godot --path . --resolution 960x640 res://tools/locomotion_review.tscn -- --mode dog|leash|bicycle|scooter|pigeon|pigeon_fly
##     [--view side|high] [--yaw <deg>] [--time <s>]   camera; start after <s> s of simulated motion
##     [--shot <abs.png>]                               one still (core/shot.gd), motion frozen at --time
##     [--capture <abs dir> --frames <n> --every <k>]   n PNGs, k simulation steps of 1/60 s apart
## pigeon_fly: the pigeon's take-off, flight and landing from a fixed wide shot (the camera does not
## follow), so the climb and descent show; both pigeon modes draw 0.5 m grid lines on the ground.
## tools/record_review.py turns captures into GIFs. SPACE pauses. A rider reach error prints
## LOCOMOTION_REVIEW_ERROR and quits 1.
extends "res://core/level.gd"

const Dog := preload("res://npc/procedural_dog.gd")
const Pigeon := preload("res://npc/procedural_pigeon.gd")
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
# pigeon
var pig_p: Dictionary
var pig: Dictionary
var pig_fig: Node3D
var fly_focus := Vector3.INF
# leash
## The review walks on flat ground at height 0.
var flat_ground := func(_q: Vector3) -> float: return 0.0
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
	assert(mode in ["dog", "leash", "bicycle", "scooter", "pigeon", "pigeon_fly"], "unknown --mode " + mode)
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
	cam.size = {"dog": 1.9, "pigeon": 1.1, "pigeon_fly": 3.5}.get(mode, 3.4)
	var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
	sun.look_at_from_position(Vector3(-0.55, 0.75, 0.63) * 30, Vector3.ZERO)
	match mode:
		"dog":
			dog_p = Dog.load_params()
			dog = Dog.create(Vector3.ZERO, 0, dog_p)
			dog_fig = _figure(self)
		"pigeon", "pigeon_fly":
			pig_p = Pigeon.load_params()
			pig = Pigeon.create(Vector3.ZERO, 0, pig_p)
			_ground_grid()
			pig_fig = _figure(self)
		"leash":
			dw = DogWalker.new(Vector3.ZERO, 0.0, bodies.adult.scale, flat_ground)
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

## Grey lines on the ground every 0.5 m, so height and travel show against it.
func _ground_grid() -> void:
	var g := InkFigure.new()
	add_child(g)
	g.setup(Color(0.55, 0.55, 0.55), 0.0)
	var segs := []
	for i in range(-24, 25):
		var k := i * 0.5
		segs.append([Vector3(k, 0.002, -12), Vector3(k, 0.002, 12), 0.012])
		segs.append([Vector3(-12, 0.002, k), Vector3(12, 0.002, k), 0.012])
	g.draw(segs, [], [])

func _figure(parent: Node) -> Node3D:
	var f := InkFigure.new()
	parent.add_child(f)
	f.setup(INK, 0.03)
	return f

## Test scenarios: dog walks, trots, stands, walks on; the pigeon (a 26 s loop) walks, stands looking
## about, feeds, hops twice, takes off, flies a curve, lands and stands; the walker walks 12 s and stands 4 s while
## wandering; riders cruise on a gentle S-curve, pedalling 7 s and coasting 3 s of every 10.
func _advance() -> void:
	t += DT
	match mode:
		"dog":
			var c := fposmod(t, 20.0)
			var speed := 0.5 if c < 7 else (1.3 if c < 13 else (0.0 if c < 16 else 0.4))
			dog = Dog.step(dog, {"speed": speed, "yaw": sin(t * 0.25) * 1.2, "ground": flat_ground}, DT, dog_p)
		"pigeon", "pigeon_fly":
			var c := fposmod(t, 26.0)
			var flying: bool = c >= 15 and c < 20.5
			var hop = null
			for at in [13.0, 14.0]:
				if c - DT < at and at <= c:
					hop = pig.position + Vector3(sin(pig.yaw), 0, cos(pig.yaw)) * 0.3
			# in the air it circles (about 1.8 m across) so a fixed shot keeps it in view
			pig = Pigeon.step(pig, {"speed": 0.3 if c < 5 else (0.06 if c >= 9 and c < 12.5 else (1.6 if c >= 15 and pig.mode != "ground" else 0.0)),
				"yaw": (c - 15.0) * 0.9 if c >= 15 else sin(t * 0.3) * 1.0, "ground": 0.0, "peck": c >= 9 and c < 12.5, "fly": flying,
				"altitude": 1.2, "hop": hop}, DT, pig_p)
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
		"pigeon", "pigeon_fly":
			var sil := Pigeon.silhouette(Pigeon.pose(pig, pig_p), pig_p)
			pig_fig.draw(sil.segments, sil.discs, sil.triangles)
			# on the ground (and hopping) the camera stays level, so the hop's height shows; in the air it follows
			var flying: bool = pig.mode in ["takeoff", "air", "landing"]
			focus = Vector3(pig.position.x, (pig.position.y if flying else pig.ground) + 0.12, pig.position.z)
			if mode == "pigeon_fly":
				if fly_focus == Vector3.INF:
					fly_focus = pig.position + Vector3(0, 0.8, 0)
				focus = fly_focus
			info = "%s  %.2f m/s  %s" % [pig.mode, pig.speed, "feeding" if pig.peck > 0.5 else ""]
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
