/**
 * Vehicles — 自行车 + 摩托（仅在马路上，车架与骑手对齐）
 *
 * 对齐原理：
 *   骑手骨架的"脚"= 踏板位置（不是落点），由 NPC.steadyFoot 保持身体恒高。
 *   车轮中心放在 y - wR（轮底触地于 y），轮心高度 ≈ 踏板/曲柄中心。
 *   后轮在臀部下方、前轮在车把（手）下方，使人车成为一体。
 */

import { roadY } from '../SceneConfig.js';
import { makeNPC } from './util.js';

const FRAME = 0x2a2a2a;
const SPOKE = 0x808080;

function drawBicycle(g, n) {
  const s = n.scale, d = n.direction, bx = n.x, by = n.y;
  const wR  = 25 * s;
  const wCy = by - wR;                 // 轮心（≈ 踏板/曲柄高度）
  const rwx = bx +  2 * s * d;          // 后轮（臀部下）
  const fwx = bx + 76 * s * d;          // 前轮（车把下）
  const cx  = bx + 36 * s * d;          // 曲柄/踏板中心（脚下）
  const sx  = bx +  8 * s * d, sy = by - 64 * s;  // 鞍座
  const hx  = bx + 72 * s * d, hy = by - 60 * s;  // 车把

  // 车轮
  g.lineStyle(1.6 * s, FRAME, 1);
  g.strokeCircle(rwx, wCy, wR);
  g.strokeCircle(fwx, wCy, wR);
  // 轮辐（一横一竖示意）
  g.lineStyle(0.5 * s, SPOKE, 0.6);
  g.lineBetween(rwx - wR, wCy, rwx + wR, wCy);
  g.lineBetween(rwx, wCy - wR, rwx, wCy + wR);
  g.lineBetween(fwx - wR, wCy, fwx + wR, wCy);
  g.lineBetween(fwx, wCy - wR, fwx, wCy + wR);

  // 车架（钻石形）
  g.lineStyle(2 * s, FRAME, 1);
  g.lineBetween(rwx, wCy, cx, wCy);   // 后下叉
  g.lineBetween(cx, wCy, sx, sy);     // 座管
  g.lineBetween(sx, sy, rwx, wCy);    // 后上叉
  g.lineBetween(cx, wCy, hx, hy);     // 下/前管
  g.lineBetween(sx, sy, hx, hy);      // 上管
  g.lineBetween(fwx, wCy, hx, hy);    // 前叉
  // 车把横向
  g.lineBetween(hx, hy, hx - 5 * s * d, hy - 3 * s);
}

function drawMotorbike(g, n) {
  const s = n.scale, d = n.direction, bx = n.x, by = n.y;
  const wR  = 20 * s;
  const wCy = by - wR;
  const rwx = bx -  4 * s * d;
  const fwx = bx + 80 * s * d;
  // 车轮（粗）
  g.lineStyle(3 * s, 0x1f1f1f, 1);
  g.strokeCircle(rwx, wCy, wR);
  g.strokeCircle(fwx, wCy, wR);
  // 车体（鞍座+油箱）
  g.fillStyle(0x595959, 1);
  g.fillRect(Math.min(rwx, fwx) + 18 * s, wCy - 30 * s, 50 * s, 16 * s);
  g.lineStyle(1 * s, 0x1f1f1f, 1);
  g.strokeRect(Math.min(rwx, fwx) + 18 * s, wCy - 30 * s, 50 * s, 16 * s);
  // 前叉到车把
  g.lineStyle(2.4 * s, 0x2a2a2a, 1);
  g.lineBetween(fwx, wCy, bx + 70 * s * d, by - 58 * s);
  // 车把
  g.lineBetween(bx + 70 * s * d, by - 58 * s, bx + 64 * s * d, by - 60 * s);
}

export function spawnVehicles(em, sr) {
  // 远端自行车（小）
  const cyclist1 = makeNPC(em, sr, {
    x: 1350, y: roadY(0.30), animation: 'bike', direction:  1, speed: 110, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.26), maxY: roadY(0.34),
    color: 0x0a2010, tags: ['cyclist', 'vehicle'],
  });
  cyclist1.drawExtra = drawBicycle;
  cyclist1.steadyFoot = true;

  // 近端自行车（大）—— 透视对比
  const cyclist2 = makeNPC(em, sr, {
    x: 1550, y: roadY(0.72), animation: 'bike', direction: -1, speed: 100, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.68), maxY: roadY(0.76),
    color: 0x200a10, tags: ['cyclist', 'vehicle'],
  });
  cyclist2.drawExtra = drawBicycle;
  cyclist2.steadyFoot = true;

  // 外卖骑手（摩托，中间车道）
  const rider = makeNPC(em, sr, {
    x: 1450, y: roadY(0.50), animation: 'bike', direction:  1, speed: 130, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.46), maxY: roadY(0.54),
    color: 0x1a1000, tags: ['delivery', 'rider', 'vehicle'],
  });
  rider.drawExtra = drawMotorbike;
  rider.steadyFoot = true;
}
