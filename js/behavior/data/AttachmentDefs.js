/**
 * AttachmentDefs — 可持握道具声明表（纯数据，无 import）
 *
 * key      = item id（ChainTask 和 NpcPropManager 共同使用）
 * anchor   = getAnchor() 锚点名
 * heldPose = manifest clip id；null = 无姿势叠加。⚠️ 声明性字段，当前无消费者
 *            （NpcPropManager 只读 propType/draw/anchor，不读 heldPose；
 *            ModifierLayer 的姿势叠加走 profile.heldPoses，是另一套机制）。
 *            填了 clip id 不代表运行时会真的叠加姿势，见 guitar 条目注释。
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

  // 全库第一个非 null heldPose（A-1）。'lift' clip 本身设计为可走路叠加
  // （见 assets/animations/new_assets/docx.md 的历史校对说明），但 heldPose
  // 这个字段目前没有消费者（NpcPropManager/ModifierLayer 都不读它，只读
  // propType/draw/anchor）——本条目只是把字段填上第一个真实值，不代表
  // heldPose 已经接线生效；play_guitar 脚本（BehaviorScripts.js）里"举吉他"
  // 的视觉效果实际来自 ChainTask pose 步骤直接播 'lift' 这个 STATE_DEFS
  // 状态（Motor.js 新增），跟 heldPose 字段是两条独立路径。
  guitar: {
    anchor:   'hand_r',
    heldPose: 'lift',
    propType: 'guitar',
    acquire:  { from: 'spawn' },
    dispose:  'destroy',
    draw: {
      shape:     'line',
      length:    32,
      angle:     -10,
      color:     0x6b4a2f,
      alpha:     0.9,
      lineWidth: 5,
    },
  },

};
