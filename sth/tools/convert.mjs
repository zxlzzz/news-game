#!/usr/bin/env node
/**
 * convert.mjs — 把 assets/animations/ 所有存量 JSON 转为统一 schema
 *
 * 转换规则:
 *   base/variant  : 每帧关节坐标减去当前帧 body 坐标 → body-relative delta（body 自身 = [0,0]，省略）
 *   sub_event     : aDelta/bDelta 双人格式保持原样，只包元数据壳
 *   held/trait/loiter(joints 格式) : 原始 joints 值视为已是 delta，包成单帧 keyframe
 *   gesture       : 已含 keyframes，只补充元数据
 *   pet(dog)      : 坐标不做 body 减法，保留原始值
 *
 * 路径规范化:
 *   "held pose/" → "held/"
 *   文件名空格 → snake_case
 *
 * 执行: node sth/tools/convert.mjs
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANIM_DIR  = path.resolve(__dirname, '../../assets/animations');

// ─────────────────────────────────────────────────────────────────────────────
// 工具
// ─────────────────────────────────────────────────────────────────────────────

const snake = s => s.replace(/\s+/g, '_');

function walkDir(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, out);
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 元数据推断
// ─────────────────────────────────────────────────────────────────────────────

function inferType(parts) {
  const top = parts[0];
  if (top === 'base')      return 'base';
  if (top === 'variant')   return 'variant';
  if (top === 'sub_event') return 'sub_event';
  if (top === 'held pose' || top === 'held') return 'held';
  if (top === 'gesture')   return 'gesture';
  if (top === 'trait')     return 'trait';
  if (top === 'pet')       return 'pet';
  return 'base';
}

function inferFacing(parts) {
  if (parts.includes('front')) return 'front';
  if (parts.includes('side'))  return 'side';
  return null;
}

// 已知过渡动画（loop=false）
const ONE_SHOT = new Set([
  'fall', 'fall_older',
  'get_up',
  'squat_down', 'stand_up',
  'open_door',
  'down_on_knee',
  'lie_ground_older',
  'dog_pet', 'human_pet_dog_side',
  'give_get', 'tidy', 'call', 'give', 'point',
]);

function inferLoop(type, stem, src) {
  if ('loop' in src) return Boolean(src.loop);
  if (type === 'sub_event') return false;
  if (type === 'gesture')   return false;
  if (type === 'held' || type === 'trait') return true;
  if (ONE_SHOT.has(stem))   return false;
  return true;
}

// 从 variant 文件名推断 base clip id
const KNOWN_BASES = new Set([
  'walk','run','jog','idle','stand','sit_bench','sit_ground',
  'lie_bench','lie_ground','fall','get_up','squat','squat_down',
  'stand_up','lean_wall','down_on_knee','bike','mobike','mobile','open_door',
]);
const STRIP_SUFFIXES = ['_older', '_onlookers'];

function inferVariantOf(type, stem) {
  if (type === 'trait') return null;
  if (type !== 'variant') return null;
  for (const sfx of STRIP_SUFFIXES) {
    if (stem.endsWith(sfx)) {
      const base = stem.slice(0, -sfx.length);
      return KNOWN_BASES.has(base) ? base : base; // best-effort
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 坐标转换
// ─────────────────────────────────────────────────────────────────────────────

/** 人形帧：减去当前帧 body 坐标，body 省略（始终 [0,0]） */
function humanFrameToKf(frame, dur) {
  const bx = frame.body?.[0] ?? 0;
  const by = frame.body?.[1] ?? 0;
  const kf = { dur };
  for (const [k, v] of Object.entries(frame)) {
    if (k === 'body') continue;              // body 省略
    if (k.startsWith('_bend')) continue;     // 丢弃 bend 元数据
    if (Array.isArray(v)) kf[k] = [v[0] - bx, v[1] - by];
  }
  return kf;
}

/** 狗骨骼帧：坐标不做 body 减法 */
function dogFrameToKf(frame, dur) {
  const kf = { dur };
  for (const [k, v] of Object.entries(frame)) {
    if (k.startsWith('_bend')) continue;
    if (Array.isArray(v)) kf[k] = v;
  }
  return kf;
}

// ─────────────────────────────────────────────────────────────────────────────
// 输出路径规范化
// ─────────────────────────────────────────────────────────────────────────────

