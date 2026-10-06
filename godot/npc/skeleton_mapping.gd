## Port of news-game sth/motion-study/skeleton-mapping.mjs, line for line: same steps, same order, same
## identifiers and constants. Differences are GDScript necessities only:
##  - the createSkeletonMapper closure is this object: SkeletonMapper.new(names, restFrame), then mapFrame();
##  - a missing joint sets `error` instead of throwing (GDScript has no exceptions; callers must check it);
##  - len() is named length() (len is a GDScript builtin);
##  - GDScript forbids a block-local name that shadows an outer local, so two such names in mapFrame are
##    renamed: the ankle-reach vector o -> ov, the hand point hd -> hand;
##  - JS destructuring {knee,end}=ik(...) is spelled out; the hand point hd inside the arm loop is hd2; smoothstep -> smoothStep (a GDScript builtin);
##  - armsByDirection's out is result (the minSpread block has its own out);
## Vectors are 3-element Arrays of float: GDScript floats are 64-bit like JS numbers (Vector3 is 32-bit).
## Parameters come only from the P argument (skeleton-params.json); none are written here.
##
## Accepted NPC mapping: metres, Y up; no nodes, playback state or file access.
## names: source joint names; restFrame: stand_idle frame 0.
## mapFrame(sourceFrame, params, clipOrigin) -> {H,N,neckEnd,head,segs,handLeft,handRight}.
## handLeft/handRight are the only addition to the .mjs output: named hand points for things held
## (a leash), so callers never index segs by position.
## segs: [start, end, lineWidthMultiplier]. Projection is the renderer's job.
extends RefCounted

const SRC := {"thigh": 0.528, "shin": 0.423} # source standing leg lengths, metres

var error := ""
var J := {}
var REST: Array

func _init(names: Array, restFrame: Array) -> void:
	for i in names.size():
		J[names[i]] = i
	var required := ["Hips", "Neck1", "Head", "HeadEnd"]
	for s in ["Left", "Right"]:
		for n in ["Arm", "ForeArm", "Hand", "Shin", "Foot", "ToeEnd"]:
			required.append(s + n)
	for name in required:
		if not J.has(name):
			error = "Missing source joint: %s" % name
			return
	REST = unit(toLocal(headVec(restFrame), torsoFrame(restFrame)))

func add(a, b): return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
func sub(a, b): return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
func mul(a, s): return [a[0]*s, a[1]*s, a[2]*s]
func dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
func length(a): return sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2])
func unit(a): return mul(a, 1.0/maxf(length(a), 1e-9))
func mix(a, b, t): return add(mul(a, 1-t), mul(b, t))

func ik(root, l1, l2, target, kneeHint): # two-bone, cosine rule; bend side from source knee
	var aim = sub(target, root)
	var d = minf(maxf(length(aim), absf(l1-l2)+1e-6), l1+l2-1e-6)
	var ax = unit(aim)
	var b = sub(kneeHint, mul(ax, dot(kneeHint, ax)))
	if length(b) < 1e-6:
		b = sub([0.0, 0.0, 1.0], mul(ax, ax[2]))
	var x = (l1*l1-l2*l2+d*d)/(2*d)
	var h = sqrt(maxf(0.0, l1*l1-x*x))
	return {"knee": add(root, add(mul(ax, x), mul(unit(b), h))), "end": add(root, mul(ax, d))}

# Head direction: source Neck1 -> head centre, expressed in the torso's own frame, with the rest-pose
# forward lean removed (at rest the source neck leans ~17deg forward, which reads as a hunch on a stick figure).
func torsoFrame(s):
	var g = func(n): return s[J[n]]
	var up = unit(sub(g.call("Neck1"), g.call("Hips")))
	var lat = sub(g.call("LeftArm"), g.call("RightArm"))
	lat = unit(sub(lat, mul(up, dot(lat, up))))
	var fw = [lat[1]*up[2]-lat[2]*up[1], lat[2]*up[0]-lat[0]*up[2], lat[0]*up[1]-lat[1]*up[0]]
	return [lat, up, fw]

func headVec(s): return sub(mix(s[J["Head"]], s[J["HeadEnd"]], 0.5), s[J["Neck1"]])
func toLocal(v, F): return [dot(v, F[0]), dot(v, F[1]), dot(v, F[2])]
func toWorld(l, F): return add(add(mul(F[0], l[0]), mul(F[1], l[1])), mul(F[2], l[2]))

