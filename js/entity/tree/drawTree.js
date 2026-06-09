import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawTree(g, p) {
  const { x, y } = p;
  const s = p.scale ?? 1;
  const r = (p.crownR != null ? p.crownR * 2.88 : 150) * s;

  const lw = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineColor = depthLineColor(y, { light: 0x40, dark: 0x18 });

  const trunkW = r * 0.14;
  const trunkH = r * 0.7;
  const crownBottom = y - trunkH;
  const crownCY = crownBottom - r * 0.38;

  g.lineStyle(0);
  g.beginFill(0xE0E0E0, 1);
  g.drawRect(x - trunkW / 2, crownBottom, trunkW, trunkH);
  g.endFill();
  g.lineStyle(lw, lineColor, 0.9);
  g.drawRect(x - trunkW / 2, crownBottom, trunkW, trunkH);

  g.lineStyle(lw * 1.2, lineColor, 0.85);
  const forkY = crownBottom + r * 0.18;
  g.moveTo(x - trunkW * 0.3, forkY).lineTo(x - r * 0.28, crownBottom + r * 0.05);
  g.moveTo(x + trunkW * 0.3, forkY).lineTo(x + r * 0.22, crownBottom + r * 0.02);

  const blobs = [
    [  0,       -r*0.30,  r*0.52 ],
    [ -r*0.38,  -r*0.14,  r*0.42 ],
    [  r*0.38,  -r*0.10,  r*0.40 ],
    [ -r*0.56,   r*0.14,  r*0.34 ],
    [  r*0.54,   r*0.16,  r*0.34 ],
    [ -r*0.24,   r*0.26,  r*0.36 ],
    [  r*0.26,   r*0.28,  r*0.36 ],
  ];

  g.lineStyle(0);
  g.beginFill(0xe8e8e8, 1);
  for (const [dx, dy, br] of blobs) {
    g.drawCircle(x + dx, crownCY + dy, br);
  }
  g.endFill();

  function isOuter(px, py, skipIdx) {
    for (let i = 0; i < blobs.length; i++) {
      if (i === skipIdx) continue;
      const [dx, dy, br] = blobs[i];
      if ((px - (x + dx)) ** 2 + (py - (crownCY + dy)) ** 2 < (br - lw) ** 2) return false;
    }
    return true;
  }

  const STEPS = 64;
  const pts = [];
  for (let bi = 0; bi < blobs.length; bi++) {
    const [dx, dy, br] = blobs[bi];
    const cx = x + dx, cy = crownCY + dy;
    for (let i = 0; i < STEPS; i++) {
      const a = (2 * Math.PI * i) / STEPS;
      const px = cx + Math.cos(a) * br;
      const py = cy + Math.sin(a) * br;
      if (isOuter(px, py, bi)) pts.push({ x: px, y: py });
    }
  }

  if (pts.length < 3) return;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  pts.sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));

  g.lineStyle(lw, lineColor, 0.88);
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}