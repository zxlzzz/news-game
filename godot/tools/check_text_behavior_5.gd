## Shared task, finite checkout and independent-hand integration evidence.
extends RefCounted
const System := preload("res://npc/text_behavior/system.gd")
var c
func expect(ok: bool, message: String) -> void: c.expect(ok,"batch5: "+message)
func fixture(names: Array) -> System:
	var s:=System.new()
	var rows: Dictionary={}
	for name in names:
		rows[name]=s.t.rows[name].duplicate(true)
		rows[name].erase("tags")
	rows["pause"]={"base":0,"action":"stand_idle"}
	s.t.rows=rows
	s.t.defaults.jitter=0.0
	s.tracing=true
	s.planner=func(a: Vector3,b: Vector3):return PackedVector3Array([a,b])
	expect(s.validate()=="","fixture validates: "+s.validate())
	return s
func advance(s: System, seconds: float) -> void:
	for i in ceili(seconds*60): s.tick(1.0/60)
	expect(s.error=="","runtime: "+s.error)
func until(s: System, predicate: Callable, seconds:=25.0) -> bool:
	for i in ceili(seconds*60):
		if predicate.call(): return true
		s.tick(1.0/60)
	return false
func run(checker) -> void:
	c=checker
	baseline()
	live_tasks()
	transactions()
	hands_and_transfer()
	material_events()

func baseline() -> void:
	var s:=System.new()
	var base: Dictionary=JSON.parse_string(FileAccess.get_file_as_string(ProjectSettings.globalize_path("res://").path_join("../codex-iter/behavior-batch5/baseline-table.json")))
	var old_scene: Dictionary=JSON.parse_string(FileAccess.get_file_as_string(ProjectSettings.globalize_path("res://").path_join("../codex-iter/behavior-batch5/baseline-scene.json")))
	var scene: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://scenes/text_behavior_test/demo.json"))
	var count:=0
	for name in base.rows:
		if base.rows[name].get("enabled",true):
			count+=1
			expect(s.t.rows[name]==base.rows[name],"unchanged old row: "+name)
	expect(count==90,"baseline90 rows")
	for p in old_scene.people:
		var found: Array=scene.people.filter(func(q):return q.id==p.id)
		expect(found.size()==1 and found[0].tags==p.tags,"unchanged personal coefficients: "+p.id)
	for name in base.actions: expect(s.t.actions[name]==base.actions[name],"unchanged old action: "+name)
	expect(not s.t.rows.adjust_clothes.enabled,"intentional exclusion unchanged")
	for name in ["pet_dog","wait_person","buy_newspaper","use_vending","distribute_flyer","receive_flyer"]: expect(s.t.rows[name].get("enabled",true),"enabled: "+name)
	expect(s.binding("walk","","paper_stack")==null and s.binding("offer_sheet")==null,"no empty-hand clip with second held object")
	var t: Dictionary=s.t.duplicate(true)
	t.actions.offer_sheet.hands.right="typo"
	expect(System.new(t).error!="","invalid hand kind fails")
	t=s.t.duplicate(true)
	t.processes.vending_checkout.steps[2].operation="mint"
	expect(System.new(t).error!="","undefined machine effect fails")

