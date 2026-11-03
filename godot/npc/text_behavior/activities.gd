## Ongoing activities supply work to the same executor and atomic allocator.
## State belongs to the live encounter, object, journey or visible event, never a behavior name.
extends RefCounted
const TEMPLATES := {
	"conversation":{"definition":"conversations", "field":"activity", "conditions":["invited"]},
	"object_activity":{"definition":"object_activities", "field":"activity", "conditions":[]},
	"move_together":{"definition":"journeys", "field":"activity", "conditions":["invited"]},
	"event_response":{"definition":"responses", "field":"response", "conditions":["salient"]},
	"sequence":{"definition":"processes", "field":"process", "conditions":[]},
	"current_task":{"definition":"current_tasks", "field":"process", "conditions":[]},
	"observe":{"conditions":[]},
	"transport":{"definition":"transports", "field":"process", "conditions":[]}
}
var owner: WeakRef
var s:
	get: return owner.get_ref()
var encounters: Dictionary = {}
var objects: Dictionary = {}
var links: Dictionary = {}
var animals: Dictionary = {}
var events: Dictionary = {}
var tasks: Dictionary = {} # explicit current scene work, never remembered appointments
var checkouts: Dictionary = {} # finite stock, authorizations and durable paid/output facts

func _init(system) -> void:
	owner = weakref(system)

func check_world() -> String:
	for animal in animals.values():
		if not animal.get("pos") is Vector3 or not animal.get("willing") is bool or not animal.get("moving") is bool: return "invalid animal adapter state"
	for e in events.values():
		if e.kind == "" or not e.pos is Vector3 or not s._number(e.until) or e.radius <= 0: return "invalid event"
	for p in s.people:
		if p.ground not in ["standing","ground_seated","lying"]: return "invalid ground posture"
	return ""

func special_row(r: Dictionary) -> bool:
	return TEMPLATES.has(r.get("use", ""))

func invitation_kind(r: Dictionary) -> String:
	return "conversation:"+r.activity if r.get("use") == "conversation" and not config(r).roles[r.role].get("reply_only",false) else ""

func config(r: Dictionary) -> Dictionary:
	var d: Dictionary = TEMPLATES[r.use]
	return s.t[d.definition][r[d.field]] if d.has("definition") else {}

func person(id: String) -> Dictionary:
	return s.coop.person(id)

func has_condition(r: Dictionary, name: String) -> bool:
	return name in TEMPLATES[r.use].conditions

func condition(p: Dictionary, row: String, target: String, name: String) -> bool:
	var r: Dictionary = s.t.rows[row]
	if name == "salient": return events.has(target) and events[target].salient
	if r.use == "move_together":
		var l: Dictionary = links.get(target,{})
		return not l.is_empty() and l.actors.any(func(id): return id != p.id and not person(id).is_empty() and person(id).current.get("target") == target)
	var q := person(target)
	return not q.is_empty() and not q.current.is_empty() and s.t.rows[q.current.row].get("activity") == r.activity and q.current.target == p.id and s.invitation_visible(p,q)

func validate_row(id: String, r: Dictionary) -> String:
	var descriptor: Dictionary = TEMPLATES[r.use]
	if descriptor.has("definition"):
		if not s.t.get(descriptor.definition, {}) is Dictionary or not s.t.get(descriptor.definition, {}).has(r.get(descriptor.field,"")): return "missing template definition: " + id
		if r.use in ["conversation", "object_activity", "move_together"] and not config(r).get("roles",{}).has(r.get("role","")): return "unknown activity role: " + id
	if not r.get("label") is String or r.label.is_empty(): return "template row needs label: " + id
	if not s._condition_known(r.get("when","")): return "unknown entrance condition: " + id
	var base = r.get("base")
	if base is Dictionary:
		if not base.has("else"): return "base needs else: " + id
		for c in base:
			if c != "else" and not s._condition_known(c,false) and not has_condition(r,c): return "unknown template circumstance: " + c
			if not s._number(base[c]) or base[c] < 0: return "invalid base: " + id
	elif not s._number(base) or base < 0: return "invalid base: " + id
	if not r.get("tags",[]) is Array: return "invalid tags: " + id
	for tag in r.get("tags",[]):
		if not tag is String or tag == "": return "invalid tag: " + id
	if r.use in ["conversation","object_activity","move_together","event_response","current_task"]:
		if r.has("action") or r.has("actions") or r.has("target") or r.has("tool"): return "template supplies actions/targets: " + id
	elif r.use == "observe":
		if not s.t.actions.has(r.get("action","")) or r.get("target") not in ["person", "focus"]: return "observe needs action/focus source: " + id
		var action: Dictionary = s.t.actions[r.action]
		if action.mode == "move" or action.has("effect") or action.has("post"): return "observe needs in-place action: " + id
	else:
		if not r.get("target", "").begins_with("post:"): return "process needs destination source: " + id
		if r.has("action") or r.has("actions") or r.has("tool"): return "process supplies actions: " + id
		if r.use == "sequence":
			for step in config(r).steps:
				if s.t.actions.has(step.get("action","")) and s.t.actions[step.action].has("post") and r.target != "post:"+s.t.actions[step.action].post: return "process action/post mismatch: " + id
	return ""

