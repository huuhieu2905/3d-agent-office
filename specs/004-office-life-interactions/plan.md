# Implementation Plan: Đời sống văn phòng — tương tác đồ vật, đi ra công viên, xoá nhân viên

**Branch**: `004-office-life-interactions` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-office-life-interactions/spec.md`

## Summary

Bốn phần, giao theo thứ tự:

- **US1, panel chú giải**:
  - `ProjectLegend` có nút thu gọn/mở. Khi mở, chiều cao bị giới hạn theo vùng nhìn và cuộn bên
    trong.
  - Trạng thái được lưu ở `Settings.legendCollapsed`. Đây là trường optional, để không làm reset file
    cài đặt cũ (R4-01).
- **US2, xoá nhân viên**:
  - Adapter có thêm `deleteConversation`, gọi `DeleteCascadeTrajectory`. RPC này đã có trong
    `USED_RPCS` và đã chạy trên 2.29.0.
  - Route `DELETE /api/conversations/:id` đọc lại trạng thái từ App và trả `409` nếu agent đang bận.
  - Nút 🗑 và hộp xác nhận nằm trong khung chat.
  - Nhân viên rời văn phòng bằng luồng `leaving` sẵn có (R4-02).
- **US3, đời sống khi rảnh**:
  - `SiteGrid` mở rộng lưới điều hướng ra cả công viên, với cùng giao diện như `OfficeGrid`. Nhờ đó
    `Crowd`, A* và `fp-motion` dùng lại được (R4-03).
  - Thêm 4 quán quanh vòng đường dạo (R4-04).
  - `SpotBook` giữ chỗ ở sofa và quán, đồng thời giới hạn số người ra ngoài (R4-05).
  - Brain có thêm mode `outing` / `resting`, clip `Lying` / `Drinking`, và chạy về bàn khi có việc,
    trong ≤ 30 s (R4-06).
- **US4, góc nhìn thứ nhất**:
  - Camera dùng `SiteGrid`, nên đi được ra ngoài.
  - Cửa kính trượt tự mở.
  - Ngắm và nhấn E để dùng màn hình, sofa, bình nước, cây.
  - Trạng thái màn hình được lưu ở `Settings.screensOff` (R4-07, R4-08).

## Technical Context

**Language/Version**: TypeScript 6 trên Node.js ≥ 22 (server). React 19 + three.js 0.187 (web).
Không đổi.

**Primary Dependencies**: Không thêm thư viện. Dùng sẵn Fastify 5, zod 4, React Three Fiber 9 + drei
(`PointerLockControls`, `Html`), zustand 5, Vitest, Playwright.

**Storage**:
- `settings.json`: thêm 2 trường optional.
- `profiles`: xoá `deskId` khi xoá conversation.
- Không có file mới.

**Testing**:
- **Vitest**:
  - unit: `site-nav`, `park-shops`, `outdoor-route`, `break-spots`, `employee-behaviors`,
    `fp-motion`, `interactables`, `settings-compat`, `routes-delete` (contract);
  - contract: A4-1a…c;
  - leaks: log của L4-1.
- **Live**: `delete.live.test.ts` (A4-1d), chỉ dùng conversation `[agent-office-test]`.
- **Playwright** (mock App, GPU thật): `legend.spec.ts`, `delete-employee.spec.ts`,
  `office-life.spec.ts`, và mở rộng `first-person.spec.ts`.
- **Guard**: (c) thêm `deleteConversation`.

**Target Platform**: macOS 13+, Chrome hoặc Firefox có WebGL 2. Antigravity App theo danh sách đã
kiểm chứng (2.29.0, 2.24.0).

**Project Type**: Ứng dụng web local, một package, server cầu nối + client 3D (không đổi).

**Performance Goals**:
- ≥ 60 FPS với số nhân viên tối đa (`MAX_VISIBLE = 20`), kể cả khi số người ở ngoài đạt mức tối đa.
- Badge trạng thái ≤ 2 s.
- Về tới bàn ≤ 30 s.
- Truy vấn `SiteGrid` O(1) cộng với vài cây.

**Constraints**:
- Không có RPC mới, không có kết nối ra ngoài mới.
- Xoá conversation chỉ khi người dùng xác nhận và agent không bận.
- Không tự dừng agent.
- Mọi trường settings mới phải là optional.
- Quán chỉ là bối cảnh (FR-027).

**Scale/Scope**:
- 4 user story, khoảng 30 FR, 7 SC.
- Khoảng 20 file nguồn bị sửa.
- File mới: `site-nav.ts`, `break-spots.ts`, `interactables.ts`, `outdoor-route.ts`,
  `ConfirmDeleteDialog.tsx`, `ParkShops.tsx`, cùng các file test.

Không còn mục NEEDS CLARIFICATION. Người dùng đã xác nhận (2026-11-09): xoá conversation cha thì App
xoá luôn mọi subagent con. Vì vậy hộp xác nhận nêu số subagent sẽ bị xoá theo, và server coi cả cây là
"bận" nếu một con bất kỳ đang bận (R4-02).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Đối chiếu constitution
**v2.1.2**.

| Nguyên tắc | Kiểm tra | Trước Phase 0 | Sau Phase 1 |
|---|---|---|---|
| I. App là nguồn dữ liệu duy nhất | Nhân viên chỉ rời đi khi App xác nhận đã xoá và danh sách mới không còn conversation đó. Trạng thái "bận" được đọc lại từ App. Badge vẫn ≤ 2 s ở mọi vị trí. Dữ liệu lưu mới chỉ là dữ liệu giao diện (`legendCollapsed`, `screensOff`) | ✅ | ✅ data-model §1–3, L4-1 |
| II. Lớp kết nối cô lập | `DeleteCascadeTrajectory` chỉ có trong adapter (A4-1). Không có RPC mới, nên không phải ghi lại fixture hay kiểm chứng lại phiên bản. Route chỉ dùng `deleteConversation` | ✅ | ✅ A4-1, guard (a) |
| III. Local-first, bảo mật | Xoá chỉ khi người dùng bấm và xác nhận (FR-013). Guard (c) chặn mọi lời gọi xoá ngoài route. Lỗi của App không được mang ra ngoài. Log không chứa tên conversation. Test live chỉ xoá `[agent-office-test]` | ✅ | ✅ L4-1, A4-1b, quickstart §3 |
| IV. Giao hàng theo đợt | Đợt 1 (US1 + US2) dùng được ngay. US3 và US4 là các đợt riêng. US4 phụ thuộc `SiteGrid` và quán của US3. Mỗi tính năng gắn với mục tiêu "cảm hứng" hoặc "dọn dẹp" | ✅ | ✅ xem "Các đợt giao hàng" |
| V. Trải nghiệm, 60 FPS, 1 lần bấm | Bấm 1 lần vào nhân viên vẫn mở chat ở mọi nơi (FR-025). Nút xoá không nằm trên đường mở chat. Quán theo concept "Soft Studio · Sài Gòn", vẽ bằng component sẵn có, không thêm tài nguyên ngoài. Có kịch bản bench `outing`, và ở mức `low` thì bớt ghế, dù ở quán | ✅ | ✅ R4-04, R4-10, quickstart §6 |
| VI. Cài đặt macOS | Không thêm phụ thuộc. Hướng dẫn cài đặt không đổi | ✅ | ✅ |

**Kết luận**: không có vi phạm.

## Các đợt giao hàng

| Đợt | Nội dung | Điều kiện xong |
|---|---|---|
| **1** | US1: settings `legendCollapsed`, `ProjectLegend` thu gọn và cuộn. US2: A4-1, guard (c), L4-1, `ConfirmDeleteDialog`, mock App, e2e, live A4-1d | SC-001, SC-002, SC-003; quickstart §2–3 |
| **2** | US3: `SiteGrid` (+ unit) → chuyển `Crowd` và brain sang `SiteGrid` (không đổi hành vi, chạy lại test cũ) → `parkShops` và `ParkShops.tsx` → `SpotBook` → mode `outing` / `resting`, clip `Lying` / `Drinking`, `recall` → các gián đoạn (R4-09) → bench `outing` | SC-004, SC-005, SC-007; quickstart §4, §6 |
| **3** | US4: `fp-motion` với `SiteGrid`, người dùng là agent trong `Crowd`, cửa trượt → `interactables` và gợi ý → màn hình (`screensOff`, bấm ở toàn cảnh) → sofa, nước, cây → cập nhật `FirstPersonHelp` | SC-006; quickstart §5 |

Bước "chuyển sang `SiteGrid`" ở đợt 2 đứng riêng và không đổi hành vi. Toàn bộ test `crowd`,
`employee-behaviors` và `fp-motion` cũ phải pass trước khi thêm hoạt động mới.

## Project Structure

### Documentation (this feature)

```text
specs/004-office-life-interactions/
├── plan.md              # File này
├── research.md          # Phase 0 (R4-01 … R4-10)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── app-adapter.md   # A4-1
│   ├── local-api.md     # L4-1 … L4-3
│   └── ui-interactions.md  # U4-1 … U4-4
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (chưa tạo)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domain.ts                    # Settings.legendCollapsed?, screensOff?
│   ├── schemas.ts                   # settingsSchema: 2 trường optional
│   └── site-nav.ts                  # MỚI: SiteGrid (R4-03)
├── server/
│   ├── app-adapter/
│   │   ├── index.ts                 # deleteConversation (A4-1)
│   │   └── types.ts                 # AppAdapter.deleteConversation
│   └── http/routes/conversations.ts # DELETE /api/conversations/:id (L4-1)
└── web/
    ├── state/ui.ts                  # freshPlants, playerPose
    ├── ui/
    │   ├── ProjectLegend.tsx        # thu gọn / cuộn (U4-1)
    │   ├── CameraToggle.tsx         # FirstPersonHelp: phím E
    │   └── chat/
    │       ├── ChatPanel.tsx        # nút 🗑 (U4-2)
    │       └── ConfirmDeleteDialog.tsx  # MỚI
    ├── styles.css                   # legend max-height, dialog nguy hiểm, fp-hint
    └── scene/
        ├── OfficeScene.tsx          # dựng SiteGrid, SpotBook; truyền cho brain / camera
        ├── Office.tsx               # bấm wall_screen ở toàn cảnh
        ├── character.ts             # clip Lying, Drinking
        ├── employee-behaviors.ts    # outing, resting, recall, chạy về (R4-05, R4-06, R4-09)
        ├── break-spots.ts           # MỚI: SpotBook
        ├── outdoor-route.ts         # MỚI: đường gấp khúc cửa → vòng dạo → quán
        ├── crowd/crowd.ts           # kiểu grid: SiteGrid
        ├── furniture/Furniture.tsx  # Door kính trượt, WallScreen bật/tắt, cây "tươi"
        ├── park/park-layout.ts      # parkShops(), treeAllowed loại vùng quán
        ├── park/ParkShops.tsx       # MỚI: vẽ 4 quán bằng Shop / Kiosk
        ├── city/Shops.tsx           # kiểu grocery, cart
        ├── cameras/fp-motion.ts     # SiteGrid + chặn bởi nhân viên
        ├── cameras/FirstPerson.tsx  # E / tương tác / ngồi-nằm / gợi ý
        ├── interaction/interactables.ts  # MỚI: danh sách + aimTarget
        └── interaction/TestHooks.tsx     # U4-4
    bench/                           # kịch bản outing

