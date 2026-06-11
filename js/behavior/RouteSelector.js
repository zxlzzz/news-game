/**
 * RouteSelector — 全局路线池
 *
 * 从 scene.json 的 routes 数组初始化，为行人 NPC 按权重 × 亲和度 × 密度折扣
 * 选取下一条路线并激活（setWalkMode）。
 *
 * 路线类型：
 *   path    — 沿预定义 waypoints 行走（注入 WALK_PATHS 并使用 modePathFollow）
 *   wander  — 在 bounds 矩形内随机游走（modeWander + maxDuration）
 */

import { setWalkMode, modeWander, modePathFollow, modeDirect, addWalkPath, planCrossing } from './WalkMode.js';
import { FAR_Y, NEAR_Y } from '../core/Layout.js';

function _needsCrossing(y1, y2) {
  return (y1 < FAR_Y && y2 >= NEAR_Y) || (y1 >= NEAR_Y && y2 < FAR_Y);
}

const rand = (a, b) => a + Math.random() * (b - a);

export class RouteSelector {
  constructor() {
    this._routes = [];
  }

  /** 从 scene.json routes 数组初始化；path 类型路线注入 WALK_PATHS */
  initRoutes(data) {
    if (!Array.isArray(data)) return;
    this._routes = data;
    for (const r of data) {
      if (r.type === 'path') {
        addWalkPath(r.id, { waypoints: r.waypoints, loop: r.loop ?? false });
      }
    }
  }

  /**
   * 按权重选取一条路线（排除当前路线，按密度折扣）。
   * @param {NPC}   npc
   * @param {NPC[]} allNpcs
   * @returns {object|null}
   */
  pickRoute(npc, allNpcs) {
    const npcType  = npc._profile?.name ?? 'pedestrian';
    const curId    = npc._currentRouteId;

    const weights = this._routes.map(r => {
      if (r.id === curId) return 0;
      const base     = r.weight ?? 1;
      const affinity = r.affinity?.[npcType] ?? 1.0;
      const count    = allNpcs.filter(n => n.alive && !n._departing && n._currentRouteId === r.id).length;
      const density  = Math.max(0.2, 1 - count / 6);
      return base * affinity * density;
    });

    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) return null;

    let r = Math.random() * total;
    for (let i = 0; i < this._routes.length; i++) {
      r -= weights[i];
      if (r <= 0) return this._routes[i];
    }
    return this._routes[this._routes.length - 1];
  }

  /**
   * 激活路线：若 NPC 距路线入口 > 40px 则先 modeDirect 过去再切路线；否则直接切。
   * @param {NPC}    npc
   * @param {object} route
   */
  startRoute(npc, route) {
    if (!route) return;
    npc._currentRouteId = route.id;
    npc._needsNewRoute  = false;

    if (route.type === 'path') {
      const entry = route.entry;
      const dist  = entry ? Math.hypot(npc.x - entry.x, npc.y - entry.y) : 0;
      if (dist > 40 && entry) {
        const startRoute = (n) => setWalkMode(n, modeDirect(entry, (n2) => {
          n2._currentRouteId = route.id;
          setWalkMode(n2, modePathFollow(route.id));
        }));
        if (_needsCrossing(npc.y, entry.y)) {
          planCrossing(npc, entry.y, npc._profile, startRoute);
        } else {
          startRoute(npc);
        }
      } else {
        setWalkMode(npc, modePathFollow(route.id));
      }
    } else if (route.type === 'wander') {
      const dur = route.duration
        ? rand(route.duration[0], route.duration[1])
        : null;
      setWalkMode(npc, modeWander(route.bounds ?? null, dur));
    }
  }

  /** 一步完成：选取 + 启动 */
  pickAndStart(npc, allNpcs) {
    const route = this.pickRoute(npc, allNpcs);
    this.startRoute(npc, route);
  }
}