func validate_config() -> String:
	for name in ["activity_demo", "activity_wait", "event_life", "event_radius"]:
		if not s._number(s.t.defaults.get(name)) or s.t.defaults[name] <= 0: return "invalid activity default: " + name
	for collection in ["conversations", "object_activities", "journeys", "responses", "processes", "transports", "ground_poses"]:
		if not s.t.get(collection) is Dictionary: return "missing definitions: " + collection
	for c in s.t.conversations.values():
		if not c is Dictionary or not fields(c,["roles","offsets","open_group","range","requires_event","layout"]): return "unknown conversation field"
		if not c.get("roles") is Dictionary or c.roles.is_empty() or not c.get("offsets") is Array or c.offsets.size() < 2: return "invalid conversation roles/layout"
		if c.has("layout") and not s.coop.setups.get(c.layout,{}).has("partner"): return "unknown conversation layout"
		for offset in c.offsets:
			if not offset is Array or offset.size() != 3 or not offset.all(func(n): return s._number(n)): return "invalid conversation offset"
		for role in c.roles.values():
			if not role is Dictionary or not fields(role,["speak","listen","partners","reply_only"]): return "unknown conversation role field"
			if not role.get("partners") is Array or role.partners.is_empty() or not role.partners.all(func(name): return c.roles.has(name)): return "invalid partner roles"
			for a in [role.get("speak",""),role.get("listen","")]:
				if not s.t.actions.has(a): return "unknown conversation action"
			if s.t.actions[role.speak].mode != "once": return "conversation turn must be once"
			if s.t.actions[role.listen].mode != "hold": return "conversation listener must hold"
	for c in s.t.object_activities.values():
		if not c is Dictionary or not fields(c,["roles","turn_role"]): return "unknown object activity field"
		if not c.get("roles") is Dictionary or not c.roles.has(c.get("turn_role","")): return "invalid object turn role"
		for role in c.roles.values():
			if not role is Dictionary or not fields(role,["minimum","action","wait","requires"]): return "unknown object role field"
			if role.has("requires") and not c.roles.has(role.requires): return "unknown required object role"
			if not s._number(role.get("minimum")) or role.minimum < 1: return "invalid object minimum"
			for a in [role.get("action",""),role.get("wait","")]:
				if not s.t.actions.has(a): return "unknown object activity action"
	for c in s.t.journeys.values():
		if not c is Dictionary or not fields(c,["roles","separation","leader"]): return "unknown journey field"
		if not c.get("roles") is Dictionary or c.roles.size() != 2 or not s._number(c.get("separation")) or c.separation <= 0: return "invalid journey roles/separation"
		if not c.roles.has(c.get("leader","")) or c.roles[c.leader].get("animal",false): return "journey needs human leading role"
		for role in c.roles.values():
			if not role is Dictionary or not fields(role,["animal","action"]): return "unknown journey role field"
			if role.get("animal",false): continue
			if not s.t.actions.has(role.get("action","")) or s.t.actions[role.action].mode != "move": return "journey needs moving action"
	for c in s.t.responses.values():
		if not c is Dictionary or not fields(c,["events","actions","subject","unstable","rise_after"]): return "unknown response field"
		if not c.get("events") is Array or c.events.is_empty() or not c.get("actions") is Dictionary: return "invalid event response"
		for pose in c.actions:
			if pose not in ["standing","ground_seated","lying"] or not s.t.actions.has(c.actions[pose]): return "unknown response posture/action"
	for c in s.t.processes.values():
		if not c is Dictionary or not fields(c,["steps","input","transaction"]): return "unknown process field"
		if not c.get("steps") is Array or c.steps.is_empty(): return "empty process"
		for step in c.steps:
			if not step is Dictionary or not fields(step,["action","operation"]) or not s.t.actions.has(step.get("action","")): return "unknown process action"
		if c.has("input") and (not c.input is Dictionary or not fields(c.input,["kind","owned"])): return "invalid process input"
		if c.has("input") and c.input.has("kind") and c.input.kind not in s.t.item_kinds: return "unknown process input kind"
		if c.has("transaction"):
			if not c.transaction is Dictionary or not fields(c.transaction,["product","payment_tool"]) or c.transaction.get("product") not in s.t.item_kinds or c.transaction.get("payment_tool") not in s.t.item_kinds: return "invalid transaction product/payment"
			if c.steps.map(func(step): return step.get("operation","")) != ["select","pay","release","collect"]: return "transaction needs selection/payment/real output/collection"
			if s.t.actions[c.steps[1].action].get("tool") != c.transaction.payment_tool or s.t.actions[c.steps[3].action].get("effect") != "collect": return "transaction action contract mismatch"
	for c in s.t.get("current_tasks",{}).values():
		if not c is Dictionary or not fields(c,["action","actions","subject","complete","offset","radius"]) or c.get("subject") not in ["animal","person"] or c.get("complete") not in ["contact","arrival"] or not s.t.actions.has(c.get("action","")): return "invalid current task"
		if c.has("actions"):
			if c.complete != "arrival" or not c.actions is Array or c.actions.is_empty(): return "invalid current task action pool"
			for action in c.actions:
				if not s.t.actions.has(action) or s.t.actions[action].posture != "standing" or not s.t.actions[action].get("empty",false) or s.t.actions[action].mode not in ["once","hold"] or s.t.actions[action].has("effect") or s.t.actions[action].has("post"): return "invalid current task waiting action"
		if not c.get("offset") is Array or c.offset.size()!=3 or not c.offset.all(func(v):return s._number(v)) or not s._number(c.get("radius")) or c.radius<=0: return "invalid current task geometry"
	for c in s.t.transports.values():
		if not c is Dictionary or c.is_empty(): return "empty transport"
		for kind in c:
			if kind not in s.t.item_kinds or not s.t.actions.has(c[kind]) or s.t.actions[c[kind]].mode != "move" or s.t.actions[c[kind]].get("tool") != kind: return "invalid transport variant"
	for pose in s.t.ground_poses:
		var a: String = s.t.ground_poses[pose].get("enter","")
		if not s.t.actions.has(a) or s.t.actions[a].get("effect") != pose: return "invalid ground pose transition"
	if not s.t.get("seats") is Dictionary: return "missing seat transitions"
	if not s.t.get("external_facts",{}).get("fall") is Dictionary: return "missing external fall contract"
	for seat in s.t.seats.values():
		for transition in ["enter","leave"]:
			if not s.t.actions.has(seat.get(transition,"")): return "unknown seat transition"
		if s.t.actions[seat.enter].get("effect") != "sit" or s.t.actions[seat.leave].get("effect") != "stand": return "invalid seat transition effect"
	return ""

