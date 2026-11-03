## Kinematic text-world support. Devices own occupancy and motion, independently
## of a selected purpose. No behavior-name dispatch or animation/physics calls.
extends RefCounted
var owner: WeakRef
var s:
	get: return owner.get_ref()
var devices: Dictionary = {}
var calls: Dictionary = {}

func _init(system) -> void:
	owner = weakref(system)

func special_row(r: Dictionary) -> bool:
	return r.get("use", "") in ["support_use", "connection"]

func invitation_kind(_r: Dictionary) -> String: return ""
func has_condition(_r: Dictionary, _name: String) -> bool: return false
func condition(_p: Dictionary, _row: String, _target: String, _name: String) -> bool: return false
func person(id: String) -> Dictionary:
	for p in s.people:
		if p.id == id: return p
	return {}
func vec(a: Array) -> Vector3: return Vector3(a[0],a[1],a[2])
func profile(d: Dictionary) -> Dictionary: return s.t.supports[d.profile]
func port(d: Dictionary, role: String) -> String: return "support:"+d.id+":"+role
func occupied_key(d: Dictionary, role: String) -> String: return "bearing:"+d.id+":"+role
func world(d: Dictionary, point: Array) -> Vector3: return d.pos+vec(point).rotated(Vector3.UP,d.yaw)

func validate_row(id: String, r: Dictionary) -> String:
	if not r.get("label") is String or not s._number(r.get("base")) or r.base < 0: return "invalid support row: "+id
	if not r.get("tags",[]) is Array or not s._condition_known(r.get("when","")): return "invalid support gate/tags: "+id
	for tag in r.get("tags",[]):
		if not tag is String or tag == "": return "invalid support tag: "+id
	if r.has("action") or r.has("actions") or r.has("target") or r.has("tool"): return "support/connection template supplies body actions and targets: "+id
	if r.use == "connection":
		if not s.t.get("connections",{}).has(r.get("process","")): return "unknown connection definition: "+id
	elif not s.t.get("supports",{}).has(r.get("activity","")) or (r.get("role","") != "*" and r.get("role","") not in s.t.supports[r.activity].roles) or r.get("operation","use") not in ["use","board","summon","exit"]:
		return "unknown support definition/role/operation: "+id
	return ""

func validate_config() -> String:
	for key in ["support_speed","support_span","support_wait","door_seconds","support_turn_speed"]:
		if not s._number(s.t.defaults.get(key)) or s.t.defaults[key] <= 0: return "invalid support default: "+key
	if not s.t.get("supports") is Dictionary or not s.t.get("connections") is Dictionary: return "missing support/connection definitions"
	for c in s.t.supports.values():
		if not c is Dictionary or not s.activities.fields(c,["roles","minimum","motion","speed","span","retain","portal","response","requires_event","finish_track","compatible","anchor_role","driver","signal"]): return "unknown support profile field"
		if c.get("motion") not in ["route","track","fixed"] or not c.get("roles") is Dictionary or c.roles.is_empty() or not s._number(c.get("minimum")) or c.minimum < 1 or c.minimum > c.roles.size(): return "invalid support profile"
		if c.minimum != floorf(c.minimum): return "support minimum must be an integer"
		if c.get("driver","external") != "external" and not c.roles.has(c.driver): return "unknown support driver"
		if c.has("anchor_role") and not c.roles.has(c.anchor_role): return "unknown support anchor role"
		for key in ["retain","response","finish_track"]:
			if c.has(key) and not c[key] is bool: return "invalid support flag"
		if c.has("compatible") and (not c.compatible is Array or not c.compatible.all(func(k): return s.t.supports.has(k))): return "invalid compatible support profiles"
		if c.has("requires_event") and (not c.requires_event is String or c.requires_event == ""): return "invalid support event source"
		if c.get("response",false) and (not s.t.actions.has(c.get("signal","")) or s.t.actions[c.signal].mode != "once"): return "responsive support needs signal action"
		for key in ["speed","span"]:
			if c.has(key) and (not s._number(c[key]) or c[key] <= 0): return "invalid support speed/span"
		for r in c.roles.values():
			if not r is Dictionary or not s.activities.fields(r,["action","pose","ground","anchor","track","release","passive","from","to","contact","load_from","yaw"]): return "unknown support role field"
			if not s.t.actions.has(r.get("action","")) or r.get("pose") not in ["standing","supported_seated","hanging","inverted","lying","ground_seated"]: return "invalid support action/pose"
			if s.t.actions[r.action].posture != r.pose: return "support pose/action mismatch"
			if r.has("load_from") and not c.roles.has(r.load_from): return "unknown load-bearing role"
			if r.has("yaw") and not s._number(r.yaw): return "invalid support role yaw"
			for key in ["passive","contact"]:
				if r.has(key) and not r[key] is bool: return "invalid support role flag"
			for key in ["from","to"]:
				if r.has(key) and r[key] not in ["standing","ground_seated","lying"]: return "invalid support ground posture"
			for key in ["ground","anchor","release"]:
				if not r.get(key) is Array or r[key].size() != 3 or not r[key].all(func(n): return s._number(n)): return "invalid support point"
			if r.ground[1] != 0 or r.release[1] != 0: return "support ground must be grounded"
			if r.anchor[1] < 0: return "support anchor below ground"
			if r.has("track"):
				if not r.track is Array or r.track.size() < 2: return "invalid support track"
				for point in r.track:
					if not point is Array or point.size() != 3 or not point.all(func(n): return s._number(n)): return "invalid support track point"
				if r.track[0] != r.anchor: return "track must start at anchor"
		if c.has("portal") and (not c.portal is Dictionary or not s.activities.fields(c.portal,["width","depth","action"]) or c.portal.get("width",0) <= 0 or c.portal.get("depth",0) <= 0 or not s.t.actions.has(c.portal.get("action",""))): return "invalid portal"
	for c in s.t.connections.values():
		if not c is Dictionary or not s.activities.fields(c,["action","moving","tool"]) or c.get("tool") not in s.t.item_kinds: return "invalid connection"
		for key in ["action","moving"]:
			if not s.t.actions.has(c.get(key,"")) or s.t.actions[c[key]].get("tool") != c.tool: return "invalid connection action"
	return ""

