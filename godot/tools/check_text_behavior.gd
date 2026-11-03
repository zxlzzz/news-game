## Deterministic integration checks of the actual executor. No game window.
extends SceneTree
const System := preload("res://npc/text_behavior/system.gd")
var failures: Array[String] = []
var count := 0

func expect(ok: bool, message: String) -> void:
	count += 1
	if not ok: failures.append(message)

func fixture(rows: Dictionary) -> System:
	var s := System.new()
	s.t.rows = rows.duplicate(true)
	s.t.defaults.jitter = 0.0
	s.tracing = true
	s.planner = func(a: Vector3, b: Vector3): return PackedVector3Array([a,b])
	s.error = s.validate()
	expect(s.error == "", "fixture declaration: " + s.error)
	return s

func run_for(s: System, seconds: float) -> void:
	for i in ceili(seconds * 60): s.tick(1.0/60)
	expect(s.error == "", "runtime: " + s.error)

func did(s: System, event: String, detail: String) -> bool:
	return s.trace.any(func(e): return e.event == event and e.detail == detail)

func book_storage(ids: Array = ["book"]) -> Dictionary:
	return {"bag":{"accepts":["phone", "book"], "capacity":2, "items":ids}}

func _initialize() -> void:
	call_deferred("checks")

func checks() -> void:
	declarations()
	preparation_and_interrupts()
	interrupt_each_phase()
	fidget_pool()
	selection()
	arbitration()
	pass_through_seat()
	book_addition()
	load("res://tools/check_text_behavior_2.gd").new().run(self)
	load("res://tools/check_text_behavior_3.gd").new().run(self)
	load("res://tools/check_text_behavior_4.gd").new().run(self)
	load("res://tools/check_text_behavior_5.gd").new().run(self)
	await scene_check()
	for f in failures: printerr("TEXT_BEHAVIOR_FAIL: " + f)
	if failures.is_empty(): print("TEXT_BEHAVIOR_OK (%d assertions)" % count)
	quit(0 if failures.is_empty() else 1)

func declarations() -> void:
	var original := System.new()
	expect(original.error == "", "real table validates")
	var variants := [
		{"base":1,"action":"typo"},
		{"base":1,"action":"stand_idle","when":"standng"},
		{"base":1,"action":"read_notice","use":"go_use"},
		{"base":1,"action":"read_book","use":"use_tool"},
		{"base":{"else":1,"invited":6},"action":"stand_idle"},
		{"base":1,"action":"stand_idle","use":"magic"},
		{"base":1,"action":"stand_idle","when":"held()"},
		{"base":1,"action":"stand_idle","when":"held(phon)"},
		{"base":1,"action":"stand_idle","typo":true}
	]
	for row in variants:
		var data: Dictionary = original.t.duplicate(true)
		data.rows = {"bad":row}
		expect(System.new(data).error != "", "reject malformed enabled row: " + str(row))
	var data: Dictionary = original.t.duplicate(true)
	data.rows = {"unknown":{"enabled":false,"note":"TODO"}}
	expect(System.new(data).error == "", "disabled rows can omit declarations")

