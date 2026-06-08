/**
 * PropDrawer — 所有道具的绘制函数
 *
 * 世界单位基准：火柴人原生高度 144 单位 = 1.7m，1m ≈ 85 单位。
 * 每个函数读 const s = p.scale ?? 1，所有几何尺寸均为世界单位 × s。
 * p.width / p.height 字段保留供碰撞/交互范围使用，不再影响视觉绘制。
 */

import { depthLineWidth, depthLineColor } from '../SceneConfig.js';
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
import { drawBusStopRoof } from '../entity/busstop-roof/drawBusStopRoof.js';
import { drawTree }        from '../entity/tree/drawTree.js';
import { drawVending }     from '../entity/vending/drawVending.js';
import { drawChessTable }  from '../entity/chess-table/drawChessTable.js';

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

// ─── 小摊 ────────────────────────────────────────────────────────────────────
// 宽290, 棚高144, 台面高72

function drawStall(g, p) {
  const { x, y } = p;
  const s       = p.scale ?? 1;
  const w       = 290 * s;
  const roofH   = 200 * s;
  const ctrH    = 72  * s;
  const lineW   = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
  const lineC   = depthLineColor(y, { light: 0x38, dark: 0x08 });
  const px      = x - w / 2;
  const counterY = y - ctrH;

  // support poles
  g.lineStyle(lineW, lineC, 0.95);
  g.lineBetween(px + 6 * s, y, px + 6 * s, y - roofH);
  g.lineBetween(px + w - 6 * s, y, px + w - 6 * s, y - roofH);

  // awning
  const aY = y - roofH, aH = 17 * s;
  g.fillStyle(0x707070, 1);
  g.beginPath();
  g.moveTo(px, aY + aH); g.lineTo(px + w, aY + aH);
  g.lineTo(px + w + 9 * s, aY); g.lineTo(px - 9 * s, aY);
  g.closePath(); g.fillPath();
  g.lineStyle(lineW, lineC, 0.95); g.strokePath();
  // awning stripes
  g.lineStyle(1.5 * s, 0xdddddd, 0.7);
  for (let i = 1; i < Math.floor(w / (17 * s)); i++) {
    const sx = px - 9 * s + i * 17 * s;
    g.lineBetween(sx, aY, sx + 4 * s, aY + aH);
  }

  // counter
  g.fillStyle(0xc0c0c0, 1);
  g.fillRect(px + 3 * s, counterY, w - 6 * s, 11 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px + 3 * s, counterY, w - 6 * s, 11 * s);

  // items
  g.fillStyle(0x9a9a9a, 1);
  const itemW = 11 * s, itemH = 9 * s;
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.fillRect(gx, counterY - itemH, itemW, itemH);
    g.lineStyle(1.2 * s, lineC, 0.85);
    g.strokeRect(gx, counterY - itemH, itemW, itemH);
  }
}
