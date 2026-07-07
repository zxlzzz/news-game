#!/usr/bin/env node
/**
 * migrate.mjs — 从 git 45e8e7a 读取旧动画资产，按新 schema 全量重建 assets/animations/
 *
 * 执行: node sth/tools/migrate.mjs
 *
 * 新目录结构:
 *   cycle/{locomotion,stance,social,loiter}
 *   transition/{posture,interact}
 *   overlay/{arm,posture,duet}
 *   variant/
 */

import fs          from 'node:fs';
import path        from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.resolve(__dirname, '../..');
const ANIM_OUT   = path.resolve(ROOT, 'assets/animations');
const COMMIT     = '45e8e7a';

// ─── Editor-space canonical defaultPose (body = origin [0,0]) ─────────────────
// These match config.js _EDITOR_DATA.human.defaultPose
const DP_HUMAN = {
  body:    [0,   0],
  neck:    [0,   -70],
  head:    [0,   -100],
  l_elbow: [-24, -40],
  r_elbow: [24,  -40],
  l_hand:  [-32, -12],
  r_hand:  [32,  -12],
  l_knee:  [-10, 40],
  r_knee:  [10,  40],
  l_foot:  [-14, 82],
  r_foot:  [14,  82],
};

// dog: body_back = root (placed at [40,0] in editor, but we use the full map)
const DP_DOG = {
  body_back:  [40,   0],
  body_front: [-40,  0],
  neck:       [-75,  -10],
  head:       [-100, -20],
  tail:       [75,   -15],
  fl_upper:   [-50,  25],
  fl_lower:   [-52,  55],
  fr_upper:   [-30,  25],
  fr_lower:   [-28,  55],
  bl_upper:   [30,   25],
  bl_lower:   [32,   55],
  br_upper:   [50,   25],
  br_lower:   [48,   55],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gitShow(filePath) {
  const raw = execSync(`git show ${COMMIT}:"${filePath}"`, { cwd: ROOT }).toString('utf8');
  return JSON.parse(raw);
}

/** delta = absolute_editor_coord − defaultPose (editor-space) */
function toDelta(joint, coords, dp) {
  const base = dp[joint];
  if (!base) return coords;  // unknown joint: pass through
  return [coords[0] - base[0], coords[1] - base[1]];
}

/** Convert a frame object {joint: [x,y]} to {joint: [dx,dy]} */
function convertFrame(frame, dp) {
  const out = {};
  for (const [k, v] of Object.entries(frame)) {
    if (k === 'dur') { out.dur = v; continue; }
    if (!Array.isArray(v) || v.length !== 2) continue;
    out[k] = toDelta(k, v, dp);
  }
  return out;
}

/** Convert frames array, optionally injecting a default dur */
function convertFrames(frames, dp, defaultDur) {
  return frames.map(f => {
    const kf = convertFrame(f, dp);
    if (defaultDur != null && kf.dur == null) kf.dur = defaultDur;
    return kf;
  });
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(outPath, obj) {
  mkdir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2) + '\n');
  console.log('  wrote', path.relative(ROOT, outPath));
}

/** Build a clip object, omitting fields with their default values */
function clip(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    // omit defaults
    if (k === 'skeleton'  && v === 'human') continue;
    if (k === 'facing'    && v === 'side')  continue;
    if (k === 'latched'   && v === false)   continue;
    out[k] = v;
  }
  return out;
}

// ─── Conversion routines ──────────────────────────────────────────────────────

/** Old base-animation (has .frames, absolute editor coords) → new keyframes */
function convertBase(src, dp, defaultDur = 0.1) {
  return convertFrames(src.frames, dp, defaultDur);
}

/**
 * Old gesture animation (has .keyframes, .activeJoints, .loop)
 * keyframe values are absolute editor coords → delta
 */
function convertGestureKfs(keyframes, dp) {
  return keyframes.map(kf => {
    const out = {};
    for (const [k, v] of Object.entries(kf)) {
      if (k === 'dur') { out.dur = v; continue; }
      if (!Array.isArray(v) || v.length !== 2) continue;
      out[k] = toDelta(k, v, dp);
    }
    return out;
  });
}

/**
 * Old "joints" pose (held pose / loiter / trait) → single-keyframe overlay
 * Trait values are ADDITIVE deltas from defaultPose (so keep as-is).
 * Held-pose values are absolute editor coords → convert to delta.
 */
function convertJointsToOverlay(joints, dp, isTrait) {
  const kf = {};
  for (const [k, v] of Object.entries(joints)) {
    if (!Array.isArray(v) || v.length !== 2) continue;
    kf[k] = isTrait ? v : toDelta(k, v, dp);
  }
  return [kf];
}

