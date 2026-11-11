# Local API changes (007)

All routes are under `/api/`, so they need the session Bearer token and pass the Host/Origin checks in `src/server/http/security.ts`. Nothing new leaves the machine.

## L7-1 · `PUT /api/layout`: `meetingSeating` and frame pictures

**Request** (extends 002 L2-2)

```json
{
  "layout": { "schemaVersion": 2, "...": "...", "items": [
    { "id": "mt-1", "type": "meeting_table_8", "pos": { "x": 4, "z": 3 }, "rotation": 0 },
    { "id": "pf-1", "type": "photo_frame", "pos": { "x": 6, "z": 2 }, "rotation": 0, "picture": "3f9c…e1.webp" }
  ] },
  "seating": { "<conversationId>": "desk-1" },
  "meetingSeating": { "<conversationId>": "mt-1#3" }
}
```

- `meetingSeating` is optional. Each key is a known conversationId; each value is `"<meeting table id in this layout>#<n>"` with `0 ≤ n < seat count`, or `null` (leave the meeting).
- Two conversations on the same meeting seat → `422 INVALID_SEATING`.
- `picture` on an item: must match `^[0-9a-f]{32}\.(webp|jpg|png)$` (zod) and must be on a frame type (`validateLayout`). A picture id that has no file is accepted (the frame shows its default picture, spec FR-019).

**Response**

| Code | Body | When |
|---|---|---|
| `200` | `{ layout, seating, meetingSeating }` | Saved. Then pictures not referenced by `layout` are deleted from `<dataDir>/pictures/`. |
| `422` | `INVALID_LAYOUT` / `FLOOR_TOO_SMALL` (unchanged shapes) | data-model §3 rules, including the new ones |
| `422` | `{ error: 'INVALID_SEATING', conversationIds }` | Bad desk or bad / duplicate meeting seat |

Bodies without `meetingSeating`, and bare layouts, behave exactly as before.

## L7-2 · `POST /api/pictures`: upload one picture

**Request**: raw image bytes. `Content-Type` is one of `image/webp`, `image/jpeg`, `image/png`. Body ≤ 2 MB (the app-wide `bodyLimit`). The browser has already resized and re-encoded the image (research R7-06).

**Response**

| Code | Body | When |
|---|---|---|
| `201` | `{ "id": "<32 hex>.<webp\|jpg\|png>" }` | Stored at `<dataDir>/pictures/<id>`, mode 0600 |
| `400` | `{ error: { code: 'BAD_REQUEST', message: 'The file is not a supported image' } }` | Magic bytes do not match the declared type |
| `413` | Fastify default | Body > 2 MB |
| `415` | `{ error: { code: 'BAD_REQUEST', message: 'Choose a PNG, JPEG or WebP image' } }` | Other content type |

The picture is not tied to the layout until a `PUT /api/layout` references it.

## L7-3 · `GET /api/pictures/:id`: read one picture

- `:id` must match `^[0-9a-f]{32}\.(webp|jpg|png)$`, otherwise `400` (blocks path traversal).
- `200`: file bytes, `Content-Type` from the extension, `Cache-Control: private, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`.
- `404 NOT_FOUND`: no such file (client falls back to the default picture).

## L7-4 · `Employee` (REST snapshot and WebSocket `employees.*` events)

Adds `meetingSeatId: string | null`. Existing fields unchanged.

## L7-5 · `PUT /api/employees/:conversationId/profile`

Unchanged in 007: meeting seats are only set through build mode (L7-1).
