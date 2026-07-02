import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT, FILL_MID,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawNewsRack(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 70 * s, h = 86 * s;
  const px = x - w / 2, py = y - h;

  // Body block
  const bpx = px, bpy = py + 17 * s, bw = w, bh = h - 17 * s;

  // Header block
  const hpx = px - 3 * s, hpy = py + 6 * s, hw = w + 6 * s, hh = 11 * s;

  // === Body block ===
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bpx, bpy, bw, bh);
  g.endFill();

  // Glass window
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.5);
  g.drawRect(bpx + 3 * s, bpy + 3 * s, bw - 6 * s, 26 * s);
  g.endFill();

  // Body details
  lenv(g, y, 0.6);
  g.moveTo(bpx + 6 * s,       bpy + 9 * s);  g.lineTo(bpx + bw - 6 * s,  bpy + 9 * s);
  g.moveTo(bpx + 6 * s,       bpy + 15 * s); g.lineTo(bpx + bw - 6 * s,  bpy + 15 * s);
  g.moveTo(bpx + 6 * s,       bpy + 21 * s); g.lineTo(bpx + bw - 11 * s, bpy + 21 * s);

  g.lineStyle(0);
  g.beginFill(0x000000, 0.6);
  g.drawRect(bpx + bw / 2 - 6 * s, bpy + bh - 14 * s, 11 * s, 3 * s);
  g.endFill();

  lenv(g, y, 0.9);
  g.moveTo(bpx + 6 * s,      y); g.lineTo(bpx + 6 * s,      y + 9 * s);
  g.moveTo(bpx + bw - 6 * s, y); g.lineTo(bpx + bw - 6 * s, y + 9 * s);

  // Body outline
  lenv(g, y, 0.85);
  g.drawRect(bpx, bpy, bw, bh);

  // === Header block ===
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(hpx, hpy, hw, hh);
  g.endFill();

  // Header outline
  lenv(g, hpy, 0.85);
  g.drawRect(hpx, hpy, hw, hh);
}
