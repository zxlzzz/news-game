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
 */

import { HELD_POSES }  from './PoseRegistry.js';
import { TRAIT_PROPS } from './PoseRegistry.js';

const rand = (a, b) => a + Math.random() * (b - a);

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

  // 4) 尝试触发新 held
  //    条件：全局比例 < 30%；无冷却；当前无用户级 held；每帧至多触发一个
  if (globalHeldFrac >= 0.30) return;
  if ((npc._heldCooldown || 0) > 0) return;
  const hasUserHeld = npc.modifiers.some(m => m.kind === 'held' && !m.id.startsWith('_'));
  if (hasUserHeld) return;

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

  // 5) gesture 推进（预留；GESTURE_CLIPS 为空，实际不执行）
  for (const m of npc.modifiers) {
    if (m.kind !== 'gesture' || !m.keyframes) continue;
    if ((m.kfTimer -= dt) <= 0) {
      if (++m.kfIdx >= m.keyframes.length) {
        m._done = true; if (m.onDone) m.onDone(npc);
      } else {
        m.joints  = m.keyframes[m.kfIdx].joints;
        m.kfTimer = m.keyframes[m.kfIdx].dur;
      }
    }
  }
  npc.modifiers = npc.modifiers.filter(m => !m._done);
}
