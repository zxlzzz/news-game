/**
 * Pedestrians — 普通行人（各区域步行者、手机用户、商务人士等）
 */

import { roadY, SIDEWALK_FAR_Y } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnPedestrians(em, sr) {
  // ── 远端人行道（SIDEWALK_FAR_Y ≈ 208）────────────────────────────────
  makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 8, animation: 'walk', direction:  1, speed: 28, vy: 0,
    minX:  20, maxX: 480, minY: SIDEWALK_FAR_Y - 10, maxY: SIDEWALK_FAR_Y - 6,
    color: 0x0a1840, tags: ['pedestrian', 'business'],
  });
  makeNPC(em, sr, {
    x: 920, y: SIDEWALK_FAR_Y, animation: 'mobile', direction: -1, speed: 0, vy: 0,
    minX: 820, maxX: 1020, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y + 2,
    color: 0x201818, tags: ['pedestrian'],
  });

  // ── 道路远端（roadY 0.05–0.25）────────────────────────────────────────
  makeNPC(em, sr, {
    x: 300, y: roadY(0.12), animation: 'walk', direction: 1, speed: 22, vy: 0,
    minX:  50, maxX: 490,
    color: 0x081838, tags: ['officer', 'authority'],
  });
  makeNPC(em, sr, {
    x: 1750, y: roadY(0.15), animation: 'walk', direction:  1, speed: 28, vy: 0,
    minX: 1700, maxX: 1990,
    color: 0x201810, tags: ['pedestrian'],
  });

  // ── 道路中段（roadY 0.35–0.65）────────────────────────────────────────
  makeNPC(em, sr, {
    x: 240, y: roadY(0.45), animation: 'phone', direction: 1, speed: 16, vy: 0,
    minX:  50, maxX: 490,
    color: 0x181828, tags: ['pedestrian', 'business'],
  });
  makeNPC(em, sr, {
    x: 1840, y: roadY(0.48), animation: 'mobile', direction: 1, speed: 0, vy: 0,
    minX: 1700, maxX: 1990,
    color: 0x100818, tags: ['pedestrian'],
  });

  // ── 道路近端（roadY 0.72–0.95）────────────────────────────────────────
  makeNPC(em, sr, {
    x: 400, y: roadY(0.80), animation: 'walk', direction: -1, speed: 38, vy: 0,
    minX:  50, maxX: 490,
    color: 0x1a1020, tags: ['pedestrian'],
  });
  makeNPC(em, sr, {
    x: 1900, y: roadY(0.78), animation: 'walk', direction: -1, speed: 24, vy: 0,
    minX: 1700, maxX: 1990,
    color: 0x182010, tags: ['pedestrian'],
  });
  makeNPC(em, sr, {
    x: 1790, y: roadY(0.92), animation: 'walk', direction:  1, speed: 14, vy: 0,
    minX: 1700, maxX: 1990,
    color: 0x2a1808, tags: ['tourist'],
  });
}
