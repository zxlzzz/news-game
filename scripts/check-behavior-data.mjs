/**
 * check-behavior-data.mjs — 链条行为脚本静态校验
 *
 * 检查项：
 *   1. attach/detach.item 存在于 ATTACHMENT_DEFS 且有 dispose 字段
 *   2. goto.aff 对应的 kind 存在于 AffordanceDefaults（或有同 kind 的 scene 实体）
 *   3. loop.from 是合法步序（0 <= from < steps.length，不指向自身）
 *   4. pose.clip 存在于 manifest.json
 *   5. use.task 在 USE_WHITELIST
 *   6. tier >= 1 脚本的 pose.clip 必须在 manifest（tier 0 宽松）
 *   7. profile.activities 里每个条目都能在代码里找到对应实现（tasks.md P-4）：
 *      BEHAVIOR_SCRIPTS 条目 / 静态扫描到的 registerActivity() 类型 /
 *      DIRECT_TASK_WHITELIST 里显式登记的直连 Task 例外——防止"声明了但没接线"
 *      的悬空条目（stall_buyer 曾经就是这样，见 tasks.md P-4）再次出现且不被发现。
 *
 * 运行：node scripts/check-behavior-data.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname }  from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 加载数据 ─────────────────────────────────────────────────────────────────

const { BEHAVIOR_SCRIPTS } = await import('../js/behavior/data/BehaviorScripts.js');
const { ATTACHMENT_DEFS }  = await import('../js/behavior/data/AttachmentDefs.js');
const { AffordanceDefaults } = await import('../js/core/AffordanceDefaults.js');
const { PROFILES }           = await import('../js/npc/NpcProfile.js');

const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8'));
const CLIP_IDS = new Set(Object.keys(manifest.clips ?? {}));

// ── 已知常量 ─────────────────────────────────────────────────────────────────

const USE_WHITELIST = new Set(['bench', 'stall_buyer']);

// AffordanceDefaults 中所有已声明 kind 的集合
const KNOWN_KINDS = new Set(Object.values(AffordanceDefaults).map(a => a.kind));

// ── 校验逻辑 ─────────────────────────────────────────────────────────────────

let errors = 0;

function fail(msg) {
  console.error(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`  \x1b[32mok\x1b[0m    ${msg}`);
}

console.log('check-behavior-data: validating BehaviorScripts\n');

for (const [scriptId, script] of Object.entries(BEHAVIOR_SCRIPTS)) {
  console.log(`Script: ${scriptId} (tier=${script.tier ?? 0})`);
  const steps = script.steps ?? [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const loc  = `${scriptId}.steps[${i}] op=${step.op}`;

    switch (step.op) {

      case 'attach':
      case 'detach': {
        const def = ATTACHMENT_DEFS[step.item];
        if (!def) {
          fail(`${loc}: item '${step.item}' not in ATTACHMENT_DEFS`);
        } else if (!def.dispose) {
          fail(`${loc}: ATTACHMENT_DEFS['${step.item}'] missing dispose field`);
        } else {
          ok(`${loc}: item='${step.item}' dispose='${def.dispose}'`);
        }
        break;
      }

      case 'goto': {
        if (!KNOWN_KINDS.has(step.aff)) {
          fail(`${loc}: aff='${step.aff}' not found as a kind in AffordanceDefaults`);
        } else {
          ok(`${loc}: aff='${step.aff}' found`);
        }
        break;
      }

      case 'pose': {
        if (!CLIP_IDS.has(step.clip)) {
          fail(`${loc}: clip='${step.clip}' not in manifest`);
        } else {
          ok(`${loc}: clip='${step.clip}' in manifest`);
        }
        if (!Array.isArray(step.dur) || step.dur.length !== 2) {
          fail(`${loc}: dur must be [min, max]`);
        }
        break;
      }

      case 'use': {
        if (!USE_WHITELIST.has(step.task)) {
          fail(`${loc}: task='${step.task}' not in USE_WHITELIST (${[...USE_WHITELIST].join(',')})`);
        } else {
          ok(`${loc}: task='${step.task}' in whitelist`);
        }
        break;
      }

      case 'loop': {
        const from = step.from;
        if (typeof from !== 'number' || from < 0 || from >= steps.length) {
          fail(`${loc}: from=${from} out of range [0, ${steps.length - 1}]`);
        } else if (from === i) {
          fail(`${loc}: loop points to itself (from=${from})`);
        } else {
          ok(`${loc}: from=${from} valid`);
        }
        break;
      }

      default:
        fail(`${loc}: unknown op '${step.op}'`);
    }
  }

  console.log('');
}

// ── Profile desires 校验 ──────────────────────────────────────────────────────

console.log('Profile desires (validating all ids are in BEHAVIOR_SCRIPTS)\n');

const SCRIPT_IDS = new Set(Object.keys(BEHAVIOR_SCRIPTS));

for (const [profileName, profile] of Object.entries(PROFILES)) {
  const desires = profile.desires;
  if (!desires || desires.length === 0) continue;
  console.log(`Profile: ${profileName}`);
  for (const id of desires) {
    if (!SCRIPT_IDS.has(id)) {
      fail(`profile '${profileName}' desires contains unknown script id '${id}'`);
    } else {
      ok(`desires '${id}' found in BEHAVIOR_SCRIPTS`);
    }
  }
  console.log('');
}

// ── Profile activities 校验（tasks.md P-4）───────────────────────────────────
//
// profile.activities 只是"声明可参与"，本身不驱动任何路由（唯一读取点是
// SocialLayer.js#_tryPairTalk 的 'talk' 门），所以此前从没有东西替它兜底校验
// 过内容——stall_buyer 声明了三个 profile 里、BehaviorScripts.js 却没有对应
// 条目、也没有任何代码把 NPC 送去 buyer 槽位，死了很久都没人发现。这条规则
// 就是补这个兜底。

console.log('Profile activities（tasks.md P-4：校验每个条目都有对应实现）\n');

// 静态扫描 js/behavior/activities/*.js 里的 registerActivity('x', ...) 调用，
// 取代运行时 import ActivityRegistry.js——后者会连带拉入 Motor.js/ClipPlayer.js
// 这类假设浏览器环境的模块，不适合放进 node 静态校验脚本。
const ACTIVITIES_DIR = join(ROOT, 'js', 'behavior', 'activities');
const REGISTERED_ACTIVITY_TYPES = new Set();
for (const file of readdirSync(ACTIVITIES_DIR)) {
  if (!file.endsWith('.js')) continue;
  const src = readFileSync(join(ACTIVITIES_DIR, file), 'utf8');
  for (const m of src.matchAll(/registerActivity\(\s*'([\w-]+)'/g)) {
    REGISTERED_ACTIVITY_TYPES.add(m[1]);
  }
}

// 既不是 BEHAVIOR_SCRIPTS 条目、也不经 ActivityRegistry 的实现——直接由代码
// 构造 Task（Agenda.js#_routePoi 的 affordance 路由、或 spawn 时直接
// new XxxTask(...)）。每条都必须写清楚实现锚点；新增条目前先确认代码里
// 真的有对应实现，不得为了让检查通过顺手把名字塞进来。
const DIRECT_TASK_WHITELIST = new Map([
  ['chess_onlooker', "Agenda.js#_routePoi 'chess_onlooker' 分支 → ChessOnlookerTask（经 AffordanceDefaults['chess-table']）"],
  ['stall_seller',   'sceneFeatures.js#stall_sellers → 直接 new StallSellerTask(...)（prop-as-host，不经 Agenda/Activity）'],
]);

for (const [profileName, profile] of Object.entries(PROFILES)) {
  const activities = profile.activities;
  if (!activities || activities.length === 0) continue;
  console.log(`Profile: ${profileName}`);
  for (const id of activities) {
    if (SCRIPT_IDS.has(id)) {
      ok(`activities '${id}' found in BEHAVIOR_SCRIPTS`);
    } else if (REGISTERED_ACTIVITY_TYPES.has(id)) {
      ok(`activities '${id}' found as a registered Activity type`);
    } else if (DIRECT_TASK_WHITELIST.has(id)) {
      ok(`activities '${id}' whitelisted: ${DIRECT_TASK_WHITELIST.get(id)}`);
    } else {
      fail(`profile '${profileName}' activities contains unimplemented id '${id}' ` +
        `(not in BEHAVIOR_SCRIPTS, not a registered Activity type, not in DIRECT_TASK_WHITELIST)`);
    }
  }
  console.log('');
}

if (errors === 0) {
  console.log('\x1b[32mAll behavior-data checks pass.\x1b[0m');
} else {
  console.error(`\x1b[31m${errors} check(s) failed.\x1b[0m`);
  process.exit(1);
}
