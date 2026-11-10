# Quickstart: kiểm chứng feature 004

## Điều kiện

- macOS, Antigravity App (bản trong danh sách đã kiểm chứng) đang mở.
- `npm install` đã chạy. Chạy hệ thống bằng `npm run dev`.
- Với các bước có xoá conversation: **chỉ dùng conversation có nhãn `[agent-office-test]`**
  (constitution, quy trình thử với App thật).

## 1. Kiểm thử tự động

```bash
npm run typecheck && npm run lint
npm test          # unit + contract + leaks + check-guards
npm run test:e2e  # Playwright với mock App, GPU thật
AGENT_OFFICE_LIVE=1 npm run test:live -- delete   # A4-1d, App thật
```

Kết quả mong đợi:
- `check-guards` báo ✓, trong đó guard (c) đã có `deleteConversation`.
- Các test mới đều pass:
  - **unit**: `site-nav`, `park-shops`, `outdoor-route`, `break-spots`, `routes-delete` (contract), `employee-behaviors` (outing, resting,
    recall ≤ 30 s), `fp-motion` (ra cửa, bị chặn ở tường, kính và rìa), `interactables`
    (`aimTarget`), `settings` (file cũ thiếu trường mới vẫn đọc được);
  - **contract**: A4-1a…c;
  - **e2e**: `legend.spec.ts`, `delete-employee.spec.ts`, `first-person.spec.ts` (mở rộng),
    `office-life.spec.ts`.

## 2. US1: panel chú giải

1. Tạo (hoặc dùng mock với) 20 dự án có nhân viên. Thu nhỏ cửa sổ còn cao 600 px.
   - Panel không tràn và cuộn được.
2. Bấm `legend-toggle`.
   - Panel chỉ còn "Dự án (20)".
3. Tải lại trang.
   - Panel vẫn thu gọn.
4. Làm nổi bật một dự án rồi thu gọn.
   - Nút có chấm màu của dự án đó.

## 3. US2: xoá nhân viên

1. Tạo conversation `[agent-office-test] xoá thử` từ văn phòng và đợi agent xong việc.
2. Mở chat với nhân viên đó, bấm 🗑, rồi bấm Huỷ.
   - Không có gì thay đổi.
3. Bấm 🗑 lần nữa, rồi xác nhận.
   - Nhân viên đi ra cửa, bàn trống lại.
   - Conversation không còn trong App.
   - Tải lại trang, nhân viên không quay lại.
4. Gửi một việc dài cho một conversation thử khác.
   - Trong lúc agent đang chạy, nút 🗑 bị khoá kèm lời nhắc.
5. Mở hộp xác nhận khi agent đang rảnh, sau đó gửi việc cho agent từ App, rồi bấm xác nhận.
   - Hệ thống báo "Agent vừa bắt đầu chạy…" và không xoá.
6. Đóng App, rồi thử xoá.
   - Báo lỗi kết nối, nhân viên vẫn ở lại.

## 4. US3: đời sống khi rảnh

1. Mở `?debug=crowd` (hoặc dùng `__agentOffice.setBreakInterval(15000)`) với ≥ 6 nhân viên rảnh.
2. Quan sát 30 phút (khoảng nghỉ đã rút ngắn).
   - Có người uống nước, ngồi hoặc nằm sofa, ra quán.
   - Không ai đi xuyên tường, không ai ngồi chồng lên nhau.
   - Số người ở ngoài không vượt `max(1, floor(n/3))` (SC-004).
3. Khi một nhân viên đang ngồi ở quán, gửi việc cho người đó.
   - Badge đổi trong ≤ 2 s.
   - Nhân viên chạy về bàn trong ≤ 30 s (SC-005).
4. Xoá sofa trong build mode khi đang có người nằm.
   - Người đó về bàn.

## 5. US4: góc nhìn thứ nhất

