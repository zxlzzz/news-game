## Independent text executor. No motion assets or old Crowd state are touched.
extends RefCounted

const Cooperation := preload("res://npc/text_behavior/cooperation.gd")
var coop = Cooperation.new(self)
const Activities := preload("res://npc/text_behavior/activities.gd")
var activities = Activities.new(self)
const Supports := preload("res://npc/text_behavior/supports.gd")
var supports = Supports.new(self)

const TABLE := "res://npc/text_behavior/table.json"
var t: Dictionary
var error := ""
var people: Array = []
var posts: Dictionary = {}
var surfaces: Dictionary = {}
var items: Dictionary = {}
var occupied: Dictionary = {} # actual body/item occupancy, rebuilt before each decision
var reserved: Dictionary = {} # approach/preparation reservations, owner = stable person ID
var clock := 0.0
var next_think := 0.0
var planner: Callable
var trace: Array = []
var tracing := false
var serial := 0

func handler(r: Dictionary):
	if supports.special_row(r): return supports
	if coop.special_row(r): return coop
	if activities.special_row(r): return activities
	return null

func binding(action: String, held_kind := "", offhand_kind := ""):
	if offhand_kind!="": return null # no two-object material has been verified
	if t.get("bindings",{}).has(action):
		return t.bindings[action].get("empty" if held_kind == "" else held_kind,t.bindings[action].get("held"))
	return t.actions[action].get("clip")

## Native material events are assigned from inspected hand pauses, never inferred ownership.
func material_time(action: String, field := "frames") -> float:
	var m: Dictionary = t.actions[action].get("material",{})
	return (float(m[field]) - (1.0 if field == "frames" else 0.0)) / float(m.fps) if not m.is_empty() else -1.0

func finishing(p: Dictionary) -> bool:
	return not p.body.is_empty() and p.body.get("effect",false) and not p.body.has("joint") and t.actions[p.body.step.action].has("material")

func special(c: Dictionary) -> bool:
	return not c.is_empty() and handler(t.rows[c.row]) != null

## Read-only invitation matching prevents reciprocal swaps and longer directed cycles.
## It only chooses which circumstance can boost a candidate; it never chooses a person's activity.
func invitation_visible(receiver: Dictionary, sender: Dictionary) -> bool:
	if receiver.current.get("matched", "") != "" and receiver.current.get("matched") == sender.current.get("matched"): return true
	var proposals: Array = []
	var used := {}
	for p in people:
		if p.gone or p.current.is_empty(): continue
		if p.current.has("matched"):
			used[p.id] = true
			continue
		var module = handler(t.rows[p.current.row])
		if module != null and module.invitation_kind(t.rows[p.current.row]) != "": proposals.append(p)
	proposals.sort_custom(func(a,b):
		if a.current.since != b.current.since: return a.current.since < b.current.since
		var ak := "%s:%s:%s" % [t.defaults.seed,a.id,a.current.key]
		var bk := "%s:%s:%s" % [t.defaults.seed,b.id,b.current.key]
		return ak.hash() < bk.hash() if ak.hash() != bk.hash() else ak < bk)
	for p in proposals:
		if used.has(p.id) or used.has(p.current.target): continue
		if p.id == sender.id and p.current.target == receiver.id: return true
		used[p.id] = true
		used[p.current.target] = true
	return false

func maintain() -> void:
	supports.maintain()
	coop.maintain()
	activities.maintain()
	var live: Array = activities.live_posts()
	for pair in coop.pairs.values(): live.append_array([pair.a,pair.b])
	for post in posts.keys():
		if not posts[post].get("layout",false) or post in live: continue
		if not reserved.has("post:"+post) and not people.any(func(p): return not p.gone and (p.place == post or p.support == post)): posts.erase(post)

func _init(data = null) -> void:
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(TABLE)) if data == null else data
	if not parsed is Dictionary:
		error = "table is not a JSON object"
		return
	t = parsed.duplicate(true)
	error = validate()

