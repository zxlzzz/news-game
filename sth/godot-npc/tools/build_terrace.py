"""Generate the terrace test scene (composition modeled on the Chants 'sunlit terrace' shot) as a GLB.
Units: meters, +Y up, camera looks from +Z. Materials carry only a flat base color (color slot)."""
import numpy as np, trimesh
from trimesh.creation import box, revolve, extrude_polygon
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

SLOTS = {  # slot name -> base color (sRGB 0-255)
    'stone': (254, 235, 71),
    'door':  (140, 120, 150),
    'relief':(254, 235, 71),
}
parts = {k: [] for k in SLOTS}

def B(sx, sy, sz, x, y, z, slot='stone'):
    m = box(extents=(sx, sy, sz)); m.apply_translation((x, y, z)); parts[slot].append(m); return m

def arch_poly(w, h, n=16):
    """arched opening outline in XY, bottom at y=0, width w, total height h (semicircle top)."""
    r = w / 2; hs = h - r
    pts = [(-r, 0), (r, 0), (r, hs)]
    for i in range(1, n):
        a = np.pi * i / n; pts.append((r * np.cos(a), hs + r * np.sin(a)))
    pts.append((-r, hs))
    return Polygon(pts)

def prism_xy(poly, depth, x, y, z0):
    """extrude XY polygon along +Z by depth, placed with base at (x,y), front at z0 (extends to z0-depth)."""
    m = extrude_polygon(poly, depth); m.apply_translation((x, y, z0 - depth)); return m

def diff(a, bs):
    return trimesh.boolean.difference([a] + bs, engine='manifold')

# ---------------- upper level ----------------
FLOOR_Y = 0.0; LOW_Y = -4.2
# upper walkway slab (top at y=0)
B(15, 0.4, 4.2, -2.5, -0.2, -2.1)
# right upper plaza (to the right of the L corner)
B(5, 0.4, 12, 7.5, -0.2, 2.0)

# back wall with arched window recesses
wall = box(extents=(22, 9, 1.2)); wall.apply_translation((1.0, 4.5, -4.8))
cuts = []
wins = []
for i, wx in enumerate([3.2, 5.4, 7.6, 9.8]):
    cuts.append(prism_xy(arch_poly(1.3, 3.0), 0.35, wx, 5.2, -4.2 + 0.001))
    wins.append(wx)
for wx in [-6.0, -3.6]:
    cuts.append(prism_xy(arch_poly(1.2, 2.2), 0.35, wx, 6.6, -4.2 + 0.001))
    wins.append(None)
# doorway arches in the far-left wall
cuts.append(prism_xy(arch_poly(2.0, 3.2), 0.6, -8.0, 0.0, -4.2 + 0.001))
cuts.append(prism_xy(arch_poly(1.8, 3.0), 0.35, -5.6, 0.0, -4.2 + 0.001))
parts['stone'].append(diff(wall, cuts))
# window mullions (thin bars inside the recesses)
for wx in [3.2, 5.4, 7.6, 9.8]:
    B(0.06, 2.9, 0.06, wx, 5.2 + 1.45, -4.5)
    for hy in [5.9, 6.6, 7.3]:
        B(1.3, 0.06, 0.06, wx, hy, -4.5)
    B(1.5, 0.15, 0.3, wx, 5.12, -4.05)  # sill
# door leaf in the smaller left arch
B(1.7, 2.6, 0.08, -5.6, 1.3, -4.52, 'door')

# pillar / buttress
B(1.3, 9.5, 1.6, 0.6, 4.55, -3.4)
# upper cornice band
B(22, 0.3, 0.3, 1.0, 8.6, -4.05)

# relief panels: framed box with raised blocky motifs
def relief(cx, cy, w, h):
    B(w, h, 0.25, cx, cy, -4.08)                # panel
    B(w, 0.18, 0.12, cx, cy + h/2 - 0.09, -3.9)  # frame top
    B(w, 0.18, 0.12, cx, cy - h/2 + 0.09, -3.9)
    B(0.18, h, 0.12, cx - w/2 + 0.09, cy, -3.9)
    B(0.18, h, 0.12, cx + w/2 - 0.09, cy, -3.9)
    # a shelf ledge under the panel
    B(w + 0.3, 0.2, 0.45, cx, cy - h/2 - 0.1, -3.95)
    # motifs: towers, disc, crescent
    rng = np.random.default_rng(abs(int(cx * 10)))
    for k in range(4):
        tw = rng.uniform(0.25, 0.45); th = rng.uniform(0.5, 1.3)
        B(tw, th, 0.12, cx - w/2 + 0.5 + k * 0.55, cy - h/2 + 0.2 + th/2, -3.84, 'relief')
    d = trimesh.creation.cylinder(radius=0.45, height=0.1, sections=32)
    d.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, (1, 0, 0)))
    d.apply_translation((cx + w/2 - 0.8, cy + 0.2, -3.85)); parts['relief'].append(d)
    cres = Point(0, 0).buffer(0.35, 32).difference(Point(0.15, 0.1).buffer(0.3, 32))
    parts['relief'].append(prism_xy(cres, 0.1, cx - w/2 + 0.8, cy + h/2 - 0.6, -3.78))
