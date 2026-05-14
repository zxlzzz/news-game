/**
 * StickRenderer
 * 读取 StickPuppet JSON 格式的动画数据，用 Phaser Graphics 实时绘制火柴人。
 * 多个 NPC 可以共享同一份动画数据。
 */

// 骨骼连线定义 [from, to, lineWidth]
const BONES = [
  ['body','neck',4], ['neck','head',3],
  ['neck','l_elbow',3], ['l_elbow','l_hand',2.5],
  ['neck','r_elbow',3], ['r_elbow','r_hand',2.5],
  ['body','l_knee',3.5], ['l_knee','l_foot',2.5],
  ['body','r_knee',3.5], ['r_knee','r_foot',2.5],
];

const HEAD_RADIUS = 10;

export class StickRenderer {
  constructor(scene) {
    this.scene = scene;
    this.animations = {};  // name -> { frames: [...], fps: number }
  }

  /**
   * 加载一个动画
   * @param {string} name - 动画名称 (walk, run, idle, etc.)
   * @param {object} data - StickPuppet JSON 数据 { frames: [...], fps?: number }
   */
  loadAnimation(name, data) {
    this.animations[name] = {
      frames: data.frames,
      fps: data.fps || 8,
      frameCount: data.frames.length,
    };
  }

  /**
   * 获取动画信息
   */
  getAnimation(name) {
    return this.animations[name] || null;
  }

  /**
   * 绘制一帧火柴人
   * @param {Phaser.GameObjects.Graphics} g - Graphics 对象
   * @param {string} animName - 动画名称
   * @param {number} frameIndex - 帧索引
   * @param {number} x - 世界坐标 x（火柴人脚底位置）
   * @param {number} y - 世界坐标 y（火柴人脚底位置）
   * @param {number} scale - 缩放（默认0.45，约80px高）
   * @param {number} direction - 1=面向右，-1=面向左
   * @param {number} color - 颜色（16进制）
   * @param {number} alpha - 透明度
   */
  draw(g, animName, frameIndex, x, y, scale = 0.45, direction = 1, color = 0x1a1a1a, alpha = 1) {
    const anim = this.animations[animName];
    if (!anim) return;

    const frame = anim.frames[frameIndex % anim.frameCount];
    const s = scale;
    const d = direction; // 1 or -1 for horizontal flip

    // 火柴人数据的 body 是原点 [0,0]，foot 大约在 y=78
    // 我们让 (x, y) 是脚底位置，所以需要把整个人往上偏移
    const footY = Math.max(
      frame.l_foot[1],
      frame.r_foot[1]
    );
    const offsetY = -footY * s; // 让脚底对齐到 y

    // 辅助函数：获取关节的屏幕坐标
    const jx = (joint) => x + frame[joint][0] * s * d;
    const jy = (joint) => y + frame[joint][1] * s + offsetY;

    // 画骨骼
    for (const [from, to, w] of BONES) {
      g.lineStyle(w * s * 2, color, alpha);
      g.lineBetween(jx(from), jy(from), jx(to), jy(to));
    }

    // 画头
    g.fillStyle(color, alpha);
    g.fillCircle(jx('head'), jy('head'), HEAD_RADIUS * s);
  }
}
