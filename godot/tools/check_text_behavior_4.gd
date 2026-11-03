## Deterministic scenarios using the real selector/allocator/executor.
extends RefCounted
const System := preload("res://npc/text_behavior/system.gd")
var c
var worst_step := 0.0

func expect(ok: bool, message: String) -> void: c.expect(ok,"batch4: "+message)
func fixture(names: Array) -> System:
	var s := System.new()
	var rows := {}
	for name in names:
		rows[name] = s.t.rows[name].duplicate(true)
		rows[name].erase("tags")
	s.t.rows = rows
	s.t.defaults.jitter = 0.0
	s.tracing = true
	s.planner = func(a: Vector3,b: Vector3): return PackedVector3Array([a,b])
	s.posts.goal = {"kind":"waypoint","pos":Vector3(0,0,4),"exclusive":false}
	expect(s.validate() == "","fixture validates: "+s.validate())
	return s

func advance(s: System, seconds: float) -> void:
	var continuous := true
	for i in ceili(seconds*60):
		var before := {}
		var action_before := {}
		for p in s.people: before[p.id] = p.pos
		for p in s.people: action_before[p.id] = p.body.get("step",{}).get("action","")
		s.tick(1.0/60)
		for p in s.people:
			var step: float = p.pos.distance_to(before[p.id])
			worst_step = maxf(worst_step,step)
			var action: String = p.body.get("step",{}).get("action","")
			var limit: float = maxf(s.t.defaults.support_speed,s.t.actions.get(action,{}).get("speed",s.t.defaults.speed))/60+.002
			limit = maxf(limit,s.t.actions.get(action_before[p.id],{}).get("speed",s.t.defaults.speed)/60+.002)
			for d in s.supports.devices.values():
				var radius := 0.0
				for r in s.supports.profile(d).roles.values(): radius = maxf(radius,s.supports.vec(r.anchor).length())
				limit = maxf(limit,(s.supports.profile(d).get("speed",0)+radius*s.t.defaults.support_turn_speed)/60+.002)
			if step > limit:
				continuous = false
	expect(s.error == "","runtime: "+s.error)
	expect(continuous,"no body teleports during sampled transitions")

func device(s: System, kind: String, options: Dictionary = {}) -> Dictionary:
	if s.t.supports[kind].motion == "route": options["destination"] = "goal"
	expect(s.supports.add_device("d",kind,Vector3.ZERO,options) == "","device initialized: "+kind)
	return s.supports.devices.d

func actor(s: System, d: Dictionary, role: String, id := "p") -> Dictionary:
	return s.add_person(id,s.supports.world(d,s.supports.profile(d).roles[role].ground))

func did(s: System, action: String) -> bool:
	return s.trace.any(func(e): return e.event == "action" and e.detail == action)

func run(checker) -> void:
	c = checker
	declarations()
	movers()
	mechanisms()
	interruptions()
	vehicles()
	shared_weight()
	support_conflicts()
	doors()
	connections()
	queued_connection()
	change_probes()
	print("TEXT_BEHAVIOR_SUPPORT_METRICS ",JSON.stringify({"max_body_step":worst_step}))

func declarations() -> void:
	var full := System.new()
	expect(full.error == "","full table validates")
	for bad in ["pose","ground","speed","action","extra"]:
		var t: Dictionary = full.t.duplicate(true)
		match bad:
			"pose": t.supports.bicycle.roles.rider.pose = "standing"
			"ground": t.supports.swing.roles.user.release[1] = 1
			"speed": t.defaults.support_speed = 0
			"action": t.supports.cart.roles.user.action = "missing"
			"extra": t.supports.cart.teleport = true
		expect(System.new(t).error != "","reject malformed support declaration: "+bad)
	var s := fixture(["ride_bicycle"])
	expect(s.supports.add_device("bad","bicycle",Vector3(0,2,0),{"destination":"goal"}) != "","reject unsupported airborne carrier")
	expect(s.supports.add_device("bad","bicycle",Vector3.ZERO,{"destination":"unknown"}) != "","reject missing destination")
	s.planner = func(a: Vector3,b: Vector3): return PackedVector3Array([a,Vector3(0,1,2),b])
	s.supports.route(Vector3.ZERO,Vector3(0,0,4))
	expect(s.error == "support carrier route is not grounded","reject airborne intermediate carrier route before motion")

