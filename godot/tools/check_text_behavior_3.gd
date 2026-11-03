## Batch-three deterministic mechanisms and authoring-change probes.
extends RefCounted
const System := preload("res://npc/text_behavior/system.gd")
var c

func expect(ok: bool, message: String) -> void:
	c.expect(ok,"batch3: "+message)

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
	expect(s.validate() == "","fixture validates: "+s.validate())
	return s

func advance(s: System, seconds: float) -> void:
	for i in ceili(seconds*60): s.tick(1.0/60)
	expect(s.error == "","runtime: "+s.error)

func did(s: System, event: String, detail := "") -> bool:
	return s.trace.any(func(e): return e.event == event and (detail == "" or e.detail == detail))

func run(checker) -> void:
	c = checker
	declarations_and_cost()
	conversations()
	cross_invitations()
	moving_focus()
	object_activities()
	journeys()
	event_responses()
	central_group_grants()
	processes_and_transport()
	exchanges()
	change_probes()

func declarations_and_cost() -> void:
	var full := System.new()
	expect(full.error == "","full catalog validates")
	for id in full.t.rows:
		var original: Dictionary = full.t.rows[id]
		if not original.get("enabled",true):
			expect(original.get("note","") != "","disabled row explains missing capability: "+id)
			continue
		var data: Dictionary = full.t.duplicate(true)
		data.rows.erase(id)
		var before := data.duplicate(true)
		data.rows[id] = original.duplicate(true)
		expect(System.new(data).error == "","row can be added against shared declarations: "+id)
		data.rows.erase(id)
		expect(data == before,"adding row changes nothing else: "+id)
	for name in ["conversation","object_activity","move_together","event_response","sequence","transport"]:
		var data: Dictionary = full.t.duplicate(true)
		var r: Dictionary = data.rows.values().filter(func(x): return x.get("use") == name)[0]
		var field: String = full.activities.TEMPLATES[name].field
		r[field] = "typo"
		expect(System.new(data).error != "","unknown template reference rejected: "+name)
	var data: Dictionary = full.t.duplicate(true)
	data.conversations.chat.roles.peer.speak = "typo"
	expect(System.new(data).error != "","unknown conversation action rejected")
	expect(full.t.actions.read_book.posture == "standing","standing book source never advertised as seated")
	expect(full.t.actions.interview_question.tool == "microphone","interview binds actual microphone")
	expect(full.t.actions.sit_sideways.clip == null,"misnamed reclining source not advertised as sideways")
	expect(full.binding("pair_wait","wallet") == null,"no empty source used for wallet waiting")
	expect(full.t.rows.adjust_clothes.enabled == false and full.t.rows.help_fallen.get("use") == "support_use","inventory default stays off; help now requires the shared support template")
	for variant in ["role","leader","step","extra","post","effect"]:
		data = full.t.duplicate(true)
		match variant:
			"role": data.conversations.chat.roles.peer.partners = ["typo"]
			"leader": data.journeys.child.leader = "typo"
			"step": data.processes.withdraw_cash.steps[0].action = "typo"
			"extra": data.responses.startle.typo = true
			"post": data.rows.post_letter.target = "post:wrong"
			"effect": data.actions.post_letter.mode = "hold"
		expect(System.new(data).error != "","reject bad shared declaration: "+variant)
	var bad := fixture(["react_startle"])
	bad.activities.emit_event("noise",Vector3.ZERO,"",{"radius":-1})
	expect(bad.error != "","invalid event radius fails rather than silently expiring")