func rotTo(a, b, v): # rotate v by the rotation taking unit a onto unit b (Rodrigues)
	var k = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
	var sn = length(k)
	var cs = dot(a, b)
	if sn < 1e-9:
		return v
	var u = mul(k, 1.0/sn)
	var th = atan2(sn, cs)
	var kv = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
	return add(add(mul(v, cos(th)), mul(kv, sin(th))), mul(u, dot(u, v)*(1-cos(th))))

func cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]

func rotAxis(v, u, th):
	var kv = cross(u, v)
	return add(add(mul(v, cos(th)), mul(kv, sin(th))), mul(u, dot(u, v)*(1-cos(th))))

func headDir(s, P):
	var F = torsoFrame(s)
	var l = unit(toLocal(headVec(s), F))
	return unit(toWorld(rotTo(REST, [0.0, 1.0, 0.0], l), F))

func smoothStep(e0, e1, x):
	var t = maxf(0.0, minf(1.0, (x-e0)/(e1-e0)))
	return t*t*(3-2*t)

# Arms by segment direction: elbow and hand relative to N, per side.
func armsByDirection(s, P, hdir, side):
	var g = func(n): return s[J[n]]
	var result = {}
	for sd in ["Left", "Right"]:
		# No drawn shoulder: the source clavicle (Neck1->Arm) is split between upper arm (clavSplit) and forearm (1-clavSplit).
		var c = sub(g.call(sd+"Arm"), g.call("Neck1"))
		var u = sub(g.call(sd+"ForeArm"), g.call(sd+"Arm"))
		var fa = sub(g.call(sd+"Hand"), g.call(sd+"ForeArm"))
		var w = P["clavSplit"]
		var ud = unit(add(u, mul(c, w)))
		var fd = unit(add(fa, mul(c, 1-w)))
		# Keep raised arms out of the head: the upper arm may not come closer than minSpread to the head axis.
		# Angles below minSpread+20deg are eased outward (smooth); the push is sideways, forearm rotates with the upper arm.
		if P["minSpread"] > 0:
			var th = P["minSpread"]*PI/180
			var th2 = th+20*PI/180
			var a = acos(maxf(-1.0, minf(1.0, dot(ud, hdir))))
			if a < th2:
				var q = a/th2
				var h = (2*q**3-3*q*q+1)*th+(-2*q**3+3*q*q)*th2+(q**3-q*q)*th2
				# push sideways only: keep the arm's forward/back component, grow its outward component
				var out = unit(sub(mul(side, 1 if sd == "Left" else -1), mul(hdir, dot(side, hdir)*(1 if sd == "Left" else -1))))
				var fwd = cross(hdir, out)
				var cf = dot(ud, fwd)
				var lat = sqrt(maxf(0.0, sin(h)**2-cf*cf))
				var nu = unit(add(add(mul(hdir, cos(h)), mul(fwd, cf)), mul(out, lat)))
				# At th2 an inward azimuth must not be reflected to the outside.
				# Turn it through the transition band, staying on the head cone.
				# Fully raised arms keep the accepted minSpread direction exactly.
				if a > th and dot(ud, out) < 0:
					var from = unit(sub(ud, mul(hdir, dot(ud, hdir))))
					var to = unit(sub(nu, mul(hdir, dot(nu, hdir))))
					var az = atan2(dot(hdir, cross(from, to)), dot(from, to))
					var around = rotAxis(from, hdir, az*smoothStep(th2, th, a))
					nu = add(mul(hdir, cos(h)), mul(around, sin(h)))
				var k = cross(ud, nu)
				var sn = length(k)
				if sn > 1e-9:
					var ang = atan2(sn, dot(ud, nu))
					fd = rotAxis(fd, mul(k, 1.0/sn), ang)
				ud = nu
		var el = mul(ud, P["upperArm"])
		result[sd] = {"el": el, "hand": add(el, mul(fd, P["foreArm"]))}
	return result

