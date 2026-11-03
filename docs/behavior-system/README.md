# Behavior system with text NPCs

The independent executor in `godot/npc/text_behavior/` develops the game's behavior rules while text substitutes for animation. Current contract: [execution-plan.md](execution-plan.md). Results: [batch5 report](impl-report-5.md), [row-by-row cost/coverage](catalog-audit-5.md), [action/source evidence](asset-audit-5.json). Reports 1–4 are historical records.

All 98 inventory entries are accounted for: 95 enabled inventory behaviors and 3 internal jobs. The runtime table has 97 rows: inventory walk uses existing `stroll`; implementation entries `idle` and disabled `adjust_clothes` remain. Total: 96 enabled rows, 1 disabled, 147 audited actions. All 90 previous enabled rows and 43 existing personal coefficient maps are unchanged. Counts describe coverage, not picture acceptance.

## Requirements

- One current purpose per person: purpose above, actual action below; preserve meaningful alternatives such as upright sitting/slouching.
- Ordinary additions stay in the table. All templates reuse preparation, interruption, allocation and effects. New capabilities are charged as shared engine development.
- Missing clips allow defined text semantics. Unknown semantics/physical capabilities stay explicitly disabled/TODO; malformed enabled data is an error.
- Anything can be interrupted. Actual objects, support, object activities and committed results do not vanish with the body request.
- No long-term memory, relationships, schedules, news, emotions, complete economy, planner or language-model character.

## Current mechanisms

`direct`, `use_tool`, `go_use`, `pair_once` and services remain. New reusable templates cover sustained conversation, object-owned membership/turns, shared travel and visible-event responses. Finite sequences, focused observation and item-dependent transport express the other defined content. All requests still use one allocator. Stable invitation circumstances prevent simultaneous offers from repeatedly swapping choices; nobody is forced to accept.

Chess records activity on the table, independently of who started. Events expire; an external fall changes actual support before choices. Journeys keep current participants/destination rather than relationships. `support_use` now shares one device/role/path ledger across pushing, riding, mechanical tracks, suspension/palm contact and shared human loads. Real occupancy survives a purpose change until bounded unloading reaches ground. A supported fall unloads first, then commits the ground fact. Calls use an explicit persistent connection and end separately from body fragments. The same connection work is verified as phone_call and as a configured buy_stuff queue diversion; being called for service preempts the phone body without hanging up.

## Run and verify

Open `res://scenes/text_behavior_test/level.tscn` and run that scene. Space pauses, R restarts, T manufactures a fall, wheel/drag changes view, F resets. It has 43 people and 15 text devices: responding/stopping taxi with door and seat, private car, carts, bicycles/scooter, mechanical supports, shared assistance/lifting and a route door. The earlier conversation, chess, child/dog travel, events, handshake and stall remain. An actual remote event ends the phone connection. Figures remain fixed symbols; devices are text/position markers, without physical props or animation.

Batch 5 adds 7 people (50 total), a stationary permitted contact dog, one current
meeting task, two finite checkout/output providers and a left-hand paper stack
with two actual sheet IDs. One sheet is offered to an independently choosing
recipient. All six new rows and their committed outcomes are required in scene
checks. No main game scene is launched by these commands.

From the repository root:

```powershell
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/check_text_behavior.gd
& 'D:/Godot/Godot_v4.7.2-stable_win64_console.exe' --headless --path godot -s res://tools/scan_text_behavior.gd -- --seconds=240
python godot/tools/audit_text_behavior.py
```

The scanner optionally accepts `--output=<absolute-jsonl-path>` for every frame's purpose, target, action, text, body instance, position, support owner/phase, held object, device position/door/occupancy and calls. It detects stable text cycles, stationary walking, bodyless selected work, unproductive waits and stalled supports. At 60 seconds or longer it also requires configured supports to complete and the route portal to open; a passing scanner alone previously missed an unstarted lift. Manual passage uses the same preparation/effect executor to free hands and open the fixture, then continues the original route. Coupled drivers stop and release before operating it.

## Sources

| File | Purpose |
|---|---|
| [execution-plan.md](execution-plan.md) | Current authoring/execution contract |
| [impl-report-5.md](impl-report-5.md) | Current task/checkout/hand extensions, checks and boundaries |
| [catalog-audit-5.md](catalog-audit-5.md) | Every row's cost, inventory coverage and action review |
| [actions.md](actions.md) | Semantic inventory and synchronized material requests |
| [behaviors.md](behaviors.md) | Dated inventory/weights; not the enabled runtime table |
| [design_route_npc_behavior.md](design_route_npc_behavior.md) | Earlier object-owned activity design |
| [references.md](references.md), [review-opinion.md](review-opinion.md) | Earlier sources/review context |

This executor is separate from animated street integration. Passing text checks does not prove animation contact, handoff timing, paired gait geometry, continuous pose transitions or final head-box layout.
