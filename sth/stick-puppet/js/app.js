import {
  SKELETONS, JOINT_RADIUS, GRAB_RADIUS,
  initSkeletons,
  setSkeleton, getSkeleton, getJointNames,
  defaultPose, clonePose, getDescendants,
  getBend, setBend, getGlobalBend, setGlobalBend,
  bendLocked, setBendLocked,
  lengthLocked, setLengthLocked,
  getGlobalBoneLength, setGlobalBoneLength,
} from './config.js';
import { History } from './history.js';

// ── 状态 ──────────────────────────────────────────────────────────────────────
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const CX = canvas.width / 2;
const CY = canvas.height / 2 + 20;

let frames = [];
let currentFrame = 0;
let dragging = null;
let dragStarted = false;
let playing = false;
let playTimer = null;
let boneLocked = true;
let gestureMode = false;
let activeJoints = new Set();
let frameDurs = [0.3];

const history = new History();

// Clip 浏览器
let manifestData = null;
let loadedClipMeta = null;   // 当前已载入 clip 的完整 schema 元数据

// 合成预览（overlay 模式）
let previewEnabled = false;
let previewBaseDecoded = null;  // 解码后的 base clip 帧数组

// 衔接检查（transition 模式）
let transitionOnion = null;     // { fromFrame: pose|null, toFrame: pose|null }

// Duet 模式（kind=overlay with participants）
let duetMode = false;
let duetRoles = [];         // [{role, skelName, offset:{x,y}, frames:[]}]
let activeDuetRoleIdx = 0;
let draggingRoleOffset = -1; // index of role whose offset is being dragged

// Variant 模式（kind=cycle, variant_of set, no keyframes）
let variantMode = false;
let variantParams = { variant_of: '', amp: 1, ref_speed: null, overlay: null };
let variantBaseDecoded = null; // decoded base clip frames for variant preview

// Screen offset used during duet rendering so toScreen() accounts for role position
let _screenOffsetX = 0, _screenOffsetY = 0;

// 全局平移模式
let translateMode = false;
let _translateLastX = 0, _translateLastY = 0;

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function toScreen(j) { return {x: CX + j.x + _screenOffsetX, y: CY + j.y + _screenOffsetY}; }

function getMousePos(e) {
  const r = canvas.getBoundingClientRect();
  return {x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height)};
}

function setInfo(text) { document.getElementById('infoText').textContent = text; }
function showLoading(text) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }

function switchSkeleton(name) {
  history.save(frames, currentFrame);
  setSkeleton(name);
  frames = [defaultPose()];
  frameDurs = [0.3];
  currentFrame = 0;
  loadedClipMeta = null;
  previewBaseDecoded = null;
  transitionOnion = null;
  duetMode = false; duetRoles = [];
  variantMode = false;
  _screenOffsetX = 0; _screenOffsetY = 0;
  document.getElementById('coordsPanel').dataset.built = '';
  document.getElementById('boneLengthPanel').dataset.built = '';
  document.getElementById('transitionSection').style.display = 'none';
  render();
  setInfo(`切换到: ${getSkeleton().name}`);
}

// ── Keyframe 解码（新 schema → 编辑器绝对坐标）──────────────────────────────
// kf[j] = [dx, dy] — delta = absolute − skeleton.defaultPose
// 解码: absolute = defaultPose + delta
function _decodeKf(kf) {
  const sk = getSkeleton();
  const dp = sk.defaultPose;
  const pose = clonePose(dp);
  for (const [name, val] of Object.entries(kf)) {
    if (name === 'dur') continue;
    if (name.startsWith('_bend_')) { pose[name] = val; continue; }
    if (!Array.isArray(val) || val.length !== 2) continue;
    if (dp[name]) pose[name] = { x: dp[name].x + val[0], y: dp[name].y + val[1] };
  }
  return pose;
}

