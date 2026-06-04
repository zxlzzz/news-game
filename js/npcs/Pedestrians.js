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
import { getProfile } from '../behavior/NpcProfile.js';
import { getTraitProps, resolveTraitVariant } from '../behavior/ModifierLayer.js';
import { setWalkMode, modeWander } from '../behavior/WalkMode.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 公园可行走纵深带（避开顶部步道边缘与最底边）
const ROAM_Y0 = PARK_TOP + 16;          // 349
const ROAM_Y1 = PARK_BOTTOM - 8;        // 492

// 公园漫游 X 范围（与 SpawnManager / StreetScene spawnZones.park 保持一致）
const ROAM_X0 = 50;
const ROAM_X1 = 1950;
const PARK_ROAM_COUNT = 12;

const TYPES = [
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
  { npcType: 'businessman', tags: ['pedestrian', 'business'], bagChance: 0.5, smokerChance: 0.10 },
  { npcType: 'tourist',     tags: ['tourist'],                bagChance: 0.4, smokerChance: 0.05 },
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
];

const SPAWN_TRAIT_CHANCES = { hold_bag: 0.25, umbrella: 0.08 };

function pushTrait(n, traitKey) {
  n.traits.push(traitKey);
  const tp = getTraitProps()[traitKey];
  if (!tp) return;
  // 生成时取 front 变体；运行中由 ModifierLayer 按状态切换 front/side
  const variant = resolveTraitVariant(tp, false);
  n.modifiers.push({
    id: traitKey, kind: 'trait', priority: 5,
    joints: { ...(variant?.joints ?? {}) }, timer: -1, _side: false,
  });
}

function applyTraits(n, t, profile) {
  n.traits = [];
  if (Math.random() < t.smokerChance) pushTrait(n, 'smoker');
  const spawnTraits = profile?.spawnTraits;
  if (spawnTraits && spawnTraits.length > 0) {
    const r = Math.random();
    let cumulative = 0;
    for (const trait of spawnTraits) {
      cumulative += SPAWN_TRAIT_CHANCES[trait] || 0;
      if (r < cumulative) { pushTrait(n, trait); break; }
    }
  }
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
  });

  if (opts.roamZone) {
    setWalkMode(n, modeWander(opts.roamZone));
  }

  applyTraits(n, typeData, getProfile(typeData.npcType));
  bm.register(n, typeData.npcType);

  // SpawnManager 补充者从 _ageTimer=0 开始（call site 可覆盖为随机值做错峰离场）
  n._lifespan  = rand(30, 90);
  n._ageTimer  = 0;
  n._departing = false;

  return n;
}

export function spawnPedestrians(em, sr, bm) {
  // ── 公园漫游者（高密度，二维自由游走） ───────────────────────────────────
  for (let k = 0; k < PARK_ROAM_COUNT; k++) {
    const t = pick(TYPES);
    const n = spawnOnePedestrian(t.npcType, em, sr, bm,
      { x: rand(ROAM_X0, ROAM_X1), y: rand(ROAM_Y0, ROAM_Y1) },
      {
        minX: ROAM_X0, maxX: ROAM_X1, minY: ROAM_Y0, maxY: ROAM_Y1,
        roamZone: { x0: ROAM_X0, x1: ROAM_X1, y0: ROAM_Y0, y1: ROAM_Y1 },
      }
    );
    n._ageTimer = rand(0, n._lifespan);
  }

  // ── 前人行道行人（窄带横向行走；高 smokerChance 便于演示靠墙抽烟） ──────────
  const sidewalkT = { bagChance: 0.4, smokerChance: 0.4 };

  const sw1 = makeNPC(em, sr, {
    x: 160, y: SIDEWALK_FAR_Y - 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 20, maxX: 480, minY: SIDEWALK_FAR_Y - 3, maxY: SIDEWALK_FAR_Y + 1,
    tags: ['pedestrian', 'business'], npcType: 'businessman',
  });
  applyTraits(sw1, sidewalkT, getProfile('businessman')); bm.register(sw1, 'businessman');
  setWalkMode(sw1, modeWander({ x0: sw1.minX, x1: sw1.maxX, y0: sw1.minY, y1: sw1.maxY }));
  sw1._lifespan = rand(30, 90); sw1._ageTimer = rand(0, sw1._lifespan); sw1._departing = false;

  const sw2 = makeNPC(em, sr, {
    x: 1100, y: SIDEWALK_FAR_Y - 1, animation: 'walk', direction: 1, speed: 16, vy: 0,
    minX: 1050, maxX: 1300, minY: SIDEWALK_FAR_Y - 2, maxY: SIDEWALK_FAR_Y,
    tags: ['pedestrian', 'business'], npcType: 'businessman',
  });
  applyTraits(sw2, sidewalkT, getProfile('businessman')); bm.register(sw2, 'businessman');
  setWalkMode(sw2, modeWander({ x0: sw2.minX, x1: sw2.maxX, y0: sw2.minY, y1: sw2.maxY }));
  sw2._lifespan = rand(30, 90); sw2._ageTimer = rand(0, sw2._lifespan); sw2._departing = false;

  const sw3 = makeNPC(em, sr, {
    x: 1750, y: SIDEWALK_FAR_Y + 2, animation: 'walk', direction: 1, speed: 28, vy: 0,
    minX: 1500, maxX: 1980, minY: SIDEWALK_FAR_Y, maxY: SIDEWALK_FAR_Y + 3,
    tags: ['pedestrian'], npcType: 'pedestrian',
  });
  applyTraits(sw3, sidewalkT, getProfile('pedestrian')); bm.register(sw3, 'pedestrian');
  setWalkMode(sw3, modeWander({ x0: sw3.minX, x1: sw3.maxX, y0: sw3.minY, y1: sw3.maxY }));
  sw3._lifespan = rand(30, 90); sw3._ageTimer = rand(0, sw3._lifespan); sw3._departing = false;
}
