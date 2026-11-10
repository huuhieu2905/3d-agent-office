# Research: Giao diện tiếng Anh và cải tiến điều khiển

Phần Technical Context không còn mục NEEDS CLARIFICATION nào. Dưới đây là các quyết định thiết kế.

## R1. Cách dịch

- **Decision**: Dịch tại chỗ từng chuỗi. Không dùng thư viện đa ngôn ngữ (i18n), không làm bảng tập trung các chuỗi.
- **Rationale**: Spec yêu cầu chỉ tiếng Anh, không có nút chuyển ngôn ngữ (FR-006). Một bảng chuỗi chỉ thêm một lớp gián tiếp mà không có ngôn ngữ thứ hai nào cần dùng.
- **Alternatives considered**: react-i18next hoặc một file `strings.ts` tập trung. Bị loại vì chỉ đáng làm khi có từ hai ngôn ngữ trở lên.

## R2. Ngăn tiếng Việt quay lại

- **Decision**: Thêm bước kiểm tra (f) vào `scripts/check-guards.sh` (đã được `npm test` chạy). Bước này báo các dòng trong `src/**/*.{ts,tsx,html,css}` có chữ tiếng Việt có dấu (`àáạ…đĐ`, không phân biệt hoa thường), bỏ qua các dòng mà phần chữ đầu tiên là `//`, `*`, `/*` hoặc `{/*`. Lệnh `grep` chạy với `LC_ALL=C.UTF-8` và có bước tự kiểm tra: phải bắt được `Ở` và không được báo `×`.
- **Rationale**: Biến SC-001 thành kiểm tra tự động. Comment nằm ngoài phạm vi nên các dòng chỉ chứa comment được bỏ qua. Comment tiếng Việt nằm cuối một dòng code sẽ bị báo và phải dịch, điều này chấp nhận được. Dùng `C.UTF-8` thay cho `en_US.UTF-8` vì nếu máy thiếu bộ ngôn ngữ đó, `grep` sẽ so theo từng byte và báo nhầm ký tự `×` (trùng byte đầu với `à`). Tên (f) là vì `check-guards.sh` đã có bước (e).
- **Limit**: Không bắt được chữ tiếng Việt không dấu (ví dụ "Xin chao"). Phần kiểm tra bằng tay trong quickstart lo phần này.

## R3. Định dạng theo ngôn ngữ

- **Decision**: `toLocaleString('vi-VN')` → `'en-US'` (QuotaPanel, đồng hồ trong Furniture). `<html lang="vi">` → `"en"`.

## R4. Esc đóng chat mà không giành Esc của popup

- **Decision**: `ChatPanel` thêm một bộ nghe `keydown` trên `window` ở pha nổi bọt (bubbling): `if (e.key === 'Escape' && !e.defaultPrevented) close()`. Các popup tự xử lý Esc thì đánh dấu là đã dùng:
  - menu nhắc file hoặc lệnh (`extensions.tsx`, pha bắt (capture)) đã gọi `preventDefault()` sẵn ✅
  - `ConfirmDeleteDialog`: thêm `e.preventDefault()` và chuyển sang pha bắt (capture), vì bộ nghe của khung chat được đăng ký trước nên ở pha nổi bọt nó sẽ chạy trước
  - thao tác kéo trong chế độ Xây dựng (`DragLayer`) dùng `stopImmediatePropagation` ở pha bắt ✅
  - menu chọn model là `<select>` có sẵn của trình duyệt, tự nuốt Esc khi đang mở ✅
  - bộ xử lý Esc của `BuildMode` thoát sớm khi khung chat đang mở, để một lần Esc không làm hai việc.
- **Rationale**: Chỉ cần một cờ, không cần kho trạng thái chung kiểu "chồng hộp thoại".
- **Khoá chuột và fullscreen**: trình duyệt dùng lần Esc đầu tiên và không chuyển cho trang. Điều này khớp với trường hợp đặc biệt trong spec nên không cần làm gì thêm.
- **Alternatives considered**: một chồng hộp thoại toàn cục trong `useUi`. Bị loại vì quá nhiều code cho 3 popup.

## R5. Xoá bằng chuột phải

- **Decision**: Dùng `onItemPress(item, e)` có sẵn của chế độ Xây dựng (khi nhấn chuột xuống) trong `OfficeScene.tsx`. Khi `e.button === 2`: nếu `item.id === build.selectedId` thì gọi `build.removeSelected()`; nếu không thì thoát. Nút chuột phải không bao giờ chọn hay kéo. Chặn `contextmenu` trên khung 3D (`onContextMenu={e => e.preventDefault()}` trên `<Canvas>` của R3F).
- **Rationale**: `removeSelected` đã đi qua `apply()` (lịch sử hoàn tác cộng kiểm tra hợp lệ), nên có sẵn FR-010 và FR-013.
- **Camera Toàn cảnh**: `CameraControls` gán nút chuột phải cho thao tác kéo ngang (truck/pan). Bấm chuột phải mà không kéo thì camera không di chuyển. Kéo bằng chuột phải vẫn kéo ngang như cũ.
- **Quy tắc xoá**: hiện `removeSelected` không có quy tắc chặn "bàn đang có người ngồi". Chỗ ngồi được xử lý khi kiểm tra hoặc lưu bố cục. Chuột phải giữ đúng hành vi của phím Delete (tình huống US3-5 trong spec).

## R6. Fullscreen

- **Decision**: Dùng `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`, lấy trạng thái từ sự kiện `fullscreenchange`, và dùng `document.fullscreenEnabled` để ẩn hoặc vô hiệu hoá nút. Phím tắt `KeyF` dùng cùng điều kiện bỏ qua ô nhập như `useCameraHotkey`. Nếu yêu cầu bị từ chối, hiện một thông báo ngắn bằng tiếng Anh cạnh nút trong 3 giây (`title` cộng dòng chữ cạnh nút).
- **Rationale**: Đưa cả trang vào fullscreen giữ các bảng vẫn dùng được (US4-1) và không phụ thuộc chế độ camera (US4-3). Khoá chuột vẫn hoạt động trong fullscreen.
- **Alternatives considered**: chỉ đưa `<canvas>` vào fullscreen. Bị loại vì sẽ che mất chat, cài đặt và thanh công cụ Xây dựng.

## R7. Độ nhạy chuột

- **Decision**: `Settings.mouseSensitivity?: number` (zod `.min(0.25).max(3).optional()`), giá trị mặc định 1 áp dụng ở phía trình duyệt (`settings.mouseSensitivity ?? 1`).
  - Góc nhìn thứ nhất: `<PointerLockControls pointerSpeed={s} />` (three.js nhân `movementX` với `pointerSpeed`).
  - Toàn cảnh: `<CameraControls azimuthRotateSpeed={s} polarRotateSpeed={s} />` (mặc định của thư viện là 1). Tốc độ zoom (dolly) và kéo ngang (truck) giữ nguyên, đúng giả định trong spec.
- **Tỉ lệ**: 3 / 0.25 = 12 lần, khớp SC-005.
- **Trường tuỳ chọn**: bắt buộc theo bài học từ 004 (`JsonStore` đặt lại file nếu không khớp schema), để `settings.json` cũ vẫn nạp được (US5-3).
