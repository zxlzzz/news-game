/**
 * ActivityRegistry — Activity 工厂注册表（独立文件，防循环依赖）
 *
 * Activity 文件 import registerActivity 并自注册；
 * SocialLayer import getRegistry 查找工厂。
 *
 * 每条注册项：{ factory, onSlotArrival }
 *   factory(id, participants, props, type) → Activity
 *   onSlotArrival(npc, prop, slot, socialLayer) — 可选，替代 SocialLayer 默认逻辑
 */

const REGISTRY = {};

export function registerActivity(type, factory, opts = {}) {
  REGISTRY[type] = { factory, onSlotArrival: opts.onSlotArrival ?? null };
}

export function getRegistry() {
  return REGISTRY;
}