func fields(value: Dictionary, allowed: Array) -> bool:
	return value.keys().all(func(k): return k in allowed)

func pose(p: Dictionary) -> String:
	return "seated" if p.support != "" else p.ground

func targets(p: Dictionary, r: Dictionary) -> Array:
	match r.use:
		"conversation":
			return s.people.filter(func(q): return q.id != p.id and not q.gone and q.pos.distance_to(p.pos) <= config(r).get("range",s.t.defaults.invite_range) and eligible_conversation(p,q,r)).map(func(q): return q.id)
		"object_activity":
			return objects.keys().filter(func(id): return objects[id].activity == r.activity and object_available(objects[id],r.role))
		"move_together":
			return links.keys().filter(func(id): return links[id].activity == r.activity and links[id].roles.get(p.id) == r.role and link_available(links[id]))
		"event_response":
			return events.keys().filter(func(id): return event_eligible(p,events[id],config(r)))
		"current_task": return tasks.keys().filter(func(id): return tasks[id].actor==p.id and tasks[id].profile==r.process and task_valid(tasks[id]))
		"observe":
			var out: Array = s.people.filter(func(q): return q.id != p.id and not q.gone).map(func(q): return "person:"+q.id)
			if r.target == "focus":
				for id in s.posts:
					if s.posts[id].get("focus",false): out.append("post:"+id)
				for id in events:
					if visible(p,events[id]): out.append("event:"+id)
			return out
	return s.posts.keys().filter(func(id): return "post:"+s.posts[id].kind == r.target)

func eligible_conversation(p: Dictionary, q: Dictionary, r: Dictionary) -> bool:
	var c := config(r)
	if c.get("requires_event",false):
		return events.values().any(func(e): return e.kind == "dispute" and visible(p,e) and visible(q,e))
	# Reply-only roles need a real invitation, but initiators never require pre-acceptance.
	if c.roles[r.role].get("reply_only",false):
		return not q.current.is_empty() and s.t.rows[q.current.row].get("activity") == r.activity and q.current.target == p.id
	return true

func location(row: String, target: String):
	var r: Dictionary = s.t.rows[row]
	match r.use:
		"conversation":
			var p := person(target)
			return null if p.is_empty() else p.pos
		"object_activity": return objects[target].pos if objects.has(target) else null
		"move_together": return s.posts[links[target].destination].pos if links.has(target) and s.posts.has(links[target].destination) else null
		"event_response": return events[target].pos if events.has(target) else null
		"observe": return focus_position(target)
		"current_task": return s.posts[tasks[target].post].pos if tasks.has(target) and s.posts.has(tasks[target].post) else null
	return s.posts[target].pos if s.posts.has(target) else null

func focus_position(target: String):
	var id := target.substr(target.find(":")+1)
	if target.begins_with("person:"):
		var p := person(id)
		return null if p.is_empty() else p.pos
	if target.begins_with("event:"): return events[id].pos if events.has(id) else null
	return s.posts[id].pos if s.posts.has(id) else null

func visible(p: Dictionary, e: Dictionary) -> bool:
	return e.until > s.clock and p.pos.distance_to(e.pos) <= minf(e.radius,s.t.defaults.sight)

func event_eligible(p: Dictionary, e: Dictionary, c: Dictionary) -> bool:
	if e.kind not in c.events or not visible(p,e): return false
	if c.get("subject",false) != (e.subject == p.id): return false
	if event_action(p,c) == "": return false
	if c.get("unstable",false) and not p.unstable: return false
	return true

func event_action(p: Dictionary, c: Dictionary) -> String:
	if c.actions.has(pose(p)): return c.actions[pose(p)]
	# The action remains standing-only; the common seat rise can prepare it.
	if p.support != "" and c.actions.has("standing"): return c.actions.standing
	return ""

## Physical facts are applied immediately, independently of scored choices.
func emit_event(kind: String, pos: Vector3, subject := "", options: Dictionary = {}) -> String:
	if kind == "" or (subject != "" and person(subject).is_empty()) or not fields(options,["life","radius","salient","posture","can_rise"]):
		s.error = "invalid visible event declaration"
		return ""
	for field in ["life","radius"]:
		if options.has(field) and (not s._number(options[field]) or options[field] <= 0):
			s.error = "invalid event "+field
			return ""
	for field in ["salient","can_rise"]:
		if options.has(field) and not options[field] is bool:
			s.error = "invalid event "+field
			return ""
	if kind == "fall" and options.get("posture","lying") not in s.t.external_facts.fall:
		s.error = "unsupported external fall posture"
		return ""
	s.serial += 1
	var id := "event:"+str(s.serial)
	events[id] = {"id":id,"kind":kind,"pos":pos,"subject":subject,"until":s.clock+options.get("life",s.t.defaults.event_life),"radius":options.get("radius",s.t.defaults.event_radius),"salient":options.get("salient",false)}
	var p := person(subject)
	if not p.is_empty():
		if kind == "fall":
			if not p.current.is_empty(): s._end(p,"interrupted")
			if p.bearing != "":
				s.supports.defer_ground(p,options.get("posture","lying"),options.get("can_rise",true))
				return id
			p.support = ""
			p.place = ""
			p.ground = options.get("posture","lying")
			p.unstable = false
			p.can_rise = options.get("can_rise",true)
			var clip = s.t.external_facts.fall.get(p.ground)
			s._event(p,"external_body",str(clip) if clip != null else "unbound:"+p.ground)
		elif kind == "imbalance": p.unstable = true
	s.next_think = s.clock
	return id

