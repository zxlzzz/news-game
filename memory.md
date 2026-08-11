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
