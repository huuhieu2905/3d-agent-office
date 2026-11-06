# Nghiên cứu ý tưởng: Văn phòng 3D cho Agent (conversation Antigravity → nhân viên)

- **Slug**: 3d-agent-office
- **Ngày tạo**: 2026-11-06
- **Cập nhật**: 2026-11-06, thêm kết quả kiểm tra trực tiếp trên máy người dùng (xem mục "Kiểm tra trên máy").
- **Độ tin cậy bằng chứng (tổng thể)**: medium (trung bình). Phần **đọc dữ liệu và trạng thái conversation** đã được kiểm chứng trên máy, độ tin cậy **high (cao)**. Phần **thao tác (gửi tin nhắn, tạo conversation)** có cờ CLI chính thức nhưng chưa chạy thử, độ tin cậy **medium**. Định dạng file nội bộ vẫn là thứ không được công bố, có thể thay đổi.

> **Phương pháp**: Nguồn web đến từ **kết quả tìm kiếm** (tiêu đề và đoạn trích), **không mở trực tiếp trang nào**, vì công cụ fetch không ghim được địa chỉ IP kết nối như URL Trust Policy yêu cầu. Theo yêu cầu của người dùng, mình đã **kiểm tra trực tiếp bản cài Antigravity trên máy**, nhưng **chỉ đọc phiên bản, tên thư mục, cấu trúc bảng (schema) và số liệu tổng hợp** (đếm số lượng, giá trị trạng thái). **Không đọc nội dung, tiêu đề hay preview của bất kỳ conversation nào.**

## Kiểm tra trên máy (2026-11-06)

Các kết quả dưới đây đều có [nguồn: kiểm tra trực tiếp trên máy người dùng] (confidence: high), trừ chỗ ghi khác.

### Phiên bản đã cài

- **Ứng dụng desktop**: `/Applications/Antigravity.app`, **phiên bản 2.24.0**, bundle id `com.google.antigravity`. Đây là ứng dụng Electron (`app.asar`), kèm binary `Resources/bin/language_server`. Nó **không có `product.json` kiểu VS Code**, tức đây là **ứng dụng Antigravity 2.x độc lập**, không phải bản IDE fork từ VS Code.
- **CLI**: `agy` tại `~/.local/bin/agy`, **phiên bản 1.5.1**. Changelog cho thấy đã có bản 1.5.2.
- **Không tìm thấy bản "Antigravity IDE" riêng** (bản fork VS Code) nào khác trong `/Applications`.

### Nơi lưu dữ liệu

- `~/.gemini/antigravity-cli/`: **đang hoạt động**, có **11 conversation**, mỗi conversation là một file SQLite `conversations/<uuid>.db`. Ngoài ra có `conversation_summaries.db`, `history.jsonl`, `brain/`, `presence/`, `settings.json`. Lần sửa gần nhất là 2026-11-05.
- `~/.gemini/antigravity/`: có `conversation_summaries.db` nhưng **0 conversation**. Lần sửa gần nhất của file summaries là 2026-10-16. Có vẻ đây là thư mục của bản cũ hoặc của chế độ khác.
- `~/.gemini/config/projects/`: **1 project** (`default-cli-project.json`, gồm các khoá `id`, `name`, `projectResources`).
- `~/Library/Application Support/Antigravity/`: dữ liệu Electron của ứng dụng desktop (cache, Local Storage, `app_storage.json`, …).
- → Đường dẫn trên máy **khớp một phần với nguồn web** (`~/.gemini/antigravity/...`), nhưng dữ liệu thật hiện nằm ở `antigravity-cli`. Hai nguồn web trước đó đều không đúng hẳn.

### Bảng `conversation_summaries` (rất phù hợp để hiển thị nhân viên)

Các cột quan trọng:

| Cột | Ý nghĩa cho văn phòng 3D |
|---|---|
| `conversation_id`, `title`, `preview` | danh tính và tên nhân viên |
| `project_id`, `group_id`, `workspace_uris` | nhân viên thuộc project hay phòng ban nào |
| `status` (giá trị thấy được: `CASCADE_RUN_STATUS_IDLE`) | **trạng thái chính → chuyển động** |
| `not_fully_idle`, `killed` | đang làm dở hoặc đã bị dừng |
| `parent_conversation_id`, `nesting_depth` | **subagent** (có thể là "nhân viên cấp dưới") |
| `agent_name`, `step_count` | loại agent và khối lượng công việc |
| `last_user_input_time`, `last_modified_time` | lần cuối sếp tương tác, lần cuối có hoạt động |

- Hiện cả 11 conversation đều ở trạng thái `CASCADE_RUN_STATUS_IDLE`, 0 conversation bị dừng, 0 subagent. **Chưa thấy các giá trị trạng thái khác** (đang chạy, chờ duyệt, lỗi), nên cần quan sát lúc agent đang chạy.
- Mỗi file `conversations/<uuid>.db` có bảng `steps` (`step_type`, `status`, `error_details`, `permissions`, …). Dữ liệu chi tiết nằm trong **blob nhị phân, có thể là protobuf**, chưa giải mã. Cột `permissions` gợi ý có thể biết khi nào agent **đang chờ sếp duyệt**. — (confidence: medium)
- Lưu ý kỹ thuật: mở `conversation_summaries.db` ở chế độ read-only thông thường bị lỗi `unable to open database file`, chỉ đọc được khi bật chế độ `immutable`. Khi Antigravity đang ghi, cần cách đọc an toàn. — (confidence: medium)

