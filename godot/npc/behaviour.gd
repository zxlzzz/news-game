## When a person changes to what (docs/design_route_npc_behavior.md). Candidates come from the
## person (self rows) and from free posts in the objects (post:<kind> rows); each is
##   base x (the person's coefficients of the row's tags) x half / (half + metres to the target).
## When the person has nothing to do, a little jitter is added to every candidate and the highest
## is picked; the action keeps that jitter as part of its number. While it runs, the best candidate
## (no jitter) replaces it only when its number is higher than the action's (with its jitter). That
## one comparison is the only one. (Drawing new jitter every rethink would make near-equal things
## swap back and forth; comparing without the kept jitter would undo every pick at the next rethink.) The current action's number
## never falls with time; an action ends when it is done (arrived, or its clip played `plays` times),
## and a row the person has done sits out their choices for `again` seconds (else the bench they just
## got up from, still the best thing around, would seat them again at once).
## person: {kind, pos, action, clock (seconds alive), done (row -> clock when last done)}.
## Tables: npc/behaviour-table.json (the rows), npc/behaviour-people.json (kinds of people).
## npc/clip-setup.json: a clip declared for a post kind may only be in a post:<kind> row of that kind
## (an error otherwise); a clip whose declaration names something missing is never picked, and a row
## left with no clip to pick is never a candidate (like a post kind no object offers).
## Moving and drawing are npc/crowd.gd's; this file only chooses.
extends RefCounted

const ClipPose := preload("res://npc/clip_pose.gd")
const ClipSetup := preload("res://npc/clip_setup.gd")
const TABLE := "res://npc/behaviour-table.json"
const PEOPLE := "res://npc/behaviour-people.json"
const DOS := ["go", "leave", "play", "use"]

var error := ""
var t: Dictionary        # the table
var people: Dictionary   # kind -> {tags, walk}
var usable: Array        # per row: the row's clip weights without clips that miss something

## Reads and checks both tables; check `error`. A post row whose kind no object offers is fine: it
## just never has a candidate.
func _init() -> void:
	t = _read(TABLE)
	people = _read(PEOPLE)
	if error != "":
		return
	for k in ["half", "sight", "jitter", "rethink", "again", "rows"]:
		if not t.has(k):
			error = "%s: no %s" % [TABLE, k]
			return
	var setup = ClipSetup.shared()
	if setup.error != "":
		error = setup.error
		return
	var used_tags := {}
	for i in t.rows.size():
		var r: Dictionary = t.rows[i]
		var where := "%s row %d" % [TABLE, i + 1]
		for k in ["from", "do", "clips", "base"]:
			if not r.has(k):
				error = "%s: no %s" % [where, k]
				return
		if not r.do in DOS:
			error = "%s: do %s is not one of %s" % [where, r.do, DOS]
			return
		var from_self: bool = r.from == "self"
		if from_self == (r.do == "use") or (not from_self and not String(r.from).begins_with("post:")):
			error = "%s: from %s cannot do %s (self: go, leave, play; post:<kind>: use)" % [where, r.from, r.do]
			return
		if r.do in ["play", "use"] and not (r.get("plays") is Array and r.plays.size() == 2 and r.plays[0] >= 1 and r.plays[1] >= r.plays[0]):
			error = "%s: %s needs plays [min, max], min >= 1" % [where, r.do]
			return
		for w in r.get("when", []):
			if not String(w).begins_with("taken:") or from_self:
				error = "%s: unknown gate %s (only taken:<kind>, on post rows)" % [where, w]
				return
		var ok := {}
		for c in r.clips:
			var clip = ClipPose.of(c)
			if clip.error != "":
				error = "%s: clip %s: %s" % [where, c, clip.error]
				return
			error = setup.check_use(c, "" if from_self else String(r.from).substr(5), where)
			if error != "":
				return
			if setup.missing(c).is_empty():
				ok[c] = r.clips[c]
		usable.append(ok)
		for tag in r.get("tags", []):
			used_tags[tag] = true
	for kind in people:
		if kind.begins_with("_"):
			continue
		var who: Dictionary = people[kind]
		if not (who.get("tags") is Dictionary and who.get("walk") is Dictionary):
			error = "%s: %s needs tags and walk" % [PEOPLE, kind]
			return
		for tag in used_tags:
			if not who.tags.has(tag):
				error = "%s: %s has no coefficient for tag %s (used in %s)" % [PEOPLE, kind, tag, TABLE]
				return
		for c in who.walk:
			if ClipPose.of(c).error != "":
				error = "%s: %s walk clip %s: %s" % [PEOPLE, kind, c, ClipPose.of(c).error]
				return
			error = setup.check_use(c, "", "%s: %s walk" % [PEOPLE, kind])
			if error != "":
				return

