# Known Contract Violations

Violations that pre-date the check-invariants.mjs script and cannot be
cleaned up in the same pass. Each entry records the file:line, the rule
it breaks, and the migration path.

---

_(none currently — the `_extraTags` entry that lived here was resolved by
W-1: `TalkActivity.js` migrated its three `_extraTags` writes to
`WorldEventLog.emitEvent()`, and check-invariants.mjs Rule 1 now enforces a
zero-allowlist ban. See `docs/roadmap.md` for the batch record.)_
