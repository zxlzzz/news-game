/**
 * ClipLibrary — 单例资产库
 *
 * 统一读取 assets/manifest.json + assets/skeleton.json；
 * 提供 getClip(id)（懒加载 + 缓存）和 resolve(id)（转换为 StickRenderer 兼容格式）。
 *
 * 坐标语义: abs[j] = defaultPose[j] + keyframe_delta[j]
 * Variant:  delta 乘以 amp，从 variant_of 的 keyframes 展开
 */

// 旧 animKey → manifest clip id（维持 stickRenderer.loadAnimation 调用点不变）
export const ANIM_MAP = {
  walk:            'walk',
  run:             'run',
  jog:             'jog',
  fall:            'fall',
  get_up:          'get_up',
  sit_bench:       'sit_bench',
  sit_ground:      'sit_ground',
  lie_bench:       'lie_bench',
  lie_ground:      'lie_ground',
  lean_wall:       'lean_wall',
  idle:            'stand',
  stand:           'stand',
  squat:           'squat',
  bike:            'bike',
  mobile:          'mobile',
  mobike:          'mobike',
  chess:           'chess',
  chess_onlookers: 'chess_onlookers',
  dogwalk:         'dog_walk',
};


class ClipLibrary {
  constructor() {
    this._manifest  = null;
    this._skeletons = null;
    this._cache     = {};   // id → raw JSON
    this._resolved  = {};   // id → resolved anim object
  }

  async init() {
    const [mRes, sRes] = await Promise.all([
      fetch('assets/manifest.json'),
      fetch('assets/skeleton.json'),
    ]);
    this._manifest  = await mRes.json();
    this._skeletons = (await sRes.json()).skeletons;
  }

  /** 返回原始 JSON；首次调用时 fetch，后续从缓存取。 */
  async getClip(id) {
    if (this._cache[id]) return this._cache[id];
    const entry = this._manifest?.clips[id];
    if (!entry) return null;
    try {
      const r = await fetch('assets/' + entry.path);
      if (!r.ok) { console.warn(`ClipLibrary: 404 ${entry.path}`); return null; }
      this._cache[id] = await r.json();
    } catch (e) {
      console.error(`ClipLibrary: failed to load ${id}`, e);
      return null;
    }
    return this._cache[id];
  }

  /** 同步读取已缓存的原始 JSON（须在 getClip 后调用）。 */
  getCachedClip(id) {
    return this._cache[id] ?? null;
  }

  /**
   * 将 manifest clip 转换为 StickRenderer.loadAnimation 接受的格式：
   * { frames, fps, frameCount, globalBend, skeleton, canonicalDirection,
   *   kind, activeJoints, latched, facing }
   *
   * 须在所有所需 clip 已 getClip 后调用（同步）。
   */
  resolve(id) {
    if (this._resolved[id]) return this._resolved[id];
    const entry = this._manifest?.clips[id];
    if (!entry) return null;

    const raw = this._cache[id];
    if (!raw) return null;

    // Variant clips：从 base clip 取 keyframes，按 amp 缩放 delta
    let kfs = raw.keyframes;
    let amp = 1;
    if (raw.variant_of) {
      const base = this._cache[raw.variant_of];
      if (!base) return null;
      kfs = base.keyframes;
      amp = raw.amp ?? 1;
    }

    const skelName = raw.skeleton ?? 'human';
    const dp       = this._skeletons?.[skelName]?.defaultPose ?? {};

    // 将 delta keyframes 展开为绝对坐标 frames
    const frames = (kfs ?? []).map(kf => {
      const frame = {};
      for (const [k, v] of Object.entries(kf)) {
        if (k === 'dur' || !Array.isArray(v) || v.length !== 2) continue;
        const base = dp[k] ?? [0, 0];
        frame[k] = [base[0] + v[0] * amp, base[1] + v[1] * amp];
      }
      // per-frame bend keys（透传）
      for (const k of Object.keys(kf)) {
        if (k.startsWith('_bend_')) frame[k] = kf[k];
      }
      return frame;
    });

    const fps = raw.fps ?? (kfs?.[0]?.dur ? Math.round(1 / kfs[0].dur) : 8);

    const result = {
      frames,
      fps,
      frameCount:         frames.length,
      globalBend:         raw.globalBend ?? {},
      skeleton:           skelName,
      canonicalDirection: raw.canonicalDirection ?? 1,
      kind:               raw.kind,
      activeJoints:       raw.activeJoints ?? null,
      latched:            raw.latched ?? false,
      facing:             raw.facing ?? null,
    };

    this._resolved[id] = result;
    return result;
  }

  get manifest()  { return this._manifest; }
  get skeletons() { return this._skeletons; }
}

export const clipLibrary = new ClipLibrary();
