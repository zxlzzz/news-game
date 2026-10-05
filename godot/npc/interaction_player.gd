## Seekable prop and contact tracks. Hosts supply people, objects and figure scale.
## No frame accumulation: seeking backwards gives the same result as forward playback.
extends RefCounted

const Contact := preload("res://npc/contact_pose.gd")
const ClipPose := preload("res://npc/clip_pose.gd")
const Bounds := preload("res://core/bounds.gd")
const InkFigure := preload("res://npc/ink_figure.gd")
const PATH := "res://npc/interactions.json"
var data: Dictionary
var spawned: Array = []
var parts: Array = []
var errors: Array = []
var water_nodes := {}
var cords := {}
var error := ""
const CLIP_KEYS := ["stationary","duration","base","phase_offset","playback","tracks_playback","object","body","head_direction","feet","hands","item","item_visible","props","water","cord","shift"]
const TRACK_KEYS := ["space","at","keys","arcs","bounce","plant","marker","id","joint","segment","along","pole","window","flat","type","visible","rotation","rotation_space"]

func _init() -> void:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(PATH))
	if not parsed is Dictionary or not parsed.get("clips") is Dictionary or not parsed.get("objects") is Dictionary:
		error=PATH+": expected clips and objects dictionaries"
		return
	data=parsed
	for id in data.clips:
		var c: Dictionary=data.clips[id]
		if not FileAccess.file_exists("res://npc/motion/"+id+".json"):
			error="Unknown interaction clip: "+id
			return
		for key in c:
			if not key in CLIP_KEYS: error="Unknown interaction field: "+id+"."+key
		if c.has("duration") and c.duration<=0: error="Nonpositive duration: "+id
		if c.has("tracks_playback") and c.tracks_playback!="loop": error="Unknown tracks playback: "+id
		if c.has("playback") and c.playback!="once": error="Unknown playback: "+id
		for kind in ["hands","feet"]:
			for key in c.get(kind,{}): _validate_track(c[kind][key],id+"."+key)
		for prop in c.get("props",[]):
			_validate_track(prop,id+".prop")
			if not ResourceLoader.exists("res://types/"+prop.type+".tscn"): error="Missing prop type: "+prop.type
		if c.has("body"): _validate_track(c.body.hip,id+".hip")
		if c.get("item",{}).has("anchor"): _validate_track(c.item.anchor,id+".item")

func _validate_track(track: Dictionary, where: String) -> void:
	for key in track:
		if not key in TRACK_KEYS: error="Unknown contact field: "+where+"."+key
	if track.has("keys"):
		var previous := -INF
		for k in track.keys:
			if k.size()!=2 or k[0]<=previous: error="Unordered target keys: "+where; return
			previous=k[0]
			_validate_track(k[1],where)
	if track.has("arcs"):
		for a in track.arcs:
			if a.size()!=5 or a[1]<=a[0]: error="Invalid projectile arc: "+where; return
			_validate_track(a[2],where)
			_validate_track(a[3],where)
	if track.has("space") and not track.space in ["root","head","hip","neck","handLeft","handRight","item","object","prop","partner","partner_item"]:
		error="Unknown contact space: "+where

func clear() -> void:
	for n in spawned:
		n.queue_free()
	spawned.clear()
	parts.clear()
	water_nodes.clear()
	cords.clear()
	errors.clear()

func prepare(people: Array, objects: Array, instantiate: Callable) -> void:
	if error!="": return
	for person in people:
		var c: Dictionary = data.clips.get(person.clip_id, {})
		if person.get("manual",false): c={}
		person["interaction"] = c
		person["props"] = []
		if c.has("cord"):
			var cord := InkFigure.new()
			person.get("effects_parent",person.fig.get_parent()).add_child(cord)
			cord.setup(Color.BLACK,0)
			spawned.append(cord)
			cords[person.clip_id]=cord
		if c.has("water"):
			var stream := MeshInstance3D.new()
			var mesh := CylinderMesh.new()
			mesh.top_radius=data.water_radius
			mesh.bottom_radius=data.water_radius
			mesh.height=1
			stream.mesh=mesh
			var mat := StandardMaterial3D.new()
			mat.albedo_color=Color(data.water_gray,data.water_gray,data.water_gray)
			mesh.material=mat
			person.get("effects_parent",person.fig.get_parent()).add_child(stream)
			spawned.append(stream)
			water_nodes[person.clip_id]=stream
		for prop in c.get("props", []):
			var node: Node3D = instantiate.call("res://types/"+prop.type+".tscn")
			spawned.append(node)
			person.props.append({"node":node,"track":prop})
	if objects.is_empty():
		return
	var object: Node3D = objects[0].node
	var auto: Array = people.filter(func(p): return not p.get("manual",false))
	if auto.is_empty(): return
	for track in data.objects.get(objects[0].type.get_file().get_basename(), []):
		if track.has("clips") and not auto[0].clip_id in track.clips: continue
		for pattern in track.nodes:
			var matches := object.find_children(pattern,"Node3D",true,false)
			assert(not matches.is_empty(), "Missing animated part: " + pattern)
			for n in matches:
				parts.append({"node":n,"rest":n.transform,"track":track})

