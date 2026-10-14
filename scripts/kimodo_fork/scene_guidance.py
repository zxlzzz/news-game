"""Scene guidance for news-game: keep the generated motion, drawn as the game's stick figure, out of object boxes.

At late denoising steps the clean-motion prediction is nudged (a few gradient steps on the features) so that the
stick figure's thick strokes and big head do not cut into the given boxes; the next steps make the rest of the body
agree. No retraining. The figure follows news-game docs/design-plans/npc-skeleton-mapping.md closely enough for
collision (game metres, adult scale 3); positions are in the stance frame (the post at the origin facing +Z).

scene = {
  "boxes": [{"centre": [x,y,z], "axes": [[ax],[ay],[az]], "half": [hx,hy,hz]}, ...],   # objects, game metres
  "item": {"boxes": [...], "hand": "both"},     # optional: a held thing around the hands' midpoint
  "rest": "<npz with a standing pose, frame 0>", "rest_names": [77 joint names],
  "start": 0.6,    # guide while t < start * steps (late steps only)
  "iters": 8, "lr": 0.05, "tolerance": 0.005, "regular": 1.0,
  "blur": 2.0      # the correction is smoothed along the frames (Gaussian, this many frames)
}
The correction is optimised as a free value per frame and feature but applied only after a Gaussian blur along the
frames, so it is a smooth curve over time. Applied raw (until 2026-10-14), the per-frame optimiser steps went straight
into the output as a fine tremor: seated and standing clips made with guidance shook 3-10 times more than the same
clips made without it.
"""
import math

import numpy as np
import torch
import torch.nn.functional as F

# news-game skeleton-params.json, figure units; game = figure * SCALE
P = dict(headR=0.06, neck=0.015, torso=0.18, clavSplit=0.8, upperArm=0.096, foreArm=0.124, thigh=0.12, shin=0.13,
         foot=0.05, line=0.035, torsoLine=1.15)
SCALE = 3.0
LEG_RATIO = (P['thigh'] + P['shin']) / (0.528 + 0.423) * SCALE  # source metres -> game metres for hips/feet


def _unit(v):
    return v / (v.norm(dim=-1, keepdim=True) + 1e-9)


def _frame(hips, neck, larm, rarm):
    up = _unit(neck - hips)
    side = larm - rarm
    side = _unit(side - up * (side * up).sum(-1, keepdim=True))
    fwd = torch.cross(side, up, dim=-1)
    return side, up, fwd


