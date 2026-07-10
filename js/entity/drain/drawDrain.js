import {
  depthLineWidth, depthLineColor,
  FILL_SHADE, ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawDrain(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const w  = 58 * s;
  const h  = 27 * s;
  const px = p.x - w / 2;
  const py = p.y - h / 2;

  g.beginFill(FILL_SHADE, 1);
  g.drawRect(px, py, w, h);
  g.endFill();

  lenv(g, p.y);
  g.drawRect(px, py, w, h);

  lenv(g, p.y, 0.65);
  const slots = Math.max(3, Math.floor(w / (9 * s)));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.moveTo(lx, py + 3 * s);
    g.lineTo(lx, py + h - 3 * s);
  }
}
