## Templates provide work; the executor owns bodies, preparation and all grants.
extends RefCounted
const TEMPLATES := {
	"pair_once":{"conditions":{"invited":"_invited"}},
	"service_customer":{"conditions":{"paid":"_paid", "calling":"_calling"}},
	"service_vendor":{"conditions":{}}
}
var owner: WeakRef
var s:
	get: return owner.get_ref()
var stalls: Dictionary = {}
var pairs: Dictionary = {}
var joints: Dictionary = {}
var intents: Dictionary = {} # scene-provided current object/receiver, not a relationship
var setups: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://npc/clip-setup.json")).clips

func _init(system) -> void:
	owner = weakref(system)

func special_row(r: Dictionary) -> bool:
	return TEMPLATES.has(r.get("use", ""))

func invitation_kind(r: Dictionary) -> String:
	return "pair:"+r.pair if r.get("use") == "pair_once" and r.get("role", "offer") != "reply" else ""

func special(c: Dictionary) -> bool:
	return not c.is_empty() and special_row(s.t.rows[c.row])

func person(id: String) -> Dictionary:
	for p in s.people:
		if p.id == id and not p.gone: return p
	return {}

func validate_row(id: String, r: Dictionary) -> String:
	var use: String = r.use
	if use == "pair_once":
		if r.get("target") != "person" or not s.t.get("pairs", {}).has(r.get("pair", "")): return "pair_once needs person/pair: " + id
		if s.t.pairs[r.pair].get("effect") == "transfer" and r.get("role") not in ["offer","reply"]: return "transfer pair needs role: " + id
	else:
		if not s.t.get("services", {}).has(r.get("service", "")): return "unknown service: " + id
		if r.has("target"): return "service supplies targets: " + id
	if r.has("action") or r.has("actions") or r.has("tool"): return "template supplies actions: " + id
	if not r.get("label") is String or r.label == "": return "template row needs label: " + id
	if not s._condition_known(r.get("when", "")): return "unknown entrance condition: " + id
	var base = r.get("base")
	if base is Dictionary:
		if not base.has("else"): return "base needs else: " + id
		for c in base:
			if c != "else" and not s._condition_known(c, false) and not has_condition(r, c): return "unknown template circumstance: " + c
			if not s._number(base[c]) or base[c] < 0: return "invalid base: " + id
	elif not s._number(base) or base < 0: return "invalid base: " + id
	if not r.get("tags", []) is Array: return "invalid tags: " + id
	for tag in r.get("tags", []):
		if not tag is String or tag == "": return "invalid tag: " + id
	return ""

func add_intent(id: String, sender: String, receiver: String, item: String, pair: String, container := "") -> String:
	if intents.has(id) or person(sender).is_empty() or person(receiver).is_empty() or sender == receiver or not s.items.has(item) or not s.t.pairs.has(pair) or s.t.pairs[pair].get("effect") != "transfer": return "invalid transfer intent"
	if container!="" and (not s.t.pairs[pair].has("supply") or not s.items.has(container) or item not in s.items[container].get("contents",[])): return "invalid finite transfer supply"
	if s.t.pairs[pair].has("supply"):
		var c: Dictionary=s.t.pairs[pair]
		if container=="" or s.items[container].kind!=s.t.actions[c.supply.draw].hands[c.supply.from_hand] or s.items[item].kind!=s.t.actions[c.offer].hands[c.supply.offer_hand]: return "supply item/container kind mismatch"
	intents[id] = {"sender":sender,"receiver":receiver,"item":item,"pair":pair,"container":container,"done":false}
	return ""

