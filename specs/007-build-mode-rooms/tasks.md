---
description: "Task list for 007: build mode rooms — doors, long glass, wall art, meeting rooms, rotate while placing"
---

# Tasks: Build Mode Rooms

**Input**: Design documents in `specs/007-build-mode-rooms/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/local-api.md, contracts/ui-build.md, quickstart.md

**Tests**: The spec does not ask for TDD. Test tasks cover new logic only (validation rules, seat geometry, seating rules, picture routes) plus one e2e per story, as listed in quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- Paths are from the repo root (one web project: `src/shared`, `src/server`, `src/web`, `tests/`)
- All new on-screen text is English (FR-023). New 3D models are original primitives in the "Soft Studio · Sài Gòn" style (FR-022).

---

## Phase 1: Setup

- [X] T001 Create and switch to branch `007-build-mode-rooms` from the current branch (git); commit nothing yet

---

## Phase 2: Foundational (blocks US2, US3, US5)

**Purpose**: catalog fields and item types that several stories read. US1 and US4 do not need this phase.

- [X] T002 Append item types `long_glass`, `office_door`, `meeting_table_4`, `meeting_table_8`, `painting`, `photo_frame` to `ITEM_TYPES` in `src/shared/domain.ts`; add optional `picture?: string` to `PlacedItem` (frames only, data-model §3)
- [X] T003 In `src/shared/catalog.ts`: add `mount: 'floor' | 'edge' | 'wall'` to `CatalogEntry` and set it for every existing type (wall, glass_wall → `edge`; all others → `floor`); change `isEdge(type)` to `CATALOG[type].mount === 'edge'`; add `isWallMounted(type)` = `mount === 'wall'`; make `footprintRect` return a segment of `footprint.w × CELL` for `edge` and `wall` mounts (east from `pos` for rotation 0/180, south for 90/270) instead of a fixed `CELL`
- [X] T004 In `src/shared/catalog.ts`, add catalog entries for the six new types exactly as in the data-model §2 table (labels "Long glass wall", "Office door", "Meeting table (4)", "Meeting table (8)", "Painting", "Photo frame"; footprints 4×1, 2×1, 3×2, 6×2, 2×1, 1×1; mount/blocks as listed); leave `seats` for US3 (T020)
- [X] T005 In `src/shared/nav-core.ts` `OfficeGrid`: block nav edges only when `CATALOG[type].blocks === 'edge'` (not for every `isEdge` item), so `office_door` takes an edge slot but stays walkable
- [X] T006 In `src/shared/schemas.ts` `placedItemSchema`: add `picture: z.string().regex(/^[0-9a-f]{32}\.(webp|jpg|png)$/).optional()`
- [X] T007 Run `npm run typecheck` and `npm test`; fix every `Record<ItemType, …>` / switch that now misses the new types (e.g. `furnitureFor` stays `Partial`, `Office.tsx`, `interactables.ts`) with no behaviour change for old types

**Checkpoint**: existing tests green, old layouts unchanged (SC-005).

---

## Phase 3: User Story 1 — Rotate an item before placing it (Priority: P1) 🎯 MVP

**Goal**: visible Rotate while placing; ghost turns in place; placed item keeps the ghost rotation (FR-001..003, contracts/ui-build.md U7-1).

**Independent Test**: quickstart.md step 1.

- [X] T008 [US1] In `src/web/ui/build/BuildMode.tsx`: when `s.palette` is set and nothing is selected, show a `⟳ Rotate <kbd>R</kbd>` button with `data-testid="build-rotate-placing"` that calls `s.rotate()`, and a hint "Click the floor to place it · `R` rotates"; add `data-testid={\`palette-${t}\`}` to each palette button
- [X] T009 [US1] In `src/web/scene/BuildGizmo.tsx`: keep the last pointer floor point in a ref and, when `rotation` changes, recompute `hover` with `posAt` for the new rotation so the ghost turns in place under the cursor (no mouse move needed)
- [X] T010 [US1] Extend `arrange()` in `src/web/scene/interaction/TestHooks.tsx` (and its type in `tests/e2e/test-hooks.d.ts`) to also return `items: PlacedItem[]` (the draft, or the saved layout outside build mode); then add `tests/e2e/build-rooms.spec.ts` with test "rotate while placing": pick Sofa, press `R` twice, click the floor, assert the new item's `rotation` is 180 via `arrange().items`; place a second one and assert it is also 180

**Checkpoint**: US1 shippable on its own.

---

## Phase 4: User Story 2 — Department room with long glass and an office door (Priority: P1)

**Goal**: 2 m glass and 1 m door on the edge grid; walk-through door; reachability rule unchanged (FR-004..007, data-model §3 rules 1 and 5).

**Independent Test**: quickstart.md step 2.

- [X] T011 [US2] In `src/shared/layout-validation.ts`: replace the "one per edge" check with a per-sub-segment check — for each `isEdge` item, every 0.5 m segment it covers (key `n:x,z` / `w:x,z`) may be claimed once; reason `"Another wall is already here"`
- [X] T012 [P] [US2] Add unit tests in `tests/unit/layout-v2.test.ts`: long glass covers 4 segments; long glass overlapping a short glass on any segment is invalid; office door in a glass line is valid and walkable; a room closed with glass and no door makes its desk report `"No path from the door to this desk"`; same room with an office door is valid
- [X] T013 [P] [US2] In `src/web/scene/furniture/Furniture.tsx`: add `OfficeDoor` (1 m frame + door leaf standing open, no animation, concept colours, full height not cut away like glass); `EdgePanel` already takes `length`. Record the office door and long glass as original work in `assets/LICENSES.md` (Constitution V)
- [X] T014 [US2] In `src/web/scene/Office.tsx`: render `wall` / `glass_wall` / `long_glass` with `EdgePanel` using `length = CATALOG[type].footprint.w * CELL` and `type` mapped `long_glass → 'glass_wall'`; render `office_door` with `OfficeDoor` rotated to the edge axis
- [X] T015 [US2] In `src/web/scene/BuildGizmo.tsx`: snap edge items with their real length (`posAt` subtracts half the rotated segment length, not a fixed 0.25), and draw the ghost for the new edge types
- [X] T016 [US2] In `src/web/scene/interaction/DragLayer.tsx` `moveIsValid`: skip all `isEdge` items (not only `wall`/`glass_wall`) in the solid-overlap check, and keep edge items on the 0.5 m step when dragged
- [X] T017 [US2] Add e2e "room with long glass and office door" to `tests/e2e/build-rooms.spec.ts`: enclose a corner with long glass + one office door around a desk, save succeeds; delete the door, save button disabled with the path warning

**Checkpoint**: US1 + US2 usable; departments can be built.

---

## Phase 5: User Story 4 — Office chairs replace the rattan chairs (Priority: P2)

**Goal**: one ergonomic chair model everywhere (FR-013). Done before US3 because meeting tables draw this chair.

**Independent Test**: quickstart.md step 4.

- [X] T018 [P] [US4] Replace the body of `Chair()` in `src/web/scene/furniture/Furniture.tsx` with an office chair from `Box`/`Cyl`: five-star base with 5 casters, gas lift, seat at 0.45–0.5 m, high back facing +z like the old back (z ≈ 0.22), two armrests; materials from `CONCEPT` (`chairFrame` for frame/base, a fabric tone for seat/back); update the doc comment
- [X] T019 [US4] Check a seated robot in `npm run dev` (desk chairs from the default layout); adjust `SEAT_DROP` / forward offset in `src/web/scene/Employee.tsx` only if it sinks into or floats above the new seat; record the chair model as original work in `assets/LICENSES.md`

---

## Phase 6: User Story 3 — Meeting room and seating employees around the table (Priority: P2)

**Goal**: meeting tables with seats; employees dragged onto seats keep their desk reserved (Q1 = A) (FR-008..012, data-model §2, §4–6, contracts L7-1, L7-4, U7-4).

**Independent Test**: quickstart.md step 3.

### Shared geometry and validation

- [X] T020 [US3] In `src/shared/catalog.ts`: replace `seat?: {x,z}` with `seats?: { x: number; z: number; facing: Rotation }[]` (desk: one seat at the old position); add seats for `meeting_table_4` (2 outside each long side) and `meeting_table_8` (3 per long side, 1 per end), cells relative to the unrotated footprint; add `seatPoints(item)` returning `{ id, x, z, facing }[]` in metres by rotating seat cell centres about the footprint centre (seat id = item id for a desk, `"<itemId>#<n>"` for tables); make `seatPoint(desk)` return `seatPoints(desk)[0]`
- [X] T021 [P] [US3] Unit test in `tests/unit/layout-v2.test.ts`: `seatPoint(desk)` returns the same values as before for rotations 0/90/180/270 (hard-code the old outputs); `seatPoints` of `meeting_table_8` returns 8 distinct points outside the table rect for every rotation
- [X] T022 [US3] In `src/shared/nav-core.ts`: `seatOf(id)` accepts a desk id or a seat id `"<tableId>#<n>"` (split at the last `#`; the table must exist and `n` must be in range, else `null`); keep returning a `Cell`
- [X] T023 [US3] In `src/shared/layout-validation.ts`: the reachability loop covers every seat of every item with `seats` (desks and meeting tables); reasons for tables: `"A seat of this table is blocked"` / `"No path from the door to this table"`; meeting tables count as solid (`blocks: 'cell'`) in the overlap check

### Data and server

- [X] T024 [US3] In `src/shared/domain.ts` add `meetingSeatId?: string | null` to `EmployeeProfile` and `meetingSeatId: string | null` to `Employee`; in `src/shared/schemas.ts` add `meetingSeatId: z.string().max(100).nullable().optional()` to `employeeProfileSchema` and `meetingSeating: z.record(ID, ID.nullable()).optional()` to the `{ layout, seating }` branch of `layoutPutSchema`
- [X] T025 [US3] In `src/server/services/employee-profiles.ts`: add `setMeetingSeats(map: Record<string, string | null>)` (same shape as `setSeats`: entries in the map win; anyone else holding a claimed seat is cleared); `get()` treats a missing `meetingSeatId` as `null`
- [X] T026 [US3] In `src/server/http/routes/layout.ts` `PUT /api/layout`: validate `meetingSeating` — key is a known conversation, value is `null` or `"<id of a meeting_table_4|8 in this layout>#<n>"` with `0 ≤ n < seats.length`, no seat used twice → else `422 INVALID_SEATING` with `conversationIds`; save with `profiles.setMeetingSeats`; return `{ layout, seating, meetingSeating }` (contracts L7-1)
- [X] T027 [US3] In `src/server/services/employees.ts`: include `meetingSeatId` in each `Employee`; in `assignDesks` clear `meetingSeatId` when its table is gone, `n` is out of range, or the seat is taken twice (same pattern as `deskId`), and skip auto-assigning a free desk to any employee whose `meetingSeatId` is non-null (spec US3 scenario 6; a reserved `deskId` stays as is); in `src/server/http/routes/conversations.ts` delete route also clear `meetingSeatId`
- [X] T028 [P] [US3] Contract test `tests/contract/routes-meeting-seating.test.ts` (Fastify `inject`, pattern of `tests/contract/routes-delete.test.ts`): save with a valid meeting seat → 200 and the employee snapshot shows `meetingSeatId` and keeps `deskId`; an employee with no desk put on a meeting seat is not given a desk by the next refresh even when desks are free; duplicate seat → 422; seat `#8` on an 8-seat table → 422; body without `meetingSeating` behaves as before

### Client

- [X] T029 [US3] In `src/web/state/build.ts`: add `meetingSeating: Seating` to the state and to undo/redo snapshots; `assignMeetingSeat(conversationId, seatId, current)` swaps with the occupant; `assignSeat(...)` also sets `meetingSeating[conversationId] = null`; deleting a meeting table clears `meetingSeating` entries pointing at it; `begin`/`end` reset it; export `effectiveMeetingSeats(current, meetingSeating)`
- [X] T030 [P] [US3] Unit test `tests/unit/build-seating.test.ts`: drop on a free seat; drop on an occupied seat swaps; desk stays reserved while in a meeting; drop on own desk clears the meeting seat; drop on another desk swaps desks and clears the meeting seat; undo restores both maps
- [X] T031 [US3] In `src/web/scene/interaction/DragLayer.tsx`: add `seatAt(layout, p)` returning the nearest meeting seat id within 0.4 m of the pointer (checked before `deskAt`); in preview set `{ kind: 'employee', seatId?, deskId?, occupied }`; on commit call `assignMeetingSeat` for a seat, `assignSeat` for a desk
- [X] T032 [US3] In `src/web/scene/BuildGizmo.tsx`: highlight the target seat (same green/amber hint as desks) when `drag.seatId` is set
- [X] T033 [US3] In `src/web/ui/build/BuildMode.tsx` `save()`: send `meetingSeating: s.meetingSeating` with the layout
- [X] T034 [US3] In `src/web/scene/OfficeScene.tsx` and `src/web/scene/Employee.tsx`: overlay `build.meetingSeating` like `build.seating`; the employee's seat is `grid.seatOf(meetingSeatId ?? deskId)`; seated facing comes from the seat's `facing`; the desk-occupant map stays keyed by `deskId` so reserved desks show as taken; the `onStage` subagent filter and the `lobbySlot` counter use `meetingSeatId ?? deskId` so a deskless employee or subagent in a meeting is shown and seated
- [X] T035 [P] [US3] In `src/web/scene/furniture/Furniture.tsx`: add `MeetingTable({ seats })` — table top + legs sized to the footprint (1.5 × 1 m / 3 × 1 m) and one `Chair` per seat at its `seatPoints` offset, turned to face the table; register both table types in `src/web/scene/Office.tsx`; record in `assets/LICENSES.md`
- [X] T036 [US3] Add e2e "meeting room seating" to `tests/e2e/build-rooms.spec.ts`: place Meeting table (8), drag two employees onto two seats, drop a third on an occupied seat (swap), save, reload, assert seats via the arrange/test hooks and that their `deskId` is unchanged; click a seated employee → chat opens. First extend `arrange()` in `src/web/scene/interaction/TestHooks.tsx` and `tests/e2e/test-hooks.d.ts` to also return `meetingSeating`, and assert seats through it

**Checkpoint**: meeting rooms work; old desk seating unchanged.

---

## Phase 7: User Story 5 — Pictures and photos with your own image (Priority: P3)

**Goal**: frames on walls; local upload; default picture fallback; cleanup (FR-014..019, data-model §3 rules 2–4, §7, contracts L7-1..L7-3, U7-3).

**Independent Test**: quickstart.md steps 5–6.

### Placement

- [X] T037 [US5] In `src/shared/layout-validation.ts`: frames (`isWallMounted`) must stay on the 0.5 m step; every covered segment must hold a `wall` / `glass_wall` / `long_glass`, or be an inward-facing shell edge (west x=0 facing east, east x=width facing west, south z=depth facing north; never the north glass façade or the main-door span) — reason `"A picture must hang on a wall"`; two frames on the same segment facing the same way — `"Another picture is already here"`; `picture` on a non-frame — `"Only picture frames can show a picture"`. Facing: rotation 0 → south, 90 → east, 180 → north, 270 → west
- [X] T038 [P] [US5] Unit tests in `tests/unit/layout-v2.test.ts` for T037: on glass ok, on the floor invalid, on an office door invalid, on the inner west shell wall ok, on the north façade invalid, two frames same side invalid, opposite sides ok, `picture` on a sofa invalid
- [X] T039 [US5] In `src/web/state/build.ts`: after every layout edit (`apply`, `move`, `removeSelected`, `rotateSelected`), remove frames that no longer pass the support rule (export a pure `dropUnsupportedFrames(layout)` from `src/shared/layout-validation.ts`) in the same undo step. `rotateSelected` on a frame adds 180° (other side of the same wall), and does nothing for a frame on an outer shell wall. `resizeFloor` shifts frames on the east (x = width) / south (z = depth) outer wall with that wall; exclude `mount: 'wall'` items from `resizeBlockers` and `minFloorSize` in `src/shared/layout-validation.ts`. Unit-test both in `tests/unit/layout-v2.test.ts` (rotate keeps the frame, resize grow/shrink keeps it on the wall)
- [X] T040 [US5] In `src/web/scene/BuildGizmo.tsx`: for `mount: 'wall'` palette items snap the ghost to the nearest 0.5 m edge and choose the facing from which side of the edge the pointer is on; `R` adds 180° (flips the facing, same wall)

### Upload and display

- [X] T041 [US5] Create `src/server/http/routes/pictures.ts`: `POST /api/pictures` with content-type parsers for `image/webp`, `image/jpeg`, `image/png` (`parseAs: 'buffer'`, app `bodyLimit` 2 MB); check magic bytes match the type (WebP `RIFF....WEBP`, JPEG `FF D8 FF`, PNG `89 50 4E 47`) else `400 BAD_REQUEST 'The file is not a supported image'`; write `<dataDir>/pictures/<randomBytes(16) hex>.<webp|jpg|png>` with mode 0600 (`mkdir` recursive); reply `201 { id }`. `GET /api/pictures/:id`: id must match `^[0-9a-f]{32}\.(webp|jpg|png)$` else 400; 404 if missing; else bytes with content type from the extension, `Cache-Control: private, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`. Register in `src/server/http/routes/index.ts`
- [X] T042 [US5] Add `prunePictures(dataDir, layout)` (in `src/server/http/routes/pictures.ts` or a small helper beside it): delete files in `<dataDir>/pictures/` whose name is not a `picture` of any layout item; call it after a successful `PUT /api/layout` in `src/server/http/routes/layout.ts` and once at start in `src/server/services/index.ts` (after the layout loads; errors logged, never fatal)
- [X] T043 [P] [US5] Contract test `tests/contract/routes-pictures.test.ts`: upload ok → 201 and file exists with mode 0600; wrong magic bytes → 400; `text/plain` → 415; > 2 MB → 413; no token → 401; GET bad id (`../x`) → 400; GET missing → 404; after `PUT /api/layout` without the picture the file is deleted
- [X] T044 [US5] Create `src/web/ui/build/picture.ts`: `preparePicture(file)` — reject types other than PNG/JPEG/WebP ("Choose a PNG, JPEG or WebP image") and files > 10 MB ("The image is larger than 10 MB"); `createImageBitmap` (failure → "Could not read this image"); draw on a canvas at ≤ 1024 px longest side; `toBlob('image/webp', 0.85)` with JPEG fallback; `uploadPicture(blob)` posts raw bytes via the existing `api` client (`body: blob` plus the image `content-type` header; the JSON reply `{ id }` parses fine) and returns the id; `loadPictureTexture(id)` uses plain `fetch` with `Authorization: Bearer ${getSessionToken()}` from `src/web/api/client.ts` (`api()` parses JSON, so it cannot return a blob), builds a `THREE.Texture` (sRGB) and returns `null` on 404
- [X] T045 [US5] In `src/web/ui/build/BuildMode.tsx`: for a selected frame show `Change picture` (`data-testid="frame-change-picture"`, hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`) and `Reset picture` (`data-testid="frame-reset-picture"`, only when `picture` is set); while uploading show "Uploading…" disabled; errors in `role="alert"`; on success set `picture` on the draft item through the store (one undo step)
- [X] T046 [P] [US5] In `src/web/scene/furniture/Furniture.tsx`: add `PictureFrame({ kind, picture })` — thin frame (concept colours) + a plane at a fixed hanging height (centre ≈ 1.5 m), offset 2 cm from the wall on its facing side, with a plain frame back (concept colours) visible from the other side of glass walls; texture from `loadPictureTexture` cropped to fill (cover fit via `texture.repeat`/`offset`), default picture when `picture` is absent or fails; dispose textures on change/unmount. Add two original default pictures (generated in code or small files under `src/web/assets/`) and record them in `assets/LICENSES.md`; render both frame types in `src/web/scene/Office.tsx`
- [X] T047 [US5] Add e2e "hang a photo and upload" to `tests/e2e/build-rooms.spec.ts`: place a Photo frame on a glass wall, set a small PNG via `setInputFiles`, save, reload, assert the item has a `picture`; upload a `.txt` → alert "Choose a PNG, JPEG or WebP image"; assert every request host is `127.0.0.1` (SC-007)

**Checkpoint**: all five stories done.

---

## Phase 8: Polish & Cross-Cutting

- [X] T048 Add 8 frames and two `meeting_table_8` to the bench layout in `src/web/bench/bench-layout.ts`; since the bench has no server pictures, give `PictureFrame` a bench-only path that uses a generated 1024 px canvas texture per frame (same size as a real upload). Run `npm run bench:fps` on the reference Mac with the real GPU (Chromium ANGLE/Metal, not SwiftShader), take the result from the second run onwards, and confirm ≥ 60 FPS (SC-006, constitution quality gate 4)
- [X] T049 [P] Update `tests/e2e/build.spec.ts` / `tests/e2e/build-drag.spec.ts` if the new palette order or `seat` → `seats` change broke selectors or expectations
- [X] T050 Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (Chromium on the real GPU, ANGLE/Metal, not SwiftShader — constitution quality gate 4); walk through quickstart.md steps 1–7 including SC-005 with a pre-007 data folder

---

## Dependencies & Execution Order

- **Setup (T001)** → everything.
- **Foundational (T002–T007)** → US2, US3, US5. US1 and US4 can start right after T001.
- **US1** (T008–T010): independent.
- **US2** (T011–T017): needs Foundational.
- **US4** (T018–T019): independent; must finish before T035 (meeting table draws `Chair`).
- **US3** (T020–T036): needs Foundational and US4. Inside: T020 → T021–T023; T024 → T025 → T026–T027 → T028; T029 → T030–T034; T035 after T020.
- **US5** (T037–T047): needs Foundational; uses `long_glass` from US2 only in tests. Inside: T037 → T038–T040; T041 → T042–T043; T044 → T045; T046 after T044.
- **Polish** (T048–T050): after the stories you ship.

Same-file conflicts (do not run together): `src/shared/catalog.ts` (T003, T004, T020), `src/shared/layout-validation.ts` (T011, T023, T037, T039), `tests/unit/layout-v2.test.ts` (T012, T021, T038, T039), `src/web/scene/interaction/TestHooks.tsx` (T010, T036), `src/web/state/build.ts` (T029, T039, T045), `src/web/scene/BuildGizmo.tsx` (T009, T015, T032, T040), `src/web/ui/build/BuildMode.tsx` (T008, T033, T045), `src/web/scene/furniture/Furniture.tsx` (T013, T018, T035, T046), `tests/e2e/build-rooms.spec.ts` (T010, T017, T036, T047).

## Parallel Examples

- After T001: T008 (US1) ∥ T018 (US4) ∥ T002 (Foundational).
- US2: T012 (tests) ∥ T013 (door model) after T011.
- US3: T021 ∥ T028 ∥ T030 ∥ T035 once their prerequisites are done.
- US5: T038 ∥ T043 ∥ T046.

## Implementation Strategy

1. **MVP**: T001 + US1 (T008–T010). Small, ships alone, fixes the most visible friction.
2. **Increment 2**: Foundational + US2 → departments.
3. **Increment 3**: US4 → US3 → meeting rooms with office chairs.
4. **Increment 4**: US5 → wall art and photo upload.
5. Polish after each increment you ship (at least T050); T048 before calling the feature done.

---

## Phase 9: Convergence

- [X] T051 Document (or remove) the cut-away placement of frames on solid walls — `PictureFrame low` in `src/web/scene/furniture/Furniture.tsx` and `glassSegments` in `src/web/scene/Office.tsx` stand a frame on the top edge of a cut-down wall in the overview camera; record this decision in `specs/007-build-mode-rooms/research.md` R7-05 and `specs/007-build-mode-rooms/contracts/ui-build.md` U7-3 per plan: US5 frames design (unrequested)
