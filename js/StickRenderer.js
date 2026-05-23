/**
 * StickRenderer
 * 读取 StickPuppet JSON 格式的动画数据，用 Phaser Graphics 实时绘制角色。
 * 支持两种骨架：human（火柴人）和 dog（四足犬）。
 * 多个 NPC 可以共享同一份动画数据。
 *
 * 骨骼弯曲支持：
 *   JSON 顶层可有 globalBend 字段，key = "from__to"，值为法向偏移 px。
 *   每帧对象里 "_bend_from__to" 键作为 per-frame 覆盖。
 *   优先级：per-frame > globalBend > 0（默认直线）。
 */

// 人形骨骼连线定义 [from, to, lineWidth]
const BONES = [
  ['body', 'neck',    4  ],
  ['neck', 'head',    3  ],
  ['neck',    'l_elbow', 3  ], ['l_elbow', 'l_hand', 2.5],
  ['neck',    'r_elbow', 3  ], ['r_elbow', 'r_hand', 2.5],
  ['body',    'l_knee',  3.5], ['l_knee',  'l_foot', 2.5],
  ['body',    'r_knee',  3.5], ['r_knee',  'r_foot', 2.5],
];

// 狗骨骼连线定义（侧视四足）[from, to, lineWidth]
const DOG_BONES = [
  ['body_back',  'body_front', 4  ],
  ['body_front', 'neck',       3  ],
  ['neck',       'head',       3  ],
  ['body_back',  'tail',       2  ],
  ['body_front', 'fl_upper',   2.5], // 前左腿
  ['fl_upper',   'fl_lower',   2  ],
  ['body_front', 'fr_upper',   2.5], // 前右腿
  ['fr_upper',   'fr_lower',   2  ],
  ['body_back',  'bl_upper',   2.5], // 后左腿
  ['bl_upper',   'bl_lower',   2  ],
  ['body_back',  'br_upper',   2.5], // 后右腿
  ['br_upper',   'br_lower',   2  ],
];

const HEAD_RADIUS  = 10;
const DOG_HEAD_R   = 7;
const CURVE_SEGS   = 10; // 贝塞尔曲线折线段数

/**
 * 取骨骼弯曲值（px，未缩放）
 */
function getBend(from, to, frame, globalBend) {
  const perFrameKey = `_bend_${from}__${to}`;
  if (perFrameKey in frame) return frame[perFrameKey];
  const globalKey = `${from}__${to}`;
  if (globalBend && globalKey in globalBend) return globalBend[globalKey];
  return 0;
}

/**
 * 绘制一段骨骼（直线或二次贝塞尔曲线）
 */
function drawBone(g, x1, y1, x2, y2, bend) {
  if (bend === 0) {
    g.lineBetween(x1, y1, x2, y2);
    return;
  }

  const dx  = x2 - x1;
  const dy  = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const nx = -dy / len;
  const ny =  dx / len;
  const cpx = (x1 + x2) / 2 + bend * nx;
  const cpy = (y1 + y2) / 2 + bend * ny;

  g.beginPath();
  g.moveTo(x1, y1);
  for (let i = 1; i <= CURVE_SEGS; i++) {
    const t  = i / CURVE_SEGS;
    const mt = 1 - t;
    g.lineTo(
      mt * mt * x1 + 2 * mt * t * cpx + t * t * x2,
      mt * mt * y1 + 2 * mt * t * cpy + t * t * y2
    );
  }
  g.strokePath();
}

export class StickRenderer {
  constructor(scene) {
    this.scene      = scene;
    this.animations = {}; // name -> { frames, fps, frameCount, globalBend, skeleton }
  }

