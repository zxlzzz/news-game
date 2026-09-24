"""Check a GLB against the modelling rules (模型制作说明.md / 建模规范与参数.md).

    python check_model.py model.glb [more.glb ...]

Only the Python standard library is needed. Prints a report per file and ends with
PASS / FAIL; exit code 1 if any file fails. FAIL items break the game's look or loading;
WARN items are allowed but should be deliberate.

The same script is used by the modeller before delivery and by the reviewer after.
"""
import json, math, os, re, struct, sys

# Colour slots a material may be named after. Must equal the keys of godot/core/slots.tres;
# when this script sits in the repo (godot/modeling/) it checks that and fails if they differ.
SLOTS = {
    "accent", "bark", "concrete", "door", "fabric", "foliage", "grass", "hidden", "metal",
    "metal_dark", "paint", "road", "sidewalk", "trim", "trim_dark", "wall", "wall_plaster", "wall_brick", "wall_stone", "water", "window", "wood",
}
# Slots that may carry a texture, used only for its alpha (cut-out decals).
ALPHA_SLOTS = {"paint"}
# Slots whose surfaces are not solids (flat decals), exempt from the closed-solid warning.
FLAT_SLOTS = {"paint", "hidden"}
WELD = 0.0005          # metres; the game welds vertices this close when finding edges
GROUND_TOL = 0.01      # metres; lowest point must be this close to y = 0
MAX_TRIS = 50000

COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def slots_tres_keys():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "core", "slots.tres")
    if not os.path.exists(p):
        return None
    text = open(p, encoding="utf-8").read()
    return set(re.findall(r'^&"([^"]+)"\s*:', text, re.M))


def read_glb(path):
    data = open(path, "rb").read()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise ValueError("not a binary glTF 2.0 (.glb) file")
    jlen, jtype = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + jlen].decode("utf-8"))
    binary = b""
    off = 20 + jlen
    if off < len(data):
        blen, _ = struct.unpack_from("<II", data, off)
        binary = data[off + 8: off + 8 + blen]
    return gltf, binary


def accessor(gltf, binary, i):
    a = gltf["accessors"][i]
    if "bufferView" not in a:
        return [[0.0] * NCOMP[a["type"]]] * a["count"]
    bv = gltf["bufferViews"][a["bufferView"]]
    fmt = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    size = struct.calcsize("<" + fmt)
    stride = bv.get("byteStride") or size * n
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    return [list(struct.unpack_from("<" + fmt * n, binary, base + k * stride)) for k in range(a["count"])]


def mat4_mul(a, b):  # column-major 4x4 as flat lists (glTF convention)
    return [sum(a[r + 4 * k] * b[k + 4 * c] for k in range(4)) for c in range(4) for r in range(4)]


def node_matrix(node):
    if "matrix" in node:
        return list(node["matrix"])
    t = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    s = node.get("scale", [1, 1, 1])
    r = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]
    return [r[0] * s[0], r[1] * s[0], r[2] * s[0], 0,
            r[3] * s[1], r[4] * s[1], r[5] * s[1], 0,
            r[6] * s[2], r[7] * s[2], r[8] * s[2], 0,
            t[0], t[1], t[2], 1]


def axis_scales(m):
    cols = [m[0:3], m[4:7], m[8:11]]
    lens = [math.sqrt(sum(v * v for v in c)) for c in cols]
    det = (m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9])
           + m[8] * (m[1] * m[6] - m[2] * m[5]))
    return lens, det


