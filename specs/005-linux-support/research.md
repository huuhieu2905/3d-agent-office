# Research: Phiên bản Linux (005)

Dữ liệu đầu vào: rà soát mã 2026-11-10 (spec, bảng H1–H10) và kết quả bước 0 trên máy CachyOS
(spec, bảng L1–L5). Không còn mục NEEDS CLARIFICATION.

## R1. Tìm tiến trình App trên Linux

- **Decision**: Đọc `/proc/<pid>/cmdline` của mọi tiến trình, tách tham số theo ký tự `\0`, rồi dùng
  lại nguyên `isAppLanguageServer()` trong `discovery/args.ts`.
- **Rationale**: Bước 0 cho thấy tham số khởi động bản Linux giống hệt bản macOS (L2), nên chỉ đổi
  cách *đọc* danh sách tiến trình. `/proc` là giao diện ổn định của nhân Linux, có trên mọi bản phân
  phối, không phụ thuộc công cụ nào (spec, edge case về rolling release). `cmdline` tách tham số
  chính xác, tốt hơn tách theo khoảng trắng như `ps`. Không chạy lệnh ngoài nên không có shell.
- **Alternatives considered**: `ps -axww -o pid=,args=` (giống macOS, dùng lại được gần hết mã):
  bị loại vì phụ thuộc `procps-ng` và định dạng đầu ra; khác biệt mã chỉ vài dòng.

## R2. Liệt kê cổng App đang nghe trên Linux

- **Decision**: Đọc các inode socket của tiến trình từ symlink `/proc/<pid>/fd/*` (dạng
  `socket:[12345]`), rồi đối chiếu với `/proc/net/tcp` (và `/proc/net/tcp6`): lấy dòng có trạng thái
  `0A` (LISTEN), địa chỉ local là `127.0.0.1` (`0100007F`), inode thuộc tập trên. Cổng là phần hex sau
  dấu `:`. Trả về danh sách cổng tăng dần, như bản macOS.
- **Rationale**: Không phụ thuộc `lsof` (không chắc có trên CachyOS) hay `ss` (định dạng đầu ra có
  thể đổi). Người dùng chỉ đọc được `fd` của tiến trình chính mình, đúng trường hợp App chạy cùng
  user. Cổng dùng chung với tiến trình giao diện (L4) cũng được trả về; `probeApiPort()` đã thử
  lần lượt và bỏ qua cổng không trả lời API, nên không cần lọc thêm.
- **Alternatives considered**: `ss -ltnpH` + regex `pid=<pid>`: ngắn tương đương nhưng phụ thuộc
  iproute2 và định dạng văn bản. `lsof`: không có sẵn trên bản cài CachyOS mặc định.
- **Lỗi quyền**: nếu `/proc/<pid>/fd` không đọc được (App chạy dưới user khác, hoặc sandbox), ném
  lỗi có lý do cụ thể. `connection.ts` đã bắt lỗi và đưa `message` vào trạng thái
  `error: unreachable`, nên người dùng thấy lý do thay vì "port not answering". Hỗ trợ các kiểu cài
  này nằm ngoài phạm vi.

## R3. Kiểm thử phần Linux trên máy Mac (FR-016)

- **Decision**: `LinuxProcessFinder` nhận thư mục gốc `/proc` qua constructor (mặc định `/proc`).
  Kiểm thử dựng một cây `/proc` giả trong thư mục tạm: `cmdline` của App (token giả), một tiến
  trình không liên quan, symlink `fd` tới `socket:[inode]`, và `net/tcp` chép từ máy CachyOS (đã
  thay địa chỉ không phải loopback).
- **Rationale**: Chạy được trên macOS trong `npm test`, bắt hồi quy mà không cần máy Linux.
- **Alternatives considered**: Mock `fs`: dễ lệch với hành vi thật của symlink; cây thư mục thật
  ngắn hơn và đúng hơn.

## R4. Danh sách phiên bản đã kiểm chứng theo hệ điều hành (Constitution II v2.2.0)

- **Decision**: Thêm trường `platforms: ('darwin' | 'linux')[]` vào `VerifiedAppVersion`.
  `isVerified(version, platform = process.platform)` và `verifiedVersionList(platform)` lọc theo hệ
  điều hành. Hai mục hiện có gán `['darwin']`. Mục `2.29.1` cho `['linux']` chỉ được thêm sau khi
  bước kiểm chứng trên CachyOS chạy qua (quickstart, phần C).