func validate() -> String:
	if not t is Dictionary or not t.get("defaults") is Dictionary or not t.get("actions") is Dictionary or not t.get("rows") is Dictionary:
		return "table needs defaults/actions/rows"
	if not t.get("item_kinds") is Array: return "table needs item_kinds"
	if not t.get("bindings",{}) is Dictionary: return "invalid bindings"
	for definitions in ["pairs", "services"]:
		if t.has(definitions) and not t[definitions] is Dictionary: return "invalid definitions: " + definitions
	for kind in t.item_kinds:
		if not kind is String or kind.is_empty(): return "invalid item kind"
	for k in ["half", "sight", "jitter", "rethink", "again", "hold_demo", "once_demo", "speed", "arrival", "reach", "seed", "invite_wait", "invite_range"]:
		if not _number(t.defaults.get(k)) or float(t.defaults[k]) < 0:
			return "invalid default: " + k
	for k in ["half", "rethink", "hold_demo", "once_demo", "speed", "arrival"]:
		if t.defaults[k] <= 0: return "default must be positive: " + k
	for id in t.actions:
		var a = t.actions[id]
		if not a is Dictionary: return "bad action: " + id
		for k in a:
			if k not in ["label", "mode", "posture", "empty", "holding", "tool", "post", "effect", "clip", "speed", "hands", "material"]: return "unknown action field: " + k
		if not a.get("label") is String or a.get("mode") not in ["once", "hold", "move"] or a.get("posture") not in ["any", "all", "ground", "standing", "seated", "ground_seated", "lying", "supported_seated", "hanging", "inverted"]:
			return "action needs label/mode/posture: " + id
		if a.get("clip") != null and (not a.clip is String or not FileAccess.file_exists("res://npc/motion/"+a.clip+".json")): return "invalid action clip: " + id
		if a.has("material"):
			var m = a.material
			if not m is Dictionary or a.get("clip") == null or a.mode != "once" or not _number(m.get("fps")) or m.fps <= 0 or not _number(m.get("frames")) or m.frames < 2 or not _number(m.get("effect_frame")) or m.effect_frame < 0 or m.effect_frame >= m.frames: return "invalid native material timing: " + id
			if m.get("event_status") != "assigned" or not m.get("result") is Dictionary or m.result.get("kind") not in t.item_kinds or m.result.get("hand") not in ["left","right"]: return "invalid material result: " + id
		if a.has("speed") and (not _number(a.speed) or a.speed <= 0 or a.mode != "move"): return "invalid moving speed: " + id
		if a.get("effect", "") not in ["", "stow", "put", "take", "stand", "sit", "leave", "take_surface", "deposit", "collect", "rise", "ground_seated", "lying", "balance", "draw"]: return "unknown effect: " + id
		if a.has("hands"):
			if not a.hands is Dictionary or a.hands.is_empty() or a.has("empty") or a.has("tool") or a.has("holding"): return "conflicting hand declaration: " + id
			for hand in a.hands:
				if hand not in ["left","right"] or a.hands[hand] not in ["empty","held","any"] + t.item_kinds: return "invalid hand requirement: " + id
		if a.get("effect","") == "draw" and a.mode != "once": return "container draw must be once"
		if a.has("empty") and not a.empty is bool: return "empty must be bool: " + id
		if a.has("holding") and (not a.holding is bool or a.get("empty",false)): return "invalid holding condition: " + id
		if a.get("empty", false) and a.has("tool"): return "empty and tool conflict: " + id
		for k in ["tool", "post"]:
			if a.has(k) and (not a[k] is String or a[k].is_empty()): return "invalid action parameter: " + id + "." + k
		if a.has("tool") and a.tool not in t.item_kinds: return "unknown action tool: " + id
		if a.get("effect", "") in ["stow", "put", "take", "stand", "sit", "take_surface"] and a.mode != "once": return "preparation must be once: " + id
		if a.get("effect", "") == "leave" and a.mode != "move": return "leave effect needs move: " + id
		if a.get("effect", "") in ["collect","deposit","rise","ground_seated","lying","balance"] and a.mode != "once": return "state-changing action must be once: " + id
	for id in ["stow_item", "put_down", "take_tool", "stand_up", "sit_down", "walk"]:
		if not t.actions.has(id): return "missing preparation: " + id
	for id in {"stow_item":"stow", "put_down":"put", "take_tool":"take", "stand_up":"stand", "sit_down":"sit"}:
		var effects := {"stow_item":"stow", "put_down":"put", "take_tool":"take", "stand_up":"stand", "sit_down":"sit"}
		if t.actions[id].get("effect", "") != effects[id]: return "wrong preparation effect: " + id
	for id in t.rows:
		var r = t.rows[id]
		if not r is Dictionary: return "bad row: " + id
		if r.has("enabled") and not r.enabled is bool: return "enabled must be bool: " + id
		if not r.get("enabled", true): continue
		if r.has("label") and not r.label is String: return "label must be string: " + id
		for k in r:
			if k not in ["enabled", "note", "base", "action", "actions", "label", "use", "tool", "target", "when", "tags", "pair", "service", "activity", "role", "process", "response", "operation"]: return "unknown row field: " + k
		if handler(r) != null:
			var issue: String = handler(r).validate_row(id, r)
			if issue != "": return issue
			continue
		var pool: bool = r.has("actions")
		if pool:
			if r.has("action") or r.get("use", "direct") != "direct" or r.has("target") or r.has("tool") or not r.get("label") is String: return "invalid direct action pool: " + id
			if not r.actions is Array or r.actions.is_empty(): return "empty/invalid action pool: " + id
		var action_ids: Array = r.actions if pool else [r.get("action", "")]
		for action in action_ids:
			if not action is String or not t.actions.has(action): return "unknown action: " + id
		if r.get("use", "direct") not in ["direct", "use_tool", "go_use"]: return "unknown template: " + id
		if r.get("use", "direct") == "use_tool" and (not r.get("tool") is String or r.tool.is_empty()): return "use_tool needs tool: " + id
		if r.has("tool") and r.tool not in t.item_kinds: return "unknown row tool: " + id
		if r.has("target") and (not r.target is String or not r.target.begins_with("post:") or r.target.length() <= 5): return "invalid target: " + id
		if r.get("use", "direct") == "go_use" and not r.has("target"): return "go_use needs target: " + id
		for action in action_ids:
			var a: Dictionary = t.actions[action]
			if a.get("effect", "") in ["stow", "put", "take", "stand", "sit", "take_surface"]: return "preparation is not a main action: " + id
			if a.has("post") and r.get("target", "") != "post:" + a.post: return "action/post mismatch: " + id
			if a.mode == "move" and not r.has("target"): return "move needs target: " + id
			if r.has("tool") and a.get("tool", "") != r.tool: return "tool/action mismatch: " + id
			if pool and (a.mode != "once" or a.has("effect") or a.has("post")): return "pool needs ordinary in-place once actions: " + id
		if not _condition_known(r.get("when", "")): return "unknown condition: " + str(r.get("when"))
		var base = r.get("base")
		if base is Dictionary:
			if not base.has("else"): return "base needs else: " + id
			for c in base:
				if c != "else" and not _condition_known(c, false): return "unknown base condition: " + c
				if not _number(base[c]) or base[c] < 0: return "invalid base: " + id
		elif not _number(base) or base < 0: return "invalid base: " + id
		if not r.get("tags", []) is Array: return "tags must be array: " + id
		for tag in r.get("tags", []):
			if not tag is String or tag.is_empty(): return "invalid tag: " + id
	for action in t.get("bindings",{}):
		if not t.actions.has(action) or not t.bindings[action] is Dictionary: return "invalid binding action"
		for hand in t.bindings[action]:
			if hand not in ["empty","held"] and hand not in t.item_kinds: return "invalid binding hand"
			var clip = t.bindings[action][hand]
			if clip != null and (not clip is String or not FileAccess.file_exists("res://npc/motion/"+clip+".json")): return "invalid conditional clip"
	var issue: String = coop.validate_config()
	if issue != "": return issue
	issue = activities.validate_config()
	return issue if issue != "" else supports.validate_config()

