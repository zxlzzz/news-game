/**
 * PoseRegistry — 转发入口（实际数据存于 data/ 子目录）
 *
 * 外部代码通过本文件 import，路径不变。
 * anim-preview 工具保存时会将本文件覆盖为内联版本。
 *
 * 消费方：
 *   BaseStateMachine  — LOITER_POSES
 *   SocialLayer       — SUB_EVENT_POSES
 *   ModifierLayer     — HELD_POSES, TRAIT_PROPS
 *   anim-preview      — HELD_POSES, LOITER_POSES, SUB_EVENT_POSES, TRAIT_PROPS
 */

export { TRAIT_PROPS }     from './data/TraitProps.js';
export { HELD_POSES }      from './data/HeldPoses.js';
export { GESTURE_CLIPS }   from './data/GestureClips.js';
export { LOITER_POSES }    from './data/LoiterPoses.js';
export { SUB_EVENT_POSES } from './data/SubEventPoses.js';