func preparation_and_interrupts() -> void:
	var s := fixture({"adjust":{"base":1,"action":"adjust_clothes"}})
	s.items = {"phone":{"kind":"phone"}}
	var p := s.add_person("p", Vector3.ZERO, "phone", book_storage([]))
	s.choose_all()
	expect(p.current.row == "adjust", "held item does not remove ordinary candidate")
	run_for(s, 4.2)
	expect(p.held == "" and "phone" in p.storage.bag.items, "stow commits actual location")
	expect(did(s,"action","stow_item") and did(s,"action","adjust_clothes"), "ordinary action reuses preparation")
	expect(p.result.outcome == "completed", "once completes after preparation")
	expect(s.lines(p).size() == 1, "no current action uses single status line")
	# No store is declared for this parcel: nearby surface receives it permanently.
	s = fixture({"adjust":{"base":1,"action":"adjust_clothes"}})
	s.items = {"parcel":{"kind":"parcel"}}
	s.surfaces = {"table":{"pos":Vector3.ZERO,"capacity":1,"items":[]}}
	p = s.add_person("p", Vector3.ZERO, "parcel")
	s.choose_all()
	run_for(s, 4.2)
	expect(p.held == "" and s.surfaces.table.items == ["parcel"], "put_down commits item to surface; no auto pickup")
	# No supported way to free the hands means genuinely unavailable.
	s = fixture({"adjust":{"base":1,"action":"adjust_clothes"}})
	s.items = {"parcel":{"kind":"parcel"}}
	p = s.add_person("p", Vector3.ZERO, "parcel")
	s.choose_all()
	expect(p.current.is_empty(), "no invented preparation when no store/surface")
	# Seat is an actual state and occupancy outlives the sitting purpose.
	s = fixture({"sit":{"base":1,"use":"go_use","target":"post:sit","action":"sit_bench"}})
	s.posts = {"chair":{"kind":"sit","pos":Vector3.ZERO}}
	p = s.add_person("p", Vector3.ZERO)
	s.choose_all()
	run_for(s, 6.2)
	expect(p.support == "chair" and p.current.is_empty(), "sit_down then hold; completion preserves support")
	s._rebuild_occupancy()
	expect(s.occupied.get("post:chair") == "p", "seat actual occupancy survives completion")
	s.t.rows["idle"] = {"base":2,"action":"stand_idle"}
	s.choose_all()
	expect(p.current.row == "idle", "standing ordinary behavior remains eligible while seated")
	run_for(s, 2.2)
	expect(p.support == "" and did(s,"effect","stand_up"), "shared seat-only stand_up")
	# A higher score interrupts even a preparation before its effect, with no cooldown/success.
	s = fixture({"adjust":{"base":1,"action":"adjust_clothes"},"idle":{"base":0,"action":"stand_idle"}})
	s.items = {"phone":{"kind":"phone"}}
	p = s.add_person("p", Vector3.ZERO, "phone", book_storage([]))
	s.choose_all()
	run_for(s, 0.3)
	var old_id: int = p.body.id
	s.t.rows.idle.base = 5
	s.choose_all()
	expect(p.current.row == "idle" and p.held == "phone", "stow interrupted before effect; holding unchanged")
	expect(not p.done.has("adjust@"), "interruption does not pretend completion/cooldown")
	run_for(s, 0.3)
	expect(p.body.id != old_id and p.body.step.action == "stand_idle", "new action instance replaces old without waiting")
	expect(s.lines(p) == PackedStringArray(["发呆"]), "equal action/behavior meanings collapse")
	# Tool disappearance stops the action by its shared continuation requirements.
	s = fixture({"phone":{"base":1,"use":"use_tool","tool":"phone","action":"phone_browse"}})
	s.items = {"phone":{"kind":"phone"}}
	p = s.add_person("p", Vector3.ZERO, "phone")
	s.choose_all()
	run_for(s, 0.2)
	p.held = ""
	run_for(s, 0.1)
	expect(p.result.outcome == "blocked", "tool lost stops current action")

