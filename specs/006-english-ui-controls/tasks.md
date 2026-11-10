---
description: "Danh sách task cho 006: giao diện tiếng Anh và cải tiến điều khiển"
---

# Tasks: Giao diện tiếng Anh và cải tiến điều khiển

**Input**: Tài liệu thiết kế trong `specs/006-english-ui-controls/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Spec không yêu cầu viết test trước (TDD). Task test chỉ gồm (a) các test hiện có bị hỏng do đổi chữ, và (b) mỗi hành vi mới một bài kiểm tra, như liệt kê trong quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- Đường dẫn tính từ gốc repo (một dự án web: `src/server`, `src/shared`, `src/web`, `tests/`)

**Quy tắc dịch (mọi task của US1)**: dịch sang tiếng Anh đơn giản mọi chuỗi hiển thị cho người dùng: chuỗi trong code, chữ trong JSX, `title`, `aria-label`, `placeholder` và `message` của lỗi. **Không** dịch: nội dung của người dùng hoặc agent, dữ liệu mẫu trong `tests/contract/fixtures/`, id, giá trị enum và `data-testid`. Comment chiếm cả dòng có thể giữ nguyên. Comment tiếng Việt nằm cuối một dòng code phải dịch, vì bước kiểm tra (f) sẽ báo. Giữ đúng nghĩa, và giữ nguyên các phím gợi ý (`<kbd>`).

---

## Phase 1: Setup

- [X] T001 Tạo và chuyển sang branch `006-english-ui-controls` từ `main` (git), để nguyên các thay đổi không liên quan trong thư mục làm việc (`.gitignore`, `.specify/extensions*`, `.claude/skills/speckit-bug-*`), không commit và không sửa

---

## Phase 2: Foundational

Không có việc nào chặn. Mỗi user story chạm vào phần code khác nhau. File dùng chung duy nhất là `src/shared/schemas.ts`, do US1 (chuỗi) và US5 (trường mới) cùng sửa. Làm theo thứ tự nào cũng được, nhưng không làm cùng lúc.

---

## Phase 3: User Story 1 - Dùng ứng dụng hoàn toàn bằng tiếng Anh (Priority: P1) 🎯 MVP

**Goal**: Không còn chữ tiếng Việt nào trên giao diện, ngày và số theo định dạng tiếng Anh (FR-001..006).

**Independent Test**: `npm test` qua, gồm cả bước kiểm tra mới (f). Làm bước 1 trong quickstart.md.

### Implementation

- [X] T002 [P] [US1] Dịch các chuỗi dùng chung (lý do bố cục không hợp lệ, nhãn đồ vật, tên thành phố và tên hiển thị, thông báo lỗi của schema) trong `src/shared/layout-validation.ts`, `src/shared/catalog.ts`, `src/shared/schemas.ts`, `src/shared/domain.ts`, `src/shared/layout-migrate.ts`
- [X] T003 [P] [US1] Dịch thông báo của server trong `src/server/main.ts`, `src/server/http/routes/layout.ts`, `src/server/http/routes/settings.ts`, `src/server/http/routes/projects.ts`, `src/server/services/folders.ts`, `src/server/services/weather.ts`. Cảnh báo phiên bản phải tiếp tục lấy số phiên bản từ danh sách đã kiểm chứng (constitution II), không ghi cứng.
- [X] T004 [P] [US1] Dịch nhãn mặc định trong các mapper của lớp kết nối `src/server/app-adapter/mappers/step.ts`, `project.ts`, `quota.ts`, `conversation.ts`. Chỉ đổi chuỗi, không đổi tên RPC, cách ánh xạ trường hay nguồn lấy số phiên bản (constitution II).
- [X] T005 [P] [US1] Dịch giao diện chat: `src/web/ui/chat/ChatPanel.tsx` (gồm `aria-label="Đóng"` → `"Close"`, `"Trò chuyện"` → `"Chat"`), `StepView.tsx`, `QuestionPrompt.tsx`, `HireDialog.tsx`, `ConfirmDeleteDialog.tsx`, `Composer.tsx`, `ModelPicker.tsx`, `PermissionPrompt.tsx`, `extensions.tsx`
- [X] T006 [P] [US1] Dịch phần giao diện còn lại trong `src/web/ui/settings/SettingsPanel.tsx`, `src/web/ui/settings/UsageStats.tsx`, `src/web/ui/build/BuildMode.tsx`, `src/web/ui/build/AddDeskHint.tsx`, `src/web/ui/projects/ProjectDialog.tsx`, `src/web/ui/quota/QuotaPanel.tsx` (kèm đổi `'vi-VN'` → `'en-US'`, 3 chỗ), `src/web/ui/quota/QuotaScreen.tsx`, `src/web/ui/CameraToggle.tsx` ("Góc nhìn thứ nhất" → "First person", "Toàn cảnh" → "Overview"), `src/web/ui/ProjectLegend.tsx`, `src/web/ui/OverflowList.tsx`, `src/web/App.tsx`, `src/web/bench/Bench.tsx`
- [X] T007 [P] [US1] Dịch chữ trong cảnh 3D (biển quán, nhãn, tooltip) trong `src/web/scene/Employee.tsx`, `src/web/scene/Office.tsx`, `src/web/scene/character.ts`, `src/web/scene/city/city-layout.ts`, `src/web/scene/city/Shops.tsx`, `src/web/scene/city/CitySkyline.tsx`, `src/web/scene/park/Trees.tsx`, `src/web/scene/park/park-layout.ts`, `src/web/scene/furniture/Furniture.tsx` (kèm đổi `'vi-VN'` → `'en-US'` của đồng hồ), `src/web/scene/interaction/interactables.ts`, `src/web/scene/cameras/FirstPerson.tsx`, `src/web/scene/perf/PerfManager.tsx`, `src/web/theme/concept.ts`, `src/web/styles.css`
- [X] T008 [P] [US1] Đổi ngôn ngữ của trang: `<html lang="vi">` → `lang="en"` trong `src/web/index.html`. (Việc đổi `'vi-VN'` → `'en-US'` thuộc T006 và T007, là task sở hữu các file đó.) Giữ các bộ ký tự `vietnamese` của font trong `src/web/fonts.css`, vì nội dung của người dùng và agent vẫn có thể là tiếng Việt (FR-005).
- [X] T009 [US1] Thêm bước kiểm tra (f) vào `scripts/check-guards.sh`: tìm trong `src/` (`*.ts`, `*.tsx`, `*.html`, `*.css`) các dòng chứa `[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]`, không phân biệt hoa thường (`LC_ALL=C.UTF-8 grep -RniE`, để bắt cả chữ hoa như `Ở`, `Á`, `Đ`; không dùng `-P` vì `/usr/bin/grep` của macOS không có `-P`; không dùng `en_US.UTF-8` vì máy thiếu bộ ngôn ngữ này sẽ so theo byte và báo nhầm `×`). Bỏ các dòng mà phần chữ đầu tiên là `//`, `*`, `/*` hoặc `{/*`. In `✗ (f) Vietnamese UI text in src/:` kèm các dòng tìm thấy, và đặt `fail=1`. Thêm bước tự kiểm tra: phải bắt được `Ở`, không được báo `×`. Cập nhật danh sách ở comment đầu file. Phụ thuộc T002–T008.
- [X] T010 [US1] Chạy `bash scripts/check-guards.sh` và sửa mọi dòng bước (f) còn báo, ở bất kỳ file nào trong `src/`, cho tới khi qua
- [X] T011 [P] [US1] Sửa các test đang so sánh với chữ tiếng Việt sang chữ tiếng Anh mới: `tests/unit/city-layout.test.ts`, `tests/unit/interactables.test.ts`, `tests/unit/question-answer.test.ts`, `tests/contract/routes-question.test.ts`, `tests/contract/adapter-write.test.ts`, `tests/contract/adapter-project.test.ts`, `tests/contract/adapter-read.test.ts`, `tests/contract/adapter-steps-2-29.test.ts`, `tests/live/permission.live.test.ts`. Các so sánh với nội dung dữ liệu mẫu từ App thật giữ tiếng Việt.
- [X] T012 [P] [US1] Đổi selector và so sánh trong e2e (`getByRole({ name })`, `getByText`, `toHaveText`) sang tiếng Anh trong `tests/e2e/*.spec.ts` (first-person, wave2, settings, build-drag, legend, build, office-resize, projects, chat, delete-employee, resilience, model-memory, fonts, question, theme) và trong `tests/e2e/mock-app.ts` (chỉ nhãn của server giả lập; nội dung cuộc trò chuyện giả lập có thể giữ tiếng Việt để kiểm tra FR-005). Giữ nguyên `SAMPLE` trong `tests/e2e/fonts.spec.ts`, vì nó kiểm tra nội dung tiếng Việt của người dùng vẫn hiển thị đúng.
- [X] T013 [US1] Trong `docs/INSTALL.md` và `README.md`, chỉ thay các tên nút và thông báo được trích (ví dụ **Xây dựng**, "+ Tạo project", "Không thu nhỏ được", "Góc nhìn thứ nhất") bằng nhãn tiếng Anh mới từ T005–T007. Giữ nguyên phần văn bản tiếng Việt, để hướng dẫn cài đặt khớp với giao diện (constitution VI, cổng 5).
- [X] T014 [US1] Chạy `npm run typecheck && npm test && npm run test:e2e` và sửa các lỗi do việc dịch gây ra

