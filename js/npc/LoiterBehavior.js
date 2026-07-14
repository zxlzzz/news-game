/**
 * LoiterBehavior — Loiter 状态的微行为循环（从 BaseStateMachine 拆出）
 *
 * 四微阶段循环：look_around → micro_action → look_around → check_around
 * micro_action 根据 NPC 特征派发视觉（打电话 / 看手机 / 抽烟 / 换包手）。
 */

import { setState } from '../behavior/Motor.js';
import { getHeldModifier } from '../behavior/ModifierLayer.js';

const rand = (a, b) => a + Math.random() * (b - a);

function _getMicroActionDur(npc) {
  const lt = npc.mem('loiter');
  const ov = lt.overlay;
  if (ov === 'phone_call')                            return rand(3, 6);
  if (ov === 'phone_look')                            return rand(5, 10);
  if (npc.traits && npc.traits.includes('smoker'))    return rand(4, 6);
  if (npc.traits && npc.traits.includes('walk_dog'))  return rand(3, 5);
  return rand(5, 8);
}

function _updateLoiterExtraTags(npc) {
  const lt   = npc.mem('loiter');
  const base = ['standing', 'idle'];
  if (lt.microPhase !== 1) { lt.tags = base.slice(); return; }
  const ov = lt.overlay;
  if      (ov === 'phone_call')                               lt.tags = [...base, 'phone_call', 'communicating'];
  else if (ov === 'phone_look')                               lt.tags = [...base, 'phone_use', 'distracted'];
  else if (npc.traits && npc.traits.includes('smoker'))       lt.tags = [...base, 'smoking'];
  else if (npc.traits && npc.traits.includes('walk_dog'))     lt.tags = [...base, 'dog_owner', 'watching'];
  else                                                        lt.tags = [...base, 'phone_use', 'distracted'];
}

function _applyLoiterVisuals(npc) {
  npc.modifiers = npc.modifiers.filter(m => m.id !== '_loiter_micro');
}

function _advanceMicroPhase(npc) {
  const lt = npc.mem('loiter');
  if (lt.microPhase === 3 && lt.dir !== undefined) {
    npc.direction = lt.dir;
    lt.dir = undefined;
  }
  const next = (lt.microPhase + 1) % 4;
  lt.microPhase     = next;
  lt.microPhaseName = ['look_around', 'micro_action', 'look_around', 'check_around'][next];
  switch (next) {
    case 0: lt.microTimer = rand(3, 6);               break;
    case 1:
      lt.overlay    = getHeldModifier(npc)?.id ?? null;
      lt.microTimer = _getMicroActionDur(npc);
      break;
    case 2: lt.microTimer = rand(2, 4);               break;
    case 3: lt.microTimer = rand(1, 2);               break;
  }
  _updateLoiterExtraTags(npc);
}

export function tickLoiter(npc, profile, dt) {
  const lt = npc.mem('loiter');
  if (lt.dur === null) {
    const range    = profile.loiterDurationRange || [15, 45];
    lt.dur         = rand(range[0], range[1]);
    lt.elapsed     = 0;
    lt.overlay     = getHeldModifier(npc)?.id ?? null;
    lt.microPhase  = 0;
    lt.microPhaseName = 'look_around';
    lt.microTimer  = rand(3, 6);
    _updateLoiterExtraTags(npc);
  }

  lt.elapsed += dt;

  if (lt.elapsed >= lt.dur) {
    setState(npc, 'walk', 'loiter-end');
    return;
  }

  lt.microTimer -= dt;
  if (lt.microTimer <= 0) _advanceMicroPhase(npc);

  _applyLoiterVisuals(npc);
}