func fidget_pool() -> void:
	var full := System.new()
	var row: Dictionary = full.t.rows.fidget
	expect(not full.t.rows.adjust_clothes.enabled, "adjust clothes needs a concrete cause")
	expect(row.actions.size() == 7 and row.base == 1.2, "one fidget row holds all seven variants")
	for state in ["standing", "seated", "held"]:
		var s := fixture({"fidget":row})
		s.items = {"phone":{"kind":"phone"}}
		var p := s.add_person("p", Vector3.ZERO, "phone" if state == "held" else "", book_storage([]))
		if state != "held": p.storage.bag.items.append("phone")
		if state == "seated":
			s.posts = {"chair":{"kind":"sit","pos":Vector3.ZERO}}
			p.support = "chair"
		s.choose_all()
		if state == "seated":
			expect(p.current.is_empty() and p.body.is_empty(), "pool never prepares posture/hands: " + state)
			continue
		if state == "held":
			expect(p.current.action == "look_up", "held item permits only hands-at-sides look_up")
			s.tick(0.1)
			expect(p.body.step.action == "look_up" and p.held == "phone", "look_up starts directly without stowing held item")
		var selected: String = p.current.action
		expect(selected in row.actions, "selected action belongs to pool")
		s.tick(0.1)
		var body_id: int = p.body.id
		s.choose_all()
		expect(p.current.action == selected and p.body.id == body_id, "rethink retains selected pool action and progress")
		expect(s.lines(p) == PackedStringArray([row.label, s.t.actions[selected].label]), "pool displays actual action in lower line")
		run_for(s, 2.1)
		expect(p.result.outcome == "completed" and p.done.has("fidget@"), "pool completes with one shared behavior cooldown")
	# Mixed eligibility: filter before drawing; do not prepare an incompatible variant.
	var s := fixture({"fidget":{"base":1.2,"label":"Fidget","actions":["scratch_head","rub_eye"]}})
	s.t.actions.rub_eye.posture = "any"
	var p := s.add_person("sitter", Vector3.ZERO)
	s.posts = {"chair":{"kind":"sit","pos":Vector3.ZERO}}
	p.support = "chair"
	s.choose_all()
	expect(p.current.action == "rub_eye" and s.preview(p,p.current).steps.size() == 1, "only directly compatible variant is drawn")
	s.tick(0.1)
	p.held = "phone"
	s.items = {"phone":{"kind":"phone"}}
	s.tick(0.1)
	expect(p.result.outcome == "blocked" and p.held == "phone" and p.support == "chair", "pool loses eligibility without preparing or redrawing")
	for bad in [[], ["typo"], ["walk"], ["stand_up"]]:
		var data: Dictionary = full.t.duplicate(true)
		data.rows = {"bad":{"base":1,"label":"Fidget","actions":bad}}
		expect(System.new(data).error != "", "reject invalid action pool: " + str(bad))

func selection() -> void:
	var s := fixture({"idle":{"base":1,"action":"stand_idle","when":"standing"},"stretch":{"base":0,"action":"stretch"}})
	var p := s.add_person("p", Vector3.ZERO)
	s.choose_all()
	s.tick(0.1)
	p.current.jitter = 2.0
	s.t.rows.stretch.base = 2.0
	s.choose_all()
	expect(p.current.row == "idle", "kept jitter protects current; challengers have none")
	s.t.rows.stretch.base = 4.0
	s.choose_all()
	expect(p.current.row == "stretch", "strictly higher score interrupts")
	# Entrance-only condition may cease after admission without becoming an exit gate.
	s = fixture({"idle":{"base":1,"action":"stand_idle","when":"held(phone)"}})
	s.items = {"phone":{"kind":"phone"}}
	p = s.add_person("p", Vector3.ZERO, "phone")
	s.choose_all()
	s.tick(0.1)
	p.held = ""
	s.choose_all()
	expect(p.current.row == "idle", "when is admission only")
	# Bound targets outside discovery radius keep their continuous distance score.
	s = fixture({"notice":{"base":3,"use":"go_use","target":"post:notice","action":"read_notice"}})
	s.posts = {"a":{"kind":"notice","pos":Vector3.ZERO},"b":{"kind":"notice","pos":Vector3(1,0,0)}}
	p = s.add_person("p", Vector3.ZERO)
	s.choose_all()
	p.pos = Vector3(100,0,0)
	expect(s._score(p,"notice","a",false) > 0 and s._score(p,"notice","a",true) == 0, "sight only discovers new targets")
	p.pos = Vector3.ZERO
	p.done["notice@a"] = s.clock
	p.current = {}
	s.reserved.clear()
	s.choose_all()
	expect(p.current.target == "b", "again is per behavior+target")
	# Per-row jitter is shared by every target, not redrawn per binding.
	s.t.defaults.jitter = 1.5
	p.current = {}
	p.done.clear()
	s.reserved.clear()
	s.choose_all()
	var pick: Dictionary = p.current.duplicate()
	expect(pick.jitter >= 0 and pick.jitter <= 1.5, "initial row jitter retained")
	# Zero score cannot be revived by jitter.
	s.t.rows.notice.base = 0
	p.current = {}
	s.reserved.clear()
	s.choose_all()
	expect(p.current.is_empty(), "zero candidate is excluded before jitter")
	# Same row, different actual target is a challenger, not excluded as 'already doing this row'.
	s = fixture({"notice":{"base":3,"use":"go_use","target":"post:notice","action":"read_notice"}})
	s.posts = {"near":{"kind":"notice","pos":Vector3(1,0,0)},"far":{"kind":"notice","pos":Vector3(9,0,0)}}
	p = s.add_person("p", Vector3(9,0,0))
	s.choose_all()
	expect(p.current.target == "far", "bind initial actual target")
	p.pos = Vector3.ZERO
	s.choose_all()
	expect(p.current.target == "near", "same behavior can switch to a better actual target")
	# Shared condition table takes the highest hit; personal coefficient zero excludes candidates.
	s = fixture({"idle":{"base":{"else":1,"standing":2,"held(phone)":3},"action":"stand_idle","tags":["interest"]}})
	s.items = {"phone":{"kind":"phone"}}
	p = s.add_person("p",Vector3.ZERO,"phone",{}, {"interest":2.0})
	expect(s.check_world() == "", "personal coefficient declaration")
	expect(s._score(p,"idle","",true) == 6, "highest matching base multiplied by personal coefficient")
	p.tags.interest = 0
	s.t.defaults.jitter = 100
	s.choose_all()
	expect(p.current.is_empty(), "zero coefficient is not revived by jitter")

