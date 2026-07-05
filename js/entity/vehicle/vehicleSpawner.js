/**
 * vehicleSpawner — 自行车 + 摩托（仅在马路上，车架与骑手对齐）
 */

import { roadY, worldX, bikeLaneFarY, bikeLaneNearY } from '../../core/Layout.js';
import { makeNPC }            from '../../npc/npcUtil.js';
import { VehicleEntity }      from './VehicleEntity.js';
import { TrafficManager }     from './TrafficManager.js';
import { BusStop }            from '../busstop/busstop.js';
import { VehicleSpawner }     from '../../behavior/VehicleSpawner.js';
import { CyclistSpawner }     from './CyclistSpawner.js';

const FRAME = 0x2a2a2a;
const SPOKE = 0x808080;
const lw = (s, base) => Math.max(0.8, base * s);

function forwardHand(n) {
  const hl = n.getAnchor('hand_l');
  const hr = n.getAnchor('hand_r');
  return (hr.x * n.direction >= hl.x * n.direction) ? hr : hl;
}

function drawBicycle(g, n) {
  const s = n.scale, d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');

  const crank = { x: (footL.x + footR.x) / 2, y: (footL.y + footR.y) / 2 };
  const wCy = crank.y;
  const wR  = Math.max(14 * s, (ground - crank.y) * 1.5);
  const rwx = hip.x - 5 * s * d;
  const fwx = bar.x + 7 * s * d;

  // wheels
  g.lineStyle(lw(s, 1.6), FRAME, 1);
  g.drawCircle(rwx, wCy, wR);
  g.drawCircle(fwx, wCy, wR);
  // spokes
  g.lineStyle(lw(s, 0.5), SPOKE, 0.6);
  g.moveTo(rwx - wR, wCy); g.lineTo(rwx + wR, wCy);
  g.moveTo(rwx, wCy - wR); g.lineTo(rwx, wCy + wR);
  g.moveTo(fwx - wR, wCy); g.lineTo(fwx + wR, wCy);
  g.moveTo(fwx, wCy - wR); g.lineTo(fwx, wCy + wR);

  // frame (diamond)
  g.lineStyle(lw(s, 2), FRAME, 1);
  g.moveTo(rwx, wCy);     g.lineTo(crank.x, crank.y);
  g.moveTo(crank.x, crank.y); g.lineTo(hip.x, hip.y);
  g.moveTo(hip.x, hip.y); g.lineTo(rwx, wCy);
  g.moveTo(crank.x, crank.y); g.lineTo(bar.x, bar.y);
  g.moveTo(fwx, wCy);     g.lineTo(bar.x, bar.y);
  // cranks to feet
  g.lineStyle(lw(s, 1.3), FRAME, 1);
  g.moveTo(crank.x, crank.y); g.lineTo(footL.x, footL.y);
  g.moveTo(crank.x, crank.y); g.lineTo(footR.x, footR.y);
  // pedals
  g.lineStyle(lw(s, 2), FRAME, 1);
  g.moveTo(footL.x - 2 * s * d, footL.y); g.lineTo(footL.x + 3 * s * d, footL.y);
  g.moveTo(footR.x - 2 * s * d, footR.y); g.lineTo(footR.x + 3 * s * d, footR.y);
}

function drawEbike(g, n) {
  const s = n.scale, d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');
  const footMid = { x: (footL.x + footR.x) / 2, y: (footL.y + footR.y) / 2 };
  const wR  = 18 * s;
  const wCy = ground - wR;
  const rwx = hip.x - 32 * s * d;
  const fwx = bar.x  +  8 * s * d;

  // wheels
  g.lineStyle(lw(s, 2.6), 0x1f1f1f, 1);
  g.drawCircle(rwx, wCy, wR);
  g.drawCircle(fwx, wCy, wR);
  // low platform
  g.lineStyle(lw(s, 3), 0x4a4a4a, 1);
  g.moveTo(rwx + wR * 0.6, footMid.y + 4 * s); g.lineTo(fwx - wR * 0.6, footMid.y + 4 * s);
  // seat tube + front fork
  g.lineStyle(lw(s, 2.2), 0x2a2a2a, 1);
  g.moveTo(rwx, wCy); g.lineTo(hip.x, hip.y);
  g.moveTo(fwx, wCy); g.lineTo(bar.x, bar.y);
  // delivery box
  const boxW = 24 * s, boxH = 22 * s;
  const boxCx = hip.x - 36 * s * d;
  g.beginFill(0x707070, 1);
  g.drawRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
  g.endFill();
  g.lineStyle(lw(s, 1), 0x101010, 1);
  g.drawRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
}

export function initVehicleSystem(em, sr) {
  const cyclistSpawner = new CyclistSpawner({
    em, sr, draw: { bicycle: drawBicycle, ebike: drawEbike },
  });
  cyclistSpawner.spawnInitial();

  const tm = new TrafficManager({ em });

  tm.busStops.push(new BusStop({ x: 500,  direction: +1, waitRange: [5000, 20000] }));
  tm.busStops.push(new BusStop({ x: 1500, direction: -1, waitRange: [5000, 20000] }));

  tm.spawner = new VehicleSpawner({ trafficManager: tm, sr });
  tm.spawner.spawnInitial();

  tm.cyclistSpawner = cyclistSpawner;

  return tm;
}
