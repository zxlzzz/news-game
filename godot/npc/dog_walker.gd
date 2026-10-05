## A person walking a dog on a leash: the walker's clip playback, the model dog (npc/animal.gd) and the
## leash coordination, as one object that navigation (or a review/check) drives with a wanted speed and
## heading. Numbers come from npc/leash-params.json, npc/animal-models.json and the body scale.
##
##   var dw = DogWalker.new(position, yaw, body_scale, ground, breed)   # ground: Callable(Vector3) -> height
##                                                  # of the surface under a point (see Dog.step); breed: a
##                                                  # dog of animal-models.json
##   dw.step(wanted_speed, wanted_yaw, dt)        # each frame; the walker may go slower (waits for the dog)
##   var pose := dw.dog_pose()                    # for npc/animal_body.gd
##   dw.walker_drawing() / dw.rope_drawing(pose.collar)   # for ink_figure.gd; the walker's is in figure
##                                                        # units: draw it under a node at walker_transform()
##                                                        # scaled by body_scale
## Walking plays the walk clip by distance (feet never slide); standing plays the stand clip by time;
## the two are crossfaded. The rope runs from the walker's leash hand to the dog's collar.
## The clip holds the leash in leash-params "hand"; the walker can hold it in the other hand too (the
## whole pose mirrored). Given `view` (horizontal direction toward the camera), the walker changes
## hands once the dog has been on the far side for walker.switchSideAfter seconds, so the dog stays
## on the camera side instead of behind the person.
extends RefCounted

const Dog := preload("res://npc/procedural_dog.gd")
const Animal := preload("res://npc/animal.gd")
const AnimalModel := preload("res://npc/animal_model.gd")
const Leash := preload("res://npc/leash.gd")
const ClipPose := preload("res://npc/clip_pose.gd")
const ContactPose := preload("res://npc/contact_pose.gd")

var error := ""
var dog_m: Dictionary
var dog_p: Dictionary
var leash_p: Dictionary
var walk: ClipPose
var stand: ClipPose
var body_scale: float
var walker := {"position": Vector3.ZERO, "yaw": 0.0, "phase": 0.0, "still": 1.0, "time": 0.0, "speed": 0.0}
var dog: Dictionary
var separation := 0.0
## Horizontal direction toward the camera; zero = never change hands.
var view := Vector3.ZERO
## The hand holding the leash now: leash-params "hand" or the other one (pose mirrored).
var side := ""
var _far_for := 0.0
var ground: Callable

func _init(position: Vector3, yaw: float, scale: float, ground_: Callable, breed: String) -> void:
	ground = ground_
	dog_m = AnimalModel.info(breed)
	if dog_m.error != "":
		error = dog_m.error
		return
	if dog_m.species != "dog":
		error = breed + " is not a dog"
		return
	dog_p = dog_m.p
	leash_p = Leash.load_params()
	var w: Dictionary = leash_p.walker
	walk = ClipPose.of(w.walkClip)
	stand = ClipPose.of(w.standClip)
	error = walk.error if walk.error != "" else stand.error
	side = leash_p.hand
	body_scale = scale
	walker.position = position
	walker.yaw = yaw
	var f := Vector3(sin(yaw), 0, cos(yaw))
	var left := Vector3(cos(yaw), 0, -sin(yaw))
	var s := 1.0 if side == "Left" else -1.0
	var spot: Vector3 = position + left * s * leash_p.dogOffset.side + f * leash_p.dogOffset.forward
	spot.y = ground.call(spot)
	dog = Animal.create(spot, yaw, dog_m)

## Strolling speed (leash-params walker.walkSpeed); the walk clip is played by distance at any speed.
func walk_speed() -> float:
	return leash_p.walker.walkSpeed

func step(wanted_speed: float, wanted_yaw: float, dt: float) -> void:
	var w: Dictionary = leash_p.walker
	_choose_side(dt)
	var c := Leash.plan({"position": walker.position, "yaw": walker.yaw, "speed": wanted_speed, "hand": hand(), "side": side},
		{"position": dog.position, "yaw": dog.yaw, "collar": Dog.pose(dog, dog_p).collar}, leash_p)
	separation = c.separation
	walker.yaw = walker.yaw + clampf(angle_difference(walker.yaw, wanted_yaw), -w.turnRate * dt, w.turnRate * dt)
	walker.speed = c.ownerSpeed
	walker.position += Vector3(sin(walker.yaw), 0, cos(walker.yaw)) * c.ownerSpeed * dt
	walker.position.y = ground.call(walker.position)
	walker.phase = fposmod(walker.phase + c.ownerSpeed * dt / (walk.stride() * body_scale), 1.0)
	walker.still = move_toward(walker.still, 1.0 if c.ownerSpeed < leash_p.stillSpeed else 0.0, dt * w.blendRate)
	walker.time += dt
	dog = Animal.step(dog, {"speed": c.dogSpeed, "yaw": c.dogYaw, "ground": ground}, dt, dog_m)

## Keep the dog on the camera side: change hands after it has been on the far side long enough.
func _choose_side(dt: float) -> void:
	if view == Vector3.ZERO:
		return
	var left := Vector3(cos(walker.yaw), 0, -sin(walker.yaw))
	var toward := "Left" if left.dot(view) > 0 else "Right"
	_far_for = _far_for + dt if toward != side else 0.0
	if _far_for >= leash_p.walker.switchSideAfter:
		side = toward
		_far_for = 0.0

## Walker pose in figure units (walker frame); mirrored when holding the leash in the clip's other hand.
func walker_pose() -> Dictionary:
	var p := ClipPose.blend(walk.pose(walker.phase), stand.pose(walker.time / stand.duration()), walker.still)
	if side == leash_p.hand:
		return p
	var m := func(q: Vector3) -> Vector3: return Vector3(-q.x, q.y, q.z)
	var segs := []
	for sg in p.segs:
		segs.append([m.call(sg[0]), m.call(sg[1]), sg[2]])
	return {"segs": segs, "head": m.call(p.head), "neck": m.call(p.neck), "handLeft": m.call(p.handRight), "handRight": m.call(p.handLeft), "supportHands": [p.supportHands[1], p.supportHands[0]]}

## Where the walker figure node goes (scale it by body_scale).
func walker_transform() -> Transform3D:
	return Transform3D(Basis(Vector3.UP, walker.yaw), walker.position)

## The leash hand in world metres.
func hand() -> Vector3:
	return walker_transform() * (walker_pose()["hand" + side] * body_scale)

func walker_drawing() -> Dictionary:
	var pose := walker_pose().duplicate(true)
	var world := walker_transform().scaled_local(Vector3.ONE*body_scale)
	if ContactPose.ground_feet(pose,world,walk.P.line,ground)>0.001:
		error = "walker: unreachable ground contact"
		push_error(error)
	return walk.drawing(pose)

func dog_pose() -> Dictionary:
	return AnimalModel.pose(dog_m, dog)

## collar: where the rope meets the dog (dog_pose().collar).
func rope_drawing(collar: Vector3) -> Dictionary:
	var pts := Leash.curve(hand(), collar, leash_p, walker.position.y, dog.position.y)
	return {"segments": Leash.segments(pts, leash_p), "discs": [], "triangles": []}
