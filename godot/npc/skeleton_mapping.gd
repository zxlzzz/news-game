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

# ---------------------------------------------------------------------------------------------------------------
# Step 11, hand contact (2026-10-15 trial; docs/asset-production/motions/npc-skeleton-mapping.md step 11, numbers in
# npc/hand-contact.json, C below). Not in the .mjs: mapFrame above stays steps 1-10 exactly. A hand of the real
# person near a point of their own body (mouth, crown, chest, pocket, the other hand ...) is put at the same point
# of the figure: its offset from the person's point, scaled by the two bodies' size ratio there, is added to the
# figure's point. Far from every point the hand keeps steps 1-10 untouched. The weights are smoothed over time, so
# this needs the whole clip: mapClip.

func orth(v, n): return sub(v, mul(n, dot(v, n)))

## "" or the first joint step 11 reads that the clip frames lack.
func contactError(C) -> String:
	var need := []
	for s in ["Left", "Right"]:
		for j in C.palm:
			need.append(s + j)
	need.append_array(["LeftEye", "RightEye"])
	for name in C.points:
		need.append_array(C.points[name].source.at.keys())
	for j in need:
		if not J.has(j):
			return "Missing source joint for hand contact: %s" % j
	return ""

## The person's points and the frames both bodies share (world, metres). held: {} or the thing in one hand whose tip
## touches the body (mapClip): touch[side] is then that tip, the thing hung on the person's palm at its real size;
## otherwise touch is the palm.
func contactFrame(s, P, C, held := {}) -> Dictionary:
	var g = func(n): return s[J[n]]
	var F = torsoFrame(s)
	var hdir = headDir(s, P)
	var hl = unit(orth(sub(g.call("LeftEye"), g.call("RightEye")), hdir))
	var headF = [hl, hdir, cross(hl, hdir)]
	var Rh = length(sub(g.call("HeadEnd"), g.call("Head")))/2
	var T = length(sub(g.call("Neck1"), g.call("Hips")))
	var pts = {}
	for name in C.points:
		var d = C.points[name]
		var at = [0.0, 0.0, 0.0]
		for j in d.source.at:
			at = add(at, mul(g.call(j), d.source.at[j]))
		var head: bool = d.part == "head"
		pts[name] = add(at, mul(toWorld(d.source.offset, headF if head else F), Rh if head else T))
	var palms = {}
	for sd in ["Left", "Right"]:
		var p = [0.0, 0.0, 0.0]
		for j in C.palm:
			p = add(p, mul(g.call(sd+j), C.palm[j]))
		palms[sd] = p
	var touch = palms.duplicate()
	if not held.is_empty():
		touch[held.side] = add(palms[held.side], held.tip)
	return {"F": F, "hdir": hdir, "headF": headF, "points": pts, "palms": palms, "touch": touch,
		"scale": {"head": P["headR"]/Rh, "torso": P["torso"]/T}}

## Per frame, per column [Left per point (C.points order)..., Right ..., pair]: the hand's (or its held thing's tip's)
## offset from the point (the other hand for pair) and the weight its distance alone gives.
func contactOffsets(s, P, C, held := {}) -> Dictionary:
	var cf = contactFrame(s, P, C, held)
	var off := []
	var near := []
	for sd in ["Left", "Right"]:
		for name in C.points:
			var d = C.points[name]
			off.append(sub(cf.touch[sd], cf.points[name]))
			near.append(smoothStep(d.near+d.band, d.near, length(off[-1])))
	off.append(sub(cf.palms["Left"], cf.palms["Right"]))
	near.append(smoothStep(C.pair.near+C.pair.band, C.pair.near, length(off[-1])))
	return {"off": off, "near": near}

