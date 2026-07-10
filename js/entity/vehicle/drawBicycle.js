import {
  FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

function forwardHand(n) {
  const hl = n.getAnchor('hand_l');
  const hr = n.getAnchor('hand_r');
  return (hr.x * n.direction >= hl.x * n.direction) ? hr : hl;
}

export function drawBicycle(g, n) {
  g.lineStyle(0);
  const s = n.scale, d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');

  const crank = { x: (footL.x + footR.x) / 2, y: (footL.y + footR.y) / 2 };
  const wR  = 25 * s;
  const wCy = ground - wR;
  const rwx = hip.x - 5 * s * d;
  const fwx = bar.x + 7 * s * d;

  // wheels
  lenv(g, ground, 0.85);
  g.drawCircle(rwx, wCy, wR);
  g.drawCircle(fwx, wCy, wR);

  // spokes
  lenv(g, ground, 0.3);
  g.moveTo(rwx - wR, wCy); g.lineTo(rwx + wR, wCy);
  g.moveTo(rwx, wCy - wR); g.lineTo(rwx, wCy + wR);
  g.moveTo(fwx - wR, wCy); g.lineTo(fwx + wR, wCy);
  g.moveTo(fwx, wCy - wR); g.lineTo(fwx, wCy + wR);

  // frame (diamond)
  lenv(g, ground, 0.9);
  g.moveTo(rwx, wCy);          g.lineTo(crank.x, crank.y);
  g.moveTo(crank.x, crank.y);  g.lineTo(hip.x, hip.y);
  g.moveTo(hip.x, hip.y);      g.lineTo(rwx, wCy);
  g.moveTo(crank.x, crank.y);  g.lineTo(bar.x, bar.y);
  g.moveTo(fwx, wCy);          g.lineTo(bar.x, bar.y);

  // cranks to feet
  lenv(g, ground, 0.65);
  g.moveTo(crank.x, crank.y); g.lineTo(footL.x, footL.y);
  g.moveTo(crank.x, crank.y); g.lineTo(footR.x, footR.y);

  // pedals
  lenv(g, ground, 0.85);
  g.moveTo(footL.x - 2 * s * d, footL.y); g.lineTo(footL.x + 3 * s * d, footL.y);
  g.moveTo(footR.x - 2 * s * d, footR.y); g.lineTo(footR.x + 3 * s * d, footR.y);
}

export function drawEbike(g, n) {
  g.lineStyle(0);
  const s = n.scale*1.2;
  const d = n.direction, ground = n.y;
  const hip   = n.getAnchor('hip');
  const bar   = forwardHand(n);
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');
  const footMidY = (footL.y + footR.y) / 2;

  const wR  = 14.4 * s;          // 12*1.2
  const wCy = ground - wR;
  const rwx = hip.x - 19.2 * s * d;  // 16*1.2
  const fwx = bar.x  +  4.8 * s * d; //  4*1.2

  // wheels
  lenv(g, ground, 0.9);
  g.drawCircle(rwx, wCy, wR);
  g.drawCircle(fwx, wCy, wR);

  // platform
  lenv(g, ground, 1.0);
  g.moveTo(rwx + wR * 0.6, footMidY + 2.4 * s);  // 2*1.2
  g.lineTo(fwx - wR * 0.6, footMidY + 2.4 * s);

  // tubes
  lenv(g, ground, 0.85);
  g.moveTo(rwx, wCy); g.lineTo(hip.x, hip.y);
  g.moveTo(fwx, wCy); g.lineTo(bar.x, bar.y);

  // box
  g.lineStyle(0);
  const boxW = 14.4 * s, boxH = 13.2 * s;  // 12*1.2, 11*1.2
  const boxCx = hip.x - 21.6 * s * d;      // 18*1.2
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
  g.endFill();
  lenv(g, ground, 0.65);
  g.drawRect(boxCx - boxW / 2, hip.y - boxH, boxW, boxH);
}