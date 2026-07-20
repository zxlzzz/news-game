/**
 * AffordanceDefaults — per-propType default affordance descriptors.
 *
 * Keyed by propType string (matching PropEntity.propType).
 * PropEntity picks up these defaults unless the entity's own `affordances`
 * field (from scene.json) overrides them.
 *
 * Fields:
 *   kind         — semantic label for logs/tags/debug only
 *   dx/dy        — offset from entity origin (number or [min,max] range)
 *   ring         — [r0,r1] annular sample around entity instead of dx/dy
 *   arrivalState — setState target on arrival (null = no state change)
 *   dur          — [min,max] seconds at destination
 *   weight       — base selection weight (relative)
 *   slots        — max simultaneous occupants (null = unlimited / handled externally)
 *   facing       — 'entity'|'away'|null
 *   use          — task router: 'visit'|'bench'|'smart_prop'
 *   weightMul    — optional (npc, env) => multiplier hook for persona weighting
 */

export const AffordanceDefaults = {

  tree: {
    kind:         'tree_shade',
    ring:         [14, 22],
    arrivalState: 'loiter',
    dur:          [8, 20],
    weight:       0.30,
    slots:        2,
    facing:       null,
    use:          'visit',
  },

  fountain: {
    kind:         'fountain_edge',
    ring:         [60, 85],
    arrivalState: 'loiter',
    dur:          [6, 18],
    weight:       0.30,
    slots:        3,
    facing:       'entity',
    use:          'visit',
  },

  bench: {
    kind:         'rest',
    dx:           0,
    dy:           0,
    arrivalState: 'sit_bench',
    dur:          [15, 45],
    weight:       0.55,
    slots:        null,    // occupied via seat module
    facing:       null,
    use:          'bench',
  },

  vending: {
    kind:         'use_vending',
    dx:           0,
    dy:           0,
    arrivalState: null,
    dur:          [4, 10],
    weight:       0.50,
    slots:        null,    // handled by SmartProp slot system
    facing:       'entity',
    use:          'smart_prop',
  },

  trash: {
    kind:         'use_trash',
    dx:           0,
    dy:           0,
    arrivalState: null,
    dur:          [3, 7],
    weight:       0.45,
    slots:        null,
    facing:       'entity',
    use:          'smart_prop',
  },

  // stall: {
  //   kind:         'stall_browse',
  //   dx:           0, dy: 0,
  //   arrivalState: 'stand',
  //   dur:          [8, 20],
  //   weight:       0.35,
  //   slots:        null,   // existing slot system
  //   facing:       'entity',
  //   use:          'smart_prop',
  // },

  // 'chess-table': {
  //   kind:         'watch_chess',
  //   dx:           0, dy: 0,
  //   arrivalState: 'chess_onlooker',
  //   dur:          [15, 40],
  //   weight:       0.30,
  //   slots:        null,   // existing slot system
  //   facing:       'entity',
  //   use:          'smart_prop',
  // },
};
