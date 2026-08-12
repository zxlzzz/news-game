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

/**
 * 车辆进深（O-5，骨架单位；括号内为按 UNITS_PER_METER=84.7 折算的现实尺寸）。
 * 同道具的 `PROP_DEPTH`——进深是转投影后才引入的新维度，扁平时代没有这个量，
 * 取现实车宽的常识值，不是从旧数字推出来的。车辆不走 `PROP_DEPTH`（那张表按
 * propType 索引，车不是 prop），所以单列一张。
 */
export const VEHICLE_DEPTH = {
  bus:  212, // 2.5m
  car:  153, // 1.8m
  taxi: 153, // 1.8m
  moto:  59, // 0.7m
};

/**
 * 车身体块取车高的百分之多少（O-5）。见 drawVehicle.js `_bodyBox` 的注释：
 * 轿车车顶是弧的，体块取满高会在车头车尾上方露出方角，所以只取到腰线；
 * 公交车侧面本来就近似矩形（BUS_SHAPE），可以取满。
 * 摩托太窄，给体块反而是一坨——没有条目 = 不画体块，只保留侧面剪影。
 */
export const VEHICLE_BOX_H_FRAC = {
  bus:  1.0,
  car:  0.55,
  taxi: 0.55,
};
