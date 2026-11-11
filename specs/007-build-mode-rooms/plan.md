# Implementation Plan: Build Mode Rooms

**Branch**: `007-build-mode-rooms` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-build-mode-rooms/spec.md`

## Summary

Extend build mode with six new item types, a seat model for meeting tables, a new chair model and local picture upload. Everything builds on the existing layout v2, catalog, nav grid and seating code, without a new file format version or a new dependency.

1. **Rotate while placing (US1)**: `R` already rotates the ghost. Add a visible Rotate button while an item is picked, mention `R` in the hint, and re-anchor the ghost under the cursor when rotation changes.
2. **Rooms (US2)**: `long_glass` (2 m) and `office_door` (1 m) are edge items. Edge length comes from the catalog footprint. A new `mount` field separates "sits on the edge grid" from "blocks movement", so the door takes an edge slot but stays walkable. Edge uniqueness is checked per 0.5 m sub-segment.
3. **Meeting rooms (US3)**: `meeting_table_4` / `meeting_table_8` carry `seats[]` in the catalog, and one generic `seatPoints()` replaces the desk-only rule. A seat id is `tableId#n`. Profiles get an optional `meetingSeatId` next to `deskId`, so the desk stays reserved (Q1 = A). The scene seats an employee at `meetingSeatId ?? deskId`.
4. **Office chairs (US4)**: replace the body of `Chair()` with an ergonomic chair built from the existing primitives. The item type is unchanged.
5. **Wall art (US5)**: `painting` / `photo_frame` hang on wall/glass edges or inner shell walls. Rotation encodes the side they face. The browser resizes and re-encodes the chosen image (≤ 1024 px, no EXIF). `POST /api/pictures` stores it in `<dataDir>/pictures/` and `GET /api/pictures/:id` serves it, both behind the session token. Unreferenced pictures are deleted on layout save and at server start.

## Technical Context

**Language/Version**: TypeScript 6, Node ≥ 22

**Primary Dependencies**: React 19, @react-three/fiber 9, @react-three/drei 10, three 0.187, zustand 5, zod 4, Fastify 5, @fastify/static. No new dependency (no multipart library: the upload is a raw body, research R7-06).

**Storage**: `layout.json` (optional `picture` on items), `employee-profiles.json` (optional `meetingSeatId`) via the existing `JsonStore`; new folder `<dataDir>/pictures/` for image files

**Testing**: vitest (unit + contract with Fastify `inject`), Playwright e2e with the mock App, `scripts/check-guards.sh`, `npm run bench:fps`

**Target Platform**: Chromium-based browser on macOS and Linux (reference CachyOS); local server on 127.0.0.1

**Project Type**: web app: local Fastify server + React/three.js client in one repo

**Performance Goals**: keep 60 FPS on the reference Mac with 8 frames with pictures and two 8-seat meeting tables (SC-006). Textures ≤ 1024 px; no per-frame work added.

**Constraints**: layouts and profiles from before 007 load unchanged; uploads ≤ 2 MB on the wire (existing `bodyLimit`), ≤ 10 MB original file; pictures never leave the machine

**Scale/Scope**: 6 new item types, 2 new routes, about 12 source files touched (catalog, domain, schemas, layout-validation, nav-core, Furniture, BuildGizmo, BuildMode, DragLayer, build state, layout route, profiles/employees services) plus 1 new route file and 1 small picture helper

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. App is the single source of truth | Meeting seats and pictures are 3D-experience data, not copies of App data. Seated employees keep showing their real status (FR-011). | ✅ |
| II. Isolated App adapter | No adapter, RPC or version-list change. | ✅ |
| III. Local-first, security, privacy | No new outbound connection. Picture routes sit under `/api/` (token + Host/Origin checks). Ids are validated against a strict pattern (no path traversal). Magic bytes are checked. Files are mode 0600. EXIF (e.g. GPS) is stripped by re-encoding before upload. zod validates `picture` and `meetingSeating` at the trust boundary. | ✅ |
| IV. Usable increments | Serves goal **G1 — Inspiration** in `.specify/assessments/3d-agent-office/problem.md`: the user shapes their own office (departments, meeting rooms, their own photos on the walls), which makes it feel like *their* team's place and gives a reason to open it daily (M1, M2). Delivered US1 → US2 → US4 → US3 → US5; each ships alone; US5 (pictures) is last and optional. | ✅ |
| V. Experience and performance budget | Office stays central. New models are original primitives in the "Soft Studio · Sài Gòn" style, recorded in `assets/LICENSES.md`. FPS is checked with `bench:fps` (SC-006). Opening a chat still takes one click on a seated employee. | ✅ |
| VI. macOS + Linux | Only browser and Node standard APIs (`createImageBitmap`, canvas, `fs`). No OS-specific branch. | ✅ |
| Quality gates | Adapter gates not affected. New contract tests cover the picture routes; e2e covers the build flows; `bench:fps` covers performance. | ✅ |

