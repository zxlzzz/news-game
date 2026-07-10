import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawMailbox(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s           = p.scale ?? 1;
  const extraHeight = 20 * s;

  // Post (structural line)
  lenv(g, y, 1.1);
  g.moveTo(x, y); g.lineTo(x, y - 29 * s - extraHeight);

  // === Box body block ===
  const bw = 40 * s, bh = 35 * s;
  const bx = x - bw / 2, by = y - 64 * s - extraHeight;

  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(bx, by, bw, bh);
  g.endFill();
  // Mail slot
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  g.endFill();
  // Outline
  lenv(g, y, 0.85);
  g.drawRect(bx, by, bw, bh);

  // === Cap block ===
  const cw = 46 * s, ch = 9 * s;
  const cx = x - cw / 2, cy = y - 72 * s - extraHeight;

  // Front
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(cx, cy, cw, ch);
  g.endFill();
  // Outline
  lenv(g, cy, 0.85);
  g.drawRect(cx, cy, cw, ch);

  // Flag detail
  lenv(g, y, 0.6);
  g.moveTo(x - 9 * s, y - 40 * s - extraHeight);
  g.lineTo(x,         y - 37 * s - extraHeight);
  g.moveTo(x,         y - 37 * s - extraHeight);
  g.lineTo(x + 9 * s, y - 40 * s - extraHeight);
}
