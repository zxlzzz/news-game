## Owner + dog on a leash, as pure functions; parameters from npc/leash-params.json.
## The leash never pulls anything: plan() coordinates the two speeds so the hand-to-collar distance
## stays under the rope length (the dog heads for a spot beside the owner on the leash hand's side;
## the owner slows down when the rope is nearly taut), and curve() only draws the rope — slack sags,
## taut is straight.
extends RefCounted

static func load_params(path := "res://npc/leash-params.json") -> Dictionary:
	var p = JSON.parse_string(FileAccess.get_file_as_string(path))
	assert(p is Dictionary, "%s: not a JSON object" % path)
	return p

## owner: {position, yaw, speed (wanted), hand (world), side ("Left"/"Right": the leash hand)};
## dog: {position, yaw, collar (world)}.
## Returns {ownerSpeed, dogSpeed, dogYaw, separation}; feed dogSpeed/dogYaw to Dog.step().
static func plan(owner: Dictionary, dog: Dictionary, p: Dictionary) -> Dictionary:
	var f := Vector3(sin(owner.yaw), 0, cos(owner.yaw))
	var left := Vector3(cos(owner.yaw), 0, -sin(owner.yaw))
	var side := 1.0 if owner.side == "Left" else -1.0
	var spot: Vector3 = owner.position + left * side * p.dogOffset.side + f * p.dogOffset.forward
	var separation: float = owner.hand.distance_to(dog.collar)
	var owner_speed: float = owner.speed * clampf((p.ropeLength - p.slack - separation) / p.slowBand, 0, 1)
	var velocity: Vector3 = (spot - dog.position) * p.followGain + f * owner_speed
	velocity.y = 0
	var speed := velocity.length()
	if speed < p.stillSpeed:
		return {"ownerSpeed": owner_speed, "dogSpeed": 0.0, "dogYaw": owner.yaw, "separation": separation}
	var dog_yaw := atan2(velocity.x, velocity.z)
	# Turn first, then go: speed falls off with the heading error.
	var align := maxf(0, cos(dog_yaw - dog.yaw))
	return {"ownerSpeed": owner_speed, "dogSpeed": speed * align * align, "dogYaw": dog_yaw, "separation": separation}

## Rope points from hand a to collar b: a parabola whose sag grows as the ends come closer.
static func curve(a: Vector3, b: Vector3, p: Dictionary) -> Array:
	var c: Dictionary = p.curve
	var d := a.distance_to(b)
	var sag := minf(c.maxSag, sqrt(maxf(0, p.ropeLength * p.ropeLength - d * d)) * c.sagFactor)
	var n := int(c.points) - 1
	var pts := []
	for i in n + 1:
		var t := float(i) / n
		var q := a.lerp(b, t)
		q.y = maxf(c.groundClearance, q.y - 4 * t * (1 - t) * sag)
		pts.append(q)
	return pts

static func segments(pts: Array, p: Dictionary) -> Array:
	var segs := []
	for i in pts.size() - 1:
		segs.append([pts[i], pts[i + 1], p.width])
	return segs
