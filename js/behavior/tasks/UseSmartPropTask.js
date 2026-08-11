/**
 * UseSmartPropTask — 走到 Smart Object 槽位并直接播放使用手势
 *
 * 阶段：'goto' → 'using' → done
 *   goto  : GotoTask 导航到 slot 坐标；到达后进入 using
 *   using : setState('stand')+stateDur=Infinity 挂住 → 清非 trait modifier →
 *           朝向道具 → 设 tag → ClipPlayer 播 gestureId；播完 setState('walk')+
 *           清理 tag/state → done
 *
 * Patch A：单人道具使用不再走 Activity/SocialLayer（原挂靠的 Activity 子类已删除）。
 * npc.mem('social').activity 全程不置位，BehaviorManager 的 BSM/modifiers 照常
 * 逐帧 tick——stateDur=Infinity 保证 timeout 转换不会打断 using 阶段；trash/vending
 * 均不在道路 zone 上，priority 12 的 road-evacuate 转换也不会触发。
 *
 * 槽位 reserved 通过 runner.hold(slot) 登记，中断/顶替时由 runner 统一释放。
 * prop._occupiedBy 在 using 阶段手动占位/释放（EnvironmentQuery.findAvailableSlot
 * 靠它排除正在被使用中的道具——reserved 在到达时已清空，_occupiedBy 是 using 阶段
 * 唯一的排他标记）；runner holdings 不认识这个字段，中断路径由 onAbort 手动清理。
 */

import { GotoTask }        from './GotoTask.js';
import { setState }        from '../Motor.js';
import { ClipPlayer }      from '../ClipPlayer.js';
import { getGestureClips } from '../ModifierLayer.js';

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
    this._player       = null;
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
          // 槽位已消费：清除 reserved，_occupiedBy 接管排他（_beginUsing 内置位）
          this._slot.reserved = null;
          this._beginUsing(npc);
          this._phase = 'using';
        }
        return null;
      }

      case 'using': {
        if (!npc.alive) { this._player = null; return 'done'; }
        this._player.update(dt);
        if (!this._player.done) return null;
        this._endUsing(npc, true);
        return 'done';
      }

      default: return 'done';
    }
  }

  _beginUsing(npc) {
    const sd         = this._prop.smartDef;
    const gestureId  = sd.gestureId  ?? this._activityType;
    const phaseLabel = sd.phaseLabel ?? this._activityType;

    this._prop._occupiedBy = npc.id;

    setState(npc, 'stand', 'use-prop');
    npc.stateDur  = Infinity;
    npc.modifiers = npc.modifiers.filter(m => m.kind === 'trait');
    npc.direction = (this._prop.x >= npc.x) ? 1 : -1;
    npc.mem('social').tags = [phaseLabel];

    this._player = new ClipPlayer(npc, '_use_prop');
    this._player.play(getGestureClips()[gestureId]);
  }

  /** @param {boolean} natural - true=手势自然播完；false=被中断 */
  _endUsing(npc, natural) {
    if (this._prop) this._prop._occupiedBy = null;
    this._player?.clear();
    this._player = null;
    if (npc.alive) {
      npc.mem('social').tags = null;
      setState(npc, 'walk', natural ? 'activity-end' : 'use-prop-interrupt');
    }
  }

  onAbort(npc) {
    // GotoTask 走路中断
    if (this._phase === 'goto') this._goto?.onAbort(npc);
    // using 阶段被顶替/强制终止：手动清理（ClipPlayer / tags / state / _occupiedBy）
    if (this._phase === 'using') this._endUsing(npc, false);
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
