/**
 * Athletes — 健身人群
 * 每个 runner 沿 layout.walkPaths 里的一条路线往返/绕圈；
 * 巡逻边界（minX/maxX/minY/maxY）不再手抄路线包围盒，改为按 route waypoints 现算。
 */

import { resolveY } from '../core/Layout.js';
import { makeNPC } from './npcUtil.js';
import { setWalkMode } from '../behavior/Motor.js';
import { modePathFollow } from '../behavior/WalkMode.js';

function _parseColor(c) {
  return typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c;
}

/** route waypoints 包围盒 ± margin —— 路线数据只有 layout.walkPaths 一份来源，不再手抄 */
function _routeBounds(layout, routeKey, margin) {
  const route = layout.walkPaths?.[routeKey];
  if (!route) throw new Error(`Athletes: layout.walkPaths 缺少 route '${routeKey}'`);
  const xs = route.waypoints.map(p => p.x);
  const ys = route.waypoints.map(p => p.y);
  return {
    minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin,
    minY: Math.min(...ys) - margin, maxY: Math.max(...ys) + margin,
  };
}

export function spawnAthletes(em, sr, bm, layout, cfg) {
  for (const r of (cfg?.runners ?? [])) {
    const bounds = _routeBounds(layout, r.route, r.margin ?? 40);
    const jogger = makeNPC(em, sr, {
      x: r.spawnX, y: resolveY(r.spawnYBand), animation: 'jog',
      direction: r.direction, speed: r.speed, vy: 0,
      ...bounds,
      color: _parseColor(r.color), tags: ['jogger', 'athlete'],
    });
    bm.register(jogger, 'athlete');
    setWalkMode(jogger, modePathFollow(r.route));
  }
}
