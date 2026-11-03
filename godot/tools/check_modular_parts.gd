## Assembled buildings must retain every saved part and moving window contact.
extends SceneTree
const Bounds = preload("res://core/bounds.gd")
func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var layouts: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://modeling/building-layouts.json"))
	var count:=0
	for name in layouts:
		var scene: Node3D=load("res://types/"+name+".tscn").instantiate()
		root.add_child(scene)
		var saved_parts:=0
		var names: Dictionary={}
		for child in scene.get_children():
			assert(child.is_inside_tree(),"Detached duplicate building part: "+name+"/"+child.name)
			assert(not names.has(child.name),"Duplicate building part: "+name+"/"+child.name)
			names[child.name]=true
			if child.scene_file_path.begins_with("res://types/"):saved_parts+=1
		assert(saved_parts==layouts[name].size(),"Building contains unsaved/duplicate parts: "+name)
		for index in layouts[name].size():
			var row: Dictionary=layouts[name][index]
			var part: Node3D=scene.get_node(row.type+"_"+str(index))
			assert(part.position.distance_to(Vector3(row.position[0],row.position[1],row.position[2]))<0.00001,"Misplaced part: "+name)
			if part.is_in_group("operable_window"):
				var grip: Node3D=part.find_child("grip_sash",true,false)
				assert(grip!=null,"Window has no moving grasp")
				var rest:=grip.global_position
				part.set_open(true)
				part._process(part.config.travel_seconds)
				assert(grip.global_position.distance_to(rest)>0.001,"Window grasp does not follow sash")
				part.set_open(false)
				part._process(part.config.travel_seconds)
				assert(grip.global_position.distance_to(rest)<0.00001,"Window cannot return to closed pose")
			count+=1
		scene.free()
	print("MODULAR_PARTS_OK ",layouts.size()," buildings / ",count," parts")
	quit()
