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
   * @param {object} data - StickPuppet JSON { frames, fps?, globalBend?, skeleton? }
   */
  loadAnimation(name, data) {
    this.animations[name] = {
      frames:     data.frames,
      fps:        data.fps        || 8,
      frameCount: data.frames.length,
      globalBend: data.globalBend ?? {},
      skeleton:   data.skeleton   || 'human',
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
   * @param {number} x         - 脚底世界坐标 X
   * @param {number} y         - 脚底世界坐标 Y
   * @param {number} scale
   * @param {number} direction - 1=面右，-1=面左
   * @param {number} color
   * @param {number} alpha
   */
  draw(g, animName, frameIndex, x, y, scale = 0.45, direction = 1, color = 0x1a1a1a, alpha = 1) {
    const anim = this.animations[animName];
    if (!anim) return;
    const frame = anim.frames[frameIndex % anim.frameCount];
    if (anim.skeleton === 'dog') {
      this._drawDog(g, anim, frame, x, y, scale, direction, color, alpha);
    } else {
      this._drawHuman(g, anim, frame, x, y, scale, direction, color, alpha);
    }
  }

  _drawHuman(g, anim, frame, x, y, s, d, color, alpha) {
    const footY   = Math.max(frame.l_foot[1], frame.r_foot[1]);
    const offsetY = -footY * s;
    const jx = (joint) => x + frame[joint][0] * s * d;
    const jy = (joint) => y + frame[joint][1] * s + offsetY;

    for (const [from, to, w] of BONES) {
      const bend = getBend(from, to, frame, anim.globalBend) * s * d;
      g.lineStyle(w * s * 2, color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), HEAD_RADIUS * s);
  }

  _drawDog(g, anim, frame, x, y, s, d, color, alpha) {
    const footY = Math.max(
      frame.fl_lower[1], frame.fr_lower[1],
      frame.bl_lower[1], frame.br_lower[1]
    );
    const offsetY = -footY * s;
    const jx = (joint) => x + frame[joint][0] * s * d;
    const jy = (joint) => y + frame[joint][1] * s + offsetY;

    for (const [from, to, w] of DOG_BONES) {
      const bend = getBend(from, to, frame, anim.globalBend) * s * d;
      g.lineStyle(w * s * 2, color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), DOG_HEAD_R * s);
  }
}
