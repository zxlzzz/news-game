# Velocity / Direction Field Consumer Survey

- **date**: 2026-07-13
- **status**: snapshot
- **scope**: `js/`, `sth/`, `scripts/` — all `.js` / `.mjs` files

> Pure inventory; no proposals. Four fields surveyed: `npc.direction`, `npc.speed`, `npc.vy`, `mot.vel`.
>
> **Exclusion policy**: `VehicleEntity`, `CyclistSpawner`, `VehicleStateMachine`, `drawVehicle`, `TrafficManager`, `VehicleSpawner`, `busstop.js`, `drawBusStopBay.js`, `WaitForBusLayer` (busstop-direction only) — these access `.direction` / `.speed` on `VehicleEntity` or `BusStop` config objects, not on `NPC` instances. The field names collide, but the host object class differs; counted separately in the summary table.

---

## 1 · `npc.direction`

| File # Function | (line) | Purpose | Tag |
|-----------------|--------|---------|-----|
| `Npc#draw` | (189) | `this.direction × anim.canonicalDirection` — horizontal skeleton flip passed to renderer | [渲染朝向] |
| `Npc#draw` | (305) | passed as 6th arg to `StickRenderer#draw(x, y, scale, direction, …)` | [渲染朝向] |
| `Npc#update` | (252) | `leashTarget.direction` — non-Motor leash follower copies owner's direction to self.x | [物理积分] |
| `Npc#update` | (280–282) | `this.direction × this.speed × dt` — non-Motor inline dx; bound bounce flip (read then write) | [物理积分] |
| `CigaretteProp#draw` | (29, 41) | x-offset for cigarette tip and smoke particle (left/right of face) | [渲染朝向] |
| `seat#sitDown` | (101) | `npc.direction × canonDir` — determines canonical facing on bench | [判定/门控] |
| `drawBicycle#_leadHand` | (17) | selects lead hand joint `hr` vs `hl` by direction sign | [渲染朝向] |
| `drawBicycle#drawBicycle` | (22, 68) | `d = n.direction` — skeleton / wheel direction parameter | [渲染朝向] |
| `Motor#integratePhysics` | (276) | `leashTarget.direction` — Motor-leash path copies owner direction to follower x | [物理积分] |
| `Motor#integratePhysics` | (290, 295) | `direction × speed × dt` — scalar fallback dx computation | [物理积分] |
| `Motor#integratePhysics` | (292–293) | reads direction before bound-bounce flip (guard: only flip when crossing boundary) | [物理积分] |
| `Motor#integratePhysics` | (343) | progress monitor: `npc.direction = -npc.direction` — stuck NPC reversal (read in negation) | [物理积分] |
| `StuckProbe#tick` | (53) | `dir: n.direction` — debug snapshot JSON field | [审计] |
| `BaseStateMachine#steerRoam` | (321) | `Math.sign(vx) !== npc.direction` → `audit.count(npc, 'dir_mismatch')` | [审计] |
| `BaseStateMachine#steerRoam` | (330) | `desired !== npc.direction && mot.dirCD ≤ 0` — direction flip gate | [判定/门控] |

**BM-bypass note — CyclistSpawner**: `CyclistSpawner` (js/entity/vehicle/CyclistSpawner.js) spawns `NPC`-like cyclist objects with `.direction` but manages them entirely outside `BehaviorManager` (no `installProtection`, no `BehaviorManager.register`). It reads `.direction` at lines 63–64 (cull check) and 76 (lane count). These cyclists do not go through `integratePhysics`; their position update is inline in `VehicleEntity#update`. **Iron-rule: do not touch CyclistSpawner.**

**sth/ note**: `sth/anim-preview/js/app.js` line 832 writes `proxy.direction = d` on a local preview proxy object, not a real NPC. Does not read `npc.direction` from game state.

---

## 2 · `npc.speed`

| File # Function | (line) | Purpose | Tag |
|-----------------|--------|---------|-----|
| `BehaviorManager#register` | (72) | `npc.speed > 0 ? npc.speed : rand(20, 34)` — seeds `npc.walkSpeed` at spawn time | [生成器] |
| `Motor#integratePhysics` | (289) | `npc.speed > 0` — scalar fallback path entry guard | [物理积分] |
| `Motor#integratePhysics` | (290, 295) | `direction × npc.speed × dt` — scalar dx in fallback path | [物理积分] |
| `Motor#integratePhysics` | (316) | `npc.speed === 0` — `speed0_walk` audit count | [审计] |
| `StuckProbe#tick` | (27) | `n.speed > 0 \|\| n.state === 'routing'` — stuck detection entry condition | [判定/门控] |
| `StuckProbe#tick` | (53) | `spd: n.speed \| 0` — debug snapshot field | [审计] |
| `BaseStateMachine#steerRoam` | (321) | `npc.speed > 0` — `dir_mismatch` audit gate | [审计] |
| `Npc#update` | (279–280) | `this.speed > 0` guard; `this.direction × this.speed × dt` — non-Motor inline dx | [物理积分] |

