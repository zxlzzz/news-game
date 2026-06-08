function _toGrayBand(color, lightVal, darkVal) {
  if (!color) return (lightVal << 16) | (lightVal << 8) | lightVal;
  const r   = (color >> 16) & 0xff;
  const g   = (color >> 8)  & 0xff;
  const b   =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(lightVal + (lum / 255) * (darkVal - lightVal));
  return (v << 16) | (v << 8) | v;
}

export function drawSign(g, p) {
  const s  = p.scale ?? 1;
  const sw = 43 * s;
  const sh = 35 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;
  const fill = _toGrayBand(p.propColor, 0xa8, 0x60);

  g.fillStyle(fill, 0.95);
  g.fillRect(sx, sy, sw, sh);
  // inner text lines
  g.lineStyle(1.7 * s, 0xfafafa, 0.8);
  g.lineBetween(sx + 9 * s, sy + sh * 0.35, sx + sw - 9 * s, sy + sh * 0.35);
  g.lineBetween(sx + 14 * s, sy + sh * 0.65, sx + sw - 14 * s, sy + sh * 0.65);
  g.lineStyle(2.3 * s, 0x000000, 0.7);
  g.strokeRect(sx, sy, sw, sh);
  // hanger brackets
  g.lineStyle(1.5 * s, 0x303030, 0.7);
  g.lineBetween(sx + 11 * s,       sy, sx + 11 * s,       sy - 9 * s);
  g.lineBetween(sx + sw - 11 * s,  sy, sx + sw - 11 * s,  sy - 9 * s);
}
