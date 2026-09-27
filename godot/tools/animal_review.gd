## Standalone animal review. --species dog|cat --breed small|medium|large --action sit|...
## --time seconds --shot absolute.png ; or --capture absolute_folder --frames N --every N.
## --action behaviour shows a scripted passer-by; --action jump tests a quarter-metre platform.
extends Node3D
const Animal=preload("res://npc/animal_actions.gd")
const Cat=preload("res://npc/procedural_cat.gd")
const Brain=preload("res://npc/animal_controller.gd")
const Dog=preload("res://npc/procedural_dog.gd")
const Preview = preload("res://tools/animal_behaviour_preview.gd")
var behaviour: Dictionary
const Ink=preload("res://npc/ink_figure.gd")
var p:Dictionary
var c:Dictionary
var animal:Dictionary
var brain:Dictionary
var species="dog"
var action="sit"
var figure:Node3D
var humans:Array=[]
var other:Node3D
var cam:Camera3D
var label:Label
var time=0.0
var captured=0
var busy=false
var shot_done=false
var capture=""
var shot=""
var frames=0
var every=0
var other_state:Dictionary
var other_p:Dictionary
var jump_started=false
var jump_down=false
func _arg(key:String,fallback:String) -> String:
	var args=OS.get_cmdline_user_args()
	var i=args.find(key)
	return args[i+1] if i>=0 and i+1<args.size() else fallback
func _figure() -> Node3D:
	var f=Ink.new()
	add_child(f)
	f.setup(Color(c.review.ink[0],c.review.ink[1],c.review.ink[2],c.review.ink[3]),c.review.depth_bias)
	return f
func _ready():
	c=Dog.load_params("res://npc/animal-actions.json")
	species=_arg("--species","dog")
	action=_arg("--action","sit")
	p=Dog.load_params("res://npc/cat-params.json") if species=="cat" else Dog.load_params("res://npc/animal-breeds.json")[_arg("--breed","medium")]
	animal=Cat.create(Vector3.ZERO,0,p) if species=="cat" else Animal.create(Vector3.ZERO,0,p)
	brain=Brain.create()
	figure=_figure()
	other=_figure()
	behaviour = Preview.create(species, p, c)
	for person in c.review.people:
		humans.append(_figure())
	other_p=Dog.load_params()
	other_state=Dog.create(Animal._v(c.review.approach_start),0,other_p)
	cam=Camera3D.new()
	cam.projection=Camera3D.PROJECTION_ORTHOGONAL
	cam.size=c.review.camera_cat_size if species=="cat" else c.review.camera_size
	add_child(cam)
	cam.current=true
	var q:Dictionary=c.review
	var environment=WorldEnvironment.new()
	var env=Environment.new()
	env.background_mode=Environment.BG_COLOR
	env.background_color=Color(q.background[0],q.background[1],q.background[2])
	environment.environment=env
	add_child(environment)
	var floor=MeshInstance3D.new()
	var mesh=PlaneMesh.new()
	mesh.size=Vector2.ONE*q.floor_size
	floor.mesh=mesh
	var material=StandardMaterial3D.new()
	material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color=Color(q.ground[0],q.ground[1],q.ground[2])
	floor.material_override=material
	add_child(floor)
	if action=="jump":
		var platform=MeshInstance3D.new()
		var box=BoxMesh.new()
		box.size=Vector3(q.platform_width,c.jump.platform_height,q.platform_depth)
		platform.mesh=box
		platform.position=Vector3(0,c.jump.platform_height/2,c.jump.distance)
		var platform_mat=material.duplicate()
		platform_mat.albedo_color=Color(q.platform_color[0],q.platform_color[1],q.platform_color[2])
		platform.material_override=platform_mat
		add_child(platform)
	var layer=CanvasLayer.new()
	add_child(layer)
	label=Label.new()
	label.position=Vector2(q.label_position[0],q.label_position[1])
	label.add_theme_color_override("font_color",Color.BLACK)
	label.add_theme_font_size_override("font_size",q.label_size)
	layer.add_child(label)
	capture=_arg("--capture","")
	shot=_arg("--shot","")
	frames=int(_arg("--frames",str(c.review.frames)))
	every=int(_arg("--every",str(c.review.capture_every)))
	if capture!="":
		DirAccess.make_dir_recursive_absolute(capture)
	for i in roundi(float(_arg("--time","0"))/c.review.dt):
		_advance()
	_draw()
	get_viewport().msaa_3d=Viewport.MSAA_4X
