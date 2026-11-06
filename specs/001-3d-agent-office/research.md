# Phase 0 Research: Văn phòng 3D cho agent trên Antigravity App

**Feature**: `001-3d-agent-office` | **Date**: 2026-11-06

Bằng chứng gốc về Antigravity App (thư mục dữ liệu, API nội bộ, kết quả chạy thử) nằm ở
`.specify/assessments/3d-agent-office/research.md`. Tài liệu này chỉ ghi lại **các quyết định kỹ
thuật** cho plan. Mỗi quyết định gồm: Quyết định / Lý do / Phương án đã cân nhắc.

---

## R1. Kiến trúc tổng thể

- **Quyết định**: Một ứng dụng gồm hai phần chạy trên cùng máy:
  1. **Server local** (Node.js) chỉ lắng nghe `127.0.0.1`. Server chứa *lớp kết nối App* (adapter)
     và phục vụ giao diện web.
  2. **Giao diện web** (chạy trong trình duyệt) hiển thị cảnh 3D và khung chat. Giao diện chỉ nói
     chuyện với server local, **không bao giờ** gọi trực tiếp Antigravity App.
- **Lý do**: Trình duyệt không thể đọc tham số tiến trình, dò cổng hay giữ CSRF token của App một
  cách an toàn. Server là nơi duy nhất giữ token (Constitution II, III). Tách như vậy giúp toàn
  bộ phần phụ thuộc API nội bộ nằm ở một module.
- **Đã cân nhắc**:
  - Ứng dụng desktop (Electron/Tauri): người dùng yêu cầu chạy trên trình duyệt, nên loại.
  - Trình duyệt gọi thẳng API của App: lộ token, vướng chứng chỉ tự ký và CORS, nên loại.

## R2. Ngôn ngữ và runtime

- **Quyết định**: **TypeScript 5.x** cho cả server và web, chạy trên **Node.js 22 LTS**. Dùng
  chung kiểu dữ liệu của miền nghiệp vụ (`src/shared`) giữa server và web.
- **Lý do**: Một ngôn ngữ cho cả hai phía. Hệ sinh thái 3D trên web (three.js) mạnh nhất ở
  TS/JS. Node 22 có sẵn `fetch`, WebSocket client, `node:test` và chạy giống nhau trên macOS và
  Linux.
- **Đã cân nhắc**:
  - Go hoặc Rust cho server (đóng gói thành một file nhị phân, dễ cài hơn): phải dùng hai ngôn
    ngữ và không chia sẻ được kiểu dữ liệu, nên loại ở giai đoạn này. Nếu sau này cài đặt bằng
    Node vượt quá 15 phút thì xem lại (R12).
  - Bun: nhanh, nhưng độ ổn định trên Linux và khả năng tương thích thư viện kém hơn Node LTS. Để
    dành làm phương án đóng gói thành một file (R12).

## R3. Công nghệ 3D

- **Quyết định**: **three.js** qua **React Three Fiber (R3F)** + **@react-three/drei**. Giao diện
  2D (chat, quota, menu) dùng **React 19**. Build bằng **Vite**.
- **Lý do**: R3F cho phép mô tả cảnh 3D bằng component, dễ kết hợp với giao diện chat React và
  trạng thái chung. drei có sẵn các thành phần cần thiết: `PointerLockControls` (góc nhìn thứ
  nhất), `OrbitControls`/`CameraControls` (toàn cảnh), `Instances` (vẽ hàng loạt cây và hoa),
  `useGLTF` + `useAnimations` (nhân vật có hoạt ảnh), `PerformanceMonitor` (tự giảm chi tiết),
  `Detailed` (LOD).
- **Đã cân nhắc**:
  - Babylon.js: mạnh, có sẵn công cụ, nhưng khó kết hợp với React và nặng hơn.
  - PlayCanvas: thiên về editor trên đám mây, nên loại.
  - Unity/Godot xuất sang WebGL: file nặng, khó gắn với khung chat web, vòng lặp phát triển chậm.

