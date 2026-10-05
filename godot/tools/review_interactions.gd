## Read-only inspection harness using the actual empty-ground scene and mapped poses.
extends SceneTree
var level
func vec(v: Vector3) -> Array:
	return [v.x,v.y,v.z]
func save_json(path: String, data) -> void:
	var f := FileAccess.open(path,FileAccess.WRITE)
	f.store_string(JSON.stringify(data))
func _initialize() -> void:
	call_deferred("run")
func run() -> void:
	var args := OS.get_cmdline_user_args()
	var request: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	var out: String = request.output
	DirAccess.make_dir_recursive_absolute(out)
	level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.playing = false
	level.set_process(false)
	level.cam.set_process(false)
	level.cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	for panel in level.find_children("*","PanelContainer",true,false): panel.hide()
	level.ui.caption.add_theme_font_size_override("font_size",32)
	var st = level.stage
	for entry in request.entries:
		var id: String = entry if entry is String else entry.id
		var opts: Dictionary = {} if entry is String else entry.get("options",{})
		var label: String = id if entry is String else entry.get("label",id)
		level._select(id,opts,false)
		await process_frame
		if request.get("hide_items",false):
			for person in st.people:
				if person.item != null: person.item.node.hide()
		if st.error != "":
			push_error(st.error); quit(1); return
		var record := {"id":id,"missing":st.entry.missing,"object":st.object_type(),"item":st.person_item_type(),"samples":[],"meshes":[]}
		if not st.entry.missing.is_empty():
			save_json(out.path_join(label+".json"),record); continue
		var duration: float = st.interactions.data.clips.get(id,{}).get("duration",st.main.clip.duration())
		var frames: int = st.main.clip.count
		for frame in range(frames):
			st.seek(duration*frame/frames)
			var sample := {"time":duration*frame/frames,"people":[],"targets":{},"item_bounds":[],"reach_errors":st.interactions.errors.duplicate(true)}
			for person in st.people:
				var xf: Transform3D = person.fig.global_transform
				var joints := {}
				for key in ["head","neck","handLeft","handRight"]: joints[key] = vec(xf*person.pose[key])
				var segs := []
				for seg in person.pose.segs: segs.append([vec(xf*seg[0]),vec(xf*seg[1]),seg[2]*person.clip.P.line*st.body_scale])
				sample.people.append({"joints":joints,"segments":segs,"root":vec(person.root.origin)})
			var nodes := []
			for o in st.objects: nodes.append(o.node)
			for person in st.people:
				if person.item != null:
					nodes.append(person.item.node)
					var b: AABB = st.Bounds.of_node(person.item.node)
					sample.item_bounds.append([vec(b.position),vec(b.end)])
			for n in nodes:
				for marker in n.find_children("*","Node3D",true,false):
					if String(marker.name).begins_with("touch_") or String(marker.name).begins_with("grip_") or String(marker.name)=="strap_top": sample.targets[String(marker.name)]=vec(marker.global_position)
				if frame == 0:
					for mi in n.find_children("*","MeshInstance3D",true,false):
						if mi.mesh == null or mi.name == "InkLines" or mi.name == "ShadowProxy": continue
						var b: AABB = mi.global_transform*mi.mesh.get_aabb()
						record.meshes.append({"name":str(mi.name),"min":vec(b.position),"max":vec(b.end)})
			record.samples.append(sample)
		save_json(out.path_join(label+".json"),record)
		if request.get("capture",false):
			var sheet := Image.create(1920,720,false,Image.FORMAT_RGB8)
			for view in range(2):
				for phase in range(3):
					var phases: Array = request.get("phases",[0.15,0.5,0.85]) if entry is String else entry.get("phases",request.get("phases",[0.15,0.5,0.85]))
					var time: float = duration*phases[phase]
					st.seek(time)
					var target_height: float = request.get("target_height",0.85) if entry is String else entry.get("target_height",request.get("target_height",0.85))
					var target: Vector3 = st.main.root.origin+Vector3(0,target_height,0)
					if st.people.size()==2: target=(st.people[0].root.origin+st.people[1].root.origin)/2+Vector3.UP*0.85
					var yaws: Array = request.get("yaws",[35.0,-65.0]) if entry is String else entry.get("yaws",request.get("yaws",[35.0,-65.0]))
					var yaw: float = deg_to_rad(float(yaws[view]))
					level.cam.position=target+Vector3(sin(yaw)*0.95,request.get("camera_elevation",0.32),cos(yaw)*0.95)*30
					level.cam.look_at(target); level.cam.size=request.get("camera_size",3.5)
					level.ui.caption.text="%s %.2fs %s"%[label,time,"front" if view==0 else "side"]
					await process_frame
					await RenderingServer.frame_post_draw
					var shot: Image=root.get_texture().get_image()
					shot.convert(Image.FORMAT_RGB8); shot.resize(640,360,Image.INTERPOLATE_LANCZOS)
					sheet.blit_rect(shot,Rect2i(0,0,640,360),Vector2i(phase*640,view*360))
			sheet.save_png(out.path_join(label+".png"))
		print("REVIEWED ",label)
	quit()
