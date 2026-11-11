---
description: "Danh sách tác vụ cho 009 — Tuyển nhân viên từ conversation có sẵn"
---

# Tác vụ: Tuyển nhân viên từ conversation có sẵn

**Đầu vào**: Tài liệu thiết kế trong `specs/009-hire-from-conversation/`

**Điều kiện trước**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Kiểm thử**: Có. plan.md nêu một file unit, một file contract và một file e2e; cổng chất lượng của constitution yêu cầu test cho logic server mới.

**Tổ chức**: Các tác vụ được nhóm theo user story để mỗi story làm và kiểm thử độc lập được.

## Định dạng: `[ID] [P?] [Story] Mô tả`

- **[P]**: chạy song song được (khác file, không phụ thuộc tác vụ chưa xong)
- **[Story]**: US1…US5 trong spec.md

---

## Phase 1: Chuẩn bị

- [X] T001 Tạo và chuyển sang branch `009-hire-from-conversation` từ `008-doors-free-frames` (`git checkout -b 009-hire-from-conversation`); không thêm phụ thuộc mới.

---

## Phase 2: Nền tảng (chặn mọi story)

**Mục đích**: có tư cách thành viên và nó quyết định ai được hiện. Sau phase này, văn phòng chỉ hiện thành viên, và lần chuyển đổi giữ lại các nhân viên hiện có.

- [X] T002 [P] Trong `src/shared/domain.ts`: thêm `export const OFFICE_LIMIT = 20`; thêm `memberSince?: ISODateTime | null` vào `EmployeeProfile` ("Đặt khi sếp tuyển (mới hoặc có sẵn); null/không có = không ở trong văn phòng"); thêm `membersSeeded?: boolean` vào `EmployeeProfilesFile`.
- [X] T003 [P] Trong `src/shared/schemas.ts`: thêm `memberSince: z.string().nullable().optional()` vào `employeeProfileSchema`; thêm `membersSeeded: z.boolean().optional()` vào `employeeProfilesFileSchema`, giữ `schemaVersion: z.literal(1)`; thêm `export const joinSchema = z.object({ deskId: z.string().max(200).optional() })`.
- [X] T004 Trong `src/server/services/employee-profiles.ts`: thêm `setMember(id: string, on: boolean, now = Date.now())`. Khi `on` là true, đặt `memberSince` bằng thời điểm ISO nếu chưa có. Khi `on` là false, đặt `memberSince = null, deskId = null, meetingSeatId = null`. Sau đó flush. Thêm `isMember(id)`, `membersSeeded()` và `markMembersSeeded()` (đặt cờ ở cấp file rồi flush). Phụ thuộc T002 và T003.
- [X] T005 Trong `src/server/services/employees.ts`:
  - **Quy tắc visible (FR-008, FR-018)**: trong `rebuild()`, thay quy tắc "20 conversation hoạt động gần nhất". **Thành viên** là conversation có `memberSince` trong hồ sơ, `parentId == null`, và có trong danh sách hiện tại. Visible = mọi thành viên, cộng các subagent có tổ tiên gốc (đi ngược theo `parentId`) là thành viên, sắp theo `lastActivityAt` giảm dần, lấy tới khi tổng số người hiện đạt `MAX_VISIBLE` (giữ hằng số 20 hiện có). Thành viên không bao giờ bị cắt; chỉ subagent ít hoạt động gần đây nhất bị cắt. Đặt `this.overflow = 0`.
  - **Chuyển đổi (nghiên cứu R5, FR-017)**: ở lần poll đầu mà `membersSeeded()` là false **và danh sách không rỗng**, trước khi tính visible, gọi `setMember(id, true)` cho các conversation cấp cao nhất trong 20 conversation hoạt động gần nhất (quy tắc cũ), rồi gọi `markMembersSeeded()`. Danh sách rỗng: không làm gì, không đặt cờ.
  - **Phương thức mới**: thêm `memberCount()` và `isMemberNow(id)`. Số thành viên = hồ sơ có `memberSince`, cấp cao nhất, và (có trong danh sách vừa poll **hoặc** nằm trong tập `pendingMembers`). `pendingMembers` là một `Map<string, number>` trong bộ nhớ (id → số lần poll đã chờ): id được thêm khi admit thành công, bị xoá ở lần poll mà App đã liệt kê id đó, hoặc khi đã chờ quá `PENDING_POLLS = 10` lần poll thành công (~10 giây) mà App vẫn chưa liệt kê; khi hết hạn như vậy, gọi thêm `profiles.setMember(id, false)`.
  - **Khoá (nghiên cứu R3)**: thêm `admit<T>(fn: () => Promise<{ conversationId: string } & T>, opts?: { deskId?: string; existingId?: string })`, chạy dưới một khoá dạng chuỗi promise:
    1. Nếu `existingId` đã là thành viên, chạy `fn` và trả `{ ...result, alreadyMember: true }`, không kiểm tra số đếm, không đổi bàn.
    2. Nếu không, khi `memberCount() >= OFFICE_LIMIT` thì ném `OfficeFullError` (export từ file này).
    3. Nếu không, chạy `fn`, rồi `setMember(result.conversationId, true)` và thêm id vào `pendingMembers`.
    4. **Bàn**: nếu có `deskId`, gán nó **chỉ khi bàn đang trống** (không ai giữ, kiểm bằng `profiles.assignedDesks()`). Gán bằng cách đặt thẳng `deskId` trên hồ sơ, không qua `profiles.update`, vì `update` đổi chỗ với người đang ngồi. Nếu bàn đã có người, bỏ qua để `assignDesks` xếp bàn trống khác.
    5. `await this.refresh()` vẫn bên trong khoá, rồi mới nhả khoá.

  Phụ thuộc T004.