## Scene tasks name current actors/places only, never relationships or schedules.
func add_device(id: String, kind: String, pos: Vector3, options: Dictionary = {}) -> String:
	if devices.has(id) or not s.t.supports.has(kind) or not s.activities.fields(options,["destination","actors","willing","rider","pickup","enabled","yaw"]): return "invalid support device"
	var c: Dictionary = s.t.supports[kind]
	if not options.get("actors",{}) is Dictionary or not options.get("willing",{}) is Dictionary or not options.get("enabled",true) is bool or not s._number(options.get("yaw",0.0)): return "invalid support device options"
	if not pos.is_finite() or absf(pos.y) > s.t.defaults.arrival: return "device origin is not grounded"
	if c.motion == "route" and not s.posts.has(options.get("destination","")): return "support route needs actual destination"
	for role in options.get("actors",{}):
		if not c.roles.has(role) or not options.actors[role] is String: return "unknown task actor role"
	for role in options.get("willing",{}):
		if not c.roles.has(role) or not options.willing[role] is bool: return "invalid support willingness"
	var d := {"id":id,"profile":kind,"pos":pos,"origin":pos,"yaw":options.get("yaw",0.0),"destination":options.get("destination",""),"actors":options.get("actors",{}).duplicate(),"willing":options.get("willing",{}).duplicate(),"rider":options.get("rider",""),"pickup":options.get("pickup",""),"enabled":options.get("enabled",true),"slots":{},"points":{},"ready":{},"session":{},"door":0.0,"crossers":{},"responding":false,"response":{},"trips":0,"stops":0,"openings":0,"task_done":false,"latched_open":false}
	for role in c.roles:
		var r: Dictionary = c.roles[role]
		s.posts[port(d,role)] = {"pos":world(d,r.ground),"kind":"support_entry","exclusive":not r.get("passive",false)}
		d.points[role] = world(d,r.anchor)
	devices[id] = d
	return ""

func open_call(id: String, actor: String, endpoint: String, kind := "phone", destination := "") -> String:
	if calls.has(id) or person(actor).is_empty() or endpoint == "" or not s.t.connections.has(kind) or (destination != "" and not s.posts.has(destination)): return "invalid connection request"
	if calls.values().any(func(c): return c.actor == actor and c.live): return "actor already connected"
	calls[id] = {"id":id,"actor":actor,"endpoint":endpoint,"kind":kind,"destination":destination,"live":true,"ended":"","since":s.clock}
	return ""