func _number(v) -> bool:
	return (v is float or v is int) and is_finite(float(v))

func _condition_known(c, allow_empty := true) -> bool:
	if not c is String: return false
	if c == "": return allow_empty
	if c in ["standing", "seated"]: return true
	for prefix in ["held(", "stored("]:
		if c.begins_with(prefix) and c.ends_with(")") and c.length() > prefix.length() + 1:
			return c.substr(prefix.length(), c.length() - prefix.length() - 1) in t.item_kinds
	return false

func add_person(id: String, pos: Vector3, held := "", storage: Dictionary = {}, tags: Dictionary = {}) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(t.defaults.seed) + id.hash()
	var p := {"id":id, "pos":pos, "yaw":0.0, "held":held, "offhand":"", "storage":storage.duplicate(true), "support":"", "bearing":"", "ground":"standing", "can_rise":true, "unstable":false, "place":"", "current":{}, "body":{}, "done":{}, "tags":tags, "rng":rng, "gone":false, "result":{}}
	people.append(p)
	return p

func check_world() -> String:
	var ids := {}
	var locations := {}
	for p in people:
		if ids.has(p.id): return "duplicate person: " + p.id
		ids[p.id] = true
		for r in t.rows.values():
			if not r.get("enabled", true): continue
			for tag in r.get("tags", []):
				if not _number(p.tags.get(tag)) or p.tags[tag] < 0: return "missing/invalid personal coefficient: " + tag
		var carried: Array = []
		if p.held != "": carried.append(p.held)
		if p.get("offhand","") != "": carried.append(p.offhand)
		for slot in p.storage.values():
			if not slot.get("items") is Array or not slot.get("accepts") is Array or not _number(slot.get("capacity")) or slot.capacity < slot.items.size(): return "invalid storage: " + p.id
			for kind in slot.accepts:
				if kind not in t.item_kinds: return "unknown storage item kind: " + str(kind)
			for item in slot.items:
				if not items.has(item) or items[item].kind not in slot.accepts: return "invalid stored item: " + str(item)
			carried.append_array(slot.items)
		for item in carried:
			if not items.has(item) or locations.has(item): return "missing/duplicate item: " + str(item)
			locations[item] = p.id
		if p.support != "" and (not posts.has(p.support) or not posts[p.support].get("seat",posts[p.support].kind == "sit") or p.ground != "standing" or p.pos.distance_to(posts[p.support].pos) > t.defaults.arrival): return "invalid seat support"
	for id in surfaces:
		var s: Dictionary = surfaces[id]
		if not s.get("pos") is Vector3 or not s.get("items") is Array or not _number(s.get("capacity")) or s.capacity < s.items.size(): return "invalid surface: " + id
		for flag in ["accept_put","accept_take"]:
			if s.has(flag) and not s[flag] is bool: return "invalid surface access: " + id
		for item in s.items:
			if not items.has(item) or locations.has(item): return "missing/duplicate surface item: " + str(item)
			locations[item] = id
	for id in items:
		var container: Dictionary = items[id]
		if not container.has("contents"): continue
		if not container.contents is Array or not container.get("accepts") is Array or not _number(container.get("capacity")) or container.capacity < container.contents.size(): return "invalid container: " + id
		if not container.accepts.all(func(kind):return kind in t.item_kinds): return "unknown container item kind: " + id
		for child in container.contents:
			if not items.has(child) or child == id or locations.has(child) or items[child].kind not in container.accepts: return "missing/duplicate container item: " + str(child)
			locations[child] = id
	for id in items:
		if items[id].get("kind") not in t.item_kinds or not locations.has(id): return "item has no actual location/kind: " + id
		var ancestors := {}
		var parent: String = id
		while items.has(parent):
			if ancestors.has(parent): return "container cycle: " + id
			ancestors[parent] = true
			parent = locations.get(parent,"")
	for id in posts:
		if not posts[id].get("pos") is Vector3 or not posts[id].get("kind") is String: return "invalid post: " + id
		if posts[id].has("exclusive") and not posts[id].exclusive is bool: return "exclusive must be bool: " + id
		if posts[id].has("rise_clear") and not posts[id].rise_clear is bool: return "rise_clear must be bool: " + id
		for other in posts:
			if id != other and not posts[id].get("layout", false) and not posts[other].get("layout", false) and posts[id].get("exclusive", true) and posts[other].get("exclusive", true) and posts[id].pos.distance_to(posts[other].pos) <= t.defaults.arrival * 2:
				return "overlapping exclusive posts: " + id + "/" + other
	var issue := activities.check_world()
	return issue if issue != "" else supports.check_world()

func _held(p: Dictionary, kind: String) -> bool:
	return p.held != "" and items.has(p.held) and items[p.held].kind == kind

## Legacy held remains the right-hand item; an independent left slot is generic.
## A single two-handed object still has one owner/location, never two copies.
func hand_item(p: Dictionary, hand := "right") -> String:
	return p.held if hand == "right" else p.get("offhand","")

func set_hand(p: Dictionary, hand: String, item: String) -> void:
	p["held" if hand == "right" else "offhand"] = item