- [X] T006 [P] Viết unit test `tests/unit/employees-membership.test.ts`, theo mẫu có sẵn của `tests/unit/employee-behaviors.test.ts` (adapter, hub giả và hồ sơ trong thư mục tạm):
  - **Hiển thị**: conversation không phải thành viên thì không hiện; thành viên thì hiện dù cũ tới đâu; subagent của thành viên thì hiện và không bị tính vào giới hạn thành viên; thành viên không còn trong danh sách của App thì không bị tính.
  - **Trần người hiện (FR-018)**: 18 thành viên + 5 subagent → đúng 20 người hiện, 18 thành viên đều hiện, 3 subagent ít hoạt động gần đây nhất bị ẩn.
  - **Chuyển đổi**: chỉ đánh dấu các conversation cấp cao nhất trong 20 conversation mới nhất, và chỉ chạy một lần; một lần poll trả danh sách rỗng không chạy chuyển đổi và không đặt `membersSeeded`, lần poll sau có dữ liệu mới chạy.
  - **Giới hạn**: `admit` ném `OfficeFullError` khi đã có 20 thành viên; hai lần gọi `admit` đồng thời khi có 19 thành viên thì đúng một lần qua; `admit` với `existingId` đã là thành viên thì không bị tính.
  - **Thành viên chờ**: khi có 19 thành viên, `admit` một conversation mới mà App chưa liệt kê (giống mock `StartCascade`), rồi `admit` thêm lần nữa → lần thứ hai bị `OfficeFullError`. Sau 10 lần poll mà App vẫn không liệt kê id đó, `admit` lại được (chỗ đã được nhả), và nếu sau đó App mới liệt kê id đó thì nó không phải thành viên.
  - **Khởi động lại (FR-016)**: tạo `EmployeeProfiles` mới trên cùng thư mục dữ liệu; các thành viên, `membersSeeded` và bàn ngồi vẫn còn nguyên.
  - **Bàn**: `admit` với `deskId` của bàn đang trống thì ngồi bàn đó; với `deskId` của bàn đã có người thì người đang ngồi không bị đổi chỗ.

  Phụ thuộc T005.
- [X] T007 [P] Trong `tests/e2e/mock-app.ts`, thêm `extraConversations: Record<string, Record<string, unknown>>`. `GetAllCascadeTrajectories` gộp các mục này vào `trajectorySummaries` (bỏ qua `deleted`, áp dụng `parents`, status và stepCount như các mục trong fixture). Thêm helper `addConversation(id, { title, projectId, lastModifiedTime })`. Nhờ vậy e2e tạo được conversation trong "App" sau khi văn phòng đã khởi động, tức là một conversation không phải thành viên.

