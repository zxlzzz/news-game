/**
 * vehicle — 车辆行为模块
 *
 * 独占写入权：currentSpeed、vsmState、_busStopTarget、_busStopDone 等行驶状态
 *   由 VehicleStateMachine 负责写入；doorOpen 由 BusStop 负责写入。
 * 本模块提供各车型内禀尺寸常量和查询函数，供 VehicleEntity 和 drawVehicle 使用。
 */

/** 各车型内禀尺寸（未缩放，世界单位）：L=车长，H=车高，r=轮半径 */
export const INTRINSIC = {
  bus:  { L: 1010, H: 213, r: 38 },
  moto: { L: 187,  H: 84,  r: 26 },
  car:  { L: 380,  H: 127, r: 26 },
  taxi: { L: 380,  H: 127, r: 26 },
};

/** 返回指定车型的内禀尺寸；未知车型退回 car */
export function dims(kind) {
  return INTRINSIC[kind] ?? INTRINSIC.car;
}
