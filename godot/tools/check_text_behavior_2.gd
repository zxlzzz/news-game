## Batch-two deterministic scenarios; all use the production executor and allocator.
extends RefCounted
const System := preload("res://npc/text_behavior/system.gd")
var checker: WeakRef
var c:
	get: return checker.get_ref()

func wait_until(s: System, predicate: Callable, message: String, seconds := 80.0) -> bool:
	for i in ceili(seconds*60):
		if predicate.call():
			c.expect(s.error == "",message + " runtime: " + s.error)
			return true
		s.tick(1.0/60)
		if s.error != "": break
	c.expect(false,message + " timed out: " + s.error)
	print("BATCH2_DEBUG ",message," ",s.trace.slice(maxi(0,s.trace.size()-20)))
	return false

func run(check) -> void:
	checker = weakref(check)
	handshakes()
	service_interruptions()
	queue_facts()
	joint_arbitration()
	declarations()
	configurable_stalls()
	called_from_queue_edge()

func pair_fixture() -> System:
	var row: Dictionary = System.new().t.rows.handshake.duplicate(true)
	row.erase("tags")
	return c.fixture({"handshake":row,"phone":{"base":0,"use":"use_tool","tool":"phone","action":"phone_browse"}})

func handshakes() -> void:
	var s := pair_fixture()
	var a := s.add_person("a",Vector3.ZERO)
	var b := s.add_person("b",Vector3(0,0,2))
	a.yaw = PI/2
	# B initially prefers a separate matter. A's invite must survive wait body requests.
	s.t.rows.handshake.tags = ["social"]
	a.tags = {"social":1.0}
	b.tags = {"social":0.0}
	s.choose_all()
	c.run_for(s,0.3)
	c.expect(s.lines(a) == PackedStringArray(["握手","等对方回应"]),"single invitation has explicit hold text")
	var id: int = a.body.id
	s.choose_all()
	c.expect(a.body.id == id,"invitation wait keeps body/progress")
	b.tags.social = 1.0
	c.expect(s._score(b,"handshake","a",true) > 5,"invited uses common base table")
	s.choose_all()
	c.expect(s.coop.pairs.size() == 1,"late mutual choice creates exactly one pair")
	var pair: Dictionary = s.coop.pairs.values()[0]
	c.run_for(s,0.1)
	c.expect(not "等对方回应" in s.lines(a) and not "等对方回应" in s.lines(b),"after both agree nobody still shows waiting for an answer")
	var partner: Dictionary = s.coop.setups.handshake_offer.partner
	c.expect(s.posts[pair.b].pos.is_equal_approx(s.posts[pair.a].pos + Vector3(partner.at[0],0,partner.at[1]).rotated(Vector3.UP,PI/2)),"handshake partner placement rotates with offer yaw")
	if wait_until(s,func(): return c.did(s,"joint_effect","pair"),"late handshake executes"):
		c.expect(c.did(s,"action","handshake_offer") and c.did(s,"action","handshake_reply"),"both material roles execute")
		c.expect(a.pos.distance_to(b.pos) > 0.7 and a.pos.distance_to(b.pos) < 0.8,"partner geometry comes from clip setup")
		c.expect(a.done.has("handshake@b") and b.done.has("handshake@a"),"joint success cools both bindings")
	# Timeout is a failed attempt with again, not an endless invite.
	s = pair_fixture()
	a = s.add_person("a",Vector3.ZERO,"",{},{"social":1.0})
	b = s.add_person("b",Vector3(0,0,1),"",{},{"social":0.0})
	s.t.rows.handshake.tags = ["social"]
	s.choose_all()
	c.run_for(s,8.2)
	c.expect(a.current.is_empty() and a.done.has("handshake@b"),"invite_wait ends attempt and uses again")
	# Nobody stands still inviting a stranger across the square.
	s = pair_fixture()
	a = s.add_person("a",Vector3.ZERO,"",{},{"social":1.0})
	b = s.add_person("b",Vector3(0,0,s.t.defaults.invite_range+0.5),"",{},{"social":1.0})
	s.t.rows.handshake.tags = ["social"]
	c.expect(s.coop.targets(a,s.t.rows.handshake).is_empty(),"people beyond invite_range are not handshake targets")
	# Two inviters can only win one of C's choices. Also check array-order independence.
	var outcomes: Array = []
	for reverse in [false,true]:
		s = pair_fixture()
		for name in (["c","b","a"] if reverse else ["a","b","c"]): s.add_person(name,Vector3.ZERO)
		for name in ["a","b"]:
			var p: Dictionary = s.coop.person(name)
			p.current = {"row":"handshake","target":"c","key":"handshake@c","score":2.0,"jitter":0.0,"since":0.0}
		s.choose_all()
		c.expect(s.coop.pairs.size() == 1,"two invitations form only one pair")
		outcomes.append(s.coop.person("c").current.target)
	c.expect(outcomes[0] == outcomes[1],"pair selection does not depend on people array")
	# Interrupted common action cannot later commit through a retained callback.
	s = pair_fixture()
	a = s.add_person("a",Vector3.ZERO)
	b = s.add_person("b",Vector3(0,0,1),"phone")
	s.items.phone = {"kind":"phone"}
	b.storage = {"bag":{"accepts":["phone"],"capacity":1,"items":[]}}
	s.choose_all()
	if wait_until(s,func(): return not s.coop.joints.is_empty(),"handshake starts before interruption"):
		var old: Dictionary = s.coop.joints.values()[0]
		s.t.rows.phone.base = 30
		s.choose_all()
		c.expect(s.coop.joints.is_empty() and a.current.is_empty(),"phone selection stops the other partner immediately")
		c.expect(not s.coop.commit_joint(old),"stale pair callback cannot commit")
	# Actual one-row content cost: remove/re-add only the row, then execute it above.
	var full := System.new()
	var row: Dictionary = full.t.rows.handshake.duplicate(true)
	full.t.rows.erase("handshake")
	var before: Dictionary = full.t.duplicate(true)
	full.t.rows.handshake = row
	var after: Dictionary = full.t.duplicate(true)
	after.rows.erase("handshake")
	c.expect(after == before and full.validate() == "","handshake adds one row with existing pair declaration")