**Điểm kiểm tra**: `npm test` qua; văn phòng hiện đúng những nhân viên như trước khi dùng thư mục dữ liệu cũ.

---

## Phase 3: User Story 1 — Tuyển lại nhân viên từ conversation có sẵn (P1) 🎯 MVP

**Mục tiêu**: chọn một conversation của project trong hộp thoại tuyển. Nó vào văn phòng và chat của nó mở ra; không có gì được tạo trong App.

**Kiểm thử độc lập**: với một conversation được thêm vào mock App sau khi khởi động, tuyển nó qua "Existing conversation". Nhân viên xuất hiện, chat mở ra, và không có `StartCascade` nào được gửi.

- [X] T008 [P] [US1] Viết contract test `tests/contract/routes-membership.test.ts`, theo mẫu `tests/contract/routes-delete.test.ts` (FakeTransport + `createHttpServer`):
  - **`GET /api/projects/:id/conversations`**: chỉ trả các mục có `projectId === :id && parentId == null && stepCount > 0`, sắp theo `lastActivityAt` giảm dần, kèm `inOffice`, `members` và `limit: 20`.
  - **`POST /api/conversations/:id/join`**: conversation chưa là thành viên trở thành thành viên và bàn được đặt từ `deskId`; join một thành viên thì trả `alreadyMember: true`; id không tồn tại → `404 NOT_FOUND`; subagent → `400 BAD_REQUEST`.
  - **Không ghi vào App**: cả hai route không gửi RPC ghi nào tới App.
- [X] T009 [US1] Trong `src/server/http/routes/employees.ts`:
  - **Route danh sách**: thêm `GET /api/projects/:id/conversations`. Kiểm tra `:id` với `^[A-Za-z0-9-]{1,100}$`. Gọi `deps.adapter.listConversations()`, lọc và sắp như contracts/api.md, map sang `{ id, title, lastActivityAt, runStatus, inOffice }`, và trả `{ members, limit, conversations }`. `AppUnavailableError` → `503 APP_UNAVAILABLE`.
  - **Route join**: thêm `POST /api/conversations/:id/join`. Parse body bằng `joinSchema`. Kiểm tra conversation có trong `listConversations()` (nếu không thì 404) và `parentId == null` (nếu không thì 400). Chạy `services.employees.admit(async () => ({ conversationId: id }), { deskId, existingId: id })`. `OfficeFullError` → `409 { error: { code: 'OFFICE_FULL', message, members, limit } }`.
  - **Log**: chỉ ghi id và mã kết quả.

  Phụ thuộc T005.
- [X] T010 [US1] Trong `src/web/ui/chat/HireDialog.tsx`:
  - **Chuyển chế độ**: thêm `mode: 'new' | 'existing'` với hai nút `hire-mode-new` / `hire-mode-existing`, hiện ra khi đã chọn project. Giữ state `text` và `model` khi chuyển chế độ.
  - **Chế độ Existing**: gọi `/api/projects/${projectId}/conversations` rồi hiện danh sách (`hire-conversation-list`, mỗi mục `hire-conversation-item` có tiêu đề, thời điểm hoạt động gần nhất dạng tương đối, và "in the office" khi `inOffice`), chọn một mục. Ẩn trường First task và Model.
  - **Hire**: dùng được khi đã chọn một mục. Khi bấm, POST `/api/conversations/${id}/join` với `{ deskId }`, rồi `onClose()` và `openConversation(id)`.
