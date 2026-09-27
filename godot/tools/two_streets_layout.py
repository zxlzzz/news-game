"""Writes godot/scenes/two_streets/level.tscn from the layout below (docs/design-plans/two-streets.md §2).
python godot/tools/two_streets_layout.py
The level file is the scene; this only places things by rule (buildings packed along a frontage with
what sticks out in front ending at the sidewalk, furniture every few metres, crossings, parked cars,
the backdrop). Rerunning overwrites the level file: hand edits made in the editor are lost.
Reads model sizes with modeling/check_model.py."""
import math, re, subprocess
from pathlib import Path

G = Path(__file__).resolve().parents[1]

def box(n):
    out = subprocess.run(['python', str(G/'modeling/check_model.py'), str(G/f'models/{n}.glb')], capture_output=True, text=True).stdout
    m = re.search(r'box\s+min \(([-\d.]+), [-\d.]+, ([-\d.]+)\)\s+max \(([-\d.]+), [-\d.]+, ([-\d.]+)\)', out)
    return [float(v) for v in m.groups()]  # xmin, zmin, xmax, zmax

SIDE = 0.15  # sidewalk, block and commercial ground height
items = []
count = {}

def put(t, x, z, yaw=0, y=0.0, name=None):
    count[t] = count.get(t, 0) + 1
    items.append((name or f"{''.join(w.capitalize() for w in t.split('_'))}{count[t]}", t, x, y, z, yaw))

# ---------------------------------------------------------------- roads
ALLEYS = [-35, 25]
for street, zc, tyaw in [('A', 40, 180), ('B', -40, 0)]:
    for x in range(-95, 80, 10):
        if x in ALLEYS:
            put('road_alley_entry', x, zc, 180 if street == 'A' else 0)
        else:
            put('road_straight', x, zc)
    put('road_t', 90, zc, tyaw)
for z in range(-25, 30, 10):
    put('road_straight', 90, z, 90)
for x in ALLEYS:
    for z in range(-25, 30, 10):
        put('alley', x, z, 90)

CROSS = [-68, -5, 53]
for zc in (40, -40):
    for x in CROSS:
        # stripes along the traffic (the model's Z), three pieces across the 13 m of road and bike lanes
        for dz in (-4.5, 0, 4.5):
            put('crosswalk', x, zc + dz, 90)
    for x in range(-94, 76, 12):
        if all(abs(x - c) > 7 for c in CROSS):
            put('lane_line_dashed', x, zc, 90)

# signals at every crossing: a traffic light on the curb with its arm over the road, a walk light
# at each end facing across
for zc in (40, -40):
    for c in CROSS:
        near, far = zc - 7, zc + 7          # curb-side sidewalk z at the -Z and +Z ends
        put('traffic_signal', c + 3.6, near + 0.2, -90, SIDE)   # arm towards +Z
        put('traffic_signal', c - 3.6, far - 0.2, 90, SIDE)     # arm towards -Z
        put('pedestrian_signal', c - 3.4, near - 0.4, 0, SIDE)
        put('pedestrian_signal', c + 3.4, far + 0.4, 180, SIDE)
# cars parked along the curbs, facing the way their lane runs (right-hand traffic: +X on the +Z side)
cars = ['car', 'car_hatchback', 'taxi', 'car_estate', 'delivery_van', 'car', 'taxi_compact', 'small_truck', 'car_hatchback']
BUS = [(35, 40), (-20, -40)]
k = 0
for zc in (40, -40):
    for side, yaw in ((-1, -90), (1, 90)):
        z = zc + side * 3.4
        x = -96
        while x < 74:
            k += 1
            if any(abs(x - c) < 10 for c in CROSS) or any(abs(x - b[0]) < 9 and b[1] == zc and ((side > 0) == (zc > 0)) for b in BUS) or k % 4 == 0:
                x += 7
                continue
            put(cars[k % len(cars)], x, z, yaw)
            x += 7

# the cross road: one crossing in the middle, so its far sidewalk is not an island
for dx in (-4.5, 0, 4.5):
    put('crosswalk', 90 + dx, 0)

