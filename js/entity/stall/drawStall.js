import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT, FILL_MID,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawStall(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s        = p.scale ?? 1;
  const w        = 290 * s;
  const roofH    = 200 * s;
  const ctrH     = 72  * s;
  const px       = x - w / 2;
  const counterY = y - ctrH;
  const aY       = y - roofH, aH = 17 * s;

  // 1. Support poles (structural lines, behind fills)
  lenv(g, y, 1.0);
  g.moveTo(px + 6 * s,     y); g.lineTo(px + 6 * s,     y - roofH);
  g.moveTo(px + w - 6 * s, y); g.lineTo(px + w - 6 * s, y - roofH);

  // 2. Awning front (trapezoid) — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(px,               aY + aH);
  g.lineTo(px + w,           aY + aH);
  g.lineTo(px + w + 9 * s,   aY);
  g.lineTo(px - 9 * s,       aY);
  g.closePath();
  g.endFill();

  // Awning stripes (detail)
  lenv(g, aY, 0.4);
  for (let i = 1; i < Math.floor(w / (17 * s)); i++) {
    const sx = px - 9 * s + i * 17 * s;
    g.moveTo(sx, aY); g.lineTo(sx + 4 * s, aY + aH);
  }

  // 3. Counter front — FILL_LIGHT
  const bpx = px + 3 * s, bpy = counterY, bw = w - 6 * s, bh = 11 * s;
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bpx, bpy, bw, bh);
  g.endFill();

  // 4. Items on counter — FILL_MID
  const itemW = 11 * s, itemH = 9 * s;
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, bpy - itemH, itemW, itemH);
  }
  g.endFill();

  // 5. Outlines (last)
  lenv(g, y, 0.85);
  g.moveTo(px,               aY + aH);
  g.lineTo(px + w,           aY + aH);
  g.lineTo(px + w + 9 * s,   aY);
  g.lineTo(px - 9 * s,       aY);
  g.closePath();
  lenv(g, y, 0.85);
  g.drawRect(bpx, bpy, bw, bh);
  lenv(g, y, 0.7);
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, bpy - itemH, itemW, itemH);
  }
}