func stall_fixture(pack := false) -> System:
	var full := System.new()
	var s: System = c.fixture({"buy":full.t.rows.buy_stuff,"sell":full.t.rows.tend_stall,"phone":{"base":0,"use":"use_tool","tool":"phone","action":"phone_browse"}})
	s.items = {"fruit":{"kind":"goods"},"wallet":{"kind":"wallet"},"phone":{"kind":"phone"}}
	s.surfaces.counter = {"pos":Vector3(0,0,0.6),"capacity":6,"items":["fruit"]}
	var issue: String = s.coop.add_stall("stall",{"service":"fruit","posts":{"vendor":"res://types/market_stall.tscn","customer":"res://types/market_stall.tscn","fruitweigh":"res://types/fruit_stand.tscn"},"origin":Vector3.ZERO,"queue":Vector3(0,0,3),"queue_radius":2.0,"exit":Vector3(3,0,3),"surface":"counter","products":[{"item":"fruit","weigh":not pack,"pack":pack}]})
	c.expect(issue == "","fixture stall: " + issue)
	s.add_person("vendor",s.posts["stall:vendor"].pos,"",{},{"seller":1.0,"shopper":0.0})
	s.add_person("buyer",Vector3(0,0,3),"",{"bag":{"accepts":["wallet","phone","goods"],"capacity":3,"items":["wallet","phone"]}},{"seller":0.0,"shopper":1.0})
	c.expect(s.check_world() == "","stall world initially has unique items")
	s.choose_all()
	return s

func paid_count(s: System) -> int:
	return s.trace.filter(func(e): return e.event == "joint_effect" and e.detail == "checkout" and e.person == "buyer").size()

