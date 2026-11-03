extends Node3D

const System := preload("res://npc/text_behavior/system.gd")
const WalkGrid := preload("res://core/walk_grid.gd")
const Strip := preload("res://core/ground_strip.gd")
const Band := preload("res://core/ground_band.gd")
var sim: System
var grid: WalkGrid
var config: Dictionary
var camera: Camera3D
var actors: Dictionary = {}
var labels: Dictionary = {}
var paused := false
var elapsed := 0.0
var next_event := 0
var device_labels := {}
var next_call_event := 0

func vec(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2])

func _ready() -> void:
	config = JSON.parse_string(FileAccess.get_file_as_string("res://scenes/text_behavior_test/demo.json"))
	sim = System.new()
	if sim.error != "":
		fail(sim.error)
		return
	var strip := Strip.new()
	strip.length = config.ground.length
	var band := Band.new()
	band.width = config.ground.width
	band.slot = &"sidewalk"
	strip.bands.append(band)
	add_child(strip)
	var params: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	grid = WalkGrid.new(self, params.grid, {})
	if grid.error != "":
		fail(grid.error)
		return
	sim.planner = route
	for id in config.posts:
		var post: Dictionary = config.posts[id].duplicate(true)
		post.pos = vec(post.pos)
		sim.posts[id] = post
	for id in config.surfaces:
		var surface: Dictionary = config.surfaces[id].duplicate(true)
		surface.pos = vec(surface.pos)
		sim.surfaces[id] = surface
	sim.items.merge(config.items)
	for id in config.stalls:
		var stall: Dictionary = config.stalls[id].duplicate(true)
		for k in ["origin", "queue", "exit"]: stall[k] = vec(stall[k])
		var issue: String = sim.coop.add_stall(id, stall)
		if issue != "":
			fail(issue)
			return
	for id in config.get("objects",{}):
		var object: Dictionary = config.objects[id]
		var issue: String = sim.activities.add_object_markers(id,object.activity,object.provider,vec(object.origin),deg_to_rad(object.get("yaw",0)),object.markers)
		if issue != "":
			fail(issue)
			return
	for entry in config.people:
		var contents: Array = []
		for kind in entry.storage:
			var id: String = entry.id + "_" + kind
			sim.items[id] = {"kind":kind}
			contents.append(id)
		var held := ""
		if entry.has("held"):
			held = entry.id + "_" + entry.held
			sim.items[held] = {"kind":entry.held}
		var p := sim.add_person(entry.id, vec(entry.pos), held, {"bag":{"accepts":entry.get("bag_accepts",["phone", "book", "wallet"]), "capacity":entry.get("bag_capacity",3), "items":contents}}, entry.tags)
		for hand in entry.get("hands",{}): sim.set_hand(p,hand,entry.hands[hand])
		p.support = entry.get("support", "")
		p.place = p.support
	for id in config.get("animals",{}):
		var animal: Dictionary = config.animals[id].duplicate(true)
		animal.pos = vec(animal.pos)
		sim.activities.animals[id] = animal
	for id in config.get("journeys",{}):
		var journey: Dictionary = config.journeys[id]
		var issue: String = sim.activities.add_link(id,journey.activity,journey.roles,journey.destination)
		if issue != "":
			fail(issue)
			return
	for id in config.get("devices",{}):
		var entry: Dictionary = config.devices[id]
		var issue: String = sim.supports.add_device(id,entry.profile,vec(entry.pos),entry.get("options",{}))
		if issue != "":
			fail(issue)
			return
	for id in config.get("calls",{}):
		var entry: Dictionary = config.calls[id]
		var issue: String = sim.supports.open_call(id,entry.actor,entry.endpoint,entry.get("kind","phone"),entry.get("destination",""))
		if issue != "":
			fail(issue)
			return
	for id in config.get("current_tasks",{}):
		var entry: Dictionary=config.current_tasks[id]
		var issue: String=sim.activities.add_task(id,entry.profile,entry.actor,entry.subject,entry.get("post",""))
		if issue!="":
			fail(issue)
			return
	for id in config.get("checkouts",{}):
		var entry: Dictionary=config.checkouts[id]
		var issue: String=sim.activities.add_checkout(id,entry.process,entry.post,entry.stock,entry.output,entry.credits,entry.price)
		if issue!="":
			fail(issue)
			return
	for id in config.get("transfer_intents",{}):
		var entry: Dictionary=config.transfer_intents[id]
		var issue: String=sim.coop.add_intent(id,entry.sender,entry.receiver,entry.item,entry.pair,entry.get("container",""))
		if issue!="":
			fail(issue)
			return
	var world_error := sim.check_world()
	if world_error != "":
		fail(world_error)
		return
	build_view(strip)
	sim.choose_all()
	if sim.error != "":
		fail(sim.error)
		return
	refresh()

