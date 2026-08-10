/** 落地接触面半宽/半深 — 对应 drawMailbox 的箱体 bw=40*s，半宽=20*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 20 * ds, ry: Math.max(3, 6 * ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawMailbox } from './drawMailbox.js';
registerProp('mailbox', { draw: drawMailbox, footprint, obstacle: true });