## R4. Đạt 60 FPS với 20 nhân viên và một công viên "sống"

- **Quyết định**:
  - **Máy tham chiếu**: MacBook Pro M1 Pro (32 GB), màn hình 1920×1080, Chrome bản ổn định mới
    nhất. Đây là máy của người dùng. Trên Linux, kiểm tra thêm trên một máy có GPU tích hợp
    (Intel Iris Xe hoặc tương đương) ở mức chi tiết "Thấp".
  - **Ngân sách mỗi khung hình** ở mức chi tiết mặc định: ≤ 300 draw call, ≤ 500k tam giác, tối
    đa 1 đèn đổ bóng (mặt trời), bóng chỉ cho văn phòng và nhân viên.
  - **Kỹ thuật**:
    - instancing cho cây, hoa, cỏ, đèn đường, người đi dạo
    - LOD 2–3 cấp cho cây và toà nhà xa
    - cảnh thành phố phía xa là mô hình đơn giản cộng ảnh nền (skybox hoặc impostor)
    - nén texture (KTX2) và mesh (Draco/Meshopt)
    - giới hạn số người và xe theo mức chi tiết
    - chỉ cập nhật hoạt ảnh của vật thể trong tầm nhìn
  - **3 mức chi tiết** cho bối cảnh (FR-065): Thấp / Vừa / Cao. `PerformanceMonitor` tự hạ mức
    khi FPS dưới 60 liên tục 3 giây và báo cho người dùng. Văn phòng và nhân viên không bao giờ bị
    hạ chi tiết.
  - Khi tab bị ẩn thì dừng vòng lặp vẽ (frameloop `demand`/`never`) để không tốn tài nguyên.
- **Lý do**: Constitution V yêu cầu ≥ 60 FPS và cho phép giảm chi tiết bối cảnh. Phong cách
  low-poly cộng instancing là cách đã được chứng minh để vẽ hàng nghìn cây trên WebGL.
- **Đã cân nhắc**:
  - WebGPU renderer: chưa ổn định trên mọi trình duyệt Linux, nên để sau.
  - Mô phỏng đám đông bằng vật lý: quá nặng, và spec chỉ yêu cầu đi theo lối định sẵn.

## R5. Tài nguyên 3D (giấy phép phi thương mại)

- **Quyết định**: Ưu tiên các bộ tài nguyên low-poly **CC0** (dùng tự do, không cần ghi nguồn):
  - **Kenney**: Furniture Kit, City Kit, Nature Kit, Car Kit
  - **Quaternius**: nhân vật có rig và hoạt ảnh (đi, ngồi, gõ phím, vẫy tay, vươn vai…), cây, hoa
  - **KayKit**: bổ sung đồ văn phòng
  - Cảnh đặc trưng 5 thành phố (ví dụ Tháp Rùa/Lotte, Landmark 81, Marina Bay Sands, Tokyo
    Tower/Skytree, Empire State) được dựng **đơn giản hoá** từ khối low-poly, hoặc lấy từ nguồn
    CC0/CC-BY.
  - Mọi tài nguyên được ghi vào `assets/LICENSES.md` (tên, nguồn, giấy phép).
- **Lý do**: CC0 không vướng điều kiện thương mại hay ghi nguồn, và phong cách các bộ này thống
  nhất với nhau (Constitution V).
- **Đã cân nhắc**:
  - Sketchfab: chất lượng không đều, nhiều giấy phép NC hoặc ND phải kiểm từng mẫu. Chỉ dùng khi
    cần, và phải ghi giấy phép.
  - Tự dựng toàn bộ: quá tốn công cho một người.
