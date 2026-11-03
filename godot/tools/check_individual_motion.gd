## Verify that animal selection samples only its named source, from frame zero.
extends SceneTree

const Preview := preload("res://tools/animal_clip_preview.gd")
const Model := preload("res://npc/animal_model.gd")
const Bird := preload("res://npc/pigeon_motion.gd")
var fails := []

func _initialize() -> void:
	call_deferred("run")

func gap(a: Array, b: Array) -> float:
	var worst := 0.0
	for i in a.size():
		worst = maxf(worst, a[i].origin.distance_to(b[i].origin))
		worst = maxf(worst, a[i].basis.x.distance_to(b[i].basis.x))
		worst = maxf(worst, a[i].basis.y.distance_to(b[i].basis.y))
		worst = maxf(worst, a[i].basis.z.distance_to(b[i].basis.z))
	return worst

func check(value: bool, message: String) -> void:
	if not value:
		fails.append(message)

func run() -> void:
	var level = load("res://scenes/empty_ground/level.tscn").instantiate()
	root.add_child(level)
	await process_frame
	level.playing = false
	level.set_process(false)
	var st = level.stage
	check(st.error == "", st.error)
	var count := 0
	var loops := 0
	for breed in Model.config().breeds:
		var m := Model.info(breed)
		for clip in m.clips:
			if clip == "RESET":
				continue
			count += 1
			var id := "%s:%s" % [m.species, clip]
			var where := "%s/%s" % [breed, clip]
			check(st.select(id, {"breed": breed}) == "", "cannot select " + where)
			check(not st.ms.has("animal") and not st.ms.has("brain"), "behaviour state added to " + where)
			check(is_equal_approx(st.cycle, Preview.duration(m,clip)), "playback duration wrong: " + where)
			var loop: bool = Preview.repeats(m, clip)
			check(not st.repeats(), "UI replay differs: " + where)
			if loop:
				loops += 1
				check(gap(Model.sample(m, clip, 0, false), Model.sample(m, clip, m.clips[clip].length, false)) < 1e-5,
					"declared loop has different endpoint: " + where)
			for time in [0.0, st.cycle * 0.33, st.cycle * 0.8, st.cycle]:
				st.seek(time)
				check(gap(Preview.pose(m, clip, time).locals, Model.sample(m, clip, time*Model.config().playbackSpeed, false)) < 1e-7,
					"different motion injected: " + where)
			st.seek(st.cycle * 0.8)
			st.advance(st.cycle)
			check(is_equal_approx(st.t, st.cycle), "end playback wrong: " + where)
			st.seek(st.cycle * 0.25)
			var first: Array = Preview.pose(m, clip, st.t).locals
			st.seek(st.cycle * 0.9)
			st.seek(st.cycle * 0.25)
			check(gap(first, Preview.pose(m, clip, st.t).locals) < 1e-7, "scrub depends on history: " + where)
	for removed in ["dog", "pigeon", "pigeon_fly", "dog:behaviour", "cat:behaviour", "dog:sit", "cat:lie"]:
		check(not st.by_id.has(removed), "compound preview remains: " + removed)
	for motion in Bird.entries():
		var id: String = "pigeon:" + motion.id
		check(st.select(id) == "", "cannot select bird " + id)
		check(is_equal_approx(st.cycle, motion.duration), "bird duration changed: " + id)
		check(not st.repeats(), "bird repeats wrong: " + id)
		var root_transform: Transform3D = st.ms.fig.transform
		for time in [0.0, motion.duration * 0.25, motion.duration * 0.5, motion.duration]:
			st.seek(time)
			check(st.ms.fig.transform.is_equal_approx(root_transform), "bird preview adds a route: " + id)
			check(JSON.stringify(st.ms.pose) == JSON.stringify(Bird.sample(motion.id, time, st.ms.p, {}, false)),
				"different bird motion injected: " + id)
		st.seek(motion.duration * 0.8)
		st.advance(motion.duration)
		check(is_equal_approx(st.t, motion.duration),
			"bird end playback wrong: " + id)
	for failure in fails:
		push_error(failure)
	print("INDIVIDUAL_MOTION_%s clips=%d loops=%d bird=%d failures=%d" % ["OK" if fails.is_empty() else "FAIL", count, loops, Bird.entries().size(), fails.size()])
	quit(0 if fails.is_empty() else 1)
