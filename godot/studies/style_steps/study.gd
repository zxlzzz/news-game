## Style study (2026-09-23): the same street corner in six cumulative steps, one change each,
## to find out which change moves the look toward Chants of Sennaar. Not part of the game.
##   godot --path . res://studies/style_steps/study.tscn -- --step N [--shot <png>]
## 0 current look (gray palette, current light, no corner tint, delivered building A)
## 1 + one-hue palette with tinted lines (tone multipliers fitted to Sennaar in 2026-09-19)
## 2 + light that hits the street-facing fronts
## 3 + corner tint
## 4 + building A with deep recesses and an open roof (build_building_a_study.py); window glass takes
##   light and shadow (the global `window` slot is `flat`, so shadows in the recesses never showed)
## 5 + 4x multisample anti-aliasing
## -- --palette gray|yellow|yellow_gray overrides the palette of steps 1+ (yellow_gray = the yellow
##    palette converted to equal-luminance grays, to separate hue from value)
##    paper_light / paper_mid: one gray (the "paper") for background, walls and pavement, others above/below it
extends "res://core/level.gd"

const StickNpc := preload("res://npc/stick_npc.gd")
const GRAY := preload("res://palettes/gray.tres")
const YELLOW := preload("res://studies/style_steps/sennaar_yellow.tres")
const PALETTES := {"gray": GRAY, "yellow": YELLOW, "yellow_gray": preload("res://studies/style_steps/yellow_as_gray.tres"),
	"paper_light": preload("res://studies/style_steps/paper_light.tres"), "paper_mid": preload("res://studies/style_steps/paper_mid.tres")}
## Stick-figure ink per palette; yellow_gray uses the luminance of the yellow version's red.
const INKS := {"gray": [0.1, 0.1, 0.1], "yellow": [0.72, 0.08, 0.22], "yellow_gray": [0.37, 0.37, 0.37],
	"paper_light": [0.06, 0.06, 0.06], "paper_mid": [0.04, 0.04, 0.04]}
const A := preload("res://models/building_a.glb")
const A_STUDY := preload("res://studies/style_steps/building_a_study.glb")
const B := preload("res://models/building_b.glb")
const CROSSWALK := preload("res://models/crosswalk.glb")
const LAMP := preload("res://types/street_lamp.tscn")
const BENCH := preload("res://types/bench.tscn")
const BIN := preload("res://types/trash_bin.tscn")
## Toward the light for step 2+: from the front-left and above, so fronts (+Z) are lit,
## right-hand sides (+X) fall in shade and small parts cast shadows onto the facades.
const FRONT_LIGHT := Vector3(-0.55, 0.55, 0.63)
const TITLES := [
	"0  current: gray, current light, no tint",
	"1  + one-hue palette, tinted lines",
	"2  + light on the street fronts",
	"3  + corner tint",
	"4  + deep recesses, open roof, lit glass (building A only)",
	"5  + 4x anti-aliasing",
]

var step := 0

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	var i := args.find("--step")
	step = int(args[i + 1]) if i >= 0 and i + 1 < args.size() else 5
	var j := args.find("--palette")
	var pname: String = args[j + 1] if j >= 0 and j + 1 < args.size() else ("gray" if step < 1 else "yellow")
	palette = PALETTES[pname].duplicate()
	if step >= 1 and step < 3:
		palette.tint_mix = 0.0
	view = preload("res://scenes/street_demo/view.tscn")
	population = Population.new()  # its few stick figures are placed below, not by the crowd
	_place(A_STUDY if step >= 4 else A, Vector3(-4, 0, 0))
	_place(B, Vector3(10, 0, 0))
	_place(CROSSWALK, Vector3(3.5, 0, 7))
	# street furniture on every step, so every step has something casting shadows on the street
	for spec in [[LAMP, -8.5, 3.6, 0.0], [LAMP, 7.5, 3.6, 0.0], [BENCH, 0.5, 1.4, 0.0], [BIN, -1.8, 3.3, 0.0]]:
		var n: Node3D = spec[0].instantiate()
		n.position = Vector3(spec[1], 0, spec[2])
		n.rotation_degrees.y = spec[3]
		add_child(n)
	var ground := GroundStrip.new()
	ground.length = 70.0
	var bands: Array[GroundBand] = []
	for spec in [[4.0, &"sidewalk"], [6.0, &"road"], [3.0, &"sidewalk"], [6.0, &"grass"]]:
		var b := GroundBand.new()
		b.width = spec[0]
		b.slot = spec[1]
		bands.append(b)
	ground.bands = bands
	add_child(ground)
	super._ready()
	var cam: Camera3D = get_viewport().get_camera_3d()
	cam.size = 23.0
	var target := Vector3(1.5, 5.5, 1.5)
	var d := Vector3(sin(deg_to_rad(20.0)) * cos(deg_to_rad(38.0)), sin(deg_to_rad(38.0)), cos(deg_to_rad(20.0)) * cos(deg_to_rad(38.0)))
	cam.position = target + d * 60.0
	cam.look_at(target)
	if step >= 2:
		var sun: DirectionalLight3D = find_children("*", "DirectionalLight3D", true, false)[0]
		sun.look_at_from_position(FRONT_LIGHT.normalized() * 30.0, Vector3.ZERO)
	if step >= 5:
		get_viewport().msaa_3d = Viewport.MSAA_4X
	var ink: Array = INKS[pname]
	for p in [[-6.5, 2.2, 30.0, "stand_idle"], [-5.2, 2.6, -120.0, "talk_gesture"], [1.8, 1.4, 90.0, "phone_call"], [6.0, 11.8, 200.0, "stand_watch"]]:
		var npc := StickNpc.new()
		add_child(npc)
		var err: String = npc.setup({"clip": p[3], "pos": [p[0], 0.0, p[1]], "yaw": p[2], "scale": 3.0, "line_color": ink, "depth_bias": 0.03}, cam)
		if err != "":
			push_error(err)
	var label := Label.new()
	label.text = TITLES[step] + ("" if j < 0 else "   [palette %s]" % pname)
	label.position = Vector2(40, 30)
	label.add_theme_font_size_override("font_size", 30)
	label.add_theme_color_override("font_color", Color(0.1, 0.1, 0.1))
	var layer := CanvasLayer.new()
	layer.layer = 10
	layer.add_child(label)
	add_child(layer)

func _place(scene: PackedScene, at: Vector3) -> void:
	var n: Node3D = scene.instantiate()
	n.position = at
	add_child(n)

## Level._apply_look, except that from step 4 the `window` slot loses its `flat` flag (study only;
## the global slot definitions are unchanged).
func _apply_look(slot_map: Dictionary) -> void:
	if step < 4:
		super._apply_look(slot_map)
		return
	var defs: SlotDefs = SLOTS
	var saved: PackedStringArray = defs.slots[&"window"]
	var flags := saved.duplicate()
	flags.remove_at(flags.find("flat"))
	defs.slots[&"window"] = flags
	super._apply_look(slot_map)
	defs.slots[&"window"] = saved
