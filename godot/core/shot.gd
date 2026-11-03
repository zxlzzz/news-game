## Autoload. With `-- --shot <absolute png path>` on the command line: save the 8th rendered
## frame and quit; `--shot-after <seconds>` waits that long first (to see a scene that has been
## running). Only for checking the look; does nothing otherwise.
extends Node

var _path := ""
var _frames := 0
var _wait := 0.0

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var i := args.find("--shot")
	if i < 0 or i + 1 >= args.size():
		set_process(false)
		return
	_path = args[i + 1]
	i = args.find("--shot-after")
	if i >= 0 and i + 1 < args.size():
		_wait = float(args[i + 1])

func _process(d: float) -> void:
	_wait -= d
	if _wait > 0:
		return
	_frames += 1
	if _frames != 8:
		return
	set_process(false)
	await RenderingServer.frame_post_draw
	var err := get_viewport().get_texture().get_image().save_png(_path)
	print("SHOT ", _path if err == OK else "FAILED %d" % err)
	get_tree().quit(0 if err == OK else 1)
