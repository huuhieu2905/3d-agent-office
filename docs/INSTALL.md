# Cài đặt Agent Office (macOS, Linux)

Agent Office là một văn phòng 3D chạy trong trình duyệt, biến các conversation của **Antigravity App**
trên máy bạn thành nhân viên. Mọi thứ chạy **local**: không có Docker, không có máy chủ đám mây.

> **Hệ điều hành**: macOS 13 trở lên (Apple Silicon hoặc Intel), và Linux: **CachyOS x86_64** (xem
> [phần Linux](#linux)). Bản phân phối Linux khác có thể chạy được nhưng không được cam kết. Windows chưa có kế hoạch.

## Yêu cầu

| Thành phần | Phiên bản |
|---|---|
| Antigravity App | macOS: **2.29.0** (đã kiểm chứng cả 2.24.0); Linux: **2.29.1**. Đã đăng nhập |
| Node.js | **22** trở lên |
| Trình duyệt | Chrome, Edge hoặc Firefox bản mới (có WebGL 2) |
| git | có sẵn trên macOS (Xcode Command Line Tools); Linux: `sudo pacman -S git` |

## Các bước (khoảng 5–10 phút)

### 1. Cài Node.js 22 (bỏ qua nếu `node -v` đã ≥ 22)

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

Mở **terminal mới**, rồi chạy:

```bash
fnm install 22 && fnm default 22
node -v   # phải in ra v22.x
```

### 2. Tải mã nguồn và cài đặt

```bash
git clone <địa chỉ repo> agent-office
cd agent-office
./scripts/install.sh
```

Script sẽ kiểm tra Node, cài thư viện và build giao diện.

### 3. Chạy

1. **Mở Antigravity App** và đăng nhập.
2. Chạy:

   ```bash
   npm start
   ```

3. Trình duyệt tự mở `http://127.0.0.1:4317/#k=…`. Nếu không tự mở, hãy copy **đúng đường link** mà terminal in ra
   (đường link có mã phiên `#k=`, mỗi lần chạy một mã khác).

Terminal sẽ in `Antigravity App 2.29.0: connected` khi kết nối thành công.

## Linux

Đã kiểm chứng với Antigravity App **2.29.1** bản Linux (2026-11-10, feature `005-linux-support`). Bản App
khác sẽ hiện cảnh báo "chưa được kiểm chứng" nhưng vẫn dùng được.

- **Máy được cam kết**: CachyOS, CPU x86_64. Các bản phân phối khác (Ubuntu, Fedora…) và CPU ARM không được kiểm chứng.
- **Antigravity App** bản Linux, cài ở `/opt/Antigravity/`, chạy dưới **chính user của bạn** (không qua Flatpak/Snap).
- **Node.js ≥ 22**: `sudo pacman -S nodejs npm` (hoặc dùng `fnm` như bước 1).
- Không cần cài thêm công cụ hệ thống nào: hệ thống đọc `/proc` để tìm App.

Các bước 2 và 3 ở trên giống hệt macOS. Nếu trình duyệt không tự mở, copy đường link mà `npm start` in ra.

- **Dữ liệu** (bố cục, cài đặt) nằm ở `~/.local/share/agent-office/` (hoặc `$XDG_DATA_HOME/agent-office/`).
- **Hiệu năng 3D trên Linux chưa được đo.** Nếu văn phòng chậm, kiểm tra `chrome://gpu` xem trình duyệt có dùng
  tăng tốc phần cứng không.
- Cần gửi dòng lệnh của App khi báo lỗi? Luôn che cả hai khoá:

  ```bash
  ps -axww -o pid=,args= | grep '[l]anguage_server' | sed -E 's/(csrf_token|host_bridge_token)([= ])[^ ]+/\1\2<ĐÃ_CHE>/g'
  ```

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Banner "Chưa kết nối được Antigravity App" | Mở Antigravity App. Hệ thống tự kết nối trong vài giây, không cần tải lại trang. |
| Cảnh báo "Antigravity App x.y.z chưa được kiểm chứng" | Đã kiểm chứng: macOS **2.29.0**, **2.24.0**; Linux **2.29.1**. Bản khác vẫn chạy nhưng có thể thiếu tính năng. |
| Linux: "Cannot read the Antigravity App process info" | App đang chạy dưới user khác hoặc trong sandbox (Flatpak/Snap). Hãy chạy App và `npm start` bằng cùng một user, với bản App cài ở `/opt/Antigravity/`. |
| Banner "Thiếu mã phiên" | Bạn đã mở `http://127.0.0.1:4317` mà không có `#k=…`. Hãy dùng đúng đường link `npm start` in ra. |
| `EADDRINUSE` / cổng 4317 bận | Chạy với cổng khác: `AGENT_OFFICE_PORT=4400 npm start` |
| Trình duyệt không tự mở | Copy đường link trong terminal vào trình duyệt. |
| `npm start` báo không tìm thấy `node` | Mở terminal mới (để `fnm` có hiệu lực), hoặc chạy `eval "$(fnm env)"`. |
| Văn phòng giật, chậm | Bấm ⚙︎ → giảm "Mức chi tiết bối cảnh". Hệ thống cũng tự giảm khi máy chậm (có thể tắt trong cài đặt). Mức "Thấp" bỏ các toà cao ốc ở xa, giữ phố và quán. |
| Kéo đồ vật hoặc nhân viên không được | Phải bật chế độ sắp xếp (nút **Xây dựng**). Ngoài chế độ này, bấm vào nhân viên chỉ mở chat. |
| Không thu nhỏ được văn phòng | Có đồ vật nằm ở phần sẽ bị cắt; bấm vào thông báo "Không thu nhỏ được" để chọn lần lượt từng đồ vật và dời chúng vào trong. |
| `npm run test:e2e` rất chậm hoặc treo | E2E vẽ cảnh 3D trên GPU (Metal). Hãy chạy trên Mac thật, không qua máy ảo hoặc phiên SSH không có GPU. |
| Gõ `@` không gợi ý file | Conversation phải thuộc một project gắn thư mục. Tạo project bằng nút "+ Tạo project", rồi tuyển nhân viên trong project đó. |

## Dữ liệu và quyền riêng tư

- Bố cục văn phòng, chỗ ngồi, model đã chọn cho từng cuộc trò chuyện và cài đặt được lưu ở
  `~/Library/Application Support/agent-office/` (macOS) hoặc `~/.local/share/agent-office/` (Linux).
- Khi nâng cấp từ bản đầu tiên, bố cục cũ được tự chuyển sang định dạng mới; bản gốc được giữ ở
  `layout.v1.bak.json` trong cùng thư mục (không bao giờ bị ghi đè). Muốn quay lại bố cục cũ thì đổi tên file
  này thành `layout.json` khi hệ thống đang tắt.
- Hệ thống **không** lưu nội dung chat, mã xác thực hay email. Nội dung chat chỉ đọc trực tiếp từ Antigravity App.
- Server chỉ lắng nghe trên `127.0.0.1`, máy khác trong mạng không truy cập được.
- Kết nối ra Internet duy nhất là lấy dữ liệu thời tiết công khai (Open-Meteo). Font chữ, nhân vật, nội thất
  và cảnh vật đều đi kèm hệ thống, không tải từ mạng.

## Gỡ cài đặt

```bash
rm -rf agent-office "$HOME/Library/Application Support/agent-office"   # macOS
rm -rf agent-office "${XDG_DATA_HOME:-$HOME/.local/share}/agent-office"  # Linux
```

## Đã kiểm chứng

| Ngày | Máy | Kết quả |
|---|---|---|
| 2026-11-06 | MacBook Pro M1 Pro, macOS, Antigravity App 2.24.0 | Cài Node 22 qua `fnm`: khoảng 1 phút. `git clone` + `./scripts/install.sh` + `npm start` từ bản clone sạch: **6 giây** (npm cache có sẵn). Kết nối App thành công. |
| 2026-11-07 | MacBook Pro M1 Pro, macOS, Node 26.13 (Homebrew), Antigravity App 2.24.0 | Bản 002 (concept E+, có thêm gói font): `git clone` + `./scripts/install.sh` với **npm cache trống** (giả lập máy mới, tải khoảng 88 MB): **11 giây**. `npm start`: in `Antigravity App 2.24.0: connected`. Lần đầu thử bị lỗi build vì `.gitignore` đã bỏ qua `src/web/ui/build/`; đã sửa trước khi đo. |
| 2026-11-09 | MacBook Pro M1 Pro, macOS, Node 26.13 (Homebrew), Antigravity App 2.29.0 | Bản 003: `git clone` + `./scripts/install.sh` + `npm start` từ bản clone sạch: **10 giây** (npm cache có sẵn). `npm start` in `Antigravity App 2.29.0: connected`, không có cảnh báo phiên bản. |
| 2026-11-10 | MacBook Pro M1 Pro, macOS, Node 26.13.0, Antigravity App 2.29.0 | Bản 005 (thêm Linux): bản sao sạch của mã nguồn + `./scripts/install.sh` + `npm start`: **13 giây** (npm cache có sẵn). `npm start` in `Antigravity App 2.29.0: connected`, không có cảnh báo. macOS không bị ảnh hưởng. |

> Chưa kiểm chứng trên **một máy Mac khác**. Lần đo ngày 2026-11-07 dùng npm cache trống trên cùng máy để giả lập
> máy mới; thời gian thực tế phụ thuộc tốc độ mạng (khoảng 88 MB tải về, khoảng 370 MB sau khi giải nén).
