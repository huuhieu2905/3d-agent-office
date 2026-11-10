# Bug Assessment: First person — can't move after standing up from the sofa

- **Slug**: fp-sofa-standup-stuck
- **Created**: 2026-11-10
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> Ở chế độ góc nhìn thứ nhất, khi tôi lên ghế sofa để nằm/ngồi sau đó ấn E/W để quay lại thì không di chuyển được tiếp. Hãy điều tra và sửa lại cho tôi

(In first person, after sitting/lying on the sofa and pressing E/W to get up, the player can no longer move.)

## Symptom

After standing up from the sofa (E, W, any move key or a click), WASD no longer moves the camera; the player is frozen next to the sofa. Expected: stand up next to the sofa and walk away normally.

## Reproduction

1. Open the office, switch to first-person mode.
2. Aim at the sofa, press E (sit) or Shift+E (lie).
3. Press E or W to stand up.
4. Press W/A/S/D — the camera does not move.

Reproduced in a unit probe on `defaultLayout()` (sofa-27, rotation 0): the stand-up point for both seats is `(5.625, -4.125)` / `(6.375, -4.125)`, `freeAt()` there is `false`, and repeated 0.05 m `slide()` steps move 0.00 m in all four directions.

## Suspected Code Paths

- `src/web/scene/cameras/FirstPerson.tsx:78` `standUp()` — places the camera at `site.nearestWalkable(r.x, r.z)`, i.e. the centre of the nearest walkable nav cell, with no check that the player's body fits there.
- `src/shared/site-nav.ts:216` `nearestWalkable()` — only checks that the cell itself is walkable; nav cells are `NAV_CELL = 0.25` m (`src/shared/nav-core.ts:9`).
- `src/web/scene/cameras/fp-motion.ts:22` `freeAt()` / `:42` `slide()` — the body is a circle of `RADIUS = 0.2` m; a cell centre next to the sofa has its circle edge in the blocked sofa cell, so it is not "free". `slide()` only accepts a step whose destination is free; at walking speed (2.2 m/s ≈ 0.035 m/frame) no single step gets the circle clear, so every frame's move is rejected.

## Root Cause Hypothesis

`standUp()` drops the player at a cell centre that is walkable but closer than `RADIUS` to the sofa (0.125 m from the cell edge vs. a 0.2 m body radius — the `RADIUS` comment in fp-motion.ts still assumes 0.5 m cells). The player starts inside an "invalid" position, and `slide()` rejects every small per-frame step because each destination still overlaps the blocked cell. Confidence: **high** (reproduced with the default layout).

## Proposed Remediation

**Preferred**: In `standUp()`, place the player at the nearest point where `freeAt(site, x, z)` is true, not merely the nearest walkable cell. Smallest form: a small search around `(r.x, r.z)` over nav-cell centres within ~1.5 m (indoor, `freeAt` true), nearest first; fall back to `nearestWalkable` if none. This can live as a tiny pure helper in `fp-motion.ts` (e.g. `nearestFree(grid, x, z, maxR)`) so it is unit-testable.

**Alternatives**:
- Let `slide()` accept a step that starts from a non-free position as long as the destination cell is walkable/steppable (an "escape" rule). Fixes every stuck case (e.g. teleports) but loosens collision; riskier.
- Shrink `RADIUS` below 0.125 m. One-line, but the body would hug furniture/walls visibly and changes feel everywhere.

**Files likely to change**:
- `src/web/scene/cameras/FirstPerson.tsx` (`standUp`)
- `src/web/scene/cameras/fp-motion.ts` (new helper; fix stale `RADIUS` comment)
- `tests/unit/fp-motion.test.ts`

**Tests to add or update**:
- Unit: for every sofa seat in `defaultLayout()`, the stand-up point is `freeAt` true and repeated 0.035 m `slide()` steps move the player away in at least one direction (ideally the sofa's facing direction).

## Risks & Considerations

- A stand-up point too far from the sofa feels like a teleport; cap the search radius (~1.5 m).
- User-edited layouts can wedge a sofa between other furniture; the fallback must still never put the camera inside a wall.
- Same latent issue could affect any other code that places the FP camera on a cell centre (teleport test hook `fpControl.teleport`); out of scope unless reported.

## Open Questions

- None blocking.