**Checkpoint**: ứng dụng hoàn toàn bằng tiếng Anh. Giao như bản dùng được đầu tiên (MVP).

---

## Phase 4: User Story 2 - Đóng khung chat bằng Esc (Priority: P1)

**Goal**: Esc đóng khung chat; popup đè lên chat nhận Esc trước (FR-007..009, contracts/ui-input.md).

**Independent Test**: bước 2–4 trong quickstart.md.

- [X] T015 [P] [US2] Trong `src/web/ui/chat/ConfirmDeleteDialog.tsx`, gọi `e.preventDefault()` khi bộ xử lý Esc đóng hộp thoại (vẫn tôn trọng điều kiện `!busy`)
- [X] T016 [US2] Trong `src/web/ui/chat/ChatPanel.tsx`, thêm một `useEffect` với bộ nghe `keydown` trên `window` ở pha nổi bọt: `if (e.key === 'Escape' && !e.defaultPrevented) close()`. Phải hoạt động cả khi đang gõ trong ô tin nhắn, và không được xoá bản nháp (FR-009). Kiểm tra `src/web/ui/chat/extensions.tsx` đã gọi `preventDefault()` khi Esc (pha bắt); nếu chưa thì sửa.
- [X] T017 [P] [US2] Trong `src/web/ui/build/BuildMode.tsx`, cho nhánh Esc của `onKey` thoát sớm khi `useUi.getState().openConversationId !== null`, để một lần Esc không đồng thời bỏ chọn đồ trong bảng hoặc bỏ chọn đồ vật
- [X] T018 [US2] Thêm test e2e trong `tests/e2e/chat.spec.ts`: Esc đóng chat khi đang có chữ trong ô tin nhắn; mở menu (`/` hoặc `@`) rồi Esc thì chat vẫn mở, Esc lần hai mới đóng chat. Trong `tests/e2e/delete-employee.spec.ts`: Esc ở hộp xoá thì chat vẫn mở.