func movers() -> void:
	for spec in [["push_cart","cart","user"],["push_stroller","stroller","user"],["pull_suitcase","suitcase","user"],["ride_bicycle","bicycle","rider"],["ride_scooter","scooter","rider"]]:
		var s := fixture([spec[0]])
		var d := device(s,spec[1])
		var p := actor(s,d,spec[2])
		s.choose_all()
		advance(s,3.5)
		expect(p.bearing != "" and d.slots.values().has(p.id),"actual occupied support after preparation: "+spec[0])
		expect(did(s,s.t.supports[spec[1]].roles[spec[2]].action),"distinct main action through same driver: "+spec[0])
		advance(s,12)
		expect(d.pos.distance_to(s.posts.goal.pos) < .001 and p.bearing == "" and absf(p.pos.y) < .001,"arrival and grounded unload: "+spec[0])
		expect(s.check_world() == "","world remains consistent: "+s.check_world())
	# Two simultaneous users compete for one actual control/seat, independent of array order.
	for reverse in [false,true]:
		var s := fixture(["ride_bicycle"])
		var d := device(s,"bicycle")
		actor(s,d,"rider","a"); actor(s,d,"rider","b")
		if reverse: s.people.reverse()
		s.choose_all(); advance(s,3.5)
		expect(d.slots.size() == 1 and s.people.filter(func(p): return p.bearing != "").size() == 1,"one rider, atomic seat contention")

func mechanisms() -> void:
	for spec in [["swing_seated","swing"],["slide_seated","slide"],["do_pullups","bar"],["handstand","palms"]]:
		var s := fixture([spec[0]])
		var d := device(s,spec[1])
		var p := actor(s,d,"user")
		s.choose_all(); advance(s,5)
		expect(p.bearing != "" and did(s,s.t.supports[spec[1]].roles.user.action),"supported mechanism runs: "+spec[0])
		advance(s,22)
		expect(p.bearing == "" and d.trips == 1 and absf(p.pos.y) < .001,"mechanism safely returns to ground: "+spec[0])
	var s := fixture(["play_seesaw"])
	var d := device(s,"seesaw")
	var a := actor(s,d,"a","a")
	s.choose_all(); advance(s,4)
	expect(d.slots.is_empty(),"one seesaw participant cannot start a two-body mechanism")
	var b := actor(s,d,"b","b")
	s.choose_all(); advance(s,5)
	expect(d.slots.size() == 2 and did(s,"seesaw_seated") and did(s,"seesaw_partner"),"one row binds both roles without a second selection ticket")
	s.t.rows.play_seesaw.base = 0
	s._end(a,"interrupted")
	advance(s,6)
	expect(a.bearing == "" and b.bearing == "" and d.slots.is_empty(),"one seesaw departure unloads both sides")

func interruptions() -> void:
	for spec in [["push_cart","cart","user"],["push_stroller","stroller","user"],["ride_bicycle","bicycle","rider"],["ride_scooter","scooter","rider"],["swing_seated","swing","user"],["slide_seated","slide","user"],["do_pullups","bar","user"],["handstand","palms","user"]]:
		for at in [.25,2.6,4.5]:
			var s := fixture([spec[0]])
			var d := device(s,spec[1])
			var p := actor(s,d,spec[2])
			s.choose_all(); advance(s,at)
			var actual: Vector3 = p.pos
			var object_pos: Vector3 = d.pos
			s.t.rows[spec[0]].base = 0
			s._end(p,"interrupted")
			expect(p.pos == actual and d.pos == object_pos,"interrupt retains actual positions: "+spec[0])
			advance(s,10)
			expect(p.bearing == "" and d.slots.is_empty() and absf(p.pos.y) < .001 and d.pos == object_pos,"interrupted support unloads; object remains: "+spec[0])
	var s := fixture(["ride_bicycle","idle"])
	s.t.rows.idle.base = 0
	var d := device(s,"bicycle")
	var p := actor(s,d,"rider")
	s.choose_all(); advance(s,3.6)
	s.t.rows.idle.base = 100; s.choose_all()
	expect(p.current.row == "idle" and p.bearing != "","ordinary purpose can win before dismount is finished")
	advance(s,4)
	expect(p.bearing == "" and did(s,"stand_idle"),"ordinary body starts only after safe unload")

