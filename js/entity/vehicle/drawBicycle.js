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

export function drawBicycle(g, n) {
  g.lineStyle(0);
  const s = n.scale, d = n.direction, ground = n.y;

  // 量自 bike 首帧 FK 推导 2026-07
  // world = (n.x + jx*s*d,  n.y + jy*s);  jy 负值 = 地面以上
  const hipX   = n.x;                    // body   jx= 0,  jy=-82
  const hipY   = n.y - 82 * s;
  const barX   = n.x + 65 * s * d;       // r_hand jx=65,  jy=-66  (always forward)
  const barY   = n.y - 66 * s;
  const crankX = n.x + 28 * s * d;       // avg foot-midpoint across all frames: jx≈28, jy≈-37
  const crankY = n.y - 37 * s;
  const wR     = 25 * s;
  const wCy    = ground - wR;
  const rwx    = n.x - 5 * s * d;        // hip_jx(0) - 5
  const fwx    = n.x + 72 * s * d;       // bar_jx(65) + 7

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
  // 量自 mobile 首帧 FK 推导 2026-07（s=n.scale；原 *1.2 已折入常量，视觉不变）
  const s = n.scale, d = n.direction, ground = n.y;
  const hipX  = n.x + (-9)  * s * d;    // body   jx=-9,  jy=-59
  const hipY  = n.y + (-59) * s;
  const barX  = n.x +  32   * s * d;    // l_hand jx=32,  jy=-81  (forward hand)
  const barY  = n.y + (-81) * s;
  const wR    = 17.28 * s;              // 14.4 * 1.2
  const wCy   = ground - wR;
  const rwx   = n.x + (-32) * s * d;   // hip_jx(-9) − 23.04 (=19.2×1.2)
  const fwx   = n.x +  38   * s * d;   // bar_jx(32) + 5.76  (=4.8×1.2)
  const platY = n.y + (-17) * s;       // foot-mid jy(-19.5) + 2.88 (=2.4×1.2)

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
  const boxW  = 17.28 * s;             // 14.4 * 1.2
  const boxH  = 15.84 * s;             // 13.2 * 1.2
  const boxCx = n.x + (-35) * s * d;   // hip_jx(-9) − 25.92 (=21.6×1.2)
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(boxCx - boxW / 2, hipY - boxH, boxW, boxH);
  g.endFill();
  lenv(g, ground, 0.65);
  g.drawRect(boxCx - boxW / 2, hipY - boxH, boxW, boxH);
}
