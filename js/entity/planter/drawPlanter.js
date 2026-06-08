import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawPlanter(g, p) {
  const s     = p.scale ?? 1;
  const w     = 80 * s;
  const h     = 20 * s;
  const px    = p.x - w / 2;
  const py    = p.y - h;
  const lineW = depthLineWidth(p.y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(p.y, { light: 0x40, dark: 0x10 });

  g.fillStyle(0xb4b4b4, 1);
  g.fillRect(px, py + 9 * s, w, h - 9 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 9 * s, w, h - 9 * s);

  // seams
  g.lineStyle(1.2 * s, lineC, 0.6);
  const segs = Math.max(2, Math.floor(w / (23 * s)));
  for (let i = 1; i < segs; i++) {
    const lx = px + (w * i / segs);
    g.lineBetween(lx, py + 9 * s, lx, py + h);
  }

  // plant clumps
  const clumps = Math.max(2, Math.floor(w / (26 * s)));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 11 * s + i * (w - 23 * s) / Math.max(1, clumps - 1);
    const cy = py + 6 * s;
    g.lineStyle(lineW * 0.9, lineC, 0.85);
    g.lineBetween(cx, cy + 6 * s, cx, cy - 11 * s);
    g.lineBetween(cx, cy - 6 * s, cx - 9 * s, cy - 14 * s);
    g.lineBetween(cx, cy - 6 * s, cx + 9 * s, cy - 14 * s);
    g.lineBetween(cx, cy - 11 * s, cx - 6 * s, cy - 17 * s);
    g.lineBetween(cx, cy - 11 * s, cx + 6 * s, cy - 17 * s);
  }
}
