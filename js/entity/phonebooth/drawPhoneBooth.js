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

export function drawPhoneBooth(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 80 * s, h = 173 * s;
  const px = x - w / 2, py = y - h;

  // Body block dimensions
  const bpx = px, bpy = py + 11 * s, bw = w, bh = h - 11 * s;

  // Header block dimensions
  const hpx = px - 3 * s, hpy = py, hw = w + 6 * s, hh = 14 * s;

  // === Body block ===
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(bpx, bpy, bw, bh);
  g.endFill();
  // Glass reflection overlay
  g.beginFill(0xffffff, 0.16);
  g.drawRect(bpx + 3 * s, bpy + 3 * s, bw - 6 * s, bh * 0.45);
  g.endFill();
  // Body details
  lenv(g, y, 0.6);
  g.moveTo(bpx + bw / 2, bpy + 3 * s); g.lineTo(bpx + bw / 2, y - 3 * s);
  g.moveTo(bpx + 6 * s,  bpy + bh * 0.5); g.lineTo(bpx + bw - 6 * s, bpy + bh * 0.5);
  g.lineStyle(0);
  g.beginFill(0x000000, 0.7);
  g.drawRect(bpx + bw - 14 * s, bpy + 18 * s, 6 * s, 17 * s);
  g.endFill();
  // Body outline
  lenv(g, y, 0.85);
  g.drawRect(bpx, bpy, bw, bh);

  // === Header block ===
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(hpx, hpy, hw, hh);
  g.endFill();
  // Sign strip
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawRect(hpx + 3 * s, hpy + 3 * s, hw - 6 * s, 6 * s);
  g.endFill();
  // Header outline
  lenv(g, hpy, 0.85);
  g.drawRect(hpx, hpy, hw, hh);
}
