# Data Model: Build Mode Rooms (007)

All changes are additive. Layout stays `schemaVersion: 2`; profiles stay `schemaVersion: 1`. Files written before 007 load unchanged (spec FR-021, SC-005).

## 1. Item types (`src/shared/domain.ts` `ITEM_TYPES`)

New values appended (placeable): `long_glass`, `office_door`, `meeting_table_4`, `meeting_table_8`, `painting`, `photo_frame`.

## 2. Catalog entry (`src/shared/catalog.ts`)

```ts
interface CatalogEntry {
  type: ItemType;
  label: string;                         // English UI label
  footprint: { w: number; d: number };   // cells (0.5 m), unrotated; edge/wall items: w = length in cells
  mount: 'floor' | 'edge' | 'wall';      // NEW. edge = on the 0.5 m edge grid, takes the edge slot; wall = hangs on an edge
  blocks: 'cell' | 'edge' | 'none';
  seats?: { x: number; z: number }[];  // NEW, replaces `seat`; cells, unrotated, may be fractional.
  // Implementation note: no `facing` field — a seated employee already faces the blocked cell next to the seat.
  // Table seats sit 0.375 m outside the table edge so each lands in the middle of a free 0.25 m nav cell.
}
```

| type | label | footprint (cells) | mount | blocks | seats |
|---|---|---|---|---|---|
| desk | Desk | 3 × 2 | floor | cell | 1 (unchanged position) |
| chair | Chair | 1 × 1 | floor | none | — |
| wall | Wall | 1 × 1 | edge | edge | — |
| glass_wall | Glass wall | 1 × 1 | edge | edge | — |
| **long_glass** | Long glass wall | 4 × 1 (2 m) | edge | edge | — |
| **office_door** | Office door | 2 × 1 (1 m) | edge | none | — |
| **meeting_table_4** | Meeting table (4) | 3 × 2 | floor | cell | 4: two outside each long side |
| **meeting_table_8** | Meeting table (8) | 6 × 2 | floor | cell | 8: three per long side, one per end |
| **painting** | Painting | 2 × 1 (1 m) | wall | none | — |
| **photo_frame** | Photo frame | 1 × 1 | wall | none | — |
| plant, water_cooler, sofa, wall_screen | unchanged | | floor | unchanged | — |
| door (shell only) | Door | 2 × 1 | floor | none | — |

Derived helpers:
- `isEdge(type)` = `mount === 'edge'` (0.5 m step rule, zero-width rect, edge-slot uniqueness).
- `footprintRect` for `edge` and `wall` mounts: segment of `footprint.w × CELL`, running east from `pos` (rotation 0/180) or south (90/270).
- `seatPoints(item)` → `{ id, x, z, facing }[]` in metres; seat id is the item id for a desk, `"<itemId>#<n>"` for meeting tables. `seatPoint(desk)` = `seatPoints(desk)[0]`.

## 3. Placed item (`PlacedItem`, layout v2)

```ts
interface PlacedItem {
  id: string;
  type: ItemType;
  pos: { x: number; z: number };
  rotation: Rotation;
  picture?: string;   // NEW, frames only: id of an uploaded picture; absent = default picture
}
```

Zod (`placedItemSchema`): `picture: z.string().regex(/^[0-9a-f]{32}\.(webp|jpg|png)$/).optional()`.

### Validation rules added to `validateLayout`

1. Edge items (`mount: 'edge'`): no two may cover the same 0.5 m segment (checked per sub-segment).
2. Frames (`mount: 'wall'`): every covered segment must hold a `wall` / `glass_wall` / `long_glass`, or be an inward-facing outer wall of the office shell (not the north glass façade, not the main-door span). Reason: `"A picture must hang on a wall"`.
3. Frames: no two on the same segment facing the same side. Reason: `"Another picture is already here"`.
4. `picture` only on `painting` / `photo_frame`. Reason: `"Only picture frames can show a picture"`.
5. Reachability: the existing desk loop becomes "every seat of every desk and meeting table is walkable and reachable from the main door". Reasons stay `"The desk seat is blocked"` / `"No path from the door to this desk"`, with "seat"/"table" wording for meeting tables.

Facing for frames: rotation 0 → faces south (+z), 90 → faces east (+x), 180 → faces north, 270 → faces west. Placing on an east-west edge uses 0/180, on a north-south edge 90/270. Rotating a frame (ghost or selected) adds 180° (flips the side, same wall); a selected frame on an outer shell wall does not rotate.

Resize: frames on the east (x = width) or south (z = depth) outer wall are shifted with that wall on resize and are excluded from `resizeBlockers` / `minFloorSize`.

## 4. Employee profile (`employee-profiles.json`)

```ts
interface EmployeeProfile {
  appearance: AppearanceId;
  deskId: string | null;            // unchanged; stays reserved while in a meeting
  meetingSeatId?: string | null;    // NEW, optional: "<tableId>#<n>"
  preferredModel?: PreferredModel | null;
  lastSeenAt: ISODateTime;
}
```

Rules:
- At most one employee per `meetingSeatId` (swap on conflict, like desks).
- Server cleanup in `employees.assignDesks`: if the table is gone, the seat number is out of range, or the seat is taken twice, set `meetingSeatId` to null.
- Auto-assign: an employee with a non-null `meetingSeatId` is never given a free desk; their existing `deskId` (if any) stays reserved.
- Deleting a conversation (`conversations.ts` delete route) also clears `meetingSeatId`.

## 5. Employee (wire type)

`Employee.meetingSeatId: string | null` added next to `deskId`. The scene uses `meetingSeatId ?? deskId` as the seat (`OfficeGrid.seatOf(id)` accepts both kinds of id).

## 6. Build draft state (`src/web/state/build.ts`)

```ts
interface Snapshot { layout: OfficeLayout; seating: Seating; meetingSeating: Seating }  // meetingSeating NEW
```

- `meetingSeating`: conversationId → seat id or null; merged over the served values like `seating`.
- `assignMeetingSeat(conversationId, seatId, current)` swaps on conflict.
- `assignSeat(conversationId, deskId, …)` also sets `meetingSeating[conversationId] = null` (dropping onto any desk ends the meeting).
- Every layout edit runs `dropUnsupportedFrames(layout)` so frames that lost their wall disappear in the same undo step; deleting a meeting table clears `meetingSeating` entries pointing at it.
- `rotation` (placing) already exists; unchanged.

## 7. Picture file (local data folder)

| Field | Value |
|---|---|
| Location | `<dataDir>/pictures/<id>` |
| id | 32 hex chars + `.webp` / `.jpg` / `.png` |
| Content | re-encoded by the browser (≤ 1024 px longest side, no EXIF) |
| Max size accepted by server | 2 MB (existing body limit) |
| Lifetime | removed when no saved layout item references it (on layout save, on server start) |