### Ứng dụng Antigravity App: kiểm tra sâu (mục tiêu kết nối đã chốt)

Phần này có [nguồn: đọc mã JavaScript trong `/Applications/Antigravity.app/Contents/Resources/app.asar` và `language_server --help`] (confidence: high).

- **App lưu dữ liệu ở `~/.gemini/antigravity/`.** Hàm `getAppDataDirName()` trả về tên ứng dụng viết thường (`antigravity`), và `getAppDataDir()` = `~/.gemini/antigravity`. Bản dev dùng `antigravity-dev`.
- **App và CLI `agy` KHÔNG dùng chung dữ liệu.** CLI ghi vào `~/.gemini/antigravity-cli/` (11 conversation), còn App ghi vào `~/.gemini/antigravity/`. Vì vậy hệ thống phải đọc **thư mục của App**.
- **Hiện App chưa có conversation nào.** `~/.gemini/antigravity/conversations/` trống, `conversation_summaries.db` có 0 dòng. Log của App (`~/Library/Logs/Antigravity/`) và `app_storage.json` dừng ở **2026-10-16**, tức App mới được mở rất ít. Cần tạo vài conversation trong App để quan sát dữ liệu thật.
- **Cấu trúc dữ liệu của App giống CLI**: cùng bảng `conversation_summaries` với đủ các cột `status`, `project_id`, `parent_conversation_id`, … Riêng App có thêm **bảng tìm kiếm toàn văn `conversations_fts`** (FTS5), gồm các cột `title`, `workspace`, `project`, `user_body`, `agent_body`, `archived`. → Từ bảng này **có thể lấy nội dung tin nhắn dạng text** mà không cần giải mã protobuf. (confidence: medium, vì bảng hiện đang trống)
- **App chạy một "language server" local** (`Resources/bin/language_server`) với các cờ `--standalone --subclient_type hub --https_server_port <port> --csrf_token <token> --app_data_dir antigravity`. → Có một **API HTTPS local được bảo vệ bằng CSRF token**. Đây là cách App tự nói chuyện với agent, nhưng là **API nội bộ không công bố**, nên chưa nên dựa vào.
- **App còn có**: `DevToolsActivePort` (cổng Chrome DevTools, dùng cho bộ ghi màn hình), một "host bridge" nội bộ, và màn hình hướng dẫn cài bản IDE riêng (`~/.gemini/antigravity-ide`). Ứng dụng là Electron với `userData` tại `~/Library/Application Support/Antigravity/`.

### Thử nghiệm thao tác trực tiếp với App (2026-11-06, người dùng cho phép)

Tất cả kết quả trong mục này có [nguồn: chạy thử trên máy người dùng] (confidence: high).

**Kết luận: hệ thống có thể đọc *và* thao tác với conversation của Antigravity App qua `agy agentapi`, với điều kiện App đang chạy.**

- **Cơ chế kết nối:** `agy agentapi` không tự chạy được. Nếu thiếu cấu hình, nó báo lỗi `ANTIGRAVITY_LS_ADDRESS is not set`. Nó cần hai biến môi trường:
  - `ANTIGRAVITY_LS_ADDRESS`: địa chỉ language server của App, ví dụ `127.0.0.1:<port>`.
  - `ANTIGRAVITY_CSRF_TOKEN`: token mà App truyền cho language server qua cờ `--csrf_token` lúc khởi động.
  - Lưu ý: các biến này vốn được thiết kế để **agent bên trong App gọi lẫn nhau** (spawn subagent, nhắn cho nhau). Gọi từ bên ngoài như thế này là **dùng lại cơ chế nội bộ**, không phải API công khai.
- **Cổng:** App chạy `language_server` với `--https_server_port 0`, tức **cổng ngẫu nhiên mỗi lần mở App**. Lần thử này có hai cổng lắng nghe trên `127.0.0.1`: cổng thứ hai dùng được, còn cổng thứ nhất báo lỗi `error reading server preface: EOF`. → Hệ thống phải **tự dò cổng và token** mỗi lần App khởi động lại, bằng cách đọc tham số tiến trình và các cổng đang lắng nghe.
- **Kết quả từng lệnh:**
  - `new-conversation --model=flash_lite --title=…`: ✅ trả về `conversationId`. File `~/.gemini/antigravity/conversations/<id>.db` (kèm `-wal`, `-shm`) xuất hiện ngay trong **thư mục của App**. Thư mục CLI không đổi (vẫn 11 conversation).
  - `get-conversation-metadata <id>`: ✅ trả về JSON chi tiết (`createdAt`, `parentConversationId`, `rootConversationId`, `workspaceUris`, cấu hình agent/model, …).
  - `send-message <id> <nội dung>`: ✅ tin nhắn được ghi thành một bước mới (`step_type` 101) và **agent tự trả lời ngay**. Bảng FTS ghi đúng nội dung câu trả lời.