def check(path):
    fails, warns, info = [], [], []
    try:
        gltf, binary = read_glb(path)
    except Exception as e:  # unreadable file: nothing else can be checked
        return [f"cannot read: {e}"], [], []

    for ext in gltf.get("extensionsRequired", []):
        fails.append(f"requires extension {ext} (Godot may not load it; export without compression/quantization)")

    mats = gltf.get("materials", [])
    textures_used = False
    for i, m in enumerate(mats):
        name = m.get("name", "")
        pbr = m.get("pbrMetallicRoughness", {})
        if name not in SLOTS:
            fails.append(f"material {i} '{name}' is not a colour slot name")
        if "baseColorTexture" in pbr:
            textures_used = True
            if name not in ALPHA_SLOTS:
                fails.append(f"material '{name}' has a colour texture (only {sorted(ALPHA_SLOTS)} may, for alpha cut-out)")
        other = [k for k in ("normalTexture", "occlusionTexture", "emissiveTexture") if k in m]
        if "metallicRoughnessTexture" in pbr:
            other.append("metallicRoughnessTexture")
        if other:
            warns.append(f"material '{name}' has {', '.join(other)} (ignored by the look; remove to keep the file small)")
        mode = m.get("alphaMode", "OPAQUE")
        if mode == "BLEND":
            fails.append(f"material '{name}' is semi-transparent (alphaMode BLEND)")
        if mode == "MASK" and name not in ALPHA_SLOTS:
            fails.append(f"material '{name}' uses alpha cut-out; only {sorted(ALPHA_SLOTS)} may")

    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    tris_by_mat = {}
    total_tris = 0
    mesh_edges = {}  # mesh index -> (open, nonmanifold) counted in mesh space

    def visit(ni, parent):
        nonlocal total_tris
        node = gltf["nodes"][ni]
        m = mat4_mul(parent, node_matrix(node))
        lens, det = axis_scales(node_matrix(node))
        nm = node.get("name", f"node {ni}")
        if max(lens) - min(lens) > 1e-4 * max(lens):
            fails.append(f"node '{nm}' has non-uniform scale {[round(v, 5) for v in lens]}")
        if det < 0:
            fails.append(f"node '{nm}' is mirrored (negative scale)")
        if "mesh" in node:
            mi = node["mesh"]
            mesh = gltf["meshes"][mi]
            edges = {}
            weld = {}
            for p in mesh["primitives"]:
                if p.get("mode", 4) != 4:
                    fails.append(f"mesh '{mesh.get('name', mi)}' has a non-triangle primitive")
                    continue
                if "NORMAL" not in p["attributes"]:
                    fails.append(f"mesh '{mesh.get('name', mi)}' has no normals")
                pos = accessor(gltf, binary, p["attributes"]["POSITION"])
                idx = accessor(gltf, binary, p["indices"]) if "indices" in p else [[k] for k in range(len(pos))]
                idx = [v[0] for v in idx]
                mname = mats[p["material"]].get("name", "") if "material" in p else "(none)"
                if "material" not in p:
                    fails.append(f"mesh '{mesh.get('name', mi)}' has a primitive without material")
                ntri = len(idx) // 3
                tris_by_mat[mname] = tris_by_mat.get(mname, 0) + ntri
                total_tris += ntri
                for v in pos:
                    w = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
                         m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
                         m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]
                    for k in range(3):
                        lo[k] = min(lo[k], w[k])
                        hi[k] = max(hi[k], w[k])
                if mname in FLAT_SLOTS:
                    continue
                ids = []
                for v in pos:
                    key = (round(v[0] / WELD), round(v[1] / WELD), round(v[2] / WELD))
                    ids.append(weld.setdefault(key, len(weld)))
                for t in range(ntri):
                    a, b, c = ids[idx[3 * t]], ids[idx[3 * t + 1]], ids[idx[3 * t + 2]]
                    if a == b or b == c or a == c:
                        continue
                    for e in ((a, b), (b, c), (c, a)):
                        k = (min(e), max(e))
                        edges[k] = edges.get(k, 0) + 1
            if mi not in mesh_edges:
                mesh_edges[mi] = (sum(1 for n in edges.values() if n == 1), sum(1 for n in edges.values() if n > 2))
        for c in node.get("children", []):
            visit(c, m)

    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    scene = gltf.get("scenes", [{}])[gltf.get("scene", 0)]
    for r in scene.get("nodes", []):
        visit(r, ident)

    if total_tris == 0:
        fails.append("no triangles")
        return fails, warns, info

    size = [hi[k] - lo[k] for k in range(3)]
    info.append("size  x %.3f  y %.3f  z %.3f m" % tuple(size))
    info.append("box   min (%.3f, %.3f, %.3f)  max (%.3f, %.3f, %.3f)" % (*lo, *hi))
    info.append("triangles %d: " % total_tris + ", ".join(f"{k} {v}" for k, v in sorted(tris_by_mat.items())))
    if gltf.get("animations"):
        info.append("animations: " + ", ".join(a.get("name", "?") for a in gltf["animations"]))

    if abs(lo[1]) > GROUND_TOL:
        fails.append(f"lowest point is at y = {lo[1]:.3f}; the origin must be on the ground (y = 0)")
    if not (lo[0] - 0.01 <= 0 <= hi[0] + 0.01 and lo[2] - 0.01 <= 0 <= hi[2] + 0.01):
        fails.append("origin (0, 0) is outside the model's footprint; put it at the ground contact point")
    if max(size) > 200:
        fails.append(f"largest side {max(size):.1f} m: units are probably not metres")
    if max(size) < 0.02:
        fails.append(f"largest side {max(size):.4f} m: units are probably not metres")
    if total_tris > MAX_TRIS:
        warns.append(f"{total_tris} triangles (> {MAX_TRIS}); every edge sharper than 35 deg draws a line")
    for mi, (open_e, nonman) in mesh_edges.items():
        nm = gltf["meshes"][mi].get("name", mi)
        if open_e:
            warns.append(f"mesh '{nm}': {open_e} open edges (not a closed solid: draws edge lines there and may not cast a shadow)")
        if nonman:
            warns.append(f"mesh '{nm}': {nonman} edges shared by more than two faces")
    if textures_used:
        info.append("textures present (alpha cut-out only)")
    return fails, warns, info


def main(paths):
    if not paths:
        print(__doc__)
        return 2
    bad = False
    keys = slots_tres_keys()
    if keys is not None and keys != SLOTS:
        print("FAIL slot list in check_model.py differs from godot/core/slots.tres:",
              "missing here", sorted(keys - SLOTS), "extra here", sorted(SLOTS - keys))
        bad = True
    for p in paths:
        fails, warns, info = check(p)
        print(f"== {p}")
        for s in info:
            print("   " + s)
        for s in warns:
            print("   WARN " + s)
        for s in fails:
            print("   FAIL " + s)
        print("   " + ("FAIL" if fails else "PASS"))
        bad = bad or bool(fails)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