**Checkpoint**: US1 + US2 dùng được.

---

## Phase 5: User Story 3 - Xoá đồ vật bằng chuột phải (Priority: P2)

**Goal**: trong chế độ Xây dựng, chuột phải vào đồ vật đang chọn thì xoá nó (hoàn tác được); ngoài ra không xoá gì; không hiện menu chuột phải của trình duyệt (FR-010..013).

**Independent Test**: bước 5–6 trong quickstart.md.

- [X] T019 [US3] Trong `src/web/scene/OfficeScene.tsx`, sửa hàm `onItemPress` của chế độ Xây dựng: khi `e.button === 2`, gọi `build.removeSelected()` nếu `item.id === useBuild.getState().selectedId`, rồi `return` trong mọi trường hợp (không `select`, không `beginDrag`). Hành vi chuột trái giữ nguyên.
- [X] T020 [P] [US3] Chặn menu chuột phải của trình duyệt trên khung 3D: thêm `onContextMenu={(e) => e.preventDefault()}` vào `<Canvas>` của R3F trong `src/web/App.tsx` (khoảng dòng 69)
- [X] T021 [US3] Kiểm tra trong `src/web/scene/interaction/DragLayer.tsx` rằng nhấn chuột phải không khởi động thao tác kéo hay kéo ngang camera (`beginDrag` không bao giờ được gọi với `button === 2`). Nếu có thì sửa. Bấm chuột phải giữa lúc đang kéo bằng chuột trái vốn đã an toàn, vì trình duyệt không phát `pointerdown` thứ hai khi một nút đang được giữ (nút bấm thêm đến dưới dạng `pointermove`). Thêm một dòng comment giải thích trong `src/web/scene/OfficeScene.tsx`, cạnh đoạn kiểm tra `e.button === 2` của T019.
- [X] T022 [US3] Thêm test e2e: chọn một đồ vật rồi bấm chuột phải vào nó, đồ vật bị xoá và ⌘Z mang lại; bấm chuột phải vào đồ vật chưa chọn, số đồ vật không đổi; bắt đầu kéo đồ vật đang chọn bằng chuột trái, nhấn chuột phải giữa chừng, đồ vật vẫn còn. Dùng các hook test có sẵn trong `src/web/scene/interaction/TestHooks.tsx` để lấy vị trí đồ vật trên màn hình.