- **Ghi chú**: Hoạt ảnh trạng thái được ánh xạ như sau (chi tiết ở `data-model.md`):

  | Trạng thái | Hoạt ảnh |
  |---|---|
  | rảnh | ngồi, thỉnh thoảng hành động ngẫu nhiên |
  | đang nghĩ | chống cằm |
  | đang làm | gõ phím |
  | chờ sếp | giơ tay, kèm biểu tượng "!" |
  | lỗi | ôm đầu, kèm biểu tượng đỏ |
  | bị dừng | ngồi yên, kèm biểu tượng xám |
  | không rõ | mờ đi, kèm biểu tượng "?" |

## R6. Kết nối với Antigravity App: phát hiện, xác thực, phiên bản

- **Quyết định**: Lớp kết nối (`src/server/app-adapter/`) thực hiện các bước sau:
  1. **Tìm tiến trình** `language_server` của App. Cách nhận biết là tham số `--app_data_dir
     antigravity` kèm `--subclient_type hub`, không phụ thuộc đường dẫn cài đặt.
     - macOS: `ps -axo pid=,args=`
     - Linux: đọc `/proc/<pid>/cmdline`
  2. **Lấy CSRF token** từ tham số `--csrf_token` của tiến trình đó. Token chỉ giữ trong bộ nhớ.
  3. **Lấy các cổng đang lắng nghe** trên `127.0.0.1` của tiến trình:
     - macOS: `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN`
     - Linux: ghép inode socket trong `/proc/<pid>/fd` với `/proc/net/tcp`. Không cần `lsof`.
  4. **Thử từng cổng** bằng một lệnh đọc rẻ (`GetAllWorkflows`, trả về `{}`) qua HTTPS + JSON. Cổng
     nào trả HTTP 200 là cổng API.
  5. **Lấy phiên bản App** từ tham số `--override_ide_version` của tiến trình. Cách này dùng được
     trên cả hai hệ điều hành. Nếu khác `2.24.0` thì gửi cảnh báo (FR-005), nhưng vẫn tiếp tục.
  6. **Theo dõi sức khoẻ**: kiểm tra định kỳ 2 giây một lần. Nếu PID mất, cổng đổi hoặc lỗi 401/403
     thì dò lại từ bước 1. Phục vụ SC-010 (kết nối lại ≤ 10 giây).
- **TLS**: language server dùng chứng chỉ tự ký. Adapter chỉ tắt kiểm tra chứng chỉ cho kết nối
  tới đúng `127.0.0.1:<cổng đã dò>`, bằng một `https.Agent` riêng, không tắt toàn cục.
- **Lý do**: Đây là đúng cơ chế đã chạy thử thành công trên macOS (assessments/research.md). Gom
  toàn bộ phần dò tìm vào một chỗ theo Constitution II và VI.
- **Đã cân nhắc**:
  - Dùng `agy agentapi`: chỉ có 3 lệnh, và gửi tin dưới dạng tin nhắn hệ thống, không phải tin
    nhắn người dùng, nên loại.
  - Đọc thẳng SQLite: không có chat, không gửi được tin nhắn, dễ vướng khoá WAL. Chỉ giữ làm
    nguồn dự phòng để đọc danh sách conversation khi API lỗi (không làm trong đợt đầu).
- **Linux (hoãn, 2026-11-06)**: người dùng không có máy Linux, nên Linux không thuộc phạm vi tính
  năng này (Constitution VI v2.0.0). Chỉ cài đặt bản macOS của `ProcessFinder`. Các ghi chú về
  `/proc` ở trên được giữ làm tham khảo cho lần bàn sau.

## R7. Cập nhật trạng thái theo thời gian thực (≤ 2 giây)

- **Quyết định**:
  - **Danh sách và trạng thái**: server gọi `GetAllCascadeTrajectories` **mỗi 1 giây**, so sánh
    với lần trước và chỉ đẩy phần thay đổi xuống trình duyệt qua **WebSocket**. Trạng thái nhân
    viên được tính từ `status` của conversation cộng trạng thái bước cuối (xem `data-model.md`).
  - **Khung chat đang mở**: thử `StreamCascadeReactiveUpdates` (luồng Connect) để nhận từng bước
    ngay khi có. Nếu không dùng được, gọi `GetCascadeTrajectorySteps` mỗi 500 ms trong khi
    conversation đang `RUNNING`, và mỗi 5 giây khi rảnh.