func service_interruptions() -> void:
	for after_checkout in [true,false]:
		var s := stall_fixture()
		var f: Dictionary = s.coop.stalls.stall
		var a: Dictionary = s.coop.person("buyer")
		var v: Dictionary = s.coop.person("vendor")
		var predicate: Callable = (func(): return f.paid.has("buyer") and v.held == "fruit") if after_checkout else (func(): return not s.coop.joints.is_empty())
		if not wait_until(s,predicate,"reach interrupt boundary " + str(after_checkout)): continue
		c.expect(c.did(s,"action","fruit_weigh") and c.did(s,"effect","take_tool"),"weigh and tool preparation both execute")
		var weigh: Array = s.trace.filter(func(e): return e.event == "action" and e.detail == "fruit_weigh")
		var tool: Array = s.trace.filter(func(e): return e.event == "action" and e.detail == "take_tool")
		c.expect(absf(weigh[0].time-tool[0].time) < s.t.defaults.once_demo,"tool and weighing prepare in parallel")
		c.expect(a.held == "wallet" if not after_checkout else c.did(s,"effect","stow_item"),"payment tool is actual held state and receive reuses free-hands preparation")
		var old: Dictionary = s.coop.joints.values()[0] if not s.coop.joints.is_empty() else {}
		s.t.rows.phone.base = 30
		s.choose_all()
		c.expect(a.current.row == "phone" and f.active.is_empty(),"global phone choice cancels service immediately")
		c.expect(f.paid.has("buyer") == after_checkout,"only committed checkout leaves paid fact")
		if not old.is_empty(): c.expect(not s.coop.commit_joint(old),"old checkout callback cannot charge")
		c.run_for(s,3)
		if after_checkout:
			c.expect(c.did(s,"effect","put_down") and "fruit" in s.surfaces.counter.items,"interrupted prepared goods are actually put on stall counter")
			s.items.fruit2 = {"kind":"goods"}
			s.items.wallet2 = {"kind":"wallet"}
			s.surfaces.counter.items.append("fruit2")
			f.products.append({"item":"fruit2","weigh":false,"pack":false})
			var second := s.add_person("second",s.posts[f.queue_post].pos,"",{"bag":{"accepts":["wallet"],"capacity":1,"items":["wallet2"]}},{"seller":0.0,"shopper":1.0})
			s.choose_all()
			wait_until(s,func(): return second.current.get("success",false),"next buyer served while paid goods wait")
			c.expect(f.paid.get("buyer") == "fruit","another customer's service does not consume first buyer's paid record")
			c.run_for(s,4)
			s.clock += 1000
			s.coop.maintain()
			c.expect(f.paid.get("buyer") == "fruit","paid record has no expiry")
		# Move away as an external fact; then return to the queue through normal selection.
		a.pos = Vector3(4,0,3)
		s.coop.maintain()
		c.expect("buyer" not in f.queue_ids,"leaving queue area removes queue fact")
		s.t.rows.phone.base = 0
		s._end(a,"interrupted")
		a.pos = s.posts[f.queue_post].pos
		s.choose_all()
		if not wait_until(s,func(): return a.current.get("success",false),"return and complete delivery " + str(after_checkout)): continue
		c.expect(a.held == "fruit" and not f.paid.has("buyer"),"joint delivery moves actual item and erases paid fact")
		c.expect(paid_count(s) == 1,"returned buyer charged exactly once")
		var chooses: int = s.trace.filter(func(e): return e.person == "buyer" and e.event == "action" and e.detail == "choose_item").size()
		c.expect(chooses == (1 if after_checkout else 2),"paid return skips selection; unpaid starts fresh")
		c.expect(c.did(s,"effect","take_item"),"vendor takes item from actual counter")
		# Transfer immediately, then interrupt the successful normal remainder.
		a.held = ""
		v.held = "fruit"
		s._end(a,"completed" if a.current.success else "interrupted")
		c.expect(a.result.outcome == "completed" and paid_count(s) == 1,"giving away goods does not undo purchase success")
		c.expect(s.check_world() == "","interruption and transfer preserve unique item locations")
	# TODO is not missing clip: it must stop without payment or delivered goods.
	var s := stall_fixture(true)
	var a: Dictionary = s.coop.person("buyer")
	if wait_until(s,func(): return a.result.get("outcome") == "todo","explicit packaging TODO"):
		c.expect(a.result.message.begins_with("未设计") and paid_count(s) == 0 and a.held != "fruit","TODO displays unimplemented and commits no success")
		c.expect(a.done.has("buy@stall"),"TODO uses shared again")
		s.t.rows.idle = {"base":1,"action":"stand_idle"}
		s.choose_all()
		c.expect("\n".join(s.lines(a)).contains("未设计"),"TODO notice remains readable after immediate alternative selection")

