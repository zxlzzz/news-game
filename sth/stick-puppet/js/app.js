import {
  SKELETONS, JOINT_RADIUS, GRAB_RADIUS,
  setSkeleton, getSkeleton, getJointNames,
  defaultPose, clonePose, getDescendants,
  getBend, setBend, getGlobalBend, setGlobalBend,
  bendLocked, setBendLocked,
  lengthLocked, setLengthLocked,
  getGlobalBoneLength, setGlobalBoneLength,
} from './config.js';
import { History } from './history.js';

// ============================================
// 状态
// ============================================
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const CX = canvas.width / 2;
const CY = canvas.height / 2 + 20;

let frames = [defaultPose()];
let currentFrame = 0;
let dragging = null;        // joint name 或 '_bend_from__to'
let dragStarted = false;
let playing = false;
let playTimer = null;
let boneLocked = true;
let gestureMode = false;
let activeJoints = new Set();
let frameDurs = [0.3];

const history = new History();

// ============================================
// 工具函数
// ============================================
function toScreen(j) { return {x:CX+j.x, y:CY+j.y}; }

function getMousePos(e) {
  const r = canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height)};
}

function switchSkeleton(name) {
  history.save(frames, currentFrame);
  setSkeleton(name);
  frames = [defaultPose()];
  frameDurs = [0.3];
  currentFrame = 0;
  document.getElementById('coordsPanel').dataset.built = '';
  document.getElementById('boneLengthPanel').dataset.built = '';
  render();
  setInfo(`切换到: ${getSkeleton().name}`);
}

function findJointAt(mx, my) {
  const pose = frames[currentFrame];
  let closest = null, minD = GRAB_RADIUS;
  for (const name of getJointNames()) {
    const p = toScreen(pose[name]);
    const d = Math.hypot(mx-p.x, my-p.y);
    if (d < minD) { minD = d; closest = name; }
  }
  return closest;
}

/** 检测是否命中某骨骼的弯曲控制点，返回 '_bend_from__to' 或 null */
function findBendHandleAt(mx, my) {
  const pose = frames[currentFrame];
  const sk = getSkeleton();
  let closest = null, minD = GRAB_RADIUS + 2;
  for (const [from, to] of sk.bones) {
    const cp = getBendControlPoint(pose, from, to);
    const d = Math.hypot(mx - cp.x, my - cp.y);
    if (d < minD) { minD = d; closest = `_bend_${from}__${to}`; }
  }
  return closest;
}

/**
 * 计算二次贝塞尔控制点（屏幕坐标）
 * bend > 0 向骨骼左侧偏，bend < 0 向右侧偏
 */
function getBendControlPoint(pose, from, to) {
  const a = toScreen(pose[from]);
  const b = toScreen(pose[to]);
  const bend = getBend(from, to, pose);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // 法向量（垂直于骨骼方向）
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return { x: mx + nx * bend, y: my + ny * bend };
}

