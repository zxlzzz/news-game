## Export the actual independently selectable clips and bird motions for recording.
extends SceneTree
const Model := preload("res://npc/animal_model.gd")
const Preview := preload("res://tools/animal_clip_preview.gd")
const Bird := preload("res://npc/pigeon_motion.gd")

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() != 1:
		push_error("export_animal_motion_catalog: output JSON required")
		quit(1)
		return
	var entries := []
	for breed in Model.config().breeds:
		var m := Model.info(breed)
		if m.error != "":
			push_error(m.error)
			quit(1)
			return
		for clip in m.clips:
			if clip == "RESET":
				continue
			entries.append({"id": "%s:%s" % [m.species, clip], "label": "%s_%s" % [breed, clip],
				"options": {"breed": breed}, "duration": Preview.duration(m, clip),
				"loop": Preview.repeats(m, clip)})
	for motion in Bird.entries():
		entries.append({"id": "pigeon:" + motion.id, "label": "pigeon_" + motion.id,
			"duration": motion.duration, "loop": motion.loop, "target_height": 0.0})
	var file := FileAccess.open(args[0], FileAccess.WRITE)
	if file == null:
		push_error("cannot write motion catalog: " + args[0])
		quit(1)
		return
	file.store_string(JSON.stringify(entries))
	file.close()
	print("ANIMAL_MOTION_CATALOG_OK entries=%d" % entries.size())
	quit()