## The weights before smoothing, worked out over the whole clip: a hand counts as on a point only while it rests there
## (2026-10-15, his rule) — near it (weight above 0), moving against it slower than stillSpeed (m/s, measured over
## speedSeconds), for at least holdSeconds without a break. Passing by, hanging or swinging past gives 0.
## wrap: the last frame repeats the first, so speeds and spans run round.
func contactWeights(frames: Array, P, C, fps: float, wrap: bool, held := {}) -> Array:
	var n := frames.size()
	var rows := []
	for s in frames:
		rows.append(contactOffsets(s, P, C, held))
	var m := n-1 if wrap and n > 1 else n
	var idx = func(i): return posmod(i, m) if wrap else clampi(i, 0, n-1)
	var h := maxi(1, roundi(C.speedSeconds*fps/2))
	var hold := maxi(1, roundi(C.holdSeconds*fps))
	var cols: int = rows[0].off.size()
	var out := []
	for i in n:
		var row := []
		row.resize(cols)
		row.fill(0.0)
		out.append(row)
	for c in cols:
		var rest := []
		for i in m:
			var a = idx.call(i-h)
			var b = idx.call(i+h)
			var speed = length(sub(rows[b].off[c], rows[a].off[c]))*fps/maxf(1.0, float(b-a) if not wrap else 2.0*h)
			rest.append(rows[i].near[c] > 0 and speed <= C.stillSpeed)
		# spans of resting frames; on a loop a span may run over the seam
		var start := 0
		if wrap and rest.has(false):
			while rest[start]:
				start += 1
		var k := 0
		while k < m:
			var i0 = (start+k) % m
			if not rest[i0]:
				k += 1
				continue
			var span := 0
			while k+span < m and rest[(start+k+span) % m]:
				span += 1
			if span >= hold or (wrap and span == m):
				for j in span:
					var i = (start+k+j) % m
					out[i][c] = rows[i].near[c]
			k += span
		if wrap and m < n:
			out[n-1][c] = out[0][c]
	return out

## The figure's points: head ones on the head (direction in the shared head frame, distance in headR), torso ones by
## torso length from the hips, arm ones along that arm's upper arm (elbows: {Left, Right}).
func figurePoints(H, N, head, headF, F, elbows, P, C) -> Dictionary:
	var pts = {}
	var up = unit(sub(N, H))
	var along = length(sub(N, H))
	for name in C.points:
		var d = C.points[name]
		var fg = d.figure
		if d.part == "head":
			pts[name] = add(head, mul(toWorld(unit(fg.dir), headF), fg.dist*P["headR"]))
		elif fg.has("arm"):
			pts[name] = mix(N, elbows[fg.arm], fg.at)
		else:
			pts[name] = add(H, toWorld([fg.side*P["torso"], fg.along*along, fg.forward*P["torso"]], [F[0], up, F[2]]))
	return pts

func segDist(a, b, c): # distance from point c to segment ab
	var ab = sub(b, a)
	var t = clampf(dot(sub(c, a), ab)/maxf(dot(ab, ab), 1e-12), 0.0, 1.0)
	return length(sub(add(a, mul(ab, t)), c))

## How far the arm N-E-T stays outside the head (negative: inside): forearm and hand by headClear beyond headR, the
## upper arm, whose neck-root end is itself only neck below the disc, by upperArmClear.
func armClearance(N, E, T, head, P, C):
	return minf(segDist(N, E, head)-P["headR"]-C.upperArmClear, segDist(E, T, head)-P["headR"]-C.headClear)

## The elbow on its circle (all elbows joining N and the hand T with the arm's lengths) nearest to E0 whose arm stays
## out of the head: turn from E0 towards the clearest position and stop at the first one that is out. {ok, el}; with
## no such position, ok is false and el the clearest one.
func elbowOutOfHead(N, E0, T, head, P, C) -> Dictionary:
	if armClearance(N, E0, T, head, P, C) >= 0:
		return {"ok": true, "el": E0}
	var ax = unit(sub(T, N))
	var O = add(N, mul(ax, dot(sub(E0, N), ax)))
	var r = length(sub(E0, O))
	if r < 1e-6:
		return {"ok": false, "el": E0}
	var u = unit(sub(E0, O))
	var v = cross(ax, u)
	var at = func(phi): return add(O, add(mul(u, r*cos(phi)), mul(v, r*sin(phi))))
	var n: int = C.elbowSamples
	var best = 0.0
	var bestC = -INF
	for k in n:
		var phi = TAU*k/n
		var c = armClearance(N, at.call(phi), T, head, P, C)
		if c > bestC:
			bestC = c
			best = phi
	if bestC < 0:
		return {"ok": false, "el": at.call(best)}
	if best > PI:
		best -= TAU
	var steps = n*4
	for k in range(1, steps+1):
		var e = at.call(best*k/steps)
		if armClearance(N, e, T, head, P, C) >= 0:
			return {"ok": true, "el": e}
	return {"ok": true, "el": at.call(best)}

