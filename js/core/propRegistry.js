/**
 * propRegistry — propType → 能力表（Z-2d）
 *
 * CONTRACT
 *   OWNS:      propType 到绘制 / footprint / 包围盒 / 障碍性 的映射表。
 *   WRITES:    _REG（仅经 registerProp，各 prop 模块顶层自注册时）。
 *   READS:     nothing —— 本模块 **零 import**，故永远不会参与循环依赖。
 *   MUST NOT:  import 任何 entity / draw / behavior 模块（注册是推送而非拉取）；
 *              在注册后被修改（表在场景运行期只读）。
 *
 * 取代 PropEntity 里的四处 `switch (this.propType)` + `OBSTACLE_TYPES` 集合
 * + `VISUAL_INTRINSIC` 表。每个 prop 类型在自己的模块顶层声明能力：
 *
 *   registerProp('bench', { draw: drawBench, footprint, obstacle: true });
 *
 * 注册在 `js/entity/props.all.js`（副作用 barrel）被导入时统一发生；
 * PropEntity 只 import 本模块 + 那一个 barrel，不再逐个 import draw 文件。
 */

/**
 * @typedef {object} PropDef
 * @property {(g:object, e:object)=>void} [draw]       主通道绘制（Y 排序后）
 * @property {(g:object, e:object)=>void} [drawGround] 地面预通道绘制（Y 排序前，贴地元素）
 * @property {(e:object)=>object}         [footprint]  → {shape, rx, ry, blocks, sortDY}
 * @property {boolean}                    [obstacle]   是否烘入 NavGrid 为 BLOCKED
 * @property {{hw:number,up:number,down:number}} [visual]  取景包围盒 intrinsic（×scale）
 * @property {(e:object, s:number)=>object}      [bounds]  完全自定义包围盒（优先于 visual）
 * @property {string[]}                   [config]     需从 config 抄到实例的额外字段名
 */

/** @type {Map<string, PropDef>} */
const _REG = new Map();

/**
 * 注册一个 prop 类型的能力。重复注册同名类型直接抛错——
 * 静默覆盖会让"哪个模块赢"取决于 barrel 里的 import 顺序，那是不可维护的。
 */
export function registerProp(type, def) {
  if (typeof type !== 'string' || !type) throw new Error('registerProp: type 必须是非空字符串');
  if (_REG.has(type)) throw new Error(`registerProp: propType '${type}' 重复注册`);
  if (!def || typeof def !== 'object') throw new Error(`registerProp('${type}'): def 必须是对象`);
  if (def.obstacle && !def.footprint)
    throw new Error(`registerProp('${type}'): obstacle 类型必须声明 footprint`);
  _REG.set(type, def);
}

/** 取能力表；未注册类型返回 undefined（绘制无声跳过，与 Z-2d 前 switch 的 default 一致） */
export const getPropDef = (type) => _REG.get(type);

/** 是否障碍类型（烘入 NavGrid） */
export const isObstacleType = (type) => _REG.get(type)?.obstacle === true;

/** 已注册类型名（静态检查 / 调试用） */
export const propTypes = () => [..._REG.keys()];
