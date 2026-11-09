# Implementation Plan: Tương thích Antigravity App 2.29.0

**Branch**: `003-antigravity-2-29-compat` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-antigravity-2-29-compat/spec.md`

## Summary

App đã tự cập nhật từ 2.24.0 lên 2.29.0. Rà soát chỉ-đọc cho thấy không có gì bị hỏng: 18/18 RPC vẫn
còn, và định dạng dữ liệu chỉ được thêm trường. Kế hoạch gồm 4 phần, giao theo thứ tự:

- **US1, tương thích (cổng công nhận 2.29.0)**:
  - Chuyển danh sách phiên bản vào `app-adapter/versions.ts` (R3-01).
  - Sửa trình che thông tin cho các trường mới (R3-03).
  - Ghi bộ fixture 2.29.0 và chạy contract test trên cả hai bộ (R3-02).
  - Thêm test live cho project và duyệt quyền (R3-09); kiểm tra bằng tay việc tự kết nối lại.
  - Khi tất cả pass: thêm 2.29.0 vào danh sách, sửa tài liệu và sửa PATCH constitution (R3-10).
- **US2, câu hỏi trắc nghiệm**:
  - Mapper nhận ra `ASK_QUESTION` và không biến nó thành yêu cầu quyền (R3-04, R3-07).
  - Thêm `answerQuestion` qua `HandleCascadeUserInteraction` (không có RPC mới).
  - Thêm route `POST /questions` và `QuestionPrompt` có radio/checkbox và ô "Khác". App hỗ trợ sẵn
    ô này qua `writeInResponse`.
  - Bắt đầu bằng spike S1.
- **US3, lỗi và tìm kiếm web**: đọc `errorMessage.error.shortError` (đã che), và `searchWeb.query`
  (R3-05, R3-06).
- **US4, lệnh kiểm tra tương thích**: `npm run check:compat` gọi `inspectCompat()` của adapter
  (chỉ đọc, R3-08).

## Technical Context

**Language/Version**: TypeScript 6 trên Node.js ≥ 22 (server). React 19 + three.js 0.187 (web).
Không đổi.

**Primary Dependencies**: Không thêm thư viện. Dùng sẵn Fastify 5, zod 4, pino, React Three Fiber 9,
zustand 5, Vitest 5, Playwright.

**Storage**: Không có dữ liệu lưu mới. Câu hỏi và câu trả lời không được lưu (Nguyên tắc I, III).
Thêm thư mục fixture `tests/contract/fixtures/app-2.29.0/` (dữ liệu kiểm thử đã che).

**Testing**:
- **Vitest**:
  - unit: `versions`, `visual-state` với câu hỏi, kiểm tra hợp lệ `QuestionAnswer`.
  - contract: `describe.each(FIXTURE_SETS)`; mapper câu hỏi, lỗi, tìm kiếm; body của `answerQuestion`.
  - leaks: các khoá mới.
- **Live** (`AGENT_OFFICE_LIVE=1`): thêm `project`, `permission`, `question`.
- **Playwright**: `question.spec.ts`, cùng các kịch bản lỗi và tìm kiếm trong `chat.spec.ts`
  (mock App).
- **Guard**: không còn chuỗi phiên bản App trong `src/` ngoài `versions.ts`; `check-compat.ts`
  chỉ dùng `inspectCompat`.

**Target Platform**: macOS 13+, Chrome hoặc Firefox có WebGL 2. Antigravity App 2.29.0 (mục tiêu),
2.24.0 (giữ hỗ trợ).

**Project Type**: Ứng dụng web local, một package, server cầu nối + client 3D (không đổi).

**Performance Goals**:
- Trạng thái "chờ sếp" ≤ 2 s.
- Tự kết nối lại ≤ 10 s.
- `check:compat` ≤ 2 phút với khoảng 50 conversation.
- Không đổi cảnh 3D (60 FPS giữ nguyên).

**Constraints**:
- Không thêm RPC mới. Không kết nối ra ngoài mới.
- Không tự đổi cài đặt của App trong test.
- Test live chỉ dùng đối tượng `[agent-office-test]`.
- Không công nhận 2.29.0 trước khi cổng FR-003 qua.

**Scale/Scope**:
- 4 user story, 20 FR (gồm FR-010a, FR-016a), 6 SC.
- Khoảng 15 file nguồn bị sửa; 1 route, 1 component và 1 script mới.

Không còn mục NEEDS CLARIFICATION. Ba điểm kỹ thuật chưa chắc chắn của câu hỏi trắc nghiệm được
giao cho spike S1 (R3-04). Spike chạy đầu US2 và không chặn US1.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Đối chiếu constitution
**v2.1.1**.

| Nguyên tắc | Kiểm tra | Trước Phase 0 | Sau Phase 1 |
|---|---|---|---|
| I. App là nguồn dữ liệu duy nhất | Trạng thái câu hỏi lấy từ `step.status` của App, hệ thống không tự đổi. Không lưu câu hỏi hay câu trả lời. Bản chưa kiểm chứng thì cảnh báo trung thực. Lỗi rỗng hiện "không rõ nguyên nhân" thay vì đoán | ✅ | ✅ data-model §4 (bảng trạng thái), R3-05 |
| II. Lớp kết nối cô lập | Danh sách phiên bản ở một nơi duy nhất trong adapter (`versions.ts`). Tên RPC và trường chỉ có trong adapter. Phần ngoài adapter dùng khái niệm nghiệp vụ (`question`, `web_search`). Có fixture từ App thật cho cả hai bản. Điều kiện kiểm chứng (fixture + live đọc/ghi + kết nối lại) được dùng làm cổng | ✅ | ✅ A3-1d (guard), A3-5, R3-02, R3-09 |
| III. Local-first, bảo mật | Không có kết nối ra ngoài mới. Trả lời câu hỏi chỉ khi người dùng bấm. `sanitizeRaw` và `redactString` được mở rộng cho các trường mới. `check:compat` không in nội dung. Route kiểm tra id, schema và trạng thái | ✅ | ✅ A3-4, L3-1, FR-011/013/016 |
| IV. Giao hàng theo đợt | Đợt 1 = US1. Hệ thống dùng được và công nhận 2.29.0 mà không chờ US2–4 (Clarification Q1). Mỗi đợt sau là một phần độc lập | ✅ | ✅ xem "Các đợt giao hàng" |
| V. Trải nghiệm, 60 FPS, 1 lần bấm | Không đổi cảnh 3D. Mở chat vẫn bằng 1 lần bấm. Câu hỏi trả lời được trong ≤ 3 lần bấm (SC-003) | ✅ | ✅ U3-1, quickstart §6.4 |
| VI. Cài đặt macOS | Không thêm phụ thuộc. Hướng dẫn cài đặt được chạy lại trên 2.29.0 (FR-017) | ✅ | ✅ quickstart §6.5 |

**Kết luận**: không có vi phạm. Còn một việc theo quy trình: sửa PATCH constitution sau cổng US1 (R3-10).

## Các đợt giao hàng

| Đợt | Nội dung | Điều kiện xong |
|---|---|---|
| **1** | US1: `versions.ts`, `verifiedVersions`, sửa câu cảnh báo, che thông tin cho trường mới, fixture 2.29.0, contract test 2 bộ, `project.live` + `permission.live`, kiểm tra tay M1–M6 → **thêm 2.29.0**, sửa README / INSTALL / install.sh, PATCH constitution | SC-001, SC-002; quickstart §2–3 pass |
| **2** | US2: spike S1 → mapper `question` → `answerQuestion` → route L3-1 → `QuestionPrompt` → `question.live` + e2e | SC-003; quickstart §4 |
| **3** | US3: mapper lỗi và tìm kiếm + hiển thị U3-4/U3-5 | SC-004; quickstart §5 |
| **4** | US4: `inspectCompat` + `check:compat` | SC-005; quickstart §1 |

Đợt 3 và 4 có thể làm song song với đợt 2. Che thông tin (A3-4) nằm ở đợt 1, vì fixture 2.29.0
cần nó. Phần ghi fixture cho bước câu hỏi đang chờ (`GetCascadeTrajectorySteps.waiting-question.json`) được làm trong
spike S1.

## Project Structure

### Documentation (this feature)

```text
specs/003-antigravity-2-29-compat/
├── plan.md              # File này
├── research.md          # Phase 0 (R3-01 … R3-10)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── app-adapter.md   # A3-1 … A3-6
│   └── local-api.md     # L3-1 … L3-4 (gồm U3-x)
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domain.ts                    # STEP_KINDS + question/web_search; AgentQuestion; ConnectionState.verifiedVersions; bỏ SUPPORTED_APP_VERSION
│   └── schemas.ts                   # questionAnswerSchema (zod)
├── server/
│   ├── main.ts                      # câu cảnh báo dựng từ verifiedVersions (L3-2)
│   ├── app-adapter/
│   │   ├── versions.ts              # MỚI: VERIFIED_APP_VERSIONS, isVerified
│   │   ├── connection.ts            # dùng versions.ts
│   │   ├── index.ts                 # answerQuestion, inspectCompat, chặn askQuestion trong answerPermission
│   │   ├── types.ts                 # AppAdapter.answerQuestion; QuestionNotPendingError, AppRejectedError
│   │   ├── redact.ts                # CONTENT_KEYS mới (A3-4)
│   │   ├── compat.ts                # MỚI: quét tên RPC, so sánh trường, đếm loại bước lạ
│   │   └── mappers/step.ts          # ASK_QUESTION, ERROR_MESSAGE text, SEARCH_WEB
│   └── http/routes/commands.ts      # POST /questions/:requestId (L3-1)
└── web/
    ├── state/connection.ts          # hiện câu cảnh báo mới
    └── ui/chat/
        ├── QuestionPrompt.tsx       # MỚI (U3-1, U3-2)
        ├── ChatPanel.tsx            # chọn QuestionPrompt hoặc PermissionPrompt
        └── StepView.tsx             # question (lịch sử), error (xem thêm), web_search

