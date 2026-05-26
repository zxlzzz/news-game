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
 */

import { HELD_POSES }  from './PoseRegistry.js';
import { TRAIT_PROPS } from './PoseRegistry.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function tickModifiers(npc, profile, dt) {
  // 1) held 计时到期移除（timer < 0 = 永久；每帧递减，归零后移除）
  npc.modifiers = npc.modifiers.filter(m =>
    m.kind !== 'held' || m.timer < 0 || (m.timer -= dt) > 0
  );

  // 2) held 状态兼容性检查：状态切换后不再兼容的 held 移除
  //    _ 开头的内部修饰器豁免（由 BaseStateMachine / SocialLayer 自行管理）
  const heldDefs = profile.heldPoses || {};
  npc.modifiers = npc.modifiers.filter(m => {
    if (m.kind !== 'held') return true;
    if (m.id.startsWith('_')) return true;
    const def = heldDefs[m.id];
    return def && def.on.includes(npc.state);
  });

  // 3) 确保 trait 修饰器存在（trait 不会被步骤 1/2 移除，但若意外丢失则补回）
  for (const traitKey of npc.traits) {
    if (npc.modifiers.some(m => m.id === traitKey)) continue;
    const tp = TRAIT_PROPS[traitKey];
    if (tp) npc.modifiers.push({
      id: traitKey, kind: 'trait', priority: 5, joints: tp.joints, timer: -1,
    });
  }

  // 4) 尝试触发新 held（同 id 不重复触发；每帧至多触发一个）
  const activeIds = new Set(npc.modifiers.map(m => m.id));
  for (const [name, def] of Object.entries(heldDefs)) {
    if (activeIds.has(name)) continue;
    if (!def.on.includes(npc.state)) continue;
    if (def.traitRequired && !npc.traits.includes(def.traitRequired)) continue;
    let p = def.chance;
    if (def.chanceMultiplier?.[npc.state]) p *= def.chanceMultiplier[npc.state];
    if (Math.random() < p) {
      const hp = HELD_POSES[name];
      npc.modifiers.push({
        id: name, kind: 'held', priority: 10,
        joints: hp?.joints ?? {},
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
