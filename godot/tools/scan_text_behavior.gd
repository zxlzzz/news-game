## Run only the independent text scene; optionally export every simulated frame to JSONL.
extends SceneTree
var failures: Array[String] = []
var states := {}
var counts := {}
var changes := {}
var max_idle := {}
var stable_changes := {}
var output: FileAccess
var seconds := 240.0
var device_states := {}
var purpose_rows := {}
var summary_path := ""
var trace_path := ""

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--output="): output = FileAccess.open(arg.trim_prefix("--output="),FileAccess.WRITE)
		if arg.begins_with("--seconds="): seconds = float(arg.trim_prefix("--seconds="))
		if arg.begins_with("--summary="): summary_path=arg.trim_prefix("--summary=")
		if arg.begins_with("--trace="): trace_path=arg.trim_prefix("--trace=")
	call_deferred("scan")

func scan() -> void:
	var scene = load("res://scenes/text_behavior_test/level.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	scene.set_process(false)
	var s = scene.sim
	s.tracing = true
	for frame in ceili(seconds*60):
		scene.step(1.0/60)
		if s.error != "":
			failures.append(s.error)
			break
		var rows: Array = []
		for p in s.people:
			var action: String = p.body.get("step",{}).get("action","")
			var text: String = " / ".join(s.lines(p))
			var row: String = p.current.get("row","")
			if row!="": purpose_rows[row]=purpose_rows.get(row,0)+1
			var state: Dictionary = states.get(p.id,{"pos":p.pos,"still":0.0,"text":"","idle":0.0,"empty_body":0.0,"body_id":-1,"wait":0.0})
			var moving: bool = action != "" and s.t.actions[action].mode == "move"
			var bearing: Dictionary = s.supports.body_state(p)
			state.still = state.still+1.0/60 if moving and state.get("moving",false) and p.pos.distance_to(state.pos) < 0.0001 else 0.0
			state.moving = moving
			state.idle = state.idle+1.0/60 if not p.gone and p.current.is_empty() else 0.0
			state.empty_body = state.empty_body+1.0/60 if not p.current.is_empty() and p.body.is_empty() else 0.0
			state.wait = state.wait+1.0/60 if p.body.get("step",{}).get("wait",false) else 0.0
			if p.bearing != "":
				var progress := [p.pos,bearing.get("phase")]
				if state.get("support_progress",[]) != progress: state.wait = 0.0
				state.support_progress = progress
			if state.get("binding","") != p.current.get("key",""): state.wait = 0.0
			state.binding = p.current.get("key","")
			max_idle[p.id] = maxf(max_idle.get(p.id,0),state.idle)
			if action != "": counts[action] = counts.get(action,0)+1
			if action != "" and s.t.actions[action].mode == "move" and state.still > 5:
				failures.append("walking without displacement: "+p.id+" "+row)
			if state.empty_body > s.t.defaults.activity_wait+1:
				failures.append("selected purpose has no body for > activity_wait: "+p.id+" "+row)
			var use: String = s.t.rows.get(row,{}).get("use", "")
			if use in ["service_vendor","service_customer"] and not p.current.is_empty():
				var active: Dictionary = s.coop.stalls[p.current.target].active
				var buyer: Dictionary = s.coop.person(active.get("buyer",""))
				if not buyer.is_empty():
					var token := [buyer.pos,active.get("chosen"),active.get("weighed"),active.get("checkout")]
					if state.get("service_progress",[]) != token: state.wait = 0.0
					state.service_progress = token
			if state.wait > s.t.defaults.activity_wait+1:
				failures.append("waiting without progress for > activity_wait: "+p.id+" "+row)
			# Bodyless preparation is a one-frame presentation gap, not a stable third state.
			if action != "":
				var stable: Array = stable_changes.get(p.id,[])
				if stable.is_empty() or stable[-1].text != text:
					stable.append({"time":s.clock,"text":text})
					if stable.size() >= 6:
						var h: Array = stable.slice(-6)
						if h[0].text == h[2].text and h[2].text == h[4].text and h[1].text == h[3].text and h[3].text == h[5].text and h[5].time-h[0].time < 3.1:
							failures.append("stable repeating head-box cycle: "+p.id+" "+str(h))
				stable_changes[p.id] = stable
			if state.text != text:
				var history: Array = changes.get(p.id,[])
				history.append({"time":s.clock,"text":text,"row":row})
				changes[p.id] = history
			state.text = text
			state.pos = p.pos
			states[p.id] = state
			rows.append({"id":p.id,"pos":[p.pos.x,p.pos.y,p.pos.z],"row":row,"target":p.current.get("target",""),"action":action,"text":text,"support":p.support,"bearing":bearing,"ground":p.ground,"held":p.held,"instance":p.current.get("instance",-1),"body":p.body.get("id",-1),"gone":p.gone})
		var devices := {}
		for id in s.supports.devices:
			var d: Dictionary = s.supports.devices[id]
			var token := [d.pos,d.session.get("phase"),d.session.get("paths"),d.door,d.slots,d.points]
			var previous: Dictionary = device_states.get(id,{"token":[],"stalled":0.0})
			previous.stalled = previous.stalled+1.0/60 if previous.token == token else 0.0
			previous.token = token.duplicate(true)
			device_states[id] = previous
			if not d.slots.is_empty() and d.session.get("phase") != "parked" and previous.stalled > s.t.defaults.support_wait: failures.append("support stalled: "+id)
			devices[id] = {"pos":[d.pos.x,d.pos.y,d.pos.z],"phase":d.session.get("phase","idle"),"slots":d.slots.duplicate(),"door":d.door,"responding":d.responding}
		if output != null: output.store_line(JSON.stringify({"frame":frame,"time":s.clock,"people":rows,"devices":devices,"calls":s.supports.calls}))
		if not failures.is_empty(): break
	if output != null: output.close()
	var world_error: String = s.check_world()
	if world_error != "": failures.append(world_error)
	if seconds >= 60:
		for id in s.supports.devices:
			var d: Dictionary = s.supports.devices[id]
			if s.supports.profile(d).has("portal"):
				if d.openings == 0: failures.append("configured portal never opened: "+id)
			elif d.trips == 0: failures.append("configured support never completed: "+id)
		if s.supports.calls.values().any(func(link): return link.live): failures.append("configured explicit call ending was not applied")
		for name in scene.config.get("required_demonstrations",[]):
			if not purpose_rows.has(name): failures.append("configured behavior never ran: "+name)
		for id in scene.config.get("required_task_results",[]):
			if not s.activities.tasks[id].done: failures.append("current scene task did not complete: "+id)
		for id in scene.config.get("required_transfer_results",[]):
			if not s.coop.intents[id].done: failures.append("finite scene transfer did not complete: "+id)
		for id in scene.config.get("required_checkout_results",[]):
			var f: Dictionary=s.activities.checkouts[id]
			if not f.orders.values().any(func(order):return order.collected): failures.append("finite scene purchase did not complete: "+id)
	for f in failures: printerr("TEXT_BEHAVIOR_SCAN_FAIL: "+f)
	var summary := {"seconds":s.clock,"frames":roundi(s.clock*60),"actors":s.people.size(),"actions":counts.keys(),"max_idle_seconds":max_idle,"trace_events":s.trace.size(),"live_encounters":s.activities.encounters.size(),"live_journeys":s.activities.links.values().filter(func(l): return l.active).size()}
	summary["support_trips"] = {}
	for id in s.supports.devices: summary.support_trips[id] = s.supports.devices[id].trips
	summary["portal_openings"] = {}
	for id in s.supports.devices:
		if s.supports.profile(s.supports.devices[id]).has("portal"): summary.portal_openings[id] = s.supports.devices[id].openings
	summary["live_calls"] = s.supports.calls.values().filter(func(link): return link.live).size()
	summary["purpose_rows"]=purpose_rows
	summary["current_task_results"]={}
	for id in s.activities.tasks: summary.current_task_results[id]=s.activities.tasks[id].done
	summary["checkout_results"]={}
	for id in s.activities.checkouts: summary.checkout_results[id]={"orders":s.activities.checkouts[id].orders,"credits":s.activities.checkouts[id].credits}
	summary["transfer_results"]=s.coop.intents
	if summary_path!="": FileAccess.open(summary_path,FileAccess.WRITE).store_string(JSON.stringify(summary,"  "))
	if trace_path!="": FileAccess.open(trace_path,FileAccess.WRITE).store_string(JSON.stringify(s.trace,"  "))
	print("TEXT_BEHAVIOR_SCAN_SUMMARY ",JSON.stringify(summary))
	if failures.is_empty(): print("TEXT_BEHAVIOR_SCAN_OK")
	scene.queue_free()
	await process_frame
	quit(0 if failures.is_empty() else 1)
