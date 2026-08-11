/**
 * ChessOnlookerTask — 棋局旁观者（单人，Patch D：不再是 ChessActivity 成员）
 *
 * 阶段：'goto' → 'watching' → done
 *   goto     : GotoTask 导航到棋桌 onlooker 槽。槽位只在有活局的棋桌上开放——
 *              findAvailableSlot 用 requireOccupied:true，table._occupiedBy 正是
 *              ChessActivity 生命周期内占位的标记（Activity.occupy/destroy 写入），
 *              天然充当"该桌局仍在进行"的前置条件，不必另开一条判活路径。
 *   watching : setState('chess_onlooker')+stateDur=Infinity 挂住，播 chess_onlookers
 *              定格动画；计时 rand(15,40) 秒后离场；局中途散场
 *              （table._occupiedBy 被 ChessActivity.destroy 清空）也提前离场。
 *
 * 棋桌 onlooker 槽定义不变（chessTable.js#makeSlots：dx/dy 几何、role 命名）；
 * 本 task 直接消费该槽位，不再经 SocialLayer.onSlotArrival / ChessActivity 的
 * addOnlooker——两者随 Patch D 一并从 ChessActivity 移除。
 *
 * 与 UseSmartPropTask 的关键差异：那边到位后立即清 slot.reserved（排他性转由
 * prop._occupiedBy 单独承担，一个道具同时只服务一人）；这里 slot.reserved 要
 * 一直占到旁观结束——排他单位是"这个 onlooker 槽"而不是整张棋桌（桌上两个
 * onlooker 槽可以同时坐人，_occupiedBy 是棋手占的，不能拿来当本槽的互斥锁）。
 * runner.hold(slot) 统一兜底：无论 done/abort，TaskRunner 都会在 tick 返回后
 * 清 slot.reserved，本文件不必再手写这一步。
 */

import { GotoTask } from './GotoTask.js';
import { setState } from '../Motor.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class ChessOnlookerTask {
  /** @param {EnvironmentQuery} envQuery */
  constructor(envQuery) {
    this._envQuery = envQuery;
    this._phase    = 'init';
    this._goto     = null;
    this._table    = null;
    this._slot     = null;
    this._dur      = 0;
    this._elapsed  = 0;
  }

  onStart(npc, runner) {
    const found = this._envQuery.findAvailableSlot('chess', npc, 250, {
      role: 'onlooker', requireOccupied: true,
    });
    if (!found) { this._phase = 'abort'; return; }

    const { prop, slot } = found;
    slot.reserved = npc.id;
    this._table = prop;
    this._slot  = slot;

    // 登记 holdings：中断/顶替/自然结束时 runner 统一清 slot.reserved
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
        // 走过去的路上棋局散了：不白跑，直接放弃
        if (!this._table.alive || !this._table._occupiedBy) return 'abort';
        const r = this._goto.tick(npc, dt);
        if (r === 'abort') return 'abort';
        if (r === 'done') {
          this._beginWatching(npc);
          this._phase = 'watching';
        }
        return null;
      }

      case 'watching': {
        if (!npc.alive) return 'done';
        if (!this._table.alive || !this._table._occupiedBy) {
          setState(npc, 'walk', 'chess-onlooker-done');
          return 'done';
        }
        this._elapsed += dt;
        if (this._elapsed >= this._dur) {
          setState(npc, 'walk', 'chess-onlooker-done');
          return 'done';
        }
        return null;
      }

      default: return 'done';
    }
  }

  _beginWatching(npc) {
    setState(npc, 'chess_onlooker', 'chess-onlooker-watch');
    npc.stateDur  = Infinity;
    npc.direction = (this._table.x >= npc.x) ? 1 : -1;
    this._dur     = rand(15, 40);
    this._elapsed = 0;
  }

  onAbort(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
    if (this._phase === 'watching' && npc.alive) setState(npc, 'walk', 'chess-onlooker-abort');
  }

  onInterrupt(npc) {
    if (this._phase === 'goto') this._goto?.onAbort(npc);
  }

  onResume(npc) {
    if (this._phase !== 'watching') {
      this._phase = 'init';
      this.onStart(npc, null);
    }
  }
}