/** Old aDelta/bDelta sub_event → duet keyframe */
function convertDuetKf(aDelta, bDelta) {
  const kf = { a: {}, b: {} };
  for (const [k, v] of Object.entries(aDelta ?? {})) kf.a[k] = v;
  for (const [k, v] of Object.entries(bDelta ?? {})) kf.b[k] = v;
  return [kf];
}

// ─── Main migration map ───────────────────────────────────────────────────────

function migrate() {
  // Wipe and recreate animation directory
  if (fs.existsSync(ANIM_OUT)) {
    fs.rmSync(ANIM_OUT, { recursive: true });
    console.log('Deleted old assets/animations/');
  }

  // ── cycle/locomotion ──────────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/base/side/walk.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/walk.json'), clip({
      id: 'walk', kind: 'cycle', facing: 'side',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/base/front/walk.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/walk_front.json'), clip({
      id: 'walk_front', kind: 'cycle', facing: 'front',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/jog.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/jog.json'), clip({
      id: 'jog', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.08),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/run.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/run.json'), clip({
      id: 'run', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.07),
    }));
  }
  {
    const src = gitShow('assets/animations/base/bike.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/bike.json'), clip({
      id: 'bike', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/base/mobike.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/mobike.json'), clip({
      id: 'mobike', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/pet/dog_walk.json');
    write(path.join(ANIM_OUT, 'cycle/locomotion/dog_walk.json'), clip({
      id: 'dog_walk', kind: 'cycle', skeleton: 'dog',
      keyframes: convertBase(src, DP_DOG, 0.1),
    }));
  }

  // ── cycle/stance ──────────────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/base/front/idle.json');
    write(path.join(ANIM_OUT, 'cycle/stance/idle_front.json'), clip({
      id: 'idle_front', kind: 'cycle', facing: 'front',
      keyframes: convertBase(src, DP_HUMAN, 0.2),
    }));
  }
  {
    const src = gitShow('assets/animations/base/front/stand.json');
    write(path.join(ANIM_OUT, 'cycle/stance/stand_front.json'), clip({
      id: 'stand_front', kind: 'cycle', facing: 'front',
      keyframes: convertBase(src, DP_HUMAN),
    }));
  }
  {
    const src = gitShow('assets/animations/base/front/squat.json');
    write(path.join(ANIM_OUT, 'cycle/stance/squat_front.json'), clip({
      id: 'squat_front', kind: 'cycle', facing: 'front',
      keyframes: convertBase(src, DP_HUMAN),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/sit_bench.json');
    write(path.join(ANIM_OUT, 'cycle/stance/sit_bench.json'), clip({
      id: 'sit_bench', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.15),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/sit_ground.json');
    write(path.join(ANIM_OUT, 'cycle/stance/sit_ground.json'), clip({
      id: 'sit_ground', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.15),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/lie_bench.json');
    write(path.join(ANIM_OUT, 'cycle/stance/lie_bench.json'), clip({
      id: 'lie_bench', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/lie_ground.json');
    write(path.join(ANIM_OUT, 'cycle/stance/lie_ground.json'), clip({
      id: 'lie_ground', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/lean_wall.json');
    write(path.join(ANIM_OUT, 'cycle/stance/lean_wall.json'), clip({
      id: 'lean_wall', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.15),
    }));
  }
  {
    const src = gitShow('assets/animations/pet/dog_idle.json');
    write(path.join(ANIM_OUT, 'cycle/stance/dog_idle.json'), clip({
      id: 'dog_idle', kind: 'cycle', skeleton: 'dog',
      keyframes: convertBase(src, DP_DOG, 0.2),
    }));
  }

  // ── cycle/social ──────────────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/variant/chess/chess.json');
    write(path.join(ANIM_OUT, 'cycle/social/chess.json'), clip({
      id: 'chess', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.15),
    }));
  }
  {
    const src = gitShow('assets/animations/variant/chess/chess_onlookers.json');
    write(path.join(ANIM_OUT, 'cycle/social/chess_onlookers.json'), clip({
      id: 'chess_onlookers', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.15),
    }));
  }

  // ── cycle/loiter ──────────────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/base/mobile.json');
    write(path.join(ANIM_OUT, 'cycle/loiter/mobile.json'), clip({
      id: 'mobile', kind: 'cycle',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }

  // ── transition/posture ────────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/base/front/squat down.json');
    write(path.join(ANIM_OUT, 'transition/posture/squat_down.json'), clip({
      id: 'squat_down', kind: 'transition', facing: 'front',
      from: 'stand_front', to: 'squat_front',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/base/front/stand up.json');
    write(path.join(ANIM_OUT, 'transition/posture/stand_up.json'), clip({
      id: 'stand_up', kind: 'transition', facing: 'front',
      from: 'squat_front', to: 'stand_front',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/fall.json');
    write(path.join(ANIM_OUT, 'transition/posture/fall.json'), clip({
      id: 'fall', kind: 'transition',
      from: 'walk', to: 'lie_ground',
      keyframes: convertBase(src, DP_HUMAN, 0.08),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/get_up.json');
    write(path.join(ANIM_OUT, 'transition/posture/get_up.json'), clip({
      id: 'get_up', kind: 'transition',
      from: 'lie_ground', to: 'walk',
      keyframes: convertBase(src, DP_HUMAN, 0.12),
    }));
  }
  {
    const src = gitShow('assets/animations/base/side/down_on_knee.json');
    write(path.join(ANIM_OUT, 'transition/posture/down_on_knee.json'), clip({
      id: 'down_on_knee', kind: 'transition',
      keyframes: convertBase(src, DP_HUMAN, 0.1),
    }));
  }

  // ── transition/interact ───────────────────────────────────────────────────

  {
    const src = gitShow('assets/animations/base/front/open_door.json');
    write(path.join(ANIM_OUT, 'transition/interact/open_door.json'), clip({
      id: 'open_door', kind: 'transition', facing: 'front',
      keyframes: convertBase(src, DP_HUMAN, 0.12),
    }));
  }
  {
    const src = gitShow('assets/animations/pet/dog_pet.json');
    write(path.join(ANIM_OUT, 'transition/interact/dog_pet.json'), clip({
      id: 'dog_pet', kind: 'transition', skeleton: 'dog',
      keyframes: convertBase(src, DP_DOG, 0.15),
    }));
  }

  // ── overlay/arm ───────────────────────────────────────────────────────────

  // Held poses (absolute editor coords → delta)
  const heldFiles = [
    ['cross_arm',        'held pose/cross_arm.json',       false],
    ['hands_in_pocket',  'held pose/hands_in_pocket.json', false],
    ['phone_call',       'held pose/phone_call.json',      true],
    ['phone_look',       'held pose/phone_look.json',      true],
    ['smoke',            'held pose/smoke.json',           true],
  ];
  for (const [id, src, latched] of heldFiles) {
    const data = gitShow(`assets/animations/${src}`);
    const joints = data.joints;
    const activeJoints = Object.keys(joints);
    write(path.join(ANIM_OUT, `overlay/arm/${id}.json`), clip({
      id, kind: 'overlay',
      activeJoints,
      latched: latched || undefined,
      keyframes: convertJointsToOverlay(joints, DP_HUMAN, false),
    }));
  }

  // Loiter poses (held joints)
  const loiterFiles = [
    ['loiter_bag_a', 'base/loiter/bag_a.json'],
    ['loiter_bag_b', 'base/loiter/bag_b.json'],
    ['loiter_phone', 'base/loiter/phone.json'],
  ];
  for (const [id, src] of loiterFiles) {
    const data = gitShow(`assets/animations/${src}`);
    const joints = data.joints;
    write(path.join(ANIM_OUT, `overlay/arm/${id}.json`), clip({
      id, kind: 'overlay',
      activeJoints: Object.keys(joints),
      keyframes: convertJointsToOverlay(joints, DP_HUMAN, false),
    }));
  }

  // Gesture overlays (have keyframes + activeJoints + loop)
  const gestureFiles = [
    ['check_watch',        'gesture/moving/check_watch.json'],
    ['wipe_sweat',         'gesture/moving/wipe_sweat.json'],
    ['adjust_clothes',     'gesture/static/adjust_clothes.json'],
    ['check_watch_static', 'gesture/static/check_watch.json'],
    ['look_around',        'gesture/static/look_around.json'],
    ['stretch',            'gesture/static/stretch.json'],
    ['yawn',               'gesture/static/yawn.json'],
    ['wave',               'gesture/wave.json'],
    ['stall_buyer_give_get', 'gesture/static/stall/buyer/give_get.json'],
    ['stall_buyer_point',    'gesture/static/stall/buyer/point.json'],
    ['stall_seller_call',    'gesture/static/stall/seller/call.json'],
    ['stall_seller_give',    'gesture/static/stall/seller/give.json'],
    ['stall_seller_tidy',    'gesture/static/stall/seller/tidy.json'],
    ['use_trash',          'sub_event/use_trash.json'],
    ['use_vending',        'sub_event/use_vending.json'],
  ];
  for (const [id, src] of gestureFiles) {
    const data = gitShow(`assets/animations/${src}`);
    write(path.join(ANIM_OUT, `overlay/arm/${id}.json`), clip({
      id, kind: 'overlay',
      activeJoints: data.activeJoints,
      keyframes: convertGestureKfs(data.keyframes, DP_HUMAN),
    }));
  }

  // Trait overlays (additive deltas from defaultPose → keep values as-is)
  const traitFiles = [
    ['hold_bag',        'trait/side/hold_bag.json',   'side',  true],
    ['hold_bag_front',  'trait/front/hold_bag.json',  'front', true],
    ['umbrella',        'trait/side/umbrella.json',   'side',  true],
    ['umbrella_front',  'trait/front/umbrella.json',  'front', true],
    ['walk_dog',        'trait/side/walk_dog.json',   'side',  true],
    ['walk_dog_front',  'trait/front/walk_dog.json',  'front', true],
  ];
  for (const [id, src, facing, latched] of traitFiles) {
    const data = gitShow(`assets/animations/${src}`);
    const joints = data.joints;
    // Trait values are already deltas from defaultPose (additive), keep as-is
    write(path.join(ANIM_OUT, `overlay/arm/${id}.json`), clip({
      id, kind: 'overlay', facing,
      activeJoints: Object.keys(joints),
      latched,
      keyframes: [joints],
    }));
  }

  // ── overlay/posture ───────────────────────────────────────────────────────

  // Extract "hunched" posture from walk_older vs walk differences
  // walk_older neck/head positions (absolute editor) minus defaultPose = delta
  const walkOlderSrc = gitShow('assets/animations/variant/older/walk_older.json');
  const wof0 = walkOlderSrc.frames[0];
  write(path.join(ANIM_OUT, 'overlay/posture/hunched.json'), clip({
    id: 'hunched', kind: 'overlay',
    activeJoints: ['neck', 'head'],
    keyframes: [{
      neck: toDelta('neck', wof0.neck, DP_HUMAN),
      head: toDelta('head', wof0.head, DP_HUMAN),
    }],
  }));

  // ── overlay/duet ──────────────────────────────────────────────────────────

  // aDelta/bDelta sub_events
  const duetFiles = [
    ['handshake', 'sub_event/handshake.json'],
    ['give_item',  'sub_event/give_item.json'],
    ['point_at',   'sub_event/point_at.json'],
    ['push',       'sub_event/push.json'],
  ];
  for (const [id, src] of duetFiles) {
    const data = gitShow(`assets/animations/${src}`);
    write(path.join(ANIM_OUT, `overlay/duet/${id}.json`), clip({
      id, kind: 'overlay',
      participants: [{ role: 'a' }, { role: 'b' }],
      keyframes: convertDuetKf(data.aDelta, data.bDelta),
    }));
  }

  // human_pet_dog: multi-skeleton overlay (human + dog)
  {
    const src = gitShow('assets/animations/pet/human_pet_dog_side.json');
    // Only has human skeleton data; group under "human" role
    // Move dur to top level of the role-grouped keyframe
    const kfs = convertBase(src, DP_HUMAN, 0.15).map(kf => {
      const { dur, ...joints } = kf;
      const entry = { human: joints };
      if (dur != null) entry.dur = dur;
      return entry;
    });
    write(path.join(ANIM_OUT, 'overlay/duet/human_pet_dog.json'), clip({
      id: 'human_pet_dog', kind: 'overlay',
      participants: [
        { role: 'human' },
        { role: 'dog', skeleton: 'dog' },
      ],
      keyframes: kfs,
    }));
  }

  // ── variant/ ─────────────────────────────────────────────────────────────

  // walk_older: parameter-only variant (no keyframes)
  write(path.join(ANIM_OUT, 'variant/walk_older.json'), clip({
    id: 'walk_older', kind: 'cycle',
    variant_of: 'walk',
    amp: 0.7,
    ref_speed: 0.75,
  }));

  // fall_older: independent keyframes
  {
    const src = gitShow('assets/animations/variant/older/fall_older.json');
    write(path.join(ANIM_OUT, 'variant/fall_older.json'), clip({
      id: 'fall_older', kind: 'transition',
      variant_of: 'fall',
      from: 'walk', to: 'lie_ground',
      keyframes: convertBase(src, DP_HUMAN, 0.08),
    }));
  }

  // lie_ground_older: independent keyframes
  {
    const src = gitShow('assets/animations/variant/older/lie_ground_older.json');
    write(path.join(ANIM_OUT, 'variant/lie_ground_older.json'), clip({
      id: 'lie_ground_older', kind: 'cycle',
      variant_of: 'lie_ground',
      keyframes: convertBase(src, DP_HUMAN),
    }));
  }

  console.log('\nMigration complete.');
}

migrate();
