/**
 * ClipLibrary — 单例资产库
 *
 * 统一读取 assets/manifest.json + assets/skeleton.json；
 * 提供 getClip(id)（懒加载 + 缓存）和 resolve(id)（转换为 StickRenderer 兼容格式）。
 *
 * 坐标语义: abs[j] = defaultPose[j] + keyframe_delta[j]
 * Variant:  delta 乘以 amp，从 variant_of 的 keyframes 展开
 */

// 骑乘类 cycle clip：脚部接触点经由车辆，不做地面接触断言
const MOUNTED_CLIPS = ['bike', 'mobike', 'mobile'];

// ── L-2: groundTravel 自动推导裁决表 ─────────────────────────────────────────
// GROUND_TOL：贴地判据容差（骨架单位），相对画布地面线 y=0（铁律：关节空间 y=0=地面），
//   不是相对"该 clip 实际达到的最大 y"——后者会被单帧 1~2 单位的入地噪声（如 run.json
//   某帧脚下探到 y=2）带偏整条 clip 的贴地基准，见 roadmap.md L-2 记录的实测。
// DISPLACEMENT_MIN：推导总量绝对值低于此值判定为非位移循环（stand/sit/chess 等），
//   保持时间驱动——这是判据，不是兜底（见 resolve() 内联注释）。
// CONSISTENCY_MAX_DIFF：左右支撑脚各自总位移的相对偏差上限，超过判定 clip 缺陷并抛出。
const GROUND_DERIVE_RULES = {
  groundTol:          1,     reason: '贴地判据容差（骨架单位，相对 y=0）',
  displacementMin:    8,     reason: '推导量绝对值小于此值 → 非位移循环，保持时间驱动',
  consistencyMaxDiff: 0.2,   reason: '左右支撑脚总位移相对偏差上限，超过判定 clip 缺陷',
};

/** 关节名 → 'left' | 'right' | null（按现有骨架命名约定：l_、fl_、bl_ 开头为左，r_、fr_、br_ 开头为右） */
function _jointSide(name) {
  if (/^l_|^fl_|^bl_/.test(name)) return 'left';
  if (/^r_|^fr_|^br_/.test(name)) return 'right';
  return null;
}

/**
 * 自动推导 groundTravel（骨架单位/循环）。逐帧转场取贴地关节（y 与地面线 y=0 之差
 * 在 GROUND_DERIVE_RULES.groundTol 内）中 Δx 最小值（最负者，即真正的支撑脚——
 * 摆动腿即便短暂贴近地面也是向前甩，Δx 非负或更小的负值），沿循环各转场累加。
 * 帧 n-1 → 帧 0 的收尾转场一并计入（cycle 语义：末帧直接接回首帧，无需额外一帧）。
 *
 * 一致性判据：按贡献来源的关节名分左右分别累加，相对偏差超
 * GROUND_DERIVE_RULES.consistencyMaxDiff 视为 clip 缺陷并抛出——这一判据只在
 * "推导判定为位移循环"（|sumMin| ≥ displacementMin）时才生效，非位移循环不检查
 * 左右一致性（chess 等 clip 的单侧噪声不构成缺陷）。
 * 抛出时机早于 check-invariants 的同判据静态门（新规则见 scripts/check-invariants.mjs），
 * 运行时抛出因此永远先被静态门拦下。
 */
