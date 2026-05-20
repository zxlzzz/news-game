/**
 * Athletes — 健身人群（人行道上，不下马路）
 * 远端慢跑者（小）/ 近端慢跑者（大）做透视对比，舞者 + 深蹲者在近端人行道。
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

  // 舞者（近端人行道，原地）
  makeNPC(em, sr, {
    x: 1060, y: SIDEWALK_NEAR_Y + 2, animation: 'dance', direction: 1, speed: 0, vy: 0,
    minX: 1000, maxX: 1120,
    minY: SIDEWALK_NEAR_Y, maxY: SIDEWALK_NEAR_Y + 3,
    color: 0x280a28, tags: ['dancer', 'pedestrian'],
  });

  // 深蹲–站立循环（近端人行道，单次播放状态机）
  const exerciser = makeNPC(em, sr, {
    x: 1180, y: SIDEWALK_NEAR_Y - 1, animation: 'squat_down', direction: -1, speed: 0, vy: 0,
    playOnce: true,
    minX: 1140, maxX: 1240,
    minY: SIDEWALK_NEAR_Y - 2, maxY: SIDEWALK_NEAR_Y,
    color: 0x182810, tags: ['exerciser', 'athlete'],
  });
  exerciser.frameIndex = 0;
  exerciser._waitMs    = 0;
  exerciser.customUpdate = (n, delta) => {
    if (!n.animDone) return;
    n._waitMs += delta;
    if (n._waitMs >= 1200) {
      n._waitMs    = 0;
      n.animDone   = false;
      n.frameIndex = 0;
      n.frameTimer = 0;
      n.animation  = (n.animation === 'squat_down') ? 'stand_up' : 'squat_down';
    }
  };
}