func phase_of(person: Dictionary, time: float) -> float:
	var config: Dictionary = person.get("interaction",data.clips.get(person.clip_id,{}))
	var phase: float = time / config.get("duration",person.clip.duration())
	if person.get("play_once", false):
		phase = clampf(phase, 0, 1)
	phase += float(config.get("phase_offset",0))
	var source = ClipPose.of(config.base) if config.has("base") else person.clip
	var repeat: bool = source.chains and config.get("playback","")!="once"
	if person.get("play_once", false) and not config.has("phase_offset"):
		repeat = false
	return fposmod(phase,1.0) if repeat else clampf(phase,0,1)

## An explicitly authored hand/item/prop/object cycle may repeat over a source
## body that enters once and holds. Source and body/feet phases keep phase_of;
## this opt-in never wraps the noncontinuous source. Explicit once takes priority.
func track_phase_of(person: Dictionary, time: float) -> float:
	var config: Dictionary = person.get("interaction",data.clips.get(person.clip_id,{}))
	if config.get("tracks_playback","")=="loop" and config.get("playback","")!="once":
		var phase: float = time/config.get("duration",person.clip.duration())
		if person.get("play_once", false):
			return clampf(phase,0,1)
		return fposmod(phase+float(config.get("phase_offset",0)),1.0)
	return phase_of(person,time)

func animate_objects(time: float, people: Array) -> void:
	if people.is_empty(): return
	var auto: Array = people.filter(func(p): return not p.get("manual",false))
	if auto.is_empty(): return
	var phase := track_phase_of(auto[0],time)
	for part in parts:
		var d: Dictionary = part.track
		if d.has("visible"):
			part.node.visible = phase>=d.visible[0] and phase<=d.visible[1]
		if not d.has("angle"): continue
		var angle := Contact.curve(d.angle,phase).x
		var pivot := Contact.v(d.pivot)
		var r := Basis(Contact.v(d.axis),deg_to_rad(angle))
		part.node.transform = Transform3D(r,pivot-r*pivot)*part.rest

