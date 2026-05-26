/**
 * Animator Debugger — NPC 动画状态机调试工具
 *
 * 数据来源：直接 import 游戏源文件，不硬编码任何 pose / profile 数据。
 *   - PROFILES        ← js/behavior/NpcProfile.js
 *   - HELD_POSES      ← js/behavior/PoseRegistry.js
 *   - LOITER_POSES    ← js/behavior/PoseRegistry.js
 *   - SUB_EVENT_POSES ← js/behavior/PoseRegistry.js
 *   - TRAIT_PROPS     ← js/behavior/PoseRegistry.js
 *
 * 编辑工作流：
 *   1. 在 "Pose Registry" 面板里修改关节坐标 → 预览立即更新
 *   2. 点 "Save PoseRegistry.js" → 浏览器文件选择器写回磁盘
 *      （或 fallback：复制到剪贴板 → 手动粘贴到文件）
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ── 游戏源文件 import（单一数据来源）──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

import { PROFILES as _PROFILES }
  from '../../../js/behavior/NpcProfile.js';
import { HELD_POSES, LOITER_POSES, SUB_EVENT_POSES, TRAIT_PROPS }
  from '../../../js/behavior/PoseRegistry.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ── 纯 UI 元数据（只用于工具显示，不进入游戏逻辑）────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const ANIM_FILES = [
  'single', 'cross_arm', 'idle', 'walk', 'run', 'jog',
  'fall', 'get_up', 'lie_ground',
  'lean_wall', 'squat', 'squat down', 'stand up', 'sit_ground',
  'sit_bench', 'lie_bench',
  'chess', 'chess_onlookers', 'dogwalk', 'bike', 'mobile',
];

// 状态图形元数据（cat / label）
const STATES = {
  walk:       { anim: 'walk',       cat: 'move',    label: '步行' },
  run:        { anim: 'run',        cat: 'move',    label: '跑步' },
  jog:        { anim: 'jog',        cat: 'move',    label: '慢跑' },
  stand:      { anim: 'single',     cat: 'idle',    label: '站立' },
  loiter:     { anim: 'single',     cat: 'idle',    label: '闲晃' },
  sit_bench:  { anim: 'sit_bench',  cat: 'sit',     label: '坐椅' },
  lean_wall:  { anim: 'lean_wall',  cat: 'sit',     label: '靠墙' },
  squat:      { anim: 'squat',      cat: 'sit',     label: '蹲下' },
  sit_ground: { anim: 'sit_ground', cat: 'sit',     label: '坐地' },
  lie_bench:  { anim: 'lie_bench',  cat: 'ground',  label: '躺椅' },
  lie_ground: { anim: 'lie_ground', cat: 'ground',  label: '躺地' },
  fall:       { anim: 'fall',       cat: 'special', label: '摔倒' },
  get_up:     { anim: 'get_up',     cat: 'special', label: '起身' },
  talk:       { anim: 'single',     cat: 'social',  label: '对话' },
};

// Profile 显示名（label/shortLabel 仅工具用，不写入游戏源）
const PROFILE_LABELS = {
  pedestrian:     ['路人',   'PED'],   businessman:    ['商人',   'BIZ'],
  tourist:        ['游客',   'TRS'],   chess_player:   ['棋手',   'CHE'],
  chess_onlooker: ['棋观众', 'OBS'],   dog_owner:      ['遛狗',   'DOG'],
  athlete:        ['运动员', 'ATH'],
};

// Overlay 显示元数据（held poses；hold_bag 已移至 TRAITS_DEF）
const OVERLAY_META = {
  phone_look: { label: '📱 看手机' },
  phone_call: { label: '📞 打电话' },
  smoke:      { label: '🚬 抽烟' },   // traitRequired 仅游戏内约束，工具中不限
  cross_arm:  { label: '🤚 抱臂' },
};

// Loiter pose 显示名
const LOITER_POSE_LABELS = {
  phone:  '📱 看手机（loiter）',
  bag_a:  '👜 换包手 A',
  bag_b:  '👜 换包手 B',
};

// 社交子事件显示元数据
const SUB_EVENT_META = {
  push:      { label: '推搡', icon: '💢', desc: 'A 双手前推，B fall' },
  give_item: { label: '递物', icon: '📦', desc: 'A 右手递，B 左手接' },
  handshake: { label: '握手', icon: '🤝', desc: '双方握手' },
  point_at:  { label: '指向', icon: '👆', desc: 'A 指，B 侧头' },
};

// Trait 芯片定义（smoker 是内部游戏 spawn trait，工具中不暴露；smoke 动作由 Mods 面板添加）
const TRAITS_DEF = [
  { key: 'hold_bag', label: '👜 拿包',  desc: '左手拿包（永久 modifier）' },
  { key: 'walk_dog', label: '🐕 遛狗',  desc: '左手牵绳遛狗（永久 modifier）' },
];

// Animation Graph 节点位置（0~1 相对坐标）
const GRAPH_POS = {
  walk:       [0.14, 0.10],  run:        [0.38, 0.06],
  jog:        [0.60, 0.10],  stand:      [0.14, 0.35],
  loiter:     [0.36, 0.35],  lean_wall:  [0.60, 0.28],
  squat:      [0.80, 0.28],  sit_bench:  [0.14, 0.58],
  sit_ground: [0.38, 0.58],  lie_bench:  [0.60, 0.52],
  lie_ground: [0.14, 0.80],  fall:       [0.40, 0.80],
  get_up:     [0.64, 0.80],  talk:       [0.88, 0.45],
};

const CAT_COLORS = {
  move:    '#4a9eff', idle:   '#4adf7c', sit:     '#6bffdf',
  ground:  '#ff9a4a', special:'#ffe066', social:  '#df6bff',
};

const NPC_PALETTE = [
  { stroke:'#2040a0', dot:'#4a9eff', label:'A' },
  { stroke:'#a03020', dot:'#ff6b4a', label:'B' },
  { stroke:'#206030', dot:'#4adf7c', label:'C' },
  { stroke:'#808020', dot:'#dfef4a', label:'D' },
  { stroke:'#702070', dot:'#df6bff', label:'E' },
  { stroke:'#207070', dot:'#6bffdf', label:'F' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── 从 import 构建派生数据 ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// 推断各 profile extraEdges（animDone / loiterChance 虚线弧）
function profileExtraEdges(p) {
  const e = [];
  if (p.allowedStates?.includes('fall'))   e.push({ from:'fall',  to:'lie_ground', label:'animDone',     style:'anim'   });
  if (p.allowedStates?.includes('get_up')) e.push({ from:'get_up', to:'stand',      label:'animDone',     style:'anim'   });
  if ((p.loiterChance ?? 0) > 0)           e.push({ from:'walk',  to:'loiter',     label:'loiterChance', style:'chance' });
  return e;
}

// 用 UI 元数据扩充 _PROFILES（label / shortLabel / extraEdges 工具专用字段）
const PROFILES = {};
for (const [k, p] of Object.entries(_PROFILES)) {
  const [label, shortLabel] = PROFILE_LABELS[k] ?? [k, k.slice(0, 3).toUpperCase()];
  PROFILES[k] = { ...p, label, shortLabel, extraEdges: profileExtraEdges(p) };
}

// 从所有 profile.heldPoses 计算每个 held pose key 在哪些状态下有效（union）
const _overlayOnSets = {};
for (const p of Object.values(_PROFILES)) {
  for (const [key, def] of Object.entries(p.heldPoses ?? {})) {
    if (!_overlayOnSets[key]) _overlayOnSets[key] = new Set();
    for (const s of (def.on ?? [])) _overlayOnSets[key].add(s);
  }
}
const OVERLAY_ON = {};   // key → string[]
for (const [k, s] of Object.entries(_overlayOnSets)) OVERLAY_ON[k] = [...s];

// ═══════════════════════════════════════════════════════════════════════════════
// ── 可编辑 pose 状态（深拷贝自 import，工具内修改不影响模块缓存）──────────────
// ═══════════════════════════════════════════════════════════════════════════════

const editedPoses = {
  overlays: JSON.parse(JSON.stringify(HELD_POSES)),   // { key: { joints: {...} } }
  loiter:   JSON.parse(JSON.stringify(LOITER_POSES)),  // { key: { joint: [...] } }
  social:   JSON.parse(JSON.stringify(SUB_EVENT_POSES)),
};

// single.json 首帧关节数据（用于 delta→absolute 换算；启动时 fetchAnim 后填入）
let _singleBase = null;

function deltaToAbs(delta) {
  if (!delta) return {};
  const base = _singleBase ?? {};
  const out = {};
  for (const [j, d] of Object.entries(delta)) {
    const b = base[j] ?? [0, 0];
    out[j] = [b[0] + d[0], b[1] + d[1]];
  }
  return out;
}

// 从 editedPoses 生成 PoseRegistry.js 源码（自包含，替换 data/ re-export 版本）
function generatePoseRegistryJS() {
  const serJoints = (obj) => {
    if (!obj) return 'null';
    const lines = Object.entries(obj).map(([k, v]) => `    ${k}: [${v[0]}, ${v[1]}]`);
    return `{\n${lines.join(',\n')}\n  }`;
  };
  const serHeldPoses = (obj) => {
    const lines = Object.entries(obj).map(([k, v]) =>
      `  ${k}: { joints: ${serJoints(v.joints)} }`
    );
    return `{\n${lines.join(',\n')}\n}`;
  };
  const serFlatPoses = (obj) => {
    const lines = Object.entries(obj).map(([k, v]) => `  ${k}: ${serJoints(v)}`);
    return `{\n${lines.join(',\n')}\n}`;
  };
  const serSocial = (obj) => {
    const lines = Object.entries(obj).map(([k, v]) => {
      const a = v.aDelta ? serJoints(v.aDelta).replace(/\n/g, '\n  ') : 'null';
      const b = v.bDelta ? serJoints(v.bDelta).replace(/\n/g, '\n  ') : 'null';
      return `  ${k}: {\n    aDelta: ${a},\n    bDelta: ${b},\n  }`;
    });
    return `{\n${lines.join(',\n')}\n}`;
  };

  return `/**
 * PoseRegistry — 由 anim-preview 工具自动生成（自包含版本）
 *
 * 覆盖 data/ re-export 版本。手动修改后请重新载入游戏。
 */

