/**
 * Vehicles — 自行车 + 摩托（区域2/3，车道固定不纵向漂移）
 */

import { roadY } from '../SceneConfig.js';
import { makeNPC } from './util.js';

function drawBicycle(g, n) {
  const s = n.scale, d = n.direction, bx = n.x, by = n.y;
  const wR = 22 * s, wCy = by - wR;
  const rw = bx - 20 * s * d, fw = bx + 70 * s * d;
  const jx = bx + 20 * s * d, jy = wCy - 20 * s;
  g.lineStyle(2 * s, 0x555555, 1);
  g.strokeCircle(rw, wCy, wR); g.strokeCircle(fw, wCy, wR);
  g.lineStyle(2 * s, 0x333333, 1);
  g.lineBetween(rw, wCy, jx, jy); g.lineBetween(fw, wCy, jx, jy);
  g.lineBetween(jx, jy, bx + 48 * s * d, wCy - 18 * s);
  g.lineStyle(0.8 * s, 0x888888, 0.6);
  g.lineBetween(rw, wCy, bx + 22 * s * d, wCy);
}

function drawMotorbike(g, n) {
  const s = n.scale, d = n.direction, bx = n.x, by = n.y;
  const wR = 26 * s, wCy = by - wR;
  const rw = bx - 18 * s * d, fw = bx + 76 * s * d;
  const lx = Math.min(rw, fw);
  g.lineStyle(3 * s, 0x333333, 1);
  g.strokeCircle(rw, wCy, wR); g.strokeCircle(fw, wCy, wR);
  g.fillStyle(0x666666, 1);
  g.fillRect(lx + 22 * s, wCy - 26 * s, 50 * s, 14 * s);
  g.lineStyle(2 * s, 0x444444, 1);
  g.lineBetween(rw, wCy, bx + 20 * s * d, wCy - 22 * s);
  g.lineBetween(bx + 20 * s * d, wCy - 22 * s, fw, wCy);
}

export function spawnVehicles(em, sr) {
  // 远端自行车（小）vs 近端自行车（大）— 透视对比
  const cyclist1 = makeNPC(em, sr, {
    x: 1350, y: roadY(0.22), animation: 'bike', direction:  1, speed: 110, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.18), maxY: roadY(0.26),
    color: 0x0a2010, tags: ['cyclist', 'vehicle'],
  });
  cyclist1.drawExtra = drawBicycle;

  const cyclist2 = makeNPC(em, sr, {
    x: 1550, y: roadY(0.72), animation: 'bike', direction: -1, speed: 100, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.68), maxY: roadY(0.76),
    color: 0x200a10, tags: ['cyclist', 'vehicle'],
  });
  cyclist2.drawExtra = drawBicycle;

  const rider = makeNPC(em, sr, {
    x: 1450, y: roadY(0.50), animation: 'bike', direction:  1, speed: 90, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.46), maxY: roadY(0.54),
    color: 0x1a1000, tags: ['delivery', 'rider', 'vehicle'],
  });
  rider.drawExtra = drawMotorbike;
}
