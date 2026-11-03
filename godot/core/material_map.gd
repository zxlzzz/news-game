## Third-party material names -> colour slots for one asset pack (scene_spec.md §2).
## Keys may use wildcards ("MI_RedBrick*"). Models made to 建模规范 need no entry: their
## material names already are slot names.
class_name MaterialMap
extends Resource

@export var pack := ""
@export var map: Dictionary[String, StringName] = {}
