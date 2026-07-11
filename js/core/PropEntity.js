import { Entity } from './Entity.js';
import { depthScale } from './Layout.js';
import { drawBench }       from '../entity/seat/drawBench.js';
import { drawChairL }      from '../entity/seat/drawChairL.js';
import { drawChairR }      from '../entity/seat/drawChairR.js';
import { drawLamp }        from '../entity/lamp/drawLamp.js';
import { drawTrash }       from '../entity/trash/drawTrash.js';
import { drawSign }        from '../entity/sign/drawSign.js';
import { drawNewsRack }    from '../entity/newsrack/drawNewsRack.js';
import { drawHydrant }     from '../entity/hydrant/drawHydrant.js';
import { drawMailbox }     from '../entity/mailbox/drawMailbox.js';
import { drawPlanter }     from '../entity/planter/drawPlanter.js';
import { drawManhole }     from '../entity/manhole/drawManhole.js';
import { drawDrain }       from '../entity/drain/drawDrain.js';
import { drawFountainPool, drawFountainNozzle } from '../entity/fountain/drawFountain.js';
import { drawPhoneBooth }  from '../entity/phonebooth/drawPhoneBooth.js';
import { drawBusStopRoof }  from '../entity/busstop/drawBusStopRoof.js';
import { drawBusStopBench } from '../entity/seat/drawBusStopBench.js';
import { drawBusStopSign }  from '../entity/busstop/drawBusStopSign.js';
import { drawTree }        from '../entity/tree/drawTree.js';
import { drawVending }     from '../entity/vending/drawVending.js';
import { drawChessTable }  from '../entity/chess-table/drawChessTable.js';
import { drawStall }       from '../entity/stall/drawStall.js';

import { footprint as fpBench }     from '../entity/seat/seat.js';
import { footprint as fpChess }     from '../entity/chess-table/chessTable.js';
import { footprint as fpVending }   from '../entity/vending/vending.js';
import { footprint as fpFountain }  from '../entity/fountain/fountain.js';
import { footprint as fpStall }     from '../entity/stall/stall.js';
import { footprint as fpTree }      from '../entity/tree/tree.js';
import { footprint as fpTrash }     from '../entity/trash/trash.js';
import { footprint as fpHydrant }   from '../entity/hydrant/hydrant.js';
import { footprint as fpMailbox }   from '../entity/mailbox/mailbox.js';
import { footprint as fpNewsrack }  from '../entity/newsrack/newsrack.js';
import { footprint as fpPlanter }   from '../entity/planter/planter.js';
import { footprint as fpPhone }     from '../entity/phonebooth/phonebooth.js';

/** 视觉包围盒 intrinsic（单位 = scale 1 时的世界像素，实际 ×depthScale）
 *  hw = 半宽；up/down = 自 y（地面接触线）向上/向下延伸
 *  数值来源 = 各 draw 文件内的硬编码尺寸，改绘制尺寸时须同步 */
const VISUAL_INTRINSIC = {
  drain:    { hw: 29,    up: 13.5, down: 13.5 },  // drawDrain: 58×27 以 y 居中
  fountain: { hw: 232.5, up: 128,  down: 116  },  // 300·0.775 半宽；喷柱顶 −outerRy·1.1；池底 +outerRy
  stall:    { hw: 145,   up: 200,  down: 14   },  // drawStall: w=290, roofH=200；down=footprint ry
};

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

    this.obstacle = OBSTACLE_TYPES.has(this.propType);
    if (this.obstacle) {
      const { rx, ry } = this._footprint();
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

  _footprint() {
    switch (this.propType) {
      case 'fountain':    return fpFountain(this);
      case 'stall':       return fpStall(this);
      case 'bench':       return fpBench(this);
      case 'tree':        return fpTree(this);
      case 'trash':       return fpTrash(this);
      case 'hydrant':     return fpHydrant(this);
      case 'mailbox':     return fpMailbox(this);
      case 'newsrack':    return fpNewsrack(this);
      case 'planter':     return fpPlanter(this);
      case 'vending':     return fpVending(this);
      case 'phonebooth':  return fpPhone(this);
      case 'chess-table': return fpChess(this);
      default:            return { rx: 10 * depthScale(this.y), ry: 10 };
    }
  }

    getBounds() {
  const s = this.scale ?? 1;

  // busstop-roof：横向 800·s（drawBusStopRoof 硬编码），纵向用实例绝对坐标
  if (this.propType === 'busstop-roof') {
    const hw  = 400 * s;
    const top = Math.min(this.roofTopY ?? this.y, this.y);
    const bot = Math.max(this.y, this.pillarBottomY ?? this.y);
    return { x: this.x - hw, y: top, width: hw * 2, height: Math.max(1, bot - top) };
  }

  const v = VISUAL_INTRINSIC[this.propType];
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
    switch (this.propType) {
      case 'fountain': drawFountainPool(g, this); break;
      case 'manhole':  drawManhole(g, this);      break;
      case 'drain':    drawDrain(g, this);        break;
    }
  }

  draw(g) {
    if (!this.visible) return;
    g.lineStyle(0);
    switch (this.propType) {
      case 'lamp':         drawLamp(g, this);           break;
      case 'bench':        drawBench(g, this);          break;
      case 'trash':        drawTrash(g, this);          break;
      case 'sign':         drawSign(g, this);           break;
      case 'newsrack':     drawNewsRack(g, this);       break;
      case 'hydrant':      drawHydrant(g, this);        break;
      case 'mailbox':      drawMailbox(g, this);        break;
      case 'planter':      drawPlanter(g, this);        break;
      case 'chair-l':      drawChairL(g, this);         break;
      case 'chair-r':      drawChairR(g, this);         break;
      case 'chess-table':  drawChessTable(g, this);     break;
      case 'tree':         drawTree(g, this);           break;
      case 'fountain':     drawFountainNozzle(g, this); break;
      case 'stall':        drawStall(g, this);          break;
      case 'vending':      drawVending(g, this);        break;
      case 'phonebooth':   drawPhoneBooth(g, this);     break;
      case 'busstop-roof':  drawBusStopRoof(g, this);   break;
      case 'busstop-bench': drawBusStopBench(g, this);  break;
      case 'busstop-sign':  drawBusStopSign(g, this);   break;
      // manhole / drain handled entirely in drawGround; nothing to draw in main pass
    }
  }
}
