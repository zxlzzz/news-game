/**
 * StickRenderer
 * 读取 StickPuppet JSON 格式的动画数据，用 Phaser Graphics 实时绘制火柴人。
 * 多个 NPC 可以共享同一份动画数据。
 *
 * 骨骼弯曲支持：
 *   JSON 顶层可有 globalBend 字段，key = "from__to"，值为法向偏移 px。
 *   每帧对象里 "_bend_from__to" 键作为 per-frame 覆盖。
 *   优先级：per-frame > globalBend > 0（默认直线）。
 */

// 骨骼连线定义 [from, to, lineWidth]
const BONES = [
  ['body', 'neck',    4  ],
  ['neck', 'head',    3  ],
  ['neck',    'l_elbow', 3  ], ['l_elbow', 'l_hand', 2.5],
  ['neck',    'r_elbow', 3  ], ['r_elbow', 'r_hand', 2.5],
  ['body',    'l_knee',  3.5], ['l_knee',  'l_foot', 2.5],
  ['body',    'r_knee',  3.5], ['r_knee',  'r_foot', 2.5],
];

const HEAD_RADIUS  = 10;
const CURVE_SEGS   = 10; // 贝塞尔曲线折线段数

/**
 * 取骨骼弯曲值（px，未缩放）
 * @param {string} from
 * @param {string} to
 * @param {object} frame       - 当前帧数据对象
 * @param {object} globalBend  - 动画级默认弯曲表 { "from__to": number }
 * @returns {number}
 */
function getBend(from, to, frame, globalBend) {
  // per-frame 覆盖值（优先级最高）
  const perFrameKey = `_bend_${from}__${to}`;
  if (perFrameKey in frame) return frame[perFrameKey];

  // 动画级全局默认值
  const globalKey = `${from}__${to}`;
  if (globalBend && globalKey in globalBend) return globalBend[globalKey];

  return 0;
}

/**
 * 绘制一段骨骼（直线或二次贝塞尔曲线）
 * lineStyle 由调用方在此之前设置。
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} x1  - 起点 X
 * @param {number} y1  - 起点 Y
 * @param {number} x2  - 终点 X
 * @param {number} y2  - 终点 Y
 * @param {number} bend - 法向偏移量（已按 scale×direction 缩放）
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

  // 法向量（骨骼方向旋转 90°）
  const nx = -dy / len;
  const ny =  dx / len;

  // 控制点 = 骨骼中点沿法向量偏移 bend px
  const cpx = (x1 + x2) / 2 + bend * nx;
  const cpy = (y1 + y2) / 2 + bend * ny;

  // 用折线近似二次贝塞尔曲线
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
    this.animations = {}; // name -> { frames, fps, frameCount, globalBend }
  }

  /**
   * 加载一个动画
   * @param {string} name - 动画名称 (walk, run, idle, ...)
   * @param {object} data - StickPuppet JSON { frames, fps?, globalBend? }
   */
  loadAnimation(name, data) {
    this.animations[name] = {
      frames:     data.frames,
      fps:        data.fps        || 8,
      frameCount: data.frames.length,
      globalBend: data.globalBend ?? {}, // 无此字段时默认空对象（等效全 0）
    };
  }

  /** 获取动画元信息 */
  getAnimation(name) {
    return this.animations[name] || null;
  }

  /**
   * 绘制一帧火柴人
   * @param {Phaser.GameObjects.Graphics} g
   * @param {string} animName
   * @param {number} frameIndex
   * @param {number} x         - 脚底世界坐标 X
   * @param {number} y         - 脚底世界坐标 Y
   * @param {number} scale     - 缩放（默认 0.45）
   * @param {number} direction - 1=面右，-1=面左
   * @param {number} color     - 颜色（16进制）
   * @param {number} alpha     - 透明度
   */
  draw(g, animName, frameIndex, x, y, scale = 0.45, direction = 1, color = 0x1a1a1a, alpha = 1) {
    const anim = this.animations[animName];
    if (!anim) return;

    const frame = anim.frames[frameIndex % anim.frameCount];
    const s = scale;
    const d = direction;

    // 脚底对齐：body=[0,0]，foot 约在 y=120，让 (x,y) 成为脚底
    const footY   = Math.max(frame.l_foot[1], frame.r_foot[1]);
    const offsetY = -footY * s;

    const jx = (joint) => x + frame[joint][0] * s * d;
    const jy = (joint) => y + frame[joint][1] * s + offsetY;

    // 绘制骨骼（直线或弯曲贝塞尔）
    for (const [from, to, w] of BONES) {
      // bend 随 scale 缩放，随 direction 镜像（保证左右对称的曲线方向一致）
      const bend = getBend(from, to, frame, anim.globalBend) * s * d;
      g.lineStyle(w * s * 2, color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    // 绘制头部
    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), HEAD_RADIUS * s);
  }
}
