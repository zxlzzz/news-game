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

export function drawMailbox(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s           = p.scale ?? 1;
  const extraHeight = 20 * s;

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, 22 * s * 1.1, 22 * s * 0.33);
  g.endFill();

  // 1. Post (structural line, behind fills)
  lenv(g, y, 1.1);
  g.moveTo(x, y); g.lineTo(x, y - 29 * s - extraHeight);

  // Box body — 深色材质 (side FILL_SHADE, front FILL_MID, top FILL_LIGHT)
  const bw = 40 * s, bh = 35 * s;
  const bx = x - bw / 2, by = y - 64 * s - extraHeight;
  const Db = bw * 0.2, DbY = Db * 0.6;

  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(bx + bw,      by);
  g.lineTo(bx + bw + Db, by - DbY);
  g.lineTo(bx + bw + Db, by + bh - DbY);
  g.lineTo(bx + bw,      by + bh);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(bx, by, bw, bh);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(bx,           by);
  g.lineTo(bx + Db,      by - DbY);
  g.lineTo(bx + bw + Db, by - DbY);
  g.lineTo(bx + bw,      by);
  g.closePath();
  g.endFill();

  // Cap — 浅色材质 (side FILL_MID, front FILL_LIGHT, top FILL_PAPER)
  const cw = 46 * s, ch = 9 * s;
  const cx = x - cw / 2, cy = y - 72 * s - extraHeight;
  const Dc = cw * 0.2, DcY = Dc * 0.6;

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(cx + cw,      cy);
  g.lineTo(cx + cw + Dc, cy - DcY);
  g.lineTo(cx + cw + Dc, cy + ch - DcY);
  g.lineTo(cx + cw,      cy + ch);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(cx, cy, cw, ch);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(cx,           cy);
  g.lineTo(cx + Dc,      cy - DcY);
  g.lineTo(cx + cw + Dc, cy - DcY);
  g.lineTo(cx + cw,      cy);
  g.closePath();
  g.endFill();

  // 2. Mail slot detail
  g.lineStyle(0);
  g.beginFill(0x000000, 0.6);
  g.drawRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  g.endFill();

  // 3. Flag detail
  lenv(g, y, 0.6);
  g.moveTo(x - 9 * s, y - 40 * s - extraHeight);
  g.lineTo(x,         y - 37 * s - extraHeight);
  g.moveTo(x,         y - 37 * s - extraHeight);
  g.lineTo(x + 9 * s, y - 40 * s - extraHeight);

  // 4. Outlines (last)
  lenv(g, y, 0.85);
  g.drawRect(bx, by, bw, bh);
  lenv(g, cy, 0.85);
  g.drawRect(cx, cy, cw, ch);
}