func queue_facts() -> void:
	var s := stall_fixture()
	var f: Dictionary = s.coop.stalls.stall
	var buyer: Dictionary = s.coop.person("buyer")
	wait_until(s,func(): return not f.active.is_empty(),"queue fixture begins service")
	# Prevent active service, while keeping the stall's declared role/open status.
	var vendor: Dictionary = s.coop.person("vendor")
	s._end(vendor,"interrupted")
	s.t.rows.sell.base = 0
	f.keeper = "vendor"
	s.coop.maintain()
	c.expect("buyer" in f.queue_ids,"arrival joins facility queue")
	s.t.rows.phone.base = 30
	s.choose_all()
	c.run_for(s,0.2)
	c.expect(buyer.current.row == "phone" and "buyer" in f.queue_ids,"phone in queue area preserves rank")
	c.expect(f.keeper == "vendor" and f.open,"temporary body change preserves duty/open")
	s.t.rows.sell.base = 5
	s.choose_all()
	s.coop.maintain()
	c.expect("buyer" not in f.queue_ids and c.did(s,"queue_skip","stall"),"called buyer doing phone is skipped and rank invalidated")
	f.queue_ids.append("buyer")
	s.coop.withdraw("buyer","stall")
	c.expect("buyer" not in f.queue_ids,"explicit withdrawal erases rank")
	f.paid.buyer = "fruit"
	buyer.gone = true
	s.coop.maintain()
	c.expect(not f.paid.has("buyer"),"buyer ceases to exist removes paid fact")
	vendor.pos = Vector3(10,0,10)
	s.coop.maintain()
	c.expect(f.keeper == "","leaving stall ends vendor duty")

func declarations() -> void:
	var full := System.new()
	for row in [{"base":2,"use":"pair_once","target":"person"},{"base":2,"use":"pair_once","target":"person","pair":"typo"},{"base":4,"use":"service_customer","service":"typo"},{"base":{"else":4,"invited":6},"use":"service_customer","service":"fruit"}]:
		var data: Dictionary = full.t.duplicate(true)
		data.rows = {"bad":row}
		c.expect(System.new(data).error != "","bad enabled template rejected")
	for key in ["choose","checkout","packing","delivery_layout"]:
		var data: Dictionary = full.t.duplicate(true)
		data.services.fruit.erase(key)
		c.expect(System.new(data).error != "","missing service declaration rejected: " + key)

func joint_arbitration() -> void:
	for reverse in [false,true]:
		var s := pair_fixture()
		s.t.rows.handshake.tags = ["social"]
		s.t.rows.notice = {"base":10,"action":"read_notice","target":"post:notice","use":"go_use","tags":["facility"]}
		for id in (["b","a"] if reverse else ["a","b"]): s.add_person(id,Vector3.ZERO,"",{},{"social":1.0,"facility":0.0})
		s.choose_all()
		var pair: Dictionary = s.coop.pairs.values()[0]
		s.posts.n = {"kind":"notice","pos":s.posts[pair.a].pos}
		var visitor := s.add_person("visitor",Vector3(0,0,1),"",{},{"social":0.0,"facility":1.0})
		s.choose_all()
		c.expect(visitor.current.get("row") == "notice","higher score facility wins over joint layout, including aliased point")
		c.expect(not s.reserved.has("post:"+pair.b),"failed joint layout does not seize its uncontested second point")
		c.expect(s.coop.joints.is_empty(),"layout denial starts neither partner's common action")
	# A customer arriving at the front interrupts a vendor's idle clip immediately.
	var s := stall_fixture()
	var f: Dictionary = s.coop.stalls.stall
	var v: Dictionary = s.coop.person("vendor")
	s.tick(0.1)
	c.expect(not v.body.is_empty() and v.body.step.action == "vendor_call","vendor idles by calling first")
	c.expect(s._score(s.coop.person("buyer"),"buy","stall",true) == 5.0,"calling uses shared circumstance base 5 rather than additive bonus")
	var old: int = v.body.id
	wait_until(s,func(): return not f.active.is_empty(),"customer admitted during vendor call")
	s.tick(0.1)
	c.expect(v.body.get("id",-1) != old and v.body.step.action != "vendor_call","necessary service work cuts vendor call before clip ends")
	c.expect(s._score(s.coop.person("buyer"),"buy","stall",true) < 5,"calling circumstance is recomputed from actual body action")
	# Capture the real delivery callback, then prove it cannot commit a second time.
	var delivery_callback: Dictionary = {}
	if wait_until(s,func(): return s.coop.joints.values().any(func(j): return j.effect == "delivery"),"joint delivery starts"):
		delivery_callback = s.coop.joints.values()[0]
	# Finish a full purchase's normal remainder, then verify real service occupancy clears.
	if wait_until(s,func(): return s.coop.person("buyer").current.get("success",false),"purchase reaches normal remainder"):
		c.expect(not s.coop.commit_joint(delivery_callback),"committed delivery callback cannot transfer a second time")
		var buyer: Dictionary = s.coop.person("buyer")
		wait_until(s,func(): return buyer.result.get("outcome") == "completed","normal departure completes purchase")
		c.expect(buyer.pos == s.posts[f.exit_post].pos and buyer.place == f.exit_post,"successful buyer physically leaves the service point")
		c.expect(buyer.held == "fruit","departure retains actual delivered goods")

