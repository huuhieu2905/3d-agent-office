# Quickstart: validate 007 Build Mode Rooms

## Prerequisites

- Node ≥ 22, `npm install` done.
- Antigravity App running (or the mock: `tests/e2e/start-with-mock.ts`, used by Playwright).
- Optional clean data folder: `export AGENT_OFFICE_DATA_DIR=$(mktemp -d)`.

## Automated checks

```bash
npm run typecheck
npm test                 # vitest unit/contract + scripts/check-guards.sh
npm run test:e2e         # Playwright, includes the new build specs
npm run bench:fps        # SC-006, seeded layout with 8 frames + two 8-seat tables
```

Expected: all green. New tests to look for:
- `tests/unit/layout-v2.test.ts`: long glass / office door edge-slot rules, frame support and overlap, picture only on frames, meeting-seat reachability, `seatPoint(desk)` unchanged for all 4 rotations.
- `tests/unit/` (seating): meeting seat swap; desk stays reserved; drop on own desk clears the meeting seat.
- `tests/contract/routes-pictures.test.ts`: upload ok (201), wrong magic bytes (400), wrong type (415), over 2 MB (413), bad id (400), missing (404), no token (401), orphan deleted after `PUT /api/layout`.
- `tests/e2e/build-rooms.spec.ts`: scenarios below.

## Manual walkthrough (`npm run dev`, open the printed URL)

1. **Rotate while placing (US1)**: Build → pick Sofa → press `R` twice without moving the mouse → the ghost turns 180° in place → click → the placed sofa matches. Place a second one: it keeps the rotation.
2. **Room (US2)**: pick Long glass wall, place 2 pieces along x and 1–2 along z (`R` to turn), add one Office door in the line. Put a desk inside. Count the placements: a free-standing 4 m × 3 m room needs ≤ 8 (SC-001). Save → succeeds. Remove the door → Save is blocked with "No path from the door to this desk". Exit build mode: an employee seated inside walks through the door.
3. **Meeting room (US3)**: place Meeting table (8) inside the room → 8 office chairs around it. Drag two employees onto two chairs; drop a third on an occupied chair → swap. Save, reload the page → still seated there; their desks are still reserved (no one else took them). Drag one back onto their own desk → back at the desk, chair free. Click a seated employee → chat opens.
4. **Chairs (US4)**: every chair, including desk chairs from the default layout, shows the office-chair model; seated robots sit on it, not in it.
5. **Pictures (US5)**: pick Photo frame → it only turns green on a wall/glass edge. Place it → select → Change picture → pick a phone photo (≤ 10 MB) → it shows, cropped. Pick a `.txt` → "Choose a PNG, JPEG or WebP image". Save, reload → picture still there. Check `<dataDir>/pictures/` has one file. Press `R` with the frame selected → it flips to the other side of the same wall (not deleted). Hang one on the inner east outer wall, grow and shrink the office → it moves with the wall. Delete the frame, save → the file is gone.
6. **Privacy (SC-007)**: with the browser devtools Network tab open during step 5, every request goes to `127.0.0.1`.
7. **Old data (SC-005)**: start with a data folder from before 007 → the office loads the same, only the chairs look new.
