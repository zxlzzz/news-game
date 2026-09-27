## Independent animal action layer. Pure state -> state / pose; Dog's public interface is unchanged.
## The walking state is allowed to settle before entry. On exit, replant through Dog.create before
## resuming gait. Authored proportions, action poses, timing and tolerances are JSON data.
extends RefCounted
const Dog = preload("res://npc/procedural_dog.gd")

static func create(position: Vector3, yaw: float, p: Dictionary) -> Dictionary:
	return {"walk":Dog.create(position,yaw,p),"action":"","phase":"walk","elapsed":0.0,"blend":0.0,"time":0.0,"anchor":{},"height":position.y}

static func step(previous: Dictionary, command: Dictionary, dt: float, p: Dictionary, c: Dictionary) -> Dictionary:
	var s = previous.duplicate(true)
	s.time += dt
	s.elapsed += dt
	var want: String = command.get("action","")
	assert(want == "" or c.actions.has(want),"unknown animal action "+want)
	if s.phase == "walk":
		s.walk = Dog.step(s.walk,{"speed":command.get("speed",0.0) if want == "" else 0.0,"yaw":command.get("yaw",s.walk.yaw),"ground":func(_q:Vector3)->float:return s.height},dt,p)
		if want != "" and s.walk.actualSpeed < c.settle_speed:
			var settled = true
			for leg in Dog.LEGS:
				if s.walk.feet[leg].swing:
					settled=false
			if settled:
				s.phase="enter"
				s.action=want
				s.elapsed=0.0
				s.anchor=_walking_pose(s.walk,p)
	elif s.phase == "enter":
		s.blend=clampf(s.elapsed/c.transition,0,1)
		if s.blend >= 1:
			s.phase="hold"
			s.elapsed=0.0
	elif s.phase == "hold":
		if want != s.action:
			s.phase="exit"
			s.elapsed=0.0
	else:
		s.blend=1-clampf(s.elapsed/c.transition,0,1)
		if s.blend <= 0:
			# Entry's feet and exit's feet are the same anchor: keep planted world positions.
			s.phase="walk"
			s.action=""
			s.elapsed=0.0
	return s

static func _v(values: Array) -> Vector3:
	return Vector3(values[0],values[1],values[2])

static func _rest(s: Dictionary,p: Dictionary,c: Dictionary) -> Dictionary:
	var a: Dictionary=c.actions[s.action]
	var h: float=p.body.shoulderY
	var length: float=p.body.length
	var side=Vector3.RIGHT
	var forward=Vector3.BACK
	var hip=Vector3(0,p.body.hipY*a.hip_y,length*a.hip_z)
	var shoulder=Vector3(0,h*a.shoulder_y,length*a.shoulder_z)
	if a.get("grounded_hip", false):
		hip.y = maxf(p.silhouette.hipDisc, p.silhouette.spine / 2)
	if a.get("straight_front", false):
		var front: Dictionary = p.legs.front
		shoulder.y = front.drop + front.a + front.b + front.c
	if s.action=="shake":
		var sway:float=c.shake_body*h*sin(s.time*c.shake_frequency)
		hip.x=sway
		shoulder.x=-sway
	var arch: float=p.body.spineArch*a.arch
	var pitch: float=a.head_pitch
	var look: float=a.head_yaw+c.head_sway*sin(s.time*c.head_frequency)
	if s.action=="shake":
		look+=c.shake_angle*sin(s.time*c.shake_frequency)
	if s.action=="groom":
		pitch+=c.head_sway*sin(s.time*c.scratch_frequency)
	var head_basis=Basis(Vector3.UP,look)*Basis(Vector3.RIGHT,pitch)
	var hd: Dictionary=p.head
	var neck=shoulder+head_basis*Vector3(0,hd.neckBase[1],hd.neckBase[0])
	var head=neck+head_basis*Vector3(0,hd.head[1],hd.head[0])
	var pts={"spine":[hip,Dog._spine(hip,shoulder,arch,1.0/3),Dog._spine(hip,shoulder,arch,2.0/3),shoulder,neck],"neck":[neck,neck.lerp(head,.5),head],"muzzle":[head,head+head_basis*Vector3(0,hd.muzzle[1],hd.muzzle[0])],"collar":neck.lerp(head,hd.collarAt),"tail":[]}
	pts.ear_reference=head+head_basis*Vector3.UP
	var tail:Dictionary=p.tail
	var point=hip+Vector3(0,tail.root[1],tail.root[0])
	var wag:float=tail.wag.idle*sin(s.time*tail.wag.frequency)*(c.wag_multiplier if s.action=="wag" else 1.0)
	var resting_tail:bool=tail.has("rest") and s.action in tail.rest.actions
	if resting_tail:
		wag*=tail.rest.wag
	for i in int(tail.points):
		pts.tail.append(point)
		var elevation:float=tail.rest.elevation if resting_tail else tail.elevation-tail.elevationStep*i
		var direction=Vector3(wag*(tail.wag.base+tail.wag.growth*i),sin(elevation),-cos(elevation)).normalized()
		if resting_tail:
			direction=direction.rotated(Vector3.UP,tail.rest.curve*i)
		point+=direction*tail.segment
	for key in Dog.LEGS:
		var hind:bool=key[1]=="H"
		var sign:float=1 if key[0]=="L" else -1
		var limb:Dictionary=p.legs.hind if hind else p.legs.front
		var base:Vector3=hip if hind else shoulder
		var root=base+Vector3(sign*p.body.halfWidth,-limb.drop,0)
		var paw=Vector3(sign*p.body.footWidth,h*(a.paw_hind_y if hind else a.paw_front_y),length*((a.hip_z+a.paw_hind_z) if hind else (a.shoulder_z+a.paw_front_z)))
		if s.action=="scratch" and key=="LH":
			paw=hip+Vector3(c.scratch_side*p.body.footWidth,h*(c.scratch_height+c.scratch_amplitude*sin(s.time*c.scratch_frequency)),(limb.a+limb.b+limb.c)*c.scratch_forward)
		if s.action=="urinate" and key=="LH":
			paw=hip+Vector3(c.urinate_side*p.body.footWidth,h*c.urinate_height,length*c.urinate_forward)
		if s.action=="groom" and key=="LF":
			paw=pts.muzzle[1]+Vector3(0,-c.groom_paw_gap*h,0)
		var d=Vector2(limb.dir[0],limb.dir[1]).normalized()
		var wrist=paw+Vector3(0,d.y*limb.c,d.x*limb.c)
		if not hind and a.get("straight_front", false):
			paw = Vector3(root.x, 0, root.z)
			wrist = paw + Vector3.UP * limb.c
		# An airborne limb uses its last segment toward the root; fixed length, no reach stretching.
		if ((s.action=="scratch" or s.action=="urinate") and key=="LH") or (s.action=="groom" and key=="LF"):
			wrist=paw+(root-paw).normalized()*limb.c
		pts[key]=[root,Dog._knee(root,wrist,limb.a,limb.b,forward*limb.bend),wrist,paw]
	if a.roll != 0:
		var basis=Basis(forward,a.roll)
		_transform(pts,basis,Vector3.ZERO)
		var drawing=silhouette(pts,p)
		var lowest=INF
		for segment in drawing.segments:
			lowest=minf(lowest,minf(segment[0].y,segment[1].y)-segment[2]/2)
		for disc in drawing.discs:
			lowest=minf(lowest,disc[0].y-disc[1])
		for tri in drawing.triangles:
			for vertex in tri:
				lowest=minf(lowest,vertex.y)
		_transform(pts,Basis.IDENTITY,Vector3(0,-lowest,0))
	_transform(pts,Basis(Vector3.UP,s.walk.yaw),s.walk.position)
	return pts

