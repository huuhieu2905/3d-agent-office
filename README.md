# Agent Office

Biến các conversation của **Antigravity App** thành **nhân viên trong một văn phòng 3D**. Bạn là sếp:
nhìn là biết ai đang làm, ai rảnh, ai đang chờ bạn. Bấm 1 lần vào nhân viên để trò chuyện, giao việc,
dừng agent hoặc "tuyển" nhân viên mới.

**Tính năng**

- 🧑‍💼 Mỗi conversation là một nhân viên (nhân vật hoạt hình 3D, concept **Soft Studio · Sài Gòn**), chuyển
  động theo trạng thái thật: gõ phím khi làm, vẫy tay khi **chờ sếp duyệt**, lắc đầu khi lỗi, và thỉnh
  thoảng vươn vai hoặc đi uống nước khi rảnh. Nhân viên không bao giờ đứng chồng lên nhau: họ nhường đường,
  khựng lại khi va vào nhau hoặc vào đồ vật
- 💬 Bấm 1 lần để chat như trong App: lệnh `/`, nhắc file `@`, chọn model (kèm % quota), dừng agent, duyệt
  hoặc từ chối quyền. **Model bạn chọn được nhớ riêng cho từng cuộc trò chuyện**
- 📁 Tạo project gắn thư mục trên máy, rồi "tuyển nhân viên" (conversation mới) vào project
- 📊 Màn hình quota treo tường và bảng quota chi tiết
- 🛠 Chế độ sắp xếp (nút **Xây dựng**): bấm một đồ vật để chọn, giữ chuột kéo tới bất kỳ chỗ nào (bước 5 cm,
  giữ <kbd>Shift</kbd> để bám lưới 0,5 m, phím mũi tên dời 5 cm, <kbd>R</kbd> xoay, <kbd>Delete</kbd> xoá,
  <kbd>Esc</kbd> huỷ thao tác kéo); kéo nhân viên thả vào bàn để xếp chỗ hoặc đổi chỗ; đổi kích thước văn
  phòng 6–40 m (ô nhập hoặc kéo cạnh), công viên tự giãn theo
- 🌳 Văn phòng giữa công viên (cây phượng, hàng dừa, ki-ốt cà phê, người đi bộ, chạy bộ, tập thể dục); phố
  với quán cà phê, quán ăn, xe hơi, xe máy, xe buýt ở xa phía sau. Chọn 1 trong 5 thành phố (Hà Nội, TP.HCM,
  Singapore, Tokyo, New York), **thời tiết thật**, chế độ sáng/tối, 3 mức chi tiết
- 🚶 Góc nhìn thứ nhất (phím <kbd>V</kbd>): đi lại trong văn phòng, nhắm vào nhân viên và bấm để chat

- Chạy **local** trên macOS, giao diện trong trình duyệt
- Kết nối trực tiếp với Antigravity App trên cùng máy (đã kiểm chứng 2.29.0 và 2.24.0)
- Không lưu nội dung chat, không gửi dữ liệu ra ngoài

👉 **Cài đặt**: xem [docs/INSTALL.md](docs/INSTALL.md)

| Nền tảng  | Trạng thái          |
| --------- | ------------------- |
| macOS 13+ | ✅ hỗ trợ           |
| Linux     | ⏳ hoãn, sẽ bàn sau |
| Windows   | ✗ ngoài phạm vi     |

## Dành cho người phát triển

```bash
npm run dev          # server + Vite dev server
npm test             # unit + contract + leak tests + static guards
npm run test:e2e     # Playwright với App giả lập (chạy trên GPU, cần một Mac thật)
npm run bench:fps    # benchmark 60 FPS (SC-004); thêm --scenario crowd, --floor 40x40, --off trees,city…
AGENT_OFFICE_LIVE=1 npm run test:live   # test với App thật (tự dọn conversation [agent-office-test])
```

Tài liệu thiết kế: `specs/001-3d-agent-office/`, `specs/002-realistic-ui-refresh/` (concept đã chọn:
`concept-decision.md`). Nguyên tắc dự án: `.specify/memory/constitution.md`. Giấy phép font và tài nguyên:
`assets/LICENSES.md`.