func target(track: Dictionary, person: Dictionary, objects: Array, people: Array, phase: float, scale: float) -> Vector3:
	if track.has("arcs"):
		for arc in track.arcs:
			if phase <= arc[1]:
				var u := clampf((phase-float(arc[0]))/(float(arc[1])-float(arc[0])),0,1)
				var a := target(arc[2],person,objects,people,phase,scale)
				var b := target(arc[3],person,objects,people,phase,scale)
				return a.lerp(b,u)+Vector3.UP*4.0*float(arc[4])*u*(1.0-u)/scale
		return target(track.arcs[-1][3],person,objects,people,phase,scale)
	if track.has("keys"):
		var keys: Array = track.keys
		if phase <= keys[0][0]: return target(keys[0][1],person,objects,people,phase,scale)
		for i in range(1,keys.size()):
			if phase <= keys[i][0]:
				var a := target(keys[i-1][1],person,objects,people,phase,scale)
				var b := target(keys[i][1],person,objects,people,phase,scale)
				return a.lerp(b,smoothstep(keys[i-1][0],keys[i][0],phase))
		return target(keys[-1][1],person,objects,people,phase,scale)
	var offset := Contact.curve(track.get("at",[0,0,0]),phase)
	if track.has("plant"):
		var release: float=track.plant[0]
		var land: float=track.plant[1]
		var stride: float=person.clip.stride()*scale
		if phase<=release: offset.z-=stride*phase
		elif phase>=land: offset.z+=stride*(1-phase)
		else:
			var u: float=(phase-release)/(land-release)
			var tangent: float=-stride*(land-release)
			offset.z+=(2*u*u*u-3*u*u+1)*(-stride*release)+(u*u*u-2*u*u+u)*tangent+(-2*u*u*u+3*u*u)*(stride*(1-land))+(u*u*u-u*u)*tangent
	if track.has("bounce"):
		var b: Dictionary=track.bounce
		var u:=fposmod(phase*float(b.cycles)+float(b.get("phase",0)),1.0)
		offset.y=b.floor+4.0*float(b.height)*u*(1.0-u)
		if b.has("minimum"): offset.y=maxf(offset.y,b.minimum)
	var space: String = track.get("space","root")
	var world: Vector3
	match space:
		"root": world = person.root * offset
		"head": world = person.fig.transform * person.pose.head + person.root.basis*offset
		"hip": world = person.fig.transform * person.pose.segs[0][0] + person.root.basis*offset
		"neck": world = person.fig.transform * person.pose.neck + person.root.basis*offset
		"handLeft", "handRight": world = person.fig.transform * person.pose[space] + person.root.basis*offset
		"prop":
			var found := false
			for p in person.props:
				if p.track.get("id",p.track.type) == track.id:
					var node: Node3D = p.node
					if track.has("marker"):
						node = node.find_child(track.marker,true,false)
						assert(node != null,"Missing prop contact " + track.marker)
					world = node.global_transform*offset
					found = true
			assert(found,"Missing prop " + track.id)
		"item":
			var node: Node3D = person.item.node
			if track.has("marker"):
				node = node.find_child(track.marker,true,false)
				assert(node != null, "Missing item contact " + track.marker)
			world = node.global_transform * offset
		"object":
			assert(not objects.is_empty(),"Object contact without an object")
			var node: Node3D = objects[0].node
			if track.has("marker"):
				node = node.find_child(track.marker,true,false)
				assert(node != null,"Missing object contact " + track.marker)
			world = node.global_transform * offset
		"partner":
			var other: Dictionary = people.filter(func(p): return p!=person and not p.get("manual",false))[0]
			if track.has("segment"):
				var s: Array = other.pose.segs[int(track.segment)]
				world = other.fig.transform * s[0].lerp(s[1],track.get("along",0.5)) + person.root.basis*offset
			else:
				world = other.fig.transform * other.pose[track.get("joint","handRight")] + person.root.basis*offset
		"partner_item":
			var other: Dictionary = people.filter(func(p): return p!=person and not p.get("manual",false))[0]
			world=other.item.node.global_transform*offset
		_: assert(false,"Unknown target space " + space)
	return person.fig.transform.affine_inverse() * world

func body(person: Dictionary, objects: Array, people: Array, phase: float, scale: float) -> void:
	var c: Dictionary = person.get("interaction",{})
	var p: Dictionary = person.pose
	if c.has("shift"):
		Contact.translate(p,Contact.curve(c.shift,phase)/scale)
	if c.has("body"):
		var b: Dictionary = c.body
		var yaw := Basis(Vector3.UP,deg_to_rad(Contact.curve(b.get("yaw",[0,0,0]),phase).x))
		if b.has("yaw"):
			var origin: Vector3=p.segs[0][0]
			for s in p.segs:
				s[0]=origin+yaw*(s[0]-origin)
				s[1]=origin+yaw*(s[1]-origin)
			for key in ["head","neck","handLeft","handRight"]: p[key]=origin+yaw*(p[key]-origin)
		var hip := target(b.hip,person,objects,people,phase,scale)
		# without a direction the torso keeps the clip's own lean; only the hips move
		var direction: Vector3 = yaw*Contact.curve(b.direction,phase) if b.has("direction") else p.neck-p.segs[0][0]
		Contact.torso(p,hip,direction)
	if c.has("head_direction"):
		var axis := Contact.curve(c.head_direction,phase).normalized()
		var length: float = p.neck.distance_to(p.head)
		p.head=p.neck+axis*length
		p.segs[1][1]=p.neck+axis*p.segs[1][0].distance_to(p.segs[1][1])
	for key in c.get("feet",{}):
		var track: Dictionary = c.feet[key]
		var goal := target(track,person,objects,people,phase,scale)
		var residual := Contact.limb(p,key,goal,1.0,Contact.v(track.get("pole",[0,0,1]))) * scale
		if residual>data.reach_tolerance: errors.append({"clip":person.clip_id,"joint":key,"phase":phase,"reach":residual})
		if track.get("flat",true):
			var i := 6 if key=="footLeft" else 11
			var toe: Vector3 = p.segs[i][1]-p.segs[i][0]
			var flat := Vector3(toe.x,0,toe.z).normalized()*toe.length()
			p.segs[i][1]=p.segs[i][0]+flat

