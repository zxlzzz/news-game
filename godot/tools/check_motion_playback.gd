## Playback regressions: a non-loop must hold its actual last pose, explicit once
## interactions must stop, and every preview must stop after one source unit.
## Numerical checks do not certify acting quality.
## godot --headless --path . -s res://tools/check_motion_playback.gd -- [report.json]
extends SceneTree

const ClipPose := preload("res://npc/clip_pose.gd")
const SCENE := "res://scenes/empty_ground/level.tscn"
var level
var done := false
var waited := 0
var failures: Array[String] = []
var report := {"clips": {}, "scenarios": {}}

func _initialize() -> void:
	level = load(SCENE).instantiate()
	root.add_child.call_deferred(level)

func gap(a: Dictionary, b: Dictionary) -> float:
	var result: float = a.head.distance_to(b.head)
	for k in ["neck", "handLeft", "handRight"]:
		result = maxf(result, a[k].distance_to(b[k]))
	for i in a.segs.size():
		for j in 2:
			result = maxf(result, a.segs[i][j].distance_to(b.segs[i][j]))
	return result

func check(ok: bool, message: String) -> void:
	if not ok:
		failures.append(message)
		printerr("MOTION_PLAYBACK: ", message)

func _process(_dt: float) -> bool:
	if done:
		return true
	if level == null or not level.is_inside_tree() or level.get("stage") == null:
		waited += 1
		if waited < 600:
			return false
		check(false, "inspection scene did not start")
		return finish()
	done = true
	level.set_process(false)
	var st = level.stage
	for entry in st.entries:
		if entry.kind != "clip":
			continue
		var clip = ClipPose.of(entry.id)
		check(clip.error == "", entry.id + ": " + clip.error)
		if clip.error != "":
			continue
		var hold_gap := gap(clip.pose(1.0, false), clip.pose(3.0, false))
		check(hold_gap < 0.00001, entry.id + ": once sampling returned to the first pose")
		var rec := {"chains": clip.chains, "duration": clip.duration(), "once_hold_gap": hold_gap}
		if not clip.chains:
			var default_gap := gap(clip.pose(1.0), clip.pose(2.0))
			check(default_gap < 0.00001, entry.id + ": non-loop default sampling wrapped")
			check(clip.phase_at(3.0 * clip.duration()) == 1.0, entry.id + ": non-loop clock wrapped")
			rec.default_hold_gap = default_gap
		var err: String = st.select(entry.id, {})
		check(err == "", entry.id + ": " + err)
		if err == "":
			if entry.id in ["walk_stairs_up","walk_stairs_down"]:
				var start_root: Transform3D = st._root(st.main,0.0)[0]
				var last_root: Transform3D = st._root(st.main,st.cycle)[0]
				check(absf(start_root.origin.y-last_root.origin.y)<0.000001,entry.id+": preview adds vertical source travel twice")
			rec.preview_repeats = st.repeats()
			if not st.repeats():
				st.seek(st.cycle)
				var final_people := []
				for person in st.people:
					final_people.append({"pose": person.pose.duplicate(true), "root": person.root})
				st.advance(0.25)
				var final_gap := 0.0
				for i in st.people.size():
					final_gap = maxf(final_gap, gap(final_people[i].pose, st.people[i].pose))
					check(st.people[i].root.is_equal_approx(final_people[i].root), entry.id + ": completed preview moved a person")
				check(st.t == st.cycle and final_gap < 0.00001, entry.id + ": completed preview changed a pose")
				rec.preview_hold_gap = final_gap
		report.clips[entry.id] = rec
	for id in ["scratch_head", "stand_up", "trip_fall", "photo_overhead", "give_item", "car_enter"]:
		var err: String = st.select(id, {})
		check(err == "", id + ": " + err)
		if err != "":
			continue
		check(not st.repeats(), id + ": preview still repeats the one-shot")
		st.seek(st.cycle)
		var end_pose: Dictionary = st.main.pose.duplicate(true)
		var end_root: Transform3D = st.main.root
		st.advance(st.cycle + 0.25)
		var end_gap := gap(end_pose, st.main.pose)
		check(st.t == st.cycle and end_gap < 0.00001 and st.main.root.is_equal_approx(end_root), id + ": preview restarted after completion")
		st.seek(st.cycle * 0.35)
		var seek_pose: Dictionary = st.main.pose.duplicate(true)
		st.seek(st.cycle * 0.9)
		st.seek(st.cycle * 0.35)
		check(gap(seek_pose, st.main.pose) < 0.00001, id + ": scrubbing depends on previous time")
		report.scenarios[id] = {"cycle": st.cycle, "hold_gap": end_gap, "repeats": st.repeats()}
	for id in ["walk", "air_walker", "swing_seated"]:
		var err: String = st.select(id, {})
		check(err == "", id + ": " + err)
		if err != "":
			continue
		check(not st.repeats(), id + ": preview repeats a source cycle")
		st.seek(st.cycle - 0.01)
		st.advance(0.02)
		check(st.t == st.cycle, id + ": preview did not stop at its endpoint")
		report.scenarios[id] = {"cycle": st.cycle, "repeats": st.repeats(), "time_after_wrap": st.t}
	check(st.select("turn_page", {}) == "", "turn_page could not be selected")
	var prop_cycle: float = st.cycle
	st.seek(prop_cycle)
	var held_body: Dictionary = st.main.pose.duplicate(true)
	var held_prop: Transform3D = st.main.props[0].node.transform
	st.advance(prop_cycle)
	check(st.t == prop_cycle, "turn_page continued beyond one action")
	check(gap(held_body,st.main.pose)<0.00001 and held_prop.is_equal_approx(st.main.props[0].node.transform), "turn_page endpoint changed after completion")
	level.playing = false
	level._toggle_play()
	check(level.playing and st.t == 0.0, "replaying a finished action did not restart from its beginning")
	level.playing = false
	report.scenarios.turn_page = {"cycle": prop_cycle, "repeats": st.repeats()}
	check(st.select("stand_up", {}) == "", "manual stand_up could not be selected")
	st.seek(0.0)
	var start_pose: Dictionary = st.main.pose.duplicate(true)
	st.clock = 21.0
	check(st.add_person(Vector3(2, 0, 0)) == "", "manual stand_up could not be added")
	var added: Dictionary = st.people[-1]
	var manual_start_gap := gap(start_pose, added.pose)
	check(manual_start_gap < 0.00001, "newly added one-shot person started at an old global clock")
	st.advance(st.cycle * 2.0)
	check(gap(st.main.pose, added.pose) < 0.00001, "manual one-shot did not hold its final pose")
	report.scenarios.manual_stand_up = {"start_gap": manual_start_gap, "held_end_gap": gap(st.main.pose, added.pose)}
	st._free_person(added)
	return finish()

func finish() -> bool:
	done = true
	report.failures = failures
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		var file := FileAccess.open(args[0], FileAccess.WRITE)
		file.store_string(JSON.stringify(report, "\t"))
		file.close()
	if failures.is_empty():
		print("MOTION_PLAYBACK_OK ", report.clips.size(), " clips; end poses, once interactions, scrubbing, single source units")
		quit(0)
	else:
		print("MOTION_PLAYBACK_FAIL ", failures.size(), " problems")
		quit(1)
	return true
