# Quickstart: Kiểm chứng 002 — Làm mới giao diện

Hướng dẫn chạy và kiểm tra từng câu chuyện người dùng từ đầu đến cuối. Chi tiết dữ liệu xem
[data-model.md](./data-model.md); hành vi giao diện xem [contracts/ui-interactions.md](./contracts/ui-interactions.md).

## Chuẩn bị

```bash
npm install
npm run typecheck && npm test        # unit + contract + guard
npm run dev                          # server 127.0.0.1 + Vite
```

E2E dùng App giả lập: `npm run test:e2e`. Kiểm tra với App thật dùng conversation thử nghiệm đặt tên
`[test-002] ...` và xoá sau khi thử (Constitution, quy trình).

Sao lưu trước khi thử chuyển đổi bố cục: `cp "<thư mục cấu hình>/layout.json" /tmp/layout.before.json`.

---

## US1 · Model được nhớ theo conversation

1. Mở chat nhân viên A, chọn "3.8 Flash". Thấy thông báo "Đã lưu cho cuộc trò chuyện này".
2. Đóng chat, mở lại A → vẫn là "3.8 Flash".
3. Mở nhân viên B → hiển thị model gần nhất của B (hoặc mặc định), không phải "3.8 Flash".
4. Tải lại trang, khởi động lại `npm run dev` → A vẫn là "3.8 Flash".
5. Trong App giả lập, bỏ "3.8 Flash" khỏi danh sách model → mở A → cảnh báo `model-unavailable`, nút
   gửi bị khoá.

Tự động: `tests/e2e/model-memory.spec.ts`, `tests/contract/adapter-current-model.test.ts`.
**Kỳ vọng**: SC-001 đạt với 5 conversation và 5 model khác nhau.

## US2 · Chọn và kéo thả (chỉ trong chế độ sắp xếp)

1. Ở màn hình chính, nhấn giữ và kéo một nhân viên → camera xoay, không ai bị di chuyển. Bấm nhân viên
   → mở chat.
2. Bật chế độ sắp xếp. Bấm một cái bàn → bàn có viền và thanh công cụ.
3. Kéo bàn tới chỗ trống giữa hai ô lưới cũ → bóng xanh, thả ra đúng chỗ (sai lệch ≤ 5 cm).
4. Kéo bàn chồng lên sofa → bóng đỏ, thả ra bàn quay về chỗ cũ.
5. Kéo nhân viên tới bàn trống → bàn sáng xanh, thả ra nhân viên đi tới ngồi. Kéo tới bàn có người →
   hai người đổi chỗ. Thả ra sàn trống → về bàn cũ.
