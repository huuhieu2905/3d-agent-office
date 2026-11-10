# Contract: Local API — thay đổi cho 004

## L4-1 · `DELETE /api/conversations/:id` (mới, `routes/conversations.ts`)

Header phiên (session token) bắt buộc, như mọi route khác.

| Bước | Điều kiện | Phản hồi |
|---|---|---|
| 1 | `id` không khớp `^[A-Za-z0-9-]{1,100}$` | `400 BAD_REQUEST` |
| 2 | App mất kết nối | `503 APP_UNAVAILABLE` |
| 3 | `listConversations()` không có `id` | `404 NOT_FOUND` |
| 4 | Agent bận ở bất kỳ conversation nào trong cây (cha + mọi subagent con, data-model §3, đọc lại từ App ngay lúc này) | `409 AGENT_BUSY` với `{ visualState, busyId }` |
| 5 | `adapter.deleteConversation(id)` ném `AppRejectedError` | `502 APP_REJECTED` (câu chữ cố định, không có nội dung của App) |
| 6 | Thành công | `deskId = null` cho cả cây, `employees.refresh()`, trả `200` với `{ removed: string[] }` (id cha + id các con đã bị App xoá theo) |

**Bất biến**:
- Bước 4 và 5 thất bại thì không đổi gì ở profile hay layout (FR-014).
- Log chỉ ghi id và mã kết quả, không ghi tên conversation (Nguyên tắc III).

**WebSocket**: không thêm loại tin mới. `employees.patch` với `removed` (đã có) chứa id cha và id các con, làm
các nhân viên đó đi ra cửa.

## L4-2 · `GET/PUT /api/settings` (sửa)

Schema có thêm `legendCollapsed?: boolean` và `screensOff?: string[]` (tối đa 50 id, mỗi id 1–100 ký
tự). Body sai kiểu thì trả `400`; trường lạ bị bỏ qua, như hiện tại. File `settings.json` cũ, không có
hai trường này, vẫn đọc được.

## L4-3 · Mock App cho e2e (`tests/e2e/mock-app.ts`)

- Hỗ trợ `DeleteCascadeTrajectory`: xoá conversation khỏi danh sách giả lập.
- Có cờ để giả lập lỗi 500.
- Có cờ để đặt `runStatus: RUNNING` cho một conversation (kiểm tra `409`).
