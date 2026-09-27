## Cat proportions and silhouette use cat-params.json. Ground gait/rest delegate to the shared
## animal solver; a finite jump keeps the whole rigid pose above an explicit support height.
extends RefCounted
const Animal=preload("res://npc/animal_actions.gd")
const Dog=preload("res://npc/procedural_dog.gd")
static func create(position:Vector3,yaw:float,p:Dictionary) -> Dictionary:
	return {"base":Animal.create(Vector3(position.x,0,position.z),yaw,p),"height":position.y,"jump":{},"time":0.0}

static func step(previous:Dictionary,command:Dictionary,dt:float,p:Dictionary,c:Dictionary) -> Dictionary:
	var s=previous.duplicate(true)
	s.time+=dt
	if s.jump.is_empty() and command.has("jump_to"):
		assert(command.jump_to is Vector3,"jump_to must be a Vector3 support point")
		s.base=Animal.step(s.base,{"speed":0.0,"yaw":s.base.walk.yaw,"action":""},dt,p,c)
		if s.base.phase=="walk" and s.base.walk.actualSpeed<c.settle_speed:
			s.jump={"elapsed":0.0,"start":s.base.walk.position+Vector3.UP*s.height,"target":command.jump_to,"anchor":Animal._walking_pose(s.base.walk,p)}
	elif not s.jump.is_empty():
		s.jump.elapsed+=dt
		if s.jump.elapsed>=c.jump.prepare+c.jump.duration+c.jump.land:
			var target:Vector3=s.jump.target
			s.base=Animal.create(Vector3(target.x,0,target.z),s.base.walk.yaw,p)
			s.height=target.y
			s.jump={}
	else:
		s.base=Animal.step(s.base,command,dt,p,c)
	return s

static func pose(s:Dictionary,p:Dictionary,c:Dictionary) -> Dictionary:
	if s.jump.is_empty():
		var pts=Animal.pose(s.base,p,c)
		Animal._transform(pts,Basis.IDENTITY,Vector3.UP*s.height)
		return pts
	var jump:Dictionary=s.jump
	var t:float=clampf((jump.elapsed-c.jump.prepare)/c.jump.duration,0,1)
	var offset:Vector3=jump.start.lerp(jump.target,t)-s.base.walk.position
	offset.y+=4*c.jump.height*t*(1-t)
	var crouch:float=clampf(jump.elapsed/c.jump.prepare,0,1)
	if jump.elapsed>c.jump.prepare+c.jump.duration:
		crouch=1-clampf((jump.elapsed-c.jump.prepare-c.jump.duration)/c.jump.land,0,1)
	var crouched=s.base.duplicate(true)
	crouched.phase="enter"
	crouched.action="jump_crouch"
	crouched.blend=crouch
	crouched.anchor=jump.anchor
	var pts:Dictionary=Animal.pose(crouched,p,c)
	Animal._transform(pts,Basis.IDENTITY,offset)
	return pts

static func silhouette(pts:Dictionary,p:Dictionary) -> Dictionary:
	return Animal.silhouette(pts,p)
