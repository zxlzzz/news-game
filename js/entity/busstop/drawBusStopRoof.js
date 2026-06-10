export function drawBusStopRoof(g, p) {
  const s  = p.scale ?? 1;
  const rW = 800 * s;
  const rH = 30  * s;
  const rX = p.x - rW / 2;

  // roof panel
  g.beginFill(0xa0a0a0, 1);
  g.drawRect(rX, p.roofTopY, rW, rH);
  g.endFill();
  g.lineStyle(4.6 * s, 0x707070, 1);
  g.drawRect(rX, p.roofTopY, rW, rH);

  // support pillars
  const pillarT = p.roofTopY + rH;
  const pOff    = 325 * s;
  g.lineStyle(7.2 * s, 0x888888, 1);
  g.moveTo(p.x - pOff, pillarT); g.lineTo(p.x - pOff, p.pillarBottomY);
  g.moveTo(p.x + pOff, pillarT); g.lineTo(p.x + pOff, p.pillarBottomY);
}
