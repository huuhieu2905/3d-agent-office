# Agent Office

Biến các conversation của **Antigravity App** thành **nhân viên trong một văn phòng 3D**. Bạn là sếp:
nhìn là biết ai đang làm, ai rảnh, ai đang chờ bạn. Bấm 1 lần vào nhân viên để trò chuyện, giao việc,
dừng agent hoặc "tuyển" nhân viên mới.

**Tính năng**
- 🧑‍💼 Mỗi conversation là một nhân viên robot, chuyển động theo trạng thái thật: gõ phím khi làm, chống
  cằm khi nghĩ, giơ tay khi **chờ sếp duyệt**, ôm đầu khi lỗi, và thỉnh thoảng vươn vai hoặc đi uống nước
  khi rảnh
- 💬 Bấm 1 lần để chat như trong App: lệnh `/`, nhắc file `@`, chọn model (kèm % quota), dừng agent, duyệt
  hoặc từ chối quyền
- 📁 Tạo project gắn thư mục trên máy, rồi "tuyển nhân viên" (conversation mới) vào project
- 📊 Màn hình quota treo tường và bảng quota chi tiết
- 🛠 Tự xây văn phòng: bàn ghế, tường, vách kính, cây; kéo nhân viên đổi chỗ
- 🌳 Văn phòng giữa công viên, chọn 1 trong 5 thành phố (Hà Nội, TP.HCM, Singapore, Tokyo, New York),
  **thời tiết thật**, chế độ sáng/tối, 3 mức chi tiết
- 🚶 Góc nhìn thứ nhất (phím <kbd>V</kbd>): đi lại trong văn phòng, nhắm vào nhân viên và bấm để chat

- Chạy **local** trên macOS, giao diện trong trình duyệt
- Kết nối trực tiếp với Antigravity App 2.24.0 trên cùng máy
- Không lưu nội dung chat, không gửi dữ liệu ra ngoài

👉 **Cài đặt**: xem [docs/INSTALL.md](docs/INSTALL.md)

| Nền tảng | Trạng thái |
|---|---|
| macOS 13+ | ✅ hỗ trợ |
| Linux | ⏳ hoãn, sẽ bàn sau |
| Windows | ✗ ngoài phạm vi |

## Dành cho người phát triển

```bash
npm run dev          # server + Vite dev server
npm test             # unit + contract + leak tests + static guards
npm run test:e2e     # Playwright với App giả lập
npm run bench:fps    # benchmark 60 FPS (SC-004)
AGENT_OFFICE_LIVE=1 npm run test:live   # test với App thật (tự dọn conversation [agent-office-test])
```

Tài liệu thiết kế: `specs/001-3d-agent-office/`. Nguyên tắc dự án: `.specify/memory/constitution.md`.
Giấy phép tài nguyên 3D: `assets/LICENSES.md`.
