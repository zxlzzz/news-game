## Independent closed hold loop in the actor's own coordinates. Context records
## required props/support and source facing; it does not choose transitions.
extends Resource

@export var actor_kind: String
@export var source: String
@export var endpoint: String
@export var duration: float = 1.0
@export var frames: Array[Dictionary] = []
@export var context: Dictionary = {}

func sample(time: float) -> Dictionary:
	assert(duration > 0.0 and frames.size() == 2, "invalid endpoint hold loop")
	assert(frames[0] == frames[1], "endpoint hold must have identical seam poses")
	# A hold repeats its posture without accumulating motion or replacing the
	# actual endpoint with an approximate generic standing/sitting reference.
	return frames[0 if fposmod(time, duration) < duration else 1].duplicate(true)