func hand_requirements(a: Dictionary) -> Dictionary:
	if a.has("hands"): return {"left":a.hands.get("left","empty"),"right":a.hands.get("right","empty")}
	if a.get("effect","") in ["stow","put","take","deposit"]: return {}
	var restrict_left: bool=a.get("empty",false) or a.has("tool") or a.get("holding",false) or a.get("clip")!=null
	return {"left":"empty" if restrict_left else "any","right":"empty" if a.get("empty",false) else a.get("tool","held" if a.get("holding",false) else "any")}

func hands_ready(p: Dictionary, a: Dictionary) -> bool:
	var requirements := hand_requirements(a)
	for hand in requirements:
		var item := hand_item(p,hand)
		var need: String = requirements[hand]
		if need == "any": continue
		if need == "empty" and item != "": return false
		if need == "held" and item == "": return false
		if need not in ["empty","held"] and (not items.has(item) or items[item].kind != need): return false
	return true

func prepare_hands(q: Dictionary, requirements: Dictionary, allow_tools: bool, steps: Array, resources: Array) -> bool:
	for hand in ["left","right"]:
		var need: String = requirements.get(hand,"any")
		var item := hand_item(q,hand)
		if need == "any" or (need == "held" and item != ""): continue
		if need == "held": return false
		if need != "empty" and item != "" and items[item].kind == need: continue
		if item != "":
			var slot := ""
			for id in q.storage:
				if items[item].kind in q.storage[id].accepts and q.storage[id].items.size() < q.storage[id].capacity:
					slot = id
					break
			if slot != "":
				steps.append({"action":"stow_item","item":item,"slot":slot,"hand":hand})
				q.storage[slot].items.append(item)
			else:
				var surface := ""
				var ids: Array = surfaces.keys()
				ids.sort()
				for id in ids:
					if surfaces[id].get("accept_put",true) and q.pos.distance_to(surfaces[id].pos) <= t.defaults.reach and surfaces[id].items.size() < surfaces[id].capacity:
						surface = id
						break
				if surface == "": return false
				steps.append({"action":"put_down","item":item,"surface":surface,"hand":hand})
				resources.append("surface:"+surface)
			set_hand(q,hand,"")
		if need != "empty":
			if not allow_tools: return false
			var source := _stored(q,need)
			if source.is_empty(): return false
			steps.append({"action":"take_tool","item":source.item,"slot":source.slot,"hand":hand})
			q.storage[source.slot].items.erase(source.item)
			set_hand(q,hand,source.item)
	return true

func _stored(p: Dictionary, kind: String) -> Dictionary:
	for slot in p.storage:
		for item in p.storage[slot].items:
			if items[item].kind == kind: return {"slot":slot, "item":item}
	return {}

func _gate(p: Dictionary, c: String) -> bool:
	if c == "": return true
	if c == "standing": return supports.body_state(p).kind == "standing"
	if c == "seated": return supports.body_state(p).kind in ["seated","supported_seated"]
	var kind := c.get_slice("(", 1).trim_suffix(")")
	return _held(p, kind) if c.begins_with("held(") else not _stored(p, kind).is_empty()

func _key(row: String, target: String) -> String:
	return row + "@" + target

func _score(p: Dictionary, row: String, target: String, entry: bool) -> float:
	var r: Dictionary = t.rows[row]
	if entry and not _gate(p, r.get("when", "")): return 0.0
	var s := 0.0
	if r.base is Dictionary:
		var hit := false
		for c in r.base:
			if c != "else" and (handler(r).condition(p, row, target, c) if handler(r) != null and handler(r).has_condition(r, c) else _gate(p, c)):
				s = maxf(s, r.base[c])
				hit = true
		if not hit: s = r.base.else
	else: s = r.base
	for tag in r.get("tags", []): s *= p.tags[tag]
	if target != "":
		var location = handler(r).location(row, target) if handler(r) != null else coop.location(row, target)
		if location == null: return 0.0
		var d: float = p.pos.distance_to(location)
		if entry and d > t.defaults.sight: return 0.0
		s *= t.defaults.half / (t.defaults.half + d)
	return s

## Read-only preview, simulating only our declared finite preparations. No planning search.
func preview(p: Dictionary, c: Dictionary) -> Dictionary:
	if c.has("obstruction"): return supports.obstruction_preview(p,c)
	if p.bearing != "" and t.rows[c.row].get("use") != "support_use": return supports.recovery_preview(p)
	if special(c): return handler(t.rows[c.row]).preview(p, c)
	return action_preview(p, c, t.rows[c.row])

