"""STYLE STUDY copy of modeling/build_building_a.py (2026-09-23): deeper window/door recesses and an
open roof (coping ring on the parapets + a stair housing) instead of the full coping lid.
Three-storey shop building. Run with Blender --background --python this_file.
Self-contained; metres in game coordinates (+Y up, +Z front). No external assets.
"""
from pathlib import Path
import bpy

OUTPUT = Path(__file__).resolve().parent / 'building_a_study.glb'
WIDTH, DEPTH = 12.0, 7.8
GROUND_H, FLOOR_H, FLOORS = 3.8, 3.2, 3
WALL_H = GROUND_H + FLOOR_H * (FLOORS - 1)
PARAPET_H, PARAPET_T = 0.65, 0.22
CORNICE_H, CORNICE_OUT = 0.22, 0.22
RECESS, CUT_OVERLAP = 0.50, 0.02  # study: was 0.26
FRAME_W, FRAME_DEPTH, SILL_OUT, SILL_H = 0.12, 0.10, 0.18, 0.12
WINDOW_W, WINDOW_H, WINDOW_BASE = 1.65, 1.85, 0.70
WINDOW_X = (-4.35, -1.45, 1.45, 4.35)
SIDE_WINDOW_Z = (-2.0, -5.6)
DOOR_W, DOOR_H, DOOR_X, DOOR_THICK = 1.1, 2.3, 0.0, 0.08
SHOP_W, SHOP_H, SHOP_BASE = 3.5, 2.35, 0.30
SHOP_X = (-3.55, 3.55)
SIGN_W, SIGN_H, SIGN_Y, SIGN_T = 9.9, 0.48, 3.20, 0.10
CANOPY_W, CANOPY_DEPTH, CANOPY_H, CANOPY_Y = 1.8, 0.85, 0.12, 2.65
GLASS_T, GLASS_INSET = 0.04, 0.45  # study: was 0.21
MULLION_W = 0.075
PLINTH_H, PLINTH_T = 0.20, 0.06
HOUSING_W, HOUSING_D, HOUSING_H, HOUSING_X, HOUSING_Z = 3.0, 2.4, 2.4, 3.2, -5.0  # study: rooftop stair housing


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)


def material(slot):
    m = bpy.data.materials.get(slot)
    if m is None:
        m = bpy.data.materials.new(slot)
        m.diffuse_color = (1, 1, 1, 1)
        m.use_nodes = True
        m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (1, 1, 1, 1)
        m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 1
    return m


def box(name, size, center, slot=None):
    x, y, z = center
    sx, sy, sz = size
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if slot:
        obj.data.materials.append(material(slot))
    return obj


