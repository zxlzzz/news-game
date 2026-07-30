/**
 * props.all — prop 类型注册 barrel（Z-2d）
 *
 * 唯一职责：import 所有声明了 propType 的模块，触发它们顶层的 `registerProp(...)`。
 * 除此之外不导出任何东西。
 *
 * 为什么需要它：PropEntity 不再逐个 import draw 文件（Z-2d 目标），但注册是**推送**，
 * 得有人把这些模块拉进图里。PropEntity import 本文件一行即可。
 *
 * ⚠️ 加新 prop 类型时：在自己模块顶层 `registerProp()`，并把该模块加进下面的列表。
 * 漏加的后果是"该类型静默不绘制"——`check-invariants.mjs` Rule 13 静态挡这个。
 *
 * ⚠️ 不要在此 import `busstop/busstop.js`：它 import PropEntity，会与
 * PropEntity → props.all 成环。busstop 三种 prop 注册在各自 draw 文件里。
 */

import './seat/seat.js';                 // bench / chair-l / chair-r / busstop-bench
import './trash/trash.js';
import './sign/sign.js';
import './newsrack/newsrack.js';
import './hydrant/hydrant.js';
import './mailbox/mailbox.js';
import './planter/planter.js';
import './vending/vending.js';
import './phonebooth/phonebooth.js';
import './tree/tree.js';
import './chess-table/chessTable.js';
import './fountain/fountain.js';         // fountain（含地面预通道水池）
import './stall/stall.js';
import './lamp/drawLamp.js';             // 以下为纯绘制类型，注册在 draw 文件内
import './manhole/drawManhole.js';
import './drain/drawDrain.js';
import './busstop/drawBusStopRoof.js';
import './busstop/drawBusStopSign.js';
