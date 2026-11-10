---

description: "Task list for 005-linux-support"
---

# Tasks: Phiên bản Linux

**Input**: Design documents from `/specs/005-linux-support/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/process-finder.md, quickstart.md

**Tests**: Có. Spec FR-016 yêu cầu kiểm thử phần tìm App trên Linux chạy được trên Mac; Constitution II
yêu cầu fixture + kiểm thử với App thật trước khi công nhận phiên bản.

**Organization**: Theo user story của spec (US1, US2, US3). US4 (hiệu năng) đã bị bỏ theo Clarifications.

**Nơi chạy**: 🍎 = máy Mac phát triển, 🐧 = máy CachyOS tham chiếu (App Linux đang mở). Task 🐧 nên làm
bằng Claude Code chạy trên chính máy CachyOS.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1, US2, US3

---

## Phase 1: Setup

- [X] T001 🍎 Trên branch `005-linux-support`, chạy `npm test` và `npm run typecheck` để có mốc xanh trước khi sửa (ghi số test pass vào phần ghi chú cuối `specs/005-linux-support/tasks.md`)

---

## Phase 2: Foundational (chặn mọi user story)

**Purpose**: Danh sách phiên bản theo hệ điều hành (data-model.md, research R4) và guard phiên bản (R9).

- [X] T002 🍎 Trong `src/server/app-adapter/versions.ts`: thêm trường `platforms: ('darwin' | 'linux')[]` vào `VerifiedAppVersion` ("Không được rỗng"); gán `platforms: ['darwin']` cho 2.29.0 và 2.24.0; đổi chữ ký thành `isVerified(version: string, platform: NodeJS.Platform = process.platform)` (đúng khi và chỉ khi có mục `version === v` và `platforms` chứa `platform`) và `verifiedVersionList(platform: NodeJS.Platform = process.platform)` (chỉ các bản có `platform`, mới nhất trước). Không sửa nơi gọi trong `connection.ts` và `index.ts` (dùng tham số mặc định). **Chưa** thêm 2.29.1
- [X] T003 🍎 Sửa `tests/contract/versions.test.ts` cho chữ ký mới, luôn truyền platform tường minh để test chạy giống nhau trên Mac và Linux: `isVerified('2.29.0','darwin')` đúng, `isVerified('2.29.0','linux')` sai, `verifiedVersionList('linux')` là `[]`, `verifiedVersionList('win32')` là `[]`; mỗi mục có `platforms` không rỗng, chỉ gồm `darwin`/`linux`; mỗi `version` xuất hiện tối đa một lần
- [X] T004 [P] 🍎 Trong `scripts/check-guards.sh`, guard (d): đổi regex `\b2\.(24|29)\.0\b` thành `\b2\.(24|29)\.[0-9]+\b` và giữ ngoại lệ `src/server/app-adapter/versions.ts`

**Checkpoint**: `npm test` xanh trên Mac.

---

## Phase 3: User Story 1 - Mở văn phòng trên Linux và thấy nhân viên thật (Priority: P1) 🎯 MVP

**Goal**: Trên CachyOS, hệ thống tự tìm App Linux, kết nối, hiện nhân viên đúng trạng thái, tự kết nối lại.

**Independent Test**: quickstart.md phần B.

### Tests for User Story 1

- [X] T005 [P] [US1] 🍎 Tạo `tests/contract/process-linux.test.ts`: dựng cây `/proc` giả trong thư mục tạm (`mkdtemp`) theo mọi dòng của `specs/005-linux-support/contracts/process-finder.md`: (a) tiến trình App có `cmdline` nối bằng `\0` giống dòng lệnh thật ở spec L2 với `--csrf_token FAKE` và `--host_bridge_token=FAKE`, exe `/opt/Antigravity/resources/bin/language_server`; (b) `language_server` thiếu `--subclient_type hub` → bị bỏ qua; (c) tiến trình không liên quan; (d) một thư mục pid không có `cmdline` → bỏ qua, không ném lỗi; (e) `fd/` có symlink `socket:[inode]` và một symlink tới file thường; (f) `net/tcp` có: 3 dòng LISTEN (`0A`) trên `0100007F` thuộc inode của App, 1 dòng LISTEN trên `00000000` (0.0.0.0), 1 dòng ESTABLISHED (`01`), 1 dòng LISTEN thuộc inode tiến trình khác; `net/tcp6` rỗng (chỉ dòng tiêu đề). Kỳ vọng: `findLanguageServer()` trả đúng pid + args; `listListeningPorts(pid)` trả đúng 3 cổng tăng dần; pid có `fd/` nhưng không đọc được (tạo bằng `chmod 000`) → `listListeningPorts` ném lỗi đúng thông điệp trong contract và thông điệp không chứa pid; `procRoot` không tồn tại → `findLanguageServer()` ném lỗi
- [X] T006 [US1] 🍎 Trong `tests/contract/process-linux.test.ts` (cùng file T005, nên làm sau T005): `createProcessFinder('linux')` trả `LinuxProcessFinder`; `createProcessFinder('win32')` ném lỗi có chứa "macOS" và "Linux"

### Implementation for User Story 1

- [X] T007 [US1] 🍎 Tạo `src/server/app-adapter/discovery/process-linux.ts`: `export class LinuxProcessFinder implements ProcessFinder`, constructor `(private readonly procRoot = '/proc')`. `findLanguageServer()`: `readdir(procRoot)` (lỗi thì ném), lọc tên toàn số, đọc `<pid>/cmdline`, `split('\0').filter(Boolean)`, trả tiến trình đầu tiên thoả `isAppLanguageServer()` từ `./args`; lỗi đọc từng pid thì bỏ qua. `listListeningPorts(pid)`: `readdir(<pid>/fd)` + `readlink` lấy inode từ `socket:[N]` (lỗi đọc thư mục `fd` → ném `Error('Cannot read the Antigravity App process info (different user or sandboxed install?)')`, không kèm pid hay đường dẫn); đọc `net/tcp` và `net/tcp6` (thiếu file → bỏ qua); với mỗi dòng: cột `st === '0A'`, địa chỉ local là `0100007F` (tcp) hoặc `0000000000000000FFFF00000100007F` (tcp6 ánh xạ IPv4), inode thuộc tập → `parseInt(port, 16)`. Trả mảng không trùng, tăng dần. Không chạy lệnh ngoài, không log `args` (chú thích 1 dòng như `args.ts`)
- [X] T008 [US1] 🍎 Trong `src/server/app-adapter/discovery/process-finder.ts`: thêm `if (platform === 'linux') return new LinuxProcessFinder();`; đổi thông báo lỗi thành `Platform "<p>" is not supported (supported: macOS, Linux).`; sửa chú thích đầu file "Linux is deferred" thành mô tả hiện tại
- [X] T009 [US1] 🍎 Trong `src/server/main.ts` (research R5, FR-018): khi `!s.versionSupported` và `s.verifiedVersions.length === 0`, dùng thông điệp "Antigravity App <bản>: hệ điều hành này đang ở giai đoạn thử nghiệm, chưa có phiên bản App nào được kiểm chứng trên đây. Một số tính năng có thể không hoạt động."; giữ nguyên thông điệp cũ khi danh sách không rỗng. Vẫn gửi qua cùng mã cảnh báo `APP_VERSION_UNSUPPORTED` (giao diện web hiển thị `message` nên không cần sửa web). Không ghi cứng tên hệ điều hành hay số phiên bản. Trong `main().catch` cuối file, thêm `console.error(`Agent Office: ${(err as Error).message}`)` trước `log.error` để lỗi khởi động (vd. hệ điều hành không hỗ trợ, FR-009) hiện một dòng dễ đọc ở terminal
- [X] T010 [P] [US1] 🍎 Trong `src/server/storage/json-store.ts`: sửa chú thích thành `// macOS: ~/Library/Application Support/agent-office · Linux: ~/.local/share/agent-office (XDG_DATA_HOME)`
- [X] T011 [US1] 🍎 Chạy `npm test`, `npm run typecheck`, `npm run lint`; tất cả xanh. Chạy `npm start` trên Mac: vẫn in `Antigravity App 2.29.0: connected`, không có cảnh báo (FR-015)