- **Rationale**: Constitution yêu cầu ghi rõ hệ điều hành. Thêm một trường là thay đổi nhỏ nhất; nơi
  gọi (`connection.ts`, `index.ts`) giữ nguyên nhờ tham số mặc định.
- **Alternatives considered**: Hai danh sách riêng: vi phạm "một nơi duy nhất". Khoá theo cặp
  `version@os`: phức tạp hơn mà không lợi gì.

## R5. Cảnh báo "đang thử nghiệm" trên Linux (Constitution VI v2.2.0)

- **Decision**: Không thêm trạng thái mới. Khi Linux chưa có phiên bản kiểm chứng, mọi kết nối trên
  Linux có `versionSupported: false` và `verifiedVersions: []`. Cảnh báo phiên bản hiện có (log
  terminal + giao diện) được sửa để: khi `verifiedVersions` rỗng, nói "Linux đang ở giai đoạn thử
  nghiệm, chưa có phiên bản App nào được kiểm chứng trên hệ điều hành này".
- **Rationale**: Dùng lại đường cảnh báo sẵn có. Tự hết cảnh báo khi mục Linux được thêm vào danh
  sách, không cần cờ riêng.
- **Alternatives considered**: Cờ `experimentalPlatform` trong trạng thái kết nối: thêm trường mà
  thông tin đã suy ra được từ danh sách rỗng.

## R6. Hệ điều hành không hỗ trợ (FR-009)

- **Decision**: `createProcessFinder()` thêm nhánh `linux`. Thông báo lỗi cho hệ khác đổi thành nêu
  rõ "chỉ hỗ trợ macOS và Linux".
- **Rationale**: Đã có sẵn chỗ rẽ nhánh duy nhất (Constitution VI).

## R7. Script cài đặt, đường dẫn dữ liệu, mở trình duyệt

- **Decision**:
  - `scripts/install.sh`: chấp nhận `Darwin` và `Linux`. Trên Linux, gợi ý cài Node bằng
    `sudo pacman -S nodejs npm` (CachyOS/Arch có Node mới), giữ `fnm` làm cách thay thế. Không cần
    kiểm tra công cụ hệ thống nào khác (R1, R2 không dùng lệnh ngoài).
  - Thư mục dữ liệu: `env-paths` đã cho `~/.local/share/agent-office` trên Linux (tôn trọng
    `XDG_DATA_HOME`). Chỉ sửa chú thích trong `json-store.ts` và ghi vào hướng dẫn.
  - Mở trình duyệt: gói `open` dùng `xdg-open` trên Linux, và lỗi đã được bỏ qua (`main.ts`). Địa
    chỉ vẫn được in ra terminal.
- **Rationale**: Những phần này đã đa nền tảng; chỉ cần kiểm chứng và viết tài liệu.

## R8. Dữ liệu mẫu từ App Linux 2.29.1 (Constitution II)

- **Decision**: Chạy `scripts/record-fixtures.ts` trên CachyOS, tạo `tests/contract/fixtures/app-2.29.1/`.
  Thêm một tệp `SOURCE.md` trong thư mục đó ghi "ghi từ Linux (CachyOS), 2026-11-xx".
- **Rationale**: Script đã tự đặt tên thư mục theo phiên bản và đã loại thông tin cá nhân. Không cần
  hậu tố hệ điều hành vì chưa có bản 2.29.1 nào từ macOS; nếu sau này có, thêm hậu tố lúc đó.

## R9. Static guard về chuỗi phiên bản

- **Decision**: Sửa guard (d) trong `scripts/check-guards.sh` từ `\b2\.(24|29)\.0\b` thành
  `\b2\.(24|29)\.[0-9]+\b` để bắt cả 2.29.1.
- **Rationale**: Constitution II: chuỗi phiên bản chỉ được nằm trong `versions.ts`.

## R10. Khoá phụ `--host_bridge_token` (L5)

- **Decision**: Không đổi mã chạy. Tham số khởi động không bao giờ được ghi log (chú thích trong
  `args.ts`), và `redact.ts` không nhận toàn bộ dòng lệnh. Chỉ dùng lệnh che cả hai khoá trong
  quickstart và tài liệu.
- **Rationale**: Không có đường nào đưa khoá này ra ngoài; thêm mã che là phòng thủ cho trường hợp
  không tồn tại.

## Ngoài phạm vi (theo spec Clarifications)

Đo FPS và tối ưu hiệu năng trên Linux; cảnh báo render phần mềm; bản phân phối khác CachyOS; CPU ARM;
gói cài `.deb`, AppImage hay Flatpak.
