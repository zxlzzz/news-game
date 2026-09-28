## A dog or cat with a real model: the procedural gait (npc/procedural_dog.gd) and the model's action
## clips (npc/animal-models.json actions), as one pure state. The state is a gait state (Dog.step works
## on it, so position, yaw, feet... are read as usual) plus the action fields below.
##
##   var m := AnimalModel.info(breed)
##   var s := Animal.create(position, yaw, m)
##   s = Animal.step(s, {"speed": m/s, "yaw": rad, "action": "" | name, "ground": g}, dt, m)
##   AnimalModel.pose(m, s)                 # bones, for npc/animal_body.gd
##
## An action starts once the gait has stopped with every paw down (settleSpeed): its in clips play
## once, faded in over blend.in; its hold clip loops while the action is still asked for; then (after
## blend.change from wherever the hold clip is) its out clips play and the clips fade out over blend.out,
## back to the paws where they stood. An action without hold ends after its
## in clips and is not started again until something else was asked for. The clips start and end
## standing, so the fades only cover the paws' last few centimetres.
extends RefCounted

const Dog := preload("res://npc/procedural_dog.gd")
const AnimalModel := preload("res://npc/animal_model.gd")

static func create(position: Vector3, yaw: float, m: Dictionary) -> Dictionary:
	var s: Dictionary = Dog.create(position, yaw, m.p)
	s.merge({"phase_": "walk", "action": "", "done": "", "queue": [], "clip": "", "clip_time": 0.0, "clip_loop": false,
		"from_clip": "", "from_time": 0.0, "from_loop": false, "fade": 1.0, "weight": 0.0, "still": 1.0})
	return s

## What it is doing: walk | in | hold | out | fade (the clips fading out).
static func doing(s: Dictionary) -> String:
	return "hold" if s.phase_ == "in" and s.clip_loop else s.phase_

static func step(previous: Dictionary, command: Dictionary, dt: float, m: Dictionary) -> Dictionary:
	var c: Dictionary = AnimalModel.config()
	var want: String = command.get("action", "")
	assert(want == "" or want in c.species[m.species], "%s cannot %s" % [m.breed, want])
	var s: Dictionary = previous
	if want != s.done:
		s = s.duplicate(true)
		s.done = ""
	if s.phase_ == "walk":
		var go: bool = want == "" or want == s.done
		s = Dog.step(s, {"speed": command.get("speed", 0.0) if go else 0.0, "yaw": command.get("yaw", s.yaw),
			"ground": command.ground}, dt, m.p)
		s.still = move_toward(s.still, 1.0 if s.actualSpeed < m.p.motion.stillSpeed else 0.0, dt * c.blend.stillRate)
		if not go and s.actualSpeed < c.settleSpeed and s.feet.values().all(func(f): return not f.swing):
			var a: Dictionary = c.actions[want]
			s.action = want
			s.queue = a.get("in", []).duplicate()
			if a.has("hold"):
				s.queue.append(a.hold)
			s.phase_ = "in"
			_next(s, false)
		return s
	s = s.duplicate(true)
	s.time += dt
	s.clip_time += dt
	s.from_time += dt
	s.fade = minf(1, s.fade + dt / c.blend.change) if s.fade < 1 else 1.0
	var a: Dictionary = c.actions[s.action]
	match s.phase_:
		"in", "out":
			s.weight = minf(1, s.weight + dt / c.blend.in) if s.phase_ == "in" else 1.0
			if s.clip_loop:  # the hold clip
				if want != s.action:
					s.queue = a.get("out", []).duplicate()
					s.phase_ = "out"
					if not _next(s, true):
						_finish(s)
			elif s.clip_time >= m.clips[s.clip].length:
				if not _next(s, false):
					if s.phase_ == "in" and not a.has("hold"):
						s.done = s.action
					_finish(s)
		"fade":
			s.weight = maxf(0, s.weight - dt / c.blend.out)
			if s.weight <= 0:
				s.phase_ = "walk"
				s.action = ""
	return s

## Start the next queued clip; false when there is none. change: fade from where the current one is.
static func _next(s: Dictionary, change: bool) -> bool:
	if s.queue.is_empty():
		return false
	var c: Dictionary = AnimalModel.config()
	s.from_clip = s.clip
	s.from_time = s.clip_time
	s.from_loop = s.clip_loop
	s.fade = 0.0 if change else 1.0
	s.clip = s.queue.pop_front()
	s.clip_time = 0.0
	s.clip_loop = c.actions[s.action].get("hold", "") == s.clip and s.phase_ == "in"
	return true

## The clips end standing, the paws where they stood before: fade the clips out.
static func _finish(s: Dictionary) -> void:
	s.hipYaw = s.yaw
	s.speed = 0.0
	s.phase_ = "fade"
