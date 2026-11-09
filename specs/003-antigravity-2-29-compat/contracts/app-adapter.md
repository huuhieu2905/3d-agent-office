# Contract: App adapter — thay đổi cho 003

Bổ sung vào `specs/001-3d-agent-office/contracts/app-adapter.md` và
`specs/002-realistic-ui-refresh/contracts/app-adapter.md`.
- **Không thêm RPC mới.** Phần trả lời câu hỏi dùng lại `HandleCascadeUserInteraction`.
- Mọi tên RPC và tên trường của App chỉ xuất hiện trong `src/server/app-adapter/` (Nguyên tắc II).

## A3-1 · Phiên bản đã kiểm chứng (thay A3 của 001)

| # | Hành vi | Kiểm thử |
|---|---|---|
| A3-1a | `versionSupported = true` khi và chỉ khi `appVersion` nằm trong `VERIFIED_APP_VERSIONS` | unit: 2.24.0 → true; 2.30.0 → false; `unknown` → false |
| A3-1b | `ConnectionState.connected.verifiedVersions` liệt kê đúng danh sách, bản mới nhất ở đầu | unit |
| A3-1c | Bản chưa kiểm chứng vẫn hoạt động: đọc và ghi đều không bị chặn | unit (giữ nguyên A3 cũ) |
| A3-1d | Không có nơi nào ngoài `versions.ts` chứa chuỗi số phiên bản App | guard trong `scripts/check-guards.sh`: grep `\b2\.(24\|29)\.0\b` trong `src/`, trừ `versions.ts` |

## A3-2 · `mapStep` cho các loại bước mới

| # | Đầu vào (App) | Đầu ra (`Step`) | Kiểm thử |
|---|---|---|---|
| A3-2a | `ASK_QUESTION`, status `WAITING` | `kind: 'question'`, `question.state: 'waiting'`, `permission: null` | contract, fixture 2.29.0 `GetCascadeTrajectorySteps.waiting-question.json` (ghi ở spike S1) |
| A3-2b | `ASK_QUESTION`, `DONE`, có `selectedOptionIds` / `writeInResponse` | `state: 'answered'`, đáp án được điền vào từng entry | contract, fixture 2.29.0 |
| A3-2c | `ASK_QUESTION`, `CANCELED` | `state: 'canceled'` | contract (dữ liệu thật có một bước CANCELED) |
| A3-2d | `isMultiSelect` thiếu | `multiSelect: false` | contract, biến thể |
| A3-2e | `ERROR_MESSAGE` có `errorMessage.error.shortError` | `kind: 'error'`, `text` = chuỗi đã qua `redactString` | contract + leaks (chuỗi chứa token đã đăng ký → bị che) |
| A3-2f | `ERROR_MESSAGE` không có chuỗi nào | `text = 'Lỗi không rõ nguyên nhân (mã <errorId>)'`, hoặc không có phần mã nếu thiếu `errorId` | contract, biến thể |
| A3-2g | `SEARCH_WEB` | `kind: 'web_search'`, `text = query` | contract |
| A3-2h | Dữ liệu 2.24.0 | Kết quả cũ không đổi (trừ các bước trên đã được nhận ra) | contract `describe.each(FIXTURE_SETS)` |

## A3-3 · `answerQuestion` (mới trên `AppAdapter`)

```ts
answerQuestion(conversationId: string, requestId: string, answer: QuestionAnswer): Promise<void>
```

| # | Hành vi | Kiểm thử |
|---|---|---|
| A3-3a | Gửi `HandleCascadeUserInteraction { cascadeId, interaction: { trajectoryId, stepIndex, askQuestion: { responses } } }`. Mỗi `responses[i]` gồm `question` (lấy từ step hiện tại), `selectedOptionIds`, và `writeInResponse` khi có `writeIn` | contract, transport giả: so sánh body |
| A3-3b | Trước khi gửi, đọc lại các bước. Nếu bước tại `stepIndex` không còn WAITING, ném `QuestionNotPendingError` | unit |
| A3-3c | App từ chối (HTTP 4xx), ném `AppRejectedError` (đã che thông tin). Không thử lại, không tự đổi đáp án (FR-010a) | contract, transport giả trả 400 |
| A3-3d | `requestId` sai định dạng hoặc kind khác `askQuestion`, ném `RpcError('protocol')` trước khi gọi App | unit |
| A3-3e | Live: chọn 1, chọn nhiều, tự do. Mỗi lần, agent tiếp tục và bước chuyển sang DONE kèm đúng đáp án | `tests/live/question.live.test.ts` |

`answerPermission` giữ nguyên, nhưng từ chối `requestId` có kind `askQuestion` để không gửi nhầm.

## A3-4 · Che thông tin (`sanitizeRaw`)

`CONTENT_KEYS` thêm `question`, `shortError`, `fullError`, `query`, `writeInResponse`.
Test: `tests/leaks/redaction.test.ts` có fixture tổng hợp chứa từng khoá. Kết quả không còn chuỗi gốc.

## A3-5 · `inspectCompat()` (chỉ dùng khi phát triển)

```ts
export function inspectCompat(opts?: { baselineDir?: string }): Promise<CompatReport>
```

- Chỉ gọi RPC trong `READ_ONLY_RPCS`. Đọc file chạy của App để tìm tên RPC (R3-08).
- Không ghi gì, không gọi RPC ghi. Guard: `check-guards.sh` xác nhận `scripts/check-compat.ts` chỉ
  import `inspectCompat` từ adapter.
- Kết quả đi qua `sanitizeRaw`. Không chứa nội dung, chỉ chứa tên khoá.

## A3-6 · Fixture

- `tests/contract/fixtures/app-2.29.0/`: cùng tên file với 2.24.0, để `describe.each` dùng chung
  (gồm `waiting-steps.json` ghi ở test duyệt quyền). Thêm các file ghi từ App thật:
  `GetCascadeTrajectorySteps.{tools,search-web,waiting-question,question}.json`, và
  `GetCascadeTrajectorySteps.error-message.json` nếu bắt được lỗi thật. Thêm một file biến thể
  `error-message-variants.json`.
- **Không** dùng tên `error-steps.json` cho bước lỗi mới: tên này trong bộ 2.24.0 là dữ liệu lỗi lúc
  duyệt quyền (spike T029).
- Được ghi bằng `scripts/record-fixtures.ts` sau khi sửa A3-4.
