/**
 * Anim Preview — 火柴人动画预览 + overlayPose 调试工具
 *
 * 功能：
 *  - 预览 assets/animations/ 下所有动画，逐帧检查
 *  - 双人同屏对比（A/B），各自独立选动画和朝向
 *  - overlayPose JSON 输入，实时叠加到当前帧（橙色高亮被覆盖的关节）
 *  - 时间轴帧条点击跳帧
 *  - 社交子事件预设（push/give_item/handshake/point_at）
 *  - 导出当前帧完整关节坐标（含 overlay 合并）
 *
 * 渲染直接复刻 StickRenderer 逻辑，用 Canvas 2D 实现。
 */

// ─── 动画文件清单 ──────────────────────────────────────────────────────────────
// 对应 assets/animations/ 下所有 .json 文件
const ANIM_FILES = [
  'single', 'cross_arm', 'idle', 'walk', 'run', 'jog',
  'fall', 'get_up', 'lie_ground',
  'lean_wall', 'squat', 'squat down', 'stand up', 'sit_ground',
  'sit_bench', 'lie_bench',
  'chess', 'chess_onlookers', 'dogwalk',
  'bike', 'mobile',
];

// ─── 骨骼连线定义（与 StickRenderer.js 完全一致）─────────────────────────────
const BONES_HUMAN = [
  ['body', 'neck',    4  ],
  ['neck', 'head',    3  ],
  ['neck',    'l_elbow', 3  ], ['l_elbow', 'l_hand', 2.5],
  ['neck',    'r_elbow', 3  ], ['r_elbow', 'r_hand', 2.5],
  ['body',    'l_knee',  3.5], ['l_knee',  'l_foot', 2.5],
  ['body',    'r_knee',  3.5], ['r_knee',  'r_foot', 2.5],
];
const BONES_DOG = [
  ['body_back',  'body_front', 4  ],
  ['body_front', 'neck',       3  ],
  ['neck',       'head',       3  ],
  ['body_back',  'tail',       2  ],
  ['body_front', 'fl_upper',   2.5], ['fl_upper', 'fl_lower', 2],
  ['body_front', 'fr_upper',   2.5], ['fr_upper', 'fr_lower', 2],
  ['body_back',  'bl_upper',   2.5], ['bl_upper', 'bl_lower', 2],
  ['body_back',  'br_upper',   2.5], ['br_upper', 'br_lower', 2],
];
const HEAD_R     = 10;
const DOG_HEAD_R = 7;

// ─── 渲染参数 ──────────────────────────────────────────────────────────────────
const SCALE    = 1.2;   // 比游戏里大，方便检查细节
const GROUND_Y = 400;

// ─── 社交子事件预设（absolute overlayPose 值 = base + delta at t=1）─────────
// 基于 single.json 实测关节位：r_hand[-10,-18] l_hand[9,-19] r_elbow[14,-11] l_elbow[-14,-11]
// delta 来自 SocialLayer.js 的 SUB_EVENTS 配置
const PRESETS = {
  'push A（双手前推）':     { r_hand: [45,-21], r_elbow: [22,-15], l_hand: [44,-21], l_elbow: [18,-15] },
  'give_item A（右手给）':  { r_hand: [40,-21], r_elbow: [22,-14] },
  'give_item B（左手接）':  { l_hand: [44,-22], l_elbow: [6, -14] },
  'handshake A（右手伸）':  { r_hand: [30,-21], r_elbow: [20,-13] },
  'handshake B（左手伸）':  { l_hand: [39,-22], l_elbow: [1, -13] },
  'point_at A（右臂指）':   { r_hand: [50,-20], r_elbow: [24,-15] },
  'point_at B（头偏）':     { head:   [-6,-61] },
};

// ─── 颜色 ──────────────────────────────────────────────────────────────────────
const COLOR_A    = '#1a1a2e';   // 人物 A 深蓝
const COLOR_B    = '#1a2e1a';   // 人物 B 深绿
const COLOR_OV   = '#ff6b4a';   // 被 overlay 覆盖的关节/骨骼

// ═══ 主应用类 ═════════════════════════════════════════════════════════════════
class AnimPreview {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx    = this.canvas.getContext('2d');

    // 根据当前窗口大小确定画布尺寸
    this._sizeCanvas();

    // 双人状态
    this.puppets = {
      a: { x: 0, y: GROUND_Y, data: null, animName: 'single', dir: 1,  frame: 0, overlay: {} },
      b: { x: 0, y: GROUND_Y, data: null, animName: 'single', dir: -1, frame: 0, overlay: {} },
    };
    this._updatePuppetPositions();

    // 播放状态
    this.playing    = false;
    this.fps        = 8;
    this.lastRafTs  = 0;
    this.accumMs    = 0;