### Verification on CachyOS for User Story 1

- [X] T012 [US1] 🐧 (FR-001 bước 1, điểm dừng trước US2) Trên CachyOS: clone repo, checkout `005-linux-support`, `npm ci && npm run build`, rồi `npm run check:compat -- --out /tmp/compat-linux.md`. Ghi kết quả vào `specs/005-linux-support/spec.md`, mục "Kết quả rà soát Linux", thêm tiểu mục "Bước 1" dạng bảng như bước 0 (phiên bản, số lệnh nội bộ còn, trường thêm/bớt so với fixture mới nhất, loại bước chưa nhận ra). **Nếu thiếu lệnh nội bộ nào: dừng, báo người dùng, không làm tiếp**
- [X] T013 [US1] 🐧 `npm start` trên CachyOS: kiểm tra (1) trình duyệt tự mở hoặc địa chỉ được in ra, (2) nhân viên khớp App trong ≤ 10 giây (SC-001), (3) terminal và giao diện hiện cảnh báo thử nghiệm của T009. Tắt/mở App 5 lần, mỗi lần tự kết nối lại ≤ 10 giây (SC-004). Tắt App trước khi `npm start` → trạng thái mất kết nối, không treo. Ghi kết quả vào `specs/005-linux-support/spec.md`, tiểu mục "Bước 1"