func conversations() -> void:
	for name in ["chat","whisper","argue"]:
		var s := fixture([name])
		var a := s.add_person("a",Vector3.ZERO)
		var b := s.add_person("b",Vector3(0,0,1))
		if name == "argue": s.activities.emit_event("dispute",Vector3.ZERO,"",{"life":40,"salient":true})
		s.choose_all()
		advance(s,9)
		expect(did(s,"conversation_turn"),"sustained turn-taking: "+name)
		expect(not a.current.is_empty() and not b.current.is_empty(),"turn completion is not activity completion: "+name)
		var old_body: Dictionary = a.body.duplicate(true)
		s._end(a,"interrupted")
		s.maintain()
		expect(b.current.is_empty() and s.activities.encounters.is_empty(),"either participant may leave: "+name)
		if old_body.has("id"): expect(not s._effect(a,old_body.step,old_body),"stale conversation callback rejected")
	# Three participants form a single object-free encounter; one can leave while two continue.
	var s := fixture(["chat"])
	var a := s.add_person("a",Vector3.ZERO)
	var b := s.add_person("b",Vector3(0,0,0.9))
	s.choose_all()
	advance(s,2)
	var third := s.add_person("c",Vector3(0.8,0,0.45))
	s.choose_all()
	advance(s,4)
	expect(s.activities.encounters.size() == 1 and s.activities.encounters.values()[0].actors.size() == 3,"third participant joins one open encounter")
	s._end(third,"interrupted")
	s.maintain()
	expect(not a.current.is_empty() and not b.current.is_empty(),"two continue after third leaves")
	# Reply role is not available before an invitation; reporter requires the real tool.
	s = fixture(["interview","answer_interview"])
	s.items = {"mic":{"kind":"microphone"}}
	a = s.add_person("reporter",Vector3.ZERO,"mic")
	b = s.add_person("respondent",Vector3(0,0,0.9))
	expect(s.activities.targets(b,s.t.rows.answer_interview).is_empty(),"answer needs actual inquiry")
	s.choose_all()
	advance(s,10)
	expect(did(s,"action","interview_question") and did(s,"action","interview_answer"),"same conversation template expresses asymmetric interview")
	expect(a.held == "mic" and b.held == "","interview never invents/removes microphone")
	# No reply is bounded, with shared cooldown rather than mutual waiting forever.
	s = fixture(["chat"])
	a = s.add_person("a",Vector3.ZERO)
	b = s.add_person("b",Vector3(0,0,1))
	s.t.rows.chat.tags = ["talk"]
	a.tags.talk = 1.0
	b.tags.talk = 0.0
	s.choose_all()
	advance(s,10)
	expect(a.current.is_empty() and a.done.has("chat@b"),"unanswered invitation ends and cools down")

func chess_fixture(reverse := false) -> System:
	var s := fixture(["play_chess","watch_chess"])
	s.posts = {"a":{"kind":"chess","seat":true,"pos":Vector3.ZERO},"b":{"kind":"chess","seat":true,"pos":Vector3(0,0,1.5)},"w":{"kind":"watch","pos":Vector3(1,0,0.75)}}
	expect(s.activities.add_object("table","chess",Vector3(0,0,0.75),{"play":["a","b"],"watch":["w"]}) == "","object configured by role slots")
	s.t.rows.play_chess.tags = ["play"]
	s.t.rows.watch_chess.tags = ["watch"]
	for id in (["b","a"] if reverse else ["a","b"]): s.add_person(id,s.posts[id].pos,"",{},{"play":1.0,"watch":0.0})
	s.add_person("observer",Vector3(2,0,0),"",{},{"play":0.0,"watch":1.0})
	return s

func cross_invitations() -> void:
	var outcomes: Array = []
	for reverse in [false,true]:
		var s := fixture(["chat","whisper"])
		for id in (["b","a"] if reverse else ["a","b"]): s.add_person(id,Vector3.ZERO if id == "a" else Vector3(0,0,1))
		# Reproduce the scan's incompatible simultaneous starting choices, independent of RNG.
		for id in ["a","b"]:
			var p := s.coop.person(id)
			var row: String = "chat" if id == "a" else "whisper"
			s.serial += 1
			p.current = {"row":row,"target":"b" if id == "a" else "a","key":row+"@"+("b" if id == "a" else "a"),"instance":s.serial,"since":0.0,"jitter":0.0}
		s.choose_all()
		advance(s,10)
		expect(did(s,"conversation_turn"),"conflicting reciprocal invitations resolve and actually converse")
		outcomes.append(s.coop.person("a").current.get("row",""))
		expect(s.trace.filter(func(e): return e.event == "start").size() <= 2,"reciprocal invitations do not swap every decision")
	expect(outcomes[0] == outcomes[1],"same invitation wins in reversed person order")
	var s := fixture(["chat"])
	for id in ["a","b","c"]: s.add_person(id,Vector3(0,0,["a","b","c"].find(id)*0.6))
	for i in 3:
		var p: Dictionary = s.people[i]
		var target: String = s.people[(i+1)%3].id
		s.serial += 1
		p.current = {"row":"chat","target":target,"key":"chat@"+target,"instance":s.serial,"since":0.0,"jitter":0.0}
	s.choose_all()
	advance(s,10)
	expect(did(s,"conversation_turn") and s.activities.encounters.size() == 1,"three-way invitation cycle becomes one conversation instead of reversing forever")

