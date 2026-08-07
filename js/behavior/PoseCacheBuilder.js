/**
 * PoseCacheBuilder — 从 ClipLibrary 自动构建 poseCache。
 *
 * 分类规则（读取 manifest.clips）：
 *   overlay + participants          → sub_event（任一 role 声明 skeleton 覆盖的
 *                                      跨骨架 duet 除外，如 human_pet_dog——
 *                                      TalkActivity 只配对人类，这类 clip 暂无
 *                                      消费者，不进这个池）
 *   id 以 "stall_" 开头             → stall_gestures（key 去掉 "stall_" 前缀）
 *   id 以 "talk_" 开头              → talk_gestures（key 去掉 "talk_" 前缀）
 *   overlay + latched               → held
 *   overlay + _front 变体存在        → trait（side+front 双视角）
 *   overlay（其余）                  → gesture（含 use_vending / use_trash）
 *   id === "chess"（cycle，特例）    → chess_move（单条 clip，供 ChessActivity 的
 *                                      ClipPlayer 消费落子手势，Patch F；不影响
 *                                      它作为 kind:'cycle' 的其余既有消费路径）
 */

/**
 * 同步构建 poseCache；调用前须确保所有相关 clip 已通过 clipLibrary.getClip() 缓存。
 * @param {import('../core/ClipLibrary.js').ClipLibrary} clipLibrary
 * @returns {{ held, gesture, sub_event, stall_gestures, talk_gestures, trait, chess_move }}
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
  let   chess_move     = null;

  for (const [id, entry] of Object.entries(clips)) {
    const raw = clipLibrary.getCachedClip(id);
    if (!raw) continue;
    if (raw.variant_of) continue;

    const { kind } = entry;

    if (kind === 'overlay') {
      if (raw.participants) {
        // 跨骨架 duet（某个 role 声明了非默认 skeleton，如 human_pet_dog 的
        // dog role）不进 sub_event 池：这个池唯一的消费者 TalkActivity 只配对
        // 两个人类 NPC，随机抽到时会把 human role 的低头蹲姿套到随机聊天对象
        // 身上（纯视觉 bug），dog role 的关节名在人类骨架里则直接找不到、被
        // 静默忽略；且 TalkActivity._selectSubEvent 选中的 type 直接拿去
        // emitEvent({kind:type})，未注册进 EventDefs.js 会在 emitEvent 里报错
        // （human_pet_dog 目前正是这个下场）。这类 clip 暂无真正消费者
        // （DogWalker.js 只有牵绳跟随，没有互动行为），先排除在外；等 owner-dog
        // 互动机制落地时再给它建专属入口，不必勉强塞进人对人的池子。
        if (!raw.participants.some(p => p.skeleton)) sub_event[id] = decodeSubEvent(raw);
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
    } else if (id === 'chess') {
      // 特例（Patch F）：chess 本体是 kind:'cycle'（npc.animation 的基座，落子间歇的
      // 待机站姿），但它的 19 帧每帧都显式声明全部 11 个关节、无省略——decodeGesture
      // 的 delta→绝对坐标公式对它同样成立，可以原样复用同一份 keyframes 喂给
      // ChessActivity 的 ClipPlayer（驱动"落子"手势覆盖全身关节）。不改 manifest
      // kind：cycle 的其余消费路径（groundTravel 推导、check-invariants Rule16 /
      // validate.mjs 的 cycle 专属校验）不受影响，只是多解码一份。
      chess_move = decodeGesture(raw);
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

  return { held, gesture, sub_event, stall_gestures, talk_gestures, trait, chess_move };
}
