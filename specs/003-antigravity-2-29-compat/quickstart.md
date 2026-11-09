# Quickstart: kiểm chứng tương thích App 2.29.0

Hướng dẫn chạy và kiểm tra feature `003-antigravity-2-29-compat` từ đầu đến cuối. Chi tiết hành vi
xem `contracts/app-adapter.md`, `contracts/local-api.md` và `data-model.md`.

## Điều kiện

- macOS, Node ≥ 22, đã `npm install`.
- Antigravity App **2.29.0** đang mở và đã đăng nhập. Kiểm tra bằng `npm run check:compat`: dòng
  đầu phải là `App 2.29.0`.
- Còn quota model nhỏ cho kiểm thử với App thật. Các test dùng model Flash.

## 1. Rà soát chỉ-đọc (US4, chạy được ngay từ đầu)

```bash
npm run check:compat
```

Kết quả mong đợi trên 2.29.0, khớp với "Kết quả điều tra" trong spec:
- `verified: false` trước cổng US1, `true` sau cổng.
- 18/18 RPC `present`.
- `fieldDiff`: phụ thuộc bộ fixture dùng để so sánh (in ở dòng đầu báo cáo):
  - **Trước T019** (bộ so sánh mặc định là 2.24.0), hoặc `--baseline 2.24.0` bất kỳ lúc nào: chỉ có
    trường **thêm** (nhánh git, repo, gốc git của workspace). Trường bị bớt duy nhất là
    `isRecommended`.
  - **Sau T019** (bộ so sánh mặc định là 2.29.0): không có trường thêm hay bớt nào, ngoại trừ khác
    biệt do nội dung conversation (ví dụ có loại bước mà fixture không có). Những khác biệt này
    phải giải thích được.
- `unknownStepTypes`: trước US2/US3 có `ASK_QUESTION` và `SEARCH_WEB`; sau US2/US3 thì rỗng.
- Chạy xong trong ≤ 2 phút. App không có conversation hay project mới (so sánh số lượng trước và sau).

## 2. Kiểm thử tự động

```bash
npm test                              # unit + contract (cả 2 bộ fixture) + leaks + guards
npm run test:e2e                      # mock App: question.spec, chat.spec, ... (GPU thật)
AGENT_OFFICE_LIVE=1 npm run test:live # App thật: chat, latency, project, permission, question
```

- Contract test chạy `describe.each(['2.24.0', '2.29.0'])`, và cả hai đều pass (FR-006).
- Guard: không còn chuỗi phiên bản App nào trong `src/` ngoài `app-adapter/versions.ts`.
- Test live tự dọn conversation và project `[agent-office-test]`. Nếu test dừng giữa chừng, lần
  chạy sau sẽ dọn tiếp nhờ `sweepTestArtifacts()` chạy trong `beforeAll` (task T009). Muốn dọn
  riêng thì chạy `npx tsx scripts/record-fixtures.ts --sweep`.
- `permission.live` có thể bị bỏ qua nếu App tự duyệt lệnh. Khi đó, kiểm chứng bằng tay ở bước 3.

## 3. Kiểm tra bằng tay trên App thật (cổng FR-003)

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| M1 | `npm start` | Terminal in `Antigravity App 2.29.0: connected`. Sau cổng: **không** có cảnh báo phiên bản |
| M2 | Thoát App (⌘Q) rồi mở lại trong lúc Agent Office đang chạy | Văn phòng chuyển sang "mất kết nối", rồi tự kết nối lại trong ≤ 10 giây |
| M3 | Tuyển nhân viên mới vào một project, gửi việc | Nhân viên xuất hiện ở bàn, chuyển sang làm việc trong ≤ 2 giây. Conversation trong App thuộc đúng project |
| M4 | Nhờ nhân viên chạy một lệnh cần duyệt, rồi bấm "Cho phép"; làm lại và bấm "Từ chối" | App ghi nhận đúng từng lựa chọn |
| M5 | Bấm dừng khi nhân viên đang làm | Agent dừng trong ≤ 3 giây |
| M6 | Tạo project gắn một thư mục | Project xuất hiện ở cả App và Agent Office |

Khi M1–M6 và bước 2 đều pass: thêm `2.29.0` vào `VERIFIED_APP_VERSIONS`, rồi chạy
`/speckit-constitution` để sửa PATCH (R3-10).

## 4. Câu hỏi trắc nghiệm (US2)

Trong chat với một nhân viên thử, gửi:

> [agent-office-test] Dùng công cụ ask_question hỏi tôi 2 câu: (1) chọn một màu trong Đỏ/Xanh, (2) chọn các ngày rảnh trong T2/T3/T4 (cho chọn nhiều). Sau đó nhắc lại câu trả lời của tôi.

| Kiểm tra | Kết quả mong đợi |
|---|---|
| Văn phòng | Nhân viên vẫy tay "chờ sếp" trong ≤ 2 giây |
| Chat | Câu (1) có radio, câu (2) có checkbox, mỗi câu có ô "Khác". **Không** có nút "Cho phép / Từ chối" |
| Gửi `Xanh` + `T2, T4` | Agent nhắc lại đúng đáp án. Lịch sử hiện câu hỏi kèm đáp án |
| Lặp lại, gõ "Tím" vào ô "Khác" ở câu (1) | Agent nhận "Tím" |
| Mở 2 tab, trả lời ở tab 1 rồi bấm gửi ở tab 2 | Tab 2 hiện "Câu hỏi đã được trả lời ở nơi khác" |