func mapFrame(s, P, origin): # s: source frame indexed by names -> drawn figure
	var g = func(n): return s[J[n]]
	var hs = g.call("Hips")
	var r = (P["thigh"]+P["shin"])/(SRC["thigh"]+SRC["shin"])
	var o = origin
	var S = func(p): return [o[0]+(p[0]-o[0])*r, p[1]*r, o[2]+(p[2]-o[2])*r] # whole walk scaled with leg length
	var H = S.call(hs)
	# lower hips if an ankle target is out of reach
	var drop = 0.0
	var reach = P["thigh"]+P["shin"]-1e-4
	for sd in ["Left", "Right"]:
		var ov = sub(H, S.call(g.call(sd+"Foot")))
		var h2 = ov[0]**2+ov[2]**2
		if ov[1] > 0 and length(ov) > reach and h2 < reach*reach:
			drop = maxf(drop, ov[1]-sqrt(reach*reach-h2))
	H = [H[0], H[1]-drop, H[2]]
	var F = torsoFrame(s)
	var supportHands := []
	var supportTargets := {}
	var N = add(H, mul(F[1], P["torso"]))
	var lift = 0.0
	for sd in ["Left", "Right"]:
		var hand = g.call(sd+"Hand")
		var fore = sub(hand, g.call(sd+"ForeArm"))
		var palm = add(hand, mul(unit(fore), P["palm"]))
		# Inverted floor-reaching palms carry the body; upright poses are 0.
		# Derived from each source frame, with no clip exceptions or time filter.
		var support = smoothStep(P["headFar"], P["headTouch"], palm[1])*smoothStep(0, -1, F[1][1])
		supportHands.append(support)
		var target = S.call(hand)
		target[1] = P["line"]/2
		supportTargets[sd] = target
		var upper = sub(g.call(sd+"ForeArm"), g.call(sd+"Arm"))
		var extension = length(add(upper, fore))/maxf(length(upper)+length(fore), 1e-9)
		var support_reach = (P["upperArm"]+P["foreArm"])*extension
		var delta = sub(target, N)
		var horizontal = delta[0]**2+delta[2]**2
		lift = maxf(lift, target[1]+sqrt(maxf(0, support_reach*support_reach-horizontal))-N[1])
	# Let the palms carry the whole body at the source's arm extension.
	# Clamping wrists alone would leave the inverted head resting on the floor.
	lift *= minf(supportHands[0], supportHands[1])
	H = add(H, [0, lift, 0])
	N = add(N, [0, lift, 0])
	var hd = headDir(s, P)
	var hdir = hd
	var side = F[0]
	var neckEnd = add(N, mul(hd, P["neck"]))
	var head = add(neckEnd, mul(hd, P["headR"]))
	var f = {"H": H, "N": N, "neckEnd": neckEnd, "head": head, "segs": [], "supportHands": supportHands}
	f["segs"].append_array([[H, N, P["torsoLine"]], [N, neckEnd, P["torsoLine"]]])
	var arms = armsByDirection(s, P, hdir, side)
	var srcHead = mix(g.call("Head"), g.call("HeadEnd"), 0.5)
	var R = P["headR"]+P["line"]/2
	for sd in ["Left", "Right"]:
		var a = arms[sd]
		var hand = g.call(sd+"Hand")
		var support = supportHands[0 if sd == "Left" else 1]
		# Steps 6-7 decide the arm (shoulder merged into both segments). One correction only: the hand END may not
		# sit inside the head disc. If it does it goes to the disc's edge, on the side where the source palm lies
		# from the source head. The elbow keeps the side steps 6-7 gave it; the forearm may overlap the disc.
		var el = add(N, a["el"])
		var hd2 = add(N, a["hand"])
		var palm = add(hand, mul(unit(sub(hand, g.call(sd+"ForeArm"))), P["palm"]))
		var inside = smoothStep(R+P["headR"]*0.25, R-P["headR"]*0.25, length(sub(hd2, head)))
		if inside > 0 or support > 0:
			# turn the hand's direction from the head centre toward the source's, and bring its distance out to the edge
			var to = rotTo(unit(headVec(s)), hdir, unit(sub(palm, srcHead)))
			var from = unit(sub(hd2, head))
			var k = cross(from, to)
			var sn = length(k)
			var dir = to if sn < 1e-9 else rotAxis(from, mul(k, 1.0/sn), atan2(sn, dot(from, to))*inside)
			var out = add(head, mul(dir, length(sub(hd2, head))*(1-inside)+R*inside))
			var arm = ik(N, P["upperArm"], P["foreArm"], mix(out, supportTargets[sd], support), a["el"])
			el = arm["knee"]
			hd2 = arm["end"]
		f["hand"+sd] = hd2
		var ankle = add(S.call(g.call(sd+"Foot")), [0, lift, 0])
		var leg = ik(H, P["thigh"], P["shin"], ankle, sub(g.call(sd+"Shin"), hs))
		var knee = leg["knee"]
		var end = leg["end"]
		var toe = add(end, mul(unit(sub(g.call(sd+"ToeEnd"), g.call(sd+"Foot"))), P["foot"]))
		f["segs"].append_array([[N, el, 1.0], [el, hd2, 1.0], [H, knee, 1.0], [knee, end, 1.0]])
		if P["foot"] > 0:
			f["segs"].append([end, toe, 1.0])
	return f