- **Lý do**: Dữ liệu là local nên gọi 1 lần/giây rất rẻ, và độ trễ tối đa khoảng 1 giây cộng thời
  gian xử lý, đáp ứng FR-003/SC-002. Phần luồng có thể thay thế dần mà không đổi hợp đồng với
  trình duyệt (contracts/local-api.md).
- **Đã cân nhắc**:
  - Theo dõi file SQLite bằng file watcher: dễ vướng WAL, khác nhau giữa các hệ điều hành, không
    có nội dung chat.
  - Chỉ dùng luồng: chưa kiểm chứng, nên giữ polling làm nền chắc chắn.

## R8. Chat tương đương App: gửi tin, `/`, `@`, model, dừng, duyệt quyền

- **Quyết định** (dựa trên kết quả chạy thử ngày 2026-11-06):

  | Chức năng | Cách làm | Ghi chú |
  |---|---|---|
  | Gửi tin như người dùng | `SendUserCascadeMessage {cascadeId, items[], cascadeConfig.plannerConfig.planModel}` | `items` là chuỗi phần tử `{text}` hoặc `{item:{file:{absoluteUri}}}` |
  | Danh sách lệnh `/` | `GetSlashCommands` (bắt buộc truyền model) | lưu đệm 60 giây, theo từng model |
  | Danh sách skill | `GetAllSkills` | |
  | Gợi ý `@` | thử `GetMatchingContextScopeItems` với workspace của conversation. Nếu vẫn rỗng, **server tự liệt kê file** trong `workspaceUris` (bỏ qua `.git`, `node_modules`, tối đa 5.000 file, lọc theo tên) | đáp ứng FR-028 kể cả khi API không trả kết quả |
  | Chọn model | `GetUserStatus` → `cascadeModelConfigData.clientModelConfigs[]` (`label`, `modelOrAlias.model`, `quotaInfo`) | dùng chung dữ liệu với quota |
  | Dừng | `CancelCascadeInvocation {cascadeId}` | đã chạy thử: về IDLE trong khoảng 1 giây |
  | Tạo conversation mới | `StartCascade` rồi `SendUserCascadeMessage` | **cần kiểm chứng** tham số của `StartCascade`; dự phòng bằng `agy agentapi new-conversation` |
  | Duyệt / từ chối quyền | `HandleCascadeUserInteraction {conversationId, interaction}` | **cần kiểm chứng** định dạng `interaction` (spike) |

- **Lý do**: Đây là đúng các API mà giao diện App dùng, nên kết quả "giống App" (FR-022, FR-027,
  FR-028).
- **Đã cân nhắc**: tự phân tích lệnh `/` phía client. Không cần, vì agent tự hiểu text bắt đầu bằng
  `/` (đã chạy thử với `/antigravity-guide`).
- **Spike bắt buộc** (đầu Phase 2 tasks): (a) định dạng của `HandleCascadeUserInteraction`, đo bằng
  cách bật chế độ hỏi quyền trong App; (b) tham số của `StartCascade`; (c) `StreamCascadeReactiveUpdates`.
  Nếu (a) không làm được thì FR-029 rơi về "mở conversation trong App", và ghi lại theo spec
  Assumptions.

## R9. Quota

- **Quyết định**: `GetUserStatus` được gọi mỗi 5 phút và ngay sau khi một conversation chuyển từ
  `RUNNING` sang `IDLE` (FR-042). Server **lọc bỏ** `name` và `email` ngay khi nhận về, trước khi
  lưu đệm hay gửi xuống trình duyệt (FR-081). Model được gom nhóm theo cặp
  `remainingFraction` + `resetTime` giống nhau. Cảnh báo khi một nhóm dưới 10% (FR-043).
- **Lý do**: Khớp với số liệu App hiển thị (SC-008) và không lộ danh tính.

