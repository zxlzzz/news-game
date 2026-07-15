#!/usr/bin/env python3
"""
recenter-clips.py — Shift cycle clip keyframe deltas so horizontal centre-of-mass ≈ 0.

Convention:
  abs_x[j] = defaultPose[j][0] + delta[j][0]
  Omitted joint in keyframe ↔ delta [0, 0] (implicit zero).

Algorithm (per clip):
  1. Compute meanX = mean over ALL joints × ALL frames of abs_x.
  2. shift = -round(meanX)
  3. For every joint in defaultPose, in every frame:
       - If joint present:  x delta += shift  (y untouched)
       - If joint absent:   materialise as [shift, 0]
  4. ALL defaultPose joints are materialised in output — no pruning.
     Acceptance check: every keyframe must contain exactly |defaultPose| joints.
  5. Preserve 'dur', '_bend_*', 'globalBend' keys unchanged.

Self-verification:
  After writing, re-expand and assert |meanX| ≤ 1.

Usage:
  python3 scripts/recenter-clips.py [--dry-run]
"""

import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(BASE, 'assets', 'manifest.json')
SKELETON_PATH = os.path.join(BASE, 'assets', 'skeleton.json')

TARGET_CLIPS = ['walk']

DRY_RUN = '--dry-run' in sys.argv


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def compute_mean_x(kfs, dp):
    """Return mean abs_x across all frames and all joints (including implicit zeros)."""
    if not kfs or not dp:
        return 0.0
    total = 0.0
    for kf in kfs:
        for j, base in dp.items():
            delta_x = kf.get(j, [0, 0])[0]
            total += base[0] + delta_x
    return total / (len(kfs) * len(dp))


def build_recentered_kf(kf, dp, shift):
    """
    Return a new keyframe dict with shift added to every joint's delta_x.
    ALL defaultPose joints are materialised (implicit zeros become explicit).
    Joint order follows defaultPose order; metadata keys (dur, globalBend,
    _bend_*) are appended at the end.
    """
    new_kf = {}
    # Materialise every joint in defaultPose order, shifting x
    for j in dp:
        old = kf.get(j, [0, 0])
        new_kf[j] = [int(old[0] + shift), int(old[1])]
    # Append metadata keys at end (preserving original values)
    if 'dur' in kf:
        new_kf['dur'] = kf['dur']
    if 'globalBend' in kf:
        new_kf['globalBend'] = kf['globalBend']
    for k in kf:
        if k.startswith('_bend_'):
            new_kf[k] = kf[k]
    return new_kf


def scan_variants(manifest, target_clips):
    """Report any clip with variant_of pointing at a target clip."""
    found = []
    for cid, entry in manifest['clips'].items():
        path = os.path.join(BASE, 'assets', entry['path'])
        try:
            raw = load_json(path)
        except Exception:
            continue
        base = raw.get('variant_of')
        if base in target_clips:
            amp = raw.get('amp', 1)
            found.append((cid, base, amp))
    return found


def recenter_clip(clip_id, manifest, skeletons):
    entry = manifest['clips'].get(clip_id)
    if not entry:
        print(f'  ERROR: {clip_id} not in manifest')
        return False

    path = os.path.join(BASE, 'assets', entry['path'])
    raw = load_json(path)

    if raw.get('variant_of'):
        print(f'  SKIP {clip_id}: variant clip — fix its base instead')
        return True

    skel_name = raw.get('skeleton', 'human')
    dp = skeletons[skel_name]['defaultPose']
    kfs = raw.get('keyframes', [])

    mean_x_before = compute_mean_x(kfs, dp)
    shift = -round(mean_x_before)
    print(f'  {clip_id}: meanX_before={mean_x_before:.3f}  shift={shift:+d}'
          f'  frames={len(kfs)}  joints={len(dp)}  skeleton={skel_name}')

    if shift == 0:
        print(f'    shift=0, nothing to do')
        return True

    new_kfs = [build_recentered_kf(kf, dp, shift) for kf in kfs]
    mean_x_after = compute_mean_x(new_kfs, dp)
    print(f'    meanX_after={mean_x_after:.3f}  (residual={mean_x_after:.3f})')

    if DRY_RUN:
        print(f'    [DRY RUN] would write {path}')
        return True

    raw['keyframes'] = new_kfs
    save_json(path, raw)
    print(f'    wrote {path}')
    return True


def verify_clip(clip_id, manifest, skeletons):
    """Verify: |meanX| ≤ 1 AND every keyframe has exactly |defaultPose| joints."""
    entry = manifest['clips'].get(clip_id)
    path = os.path.join(BASE, 'assets', entry['path'])
    raw = load_json(path)
    skel_name = raw.get('skeleton', 'human')
    dp = skeletons[skel_name]['defaultPose']
    n_joints = len(dp)
    kfs = raw.get('keyframes', [])

    mean_x = compute_mean_x(kfs, dp)
    ok_mean = abs(mean_x) <= 1.0
    tag_mean = '✓' if ok_mean else f'✗ FAIL |meanX|={abs(mean_x):.3f} > 1'

    # Materialisation check: count defaultPose joints present per frame
    bad_frames = [i for i, kf in enumerate(kfs)
                  if sum(1 for j in dp if j in kf) != n_joints]
    ok_mat = len(bad_frames) == 0
    tag_mat = '✓' if ok_mat else f'✗ FAIL frames with wrong joint count: {bad_frames}'

    print(f'  verify {clip_id}: meanX={mean_x:.3f} {tag_mean}; materialisation {tag_mat}')
    return ok_mean and ok_mat


def main():
    print('Loading manifest and skeleton...')
    manifest = load_json(MANIFEST_PATH)
    skeletons = load_json(SKELETON_PATH)['skeletons']

    print('\n=== variant_of scan (walk-based variants) ===')
    variants = scan_variants(manifest, TARGET_CLIPS)
    if variants:
        for cid, base, amp in variants:
            print(f'  {cid}: variant_of={base}  amp={amp}'
                  f'  → x centroid = base_meanX × {amp}; auto-zero when base is centred')
    else:
        print('  (none found)')

    print(f'\n=== Recentering clips (dry_run={DRY_RUN}) ===')
    for clip_id in TARGET_CLIPS:
        recenter_clip(clip_id, manifest, skeletons)

    if DRY_RUN:
        print('\n[DRY RUN] No files written.')
        return

    print('\n=== Verification ===')
    all_ok = True
    for clip_id in TARGET_CLIPS:
        ok = verify_clip(clip_id, manifest, skeletons)
        all_ok = all_ok and ok

    print(f'\n{"All checks passed ✓" if all_ok else "Some checks FAILED ✗"}')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