func end_call(id: String, reason := "hangup") -> void:
	if not calls.has(id) or not calls[id].live: return
	calls[id].live = false
	calls[id].ended = reason
	var p := person(calls[id].actor)
	if not p.is_empty() and p.current.get("target") == id and s.t.rows[p.current.row].get("use") == "connection": s._end(p,"completed")
	s.next_think = s.clock

func connection_work(p: Dictionary, kind: String, target := "", moving := false) -> Dictionary:
	var def: Dictionary = s.t.connections[kind]
	return s.action_preview(p,{"target":target},{"action":def.moving if moving else def.action,"use":"use_tool","tool":def.tool})

func waiting_connection(p: Dictionary, kind: String, target: String) -> Dictionary:
	if kind == "" or not calls.values().any(func(link): return link.live and link.actor == p.id and link.kind == kind): return {}
	var work := connection_work(p,kind,target)
	if not work.is_empty():
		work.steps[-1].erase("main")
		work.steps[-1]["wait"] = true
	return work

func check_world() -> String:
	var seen := {}
	for d in devices.values():
		if not d.pos.is_finite() or absf(d.pos.y) > s.t.defaults.arrival: return "device left ground: "+d.id
		for id in d.actors.values():
			if person(id).is_empty(): return "unknown support task actor: "+id
		for role in d.slots:
			var p := person(d.slots[role])
			if p.is_empty() or seen.has(p.id) or p.bearing != d.id+":"+role: return "invalid/duplicate support occupancy"
			seen[p.id] = true
	for p in s.people:
		if p.bearing != "" and (not seen.has(p.id) or p.support != ""): return "orphan/conflicting body support"
	return ""

func eligible(d: Dictionary, p: Dictionary, role: String) -> bool:
	if not d.enabled or (d.actors.has(role) and d.actors[role] != p.id): return false
	if d.slots.has(role) and d.slots[role] != p.id: return false
	var c := profile(d)
	if c.get("requires_event","") != "":
		var receivers: Array = c.roles.keys().filter(func(k): return c.roles[k].get("passive",false))
		if receivers.is_empty(): return false
		var q := person(d.actors.get(receivers[0],""))
		if q.is_empty() or q.gone or q.ground != c.roles[receivers[0]].get("from","lying") or q.can_rise: return false
		if not s.activities.events.values().any(func(e): return e.kind == c.requires_event and e.subject == q.id): return false
	return true

func resolve_role(d: Dictionary, p: Dictionary, r: Dictionary) -> String:
	if r.role != "*": return r.role
	for role in profile(d).roles:
		if d.slots.get(role) == p.id or d.ready.get(role,{}).get("actor") == p.id: return role
	for role in profile(d).roles:
		if eligible(d,p,role) and s._free([occupied_key(d,role)],p.id): return role
	return ""

func bound_row(p: Dictionary, c: Dictionary) -> Dictionary:
	var r: Dictionary = s.t.rows[c.row].duplicate()
	if r.use == "support_use": r.role = c.get("support_role",resolve_role(devices[c.target],p,r))
	return r

func targets(p: Dictionary, r: Dictionary) -> Array:
	if r.use == "connection": return calls.keys().filter(func(id): return calls[id].live and calls[id].actor == p.id and calls[id].kind == r.process)
	var op: String = r.get("operation","use")
	return devices.keys().filter(func(id):
		var d: Dictionary = devices[id]
		if d.profile not in [r.activity]+s.t.supports[r.activity].get("compatible",[]): return false
		var role := resolve_role(d,p,r)
		if role == "" or not eligible(d,p,role): return false
		if op == "exit": return p.bearing == d.id+":"+role and d.session.get("phase") == "parked"
		if p.bearing != "" or not d.session.is_empty(): return false
		if profile(d).motion == "route" and (d.task_done or d.pos.distance_to(s.posts[d.destination].pos) <= s.t.defaults.arrival): return false
		if op in ["board","summon"] and (d.rider != p.id or profile(d).get("response",false) != (op == "summon")): return false
		if profile(d).has("portal") and d.crossers.is_empty(): return false
		return true)

func location(row: String, target: String):
	if s.t.rows[row].use == "connection": return person(calls[target].actor).pos if calls.has(target) else null
	return devices[target].pos if devices.has(target) else null

