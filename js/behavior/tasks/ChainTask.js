/**
 * ChainTask — 链条行为脚本解释器
 *
 * 六原语：goto / attach / detach / pose / use / loop
 * 脚本数据在 BehaviorScripts.js（零 import 纯数据）。
 *
 * 道具生命周期由 runner.hold 统一兜底：
 *   onStart 时 runner.hold(_cleanup)；无论链条如何结束（done/abort/劫持/despawn），
 *   cleanup 保证 detach 所有 held 物品并释放 goto 占用。
 *
 * goto 步骤：drawAffordance(kind) 抽点 → GotoTask 导航 →
 *            isClearSpot 复检 → occupyAffordance（占用持续至 cleanup）。
 * pose 步骤：setState(clip) + stateDur=Infinity 防 BSM timeout → dur 计时。
 * loop 步骤：无 times = 永循环；有 times = N 次后落入下一步。
 */

import { setState } from '../Motor.js';
import { GotoTask }    from './GotoTask.js';
import { UseBenchTask } from './UseBenchTask.js';
import { ATTACHMENT_DEFS } from '../data/AttachmentDefs.js';

const rand = (a, b) => a + Math.random() * (b - a);

const USE_WHITELIST = {
  bench: (envQuery) => new UseBenchTask(envQuery),
};

export class ChainTask {
  /**
   * @param {object}           script    BehaviorScripts 中的一个脚本对象
   * @param {EnvironmentQuery} envQuery
   */
  constructor(script, envQuery) {
    this._script     = script;
    this._envQuery   = envQuery;
    this._stepIdx    = 0;
    this._stepCtx    = {};
    this._loopCounts = new Map();
    this._heldItems  = new Set();
    this._runner     = null;
    this._gotoOccupied = null;
    this._lastEntity   = null;
  }

  onStart(npc, runner) {
    this._runner = runner;
    runner.hold(() => this._cleanup(npc));
  }

  // ── Cleanup （runner.hold 兜底，所有退出路径均调用）──────────────────────────

  _cleanup(npc) {
    // 1. 摘除所有 held 道具
    for (const item of this._heldItems) this._doDetach(npc, item);
    this._heldItems.clear();

    // 2. 释放 goto 占用（若尚未释放）
    if (this._gotoOccupied) {
      this._envQuery.releaseAffordance(this._gotoOccupied.entity, this._gotoOccupied.kind);
      this._gotoOccupied = null;
    }

    // 3. 中止当前子任务（goto / use）
    const step = this._script.steps[this._stepIdx];
    if (step && (step.op === 'goto' || step.op === 'use')) {
      this._stepCtx.sub?.onAbort?.(npc);
    } else if (step?.op === 'pose' && npc.state === step.clip) {
      setState(npc, 'walk', 'chain-abort');
    }
    this._stepCtx = {};
  }

  // ── 道具操作 ─────────────────────────────────────────────────────────────────

  _doAttach(npc, item) {
    const id = `_chain_${item}`;
    if (!npc.modifiers) npc.modifiers = [];
    if (!npc.modifiers.some(m => m.id === id)) npc.modifiers.push({ id });
    this._heldItems.add(item);
  }

  _doDetach(npc, item) {
    const id = `_chain_${item}`;
    if (npc.modifiers) npc.modifiers = npc.modifiers.filter(m => m.id !== id);
    this._heldItems.delete(item);
  }

  // ── 步骤分发 ─────────────────────────────────────────────────────────────────