- [X] T011 [P] [US1] Thêm các test id `hire-mode-new`, `hire-mode-existing`, `hire-conversation-list`, `hire-conversation-item`, `hire-filter`, `hire-office-count`, `hire-office-full`, `chat-remove-from-office` vào `tests/e2e/testids.ts`.
- [X] T012 [US1] Viết e2e test `tests/e2e/hire-existing.spec.ts`, theo mẫu `tests/e2e/projects.spec.ts` (`start-with-mock.ts`). Sau khi khởi động, gọi `mock.addConversation(...)` trong một project của fixture, rồi tuyển nó qua Existing. Mong đợi:
  - khung chat của nó mở ra và nhân viên hiện trong scene trong vòng 2 giây;
  - không có `StartCascade` nào được gửi;
  - tuyển từ bàn trống thì nhân viên ngồi vào bàn đó;
  - chọn một mục "in the office" thì mở chat của họ và số nhân viên không đổi.

  Phụ thuộc T007, T009, T010 và T011.

**Điểm kiểm tra**: US1 chạy trọn vẹn với mock App.

---

## Phase 4: User Story 2 — Luồng conversation mới giữ nguyên (P1)

**Mục tiêu**: "New conversation" không đổi, và conversation mới trở thành thành viên.

**Kiểm thử độc lập**: tuyển bằng "New conversation" vẫn như trước, và nhân viên mới được tính vào n/20.

- [X] T013 [US2] Trong `src/server/http/routes/conversations.ts`, đổi `POST /api/conversations` sang chạy dưới khoá giới hạn: `services.employees.admit(() => adapter.startConversation(input), { deskId })`. Bỏ lời gọi `profiles.update(deskId)` riêng (admit đã làm). `OfficeFullError` → `409 OFFICE_FULL` (cùng body với T009), trả về trước mọi lời gọi tới App. Giữ `adapter.startConversation` nằm đúng trong file route này (guard c). Phụ thuộc T005.
- [X] T014 [US2] Bổ sung hai trường hợp vào `tests/contract/routes-membership.test.ts`. `POST /api/conversations` thành công thì id trả về là thành viên và ngồi ở `deskId`. Khi đã có 20 thành viên, cùng lời gọi đó trả `409 OFFICE_FULL` và không có `StartCascade` nào được gửi.
- [X] T015 [US2] Bổ sung vào `tests/e2e/hire-existing.spec.ts`. Hộp thoại mở ở chế độ New với cùng các trường như trước. Task đã gõ và model đã chọn vẫn còn sau khi chuyển sang Existing rồi quay lại.

**Điểm kiểm tra**: `tests/e2e/projects.spec.ts` và `chat.spec.ts` hiện có vẫn qua.

---

## Phase 5: User Story 3 — Tối đa 20 nhân viên do sếp chọn (P1)

**Mục tiêu**: bộ đếm n/20, cảnh báo văn phòng đầy, và conversation tạo trong App không tự vào văn phòng.

**Kiểm thử độc lập**: khi 20/20 thì hộp thoại cảnh báo và Hire bị khoá; một conversation thêm vào mock App sau khi khởi động không xuất hiện trong văn phòng.

- [X] T016 [US3] Trong `src/web/ui/chat/HireDialog.tsx`:
  - **Bộ đếm**: hiện "`{members}/20 in the office`" (`hire-office-count`). Lấy số đếm từ kho nhân viên (nhân viên visible, không phải subagent) và cập nhật từ trường `members` của phản hồi danh sách khi có.
  - **Văn phòng đầy**: khi `members >= OFFICE_LIMIT`, hiện băng cảnh báo `hire-office-full` với chữ "The office is full (20/20). Remove an employee from the office, or fire one, before hiring another." Khoá Hire, trừ khi ở chế độ Existing và đã chọn một mục `inOffice`.
  - **Server từ chối**: POST nào trả `409 OFFICE_FULL` thì cũng hiện đúng băng cảnh báo này.
- [X] T017 [P] [US3] Thu hẹp danh sách "+N more" về subagent bị ẩn (nghiên cứu R7, FR-018):
  - `src/web/state/employees.ts`: đổi `selectHidden` thành chỉ trả nhân viên có `isSubagent && !visible` mà tổ tiên gốc (đi ngược theo `parentId` trong `byId`) đang `visible`.
  - `src/web/ui/OverflowList.tsx`: nhãn dùng `hidden.length` thay cho `overflow` ("+{hidden.length} more employees"); không còn mục nào thì không hiện. Bỏ đọc `s.overflow`.
  - Giữ chỗ gắn trong `src/web/App.tsx` và các quy tắc `.overflow` trong `src/web/styles.css`.
  - `src/web/ui/chat/ChatPanel.tsx:37`: sửa comment `shortcut:` cho đúng quy tắc mới (chỉ đếm nhân viên đang hiện, ≤ `MAX_VISIBLE` gồm thành viên và subagent chưa bị ẩn; server vẫn kiểm cả cây trước khi xoá).