func vehicles() -> void:
	for kind in ["car","taxi"]:
		var name := "enter_car" if kind == "car" else "hail_taxi"
		var s := fixture([name,"exit_car"])
		s.posts.pickup = {"kind":"pickup","pos":Vector3(0,0,1),"exclusive":false}
		var d := device(s,kind,{"rider":"p","pickup":"pickup"})
		var p := s.add_person("p",Vector3(.9,0,1))
		s.choose_all(); advance(s,16)
		expect(d.pos == s.posts.goal.pos and d.stops > 0,"actual vehicle moves and stops: "+kind)
		expect(d.trips == 1 and p.bearing == "" and did(s,"support_release"),"same exit action works for private car and taxi")
		if kind == "taxi": expect(did(s,"hail_taxi") and d.get("accepted",false),"taxi response is an actual stop, not a wave result")
	# Interrupt while car is moving: keep its ground position and open the real door before unload.
	var s := fixture(["enter_car"])
	var d := device(s,"car",{"rider":"p"})
	var p := actor(s,d,"passenger")
	s.choose_all(); advance(s,5.5)
	var stopped: Vector3 = d.pos
	s.t.rows.enter_car.base = 0; s._end(p,"interrupted")
	advance(s,4)
	expect(d.pos == stopped and d.pos.y == 0 and p.pos.y == 0 and p.bearing == "","moving car interruption leaves grounded car and passenger")

func shared_weight() -> void:
	for reverse in [false,true]:
		var s := fixture(["assist_person","accept_assistance"])
		var d := device(s,"assistance",{"actors":{"helper":"h","receiver":"r"}})
		var h := actor(s,d,"helper","h")
		var r := actor(s,d,"receiver","r")
		if reverse: s.people.reverse()
		s.choose_all(); advance(s,4)
		expect(d.slots.size() == 2 and did(s,"assist_elder_walk") and did(s,"elder_assisted_walk"),"shared-weight walk requires both chosen roles")
		s.t.rows.assist_person.base = 0; s.t.rows.accept_assistance.base = 0
		s._end(r,"interrupted"); advance(s,2)
		expect(h.bearing == "" and r.bearing == "" and d.slots.is_empty(),"either shared-weight participant can leave safely")
	for consent in [false,true]:
		var s := fixture(["help_fallen","rest_after_fall"])
		var d := device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":consent}})
		var h := actor(s,d,"helper","h")
		var r := actor(s,d,"receiver","r")
		s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"life":30})
		s.choose_all(); advance(s,10)
		expect((r.ground == "standing") == consent,"lifting checks actual fall, selected response and consent")
		if consent: expect(did(s,"help_up") and did(s,"helped_up") and r.can_rise,"generic two-body support commits actual recovery")
		else: expect(d.slots.is_empty(),"no forced recipient body")
	# A fall after the subject has walked must anchor the layout at the actual fall.
	var s := fixture(["help_fallen","rest_after_fall"])
	var d := device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}})
	var h := actor(s,d,"helper","h")
	var r := s.add_person("r",Vector3(0,0,5))
	s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"life":35})
	s.choose_all(); advance(s,12)
	expect(d.pos == Vector3(0,0,5) and d.trips == 1 and r.ground == "standing","live recipient anchors layout; slow arrival does not expire receiving body")
	# Cancelling an incomplete lift lowers the recipient back to their real floor posture.
	s = fixture(["help_fallen","rest_after_fall"])
	d = device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}})
	h = actor(s,d,"helper","h"); r = actor(s,d,"receiver","r")
	s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"life":30})
	s.choose_all(); advance(s,4)
	expect(s.supports.body_state(r).get("owner") == h.id,"load-bearing edge names actual helper")
	s.t.rows.help_fallen.base = 0; s._end(h,"interrupted"); advance(s,2)
	expect(r.ground == "lying" and not r.can_rise and r.bearing == "","cancelled lift never invents completed recovery")
	s = fixture(["help_fallen","rest_after_fall"])
	d = device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}})
	h = actor(s,d,"helper","h"); r = actor(s,d,"receiver","r")
	s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"life":30})
	s.choose_all(); advance(s,4)
	d.willing.receiver = false
	advance(s,2)
	expect(r.ground == "lying" and r.bearing == "" and h.bearing == "","recipient can revoke consent during shared support")
	s = fixture(["help_fallen","rest_after_fall"])
	d = device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}})
	h = actor(s,d,"helper","h"); r = actor(s,d,"receiver","r")
	s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"posture":"ground_seated","life":30})
	s.choose_all()
	expect(h.current.is_empty(),"lying lift profile does not advertise unsupported ground-seated lifting")
	# Another starting pose is one action/profile variant, still the same scored row,
	# allocator, load owner, controller and recovery commit.
	d.enabled = false
	expect(s.supports.add_device("seated","lift_ground_seated",Vector3.ZERO,{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}}) == "","ground-seated support is data, without a new row/template")
	s.choose_all(); advance(s,9)
	expect(r.ground == "standing" and did(s,"helped_up_ground_seated") and s.supports.devices.seated.trips == 1,"same load-transfer code lifts a ground-seated recipient")

