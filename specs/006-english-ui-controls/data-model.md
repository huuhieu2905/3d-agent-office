# Data Model: Giao diện tiếng Anh và cải tiến điều khiển

## Settings (có thay đổi)

Lưu trong `settings.json`. Kiểu dữ liệu: `Settings` trong `src/shared/domain.ts`; kiểm tra hợp lệ: `settingsSchema` trong `src/shared/schemas.ts`.

| Trường | Kiểu | Quy tắc | Mặc định |
|---|---|---|---|
| `mouseSensitivity` *(mới)* | `number`, tuỳ chọn | `0.25 ≤ x ≤ 3` | không có trường, phía trình duyệt coi là `1` |

- Cố ý để tuỳ chọn: `settings.json` ghi trước 006 vẫn phải đọc được, nếu không `JsonStore` sẽ đặt lại toàn bộ về mặc định.
- `schemaVersion` giữ nguyên `1`; đây là thay đổi bổ sung, tương thích ngược.
- Bước của thanh trượt là 0.05. Giá trị ngoài khoảng bị `PUT /api/settings` từ chối với mã 400.

## Đồ vật đang chọn trong chế độ Xây dựng (không đổi cấu trúc, thêm quy tắc)

Trạng thái `useBuild`: `selectedId: string | null`, `draft: OfficeLayout`.

- Nhấn chuột phải vào đồ vật `X` khi `selectedId === X` dẫn tới `removeSelected()`: bản nháp mất `X`, thêm một bước vào lịch sử hoàn tác, và `selectedId` thành `null`.
- Nhấn chuột phải vào đồ vật `X` khi `selectedId !== X` thì không làm gì.
- Không có gì được lưu cho tới khi bấm Save (không đổi).

## Trạng thái fullscreen (chỉ ở trình duyệt, không lưu)

Tính từ `document.fullscreenElement !== null` và cập nhật khi có sự kiện `fullscreenchange`. Không lưu vào cài đặt, vì trình duyệt không cho vào fullscreen nếu người dùng chưa thao tác.