function setInfo(text) {
  document.getElementById('infoText').textContent = text;
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.remove('hidden');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// ============================================
// 渲染
// ============================================
function drawBone(ctx, ax, ay, bx, by, bend, w, color) {
  if (bend === 0) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  } else {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const cpx = mx + nx * bend, cpy = my + ny * bend;
    ctx.beginPath(); ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cpx, cpy, bx, by);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawFigure(pose, alpha=1, color='#1a1a1a', jColor='#e63322', showBendHandles=false) {
  const sk = getSkeleton();
  ctx.globalAlpha = alpha;
  for (const [from, to, w] of sk.bones) {
    const a = toScreen(pose[from]), b = toScreen(pose[to]);
    const bend = getBend(from, to, pose);
    drawBone(ctx, a.x, a.y, b.x, b.y, bend, w, color);
  }
  const hp = toScreen(pose[sk.headJoint]);
  ctx.beginPath(); ctx.arc(hp.x, hp.y, sk.headRadius, 0, Math.PI*2);
  ctx.fillStyle = color; ctx.fill();

  // 弯曲控制点
  if (showBendHandles) {
    for (const [from, to] of sk.bones) {
      const bend = getBend(from, to, pose);
      const key = `_bend_${from}__${to}`;
      const cp = getBendControlPoint(pose, from, to);
      const isActive = dragging === key;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 5, 0, Math.PI*2);
      ctx.fillStyle = isActive ? '#ffcc00' : (bend !== 0 ? '#44aaff' : 'rgba(100,160,255,0.4)');
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }

  for (const name of getJointNames()) {
    const p = toScreen(pose[name]);
    ctx.beginPath(); ctx.arc(p.x, p.y, JOINT_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = (name === dragging) ? '#ffcc00' : jColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  if (document.getElementById('showLabels').checked) {
    ctx.font = '10px "JetBrains Mono",monospace'; ctx.fillStyle = '#555';
    for (const name of getJointNames()) {
      const p = toScreen(pose[name]);
      ctx.fillText(sk.labels[name], p.x+10, p.y-8);
    }
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5f0eb'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gy = CY + 85;
  ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy);
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(CX-8, CY); ctx.lineTo(CX+8, CY);
  ctx.moveTo(CX, CY-8); ctx.lineTo(CX, CY+8);
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.stroke();

  if (document.getElementById('onionSkin').checked && currentFrame > 0)
    drawFigure(frames[currentFrame-1], 0.2, '#aaaacc', '#aaaacc', false);

  drawFigure(frames[currentFrame], 1, '#1a1a1a', '#e63322', true);
  updateCoordsDisplay();
  updateTimeline();
}

function renderThumb(pose, tc) {
  const sk = getSkeleton();
  const t = tc.getContext('2d'), tw = tc.width, th = tc.height, s = 0.25;
  t.clearRect(0, 0, tw, th); t.fillStyle = '#f5f0eb'; t.fillRect(0, 0, tw, th);
  t.save(); t.translate(tw/2, th/2+5); t.scale(s, s);
  for (const [from, to, w] of sk.bones) {
    const bend = getBend(from, to, pose);
    const a = pose[from], b = pose[to];
    if (bend === 0) {
      t.beginPath(); t.moveTo(a.x, a.y); t.lineTo(b.x, b.y);
    } else {
      const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
      const dx = b.x-a.x, dy = b.y-a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy/len, ny = dx/len;
      t.beginPath(); t.moveTo(a.x, a.y);
      t.quadraticCurveTo(mx+nx*bend, my+ny*bend, b.x, b.y);
    }
    t.strokeStyle = '#333'; t.lineWidth = w; t.lineCap = 'round'; t.stroke();
  }
  const hp = pose[sk.headJoint];
  t.beginPath(); t.arc(hp.x, hp.y, sk.headRadius, 0, Math.PI*2);
  t.fillStyle = '#333'; t.fill();
  t.restore();
}

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
      const axis = e.target.dataset.axis;
      const val = parseFloat(e.target.value);
      if (isNaN(val)) return;
      history.save(frames, currentFrame);
      frames[currentFrame][joint][axis] = val;
      render();
    });
    panel.dataset.built = '1';
  }

  const inputs = panel.querySelectorAll('input');
  inputs.forEach(inp => {
    const j = inp.dataset.joint, a = inp.dataset.axis;
    inp.value = Math.round(pose[j][a]);
  });

  updateBoneLengths();
}

