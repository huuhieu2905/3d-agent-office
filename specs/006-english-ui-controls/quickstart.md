# Quickstart: kiểm chứng 006

## Điều kiện trước

- Đã chạy `npm install`; Antigravity App đang mở (hoặc dùng App giả lập của e2e qua `npm run test:e2e`).
- Chromium dùng GPU thật (cổng chất lượng 4 trong constitution).

## Tự động

```bash
npm run typecheck && npm run lint
npm test          # vitest + check-guards.sh (gồm bước (f): không còn chữ tiếng Việt trên giao diện trong src/)
npm run test:e2e  # selector và so sánh đã đổi sang tiếng Anh; test mới cho Esc, chuột phải, fullscreen, độ nhạy
```

Kết quả mong đợi: tất cả qua. Nếu còn chữ tiếng Việt trên giao diện, bước (f) in `✗ (f)` kèm file:dòng.

## Kiểm tra bằng tay (`npm run dev`)

| # | Các bước | Kết quả mong đợi | Spec |
|---|---|---|---|
| 1 | Đi qua mọi màn hình: Toàn cảnh, góc nhìn thứ nhất, chế độ Xây dựng, chat, tuyển nhân viên, hộp xoá nhân viên, cài đặt, thống kê sử dụng, quota, project, hộp xin quyền và hộp câu hỏi. Đóng App để xem trạng thái mất kết nối. | Không có chữ tiếng Việt. Ngày và số theo định dạng tiếng Anh. | US1, SC-001 |
| 2 | Mở chat, gõ một bản nháp, bấm `Esc` | Khung chat đóng | US2-1 |
| 3 | Mở chat, gõ `@` để mở menu nhắc file, bấm `Esc`, `Esc` | Lần 1 đóng menu, lần 2 đóng chat | US2-2 |
| 4 | Bấm 🗑 trong chat, bấm `Esc` | Chỉ hộp thoại đóng | US2-2 |
| 5 | Chế độ Xây dựng: bấm chuột trái vào một chậu cây, rồi bấm chuột phải vào nó | Chậu cây biến mất, không hiện menu của trình duyệt; ⌘Z mang nó lại; Cancel giữ nguyên bố cục đã lưu | US3-1, US3-4 |
| 6 | Chế độ Xây dựng: chưa chọn gì, bấm chuột phải vào chậu cây; chọn A, bấm chuột phải vào B | Không có gì bị xoá | US3-2, US3-3 |
| 7 | Toàn cảnh: bấm ⛶ (hoặc `F`); bấm `V` để sang góc nhìn thứ nhất; đi lại và nhìn quanh; bấm `F` | Toàn màn hình suốt quá trình, nút hiển thị đúng trạng thái, rồi thoát | US4 |
| 8 | Bật fullscreen, rồi thoát bằng `Esc` của trình duyệt | Nút hiện lại "Fullscreen" | FR-016 |
| 9 | Settings: đặt độ nhạy 3, rồi 0.25; di chuột ở góc nhìn thứ nhất và kéo xoay ở Toàn cảnh | Tốc độ xoay đổi ngay; ở 0.25 vẫn xoay được | US5-1 |
| 10 | Tải lại trang | Giá trị vẫn giữ; Reset đưa về 1.00× | US5-2 |
| 11 | Xoá `mouseSensitivity` khỏi `settings.json`, khởi động lại | Nạp bình thường; thanh trượt hiện 1.00× | US5-3 |

Xem [contracts/ui-input.md](contracts/ui-input.md) để biết thứ tự xử lý phím và selector, và [data-model.md](data-model.md) để biết trường cài đặt mới.
