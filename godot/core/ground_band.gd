## One strip of ground in a GroundStrip: its width (metres, along Z) and its colour slot.
## The slot name is the band's only property besides width: it sets the colour now and the
## walking cost later (scene_spec.md §3), so bands never carry their own colour or cost.
@tool
class_name GroundBand
extends Resource

@export var width := 3.0:
	set(v):
		width = v
		emit_changed()
@export var slot: StringName = &"sidewalk":
	set(v):
		slot = v
		emit_changed()