No violations, so Complexity Tracking stays empty.

**Re-check after design**: unchanged, ✅. The design adds two local routes and one data folder, all inside Principle III's local-only scope.

## Project Structure

### Documentation (this feature)

```text
specs/007-build-mode-rooms/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── local-api.md
│   └── ui-build.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domain.ts             new ITEM_TYPES, PlacedItem.picture, Employee/Profile.meetingSeatId
│   ├── schemas.ts            picture pattern, meetingSeating in layoutPutSchema, profile meetingSeatId
│   ├── catalog.ts            mount field, edge length from footprint, seats[], seatPoints(), frame facing
│   ├── layout-validation.ts  per-segment edge slots, frame support/overlap, all seats reachable
│   └── nav-core.ts           block edges only for blocks==='edge'; seatOf(desk id | table#n)
├── server/
│   ├── http/routes/layout.ts     meetingSeating validation + save; picture GC after save
│   ├── http/routes/pictures.ts   NEW: POST/GET /api/pictures
│   ├── http/routes/index.ts      register pictures routes
│   ├── http/routes/conversations.ts  clear meetingSeatId on delete
│   ├── services/employee-profiles.ts setMeetingSeats(), meetingSeatId
│   ├── services/employees.ts     expose meetingSeatId; clean up stale meeting seats
│   └── main.ts (or services/index.ts) picture GC at start
└── web/
    ├── state/build.ts            meetingSeating snapshot, assignMeetingSeat, dropUnsupportedFrames
    ├── ui/build/BuildMode.tsx    Rotate while placing, frame picture buttons, save meetingSeating
    ├── ui/build/picture.ts       NEW: validate + resize + re-encode + upload; fetch as texture
    ├── scene/BuildGizmo.tsx      ghost re-anchor on rotate; edge/wall snapping for new types
    ├── scene/interaction/DragLayer.tsx  drop employee on meeting seats
    ├── scene/interaction/TestHooks.tsx  arrange() also returns items and meetingSeating (e2e)
    ├── bench/bench-layout.ts     8 frames + two 8-seat tables for the FPS bench
    ├── scene/furniture/Furniture.tsx    OfficeChair, MeetingTable, LongGlass/OfficeDoor panels, PictureFrame
    ├── scene/Office.tsx          render new types (EdgePanel length from catalog)
    └── scene/Employee.tsx / OfficeScene.tsx  seat = meetingSeatId ?? deskId, facing from seat
assets/LICENSES.md            entries for the new original models and default pictures
tests/
├── unit/layout-v2.test.ts    new rules + seatPoint regression
├── unit/build-seating.test.ts NEW
├── contract/routes-pictures.test.ts NEW
└── e2e/build-rooms.spec.ts   NEW
```

**Structure Decision**: same single repo (`src/shared`, `src/server`, `src/web`, `tests/`). The only new files are a pictures route, a client picture helper and tests.

## Delivery order

1. US1 Rotate while placing (smallest, unblocks the rest)
2. US2 Long glass + office door (catalog `mount`, edge length, validation, nav)
3. US4 Office chair (visual only; needed by meeting tables)
4. US3 Meeting tables + meeting seats (catalog seats, profile field, drag/drop, scene)
5. US5 Frames + picture upload

## Complexity Tracking

No constitution violations.