## R10. Lưu trữ dữ liệu riêng của hệ thống

- **Quyết định**: File **JSON** có version schema, lưu tại thư mục cấu hình của người dùng:
  - macOS: `~/Library/Application Support/agent-office/`
  - Linux: `$XDG_CONFIG_HOME/agent-office/` (mặc định `~/.config/agent-office/`)

  Ghi theo kiểu atomic (ghi file tạm rồi đổi tên). Gồm `layout.json`, `settings.json` và
  `employees.json` (ngoại hình và bàn được gán theo `conversationId`). **Không** lưu nội dung chat.
- **Lý do**: Dữ liệu nhỏ, một người dùng. JSON đủ dùng, dễ sao lưu, không cần thư viện cơ sở dữ
  liệu (Constitution I, IV: YAGNI).
- **Đã cân nhắc**:
  - SQLite: thừa so với nhu cầu.
  - `localStorage` của trình duyệt: mất khi đổi trình duyệt hoặc xoá dữ liệu, server không đọc
    được.

## R11. Bảo mật server local

- **Quyết định**:
  - Chỉ `listen('127.0.0.1')` (FR-080).
  - **Chống DNS rebinding và CSRF từ trang web khác**: kiểm tra header `Host` (chỉ chấp nhận
    `127.0.0.1:<port>` hoặc `localhost:<port>`) và `Origin` cho mọi request và cả WebSocket
    upgrade.
  - **Token phiên ngẫu nhiên**: lệnh khởi động in ra và tự mở URL dạng `http://127.0.0.1:<port>/#k=<token>`.
    Giao diện gửi token này trong header hoặc tham số WebSocket. Thiếu token thì trả 401.
  - Log có bộ lọc che (redact) các trường `csrf`, `token`, `email`, `name`, nội dung tin nhắn.
    Có kiểm thử tự động rà log (SC-009).
  - Kết nối ra ngoài duy nhất là `api.open-meteo.com` (FR-082).
- **Lý do**: Server local có quyền gửi lệnh cho agent, mà agent có thể chạy lệnh trên máy. Một
  trang web độc hại mở trong cùng trình duyệt không được phép điều khiển nó.
- **Đã cân nhắc**: chỉ dựa vào `127.0.0.1`. Không đủ, vì vẫn có thể bị DNS rebinding hoặc bị trang
  khác gửi request tới localhost.

## R12. Cài đặt và chạy (≤ 15 phút, macOS; Linux hoãn)

- **Quyết định**:
  - Phân phối dưới dạng mã nguồn (git clone hoặc tải file nén), kèm script `scripts/install.sh`.
    Script kiểm tra Node ≥ 22; nếu chưa có thì hướng dẫn cài qua `fnm` (một lệnh, chạy trên cả
    hai hệ điều hành). Sau đó chạy `npm ci` và build giao diện.
  - Chạy bằng `npm start`. Lệnh này khởi động server, kiểm tra Antigravity App, in URL và tự mở
    trình duyệt.
  - Tài nguyên 3D đã nén được commit sẵn trong repo (khoảng 30–60 MB), không tải khi cài.
- **Lý do**: Ít bước nhất mà vẫn không cần Docker (Constitution VI). Máy người dùng hiện **chưa có
  Node**, nên bước cài Node phải có trong hướng dẫn và nằm trong 15 phút.
- **Đã cân nhắc**: đóng gói thành một file thực thi (Bun `--compile` hoặc Node SEA). Dễ cài hơn,
  nhưng phức tạp khi nhúng tài nguyên. Ghi lại làm phương án cải tiến nếu SC-005 không đạt.

## R13. Kiểm thử

