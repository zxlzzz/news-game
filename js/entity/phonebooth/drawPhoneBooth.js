import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawPhoneBooth(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 80  * s;
  const h     = 173 * s;
  const px    = x - w / 2,  py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 11 * s);
  g.fillStyle(0x404040, 0.5);
  g.fillRect(px, py + 11 * s, w, h - 11 * s);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(px + 3 * s, py + 14 * s, w - 6 * s, (h - 11 * s) * 0.45);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 11 * s, w, h - 11 * s);

  // interior dividers
  g.lineStyle(1.5 * s, lineC, 0.7);
  g.lineBetween(px + w / 2, py + 14 * s, px + w / 2, y - 3 * s);
  g.lineBetween(px + 6 * s, py + (h - 11 * s) * 0.5 + 11 * s,
                px + w - 6 * s, py + (h - 11 * s) * 0.5 + 11 * s);

  // roof header
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(px - 3 * s, py, w + 6 * s, 14 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px - 3 * s, py, w + 6 * s, 14 * s);
  g.fillStyle(0xeaeaea, 0.9);
  g.fillRect(px + 3 * s, py + 3 * s, w - 6 * s, 6 * s);

  // handset
  g.fillStyle(0x202020, 0.7);
  g.fillRect(px + w - 14 * s, py + 29 * s, 6 * s, 17 * s);
}