func fail(message: String) -> void:
	push_error("TextBehavior: " + message)
	set_process(false)
	get_tree().quit(1)

## Crowd's grid paths end at a cell centre; append the final step onto the actual post.
func route(a: Vector3, b: Vector3) -> PackedVector3Array:
	var pts := grid.plan("walk", a, b)
	if pts.is_empty(): return pts
	var params: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/crowd-params.json"))
	if pts[-1].distance_to(b) > params.postStep: return PackedVector3Array()
	pts.insert(0, a)
	pts.append(b)
	return pts

func _process(dt: float) -> void:
	if sim == null: return
	if sim.error != "":
		fail(sim.error)
		return
	if not paused:
		# Same fixed maximum step as Crowd; long UI frames cannot skip preparation effects.
		elapsed += minf(dt, 0.1)
		while elapsed >= 1.0/60:
			step(1.0/60)
			elapsed -= 1.0/60
	if sim.error != "": fail(sim.error)
	refresh()

func trigger_event(spec: Dictionary) -> void:
	var subject: Dictionary = sim.coop.person(spec.get("subject",""))
	var pos: Vector3 = subject.pos if not subject.is_empty() else vec(spec.pos)
	sim.activities.emit_event(spec.kind,pos,spec.get("subject",""),spec.get("options",{}))

func step(dt: float) -> void:
	var scheduled: Array = config.get("scheduled_events",[])
	while next_event < scheduled.size() and sim.clock >= scheduled[next_event].at:
		trigger_event(scheduled[next_event])
		next_event += 1
	var endings: Array = config.get("call_endings",[])
	while next_call_event < endings.size() and sim.clock >= endings[next_call_event].at:
		sim.supports.end_call(endings[next_call_event].id,endings[next_call_event].reason)
		next_call_event += 1
	sim.tick(dt)

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE: paused = not paused
		if event.keycode == KEY_R: get_tree().reload_current_scene()
		if event.keycode == KEY_F: reset_view()
		if event.keycode == KEY_T and config.has("manual_event"): trigger_event(config.manual_event)

# View only: wheel zooms toward the cursor, any mouse button drags, F resets.
func _unhandled_input(event: InputEvent) -> void:
	if camera == null: return
	if event is InputEventMouseButton and event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN]:
		var before := ground_at(event.position)
		var factor := 0.87 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0/0.87
		camera.size = clampf(camera.size*factor, 2.0, 200.0)
		camera.position += before - ground_at(event.position)
	elif event is InputEventMouseMotion and event.button_mask != 0:
		var per_pixel: float = camera.size/get_viewport().get_visible_rect().size.y
		camera.position += (-camera.global_basis.x*event.relative.x + camera.global_basis.y*event.relative.y)*per_pixel

func ground_at(screen: Vector2) -> Vector3:
	var origin := camera.project_ray_origin(screen)
	var dir := camera.project_ray_normal(screen)
	if is_zero_approx(dir.y): return origin
	return origin + dir*(-origin.y/dir.y)

func reset_view() -> void:
	camera.position = vec(config.camera.position)
	camera.look_at(vec(config.camera.look))
	camera.size = config.camera.size

func material(color: String) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color)
	return m

func box(parent: Node3D, size: Vector3, pos: Vector3, color: String) -> void:
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	shape.material = material(color)
	mesh.mesh = shape
	mesh.position = pos
	parent.add_child(mesh)

func line(parent: Node3D, a: Vector3, b: Vector3) -> void:
	var shape := CylinderMesh.new()
	shape.top_radius = config.view.line_radius
	shape.bottom_radius = config.view.line_radius
	shape.height = a.distance_to(b)
	shape.material = material(config.view.body_color)
	var mesh := MeshInstance3D.new()
	mesh.mesh = shape
	mesh.position = (a+b)*0.5
	mesh.quaternion = Quaternion(Vector3.UP, (b-a).normalized())
	parent.add_child(mesh)