func valid(p: Dictionary) -> bool:
	var r: Dictionary = bound_row(p,p.current)
	if r.use == "connection": return calls.has(p.current.target) and calls[p.current.target].live
	if not devices.has(p.current.target): return false
	var d: Dictionary = devices[p.current.target]
	if p.bearing.begins_with(d.id+":"): return true
	if profile(d).has("portal") and d.crossers.is_empty(): return false
	if d.responding: return true
	return eligible(d,p,r.role) and s.clock-p.current.get("prepare_since",p.current.since) <= s.t.defaults.support_wait

func preview(p: Dictionary, c: Dictionary) -> Dictionary:
	var r: Dictionary = bound_row(p,c)
	if r.use == "connection":
		if not calls.has(c.target) or not calls[c.target].live: return {}
		var link: Dictionary = calls[c.target]
		var moving: bool = link.destination != "" and p.pos.distance_to(s.posts[link.destination].pos) > s.t.defaults.arrival
		return connection_work(p,r.process,link.destination if moving else "",moving)
	if not devices.has(c.target): return {}
	var d: Dictionary = devices[c.target]
	if r.role == "": return {}
	c["support_role"] = r.role
	if not eligible(d,p,r.role): return {}
	var resource := occupied_key(d,r.role)
	if p.bearing != "":
		if p.bearing != d.id+":"+r.role: return {}
		return {"steps":[{"action":"support_release" if r.get("operation") == "exit" else profile(d).roles[r.role].action,"wait":true}],"resources":[resource]}
	if not d.session.is_empty(): return {}
	if profile(d).get("response",false) and not d.get("accepted",false):
		if not s.posts.has(d.pickup): return {}
		var signal_work: Dictionary = s.coop.work(p,profile(d).signal,d.pickup,{"support_signal":d.id}) if not d.responding else {"steps":[{"action":"support_wait","wait":true}],"resources":[]}
		if not signal_work.is_empty(): signal_work.resources.append(resource)
		return signal_work
	var work: Dictionary = s.coop.work(p,"support_prepare",port(d,r.role),{"support_role":r.role,"support_device":d.id})
	if work.is_empty(): return {}
	work.resources.append(resource)
	if d.ready.get(r.role,{}).get("instance",-1) == c.get("instance",-2): work.steps = [{"action":"support_wait","wait":true}]
	return work

func completed(p: Dictionary, step: Dictionary) -> void:
	var r: Dictionary = bound_row(p,p.current)
	if r.use == "connection":
		# A fragment/arrival does not terminate the connection or current call.
		return
	var d: Dictionary = devices[p.current.target]
	if step.has("support_signal"):
		if d.responding: return
		d.responding = true
		d.response = route(d.pos,s.posts[d.pickup].pos)
		return
	if step.has("support_device"):
		d.ready[r.role] = {"actor":p.id,"instance":p.current.instance}

func ending(p: Dictionary, outcome: String) -> void:
	var r: Dictionary = bound_row(p,p.current)
	if r.use == "connection": return # explicit call lifecycle only
	if not devices.has(p.current.target): return
	var d: Dictionary = devices[p.current.target]
	d.ready.erase(r.role)
	if d.slots.get(r.role,"") == p.id and not (outcome == "completed" and profile(d).get("retain",false)):
		if outcome != "completed": d.session["cancelled"] = true
		begin_release(d)
	if d.responding and d.slots.is_empty():
		d.responding = false
		d.response = {}

func switched(p: Dictionary) -> void:
	if p.bearing == "": return
	for d in devices.values():
		if p.id not in d.slots.values(): continue
		var r: Dictionary = s.t.rows.get(p.current.get("row",""),{})
		if r.get("use") != "support_use" or p.current.target != d.id or r.get("operation") == "exit":
			if r.get("operation") != "exit": d.session["cancelled"] = true
			begin_release(d)

func defer_ground(p: Dictionary, pose: String, can_rise: bool) -> void:
	for d in devices.values():
		if p.id not in d.slots.values(): continue
		d.session.get_or_add("ground_facts",{})[p.id] = {"pose":pose,"can_rise":can_rise}
		d.session["cancelled"] = true
		begin_release(d)

func busy(p: Dictionary) -> bool: return p.bearing != ""
func recovery_preview(_p: Dictionary) -> Dictionary:
	return {"steps":[{"action":"support_release","wait":true}],"resources":[]}

