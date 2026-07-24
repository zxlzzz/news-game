/**
 * buildingKinds — 建筑 kind → tags 映射表
 *
 * 单一数据源，同时被 BuildingEntity.js 和 sceneData.js 消费。
 * 每行第一个元素必须是 building.js#ARCH 中的有效键（BuildingEntity 用它定位原型）。
 */

export const KIND_TAGS = {
  resi:        ['resi', 'residential', 'building'],
  oldmix:      ['oldmix', 'residential', 'shop', 'building'],
  modern:      ['modern', 'commercial', 'building'],
  clinic:      ['clinic', 'building'],
  convenience: ['convenience', 'shop', 'building'],
  bookstore:   ['bookstore', 'shop', 'building'],
};
