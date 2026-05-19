/**
 * Chess — 象棋对弈组（2位棋手 + 旁观者）
 *
 * 动画逻辑：
 *   - 两位棋手轮流播放完整的起身/落座动画（playOnce）
 *   - 非活跃方冻结在第0帧（坐姿）
 *   - 一方播完后等待 WAIT_MS 毫秒再让另一方开始
 */

import { SIDEWALK_FAR_Y } from '../SceneConfig.js';
import { makeNPC }        from './util.js';

const WAIT_MS = 3500;

function startPlay(npc) {
  npc.playOnce   = true;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
}

function freezeAt0(npc) {
  npc.animDone   = true;   // 阻止 NPC.update() 推进帧
  npc.frameIndex = 0;      // 显示坐姿首帧
}

export function spawnChess(em, sr) {
  const Y     = SIDEWALK_FAR_Y;
  const state = { active: 'A', waiting: false, waitMs: 0 };

  const chessA = makeNPC(em, sr, {
    x: 610, y: Y, animation: 'chess', direction:  1,
    speed: 0, vy: 0, minY: Y - 2, maxY: Y + 2,
    color: 0x1a1018, tags: ['player', 'chess', 'bystander'],
    playOnce: true,
  });

  const chessB = makeNPC(em, sr, {
    x: 658, y: Y, animation: 'chess', direction: -1,
    speed: 0, vy: 0, minY: Y - 2, maxY: Y + 2,
    color: 0x181a10, tags: ['player', 'chess', 'bystander'],
    playOnce: true,
  });

  // 旁观者静止站立
  makeNPC(em, sr, {
    x: 576, y: Y + 10, animation: 'idle', direction: 1,
    speed: 0, vy: 0, minY: Y + 8, maxY: Y + 12,
    color: 0x20182a, tags: ['bystander'],
  });

  // 初始：A 开始播放，B 冻结在坐姿
  startPlay(chessA);
  freezeAt0(chessB);

  chessA.customUpdate = (n, delta) => {
    if (state.active !== 'A') return;

    if (!state.waiting && n.animDone) {
      // A 刚播完：回到坐姿，开始等待
      n.frameIndex  = 0;
      state.waiting = true;
      state.waitMs  = 0;
    }
    if (state.waiting) {
      state.waitMs += delta;
      if (state.waitMs >= WAIT_MS) {
        // 等待结束：交给 B
        state.waiting = false;
        state.active  = 'B';
        startPlay(chessB);
        freezeAt0(chessA);
      }
    }
  };

  chessB.customUpdate = (n, delta) => {
    if (state.active !== 'B') return;

    if (!state.waiting && n.animDone) {
      n.frameIndex  = 0;
      state.waiting = true;
      state.waitMs  = 0;
    }
    if (state.waiting) {
      state.waitMs += delta;
      if (state.waitMs >= WAIT_MS) {
        state.waiting = false;
        state.active  = 'A';
        startPlay(chessA);
        freezeAt0(chessB);
      }
    }
  };
}
