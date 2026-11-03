## Orbit about the displayed model's or person's centre; movers and animals still use the ground target.
extends "res://core/orbit_camera.gd"

var model_height := 0.0
var sidebar_width := 0.0
## Close-ups (tools/closeup.py): `--cut <m>` hides everything nearer to the camera than that many metres in front of
## the look-at point, so a pole between the camera and the person does not hide the hands.
var cut := -1.0

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var i := args.find("--cut")
	if i >= 0 and i + 1 < args.size():
		cut = float(args[i + 1])
	super._ready()

func _apply() -> void:
	super._apply()
	position.y += model_height
	if cut > 0.0:
		near = maxf(0.05, height / 2 / tan(deg_to_rad(fov) / 2) - cut)
	# Centre model inspection in the viewport area beside the visible list.
	var viewport_height := get_viewport().get_visible_rect().size.y
	assert(viewport_height > 0.0,"Preview viewport has no height")
	position -= basis.x * sidebar_width * 0.5 * height / viewport_height
