---
description: "Task list for 002-realistic-ui-refresh"
---

# Tasks: Làm mới giao diện theo concept thực tế hơn

**Input**: Design documents from `/specs/002-realistic-ui-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Có. Plan và quickstart yêu cầu test cụ thể. Cổng chất lượng của Constitution cũng bắt buộc
contract test cho lớp kết nối App. Riêng US2 phải viết test tái hiện lỗi **trước** khi sửa.

**Organization**: Nhóm theo user story để mỗi story làm và kiểm thử độc lập. Các đợt A1–A3, B0–B2
trong plan tương ứng các phase bên dưới.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Chạy song song được (file khác nhau, không phụ thuộc task chưa xong)
- **[Story]**: US1–US7 theo spec.md

## Path Conventions

Một package: `src/shared`, `src/server`, `src/web`, `tests/{unit,contract,e2e}`. Trang concept nằm ở
`concepts/` (gốc repo, không bundle vào app).

---

## Phase 1: Setup

**Purpose**: Chuẩn bị chung, không đổi hành vi sản phẩm

- [x] T001 Tạo branch `002-realistic-ui-refresh` từ `main`, và tạo `specs/002-realistic-ui-refresh/concept-decision.md` với nội dung khởi tạo `status: pending`, `chosen: null`, `feedback: ""`, `tokens: {}` (data-model §7)
- [X] T002 [P] Thêm các `data-testid` của contracts/ui-interactions.md U-6 vào danh sách hằng số dùng chung cho e2e trong `tests/e2e/mock-app.ts` (hoặc file helper e2e hiện có), chưa gắn vào UI
- [X] T003 [P] Thêm tham số `--scenario <name>` và `--floor <WxD>` vào `scripts/bench-fps.ts` và `src/web/bench/Bench.tsx` (bỏ qua kịch bản chưa có, in cảnh báo), để các phase sau gắn kịch bản `crowd` và `floor 40x40`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Bố cục schema v2. US2, US3, US4 cần nó; US1 không cần (US1 làm song song được với phase này).

**⚠️ CRITICAL**: US2, US3, US4 không bắt đầu được cho tới khi phase này xong

- [X] T004 Định nghĩa kiểu v2 trong `src/shared/domain.ts` theo data-model §3:
  - `OfficeLayout { schemaVersion: 2; floor: { width: number; depth: number }; shell: { glassSide: 'north'; door: { side: 'south'|'east'|'west'; offset: number } }; items: PlacedItem[] }`
  - `PlacedItem { id; type; pos: { x: number; z: number }; rotation: 0|90|180|270 }`; bỏ `'door'` khỏi item đặt được
  - Giữ type `OfficeLayoutV1` / `PlacedItemV1` (có `cell`) chỉ cho việc chuyển đổi
- [X] T005 Đổi `src/shared/catalog.ts` sang mét:
  - Footprint bằng mét: desk 1,5×1, chair 0,5×0,5, plant 0,5×0,5, water_cooler 0,5×0,5, sofa 2×1, wall_screen 1,5×0,5, wall/glass_wall dài 0,5
  - `rotatedSize` trả về mét; thay `footprintCells` bằng `footprintRect(item) → {x0,z0,x1,z1}`
  - `seatPoint(desk)` trả về toạ độ mét của tâm chỗ ngồi theo 4 hướng xoay (chuyển từ logic `seatCell` hiện tại, mỗi ô = 0,5 m, lấy tâm ô)
- [X] T006 Cập nhật zod trong `src/shared/schemas.ts`:
  - `officeLayoutV2Schema`: `floor.width`/`floor.depth` từ 6 đến 40 và là bội số của 0,5; `pos` của furniture là bội số 0,05 (sai số 1e-6); `pos` của `wall`/`glass_wall` là bội số 0,5
  - `layoutPutSchema = { layout: OfficeLayoutV2|V1, seating?: Record<conversationId, string|null> }`, đồng thời chấp nhận body là `OfficeLayout` trần (contracts/local-api.md L2-2)
  - `officeLayoutV1Schema` giữ lại để đọc file cũ
- [X] T007 Tạo `src/shared/layout-migrate.ts` với `migrateV1toV2(v1)` theo data-model §3 "Chuyển đổi v1 → v2":
  - `floor.width = widthCells × 0,5`, `floor.depth = depthCells × 0,5`; furniture `pos = cell × 0,5`
  - Tường hoặc vách kính trên chu vi bị bỏ khỏi `items`; nếu mọi ô cạnh bắc là `glass_wall` thì `glassSide: 'north'`
  - `door` trên chu vi chuyển thành `shell.door`; không có cửa thì đặt cửa giữa cạnh nam
  - Vách trong giữ nguyên; trả về `OfficeLayout` v2
- [X] T008 Tạo `src/web/scene/crowd/nav-grid.ts`: lưới điều hướng 0,25 m suy ra từ layout v2. Mỗi footprint chặn được nới thêm bán kính 0,28 m. Vách trong chặn cạnh. API `walkable(x,z)`, `toCell`, `toWorld`, `neighbors`. Chuyển `src/web/scene/grid/astar.ts` sang dùng lưới này qua interface chung.
- [X] T009 Viết lại `src/shared/layout-validation.ts` cho v2 theo data-model §3 "Quy tắc kiểm tra" 1–6:
  - Chồng chữ nhật giữa vật chặn với sai số 1 mm; ghế được chồng vùng ngồi của bàn nó thuộc
  - Mỗi bàn có `seatPoint` đi tới được từ cửa trên lưới 0,25 m; dùng bản thuần của nav-grid, chuyển phần lõi sang `src/shared/nav-core.ts` để server cũng dùng được
  - `shell.door.offset` nằm trong [0, độ dài cạnh − 1]
  - Thêm hàm `minFloorSize(layout) → { width, depth, blockers: string[] }`, trong đó `minWidth = max(6, ceil0.5(max(pos.x + footprint.w) + 0,5))`, tương tự cho depth
- [X] T010 Cập nhật `src/server/services/default-layout.ts` để sinh layout v2 tương đương bố cục mặc định hiện tại: 16 × 12 m, 12 bàn và ghế, shell có kính cạnh bắc và cửa cạnh nam ở offset 7, cùng sofa, máy nước, màn hình, cây
- [X] T011 Cập nhật `src/server/services/layout-store.ts`:
  - Khi đọc, nếu file là v1 thì sao lưu nguyên văn thành `layout.v1.bak.json` (chỉ khi file backup chưa tồn tại), chạy `migrateV1toV2`, ghi lại v2 (FR-014)
  - Lỗi chuyển đổi được log mà không kèm nội dung file, và trả về bố cục mặc định thay vì crash
- [X] T012 Cập nhật các nơi còn dùng `cell`/`widthCells` sang v2:
  - `src/server/services/employees.ts`, `src/web/scene/grid/grid.ts` (thay bằng nav-grid hoặc adapter)
  - `src/web/scene/Office.tsx`: vẽ sàn theo `floor.width/depth`, vẽ tường bao, mặt kính và cửa từ `shell`
  - `src/web/scene/furniture/Furniture.tsx`: `itemTransform` dùng `pos` theo mét
  - `src/web/scene/OfficeScene.tsx`, `src/web/bench/bench-layout.ts`, `src/web/scene/employee-behaviors.ts` (dùng `seatPoint`)
- [X] T013 [P] Unit test `tests/unit/layout-migrate.test.ts`: bố cục mặc định v1 (dựng lại như `default-layout.ts` cũ) chuyển sang v2 thì giữ đủ 12 bàn, 12 ghế và mọi đồ vật khác; tường chu vi chuyển vào shell; cửa ở (14,23) thành `door {side:'south', offset:7}`; chuyển đổi idempotent khi chạy trên dữ liệu đã chuyển qua schema
- [X] T014 [P] Unit test `tests/unit/layout-v2.test.ts` (thay `tests/unit/layout-validation.test.ts` và `tests/unit/grid.test.ts`): phát hiện chồng chữ nhật, ra ngoài sàn, `pos` không phải bội 0,05, `floor` ngoài [6,40] hoặc không bội 0,5, bàn bị chắn lối, `minFloorSize` trả đúng blockers
- [X] T015 Chạy `npm run typecheck && npm test && npm run test:e2e`; sửa `tests/e2e/build.spec.ts` và `tests/unit/fp-motion.test.ts` cho v2 cho tới khi xanh

**Checkpoint**: Bố cục v2 chạy được, văn phòng hiển thị như trước, file v1 cũ mở được

---

## Phase 3: User Story 1 - Model được nhớ theo từng conversation (Priority: P1) 🎯 MVP

**Goal**: Model chọn cho một conversation được giữ qua đóng/mở chat, tải lại trang và khởi động lại (FR-001–005)

**Independent Test**: quickstart.md §US1. Chọn "3.8 Flash" cho A, đóng rồi mở lại, tải lại trang, vẫn là "3.8 Flash"; B không bị ảnh hưởng.

> Không phụ thuộc Phase 2, làm song song được.

### Tests for User Story 1

- [X] T016 [P] [US1] Contract test `tests/contract/adapter-current-model.test.ts` theo contracts/app-adapter.md A2-1: (1) fixture `GetCascadeTrajectorySteps.json` cho `currentModel === 'MODEL_PLACEHOLDER_M318'` (model của lượt cuối); (2) conversation không có step chứa model cho `null`; (3) trường model sai kiểu cho `null` và không ném lỗi
- [X] T017 [P] [US1] Unit test `tests/unit/model-resolve.test.ts` cho hàm `resolveModel({preferredModel, currentModel, defaultModel, models})`: thứ tự ưu tiên `preferredModel?.modelId ?? currentModel ?? defaultModel ?? models[0]`; cờ `unavailable` khi model không có trong `models` hoặc `remainingPercent === 0`
- [X] T018 [P] [US1] E2E `tests/e2e/model-memory.spec.ts` (App giả lập): chọn model khác mặc định cho A, đóng rồi mở chat thì giữ; tải lại trang thì giữ; B hiển thị model của B; bỏ model khỏi danh sách giả lập thì thấy `model-unavailable` và nút gửi bị khoá; chọn model mà không gửi tin rồi mở lại thì vẫn giữ (Acceptance 1.1–1.5)

### Implementation for User Story 1

- [X] T019 [US1] Trong `src/server/app-adapter/mappers/step.ts`, đọc model của mỗi step (ưu tiên model người dùng yêu cầu ở lượt nhập, ví dụ `requestedModel`, nếu không có thì `generatorModel`); sai kiểu thì trả `null`
- [X] T020 [US1] Trong `src/server/app-adapter/mappers/conversation.ts`, điền `currentModel` từ step mới nhất có model, thay cho `currentModel: null` ở dòng 38. Chỉ đọc (Constitution II).
- [X] T021 [US1] Thêm `preferredModel: { modelId: string; chosenAt: string } | null` vào `EmployeeProfile` trong `src/shared/domain.ts` và `src/shared/schemas.ts`; profile patch nhận `preferredModel: string | null` có độ dài 1..128 và regex `^[A-Za-z0-9_.:-]+$` (contracts/local-api.md L2-3)
- [X] T022 [US1] Trong `src/server/services/employee-profiles.ts`, `update()` ghi `{ modelId, chosenAt: now }` hoặc xoá khi `null`; xác nhận hồ sơ (gồm `preferredModel`) được dọn khi conversation biến mất (FR-005), viết thêm nếu cơ chế dọn hiện có chưa xoá — *Ghi chú: hồ sơ (kèm `preferredModel`) bị xoá theo cơ chế dọn 30 ngày hiện có khi conversation không còn trong App; không xoá ngay để tránh mất lựa chọn khi App tạm thời trả danh sách rỗng.*
- [X] T023 [US1] Trong `src/server/http/routes/layout.ts`, `PUT /api/employees/:conversationId/profile` nhận `preferredModel`; trả 404 nếu conversation không tồn tại. Trong `src/server/services/employees.ts`, đưa `preferredModel` (dạng `string|null`) và `currentModel` vào `Employee` gửi qua REST và WebSocket (L2-4)
- [X] T024 [US1] Tạo `src/web/ui/chat/resolve-model.ts` chứa `resolveModel` (dùng ở T017)
- [X] T025 [US1] Sửa `src/web/ui/chat/ChatPanel.tsx`: bỏ `const lastModel = null` (dòng 55); tính model bằng `resolveModel` từ employee trong store và settings; truyền `value` và `unavailable` xuống `Composer`
- [X] T026 [US1] Sửa `src/web/ui/chat/Composer.tsx` thành controlled theo model từ ChatPanel (không giữ `useState` riêng). Khi đổi model, gọi `PUT /api/employees/:id/profile { preferredModel }` ngay, hiện "Đã lưu cho cuộc trò chuyện này" trong 1,5 giây (U-5). Nếu lưu lỗi thì hiện thông báo lỗi, không nuốt.
- [X] T027 [US1] Sửa `src/web/ui/chat/ModelPicker.tsx`: bỏ việc tự gọi `onChange(list[0])` ở dòng 25 khi đã có giá trị; khi `unavailable` thì hiển thị viền cảnh báo và chữ "<tên> không còn khả dụng — chọn model khác" (`data-testid="model-unavailable"`); khoá nút gửi trong Composer
- [X] T028 [US1] Chạy T016–T018 cho tới khi xanh, chạy `npm run test:leaks` (không có modelId hay nội dung nào lạ trong log)

**Checkpoint**: US1 dùng được độc lập (đợt A1)

---

## Phase 4: User Story 2 - Chọn và kéo thả đồ vật, nhân viên (Priority: P1)

**Goal**: Trong chế độ sắp xếp: bấm để chọn đồ vật, kéo tới vị trí bất kỳ (0,05 m), kéo nhân viên vào bàn; ngoài chế độ sắp xếp không kéo được (FR-006–015)

**Independent Test**: quickstart.md §US2

### Tests for User Story 2 (viết trước, phải ĐỎ trên code hiện tại)

- [X] T029 [US2] E2E `tests/e2e/build-drag.spec.ts`:
  - Bật sắp xếp, kéo nhân viên vào bàn trống → nhân viên ngồi bàn đó; đặt bàn mới chưa lưu rồi kéo nhân viên vào → được (tái hiện R2-02 #1–#3)
  - Kéo bàn sang vị trí lệch 0,25 m so với lưới cũ → sai lệch ≤ 5 cm
  - Kéo chồng lên sofa → về chỗ cũ
  - Thả nhân viên lên bàn có người → đổi chỗ; thả ra sàn → về bàn cũ
  - Ở màn hình chính, kéo nhân viên → không di chuyển; bấm → mở chat
  - Esc khi đang kéo → huỷ
  - Lưu rồi tải lại → giữ nguyên

  Commit test này trước, ghi kết quả đỏ vào mô tả commit.
- [X] T030 [P] [US2] Unit test `tests/unit/drag-controller.test.ts` cho logic thuần của DragController: ngưỡng 4 px, làm tròn 0,05 m, Shift bám 0,5 m, huỷ khi `pointercancel`/blur, đúng một bước undo cho mỗi lần thả thành công

### Implementation for User Story 2

- [X] T031 [US2] Tạo `src/web/scene/interaction/DragController.ts` (thuần, không React), theo R2-02 và U-2:
  - `begin(target, pointerId, screenPt)`, `move(screenPt, ray)`, `end()`, `cancel()`
  - Giao tia với `THREE.Plane(y=0)`; ngưỡng 4 px; làm tròn 0,05 m, giữ Shift thì 0,5 m
  - Callback `onPreview` / `onCommit` / `onCancel`
- [X] T032 [US2] Tạo `src/web/scene/interaction/useDrag.ts`: hook R3F gắn DragController vào đối tượng; gọi `setPointerCapture` trên `pointerdown`; tắt `CameraControls` (lấy từ `useThree().controls`) trong lúc kéo và bật lại khi kết thúc; nghe `keydown Escape` và `window blur` để huỷ; chỉ hoạt động khi `useBuild().active` (FR-010)
- [X] T033 [US2] Mở rộng `src/web/state/build.ts` theo data-model §4:
  - Thêm `seating: Record<string, string|null>`, `drag`, `resizeBlockers`
  - Đổi `move(id, pos)` sang mét; `assignSeat(conversationId, deskId)` với luật đổi chỗ khi bàn có người
  - Undo/redo bao cả `draft` lẫn `seating`
  - `place` cho bàn mới tự thêm ghế tại `seatPoint`
  - Khi dời bàn, dời ghế thuộc bàn cùng `delta` (FR-015)
- [X] T034 [US2] Viết lại `src/web/scene/BuildGizmo.tsx` dùng `useDrag`:
  - Bấm đồ vật → `select` (viền và thanh công cụ Xoay/Xoá/Bỏ chọn)
  - Bóng xanh/đỏ dùng `validateLayout` v2
  - Bấm chỗ trống → bỏ chọn; phím `R`, `Delete`/`Backspace`, mũi tên ±0,05 m (Shift ±0,5 m) theo U-3
  - Bỏ mặt phẳng `onPointerUp` cũ
- [X] T035 [US2] Thêm kéo nhân viên trong `src/web/scene/Employee.tsx` bằng `useDrag` (chỉ khi `build.active`):
  - Hình nhân viên mờ đi theo con trỏ; bàn dưới con trỏ sáng xanh nếu trống, vàng nếu có người (U-2)
  - Thả → `assignSeat`; ngoài chế độ sắp xếp thì `onClick` mở chat như cũ
  - Trong chế độ sắp xếp, bấm không mở chat. Xoá `src/web/scene/EmployeeDrag.tsx`.
- [X] T036 [US2] Hiển thị chỗ ngồi theo bản nháp: khi `build.active`, `src/web/scene/OfficeScene.tsx` truyền `seating` của bản nháp (ghi đè `employee.deskId`) cho `Employee`, để nhân viên đi tới bàn mới ngay trước khi lưu
- [X] T037 [US2] Server, trong `src/server/http/routes/layout.ts`, `PUT /api/layout` nhận `{ layout, seating }` theo L2-2:
  - Body v1 thì chuyển đổi trước; kiểm tra bằng `validateLayout` v2
  - Seating: deskId phải là `desk` trong `layout` gửi kèm, không trùng, nếu sai thì `422 INVALID_SEATING`
  - Lưu layout trước rồi cập nhật `deskId` trong `employee-profiles.ts` (luật đổi chỗ có sẵn); trả `{ layout, seating }`
- [X] T038 [US2] Trong `src/web/ui/build/BuildMode.tsx`, nút Lưu gửi `{ layout: draft, seating }`; hiện lỗi 422 rõ ràng (đồ vật lỗi được tô đỏ); không còn `.catch(() => undefined)`. Gắn `data-testid` `build-toggle`, `item-<id>`, `employee-<id>`, `desk-drop-<deskId>`.
- [X] T039 [US2] Chạy T029 và T030 cho tới khi xanh; thử tay quickstart §US2 bước 8 với file v1 thật (khôi phục `layout.before.json`)

**Checkpoint**: US2 dùng được (đợt A2). Đo SC-002/003/004 bằng tay: mỗi thao tác ≤ 5 giây, 10/10 lần.

---

## Phase 5: User Story 3 - Nhân viên không chồng lấn, va chạm thực tế (Priority: P2)

**Goal**: FR-016–021. Không chồng lấn, có nhường đường, phản ứng va chạm, đồ nhẹ rung không đổi vị trí lưu.

**Independent Test**: quickstart.md §US3. Mô phỏng 10 phút với 20 agent: không chồng lấn, mọi lần chạm có `bump`.

### Tests for User Story 3

- [X] T040 [P] [US3] Unit test `tests/unit/crowd.test.ts`. Mô phỏng 10 phút (dt = 1/60, rng cố định) với 20 agent trong bố cục chật 8 × 6 m, đi liên tục giữa bàn, máy nước và sofa. Kiểm tra:
  - (a) bất biến `|pᵢ − pⱼ| ≥ rᵢ + rⱼ − 0,01` ở mọi bước
  - (b) không agent nào nằm trong ô bị chặn của nav-grid
  - (c) mọi lần chạm với `|Δv| > 0,3` sinh `bump`
  - (d) agent `seated` không bao giờ đổi vị trí
  - (e) agent bị chặn > 5 s thì tìm đường lại hoặc về bàn
  - (f) agent tiếp tục đi trong vòng 2 giây sau bump khi đường thông (SC-006)

### Implementation for User Story 3

- [X] T041 [US3] Tạo `src/web/scene/crowd/crowd.ts` (thuần) theo R2-04 và data-model §5:
  - Agent có `pos`, `vel`, `radius = 0,28`, `state`, `priority`, `path`, `blockedFor`, `reaction`
  - Mỗi bước: đi theo path → lực tách → luật nhường (đi về bàn ưu tiên hơn đi rảnh; hoà thì so hash id; bên thấp hơn dừng hoặc bước sang bên) → giải ràng buộc chồng lấn 4 lần → kẹp vào ô đi được
  - Phát sự kiện `bump_person` / `bump_object`; agent `seated` có khối lượng vô hạn
- [X] T042 [US3] Tạo hàng chờ điểm đến chung (máy nước, sofa) trong `src/web/scene/crowd/destinations.ts`: các ô xếp hàng trước điểm, cấp lượt theo thứ tự tới
- [X] T043 [US3] Sửa `src/web/scene/employee-behaviors.ts`: `EmployeeBrain` chỉ chọn đích và trạng thái; chuyển động do crowd thực hiện. Thêm mode `reacting`: chơi phản ứng 0,6–1,0 giây rồi quay lại mode trước. Bị chặn > 5 s thì tìm đường lại, không được thì về bàn hoặc đứng chờ (FR-021). Cập nhật `tests/unit/employee-behaviors.test.ts`.
- [X] T044 [US3] Tạo `src/web/scene/crowd/CrowdProvider.tsx`: một instance crowd cho cả văn phòng, `useFrame` với độ ưu tiên chạy trước các Employee; dựng lại nav-grid khi layout hoặc kích thước đổi. Sửa `src/web/scene/Employee.tsx` để đọc pose từ crowd.
- [X] T045 [US3] Tạo `src/web/scene/crowd/reactions.ts` và sửa `src/web/scene/character.ts`: phản ứng bump là khựng, ngả thân về sau ~8°, quay đầu về phía va chạm, mặt "Surprised" (morph có sẵn), dùng clip `No` ngắn hoặc procedural. Không đổi badge hay trạng thái hiển thị (FR-020).
- [X] T046 [P] [US3] Tạo `src/web/scene/furniture/PropJiggle.ts` theo data-model §6: lò xo tắt dần ≈ 0,8 s cho `chair` và `plant` khi có `bump_object`; chỉ cộng offset vào transform hiển thị trong `Furniture.tsx`, không ghi vào layout (FR-019)
- [X] T047 [US3] Thêm kịch bản `crowd` vào `src/web/bench/Bench.tsx`: 20 nhân viên đi liên tục, đếm vi phạm chồng lấn và in ra; thêm chế độ `?debug=crowd` rút ngắn chu kỳ nghỉ (chỉ khi dev)
- [X] T048 [US3] Chạy T040 cho tới khi xanh; chạy `npm run bench:fps -- --scenario crowd` với kỳ vọng ≥ 60 FPS, crowd ≤ 0,2 ms mỗi khung hình

> **Ghi chú thực hiện US3 (2026-11-07)**:
> - Crowd giải từng người một (Gauss–Seidel): mỗi bước chỉ được chấp nhận khi vẫn cách mọi người khác ≥ r₁ + r₂, nên bất biến "không chồng lấn" đúng sau *mọi* bước. Bán kính: đi 0,28 m, ngồi 0,2 m.
> - Gỡ kẹt: chỉ nhường đường tối đa 1,5 s; kẹt quá 1 s được bước lùi hoặc chéo; bỏ qua một điểm giữa đường đang có người đứng (chỉ khi đã ở cách dưới 0,6 m); tìm đường lại sau 2 s (FR-021 cho phép tới 5 s), tránh cả người ngồi lẫn người đang đứng yên.
> - T042: thay module hàng đợi riêng bằng cách "tới gần là được". Đích dùng chung (máy nước) được coi là đã tới khi ở trong 1,4 m mà bị chặn quá 1,5 s.
> - Va chạm chỉ tính một lần khi hai người *bắt đầu* chạm nhau, nên không đứng khựng liên tục khi đứng sát nhau.
> - Kiểm chứng: `tests/unit/crowd.test.ts` mô phỏng 10 phút với 4 seed: 0 chồng lấn, không vào ô bị chặn, người ngồi không bị đẩy, có phản ứng va chạm, và cả 6 người về bàn khi có việc. Đo `npm run bench:fps -- --scenario crowd`: 153 FPS trung bình, 0 chồng lấn.

**Checkpoint**: US3 dùng được

---

## Phase 6: User Story 4 - Thay đổi kích thước văn phòng (Priority: P2)

**Goal**: FR-022–027. Chọn chiều dài và chiều rộng 6–40 m (bước 0,5) trong chế độ sắp xếp, neo góc tây bắc.

**Independent Test**: quickstart.md §US4

### Tests for User Story 4

- [X] T049 [P] [US4] Unit test `tests/unit/resize-limits.test.ts`: chấp nhận 6, 40, 23,5; từ chối 5,5, 40,5, 10,3; thu nhỏ dưới `minFloorSize` cho blockers đúng; đổi kích thước không đổi `pos` của item; `shell.door.offset` được kẹp khi cạnh nam ngắn lại
- [X] T050 [P] [US4] E2E `tests/e2e/office-resize.spec.ts`: nhập 24 × 18 rồi lưu, tải lại thì giữ; kéo `resize-handle-east` +3 m thì nhãn hiển thị 27; nhập 5 hoặc 41 thì báo lỗi và văn phòng không đổi; thu nhỏ khi có bàn ở sát cạnh đông thì bị chặn và hiển thị số blockers (Acceptance 4.1–4.5)

### Implementation for User Story 4

- [X] T051 [US4] Thêm `resizeFloor(width, depth)` vào `src/web/state/build.ts`: kiểm tra [6,40] và bội 0,5; nếu nhỏ hơn `minFloorSize` thì không đổi và gán `resizeBlockers`; kẹp `shell.door.offset`; một bước undo
- [X] T052 [US4] Trong `src/web/ui/build/BuildMode.tsx`, thêm ô "Chiều dài (m)" (`floor-width-input`) và "Chiều rộng (m)" (`floor-depth-input`) với min 6, max 40, step 0,5. Giá trị sai thì viền đỏ và hiện "Từ 6 đến 40 m, bước 0,5 m". Bị chặn thì hiện thông báo kèm số đồ vật; bấm vào thông báo để chọn lần lượt từng blocker (U-4).
- [X] T053 [US4] Trong `src/web/scene/BuildGizmo.tsx`, thêm tay kéo `resize-handle-east` và `resize-handle-south` dùng `useDrag`, làm tròn 0,5 m, hiện nhãn kích thước khi kéo; blockers nhấp nháy đỏ
- [X] T054 [US4] Server, trong `src/server/http/routes/layout.ts`: nếu item nằm ngoài sàn mới thì trả `422 { error: 'FLOOR_TOO_SMALL', blockers, min: {width, depth} }` (L2-2)
- [X] T055 [US4] Cho cảnh tự co giãn (FR-025, FR-026):
  - `src/web/scene/Office.tsx` sinh tường, kính và cửa từ `shell` và `floor`
  - Tạo `src/web/scene/park/park-layout.ts` (thuần) theo R2-05: từ kích thước văn phòng tính lối đi vòng (elip qua góc văn phòng: `rx = w/2·1,414 + 4,5`, `rz = d/2·1,414 + 4,5`), vị trí ghế, bồn hoa, ki-ốt, hồ, nhóm tập thể dục ngoài lối đi; cây lấy từ một tập cố định theo seed và chỉ ẩn những cây nằm trong dải cỏ trống (mép văn phòng + 8 m), trên lối đi, hồ, ki-ốt hoặc chắn tầm nhìn camera
  - Đổi `PARK_RADIUS` 38 → 54 và `ROAD_RADIUS` 44 → 60 trong `src/web/scene/park/detail.ts` để văn phòng 40 × 40 m vẫn có công viên ≥ 15 m tới đường (FR-036); dời skyline theo
  - `src/web/scene/park/Park.tsx` và `src/web/scene/park/Ambient.tsx` dùng `park-layout.ts`; tham chiếu dựng hình: `buildParkLife` trong `concepts/index.html`
  - Unit test `tests/unit/park-layout.test.ts`: ở các kích thước 6×6, 16×12, 28×20, 40×40 không vật nào của công viên chồng lên văn phòng; khoảng cách mép văn phòng tới lối đi ≥ 5 m, tới cây ≥ 8 m; tập cây hiện là tập con của tập cố định
  - `src/web/scene/cameras/Overview.tsx` và `src/web/scene/cameras/FirstPerson.tsx` nhận kích thước mới (FP đi được hết văn phòng)
- [X] T056 [US4] Thêm kịch bản `--floor 40x40` vào bench (`src/web/bench/bench-layout.ts` sinh bố cục 40 × 40 có 20 bàn); chạy T049, T050 và bench với kỳ vọng ≥ 60 FPS (SC-008)

**Checkpoint**: Đợt A xong (US1–US4), dùng hằng ngày được với giao diện hiện tại. Đối chiếu Constitution IV.

---

## Phase 7: User Story 5 - Chọn concept từ 5 mẫu (Priority: P2) — CỔNG

**Goal**: FR-028–030. Năm concept A–E (R2-06) khác nhau rõ rệt, người dùng chọn một.

**Independent Test**: Người dùng xem đủ 5 mẫu và `concept-decision.md` có `status: chosen`

> Không phụ thuộc Phase 2–6, có thể làm ngay sau Phase 1.

- [x] T057 [US5] Tạo `concepts/` với `concepts/index.html`, `concepts/main.ts`, `concepts/vite.config.ts` (root riêng, alias `@shared`, không nằm trong build của app). Cảnh mẫu chuẩn gồm:
  - Văn phòng 6 × 5 m có 4 bàn và 4 nhân viên ở 4 trạng thái (đang làm, chờ sếp, lỗi, rảnh)
  - Nền thành phố gồm 3 toà nhà, 1 quán cà phê, 1 quán ăn
  - Dựng bằng hình học thủ tục có tham số theo concept
- [x] T058 [US5] Tạo `concepts/presets.ts` với 5 preset A Nordic Daylight, B Urban Loft, C Glass HQ, D Saigon Co-working, E Soft Studio, đúng bảng R2-06:
  - Bảng màu sáng và tối, vật liệu PBR (màu, roughness, metalness), ánh sáng (màu và cường độ mặt trời, môi trường), tone mapping
  - Font tiêu đề và nội dung, kiểu nhân vật (tỉ lệ thân, đầu, màu trang phục bằng hình học đại diện), kiểu toà nhà và quán
- [x] T059 [P] [US5] Tạo `concepts/ui-mock.ts` và `concepts/ui-mock.css`: khung chat (2 tin nhắn, ô nhập, model picker), bảng quota, thẻ tên nhân viên dựng bằng HTML/CSS thật theo token của từng preset; font nạp từ Fontsource cài làm devDependency (`@fontsource-variable/be-vietnam-pro`, `inter`, `space-grotesk`, `manrope`, `lexend`, `nunito`, `@fontsource/baloo-2`)
- [x] T060 [US5] Trang `concepts/index.html` gồm 5 thẻ cạnh nhau (xếp dọc khi màn hẹp). Mỗi thẻ có canvas 3D (chỉ thẻ đang hiện trên màn hình mới render, dùng IntersectionObserver), UI mock và bảng mô tả (vật liệu, ánh sáng, màu, font, nhân vật, thành phố). Thêm nút chuyển ngày/đêm.
- [~] T061 [US5] Build tĩnh `concepts/` (`npx vite build concepts`); chụp ảnh 5 thẻ (ngày và đêm) vào `specs/002-realistic-ui-refresh/concepts/A..E-{day,night}.png` bằng Playwright; công bố trang dưới dạng artifact riêng tư và gửi link cho người dùng
- [x] T062 [US5] **CỔNG**: chờ người dùng chọn. Ghi `specs/002-realistic-ui-refresh/concept-decision.md`: `status: chosen`, `chosen`, `feedback`, `tokens` (bảng màu sáng/tối, font, bo góc, vật liệu chủ đạo, HDRI, bộ nhân vật). Có góp ý thì làm một vòng chỉnh (lặp T058–T061) trước khi chốt (Acceptance 5.4).

> **Ghi chú thực hiện Phase 7 (2026-11-07)**: trang concept làm thành một file HTML tự chứa
> `concepts/index.html` (three.js 0.170 qua importmap từ jsDelivr, font qua Google Fonts) thay vì dự án
> Vite + Fontsource, để công bố được thành artifact riêng tư. Trang này nằm ngoài sản phẩm nên không
> vi phạm Constitution III; sản phẩm vẫn đóng gói font qua Fontsource (T065). Font của concept đã đổi
> (xem research.md R2-06): A Fraunces/Manrope, B Big Shoulders Display/Archivo, C Plus Jakarta
> Sans/Be Vietnam Pro, D Bricolage Grotesque/Lexend, E Baloo 2/Nunito. T061: đã công bố
> https://claude.ai/artifact/P3UD3QsTaxNMyJKiXENQiW; **chưa chụp ảnh** vào `concepts/` vì máy hiện không
> có Node/Playwright trong PATH.

**Checkpoint**: Concept đã chốt. Phase 8–9 chỉ bắt đầu khi T062 xong.

---

## Phase 8: User Story 6 - Toàn hệ thống theo concept mới và font mới (Priority: P2)

**Goal**: FR-030–035. Mọi màn hình, chế độ sáng và tối, 3D và UI đều theo concept; font mới offline, đúng tiếng Việt.

**Independent Test**: quickstart.md §US6, checklist màn hình đầy đủ

**Phụ thuộc**: T062 (concept chosen)

### Tests for User Story 6

- [ ] T063 [P] [US6] E2E `tests/e2e/fonts.spec.ts`: chặn mọi request không phải `127.0.0.1`; `document.fonts.check('16px "<font tiêu đề>"', 'Đặng Thị Hương — Ưng ỡ ữ ỵ')` và tương tự cho font nội dung trả về true; computed `font-family` của `.tag-name`, tiêu đề panel và nội dung chat là font mới (SC-011)
- [ ] T064 [P] [US6] E2E thêm vào `tests/e2e/settings.spec.ts`: chụp ảnh các màn hình (toàn cảnh, góc nhìn thứ nhất, chat, tuyển nhân viên, quota, cài đặt, sắp xếp, project) ở chế độ sáng và tối vào `test-results/` để đối chiếu với mẫu; kiểm tra tương phản chữ/nền ≥ 4,5:1 cho các token chữ chính

### Implementation for User Story 6

- [ ] T065 [US6] Cài 2 gói `@fontsource-variable/<font>` của concept đã chọn làm dependency; chỉ import subset `latin` và `vietnamese` trong `src/web/main.tsx`; preload font nội dung trong `src/web/index.html`; ghi giấy phép OFL vào `assets/LICENSES.md` (FR-033–035)
- [ ] T066 [US6] Viết lại token trong `src/web/styles.css` theo `concept-decision.md` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--warn`, `--error`, `--radius`, font tiêu đề và nội dung) cho `:root` và `.theme-dark`; rà mọi màu hard-code trong `src/web/ui/**`
- [ ] T067 [US6] Tạo `src/web/theme/concept.ts`: token 3D (màu và vật liệu sàn, tường, gỗ, kim loại, kính; cường độ ánh sáng ngày và đêm; tone mapping; tên file HDRI); thay `src/shared/colors.ts` và palette trong `src/web/scene/Office.tsx`
- [ ] T068 [US6] Tải HDRI CC0 1k (Poly Haven) cho ngày và đêm theo concept vào `assets/hdri/`. Trong `src/web/scene/OfficeScene.tsx`: đặt `Environment` của drei với `files` cục bộ (không `preset`, vì preset tải từ CDN), bật tone mapping, bóng PCF mềm ở mức Trung bình và Cao (R2-07). Ghi giấy phép.
- [ ] T069 [US6] Tìm và chọn bộ nhân vật CC0 theo concept (mặc định Quaternius "Ultimate Animated Characters"; concept E dùng bộ hoạt hình CC0 tương ứng) có Idle, Walk, Sit, Typing, Wave; mỗi glb ≤ 3 MB, không Draco; đặt vào `assets/models/characters/`; ghi `assets/LICENSES.md`
- [ ] T070 [US6] Sửa `src/web/scene/character.ts` và `src/web/scene/Employee.tsx` cho bộ nhân vật mới:
  - Ánh xạ clip theo trạng thái; clip thiếu thì dựng thủ tục
  - Hiển thị trạng thái (đang làm, chờ sếp, lỗi, rảnh, không rõ) phân biệt rõ bằng tư thế, badge và màu (FR-031)
  - `appearance` cũ ánh xạ sang biến thể mới
  - Phản ứng va chạm của US3 vẫn chạy