- [X] T018 [US3] Bổ sung ba trường hợp vào `tests/e2e/hire-existing.spec.ts`:
  - conversation thêm bằng `mock.addConversation` sau khi khởi động không hiện trong văn phòng nhưng có trong danh sách Existing;
  - khi có 20 thành viên (thêm conversation rồi join qua API), hộp thoại hiện `hire-office-full` và Hire bị khoá;
  - gọi trực tiếp `POST /api/conversations` khi có 20 thành viên thì trả 409;
  - với 20 thành viên và một subagent (`mock.parents`), subagent không hiện trong scene nhưng có trong danh sách "+1 more employees", và bấm vào thì mở chat của nó; conversation không phải thành viên không có trong danh sách đó.

---

## Phase 6: User Story 4 — Đưa ra khỏi văn phòng mà không xoá (P2)

**Mục tiêu**: nhả chỗ mà không động tới App; Fire vẫn hoạt động như hiện nay.

**Kiểm thử độc lập**: "Remove from office" làm nhân viên rời đi, số đếm giảm, và conversation vẫn có trong danh sách Existing.

- [X] T019 [US4] Trong `src/server/http/routes/employees.ts`, thêm `POST /api/conversations/:id/leave`: kiểm tra id, gọi `services.profiles.setMember(id, false)`, gọi `void services.employees.refresh()`, trả `200 {}`. Gọi lại nhiều lần cho cùng kết quả, và không gọi lệnh ghi nào của adapter.
- [X] T020 [US4] Trong `src/server/http/routes/conversations.ts`, ở `DELETE /api/conversations/:id`, sau khi xoá thành công, gọi `profiles.setMember(cid, false)` cho mọi `cid` trong `tree` (thay cho lời gọi `update(cid, { deskId: null, meetingSeatId: null })` hiện có, vì `setMember(false)` đã xoá cả hai).
- [X] T021 [US4] Trong `src/web/ui/chat/ChatPanel.tsx`, thêm nút "Remove from office" (`chat-remove-from-office`) cạnh nút Fire có sẵn, chỉ cho nhân viên cấp cao nhất. Nút POST `/api/conversations/${id}/leave`, rồi gọi `close()`. Không có hộp xác nhận.
- [X] T022 [US4] Bổ sung test:
  - `tests/contract/routes-membership.test.ts`: leave xoá dấu thành viên, bàn và ghế, và không gửi RPC nào tới App; DELETE xoá dấu thành viên cho cả cây.
  - `tests/e2e/hire-existing.spec.ts`: Remove from office làm nhân viên biến mất, số đếm giảm 1, và conversation vẫn hiện trong danh sách Existing.

---

## Phase 7: User Story 5 — Danh sách khớp chính xác với App (P2)

**Mục tiêu**: các trạng thái của danh sách, ô lọc, và xử lý conversation đã biến mất.

**Kiểm thử độc lập**: xoá một conversation trong mock App khi danh sách đang mở, rồi bấm Hire: hiện thông báo lỗi và danh sách tải lại. Thoát mock App: danh sách báo "not connected".

- [X] T023 [US5] Trong `src/web/ui/chat/HireDialog.tsx`:
  - **Trạng thái danh sách**: "Loading conversations…", "No conversations in this project yet." (Hire bị khoá), "The Antigravity App is not connected." (khi nhận 503).
  - **Ô lọc**: hiện ô lọc tiêu đề `hire-filter` khi có hơn 10 mục (so khớp chuỗi con, không phân biệt hoa thường).
  - **Conversation biến mất**: khi join trả `404`, hiện "This conversation no longer exists in the Antigravity App." và tải lại danh sách.
  - **Tải lại**: tải lại danh sách mỗi khi đổi project hoặc chuyển sang chế độ Existing.
