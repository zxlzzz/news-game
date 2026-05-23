/**
 * NPC 工厂工具
 * 所有 spawn 模块共用，统一注入 renderer、默认 minY/maxY，并随机初始帧。
 */

import { NPC }          from '../NPC.js';
import { FAR_Y, NEAR_Y } from '../SceneConfig.js';

/**
 * 创建 NPC 并注册到 EntityManager
 * @param {EntityManager}  em
 * @param {StickRenderer}  sr
 * @param {object}         cfg  — NPC 构造参数（renderer 可省略）
 * @returns {NPC}
 */
export function makeNPC(em, sr, cfg) {
  cfg.renderer = sr;
  if (cfg.minY === undefined) cfg.minY = FAR_Y;
  if (cfg.maxY === undefined) cfg.maxY = NEAR_Y;
  const n = new NPC(cfg);
  n.frameIndex = Math.floor(Math.random() * (sr.getAnimation(cfg.animation)?.frameCount || 8));
  return em.add(n);
}