Nhấn V để vào góc nhìn thứ nhất.
1. Nhắm vào màn hình treo tường, nhấn E.
   - Màn hình bật.
2. Tải lại trang.
   - Màn hình vẫn bật.
3. Về toàn cảnh, bấm vào màn hình.
   - Màn hình tắt.
4. Ngồi sofa (E), nằm sofa (Shift+E), rồi đứng dậy bằng W.
5. Uống nước ở bình nước, rồi tưới cây.
   - Mỗi hiệu ứng < 3 s.
6. Đi ra cửa, tới một quán, rồi quay về bàn (SC-006, ≤ 2 phút).
   - Bị chặn bởi tường, kính, quán, thân cây và rìa công viên.
7. Ngắm vào một nhân viên đang ở quán và bấm.
   - Khung chat mở ra.

## 6. Cổng chất lượng (constitution)

- `npm run bench:fps`, kịch bản `outing` với số nhân viên tối đa: ≥ 60 FPS. Dùng GPU thật, lấy kết
  quả từ lần đo thứ hai (SC-007).
- `npm run test:leaks`: log của L4-1 không chứa tên conversation.
- Độ trễ trạng thái ≤ 2 s: `latency.live` vẫn pass.
- Hướng dẫn cài đặt không đổi (không thêm phụ thuộc), nhưng vẫn PHẢI chạy lại từ bản clone sạch
  trên macOS trong ≤ 15 phút (T061, Constitution VI).

## Kết quả kiểm chứng (2026-11-09, máy tham chiếu Apple M1 Pro, Chromium ANGLE/Metal)

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck`, `npm run lint` | sạch |
| `npm test` (unit + contract + leaks + guards) | 251 pass, 1 skip; check-guards ✓ (gồm (c) `deleteConversation`) |
| `npm run test:e2e` | 48/48 pass (3.4 phút) |
| `bench:fps` mặc định, high | 113.5 FPS trung bình, 1% thấp 88.5 |
| `bench:fps --scenario outing`, medium | 121.1 FPS, 1% thấp 100.0; 0 lần chồng nhau |
| `bench:fps --scenario outing`, high | 112.5 FPS, 1% thấp 90.9; 0 lần chồng nhau |
| `office-life.spec.ts` lặp 7 lần (khoảng nghỉ 6 s) | 6 pass, 1 quá thời gian (chưa tái hiện được) — sau khi sửa lỗi kẹt đối đầu trong lối hẹp |
| Live (T058, App 2.29.0 thật): 6 file, 8 test, gồm `delete` và `latency` | pass |
| Cài từ bản clone sạch (T061): `install.sh` + `npm start`, App 2.29.0 | 5 s (npm cache sẵn), kết nối OK, trang hiển thị không lỗi |
| Quickstart §2–§5 trên App thật (T060, script Playwright, chỉ xoá `[agent-office-test]`, cài đặt được khôi phục) | 14/14 sau khi sửa lỗi xoá khi chat đang mở; nhân viên rời văn phòng sau 13.6 s; thời tiết lúc chạy: nhiều mây |
| Sau khi chạy: conversation / project `[agent-office-test]` còn lại trong App | 0 / 0 |
| **Sau Convergence (T062–T066)** | |
| `npm test` | 254 pass, 4 skip (gồm 3 seed soak tuỳ chọn); guards ✓ |
| `npm run test:e2e` (T064) | 51/51 pass (3.6 phút), gồm đi bộ ra quán và về (16 s), bấm nhân viên ở quán mở chat, badge ≤ 2 s |
| Live, App 2.29.0 thật (T064) | 6 file, 8 test pass |
| Soak 30 phút × 3 seed, 8 nhân viên, nghỉ ~15 s (T066, `SOAK=1`) | 0 lần kẹt > 5 s, 0 lần chồng nhau, ra ngoài tối đa 2/2, đủ 4 loại nghỉ — sau 6 sửa lỗi crowd/brain (tasks.md Notes) |

