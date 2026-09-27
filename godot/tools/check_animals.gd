## Full action, transition, roaming-boundary and cat/dog body-clearance checks.
extends SceneTree
const Animal=preload("res://npc/animal_actions.gd")
const Dog=preload("res://npc/procedural_dog.gd")
const Cat=preload("res://npc/procedural_cat.gd")
const Preview = preload("res://tools/animal_behaviour_preview.gd")
const Brain=preload("res://npc/animal_controller.gd")
func _initialize():
	var c=Dog.load_params("res://npc/animal-actions.json")
	var breeds=Dog.load_params("res://npc/animal-breeds.json")
	breeds.cat=Dog.load_params("res://npc/cat-params.json")
	var worst=0.0
	var jump=0.0
	var worst_where=""
	var failures=[]
	var brain=Brain.create()
	var saved=brain.duplicate(true)
	var flee=Brain.step(brain,Vector3.ZERO,[{"position":Vector3(0,0,c.brain.avoid_person/2)}],[],c.review.dt,c,"dog",Animal._v(c.review.range_center),c.review.range_radius,Brain.body_radius(breeds.medium))
	assert(brain==saved,"controller mutated its input")
	assert(flee.velocity.z<0 and flee.action=="","dog must move away from a nearby person")
	var alert=Brain.step(brain,Vector3.ZERO,[],[{"position":Vector3(0,0,(c.brain.avoid_animal+c.brain.flee_distance)/2),"species":"dog","radius":Brain.body_radius(breeds.medium)}],c.review.dt,c,"cat",Animal._v(c.review.range_center),c.review.range_radius,Brain.body_radius(breeds.cat))
	assert(alert.action=="arch","cat must arch at a moderately near dog")
	var escape=Brain.step(brain,Vector3.ZERO,[],[{"position":Vector3(0,0,c.brain.flee_distance/2),"species":"dog","radius":Brain.body_radius(breeds.medium)}],c.review.dt,c,"cat",Animal._v(c.review.range_center),c.review.range_radius,Brain.body_radius(breeds.cat))
	assert(escape.velocity.z<0,"cat must flee from a close dog")
	for fps in [30,60,120]:
		var cat=Cat.create(Vector3.ZERO,0,breeds.cat)
		for target in [Vector3(0,c.jump.platform_height,c.jump.distance),Vector3(0,0,c.jump.distance*2)]:
			var prev_points=Cat.pose(cat,breeds.cat,c)
			cat=Cat.step(cat,{"jump_to":target},1.0/fps,breeds.cat,c)
			for frame in ceili((c.jump.prepare+c.jump.duration+c.jump.land)*fps)+1:
				cat=Cat.step(cat,{"speed":0.0,"yaw":0.0,"action":""},1.0/fps,breeds.cat,c)
				var pts=Cat.pose(cat,breeds.cat,c)
				for leg in Dog.LEGS:
					var limb=Dog._leg(leg,breeds.cat)
					var lengths=[limb.a,limb.b,limb.c]
					for j in 3:
						worst=maxf(worst,absf(pts[leg][j].distance_to(pts[leg][j+1])-lengths[j]))
					for j in 4:
						jump=maxf(jump,pts[leg][j].distance_to(prev_points[leg][j]))
				prev_points=pts
			if not cat.jump.is_empty() or absf(cat.height-target.y)>c.tolerances.bone:
				failures.append("cat did not land")
	print("ANIMAL_BRAIN_AND_JUMP_CHECKED")
	for breed in breeds:
		var p=breeds[breed]
		for action in c.actions:
			for fps in [30,60,120]:
				var s=Animal.create(Vector3.ZERO,0,p)
				var prev={}
				for frame in int(c.review.cycle*fps):
					var t=float(frame)/fps
					var active=t>=c.review.walk_until and t<c.review.hold_until
					s=Animal.step(s,{"speed":c.review.speed,"yaw":0,"action":action if active else ""},1.0/fps,p,c)
					var pts=Animal.pose(s,p,c)
					if pts.is_empty():
						failures.append("empty pose "+breed+" "+action)
						break
					for leg in Dog.LEGS:
						var limb=Dog._leg(leg,p)
						var lengths=[limb.a,limb.b,limb.c]
						for j in 3:
							worst=maxf(worst,absf(pts[leg][j].distance_to(pts[leg][j+1])-lengths[j]))
						for j in 4:
							if not pts[leg][j].is_finite():
								failures.append("nonfinite "+breed+" "+action)
							if not prev.is_empty():
								var distance=pts[leg][j].distance_to(prev[leg][j])
								if distance>jump:
									jump=distance
									worst_where="%s %s %d fps t=%.3f %s %d" % [breed,action,fps,t,leg,j]
					prev=pts
				if s.phase!="walk":
					failures.append("did not resume walking "+breed+" "+action)
		print("ANIMAL_CHECKED ",breed)
	for species in ["dog", "cat"]:
		var parameters: Dictionary = breeds.cat if species == "cat" else breeds.medium
		for fps in [30, 60, 120]:
			var state = Preview.create(species, parameters, c)
			var repeat = Preview.create(species, parameters, c)
			var minimum_gap = INF
			var maximum_radius = 0.0
			var modes = {}
			var directions = {}
			for frame in int(c.review.behaviour_duration * fps):
				state = Preview.step(state, species, parameters, c, 1.0 / fps)
				repeat = Preview.step(repeat, species, parameters, c, 1.0 / fps)
				assert(state == repeat, "behaviour must be reproducible")
				var position: Vector3 = state.animal.base.walk.position if species == "cat" else state.animal.walk.position
				maximum_radius = maxf(maximum_radius, position.distance_to(Animal._v(c.review.range_center)) + Brain.body_radius(parameters))
				modes[state.brain.mode] = true
				directions[roundi(state.brain.yaw)] = true
				if species == "cat":
					minimum_gap = minf(minimum_gap, Preview.body_gap(state, parameters))
			if maximum_radius > c.review.range_radius:
				failures.append("roaming outside input range: " + species)
			if species == "cat" and minimum_gap <= 0:
				failures.append("cat/dog body overlap")
			if species == "dog" and (not modes.has("rest") or not modes.has("walk") or directions.size() < 3):
				failures.append("roaming lacks stops or distinct headings")
			print("BEHAVIOUR %s %d fps: radius %.4f / %.2f, body gap %.5f m, headings %d, modes %s" % [species, fps, maximum_radius, c.review.range_radius, minimum_gap, directions.size(), modes.keys()])
	for breed in ["small", "medium", "large"]:
		var parameters: Dictionary = breeds[breed]
		var state = Animal.create(Vector3.ZERO, 0, parameters)
		for frame in int(c.review.hold_until / c.review.dt):
			state = Animal.step(state, {"speed": 0, "yaw": 0, "action": "sit"}, c.review.dt, parameters, c)
		var points = Animal.pose(state, parameters, c)
		for leg in ["LF", "RF"]:
			for joint in 4:
				if Vector2(points[leg][joint].x - points[leg][3].x, points[leg][joint].z - points[leg][3].z).length() > c.tolerances.bone:
					failures.append("sit front leg not vertical " + breed)
		if absf(points.spine[0].y - maxf(parameters.silhouette.hipDisc, parameters.silhouette.spine / 2)) > c.tolerances.bone:
			failures.append("sit hip not grounded " + breed)
	if worst>c.tolerances.bone:
		failures.append("bone error %f" % worst)
	if jump>c.tolerances.step:
		failures.append("pose discontinuity %f" % jump)
	print("animal bone error %.8f m, largest frame displacement %.5f m" % [worst,jump])
	print("largest displacement at ",worst_where)
	print("ANIMALS_OK" if failures.is_empty() else failures)
	quit(0 if failures.is_empty() else 1)