- [ ] T071 [US6] Nâng `src/web/scene/furniture/Furniture.tsx` lên PBR theo concept: thay khối hình học bằng mô hình CC0 (Poly Haven, Kenney, Quaternius) hoặc hình học thủ tục chi tiết hơn (cạnh vát, chân bàn, ngăn kéo); AO nướng vào vertex color; texture ≤ 1024 px; ghi `assets/LICENSES.md`. Đảm bảo footprint vẫn khớp `catalog.ts`.
- [ ] T072 [US6] Áp concept cho các bảng UI: `src/web/ui/chat/*`, `src/web/ui/quota/*`, `src/web/ui/settings/SettingsPanel.tsx`, `src/web/ui/build/*`, `src/web/ui/projects/*`, `src/web/ui/CameraToggle.tsx`, `src/web/ui/ProjectLegend.tsx`, `src/web/ui/OverflowList.tsx`, thẻ tên trong `styles.css` (`.tag*`), gồm bo góc, đổ bóng, khoảng cách, icon
- [ ] T073 [US6] Cập nhật `src/web/scene/perf/PerfManager.tsx` cho 3 mức (R2-07): Thấp tắt bóng mềm và AO, ánh sáng đêm bằng emissive; Trung bình bật bóng PCF văn phòng và AO nướng; Cao bật thêm SSAO (`n8ao`, cài dependency) và bóng thành phố gần
- [ ] T074 [US6] Chạy T063, T064, `npm run bench:fps` (≥ 60 FPS với 20 nhân viên, tải lần đầu ≤ 25 MB, ≤ 300 draw call ở mức Trung bình); rà checklist màn hình ở quickstart §US6 (SC-010)

