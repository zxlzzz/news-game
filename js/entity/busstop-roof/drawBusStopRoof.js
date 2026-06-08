export function drawBusStopRoof(g, p) {
  const s  = p.scale ?? 1;
  const rW = 800 * s;
  const rH = 30  * s;
  const rX = p.x - rW / 2;

  // roof panel
  g.fillStyle(0x686866, 1);
  g.fillRect(rX, p.roofTopY, rW, rH);
  g.lineStyle(4.6 * s, 0x181818, 1);
  g.strokeRect(rX, p.roofTopY, rW, rH);

  // support pillars
  const pillarT = p.roofTopY + rH;
  const pOff    = 325 * s;
  g.lineStyle(7.2 * s, 0x282828, 1);
  g.lineBetween(p.x - pOff, pillarT, p.x - pOff, p.pillarBottomY);
  g.lineBetween(p.x + pOff, pillarT, p.x + pOff, p.pillarBottomY);
}