## Internal obstruction work keeps the same purpose and uses the ordinary
## preparation/effect executor. It never opens a manual door merely by proximity.
func obstruction_preview(p: Dictionary, c: Dictionary) -> Dictionary:
	if p.bearing != "": return recovery_preview(p)
	var d: Dictionary = devices.get(c.obstruction,{})
	if d.is_empty() or s.clock-c.get("obstruct_since",s.clock) > s.t.defaults.support_wait: return {}
	if p.pos.distance_to(d.pos) > s.t.defaults.reach: return {}
	var work: Dictionary = s.coop.work(p,profile(d).portal.action,"",{"actuator":d.id})
	if not work.is_empty():
		work.resources.append("actuator:"+d.id)
		var original: Dictionary = c.duplicate(true)
		original.erase("obstruction")
		var r: Dictionary = s.t.rows[c.row]
		var original_work: Dictionary = s.handler(r).preview(p,original) if s.handler(r) != null else s.action_preview(p,original,r)
		if original_work.is_empty(): return {}
		for key in original_work.resources:
			if key not in work.resources: work.resources.append(key)
	return work

func obstruct(p: Dictionary, portal: Dictionary) -> void:
	if p.current.has("obstruction"): return
	p.current["obstruction"] = portal.id
	p.current["obstruct_since"] = s.clock
	p.current["prepare_since"] = s.clock
	if p.bearing == "":
		p.body = {}
	else:
		for d in devices.values():
			if p.id in d.slots.values():
				d.session["paused"] = true
				begin_release(d)
	s.next_think = s.clock

func resume(p: Dictionary) -> void:
	p.current.erase("obstruction")
	p.current.erase("obstruct_since")
	p.current["prepare_since"] = s.clock
	p.body = {}
	# The purpose/phase survives, never the old raw body. Re-preview actual facts
	# and obtain all resources in the common decision before creating a new path.
	s.next_think = s.clock

func actuator_progress(p: Dictionary, step: Dictionary, body: Dictionary) -> void:
	if not devices.has(step.actuator) or p.current.get("obstruction") != step.actuator: return
	var d: Dictionary = devices[step.actuator]
	if not body.has("aperture_from"): body["aperture_from"] = d.door
	d.door = lerpf(body.aperture_from,1.0,minf(body.elapsed/s.t.defaults.once_demo,1.0))

func actuator_completed(p: Dictionary, step: Dictionary) -> void:
	if p.current.get("obstruction") != step.actuator: return
	var d: Dictionary = devices[step.actuator]
	d.door = 1.0
	d.latched_open = true
	d.openings += 1
	s.reserved.erase("actuator:"+d.id)
	resume(p)

func live_posts() -> Array: return []
func requests() -> Array:
	var out: Array = []
	for d in devices.values():
		var request := start_request(d)
		if not request.is_empty(): out.append(request)
	return out

func start_joint(joint: Dictionary) -> void:
	var d: Dictionary = devices[joint.device]
	if not d.session.is_empty(): return
	for info in joint.members.values():
		var p := person(info.actor)
		if p.is_empty() or p.bearing != "" or p.current.get("instance",-1) != info.instance:
			for key in s.reserved.keys():
				if s.reserved[key] == "support-group:"+d.id: s.reserved.erase(key)
			return
	start(d,joint.members)

func maintain() -> void:
	for call in calls.values():
		var actor := person(call.actor)
		if call.live and (actor.is_empty() or actor.gone): end_call(call.id,"endpoint_lost")
	for p in s.people:
		if p.current.has("obstruction") and p.bearing == "":
			var d: Dictionary = devices.get(p.current.obstruction,{})
			if not d.is_empty() and d.latched_open and d.door == 1.0:
				if s.reserved.get("actuator:"+d.id) == p.id: s.reserved.erase("actuator:"+d.id)
				resume(p)
	for d in devices.values():
		var c := profile(d)
		if d.session.is_empty() and c.has("anchor_role"):
			var anchor := person(d.actors.get(c.anchor_role,""))
			if not anchor.is_empty() and (not c.has("requires_event") or (anchor.ground != "standing" and not anchor.can_rise)):
				d.pos = anchor.pos-vec(c.roles[c.anchor_role].ground).rotated(Vector3.UP,d.yaw)
		for role in d.ready.keys():
			var info: Dictionary = d.ready[role]
			var p := person(info.actor)
			if p.is_empty() or p.gone or p.current.get("instance",-1) != info.instance: d.ready.erase(role)
		for id in d.crossers.keys():
			var p := person(id)
			var request: Dictionary = d.crossers[id]
			if p.is_empty() or p.gone or p.current.get("instance",-1) != request.instance or (request.side*(p.pos-d.pos).rotated(Vector3.UP,-d.yaw).z < -profile(d).portal.depth): d.crossers.erase(id)
		for role in profile(d).roles:
			s.posts[port(d,role)].pos = world(d,profile(d).roles[role].ground)
			s.posts[port(d,role)]["yaw"] = d.yaw+profile(d).roles[role].get("yaw",0.0)