**Checkpoint**: US6 xong (đợt B1)

---

## Phase 9: User Story 7 - Thành phố và công viên thực tế hơn, có quán, xe cộ và người (Priority: P3)

**Goal**: FR-036–044. Cảnh bên ngoài theo vòng 2 của `concept-decision.md`: cây thật, phố thật, xe cộ, người trong công viên. Tham chiếu dựng hình: preset `id: 'f'` trong `concepts/index.html` (`buildTreeReal`, `buildParkLife`, `buildCar`, `buildMoto`, `buildBus`, `buildBench`).

**Independent Test**: quickstart.md §US7

**Phụ thuộc**: T062; nên làm sau Phase 8 để dùng chung vật liệu và font

### Tests for User Story 7

- [ ] T075 [P] [US7] Unit test `tests/unit/city-layout.test.ts`: với mỗi thành phố trong 5 thành phố, không có đường hay toà nhà trong bán kính 30 m quanh văn phòng; ki-ốt cà phê nằm trong cung nhìn của camera mặc định; bộ sinh bố cục đặt ≥ 2 quán cà phê và ≥ 2 quán ăn ở dãy phố xa, không chồng lên đường hay công trình biểu tượng; seed cố định cho kết quả ổn định

### Implementation for User Story 7

- [ ] T076 [US7] Tạo `src/web/scene/city/BuildingKit.tsx`: 6–8 mẫu toà nhà mô-đun (đế, thân lặp tầng, mái) theo concept; atlas texture cửa sổ (≤ 1024 px) với bản đồ emissive cho ban đêm; vẽ bằng `InstancedMesh` theo mẫu
- [ ] T077 [US7] Tạo `src/web/scene/city/Shops.tsx`: 2 mẫu quán cà phê và 2 mẫu quán ăn đặt ở dãy phố xa, cộng 1 mẫu ki-ốt cà phê đặt trong công viên. Mỗi mẫu có mái hiên, bàn ghế ngoài trời, biển hiệu dùng `CanvasTexture` vẽ bằng font của concept, tên hư cấu theo thành phố (ví dụ Hà Nội "Cà Phê Gió", "Quán Phở Sớm"; Tokyo "Kissa Hoshi"…, không dùng thương hiệu thật), và đèn emissive khi `isDay === false`
- [ ] T078 [US7] Tạo `src/web/scene/city/city-layout.ts` (thuần, dùng trong T075): vòng gần ≤ 25 m quanh đường có mặt tiền chi tiết và quán; vòng giữa dùng toà nhà mô-đun đơn giản; vòng xa dùng khối có texture cửa sổ; theo seed của từng thành phố
- [ ] T079 [US7] Viết lại `src/web/scene/city/CitySkyline.tsx` dùng BuildingKit, Shops và city-layout; giữ 5 công trình biểu tượng, nâng vật liệu lên PBR; cửa sổ sáng về đêm (FR-038)
- [ ] T080 [US7] Cập nhật `src/web/scene/perf/PerfManager.tsx` và `src/web/scene/park/detail.ts`: khi FPS tụt thì giảm theo thứ tự tắt chi tiết vòng gần → bớt toà nhà xa → mới đến văn phòng (FR-044); thêm `?throttle=1` (chỉ khi dev) để ép thử
- [ ] T081 [P] [US7] Unit test `tests/unit/traffic.test.ts`: mô phỏng 5 phút giao thông (dt = 1/60); trong mỗi làn không có hai xe chồng nhau (khoảng cách tâm ≥ nửa chiều dài xe trước + nửa xe sau); xe ra khỏi đầu đường thì quay lại đầu kia; số xe mỗi loại ≥ 1 (FR-043)
- [ ] T082 [US7] Tạo `src/web/scene/park/Trees.tsx`: 3 loại cây theo `concept-decision.md` vòng 2 (tán rộng nhiều cụm lá 4 sắc xanh và có cành; cây ra hoa; cây hàng theo thành phố, ví dụ dừa ở Sài Gòn, anh đào ở Tokyo). Vẽ bằng `InstancedMesh` theo loại cụm lá; dùng LOD ở xa (một khối tán). Thay cây low-poly hiện có trong `src/web/scene/park/Park.tsx` (FR-040)
- [ ] T083 [US7] Cập nhật `src/web/scene/park/Park.tsx` theo bố cục vòng 3 của `concept-decision.md`: văn phòng ở giữa công viên, trong bán kính ≥ 30 m không có đường hay toà nhà (FR-036); cỏ texture nhiều sắc xanh, lối đi bộ vòng quanh văn phòng (theo vùng cấm R2-05 khi đổi kích thước) và lối đi ra phố, hồ nước, ghế đá, đèn công viên sáng về đêm, bồn hoa, bụi cây ven lối đi, cây rải khắp công viên tránh tầm nhìn camera (FR-041); ki-ốt cà phê nhìn thấy từ góc camera mặc định (FR-037)
- [ ] T084 [US7] Viết lại `src/web/scene/park/Ambient.tsx` dùng nhân vật của concept (T069/T070, không thẻ tên, không bấm được): người đi bộ và chạy bộ hai chiều trên lối đi, nhóm 3 người tập thể dục trên bãi cỏ, 1 người ngồi đọc sách ở ghế đá; mưa thì giảm số người như hiện tại; dùng `crowd.ts` của US3 để người đi bộ không đi xuyên nhau (FR-042)
- [ ] T085 [US7] Tạo `src/web/scene/city/Traffic.ts` (thuần, dùng trong T081) và `src/web/scene/city/Traffic.tsx`: xe hơi, xe máy có người lái đội mũ, xe buýt; 4 làn (2 làn ô tô, 2 làn xe máy) chạy hai chiều, mỗi làn một vận tốc; đèn pha và đèn hậu emissive về đêm; số xe theo mức chi tiết (FR-043). Thay xe hiện có trong `Ambient.tsx`
- [ ] T086 [P] [US7] Chi tiết phố theo thành phố trong `src/web/scene/city/BuildingKit.tsx`: Sài Gòn và Hà Nội dùng nhà ống có ban công, cửa chớp, cây ban công, cột điện và dây điện võng; Singapore, Tokyo, New York dùng kiểu nhà đặc trưng tương ứng, cùng mức độ thực tế
- [ ] T087 [US7] Ghi mọi tài nguyên mới vào `assets/LICENSES.md`; chạy T075, `npm run bench:fps` cho từng thành phố ngày và đêm (≥ 60 FPS, SC-014); kiểm tra tay SC-012 (chỉ ra được 2 quán cà phê và 2 quán ăn trong 10 giây) và SC-013 (trong 30 giây thấy người đi bộ, chạy bộ, tập thể dục, xe hơi, xe máy, xe buýt); chạy T081