func support_conflicts() -> void:
	var s := fixture(["help_fallen","rest_after_fall"])
	var d := device(s,"lift",{"actors":{"helper":"h","receiver":"r"},"willing":{"receiver":true}})
	var h := actor(s,d,"helper","h")
	var r := actor(s,d,"receiver","r")
	s.add_person("h2",Vector3(.6,0,0))
	expect(s.supports.add_device("other","lift",Vector3.ZERO,{"actors":{"helper":"h2","receiver":"r"},"willing":{"receiver":true}}) == "","second independent offer exists")
	# Different approach markers must not bypass the common body claim.
	s.posts[s.supports.port(s.supports.devices.other,"helper")].exclusive = false
	s.posts[s.supports.port(d,"helper")].exclusive = false
	s.activities.emit_event("fall",r.pos,r.id,{"can_rise":false,"life":30})
	s.choose_all(); advance(s,4)
	expect(s.supports.devices.values().filter(func(o): return not o.slots.is_empty()).size() == 1,"same recipient cannot join two support groups in one arbitration")
	expect(s.check_world() == "","support contention preserves one actual body owner")
	# A stale accepted request cannot create occupancy after its actor changes purpose.
	s = fixture(["ride_bicycle"])
	d = device(s,"bicycle")
	var p := actor(s,d,"rider")
	s.choose_all(); advance(s,1.9)
	var stale := {"device":"d","members":{"rider":{"actor":p.id,"instance":p.current.instance}}}
	s.t.rows.ride_bicycle.base = 0; s._end(p,"interrupted")
	s.supports.start_joint(stale)
	expect(d.slots.is_empty() and p.bearing == "","stale readiness cannot resurrect support")
	# New external ground facts unload the old moving support before applying the pose.
	s = fixture(["ride_bicycle"])
	d = device(s,"bicycle"); p = actor(s,d,"rider")
	s.choose_all(); advance(s,3.5)
	var at: Vector3 = p.pos
	s.t.rows.ride_bicycle.base = 0
	s.activities.emit_event("fall",p.pos,p.id,{"can_rise":false})
	expect(p.pos == at and p.bearing != "","new fall does not teleport out of a moving support")
	advance(s,4)
	expect(p.bearing == "" and p.ground == "lying" and not p.can_rise and p.pos.y == 0,"deferred ground fact commits after actual unloading")

