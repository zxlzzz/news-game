// 骨骼系统 — 编辑器元数据 + 从 assets/skeleton.json 加载层级结构

// ── 编辑器元数据（labels / bones / mirrorPairs / defaultPose 不来自 skeleton.json）──
const _EDITOR_DATA = {
  human: {
    name: '人', headJoint: 'head', headRadius: 16,
    labels: {
      head:'头', neck:'颈', body:'腰',
      l_elbow:'左肘', r_elbow:'右肘', l_hand:'左手', r_hand:'右手',
      l_knee:'左膝', r_knee:'右膝', l_foot:'左脚', r_foot:'右脚',
    },
    bones: [
      ['body','neck',6,0], ['neck','head',5,0],
      ['neck','l_elbow',5,0], ['l_elbow','l_hand',4,0],
      ['neck','r_elbow',5,0], ['r_elbow','r_hand',4,0],
      ['body','l_knee',5,0], ['l_knee','l_foot',4,0],
      ['body','r_knee',5,0], ['r_knee','r_foot',4,0],
    ],
    mirrorPairs: [
      ['l_elbow','r_elbow'], ['l_hand','r_hand'],
      ['l_knee','r_knee'], ['l_foot','r_foot'],
    ],
    // hierarchy fallback（skeleton.json 覆盖）
    hierarchy: {
      body:    { parent: null,      children: ['neck', 'l_knee', 'r_knee'] },
      neck:    { parent: 'body',    children: ['head', 'l_elbow', 'r_elbow'] },
      head:    { parent: 'neck',    children: [] },
      l_elbow: { parent: 'neck',    children: ['l_hand'] },
      r_elbow: { parent: 'neck',    children: ['r_hand'] },
      l_hand:  { parent: 'l_elbow', children: [] },
      r_hand:  { parent: 'r_elbow', children: [] },
      l_knee:  { parent: 'body',    children: ['l_foot'] },
      r_knee:  { parent: 'body',    children: ['r_foot'] },
      l_foot:  { parent: 'l_knee',  children: [] },
      r_foot:  { parent: 'r_knee',  children: [] },
    },
    // idle pose: stand.json kf0 delta + skeleton.json defaultPose → body-relative
    defaultPose: {
      head:{x:0,y:-75}, neck:{x:0,y:-50},
      l_elbow:{x:-19,y:-27}, r_elbow:{x:19,y:-27},
      l_hand:{x:-26,y:-3}, r_hand:{x:26,y:-3},
      body:{x:0,y:0},
      l_knee:{x:-9,y:34}, r_knee:{x:9,y:34},
      l_foot:{x:-12,y:69}, r_foot:{x:12,y:69},
    },
  },

  dog: {
    name: '狗', headJoint: 'head', headRadius: 14,
    labels: {
      head:'头', neck:'颈', body_front:'前身', body_back:'后身', tail:'尾',
      fl_upper:'左前上腿', fl_lower:'左前下腿',
      fr_upper:'右前上腿', fr_lower:'右前下腿',
      bl_upper:'左后上腿', bl_lower:'左后下腿',
      br_upper:'右后上腿', br_lower:'右后下腿',
    },
    bones: [
      ['body_back','body_front',6,0], ['body_front','neck',5,0], ['neck','head',4,0],
      ['body_back','tail',3,0],
      ['body_front','fl_upper',4,0], ['fl_upper','fl_lower',3,0],
      ['body_front','fr_upper',4,0], ['fr_upper','fr_lower',3,0],
      ['body_back','bl_upper',4,0],  ['bl_upper','bl_lower',3,0],
      ['body_back','br_upper',4,0],  ['br_upper','br_lower',3,0],
    ],
    mirrorPairs: [
      ['fl_upper','fr_upper'], ['fl_lower','fr_lower'],
      ['bl_upper','br_upper'], ['bl_lower','br_lower'],
    ],
    hierarchy: {
      body_back: { parent: null,         children: ['body_front', 'bl_upper', 'br_upper', 'tail'] },
      body_front:{ parent: 'body_back',  children: ['neck', 'fl_upper', 'fr_upper'] },
      neck:      { parent: 'body_front', children: ['head'] },
      head:      { parent: 'neck',       children: [] },
      tail:      { parent: 'body_back',  children: [] },
      fl_upper:  { parent: 'body_front', children: ['fl_lower'] },
      fl_lower:  { parent: 'fl_upper',   children: [] },
      fr_upper:  { parent: 'body_front', children: ['fr_lower'] },
      fr_lower:  { parent: 'fr_upper',   children: [] },
      bl_upper:  { parent: 'body_back',  children: ['bl_lower'] },
      bl_lower:  { parent: 'bl_upper',   children: [] },
      br_upper:  { parent: 'body_back',  children: ['br_lower'] },
      br_lower:  { parent: 'br_upper',   children: [] },
    },
    defaultPose: {
      head:{x:-100,y:-20}, neck:{x:-75,y:-10}, body_front:{x:-40,y:0}, body_back:{x:40,y:0},
      tail:{x:75,y:-15},
      fl_upper:{x:-50,y:25}, fl_lower:{x:-52,y:55},
      fr_upper:{x:-30,y:25}, fr_lower:{x:-28,y:55},
      bl_upper:{x:30,y:25},  bl_lower:{x:32,y:55},
      br_upper:{x:50,y:25},  br_lower:{x:48,y:55},
    },
  },

  cat: {
    name: '猫', headJoint: 'head', headRadius: 12,
    labels: {
      head:'头', neck:'颈', body_front:'前身', body_back:'后身', tail:'尾',
      fl_upper:'左前上腿', fl_lower:'左前下腿',
      fr_upper:'右前上腿', fr_lower:'右前下腿',
      bl_upper:'左后上腿', bl_lower:'左后下腿',
      br_upper:'右后上腿', br_lower:'右后下腿',
    },
    bones: [
      ['body_back','body_front',5,0], ['body_front','neck',4,0], ['neck','head',3,0],
      ['body_back','tail',2,0],
      ['body_front','fl_upper',3,0], ['fl_upper','fl_lower',2.5,0],
      ['body_front','fr_upper',3,0], ['fr_upper','fr_lower',2.5,0],
      ['body_back','bl_upper',3,0],  ['bl_upper','bl_lower',2.5,0],
      ['body_back','br_upper',3,0],  ['br_upper','br_lower',2.5,0],
    ],
    mirrorPairs: [
      ['fl_upper','fr_upper'], ['fl_lower','fr_lower'],
      ['bl_upper','br_upper'], ['bl_lower','br_lower'],
    ],
    hierarchy: {
      body_back: { parent: null,         children: ['body_front', 'bl_upper', 'br_upper', 'tail'] },
      body_front:{ parent: 'body_back',  children: ['neck', 'fl_upper', 'fr_upper'] },
      neck:      { parent: 'body_front', children: ['head'] },
      head:      { parent: 'neck',       children: [] },
      tail:      { parent: 'body_back',  children: [] },
      fl_upper:  { parent: 'body_front', children: ['fl_lower'] },
      fl_lower:  { parent: 'fl_upper',   children: [] },
      fr_upper:  { parent: 'body_front', children: ['fr_lower'] },
      fr_lower:  { parent: 'fr_upper',   children: [] },
      bl_upper:  { parent: 'body_back',  children: ['bl_lower'] },
      bl_lower:  { parent: 'bl_upper',   children: [] },
      br_upper:  { parent: 'body_back',  children: ['br_lower'] },
      br_lower:  { parent: 'br_upper',   children: [] },
    },
    defaultPose: {
      head:{x:-75,y:-15}, neck:{x:-55,y:-5}, body_front:{x:-25,y:0}, body_back:{x:25,y:0},
      tail:{x:60,y:-20},
      fl_upper:{x:-32,y:18}, fl_lower:{x:-34,y:40},
      fr_upper:{x:-18,y:18}, fr_lower:{x:-16,y:40},
      bl_upper:{x:18,y:18},  bl_lower:{x:20,y:40},
      br_upper:{x:32,y:18},  br_lower:{x:30,y:40},
    },
  },

  child: {
    name: '小孩', headJoint: 'head', headRadius: 14,
    labels: {
      head:'头', neck:'颈', body:'腰',
      l_elbow:'左肘', r_elbow:'右肘', l_hand:'左手', r_hand:'右手',
      l_knee:'左膝', r_knee:'右膝', l_foot:'左脚', r_foot:'右脚',
    },
    bones: [
      ['body','neck',5,0], ['neck','head',4,0],
      ['neck','l_elbow',4,0], ['l_elbow','l_hand',3,0],
      ['neck','r_elbow',4,0], ['r_elbow','r_hand',3,0],
      ['body','l_knee',4,0], ['l_knee','l_foot',3,0],
      ['body','r_knee',4,0], ['r_knee','r_foot',3,0],
    ],
    mirrorPairs: [
      ['l_elbow','r_elbow'], ['l_hand','r_hand'],
      ['l_knee','r_knee'], ['l_foot','r_foot'],
    ],
    hierarchy: {
      body:    { parent: null,      children: ['neck', 'l_knee', 'r_knee'] },
      neck:    { parent: 'body',    children: ['head', 'l_elbow', 'r_elbow'] },
      head:    { parent: 'neck',    children: [] },
      l_elbow: { parent: 'neck',    children: ['l_hand'] },
      r_elbow: { parent: 'neck',    children: ['r_hand'] },
      l_hand:  { parent: 'l_elbow', children: [] },
      r_hand:  { parent: 'r_elbow', children: [] },
      l_knee:  { parent: 'body',    children: ['l_foot'] },
      r_knee:  { parent: 'body',    children: ['r_foot'] },
      l_foot:  { parent: 'l_knee',  children: [] },
      r_foot:  { parent: 'r_knee',  children: [] },
    },
    defaultPose: {
      head:{x:0,y:-65}, neck:{x:0,y:-45},
      l_elbow:{x:-16,y:-26}, r_elbow:{x:16,y:-26},
      l_hand:{x:-22,y:-8}, r_hand:{x:22,y:-8},
      body:{x:0,y:0},
      l_knee:{x:-7,y:25}, r_knee:{x:7,y:25},
      l_foot:{x:-10,y:50}, r_foot:{x:10,y:50},
    },
  },
};

