import { FILL_PAPER, lenv } from '../../core/Layout.js';
import { groundFaceGraphics } from '../../core/Projection.js';

// O-4 第三批：贴地绿地，走地面代理。函数体一行未改（同 drawChessPlaza 的
// ry 语义说明——ry 是世界竖向半轴，压扁交给投影）。
export function drawMiniPark(g, config) {
  g.lineStyle(0);
  _ground(groundFaceGraphics(g), config);
}

function _ground(g, config) {
  const { cx, cy, rx, ry } = config;
  const seed = (i) => { const s = Math.sin(i * 57.3) * 43758.5; return s - Math.floor(s); };
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  lenv(g, cy, 0.3);
  for (let i = 0; i < 28; i++) {
    const a = seed(i * 2) * Math.PI * 2, rr = Math.sqrt(seed(i * 2 + 1));
    const gx = cx + Math.cos(a) * rx * 0.82 * rr;
    const gy = cy + Math.sin(a) * ry * 0.82 * rr;
    g.moveTo(gx, gy);       g.lineTo(gx, gy - 3);
    g.moveTo(gx, gy - 1.5); g.lineTo(gx - 1.5, gy - 3.5);
    g.moveTo(gx, gy - 1.5); g.lineTo(gx + 1.5, gy - 3.5);
  }
}