func doors() -> void:
	var s := fixture(["stroll","hold_door"])
	s.t.defaults.speed = .5
	s.t.rows.stroll.tags = ["walk"]
	s.t.rows.hold_door.tags = ["hold"]
	var d := device(s,"door")
	var h := s.add_person("h",Vector3(1,0,-.3),"",{},{"walk":0,"hold":1})
	var p := s.add_person("p",Vector3(0,0,-2),"",{},{"walk":1,"hold":0})
	s.choose_all(); advance(s,6.0)
	expect(did(s,"hold_door") and p.current.get("row") == "stroll","door hold and internal passage share live portal facts; walking purpose stays")
	advance(s,9)
	expect(p.pos == s.posts.goal.pos and d.door == 0 and h.bearing == "","passage finishes, holding ends and door closes")
	# Existing walk and run both use the portal interception, without separate rows.
	for name in ["stroll","run"]:
		s = fixture([name])
		d = device(s,"door")
		p = s.add_person("p",Vector3(0,0,-2))
		s.choose_all(); advance(s,10)
		expect(p.pos == s.posts.goal.pos and d.door == 0,"internal pass_door reused by "+name)
	for spec in [["push_cart","cart"],["push_stroller","stroller"]]:
		s = fixture([spec[0]])
		d = device(s,spec[1])
		p = actor(s,d,"user")
		expect(s.supports.add_device("portal","door",Vector3(0,0,2)) == "","portal exists on a coupled route")
		s.choose_all(); advance(s,14)
		expect(d.pos == s.posts.goal.pos and s.supports.devices.portal.door == 0,"coupled driver reuses internal passage: "+spec[0])
	# Manual operation frees real hands through the existing preparation path.
	s = fixture(["stroll"])
	d = device(s,"door")
	s.items.phone = {"kind":"phone"}
	p = s.add_person("p",Vector3(0,0,-2),"phone",{"bag":{"accepts":["phone"],"capacity":1,"items":[]}})
	s.choose_all(); advance(s,11)
	expect(p.pos == s.posts.goal.pos and p.held == "" and p.storage.bag.items == ["phone"] and did(s,"open_fixture"),"manual pass uses actual stow, operation and suspended-route continuation")
	# Unstoreable hands cannot magically actuate a manual portal.
	s = fixture(["stroll"]); d = device(s,"door")
	s.items.box = {"kind":"box"}
	p = s.add_person("p",Vector3(0,0,-2),"box")
	s.choose_all(); advance(s,5)
	expect(d.door == 0 and p.held == "box" and p.pos.z < 0 and not did(s,"open_fixture"),"blocked hands cannot open a door or discard the item")
	# Opening is interruptible; a stale completion cannot finish it afterward.
	s = fixture(["stroll"]); d = device(s,"door")
	p = s.add_person("p",Vector3(0,0,-2))
	s.choose_all(); advance(s,2.0)
	var saved: Dictionary = p.body
	var stopped: Vector3 = p.pos
	s.t.rows.stroll.base = 0; s._end(p,"interrupted")
	expect(not s._effect(p,saved.step,saved),"stale internal operation effect rejected")
	advance(s,3)
	expect(d.door == 0 and p.pos == stopped and p.current.is_empty(),"interrupted opening closes at actual position without resuming the old route")
	# Assembly timeout is not a lifetime cap on a productive long coupled route.
	s = fixture(["push_cart"])
	s.posts.goal.pos = Vector3(0,0,34)
	d = device(s,"cart"); p = actor(s,d,"user")
	s.supports.add_device("portal","door",Vector3(0,0,28))
	s.choose_all(); advance(s,47)
	expect(d.task_done and p.bearing == "" and d.pos == s.posts.goal.pos,"long route can stop, operate and reattach without a universal 24-second purpose timeout")
	# Internal work must keep the original destination claim; continuing a cached
	# walking body after losing that claim caused two actual arrivals in the scan.
	s = fixture(["stroll"]); d = device(s,"door")
	s.posts.goal.exclusive = true
	p = s.add_person("first",Vector3(0,0,-2))
	s.choose_all(); advance(s,2)
	var other := s.add_person("other",Vector3(0,0,3.5))
	s.choose_all()
	expect(s.reserved.get("post:goal") == p.id and other.current.is_empty(),"manual operation retains original exclusive destination claim")
	advance(s,6)
	expect(s.error == "" and p.pos == s.posts.goal.pos and other.pos.z == 3.5,"continued purpose reuses allocator, never a body with an obsolete destination grant")

func connections() -> void:
	for moving in [false,true]:
		var s := fixture(["phone_call","idle"])
		s.t.rows.idle.base = 0
		s.items.phone = {"kind":"phone"}
		var p := s.add_person("p",Vector3.ZERO,"phone",{"bag":{"accepts":["phone"],"capacity":1,"items":[]}})
		expect(s.supports.open_call("call","p","remote", "phone","goal" if moving else "") == "","current explicit call opens")
		s.choose_all(); advance(s,2.5)
		expect(did(s,"walk_phone_call" if moving else "phone_call"),"call uses current destination only when declared")
		s.t.rows.idle.base = 100; s.choose_all(); advance(s,.5)
		expect(s.supports.calls.call.live and p.current.get("row") == "idle","body purpose switch does not hang up")
		s.supports.end_call("call","remote_end")
		expect(not s.supports.calls.call.live and s.supports.targets(p,s.t.rows.phone_call).is_empty(),"real hangup/end removes candidate")
		s.supports.end_call("call")
		expect(s.supports.calls.call.ended == "remote_end","duplicate hangup does not replace terminal result")
	var s := fixture(["phone_call"])
	var p := s.add_person("p",Vector3.ZERO)
	s.choose_all()
	expect(p.current.is_empty(),"no fabricated connection/phone candidate")

