/**
 * Chess — 象棋对弈组（2 棋手 + 棋桌 + 两椅 + 旁观者）
 *
 * 对齐：用棋手骨架锚点反推道具位置——
 *   棋桌桌面 = 双方 hand_r 的中点（手正好落在棋盘上）
 *   椅子椅面 = 各自 hip（人正好坐在椅面上）
 *   桌椅腿落到地面（棋手脚线）。道具先于棋手 add，保证棋手画在上层。
 *
 * 动画：两棋手轮流播放整套落子动画（playOnce），非活跃方冻结坐姿首帧。
 */

import { SIDEWALK_FAR_Y } from '../SceneConfig.js';
import { NPC }            from '../NPC.js';
import { PropEntity }     from '../PropEntity.js';

const WAIT_MS = 3500;

function startPlay(npc) {
  npc.playOnce   = true;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
}

function freezeAt0(npc) {
  npc.animDone   = true;
  npc.frameIndex = 0;
}

export function spawnChess(em, sr) {
  const Y     = SIDEWALK_FAR_Y;
  const state = { active: 'A', waiting: false, waitMs: 0 };

  // ── 1) 先建棋手对象（暂不入列），定好缩放与坐姿首帧，便于读锚点 ──
  const scale = em.depthScale(Y);
  const chessA = new NPC({
    renderer: sr, x: 600, y: Y, animation: 'chess', direction:  1,
    speed: 0, vy: 0, minY: Y - 2, maxY: Y + 2,
    tags: ['player', 'chess', 'bystander'], playOnce: true,
  });
  const chessB = new NPC({
    renderer: sr, x: 668, y: Y, animation: 'chess', direction: -1,
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
  em.add(new PropEntity({
    propType: 'chess-table', x: boardMid.x, y: Y,
    width: Math.max(20, Math.abs(handA.x - handB.x))-15, height: 18,
    topH: Math.max(10, Y - boardMid.y),
    tags: ['chess-table', 'game', 'street-furniture'],
  }));
  // 两把椅子：椅面 = 各自 hip 高度
  em.add(new PropEntity({
    propType: 'chair', x: hipA.x, y: Y, dir: +1,
    width: 14, height: 16, seatH: Math.max(8, Y - hipA.y),
    tags: ['chair', 'street-furniture'],
  }));
  em.add(new PropEntity({
    propType: 'chair', x: hipB.x, y: Y, dir: -1,
    width: 14, height: 16, seatH: Math.max(8, Y - hipB.y),
    tags: ['chair', 'street-furniture'],
  }));

  // ── 3) 棋手入列（在桌椅之后 → 画在上层，人坐在椅上、手压在棋盘上） ──
  em.add(chessA);
  em.add(chessB);

  // 旁观者站侧后方
  const by = new NPC({
    renderer: sr, x: 584, y: Y + 6, animation: 'idle', direction: 1,
    speed: 0, vy: 0, minY: Y + 4, maxY: Y + 8,
    tags: ['bystander'],
  });
  by.scale = em.depthScale(by.y);
  em.add(by);

  // 初始：A 落子，B 冻结
  startPlay(chessA);
  freezeAt0(chessB);

  chessA.customUpdate = (n, delta) => {
    if (state.active !== 'A') return;
    if (!state.waiting && n.animDone) { n.frameIndex = 0; state.waiting = true; state.waitMs = 0; }
    if (state.waiting) {
      state.waitMs += delta;
      if (state.waitMs >= WAIT_MS) {
        state.waiting = false; state.active = 'B';
        startPlay(chessB); freezeAt0(chessA);
      }
    }
  };
  chessB.customUpdate = (n, delta) => {
    if (state.active !== 'B') return;
    if (!state.waiting && n.animDone) { n.frameIndex = 0; state.waiting = true; state.waitMs = 0; }
    if (state.waiting) {
      state.waitMs += delta;
      if (state.waitMs >= WAIT_MS) {
        state.waiting = false; state.active = 'A';
        startPlay(chessA); freezeAt0(chessB);
      }
    }
  };
}
