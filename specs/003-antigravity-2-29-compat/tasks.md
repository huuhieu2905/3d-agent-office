---

description: "Task list for 003-antigravity-2-29-compat"
---

# Tasks: Tương thích Antigravity App 2.29.0

**Input**: Design documents from `/specs/003-antigravity-2-29-compat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: CÓ. Spec yêu cầu rõ contract test trên hai bộ fixture (FR-005, FR-006), kiểm thử với App
thật làm cổng công nhận phiên bản (FR-003), và kiểm tra rò rỉ (SC-006). Constitution (Nguyên tắc II)
cũng bắt buộc có contract test bằng fixture.

**Organization**: Task được nhóm theo user story. US1 là MVP và là cổng công nhận 2.29.0.
US2–US4 không chặn US1 (Clarification Q1).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1–US4 theo spec.md
- Đường dẫn tính từ gốc repo. Dự án một package: `src/`, `tests/`, `scripts/`

## Quy tắc chung khi làm task

- Mọi tên RPC và trường của App chỉ được nằm trong `src/server/app-adapter/` (Nguyên tắc II).
- Kiểm thử với App thật chỉ tạo đối tượng có tiền tố `[agent-office-test]` và PHẢI dọn trong
  `finally`. Không được tự đổi cài đặt của App.
- Không in, ghi log hay lưu CSRF token, email hay nội dung chat chưa che.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Chuẩn bị hạ tầng kiểm thử cho hai bộ fixture

- [X] T001 Trong `tests/contract/helpers.ts`:
  - Thêm `export const FIXTURE_SETS: string[]`, **lấy từ danh sách thư mục** `fixtures/app-*`
    (`readdirSync`, bỏ tiền tố `app-`, sắp xếp mới nhất trước). Không ghi cứng số phiên bản
    (Nguyên tắc II).
  - Thêm hàm `fixturesDir(version)` trả về `join(import.meta.dirname, 'fixtures', 'app-' + version)`.
  - Giữ `FIXTURES` (trỏ 2.24.0) để test cũ không vỡ.
  - Thêm `hasFixture(version, file)`, để `describe.each` bỏ qua file chưa ghi bằng `it.skipIf`,
    kèm lý do.
- [X] T002 [P] Trong `scripts/record-fixtures.ts`:
  - Chọn thư mục ghi theo `appVersion` lấy từ `adapter.getConnection()`
    (`tests/contract/fixtures/app-<version>/`). Từ chối nếu `appVersion === 'unknown'`.
  - Nhận nhiều cặp `--conversation <name>=<id>`, mỗi cặp ghi ra
    `GetCascadeTrajectorySteps.<name>.json`. Cặp không có tên thì ghi vào
    `GetCascadeTrajectorySteps.json`.
  - Chỉ nhận conversation có tiêu đề hoặc tin nhắn đầu bắt đầu bằng `[agent-office-test]`.
  - Thêm cờ `--sweep`: chỉ dọn các đối tượng thử còn sót (gọi `sweepTestArtifacts()` của T009),
    không ghi fixture. Phần gọi hàm được nối vào sau khi T009 xong.
  - Sửa comment đầu file, bỏ "2.24.0".

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Kiểu dữ liệu nghiệp vụ dùng chung, và phần che thông tin cho các trường mới. Fixture
2.29.0 (US1) và mapper lỗi (US3) đều cần phần che này.

**⚠️ CRITICAL**: Phải xong trước khi ghi bất kỳ fixture 2.29.0 nào

- [X] T003 Mở rộng `src/shared/domain.ts` theo data-model §3–§4:
  - Thêm `'question'` và `'web_search'` vào `STEP_KINDS`.
  - Thêm `type QuestionState = 'waiting' | 'answered' | 'skipped' | 'canceled'`.
  - Thêm `interface QuestionEntry { question: string; options: { id: string; text: string }[];
    multiSelect: boolean; selectedOptionIds: string[]; writeIn: string | null }`.
  - Thêm `interface AgentQuestion { requestId: string; state: QuestionState; entries:
    QuestionEntry[] }` (entries ≥ 1).
  - Thêm `question: AgentQuestion | null` vào `Step`.
  - Thêm `QuestionAnswer { answers: { selectedOptionIds: string[]; writeIn?: string }[] }`.
  - Cập nhật `mapStep` trong `src/server/app-adapter/mappers/step.ts` để khởi tạo
    `question: null`.
  - Thêm nhánh `case` rỗng cho hai kind mới trong `src/web/ui/chat/StepView.tsx` (hiện như
    `other`), để `npm run typecheck` pass.
- [X] T004 [P] Thêm vào `CONTENT_KEYS` của `src/server/app-adapter/redact.ts` các khoá
  `'question'`, `'shortError'`, `'fullError'`, `'query'`, `'writeInResponse'` (contracts/app-adapter.md
  A3-4).
- [X] T005 [P] Thêm test vào `tests/leaks/redaction.test.ts`:
  - Đầu vào: một object tổng hợp chứa mỗi khoá mới của T004, với giá trị là chuỗi bí mật duy
    nhất (vd `secret-question-123`) và một chuỗi IP `192.168.1.2`.
  - Kỳ vọng: sau `sanitizeRaw`, `JSON.stringify` của kết quả không còn chuỗi gốc nào.

**Checkpoint**: `npm test` pass. Có thể ghi fixture 2.29.0 an toàn.

---

## Phase 3: User Story 1 - Dùng bình thường trên App 2.29.0 (Priority: P1) 🎯 MVP

**Goal**: Danh sách phiên bản đã kiểm chứng nằm ở một nơi duy nhất. Có bộ fixture 2.29.0, contract
test pass trên cả hai bộ, kiểm thử đọc và ghi với App thật pass, rồi mới công nhận 2.29.0 và cập nhật
tài liệu cùng constitution.

**Independent Test**: quickstart.md §2 (`npm test`, `AGENT_OFFICE_LIVE=1 npm run test:live`) và
§3 (M1–M6). Sau cổng, khởi động 10 lần không có cảnh báo phiên bản (SC-001).

### Tests for User Story 1

- [X] T006 [P] [US1] Tạo `tests/contract/versions.test.ts` (contracts/app-adapter.md A3-1a/b):
  - `isVerified('2.24.0') === true`.
  - `isVerified('2.30.0') === false`.
  - `isVerified('unknown') === false`.
  - `VERIFIED_APP_VERSIONS` sắp xếp bản mới nhất ở đầu.
  - Mỗi phần tử có `version`, `verifiedOn` (ISO date), `evidence`.
- [X] T007 [P] [US1] Trong `tests/contract/adapter-read.test.ts`:
  - Kiểm thử connection: kỳ vọng `{ kind: 'connected', appVersion: '2.24.0', versionSupported: true,
    verifiedVersions: [...] }`.
  - Thêm ca `2.30.0`: `versionSupported: false`, đọc và ghi vẫn chạy (A3-1c).
  - Chuyển khối "mappers on recorded fixtures" sang `describe.each(FIXTURE_SETS)`, dùng
    `fixturesDir(version)`.
- [X] T008 [P] [US1] Chuyển các test đọc fixture sang `describe.each(FIXTURE_SETS)`, giữ assert riêng
  của 2.24.0 trong `describe` riêng:
  - `tests/contract/adapter-commands.test.ts`
  - `tests/contract/adapter-current-model.test.ts`
  - `tests/contract/adapter-project.test.ts`
  - `tests/contract/adapter-permission.test.ts`: chạy trên mọi bộ có `waiting-steps.json`. Bộ 2.29.0
    có file này nhờ T011 (ghi từ App thật).
  - `tests/contract/adapter-write.test.ts`: body gửi đi không phụ thuộc fixture, chạy một lần. Ghi
    chú ở đầu file: "body contract, không phụ thuộc phiên bản fixture" (FR-006).
- [X] T009 [US1] Tạo `tests/live/sweep.ts` với `sweepTestArtifacts()` (edge case "kiểm thử bị
  gián đoạn"):
  - Liệt kê conversation có tiêu đề hoặc tin nhắn đầu bắt đầu bằng `[agent-office-test]`, và
    project có tên bắt đầu bằng `[agent-office-test]`.
  - Xoá **chỉ qua** `deleteTestConversation` / `deleteTestProject` (hai hàm này tự từ chối đối
    tượng không có đánh dấu).
  - Gọi hàm này trong `beforeAll` của mọi file `tests/live/*.live.test.ts`. Nối nó vào cờ
    `--sweep` của `scripts/record-fixtures.ts` (cờ đã khai báo ở T002).
  - In số đối tượng đã dọn. Không in tiêu đề hay nội dung.
- [X] T010 [P] [US1] Tạo `tests/live/project.live.test.ts` (R3-09). Chỉ chạy khi
  `AGENT_OFFICE_LIVE=1`:
  1. `createProject({ name: '[agent-office-test] project', folderUri })`, với `folderUri` là một
     thư mục tạm trong `os.tmpdir()`.
  2. `startConversation({ projectId, parts: [{ text: '[agent-office-test] project. Reply OK only. No tools.' }], model: <Flash> })`.
  3. Kiểm tra `listConversations()` có conversation với đúng `projectId`.
  4. `finally`: `deleteTestConversation`, rồi `deleteTestProject`.
- [X] T011 [P] [US1] Tạo `tests/live/permission.live.test.ts` (R3-09):
  1. Tạo conversation `[agent-office-test] permission` và yêu cầu agent chạy lệnh vô hại
     `echo agent-office-permission`.
  2. Chờ tối đa 60 s một bước `kind === 'permission_request'` có `status === 'WAITING'`.
     - Nếu App tự chạy lệnh (không có bước chờ): `it.skip`, kèm thông báo "App đang tự duyệt
       lệnh, kiểm chứng bằng tay quickstart M4".
     - KHÔNG đổi cài đặt App.
  3. Trước khi trả lời, nếu biến môi trường `AGENT_OFFICE_RECORD=1` được đặt: gọi thẳng
     `recordRaw('GetCascadeTrajectorySteps', { cascadeId: id })` (đã che thông tin), rồi ghi kết quả
     vào `tests/contract/fixtures/app-<appVersion>/waiting-steps.json`. `appVersion` lấy từ
     `getConnection()`, không ghi cứng. Tên file trùng với bộ 2.24.0 để `describe.each` dùng chung.
     Không gọi script từ trong test.
  4. `answerPermission(..., 'allow')`, kiểm tra bước chuyển khỏi WAITING. Lặp lại với lệnh thứ hai
     và `'deny'`.
  5. Dọn trong `finally`.

### Implementation for User Story 1

- [X] T012 [US1] Tạo `src/server/app-adapter/versions.ts` (R3-01, data-model §1):
  - `export interface VerifiedAppVersion { version: string; verifiedOn: string; evidence: string }`.
  - `export const VERIFIED_APP_VERSIONS: readonly VerifiedAppVersion[] = [{ version: '2.24.0',
    verifiedOn: '2026-11-06', evidence: 'specs/001-3d-agent-office' }]`. **Chưa** thêm 2.29.0.
  - `export function isVerified(v: string): boolean`.
  - `export function verifiedVersionList(): string[]`.
- [X] T013 [US1] Nối `versions.ts` vào hệ thống:
  - Sửa `src/server/app-adapter/connection.ts`: dùng `isVerified` và thêm `verifiedVersions:
    verifiedVersionList()` vào state `connected`.
  - Trong `src/shared/domain.ts`: thêm `verifiedVersions: string[]` vào `ConnectionState`, và **xoá**
    `SUPPORTED_APP_VERSION`.
  - Cập nhật mọi nơi tạo `ConnectionState` connected:
    - `src/web/bench/Bench.tsx` (`verifiedVersions: []`)
    - `tests/unit/visual-state.test.ts`
    - `tests/contract/adapter-permission.test.ts`
    - `tests/contract/helpers.ts`
- [X] T014 [US1] Sửa câu cảnh báo trong `src/server/main.ts:23` thành
  `` `Antigravity App ${s.appVersion} chưa được kiểm chứng (đã kiểm chứng: ${s.verifiedVersions.join(', ')}). Một số tính năng có thể không hoạt động.` ``
  (L3-2).
  - Kiểm tra `src/web/state/connection.ts` và nơi hiển thị cảnh báo trên web. Nếu web dựng câu
    riêng thì cũng dùng `verifiedVersions`.
- [X] T015 [US1] Thêm guard vào `scripts/check-guards.sh` (A3-1d): grep `'\b2\.(24|29)\.0\b'` trong
  `src/` (bỏ qua `src/server/app-adapter/versions.ts`). Có kết quả thì exit 1, kèm thông báo
  "App version literal outside versions.ts".
  - Viết lại các comment đang chứa "2.24.0" cho không kèm số phiên bản (ví dụ "theo fixture đã
    ghi"), hoặc trỏ tới `versions.ts`. Các file cần sửa: `mappers/step.ts`, `mappers/command.ts`,
    `mappers/conversation.ts`, `index.ts`.
- [X] T016 [US1] Ghi fixture 2.29.0 từ App thật (cần App 2.29.0 mở, sau Phase 2):
  1. Viết script tạm trong scratchpad, chỉ dùng API public của adapter:
     - Tạo thư mục tạm trong `os.tmpdir()` có `README.md`.
     - `createProject({ name: '[agent-office-test] fixture', folderUri: 'file://<thư mục tạm>' })`.
     - `startConversation({ projectId, … })` với prompt: *"[agent-office-test] fixture. Run `ls`
       in the workspace, view README.md, then create a new file test-fixture.md containing one
       line `<!-- test -->`"*.
     - Tạo thêm một conversation `[agent-office-test] fixture-search` trong cùng project, với
       prompt *"[agent-office-test] Search the web for 'Open-Meteo API' and reply with one
       sentence."* (bước SEARCH_WEB thật cho US3).
  2. Chờ IDLE, rồi chạy
     `npx tsx scripts/record-fixtures.ts --conversation tools=<id> --conversation search-web=<id2>`.
  3. Kiểm tra bằng mắt `tests/contract/fixtures/app-2.29.0/*.json`: không có email, tên người
     dùng, đường dẫn home hay nội dung chat.
  4. Dọn conversation bằng `deleteTestConversation`, project bằng `deleteTestProject`, và xoá
     thư mục tạm.
- [X] T017 [US1] Chạy `npm test`. Sửa mapper trong `src/server/app-adapter/mappers/` nếu bộ 2.29.0
  làm vỡ test. Không được nới assert của bộ 2.24.0 (FR-007).
- [X] T018 [US1] Chạy `AGENT_OFFICE_LIVE=1 npm run test:live` (chat, latency, project, permission)
  trên App 2.29.0.
  - Thực hiện M1–M6 trong `specs/003-antigravity-2-29-compat/quickstart.md` §3.
  - Ghi kết quả (ngày, pass/skip/fail, ghi chú) vào phần mới `## Kết quả kiểm chứng 2.29.0` cuối
    `quickstart.md`.
  - Nếu có fail: sửa trong adapter, rồi chạy lại. **Dừng, không làm T019** cho tới khi tất cả pass
    hoặc được giải trình (FR-003).
- [X] T019 [US1] **Cổng FR-003** (T019, T020 và T021 PHẢI vào **cùng một commit**, theo Nguyên tắc II
  v2.1.1: tài liệu và constitution được cập nhật trong cùng thay đổi với danh sách): thêm
  `{ version: '2.29.0', verifiedOn: '<ngày T018 pass>', evidence: 'specs/003-antigravity-2-29-compat' }`
  vào đầu `VERIFIED_APP_VERSIONS` trong `src/server/app-adapter/versions.ts`.
  - Cập nhật `tests/contract/versions.test.ts`: `isVerified('2.29.0') === true`, bản mới nhất ở đầu.
  - Kiểm tra SC-001: khởi động lại Agent Office (`npm start`, Ctrl+C) **10 lần liên tiếp**. Mỗi lần
    terminal in `Antigravity App 2.29.0: connected` và không có dòng cảnh báo phiên bản. Ghi kết
    quả (10/10) vào `quickstart.md` mục "Kết quả kiểm chứng".
- [X] T020 [US1] Cập nhật tài liệu (FR-017), trong cùng commit với T019:
  - `README.md:26`: "Kết nối trực tiếp với Antigravity App (đã kiểm chứng 2.29.0 và 2.24.0)".
  - `docs/INSTALL.md`:
    - Bảng yêu cầu dòng 12.
    - Dòng 54: in `Antigravity App <phiên bản>: connected`.
    - Dòng 61: cảnh báo liệt kê các bản đã kiểm chứng.
    - Thêm một dòng vào nhật ký chạy thử: 2026-11-xx, App 2.29.0.
  - `scripts/install.sh:37`: "Hãy mở Antigravity App (đã kiểm chứng 2.29.0, 2.24.0)".
- [X] T021 [US1] Chạy `/speckit-constitution` để sửa PATCH v2.1.2 (R3-10), trong cùng commit với T019 và T020:
  - Chuyển 2.29.0 vào danh sách đã kiểm chứng trong Nguyên tắc II và mục Ràng buộc kỹ thuật
    của `.specify/memory/constitution.md`.
  - Nêu bằng chứng: kết quả T018.
  - Xoá Sync Impact Report trước khi commit.
  - Commit chung T019 + T020 + T021, rồi chạy `npm test` trên commit đó: guard phiên bản và
    `versions.test.ts` phải pass.

**Checkpoint**: 2.29.0 được công nhận; SC-001 và SC-002 đạt. Có thể giao đợt 1.

---

## Phase 4: User Story 2 - Nhân viên hỏi sếp thì sếp thấy và trả lời được (Priority: P2)

**Goal**: Bước `ASK_QUESTION` thành `kind: 'question'`. Nhân viên ở trạng thái "chờ sếp". Người
dùng trả lời bằng radio, checkbox hoặc ô "Khác", và App nhận đúng đáp án.

**Independent Test**: quickstart.md §4 và `tests/live/question.live.test.ts`.

### Spike S1 (chạy đầu tiên)

- [X] T022 [US2] Spike S1 (research R3-04). Script tạm trong scratchpad, dùng API adapter:
  1. Tạo conversation `[agent-office-test] question` với prompt ở quickstart §4.
  2. Khi bước ASK_QUESTION đang WAITING, chạy
     `record-fixtures.ts --conversation waiting-question=<id>`. Kết quả:
     `tests/contract/fixtures/app-2.29.0/GetCascadeTrajectorySteps.waiting-question.json`.
  3. Ghi lại các trường thật của `requestedInteraction.askQuestion`.
  4. Gửi `HandleCascadeUserInteraction` theo dạng của R3-04: câu (1) dùng `selectedOptionIds`,
     câu (2) dùng cả `selectedOptionIds` và `writeInResponse`. Ghi lại App có chấp nhận dạng kết
     hợp không.
  5. Ghi tiếp `--conversation question=<id>` khi bước đã DONE.
  6. Gửi lại lần hai và ghi lại mã lỗi App trả về.
  7. Ghi kết luận vào mục "Kết quả spike S1" cuối `research.md` R3-04.
  8. Dọn conversation.

### Tests for User Story 2

- [X] T023 [P] [US2] Tạo `tests/contract/adapter-question.test.ts`, chạy trên fixture 2.29.0 của
  T022 (A3-2a–d):
  - Bước WAITING cho ra `kind: 'question'`, `question.state: 'waiting'` và `permission: null`.
    `kind` không phải `'permission_request'`.
  - Bước DONE cho ra `state: 'answered'`, các entry có `selectedOptionIds` và `writeIn` đúng.
  - Biến thể `status: CORTEX_STEP_STATUS_CANCELED` cho ra `'canceled'`.
  - Biến thể entry `skipped: true` không có đáp án cho ra `'skipped'`.
  - Biến thể thiếu `isMultiSelect` cho ra `multiSelect: false`.
- [X] T024 [P] [US2] Thêm vào `tests/contract/adapter-question.test.ts` các ca cho `answerQuestion`
  (A3-3a–d), dùng transport giả như trong `adapter-write.test.ts`:
  - Body gửi đi bằng đúng
    `{ cascadeId, interaction: { trajectoryId, stepIndex, askQuestion: { responses: [{ question, selectedOptionIds, writeInResponse? }] } } }`.
  - Bước không còn WAITING thì ném `QuestionNotPendingError`.
  - Transport trả 400 thì ném `AppRejectedError`, và message không chứa nội dung lỗi gốc.
  - `requestId` sai định dạng, hoặc có kind khác `askQuestion`, thì ném `RpcError('protocol')` và
    không gọi transport.
  - `answerPermission` với `requestId` kind `askQuestion` thì bị từ chối.
- [X] T025 [P] [US2] Tạo `tests/unit/question-answer.test.ts` cho hàm kiểm tra hợp lệ
  (data-model §5):
  - `answers.length === entries.length`.
  - Mỗi câu trả lời: `selectedOptionIds.length ≥ 1` hoặc `writeIn` không rỗng sau trim.
  - `multiSelect = false` thì `selectedOptionIds.length ≤ 1`.
  - Mỗi id phải thuộc `options` của câu con.
  - `writeIn` tối đa 2 000 ký tự.
- [X] T026 [P] [US2] Thêm ca vào `tests/unit/visual-state.test.ts`: nhân viên có bước cuối
  `kind: 'question'`, `status: 'WAITING'` thì ở trạng thái chờ (U3-7).

### Implementation for User Story 2

- [X] T027 [US2] Trong `src/server/app-adapter/mappers/step.ts` (R3-04, R3-07, data-model §4):
  - Thêm `ASK_QUESTION: 'question'` vào `TYPE_MAP`.
  - Thêm `case 'ASK_QUESTION'` để dựng `AgentQuestion`:
    - `requestId = "<trajectoryId>:<index>:askQuestion"`.
    - Đọc entry từ `raw.askQuestion.questions`. Nếu bước DONE thì ưu tiên
      `completedInteractions[-1].response.askQuestion.responses`.
    - Map `isMultiSelect` → `multiSelect` (thiếu thì `false`), `writeInResponse` → `writeIn`.
    - `state` theo bảng trong data-model §4.
  - Đổi điều kiện `permissionFrom`: **không** áp dụng khi `rawType === 'ASK_QUESTION'`.
- [X] T028 [US2] Trong `src/server/app-adapter/types.ts` và `src/server/app-adapter/index.ts`:
  - Thêm `answerQuestion(conversationId, requestId, answer: QuestionAnswer): Promise<void>` vào
    `AppAdapter`.
  - Thêm `QuestionNotPendingError` (code `QUESTION_NOT_PENDING`) và `AppRejectedError` (code
    `APP_REJECTED`), export từ `index.ts`.
  - Cài đặt theo A3-3:
    1. Tách `requestId`.
    2. Đọc lại các bước. Nếu bước không WAITING thì ném `QuestionNotPendingError`.
    3. Dựng `responses`, lấy `question` từ entry hiện tại.
    4. Gọi `HandleCascadeUserInteraction`.
    5. `RpcError` kind `protocol` có status 4xx thì chuyển thành `AppRejectedError`.
  - Áp dụng điều chỉnh từ kết quả spike T022.
  - `answerPermission` ném `RpcError('protocol')` nếu kind là `askQuestion`.
- [X] T029 [US2] Thêm vào `src/shared/schemas.ts`:
  - `questionAnswerSchema` (zod): `{ answers: z.array(z.object({ selectedOptionIds:
    z.array(z.string().max(100)).max(50), writeIn: z.string().max(2000).optional() })).min(1).max(20) }`.
  - Hàm thuần `validateAnswer(question: AgentQuestion, answer: QuestionAnswer): string | null`
    theo đúng các quy tắc của T025.
- [X] T030 [US2] Thêm route `POST /api/conversations/:id/questions/:requestId` vào
  `src/server/http/routes/commands.ts` (L3-1):
  - Kiểm tra `ID`, `REQ` và `questionAnswerSchema`.
  - Đọc bước qua `adapter.getSteps`, tìm câu hỏi và chạy `validateAnswer`. Sai thì `400 BAD_REQUEST`.
  - Gọi `adapter.answerQuestion`, sau đó `void services.employees.refresh()` và trả `202 {}`.
  - `QuestionNotPendingError` → `409 QUESTION_NOT_PENDING`.
  - `AppRejectedError` → `422 APP_REJECTED`, không kèm chi tiết lỗi của App.
  - Mất kết nối → `503` qua `unavailable`.
  - Thêm ca vào test route hiện có, hoặc tạo `tests/contract/routes-question.test.ts`, cho
    202/400/409/422.
- [X] T031 [P] [US2] Thêm kịch bản `question` vào `tests/e2e/mock-app.ts` (L3-4):
  - Một conversation có bước ASK_QUESTION ở WAITING, gồm 2 entry: entry 1 chọn một, 2 lựa chọn;
    entry 2 `isMultiSelect: true`, 3 lựa chọn.
  - Handler `HandleCascadeUserInteraction` nhận `askQuestion` thì chuyển bước sang DONE và ghi
    `selectedOptionIds` / `writeInResponse`.
  - Thêm cờ `rejectQuestion` để handler trả HTTP 400.
- [X] T032 [US2] Tạo `src/web/ui/chat/QuestionPrompt.tsx` (U3-1, U3-2, U3-6):
  - Mỗi entry: câu hỏi dạng markdown (dùng renderer markdown như tin nhắn agent trong
    `StepView.tsx`), rồi radio nếu `!multiSelect`, checkbox nếu `multiSelect`.
  - Luôn có ô "Khác" (text input, tối đa 2 000 ký tự).
  - Nút "Gửi" chỉ bật khi mọi entry đã có đáp án.
  - POST tới L3-1:
    - 202: khoá form, hiện "Đã gửi".
    - 409: hiện "Câu hỏi đã được trả lời ở nơi khác" và làm mới các bước.
    - 422: hiện "App không nhận câu trả lời này", **giữ nguyên** lựa chọn và nội dung gõ (FR-010a).
  - Câu hỏi chuyển sang `canceled` (hoặc `answered` / `skipped` từ nơi khác) trong lúc form đang mở:
    form **không biến mất** mà bị khoá. Hiện "Câu hỏi đã bị huỷ" (hoặc "đã được trả lời ở nơi
    khác"), giữ nguyên lựa chọn để người dùng đọc lại. Không gửi gì. Đóng thông báo thì form biến mất.
  - Chọn đáp án có sẵn và gõ "Khác" ở cùng câu con: làm theo kết luận spike S1 (T022).
    - App chấp nhận cả hai: gửi cả hai.
    - App chỉ nhận một: khi người dùng có cả hai, nút "Gửi" bị tắt và hiện "Chọn đáp án có sẵn
      hoặc nhập câu trả lời khác, không dùng cả hai".
  - Thêm `data-testid` `question-prompt`, `question-option-<entry>-<id>`,
    `question-writein-<entry>`, `question-submit` vào `tests/e2e/testids.ts`.
  - Nội dung dài tự xuống dòng, không tràn khung chat ở 390 px.
- [X] T033 [US2] Trong `src/web/ui/chat/ChatPanel.tsx:67-109`:
  - Tìm bước cuối `kind === 'question' && question?.state === 'waiting'`. Nếu có thì render
    `<QuestionPrompt key={question.requestId} …/>` thay cho `PermissionPrompt`.
  - Giữ lại `requestId` của câu hỏi đang mở. Khi câu hỏi đó rời trạng thái `waiting`, tiếp tục render
    `QuestionPrompt` ở chế độ khoá (T032) cho tới khi người dùng đóng thông báo.
  - Giữ nguyên `PermissionPrompt` cho `permission_request`.
- [X] T034 [US2] Trong `src/web/ui/chat/StepView.tsx`, `case 'question'` (U3-3):
  - Hiện từng câu hỏi kèm đáp án đã chọn (text của option) hoặc `writeIn`.
  - `skipped` → "đã bỏ qua"; `canceled` → "đã huỷ".
  - `waiting` → một dòng "Agent đang hỏi bạn…" (form nằm ở `QuestionPrompt`).
- [X] T035 [US2] Tạo `tests/e2e/question.spec.ts` (mock App, kịch bản `question`):
  - Không có nút "Cho phép / Từ chối".
  - Chọn 1 radio và 2 checkbox rồi gửi: mock nhận đúng body.
  - Gõ "Tím" vào ô "Khác": mock nhận `writeInResponse: 'Tím'`.
  - Nút gửi bị tắt khi thiếu đáp án.
  - Bật `rejectQuestion`: hiện lỗi và giữ nguyên lựa chọn.
  - Mock chuyển bước sang `CANCELED` trong lúc form đang mở: form bị khoá, hiện "Câu hỏi đã bị
    huỷ", không có request POST nào.
  - Chọn đáp án và gõ "Khác" ở cùng câu con: hành vi đúng theo kết luận S1 (T032).
  - Lịch sử hiện đáp án sau khi DONE.
- [X] T036 [US2] Tạo `tests/live/question.live.test.ts` (A3-3e). Ba lần, mỗi lần một conversation
  `[agent-office-test] question-<n>`, yêu cầu agent dùng `ask_question`:
  - (a) chọn 1 đáp án; (b) chọn nhiều đáp án; (c) trả lời tự do.
  - Mỗi lần: chờ WAITING, gọi `answerQuestion`, chờ bước DONE với đúng đáp án, và agent có bước
    `PLANNER_RESPONSE` mới.
  - Dọn trong `finally`.
- [X] T037 [US2] Chạy quickstart.md §4 bằng tay trên App 2.29.0, gồm cả kiểm tra 2 tab → 409.
  - Đo thời gian từ khi bước WAITING xuất hiện tới khi nhân viên vẫy tay: phải ≤ 2 s (SC-003).
  - Đếm số lần bấm từ màn hình chính tới khi gửi xong một câu hỏi một câu con: bấm nhân viên → chọn
    đáp án → bấm "Gửi", phải ≤ 3 (SC-003).
  - Ghi kết quả vào `quickstart.md` mục "Kết quả kiểm chứng".

**Checkpoint**: US2 hoạt động độc lập; SC-003 đạt.

---

## Phase 5: User Story 3 - Thấy rõ lỗi và tra cứu web (Priority: P3)

**Goal**: Bước lỗi có nội dung (đã che), bước tìm kiếm web hiện "Đã tìm: …".

**Independent Test**: quickstart.md §5. Sau khi làm, `check:compat`, hoặc script quét ở T041, cho
thấy 0 bước lỗi rỗng và 0 bước `other` thuộc loại ASK_QUESTION hoặc SEARCH_WEB (SC-004).

### Tests for User Story 3

- [X] T038 [P] [US3] Chuẩn bị fixture cho bước lỗi và tìm kiếm (Nguyên tắc II: dữ liệu ghi từ App thật
  là nguồn chính, biến thể chỉ bổ sung):
  - **Tìm kiếm web**: dùng file **ghi thật** `GetCascadeTrajectorySteps.search-web.json` từ T016.
  - **Bước lỗi**: không gây được lỗi cố ý một cách an toàn. Nếu trong lúc chạy T016, T022 hoặc
    T036 có conversation `[agent-office-test]` gặp lỗi thật, ghi nó thành
    `GetCascadeTrajectorySteps.error-message.json`.
  - Ngoài ra, tạo **biến thể** `tests/contract/fixtures/app-2.29.0/error-message-variants.json`.
    Cấu trúc theo đúng bước ERROR_MESSAGE thật đã quan sát (research R3-05,
    `errorMessage.error.{ shortError, errorId }`), giá trị là chuỗi giả. Trường `_comment` ghi:
    "variants, shape from recorded App 2.29.0 step 2026-11-08". Các biến thể:
    - lỗi không có `shortError` lẫn `errorId`;
    - có `errorId`, không có `shortError`;
    - `shortError` chứa một token đã `registerSecret`.
  - **Không** dùng tên `error-steps.json`: tên này đã có trong bộ 2.24.0 và mang nghĩa khác (lỗi
    lúc duyệt quyền, spike T029).
- [X] T039 [P] [US3] Tạo `tests/contract/adapter-steps-2-29.test.ts` (A3-2e–g):
  - Đọc `error-message-variants.json`, `GetCascadeTrajectorySteps.search-web.json`, và
    `GetCascadeTrajectorySteps.error-message.json` nếu có (`it.skipIf` kèm lý do khi chưa có).
  - Lỗi có `shortError` → `kind: 'error'`, `text` đúng.
  - Lỗi có token đã đăng ký → `text` không chứa token.
  - Không có chuỗi nào → `'Lỗi không rõ nguyên nhân'`.
  - Chỉ có `errorId` → `'Lỗi không rõ nguyên nhân (mã <errorId>)'`.
  - `SEARCH_WEB` → `kind: 'web_search'`, `text = query`.

### Implementation for User Story 3

- [X] T040 [US3] Trong `src/server/app-adapter/mappers/step.ts` (R3-05, R3-06):
  - Thêm `SEARCH_WEB: 'web_search'` vào `TYPE_MAP`.
  - `case 'ERROR_MESSAGE'`: `text = redactString(shortError ?? userErrorMessage ?? message)`. Nếu
    rỗng thì `'Lỗi không rõ nguyên nhân'`, thêm `` ` (mã ${errorId})` `` khi có `errorId`.
  - `case 'SEARCH_WEB'`: `text = searchWeb.query`.
  - Import `redactString` từ `../../log`.
- [X] T041 [US3] Trong `src/web/ui/chat/StepView.tsx` (U3-4, U3-5):
  - `case 'error'`: hiện tối đa 300 ký tự. Phần dài hơn có nút "Xem thêm" để mở toàn bộ.
  - `case 'web_search'`: một dòng "Đã tìm: <text>", cùng kiểu với bước `file_view`.
  - Thêm kịch bản lỗi dài và tìm kiếm vào `tests/e2e/mock-app.ts`, và ca kiểm thử vào
    `tests/e2e/chat.spec.ts`.
- [X] T042 [US3] Chạy quickstart.md §5 bằng tay. Dùng script quét tạm (giống buổi điều tra) đếm
  trên toàn bộ conversation hiện có:
  - bước `error` có `text` rỗng;
  - bước `other` có `rawType` ASK_QUESTION hoặc SEARCH_WEB.
  - Cả hai số phải bằng 0 (SC-004). Ghi kết quả vào `quickstart.md`.

**Checkpoint**: US3 hoạt động độc lập; SC-004 đạt.

---

## Phase 6: User Story 4 - Lệnh kiểm tra tương thích lặp lại được (Priority: P3)

**Goal**: `npm run check:compat` in báo cáo chỉ-đọc trong ≤ 2 phút.

**Independent Test**: quickstart.md §1. Kết quả khớp bảng "Kết quả điều tra" trong spec, và số
conversation/project trong App không đổi trước và sau khi chạy.

### Tests for User Story 4

- [X] T043 [P] [US4] Tạo `tests/contract/compat.test.ts`, dùng finder và transport giả:
  - `rpcs` báo `present: false` khi tên RPC không có trong nội dung "binary" giả.
  - `fieldDiff` báo đúng `added`/`removed` khi phản hồi giả khác fixture: khoá UUID hoặc số
    được chuẩn hoá thành `*`.
  - `unknownStepTypes` đếm đúng `rawType` của các bước `other`.
  - Transport giả ghi lại mọi method được gọi; tất cả phải thuộc `READ_ONLY_RPCS`.
  - `JSON.stringify(report)` không chứa chuỗi nội dung nào của phản hồi giả.

### Implementation for User Story 4

- [X] T044 [US4] Tạo `src/server/app-adapter/compat.ts` theo R3-08 / data-model §6. Các hàm thuần:
  - `scanRpcNames(binary: Buffer, names: string[])`: tìm `LanguageServerService/<name>`.
  - `normalizedPaths(json)`: đường dẫn khoá, UUID và số thay bằng `*`, mảng ghi `[]`.
  - `diffPaths(current, baseline)`.
  - `countUnknownStepTypes(steps: Step[])`.
  - Danh sách RPC adapter dùng nằm thành hằng `USED_RPCS` ở đây. Thêm test unit nhỏ quét **mọi
    file** `src/server/app-adapter/**/*.ts` và kiểm tra mọi tên RPC trong `call('X'`,
    `rpc.call('X'`, `transport.call(…, 'X'` và `openStream(…, 'X'` đều có trong `USED_RPCS`. Ít
    nhất phải bắt được `GetAllWorkflows` (connection.ts, probe.ts) và `StreamAgentStateUpdates`
    (index.ts).
- [X] T045 [US4] Thêm `export async function inspectCompat(opts?: { baselineDir?: string }):
  Promise<CompatReport>` vào `src/server/app-adapter/index.ts` (A3-5):
  1. Dò process, đọc file chạy ở `args[0]` (chỉ đọc).
  2. Gọi các RPC chỉ-đọc `GetAllCascadeTrajectories`, `GetUserStatus`, `GetAllSkills`,
     `ListProjects`, `GetSlashCommands`, và `GetCascadeTrajectorySteps` cho mọi conversation có
     `stepCount > 0`.
  3. Qua `sanitizeRaw`, so sánh với bộ fixture mới nhất (bản đầu tiên trong
     `VERIFIED_APP_VERSIONS` có thư mục fixture; mặc định `tests/contract/fixtures/app-<v>/`).
  4. Trả về `CompatReport`, có đo `durationMs`.
  - Thêm kiểu `CompatReport` vào `src/server/app-adapter/types.ts`.
- [X] T046 [US4] Tạo `scripts/check-compat.ts`:
  - Chỉ import `inspectCompat` từ adapter.
  - Mặc định in bảng Markdown gồm 4 phần (phiên bản và trạng thái kiểm chứng, RPC còn/mất, trường
    thêm/bớt theo RPC, loại bước lạ).
  - `--json` in JSON. `--out <file>` mới ghi file. `--baseline <version>` chọn bộ fixture để so
    sánh; mặc định là bộ mới nhất trong `VERIFIED_APP_VERSIONS` có thư mục fixture. In bộ đang dùng
    ở dòng đầu báo cáo.
  - Exit code 0 khi không có RPC mất, ngược lại 1.
  - Thêm `"check:compat": "tsx scripts/check-compat.ts"` vào `package.json`.
- [X] T047 [US4] Thêm guard vào `scripts/check-guards.sh`: `scripts/check-compat.ts` chỉ được import
  `inspectCompat` (grep các dòng `import`). Không có `recordRaw`, `deleteTest*`, hay
  `createAppAdapter`.
  - Guard FR-016a: `inspectCompat` và `compat.ts` không được import ở `src/server/` ngoài
    `src/server/app-adapter/index.ts`, và không được import ở `src/web/`. Như vậy Agent Office
    không tự chạy kiểm tra.
- [X] T048 [US4] Chạy `npm run check:compat` trên App 2.29.0, đếm số conversation và project trước
  và sau. Kiểm tra:
  - ≤ 2 phút;
  - kết quả khớp quickstart.md §1 (đúng giai đoạn: trước hoặc sau T019);
  - không có conversation hay project mới.
  - Ghi kết quả vào `quickstart.md`.

**Checkpoint**: US4 hoạt động độc lập; SC-005 đạt.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T049 [P] Cập nhật bảng "Hành vi bắt buộc" trong `specs/001-3d-agent-office/contracts/app-adapter.md`:
  - Dòng A3 thành "xem `specs/003-antigravity-2-29-compat/contracts/app-adapter.md` A3-1".
  - Mục "Các RPC đang dùng": bỏ "(App 2.24.0, …)", thay bằng "(xem `versions.ts`)".
- [X] T050 Chạy toàn bộ cổng chất lượng (quickstart.md §6):
  - `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:leaks`.
  - `npm run test:e2e` trên GPU thật.
  - `npm run bench:fps` một lần (lấy lần đo thứ hai), xác nhận ≥ 60 FPS không giảm.
  - Ghi kết quả vào `quickstart.md`.
- [ ] T051 Chạy lại hướng dẫn `docs/INSTALL.md` từ bản clone sạch trên App 2.29.0, xác nhận ≤ 15
  phút, và ghi một dòng vào nhật ký chạy thử (Nguyên tắc VI).
- [ ] T052 Đánh dấu các success criteria đã đạt (SC-001…SC-006) trong
  `specs/003-antigravity-2-29-compat/quickstart.md` mục "Kết quả kiểm chứng". Ghi lại mọi phần bỏ
  qua kèm lý do.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: không phụ thuộc.
- **Phase 2 (Foundational)**: sau Phase 1. Chặn mọi user story; riêng T004 chặn việc ghi fixture.
- **US1 (Phase 3)**: sau Phase 2. Nội bộ US1 theo thứ tự:
  - T009 (dọn đối tượng thử) trước T010, T011 và mọi task live khác;
  - T012 → T013 → T014/T015;
  - T016 → T017 → T018 → **T019 + T020 + T021 (cổng, một commit duy nhất)**.
- **US2 (Phase 4)**: sau Phase 2. T022 (spike) trước mọi task khác của US2. Không chờ US1.
- **US3 (Phase 5)**: sau Phase 2. Không chờ US1/US2. T040 và T027 cùng sửa
  `mappers/step.ts`: làm tuần tự nếu một người làm.
- **US4 (Phase 6)**: sau Phase 2. So sánh trường cần bộ fixture 2.29.0 (T016), nhưng vẫn chạy được
  với bộ 2.24.0.
- **Polish (Phase 7)**: sau các story muốn giao.

### User Story Dependencies

```text
Setup → Foundational ─┬─► US1 (MVP, cổng 2.29.0)
                      ├─► US2 (spike S1 trước)
                      ├─► US3
                      └─► US4 (tốt nhất sau T016)
```

### Within Each User Story

- Test viết trước và PHẢI fail trước khi cài đặt (trừ test live, vốn là test kiểm chứng).
- US1: không thêm 2.29.0 vào `VERIFIED_APP_VERSIONS` trước khi T018 pass.
- US2: mapper → adapter → schema → route → UI → e2e → live.

## Parallel Opportunities

- Phase 1: T001 ‖ T002.
- Phase 2: T004 ‖ T005 (sau T003).
- US1: T006 ‖ T007 ‖ T008; T010 ‖ T011 (sau T009). Các task cổng T019–T021 làm tuần tự, chung một commit.
- US2: T023 ‖ T024 ‖ T025 ‖ T026 ‖ T031 (sau T022).
- US3: T038 ‖ T039.
- Giữa các story: sau Phase 2, US2, US3 và US4 có thể chạy song song với US1.

### Parallel Example: User Story 1

```text
Task: "T006 [US1] tests/contract/versions.test.ts"
Task: "T007 [US1] tests/contract/adapter-read.test.ts describe.each"
Task: "T010 [US1] tests/live/project.live.test.ts"
Task: "T011 [US1] tests/live/permission.live.test.ts"
```

### Parallel Example: User Story 2

```text
Task: "T023 [US2] tests/contract/adapter-question.test.ts (mapper)"
Task: "T025 [US2] tests/unit/question-answer.test.ts"
Task: "T031 [US2] tests/e2e/mock-app.ts kịch bản question"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1) tới T018: kiểm thử với App thật và kiểm tra tay M1–M6 đều pass.
3. **STOP and VALIDATE**: quickstart §2–3, SC-002. Sau đó T019 + T020 + T021 trong **một commit**:
   2.29.0 được công nhận, tài liệu và constitution cập nhật cùng lúc, cảnh báo biến mất (SC-001).

### Incremental Delivery

1. Đợt 1: US1, dùng hằng ngày được trên 2.29.0.
2. Đợt 2: US2, "chờ sếp" đúng với câu hỏi trắc nghiệm.
3. Đợt 3 và 4: US3 (lỗi, tìm kiếm) và US4 (`check:compat`), làm song song được.
4. Mỗi đợt kết thúc ở trạng thái dùng được (Nguyên tắc IV).

## Notes

- `[P]` = khác file, không phụ thuộc task chưa xong.
- Mỗi task live (T010, T011, T016, T018, T022, T036) cần App 2.29.0 đang mở và dùng một ít quota model.
- Commit sau mỗi task hoặc nhóm task logic. Dừng ở mỗi checkpoint để kiểm tra story độc lập.
