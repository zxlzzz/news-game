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
 *
 * O-2 投影接线：人是**竖直广告牌**——脚下那个点是地面上的位置（纵深量，
 * 经 `toScreen` 换算），而关节相对脚下的偏移是"平长度"（身高/臂展，只经
 * `toScreenLength` 换算 `PX_PER_UNIT`，不参与 shear/tilt）。这正是
 * `Projection.js` 文件头「核心区分」那一条，跟 `frontFaceGraphics` 处理正面
 * 细节是同一个道理：地面位置要投影，立面上的高度不能跟着被压扁。
 * CLAUDE.md「坐标约定」的铁律（关节 y=0 = 地面接触线）不变，只是那条公式里
 * 的 `npc.y` 现在先过一次投影、关节偏移再乘 `PX_PER_UNIT`：
 *   base = toScreen(npc.x, npc.y)
 *   screen_x = base.x + toScreenLength(joint[0] * scale * dir)
 *   screen_y = base.y + toScreenLength(joint[1] * scale)
 * 四方向 clip 因此可以原样站在斜地面上，不需要为倾角重画——这就是 tasks.md
 * O-4「人不转」那句话的兑现方式。
 */
import { toScreen, toScreenLength } from './Projection.js';

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

// Fallback: used only if setSkeletons() has not been called.
const _HEAD_R_FALLBACK = { human: 10, dog: 7 };
const CURVE_SEGS   = 10; // 贝塞尔曲线折线段数

function getBend(from, to, frame, globalBend) {
  const perFrameKey = `_bend_${from}__${to}`;
  if (perFrameKey in frame) return frame[perFrameKey];
  const globalKey = `${from}__${to}`;
  if (globalBend && globalKey in globalBend) return globalBend[globalKey];
  return 0;
}

function drawBone(g, x1, y1, x2, y2, bend) {
  if (bend === 0) {
    g.moveTo(x1, y1); g.lineTo(x2, y2);
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

  g.beginFill(0, 0);
  g.moveTo(x1, y1);
  for (let i = 1; i <= CURVE_SEGS; i++) {
    const t  = i / CURVE_SEGS;
    const mt = 1 - t;
    g.lineTo(
      mt * mt * x1 + 2 * mt * t * cpx + t * t * x2,
      mt * mt * y1 + 2 * mt * t * cpy + t * t * y2
    );
  }
  g.endFill();
}

export class StickRenderer {
  constructor(scene) {
    this.scene      = scene;
    this.animations = {};
    this._headRadius = {};
  }

  setSkeletons(skeletons) {
    this._headRadius = {};
    for (const [name, skel] of Object.entries(skeletons ?? {})) {
      if (skel.headRadius != null) this._headRadius[name] = skel.headRadius;
    }
  }

  loadAnimation(name, data) {
    if (!data) return;
    this.animations[name] = {
      frames:     data.frames,
      fps:        data.fps        || 8,
      frameCount: data.frames.length,
      globalBend: data.globalBend ?? {},
      skeleton:   data.skeleton   || 'human',
      canonicalDirection: data.canonicalDirection || 1,
    };
  }

  getAnimation(name) {
    return this.animations[name] || null;
  }

  getFrame(animKey, frameIndex) {
    const anim = this.animations[animKey];
    if (!anim) return {};
    return anim.frames[frameIndex % anim.frameCount] ?? {};
  }

  draw(g, animName, frameIndex, x, y, scale = 0.45, direction = 1,
       color = 0x1a1a1a, alpha = 1, jointOverrides = null, skeletonOverride = null) {
    const anim = this.animations[animName];
    if (!anim) return;
    const frame = anim.frames[frameIndex % anim.frameCount];
    const dir   = direction * anim.canonicalDirection;
    // headKey 决定 headRadius 查表桶：正常走 anim 自带骨架名（human/dog），
    // NPC 声明了 profile.skeleton 覆盖（如 child）时优先用覆盖值，骨骼连线算法不变。
    const headKey = skeletonOverride ?? anim.skeleton;
    if (anim.skeleton === 'dog') {
      this._drawDog(g, anim, frame, x, y, scale, dir, color, alpha, jointOverrides, headKey);
    } else {
      this._drawHuman(g, anim, frame, x, y, scale, dir, color, alpha, jointOverrides, headKey);
    }
  }

  _drawHuman(g, anim, frame, x, y, s, d, color, alpha, ov, headKey) {
    const coord = (j) => (ov && ov[j]) ? ov[j] : frame[j];
    // 地面锚点过投影，关节偏移按平长度换算——见文件头「O-2 投影接线」
    const base = toScreen(x, y);
    const jx = (j) => base.x + toScreenLength(coord(j)[0] * s * d);
    const jy = (j) => base.y + toScreenLength(coord(j)[1] * s);

    for (const [from, to, w] of BONES) {
      const bend = toScreenLength(getBend(from, to, frame, anim.globalBend) * s * d);
      // 骨线宽度过去随 npc.scale（曾是 0.19 量级的景深缩放）一起缩，本质也是
      // 骨架单位长度；O-1 后 scale 恒为 1.0，不换算就会粗到 8px（56px 高的人
      // 身上占 14%，糊成一团）。同样过 toScreenLength → 约 3px，比例与旧版一致。
      g.lineStyle(toScreenLength(w * s * 2), color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.beginFill(color, alpha);
    g.drawCircle(jx('head'), jy('head'),
      toScreenLength((this._headRadius[headKey] ?? _HEAD_R_FALLBACK.human) * s));
    g.endFill();
  }

  _drawDog(g, anim, frame, x, y, s, d, color, alpha, ov, headKey) {
    const coord = (j) => (ov && ov[j]) ? ov[j] : frame[j];
    const base = toScreen(x, y);
    const jx = (j) => base.x + toScreenLength(coord(j)[0] * s * d);
    const jy = (j) => base.y + toScreenLength(coord(j)[1] * s);

    for (const [from, to, w] of DOG_BONES) {
      const bend = toScreenLength(getBend(from, to, frame, anim.globalBend) * s * d);
      // 骨线宽度过去随 npc.scale（曾是 0.19 量级的景深缩放）一起缩，本质也是
      // 骨架单位长度；O-1 后 scale 恒为 1.0，不换算就会粗到 8px（56px 高的人
      // 身上占 14%，糊成一团）。同样过 toScreenLength → 约 3px，比例与旧版一致。
      g.lineStyle(toScreenLength(w * s * 2), color, alpha);
      drawBone(g, jx(from), jy(from), jx(to), jy(to), bend);
    }

    g.beginFill(color, alpha);
    g.drawCircle(jx('head'), jy('head'),
      toScreenLength((this._headRadius[headKey] ?? _HEAD_R_FALLBACK.dog) * s));
    g.endFill();
  }
}
