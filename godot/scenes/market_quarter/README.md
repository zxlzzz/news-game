# Market Quarter

A fictional object-only district requested by Hsinlung. The rejected six-island
layout has been replaced by continuous shop fronts and unequal blocks around
offset junctions. Entrances lead through the fronts to an opposing-stall market,
rear servicing lanes, a residential court and a pedestrian shopping lane. A deep
garage and cinema anchor a smaller civic court; workshop housing encloses a
separate loading court. Outer street fronts and a second southern terrace continue
the neighbourhood beyond the interior. Layout is authoritative in `level.tscn`;
measurements and counts derive from its installed geometry.

Run from `godot/` with `godot --path . res://scenes/market_quarter/level.tscn`.
WASD, arrows or left drag pan; middle drag orbits; the wheel zooms. The starting
view frames the central streets; zoom out to see the complete district.
`spawn_population = false` also suppresses automatic vendors and other occupants.
Vehicles are fixed objects. No NPC or action integration is included.

Four crossing sites connect selected destinations along the central streets;
the outer loop has none. Two unchanged tiles at each site span the native 9 m
motor carriageway and preserve their 3 mm paint lift. They no longer extend under
the raised sidewalk. Native road modules merge as direct level children, removing
construction seams; adjacent same-level paving cells are combined as well.

The layout uses existing formal model types and runtime gray styling. The design
references inform the relationship of uses and routes; this is not a replica:

- [INTERSTICE: Lower Polk Alleyways District Vision Plan](https://www.intersticearchitects.com/project/lower-polk-alleyways-vision-plan/): a commercial spine connected to service alleys and smaller public spaces.
- [URA: Understanding the Shophouse](https://www.ura.gov.sg/conservation/conservation-resources/understanding-the-shophouse/): continuous narrow frontage with airwells, rear courts and service space. These relationships inform the fictional layout rather than supplying a replica.

For renewed object-only geometry review, run `scripts/check_static_scene.ps1`
from the repository root. It exports actual pre-merge geometry with runtime size
jitter, checks lowest-vertex support against independent paving, identifies AABB
candidates, then initializes the normal scene to check its camera, style and
absence of population. The generated files go to `.tmp/static-scene-review/`.
This supplements actual view inspection; it does not approve visual quality,
prove full-footprint support, attachments, opening sweeps or NPC navigation.
