/**
 * Pedestrians — 普通行人
 *
 * 两类：
 *   1) 公园漫游者：在公园广场内的矩形区域(zone)中自由二维游走（走向随机目标点，
 *      Y 随之变化 → EntityManager 自动按 Y 缩放/排序，呈现 2.5D 纵深）。
 *      由 BehaviorManager 接管（npc.roam = zone），可随机停下/交谈/坐长椅。
 *   2) 前人行道行人：建筑前短街上沿 Y 线横向行走（窄带，仅 X 往返）。
 *
 * 道路（FAR_Y..NEAR_Y）只允许 cyclist。
 */

import { SIDEWALK_FAR_Y, PARK_TOP, PARK_BOTTOM } from '../SceneConfig.js';
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

// npcType==profile 名；bagChance=携带 hold_bag 概率，smokerChance=smoker trait 概率
const TYPES = [
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
  { npcType: 'businessman', tags: ['pedestrian', 'business'], bagChance: 0.5, smokerChance: 0.10 },
  { npcType: 'tourist',     tags: ['tourist'],                bagChance: 0.4, smokerChance: 0.05 },
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
];

// 生成时注入持久特征：按概率给 smoker trait / hold_bag 持久 overlay
function applyTraits(n, t) {
  if (Math.random() < t.smokerChance) n._traits = { smoker: true };
  if (Math.random() < t.bagChance)    n.persistentOverlay = 'hold_bag';
}

export function spawnPedestrians(em, sr, bm) {
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
      applyTraits(n, t);
      bm.register(n, t.npcType);
      n._ageTimer  = rand(0, 60);  // 错开各人入场时间，避免同时离场
      n._lifespan  = rand(90, 210);
      n._departing = false;
    }
  }

  // ── 前人行道行人（窄带横向行走，不漫游；建筑前方 → scaleMul 0.65 拉远） ──────
  // 靠墙带：给较高 smoker 概率，便于演示"靠墙抽烟"（lean_wall + smoke）
  const sidewalkT = { bagChance: 0.4, smokerChance: 0.4 };
  const sw1 = makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 20, maxX: 480, minY: SIDEWALK_FAR_Y - 3, maxY: SIDEWALK_FAR_Y + 1,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  });
  applyTraits(sw1, sidewalkT); bm.register(sw1, 'businessman');
  sw1._ageTimer = rand(0, 60); sw1._lifespan = rand(90, 210); sw1._departing = false;
  const sw2 = makeNPC(em, sr, {
    x: 1100, y: SIDEWALK_FAR_Y - 1, animation: 'walk', direction: 1, speed: 16, vy: 0,
    minX: 1050, maxX: 1300, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  });
  applyTraits(sw2, sidewalkT); bm.register(sw2, 'businessman');
  sw2._ageTimer = rand(0, 60); sw2._lifespan = rand(90, 210); sw2._departing = false;
  const sw3 = makeNPC(em, sr, {
    x: 1750, y: SIDEWALK_FAR_Y + 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 1500, maxX: 1980, minY: SIDEWALK_FAR_Y, maxY: SIDEWALK_FAR_Y + 3,
    tags: ['pedestrian'], npcType: 'pedestrian', scaleMul: 0.65,
  });
  applyTraits(sw3, sidewalkT); bm.register(sw3, 'pedestrian');
  sw3._ageTimer = rand(0, 60); sw3._lifespan = rand(90, 210); sw3._departing = false;

}