**Checkpoint**: Văn phòng chạy trên CachyOS ở chế độ đọc, có cảnh báo thử nghiệm.

---

## Phase 4: User Story 2 - Thao tác với nhân viên trên Linux (Priority: P1)

**Goal**: Mọi thao tác ghi chạy trên App Linux thật; công nhận 2.29.1 cho Linux.

**Independent Test**: quickstart.md phần C.

- [X] T014 [US2] 🐧 Chạy `npx tsx scripts/record-fixtures.ts` (và `--conversation <tên>=<id>` cho các loại bước như fixture `app-2.29.0`: `tools`, `question`, `waiting-question`, `search-web` nếu tạo được) để tạo `tests/contract/fixtures/app-2.29.1/`. Đọc lại từng file, xác nhận không có token, email, tên người dùng hay đường dẫn home
- [X] T015 [P] [US2] 🐧 Tạo `tests/contract/fixtures/app-2.29.1/SOURCE.md` ghi: "Ghi từ Antigravity App 2.29.1 bản Linux, CachyOS x86_64, <ngày>, feature 005-linux-support"
- [X] T016 [US2] 🐧 Chạy `npm test` trên CachyOS (contract test tự nhận bộ fixture mới qua `FIXTURE_SETS`). Sửa mapper trong `src/server/app-adapter/mappers/` chỉ khi test chỉ ra khác biệt thật, và ghi khác biệt vào spec
- [X] T017 [US2] 🐧 Chạy `npm run test:live` (chat, xoá, độ trễ ≤ 2 giây, duyệt quyền, project, câu hỏi); rồi `npm run test:leaks`; rồi `npx tsx scripts/record-fixtures.ts --sweep`. Tất cả qua và App không còn conversation `[agent-office-test]`. Ghi kết quả (số test, độ trễ đo được) vào `specs/005-linux-support/spec.md`, tiểu mục "Bước 2"
- [X] T018 [US2] 🍎 Chỉ khi T016–T017 qua, **trong cùng một commit**: thêm `{ version: '2.29.1', platforms: ['linux'], verifiedOn: '<ngày T017>', evidence: 'specs/005-linux-support' }` lên đầu `VERIFIED_APP_VERSIONS` trong `src/server/app-adapter/versions.ts`; thêm khẳng định `isVerified('2.29.1','linux')` đúng và `isVerified('2.29.1','darwin')` sai vào `tests/contract/versions.test.ts`; cập nhật danh sách phiên bản trong `scripts/install.sh`, `README.md`, `docs/INSTALL.md` (ghi rõ bản nào cho hệ nào); đổi dòng Linux trong bảng hệ điều hành của `README.md` từ 🧪 thành ✅. `npm test` xanh
- [X] T019 [US2] 🍎 Chạy `/speckit-constitution` (PATCH 2.2.0 → 2.2.1) để ghi 2.29.1 (Linux) vào danh sách Nguyên tắc II và mục Ràng buộc kỹ thuật, dẫn chứng `specs/005-linux-support`
- [ ] T020 [US2] 🐧 Kéo commit mới về CachyOS, `npm start`: không còn cảnh báo thử nghiệm (FR-018)

**Checkpoint**: Linux được công nhận chính thức trong danh sách đã kiểm chứng.

---

## Phase 5: User Story 3 - Cài đặt trên Linux chỉ theo hướng dẫn (Priority: P2)

**Goal**: Người mới cài và chạy được trên CachyOS trong ≤ 15 phút (SC-005).

**Independent Test**: quickstart.md phần D.

