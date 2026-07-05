#!/usr/bin/env node
/**
 * add-fields.mjs — 给每个 clip JSON 补充 schema 新字段
 *
 * 在 "loop" 之后插入:
 *   blend_mode, interrupt, from, to, weight, ref_speed, events
 *
 * 幂等: 已含 blend_mode 的文件跳过
 * 执行: node sth/tools/add-fields.mjs
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR  = path.resolve(__dirname, '../../assets/animations');

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 推断规则
// ─────────────────────────────────────────────────────────────────────────────

/** from/to 映射（loop=false base clips） */
const FROM_TO = new Map([
  ['fall',          { from: 'walk',       to: 'lie_ground' }],
  ['get_up',        { from: 'lie_ground', to: 'walk'       }],
  ['squat_down',    { from: 'stand',      to: 'squat'      }],
  ['stand_up',      { from: 'squat',      to: 'stand'      }],
  ['open_door',     { from: 'stand',      to: 'stand'      }],
  ['down_on_knee',  { from: 'walk',       to: 'sit_ground' }],
]);

/** ref_speed 映射（步行 26 / 慢跑 36 / 跑步 52） */
const REF_SPEED_MAP = new Map([
  ['walk',       26],
  ['walk_older', 26],
  ['jog',        36],
  ['run',        52],
  ['bike',       26],
  ['mobike',     26],
  ['dog_walk',   26],
]);

function inferBlendMode({ type }) {
  if (type === 'trait')   return 'additive';
  if (type === 'gesture') return 'override';
  return 'replace'; // base, variant, held, sub_event, pet
}

function inferInterrupt({ type, loop }) {
  if (loop === false && type === 'base') return 'committed';
  if (type === 'gesture') return 'blend';
  if (type === 'held')    return 'cut';
  return 'blend';
}

function inferFromTo({ type, loop, id }) {
  if (loop === false && type === 'base') {
    // strip facing suffix (_front / _side) to get canonical stem
    const stem = id.replace(/_(?:front|side)$/, '');
    const ft = FROM_TO.get(stem);
    if (ft) return ft;
  }
  return { from: null, to: null };
}

function inferRefSpeed({ id }) {
  const stem = id.replace(/_(?:front|side)$/, '');
  return REF_SPEED_MAP.get(stem) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 核心：在 "loop" 键之后插入新字段，保留其余字段原始顺序
// ─────────────────────────────────────────────────────────────────────────────

function addFields(clip) {
  const blend_mode = inferBlendMode(clip);
  const interrupt  = inferInterrupt(clip);
  const { from, to } = inferFromTo(clip);
  const weight     = 1;
  const ref_speed  = inferRefSpeed(clip);
  const events     = [];

  const out = {};
  for (const [k, v] of Object.entries(clip)) {
    out[k] = v;
    if (k === 'loop') {
      out.blend_mode = blend_mode;
      out.interrupt  = interrupt;
      out.from       = from;
      out.to         = to;
      out.weight     = weight;
      out.ref_speed  = ref_speed;
      out.events     = events;
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行
// ─────────────────────────────────────────────────────────────────────────────

const files = walkDir(ANIM_DIR);
let updated = 0, skipped = 0, errors = 0;

for (const abs of files) {
  try {
    const clip = JSON.parse(fs.readFileSync(abs, 'utf8'));

    // 幂等：已有新字段则跳过
    if ('blend_mode' in clip) { skipped++; continue; }

    const out = addFields(clip);
    fs.writeFileSync(abs, JSON.stringify(out, null, 2) + '\n');
    updated++;
  } catch (e) {
    console.error(`ERROR ${path.relative(ANIM_DIR, abs)}: ${e.message}`);
    errors++;
  }
}

console.log(`Updated ${updated}, skipped ${skipped}, errors ${errors}.`);
if (errors) process.exit(1);