  /** 返回 'continue' | 'advance' | 'abort' */
  _tickStep(npc, dt, step) {
    const ctx = this._stepCtx;

    switch (step.op) {

      // ── attach: 挂载道具 modifier（NpcPropManager 下帧自动创建道具）────────
      case 'attach': {
        this._doAttach(npc, step.item);
        return 'advance';
      }

      // ── detach: 卸载道具 modifier（道具自动销毁）──────────────────────────
      case 'detach': {
        this._doDetach(npc, step.item);
        return 'advance';
      }

      // ── goto: 导航到目标 affordance 并占用 ─────────────────────────────────
      case 'goto': {
        if (!ctx.phase) {
          const poi = this._envQuery.drawAffordance(npc, 350, step.aff);
          if (!poi) return 'abort';
          ctx.poi      = poi;
          ctx.sub      = new GotoTask({ x: poi.x, y: poi.y }, { timeout: 30 });
          ctx.sub.onStart(npc, null);
          ctx.phase    = 'seeking';
          ctx.retries  = 0;
        }

        if (ctx.phase === 'seeking') {
          const r = ctx.sub.tick(npc, dt);
          if (r === 'abort') return 'abort';
          if (r === 'done') {
            if (this._envQuery.isClearSpot(ctx.poi.x, ctx.poi.y)) {
              this._envQuery.occupyAffordance(ctx.poi.entity, ctx.poi.aff.kind);
              this._gotoOccupied = { entity: ctx.poi.entity, kind: ctx.poi.aff.kind };
              this._lastEntity   = ctx.poi.entity;
              return 'advance';
            } else if (ctx.retries < 2) {
              ctx.retries++;
              ctx.waitTimer = 0;
              ctx.phase = 'waiting';
            } else {
              return 'abort';
            }
          }
        }

        if (ctx.phase === 'waiting') {
          ctx.waitTimer += dt;
          if (ctx.waitTimer >= 1.5) {
            const poi = this._envQuery.drawAffordance(npc, 350, step.aff);
            if (!poi) return 'abort';
            ctx.poi   = poi;
            ctx.sub   = new GotoTask({ x: poi.x, y: poi.y }, { timeout: 30 });
            ctx.sub.onStart(npc, null);
            ctx.phase = 'seeking';
          }
        }

        return 'continue';
      }

      // ── pose: 播放姿势 clip + 计时 ──────────────────────────────────────────
      case 'pose': {
        if (!ctx.phase) {
          setState(npc, step.clip, 'chain-pose');
          npc.stateDur = Infinity;
          const [a, b] = step.dur;
          ctx.elapsed = 0;
          ctx.dur     = rand(a, b);
          ctx.phase   = 'doing';
        }
        ctx.elapsed += dt;
        if (ctx.elapsed >= ctx.dur) {
          setState(npc, 'walk', 'chain-pose-done');
          return 'advance';
        }
        return 'continue';
      }

      // ── use: 委托白名单子任务 ────────────────────────────────────────────────
      case 'use': {
        if (!ctx.phase) {
          const factory = USE_WHITELIST[step.task];
          if (!factory) return 'abort';
          ctx.sub = factory(this._envQuery);
          ctx.sub.onStart(npc, this._runner);
          ctx.phase = 'running';
        }
        const r = ctx.sub.tick?.(npc, dt) ?? null;
        if (r === 'done') return 'advance';
        if (r === 'abort') return 'abort';
        return 'continue';
      }

      default:
        return 'advance';
    }
  }

  // ── 主帧 tick ────────────────────────────────────────────────────────────────

  tick(npc, dt) {
    const steps = this._script.steps;
    let guard = 0;

    while (this._stepIdx < steps.length && ++guard < 50) {
      const step = steps[this._stepIdx];

      // loop 原语由 tick() 直接处理，不经 _tickStep
      if (step.op === 'loop') {
        if (step.times != null) {
          const cnt = (this._loopCounts.get(this._stepIdx) ?? 0) + 1;
          if (cnt >= step.times) {
            this._loopCounts.delete(this._stepIdx);
            this._stepIdx++;
            this._stepCtx = {};
            continue;
          }
          this._loopCounts.set(this._stepIdx, cnt);
        }
        this._stepIdx = step.from;
        this._stepCtx = {};
        continue;
      }

      const result = this._tickStep(npc, dt, step);
      if (result === 'continue') return null;
      if (result === 'abort') return 'abort';

      // 'advance': 推进到下一步
      this._stepIdx++;
      this._stepCtx = {};
    }

    return 'done';
  }

  // ── Task 生命周期回调 ────────────────────────────────────────────────────────

  onAbort(_npc) {
    // runner._releaseHoldings() 已在 onAbort 之前调用 _cleanup()
  }

  onInterrupt(npc) {
    const step = this._script.steps[this._stepIdx];
    if (!step) return;
    if (step.op === 'goto' || step.op === 'use') this._stepCtx.sub?.onAbort?.(npc);
  }

  onResume(_npc) {
    // 重置当前步骤上下文，恢复后从该步骤头部重新执行
    this._stepCtx = {};
  }
}