func validate_config() -> String:
	for id in s.t.get("pairs", {}):
		var c = s.t.pairs[id]
		if not c is Dictionary: return "invalid pair: " + id
		for k in c:
			if k not in ["offer", "reply", "wait", "layout", "effect", "reply_wait", "supply"]: return "unknown pair field: " + k
		if c.get("effect", "pair") not in ["pair","transfer"]: return "unknown pair effect: " + id
		for k in ["offer", "reply", "wait"]:
			if not s.t.actions.has(c.get(k, "")): return "missing pair action: " + id
		if s.t.actions[c.wait].mode != "hold" or s.t.actions[c.offer].mode != "once" or s.t.actions[c.reply].mode != "once": return "invalid pair action modes: " + id
		if not setups.get(c.get("layout", ""), {}).has("partner"): return "missing pair layout: " + id
		if c.has("reply_wait") and (not s.t.actions.has(c.reply_wait) or s.t.actions[c.reply_wait].mode!="hold"): return "invalid pair reply wait"
		if c.has("supply"):
			var supply=c.supply
			if not supply is Dictionary or not supply.keys().all(func(k):return k in ["draw","from_hand","offer_hand","reply_hand"]): return "invalid pair supply"
			if c.get("effect")!="transfer" or not s.t.actions.has(supply.get("draw","")) or s.t.actions[supply.draw].get("effect")!="draw": return "supply needs finite draw action"
			for hand in ["from_hand","offer_hand","reply_hand"]:
				if supply.get(hand) not in ["left","right"]: return "invalid supply hand"
			if supply.from_hand==supply.offer_hand: return "supply and transfer need separate hands"
	for id in s.t.get("services", {}):
		var c = s.t.services[id]
		if not c is Dictionary: return "invalid service: " + id
		for k in c:
			if k not in ["label", "payment_tool", "choose", "weigh", "packing", "idle", "checkout", "delivery", "delivery_layout", "queue_connection"]: return "unknown service field: " + k
		if c.has("queue_connection") and not s.t.get("connections",{}).has(c.queue_connection): return "unknown queue connection kind"
		if c.get("payment_tool", "") not in s.t.item_kinds: return "unknown payment tool: " + id
		if not c.get("label") is String or not c.get("packing") is Dictionary or not c.packing.get("TODO") is String: return "explicit packing TODO required: " + id
		for k in ["idle", "checkout", "delivery"]:
			if not c.get(k) is Array or c[k].size() != 2: return "service needs two actions: " + k
			for a in c[k]:
				if not s.t.actions.has(a): return "unknown service action: " + str(a)
		for k in ["choose"] + (["weigh"] if c.has("weigh") else []):
			if not s.t.actions.has(c.get(k, "")): return "missing service action: " + k
		if not setups.get(c.get("delivery_layout", ""), {}).has("partner"): return "missing delivery layout: " + id
		for a in c.checkout + c.delivery:
			if s.t.actions[a].mode != "once": return "joint action must be once: " + a
		if s.t.actions[c.checkout[0]].get("tool") != c.payment_tool: return "checkout tool mismatch"
		for action in ["prepare_payment_tool", "take_item", "queue_wait", "service_wait", "pair_wait"]:
			if not s.t.actions.has(action): return "missing service preparation: " + action
		if s.t.actions.prepare_payment_tool.get("tool") != c.payment_tool or s.t.actions.take_item.get("effect") != "take_surface": return "invalid service preparation contract"
	return ""

func location(row: String, target: String):
	var r: Dictionary = s.t.rows[row]
	if r.get("use") == "pair_once":
		var p := person(target)
		return null if p.is_empty() else p.pos
	if r.get("use", "").begins_with("service_"):
		return s.posts[stalls[target].queue_post].pos if stalls.has(target) else null
	return s.posts[target].pos if s.posts.has(target) else null

func compatible(p: Dictionary, other: Dictionary, kind: String) -> bool:
	if other.is_empty() or other.current.is_empty() or other.current.target != p.id or s.t.rows[other.current.row].get("pair", "") != kind: return false
	var mine: Dictionary = s.t.rows[p.current.row] if not p.current.is_empty() else {}
	var theirs: Dictionary = s.t.rows[other.current.row]
	return not mine.has("role") or mine.role != theirs.get("role",mine.role)

func has_condition(r: Dictionary, name: String) -> bool:
	return TEMPLATES.get(r.get("use", ""), {}).get("conditions", {}).has(name)

func condition(p: Dictionary, row: String, target: String, name: String) -> bool:
	var r: Dictionary = s.t.rows[row]
	return call(TEMPLATES[r.use].conditions[name], p, r, target)

func _invited(p: Dictionary, r: Dictionary, target: String) -> bool:
	var q := person(target)
	if q.is_empty() or q.current.is_empty() or q.current.target != p.id: return false
	var other: Dictionary = s.t.rows[q.current.row]
	return other.get("pair") == r.pair and (not r.has("role") or r.role != other.get("role")) and s.invitation_visible(p,q)

func _paid(p: Dictionary, _r: Dictionary, target: String) -> bool:
	return stalls.has(target) and stalls[target].paid.has(p.id)

func _calling(_p: Dictionary, _r: Dictionary, target: String) -> bool:
	if not stalls.has(target): return false
	var f: Dictionary = stalls[target]
	var v := person(f.keeper)
	return not v.is_empty() and not v.body.is_empty() and v.body.step.action == s.t.services[f.service].idle[0]

