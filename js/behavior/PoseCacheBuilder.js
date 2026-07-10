/**
 * PoseCacheBuilder — 从 ClipLibrary 自动构建 poseCache。
 *
 * 分类规则（读取 manifest.clips）：
 *   overlay + participants          → sub_event
 *   id 以 "stall_" 开头             → stall_gestures（key 去掉 "stall_" 前缀）
 *   overlay + latched               → held
 *   overlay + _front 变体存在        → trait（side+front 双视角）
 *   overlay（其余）                  → gesture（含 use_vending / use_trash）
 */

/**
 * 同步构建 poseCache；调用前须确保所有相关 clip 已通过 clipLibrary.getClip() 缓存。
 * @param {import('../core/ClipLibrary.js').ClipLibrary} clipLibrary
 * @returns {{ held, gesture, sub_event, stall_gestures, trait }}
 */
export function buildPoseCache(clipLibrary) {
  const clips   = clipLibrary.manifest?.clips ?? {};
  const dp      = clipLibrary.skeletons?.human?.defaultPose ?? {};
  const clipIds = new Set(Object.keys(clips));

  function abs(j, kfDelta) {
    const base = dp[j] ?? [0, 0];
    return [base[0] + kfDelta[0], base[1] + kfDelta[1]];
  }

  function decodeHeld(rawJson) {
    if (!rawJson) return null;
    const kf0 = rawJson.keyframes?.[0] ?? {};
    const joints = {};
    for (const [j, v] of Object.entries(kf0)) {
      if (j === 'dur' || !Array.isArray(v)) continue;
      joints[j] = abs(j, v);
    }
    return { ...rawJson, joints };
  }

  function decodeGesture(rawJson) {
    if (!rawJson) return null;
    return { ...rawJson, keyframes: (rawJson.keyframes ?? []).map(kf => {
      const out = { dur: kf.dur ?? 0.15 };
      for (const [k, v] of Object.entries(kf)) {
        if (k === 'dur' || !Array.isArray(v)) continue;
        out[k] = abs(k, v);
      }
      return out;
    })};
  }

  function decodeSubEvent(rawJson) {
    if (!rawJson || !rawJson.participants) return null;
    const kf0   = rawJson.keyframes?.[0] ?? {};
    const roles = rawJson.participants.map(p => p.role);
    const aDelta = {}, bDelta = {};
    for (const [j, v] of Object.entries(kf0[roles[0]] ?? {})) {
      if (Array.isArray(v)) aDelta[j] = abs(j, v);
    }
    for (const [j, v] of Object.entries(kf0[roles[1]] ?? {})) {
      if (Array.isArray(v)) bDelta[j] = abs(j, v);
    }
    return { ...rawJson, aDelta, bDelta };
  }

  const held           = {};
  const gesture        = {};
  const sub_event      = {};
  const stall_gestures = {};

  for (const [id, entry] of Object.entries(clips)) {
    const raw = clipLibrary.getCachedClip(id);
    if (!raw) continue;
    if (raw.variant_of) continue;

    const { kind } = entry;

    if (kind === 'overlay') {
      if (raw.participants) {
        sub_event[id] = decodeSubEvent(raw);
      } else if (id.startsWith('stall_')) {
        const key = id.slice('stall_'.length);
        stall_gestures[key] = decodeGesture(raw);
      } else if (raw.latched) {
        held[id] = decodeHeld(raw);
      } else if (clipIds.has(id + '_front')) {
        // trait overlay: handled separately in trait loop below
      } else {
        gesture[id] = decodeGesture(raw);
      }
    }
  }

  // Aliases for profile keys that reference old "moving" gesture names
  if (!gesture.moving_check_watch && gesture.check_watch)
    gesture.moving_check_watch = gesture.check_watch;
  if (!gesture.moving_wipe_sweat && gesture.wipe_sweat)
    gesture.moving_wipe_sweat = gesture.wipe_sweat;

  const trait = {};
  for (const [id, entry] of Object.entries(clips)) {
    if (entry.kind !== 'overlay') continue;
    const raw = clipLibrary.getCachedClip(id);
    if (!raw) continue;
    if (raw.participants || id.startsWith('stall_') || raw.latched || id.endsWith('_front')) continue;
    if (!clipIds.has(id + '_front')) continue;
    const frontRaw = clipLibrary.getCachedClip(id + '_front');
    trait[id] = { side: decodeHeld(raw), front: decodeHeld(frontRaw) };
  }

  return { held, gesture, sub_event, stall_gestures, trait };
}
