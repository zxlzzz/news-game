# Caller attitude context: actual render comparison

Assistant visual review completed; Hsinlung's style acceptance is pending.
The frozen production library and JSON did not change.

`review_pigeon_context.gd` calls the named library directly, then renders through
the existing `ProceduralPigeon.silhouette` and `InkFigure`. It owns a fixed root
at (0, 0.35, 0), identity basis and heading 0. It does not instantiate the empty
ground stage, integrate velocity, choose another motion or define a route.
Camera and ground grid remain fixed. The plain diagnostic background differs
from the empty-ground UI; the bird geometry and ink renderer are the same.

All 10 combinations were actually viewed at all 24 times from 0°, 90° and 30°:
flap for 0.8 s and glide for 1.2 s, each with neutral, climb, left bank, right bank
and brake inputs. The input context is constant within each recording.
`context_actual/manifest.json` records contexts, times, pose points and root/basis.
The root transform stayed exactly equal to its initial transform in all 720
rendered samples. The 0.35 m root coordinate is serialized as
0.349999994039536 by the engine's float representation, without temporal drift.
The manifest records every input SHA and the capture verified them again at exit.

| Input | Actual visible result at the same motion time |
|---|---|
| Neutral | Flap continues its two strokes per 0.8 s period; glide holds its named pose. |
| `velocity=(0,2,3)` m/s | Side/oblique views show increased nose-to-tail pitch, with the tail lower relative to the head. Root height and heading do not change. |
| `turn_rate=-1.5` rad/s | Front/oblique views show left bank, including at matching wing phases. |
| `turn_rate=+1.5` rad/s | Bank reverses to the right. The figure does not rotate its heading. |
| `brake=1` | Claws extend visibly below the body and pitch increases. Flap amplitude reduces toward the spread-wing glide shape through the existing adaptation channels; the selected id stays flap. |

The five comparison columns are neutral, climb, left turn, right turn and brake;
the three rows are front, side and oblique. These images retain the same camera,
time and original screenshot pixels for each column:

- [Glide comparison](context_compare/glide_same_time_00.png).
- [Flap at 0.2667 s](context_compare/flap_same_time_08.png).
- [Flap at 0 s](context_compare/flap_same_time_00.png).
- [Flap context GIF](context_compare/flap_contexts.gif), one pass of 800 ms.
- [Glide context GIF](context_compare/glide_contexts.gif), one pass of 1200 ms.

Root independently reviewed the complete five-column, three-view glide 0 s and
flap 0.2667 s comparisons and confirmed the opposite banks, pitch change and
extended claws/tail attitude. The full assistant coverage is recorded in
[context_review.json](context_review.json); all 20 readable pages were viewed.
The comparison index preserves original timestamps and pixel hashes. GIFs use
cumulative centisecond timing; their encoded totals match 800 and 1200 ms.

Re-run the capture with Godot `-s res://tools/review_pigeon_context.gd --` followed
by this directory's `capture_context.json`. Its settings and numeric inputs live
in that request. Rebuilding pages uses `motion_sheet_pages.py` on `context_actual`.
A new render requires a new visual review; the recorded observations are not an
automatic quality check.

This verifies that caller attitude inputs visibly affect a named local motion
without moving the root. It does not verify an external flight route, changing
route inputs over time, world takeoff/touchdown placement or accepted acting style.
