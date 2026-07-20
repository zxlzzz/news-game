/**
 * Agenda — 单 NPC 的欲望 / 效用选目标系统
 *
 * 每个 NPC 在注册时获得一份 Agenda 实例（BehaviorManager.register 创建）。
 * Agenda 在 runner.primary 为空时从 desires 池中选效用最高的目标，
 * 向 runner 提交对应的 task。
 *
 * desires 池：
 *   'stroll'       — 始终存在的默认漫游目标（不计入完成条件）
 *   'rest'         — 找空椅子坐下（UseBenchTask）
 *   'use_vending'  — 用自动贩卖机（UseSmartPropTask）
 *   'use_trash'    — 扔垃圾（UseSmartPropTask）
 *
 * 完成逻辑：
 *   每个非 stroll 的 desire 完成（task done）后从列表移除；
 *   若连续 abort 3 次，视为放弃并移除；
 *   当所有非 stroll desires 都移除后，_readyToExit = true，
 *   下一轮 Agenda.tick 推 ExitSceneTask 取代 StrollTask。
 */

import { StrollTask }       from './tasks/StrollTask.js';
import { UseBenchTask }     from './tasks/UseBenchTask.js';
import { UseSmartPropTask } from './tasks/UseSmartPropTask.js';
import { ExitSceneTask }    from './tasks/ExitSceneTask.js';
import { VisitTask }        from './tasks/VisitTask.js';
import { StrollLoopTask }   from './tasks/StrollLoopTask.js';

const rand = (a, b) => a + Math.random() * (b - a);
const MAX_ABORTS = 3;

export class Agenda {
  /**
   * @param {object}           profile
   * @param {EnvironmentQuery} envQuery
   */
  constructor(profile, envQuery) {
    this._profile      = profile;
    this._envQuery     = envQuery;
    this._desires      = this._buildDesires(profile);
    this._abortCounts  = new Map();
    this._readyToExit  = false;
    this._scanTimer    = rand(0, 2);  // stagger first evaluation across NPCs

    if (profile.agendaTemplate === 'park_idler') {
      this._parkCredits = Math.floor(rand(1, 4));  // 1, 2, or 3
      this._parkAborts  = 0;
      this._parkPhase   = 'stroll';
    }
  }

  /** 从 profile.desires 随机取 0-2 个，加上始终存在的 'stroll' */
  _buildDesires(profile) {
    const result = ['stroll'];
    const pool   = profile.desires ?? [];
    if (!pool.length) return result;
    const count = Math.floor(Math.random() * 3);  // 0, 1 or 2
    const seen  = new Set();
    for (let i = 0; i < count; i++) {
      const d = pool[Math.floor(Math.random() * pool.length)];
      if (!seen.has(d)) { result.push(d); seen.add(d); }
    }
    return result;
  }

  /**
   * 每帧调用。若 runner 无 primary，选效用最高欲望并提交 task。
   * @param {NPC}        npc
   * @param {TaskRunner} runner
   * @param {number}     dt
   */
  tick(npc, runner, dt) {
    this._scanTimer -= dt;
    if (runner.primary) return;
    if (this._scanTimer > 0) return;
    if (this._profile.agendaTemplate === 'park_idler') {
      this._pickParkIdlerGoal(npc, runner);
    } else {
      this._pickGoal(npc, runner);
    }
  }

  _pickGoal(npc, runner) {
    this._scanTimer = rand(1, 3);

    // 所有特定 desires 完成 → 触发离场
    if (this._readyToExit) {
      runner.setPrimary(new ExitSceneTask(), npc);
      return;
    }

    const active = this._desires.filter(d => d !== 'stroll');

    let bestDesire = 'stroll', bestScore = 0.3;
    for (const d of active) {
      const score = this._utility(d, npc);
      if (score > bestScore) { bestScore = score; bestDesire = d; }
    }

    const task = this._makeTask(bestDesire);
    if (!task) return;

    if (bestDesire !== 'stroll') {
      runner.setPrimary(task, npc, (result) => this._onTaskDone(bestDesire, result));
    } else {
      runner.setPrimary(task, npc);
    }
  }