func targets(p: Dictionary, r: Dictionary) -> Array:
	if r.use == "pair_once":
		if s.t.pairs[r.pair].get("effect") == "transfer":
			var out: Array = []
			for intent in intents.values():
				if intent.pair != r.pair or intent.get("done",false): continue
				var offer := person(intent.sender)
				var reply := person(intent.receiver)
				if offer.is_empty() or reply.is_empty() or not supply_available(intent,offer,s.t.pairs[r.pair]) or offer.pos.distance_to(reply.pos) > s.t.defaults.invite_range: continue
				if r.get("role") == "offer" and p.id == offer.id: out.append(reply.id)
				if r.get("role") == "reply" and p.id == reply.id and offer.current.get("target") == reply.id: out.append(offer.id)
			return out
		# Only someone close enough to see the offered hand can be invited; the inviter does not walk over.
		return s.people.filter(func(q): return q.id != p.id and not q.gone and q.pos.distance_to(p.pos) <= s.t.defaults.invite_range).map(func(q): return q.id)
	return stalls.keys().filter(func(id): return stalls[id].service == r.service and stalls[id].open and (r.use == "service_vendor" or not person(stalls[id].keeper).is_empty()))

## Relative clip placement is identical for person pairs and facility delivery.
func partner_pose(clip: String, pos: Vector3, yaw: float) -> Dictionary:
	var layout: Dictionary = setups[clip].partner
	return {"pos":pos + Vector3(layout.at[0],0,layout.at[1]).rotated(Vector3.UP,yaw), "yaw":yaw+deg_to_rad(layout.yaw)}

func service_actions(config: Dictionary) -> Array:
	var actions: Array = [config.choose]
	if config.has("weigh"): actions.append(config.weigh)
	for key in ["idle", "checkout", "delivery"]: actions.append_array(config[key])
	return actions

func service_posts(config: Dictionary) -> Array:
	var kinds: Array = []
	for action in service_actions(config):
		var kind: String = s.t.actions[action].get("post", "")
		if kind != "" and kind not in kinds: kinds.append(kind)
	return kinds

func action_post(f: Dictionary, action: String) -> String:
	var kind: String = s.t.actions[action].get("post", "")
	return f.posts[kind] if kind != "" else ""

## Each required post comes from an action; the scene chooses its type provider.
func add_stall(id: String, config: Dictionary) -> String:
	if stalls.has(id): return "duplicate stall: " + id
	for k in config:
		if k not in ["service", "origin", "yaw", "posts", "queue", "queue_radius", "exit", "surface", "products"]: return "unknown stall field: " + k
	for k in ["service", "origin", "posts", "queue", "queue_radius", "exit", "surface", "products"]:
		if not config.has(k): return "stall missing " + k
	if not s.t.services.has(config.service) or not config.origin is Vector3 or not config.queue is Vector3 or not config.exit is Vector3 or not s._number(config.get("yaw", 0)) or not s._number(config.queue_radius) or config.queue_radius <= 0: return "invalid stall geometry/service"
	if not config.posts is Dictionary: return "invalid stall post providers"
	if not s.surfaces.has(config.surface) or not config.products is Array or config.products.is_empty(): return "invalid stall surface/products"
	var service: Dictionary = s.t.services[config.service]
	var product_ids: Array = []
	for product in config.products:
		if not product is Dictionary or not product.get("item") is String or not s.items.has(product.item) or s.items[product.item].kind != "goods" or product.item not in s.surfaces[config.surface].items or not product.get("weigh") is bool or not product.get("pack") is bool: return "invalid product"
		for k in product:
			if k not in ["item", "weigh", "pack"]: return "unknown product field: " + k
		if product.weigh and not service.has("weigh"): return "product needs undeclared weighing action"
		if product.item in product_ids: return "duplicate product"
		product_ids.append(product.item)
	var required := service_posts(service)
	for kind in config.posts:
		if kind not in required: return "unused stall post provider: " + str(kind)
	var f: Dictionary = config.duplicate(true)
	f.merge({"id":id,"open":true,"keeper":"","queue_ids":[],"paid":{},"active":{},"idle_index":0,"posts":{}}, true)
	var yaw: float = deg_to_rad(config.get("yaw", 0))
	var new_posts: Dictionary = {}
	for kind in required:
		var path = config.posts.get(kind)
		if not path is String or not ResourceLoader.exists(path, "PackedScene"): return "missing/invalid post provider: " + kind
		var root = load(path).instantiate()
		var marker = root.get_node_or_null("post_" + kind)
		if not marker is Node3D:
			root.free()
			return "provider missing post_" + kind + ": " + path
		var post: String = id + ":" + kind
		new_posts[post] = {"kind":kind,"pos":config.origin + marker.position.rotated(Vector3.UP,yaw),"yaw":yaw+marker.rotation.y}
		f.posts[kind] = post
		root.free()
	# These are semantic participant roles, independent of the post kind's name.
	f.vendor = action_post(f, service.idle[0])
	f.customer = action_post(f, service.choose)
	if f.vendor == "" or f.customer == "": return "service idle/choose need participant posts"
	f.vendor_posts = []
	var vendor_actions: Array = service.idle + [service.checkout[1],service.delivery[1]]
	if service.has("weigh"): vendor_actions.append(service.weigh)
	for action in vendor_actions:
		var post := action_post(f,action)
		if post != "" and post not in f.vendor_posts: f.vendor_posts.append(post)
	for role in ["queue", "exit"]:
		var post: String = id + ":" + role
		new_posts[post] = {"kind":role,"pos":config.origin + (config[role]-config.origin).rotated(Vector3.UP,yaw),"exclusive":false}
		f[role + "_post"] = post
	f.delivery = id + ":delivery"
	var vendor: Dictionary = new_posts[f.vendor]
	new_posts[f.delivery] = partner_pose(service.delivery_layout,vendor.pos,vendor.yaw)
	new_posts[f.delivery].kind = "delivery"
	s.posts.merge(new_posts)
	stalls[id] = f
	return ""