- [X] T024 [US5] Bổ sung bốn trường hợp vào `tests/e2e/hire-existing.spec.ts`:
  - sau `mock.deleted.add(id)`, Hire hiện thông báo đã biến mất;
  - sau `mock.quit()`, danh sách hiện trạng thái không kết nối;
  - project tạo ngay trong hộp thoại hiện trạng thái rỗng;
  - khi có hơn 10 mục, ô lọc thu hẹp được danh sách.

---

## Phase 8: Hoàn thiện & các phần dùng chung

- [X] T025 Chạy cả bộ e2e (`npm run test:e2e`). Sửa các spec bị hỏng do quy tắc hiển thị mới (nghiên cứu R5): spec nào thêm conversation cấp cao nhất sau khi khởi động, hoặc dựa vào "+N more" để mở conversation không phải thành viên, giờ phải join nó qua `POST /api/conversations/:id/join` hoặc `mock.addConversation` + join. Kiểm tra trước `tests/e2e/legend.spec.ts`, `new-hire-reenters.spec.ts`, `delete-employee.spec.ts` và `office-life.spec.ts`.
- [X] T026 [P] Chạy `npm run typecheck`, `npm run lint` và `npm test`, bao gồm `scripts/check-guards.sh` (guard c: `startConversation` chỉ nằm trong route; guard f: không có chữ tiếng Việt trên giao diện).
- [X] T027 Chạy các bước kiểm tra thủ công trong `specs/009-hire-from-conversation/quickstart.md` với Antigravity App thật: chuyển đổi, tuyển lại, bàn, conversation tạo trong App, giới hạn, đưa ra, đồng bộ. Chỉ ghi (gửi tin, tạo, xoá) vào conversation tên `[test-009] …`, và làm bước dọn dẹp ở cuối quickstart (constitution, mục "Thử nghiệm với App thật").

---

## Phụ thuộc & thứ tự thực hiện

- **Chuẩn bị (T001)** → **Nền tảng (T002–T007)** → các user story.
- **US1 (T008–T012)** cần T005 và T007. **US2 (T013–T015)** cần T005; làm song song với US1 được, nhưng cả hai cùng sửa `routes-membership.test.ts` và `hire-existing.spec.ts`, nên hoàn thành phần của US1 trong hai file đó trước.
- **US3 (T016–T018)** cần hộp thoại của US1 (T010) và T013 cho đường 409.
- **US4 (T019–T022)** chỉ cần Nền tảng. **US5 (T023–T024)** cần T010.
- **Hoàn thiện** làm cuối. T025 có thể bắt đầu ngay khi T005 xong, để phát hiện sớm các spec cũ bị hỏng.

## Ví dụ chạy song song

- Nền tảng: T002 ∥ T003, rồi T004 → T005, rồi T006 ∥ T007.
- US1: T008 ∥ T011 trong lúc viết T009; T010 sau khi hợp đồng của T009 đã chốt.
- US3/US4: T017 (thu hẹp OverflowList) ∥ T019 (route leave), vì sửa các file khác nhau.

## Chiến lược triển khai

1. **MVP** = Phase 1–3 (tư cách thành viên + chuyển đổi + tuyển lại). Tự nó đã dùng được: văn phòng hiện như trước, và đưa được conversation cũ trở lại.
2. Làm US2 + US3 cùng nhau: giới hạn 20 thành viên chỉ có ý nghĩa khi cả hai cách tuyển đều được tính.
3. Thêm US4 (đưa ra), rồi US5 (trạng thái danh sách và ô lọc).
4. Kết thúc bằng phase Hoàn thiện (sửa e2e cũ + quickstart).

---

## Phase 9: Convergence