## Routes are sampled at bounded speed. Carrier origins always stay on ground.
func route(a: Vector3, b: Vector3) -> Dictionary:
	if not s.planner.is_valid():
		s.error = "support route needs walking planner"
		return {}
	var pts: PackedVector3Array = s.planner.call(a,b)
	if pts.size() < 2:
		s.error = "no support route"
		return {}
	for point in pts:
		if not point.is_finite() or not is_zero_approx(point.y):
			s.error = "support carrier route is not grounded"
			return {}
	return {"path":s._path(pts),"distance":0.0}

func move_path(path: Dictionary, dt: float, speed: float) -> Vector3:
	path.distance = minf(path.path.length,path.distance+dt*speed)
	return s._at(path.path,path.distance)[0]

func done_path(path: Dictionary) -> bool: return path.distance >= path.path.length

func passive_ready(d: Dictionary, role: String) -> Dictionary:
	var p := person(d.actors.get(role,""))
	if p.is_empty() or p.gone or p.current.is_empty() or not d.willing.get(role,false) or p.bearing != "" or p.support != "": return {}
	var r: Dictionary = s.t.rows[p.current.row]
	# A selected subject response is willingness to receive care, not a forced desire.
	if r.get("use") != "event_response" or not s.t.responses[r.response].get("subject",false) or p.ground != profile(d).roles[role].get("from","lying"): return {}
	return {"actor":p.id,"instance":p.current.instance}

func start_request(d: Dictionary) -> Dictionary:
	if not d.session.is_empty(): return {}
	var c := profile(d)
	var chosen: Dictionary = d.ready.duplicate(true)
	for role in c.roles:
		if c.roles[role].get("passive",false):
			var info := passive_ready(d,role)
			if not info.is_empty(): chosen[role] = info
	if chosen.size() < c.minimum: return {}
	if c.get("retain",false) and d.door < 1.0: return {}
	if c.has("portal") and d.door < 1.0: return {}
	for role in chosen:
		var p := person(chosen[role].actor)
		if p.pos.distance_to(world(d,c.roles[role].ground)) > s.t.defaults.arrival or p.held != "": return {}
		# Passive body resources are atomically checked by the same allocator.
	var resources: Array = []
	var owners := {}
	var score := INF
	for role in chosen:
		var p := person(chosen[role].actor)
		var key := occupied_key(d,role)
		resources.append(key); owners[key] = p.id
		resources.append("body:"+p.id); owners["body:"+p.id] = "support-group:"+d.id
		score = minf(score,s._score(p,p.current.row,p.current.target,false)+p.current.jitter)
	var first := person(chosen.values()[0].actor)
	return {"p":first,"c":{"score":score,"key":"support:"+d.id},"work":{"resources":resources},"owners":owners,"joint":{"device":d.id,"members":chosen},"controller":self}

func start(d: Dictionary, chosen: Dictionary) -> void:
	var c := profile(d)
	var paths := {}
	for role in chosen:
		var p := person(chosen[role].actor)
		d.slots[role] = p.id
		p.support = ""; p.place = ""
		p.bearing = d.id+":"+role
		paths[role] = direct_path(p.pos,world(d,c.roles[role].anchor))
		set_body(p,"support_latch",d)
	d.session = {"phase":"enter","members":chosen,"paths":paths,"elapsed":0.0,"travel":{},"outcome":"completed","track_at":0.0}
	if c.motion == "route": d.session.travel = route(d.pos,s.posts[d.destination].pos)
	d.ready.clear()
	s._event(person(chosen.values()[0].actor),"support_start",d.id)

func direct_path(a: Vector3, b: Vector3) -> Dictionary:
	return {"path":s._path(PackedVector3Array([a,b])),"distance":0.0}

func set_body(p: Dictionary, action: String, d: Dictionary) -> void:
	if p.body.get("support_session","") == d.id and p.body.get("step",{}).get("action") == action: return
	s.serial += 1
	p.body = {"id":s.serial,"step":{"action":action,"wait":true},"elapsed":0.0,"effect":false,"support_session":d.id}
	s._event(p,"action",action)

