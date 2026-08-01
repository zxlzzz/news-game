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