export const TRAIT_PROPS = {
  hold_bag: { joints: { l_elbow: [-16, -5], l_hand: [-18, 5] } },
  walk_dog: { joints: { l_elbow: [-10, -12], l_hand: [-18, -4] } },
};

export const HELD_POSES = ${serHeldPoses(editedPoses.overlays)};

export const LOITER_POSES = ${serFlatPoses(editedPoses.loiter)};

// 参考帧（single.json F0）：
//   r_hand[-10,-18]  l_hand[9,-19]  r_elbow[14,-11]  l_elbow[-14,-11]  head[-6,-55]
export const SUB_EVENT_POSES = ${serSocial(editedPoses.social)};

export const GESTURE_CLIPS = {};
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── 渲染工具函数（复刻 StickRenderer Canvas 2D 逻辑）─────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const BONES_HUMAN = [
  ['body','neck',4], ['neck','head',3],
  ['neck','l_elbow',3], ['l_elbow','l_hand',2.5],
  ['neck','r_elbow',3], ['r_elbow','r_hand',2.5],
  ['body','l_knee',3.5], ['l_knee','l_foot',2.5],
  ['body','r_knee',3.5], ['r_knee','r_foot',2.5],
];
const BONES_DOG = [
  ['body_back','body_front',4], ['body_front','neck',3], ['neck','head',3],
  ['body_back','tail',2],
  ['body_front','fl_upper',2.5],['fl_upper','fl_lower',2],
  ['body_front','fr_upper',2.5],['fr_upper','fr_lower',2],
  ['body_back','bl_upper',2.5], ['bl_upper','bl_lower',2],
  ['body_back','br_upper',2.5], ['br_upper','br_lower',2],
];

function getBend(from, to, frame, globalBend) {
  const key = `_bend_${from}__${to}`;
  if (key in frame) return frame[key];
  const gk = `${from}__${to}`;
  return (globalBend && gk in globalBend) ? globalBend[gk] : 0;
}

function drawBone(ctx, x1, y1, x2, y2, bend) {
  ctx.beginPath(); ctx.moveTo(x1, y1);
  if (bend !== 0) {
    const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy)||1;
    const nx = -dy/len, ny = dx/len;
    ctx.quadraticCurveTo((x1+x2)/2+bend*nx,(y1+y2)/2+bend*ny,x2,y2);
  } else { ctx.lineTo(x2,y2); }
  ctx.stroke();
}

