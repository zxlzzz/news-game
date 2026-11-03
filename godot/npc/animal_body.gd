## Shows a real animal model (npc/animal_model.gd) in one ink colour: an instance of the breed's glb
## whose bones are set from AnimalModel.pose each frame. No shadows, like the other ink figures; in the
## group the level's look skips (style/ink_builder.gd SELF_INKED).
##
##   var body := AnimalBody.new(); parent.add_child(body); body.setup("husky")
##   body.show_pose(AnimalModel.pose(m, s))
extends Node3D

const AnimalModel := preload("res://npc/animal_model.gd")
const InkBuilder := preload("res://style/ink_builder.gd")

var skeleton: Skeleton3D

func setup(breed: String) -> void:
	add_to_group(InkBuilder.SELF_INKED)
	var c: Dictionary = AnimalModel.config()
	var model: Node3D = load(c.breeds[breed].glb).instantiate()
	add_child(model)
	for player in model.find_children("*", "AnimationPlayer", true, false):
		player.free()  # the bones are set from the pose, never by the player
	skeleton = model.find_children("*", "Skeleton3D", true, false)[0]
	var ink := StandardMaterial3D.new()
	ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ink.albedo_color = Color(c.ink[0], c.ink[1], c.ink[2], c.ink[3])
	ink.disable_receive_shadows = true
	for mesh in model.find_children("*", "MeshInstance3D", true, false):
		mesh.material_override = ink
		mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func show_pose(pose: Dictionary) -> void:
	transform = pose.root
	var locals: Array = pose.locals
	for i in locals.size():
		var x: Transform3D = locals[i]
		skeleton.set_bone_pose_position(i, x.origin)
		skeleton.set_bone_pose_rotation(i, x.basis.get_rotation_quaternion())
