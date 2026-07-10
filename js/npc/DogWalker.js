/**
 * DogWalker — 遛狗者 + 狗（绳索绑带系统）
 */

import { SIDEWALK_NEAR_Y } from '../core/Layout.js';
import { makeNPC } from './npcUtil.js';
import { getTraitProps, resolveTraitVariant } from '../behavior/ModifierLayer.js';

export function spawnDogWalker(em, sr, bm, propManager) {
  const ownerY = SIDEWALK_NEAR_Y;

  const owner = makeNPC(em, sr, {
    x: 760, y: ownerY, animation: 'walk', direction: 1, speed: 26, vy: 0,
    minX: 600, maxX: 755,
    minY: ownerY - 8, maxY: ownerY + 8,
    color: 0x1a1a10, tags: ['pedestrian', 'dog-owner'],
    traits: ['walk_dog'],
  });
  // walk_dog trait modifier must be pushed manually (owner._activity skips tickModifiers step 3)
  const tp = getTraitProps().walk_dog;
  const variant = resolveTraitVariant(tp, true);  // true = side view (walking)
  const wdJoints = { ...(variant?.joints ?? {}) };
  owner.modifiers.push({ id: 'walk_dog', kind: 'trait', priority: 5, joints: wdJoints, timer: -1 });

  const dog = makeNPC(em, sr, {
    x: 808, y: ownerY, animation: 'dogwalk', direction: 1, speed: 0, vy: 0,
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

  // 纳入行为系统：owner 注册 dog_owner，dog 作为绑带从属交给 DogWalkActivity
  bm.register(owner, 'dog_owner');
  bm.socialLayer.createActivity('dog_walk',
    [{ npc: owner, role: 'owner' }, { npc: dog, role: 'dog' }]);
}
