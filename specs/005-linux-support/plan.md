# Implementation Plan: Phiên bản Linux

**Branch**: `005-linux-support` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-linux-support/spec.md`

## Summary

Cho hệ thống chạy trên Linux (CachyOS tham chiếu) và kết nối với Antigravity App bản Linux. Bước 0
đã cho thấy App Linux khởi động giống hệt bản macOS (spec, L1–L5), nên mã chỉ đổi ở **một chỗ**:
thêm `LinuxProcessFinder` đọc `/proc` để tìm tiến trình App và cổng đang nghe, đặt sau giao diện
`ProcessFinder` sẵn có. Kèm theo: danh sách phiên bản đã kiểm chứng ghi theo hệ điều hành, cảnh báo
"Linux đang thử nghiệm" dùng lại cảnh báo phiên bản, script cài và tài liệu cho Linux, rồi kiểm
chứng đọc/ghi với App 2.29.1 thật trên CachyOS. Không đo hiệu năng.

## Technical Context

**Language/Version**: TypeScript 6, Node.js ≥ 22 (không đổi)

**Primary Dependencies**: Không thêm. Dùng `node:fs/promises` để đọc `/proc`; `env-paths` và `open`
đã đa nền tảng

**Storage**: Không đổi. Trên Linux, dữ liệu riêng nằm ở `~/.local/share/agent-office` (theo `env-paths`)

**Testing**: Vitest (unit + contract), `test:live` và `test:leaks` trên App thật, `check-guards.sh`

**Target Platform**: macOS 13+ (giữ nguyên) và Linux: CachyOS x86_64 (máy tham chiếu: Intel CPU, AMD
RX 6900 XT), Antigravity App 2.29.1 bản Linux cài ở `/opt/Antigravity/`

**Project Type**: Ứng dụng web local + server Node làm cầu nối (không đổi)

**Performance Goals**: Trên Linux: độ trễ trạng thái ≤ 2 giây, kết nối ≤ 10 giây. FPS ngoài phạm vi

**Constraints**: Server chỉ nghe `127.0.0.1`; khoá kết nối chỉ trong bộ nhớ; không chạy lệnh ngoài để
tìm App trên Linux; không Docker

**Scale/Scope**: 1 file mã mới (~60 dòng), sửa 4 file mã, 1 script, 2 tài liệu, 1 guard

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Đối chiếu v2.2.0.

| Nguyên tắc | Đánh giá | Kết quả |
|---|---|---|
| I. App là nguồn sự thật | Không đổi luồng dữ liệu; Linux đọc cùng API | ✅ |
| II. Lớp kết nối cô lập | Mã Linux chỉ nằm trong `src/server/app-adapter/discovery/`; danh sách phiên bản thêm trường `platforms` ở đúng `versions.ts`; 2.29.1 chỉ thêm cho Linux sau khi có fixture + live test (quickstart C); guard (d) mở rộng bắt 2.29.1 | ✅ |
| III. Local-first, bảo mật | Không kết nối mạng mới; không ghi log `cmdline`; `test:leaks` chạy trên Linux | ✅ |
| IV. Giao theo đợt | Một đợt: kết thúc là dùng được hằng ngày trên CachyOS; macOS không hồi quy | ✅ |
| V. Trải nghiệm & hiệu năng | 60 FPS chỉ áp dụng macOS (v2.2.0); feature không động vào phần 3D | ✅ |
| VI. Cài đặt macOS và Linux | Chỉ cam kết CachyOS x86_64; cảnh báo thử nghiệm tới khi có bản Linux đã kiểm chứng (R5); hệ không hỗ trợ báo rõ (R6); install ≤ 15 phút đo trên CachyOS | ✅ |
| Cổng chất lượng | Đợt này chạm lớp kết nối và cài đặt → cổng 1, 2, 3, 5 chạy trên cả macOS và CachyOS (quickstart A–D); cổng 4 chỉ macOS và feature không đổi phần 3D | ✅ |

**Sau Phase 1**: thiết kế không thêm thư viện, lớp trừu tượng hay trạng thái mới. Vẫn đạt.

## Project Structure

### Documentation (this feature)

```text
specs/005-linux-support/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/process-finder.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/server/app-adapter/
├── discovery/
│   ├── process-linux.ts      # MỚI: LinuxProcessFinder (đọc /proc), contracts/process-finder.md
│   └── process-finder.ts     # SỬA: nhánh 'linux', thông báo hệ không hỗ trợ
├── versions.ts               # SỬA: trường platforms, isVerified/verifiedVersionList theo OS
└── connection.ts             # (không đổi: dùng tham số mặc định process.platform)
src/server/storage/json-store.ts   # SỬA chú thích đường dẫn Linux
src/server/main.ts                 # SỬA: thông điệp cảnh báo khi verifiedVersions rỗng (R5); web hiển thị message nên không đổi
scripts/
├── install.sh                # SỬA: chấp nhận Linux, gợi ý pacman/fnm
└── check-guards.sh           # SỬA: guard (d) bắt 2.x.y
tests/
├── contract/process-linux.test.ts    # MỚI: cây /proc giả (R3)
├── contract/versions.test.ts         # SỬA: theo platform
└── contract/fixtures/app-2.29.1/     # MỚI: ghi trên CachyOS (R8)
README.md, docs/INSTALL.md            # SỬA: phần Linux
```

**Structure Decision**: Giữ nguyên cấu trúc một dự án hiện có. Phần riêng của Linux nằm cạnh
`process-darwin.ts`, đúng chỗ Constitution VI đã chừa.

## Thứ tự thực hiện

1. **Mac**: `LinuxProcessFinder` + test cây `/proc` giả; nhánh `linux`; `platforms` trong
   `versions.ts`; thông điệp thử nghiệm; guard; install.sh; tài liệu. `npm test` qua trên Mac.
2. **CachyOS, chỉ đọc**: quickstart B. Ghi kết quả `check:compat` vào spec (bước 1). Nếu có lệnh nội
   bộ bị mất hay định dạng khác, dừng lại và bổ sung spec trước khi sửa tiếp.
3. **CachyOS, đọc/ghi**: quickstart C. Qua hết thì thêm 2.29.1 (linux) vào danh sách, cùng commit với
   tài liệu, script, test; sau đó `/speckit-constitution` (PATCH).
4. **CachyOS**: quickstart D (cài từ đầu) và E (dùng 1 tuần).

## Complexity Tracking

Không có vi phạm constitution cần giải trình.
