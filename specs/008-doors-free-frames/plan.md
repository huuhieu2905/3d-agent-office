# Implementation Plan: Working Office Doors and Free Picture Placement

**Branch**: `008-doors-free-frames` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-doors-free-frames/spec.md`

## Summary

Two independent additions on top of 007, all in the browser and the shared layout rules; no new route.

1. **Doors (US1, US2)**: a pure `DoorBook` (per-scene, like `SpotBook`) holds each office door's openness, who asked to pass, the user's toggle and when the doorway became clear. Employees look ahead on their path; before crossing an office-door edge they request it and wait (≤ 1 s) until it is open, then release it. The door closes 2 s after the doorway is clear. In first person, `E` toggles a door (new interactable) and a closed door blocks movement (`slide` gets a crossing test). The A* grid and the "every seat reachable" rule stay unchanged, so a closed door never makes a room unreachable. The leaf swings in `useFrame`.
2. **Frames (US3, US4)**: frames may hang on the north glass façade (facing in), except behind a wall screen. Position along the wall uses 5 cm steps; a new optional `height` (default 1.5 m) is stored per frame. Support becomes interval coverage on the wall line, overlap becomes 2-D. Pointer, drag, arrow keys (`←/→` along, `↑/↓` height) and a Height input place the frame.

## Technical Context

**Language/Version**: TypeScript 6, Node ≥ 22

**Primary Dependencies**: React 19, @react-three/fiber 9, three 0.187, zustand 5, zod 4, Fastify 5 — no new dependency

**Storage**: `layout.json` gains optional `height` on frame items; door state is memory only

**Testing**: vitest (unit), Playwright e2e on the real GPU, `npm run bench:fps`

**Target Platform**: Chromium on macOS / Linux; local server on 127.0.0.1

**Project Type**: local web app (Fastify + React/three.js)

**Performance Goals**: 60 FPS on the reference Mac with 6 animated office doors and 8 frames (SC-007)

**Constraints**: 007 layouts load unchanged (frames at 1.5 m); a closed door never makes a seat unreachable; no per-frame React re-render for doors

**Scale/Scope**: 1 new module (`doors.ts`) + tests; edits in ~10 files

## Constitution Check

| Principle | Check | Result |
|---|---|---|
| I. App is the source of truth | Door state and frame height are 3D-experience data; employee status untouched. | ✅ |
| II. Isolated adapter | No adapter change. | ✅ |
| III. Local-first, privacy | No new route or outbound connection; `height` validated by zod and the shared rules at `PUT /api/layout`. | ✅ |
| IV. Usable increments; tied to a goal | Serves G1 (inspiration): rooms that behave like real rooms and a wall the user composes freely. Doors (US1→US2) and frames (US3/US4) ship independently. | ✅ |
| V. Experience + performance | Door animation in `useFrame` only; bench scenario extended (SC-007). One click still opens a chat (doors never block a click). | ✅ |
| VI. macOS + Linux | Browser-only code, no OS branch. | ✅ |
| Quality gates | Gates 1–3 unaffected; gate 4 by bench + e2e on the real GPU. | ✅ |

No violations. **Re-check after design**: unchanged, ✅.

## Project Structure

### Documentation (this feature)

```text
specs/008-doors-free-frames/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domain.ts              PlacedItem.height
│   ├── schemas.ts             height in placedItemSchema
│   └── layout-validation.ts   frame rules: 5 cm along, height range, interval coverage, north façade + screen rule, 2-D overlap
└── web/
    ├── scene/
    │   ├── doors.ts                       NEW DoorBook (pure)
    │   ├── employee-behaviors.ts          look-ahead request / wait / release at office doors
    │   ├── Employee.tsx, OfficeScene.tsx  create and pass the DoorBook; tick it each frame with positions
    │   ├── Office.tsx                     OfficeDoor reads openness; frame height; "low" check by glass coverage
    │   ├── furniture/Furniture.tsx        swinging leaf; PictureFrame height prop
    │   ├── cameras/fp-motion.ts           optional crossing test in slide()
    │   ├── cameras/FirstPerson.tsx        pass doors.blocksMove; E toggles a door
    │   ├── interaction/interactables.ts   office_door interactable
    │   ├── interaction/DragLayer.tsx      frames slide along their wall
    │   ├── interaction/TestHooks.tsx      doors() test hook (DoorBook passed from OfficeScene)
    │   └── BuildGizmo.tsx                 5 cm along-wall ghost, last-used height
    ├── state/build.ts                     frameHeight, setFrameHeight / moveFrame
    ├── ui/build/BuildMode.tsx             ←/→ ↑/↓ for frames, Height input
    └── bench/bench-layout.ts              6 office doors in the "rooms" scenario
tests/unit/doors.test.ts, tests/unit/employee-doors.test.ts (NEW), tests/unit/layout-v2.test.ts, tests/e2e/build-rooms.spec.ts, tests/e2e/test-hooks.d.ts
```

**Structure Decision**: same single repo; one new pure module for doors.

## Delivery order

By priority: 1. US1 doors for employees (P1) → 2. US2 first person → 3. US3 façade → 4. US4 free placement. Doors and frames touch different files, so US3/US4 can also run in parallel with US1/US2.

## Complexity Tracking

No constitution violations.
