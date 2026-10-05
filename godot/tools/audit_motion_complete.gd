## Read-only exhaustive pose export. At least 60 Hz, includes native frame
## boundaries and the actual final endpoint. Never writes production assets.
extends SceneTree

const Clip := preload("res://npc/clip_pose.gd")
var level

func _initialize() -> void:
	call_deferred("run")

func add_pose(out: PackedFloat32Array, p: Dictionary) -> PackedFloat32Array:
	for s in p.segs:
		for j in 2:
			out.append_array(PackedFloat32Array([s[j].x,s[j].y,s[j].z]))
	for key in ["head","neck","handLeft","handRight"]:
		var q: Vector3=p[key]
		out.append_array(PackedFloat32Array([q.x,q.y,q.z]))
	return out

func run() -> void:
	var args := OS.get_cmdline_user_args()
	assert(args.size() in [1,2],"Output directory and optional comma-separated clip ids required")
	var out: String=args[0]
	DirAccess.make_dir_recursive_absolute(out)
	level=load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.set_process(false)
	level.playing=false
	var st=level.stage
	var index=[]
	for e in st.entries:
		if e.kind!="clip": continue
		if args.size()==2 and not e.id in args[1].split(","): continue
		var err: String=st.select(e.id,{})
		assert(err=="",err)
		var cycle: float=st.cycle
		var times=[]
		var divisions: int=ceili(cycle*maxf(60.0,st.main.clip.fps*2.0))
		for k in divisions: times.append(float(k)/divisions*cycle)
		times.append(cycle)
		# Include every native boundary as well as the uniform display timeline.
		for person in st.people:
			var count: int=person.clip.count
			var duration: float=st._cycle(person)
			for k in count+1:
				var time: float=duration*k/count
				if time<=cycle: times.append(time)
		times.sort()
		var unique=[]
		for time in times:
			if unique.is_empty() or time-unique[-1]>0.000001: unique.append(time)
		var buffer=PackedFloat32Array()
		var persons=[]
		for person in st.people:
			var cfg: Dictionary=st.interactions.data.clips.get(person.clip_id,{})
			persons.append({"id":person.clip_id,"base":cfg.get("base",person.clip_id),"manual":person.manual,"interaction":cfg})
		for time in unique:
			st.seek(time)
			assert(st.error=="",st.error)
			for person in st.people:
				var cfg: Dictionary=st.interactions.data.clips.get(person.clip_id,{})
				var source=Clip.of(cfg.get("base",person.clip_id))
				var phase: float=st._root(person,time)[1]
				buffer=add_pose(buffer,source.pose(phase,false))
				buffer=add_pose(buffer,person.pose)
				var x: Transform3D=person.fig.global_transform
				for q in [x.origin,x.basis.x,x.basis.y,x.basis.z]:
					buffer.append_array(PackedFloat32Array([q.x,q.y,q.z]))
		var file=FileAccess.open(out.path_join(e.id+".bin"),FileAccess.WRITE)
		file.store_buffer(buffer.to_byte_array())
		file.close()
		index.append({"id":e.id,"cycle":cycle,"times":unique,"persons":persons,"floats_per_person":180})
		print("FULL_POSE_EXPORTED ",e.id," ",unique.size())
	var file=FileAccess.open(out.path_join("index.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(index))
	file.close()
	print("FULL_POSE_COMPLETE ",index.size())
	quit()
