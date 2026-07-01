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

export function drawNewsRack(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 70 * s, h = 86 * s;
  const px = x - w / 2, py = y - h;

  // Body block (below header)
  const bpx = px, bpy = py + 17 * s, bw = w, bh = h - 17 * s;
  const Db  = bw * 0.2, DbY = Db * 0.6;

  // Header block
  const hpx = px - 3 * s, hpy = py + 6 * s, hw = w + 6 * s, hh = 11 * s;
  const Dh  = hw * 0.2, DhY = Dh * 0.6;

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, (w / 2 + 3 * s) * 1.1, (w / 2 + 3 * s) * 0.33);
  g.endFill();

  // 1. Body side — 浅色材质, FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(bpx + bw,      bpy);
  g.lineTo(bpx + bw + Db, bpy - DbY);
  g.lineTo(bpx + bw + Db, bpy + bh - DbY);
  g.lineTo(bpx + bw,      bpy + bh);
  g.closePath();
  g.endFill();

  // 2. Header side — 深色材质, FILL_SHADE
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(hpx + hw,      hpy);
  g.lineTo(hpx + hw + Dh, hpy - DhY);
  g.lineTo(hpx + hw + Dh, hpy + hh - DhY);
  g.lineTo(hpx + hw,      hpy + hh);
  g.closePath();
  g.endFill();

  // 3. Body front — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bpx, bpy, bw, bh);
  g.endFill();

  // Glass window — FILL_PAPER at low alpha
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.5);
  g.drawRect(bpx + 3 * s, bpy + 3 * s, bw - 6 * s, 26 * s);
  g.endFill();

  // 4. Header front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(hpx, hpy, hw, hh);
  g.endFill();

  // 5. Body top — FILL_PAPER
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(bpx,            bpy);
  g.lineTo(bpx + Db,       bpy - DbY);
  g.lineTo(bpx + bw + Db,  bpy - DbY);
  g.lineTo(bpx + bw,       bpy);
  g.closePath();
  g.endFill();

  // 6. Header top — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(hpx,            hpy);
  g.lineTo(hpx + Dh,       hpy - DhY);
  g.lineTo(hpx + hw + Dh,  hpy - DhY);
  g.lineTo(hpx + hw,       hpy);
  g.closePath();
  g.endFill();

  // 7. Text lines (detail)
  lenv(g, y, 0.6);
  g.moveTo(bpx + 6 * s,       bpy + 9 * s); g.lineTo(bpx + bw - 6 * s,  bpy + 9 * s);
  g.moveTo(bpx + 6 * s,       bpy + 15 * s); g.lineTo(bpx + bw - 6 * s, bpy + 15 * s);
  g.moveTo(bpx + 6 * s,       bpy + 21 * s); g.lineTo(bpx + bw - 11 * s, bpy + 21 * s);

  // 8. Coin slot
  g.lineStyle(0);
  g.beginFill(0x000000, 0.6);
  g.drawRect(bpx + bw / 2 - 6 * s, bpy + bh - 14 * s, 11 * s, 3 * s);
  g.endFill();

  // 9. Feet
  lenv(g, y, 0.9);
  g.moveTo(bpx + 6 * s,      y); g.lineTo(bpx + 6 * s,      y + 9 * s);
  g.moveTo(bpx + bw - 6 * s, y); g.lineTo(bpx + bw - 6 * s, y + 9 * s);

  // 10. Outlines (last)
  lenv(g, y, 0.85);
  g.drawRect(bpx, bpy, bw, bh);
  lenv(g, hpy, 0.85);
  g.drawRect(hpx, hpy, hw, hh);
}
