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
 *   onAbort(npc)          — 被强制终止（新 task 顶替 / runner.abort）时调用
 */

export class TaskRunner {
  constructor() {
    this.primary  = null;
    this.reaction = null;
    this._onDone  = null; // (result: 'done'|'abort') => void
  }

  /** 替换 primary；若有旧 primary 则先 onAbort */
  setPrimary(task, npc, onDone = null) {
    if (this.primary) {
      this.primary.onAbort?.(npc);
    }
    this.primary  = task;
    this._onDone  = onDone;
    task.onStart?.(npc, this);
  }

  /** 强制终止 primary（不推入新 task） */
  abortPrimary(npc) {
    if (!this.primary) return;
    this.primary.onAbort?.(npc);
    this.primary = null;
    const cb = this._onDone;
    this._onDone = null;
    cb?.('abort');
  }

  /** 设置 reaction；新 reaction 顶掉旧的（onAbort），并暂停 primary（onInterrupt） */
  setReaction(task, npc) {
    if (this.reaction) {
      this.reaction.onAbort?.(npc);
    } else if (this.primary) {
      this.primary.onInterrupt?.(npc);
    }
    this.reaction = task;
    task.onStart?.(npc, this);
  }

  /** 每帧驱动：reaction 优先，primary 次之 */
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
        this.primary = null;
        const cb = this._onDone;
        this._onDone = null;
        cb?.(result);
      }
    }
  }
}
