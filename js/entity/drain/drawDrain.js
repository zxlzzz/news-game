import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawDrain(g, p) {
  const s     = p.scale ?? 1;
  const w     = 58 * s;
  const h     = 27 * s;
  const px    = p.x - w / 2;
  const py    = p.y - h / 2;
  const lineW = depthLineWidth(p.y, { wMin: 0.7, wMax: 1.4 });
  const lineC = depthLineColor(p.y, { light: 0x10, dark: 0x08 });

  g.beginFill(0x707070, 1);
  g.drawRect(px, py, w, h);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.9);
  g.drawRect(px, py, w, h);

  // grate slots
  g.lineStyle(lineW * 0.65, lineC, 0.85);
  const slots = Math.max(3, Math.floor(w / (9 * s)));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.moveTo(lx, py + 3 * s); g.lineTo(lx, py + h - 3 * s);
  }
}