func moving_focus() -> void:
	var s := fixture(["take_photo"])
	s.items.camera = {"kind":"camera"}
	var a := s.add_person("photographer",Vector3.ZERO,"camera")
	var b := s.add_person("subject",Vector3(0,0,2))
	s.choose_all()
	for i in 180:
		b.pos.x += 0.001
		s.tick(1.0/60)
	expect(a.result.get("outcome") == "completed" and did(s,"action","take_photo"),"moving focus updates facing without resetting action progress")
	s = fixture(["film_phone"])
	s.items.phone = {"kind":"phone"}
	a = s.add_person("filmer",Vector3.ZERO,"phone")
	b = s.add_person("subject",Vector3(0,0,2))
	s.choose_all()
	advance(s,0.3)
	var old: Dictionary = a.body.duplicate(true)
	b.gone = true
	advance(s,0.2)
	expect(a.current.is_empty() and not s._effect(a,old.step,old),"same observation template stops filming a vanished focus")

func object_activities() -> void:
	var states: Array = []
	for reverse in [false,true]:
		var s := chess_fixture(reverse)
		s.choose_all()
		advance(s,14)
		var f: Dictionary = s.activities.objects.table
		expect(f.moves >= 2 and did(s,"action","chess_move"),"turns are committed by object")
		expect(did(s,"action","chess_watch"),"observer uses same object activity template")
		states.append([f.moves,f.turn,f.members.a.post,f.members.b.post])
		var observer := s.coop.person("observer")
		s._end(s.coop.person("a"),"interrupted")
		s.coop.person("a").tags.play = 0.0
		s.maintain()
		expect(not f.active and observer.current.is_empty(),"object notices departed player and ends watching")
		advance(s,26)
		expect(s.coop.person("b").current.is_empty(),"one player cannot wait indefinitely")
	expect(states[0] == states[1],"player array order does not own the game or change turn sequence")
	# Another object/config identity uses the identical mechanism, with no chess-name branch.
	var s := chess_fixture()
	var f: Dictionary = s.activities.objects.table
	s.activities.objects.erase("table")
	f.id = "other_table"
	s.activities.objects.other_table = f
	s.choose_all()
	advance(s,10)
	expect(f.moves > 0,"second object identity needs no engine edits")

func journeys() -> void:
	var s := fixture(["walk_with_child","follow_adult"])
	s.posts.goal = {"kind":"destination","pos":Vector3(0,0,8),"exclusive":false}
	var a := s.add_person("adult",Vector3.ZERO)
	var b := s.add_person("child",Vector3(0.6,0,0))
	expect(s.activities.add_link("walk","child",{"adult":"adult","child":"child"},"goal") == "","shared child route configured")
	s.choose_all()
	advance(s,3)
	expect(a.pos.z > 1 and b.pos.z > 1 and absf(a.pos.z-b.pos.z) < 0.01,"both independently willing actors move on one progress")
	var old: Dictionary = a.body.duplicate(true)
	var before: Vector3 = b.pos
	s._end(a,"interrupted")
	s.maintain()
	advance(s,1)
	expect(b.pos == before and b.current.is_empty(),"leaving stops dependent travel without teleporting")
	expect(not s._effect(a,old.step,old),"old shared movement cannot submit")
	s = fixture(["walk_dog"])
	s.posts.goal = {"kind":"destination","pos":Vector3(0,0,6),"exclusive":false}
	s.items.leash = {"kind":"leash"}
	a = s.add_person("walker",Vector3.ZERO,"leash")
	s.activities.animals.dog = {"pos":Vector3(0.8,0,0),"willing":true,"moving":false}
	expect(s.activities.add_link("dog_walk","dog",{"walker":"walker","dog":"dog"},"goal") == "","animal adapter supplies separate participant")
	s.choose_all()
	advance(s,3)
	expect(a.pos.z > 1 and s.activities.animals.dog.pos.z > 1,"same travel template moves human and dog state")
	s.activities.animals.dog.willing = false
	var stop: Vector3 = a.pos
	advance(s,1)
	expect(a.pos == stop and a.current.is_empty() and not s.activities.animals.dog.moving,"dog departure stops human without inventing animal animation")
	# Full arrival uses actual paths and succeeds together.
	s = fixture(["walk_with_child","follow_adult"])
	s.posts.goal = {"kind":"destination","pos":Vector3(0,0,3),"exclusive":false}
	a = s.add_person("adult",Vector3.ZERO)
	b = s.add_person("child",Vector3(0.6,0,0))
	s.activities.add_link("walk","child",{"child":"child","adult":"adult"},"goal")
	s.choose_all()
	advance(s,7)
	expect(a.result.get("outcome") == "completed" and b.result.get("outcome") == "completed" and a.pos.z == 3 and b.pos.z == 3,"shared arrival commits both successes once")
	s = fixture(["walk_with_child","follow_adult"])
	s.posts.goal = {"kind":"destination","pos":Vector3(0,0,3),"exclusive":false}
	a = s.add_person("adult",Vector3.ZERO)
	b = s.add_person("child",Vector3(0.6,0,0),"",{},{"respond":0.0})
	s.t.rows.follow_adult.tags = ["respond"]
	a.tags.respond = 0.0
	s.activities.add_link("walk","child",{"adult":"adult","child":"child"},"goal")
	s.choose_all()
	advance(s,26)
	expect(a.pos == Vector3.ZERO and b.pos.z == 0 and a.done.has("walk_with_child@walk"),"unwilling partner is never moved and invitation times out")

