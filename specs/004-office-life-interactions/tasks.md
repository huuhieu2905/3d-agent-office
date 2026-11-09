---

description: "Task list for 004-office-life-interactions"
---

# Tasks: Đời sống văn phòng — tương tác đồ vật, đi ra công viên, xoá nhân viên

**Input**: Design documents from `/specs/004-office-life-interactions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: CÓ.
- Constitution (Nguyên tắc II) bắt buộc contract test cho mọi thao tác mới của adapter.
- Plan và quickstart §1 liệt kê unit / e2e / live test cho từng story.
- Logic thuần mới (`SiteGrid`, `SpotBook`, `outdoorRoute`, `aimTarget`) cần unit test.

**Organization**: Task được nhóm theo user story. Thứ tự giao hàng:
- Đợt 1 = US1 + US2 (MVP).
- Đợt 2 = US3.
- Đợt 3 = US4, phụ thuộc `SiteGrid` và quán của US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Chạy song song được (khác file, không phụ thuộc task chưa xong).
- **[Story]**: US1–US4 theo spec.md.
- Đường dẫn tính từ gốc repo. Dự án một package: `src/`, `tests/`, `scripts/`.

## Quy tắc chung khi làm task

- Tên RPC của App chỉ được nằm trong `src/server/app-adapter/` (Nguyên tắc II).
- Thao tác xoá conversation chỉ được gọi từ `src/server/http/routes/` (guard (c)).
- Test live chỉ tạo và xoá conversation có tiền tố `[agent-office-test]`, và PHẢI dọn dữ liệu trong
  `finally`.
- Log không được chứa tên hay nội dung conversation (Nguyên tắc III).
- Mọi trường mới của `Settings` PHẢI là optional. File `settings.json` cũ không qua `safeParse` sẽ bị
  `JsonStore` reset về mặc định (research R4-01).
- Logic mới ở client đặt trong module thuần (không React, không three) để unit test được, giống
  `nav-core.ts` và `crowd.ts`.
- Clip hoạt hình mới là tư thế thủ tục trong `character.ts`, không dùng tài nguyên ngoài
  (Nguyên tắc V).
- Đo hiệu năng và chạy e2e bằng GPU thật. Lấy kết quả từ lần đo thứ hai trở đi.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Không có thư viện hay cấu hình mới. Chỉ chuẩn bị test id và mock dùng chung.

- [X] T001 [P] Thêm test id mới vào `tests/e2e/testids.ts`: `legendToggle: 'legend-toggle'`, `legendList: 'legend-list'`, `employeeDelete: 'employee-delete'`, `confirmDelete: 'confirm-delete'`, `confirmDeleteOk: 'confirm-delete-ok'`, `confirmDeleteError: 'confirm-delete-error'`, `fpHint: 'fp-hint'` (contracts/ui-interactions.md U4-1…U4-3)
- [X] T002 [P] Mở rộng mock App trong `tests/e2e/mock-app.ts` (contracts/local-api.md L4-3):
  - xử lý `DeleteCascadeTrajectory {cascadeId}`: xoá conversation **và mọi conversation có `parentId` trỏ tới nó (mọi cấp)** khỏi danh sách giả lập;
  - cờ `failDelete` → trả HTTP 500;
  - hàm `setRunStatus(id, 'RUNNING' | 'IDLE')` để giả lập agent bận.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Mở rộng `Settings`. US1 và US4 cùng cần, nên phải xong trước.

**⚠️ CRITICAL**: Phải xong trước US1 và US4.

- [X] T003 Thêm hai trường optional vào `Settings` trong `src/shared/domain.ts`: `legendCollapsed?: boolean` (mặc định `false`) và `screensOff?: string[]` (mặc định `[]`). Giữ `schemaVersion: 1` (data-model §1)
- [X] T004 Sửa `settingsSchema` trong `src/shared/schemas.ts`:
  - `legendCollapsed: z.boolean().optional()`;
  - `screensOff: z.array(z.string().min(1).max(100)).max(50).optional()`, nghĩa là "≤ 50 id, mỗi id ≤ 100 ký tự" (data-model §1, L4-2).
  - KHÔNG được thành trường bắt buộc.
- [X] T005 Thêm `legendCollapsed: false`, `screensOff: []` vào `DEFAULT_SETTINGS` trong `src/web/state/settings.ts` và `src/server/services/settings.ts`
- [X] T006 [P] Unit test `tests/unit/settings-compat.test.ts`:
  - một `settings.json` cũ (không có hai trường mới) vẫn qua `settingsSchema.safeParse` và giữ nguyên `city` / `theme`;
  - `screensOff` có 51 phần tử, hoặc id dài 101 ký tự, thì bị từ chối;
  - `PUT /api/settings` với body sai kiểu trả `400`.

**Checkpoint**: `npm test` pass. Cài đặt cũ không bị reset.

---

## Phase 3: User Story 1 - Thu gọn panel "Chú giải dự án" (Priority: P1) 🎯 MVP

**Goal**: Panel thu gọn/mở được. Khi mở, panel không tràn màn hình (cuộn bên trong). Trạng thái được
nhớ qua lần tải lại trang.

**Independent Test**: Với 20 dự án có nhân viên, cửa sổ cao 600 px:
- panel nằm trọn trong màn hình và cuộn được;
- thu gọn rồi tải lại trang thì panel vẫn thu gọn;
- làm nổi bật một dự án rồi thu gọn thì nút có chấm màu (quickstart §2).

### Tests for User Story 1

- [X] T007 [P] [US1] E2E `tests/e2e/legend.spec.ts` (mock App, 20 dự án):
  - đặt viewport cao 600 px, kiểm tra hộp bao của `legend-list` nằm trong viewport và có `scrollHeight > clientHeight`;
  - bấm `legend-toggle` → `aria-expanded="false"`, chữ "Dự án (20)";
  - `page.reload()` → vẫn thu gọn;
  - bấm một dự án rồi thu gọn → nút chứa chấm màu của dự án đó (FR-001…FR-004, SC-001).

### Implementation for User Story 1

- [X] T008 [US1] Sửa `src/web/ui/ProjectLegend.tsx`:
  - đọc `useSettings((s) => s.settings.legendCollapsed ?? false)`;
  - nút `legend-toggle` có `aria-expanded`, gọi `useSettings.getState().update({ legendCollapsed: !collapsed })`;
  - khi thu gọn: nhãn "Dự án (n)", với n = số dự án đang hiện, kèm `tag-dot` màu của dự án đang làm nổi bật (nếu có);
  - khi mở: danh sách nằm trong `<div data-testid="legend-list" className="legend-list">`;
  - giữ nguyên hành vi click làm nổi bật và `return null` khi không có dự án (Edge case).
- [X] T009 [US1] Sửa CSS trong `src/web/styles.css`:
  - `.legend` chuyển thành cột (`flex-direction: column`, bỏ `flex-wrap`);
  - `.legend-list` có `max-height: calc(100vh - 140px)` (đo lại khoảng cách tới đỉnh thật của panel cha khi làm), `overflow-y: auto`;
  - nút `.legend-toggle` cùng kiểu với `.legend-item`.

**Checkpoint**: T007 pass. US1 dùng được độc lập.

---

## Phase 4: User Story 2 - Xoá nhân viên (Priority: P1) 🎯 MVP

**Goal**: Một thao tác duy nhất: xoá vĩnh viễn conversation trong App (App xoá luôn mọi subagent con).
- Có xác nhận.
- Bị chặn khi cha hoặc một con đang bận.
- Nhân viên (và các nhân viên con) đi ra cửa, bàn được trả lại.
- Lỗi thì không đổi gì.

**Independent Test**: quickstart §3 với conversation `[agent-office-test]`: huỷ, xoá thành công, bị
chặn khi đang chạy, bị chặn khi agent bắt đầu chạy lúc hộp xác nhận đang mở, App đóng.

### Tests for User Story 2

- [X] T010 [P] [US2] Contract test `tests/contract/adapter-delete.test.ts` theo contracts/app-adapter.md:
  - **A4-1a**: RPC `DeleteCascadeTrajectory`, body đúng `{ cascadeId }`.
  - **A4-1b**: mất kết nối → `AppUnavailableError`; HTTP 500 → `AppRejectedError`, và `message` không chứa nội dung phản hồi của App.
  - **A4-1c**: App báo lỗi nhưng `listConversations()` không còn id → trả về bình thường.
  - Dùng transport giả như các contract test hiện có.
- [X] T011 [P] [US2] Route test `tests/contract/routes-delete.test.ts`, inject Fastify với adapter giả (contracts/local-api.md L4-1):
  - id sai → `400`; mất kết nối → `503`; id không có → `404`;
  - cha `RUNNING` → `409 AGENT_BUSY`; con `waiting_for_boss` → `409` với `busyId` = id con; cha `runStatus: 'CANCELING'` → `409`;
  - App từ chối → `502 APP_REJECTED`, và profile không đổi;
  - thành công → `200 { removed: [cha, ...con] }`, `deskId` của cả cây thành `null`, `employees.refresh` được gọi.
- [X] T012 [P] [US2] Thêm vào `tests/leaks/redaction.test.ts` một case: gọi `DELETE` cho conversation có tên chứa chuỗi bí mật, rồi kiểm tra log (pino) không chứa tên đó, chỉ chứa id và mã kết quả.
- [X] T013 [P] [US2] E2E `tests/e2e/delete-employee.spec.ts` (mock App, U4-2):
  - mở chat → bấm `employee-delete` → bấm Huỷ: không đổi gì;
  - bấm lại, xác nhận: chat đóng, nhân viên biến mất khỏi `__agentOffice`, tải lại trang vẫn không có;
  - conversation có 2 con: hộp xác nhận ghi "cùng 2 subagent con", xoá xong cả 3 nhân viên rời đi;
  - `setRunStatus(id,'RUNNING')`: nút `disabled` với `title` "Dừng agent trước khi xoá";
  - mở hộp xác nhận rồi `setRunStatus(id,'RUNNING')`, bấm xác nhận: `confirm-delete-error` hiện "Agent vừa bắt đầu chạy — dừng agent rồi thử lại";
  - `failDelete`: hiện "App không xoá được conversation này", nhân viên còn nguyên;
  - đếm số lần bấm từ khi mở chat tới khi xoá xong: ≤ 3 (SC-002).
- [X] T014 [P] [US2] Live test `tests/live/delete.live.test.ts` (`AGENT_OFFICE_LIVE=1`, A4-1d):
  - tạo conversation `[agent-office-test] delete` qua `startConversation`, đợi `IDLE`, xoá qua route L4-1;
  - kiểm tra `listConversations()` không còn id;
  - nếu tạo được subagent con thì kiểm tra các con cũng không còn;
  - ~~ghi fixture `DeleteCascadeTrajectory.json`~~ — **bỏ khi làm** (2026-11-09): `recordRaw` cố ý chỉ cho RPC chỉ-đọc, và adapter không đọc nội dung phản hồi của lệnh xoá, nên không có định dạng nào cần theo dõi. T010 vẫn dùng fixture nếu sau này có;
  - `finally`: dọn bằng `deleteTestConversation` nếu còn.

### Implementation for User Story 2

- [X] T015 [US2] Thêm `deleteConversation(conversationId: string): Promise<void>` vào interface `AppAdapter` trong `src/server/app-adapter/types.ts`, kèm comment "Chỉ gọi khi người dùng xác nhận xoá (Nguyên tắc III). App xoá luôn mọi subagent con."
- [X] T016 [US2] Cài đặt `deleteConversation` trong `src/server/app-adapter/index.ts`:
  - gọi `call('DeleteCascadeTrajectory', { cascadeId })`;
  - lỗi RPC kind `app` → nếu `listConversations()` không còn id thì trả về bình thường, ngược lại ném `new AppRejectedError()` (không mang thông điệp của App);
  - lỗi kết nối → `AppUnavailableError`;
  - không gọi `cancel`.
  - Cho `deleteTestConversation` gọi lại hàm này sau phần kiểm tra nhãn `[agent-office-test]`.
  - Nếu các adapter giả hoặc mock hiện có cài đặt interface `AppAdapter`, thêm phương thức giả vào đó.
- [X] T017 [US2] Mở rộng guard (c) trong `scripts/check-guards.sh`: thêm `deleteConversation` vào regex `\.(sendMessage|startConversation|cancel|answerPermission|answerQuestion|deleteConversation)\(`.
- [X] T018 [US2] Thêm và export hàm thuần `subtreeIds(rootId, conversations)` trong `src/server/services/employees.ts`. Hàm trả về id cha và mọi con theo `parentId`, mọi cấp, và có chặn vòng lặp.
- [X] T019 [US2] Thêm route `DELETE /api/conversations/:id` vào `src/server/http/routes/conversations.ts`, theo đúng thứ tự bước của L4-1:
  1. Kiểm tra `ID` regex.
  2. `adapter.getConnection().kind !== 'connected'` → `503`.
  3. `listConversations()` không có id → `404 NOT_FOUND`.
  4. Với mỗi id trong `subtreeIds`: `getSteps` lấy bước cuối, rồi `computeVisualState`. Nếu kết quả ∈ `{working, thinking, waiting_for_boss}` hoặc `runStatus === 'CANCELING'` → `409 AGENT_BUSY { visualState, busyId }`.
  5. `adapter.deleteConversation(id)`. `AppRejectedError` → `502 APP_REJECTED` với câu chữ cố định.
  6. `profiles.update(x, { deskId: null })` cho cả cây, rồi `void services.employees.refresh()`, trả `200 { removed }`.

  Bước 4 và 5 thất bại thì không ghi gì. Log chỉ ghi `id` và mã kết quả.
- [X] T020 [P] [US2] Tạo `src/web/ui/chat/ConfirmDeleteDialog.tsx` (U4-2):
  - `role="alertdialog"`, `data-testid="confirm-delete"`;
  - câu chữ: tên conversation, "sẽ bị xoá vĩnh viễn trong Antigravity App", thêm "cùng N subagent con" khi N > 0;
  - focus mặc định ở nút Huỷ, Esc để huỷ;
  - nút `confirm-delete-ok` màu nguy hiểm, gọi `api(\`/api/conversations/${id}\`, { method: 'DELETE' })`, khoá cả hai nút khi đang chờ;
  - map lỗi: `AGENT_BUSY` → "Agent vừa bắt đầu chạy — dừng agent rồi thử lại", `APP_UNAVAILABLE` → "Chưa kết nối được Antigravity App", `APP_REJECTED` (và lỗi khác) → "App không xoá được conversation này", hiển thị trong `confirm-delete-error`;
  - thành công thì gọi `onDeleted()`.
- [X] T021 [US2] Sửa `src/web/ui/chat/ChatPanel.tsx`:
  - thêm nút 🗑 `data-testid="employee-delete"` vào `chat-head`, trước nút Đóng;
  - tính N con và cờ "bận" từ `useEmployees` (cây theo `parentId`). Nút `disabled` khi nhân viên hoặc một con có `visualState ∈ {working, thinking, waiting_for_boss}`, kèm `title="Dừng agent trước khi xoá"`;
  - bấm thì mở `ConfirmDeleteDialog`; `onDeleted` thì `close()`.
  - Nút không nằm trên đường bấm 1 lần để mở chat (FR-010).
- [X] T022 [P] [US2] Thêm CSS cho nút nguy hiểm và hộp `alertdialog` trong `src/web/styles.css`, dùng biến màu theme sẵn có, hiển thị đúng ở cả sáng và tối.
- [X] T023 [US2] Kiểm tra (và sửa nếu cần) `src/web/scene/employee-lifecycle.ts` và `src/web/scene/OfficeScene.tsx`: khi `employees.patch` có `removed` gồm nhiều id cùng lúc, mỗi nhân viên phải đi ra cửa độc lập (`leaving`), rồi bị gỡ khỏi cảnh khi brain báo `done`.

**Checkpoint**: T010–T013 pass. `npm test` pass (guard (c) ✓). T014 pass trên App thật. **Đợt 1
(MVP) xong**: chạy quickstart §2–3.

---

## Phase 5: User Story 3 - Nhân viên có đời sống khi rảnh, ra công viên và quán hàng (Priority: P2)

**Goal**: Khi rảnh, nhân viên vươn vai, uống nước, ngồi hoặc nằm sofa, hoặc ra một trong 4 quán quanh
công viên (qua cửa chính, không xuyên tường).
- Có việc thì badge đổi trong ≤ 2 s và về tới bàn trong ≤ 30 s.
- Mưa hoặc bão thì không ra ngoài; ai đang ở ngoài thì cầm ô chạy về.
- Số người ra ngoài cùng lúc không quá `max(1, floor(n/3))`.

**Independent Test**: quickstart §4 với `?debug=crowd` và ≥ 6 nhân viên rảnh.

### Tests for User Story 3

- [X] T024 [P] [US3] Unit test `tests/unit/site-nav.test.ts` (data-model §4):
  - ô trong sàn trả cùng kết quả `walkable` / `canStep` như `OfficeGrid`;
  - bước qua chu vi sàn chỉ được ở ô cửa, tường và kính chặn (thử cả 3 vị trí cửa south / east / west);
  - ô ngoài `PARK_RADIUS − 1` không đi được;
  - ô trúng footprint quán hoặc thân cây (bán kính 0.35 m) không đi được;
  - `toCell(toWorld(c))` là phép đồng nhất;
  - toạ độ thế giới của một ô trong sàn trùng với `OfficeGrid.toWorld`.
- [X] T025 [P] [US3] Unit test `tests/unit/park-shops.test.ts`:
  - `parkShops(frame)` trả về 4 quán `cafe | grocery | sugarcane | banhmi`, có ít nhất một `cafe` và một `grocery`;
  - mỗi quán có 2–4 `seats` và 1–2 `stands`;
  - không quán nào nằm trong bãi cỏ (`|x| < hw + CLEAR && |z| < hd + CLEAR`) hay đè lên đường dạo, với văn phòng 10×8 và 40×40 m;
  - quán `cafe` ở đúng vị trí `kioskSpot` cũ;
  - `treeAllowed` trả `false` trong vòng 4 m quanh mọi quán.
- [X] T026 [P] [US3] Unit test `tests/unit/outdoor-route.test.ts`:
  - `outdoorRoute(frame, doorWorld, spot)` bắt đầu ở cửa, đi ra 1.5 m, mọi điểm trung gian đều `walkable` trên `SiteGrid`, kết thúc tại `spot`;
  - đi dọc vòng đường dạo theo chiều ngắn hơn;
  - `routeLength` đúng tới 0.1 m;
  - với văn phòng 40×40 m vẫn có ít nhất một quán có tuyến ≤ 55 m.
- [X] T027 [P] [US3] Unit test `tests/unit/break-spots.test.ts` (data-model §6):
  - `reserve` lần hai cho cùng chỗ thì thất bại;
  - nằm sofa giữ cả `:L` và `:R`;
  - `release` trả mọi chỗ của owner;
  - `tryOuting` dừng ở `max(1, floor(n/3))`;
  - `revalidate` sau khi xoá sofa trả về đúng owner bị ảnh hưởng;
  - owner `__player__` chặn nhân viên giữ cùng chỗ.
- [X] T028 [US3] Mở rộng `tests/unit/employee-behaviors.test.ts`, dùng `rng` cố định, `breakMeanMs` ngắn và `SiteGrid` + `Crowd` + `SpotBook` thật:
  - chuỗi "ghé quán" đi qua `walking(go-out) → outing → resting → outing(home) → walking(sit) → seated`, và mọi vị trí trên đường đều `walkable`;
  - đang `resting` ở quán xa nhất được phép thì `setVisual('working')` → về `seated` trong ≤ 30 s mô phỏng;
  - mưa (`setWeather('rain')`) khi đang ở ngoài → `pose.umbrella === true` và chạy về; ô tắt khi vào ô trong sàn; trời mưa không bao giờ chọn quán; trời tạnh giữa đường vẫn về;
  - xoá sofa khi đang nằm → `recall`, nhả chỗ;
  - vào build mode → mọi brain nghỉ đều `recall`;
  - `disconnected` khi ở ngoài → về bàn rồi đứng yên;
  - `leave()` khi ở ngoài → đi ra rìa rồi `done`;
  - không có sofa / bình nước → không chọn hoạt động tương ứng;
  - các test 001/002 cũ vẫn pass.
- [X] T029 [P] [US3] E2E `tests/e2e/office-life.spec.ts` (mock App, ≥ 6 nhân viên, `__agentOffice.setBreakInterval(15000)`):
  - trong ≤ 3 phút thấy `brains()` có `activity` lần lượt là `water`, `sofa`, `shop`;
  - số `outside: true` không bao giờ vượt `max(1, floor(n/3))`;
  - khi một nhân viên `outside` mà conversation chuyển `RUNNING`: badge đổi ≤ 2 s, về `seated` ≤ 30 s;
  - bấm vào nhân viên đang ở quán (qua `project()`) thì chat mở (FR-025);
  - lấy mẫu `brains()` mỗi 0.5 s: không brain nào ở mode đi lại mà đứng yên một chỗ (< 0.05 m) quá 5 s, và không hai nhân viên nào cách nhau < 0.3 m (SC-004).

### Implementation for User Story 3

- [X] T030 [US3] Tách bộ cây đang vẽ thành hàm thuần `visibleTrees(frame, seed, count)` trong `src/web/scene/park/park-layout.ts` (dùng `treeCandidates` + `treeAllowed` + cắt theo `DETAIL[level].trees`). Cho `src/web/scene/park/Trees.tsx` dùng hàm này, để vật cản luôn khớp với cây nhìn thấy (R4-03).
- [X] T031 [US3] Thêm `parkShops(frame): ParkShop[]` vào `src/web/scene/park/park-layout.ts` (data-model §5):
  - 4 quán ở 4 góc, sát mép ngoài vòng đường dạo (`PATH_WIDTH/2 + 4`), quay mặt về văn phòng;
  - mỗi quán có `footprint`, `seats` (2–4) và `stands` (1–2), mọi chỗ đều có `{ id, x, z, facing }`;
  - `cafe` dùng đúng vị trí `kioskSpot` cũ;
  - sửa `treeAllowed` để loại vòng 4 m quanh **mọi** quán.
- [X] T032 [US3] Tạo `src/shared/site-nav.ts` với lớp `SiteGrid` (data-model §4, R4-03):
  - cùng giao diện `toCell / toWorld / walkable / canStep / inside / neighbours / width / depth / cellSize` như `OfficeGrid`;
  - nhận `office: OfficeGrid`, danh sách footprint quán và danh sách tâm cây;
  - lệch ô `ox, oz` là số nguyên;
  - chặn cạnh chu vi sàn trừ `doorCells` (các ô mép sàn trong khoảng `DOOR_WIDTH` của `shell.door`);
  - ô ngoài trời tính khi hỏi, cây tra qua bảng băm 4 m;
  - expose `office`, `isIndoor(cell)` và `indoorView()`. View này dùng cùng hệ ô và cùng `width`, nhưng `inside` / `neighbours` chỉ nhận ô trong sàn, để A* trong nhà và `avoiding(...)` dùng đúng chỉ số ô của `Crowd` (R4-03). Unit test T024 thêm case: A* trên `indoorView()` không bao giờ trả ô ngoài sàn.
- [X] T033 [US3] Đổi kiểu grid của `Crowd` trong `src/web/scene/crowd/crowd.ts` sang giao diện chung (`Pick<…>` sẵn có đã đủ). Trong `src/web/scene/OfficeScene.tsx`, dựng `SiteGrid` bằng `useMemo` từ `layout`, `parkShops(parkFrame(floor))` và `visibleTrees(...)`, rồi truyền vào `new Crowd(site)`. **Không đổi hành vi**: chạy lại `crowd.test.ts`, `employee-behaviors.test.ts`, `fp-motion.test.ts` cũ và tất cả phải pass trước khi làm tiếp.
- [X] T034 [P] [US3] Thêm kiểu vẽ `grocery` và `cart` vào `STYLE` trong `src/web/scene/city/Shops.tsx`:
  - `grocery`: mặt tiền kệ hàng, mái hiên sọc;
  - `cart`: xe đẩy nhỏ có mái che và 2 bánh;
  - bảng màu concept "Soft Studio · Sài Gòn", dùng material chung;
  - ở mức `low` không vẽ ghế đẩu và dù (R4-10). **Khi làm**: chỉ bỏ dù; ghế đẩu giữ lại vì nhân viên ngồi trên đó.
- [X] T035 [US3] Tạo `src/web/scene/park/ParkShops.tsx` để vẽ 4 quán từ `parkShops(frame)`: `Kiosk` cho cafe, `Shop` với `grocery` / `cart` cho các quán khác, kèm ghế đẩu tại `seats`. Tên quán hư cấu, thêm vào `SHOP_NAMES` theo thành phố. Trong `src/web/scene/Surroundings.tsx`, thay chỗ vẽ `Kiosk` bằng `<ParkShops>`, vẫn giữ cờ `off.has('kiosk')`.
- [X] T036 [P] [US3] Tạo `src/web/scene/outdoor-route.ts`:
  - `outdoorRoute(frame, from, to): {x,z}[]` theo R4-03: ra 1.5 m, băng qua bãi cỏ, dọc vòng dạo theo chiều ngắn hơn (lấy mẫu mỗi 1 m), rẽ vào chỗ;
  - `routeLength(pts)`;
  - `edgeExit(frame, from)`: đường tới rìa gần nhất, dùng cho `leave()` khi đang ở ngoài.
- [X] T037 [P] [US3] Tạo `src/web/scene/break-spots.ts` với lớp `SpotBook` (data-model §6):
  - `reserve(owner, spotId)`, `release(owner)`, `setPopulation(n)`, `tryOuting(owner)` / `endOuting(owner)` với giới hạn `max(1, floor(n/3))`;
  - `sofaSpots(layout)` sinh `<itemId>:L` / `<itemId>:R` từ footprint sofa và hướng xoay;
  - `revalidate(layout, shops) → string[]` (owner mất chỗ).
- [X] T038 [P] [US3] Thêm clip thủ tục vào `src/web/scene/character.ts`:
  - `Lying`: nằm nghiêng, hông ở độ cao mặt sofa, mắt nhắm qua `setFace`;
  - `Drinking`: tay phải đưa cốc lên miệng theo chu kỳ, kèm mesh cốc nhỏ gắn tay.
  - Thêm hàm `setUmbrella(c, on)`: mesh ô thủ tục gắn tay phải, màu dù của quán.
  - Cập nhật kiểu `Clip`.
- [X] T039 [US3] Mở rộng `src/web/scene/employee-behaviors.ts` (data-model §7, R4-05, R4-06):
  - `BrainOptions` có thêm `spots: SpotBook`, `shops: ParkShop[]`, `frame: ParkFrame`, `grid: SiteGrid`.
  - Mode mới `outing { pts, i, then: 'shop' | 'home' }` và `resting { spotId, pose: 'sit' | 'lie' | 'stand', until }`. `walking.then` có thêm `go-out` và `sofa`.
  - `startBreak` chọn theo trọng số trong các hoạt động khả dụng:

    | Hoạt động | Trọng số | Thời gian ở nơi đến |
    |---|---|---|
    | vươn vai | 0.15 | 3.5 s |
    | nước (clip `Drinking`) | 0.30 | 3 s |
    | sofa: ngồi 60% / nằm 40% | 0.25 | 20–90 s |
    | quán: ngồi 70% / đứng 30% | 0.30 | 20–90 s |

    Chỉ chọn quán có `routeLength` từ cửa ≤ 55 m, khi `tryOuting` thành công và thời tiết không phải mưa/bão.
  - Mọi A* trong nhà (`plan`, `replan`, `walkTo`) chạy trên `site.indoorView()`. `toCell` / `toWorld` dùng `SiteGrid`, KHÔNG trộn ô của `OfficeGrid` với chỉ số ô của `Crowd`. `seatOf` / `approachOf` / `entrance` của `OfficeGrid` phải được đổi sang ô site qua toạ độ thế giới.
  - `followPath` cho `outing` đi theo điểm thế giới qua `crowd.step`; bị kẹt thì chỉ bỏ qua một điểm trung gian.
  - `recall({ hurry, umbrella })`: nhả chỗ, gọi `endOuting`. Đang ở ngoài thì `outing(home)` về cửa rồi A* về bàn. `hurry` thì tốc độ 2.8 m/s, và `Pose` có thêm `speedScale` để view tăng `timeScale` của `Walking`.
  - `setVisual` sang trạng thái có việc → `recall({ hurry: true })`. `disconnected` → `recall()` rồi mới đứng yên.
  - `setWeather(c)`: chuyển sang `rain` / `storm` khi đang ở ngoài → `recall({ hurry: true, umbrella: true })`. `Pose` có thêm `umbrella: boolean`, tắt khi `isIndoor`.
  - `leave()` khi đang ở ngoài → `outing` theo `edgeExit` rồi `left`.
  - `dispose()` nhả mọi chỗ.
- [X] T040 [US3] Nối dây trong `src/web/scene/OfficeScene.tsx` và `src/web/scene/Employee.tsx`:
  - một `SpotBook` mỗi cảnh, `setPopulation(visible.length)`;
  - truyền `spots`, `shops`, `frame`, `site` vào `EmployeeBrain`;
  - gọi `brain.setWeather(condition)` khi thời tiết đổi;
  - khi `layout` đổi thì `spots.revalidate(...)` và gọi `recall()` cho các owner bị ảnh hưởng; **khi làm**: không cần gọi riêng — đổi layout dựng lại lưới nên brain được tạo lại (ngồi vào bàn) và `dispose()` trả mọi chỗ;
  - khi `useBuild` chuyển `active=true` thì `recall()` mọi brain;
  - `Employee.tsx` áp `pose.umbrella` (qua `setUmbrella`) và `pose.speedScale` (qua `play(..., timeScale)`), và cập nhật `positions` ở mọi vị trí (để FR-025 bấm được ngoài trời).
- [X] T041 [US3] Thêm vào `src/web/scene/interaction/TestHooks.tsx` (U4-4):
  - `brains()` → `{ id, mode, activity, x, z, outside }[]`;
  - `setBreakInterval(ms)`;
  - `shops()`.

  Brain cần expose `activity` và `outside`. Giữ điều kiện `testHooksEnabled()`.
- [X] T042 [US3] Thêm kịch bản `outing` vào `src/web/bench/Bench.tsx` và `src/web/bench/bench-layout.ts`: `MAX_VISIBLE` nhân viên, có sofa, bình nước, cây; khoảng nghỉ 10 s; ép `tryOuting` luôn đạt mức tối đa. Thêm kịch bản này vào `npm run bench:fps` (R4-10, SC-007).

**Checkpoint**: T024–T029 pass. Bench `outing` ≥ 60 FPS (GPU thật, lần đo thứ hai). **Đợt 2 xong**:
chạy quickstart §4.

---

## Phase 6: User Story 4 - Góc nhìn thứ nhất: tương tác với đồ vật và đi ra ngoài (Priority: P3)

**Goal**: Ở góc nhìn thứ nhất:
- ngắm và nhấn E để bật/tắt màn hình, ngồi hoặc nằm sofa, uống nước, tưới cây;
- đi ra cửa (cửa kính trượt tự mở) tới quán và về;
- bị chặn bởi tường, kính, quán, cây, nhân viên và rìa công viên.

Ở toàn cảnh, bấm vào màn hình để bật/tắt.

**Independent Test**: quickstart §5.

**Phụ thuộc**: T032 (`SiteGrid`), T031/T035 (quán), T037 (`SpotBook`) của US3.

### Tests for User Story 4

- [X] T043 [P] [US4] Mở rộng `tests/unit/fp-motion.test.ts` với `SiteGrid`:
  - `slide` từ sảnh đi thẳng qua cửa ra ngoài thì thành công;
  - đi vào tường hoặc kính thì trượt dọc, không xuyên qua;
  - không vượt `PARK_RADIUS − 1`;
  - bị chặn bởi footprint quán và thân cây;
  - `freeAt` với `others` là vị trí nhân viên thì chặn trong bán kính `RADIUS + 0.2`.
- [X] T044 [P] [US4] Unit test `tests/unit/interactables.test.ts`:
  - `buildInteractables(layout)` sinh mục cho `wall_screen`, `sofa`, `water_cooler`, `plant`;
  - `aimTarget(pos, dir, list)` chọn mục gần tâm ngắm nhất trong 2 m và lệch ≤ 12°, trả `null` ngoài tầm;
  - nhãn đúng: "Bật màn hình" / "Tắt màn hình" theo `screensOff`, "Ngồi", "Uống nước", "Tưới cây".
- [X] T045 [US4] Mở rộng `tests/e2e/first-person.spec.ts`, dùng `__agentOffice.teleportPlayer` / `player()`:
  - ngắm màn hình (mặc định bật) → `fp-hint` hiện "E — Tắt màn hình", nhấn E thì `screensOff` có id đó, `reload` vẫn tắt;
  - về toàn cảnh, bấm nút ⏻ `screen-power` thì bật lại;
  - E ở sofa → `pose: 'sit'`, Shift+E → `'lie'`, W → `'standing'`;
  - E ở bình nước / cây: sau ≤ 3 s điều khiển lại được;
  - giữ W từ sảnh ra cửa → `x, z` nằm ngoài sàn;
  - đi tới quán gần nhất rồi về trong ≤ 2 phút (SC-006); **khi làm**: e2e chỉ kiểm đi ra cửa và bị kính chặn; đi tới quán và về để cho quickstart §5 (bằng tay);
  - bấm vào nhân viên đang ở quán thì chat mở; **khi làm**: để cho quickstart §5 (nhân viên ở quán thường ngoài khung nhìn của e2e);
  - `FirstPersonHelp` có `<kbd>E</kbd>`.

### Implementation for User Story 4

- [X] T046 [US4] Sửa `src/web/scene/cameras/fp-motion.ts`:
  - `freeAt` / `slide` nhận grid kiểu giao diện chung (`SiteGrid`);
  - thêm tham số tuỳ chọn `others: Iterable<{x,z}>` để chặn trong bán kính `RADIUS + 0.2` (FR-035).
  - Giữ `RADIUS = 0.2` và comment về nửa ô.
- [X] T047 [US4] Sửa `src/web/scene/cameras/FirstPerson.tsx`:
  - nhận `site: SiteGrid`, `crowd`, `spots`, `layout`;
  - truyền `positions.values()` làm `others` cho `slide`;
  - đăng ký người dùng vào `Crowd` với id `__player__`, priority cao nhất, và cập nhật vị trí mỗi khung hình (R4-07). `OfficeScene.tsx` truyền các prop mới vào.
- [X] T048 [P] [US4] Tạo `src/web/scene/interaction/interactables.ts` (R4-08):
  - `buildInteractables(layout, screensOff)`: tâm thế giới của từng `wall_screen` / `sofa` / `water_cooler` / `plant`, cùng nhãn hành động;
  - `aimTarget(pos, dir, list, reach = 2, maxDeg = 12)`.
  - Thuần, không React.
- [X] T049 [US4] Đổi `Door` trong `src/web/scene/furniture/Furniture.tsx` thành cửa kính trượt hai cánh trong khung `DOOR_WIDTH`. Hai cánh trượt mở khi `positions` (nhân viên) hoặc camera ở góc nhìn thứ nhất nằm trong 1.5 m quanh `doorTransform`, đóng lại sau 1 s. Chỉ để nhìn, không ảnh hưởng va chạm. Giữ tấm thảm sàn. `src/web/scene/Office.tsx` truyền nguồn vị trí vào.
- [X] T050 [US4] Thêm trạng thái lúc chạy vào `src/web/state/ui.ts`: `playerPose: 'standing' | { spotId: string; pose: 'sit' | 'lie' }`, `freshPlants: Record<string, number>` (itemId → thời điểm hết hạn), `fpAim: { itemId: string; action: string } | null`. Các trạng thái này KHÔNG lưu.
- [X] T051 [US4] Thêm tương tác vào `src/web/scene/cameras/FirstPerson.tsx` (U4-3):
  - mỗi khung hình tính `aimTarget` rồi ghi vào `fpAim`;
  - phím `E` (hoặc bấm chuột khi không ngắm trúng nhân viên, vì nhân viên luôn được ưu tiên) thì thực hiện hành động:
    - **màn hình**: `useSettings.update({ screensOff: toggle(id) })`, lọc bỏ id không còn trong layout;
    - **sofa**: `spots.reserve('__player__', …)` (nằm thì giữ cả 2 chỗ, dùng Shift+E), mắt hạ còn 1.05 m khi ngồi và 0.6 m khi nằm, camera đặt tại chỗ ngồi; bấm WASD hoặc E thì `release` và đặt về ô đi được gần nhất trước sofa;
    - **bình nước**: hiện cốc trước camera trong 1.5 s, không khoá di chuyển;
    - **cây**: vài hạt nước trong 1.5 s, và `freshPlants[id] = now + 60_000`.
  - Bỏ qua phím khi đang gõ trong input hoặc khi chat đang mở (giữ quy tắc sẵn có).
- [X] T052 [P] [US4] Sửa `WallScreenFrame` trong `src/web/scene/furniture/Furniture.tsx`: nhận `on: boolean`. Khi bật, mặt màn hình emissive và có `CanvasTexture` vẽ giờ hiện tại cùng số nhân viên theo trạng thái (lấy từ `useEmployees`), cập nhật mỗi 30 s. Khi tắt thì giữ như hiện tại. Cây (`plant`) đọc `freshPlants`: còn hạn thì lá sáng hơn và rung nhẹ qua `PropJiggle`.
- [X] T053 [US4] Sửa `src/web/scene/Office.tsx`:
  - truyền `on={!screensOff.includes(item.id)}` cho `wall_screen` (màn hình quota: nội dung do `QuotaScreen` vẽ, ẩn khi tắt);
  - ở toàn cảnh, khi không ở build mode, nút ⏻ (`Html`) dưới `wall_screen` bật/tắt `screensOff` (**đổi khi làm**: bấm vào màn hình quota vẫn mở bảng quota, 001 FR-043). Không phá việc chọn và kéo đồ vật trong build mode, cũng không phá việc bấm nhân viên.
- [X] T054 [P] [US4] Thêm phần tử gợi ý `data-testid="fp-hint"` dưới `Crosshair` trong `src/web/scene/cameras/FirstPerson.tsx` (hoặc `src/web/ui/CameraToggle.tsx`). Phần tử đọc `fpAim` và hiện "E — <hành động>"; với sofa thì hiện "E — Ngồi · Shift+E — Nằm". Thêm `<kbd>E</kbd> dùng đồ vật` vào `FirstPersonHelp` trong `src/web/ui/CameraToggle.tsx` (FR-036). Thêm CSS `.fp-hint` trong `src/web/styles.css`.
- [X] T055 [US4] Thêm vào `src/web/scene/interaction/TestHooks.tsx`: `player()` → `{ x, z, pose, aim }` và `teleportPlayer(x, z, yaw)` (U4-4, chỉ khi `testHooksEnabled()`).

**Checkpoint**: T043–T045 pass. **Đợt 3 xong**: chạy quickstart §5.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T056 [P] Cập nhật `README.md`: xoá nhân viên (xoá luôn conversation và subagent con, không hoàn tác), phím E ở góc nhìn thứ nhất, nhân viên ra quán. `docs/INSTALL.md` không đổi, vì không có phụ thuộc mới.
- [X] T057 Chạy `npm run typecheck && npm run lint && npm test && npm run test:e2e`. Tất cả phải pass, `check-guards` ✓.
- [X] T058 Chạy `AGENT_OFFICE_LIVE=1 npm run test:live`, trong đó có `delete` và `latency` (độ trễ trạng thái ≤ 2 s vẫn đạt).
- [X] T059 Chạy `npm run bench:fps` với các kịch bản cũ và `outing`, mức chi tiết `medium` và `high`, GPU thật, lấy kết quả từ lần đo thứ hai. Ghi kết quả vào `specs/004-office-life-interactions/quickstart.md` (§6). Nếu < 60 FPS thì giảm chi tiết quán hoặc giảm suất ra ngoài, rồi đo lại.
- [X] T060 Chạy tay toàn bộ `specs/004-office-life-interactions/quickstart.md` §2–§6 trên App thật, chỉ xoá conversation `[agent-office-test]`. Đánh dấu kết quả ngay trong file.
- [X] T061 Theo `docs/INSTALL.md`, cài lại từ một bản clone sạch trên macOS và chạy được trong ≤ 15 phút, rồi ghi kết quả vào `specs/004-office-life-interactions/quickstart.md` §6 (Constitution VI, cổng chất lượng 5).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc gì.
- **Foundational (Phase 2)**: sau Setup. Chặn US1 (`legendCollapsed`) và US4 (`screensOff`).
- **US1 (Phase 3)**: sau Phase 2.
- **US2 (Phase 4)**: chỉ cần Phase 1 (mock App). Làm song song được với US1.
- **US3 (Phase 5)**: sau Phase 1. Độc lập với US1 và US2.
- **US4 (Phase 6)**: sau Phase 2 và các task T031, T032, T035, T037 của US3.
- **Polish (Phase 7)**: sau mọi story muốn giao.

### User Story Dependencies

- **US1**: độc lập.
- **US2**: độc lập. T023 cần luồng `leaving` sẵn có, không phụ thuộc US3.
- **US3**: độc lập với US1 và US2.
- **US4**: phụ thuộc `SiteGrid`, quán và `SpotBook` của US3.

### Within Each User Story

- Test viết trước và phải FAIL trước khi cài đặt.
- US2: T015 → T016 → T017 / T018 → T019 → T020 / T021 / T022 → T023.
- US3: T030 → T031 → T032 → **T033 (chuyển sang `SiteGrid`, không đổi hành vi, chạy lại test cũ)** → T034…T038 (song song) → T039 → T040 → T041 → T042.
- US4: T046 → T047; T048 / T050 → T051 → T052 / T053 / T054 → T055.

---

## Parallel Opportunities

- Phase 1: T001 ∥ T002.
- Phase 2: T006 song song với T005 sau khi T003 và T004 xong.
- US1 ∥ US2 ∥ US3 có thể chạy song song sau Phase 1–2 (khác file, trừ `styles.css` của T009 và T022, nên làm tuần tự hai task này).
- Trong US3: T034, T036, T037, T038 làm song song được sau T033.

### Parallel Example: User Story 2

```text
Task: "T010 Contract test tests/contract/adapter-delete.test.ts"
Task: "T011 Route test tests/contract/routes-delete.test.ts"
Task: "T012 Leak test tests/leaks/redaction.test.ts"
Task: "T013 E2E tests/e2e/delete-employee.spec.ts"
Task: "T014 Live test tests/live/delete.live.test.ts"
```

### Parallel Example: User Story 3

```text
# Sau T033:
Task: "T034 grocery/cart trong src/web/scene/city/Shops.tsx"
Task: "T036 src/web/scene/outdoor-route.ts"
Task: "T037 src/web/scene/break-spots.ts"
Task: "T038 clip Lying/Drinking + ô trong src/web/scene/character.ts"
```

### Parallel Example: User Story 4

```text
Task: "T043 tests/unit/fp-motion.test.ts"
Task: "T044 tests/unit/interactables.test.ts"
Task: "T048 src/web/scene/interaction/interactables.ts"
```

---

## Implementation Strategy

### MVP First (Đợt 1 = US1 + US2)

1. Phase 1 và Phase 2.
2. US1 (T007–T009), rồi US2 (T010–T023).
3. **DỪNG và kiểm chứng**: quickstart §2–3, live T014 trên App thật.
4. Dùng hằng ngày được: dọn văn phòng và panel không tràn màn hình.

### Incremental Delivery

1. **Đợt 1**: US1 + US2, MVP.
2. **Đợt 2**: US3. Bắt đầu bằng T033 (chuyển `SiteGrid` mà không đổi hành vi) làm mốc an toàn. Sau đó là quán, `SpotBook`, các mode mới, bench.
3. **Đợt 3**: US4.
4. Sau mỗi đợt: đối chiếu thước đo thành công (Constitution IV), rồi chạy Polish cho phần đã giao.

---

## Notes

- **Phát hiện khi làm (T029)**: hai người đi ngược chiều trong lối hẹp có thể nhích qua lại mãi (có từ 002,
  lộ ra khi khoảng nghỉ rút ngắn). Đã sửa trong `employee-behaviors.ts`: đo quãng đường ròng trong 2 s,
  dưới 0.3 m thì lập lại đường tránh mọi người (`Crowd.occupiedCells(..., everyone)`); không có đường vòng thì
  né sang một ô bên cạnh.
- **Phát hiện khi mô phỏng 30 phút (T066)**: (1) bàn ở quán (vật cản 0.3 m + lề) làm ô của ghế đẩu bị chặn →
  ngồi xuống rồi không đứng dậy được (kẹt vĩnh viễn) — bàn còn 0.2 m; (2) gần tới ghế nhưng nhích mãi —
  coi như tới khi < 0.15 m; (3) đối đầu ngoài trời (cửa, đường dạo) — chèn điểm né sang bên; (4) đồng nghiệp
  ngồi xuống sát người đang đứng → người đứng không bước ra được — `Crowd` cho phép bước làm tăng khoảng
  cách, và chỉ ngồi xuống khi chỗ ngồi thoáng; (5) đứng dậy khỏi ghế đẩu không kiểm tra người bên cạnh →
  dùng `standUp()`; (6) xếp hàng ở bình nước nhích mãi → kẹt trong 1.4 m quanh bình thì uống tại chỗ.
  Kiểm bằng `SOAK=1 npx vitest run tests/unit/soak.test.ts`.
- **Đổi khi làm (FR-031)**: `Settings.screensOff` (màn hình đã tắt) thay cho `screensOn`, mặc định bật, để
  màn hình quota của 001 vẫn hiện; ở toàn cảnh bật/tắt bằng nút ⏻ vì bấm vào màn hình quota mở bảng quota.
- **Phát hiện khi chạy với App thật (T060)**: xoá khi khung chat đang mở → stream/poll bước của chat làm
  conversation sống lại. Đã sửa trong adapter: dừng watch trước khi xoá, đọc lại danh sách, xoá lại tối đa
  3 lần (contracts/app-adapter.md A4-1).
- **Phát hiện khi người dùng chạy `npm start`**: trang trắng (React #185) vì selector `?? []` trả mảng mới
  mỗi lần khi `settings.json` cũ chưa có `screensOff`. Đã sửa bằng hằng `NO_IDS`; e2e chống tái phát trong
  `legend.spec.ts`.
- Chạy về khi có việc chỉ áp dụng khi brain có `SpotBook` (hành vi 004); trong nhà 2.0 m/s, ngoài trời
  2.8 m/s. Chạy 2.8 m/s trong văn phòng chật làm mô phỏng crowd cũ bị kẹt.

- [P] = khác file, không phụ thuộc task chưa xong.
- Commit sau mỗi task hoặc nhóm task logic.
- Không xoá conversation thật nào ngoài `[agent-office-test]`, kể cả khi thử bằng tay.
- `SiteGrid` là thay đổi rủi ro nhất: luôn chạy lại toàn bộ test crowd, brain và fp cũ sau T033 và T046.

## Phase 8: Convergence

- [X] T062 Giữ brain của nhân viên khi chỉ phần công viên đổi (mức chi tiết do `PerfManager` tự hạ, đổi thành phố): hiện `site` trong `src/web/scene/OfficeScene.tsx` phụ thuộc `detailLevel`/`city`, và `Employee.tsx` tạo lại brain theo `[grid]`, nên nhân viên đang nghỉ/ở quán bị dịch chuyển tức thời về bàn. Tách vật cản cây ra khỏi khoá tạo brain (ví dụ `SiteGrid.setTrees()` cập nhật tại chỗ, brain chỉ tạo lại khi `OfficeGrid` đổi) và thêm unit test per FR-028, research R4-09 (partial)
- [X] T063 Kiểm chứng đi bộ từ bàn ra một quán rồi về trong ≤ 2 phút ở góc nhìn thứ nhất, và bấm vào nhân viên đang ngồi ở quán thì mở chat (chưa có e2e hay lần chạy thật nào kiểm) — thêm vào `tests/e2e/first-person.spec.ts` hoặc chạy trên App thật và ghi kết quả vào `quickstart.md` per SC-006, US4/AC7, FR-025 (partial)
- [X] T064 Chạy lại toàn bộ `npm run test:e2e` và `AGENT_OFFICE_LIVE=1 npm run test:live` sau hai sửa đổi muộn (adapter `deleteConversation` dừng watch + xoá lại; hằng `NO_IDS`), ghi kết quả vào `quickstart.md` per T057, T058, Constitution quality gate 1 (partial)
- [X] T065 Trong `tests/e2e/office-life.spec.ts`, khi gọi nhân viên đang ở quán về, kiểm thêm badge trên đầu (`.tag-badge`) đổi trong ≤ 2 s, không chỉ mode của brain per US3/AC4, SC-005 (partial)
- [X] T066 Quan sát 30 phút với ≥ 6 nhân viên rảnh (khoảng nghỉ rút ngắn) để đo "không kẹt quá 5 s, không ngồi chồng" — hiện e2e chỉ chạy ≤ 3 phút; chạy một lần (bench hoặc script trên App thật) và ghi kết quả vào `quickstart.md` per SC-004 (partial)
