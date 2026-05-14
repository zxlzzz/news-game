/**
 * Viewfinder
 * 可拖动的取景框，检测框内NPC
 */

export class Viewfinder {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.x = config.x || 300;
    this.y = config.y || 200;
    this.width = config.width || 200;
    this.height = config.height || 160;

    // 拖拽状态
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // 框内的NPC列表
    this.capturedNPCs = [];

    this._setupInput(scene);
  }

  _setupInput(scene) {
    scene.input.on('pointerdown', (pointer) => {
      // 转为世界坐标
      const wx = pointer.worldX;
      const wy = pointer.worldY;

      if (wx >= this.x && wx <= this.x + this.width &&
          wy >= this.y && wy <= this.y + this.height) {
        this.dragging = true;
        this.dragOffsetX = wx - this.x;
        this.dragOffsetY = wy - this.y;
      }
    });

    scene.input.on('pointermove', (pointer) => {
      if (!this.dragging) return;
      this.x = pointer.worldX - this.dragOffsetX;
      this.y = pointer.worldY - this.dragOffsetY;
    });

    scene.input.on('pointerup', () => {
      this.dragging = false;
    });
  }

  /**
   * 检测哪些NPC在取景框内
   * @param {NPC[]} npcs
   */
  updateCapture(npcs) {
    this.capturedNPCs = [];
    const vf = { x: this.x, y: this.y, w: this.width, h: this.height };

    for (const npc of npcs) {
      const b = npc.getBounds();
      // AABB 碰撞检测
      const overlap = !(
        b.x + b.width < vf.x ||
        b.x > vf.x + vf.w ||
        b.y + b.height < vf.y ||
        b.y > vf.y + vf.h
      );
      npc.inViewfinder = overlap;
      if (overlap) this.capturedNPCs.push(npc);
    }
  }

  /**
   * 绘制取景框
   * @param {Phaser.GameObjects.Graphics} g
   */
  draw(g) {
    // 半透明遮罩（框外变暗） - 简化版：只画框
    // 取景框边框
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeRect(this.x, this.y, this.width, this.height);

    // 四角标记
    const cornerLen = 12;
    const cx = this.x, cy = this.y, cw = this.width, ch = this.height;
    g.lineStyle(3, 0xff4444, 1);

    // 左上
    g.lineBetween(cx, cy, cx + cornerLen, cy);
    g.lineBetween(cx, cy, cx, cy + cornerLen);
    // 右上
    g.lineBetween(cx + cw, cy, cx + cw - cornerLen, cy);
    g.lineBetween(cx + cw, cy, cx + cw, cy + cornerLen);
    // 左下
    g.lineBetween(cx, cy + ch, cx + cornerLen, cy + ch);
    g.lineBetween(cx, cy + ch, cx, cy + ch - cornerLen);
    // 右下
    g.lineBetween(cx + cw, cy + ch, cx + cw - cornerLen, cy + ch);
    g.lineBetween(cx + cw, cy + ch, cx + cw, cy + ch - cornerLen);

    // 中心十字
    const centerX = cx + cw / 2;
    const centerY = cy + ch / 2;
    g.lineStyle(1, 0xffffff, 0.3);
    g.lineBetween(centerX - 10, centerY, centerX + 10, centerY);
    g.lineBetween(centerX, centerY - 10, centerX, centerY + 10);

    // 取景框内NPC数量
    if (this.capturedNPCs.length > 0) {
      // 使用 Phaser text 会更好，但这里简化：在框底部显示指示
      g.fillStyle(0xff4444, 0.8);
      g.fillCircle(cx + cw - 8, cy + 8, 5);
    }
  }

  /**
   * 获取取景框的世界坐标中心
   */
  getCenter() {
    return {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    };
  }

  /**
   * 获取框内NPC的标签（为API调用预留）
   */
  getCapturedTags() {
    const tags = new Set();
    for (const npc of this.capturedNPCs) {
      for (const tag of npc.tags) tags.add(tag);
    }
    return Array.from(tags);
  }
}