func add_object(id: String, activity: String, pos: Vector3, slots: Dictionary) -> String:
	if objects.has(id) or not s.t.object_activities.has(activity): return "duplicate/unknown object activity"
	var c: Dictionary = s.t.object_activities[activity]
	if not fields(slots,c.roles.keys()): return "unknown object slot role"
	var used: Array = []
	for role in c.roles:
		if not slots.get(role) is Array or slots[role].size() < c.roles[role].minimum: return "missing object role slots"
		for post in slots[role]:
			if not s.posts.has(post) or post in used: return "unknown/duplicate object slot"
			used.append(post)
	objects[id] = {"id":id,"activity":activity,"pos":pos,"slots":slots.duplicate(true),"members":{},"turn":0,"thought":false,"moves":0,"active":false}
	return ""

func add_object_markers(id: String, activity: String, path: String, origin: Vector3, yaw: float, markers: Dictionary) -> String:
	if not s.t.object_activities.has(activity) or not ResourceLoader.exists(path,"PackedScene"): return "invalid object provider"
	var root = load(path).instantiate()
	var new_posts := {}
	var slots := {}
	for role in markers:
		if not s.t.object_activities[activity].roles.has(role) or not markers[role] is Array:
			root.free()
			return "invalid object marker role"
		var action: String = s.t.object_activities[activity].roles[role].action
		slots[role] = []
		for name in markers[role]:
			var marker = root.get_node_or_null(name)
			if not marker is Node3D:
				root.free()
				return "missing object marker: "+str(name)
			var post: String = id+":"+str(name)
			slots[role].append(post)
			new_posts[post] = {"kind":s.t.actions[action].get("post","activity"),"seat":s.t.actions[action].posture == "seated","pos":origin+marker.position.rotated(Vector3.UP,yaw),"yaw":yaw+marker.rotation.y}
	root.free()
	# Validate against a temporary merged view, and commit all posts or none.
	var before: Dictionary = s.posts.duplicate(true)
	s.posts.merge(new_posts)
	var issue := add_object(id,activity,origin,slots)
	if issue != "": s.posts = before
	return issue

func object_available(f: Dictionary, role: String) -> bool:
	var c: Dictionary = s.t.object_activities[f.activity].roles[role]
	if c.has("requires") and not f.active: return false
	return f.members.values().filter(func(m): return m.role == role).size() < f.slots[role].size()

func add_link(id: String, activity: String, roles: Dictionary, destination: String) -> String:
	if links.has(id) or not s.t.journeys.has(activity) or not s.posts.has(destination) or roles.size() != 2: return "invalid journey link"
	var c: Dictionary = s.t.journeys[activity]
	var seen: Array = []
	for actor in roles:
		if not c.roles.has(roles[actor]) or roles[actor] in seen: return "duplicate/unknown journey role"
		seen.append(roles[actor])
		if c.roles[roles[actor]].get("animal",false):
			if not animals.has(actor): return "missing animal participant"
		elif person(actor).is_empty(): return "missing journey participant"
	links[id] = {"id":id,"activity":activity,"actors":roles.keys(),"roles":roles.duplicate(),"destination":destination,"active":false,"done":false,"started":-1.0,"instances":{},"paths":{},"elapsed":0.0}
	return ""

func link_available(l: Dictionary) -> bool:
	if l.done: return false
	for id in l.actors:
		if animals.has(id):
			if not animals[id].get("willing",false): return false
		elif person(id).is_empty(): return false
	return true

func valid(p: Dictionary) -> bool:
	var r: Dictionary = s.t.rows[p.current.row]
	match r.use:
		"conversation": return encounters.has(p.current.get("matched","")) or not person(p.current.target).is_empty()
		"object_activity": return objects.has(p.current.target)
		"move_together": return links.has(p.current.target) and link_available(links[p.current.target])
		"event_response": return events.has(p.current.target) and event_eligible(p,events[p.current.target],config(r))
		"observe": return focus_position(p.current.target) != null
		"current_task": return tasks.has(p.current.target) and task_valid(tasks[p.current.target])
	return s.posts.has(p.current.target)

func work(p: Dictionary, action: String, target := "", extras: Dictionary = {}) -> Dictionary:
	return s.coop.work(p,action,target,extras)

func preview(p: Dictionary, c: Dictionary) -> Dictionary:
	var r: Dictionary = s.t.rows[c.row]
	match r.use:
		"conversation":
			var e: Dictionary = encounters.get(c.get("matched",""),{})
			var role: Dictionary = config(r).roles[r.role]
			if e.is_empty(): return s.coop.waiting(p,role.speak,"")
			var mine: bool = e.actors[e.turn % e.actors.size()] == p.id
			var action: String = role.speak if mine else role.listen
			if not e.active: return s.coop.waiting(p,action,e.points[p.id])
			return work(p,action,e.points[p.id],{"turn":e.generation,"wait":not mine,"encounter":e.id})
		"object_activity":
			var f: Dictionary = objects[c.target]
			var role: Dictionary = config(r).roles[r.role]
			var m: Dictionary = f.members.get(p.id,{})
			if m.is_empty(): return work(p,"pair_wait","",{"wait":true})
			var playing := role.has("requires")
			var order := object_players(f)
			var mine: bool = f.active and not order.is_empty() and order[f.turn % order.size()] == p.id
			var action: String = role.action if playing or (mine and f.thought) else role.wait
			return work(p,action,m.post,{"object":f.id,"turn":f.moves,"thinking":mine and not f.thought,"wait":not playing and not mine})
		"move_together":
			var l: Dictionary = links[c.target]
			var role: Dictionary = config(r).roles[r.role]
			return s.coop.waiting(p,role.action,l.get("points",{}).get(p.id,""))
		"event_response":
			if not events.has(c.target) or not event_eligible(p,events[c.target],config(r)): return {}
			var e: Dictionary = events[c.target]
			var action: String = event_action(p,config(r))
			if config(r).get("rise_after",false) and c.get("rested",false):
				if not p.can_rise: return {}
				action = "get_up_ground"
			var w := work(p,action,"",{"response":true})
			if not w.is_empty() and config(r).get("rise_after",false) and not p.can_rise: w.steps[-1]["wait"] = true
			if not w.is_empty(): w.steps[-1]["focus"] = e.pos
			return w
		"observe":
			var pos = focus_position(c.target)
			if pos == null: return {}
			return work(p,r.action,"",{"focus":pos,"finish":true})
		"transport":
			if p.held == "" or not config(r).has(s.items[p.held].kind): return {}
			return work(p,config(r)[s.items[p.held].kind],c.target,{"finish":true})
		"sequence": return process_work(p,c,r)
		"current_task":
			var task: Dictionary = tasks[c.target]
			if not task_valid(task): return {}
			var definition:=config(r)
			var action: String = definition.actions[int(task.get("action_index",0)) % definition.actions.size()] if definition.has("actions") else definition.action
			var w:=work(p,action,task.post,{"task":c.target,"wait":definition.complete=="arrival" and not definition.has("actions")})
			if not w.is_empty(): w.resources.append("subject:"+definition.subject+":"+task.subject)
			return w
	return {}

