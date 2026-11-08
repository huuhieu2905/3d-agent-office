# Contract: Local API — thay đổi cho 002

Chỉ ghi phần khác so với `specs/001-3d-agent-office/contracts/local-api.md`. Mọi quy tắc bảo mật cũ
giữ nguyên: chỉ nghe `127.0.0.1`, kiểm tra Host/Origin, session token, không trả nội dung lỗi của App
cho client.

## L2-1 · `GET /api/layout`

| | |
|---|---|
| Response | `OfficeLayout` **v2** (data-model §3). Server tự chuyển v1 → v2 khi đọc file cũ |
| Bất biến | Client không bao giờ nhận v1 |

## L2-2 · `PUT /api/layout` — thêm `seating`

**Request**

```json
{
  "layout": { "schemaVersion": 2, "floor": { "width": 20, "depth": 14 }, "shell": { "glassSide": "north", "door": { "side": "south", "offset": 7 } }, "items": [ { "id": "desk-1", "type": "desk", "pos": { "x": 2.35, "z": 2 }, "rotation": 0 } ] },
  "seating": { "<conversationId>": "desk-1" }
}
```

- `seating` không bắt buộc. Mỗi khoá là conversationId (định dạng id như route hiện có), giá trị là id
  của một `desk` **trong `layout` gửi kèm**, hoặc `null` (về sảnh chờ).
- Nếu hai conversation được gán cùng một bàn → `422`.
- Thân request cũ (`OfficeLayout` trần, v1 hoặc v2) vẫn được chấp nhận trong một phiên bản để tương
  thích. Body v1 được chuyển sang v2 trước khi kiểm tra.

**Response**

| Mã | Body | Khi nào |
|---|---|---|
| `200` | `{ layout: OfficeLayout v2, seating: Record<id, deskId \| null> }` | Lưu cả bố cục và chỗ ngồi (một lần ghi mỗi file, bố cục ghi trước) |
| `422` | `{ error: 'INVALID_LAYOUT', invalidItems: string[], reasons: Record<string, string> }` | Vi phạm data-model §3 |
| `422` | `{ error: 'FLOOR_TOO_SMALL', blockers: string[], min: { width, depth } }` | Thu nhỏ làm đồ vật ra ngoài sàn (FR-024) |
| `422` | `{ error: 'INVALID_SEATING', conversationIds: string[] }` | Bàn không tồn tại hoặc bị gán trùng |

Sau khi lưu: nhân viên có bàn bị xoá thì về sảnh chờ (như cũ). Server phát sự kiện WebSocket `employees`
như hiện nay.

## L2-3 · `PUT /api/employees/:conversationId/profile` — thêm `preferredModel`

**Request** (mọi trường không bắt buộc, gửi trường nào ghi trường đó)

```json
{ "preferredModel": "MODEL_PLACEHOLDER_M318" }
```

- `preferredModel: string` có độ dài 1..128, ký tự `[A-Za-z0-9_.:-]`. Giá trị `null` xoá lựa chọn.
- Server ghi `{ modelId, chosenAt: now }`.
- `deskId` vẫn được chấp nhận (dùng ngoài chế độ sắp xếp trong tương lai), nhưng UI 002 không gọi
  route này để đổi bàn nữa.

**Response**: `200 EmployeeProfile` | `400 BAD_REQUEST` | `404` nếu conversation không tồn tại.

## L2-4 · `Employee` (REST + WebSocket) — thêm trường

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `preferredModel` | string \| null | Từ hồ sơ |
| `currentModel` | string \| null | Từ App, xem contracts/app-adapter.md |

Không có route mới. Không có kết nối ra ngoài mới.