## The arm for a contact target: two-bone IK from the neck root, elbow bent like the person's, then kept out of the
## head (elbow turned round its circle; if no elbow position clears the head, the hand moves off the head axis by
## the least that lets one; if even pushMax does not, the hand stays and the elbow takes its clearest place). {el, hand}.
func contactArm(N, target, hint, head, hdir, outward, P, C) -> Dictionary:
	var arm = ik(N, P["upperArm"], P["foreArm"], target, hint)
	var got = elbowOutOfHead(N, arm["knee"], arm["end"], head, P, C)
	if got.ok:
		return {"el": got.el, "hand": arm["end"]}
	var away = orth(sub(arm["end"], head), hdir)
	away = outward if length(away) < 1e-4 else unit(away)
	var tryAt = func(dist):
		var a = ik(N, P["upperArm"], P["foreArm"], add(target, mul(away, dist)), hint)
		var e = elbowOutOfHead(N, a["knee"], a["end"], head, P, C)
		return {"ok": e.ok, "el": e.el, "hand": a["end"]}
	var lo = 0.0
	var hi = C.pushMax
	var found = tryAt.call(hi)
	if not found.ok:
		return {"el": got.el, "hand": arm["end"]}
	for k in 14:
		var mid = (lo+hi)/2
		var t = tryAt.call(mid)
		if t.ok:
			hi = mid
			found = t
		else:
			lo = mid
	return {"el": found.el, "hand": found.hand}

## Spread each column of per-frame weights over r frames before and after: the largest within r, then a Hann average
## over r. A column that is 0 within 2r frames of a frame stays exactly 0 there. wrap: the last frame repeats the
## first (a loop), so the spreading runs round.
func smoothColumns(rows: Array, r: int, wrap: bool) -> Array:
	var n := rows.size()
	if r <= 0 or n < 2:
		return rows
	var m := n-1 if wrap else n
	var idx = func(i): return posmod(i, m) if wrap else clampi(i, 0, n-1)
	var kernel := []
	var ks := 0.0
	for k in range(-r, r+1):
		kernel.append(0.5+0.5*cos(PI*k/(r+1)))
		ks += kernel[-1]
	var cols: int = rows[0].size()
	var out := []
	for i in n:
		var row := []
		row.resize(cols)
		out.append(row)
	for c in cols:
		var dil := []
		for i in n:
			var w = 0.0
			for k in range(-r, r+1):
				w = maxf(w, rows[idx.call(i+k)][c])
			dil.append(w)
		for i in n:
			var w = 0.0
			for k in range(-r, r+1):
				w += kernel[k+r]*dil[idx.call(i+k)]
			out[i][c] = w/ks
		if wrap:
			out[n-1][c] = out[0][c]
	return out

## Steps 1-11 for a whole clip. C: npc/hand-contact.json; fps: the clip's; wrap: its last frame repeats the first.
## Returns mapFrame's frames, each also with side (torso side), headSide (the head frame's side), both for drawing
## the figure's points, and contact = [Left, Right] weights of step 11.
## held: {} or the thing held in one hand whose tip touches the body (hand-contact.json "held"): {side, tip: the tip
## from the hand in this clip's frame, metres, as the game hangs it (upright, facing the way the clip faces), tipFigure:
## the same in figure units}. That hand counts as resting where its tip rests, and the tip, not the hand, goes to the
## figure's point; the thing keeps its real size (it does not grow with the big head).
func mapClip(frames: Array, P, origin, C, fps: float, wrap: bool, held := {}) -> Array:
	var out := []
	var before := []
	for s in frames:
		out.append(mapFrame(s, P, origin))
		before.append(out[-1]["segs"].map(func(sg): return sg[1]))
	var raw := contactWeights(frames, P, C, fps, wrap, held)
	var r := roundi(C.smoothSeconds*fps)
	var w := smoothColumns(raw, r, wrap)
	for i in frames.size():
		applyContact(frames[i], out[i], P, C, w[i], held)
	smoothArms(out, before, P, r, wrap)
	return out