func configurable_stalls() -> void:
	var base_posts := {}
	var origin := Vector3(5,0,7)
	for degrees in [0,90]:
		var full := System.new()
		var data: Dictionary = full.t.duplicate(true)
		data.services.minimal = data.services.fruit.duplicate(true)
		data.services.minimal.erase("weigh")
		data.services.minimal.label = "最小第二种服务"
		data.rows = {"buy":data.rows.buy_stuff.duplicate(true),"sell":data.rows.tend_stall.duplicate(true)}
		for row in data.rows.values(): row.service = "minimal"
		data.defaults.jitter = 0.0
		var s := System.new(data)
		s.tracing = true
		s.planner = func(a: Vector3,b: Vector3): return PackedVector3Array([a,b])
		c.expect(s.error == "","second service configured without weighing action: " + s.error)
		s.items = {"book_goods":{"kind":"goods"},"wallet":{"kind":"wallet"}}
		s.surfaces.counter = {"pos":origin+Vector3(0,0,0.6).rotated(Vector3.UP,deg_to_rad(degrees)),"capacity":3,"items":["book_goods"]}
		var config := {"service":"minimal","origin":origin,"queue":origin+Vector3(0,0,3),"queue_radius":2.0,"exit":origin+Vector3(3,0,3),"surface":"counter","posts":{"customer":"res://types/market_stall.tscn","vendor":"res://types/market_stall.tscn"},"products":[{"item":"book_goods","weigh":false,"pack":false}]}
		# Omitting yaw must retain the old zero-yaw placement.
		if degrees != 0: config.yaw = degrees
		var issue: String = s.coop.add_stall("second",config)
		c.expect(issue == "","second stall uses scene-supplied providers: " + issue)
		if issue != "": continue
		var f: Dictionary = s.coop.stalls.second
		c.expect(f.posts.size() == 2 and f.posts.has("customer") and f.posts.has("vendor") and not s.posts.has("second:fruitweigh"),"only action-referenced customer/vendor posts are required")
		for role in ["vendor","customer","delivery","queue_post","exit_post"]:
			var post: Dictionary = s.posts[f[role]]
			if degrees == 0: base_posts[role] = post.duplicate(true)
			else:
				c.expect(post.pos.is_equal_approx(origin + (base_posts[role].pos-origin).rotated(Vector3.UP,PI/2)),"90-degree stall rotates " + role + " around its origin")
				if post.has("yaw"): c.expect(is_zero_approx(wrapf(post.yaw-base_posts[role].yaw-PI/2,-PI,PI)),"90-degree stall rotates facing: " + role)
		var layout: Dictionary = s.coop.setups.give_item.partner
		var vendor: Dictionary = s.posts[f.vendor]
		c.expect(s.posts[f.delivery].pos.is_equal_approx(vendor.pos+Vector3(layout.at[0],0,layout.at[1]).rotated(Vector3.UP,vendor.yaw)),"delivery uses partner offset relative to actual vendor facing")
		c.expect(is_zero_approx(wrapf(s.posts[f.delivery].yaw-vendor.yaw-deg_to_rad(layout.yaw),-PI,PI)),"delivery yaw includes vendor facing")
		s.add_person("vendor",vendor.pos,"",{},{"seller":1.0,"shopper":0.0})
		var buyer := s.add_person("buyer",s.posts[f.queue_post].pos,"",{"bag":{"accepts":["wallet"],"capacity":1,"items":["wallet"]}},{"seller":0.0,"shopper":1.0})
		s.choose_all()
		if wait_until(s,func(): return buyer.result.get("outcome") == "completed","second service completes at yaw " + str(degrees)):
			c.expect(buyer.held == "book_goods" and f.paid.is_empty(),"second service delivers actual goods and clears paid")
			c.expect(paid_count(s) == 1 and not c.did(s,"action","fruit_weigh"),"second service charges once without entering weighing")
			c.expect(s.check_world() == "","second service preserves actual item locations")
		# Bad provider declarations return startup errors without adding partial posts.
		for variant in ["missing","wrong_marker","missing_weigh","yaw"]:
			var bad: Dictionary = config.duplicate(true)
			match variant:
				"missing": bad.posts.erase("customer")
				"wrong_marker": bad.posts.customer = "res://types/fruit_stand.tscn"
				"missing_weigh": bad.products[0].weigh = true
				"yaw": bad.yaw = "east"
			# Restore stock for declaration checking after the successful sale.
			bad.products = [{"item":"spare","weigh":variant == "missing_weigh","pack":false}]
			s.items.spare = {"kind":"goods"}
			s.surfaces.counter.items = ["spare"]
			var before: Dictionary = s.posts.duplicate(true)
			c.expect(s.coop.add_stall("bad_"+variant,bad) != "" and s.posts == before,"reject bad stall configuration without partial geometry: " + variant)
	var full := System.new()
	for action in ["queue_wait","service_wait","pair_wait"]:
		c.expect(full.binding(action) == "stand_idle" and full.binding(action,"wallet") == null and full.t.actions[action].mode == "hold","empty waiting binds stand_idle; held waiting keeps explicit gap: " + action)
	c.expect(full.t.actions.handshake_wait.clip == null,"single-sided handshake wait keeps missing clip explicit")