func live_tasks() -> void:
	var s:=fixture(["pet_dog"])
	var p:=s.add_person("p",Vector3.ZERO)
	s.activities.animals.dog={"pos":Vector3(0,0,.7),"willing":true,"moving":false,"approach_allowed":false,"contact_allowed":false}
	expect(s.activities.add_task("pet","animal_contact","p","dog")=="","explicit animal current task")
	s.choose_all()
	expect(p.current.is_empty(),"no approach/contact permission means unavailable")
	s.activities.animals.dog.approach_allowed=true
	s.activities.animals.dog.contact_allowed=true
	s.choose_all()
	advance(s,.5)
	expect(p.body.get("step",{}).get("action")=="pet_contact","actual contact action runs")
	var old: Dictionary=p.body.duplicate(true)
	s.activities.animals.dog.contact_allowed=false
	expect(not s._effect(p,old.step,old),"permission rechecked at commit before next tick")
	advance(s,.05)
	expect(p.current.is_empty() and not s.activities.tasks.pet.done,"revocation cuts contact without completion")
	expect(not s._effect(p,old.step,old),"stale contact body rejected")
	s.activities.animals.dog.contact_allowed=true
	p.done.clear()
	s.choose_all()
	advance(s,2.2)
	expect(s.activities.tasks.pet.done,"finite pet contact completes")
	s=fixture(["pet_dog"])
	p=s.add_person("p",Vector3(0,0,-3))
	s.activities.animals.dog={"pos":Vector3(0,0,.7),"willing":true,"moving":false,"approach_allowed":true,"contact_allowed":true}
	s.activities.add_task("pet","animal_contact","p","dog")
	s.choose_all()
	advance(s,.5)
	var pos: Vector3=p.pos
	s.activities.animals.dog.pos+=Vector3(2,0,0)
	advance(s,.1)
	expect(p.current.is_empty() and p.pos.distance_to(pos)<.001,"animal departure stops approach, no following teleport")
	s=fixture(["wait_person"])
	p=s.add_person("waiter",Vector3(0,0,-1))
	var q:=s.add_person("expected",Vector3(0,0,4))
	s.posts.meet={"kind":"meeting","pos":Vector3.ZERO,"exclusive":false}
	expect(s.activities.add_task("wait","await_person",p.id,q.id,"meet")=="","current person/place provided")
	s.choose_all()
	advance(s,2)
	expect(p.body.get("step",{}).get("action")=="wait_current_person" and p.pos.distance_to(Vector3.ZERO)<=s.t.defaults.arrival,"walk then actual waiting at place")
	q.pos=Vector3(0,0,.8)
	advance(s,.05)
	expect(s.activities.tasks.wait.done and p.current.is_empty(),"actual expected person arrival completes wait")
	expect(s.activities.add_task("invalid","await_person",p.id,"unknown","meet")!="","no invented appointment subject")

func checkout_fixture(row: String) -> Dictionary:
	var s:=fixture([row])
	var profile: String=s.t.rows[row].process
	var kind: String=s.t.processes[profile].transaction.product
	var post_kind: String=s.t.rows[row].target.trim_prefix("post:")
	s.posts.counter={"kind":post_kind,"pos":Vector3.ZERO}
	s.items={"phone":{"kind":"phone"},"stock_item":{"kind":kind},"remaining":{"kind":kind}}
	s.surfaces.stock={"pos":Vector3.ZERO,"capacity":2,"items":["stock_item","remaining"]}
	s.surfaces.output={"pos":Vector3.ZERO,"capacity":1,"items":[]}
	var p:=s.add_person("buyer",Vector3.ZERO,"",{"bag":{"items":["phone"],"accepts":["phone",kind],"capacity":2}})
	expect(s.activities.add_checkout("fixture",profile,"counter","stock","output",{p.id:1})=="","actual checkout provider: "+row)
	expect(s.check_world()=="","finite inventory located before transaction")
	return {"s":s,"p":p,"f":s.activities.checkouts.fixture}

