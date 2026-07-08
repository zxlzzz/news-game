/**
 * Pedestrians — 普通行人
 *
 * spawnPedestrians() 初始化场景内行人。
 * spawnOnePedestrian() 供 SpawnManager 动态补充复用。
 */

import { PARK_BOTTOM, WORLD_WIDTH, BUILDING_BASE_Y } from '../core/Layout.js';
import { getNavGrid } from '../behavior/nav/NavGrid.js';
import { makeNPC } from './npcUtil.js';
import { getProfile } from './NpcProfile.js';
import { getHeldPoses } from '../behavior/ModifierLayer.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const TYPES = [
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
  { npcType: 'businessman', tags: ['pedestrian', 'business'], bagChance: 0.5, smokerChance: 0.10 },
  { npcType: 'tourist',     tags: ['tourist'],                bagChance: 0.4, smokerChance: 0.05 },
  { npcType: 'pedestrian',  tags: ['pedestrian'],             bagChance: 0.3, smokerChance: 0.15 },
];

const SPAWN_TRAIT_CHANCES = { hold_bag: 0.25, umbrella: 0.08 };

function pushTrait(n, traitKey) {
  n.traits.push(traitKey);
  const hp = getHeldPoses()[traitKey];
  if (!hp) return;
  n.modifiers.push({
    id: traitKey, kind: 'trait', priority: 5,
    joints: { ...(hp.joints ?? {}) }, timer: -1,
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
 * 生成单个行人 NPC，注册到行为系统后返回。初始 walkMode 由 Agenda 在首帧分配。
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

  const grid   = getNavGrid();
  const safePos = grid ? grid.nearestWalkable(pos.x, pos.y) : pos;

  const n = makeNPC(em, sr, {
    x: safePos.x, y: safePos.y,
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
 * @param {Array}           spawnPoints  — [{x, y, facing}]
 * @param {number}          [count=18]
 */
export function spawnPedestrians(em, sr, bm, spawnPoints, count = 18) {
  for (let k = 0; k < count; k++) {
    const t   = pick(TYPES);
    const pt  = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const npc = spawnOnePedestrian(t.npcType, em, sr, bm, { x: pt.x, y: pt.y });
    npc.direction = pt.facing !== 0 ? pt.facing : (Math.random() < 0.5 ? 1 : -1);
    npc._ageTimer = rand(0, npc._lifespan);
  }
}
