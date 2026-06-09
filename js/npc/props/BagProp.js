/**
 * BagProp — a bag shape hanging from the NPC's left hand.
 */

import { NpcProp } from './NpcProp.js';

export class BagProp extends NpcProp {
  draw(g) {
    if (!this.active) return;
    const anchor = this.npc.getAnchor('hand_l');
    const s = this.npc.scale;
    const bw = 20 * s, bh = 14 * s;
    const x = anchor.x - bw / 2;
    const y = anchor.y;

    // 阴影
    g.lineStyle(0);
    g.beginFill(0x000000, 0.25);
    g.drawRoundedRect(x + 2 * s, y + 3 * s, bw, bh, 5 * s);
    g.endFill();

    // 包身主体
    g.beginFill(0x5a5a5a, 0.9);
    g.drawRoundedRect(x, y, bw, bh, 5 * s);
    g.endFill();

    // 包身亮部（左侧高光）
    g.beginFill(0x8a8a8a, 0.5);
    g.drawRoundedRect(x + 1.5 * s, y + 1.5 * s, bw * 0.35, bh - 3 * s, 3 * s);
    g.endFill();

    // 包盖（顶部翻盖）
    g.beginFill(0x4a4a4a, 0.95);
    g.drawRoundedRect(x - 1 * s, y - 7 * s, bw + 2 * s, 12 * s, 5 * s);
    g.endFill();

    // 包盖上的扣带
    g.beginFill(0x3a3a3a);
    g.drawRect(x + bw * 0.4, y - 2 * s, bw * 0.2, 8 * s);
    g.endFill();

    // 扣环（小圆点）
    g.beginFill(0x2a2a2a);
    g.drawCircle(x + bw / 2, y + 5 * s, 2.5 * s);
    g.endFill();
    g.beginFill(0xaaaaaa, 0.6);
    g.drawCircle(x + bw / 2, y + 5 * s, 1.5 * s);
    g.endFill();

    // 包身缝合线
    g.lineStyle(Math.max(0.8, 1.2 * s), 0x3a3a3a, 0.8);
    g.drawRoundedRect(x + 3 * s, y + 3 * s, bw - 6 * s, bh - 6 * s, 3 * s);

    // 提手（弧形）
    g.lineStyle(Math.max(1, 2 * s), 0x4a4a4a, 0.9);
    g.moveTo(x + bw * 0.25, y - 3 * s);
    g.quadraticCurveTo(x + bw / 2, y - 12 * s, x + bw * 0.75, y - 3 * s);
  }
}
