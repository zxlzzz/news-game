/**
 * UseSmartPropTask — 走到 Smart Object 槽位并直接驱动 UsePropActivity
 *
 * 阶段：'goto' → 'using' → done
 *   goto  : GotoTask 导航到 slot 坐标；到达后直接 new UsePropActivity
 *   using : 每帧 tick 内部 Activity；Activity 结束（update→false）→ destroy → done
 *
 * 绕过 SocialLayer.activities 列表，由 task 自持 Activity 生命周期。
 * UsePropActivity 构造时会 join(npc)→ npc._activity = this，
 * BehaviorManager 将跳过 BSM；Activity.destroy 释放 npc._activity。
 *
 * 槽位 reserved 通过 runner.hold(slot) 登记；中断/顶替时由 runner 统一释放，
 * 无需在 onAbort 中手写清理。
 */

import { GotoTask }        from './GotoTask.js';
import { UsePropActivity } from '../activities/UsePropActivity.js';

let _idSeq = 0;

export class UseSmartPropTask {
  /**
   * @param {string}           activityType  - smartDef.activityType（如 'use_vending'）
   * @param {EnvironmentQuery} envQuery
   */
  constructor(activityType, envQuery) {
    this._activityType = activityType;
    this._envQuery     = envQuery;
    this._phase        = 'init';
    this._goto         = null;
    this._prop         = null;
    this._slot         = null;
    this._activity     = null;
  }

  onStart(npc, runner) {
    const found = this._envQuery.findAvailableSlot(this._activityType, npc, 250);
    if (!found) { this._phase = 'abort'; return; }

    const { prop, slot } = found;
    slot.reserved = npc.id;
    this._prop = prop;
    this._slot = slot;

    // 登记 holdings：中断/顶替时 runner 自动清除 reserved
    runner?.hold(slot);

    this._goto = new GotoTask(
      { x: prop.x + slot.dx, y: prop.y + slot.dy },
      { timeout: 30 },
    );
    this._goto.onStart(npc, null);
    this._phase = 'goto';
  }

  tick(npc, dt) {
    switch (this._phase) {
      case 'abort': return 'abort';

      case 'goto': {
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') return 'abort';   // runner releases slot via holdings
        if (r === 'done') {
          const sd         = this._prop.smartDef;
          const gestureId  = sd.gestureId  ?? this._activityType;
          const phaseLabel = sd.phaseLabel ?? this._activityType;
          this._activity = new UsePropActivity(
            ++_idSeq, this._activityType, npc, this._prop, gestureId, phaseLabel,
          );
          // 槽位已消费：清除 reserved，runner holdings 置 null 再次执行亦幂等
          this._slot.reserved = null;
          this._phase = 'using';
        }
        return null;
      }

      case 'using': {
        if (!this._activity) return 'done';
        if (!this._activity.alive) {
          this._activity.destroy(); this._activity = null; return 'done';
        }
        const alive = this._activity.update(dt);
        if (!alive) {
          this._activity.destroy(); this._activity = null; return 'done';
        }
        return null;
      }

      default: return 'done';
    }
  }

  onAbort(npc) {
    // GotoTask 走路中断
    if (this._phase === 'goto') this._goto?.onAbort(npc);
    // Activity 中断：destroy 会调 release(npc)→ npc._activity = null
    if (this._phase === 'using' && this._activity) {
      this._activity.destroy();
      this._activity = null;
    }
    // 槽位 reserved 由 runner._releaseHoldings 在 onAbort 之前已清除，无需重复
  }

  onInterrupt(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
  }

  onResume(npc) {
    if (this._phase !== 'using') {
      this._phase = 'init';
      this.onStart(npc, null);
    }
  }
}
