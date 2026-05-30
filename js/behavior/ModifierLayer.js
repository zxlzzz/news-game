/**
 * ModifierLayer — 叠加修饰器层（替代 OverlayLayer）
 *
 * 每帧对自由 NPC tick，管理三类修饰器：
 *   trait   — 生成时绑定，永久（priority 5）
 *   held    — 随机触发，计时结束自动移除（priority 10）
 *   gesture — 关键帧序列，播完自动移除（priority 20，预留）
 *
 * ID 以 _ 开头的修饰器（如 _loiter_micro、_talk_sub_event）由系统内部管理，
 * 跳过步骤 2 的 profile 兼容性检查。
 *
 * 频率限制：
 *   - 同一 NPC 同时只能有一个用户级 held modifier（非内部/非 trait）
 *   - held mod 到期后有 15~35s 冷却，冷却内不触发新动作
 *   - 全局上限：当前有动作的 NPC 比例超过 30% 时停止新增
 *   - gesture 与 held 相互独立：各自单实例、各自冷却；gesture 播完即移除
 */

import { HELD_POSES }   from './PoseRegistry.js';
import { TRAIT_PROPS }  from './PoseRegistry.js';
import { GESTURE_CLIPS } from './PoseRegistry.js';

const rand = (a, b) => a + Math.random() * (b - a);

// 从扁平 keyframe（{dur, r_elbow:[...], ...}）提取关节 joints 对象（剔除 dur）
function kfJoints(kf) {
  const j = {};
  for (const k in kf) { if (k !== 'dur') j[k] = kf[k]; }
  return j;
}

/**
 * @param {object} npc
 * @param {object} profile
 * @param {number} dt
 * @param {number} [globalHeldFrac=0] - 全局已有 held 动作的 NPC 比例（由 BehaviorManager 传入）
 */
export function tickModifiers(npc, profile, dt, globalHeldFrac = 0) {
  // 1) held 计时到期移除；到期时对用户级 held 开启冷却期
  npc.modifiers = npc.modifiers.filter(m => {
    if (m.kind !== 'held') return true;
    if (m.timer < 0) return true;       // 永久（负值）
    m.timer -= dt;
    if (m.timer > 0) return true;
    // 到期：非内部 held 触发冷却
    if (!m.id.startsWith('_')) npc._heldCooldown = rand(15, 35);
    return false;
  });

  // 冷却倒计时
  if ((npc._heldCooldown || 0) > 0) npc._heldCooldown -= dt;

  // 2) held 状态兼容性检查：状态切换后不再兼容的 held 移除
  //    _ 开头的内部修饰器豁免（由 BaseStateMachine / SocialLayer 自行管理）
  //    被状态变化强制移除的 held 也触发冷却，防止换回该状态后立即重新触发
  const heldDefs = profile.heldPoses || {};
  let removedByState = false;
  npc.modifiers = npc.modifiers.filter(m => {
    if (m.kind !== 'held') return true;
    if (m.id.startsWith('_')) return true;
    const def = heldDefs[m.id];
    if (def && def.on.includes(npc.state)) return true;
    removedByState = true;
    return false;
  });
  if (removedByState && !((npc._heldCooldown || 0) > 0)) {
    npc._heldCooldown = rand(15, 35);
  }

  // 3) 确保 trait 修饰器存在（trait 不会被步骤 1/2 移除，但若意外丢失则补回）
  for (const traitKey of npc.traits) {
    if (npc.modifiers.some(m => m.id === traitKey)) continue;
    const tp = TRAIT_PROPS[traitKey];
    if (tp) npc.modifiers.push({
      id: traitKey, kind: 'trait', priority: 5, joints: { ...tp.joints }, timer: -1,
    });
  }

  // 4) 尝试触发新 held（独立函数，其内部的早退不影响后续 gesture 处理）
  _tryTriggerHeld(npc, heldDefs, globalHeldFrac);

  // 5) gesture 推进（逐关键帧播放，播完置 _done）
  for (const m of npc.modifiers) {
    if (m.kind !== 'gesture' || !m.keyframes) continue;
    // 空 keyframes 的占位 clip：立即结束，不产生位移
    if (m.keyframes.length === 0) { m._done = true; continue; }
    m.kfTimer -= dt;
    if (m.kfTimer <= 0) {
      if (++m.kfIdx >= m.keyframes.length) {
        if (m.loop) {
          m.kfIdx   = 0;
          m.joints  = kfJoints(m.keyframes[0]);
          m.kfTimer = m.keyframes[0].dur;
        } else {
          m._done = true;
        }
      } else {
        m.joints  = kfJoints(m.keyframes[m.kfIdx]);
        m.kfTimer = m.keyframes[m.kfIdx].dur;
      }
    }
  }

  // gesture 到期移除 + 触发冷却
  let removedGesture = false;
  npc.modifiers = npc.modifiers.filter(m => {
    if (m.kind === 'gesture' && m._done) { removedGesture = true; return false; }
    return !m._done;
  });
  if (removedGesture) npc._gestureCooldown = rand(8, 20);
  if ((npc._gestureCooldown || 0) > 0) npc._gestureCooldown -= dt;

  // 6) 尝试触发新 gesture（与 held 独立：单实例 + 冷却 + 适用状态 + 概率）
  _tryTriggerGesture(npc, profile);
}