func process_work(p: Dictionary, c: Dictionary, r: Dictionary) -> Dictionary:
	var definition := config(r)
	if definition.has("transaction"): return transaction_work(p,c,definition)
	var phase: int = c.get("phase",0)
	if phase >= definition.steps.size(): return {}
	var spec: Dictionary = definition.steps[phase]
	var action: String = spec.action
	var surface: String = s.posts[c.target].get("surface", "")
	var item := ""
	if definition.has("input"):
		if not s.surfaces.has(surface): return {}
		var input: Dictionary = definition.input
		for id in s.surfaces[surface].items:
			if (not input.has("kind") or s.items[id].kind == input.kind) and (not input.get("owned",false) or s.items[id].get("owner") == p.id):
				item = id
				break
		if item == "": return {}
	var effect: String = s.t.actions[action].get("effect","")
	if effect == "deposit" and (not s.surfaces.has(surface) or s.surfaces[surface].items.size() >= s.surfaces[surface].capacity): return {}
	var w := work(p,action,c.target,{"phase":phase})
	if w.is_empty(): return {}
	if effect in ["collect","deposit"]:
		if not s.surfaces.has(surface) or s.posts[c.target].pos.distance_to(s.surfaces[surface].pos) > s.t.defaults.reach: return {}
		w.steps[-1].merge({"item":item,"surface":surface})
		w.resources.append("item:"+item if effect == "collect" else "surface:"+surface)
	return w

func object_players(f: Dictionary) -> Array:
	var role: String = s.t.object_activities[f.activity].turn_role
	var out: Array = f.members.keys().filter(func(id): return f.members[id].role == role)
	out.sort_custom(func(a,b): return f.slots[role].find(f.members[a].post) < f.slots[role].find(f.members[b].post))
	return out

func current_member(id: String, instance: int) -> bool:
	var p := person(id)
	return not p.is_empty() and p.current.get("instance",-1) == instance

func maintain() -> void:
	for task in tasks.values():
		if not task_valid(task): continue
		var definition: Dictionary=s.t.current_tasks[task.profile]
		if definition.complete=="arrival" and person(task.subject).pos.distance_to(s.posts[task.post].pos)<=definition.radius:
			task.done=true
			var p:=person(task.actor)
			if not p.is_empty() and p.current.get("target")==task.id and s.t.rows.get(p.current.get("row",""),{}).get("use")=="current_task": s._end(p,"completed")
	for f in checkouts.values():
		for actor in f.orders.keys():
			var order: Dictionary=f.orders[actor]
			var p:=person(actor)
			if not order.paid and (p.is_empty() or s.posts.get(p.current.get("target",""),{}).get("checkout")!=f.id): f.orders.erase(actor)
	for id in events.keys():
		var e: Dictionary = events[id]
		var p := person(e.subject)
		if not p.is_empty(): e.pos = p.pos
		if e.until <= s.clock: events.erase(id)
	maintain_conversations()
	var ordered: Array = s.people.duplicate()
	ordered.sort_custom(func(a,b): return a.id < b.id)
	for f in objects.values():
		for id in f.members.keys():
			if not current_member(id,f.members[id].instance):
				f.members.erase(id)
				f.thought = false
		for p in ordered:
			if p.current.is_empty() or s.t.rows[p.current.row].get("use") != "object_activity" or p.current.target != f.id or f.members.has(p.id): continue
			var role: String = s.t.rows[p.current.row].role
			for point in f.slots[role]:
				if not f.members.values().any(func(m): return m.post == point):
					f.members[p.id] = {"role":role,"post":point,"instance":p.current.instance,"since":s.clock}
					break
		var players := object_players(f)
		var minimum: int = s.t.object_activities[f.activity].roles[s.t.object_activities[f.activity].turn_role].minimum
		f.active = players.size() >= minimum and players.all(func(id): return person(id).support == f.members[id].post)
		for id in f.members.keys():
			var p := person(id)
			var role: Dictionary = s.t.object_activities[f.activity].roles[f.members[id].role]
			if role.has("requires") and not f.active: s._end(p,"blocked")
			elif not f.active and s.clock-f.members[id].since > s.t.defaults.activity_wait: s._end(p,"blocked")
	for l in links.values():
		if l.active and not journey_valid(l): stop_journey(l,false)
		if not l.active and not l.done:
			var selected: Array = l.actors.filter(func(id): return not person(id).is_empty() and person(id).current.get("target") == l.id)
			if not selected.is_empty() and l.started < 0: l.started = s.clock
			if l.started >= 0 and s.clock-l.started > s.t.defaults.activity_wait:
				for id in selected: s._end(person(id),"blocked")
				l.started = -1.0