func valid(p: Dictionary) -> bool:
	var c: Dictionary = p.current
	var r: Dictionary = s.t.rows[c.row]
	if r.use == "pair_once":
		if s.t.pairs[r.pair].get("effect") == "transfer": return c.target in targets(p,r)
		return not person(c.target).is_empty()
	return stalls.has(c.target) and stalls[c.target].open

func pair_key(p: Dictionary, c: Dictionary) -> String:
	var ids: Array = [p.id, c.target]
	ids.sort()
	return s.t.rows[c.row].pair + ":" + ":".join(ids)

func is_customer(p: Dictionary, f: Dictionary) -> bool:
	return not p.is_empty() and not p.current.is_empty() and p.current.target == f.id and s.t.rows[p.current.row].get("use") == "service_customer"

func in_queue(p: Dictionary, f: Dictionary) -> bool:
	return not p.is_empty() and p.pos.distance_to(s.posts[f.queue_post].pos) <= f.queue_radius

func maintain() -> void:
	# Facility facts survive a change of purpose. No reservations are made here.
	for f in stalls.values():
		var vendor := person(f.keeper)
		if not vendor.is_empty() and vendor.pos.distance_to(s.posts[f.vendor].pos) > s.t.defaults.reach and not f.vendor_posts.any(func(post): return vendor.pos.distance_to(s.posts[post].pos) <= s.t.defaults.arrival): f.keeper = ""
		if vendor.is_empty(): f.keeper = ""
		var ordered: Array = s.people.duplicate()
		ordered.sort_custom(func(a,b): return a.id < b.id)
		for p in ordered:
			if p.gone or p.current.is_empty() or p.current.target != f.id: continue
			if s.t.rows[p.current.row].get("use") == "service_vendor" and p.pos.distance_to(s.posts[f.vendor].pos) <= s.t.defaults.arrival and f.keeper == "": f.keeper = p.id
			if is_customer(p, f) and in_queue(p, f) and p.id not in f.queue_ids and f.active.get("buyer", "") != p.id and not p.current.get("success", false): f.queue_ids.append(p.id)
		for id in f.queue_ids.duplicate():
			if not in_queue(person(id), f): f.queue_ids.erase(id)
		for id in f.paid.keys():
			if person(id).is_empty(): f.paid.erase(id)
		if not f.active.is_empty():
			var buyer := person(f.active.buyer)
			vendor = person(f.keeper)
			if not is_customer(buyer,f) or vendor.is_empty() or vendor.current.is_empty() or vendor.current.target != f.id or s.t.rows[vendor.current.row].get("use") != "service_vendor":
				# Walking from the queue edge to the counter leaves the queue area; that is not leaving the
				# service. The service ends when buying here stops being the buyer's current thing.
				cancel_service(f)
		if f.active.is_empty() and not person(f.keeper).is_empty():
			vendor = person(f.keeper)
			if vendor.current.is_empty() or s.t.rows[vendor.current.row].get("use") != "service_vendor" or vendor.current.target != f.id: continue
			while not f.queue_ids.is_empty():
				var id: String = f.queue_ids.pop_front()
				var buyer := person(id)
				if not is_customer(buyer,f):
					s._event(buyer,"queue_skip",f.id)
					continue
				s.serial += 1
				f.active = {"id":s.serial,"buyer":id,"item":f.paid.get(id,""),"chosen":f.paid.has(id),"weighed":f.paid.has(id),"checkout":f.paid.has(id)}
				break
	# Mutual intent becomes one layout instance. Earliest invitation owns offer; tie by ID.
	for p in s.people:
		if p.gone or p.current.is_empty() or s.t.rows[p.current.row].get("use") != "pair_once": continue
		var c: Dictionary = p.current
		var other := person(c.target)
		var kind: String = s.t.rows[c.row].pair
		var key := pair_key(p,c)
		if not compatible(p,other,kind):
			if c.has("matched"):
				s._end(p,"interrupted")
			elif s.clock - c.get("since",s.clock) >= s.t.defaults.invite_wait: s._end(p,"blocked")
			continue
		if pairs.has(key): continue
		var offer: Dictionary = p
		var reply: Dictionary = other
		if other.current.get("since",s.clock) < c.get("since",s.clock) or (other.current.get("since",s.clock) == c.get("since",s.clock) and other.id < p.id):
			offer = other
			reply = p
		var config: Dictionary = s.t.pairs[kind]
		if config.get("effect") == "transfer" and s.t.rows[offer.current.row].get("role") != "offer":
			var swap: Dictionary = offer
			offer = reply
			reply = swap
		var root: Vector3 = offer.pos
		var partner := partner_pose(config.layout,root,offer.yaw)
		var a := "pair:" + key + ":offer"
		var b := "pair:" + key + ":reply"
		s.posts[a] = {"kind":"pair","layout":true,"pos":root,"yaw":offer.yaw}
		s.posts[b] = partner
		s.posts[b].merge({"kind":"pair","layout":true})
		pairs[key] = {"key":key,"offer":offer.id,"reply":reply.id,"a":a,"b":b,"kind":kind,"since":s.clock,"choices":[offer.current.key,reply.current.key]}
		offer.current.matched = key
		reply.current.matched = key
	for key in pairs.keys():
		var pair: Dictionary = pairs[key]
		var a := person(pair.offer)
		var b := person(pair.reply)
		var timed_out: bool = s.clock-pair.since > s.t.defaults.activity_wait
		if a.is_empty() or b.is_empty() or not compatible(a,b,pair.kind) or a.current.get("matched") != key or b.current.get("matched") != key or timed_out:
			for p in [a,b]:
				if not p.is_empty() and p.current.get("matched") == key: s._end(p,"blocked" if timed_out else "interrupted")
			pairs.erase(key)
	for key in joints.keys():
		if not joint_valid(joints[key]): abort_joint(key)

