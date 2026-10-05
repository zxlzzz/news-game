## Sit/stand between an accessible approach and the seat, without changing limb lengths.
extends RefCounted
const Contact = preload("res://npc/contact_pose.gd")
const Clip = preload("res://npc/clip_pose.gd")

static func pose(seated: Dictionary, amount: float, approach: Vector3, scale: float, settings: Dictionary) -> Dictionary:
	var stand: Dictionary = Clip.of("stand_idle").pose(0).duplicate(true)
	Contact.translate(stand,approach/scale)
	if amount<=0: return stand
	if amount>=1: return seated.duplicate(true)
	var p: Dictionary=seated.duplicate(true)
	var w:=smoothstep(0,1,amount)
	var hip: Vector3=stand.segs[0][0].lerp(seated.segs[0][0],w)
	var direction: Vector3=(stand.neck-stand.segs[0][0]).normalized().lerp((seated.neck-seated.segs[0][0]).normalized(),w)
	direction.z+=sin(PI*w)*settings.lean
	Contact.torso(p,hip,direction)
	for side in ["Left","Right"]:
		var leg: int=4 if side=="Left" else 9
		var window: Array=settings.steps[0 if side=="Left" else 1]
		var step:=clampf((amount-window[0])/(window[1]-window[0]),0,1)
		var foot: Vector3=stand.segs[leg+1][1].lerp(seated.segs[leg+1][1],smoothstep(0,1,step))
		foot.y+=sin(PI*step)*settings.foot_lift/scale
		Contact.limb(p,"foot"+side,foot,1.0,Vector3.BACK)
		var toe: Vector3=(stand.segs[leg+2][1]-stand.segs[leg+2][0]).normalized()
		p.segs[leg+2][1]=p.segs[leg+2][0]+toe*seated.segs[leg+2][0].distance_to(seated.segs[leg+2][1])
		Contact.limb(p,"hand"+side,stand["hand"+side].lerp(seated["hand"+side],w))
	return p
