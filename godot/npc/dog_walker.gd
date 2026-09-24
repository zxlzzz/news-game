## A person walking a dog on a leash: the walker's clip playback, the procedural dog and the leash
## coordination, as one object that navigation (or a review/check) drives with a wanted speed and
## heading. Numbers come from npc/leash-params.json, npc/dog-params.json and the body scale.
##
##   var dw = DogWalker.new(position, yaw, body_scale)
##   dw.step(wanted_speed, wanted_yaw, dt)        # each frame; the walker may go slower (waits for the dog)
##   dw.walker_drawing() / dw.dog_drawing() / dw.rope_drawing()   # for ink_figure.gd; walker's is in
##                                                                # figure units: draw it under a node at
##                                                                # walker_transform() scaled by body_scale
## Walking plays the walk clip by distance (feet never slide); standing plays the stand clip by time;
## the two are crossfaded. The rope runs from the walker's leash hand to the dog's collar.
extends RefCounted

const Dog := preload("res://npc/procedural_dog.gd")
const Leash := preload("res://npc/leash.gd")
const ClipPose := preload("res://npc/clip_pose.gd")

var error := ""
var dog_p: Dictionary
var leash_p: Dictionary
var walk: ClipPose
var stand: ClipPose
var body_scale: float
var walker := {"position": Vector3.ZERO, "yaw": 0.0, "phase": 0.0, "still": 1.0, "time": 0.0, "speed": 0.0}
var dog: Dictionary
var separation := 0.0

func _init(position: Vector3, yaw: float, scale: float) -> void:
	dog_p = Dog.load_params()
	leash_p = Leash.load_params()
	var w: Dictionary = leash_p.walker
	walk = ClipPose.of(w.walkClip)
	stand = ClipPose.of(w.standClip)
	error = walk.error if walk.error != "" else stand.error
	body_scale = scale
	walker.position = position
	walker.yaw = yaw
	var f := Vector3(sin(yaw), 0, cos(yaw))
	var left := Vector3(cos(yaw), 0, -sin(yaw))
	var side := 1.0 if leash_p.hand == "Left" else -1.0
	dog = Dog.create(position + left * side * leash_p.dogOffset.side + f * leash_p.dogOffset.forward, yaw, dog_p)

## Strolling speed (leash-params walker.walkSpeed); the walk clip is played by distance at any speed.
func walk_speed() -> float:
	return leash_p.walker.walkSpeed

func step(wanted_speed: float, wanted_yaw: float, dt: float) -> void:
	var w: Dictionary = leash_p.walker
	var c := Leash.plan({"position": walker.position, "yaw": walker.yaw, "speed": wanted_speed, "hand": hand()},
		{"position": dog.position, "yaw": dog.yaw, "collar": Dog.pose(dog, dog_p).collar}, leash_p)
	separation = c.separation
	walker.yaw = walker.yaw + clampf(angle_difference(walker.yaw, wanted_yaw), -w.turnRate * dt, w.turnRate * dt)
	walker.speed = c.ownerSpeed
	walker.position += Vector3(sin(walker.yaw), 0, cos(walker.yaw)) * c.ownerSpeed * dt
	walker.phase = fposmod(walker.phase + c.ownerSpeed * dt / (walk.stride() * body_scale), 1.0)
	walker.still = move_toward(walker.still, 1.0 if c.ownerSpeed < leash_p.stillSpeed else 0.0, dt * w.blendRate)
	walker.time += dt
	dog = Dog.step(dog, {"speed": c.dogSpeed, "yaw": c.dogYaw}, dt, dog_p)

## Walker pose in figure units (walker frame).
func walker_pose() -> Dictionary:
	return ClipPose.blend(walk.pose(walker.phase), stand.pose(walker.time / stand.duration()), walker.still)

## Where the walker figure node goes (scale it by body_scale).
func walker_transform() -> Transform3D:
	return Transform3D(Basis(Vector3.UP, walker.yaw), walker.position)

## The leash hand in world metres.
func hand() -> Vector3:
	return walker_transform() * (walker_pose()["hand" + leash_p.hand] * body_scale)

func walker_drawing() -> Dictionary:
	return walk.drawing(walker_pose())

func dog_drawing() -> Dictionary:
	return Dog.silhouette(Dog.pose(dog, dog_p), dog_p)

func rope_drawing() -> Dictionary:
	var pts := Leash.curve(hand(), Dog.pose(dog, dog_p).collar, leash_p)
	return {"segments": Leash.segments(pts, leash_p), "discs": [], "triangles": []}