func interrupt_each_phase() -> void:
	for phase in ["main_once","main_hold","stand_up","take_tool","put_down","sit_down","walk"]:
		var row: Dictionary = {"base":1,"action":"adjust_clothes"}
		if phase == "main_hold": row.action = "stand_idle"
		if phase == "stand_up": row.action = "stretch"
		if phase == "take_tool": row = {"base":1,"action":"read_book","use":"use_tool","tool":"book"}
		if phase in ["sit_down","walk"]: row = {"base":1,"action":"sit_bench","use":"go_use","target":"post:sit"}
		var s := fixture({"original":row,"higher":{"base":0,"action":"stand_idle"}})
		var p := s.add_person("p",Vector3.ZERO)
		if phase == "stand_up":
			s.posts = {"chair":{"kind":"sit","pos":Vector3.ZERO}}
			p.support = "chair"
		if phase == "take_tool":
			s.items = {"book":{"kind":"book"}}
			p.storage = book_storage()
		if phase == "put_down":
			s.items = {"parcel":{"kind":"parcel"}}
			p.held = "parcel"
			s.surfaces = {"table":{"pos":Vector3.ZERO,"items":[],"capacity":1}}
		if phase in ["sit_down","walk"]:
			s.posts = {"chair":{"kind":"sit","pos":Vector3(10,0,0) if phase == "walk" else Vector3.ZERO}}
		s.choose_all()
		s.tick(0.1)
		var old_body: Dictionary = p.body
		var pos: Vector3 = p.pos
		s.t.rows.higher.base = 10
		s.choose_all()
		expect(p.current.row == "higher" and p.body.is_empty(), "higher choice immediately cuts phase: " + phase)
		expect(not p.done.has("original@" + ("chair" if phase in ["sit_down","walk"] else "")), "interrupt has no completion cooldown: " + phase)
		expect(not s._effect(p, old_body.step, old_body), "stale old body cannot commit an effect: " + phase)
		if phase == "put_down": expect(p.held == "parcel" and s.surfaces.table.items.is_empty(), "interrupted put_down leaves object in hand")
		if phase == "take_tool": expect(p.held == "" and "book" in p.storage.bag.items, "interrupted take_tool creates no item")
		if phase == "stand_up": expect(p.support == "chair", "interrupted stand_up leaves actual seat support")
		if phase == "sit_down": expect(p.support == "", "interrupted sit_down has not seated the body")
		if phase == "walk": expect(p.pos == pos and not s.reserved.has("post:chair"), "interrupted walk preserves position, releases approach")
	var aliases := fixture({"stroll":{"base":1,"action":"walk","target":"post:waypoint","label":"闲逛"}})
	aliases.posts = {"point":{"kind":"waypoint","pos":Vector3(10,0,0),"exclusive":false}}
	var walker := aliases.add_person("p",Vector3.ZERO)
	aliases.choose_all()
	aliases.tick(0.1)
	expect(aliases.lines(walker) == PackedStringArray(["闲逛"]), "semantic alias of main action collapses even when labels differ")

