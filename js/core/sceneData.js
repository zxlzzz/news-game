/**
 * sceneData — 场景 JSON 展开器
 *
 * CONTRACT:
 *   - expandSceneData(raw) 是无副作用纯函数，无 PIXI 依赖，可在 headless 环境调用。
 *   - 输入：compact scene.json（buildings 用 kind 字段，props 按类型分组，trees 为紧凑数组）。
 *   - 输出：与旧版 scene.json 结构等价，SceneInitializer.js 零改动即可消费。
 *
 * 公交站几何常量（FAR_STOP / NEAR_STOP）是单一真相来源；
 * busstop.js#spawnBusStop 的命名常量必须与此保持同步。
 */

import { KIND_TAGS }      from '../entity/building/buildingKinds.js';
import { PROP_DEFAULTS }  from './propDefaults.js';

// ── 公交站几何常量 ──────────────────────────────────────────────────────────────
// direction > 0 → 远侧（far）；direction < 0 → 近侧（near / 公园侧）
const FAR_STOP = {
  roofW: 818, roofH: 26, pillarOffset: 366, bayW: 202, bayD: 9,
  sign: { dx: 106 },
};
const NEAR_STOP = {
  roofW: 812, roofH: 19, pillarOffset: 364, bayW: 266, bayD: 9,
  sign: { dx: 138 },
};

// ── 主入口 ──────────────────────────────────────────────────────────────────────
export function expandSceneData(raw) {
  return {
    buildings: _expandBuildings(raw.buildings ?? []),
    props:     _expandProps(raw.props ?? {}),
    layout:    _expandLayout(raw.layout ?? {}),
  };
}

// ── 建筑展开 ────────────────────────────────────────────────────────────────────
function _expandBuildings(compact) {
  return compact.map(b => {
    const out = {
      x:          b.x,
      bWidth:     b.bWidth,
      bDepth:     b.bDepth,
      facadeH:    b.facadeH,
      waterTower: b.waterTower ?? false,
      solar:      b.solar      ?? false,
      billboard:  b.billboard  ?? false,
      color:      b.color      ?? '#808080',
      tags:       KIND_TAGS[b.kind] ?? ['building'],
    };
    if (b.door != null) out.door = b.door;
    return out;
  });
}

// ── 道具展开 ────────────────────────────────────────────────────────────────────
function _expandProps(groups) {
  const result = [];
  for (const [propType, group] of Object.entries(groups)) {
    const def = PROP_DEFAULTS[propType] ?? {};
    for (const item of (group.at ?? [])) {
      const ov = Array.isArray(item) ? { x: item[0], y: item[1] } : { ...item };

      const p = {
        propType,
        x:      ov.x,
        y:      ov.y,
        width:  ov.w  ?? group.w ?? def.w,
        height: ov.h  ?? group.h ?? def.h,
        tags:   ov.tags ?? def.tags ?? [],
      };

      if (def.facing != null) p.facing = ov.facing ?? def.facing;
      if (ov.color   != null) p.color = ov.color;

      // smartDef: instance override (including explicit null) wins over type default
      const sd = 'smartDef' in ov ? ov.smartDef : def.smartDef;
      if (sd != null) p.smartDef = sd;

      result.push(p);
    }
  }
  return result;
}

// ── 布局展开 ────────────────────────────────────────────────────────────────────
function _expandLayout(compact) {
  const { sidewalkTrees, parkTrees, busStops, ...rest } = compact;
  return {
    ...rest,
    sidewalkTrees: (sidewalkTrees ?? []).map(t =>
      Array.isArray(t) ? { x: t[0], y: t[1], r: t[2] } : t
    ),
    parkTrees: (parkTrees ?? []).map(t =>
      Array.isArray(t) ? { x: t[0], y: t[1], r: t[2] } : t
    ),
    busStops: (busStops ?? []).map(s => {
      const geo = s.direction > 0 ? FAR_STOP : NEAR_STOP;
      return { ...geo, ...s };
    }),
  };
}
