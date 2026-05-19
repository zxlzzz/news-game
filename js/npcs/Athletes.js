/**
 * Athletes — 健身区（x 900–1300）
 * 包含：远/近端慢跑者（透视对比）、舞者、深蹲运动员（状态机）
 */

import { roadY } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnAthletes(em, sr) {
  // 远端慢跑者（小）vs 近端慢跑者（大）—— 同类角色的透视对比
  makeNPC(em, sr, {
    x: 980, y: roadY(0.10), animation: 'jog', direction:  1, speed: 68, vy: 0,
    minX: 900, maxX: 1300,
    minY: roadY(0.06), maxY: roadY(0.14),
    color: 0x1a0818, tags: ['jogger', 'athlete'],
  });
  makeNPC(em, sr, {
    x: 1220, y: roadY(0.88), animation: 'jog', direction: -1, speed: 62, vy: 0,
    minX: 900, maxX: 1300,
    minY: roadY(0.84), maxY: roadY(0.92),
    color: 0x0a1808, tags: ['jogger', 'athlete'],
  });

  // 舞者（中段）
  makeNPC(em, sr, {
    x: 1080, y: roadY(0.55), animation: 'dance', direction: 1, speed: 0, vy: 0,
    minX: 900, maxX: 1300,
    minY: roadY(0.52), maxY: roadY(0.58),
    color: 0x280a28, tags: ['dancer', 'pedestrian'],
  });

  // 深蹲–站立循环（单次播放状态机）
  const exerciser = makeNPC(em, sr, {
    x: 1160, y: roadY(0.38), animation: 'squat_down', direction: -1, speed: 0, vy: 0,
    playOnce: true,
    minX: 900, maxX: 1300,
    minY: roadY(0.35), maxY: roadY(0.41),
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
