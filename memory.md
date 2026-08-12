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
Validated same day: a camera-follow feature got fixed twice, still wasn't
good enough, Hsinlung asked to delete it outright (own commit), then asked
to revert that deletion (`git revert`, another own commit) — all three
steps were cheap and clean specifically because each was its own isolated
commit. This is *why* the per-patch-commit rule matters, not just tidiness.

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

## The recurring bug class in this codebase (O series)

Pre-O-2 the world was flat: world y *was* screen y, so a single number
could silently mean either "how far back" (depth) or "how tall"
(height). Real projection split those into two channels that must never
mix (`toScreen` vs `toScreenLength`). **Every leftover that conflated
them surfaced as a rendering bug**, and they kept coming:

- `BuildingEntity.getBounds()` returned `bDepth` as its height.
- Bus stop geometry expressed vertical extent as two absolute world-y
  values subtracted — which also produced a 0.71 m tall shelter and a
  `NaN` (undefined `stop.bayD`) that made the far stop undrawable.
- `drawBusStopSign` used Y-band constants as the pole top.
- `footprint().ry` was `Math.max(3, N)` everywhere — a token sliver,
  because flat sheets have no depth.
- `_exportImage` sized its texture in world units after draw calls had
  already switched to screen px.

Heuristic for next time: when something in this repo looks misplaced
*vertically*, first ask which of the two channels the number is in.
Also — several of these were latent for months because no static gate
covers rendering; the five gates all passed the whole time. Visual bugs
here need a real run, which is why the standing exception above matters.

## Verification gap worth knowing (2026-08-12)

The five static gates verify **data/behaviour invariants**, not rendering and
not even JS syntax reliably:

- `node --check <file>.js` checks with **CommonJS** grammar. A file with a
  genuinely unbalanced `registerProp('x', { ... });` passed `node --check`
  cleanly while the browser refused to parse it. Don't trust it for ESM.
  The reliable check is `new vm.SourceTextModule(src)` per file
  (`node --experimental-vm-modules`), which caught it across 149 files.
- Nothing in the gate set executes a draw call, so every rendering
  regression this session (invisible NPCs, blank export, misplaced bounds
  boxes, missing proxy methods, deleted `CAR_SHAPE`) was found by actually
  running the app, never by the gates.

Practical rule: after any **bulk/scripted edit** to js/, run the ESM parse
check and load the app once. Scripted regex edits are the specific hazard —
twice now a replacement swallowed the rest of a line (`draw:` matched but
`drawGround:` didn't), and both times the gates stayed green.

`sth/preview.html` is now a full preview harness (rebuilt O-7): it enumerates
props from the live `propTypes()` registry and constructs **real**
`PropEntity`/`BuildingEntity` objects, so it exercises the same
`draw()`/`getBounds()`/`footprint()` the game uses. Driving it through all 32
entries is the fastest way to smoke-test a rendering change.
