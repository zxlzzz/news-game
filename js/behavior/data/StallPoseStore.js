/**
 * StallPoseStore — StallActivity 与 StallSellerTask 共享的 stall_gestures 存取点
 *
 * 单独拆出（而非留在 StallActivity.js 内部 export）是为了避免循环 import：
 * StallActivity.js 需要 import StallSellerTask（onSlotArrival 交接 / destroy 收摊
 * 时把卖家交回去），StallSellerTask.js 也需要读 stall_gestures 播闲时叫卖手势——
 * 两边互相 import 会成环，故 poseCache 存取单独收口到本文件，两边都只单向依赖它。
 */
let STALL_GESTURES = {};

export function initStallGestures(gestures) {
  STALL_GESTURES = gestures || {};
}

export function getStallGestures() {
  return STALL_GESTURES;
}
