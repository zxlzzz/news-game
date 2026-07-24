/**
 * VisitTask — 泛用"到点做事"任务
 *
 * poi = { x, y, entity, aff } (drawAffordance 的返回值)
 * 状态机: seeking → arriving → doing → done
 *   seeking : GotoTask 导航到 poi 坐标
 *   arriving: isClearSpot 复检 + occupyAffordance
 *   doing   : setState(arrivalState) + dur 计时
 *
 * 净空复检失败 → waiting ~1.5s → 最多 2 次 → abort
 * runner.hold 登记 releaseAffordance，中断路径由 runner 统一兜底。
 * arrivalState 非空时设 stateDur=Infinity 防 BSM timeout 触发状态转换。
 */

import { setState } from '../Motor.js';
import { GotoTask } from './GotoTask.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class VisitTask {
  /**
   * @param {{x,y,entity,aff}} poi   drawAffordance 返回值
   * @param {EnvironmentQuery} envQuery
   */
  constructor(poi, envQuery) {
    this._poi       = poi;
    this._envQuery  = envQuery;
    this._phase     = 'init';
    this._elapsed   = 0;
    this._waitTimer = 0;
    this._dur       = rand(poi.aff.dur[0], poi.aff.dur[1]);
    this._goto      = null;
    this._runner    = null;
    this._retries   = 0;
    this._occupied  = false;
  }

  onStart(npc, runner) {
    this._runner = runner;
    runner.hold(() => this._releaseOccupancy());

    const dx = npc.x - this._poi.x, dy = npc.y - this._poi.y;
    if (Math.hypot(dx, dy) <= 24) {
      this._tryArrive(npc);
    } else {
      this._goto = new GotoTask({ x: this._poi.x, y: this._poi.y }, { timeout: 40 });
      this._goto.onStart(npc, null);
      this._phase = 'seeking';
    }
  }

  _tryArrive(npc) {
    if (this._envQuery.isClearSpot(this._poi.x, this._poi.y)) {
      this._envQuery.occupyAffordance(this._poi.entity, this._poi.aff.kind);
      this._occupied = true;
      if (this._poi.aff.arrivalState) {
        setState(npc, this._poi.aff.arrivalState, 'visit-arrive');
        npc.stateDur = Infinity;
      }
      this._phase = 'doing';
    } else if (this._retries < 2) {
      this._retries++;
      this._waitTimer = 0;
      this._phase = 'waiting';
    } else {
      this._phase = 'abort';
    }
  }

  _releaseOccupancy() {
    if (this._occupied) {
      this._envQuery.releaseAffordance(this._poi.entity, this._poi.aff.kind);
      this._occupied = false;
    }
  }

  tick(npc, dt) {
    switch (this._phase) {
      case 'abort': return 'abort';

      case 'seeking': {
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') return 'abort';
        if (r === 'done')  this._tryArrive(npc);
        return null;
      }

      case 'waiting': {
        this._waitTimer += dt;
        if (this._waitTimer >= 1.5) this._tryArrive(npc);
        return null;
      }

      case 'doing': {
        this._elapsed += dt;
        if (this._elapsed >= this._dur) {
          if (this._poi.aff.arrivalState) setState(npc, 'walk', 'visit-done');
          return 'done';
        }
        return null;
      }

      default: return null;
    }
  }

  onAbort(npc) {
    if (this._phase === 'seeking') this._goto?.onAbort(npc);
    if (this._poi.aff.arrivalState && npc.state === this._poi.aff.arrivalState)
      setState(npc, 'walk', 'visit-abort');
    // occupancy released by runner._releaseHoldings before onAbort
  }

  onInterrupt(npc) {
    if (this._phase === 'seeking') this._goto?.onAbort(npc);
  }

  onResume(npc) {
    if (this._phase === 'doing') {
      npc.stateDur = Infinity;
    } else {
      this._phase = 'init';
      this.onStart(npc, this._runner);
    }
  }
}
