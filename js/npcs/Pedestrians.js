/**
 * Pedestrians — 普通行人
 *
 * 两类：
 *   1) 公园漫游者：在公园广场内的矩形区域(zone)中自由二维游走（走向随机目标点，
 *      Y 随之变化 → EntityManager 自动按 Y 缩放/排序，呈现 2.5D 纵深）。
 *      由 BehaviorManager 接管（npc.roam = zone），可随机停下/交谈/坐长椅。
 *   2) 前人行道行人：建筑前短街上沿 Y 线横向行走（窄带，仅 X 往返）。
 *
 * 道路（FAR_Y..NEAR_Y）只允许 cyclist / 横穿斑马线的行人。
 */

import { SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y, PARK_TOP, PARK_BOTTOM } from '../SceneConfig.js';
import { makeNPC } from './util.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 公园可行走纵深带（避开顶部步道边缘与最底边）
const ROAM_Y0 = PARK_TOP + 16;          // ≈ 349
const ROAM_Y1 = PARK_BOTTOM - 8;        // ≈ 492

// 沿 X 铺开的若干漫游区（相互重叠，覆盖整条街），每区放 2 人
const ROAM_ZONES = [
  [40, 360], [300, 660], [600, 960], [900, 1260], [1200, 1560], [1500, 1900],
];

const TYPES = [
  { npcType: 'pedestrian', tags: ['pedestrian'] },
  { npcType: 'businessman', tags: ['pedestrian', 'business'] },
  { npcType: 'tourist',     tags: ['tourist'] },
  { npcType: 'pedestrian',  tags: ['pedestrian'] },
];

export function spawnPedestrians(em, sr) {
  const managed = [];

  // ── 公园漫游者（高密度，二维自由游走） ───────────────────────────────────
  for (const [x0, x1] of ROAM_ZONES) {
    for (let k = 0; k < 2; k++) {
      const zone = { x0, x1, y0: ROAM_Y0, y1: ROAM_Y1 };
      const t = pick(TYPES);
      const n = makeNPC(em, sr, {
        x: rand(x0, x1), y: rand(ROAM_Y0, ROAM_Y1),
        animation: 'walk', direction: Math.random() < 0.5 ? 1 : -1,
        speed: rand(20, 34), vy: 0,
        minX: x0, maxX: x1, minY: ROAM_Y0, maxY: ROAM_Y1,
        tags: t.tags, npcType: t.npcType,
      });
      n.roam = zone;            // 标记为漫游者，交给 BehaviorManager 转向
      n.roamTarget = null;
      managed.push(n);
    }
  }

  // ── 前人行道行人（窄带横向行走，不漫游；建筑前方 → scaleMul 0.65 拉远） ──────
  managed.push(makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 20, maxX: 480, minY: SIDEWALK_FAR_Y - 3, maxY: SIDEWALK_FAR_Y + 1,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  }));
  managed.push(makeNPC(em, sr, {
    x: 1100, y: SIDEWALK_FAR_Y - 1, animation: 'walk', direction: 1, speed: 16, vy: 0,
    minX: 1050, maxX: 1300, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  }));
  managed.push(makeNPC(em, sr, {
    x: 1750, y: SIDEWALK_FAR_Y + 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 1500, maxX: 1980, minY: SIDEWALK_FAR_Y, maxY: SIDEWALK_FAR_Y + 3,
    tags: ['pedestrian'], npcType: 'pedestrian', scaleMul: 0.65,
  }));

  // ── 斑马线横穿者：前人行道 → 公园往返（路面上，道路对面 → scaleMul 0.55） ─────
  const crosserX = 290;
  const crosser = makeNPC(em, sr, {
    x: crosserX, y: SIDEWALK_FAR_Y, animation: 'walk', direction: 1, speed: 0, vy: 0,
    minX: crosserX - 4, maxX: crosserX + 4,
    minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_NEAR_Y + 2,
    tags: ['pedestrian', 'crossing'], scaleMul: 0.55,
  });
  crosser._stage = 'far';
  crosser._wait  = 0;
  crosser.customUpdate = (n, delta) => {
    const dt = delta / 1000;
    if (n._stage === 'far') {
      n._wait += dt;
      if (n._wait > 1.5) { n._stage = 'crossingDown'; n._wait = 0; n.animation = 'walk'; n.direction = 1; }
    } else if (n._stage === 'crossingDown') {
      n.y += 60 * dt;
      if (n.y >= SIDEWALK_NEAR_Y) { n.y = SIDEWALK_NEAR_Y; n._stage = 'near'; }
    } else if (n._stage === 'near') {
      n._wait += dt;
      if (n._wait > 1.5) { n._stage = 'crossingUp'; n._wait = 0; }
    } else if (n._stage === 'crossingUp') {
      n.y -= 60 * dt;
      if (n.y <= SIDEWALK_FAR_Y) { n.y = SIDEWALK_FAR_Y; n._stage = 'far'; }
    }
  };

  return managed;
}