func cancel_service(f: Dictionary) -> void:
	var old: Dictionary = f.active
	f.active = {}
	for key in joints.keys():
		if joints[key].get("service", "") == f.id: cancel_joint(key)
	for id in [old.buyer, f.keeper]:
		var p := person(id)
		if not p.is_empty(): p.body = {}
	s.next_think = s.clock

func ending(p: Dictionary, outcome: String) -> void:
	for f in stalls.values():
		if not f.active.is_empty() and p.id in [f.active.buyer,f.keeper]: cancel_service(f)
	# Pair cancellation is propagated by maintain after final selections; keep actual state.
	if outcome == "completed" and p.current.get("success", false): p.result["delivered"] = true

func work(p: Dictionary, action: String, target := "", extras: Dictionary = {}) -> Dictionary:
	var r := {"action":action,"use":"use_tool" if s.t.actions[action].has("tool") else "direct"}
	var w: Dictionary = s.action_preview(p, {"target":target}, r)
	if w.is_empty(): return {}
	w.steps[-1].erase("main")
	w.steps[-1].merge(extras,true)
	return w

func waiting(p: Dictionary, action: String, target: String) -> Dictionary:
	var w := work(p,action,target)
	if w.is_empty(): return {}
	w.steps[-1].merge({"action":"pair_wait","requires":action,"wait":true},true)
	return w

func take(p: Dictionary, item: String, surface: String) -> Dictionary:
	if p.held == item: return work(p,"pair_wait","",{"wait":true})
	var w := work(p,"take_item")
	if w.is_empty(): return {}
	w.steps[-1].merge({"item":item,"surface":surface})
	w.resources.append("item:" + item)
	return w