# Seen in the demo: the counter lies outside the queue area, so a buyer called from the edge
# leaves the area on the way. That must not cancel the call (it used to livelock at the edge).
func called_from_queue_edge() -> void:
	var full := System.new()
	var s: System = c.fixture({"buy":full.t.rows.buy_stuff,"sell":full.t.rows.tend_stall})
	s.items = {"fruit":{"kind":"goods"},"wallet":{"kind":"wallet"}}
	s.surfaces.counter = {"pos":Vector3(0,0,0.6),"capacity":6,"items":["fruit"]}
	var issue: String = s.coop.add_stall("stall",{"service":"fruit","posts":{"vendor":"res://types/market_stall.tscn","customer":"res://types/market_stall.tscn","fruitweigh":"res://types/fruit_stand.tscn"},"origin":Vector3.ZERO,"queue":Vector3(0,0,4.5),"queue_radius":1.0,"exit":Vector3(3,0,4),"surface":"counter","products":[{"item":"fruit","weigh":false,"pack":false}]})
	c.expect(issue == "","edge fixture stall: " + issue)
	s.add_person("vendor",s.posts["stall:vendor"].pos,"",{},{"seller":1.0,"shopper":0.0})
	s.add_person("buyer",Vector3(0.95,0,4.6),"",{"bag":{"accepts":["wallet","goods"],"capacity":2,"items":["wallet"]}},{"seller":0.0,"shopper":1.0})
	s.choose_all()
	wait_until(s,func(): return c.did(s,"action","choose_item"),"buyer called from the queue edge reaches the counter and chooses",30.0)
