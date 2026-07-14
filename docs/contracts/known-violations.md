# Known Contract Violations

Violations that pre-date the check-invariants.sh script and cannot be
cleaned up in the same pass. Each entry records the file:line, the rule
it breaks, and the migration path.

---

## Rule: no `_extraTags` direct field access in `js/`

### `js/behavior/activities/TalkActivity.js:136-137,163`

```js
136:    this.a._extraTags = aTags.length > 0 ? aTags : null;
137:    this.b._extraTags = bTags.length > 0 ? bTags : null;
...
163:          this.b._extraTags = ['conflict', 'victim'];
```

**Rule broken**: `_extraTags` is a legacy direct field bypassing the `npc.mem(ns).tags` slot system.

**Migration**: Replace with `npc.mem('social').tags` (or a new `'talk'` namespace). The NpcState migration pass (Batch-M3 second half) should migrate these three writes. Until then, the check-invariants gate cannot enforce the `_extraTags` rule without false-positiving on TalkActivity.js.

**Current status**: Rule is documented in movement.md but NOT enforced in check-invariants.sh.
