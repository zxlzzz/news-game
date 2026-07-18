#!/usr/bin/env node
/**
 * derive-vehicle-anchors.mjs — 从 skeleton.json + mounted clip FK 推导骑手关节常量
 *
 * 用法：node scripts/derive-vehicle-anchors.mjs
 *
 * 输出 hip / 前手（direction=1 时 jx 较大的手）/ foot_l / foot_r
 * 相对 (0, 0) 的 joint-space 坐标（scale=1，direction=1），
 * 以及骑手各帧两脚中点的平均值（曲柄中心常量）。
 *
 * 公式：world = (npc.x + jx * scale * direction,  npc.y + jy * scale)
 *
 * 只读取推导，不写任何文件。
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = p => JSON.parse(readFileSync(p, 'utf8'));

const skeleton  = readJson(join(ROOT, 'assets', 'skeleton.json'));
const manifest  = readJson(join(ROOT, 'assets', 'manifest.json'));
const dp        = skeleton.skeletons.human.defaultPose;

const CLIPS = ['bike', 'mobike', 'mobile'];

for (const clipId of CLIPS) {
  const entry = manifest.clips[clipId];
  const raw   = readJson(join(ROOT, 'assets', entry.path));
  const kfs   = raw.keyframes;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`clip: ${clipId}  (${kfs.length} frame${kfs.length > 1 ? 's' : ''})`);
  console.log('─'.repeat(60));

  // FK: abs[j] = defaultPose[j] + (keyframe[j] ?? [0,0])
  const fk = (kf, joint) => {
    const base  = dp[joint] ?? [0, 0];
    const delta = kf[joint] ?? [0, 0];
    return [base[0] + delta[0], base[1] + delta[1]];
  };

  // Frame 0 values
  const kf0 = kfs[0];
  const hip    = fk(kf0, 'body');
  const lhand  = fk(kf0, 'l_hand');
  const rhand  = fk(kf0, 'r_hand');
  const lfootF = fk(kf0, 'l_foot');
  const rfootF = fk(kf0, 'r_foot');
  const fwdHand = rhand[0] >= lhand[0] ? rhand : lhand;
  const fwdName = rhand[0] >= lhand[0] ? 'r_hand' : 'l_hand';

  console.log('Frame 0 FK (joint-space, scale=1, direction=+1):');
  console.log(`  hip        (body):   [${hip[0].toFixed(1)}, ${hip[1].toFixed(1)}]`);
  console.log(`  l_hand:              [${lhand[0].toFixed(1)}, ${lhand[1].toFixed(1)}]`);
  console.log(`  r_hand:              [${rhand[0].toFixed(1)}, ${rhand[1].toFixed(1)}]`);
  console.log(`  forward hand (${fwdName}): [${fwdHand[0].toFixed(1)}, ${fwdHand[1].toFixed(1)}]`);
  console.log(`  l_foot:              [${lfootF[0].toFixed(1)}, ${lfootF[1].toFixed(1)}]`);
  console.log(`  r_foot:              [${rfootF[0].toFixed(1)}, ${rfootF[1].toFixed(1)}]`);

  // All-frame averages for stable constants
  let sumHip = [0, 0], sumLH = [0, 0], sumRH = [0, 0];
  let sumLF = [0, 0], sumRF = [0, 0], sumMid = [0, 0];
  for (const kf of kfs) {
    const h  = fk(kf, 'body');
    const lh = fk(kf, 'l_hand');
    const rh = fk(kf, 'r_hand');
    const lf = fk(kf, 'l_foot');
    const rf = fk(kf, 'r_foot');
    sumHip[0] += h[0];  sumHip[1] += h[1];
    sumLH[0]  += lh[0]; sumLH[1]  += lh[1];
    sumRH[0]  += rh[0]; sumRH[1]  += rh[1];
    sumLF[0]  += lf[0]; sumLF[1]  += lf[1];
    sumRF[0]  += rf[0]; sumRF[1]  += rf[1];
    sumMid[0] += (lf[0] + rf[0]) / 2;
    sumMid[1] += (lf[1] + rf[1]) / 2;
  }
  const n = kfs.length;
  const avg = v => [v[0] / n, v[1] / n];
  const avgHip = avg(sumHip), avgMid = avg(sumMid);

  if (n > 1) {
    console.log(`\nAll-frame averages:`);
    console.log(`  hip avg:         [${avgHip[0].toFixed(1)}, ${avgHip[1].toFixed(1)}]`);
    console.log(`  crank (ft-mid):  [${avgMid[0].toFixed(1)}, ${avgMid[1].toFixed(1)}]`);
  }

  // Bike-specific: wheel position constants (relative to root = (0,0))
  if (clipId === 'bike') {
    const HIP_JX = hip[0], BAR_JX = fwdHand[0], BAR_JY = fwdHand[1];
    const wR = 25;
    console.log(`\nBike structural constants (add to root: world = n.x + C*s*d or n.y + C*s):`);
    console.log(`  rear wheel x:   hip_jx - 5  = ${HIP_JX} - 5 = ${HIP_JX - 5}  → rwx = n.x + ${HIP_JX - 5}*s*d`);
    console.log(`  front wheel x:  bar_jx + 7  = ${BAR_JX} + 7 = ${BAR_JX + 7}  → fwx = n.x + ${BAR_JX + 7}*s*d`);
    console.log(`  wheel radius:   ${wR}  → wCy = n.y - ${wR}*s`);
    console.log(`  crank center:   [${avgMid[0].toFixed(1)}, ${avgMid[1].toFixed(1)}]  (avg all frames)`);
  }

  // Ebike-specific
  if (clipId === 'mobile') {
    const s = 1.0;  // after removing *1.2
    const HIP_JX = hip[0], HIP_JY = hip[1];
    const BAR_JX = fwdHand[0], BAR_JY = fwdHand[1];
    const midJY = (lfootF[1] + rfootF[1]) / 2;
    console.log(`\nEbike structural constants (s = n.scale, no *1.2 factor):`);
    console.log(`  hip:        jx=${HIP_JX}, jy=${HIP_JY}`);
    console.log(`  bar (${fwdName}): jx=${BAR_JX}, jy=${BAR_JY}`);
    console.log(`  foot_l:     jx=${lfootF[0]}, jy=${lfootF[1]}`);
    console.log(`  foot_r:     jx=${rfootF[0]}, jy=${rfootF[1]}`);
    console.log(`  foot midY:  jy=${midJY.toFixed(1)}`);
    // Compute folded constants (original formula result, s folded in with *1.2)
    const wR   = 14.4 * 1.2; // was 14.4*s, s=n.scale*1.2
    const rwOff = 19.2 * 1.2; // was 19.2*s*d offset from hip
    const fwOff =  4.8 * 1.2; // was 4.8*s*d offset from bar
    const platOff = 2.4 * 1.2; // was 2.4*s
    const boxW = 14.4 * 1.2, boxH = 13.2 * 1.2;
    const boxCxOff = 21.6 * 1.2;
    console.log(`\n  After folding s*1.2 → n.scale (current visual, no change):`);
    console.log(`  wR   = ${wR.toFixed(2)} * n.scale`);
    console.log(`  rwx  = n.x + (${HIP_JX} - ${rwOff.toFixed(2)}) * n.scale * d = n.x + ${(HIP_JX - rwOff).toFixed(2)} * n.scale * d`);
    console.log(`  fwx  = n.x + (${BAR_JX} + ${fwOff.toFixed(2)}) * n.scale * d = n.x + ${(BAR_JX + fwOff).toFixed(2)} * n.scale * d`);
    console.log(`  platform_y (footMidY + 2.4*s): jy = ${midJY.toFixed(1)} + ${platOff.toFixed(2)} = ${(midJY + platOff).toFixed(2)} → n.y + ${(midJY + platOff).toFixed(2)} * n.scale`);
    console.log(`  boxW = ${boxW.toFixed(2)} * n.scale`);
    console.log(`  boxH = ${boxH.toFixed(2)} * n.scale`);
    console.log(`  boxCx = n.x + (${HIP_JX} - ${boxCxOff.toFixed(2)}) * n.scale * d = n.x + ${(HIP_JX - boxCxOff).toFixed(2)} * n.scale * d`);
  }
}

console.log('\n');
