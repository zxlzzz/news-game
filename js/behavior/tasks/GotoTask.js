/**
 * GotoTask — 导航到目标点（含跨侧过马路）
 *
 * N-2b：thin publishGoal adapter。
 * 规划、过马路、超时、卡死重规划全部下沉至 PlanService + Motor。
 */

import { publishGoal } from '../nav/PlanService.js';

export class GotoTask {
  /**
   * @param {{x:number, y:number}} target
   * @param {{timeout?:number, wantCross?:boolean}} opts
   */
  constructor(target, { timeout = 60, wantCross = false } = {}) {
    this._target    = target;
    this._timeout   = timeout;
    this._wantCross = wantCross;
    this._result    = null;
  }

  onStart(npc, _runner) {
    publishGoal(npc, this._target, this._timeout, (result) => {
      this._result = result;
    }, { wantCross: this._wantCross });
  }

  tick(_npc, _dt) {
    if (this._result === 'arrived') return 'done';
    if (this._result === 'timeout') return 'abort';
    if (this._result === 'blocked') return 'abort';
    return null;
  }

  onAbort(npc) {
    const mot = npc.mem('motor');
    if (mot.goal) {
      const cb  = mot.goal.onDone;
      mot.goal  = null;
      mot.path  = null;
      mot.needReplan = undefined;
      // suppress the callback — task is already aborting
      void cb;
    }
  }

  onInterrupt(_npc) {}

  onResume(npc) {
    this._result = null;
    this.onStart(npc, null);
  }
}
