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

export function drawBusStopBench(g, p) {
  g.lineStyle(0);

  const s     = p.scale ?? 1;
  const halfW = 66;
  const benchW = 132;
  const { x, y } = p;

  // ground shadow
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y + 4 * s, halfW * 1.1, halfW * 0.33);
  g.endFill();

  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - halfW, y, benchW, 4 * s);
  g.endFill();

  lenv(g, y, 0.85);
  g.drawRect(x - halfW, y, benchW, 4 * s);

  const legY0 = y + 4 * s;
  const legY1 = legY0 + 30 * s;
  lenv(g, y, 0.9);
  g.moveTo(x - halfW + 10 * s, legY0);
  g.lineTo(x - halfW + 10 * s, legY1);
  g.moveTo(x + halfW - 10 * s, legY0);
  g.lineTo(x + halfW - 10 * s, legY1);
}
