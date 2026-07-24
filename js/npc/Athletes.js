/**
 * Athletes — 健身人群
 * 远端慢跑者（小）在远侧人行道往返；
 * 近端慢跑者（大）沿 park_loop_jog 路线绕公园跑圈。
 */

import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y } from '../core/Layout.js';
import { makeNPC } from './npcUtil.js';
import { setWalkMode } from '../behavior/Motor.js';
import { modePathFollow } from '../behavior/WalkMode.js';

export function spawnAthletes(em, sr, bm) {
  // 远端慢跑者（小）—— 沿 sidewalk_far_jog 路线往返
  // bounds: sidewalk_far_jog waypoints bbox (x=[850,1320] y=[230,230]) ± 40px
  const farJogger = makeNPC(em, sr, {
    x: 980, y: SIDEWALK_FAR_Y, animation: 'jog', direction: 1, speed: 60, vy: 0,
    minX: 810, maxX: 1360, minY: 190, maxY: 270,
    color: 0x1a0818, tags: ['jogger', 'athlete'],
  });
  bm.register(farJogger, 'athlete');
  setWalkMode(farJogger, modePathFollow('sidewalk_far_jog'));

  // 近端慢跑者（大）—— 沿公园环线 park_loop_jog 绕圈（透视对比）
  // bounds: park_loop_jog waypoints bbox (x=[350,1850] y=[368,502]) ± 40px
  const nearJogger = makeNPC(em, sr, {
    x: 1220, y: SIDEWALK_NEAR_Y, animation: 'jog', direction: -1, speed: 66, vy: 0,
    minX: 310, maxX: 1890, minY: 328, maxY: 542,
    color: 0x0a1808, tags: ['jogger', 'athlete'],
  });
  bm.register(nearJogger, 'athlete');
  setWalkMode(nearJogger, modePathFollow('park_loop_jog'));
}