func build_view(strip: Node3D) -> void:
	get_window().size = Vector2i(config.view.window[0], config.view.window[1])
	for mesh in strip.get_children(): mesh.material_override = material(config.view.floor_color)
	camera = Camera3D.new()
	add_child(camera)
	camera.position = vec(config.camera.position)
	camera.look_at(vec(config.camera.look))
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = config.camera.size
	camera.current = true
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-60, -30, 0)
	add_child(light)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(config.view.floor_color)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color.WHITE
	env.environment.ambient_light_energy = 0.6
	add_child(env)
	var layer := CanvasLayer.new()
	add_child(layer)
	var title := Label.new()
	title.text = "文字 NPC 第四批  |  空格：暂停  R：重来  T：制造跌倒  滚轮：缩放  拖动：平移  F：复位\n移动支撑 · 出租车响应 · 器械／承重 · 路线门 · 持续通话 · 原有交谈、棋桌、摊位"
	title.add_theme_font_size_override("font_size", config.view.title_size)
	title.add_theme_color_override("font_color", Color(config.view.text_color))
	title.position = Vector2(16, 12)
	layer.add_child(title)
	for id in sim.posts:
		var post: Dictionary = sim.posts[id]
		var label := Label3D.new()
		label.text = {"sit":"座位", "notice":"公告栏", "fountain":"饮水处", "exit":"出口", "waypoint":"闲逛点", "vendor":"摊主位", "customer":"顾客位", "fruitweigh":"称重位", "queue":"排队区", "delivery":"递接位", "pair":"握手位"}.get(post.kind, post.kind)
		label.position = post.pos + Vector3(0, 0.1, -0.6)
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.font_size = 32
		label.modulate = Color(config.view.text_color)
		add_child(label)
		var width: float = config.view.seat_width if post.kind == "sit" else config.view.marker_width
		var height: float = config.view.seat_height if post.kind == "sit" else config.view.marker_height
		box(self, Vector3(width, height, config.view.seat_depth), post.pos + Vector3(0, height/2, -0.4), config.view.post_color)
	for surface in sim.surfaces.values():
		var size := vec(config.view.surface_size)
		box(self, size, surface.pos + Vector3(0, size.y/2, -0.9), config.view.post_color)
	for p in sim.people:
		var actor := Node3D.new()
		add_child(actor)
		actors[p.id] = actor
		# A fixed standing symbol; the text, rather than pose animation, is the result under review.
		var h: float = config.view.person_height
		line(actor, Vector3(0,h*0.45,0), Vector3(0,h*0.85,0))
		for side in [-1,1]:
			line(actor, Vector3(0,h*0.45,0), Vector3(side*h*0.14,0,0))
			line(actor, Vector3(0,h*0.75,0), Vector3(side*h*0.2,h*0.45,0))
		var head := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = config.view.head_radius
		sphere.height = sphere.radius*2
		sphere.material = material(config.view.body_color)
		head.mesh = sphere
		head.position.y = h*0.94
		actor.add_child(head)
		var panel := PanelContainer.new()
		panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		panel.custom_minimum_size.x = config.view.panel_width
		var style := StyleBoxFlat.new()
		style.bg_color = Color(config.view.box_color)
		style.set_content_margin_all(5)
		panel.add_theme_stylebox_override("panel", style)
		var text := Label.new()
		text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		text.add_theme_color_override("font_color", Color(config.view.text_color))
		text.add_theme_font_size_override("font_size", config.view.font_size)
		panel.add_child(text)
		layer.add_child(panel)
		labels[p.id] = {"panel":panel, "text":text}
	for id in sim.activities.animals:
		var animal := Node3D.new()
		add_child(animal)
		box(animal,Vector3(0.35,0.4,0.7),Vector3(0,0.2,0),config.view.body_color)
		var caption := Label3D.new()
		caption.text = "狗（文字状态）"
		caption.position.y = 0.8
		caption.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		animal.add_child(caption)
		actors[id] = animal
	# Devices are text/position markers only, without physical props or animation.
	for id in sim.supports.devices:
		var label := Label3D.new()
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.font_size = 28
		label.modulate = Color(config.view.text_color)
		add_child(label)
		device_labels[id] = label

func refresh() -> void:
	if camera == null: return
	for p in sim.people:
		actors[p.id].visible = not p.gone
		actors[p.id].position = p.pos
		actors[p.id].rotation.y = p.yaw
		var ui: Dictionary = labels[p.id]
		ui.panel.visible = not p.gone
		ui.text.text = "\n".join(sim.lines(p))
		var screen := camera.unproject_position(p.pos + Vector3.UP*float(config.view.label_height))
		ui.panel.position = screen - Vector2(ui.panel.size.x/2, ui.panel.size.y + float(config.view.label_offset))
	for id in sim.activities.animals:
		actors[id].position = sim.activities.animals[id].pos
	for id in device_labels:
		var d: Dictionary = sim.supports.devices[id]
		device_labels[id].position = d.pos+Vector3(0,.1,0)
		device_labels[id].text = "%s\n%s · 占用 %s · 门 %.1f" % [id,"响应停靠" if d.responding else d.session.get("phase","停放"),str(d.slots),d.door]
	# People standing together (handshake, stall) would print their boxes on top of each other.
	# Stack overlapping boxes upward, nearest-to-screen-bottom first, so every line stays readable.
	var shown: Array = labels.values().filter(func(ui): return ui.panel.visible)
	shown.sort_custom(func(a, b): return a.panel.position.y > b.panel.position.y)
	var placed: Array = []
	for ui in shown:
		var rect := Rect2(ui.panel.position, ui.panel.size)
		var moved := true
		while moved:
			moved = false
			for other in placed:
				if rect.grow(-1).intersects(other):
					rect.position.y = other.position.y - rect.size.y - 2
					moved = true
		ui.panel.position = rect.position
		placed.append(rect)
