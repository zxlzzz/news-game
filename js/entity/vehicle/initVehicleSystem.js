/**
 * initVehicleSystem — 车流系统装配（一次性）：TrafficManager + CyclistSpawner
 * + BusStop（按 layout.busStops）+ 机动车 VehicleSpawner，返回 TrafficManager。
 * （原文件名 vehicleSpawner.js 与 behavior/VehicleSpawner.js 仅大小写不同，已改名。）
 */

import { roadY, worldX, bikeLaneFarY, bikeLaneNearY } from '../../core/Layout.js';
import { makeNPC }            from '../../npc/npcUtil.js';
import { VehicleEntity }      from './VehicleEntity.js';
import { TrafficManager }     from './TrafficManager.js';
import { BusStop }            from '../busstop/busstop.js';
import { VehicleSpawner }     from '../../behavior/VehicleSpawner.js';
import { CyclistSpawner }     from './CyclistSpawner.js';
import { drawBicycle, drawEbike } from './drawBicycle.js';

const BUS_WAIT_RANGE = [5000, 20000];

/** busStopsCfg：layout.busStops（scene.json 驱动，见 sceneData.js#_expandLayout） */
export function initVehicleSystem(em, sr, bm, busStopsCfg = []) {
  const cyclistSpawner = new CyclistSpawner({
    em, sr, bm, draw: { bicycle: drawBicycle, ebike: drawEbike },
  });
  cyclistSpawner.spawnInitial();

  const tm = new TrafficManager({ em });

  for (const stop of busStopsCfg) {
    tm.busStops.push(new BusStop({ x: stop.x, direction: stop.direction, waitRange: BUS_WAIT_RANGE }));
  }

  tm.spawner = new VehicleSpawner({ trafficManager: tm, sr });
  tm.spawner.spawnInitial();

  tm.cyclistSpawner = cyclistSpawner;

  return tm;
}
