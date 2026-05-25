/**
 * DogWalker — 遛狗者 + 狗（绳索绑带系统）
 */

import { SIDEWALK_NEAR_Y } from '../SceneConfig.js';
import { makeNPC } from './util.js';

export function spawnDogWalker(em, sr, bm) {
  const ownerY = SIDEWALK_NEAR_Y;

  const owner = makeNPC(em, sr, {
    x: 760, y: ownerY, animation: 'walk', direction: 1, speed: 26, vy: 0,
    minX: 600, maxX: 950,
    minY: ownerY - 2, maxY: ownerY + 2,
    color: 0x1a1a10, tags: ['pedestrian', 'dog-owner'],
  });

  const dog = makeNPC(em, sr, {
    x: 808, y: ownerY, animation: 'dogwalk', direction: 1, speed: 0, vy: 0,
    leashTarget: owner, leashOffset: { x: 46, y: 6 },
    color: 0x7a5530, tags: ['dog', 'animal'],
  });
  dog.frameIndex = 0;

  // 绳索：主人前手锚点 → 狗颈锚点（用锚点系统，随动画自然摆动）
  owner.drawExtra = (g, o) => {
    if (!dog.alive) return;
    // 取主人更靠前（朝向狗）的手
    const hl = o.getAnchor('hand_l');
    const hr = o.getAnchor('hand_r');
    const hand = (hr.x * o.direction >= hl.x * o.direction) ? hr : hl;
    const neck = dog.getAnchor('neck');
    g.lineStyle(Math.max(0.8, 1.2 * o.scale), 0x6a6a6a, 0.85);
    g.lineBetween(hand.x, hand.y, neck.x, neck.y);
  };

  // 纳入行为系统：owner 注册 dog_owner，dog 作为绑带从属交给 DogWalkActivity
  bm.register(owner, 'dog_owner');
  bm.socialLayer.createActivity('dog_walk',
    [{ npc: owner, role: 'owner' }, { npc: dog, role: 'dog' }]);
}
