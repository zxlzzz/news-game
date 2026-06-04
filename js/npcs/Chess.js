/**
 * Chess — 象棋对弈组（2 棋手 + 棋桌 + 两椅 + 旁观者）
 *
 * 对齐：用棋手骨架锚点反推道具位置——
 *   棋桌桌面 = 双方 hand_r 的中点（手正好落在棋盘上）
 *   椅子椅面 = 各自 hip（人正好坐在椅面上）
 *   桌椅腿落到地面（棋手脚线）。道具先于棋手 add，保证棋手画在上层。
 *
 * spawner 只负责创建 NPC + 道具，把它们交给 SocialLayer 创建 ChessActivity，
 * 由 ChessActivity 驱动轮流落子（动画逻辑见 js/behavior/SocialLayer.js）。
 */

import { NPC }            from '../NPC.js';
import { PropEntity }     from '../PropEntity.js';

export function spawnChess(em, sr, bm, chessPlaza) {
  const Y = chessPlaza.cy;

  const scale = em.depthScale(Y);
  const gap   = Math.round(68 * scale / 0.26);
  const cx    = chessPlaza.cx;
  const chessA = new NPC({
    renderer: sr, x: cx - gap / 2, y: Y, animation: 'chess', direction:  1,
    speed: 0, vy: 0, minY: Y - 2, maxY: Y + 2,
    tags: ['player', 'chess', 'bystander'], playOnce: true,
  });
  const chessB = new NPC({
    renderer: sr, x: cx + gap / 2, y: Y, animation: 'chess', direction: -1,
    speed: 0, vy: 0, minY: Y - 2, maxY: Y + 2,
    tags: ['player', 'chess', 'bystander'], playOnce: true,
  });
  chessA.scale = chessB.scale = scale;
  chessA.frameIndex = chessB.frameIndex = 0;

  // ── 2) 读锚点反推桌椅 ──
  const handA = chessA.getAnchor('hand_r');
  const handB = chessB.getAnchor('hand_r');
  const hipA  = chessA.getAnchor('hip');
  const hipB  = chessB.getAnchor('hip');
  const boardMid = { x: (handA.x + handB.x) / 2, y: (handA.y + handB.y-10) / 2 };

  // 棋桌：x 居中于双手，腿落到地面 Y，桌面高度 = 地面到双手高度
  const table = em.add(new PropEntity({
    propType: 'chess-table', x: boardMid.x, y: Y,
    width: Math.max(20, Math.abs(handA.x - handB.x))-30, height: 18,
    topH: Math.max(10, Y - boardMid.y),
    tags: ['chess-table', 'game', 'street-furniture'],
    smartDef: {
      activityType: 'chess',
      routing: [{ activityFlag: 'chess_onlooker', role: 'onlooker', chance: 0.003, radius: 220, requireOccupied: true }],
      slots: [
        { role: 'player_a', dx: -(gap / 2),     dy: 0 },
        { role: 'player_b', dx:  (gap / 2),     dy: 0 },
        { role: 'onlooker', dx: -(gap * 0.24),  dy: 14 },
        { role: 'onlooker', dx:  (gap * 0.24),  dy: 14 },
      ],
    },
  }));
  // 棋手直接占用 player 槽（不走 routing）；onlooker 槽对外开放给路过行人
  const slotA = table._slots.find(s => s.role === 'player_a');
  const slotB = table._slots.find(s => s.role === 'player_b');
  slotA.reserved = chessA.id; slotA.ready = true; slotA.npc = chessA;
  slotB.reserved = chessB.id; slotB.ready = true; slotB.npc = chessB;
  // 两把椅子：椅面 = 各自 hip 高度
  const chairA = em.add(new PropEntity({
    propType: 'chair', x: hipA.x, y: Y, dir: +1,
    width: 14, height: 16, seatH: Math.max(8, Y - hipA.y),
    tags: ['chair', 'street-furniture'],
  }));
  const chairB = em.add(new PropEntity({
    propType: 'chair', x: hipB.x, y: Y, dir: -1,
    width: 14, height: 16, seatH: Math.max(8, Y - hipB.y),
    tags: ['chair', 'street-furniture'],
  }));

  chessA._sortY = Y + 1;
  chessB._sortY = Y + 1;
  
  // ── 3) 棋手入列（在桌椅之后 → 画在上层，人坐在椅上、手压在棋盘上） ──
  em.add(chessA);
  em.add(chessB);

  // ── 4) 纳入行为系统：注册 profile + 创建 ChessActivity 接管行为 ──
  //   旁观者不再硬编码生成，改由 SmartObject onlooker 槽吸引路过行人动态加入。
  bm.register(chessA, 'chess_player');
  bm.register(chessB, 'chess_player');
  bm.socialLayer.createActivity('chess',
    [{ npc: chessA, role: 'player_a' },
     { npc: chessB, role: 'player_b' }],
    [table, chairA, chairB]);
}