func competition(reverse: bool) -> System:
	var s := fixture({"notice":{"base":6,"use":"go_use","target":"post:notice","action":"read_notice"},"water":{"base":4,"use":"go_use","target":"post:fountain","action":"fountain_drink"}})
	s.posts = {"x":{"kind":"notice","pos":Vector3(0,0,1)},"z":{"kind":"fountain","pos":Vector3(0,0,2)}}
	for id in (["C","B","A"] if reverse else ["A","B","C"]): s.add_person(id, Vector3.ZERO)
	s.choose_all()
	return s

func arbitration() -> void:
	var a := competition(false)
	var b := competition(true)
	var identities := {}
	for p in a.people: identities[p.id] = p.current.get("key", "")
	for p in b.people: expect(identities[p.id] == p.current.get("key", ""), "same-frame decision independent of array order: " + p.id)
	expect(a.people.filter(func(p): return not p.current.is_empty()).size() == 2, "one first winner, one fallback winner, third stays idle")
	expect(a.trace.filter(func(e): return e.event == "fallback").size() == 2, "each first loser only tries one fallback")
	expect(a.reserved.size() == 2, "fallback rechecks already granted occupancy")
	# Failed high choice cannot downgrade valid current below the cached threshold.
	var s := fixture({"idle":{"base":3.5,"action":"stand_idle"},"sit":{"base":0,"use":"go_use","target":"post:sit","action":"sit_bench"},"scratch":{"base":1.2,"action":"scratch_head"}})
	s.posts = {"chair":{"kind":"sit","pos":Vector3(0,0,1)}}
	var p := s.add_person("p", Vector3.ZERO)
	s.choose_all()
	s.add_person("contender", Vector3(0,0,1.5))
	s.t.rows.sit.base = 6
	s.choose_all()
	expect(p.current.row == "idle", "failed first choice cannot fall below valid current score")
	# Actual occupancy remains even after a purpose clears its approach reservation.
	s = fixture({"notice":{"base":2,"use":"go_use","target":"post:notice","action":"read_notice"}})
	s.posts = {"n":{"kind":"notice","pos":Vector3.ZERO}}
	p = s.add_person("body", Vector3.ZERO)
	s.add_person("other", Vector3(1,0,0))
	s.choose_all()
	run_for(s, 4.2)
	expect(s.people[1].current.is_empty(), "standing body at completed facility still blocks entry")
	# Two people cannot commit a parcel into one last free surface slot.
	s = fixture({"adjust":{"base":1,"action":"adjust_clothes"}})
	s.surfaces = {"table":{"pos":Vector3.ZERO,"items":[],"capacity":1}}
	for id in ["a","b"]:
		s.items[id] = {"kind":"parcel"}
		s.add_person(id, Vector3.ZERO, id)
	s.choose_all()
	run_for(s, 2.2)
	expect(s.surfaces.table.items.size() == 1 and s.people.filter(func(q): return q.held == "").size() == 1, "put_down resource granted centrally; no duplicated effect")

func pass_through_seat() -> void:
	for seated in [true, false]:
		var s := fixture({"stroll":{"base":1,"action":"walk","target":"post:waypoint","tags":["walk"]}})
		s.t.defaults.speed = 1.0
		s.posts = {"chair":{"kind":"sit","pos":Vector3(2,0,0)},"goal":{"kind":"waypoint","pos":Vector3(4,0,0),"exclusive":false}}
		var sitter := s.add_person("sitter",Vector3(2,0,0),"",{}, {"walk":0.0}) if seated else {}
		if seated: sitter.support = "chair"
		var walker := s.add_person("walker",Vector3.ZERO,"",{}, {"walk":1.0})
		s.choose_all()
		run_for(s, 2.0)
		expect(walker.pos.distance_to(s.posts.chair.pos) <= s.t.defaults.arrival, "regression walk actually passes through seat point")
		# Rebuild at the exact crossing, then continue beyond it. Proximity alone must not claim it.
		s._rebuild_occupancy()
		expect(s.error == "", "passing through seat is not a conflicting actual occupancy")
		expect(s.occupied.get("post:chair", "") == ("sitter" if seated else ""), "seat belongs only to seated body; empty seat remains free")
		run_for(s, 2.2)
		expect(walker.result.get("outcome") == "completed" and walker.pos == s.posts.goal.pos, "walk continues through seat and completes")
		if seated:
			expect(sitter.support == "chair" and s.occupied.get("post:chair") == "sitter", "seat remains occupied by sitter after walker passes")

