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
 *
 * 运行：node scripts/check-behavior-data.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname }  from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 加载数据 ─────────────────────────────────────────────────────────────────

const { BEHAVIOR_SCRIPTS } = await import('../js/behavior/data/BehaviorScripts.js');
const { ATTACHMENT_DEFS }  = await import('../js/behavior/data/AttachmentDefs.js');
const { AffordanceDefaults } = await import('../js/core/AffordanceDefaults.js');

const manifest = JSON.parse(readFileSync(join(ROOT, 'assets', 'manifest.json'), 'utf8'));
const CLIP_IDS = new Set(Object.keys(manifest.clips ?? {}));

// ── 已知常量 ─────────────────────────────────────────────────────────────────

const USE_WHITELIST = new Set(['bench']);

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

if (errors === 0) {
  console.log('\x1b[32mAll behavior-data checks pass.\x1b[0m');
} else {
  console.error(`\x1b[31m${errors} check(s) failed.\x1b[0m`);
  process.exit(1);
}