scripts/
├── check-compat.ts                  # MỚI: npm run check:compat
├── record-fixtures.ts               # thư mục ghi theo phiên bản, nhiều --conversation
├── check-guards.sh                  # guard phiên bản + guard check-compat
└── install.sh                       # bỏ số phiên bản ghi cứng

tests/
├── contract/
│   ├── helpers.ts                   # FIXTURE_SETS
│   ├── fixtures/app-2.29.0/         # MỚI
│   ├── adapter-read.test.ts         # describe.each
│   ├── adapter-question.test.ts     # MỚI (A3-2, A3-3)
│   └── adapter-steps-2-29.test.ts   # MỚI: lỗi, tìm kiếm
├── unit/versions.test.ts, visual-state.test.ts, question-answer.test.ts
├── leaks/redaction.test.ts
├── live/project.live.test.ts, permission.live.test.ts, question.live.test.ts   # MỚI
└── e2e/mock-app.ts, question.spec.ts (MỚI), chat.spec.ts

docs/INSTALL.md, README.md            # phiên bản đã hỗ trợ + nhật ký chạy thử 2.29.0
.specify/memory/constitution.md       # PATCH v2.1.2 sau cổng US1
```

**Structure Decision**: Giữ cấu trúc một package như 001/002. Mọi thay đổi chạm vào App nằm trong
`src/server/app-adapter/`. Phần web chỉ thêm một component, và sửa hai component hiển thị.

## Complexity Tracking

Không có vi phạm constitution cần giải trình.