// ── 公共 SKELETONS 对象（由 initSkeletons() 填充）────────────────────────────
export const SKELETONS = {};

function _buildHierarchy(root, joints) {
  const h = {};
  h[root] = { parent: null, children: [] };
  for (const [name, data] of Object.entries(joints)) {
    if (!h[name]) h[name] = { parent: data.parent, children: [] };
    else h[name].parent = data.parent;
    if (!h[data.parent]) h[data.parent] = { parent: null, children: [] };
    if (!h[data.parent].children.includes(name)) h[data.parent].children.push(name);
  }
  return h;
}

/**
 * 从 assets/skeleton.json 加载 human/dog 的层级结构、defaultPose、headRadius。
 * cat/child 使用内置定义。必须在 app.js 初始化时 await。
 *
 * skeleton.json 的 defaultPose 是地面空间（脚部 y=0），
 * 编辑器使用以 root 关节为原点的坐标系，因此加载时做平移：
 *   editor_y = ground_y − root_ground_y
 */
export async function initSkeletons() {
  // 先用编辑器定义初始化全部四套
  for (const [k, v] of Object.entries(_EDITOR_DATA)) {
    SKELETONS[k] = { ...v, hierarchy: { ...v.hierarchy } };
    for (const node of Object.values(SKELETONS[k].hierarchy)) {
      node.children = [...node.children];
    }
    // deep-copy defaultPose
    const dp = {};
    for (const [j, p] of Object.entries(v.defaultPose)) dp[j] = { x: p.x, y: p.y };
    SKELETONS[k].defaultPose = dp;
  }

  // 用 skeleton.json 覆盖 human / dog
  try {
    const r = await fetch('../../assets/skeleton.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    for (const [name, skData] of Object.entries(data.skeletons ?? {})) {
      if (!SKELETONS[name]) continue;

      // 层级
      if (skData.root && skData.joints) {
        SKELETONS[name].hierarchy = _buildHierarchy(skData.root, skData.joints);
      }

      // headRadius
      if (skData.headRadius != null) SKELETONS[name].headRadius = skData.headRadius;

      // defaultPose: 地面空间 → 编辑器空间（以 root 关节为 y 原点）
      if (skData.defaultPose && skData.root) {
        const groundPose = skData.defaultPose;
        const rootGroundY = (groundPose[skData.root] ?? [0, 0])[1];
        const offsetY = -rootGroundY;
        const editorPose = {};
        for (const [joint, coords] of Object.entries(groundPose)) {
          editorPose[joint] = { x: coords[0], y: coords[1] + offsetY };
        }
        SKELETONS[name].defaultPose = editorPose;
      }
    }
  } catch (e) {
    console.warn('[stick-puppet] skeleton.json 加载失败，使用内置定义', e.message);
  }
}

