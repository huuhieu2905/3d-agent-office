# Research: Tương thích Antigravity App 2.29.0

**Feature**: `003-antigravity-2-29-compat` | **Date**: 2026-11-08

Nguồn bằng chứng:
- Kết quả gọi các RPC chỉ-đọc tới App 2.29.0 thật (xem "Kết quả điều tra" trong `spec.md`).
- Chuỗi ký tự trong file chạy `language_server` của App 2.29.0: tên RPC, tên trường protobuf,
  mô tả công cụ `ask_question`.
- Mã nguồn hiện tại (`src/server/app-adapter/`, `src/web/ui/chat/`).

---

## R3-01. Danh sách phiên bản đã kiểm chứng nằm ở đâu

**Decision**: Thay hằng `SUPPORTED_APP_VERSION = '2.24.0'` (đang ở `src/shared/domain.ts`) bằng
`src/server/app-adapter/versions.ts`. File này export `VERIFIED_APP_VERSIONS`, mỗi phần tử gồm
`{ version, verifiedOn, evidence }`, và hàm `isVerified(version)`.
- `ConnectionState.connected` có thêm trường `verifiedVersions: string[]`, để giao diện và thông
  báo cảnh báo dựng câu chữ mà không ghi cứng số phiên bản.
- 2.29.0 chỉ được thêm vào mảng ở task cuối của US1, sau khi cổng FR-003 qua.

**Rationale**:
- Constitution v2.1.0 (Nguyên tắc II) yêu cầu danh sách nằm ở một nơi duy nhất **trong lớp kết nối**.
- Hằng hiện tại nằm ở `shared/` và còn bị lặp trong câu cảnh báo ở `main.ts:23`, trong
  `scripts/install.sh` và trong tài liệu.

**Alternatives considered**:
- Giữ hằng ở `shared/domain.ts`: vi phạm câu chữ của Nguyên tắc II.
- So sánh theo khoảng semver (`>=2.24 <3`): thông báo "đã hỗ trợ" cho những bản chưa ai kiểm
  chứng. Vi phạm Nguyên tắc I (trung thực).

## R3-02. Hai bộ dữ liệu mẫu song song

**Decision**:
- Ghi bộ mới vào `tests/contract/fixtures/app-2.29.0/`, giữ nguyên `app-2.24.0/`.
- `tests/contract/helpers.ts` export `FIXTURE_SETS = ['2.24.0', '2.29.0']`. Các contract test đọc
  dữ liệu chạy `describe.each(FIXTURE_SETS)`.
- Test gắn với nội dung riêng của một bản (ví dụ id của step cụ thể) được tách thành
  `describe` riêng cho bản đó.
- `scripts/record-fixtures.ts` lấy phiên bản từ `ConnectionState` để chọn thư mục ghi. Script
  nhận nhiều `--conversation <id>` để gom đủ các loại bước: lệnh, xem file, sửa file, câu hỏi,
  lỗi, tìm kiếm web.

**Rationale**: FR-006/FR-007 yêu cầu cả hai bản cùng pass. Máy hiện tại không còn 2.24.0, nên bộ
2.24.0 là bằng chứng duy nhất còn lại cho bản cũ.

**Alternatives considered**: Ghi đè bộ 2.24.0. Bị loại vì mất khả năng kiểm thử bản cũ, trong
khi constitution vẫn giữ hỗ trợ 2.24.0.

## R3-03. Che thông tin cho các trường mới

**Decision**: Thêm vào `CONTENT_KEYS` trong `redact.ts` các khoá `question`, `shortError`,
`fullError`, `query`, `writeInResponse`. Thêm các khoá này vào test `tests/leaks/redaction.test.ts`.

**Rationale**:
- Lúc điều tra, nội dung câu hỏi (`question`) và thông báo lỗi (`shortError`, có địa chỉ IP
  mạng nội bộ) đi qua `sanitizeRaw` mà **không bị che**.
- Nội dung lựa chọn đã được che, vì nằm ở khoá `text`.
- Nếu không sửa, bộ fixture 2.29.0 sẽ vi phạm SC-006.

**Alternatives considered**: Che toàn bộ các chuỗi không nằm trong danh sách trắng. Đây là
thay đổi lớn và làm hỏng các fixture đang có. Để dành cho một feature khác nếu cần.

## R3-04. Định dạng câu hỏi trắc nghiệm (`ask_question`)

**Decision**: Mapper đọc theo cấu trúc sau, tìm thấy trong file chạy 2.29.0 và khớp với dữ liệu thật:

```text
step.type = CORTEX_STEP_TYPE_ASK_QUESTION
step.askQuestion.questions[]: AskQuestionEntry
  question: string
  options[]: { id: string, text: string }
  isMultiSelect: bool
  selectedOptionIds: string[]     # sau khi trả lời
  writeInResponse: string         # câu trả lời tự do
  skipped: bool
step.status: WAITING (đang chờ) | DONE | CANCELED
step.requestedInteraction.askQuestion: AskQuestionInteractionSpec   # khi WAITING
step.completedInteractions[].response.askQuestion.responses[]: AskQuestionEntry
```

