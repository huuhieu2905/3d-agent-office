# Contract: Tương tác giao diện (UI contract)

Các hành vi người dùng nhìn thấy được và e2e test kiểm tra được. Ngưỡng và phím tắt là một phần của
contract.

## U-1 · Chế độ

| Chế độ | Bấm nhân viên | Kéo nhân viên | Bấm đồ vật | Kéo đồ vật | Kéo camera |
|---|---|---|---|---|---|
| Màn hình chính | Mở chat (1 lần bấm) | Không làm gì (camera xoay như thường) | Không làm gì | Không làm gì | ✅ |
| Chế độ sắp xếp | Không mở chat; chọn nhân viên (viền) | ✅ tới bàn | Chọn (viền) | ✅ khi đã chọn hoặc nhấn thẳng lên đồ vật | ✅ khi kéo vào chỗ trống |

## U-2 · Kéo (đồ vật và nhân viên)

- **Bắt đầu**: nhấn chuột lên đối tượng, di chuyển > **4 px**. Dưới ngưỡng đó là một lần bấm.
- **Trong lúc kéo**: camera bị khoá. Bóng xem trước bám con trỏ trên mặt sàn.
  - Đồ vật: màu xanh nếu hợp lệ, đỏ nếu không. Làm tròn 0,05 m. Giữ **Shift** để bám lưới 0,5 m.
  - Nhân viên: hình nhân viên mờ đi theo con trỏ. Bàn dưới con trỏ sáng xanh (trống) hoặc vàng (có
    người, sẽ đổi chỗ).
- **Thả**:
  - Đồ vật hợp lệ → dời tới đó. Không hợp lệ → về chỗ cũ.
  - Nhân viên lên bàn trống → gán bàn. Lên bàn có người → đổi chỗ. Chỗ khác → về bàn cũ.
- **Huỷ**: `Esc`, `pointercancel`, cửa sổ mất tiêu điểm → về vị trí cũ, không tạo bước undo.
- Mỗi lần thả thành công tạo **một** bước undo (`Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`).

## U-3 · Đồ vật đang chọn

- Viền sáng quanh đồ vật kèm thanh công cụ nhỏ: Xoay (`R`), Xoá (`Delete`/`Backspace`), Bỏ chọn (`Esc`).
- Bấm vào chỗ trống → bỏ chọn.
- Di chuyển bằng phím mũi tên: 0,05 m mỗi lần, giữ Shift thì 0,5 m.

## U-4 · Kích thước văn phòng

- Bảng sắp xếp có 2 ô số "Chiều dài (m)" và "Chiều rộng (m)", min 6, max 40, bước 0,5.
- Tay kéo ở giữa cạnh đông và cạnh nam của sàn, làm tròn 0,5 m. Đang kéo thì hiển thị nhãn kích thước.
- Giá trị không hợp lệ → ô số viền đỏ kèm thông báo "Từ 6 đến 40 m, bước 0,5 m". Văn phòng không đổi.
- Thu nhỏ bị chặn → các đồ vật chặn nhấp nháy đỏ, thông báo nêu số lượng. Nhấn vào thông báo để chọn
  lần lượt từng đồ vật.

## U-5 · Model picker

- Mở chat → picker hiển thị model theo data-model §2.
- Đổi model → lưu ngay (L2-3). Hiển thị "Đã lưu cho cuộc trò chuyện này" trong 1,5 giây.
- Model không khả dụng → picker có viền cảnh báo, ghi "<tên> không còn khả dụng — chọn model khác",
  nút gửi bị khoá cho tới khi chọn lại.

## U-6 · Cách e2e tìm phần tử

**Phần tử DOM** dùng `data-testid` (hằng số trong `tests/e2e/testids.ts`):
`build-toggle`, `floor-width-input`, `floor-depth-input`, `model-picker`, `model-unavailable`.

**Vật thể 3D** (sàn, đồ vật, nhân viên, bàn đích, tay kéo đổi kích thước) được vẽ trên canvas WebGL nên
không mang `data-testid`. E2E tìm chúng bằng:
- `window.__agentOffice.project(x, z, y)`: đổi một điểm trên sàn (mét, tính từ góc tây bắc) ra toạ độ trên
  trang, để nhấn và kéo đúng vật thể; `window.__agentOffice.arrange()` đọc trạng thái chế độ sắp xếp.
  Hook này chỉ có khi chạy dev hoặc khi trình duyệt bị điều khiển tự động (`navigator.webdriver`), không có
  trong bản production cho người dùng (T097).
- Thẻ tên `.tag` của nhân viên (theo tên conversation) để bấm hoặc kéo nhân viên.
- Tay kéo đổi kích thước là mesh có tên `resize-handle-east` / `resize-handle-south` trong `BuildGizmo.tsx`.