// ── Clip 浏览器 ────────────────────────────────────────────────────────────────
async function loadManifest() {
  try {
    const r = await fetch('../../assets/manifest.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    manifestData = await r.json();
    _populateBaseClipSelect();
    filterClips();
  } catch (e) {
    console.warn('[stick-puppet] manifest.json 加载失败', e.message);
  }
}

function _populateBaseClipSelect() {
  const sel = document.getElementById('previewBaseSelect');
  sel.innerHTML = '<option value="">-- 选择 cycle/transition clip --</option>';
  for (const [id, entry] of Object.entries(manifestData?.clips ?? {})) {
    if (entry.kind !== 'cycle' && entry.kind !== 'transition') continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id + (entry.facing ? ` (${entry.facing})` : '');
    sel.appendChild(opt);
  }
}

function filterClips() {
  const typeF   = document.getElementById('clipTypeFilter')?.value ?? '';
  const facingF = document.getElementById('clipFacingFilter')?.value ?? '';
  const tagF    = (document.getElementById('clipTagFilter')?.value ?? '').toLowerCase();

  const sel = document.getElementById('clipBrowserList');
  sel.innerHTML = '';
  if (!manifestData) return;

  for (const [id, entry] of Object.entries(manifestData.clips ?? {})) {
    const effectiveKind = entry.variant_of ? 'variant' : entry.kind;
    if (typeF === 'variant' && !entry.variant_of) continue;
    if (typeF && typeF !== 'variant' && entry.kind !== typeF) continue;
    if (facingF === 'side'  && entry.facing === 'front') continue;
    if (facingF === 'front' && entry.facing !== 'front') continue;
    if (tagF && !id.toLowerCase().includes(tagF)) continue;

    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `[${effectiveKind}] ${id}` + (entry.facing ? ` (${entry.facing})` : '');
    sel.appendChild(opt);
  }
}

async function loadClipFromBrowser() {
  const sel = document.getElementById('clipBrowserList');
  const clipId = sel.value;
  if (!clipId || !manifestData) return;
  const entry = manifestData.clips[clipId];
  if (!entry) return;

  showLoading(`载入 ${clipId}…`);
  try {
    const r = await fetch('../../assets/' + entry.path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    hideLoading();

    loadedClipMeta = { id: clipId, ...entry };
    _loadClipData(clipId, entry, data);

    // 衔接检查：transition clip 加载 from/to 边界帧
    if (entry.kind === 'transition') {
      await _loadTransitionOnion(entry.from ?? null, entry.to ?? null);
    } else {
      transitionOnion = null;
    }

    const info = [`kind:${entry.kind}`];
    if (entry.skeleton) info.push(`skel:${entry.skeleton}`);
    if (entry.variant_of) info.push(`variant_of:${entry.variant_of}`);
    if (entry.from) info.push(`from:${entry.from}`);
    if (entry.to)   info.push(`to:${entry.to}`);
    document.getElementById('clipBrowserInfo').textContent = info.join('  ');

    document.getElementById('framesStrip').innerHTML = '';
    currentFrame = 0;
    render();
    setInfo(`载入: ${clipId}`);
  } catch (e) {
    hideLoading();
    alert('载入失败: ' + e.message);
  }
}

function _loadClipData(id, meta, data) {
  const kind = meta.kind ?? (data.kind ?? 'cycle');
  history.save(frames, currentFrame);

  // Reset mode flags
  duetMode = false;
  duetRoles = [];
  variantMode = false;
  variantParams = { variant_of: '', amp: 1, ref_speed: null, overlay: null };
  variantBaseDecoded = null;
  _screenOffsetX = 0; _screenOffsetY = 0;
  _hideAllModePanels();

  // Switch skeleton if specified
  const skelName = data.skeleton ?? 'human';
  if (SKELETONS[skelName]) {
    setSkeleton(skelName);
    document.getElementById('skeletonSelect').value = skelName;
    document.getElementById('coordsPanel').dataset.built = '';
    document.getElementById('boneLengthPanel').dataset.built = '';
  }

  const kfs = data.keyframes ?? [];
  const isDuet = kind === 'overlay' && Array.isArray(data.participants) && data.participants.length > 0
    && kfs.length > 0 && _isRoleGrouped(kfs);
  const isVariant = (kind === 'cycle' || !kind) && data.variant_of && !kfs.length;
  const isOverlay = kind === 'overlay' && !isDuet;

  gestureMode = false;
  document.getElementById('gestureModeBtn').classList.remove('active-toggle');
  document.getElementById('jointSelectPanel').style.display = 'none';

  if (isDuet) {
    _enterDuetMode(data);
    return;
  }

  if (isVariant) {
    _enterVariantMode(data);
    return;
  }

  if (isOverlay) {
    gestureMode = true;
    activeJoints = new Set(Array.isArray(data.activeJoints) ? data.activeJoints : []);
    document.getElementById('gestureModeBtn').classList.add('active-toggle');
    document.getElementById('jointSelectPanel').style.display = '';
    _buildJointCheckboxes();
  }

  frames = []; frameDurs = [];
  for (const kf of kfs) {
    frames.push(_decodeKf(kf));
    frameDurs.push(typeof kf.dur === 'number' ? kf.dur : 0.3);
  }
  if (!frames.length) { frames = [defaultPose()]; frameDurs = [0.3]; }
  currentFrame = 0;
}

function _isRoleGrouped(kfs) {
  if (!kfs.length) return false;
  return Object.keys(kfs[0]).every(k => {
    if (k === 'dur') return true;
    const v = kfs[0][k];
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  });
}

function _hideAllModePanels() {
  document.getElementById('duetPanel').style.display = 'none';
  document.getElementById('variantPanel').style.display = 'none';
  document.getElementById('transitionSection').style.display = 'none';
}

function _enterDuetMode(data) {
  duetMode = true;
  const participants = data.participants;
  duetRoles = participants.map(p => ({
    role: p.role,
    skelName: p.skeleton ?? 'human',
    offset: { x: 0, y: 0 },
    frames: [],
  }));
  // Default horizontal spread: role 0 at -80, role 1 at +80
  if (duetRoles.length >= 2) {
    duetRoles[0].offset = { x: -80, y: 0 };
    duetRoles[1].offset = { x: 80, y: 0 };
  }
  // Decode frames per role
  const kfs = data.keyframes ?? [];
  frameDurs = [];
  for (const kf of kfs) {
    frameDurs.push(typeof kf.dur === 'number' ? kf.dur : 0.3);
  }
  for (const roleInfo of duetRoles) {
    const sk = SKELETONS[roleInfo.skelName] ?? getSkeleton();
    roleInfo.frames = kfs.map(kf => _decodeKfForSkel(kf[roleInfo.role] ?? {}, roleInfo.skelName));
  }
  activeDuetRoleIdx = 0;
  _applyActiveDuetRole();
  _buildDuetRoleButtons();
  document.getElementById('duetPanel').style.display = '';
}

function _applyActiveDuetRole() {
  const role = duetRoles[activeDuetRoleIdx];
  if (!SKELETONS[role.skelName]) return;
  setSkeleton(role.skelName);
  document.getElementById('skeletonSelect').value = role.skelName;
  document.getElementById('coordsPanel').dataset.built = '';
  document.getElementById('boneLengthPanel').dataset.built = '';
  frames = role.frames;
  _screenOffsetX = role.offset.x;
  _screenOffsetY = role.offset.y;
  currentFrame = Math.min(currentFrame, frames.length - 1);
}

function _buildDuetRoleButtons() {
  const container = document.getElementById('duetRoleButtons');
  container.innerHTML = '';
  for (let i = 0; i < duetRoles.length; i++) {
    const btn = document.createElement('button');
    btn.textContent = `[${duetRoles[i].role}] ${duetRoles[i].skelName}`;
    btn.className = i === activeDuetRoleIdx ? 'active-toggle' : '';
    btn.style.flex = '1';
    const idx = i;
    btn.onclick = () => {
      duetRoles[activeDuetRoleIdx].frames = frames; // save current edits
      activeDuetRoleIdx = idx;
      _applyActiveDuetRole();
      _buildDuetRoleButtons();
      render();
    };
    container.appendChild(btn);
  }
}

function _decodeKfForSkel(kf, skelName) {
  const sk = SKELETONS[skelName] ?? getSkeleton();
  const dp = sk.defaultPose;
  const pose = {};
  for (const [j, p] of Object.entries(dp)) pose[j] = { x: p.x, y: p.y };
  for (const [name, val] of Object.entries(kf)) {
    if (name === 'dur') continue;
    if (name.startsWith('_bend_')) { pose[name] = val; continue; }
    if (!Array.isArray(val) || val.length !== 2) continue;
    if (dp[name]) pose[name] = { x: dp[name].x + val[0], y: dp[name].y + val[1] };
  }
  return pose;
}

function _encodeKfForSkel(pose, skelName) {
  const sk = SKELETONS[skelName] ?? getSkeleton();
  const dp = sk.defaultPose;
  const kf = {};
  for (const [j, p] of Object.entries(pose)) {
    if (!dp[j]) continue;
    const dx = Math.round(p.x - dp[j].x);
    const dy = Math.round(p.y - dp[j].y);
    if (dx !== 0 || dy !== 0) kf[j] = [dx, dy];
  }
  for (const k of Object.keys(pose)) {
    if (k.startsWith('_bend_')) kf[k] = Math.round(pose[k]);
  }
  return kf;
}

function _enterVariantMode(data) {
  variantMode = true;
  variantParams = {
    variant_of: data.variant_of ?? '',
    amp: data.amp ?? 1,
    ref_speed: data.ref_speed ?? null,
    overlay: data.overlay ?? null,
  };
  frames = [defaultPose()]; frameDurs = [0.3]; currentFrame = 0;
  _buildVariantPanel();
  document.getElementById('variantPanel').style.display = '';
  _loadVariantPreview();
}

function _buildVariantPanel() {
  const sel = document.getElementById('variantOfSelect');
  sel.innerHTML = '<option value="">-- 选择 base --</option>';
  for (const [cid, entry] of Object.entries(manifestData?.clips ?? {})) {
    if (entry.kind !== 'cycle' || entry.variant_of) continue;
    const opt = document.createElement('option');
    opt.value = cid;
    opt.textContent = cid;
    if (cid === variantParams.variant_of) opt.selected = true;
    sel.appendChild(opt);
  }
  document.getElementById('variantAmp').value = variantParams.amp ?? 1;
  const rs = variantParams.ref_speed;
  document.getElementById('variantRefSpeed').value = rs != null ? rs : '';
  document.getElementById('variantOverlay').value = variantParams.overlay ?? '';
}

async function _loadVariantPreview() {
  const baseId = variantParams.variant_of;
  if (!baseId || !manifestData?.clips?.[baseId]) { variantBaseDecoded = null; render(); return; }
  const entry = manifestData.clips[baseId];
  try {
    const r = await fetch('../../assets/' + entry.path);
    const data = await r.json();
    variantBaseDecoded = (data.keyframes ?? []).map(kf => _decodeKf(kf));
  } catch { variantBaseDecoded = null; }
  render();
}

function updateVariantParam(key, value) {
  variantParams[key] = value;
  if (key === 'variant_of') _loadVariantPreview();
  else render();
}

// ── 衔接检查（from/to clip 边界帧作洋葱皮）────────────────────────────────────
async function _loadTransitionOnion(fromId, toId) {
  transitionOnion = { fromFrame: null, toFrame: null };

  async function _fetchBoundaryFrame(clipId, last) {
    if (!clipId || !manifestData?.clips?.[clipId]) return null;
    const entry = manifestData.clips[clipId];
    try {
      const r = await fetch('../../assets/' + entry.path);
      if (!r.ok) return null;
      const data = await r.json();
      const kfs = data.keyframes ?? [];
      if (!kfs.length) return null;
      const kf = kfs[last ? kfs.length - 1 : 0];
      return _decodeKf(kf);
    } catch { return null; }
  }

  if (fromId) transitionOnion.fromFrame = await _fetchBoundaryFrame(fromId, true);
  if (toId)   transitionOnion.toFrame   = await _fetchBoundaryFrame(toId, false);

  document.getElementById('transitionSection').style.display = '';
  _populateTransitionSelects(fromId, toId);
  render();
}

function _populateTransitionSelects(fromId, toId) {
  const fromSel = document.getElementById('transFromSelect');
  const toSel   = document.getElementById('transToSelect');
  [fromSel, toSel].forEach(sel => {
    sel.innerHTML = '<option value="">-- 无 --</option>';
    for (const [cid, entry] of Object.entries(manifestData?.clips ?? {})) {
      if (entry.kind !== 'cycle') continue;
      const opt = document.createElement('option');
      opt.value = cid;
      opt.textContent = cid;
      sel.appendChild(opt);
    }
  });
  fromSel.value = fromId ?? '';
  toSel.value   = toId   ?? '';
}

async function setTransitionRef(side, clipId) {
  if (!loadedClipMeta) return;
  if (side === 'from') loadedClipMeta.from = clipId || null;
  else                 loadedClipMeta.to   = clipId || null;
  await _loadTransitionOnion(loadedClipMeta.from, loadedClipMeta.to);
}

// ── 合成预览 ──────────────────────────────────────────────────────────────────
function togglePreview() {
  previewEnabled = document.getElementById('previewEnable').checked;
  document.getElementById('previewControls').style.display = previewEnabled ? '' : 'none';
  render();
}

async function loadPreviewBase() {
  const id = document.getElementById('previewBaseSelect').value;
  if (!id || !manifestData) { previewBaseDecoded = null; render(); return; }
  const entry = manifestData.clips[id];
  if (!entry) return;
  try {
    const r = await fetch('../../assets/' + entry.path);
    const data = await r.json();
    previewBaseDecoded = (data.keyframes ?? []).map(kf => _decodeKf(kf));
  } catch { previewBaseDecoded = null; }
  render();
}

function _composeForPreview(base, current) {
  const dp = getSkeleton().defaultPose;
  const composed = {};
  for (const name of getJointNames()) {
    if (gestureMode && activeJoints.has(name)) {
      // overlay: apply delta from defaultPose on top of base
      const delta = { x: current[name].x - (dp[name]?.x ?? 0), y: current[name].y - (dp[name]?.y ?? 0) };
      composed[name] = { x: (base[name]?.x ?? 0) + delta.x, y: (base[name]?.y ?? 0) + delta.y };
    } else {
      composed[name] = base[name] ? { x: base[name].x, y: base[name].y } : { x: current[name].x, y: current[name].y };
    }
  }
  return composed;
}

// ── 渲染 ──────────────────────────────────────────────────────────────────────
function drawBone(ax, ay, bx, by, bend, w, color) {
  if (bend === 0) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  } else {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(mx + nx * bend, my + ny * bend, bx, by);
  }
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
}

function drawFigure(pose, alpha=1, color='#1a1a1a', jColor='#e63322', showBendHandles=false, sk=null) {
  sk = sk ?? getSkeleton();
  ctx.globalAlpha = alpha;
  for (const [from, to, w] of sk.bones) {
    if (!pose[from] || !pose[to]) continue;
    const a = toScreen(pose[from]), b = toScreen(pose[to]);
    drawBone(a.x, a.y, b.x, b.y, getBend(from, to, pose), w, color);
  }
  if (pose[sk.headJoint]) {
    const hp = toScreen(pose[sk.headJoint]);
    ctx.beginPath(); ctx.arc(hp.x, hp.y, sk.headRadius, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  if (showBendHandles) {
    for (const [from, to] of sk.bones) {
      if (!pose[from] || !pose[to]) continue;
      const bend = getBend(from, to, pose);
      const key = `_bend_${from}__${to}`;
      const cp = _getBendControlPoint(pose, from, to);
      const isActive = dragging === key;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#ffcc00' : (bend !== 0 ? '#44aaff' : 'rgba(100,160,255,0.4)');
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  for (const name of getJointNames()) {
    if (!pose[name]) continue;
    const p = toScreen(pose[name]);
    ctx.beginPath(); ctx.arc(p.x, p.y, JOINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = (name === dragging) ? '#ffcc00' : jColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (document.getElementById('showLabels').checked) {
    ctx.font = '10px "JetBrains Mono",monospace'; ctx.fillStyle = '#555';
    for (const name of getJointNames()) {
      if (!pose[name]) continue;
      const p = toScreen(pose[name]);
      ctx.fillText(sk.labels[name], p.x + 10, p.y - 8);
    }
  }
  ctx.globalAlpha = 1;
}

function _getBendControlPoint(pose, from, to) {
  const a = toScreen(pose[from]), b = toScreen(pose[to]);
  const bend = getBend(from, to, pose);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
}

function _drawTransitionDeviations(onionFrame, editFrame) {
  const TOLERANCE = 5;
  for (const name of getJointNames()) {
    if (!onionFrame[name] || !editFrame[name]) continue;
    const a = toScreen(onionFrame[name]);
    const b = toScreen(editFrame[name]);
    if (Math.hypot(a.x - b.x, a.y - b.y) > TOLERANCE) {
      ctx.beginPath(); ctx.arc(b.x, b.y, JOINT_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5f0eb'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gy = CY + 82;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy);
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(CX - 8, CY); ctx.lineTo(CX + 8, CY);
  ctx.moveTo(CX, CY - 8); ctx.lineTo(CX, CY + 8);
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();

  if (duetMode) {
    _renderDuet();
  } else if (variantMode) {
    _renderVariant();
  } else {
    const cur = frames[currentFrame];
    // 洋葱皮（前一帧）
    if (document.getElementById('onionSkin').checked && currentFrame > 0)
      drawFigure(frames[currentFrame - 1], 0.2, '#aaaacc', '#aaaacc', false);
    // 衔接检查洋葱皮
    if (transitionOnion) {
      if (currentFrame === 0 && transitionOnion.fromFrame) {
        drawFigure(transitionOnion.fromFrame, 0.3, '#884422', '#884422', false);
        drawFigure(cur, 1, '#1a1a1a', '#e63322', true);
        _drawTransitionDeviations(transitionOnion.fromFrame, cur);
      } else if (currentFrame === frames.length - 1 && transitionOnion.toFrame) {
        drawFigure(transitionOnion.toFrame, 0.3, '#884422', '#884422', false);
        drawFigure(cur, 1, '#1a1a1a', '#e63322', true);
        _drawTransitionDeviations(transitionOnion.toFrame, cur);
      } else {
        _renderCurrentOrComposed(cur);
      }
    } else {
      _renderCurrentOrComposed(cur);
    }
  }

  updateCoordsDisplay();
  updateTimeline();
}

function _renderDuet() {
  const onion = document.getElementById('onionSkin').checked;
  for (let i = 0; i < duetRoles.length; i++) {
    const role = duetRoles[i];
    const sk = SKELETONS[role.skelName] ?? getSkeleton();
    const isActive = i === activeDuetRoleIdx;
    const roleFrames = isActive ? frames : role.frames;
    const pose = roleFrames[currentFrame] ?? roleFrames[0];
    if (!pose) continue;
    _screenOffsetX = role.offset.x;
    _screenOffsetY = role.offset.y;
    if (onion && currentFrame > 0 && isActive) {
      const prev = roleFrames[currentFrame - 1];
      if (prev) drawFigure(prev, 0.2, '#aaaacc', '#aaaacc', false, sk);
    }
    drawFigure(pose, isActive ? 1 : 0.35, isActive ? '#1a1a1a' : '#6666aa',
               isActive ? '#e63322' : '#aaaaee', isActive, sk);
    // position handle for inactive roles
    if (!isActive) {
      const body = pose[sk.root] ?? Object.values(pose)[0];
      if (body) {
        const p = toScreen(body);
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,100,200,0.4)';
        ctx.fill();
        ctx.strokeStyle = '#6666aa'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  }
  _screenOffsetX = duetRoles[activeDuetRoleIdx]?.offset.x ?? 0;
  _screenOffsetY = duetRoles[activeDuetRoleIdx]?.offset.y ?? 0;
}

function _renderVariant() {
  if (!variantBaseDecoded?.length) {
    drawFigure(defaultPose(), 0.3, '#999', '#999', false);
    return;
  }
  const amp = variantParams.amp ?? 1;
  const baseFrame = variantBaseDecoded[currentFrame % variantBaseDecoded.length];
  drawFigure(baseFrame, 0.3, '#2244aa', '#2244aa', false);
  // scaled version
  const dp = getSkeleton().defaultPose;
  const scaled = {};
  for (const [j, p] of Object.entries(baseFrame)) {
    const dpj = dp[j];
    if (!dpj) { scaled[j] = p; continue; }
    scaled[j] = { x: dpj.x + (p.x - dpj.x) * amp, y: dpj.y + (p.y - dpj.y) * amp };
  }
  drawFigure(scaled, 1, '#aa5500', '#ff7700', false);
}

function _renderCurrentOrComposed(cur) {
  if (previewEnabled && previewBaseDecoded?.length > 0) {
    const baseFrameCount = previewBaseDecoded.length;
    const overlayFrameCount = frames.length;
    // 总帧数以 base 为准
    const baseFrame = previewBaseDecoded[currentFrame % baseFrameCount];
    // overlay 按取模循环，单帧永远取第 0 帧
    const overlayFrame = frames[currentFrame % overlayFrameCount];
    drawFigure(baseFrame, 0.25, '#2244aa', '#2244aa', false);
    drawFigure(_composeForPreview(baseFrame, overlayFrame), 1, '#1a1a1a', '#e63322', true);
  } else {
    drawFigure(cur, 1, '#1a1a1a', '#e63322', true);
  }
}
function renderThumb(pose, tc) {
  const sk = getSkeleton();
  const t = tc.getContext('2d'), tw = tc.width, th = tc.height, s = 0.25;
  t.clearRect(0, 0, tw, th); t.fillStyle = '#f5f0eb'; t.fillRect(0, 0, tw, th);
  t.save(); t.translate(tw / 2, th / 2 + 5); t.scale(s, s);
  for (const [from, to, w] of sk.bones) {
    if (!pose[from] || !pose[to]) continue;
    const bend = getBend(from, to, pose);
    const a = pose[from], b = pose[to];
    if (bend === 0) {
      t.beginPath(); t.moveTo(a.x, a.y); t.lineTo(b.x, b.y);
    } else {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      t.beginPath(); t.moveTo(a.x, a.y);
      t.quadraticCurveTo(mx + nx * bend, my + ny * bend, b.x, b.y);
    }
    t.strokeStyle = '#333'; t.lineWidth = w; t.lineCap = 'round'; t.stroke();
  }
  if (pose[sk.headJoint]) {
    const hp = pose[sk.headJoint];
    t.beginPath(); t.arc(hp.x, hp.y, sk.headRadius, 0, Math.PI * 2);
    t.fillStyle = '#333'; t.fill();
  }
  t.restore();
}

function findJointAt(mx, my) {
  const pose = frames[currentFrame];
  let closest = null, minD = GRAB_RADIUS;
  for (const name of getJointNames()) {
    if (!pose[name]) continue;
    const p = toScreen(pose[name]);
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d < minD) { minD = d; closest = name; }
  }
  return closest;
}

function findBendHandleAt(mx, my) {
  const pose = frames[currentFrame];
  const sk = getSkeleton();
  let closest = null, minD = GRAB_RADIUS + 2;
  for (const [from, to] of sk.bones) {
    if (!pose[from] || !pose[to]) continue;
    const cp = _getBendControlPoint(pose, from, to);
    const d = Math.hypot(mx - cp.x, my - cp.y);
    if (d < minD) { minD = d; closest = `_bend_${from}__${to}`; }
  }
  return closest;
}

// ── 坐标 / 骨骼长度面板 ────────────────────────────────────────────────────────
function updateCoordsDisplay() {
  const sk = getSkeleton();
  const panel = document.getElementById('coordsPanel');
  const pose = frames[currentFrame];

  if (!panel.dataset.built) {
    panel.innerHTML = '';
    for (const name of getJointNames()) {
      const row = document.createElement('div');
      row.className = 'coord-row';
      row.innerHTML = `
        <span class="coord-label">${sk.labels[name]}</span>
        <span class="coord-xy">x</span>
        <input type="number" data-joint="${name}" data-axis="x" step="1">
        <span class="coord-xy">y</span>
        <input type="number" data-joint="${name}" data-axis="y" step="1">
      `;
      panel.appendChild(row);
    }
    panel.addEventListener('change', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      const joint = e.target.dataset.joint;
      const axis  = e.target.dataset.axis;
      const val   = parseFloat(e.target.value);
      if (isNaN(val)) return;
      history.save(frames, currentFrame);
      frames[currentFrame][joint][axis] = val;
      render();
    });
    panel.dataset.built = '1';
  }

  panel.querySelectorAll('input').forEach(inp => {
    const j = inp.dataset.joint, a = inp.dataset.axis;
    if (pose[j]) inp.value = Math.round(pose[j][a]);
  });

  updateBoneLengths();
}

function updateBoneLengths() {
  const sk = getSkeleton();
  const panel = document.getElementById('boneLengthPanel');
  const pose = frames[currentFrame];

  if (!panel.dataset.built) {
    panel.innerHTML = '';

    const lockRow = document.createElement('div');
    lockRow.className = 'check-row';
    lockRow.innerHTML = `<label><input type="checkbox" id="lengthLockChk" ${lengthLocked ? 'checked' : ''}> 全局锁定（所有帧同步）</label>`;
    panel.appendChild(lockRow);

    const bendLockRow = document.createElement('div');
    bendLockRow.className = 'check-row';
    bendLockRow.innerHTML = `<label><input type="checkbox" id="bendLockChk" ${bendLocked ? 'checked' : ''}> 弯曲全局锁定</label>`;
    panel.appendChild(bendLockRow);

    for (const [from, to] of sk.bones) {
      const row = document.createElement('div');
      row.className = 'coord-row';
      row.innerHTML = `
        <span class="coord-label">${sk.labels[from]}→${sk.labels[to]}</span>
        <span class="coord-xy">长</span>
        <input type="number" class="len-input" data-from="${from}" data-to="${to}" step="1" min="1">
        <span class="coord-xy">弯</span>
        <input type="number" class="bend-input" data-from="${from}" data-to="${to}" step="1">
      `;
      panel.appendChild(row);
    }

    panel.addEventListener('change', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      const from = e.target.dataset.from;
      const to   = e.target.dataset.to;
      if (!from || !to) return;

      if (e.target.classList.contains('len-input')) {
        const newLen = parseFloat(e.target.value);
        if (isNaN(newLen) || newLen < 1) return;
        history.save(frames, currentFrame);
        if (lengthLocked) {
          setGlobalBoneLength(from, to, newLen, frames);
        } else {
          const p = frames[currentFrame];
          const dx = p[to].x - p[from].x, dy = p[to].y - p[from].y;
          const oldLen = Math.hypot(dx, dy) || 1;
          const scale = newLen / oldLen;
          const offX = p[from].x + dx * scale - p[to].x;
          const offY = p[from].y + dy * scale - p[to].y;
          p[to].x += offX; p[to].y += offY;
          for (const desc of getDescendants(to)) { p[desc].x += offX; p[desc].y += offY; }
        }
        render();
      } else if (e.target.classList.contains('bend-input')) {
        const val = parseFloat(e.target.value);
        if (isNaN(val)) return;
        history.save(frames, currentFrame);
        setBend(from, to, val, frames[currentFrame], frames);
        render();
      }
    });

    panel.dataset.built = '1';

    setTimeout(() => {
      document.getElementById('bendLockChk')?.addEventListener('change', (e) => {
        setBendLocked(e.target.checked);
      });
      document.getElementById('lengthLockChk')?.addEventListener('change', (e) => {
        setLengthLocked(e.target.checked);
      });
    }, 0);
  }

  panel.querySelectorAll('.len-input').forEach(inp => {
    const from = inp.dataset.from, to = inp.dataset.to;
    if (pose[from] && pose[to]) {
      const dx = pose[to].x - pose[from].x, dy = pose[to].y - pose[from].y;
      inp.value = Math.round(Math.hypot(dx, dy));
    }
  });
  panel.querySelectorAll('.bend-input').forEach(inp => {
    inp.value = Math.round(getBend(inp.dataset.from, inp.dataset.to, pose));
  });
}

function updateTimeline() {
  const strip = document.getElementById('framesStrip');
  if (strip.children.length !== frames.length) {
    strip.innerHTML = '';
    for (let i = 0; i < frames.length; i++) {
      const div = document.createElement('div');
      div.className = 'frame-thumb';
      div.onclick = (e) => { if (!playing && e.target.tagName !== 'INPUT') { currentFrame = i; render(); } };
      const c = document.createElement('canvas'); c.width = 104; c.height = 112;
      div.appendChild(c);
      const num = document.createElement('span'); num.className = 'frame-num'; num.textContent = i + 1;
      div.appendChild(num);
      const dur = document.createElement('input');
      dur.type = 'number'; dur.className = 'frame-dur'; dur.step = '0.05'; dur.min = '0.05';
      dur.addEventListener('change', (e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v > 0) frameDurs[i] = v;
      });
      div.appendChild(dur);
      strip.appendChild(div);
    }
  }
  for (let i = 0; i < frames.length; i++) {
    const div = strip.children[i];
    div.className = 'frame-thumb' + (i === currentFrame ? ' active' : '') + (gestureMode ? ' gesture' : '');
    div.querySelector('.frame-num').textContent = i + 1;
    renderThumb(frames[i], div.querySelector('canvas'));
    const dur = div.querySelector('.frame-dur');
    dur.style.display = gestureMode ? '' : 'none';
    if (gestureMode) dur.value = frameDurs[i] ?? 0.3;
  }
}

// ── 拖拽交互 ──────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', (e) => {
  if (playing) return;
  const {x, y} = getMousePos(e);
  draggingRoleOffset = -1;

  // In duet mode: check inactive role position handles first
  if (duetMode) {
    for (let i = 0; i < duetRoles.length; i++) {
      if (i === activeDuetRoleIdx) continue;
      const role = duetRoles[i];
      const roleFrames = role.frames;
      const rpose = roleFrames[currentFrame] ?? roleFrames[0];
      if (!rpose) continue;
      const rsk = SKELETONS[role.skelName] ?? getSkeleton();
      const body = rpose[rsk.root] ?? Object.values(rpose)[0];
      if (!body) continue;
      const px = CX + body.x + role.offset.x, py = CY + body.y + role.offset.y;
      if (Math.hypot(x - px, y - py) <= GRAB_RADIUS + 4) {
        draggingRoleOffset = i;
        dragStarted = false;
        setInfo(`调整 ${role.role} 位置`);
        return;
      }
    }
  }

  // 全局平移模式：单击画布即开始整体平移
  if (translateMode) {
    history.save(frames, currentFrame);
    dragging = '__translate__';
    _translateLastX = x; _translateLastY = y;
    dragStarted = true;
    setInfo('整体平移中…');
    return;
  }

  const bendHit = e.altKey ? findBendHandleAt(x, y) : null;
  if (bendHit) { dragging = bendHit; dragStarted = false; setInfo(`调整弯曲: ${bendHit.replace('_bend_','').replace('__','→')}`); return; }
  dragging = findJointAt(x, y);
  dragStarted = false;
  if (dragging) setInfo(`拖动: ${getSkeleton().labels[dragging]}`);
});

canvas.addEventListener('mousemove', (e) => {
  if (draggingRoleOffset < 0 && !dragging) return;
  const {x, y} = getMousePos(e);

  // Duet: dragging an inactive role's position handle
  if (draggingRoleOffset >= 0) {
    const role = duetRoles[draggingRoleOffset];
    const rpose = (role.frames[currentFrame] ?? role.frames[0]);
    const rsk = SKELETONS[role.skelName] ?? getSkeleton();
    const body = rpose?.[rsk.root] ?? (rpose ? Object.values(rpose)[0] : null);
    if (body) { role.offset.x = x - CX - body.x; role.offset.y = y - CY - body.y; }
    render(); return;
  }

  // 全局平移模式
  if (dragging === '__translate__') {
    const dx = x - _translateLastX, dy = y - _translateLastY;
    _translateLastX = x; _translateLastY = y;
    for (const pose of frames) {
      for (const j of getJointNames()) { if (pose[j]) { pose[j].x += dx; pose[j].y += dy; } }
    }
    render(); return;
  }

  if (!dragStarted) { history.save(frames, currentFrame); dragStarted = true; }
  const pose = frames[currentFrame];
  const sk = getSkeleton();
  // Pose space: subtract screen offset so coordinates stay in role-local space
  const lx = x - _screenOffsetX, ly = y - _screenOffsetY;

  if (dragging.startsWith('_bend_')) {
    const [from, to] = dragging.slice('_bend_'.length).split('__');
    const a = toScreen(pose[from]), b = toScreen(pose[to]);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    setBend(from, to, (x - mx) * nx + (y - my) * ny, pose, frames);
    render(); return;
  }

  const parentName = sk.hierarchy[dragging]?.parent;
  if (!parentName) {
    const dx = (lx - CX) - pose[dragging].x, dy = (ly - CY) - pose[dragging].y;
    for (const n of getJointNames()) { if (pose[n]) { pose[n].x += dx; pose[n].y += dy; } }
  } else if (boneLocked) {
    const parent = pose[parentName];
    const boneLen = Math.hypot(pose[dragging].x - parent.x, pose[dragging].y - parent.y);
    const oldAngle = Math.atan2(pose[dragging].y - parent.y, pose[dragging].x - parent.x);
    const newAngle = Math.atan2((ly - CY) - parent.y, (lx - CX) - parent.x);
    const angleDiff = newAngle - oldAngle;
    pose[dragging].x = parent.x + boneLen * Math.cos(newAngle);
    pose[dragging].y = parent.y + boneLen * Math.sin(newAngle);
    for (const desc of getDescendants(dragging)) {
      const ddx = pose[desc].x - parent.x, ddy = pose[desc].y - parent.y;
      const r = Math.hypot(ddx, ddy), a = Math.atan2(ddy, ddx) + angleDiff;
      pose[desc].x = parent.x + r * Math.cos(a);
      pose[desc].y = parent.y + r * Math.sin(a);
    }
  } else {
    const newX = lx - CX, newY = ly - CY;
    const dx = newX - pose[dragging].x, dy = newY - pose[dragging].y;
    pose[dragging].x = newX; pose[dragging].y = newY;
    for (const desc of getDescendants(dragging)) { pose[desc].x += dx; pose[desc].y += dy; }
  }
  render();
});

canvas.addEventListener('mouseup', () => { dragging = null; draggingRoleOffset = -1; setInfo('拖动红色关节点摆姿势'); render(); });
canvas.addEventListener('mouseleave', () => { dragging = null; draggingRoleOffset = -1; render(); });

// ── 撤销 / 重做 ────────────────────────────────────────────────────────────────
function applySnapshot(snap) {
  frames = snap.frames;
  currentFrame = snap.currentFrame;
  if (snap.globalBend) {
    for (const b of getSkeleton().bones) {
      const key = `${b[0]}__${b[1]}`;
      if (key in snap.globalBend) b[3] = snap.globalBend[key];
    }
  }
}
function undo() { const s = history.undo(frames, currentFrame); if (s) { applySnapshot(s); render(); setInfo('撤销'); } }
function redo() { const s = history.redo(frames, currentFrame); if (s) { applySnapshot(s); render(); setInfo('重做'); } }

// ── 左右互换 ──────────────────────────────────────────────────────────────────
function mirrorPose() {
  const sk = getSkeleton();
  history.save(frames, currentFrame);
  const pose = frames[currentFrame];
  for (const [l, r] of sk.mirrorPairs) {
    const tmpX = pose[l].x, tmpY = pose[l].y;
    pose[l].x = -pose[r].x; pose[l].y = pose[r].y;
    pose[r].x = -tmpX;      pose[r].y = tmpY;
  }
  const paired = new Set();
  for (const [l, r] of sk.mirrorPairs) { paired.add(l); paired.add(r); }
  for (const name of getJointNames()) {
    if (!paired.has(name)) pose[name].x = -pose[name].x;
  }
  render(); setInfo('左右互换完成');
}

// ── 骨骼锁 ────────────────────────────────────────────────────────────────────
function toggleBoneLock() {
  boneLocked = !boneLocked;
  const btn = document.getElementById('lockBtn');
  const ind = document.getElementById('modeIndicator');
  if (boneLocked) {
    btn.textContent = '🔒 骨骼锁定（旋转模式）';
    btn.classList.remove('active-toggle');
    ind.textContent = '关节绕父骨骼旋转，长度固定';
    ind.className = 'mode-indicator mode-locked';
  } else {
    btn.textContent = '🔓 骨骼解锁（自由拉伸）';
    btn.classList.add('active-toggle');
    ind.textContent = '自由移动关节，可拉长/缩短骨骼';
    ind.className = 'mode-indicator mode-unlocked';
  }
}

// ── 全局平移模式 ──────────────────────────────────────────────────────────────
function toggleTranslateMode() {
  translateMode = !translateMode;
  const btn = document.getElementById('translateModeBtn');
  const ind = document.getElementById('modeIndicator');
  if (translateMode) {
    btn.classList.add('active-toggle');
    ind.textContent = '整体平移模式：拖拽移动整具骨架';
    ind.className = 'mode-indicator mode-unlocked';
  } else {
    btn.classList.remove('active-toggle');
    ind.textContent = boneLocked ? '关节绕父骨骼旋转，长度固定' : '自由移动关节，可拉长/缩短骨骼';
    ind.className = boneLocked ? 'mode-indicator mode-locked' : 'mode-indicator mode-unlocked';
  }
}

// ── 姿势片段模式 ──────────────────────────────────────────────────────────────
function toggleGestureMode() {
  gestureMode = !gestureMode;
  document.getElementById('gestureModeBtn').classList.toggle('active-toggle', gestureMode);
  const panel = document.getElementById('jointSelectPanel');
  panel.style.display = gestureMode ? '' : 'none';
  if (gestureMode) _buildJointCheckboxes();
  document.getElementById('framesStrip').innerHTML = '';
  render();
}

function _buildJointCheckboxes() {
  const sk = getSkeleton();
  const container = document.getElementById('jointCheckboxes');
  container.innerHTML = '';
  for (const name of getJointNames()) {
    const label = document.createElement('label');
    label.className = 'check-row';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = activeJoints.has(name);
    chk.addEventListener('change', () => {
      if (chk.checked) activeJoints.add(name);
      else activeJoints.delete(name);
    });
    label.appendChild(chk);
    label.appendChild(document.createTextNode(' ' + sk.labels[name]));
    container.appendChild(label);
  }
}

// ── 帧管理 ────────────────────────────────────────────────────────────────────
function addFrame() {
  history.save(frames, currentFrame);
  frames.push(defaultPose()); frameDurs.push(0.3);
  currentFrame = frames.length - 1; render();
}
function dupFrame() {
  history.save(frames, currentFrame);
  frames.splice(currentFrame + 1, 0, clonePose(frames[currentFrame]));
  frameDurs.splice(currentFrame + 1, 0, frameDurs[currentFrame] ?? 0.3);
  currentFrame++; render();
}
function delFrame() {
  if (frames.length <= 1) return;
  history.save(frames, currentFrame);
  frames.splice(currentFrame, 1); frameDurs.splice(currentFrame, 1);
  if (currentFrame >= frames.length) currentFrame = frames.length - 1;
  render();
}
function resetPose() {
  history.save(frames, currentFrame);
  frames[currentFrame] = defaultPose(); render();
}
function moveFrameLeft() {
  if (currentFrame <= 0) return;
  history.save(frames, currentFrame);
  [frames[currentFrame - 1], frames[currentFrame]] = [frames[currentFrame], frames[currentFrame - 1]];
  [frameDurs[currentFrame - 1], frameDurs[currentFrame]] = [frameDurs[currentFrame], frameDurs[currentFrame - 1]];
  currentFrame--; render();
}
function moveFrameRight() {
  if (currentFrame >= frames.length - 1) return;
  history.save(frames, currentFrame);
  [frames[currentFrame], frames[currentFrame + 1]] = [frames[currentFrame + 1], frames[currentFrame]];
  [frameDurs[currentFrame], frameDurs[currentFrame + 1]] = [frameDurs[currentFrame + 1], frameDurs[currentFrame]];
  currentFrame++; render();
}

// ── 播放 ──────────────────────────────────────────────────────────────────────
function togglePlay() {
  playing = !playing;
  const btn = document.getElementById('playBtn');
  if (playing) {
    btn.textContent = '⏹ 停止';
    const fps = parseInt(document.getElementById('fpsInput').value) || 8;
    playTimer = setInterval(() => { currentFrame = (currentFrame + 1) % frames.length; render(); }, 1000 / fps);
  } else {
    btn.textContent = '▶ 播放';
    clearInterval(playTimer); playTimer = null;
  }
}

// ── 补帧插值 ──────────────────────────────────────────────────────────────────
function interpolateFrames() {
  const fromIdx = parseInt(document.getElementById('interpFrom').value) - 1;
  const toIdx   = parseInt(document.getElementById('interpTo').value) - 1;
  const count   = parseInt(document.getElementById('interpCount').value);

  if (fromIdx < 0 || fromIdx >= frames.length || toIdx < 0 || toIdx >= frames.length) { alert('帧编号超出范围'); return; }
  if (fromIdx === toIdx) { alert('起始帧和结束帧不能相同'); return; }
  if (count < 1 || count > 30) { alert('插入帧数 1-30'); return; }

  history.save(frames, currentFrame);
  const sk = getSkeleton();
  const poseA = frames[fromIdx], poseB = frames[toIdx];
  const newFrames = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const pose = {};
    for (const name of getJointNames()) {
      pose[name] = {
        x: poseA[name].x + (poseB[name].x - poseA[name].x) * t,
        y: poseA[name].y + (poseB[name].y - poseA[name].y) * t,
      };
    }
    for (const [from, to] of sk.bones) {
      const ka = `_bend_${from}__${to}`;
      const hasA = ka in poseA, hasB = ka in poseB;
      if (hasA || hasB) {
        const bendA = hasA ? poseA[ka] : getGlobalBend(from, to);
        const bendB = hasB ? poseB[ka] : getGlobalBend(from, to);
        pose[ka] = bendA + (bendB - bendA) * t;
      }
    }
    newFrames.push(pose);
  }
  const insertIdx = Math.min(fromIdx, toIdx) + 1;
  frames.splice(insertIdx, 0, ...newFrames);
  currentFrame = insertIdx;
  render(); setInfo(`已插入 ${count} 帧`);
}

// ── 图片提取（仅 human 骨骼）──────────────────────────────────────────────────
let poseLandmarker = null, mpLoading = false;

async function loadMediaPipe() {
  if (poseLandmarker) return poseLandmarker;
  if (mpLoading) return null;
  mpLoading = true; showLoading('正在加载 MediaPipe 模型...');
  try {
    const { PoseLandmarker, FilesetResolver } = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs'
    );
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      },
      runningMode: 'IMAGE', numPoses: 1,
    });
    hideLoading(); return poseLandmarker;
  } catch (e) {
    hideLoading(); mpLoading = false;
    alert('MediaPipe 加载失败: ' + e.message); return null;
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (getSkeleton() !== SKELETONS.human) { alert('图片提取仅支持人体骨骼'); event.target.value = ''; return; }
  const lm = await loadMediaPipe();
  if (!lm) return;
  showLoading('正在识别姿势...');
  const img = new Image();
  img.onload = () => {
    try {
      const result = lm.detect(img);
      if (!result.landmarks?.length) { hideLoading(); alert('未检测到人体姿态'); return; }
      const marks = result.landmarks[0];
      const w = img.width, h = img.height;
      const lm2 = (idx) => [marks[idx].x * w, marks[idx].y * h];
      const nose=lm2(0),lSh=lm2(11),rSh=lm2(12),lEl=lm2(13),rEl=lm2(14),lWr=lm2(15),rWr=lm2(16);
      const lHi=lm2(23),rHi=lm2(24),lKn=lm2(25),rKn=lm2(26),lAn=lm2(27),rAn=lm2(28);
      const neck = [(lSh[0]+rSh[0])/2, (lSh[1]+rSh[1])/2];
      const body = [(lHi[0]+rHi[0])/2, (lHi[1]+rHi[1])/2];
      const n2n = Math.hypot(nose[0]-neck[0], nose[1]-neck[1]);
      const hd = [nose[0]-neck[0], nose[1]-neck[1]], hl = Math.hypot(hd[0],hd[1]) || 1;
      const head = [nose[0]+(hd[0]/hl)*n2n*0.5, nose[1]+(hd[1]/hl)*n2n*0.5];
      const rel = (p) => ({x: p[0]-body[0], y: p[1]-body[1]});
      const raw = {
        head:rel(head), neck:rel(neck),
        l_elbow:rel(lEl), r_elbow:rel(rEl), l_hand:rel(lWr), r_hand:rel(rWr),
        body:{x:0,y:0},
        l_knee:rel(lKn), r_knee:rel(rKn), l_foot:rel(lAn), r_foot:rel(rAn),
      };
      const scale = (Math.max(raw.l_foot.y, raw.r_foot.y) - raw.head.y) > 0
        ? 170 / (Math.max(raw.l_foot.y, raw.r_foot.y) - raw.head.y) : 1;
      history.save(frames, currentFrame);
      const pose = {};
      for (const name of getJointNames()) {
        pose[name] = { x: Math.round((raw[name]?.x ?? 0)*scale), y: Math.round((raw[name]?.y ?? 0)*scale) };
      }
      frames[currentFrame] = pose;
      hideLoading(); render(); setInfo('姿势提取成功！');
    } catch (e) { hideLoading(); alert('提取失败: ' + e.message); console.error(e); }
  };
  img.onerror = () => { hideLoading(); alert('图片加载失败'); };
  img.src = URL.createObjectURL(file);
  event.target.value = '';
}

// ── JSON 导入 / 导出 ──────────────────────────────────────────────────────────
function loadJSON() {
  const ta = document.getElementById('jsonInput');
  try {
    const data = JSON.parse(ta.value);
    if (!data.kind) { alert('缺少 "kind" 字段（新 schema 格式）'); return; }
    loadedClipMeta = {
      id:         data.id         ?? null,
      kind:       data.kind,
      facing:     data.facing     ?? null,
      skeleton:   data.skeleton   ?? null,
      variant_of: data.variant_of ?? null,
      from:       data.from       ?? null,
      to:         data.to         ?? null,
      ref_speed:  data.ref_speed  ?? null,
    };
    _loadClipData(data.id ?? '(pasted)', loadedClipMeta, data);
    document.getElementById('framesStrip').innerHTML = '';
    currentFrame = 0; render();
    setInfo(`载入 ${data.kind} clip: ${frames.length} 帧`);
  } catch (e) { alert('JSON 解析失败: ' + e.message); }
}

function exportJSON() {
  const m = loadedClipMeta;
  const kind = m?.kind ?? (gestureMode ? 'overlay' : 'cycle');

  // Variant: parameter-only clip, no keyframes
  if (variantMode) {
    const data = {
      ...(m?.id != null ? { id: m.id } : {}),
      kind: 'cycle',
      ...(m?.facing   ? { facing: m.facing } : {}),
      ...(m?.skeleton && m.skeleton !== 'human' ? { skeleton: m.skeleton } : {}),
      ...(variantParams.variant_of ? { variant_of: variantParams.variant_of } : {}),
      ...(variantParams.amp !== 1   ? { amp: variantParams.amp } : {}),
      ...(variantParams.ref_speed != null ? { ref_speed: variantParams.ref_speed } : {}),
      ...(variantParams.overlay     ? { overlay: variantParams.overlay } : {}),
    };
    _emitData(data, 'JSON'); return;
  }

  // Duet: role-grouped keyframes
  if (duetMode) {
    const numFrames = Math.max(...duetRoles.map(r => r.frames.length), 1);
    // Sync active role's latest edits back
    duetRoles[activeDuetRoleIdx].frames = frames;
    const keyframes = [];
    for (let i = 0; i < numFrames; i++) {
      const kf = {};
      const dur = frameDurs[i] ?? 0.3;
      if (dur !== 0.3) kf.dur = dur;
      for (const roleInfo of duetRoles) {
        const pose = roleInfo.frames[i] ?? roleInfo.frames[roleInfo.frames.length - 1];
        if (!pose) continue;
        kf[roleInfo.role] = _encodeKfForSkel(pose, roleInfo.skelName);
      }
      keyframes.push(kf);
    }
    const data = {
      ...(m?.id != null ? { id: m.id } : {}),
      kind: 'overlay',
      ...(m?.facing ? { facing: m.facing } : {}),
      participants: duetRoles.map(r => ({
        role: r.role,
        ...(r.skelName !== 'human' ? { skeleton: r.skelName } : {}),
      })),
      keyframes,
    };
    _emitData(data, 'JSON'); return;
  }

  // Normal single-skeleton clip
  const sk = getSkeleton();
  const dp = sk.defaultPose;
  const data = {
    ...(m?.id != null ? { id: m.id } : {}),
    kind,
    ...(m?.facing   ? { facing:     m.facing   } : {}),
    ...(m?.skeleton && m.skeleton !== 'human' ? { skeleton: m.skeleton } : {}),
    ...(kind === 'transition' && m?.from ? { from: m.from } : {}),
    ...(kind === 'transition' && m?.to   ? { to:   m.to   } : {}),
    ...(kind === 'overlay' && activeJoints.size > 0 ? { activeJoints: [...activeJoints] } : {}),
    ...(m?.ref_speed  != null ? { ref_speed:  m.ref_speed  } : {}),
    ...(m?.variant_of != null ? { variant_of: m.variant_of } : {}),
    keyframes: frames.map((pose, i) => {
      const kf = {};
      const dur = frameDurs[i] ?? 0.3;
      if (dur !== 0.3) kf.dur = dur;
      const joints = (kind === 'overlay' && activeJoints.size > 0) ? [...activeJoints] : getJointNames();
      for (const name of joints) {
        if (!pose[name] || !dp[name]) continue;
        const dx = Math.round(pose[name].x - dp[name].x);
        const dy = Math.round(pose[name].y - dp[name].y);
        if (dx !== 0 || dy !== 0) kf[name] = [dx, dy];
      }
      for (const k of Object.keys(pose)) {
        if (k.startsWith('_bend_')) kf[k] = Math.round(pose[k]);
      }
      return kf;
    }),
  };
  _emitData(data, 'JSON');
}

// ── 辅助导出 ──────────────────────────────────────────────────────────────────
function _poseAbs(jointNames) {
  const pose = frames[currentFrame];
  const joints = {};
  for (const name of jointNames) {
    if (pose[name]) joints[name] = [Math.round(pose[name].x), Math.round(pose[name].y)];
  }
  return joints;
}

function _emitData(obj, label) {
  const ta = document.getElementById('jsonInput');
  ta.value = JSON.stringify(obj, null, 2);
  navigator.clipboard.writeText(ta.value).then(
    () => setInfo(`${label} 已导出并复制`),
    () => setInfo(`${label} 已导出到文本框`)
  );
}

// ── Sprite Sheet ──────────────────────────────────────────────────────────────
function exportSpriteSheet() {
  const sk = getSkeleton();
  const fw = 200, fh = 250;
  const cols = Math.min(frames.length, 8), rows = Math.ceil(frames.length / cols);
  const out = document.createElement('canvas');
  out.width = fw * cols; out.height = fh * rows;
  const oc = out.getContext('2d');
  oc.clearRect(0, 0, out.width, out.height);
  for (let i = 0; i < frames.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const ox = col * fw + fw / 2, oy = row * fh + fh / 2 + 20;
    const pose = frames[i];
    for (const [from, to, w] of sk.bones) {
      if (!pose[from] || !pose[to]) continue;
      const bend = getBend(from, to, pose);
      const a = {x: ox + pose[from].x, y: oy + pose[from].y};
      const b = {x: ox + pose[to].x,   y: oy + pose[to].y};
      if (bend === 0) {
        oc.beginPath(); oc.moveTo(a.x, a.y); oc.lineTo(b.x, b.y);
      } else {
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx,dy) || 1;
        const nx = -dy/len, ny = dx/len;
        oc.beginPath(); oc.moveTo(a.x, a.y);
        oc.quadraticCurveTo(mx + nx*bend, my + ny*bend, b.x, b.y);
      }
      oc.strokeStyle = '#1a1a1a'; oc.lineWidth = w; oc.lineCap = 'round'; oc.stroke();
    }
    if (pose[sk.headJoint]) {
      const hp = pose[sk.headJoint];
      oc.beginPath(); oc.arc(ox+hp.x, oy+hp.y, sk.headRadius, 0, Math.PI*2);
      oc.fillStyle = '#1a1a1a'; oc.fill();
    }
  }
  const link = document.createElement('a');
  link.download = 'spritesheet.png'; link.href = out.toDataURL('image/png'); link.click();
  setInfo(`导出 ${frames.length} 帧 (${out.width}x${out.height})`);
}