function calcOffsetY(data, coord, isDog) {
  if (data.anchorMode === 'hip')  return -coord('body')[1];
  // 'back'（卧姿）：以 body 关节为锚，使躯干落在地面线上，头脚自然延伸
  if (data.anchorMode === 'back') return -coord('body')[1];
  if (isDog) return -Math.max(
    coord('fl_lower')[1], coord('fr_lower')[1],
    coord('bl_lower')[1], coord('br_lower')[1]);
  return -Math.max(coord('l_foot')[1], coord('r_foot')[1]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── Animation Cache ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const animCache = {};
async function fetchAnim(name) {
  if (animCache[name]) return animCache[name];
  const url = `../../assets/animations/${encodeURIComponent(name)}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${name}`);
  return (animCache[name] = await r.json());
}

// single.json 首帧作为社交 delta→absolute 的基准
async function preloadSingleBase() {
  try {
    const data = await fetchAnim('single');
    _singleBase = data.frames[0];
  } catch (e) {
    console.warn('[Debugger] single.json 加载失败，社交 pose 预览将使用零基准', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── NpcInstance ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _npcNextId = 0;
class NpcInstance {
  constructor(palIdx) {
    this.id          = _npcNextId++;
    this.palIdx      = palIdx % NPC_PALETTE.length;
    this.pal         = NPC_PALETTE[this.palIdx];
    this.profileKey  = 'pedestrian';
    this.state       = 'stand';
    this.animName    = 'single';
    this.animData    = null;
    this.frame       = 0;
    this.frameAcc    = 0;
    this.dir         = 1;
    this.traits      = [];     // string[]，对应 npc.traits（数组，非 Set）
    this.modifiers   = [];     // Modifier[]，驱动实际渲染
    this.collapsed   = false;
    this.interactPose = null;
  }

  get profile() { return PROFILES[this.profileKey] || PROFILES.pedestrian; }

  // 与 NPC.resolveJoints() 完全一致：按 priority 升序合并所有 modifier joints
  resolveJoints() {
    if (!this.modifiers.length) return null;
    const out = {};
    for (const m of [...this.modifiers].sort((a, b) => a.priority - b.priority)) {
      if (m.joints) Object.assign(out, m.joints);
    }
    return out;
  }

  get resolvedPose() {
    if (this.interactPose) return this.interactPose;
    return this.resolveJoints() ?? {};
  }

  async loadAnimForState(stateName) {
    const def = STATES[stateName] || STATES.stand;
    await this.loadAnim(def.anim);
    this.state = stateName;
  }

  async loadAnim(animName) {
    try {
      this.animData  = await fetchAnim(animName);
      this.animName  = animName;
      this.frame     = 0;
      this.frameAcc  = 0;
    } catch (e) {
      console.warn('[Debugger] 加载失败:', animName, e);
    }
  }

  advanceFrame(dt, speed) {
    if (!this.animData) return;
    const fps = (this.animData.fps || 8) * speed;
    this.frameAcc += dt * fps;
    const fc = this.animData.frames.length;
    if (this.frameAcc >= 1) {
      const steps = Math.floor(this.frameAcc);
      this.frame    = (this.frame + steps) % fc;
      this.frameAcc -= steps;
    }
  }

  stepFrame(delta) {
    if (!this.animData) return;
    const fc = this.animData.frames.length;
    this.frame = (this.frame + delta + fc) % fc;
    this.frameAcc = 0;
  }

  get frameLabel() {
    if (!this.animData) return '--';
    return `${this.frame+1}/${this.animData.frames.length}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── AnimGraph ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class AnimGraph {
  constructor(svgEl, profileSelectEl, onNodeClick) {
    this.svg = svgEl;
    this.profileSel = profileSelectEl;
    this.onNodeClick = onNodeClick;
    this.profileKey  = 'pedestrian';
    this.activeState = null;

    for (const [key, pd] of Object.entries(PROFILES)) {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = `${pd.label} [${pd.shortLabel}]`;
      profileSelectEl.appendChild(opt);
    }
    new ResizeObserver(() => this.render()).observe(svgEl.parentElement);
  }

  setProfile(key) { this.profileKey = key; this.activeState = null; this.render(); }
  setActiveState(state) { this.activeState = state; this.render(); }

  render() {
    const showLabels = document.getElementById('showEdgeLabels')?.checked ?? true;
    const W = this.svg.clientWidth  || 340;
    const H = this.svg.clientHeight || 380;
    const profile = PROFILES[this.profileKey] || PROFILES.pedestrian;
    const PAD = 32, NR = 22;

    const nodeX = (k) => (GRAPH_POS[k]?.[0] ?? 0.5) * (W - PAD*2) + PAD;
    const nodeY = (k) => (GRAPH_POS[k]?.[1] ?? 0.5) * (H - PAD*2) + PAD;

    let svg = `<defs>
      <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="2.5"
              orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(160,160,200,0.7)"/>
      </marker>
      <marker id="arr-anim" markerWidth="7" markerHeight="7" refX="5" refY="2.5"
              orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(255,224,102,0.9)"/>
      </marker>
      <marker id="arr-chance" markerWidth="7" markerHeight="7" refX="5" refY="2.5"
              orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(223,107,255,0.7)"/>
      </marker>
    </defs>`;

    const drawn = new Set();
    const transitions = profile.transitions || {};
    const normProbs = {};
    for (const [from, targets] of Object.entries(transitions)) {
      const total = Object.values(targets).reduce((a,b)=>a+b, 0) || 1;
      normProbs[from] = {};
      for (const [to, w] of Object.entries(targets)) normProbs[from][to] = w / total;
    }

    for (const [from, targets] of Object.entries(transitions)) {
      if (!GRAPH_POS[from]) continue;
      for (const [to, prob] of Object.entries(normProbs[from])) {
        if (!GRAPH_POS[to]) continue;
        const edgeKey = `${from}→${to}`;
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);
        const hasBoth = normProbs[to]?.[from] != null;
        const offset  = hasBoth ? 10 : 0;
        const x1 = nodeX(from), y1 = nodeY(from);
        const x2 = nodeX(to),   y2 = nodeY(to);
        const alpha = 0.3 + prob * 0.6, sw = 0.8 + prob * 2.2;
        const col = CAT_COLORS[STATES[from]?.cat || 'idle'];
        svg += this._edgePath(x1,y1,x2,y2,NR,sw,col,alpha,offset,'arr',showLabels?`${(prob*100).toFixed(0)}%`:'');
      }
    }

    for (const edge of (profile.extraEdges || [])) {
      if (!GRAPH_POS[edge.from] || !GRAPH_POS[edge.to]) continue;
      const x1 = nodeX(edge.from), y1 = nodeY(edge.from);
      const x2 = nodeX(edge.to),   y2 = nodeY(edge.to);
      const markerId = edge.style === 'anim' ? 'arr-anim' : 'arr-chance';
      const col = edge.style === 'anim' ? '#ffe066aa' : '#df6bffaa';
      const dash = edge.style === 'anim' ? '4,3' : '2,3';
      svg += this._edgePath(x1,y1,x2,y2,NR,0.8,col,0.8,-12,markerId,showLabels?edge.label:'',dash);
    }

    const allowed = new Set(profile.allowedStates || []);
    for (const [key, sdef] of Object.entries(STATES)) {
      if (!GRAPH_POS[key]) continue;
      const x = nodeX(key), y = nodeY(key);
      const color = CAT_COLORS[sdef.cat] || '#888';
      const isAllowed = allowed.has(key);
      const isActive  = this.activeState === key;
      const opacity   = isAllowed ? 1 : 0.28;
      const ring      = isActive ? `<circle cx="${x}" cy="${y}" r="${NR+4}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>` : '';
      svg += `<g class="g-node" onclick="app.graph.clickNode('${key}')" opacity="${opacity}">
        ${ring}
        <circle class="g-node-bg" cx="${x}" cy="${y}" r="${NR}"
          fill="${color}" fill-opacity="${isActive?0.9:0.6}"
          stroke="${color}" stroke-width="${isActive?2:1}"/>
        <text class="g-node-label" x="${x}" y="${y-4}">${key}</text>
        <text class="g-node-sublabel" x="${x}" y="${y+7}">${sdef.label}</text>
      </g>`;
    }

    this.svg.innerHTML = svg;
  }

  _edgePath(x1,y1,x2,y2,nr,sw,col,alpha,lateralOffset,markerId,label='',dash='') {
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
    const ux=dx/len,uy=dy/len;
    const sx=x1+ux*nr,sy=y1+uy*nr;
    const ex=x2-ux*(nr+6),ey=y2-uy*(nr+6);
    const lx=-uy*lateralOffset,ly=ux*lateralOffset;
    const cpx=(sx+ex)/2+lx+(-uy*12),cpy=(sy+ey)/2+ly+(ux*12);
    const dashAttr=dash?`stroke-dasharray="${dash}"`:'';
    let out=`<path d="M${sx+lx},${sy+ly} Q${cpx},${cpy} ${ex+lx},${ey+ly}"
      fill="none" stroke="${col}" stroke-width="${sw}" opacity="${alpha}"
      ${dashAttr} marker-end="url(#${markerId})"/>`;
    if (label) {
      const lbx=(sx+ex)/2+lx+(-uy*16),lby=(sy+ey)/2+ly+(ux*16);
      out+=`<text class="g-edge-label" x="${lbx}" y="${lby}">${label}</text>`;
    }
    return out;
  }

  clickNode(key) {
    this.activeState = key;
    this.render();
    this.onNodeClick(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── PreviewCanvas ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const GROUND_Y_FRAC = 0.78;

class PreviewCanvas {
  constructor(canvasEl, onClick) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    canvasEl.addEventListener('click', e => {
      const rect = canvasEl.getBoundingClientRect();
      onClick(e.clientX - rect.left, e.clientY - rect.top);
    });
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const pw = this.canvas.parentElement.clientWidth;
    this.canvas.width  = pw;
    this.canvas.height = 280;
  }

  render(npcs, interactA, interactB) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const GROUND_Y = Math.round(H * GROUND_Y_FRAC);

    ctx.fillStyle = '#e8e4de'; ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0,0,0,GROUND_Y);
    sky.addColorStop(0,'#c8c4be'); sky.addColorStop(1,'#e8e4de');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,GROUND_Y);

    ctx.save();
    ctx.strokeStyle='#9a9087'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(0,GROUND_Y); ctx.lineTo(W,GROUND_Y); ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.05)'; ctx.fillRect(0,GROUND_Y,W,8);
    ctx.restore();

    if (!npcs.length) {
      ctx.fillStyle='#999'; ctx.font='13px JetBrains Mono,monospace';
      ctx.textAlign='center'; ctx.fillText('← 点击「+ 添加 NPC」开始', W/2, GROUND_Y-80);
      return;
    }

    const slotW = W / npcs.length;
    npcs.forEach((npc, i) => {
      const slotCx = slotW * i + slotW / 2;
      const isA = (npc === interactA), isB = (npc === interactB);
      if (isA || isB) {
        ctx.save();
        ctx.strokeStyle = isA ? '#4a9eff' : '#ff6b4a';
        ctx.lineWidth = 2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(slotCx, GROUND_Y-50, 38, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha=0.1; ctx.fillStyle=npc.pal.stroke;
      ctx.beginPath(); ctx.ellipse(slotCx, GROUND_Y+3, 24, 5, 0, 0, Math.PI*2);
      ctx.fill(); ctx.restore();

      if (npc.animData) {
        const maxW = Math.min(slotW * 0.8, 100);
        const scale = Math.max(0.55, Math.min(1.4, maxW / 45));
        this._drawPuppet(ctx, npc, slotCx, GROUND_Y, scale);
      }

      ctx.save();
      ctx.fillStyle = npc.pal.dot; ctx.globalAlpha = 0.85;
      ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign='center';
      const lbl = npc.animData
        ? `${npc.pal.label}: ${npc.state}  F${npc.frameLabel}`
        : `${npc.pal.label}: (loading...)`;
      ctx.fillText(lbl, slotCx, GROUND_Y + 20);
      const heldMods = npc.modifiers.filter(m => m.kind === 'held');
      if (heldMods.length) {
        ctx.fillStyle = '#ff9a4a'; ctx.globalAlpha = 0.75;
        ctx.fillText(`[${heldMods.map(m => m.id).join(',')}]`, slotCx, GROUND_Y + 32);
      }
      ctx.restore();
    });
  }

  _drawPuppet(ctx, npc, cx, groundY, scale) {
    const { animData, frame, dir } = npc;
    const frameData = animData.frames[frame % animData.frames.length];
    const pose    = npc.resolvedPose;
    const isDog   = animData.skeleton === 'dog';
    const bones   = isDog ? BONES_DOG : BONES_HUMAN;
    const d       = dir * (animData.canonicalDirection || 1);
    const s       = scale;
    const coord   = (j) => (pose[j] ? pose[j] : frameData[j]);
    const offsetY = calcOffsetY(animData, coord, isDog) * s;
    // 卧姿（anchorMode='back'）横向也以 body 关节居中，否则躺下的人会偏向一侧
    const offsetX = (!isDog && animData.anchorMode === 'back' && coord('body'))
      ? -coord('body')[0] * s * d : 0;
    const jx = (j) => cx + coord(j)[0] * s * d + offsetX;
    const jy = (j) => groundY + coord(j)[1] * s + offsetY;

    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    const ovCol = '#ff6b4a';
    for (const [from, to, w] of bones) {
      if (!frameData[from] || !frameData[to]) continue;
      const bend  = getBend(from, to, frameData, animData.globalBend) * s * d;
      const isOv  = pose[from] || pose[to];
      ctx.strokeStyle = isOv ? ovCol : npc.pal.stroke;
      ctx.lineWidth   = w * s * 1.8;
      drawBone(ctx, jx(from), jy(from), jx(to), jy(to), bend);
    }
    const headR = (isDog ? 6 : 9) * s;
    ctx.fillStyle = pose['head'] ? ovCol : npc.pal.stroke;
    ctx.beginPath(); ctx.arc(jx('head'), jy('head'), headR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = ovCol;
    for (const jn of Object.keys(pose)) {
      if (!frameData[jn]) continue;
      ctx.beginPath(); ctx.arc(jx(jn), jy(jn), 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  hitTestSlot(mouseX, npcCount) {
    if (!npcCount) return -1;
    return Math.floor(mouseX / (this.canvas.width / npcCount));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── PlaybackController ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class PlaybackController {
  constructor(getNpcs, onTick) {
    this.getNpcs = getNpcs; this.onTick = onTick;
    this.playing = false; this.speed = 1; this._lastTs = 0;
  }
  toggle() {
    this.playing = !this.playing;
    const btn = document.getElementById('playBtn');
    if (btn) btn.textContent = this.playing ? '⏸' : '▶';
    if (this.playing) { this._lastTs = performance.now(); requestAnimationFrame(ts => this._loop(ts)); }
  }
  step(delta) {
    if (this.playing) this.toggle();
    for (const npc of this.getNpcs()) npc.stepFrame(delta);
    this.onTick();
  }
  resetAllFrames() { for (const npc of this.getNpcs()) { npc.frame=0; npc.frameAcc=0; } this.onTick(); }
  setSpeed(s) {
    this.speed = s;
    document.querySelectorAll('.spd').forEach(b => b.classList.toggle('spd-act', parseFloat(b.dataset.s)===s));
  }
  _loop(ts) {
    if (!this.playing) return;
    const dt = Math.min((ts - this._lastTs)/1000, 0.1); this._lastTs = ts;
    for (const npc of this.getNpcs()) npc.advanceFrame(dt, this.speed);
    this.onTick();
    requestAnimationFrame(t => this._loop(t));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── AnimatorDebugger  （主协调器）─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class AnimatorDebugger {
  constructor() {
    this.npcs = [];
    this.interactA = null;
    this.interactB = null;
    this.activeInteraction = null;

    const canvas = document.getElementById('previewCanvas');
    this.preview = new PreviewCanvas(canvas, (mx) => this._canvasClick(mx));

    this.graph = new AnimGraph(
      document.getElementById('animGraph'),
      document.getElementById('graphProfile'),
      (state) => this._graphNodeClicked(state),
    );

    this.pb = new PlaybackController(() => this.npcs, () => this._renderFrame());
    this._bindKeys();

    preloadSingleBase().then(() => {
      this.addNpc();
      this.addNpc();
      this.graph.render();
    });
  }

  // ── NPC management ──────────────────────────────────────────────────────────

  addNpc() {
    if (this.npcs.length >= NPC_PALETTE.length) return;
    const npc = new NpcInstance(this.npcs.length);
    this.npcs.push(npc);
    npc.loadAnim('single').then(() => this._renderFrame());
    this._renderPanel();
    this._setStatus(`NPC ${npc.pal.label} 已添加`);
  }

  removeNpc(id) {
    const idx = this.npcs.findIndex(n => n.id === id);
    if (idx < 0) return;
    const npc = this.npcs[idx];
    if (this.interactA === npc) this.interactA = null;
    if (this.interactB === npc) this.interactB = null;
    this.npcs.splice(idx, 1);
    this._renderPanel(); this._renderFrame();
  }

  async setState(id, state) {
    const npc = this._byId(id); if (!npc) return;
    npc.interactPose = null;
    await npc.loadAnimForState(state);
    this.graph.setActiveState(state);
    this._renderPanel(); this._renderFrame();
    this._setStatus(`NPC ${npc.pal.label} → ${state}`);
  }

  setProfile(id, key) {
    const npc = this._byId(id); if (!npc) return;
    npc.profileKey = key;
    this.graph.profileSel.value = key;
    this.graph.setProfile(key);
    this._renderPanel();
  }

  async setAnim(id, animName) {
    const npc = this._byId(id); if (!npc) return;
    await npc.loadAnim(animName);
    this._renderPanel(); this._renderFrame();
  }

  setDir(id, dir) {
    const npc = this._byId(id); if (!npc) return;
    npc.dir = dir; this._renderFrame(); this._renderPanel();
  }

  addHeldModifier(npcId, heldKey) {
    const npc = this._byId(npcId); if (!npc) return;
    if (npc.modifiers.some(m => m.id === heldKey)) return;
    const poseDef = editedPoses.overlays[heldKey];
    if (!poseDef) return;
    npc.modifiers.push({ id: heldKey, kind: 'held', priority: 10, joints: poseDef.joints, timer: -1 });
    this._renderPanel(); this._renderFrame();
  }

  removeModifier(npcId, modId) {
    const npc = this._byId(npcId); if (!npc) return;
    const mod = npc.modifiers.find(m => m.id === modId);
    if (mod?.kind === 'trait') npc.traits = npc.traits.filter(t => t !== modId);
    npc.modifiers = npc.modifiers.filter(m => m.id !== modId);
    this._renderPanel(); this._renderFrame();
  }

  toggleTrait(id, traitKey, checked) {
    const npc = this._byId(id); if (!npc) return;
    if (checked) {
      if (!npc.traits.includes(traitKey)) npc.traits.push(traitKey);
    } else {
      npc.traits = npc.traits.filter(t => t !== traitKey);
    }
    npc.modifiers = npc.modifiers.filter(m => m.kind !== 'trait' || m.id !== traitKey);
    if (checked) {
      const tp = TRAIT_PROPS[traitKey];
      if (tp) npc.modifiers.push({ id: traitKey, kind: 'trait', priority: 5, joints: tp.joints, timer: -1 });
    }
    this._renderPanel();
    this._renderFrame();
  }

  copyPose(id) {
    const npc = this._byId(id); if (!npc) return;
    const json = JSON.stringify(npc.resolvedPose, null, 2);
    navigator.clipboard.writeText(json)
      .then(() => this._flash('Pose JSON 已复制'))
      .catch(() => prompt('复制 JSON:', json));
  }

  toggleCollapse(id) {
    const npc = this._byId(id); if (!npc) return;
    npc.collapsed = !npc.collapsed; this._renderPanel();
  }

  // ── Pose Registry 编辑 ──────────────────────────────────────────────────────

  // section: 'overlays' | 'loiter' | 'social'
  // key: pose key (e.g. 'phone_look', 'phone', 'push')
  // sub: null | 'aDelta' | 'bDelta'  (for social only)
  // joint: joint name e.g. 'r_hand'
  // axis: 0=x, 1=y
  updatePose(section, key, sub, joint, axis, value) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const data = editedPoses[section];
    if (!data[key]) return;
    if (sub) {
      if (!data[key][sub]) data[key][sub] = {};
      if (!data[key][sub][joint]) data[key][sub][joint] = [0, 0];
      data[key][sub][joint][axis] = num;
    } else {
      // overlays section uses nested .joints; loiter section is flat
      const target = section === 'overlays' ? data[key].joints : data[key];
      if (!target[joint]) target[joint] = [0, 0];
      target[joint][axis] = num;
    }
    // Re-sync held modifiers on all NPCs that have this overlay active
    if (section === 'overlays') {
      for (const npc of this.npcs) {
        const mod = npc.modifiers.find(m => m.id === key && m.kind === 'held');
        if (mod) mod.joints = data[key].joints;
      }
    }
    this._renderFrame();
  }

  // 将某个 overlay/loiter pose 立即应用到选中的 NPC 上（textarea 覆盖层）
  previewPoseOnNpc(section, key, sub) {
    const npc = this.interactA || this.npcs[0]; if (!npc) return;
    const src = editedPoses[section]?.[key]; if (!src) return;
    if (section === 'overlays') {
      npc.modifiers = npc.modifiers.filter(m => m.id !== key);
      if (src.joints) npc.modifiers.push({ id: key, kind: 'held', priority: 10, joints: { ...src.joints }, timer: -1 });
    } else if (section === 'loiter') {
      npc.modifiers = npc.modifiers.filter(m => m.id !== '_loiter_preview');
      npc.modifiers.push({ id: '_loiter_preview', kind: 'held', priority: 15, joints: { ...src }, timer: -1 });
    } else if (section === 'social') {
      const pose = sub ? (src[sub] ?? {}) : {};
      npc.interactPose = sub ? deltaToAbs(pose) : { ...pose };
    }
    this._renderPanel(); this._renderFrame();
  }

  async savePoseRegistry() {
    const src = generatePoseRegistryJS();
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'PoseRegistry.js',
          startIn: 'desktop',
          types: [{ description: 'JavaScript Module', accept: { 'text/javascript': ['.js'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(src);
        await writable.close();
        this._setStatus('✓ PoseRegistry.js 已保存');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;  // user cancelled
      }
    }
    // fallback: copy to clipboard
    navigator.clipboard.writeText(src)
      .then(() => this._flash('已复制到剪贴板 → 粘贴到 js/behavior/PoseRegistry.js'))
      .catch(() => {
        const win = window.open('', '_blank');
        if (win) { win.document.write(`<pre>${src.replace(/</g,'&lt;')}</pre>`); }
        else { prompt('复制下面的内容到 PoseRegistry.js:', src); }
      });
  }

  exportAll() {
    const out = {};
    for (const npc of this.npcs) {
      if (!npc.animData) continue;
      const frame = npc.animData.frames[npc.frame % npc.animData.frames.length];
      const merged = {};
      for (const [k,v] of Object.entries(frame)) {
        if (k.startsWith('_')) continue;
        merged[k] = npc.resolvedPose[k] ?? v;
      }
      out[`npc_${npc.pal.label}`] = {
        profile: npc.profileKey, state: npc.state, anim: npc.animName,
        frame: npc.frame, dir: npc.dir,
        modifiers: npc.modifiers.filter(m => m.kind === 'held').map(m => m.id), joints: merged,
        pose: Object.keys(npc.resolvedPose).length ? npc.resolvedPose : undefined,
      };
    }
    const json = JSON.stringify(out, null, 2);
    navigator.clipboard.writeText(json)
      .then(() => this._flash('已导出到剪贴板'))
      .catch(() => prompt('JSON:', json));
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  setInteractA(id) { this.interactA = this._byId(id); this._renderPanel(); this._renderFrame(); }
  setInteractB(id) { this.interactB = this._byId(id); this._renderPanel(); this._renderFrame(); }

  triggerInteraction(type) {
    const se = editedPoses.social[type]; if (!se) return;
    const meta = SUB_EVENT_META[type];
    if (!this.interactA || !this.interactB) { this._flash('请先选择 A 和 B'); return; }
    this.interactB.dir = -1;
    this.interactA.interactPose = deltaToAbs(se.aDelta);
    this.interactB.interactPose = se.bDelta ? deltaToAbs(se.bDelta) : null;
    this.activeInteraction = type;
    this._renderPanel(); this._renderFrame();
    this._setStatus(`交互: ${meta?.label} — ${meta?.desc}`);
  }

  resetInteraction() {
    if (this.interactA) this.interactA.interactPose = null;
    if (this.interactB) this.interactB.interactPose = null;
    this.activeInteraction = null;
    this._renderPanel(); this._renderFrame();
  }

  // ── Panel Rendering ──────────────────────────────────────────────────────────

  _renderPanel() {
    const panel = document.getElementById('controlPanel');
    let html = '';
    html += this._renderGlobalSection();
    html += this._renderPoseRegistrySection();
    html += this._renderInteractionSection();
    html += '<div class="npc-cards">';
    for (const npc of this.npcs) html += this._renderNpcCard(npc);
    html += '</div>';
    panel.innerHTML = html;
  }

  _renderGlobalSection() {
    const count = this.npcs.length;
    const canAdd = count < NPC_PALETTE.length;
    return `
    <div class="cp-section">
      <div class="cp-section-hdr">
        <span class="cp-section-title">NPC 列表 (${count}/${NPC_PALETTE.length})</span>
        <div style="display:flex;gap:4px">
          <button class="sm green" onclick="app.addNpc()" ${canAdd?'':'disabled'}>+ 添加</button>
          <button class="sm" onclick="app.exportAll()">📋 导出</button>
        </div>
      </div>
    </div>`;
  }

  _renderPoseRegistrySection() {
    let html = `
    <div class="cp-section">
      <div class="cp-section-hdr">
        <span class="cp-section-title">⚙ Pose Registry</span>
        <button class="sm blue" onclick="app.savePoseRegistry()">Save .js</button>
      </div>
      <details class="cp-detail">
        <summary>Overlay Poses</summary>
        <div class="pose-reg-body">`;

    for (const [key, poseDef] of Object.entries(editedPoses.overlays)) {
      const meta = OVERLAY_META[key];
      html += `<div class="pose-group">
        <div class="pose-group-hdr">
          <span class="pose-key">${meta?.label ?? key}</span>
          <button class="sm ghost" onclick="app.previewPoseOnNpc('overlays','${key}',null)" title="应用到 NPC A">→ NPC</button>
        </div>`;
      for (const [joint, [x, y]] of Object.entries(poseDef.joints)) {
        html += this._poseJointRow('overlays', key, null, joint, x, y);
      }
      html += `</div>`;
    }

    html += `</div></details>
      <details class="cp-detail">
        <summary>Loiter Poses</summary>
        <div class="pose-reg-body">`;

    for (const [key, pose] of Object.entries(editedPoses.loiter)) {
      const lbl = LOITER_POSE_LABELS[key] ?? key;
      html += `<div class="pose-group">
        <div class="pose-group-hdr">
          <span class="pose-key">${lbl}</span>
          <button class="sm ghost" onclick="app.previewPoseOnNpc('loiter','${key}',null)" title="应用到 NPC A">→ NPC</button>
        </div>`;
      for (const [joint, [x, y]] of Object.entries(pose)) {
        html += this._poseJointRow('loiter', key, null, joint, x, y);
      }
      html += `</div>`;
    }

    html += `</div></details>
      <details class="cp-detail">
        <summary>Social Δ Poses</summary>
        <div class="pose-reg-body">`;

    for (const [key, se] of Object.entries(editedPoses.social)) {
      const meta = SUB_EVENT_META[key];
      html += `<div class="pose-group"><div class="pose-group-hdr">
        <span class="pose-key">${meta?.icon ?? ''} ${meta?.label ?? key}</span>
      </div>`;
      if (se.aDelta) {
        html += `<div class="pose-sub-hdr">A delta</div>`;
        for (const [joint, [x, y]] of Object.entries(se.aDelta)) {
          html += this._poseJointRow('social', key, 'aDelta', joint, x, y);
        }
      }
      if (se.bDelta) {
        html += `<div class="pose-sub-hdr">B delta</div>`;
        for (const [joint, [x, y]] of Object.entries(se.bDelta)) {
          html += this._poseJointRow('social', key, 'bDelta', joint, x, y);
        }
      }
      html += `</div>`;
    }

    html += `</div></details>
    </div>`;
    return html;
  }

  _poseJointRow(section, key, sub, joint, x, y) {
    const subArg = sub ? `'${sub}'` : 'null';
    return `<div class="pj">
      <span class="pj-name">${joint}</span>
      <input type="number" step="1" value="${x}" class="pj-input"
        oninput="app.updatePose('${section}','${key}',${subArg},'${joint}',0,this.value)">
      <input type="number" step="1" value="${y}" class="pj-input"
        oninput="app.updatePose('${section}','${key}',${subArg},'${joint}',1,this.value)">
    </div>`;
  }

  _renderInteractionSection() {
    const npcOpts = this.npcs.map(n =>
      `<option value="${n.id}">${n.pal.label}: ${n.profileKey}</option>`).join('');
    const selA = this.interactA?.id ?? '';
    const selB = this.interactB?.id ?? '';

    const subBtns = Object.entries(SUB_EVENT_META).map(([type, meta]) => {
      const isAct = this.activeInteraction === type ? ' active-interaction' : '';
      return `<button class="sm interact-btn${isAct}" onclick="app.triggerInteraction('${type}')"
        title="${meta.desc}">${meta.icon} ${meta.label}</button>`;
    }).join('');

    return `
    <div class="cp-section">
      <div class="cp-section-hdr">
        <span class="cp-section-title">NPC 交互</span>
        <button class="sm ghost" onclick="app.resetInteraction()">↺ 重置</button>
      </div>
      <div class="interact-targets">
        <span class="cp-label" style="color:#4a9eff">A:</span>
        <select onchange="app.setInteractA(+this.value)" style="flex:1">
          <option value="">— 选 A —</option>${npcOpts}
        </select>
        <span class="cp-label" style="color:#ff6b4a">B:</span>
        <select onchange="app.setInteractB(+this.value)" style="flex:1">
          <option value="">— 选 B —</option>${npcOpts}
        </select>
      </div>
      <div class="interact-btns">${subBtns}</div>
    </div>`;
  }

  _renderNpcCard(npc) {
    const isIntA = this.interactA === npc;
    const isIntB = this.interactB === npc;
    const intCls = isIntA ? ' interacting-a' : isIntB ? ' interacting-b' : '';

    const profileOpts = Object.entries(PROFILES).map(([k,p]) =>
      `<option value="${k}" ${k===npc.profileKey?'selected':''}>${p.label}</option>`).join('');

    const stateOpts = (npc.profile.allowedStates || Object.keys(STATES)).map(s =>
      `<option value="${s}" ${s===npc.state?'selected':''}>${s}</option>`).join('');

    const animOpts = ANIM_FILES.map(f =>
      `<option value="${f}" ${f===npc.animName?'selected':''}>${f}</option>`).join('');

    const traitChips = TRAITS_DEF.map(t => {
      const act = npc.traits.includes(t.key) ? ' active' : '';
      return `<label class="trait-chip${act}" title="${t.desc}">
        <input type="checkbox" ${npc.traits.includes(t.key)?'checked':''}
          onchange="app.toggleTrait(${npc.id},'${t.key}',this.checked)">
        ${t.label}
      </label>`;
    }).join('');

    const availHeld = Object.keys(editedPoses.overlays).filter(key => {
      const meta = OVERLAY_META[key];
      return !meta?.traitRequired || npc.traits.includes(meta.traitRequired);
    });

    const activeMods = npc.modifiers.map(m => `${m.id}(${m.kind[0]})`).join(',');
    const badge = activeMods
      ? `<span class="npc-state-badge">${npc.state} | ${activeMods}</span>`
      : `<span class="npc-state-badge">${npc.state}</span>`;

    const dirLabel = npc.dir > 0 ? '→ 右' : '← 左';

    const body = npc.collapsed ? '' : `
      <div class="npc-card-body">
        <div class="cp-row">
          <span class="cp-label">Profile</span>
          <select onchange="app.setProfile(${npc.id},this.value)">${profileOpts}</select>
          <button class="sm" onclick="app.setDir(${npc.id},${npc.dir>0?-1:1})" style="flex-shrink:0">${dirLabel}</button>
        </div>
        <div class="cp-row">
          <span class="cp-label">State</span>
          <select onchange="app.setState(${npc.id},this.value)">${stateOpts}</select>
        </div>
        <div class="cp-row">
          <span class="cp-label">Anim</span>
          <select onchange="app.setAnim(${npc.id},this.value)">${animOpts}</select>
        </div>
        <div class="cp-row">
          <span class="cp-label">Traits</span>
          <div class="trait-chips">${traitChips || '<span style="color:var(--fg3);font-size:10px">无</span>'}</div>
        </div>
        <div class="cp-row" style="align-items:flex-start">
          <span class="cp-label" style="padding-top:2px">Mods</span>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div>
              <div style="font-size:9px;color:var(--fg3);margin-bottom:3px">+ 可添加</div>
              ${availHeld.map(key => `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">
                <span style="flex:1;font-size:9px">${OVERLAY_META[key]?.label ?? key}</span>
                <button class="sm green" onclick="app.addHeldModifier(${npc.id},'${key}')">+</button>
              </div>`).join('')}
              ${!availHeld.length ? '<span style="color:var(--fg3);font-size:9px">—</span>' : ''}
            </div>
            <div>
              <div style="font-size:9px;color:var(--fg3);margin-bottom:3px">激活</div>
              ${npc.modifiers.map(m => `<div style="display:flex;align-items:center;gap:3px;margin-bottom:2px">
                <span style="flex:1;font-size:9px;background:rgba(255,154,74,0.18);padding:1px 3px;border-radius:2px">${m.id}(${m.kind[0]})</span>
                ${!m.id.startsWith('_') ? `<button class="sm red" style="padding:0 3px;min-width:14px" onclick="app.removeModifier(${npc.id},'${m.id}')">✕</button>` : ''}
              </div>`).join('')}
              ${!npc.modifiers.length ? '<span style="color:var(--fg3);font-size:9px">无</span>' : ''}
            </div>
          </div>
        </div>
        <div class="cp-row">
          <button class="sm blue" onclick="app.copyPose(${npc.id})">📋 复制 Pose</button>
        </div>
        <details class="cp-detail">
          <summary>关节坐标 (${npc.animName} F${npc.frameLabel})</summary>
          ${this._renderCoords(npc)}
        </details>
      </div>`;

    return `
    <div class="npc-card${intCls}">
      <div class="npc-card-hdr" onclick="app.toggleCollapse(${npc.id})">
        <div class="npc-dot" style="background:${npc.pal.dot}"></div>
        <span class="npc-card-name" style="color:${npc.pal.dot}">NPC ${npc.pal.label}</span>
        ${badge}
        <button class="sm red" onclick="event.stopPropagation();app.removeNpc(${npc.id})"
          style="margin-left:auto;flex-shrink:0">✕</button>
      </div>
      ${body}
    </div>`;
  }

  _renderCoords(npc) {
    if (!npc.animData) return '<span style="color:var(--fg2);font-size:9px">未加载</span>';
    const frame = npc.animData.frames[npc.frame % npc.animData.frames.length];
    const pose  = npc.resolvedPose;
    let html = '<div class="coords-panel">';
    for (const [joint, baseVal] of Object.entries(frame)) {
      if (joint.startsWith('_')) continue;
      const isOv = !!pose[joint];
      const val  = isOv ? pose[joint] : baseVal;
      const xs = typeof val[0]==='number' ? val[0].toFixed(1) : '?';
      const ys = typeof val[1]==='number' ? val[1].toFixed(1) : '?';
      html += `<div class="cr${isOv?' ov':''}">
        <span class="cl">${joint}</span>
        <span class="cv">[${xs},${ys}]</span>
        ${isOv ? '<span class="ov-badge">OV</span>' : ''}
      </div>`;
    }
    return html + '</div>';
  }

  // ── Frame Rendering ──────────────────────────────────────────────────────────

  _renderFrame() {
    this.preview.render(this.npcs, this.interactA, this.interactB);
    this._updateFrameInfo();
    for (const npc of this.npcs) {
      const det = document.querySelector(`#pose-ta-${npc.id}`)?.closest('.npc-card');
      if (!det) continue;
      const coordsPanel = det.querySelector('.coords-panel');
      if (coordsPanel) coordsPanel.outerHTML = this._renderCoords(npc);
    }
  }

  _updateFrameInfo() {
    const parts = this.npcs.map(n => `${n.pal.label}:${n.frameLabel}`);
    const el = document.getElementById('frameInfo');
    if (el) el.textContent = parts.join('  ') || '—';
  }

  // ── Input Handling ───────────────────────────────────────────────────────────

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
      if (e.code==='Space')                              { e.preventDefault(); this.pb.toggle(); }
      if (e.code==='ArrowLeft'||e.code==='KeyQ')        { e.preventDefault(); this.pb.step(-1); }
      if (e.code==='ArrowRight'||e.code==='KeyE')       { e.preventDefault(); this.pb.step(1);  }
    });
  }

  _canvasClick(mx) {
    const idx = this.preview.hitTestSlot(mx, this.npcs.length);
    if (idx < 0 || idx >= this.npcs.length) return;
    const npc = this.npcs[idx];
    if (!this.interactA || this.interactA === npc) this.interactA = npc;
    else this.interactB = npc;
    this.graph.profileSel.value = npc.profileKey;
    this.graph.setProfile(npc.profileKey);
    this._renderPanel(); this._renderFrame();
    this._setStatus(`选中 NPC ${npc.pal.label} [${npc.profileKey}]`);
  }

  _graphNodeClicked(state) {
    const stateDef = STATES[state]; if (!stateDef) return;
    for (const npc of this.npcs) {
      npc.interactPose = null;
      npc.loadAnim(stateDef.anim).then(() => { npc.state = state; this._renderFrame(); });
    }
    this._setStatus(`Graph → ${state} (${stateDef.anim})`);
    this._renderPanel();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _byId(id) { return this.npcs.find(n => n.id === id); }

  _setStatus(msg) {
    const el = document.getElementById('statusBar');
    if (el) el.textContent = msg;
  }

  _flash(msg) {
    const el = document.createElement('div');
    el.className = 'flash-msg'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2100);
  }
}

// ── Bootstrap ──
window.app = new AnimatorDebugger();
