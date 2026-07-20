import {
  FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';
import { vehicleAnchors } from '../../../assets/vehicle-anchors.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawBicycle(g, n) {
  g.lineStyle(0);
  const s = n.scale, d = n.direction, ground = n.y;

  const va     = vehicleAnchors.bike;
  const hipX   = n.x + va.hip_jx   * s * d;
  const hipY   = n.y + va.hip_jy   * s;
  const barX   = n.x + va.bar_jx   * s * d;
  const barY   = n.y + va.bar_jy   * s;
  const crankX = n.x + va.crank_jx * s * d;
  const crankY = n.y + va.crank_jy * s;
  const wR     = va.wR * s;
  const wCy    = ground - wR;
  const rwx    = n.x + va.rw_x_coeff * s * d;
  const fwx    = n.x + va.fw_x_coeff * s * d;

  // feet: getAnchor preserved — animation contact points (crank arms rotate each frame)
  const footL = n.getAnchor('foot_l');
  const footR = n.getAnchor('foot_r');

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

  // frame diamond
  lenv(g, ground, 0.9);
  g.moveTo(rwx,    wCy);     g.lineTo(crankX, crankY);
  g.moveTo(crankX, crankY);  g.lineTo(hipX,   hipY);
  g.moveTo(hipX,   hipY);    g.lineTo(rwx,    wCy);
  g.moveTo(crankX, crankY);  g.lineTo(barX,   barY);
  g.moveTo(fwx,    wCy);     g.lineTo(barX,   barY);

  // crank arms to feet (getAnchor — animation contact points)
  lenv(g, ground, 0.65);
  g.moveTo(crankX, crankY); g.lineTo(footL.x, footL.y);
  g.moveTo(crankX, crankY); g.lineTo(footR.x, footR.y);

  // pedals
  lenv(g, ground, 0.85);
  g.moveTo(footL.x - 2 * s * d, footL.y); g.lineTo(footL.x + 3 * s * d, footL.y);
  g.moveTo(footR.x - 2 * s * d, footR.y); g.lineTo(footR.x + 3 * s * d, footR.y);
}

export function drawEbike(g, n) {
  g.lineStyle(0);
  const s = n.scale, d = n.direction, ground = n.y;

  const va    = vehicleAnchors.mobile;
  const hipX  = n.x + va.hip_jx      * s * d;
  const hipY  = n.y + va.hip_jy      * s;
  const barX  = n.x + va.bar_jx      * s * d;
  const barY  = n.y + va.bar_jy      * s;
  const wR    = va.wR * s;
  const wCy   = ground - wR;
  const rwx   = n.x + va.rw_x_coeff  * s * d;
  const fwx   = n.x + va.fw_x_coeff  * s * d;
  const platY = n.y + va.plat_y_coeff * s;

  // wheels
  lenv(g, ground, 0.9);
  g.drawCircle(rwx, wCy, wR);
  g.drawCircle(fwx, wCy, wR);

  // platform (footrest rail)
  lenv(g, ground, 1.0);
  g.moveTo(rwx + wR * 0.6, platY);
  g.lineTo(fwx - wR * 0.6, platY);

  // tubes
  lenv(g, ground, 0.85);
  g.moveTo(rwx, wCy); g.lineTo(hipX, hipY);
  g.moveTo(fwx, wCy); g.lineTo(barX, barY);

  // battery box
  g.lineStyle(0);
  const boxW  = va.boxW * s;
  const boxH  = va.boxH * s;
  const boxCx = n.x + va.boxCx_x_coeff * s * d;
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(boxCx - boxW / 2, hipY - boxH, boxW, boxH);
  g.endFill();
  lenv(g, ground, 0.65);
  g.drawRect(boxCx - boxW / 2, hipY - boxH, boxW, boxH);
}
