/**
 * ActivityRegistry — Activity 工厂注册表（独立文件，防循环依赖）
 *
 * Activity 文件 import registerActivity 并自注册；
 * SocialLayer import getRegistry 查找工厂。
 *
 * 每条注册项：{ factory, onSlotArrival }
 *   factory(id, participants, props, type, meta) → Activity
 *     meta（Patch G 新增，可选）：createActivity() 第 4 参原样透传，供工厂需要
 *     "参与者/道具之外的额外数据"时使用——如 ContactActivity 用 meta.clip 指定
 *     播哪条 sub_event clip（Activity type 是 'contact' 这个大类，具体播哪条
 *     interaction 靠 meta 区分，不必每条 clip 各注册一个 Activity type）。
 *   onSlotArrival(npc, prop, slot, socialLayer) — 可选，替代 SocialLayer 默认逻辑
 */

const REGISTRY = {};

export function registerActivity(type, factory, opts = {}) {
  REGISTRY[type] = { factory, onSlotArrival: opts.onSlotArrival ?? null };
}

export function getRegistry() {
  return REGISTRY;
}