- **Trạng thái theo thời gian thực (đã quan sát được):** đọc `conversation_summaries` 4 lần/giây trong lúc agent viết một đoạn văn dài:
  - `CASCADE_RUN_STATUS_IDLE`, `not_fully_idle=0` → **rảnh**
  - `CASCADE_RUN_STATUS_RUNNING`, `not_fully_idle=1` → **đang làm việc** (khoảng 3,5 giây trong lần thử)
  - quay lại `IDLE`, `step_count` tăng lên → **xong việc**
  - Chưa quan sát được trạng thái **chờ duyệt quyền** và **lỗi**.
- **Đọc database khi App đang chạy:** mở SQLite ở chế độ `-readonly` đôi khi lỗi `unable to open database file (14)` vì file đang ở chế độ WAL. Chế độ `immutable` thì bỏ qua dữ liệu mới trong file WAL. Cách đọc ổn định trong lần thử là **sao chép `.db` + `-wal` + `-shm` ra chỗ khác rồi đọc bản sao**. Cách này tốn tài nguyên nếu chạy liên tục. Một hướng khác là chỉ dùng `get-conversation-metadata`. (confidence: medium)
- **Dữ liệu thử nghiệm còn lại:** một conversation có tiêu đề **"3d-agent-office test"** (id `77ea14f4-bdc6-403f-bdb5-c637f3d2a5fb`) đang nằm trong App. Người dùng có thể xoá nó trong App (chuột phải → xoá).

### Thử nghiệm API nội bộ của App: chat, `/`, `@`, dừng agent, quota (2026-11-06, người dùng cho phép)

Tất cả kết quả trong mục này có [nguồn: chạy thử trên máy người dùng, Antigravity App 2.24.0] (confidence: high, trừ chỗ ghi khác).

**Cách gọi**: language server của App mở một **API HTTPS trên `127.0.0.1`** theo chuẩn Connect/gRPC-web và nhận **JSON**. Endpoint có dạng `POST https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/<Method>` với header `x-codeium-csrf-token: <token>`. Trong 2 cổng của App, cổng thứ nhất nhận JSON qua HTTPS, cổng thứ hai là gRPC (cổng mà `agentapi` dùng). Binary `language_server` có **674 phương thức RPC**. Đây là **chính API mà giao diện App dùng**, không công bố, có thể đổi theo phiên bản.

| Nhu cầu | Phương thức | Kết quả thử |
|---|---|---|
| Danh sách conversation | `GetAllCascadeTrajectories` | ✅ trả về summary, status, stepCount, thời gian |
| Toàn bộ nội dung chat | `GetCascadeTrajectorySteps {cascadeId}` | ✅ JSON từng bước: tin nhắn người dùng, câu trả lời, **phần suy nghĩ (thinking)**, tool call, file đã xem, lệnh đã chạy và kết quả. Đủ để hiển thị chat như App, **không cần giải mã protobuf** |
| Gửi tin nhắn **như người dùng** | `SendUserCascadeMessage {cascadeId, items[], cascadeConfig.plannerConfig.planModel}` | ✅ được ghi thành bước `USER_INPUT` |
| Lệnh `/` | `GetSlashCommands` (cần truyền model) + gửi text bắt đầu bằng `/` | ✅ lấy được danh sách gồm 9 lệnh hệ thống (`/goal`, `/compact`, `/schedule`, `/browser`, `/plan`, `/grill-me`, `/teamwork-preview`, `/learn`, `/boost`) và các skill (`/antigravity-guide`, `/context7`, `/plugin`, …). Gửi `/antigravity-guide …` thì agent **nhận ra skill, tự đọc `SKILL.md`** rồi trả lời đúng |
| Lệnh `@` (nhắc file) | phần tử `{"item":{"file":{"absoluteUri":"file:///…"}}}` trong `items` | ✅ App lưu đúng mục nhắc có cấu trúc. Agent nhận **đường dẫn**, không nhận nội dung file. Agent tự đọc file bằng tool nếu được phép. Các loại nhắc khác có trong schema: `directory`, `repository`, `rule`, `mcp_resource`, `browser_page`, `knowledge`, … (chưa thử) |
| Gợi ý khi gõ `@` | `GetMatchingContextScopeItems`, `SearchContext` | ⚠️ trả về rỗng khi không có workspace. Chưa tìm ra cách gọi đúng (confidence: low) |
| Dừng agent | `CancelCascadeInvocation {cascadeId}` | ✅ trạng thái chuyển `RUNNING` → `IDLE` trong khoảng 1 giây |
| Duyệt / từ chối quyền | `HandleCascadeUserInteraction {conversationId, interaction}` | ⚠️ **có phương thức nhưng chưa thử được**: App đang ở chế độ tự chạy lệnh (`commandExecutionPolicy: eager`, plan cho phép auto-run), nên lệnh `echo` chạy thẳng, không hỏi quyền |
| Danh sách model | `GetAvailableModels`, `GetUserStatus` | ✅ |
| Skill, workflow | `GetAllSkills`, `GetAllWorkflows` | ✅ |
| Theo dõi thay đổi theo thời gian thực | `StreamCascadeReactiveUpdates`, `WaitForConversationFullyIdle` | chưa thử. Có thể thay cho việc đọc SQLite liên tục (confidence: medium) |

