## Window leaves share explicit physical pivot metadata with their GLB geometry.
extends Node3D
var target_open := false
var open_ratio := 0.0
var config: Dictionary
var hinge: Node3D
var window_hinges: Array[Node3D] = []
var window_motions: Array[Dictionary] = []

func _ready() -> void:
	config = JSON.parse_string(FileAccess.get_file_as_string("res://modeling/window_single.json"))
	var installation: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://modeling/window-installation.json"))
	var model_name := scene_file_path.get_file().get_basename()
	assert(installation.has(model_name),"Window has no physical installation parameters: "+model_name)
	config.open_degrees = installation[model_name].open_degrees
	assert(config.travel_seconds > 0)
	for candidate in $model.find_children("SashHinge*","Node3D",true,false):
		window_hinges.append(candidate)
		if candidate.has_meta("extras") and candidate.get_meta("extras").has("window_motion"):
			window_motions.append(candidate.get_meta("extras").window_motion)
		else:
			assert(model_name == "window_single","Window leaf has no physical motion: "+model_name+"/"+candidate.name)
			window_motions.append({"axis":[0.0,1.0,0.0],"degrees":[0.0,config.open_degrees]})
	assert(not window_hinges.is_empty(),"Window model has no SashHinge")
	hinge = window_hinges[0]
	assert(hinge.name == "SashHinge","Window has no primary sash hinge")
	for motion in window_motions:
		assert(motion.axis.size() == 3 and motion.degrees.size() == 2,"Invalid window motion metadata")
		var axis := Vector3(motion.axis[0],motion.axis[1],motion.axis[2])
		assert(is_equal_approx(axis.length(),1.0) and motion.degrees[0] == 0.0 and motion.degrees[1] != 0.0,"Invalid window motion axis or angle")
	_apply_pose()

func set_open(value: bool) -> void:
	target_open = value

func _apply_pose() -> void:
	assert(is_finite(open_ratio) and open_ratio >= 0.0 and open_ratio <= 1.0)
	var ratio := smoothstep(0.0,1.0,open_ratio)
	for index in window_hinges.size():
		var motion: Dictionary = window_motions[index]
		var axis := Vector3(motion.axis[0],motion.axis[1],motion.axis[2])
		window_hinges[index].quaternion = Quaternion(axis,deg_to_rad(float(motion.degrees[1]))*ratio)

func _process(delta: float) -> void:
	open_ratio = move_toward(open_ratio,1.0 if target_open else 0.0,delta/config.travel_seconds)
	_apply_pose()
