import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawVending(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 80 * s, h = 158 * s;
  const px = x - w / 2, py = y - h;

  const D  = w * 0.2, DY = D * 0.6;

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, (w / 2) * 1.1, (w / 2) * 0.33);
  g.endFill();

  // 1. Side — 浅色材质, FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(px + w,     py);
  g.lineTo(px + w + D, py - DY);
  g.lineTo(px + w + D, py + h - DY);
  g.lineTo(px + w,     py + h);
  g.closePath();
  g.endFill();

  // 2. Front body — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(px, py, w, h);
  g.endFill();

  // 3. Top — FILL_PAPER
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(px,         py);
  g.lineTo(px + D,     py - DY);
  g.lineTo(px + w + D, py - DY);
  g.lineTo(px + w,     py);
  g.closePath();
  g.endFill();

  // 4. Glass front — FILL_SHADE at low alpha
  const gx = px + 6 * s, gy = py + 6 * s;
  const gw  = w * 0.6, gh = h - 29 * s;
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 0.6);
  g.drawRect(gx, gy, gw, gh);
  g.endFill();

  // Glass reflection
  g.beginFill(0xffffff, 0.18);
  g.drawRect(gx + 3 * s, gy + 3 * s, gw - 6 * s, gh * 0.4);
  g.endFill();

  // 5. Side control panel (right of glass)
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(gx + gw + 3 * s, gy, w - gw - 14 * s, gh * 0.5);
  g.endFill();

  // 6. Shelf lines (detail)
  lenv(g, y, 0.55);
  for (let i = 1; i < 5; i++) {
    g.moveTo(gx, gy + gh * i / 5); g.lineTo(gx + gw, gy + gh * i / 5);
  }

  // 7. Dispenser slot
  g.lineStyle(0);
  g.beginFill(0x000000, 0.9);
  g.drawRect(px + 6 * s, py + h - 17 * s, w - 11 * s, 9 * s);
  g.endFill();

  // 8. Outlines (last)
  lenv(g, y, 0.85);
  g.drawRect(px, py, w, h);
  lenv(g, gy, 0.7);
  g.drawRect(gx, gy, gw, gh);
}
