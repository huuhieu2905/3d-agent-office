# Data Model: Phiên bản Linux (005)

Feature không thêm dữ liệu lưu trữ mới. Chỉ có 2 thay đổi trong lớp kết nối App.

## VerifiedAppVersion (sửa, `src/server/app-adapter/versions.ts`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `version` | string | Giữ nguyên |
| `platforms` | `('darwin' \| 'linux')[]` | **Mới.** Hệ điều hành mà phiên bản đã được kiểm chứng. Không được rỗng |
| `verifiedOn` | ISO date | Giữ nguyên |
| `evidence` | string | Giữ nguyên |

**Quy tắc**:
- `isVerified(v, os)` đúng khi và chỉ khi có mục với `version === v` và `platforms` chứa `os`.
- Mỗi `version` xuất hiện tối đa một lần; muốn thêm hệ điều hành cho bản đã có thì thêm vào
  `platforms` (và cập nhật `evidence`).
- Một hệ điều hành chỉ được thêm vào `platforms` sau khi có dữ liệu mẫu và kiểm thử với App thật
  chạy qua trên hệ điều hành đó (Constitution II).

**Giá trị sau feature**:

| version | platforms | evidence |
|---|---|---|
| 2.29.1 | linux | specs/005-linux-support (thêm ở phần C của quickstart) |
| 2.29.0 | darwin | specs/003-antigravity-2-29-compat |
| 2.24.0 | darwin | specs/001-3d-agent-office |

## Trạng thái kết nối (không đổi kiểu, `src/shared/domain.ts`)

`{ kind: 'connected', appVersion, versionSupported, verifiedVersions }` giữ nguyên. Trên Linux,
`verifiedVersions` là danh sách lọc theo `linux`. Danh sách rỗng nghĩa là "Linux đang thử nghiệm"
(research R5).

## LanguageServerProcess (không đổi)

`{ pid, args }`. Trên Linux, `args` lấy từ `/proc/<pid>/cmdline`, tách theo `\0`.