function normalizeRelPath(rel) {
  const parts = rel.split(path.sep).map(snake);
  // "held_pose" → "held"（目录重命名）
  if (parts[0] === 'held_pose') parts[0] = 'held';
  return parts.join(path.sep);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主转换
// ─────────────────────────────────────────────────────────────────────────────

/** gesture clip 的中间目录名写入 tags */
function inferTags(type, parts) {
  if (type !== 'gesture') return [];
  return parts.slice(1, -1); // ['moving'] or ['static','stall','seller'] etc.
}

/**
 * id 规则:
 *   - side facing: 去掉 _side 后缀（side 是标准朝向）
 *   - front facing: 保留 _front 后缀
 *   - gesture/stall/…: 用 stall_<stem>（角色已在 tags，不在 id 里）
 *   - gesture 其他子目录: <stem>_<直接父目录>
 */
function buildId(type, stem, facing, parts) {
  // 基础 id：front 保留后缀，side 省略，无 facing 裸 stem
  const base = facing === 'front' ? `${stem}_front` : stem;

  if (type === 'gesture') {
    const intermediate = parts.slice(1, -1); // dirs between gesture/ and filename
    if (intermediate.includes('stall')) return `stall_${stem}`;
    if (intermediate.length > 0) return `${stem}_${intermediate[intermediate.length - 1]}`;
    return stem; // gesture 根下（wave.json 等）
  }

  return base;
}

function convertFile(abs) {
  const rel   = path.relative(ANIM_DIR, abs);
  const parts = rel.split(path.sep);
  const src   = JSON.parse(fs.readFileSync(abs, 'utf8'));

  const type       = inferType(parts);
  const facing     = inferFacing(parts);
  const stem       = snake(path.basename(abs, '.json'));
  const id         = buildId(type, stem, facing, parts);
  const variant_of = inferVariantOf(type, stem);

  // ── 幂等路径: 已是新 schema（含 keyframes + source）→ 只刷路径推断的元数据字段 ──
  // 坐标数据原样保留，loop/activeJoints 等其余字段原样保留
  if ('keyframes' in src && src.source != null) {
    const tags = inferTags(type, parts);
    return { ...src, id, type, facing: facing ?? null, variant_of, tags };
  }

  const loop = inferLoop(type, stem, src);

  // ── sub_event: 元数据壳 + 保留 aDelta/bDelta ──────────────────────────────
  if (src.aDelta != null || src.bDelta != null) {
    return {
      id, type: 'sub_event', facing: facing ?? null,
      variant_of: null, tags: [], loop: false,
      activeJoints: null, source: 'authored',
      ...(src.aDelta != null && { aDelta: src.aDelta }),
      ...(src.bDelta != null && { bDelta: src.bDelta }),
    };
  }

  const tags = inferTags(type, parts);

  // ── gesture: 已含 keyframes，只补元数据 ──────────────────────────────────
  if (src.type === 'gesture' || (src.keyframes && !src.frames)) {
    const activeJoints = src.activeJoints ?? null;
    const keyframes = (src.keyframes ?? []).map(kf => {
      const out = { dur: kf.dur ?? 0.15 };
      for (const [k, v] of Object.entries(kf)) {
        if (k !== 'dur') out[k] = v;
      }
      return out;
    });
    return {
      id, type: 'gesture', facing: facing ?? null,
      variant_of: null, tags, loop,
      activeJoints, source: 'authored',
      keyframes,
    };
  }

  // ── joints 格式（held pose / trait / loiter）: 包成单帧 keyframe ─────────
  if (src.joints != null && !src.frames) {
    const joints = src.joints;
    const activeJoints = Object.keys(joints);
    const kf = { dur: 0.15, ...joints };
    return {
      id, type, facing: facing ?? null,
      variant_of, tags, loop,
      activeJoints, source: 'authored',
      keyframes: [kf],
    };
  }

  // ── 全帧动画（base / variant / pet）───────────────────────────────────────
  if (src.frames) {
    const isDog = src.skeleton === 'dog';
    const fps   = src.fps ?? 8;
    const dur   = parseFloat((1 / fps).toFixed(6));

    const keyframes = src.frames.map(frame =>
      isDog ? dogFrameToKf(frame, dur) : humanFrameToKf(frame, dur)
    );

    return {
      id, type, facing: facing ?? null,
      variant_of, tags, loop,
      activeJoints: null, source: 'authored',
      ...(isDog && { skeleton: 'dog' }),
      keyframes,
    };
  }

  // ── 兜底 ─────────────────────────────────────────────────────────────────
  return {
    id, type, facing: facing ?? null,
    variant_of, tags, loop,
    activeJoints: null, source: 'authored',
    keyframes: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行
// ─────────────────────────────────────────────────────────────────────────────

const files = walkDir(ANIM_DIR);
let converted = 0, renamed = 0, errors = 0;
const renamedDirs = new Set();

for (const abs of files) {
  try {
    const rel    = path.relative(ANIM_DIR, abs);
    const outRel = normalizeRelPath(rel);
    const outAbs = path.join(ANIM_DIR, outRel);

    const output = convertFile(abs);

    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(output, null, 2) + '\n');

    if (outAbs !== abs) {
      fs.unlinkSync(abs);
      renamedDirs.add(path.dirname(abs));
      renamed++;
      console.log(`  rename: ${rel} → ${outRel}`);
    }
    converted++;
  } catch (e) {
    const rel = path.relative(ANIM_DIR, abs);
    console.error(`ERROR ${rel}: ${e.message}`);
    errors++;
  }
}

// 清理空旧目录（如 "held pose/"）
for (const dir of renamedDirs) {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      console.log(`  rmdir: ${path.relative(ANIM_DIR, dir)}/`);
    }
  } catch { /* ignore */ }
}

console.log(`\nConverted ${converted} files, renamed/moved ${renamed}, errors ${errors}.`);
if (errors) process.exit(1);