func preview(p: Dictionary, c: Dictionary) -> Dictionary:
	var r: Dictionary = s.t.rows[c.row]
	if r.use == "pair_once":
		var key := pair_key(p,c)
		if pairs.has(key) and c.get("matched") == key:
			var pair: Dictionary = pairs[key]
			var config: Dictionary = s.t.pairs[r.pair]
			# Matched: nobody is waiting for an answer any more, both are getting into place.
			# waiting() keeps the handshake's own preparation (empty hands), then holds pair_wait.
			var mine: bool = pair.offer == p.id
			if mine and config.has("supply"):
				var intent:=transfer_intent(p.id,pair.reply,r.pair)
				if intent.is_empty() or not supply_available(intent,p,config): return {}
				if s.hand_item(p,config.supply.offer_hand)!=intent.item:
					var w:=work(p,config.supply.draw,"",{"item":intent.item,"container":intent.container,"hand":config.supply.offer_hand,"from_hand":config.supply.from_hand})
					if not w.is_empty(): w.resources.append_array(["item:"+intent.item,"item:"+intent.container])
					return w
			return waiting(p,config.offer if mine else config.reply,pair.a if mine else pair.b)
		var config: Dictionary=s.t.pairs[r.pair]
		return work(p,config.get("reply_wait",config.wait) if r.get("role")=="reply" else config.wait,"",{"wait":true})
	var f: Dictionary = stalls[c.target]
	var config: Dictionary = s.t.services[r.service]
	if c.get("success",false): return work(p,"walk",f.exit_post,{"finish":true})
	var active: Dictionary = f.active
	if r.use == "service_customer":
		if not f.paid.has(p.id) and not s._held(p,config.payment_tool) and s._stored(p,config.payment_tool).is_empty(): return {}
		if active.is_empty() or active.buyer != p.id:
			var diversion: Dictionary = s.supports.waiting_connection(p,config.get("queue_connection",""),f.queue_post)
			return diversion if not diversion.is_empty() else work(p,"queue_wait",f.queue_post,{"wait":true})
		if not active.chosen: return work(p,config.choose,f.customer,{"service_step":"choose"})
		var point: String = f.delivery if active.checkout else f.customer
		if active.checkout: return waiting(p,"receive_item",point)
		return work(p,"prepare_payment_tool",point,{"wait":true})
	# Clear held goods through the same put_down primitive, always onto this stall.
	if p.held != "":
		var w := work(p,"put_down")
		if w.is_empty(): return {}
		w.steps[-1].merge({"item":p.held,"surface":f.surface})
		w.resources = ["surface:"+f.surface]
		# Keep the selected delivery item in hand when ready to give.
		if not active.is_empty() and active.checkout and active.item == p.held: return waiting(p,"give_item",f.vendor)
		return w
	if active.is_empty():
		var action: String = config.idle[f.idle_index % config.idle.size()]
		return work(p,action,action_post(f,action),{"idle":true})
	if not active.chosen: return work(p,"service_wait",f.vendor,{"wait":true})
	if active.checkout:
		var w := take(p,active.item,f.surface)
		if not w.is_empty() and p.pos.distance_to(s.posts[f.vendor].pos) > s.t.defaults.arrival: return work(p,"walk",f.vendor)
		return w
	var product := product_for(f,active.item)
	if product.weigh and not active.weighed: return work(p,config.weigh,action_post(f,config.weigh),{"service_step":"weigh"})
	return waiting(p,"confirm_checkout",f.vendor)

func product_for(f: Dictionary, item: String) -> Dictionary:
	for product in f.products:
		if product.item == item: return product
	return {}

func completed(p: Dictionary, step: Dictionary) -> void:
	if step.get("finish",false):
		s._end(p,"completed")
		return
	var r: Dictionary = s.t.rows[p.current.row]
	if r.use == "pair_once": return
	var f: Dictionary = stalls[p.current.target]
	if step.get("idle",false): f.idle_index += 1
	if f.active.is_empty(): return
	var active: Dictionary = f.active
	match step.get("service_step", ""):
		"choose":
			var available: Array = f.products.filter(func(product): return product.item in s.surfaces[f.surface].items and product.item not in f.paid.values())
			if available.is_empty():
				s._end(p,"blocked")
				return
			var product: Dictionary = available[p.rng.randi_range(0,available.size()-1)]
			active.item = product.item
			active.chosen = true
			if product.pack:
				var message: String = "未设计：" + s.t.services[f.service].packing.TODO
				s._end(p,"todo")
				p.result.message = message
				p.notice = {"text":message,"until":s.clock+s.t.defaults.hold_demo}
		"weigh": active.weighed = true
	s.next_think = s.clock

