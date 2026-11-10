# Quickstart: Kiểm chứng phiên bản Linux (005)

Phần A chạy trên Mac. Phần B và C chạy trên máy CachyOS tham chiếu, với Antigravity App đang mở.
Khuyến nghị chạy Claude Code ngay trên máy CachyOS cho phần B và C.

## A. Trên Mac: không hồi quy

```bash
npm test          # gồm kiểm thử LinuxProcessFinder với cây /proc giả + check-guards
npm run typecheck
npm start         # vẫn in "Antigravity App <bản>: connected", không có cảnh báo mới
```

Kỳ vọng: toàn bộ kiểm thử qua (FR-015, FR-016, SC-007).

## B. Trên CachyOS: kết nối và rà soát chỉ đọc

```bash
git clone <repo> && cd <repo>
./scripts/install.sh      # chấp nhận Linux; nếu thiếu Node thì gợi ý pacman/fnm
npm run check:compat      # chỉ đọc
npm start
```

Kỳ vọng:
- `check:compat`: 18/18 lệnh nội bộ còn, bản 2.29.1 "CHƯA kiểm chứng", liệt kê trường thêm/bớt so
  với `app-2.29.0`. Ghi kết quả vào spec, mục "Kết quả rà soát Linux", bước 1.
- `npm start`: trình duyệt mở văn phòng (hoặc in địa chỉ để tự mở), nhân viên khớp App trong ≤ 10
  giây (SC-001). Có cảnh báo "Linux đang thử nghiệm" (research R5).
- Tắt App → văn phòng hiện mất kết nối; mở lại → tự kết nối. Lặp 5 lần (SC-004).

Nếu cần dán dòng lệnh App để gỡ lỗi, luôn che cả hai khoá:

```bash
ps -axww -o pid=,args= | grep '[l]anguage_server' | sed -E 's/(csrf_token|host_bridge_token)([= ])[^ ]+/\1\2<ĐÃ_CHE>/g'
```

## C. Trên CachyOS: kiểm chứng đọc/ghi rồi công nhận 2.29.1 cho Linux

```bash
npx tsx scripts/record-fixtures.ts     # tạo tests/contract/fixtures/app-2.29.1/ (đã loại thông tin cá nhân)
npm test                               # kiểm thử hợp đồng chạy cả trên fixture mới
npm run test:live                      # chat, xoá, độ trễ, duyệt quyền, project, câu hỏi; tự dọn
npm run test:leaks                     # 0 token/email/nội dung trong log và file (SC-008)
npx tsx scripts/record-fixtures.ts --sweep   # chắc chắn không còn conversation thử nghiệm
```

Kỳ vọng: tất cả qua (SC-002, SC-003). Khi đó, trong cùng một commit:
1. Thêm `{ version: '2.29.1', platforms: ['linux'], ... }` vào `versions.ts`.
2. Cập nhật `tests/contract/versions.test.ts`, `scripts/install.sh`, README, `docs/INSTALL.md`.
3. Chạy `/speckit-constitution` để ghi 2.29.1 (Linux) vào danh sách của Nguyên tắc II (PATCH).

## D. Cài đặt từ đầu (SC-005)

Trên CachyOS, xoá bản clone, bấm giờ: `git clone` → `./scripts/install.sh` → `npm start` → thấy văn
phòng. Kỳ vọng ≤ 15 phút. Ghi kết quả vào bảng kiểm chứng của `docs/INSTALL.md`.

## E. Dùng hằng ngày 1 tuần (SC-006)

Ghi lại mọi lỗi chỉ xảy ra trên Linux. Kỳ vọng: không có.