relief(-2.6, 2.6, 3.6, 2.2)
relief(4.8, 2.4, 4.0, 2.4)

# benches
def bench(cx, cz, L):
    B(L, 0.12, 0.45, cx, 0.45, cz)
    for dx in (-L/2 + 0.3, 0, L/2 - 0.3):
        B(0.12, 0.39, 0.3, cx + dx, 0.195, cz)
bench(-3.0, -3.4, 2.8)
bench(5.4, -3.3, 3.2)

# ---------------- balustrade ----------------
prof = np.array([[0, 0], [0.12, 0], [0.12, 0.05], [0.07, 0.1], [0.05, 0.22], [0.10, 0.36], [0.06, 0.5], [0.06, 0.55], [0.11, 0.58], [0.11, 0.62], [0, 0.62]])
def baluster(x, z, y0):
    m = revolve(prof, sections=12)  # revolves around Z; rotate so axis is Y
    m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/2, (1, 0, 0)))
    m.apply_translation((x, y0 + 0.12, z)); parts['stone'].append(m)
def balustrade(p0, p1, y0=0.0):
    p0 = np.array(p0, float); p1 = np.array(p1, float); d = p1 - p0; L = np.linalg.norm(d); u = d / L
    ang = np.arctan2(u[1], u[0])
    def seg_box(sx, sy, sz, t, yc):
        m = box(extents=(sx, sy, sz))
        m.apply_transform(trimesh.transformations.rotation_matrix(-ang, (0, 1, 0)))
        c = p0 + u * t; m.apply_translation((c[0], yc, c[1])); parts['stone'].append(m)
    seg_box(L, 0.12, 0.34, L/2, y0 + 0.06)             # plinth
    seg_box(L, 0.16, 0.4, L/2, y0 + 0.82)              # top rail
    nposts = int(L // 3.0) + 1
    for i in range(nposts + 1):
        t = min(i * L / nposts, L)
        seg_box(0.42, 0.95, 0.42, t, y0 + 0.475)
    n = int(L / 0.28)
    for i in range(1, n):
        t = i * L / n
        if any(abs(t - k * L / nposts) < 0.3 for k in range(nposts + 1)): continue
        c = p0 + u * t; baluster(c[0], c[1], y0)
balustrade((-9.8, 0.0), (5.0, 0.0))
balustrade((5.0, 0.0), (5.0, 7.5))

# ---------------- lower level ----------------
B(15, 0.3, 9, -2.5, LOW_Y - 0.15, 4.5)                     # lower court floor
# retaining wall under walkway (front face at z=0 .. slab), with a door arch
rw = box(extents=(15, 4.2, 0.8)); rw.apply_translation((-2.5, LOW_Y/2, -0.4))
dcut = prism_xy(arch_poly(1.6, 2.6), 0.3, 1.0, LOW_Y, 0.001)
parts['stone'].append(diff(rw, [dcut]))
B(0.72, 2.3, 0.06, 0.6, LOW_Y + 1.15, -0.27, 'door'); B(0.72, 2.3, 0.06, 1.4, LOW_Y + 1.15, -0.27, 'door')
# side wall under the right plaza (faces -x toward lower court)
B(0.8, 4.2, 12, 5.4, LOW_Y/2, 2.0)
# left block with arched door + stairs up
lb = box(extents=(4, 4.2, 9)); lb.apply_translation((-11.5, LOW_Y/2, 4.5))
lbcut = prism_xy(arch_poly(1.4, 2.4), 0.3, 1.8, LOW_Y, 0.001)
lbcut.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, (0, 1, 0)))
lbcut.apply_translation((-9.5 - 1.8 + 0.0, 0, 3.0 + 1.8))
parts['stone'].append(lb)
for i in range(8):  # stairs along the left block going up toward -z
    h = (i + 1) * 0.5
    B(2.2, h, 0.5, -8.4, LOW_Y + h/2, 7.8 - i * 0.5)
# flying arch: slanted slab from lower court up to the balustrade
fa = box(extents=(0.8, 0.5, 6.0))
fa.apply_transform(trimesh.transformations.rotation_matrix(np.radians(40), (1, 0, 0)))
fa.apply_translation((-5.0, LOW_Y + 2.0, 2.8)); parts['stone'].append(fa)

# ---------------- right stairs down ----------------
for i in range(7):
    t = -0.4 * (i + 1)
    B(0.6, t - LOW_Y, 5.0, 10.3 + i * 0.6, (t + LOW_Y) / 2, 5.5)

scene = trimesh.Scene()
for slot, ms in parts.items():
    if not ms: continue
    m = trimesh.util.concatenate(ms)
    m.unmerge_vertices()  # flat shading: every face gets its own vertices/normal
    c = SLOTS[slot]
    m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name=slot, baseColorFactor=[(c[0]/255)**2.2, (c[1]/255)**2.2, (c[2]/255)**2.2, 1.0], metallicFactor=0.0, roughnessFactor=1.0))
    scene.add_geometry(m, node_name=slot, geom_name=slot)
scene.export('/home/claude/proj/models/terrace.glb', include_normals=True)
print({k: sum(len(m.faces) for m in v) for k, v in parts.items()})
