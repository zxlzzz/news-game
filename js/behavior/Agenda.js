/**
 * Agenda — 单 NPC 的欲望 / 效用选目标系统
 *
 * 每个 NPC 在注册时获得一份 Agenda 实例（BehaviorManager.register 创建）。
 * Agenda 在 runner.primary 为空时从 desires 池中选效用最高的目标，
 * 向 runner 提交对应的 task。
 *
 * desires 池：
 *   'stroll'       — 始终存在的默认漫游目标
 *   'rest'         — 找空椅子坐下（UseBenchTask）
 *   'use_vending'  — 用自动贩卖机（UseSmartPropTask）
 *   'use_trash'    — 扔垃圾（UseSmartPropTask）
 *
 * 权重/效用：
 *   utility = desire 匹配（1.0）× 距离衰减 × profile 调系数
 *   stroll 固定低效用兜底；其他欲望仅在道具可达时有效用。
 */

import { StrollTask }       from './tasks/StrollTask.js';
import { UseBenchTask }     from './tasks/UseBenchTask.js';
import { UseSmartPropTask } from './tasks/UseSmartPropTask.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class Agenda {
  /**
   * @param {object}           profile
   * @param {EnvironmentQuery} envQuery
   */
  constructor(profile, envQuery) {
    this._profile   = profile;
    this._envQuery  = envQuery;
    this._desires   = this._buildDesires(profile);
    this._scanTimer = rand(0, 2);  // stagger first evaluation across NPCs
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
    if (runner.primary) return;      // 已有目标，等它完成
    if (this._scanTimer > 0) return; // 等扫描冷却
    this._pickGoal(npc, runner);
  }

  _pickGoal(npc, runner) {
    this._scanTimer = rand(1, 3);

    let bestDesire = 'stroll', bestScore = 0;
    for (const d of this._desires) {
      const score = this._utility(d, npc);
      if (score > bestScore) { bestScore = score; bestDesire = d; }
    }

    const task = this._makeTask(bestDesire);
    if (task) runner.setPrimary(task, npc);
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
}
