# Contract: App adapter — thay đổi cho 004

Chỉ thêm **một** thao tác ghi. Không có RPC mới: `DeleteCascadeTrajectory` đã nằm trong `USED_RPCS`
(`compat.ts`) và đã được chạy với App 2.29.0 qua phần dọn dữ liệu của test live.

## A4-1 · `deleteConversation(conversationId: string): Promise<void>` (mới)

- **RPC**: `DeleteCascadeTrajectory`, body `{ cascadeId: conversationId }`.
- **Chỉ gọi khi người dùng chủ động xoá** (Nguyên tắc III). Guard (c) trong
  `scripts/check-guards.sh` thêm `deleteConversation` vào danh sách thao tác ghi. Thao tác này chỉ
  được gọi trong `src/server/http/routes/`.
- **Lỗi**:
  - Mất kết nối: ném `AppUnavailableError`.
  - App từ chối (HTTP 4xx/5xx từ App): ném `AppRejectedError`. Thông điệp của App không bao giờ được
    mang ra ngoài (giống A3-3c).
  - Conversation không tồn tại: App trả lỗi. Adapter trả về bình thường **nếu** `listConversations()`
    xác nhận id đó không còn trong danh sách, để thao tác xoá lặp lại vẫn an toàn (idempotent).
- **Không** tự gọi `cancel` trước khi xoá (Clarifications Q4).
- **Phát hiện khi chạy thật (T060, App 2.29.0)**: nếu khung chat của conversation đang mở, stream
  `StreamAgentStateUpdates` / việc đọc bước của nó làm conversation "sống lại" sau lệnh xoá (lệnh trả OK
  nhưng App vẫn liệt kê). Vì vậy adapter **dừng mọi watch của conversation trước khi xoá**, rồi **đọc lại
  danh sách**; còn thì xoá lại (tối đa 3 lần, chờ 250/500/750 ms), vẫn còn thì `AppRejectedError` và nhân
  viên ở lại (FR-014). Test: A4-1e (watch dừng trước khi xoá), A4-1f (vẫn còn → từ chối).
- App xoá luôn mọi subagent con của conversation (người dùng xác nhận, 2026-11-09). Adapter không tự
  xoá từng con.
- `deleteTestConversation` (chỉ dùng cho test) có thể gọi lại A4-1 sau phần kiểm tra nhãn
  `[agent-office-test]`.

### Kiểm thử

| Id | Loại | Nội dung |
|---|---|---|
| A4-1a | contract | Body gửi đi đúng `{ cascadeId }`, đúng tên RPC |
| A4-1b | contract | Mất kết nối thì ném `AppUnavailableError`; HTTP 500 từ App thì ném `AppRejectedError` và không lộ nội dung |
| A4-1c | contract | Lỗi "không tồn tại" nhưng danh sách không còn id: trả về bình thường |
| A4-1d | live (`AGENT_OFFICE_LIVE=1`) | Tạo conversation `[agent-office-test]`, xoá qua route L4-1, rồi `listConversations` không còn id. Nếu có subagent con: các con cũng không còn trong danh sách (R4-02) |
