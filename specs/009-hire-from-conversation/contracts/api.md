# Thay đổi API local (009)

Mọi route đều là local, cần session token có sẵn, và dùng định dạng lỗi có sẵn `{ error: { code, message } }`. Trả `503 APP_UNAVAILABLE` khi App không kết nối.

## GET /api/projects/:id/conversations — mới

Các conversation cấp cao nhất mà App có cho project, đọc từ App ngay lúc gọi.

`200`
```json
{
  "members": 18,
  "limit": 20,
  "conversations": [
    { "id": "c-123", "title": "Refactor login", "lastActivityAt": "2026-10-02T09:12:00Z", "runStatus": "IDLE", "inOffice": false }
  ]
}
```
- Lọc: `projectId === :id`, `parentId == null`, `stepCount > 0`. Sắp theo `lastActivityAt` giảm dần.
- `400 BAD_REQUEST` khi id sai.

## POST /api/conversations — thay đổi (tuyển mới)

Body không đổi (`newConversationSchema`). Từ nay:
- Khi trả `201 { "conversationId": "c-9", "evicted": { "conversationId": "c-1", "title": "Fix CI cache" } | null }`, conversation mới là thành viên (đã đặt `memberSince`), ngồi ở `deskId` nếu có và còn trống. Nếu văn phòng đã đầy, `evicted` là thành viên rảnh lâu không hoạt động nhất vừa rời văn phòng (nghiên cứu R8); conversation của họ không bị động tới.
- `409 OFFICE_FULL` `{ error: { code: "OFFICE_FULL", message, members: 20, limit: 20 } }` khi đã có 20 thành viên **và cả 20 đều bận** — **không** tạo conversation nào trong App.

## POST /api/conversations/:id/join — mới (tuyển conversation có sẵn)

Body: `{ "deskId"?: string }`

- `200 { "conversationId": "c-123", "alreadyMember": false, "evicted": { "conversationId": "c-1", "title": "Fix CI cache" } | null }` — đã trở thành thành viên; ngồi ở `deskId` nếu có và còn trống; `evicted` như trên. Không gửi gì tới App.
- `200 { ..., "alreadyMember": true, "evicted": null }` — đã là thành viên từ trước: không tốn chỗ, không ai rời đi, không đổi bàn.
- `404 NOT_FOUND` — App không còn conversation này.
- `400 BAD_REQUEST` — id sai, hoặc đó là subagent.
- `409 OFFICE_FULL` — như trên (đầy và cả 20 đều bận).

## POST /api/conversations/:id/leave — mới (đưa ra khỏi văn phòng)

- `200 {}` — không còn là thành viên; bàn và ghế họp được nhả; conversation trong App không bị động tới. Gọi lại nhiều lần cho cùng kết quả.
- `400 BAD_REQUEST` khi id sai.

## DELETE /api/conversations/:id — thay đổi

Hợp đồng không đổi; thêm việc xoá `memberSince` cho cả cây.

## WS `employees.snapshot` / `employees.patch`

Định dạng không đổi. `Employee.visible` giờ nghĩa là "thành viên hoặc subagent của thành viên". `overflow` luôn bằng `0`.
