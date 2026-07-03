import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawPhoneBooth 的 w=80*s，半宽=40*s */
export function footprint(e) {
  return { rx: 40 * depthScale(e.y), ry: 12 };
}
