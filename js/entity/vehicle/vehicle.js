/**
 * vehicle — 车辆行为模块
 *
 * 独占写入权：currentSpeed、vsmState、_busStopTarget、_busStopDone 等行驶状态
 *   由 VehicleStateMachine 负责写入；doorOpen 由 BusStop 负责写入。
 * 本模块提供各车型内禀尺寸常量和查询函数，供 VehicleEntity 和 drawVehicle 使用。
 */

/**
 * 各车型内禀尺寸（未缩放，骨架单位）。**全是现实尺寸，没有画风系数**——
 * 投影该怎么压是 `Projection.js` 的事（进深方向乘 `SIN_TILT`，高度不乘），
 * 这里只负责如实报出这台车多长多宽多高，O-5b 起统一按这条办。
 * 括号内为按 `UNITS_PER_METER=84.7` 折算的现实尺寸。
 *
 *   L      车长      H      车高（顶）    r  轮半径
 *   W      车宽（= 进深，投影方向）
 *   beltH  腰线高度（车身与车窗的分界；引擎盖/后备箱盖那个平面的高度）
 *   cabinL 座舱长度（车窗那一段的长度，比车长短）
 *
 * `beltH`/`cabinL` 是 O-5b 新增的**真实尺寸**，取代原来那个
 * `VEHICLE_BOX_H_FRAC = 0.55` 的经验系数——车身分两段（下半截车体 +
 * 上半截座舱）本来就是真实结构，用真尺寸描述比拍一个比例更经得起推敲，
 * 也符合"以后按实际物体建模时直接用长宽高算"的方向。
 * 公交车整体近似一个长方体：`cabinL = L`、`beltH = 0`，即只有一个盒子。
 */
export const INTRINSIC = {
  bus: { // 11.9 × 2.5 × 2.5m —— 侧面近似一个长方体（BUS_SHAPE），只需一个盒子
    L: 1010, H: 213, r: 38, W: 212,
    beltH: 0, cabinL: 1010, cabinDX: 0, cabinH: 213,
  },
  moto: { // 2.2 × 1.0 × 0.7m —— 太窄，不给体块（cabinL: 0），只保留侧面剪影
    L: 187, H: 84, r: 26, W: 59,
    beltH: 0, cabinL: 0, cabinDX: 0, cabinH: 0,
  },
  car: { // 4.5 × 1.5 × 1.8m
    L: 380, H: 127, r: 26, W: 153,
    beltH: 46,    // 0.54m：机盖/行李箱盖那个平面。取这个高度是因为 CAR_SHAPE
                  // 在此高度以下仍是满车长（实测 h=46u 时剪影跨度 369/380u），
                  // 再往上车头车尾开始收，盒子就会戳出剪影。
    cabinL: 110,  // 1.30m：车顶那一段的长度（CAR_SHAPE 在 yf≈0.97 处跨度 99u）
    cabinDX: -8,  // -0.09m：座舱中心相对车心后移（车顶偏向车尾，实测中心 -4~-15u）
    cabinH: 77,   // 0.91m：座舱盒子的高度（腰线 46 → 车顶 123）
  },
  taxi: {
    L: 380, H: 127, r: 26, W: 153,
    beltH: 46, cabinL: 110, cabinDX: -8, cabinH: 77,
  },
};

/** 返回指定车型的内禀尺寸；未知车型退回 car */
export function dims(kind) {
  return INTRINSIC[kind] ?? INTRINSIC.car;
}