func _read(path: String) -> Dictionary:
	var v = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (v is Dictionary):
		error = path + ": missing or not a JSON object"
		return {}
	return v

func kinds() -> Array:
	return people.keys().filter(func(k): return not k.begins_with("_"))

## The number of row r for a person of `kind` at `pos` towards `target` (self rows: no distance).
func score(r: int, kind: String, pos: Vector3, target) -> float:
	var row: Dictionary = t.rows[r]
	var s: float = row.base
	for tag in row.get("tags", []):
		s *= people[kind].tags[tag]
	if target is Vector3 and row.from != "self":
		var d := Vector2(pos.x - target.x, pos.z - target.z).length()
		if d > t.sight:
			return 0.0
		s *= t.half / (t.half + d)
	return s

## The current action's number (0 when there is none).
func value(person: Dictionary) -> float:
	var a = person.get("action")
	if a == null:
		return 0.0
	return score(a.row, person.kind, person.pos, a.post.marker.global_position if a.post else null) + a.jitter

## The action that should replace the current one, or null to keep it. posts: [{marker, kind,
## object, agent, arrived}] (crowd.gd's register; a post with an agent is taken).
func choose(person: Dictionary, posts: Array, rng: RandomNumberGenerator):
	var current = person.get("action")
	# jitter only when picking something new; the action keeps the jitter it was picked with
	var jitter: float = t.jitter if current == null else 0.0
	var best = null
	var best_pick := -INF
	for r in t.rows.size():
		if current != null and current.row == r:
			continue  # doing it already: not restarted by its own row
		if person.get("done", {}).get(r, -INF) > person.clock - t.again:
			continue  # finished it lately: done means done, not straight back to the same thing
		if usable[r].is_empty():
			continue  # every clip of the row misses something (npc/clip-setup.json)
		var row: Dictionary = t.rows[r]
		if row.from == "self":
			var s := score(r, person.kind, person.pos, null)
			var pick: float = s + rng.randf() * jitter
			if s > 0.0 and pick > best_pick:
				best = {"row": r, "post": null, "score": s}
				best_pick = pick
			continue
		var kind := String(row.from).substr(5)
		for post in posts:
			if post.kind != kind or post.agent != null or not _gates_hold(row, post, posts):
				continue
			var s := score(r, person.kind, person.pos, post.marker.global_position)
			var pick: float = s + rng.randf() * jitter
			if s > 0.0 and pick > best_pick:
				best = {"row": r, "post": post, "score": s}
				best_pick = pick
	if best == null or best_pick <= value(person):
		return null
	var row: Dictionary = t.rows[best.row]
	var action := {"row": best.row, "do": row.do, "post": best.post, "clip": _pick(usable[best.row], rng), "plays": 0, "time": 0.0,
		"arrived": false, "jitter": best_pick - best.score}
	if row.has("plays"):
		action.plays = rng.randi_range(row.plays[0], row.plays[1])
	return action

## Every taken:<kind> gate: the post's object has someone who has arrived at a post of that kind.
func _gates_hold(row: Dictionary, post: Dictionary, posts: Array) -> bool:
	for w in row.get("when", []):
		var want := String(w).substr(6)
		if not posts.any(func(q): return q.object == post.object and q.kind == want and q.agent != null and q.arrived):
			return false
	return true

func walk_clip(kind: String, rng: RandomNumberGenerator) -> String:
	return _pick(people[kind].walk, rng)

static func _pick(weights: Dictionary, rng: RandomNumberGenerator) -> String:
	var total := 0.0
	for k in weights:
		total += weights[k]
	var x := rng.randf() * total
	for k in weights:
		x -= weights[k]
		if x <= 0:
			return k
	return weights.keys()[-1]