- [X] T021 [P] [US3] 🍎 Trong `scripts/install.sh`: chấp nhận `uname -s` là `Darwin` hoặc `Linux`, hệ khác báo "chỉ hỗ trợ macOS và Linux"; khi thiếu Node ≥ 22 trên Linux, gợi ý `sudo pacman -S nodejs npm` trước rồi tới `fnm` (macOS giữ gợi ý cũ); sửa chú thích đầu file "macOS only — Linux is deferred". Không thêm kiểm tra công cụ hệ thống nào (research R7)
- [X] T022 [P] [US3] 🍎 Trong `docs/INSTALL.md`: đổi tiêu đề và dòng "Hệ điều hành" để có Linux (CachyOS x86_64 được cam kết; bản phân phối khác không cam kết); thêm phần Linux: điều kiện (App Linux cài ở `/opt/Antigravity/`, Node ≥ 22, git), các bước, thư mục dữ liệu `~/.local/share/agent-office`, mở trình duyệt thủ công nếu không tự mở, lệnh gỡ lỗi che cả hai khoá từ `quickstart.md`; ghi rõ hiệu năng 3D trên Linux chưa được đo
- [X] T023 [P] [US3] 🍎 Trong `README.md`: bảng hệ điều hành đổi Linux từ "⏳ hoãn" thành "🧪 CachyOS x86_64, thử nghiệm (T018 đổi thành ✅ khi có bản App Linux được kiểm chứng)"; dòng "Chạy local trên macOS" thêm Linux
- [ ] T024 [US3] 🐧 Trên CachyOS: xoá bản clone, bấm giờ `git clone` → `./scripts/install.sh` → `npm start` → thấy văn phòng. Thử thêm: chạy `install.sh` khi `PATH` không có `node` → thông báo tiếng Việt có gợi ý pacman. Ghi một dòng vào bảng kiểm chứng của `docs/INSTALL.md` (máy, OS, Node, phiên bản App, thời gian)

**Checkpoint**: Cài đặt trên Linux đã kiểm chứng.

---

## Phase 6: Polish & Cross-Cutting

- [X] T025 🍎 Chạy lại quickstart.md phần A (macOS không hồi quy): `npm test`, `npm run typecheck`, `npm run lint`, `npm start` (SC-007)
- [X] T026 🍎 Cổng chất lượng 5 trên macOS (vì T021 sửa `install.sh`): clone sạch repo vào thư mục tạm → `./scripts/install.sh` → `npm start` → thấy văn phòng, có kết nối App, không có cảnh báo. Ghi một dòng vào bảng kiểm chứng của `docs/INSTALL.md` (máy, macOS, Node, phiên bản App, thời gian)
- [X] T027 Xoá khối Sync Impact Report ở đầu `.specify/memory/constitution.md` trước khi commit sửa đổi constitution (theo hướng dẫn của `/speckit-constitution`)
- [ ] T028 🐧 Dùng hằng ngày 1 tuần trên CachyOS; ghi mọi lỗi chỉ có trên Linux vào `specs/005-linux-support/spec.md` (SC-006). Không có lỗi → đánh dấu spec `Status: Done`

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → mọi user story.
- **US1**: T005 → T006 (cùng file), song song với T007 (viết test trước, chạy sau T007/T008). T007 → T008 → T011. T009, T010 độc lập. T011 → T012 → T013.
- **US2**: cần US1 xong (cần kết nối trên Linux). T014 → T015/T016 → T017 → T018 → T019 → T020.
- **US3**: T021–T023 làm trên Mac song song với US1/US2 bất cứ lúc nào sau Phase 2. T024 cần T021 và US1 xong. Nếu T018 làm sau T021–T023, T018 cập nhật số phiên bản trong các file đó.
- **Polish**: T025 sau mọi task 🍎; T026 sau T021–T023 và T018; T027 trước commit có sửa constitution (gồm commit hiện có v2.2.0); T028 sau cùng.

### Parallel Opportunities

- Phase 2: T004 song song với T002/T003.
- US1: T005 (rồi T006), T009, T010 song song (khác file).
- US3: T021, T022, T023 song song với nhau và với US1.

### Parallel Example: User Story 1

```text
T005 + T006 tests/contract/process-linux.test.ts
T009 src/server/main.ts
T010 src/server/storage/json-store.ts
```

## Implementation Strategy

### MVP (US1)

1. T001–T004 trên Mac.
2. T005–T011 trên Mac (toàn bộ mã Linux, test xanh).
3. T012–T013 trên CachyOS → **dừng và đánh giá**: văn phòng chạy trên Linux ở chế độ thử nghiệm.

### Tiếp theo

4. US2 (T014–T020): công nhận chính thức 2.29.1 cho Linux.
5. US3 (T021–T024): tài liệu và cài đặt; phần 🍎 có thể làm sớm song song.
6. Polish (T025–T028).

## Notes

- Không làm gì liên quan tới FPS/hiệu năng trên Linux (spec Clarifications).
- Không bao giờ dán dòng lệnh App mà chưa che `--csrf_token` và `--host_bridge_token`.
- Commit sau mỗi task hoặc nhóm task hợp lý; T018 phải là một commit nguyên vẹn.
- T001 (2026-11-10): mốc trước khi sửa: 255 test pass, 4 skipped; typecheck sạch. Sau T011: 263 pass.
- Đổi so với kế hoạch: test của `LinuxProcessFinder` đặt ở `tests/contract/` (không phải `tests/unit/`), vì lint
  chỉ cho test contract import phần bên trong lớp kết nối (Constitution II).
