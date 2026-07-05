/**
 * PoseCacheBuilder — 从 JSON 资产构建 poseCache 的单一入口。
 *
 * MANIFEST 驱动资产路径和 wrap 逻辑：
 *   - 新增 held pose：MANIFEST.held 加名字 + 放 JSON，完毕。
 *   - 新增 trait：MANIFEST.trait 加名字 + 放 front/side JSON，完毕。
 *   - 新增 gesture：MANIFEST.gesture.static 或 .moving 加条目 + 放 JSON，完毕。
 *
 * 路径规则：
 *   held       → assets/animations/held pose/{name}.json
 *   trait      → assets/animations/trait/front/{name}.json 和 trait/side/{name}.json
 *   gesture.static → assets/animations/gesture/static/{name}.json  （可加 name:path 覆盖路径）
 *   gesture.moving → assets/animations/gesture/moving/{file}.json  （格式 file:key）
 *   loiter     → assets/animations/base/loiter/{name}.json
 *   sub_event  → assets/animations/sub_event/{name}.json
 *   stall      → assets/animations/gesture/static/stall/{seller|buyer}/{name}.json
 *
 * delta 基准 body[-1, 12]：held/trait/loiter/gesture 的所有关节值均以此偏移归零。
 */

const MANIFEST = {
  held:    ['phone_call', 'phone_look', 'smoke', 'cross_arm', 'hands_in_pocket'],
  trait:   ['hold_bag', 'walk_dog', 'umbrella'],
  gesture: {
    // 条目格式：'name' 或 'name:custom/path'（覆盖默认 gesture/static/ 前缀）
    static: ['check_watch', 'stretch', 'yawn', 'look_around', 'adjust_clothes', 'wave:gesture/wave'],
    // 条目格式：'file:key'，文件在 gesture/moving/{file}，缓存键为 key
    moving: ['check_watch:moving_check_watch', 'wipe_sweat:moving_wipe_sweat'],
  },
  loiter:    ['phone', 'bag_a', 'bag_b'],
  sub_event: ['push', 'give_item', 'handshake', 'point_at', 'use_vending', 'use_trash'],
  stall: {
    seller: ['give', 'tidy', 'call'],
    buyer:  ['give_get', 'point'],
  },
};

/**
 * 返回 [[cacheKey, filePath], ...] 供 StreetScene.preload() 使用。
 * cacheKey 不含 'pose_' 前缀（preload 自行加）。
 */
export function getManifestPaths() {
  const pairs = [];

  for (const n of MANIFEST.held)
    pairs.push([`held_${n}`, `held pose/${n}`]);

  for (const n of MANIFEST.trait) {
    pairs.push([`trait_${n}`,      `trait/front/${n}`]);
    pairs.push([`trait_${n}_side`, `trait/side/${n}`]);
  }

  for (const entry of MANIFEST.gesture.static) {
    const [name, path] = entry.includes(':') ? entry.split(':') : [entry, `gesture/static/${entry}`];
    pairs.push([`gesture_${name}`, path]);
  }

  for (const entry of MANIFEST.gesture.moving) {
    const [file, key] = entry.split(':');
    pairs.push([`gesture_${key}`, `gesture/moving/${file}`]);
  }

  for (const n of MANIFEST.loiter)
    pairs.push([`loiter_${n}`, `base/loiter/${n}`]);

  for (const n of MANIFEST.sub_event)
    pairs.push([`sub_event_${n}`, `sub_event/${n}`]);

  for (const n of MANIFEST.stall.seller)
    pairs.push([`stall_seller_${n}`, `gesture/static/stall/seller/${n}`]);

  for (const n of MANIFEST.stall.buyer)
    pairs.push([`stall_buyer_${n}`, `gesture/static/stall/buyer/${n}`]);

  return pairs;
}

/**
 * 构建 poseCache 对象。
 * @param {function(string): object|null} jsonGetter - 接受裸 cacheKey（不含 'pose_' 前缀），返回解析后的 JSON
 */
export function buildPoseCache(jsonGetter) {
  const g = jsonGetter;
  const B = [-1, 12];   // body 关节基准偏移，delta 归零用

  const wrapHeld = (json) => {
    if (!json) return null;
    const joints = json.joints ?? json.frames?.[0] ?? json;
    const out = {};
    for (const [j, v] of Object.entries(joints)) out[j] = [v[0] - B[0], v[1] - B[1]];
    return { ...json, joints: out };
  };

  const wrapGesture = (json) => {
    if (!json) return null;
    return { ...json, keyframes: (json.keyframes ?? []).map(kf => {
      const out = { dur: kf.dur };
      for (const [k, v] of Object.entries(kf)) if (k !== 'dur') out[k] = [v[0] - B[0], v[1] - B[1]];
      return out;
    })};
  };

  const wrapLoiter = (json) => {
    if (!json) return {};
    const joints = json.joints ?? json;
    const out = {};
    for (const [j, v] of Object.entries(joints)) out[j] = [v[0] - B[0], v[1] - B[1]];
    return out;
  };

  // held
  const held = {};
  for (const n of MANIFEST.held) held[n] = wrapHeld(g(`held_${n}`));

  // trait（front + side 变体）
  const trait = {};
  for (const n of MANIFEST.trait) {
    trait[n] = {
      front: wrapHeld(g(`trait_${n}`)),
      side:  wrapHeld(g(`trait_${n}_side`)),
    };
  }

  // gesture（static + moving 合并到同一 dict）
  const gesture = {};
  for (const entry of MANIFEST.gesture.static) {
    const name = entry.split(':')[0];
    gesture[name] = wrapGesture(g(`gesture_${name}`));
  }
  for (const entry of MANIFEST.gesture.moving) {
    const key = entry.split(':')[1];
    gesture[key] = wrapGesture(g(`gesture_${key}`));
  }

  // loiter
  const loiter = {};
  for (const n of MANIFEST.loiter) loiter[n] = wrapLoiter(g(`loiter_${n}`));

  // sub_event（原始 JSON，无 wrap）
  const sub_event = {};
  for (const n of MANIFEST.sub_event) sub_event[n] = g(`sub_event_${n}`);

  // stall_gestures
  const stall_gestures = {};
  for (const n of MANIFEST.stall.seller) stall_gestures[`seller_${n}`] = wrapGesture(g(`stall_seller_${n}`));
  for (const n of MANIFEST.stall.buyer)  stall_gestures[`buyer_${n}`]  = wrapGesture(g(`stall_buyer_${n}`));

  return { held, trait, gesture, loiter, sub_event, stall_gestures };
}