func conversation_compatible(p: Dictionary, q: Dictionary) -> bool:
	if q.is_empty() or q.current.is_empty(): return false
	var a: Dictionary = s.t.rows[p.current.row]
	var b: Dictionary = s.t.rows[q.current.row]
	if b.get("use") != "conversation" or b.activity != a.activity: return false
	return b.role in config(a).roles[a.role].partners

func maintain_conversations() -> void:
	for key in encounters.keys():
		var e: Dictionary = encounters[key]
		for id in e.actors.duplicate():
			if not current_member(id,e.instances[id]):
				e.actors.erase(id)
				e.slots.erase(id)
		if e.actors.size() < 2 or s.clock-e.since > (s.t.defaults.activity_demo if e.active else s.t.defaults.activity_wait):
			encounters.erase(key)
			for id in e.actors:
				var p := person(id)
				s._end(p,"completed" if e.active else "blocked")
			continue
		if e.turn >= e.actors.size(): e.turn = 0
	var ordered: Array = s.people.duplicate()
	ordered.sort_custom(func(a,b): return a.id < b.id)
	for p in ordered:
		if p.gone or p.current.is_empty() or s.t.rows[p.current.row].get("use") != "conversation": continue
		if encounters.has(p.current.get("matched","")): continue
		var q := person(p.current.target)
		if not conversation_compatible(p,q):
			if s.clock-p.current.since > s.t.defaults.invite_wait: s._end(p,"blocked")
			continue
		var r: Dictionary = s.t.rows[p.current.row]
		var e: Dictionary = encounters.get(q.current.get("matched",""),{})
		if not e.is_empty():
			if not config(r).get("open_group",false) or e.actors.size() >= config(r).offsets.size(): continue
			# A group is open by declaration; joining does not replace another person's choice.
			join_encounter(e,p)
		elif q.current.target == p.id:
			s.serial += 1
			var id := "conversation:"+str(s.serial)
			e = {"id":id,"activity":r.activity,"actors":[],"instances":{},"points":{},"root":p.pos,"yaw":p.yaw,"turn":0,"generation":0,"active":false,"since":s.clock}
			encounters[id] = e
			join_encounter(e,p)
			join_encounter(e,q)
func live_posts() -> Array:
	var live: Array = []
	for task in tasks.values(): live.append(task.post)
	for e in encounters.values(): live.append_array(e.points.values())
	for l in links.values():
		if not l.done: live.append_array(l.get("points",{}).values())
	return live

func join_encounter(e: Dictionary, p: Dictionary) -> void:
	var c: Dictionary = s.t.conversations[e.activity]
	var index := 0
	while e.get("slots",{}).values().has(index): index += 1
	if index >= c.offsets.size(): return
	if not e.has("slots"): e.slots = {}
	e.slots[p.id] = index
	var offset: Array = c.offsets[index]
	var point: String = e.id+":"+p.id
	var placement := {"pos":e.root+Vector3(offset[0],0,offset[1]).rotated(Vector3.UP,e.yaw),"yaw":e.yaw+deg_to_rad(offset[2])}
	if c.has("layout") and index == 1: placement = s.coop.partner_pose(c.layout,e.root,e.yaw)
	s.posts[point] = {"kind":"conversation","layout":true,"activity_layout":true,"pos":placement.pos,"yaw":placement.yaw}
	e.points[p.id] = point
	e.actors.append(p.id)
	e.instances[p.id] = p.current.instance
	p.current.matched = e.id
	if e.active: e.active = false # new member must actually prepare and arrive

func requests() -> Array:
	var out: Array = []
	for e in encounters.values():
		if not e.active: out.append(group_request(e.id,e.actors,{"kind":"conversation","id":e.id}))
	for l in links.values():
		if l.done or l.active or not link_available(l): continue
		var actors: Array = l.actors.filter(func(id): return not animals.has(id))
		if not actors.all(func(id): return not person(id).current.is_empty() and person(id).current.target == l.id and s.t.rows[person(id).current.row].get("use") == "move_together"): continue
		if not l.has("points"):
			l.points = {}
			for id in actors:
				var point: String = "journey:"+l.id+":"+id
				l.points[id] = point
				# Initial assembly uses actual positions. Shared route starts only after preparations.
				s.posts[point] = {"kind":"journey","layout":true,"activity_layout":true,"pos":person(id).pos}
		out.append(group_request(l.id,actors,{"kind":"journey","id":l.id}))
	return out.filter(func(r): return not r.is_empty())

func group_request(key: String, actors: Array, joint: Dictionary) -> Dictionary:
	var resources: Array = []
	var owners := {}
	var score := INF
	var instances := {}
	for id in actors:
		var p := person(id)
		if p.is_empty() or p.current.is_empty(): return {}
		var w := preview(p,p.current)
		if w.is_empty(): return {}
		instances[id] = p.current.instance
		score = minf(score,s._score(p,p.current.row,p.current.target,false)+p.current.jitter)
		for resource in w.resources+["role:"+id]:
			if resource not in resources: resources.append(resource)
			owners[resource] = id
	joint.instances = instances
	return {"p":person(actors[0]),"c":{"key":key,"score":score},"work":{"resources":resources},"owners":owners,"joint":joint,"controller":self}

func start_joint(j: Dictionary) -> void:
	for id in j.instances:
		if not current_member(id,j.instances[id]): return
	if j.kind == "conversation":
		if not encounters.has(j.id): return
		var e: Dictionary = encounters[j.id]
		for id in e.actors:
			var w := preview(person(id),person(id).current)
			if w.is_empty() or w.steps.size() != 1 or not s._ready(person(id),w.steps[0]): return
		e.active = true
		e.since = s.clock
		for id in e.actors: person(id).body = {}
		return
	var l: Dictionary = links[j.id]
	for id in j.instances:
		var w := preview(person(id),person(id).current)
		if w.is_empty() or w.steps.size() != 1 or not s._ready(person(id),w.steps[0]): return
	start_journey(l,j.instances)

