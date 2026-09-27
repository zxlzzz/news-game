## How many of each kind of free-roaming person a scene has (scene_spec.md §1 population.tres).
## People at fixed posts (stall keepers, chess players) are not here: they follow the objects.
class_name Population
extends Resource

@export var pedestrians := 0
@export var joggers := 0
@export var dog_walkers := 0
@export var cyclists := 0
@export var scooter_riders := 0
## Pedestrians choose what to do from npc/behaviour-table.json (npc/behaviour.gd) and take the
## objects' posts themselves, instead of visiting random spots while posts fill by chance.
@export var behaviour := false
