export function drawMiniPark(g, config) {
  const { cx, cy, rx, ry } = config;
  const seed = (i) => { const s = Math.sin(i * 57.3) * 43758.5; return s - Math.floor(s); };
  g.beginFill(0xe8e8e8, 1);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  g.lineStyle(0.6, 0x8a8a8a, 0.28);
  for (let i = 0; i < 28; i++) {
    const a = seed(i * 2) * Math.PI * 2, rr = Math.sqrt(seed(i * 2 + 1));
    const gx = cx + Math.cos(a) * rx * 0.82 * rr;
    const gy = cy + Math.sin(a) * ry * 0.82 * rr;
    g.moveTo(gx, gy);       g.lineTo(gx, gy - 3);
    g.moveTo(gx, gy - 1.5); g.lineTo(gx - 1.5, gy - 3.5);
    g.moveTo(gx, gy - 1.5); g.lineTo(gx + 1.5, gy - 3.5);
  }
}
