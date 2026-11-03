## Contact correction after the accepted mapping. All limb lengths are preserved.
## Targets are in figure coordinates; the caller owns world/object transforms.
extends RefCounted

static func v(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2])

static func curve(keys: Array, phase: float) -> Vector3:
	if keys[0] is float or keys[0] is int:
		return v(keys)
	if phase <= keys[0][0]:
		return Vector3(keys[0][1], keys[0][2], keys[0][3])
	for i in range(1, keys.size()):
		if phase <= keys[i][0]:
			var a: Array = keys[i - 1]
			var b: Array = keys[i]
			var dt: float = b[0]-a[0]
			var w: float = (phase-a[0])/dt
			var result := Vector3.ZERO
			for k in 3:
				var j := k+1
				var slope: float = (b[j]-a[j])/dt
				var before: float = (a[j]-keys[i-2][j])/(a[0]-keys[i-2][0]) if i>1 else 0.0
				var after: float = (keys[i+1][j]-b[j])/(keys[i+1][0]-b[0]) if i+1<keys.size() else 0.0
				var m0 := 2*before*slope/(before+slope) if before*slope>0 else 0.0
				var m1 := 2*after*slope/(after+slope) if after*slope>0 else 0.0
				result[k]=(2*w*w*w-3*w*w+1)*a[j]+(w*w*w-2*w*w+w)*dt*m0+(-2*w*w*w+3*w*w)*b[j]+(w*w*w-w*w)*dt*m1
			return result
	var last: Array = keys[-1]
	return Vector3(last[1], last[2], last[3])

## window: [in start, in end, out start, out end], or a list of such windows (the strongest applies).
static func weight(window: Array, phase: float) -> float:
	if window[0] is Array:
		var best := 0.0
		for w in window:
			best = maxf(best, weight(w, phase))
		return best
	return smoothstep(window[0], window[1], phase) * (1.0 - smoothstep(window[2], window[3], phase))

static func solve(a: Vector3, knee: Vector3, tip: Vector3, target: Vector3, hint: Vector3) -> Array:
	var l1 := a.distance_to(knee)
	var l2 := knee.distance_to(tip)
	var delta := target - a
	var axis := delta.normalized() if delta.length_squared() > 1e-12 else Vector3.DOWN
	var d := clampf(delta.length(), absf(l1-l2) + 1e-6, l1+l2-1e-6)
	var pole := hint - axis * hint.dot(axis)
	if pole.length_squared() < 1e-8:
		pole = Vector3.FORWARD - axis * Vector3.FORWARD.dot(axis)
	if pole.length_squared() < 1e-8:
		pole = Vector3.RIGHT - axis * Vector3.RIGHT.dot(axis)
	var x := (l1*l1 - l2*l2 + d*d) / (2*d)
	return [a + axis*x + pole.normalized()*sqrt(maxf(0, l1*l1-x*x)), a + axis*d]

static func limb(p: Dictionary, name: String, target: Vector3, amount := 1.0, hint := Vector3.ZERO) -> float:
	var arms := name.begins_with("hand")
	var left := name.ends_with("Left")
	var i := (2 if left else 7) if arms else (4 if left else 9)
	var a: Vector3 = p.segs[i][0]
	var mid: Vector3 = p.segs[i][1]
	var end: Vector3 = p.segs[i+1][1]
	var goal := end.lerp(target, amount)
	var pole := hint
	if hint == Vector3.ZERO:
		# Transport the source bend plane with the endpoint direction. Projecting
		# the old upper limb onto a different target axis can reverse its bend
		# even when both the source motion and target move smoothly.
		var old_axis := (end-a).normalized()
		var new_axis := (goal-a).normalized()
		var bend := mid-a-old_axis*(mid-a).dot(old_axis)
		if bend.length_squared() > 1e-12 and new_axis.length_squared() > 0.0:
			pole = Quaternion(old_axis,new_axis)*bend
		else:
			pole = mid-a
	var result := solve(a, mid, end, goal, pole)
	p.segs[i][1] = result[0]
	p.segs[i+1][0] = result[0]
	p.segs[i+1][1] = result[1]
	if arms:
		p[name] = result[1]
	else:
		var toe: Vector3 = p.segs[i+2][1] - end
		p.segs[i+2][0] = result[1]
		p.segs[i+2][1] = result[1] + toe
	return result[1].distance_to(goal)

static func translate(p: Dictionary, delta: Vector3) -> void:
	for s in p.segs:
		s[0] += delta
		s[1] += delta
	for key in ["head", "neck", "handLeft", "handRight"]:
		p[key] += delta

