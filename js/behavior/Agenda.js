/**
 * Agenda — 单 NPC 的目标选取系统
 *
 * agendaTemplate 路由：
 *   park_idler  → _pickParkIdlerGoal  (stroll→visit 循环，消耗 parkCredits)
 *   passerby /  → _pickPasserbyGoal   (60% 直通离场；40% 途中 1-2 次停留)
 *   (undefined)
 *   else        → _pickGoal            (desires 池 weighted ChainTask)
 */

import { StrollTask }       from './tasks/StrollTask.js';
import { UseBenchTask }     from './tasks/UseBenchTask.js';
import { UseSmartPropTask } from './tasks/UseSmartPropTask.js';
import { ExitSceneTask }    from './tasks/ExitSceneTask.js';
import { VisitTask }        from './tasks/VisitTask.js';
import { StrollLoopTask }   from './tasks/StrollLoopTask.js';
import { ChainTask }        from './tasks/ChainTask.js';
import { BEHAVIOR_SCRIPTS } from './data/BehaviorScripts.js';

const rand = (a, b) => a + Math.random() * (b - a);
const MAX_ABORTS = 3;

export class Agenda {
  /**
   * @param {object}           profile
   * @param {EnvironmentQuery} envQuery
   */
  constructor(profile, envQuery) {
    this._profile     = profile;
    this._envQuery    = envQuery;
    this._desires     = [...(profile.desires ?? [])];
    this._abortCounts = new Map();
    this._readyToExit = false;
    this._scanTimer   = rand(0, 2);

    if (profile.agendaTemplate === 'park_idler') {
      this._parkCredits = Math.floor(rand(1, 4));
      this._parkAborts  = 0;
      this._parkPhase   = 'stroll';
    } else if (!profile.agendaTemplate || profile.agendaTemplate === 'passerby') {
      this._passThrough  = Math.random() < 0.6;
      this._stopCredits  = this._passThrough ? 0 : Math.floor(rand(1, 3));
      this._stopAborts   = 0;
    }
  }

  /**
   * 每帧调用。若 runner 无 primary，按模板选下一目标。
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
    } else if (!this._profile.agendaTemplate || this._profile.agendaTemplate === 'passerby') {
      this._pickPasserbyGoal(npc, runner);
    } else {
      this._pickGoal(npc, runner);
    }
  }

  // ── 路人模板 ────────────────────────────────────────────────────────────────

  _pickPasserbyGoal(npc, runner) {
    this._scanTimer = rand(1, 3);

    if (this._readyToExit) {
      runner.setPrimary(new ExitSceneTask(), npc);
      return;
    }

    if (this._passThrough) {
      runner.setPrimary(new StrollTask({ duration: rand(8, 22) }), npc, (_result) => {
        this._readyToExit = true;
      });
      return;
    }

    if (this._stopCredits <= 0) {
      this._readyToExit = true;
      runner.setPrimary(new ExitSceneTask(), npc);
      return;
    }

    runner.setPrimary(new StrollTask({ duration: rand(8, 22) }), npc, (result) => {
      if (result === 'done') {
        const poi = this._envQuery.drawAffordance(npc, 250);
        if (poi) {
          const task = this._routePoi(poi);
          if (task) {
            runner.setPrimary(task, npc, () => { this._stopCredits--; });
            return;
          }
        }
        this._stopCredits--;
      } else {
        this._stopAborts++;
        if (this._stopAborts >= MAX_ABORTS) this._stopCredits = 0;
      }
    });
  }

  // ── desires-池模板（非 passerby 模板的其他 agendaTemplate） ─────────────────

  _pickGoal(npc, runner) {
    this._scanTimer = rand(1, 3);

    if (this._readyToExit) {
      runner.setPrimary(new ExitSceneTask(), npc);
      return;
    }

    const candidates = [];
    for (const id of this._desires) {
      const s = BEHAVIOR_SCRIPTS[id];
      if (s) candidates.push({ id, weight: s.weight ?? 0.3 });
    }

    if (candidates.length === 0 || Math.random() < 0.3) {
      runner.setPrimary(new StrollTask({ duration: rand(8, 22) }), npc);
      return;
    }

    let total = 0;
    for (const c of candidates) total += c.weight;
    let r = Math.random() * total;
    let picked = candidates[0].id;
    for (const c of candidates) { r -= c.weight; if (r <= 0) { picked = c.id; break; } }

    const task = new ChainTask(BEHAVIOR_SCRIPTS[picked], this._envQuery);
    runner.setPrimary(task, npc, (result) => this._onTaskDone(picked, result));
  }

  _onTaskDone(id, result) {
    if (result === 'done') {
      this._desires = this._desires.filter(d => d !== id);
    } else {
      const cnt = (this._abortCounts.get(id) ?? 0) + 1;
      this._abortCounts.set(id, cnt);
      if (cnt >= MAX_ABORTS) this._desires = this._desires.filter(d => d !== id);
    }
    if (this._desires.length === 0) this._readyToExit = true;
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
      const segs = Math.floor(rand(2, 5));
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
