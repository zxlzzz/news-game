## Direct authored-clip preview. No gait, action queue, lead-in or exit is added.
extends RefCounted

const Model := preload("res://npc/animal_model.gd")
static var _metadata := {}

## glTF extras carry the author's loop declaration; Godot does not import it.
## Read the source JSON chunk once, rather than maintaining a second clip list.
static func metadata(m: Dictionary) -> Dictionary:
	if _metadata.has(m.breed):
		return _metadata[m.breed]
	var path: String = Model.config().breeds[m.breed].glb
	var file := FileAccess.open(path, FileAccess.READ)
	assert(file != null, "cannot read authored clip metadata: %s" % path)
	assert(file.get_32() == 0x46546c67 and file.get_32() == 2, "invalid GLB header: %s" % path)
	var length := file.get_32()
	assert(length == file.get_length(), "invalid GLB length: %s" % path)
	var chunk_length := file.get_32()
	assert(file.get_32() == 0x4e4f534a, "GLB first chunk must be JSON: %s" % path)
	var document = JSON.parse_string(file.get_buffer(chunk_length).get_string_from_utf8())
	file.close()
	assert(document is Dictionary and document.has("animations"), "no GLB animations: %s" % path)
	var out := {}
	for animation in document.animations:
		# Godot's animation import removes the terminal _Loop naming suffix.
		var name: String = String(animation.name).trim_suffix("_Loop")
		assert(m.clips.has(name), "imported clip differs from GLB name: %s/%s" % [m.breed, name])
		var extras: Dictionary = animation.get("extras", {})
		var declared: bool = extras.has("loop")
		out[name] = {"loop": extras.loop if declared else m.clips[name].animation.loop_mode != Animation.LOOP_NONE,
			"declared": declared, "start_pose": extras.get("base_state", ""), "end_pose": extras.get("end_state", "")}
	_metadata[m.breed] = out
	return out

static func entries(species: String) -> Array:
	var breeds := Model.breeds(species)
	assert(not breeds.is_empty(), "no animal breeds for %s" % species)
	var clips := {}
	for breed in breeds:
		var m := Model.info(breed)
		assert(m.error == "", m.error)
		for name in m.clips:
			if name != "RESET":
				clips[name] = true
	var names := clips.keys()
	names.sort()
	var out := []
	for name in names:
		out.append({"id": "%s:%s" % [species, name], "kind": "animal", "species": species,
			"clip": name, "label": "%s · %s" % [species, name], "missing": []})
	return out

static func repeats(m: Dictionary, clip: String) -> bool:
	assert(m.clips.has(clip), "%s has no authored clip %s" % [m.breed, clip])
	return metadata(m)[clip].loop

static func duration(m: Dictionary, clip: String) -> float:
	return m.clips[clip].length / Model.config().playbackSpeed

static func pose(m: Dictionary, clip: String, time: float) -> Dictionary:
	var locals := Model.sample(m, clip, time * Model.config().playbackSpeed, false)
	var globals := Model._fk(m.parent, locals)
	return {"root": Transform3D.IDENTITY, "locals": locals, "globals": globals,
		"collar": globals[m.collar].origin}
