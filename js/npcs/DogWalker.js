/**
 * DogWalker — 遛狗者 + 狗（绳索绑带系统）
 */

import { SIDEWALK_NEAR_Y } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnDogWalker(em, sr) {
  const ownerY = SIDEWALK_NEAR_Y;

  const owner = makeNPC(em, sr, {
    x: 760, y: ownerY, animation: 'walk', direction: 1, speed: 26, vy: 0,
    minX: 600, maxX: 950,
    minY: ownerY - 2, maxY: ownerY + 2,
    color: 0x1a1a10, tags: ['pedestrian', 'dog-owner'],
  });

  const dog = makeNPC(em, sr, {
    x: 810, y: ownerY, animation: 'dogwalk', direction: 1, speed: 0, vy: 0,
    leashTarget: owner, leashOffset: { x: 48, y: 0 },
    color: 0x7a5530, tags: ['dog', 'animal'],
  });
  dog.frameIndex = 0;

  // 绳索：主人手腕 → 狗颈
  owner.drawExtra = (g, o) => {
    if (!dog.alive) return;
    g.lineStyle(1.5, 0x9a8060, 0.85);
    g.lineBetween(
      o.x   + 38 * o.scale   * o.direction,   o.y   - 38 * o.scale,
      dog.x + 30 * dog.scale * dog.direction,  dog.y - 18 * dog.scale,
    );
  };
}