**Checkpoint**: US1–US3 dùng được.

---

## Phase 6: User Story 4 - Fullscreen ở chế độ Toàn cảnh và Góc nhìn thứ nhất (Priority: P2)

**Goal**: một nút bật/tắt và phím tắt F, đưa cả trang vào fullscreen, giữ khi đổi camera, trạng thái khớp với trình duyệt (FR-014..017).

**Independent Test**: bước 7–8 trong quickstart.md.

- [X] T023 [US4] Trong `src/web/ui/CameraToggle.tsx`, thêm `useFullscreenHotkey()` (cùng điều kiện bỏ qua ô nhập và ⌘/Ctrl như `useCameraHotkey`, phím `KeyF`) và nút `FullscreenToggle`. Nút dùng `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`, lấy trạng thái từ sự kiện `fullscreenchange`, bị vô hiệu hoá kèm `title="Fullscreen is not available in this browser"` khi `!document.fullscreenEnabled`, và khi yêu cầu bị từ chối thì hiện "Fullscreen is not available" cạnh nút trong 3 giây. Dùng `data-testid="fullscreen-toggle"`, `aria-pressed`, và nhãn "⛶ Fullscreen" / "Exit fullscreen".
- [X] T024 [US4] Hiển thị `<FullscreenToggle />` cạnh `<CameraToggle />` và gọi `useFullscreenHotkey()` cạnh `useCameraHotkey()` trong `src/web/App.tsx`. Thêm phím `F` vào dòng gợi ý `FirstPersonHelp` trong `src/web/ui/CameraToggle.tsx`.
- [X] T025 [US4] Thêm test e2e trong `tests/e2e/first-person.spec.ts` (hoặc file mới `tests/e2e/fullscreen.spec.ts`): bấm nút, mong đợi `document.fullscreenElement` khác null và `aria-pressed="true"`; bấm `V`, vẫn fullscreen; bấm `F`, fullscreen về null. Nếu Chromium không giao diện (headless) từ chối fullscreen thì kiểm tra dòng thông báo "not available" thay thế.

**Checkpoint**: US1–US4 dùng được.

---

## Phase 7: User Story 5 - Điều chỉnh độ nhạy chuột (Priority: P3)

**Goal**: một thanh trượt được lưu lại, khoảng 0.25–3.0 (mặc định 1), điều chỉnh tốc độ nhìn ở góc nhìn thứ nhất và tốc độ xoay ở Toàn cảnh (FR-018..020, data-model.md).

