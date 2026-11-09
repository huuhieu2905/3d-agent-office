# Data Model: Tương thích Antigravity App 2.29.0

**Feature**: `003-antigravity-2-29-compat`. Các kiểu dưới đây mở rộng `src/shared/domain.ts`. Không
có dữ liệu lưu mới: hệ thống vẫn không lưu nội dung chat, câu hỏi hay câu trả lời.

## 1. Phiên bản App đã kiểm chứng (chỉ trong adapter)

```ts
// src/server/app-adapter/versions.ts
interface VerifiedAppVersion {
  version: string;      // '2.24.0'
  verifiedOn: string;   // ISO date '2026-11-06'
  evidence: string;     // 'specs/001-3d-agent-office' | 'specs/003-antigravity-2-29-compat'
}
const VERIFIED_APP_VERSIONS: readonly VerifiedAppVersion[];
```

- Ban đầu: chỉ có `2.24.0`. Sau cổng US1 thì thêm `2.29.0` (R3-01, FR-003).
- Thứ tự: bản mới nhất ở đầu. "Bộ fixture mới nhất" (R3-08) là bản đầu tiên trong danh sách có
  thư mục fixture.

## 2. ConnectionState (sửa)

```ts
| { kind: 'connected'; appVersion: string; versionSupported: boolean; verifiedVersions: string[] }
```

- `versionSupported = VERIFIED_APP_VERSIONS.some(v => v.version === appVersion)`.
- `verifiedVersions` được dùng để dựng câu cảnh báo (FR-002). Ví dụ: "Antigravity App 2.30.0 chưa
  được kiểm chứng (đã kiểm chứng: 2.29.0, 2.24.0)".
- Bỏ `SUPPORTED_APP_VERSION` khỏi `shared/domain.ts`.

## 3. Step (mở rộng)

```ts
STEP_KINDS += 'question' | 'web_search'

interface Step {
  // ...các trường hiện có
  question: AgentQuestion | null;   // chỉ có giá trị khi kind = 'question'
}
```

| `rawType` của App | `kind` | Trường được điền |
|---|---|---|
| `ASK_QUESTION` | `question` | `question` |
| `SEARCH_WEB` | `web_search` | `text` = nội dung đã tìm |
| `ERROR_MESSAGE` | `error` | `text` = thông báo đã che (R3-05), không bao giờ rỗng |

Quy tắc: bước `question` **không bao giờ** có `permission`, và không bao giờ đổi thành
`permission_request` (R3-07).

## 4. AgentQuestion

```ts
type QuestionState = 'waiting' | 'answered' | 'skipped' | 'canceled';

interface AgentQuestion {
  requestId: string;              // "<trajectoryId>:<stepIndex>:askQuestion" (như PermissionRequest)
  state: QuestionState;
  entries: QuestionEntry[];       // ≥ 1
}

interface QuestionEntry {
  question: string;               // markdown
  options: { id: string; text: string }[];
  multiSelect: boolean;
  selectedOptionIds: string[];    // rỗng khi đang chờ
  writeIn: string | null;         // câu trả lời tự do (ô "Khác")
}
```

**Chuyển trạng thái** (lấy từ `step.status` của App, hệ thống không tự đổi trạng thái):

```text
waiting ──(người dùng gửi / trả lời trong App)──► answered
waiting ──(người dùng bỏ qua trong App)─────────► skipped
waiting ──(agent bị dừng / huỷ)─────────────────► canceled
```

| `step.status` | Điều kiện thêm | `state` |
|---|---|---|
| `WAITING` | — | `waiting` |
| `DONE` | có entry với `skipped = true` và không có đáp án | `skipped` |
| `DONE` | còn lại | `answered` |
| `CANCELED` / `ERROR` | — | `canceled` |

## 5. QuestionAnswer (dữ liệu gửi lên, không lưu)

```ts
interface QuestionAnswer {
  answers: { selectedOptionIds: string[]; writeIn?: string }[];  // cùng thứ tự với entries
}
```

**Kiểm tra hợp lệ** (server, trước khi gọi adapter):
- `answers.length === entries.length` (FR spec US2-5: phải trả lời hết các câu con).
- Mỗi câu trả lời: `selectedOptionIds.length ≥ 1` **hoặc** `writeIn` không rỗng sau khi trim.
- `multiSelect = false` thì `selectedOptionIds.length ≤ 1`.
- Mỗi id phải thuộc `options` của câu con đó.
- `writeIn` dài tối đa 2 000 ký tự.
- Câu hỏi phải đang ở `waiting`. Nếu không, trả về 409 (edge case "hai cửa sổ").

## 6. CompatReport (chỉ dùng khi phát triển, không lưu trừ khi có `--out`)

```ts
interface CompatReport {
  appVersion: string;
  verified: boolean;
  rpcs: { name: string; present: boolean }[];
  fieldDiff: { rpc: string; baseline: string; added: string[]; removed: string[] }[];
  unknownStepTypes: { rawType: string; count: number }[];
  scannedConversations: number;
  durationMs: number;
}
```

Không chứa nội dung chat, token hay email (FR-016). Đường dẫn trường chỉ là tên khoá đã chuẩn hoá.