## The contact arm's elbow and hand can still turn quickly (an elbow going round the head to the other side): on
## the frames where step 11 holds an arm, what step 11 changed (hand and elbow against steps 1-10, before: steps
## 1-10's segment ends) is averaged over r frames before and after (Hann, as the weights) and the arm solved again
## with its lengths. The motion itself is not averaged; frames step 11 leaves alone keep steps 1-10 exactly.
func smoothArms(out: Array, before: Array, P, r: int, wrap: bool) -> void:
	var n := out.size()
	if r <= 0 or n < 2:
		return
	var m := n-1 if wrap else n
	var idx = func(i): return posmod(i, m) if wrap else clampi(i, 0, n-1)
	var kernel := []
	for k in range(-r, r+1):
		kernel.append(0.5+0.5*cos(PI*k/(r+1)))
	var segAt = {"Left": 2, "Right": 7}
	for side in 2:
		var sd = "Left" if side == 0 else "Right"
		var k0: int = segAt[sd]
		var de := []
		var dh := []
		for i in n:
			de.append(sub(out[i]["segs"][k0][1], before[i][k0]))
			dh.append(sub(out[i]["segs"][k0+1][1], before[i][k0+1]))
		var fixed := []
		for i in n:
			fixed.append(null)
			if out[i]["contact"][side] <= 0:
				continue
			var se = [0.0, 0.0, 0.0]
			var sh = [0.0, 0.0, 0.0]
			var ks = 0.0
			for k in range(-r, r+1):
				var j = idx.call(i+k)
				se = add(se, mul(de[j], kernel[k+r]))
				sh = add(sh, mul(dh[j], kernel[k+r]))
				ks += kernel[k+r]
			var N = out[i]["N"]
			var el = add(before[i][k0], mul(se, 1.0/ks))
			var hand = add(before[i][k0+1], mul(sh, 1.0/ks))
			fixed[i] = ik(N, P["upperArm"], P["foreArm"], hand, sub(el, N))
		for i in n:
			if fixed[i] == null:
				continue
			var N = out[i]["N"]
			out[i]["segs"][k0] = [N, fixed[i]["knee"], 1.0]
			out[i]["segs"][k0+1] = [fixed[i]["knee"], fixed[i]["end"], 1.0]
			out[i]["hand"+sd] = fixed[i]["end"]
		if wrap and fixed[n-1] != null and fixed[0] != null:
			var N = out[n-1]["N"]
			out[n-1]["segs"][k0] = [N, add(N, sub(out[0]["segs"][k0][1], out[0]["N"])), 1.0]
			out[n-1]["segs"][k0+1] = [out[n-1]["segs"][k0][1], add(N, sub(out[0]["segs"][k0+1][1], out[0]["N"])), 1.0]
			out[n-1]["hand"+sd] = out[n-1]["segs"][k0+1][1]