func material_events() -> void:
	for row in ["buy_newspaper","use_vending"]:
		var x:=checkout_fixture(row)
		x.s.choose_all()
		expect(until(x.s,func():return x.p.body.get("step",{}).get("operation")=="collect"),"native collection reached")
		var action: String=x.p.body.step.action
		var at: float=x.s.material_time(action,"effect_frame")
		expect(x.s.binding(action)!=null and at>0.3 and x.s.material_time(action)>at,"whole source with interior assigned event")
		advance(x.s,maxf(0,at-x.p.body.elapsed-.05))
		expect(x.p.held=="" and x.s.surfaces.output.items==["stock_item"],"real output remains before assigned pickup")
		advance(x.s,.1)
		expect(x.p.held=="stock_item" and x.f.orders.buyer.collected and x.s.finishing(x.p),"assigned pause commits once before source tail")
		var old: Dictionary=x.p.body.duplicate(true)
		x.s.t.rows.pause.base=10000
		x.s.choose_all()
		expect(x.p.current.get("row")=="pause" and x.p.held=="stock_item","committed source tail can be interrupted without undoing ownership")
		expect(not x.s._effect(x.p,old.step,old),"stale material tail cannot recollect")
		expect(x.s.check_world()=="","material event preserves finite ownership")
	var s:=fixture(["wait_person"])
	var p:=s.add_person("waiting",Vector3.ZERO)
	var q:=s.add_person("expected",Vector3(0,0,4))
	s.posts.meet={"kind":"meeting","pos":Vector3.ZERO,"exclusive":false}
	expect(s.activities.add_task("wait","await_person",p.id,q.id,"meet")=="","waiting material task")
	s.choose_all()
	advance(s,6)
	expect(s.trace.any(func(e):return e.person==p.id and e.event=="action" and e.detail=="check_watch"),"existing standing watch source actually scheduled")
	expect(not s.activities.tasks.wait.done,"watch gesture cannot invent arrival")
	q.pos=Vector3(0,0,.5)
	advance(s,.1)
	expect(s.activities.tasks.wait.done,"arrival cuts any waiting gesture")

func transactions() -> void:
	for row in ["buy_newspaper","use_vending"]:
		for phase in ["select","pay","release","collect"]:
			var x:=checkout_fixture(row)
			var s: System=x.s
			var p: Dictionary=x.p
			var f: Dictionary=x.f
			s.choose_all()
			var reached:=until(s,func():return p.body.get("step",{}).get("operation")==phase and p.body.elapsed>.3)
			expect(reached,"reached "+row+" "+phase)
			if not reached:
				print("BATCH5_CHECKOUT_DIAGNOSTIC ",row," ",phase," ",JSON.stringify(s.trace))
				continue
			var old: Dictionary=p.body.duplicate(true)
			var before: Array=[s.surfaces.stock.items.duplicate(),s.surfaces.output.items.duplicate(),f.credits[p.id]]
			s.t.rows.pause.base=10000
			s.choose_all()
			expect(p.current.get("row")=="pause","immediate interruption at "+phase)
			expect(not s._effect(p,old.step,old),"stale transaction commit rejected "+phase)
			advance(s,.1)
			expect([s.surfaces.stock.items,s.surfaces.output.items,f.credits[p.id]]==before,"cut preserves committed inventory/payment "+phase)
			s.t.rows.pause.base=0
			s.choose_all()
			advance(s,18)
			expect(f.orders.get(p.id,{}).get("collected",false) and p.held=="stock_item","resume finishes one purchase "+row+" "+phase)
			expect(f.credits[p.id]==0 and s.surfaces.stock.items==["remaining"] and s.surfaces.output.items.is_empty(),"one debit and one existing item, no minted stock "+phase)
			expect(s.check_world()=="","unique actual item locations after purchase: "+s.check_world())
			p.done.clear()
			s.choose_all()
			expect(p.current.is_empty(),"paid-and-collected receipt cannot collect a second item")
		var x:=checkout_fixture(row)
		x.f.working=false
		x.s.choose_all()
		expect(x.p.current.is_empty() and x.f.credits.buyer==1,"unavailable device creates no output/payment")
		x.f.working=true
		x.f.credits.buyer=0
		x.s.choose_all()
		expect(x.p.current.is_empty(),"no payment authorization means unavailable")
		x=checkout_fixture(row)
		x.s.choose_all()
		expect(until(x.s,func():return x.p.body.get("step",{}).get("operation")=="release" and x.p.body.elapsed>.3),"paid provider wait reached")
		x.s.posts.detour={"kind":"waypoint","pos":Vector3(0,0,10),"exclusive":false}
		x.s.t.rows.pause={"base":10000,"action":"walk","target":"post:waypoint"}
		x.s.choose_all()
		advance(x.s,5)
		expect(x.p.current.get("row")=="pause" and x.f.orders.buyer.released and not x.f.orders.buyer.collected and x.s.surfaces.output.items==["stock_item"],"provider outputs actual paid stock while buyer does another purpose")
		x.s.t.rows.pause.base=0
		x.s.choose_all()
		advance(x.s,12)
		expect(x.f.orders.buyer.collected and x.f.credits.buyer==0 and x.p.held=="stock_item","late return collects actual output once")