- [X] T028 Thêm e2e cho luồng tuyển từ bàn trống ở chế độ Existing: thêm hook chỉ dùng khi test `openHireAtDesk(deskId)` (gọi `useUi.getState().setHireDesk(deskId)`) vào `src/web/scene/interaction/TestHooks.tsx`, khai báo kiểu trong `tests/e2e/test-hooks.d.ts`, rồi trong `tests/e2e/hire-existing.spec.ts` mở hộp thoại tại một bàn trống, chọn một conversation chưa ở văn phòng và kiểm tra `GET /api/employees` trả đúng `deskId` đó per US1/AC5, T012 (partial)

---

## Phase 10: Convergence

- [X] T029 Tạo `src/shared/office.ts` với `BUSY_STATES = ['working', 'thinking', 'waiting_for_boss']` và hàm thuần `pickLeaver(members: { id: string; lastActivityAt: string; memberSince: string | null; visualState: string }[]): string | null` — bỏ người có `visualState` thuộc `BUSY_STATES`, lấy người có `lastActivityAt` cũ nhất, hoà thì `memberSince` cũ hơn, không ai thì `null` per FR-009, plan: R8 (missing)
- [X] T030 Trong `src/server/services/employees.ts`, đổi `admit`: khi `memberCount() >= OFFICE_LIMIT` (và không phải `existingId` đã là thành viên), gọi `pickLeaver` trên các thành viên hiện tại (`visualState` lấy từ `this.employees`, `memberSince` từ hồ sơ); có người → `profiles.setMember(leaver, false)` rồi tiếp tục tuyển; `null` → ném `OfficeFullError`. Trả thêm `evicted: { conversationId, title } | null` (title từ `this.conversations`) per FR-009, US3/AC1a, SC-004 (contradicts)
- [X] T031 Trong `src/server/http/routes/employees.ts` (join) và `src/server/http/routes/conversations.ts` (POST tạo mới), trả `evicted` đúng như `contracts/api.md` (`201 { conversationId, evicted }`, `200 { conversationId, alreadyMember, evicted }`); `409 OFFICE_FULL` chỉ còn khi cả 20 đều bận; log chỉ ghi id người rời đi và mã kết quả per contracts/api.md, Constitution III (partial)
- [X] T032 Trong `src/web/ui/chat/HireDialog.tsx`, khi văn phòng đầy: gọi `pickLeaver` trên kho nhân viên (thành viên = `visible && !isSubagent`) và hiện băng `hire-office-full` "The office is full (20/20). Hiring will send {title} (last active {relative time}) out of the office." với Hire vẫn dùng được; không hiện khi mục được chọn có "in the office"; nếu `pickLeaver` trả `null` hoặc server trả `409 OFFICE_FULL` thì hiện "The office is full (20/20) and everyone is busy. Remove an employee from the office before hiring another." và khoá Hire per FR-010, US3/AC1, contracts/ui.md (contradicts)
- [X] T033 [P] Viết `tests/unit/office-leaver.test.ts` cho `pickLeaver`: bỏ qua cả ba trạng thái bận, chọn người cũ nhất, hoà theo `memberSince`, trả `null` khi tất cả bận hoặc danh sách rỗng per plan: R8 (missing)
- [X] T034 Cập nhật test theo hành vi mới: `tests/unit/employees-membership.test.ts` (ở 20 thành viên, `admit` cho người rảnh cũ nhất rời đi và trả `evicted`; hai lần `admit` đồng thời ở 20 thành viên → hai người khác nhau rời đi, vẫn 20; `OfficeFullError` chỉ khi cả 20 bận; ca "thành viên chờ" giờ cho người cũ nhất rời đi thay vì bị từ chối), `tests/contract/routes-membership.test.ts` (join/POST ở 20 thành viên trả `evicted` và người đó không còn `visible`, không có RPC ghi xoá; 409 chỉ khi mọi thành viên đang chạy), `tests/e2e/hire-existing.spec.ts` (ca "full office": băng nêu tên người sẽ rời đi, Hire bật, sau Hire người đó rời văn phòng, số đếm vẫn 20/20, conversation của họ vẫn ở danh sách Existing và tuyển lại được; dùng `ctl('run/<id>')` để kiểm tra người đang chạy không bị chọn) per US3/AC1, US3/AC1a, US3/AC1b, SC-004 (contradicts)
