# Project Memory

This file is maintained by Claude and updated on request ("更新memo").
Hsinlung does not read this often, so it's kept in plain English.

---

## Meta: how "更新memo" works

When Hsinlung asks to "update memo", it means two things, not just one:

1. **Add** new content (facts learned, decisions made, plans agreed on).
2. **Remove** stale content — this is the part that's easy to skip and
   shouldn't be. Prune regularly, don't just accumulate.
   - Forward-looking plans / roadmap items → keep.
   - Ideas that turned out wrong, abandoned approaches, resolved
     one-off issues → delete outright, don't hoard them "just in case".
   - Unsure whether something is still relevant → ask Hsinlung instead
     of guessing either way (keep-by-default or delete-by-default are
     both wrong defaults here).

There's a second trigger besides an explicit "更新memo" request: **finishing
a `tasks.md` patch**. Cadence is Claude's call, decided as: update memo
per-patch, right alongside that patch's commit — not batched until every
task in `tasks.md` is done. Reasoning: patches already ship one-per-commit
(see `tasks.md`'s own "公共约束"), so tying memo updates to the same
cadence keeps entries fresh and matches the "prune regularly" goal above;
batching to the end risks losing the specifics of early patches by the
time the last one lands.

**Clarified 2026-08-11**: "each patch gets its own commit" means an actual
`git commit` on the working branch right when that patch is done — local
only, no `git push`. Don't wait and bundle multiple patches (or bug fixes
found along the way) into one commit "to be safe" — that's exactly the
mess Hsinlung asked to avoid. Hsinlung reviews and pushes when he's ready;
that's a separate, later, explicit step, not a reason to defer commits.
Validated by the camera-follow episode (full account below under
Collaboration): fix → fix → delete → revert → re-do differently, five
separate steps, each cheap to undo precisely because each was its own
isolated commit. That's *why* the rule matters, not just tidiness.

---

## Collaboration workflow with Hsinlung

- Hsinlung is a beginner/novice at this. This is a **collaborative,
  co-designed** process — not "Hsinlung specs it, Claude executes it".
- Default to asking whenever there's doubt. What counts as "enough doubt
  to ask" depends on the specific conversation — Hsinlung will weigh
  real-world constraints case by case. Example: CLAUDE.md forbids running
  the harness/game by default, but if a real bug genuinely needs a run to
  diagnose or verify, Hsinlung may allow it if asked — don't treat the
  ban as absolute without checking.
- Standard shape of a task, start to finish:
  1. Hsinlung proposes a need.
  2. **Jointly analyze the need together.** This step is mandatory —
     do not jump straight to a plan/report the moment Hsinlung finishes
     describing something. Discuss first.
  3. Draft an initial design.
  4. Iterate and refine the design together.
  5. Write the finalized result into `tasks.md`.
  6. Execute strictly in `tasks.md`'s stated order and requirements.
