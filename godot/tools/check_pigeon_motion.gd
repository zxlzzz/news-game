## Pose-library contracts complement the caller's actual runtime visual review.
extends SceneTree
const Motion = preload("res://npc/pigeon_motion.gd")
const Pigeon = preload("res://npc/procedural_pigeon.gd")
var failures: Array[String] = []

func points(pose: Dictionary) -> Array[Vector3]:
	var out: Array[Vector3] = []
	for key in ["neck", "beak", "tail", "L", "R", "toesL", "toesR", "wingL", "wingR"]:
		for point in pose[key]: out.append(point)
	for disc in pose.body: out.append(disc[0])
	return out

func gap(a: Dictionary, b: Dictionary) -> float:
	var pa := points(a)
	var pb := points(b)
	var result := 0.0
	for i in pa.size(): result = maxf(result, pa[i].distance_to(pb[i]))
	return result

func require(ok: bool, message: String) -> void:
	if not ok: failures.append(message)

func _initialize() -> void:
	var p := Pigeon.load_params()
	var lib := Motion.library()
	var cfg: Dictionary = lib.checks
	var contexts := [{}, {"velocity": Vector3(2, 1, 3), "turn_rate": .8, "brake": .35}]
	var report := {"entries": [], "connections": [], "variants": [], "legacy_step": {},
		"limits": "Local pose geometry and deterministic contracts; not route or visual acceptance."}
	var worst_bone := 0.0
	var worst_loop := 0.0
	for entry in Motion.entries():
		var d: float = Motion.duration(entry.id)
		var count := int(ceil(d * cfg.sample_hz))
		for context in contexts:
			for i in range(count + 1):
				var t := d * i / count
				var pose := Motion.sample(entry.id, t, p, context)
				require(gap(pose, Motion.sample(entry.id, t, p, context)) == 0, entry.id + ": nondeterministic seek")
				for v in points(pose): require(v.is_finite(), entry.id + ": invalid point")
				var draw := Pigeon.silhouette(pose, p)
				require(not draw.triangles.is_empty() and not draw.segments.is_empty(), entry.id + ": undrawable")
				for key in Pigeon.FEET:
					worst_bone = maxf(worst_bone, absf(pose[key][0].distance_to(pose[key][1]) - p.legs.a))
					worst_bone = maxf(worst_bone, absf(pose[key][1].distance_to(pose[key][2]) - p.legs.b))
					if entry.support == "ground": require(pose[key][2].y >= -cfg.tolerance_m, entry.id + ": foot through local support plane")
			if entry.loop:
				var seam := gap(Motion.sample(entry.id, -cfg.seam_delta_s, p, context), Motion.sample(entry.id, cfg.seam_delta_s, p, context))
				worst_loop = maxf(worst_loop, seam)
				require(seam < cfg.maximum_loop_seam_gap_m, entry.id + ": discontinuous loop close-up")
				require(gap(Motion.sample(entry.id, 0, p, context), Motion.sample(entry.id, d, p, context)) < cfg.tolerance_m, entry.id + ": loop endpoints differ")
			else:
				require(gap(Motion.sample(entry.id, d, p, context), Motion.sample(entry.id, d * 3, p, context)) == 0, entry.id + ": single play did not clamp")
		report.entries.append(entry)
	# Every declared end/start pose can connect under the same route context.
	for a in Motion.entries():
		if a.loop: continue
		for b in Motion.entries():
			if a.end_pose != b.start_pose: continue
			var worst := 0.0
			for context in contexts: worst = maxf(worst, gap(Motion.sample(a.id, a.duration, p, context), Motion.sample(b.id, 0, p, context)))
			require(worst < cfg.tolerance_m, a.id + "->" + b.id + ": endpoint discontinuity")
			report.connections.append({"from": a.id, "to": b.id, "max_gap_m": worst})
	for pair in [["unfold_direct", "unfold_lift"], ["fold_direct", "fold_after_lift"], ["launch_power", "launch_open"], ["flap_to_glide_stroke", "flap_to_glide_soft"], ["land_flare", "land_absorb"]]:
		var different := 0.0
		for i in range(1, 10): different = maxf(different, gap(Motion.sample(pair[0], Motion.duration(pair[0]) * i / 10.0, p), Motion.sample(pair[1], Motion.duration(pair[1]) * i / 10.0, p)))
		require(different > cfg.variant_minimum_difference_m, str(pair) + ": middle process is not different")
		report.variants.append({"a": pair[0], "b": pair[1], "max_middle_difference_m": different})
	# Caller velocity supplies attitude, never root travel or automatic action switches.
	var horizontal_gap := gap(Motion.sample("glide", .3, p, {"velocity": Vector3(3, 0, 0)}), Motion.sample("glide", .3, p, {"velocity": Vector3(0, 0, 3)}))
	require(horizontal_gap == 0, "Library chose a heading/route from horizontal velocity")
	require(gap(Motion.sample("glide", .3, p), Motion.sample("glide", .3, p, {"velocity": Vector3(0, 2, 3)})) > .01, "Climb context has no attitude effect")
	require(gap(Motion.sample("glide", .3, p), Motion.sample("glide", .3, p, {"turn_rate": 1.0})) > .01, "Turn context has no bank effect")
	var baseline := Pigeon.pose(Pigeon.create(Vector3.ZERO, 0, p), p)
	require(gap(baseline, Motion.sample("folded", 0, p)) < cfg.tolerance_m, "Folded pose changed legacy standing geometry")
	var hop_duration := Motion.duration("hop")
	var hop_apex := Motion.sample("hop", hop_duration * .52, p)
	require(Motion.channels("hop", hop_duration * .52).body_lift > .05 and hop_apex.L[2].y > .02 and hop_apex.R[2].y > .02, "Hop never lifts its body/feet")
	require(Motion.channels("hop", hop_duration * .88).crouch > .015, "Hop has no landing absorption")
	require(not Motion.loop("hop") and gap(Motion.sample("hop", hop_duration, p), baseline) < cfg.tolerance_m, "Hop does not end folded on its support plane")
	# Existing create/step/pose API keeps handling motion independently of the library.
	var s := Pigeon.create(Vector3.ZERO, 0, p)
	var events := {"takeoff": 0, "touchdown": 0}
	for i in 1200:
		var t := float(i) / 120
		s = Pigeon.step(s, {"speed": .3 if t < 2 else 1.0, "yaw": 0.0, "ground": 0.0,
			"peck": t >= 1 and t < 2, "fly": t >= 2 and t < 5, "altitude": .8, "hop": null}, 1.0 / 120, p)
		for event in s.events:
			if events.has(event.type): events[event.type] += 1
		for v in points(Pigeon.pose(s, p)): require(v.is_finite(), "Legacy step produced invalid point")
	require(events.takeoff == 1 and events.touchdown == 1 and s.mode == "ground", "Legacy fly/land API failed")
	require(worst_bone < cfg.tolerance_m, "Library stretched a leg bone: " + str(worst_bone))
	report.max_leg_length_error_m = worst_bone
	report.max_loop_seam_gap_m_over_2delta = worst_loop
	report.horizontal_velocity_heading_gap_m = horizontal_gap
	report.legacy_step = {"events": events, "final_mode": s.mode}
	report.failures = failures
	var args := OS.get_cmdline_user_args()
	if not args.is_empty():
		var f := FileAccess.open(args[0], FileAccess.WRITE)
		assert(f != null, "Cannot write pigeon motion check report")
		f.store_string(JSON.stringify(report, "  ") + "\n")
	if failures.is_empty():
		print("PIGEON_MOTION_OK ", report.entries.size(), " named entries; ", report.connections.size(), " shared-pose connections; five variant pairs; legacy step API")
		quit(0)
	else:
		for error in failures.slice(0, 30): printerr(error)
		quit(1)