**Independent Test**: bước 9–11 trong quickstart.md.

- [X] T026 [US5] Thêm `mouseSensitivity?: number` vào `Settings` trong `src/shared/domain.ts` (comment: "006: optional, 0.25–3, absent = 1"), và `mouseSensitivity: z.number().min(0.25).max(3).optional()` vào `settingsSchema` trong `src/shared/schemas.ts`. Phải để tuỳ chọn, vì trường bắt buộc sẽ khiến JsonStore đặt lại các file settings.json cũ. Không thêm vào `DEFAULT_SETTINGS` trong `src/server/services/settings.ts`.
- [X] T027 [P] [US5] Truyền `pointerSpeed={useSettings((s) => s.settings.mouseSensitivity ?? 1)}` vào `<PointerLockControls>` trong `src/web/scene/cameras/FirstPerson.tsx`
- [X] T028 [P] [US5] Truyền `azimuthRotateSpeed` và `polarRotateSpeed` bằng `settings.mouseSensitivity ?? 1` vào `<CameraControls>` trong `src/web/scene/cameras/Overview.tsx`. Giữ nguyên `dollySpeed` và `truckSpeed`.
- [X] T029 [US5] Trong `src/web/ui/settings/SettingsPanel.tsx`, thêm `<input type="range" min=0.25 max=3 step=0.05 data-testid="mouse-sensitivity">` với nhãn "Mouse sensitivity", hiện giá trị dạng `1.00×`, cập nhật qua `update({ mouseSensitivity })`, kèm nút "Reset" (`data-testid="mouse-sensitivity-reset"`) đặt về 1
- [X] T030 [P] [US5] Bổ sung `tests/unit/settings-compat.test.ts`: object từ trước 006 không có `mouseSensitivity` vẫn hợp lệ; `0.25` và `3` được chấp nhận; `0.2`, `3.1` và `"1"` bị từ chối
- [X] T031 [US5] Thêm test e2e trong `tests/e2e/settings.spec.ts`: đặt thanh trượt về 2, tải lại trang, thanh trượt vẫn hiện 2.00×; bấm Reset thì hiện 1.00×

**Checkpoint**: xong cả năm user story.

---

## Phase 8: Polish & Cross-Cutting

- [X] T032 Chạy `npm run typecheck && npm run lint && npm test && npm run test:e2e` (Chromium dùng GPU thật, cổng 4 của constitution; lấy kết quả từ lần chạy thứ hai)
- [X] T033 Tự đi qua từng bước trong `specs/006-english-ui-controls/quickstart.md` với `npm run dev`, kể cả soát bằng mắt các chữ tiếng Việt không dấu mà bước kiểm tra (f) không bắt được

---

## Dependencies & Execution Order

- **T001** làm trước mọi thứ.
- **US1 (T002–T014)**: T002–T008 chạy song song. Sau đó T009 → T010. T011 và T012 chạy song song với T009/T010 được. T013 (tên nút trong tài liệu, sau T005–T007), rồi T014 cuối cùng.
- **US2, US3, US4, US5** độc lập với nhau và với US1 về logic. Tuy nhiên chữ mới chúng thêm vào là tiếng Anh, và các task e2e của chúng (T018, T022, T025, T031) nên chạy sau T012 để viết theo selector tiếng Anh.
- **File dùng chung**: `CameraToggle.tsx` (T006 dịch chữ, rồi T023/T024), `SettingsPanel.tsx` (T006, rồi T029), `BuildMode.tsx` (T006, rồi T017), `ChatPanel.tsx` (T005, rồi T016), `schemas.ts` và `domain.ts` (T002, rồi T026), `App.tsx` (T006, rồi T020/T024). Làm phần sửa của US1 trước để tránh xung đột.
- **Polish** (T032–T033) làm sau khi xong mọi user story.

## Parallel Examples

