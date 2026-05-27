/**
 * Pedestrians — 普通行人
 *
 * 两类：
 *   1) 公园漫游者：在公园广场内的矩形区域(zone)中自由二维游走。
 *   2) 前人行道行人：建筑前短街上沿 Y 线横向行走（窄带，仅 X 往返）。
 *
 * spawnOnePedestrian() 被导出，供 SpawnManager 动态补充时复用同一套生成逻辑。
 */

import { SIDEWALK_FAR_Y, PARK_TOP, PARK_BOTTOM, WORLD_WIDTH } from '../SceneConfig.js';
import { makeNPC } from './util.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 公园可行走纵深带（避开顶部步道边缘与最底边）
const ROAM_Y0 = PARK_TOP + 16;          // 349
const ROAM_Y1 = PARK_BOTTOM - 8;        // 492

// 沿 X 铺开的若干漫游区（相互重叠，覆盖整条街），每区放 2 人
const ROAM_ZONES = [
  [40, 360], [300, 660], [600, 960], [900, 1260], [1200, 1560], [1500, 1900],
];

const TYPES = [
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
  { npcType: 'businessman', tags: ['pedestrian', 'business'], bagChance: 0.5, smokerChance: 0.10 },
  { npcType: 'tourist',     tags: ['tourist'],                bagChance: 0.4, smokerChance: 0.05 },
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
];

function applyTraits(n, t) {
  n.traits = [];
  if (Math.random() < t.smokerChance) n.traits.push('smoker');
  if (Math.random() < t.bagChance)    n.traits.push('hold_bag');
}

/**
 * 生成单个行人 NPC，注册到行为系统后返回。
 * 供 spawnPedestrians 批量初始化 和 SpawnManager 动态补充共用。
 *
 * @param {string}          npcType   - 'pedestrian'|'businessman'|'tourist'
 * @param {EntityManager}   em
 * @param {StickRenderer}   sr
 * @param {BehaviorManager} bm
 * @param {{x, y}}          pos       - 初始坐标
 * @param {object}          [opts={}]
 * @param {object}          [opts.roamZone]   - {x0,x1,y0,y1}，公园漫游者需提供
 * @param {number}          [opts.minX]
 * @param {number}          [opts.maxX]
 * @param {number}          [opts.minY]
 * @param {number}          [opts.maxY]
 * @param {number}          [opts.scaleMul]   - 建筑前人行道传 0.65
 * @returns {NPC}
 */
export function spawnOnePedestrian(npcType, em, sr, bm, pos, opts = {}) {
  const typeData = TYPES.find(t => t.npcType === npcType) ?? TYPES[0];

  const n = makeNPC(em, sr, {
    x: pos.x, y: pos.y,
    animation: 'walk',
    direction: Math.random() < 0.5 ? 1 : -1,
    speed: rand(20, 34), vy: 0,
    minX: opts.minX ?? 0,
    maxX: opts.maxX ?? WORLD_WIDTH,
    minY: opts.minY ?? PARK_TOP,
    maxY: opts.maxY ?? PARK_BOTTOM,
    tags:    typeData.tags,
    npcType: typeData.npcType,
    scaleMul: opts.scaleMul ?? 1,
  });

  if (opts.roamZone) {
    n.roam = opts.roamZone;
    n.roamTarget = null;
  }

  applyTraits(n, typeData);
  bm.register(n, typeData.npcType);

  // SpawnManager 补充者从 _ageTimer=0 开始（call site 可覆盖为随机值做错峰离场）
  n._lifespan  = rand(30, 90);
  n._ageTimer  = 0;
  n._departing = false;

  return n;
}

export function spawnPedestrians(em, sr, bm) {
  // ── 公园漫游者（高密度，二维自由游走） ───────────────────────────────────
  for (const [x0, x1] of ROAM_ZONES) {
    for (let k = 0; k < 2; k++) {
      const t = pick(TYPES);
      const n = spawnOnePedestrian(t.npcType, em, sr, bm,
        { x: rand(x0, x1), y: rand(ROAM_Y0, ROAM_Y1) },
        {
          minX: x0, maxX: x1, minY: ROAM_Y0, maxY: ROAM_Y1,
          roamZone: { x0, x1, y0: ROAM_Y0, y1: ROAM_Y1 },
        }
      );
      // 初始批量生成：错开各人离场时间，避免同时走光
      n._ageTimer = rand(0, n._lifespan);
    }
  }

  // ── 前人行道行人（窄带横向行走；高 smokerChance 便于演示靠墙抽烟） ──────────
  const sidewalkT = { bagChance: 0.4, smokerChance: 0.4 };

  const sw1 = makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 20, maxX: 480, minY: SIDEWALK_FAR_Y - 3, maxY: SIDEWALK_FAR_Y + 1,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  });
  applyTraits(sw1, sidewalkT); bm.register(sw1, 'businessman');
  sw1._lifespan = rand(30, 90); sw1._ageTimer = rand(0, sw1._lifespan); sw1._departing = false;

  const sw2 = makeNPC(em, sr, {
    x: 1100, y: SIDEWALK_FAR_Y - 1, animation: 'walk', direction: 1, speed: 16, vy: 0,
    minX: 1050, maxX: 1300, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y,
    tags: ['pedestrian', 'business'], npcType: 'businessman', scaleMul: 0.65,
  });
  applyTraits(sw2, sidewalkT); bm.register(sw2, 'businessman');
  sw2._lifespan = rand(30, 90); sw2._ageTimer = rand(0, sw2._lifespan); sw2._departing = false;

  const sw3 = makeNPC(em, sr, {
    x: 1750, y: SIDEWALK_FAR_Y + 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 1500, maxX: 1980, minY: SIDEWALK_FAR_Y, maxY: SIDEWALK_FAR_Y + 3,
    tags: ['pedestrian'], npcType: 'pedestrian', scaleMul: 0.65,
  });
  applyTraits(sw3, sidewalkT); bm.register(sw3, 'pedestrian');
  sw3._lifespan = rand(30, 90); sw3._ageTimer = rand(0, sw3._lifespan); sw3._departing = false;
}
