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

function drawGroundShadow(g, cx, cy, rx, ry) {
  const ox = rx * 0.15, oy = ry * 0.25;
  const sx = cx + ox,   sy = cy + oy;
  g.lineStyle(0);
  g.beginFill(0x000000, 0.03); g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6); g.endFill();
  g.beginFill(0x000000, 0.05); g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3); g.endFill();
  g.beginFill(0x000000, 0.08); g.drawEllipse(sx, sy, rx,       ry);       g.endFill();
}

export function drawPlanter(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s   = p.scale ?? 1;
  const w   = 80 * s, h = 20 * s;
  const px  = x - w / 2;
  const py  = y - h;
  const bpy = py + 9 * s;   // box top
  const bh  = h - 9 * s;    // box height = 11*s

  const D  = w * 0.2, DY = D * 0.6;

  // 0. Ground shadow — 長條形
  drawGroundShadow(g, x, y, w / 2, w / 2 * 0.15);

  // 1. Box side — 浅色材质, FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(px + w,     bpy);
  g.lineTo(px + w + D, bpy - DY);
  g.lineTo(px + w + D, bpy + bh - DY);
  g.lineTo(px + w,     bpy + bh);
  g.closePath();
  g.endFill();

  // 2. Box front — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(px, bpy, w, bh);
  g.endFill();

  // 3. Box top — FILL_PAPER
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(px,          bpy);
  g.lineTo(px + D,      bpy - DY);
  g.lineTo(px + w + D,  bpy - DY);
  g.lineTo(px + w,      bpy);
  g.closePath();
  g.endFill();

  // 4. Seam lines (detail)
  lenv(g, y, 0.6);
  const segs = Math.max(2, Math.floor(w / (23 * s)));
  for (let i = 1; i < segs; i++) {
    const lx = px + w * i / segs;
    g.moveTo(lx, bpy); g.lineTo(lx, bpy + bh);
  }

  // 5. Plant foliage — FILL_MID + FILL_LIGHT circles over stem lines
  const clumps = Math.max(2, Math.floor(w / (26 * s)));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 11 * s + i * (w - 23 * s) / Math.max(1, clumps - 1);
    const cy = py + 6 * s;

    lenv(g, y, 0.9);
    g.moveTo(cx, cy + 6 * s); g.lineTo(cx, cy - 11 * s);
    g.moveTo(cx, cy - 6 * s); g.lineTo(cx - 9 * s, cy - 14 * s);
    g.moveTo(cx, cy - 6 * s); g.lineTo(cx + 9 * s, cy - 14 * s);

    g.lineStyle(0);
    g.beginFill(FILL_MID, 0.85);
    g.drawCircle(cx,          cy - 11 * s, 7 * s);
    g.drawCircle(cx - 9 * s,  cy - 14 * s, 5 * s);
    g.drawCircle(cx + 9 * s,  cy - 14 * s, 5 * s);
    g.endFill();

    g.beginFill(FILL_LIGHT, 0.75);
    g.drawCircle(cx,          cy - 14 * s, 5 * s);
    g.drawCircle(cx - 9 * s,  cy - 17 * s, 3 * s);
    g.drawCircle(cx + 9 * s,  cy - 17 * s, 3 * s);
    g.endFill();
  }

  // 6. Outline (last)
  lenv(g, y, 0.85);
  g.drawRect(px, bpy, w, bh);
}