# ---------------------------------------------------------------- buildings
def pack(names, x0, x1, edge_z, yaw, y):
    """Left to right along x0..x1, 1 m apart, centred. Each building's front wall is set back so
    whatever sticks out in front (steps, canopies, a cart bay) ends at edge_z."""
    boxes = [(n, box(n)) for n in names]
    gap = 1.0
    chosen, used = [], 0.0
    for n, b in boxes:
        w = b[2] - b[0]
        if used + w + (gap if chosen else 0) <= x1 - x0:
            used += w + (gap if chosen else 0)
            chosen.append((n, b))
    x = x0 + (x1 - x0 - used) / 2
    for n, b in chosen:
        lo, hi, front = b[0], b[2], b[3]
        cx = x - lo if yaw == 0 else x + hi   # turned 180 the model's x runs the other way
        z = edge_z - front if yaw == 0 else edge_z + front
        put(n, round(cx, 3), round(z, 3), yaw, y)
        x += hi - lo + gap

BW, BM, BE = (-99, -38), (-32, 22), (28, 79)
pack(['building_walkup_a', 'building_bakery', 'building_walkup_c'], *BW, 30, 0, SIDE)
pack(['building_pharmacy', 'building_walkup_b', 'building_convenience', 'building_noodle_shop'], *BM, 30, 0, SIDE)
pack(['building_rowhouse', 'building_barber', 'building_residential_corner'], *BE, 30, 0, SIDE)
pack(['building_walkup_b', 'building_restaurant', 'building_laundry', 'building_cafe'], *BW, -30, 180, SIDE)
pack(['building_walkup_a', 'building_old_shop', 'building_bar', 'building_hardware', 'building_clothing'], *BM, -30, 180, SIDE)
pack(['building_walkup_c', 'building_bookstore', 'building_apartment_tall'], *BE, -30, 180, SIDE)
pack(['building_parking_garage', 'building_department_store', 'building_mall', 'building_office_tower', 'building_hotel'], -99, 99, -50, 0, SIDE)
pack(['building_cinema'], -99, -64, 50, 180, 0.0)
pack(['building_supermarket'], 64, 99, 50, 180, 0.0)

# ---------------------------------------------------------------- sidewalks
SHELTERS = [(35, 48.4, 180), (-20, -48.4, 0)]
for s in SHELTERS:
    put('bus_shelter', s[0], s[1], s[2], SIDE)
    put('bus_stop_sign', s[0] + 3.4, 49.3 if s[1] > 0 else -49.3, s[2], SIDE)
walks = [(32.8, 0, True), (47.2, 180, False), (-32.8, 180, True), (-47.2, 0, False)]
for z, yaw, block_side in walks:
    for k, x in enumerate(range(-96, 78, 8)):
        if any(abs(x - c) < 5 for c in CROSS):
            continue
        if block_side and any(abs(x - a) < 4.5 for a in ALLEYS):
            continue
        if any(abs(x - s[0]) < 5 and (s[1] > 0) == (z > 0) for s in SHELTERS):
            continue
        if not block_side and z > 0 and (-64 < x < 64) is False:
            pass
        if k % 3 == 1:
            put('street_lamp', x, z, yaw, SIDE)
            inner = z - 1.9 if z in (32.8, -47.2) else z + 1.9
            inner = 31.2 if z == 32.8 else 48.8 if z == 47.2 else -31.2 if z == -32.8 else -48.8
            put('trash_bin', x + 1.2, z + (0.9 if z in (32.8, -47.2) else -0.9) * 0, yaw, SIDE)
        else:
            put('street_tree', x, z, yaw, SIDE)
# benches facing the road on the park-side and commercial sidewalks, between trees
for x in (-84, -44, 12, 68):
    put('bench', x, 48.9, 180, SIDE)
for x in (-60, 8, 44):
    put('bench', x, -48.9, 0, SIDE)

# ---------------------------------------------------------------- park (y = 0, z 50..90)
put('plaza_oval', 0, 71)
put('fountain', 0, 71, 0, 0.07)
for bx, bz, byaw in [(-4.5, 74.9, 180), (4.5, 74.9, 180), (-4.5, 67.1, 0), (4.5, 67.1, 0)]:
    put('bench', bx, bz, byaw, 0.07)
put('plaza_round', -35, 72)
put('park_chess_table', -37.5, 71, 0, 0.07)
put('park_chess_table', -32.5, 73, 0, 0.07)
put('bench', -35, 77, 180, 0.07)
for px in (0, -35, 35):
    for pz in (52, 56, 60, 64) if px == 0 else (52, 56, 60, 64):
        put('path_straight', px, pz)