6. Đặt một bàn **mới** rồi kéo nhân viên vào bàn đó **trước khi lưu** → hoạt động (lỗi R2-02 #3).
7. Lưu, tải lại trang → vị trí và chỗ ngồi giữ nguyên.
8. Khôi phục `layout.before.json` dạng v1, khởi động lại → bố cục mở đầy đủ, có `layout.v1.bak.json`.

Tự động: `tests/e2e/build-drag.spec.ts` (viết trước, chạy đỏ trên `main` để tái hiện lỗi),
`tests/unit/layout-v2.test.ts`, `tests/unit/layout-migrate.test.ts`.

## US3 · Không chồng lấn, va chạm

1. Bench với 20 nhân viên: `npm run bench:fps -- --scenario crowd` → không có cảnh báo chồng lấn, FPS
   ≥ 60.
2. Mô phỏng nhanh: `npx vitest run tests/unit/crowd.test.ts` mô phỏng 10 phút với 20 agent trong văn
   phòng chật. Kiểm tra bất biến không chồng lấn, không đi vào ô bị chặn, và mọi lần chạm đều có
   `bump`.
3. Quan sát bằng mắt: dùng chế độ debug (`?debug=crowd`) để rút ngắn thời gian giữa các lần nghỉ, rồi
   xem hai nhân viên gặp nhau ở lối đi hẹp: một người nhường, có hiệu ứng khựng hoặc quay đầu, ghế rung
   nhẹ khi bị va. Tải lại thì ghế vẫn ở vị trí đã lưu.

## US4 · Kích thước văn phòng

1. Chế độ sắp xếp → đặt Chiều dài 24, Chiều rộng 18 → xem trước tức thì, lưu.
2. Kéo tay kéo cạnh đông thêm 3 m → nhãn hiển thị 27 m.
3. Nhập 5 hoặc 41 → báo lỗi, văn phòng không đổi.
4. Thu nhỏ khi có bàn ở sát cạnh đông → bị chặn, bàn nhấp nháy đỏ.
5. Tải lại → giữ kích thước. Ở 40 × 40 m với 20 nhân viên: `npm run bench:fps -- --floor 40x40` ≥ 60 FPS.
6. Góc nhìn thứ nhất (V) → đi được tới mọi góc của văn phòng mới.

## US5 · Chọn concept

1. Mở trang xem concept (`concepts/index.html`, chạy bằng `npx vite concepts`) hoặc link artifact riêng
   tư được gửi cho người dùng.
2. Người dùng xem 5 thẻ A–E, chọn một và có thể góp ý.
3. Ghi `concept-decision.md` với `status: chosen`. **Từ đây mới làm US6 và US7.**

## US6 · Concept và font mới

1. Đi qua checklist màn hình: văn phòng (toàn cảnh, góc nhìn thứ nhất), chat, tuyển nhân viên, quota,
   cài đặt, chế độ sắp xếp, danh sách project. Mỗi màn hình kiểm tra ở cả chế độ sáng và tối → không
   còn phong cách cũ (SC-010).
2. 4 trạng thái nhân viên phân biệt được trong concept mới.
3. Chặn mạng ngoài (Playwright `route('**', abort)` trừ `127.0.0.1`) → font vẫn đúng; câu thử
   "Đặng Thị Hương — Ưng ỡ ữ ỵ" không rơi về font hệ thống (`tests/e2e/fonts.spec.ts`).
4. `assets/LICENSES.md` liệt kê mọi font, HDRI, mô hình mới.

## US7 · Thành phố

1. Đổi lần lượt 5 thành phố ở chế độ ngày và đêm → toà nhà có cửa sổ, tầng, mái; công trình biểu tượng
   vẫn còn.
2. Trong góc nhìn mặc định, mọi phía quanh văn phòng là công viên, thấy ki-ốt cà phê; dãy phố chỉ ở xa.
   Xoay hoặc phóng xa: đếm được ≥ 2 quán cà phê và ≥ 2 quán ăn có biển hiệu, bàn ghế ngoài trời, đèn sáng
   khi trời tối.
3. Quan sát 30 giây ban ngày: thấy người đi bộ, chạy bộ hai chiều, nhóm tập thể dục, người ngồi ghế đá;
   xe hơi, xe máy, xe buýt chạy hai chiều không chồng nhau; ban đêm xe có đèn (SC-013). Cây có tán nhiều tầng,
   có cây ra hoa và hàng cây ven đường.
4. Bật tự động giảm chi tiết, chạy `npm run dev` và mở với `?throttle=1` (chỉ có tác dụng ở chế độ dev) để ép
   FPS thấp → thành phố giảm chi tiết trước văn phòng (mức Thấp bỏ vòng cao ốc xa). Để tìm phần tốn khung
   hình: `npm run bench:fps -- --off trees,traffic,people,city,kiosk`.

## Cổng chất lượng (Constitution)

```bash
npm run typecheck && npm run lint && npm test && npm run test:e2e
npm run test:leaks           # không token/email/nội dung chat trong log và file mới
npm run bench:fps            # ≥ 60 FPS trên máy tham chiếu (MacBook Pro M1 Pro, 1080p, Chrome)
```

Kiểm tra thêm: không có request nào ra ngoài trừ Open-Meteo (DevTools Network, lọc khác `127.0.0.1`).
Làm lại hướng dẫn cài đặt trên macOS: `npm install` vẫn ≤ 15 phút dù có thêm tài nguyên.