**Các trạng thái có trong App** (đọc từ binary):
- Trạng thái conversation: `IDLE`, `RUNNING`, `BUSY`, `CANCELING`.
- Trạng thái từng bước: `PENDING`, `QUEUED`, `GENERATING`, `RUNNING`, **`WAITING`** (khả năng cao là chờ duyệt quyền), `DONE`, **`ERROR`**, `CANCELED`, `INTERRUPTED`, `HALTED`, `CLEARED`, `INVALID`.
- → Đủ tín hiệu để nhân viên thể hiện: rảnh, đang nghĩ, đang làm, **chờ sếp**, **gặp lỗi**, bị dừng. (confidence: medium, vì `WAITING` và `ERROR` chưa quan sát trực tiếp)

**Quota (`GetUserStatus`)**: ✅ trả về đủ thông tin cho một bảng theo dõi quota:
- **Gói tài khoản**: `userTier.name` (ví dụ "Google AI Pro"), `planInfo.planName` ("Pro").
- **Quota theo từng model**: `cascadeModelConfigData.clientModelConfigs[].quotaInfo.remainingFraction` (phần còn lại, từ 0 đến 1) và `resetTime` (thời điểm reset). Lúc thử có **13 model** (Gemini 4 Argon, Gemini 3.8 Flash, Claude Opus/Sonnet 5.5, GPT-OSS 120B ở nhiều mức Low/Medium/High). Các model **dùng chung một hạn mức theo nhóm**, ví dụ nhóm Gemini 4 Argon còn khoảng 99,5% và reset ngày 2026-11-12, các nhóm khác còn 100% và reset sau vài giờ.
- **Credits**: `availablePromptCredits`, `availableFlowCredits`, `monthlyPromptCredits`, `monthlyFlowCredits`, `canBuyMoreCredits`.
- Phản hồi còn chứa **tên và email** của tài khoản. Hệ thống không được ghi log hay lộ các thông tin này.

**Phát hiện quan trọng về `agentapi send-message`**: tin nhắn gửi bằng lệnh này được ghi thành bước **`SYSTEM_MESSAGE`** với `sender=system`, tức một **tin nhắn hệ thống giữa các agent**, không phải tin nhắn của người dùng. Muốn chat đúng như App thì phải dùng `SendUserCascadeMessage`.

**Dữ liệu thử nghiệm**: conversation "3d-agent-office test" giờ có thêm khoảng 10 bước thử nghiệm, trong đó có 2 tin nhắn đang xếp hàng với mục nhắc file rỗng (do thử sai tên trường). Người dùng nên xoá conversation này. File tạm trong scratchpad đã được xoá. Token không được lưu ở đâu.

### Cách thao tác chính thức qua CLI `agy`

> **Lưu ý**: CLI mặc định ghi vào `antigravity-cli`, **không phải** thư mục của App. Chưa kiểm chứng việc chạy `agy` với `--app_data_dir antigravity` (cờ này có ở `agy acp`) có làm conversation hiện ra trong App không, và có an toàn khi App đang mở không.

- `agy agentapi`: có sẵn các lệnh `get-conversation-metadata <id>`, `new-conversation [--model] [--title] <prompt>`, `send-message <recipient_id> <content>`. Đây là **bộ lệnh khớp gần như hoàn toàn với nhu cầu "thao tác trong 3D"** (xem thông tin, giao việc mới, nhắn cho nhân viên). Lệnh được gói trong `~/.gemini/antigravity-cli/bin/agentapi`. (confidence: medium, vì chưa chạy thử)

Theo `agy --help`:

- `--conversation <ID>`: **tiếp tục một conversation có sẵn theo ID** → gửi tin nhắn cho "nhân viên".
- `--project <ID|tên>`, `--new-project`: chọn hoặc tạo project.
- `-p/--print` kết hợp `--output-format stream-json` và `--input-format stream-json`: chạy không tương tác, **nhận kết quả dạng luồng JSON**, phù hợp để gọi từ backend.
- `--mode` (accept-edits, auto, plan), `--model`, `--agent`, `--effort`.
- `agy acp`: **server Agent Client Protocol (ACP) qua stdio**. ACP là giao thức mở để client điều khiển agent, và là ứng viên tích hợp hai chiều tốt nhất.
- `agy remote-control start|status|stop`: daemon điều khiển từ xa. Có thể liên quan tới yêu cầu "dùng từ máy khác".
- → Đây là **giao diện chính thức** do chính Antigravity cung cấp, đáng tin hơn nhiều so với các SDK hay công cụ tự động hoá không chính thức tìm thấy trên web. Mình **chưa chạy thử** các lệnh này để tránh tạo conversation hay tốn quota. — (confidence: medium)

## Người dùng & Nhu cầu