  /**
   * 加载一个动画
   * @param {string} name - 动画名称
   * @param {object} data - StickPuppet JSON
   *   { frames, fps?, globalBend?, skeleton?, anchorMode?, canonicalDirection? }
   */
  loadAnimation(name, data) {
    if (!data) return; // 防护：缺失的 JSON 不致整体崩溃
    this.animations[name] = {
      frames:     data.frames,
      fps:        data.fps        || 8,
      frameCount: data.frames.length,
      globalBend: data.globalBend ?? {},
      skeleton:   data.skeleton   || 'human',
      // 定位模式：'foot'(默认,最低脚落 y) / 'hip'(body关节落 y) / 'back'(不做竖直偏移)
      anchorMode: data.anchorMode || 'foot',
      // 基准朝向：动画作画时面向 +1=右 / -1=左；渲染翻转 = direction * canonicalDirection
      canonicalDirection: data.canonicalDirection || 1,
    };
  }

  /** 获取动画元信息 */
  getAnimation(name) {
    return this.animations[name] || null;
  }

  /**
   * 绘制一帧角色
   * @param {Phaser.GameObjects.Graphics} g
   * @param {string} animName
   * @param {number} frameIndex
   * @param {number} x         - 锚点世界坐标 X
   * @param {number} y         - 锚点世界坐标 Y（按 anchorMode 解释）
   * @param {number} scale
   * @param {number} direction - 1=面右，-1=面左（会再乘 canonicalDirection）
   * @param {number} color
   * @param {number} alpha
   * @param {Object<string,[number,number]>} [jointOverrides] - 关节坐标覆盖（代码控制肢体）
   */
  draw(g, animName, frameIndex, x, y, scale = 0.45, direction = 1,
       color = 0x1a1a1a, alpha = 1, jointOverrides = null) {
    const anim = this.animations[animName];
    if (!anim) return;
    const frame = anim.frames[frameIndex % anim.frameCount];
    const dir   = direction * anim.canonicalDirection;
    if (anim.skeleton === 'dog') {
      this._drawDog(g, anim, frame, x, y, scale, dir, color, alpha, jointOverrides);
    } else {
      this._drawHuman(g, anim, frame, x, y, scale, dir, color, alpha, jointOverrides);
    }
  }

  _drawHuman(g, anim, frame, x, y, s, d, color, alpha, ov) {
    const coord   = (j) => (ov && ov[j]) ? ov[j] : frame[j];
    const offsetY = humanOffsetY(anim, coord, s);
    const jx = (j) => x + coord(j)[0] * s * d;
    const jy = (j) => y + coord(j)[1] * s + offsetY;

    for (const [from, to, w] of BONES) {
      const bend = getBend(from, to, frame, anim.globalBend) * s * d;
      g.lineStyle(w * s * 2, color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), HEAD_RADIUS * s);
  }

  _drawDog(g, anim, frame, x, y, s, d, color, alpha, ov) {
    const coord   = (j) => (ov && ov[j]) ? ov[j] : frame[j];
    const offsetY = dogOffsetY(anim, coord, s);
    const jx = (j) => x + coord(j)[0] * s * d;
    const jy = (j) => y + coord(j)[1] * s + offsetY;

    for (const [from, to, w] of DOG_BONES) {
      const bend = getBend(from, to, frame, anim.globalBend) * s * d;
      g.lineStyle(w * s * 2, color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), DOG_HEAD_R * s);
  }
}

// ─── 按 anchorMode 计算竖直偏移（渲染器与 NPC.getAnchor 必须保持一致） ──────────
export function humanOffsetY(anim, coord, s) {
  if (anim.anchorMode === 'hip')  return -coord('body')[1] * s;
  if (anim.anchorMode === 'back') return 0;
  return -Math.max(coord('l_foot')[1], coord('r_foot')[1]) * s; // foot
}

export function dogOffsetY(anim, coord, s) {
  if (anim.anchorMode === 'hip')  return -coord('body_back')[1] * s;
  if (anim.anchorMode === 'back') return 0;
  return -Math.max(
    coord('fl_lower')[1], coord('fr_lower')[1],
    coord('bl_lower')[1], coord('br_lower')[1]
  ) * s; // foot
}
