import {
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

export function drawChairL(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s      = p.scale ?? 1;
  const d      = -1;
  const seatH  = (p.seatH ?? 10) * s;
  const seatW  = 25 * s;
  const backH  = 20 * s;
  const seatY  = y - seatH;
  const seatX1 = x - seatW / 2;
  const seatX2 = x + seatW / 2;

  lenv(g, y);
  g.moveTo(seatX1, seatY); g.lineTo(seatX2, seatY);
  const backX   = seatX2;
  const backTop = seatY - backH;
  g.moveTo(backX, seatY); g.lineTo(backX, backTop);
  g.moveTo(backX - 6 * s * d, backTop); g.lineTo(backX + 3 * s * d, backTop);

  lenv(g, y, 0.85);
  g.moveTo(seatX1 + 3 * s, seatY); g.lineTo(seatX1 + 3 * s, y);
  g.moveTo(seatX2 - 3 * s, seatY); g.lineTo(seatX2 - 3 * s, y);

  lenv(g, y, 0.4);
  g.moveTo(seatX1 + 3 * s, seatY + 3 * s); g.lineTo(seatX2 - 3 * s, seatY + 3 * s);
}