put('playground_slide', 31, 71)
put('playground_swing', 36, 75)
put('playground_seesaw', 40, 69)
put('playground_sandbox', 35, 68.5) if False else None
put('bench', 36, 79.5, 180)
put('park_gazebo', -15, 84)
put('park_pergola', 15, 85, 180)
put('table_tennis', 50, 80)
put('public_toilet', 56, 86, 180)
put('drinking_fountain', 3, 64)
put('newspaper_kiosk', -56, 53.5, 180)
put('market_stall', 8, 53.6, 180)
put('market_stall', 13, 53.6, 180)
for x, z in [(-2.2, 53), (2.2, 53), (-2.2, 61), (2.2, 61), (-37, 54), (-33, 62), (33, 54), (37, 62)]:
    put('park_lamp', x, z)
trees = [('park_tree_broad', -50, 62), ('park_tree_umbrella', -22, 60), ('park_tree_cypress', -12, 56), ('park_tree_broad', 22, 60),
         ('park_tree_umbrella', 50, 62), ('pine_tree', -52, 80), ('pine_tree', -44, 86), ('flowering_tree', -26, 80),
         ('park_tree_broad', 0, 84), ('flowering_tree', 26, 78), ('pine_tree', 44, 88), ('park_tree_cypress', 12, 76),
         ('park_tree_cypress', -12, 76), ('park_tree_umbrella', -58, 72), ('park_tree_broad', 58, 72), ('flowering_tree', 20, 66),
         ('flowering_tree', -20, 68)]
for t, x, z in trees:
    put(t, x, z)
for x, z in [(-8, 58), (8, 60), (-42, 60), (28, 57)]:
    put('shrub', x, z)
put('flower_patch', -5, 63)
put('flower_patch', 6, 63)
put('landscape_rocks', 48, 70)

# ---------------------------------------------------------------- block courtyards (y = 0.15, z -15..15)
# west: an inner block of flats with its bins and racks
put('building_back_row_residential_b', -80, 7, 0, SIDE)
put('garbage_station', -60, 10, 180, SIDE)
put('bike_shed', -52, -10, 0, SIDE)
put('drying_rack_yard', -60, -2, 0, SIDE)
put('drying_rack_yard', -60, 2, 0, SIDE)
for x, z in [(-94, -10), (-68, -9), (-45, 4)]:
    put('flowering_tree', x, z, 0, SIDE)
put('bench', -70, -6, 180, SIDE)
# middle: a small yard with a lower inner house, ping-pong and trees
put('building_back_row_residential_a', -2, 5, 0, SIDE)
put('table_tennis', -20, -6, 90, SIDE)
put('shared_bicycle_row', 14, -10, 0, SIDE)
put('recycling_bins', 14, 10, 180, SIDE)
for x, z in [(-26, 8), (-12, -10), (8, -8), (18, 2)]:
    put('pine_tree' if x < 0 else 'flowering_tree', x, z, 0, SIDE)
put('bench', -14, -2, 90, SIDE)
put('bench', 12, -2, -90, SIDE)
# east: a walled compound, its gate on the alley
put('compound_gate', 27.6, 0, 90, SIDE)
for z in (-13.5, -8.5, 8.5, 13.5):
    put('compound_wall_railing', 27.6, z, 90, SIDE)
put('bike_shed', 50, 10, 180, SIDE)
put('garbage_station', 72, -10, 0, SIDE)
put('drying_rack_yard', 60, -4, 0, SIDE)
put('fitness_air_walker', 40, -8, 0, SIDE)
for x, z in [(38, 4), (62, 6), (48, -10)]:
    put('flowering_tree', x, z, 0, SIDE)
put('bench', 44, 0, 90, SIDE)

# ---------------------------------------------------------------- backdrop (drawn, nobody goes there)
# the ground and both streets go on 100 m past every edge, so turning the camera never shows the void
backdrop = []
def put_bd(t, x, z, yaw=0, y=0.0):
    count[t] = count.get(t, 0) + 1
    backdrop.append((f"{''.join(w.capitalize() for w in t.split('_'))}Bd{count[t]}", t, x, y, z, yaw))
for zc in (40, -40):
    for x in list(range(-195, -100, 10)) + list(range(105, 200, 10)):
        put_bd('road_straight', x, zc)
    for x in list(range(-194, -100, 12)) + list(range(106, 200, 12)):
        put_bd('lane_line_dashed', x, zc, 90)
    for z, yaw in ((zc - 7.2, 0), (zc + 7.2, 180)):
        for x in list(range(-196, -100, 8)) + list(range(104, 200, 8)):
            put_bd('street_tree', x, z, yaw, SIDE)
