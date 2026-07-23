/**
 * AttachmentDefs — 可持握道具声明表（纯数据，无 import）
 *
 * key      = item id（ChainTask 和 NpcPropManager 共同使用）
 * anchor   = getAnchor() 锚点名
 * heldPose = manifest clip id；null = 无姿势叠加（后续有 clip 后改为 clip id）
 * propType = NpcPropManager _getOrCreate 的 type key
 * acquire  = 道具获取来源
 * dispose  = 道具销毁方式：'destroy' | 'return'
 * draw     = SimpleProp 绘制描述符（复杂道具用专用 NpcProp 子类时可省略）
 *
 * draw.shape 支持：'rect' | 'circle' | 'line'
 *   rect  : w, h, offsetX, offsetY, color, alpha
 *   circle: r, offsetX, offsetY, color, alpha
 *   line  : length, angle（0=正下，正=朝 NPC 前方）, lineWidth, color, alpha
 */

export const ATTACHMENT_DEFS = {

  snack: {
    anchor:   'hand_r',
    heldPose: null,
    propType: 'snack',
    acquire:  { from: 'spawn' },
    dispose:  'destroy',
    draw: {
      shape:   'rect',
      w:       8,
      h:       6,
      color:   0xc4a882,
      alpha:   0.85,
      offsetX: 6,
      offsetY: -3,
    },
  },

  broom: {
    anchor:   'hand_r',
    heldPose: null,
    propType: 'broom',
    acquire:  { from: 'spawn' },
    dispose:  'destroy',
    draw: {
      shape:     'line',
      length:    50,
      angle:     15,
      color:     0x8b7355,
      alpha:     0.9,
      lineWidth: 2,
    },
  },

};