func event_responses() -> void:
	var s := fixture(["react_startle","protect_self","recover_balance","rest_after_fall","watch_event"])
	var a := s.add_person("fallen",Vector3.ZERO)
	var b := s.add_person("witness",Vector3(1,0,0))
	var far := s.add_person("far",Vector3(20,0,0))
	s.choose_all()
	expect(a.current.is_empty() and b.current.is_empty(),"no event means no high-scored reaction")
	var event: String = s.activities.emit_event("fall",a.pos,a.id,{"life":20})
	expect(a.ground == "lying" and a.support == "","external fall is a physical fact before choice")
	s.choose_all()
	advance(s,2.2)
	expect(did(s,"action","startle") and far.current.is_empty(),"only visible witnesses react")
	expect(did(s,"action","lie_ground_hold"),"fallen subject rests in actual lying posture")
	advance(s,5)
	expect(a.ground == "standing" and did(s,"effect","get_up_ground"),"rest then explicit single-person ground recovery")
	expect(b.done.has("react_startle@"+event),"one reaction per occurrence binding")
	s.activities.emit_event("imbalance",b.pos,b.id)
	s.choose_all()
	advance(s,3)
	expect(not b.unstable and did(s,"effect","stumble"),"imbalance uses event response and clears actual instability")
	s.activities.emit_event("threat",b.pos)
	s.choose_all()
	advance(s,3)
	expect(did(s,"action","recoil"),"same event template handles protection")
	# Cannot self-rise: remain physically down; never borrow stand_up from a chair.
	s = fixture(["rest_after_fall"])
	a = s.add_person("down",Vector3.ZERO)
	s.activities.emit_event("fall",a.pos,a.id,{"can_rise":false,"posture":"ground_seated"})
	s.choose_all()
	advance(s,8)
	expect(a.ground == "ground_seated" and not did(s,"effect","stand_up") and not did(s,"effect","get_up_ground"),"no invented shared body support or self recovery")
	# Event expiry terminates watching without maintaining an invisible event memory.
	s = fixture(["watch_event"])
	a = s.add_person("watcher",Vector3.ZERO)
	s.activities.emit_event("dispute",Vector3(0,0,1),"",{"life":1,"salient":true})
	s.choose_all()
	advance(s,2)
	expect(a.current.is_empty() and s.activities.events.is_empty(),"expired focus stops ongoing watch")
	# Ground preparations with an existing object never use a chair rise or silently drop it.
	s = fixture(["rest_after_fall"])
	s.items.phone = {"kind":"phone"}
	a = s.add_person("down",Vector3.ZERO,"phone",{"bag":{"accepts":["phone"],"capacity":1,"items":[]}})
	s.activities.emit_event("fall",a.pos,a.id,{"life":20})
	s.choose_all()
	advance(s,10)
	expect(a.ground == "standing" and a.held == "" and a.storage.bag.items == ["phone"],"ground preparation stows real held object before recovery")
	s = fixture(["react_startle"])
	s.posts.seat = {"kind":"sit","pos":Vector3.ZERO}
	a = s.add_person("seated",Vector3.ZERO)
	a.support = "seat"
	s.activities.emit_event("noise",Vector3(0,0,1))
	s.choose_all()
	advance(s,5)
	expect(did(s,"effect","stand_up") and did(s,"action","startle"),"event response shares seat preparation without claiming a seated startle clip")

