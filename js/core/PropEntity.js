import { Entity } from './Entity.js';
import { getPropDef } from './propRegistry.js';
import '../entity/props.all.js';  // 副作用 import：触发所有 propType 的 registerProp()

export class PropEntity extends Entity {
  constructor(config) {
    super({ ...config, static: true });
    this.propType  = config.propType  || 'generic';
    this.propColor = config.propColor ?? 0x888888;
    this.dir       = config.dir       ?? 1;
    this.facing    = config.facing    ?? 'down';
    this.seatH     = config.seatH     ?? null;
    this.topH      = config.topH      ?? null;

    this._def      = getPropDef(this.propType);
    this.obstacle  = this._def?.obstacle === true;
    this.footprint = this._computeFootprint();

    // 需从 config 抄到实例的额外字段（如 busstop-roof 的顶棚/柱子几何，
    // y = 柱子落地点；由 spawnBusStop 传入，drawBusStopRoof / bounds() 读取）
    for (const k of (this._def?.config ?? [])) this[k] = config[k];

    // 从 footprint.sortDY 推导 Y 排序偏移（stall/tree/sign 等有非零 sortDY）
    if (this.footprint.sortDY) this._sortY = this.y + this.footprint.sortDY;
    // 动态排序基准覆盖（busstop-roof 的柱子落地点由 spawnBusStop 传入）
    if (config._sortY != null) this._sortY = config._sortY;

    if (config.smartDef) {
      this.smartDef = config.smartDef;
      this._slots = config.smartDef.slots.map((s, i) => ({
        index:    i,
        role:     s.role,
        dx:       s.dx ?? 0,
        dy:       s.dy ?? 0,
        reserved: null,
      }));
    }

    if (config.affordances != null) this.affordances = config.affordances;
  }

  _computeFootprint() {
    if (this._def?.footprint) return this._def.footprint(this);
    if (this.obstacle)
      throw new Error(`PropEntity: no footprint declaration for obstacle type '${this.propType}'`);
    return { shape: 'rect', rx: 0, ry: 0, blocks: false, sortDY: 0 };
  }

  getBounds() {
    const s = this.scale ?? 1;

    if (this._def?.bounds) return this._def.bounds(this, s);

    const v = this._def?.visual;
    if (v) {
      return {
        x:      this.x - v.hw * s,
        y:      this.y - v.up * s,
        width:  v.hw * 2 * s,
        height: (v.up + v.down) * s,
      };
    }
    return super.getBounds();
  }

  /** 地面预通道：贴地平面元素（EntityManager.draw 在 Y 排序前调用） */
  drawGround(g) {
    if (!this.visible) return;
    g.lineStyle(0);
    this._def?.drawGround?.(g, this);
  }

  draw(g) {
    if (!this.visible) return;
    g.lineStyle(0);
    this._def?.draw?.(g, this);
  }
}