function _deriveGroundTravel(id, frames) {
  const { groundTol, displacementMin, consistencyMaxDiff } = GROUND_DERIVE_RULES;
  const n = frames.length;
  let sumMin = 0;
  const perJoint = {};
  for (let i = 0; i < n; i++) {
    const f0 = frames[i], f1 = frames[(i + 1) % n];
    let best = null, bestJ = null;
    for (const [j, coords] of Object.entries(f0)) {
      if (!Array.isArray(coords) || Math.abs(coords[1]) > groundTol) continue;
      const f1c = f1[j];
      if (!Array.isArray(f1c)) continue;
      const dx = f1c[0] - coords[0];
      if (best === null || dx < best) { best = dx; bestJ = j; }
    }
    if (best !== null) {
      sumMin += best;
      perJoint[bestJ] = (perJoint[bestJ] ?? 0) + best;
    }
  }

  const travel = Math.abs(sumMin);
  if (travel < displacementMin) return null;   // 非位移循环 → 时间驱动（判据，非兜底）

  let left = 0, right = 0;
  for (const [j, v] of Object.entries(perJoint)) {
    const side = _jointSide(j);
    if (side === 'left') left += v;
    else if (side === 'right') right += v;
  }
  if (left !== 0 && right !== 0) {
    const mags    = [Math.abs(left), Math.abs(right)];
    const relDiff = Math.abs(mags[0] - mags[1]) / Math.max(...mags);
    if (relDiff > consistencyMaxDiff) {
      throw new Error(
        `[ClipLibrary] ${id}: 左右支撑脚位移不一致（left=${left.toFixed(1)}, ` +
        `right=${right.toFixed(1)}，偏差 ${(relDiff * 100).toFixed(0)}% > ` +
        `${(consistencyMaxDiff * 100).toFixed(0)}%）— clip 数据缺陷，需重画或显式声明 groundTravel`
      );
    }
  }
  return travel;
}

/**
 * 累积时间表（L-2 item 6）：过去 fps 只取 keyframes[0].dur 算出一个全局 fps，
 * 后续每帧各自的 dur 值在展开阶段被丢弃（resolve() 的 frame 构建循环里
 * `k === 'dur'` 直接 continue）。这里改为保留每帧 dur（缺省退回 1/fps 使旧 clip
 * 行为不变——现存 clip 的 dur 全部同值，此表退化为等分circle，不影响现有播放），
 * 产出 frameCumFrac[i] = 该帧开始前占循环的累积占比，供距离驱动相位查表用
 * （Npc.js#_frameFromPhase）。时间驱动路径（Npc.js 未改的 fps 分支）不消费这张表。
 */
function _buildFrameCumFrac(kfs, fps, frameCount) {
  const durs = [];
  for (let i = 0; i < frameCount; i++) durs.push(kfs?.[i]?.dur ?? (1 / fps));
  const total = durs.reduce((a, b) => a + b, 0) || frameCount;
  const cum = [];
  let acc = 0;
  for (let i = 0; i < frameCount; i++) {
    cum.push(acc / total);
    acc += durs[i];
  }
  return cum;
}

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
      // 补全 keyframe 中省略的关节（零 delta 不写入磁盘约定）
      for (const [k, v] of Object.entries(dp)) {
        if (!(k in frame)) frame[k] = [...v];
      }
      return frame;
    });

    const fps = raw.fps ?? (kfs?.[0]?.dur ? Math.round(1 / kfs[0].dur) : 8);

    // groundTravel（L-2）：仅 cycle clip 参与；JSON 显式声明优先，未声明则自动推导。
    // MOUNTED_CLIPS（脚在踏板上，无法推导地面接触）与 walk_front（水平位移为零，
    // 无法从脚数据推出）均落在"显式声明"分支，不进入自动推导。
    let groundTravel = null;
    if (entry.kind === 'cycle') {
      groundTravel = (typeof raw.groundTravel === 'number')
        ? raw.groundTravel
        : _deriveGroundTravel(id, frames);
    }

    const result = {
      frames,
      fps,
      frameCount:         frames.length,
      globalBend:         raw.globalBend ?? {},
      skeleton:           skelName,
      canonicalDirection: raw.canonicalDirection ?? 1,
      kind:               entry.kind,
      activeJoints:       raw.activeJoints ?? null,
      latched:            raw.latched ?? false,
      facing:             entry.facing ?? null,
      groundTravel,
      frameCumFrac:       _buildFrameCumFrac(kfs, fps, frames.length),
    };

    if (entry.kind === 'cycle' && !MOUNTED_CLIPS.includes(id)) {
      let maxY = -Infinity;
      for (const frame of frames) {
        for (const coords of Object.values(frame)) {
          if (Array.isArray(coords) && coords.length >= 2) maxY = Math.max(maxY, coords[1]);
        }
      }
      if (maxY > 5 || maxY < -5) {
        console.warn(`[ClipLibrary] ${id} 地面接触偏移 ${maxY}，应≈0`);
      }
    }

    this._resolved[id] = result;
    return result;
  }

  get manifest()  { return this._manifest; }
  get skeletons() { return this._skeletons; }
}

export const clipLibrary = new ClipLibrary();
