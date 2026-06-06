/**
 * SpawnManager — NPC 入场补充系统
 *
 * 每隔 3~7 秒检查全场存活 NPC 总数，低于 target 时从随机出口生成新 NPC
 * 并由 RouteSelector 分配路线。
 */

export class SpawnManager {
  /**
   * @param {object}        opts
   * @param {Function}      opts.spawnFn       - (entryPoint) => NPC|null
   * @param {ExitRegistry}  opts.exitRegistry
   * @param {BehaviorManager} opts.bm
   * @param {number}        opts.target        - 全场目标 NPC 总数
   * @param {RouteSelector} opts.routeSelector
   */
  constructor({ spawnFn, exitRegistry, bm, target, routeSelector }) {
    this._spawn         = spawnFn;
    this._exitReg       = exitRegistry;
    this._bm            = bm;
    this._target        = target ?? 20;
    this._routeSelector = routeSelector;
    this._checkTimer    = 0;
  }

  update(dt) {
    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = 3 + Math.random() * 4;

    const alive = this._bm.npcs.filter(n => n.alive && !n._departing).length;
    if (alive < this._target) this._trySpawn();
  }

  _trySpawn() {
    const exits = this._exitReg._exits;
    if (!exits.length) return;

    const entry = exits[Math.floor(Math.random() * exits.length)];
    const npc   = this._spawn(entry);
    if (!npc) return;

    if (this._routeSelector) {
      this._routeSelector.pickAndStart(npc, this._bm.npcs);
    }
  }
}
