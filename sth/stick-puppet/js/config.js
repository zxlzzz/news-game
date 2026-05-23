// 骨骼预设系统

export const SKELETONS = {
  human: {
    name: '人',
    headJoint: 'head',
    headRadius: 16,
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
    labels: {
      head:'头', neck:'颈', body:'腰',
      l_elbow:'左肘', r_elbow:'右肘', l_hand:'左手', r_hand:'右手',
      l_knee:'左膝', r_knee:'右膝', l_foot:'左脚', r_foot:'右脚',
    },
    // bones: [from, to, width, bend]  bend=垂直偏移px，正=左偏，负=右偏
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
    defaultPose: {
      head:{x:0,y:-100}, neck:{x:0,y:-70},
      l_elbow:{x:-24,y:-40}, r_elbow:{x:24,y:-40},
      l_hand:{x:-32,y:-12}, r_hand:{x:32,y:-12},
      body:{x:0,y:0},
      l_knee:{x:-10,y:40}, r_knee:{x:10,y:40},
      l_foot:{x:-14,y:82}, r_foot:{x:14,y:82},
    },
  },

  dog: {
    name: '狗',
    headJoint: 'head',
    headRadius: 14,
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
    name: '猫',
    headJoint: 'head',
    headRadius: 12,
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
    name: '小孩',
    headJoint: 'head',
    headRadius: 14,
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

export const JOINT_RADIUS = 6;
export const GRAB_RADIUS = 12;

// 当前激活的骨骼
let currentSkeleton = SKELETONS.human;

export function setSkeleton(name) {
  if (SKELETONS[name]) currentSkeleton = SKELETONS[name];
}
export function getSkeleton() { return currentSkeleton; }
export function getJointNames() { return Object.keys(currentSkeleton.hierarchy); }

export function clonePose(p) {
  const c = {};
  for (const k of getJointNames()) c[k] = {x:p[k].x, y:p[k].y};
  // 复制 per-frame bend 覆盖值
  for (const k of Object.keys(p)) {
    if (k.startsWith('_bend_')) c[k] = p[k];
  }
  return c;
}

export function defaultPose() {
  return clonePose(currentSkeleton.defaultPose);
}

export function getDescendants(joint) {
  const h = currentSkeleton.hierarchy;
  const res = [], stk = [joint];
  while (stk.length) {
    const j = stk.pop();
    for (const ch of h[j].children) { res.push(ch); stk.push(ch); }
  }
  return res;
}

// ============================================
// Bend API
// ============================================

// 全局 bend 锁（默认锁定 = 修改同步所有帧）
export let bendLocked = true;
export function setBendLocked(v) { bendLocked = v; }

// key 格式：`from__to`
function bendKey(from, to) { return `${from}__${to}`; }

/** 获取骨骼的全局 bend（从 bones 数组第4列读） */
export function getGlobalBend(from, to) {
  const bone = currentSkeleton.bones.find(b => b[0]===from && b[1]===to);
  return bone ? (bone[3] ?? 0) : 0;
}

/** 设置全局 bend */
export function setGlobalBend(from, to, val) {
  const bone = currentSkeleton.bones.find(b => b[0]===from && b[1]===to);
  if (bone) bone[3] = val;
}

/** 获取某帧的 bend（有 per-frame 覆盖则用覆盖值，否则用全局） */
export function getBend(from, to, pose) {
  const k = '_bend_' + bendKey(from, to);
  return (pose && k in pose) ? pose[k] : getGlobalBend(from, to);
}

/** 设置 bend：
 *  - bendLocked=true  → 改全局，清空所有帧的覆盖值
 *  - bendLocked=false → 只写 per-frame 覆盖
 */
export function setBend(from, to, val, pose, allFrames) {
  if (bendLocked) {
    setGlobalBend(from, to, val);
    // 清除所有帧的覆盖，让它们跟随全局
    if (allFrames) {
      const k = '_bend_' + bendKey(from, to);
      for (const f of allFrames) delete f[k];
    }
  } else {
    // per-frame 覆盖
    const k = '_bend_' + bendKey(from, to);
    pose[k] = val;
  }
}

// ============================================
// Bone Length API
// ============================================

export let lengthLocked = true;
export function setLengthLocked(v) { lengthLocked = v; }

/** 从 defaultPose 计算某骨骼的原始长度（作为"全局长度"基准） */
export function getGlobalBoneLength(from, to) {
  const dp = currentSkeleton.defaultPose;
  if (!dp[from] || !dp[to]) return null;
  return Math.hypot(dp[to].x - dp[from].x, dp[to].y - dp[from].y);
}

/**
 * 设置全局骨骼长度：
 *   更新 defaultPose 里的 `to` 节点位置（及其后代），
 *   并对 allFrames 里每一帧做同样的缩放。
 */
export function setGlobalBoneLength(from, to, newLen, allFrames) {
  const dp = currentSkeleton.defaultPose;
  const dx = dp[to].x - dp[from].x;
  const dy = dp[to].y - dp[from].y;
  const oldLen = Math.hypot(dx, dy) || 1;
  const scale = newLen / oldLen;
  const offX = dp[from].x + dx * scale - dp[to].x;
  const offY = dp[from].y + dy * scale - dp[to].y;

  // 更新 defaultPose
  dp[to].x += offX; dp[to].y += offY;
  for (const desc of getDescendants(to)) {
    dp[desc].x += offX; dp[desc].y += offY;
  }

  // 同步所有帧
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