    this._buildUI();
    this._bindKeys();
    this._loadDefault();
  }

  // ── 初始化 ────────────────────────────────────────────────────────────────

  _sizeCanvas() {
    // 画布宽度 = 主区域宽度（body - 侧面板 292px）；高度固定
    const W = Math.max(400, window.innerWidth - 292);
    const H = window.innerHeight - 48;  // 减去 header
    this.canvas.width  = W;
    this.canvas.height = H;
    this.CANVAS_W = W;
    this.CANVAS_H = H;
  }

  _updatePuppetPositions() {
    const W = this.canvas.width;
    this.puppets.a.x = Math.round(W * 0.33);
    this.puppets.b.x = Math.round(W * 0.67);
    this.puppets.a.y = GROUND_Y;
    this.puppets.b.y = GROUND_Y;
  }

  _buildUI() {
    // 填充动画下拉菜单
    for (const id of ['A', 'B']) {
      const sel = document.getElementById(`animSelect${id}`);
      for (const name of ANIM_FILES) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      }
    }

    // 填充预设下拉菜单
    for (const id of ['A', 'B']) {
      const sel = document.getElementById(`preset${id}`);
      for (const name of Object.keys(PRESETS)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      }
    }

    // FPS 输入
    document.getElementById('fpsInput').addEventListener('input', e => {
      this.fps = Math.max(1, Math.min(60, parseInt(e.target.value) || 8));
    });

    // 窗口 resize
    window.addEventListener('resize', () => {
      this._sizeCanvas();
      this._updatePuppetPositions();
      this.render();
    });
  }

  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space')       { e.preventDefault(); this.togglePlay(); }
      if (e.code === 'ArrowLeft')   { e.preventDefault(); this.stepFrame(-1); }
      if (e.code === 'ArrowRight')  { e.preventDefault(); this.stepFrame(1); }
    });
  }

  async _loadDefault() {
    await Promise.all([
      this.loadAnim('a', 'single'),
      this.loadAnim('b', 'single'),
    ]);
    document.getElementById('animSelectA').value = 'single';
    document.getElementById('animSelectB').value = 'single';
  }

  // ── 动画加载 ──────────────────────────────────────────────────────────────

  async loadAnim(id, name) {
    const p = this.puppets[id];
    try {
      const url  = `../../assets/animations/${encodeURIComponent(name)}.json`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      p.data     = await resp.json();
      p.animName = name;
      p.frame    = 0;
    } catch (e) {
      console.warn(`[anim-preview] 加载失败: ${name}.json`, e);
    }
    this.render();
    this._renderTimeline();
  }

  // ── 播放控制 ──────────────────────────────────────────────────────────────

  togglePlay() {
    this.playing = !this.playing;
    document.getElementById('playBtn').textContent = this.playing ? '⏸ 暂停' : '▶ 播放';
    if (this.playing) {
      this.lastRafTs = performance.now();
      this.accumMs   = 0;
      requestAnimationFrame(t => this._loop(t));
    }
  }

  _loop(ts) {
    if (!this.playing) return;
    const dt = ts - this.lastRafTs;
    this.lastRafTs = ts;
    this.accumMs  += dt;
    const frameDur = 1000 / this.fps;
    if (this.accumMs >= frameDur) {
      this.accumMs -= frameDur;
      for (const p of Object.values(this.puppets)) {
        if (p.data) p.frame = (p.frame + 1) % p.data.frames.length;
      }
      this._renderTimeline();
    }
    this.render();
    requestAnimationFrame(t => this._loop(t));
  }

  stepFrame(delta) {
    if (this.playing) this.togglePlay();
    for (const p of Object.values(this.puppets)) {
      if (!p.data) continue;
      p.frame = (p.frame + delta + p.data.frames.length) % p.data.frames.length;
    }
    this.render();
    this._renderTimeline();
  }

  jumpTo(id, fi) {
    if (this.playing) this.togglePlay();
    if (this.puppets[id].data) this.puppets[id].frame = fi;
    this.render();
    this._renderTimeline();
  }

  // ── Overlay ────────────────────────────────────────────────────────────────

  updateOverlay(id, raw) {
    const p  = this.puppets[id];
    const ta = document.getElementById(`overlay${id.toUpperCase()}`);
    if (!raw.trim()) { p.overlay = {}; ta.classList.remove('error'); this.render(); return; }
    try {
      p.overlay = JSON.parse(raw);
      ta.classList.remove('error');
    } catch (_) {
      ta.classList.add('error');
    }
    this.render();
  }

  clearOverlay(id) {
    this.puppets[id].overlay = {};
    document.getElementById(`overlay${id.toUpperCase()}`).value = '';
    document.getElementById(`overlay${id.toUpperCase()}`).classList.remove('error');
    document.getElementById(`preset${id.toUpperCase()}`).value  = '';
    this.render();
  }

  applyPreset(id, name) {
    if (!name) return;
    const pose = PRESETS[name];
    if (!pose) return;
    const json = JSON.stringify(pose, null, 2);
    const ta   = document.getElementById(`overlay${id.toUpperCase()}`);
    ta.value   = json;
    this.updateOverlay(id, json);
  }

  copyOverlay(id) {
    const p    = this.puppets[id];
    const json = JSON.stringify(p.overlay, null, 2);
    this._toClipboard(json);
  }

  // ── 朝向切换 ──────────────────────────────────────────────────────────────

  toggleDir(id) {
    const p   = this.puppets[id];
    p.dir     = -p.dir;
    const btn = document.getElementById(`dirBtn${id.toUpperCase()}`);
    btn.textContent = p.dir > 0 ? '→ 右' : '← 左';
    this.render();
  }

  // ── 导出 ──────────────────────────────────────────────────────────────────

  exportFrame() {
    const out = {};
    for (const [id, p] of Object.entries(this.puppets)) {
      if (!p.data) continue;
      const frame   = p.data.frames[p.frame % p.data.frames.length];
      // 合并 frame + overlay（overlay 优先）
      const merged  = {};
      for (const [k, v] of Object.entries(frame)) {
        if (k.startsWith('_')) continue;
        merged[k] = p.overlay[k] ? p.overlay[k] : v;
      }
      out[`puppet_${id}`] = {
        anim: p.animName, frame: p.frame, dir: p.dir,
        joints: merged,
        ...(Object.keys(p.overlay).length > 0 && { overlay: { ...p.overlay } }),
      };
    }
    this._toClipboard(JSON.stringify(out, null, 2));
  }

  // ── 渲染：画布 ───────────────────────────────────────────────────────────

  render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // 背景
    ctx.fillStyle = '#e8e4de';
    ctx.fillRect(0, 0, W, H);

    // 天空渐变
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#ccc8c2');
    sky.addColorStop(1, '#e8e4de');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 地面线
    ctx.save();
    ctx.strokeStyle = '#9a9087';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
    ctx.restore();

    // 地面阴影带
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, GROUND_Y, W, 6);

    // 中线参考（虚线）
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    const mx = Math.round(W / 2);
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 绘制双人
    const [pa, pb] = [this.puppets.a, this.puppets.b];
    if (pb.data) this._drawPuppet(pb, COLOR_B);
    if (pa.data) this._drawPuppet(pa, COLOR_A);  // A 画在后，避免被 B 遮挡

    // 地面投影
    for (const [id, p] of [['a', pa], ['b', pb]]) {
      if (!p.data) continue;
      const shadowColor = id === 'a' ? COLOR_A : COLOR_B;
      ctx.save();
      ctx.globalAlpha   = 0.12;
      ctx.fillStyle     = shadowColor;
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND_Y + 3, 28, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 标签
    for (const [id, p] of [['a', pa], ['b', pb]]) {
      if (!p.data) this._drawLabel(p, id.toUpperCase(), '#888', '(未加载)');
      else this._drawLabel(p, id.toUpperCase(),
        id === 'a' ? COLOR_A : COLOR_B,
        `${p.animName}  dir:${p.dir > 0 ? '→' : '←'}  F${p.frame + 1}/${p.data.frames.length}`);
    }

    // 更新 UI 面板
    this._renderCoords('a');
    this._renderCoords('b');
    this._updateFrameInfo();
  }

  // ── 绘制单个火柴人 ────────────────────────────────────────────────────────

  _drawPuppet(p, baseColor) {
    const { data, frame, dir, overlay, x, y } = p;
    const frameData = data.frames[frame % data.frames.length];
    const s   = SCALE;
    const d   = dir * (data.canonicalDirection || 1);
    const ctx = this.ctx;
    const isDog = data.skeleton === 'dog';
    const bones = isDog ? BONES_DOG : BONES_HUMAN;

    // 关节坐标函数：overlay 优先
    const coord = (j) => overlay[j] ? overlay[j] : frameData[j];

    // Y 偏移（anchorMode 对齐）
    let offsetY;
    if (data.anchorMode === 'hip') {
      offsetY = -coord('body')[1] * s;
    } else if (data.anchorMode === 'back') {
      offsetY = 0;
    } else if (isDog) {
      offsetY = -Math.max(
        coord('fl_lower')[1], coord('fr_lower')[1],
        coord('bl_lower')[1], coord('br_lower')[1]
      ) * s;
    } else {
      offsetY = -Math.max(coord('l_foot')[1], coord('r_foot')[1]) * s;
    }

    const jx = (j) => x + coord(j)[0] * s * d;
    const jy = (j) => y + coord(j)[1] * s + offsetY;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 骨骼
    for (const [from, to, w] of bones) {
      if (!frameData[from] || !frameData[to]) continue;
      const bend = this._getBend(from, to, frameData, data.globalBend) * s * d;
      const isOv = overlay[from] || overlay[to];
      ctx.strokeStyle = isOv ? COLOR_OV : baseColor;
      ctx.lineWidth   = w * s * 2;
      this._drawBone(ctx, jx(from), jy(from), jx(to), jy(to), bend);
    }

    // 头部
    const headR    = (isDog ? DOG_HEAD_R : HEAD_R) * s;
    ctx.fillStyle  = overlay['head'] ? COLOR_OV : baseColor;
    ctx.beginPath();
    ctx.arc(jx('head'), jy('head'), headR, 0, Math.PI * 2);
    ctx.fill();

    // overlay 关节高亮点
    ctx.fillStyle = COLOR_OV;
    for (const jName of Object.keys(overlay)) {
      if (!frameData[jName]) continue;
      ctx.beginPath();
      ctx.arc(jx(jName), jy(jName), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawLabel(p, letter, color, text) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[${letter}] ${text}`, p.x, GROUND_Y + 22);
    ctx.restore();
  }

  // ── 骨骼渲染辅助（复刻 StickRenderer 逻辑）───────────────────────────────

  _getBend(from, to, frame, globalBend) {
    const perFrameKey = `_bend_${from}__${to}`;
    if (perFrameKey in frame) return frame[perFrameKey];
    const globalKey = `${from}__${to}`;
    if (globalBend && globalKey in globalBend) return globalBend[globalKey];
    return 0;
  }

  _drawBone(ctx, x1, y1, x2, y2, bend) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (bend !== 0) {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const cpx = (x1 + x2) / 2 + bend * nx;
      const cpy = (y1 + y2) / 2 + bend * ny;
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);
    } else {
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }

  // ── UI 面板更新 ────────────────────────────────────────────────────────────

  _renderCoords(id) {
    const p   = this.puppets[id];
    const el  = document.getElementById(`coords${id.toUpperCase()}`);
    if (!p.data) { el.innerHTML = '<span style="color:var(--fg2);font-size:10px">未加载</span>'; return; }

    const frame = p.data.frames[p.frame % p.data.frames.length];
    let html = '';
    for (const [joint, baseVal] of Object.entries(frame)) {
      if (joint.startsWith('_')) continue;
      const isOv = !!p.overlay[joint];
      const val  = isOv ? p.overlay[joint] : baseVal;
      const xStr = (typeof val[0] === 'number') ? val[0].toFixed(1) : '?';
      const yStr = (typeof val[1] === 'number') ? val[1].toFixed(1) : '?';
      html += `<div class="coord-row${isOv ? ' ov' : ''}">
        <span class="coord-label">${joint}</span>
        <span class="coord-val">[${xStr}, ${yStr}]</span>
        ${isOv ? '<span class="ov-badge">OV</span>' : ''}
      </div>`;
    }
    el.innerHTML = html;
  }

  _updateFrameInfo() {
    const pa = this.puppets.a, pb = this.puppets.b;
    const fa = pa.data ? `${pa.frame + 1}/${pa.data.frames.length}` : '--';
    const fb = pb.data ? `${pb.frame + 1}/${pb.data.frames.length}` : '--';
    document.getElementById('frameInfo').textContent = `A:${fa}  B:${fb}`;
  }

  _renderTimeline() {
    const bar = document.getElementById('timelineBar');
    let html = '';
    for (const [id, p] of [['a', this.puppets.a], ['b', this.puppets.b]]) {
      if (!p.data) continue;
      const fc        = p.data.frames.length;
      const tickClass = id === 'a' ? 'active' : 'active-b';
      html += `<div class="tl-row">
        <span class="tl-label">${id.toUpperCase()}</span>
        <div class="tl-frames">`;
      for (let i = 0; i < fc; i++) {
        html += `<div class="tl-tick${p.frame === i ? ` ${tickClass}` : ''}"
                      onclick="app.jumpTo('${id}',${i})">${i + 1}</div>`;
      }
      html += '</div></div>';
    }
    bar.innerHTML = html;
  }

  // ── 工具 ──────────────────────────────────────────────────────────────────

  _toClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => this._flash('已复制到剪贴板'))
      .catch(() => prompt('复制以下 JSON：', text));
  }

  _flash(msg) {
    const el = document.createElement('div');
    el.className   = 'flash-msg';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

// 挂到 window 供 HTML inline 事件使用
window.app = new AnimPreview();