  _onTaskDone(desire, result) {
    if (desire === 'stroll') return;

    if (result === 'done') {
      this._desires = this._desires.filter(d => d !== desire);
    } else if (result === 'abort') {
      const cnt = (this._abortCounts.get(desire) ?? 0) + 1;
      this._abortCounts.set(desire, cnt);
      if (cnt >= MAX_ABORTS) {
        this._desires = this._desires.filter(d => d !== desire);
      }
    }

    // 检查是否所有特定 desires 已完成/放弃
    if (this._desires.every(d => d === 'stroll')) {
      this._readyToExit = true;
    }
  }

  _utility(desire, npc) {
    switch (desire) {
      case 'stroll': return 0.3;
      case 'rest': {
        const b = this._envQuery.nearestFreeBench(npc, 350);
        return b ? 0.55 : 0;
      }
      case 'use_vending': {
        const f = this._envQuery.findAvailableSlot('use_vending', npc, 300);
        return f ? 0.50 : 0;
      }
      case 'use_trash': {
        const f = this._envQuery.findAvailableSlot('use_trash', npc, 300);
        return f ? 0.45 : 0;
      }
      default: return 0;
    }
  }

  _makeTask(desire) {
    switch (desire) {
      case 'rest':        return new UseBenchTask(this._envQuery);
      case 'use_vending': return new UseSmartPropTask('use_vending', this._envQuery);
      case 'use_trash':   return new UseSmartPropTask('use_trash', this._envQuery);
      case 'stroll':
      default:            return new StrollTask({ duration: rand(8, 22) });
    }
  }

  // ── park_idler 模板 ─────────────────────────────────────────────────────────

  _pickParkIdlerGoal(npc, runner) {
    this._scanTimer = rand(1, 3);

    if (this._parkCredits <= 0 || this._readyToExit) {
      this._readyToExit = true;
      runner.setPrimary(new ExitSceneTask(), npc);
      return;
    }

    if (this._parkPhase === 'stroll') {
      const segs = Math.floor(rand(2, 5));  // 2, 3, or 4 waypoints
      runner.setPrimary(new StrollLoopTask(segs), npc, (result) => {
        if (result === 'done') {
          this._parkPhase  = 'visit';
          this._parkAborts = 0;
        } else {
          this._parkAborts++;
          if (this._parkAborts >= MAX_ABORTS) {
            this._parkCredits--;
            this._parkPhase  = 'stroll';
            this._parkAborts = 0;
          }
        }
      });
      return;
    }

    // parkPhase === 'visit': draw affordance and route
    const poi = this._envQuery.drawAffordance(npc, 350);
    if (!poi) {
      this._parkCredits--;
      this._parkPhase = 'stroll';
      return;
    }

    const task = this._routePoi(poi);
    if (!task) {
      this._parkCredits--;
      this._parkPhase = 'stroll';
      return;
    }

    runner.setPrimary(task, npc, (result) => {
      if (result === 'done') {
        this._parkCredits--;
      } else {
        this._parkAborts++;
        if (this._parkAborts >= MAX_ABORTS) {
          this._parkCredits--;
          this._parkAborts = 0;
        }
      }
      this._parkPhase = 'stroll';
    });
  }

  /** POI → task 路由：use:'visit'→VisitTask; 'bench'→UseBenchTask; 'smart_prop'→UseSmartPropTask */
  _routePoi(poi) {
    switch (poi.aff.use) {
      case 'bench':      return new UseBenchTask(this._envQuery);
      case 'smart_prop': return new UseSmartPropTask(poi.aff.kind, this._envQuery);
      case 'visit':
      default:           return new VisitTask(poi, this._envQuery);
    }
  }
}