func begin_release(d: Dictionary) -> void:
	if d.session.is_empty() or d.session.phase == "release": return
	var c := profile(d)
	if c.get("finish_track",false) and d.session.phase == "run" and not d.session.get("track_finished",false):
		d.session["unloading"] = true
		return # remain on the declared chute until its bottom
	d.session.phase = "release"
	d.session.paths = {}
	for role in d.slots:
		var p := person(d.slots[role])
		var r: Dictionary = c.roles[role]
		var goal: Vector3 = world(d,r.release)
		# Return via the declared support anchor, then lower to ground. Contacts
		# on the ground release in place; carts/cars keep their actual stopped origin.
		var pts := PackedVector3Array([p.pos])
		if r.get("contact",false): goal = p.pos
		elif not c.get("finish_track",false): pts.append(world(d,r.anchor))
		pts.append(goal)
		d.session.paths[role] = {"path":s._path(pts),"distance":0.0}
		set_body(p,"support_release",d)
	d.stops += 1

func release_done(d: Dictionary) -> void:
	var captured: Dictionary = d.session.members.duplicate(true)
	var paused: bool = d.session.get("paused",false)
	var c := profile(d)
	for role in d.slots.keys():
		var p := person(d.slots[role])
		p.bearing = ""
		p.body = {}
		p.ground = c.roles[role].get("from","standing") if d.session.get("cancelled",false) else c.roles[role].get("to","standing")
		if p.ground == "standing": p.can_rise = true
		if d.session.get("ground_facts",{}).has(p.id):
			var fact: Dictionary = d.session.ground_facts[p.id]
			p.ground = fact.pose; p.can_rise = fact.can_rise
		s.reserved.erase(occupied_key(d,role))
		s.reserved.erase("body:"+p.id)
	d.slots.clear()
	d.session = {}
	if not paused: d.trips += 1
	for info in captured.values():
		var p := person(info.actor)
		var r: Dictionary = s.t.rows.get(p.current.get("row",""),{})
		if not paused and (p.current.get("instance",-1) == info.instance or (r.get("use") == "support_use" and p.current.target == d.id and r.get("operation") == "exit")): s._end(p,"completed")
	s.next_think = s.clock

