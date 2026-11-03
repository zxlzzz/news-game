# Batch 3 working state

Task: expand the inventory through reusable templates, audit every row/action against the inventory and source assets, verify deterministic mechanisms and scan the independent text scene. No main scene, motion changes, branches or commits.

## Current state

- Implemented conversation, object activity, shared travel, event response, sequence, observation and transport in activities.gd. Extended pair_once with asymmetric specified-object transfer; no behavior-name dispatch.
- All 98 inventory entries accounted for: 71 enabled inventory entries, 24 disabled, 3 internal; runtime has 97 rows (72 enabled) including retained implementation entries. All 110 actions audited against actions/behaviors/clip-setup and referenced source metadata/exports.
- Actual baseline rerun: 328 assertions. Final combined run: TEXT_BEHAVIOR_OK (693 assertions), exit 0, including the old 300-second real WalkGrid integration. Six explicit script parse checks passed. Python audit passed (98 inventory, 97 rows, 72 enabled, 110 actions).
- Final 240-second / 14,400-frame / 24-person real WalkGrid scan passed; trace 3,105 events, no stationary walking, stable text loop or unproductive per-binding wait. It exercised chat/whisper/interview, chess, both travel kinds, fall/self-rise/balance and original service/handshake. Maximum no-purpose gap 0.5 s. Final live encounter was actively speaking/listening, not stuck.
- First scan exposed 1,362 state transitions per Talk actor: incompatible chat/whisper invitations swapped forever. Fixed common invitation circumstance arbitration, added reciprocal and three-way-cycle checks. Initial scanner missed one-frame preparation interleaving; stable-action text scan now catches it.
- Existing pair cleanup deleted other templates' layout points. Moved layout ownership/cleanup into the common core. Matched assembly is now bounded and cooldown applies on failure.
- Action audit tightened standing book, empty bench poses, distinct seat transitions and held-object bindings. Source-name conflicts (sideways/umbrella), parcel touch-only setup, ATM pocket output and interview layout mismatch are explicit gaps; actions.md synchronized.
- README/execution plan rewritten to current implementation. impl-report-3.md, catalog-audit-3.md and asset-audit-3.json are complete, with TODO/material lists and exact evidence. actions.md is synchronized.
- Complete: final report and audits delivered; this task's scratch scripts, logs and 14,400-frame export removed after summarizing evidence. All unrelated workspace changes preserved. No remaining implementation task, branch/commit/push or main-scene run.

## Decisions

- Keep inventory defaults off and internal queue/service/door work outside scored rows.
- No fake vehicle movement, assisted body support or unspecified transaction success. Missing clips may execute defined text semantics, with explicit binding gaps.
- Store reusable authoring/audit evidence with the final report; temporary logs will be removed.
