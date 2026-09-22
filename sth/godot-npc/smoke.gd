extends Node3D
var f=0
func _ready():
	var cam=Camera3D.new(); cam.position=Vector3(4,4,4); add_child(cam); cam.look_at(Vector3.ZERO)
	var l=DirectionalLight3D.new(); l.shadow_enabled=true; l.rotation_degrees=Vector3(-50,30,0); add_child(l)
	var m=MeshInstance3D.new(); m.mesh=BoxMesh.new(); add_child(m)
	var g=MeshInstance3D.new(); var p=PlaneMesh.new(); p.size=Vector2(10,10); g.mesh=p; g.position.y=-0.5; add_child(g)
func _process(_d):
	f+=1
	if f==5:
		get_viewport().get_texture().get_image().save_png("/home/claude/smoke.png"); get_tree().quit()
