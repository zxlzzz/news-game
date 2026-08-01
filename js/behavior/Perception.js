/**
 * Perception — 双通道感知裁决（视觉 / 听觉）
 *
 * 纯函数模块：输入一个观察者 NPC 和一个世界坐标点，判定该观察者能否感知到
 * 那个位置、以及感知质量 q ∈ (0,1]。只做裁决，不写 npc.mem、不消费/产出
 * WorldEvent —— 上游"发生了什么事"（未来的 WorldEventLog）和下游"记成什么
 * claim"（未来的 belief 层，见 docs/design-plans/witness-memory-v1.md）都不
 * 归本文件管，本文件只回答"这个 NPC 此刻看得到/听得到那里吗，看/听得多清楚"。
 *
 * 唯一输出形态 {channel: 'sight'|'sound', q}：不返回布尔值——"能不能感知"
 * 本身是连续量，q 低到什么程度算"没感知到"由调用方（未来 W-5 的目击者筛选）
 * 决定阈值，本文件不预设截断点（除了视距/听距上限——那是硬性物理截断，见下）。
 *
 * 视觉三项：距离 / 朝向 / 注意力；听觉两项：距离 / 注意力（无朝向——声音全向传播）。
 * 各项都是独立小函数，命名与其对应关系一一可 grep（_sight* / _sound*）。
 * 距离上限（SIGHT_MAX_DIST / SOUND_MAX_DIST）是本文件唯一住址——不得在别处
 * 复制视距/听距数字。距离以外的两项是柔性衰减（乘法因子 ∈ (0,1]），只有
 * 距离超过上限是硬截断（因子直接为 0，不随其余项回补）。
 *
 * 数值（SIGHT_MAX_DIST、各衰减系数）是占位值，待 headless-sim 里跑分布敏感性
 * 分析后调整（与 belief-layer-v0.md 的 SIR 传播参数同等地位）。
 */

import { getHeldModifier } from './ModifierLayer.js';

// ── 距离上限（硬截断，唯一住址）───────────────────────────────────────────────
const SIGHT_MAX_DIST = 320;
const SOUND_MAX_DIST = 180;

// ── 朝向衰减（仅视觉）：事件在 NPC 面朝一侧 vs 背侧 ─────────────────────────────
const SIGHT_PERIPHERAL_FACTOR = 0.35; // 背侧非零——余光，不是全盲

// ── 注意力衰减：分心信号复用 ModifierLayer 的 held modifier id ─────────────────
// phone_look（盯着屏幕）重创视觉、轻伤听觉；phone_call（讲电话）相反——
// 眼睛是自由的，但注意力被谈话占用，对环境声音的分辨力下降更多。
const SIGHT_ATTENTION_FACTOR = { phone_look: 0.2, phone_call: 0.7 };
const SOUND_ATTENTION_FACTOR = { phone_look: 0.7, phone_call: 0.35 };

function _distFactor(dist, maxDist) {
  if (dist >= maxDist) return 0;
  return 1 - dist / maxDist;
}

/** 事件是否在 witness 面朝的一侧（witness.direction: +1 右 / -1 左） */
function _sightFacingFactor(witness, dx) {
  const facingRight = witness.direction >= 0;
  const eventOnRight = dx >= 0;
  return facingRight === eventOnRight ? 1 : SIGHT_PERIPHERAL_FACTOR;
}

function _sightAttentionFactor(heldId) {
  return SIGHT_ATTENTION_FACTOR[heldId] ?? 1;
}

function _soundAttentionFactor(heldId) {
  return SOUND_ATTENTION_FACTOR[heldId] ?? 1;
}

function _sightQuality(witness, dist, dx, heldId) {
  const distF = _distFactor(dist, SIGHT_MAX_DIST);
  if (distF <= 0) return 0;
  return distF * _sightFacingFactor(witness, dx) * _sightAttentionFactor(heldId);
}

function _soundQuality(dist, heldId) {
  const distF = _distFactor(dist, SOUND_MAX_DIST);
  if (distF <= 0) return 0;
  return distF * _soundAttentionFactor(heldId);
}

/**
 * witness 对世界坐标 (eventX, eventY) 的感知裁决。
 * 返回 q 更高的通道；两通道都为 0（超出双重射程或朝向/分心压到 0）时返回 null。
 */
export function perceive(witness, eventX, eventY) {
  const dx = eventX - witness.x;
  const dy = eventY - witness.y;
  const dist = Math.hypot(dx, dy);
  const heldId = getHeldModifier(witness)?.id ?? null;

  const qSight = _sightQuality(witness, dist, dx, heldId);
  const qSound = _soundQuality(dist, heldId);

  if (qSight <= 0 && qSound <= 0) return null;
  return qSight >= qSound ? { channel: 'sight', q: qSight } : { channel: 'sound', q: qSound };
}
