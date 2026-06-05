/**
 * PixiText — 最小化 PIXI.Text 链式 API 封装。
 * 是一个 PIXI.Container：背景矩形（可选）+ 文本。供 StreetScene HUD 与 DebugOverlay 共用。
 */

function parseColor(str) {
  if (typeof str === 'number') return { color: str, alpha: 1 };
  if (typeof str !== 'string') return { color: 0x000000, alpha: 1 };
  if (str.startsWith('#')) return { color: parseInt(str.slice(1), 16), alpha: 1 };
  const m = str.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { color: (p[0] << 16) | (p[1] << 8) | p[2], alpha: p[3] === undefined ? 1 : p[3] };
  }
  return { color: 0x000000, alpha: 1 };
}

export class PixiText extends PIXI.Container {
  constructor(scene, x, y, str, style = {}) {
    super();
    this._scene = scene;
    this.style  = { ...style };
    this._origin = { x: 0, y: 0 };

    const fontSize = parseInt(style.fontSize, 10) || 13;
    const pixiStyle = {
      fontFamily: style.fontFamily || 'sans-serif',
      fontSize,
      fill: style.color || '#000000',
      align: style.align || 'left',
    };
    if (style.wordWrap) { pixiStyle.wordWrap = true; pixiStyle.wordWrapWidth = style.wordWrap.width; }
    if (style.lineSpacing) pixiStyle.leading = style.lineSpacing;

    this._bg  = new PIXI.Graphics();
    this._txt = new PIXI.Text(str ?? '', pixiStyle);
    this.addChild(this._bg, this._txt);

    this.position.set(x, y);
    this._redraw();
  }

  _redraw() {
    const padX = this.style.padding?.x ?? 0;
    const padY = this.style.padding?.y ?? 0;
    this._txt.position.set(padX, padY);
    const w = this._txt.width + padX * 2;
    const h = this._txt.height + padY * 2;
    this._bg.clear();
    if (this.style.backgroundColor) {
      const { color, alpha } = parseColor(this.style.backgroundColor);
      this._bg.beginFill(color, alpha);
      this._bg.drawRect(0, 0, w, h);
      this._bg.endFill();
    }
    this.pivot.set(w * this._origin.x, h * this._origin.y);
  }

  setText(str) {
    const s = String(str);
    if (this._txt.text !== s) { this._txt.text = s; this._redraw(); }
    return this;
  }
  setColor(c) { this.style.color = c; this._txt.style.fill = c; return this; }
  setPosition(x, y) { this.position.set(x, y); return this; }
  setOrigin(ox, oy = ox) { this._origin = { x: ox, y: oy }; this._redraw(); return this; }
  setVisible(v) { this.visible = v; return this; }
  setAlpha(a) { this.alpha = a; return this; }
  setDepth(d) { this.zIndex = d; return this; }
  setScrollFactor(f) {
    const target = (f === 0) ? this._scene.uiContainer : this._scene.worldContainer;
    target.addChild(this);
    return this;
  }
  setInteractive() { this.eventMode = 'static'; this.cursor = 'pointer'; return this; }
  on(event, cb) { super.on(event, cb); return this; }
}
