---
description: "Task list for 008: working office doors and free picture placement"
---

# Tasks: Working Office Doors and Free Picture Placement

**Input**: Design documents in `specs/008-doors-free-frames/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: no TDD requested. Test tasks cover the new logic (DoorBook, employee door handling, frame rules) plus one e2e per story, as listed in quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- Paths from the repo root; all new on-screen text in English (FR-017)

---

## Phase 1: Setup

- [X] T001 Create branch `008-doors-free-frames` from `007-build-mode-rooms` (or from `main` once 007 is merged) with git

---

## Phase 2: Foundational

None: doors (US1/US2) and frames (US3/US4) touch different files. The only shared file is `tests/e2e/build-rooms.spec.ts` (append-only).

---

## Phase 3: User Story 1 — Employees open and close office doors (Priority: P1) 🎯 MVP

**Goal**: doors closed at rest; employees stop, open, pass; doors close 2 s after the doorway is clear; a closed door never makes a seat unreachable (FR-001..003, FR-006..008, research R8-01, R8-02, R8-04, data-model §2).

**Independent Test**: quickstart.md manual step 1; `tests/unit/doors.test.ts` and `tests/unit/employee-doors.test.ts` green.

- [X] T002 [US1] Create `src/web/scene/doors.ts` with a pure `DoorBook` built from an `OfficeLayout`: one entry per `office_door` item with its floor segment (from `footprintRect`), `openness` (0–1), `holders: Set<string>`, `userOpen`, `clearSince`. API: `request(id, who)`, `release(id, who)` (also clears `userOpen`), `toggleUser(id)`, `isOpen(id)` (= openness ≥ 0.8), `openness(id)`, `doorBetween(a: Cell, b: Cell, grid)` (office door whose line the step from nav cell `a` to `b` crosses: convert both cells to floor metres with `grid.toWorld` + half the floor size — brains may walk on the office+park `SiteGrid`, whose cells are offset from the office — and test whether the segment between the two centres crosses the door segment extended by 0.05 m at each end; no edge keys), `doorNear(x, z, r)`, `blocksMove(x0, z0, x1, z1)` (move crosses the line of a door that is not open, segment ± 0.2 m), `tick(dt, now, people: Iterable<{x, z}>)` — target open when holders, `userOpen`, or anyone within the doorway (segment ± 0.4 m); otherwise close once the doorway has been clear for 2 s; openness moves at 1/0.6 per second. World vs floor coordinates: accept floor metres (x, z from the north-west corner) and convert in callers
- [X] T003 [P] [US1] Unit tests `tests/unit/doors.test.ts`: starts closed; `request` → `isOpen` within 0.6 s of ticks; stays open while held; closes 2 s after release with a clear doorway, not before; never closes while a person stands in the doorway; `toggleUser` opens/closes; `release` clears `userOpen`; `blocksMove` true across a closed door, false across an open one and along the wall
- [X] T004 [US1] In `src/web/scene/employee-behaviors.ts`: add optional `doors?: DoorBook` to `BrainOptions`; in `followPath`, before moving, scan `path[max(0,i-1)..i+3]` for consecutive cells that cross an office door (`doors.doorBetween`); if one is found and the employee is within 0.6 m of that door: `request` it, and while `!isOpen` do not move (face the door, keep `blockedFor` unchanged so no skip/replan); after the crossing pair is behind (`i` past it) call `release`. Release every held door when the mode changes (sit, leave, new path)
- [X] T005 [P] [US1] Unit tests `tests/unit/employee-doors.test.ts` (pattern of `tests/unit/walkers.test.ts`): a small layout with a room closed by long glass and one office door, a brain whose seat is inside; tick at 60 Hz: the brain never crosses the door line while `!isOpen`; it reaches the seat; the extra time vs the same walk with the door forced open is ≤ 1 s (SC-002); after it sits, the door is closed within 2.5 s; repeat the round trip (seat → outside the room → seat) 10 times and assert every passage opened the door before crossing and closed it after (SC-001)
- [X] T006 [US1] In `src/web/scene/OfficeScene.tsx`: create `const doors = useMemo(() => new DoorBook(layout), [layout])` next to `SpotBook`; tick it every frame (`useFrame` in a small component) with employee positions from `positions` (world → floor: + width/2, + depth/2) and the first-person camera position when in first person; pass `doors` to every `Employee` (→ `EmployeeBrain` options in `src/web/scene/Employee.tsx`) and to `Office`
- [X] T007 [US1] In `src/web/scene/furniture/Furniture.tsx` `OfficeDoor`: take `openness?: () => number`; rotate the glass leaf group on its hinge from closed (in the wall line) to 90° open in `useFrame` (no React state); in `src/web/scene/Office.tsx` pass `openness={() => doors.openness(item.id)}`
- [X] T008 [US1] Add e2e "employees open office doors" to `tests/e2e/build-rooms.spec.ts`: save a layout (via `PUT /api/layout`) with a closed room (long glass + one office door) around a desk east of the desk rows, seat an employee there through `seating`, set `window.__agentOffice.setBreakInterval(3000)`, then poll `window.__agentOffice.brains()` and a new test hook `doors()` (add to `src/web/scene/interaction/TestHooks.tsx` and `tests/e2e/test-hooks.d.ts`: `{ id, openness }[]`; pass the `DoorBook` from `src/web/scene/OfficeScene.tsx` into `<TestHooks doors={doors} />`) until the door has been seen open and then closed again; assert the employee never had a position on the far side of the door line while openness < 0.8

**Checkpoint**: doors work for employees; nothing else changed.

---

## Phase 4: User Story 2 — Open and close doors yourself in first person (Priority: P2)

**Goal**: `E` toggles a door; a closed door blocks the player (FR-004..006, research R8-03, contracts/ui.md U8-2).

**Independent Test**: quickstart.md manual step 2.

- [X] T009 [US2] In `src/web/scene/cameras/fp-motion.ts`: add an optional `blocked?: (x0: number, z0: number, x1: number, z1: number) => boolean` to `slide` (and `freeAt` callers) — a move along an axis is refused when `blocked` returns true for it; extend `tests/unit/fp-motion.test.ts` with one case
- [X] T010 [US2] In `src/web/scene/interaction/interactables.ts`: add `InteractableType` `'office_door'` (aim height 1.1 m) built from `office_door` items; `buildInteractables` takes an optional `doorOpen(id) => boolean` for the action text "Open door" / "Close door"; update `tests/unit/interactables.test.ts`
- [X] T011 [US2] In `src/web/scene/cameras/FirstPerson.tsx`: accept `doors: DoorBook`; pass `(x0,z0,x1,z1) => doors.blocksMove(...)` (world → floor) to `slide`; on `E` with an `office_door` aim call `doors.toggleUser(id)`; refresh the hint when the door state changes; pass `doors` from `src/web/scene/OfficeScene.tsx`
- [X] T012 [US2] Add e2e "first person: E opens and closes an office door" to `tests/e2e/build-rooms.spec.ts` (pattern of `tests/e2e/first-person.spec.ts`): layout with an office door; switch to first person (`V`), `teleportPlayer` in front of the door facing it; assert `player().aim.action` is "Open door"; press `E`; `doors()` openness reaches ≥ 0.8; walk through (hold `W`) and assert the player is past the line; press `E` from the far side → closes; walking back is blocked (position stays on the same side)

**Checkpoint**: US1 + US2 done.

---

## Phase 5: User Story 3 — Pictures on the glass façade behind the wall screen (Priority: P2)

**Goal**: frames on the inside of the north façade, not behind a wall screen (FR-009, FR-010, research R8-05, data-model §1 rule 3).

**Independent Test**: quickstart.md manual step 3.

- [X] T013 [US3] In `src/shared/layout-validation.ts` `frameSupported`: accept the north façade (z = 0) for frames with rotation 0 (facing south); in `validateLayout` add rule "Frame on the north façade: not behind a wall screen whose footprint starts within 1 m of z = 0 and overlaps the frame's x-range" with reason `Hidden behind the wall screen` (flag, never drop)
- [X] T014 [P] [US3] Extend `tests/unit/layout-v2.test.ts` "007 frames": north façade facing south valid, facing north invalid; behind the default wall screen (x 6.5–8, z 0.5) invalid with that reason; next to it valid; moving the screen in front of a frame flags the frame, `dropUnsupportedFrames` keeps it
- [X] T015 [US3] Add e2e "painting on the glass façade next to the wall screen" to `tests/e2e/build-rooms.spec.ts`: place a painting at floor point (4.5, 0.15) (just inside the north façade, west of the screen), expect `rotation: 0`, `pos.z: 0`; save; reload; it is still there

---

## Phase 6: User Story 4 — Place pictures anywhere on the wall surface (Priority: P2)

**Goal**: 5 cm along the wall, stored height, interval coverage, 2-D overlap; pointer, drag, keys and Height input (FR-011..015, research R8-06, data-model §1 rules 1, 2, 4, 5, 6, contracts/ui.md U8-3).

**Independent Test**: quickstart.md manual step 4; SC-006 by a 007 layout test.

- [X] T016 [US4] In `src/shared/domain.ts` add `height?: number` to `PlacedItem` (frames only, centre above the floor, metres, absent = 1.5); in `src/shared/schemas.ts` add `height: z.number().min(0).max(3).optional()` to `placedItemSchema`; export `FRAME_HEIGHT_DEFAULT = 1.5` and the frame picture heights (painting 0.7, photo 0.5) from `src/shared/catalog.ts`
- [X] T017 [US4] In `src/shared/layout-validation.ts`: frames — across-wall coordinate on 0.5 m, along-wall on 0.05 m (`Position must be in 5 cm steps`); replace segment support with interval coverage on the frame's line (merge intervals of wall / glass / long glass items on that line, plus the inward-facing outer wall incl. the north façade, minus the main door span; office doors never count) for `[along, along + width]`; height on 0.05 m within `[0.2 + h/2, 2.6 − h/2]` (`The picture is too high or too low`); overlap only when same line, same rotation, along-intervals and height-intervals both overlap; `height` on a non-frame → `Only picture frames have a height`; keep `dropUnsupportedFrames` / `frameSupported` signatures
- [X] T018 [P] [US4] Extend `tests/unit/layout-v2.test.ts`: a frame at along 2.15 m on glass is valid, at 2.13 invalid; a frame spanning a short + long glass piece in one line valid, with a 0.5 m gap invalid; heights 0.2+h/2 and 2.6−h/2 valid, outside invalid; two frames same side same along but heights 0.8 m apart valid, 0.3 m apart invalid; a 007 frame without `height` validates and resizes as before (SC-006)
- [X] T019 [US4] In `src/web/scene/furniture/Furniture.tsx` `PictureFrame`: take `height` (default 1.5) and use it instead of `FRAME_Y`; in `src/web/scene/Office.tsx` pass `item.height`, and decide `low` by whether glass / long glass covers the frame's middle point on its line (replace the `edgeSegments(item)[0]` lookup)
- [X] T020 [US4] In `src/web/state/build.ts`: add `frameHeight` (starts 1.5) and `setFrameHeight(id, h)` (one undo step; also updates `frameHeight`); `place` of a frame stores `height: frameHeight`
- [X] T021 [US4] In `src/web/scene/BuildGizmo.tsx` `placementFor`: frames keep line and side as in 007 but along = `snap(pointer − width/2, 0.05)` (Shift 0.5); ghost carries `height: frameHeight`
- [X] T022 [US4] In `src/web/scene/interaction/DragLayer.tsx` `itemPos`: a wall-mounted item keeps its across-wall coordinate (its line) and only the along-wall coordinate follows the pointer (0.05 m, Shift 0.5)
- [X] T023 [US4] In `src/web/ui/build/BuildMode.tsx`: arrow keys for a selected frame — `←/→` along its wall (x for rotation 0/180, z for 90/270; 0.05, Shift 0.5) through `moveIsValid`; `↑/↓` change height through `setFrameHeight` only if the result validates; a "Height (m)" number input (`data-testid="frame-height-input"`, step 0.05) in the selected-frame row, invalid values shown with the allowed range in `role="alert"`; update the hint text for frames
- [X] T024 [US4] Add e2e "free frame placement" to `tests/e2e/build-rooms.spec.ts`: hang a photo frame on the west outer wall, select it, press `ArrowRight` ×3 and `ArrowUp` ×8, assert `pos` along changed by 0.15 and `height` 1.9 via `arrange().items`; type 1.2 in `frame-height-input`; save; reload; assert the saved item has the new position and `height: 1.2`

**Checkpoint**: all stories done.

---

## Phase 7: Polish & Cross-Cutting

- [X] T025 Add 6 office doors (in long-glass room lines) to the "rooms" scenario in `src/web/bench/bench-layout.ts`; run `npm run bench:fps -- --scenario rooms` on the reference Mac with the real GPU, second run ≥ 60 FPS (SC-007)
- [X] T026 [P] Update `assets/LICENSES.md` only if a new model or picture was added (the swinging leaf reuses the 007 door model — expected no change)
- [X] T027 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (real GPU, ANGLE/Metal); walk quickstart.md steps 1–5

---

## Dependencies & Execution Order

- T001 → everything.
- **US1** (T002–T008): T002 → T003, T004 → T005, T006 → T007 → T008.
- **US2** (T009–T012): needs T002 and T006.
- **US3** (T013–T015): independent of US1/US2.
- **US4** (T016–T024): after US3 (same validation file); T016 → T017 → T018; T019–T023 after T017; T024 last.
- **Polish** after the stories shipped.

Same-file conflicts: `src/shared/layout-validation.ts` (T013, T017), `tests/unit/layout-v2.test.ts` (T014, T018), `src/web/scene/OfficeScene.tsx` (T006, T011), `src/web/scene/Office.tsx` (T007, T019), `src/web/scene/furniture/Furniture.tsx` (T007, T019), `tests/e2e/build-rooms.spec.ts` (T008, T012, T015, T024), `src/web/scene/interaction/TestHooks.tsx` (T008).

## Parallel Examples

- After T002: T003 ∥ T004. After T004: T005 ∥ T006.
- Doors and frames in parallel: US1/US2 ∥ US3 → US4 (different files except the e2e spec).

## Implementation Strategy

1. **MVP**: T001 + US1 — doors that employees open and close.
2. US2 — first-person doors.
3. US3 — façade frames (small).
4. US4 — free placement.
5. Polish (T025–T027) before calling 008 done.
