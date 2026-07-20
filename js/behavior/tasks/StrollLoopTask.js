/**
 * StrollLoopTask — 沿 park_loop_cw 路线走 N 段后返回 done
 *
 * modePathFollow 驱动；只读 mot.walkMode.wpIndex 检测段数推进（只读观测，不写 WalkMode）。
 * 启动时选距 NPC 最近的 waypoint 入口，减少空跑。
 * 无时间/距离累积字段，不触发 Rule 7。
 */

import { setWalkMode } from '../Motor.js';
import { modePathFollow, WALK_PATHS } from '../WalkMode.js';

const PATH_KEY = 'park_loop_cw';

function _nearestWpIndex(npc, waypoints) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < waypoints.length; i++) {
    const d = Math.hypot(waypoints[i].x - npc.x, waypoints[i].y - npc.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export class StrollLoopTask {
  /**
   * @param {number} segments  要走的路段数（每推进一个 waypoint 算一段）
   */
  constructor(segments) {
    this._segments   = segments;
    this._segsWalked = 0;
    this._lastIdx    = -1;
    this._done       = false;
  }

  onStart(npc, _runner) {
    const def      = WALK_PATHS[PATH_KEY];
    const startIdx = def ? _nearestWpIndex(npc, def.waypoints) : 0;
    setWalkMode(npc, modePathFollow(PATH_KEY, startIdx));
    this._lastIdx    = startIdx;
    this._segsWalked = 0;
    this._done       = false;
  }

  tick(npc, _dt) {
    if (this._done) return 'done';
    const wm = npc.mem('motor').walkMode;
    if (!wm || wm.kind !== 'path_follow' || wm.pathKey !== PATH_KEY) return null;
    if (wm.wpIndex !== this._lastIdx) {
      this._segsWalked++;
      this._lastIdx = wm.wpIndex;
      if (this._segsWalked >= this._segments) {
        this._done = true;
        return 'done';
      }
    }
    return null;
  }

  onAbort(npc) {
    this._done = true;
    setWalkMode(npc, null);
  }

  onInterrupt(_npc) {}

  onResume(npc) {
    this._done = false;
    this.onStart(npc, null);
  }
}