**Checkpoint**: Mọi user story xong

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T088 [P] Cập nhật `README.md` và hướng dẫn cài đặt (INSTALL): chế độ sắp xếp mới (kéo thả, phím tắt, đổi kích thước), model theo conversation, concept mới, `layout.v1.bak.json`
- [ ] T089 [P] Đề xuất sửa PATCH Constitution Nguyên tắc V qua `/speckit-constitution` (R2-10). Chỉ đề xuất, chờ chủ dự án duyệt.
- [ ] T090 Chạy toàn bộ cổng chất lượng: `npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run test:leaks && npm run bench:fps`; kiểm tra Network không có request ra ngoài trừ Open-Meteo; chạy lại hướng dẫn cài đặt trên macOS ≤ 15 phút
- [ ] T091 Chạy quickstart.md từ đầu đến cuối với App thật bằng conversation `[test-002] ...` và dọn sau khi thử; người dùng tự chấm SC-009 và SC-015

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: không phụ thuộc
- **Phase 2 (Foundational, layout v2)**: sau Phase 1; chặn US2, US3, US4
- **US1 (Phase 3)**: chỉ cần Phase 1, song song được với Phase 2
- **US2 (Phase 4)**: sau Phase 2
- **US3 (Phase 5)**: sau Phase 2 (nav-grid); nên sau US2 vì cùng sửa `Employee.tsx` và `OfficeScene.tsx`
- **US4 (Phase 6)**: sau Phase 2 và US2 (dùng `useDrag`, `build.ts`)
- **US5 (Phase 7)**: chỉ cần Phase 1; làm song song với Phase 2–6. **T062 là cổng.**
- **US6 (Phase 8)**: sau T062; nên sau US3 vì `character.ts` có phản ứng va chạm
- **US7 (Phase 9)**: sau T062; nên sau US6
- **Polish**: sau mọi story