func advance(dt: float) -> void:
	for d in devices.values():
		var c := profile(d)
		if c.has("portal"):
			if d.crossers.is_empty() and d.slots.is_empty(): d.latched_open = false
			var operator: bool = s.people.any(func(p): return p.body.get("step",{}).get("actuator") == d.id)
			if not operator: d.door = move_toward(d.door,1.0 if d.latched_open or not d.slots.is_empty() else 0.0,dt/s.t.defaults.door_seconds)
		if c.get("retain",false):
			var open: bool = not d.ready.is_empty() or d.session.get("phase") in ["enter","release","parked"]
			d.door = move_toward(d.door,1.0 if open else 0.0,dt/s.t.defaults.door_seconds)
		if d.responding and not d.response.is_empty():
			d.pos = move_path(d.response,dt,c.get("speed",s.t.defaults.speed))
			if done_path(d.response):
				d.responding = false; d.response = {}; d["accepted"] = true
				var rider := person(d.rider)
				if not rider.is_empty() and rider.current.get("target") == d.id: rider.current["prepare_since"] = s.clock
				s.next_think = s.clock
		if d.session.is_empty():
			continue
		var session: Dictionary = d.session
		if session.get("paused",false) and session.phase != "release": begin_release(d)
		if session.phase != "release":
			var lost: bool = not d.enabled
			var absent: bool = not d.enabled
			for role in session.members:
				var p := person(session.members[role].actor)
				if p.gone or p.current.get("instance",-1) != session.members[role].instance: lost = true
				if p.held != "" or (c.roles[role].get("passive",false) and not d.willing.get(role,false)): lost = true
				if p.gone: absent = true
			if lost and (absent or not (c.get("retain",false) and session.phase == "parked")):
				session["cancelled"] = true
				begin_release(d)
		if session.phase in ["enter","release"]:
			if c.get("retain",false) and d.door < 1.0: continue
			var finished := true
			for role in session.paths:
				var p := person(d.slots[role])
				set_body(p,"support_release" if session.phase == "release" else "support_latch",d)
				p.pos = move_path(session.paths[role],dt,s.t.defaults.support_speed)
				if not done_path(session.paths[role]): finished = false
			if finished:
				if session.phase == "release": release_done(d)
				else:
					session.phase = "seal" if c.get("retain",false) else "run"
					for role in d.slots: set_body(person(d.slots[role]),c.roles[role].action,d)
			continue
		if session.phase == "seal":
			if d.door <= 0.0: session.phase = "run"
			continue
		if session.phase == "parked": continue
		session.elapsed += dt
		var finished := false
		if c.motion == "route":
			var previous: float = session.travel.distance
			var proposed := move_path(session.travel,dt,c.get("speed",s.t.defaults.speed))
			var driver := person(d.slots.get(c.get("driver",""),""))
			if not driver.is_empty() and portal_blocked(driver,proposed):
				session.travel.distance = previous
				continue
			d.pos = proposed
			var heading: float = s._at(session.travel.path,session.travel.distance)[1]
			d.yaw = rotate_toward(d.yaw,heading,s.t.defaults.support_turn_speed*dt)
			finished = done_path(session.travel)
		var span: float = c.get("span",s.t.defaults.support_span)
		var progress: float = minf(session.elapsed/span,1.0)
		for role in d.slots:
			var p := person(d.slots[role])
			var r: Dictionary = c.roles[role]
			p.yaw = d.yaw+r.get("yaw",0.0)
			if r.has("track"):
				var pts := PackedVector3Array()
				for point in r.track: pts.append(world(d,point))
				var path: Dictionary = s._path(pts)
				# Bounded track speed, including interruption continuation on a chute.
				var distance: float = minf(path.length,session.elapsed*c.get("speed",s.t.defaults.support_speed))
				p.pos = s._at(path,distance)[0]
				finished = distance >= path.length if c.get("finish_track",false) else progress >= 1.0
			else: p.pos = world(d,r.anchor)
			d.points[role] = p.pos
		if c.motion == "fixed": finished = progress >= 1.0 or (c.has("portal") and d.crossers.is_empty())
		if c.get("finish_track",false): session["track_finished"] = finished
		if c.get("retain",false):
			if finished:
				session.phase = "parked"; d.stops += 1; d.task_done = true
				for info in session.members.values():
					var p := person(info.actor)
					if p.current.get("instance",-1) == info.instance: s._end(p,"completed")
		elif finished:
			if c.motion == "route": d.task_done = true
			begin_release(d)

## Internal route operation: an actual walker requests a portal while approaching.
## Body progress pauses at the current position until opening finishes; no snap.
func walk_step(p: Dictionary, proposed: Vector3, dt: float) -> Vector3:
	if portal_blocked(p,proposed):
		p.body.elapsed -= dt
		obstruct(p,devices[p.body.portal])
		return p.pos
	return proposed

func portal_blocked(p: Dictionary, proposed: Vector3) -> bool:
	p.body.erase("portal")
	for d in devices.values():
		var c := profile(d)
		if not c.has("portal"): continue
		var local: Vector3 = (proposed-d.pos).rotated(Vector3.UP,-d.yaw)
		var near: bool = absf(local.x) <= c.portal.width and absf(local.z) <= c.portal.depth
		if not near: continue
		if d.crossers.get(p.id,{}).get("instance",-1) != p.current.instance:
			d.crossers[p.id] = {"instance":p.current.instance,"side":signf(local.z)}
		if d.door < 1.0:
			p.body["portal"] = d.id
			if p.bearing != "": obstruct(p,d)
			return true
	return false

func lines(p: Dictionary) -> PackedStringArray:
	var r: Dictionary = s.t.rows[p.current.row]
	var action: String = p.body.get("step",{}).get("action","")
	var lower: String = s.t.actions[action].label if action != "" else "准备中"
	return PackedStringArray([r.label]) if lower == r.label else PackedStringArray([r.label,lower])

func body_state(p: Dictionary) -> Dictionary:
	for d in devices.values():
		for role in d.slots:
			if d.slots[role] == p.id:
				var r: Dictionary = profile(d).roles[role]
				var load_owner: String = d.slots.get(r.get("load_from",""),"ground" if r.get("contact",false) else d.id)
				return {"kind":r.pose,"owner":load_owner,"device":d.id,"role":role,"drives":profile(d).get("driver") == role,"phase":d.session.phase}
	return {"kind":"seated","owner":p.support} if p.support != "" else {"kind":p.ground,"owner":"ground"}
