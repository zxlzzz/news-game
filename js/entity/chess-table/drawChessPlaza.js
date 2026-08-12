import { FILL_PAPER, lenv } from '../../core/Layout.js';
import { groundFaceGraphics } from '../../core/Projection.js';

// O-4 第三批：贴地广场，走地面代理。原函数体一行未改——地面上的圆/椭圆由代理
// 自动压成屏幕椭圆（竖半轴乘 SIN_TILT），不再依赖 scene.json 里那个 O-1 时代
// 手算的扁平近似 ry：ry 现在是**世界**竖向半轴（广场的进深方向尺寸），压扁交给
// 投影做。见 tasks.md O-1「预期副作用」第 3 条说的"O-2 看到真几何之后再手调"。
export function drawChessPlaza(g, config) {
  g.lineStyle(0);
  _ground(groundFaceGraphics(g), config);
}

function _ground(g, config) {
  const { cx, cy, rx, ry } = config;
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.45);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  lenv(g, cy, 1.0);
  g.drawEllipse(cx, cy, rx, ry);
  lenv(g, cy, 0.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
}
