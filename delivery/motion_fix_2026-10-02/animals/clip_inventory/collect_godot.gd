extends SceneTree

const Model = preload("res://npc/animal_model.gd")

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	assert(args.size() == 1, "Pass the output JSON path")
	var result := {"breeds": {}, "engine": Engine.get_version_info(), "inputs_sha256": {}}
	for breed in ["husky", "shibainu", "cat"]:
		var model: Dictionary = Model.info(breed)
		assert(model.error == "", model.error)
		var path: String = Model.config().breeds[breed].glb
		result.inputs_sha256[path] = FileAccess.get_sha256(path)
		var records := []
		for name in model.clips:
			var clip: Dictionary = model.clips[name]
			var animation: Animation = clip.animation
			var first := INF
			var last := -INF
			var key_count := 0
			var maximum_track_keys := 0
			for track in animation.get_track_count():
				var count := animation.track_get_key_count(track)
				key_count += count
				maximum_track_keys = maxi(maximum_track_keys, count)
				for key in count:
					var time: float = animation.track_get_key_time(track, key)
					first = minf(first, time)
					last = maxf(last, time)
			var loop_name: String = ["NONE", "LINEAR", "PINGPONG"][animation.loop_mode]
			records.append({"name": name, "duration_seconds": animation.length,
				"loop_mode": animation.loop_mode, "loop_mode_name": loop_name,
				"track_count": animation.get_track_count(), "mapped_bone_tracks": clip.tracks.size(),
				"total_keys": key_count, "maximum_track_keys": maximum_track_keys,
				"first_key_seconds": first if key_count else null,
				"last_key_seconds": last if key_count else null})
		result.breeds[breed] = records
		print("CLIP_INVENTORY ", breed, " ", records.size(), " imported animations")
	var file := FileAccess.open(args[0], FileAccess.WRITE)
	assert(file != null, "Cannot write inventory")
	file.store_string(JSON.stringify(result, "\t"))
	print("CLIP_INVENTORY_OK")
	quit()
