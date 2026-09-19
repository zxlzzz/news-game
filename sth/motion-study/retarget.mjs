// Isolated SOMA study. All joint positions/directions come from exported motion.
// Length multipliers are style parameters, not hand-authored poses.
export const DEFAULTS = {torso: .86, shoulder: 1.08, hip: .85, arm: .94, leg: 1.04, head: .13};
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const mul = (a, s) => a.map(x => x * s);
export const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export const norm = a => Math.hypot(...a);
export const unit = a => mul(a, 1 / Math.max(norm(a), 1e-9));
export const mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createRig(data) {
  const ix = Object.fromEntries(data.names.map((n, i) => [n, i]));
  const ref = data.clips.stand_idle.frames[0];
  const lengths = data.names.map((_, i) => data.parents[i] < 0 ? 0 : norm(sub(ref[i], ref[data.parents[i]])));
  const feet = ['LeftFoot', 'LeftToeBase', 'LeftToeEnd', 'RightFoot', 'RightToeBase', 'RightToeEnd'].map(n => ix[n]);
  const structured = [['Hips', 'Spine1'], ['Spine1', 'Spine2'], ['Spine2', 'Chest'],
    ['Chest', 'Neck1'], ['Neck1', 'Neck2'], ['Neck2', 'Head'],
    ...['Left', 'Right'].flatMap(s => [['Chest', s + 'Shoulder'], [s + 'Shoulder', s + 'Arm'],
      [s + 'Arm', s + 'ForeArm'], [s + 'ForeArm', s + 'Hand'], ['Hips', s + 'Leg'],
      [s + 'Leg', s + 'Shin'], [s + 'Shin', s + 'Foot'], [s + 'Foot', s + 'ToeBase'], [s + 'ToeBase', s + 'ToeEnd']])];
  const direct = [['Hips', 'Neck2'], ['Neck2', 'HeadEnd'],
    ...['Left', 'Right'].flatMap(s => [['Neck2', s + 'ForeArm'], [s + 'ForeArm', s + 'Hand'],
      ['Hips', s + 'Shin'], [s + 'Shin', s + 'Foot']])];

  function factor(n, p) {
    if (/Shoulder$|Arm$/.test(n) && !/ForeArm$/.test(n)) return p.shoulder;
    if (/ForeArm$|Hand$/.test(n)) return p.arm;
    if (/Leg$/.test(n)) return p.hip;
    if (/Shin$|Foot$|Toe/.test(n)) return p.leg;
    if (/Spine|Chest|Neck/.test(n)) return p.torso;
    return 1;
  }
  // Two-bone IK keeps source bend side and fixed target lengths.
  function solve(q, root, hinge, end, target) {
    const a = q[root], b = q[hinge], c = q[end];
    const l1 = norm(sub(b, a)), l2 = norm(sub(c, b));
    const aim = sub(target, a), d = clamp(norm(aim), Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
    const axis = unit(aim);
    let bend = sub(sub(b, a), mul(axis, dot(sub(b, a), axis)));
    if (norm(bend) < 1e-7) {
      const fallback = Math.abs(axis[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
      bend = sub(fallback, mul(axis, dot(fallback, axis)));
    }
    const x = (l1*l1 - l2*l2 + d*d) / (2*d);
    q[hinge] = add(a, add(mul(axis, x), mul(unit(bend), Math.sqrt(Math.max(0, l1*l1 - x*x)))));
    q[end] = add(a, mul(axis, d));
    return norm(sub(q[end], target));
  }
  function headCenter(q, radius, legacy = false) {
    // Legacy harness subtracts a world-Y offset from HeadEnd even while bowing.
    if (legacy) return sub(q[ix.HeadEnd], [0, radius, 0]);
    return sub(q[ix.HeadEnd], mul(unit(sub(q[ix.HeadEnd], q[ix.Head])), radius));
  }
  function retarget(source, p = DEFAULTS, contacts = true) {
    const q = [];
    q[0] = [source[0][0], source[0][1] * p.leg, source[0][2]];
    for (let i = 1; i < source.length; i++) {
      const parent = data.parents[i];
      q[i] = add(q[parent], mul(unit(sub(source[i], source[parent])), lengths[i] * factor(data.names[i], p)));
    }
    // Start with source clearance, then preserve both ankle X/Z trajectories.
    // This preserves source stepping/sliding; it does not invent a foot lock.
    const dy = Math.min(...feet.map(i => source[i][1])) - Math.min(...feet.map(i => q[i][1]));
    for (let i = 0; i < q.length; i++) q[i][1] += dy;
    const footGoals = [];
    let lowerRoot = 0;
    for (const side of ['Left', 'Right']) {
      const hip = ix[side + 'Leg'], knee = ix[side + 'Shin'], foot = ix[side + 'Foot'];
      const toes = [foot, ix[side + 'ToeBase'], ix[side + 'ToeEnd']];
      const goal = [...source[foot]];
      goal[1] = Math.min(...toes.map(i => source[i][1])) - Math.min(...toes.map(i => q[i][1] - q[foot][1]));
      const reach = norm(sub(q[hip], q[knee])) + norm(sub(q[knee], q[foot])) - 1e-5;
      const offset = sub(q[hip], goal), horizontal2 = offset[0]**2 + offset[2]**2;
      if (offset[1] > 0 && norm(offset) > reach && horizontal2 < reach**2) {
        lowerRoot = Math.max(lowerRoot, offset[1] - Math.sqrt(reach**2 - horizontal2));
      }
      footGoals.push({hip,knee,foot,toes,goal});
    }
    for (const p of q) p[1] -= lowerRoot;
    let maxFootError = 0;
    for (const {hip,knee,foot,toes,goal} of footGoals) {
      const before = [...q[foot]];
      maxFootError = Math.max(maxFootError, solve(q, hip, knee, foot, goal));
      const shift = sub(q[foot], before);
      for (const toe of toes.slice(1)) q[toe] = add(q[toe], shift);
    }
    let maxHandError = 0;
    if (contacts) {
      const oldHead = headCenter(source, .13), newHead = headCenter(q, p.head);
      for (const side of ['Left', 'Right']) {
        const hand = ix[side + 'Hand'];
        const offset = sub(source[hand], oldHead);
        // Smooth proximity weighting; wrist proximity is only a head-contact
        // heuristic, never a claim of palm/finger contact.
        const t = clamp((.34 - norm(offset)) / .13, 0, 1);
        const w = t*t*(3 - 2*t);
        if (w > 0) {
          const goal = mix(q[hand], add(newHead, mul(offset, p.head / .13)), w);
          maxHandError = Math.max(maxHandError, solve(q, ix[side + 'Arm'], ix[side + 'ForeArm'], hand, goal));
        }
      }
    }
    return {joints: q, maxHandError, maxFootError};
  }
  return {ix, lengths, feet, direct, structured, retarget, headCenter, factor};
}
