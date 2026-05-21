/**
 * Pedestrians — 普通行人（仅人行道行走，禁止落在马路上）
 *
 * 行走带：
 *   - 远端人行道：Y = SIDEWALK_FAR_Y  ± 3，避开了 bench/trash/lamp 三个 Y
 *   - 近端人行道：Y = SIDEWALK_NEAR_Y ± 3
 * 道路（FAR_Y..NEAR_Y）：只允许 cyclist / 横穿斑马线的行人
 */

import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y, FAR_Y, NEAR_Y } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnPedestrians(em, sr) {
  // 被 BehaviorManager 托管的普通行人（不含电动车骑手与横穿者）
  const managed = [];

  // ── 远端人行道 ───────────────────────────────────────────────────────────
  managed.push(makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 2, animation: 'walk', direction:  1, speed: 28, vy: 0,
    minX:  20, maxX: 480, minY: SIDEWALK_FAR_Y - 3, maxY: SIDEWALK_FAR_Y + 1,
    color: 0x0a1840, tags: ['pedestrian', 'business'], npcType: 'businessman',
  }));
  managed.push(makeNPC(em, sr, {
    x: 1750, y: SIDEWALK_FAR_Y + 2, animation: 'walk', direction:  1, speed: 28, vy: 0,
    minX: 1500, maxX: 1980, minY: SIDEWALK_FAR_Y, maxY: SIDEWALK_FAR_Y + 3,
    color: 0x201810, tags: ['pedestrian'], npcType: 'pedestrian',
  }));
  managed.push(makeNPC(em, sr, {
    x: 1100, y: SIDEWALK_FAR_Y - 1, animation: 'walk', direction: 1, speed: 16, vy: 0,
    minX: 1050, maxX: 1300, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y,
    color: 0x181828, tags: ['pedestrian', 'business'], npcType: 'businessman',
  }));

  // ── 近端人行道 ───────────────────────────────────────────────────────────
  managed.push(makeNPC(em, sr, {
    x: 320, y: SIDEWALK_NEAR_Y, animation: 'walk', direction: -1, speed: 32, vy: 0,
    minX:  50, maxX: 580, minY: SIDEWALK_NEAR_Y - 2, maxY: SIDEWALK_NEAR_Y + 2,
    color: 0x1a1020, tags: ['pedestrian'], npcType: 'pedestrian',
  }));
  managed.push(makeNPC(em, sr, {
    x: 1450, y: SIDEWALK_NEAR_Y + 1, animation: 'walk', direction: -1, speed: 24, vy: 0,
    minX: 1300, maxX: 1700, minY: SIDEWALK_NEAR_Y - 1, maxY: SIDEWALK_NEAR_Y + 3,
    color: 0x182010, tags: ['pedestrian'], npcType: 'pedestrian',
  }));
  managed.push(makeNPC(em, sr, {
    x: 1830, y: SIDEWALK_NEAR_Y, animation: 'walk', direction:  1, speed: 14, vy: 0,
    minX: 1700, maxX: 1990, minY: SIDEWALK_NEAR_Y - 2, maxY: SIDEWALK_NEAR_Y + 2,
    color: 0x2a1808, tags: ['tourist'], npcType: 'tourist',
  }));

  // ── 斑马线横穿者：远端 → 近端往返（路面上唯一允许的行人） ────────────────
  // 用 customUpdate 让 NPC 走到斑马线 x 时切换垂直行进，过完路再水平行进
  const crosserX = 290;       // 首条斑马线中间（起点 220，向右约 70 居中）
  const crosser = makeNPC(em, sr, {
    x: crosserX, y: SIDEWALK_FAR_Y, animation: 'walk', direction: 1, speed: 0, vy: 0,
    minX: crosserX - 4, maxX: crosserX + 4,
    minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_NEAR_Y + 2,
    color: 0x101028, tags: ['pedestrian', 'crossing'],
  });
  crosser._stage = 'far';   // far → crossingDown → near → crossingUp → far
  crosser._wait  = 0;
  crosser.customUpdate = (n, delta) => {
    const dt = delta / 1000;
    if (n._stage === 'far') {
      n._wait += dt;
      if (n._wait > 1.5) { n._stage = 'crossingDown'; n._wait = 0; n.animation = 'walk'; n.direction = 1; }
    } else if (n._stage === 'crossingDown') {
      n.y += 60 * dt;   // 垂直向下
      if (n.y >= SIDEWALK_NEAR_Y) { n.y = SIDEWALK_NEAR_Y; n._stage = 'near'; }
    } else if (n._stage === 'near') {
      n._wait += dt;
      if (n._wait > 1.5) { n._stage = 'crossingUp'; n._wait = 0; }
    } else if (n._stage === 'crossingUp') {
      n.y -= 60 * dt;
      if (n.y <= SIDEWALK_FAR_Y) { n.y = SIDEWALK_FAR_Y; n._stage = 'far'; }
    }
  };

  return managed; // 交给 BehaviorManager 托管
}