- **Người dùng chính là chủ dự án.** Nhu cầu đã nêu: tạo cảm hứng, cảm giác làm việc với "người thật" thay vì đọc text khô khan. Đây là nhu cầu *được nói ra*, không phải hành vi *quan sát được*. — [nguồn: intake.md, câu trả lời của người dùng ngày 2026-11-06] (confidence: high)
- **Nhu cầu chung trên thị trường có vẻ có thật:** trong năm 2026 xuất hiện rất nhiều dự án độc lập hiển thị coding agent thành nhân vật trong văn phòng (xem mục "Đã có ai làm chưa"), có cả sản phẩm thương mại trên App Store (PixelHQ). Nhiều người làm cùng một thứ cho thấy có sự quan tâm thật, nhưng **chưa có số liệu** về số người dùng thường xuyên hay mức độ giữ chân người dùng. — [nguồn: kết quả tìm kiếm, xem Nguồn #4–#14] (confidence: medium)
- **Chưa có tín hiệu nào về nhu cầu riêng cho Antigravity:** không tìm thấy công cụ hiển thị kiểu này nào hỗ trợ Antigravity. Điều đó có thể là cơ hội (chưa ai làm) hoặc là dấu hiệu khó tích hợp. — [nguồn: Nguồn #15] (confidence: medium)
- **Nhu cầu "dễ cài lên máy khác"** có thể hàm ý có người dùng khác ngoài chủ dự án, nhưng chưa ai xác nhận. — ASSUMPTION (confidence: low)

## Đã có ai làm chưa (Prior Art)

**Trong dự án:** `.specify/` chưa có spec hay assessment nào khác. Đây là ý tưởng đầu tiên. — [nguồn: thư mục `.specify/` trong repo] (confidence: high)

**Bên ngoài: rất nhiều dự án gần giống**, chủ yếu dành cho Claude Code, Codex, Gemini CLI và Cursor:

- **Claw3D**: văn phòng ảo **3D** để quan sát, quản lý và **tương tác** với nhiều AI agent theo thời gian thực, tự host được. Rất gần với ý tưởng này (3D + thao tác). — [Nguồn #4] (confidence: medium)
- **agent-office-3d**: văn phòng low-poly hiển thị **trạng thái thật** của coding agent. Agent rảnh thì đi lang thang giải trí, giống ý "chuyển động theo trạng thái + chuyển động ngẫu nhiên khi rảnh". — [Nguồn #8] (confidence: medium)
- **Roster**: nhân vật 3D trong văn phòng pixel, tích hợp Claude Code, **Gemini CLI**, Cursor, Codex, giấy phép MIT. — [Nguồn #6] (confidence: medium)
- **AI Office**: người dùng **đi lại trong toà nhà 3D** để giám sát agent, gần với ý "góc nhìn thứ nhất". Một bài viết gọi đây là bản thử nghiệm giai đoạn đầu. — [Nguồn #9, #10] (confidence: low)
- **Claude Office Visualizer**: agent chính là "sếp", subagent là "nhân viên", có các cột trạng thái Needs-you / Working / Done / Ended. Đây là tham khảo tốt cho **bộ trạng thái của conversation**. — [Nguồn #12] (confidence: medium)
- **Pixel Agents** (extension VS Code): mỗi terminal Claude Code là một nhân vật ngồi bàn, có **văn phòng tuỳ biến**. Bài học quan trọng: **nhận biết trạng thái chỉ là phỏng đoán (heuristic)**, vì file transcript JSONL không cho biết rõ khi nào agent đang chờ người dùng hay đã xong lượt. — [Nguồn #13] (confidence: medium)
- **Pixel Agent Desk** (Electron): lấy trạng thái từ **hook event** nên tín hiệu trực tiếp và chính xác hơn so với đọc transcript. — [Nguồn #11] (confidence: medium)
- **BagIdea Office**, **ClawOffice**, **AgentOffice**, **pixtuoid**, **Clawffice**, **PixelHQ** (thương mại): các biến thể pixel-art, desktop hoặc terminal. — [Nguồn #5, #7, #14, #16] (confidence: medium)

**Điều này có ý nghĩa gì:** cách ví "agent = nhân viên trong văn phòng" **không mới**. Phần có thể khác biệt là: (1) hỗ trợ **Antigravity**, (2) bối cảnh **thành phố thật + thời tiết thật**, (3) **tự xây văn phòng 3D** trong một toà nhà. Chưa thấy dự án nào gộp đủ cả ba, nhưng mới chỉ dựa trên đoạn trích tìm kiếm. — ASSUMPTION (confidence: low)

## Thị trường & Bối cảnh

- **Antigravity** là nền tảng phát triển dùng agent của Google, có **Manager view** để chạy nhiều agent song song và dùng **Artifacts** (kế hoạch, ảnh chụp màn hình, bản ghi màn hình) để theo dõi tiến độ. — [Nguồn #1, #17] (confidence: medium)
- **Antigravity 2.0** là ứng dụng độc lập, không phụ thuộc IDE, còn bản IDE agentic gốc vẫn được dùng. Như vậy **có ít nhất hai phiên bản**, và cách lưu trữ có thể khác nhau giữa chúng. — [Nguồn #1] (confidence: medium)
- **Hiện tại người dùng vẫn dùng Agent Manager gốc của Antigravity**, tức là chi phí của việc không làm gì gần như bằng 0 về chức năng. Giá trị của ý tưởng nằm ở **trải nghiệm và cảm hứng**, không phải giải quyết một việc đang bị chặn. — [nguồn: intake.md] (confidence: high)
- Các dự án tương tự xuất hiện dày đặc cho thấy đây là một xu hướng "vibe/ambient UI" cho AI agent. Rủi ro là các công cụ này có thể được tích hợp sẵn vào chính sản phẩm agent. — ASSUMPTION (confidence: low)

## Dữ liệu & Ràng buộc

### Kết nối với Antigravity (rủi ro lớn nhất)

- **Không tìm thấy tài liệu chính thức** nào mô tả API để đọc danh sách project hay conversation của Agent Manager. — [Nguồn #1, #2] (confidence: medium)
- **Đường dẫn lưu trữ local chỉ có nguồn không chính thức, và các nguồn mâu thuẫn nhau:**
  - `~/.gemini/antigravity/conversations/` và `~/.gemini/antigravity/brain/`, theo trang của extension VS Code "Antigravity Storage Manager". — [Nguồn #3] (confidence: low)
  - `~/.gemini/antigravity-ide/conversations/<cascadeId>.db` (mỗi conversation một file SQLite), kèm cache giao diện tại `~/.config/Antigravity IDE/User/globalStorage/state.vscdb`, theo một bài reverse-engineering trên DEV Community. — [Nguồn #2] (confidence: low)
  - → Định dạng có thể **thay đổi theo phiên bản mà không báo trước**.
- **Thao tác từ bên ngoài (gửi tin nhắn, tạo conversation):** tài liệu chính thức chỉ nói về một **SDK** (class `Agent`, `LocalAgentConfig`, lệnh chat bất đồng bộ) để *chạy agent bằng code*, **không** nói về việc điều khiển conversation đang có trong Agent Manager. — [Nguồn #1] (confidence: low)
- **Các cách không chính thức đã có:**
  - `Kanezal/antigravity-sdk` (TypeScript, để viết extension cho Antigravity IDE): gửi prompt vào chat đang mở, chuyển session theo ID, tạo session chạy nền, gửi tin nhắn tiếp theo theo conversation ID. — [Nguồn #18] (confidence: low)
  - `antigravity-automation` (Python, giao tiếp qua một extension VS Code): `send_command`, `switch_chat`. — [Nguồn #19] (confidence: low)
  - `opencli`: điều khiển ứng dụng desktop qua **Chrome DevTools Protocol** (tự động hoá giao diện, gõ tin nhắn vào ô chat). — [Nguồn #20] (confidence: low)
  - → Mọi cách thao tác hiện có đều **không chính thức** và **dễ hỏng khi Antigravity cập nhật**.
- **Nhận biết trạng thái conversation:** bài học từ Pixel Agents (với Claude Code) là đọc transcript chỉ cho kết quả **phỏng đoán**. Chưa rõ Antigravity có hook hay sự kiện tương đương không. — [Nguồn #13] (confidence: medium cho Claude Code, chưa biết với Antigravity)

### Thời tiết thực tế

- **Open-Meteo**: miễn phí cho **mục đích phi thương mại**, **không cần API key**, giới hạn khoảng **10.000 request/ngày** (vượt thì phải liên hệ). Dữ liệu theo **CC BY 4.0**, nên **bắt buộc ghi nguồn và đặt link** cạnh chỗ hiển thị dữ liệu. Muốn dùng thương mại thì phải liên hệ. — [Nguồn #21, #22] (confidence: medium)
- Với 5 thành phố cố định, chỉ cần vài request mỗi giờ, nên còn rất xa giới hạn. — ASSUMPTION, tính toán đơn giản (confidence: high)

### Nền tảng & Đóng gói

- **Chạy trên trình duyệt:** trình duyệt **không đọc được file trên máy** (ví dụ `~/.gemini/...`), nên bắt buộc phải có một **tiến trình phía server/local** làm cầu nối với Antigravity. — ASSUMPTION, dựa trên mô hình bảo mật chung của trình duyệt (confidence: high)
- **Đóng gói** (người dùng đã chốt ngày 2026-11-06): **bỏ Docker**, chạy **local** kèm **hướng dẫn cài đặt** cho các máy khác. Nhờ vậy loại bỏ được vấn đề mount thư mục và mạng từ container về máy host. — [nguồn: người dùng] (confidence: high)
- **"Cài lên máy khác"**: dữ liệu Antigravity nằm trên từng máy, nên mỗi máy cài sẽ chỉ thấy conversation của chính máy đó, trừ khi có cơ chế truy cập từ xa. — ASSUMPTION (confidence: medium)
- **Khác biệt giữa các hệ điều hành**: đường dẫn `~/.gemini/antigravity/` dựa trên thư mục home nên có thể giống nhau trên mọi hệ điều hành. Còn `userData` của Electron và vị trí cài App thì khác nhau giữa macOS, Windows và Linux. Mới chỉ kiểm chứng trên macOS. — ASSUMPTION (confidence: medium)

### Đồ hoạ 3D

- Phong cảnh 5 thành phố, công cụ xây văn phòng, nhân vật có hoạt ảnh theo trạng thái và góc nhìn thứ nhất là **khối lượng tài nguyên 3D (asset) lớn**. Chưa có nguồn asset hay ràng buộc bản quyền nào được xác định. — ASSUMPTION (confidence: medium)
- Hiệu năng WebGL trên máy cấu hình yếu khi có nhiều nhân vật cùng chuyển động chưa được kiểm chứng. — ASSUMPTION (confidence: low)

## Bằng chứng chống lại ý tưởng

- **Nền móng tích hợp (đã giảm rủi ro sau khi kiểm tra trên máy):** CLI `agy` có cờ chính thức để tiếp tục conversation theo ID và có server ACP. Tuy vậy, việc **đọc danh sách và trạng thái** vẫn phải dựa vào file SQLite nội bộ không được công bố (`conversation_summaries.db`). Schema của file này có thể đổi giữa các phiên bản, ví dụ ngay trên máy đã có hai thư mục `antigravity` và `antigravity-cli` với dữ liệu khác nhau. Các SDK và công cụ không chính thức trên web vẫn dễ hỏng. — [kiểm tra trên máy; Nguồn #1, #2, #3, #18–#20] (confidence: medium)
- **Thao tác với App phụ thuộc vào cơ chế nội bộ (rủi ro đã giảm nhưng vẫn còn):** `agy agentapi` **đã chạy được** với App (tạo conversation, gửi tin nhắn, đọc metadata). Nhưng để chạy được, hệ thống phải tự lấy cổng ngẫu nhiên và CSRF token từ tiến trình `language_server` của App. Các biến `ANTIGRAVITY_LS_ADDRESS` và `ANTIGRAVITY_CSRF_TOKEN` vốn dành cho agent bên trong App và không được công bố. Google có thể đổi cơ chế này bất cứ lúc nào. Ngoài ra **App phải đang mở** thì mới thao tác được. — [chạy thử trên máy] (confidence: high)
- **Hiển thị trạng thái chính xác là khó:** ngay cả với Claude Code, vốn có transcript rõ ràng hơn, các dự án tương tự vẫn chỉ đoán được trạng thái. Nếu nhân viên hiển thị sai trạng thái, phép ẩn dụ sẽ mất tác dụng và gây nhầm lẫn. — [Nguồn #13] (confidence: medium)
- **Thị trường đã đông:** có ít nhất khoảng 10 dự án "văn phòng cho AI agent", vài dự án đã là 3D và có tương tác (Claw3D, agent-office-3d, AI Office). Nếu Antigravity được các dự án này hỗ trợ, ví dụ Roster đã hỗ trợ Gemini CLI, thì phần khác biệt sẽ thu hẹp. — [Nguồn #4–#16] (confidence: medium)
- **Giá trị cốt lõi là cảm xúc, không phải năng suất:** công cụ gốc vẫn hoạt động. Hiệu ứng mới lạ của giao diện "game hoá" có thể giảm nhanh, và thao tác qua cảnh 3D có thể **chậm hơn** giao diện danh sách khi cần làm việc thật. — ASSUMPTION (confidence: low)
- **Phạm vi đồ hoạ rất lớn so với một dự án cá nhân:** 5 thành phố, công cụ xây dựng, hoạt ảnh nhân vật, hai chế độ camera, thời tiết và chế độ sáng/tối. — ASSUMPTION (confidence: medium)
- ~~Đóng gói Docker xung đột với việc truy cập file trên máy host~~ → Không còn là rủi ro, vì người dùng đã chọn chạy local, không dùng Docker.
- **Rủi ro điều khoản:** chưa kiểm tra điều khoản sử dụng của Antigravity có cấm đọc dữ liệu nội bộ hoặc tự động hoá giao diện hay không. — [CẦN LÀM RÕ]

## Khoảng trống & Câu hỏi mở

- ~~Phiên bản Antigravity đang dùng~~ → **Đã trả lời**: ứng dụng desktop Antigravity **2.24.0** (bản độc lập, không phải IDE fork VS Code) và CLI `agy` **1.5.1** trên macOS. Xem mục "Kiểm tra trên máy".
- ~~Mục tiêu sync là App hay CLI~~ → **Đã trả lời**: **Antigravity App**. Đã kiểm chứng App lưu dữ liệu ở `~/.gemini/antigravity/`, tách biệt khỏi CLI.
- ~~`agy agentapi` có tác động lên conversation của App không~~ → **Đã kiểm chứng: CÓ** (xem mục "Thử nghiệm thao tác trực tiếp với App"). Đã quan sát được hai trạng thái `IDLE` và `RUNNING`.
- ~~Trạng thái chờ duyệt và lỗi~~ → **Một phần đã rõ**: App có trạng thái bước `WAITING` và `ERROR` (đọc từ binary), nhưng chưa quan sát trực tiếp.
- [CẦN LÀM RÕ: Định dạng `interaction` của `HandleCascadeUserInteraction` để duyệt hoặc từ chối quyền. Cần thử khi App ở chế độ hỏi quyền, ví dụ đổi cài đặt auto-run hoặc dùng một tool luôn hỏi quyền.]
- [CẦN LÀM RÕ: Cách gọi đúng `GetMatchingContextScopeItems`/`SearchContext` để gợi ý file khi gõ `@` (có lẽ cần workspace của conversation).]
- [CẦN LÀM RÕ: Thử `StreamCascadeReactiveUpdates` để nhận cập nhật theo thời gian thực thay vì đọc định kỳ.]
- ~~Dừng agent từ bên ngoài~~ → **Đã kiểm chứng: được** (`CancelCascadeInvocation`).
- ~~Lệnh `/` và `@` qua API~~ → **Đã kiểm chứng: được** (`SendUserCascadeMessage`).
- ~~Giao diện App có hiển thị conversation tạo từ bên ngoài không~~ → **Đã xác nhận: CÓ.** Người dùng thấy conversation "3d-agent-office test" trong App (2026-11-06). [nguồn: người dùng] (confidence: high)
- [CẦN LÀM RÕ: Có cách nào ổn định, nhẹ hơn để biết cổng và token của App thay vì đọc tham số tiến trình? Trên Windows và Linux việc này làm thế nào?]
- [CẦN LÀM RÕ: Ngoài `CASCADE_RUN_STATUS_IDLE`, cột `status` còn những giá trị nào (đang chạy, chờ duyệt, lỗi)? Cần quan sát `conversation_summaries.db` trong lúc agent đang chạy. ACP có đẩy sự kiện trạng thái theo thời gian thực không?]
- [CẦN LÀM RÕ: Gửi tin nhắn bằng `agy --conversation <ID> -p` khi conversation đó đang mở trong ứng dụng desktop thì có xung đột không? Ứng dụng desktop có cập nhật ngay không?]
- [CẦN LÀM RÕ: Có thể chấp nhận dùng cách **không chính thức** (extension tự viết, Chrome DevTools Protocol, đọc SQLite) để thao tác không, khi biết chúng có thể hỏng sau mỗi lần cập nhật?]
- [CẦN LÀM RÕ: Điều khoản sử dụng của Antigravity có giới hạn gì về việc đọc dữ liệu local hoặc tự động hoá không?]
- [CẦN LÀM RÕ: Các dự án Claw3D, agent-office-3d, Roster có cho phép thêm "adapter" Antigravity không? Có thể **mở rộng một dự án có sẵn** thay vì làm từ đầu không? (Cần đọc trực tiếp repo để kiểm chứng.)]
- [CẦN LÀM RÕ: Dự án có định dùng cho mục đích thương mại không? Điều này ảnh hưởng đến điều khoản của Open-Meteo và bản quyền asset 3D.]
- [CẦN LÀM RÕ: "Máy khác" là máy cũng đã cài Antigravity, hay truy cập từ xa vào một máy trung tâm?]

## Nguồn

Tất cả đều là **kết quả tìm kiếm web, không mở trực tiếp** (policy: `search-result only — not fetched`; công cụ fetch không ghim được IP kết nối nên không fetch). Mọi URL đã được rút gọn, chỉ giữ scheme + host + path.

1. https://codelabs.developers.google.com/getting-started-google-antigravity (host: codelabs.developers.google.com), và các trang docs https://antigravity.google/docs/overview/ , https://antigravity.google/docs/agent/ , https://antigravity.google/docs/features/ (host: antigravity.google)
2. https://dev.to/ndondadaniel2020/how-to-restore-lost-chat-history-in-google-antigravity-ide-reverse-engineering-the-plan-mystery-15og (host: dev.to)
3. https://marketplace.visualstudio.com/items (itemName=Unchase.antigravity-storage-manager; host: marketplace.visualstudio.com)
4. https://sourceforge.net/projects/claw3d.mirror/ (host: sourceforge.net)
5. https://bagidea.github.io/bagidea-office (host: bagidea.github.io)
6. https://peerlist.io/lndev/project/roster--an-office-for-your-coding-agents (host: peerlist.io)
7. https://dev.to/harishkotra/how-i-built-agentoffice-self-growing-ai-teams-in-a-pixel-art-virtual-office-4o0p (host: dev.to)
8. https://skillsllm.com/skill/agent-office-3d (host: skillsllm.com)
9. https://gentic.news/article/open-source-ai-office-platform-lets-users-walk-through-3d-space-to-monitor-auton (host: gentic.news)
10. https://gentic.news/article/ai-agents-now-work-in-persistent-3d-office-simulators-raising-questions-about-di (host: gentic.news)
11. https://github.com/Mgpixelart/pixel-agent-desk (host: github.com)
12. https://cdn.jsdelivr.net/gh/paulrobello/claude-office@main/README.md (host: cdn.jsdelivr.net)
13. https://github.com/martinmunozhr/pixel-agents (host: github.com)
14. https://apps.apple.com/ca/app/pixelhq/id6758467298 (host: apps.apple.com)
15. https://awesome.ecosyste.ms/projects/github.com%2FIvanWng97%2Fpixtuoid (host: awesome.ecosyste.ms)
16. https://awesome.ecosyste.ms/projects/github.com%2Fractive%2Fclawffice (host: awesome.ecosyste.ms); https://www.producthunt.com/products/clawoffice/makers (host: www.producthunt.com)
17. https://antigravity.google/blog/visualizing-with-the-help-of-antigravity (host: antigravity.google)
18. https://github.com/Kanezal/antigravity-sdk (host: github.com)
19. https://pypi.org/project/antigravity-automation/0.42.0/ (host: pypi.org)
20. https://openskillindex.com/skills/jackwener-opencli-antigravity-a8adcb (host: openskillindex.com)
21. https://dev.to/0012303/open-meteo-has-a-free-weather-api-no-key-no-signup-real-forecast-data-2nna (host: dev.to)
22. https://github.com/schicho/open-meteo (host: github.com)
