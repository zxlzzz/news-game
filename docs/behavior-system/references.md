# Sources for behavior design

> Source review from October 19. Implementation-gap statements below retain that historical scope; subsequent prototype work is recorded in [report 1](impl-report-1.md) and [report 2](impl-report-2.md).

Selection and seating execution rechecked 2026-10-19. Implementation observations are starting context, not a second specification; check the code again before changing it. This integration edits documentation only.

The new [action catalog](actions.md) and [behavior draft](behaviors.md) use these sources but do not modify them. Their action/behavior IDs, new tags, and proposed scores are design content, not a claim about the current runtime.

The [execution design](execution-plan.md) is the main design proposal; it is not implemented. It starts from cheap ordinary additions, shared defaults and reusable templates. It proposes synchronous decisions/resource checks with one checked fallback, plus a current-action instance check and effect/result commit. Detailed coordination is paid only by the templates that need it. Worked checks are paper reasoning, not runtime tests.

## Live project sources

| Source | Relevance |
|---|---|
| [NPC behavior design](design_route_npc_behavior.md) | Shared candidate scoring, individual multipliers, requests between two people, and activities recorded on objects. Section 3 is the main interaction reference. |
| [Global behavior table](../../godot/npc/behaviour-table.json) | Base scores, candidate sources and gates, clip-choice weights, and global selection parameters. |
| [Individual coefficients](../../godot/npc/behaviour-people.json) | Preference multipliers and movement-clip choices. Currently contains one profile. |
| [Behavior selection](../../godot/npc/behaviour.gd) | Candidate scoring and replacement of the current selection. |
| [Crowd execution](../../godot/npc/crowd.gd) | Movement toward posts, arrival, and concrete clip execution. Read for integration context; this documentation task does not authorize edits. |
| [Motion declarations](../../godot/npc/clip-setup.json) | Existing action requirements: posts, held items, partners, and contact setup. Read as the eventual asset interface, not a prerequisite for text simulation. |
| [Wallet source description](../../assets/animations/npz/wallet_takeout/meta.json), [payment source description](../../assets/animations/npz/pay/meta.json) | Text/duration checked 2026-10-19: wallet inspection includes putting it away; payment puts money on the counter. Neither establishes the design's prepared-tool/paired-checkout binding. This is source-semantic checking, not motion acceptance. |

### Three different uses of weights

- A behavior row's `base` contributes to selecting what to do. Distance, eligibility, personal coefficients, and selection jitter also affect the result; this is not simply weighted random selection of behaviors.
- `behaviour-people.json` supplies tag multipliers for those rows.
- A row's `clips` values are random-choice weights among concrete clips after a behavior is selected. They are not activity-selection scores.

### Relevant implementation gaps

- Current crowd execution is synchronous: _process() calls _update_agent() per person; it calls beh.choose() directly, then _start_action() claims the post in that call. This path has no asynchronous resource request/approval or acceptance-message pipeline. The proposal therefore uses the same logical update; collecting choices and using a stable allocation order is a proposed change to remove array-order preference, not evidence of a distributed system.
- Current rows choose clips. The customer row randomly picks choose_item or pay instead of using a purchase process. sit_bench and slouch_bench share a random clip row. New behavior/action separation and cheap templates are not implemented.
- choose() skips the current row entirely and again is keyed by row. Target alternatives must remain comparable; shared defaults can use behavior-plus-target retry rather than imposing a per-content lifetime protocol.
- value() recalculates distance and adds retained jitter. score() currently returns zero beyond sight; the proposal uses the cutoff for discovery, not continuing an already bound target.
- The proposal allows a situation table such as `{else: 2, invited: 6}` as a row's base. Whether the current table format already expresses this in one row was not checked in this edit; treat it as new schema until verified.
- Missing usable clips currently remove candidates. Defined text semantics must be independent of motion bindings; the draft catalog must not be auto-enabled or forced complete.
- seat_transition currently returns before reconsideration, and a seated replacement first starts standing up. This conflicts with anytime interruption; no playback code was changed here.
- The new schema/defaults, text executor, shared preparations, common templates, same-update arbitration and pair/service control are all still unimplemented. Their shared implementation is a one-time foundation cost, not zero work hidden behind a one-line example.
- The old transition-graph discussion does not require an exit clip or impose an interruption lock. Physical preparation, actual support and normal finishing must be kept distinct.

## Retired project material in Git

The following files were removed with the old JavaScript line in commit `10d4ac92`. Read them from revision `10d4ac92^` without restoring files or switching the working tree.

| Historical path | Why consult it |
|---|---|
| `docs/design-plans/chain-task-design.md` | An earlier data-driven sequence of concrete steps under one task. Frozen and superseded; do not inherit its interruption restrictions or architecture. |
| `docs/behavior-design.md` | Older distinction between intentions, tasks, movement, and social activities. A historical snapshot, not current implementation guidance. |
| `docs/audits/news-witness-logic-spec-2026-09-20.md` | Historical event, witness, and news implementation inventory. Not needed for the present activity/action work unless the scope later expands. |

Example read-only retrieval:

```powershell
git show '10d4ac92^:docs/design-plans/chain-task-design.md'
```

Current local materials are sufficient to continue the discussion. No Claude web conversation export is presently needed; request one only if a concrete missing decision cannot be recovered here.

## External references already reviewed

These are optional comparisons, not selected dependencies or approved designs.

- [Versu architecture](https://versu.com/wp-content/uploads/2014/05/versu.pdf): social practices offer actions to autonomous characters; its state inspector and explanations are useful references for making behavior understandable.
- [Ensemble](https://github.com/ensemble-engine/ensemble): rule-based social simulation with an authoring/testing tool; relevant to inspecting interaction rules.
- [Inform 7](https://ganelson.github.io/inform-website/): natural-language-like world/rule authoring. Less directly relevant now that text is clarified as the substitute for action presentation.
- [Generative Agents](https://arxiv.org/abs/2304.03442): language-model memory, reflection, and planning. The current goal does not establish a need for this architecture or for language-model agents.