# Contract: Local API và giao diện — thay đổi cho 003

Chỉ ghi phần khác so với `specs/001-3d-agent-office/contracts/local-api.md` và bản 002. Mọi quy tắc
bảo mật cũ giữ nguyên: chỉ nghe `127.0.0.1`, kiểm tra Host/Origin và session token, không trả nội dung
lỗi của App cho client.

## L3-1 · `POST /api/conversations/:id/questions/:requestId` (mới)

Thao tác ghi do người dùng chủ động (Nguyên tắc III, FR-011). Route nằm cạnh route `permissions`
trong `commands.ts`.

**Request**

```json
{ "answers": [ { "selectedOptionIds": ["1"] }, { "selectedOptionIds": [], "writeIn": "Dùng nhãn riêng" } ] }
```

| Kết quả | Khi nào |
|---|---|
| `202 {}` | Đã gửi cho App. Server làm mới nhân viên (`services.employees.refresh()`) |
| `400 BAD_REQUEST` | id sai định dạng; body sai schema (zod); câu con không có đáp án; chọn nhiều ở câu chỉ cho chọn một; id lựa chọn không tồn tại; `writeIn` > 2 000 ký tự (data-model §5) |
| `409 QUESTION_NOT_PENDING` | Câu hỏi đã được trả lời, bỏ qua hoặc huỷ (ví dụ cửa sổ khác đã trả lời trước) |
| `422 APP_REJECTED` | App từ chối câu trả lời. Body không chứa nội dung lỗi gốc của App |
| `503 APP_UNAVAILABLE` | Mất kết nối App |

## L3-2 · WebSocket `warning` `APP_VERSION_UNSUPPORTED` (sửa)

`message` được dựng từ `verifiedVersions`, ví dụ "Antigravity App 2.30.0 chưa được kiểm chứng
(đã kiểm chứng: 2.29.0, 2.24.0). Một số tính năng có thể không hoạt động." Không ghi cứng phiên bản
(FR-002). Không gửi thêm gì khi phiên bản đã được kiểm chứng.

## L3-3 · Giao diện chat (`src/web/ui/chat/`)

| # | Hành vi | Kiểm thử |
|---|---|---|
| U3-1 | Có bước `question` đang `waiting` ở cuối: hiện `QuestionPrompt` thay chỗ `PermissionPrompt`. Mỗi câu con có radio (một đáp án) hoặc checkbox (nhiều đáp án), và luôn có ô "Khác". Nút "Gửi" chỉ bật khi mọi câu con đã có đáp án | e2e `question.spec.ts` (mock App) |
| U3-2 | Gửi thành công thì khung câu hỏi khoá lại, hiện "Đã gửi". Gặp 409 thì hiện "Câu hỏi đã được trả lời ở nơi khác" và làm mới các bước. Gặp 422 thì hiện lỗi, **giữ nguyên** lựa chọn và nội dung đã gõ (FR-010a) | e2e |
| U3-3 | Lịch sử: bước `question` đã xong hiện câu hỏi kèm đáp án đã chọn, hoặc nội dung tự do. Bước bỏ qua hiện "đã bỏ qua", bước huỷ hiện "đã huỷ" | e2e |
| U3-4 | Bước `error`: hiện tối đa 300 ký tự, phần dài hơn có nút "Xem thêm" | e2e |
| U3-5 | Bước `web_search`: hiện "Đã tìm: <query>" | e2e |
| U3-6 | Câu hỏi và lựa chọn hiển thị bằng markdown giống tin nhắn agent. Nội dung dài tự xuống dòng, không tràn khung chat | e2e, ảnh chụp ở cỡ cửa sổ 1280 px và 390 px |
| U3-7 | Văn phòng 3D: nhân viên có câu hỏi đang chờ ở trạng thái "chờ sếp" (vẫy tay) trong ≤ 2 giây | unit `visual-state` + live `latency` |

## L3-4 · Mock App cho e2e (`tests/e2e/mock-app.ts`)

Thêm kịch bản `question` để test e2e không cần App thật:
- Một conversation có bước ASK_QUESTION ở trạng thái WAITING, gồm 2 câu con: một câu chọn một, một
  câu chọn nhiều.
- Handler `HandleCascadeUserInteraction` ghi lại body. Khi nhận `askQuestion`, chuyển bước sang DONE.
- Có cờ để trả 400, dùng cho U3-2.
