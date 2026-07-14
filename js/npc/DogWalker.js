/**
 * DogWalker — 遛狗者 + 狗（绳索绑带系统）
 */

import { SIDEWALK_NEAR_Y } from '../core/Layout.js';
// ⚠️ SIDEWALK_NEAR_Y = 508，实为公园深处，非近侧人行道；owner y 仅取其数值做生成点，modeWander 在 minY/maxY 约束内漫游。
import { makeNPC } from './npcUtil.js';
import { setWalkMode } from '../behavior/Motor.js';
import { modeWander } from '../behavior/WalkMode.js';

export function spawnDogWalker(em, sr, bm, propManager) {
  const ownerY = SIDEWALK_NEAR_Y;

  const owner = makeNPC(em, sr, {
    x: 700, y: ownerY, animation: 'walk', direction: 1, speed: 26, vy: 0,
    minX: 600, maxX: 755,
    minY: ownerY - 8, maxY: ownerY + 8,
    color: 0x1a1a10, tags: ['pedestrian', 'dog-owner'],
    traits: ['walk_dog'],
  });
  const dog = makeNPC(em, sr, {
    x: 808, y: ownerY, animation: 'dog_walk', direction: 1, speed: 0, vy: 0,
    leashTarget: owner, leashOffset: { x: 46, y: 6 },
    color: 0x7a5530, tags: ['dog', 'animal'],
  });
  dog.frameIndex = 0;

  if (propManager) {
    propManager.registerLeash(owner, dog);
  } else {
    owner.drawExtra = (g, o) => {
      if (!dog.alive) return;
      const hand = o.getAnchor('hand_l');
      const neck = dog.getAnchor('neck');
      g.lineStyle(Math.max(0.8, 1.2 * o.scale), 0x6a6a6a, 0.85);
      g.moveTo(hand.x, hand.y); g.lineTo(neck.x, neck.y);
    };
  }

  // 纳入行为系统：owner 注册 dog_owner
  bm.register(owner, 'dog_owner');
  setWalkMode(owner, modeWander());
}