export const JOINT_RADIUS = 6;
export const GRAB_RADIUS = 12;

// 当前激活的骨骼
let currentSkeleton = null;  // 由 initSkeletons 完成后再设

export function setSkeleton(name) {
  if (SKELETONS[name]) currentSkeleton = SKELETONS[name];
}
export function getSkeleton() { return currentSkeleton ?? SKELETONS.human; }
export function getJointNames() { return Object.keys(getSkeleton().hierarchy); }

export function clonePose(p) {
  const c = {};
  for (const k of getJointNames()) {
    if (p[k]) c[k] = {x: p[k].x, y: p[k].y};
    else c[k] = {x: 0, y: 0};
  }
  for (const k of Object.keys(p)) {
    if (k.startsWith('_bend_')) c[k] = p[k];
  }
  return c;
}

export function defaultPose() {
  return clonePose(getSkeleton().defaultPose);
}

export function getDescendants(joint) {
  const h = getSkeleton().hierarchy;
  const res = [], stk = [joint];
  while (stk.length) {
    const j = stk.pop();
    for (const ch of (h[j]?.children ?? [])) { res.push(ch); stk.push(ch); }
  }
  return res;
}

// ── Bend API ─────────────────────────────────────────────────────────────────
export let bendLocked = true;
export function setBendLocked(v) { bendLocked = v; }

