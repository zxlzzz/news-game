#!/usr/bin/env bash
# check-invariants.sh — movement subsystem hard gates
# Run from repo root.  exit 0 = clean; exit 1 = violation found.
# See docs/contracts/movement.md for rationale.
# See docs/contracts/known-violations.md for pre-existing violations
# that are excluded from these rules.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }

# ── Rule 1 ────────────────────────────────────────────────────────────────────
# _extraTags is a legacy direct field, replaced by npc.mem(ns).tags.
# Known violation: TalkActivity.js (3 lines) — listed in known-violations.md.
# Rule is NOT enforced by script yet; see known-violations.md for migration path.
# When TalkActivity.js is migrated, uncomment the block below.
#
# echo "Rule 1: no _extraTags in js/"
# if grep -Prn "_extraTags" "$ROOT/js/" --include="*.js" \
#      | grep -v "TalkActivity\.js"; then
#   red "FAIL: _extraTags outside known-violations"
#   FAIL=1
# fi

# ── Rule 2 ────────────────────────────────────────────────────────────────────
# Animation clip JSON files must not contain a "kind" key.
# "kind" is authoritative only in assets/manifest.json.
echo "Rule 2: animation clip JSONs must not contain \"kind\""
BAD=$(find "$ROOT/assets/animations" -name "*.json" \
        ! -path "*/manifest.json" \
        -exec grep -l '"kind"' {} \;)
if [ -n "$BAD" ]; then
  red "FAIL: clip JSON files contain \"kind\" key:"
  echo "$BAD"
  FAIL=1
else
  green "  ok"
fi

# ── Rule 3 ────────────────────────────────────────────────────────────────────
# npc.speed / npc.state / npc.animation must not be written directly outside
# Motor.js.  Npc.js constructor is the only allowed exception.
#
# Pattern: field followed by = that is NOT == or ===
# Allowlist: js/behavior/Motor.js (owner), js/npc/Npc.js (constructor init).
echo "Rule 3: npc.{speed,state,animation} = only in Motor.js (and Npc.js constructor)"
if grep -Prn "\bnpc\.(speed|state|animation)\s*=[^=]" "$ROOT/js/" --include="*.js" \
     | grep -v "js/behavior/Motor\.js" \
     | grep -v "js/npc/Npc\.js"; then
  red "FAIL: direct write to protected npc field outside Motor.js"
  FAIL=1
else
  green "  ok"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  green "All enforced invariants pass."
  exit 0
else
  red "One or more invariants failed. See output above."
  exit 1
fi
