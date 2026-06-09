/**
 * PropDrawer — 所有道具的绘制路由，零函数体。
 *
 * 世界单位基准：火柴人原生高度 144 单位 = 1.7m，1m ≈ 85 单位。
 * 每个函数读 const s = p.scale ?? 1，所有几何尺寸均为世界单位 × s。
 * p.width / p.height 字段保留供碰撞/交互范围使用，不再影响视觉绘制。
 */

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

export function drawProp(g, prop) {
  switch (prop.propType) {
    case 'lamp':        drawLamp(g, prop);       break;
    case 'bench':       drawBench(g, prop);      break;
    case 'trash':       drawTrash(g, prop);      break;
    case 'sign':        drawSign(g, prop);       break;
    case 'newsrack':    drawNewsRack(g, prop);   break;
    case 'hydrant':     drawHydrant(g, prop);    break;
    case 'mailbox':     drawMailbox(g, prop);    break;
    case 'planter':     drawPlanter(g, prop);    break;
    case 'manhole':     drawManhole(g, prop);    break;
    case 'drain':       drawDrain(g, prop);      break;
    case 'chair':       drawChair(g, prop);      break;
    case 'chess-table': drawChessTable(g, prop); break;
    case 'tree':        drawTree(g, prop);       break;
    case 'fountain':    drawFountain(g, prop);   break;
    case 'stall':       drawStall(g, prop);      break;
    case 'vending':     drawVending(g, prop);    break;
    case 'phonebooth':  drawPhoneBooth(g, prop); break;
    case 'busstop-roof': drawBusStopRoof(g, prop); break;
  }
}