- Once a task is already fully spec'd in `tasks.md` (steps 1-5 already
  happened, possibly in an earlier session), step 6 doesn't need a fresh
  round of discussion before starting — that discussion already happened
  when it was written down. Low-level implementation gaps the spec
  doesn't cover (a rendering architecture detail, which of several
  reasonable approximations to use) are Claude's call: pick a reasonable
  default, document the reasoning in code comments/roadmap, and flag it
  in the report back — don't stall progress asking about every one.
  Confirmed 2026-08-11 during O-2 (Hsinlung: "没实际问题就一直工作就行
  ... 发现问题再修改即可").
- If a reported bug survives two genuine fix attempts, offering to just
  remove the feature is a legitimate next move, not a cop-out — don't
  keep re-diagnosing the same spot for a third narrower patch on your own
  initiative. Case: a camera-follow-viewfinder feature got two rounds of
  fixes (real root causes each time) and Hsinlung was still unhappy with
  the feel; he asked to delete it outright rather than a third attempt.
  Comply directly — don't argue for one more fix first.
  **How that one actually ended (2026-08-11)**: deleting it broke the
  feature (with the viewfinder still in world coordinates, killing the
  follow logic meant you could drag it to the screen edge and never
  reach the rest of the world), so Hsinlung reverted the deletion. What
  finally worked was neither another parameter tweak nor deletion, but
  **reframing what the thing is**: the viewfinder stopped being a patch
  of world ground and became a screen-space UI rectangle floating on
  the top layer, independent of camera pan/zoom — at which point the
  camera had no reason to follow anything and the logic was deleted for
  free. Lesson: after two failed fixes, the productive move is usually
  to question the object's coordinate system / ownership, not to tune
  the algorithm a third time. Hsinlung specified this reframing himself.

## Running the game (important standing exception)

- CLAUDE.md forbids running the game/harness by default. **2026-08-11
  Hsinlung granted a broad standing exception**: "随便进行任何测试，我以
  效果为准" — he cannot judge whether a render matches intent, and can
  only hand back screenshots. So when a change is visual, drive the real
  app and look at it yourself rather than asking him to describe it.
- Working setup (no project skill for this yet): `python -m http.server
  8080` in the repo root, then Playwright from the npx cache —
  `import { chromium } from
  'file:///C:/Users/Hsinlung/AppData/Local/npm-cache/_npx/<hash>/node_modules/playwright/index.mjs'`.
  Bare `import 'playwright'` fails (not a repo dep, and ESM ignores
  NODE_PATH); the absolute `file://` import is the way in. Chromium is
  already downloaded under `%LOCALAPPDATA%/ms-playwright`.
- **Comparing against the old look**: Hsinlung suggested checking out a
  pre-change commit locally, screenshotting, then returning. This worked
  well and is worth reusing — a detached-HEAD `git checkout <old>` →
  screenshot → `git checkout <branch>` costs almost nothing and settles
  "is this regression or intended?" far faster than reasoning about it.

## Working style Hsinlung asked for during the O series (2026-08-12)

- "你改完继续改 o4 然后继续按顺序完成并提交即可，只有需要我确定的地方停下来即可"
  — once a batch is spec'd in `tasks.md`, run straight through it,
  commit per patch, and only stop for things that genuinely need his
  decision. Don't check in after every sub-step.
- He reviews by looking at the picture, not the code: "我毕竟看不到实物"
  / "我发现问题再修改即可". So the useful report back is *what changed
  visually* and *what he should look at*, not a code walkthrough.
- He spots real bugs from the rendering. Two examples worth remembering
  because both were correct: the camera drift, and "后排 building 标定的
  位置不对（似乎偏高了）" — which turned out to be `BuildingEntity.
  getBounds()` returning depth-as-height anchored at the roofline. When
  he says something looks off, take it literally and go measure.

## The flat-world legacy bug class (O series — now closed)

Pre-O-2 the world was flat: world y *was* screen y, so one number could
silently mean either "how far back" (depth) or "how tall" (height). Real
projection split those into two channels that must never mix (`toScreen`
vs `toScreenLength`). **Every leftover that conflated them surfaced as a
rendering bug** — eight of them across O-2…O-8, including: building bounds
returning depth-as-height; bus-stop geometry as two subtracted world-y
values (which also gave a 0.71 m shelter and a `NaN` that made the far stop
undrawable); `footprint().ry` as a token sliver; the panorama export sizing
its texture in world units; the sky layer drawing its horizon 700 px off
with vertical parallax on top; and the camera storing a world point so
shear leaked vertical input into horizontal drift.

**As of O-8 this class should be exhausted** — `EntityManager.draw()` has no
"skip" branches left and every draw path (entities, NPCs, vehicles, held
props, ground features, sky) goes through `Projection.js`. If a *new*
instance shows up, it's new code, not legacy.

Heuristic to keep: when something looks misplaced **vertically**, first ask
which of the two channels that number is in. And note the general shape —
these sat latent for months because no gate covers rendering (see below).

## Verification: what the gates do and don't cover (2026-08-12)

**Nothing in the gate set executes a draw call.** Every rendering regression
this session — invisible NPCs, blank panorama export, misplaced bounds
boxes, missing proxy methods, a deleted `CAR_SHAPE` — was found by actually
running the app, never by a gate. That's why the standing run-the-game
exception above matters. Procedure is written up as a skill:
`.claude/skills/run-game/SKILL.md`.

**Syntax is now covered** by `node scripts/check-syntax.mjs` (added
2026-08-12; `node --check` over all 167 js/mjs, ~2 s). Run it after any
bulk/scripted edit to `js/` — scripted regex edits are the specific hazard,
twice a replacement swallowed the rest of a line (`draw:` matched but
`drawGround:` didn't) and the five gates stayed green both times.

Subtlety worth remembering: node picks CJS-vs-ESM grammar for a `.js` file
from the nearest `package.json` `type` field — and **this repo's
`package.json` is gitignored**, so a fresh clone has none and `node --check`
silently falls back to CommonJS, where the broken file *passes* (verified:
exit 0 without it, exit 1 with `"type":"module"`). A gate whose correctness
depends on an untracked file is no gate, so `check-syntax.mjs` copies each
source into a temp `.mjs` instead — that extension forces ESM regardless.
Separately, a local `package.json` with `"type":"module"` is still nice to
have (it silences the `MODULE_TYPELESS_PACKAGE_JSON` warnings that clutter
gate output, and is safe since all 167 files are already ESM with zero
`require`/`module.exports`) — but it's local-only and nothing depends on it.

`sth/preview.html` is a full preview harness (rebuilt O-7): it enumerates
props from the live `propTypes()` registry and constructs **real**
`PropEntity`/`BuildingEntity` objects, so it exercises the same
`draw()`/`getBounds()`/`footprint()` the game uses. Clicking through all 32
entries is the fastest smoke test for a rendering change.

## Project state as of 2026-08-12 (end of the O series)

**`tasks.md` is fully executed.** O-1…O-6 all landed, plus four unplanned
follow-ups that came out of Hsinlung's real-run review: O-5b (vehicle
massing from real dimensions), O-7 (camera drift / sky alignment /
`getBounds` sizes / preview rebuild), O-8 (NPC-attached drawing). Branch
`claude/velocity-unification-v1-946h9l`, all local commits, **nothing
pushed** — Hsinlung pushes when he's ready.

`tasks.md` says its own contents can be deleted once every patch is done.
That point has been reached; ask before deleting, since it doubles as his
scratch space.

### Known-open items (none of them blocking, roughly by value)

1. **`TILT_DEG = 20` / `SHEAR = 0.2` are still the provisional O-2 values.**
   Everything is now drawn with real volume, so this is the moment they can
   actually be judged. Changing them costs nothing in code but means
   re-eyeballing every prop, so it's worth doing *before* any art polish.
   Hsinlung has the rebuilt `sth/preview.html` to review with and said he'd
   give style feedback in bulk afterwards.
2. **`drawBusStopBay` is converted but has no call site** — it reads
   `stop.bayW` / `stop.bayD`, which have never existed in
   `scene.json#layout.busStops` (only x/direction/bench). Wiring it back
   means adding that scene data. Same data gap that produced the `NaN`
   far-stop bug.
3. **`EnvironmentQuery.js` radius constants are still raw world pixels** —
   flagged in CLAUDE.md as known debt, never in scope. This is the last
   unconverted unit-system holdout.
4. **Tree bounds are deliberately loose** (`visual.hw/up` sized for the
   maximum jitter, so the yellow box reads bigger than most trees). Correct
   for capture, slightly ugly in the preview; tighten only if it bothers him.
5. **Content gaps Hsinlung draws himself** (from `tasks.md`'s last section,
   not code tasks): `run_front` clip, and the
   `overlay/couple/arm_around_shoulder.json` duet clip.

### Suggested next moves, if he asks

The natural sequence is *tune → review → polish*: settle TILT/SHEAR first
(cheapest to change, invalidates the most downstream judgement), then let
him do the bulk style pass in the preview, then act on that list. Item 2 is
a small self-contained patch that could slot in any time. Item 3 is the only
one that touches behaviour rather than looks, so it deserves its own
discussion round before being written into `tasks.md`.

## Standing permission: add tooling freely (2026-08-12)

Hsinlung: "你如果觉得没问题直接加些你会用的工具也行，以后想加就直接加不用和我
特意说（除非大到进不了 github）". So: **add skills, check scripts, dev
harnesses etc. without asking.** Only flag it if something would be too
large to commit. He doesn't know the vibecoding vocabulary, so when
mentioning a skill/hook/agent, say in one line what it actually is rather
than assuming the term lands.

Existing project tooling (all committed, all under the repo):
- `.claude/skills/run-game/SKILL.md` — how to launch and drive the game
  with Playwright, which hooks exist (`window.__cam()`, key bindings), and
  how to batch-smoke-test `sth/preview.html`. Written because this workflow
  had to be rediscovered from scratch mid-session.
- `scripts/check-syntax.mjs` — the syntax gate described above.

Note `.claude/` is **not** gitignored, so project skills are shared with the
repo — that's intended. Don't confuse it with `~/.claude/`, which is
Hsinlung's personal Claude Code state (session logs, global settings, and
the separate auto-memory directory) and has nothing to do with the project.
