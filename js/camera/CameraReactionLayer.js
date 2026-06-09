/**
 * CameraReactionLayer — 镜头反应层（占位）
 *
 * 后续：根据社会稳定度 stability 对取景框内的 NPC 施加行为修改
 * （看到镜头走开/围观/摆拍等）。本次仅留空接口。
 */

export class CameraReactionLayer {
  update(npcs, viewfinder, stability, dt) {
    // TODO: 根据 stability 值对框内 NPC 施加行为修改
  }
}