func action_preview(p: Dictionary, c: Dictionary, r: Dictionary) -> Dictionary:
	if p.bearing != "": return supports.recovery_preview(p)
	var q: Dictionary = p.duplicate(true)
	var action: String = c.get("action", r.get("action", ""))
	if r.has("actions"):
		if action not in r.actions or not _ready(p, {"action":action}): return {}
		return {"steps":[{"action":action, "main":true}], "resources":[]}
	var a: Dictionary = t.actions[action]
	var steps: Array = []
	var resources: Array = []
	var target: String = c.target
	if target != "" and not posts.has(target): return {}
	if target != "" and not posts[target].get("usable",true): return {}
	if target != "" and posts[target].get("exclusive", true): resources.append("post:" + target)
	var moving: bool = target != "" and q.pos.distance_to(posts[target].pos) > t.defaults.arrival
	var seat_rise := {}
	var seat_rise_action := ""
	var ground_rise := false
	if q.ground != "standing" and a.get("effect","") != "rise" and (moving or a.posture not in [q.ground,"all"]):
		if not q.can_rise: return {}
		ground_rise = true
		q.ground = "standing"
	if (moving or a.posture in ["standing","ground_seated","lying"]) and q.support != "":
		if not posts.has(q.support) or not posts[q.support].get("rise_clear", true): return {}
		var kind: String = posts[q.support].kind
		if not t.seats.has(kind): return {}
		seat_rise_action = t.seats[kind].leave
		seat_rise = {"action":seat_rise_action, "seat":q.support}
		q.support = ""
	var tool: String = a.get("tool", "")
	var rising_empty: bool = (not seat_rise.is_empty() and t.actions[seat_rise_action].get("empty",false)) or (ground_rise and t.actions.get_up_ground.get("empty",false))
	if rising_empty and not prepare_hands(q,{"left":"empty","right":"empty"},false,steps,resources): return {}
	if ground_rise: steps.append({"action":"get_up_ground"})
	if not seat_rise.is_empty(): steps.append(seat_rise)
	var allow_tools: bool = a.has("hands") or r.get("use","direct") == "use_tool" or (tool != "" and r.get("tool","") == tool)
	if not prepare_hands(q,hand_requirements(a),allow_tools,steps,resources): return {}
	if moving and a.mode != "move": steps.append({"action":"walk_loaded" if q.get("offhand","") != "" else "walk", "target":target})
	if a.posture in ["ground_seated", "lying"] and q.ground != a.posture:
		if q.support != "": return {}
		steps.append({"action":t.ground_poses[a.posture].enter})
	if a.posture == "seated":
		if target == "":
			if q.support == "": return {}
		elif q.support != target:
			if not posts[target].get("seat", posts[target].kind == "sit"): return {}
			if not t.seats.has(posts[target].kind): return {}
			steps.append({"action":t.seats[posts[target].kind].enter, "seat":target})
	steps.append({"action":action, "target":target, "main":true})
	return {"steps":steps, "resources":resources}

func _current_valid(p: Dictionary) -> bool:
	if p.current.is_empty(): return false
	if finishing(p): return true # committed result; ordinary interruptible source tail
	if supports.busy(p): return true
	if special(p.current): return handler(t.rows[p.current.row]).valid(p)
	# Entry gates do not become continuation gates. Actual current action requirements do.
	if not p.body.is_empty() and p.body.step.get("main", false):
		if not _ready(p, p.body.step): return false
	return not preview(p, p.current).is_empty()

func _rebuild_occupancy() -> void:
	occupied.clear()
	for d in supports.devices.values():
		for role in d.slots:
			occupied[supports.occupied_key(d,role)] = d.slots[role]
			occupied["body:"+d.slots[role]] = "support-group:"+d.id
	for p in people:
		if p.gone: continue
		# place is latched by arrival/use, never inferred from proximity during a walk.
		if p.place != "" and (not posts.has(p.place) or p.pos.distance_to(posts[p.place].pos) > t.defaults.arrival): p.place = ""
		if p.support != "": p.place = p.support
		for id in posts:
			if posts[id].get("exclusive", true) and (p.support == id or p.place == id):
				var key: String = "post:" + id
				if occupied.has(key) and occupied[key] != p.id:
					error = "two bodies occupy " + id
				occupied[key] = p.id

func _event(p: Dictionary, what: String, detail: String) -> void:
	if tracing: trace.append({"time":clock, "person":p.id, "event":what, "detail":detail})

func _end(p: Dictionary, outcome: String, keep: Array = []) -> void:
	if p.current.is_empty(): return
	if special(p.current): handler(t.rows[p.current.row]).ending(p, outcome)
	var key: String = p.current.key
	if outcome != "interrupted": p.done[key] = clock
	_event(p, outcome, key)
	p.result = {"key":key, "outcome":outcome}
	p.current = {}
	p.body = {}
	_release(p.id, keep)
	next_think = clock

func _release(owner: String, keep: Array) -> void:
	for k in reserved.keys():
		if reserved[k] == owner and k not in keep: reserved.erase(k)

## All new requests (first choices, then at most one fallback) use this same allocator.
func _free(resources: Array, owner: String) -> bool:
	for k in resources:
		if occupied.has(k) and occupied[k] != owner: return false
		if reserved.has(k) and reserved[k] != owner: return false
		if k.begins_with("post:") and posts.has(k.trim_prefix("post:")):
			var pos: Vector3 = posts[k.trim_prefix("post:")].pos
			for claims in [occupied, reserved]:
				for other in claims:
					if claims[other] != owner and other.begins_with("post:") and posts.has(other.trim_prefix("post:")) and pos.distance_to(posts[other.trim_prefix("post:")].pos) <= t.defaults.arrival * 2: return false
	return true

func _grant(request: Dictionary) -> bool:
	for k in request.work.resources:
		if not _free([k], request.get("owners", {}).get(k, request.p.id)): return false
	for k in request.work.resources:
		if not k.begins_with("post:"): continue
		for other in request.work.resources:
			if other == k or not other.begins_with("post:"): continue
			if request.get("owners", {}).get(k, request.p.id) != request.get("owners", {}).get(other, request.p.id) and posts[k.trim_prefix("post:")].pos.distance_to(posts[other.trim_prefix("post:")].pos) <= t.defaults.arrival * 2: return false
	for k in request.work.resources: reserved[k] = request.get("owners", {}).get(k, request.p.id)
	return true

func _request_before(a: Dictionary, b: Dictionary) -> bool:
	if a.c.score != b.c.score: return a.c.score > b.c.score
	var ak := "%s:%s:%s" % [t.defaults.seed, a.p.id, a.c.key]
	var bk := "%s:%s:%s" % [t.defaults.seed, b.p.id, b.c.key]
	return ak.hash() < bk.hash() if ak.hash() != bk.hash() else ak < bk