## Keep the whole ink stroke above the floor, not just the ankle joint. Only
## raise feet that intersect it; airborne feet retain their animated pitch.
## The floor query uses root height to select the actor's navigation layer.
static func ground_feet(p: Dictionary, world: Transform3D, line: float, ground: Callable) -> float:
	var inverse := world.affine_inverse()
	var scale := world.basis.get_scale().x
	var residual := 0.0
	for side in 2:
		var foot: Array = p.segs[6 if side == 0 else 11]
		var radius: float = line*foot[2]*scale*0.5
		var lift := 0.0
		for j in 2:
			var point: Vector3 = world*foot[j]
			var floor_y: float = ground.call(Vector3(point.x,world.origin.y,point.z))
			lift = maxf(lift,floor_y+radius-point.y)
		if lift > 0.0:
			var target: Vector3 = inverse*(world*foot[0]+Vector3.UP*lift)
			residual = maxf(residual,limb(p,"footLeft" if side == 0 else "footRight",target)*scale)
	_ground_support_hands(p,world,line,ground)
	_ground_head(p,world,ground)
	return residual

## The mapper marks source palms carrying an inverted body. Retarget those
## hands to the actual floor (including slopes/layers), keeping arm lengths.
## Unsupported gestures retain their mapped position.
static func _ground_support_hands(p: Dictionary, world: Transform3D, line: float, ground: Callable) -> void:
	var supports: Array = p["supportHands"]
	var inverse := world.affine_inverse()
	var scale := world.basis.get_scale().x
	for side in 2:
		var amount: float = supports[side]
		if amount <= 0.0:
			continue
		var name: String = "handLeft" if side == 0 else "handRight"
		var point: Vector3 = world*p[name]
		var floor_y: float = ground.call(Vector3(point.x,world.origin.y,point.z))
		var target := inverse*Vector3(point.x,floor_y+line*scale*0.5,point.z)
		limb(p,name,target,amount)

## The head disc is much thicker than the body lines: lying down it would sink into the floor.
## Tilt it up about the neck root, just enough for its lower edge to rest on the floor.
## Head radius = neck-to-head distance minus the drawn neck (segs[1]); nothing else moves.
static func _ground_head(p: Dictionary, world: Transform3D, ground: Callable) -> void:
	var scale := world.basis.get_scale().x
	var neck: Vector3 = p.segs[0][1]  # neck root (not every pose dictionary carries "neck")
	var offset: Vector3 = p.head-neck
	var reach := offset.length()
	var radius := reach-neck.distance_to(p.segs[1][1])
	var point: Vector3 = world*p.head
	var floor_y: float = ground.call(Vector3(point.x,world.origin.y,point.z))
	var lowest: float = (floor_y-world.origin.y)/scale+radius  # head centre height it needs, figure units
	if p.head.y >= lowest:
		return
	var flat := Vector3(offset.x,0,offset.z)
	var horizontal := flat.normalized() if flat.length_squared() > 1e-12 else Vector3.FORWARD
	var rise := clampf((lowest-neck.y)/reach,-1.0,1.0)
	var direction := horizontal*sqrt(1.0-rise*rise)+Vector3.UP*rise
	p.head = neck+direction*reach
	p.segs[1][1] = neck+direction*neck.distance_to(p.segs[1][1])

static func torso(p: Dictionary, hip: Vector3, direction: Vector3) -> void:
	var old_hip: Vector3 = p.segs[0][0]
	var old_neck: Vector3 = p.neck
	var old_axis := (old_neck-old_hip).normalized()
	var axis := direction.normalized()
	var rotation := Basis(Quaternion(old_axis, axis))
	var neck := hip + axis * old_neck.distance_to(old_hip)
	for i in [0, 1, 2, 3, 7, 8]:
		for j in 2:
			p.segs[i][j] = hip + rotation * (p.segs[i][j] - old_hip)
	for key in ["head", "neck", "handLeft", "handRight"]:
		p[key] = hip + rotation*(p[key]-old_hip)
	for i in [4, 9]:
		var end: Vector3 = p.segs[i+1][1]
		var old_mid: Vector3 = p.segs[i][1]
		var result := solve(hip, hip+old_mid-old_hip, hip+end-old_hip, end, Vector3.BACK)
		var toe: Vector3 = p.segs[i+2][1]-end
		p.segs[i] = [hip,result[0],p.segs[i][2]]
		p.segs[i+1] = [result[0],result[1],p.segs[i+1][2]]
		p.segs[i+2] = [result[1],result[1]+toe,p.segs[i+2][2]]