## One shared joint primitive: captured choices + bodies + atomic grant + atomic commit.
func make_joint(key: String, a: Dictionary, b: Dictionary, actions: Array, points: Array, effect: String, extra: Dictionary = {}) -> Dictionary:
	var j := {"key":key,"actors":[a.id,b.id],"choices":[a.current.key,b.current.key],"instances":[a.current.get("instance",0),b.current.get("instance",0)],"actions":actions,"points":points,"effect":effect,"elapsed":0.0,"committed":false,"bodies":[]}
	j.merge(extra)
	return j

func joint_valid(j: Dictionary) -> bool:
	for i in 2:
		var p := person(j.actors[i])
		if p.is_empty() or p.current.get("key", "") != j.choices[i] or p.current.get("instance",0) != j.instances[i]: return false
		if not j.bodies.is_empty() and p.body.get("id",-1) != j.bodies[i]: return false
		if s.posts[j.points[i]].has("yaw") and not is_zero_approx(wrapf(p.yaw-s.posts[j.points[i]].yaw,-PI,PI)): return false
		if p.pos.distance_to(s.posts[j.points[i]].pos) > s.t.defaults.arrival or not s._ready(p,{"action":j.actions[i]}): return false
	if j.has("service"):
		var f: Dictionary = stalls[j.service]
		if f.active.get("id",-1) != j.session or f.active.item != j.item: return false
		if j.effect == "checkout": return not f.active.checkout and not f.paid.has(j.actors[0]) and j.item in s.surfaces[f.surface].items
		return f.paid.get(j.actors[0], "") == j.item and person(j.actors[1]).held == j.item
	if j.effect == "transfer": return s.hand_item(person(j.actors[0]),j.get("from_hand","right")) == j.item and s.hand_item(person(j.actors[1]),j.get("to_hand","right")) == "" and intents.has(j.intent) and not intents[j.intent].get("done",false)
	return true

func requests() -> Array:
	var out: Array = []
	var proposals: Array = []
	for pair in pairs.values():
		var a := person(pair.offer)
		var b := person(pair.reply)
		if a.is_empty() or b.is_empty(): continue
		var config: Dictionary = s.t.pairs[pair.kind]
		var extra := {}
		var effect: String = config.get("effect","pair")
		if effect == "transfer":
			for id in intents:
				if intents[id].pair==pair.kind and intents[id].sender == a.id and intents[id].receiver == b.id and not intents[id].get("done",false): extra = {"intent":id,"item":intents[id].item,"from_hand":config.get("supply",{}).get("offer_hand","right"),"to_hand":config.get("supply",{}).get("reply_hand","right")}
			if extra.is_empty(): continue
		proposals.append(make_joint(pair.key,a,b,[config.offer,config.reply],[pair.a,pair.b],effect,extra))
	for f in stalls.values():
		if f.active.is_empty() or not f.active.chosen: continue
		var active: Dictionary = f.active
		var a := person(active.buyer)
		var b := person(f.keeper)
		if a.is_empty() or b.is_empty(): continue
		var config: Dictionary = s.t.services[f.service]
		var product := product_for(f,active.item)
		if not active.checkout and product.weigh and not active.weighed: continue
		var actions: Array = config.delivery if active.checkout else config.checkout
		proposals.append(make_joint("service:"+str(active.id)+str(active.checkout),a,b,actions,[f.delivery if active.checkout else f.customer,f.vendor],"delivery" if active.checkout else "checkout",{"service":f.id,"session":active.id,"item":active.item}))
	for j in proposals:
		if joints.has(j.key) or (j.has("service") and not joint_valid(j)): continue
		var resources: Array = []
		var owners := {}
		var score := INF
		var feasible := true
		for i in 2:
			var p := person(j.actors[i])
			score = minf(score,s._score(p,p.current.row,p.current.target,false)+p.current.jitter)
			var needs: Array = ["post:"+j.points[i],"role:"+p.id]
			if not j.has("service"):
				var plan: Dictionary = preview(p,p.current)
				if plan.is_empty():
					feasible = false
				else: needs.append_array(plan.resources)
			for resource in needs:
				if resource not in resources: resources.append(resource)
				owners[resource] = p.id
		if not feasible: continue
		if j.has("item"):
			resources.append("item:"+j.item)
			owners["item:"+j.item] = j.actors[1] if j.has("service") else j.actors[0]
		out.append({"p":person(j.actors[0]),"c":{"key":j.key,"score":score},"work":{"resources":resources},"owners":owners,"joint":j})
	return out