def recess(body, name, w, h, x, bottom, face=0.0, side=False):
    # Blind recesses: the original solid behind every opening remains sealed.
    depth = RECESS + CUT_OVERLAP
    center = (x, bottom + h / 2, face + (CUT_OVERLAP - RECESS) / 2)
    size = (w, h, depth)
    if side:
        center = (WIDTH / 2 + (CUT_OVERLAP - RECESS) / 2, bottom + h / 2, x)
        size = (depth, h, w)
    cutter = box(name + '_cut', size, center)
    bpy.context.view_layer.objects.active = body
    mod = body.modifiers.new(name, 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def front_window(body, name, x, bottom, w, h, mullion=True):
    recess(body, name, w, h, x, bottom)
    box(name + '_glass', (w, h, GLASS_T), (x, bottom + h / 2, -GLASS_INSET), 'window')
    for dx in (-1, 1):
        box(name + '_jamb', (FRAME_W, h + 2 * FRAME_W, FRAME_DEPTH),
            (x + dx * (w + FRAME_W) / 2, bottom + h / 2, FRAME_DEPTH / 2), 'trim')
    box(name + '_head', (w, FRAME_W, FRAME_DEPTH),
        (x, bottom + h + FRAME_W / 2, FRAME_DEPTH / 2), 'trim')
    box(name + '_sill', (w + 2 * FRAME_W, SILL_H, SILL_OUT),
        (x, bottom - SILL_H / 2, SILL_OUT / 2), 'trim')
    if mullion:
        box(name + '_mullion', (MULLION_W, h, FRAME_DEPTH),
            (x, bottom + h / 2, -FRAME_DEPTH / 2), 'trim_dark')


def build():
    reset()
    body = box('sealed_masonry', (WIDTH, WALL_H, DEPTH), (0, WALL_H / 2, -DEPTH / 2), 'wall')
    for floor in range(1, FLOORS):
        bottom = GROUND_H + (floor - 1) * FLOOR_H + WINDOW_BASE
        for i, x in enumerate(WINDOW_X):
            front_window(body, f'upper_{floor}_{i}', x, bottom, WINDOW_W, WINDOW_H)
        for i, z in enumerate(SIDE_WINDOW_Z):
            recess(body, f'side_{floor}_{i}', WINDOW_W, WINDOW_H, z, bottom, side=True)
            box('side_glass', (GLASS_T, WINDOW_H, WINDOW_W),
                (WIDTH / 2 - GLASS_INSET, bottom + WINDOW_H / 2, z), 'window')
            box('side_sill', (SILL_OUT, SILL_H, WINDOW_W + 2 * FRAME_W),
                (WIDTH / 2 + SILL_OUT / 2, bottom - SILL_H / 2, z), 'trim')
    for i, x in enumerate(SHOP_X):
        front_window(body, f'shop_{i}', x, SHOP_BASE, SHOP_W, SHOP_H, False)
    recess(body, 'entrance', DOOR_W, DOOR_H, DOOR_X, 0)
    box('door_leaf', (DOOR_W, DOOR_H, DOOR_THICK),
        (DOOR_X, DOOR_H / 2, -RECESS + DOOR_THICK / 2), 'door')
    box('entrance_canopy', (CANOPY_W, CANOPY_H, CANOPY_DEPTH),
        (DOOR_X, CANOPY_Y, CANOPY_DEPTH / 2), 'metal_dark')
    box('blank_shop_sign', (SIGN_W, SIGN_H, SIGN_T), (0, SIGN_Y, SIGN_T / 2), 'trim_dark')
    box('ground_cornice', (WIDTH + CORNICE_OUT * 2, CORNICE_H, DEPTH + CORNICE_OUT * 2),
        (0, GROUND_H, -DEPTH / 2), 'trim')
    box('plinth', (WIDTH, PLINTH_H, PLINTH_T),
        (0, PLINTH_H / 2, -RECESS - PLINTH_T / 2), 'concrete')
    roof_y = WALL_H + PARAPET_H / 2
    for z in (-PARAPET_T / 2, -DEPTH + PARAPET_T / 2):
        box('parapet', (WIDTH, PARAPET_H, PARAPET_T), (0, roof_y, z), 'wall')
    for x in (-(WIDTH - PARAPET_T) / 2, (WIDTH - PARAPET_T) / 2):
        box('parapet_side', (PARAPET_T, PARAPET_H, DEPTH - 2 * PARAPET_T), (x, roof_y, -DEPTH / 2), 'wall')
    # study: coping only on top of the parapets (a ring), so the roof deck stays open and lower
    top = WALL_H + PARAPET_H + CORNICE_H / 2
    cw = PARAPET_T + 2 * 0.08
    for z in (-PARAPET_T / 2, -DEPTH + PARAPET_T / 2):
        box('coping', (WIDTH + 2 * 0.08, CORNICE_H, cw), (0, top, z), 'trim')
    for x in (-(WIDTH - PARAPET_T) / 2, (WIDTH - PARAPET_T) / 2):
        box('coping_side', (cw, CORNICE_H, DEPTH - 2 * PARAPET_T - 2 * 0.08), (x, top, -DEPTH / 2), 'trim')
    box('stair_housing', (HOUSING_W, HOUSING_H, HOUSING_D), (HOUSING_X, WALL_H + HOUSING_H / 2, HOUSING_Z), 'wall')
    box('housing_cap', (HOUSING_W + 0.16, CORNICE_H, HOUSING_D + 0.16),
        (HOUSING_X, WALL_H + HOUSING_H + CORNICE_H / 2, HOUSING_Z), 'trim')
    export()


def export():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', export_yup=True,
        export_normals=True, export_texcoords=False, export_animations=False,
        export_cameras=False, export_lights=False, export_extras=False)
    print('MODEL_WRITTEN', OUTPUT)


if __name__ == '__main__':
    build()
