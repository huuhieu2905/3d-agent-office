# Bug Fix: First person — can't move after standing up from the sofa

- **Slug**: fp-sofa-standup-stuck
- **Fixed**: 2026-11-10
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

`standUp()` now places the user at the nearest indoor point where the 0.2 m body actually fits (`freeAt`), instead of the nearest walkable cell centre, which overlapped the sofa and made `slide()` reject every step.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/web/scene/cameras/fp-motion.ts` | modified | new pure `nearestFree(grid, x, z, maxR, ok)`; fixed stale `RADIUS` comment |
| `src/web/scene/cameras/FirstPerson.tsx` | modified | `standUp()` uses `nearestFree(…, 1.5, indoor)`, falls back to `nearestWalkable` |
| `tests/unit/fp-motion.test.ts` | added test | sofa stand-up regression |

## Diff Highlights

```ts
const p = nearestFree(site, r.x, r.z, 1.5, (x, z) => site.isIndoorAt(x, z))
  ?? site.nearestWalkable(r.x, r.z) ?? { x: camera.position.x, z: camera.position.z };
```

`nearestFree` scans a 5 cm lattice within `maxR`, nearest first, returning the closest point where `ok` and `freeAt` both hold.

## Tests Added or Updated

- `tests/unit/fp-motion.test.ts` › "stands up where the body fits and can walk away at frame-sized steps" — for every sofa seat in `defaultLayout()`, the stand-up point is within 1.5 m, `freeAt` is true, and 20 × 0.035 m `slide()` steps move the user > 0.5 m in at least one direction (the old point moved 0.00 m in all four).

## Local Verification

- `npx vitest run tests/unit/fp-motion.test.ts` → 8 passed
- `npx vitest run tests/unit` → 163 passed, 3 skipped
- `npx tsc --noEmit -p .` → clean
- Manual checks: not run in the browser.

## Deviations from Assessment

None. The indoor constraint is passed as a predicate so the helper stays grid-agnostic.

## Follow-ups

- `fpControl.teleport` (test hook) can also land on a non-free cell centre; not reported, left as is.