func start_joint(j: Dictionary) -> void:
	if not joint_valid(j):
		for id in j.actors:
			var p := person(id)
			if p.is_empty(): continue
			var plan: Dictionary = s.preview(p,p.current) if not p.current.is_empty() else {}
			s._release(id,plan.get("resources",[]))
		return
	joints[j.key] = j
	for i in 2:
		var p := person(j.actors[i])
		s.serial += 1
		p.body = {"id":s.serial,"joint":j.key,"step":{"action":j.actions[i]},"elapsed":0.0,"effect":false}
		j.bodies.append(s.serial)
		p.yaw = s.posts[j.points[i]].get("yaw",p.yaw)
		s._event(p,"action",j.actions[i])

func cancel_joint(key: String) -> void:
	var j: Dictionary = joints[key]
	joints.erase(key)
	for id in j.actors:
		var p := person(id)
		if not p.is_empty() and p.body.get("joint") == key: p.body = {}
		if s.reserved.get("role:"+id) == id: s.reserved.erase("role:"+id)
	if j.has("item"): s.reserved.erase("item:"+j.item)

func abort_joint(key: String) -> void:
	var j: Dictionary = joints[key]
	cancel_joint(key)
	if j.has("service"):
		var a := person(j.actors[0])
		if not a.is_empty() and a.current.get("instance",-1)==j.instances[0]: s._end(a,"blocked")
	else:
		for i in j.actors.size():
			var p := person(j.actors[i])
			if not p.is_empty() and p.current.get("instance",-1)==j.instances[i]: s._end(p,"interrupted")

func advance_joints(dt: float) -> void:
	for key in joints.keys():
		var j: Dictionary = joints[key]
		if not joint_valid(j):
			abort_joint(key)
			continue
		j.elapsed += dt
		for id in j.actors: person(id).body.elapsed = j.elapsed
		# Align the logical handoff with an assigned native receiving pause.
		# Unbound partners supply semantics, never a fabricated source frame.
		var at: float = -1.0
		for action in j.actions: at = maxf(at,s.material_time(action,"effect_frame"))
		if j.elapsed >= (at if at >= 0.0 else s.t.defaults.once_demo): commit_joint(j)

func commit_joint(j: Dictionary) -> bool:
	if not joints.has(j.key) or j.committed or not joint_valid(j): return false
	j.committed = true
	var a := person(j.actors[0])
	var b := person(j.actors[1])
	match j.effect:
		"transfer":
			s.set_hand(a,j.get("from_hand","right"),"")
			s.set_hand(b,j.get("to_hand","right"),j.item)
			intents[j.intent].done = true
		"checkout":
			var f: Dictionary = stalls[j.service]
			f.paid[a.id] = j.item
			f.active.checkout = true
		"delivery":
			var f: Dictionary = stalls[j.service]
			b.held = ""
			a.held = j.item
			f.paid.erase(a.id)
			a.current.success = true
			f.active = {}
	for p in [a,b]: s._event(p,"joint_effect",j.effect)
	cancel_joint(j.key)
	if not j.has("service"):
		s._end(a,"completed")
		s._end(b,"completed")
	s.next_think = s.clock
	return true

func transfer_intent(sender: String, receiver: String, pair: String) -> Dictionary:
	for intent in intents.values():
		if intent.sender==sender and intent.receiver==receiver and intent.pair==pair and not intent.done: return intent
	return {}

func supply_available(intent: Dictionary, offer: Dictionary, config: Dictionary) -> bool:
	if not config.has("supply"): return offer.held==intent.item
	var source: String=intent.get("container","")
	if not s.items.has(source): return false
	var accessible: bool=s.hand_item(offer,config.supply.from_hand)==source or offer.storage.values().any(func(slot):return source in slot.items)
	return accessible and (s.hand_item(offer,config.supply.offer_hand)==intent.item or intent.item in s.items[source].get("contents",[]))

func withdraw(id: String, stall: String) -> void:
	if not stalls.has(stall): return
	var p := person(id)
	if is_customer(p,stalls[stall]): s._end(p,"blocked")
	stalls[stall].queue_ids.erase(id)

func end_duty(stall: String) -> void:
	if not stalls.has(stall): return
	var f: Dictionary = stalls[stall]
	var p := person(f.keeper)
	if not p.is_empty() and not p.current.is_empty() and p.current.target == stall and s.t.rows[p.current.row].get("use") == "service_vendor": s._end(p,"blocked")
	f.keeper = ""

func lines(p: Dictionary) -> PackedStringArray:
	var r: Dictionary = s.t.rows[p.current.row]
	var upper: String = r.label
	var lower: String = s.t.actions[p.body.step.action].label if not p.body.is_empty() else "准备中"
	return PackedStringArray([upper,lower])
