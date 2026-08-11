/**
 * featureRegistry — feature type → init 函数（Z-2e）
 *
 * CONTRACT
 *   OWNS:      场景「内容特性」类型到初始化函数的映射表（chess / dog_walker /
 *              vehicles / ... —— 可选、可增删、场景与场景之间不同的东西）。
 *   WRITES:    _REG（仅经 registerFeature，`sceneFeatures.js` 顶层注册时）。
 *   READS:     nothing —— 本模块 **零 import**，与 propRegistry.js 同款隔离。
 *   MUST NOT:  import 任何 npc / entity / behavior 模块（注册是推送而非拉取）。
 *
 * 与 propRegistry.js 的差异（为什么不是同一套机制）：
 *   prop 类型是一族同构的东西（每个都有 draw/footprint/obstacle），天然适合
 *   "每个类型自己的模块顶层注册"。这里的 9 个 feature（pedestrians/park_idlers/
 *   chess/stall_sellers/dog_walker/athletes/vehicles/bus_stops/ambient_affordance）
 *   是异构的一次性场景填充调用，签名各不相同、散落在 npc/ 和 entity/vehicle/ 各处，
 *   且每个都只被调用一次。把注册塞进它们各自的模块会强迫改动 5+ 个既有文件、
 *   徒增循环依赖风险，换来的统一性没有实际收益。故改为单一 `sceneFeatures.js`
 *   在一处把既有 spawn 函数包成 `(ctx, cfg) => void` 契约再注册——本模块不关心
 *   是谁在注册，只提供表。
 *
 * SceneInitializer 是 infra 的引导代码（NavGrid/BehaviorManager/ExitRegistry/
 * Director），本身不进 registry：每个场景都必须有寻路和行为管理器，那不是
 * "可选内容"。features 是数组，声明顺序 = 初始化顺序（同 Z-2b/c 的有序数组
 * 惯例）；多数 feature 互不依赖，但共享一个全局 Math.random() 流，故调换顺序
 * 会改变具体生成结果（位置/数量），即使每个 feature 逻辑上互相独立。
 */

/** @typedef {(ctx: object, cfg: object) => void} FeatureInit */

/** @type {Map<string, FeatureInit>} */
const _REG = new Map();

/**
 * 注册一个 feature 类型的初始化函数。重复注册同名类型直接抛错——
 * 理由同 propRegistry：静默覆盖会让"谁赢"取决于 import 顺序。
 */
export function registerFeature(type, initFn) {
  if (typeof type !== 'string' || !type) throw new Error('registerFeature: type 必须是非空字符串');
  if (typeof initFn !== 'function') throw new Error(`registerFeature('${type}'): initFn 必须是函数`);
  if (_REG.has(type)) throw new Error(`registerFeature: feature type '${type}' 重复注册`);
  _REG.set(type, initFn);
}

/** 取 init 函数；未注册类型返回 undefined（由调用方决定是报错还是跳过） */
export const getFeatureInit = (type) => _REG.get(type);

/** 已注册类型名（静态检查 / 调试用） */
export const featureTypes = () => [..._REG.keys()];
