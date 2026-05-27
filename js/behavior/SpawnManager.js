/**
 * SpawnManager — NPC 入场补充系统
 *
 * 每隔 3~7 秒检查各区域当前密度，低于 target 时从对应入口生成新 NPC。
 * 入口复用 ExitRegistry 里已有的出口点（对称设计）：
 *   edge    → 从屏幕左/右边缘步入
 *   building → 从建筑门洞走出来
 *
 * 新 NPC 进入 routing 状态直奔区域内随机目标点，到位后切回 walk。
 */

import { setState } from './BaseStateMachine.js';

export class SpawnManager {
  /**
   * @param {object}          opts
   * @param {Function}        opts.spawnFn      - (entryPoint, zone) => NPC|null
   * @param {ExitRegistry}    opts.exitRegistry
   * @param {BehaviorManager} opts.bm
   * @param {object[]}        opts.zones        - 区域密度配置（见 StreetScene.js）
   */
  constructor({ spawnFn, exitRegistry, bm, zones }) {
    this._spawn      = spawnFn;
    this._exitReg    = exitRegistry;
    this._bm         = bm;
    this._zones      = zones;
    this._checkTimer = 0;
  }

  /** 每帧调用（由 StreetScene.update 驱动） */
  update(dt) {
    this._checkTimer -= dt;
    if (this._checkTimer > 0) return;
    this._checkTimer = 3 + Math.random() * 4;   // 每 3~7 秒检查一次

    for (const zone of this._zones) {
      const count = this._countInZone(zone);
      if (count < zone.target) this._trySpawn(zone);
    }
  }

  _countInZone(zone) {
    return this._bm.npcs.filter(n =>
      n.alive && !n._departing &&
      n.y >= zone.yRange[0] && n.y <= zone.yRange[1]
    ).length;
  }

  _trySpawn(zone) {
    // 从 exitRegistry 里找 yZone 与 zone.yRange 有交集且 type 匹配的出口作为入口
    const candidates = this._exitReg._exits.filter(e => {
      if (!zone.exitTypes.includes(e.type)) return false;
      if (!e.yZone) return true;   // edge 出口 yZone=null → 全场通用
      return e.yZone[1] >= zone.yRange[0] && e.yZone[0] <= zone.yRange[1];
    });
    if (!candidates.length) return;

    const entry = candidates[Math.floor(Math.random() * candidates.length)];
    const npc   = this._spawn(entry, zone);
    if (!npc) return;

    const targetX = zone.xRange[0] + Math.random() * (zone.xRange[1] - zone.xRange[0]);
    const targetY = zone.yRange[0] + Math.random() * (zone.yRange[1] - zone.yRange[0]);

    npc._routeTarget = {
      x: targetX,
      y: targetY,
      abandonAfter: 60,
      onArrive: (n) => {
        n._routeTarget = null;
        setState(n, 'walk', 'entry_arrive');
      },
    };
    setState(npc, 'routing', 'entry');
  }
}
