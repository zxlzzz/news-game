/**
 * Vehicles — 自行车 + 摩托（仅在马路上，车架与骑手对齐）
 *
 * 对齐原理：
 *   骑手骨架的"脚"= 踏板位置（不是落点），由 NPC.steadyFoot 保持身体恒高。
 *   车轮中心放在 y - wR（轮底触地于 y），轮心高度 ≈ 踏板/曲柄中心。
 *   后轮在臀部下方、前轮在车把（手）下方，使人车成为一体。
 */

import { roadY }              from '../SceneConfig.js';
import { makeNPC }            from './util.js';
import { VehicleEntity }      from '../VehicleEntity.js';
import { TrafficManager }     from '../behavior/TrafficManager.js';
import { BusStop }            from '../behavior/BusStop.js';
import { VehicleSpawner }     from '../behavior/VehicleSpawner.js';

const FRAME = 0x2a2a2a;
const SPOKE = 0x808080;
const lw = (s, base) => Math.max(0.8, base * s);

// 取骑手"更靠前"的手作为车把锚点
function forwardHand(n) {
  const hl = n.getAnchor('hand_l');
  const hr = n.getAnchor('hand_r');
  return (hr.x * n.direction >= hl.x * n.direction) ? hr : hl;
}

// 自行车完全围绕骑手锚点绘制：座=臀、把=前手、踏板=双脚、轮毂=曲柄
function drawBicycle(g, n) {
  const s = n.scale, d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');

  // 曲柄中心 = 双脚中点（脚正好在踏板上）；轮毂与曲柄同高（真实自行车几何）
  const crank = { x: (footL.x + footR.x) / 2, y: (footL.y + footR.y) / 2 };
  const wCy = crank.y;
  // 轮径放大（用户偏好更大的轮子），底部略低于深度线无妨
  const wR  = Math.max(14 * s, (ground - crank.y) * 1.5);
  const rwx = hip.x - 5 * s * d;   // 后轮在臀下偏后
  const fwx = bar.x + 7 * s * d;   // 前轮在车把下偏前

  // 车轮
  g.lineStyle(lw(s, 1.6), FRAME, 1);
  g.strokeCircle(rwx, wCy, wR);
  g.strokeCircle(fwx, wCy, wR);
  // 轮辐
  g.lineStyle(lw(s, 0.5), SPOKE, 0.6);
  g.lineBetween(rwx - wR, wCy, rwx + wR, wCy);
  g.lineBetween(rwx, wCy - wR, rwx, wCy + wR);
  g.lineBetween(fwx - wR, wCy, fwx + wR, wCy);
  g.lineBetween(fwx, wCy - wR, fwx, wCy + wR);

  // 车架（钻石形）：后轮-曲柄-座-把-前轮
  g.lineStyle(lw(s, 2), FRAME, 1);
  g.lineBetween(rwx, wCy, crank.x, crank.y);   // 后下叉
  g.lineBetween(crank.x, crank.y, hip.x, hip.y); // 座管 → 座(臀)
  g.lineBetween(hip.x, hip.y, rwx, wCy);          // 后上叉
  g.lineBetween(crank.x, crank.y, bar.x, bar.y);  // 下/前管
  g.lineBetween(fwx, wCy, bar.x, bar.y);          // 前叉
  // 曲柄到双脚（踏板），脚正好踩在踏板上
  g.lineStyle(lw(s, 1.3), FRAME, 1);
  g.lineBetween(crank.x, crank.y, footL.x, footL.y);
  g.lineBetween(crank.x, crank.y, footR.x, footR.y);
  // 踏板块
  g.lineStyle(lw(s, 2), FRAME, 1);
  g.lineBetween(footL.x - 2 * s * d, footL.y, footL.x + 3 * s * d, footL.y);
  g.lineBetween(footR.x - 2 * s * d, footR.y, footR.x + 3 * s * d, footR.y);
}

// 电动车（外卖电瓶车）：脚不蹬，脚踩低踏板；座后带外卖箱
function drawEbike(g, n) {
  const s = n.scale, d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');
  const footMid = { x: (footL.x + footR.x) / 2, y: (footL.y + footR.y) / 2 };
  const wR  = 12 * s;
  const wCy = ground - wR;
  const rwx = hip.x - 16 * s * d;
  const fwx = bar.x  +  4 * s * d;

  // 车轮
  g.lineStyle(lw(s, 2.6), 0x1f1f1f, 1);
  g.strokeCircle(rwx, wCy, wR);
  g.strokeCircle(fwx, wCy, wR);
  // 低踏板（脚下平台，连接前后轮）
  g.lineStyle(lw(s, 3), 0x4a4a4a, 1);
  g.lineBetween(rwx + wR * 0.6, footMid.y + 2 * s, fwx - wR * 0.6, footMid.y + 2 * s);
  // 座管：后轮 → 臀
  g.lineStyle(lw(s, 2.2), 0x2a2a2a, 1);
  g.lineBetween(rwx, wCy, hip.x, hip.y);
  // 立管/前叉：前轮 → 车把
  g.lineBetween(fwx, wCy, bar.x, bar.y);
  // 外卖箱（座后）
  const boxW = 12 * s, boxH = 11 * s;
  const boxCx = hip.x - 18 * s * d;
  g.fillStyle(0x707070, 1);
  g.fillRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
  g.lineStyle(lw(s, 1), 0x101010, 1);
  g.strokeRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
}

function _spawnCyclists(em, sr) {
  const cyclist1 = makeNPC(em, sr, {
    x: 1350, y: roadY(0.30), animation: 'bike', direction:  1, speed: 110, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.26), maxY: roadY(0.34),
    color: 0x0a2010, tags: ['cyclist', 'vehicle'],
  });
  cyclist1.drawExtra = drawBicycle;
  cyclist1.steadyFoot = true;

  const cyclist2 = makeNPC(em, sr, {
    x: 1550, y: roadY(0.72), animation: 'bike', direction: -1, speed: 100, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.68), maxY: roadY(0.76),
    color: 0x200a10, tags: ['cyclist', 'vehicle'],
  });
  cyclist2.drawExtra = drawBicycle;
  cyclist2.steadyFoot = true;

  const ebiker = makeNPC(em, sr, {
    x: 1450, y: roadY(0.50), animation: 'mobile', direction:  1, speed: 120, vy: 0,
    minX: 100, maxX: 1950, minY: roadY(0.46), maxY: roadY(0.54),
    color: 0x1a1000, tags: ['delivery', 'e-bike', 'vehicle'],
  });
  ebiker.drawExtra = drawEbike;
}

export function initVehicleSystem(em, sr) {
  _spawnCyclists(em, sr);

  const rc  = roadY(0.5);
  const rh  = roadY(1.0) - roadY(0.5);
  const dep = { scaleMul: 1.5, roadCenterY: rc, roadHalfHeight: rh };

  const tm = new TrafficManager({ em, dep });

  // 公交站（下行带，dir -1，靠近行道树处）
  tm.busStops.push(new BusStop({ x: 400,  direction: -1, waitTime: 4000 }));
  tm.busStops.push(new BusStop({ x: 1600, direction: -1, waitTime: 4000 }));

  tm.spawner = new VehicleSpawner({ trafficManager: tm, dep });
  tm.spawner.spawnInitial();

  return tm;
}
