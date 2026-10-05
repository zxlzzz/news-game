"""Audit stages: source (npz, 77 joints), mapping without minSpread, accepted mapping (Godot 'pre'), final.
All in the ClipPose figure frame (figure units, facing +Z)."""
import ast, json, sys
from pathlib import Path
import numpy as np

REPO = Path(r"C:/Users/Hsinlung/Desktop/news-game")
G = REPO / "godot"
SCR = Path(__file__).parent
P0 = json.load(open(G / "npc/skeleton-params.json"))
INDEX = json.load(open(G / "npc/motion/index.json"))
NAMES = INDEX["names"]
J = {n: i for i, n in enumerate(NAMES)}
INTER = json.load(open(G / "npc/interactions.json", encoding="utf-8"))
SRC_LEG = 0.528 + 0.423

src = open(r"C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py", encoding="utf-8").read()
i0 = src.index("bone_order_names_with_parents = [", src.index("class SOMASkeleton77"))
i1 = src.index("]\n", i0)
BONES = ast.literal_eval(src[i0 + len("bone_order_names_with_parents = "):i1 + 1])
SOMA = {n: i for i, (n, _) in enumerate(BONES)}
SOMA_EDGES = [(SOMA[p], i) for i, (n, p) in enumerate(BONES) if p and "Hand" not in n[4:] and "Eye" not in n and "Jaw" not in n
              and "Toe" not in n[4:] or (p and n.endswith("ToeEnd"))]

def unit(a):
    return a / max(np.linalg.norm(a), 1e-9)

def torso_frame(s):
    up = unit(s[J["Neck1"]] - s[J["Hips"]])
    lat = s[J["LeftArm"]] - s[J["RightArm"]]
    lat = unit(lat - up * lat.dot(up))
    fw = np.cross(lat, up)
    return np.array([lat, up, fw])

def head_vec(s):
    return (s[J["Head"]] + s[J["HeadEnd"]]) / 2 - s[J["Neck1"]]

def rot_to(a, b, v):
    k = np.cross(a, b); sn = np.linalg.norm(k); cs = a.dot(b)
    if sn < 1e-9: return v
    u = k / sn; th = np.arctan2(sn, cs)
    return v * np.cos(th) + np.cross(u, v) * np.sin(th) + u * u.dot(v) * (1 - np.cos(th))

def rot_axis(v, u, th):
    return v * np.cos(th) + np.cross(u, v) * np.sin(th) + u * u.dot(v) * (1 - np.cos(th))

def ik(root, l1, l2, target, hint):
    aim = target - root
    d = min(max(np.linalg.norm(aim), abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6)
    ax = unit(aim)
    b = hint - ax * hint.dot(ax)
    if np.linalg.norm(b) < 1e-6:
        b = np.array([0, 0, 1.0]) - ax * ax[2]
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = np.sqrt(max(0, l1 * l1 - x * x))
    return root + ax * x + unit(b) * h, root + ax * d

class Mapper:
    def __init__(self, rest):
        F = torso_frame(rest)
        self.REST = unit(F @ head_vec(rest))
    def head_dir(self, s):
        F = torso_frame(s)
        l = unit(F @ head_vec(s))
        return unit(F.T @ rot_to(self.REST, np.array([0, 1.0, 0]), l))
    def map(self, s, P, o):
        g = lambda n: s[J[n]]
        hs = g("Hips")
        r = (P["thigh"] + P["shin"]) / SRC_LEG
        S = lambda p: np.array([o[0] + (p[0] - o[0]) * r, p[1] * r, o[2] + (p[2] - o[2]) * r])
        H = S(hs)
        drop = 0.0; reach = P["thigh"] + P["shin"] - 1e-4
        for sd in ("Left", "Right"):
            ov = H - S(g(sd + "Foot")); h2 = ov[0] ** 2 + ov[2] ** 2
            if ov[1] > 0 and np.linalg.norm(ov) > reach and h2 < reach * reach:
                drop = max(drop, ov[1] - np.sqrt(reach * reach - h2))
        H = H - [0, drop, 0]
        N = H + unit(g("Neck1") - hs) * P["torso"]
        hd = self.head_dir(s)
        side = torso_frame(s)[0]
        neckEnd = N + hd * P["neck"]; head = neckEnd + hd * P["headR"]
        segs = [[H, N], [N, neckEnd]]
        out = {"H": H, "N": N, "head": head}
        for sd in ("Left", "Right"):
            c = g(sd + "Arm") - g("Neck1"); u = g(sd + "ForeArm") - g(sd + "Arm"); fa = g(sd + "Hand") - g(sd + "ForeArm")
            w = P["clavSplit"]
            ud = unit(u + c * w); fd = unit(fa + c * (1 - w))
            if P["minSpread"] > 0:
                th = np.radians(P["minSpread"]); th2 = th + np.radians(20)
                a = np.arccos(np.clip(ud.dot(hd), -1, 1))
                if a < th2:
                    q = a / th2
                    h = (2 * q ** 3 - 3 * q * q + 1) * th + (-2 * q ** 3 + 3 * q * q) * th2 + (q ** 3 - q * q) * th2
                    outv = unit(side * (1 if sd == "Left" else -1) - hd * side.dot(hd))
                    fwd = np.cross(hd, outv); cf = ud.dot(fwd)
                    lat = np.sqrt(max(0, np.sin(h) ** 2 - cf * cf))
                    nu = unit(hd * np.cos(h) + fwd * cf + outv * lat)
                    k = np.cross(ud, nu); sn = np.linalg.norm(k)
                    if sn > 1e-9:
                        fd = rot_axis(fd, k / sn, np.arctan2(sn, ud.dot(nu)))
                    ud = nu
            el = N + ud * P["upperArm"]; hand = el + fd * P["foreArm"]
            out["hand" + sd] = hand
            knee, end = ik(H, P["thigh"], P["shin"], S(g(sd + "Foot")), g(sd + "Shin") - hs)
            toe = end + unit(g(sd + "ToeEnd") - g(sd + "Foot")) * P["foot"]
            segs += [[N, el], [el, hand], [H, knee], [knee, end], [end, toe]]
        out["segs"] = segs
        return out

REST = np.array(json.load(open(G / "npc/motion/stand_idle.json"))["frames"][0])
MAPPER = Mapper(REST)
REST_PITCH = []
for sd in ("Left", "Right"):
    d = REST[J[sd + "ToeEnd"]] - REST[J[sd + "Foot"]]
    REST_PITCH.append(np.arctan2(d[1], np.hypot(d[0], d[2])))

def rot_y(angle):
    c, s = np.cos(angle), np.sin(angle)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])

