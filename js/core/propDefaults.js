/**
 * propDefaults — 道具类型级默认值权威
 *
 * CONTRACT:
 *   - 每个 propType 的 tags、smartDef（以及多数类型的 w/h/facing）在此统一定义。
 *   - scene.json 实例行只保留几何（x/y，以及与类型默认不同的 w/h/color）。
 *   - sceneData.js#expandSceneData 负责将此表合并到展开后的 prop 对象。
 */

const USE_TRASH = {
  activityType: 'use_trash',
  gestureId:    'use_trash',
  phaseLabel:   'throwing_trash',
  slots: [{ role: 'user', dx: 0, dy: 12 }],
};

const USE_VENDING = {
  activityType: 'use_vending',
  gestureId:    'use_vending',
  phaseLabel:   'buying',
  slots: [{ role: 'user', dx: 0, dy: 16 }],
};

const STALL_DEF = {
  activityType: 'stall',
  routing: [{
    activityFlag: 'stall_buyer',
    role:         'buyer',
    chance:       0.003,
    radius:       220,
    requireOccupied: true,
  }],
  slots: [
    { role: 'seller', dx: 0, dy: -6 },
    { role: 'buyer',  dx: 0, dy:  18 },
  ],
};

export const PROP_DEFAULTS = {
  lamp:       { w: 14, h: 14, tags: [] },
  trash:      { w: 14, h: 14, tags: [], smartDef: USE_TRASH },
  newsrack:   { w: 14, h: 18, tags: [] },
  hydrant:    { w: 10, h: 14, tags: [] },
  mailbox:    { w: 12, h: 18, tags: [] },
  planter:    {        h: 10, tags: [] },
  manhole:    { w: 85, h: 10, tags: [] },
  drain:      { w: 72, h:  6, tags: [] },
  sign:       { w: 22, h: 14, tags: [] },
  vending:    { w: 76, h: 28, tags: [], smartDef: USE_VENDING },
  phonebooth: { w: 76, h: 34, tags: [] },
  fountain:   { w: 479, h: 80, tags: [] },
  stall:      {              tags: [], smartDef: STALL_DEF },
  bench:      { w: 80, h: 12, tags: ['seatable'], facing: 'down' },
};

/**
 * PROP_DEPTH — 道具进深默认值（O-3 起）。
 *
 * 进深（depth，前后方向的世界长度）是道具转 drawObliqueBox 时才引入的新维度——
 * 之前的扁平画法没有这个量，没有历史数据可继承，只能给每个 propType 估一个
 * 合理值。铁律：值写在这里，不要写死在各自 draw 函数内部（O-4 tasks.md 原文）。
 * 键 = propType（与 registerProp() 的 type 一致）。骨架单位，未乘 prop.scale——
 * 消费者自己乘（同全库其余长度常数的换算约定，见 CLAUDE.md「长度量纲」）。
 *
 * O-3 目前只有 bench 一条（O-3 的三个样板之一）；其余道具的进深随 O-4 批量
 * 转换逐个补上。跟上面 PROP_DEFAULTS 分开一张表，因为语义不同——PROP_DEFAULTS
 * 是 scene.json 展开期的类型默认值权威（w/h/tags/smartDef 等，被
 * expandSceneData 合并进实例），PROP_DEPTH 是渲染期 draw 函数消费的画风常量，
 * 两者生命周期和消费者都不一样，不共用一张表。
 */
export const PROP_DEPTH = {
  bench: 60,
};
