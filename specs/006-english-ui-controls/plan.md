# Implementation Plan: Giao diện tiếng Anh và cải tiến điều khiển

**Branch**: `006-english-ui-controls` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification từ `specs/006-english-ui-controls/spec.md`

## Summary

Năm thay đổi nhỏ, độc lập ở phía trình duyệt (cộng thêm các chuỗi thông báo ở server):

1. **Giao diện tiếng Anh**: dịch tại chỗ mọi chuỗi hiển thị cho người dùng (khoảng 50 file mã nguồn), đổi `lang="vi"` → `en` và định dạng `vi-VN` → `en-US`, thêm một bước kiểm tra tĩnh vào `scripts/check-guards.sh` để báo lỗi nếu còn ký tự tiếng Việt trên các dòng không phải comment trong `src/`. Không dùng thư viện đa ngôn ngữ (i18n), vì spec yêu cầu chỉ tiếng Anh.
2. **Esc đóng chat**: một bộ nghe sự kiện `keydown` trong `ChatPanel` đóng khung chat, trừ khi một bộ xử lý trước đó đã dùng phím Esc (`e.defaultPrevented`). Bộ xử lý Esc của hộp xác nhận xoá được sửa để gọi `preventDefault()`; menu `@` đã làm việc này sẵn.
3. **Xoá bằng chuột phải**: trong chế độ Xây dựng, hàm `onItemPress` có sẵn (khi nhấn chuột xuống) kiểm tra `e.button === 2`. Nếu là đồ vật đang chọn thì gọi `removeSelected()` có sẵn; nếu không thì không làm gì (không chọn, không kéo). Khung 3D chặn sự kiện `contextmenu`.
4. **Fullscreen**: một nút nhỏ `FullscreenToggle` cạnh `CameraToggle`, cộng phím tắt F, dùng Fullscreen API của trình duyệt trên `document.documentElement`. Nhờ vậy các bảng vẫn hiện và fullscreen được giữ khi đổi camera. Trạng thái lấy từ sự kiện `fullscreenchange`.
5. **Độ nhạy chuột**: thêm cài đặt tuỳ chọn `mouseSensitivity` (0.25–3.0, mặc định 1). Giá trị này truyền vào `PointerLockControls.pointerSpeed` (góc nhìn thứ nhất) và `CameraControls.azimuthRotateSpeed` / `polarRotateSpeed` (Toàn cảnh). Trong `SettingsPanel` có thanh trượt và nút Reset.

## Technical Context

**Language/Version**: TypeScript 6, Node ≥ 22
**Primary Dependencies**: React 19, @react-three/fiber 9, @react-three/drei 10 (`PointerLockControls`, `CameraControls`), zustand 5, zod 4, Fastify 5. Không thêm thư viện mới.
**Storage**: `settings.json` qua `JsonStore` có sẵn (thêm một trường tuỳ chọn)
**Testing**: vitest (unit/contract), Playwright e2e, `scripts/check-guards.sh`
**Target Platform**: trình duyệt nhân Chromium trên macOS và Linux (máy tham chiếu CachyOS)
**Project Type**: ứng dụng web: server Fastify chạy local cộng giao diện React/three.js
**Performance Goals**: không đổi ngân sách 60 FPS. Toàn bộ code mới là bộ xử lý sự kiện, không có gì chạy mỗi khung hình.
**Constraints**: `settings.json` cũ vẫn phải đọc được (trường mới là tuỳ chọn); không thêm kết nối ra ngoài
**Scale/Scope**: khoảng 50 file mã nguồn có chuỗi tiếng Việt, khoảng 16 file e2e tìm hoặc so sánh theo chữ tiếng Việt, 4 thay đổi hành vi

## Constitution Check

*GATE: Phải qua trước Phase 0 research. Kiểm tra lại sau Phase 1 design.*

| Nguyên tắc | Kiểm tra | Kết quả |
|---|---|---|
| I. App là nguồn sự thật duy nhất | Không đổi dữ liệu lấy từ App. Chữ của người dùng/agent không bị dịch (FR-005). Nhãn trạng thái "không rõ" vẫn giữ, chỉ đổi sang tiếng Anh. | ✅ |
| II. Lớp kết nối App được cô lập | Chỉ đổi các chuỗi thông báo trong `app-adapter/mappers/*` (tiêu đề và nhãn mặc định). Không đổi RPC, danh sách phiên bản hay định dạng dữ liệu, nên không cần dữ liệu mẫu mới hay kiểm chứng lại tương thích. | ✅ |
| III. Local-first, bảo mật | Không thêm truy cập mạng. Trường cài đặt mới được zod kiểm tra ở ranh giới tin cậy (`PUT /api/settings`). | ✅ |
| IV. Giao hàng theo đợt dùng được | Mỗi user story giao được riêng. Tiếng Anh (P1) và Esc (P1) làm trước. | ✅ |
| V. Trải nghiệm và hiệu năng | Không có xử lý mỗi khung hình. Mở chat bằng 1 lần bấm giữ nguyên. Phong cách 3D không đổi; chữ trên quán và biển hiệu thành tiếng Anh. | ✅ |
| VI. macOS + Linux | Fullscreen và khoá chuột là API chuẩn của trình duyệt, không rẽ nhánh theo hệ điều hành. | ✅ |
| Cổng chất lượng | Cổng 1–3 không bị ảnh hưởng (không đổi giao thức lớp kết nối). Cổng 4: chạy e2e trên GPU thật sau khi đổi chữ. Cổng 5: tài liệu cài đặt chỉ đổi tên nút được trích (xem Assumptions trong spec). | ✅ |

Không có vi phạm, nên mục Complexity Tracking để trống.

**Kiểm tra lại sau thiết kế**: không đổi, ✅.

## Project Structure

### Documentation (this feature)

```text
specs/006-english-ui-controls/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── settings-api.md
│   └── ui-input.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/
├── shared/            schemas.ts, domain.ts (mouseSensitivity), catalog.ts, layout-validation.ts (chuỗi)
├── server/            routes/*, services/*, app-adapter/mappers/* (chỉ đổi chuỗi sang tiếng Anh)
└── web/
    ├── index.html     lang="en"
    ├── ui/            CameraToggle.tsx (+FullscreenToggle, phím F), chat/ChatPanel.tsx (Esc),
    │                  chat/extensions.tsx + ConfirmDeleteDialog.tsx (preventDefault khi Esc),
    │                  build/BuildMode.tsx (bỏ qua Esc khi chat đang mở),
    │                  settings/SettingsPanel.tsx (thanh trượt), mọi file ui/* khác (chuỗi)
    └── scene/         OfficeScene.tsx (xoá bằng chuột phải), cameras/FirstPerson.tsx + Overview.tsx (độ nhạy),
                       city/*, park/*, furniture/* (chuỗi)
scripts/check-guards.sh   bước kiểm tra mới (f): không còn tiếng Việt trên dòng không phải comment trong src/
tests/                    selector và so sánh trong e2e → tiếng Anh; test unit cho giới hạn độ nhạy và tương thích cài đặt
```

**Structure Decision**: giữ nguyên cấu trúc ứng dụng web một repo hiện có. Mọi thay đổi là sửa tại chỗ. Thành phần mới duy nhất là `FullscreenToggle`, đặt trong `CameraToggle.tsx` cạnh nút đổi camera.

## Complexity Tracking

Không có.
