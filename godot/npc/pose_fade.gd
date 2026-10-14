## Crossfade at a clip switch (docs/动作重做方案.md §4.4): the pose last drawn before the switch blends into
## the new clip over a few tenths of a second (crowd-params.json fade). Both poses are put in the same frame
## first, so a switch that also moves or turns the figure (arriving at a seat) is smoothed as well. A jump
## farther than fade.jump metres (someone coming back in at another end of the ground) is not faded.
##   pose = PoseFade.apply(person, key, pose, figure.transform, now, fade)   # key: what is playing
##   ... ground fixes ...
##   PoseFade.remember(person, pose, figure.transform)
extends RefCounted

const ClipPose := preload("res://npc/clip_pose.gd")

## state: a dictionary kept per person (keys fade_* and last_*). A key different from the last one starts a fade.
static func apply(state: Dictionary, key: String, pose: Dictionary, xf: Transform3D, now: float, fade: Dictionary) -> Dictionary:
	if state.get("fade_key", "") != key:
		state.erase("fade_from")
		if state.has("last_pose") and state.last_xf.origin.distance_to(xf.origin) <= fade.jump:
			state.fade_from = state.last_pose
			state.fade_start = now
		state.fade_key = key
	if not state.has("fade_from"):
		return pose
	var w: float = (now - state.fade_start) / fade.seconds
	if w >= 1.0:
		state.erase("fade_from")
		return pose
	return ClipPose.blend(transform_pose(state.fade_from, xf.affine_inverse()), pose, smoothstep(0.0, 1.0, w))

## The pose as drawn (after ground fixes), kept in the parent's space for the next fade.
static func remember(state: Dictionary, pose: Dictionary, xf: Transform3D) -> void:
	state.last_pose = transform_pose(pose, xf)
	state.last_xf = xf

static func transform_pose(p: Dictionary, xf: Transform3D) -> Dictionary:
	var segs := []
	for s in p.segs:
		segs.append([xf * s[0], xf * s[1], s[2]])
	return {"segs": segs, "head": xf * p.head, "neck": xf * p.neck, "handLeft": xf * p.handLeft,
		"handRight": xf * p.handRight, "supportHands": p.supportHands.duplicate()}
