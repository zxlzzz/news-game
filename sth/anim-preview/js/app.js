/**
 * Animator Debugger — NPC 动画状态机调试工具
 *
 * 扩展指引：
 *   - 新增状态：在 STATES 里加一条，graph 节点自动出现。
 *   - 新增 Profile：在 PROFILES 里加一条，所有下拉菜单自动包含它。
 *   - 新增 Trait：在 TRAITS_DEF 里加一条，控制面板 trait chips 自动出现。
 *   - 新增 Overlay：在 OVERLAYS_DEF 里加一条（带 pose 字段即有视觉效果）。
 *   - 新增社交子事件：在 SUB_EVENTS_DEF 里加一条，交互按钮自动出现。
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ── REGISTRY  （数据层，扩展只改这里）─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const ANIM_FILES = [
  'single', 'cross_arm', 'idle', 'walk', 'run', 'jog',
  'fall', 'get_up', 'lie_ground',
  'lean_wall', 'squat', 'squat down', 'stand up', 'sit_ground',
  'sit_bench', 'lie_bench',
  'chess', 'chess_onlookers', 'dogwalk', 'bike', 'mobile',
];

// 状态定义：mirrors BaseStateMachine.STATE_DEFS
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

// Profile 定义：mirrors NpcProfile.js（只需关键字段）
const PROFILES = {
  pedestrian: {
    label: '路人', shortLabel: 'PED',
    allowedStates: [
      'walk','run','stand','sit_bench','fall','lie_ground',
      'squat','sit_ground','get_up','lean_wall','lie_bench','loiter',
    ],
    transitions: {
      walk:       { stand:0.6, sit_bench:0.2, run:0.08, squat:0.01, sit_ground:0.02 },
      run:        { walk:0.9, fall:0.1 },
      stand:      { walk:0.77, sit_bench:0.1, sit_ground:0.03, squat:0.01, lean_wall:0.05, loiter:0.07 },
      loiter:     { walk:1.0 },
      sit_bench:  { stand:0.97, lie_bench:0.03 },
      squat:      { stand:1.0 },
      sit_ground: { stand:1.0 },
      fall:       { lie_ground:1.0 },
      lie_ground: { get_up:1.0 },
      get_up:     { stand:1.0 },
      lie_bench:  { sit_bench:1.0 },
      lean_wall:  { stand:1.0 },
    },
    extraEdges: [   // animDone 驱动（非 timeout）
      { from:'fall', to:'lie_ground', label:'animDone', style:'anim' },
      { from:'get_up', to:'stand',    label:'animDone', style:'anim' },
      { from:'walk', to:'loiter',     label:'loiterChance', style:'chance' },
    ],
    loiterChance: 0.25, loiterDurationRange: [15, 45],
  },
  businessman: {
    label: '商人', shortLabel: 'BIZ',
    allowedStates: [
      'walk','run','stand','sit_bench','fall','lie_ground',
      'squat','sit_ground','get_up','lean_wall','lie_bench','loiter',
    ],
    transitions: {
      walk:       { stand:0.6, sit_bench:0.2, run:0.08, squat:0.01, sit_ground:0.02 },
      run:        { walk:0.9, fall:0.1 },
      stand:      { walk:0.77, sit_bench:0.1, sit_ground:0.03, squat:0.01, lean_wall:0.05, loiter:0.07 },
      loiter:     { walk:1.0 },
      sit_bench:  { stand:0.97, lie_bench:0.03 },
      squat:      { stand:1.0 },
      sit_ground: { stand:1.0 },
      fall:       { lie_ground:1.0 },
      lie_ground: { get_up:1.0 },
      get_up:     { stand:1.0 },
      lie_bench:  { sit_bench:1.0 },
      lean_wall:  { stand:1.0 },
    },
    extraEdges: [
      { from:'fall', to:'lie_ground', label:'animDone', style:'anim' },
      { from:'get_up', to:'stand',    label:'animDone', style:'anim' },
      { from:'walk', to:'loiter',     label:'loiterChance', style:'chance' },
    ],
    loiterChance: 0.12, loiterDurationRange: [15, 40],
  },
  tourist: {
    label: '游客', shortLabel: 'TRS',
    allowedStates: [
      'walk','run','stand','sit_bench','fall','lie_ground',
      'squat','sit_ground','get_up','lean_wall','lie_bench','loiter',
    ],
    transitions: {
      walk:       { stand:0.55, sit_bench:0.18, run:0.06, squat:0.02, sit_ground:0.05, lean_wall:0.01 },
      run:        { walk:0.9, fall:0.1 },
      stand:      { walk:0.68, sit_bench:0.08, sit_ground:0.07, squat:0.02, lean_wall:0.05, loiter:0.10 },
      loiter:     { walk:1.0 },
      sit_bench:  { stand:0.97, lie_bench:0.03 },
      squat:      { stand:1.0 },
      sit_ground: { stand:1.0 },
      fall:       { lie_ground:1.0 },
      lie_ground: { get_up:1.0 },
      get_up:     { stand:1.0 },
      lie_bench:  { sit_bench:1.0 },
      lean_wall:  { stand:1.0 },
    },
    extraEdges: [
      { from:'fall', to:'lie_ground', label:'animDone', style:'anim' },
      { from:'get_up', to:'stand',    label:'animDone', style:'anim' },
      { from:'walk', to:'loiter',     label:'loiterChance', style:'chance' },
    ],
    loiterChance: 0.40, loiterDurationRange: [20, 60],
  },
  chess_player: {
    label: '棋手', shortLabel: 'CHESS',
    allowedStates: ['walk','stand','sit_bench'],
    transitions: { walk:{stand:1.0}, stand:{walk:1.0}, sit_bench:{stand:1.0} },
    extraEdges: [],
  },
  chess_onlooker: {
    label: '棋观众', shortLabel: 'OBS',
    allowedStates: ['walk','stand','squat','sit_ground'],
    transitions: {
      walk:       { stand:0.75, squat:0.01, sit_ground:0.01 },
      stand:      { walk:0.88, squat:0.06, sit_ground:0.06 },
      squat:      { stand:1.0 },
      sit_ground: { stand:1.0 },
    },
    extraEdges: [],
  },
  dog_owner: {
    label: '遛狗者', shortLabel: 'DOG',
    allowedStates: ['walk','stand'],
    transitions: { walk:{stand:1.0}, stand:{walk:1.0} },
    extraEdges: [],
  },
  athlete: {
    label: '运动员', shortLabel: 'ATH',
    allowedStates: ['walk','run','jog','stand'],
    transitions: {},
    extraEdges: [],
  },
};

// Trait 定义：新增 trait 只需在此加一行
const TRAITS_DEF = [
  { key: 'smoker',   label: '🚬 抽烟', desc: '允许触发 smoke overlay' },
  { key: 'walk_dog', label: '🐕 遛狗', desc: '遛狗者特征（TODO: 狗实体）' },
];

// Overlay 定义：新增 overlay 在此加一行（pose 字段 = 视觉覆盖关节）
const OVERLAYS_DEF = [
  { key: '',           label: '— 无 —', on: [] },
  { key: 'phone_look', label: '📱 看手机', on: ['walk','stand','loiter','sit_bench','sit_ground','squat'],
    pose: { l_elbow:[-9,-8], r_elbow:[9,-8], l_hand:[-4,-18], r_hand:[4,-18] } },
  { key: 'phone_call', label: '📞 打电话', on: ['walk','stand','sit_bench','lean_wall','loiter'],
    pose: { r_elbow:[14,-5], r_hand:[14,2] } },
  { key: 'smoke',      label: '🚬 抽烟',  on: ['stand','lean_wall','sit_bench','loiter'], trait: 'smoker',
    pose: { r_elbow:[12,-8], r_hand:[10,-18] } },
  { key: 'hold_bag',   label: '👜 拿包',  on: ['walk','run','stand','loiter'],
    pose: { r_elbow:[16,-5], r_hand:[18,5] } },
  { key: 'cross_arm',  label: '🤚 抱臂',  on: ['stand'],
    pose: { l_elbow:[-14,-11], r_elbow:[14,-11], l_hand:[9,-19], r_hand:[-10,-18] } },
];

// 社交子事件：新增事件在此加一行（按钮自动出现）
const SUB_EVENTS_DEF = {
  push:      { label:'推搡', icon:'💢',
    aPose:{ r_hand:[45,-21], r_elbow:[22,-15], l_hand:[44,-21], l_elbow:[18,-15] },
    bPose: null,
    desc:'A 双手前推，B 进入 fall' },
  give_item: { label:'递物', icon:'📦',
    aPose:{ r_hand:[40,-21], r_elbow:[22,-14] },
    bPose:{ l_hand:[44,-22], l_elbow:[6,-14] },
    desc:'A 右手递，B 左手接' },
  handshake: { label:'握手', icon:'🤝',
    aPose:{ r_hand:[30,-21], r_elbow:[20,-13] },
    bPose:{ l_hand:[39,-22], l_elbow:[1,-13] },
    desc:'双方握手' },
  point_at:  { label:'指向', icon:'👆',
    aPose:{ r_hand:[50,-20], r_elbow:[24,-15] },
    bPose:{ head:[-6,-61] },
    desc:'A 指向，B 侧头' },
};

// 预设 pose（包含 overlay 衍生 + 社交预设）
const POSE_PRESETS = {
  'cross_arm':    { l_elbow:[-14,-11], r_elbow:[14,-11], l_hand:[9,-19], r_hand:[-10,-18] },
  'phone_look':   { l_elbow:[-9,-8],  r_elbow:[9,-8],   l_hand:[-4,-18], r_hand:[4,-18] },
  'phone_call':   { r_elbow:[14,-5],  r_hand:[14,2] },
  'smoke':        { r_elbow:[12,-8],  r_hand:[10,-18] },
  'hold_bag R':   { r_elbow:[16,-5],  r_hand:[18,5] },
  'loiter phone': { l_elbow:[-9,-8],  r_elbow:[9,-8],   l_hand:[-4,-18], r_hand:[4,-18] },
  'push A':       { r_hand:[45,-21],  r_elbow:[22,-15], l_hand:[44,-21], l_elbow:[18,-15] },
  'give A':       { r_hand:[40,-21],  r_elbow:[22,-14] },
  'give B':       { l_hand:[44,-22],  l_elbow:[6,-14] },
  'handshake A':  { r_hand:[30,-21],  r_elbow:[20,-13] },
  'handshake B':  { l_hand:[39,-22],  l_elbow:[1,-13] },
  'point A':      { r_hand:[50,-20],  r_elbow:[24,-15] },
  'point B':      { head:[-6,-61] },
};

// Graph 节点位置（0~1 相对坐标，渲染时乘 SVG 尺寸）
const GRAPH_POS = {
  walk:       [0.14, 0.10],
  run:        [0.38, 0.06],
  jog:        [0.60, 0.10],
  stand:      [0.14, 0.35],
  loiter:     [0.36, 0.35],
  lean_wall:  [0.60, 0.28],
  squat:      [0.80, 0.28],
  sit_bench:  [0.14, 0.58],
  sit_ground: [0.38, 0.58],
  lie_bench:  [0.60, 0.52],
  lie_ground: [0.14, 0.80],
  fall:       [0.40, 0.80],
  get_up:     [0.64, 0.80],
  talk:       [0.88, 0.45],
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
// ── RENDER HELPERS  （复刻 StickRenderer Canvas 2D 逻辑）──────────────────────
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
  if (data.anchorMode === 'back') return 0;
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

// ═══════════════════════════════════════════════════════════════════════════════
// ── NpcInstance ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let _npcNextId = 0;
class NpcInstance {
  constructor(palIdx) {
    this.id        = _npcNextId++;
    this.palIdx    = palIdx % NPC_PALETTE.length;
    this.pal       = NPC_PALETTE[this.palIdx];
    this.profileKey= 'pedestrian';
    this.state     = 'stand';
    this.animName  = 'single';
    this.animData  = null;
    this.frame     = 0;
    this.frameAcc  = 0;
    this.dir       = 1;
    this.traits    = new Set();
    this.overlayKey= '';
    this.overlayPose = {};
    this.customPoseJson = '';
    this.collapsed = false;
    // Interaction state
    this.interactPose = null;  // set by triggerInteraction
  }

  get profile() { return PROFILES[this.profileKey] || PROFILES.pedestrian; }

  // Final pose = interactPose > overlayPose > overlay preset
  get resolvedPose() {
    if (this.interactPose) return this.interactPose;
    const merged = {};
    const overlayDef = OVERLAYS_DEF.find(o => o.key === this.overlayKey);
    if (overlayDef && overlayDef.pose) Object.assign(merged, overlayDef.pose);
    Object.assign(merged, this.overlayPose);
    return merged;
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
    this.showLabels  = true;

    // Populate profile selector
    for (const [key, pd] of Object.entries(PROFILES)) {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = `${pd.label} [${pd.shortLabel}]`;
      profileSelectEl.appendChild(opt);
    }

    // Use ResizeObserver to re-render on size change
    new ResizeObserver(() => this.render()).observe(svgEl.parentElement);
  }

  setProfile(key) {
    this.profileKey = key;
    this.activeState = null;
    this.render();
  }

  setActiveState(state) {
    this.activeState = state;
    this.render();
  }

  render() {
    const showLabels = document.getElementById('showEdgeLabels')?.checked ?? true;
    const W = this.svg.clientWidth  || 340;
    const H = this.svg.clientHeight || 380;
    const profile = PROFILES[this.profileKey] || PROFILES.pedestrian;
    const PAD = 32, NR = 22;

    const nodeX = (k) => (GRAPH_POS[k]?.[0] ?? 0.5) * (W - PAD*2) + PAD;
    const nodeY = (k) => (GRAPH_POS[k]?.[1] ?? 0.5) * (H - PAD*2) + PAD;

    // Build SVG string
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

    // ── Edges ──
    const drawn = new Set();
    const transitions = profile.transitions || {};

    // Compute normalized probs per source state
    const normProbs = {};
    for (const [from, targets] of Object.entries(transitions)) {
      const total = Object.values(targets).reduce((a,b)=>a+b, 0) || 1;
      normProbs[from] = {};
      for (const [to, w] of Object.entries(targets)) {
        normProbs[from][to] = w / total;
      }
    }

    // Draw timeout transitions
    for (const [from, targets] of Object.entries(transitions)) {
      if (!GRAPH_POS[from]) continue;
      for (const [to, prob] of Object.entries(normProbs[from])) {
        if (!GRAPH_POS[to]) continue;
        const edgeKey = `${from}→${to}`;
        if (drawn.has(edgeKey)) continue;
        drawn.add(edgeKey);

        const reverseKey = `${to}→${from}`;
        const hasBoth = normProbs[to]?.[from] != null;
        const offset  = hasBoth ? 10 : 0;

        const x1 = nodeX(from), y1 = nodeY(from);
        const x2 = nodeX(to),   y2 = nodeY(to);
        const alpha = 0.3 + prob * 0.6;
        const sw    = 0.8 + prob * 2.2;
        const col   = CAT_COLORS[STATES[from]?.cat || 'idle'];

        svg += this._edgePath(x1,y1,x2,y2, NR, sw, col, alpha, offset, 'arr', showLabels ? `${(prob*100).toFixed(0)}%` : '');
      }
    }

    // Draw animDone / loiterChance extra edges
    for (const edge of (profile.extraEdges || [])) {
      if (!GRAPH_POS[edge.from] || !GRAPH_POS[edge.to]) continue;
      const x1 = nodeX(edge.from), y1 = nodeY(edge.from);
      const x2 = nodeX(edge.to),   y2 = nodeY(edge.to);
      const markerId = edge.style === 'anim' ? 'arr-anim' : 'arr-chance';
      const col = edge.style === 'anim' ? '#ffe066aa' : '#df6bffaa';
      const dash = edge.style === 'anim' ? '4,3' : '2,3';
      svg += this._edgePath(x1,y1,x2,y2, NR, 0.8, col, 0.8, -12, markerId, showLabels ? edge.label : '', dash);
    }

    // ── Nodes ──
    const allowed = new Set(profile.allowedStates || []);
    for (const [key, sdef] of Object.entries(STATES)) {
      if (!GRAPH_POS[key]) continue;
      const x = nodeX(key), y = nodeY(key);
      const color = CAT_COLORS[sdef.cat] || '#888';
      const isAllowed = allowed.has(key);
      const isActive  = this.activeState === key;
      const opacity   = isAllowed ? 1 : 0.28;
      const glow      = isActive  ? `filter="url(#glow)"` : '';
      const ring      = isActive  ? `<circle cx="${x}" cy="${y}" r="${NR+4}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>` : '';

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

  _edgePath(x1,y1,x2,y2, nr, sw, col, alpha, lateralOffset, markerId, label='', dash='') {
    const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy)||1;
    const ux = dx/len, uy = dy/len;
    // Start/end on node border
    const sx = x1 + ux*nr,  sy = y1 + uy*nr;
    const ex = x2 - ux*(nr+6), ey = y2 - uy*(nr+6);
    // Lateral offset (for bidirectional edges)
    const lx = -uy*lateralOffset, ly = ux*lateralOffset;
    // Control point for curve (perpendicular bulge)
    const cpx = (sx+ex)/2 + lx + (-uy*12);
    const cpy = (sy+ey)/2 + ly + (ux*12);
    const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
    let out = `<path d="M${sx+lx},${sy+ly} Q${cpx},${cpy} ${ex+lx},${ey+ly}"
      fill="none" stroke="${col}" stroke-width="${sw}" opacity="${alpha}"
      ${dashAttr} marker-end="url(#${markerId})"/>`;
    if (label) {
      const lbx = (sx+ex)/2 + lx + (-uy*16);
      const lby = (sy+ey)/2 + ly + (ux*16);
      out += `<text class="g-edge-label" x="${lbx}" y="${lby}">${label}</text>`;
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

const GROUND_Y_FRAC = 0.78;  // 地面线位置（相对画布高度）

class PreviewCanvas {
  constructor(canvasEl, onClick) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.interactA = null;
    this.interactB = null;
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

    // Background
    ctx.fillStyle = '#e8e4de';
    ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0,0,0,GROUND_Y);
    sky.addColorStop(0,'#c8c4be'); sky.addColorStop(1,'#e8e4de');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,GROUND_Y);

    // Ground
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

      // Selection ring
      if (isA || isB) {
        ctx.save();
        ctx.strokeStyle = isA ? '#4a9eff' : '#ff6b4a';
        ctx.lineWidth = 2; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(slotCx, GROUND_Y-50, 38, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }

      // Shadow
      ctx.save(); ctx.globalAlpha=0.1; ctx.fillStyle=npc.pal.stroke;
      ctx.beginPath(); ctx.ellipse(slotCx, GROUND_Y+3, 24, 5, 0, 0, Math.PI*2);
      ctx.fill(); ctx.restore();

      if (npc.animData) {
        // Compute scale to fit slot width nicely
        const maxW = Math.min(slotW * 0.8, 100);
        const scale = Math.max(0.55, Math.min(1.4, maxW / 45));
        this._drawPuppet(ctx, npc, slotCx, GROUND_Y, scale);
      }

      // Label below ground
      ctx.save();
      ctx.fillStyle = npc.pal.dot; ctx.globalAlpha = 0.85;
      ctx.font = '9px JetBrains Mono,monospace'; ctx.textAlign='center';
      const stateLabel = npc.animData
        ? `${npc.pal.label}: ${npc.state}  F${npc.frameLabel}`
        : `${npc.pal.label}: (loading...)`;
      ctx.fillText(stateLabel, slotCx, GROUND_Y + 20);
      if (npc.overlayKey) {
        ctx.fillStyle = '#ff9a4a'; ctx.globalAlpha = 0.75;
        ctx.fillText(`[${npc.overlayKey}]`, slotCx, GROUND_Y + 32);
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

    const coord = (j) => (pose[j] ? pose[j] : frameData[j]);
    const offsetY = calcOffsetY(animData, coord, isDog) * s;
    const jx = (j) => cx + coord(j)[0] * s * d;
    const jy = (j) => groundY + coord(j)[1] * s + offsetY;

    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    const baseCol = npc.pal.stroke;
    const ovCol   = '#ff6b4a';

    for (const [from, to, w] of bones) {
      if (!frameData[from] || !frameData[to]) continue;
      const bend  = getBend(from, to, frameData, animData.globalBend) * s * d;
      const isOv  = pose[from] || pose[to];
      ctx.strokeStyle = isOv ? ovCol : baseCol;
      ctx.lineWidth   = w * s * 1.8;
      drawBone(ctx, jx(from), jy(from), jx(to), jy(to), bend);
    }

    const headR = (isDog ? 6 : 9) * s;
    ctx.fillStyle = pose['head'] ? ovCol : baseCol;
    ctx.beginPath(); ctx.arc(jx('head'), jy('head'), headR, 0, Math.PI*2); ctx.fill();

    // OV joint dots
    ctx.fillStyle = ovCol;
    for (const jn of Object.keys(pose)) {
      if (!frameData[jn]) continue;
      ctx.beginPath(); ctx.arc(jx(jn), jy(jn), 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // Returns NPC index from canvas x coordinate
  hitTestSlot(mouseX, npcCount) {
    if (!npcCount) return -1;
    const slotW = this.canvas.width / npcCount;
    return Math.floor(mouseX / slotW);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── PlaybackController ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class PlaybackController {
  constructor(getNpcs, onTick) {
    this.getNpcs  = getNpcs;
    this.onTick   = onTick;
    this.playing  = false;
    this.speed    = 1;
    this._lastTs  = 0;
  }

  toggle() {
    this.playing = !this.playing;
    const btn = document.getElementById('playBtn');
    if (btn) btn.textContent = this.playing ? '⏸' : '▶';
    if (this.playing) {
      this._lastTs = performance.now();
      requestAnimationFrame(ts => this._loop(ts));
    }
  }

  step(delta) {
    if (this.playing) this.toggle();
    for (const npc of this.getNpcs()) npc.stepFrame(delta);
    this.onTick();
  }

  resetAllFrames() {
    for (const npc of this.getNpcs()) { npc.frame = 0; npc.frameAcc = 0; }
    this.onTick();
  }

  setSpeed(s) {
    this.speed = s;
    document.querySelectorAll('.spd').forEach(b => {
      b.classList.toggle('spd-act', parseFloat(b.dataset.s) === s);
    });
  }

  _loop(ts) {
    if (!this.playing) return;
    const dt = Math.min((ts - this._lastTs) / 1000, 0.1);
    this._lastTs = ts;
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
    this.interactA = null;  // NpcInstance reference for sub-event A
    this.interactB = null;  // NpcInstance reference for sub-event B
    this.activeInteraction = null;

    const canvas = document.getElementById('previewCanvas');
    this.preview = new PreviewCanvas(canvas, (mx, my) => this._canvasClick(mx, my, canvas));

    this.graph = new AnimGraph(
      document.getElementById('animGraph'),
      document.getElementById('graphProfile'),
      (state) => this._graphNodeClicked(state),
    );

    this.pb = new PlaybackController(
      () => this.npcs,
      () => this._renderFrame(),
    );

    this._bindKeys();
    this.addNpc();           // start with one NPC
    this.addNpc();           // and a second for interactions
    this.graph.render();
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
    this._renderPanel();
    this._renderFrame();
  }

  async setState(id, state) {
    const npc = this._byId(id); if (!npc) return;
    npc.interactPose = null;
    await npc.loadAnimForState(state);
    this.graph.setActiveState(state);
    this._renderPanel();
    this._renderFrame();
    this._setStatus(`NPC ${npc.pal.label} → ${state}`);
  }

  setProfile(id, key) {
    const npc = this._byId(id); if (!npc) return;
    npc.profileKey = key;
    // Sync graph if this is the "active" NPC
    this.graph.profileSel.value = key;
    this.graph.setProfile(key);
    this._renderPanel();
  }

  async setAnim(id, animName) {
    const npc = this._byId(id); if (!npc) return;
    await npc.loadAnim(animName);
    this._renderPanel();
    this._renderFrame();
  }

  setDir(id, dir) {
    const npc = this._byId(id); if (!npc) return;
    npc.dir = dir;
    this._renderFrame();
    this._renderPanel();
  }

  setOverlay(id, key) {
    const npc = this._byId(id); if (!npc) return;
    npc.overlayKey = key;
    this._renderFrame();
    this._renderPanel();
  }

  toggleTrait(id, traitKey, checked) {
    const npc = this._byId(id); if (!npc) return;
    checked ? npc.traits.add(traitKey) : npc.traits.delete(traitKey);
    this._renderPanel();
  }

  setPose(id, json) {
    const npc = this._byId(id); if (!npc) return;
    npc.customPoseJson = json;
    const ta = document.getElementById(`pose-ta-${id}`);
    if (!json.trim()) { npc.overlayPose = {}; ta?.classList.remove('err'); }
    else {
      try { npc.overlayPose = JSON.parse(json); ta?.classList.remove('err'); }
      catch(_) { ta?.classList.add('err'); }
    }
    this._renderFrame();
  }

  applyPreset(id, name) {
    if (!name) return;
    const npc = this._byId(id); if (!npc) return;
    const pose = POSE_PRESETS[name]; if (!pose) return;
    npc.overlayPose = { ...pose };
    const json = JSON.stringify(pose, null, 2);
    npc.customPoseJson = json;
    const ta = document.getElementById(`pose-ta-${id}`);
    if (ta) { ta.value = json; ta.classList.remove('err'); }
    this._renderFrame();
  }

  clearPose(id) {
    const npc = this._byId(id); if (!npc) return;
    npc.overlayPose = {}; npc.customPoseJson = '';
    const ta = document.getElementById(`pose-ta-${id}`);
    if (ta) { ta.value = ''; ta.classList.remove('err'); }
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
    npc.collapsed = !npc.collapsed;
    this._renderPanel();
  }

  // ── Interaction ──────────────────────────────────────────────────────────────

  setInteractA(id) {
    this.interactA = this._byId(id);
    this._renderPanel(); this._renderFrame();
  }

  setInteractB(id) {
    this.interactB = this._byId(id);
    this._renderPanel(); this._renderFrame();
  }

  triggerInteraction(type) {
    const cfg = SUB_EVENTS_DEF[type]; if (!cfg) return;
    if (!this.interactA || !this.interactB) {
      this._flash('请先选择 NPC A 和 NPC B'); return;
    }
    // Face each other
    this.interactA.dir = this.interactB.x_slot > this.interactA.x_slot ? 1 : 1;
    this.interactB.dir = -1;

    // Apply poses
    this.interactA.interactPose = cfg.aPose ? { ...cfg.aPose } : null;
    this.interactB.interactPose = cfg.bPose ? { ...cfg.bPose } : null;
    this.activeInteraction = type;

    this._renderPanel();
    this._renderFrame();
    this._setStatus(`交互: ${cfg.label} — ${cfg.desc}`);
  }

  resetInteraction() {
    if (this.interactA) this.interactA.interactPose = null;
    if (this.interactB) this.interactB.interactPose = null;
    this.activeInteraction = null;
    this._renderPanel();
    this._renderFrame();
  }

  // ── Export ───────────────────────────────────────────────────────────────────

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
        frame: npc.frame, dir: npc.dir, traits: [...npc.traits],
        overlay: npc.overlayKey, joints: merged,
        pose: Object.keys(npc.resolvedPose).length ? npc.resolvedPose : undefined,
      };
    }
    const json = JSON.stringify(out, null, 2);
    navigator.clipboard.writeText(json)
      .then(() => this._flash('已导出到剪贴板'))
      .catch(() => prompt('JSON:', json));
  }

  // ── Panel Rendering ──────────────────────────────────────────────────────────

  _renderPanel() {
    const panel = document.getElementById('controlPanel');
    let html = '';

    // ── Global: NPC count + Interaction ──
    html += this._renderGlobalSection();
    html += this._renderInteractionSection();

    // ── Per-NPC cards ──
    html += '<div class="npc-cards">';
    for (const npc of this.npcs) html += this._renderNpcCard(npc);
    html += '</div>';

    panel.innerHTML = html;

    // Restore textarea values (innerHTML wipes them)
    for (const npc of this.npcs) {
      const ta = document.getElementById(`pose-ta-${npc.id}`);
      if (ta && npc.customPoseJson) { ta.value = npc.customPoseJson; }
    }
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
        </div>
      </div>
    </div>`;
  }

  _renderInteractionSection() {
    const npcOpts = this.npcs.map(n =>
      `<option value="${n.id}">${n.pal.label}: ${n.profileKey}</option>`).join('');
    const selA = this.interactA?.id ?? '';
    const selB = this.interactB?.id ?? '';

    const subBtns = Object.entries(SUB_EVENTS_DEF).map(([type, cfg]) => {
      const isAct = this.activeInteraction === type ? ' active-interaction' : '';
      return `<button class="sm interact-btn${isAct}" onclick="app.triggerInteraction('${type}')"
        title="${cfg.desc}">${cfg.icon} ${cfg.label}</button>`;
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

    // Profile options
    const profileOpts = Object.entries(PROFILES).map(([k,p]) =>
      `<option value="${k}" ${k===npc.profileKey?'selected':''}>${p.label}</option>`).join('');

    // State options (only allowed states for this profile)
    const stateOpts = (npc.profile.allowedStates || Object.keys(STATES)).map(s =>
      `<option value="${s}" ${s===npc.state?'selected':''}>${s}</option>`).join('');

    // Anim options (free-form, for direct animation selection)
    const animOpts = ANIM_FILES.map(f =>
      `<option value="${f}" ${f===npc.animName?'selected':''}>${f}</option>`).join('');

    // Overlay options
    const overlayDefs = OVERLAYS_DEF.filter(o => {
      if (!o.key) return true;  // always show "none"
      if (o.trait && !npc.traits.has(o.trait)) return false;
      return true;
    });
    const overlayOpts = overlayDefs.map(o =>
      `<option value="${o.key}" ${o.key===npc.overlayKey?'selected':''}>${o.label}</option>`).join('');

    // Trait chips
    const traitChips = TRAITS_DEF.map(t => {
      const act = npc.traits.has(t.key) ? ' active' : '';
      return `<label class="trait-chip${act}" title="${t.desc}">
        <input type="checkbox" ${npc.traits.has(t.key)?'checked':''}
          onchange="app.toggleTrait(${npc.id},'${t.key}',this.checked)">
        ${t.label}
      </label>`;
    }).join('');

    // Preset options
    const presetOpts = Object.keys(POSE_PRESETS).map(k =>
      `<option value="${k}">${k}</option>`).join('');

    // Direction label
    const dirLabel = npc.dir > 0 ? '→ 右' : '← 左';

    // Badge
    const badge = npc.overlayKey
      ? `<span class="npc-state-badge">${npc.state} | ${npc.overlayKey}</span>`
      : `<span class="npc-state-badge">${npc.state}</span>`;

    const body = npc.collapsed ? '' : `
      <div class="npc-card-body">
        <!-- Profile + Dir -->
        <div class="cp-row">
          <span class="cp-label">Profile</span>
          <select onchange="app.setProfile(${npc.id},this.value)">${profileOpts}</select>
          <button class="sm" onclick="app.setDir(${npc.id},${npc.dir>0?-1:1})" style="flex-shrink:0">${dirLabel}</button>
        </div>
        <!-- State jump -->
        <div class="cp-row">
          <span class="cp-label">State</span>
          <select onchange="app.setState(${npc.id},this.value)">${stateOpts}</select>
        </div>
        <!-- Direct animation (free form) -->
        <div class="cp-row">
          <span class="cp-label">Anim</span>
          <select onchange="app.setAnim(${npc.id},this.value)">${animOpts}</select>
        </div>
        <!-- Traits -->
        <div class="cp-row">
          <span class="cp-label">Traits</span>
          <div class="trait-chips">${traitChips || '<span style="color:var(--fg3);font-size:10px">无</span>'}</div>
        </div>
        <!-- Overlay -->
        <div class="cp-row">
          <span class="cp-label">Overlay</span>
          <select onchange="app.setOverlay(${npc.id},this.value)">${overlayOpts}</select>
        </div>
        <!-- Pose JSON -->
        <details class="cp-detail">
          <summary>Overlay Pose JSON</summary>
          <div class="cp-row" style="margin-top:2px;gap:4px">
            <select style="flex:1" onchange="app.applyPreset(${npc.id},this.value)">
              <option value="">— 预设 —</option>${presetOpts}
            </select>
            <button class="sm blue" onclick="app.copyPose(${npc.id})">复制</button>
            <button class="sm" onclick="app.clearPose(${npc.id})">清</button>
          </div>
          <textarea id="pose-ta-${npc.id}" class="pose-input"
            placeholder='{"r_hand":[x,y],"r_elbow":[x,y]}'
            oninput="app.setPose(${npc.id},this.value)"></textarea>
        </details>
        <!-- Joint Coords -->
        <details class="cp-detail">
          <summary>关节坐标 (${npc.animName} F${npc.frameLabel})</summary>
          ${this._renderCoords(npc)}
        </details>
      </div>`;

    return `
    <div class="npc-card${intCls}">
      <div class="npc-card-hdr" onclick="app.toggleCollapse(${npc.id})">
        <div class="npc-dot" style="background:${npc.pal.dot};color:${npc.pal.dot}"></div>
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
    // Refresh coords inside open details (without full panel re-render)
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
      if (e.code==='Space')      { e.preventDefault(); this.pb.toggle(); }
      if (e.code==='ArrowLeft'||e.code==='KeyQ')  { e.preventDefault(); this.pb.step(-1); }
      if (e.code==='ArrowRight'||e.code==='KeyE') { e.preventDefault(); this.pb.step(1); }
    });
  }

  _canvasClick(mx, my, canvas) {
    const idx = this.preview.hitTestSlot(mx, this.npcs.length);
    if (idx < 0 || idx >= this.npcs.length) return;
    const npc = this.npcs[idx];
    // First click = set interaction A, second different click = set B
    if (!this.interactA || this.interactA === npc) {
      this.interactA = npc;
    } else {
      this.interactB = npc;
    }
    // Sync graph to this NPC's profile
    this.graph.profileSel.value = npc.profileKey;
    this.graph.setProfile(npc.profileKey);
    this._renderPanel();
    this._renderFrame();
    this._setStatus(`选中 NPC ${npc.pal.label} [${npc.profileKey}]`);
  }

  _graphNodeClicked(state) {
    // Switch ALL npcs to this animation, or just the focused one
    const stateDef = STATES[state];
    if (!stateDef) return;
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
