export function drawChessPlaza(g, config) {
  const { cx, cy, rx, ry } = config;
  g.beginFill(0xebebeb, 0.4);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  g.lineStyle(1, 0xcccccc, 0.9);
  g.drawEllipse(cx, cy, rx, ry);
  g.lineStyle(0.5, 0xd4d4d4, 0.35);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
}
