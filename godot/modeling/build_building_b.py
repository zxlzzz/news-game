"""Four-storey corner block with a recessed top floor. Blender --background --python.
Self-contained; all dimensions in metres, game +Y up / +Z front. Original geometry.
"""
from pathlib import Path
import bpy

OUTPUT = Path(__file__).resolve().parents[1] / 'models' / 'building_b.glb'
WIDTH, DEPTH = 14.0, 9.0
GROUND_H, FLOOR_H, FLOORS = 3.8, 3.2, 4
LOWER_H = GROUND_H + 2 * FLOOR_H
TOP_H = FLOOR_H
TOP_SIDE_INSET, TOP_FRONT_INSET = 0.60, 0.90
TOP_W, TOP_D = WIDTH - 2 * TOP_SIDE_INSET, DEPTH - TOP_FRONT_INSET
PARAPET_H, PARAPET_T = 0.65, 0.24
RECESS, CUT_OVERLAP, GLASS_T, GLASS_INSET = 0.28, 0.02, 0.04, 0.23
WINDOW_W, WINDOW_H, WINDOW_BASE = 3.25, 1.80, 0.72
WINDOW_X = (-4.50, 0.0, 4.50)
TOP_WINDOW_W, TOP_WINDOW_X = 3.0, (-4.1, 0.0, 4.1)
FRAME_W, FRAME_D, SILL_H, SILL_D = 0.10, 0.09, 0.16, 0.24
MULLION_W = 0.08
DOOR_X, DOOR_W, DOOR_H, DOOR_T = -4.5, 1.1, 2.3, 0.08
ENTRY_PANEL_W, ENTRY_PANEL_H, ENTRY_PANEL_D = 2.55, 3.35, 0.16
SHOP_X, SHOP_W, SHOP_H, SHOP_BASE = (-0.4, 4.1), 3.5, 2.60, 0.25
CANOPY_W, CANOPY_D, CANOPY_H, CANOPY_Y = 6.0, 0.90, 0.16, 3.05
BELT_H, BELT_OUT = 0.20, 0.22
ROOF_T = 0.16
SIDE_Z, SIDE_W = (-2.45, -6.25), 2.40


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


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


def cut(body, name, size, center):
    cutter = box(name + '_cut', size, center)
    bpy.context.view_layer.objects.active = body
    mod = body.modifiers.new(name, 'BOOLEAN')
    mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def opening(body, name, x, bottom, w, h, face=0.0, slot='window', split=True):
    cut(body, name, (w, h, RECESS + CUT_OVERLAP),
        (x, bottom + h / 2, face + (CUT_OVERLAP - RECESS) / 2))
    box(name + '_infill', (w, h, GLASS_T if slot == 'window' else DOOR_T),
        (x, bottom + h / 2, face - GLASS_INSET), slot)
    if slot == 'window':
        for dx in (-1, 1):
            box(name + '_frame', (FRAME_W, h, FRAME_D),
                (x + dx * (w - FRAME_W) / 2, bottom + h / 2, face - FRAME_D / 2), 'metal_dark')
        if split:
            box(name + '_mullion', (MULLION_W, h, FRAME_D),
                (x, bottom + h / 2, face - FRAME_D / 2), 'metal_dark')
        box(name + '_sill', (w + FRAME_W * 2, SILL_H, SILL_D),
            (x, bottom - SILL_H / 2, face + SILL_D / 2), 'trim')


def build():
    reset()
    body = box('sealed_lower_block', (WIDTH, LOWER_H, DEPTH), (0, LOWER_H / 2, -DEPTH / 2), 'wall')
    for floor in (1, 2):
        bottom = GROUND_H + (floor - 1) * FLOOR_H + WINDOW_BASE
        for i, x in enumerate(WINDOW_X):
            opening(body, f'wide_window_{floor}_{i}', x, bottom, WINDOW_W, WINDOW_H)
        for i, z in enumerate(SIDE_Z):
            cut(body, f'side_{floor}_{i}', (RECESS + CUT_OVERLAP, WINDOW_H, SIDE_W),
                (WIDTH / 2 + (CUT_OVERLAP - RECESS) / 2, bottom + WINDOW_H / 2, z))
            box('side_glass', (GLASS_T, WINDOW_H, SIDE_W),
                (WIDTH / 2 - GLASS_INSET, bottom + WINDOW_H / 2, z), 'window')
            box('side_sill', (SILL_D, SILL_H, SIDE_W + FRAME_W * 2),
                (WIDTH / 2 + SILL_D / 2, bottom - SILL_H / 2, z), 'trim')
    for i, x in enumerate(SHOP_X):
        opening(body, f'shop_{i}', x, SHOP_BASE, SHOP_W, SHOP_H, split=False)
    opening(body, 'door', DOOR_X, 0, DOOR_W, DOOR_H, slot='door')
    # Broad entrance surround is three solids; no plate across the doorway.
    jamb_w = (ENTRY_PANEL_W - DOOR_W) / 2
    for dx in (-1, 1):
        box('entry_pier', (jamb_w, ENTRY_PANEL_H, ENTRY_PANEL_D),
            (DOOR_X + dx * (DOOR_W + jamb_w) / 2, ENTRY_PANEL_H / 2, ENTRY_PANEL_D / 2), 'concrete')
    box('entry_lintel', (DOOR_W, ENTRY_PANEL_H - DOOR_H, ENTRY_PANEL_D),
        (DOOR_X, (DOOR_H + ENTRY_PANEL_H) / 2, ENTRY_PANEL_D / 2), 'concrete')
    box('entrance_canopy', (CANOPY_W, CANOPY_H, CANOPY_D),
        (DOOR_X + (CANOPY_W - ENTRY_PANEL_W) / 2, CANOPY_Y, CANOPY_D / 2), 'metal_dark')
    for y in (GROUND_H, LOWER_H):
        box('horizontal_belt', (WIDTH + 2 * BELT_OUT, BELT_H, DEPTH + 2 * BELT_OUT),
            (0, y - BELT_H / 2, -DEPTH / 2), 'trim')
    top = box('setback_floor', (TOP_W, TOP_H, TOP_D),
        (0, LOWER_H + TOP_H / 2, -TOP_FRONT_INSET - TOP_D / 2), 'wall')
    for i, x in enumerate(TOP_WINDOW_X):
        opening(top, f'top_{i}', x, LOWER_H + WINDOW_BASE, TOP_WINDOW_W, WINDOW_H, -TOP_FRONT_INSET)
    roof_y = LOWER_H + TOP_H
    box('roof_cap', (TOP_W + 2 * BELT_OUT, ROOF_T, TOP_D + 2 * BELT_OUT),
        (0, roof_y + ROOF_T / 2, -TOP_FRONT_INSET - TOP_D / 2), 'trim')
    # The setback terrace has a solid parapet, no dense pickets.
    box('terrace_parapet', (WIDTH, PARAPET_H, PARAPET_T),
        (0, LOWER_H + PARAPET_H / 2, -PARAPET_T / 2), 'concrete')
    for x in (-(WIDTH - PARAPET_T) / 2, (WIDTH - PARAPET_T) / 2):
        box('terrace_return', (PARAPET_T, PARAPET_H, TOP_FRONT_INSET),
            (x, LOWER_H + PARAPET_H / 2, -TOP_FRONT_INSET / 2), 'concrete')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', export_yup=True,
        export_normals=True, export_texcoords=False, export_animations=False,
        export_cameras=False, export_lights=False, export_extras=False)
    print('MODEL_WRITTEN', OUTPUT)


if __name__ == '__main__':
    build()