- **US1**: T002, T003, T004, T005, T006, T007 và T008 cùng lúc (không trùng file), rồi T011 và T012 cùng lúc.
- **US2**: T015 và T017 cùng lúc, rồi T016.
- **US3**: T019 và T020 cùng lúc.
- **US5**: T027, T028 và T030 cùng lúc sau T026.

## Implementation Strategy

1. **Bản dùng được đầu tiên (MVP)** = Phase 1 + US1. Đây là thay đổi lớn nhất, và nhờ làm trước nên các user story sau thêm chữ tiếng Anh ngay từ đầu.
2. Sau đó US2 (P1, nhỏ), US3 và US4 (P2), rồi US5 (P3). Mỗi phase kết thúc ở một checkpoint mà ứng dụng vẫn dùng hằng ngày được (constitution IV).
3. Commit theo từng user story.

## Implementation Notes (2026-11-10)

- T009: bước kiểm tra tên là **(f)**, không phải (e), vì `check-guards.sh` đã có bước (e). Dùng `LC_ALL=C.UTF-8` thay cho `en_US.UTF-8`, vì nếu thiếu bộ ngôn ngữ đó, `grep` sẽ so theo byte và báo nhầm `×`. Bước tự kiểm tra sẵn có sẽ làm bước kiểm tra báo lỗi nếu cài đặt ngôn ngữ trên máy bị hỏng.
- T015: hộp xoá nghe Esc ở pha bắt (capture), vì bộ nghe của khung chat được đăng ký trước nên ở pha nổi bọt sẽ chạy trước hộp xoá.
- T021: sửa tận gốc trong `beginDrag` (thoát khi `event.button !== 0`), nên nhấn chuột phải không bao giờ bắt đầu bất kỳ thao tác kéo nào (đồ vật, nhân viên, tay nắm đổi kích thước phòng).
- T022: các test e2e cho chuột phải nằm trong `tests/e2e/build-drag.spec.ts` (file này đã có sẵn hàm hỗ trợ kéo và tính vị trí trên màn hình), không phải `build.spec.ts`. T025: nằm trong file mới `tests/e2e/fullscreen.spec.ts`.
- T032: test "busy agent…" trong `tests/e2e/delete-employee.spec.ts` lỗi khoảng 1 trên 40 lần chạy. Code trước 006 cũng lỗi y như vậy (2 trên 80 lần), nên đây là lỗi tranh chấp thời gian (race) có từ trước, không phải do 006.
- T033: chủ dự án đã tự kiểm tra bằng tay ngày 2026-11-10, mọi chức năng hoạt động đầy đủ.

## Phase 9: Convergence

- [X] T034 [US2] Cho các hộp thoại `SettingsPanel` (`src/web/ui/settings/SettingsPanel.tsx`), `HireDialog` (`src/web/ui/chat/HireDialog.tsx`), `ProjectDialog` (`src/web/ui/projects/ProjectDialog.tsx`) và bảng quota (`src/web/ui/quota/QuotaPanel.tsx`) nhận Esc ở pha bắt (capture) giống `ConfirmDeleteDialog`: gọi `e.preventDefault()` rồi đóng hộp thoại đó, để khi khung chat đang mở, Esc chỉ đóng hộp thoại trên cùng chứ không đóng chat phía sau. Thêm một test e2e: mở chat, mở Settings, bấm Esc thì Settings đóng còn chat vẫn mở per FR-008 (partial)

## Phase 10: Convergence

- [X] T035 [US2] Trong `src/web/ui/build/BuildMode.tsx`, cho nhánh Esc của `onKey` thoát sớm cả khi `e.defaultPrevented` (một hộp thoại như Settings, Quota, Hire hoặc New project đã dùng phím Esc qua `useEscapeToClose`), để trong chế độ Xây dựng một lần Esc chỉ đóng hộp thoại chứ không đồng thời bỏ chọn đồ trong bảng hoặc bỏ chọn đồ vật. Thêm một test e2e: vào chế độ Xây dựng, chọn một đồ vật, mở Settings, bấm Esc thì Settings đóng và `selectedId` vẫn giữ per plan: R4 / contracts/ui-input.md thứ tự xử lý Esc (partial)
