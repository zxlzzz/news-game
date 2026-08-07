/**
 * PoseCacheBuilder — 从 ClipLibrary 自动构建 poseCache。
 *
 * 分类规则（读取 manifest.clips）：
 *   overlay + participants          → sub_event
 *   id 以 "stall_" 开头             → stall_gestures（key 去掉 "stall_" 前缀）
 *   id 以 "talk_" 开头              → talk_gestures（key 去掉 "talk_" 前缀）
 *   overlay + latched               → held
 *   overlay + _front 变体存在        → trait（side+front 双视角）
 *   overlay（其余）                  → gesture（含 use_vending / use_trash）
 */

/**
 * 同步构建 poseCache；调用前须确保所有相关 clip 已通过 clipLibrary.getClip() 缓存。
 * @param {import('../core/ClipLibrary.js').ClipLibrary} clipLibrary
 * @returns {{ held, gesture, sub_event, stall_gestures, talk_gestures, trait }}
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
    const kfs   = rawJson.keyframes ?? [];
    const roles = rawJson.participants.map(p => p.role);

    function decodeRolePose(kf) {
      const joints = {};
      for (const [j, v] of Object.entries(kf)) {
        if (Array.isArray(v)) joints[j] = abs(j, v);
      }
      return joints;
    }

    // 每 role 的水平站位偏移相对 role 0（隐式 dx=0）。单位是骨架单位——编辑器坐标与骨架
    // 坐标同一空间，dx 就是 clip 关节坐标那把尺子，不需要换算就能直接比较；role 1 缺省时
    // 沿用编辑器默认间距 70（sth/stick-puppet/js/app.js DUET_DEFAULT_DX，同样是骨架单位）。
    // 消费侧（TalkActivity._startSubEvent）落到世界坐标前必须乘 npc.scale——designGap 本身
    // 不是世界像素，U-1 之前 TalkActivity 曾把它直接当 world px 用，是错的（见该文件注释）。
    const designGap = rawJson.participants[1]?.dx ?? 70;

    // 帧 key 保留原始 role 名（不翻译成 a/b）——TalkActivity 按 roles[0]/roles[1] 的
    // 实际字符串去取，同一份数据可以驱动任意 role 命名的 duet clip
    const frames = kfs.map(kf => {
      const frame = { dur: typeof kf.dur === 'number' ? kf.dur : undefined };
      for (const role of roles) frame[role] = decodeRolePose(kf[role] ?? {});
      return frame;
    });

    // reach/release 由 clip 自带（可选），TalkActivity 读取时缺省回退 0.4；sustain 同理归一成布尔
    return { ...rawJson, frames, roles, sustain: rawJson.sustain === true, designGap };
  }

  const held           = {};
  const gesture        = {};
  const sub_event      = {};
  const stall_gestures = {};
  const talk_gestures  = {};

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
      } else if (id.startsWith('talk_')) {
        const key = id.slice('talk_'.length);
        talk_gestures[key] = decodeGesture(raw);
      } else if (raw.latched) {
        held[id] = decodeHeld(raw);
      } else if (clipIds.has(id + '_front')) {
        // trait overlay: handled separately in trait loop below
      } else {
        gesture[id] = decodeGesture(raw);
      }
    }
  }

  const trait = {};
  for (const [id, entry] of Object.entries(clips)) {
    if (entry.kind !== 'overlay') continue;
    const raw = clipLibrary.getCachedClip(id);
    if (!raw) continue;
    if (raw.participants || id.startsWith('stall_') || id.startsWith('talk_') || raw.latched || id.endsWith('_front')) continue;
    if (!clipIds.has(id + '_front')) continue;
    const frontRaw = clipLibrary.getCachedClip(id + '_front');
    trait[id] = { side: decodeHeld(raw), front: decodeHeld(frontRaw) };
  }

  return { held, gesture, sub_event, stall_gestures, talk_gestures, trait };
}