bd_strips = [('WestCommercial', 'commercial', 100.0, -150, SIDE, -100), ('WestBlock', 'block_w', 100.0, -150, SIDE, -30),
             ('WestPark', 'park', 100.0, -150, 0, 50), ('EastCommercial', 'commercial', 100.0, 150, SIDE, -100),
             ('EastBlock', 'block_w', 100.0, 150, SIDE, -30), ('EastPark', 'park', 100.0, 150, 0, 50),
             ('South', 'margin_south', 400.0, 0, SIDE, -200), ('North', 'margin_north', 400.0, 0, 0, 90)]

# ---------------------------------------------------------------- write
types = sorted({t for _, t, *_ in items + backdrop})
tid = {t: f't{i+1}' for i, t in enumerate(types)}
def rot(deg):
    c, s = round(math.cos(math.radians(deg)), 6), round(math.sin(math.radians(deg)), 6)
    c = 0.0 if c == 0 else c
    s = 0.0 if s == 0 else s
    return f"{c}, 0, {s}, 0, 1, 0, {0.0 if s == 0 else -s}, 0, {c}"
L = ['[gd_scene format=3]', '',
     '[ext_resource type="Script" path="res://core/level.gd" id="1"]',
     '[ext_resource type="Resource" path="res://palettes/gray.tres" id="2"]',
     '[ext_resource type="PackedScene" path="res://scenes/two_streets/view.tscn" id="3"]',
     '[ext_resource type="Resource" path="res://scenes/two_streets/population.tres" id="4"]',
     '[ext_resource type="Script" path="res://core/ground_strip.gd" id="5"]',
     '[ext_resource type="Script" path="res://core/ground_band.gd" id="6"]']
for t in types:
    L.append(f'[ext_resource type="PackedScene" path="res://types/{t}.tscn" id="{tid[t]}"]')
L.append('')
bands = [('commercial', 'concrete', 50), ('block_w', 'sidewalk', 60), ('block_m', 'sidewalk', 60), ('block_e', 'sidewalk', 60), ('park', 'grass', 40), ('margin_south', 'concrete', 100), ('margin_north', 'grass', 100)]
for n, slot, w in bands:
    L += [f'[sub_resource type="Resource" id="band_{n}"]', 'script = ExtResource("6")', f'width = {float(w)}', f'slot = &"{slot}"', '']
L += ['[node name="TwoStreets" type="Node3D"]', 'script = ExtResource("1")', 'palette = ExtResource("2")',
      'view = ExtResource("3")', 'population = ExtResource("4")', '']
strips = [('CommercialGround', 'commercial', 200.0, 0, SIDE, -100),
          ('BlockGroundW', 'block_w', 63.0, -68.5, SIDE, -30), ('BlockGroundM', 'block_m', 56.0, -5, SIDE, -30),
          ('BlockGroundE', 'block_e', 53.0, 53.5, SIDE, -30), ('ParkGround', 'park', 200.0, 0, 0, 50)]
for name, b, length, x, y, z in strips:
    L += [f'[node name="{name}" type="Node3D" parent="."]', f'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x}, {y}, {z})',
          'script = ExtResource("5")', f'length = {length}', f'bands = Array[ExtResource("6")]([SubResource("band_{b}")])', '']
for name, t, x, y, z, yaw in items:
    L += [f'[node name="{name}" parent="." instance=ExtResource("{tid[t]}")]', f'transform = Transform3D({rot(yaw)}, {x}, {y}, {z})', '']
L += ['[node name="Backdrop" type="Node3D" parent="." groups=["backdrop"]]', '']
for name, b, length, x, y, z in bd_strips:
    L += [f'[node name="{name}" type="Node3D" parent="Backdrop"]', f'transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x}, {y}, {z})',
          'script = ExtResource("5")', f'length = {length}', f'bands = Array[ExtResource("6")]([SubResource("band_{b}")])', '']
for name, t, x, y, z, yaw in backdrop:
    L += [f'[node name="{name}" parent="Backdrop" instance=ExtResource("{tid[t]}")]', f'transform = Transform3D({rot(yaw)}, {x}, {y}, {z})', '']
(G/'scenes/two_streets/level.tscn').write_text('\n'.join(L), encoding='utf-8')
print(len(items), 'instances,', len(backdrop), 'backdrop,', len(types), 'types')