func start_journey(l: Dictionary, instances: Dictionary) -> void:
	var c: Dictionary = s.t.journeys[l.activity]
	var lead := person(l.actors.filter(func(id): return l.roles[id] == c.leader)[0])
	var destination: Vector3 = s.posts[l.destination].pos
	var offset_origin: Vector3 = lead.pos
	l.paths = {}
	for id in l.actors:
		var p: Dictionary = animals[id] if animals.has(id) else person(id)
		if p.pos.distance_to(offset_origin) > c.separation:
			for actor in instances: s._end(person(actor),"blocked")
			return
		var pts: PackedVector3Array = s.planner.call(p.pos,destination+(p.pos-offset_origin))
		if pts.size() < 2:
			s.error = "no shared walking path: "+l.id
			return
		l.paths[id] = s._path(pts)
	l.instances = instances.duplicate()
	l.elapsed = 0.0
	l.active = true
	for id in instances:
		var p := person(id)
		s.serial += 1
		p.body = {"id":s.serial,"group_move":l.id,"step":{"action":c.roles[l.roles[id]].action},"elapsed":0.0,"effect":false}
		s._event(p,"action",p.body.step.action)

func journey_valid(l: Dictionary) -> bool:
	if not link_available(l): return false
	for id in l.instances:
		if not current_member(id,l.instances[id]) or person(id).body.get("group_move") != l.id or not s._ready(person(id),person(id).body.step): return false
	return true

func stop_journey(l: Dictionary, success: bool) -> void:
	l.active = false
	l.done = true
	for id in l.actors:
		if animals.has(id):
			animals[id].moving = false
			continue
		var p := person(id)
		if not p.is_empty() and p.current.get("target") == l.id:
			s._end(p,"completed" if success else "blocked")

func advance(dt: float) -> void:
	# The paid provider owns its output process, independently of buyer body work.
	# A purpose interruption cannot pause a machine or erase its committed order.
	for f in checkouts.values():
		if not f.working: continue
		for actor in f.orders:
			var order: Dictionary=f.orders[actor]
			if not order.paid or order.released or order.collected: continue
			order.output_elapsed=order.get("output_elapsed",0.0)+dt
			if order.output_elapsed<s.t.defaults.hold_demo or order.item not in s.surfaces[f.stock].items or s.surfaces[f.output].items.size()>=s.surfaces[f.output].capacity: continue
			s.surfaces[f.stock].items.erase(order.item)
			s.surfaces[f.output].items.append(order.item)
			order.released=true
			if s.tracing: s.trace.append({"time":s.clock,"person":actor,"event":"transaction","detail":f.id+":release:"+order.item})
	for l in links.values():
		if not l.active: continue
		if not journey_valid(l):
			stop_journey(l,false)
			continue
		l.elapsed += dt
		var length := 0.0
		for path in l.paths.values(): length = maxf(length,path.length)
		var fraction := minf(1.0,l.elapsed*s.t.defaults.speed/maxf(length,0.001))
		var positions := {}
		for id in l.actors: positions[id] = s._at(l.paths[id],fraction*l.paths[id].length)
		var c: Dictionary = s.t.journeys[l.activity]
		if positions[l.actors[0]][0].distance_to(positions[l.actors[1]][0]) > c.separation:
			stop_journey(l,false)
			continue
		for id in l.actors:
			var p: Dictionary = animals[id] if animals.has(id) else person(id)
			p.pos = positions[id][0]
			p.yaw = positions[id][1]
			if animals.has(id): p.moving = true
			else: p.body.elapsed = l.elapsed
		if fraction >= 1.0: stop_journey(l,true)

func completed(p: Dictionary, step: Dictionary) -> void:
	var r: Dictionary = s.t.rows[p.current.row]
	if step.has("task"):
		if s.t.current_tasks[tasks[step.task].profile].complete == "arrival":
			tasks[step.task].action_index = int(tasks[step.task].get("action_index",0))+1
			return # a small waiting gesture does not mean the person arrived
		tasks[step.task].done=true
		s._end(p,"completed")
	elif step.get("finish",false):
		s._end(p,"completed")
	elif step.has("encounter") and encounters.has(step.encounter):
		var e: Dictionary = encounters[step.encounter]
		if step.turn != e.generation: return
		e.turn = (e.turn+1)%e.actors.size()
		e.generation += 1
		s._event(p,"conversation_turn",e.id)
	elif step.has("object") and objects.has(step.object):
		var f: Dictionary = objects[step.object]
		if not f.active or step.turn != f.moves: return
		if step.get("thinking",false): f.thought = true
		elif r.role == config(r).turn_role:
			f.thought = false
			f.turn += 1
			f.moves += 1
			s._event(p,"object_turn",f.id)
	elif step.get("response",false):
		if config(r).get("rise_after",false) and not p.current.get("rested",false) and p.can_rise:
			p.current.rested = true
		else: s._end(p,"completed")
	elif step.has("phase"):
		p.current.phase = step.phase+1
		if p.current.phase >= config(r).steps.size(): s._end(p,"completed")
	s.next_think = s.clock

func ending(_p: Dictionary, _outcome: String) -> void:
	# Membership follows actual current instances in maintain; no delayed callback resurrects it.
	pass

func lines(p: Dictionary) -> PackedStringArray:
	var upper: String = s.t.rows[p.current.row].label
	var lower: String = s.t.actions[p.body.step.action].label if not p.body.is_empty() else "准备中"
	return PackedStringArray([upper]) if upper == lower else PackedStringArray([upper,lower])

