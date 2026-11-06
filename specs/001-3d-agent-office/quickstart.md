# Quickstart & Validation Guide: Văn phòng 3D cho agent

**Feature**: `001-3d-agent-office` | **Date**: 2026-11-06

Đây là hướng dẫn **chạy và kiểm chứng** từ đầu đến cuối. Hướng dẫn cài đặt chính thức cho người
dùng cuối (`docs/INSTALL.md`) sẽ được viết trong quá trình triển khai, dựa trên các bước dưới đây.

## Yêu cầu

- macOS 13+ (Apple Silicon hoặc Intel). Linux: hoãn
- **Antigravity App 2.24.0** đã cài, đã đăng nhập và **đang mở**
- Trình duyệt Chrome, Edge hoặc Firefox bản mới có WebGL 2
- **Node.js ≥ 22**. Nếu chưa có:
  `curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22`

## Cài đặt và chạy (mục tiêu ≤ 15 phút, SC-005)

```bash
git clone <repo> agent-office && cd agent-office
./scripts/install.sh        # kiểm tra Node, chạy npm ci, build giao diện
npm start                   # khởi động server 127.0.0.1:4317 và tự mở trình duyệt
```

Kết quả mong đợi:
- Terminal in `Agent Office running at http://127.0.0.1:4317/#k=…` và `Antigravity App 2.24.0: connected`.
- Trình duyệt mở văn phòng 3D với bố cục mặc định.

## Kịch bản kiểm chứng

Mỗi kịch bản ứng với một user story trong `spec.md`. Chạy theo thứ tự đợt.

### V1. Nhân viên theo trạng thái thật (US1, SC-002)

1. Trong App, tạo conversation `[agent-office-test] status` và gửi: "Write a 300-word story".
2. Trong hệ thống, kiểm tra **một nhân viên mới** đi vào bàn trống, rồi chuyển sang `working` hoặc
   `thinking` trong ≤ 2 giây.
3. Khi agent xong, nhân viên chuyển về `idle` trong ≤ 2 giây.
4. Đóng App, kiểm tra văn phòng chuyển sang `disconnected`. Mở lại App, kiểm tra hệ thống tự kết nối
   lại trong ≤ 10 giây (SC-010).

### V2. Chat bằng 1 lần bấm (US2, SC-003)

1. Bấm **1 lần** vào nhân viên ở V1, kiểm tra khung chat mở với đủ lịch sử.
2. Gửi "Count from 1 to 5". Kiểm tra tin nhắn hiện trong **App** như tin của người dùng, và câu trả
   lời hiện dần.
3. Gửi "Write a long essay", rồi bấm **Dừng**. Kiểm tra agent dừng trong ≤ 3 giây, cả ở hệ thống lẫn
   App.
4. Đổi model và gửi tiếp. Kiểm tra lượt mới dùng đúng model.
5. "Tuyển nhân viên mới" với yêu cầu "[agent-office-test] hello". Kiểm tra conversation xuất hiện
   trong App.

### V3. `/`, `@` và duyệt quyền (US3)

1. Gõ `/`, kiểm tra danh sách trùng với danh sách trong App (`/plan`, `/goal`, skill…).
2. Gửi `/antigravity-guide what is a skill?`. Kiểm tra agent đọc skill.
3. Gõ `@` và vài ký tự tên một file trong workspace, chọn file, gửi "summarize". Kiểm tra trong App
   tin nhắn có mục nhắc tới file.
4. Bật chế độ hỏi quyền trong App, yêu cầu agent chạy một lệnh. Kiểm tra nhân viên chuyển
   `waiting_for_boss`. Bấm **Cho phép** trong hệ thống, kiểm tra lệnh chạy.

### V4. Quota (US4, SC-008)

1. Bấm vào màn hình quota trên tường. Đối chiếu gói tài khoản, % còn lại và thời điểm reset của từng
   nhóm với App.
2. Chạy một lượt agent, kiểm tra số liệu cập nhật mà không cần tải lại.

### V5. Xây văn phòng (US5)

1. Vào chế độ xây dựng, thêm 2 bàn và 1 vách kính, kéo một nhân viên sang bàn mới.
2. Thử đặt một bàn chồng lên bàn khác, kiểm tra hệ thống từ chối.
3. Tắt server, chạy lại `npm start`, kiểm tra bố cục còn nguyên.

### V6. Công viên, thành phố, thời tiết (US6)

1. Đổi lần lượt 5 thành phố, kiểm tra cảnh phía xa đổi theo.
2. Đối chiếu hiệu ứng thời tiết với thời tiết thật của thành phố (ví dụ trang open-meteo.com).
3. Ngắt mạng Internet, kiểm tra cảnh dùng trời quang, chat vẫn hoạt động.
4. Bật chế độ tối, tải lại trang, kiểm tra lựa chọn được giữ.

### V7. Góc nhìn thứ nhất (US7)

1. Chuyển sang góc nhìn thứ nhất, đi tới một bàn, kiểm tra không xuyên qua tường.
2. Bấm vào nhân viên, kiểm tra khung chat mở.

### V8. Cài đặt trên máy khác (US8, SC-005)

1. Trên một máy macOS có App, người mới làm theo `docs/INSTALL.md`, có bấm giờ. Kết
   quả phải ≤ 15 phút.

## Cổng chất lượng tự động

```bash
npm test                     # unit + contract test của adapter (fixture App 2.24.0) + scripts/check-guards.sh
npm run test:e2e             # Playwright với App giả lập (gồm resilience: App đóng, đổi cổng, kết nối lại ≤ 10 giây)
npm run test:leaks           # quét log và thư mục cấu hình tìm token, email, nội dung (SC-009)
AGENT_OFFICE_LIVE=1 npm run test:live   # tuỳ chọn: chạy với App thật, tự dọn conversation [agent-office-test]
AGENT_OFFICE_LIVE=1 npm run test:live -- latency   # cổng chất lượng 2: p95 độ trễ ≤ 2 giây, khớp trạng thái ≥ 99% (≥ 10 phút)
npm run bench:fps            # mở trang benchmark 20 nhân viên trong 60 giây, in FPS trung bình và p1 (SC-004: ≥ 60)
```

## Dọn dẹp sau kiểm chứng

- Xoá trong App các conversation có tiền tố `[agent-office-test]` (hoặc để `test:live` tự dọn).
- Dữ liệu riêng của hệ thống nằm ở `~/Library/Application Support/agent-office/`.
