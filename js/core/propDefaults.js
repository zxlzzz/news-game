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
