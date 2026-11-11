# Research: Build Mode Rooms (007)

All decisions below come from reading the current code. No new dependency is added.

## R7-01 Rotate while placing

- **Finding**: `BuildMode.tsx` already calls `useBuild.rotate()` on `R` when nothing is selected, and `BuildGizmo` builds the ghost from `rotation`. The ghost position (`hover`) is only recomputed on pointer move, so after `R` the ghost turns but stays anchored at the old corner, and nothing on screen says `R` works while placing.
- **Decision**: show a "⟳ Rotate `R`" button in the build toolbar whenever `palette` is set (calls `rotate()`), add `R` to the placing hint, and recompute the ghost position from the last pointer point when `rotation` changes, so the item turns in place under the cursor.
- **Alternatives**: mouse wheel to rotate (rejected: the wheel zooms the overview camera); right-click (rejected: right-click deletes since 006).

## R7-02 Edge items of more than 0.5 m (long glass) and a doorway (office door)

- **Finding**: `footprintRect` makes every edge item exactly `CELL` long. `OfficeGrid` already blocks every nav edge under the rect, so it works for any length. `validateLayout` keys "one wall per edge" on the item's start point only.
- **Decision**:
  - Edge length comes from `CATALOG[type].footprint.w` (glass_wall/wall = 1 cell, `long_glass` = 4 cells = 2 m, `office_door` = 2 cells = 1 m).
  - Split "lives on the edge grid" from "blocks movement": add `mount: 'floor' | 'edge' | 'wall'` to `CatalogEntry`. `isEdge()` becomes `mount === 'edge'` (step rule, rect, uniqueness). `OfficeGrid` blocks edges only when `blocks === 'edge'`. `office_door` is `mount: 'edge', blocks: 'none'`, so it takes an edge slot (no wall on top of it) but employees walk through.
  - Edge uniqueness checks every 0.5 m sub-segment covered by the item, not only its start.
- **Alternatives**: drag-to-draw walls of any length (rejected in spec Assumptions); separate `length` field on items (rejected: the catalog already carries the size and layouts stay unchanged).

## R7-03 Meeting table with seats

- **Finding**: seats exist only for desks (`CATALOG.desk.seat`, `seatPoint`, `OfficeGrid.seatOf(deskId)`), and the reachability check in `validateLayout` loops over desks.
- **Decision**:
  - `CATALOG` entries get `seats?: { x, z, facing }[]` (cells, unrotated footprint, `facing` = direction the sitter looks). Desk keeps its single seat; `meeting_table_4` (table 1.5 × 1 m → footprint 3 × 2 cells, 4 seats: 2 per long side) and `meeting_table_8` (3 × 1 m → 6 × 2 cells, 8 seats: 3 per long side + 1 per end).
  - One generic `seatPoints(item)` rotates seat cell centres about the footprint centre. `seatPoint(desk)` delegates to it; a unit test pins it to the old output for all four rotations, so desks do not move.
  - Seat ids: `"<tableId>#<n>"` (n from 0). `OfficeGrid.seatOf(id)` accepts a desk id or a seat id. Parsing splits at the last `#` and requires the table to exist in the layout and `n` to be in range, so an odd item id can never resolve to a wrong seat.
  - Validation: every seat of every desk and table must be walkable and reachable from the main door (the existing desk loop, over all seats).
  - Chairs are drawn by the table component (same `Chair` model), not separate items, so table + chairs move/rotate/delete as one.
- **Alternatives**: chairs as separate items linked to the table (rejected: moving the table would orphan them; spec wants one unit).

## R7-04 Meeting seat vs. own desk (spec Q1 = A)

- **Decision**: a second, independent field on the employee profile, `meetingSeatId: string | null` (optional in the file so old `employee-profiles.json` still loads). `deskId` is untouched, so the desk stays reserved. The auto-assign in `employees.assignDesks` skips anyone whose `meetingSeatId` is set (spec US3 scenario 6: no new desk while in a meeting); once they leave the meeting they get a free desk as today. The scene seats the employee at `meetingSeatId ?? deskId`.
- Build draft keeps a second map `meetingSeating: conversationId → seatId | null`, saved in the same `PUT /api/layout` call and covered by the same undo/redo snapshots.
- Drop rules: on a meeting chair → set `meetingSeatId` (swap if occupied); on own desk → clear `meetingSeatId`; on another desk → existing desk swap and clear `meetingSeatId`.
- Server cleanup (`employees.assignDesks`): a `meetingSeatId` whose table or seat number no longer exists, or that is taken twice, is set to null (same pattern as `deskId`).

## R7-05 Wall art placement

