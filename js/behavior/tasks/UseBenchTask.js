/**
 * UseBenchTask — 走到最近空椅子并坐下休息
 *
 * 阶段：'goto' → 'sitting' → done
 *   goto    : GotoTask 导航到椅子附近
 *   sitting : sitDown + setState('sit_bench') + 计时；到时 standUp + setState('walk')
 *
 * 设 stateDur=Infinity 防止 BSM timeout 触发状态转换（如 sit_bench→lie_bench）。
 */

import { setState }          from '../Motor.js';
import { sitDown, standUp }  from '../../entity/seat/seat.js';
import { GotoTask }          from './GotoTask.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class UseBenchTask {
  /** @param {EnvironmentQuery} envQuery */
  constructor(envQuery) {
    this._envQuery = envQuery;
    this._phase    = 'init';
    this._elapsed  = 0;
    this._sitDur   = rand(8, 22);
    this._bench    = null;
    this._goto     = null;
  }

  onStart(npc, _runner) {
    // Already adjacent to a bench? Sit immediately.
    const near = this._envQuery.nearestFreeBench(npc, 80);
    if (near) {
      this._bench = near;
      sitDown(npc, near);
      setState(npc, 'sit_bench', 'use-bench');
      npc.stateDur = Infinity;
      this._phase = 'sitting';
      return;
    }

    // Find a bench to walk to.
    const far = this._envQuery.nearestFreeBench(npc, 300);
    if (!far) { this._phase = 'abort'; return; }

    this._bench = far;
    this._goto  = new GotoTask({ x: far.x, y: far.y }, { timeout: 35 });
    this._goto.onStart(npc, null);
    this._phase = 'goto';
  }

  tick(npc, dt) {
    switch (this._phase) {
      case 'abort': return 'abort';

      case 'goto': {
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') return 'abort';
        if (r === 'done') {
          const bench = this._envQuery.nearestFreeBench(npc, 80);
          if (!bench) return 'abort';
          this._bench = bench;
          sitDown(npc, bench);
          setState(npc, 'sit_bench', 'use-bench');
          npc.stateDur = Infinity;
          this._elapsed = 0;
          this._phase = 'sitting';
        }
        return null;
      }

      case 'sitting': {
        this._elapsed += dt;
        if (this._elapsed >= this._sitDur || !npc.alive) {
          standUp(npc);
          setState(npc, 'walk', 'bench-done');
          return 'done';
        }
        return null;
      }

      default: return 'done';
    }
  }

  onAbort(npc) {
    if (this._phase === 'goto')    this._goto?.onAbort(npc);
    if (this._phase === 'sitting') { standUp(npc); setState(npc, 'walk', 'bench-abort'); }
  }

  onInterrupt(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
  }

  onResume(npc) {
    if (this._phase === 'sitting') {
      npc.stateDur = Infinity;  // re-lock duration
    } else {
      this._phase = 'init';
      this.onStart(npc, null);
    }
  }
}