function updateBoneLengths() {
  const sk = getSkeleton();
  const panel = document.getElementById('boneLengthPanel');
  const pose = frames[currentFrame];

  if (!panel.dataset.built) {
    panel.innerHTML = '';

    // 锁定开关
    const lockRow = document.createElement('div');
    lockRow.className = 'check-row';
    lockRow.innerHTML = `<label><input type="checkbox" id="lengthLockChk" ${lengthLocked ? 'checked' : ''}> 全局锁定（所有帧同步）</label>`;
    panel.appendChild(lockRow);
    document.getElementById('lengthLockChk')?.addEventListener('change', (e) => {
      setLengthLocked(e.target.checked);
    });

    // bend 全局锁定开关
    const bendLockRow = document.createElement('div');
    bendLockRow.className = 'check-row';
    bendLockRow.innerHTML = `<label><input type="checkbox" id="bendLockChk" ${bendLocked ? 'checked' : ''}> 弯曲全局锁定</label>`;
    panel.appendChild(bendLockRow);

    for (const [from, to, _w] of sk.bones) {
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

    // 骨骼长度改变
    panel.addEventListener('change', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      const from = e.target.dataset.from;
      const to = e.target.dataset.to;
      if (!from || !to) return;

      if (e.target.classList.contains('len-input')) {
        const newLen = parseFloat(e.target.value);
        if (isNaN(newLen) || newLen < 1) return;
        history.save(frames, currentFrame);
        if (lengthLocked) {
          setGlobalBoneLength(from, to, newLen, frames);
        } else {
          // 只改当前帧
          const p = frames[currentFrame];
          const dx = p[to].x - p[from].x, dy = p[to].y - p[from].y;
          const oldLen = Math.hypot(dx, dy) || 1;
          const scale = newLen / oldLen;
          const offX = p[from].x + dx*scale - p[to].x;
          const offY = p[from].y + dy*scale - p[to].y;
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

    // 事件绑定（等 DOM 稳定后）
    setTimeout(() => {
      document.getElementById('bendLockChk')?.addEventListener('change', (e) => {
        setBendLocked(e.target.checked);
      });
      document.getElementById('lengthLockChk')?.addEventListener('change', (e) => {
        setLengthLocked(e.target.checked);
      });
    }, 0);
  }

  // 更新数值
  panel.querySelectorAll('.len-input').forEach(inp => {
    const from = inp.dataset.from, to = inp.dataset.to;
    const dx = pose[to].x - pose[from].x, dy = pose[to].y - pose[from].y;
    inp.value = Math.round(Math.hypot(dx, dy));
  });
  panel.querySelectorAll('.bend-input').forEach(inp => {
    const from = inp.dataset.from, to = inp.dataset.to;
    inp.value = Math.round(getBend(from, to, pose));
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
      const num = document.createElement('span'); num.className = 'frame-num'; num.textContent = i+1;
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
    div.querySelector('.frame-num').textContent = i+1;
    renderThumb(frames[i], div.querySelector('canvas'));
    const dur = div.querySelector('.frame-dur');
    dur.style.display = gestureMode ? '' : 'none';
    if (gestureMode) dur.value = frameDurs[i] ?? 0.3;
  }
}

// ============================================
// 拖拽交互
// ============================================
canvas.addEventListener('mousedown', (e) => {
  if (playing) return;
  const {x, y} = getMousePos(e);

  // 优先检测弯曲控制点
  const bendHit = e.altKey ? findBendHandleAt(x, y) : null;
  if (bendHit) {
    dragging = bendHit;
    dragStarted = false;
    setInfo(`调整弯曲: ${bendHit.replace('_bend_','').replace('__','→')}`);
    return;
  }

  dragging = findJointAt(x, y);
  dragStarted = false;
  if (dragging) setInfo(`拖动: ${getSkeleton().labels[dragging]}`);
});

canvas.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  if (!dragStarted) {
    history.save(frames, currentFrame);
    dragStarted = true;
  }

  const {x, y} = getMousePos(e);
  const pose = frames[currentFrame];
  const sk = getSkeleton();

  // 弯曲控制点拖拽
  if (dragging.startsWith('_bend_')) {
    const parts = dragging.slice('_bend_'.length).split('__');
    const from = parts[0], to = parts[1];
    const a = toScreen(pose[from]), b = toScreen(pose[to]);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    // 鼠标偏移投影到法向量
    const proj = (x - mx) * nx + (y - my) * ny;
    setBend(from, to, proj, pose, frames);
    render();
    return;
  }

  // 关节拖拽（原逻辑不变）
  const parentName = sk.hierarchy[dragging].parent;
  if (!parentName) {
    const rootName = dragging;
    const dx = (x-CX) - pose[rootName].x, dy = (y-CY) - pose[rootName].y;
    for (const n of getJointNames()) { pose[n].x += dx; pose[n].y += dy; }
  } else if (boneLocked) {
    const parent = pose[parentName];
    const boneLen = Math.hypot(pose[dragging].x - parent.x, pose[dragging].y - parent.y);
    const oldAngle = Math.atan2(pose[dragging].y - parent.y, pose[dragging].x - parent.x);
    const newAngle = Math.atan2((y-CY) - parent.y, (x-CX) - parent.x);
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
    const newX = x - CX, newY = y - CY;
    const dx = newX - pose[dragging].x, dy = newY - pose[dragging].y;
    pose[dragging].x = newX; pose[dragging].y = newY;
    for (const desc of getDescendants(dragging)) { pose[desc].x += dx; pose[desc].y += dy; }
  }
  render();
});

canvas.addEventListener('mouseup', () => { dragging = null; setInfo('拖动红色关节点摆姿势'); render(); });
canvas.addEventListener('mouseleave', () => { dragging = null; render(); });

// ============================================
// 撤销/重做
// ============================================

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

function undo() {
  const snap = history.undo(frames, currentFrame);
  if (snap) { applySnapshot(snap); render(); setInfo('撤销'); }
}

function redo() {
  const snap = history.redo(frames, currentFrame);
  if (snap) { applySnapshot(snap); render(); setInfo('重做'); }
}

// ============================================
// 左右互换
// ============================================
function mirrorPose() {
  const sk = getSkeleton();
  history.save(frames, currentFrame);
  const pose = frames[currentFrame];
  for (const [l, r] of sk.mirrorPairs) {
    const tmpX = pose[l].x, tmpY = pose[l].y;
    pose[l].x = -pose[r].x; pose[l].y = pose[r].y;
    pose[r].x = -tmpX;      pose[r].y = tmpY;
  }
  const pairedJoints = new Set();
  for (const [l, r] of sk.mirrorPairs) { pairedJoints.add(l); pairedJoints.add(r); }
  for (const name of getJointNames()) {
    if (!pairedJoints.has(name)) pose[name].x = -pose[name].x;
  }
  render();
  setInfo('左右互换完成');
}

// ============================================
// 骨骼锁
// ============================================
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

// ============================================
// 姿势片段模式
// ============================================
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

// ============================================
// 帧管理
// ============================================
function addFrame() {
  history.save(frames, currentFrame);
  frames.push(defaultPose());
  frameDurs.push(0.3);
  currentFrame = frames.length - 1;
  render();
}

function dupFrame() {
  history.save(frames, currentFrame);
  frames.splice(currentFrame+1, 0, clonePose(frames[currentFrame]));
  frameDurs.splice(currentFrame+1, 0, frameDurs[currentFrame] ?? 0.3);
  currentFrame++;
  render();
}

function delFrame() {
  if (frames.length <= 1) return;
  history.save(frames, currentFrame);
  frames.splice(currentFrame, 1);
  frameDurs.splice(currentFrame, 1);
  if (currentFrame >= frames.length) currentFrame = frames.length - 1;
  render();
}

function resetPose() {
  history.save(frames, currentFrame);
  frames[currentFrame] = defaultPose();
  render();
}

function moveFrameLeft() {
  if (currentFrame <= 0) return;
  history.save(frames, currentFrame);
  [frames[currentFrame-1], frames[currentFrame]] = [frames[currentFrame], frames[currentFrame-1]];
  [frameDurs[currentFrame-1], frameDurs[currentFrame]] = [frameDurs[currentFrame], frameDurs[currentFrame-1]];
  currentFrame--;
  render();
}

function moveFrameRight() {
  if (currentFrame >= frames.length-1) return;
  history.save(frames, currentFrame);
  [frames[currentFrame], frames[currentFrame+1]] = [frames[currentFrame+1], frames[currentFrame]];
  [frameDurs[currentFrame], frameDurs[currentFrame+1]] = [frameDurs[currentFrame+1], frameDurs[currentFrame]];
  currentFrame++;
  render();
}

// ============================================
// 播放
// ============================================
function togglePlay() {
  playing = !playing;
  const btn = document.getElementById('playBtn');
  if (playing) {
    btn.textContent = '⏹ 停止';
    const fps = parseInt(document.getElementById('fpsInput').value) || 8;
    playTimer = setInterval(() => { currentFrame = (currentFrame+1) % frames.length; render(); }, 1000/fps);
  } else {
    btn.textContent = '▶ 播放';
    clearInterval(playTimer); playTimer = null;
  }
}

// ============================================
// 补帧插值
// ============================================
function interpolateFrames() {
  const fromIdx = parseInt(document.getElementById('interpFrom').value) - 1;
  const toIdx   = parseInt(document.getElementById('interpTo').value) - 1;
  const count   = parseInt(document.getElementById('interpCount').value);

  if (fromIdx<0||fromIdx>=frames.length||toIdx<0||toIdx>=frames.length) { alert('帧编号超出范围'); return; }
  if (fromIdx === toIdx) { alert('起始帧和结束帧不能相同'); return; }
  if (count<1||count>30) { alert('插入帧数 1-30'); return; }

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
    // 插值 per-frame bend 覆盖值
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
  render();
  setInfo(`已插入 ${count} 帧`);
}

// ============================================
// 图片提取（仅限 human 骨骼）
// ============================================
let poseLandmarker = null;
let mpLoading = false;

async function loadMediaPipe() {
  if (poseLandmarker) return poseLandmarker;
  if (mpLoading) return null;
  mpLoading = true;
  showLoading('正在加载 MediaPipe 模型...');
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
      runningMode: 'IMAGE',
      numPoses: 1,
    });
    hideLoading();
    return poseLandmarker;
  } catch (e) {
    hideLoading(); mpLoading = false;
    alert('MediaPipe 加载失败: ' + e.message);
    return null;
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const sk = getSkeleton();
  if (sk !== SKELETONS.human) {
    alert('图片提取仅支持人体骨骼，请先切换到 "人" 骨骼类型。');
    event.target.value = '';
    return;
  }
  const lm = await loadMediaPipe();
  if (!lm) return;
  showLoading('正在识别姿势...');
  const img = new Image();
  img.onload = () => {
    try {
      const result = lm.detect(img);
      if (!result.landmarks || result.landmarks.length === 0) {
        hideLoading(); alert('未检测到人体姿态'); return;
      }
      const marks = result.landmarks[0];
      const w = img.width, h = img.height;
      const lm2 = (idx) => [marks[idx].x*w, marks[idx].y*h];
      const nose=lm2(0), lSh=lm2(11), rSh=lm2(12);
      const lEl=lm2(13), rEl=lm2(14), lWr=lm2(15), rWr=lm2(16);
      const lHi=lm2(23), rHi=lm2(24), lKn=lm2(25), rKn=lm2(26);
      const lAn=lm2(27), rAn=lm2(28);
      const neck = [(lSh[0]+rSh[0])/2, (lSh[1]+rSh[1])/2];
      const body = [(lHi[0]+rHi[0])/2, (lHi[1]+rHi[1])/2];
      const n2n = Math.hypot(nose[0]-neck[0], nose[1]-neck[1]);
      const hd = [nose[0]-neck[0], nose[1]-neck[1]];
      const hl = Math.hypot(hd[0],hd[1]) || 1;
      const head = [nose[0]+(hd[0]/hl)*n2n*0.5, nose[1]+(hd[1]/hl)*n2n*0.5];
      const rel = (p) => ({x:p[0]-body[0], y:p[1]-body[1]});
      const raw = {
        head:rel(head), neck:rel(neck),
        l_elbow:rel(lEl), r_elbow:rel(rEl), l_hand:rel(lWr), r_hand:rel(rWr),
        body:{x:0,y:0},
        l_knee:rel(lKn), r_knee:rel(rKn), l_foot:rel(lAn), r_foot:rel(rAn),
      };
      const headY = raw.head.y;
      const footY = Math.max(raw.l_foot.y, raw.r_foot.y);
      const rawH = footY - headY;
      const scale = rawH > 0 ? 170/rawH : 1;
      history.save(frames, currentFrame);
      const pose = {};
      for (const name of getJointNames()) {
        pose[name] = { x:Math.round(raw[name].x*scale), y:Math.round(raw[name].y*scale) };
      }
      frames[currentFrame] = pose;
      hideLoading(); render();
      setInfo('姿势提取成功！');
    } catch (e) {
      hideLoading(); alert('提取失败: '+e.message); console.error(e);
    }
  };
  img.onerror = () => { hideLoading(); alert('图片加载失败'); };
  img.src = URL.createObjectURL(file);
  event.target.value = '';
}

// ============================================
// JSON 导入/导出
// ============================================
function loadJSON() {
  const ta = document.getElementById('jsonInput');
  try {
    const data = JSON.parse(ta.value);

    if (data.type === 'gesture') {
      gestureMode = true;
      activeJoints = new Set(Array.isArray(data.activeJoints) ? data.activeJoints : []);
      document.getElementById('gestureModeBtn').classList.add('active-toggle');
      document.getElementById('jointSelectPanel').style.display = '';
      _buildJointCheckboxes();
      history.save(frames, currentFrame);
      frames = []; frameDurs = [];
      for (const kf of (data.keyframes || [])) {
        const pose = defaultPose();
        for (const name of activeJoints) {
          if (kf[name]) {
            pose[name] = Array.isArray(kf[name])
              ? { x: kf[name][0], y: kf[name][1] }
              : { x: kf[name].x,  y: kf[name].y  };
          }
        }
        frames.push(pose);
        frameDurs.push(typeof kf.dur === 'number' ? kf.dur : 0.3);
      }
      if (!frames.length) { frames = [defaultPose()]; frameDurs = [0.3]; }
      document.getElementById('framesStrip').innerHTML = '';
      currentFrame = 0; render();
      setInfo(`载入手势片段 ${frames.length} 帧`);
      return;
    }

    if (!data.frames || !Array.isArray(data.frames)) { alert('需要 "frames" 数组'); return; }
    if (data.skeleton && SKELETONS[data.skeleton]) {
      setSkeleton(data.skeleton);
      document.getElementById('skeletonSelect').value = data.skeleton;
      document.getElementById('coordsPanel').dataset.built = '';
      document.getElementById('boneLengthPanel').dataset.built = '';
    }
    if (data.globalBend) {
      const sk = getSkeleton();
      for (const [from, to] of sk.bones.map(b => [b[0],b[1]])) {
        const key = `${from}__${to}`;
        if (key in data.globalBend) setGlobalBend(from, to, data.globalBend[key]);
      }
    }
    history.save(frames, currentFrame);
    frames = []; frameDurs = [];
    for (const fd of data.frames) {
      const pose = defaultPose();
      for (const name of getJointNames()) {
        if (fd[name]) {
          if (Array.isArray(fd[name])) pose[name] = {x:fd[name][0], y:fd[name][1]};
          else pose[name] = {x:fd[name].x, y:fd[name].y};
        }
      }
      for (const k of Object.keys(fd)) {
        if (k.startsWith('_bend_')) pose[k] = fd[k];
      }
      frames.push(pose);
      frameDurs.push(0.3);
    }
    currentFrame = 0; render();
    setInfo(`载入 ${frames.length} 帧`);
  } catch(e) { alert('JSON 解析失败: '+e.message); }
}

function exportJSON() {
  const sk = getSkeleton();
  let skeletonKey = 'human';
  for (const [key, val] of Object.entries(SKELETONS)) {
    if (val === sk) { skeletonKey = key; break; }
  }

  let data;
  if (gestureMode) {
    data = {
      type: 'gesture',
      activeJoints: [...activeJoints],
      keyframes: frames.map((pose, i) => {
        const kf = { dur: frameDurs[i] ?? 0.3 };
        for (const j of activeJoints) {
          if (pose[j]) kf[j] = [Math.round(pose[j].x), Math.round(pose[j].y)];
        }
        return kf;
      }),
      loop: false,
    };
  } else {
    const globalBend = {};
    for (const [from, to] of sk.bones.map(b => [b[0],b[1]])) {
      const v = getGlobalBend(from, to);
      if (v !== 0) globalBend[`${from}__${to}`] = v;
    }
    data = {
      name: 'animation',
      skeleton: skeletonKey,
      globalBend,
      frames: frames.map(pose => {
        const f = {};
        for (const name of getJointNames()) f[name] = [Math.round(pose[name].x), Math.round(pose[name].y)];
        for (const k of Object.keys(pose)) {
          if (k.startsWith('_bend_')) f[k] = Math.round(pose[k]);
        }
        return f;
      }),
    };
  }

  const ta = document.getElementById('jsonInput');
  ta.value = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(ta.value).then(
    () => setInfo('JSON 已导出并复制'),
    () => setInfo('JSON 已导出到文本框')
  );
}

// ============================================
// 导出 Held Pose / Trait —— 当前帧关节的绝对局部坐标
//   游戏渲染（StickRenderer）对 modifier.joints 是「绝对替换」语义，故导出绝对坐标，
//   与 gesture 导出一致，可直接粘进数据文件。
//   held pose：导出指定关节的绝对坐标（{ joints: { ... } }），粘进 HeldPoses.js
//   trait    ：仅导出左侧 l_elbow / l_hand 的绝对坐标，粘进 TraitProps.js
// 仅 human 骨架适用。
// ============================================
function _poseAbs(jointNames) {
  const pose = frames[currentFrame];
  const joints = {};
  for (const name of jointNames) {
    if (!pose[name]) continue;
    joints[name] = [Math.round(pose[name].x), Math.round(pose[name].y)];
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

function exportHeldPose() {
  if (getSkeleton() !== SKELETONS.human) { setInfo('Held Pose 仅支持 human 骨架'); return; }
  _emitData({ joints: _poseAbs(getJointNames()) }, 'Held Pose');
}

function exportTrait() {
  if (getSkeleton() !== SKELETONS.human) { setInfo('Trait 仅支持 human 骨架'); return; }
  // trait 只动左侧手臂（右手保持自然），与 hold_bag/walk_dog 一致
  _emitData({ joints: _poseAbs(['l_elbow', 'l_hand']) }, 'Trait');
}

// ============================================
// 导出 Sprite Sheet
// ============================================
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
    const ox = col*fw + fw/2, oy = row*fh + fh/2 + 20;
    const pose = frames[i];
    for (const [from, to, w] of sk.bones) {
      const bend = getBend(from, to, pose);
      const a = {x: ox + pose[from].x, y: oy + pose[from].y};
      const b = {x: ox + pose[to].x,   y: oy + pose[to].y};
      if (bend === 0) {
        oc.beginPath(); oc.moveTo(a.x, a.y); oc.lineTo(b.x, b.y);
      } else {
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        const dx = b.x-a.x, dy = b.y-a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy/len, ny = dx/len;
        oc.beginPath(); oc.moveTo(a.x, a.y);
        oc.quadraticCurveTo(mx + nx*bend, my + ny*bend, b.x, b.y);
      }
      oc.strokeStyle = '#1a1a1a'; oc.lineWidth = w; oc.lineCap = 'round'; oc.stroke();
    }
    const hp = pose[sk.headJoint];
    oc.beginPath(); oc.arc(ox+hp.x, oy+hp.y, sk.headRadius, 0, Math.PI*2);
    oc.fillStyle = '#1a1a1a'; oc.fill();
  }
  const link = document.createElement('a');
  link.download = 'spritesheet.png'; link.href = out.toDataURL('image/png'); link.click();
  setInfo(`导出 ${frames.length} 帧 (${out.width}x${out.height})`);
}

// ============================================
// 键盘快捷键
// ============================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.key==='z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  switch(e.key) {
    case 'a': case 'A': dupFrame(); break;
    case 'ArrowLeft': if(currentFrame>0){currentFrame--;render();} break;
    case 'ArrowRight': if(currentFrame<frames.length-1){currentFrame++;render();} break;
    case 'Delete': case 'Backspace': delFrame(); break;
    case ' ': e.preventDefault(); togglePlay(); break;
    case 'l': case 'L': toggleBoneLock(); break;
    case 'm': case 'M': mirrorPose(); break;
  }
});

// ============================================
// 暴露到全局
// ============================================
window.app = {
  render, undo, redo, mirrorPose, toggleBoneLock,
  addFrame, dupFrame, delFrame, resetPose, togglePlay,
  interpolateFrames, handleImageUpload,
  loadJSON, exportJSON, exportSpriteSheet,
  exportHeldPose, exportTrait,
  moveFrameLeft, moveFrameRight, switchSkeleton,
  toggleGestureMode,
};

// ============================================
// 初始化
// ============================================
render();