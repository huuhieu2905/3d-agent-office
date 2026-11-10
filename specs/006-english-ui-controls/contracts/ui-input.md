# Contract: Bàn phím và chuột (giao diện)

## Bàn phím

| Phím | Ở đâu | Tác dụng | Điều kiện |
|---|---|---|---|
| `Esc` | khung chat đang mở | đóng chat, giống bấm × | bỏ qua nếu một popup đã xử lý (`defaultPrevented`); hoạt động cả khi đang gõ trong ô tin nhắn |
| `Esc` | popup đè lên chat (menu nhắc file, hộp xoá) | chỉ đóng popup | gọi `preventDefault()` |
| `F` | mọi chế độ xem, kể cả chế độ Xây dựng | bật/tắt fullscreen | bỏ qua trong `input`, `textarea`, `select`, và khi giữ ⌘/Ctrl |
| `V`, `E`, `R`, WASD, ⌘Z | (không đổi) | | |

Thứ tự xử lý `Esc`, cái nào khớp trước thì thắng: trình duyệt (thoát khoá chuột hoặc fullscreen) → huỷ thao tác kéo trong chế độ Xây dựng (pha bắt) → menu nhắc file (pha bắt) → hộp xoá nhân viên (pha bắt) → đóng chat → chế độ Xây dựng (bỏ chọn đồ trong bảng hoặc bỏ chọn đồ vật, chỉ khi chat đang đóng).

Bộ xử lý Esc của chế độ Xây dựng thoát sớm khi khung chat đang mở (`useUi.openConversationId !== null`), nên một lần Esc đóng chat mà không bỏ chọn đồ vật. Cách này không phụ thuộc thứ tự đăng ký bộ nghe.

## Chuột (chỉ trong chế độ Xây dựng)

| Thao tác | Bấm vào | Tác dụng |
|---|---|---|
| Nhấn chuột trái | đồ vật | chọn và bắt đầu kéo (không đổi) |
| Nhấn chuột phải | đồ vật đang chọn | xoá nó (hoàn tác được); không hiện menu trình duyệt |
| Nhấn chuột phải | đồ vật khác, sàn, nhân viên | không xoá gì, lựa chọn giữ nguyên |
| Nhấn chuột phải | bất kỳ đâu trên khung 3D, mọi chế độ | không hiện menu chuột phải của trình duyệt |

## Nút điều khiển (selector ổn định cho e2e)

| Nút | Selector | Nhãn |
|---|---|---|
| Bật/tắt fullscreen | `data-testid="fullscreen-toggle"` | "⛶ Fullscreen" / "Exit fullscreen", `aria-pressed` theo trạng thái |
| Thanh trượt độ nhạy | `data-testid="mouse-sensitivity"` (`input[type=range]` 0.25–3, bước 0.05) | "Mouse sensitivity", kèm giá trị hiện tại dạng `1.00×` |
| Đưa độ nhạy về mặc định | `data-testid="mouse-sensitivity-reset"` | "Reset" |
| Đóng chat | nút có sẵn, `aria-label="Close"` | × |

Nhãn trong cột cuối là chữ hiển thị thật trên giao diện, nên giữ tiếng Anh.