class Clip:
    """Mirrors clip_pose.gd: same origin, turn and progress removal; also the 77-joint source in that frame."""
    def __init__(self, cid, P=P0):
        d = json.load(open(G / f"npc/motion/{cid}.json"))
        fr = np.array(d["frames"])
        self.fps = d["fps"]
        hips = J["Hips"]
        shift = fr[-1, hips] - fr[0, hips]
        self.chains = len(fr) > 1 and np.all(np.linalg.norm(fr[-1] - shift - fr[0], axis=1) <= 0.001)
        self.count = len(fr) - 1 if self.chains else len(fr)
        o = fr[0, hips]
        self.r = (P["thigh"] + P["shin"]) / SRC_LEG
        raw = [MAPPER.map(f, P, o) for f in fr]
        a = raw[0]["H"]; b = raw[min(self.count, len(fr) - 1)]["H"]
        travel = np.array([b[0] - a[0], 0, b[2] - a[2]])
        fixed = INTER["clips"].get(cid, {}).get("stationary", False)
        drift = travel.copy()
        if np.linalg.norm(travel) >= 0.05 and not fixed:
            turn = rot_y(-np.arctan2(travel[0], travel[2]))
        else:
            travel = np.zeros(3)
            fw = torso_frame(fr[0])[2]
            turn = rot_y(-np.arctan2(fw[0], fw[2]))
        self.turn, self.o, self.fr = turn, o, fr
        self.mapped = []
        self.prog = []
        for i, m in enumerate(raw):
            prog = (drift if fixed else travel) * (i / self.count)
            self.prog.append(prog)
            loc = lambda q: turn @ (np.array([q[0] - o[0], q[1], q[2] - o[2]]) - prog)
            segs = [[loc(s0), loc(s1)] for s0, s1 in m["segs"]]
            for side, si in ((0, 6), (1, 11)):
                a0, a1 = segs[si]
                dl = a1 - a0; hz = np.array([dl[0], 0, dl[2]]); hz = unit(hz)
                pitch = np.arctan2(dl[1], np.hypot(dl[0], dl[2])) - REST_PITCH[side]
                segs[si][1] = a0 + (hz * np.cos(pitch) + np.array([0, 1, 0]) * np.sin(pitch)) * np.linalg.norm(dl)
            self.mapped.append({"segs": segs, "head": loc(m["head"]), "neck": loc(m["N"]),
                                "handLeft": loc(m["handLeft"]), "handRight": loc(m["handRight"])})
        self.npz = None
        npz = REPO / f"assets/animations/npz/{cid}/motion.npz"
        if npz.exists():
            self.npz = np.load(npz)["posed_joints"]

    def frame_of(self, phase):
        return int(round((phase % 1.0) * self.count)) % len(self.mapped)

    def source(self, i):
        """77-joint source in figure frame (scaled like the mapping: horizontal about origin, vertical about ground)."""
        if self.npz is None or i >= len(self.npz):
            return None
        q = self.npz[i]
        r = self.r
        rel = np.stack([q[:, 0] - self.o[0], q[:, 1], q[:, 2] - self.o[2]], 1) * r
        return (self.turn @ (rel - self.prog[i] * 1.0).T).T

def load_dump(path):
    return json.load(open(path))

if __name__ == "__main__":
    dump = load_dump(SCR / "dump.json")
    # verify port: python accepted mapping == godot pre
    worst = 0
    for cid in list(dump)[:40]:
        rec = dump[cid]
        if "error" in rec: continue
        c = Clip(cid)
        for fr in rec["frames"][:6]:
            for p in fr["people"]:
                if p["clip"] != cid: continue
                x = (p["phase"] % 1.0) * c.count
                i = int(np.floor(x))
                if abs(x - i) > 1e-3: continue
                g = np.array(p["pre"]["segs"]); m = np.array(c.mapped[i]["segs"])
                worst = max(worst, np.abs(g - m).max())
    print("port max diff", worst)