// ── 键盘快捷键 ────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.key==='z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  switch (e.key) {
    case 'a': case 'A': dupFrame(); break;
    case 'ArrowLeft':  if (currentFrame > 0) { currentFrame--; render(); } break;
    case 'ArrowRight': if (currentFrame < frames.length-1) { currentFrame++; render(); } break;
    case 'Delete': case 'Backspace': delFrame(); break;
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'l': case 'L': toggleBoneLock(); break;
    case 'm': case 'M': mirrorPose(); break;
    case 'g': case 'G': toggleTranslateMode(); break;
  }
});

// ── 暴露到全局 ────────────────────────────────────────────────────────────────
window.app = {
  render, undo, redo, mirrorPose, toggleBoneLock,
  addFrame, dupFrame, delFrame, resetPose, togglePlay,
  interpolateFrames, handleImageUpload,
  loadJSON, exportJSON, exportSpriteSheet,
  moveFrameLeft, moveFrameRight, switchSkeleton,
  toggleGestureMode, toggleTranslateMode,
  filterClips, loadClipFromBrowser,
  togglePreview, loadPreviewBase,
  setTransitionRef, updateVariantParam,
};

// ── 初始化 ────────────────────────────────────────────────────────────────────
async function init() {
  await initSkeletons();
  setSkeleton('human');
  frames = [defaultPose()];
  await loadManifest();
  render();
}

init();
