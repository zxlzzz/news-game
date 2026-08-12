import { FILL_LIGHT, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第一批：立着的东西 → drawObliqueBox 报 (w, depth, h)，正面细节原样贴回。
// _frontDetail 是老函数体，一行绘制逻辑没改，只是 g 换成 frontFaceGraphics 代理、
// (x,y,s) 从 p 上的隐式读取改成显式参数（同 O-3 的 drawBench 样板）。
export function drawVending(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;
  const w = 80 * s, h = 158 * s;
  const depth = PROP_DEPTH.vending * s;

  drawObliqueBox(g, x, y, w, depth, h, FILL_LIGHT);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  g.lineStyle(0);

  const w  = 80 * s, h = 158 * s;
  const px = x - w / 2, py = y - h;

  // 2. Glass front — FILL_SHADE at low alpha
  const gx = px + 6 * s, gy = py + 6 * s;
  const gw  = w * 0.6, gh = h - 29 * s;
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 0.6);
  g.drawRect(gx, gy, gw, gh);
  g.endFill();

  // 3. Side control panel (right of glass)
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(gx + gw + 3 * s, gy, w - gw - 14 * s, gh * 0.5);
  g.endFill();

  // 4. Shelf lines (detail)
  lenv(g, y, 0.55);
  for (let i = 1; i < 5; i++) {
    g.moveTo(gx, gy + gh * i / 5); g.lineTo(gx + gw, gy + gh * i / 5);
  }

  // 5. Dispenser slot
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(px + 6 * s, py + h - 17 * s, w - 11 * s, 9 * s);
  g.endFill();

  // 6. Glass outline（机身外框已由 drawObliqueBox 的正面描边负责，这里不重复画）
  lenv(g, gy, 0.7);
  g.drawRect(gx, gy, gw, gh);
}