func hands_and_transfer() -> void:
	var s:=fixture(["distribute_flyer","receive_flyer"])
	s.items={"stack":{"kind":"paper_stack","contents":["one","two"],"accepts":["paper"],"capacity":2},"one":{"kind":"paper"},"two":{"kind":"paper"}}
	var p:=s.add_person("giver",Vector3.ZERO)
	p.held="stack"
	var q:=s.add_person("receiver",Vector3(-.28,0,.94))
	expect(s.coop.add_intent("sheet",p.id,q.id,"one","finite_supply","stack")=="","finite sheet supply intent")
	expect(s.check_world()=="","stack and distinct sheets have unique locations")
	s.choose_all()
	expect(until(s,func():return p.body.get("step",{}).get("action")=="draw_container_item"),"pair uses ordinary container draw preparation")
	advance(s,.4)
	var old: Dictionary=p.body.duplicate(true)
	s.t.rows.pause.base=10000
	s.choose_all()
	expect(p.current.get("row")=="pause" and not s._effect(p,old.step,old),"draw can be cut; stale draw rejected")
	expect(s.items.stack.contents==["one","two"] and p.held=="stack" and p.offhand=="","uncommitted draw consumes nothing")
	s.t.rows.pause.base=0
	s.choose_all()
	expect(until(s,func():return p.body.has("joint")),"joint only starts after real sheet is in left hand")
	expect(p.offhand=="one" and p.held=="stack" and s.items.stack.contents==["two"],"two real independently held objects during offer")
	var key: String=p.body.joint
	var joint: Dictionary=s.coop.joints[key].duplicate(true)
	advance(s,.3)
	s.t.rows.pause.base=10000
	s.choose_all()
	expect(p.current.get("row")=="pause" and q.current.get("row")=="pause","joint cancellation preserves newly selected purposes")
	expect(p.offhand=="one" and q.held=="" and p.held=="stack" and s.items.stack.contents==["two"],"cut offer preserves drawn sheet and remaining stack")
	expect(not s.coop.commit_joint(joint),"cut joint cannot transfer through stale commit")
	s.t.rows.pause.base=0
	s.choose_all()
	expect(until(s,func():return p.body.has("joint")),"drawn sheet can resume same finite transfer")
	advance(s,2.2)
	expect(q.held=="one" and p.offhand=="" and p.held=="stack","atomic handoff keeps right-hand stack")
	expect(s.items.stack.contents==["two"] and s.coop.intents.sheet.done,"one sheet consumed from finite supply")
	expect(not s.coop.commit_joint(joint),"duplicate joint callback cannot transfer again")
	expect(s.check_world()=="","container/hand ownership remains unique")
	s=fixture(["fidget"])
	s.t.rows.fidget={"base":1,"action":"scratch_head"}
	s.items={"a":{"kind":"paper_stack","contents":[],"accepts":["paper"],"capacity":0},"b":{"kind":"phone"}}
	p=s.add_person("two_hands",Vector3.ZERO,"b",{"bag":{"items":[],"accepts":["paper_stack","phone"],"capacity":2}})
	p.offhand="a"
	s.choose_all()
	advance(s,6.3)
	expect(p.held=="" and p.offhand=="" and p.storage.bag.items.size()==2,"ordinary empty-hand action frees both slots through shared preparation")
	expect(s.check_world()=="","two-hand preparation retains both real objects")
