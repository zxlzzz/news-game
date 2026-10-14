## Independent model articulation; callers supply only a part and a ratio.
## Motion axes and limits are imported from the model's real pivot metadata.
extends RefCounted

static func parts(node: Node) -> Array[Node3D]:
	var result: Array[Node3D] = []
	if node is Node3D and node.has_meta("extras") and node.get_meta("extras").has("motion"):
		result.append(node)
	for child in node.get_children(): result.append_array(parts(child))
	return result

static func set_ratio(part: Node3D, ratio: float) -> void:
	assert(part.has_meta("extras") and part.get_meta("extras").has("motion"),"Model part has no motion definition: "+part.name)
	assert(is_finite(ratio) and ratio >= 0.0 and ratio <= 1.0,"Invalid model part ratio")
	var motion: Dictionary = part.get_meta("extras").motion
	assert(motion.axis.size()==3 and motion.degrees.size()==2,"Invalid motion metadata: "+part.name)
	if not part.has_meta("model_parts_rest"):
		part.set_meta("model_parts_rest",part.transform)
	var rest: Transform3D = part.get_meta("model_parts_rest")
	var axis := Vector3(motion.axis[0],motion.axis[1],motion.axis[2])
	assert(is_equal_approx(axis.length(),1.0),"Motion axis must be unit length")
	var angle := deg_to_rad(lerpf(float(motion.degrees[0]),float(motion.degrees[1]),ratio))
	part.transform = Transform3D(rest.basis * Basis(axis,angle),rest.origin)
