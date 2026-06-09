import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawBench(g, p) {
  const { x, y } = p;
  const f = p.facing || 'down';
  const s = p.scale ?? 1;
  const L     = 300 * s;
  const half  = L / 2;
  const legH  = 23 * s;
  const seatT = 17 * s;
  const backH = 40 * s;
  const lineW = depthLineWidth(y, { wMin: 1, wMax: 2 });
  const lineC = depthLineColor(y, { light: 0x38, dark: 0x08 });

  const P = (u, w) => {
    switch (f) {
      case 'up':    return [x + u, y - w];
      case 'left':  return [x - w, y + u];
      case 'right': return [x + w, y + u];
      default:      return [x + u, y + w];
    }
  };
  const rect = (u0, w0, u1, w1, fill, fa, sw) => {
    const a = P(u0, w0), b = P(u1, w1);
    const rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]);
    const rw = Math.abs(a[0] - b[0]), rh = Math.abs(a[1] - b[1]);
    if (fill != null) { g.beginFill(fill, fa ?? 1); g.drawRect(rx, ry, rw, rh); g.endFill(); }
    if (sw)           { g.lineStyle(sw, lineC, 0.9); g.drawRect(rx, ry, rw, rh); }
  };
  const line = (u0, w0, u1, w1, lwd, al) => {
    const a = P(u0, w0), b = P(u1, w1);
    g.lineStyle(lwd, lineC, al ?? 0.9);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  };

  // ground shadow
  g.beginFill(0x000000, 0.10);
  if (f === 'left' || f === 'right') g.drawEllipse(x, y, 6 * s, L * 1.05 / 2);
  else                               g.drawEllipse(x, y, L * 1.05 / 2, 4 * s);
  g.endFill();

  // outer + inner legs
  const li = 14 * s;
  line(-(half - li), -legH, -(half - li), 0, lineW, 0.95);
  line( (half - li), -legH,  (half - li), 0, lineW, 0.95);
  line(-(half - 32 * s), -legH, -(half - 32 * s), 0, lineW * 0.85, 0.85);
  line( (half - 32 * s), -legH,  (half - 32 * s), 0, lineW * 0.85, 0.85);
  // horizontal mid-brace
  line(-(half - li), -legH * 0.5, (half - li), -legH * 0.5, lineW * 0.7, 0.8);

  // seat slats
  const n = 4, sw_u = (L - 17 * s) / n;
  for (let i = 0; i < n; i++) {
    const u0 = -half + 9 * s + i * sw_u;
    const shade = 0xe0e0e0 - i * 0x0a0a0a;
    rect(u0, -(legH + seatT), u0 + sw_u - 4 * s, -legH, shade, 0.95, lineW * 0.8);
  }

  // back plank + connecting posts
  const by2  = -(legH + seatT);
  const by3  = -(legH + seatT + backH);
  const plkT = 11 * s;
  rect(-half + 11 * s, by3 + plkT, half - 11 * s, by3, 0xd2d2d2, 0.92, lineW * 0.85);
  for (let i = 0; i <= 4; i++) {
    const u = -half + 11 * s + (L - 22 * s) * i / 4;
    line(u, by2, u + s, by3 + plkT, lineW * 0.7, 0.85);
  }

  // armrest stubs
  for (const dir of [-1, 1]) {
    const u = dir * (half - 9 * s);
    line(u, by2 - 3 * s, u, -(legH + 9 * s), lineW * 0.85, 0.9);
    line(u, -(legH + 9 * s), u - dir * 9 * s, -(legH + 3 * s), lineW * 0.85, 0.9);
  }
}
