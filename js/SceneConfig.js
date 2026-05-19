/**
 * SceneConfig — 场景全局常量
 * 所有需要感知世界坐标的模块都从这里导入，避免分散的魔法数字。
 */

export const WORLD_WIDTH     = 2000;
export const WORLD_HEIGHT    = 500;

export const FAR_Y           = 252;   // 道路远端（NPC最小Y）
export const NEAR_Y          = 458;   // 道路近端（NPC最大Y）
export const BUILDING_BASE_Y = 130;   // 建筑临街底边Y

/** 远端人行道上 NPC 的典型 Y 坐标 */
export const SIDEWALK_FAR_Y  = 208;

/**
 * 按道路纵深分数换算世界 Y
 * @param {number} f  0 = 道路远端, 1 = 道路近端
 */
export const roadY = (f) => Math.round(FAR_Y + (NEAR_Y - FAR_Y) * f);