func book_addition() -> void:
	var full := System.new()
	var row: Dictionary = full.t.rows.read_book.duplicate(true)
	full.t.rows.erase("read_book")
	var before: Dictionary = full.t.duplicate(true)
	# This is the only content change. No action, person, template or old behavior changes.
	full.t.rows["read_book"] = row
	expect(full.validate() == "", "book added by one row validates")
	var stripped: Dictionary = full.t.duplicate(true)
	stripped.rows.erase("read_book")
	expect(stripped == before, "book addition changes only that row")
	var s := fixture({"read_book":row})
	s.items = {"phone":{"kind":"phone"},"book":{"kind":"book"}}
	s.posts = {"chair":{"kind":"sit","pos":Vector3.ZERO}}
	var p := s.add_person("reader", Vector3.ZERO, "phone", book_storage())
	p.support = "chair"
	s.choose_all()
	run_for(s, 6.2)
	expect(p.held == "book" and "phone" in p.storage.bag.items and p.support == "", "source-audited standing book uses shared rise, stow and take")
	expect(s.lines(p) == PackedStringArray(["看书"]), "book main action text collapses")
	run_for(s, 4.2)
	expect(p.held == "book" and p.result.get("outcome") == "completed", "book hold completes, book remains in hand")
	expect(did(s,"action","take_tool") and did(s,"action","read_book"), "tool preparation is not whole behavior success")
	var absent := fixture({"read_book":row})
	p = absent.add_person("no_book", Vector3.ZERO)
	absent.choose_all()
	expect(p.current.is_empty(), "no declared book location means no book candidate")

func scene_check() -> void:
	var scene: Node3D = load("res://scenes/text_behavior_test/level.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	expect(scene.sim.error == "", "actual scene initializes with real WalkGrid")
	scene.sim.tracing = true
	scene.set_process(false)
	# _ready already selected initial purposes before tracing was enabled.
	var initial_rows: Array=scene.sim.people.map(func(p):return p.current.get("row",""))
	for i in 18000:
		scene.step(1.0/60)
		if scene.sim.error != "": break
	expect(scene.sim.error == "", "actual scene runs 300 simulated seconds: " + scene.sim.error)
	expect(scene.sim.check_world() == "", "item locations remain unique after scene simulation: " + scene.sim.check_world())
	expect(did(scene.sim,"effect","leave"), "scene walkers actually arrive at exits and leave")
	expect(did(scene.sim,"action","read_notice") and did(scene.sim,"action","fountain_drink"), "real grid arrival reaches both go_use main actions")
	expect(did(scene.sim,"joint_effect","pair"), "scene demonstrates handshake common execution")
	expect(did(scene.sim,"joint_effect","checkout") and did(scene.sim,"joint_effect","delivery"), "scene demonstrates actual service checkout and delivery")
	expect(did(scene.sim,"effect","stand_up"), "scene initial seated state executes common preparation")
	for id in scene.sim.supports.devices:
		var d: Dictionary = scene.sim.supports.devices[id]
		expect(d.openings > 0 if scene.sim.supports.profile(d).has("portal") else d.trips > 0,"actual scene support completed or route portal opened: "+id)
	expect(did(scene.sim,"action","help_up") and did(scene.sim,"action","helped_up"),"actual moving fall location obtains shared support")
	expect(not scene.sim.supports.calls.values().any(func(link): return link.live),"actual scene calls end through explicit remote events")
	for name in scene.config.get("required_demonstrations",[]):
		expect(name in initial_rows or scene.sim.trace.any(func(e):return e.event=="start" and e.detail.begins_with(name+"@")),"actual scene behavior ran: "+name)
	for id in scene.config.get("required_task_results",[]): expect(scene.sim.activities.tasks[id].done,"actual scene current task completed: "+id)
	for id in scene.config.get("required_transfer_results",[]): expect(scene.sim.coop.intents[id].done,"actual scene finite transfer completed: "+id)
	for id in scene.config.get("required_checkout_results",[]): expect(scene.sim.activities.checkouts[id].orders.values().any(func(order):return order.collected),"actual scene finite checkout completed: "+id)
	scene.refresh()
	scene.queue_free()
	await process_frame