Cách trả lời (`HandleCascadeUserInteraction`, cùng RPC với phần duyệt quyền):

```text
{ cascadeId, interaction: { trajectoryId, stepIndex,
    askQuestion: { responses: [ { question, selectedOptionIds, writeInResponse? } ] } } }
```

Dạng này khớp với `completedInteractions[].response` mà App tự ghi lại khi người dùng trả lời
trong App.

**Rationale**:
- Mô tả công cụ trong App ghi rõ: *"renders an interactive modal containing the question,
  selectable options, a default write-in option, and Submit/Skip buttons"*. App cũng dặn agent
  *"Don't include an 'other' option… one is always provided in the UI by default"*.
- Như vậy ô "Khác" (Clarification Q2) **được App hỗ trợ sẵn**, qua trường `writeInResponse`.
  Trường `isMultiSelect` quyết định cho chọn một hay nhiều đáp án.
- FR-010a (App từ chối câu trả lời tự do) gần như không xảy ra, nhưng vẫn giữ lại làm phương án
  dự phòng.

**Còn phải thử nghiệm (spike S1, chạy đầu US2)**:
1. Các trường bên trong `AskQuestionInteractionSpec` khi bước đang WAITING. Có thể rỗng; nếu
   vậy thì nội dung câu hỏi đọc từ `step.askQuestion`.
2. App có chấp nhận cùng lúc `selectedOptionIds` và `writeInResponse` trong một câu con không
   (edge case trong spec).
3. Mã lỗi App trả về khi trả lời một câu hỏi không còn ở trạng thái WAITING.

Spike chạy trên conversation `[agent-office-test]`, với prompt yêu cầu agent dùng `ask_question`.

**Alternatives considered**: Gửi câu trả lời tự do như một tin nhắn thường. Bị loại: agent sẽ
vẫn bị chặn ở bước câu hỏi, vì App chờ một interaction chứ không chờ tin nhắn.

**Ngoài phạm vi (ghi lại)**: App có nút "Skip" (trường `skipped`). Spec không yêu cầu, nên không
làm (YAGNI). Câu hỏi đã bị bỏ qua vẫn hiển thị là "đã bỏ qua" trong lịch sử.

### Kết quả spike S1 (2026-11-08, App 2.29.0, task T022)

Chạy trên conversation `[agent-office-test] question` (đã dọn). Fixture:
`GetCascadeTrajectorySteps.waiting-question.json`, `GetCascadeTrajectorySteps.question.json`.

1. **`requestedInteraction.askQuestion`** khi WAITING có dạng `{ questions: AskQuestionEntry[] }`, giống
   `step.askQuestion.questions`. Mapper đọc `step.askQuestion` trước, dùng `requestedInteraction` làm
   dự phòng.
2. **Chọn đáp án + "Khác" ở cùng câu con** (câu chọn nhiều): App **chấp nhận** cả `selectedOptionIds`
   và `writeInResponse`, bước chuyển DONE với đúng hai giá trị, agent làm tiếp. Giao diện: câu chọn
   nhiều cho kết hợp; câu chọn một coi "Khác" là một lựa chọn loại trừ (radio), nên không cần chặn.
3. **Trả lời câu hỏi không còn WAITING**: App trả **HTTP 500 (unknown)**, không phải 4xx. Adapter kiểm
   tra trạng thái trước khi gửi (`QuestionNotPendingError`). Nếu App vẫn trả 500 (hai cửa sổ trả lời
   gần như cùng lúc), adapter đọc lại bước và báo `QuestionNotPendingError` → route trả 409.
4. FR-010a (App từ chối câu trả lời tự do) không xảy ra trên 2.29.0; giữ nhánh 422 làm dự phòng.

## R3-05. Nội dung bước lỗi

**Decision**:
- `ERROR_MESSAGE`: `text = errorMessage.error.shortError`. Nếu thiếu, dự phòng bằng
  `errorMessage.error.userErrorMessage` / `message`.
- Nếu vẫn rỗng: `"Lỗi không rõ nguyên nhân"`, kèm `(mã <errorId>)` nếu có `errorId`.
- Chuỗi lỗi đi qua `redactString` (token đã đăng ký, email) **trong adapter**, trước khi ra
  khỏi lớp kết nối.
- Cắt 300 ký tự là việc của giao diện (nút "xem thêm"), không cắt trong adapter.

**Rationale**: Dữ liệu thật cho thấy `shortError` có nội dung đầy đủ, ví dụ lỗi mạng kèm URL và
IP. Mapper hiện tại chỉ đặt `kind = 'error'` mà không đọc text. Đó là nguyên nhân của F10.

**Alternatives considered**: Hiện mã lỗi thô. Không giúp người dùng quyết định nên làm gì tiếp.

