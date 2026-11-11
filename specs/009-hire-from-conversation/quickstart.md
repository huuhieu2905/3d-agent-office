# Hướng dẫn nhanh: kiểm chứng 009

## Tự động

```bash
npm run typecheck && npm test        # unit + contract + guard
npx playwright test tests/e2e/hire-existing.spec.ts
npm run test:e2e                     # cả bộ: các spec cũ vẫn qua (SC-007, chuyển đổi R5)
```

## Thủ công, với Antigravity App thật

**Quy tắc thử nghiệm (constitution, "Thử nghiệm với App thật")**: chỉ gửi tin, tạo hoặc xoá trên conversation có tên bắt đầu bằng `[test-009]`. Không ghi vào conversation làm việc thật. Đọc (mở danh sách, mở chat, join, leave) thì dùng conversation nào cũng được, vì không ghi gì vào App.

Điều kiện:
- App đang mở, có một project thử nghiệm.
- Trong App, tạo sẵn 2 conversation trong project đó: `[test-009] A` và `[test-009] B`, mỗi cái gửi một tin ngắn để có lịch sử. Đảm bảo chúng chưa ở trong văn phòng (hoặc Remove from office trước).
- Chạy `npm run dev`.

1. **Chuyển đổi** — lần khởi động đầu sau khi cập nhật: văn phòng hiện đúng những nhân viên như trước (FR-017).
2. **Tuyển lại (US1)** — + Hire employee → project thử nghiệm → Existing conversation. So danh sách với danh sách của project đó trong App: cùng các mục, cùng tiêu đề (SC-002). Chọn `[test-009] A` → Hire. Mong đợi: chat mở ra với đủ lịch sử; nhân viên bước vào trong vòng 2 giây; không có conversation mới trong App (SC-003). Gửi một tin nhắn: nó hiện trong cùng luồng của `[test-009] A` trong App.
3. **Từ bàn** — bấm một bàn trống → Existing → chọn `[test-009] B` → nhân viên ngồi vào bàn đó.
4. **Đã ở trong văn phòng** — chọn một mục có "in the office": chat của họ mở ra, không bị nhân đôi, số đếm không đổi.
5. **Conversation tạo trong App (US3.3)** — trong App, tạo `[test-009] C` trong project thử nghiệm: nó không xuất hiện trong văn phòng, nhưng có trong danh sách Existing.
6. **Nhường chỗ (US3)** — lấp đầy tới 20/20 bằng cách **join conversation có sẵn** (qua Existing), không tạo conversation mới. Mở hộp thoại → Existing: băng thông báo nêu tên người rảnh lâu không hoạt động nhất sẽ rời đi. Chọn `[test-009] C` (bước 5) → Hire: `[test-009] C` vào văn phòng, người được nêu tên rời đi, số đếm vẫn 20/20, conversation của người rời đi vẫn còn trong App và trong danh sách Existing (có thể tuyển lại họ). Kiểm tra thêm: một nhân viên đang chạy (đang làm việc) không bao giờ là người được nêu tên.
7. **Đưa ra (US4)** — mở một nhân viên → Remove from office: họ rời đi, số đếm còn 19/20, conversation vẫn còn trong App và trong danh sách Existing.
8. **Đồng bộ (US5)** — đổi tên `[test-009] C` trong App (giữ tiền tố), mở lại danh sách: tên mới hiện ra. Xoá `[test-009] C` trong App: nó biến mất khỏi danh sách. Thoát App: danh sách báo "not connected".

## Dọn dẹp

1. Remove from office mọi nhân viên đã join ở bước 6 mà trước đó không ở trong văn phòng.
2. Fire (hoặc xoá trong App) mọi conversation `[test-009] …` còn lại.
3. Trong App, kiểm tra không còn conversation nào có tiền tố `[test-009]`.
