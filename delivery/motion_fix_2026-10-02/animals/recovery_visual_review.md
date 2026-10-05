# Recorded recovery visual review

Reviewed all 36 final pages: 18 in `low_pose_pages/index.json` and 18 in `recovery_pages/index.json`, with three views each. `recovery_visual_review.json` records exact page and manifest hashes, source indices and times. Capture uses final frozen Animal 7bfb0cc3 / Model d24184cd / configuration ad2cd236.

The six low-pose windows replay `final_low_pose/runtime.json` at 9.95–11.35 s: Cat sit, lie, sleep and side lie, plus Husky and Shiba lie. Forelegs collect, the body rises and walking starts; Cat side lie unrolls before standing. No large body pop or leg flip was visible at this capture scale.

The six scratch windows replay `final_scratch/runtime.json`: normal and urgent cancellation at 9.95–11.45 s, and normal sit-to-stand at 11.1–14 s, for both dogs. The suspended hind paw returns before the body rises. Normal cancellation settles into sitting before rising; urgent cancellation rises directly and starts gait. No transition to an unrelated action or large body lift was visible.

The renderer replays saved world matrices without controller resimulation. This review does not measure millimetre clearance, hidden-leg deformation or certify acting naturalness. The 16 full recordings' independent original-GLB skin/contact checks are in `final_low_pose/validation.json` and `final_scratch/validation.json`.

Twelve synchronized three-view GIFs in `low_pose_gifs/` and `recovery_gifs/` reuse these pixels and times, play once and retain the last recorded frame. `recording_timing.json` verifies duration and absence of a loop extension, including the three named-action recordings. These short visual windows are separate from the complete 16-second runtime scenarios.