class SceneGuidance:
    def __init__(self, scene, model):
        dev = model.device
        self.start = scene.get('start', 0.6)
        self.iters = scene.get('iters', 8)
        self.lr = scene.get('lr', 0.05)
        self.tol = scene.get('tolerance', 0.005)
        self.regular = scene.get('regular', 1.0)
        self.smooth = scene.get('smooth', 0.05)
        sigma = scene.get('blur', 2.0)
        radius = max(1, int(math.ceil(3 * sigma)))
        k = torch.exp(-0.5 * (torch.arange(-radius, radius + 1, dtype=torch.float32) / sigma) ** 2)
        self.kernel = (k / k.sum()).to(dev)
        names = list(model.motion_rep.skeleton.bone_order_names)
        self.j = {n: names.index(n) for n in names}
        def pack(boxes):
            if not boxes:
                return None
            return (torch.tensor([b['centre'] for b in boxes], device=dev, dtype=torch.float32),
                    torch.tensor([b['axes'] for b in boxes], device=dev, dtype=torch.float32),
                    torch.tensor([b['half'] for b in boxes], device=dev, dtype=torch.float32))
        self.boxes = pack(scene.get('boxes', []))
        item = scene.get('item')
        self.item = pack(item['boxes']) if item else None
        self.item_hand = item.get('hand', 'both') if item else None
        # Rest head direction in the torso frame (the mapping takes the standing forward lean off).
        rest = np.load(scene['rest'])['posed_joints'][0]
        rn = scene['rest_names']
        g = lambda n: torch.tensor(rest[rn.index(n)], dtype=torch.float32)
        side, up, fwd = _frame(g('Hips'), g('Neck1'), g('LeftArm'), g('RightArm'))
        v = g('Head') - g('Neck1')
        local = _unit(torch.stack([(v * side).sum(), (v * up).sum(), (v * fwd).sum()]))
        a, b = local, torch.tensor([0.0, 1.0, 0.0])
        k = torch.cross(a, b, dim=0)
        s, c = k.norm(), (a * b).sum()
        K = torch.tensor([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]]) if s > 1e-9 else torch.zeros(3, 3)
        R = torch.eye(3) + K + K @ K * ((1 - c) / (s * s + 1e-12)) if s > 1e-9 else torch.eye(3)
        self.rest_turn = R.to(dev)
        self.log = []

    def figure(self, J):
        """Stick figure strokes from source joints J [..., joints, 3] -> points [..., P, 3], radii [P]."""
        j = self.j
        g = lambda n: J[..., j[n], :]
        H = g('Hips') * LEG_RATIO
        side, up, fwd = _frame(g('Hips'), g('Neck1'), g('LeftArm'), g('RightArm'))
        N = H + up * (P['torso'] * SCALE)
        v = g('Head') - g('Neck1')
        local = _unit(torch.stack([(v * side).sum(-1), (v * up).sum(-1), (v * fwd).sum(-1)], -1))
        local = local @ self.rest_turn.T
        hd = side * local[..., :1] + up * local[..., 1:2] + fwd * local[..., 2:3]
        head = N + hd * ((P['neck'] + P['headR']) * SCALE)
        segs, radii = [], []
        r_line = P['line'] * SCALE / 2
        segs.append((H, N)); radii.append(r_line * P['torsoLine'])
        hands = {}
        for s in ('Left', 'Right'):
            c = g(s + 'Arm') - g('Neck1')
            el = N + _unit(g(s + 'ForeArm') - g(s + 'Arm') + c * P['clavSplit']) * (P['upperArm'] * SCALE)
            hand = el + _unit(g(s + 'Hand') - g(s + 'ForeArm') + c * (1 - P['clavSplit'])) * (P['foreArm'] * SCALE)
            hands[s] = hand
            segs += [(N, el), (el, hand)]; radii += [r_line, r_line]
            ankle = g(s + 'Foot') * LEG_RATIO
            l1, l2 = P['thigh'] * SCALE, P['shin'] * SCALE
            dv = ankle - H
            d = dv.norm(dim=-1, keepdim=True).clamp(abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
            axis = _unit(dv)
            pole = g(s + 'Shin') - g('Hips')
            pole = _unit(pole - axis * (pole * axis).sum(-1, keepdim=True))
            x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
            knee = H + axis * x + pole * torch.sqrt((l1 * l1 - x * x).clamp(min=0))
            end = H + axis * d
            toe = end + _unit(g(s + 'ToeBase') - g(s + 'Foot')) * (P['foot'] * SCALE)
            segs += [(H, knee), (knee, end), (end, toe)]; radii += [r_line] * 3
        w = torch.linspace(0, 1, 6, device=J.device)
        pts = [a[..., None, :] * (1 - w[:, None]) + b[..., None, :] * w[:, None] for a, b in segs]
        rad = [torch.full((6,), r, device=J.device) for r in radii]
        pts.append(head[..., None, :]); rad.append(torch.tensor([P['headR'] * SCALE], device=J.device))
        return torch.cat(pts, -2), torch.cat(rad), hands

    @staticmethod
    def sdf(points, boxes):
        """Signed distance of points [..., P, 3] to boxes -> [..., P, Nboxes]."""
        centre, axes, half = boxes
        rel = points[..., :, None, :] - centre
        q = (rel[..., None, :] * axes).sum(-1)  # coordinates along each box axis
        d = q.abs() - half
        outside = d.clamp(min=0).norm(dim=-1)
        inside = d.max(dim=-1).values.clamp(max=0)
        return outside + inside

    def penetration(self, J):
        pts, rad, hands = self.figure(J)
        loss = 0.0
        if self.boxes is not None:
            sd = self.sdf(pts, self.boxes)
            loss = loss + ((rad[:, None] - sd - self.tol).clamp(min=0) ** 2).sum(-1).sum(-1)
        if self.item is not None:
            mid = (hands['Left'] + hands['Right']) / 2 if self.item_hand == 'both' else hands['Left' if self.item_hand == 'left' else 'Right']
            centre, axes, half = self.item
            moved = (centre + mid[..., None, :], axes, half)
            # point layout: torso 0-5; left upper arm, forearm, thigh, shin, foot 6-35; right the same 36-65; head
            # + head + thighs + the arms up to just before the hands (the hands hold it; the forearms must not pass
            # through it on the way)
            keep = [slice(None, 6), slice(-1, None), slice(18, 24), slice(48, 54), slice(6, 16), slice(36, 46)]
            body = torch.cat([pts[..., k, :] for k in keep], -2)
            brad = torch.cat([rad[k] for k in keep])
            c, ax, h = moved
            relp = body[..., :, None, :] - c[..., None, :, :]
            q = (relp[..., None, :] * ax).sum(-1)
            d = q.abs() - h
            sd = d.clamp(min=0).norm(dim=-1) + d.max(dim=-1).values.clamp(max=0)
            loss = loss + ((brad[:, None] - sd - self.tol).clamp(min=0) ** 2).sum(-1).sum(-1)
        return loss  # [B, T]

    def blurred(self, d):
        """d [B, T, F] smoothed along T (edges held)."""
        r = (self.kernel.numel() - 1) // 2
        x = F.pad(d.transpose(1, 2), (r, r), mode='replicate')
        w = self.kernel.view(1, 1, -1).expand(x.shape[1], 1, -1)
        return F.conv1d(x, w, groups=x.shape[1]).transpose(1, 2)

    def __call__(self, model, pred_clean, t_index, num_steps):
        if t_index >= self.start * num_steps:
            return pred_clean
        with torch.inference_mode(False), torch.enable_grad():
            x0 = pred_clean.clone().detach()
            # Only the body pose moves (joint positions and rotations), never where the person stands.
            mask = torch.zeros(x0.shape[-1], device=x0.device)
            for key in ('local_joints_positions', 'global_rot_data'):
                mask[model.motion_rep.slice_dict[key]] = 1.0
            delta = torch.zeros_like(x0, requires_grad=True)
            opt = torch.optim.Adam([delta], lr=self.lr)
            first = None
            for _ in range(self.iters):
                x = x0 + self.blurred(delta) * mask
                Jr = model.motion_rep.inverse(x, is_normalized=True, posed_joints_from='rotations')['posed_joints']
                Jp = model.motion_rep.inverse(x, is_normalized=True, posed_joints_from='positions')['posed_joints']
                pen = self.penetration(Jr).sum() + self.penetration(Jp).sum()
                if first is None:
                    first = float(pen)
                if float(pen) <= 1e-10:
                    break
                d = self.blurred(delta) * mask
                # stay close, and change smoothly from frame to frame (no single-frame pops)
                loss = pen + self.regular * 1e-3 * (d ** 2).sum() + self.smooth * ((d[:, 1:] - d[:, :-1]) ** 2).sum()
                opt.zero_grad()
                loss.backward()
                opt.step()
            self.log.append((t_index, first, float(pen)))
            return (x0 + self.blurred(delta) * mask).detach()