static func _transform(pts:Dictionary,basis:Basis,offset:Vector3) -> void:
	for key in pts:
		if pts[key] is Array:
			for i in pts[key].size():
				pts[key][i]=basis*pts[key][i]+offset
		elif pts[key] is Vector3:
			pts[key]=basis*pts[key]+offset

static func pose(s:Dictionary,p:Dictionary,c:Dictionary) -> Dictionary:
	if s.phase=="walk":
		return _walking_pose(s.walk,p)
	var target=_rest(s,p,c)
	var t:float=s.blend*s.blend*(3-2*s.blend)
	var pts=s.anchor.duplicate(true)
	for key in pts:
		if pts[key] is Array:
			for i in pts[key].size():
				pts[key][i]=pts[key][i].lerp(target[key][i],t)
		else:
			pts[key]=pts[key].lerp(target[key],t)
	# Re-solve blended limbs. Interpolating solved knees would shorten the bones mid-transition.
	for key in Dog.LEGS:
		var limb=Dog._leg(key,p)
		var root:Vector3=pts[key][0]
		# An intentionally airborne leg has no planted target. Blend its three bone directions
		# by rotation instead of pulling its ankle straight through the hip (an IK singularity).
		if (s.action in ["scratch","urinate"] and key=="LH") or s.action=="side_lie" or (s.action=="loaf" and key[1]=="F") or (s.action=="groom" and key=="LF"):
			var chain=[root]
			var lengths=[limb.a,limb.b,limb.c]
			for j in 3:
				var start:Vector3=(s.anchor[key][j+1]-s.anchor[key][j]).normalized()
				var finish:Vector3=(target[key][j+1]-target[key][j]).normalized()
				chain.append(chain[-1]+start.slerp(finish,t)*lengths[j])
			pts[key]=chain
			continue
		var paw:Vector3=pts[key][3]
		# Rotate the distal bone on the sphere. Linear interpolation across opposite directions
		# passes near zero and flips the hock during a raised-leg transition.
		var from_distal:Vector3=(s.anchor[key][2]-s.anchor[key][3]).normalized()
		var to_distal:Vector3=(target[key][2]-target[key][3]).normalized()
		var distal:Vector3=from_distal.slerp(to_distal,t)*limb.c
		var wrist=paw+distal
		var pole:Vector3=Dog._forward(s.walk.yaw)*limb.bend
		pts[key]=[root,Dog._knee(root,wrist,limb.a,limb.b,pole),wrist,paw]
	return pts

static func silhouette(pts:Dictionary,p:Dictionary) -> Dictionary:
	var drawing=Dog.silhouette(pts,p)
	if not pts.has("ear_reference"):
		return drawing
	var head:Vector3=pts.muzzle[0]
	var forward:Vector3=(pts.muzzle[1]-head).normalized()
	var up:Vector3=pts.ear_reference-head
	up=(up-forward*up.dot(forward)).normalized()
	var side=forward.cross(up).normalized()
	var ear:Dictionary=p.silhouette.ear
	drawing.triangles=[]
	for sign in [-1,1]:
		var triangle=[]
		for j in 3:
			var q:Array=ear.points[j]
			triangle.append(head+side*ear.side*sign*(ear.tipSpread if j==1 else 1.0)+up*q[0]+forward*q[1])
		drawing.triangles.append(triangle)
	return drawing

static func _walking_pose(walk:Dictionary,p:Dictionary) -> Dictionary:
	var pts=Dog.pose(walk,p)
	pts.ear_reference=pts.muzzle[0]+Vector3.UP
	return pts