func choose_all() -> void:
	maintain()
	_rebuild_occupancy()
	if error != "": return
	var first: Array = []
	for p in people:
		if p.gone: continue
		if not p.current.is_empty() and not _current_valid(p): _end(p, "blocked")
		var threshold := -INF
		if not p.current.is_empty(): threshold = _score(p, p.current.row, p.current.target, false) + p.current.jitter
		var choices: Array = []
		for row in t.rows:
			var r: Dictionary = t.rows[row]
			if not r.get("enabled", true): continue
			var jitter: float = p.rng.randf() * t.defaults.jitter if p.current.is_empty() else 0.0
			var targets: Array = handler(r).targets(p, r) if handler(r) != null else [""]
			if handler(r) == null and r.has("target"):
				targets = posts.keys().filter(func(id): return "post:" + posts[id].kind == r.target)
			for target in targets:
				var key := _key(row, target)
				if p.current.get("key", "") == key or clock - p.done.get(key, -INF) < t.defaults.again: continue
				var s := _score(p, row, target, true)
				if s <= 0.0 or s + jitter <= threshold: continue
				var c := {"row":row, "target":target, "key":key, "score":s+jitter, "jitter":jitter}
				if r.has("actions"):
					var available: Array = r.actions.filter(func(action): return _ready(p, {"action":action}))
					if available.is_empty(): continue
					c["action"] = available[p.rng.randi_range(0, available.size()-1)]
				var work := preview(p, c)
				if work.is_empty(): continue
				# Exclude resources already unavailable in the read-only snapshot. Simultaneous
				# new claims still conflict only in the collected allocator below.
				if not _free(work.resources, p.id): continue
				choices.append({"p":p, "c":c, "work":work})
		choices.sort_custom(_request_before)
		if not choices.is_empty():
			first.append({"request":choices[0], "fallback":choices[1] if choices.size() > 1 else {}})
		elif not p.current.is_empty() and p.body.is_empty() and not p.current.has("matched"):
			# New internal preparation resources also go through the central entry.
			var work := preview(p, p.current)
			if not work.is_empty():
				var c: Dictionary = p.current.duplicate()
				c.score = threshold
				first.append({"request":{"p":p,"c":c,"work":work,"continuing":true},"fallback":{}})
	for request in coop.requests(): first.append({"request":request,"fallback":{}})
	for request in activities.requests(): first.append({"request":request,"fallback":{}})
	for request in supports.requests(): first.append({"request":request,"fallback":{}})
	first.sort_custom(func(a, b): return _request_before(a.request, b.request))
	var accepted: Array = []
	var fallbacks: Array = []
	for entry in first:
		if _grant(entry.request): accepted.append(entry.request)
		else:
			_event(entry.request.p, "denied", entry.request.c.key)
			if not entry.fallback.is_empty(): fallbacks.append(entry.fallback)
	fallbacks.sort_custom(_request_before)
	for request in fallbacks:
		_event(request.p, "fallback", request.c.key)
		if _grant(request): accepted.append(request)
	for request in accepted:
		if request.has("joint"):
			continue # start only after all final choices have been committed
		var p: Dictionary = request.p
		if request.get("continuing", false):
			_release(p.id, request.work.resources)
			continue
		if not p.current.is_empty(): _end(p, "completed" if p.current.get("success", false) else "interrupted", request.work.resources)
		# Confirm the new choice before releasing old approach reservations.
		serial += 1
		p.current = request.c.duplicate()
		p.current.instance = serial
		p.current.since = clock
		p.body = {}
		supports.switched(p)
		_release(p.id, request.work.resources)
		_event(p, "start", request.c.key)
	maintain()
	for request in accepted:
		if request.has("joint"): request.get("controller", coop).start_joint(request.joint)
	next_think = clock + t.defaults.rethink

func tick(dt: float) -> void:
	if error != "": return
	clock += dt
	_rebuild_occupancy() # incorporate externally changed actual bodies before execution/selection
	if error != "": return
	maintain()
	coop.advance_joints(dt)
	activities.advance(dt)
	supports.advance(dt)
	# Committed effects precede the read-only decision phase; stable IDs remove array-order effects.
	var ordered: Array = people.duplicate()
	ordered.sort_custom(func(a, b): return a.id < b.id)
	for p in ordered:
		if not p.gone and not p.current.is_empty(): _advance(p, dt)
	if clock >= next_think: choose_all()
	# Start newly selected/next work in this update, so the UI does not flash a fictional
	# one-frame preparation between real actions. No extra time or ungranted resource is used.
	for p in ordered:
		if not p.gone and not p.current.is_empty() and p.body.is_empty(): _advance(p,0.0)