func _advance():
	time+=c.review.dt
	var t=fposmod(time,c.review.cycle)
	var active=t>=c.review.walk_until and t<c.review.hold_until
	var command={"speed":c.review.speed,"yaw":c.review.yaw,"action":action if active else ""}
	var q:Dictionary=c.review
	if action in ["walk","trot"]:
		command={"speed":q.speed if action=="walk" else p.motion.maxSpeed*q.trot_speed_fraction,"yaw":sin(time*q.turn_frequency)*q.turn_amplitude,"action":""}
	if action=="behaviour":
		var own=animal.base.walk.position if species=="cat" else animal.walk.position
		var people=[]
		for i in q.people.size():
			var route=q.people[i]
			var phase=sin(time*q.person_step_frequency+i)
			var pos=Vector3(route[0]+route[2]*fposmod(time,q.people_period),0,route[1])
			people.append({"position":pos})
			var hip=pos+Vector3.UP*q.person_hip
			var neck=pos+Vector3.UP*q.person_neck
			var segments=[[hip,neck,q.person_width]]
			for sign in [-1,1]:
				segments.append([hip,pos+Vector3(sign*q.person_stride*phase,0,sign*q.person_arm_side/2),q.person_width])
				var shoulder=pos+Vector3(0,q.person_shoulder,sign*q.person_arm_side)
				segments.append([shoulder,shoulder+Vector3(-sign*q.person_stride*phase,-q.person_arm,0),q.person_width])
			humans[i].draw(segments,[[pos+Vector3.UP*q.person_head,q.person_head_radius]],[])
		behaviour = Preview.step(behaviour, species, p, c, c.review.dt)
		animal = behaviour.animal
		brain = behaviour.brain
		if species == "cat":
			other_state = behaviour.other
			var sil = Dog.silhouette(Dog.pose(other_state, other_p), other_p)
			other.draw(sil.segments, sil.discs, sil.triangles)
		return
	if action=="jump":
		command={"speed":0.0,"yaw":0,"action":"perch" if jump_started else ""}
		if time>c.review.walk_until and not jump_started:
			command={"jump_to":Vector3(0,c.jump.platform_height,c.jump.distance)}
		if time>c.review.hold_until and not jump_down:
			command={"jump_to":Vector3(0,0,c.jump.distance*2)}
	if species=="cat":
		animal=Cat.step(animal,command,c.review.dt,p,c)
		if not animal.jump.is_empty():
			if time<c.review.hold_until:
				jump_started=true
			else:
				jump_down=true
	else:
		animal=Animal.step(animal,command,c.review.dt,p,c)
func _draw():
	var pts=Cat.pose(animal,p,c) if species=="cat" else Animal.pose(animal,p,c)
	var sil=Animal.silhouette(pts,p)
	figure.draw(sil.segments,sil.discs,sil.triangles)
	var focus:Vector3=pts.spine[0].lerp(pts.spine[3],.5)+Vector3(0,c.review.focus_height,0)
	var yaw=float(_arg("--yaw",str(c.review.camera_yaw)))
	var pitch=c.review.camera_pitch
	cam.position=focus+Vector3(sin(yaw)*cos(pitch),sin(pitch),cos(yaw)*cos(pitch))*c.review.camera_distance
	cam.look_at(focus)
	if action=="behaviour":
		cam.size=c.review.behaviour_camera_size
	if OS.get_cmdline_user_args().has("--compare"):
		cam.size=c.review.compare_camera_size
	label.text="%s / %s / %.2f s / %s" % [species,action,time,animal.base.phase if species=="cat" else animal.phase]
	if action=="behaviour":
		label.text+=" / "+brain.mode
func _process(_dt):
	if busy or shot_done:
		return
	if shot!="" or capture!="":
		busy=true
		await RenderingServer.frame_post_draw
		var image=get_viewport().get_texture().get_image()
		if shot!="":
			image.save_png(shot)
			shot_done=true
			print("ANIMAL_SHOT_SAVED")
			get_tree().quit()
			return
		image.save_png(capture.path_join("%04d.png" % captured))
		captured+=1
		if captured>=frames:
			print("ANIMAL_CAPTURED")
			get_tree().quit()
			return
		for i in every:
			_advance()
		_draw()
		busy=false
	else:
		_advance()
		_draw()
