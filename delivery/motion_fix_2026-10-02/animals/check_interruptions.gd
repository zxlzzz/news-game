## Check current-pose cancellation from every configured in/hold/out clip at native frame rates.
## Outputs evidence; uses the complete imported skin, with independent GLB verification beside it.
extends SceneTree
const Model = preload("res://npc/animal_model.gd")
const Animal = preload("res://npc/animal.gd")

func _flat(_p: Vector3) -> float:
	return 0.0

func _command(action: String, speed: float = 0.0, urgent: bool = false) -> Dictionary:
	return {"action": action, "speed": speed, "urgent": urgent, "yaw": 0.0, "ground": _flat}

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var settings: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(args[1]))
	var result := {"cases": [], "failures": []}
	result.inputs_before = _inputs()
	for breed in settings.get("breeds", Model.config().breeds.keys()):
		var m: Dictionary = Model.info(breed)
		for fps in settings.fps:
			var dt: float = 1.0 / fps
			for action in Model.config().species[m.species]:
				if settings.has("actions") and not action in settings.actions:
					continue
				var specification: Dictionary = Model.config().actions[action]
				for stage in ["in", "hold", "out"]:
					var clips: Array = [specification.hold] if stage == "hold" and specification.has("hold") else specification.get(stage, [])
					for clip in clips:
						var s: Dictionary = Animal.create(Vector3.ZERO, 0.0, m)
						var stop := false
						var found := false
						for frame in int(settings.prepare_seconds * fps):
							if stage == "out" and s.clip_loop:
								stop = true
							s = Animal.step(s, _command("" if stop else action), dt, m)
							if s.clip == clip and (stage != "out" or s.phase_ == "out"):
								found = true
								break
						if not found:
							result.failures.append("%s %s %s never reached %s" % [breed, action, stage, clip])
							continue
						var start: Dictionary = s.duplicate(true)
						for fraction in settings.fractions:
							s = start.duplicate(true)
							for frame in int(m.clips[clip].length * fraction * fps):
								s = Animal.step(s, _command("" if stop else action), dt, m)
							for zero_speed in [false, true]:
								var test: Dictionary = s.duplicate(true)
								var before: Dictionary = Model.pose(m, test)
								var worst := {"speed": 0.0}
								var worst_turn := {"radians_per_frame": 0.0}
								var depth := 0.0
								var length_error := 0.0
								var contact_error := {"metres":0.0}
								var recovery_time := 0.0
								for frame in int(settings.cancel_seconds * fps):
									test = Animal.step(test, _command("", 0.0 if zero_speed else settings.walk_speed, true), dt, m)
									var pose: Dictionary = Model.pose(m, test)
									depth = maxf(depth, Model.penetration(m, pose.globals, pose.root, _flat, true))
									for key in Model.LEGS:
										if test.phase_ == "return" and key in test.return_contacts:
											var sole: Vector3 = pose.root*Model.sole(m,pose.globals,key)
											var error: float = sole.distance_to(test.feet[key].point)
											if error>contact_error.metres:
												contact_error={"metres":error,"paw":key,"time":frame*dt,"swing":test.feet[key].swing}
										for id in (m.legs[key].ids as Array).slice(1):
											length_error = maxf(length_error, absf((pose.locals[id].origin as Vector3).length() - (m.rest[id].origin as Vector3).length()))
									for i in m.names.size():
										var now: Transform3D = pose.root * pose.globals[i]
										var old: Transform3D = before.root * before.globals[i]
										var speed: float = now.origin.distance_to(old.origin) / dt
										if speed > worst.speed:
											worst = {"speed": speed, "bone": m.names[i], "time": frame * dt, "phase": test.phase_}
										var turn: float = now.basis.get_rotation_quaternion().angle_to(old.basis.get_rotation_quaternion())
										if turn > worst_turn.radians_per_frame:
											worst_turn = {"radians_per_frame": turn, "bone": m.names[i], "time": frame * dt}
									before = pose
									if test.phase_ == "walk":
										recovery_time = (frame + 1) * dt
										break
								var case := {"breed": breed, "action": action, "clip": clip, "stage": stage, "fraction": fraction,
									"fps": fps, "urgent_zero_speed": zero_speed, "worst_joint": worst, "worst_rotation": worst_turn,
									"mesh_penetration_m": depth, "leg_length_error_m": length_error, "sole_contact_error":contact_error, "recovery_seconds": recovery_time}
								result.cases.append(case)
								if recovery_time <= 0 or depth > settings.ground_tolerance or length_error > settings.bone_tolerance or contact_error.metres>settings.contact_tolerance:
									result.failures.append(case)
			print("INTERRUPTIONS ", breed, " ", fps, " fps")
	var file := FileAccess.open(args[0], FileAccess.WRITE)
	result.inputs_after = _inputs()
	if result.inputs_before != result.inputs_after:
		result.failures.append("Inputs changed during the batch")
	file.store_string(JSON.stringify(result))
	print("INTERRUPTIONS_OK " if result.failures.is_empty() else "INTERRUPTIONS_FAIL ", result.cases.size(), " cases, ", result.failures.size(), " failures")
	quit(0 if result.failures.is_empty() else 1)

func _inputs() -> Dictionary:
	var hashes := {}
	for path in ["res://npc/animal.gd", "res://npc/animal_model.gd", "res://npc/procedural_dog.gd",
		"res://npc/animal-models.json", "res://npc/dog-params.json"]:
		hashes[path] = FileAccess.get_sha256(path)
	for breed in Model.config().breeds.values():
		hashes[breed.glb] = FileAccess.get_sha256(breed.glb)
	return hashes
