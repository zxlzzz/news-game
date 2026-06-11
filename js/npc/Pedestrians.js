/**
 * Pedestrians — 普通行人
 *
 * spawnPedestrians() 初始化场景内行人，路线由外部 RouteSelector 分配。
 * spawnOnePedestrian() 供 SpawnManager 动态补充复用。
 */

import { PARK_TOP, PARK_BOTTOM, WORLD_WIDTH, BUILDING_BASE_Y } from '../core/Layout.js';
import { makeNPC } from './npcUtil.js';
import { getProfile } from './NpcProfile.js';
import { getTraitProps, resolveTraitVariant } from '../behavior/ModifierLayer.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 行人初始随机生成区域（避开自行车道和马路）
const SPAWN_ZONES = [
  { x0: 50, x1: 1950, y0: 215, y1: 244 },          // 远侧人行道
  { x0: 50, x1: 1950, y0: PARK_TOP + 16, y1: PARK_BOTTOM - 8 },  // 公园
];

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

function randomSpawnPos() {
  const z = SPAWN_ZONES[Math.floor(Math.random() * SPAWN_ZONES.length)];
  return { x: rand(z.x0, z.x1), y: rand(z.y0, z.y1) };
}

/**
 * 生成单个行人 NPC，注册到行为系统后返回。
 * 路线由调用方通过 routeSelector.pickAndStart 分配，此处不设置 walkMode。
 *
 * @param {string}          npcType
 * @param {EntityManager}   em
 * @param {StickRenderer}   sr
 * @param {BehaviorManager} bm
 * @param {{x, y}}          pos
 * @param {object}          [opts={}]
 * @returns {NPC}
 */
export function spawnOnePedestrian(npcType, em, sr, bm, pos, opts = {}) {
  const typeData = TYPES.find(t => t.npcType === npcType) ?? TYPES[0];
  const profile  = getProfile(typeData.npcType);
  const speedRange = profile?.speedRange ?? [20, 34];

  const n = makeNPC(em, sr, {
    x: pos.x, y: pos.y,
    animation: 'walk',
    direction: Math.random() < 0.5 ? 1 : -1,
    speed: rand(speedRange[0], speedRange[1]), vy: 0,
    minX: opts.minX ?? 0,
    maxX: opts.maxX ?? WORLD_WIDTH,
    minY: opts.minY ?? BUILDING_BASE_Y,
    maxY: opts.maxY ?? PARK_BOTTOM,
    tags:    typeData.tags,
    npcType: typeData.npcType,
  });

  applyTraits(n, typeData, profile);
  bm.register(n, typeData.npcType);

  n._lifespan  = rand(90, 210);
  n._ageTimer  = 0;
  n._departing = false;

  return n;
}

/**
 * 批量生成初始行人；漫游目标由 Agenda（StrollTask）自动分配。
 * @param {EntityManager}   em
 * @param {StickRenderer}   sr
 * @param {BehaviorManager} bm
 * @param {number}          [count=18]
 */
export function spawnPedestrians(em, sr, bm, count = 18) {
  for (let k = 0; k < count; k++) {
    const t   = pick(TYPES);
    const pos = randomSpawnPos();
    const npc = spawnOnePedestrian(t.npcType, em, sr, bm, pos);
    npc._ageTimer = rand(0, npc._lifespan);
  }
}
