# Implementation Plan: Làm mới giao diện theo concept thực tế hơn

**Branch**: `002-realistic-ui-refresh` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-realistic-ui-refresh/spec.md`

## Summary

Tính năng này gồm hai việc: sửa ba lỗi trải nghiệm hằng ngày, và làm lại toàn bộ phong cách hình ảnh
theo một concept thực tế hơn do người dùng chọn từ 5 mẫu.

**Sửa lỗi và tương tác** (làm trước, không phụ thuộc concept):
- **US1**: model được nhớ theo từng conversation. Nguyên nhân là `ChatPanel.tsx:55` gán cứng
  `lastModel = null`. Cách sửa: lưu `preferredModel` vào hồ sơ nhân viên và đọc `currentModel` từ App.
- **US2**: kéo thả đồ vật và nhân viên chỉ trong chế độ sắp xếp. Nguyên nhân gốc là mô hình sự kiện
  (camera nuốt thao tác kéo, mặt phẳng nhận sự kiện bị che, bàn trong bản nháp bị server từ chối).
  Cách sửa: một bộ điều khiển kéo dùng chung và bố cục v2 có toạ độ liên tục.
- **US3**: nhân viên không chồng lấn và có hiệu ứng va chạm, nhờ một hệ thống đám đông thuần TypeScript.
- **US4**: đổi kích thước văn phòng (6–40 m), với vỏ văn phòng sinh theo kích thước.

**Làm mới hình ảnh** (sau cổng chọn concept):
- **US5**: trang xem 5 concept A–E, người dùng chọn rồi ghi `concept-decision.md`.
- **US6**: áp concept cho toàn bộ 3D và UI: PBR, HDRI, nhân vật CC0 mới, token màu, font Fontsource
  đóng gói kèm.
- **US7**: thành phố dạng mô-đun có texture cửa sổ, quán cà phê và quán ăn ở mỗi thành phố; cây thật hơn, công viên có
  lối đi, người đi bộ, chạy bộ, tập thể dục; xe hơi, xe máy, xe buýt trên đường (vòng 2 của concept E+).

## Technical Context

**Language/Version**: TypeScript 6 trên Node.js ≥ 22 (server). React 19 + three.js 0.187 (web).
Không đổi so với 001.

**Primary Dependencies**:
- Giữ nguyên: Fastify 5, zod 4, pino, React Three Fiber 9, drei 10, zustand 5, Vite 8.
- Thêm (đều chạy offline, đóng gói kèm):
  - `@fontsource-variable/*`: 2 họ font của concept đã chọn (OFL 1.1).
  - `n8ao` hoặc postprocessing SSAO, chỉ dùng ở mức chi tiết Cao (R2-07, chọn khi làm US6).
- Không thêm engine vật lý (R2-04).

**Storage**:
- `layout.json` lên schema v2, tự chuyển đổi từ v1 và sao lưu `layout.v1.bak.json`.
- `employees.json` thêm `preferredModel`.
- Không có file mới. Vẫn không lưu nội dung chat.

**Testing**:
- Vitest:
  - unit: layout v2, chuyển đổi bố cục, crowd mô phỏng 10 phút, giới hạn đổi kích thước.
  - contract: `currentModel` từ fixture App 2.24.0.
- Playwright:
  - `build-drag.spec.ts` viết trước để tái hiện lỗi.
  - `model-memory.spec.ts`, `office-resize.spec.ts`, `fonts.spec.ts` (chặn mạng ngoài).
- `bench:fps` thêm các kịch bản `crowd`, `--floor 40x40` và concept mới.

**Target Platform**: macOS 13+, Chrome hoặc Firefox có WebGL 2 (không đổi).

**Project Type**: Ứng dụng web local, một package, server cầu nối + client 3D (không đổi).

**Performance Goals**:
- ≥ 60 FPS với 20 nhân viên ở mức Trung bình, trên MacBook Pro M1 Pro, 1080p, Chrome. Đạt cả ở văn
  phòng 40 × 40 m và với thành phố mới.
- Crowd ≤ 0,2 ms mỗi khung hình với 20 agent.
- Kéo thả phản hồi trong cùng khung hình.
- Ngân sách tài nguyên: tải lần đầu ≤ 25 MB, ≤ 300 draw call ở mức Trung bình.

**Constraints**:
- Không có kết nối ra ngoài mới: font, HDRI và mô hình đóng gói trong repo hoặc `node_modules`.
- Không dùng Draco decoder từ CDN.
- Mọi tài nguyên mới có giấy phép phi thương mại và được ghi vào `assets/LICENSES.md`.
- Bố cục v1 của người dùng không được mất.
- US6 và US7 bị chặn bởi `concept-decision.md` (`status: chosen`).

**Scale/Scope**:
- 7 user story, 43 FR, 15 SC.
- 5 concept mẫu, triển khai 1.
- Khoảng 6–8 mẫu toà nhà và 4 mẫu quán.
- ≤ 20 nhân viên hiển thị.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Kiểm tra | Trước Phase 0 | Sau Phase 1 |
|---|---|---|---|
| I. App là nguồn dữ liệu duy nhất | `preferredModel` là lựa chọn giao diện riêng, danh sách model vẫn lấy từ App. `currentModel` đọc từ App, trả `null` khi không chắc. Hiệu ứng va chạm không đổi hay che trạng thái thật | ✅ | ✅ data-model §1–§2, contracts/app-adapter.md A2-1, FR-020 |
| II. Lớp kết nối App được cô lập | Chỉ mapper trong `src/server/app-adapter/` đọc trường model. Có contract test bằng fixture. Không thêm RPC | ✅ | ✅ A2-1 kèm 3 contract test |
| III. Local-first, bảo mật | Không kết nối ra ngoài mới: font qua Fontsource, HDRI và mô hình nằm trong repo. Mọi thao tác ghi do người dùng thực hiện. Kiểm tra id và model ở route | ✅ | ✅ R2-08, contracts/local-api.md L2-3; e2e chặn mạng ngoài |
| IV. Giao hàng theo đợt | Đợt A (US1–US4) dùng được ngay với giao diện hiện tại. Đợt B (US5–US7) sau cổng chọn concept. Mỗi đợt kết thúc ở trạng thái dùng được | ✅ | ✅ xem "Các đợt giao hàng" |
| V. Trải nghiệm, ≥ 60 FPS, 1 lần bấm | Đổi phong cách khỏi low-poly do spec quyết định (FR-032), đúng điều khoản "trừ khi spec quyết định khác". Tài nguyên thống nhất theo concept, có giấy phép. 60 FPS có 3 mức chi tiết và giảm thành phố trước. Bấm nhân viên ở màn hình chính vẫn mở chat bằng 1 lần bấm | ✅ | ✅ R2-07, R2-09, U-1, SC-008/014 |
| VI. Cài đặt macOS ≤ 15 phút | Không Docker. Tài nguyên thêm khoảng 25 MB không ảnh hưởng đáng kể thời gian cài. Hướng dẫn cài đặt được chạy lại | ✅ | ✅ quickstart "Cổng chất lượng" |

**Kết luận**: không có vi phạm. Đề xuất (không chặn): một lần sửa PATCH cho Nguyên tắc V, đổi câu
"mặc định là low-poly cách điệu" thành "theo concept đã chốt trong spec 002" (R2-10).

## Các đợt giao hàng

| Đợt | Nội dung | Điều kiện xong |
|---|---|---|
| **A1** | US1 (model) | SC-001 đạt; test e2e model-memory và contract test qua |
| **A2** | US2 (kéo thả, bố cục v2, chuyển đổi) | Test tái hiện lỗi chuyển xanh; SC-002–004; chuyển đổi v1 không mất dữ liệu |
| **A3** | US3 (crowd, va chạm) + US4 (đổi kích thước) | Mô phỏng 10 phút không chồng lấn; SC-005–008; 60 FPS ở 40 × 40 m |
| **B0** | US5: trang 5 concept → **cổng: người dùng chọn** | `concept-decision.md` có `status: chosen` |
| **B1** | US6: concept + font cho toàn hệ thống | SC-009–011; checklist màn hình đầy đủ; LICENSES cập nhật |
| **B2** | US7: thành phố, công viên, quán, xe cộ, người | SC-012–014; giảm chi tiết đúng thứ tự |

B0 có thể làm song song với A2/A3 vì không chạm code sản phẩm. Như vậy người dùng chọn concept trong khi
các lỗi đang được sửa.

## Project Structure

### Documentation (this feature)

```text
specs/002-realistic-ui-refresh/
├── plan.md                 # File này
├── research.md             # Phase 0 (R2-01 … R2-10)
├── data-model.md           # Phase 1
├── quickstart.md           # Phase 1
├── contracts/
│   ├── local-api.md        # L2-1 … L2-4
│   ├── app-adapter.md      # A2-1
│   └── ui-interactions.md  # U-1 … U-6
├── concept-decision.md     # Tạo ở B0, cổng chặn B1/B2
├── concepts/               # Ảnh chụp 5 concept
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── domain.ts                 # OfficeLayout v2, PlacedItemV2, EmployeeProfile.preferredModel
│   ├── schemas.ts                # zod v2 + PUT /api/layout { layout, seating }
│   ├── catalog.ts                # footprint bằng mét, điểm ngồi theo mét
│   ├── layout-validation.ts      # chồng hình chữ nhật, lưới điều hướng 0,25 m, giới hạn floor
│   └── layout-migrate.ts         # MỚI: v1 → v2
├── server/
│   ├── app-adapter/mappers/
│   │   ├── conversation.ts       # điền currentModel
│   │   └── step.ts               # đọc model từ step
│   ├── services/
│   │   ├── layout-store.ts       # chuyển đổi khi đọc + sao lưu v1
│   │   ├── default-layout.ts     # sinh v2
│   │   └── employee-profiles.ts  # preferredModel
│   └── http/routes/layout.ts     # seating, FLOOR_TOO_SMALL, preferredModel
└── web/
    ├── theme/concept.ts          # MỚI (B1): token 3D của concept đã chọn
    ├── styles.css                # token UI + @font-face qua Fontsource (B1)
    ├── state/build.ts            # seating, drag, resize trong bản nháp
    ├── ui/
    │   ├── chat/ChatPanel.tsx, Composer.tsx, ModelPicker.tsx   # US1
    │   └── build/                # ô kích thước, thanh công cụ đồ vật
    └── scene/
        ├── interaction/          # MỚI: DragController.ts (pointer capture, mặt phẳng y=0, ngưỡng 4 px)
        ├── BuildGizmo.tsx        # dùng DragController; tay kéo đổi kích thước
        ├── EmployeeDrag.tsx      # thay bằng DragController (xoá)
        ├── crowd/                # MỚI: crowd.ts (thuần), nav-grid.ts (0,25 m), reactions.ts
        ├── employee-behaviors.ts # brain chọn đích, crowd lo chuyển động
        ├── Employee.tsx, character.ts  # phản ứng bump; nhân vật mới (B1)
        ├── furniture/            # PBR / mô hình CC0 (B1); PropJiggle
        ├── Office.tsx            # vỏ văn phòng từ shell + floor
        ├── park/                 # vùng cấm theo kích thước văn phòng
        └── city/                 # BuildingKit.tsx, Shops.tsx, CitySkyline.tsx (B2)

concepts/                         # MỚI (B0): trang xem 5 concept, không bundle vào app
assets/
├── hdri/                         # HDRI CC0 1k (B1)
├── models/                       # nhân vật, nội thất, quán CC0 (B1/B2)
└── LICENSES.md

tests/
├── unit/        layout-v2, layout-migrate, crowd, resize-limits, model-resolve
├── contract/    adapter-current-model
└── e2e/         build-drag, model-memory, office-resize, fonts
```

**Structure Decision**: Giữ cấu trúc một package của 001 (`src/server`, `src/web`, `src/shared`).
Logic thuần dùng chung client/server (kiểm tra bố cục, chuyển đổi) nằm trong `src/shared`. Logic thuần
phía client (crowd, kéo) tách thành module không phụ thuộc React để kiểm thử bằng Vitest. Trang concept
nằm ở thư mục gốc `concepts/`, ngoài bundle sản phẩm.

## Complexity Tracking

| Thành phần | Vì sao cần | Phương án đơn giản hơn bị loại vì |
|---|---|---|
| Bố cục schema v2 kèm chuyển đổi | Đặt tự do (FR-007) và đổi kích thước (FR-022) cần toạ độ liên tục và vỏ sinh theo kích thước | Lưới mịn 0,05 m làm A* chậm (800 × 800 ô); giữ tường chu vi là item làm đổi kích thước phải sửa hàng trăm item |
| Hệ thống crowd riêng | FR-016–021: không chồng lấn, nhường đường, phản ứng va chạm | Engine vật lý thêm WASM ~1 MB và làm nhân viên ngã hoặc trôi, khó giữ trung thực trạng thái |
| Trang concept độc lập | FR-028: 5 mẫu trung thực với 3D thật để chọn | Ảnh vẽ tĩnh không làm được và không trung thực; đưa 5 theme vào app tốn gấp 5 lần tài nguyên |
| SSAO (chỉ mức Cao) | Độ "thật" của concept | Bật ở mọi mức sẽ tụt dưới 60 FPS |
