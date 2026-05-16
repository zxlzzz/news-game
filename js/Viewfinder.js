/**
 * Viewfinder
 * 可拖动取景框：检测框内所有实体（NPC、建筑、道具）并收集标签。
 */

export class Viewfinder {
  constructor(scene, config = {}) {
    this.scene  = scene;
    this.x      = config.x      || 300;
    this.y      = config.y      || 200;
    this.width  = config.width  || 200;
    this.height = config.height || 160;

    this.dragging    = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    // 框内实体列表（Entity 的任意子类）
    this.capturedEntities = [];

    this._setupInput(scene);
  }

  _setupInput(scene) {
    scene.input.on('pointerdown', (pointer) => {
      const wx = pointer.worldX;
      const wy = pointer.worldY;
      if (wx >= this.x && wx <= this.x + this.width &&
          wy >= this.y && wy <= this.y + this.height) {
        this.dragging    = true;
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
   * 检测哪些实体在取景框内（AABB），更新 entity.inViewfinder 标志
   * @param {Entity[]} entities - 所有存活可见实体
   */
  updateCapture(entities) {
    this.capturedEntities = [];
    const vf = { x: this.x, y: this.y, w: this.width, h: this.height };

    for (const e of entities) {
      const b = e.getBounds();
      const overlap = !(
        b.x + b.width  < vf.x ||
        b.x            > vf.x + vf.w ||
        b.y + b.height < vf.y ||
        b.y            > vf.y + vf.h
      );
      e.inViewfinder = overlap;
      if (overlap) this.capturedEntities.push(e);
    }
  }

  /**
   * 绘制取景框 UI
   * @param {Phaser.GameObjects.Graphics} g
   */
  draw(g) {
    const cx = this.x, cy = this.y, cw = this.width, ch = this.height;
    const cornerLen = 12;

    // 外框
    g.lineStyle(2, 0xffffff, 0.88);
    g.strokeRect(cx, cy, cw, ch);

    // 四角红色标记
    g.lineStyle(3, 0xff4444, 1);
    g.lineBetween(cx,      cy,      cx + cornerLen, cy);
    g.lineBetween(cx,      cy,      cx,      cy + cornerLen);
    g.lineBetween(cx + cw, cy,      cx + cw - cornerLen, cy);
    g.lineBetween(cx + cw, cy,      cx + cw, cy + cornerLen);
    g.lineBetween(cx,      cy + ch, cx + cornerLen,      cy + ch);
    g.lineBetween(cx,      cy + ch, cx,      cy + ch - cornerLen);
    g.lineBetween(cx + cw, cy + ch, cx + cw - cornerLen, cy + ch);
    g.lineBetween(cx + cw, cy + ch, cx + cw, cy + ch - cornerLen);

    // 中心十字
    const mx = cx + cw / 2, my = cy + ch / 2;
    g.lineStyle(1, 0xffffff, 0.3);
    g.lineBetween(mx - 10, my, mx + 10, my);
    g.lineBetween(mx, my - 10, mx, my + 10);

    // 捕获指示点
    if (this.capturedEntities.length > 0) {
      g.fillStyle(0xff4444, 0.85);
      g.fillCircle(cx + cw - 8, cy + 8, 5);
    }
  }

  /** 取景框世界坐标中心 */
  getCenter() {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  /** 收集框内所有实体的标签（去重），供新闻生成使用 */
  getCapturedTags() {
    const tags = new Set();
    for (const e of this.capturedEntities) {
      for (const tag of e.tags) tags.add(tag);
    }
    return Array.from(tags);
  }
}