## 5. Lỗi và tìm kiếm web (US3)

- Mở conversation `ATELIER_APP_229_CREATE_OK` (dữ liệu thật). Bước lỗi phải hiện thông báo "API
  error … connection reset by peer", không còn khối trống.
- Mở conversation `User Introduction And Greeting`. Phải thấy "Đã tìm: AI artificial intelligence
  news today…".

## 6. Cổng chất lượng (constitution)

1. Kiểm thử lớp kết nối pass với cả 2 bộ fixture, gồm các trường hợp App đóng, đổi cổng và phản hồi
   sai định dạng.
2. Độ trễ trạng thái ≤ 2 giây (`latency.live`).
3. Không rò thông tin: `npm run test:leaks`; xem lại các file trong `fixtures/app-2.29.0/`.
4. 60 FPS: feature này không đổi cảnh 3D. Chạy `npm run bench:fps` một lần để xác nhận không bị
   giảm FPS.
5. Hướng dẫn cài đặt: chạy lại `docs/INSTALL.md` trên App 2.29.0 và thêm một dòng vào nhật ký chạy thử.

## Kết quả kiểm chứng 2.29.0

Máy: MacBook Pro M1 Pro, macOS, Node 26.13, Antigravity App **2.29.0**. Ngày 2026-11-08 (kiểm tra tay và cổng: 2026-11-09).

| Hạng mục | Kết quả |
|---|---|
| `npm test` (unit + contract trên 2 bộ fixture 2.24.0 / 2.29.0 + leaks + guards) | ✅ 212 pass, 1 bỏ qua có lý do: chưa ghi được bước lỗi thật, đã có file biến thể thay thế (T038) |
| `npm run typecheck`, `npm run lint` | ✅ |
| `npm run test:e2e` (mock App, GPU thật) | ✅ 40/40, gồm `question.spec` và các ca lỗi/tìm kiếm trong `chat.spec` |
| `npm run bench:fps` (lần 2) | ✅ trung bình 122,4 FPS, 1% thấp nhất 98 FPS (≥ 60) |
| Live `chat` (A6, A7) | ✅ |
| Live `latency` (10 phút) | ✅ p95 = 881 ms, khớp 100% (n = 2008) |
| Live `permission` (cho phép, rồi từ chối) | ✅ App 2.29.0 có hỏi quyền nên test chạy thật, không bị bỏ qua |
| Live `project` | ✅ sau khi sửa (xem ghi chú 1) |
| Live `question` (chọn một, chọn nhiều, trả lời tự do) | ✅ 3/3 |
| Spike S1 | ✅ xem research R3-04 "Kết quả spike S1" |
| `check:compat` (T048) | ✅ 1 giây; 19/19 RPC còn; chỉ có trường thêm (git của workspace), bớt `isRecommended`; 0 loại bước lạ; số conversation/project trước = sau (56/7) |
| Quét toàn bộ conversation (T042, SC-004) | ✅ 2 bước lỗi đều có nội dung; 14 câu hỏi, 1 tìm kiếm web được nhận ra; 0 bước bị hiện là `other` |
| M1 (khởi động) | ✅ `Antigravity App 2.29.0: connected`. Trước cổng: cảnh báo đúng `(đã kiểm chứng: 2.24.0)` |
| M2 (thoát App rồi mở lại) | ✅ chủ dự án kiểm tay trên App thật, 2026-11-09 |
| M3–M6 | ✅ ở mức adapter qua các test live project/permission/chat, và trên giao diện thật (chủ dự án, 2026-11-09) |
| Câu hỏi trên giao diện thật (T037: 2 tab → 409, ≤ 2 s, ≤ 3 lần bấm) | ✅ chủ dự án kiểm tay trên App thật, 2026-11-09; cũng có e2e trên mock App |
| SC-001: 10 lần khởi động không cảnh báo | ✅ 10/10 `Antigravity App 2.29.0: connected`, 0 cảnh báo (sau cổng T019, 2026-11-09) |
| Hướng dẫn cài đặt từ bản clone sạch (T051) | ⏳ sau commit cổng (bản clone cần các thay đổi đã commit) |

**Ghi chú**
1. **Phát hiện mới trên 2.29.0:** App từ chối tạo project **trùng tên** (`CreateProject: HTTP 409 already_exists`).
   - Trước khi sửa: Agent Office trả lỗi 500 và giao diện chỉ báo "Không tạo được project.".
   - Đã sửa: adapter báo `ProjectNameTakenError`, route trả `409 PROJECT_NAME_TAKEN`, giao diện báo "Tên project này đã có. Hãy đặt tên khác.".
   - Test live dùng tên riêng cho mỗi lần chạy.
   - Tên bị trùng nằm ở một project thử còn sót có **id rỗng** (`~/.gemini/config/projects/.json`), từ một spike ngày 2026-11-07. Bước dọn không xoá được project này vì id rỗng. Chủ dự án đã cho xoá tay ngày 2026-11-09.
2. Live test giờ chạy **tuần tự từng file** (`fileParallelism: false` khi live), vì bước dọn ở đầu mỗi file có thể xoá đối tượng thử của file khác đang chạy.
3. `sanitizeRaw` che thêm thư mục tạm của macOS (`/var/folders/<id>/T` → `/tmp/TMP`), vì đường dẫn này gắn với tài khoản.