## Scene facts create current tasks; neither a row nor a timer invents an appointment.
func add_task(id: String, profile: String, actor: String, subject: String, post := "") -> String:
	if tasks.has(id) or not s.t.get("current_tasks",{}).has(profile) or person(actor).is_empty(): return "invalid current task"
	var c: Dictionary=s.t.current_tasks[profile]
	var origin: Vector3
	if c.subject=="animal":
		if not animals.has(subject): return "missing task animal"
		origin=animals[subject].pos
		post="task:"+id
		s.posts[post]={"kind":"task","layout":true,"pos":origin+Vector3(c.offset[0],c.offset[1],c.offset[2]),"yaw":0.0}
	else:
		if person(subject).is_empty() or actor==subject or not s.posts.has(post): return "missing current wait person/place"
		origin=person(subject).pos
	tasks[id]={"id":id,"profile":profile,"actor":actor,"subject":subject,"post":post,"origin":origin,"active":true,"done":false}
	return ""

func task_valid(task: Dictionary) -> bool:
	if not task.active or task.done or person(task.actor).is_empty() or not s.posts.has(task.post): return false
	var c: Dictionary=s.t.current_tasks[task.profile]
	if c.subject=="person": return not person(task.subject).is_empty()
	var animal: Dictionary=animals.get(task.subject,{})
	return not animal.is_empty() and not animal.get("gone",false) and animal.get("approach_allowed",false) and animal.get("contact_allowed",false) and animal.get("willing",false) and not animal.get("moving",false) and animal.pos.distance_to(task.origin)<=s.t.defaults.arrival

## A checkout exposes finite inventory and explicit per-person payment authorization.
## Its orders survive interrupted body work. Release MOVES an existing item.
func add_checkout(id: String, process: String, post: String, stock: String, output: String, credits: Dictionary, price := 1) -> String:
	if checkouts.has(id) or not s.t.processes.get(process,{}).has("transaction") or not s.posts.has(post) or not s.surfaces.has(stock) or not s.surfaces.has(output) or stock==output or price<=0: return "invalid checkout provider"
	if s.posts[post].has("checkout"): return "checkout post already has provider"
	if s.posts[post].pos.distance_to(s.surfaces[output].pos)>s.t.defaults.reach: return "checkout output out of reach"
	for actor in credits:
		if person(actor).is_empty() or not s._number(credits[actor]) or credits[actor]<0: return "invalid actual payment authorization"
	s.posts[post].checkout=id
	checkouts[id]={"id":id,"process":process,"post":post,"stock":stock,"output":output,"credits":credits.duplicate(true),"price":price,"orders":{},"working":true}
	return ""

func transaction_item(f: Dictionary, p: Dictionary, definition: Dictionary) -> String:
	if f.orders.has(p.id): return f.orders[p.id].item
	for item in s.surfaces[f.stock].items:
		if s.items[item].kind!=definition.transaction.product: continue
		if f.orders.values().any(func(order): return order.item==item and order.paid and not order.collected): continue
		return item
	return ""

func transaction_work(p: Dictionary, c: Dictionary, definition: Dictionary) -> Dictionary:
	var id: String=s.posts.get(c.target,{}).get("checkout","")
	if not checkouts.has(id): return {}
	var f: Dictionary=checkouts[id]
	if not f.working or f.process!=s.t.rows[c.row].process: return {}
	var order: Dictionary=f.orders.get(p.id,{})
	if order.get("collected",false): return {}
	if not order.get("paid",false) and f.credits.get(p.id,0)<f.price: return {}
	if not order.get("paid",false) and not s._held(p,definition.transaction.payment_tool) and s._stored(p,definition.transaction.payment_tool).is_empty(): return {}
	var item:=transaction_item(f,p,definition)
	if item=="": return {}
	var phase:=0 if order.is_empty() else 1 if not order.paid else 2 if not order.released else 3
	var spec: Dictionary=definition.steps[phase]
	if phase==2 and s.surfaces[f.output].items.size()>=s.surfaces[f.output].capacity: return {}
	var w:=work(p,spec.action,c.target,{"transaction":id,"operation":spec.operation,"phase":phase,"item":item,"surface":f.output,"wait":phase==2})
	if not w.is_empty(): w.resources.append_array(["checkout:"+id,"item:"+item])
	return w

func transaction_ready(p: Dictionary, step: Dictionary) -> bool:
	var f: Dictionary=checkouts.get(step.get("transaction",""),{})
	if f.is_empty() or not f.working or p.current.is_empty() or p.current.target!=f.post or s.t.rows[p.current.row].get("process")!=f.process or p.pos.distance_to(s.posts[f.post].pos)>s.t.defaults.arrival: return false
	var item: String=step.get("item","")
	var order: Dictionary=f.orders.get(p.id,{})
	if not order.is_empty() and (order.item!=item or order.collected): return false
	match step.operation:
		"select": return order.is_empty() and item in s.surfaces[f.stock].items and f.credits.get(p.id,0)>=f.price and not f.orders.values().any(func(other):return other.item==item and other.paid)
		"pay": return not order.is_empty() and not order.paid and item in s.surfaces[f.stock].items and f.credits.get(p.id,0)>=f.price
		"release": return order.get("paid",false) and not order.released and item in s.surfaces[f.stock].items and s.surfaces[f.output].items.size()<s.surfaces[f.output].capacity
		"collect": return order.get("paid",false) and order.released and item in s.surfaces[f.output].items
	return false

func commit_transaction(p: Dictionary, step: Dictionary) -> bool:
	if not transaction_ready(p,step): return false
	var f: Dictionary=checkouts[step.transaction]
	match step.operation:
		"select": f.orders[p.id]={"item":step.item,"paid":false,"released":false,"collected":false,"output_elapsed":0.0}
		"pay":
			f.credits[p.id]-=f.price
			f.orders[p.id].paid=true
		"release":
			return false # only provider advance may release; a body timer cannot
		"collect": f.orders[p.id].collected=true
	s._event(p,"transaction",step.transaction+":"+step.operation+":"+step.item)
	return true
