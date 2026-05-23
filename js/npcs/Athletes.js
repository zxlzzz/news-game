/**
 * Athletes — 健身人群（人行道上，不下马路）
 * 远端慢跑者（小）/ 近端慢跑者（大）做透视对比。
 */

import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnAthletes(em, sr) {
  // 远端慢跑者（小）
  makeNPC(em, sr, {
    x: 980, y: SIDEWALK_FAR_Y, animation: 'jog', direction:  1, speed: 60, vy: 0,
    minX: 850, maxX: 1320,
    minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y + 2,
    color: 0x1a0818, tags: ['jogger', 'athlete'],
  });
  // 近端慢跑者（大）—— 同类透视对比
  makeNPC(em, sr, {
    x: 1220, y: SIDEWALK_NEAR_Y, animation: 'jog', direction: -1, speed: 66, vy: 0,
    minX: 850, maxX: 1320,
    minY: SIDEWALK_NEAR_Y - 2, maxY: SIDEWALK_NEAR_Y + 2,
    color: 0x0a1808, tags: ['jogger', 'athlete'],
  });
}