func queued_connection() -> void:
	var s := fixture(["buy_stuff","tend_stall"])
	s.t.rows.buy_stuff.tags = ["shopper"]
	s.t.rows.tend_stall.tags = ["seller"]
	s.items = {"fruit":{"kind":"goods"},"fruit2":{"kind":"goods"},"wallet":{"kind":"wallet"},"wallet2":{"kind":"wallet"},"phone":{"kind":"phone"}}
	s.surfaces.counter = {"pos":Vector3(0,0,.6),"capacity":6,"items":["fruit","fruit2"]}
	expect(s.coop.add_stall("stall",{"service":"fruit","posts":{"vendor":"res://types/market_stall.tscn","customer":"res://types/market_stall.tscn","fruitweigh":"res://types/fruit_stand.tscn"},"origin":Vector3.ZERO,"queue":Vector3(0,0,3),"queue_radius":2.0,"exit":Vector3(3,0,3),"surface":"counter","products":[{"item":"fruit","weigh":false,"pack":false},{"item":"fruit2","weigh":false,"pack":false}]}) == "","queue connection uses existing configurable service")
	var p := s.add_person("buyer",Vector3(0,0,3),"",{"bag":{"accepts":["wallet","phone","goods"],"capacity":3,"items":["wallet","phone"]}},{"shopper":1,"seller":0})
	var f: Dictionary = s.coop.stalls.stall
	s.add_person("vendor",s.posts[f.vendor].pos,"",{},{"seller":1,"shopper":0})
	s.add_person("a_first",Vector3(0,0,3),"",{"bag":{"accepts":["wallet","goods"],"capacity":2,"items":["wallet2"]}},{"shopper":1,"seller":0})
	s.supports.open_call("live","buyer","remote")
	s.choose_all(); advance(s,3)
	expect(p.current.get("row") == "buy_stuff" and p.body.get("step",{}).get("action") == "phone_call","same connection work supplies a queue diversion under buying purpose")
	for i in 1800:
		if s.trace.any(func(e): return e.person == p.id and e.event == "action" and e.detail == "choose_item"): break
		s.tick(1.0/60)
	expect(s.supports.calls.live.live and p.body.get("step",{}).get("action") == "choose_item" and p.current.get("row") == "buy_stuff","being called preempts phone body without hanging up or losing buying purpose")
	s.supports.end_call("live","remote_end")
	expect(p.current.get("row") == "buy_stuff","remote hangup does not cancel service work")
	advance(s,18)
	expect(did(s,"give_item") and p.held != "" and s.items[p.held].kind == "goods" and s.check_world() == "","existing transaction still completes with finite inventory after call diversion")

func change_probes() -> void:
	# Same existing action/row; only one shared default changes dismount duration.
	for speed in [.4,1.6]:
		var s := fixture(["ride_bicycle"])
		s.t.defaults.support_speed = speed
		var d := device(s,"bicycle")
		var p := actor(s,d,"rider")
		s.choose_all(); advance(s,4)
		s.t.rows.ride_bicycle.base = 0; s._end(p,"interrupted")
		advance(s,.5)
		expect((p.bearing != "") == (speed < 1),"one common speed controls physical unload duration")
	# Existing invitation rule mutation still changes results without editing rows.
	for distance in [1.0,3.0]:
		var s := fixture(["handshake"])
		s.t.defaults.invite_range = distance
		s.add_person("a",Vector3.ZERO); s.add_person("b",Vector3(0,0,2))
		s.choose_all()
		expect(s.people[0].current.is_empty() == (distance < 2),"old handshake invitation mutation remains local")
	# One old shared walking-speed field changes both work duration and displacement.
	for speed in [.7,2.6]:
		var s := fixture(["stroll"])
		s.t.defaults.speed = speed
		var p := s.add_person("p",Vector3.ZERO)
		s.choose_all(); advance(s,1)
		expect(absf(p.pos.z-speed) < .03,"old walk default mutation does not rewrite any row")
	# A hypothetical unbound source can allow seated reading; material permission
	# needs both a pose change and removal of the standing-only source binding.
	for allowed in [false,true]:
		var s := fixture(["read_book"])
		if allowed: s.t.actions.read_book.posture = "any"; s.t.actions.read_book.clip = null
		s.posts.seat = {"kind":"sit","pos":Vector3.ZERO}
		s.items.book = {"kind":"book"}
		var p := s.add_person("p",Vector3.ZERO,"book")
		p.support = "seat"
		s.choose_all(); advance(s,2.2)
		expect((p.support != "") == allowed,"old action posture change stays within one declaration")
	# Rotate/translate a fixture's complete frame through scene data only.
	var s := fixture(["push_cart"])
	var d := device(s,"cart",{"yaw":PI/2})
	var p := actor(s,d,"user")
	s.choose_all(); advance(s,4)
	expect(s.supports.body_state(p).owner == "ground" and s.supports.body_state(p).drives,"pusher is ground-supported and drives object, rather than being carried")
	advance(s,10)
	expect(d.pos == s.posts.goal.pos and p.bearing == "","rotated fixture reuses approach, frame motion and unloading")
