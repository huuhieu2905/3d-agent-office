# Contract: ProcessFinder trên Linux

Giao diện có sẵn (`src/server/app-adapter/discovery/process-finder.ts`), không đổi:

```ts
interface ProcessFinder {
  findLanguageServer(): Promise<LanguageServerProcess | null>;
  listListeningPorts(pid: number): Promise<number[]>;
}
```

Bản cài đặt mới: `LinuxProcessFinder` (`discovery/process-linux.ts`), constructor nhận
`procRoot = '/proc'`. `createProcessFinder('linux')` trả về nó.

## findLanguageServer()

| Đầu vào (cây `/proc`) | Kết quả |
|---|---|
| Có tiến trình mà `cmdline` (tách `\0`) thoả `isAppLanguageServer()` | `{ pid, args }` của tiến trình đầu tiên tìm thấy |
| Chỉ có `language_server` của IDE/CLI (thiếu `--app_data_dir antigravity` hoặc `--subclient_type hub`) | `null` |
| Không có tiến trình nào khớp | `null` |
| `cmdline` của một tiến trình không đọc được (đã thoát, không có quyền) | Bỏ qua tiến trình đó, không ném lỗi |
| Không đọc được thư mục `procRoot` | Ném lỗi (lớp kết nối chuyển sang `error`) |

## listListeningPorts(pid)

| Đầu vào | Kết quả |
|---|---|
| `fd` của `pid` trỏ tới socket có inode trùng dòng `net/tcp` trạng thái `0A`, địa chỉ `0100007F` | Các cổng đó, tăng dần, không trùng |
| Socket nghe trên địa chỉ khác `127.0.0.1` | Không trả về |
| Socket trạng thái khác LISTEN | Không trả về |
| Socket thuộc tiến trình khác | Không trả về |
| `/proc/<pid>/fd` không đọc được (không có quyền, sandbox) | Ném lỗi `Cannot read the Antigravity App process info (different user or sandboxed install?)` để lớp kết nối hiện lý do. Không đưa `pid` hay đường dẫn vào thông báo |

Ví dụ thật từ CachyOS (bước 0): 3 cổng `127.0.0.1` → trả về cả 3; `probeApiPort()` chọn cổng trả
lời API.

## Không được làm

- Không chạy lệnh ngoài, không dùng shell.
- Không ghi log `args` hay bất kỳ giá trị nào lấy từ `cmdline` (chứa `--csrf_token`,
  `--host_bridge_token`).