func _ready(p: Dictionary, step: Dictionary) -> bool:
	if p.bearing != "": return false # support controller owns the body until actual release
	if step.has("task"):
		var task: Dictionary=activities.tasks.get(step.task,{})
		if task.is_empty() or p.current.get("target")!=task.id or not activities.task_valid(task): return false
	if step.has("transaction") and not activities.transaction_ready(p,step): return false
	if step.has("requires"):
		var required: Dictionary = step.duplicate()
		required.action = required.requires
		required.erase("requires")
		if not _ready(p, required): return false
	var a: Dictionary = t.actions[step.action]
	if a.posture == "any" and p.ground != "standing" and a.get("effect","") != "rise": return false
	if a.posture == "ground" and (p.ground == "standing" or p.support != ""): return false
	if a.posture == "standing" and (p.support != "" or p.ground != "standing"): return false
	if a.posture == "seated" and p.support == "": return false
	if a.posture in ["ground_seated", "lying"] and p.ground != a.posture: return false
	if not step.has("requires") and not hands_ready(p,a): return false
	if a.get("empty", false) and p.held != "": return false
	if a.get("holding",false) and p.held == "": return false
	if a.has("tool") and not _held(p, a.tool): return false
	var hand: String = step.get("hand","right")
	if hand not in ["left","right"]: return false
	var held := hand_item(p,hand)
	match a.get("effect", ""):
		"rise":
			if not p.can_rise or p.ground == "standing": return false
		"collect":
			var surface: Dictionary = surfaces.get(step.get("surface", ""), {})
			if not surface.get("accept_take",true): return false
			if held != "" or surface.is_empty() or step.get("item", "") not in surface.items or p.pos.distance_to(surface.pos) > t.defaults.reach: return false
		"deposit":
			var surface: Dictionary = surfaces.get(step.get("surface", ""), {})
			if not surface.get("accept_put",true): return false
			if held == "" or surface.is_empty() or surface.items.size() >= surface.capacity or p.pos.distance_to(surface.pos) > t.defaults.reach: return false
		"take_surface":
			var surface: Dictionary = surfaces.get(step.get("surface", ""), {})
			if not surface.get("accept_take",true): return false
			if held != "" or surface.is_empty() or step.item not in surface.items or p.pos.distance_to(surface.pos) > t.defaults.reach: return false
		"stow":
			var slot: Dictionary = p.storage.get(step.get("slot", ""), {})
			if held != step.item or slot.is_empty() or slot.items.size() >= slot.capacity or items[step.item].kind not in slot.accepts: return false
		"put":
			var surface: Dictionary = surfaces.get(step.get("surface", ""), {})
			if not surface.get("accept_put",true): return false
			if held != step.item or surface.is_empty() or surface.items.size() >= surface.capacity or p.pos.distance_to(surface.pos) > t.defaults.reach: return false
		"take":
			var slot: Dictionary = p.storage.get(step.get("slot", ""), {})
			if held != "" or slot.is_empty() or step.item not in slot.items: return false
		"draw":
			var container: String = step.get("container","")
			if hand_item(p,step.get("from_hand","left")) != container or held != "" or not items.has(container) or step.get("item","") not in items[container].get("contents",[]): return false
		"stand":
			if p.support != step.seat or not posts[step.seat].get("rise_clear", true): return false
		"sit":
			if p.pos.distance_to(posts[step.seat].pos) > t.defaults.arrival or (reserved.get("post:" + step.seat, "") != p.id and occupied.get("post:" + step.seat, "") != p.id): return false
	if a.has("post"):
		var target: String = step.get("target", "")
		if not posts.has(target) or p.pos.distance_to(posts[target].pos) > t.defaults.arrival: return false
		if occupied.get("post:" + target, p.id) != p.id: return false
	return true

func _advance(p: Dictionary, dt: float) -> void:
	if supports.busy(p): return
	if finishing(p):
		p.body.elapsed += dt
		if p.body.elapsed >= material_time(p.body.step.action):
			var finished: Dictionary = p.body.step
			p.body = {}
			if special(p.current): handler(t.rows[p.current.row]).completed(p,finished)
			elif finished.get("main",false): _end(p,"completed")
		return
	if special(p.current):
		if p.body.has("joint"): return
		if p.body.has("group_move"): return
		var desired: Dictionary = preview(p, p.current)
		if desired.is_empty():
			_end(p, "blocked")
			return
		if not p.body.is_empty():
			var previous: Dictionary = p.body.step.duplicate(true)
			var following: Dictionary = desired.steps[0].duplicate(true)
			previous.erase("focus")
			following.erase("focus")
			if previous != following: p.body = {}
			elif desired.steps[0].has("focus"): p.body.step.focus = desired.steps[0].focus
	if p.body.is_empty():
		var work := preview(p, p.current)
		if work.is_empty():
			_end(p, "blocked")
			return
		# No new occupancy in a person's advance. Previously unlisted work waits for a decision.
		for k in work.resources:
			if reserved.get(k, "") != p.id and occupied.get(k, "") != p.id: return
		var step: Dictionary = work.steps[0]
		serial += 1
		p.body = {"id":serial, "step":step, "elapsed":0.0, "effect":false}
		_event(p, "action", step.action)
		if step.action == "walk" or t.actions[step.action].mode == "move":
			var dest: Vector3 = posts[step.target].pos
			if not planner.is_valid():
				error = "no walking planner configured"
				return
			var pts: PackedVector3Array = planner.call(p.pos, dest)
			if pts.size() < 2:
				error = "no walking path: %s -> %s" % [p.pos, dest]
				return
			p.body["path"] = _path(pts)
	var body: Dictionary = p.body
	var step: Dictionary = body.step
	var a: Dictionary = t.actions[step.action]
	if not _ready(p, step):
		_end(p, "blocked")
		return
	# Starting the use already at its target has no walking-arrival step to latch place.
	if step.get("target", "") != "" and p.pos.distance_to(posts[step.target].pos) <= t.defaults.arrival:
		p.place = step.target
		if a.mode != "move": p.yaw = posts[step.target].get("yaw",p.yaw)
	if step.has("focus"):
		var facing: Vector3 = step.focus-p.pos
		if facing.length_squared() > 0.0001: p.yaw = atan2(facing.x,facing.z)
	body.elapsed += dt
	if step.has("actuator"): supports.actuator_progress(p,step,body)
	if body.has("path"):
		var speed: float = a.get("speed",t.defaults.speed)
		var at := _at(body.path, body.elapsed * speed)
		p.pos = supports.walk_step(p,at[0],dt)
		p.yaw = at[1]
		if p.place != "" and p.pos.distance_to(posts[p.place].pos) > t.defaults.arrival: p.place = ""
		if body.elapsed * speed < body.path.length: return
		if p.pos.distance_to(posts[step.target].pos) > t.defaults.arrival:
			error = "walk ended away from actual target: " + step.target
			return
		p.pos = posts[step.target].pos
		p.place = step.target
	else:
		if step.get("wait", false): return
		var duration: float = t.defaults.hold_demo if a.mode == "hold" else t.defaults.once_demo
		if a.has("material"): duration = material_time(step.action,"effect_frame")
		if body.elapsed < duration: return
	if not _effect(p, step, body):
		_end(p, "blocked")
		return
	if a.has("material") and body.elapsed < material_time(step.action): return
	if step.has("actuator"):
		p.body = {}
		supports.actuator_completed(p,step)
		return
	if special(p.current):
		p.body = {}
		handler(t.rows[p.current.row]).completed(p, step)
	elif step.get("main", false): _end(p, "completed")
	else: p.body = {}

