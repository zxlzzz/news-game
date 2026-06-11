/**
 * PlayPoseTask — 在指定状态停留 dur 秒（或等 animDone）
 *
 * 设 stateDur=Infinity 防止 BSM timeout 转换干扰。
 */

import { setState } from '../Motor.js';

export class PlayPoseTask {
  /**
   * @param {string}      state    - Motor.js STATE_DEFS 中的状态名
   * @param {number|null} dur      - 持续秒数；null = 等待 animDone
   * @param {string}      trigger
   */
  constructor(state, dur, trigger = 'play-pose') {
    this._state   = state;
    this._dur     = dur;
    this._trigger = trigger;
    this._elapsed = 0;
  }

  onStart(npc, _runner) {
    setState(npc, this._state, this._trigger);
    npc.stateDur = Infinity;
  }

  tick(npc, dt) {
    this._elapsed += dt;
    if (this._dur != null && this._elapsed >= this._dur) return 'done';
    if (this._dur == null && npc.animDone)               return 'done';
    return null;
  }

  onAbort(npc)  { setState(npc, 'walk', 'pose-abort'); }
  onInterrupt(_npc) {}
  onResume(npc) { setState(npc, this._state, 'pose-resume'); npc.stateDur = Infinity; }
}
