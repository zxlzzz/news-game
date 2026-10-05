# Shared human mapping and inverted hand support

Changes are pure functions of source pose and shared JSON parameters. There is no per-clip production branch, temporal filter, or bone-length change.

- The 70-degree spread rule retains its accepted polar cone. In the 20-degree transition band, an inward transverse direction now turns continuously toward the outward target instead of immediately reversing its lateral sign. The forearm follows the same shortest rotation. Fully raised accepted poses retain the old endpoint rule.
- Head approach uses source palm surface clearance: `(distance(palm, sourceHeadCenter) - sourceHeadRadius)`, scaled by limb proportions outside the sphere. It does not enlarge the whole clearance vector by the enlarged head-radius ratio. An additional proximity fit applies only to the geometric clearance excess introduced by the large head; it avoids pulling every nearby hand into the sphere. Source elbow or palm discontinuities can still pass through.
- `supportHands` comes from source palm height and inverted torso direction. It carries paired-hand body elevation and ground IK; the original arm extension and all bone lengths remain fixed. Hip, neck, and leg targets rise together. Actual terrain contact grounds the palms before head clearance correction. All pose producers and the dog-walker mirror carry the required field.

## Evidence and scope

`native_comparison.json` compares the old and new pure mapper on the CURRENT exported source at the exact native timestamps. It is not a before/after comparison of source repairs. Original source assets are separately archived by the source agent under `../interactions/before/`; the earlier actual pre/final data are under `delivery/motion_review_2026-10-02/`.

`godot_native_report.json` evaluates all 239 clips / 25,340 native poses for finite geometry, exact bone lengths, and support weights. `parity_fixture.json` tests 742 poses across all 239 clips against the JavaScript implementation in real Godot. Parent integration refreshes these after the final phone-palm source repair.

With the source unchanged, duck-cover native 47→48 left-wrist neck-relative displacement changes from 20.46 to 9.24 cm. This quantitative reduction is supplemented by the real 30 Hz focus view, where the hand continues to cover the head without the old sudden release. Elder source-chain repair removes the original elbow discontinuity; its final left-wrist steps are 0.81 cm at 12→13 and 0.20 cm at 43→44. Do not attribute that full reduction to the mapper alone.

Actual handstand ground contact keeps both wrist centers at 1.75 cm in figure units and the head sphere bottom at least 11.26 cm above that plane (33.78 cm at the preview scale of 3). Real square-pixel views in `../human_focus/handstand.png` confirm two palms supporting the inverted body and a clear gap below the head. Non-inverted actions do not acquire this support; the maximum paired weight in `trip_fall` is only 0.0313.

Cheer and cross-arms remain exactly unchanged throughout all native frames. Photo-overhead retains its accepted face occlusion; the largest pure mapped-pose difference is 0.586 cm at scale 3. Its final prop contact is checked in the integration preview. The final phone-palm repair and grip views are owned by the source/integration agents; the previous right-ear wrist-only source fix placed the estimated palm above the ear, which the mapper correctly preserved. The second source fix targets the estimated palm relative to the real source head center.

## Reusable checks

- `verify_mapping.mjs`: whole-library native old/new geometry and amplification candidates. A candidate is a screening flag, not a semantic failure.
- `make_parity_fixture.mjs` plus `godot/tools/check_mapping_relations.gd`: real Godot full-library bone/support checks and JS parity.
- `analyze_mapping.mjs`: local geometric evidence around confirmed events; pass the current mapper path to refresh `current_trace.json`.
- `baseline_mapper.mjs`: the historical mapper fixture for reproducible comparison.

The actual rule text is synchronized in `docs/design-plans/npc-skeleton-mapping.md`. No project memo or street scene is changed by this work.