/**
 * 按 profile.heldPoses 配置随机触发一个 held。
 * 条件：全局比例 < 30%；无 held 冷却；当前无用户级 held；每帧至多触发一个。
 */
function _tryTriggerHeld(npc, heldDefs, globalHeldFrac) {
  if (globalHeldFrac >= 0.30) return;
  if ((npc._heldCooldown || 0) > 0) return;
  if (npc.modifiers.some(m => m.kind === 'held' && !m.id.startsWith('_'))) return;

  const activeIds = new Set(npc.modifiers.map(m => m.id));
  for (const [name, def] of Object.entries(heldDefs)) {
    if (activeIds.has(name)) continue;
    if (!def.on.includes(npc.state)) continue;
    if (def.traitRequired && !npc.traits.includes(def.traitRequired)) continue;
    if (def.traitExcludes?.some(t => npc.traits.includes(t))) continue;
    let p = def.chance;
    if (def.chanceMultiplier?.[npc.state]) p *= def.chanceMultiplier[npc.state];
    if (Math.random() < p) {
      const hp = HELD_POSES[name];
      npc.modifiers.push({
        id: name, kind: 'held', priority: 10,
        joints: { ...(hp?.joints ?? {}) },
        timer: rand(def.dur[0], def.dur[1]),
      });
      break;
    }
  }
}

/**
 * 按 profile.gesturePoses 配置随机触发一个 gesture，进入播放队列。
 * 条件：无冷却、当前无 gesture 在播、状态匹配、概率命中；每帧至多触发一个。
 */
function _tryTriggerGesture(npc, profile) {
  const gestureDefs = profile.gesturePoses;
  if (!gestureDefs) return;
  if ((npc._gestureCooldown || 0) > 0) return;
  if (npc.modifiers.some(m => m.kind === 'gesture')) return;

  for (const [name, def] of Object.entries(gestureDefs)) {
    if (!def.on.includes(npc.state)) continue;
    if (def.traitRequired && !npc.traits.includes(def.traitRequired)) continue;
    if (def.traitExcludes?.some(t => npc.traits.includes(t))) continue;
    if (Math.random() < def.chance) {
      const clip = GESTURE_CLIPS[name];
      if (!clip) continue;
      const kf0 = clip.keyframes?.[0];
      npc.modifiers.push({
        id: name, kind: 'gesture', priority: 20,
        keyframes: clip.keyframes || [],
        loop:      !!clip.loop,
        kfIdx:     0,
        kfTimer:   kf0 ? kf0.dur : 0,
        joints:    kf0 ? kfJoints(kf0) : {},
        _done:     false,
      });
      break;
    }
  }
}
