/**
 * GotoTask — 导航到目标点（含跨侧过马路）
 *
 * 使用 modeDirect 设置 _walkMode，steerRoam 负责实际移动。
 * 跨侧时先 planCrossing，回调中再 setWalkMode 到最终目标。
 */

import { setWalkMode } from '../Motor.js';
import { modeDirect, planCrossing } from '../WalkMode.js';
import { FAR_Y, NEAR_Y } from '../../core/Layout.js';

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
    this._target  = target;
    this._timeout = timeout;
    this._arrived = false;
    this._elapsed = 0;
  }

  onStart(npc, _runner) {
    const t      = this._target;
    const arrive = () => { this._arrived = true; };
    if (_crossSide(npc.y, t.y)) {
      planCrossing(npc, t.y, npc._profile, (n) => {
        setWalkMode(n, modeDirect(t, arrive, Math.max(5, this._timeout - this._elapsed)));
      });
    } else {
      setWalkMode(npc, modeDirect(t, arrive, this._timeout));
    }
  }

  tick(_npc, dt) {
    this._elapsed += dt;
    if (this._arrived)            return 'done';
    if (this._elapsed >= this._timeout) return 'abort';
    return null;
  }

  onAbort(npc)    { setWalkMode(npc, null); }
  onInterrupt(_npc) { /* reaction takes over; movement paused naturally */ }
  onResume(npc) {
    this._arrived = false;
    this.onStart(npc, null);
  }
}
