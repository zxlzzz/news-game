/**
 * LoiterBehavior — Loiter 状态的微行为循环（从 BaseStateMachine 拆出）
 *
 * 四微阶段循环：look_around → micro_action → look_around → check_around
 * micro_action 根据 NPC 特征派发视觉（打电话 / 看手机 / 抽烟 / 换包手）。
 */

import { setState } from '../behavior/BaseStateMachine.js';

let LOITER_POSES = {};

export function initPoseCache(pc) {
  LOITER_POSES = pc.loiter || {};
}

const rand = (a, b) => a + Math.random() * (b - a);

function getPosePhone() { return LOITER_POSES.phone || {}; }

function _getMicroActionDur(npc) {
  const ov = npc._loiterOverlay;
  if (ov === 'phone_call')                            return rand(3, 6);
  if (ov === 'phone_look')                            return rand(5, 10);
  if (npc.traits && npc.traits.includes('smoker'))    return rand(4, 6);
  if (npc.traits && npc.traits.includes('walk_dog'))  return rand(3, 5);
  return rand(5, 8);
}

function _updateLoiterExtraTags(npc) {
  const base = ['standing', 'idle'];
  if (npc._microPhase !== 1) { npc._extraTags = base.slice(); return; }
  const ov = npc._loiterOverlay;
  if      (ov === 'phone_call')                               npc._extraTags = [...base, 'phone_call', 'communicating'];
  else if (ov === 'phone_look')                               npc._extraTags = [...base, 'phone_use', 'distracted'];
  else if (npc.traits && npc.traits.includes('smoker'))       npc._extraTags = [...base, 'smoking'];
  else if (npc.traits && npc.traits.includes('walk_dog'))     npc._extraTags = [...base, 'dog_owner', 'watching'];
  else                                                        npc._extraTags = [...base, 'phone_use', 'distracted'];
}

function _applyLoiterVisuals(npc) {
  npc.modifiers = npc.modifiers.filter(m => m.id !== '_loiter_micro');
  if (npc._microPhase !== 1) return;
  const hasActiveHeld = npc.modifiers.some(m => m.kind === 'held' && !m.id.startsWith('_'));
  if (hasActiveHeld) return;
  if (npc.traits.includes('walk_dog')) return;
  npc.modifiers.push({ id: '_loiter_micro', kind: 'held', priority: 15, joints: { ...getPosePhone() }, timer: -1 });
}

function _advanceMicroPhase(npc) {
  if (npc._microPhase === 3 && npc._loiterDir !== undefined) {
    npc.direction  = npc._loiterDir;
    npc._loiterDir = undefined;
  }
  const next = (npc._microPhase + 1) % 4;
  npc._microPhase     = next;
  npc._microPhaseName = ['look_around', 'micro_action', 'look_around', 'check_around'][next];
  switch (next) {
    case 0: npc._microTimer = rand(3, 6);               break;
    case 1:
      npc._loiterOverlay = npc.modifiers.find(m => m.kind === 'held' && !m.id.startsWith('_'))?.id ?? null;
      npc._microTimer = _getMicroActionDur(npc);
      break;
    case 2: npc._microTimer = rand(2, 4);               break;
    case 3:
      npc._microTimer = rand(1, 2);
      break;
  }
  _updateLoiterExtraTags(npc);
}

export function tickLoiter(npc, profile, dt) {
  if (npc._loiterDur === null) {
    const range         = profile.loiterDurationRange || [15, 45];
    npc._loiterDur      = rand(range[0], range[1]);
    npc._loiterElapsed  = 0;
    npc._loiterOverlay  = npc.modifiers.find(m => m.kind === 'held' && !m.id.startsWith('_'))?.id ?? null;
    npc._microPhase     = 0;
    npc._microPhaseName = 'look_around';
    npc._microTimer     = rand(3, 6);
    _updateLoiterExtraTags(npc);
  }

  npc._loiterElapsed += dt;

  if (npc._loiterElapsed >= npc._loiterDur) {
    setState(npc, 'walk', 'loiter-end');
    return;
  }

  npc._microTimer -= dt;
  if (npc._microTimer <= 0) _advanceMicroPhase(npc);

  _applyLoiterVisuals(npc);
}