func central_group_grants() -> void:
	var s := fixture(["chat","read_notice"])
	s.t.rows.chat.tags = ["talk"]
	s.t.rows.read_notice.tags = ["notice"]
	s.t.rows.read_notice.base = 10.0
	s.posts.notice = {"kind":"notice","pos":Vector3.ZERO}
	s.add_person("a",Vector3.ZERO,"",{},{"talk":1.0,"notice":0.0})
	s.add_person("b",Vector3(0,0,1),"",{},{"talk":1.0,"notice":0.0})
	s.add_person("reader",Vector3(0,0,2),"",{},{"talk":0.0,"notice":1.0})
	s.choose_all()
	advance(s,2)
	expect(s.reserved.get("post:notice") == "reader","higher ordinary facility wins common allocator")
	expect(not s.reserved.keys().any(func(k): return k.begins_with("post:conversation:")),"failed group does not reserve another member's slot")
	advance(s,26)
	expect(s.activities.encounters.is_empty(),"unreachable matched preparation ends rather than mutually waiting forever")
	s = fixture(["handshake","read_notice"])
	s.t.rows.handshake.tags = ["talk"]
	s.t.rows.read_notice.tags = ["notice"]
	s.t.rows.read_notice.base = 10.0
	s.posts.notice = {"kind":"notice","pos":Vector3.ZERO}
	s.add_person("a",Vector3.ZERO,"",{},{"talk":1.0,"notice":0.0})
	s.add_person("b",Vector3(0,0,1),"",{},{"talk":1.0,"notice":0.0})
	s.add_person("reader",Vector3(0,0,2),"",{},{"talk":0.0,"notice":1.0})
	s.choose_all()
	advance(s,26)
	expect(s.coop.pairs.is_empty() and s.coop.person("a").done.has("handshake@b"),"matched pair blockage also times out and cools down")

func processes_and_transport() -> void:
	for name in ["collect_parcel","withdraw_cash","pick_up_object"]:
		var s := fixture([name])
		var kind: String = s.t.processes[name].input.get("kind","goods")
		var post: String = s.t.rows[name].target.trim_prefix("post:")
		s.posts.target = {"kind":post,"pos":Vector3(0,0,1),"surface":"source"}
		s.surfaces.source = {"pos":Vector3(0,0,1),"items":["item"],"capacity":1}
		s.items.item = {"kind":kind,"owner":"a"}
		var a := s.add_person("a",Vector3.ZERO)
		s.choose_all()
		advance(s,8)
		expect(a.held == "item" and s.surfaces.source.items.is_empty() and s.check_world() == "","finite real-item process: "+name)
		var effects: Array = s.trace.filter(func(e): return e.event == "effect" and e.detail == s.t.processes[name].steps[-1].action)
		expect(effects.size() == 1,"collection commits once: "+name)
	# Real deposit, interrupted before commit and then resumed as a new attempt.
	var s := fixture(["post_letter"])
	s.posts.mail = {"kind":"mail","pos":Vector3.ZERO,"surface":"box"}
	s.surfaces.box = {"pos":Vector3.ZERO,"items":[],"capacity":2}
	s.items.letter = {"kind":"envelope"}
	var a := s.add_person("a",Vector3.ZERO,"letter")
	s.choose_all()
	advance(s,0.5)
	var old: Dictionary = a.body.duplicate(true)
	s._end(a,"interrupted")
	expect(not s._effect(a,old.step,old) and a.held == "letter" and s.surfaces.box.items.is_empty(),"interrupted deposit never consumes the letter")
	s.choose_all()
	advance(s,3)
	expect(a.held == "" and s.surfaces.box.items == ["letter"],"deposit moves real object to destination")
	# One carrying row supports different item-conditioned motion actions.
	for kind in ["box","bag"]:
		s = fixture(["carry_to_place"])
		s.posts.goal = {"kind":"destination","pos":Vector3(0,0,2),"exclusive":false}
		s.items.item = {"kind":kind}
		a = s.add_person("a",Vector3.ZERO,"item")
		s.choose_all()
		advance(s,3)
		expect(a.pos.z == 2 and a.held == "item" and did(s,"action",s.t.transports.carried[kind]),"single carrying candidate selects correct item branch: "+kind)
	s = fixture(["walk_with_umbrella"])
	s.posts.goal = {"kind":"destination","pos":Vector3(0,0,2),"exclusive":false}
	s.items.umbrella = {"kind":"open_umbrella"}
	a = s.add_person("a",Vector3.ZERO,"umbrella")
	s.choose_all()
	advance(s,3)
	expect(a.pos.z == 2 and a.held == "umbrella" and did(s,"action","walk_umbrella"),"second transport behavior shares mechanism while keeping its clip gap")
	# Shared posture transition also serves ordinary voluntary ground rest.
	s = fixture(["sit_on_ground"])
	s.posts.ground = {"kind":"ground","pos":Vector3.ZERO}
	a = s.add_person("a",Vector3.ZERO)
	s.choose_all()
	advance(s,7)
	expect(a.ground == "ground_seated" and did(s,"effect","sit_ground"),"ground rest establishes real posture rather than standing hold")

