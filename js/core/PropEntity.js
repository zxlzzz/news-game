import { Entity } from './Entity.js';
import { drawBench }       from '../entity/seat/drawBench.js';
import { drawChair }       from '../entity/seat/drawChair.js';
import { drawLamp }        from '../entity/lamp/drawLamp.js';
import { drawTrash }       from '../entity/trash/drawTrash.js';
import { drawSign }        from '../entity/sign/drawSign.js';
import { drawNewsRack }    from '../entity/newsrack/drawNewsRack.js';
import { drawHydrant }     from '../entity/hydrant/drawHydrant.js';
import { drawMailbox }     from '../entity/mailbox/drawMailbox.js';
import { drawPlanter }     from '../entity/planter/drawPlanter.js';
import { drawManhole }     from '../entity/manhole/drawManhole.js';
import { drawDrain }       from '../entity/drain/drawDrain.js';
import { drawFountain }    from '../entity/fountain/drawFountain.js';
import { drawPhoneBooth }  from '../entity/phonebooth/drawPhoneBooth.js';
import { drawBusStopRoof } from '../entity/busstop/drawBusStopRoof.js';
import { drawTree }        from '../entity/tree/drawTree.js';
import { drawVending }     from '../entity/vending/drawVending.js';
import { drawChessTable }  from '../entity/chess-table/drawChessTable.js';
import { drawStall }       from '../entity/stall/drawStall.js';

const OBSTACLE_TYPES = new Set([
  'fountain', 'slide', 'stall', 'tree', 'bench', 'trash', 'hydrant',
  'mailbox', 'newsrack', 'planter', 'vending', 'phonebooth', 'chess-table',
]);

export class PropEntity extends Entity {
  constructor(config) {
    super({ ...config, static: true });
    this.propType  = config.propType  || 'generic';
    this.propColor = config.propColor ?? 0x888888;
    this.dir       = config.dir       ?? 1;
    this.facing    = config.facing    ?? 'down';
    this.seatH     = config.seatH     ?? null;
    this.topH      = config.topH      ?? null;

    if (this.propType === 'bench') { this.width *= 3; this.height = 24; }

    this.obstacle = OBSTACLE_TYPES.has(this.propType);
    if (this.obstacle) {
      const [rx, ry] = this._calcCollision();
      this.collisionRX = rx;
      this.collisionRY = ry;
      this.collisionRadius = Math.max(rx, ry);
    } else {
      this.collisionRX = this.collisionRY = this.collisionRadius = 0;
    }

    // 公交站上半部分（顶棚 + 柱子）：y = 柱子落地点；几何参数由 drawBusStopRoof 读取
    if (this.propType === 'busstop-roof') {
      this.roofW         = config.roofW;
      this.roofH         = config.roofH;
      this.roofTopY      = config.roofTopY;       // 顶棚顶边绝对 y
      this.pillarOffset  = config.pillarOffset;   // 柱子相对 x 偏移
      this.pillarBottomY = config.pillarBottomY;  // 柱子底端绝对 y
    }

    // 简单 Y 排序偏移：让 stall 遮阳棚 / tree 树冠的排序基准上移，
    // 从而能遮住从其后方（更小 Y）走过的 NPC。其余 prop 用默认 y。
    if (this.propType === 'stall') this._sortY = this.y;
    if (this.propType === 'tree')  this._sortY = this.y - this.height * 0.35;
    // 显式指定排序基准（如 busstop-roof 的柱子落地点）
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
  }

  _calcCollision() {
    const w = this.width || 20, h = this.height || 20;
    switch (this.propType) {
      case 'fountain': case 'slide': case 'stall':
        return [w * 0.5, h * 0.5];
      case 'bench': {
        const half = w * 0.5;
        return (this.facing === 'left' || this.facing === 'right') ? [8, half] : [half, 8];
      }
      case 'tree':
        return [15, 15];
      case 'vending': case 'phonebooth': case 'chess-table':
        return [14, 12];
      default:
        return [10, 10];
    }
  }

  draw(g) {
    if (!this.visible) return;
    switch (this.propType) {
      case 'lamp':         drawLamp(g, this);        break;
      case 'bench':        drawBench(g, this);       break;
      case 'trash':        drawTrash(g, this);       break;
      case 'sign':         drawSign(g, this);        break;
      case 'newsrack':     drawNewsRack(g, this);    break;
      case 'hydrant':      drawHydrant(g, this);     break;
      case 'mailbox':      drawMailbox(g, this);     break;
      case 'planter':      drawPlanter(g, this);     break;
      case 'manhole':      drawManhole(g, this);     break;
      case 'drain':        drawDrain(g, this);       break;
      case 'chair':        drawChair(g, this);       break;
      case 'chess-table':  drawChessTable(g, this);  break;
      case 'tree':         drawTree(g, this);        break;
      case 'fountain':     drawFountain(g, this);    break;
      case 'stall':        drawStall(g, this);       break;
      case 'vending':      drawVending(g, this);     break;
      case 'phonebooth':   drawPhoneBooth(g, this);  break;
      case 'busstop-roof': drawBusStopRoof(g, this); break;
    }
  }
}
