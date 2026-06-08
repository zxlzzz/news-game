import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawChair(g, p) {
  const { x, y } = p;
  const s      = p.scale ?? 1;
  const d      = p.dir ?? 1;
  const seatH  = 10 * s;
  const seatW  = 25 * s;
  const backH  = 20 * s;
  const seatY  = y - seatH;
  const seatX1 = x - seatW / 2;
  const seatX2 = x + seatW / 2;
  const lw     = depthLineWidth(y);
  const lc     = depthLineColor(y, { light: 0x20, dark: 0x0a });

  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(seatX1, seatY, seatX2, seatY);
  // back rest
  const backX   = (d > 0) ? seatX1 : seatX2;
  const backTop = seatY - backH;
  g.lineBetween(backX, seatY, backX, backTop);
  g.lineBetween(backX - 6 * s * d, backTop, backX + 3 * s * d, backTop);
  // legs
  g.lineStyle(lw * 0.85, lc, 0.9);
  g.lineBetween(seatX1 + 3 * s, seatY, seatX1 + 3 * s, y);
  g.lineBetween(seatX2 - 3 * s, seatY, seatX2 - 3 * s, y);
  // seat highlight
  g.lineStyle(lw * 0.4, 0x303030, 0.6);
  g.lineBetween(seatX1 + 3 * s, seatY + 3 * s, seatX2 - 3 * s, seatY + 3 * s);
}
