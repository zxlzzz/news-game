/**
 * PoseCacheBuilder — 从 ClipLibrary 自动构建 poseCache。
 *
 * 分类规则（读取 manifest.clips）：
 *   overlay + participants              → sub_event
 *   id 以 "stall_" 开头                → stall_gestures（key 去掉 "stall_" 前缀）
 *   overlay + latched + {id}_front 存在 → trait（side + front 对）
 *   overlay + latched                  → held
 *   overlay（其余）                     → gesture（含 use_vending / use_trash）
 *   cycle + id 以 "loiter_" 开头       → loiter
 *
 * delta 解码公式：body_rel[j] = dp[j] + kf[j] - dp.body
 *   dp = defaultPose.human, dp.body = [0, -82]
 */

/**
 * 同步构建 poseCache；调用前须确保所有相关 clip 已通过 clipLibrary.getClip() 缓存。
 * @param {import('../core/ClipLibrary.js').ClipLibrary} clipLibrary
 * @returns {{ held, trait, gesture, loiter, sub_event, stall_gestures }}
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

  function decodeLoiter(rawJson) {
    if (!rawJson) return {};
    const kf0 = rawJson.keyframes?.[0] ?? {};
    const out = {};
    for (const [j, v] of Object.entries(kf0)) {
      if (j === 'dur' || !Array.isArray(v)) continue;
      out[j] = abs(j, v);
    }
    return out;
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

  const held          = {};
  const trait         = {};
  const gesture       = {};
  const loiter        = {};
  const sub_event     = {};
  const stall_gestures = {};

  // IDs whose _front variant marks them as trait (don't process them as standalone held)
  const traitFrontIds = new Set();
  for (const id of clipIds) {
    if (id.endsWith('_front')) {
      const sideId = id.slice(0, -6);
      const raw    = clipLibrary.getCachedClip(sideId);
      if (raw?.latched) traitFrontIds.add(id);
    }
  }

  for (const [id, entry] of Object.entries(clips)) {
    // Skip _front variants of trait pairs (processed below alongside side)
    if (traitFrontIds.has(id)) continue;
    // Skip variant clips (no pose contribution)
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
      } else if (raw.latched && clipIds.has(id + '_front')) {
        // Trait: side = this clip, front = {id}_front
        const frontRaw = clipLibrary.getCachedClip(id + '_front');
        trait[id] = {
          side:  decodeHeld(raw),
          front: decodeHeld(frontRaw),
        };
      } else if (raw.latched) {
        held[id] = decodeHeld(raw);
      } else {
        gesture[id] = decodeGesture(raw);
      }
    } else if (kind === 'cycle' && id.startsWith('loiter_')) {
      loiter[id] = decodeLoiter(raw);
    }
  }

  // Aliases for profile keys that reference old "moving" gesture names
  if (!gesture.moving_check_watch && gesture.check_watch)
    gesture.moving_check_watch = gesture.check_watch;
  if (!gesture.moving_wipe_sweat && gesture.wipe_sweat)
    gesture.moving_wipe_sweat = gesture.wipe_sweat;

  return { held, trait, gesture, loiter, sub_event, stall_gestures };
}
