#!/usr/bin/env python3
"""
rezero-clips.py — Shift cycle clip keyframe deltas so max joint abs_y == 0.

Convention:
  abs[j] = defaultPose[j] + delta[j]
  Omitted joint in keyframe ↔ delta [0, 0] (implicit zero).

Fix algorithm (per clip):
  1. Compute M = max abs_y across ALL joints (including implicit) across ALL frames.
  2. For every frame, materialise ALL joints from defaultPose (filling implicit zeros),
     then subtract M from each joint's delta_y.
  3. Prune joints whose new delta is [0, 0] (restore compact representation),
     but keep any joint that was previously implicit and now has a non-zero delta.
  4. Overwrite the JSON file; preserve 'dur' and '_bend_*' keys exactly.

Targets: chess, chess_onlookers, sit_ground, lie_ground
lie_ground_older is a variant (uses lie_ground's keyframes × amp), automatically
fixed when lie_ground is fixed — do not touch it directly.

Self-verification:
  After writing, re-expand each fixed clip and assert max_y ∈ [-0.5, 0.5].
  For lie_ground_older: verify via variant expansion within ±5 tolerance.
  If lie_ground_older fails tolerance, report the amp value for manual review —
  do NOT auto-adjust amp.

Usage:
  python3 scripts/rezero-clips.py [--dry-run]
"""

import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(BASE, 'assets', 'manifest.json')
SKELETON_PATH = os.path.join(BASE, 'assets', 'skeleton.json')

TARGET_CLIPS = ['chess', 'chess_onlookers', 'sit_ground', 'lie_ground']

DRY_RUN = '--dry-run' in sys.argv


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def compute_max_y(kfs, dp, amp=1):
    """Return max abs_y across all frames and all joints (including implicit zeros)."""
    max_y = -10000
    for kf in kfs:
        for j, base in dp.items():
            delta_y = kf.get(j, [0, 0])[1]
            abs_y = base[1] + delta_y * amp
            if abs_y > max_y:
                max_y = abs_y
    return max_y


def build_fixed_kf(kf, dp, M):
    """
    Return a new keyframe dict with M subtracted from every joint's delta_y.
    ALL joints are materialised (implicit zeros become explicit if their new
    delta is non-zero), then re-pruned to compact form.
    Preserves 'dur' and '_bend_*' keys unchanged.
    """
    new_kf = {}
    # Preserve metadata keys
    if 'dur' in kf:
        new_kf['dur'] = kf['dur']
    for k in kf:
        if k.startswith('_bend_'):
            new_kf[k] = kf[k]
    # Shift every joint (materialise implicit zeros)
    for j in dp:
        old = kf.get(j, [0, 0])
        new_dx = old[0]
        new_dy = old[1] - M
        if new_dx != 0 or new_dy != 0:
            new_kf[j] = [int(new_dx), int(new_dy)]
        # else: new delta is [0,0] → omit (compact representation)
    return new_kf


def fix_clip(clip_id, manifest, skeletons):
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

    M = compute_max_y(kfs, dp)
    print(f'  {clip_id}: M={M:.1f}  frames={len(kfs)}  skeleton={skel_name}')

    if abs(M) < 0.5:
        print(f'    already grounded (|M| < 0.5), skip')
        return True

    new_kfs = [build_fixed_kf(kf, dp, M) for kf in kfs]

    if DRY_RUN:
        print(f'    [DRY RUN] would write {path}')
        return True

    raw['keyframes'] = new_kfs
    save_json(path, raw)
    print(f'    wrote {path}')
    return True


def verify_direct(clip_id, manifest, skeletons):
    """Verify fixed clip: max abs_y ∈ [-0.5, 0.5]."""
    entry = manifest['clips'][clip_id]
    path = os.path.join(BASE, 'assets', entry['path'])
    raw = load_json(path)
    skel_name = raw.get('skeleton', 'human')
    dp = skeletons[skel_name]['defaultPose']
    max_y = compute_max_y(raw.get('keyframes', []), dp)
    ok = abs(max_y) <= 0.5
    status = '✓' if ok else '✗ FAIL'
    print(f'  verify {clip_id}: max_y={max_y:.3f}  {status}')
    return ok


def verify_variant(clip_id, manifest, skeletons, tol=5):
    """Verify variant clip via base kfs × amp within tolerance."""
    entry = manifest['clips'][clip_id]
    path = os.path.join(BASE, 'assets', entry['path'])
    raw = load_json(path)

    base_id = raw.get('variant_of')
    amp = raw.get('amp', 1)
    base_entry = manifest['clips'].get(base_id, {})
    base_path = os.path.join(BASE, 'assets', base_entry['path'])
    base_raw = load_json(base_path)

    skel_name = base_raw.get('skeleton', 'human')
    dp = skeletons[skel_name]['defaultPose']
    max_y = compute_max_y(base_raw.get('keyframes', []), dp, amp=amp)

    ok = abs(max_y) <= tol
    if ok:
        print(f'  verify variant {clip_id}: max_y={max_y:.3f} amp={amp}  ✓')
    else:
        print(f'  verify variant {clip_id}: max_y={max_y:.3f} amp={amp}  '
              f'✗ 超出 ±{tol} 容差 — amp={amp} 待人工定夺，不自动修改')
    return ok


def main():
    print(f'Loading manifest and skeleton...')
    manifest = load_json(MANIFEST_PATH)
    skeletons = load_json(SKELETON_PATH)['skeletons']

    print(f'\n=== Fixing clips (dry_run={DRY_RUN}) ===')
    for clip_id in TARGET_CLIPS:
        fix_clip(clip_id, manifest, skeletons)

    if DRY_RUN:
        print('\n[DRY RUN] No files written.')
        return

    print('\n=== Verification ===')
    all_ok = True
    for clip_id in TARGET_CLIPS:
        ok = verify_direct(clip_id, manifest, skeletons)
        all_ok = all_ok and ok

    ok = verify_variant('lie_ground_older', manifest, skeletons, tol=5)
    all_ok = all_ok and ok

    print(f'\n{"All checks passed ✓" if all_ok else "Some checks FAILED ✗"}')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
