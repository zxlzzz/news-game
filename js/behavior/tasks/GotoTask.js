/**
 * GotoTask — 导航到目标点（含跨侧过马路）
 *
 * 同侧：PathPlanner 规划路点序列，逐点喂给 modeDirect。
 * 跨侧：planCrossing 后在对侧再规划。
 * 2s 位移看门狗：静止 < 8px → 重规划一次；再失败 → 'abort'。
 */

import { setWalkMode } from '../Motor.js';
import { modeDirect, planCrossing } from '../WalkMode.js';
import { FAR_Y, NEAR_Y } from '../../core/Layout.js';
import { getPlanner } from '../nav/PathPlanner.js';

function _crossSide(y1, y2) {
  const side = y => (y < FAR_Y ? 0 : y >= NEAR_Y ? 1 : -1);
  const s1 = side(y1), s2 = side(y2);
  return s1 >= 0 && s2 >= 0 && s1 !== s2;
}

export class GotoTask {
  /**
   * @param {{x:number, y:number}} target
   * @param {{timeout?:number}} opts
   */
  constructor(target, { timeout = 60 } = {}) {
    this._target    = target;
    this._timeout   = timeout;
    this._arrived   = false;
    this._elapsed   = 0;
    this._gen       = 0;
    this._watchT    = 0;
    this._watchX    = 0;
    this._watchY    = 0;
    this._replanned = false;
  }

  onStart(npc, _runner) {
    this._watchX = npc.x;
    this._watchY = npc.y;
    this._watchT = 0;
    this._plan(npc);
  }

  _plan(npc) {
    this._gen++;
    const gen = this._gen;
    const t   = this._target;
    if (_crossSide(npc.y, t.y)) {
      planCrossing(npc, t.y, npc._profile, (n) => {
        if (this._gen !== gen) return;
        this._planSameSide(n, t, gen);
      });
    } else {
      this._planSameSide(npc, t, gen);
    }
  }

  _planSameSide(npc, t, gen) {
    const planner = getPlanner();
    const pts     = planner ? planner.plan(npc.x, npc.y, t.x, t.y) : null;
    this._chainWaypoints(npc, (pts && pts.length > 0) ? pts : [t], 0, gen);
  }

  _chainWaypoints(npc, pts, idx, gen) {
    if (idx >= pts.length) {
      if (this._gen === gen) this._arrived = true;
      return;
    }
    const remaining = Math.max(5, this._timeout - this._elapsed);
    const isLast    = idx === pts.length - 1;
    setWalkMode(npc, modeDirect(pts[idx], (n) => {
      if (this._gen !== gen) return;
      if (isLast) {
        this._arrived = true;
      } else {
        this._chainWaypoints(n, pts, idx + 1, gen);
      }
    }, remaining));
  }

  tick(npc, dt) {
    this._elapsed += dt;
    if (this._arrived)              return 'done';
    if (this._elapsed >= this._timeout) return 'abort';

    // 2s 位移看门狗
    this._watchT += dt;
    if (this._watchT >= 2) {
      const disp  = Math.hypot(npc.x - this._watchX, npc.y - this._watchY);
      this._watchT = 0;
      this._watchX = npc.x;
      this._watchY = npc.y;
      if (disp < 8) {
        if (this._replanned) return 'abort';
        this._replanned = true;
        this._plan(npc);
      }
    }

    return null;
  }

  onAbort(npc)      { setWalkMode(npc, null); }
  onInterrupt(_npc) {}
  onResume(npc) {
    this._arrived   = false;
    this._replanned = false;
    this.onStart(npc, null);
  }
}