## Effects are checked and committed synchronously, once, only for the still-current body instance.
func _effect(p: Dictionary, step: Dictionary, body: Dictionary) -> bool:
	if p.body.get("id", -1) != body.id or body.effect: return false
	if not _ready(p, step): return false
	if step.has("transaction") and not activities.commit_transaction(p,step): return false
	var hand: String = step.get("hand","right")
	match t.actions[step.action].get("effect", ""):
		"rise": p.ground = "standing"
		"ground_seated", "lying": p.ground = t.actions[step.action].effect
		"balance": p.unstable = false
		"collect":
			surfaces[step.surface].items.erase(step.item)
			set_hand(p,hand,step.item)
		"deposit":
			surfaces[step.surface].items.append(hand_item(p,hand))
			set_hand(p,hand,"")
		"take_surface":
			surfaces[step.surface].items.erase(step.item)
			set_hand(p,hand,step.item)
			reserved.erase("item:" + step.item)
		"stow":
			var slot: Dictionary = p.storage[step.slot]
			if hand_item(p,hand) != step.item or slot.items.size() >= slot.capacity or items[step.item].kind not in slot.accepts: return false
			slot.items.append(step.item)
			set_hand(p,hand,"")
		"put":
			var s: Dictionary = surfaces[step.surface]
			if hand_item(p,hand) != step.item or s.items.size() >= s.capacity or p.pos.distance_to(s.pos) > t.defaults.reach: return false
			s.items.append(step.item)
			set_hand(p,hand,"")
			reserved.erase("surface:" + step.surface)
		"take":
			var slot: Dictionary = p.storage[step.slot]
			if hand_item(p,hand) != "" or step.item not in slot.items: return false
			slot.items.erase(step.item)
			set_hand(p,hand,step.item)
		"draw":
			items[step.container].contents.erase(step.item)
			set_hand(p,hand,step.item)
		"stand":
			if p.support != step.seat or not posts[step.seat].get("rise_clear", true): return false
			p.support = ""
		"sit":
			if p.support != "" or p.pos.distance_to(posts[step.seat].pos) > t.defaults.arrival: return false
			if reserved.get("post:" + step.seat, "") != p.id and occupied.get("post:" + step.seat, "") != p.id: return false
			p.support = step.seat
			p.place = step.seat
		"leave": p.gone = true
	body.effect = true
	_event(p, "effect", step.action)
	return true

func lines(p: Dictionary) -> PackedStringArray:
	var text := _lines(p)
	if p.body.has("portal") and not text.is_empty():
		if text.size() == 1: text.append("开门／等待通过")
		else: text[-1] = "开门／等待通过"
	if p.bearing != "":
		var state := supports.body_state(p)
		if state.get("phase") == "release":
			text = PackedStringArray([text[0] if not text.is_empty() else "暂无事情",t.actions.support_release.label])
	for call in supports.calls.values():
		if call.actor == p.id and call.live and not text.is_empty(): text[-1] += " · 通话连接中"
	if not text.is_empty() and p.get("notice", {}).get("until", -INF) > clock:
		var message: String = p.notice.text
		if text.size() == 1 and text[0] != message: text.append(message)
		elif not text[-1].contains(message): text[-1] += " · " + message
	return text

func _lines(p: Dictionary) -> PackedStringArray:
	if p.gone: return PackedStringArray()
	if p.current.is_empty(): return PackedStringArray([p.result.get("message", "暂无事情")])
	if special(p.current): return handler(t.rows[p.current.row]).lines(p)
	var r: Dictionary = t.rows[p.current.row]
	var upper: String = r.label if r.has("actions") else r.get("label", t.actions[r.action].label)
	var lower: String = t.actions[p.body.step.action].label if not p.body.is_empty() else "准备中"
	if p.body.has("portal"): lower = "开门／等待通过"
	# In these three templates the declared main action is the purpose itself, including label aliases
	# such as 闲逛/走路 and 离开/走向出口. Preparations remain a distinct second line.
	var same_meaning: bool = not p.body.is_empty() and p.body.step.get("main", false) and not r.has("actions")
	return PackedStringArray([upper]) if same_meaning or upper == lower else PackedStringArray([upper, lower])

## Same distance-based path sampling as npc/crowd.gd _path/_at; no animation playback dependency.
func _path(pts: PackedVector3Array) -> Dictionary:
	var cum := PackedFloat32Array([0.0])
	for i in range(1, pts.size()): cum.append(cum[-1] + pts[i-1].distance_to(pts[i]))
	return {"pts":pts, "cum":cum, "length":cum[-1]}

func _at(path: Dictionary, d: float) -> Array:
	d = clampf(d, 0.0, path.length)
	var i := 0
	while i < path.pts.size()-2 and path.cum[i+1] < d: i += 1
	var seg: Vector3 = path.pts[i+1] - path.pts[i]
	return [path.pts[i].lerp(path.pts[i+1], clampf((d-path.cum[i])/maxf(seg.length(), 1e-6), 0, 1)), atan2(seg.x, seg.z)]