func item(person: Dictionary, objects: Array, people: Array, phase: float, scale: float) -> void:
	if person.item == null: return
	var c: Dictionary = person.get("interaction",{})
	if not c.has("item"): return
	var d: Dictionary = c.item
	var node: Node3D = person.item.node
	var rotation := Contact.curve(d.get("rotation",[0,0,0]),phase) * PI/180.0
	var basis: Basis = person.root.basis * Basis.from_euler(rotation)
	if d.get("follow_forearm",false):
		var i := 8 if person.item.hand=="right" else 3
		var direction: Vector3 = person.pose.segs[i][1]-person.pose.segs[i][0]
		basis=person.root.basis*Basis(Quaternion(Vector3.UP,direction.normalized()))*Basis.from_euler(rotation)
	var q: Vector3 = person.pose.handRight if person.item.hand=="right" else person.pose.handLeft
	if person.item.hand=="both": q=(person.pose.handLeft+person.pose.handRight)/2
	if person.item.hand=="back": q=person.pose.neck
	if d.has("anchor"): q=target(d.anchor,person,objects,people,phase,scale)
	# a two-handed tool: its local `align` vector (this grip to the other grip) points at the other hand
	var axis := Vector3.ZERO
	if d.has("align"):
		var other: Vector3 = person.pose.handLeft if person.item.hand=="right" else person.pose.handRight
		var reach: Vector3 = person.fig.transform.basis*(other-q)
		if reach.length_squared() > 1e-10:
			axis = reach.normalized()
			basis = Basis(Quaternion((basis*Contact.v(d.align)).normalized(),axis))*basis
	# Place an explicit local contact point at the anchor (e.g. sleeve grip or cup lip).
	# Its phase curve lets a prop rotate without losing its physical grasp.
	var pivot := Contact.curve(d.get("pivot",[0,0,0]),phase)
	node.transform = Transform3D(basis,person.fig.transform*q-basis*pivot)
	if c.has("item_visible"):
		node.visible=phase>=c.item_visible[0] and phase<=c.item_visible[1]
	if d.has("ground"):
		var floor_y: float = person.root.origin.y + Contact.curve(d.ground,phase).x
		var box := Bounds.of_node(node)
		# slide: along the tool's own axis (the hands slide on the handle), else straight down
		var shift := Vector3.UP if not d.get("slide",false) or absf(axis.y) < 0.2 else axis/axis.y
		node.position += shift*(floor_y-box.position.y)

func contacts(person: Dictionary, objects: Array, people: Array, phase: float, scale: float, track_phase := -1.0) -> void:
	var c: Dictionary = person.get("interaction",{})
	var hands_phase: float = phase if track_phase<0.0 else track_phase
	for key in c.get("hands",{}):
		var track: Dictionary = c.hands[key]
		var amount: float = Contact.weight(track.window,hands_phase) if track.has("window") else 1.0
		var goal := target(track,person,objects,people,hands_phase,scale)
		var residual := Contact.limb(person.pose,key,goal,amount,Contact.v(track.get("pole",[0,0,0]))) * scale
		if residual > data.reach_tolerance and amount > 0.99:
			errors.append({"clip":person.clip_id,"joint":key,"phase":hands_phase,"reach":residual})

func props(person: Dictionary, objects: Array, people: Array, phase: float, scale: float) -> void:
	var c: Dictionary = person.get("interaction",{})
	if c.has("cord"):
		var d: Dictionary=c.cord
		var a: Vector3=person.fig.transform*target(d.from,person,objects,people,phase,scale)
		var b: Vector3=person.fig.transform*target(d.to,person,objects,people,phase,scale)
		var segments := []
		var previous := a
		for i in range(1,int(d.segments)+1):
			var u: float=float(i)/d.segments
			var point:=a.lerp(b,u)-Vector3.UP*4.0*float(d.sag)*u*(1-u)
			segments.append([previous,point,d.width])
			previous=point
		cords[person.clip_id].draw(segments,[],[])
	if c.has("water"):
		var d: Dictionary = c.water
		var a: Vector3 = person.fig.transform*target(d.from,person,objects,people,phase,scale)
		var b: Vector3 = person.fig.transform*target(d.to,person,objects,people,phase,scale)
		var stream: MeshInstance3D=water_nodes[person.clip_id]
		stream.visible=phase>=d.window[0] and phase<=d.window[1]
		stream.transform=Transform3D(Basis(Quaternion(Vector3.UP,(b-a).normalized())).scaled(Vector3(1,a.distance_to(b),1)),(a+b)/2)
	for prop in person.get("props",[]):
		var d: Dictionary = prop.track
		prop.node.visible = phase >= d.get("visible",[0,1])[0] and phase <= d.get("visible",[0,1])[1]
		var q := target(d,person,objects,people,phase,scale)
		var basis: Basis = person.item.node.basis if d.get("rotation_space","")=="item" else person.root.basis
		prop.node.transform = Transform3D(basis*Basis.from_euler(Contact.curve(d.get("rotation",[0,0,0]),phase)*PI/180),person.fig.transform*q)