function bendKey(from, to) { return `${from}__${to}`; }

export function getGlobalBend(from, to) {
  const bone = getSkeleton().bones.find(b => b[0]===from && b[1]===to);
  return bone ? (bone[3] ?? 0) : 0;
}

export function setGlobalBend(from, to, val) {
  const bone = getSkeleton().bones.find(b => b[0]===from && b[1]===to);
  if (bone) bone[3] = val;
}

export function getBend(from, to, pose) {
  const k = '_bend_' + bendKey(from, to);
  return (pose && k in pose) ? pose[k] : getGlobalBend(from, to);
}

export function setBend(from, to, val, pose, allFrames) {
  if (bendLocked) {
    setGlobalBend(from, to, val);
    if (allFrames) {
      const k = '_bend_' + bendKey(from, to);
      for (const f of allFrames) delete f[k];
    }
  } else {
    pose['_bend_' + bendKey(from, to)] = val;
  }
}

// ── Bone Length API ───────────────────────────────────────────────────────────
export let lengthLocked = true;
export function setLengthLocked(v) { lengthLocked = v; }

export function getGlobalBoneLength(from, to) {
  const dp = getSkeleton().defaultPose;
  if (!dp[from] || !dp[to]) return null;
  return Math.hypot(dp[to].x - dp[from].x, dp[to].y - dp[from].y);
}

export function setGlobalBoneLength(from, to, newLen, allFrames) {
  const dp = getSkeleton().defaultPose;
  const dx = dp[to].x - dp[from].x;
  const dy = dp[to].y - dp[from].y;
  const oldLen = Math.hypot(dx, dy) || 1;
  const scale = newLen / oldLen;
  const offX = dp[from].x + dx * scale - dp[to].x;
  const offY = dp[from].y + dy * scale - dp[to].y;

  dp[to].x += offX; dp[to].y += offY;
  for (const desc of getDescendants(to)) {
    dp[desc].x += offX; dp[desc].y += offY;
  }

  if (allFrames) {
    for (const pose of allFrames) {
      const fdx = pose[to].x - pose[from].x;
      const fdy = pose[to].y - pose[from].y;
      const fOld = Math.hypot(fdx, fdy) || 1;
      const fScale = newLen / fOld;
      const fOffX = pose[from].x + fdx * fScale - pose[to].x;
      const fOffY = pose[from].y + fdy * fScale - pose[to].y;
      pose[to].x += fOffX; pose[to].y += fOffY;
      for (const desc of getDescendants(to)) {
        pose[desc].x += fOffX; pose[desc].y += fOffY;
      }
    }
  }
}
