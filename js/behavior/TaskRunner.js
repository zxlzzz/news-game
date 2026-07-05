/**
 * TaskRunner — 单 NPC 的三槽任务执行器
 *
 * 槽位：
 *   primary  — 主行为（Goto / UseBench / Stroll 等），同时只有一个
 *   reaction — 最高优先级（镜头反应，预留）；打断 primary → onInterrupt；
 *              结束后 primary.onResume；新 reaction 顶掉旧的 → onAbort
 *   overlay  — 叠加动作适配器（ModifierLayer）；本刀只挂载，不搬逻辑
 *
 * Task 接口（所有方法可选）：
 *   onStart(npc, runner)  — 第一次执行前调用一次
 *   tick(npc, dt)         — 每帧调用；返回 'done'|'abort'|null
 *   onInterrupt(npc)      — reaction 打断时调用
 *   onResume(npc)         — reaction 结束后恢复时调用
 *   onAbort(npc)          — 被强制终止（新 task 顶替 / runner.abortPrimary）时调用
 *
 * Holdings 机制（task.onStart 或 tick 中调用）：
 *   runner.hold(slotOrFn) — 登记槽位预约（{reserved} 对象）或任意清理函数
 *   runner.holdAll(npc, envQuery) — 登记 envQuery.releaseSlotReservation 调用
 *   task 结束（done/abort/被顶替）时 runner 统一调用 _releaseHoldings，
 *   令手写清理只在自然完成路径保留，中断/顶替路径由 runner 兜底。
 */

export class TaskRunner {
  constructor() {
    this.primary   = null;
    this.reaction  = null;
    this._onDone   = null;   // (result: 'done'|'abort') => void
    this._holdings = [];     // Array<slot | () => void>
  }

  // ── Holdings ──────────────────────────────────────────────────────────────

  /**
   * 登记持有资源。
   * @param {object|Function} slotOrFn
   *   - 对象（含 reserved 字段）：释放时将 reserved 置 null
   *   - 函数：释放时直接调用（可捕获 npc / envQuery 等）
   */
  hold(slotOrFn) {
    this._holdings.push(slotOrFn);
  }

  /**
   * 批量登记：释放时调用 envQuery.releaseSlotReservation(npc)。
   * @param {NPC}              npc
   * @param {EnvironmentQuery} envQuery
   */
  holdAll(npc, envQuery) {
    this._holdings.push(() => envQuery.releaseSlotReservation(npc));
  }

  /** 统一释放所有已登记资源（幂等，多次调用安全）。 */
  _releaseHoldings() {
    for (const h of this._holdings) {
      if (typeof h === 'function') {
        h();
      } else if (h && 'reserved' in h) {
        h.reserved = null;
      }
    }
    this._holdings = [];
  }

  // ── Primary ───────────────────────────────────────────────────────────────

  /** 替换 primary；若有旧 primary 则先释放 holdings 再 onAbort。 */
  setPrimary(task, npc, onDone = null) {
    if (this.primary) {
      this._releaseHoldings();
      this.primary.onAbort?.(npc);
    }
    this.primary  = task;
    this._onDone  = onDone;
    task.onStart?.(npc, this);
  }

  /** 强制终止 primary（不推入新 task）。 */
  abortPrimary(npc) {
    if (!this.primary) return;
    this._releaseHoldings();
    this.primary.onAbort?.(npc);
    this.primary = null;
    const cb = this._onDone;
    this._onDone = null;
    cb?.('abort');
  }

  // ── Reaction ──────────────────────────────────────────────────────────────

  /** 设置 reaction；新 reaction 顶掉旧的（onAbort），并暂停 primary（onInterrupt）。 */
  setReaction(task, npc) {
    if (this.reaction) {
      this.reaction.onAbort?.(npc);
    } else if (this.primary) {
      this.primary.onInterrupt?.(npc);
    }
    this.reaction = task;
    task.onStart?.(npc, this);
  }

  // ── Tick ──────────────────────────────────────────────────────────────────

  /** 每帧驱动：reaction 优先，primary 次之。 */
  tick(npc, dt) {
    if (this.reaction) {
      const result = this.reaction.tick?.(npc, dt);
      if (result === 'done' || result === 'abort') {
        this.reaction = null;
        this.primary?.onResume?.(npc);
      }
      return;
    }

    if (this.primary) {
      const result = this.primary.tick?.(npc, dt);
      if (result === 'done' || result === 'abort') {
        this._releaseHoldings();
        this.primary = null;
        const cb = this._onDone;
        this._onDone = null;
        cb?.(result);
      }
    }
  }
}