**sth/ note**: `sth/anim-preview/js/app.js` `AnimController#speed` (lines 892, 907, 914) is a playback rate scalar, not `npc.speed`. No game NPC field is accessed.

---

## 3 · `npc.vy`

| File # Function | (line) | Purpose | Tag |
|-----------------|--------|---------|-----|
| `Motor#integratePhysics` | (297) | `tentY = npc.y + npc.vy × dt` — Y-boundary probe | [物理积分] |
| `Motor#integratePhysics` | (299, 301) | bounce clamp: reads `npc.vy` to negate or preserve sign on boundary hit | [物理积分] |
| `Motor#integratePhysics` | (303) | `dy = npc.vy × dt` — actual Y displacement (always executes; see §3 of movement-dataflow.md) | [物理积分] |
| `WalkMode#checkZoneTransition` | (190) | `(npc.vy ?? 0) >= 0` — determines crossing direction (down vs up) for pushWalkMode | [判定/门控] |
| `Npc#update` | (284) | `this.y += this.vy × dt` — non-Motor inline Y integration | [物理积分] |
| `Npc#update` | (285–286) | bounce clamp: reads `this.vy` to negate or preserve sign | [物理积分] |

---

## 4 · `mot.vel`

All reads are in `Motor#integratePhysics` (js/behavior/Motor.js).

| File # Function | (line) | Purpose | Tag |
|-----------------|--------|---------|-----|
| `Motor#integratePhysics` | (284) | `if (wm && mot.vel)` — vel-path entry gate | [物理积分] |
| `Motor#integratePhysics` | (286) | `mot.vel.vx × dt` → `dx` — vx channel, actually consumed | [物理积分] |
| `Motor#integratePhysics` | (287) | `mot.vel.vy × dt` → `dy` — ⚠ dead code: unconditionally overwritten at line 303 by `npc.vy × dt` | [物理积分] |
| `Motor#integratePhysics` | (303) | `if (!mot.vel)` — always true after line 288 clears it; triggers vy channel | [物理积分] |

`mot.vel` has no consumers outside `Motor#integratePhysics`. It is written only by `BaseStateMachine#steerRoam` (line 323) in the walk/run/jog branch.

---

## 5 · BM-Bypass Consumers (铁律不动区)

| Entity | File | Fields accessed | Integration path |
|--------|------|-----------------|-----------------|
| `CyclistSpawner` (cyclist NPCs) | `js/entity/vehicle/CyclistSpawner.js` | `.direction` (cull check, lane count), `.speed` (spawn config) | `VehicleEntity#update` inline; **no BehaviorManager, no integratePhysics** |
| `VehicleEntity` (bus, car) | `js/entity/vehicle/VehicleEntity.js` | `.direction`, `.speed`, `.currentSpeed` | own `update()` inline: `x += direction × currentSpeed × dt` |
| `VehicleStateMachine` | `js/entity/vehicle/VehicleStateMachine.js` | `.direction` | drives `VehicleEntity` state, not NPC |

These entities share field names with NPC but are structurally separate. Modifying their direction/speed semantics has no effect on NPC movement pipeline and vice versa.

---

## 6 · sth/ Preview Toolchain Dependency

| Tool | File | Dependency on surveyed fields |
|------|------|-------------------------------|
| `anim-preview` | `sth/anim-preview/js/app.js` | `proxy.direction` — local preview proxy only; does **not** read live NPC fields |
| `stick-puppet` | `sth/stick-puppet/js/app.js` | `ref_speed` — clip variant parameter (not `npc.speed`); no NPC field access |

**Conclusion**: neither sth/ tool reads `npc.direction`, `npc.speed`, `npc.vy`, or `mot.vel` from live game state. Refactoring these fields does not affect the preview toolchain.

---

## 7 · Summary Table

Field × Tag → consumer count (NPC only; BM-bypass and sth/ excluded from body counts, shown in §5–6)

| Field | [渲染朝向] | [物理积分] | [审计] | [判定/门控] | [生成器] | Total |
|-------|-----------|-----------|--------|------------|---------|-------|
| `npc.direction` | 7 | 5 | 2 | 2 | 0 | **16** |
| `npc.speed` | 0 | 3 | 3 | 1 | 1 | **8** |
| `npc.vy` | 0 | 5 | 0 | 1 | 0 | **6** |
| `mot.vel` | 0 | 4 | 0 | 0 | 0 | **4** |
| **Total** | **7** | **17** | **5** | **4** | **1** | **34** |

> Self-check: raw `grep -rn "\.direction\b" js/` excluding writes and doc-comment lines yields ~50 hits; 32 belong to VehicleEntity/busstop/TrafficManager objects (excluded, §5); 2 are in BaseStateMachine contract-comment lines; remaining 16 map to the table above. `npc.speed` grep yields 11 raw hits; 8 are NPC consumers (3 are vehicle-entity `.speed` or contract-comment lines excluded). `npc.vy` yields 9 raw hits; all 6 NPC reads accounted for (3 are write-only assignments excluded by grep filter). `mot.vel` yields 5 raw hits; 4 are reads (1 is the write `mot.vel = {vx,vy}` excluded).