- **Decision**: `painting` (2 cells = 1.0 m wide, 0.7 m tall) and `photo_frame` (1 cell = 0.5 m wide, 0.4 × 0.5 m picture) are `mount: 'wall'`, `blocks: 'none'`. They sit on the 0.5 m edge grid like walls. Rotation encodes both the axis and the side the picture faces: 0 = on an east-west edge facing south, 180 = facing north, 90 = on a north-south edge facing east, 270 = facing west.
- Valid only if every 0.5 m segment under it is covered by `wall`, `glass_wall` or `long_glass` (not `office_door`), **or** by the office's outer wall (perimeter edges except the north glass façade and the main-door span, facing inward). Two frames on the same segment facing the same way are invalid.
- Spec size "about 1.2 m" becomes 1.0 m so the frame snaps to the 0.5 m grid (spec FR-014 updated).
- When a supporting wall is deleted or moved in build mode, the build store drops frames that lost support in the same undo step.
- Rotating a frame (ghost or selected) flips it 180° — same wall, other side — so `R` can never strand it on another axis. A selected frame that would have no wall on the other side (outer shell wall) does not rotate.
- Frames on the east (x = width) or south (z = depth) outer wall move with that wall when the floor is resized, and `resizeBlockers` / `minFloorSize` ignore them (they are not floor items).
- The ghost snaps to the nearest edge and picks the side from which half of the edge the pointer is on.
- Overview (cut-away) camera: solid walls — interior `wall` items and the outer shell — are cut down to 0.45 m, so a frame hung at 1.5 m on them would float in the air. There a frame stands on the top edge of the cut wall instead (centre at 0.45 m + half its height). Frames on glass or long glass keep their 1.5 m height, since glass is never cut down. In first person every frame hangs at 1.5 m. Added during implementation (found when checking screenshots); `PictureFrame low` in `src/web/scene/furniture/Furniture.tsx`, decided per frame from its first segment in `src/web/scene/Office.tsx`.

## R7-06 Uploading a picture (feasibility confirmed)

- **Findings**: the server binds `127.0.0.1`; `/api/*` needs the per-launch Bearer token (`security.ts`); Fastify `bodyLimit` is 2 MB; system data lives in `defaultDataDir()`.
- **Decision**:
  - **Client**: check type (`image/png|jpeg|webp`) and size (≤ 10 MB) of the chosen file; decode it with `createImageBitmap` (rejects non-images); draw it on a canvas, at most 1024 px on its longest side; encode as WebP (JPEG fallback) at quality 0.85. This keeps uploads well under the 2 MB server limit, keeps textures small for the 60 FPS budget, and strips EXIF data (e.g. GPS location) before anything is stored.
  - **Server**: `POST /api/pictures` takes the raw image body (`Content-Type: image/webp|jpeg|png`, added with `addContentTypeParser(..., { parseAs: 'buffer' })`), checks the magic bytes match the type, writes `pictures/<random 16-byte hex>.<ext>` under the data dir with file mode 0600, returns `{ id }`. `GET /api/pictures/:id` serves it with a fixed content type and `Cache-Control: private, max-age=31536000, immutable` (ids are never reused). Id format is checked against `/^[0-9a-f]{32}\.(webp|jpg|png)$/`, which rules out path traversal.
  - **Display**: the client fetches the picture with `fetch` plus the `Authorization: Bearer` header from `getSessionToken()` (the `api()` helper parses JSON, so it cannot return a blob), makes an `ImageBitmap`/object URL and a `THREE.Texture`, cropped to fill with UV offsets (cover fit). A failed fetch (404) falls back to the default picture.
  - **Reference**: `PlacedItem.picture?: string` (optional field, only on frames).
  - **Cleanup**: on every successful `PUT /api/layout` and at server start, delete files in `pictures/` not referenced by the saved layout. Cancelling build mode therefore leaves orphans only until the next save or restart (spec FR-018 reworded to match).
- **Alternatives**: `@fastify/multipart` (rejected: new dependency, not needed for one file); base64 inside the layout JSON (rejected: bloats every layout save and broadcast); making `/api/pictures` public without the token (rejected: Constitution III).

## R7-07 Office chair look

- **Decision**: replace the body of `Chair()` in `Furniture.tsx` with an ergonomic office chair built from the existing `Box`/`Cyl` helpers: five-star base with casters, gas lift, seat, high back, armrests. Colours: the concept palette (`CONCEPT.chairFrame` for frame/base, a fabric tone for the seat and back). The seat height stays at 0.45–0.5 m, so `SEAT_DROP` in `Employee.tsx` keeps working; check visually and adjust only if the robot sinks in.
- No layout change: the `chair` item type stays.

## R7-08 Performance

- New meshes are a handful of primitives per item. A meeting table with 8 chairs is about 9 × the cost of one chair; frames are 2 meshes plus one texture each (≤ 1024 px). SC-006 (8 frames + two 8-seat tables at 60 FPS) is checked with `npm run bench:fps` on a layout seeded with them.
