## Runs scenes/two_streets for five simulated minutes without drawing and counts what the
## behaviour-driven pedestrians (npc/behaviour.gd) do: at every simulated 10 s, how many stroll,
## leave, play where they stand or are at each kind of post, how many of each were started and what
## trips to a post were given up for. Fails when a post kind in the scene that has a post:<kind> row in
## npc/behaviour-table.json is never used; kinds the scene offers but no row uses (their clips are
## declared in npc/clip-setup.json, rows not written yet) are only listed. Prints the counts and
## BEHAVIOUR_OK or BEHAVIOUR_FAIL.
##   godot --headless --path . -s res://tools/check_behaviour.gd
extends SceneTree

const SCENE := "res://scenes/two_streets/level.tscn"
const SECONDS := 300
const STEP := 0.1

var level: Node3D
var crowd: Node

func _initialize() -> void:
	level = load(SCENE).instantiate()
	root.add_child.call_deferred(level)

func _process(_d: float) -> bool:
	if crowd == null:
		if level.is_inside_tree():
			crowd = level.get_node_or_null("Crowd")
		return false
	crowd.set_process(false)  # stepped here, faster than frames
	var used := {}
	var kinds := {}
	for post in crowd.posts:
		kinds[post.kind] = true
	var lines := []
	var started := {}
	var dropped := {}
	var last := {}
	var seat_states := {}
	var seated_entered := 0
	var seated_left := 0
	var seating_errors: Array[String] = []
	var t := 0.0
	var next_report := 10.0
	while t < SECONDS:
		crowd._process(STEP)
		t += STEP
		var counts := {}
		for person in crowd.people:
			if person.type != "agent":
				continue
			var a = person.action
			var seated: bool=a!=null and a.get("seated",false)
			var was_seated: bool=seat_states.get(person.figure,false)
			if seated and not was_seated: seated_entered+=1
			if not seated and was_seated: seated_left+=1
			seat_states[person.figure]=seated
			if seated and not person.has("seat_transition") and absf(angle_difference(person.yaw,a.face))>0.01:
				seating_errors.append("turning while seated")
			if person.has("seat_transition") and person.seat_transition.time>crowd.p.seating.seconds+STEP:
				seating_errors.append("stalled seat transition")
			var old = last.get(person.figure)
			if a != old:
				if old != null and old.do == "use" and not old.arrived:
					var why := "post:%s given up for %s" % [old.post.kind, "nothing" if a == null else (a.do if a.do != "use" else "post:" + a.post.kind)]
					dropped[why] = dropped.get(why, 0) + 1
				last[person.figure] = a
				if a != null:
					var k: String = a.do if a.do != "use" else "post:" + a.post.kind
					started[k] = started.get(k, 0) + 1
			var what: String = "none" if a == null else (a.do if a.do != "use" else "post:%s%s" % [a.post.kind, "" if a.post.arrived else " (on the way)"])
			counts[what] = counts.get(what, 0) + 1
			if a != null and a.do == "use" and a.post.arrived:
				used[a.post.kind] = true
		if t >= next_report:
			next_report += 10.0
			var keys := counts.keys()
			keys.sort()
			lines.append("%3ds %s" % [t, ", ".join(keys.map(func(k): return "%s %d" % [k, counts[k]]))])
	for l in lines:
		print(l)
	print("started in %d s: %s" % [SECONDS, started])
	print("posts given up on the way: %s" % dropped)
	var rows := {}
	for r in crowd.beh.t.rows:
		if String(r.from).begins_with("post:"):
			rows[String(r.from).substr(5)] = true
	var no_row := kinds.keys().filter(func(k): return not rows.has(k))
	if not no_row.is_empty():
		print("post kinds in the scene with no row in the behaviour table (not used): %s" % [no_row])
	var never := kinds.keys().filter(func(k): return rows.has(k) and not used.has(k))
	print("seat transitions: entered %d, left %d" % [seated_entered,seated_left])
	if seated_entered==0 or seated_left==0 or not seating_errors.is_empty():
		printerr("BEHAVIOUR_FAIL: seating ",seating_errors)
		quit(1)
		return true
	if not never.is_empty():
		printerr("BEHAVIOUR_FAIL: posts never used in %d s: %s" % [SECONDS, never])
		quit(1)
	else:
		print("BEHAVIOUR_OK")
		quit(0)
	return true