func exchanges() -> void:
	var s := fixture(["give_object","receive_object"])
	s.items.book = {"kind":"book"}
	var a := s.add_person("a",Vector3.ZERO,"book")
	var b := s.add_person("b",Vector3(-0.28,0,0.94))
	expect(s.coop.add_intent("gift","a","b","book","gift") == "","explicit current transfer intent")
	s.choose_all()
	advance(s,1)
	var saved: Dictionary = s.coop.joints.values()[0] if not s.coop.joints.is_empty() else {}
	advance(s,5)
	expect(a.held == "" and b.held == "book" and s.coop.intents.gift.done,"pair_once transfers actual specified item with asymmetric rows")
	expect(a.result.get("outcome") == "completed" and b.result.get("outcome") == "completed","both transfer purposes finish once")
	if not saved.is_empty(): expect(not s.coop.commit_joint(saved),"old transfer callback cannot duplicate object")
	expect(s.check_world() == "","transfer preserves unique object location")

func change_probes() -> void:
	# One global edit changes discovery for the existing handshake template.
	var s := fixture(["handshake"])
	var a := s.add_person("a",Vector3.ZERO)
	s.add_person("b",Vector3(0,0,2))
	s.t.defaults.invite_range = 1.0
	expect(s.coop.targets(a,s.t.rows.handshake).is_empty(),"one range edit tightens handshake")
	s.t.defaults.invite_range = 2.5
	expect(s.coop.targets(a,s.t.rows.handshake).size() == 1,"one range edit expands handshake")
	# Shared demonstration duration changes every new ordinary hold without row copies.
	s = fixture(["read_newspaper"])
	s.t.defaults.hold_demo = 0.5
	s.items.paper = {"kind":"newspaper"}
	a = s.add_person("reader",Vector3.ZERO,"paper")
	s.choose_all()
	advance(s,0.7)
	expect(a.result.get("outcome") == "completed","one shared duration edit propagates")
	# A posture requirement change uses existing seat preparation, no row edits.
	s = fixture(["read_book"])
	s.posts.seat = {"kind":"sit","pos":Vector3.ZERO}
	s.items.book = {"kind":"book"}
	a = s.add_person("reader",Vector3.ZERO,"book")
	a.support = "seat"
	s.t.actions.read_book.posture = "any"
	s.t.actions.read_book.clip = null # a hypothetical unbound sitting version, never the standing source
	s.choose_all()
	advance(s,0.2)
	expect(a.support == "seat" and a.body.step.action == "read_book","unbound permissive posture probe stays seated")
	s._end(a,"interrupted")
	s.t.actions.read_book.posture = "standing"
	s.choose_all()
	advance(s,2.3)
	expect(a.support == "" and did(s,"action","stand_up"),"single action constraint changes every referencing row")
	var positions: Array = []
	for name in ["run","jog"]:
		s = fixture([name])
		s.posts.goal = {"kind":"waypoint","pos":Vector3(0,0,10),"exclusive":false}
		a = s.add_person("mover",Vector3.ZERO)
		s.choose_all()
		advance(s,1)
		positions.append(a.pos.z)
	expect(positions[0] > positions[1] and positions[1] > 1.3,"ordinary movement actions use distinct declared speeds")
