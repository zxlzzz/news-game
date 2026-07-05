export function drawSign(g, p) {
  const s  = p.scale ?? 1;
  const sw = 43 * s;
  const sh = 35 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;

  g.beginFill(0x888888, 0.95);
  g.drawRect(sx, sy, sw, sh);
  g.endFill();
  // inner text lines
  g.lineStyle(1.7 * s, 0xfafafa, 0.8);
  g.moveTo(sx + 9 * s, sy + sh * 0.35); g.lineTo(sx + sw - 9 * s, sy + sh * 0.35);
  g.moveTo(sx + 14 * s, sy + sh * 0.65); g.lineTo(sx + sw - 14 * s, sy + sh * 0.65);
  g.lineStyle(2.3 * s, 0x000000, 0.7);
  g.drawRect(sx, sy, sw, sh);
  // hanger brackets
  g.lineStyle(1.5 * s, 0x303030, 0.7);
  g.moveTo(sx + 11 * s,       sy); g.lineTo(sx + 11 * s,       sy - 9 * s);
  g.moveTo(sx + sw - 11 * s,  sy); g.lineTo(sx + sw - 11 * s,  sy - 9 * s);
}
