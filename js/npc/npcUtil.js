/**
 * NPC 工厂工具
 * 所有 spawn 模块共用，统一注入 renderer、默认 minY/maxY，并随机初始帧。
 */

import { NPC }          from './Npc.js';
import { FAR_Y, NEAR_Y, WORLD_HEIGHT, WORLD_WIDTH } from '../core/Layout.js';

/**
 * 创建 NPC 并注册到 EntityManager
 * @param {EntityManager}  em
 * @param {StickRenderer}  sr
 * @param {object}         cfg  — NPC 构造参数（renderer 可省略）
 * @returns {NPC}
 */
export function makeNPC(em, sr, cfg) {
  cfg.renderer = sr;
  // Y 边界默认值由 Npc 构造器提供（BUILDING_BASE_Y..460）；此处禁止再注入马路带默认
  const n = new NPC(cfg);
  n.frameIndex = Math.floor(Math.random() * (sr.getAnimation(cfg.animation)?.frameCount || 8));

  // 出生点守卫：仅当 cfg 明确提供四边界时检查，避免默认宽边界 NPC 误报。
  // 防止编程错误：出生坐标超出声明活动范围（如近端跑者 y=508 > default maxY=460）。
  // 世界范围外的出生点由 PathPlanner 起点吸附兜底，不在此拦截
  if (cfg.minX !== undefined && cfg.maxX !== undefined &&
      cfg.minY !== undefined && cfg.maxY !== undefined &&
      n.x >= 0 && n.x <= WORLD_WIDTH && n.y >= 0 && n.y <= WORLD_HEIGHT) {
    if (n.x < n.minX || n.x > n.maxX || n.y < n.minY || n.y > n.maxY) {
      throw new Error(
        `makeNPC: 出生点 (${n.x}, ${n.y}) 超出声明 bounds ` +
        `[${n.minX}..${n.maxX}] × [${n.minY}..${n.maxY}]` +
        (cfg.tags ? `  tags=${JSON.stringify(cfg.tags)}` : '')
      );
    }
  }

  return em.add(n);
}