- **Quyết định**:
  - **Vitest**: unit test và **contract test cho lớp kết nối**, dựa trên fixture JSON ghi từ App
    2.24.0 thật, đã được làm sạch (xoá tên, email, token, nội dung riêng tư). Thêm một bộ
    "live test" tuỳ chọn chạy với App thật, có cờ `AGENT_OFFICE_LIVE=1`, và dùng conversation thử
    nghiệm có tên `[agent-office-test]` được dọn sau khi chạy (Constitution, Quy trình).
  - **Playwright**: e2e trên trình duyệt với một **App giả lập** (mock server trả fixture), dùng để
    kiểm tra mở chat bằng 1 lần bấm, hiển thị trạng thái và quota.
  - **Đo FPS**: một trang benchmark chạy kịch bản cố định (20 nhân viên, bối cảnh mặc định) trong
    60 giây và ghi FPS trung bình và p1 (khung hình chậm nhất). Chạy thủ công trên máy tham chiếu
    trước khi kết thúc mỗi đợt (cổng chất lượng 4).
  - **Kiểm tra rò rỉ**: test quét toàn bộ log và file trong thư mục cấu hình, tìm token, email hay
    nội dung mẫu (SC-009).
- **Lý do**: API nội bộ có thể đổi. Fixture giúp phát hiện ngay khi App cập nhật (Constitution II).
- **Đã cân nhắc**: chỉ test với App thật. Chậm, tốn quota, và không chạy được trong CI.

## R14. Thời tiết

- **Quyết định**: Dùng **Open-Meteo** `forecast?current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day`
  cho tọa độ cố định của 5 thành phố. Lưu đệm 30 phút cho mỗi thành phố (FR-063). Ánh xạ
  `weather_code` (theo chuẩn WMO) thành 5 kiểu cảnh: quang, mây, mưa, giông, sương mù/tuyết. Hiển
  thị dòng "Weather data by Open-Meteo.com" kèm liên kết (CC BY 4.0). Lỗi mạng thì dùng "quang"
  và không báo lỗi (Edge case).
- **Lý do**: Miễn phí cho phi thương mại, không cần API key. Khoảng 48 request mỗi ngày, rất xa
  giới hạn 10.000 request/ngày.

## R15. Di chuyển của nhân viên và góc nhìn thứ nhất

- **Quyết định**: Văn phòng dùng **lưới ô vuông** (ô 0,5 m). Bố cục người dùng xây được chuyển
  thành bản đồ ô đi được.
  - **Tìm đường**: A* trên lưới cho các hành động ngẫu nhiên (đi tới máy nước, đi ra cửa).
  - **Va chạm ở góc nhìn thứ nhất**: dùng cùng bản đồ ô (va chạm hình tròn với ô bị chặn), không
    cần thư viện vật lý.
  - **Hành động ngẫu nhiên**: mỗi nhân viên có một bộ hẹn giờ 5 phút ± 2 phút, xen kẽ để không ai
    đứng dậy cùng lúc (FR-012).
- **Lý do**: Văn phòng vốn được xây trên lưới (FR-051), nên cùng một cấu trúc phục vụ được việc
  xây dựng, tìm đường và va chạm. Đơn giản và rẻ (Constitution IV).
- **Đã cân nhắc**:
  - Rapier hoặc cannon (vật lý): nặng, thừa so với nhu cầu.
  - navmesh (recast): mạnh nhưng phức tạp khi bố cục thay đổi liên tục.

## R16. Quản lý trạng thái giao diện

- **Quyết định**: **Zustand** cho trạng thái chung (danh sách nhân viên, conversation đang mở,
  quota, cài đặt). Dữ liệu từ server đi vào store qua một client WebSocket duy nhất. Hiển thị
  markdown và code bằng **react-markdown** + **Shiki** (tô màu code).
- **Lý do**: Zustand nhẹ và hợp với R3F, vì component 3D đọc store mà không phải render lại cả
  cây.

---

**Kết quả**: Mọi mục `NEEDS CLARIFICATION` của Technical Context đã được giải quyết. Ba điểm
**cần spike** (định dạng duyệt quyền và `StartCascade`; luồng cập nhật) đều đã có **phương
án dự phòng**, nên không chặn plan.