scripts/check-guards.sh              # (c) + deleteConversation

tests/
├── unit/site-nav.test.ts, park-shops.test.ts, break-spots.test.ts, interactables.test.ts,
│        settings-compat.test.ts (MỚI); employee-behaviors / fp-motion / park-layout (mở rộng)
├── contract/adapter-delete.test.ts  # MỚI (A4-1a…c)
├── leaks/redaction.test.ts          # log L4-1
├── live/delete.live.test.ts         # MỚI (A4-1d)
└── e2e/mock-app.ts, testids.ts, legend.spec.ts, delete-employee.spec.ts, office-life.spec.ts (MỚI),
        first-person.spec.ts (mở rộng)
```

**Structure Decision**: Giữ cấu trúc một package như 001–003.
- Thao tác chạm vào App duy nhất nằm trong `app-adapter/`.
- Logic mới ở client được tách thành các module thuần (`site-nav`, `outdoor-route`, `break-spots`,
  `interactables`) để kiểm thử bằng unit test, giống `nav-core` và `crowd`.

## Complexity Tracking

| Thành phần | Vì sao cần | Phương án đơn giản hơn bị loại vì |
|---|---|---|
| `SiteGrid` (lớp mới bọc `OfficeGrid`) | Nhân viên và người dùng phải ra ngoài với cùng luật va chạm và tránh người | Lưới ngoài trời riêng: `Crowd` phải biết hai lưới. Thư viện vật lý: thêm phụ thuộc |
| `SpotBook` | Không ai ngồi chồng lên ai, giới hạn số người ra ngoài, kể cả người dùng ở FP | Mỗi brain tự hỏi `Crowd`: tranh chấp trong cùng một khung hình |