## Step 11 on one mapped frame f (changed in place); w: its smoothed weights (contactWeights' layout).
func applyContact(s, f, P, C, w, held := {}) -> void:
	var g = func(n): return s[J[n]]
	var cf = contactFrame(s, P, C, held)
	var F = cf.F
	f["side"] = F[0]
	f["headSide"] = cf.headF[0]
	f["contact"] = [0.0, 0.0]
	var names = C.points.keys()
	var count: int = names.size()
	var segAt = {"Left": 2, "Right": 7}
	var old = {}
	for sd in ["Left", "Right"]:
		old[sd] = {"el": f["segs"][segAt[sd]][1], "hand": f["segs"][segAt[sd]+1][1]}
	var N = f["N"]
	var fig = figurePoints(f["H"], N, f["head"], cf.headF, F, {"Left": old["Left"]["el"], "Right": old["Right"]["el"]}, P, C)
	# Body points: each near point pulls the hand to the figure's point plus the scaled offset; the pull of all of
	# them together (the largest weight) eases from the steps 1-10 hand to their weighted mean.
	var pull = {}
	var weight = {}
	for side in 2:
		var sd = "Left" if side == 0 else "Right"
		var sum = 0.0
		var top = 0.0
		var acc = [0.0, 0.0, 0.0]
		# Each point's figure place disagrees a little with the others' (the two heads are not the same shape), so the
		# nearest point leads: its share falls off with how much farther than the nearest a point is (nearShare).
		var nearest = INF
		for k in count:
			if w[side*count+k] > 0:
				nearest = minf(nearest, length(sub(cf.touch[sd], cf.points[names[k]])))
		# a held thing's tip goes to the point; the hand stays the thing's real size (tipFigure) behind it
		var behind = [0.0, 0.0, 0.0] if held.is_empty() or held.side != sd else held.tipFigure
		for k in count:
			var wk = w[side*count+k]
			if wk <= 0:
				continue
			var d = C.points[names[k]]
			var off = sub(cf.touch[sd], cf.points[names[k]])
			var t = sub(add(fig[names[k]], mul(off, cf.scale[d.part])), behind)
			var share = wk*exp(-(length(off)-nearest)/C.nearShare)
			acc = add(acc, mul(t, share))
			sum += share
			top = maxf(top, wk)
		top *= 1-f["supportHands"][side]
		pull[sd] = mix(old[sd]["hand"], mul(acc, 1.0/sum), top) if sum > 0 else old[sd]["hand"]
		weight[sd] = top
	# The other hand: keep where the hands are from each other (scaled), moving mostly the hand less held to the body.
	var wp = w[2*count]*(1-maxf(f["supportHands"][0], f["supportHands"][1]))
	if wp > 0:
		var rel = mul(sub(cf.palms["Left"], cf.palms["Right"]), cf.scale["torso"])
		var e = sub(rel, sub(pull["Left"], pull["Right"]))
		var a = 0.5+0.5*(weight["Left"]-weight["Right"]) # the left hand's share of staying put
		pull["Left"] = add(pull["Left"], mul(e, (1-a)*wp))
		pull["Right"] = sub(pull["Right"], mul(e, a*wp))
	for side in 2:
		var sd = "Left" if side == 0 else "Right"
		var W = maxf(weight[sd], wp)
		f["contact"][side] = W
		if W <= 0:
			continue # far from every point: steps 1-10 exactly
		var sgn = 1 if sd == "Left" else -1
		# The elbow bends like the person's: its bulge off their shoulder-hand line; never backwards for a hand in front
		# of the neck root (memory.md elbow rule), freely for a hand behind it (hands behind the back).
		var hint = sub(g.call(sd+"ForeArm"), mix(g.call(sd+"Arm"), g.call(sd+"Hand"), 0.5))
		var front = smoothStep(-C.elbowFront, C.elbowFront, dot(sub(pull[sd], N), F[2]))
		hint = sub(hint, mul(F[2], minf(0.0, dot(hint, F[2]))*front))
		hint = add(hint, mul(F[0], sgn*1e-4))
		var arm = contactArm(N, pull[sd], hint, f["head"], cf.hdir, mul(F[0], sgn), P, C)
		# Ease from the steps 1-10 arm to the contact arm; at W = 1 this is the contact arm exactly.
		var T = mix(old[sd]["hand"], arm["hand"], W)
		var bend = mix(sub(old[sd]["el"], N), sub(arm["el"], N), W)
		var fin = ik(N, P["upperArm"], P["foreArm"], T, bend)
		f["segs"][segAt[sd]] = [N, fin["knee"], 1.0]
		f["segs"][segAt[sd]+1] = [fin["knee"], fin["end"], 1.0]
		f["hand"+sd] = fin["end"]