### Story Dependency Graph

```text
Setup ─┬─▶ US1 ─────────────────────────────────────────────┐
       ├─▶ Foundational (v2) ─▶ US2 ─▶ US3 ─▶ US4 ──────────┤
       └─▶ US5 ─▶ [T062 CỔNG: người dùng chọn] ─▶ US6 ─▶ US7 ┴─▶ Polish
```

### Within Each User Story

- Test viết trước. US2 bắt buộc test đỏ trước khi sửa.
- Thứ tự: shared/domain → server → state → scene/UI → chạy test/bench

---

## Parallel Opportunities

- T002, T003 (Setup)
- T013, T014 (test Foundational) song song với nhau sau T009
- **US1 toàn bộ** song song với Phase 2; trong US1 thì T016, T017, T018 song song
- T030 song song với T029; T040, T046 [P] trong US3; T049, T050 trong US4
- **US5 (T057–T061)** song song với Phase 2–6 (thư mục `concepts/` tách biệt), T059 song song với T058
- T063, T064 song song; T075 song song với T076; T081 và T086 song song với T082–T084

### Parallel Example: khởi động

```text
Nhánh 1: T004 → T005 → T006 → T007 → T008 → T009 → … (Foundational)
Nhánh 2: T016 + T017 + T018 → T019 → … → T028 (US1)
Nhánh 3: T057 → T058 + T059 → T060 → T061 (US5, gửi link cho người dùng chọn sớm)
```

### Parallel Example: User Story 1

```text
T016 tests/contract/adapter-current-model.test.ts
T017 tests/unit/model-resolve.test.ts
T018 tests/e2e/model-memory.spec.ts
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 → Phase 3 (US1): sửa lỗi model, giá trị ngay, rủi ro thấp
2. **Dừng và kiểm tra** SC-001 → có thể merge riêng

### Incremental Delivery (theo đợt trong plan)

1. **A1**: US1 → merge
2. **A2**: Foundational + US2 → merge (bố cục v2 và chuyển đổi được kiểm chứng trên file thật)
3. **A3**: US3 + US4 → merge. Lúc này dùng hằng ngày được, đối chiếu Constitution IV.
4. **B0**: US5 chạy song song từ sớm, gửi link concept cho người dùng chọn
5. **B1**: US6 → merge
6. **B2**: US7 → merge, rồi Polish

### Lưu ý

- Mỗi task một commit (hoặc gộp nhóm nhỏ), message kết thúc bằng dòng attribution theo quy ước repo
- Mọi tài nguyên thêm vào phải có dòng trong `assets/LICENSES.md` trong cùng commit
- Không thêm request ra ngoài nào. Nếu buộc phải thêm thì dừng và hỏi (Constitution III)