## R3-06. Tìm kiếm web và các loại bước mới trong miền nghiệp vụ

**Decision**: Thêm 2 giá trị vào `STEP_KINDS`:
- `question`: kèm trường `question: AgentQuestion | null` trên `Step`.
- `web_search`: dùng `text = searchWeb.query`.

Giao diện nhận diện bằng `kind`, không dựa vào `rawType`.

**Rationale**: Nguyên tắc II yêu cầu phần ngoài adapter chỉ dùng khái niệm nghiệp vụ. Dùng lại
`kind: 'tool'` kèm `rawType` sẽ làm rò khái niệm của App ra giao diện.

**Alternatives considered**: Dùng chung `permission_request` cho câu hỏi. Bị loại, vì đây chính
là lỗi F9.

## R3-07. Trạng thái "chờ sếp" khi có câu hỏi

**Decision**: Giữ nguyên `visual-state.ts`. Quy tắc hiện tại (`lastStep.status === 'WAITING'`
→ chờ) đã đúng cho câu hỏi. Sửa ở mapper: bước ASK_QUESTION đang WAITING **không** được đi qua
`permissionFrom`. Hiện tại, `Object.keys(ri)[0]` trả về `'askQuestion'` làm mapper tạo ra một
yêu cầu quyền giả.

**Rationale**: Chỉ cần sửa ở một nơi. Thêm unit test cho `visual-state` để giữ hành vi này.

## R3-08. Lệnh kiểm tra tương thích

**Decision**: Thêm `npm run check:compat` (`scripts/check-compat.ts`). Script chỉ gọi hàm
dev-only `inspectCompat()` của adapter, giống cách `recordRaw` đang làm. Theo Nguyên tắc II, chỉ
adapter được biết tên RPC. Hàm trả về:

1. `appVersion`, `verified: boolean`.
2. `rpcs`: với mỗi RPC trong danh sách adapter dùng, kiểm tra tên
   `LanguageServerService/<name>` có trong file chạy (`args[0]` của tiến trình đã dò được) hay
   không. Cách này không cần gọi RPC ghi.
3. `fieldDiff`: so sánh đường dẫn trường đã chuẩn hoá (khoá UUID hoặc số đổi thành `*`) của
   phản hồi chỉ-đọc hiện tại với bộ fixture mới nhất.
4. `unknownStepTypes`: đếm `rawType` của các bước bị map thành `other` trên toàn bộ conversation.

Mặc định in bảng Markdown, có thêm `--json`. Không ghi file trừ khi có `--out <file>`. Mọi nội
dung đều qua `sanitizeRaw`.

**Rationale**: Bốn mục trên chính là 4 kỹ thuật đã dùng tay trong buổi điều tra 2026-11-08, và
cả 4 đều chỉ đọc. Lúc điều tra, quét 46 conversation mất dưới 1 phút, đạt SC-005.

**Alternatives considered**: Gọi thử từng RPC. Không làm được với RPC ghi (sẽ tạo dữ liệu), và
một số RPC đọc cần tham số hợp lệ.

## R3-09. Kiểm thử với App thật cho cổng FR-003

**Decision**: Bổ sung `tests/live/` (chỉ chạy khi `AGENT_OFFICE_LIVE=1`; mọi đối tượng dùng tiền
tố `[agent-office-test]`; dọn trong `finally`):

| Test | Hành vi | Đã có? |
|---|---|---|
| `chat.live` | gửi là USER_INPUT (A6), dừng → IDLE ≤ 3 s (A7) | có |
| `latency.live` | trạng thái ≤ 2 s | có |
| `project.live` | tạo project → tuyển nhân viên vào project → conversation có đúng `projectId` | **mới** |
| `permission.live` | agent xin chạy lệnh vô hại → trả lời allow, rồi deny ở lần 2 → App ghi nhận | **mới** |
| `question.live` | agent hỏi bằng `ask_question` → trả lời (chọn 1, chọn nhiều, tự do) → agent tiếp tục | **mới** (US2) |

Bước tự kết nối lại khi App khởi động lại được kiểm tra **bằng tay** theo `quickstart.md`, vì test
tự động không được phép tắt App của người dùng.

**Rationale**: F8 cho thấy các thao tác ghi chưa được kiểm chứng trên 2.29.0. Hai test có sẵn
không phủ phần project và duyệt quyền.

**Rủi ro**: `permission.live` phụ thuộc cài đặt tự duyệt lệnh của App. Nếu App tự chạy lệnh mà
không hỏi, test được bỏ qua kèm lý do, và phải kiểm chứng bằng tay. Test không được tự đổi cài đặt
của App.

## R3-10. Sửa constitution sau cổng

**Decision**: Khi cổng US1 qua, chạy `/speckit-constitution` để sửa PATCH (v2.1.2), chuyển 2.29.0
vào danh sách đã kiểm chứng. Bằng chứng: kết quả `npm run test:live` và bảng `check:compat`.
