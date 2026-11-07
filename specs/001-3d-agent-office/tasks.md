---

description: "Task list for 001-3d-agent-office"
---

# Tasks: Văn phòng 3D cho agent trên Antigravity App

**Input**: Design documents from `/specs/001-3d-agent-office/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/app-adapter.md,
contracts/local-api.md, quickstart.md

**Tests**: Spec không yêu cầu TDD. Tuy nhiên **Constitution bắt buộc** contract test cho lớp kết
nối App (Nguyên tắc II), kiểm tra rò rỉ thông tin (Nguyên tắc III, SC-009) và đo FPS (Nguyên tắc
V). Vì vậy chỉ những test này được đưa vào. Các test khác là tuỳ chọn.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US8 theo spec.md)
- Đường dẫn theo cấu trúc **một package** trong plan.md: `src/server`, `src/web`, `src/shared`,
  `tests/`, `assets/`, `scripts/`, `docs/`

## Quy ước cho người thực hiện

- Mọi lời gọi tới Antigravity App **chỉ** được nằm trong `src/server/app-adapter/` (Constitution II).
- Không bao giờ log, lưu ra file hay trả về trình duyệt các giá trị CSRF token, `name`, `email`,
  hay nội dung tin nhắn (FR-081). Luôn dùng logger trong `src/server/log.ts`.
- Khi thử với App thật, chỉ dùng conversation có tiền tố `[agent-office-test]` và dọn sau khi thử.
- Tên RPC, header và định dạng request đã kiểm chứng nằm trong `research.md` R6, R8, R9 và
  `.specify/assessments/3d-agent-office/research.md`.
- **Đăng ký route**: mọi file trong `src/server/http/routes/` export một Fastify plugin, và PHẢI
  được đăng ký trong `src/server/http/routes/index.ts` (hàm `registerRoutes`) ngay trong task tạo
  route đó.
- **Không tải tài nguyên từ Internet khi chạy** (FR-082): mọi model, texture, HDR, font phải nằm
  trong `assets/`. Không dùng các preset của drei tải từ CDN (`<Environment preset=…>`, font mặc
  định của `<Text>`…). Phải truyền file local.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Khởi tạo dự án và công cụ

- [X] T001 Cài Node.js 22 LTS qua `fnm` trên máy phát triển (`curl -fsSL https://fnm.vercel.app/install | bash`, rồi `fnm install 22 && fnm default 22`), kiểm tra `node -v` ≥ 22
- [X] T002 Tạo `package.json` (một package, `"type": "module"`, `"engines": {"node": ">=22"}`) với các scripts `dev`, `build`, `start`, `test`, `test:e2e`, `test:live`, `test:leaks`, `bench:fps`, `typecheck`, `lint` ở thư mục gốc
- [X] T003 Cài dependency server: `fastify@5`, `@fastify/websocket`, `@fastify/static`, `zod`, `pino`, `env-paths`, `open`; dev: `typescript`, `tsx`, `@types/node`
- [X] T004 Cài dependency web: `react@19`, `react-dom@19`, `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `react-markdown`, `remark-gfm`, `shiki`; dev: `vite@6`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/three`
- [X] T005 Cài dependency test: `vitest`, `@playwright/test`; chạy `npx playwright install chromium`
- [X] T006 [P] Tạo `tsconfig.json` (strict, `moduleResolution: bundler`, alias `@shared/*` → `src/shared/*`), `tsconfig.server.json` (target Node 22) ở thư mục gốc
- [X] T007 [P] Tạo `vite.config.ts`: root `src/web`, build ra `dist/web`, plugin React, alias `@shared`, proxy `/api` và `/ws` tới `http://127.0.0.1:4317` khi `dev`
- [X] T008 [P] Cấu hình ESLint + Prettier trong `eslint.config.js` và `.prettierrc`. Thêm luật `no-restricted-imports`: mọi file **bên ngoài** `src/server/app-adapter/` chỉ được import `src/server/app-adapter/index.ts` (API công khai của adapter), cấm import các file con (`rpc-client.ts`, `discovery/**`, `mappers/**`…). `src/web/**` không được import adapter. Đây là cách bảo vệ Constitution II
- [X] T009 [P] Tạo khung thư mục theo plan.md: `src/shared/`, `src/server/{http,app-adapter/{discovery,mappers},services,storage}/`, `src/web/{api,state,scene/{grid,park,city,weather,cameras,perf},ui/{chat,quota,build,settings},bench}/`, `assets/models/`, `tests/{unit,contract/fixtures/app-2.24.0,e2e,live,leaks}/`, `scripts/`, `docs/`
- [X] T010 [P] Tạo `vitest.config.ts` (môi trường node cho `tests/unit`, `tests/contract`, `tests/leaks`; `tests/live` chỉ chạy khi `AGENT_OFFICE_LIVE=1`) và `playwright.config.ts` (chạy `tests/e2e`, webServer khởi động server với App giả lập)

**Checkpoint**: `npm run typecheck` và `npm test` chạy được (chưa có test nào).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Kiểu dữ liệu chung, lớp kết nối App, server có bảo mật, kho lưu trữ và client web. Mọi user story đều cần các phần này.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Kiểu dữ liệu chung

- [X] T011 Định nghĩa toàn bộ kiểu miền nghiệp vụ trong `src/shared/domain.ts` theo data-model.md: `Conversation`, `Step` (với `kind: 'user' | 'agent' | 'thinking' | 'tool' | 'command' | 'file_view' | 'file_change' | 'system' | 'permission_request' | 'error' | 'other'`), `Employee`, `EmployeeProfile`, `OfficeLayout`/`PlacedItem` (với `rotation: 0 | 90 | 180 | 270`, `cellSize: 0.5`), `RunStatus` (`IDLE | RUNNING | BUSY | CANCELING | UNKNOWN`), `StepStatus`, `VisualState` (`disconnected | waiting_for_boss | error | thinking | working | stopped | idle | unknown`), `Quota`/`QuotaGroup`, `Command`, `Mention`, `Settings`, `WeatherSnapshot`, `ConnectionState`, `UserInput`, `ModelOption`
- [X] T012 [P] Định nghĩa schema `zod` tương ứng cho dữ liệu đi qua local API và file lưu trữ trong `src/shared/schemas.ts` (`Settings.city` thuộc `'hanoi' | 'hcmc' | 'singapore' | 'tokyo' | 'newyork'`, `detailLevel` thuộc `'low' | 'medium' | 'high'`, mọi file có `schemaVersion: 1`)
- [X] T013 [P] Định nghĩa các thông điệp WebSocket (`connection`, `employees.snapshot`, `employees.patch`, `steps.append`, `quota`, `warning`; client gửi `watch`, `unwatch`) và mã lỗi (`APP_UNAVAILABLE`, …) theo contracts/local-api.md trong `src/shared/protocol.ts`

### Log và lưu trữ

- [X] T014 [P] Tạo logger `pino` có bộ lọc che (redact) các khoá `csrf`, `csrfToken`, `token`, `authorization`, `email`, `name`, `text`, `content`, `message_text`, `userResponse`, kèm hàm `redactString()` thay chuỗi giống token hoặc email bằng `[REDACTED]`, trong `src/server/log.ts`
- [X] T015 [P] Viết module đọc/ghi JSON atomic (ghi `*.tmp` rồi `rename`), có kiểm tra bằng schema và migrate theo `schemaVersion`, thư mục gốc là `~/Library/Application Support/agent-office/` (dùng `env-paths`, tạo nếu chưa có, quyền `0700`), trong `src/server/storage/json-store.ts`

### Lớp kết nối Antigravity App (Constitution II, contracts/app-adapter.md)

- [X] T016 Định nghĩa interface `AppAdapter`, `ConnectionState`, lỗi `AppUnavailableError` và `AppProtocolError` đúng như contracts/app-adapter.md, trong `src/server/app-adapter/types.ts`
- [X] T017 [P] Định nghĩa interface `ProcessFinder { findLanguageServer(): Promise<{pid, args: string[]} | null>; listListeningPorts(pid): Promise<number[]> }` trong `src/server/app-adapter/discovery/process-finder.ts`, kèm factory chọn theo `process.platform`. Platform khác `darwin` thì ném lỗi "Linux/Windows chưa hỗ trợ" (Constitution VI v2.0.0)
- [X] T018 [P] Viết `DarwinProcessFinder` trong `src/server/app-adapter/discovery/process-darwin.ts`: chạy `ps -axo pid=,args=` (dùng `execFile`, không dùng shell). Chọn tiến trình có `language_server` cùng tham số `--app_data_dir antigravity` và `--subclient_type hub`. Lấy cổng bằng `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN`, chỉ nhận địa chỉ `127.0.0.1`
- [X] T019 [P] Viết hàm tách tham số trong `src/server/app-adapter/discovery/args.ts`: lấy `csrfToken` (`--csrf_token <v>` hoặc `--csrf_token=<v>`) và `appVersion` (`--override_ide_version`). Token không bao giờ được log
- [X] T020 Viết `RpcClient` trong `src/server/app-adapter/rpc-client.ts`: `call<T>(method, body)` gửi `POST https://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/<method>` với `Content-Type: application/json` và header `x-codeium-csrf-token`. Dùng một `https.Agent({ rejectUnauthorized: false })` **riêng** chỉ cho host `127.0.0.1`, timeout mặc định 10 giây. Ánh xạ 401/403 thành lỗi `auth`, lỗi kết nối thành `unreachable`, lỗi JSON thành `protocol`
- [X] T021 Viết `probe.ts` trong `src/server/app-adapter/discovery/probe.ts`: thử từng cổng bằng `GetAllWorkflows` với body `{}`. Cổng đầu tiên trả HTTP 200 là cổng API
- [X] T022 Viết `ConnectionManager` trong `src/server/app-adapter/connection.ts`: vòng dò tìm và kiểm tra sức khoẻ mỗi 2 giây (R6). Trạng thái: `searching` → `connected {appVersion, versionSupported: appVersion === '2.24.0'}` → dò lại khi PID mất, cổng đổi hoặc gặp lỗi `auth`. Có `onConnectionChange`. Mục tiêu kết nối lại ≤ 10 giây (SC-010)
- [X] T023 **Ghi fixture**: export từ `src/server/app-adapter/index.ts` một hàm chỉ dùng khi phát triển `recordRaw(method, body)` (chỉ cho phép các RPC đọc trong danh sách trắng, trả JSON thô đã qua `redact`). Viết script `scripts/record-fixtures.ts` **chỉ import `index.ts`** (không tự viết client RPC riêng, Constitution II) để gọi App thật (chỉ đọc) các RPC `GetAllCascadeTrajectories`, `GetCascadeTrajectorySteps` (một conversation `[agent-office-test]`), `GetUserStatus`, `GetSlashCommands`, `GetAllSkills`. Thay mọi `name`, `email`, token, đường dẫn home và nội dung tin nhắn bằng giá trị giả trước khi ghi vào `tests/contract/fixtures/app-2.24.0/*.json`. Chạy script và commit fixture
- [X] T024 [P] Viết mapper conversation trong `src/server/app-adapter/mappers/conversation.ts`: `trajectorySummaries` → `Conversation[]` (`summary` rỗng thì `title = "Nhân viên mới"`; `status` lạ thì `runStatus = 'UNKNOWN'`)
- [X] T025 [P] Viết mapper step trong `src/server/app-adapter/mappers/step.ts`: `CORTEX_STEP_TYPE_*` → `Step.kind` (`USER_INPUT`→user, `PLANNER_RESPONSE`→agent kèm `thinking` và `toolCalls`, `RUN_COMMAND`→command, `VIEW_FILE`→file_view, `CODE_ACTION`→file_change, `SYSTEM_MESSAGE`→system, loại khác→`other`). `CORTEX_STEP_STATUS_*` → `StepStatus`. Không sập khi thiếu trường (A5)
- [X] T026 Viết `createAppAdapter()` trong `src/server/app-adapter/index.ts`, nối `ConnectionManager` + `RpcClient` + mapper. Cài đặt `start`, `stop`, `getConnection`, `onConnectionChange`, `listConversations`, `getSteps`, `listProjects` (theo trường hoặc RPC tìm được ở spike T028). Khi chưa kết nối thì ném `AppUnavailableError` trong ≤ 3 giây (A1)
- [X] T027 [P] Contract test cho adapter trong `tests/contract/adapter-read.test.ts`, dùng fixture cộng một `ProcessFinder` và `RpcClient` giả: A1 (không có App), A2 (đổi PID/cổng → kết nối lại), A3 (sai phiên bản → `versionSupported=false`), A5 (fixture bị xoá trường hoặc có loại bước lạ)
- [X] T028 **Spike (R7, R8)** với App thật bằng conversation `[agent-office-test]`:
  (a) tham số `StartCascade` để tạo conversation mới;
  (b) `StreamCascadeReactiveUpdates` (luồng cập nhật);
  (c) bước `PLANNER_RESPONSE` ở trạng thái `GENERATING` có chứa `response` từng phần không (phục vụ FR-023);
  (d) **nguồn dữ liệu project**: trường nào trong `GetAllCascadeTrajectories`/metadata cho `projectId`, và RPC nào liệt kê tên project (thử trong 674 RPC, ví dụ các RPC có chữ `Project`; dự phòng là đọc `~/.gemini/config/projects/*.json` **bên trong adapter**).
  Ghi kết quả và định dạng request vào `specs/001-3d-agent-office/research.md` (R7/R8, "Kết quả spike") và `data-model.md` §1 (nguồn `projectId`), rồi dọn conversation thử
- [X] T029 **Spike trạng thái chờ và lỗi (phục vụ US1 kịch bản 3)**: nhờ người dùng tạm bật chế độ "hỏi trước khi chạy lệnh" trong Antigravity App. Cho conversation `[agent-office-test] wait` yêu cầu chạy một lệnh, ghi lại bước `WAITING` (cấu trúc yêu cầu xin quyền) và một bước `ERROR` (ví dụ chạy lệnh không tồn tại) qua `GetCascadeTrajectorySteps`. Lưu fixture đã làm sạch vào `tests/contract/fixtures/app-2.24.0/waiting-*.json` và `error-*.json`, ghi vào `research.md` R8, rồi dọn conversation và nhắc người dùng trả lại cài đặt

### Server local có bảo mật (R11, contracts/local-api.md)

- [X] T030 Viết Fastify app trong `src/server/http/app.ts`: chỉ `listen({ host: '127.0.0.1', port: AGENT_OFFICE_PORT ?? 4317 })`. Phục vụ `dist/web` bằng `@fastify/static`. Đăng ký `@fastify/websocket` tại `/ws`. Tạo `src/server/http/routes/index.ts` với hàm `registerRoutes(app, deps)` (ban đầu rỗng) và gọi nó từ `app.ts`
- [X] T031 Viết middleware bảo mật trong `src/server/http/security.ts`: `Host` phải là `127.0.0.1:<port>` hoặc `localhost:<port>` (ngược lại `421`); có `Origin` thì phải cùng nguồn (ngược lại `403`); `Authorization: Bearer <sessionToken>` bắt buộc với `/api/*` (ngược lại `401`); WebSocket kiểm tra `?k=<sessionToken>`. `sessionToken` là 32 byte ngẫu nhiên, tạo khi khởi động. Lỗi trả dạng `{ error: { code, message } }`
- [X] T032 [P] Viết route `GET /api/health` trả `{ connection, serverVersion }` trong `src/server/http/routes/health.ts`
- [X] T033 Viết hub WebSocket trong `src/server/http/ws-hub.ts`: quản lý client, phát `connection` và `warning` (`APP_VERSION_UNSUPPORTED`), nhận `watch`/`unwatch`, gửi `employees.snapshot` khi client kết nối
- [X] T034 Viết `src/server/main.ts`: khởi động adapter và server, in `Agent Office running at http://127.0.0.1:<port>/#k=<token>` cùng trạng thái App, tự mở trình duyệt bằng `open`. Tắt gọn gàng khi nhận SIGINT/SIGTERM
- [X] T035 [P] Test rò rỉ trong `tests/leaks/redaction.test.ts`: cho logger và các route xử lý fixture có token, email và nội dung giả, rồi quét toàn bộ output log và thư mục cấu hình tạm, khẳng định không có các giá trị đó (SC-009)
- [X] T036 [P] Viết `scripts/check-guards.sh` (được gọi bởi `npm test` ngay từ Đợt 1, các kiểm tra tự áp dụng khi có thêm mã), gồm 3 kiểm tra: (a) Constitution II: không có chuỗi `exa.`, `csrf`, `language_server`, `.gemini` bên ngoài `src/server/app-adapter/` và `tests/contract/`; (b) FR-082: không có URL `http(s)://` ngoài `127.0.0.1`, `localhost` và `api.open-meteo.com`/`open-meteo.com` (link ghi nguồn) trong `src/` và trong bundle `dist/web`; (c) FR-030: các lời gọi ghi của adapter (`sendMessage`, `startConversation`, `cancel`, `answerPermission`) chỉ xuất hiện trong `src/server/http/routes/`, tức chỉ chạy khi có request từ người dùng, không có trong service hay timer. Kiểm tra bundle `dist/web` chỉ chạy khi thư mục đó đã tồn tại

### Client web nền tảng

- [X] T037 [P] Viết client API trong `src/web/api/client.ts`: đọc `sessionToken` từ `location.hash` (`#k=`), lưu trong `sessionStorage` rồi xoá khỏi URL. `fetch` có `Authorization: Bearer`. Lỗi `503 APP_UNAVAILABLE` được ném dạng có kiểu
- [X] T038 [P] Viết client WebSocket trong `src/web/api/ws.ts`: kết nối `/ws?k=`, tự kết nối lại với backoff (tối đa 5 giây), nhận lại `employees.snapshot` khi kết nối lại
- [X] T039 Tạo các store `zustand` trong `src/web/state/`: `connection.ts`, `employees.ts` (áp `employees.patch`), `ui.ts` (conversation đang mở, chế độ camera), `settings.ts`
- [X] T040 Tạo khung ứng dụng trong `src/web/main.tsx` và `src/web/App.tsx`: `<Canvas>` của R3F chiếm toàn màn hình, lớp UI 2D phía trên, banner trạng thái kết nối (`searching` → "Chưa kết nối được Antigravity App — hãy mở App", cảnh báo phiên bản)

**Checkpoint**: `npm start` mở được trang. Banner hiển thị đúng `connected`/`searching` khi mở hoặc đóng App. Contract test, test rò rỉ và `scripts/check-guards.sh` đều qua.

---

## Phase 3: User Story 1 - Nhìn thấy đội nhân viên làm việc theo trạng thái thật (Priority: P1) 🎯 MVP

**Goal**: Văn phòng mặc định với tối đa 20 nhân viên. Mỗi conversation là một nhân viên có tên. Hoạt ảnh theo trạng thái thật, cập nhật ≤ 2 giây. Có hành động ngẫu nhiên khi rảnh. Nhân viên mới tự vào bàn.

**Independent Test**: quickstart V1. Cho agent chạy trong App, kiểm tra nhân viên chuyển `working`/`thinking` trong ≤ 2 giây rồi về `idle`. Đóng App thì văn phòng chuyển `disconnected`, mở lại App thì kết nối lại ≤ 10 giây.

### Tests for User Story 1

- [X] T041 [P] [US1] Unit test bảng ưu tiên VisualState trong `tests/unit/visual-state.test.ts`: đủ 8 dòng của data-model §6 (gồm `waiting_for_boss` khi bước cuối `WAITING`, `unknown` khi trạng thái lạ) và luật "`stopped` và `error` trở về `idle` khi có tin nhắn mới hoặc sau 10 phút"

### Implementation for User Story 1

- [X] T042 [P] [US1] Viết hàm thuần `computeVisualState(conversation, lastStep, connection)` theo **đúng thứ tự ưu tiên** ở data-model §6 trong `src/server/services/visual-state.ts`
- [X] T043 [P] [US1] Viết kho hồ sơ nhân viên trong `src/server/services/employee-profiles.ts`, dùng `json-store` với file `employees.json` `{ schemaVersion: 1, profiles: { [conversationId]: { appearance, deskId|null } } }`. `appearance` mặc định lấy từ hash(conversationId) để ổn định giữa các lần mở. Dọn hồ sơ của conversation không còn tồn tại sau 30 ngày
- [X] T044 [P] [US1] Viết bố cục mặc định trong `src/server/services/default-layout.ts` (FR-054): 12 bàn và 12 ghế, 1 máy nước, 1 sofa, 1 `wall_screen` (vị trí màn hình quota), cây cảnh, `glass_wall` phía công viên, 1 cửa. Kèm `src/server/services/layout-store.ts` đọc/ghi `layout.json` (trả bố cục mặc định nếu chưa có)
- [X] T045 [US1] Viết `EmployeesService` trong `src/server/services/employees.ts`: poll `listConversations()` **mỗi 1 giây** (R7), lấy bước cuối của các conversation đang `RUNNING`/`BUSY` hoặc vừa đổi `stepCount`, gộp hồ sơ, tính `VisualState`. Chọn tối đa **20** nhân viên `visible` theo `lastActivityAt` (FR-004), tính `overflow`. Gán bàn trống cho nhân viên mới. Tính `projectColor` từ hash(projectId). Một trạng thái mới chỉ được công nhận sau 1 lần lấy dữ liệu. Phát `employees.patch` `{ upserted, removed }` qua ws-hub
- [X] T046 [US1] Viết route `GET /api/employees` (trả `Employee[]` cùng `overflow`), `GET /api/layout` và `GET /api/projects` (trả `Project[]` = `{ id, name, color }` từ `adapter.listProjects()`, màu ổn định theo hash(id)) trong `src/server/http/routes/employees.ts`
- [X] T047 [P] [US1] Thêm tài nguyên 3D CC0 vào `assets/models/`: nhân vật Quaternius (rig có hoạt ảnh Idle, Sit, Typing, Thinking, RaiseHand, HoldHead, Walk, Stretch, Drink) và đồ văn phòng Kenney Furniture Kit (bàn, ghế, tường, vách kính, cửa, cây, máy nước, sofa, màn hình). Nén bằng `gltf-transform` (Meshopt + KTX2). Ghi nguồn và giấy phép vào `assets/LICENSES.md`
- [X] T048 [P] [US1] Viết bản đồ ô và A* trong `src/web/scene/grid/grid.ts` và `src/web/scene/grid/astar.ts` (ô 0,5 m; tường và vách kính chặn cạnh ô; đồ vật chặn ô theo footprint)
- [X] T049 [US1] Viết component `Office` trong `src/web/scene/Office.tsx`: vẽ sàn, tường và đồ vật từ `OfficeLayout`, dùng instancing cho đồ vật lặp lại. Chỉ văn phòng và nhân viên có đổ bóng (R4). Ánh sáng môi trường dùng file HDR hoặc lightformer **local** trong `assets/`, không dùng `<Environment preset>` (FR-082)
- [X] T050 [US1] Viết component `Employee` trong `src/web/scene/Employee.tsx`: tải nhân vật theo `appearance`, phát hoạt ảnh theo bảng R5 (idle→ngồi, thinking→chống cằm, working→gõ phím, waiting_for_boss→giơ tay + biểu tượng "!", error→ôm đầu + biểu tượng đỏ, stopped→ngồi yên + biểu tượng xám, unknown→mờ + "?", disconnected→đứng yên). Hiển thị nhãn tên và chấm màu project. Hoà trộn hoạt ảnh mượt khi đổi trạng thái
- [X] T051 [US1] Viết hành vi ngẫu nhiên khi `idle` trong `src/web/scene/employee-behaviors.ts`: hẹn giờ **5 phút ± 2 phút** cho mỗi nhân viên, xen kẽ để không ai đứng dậy cùng lúc (FR-012). Hành động: vươn vai tại chỗ, hoặc đi bằng A* tới máy nước, uống, rồi quay về **đúng bàn**. Hành động bị huỷ ngay khi trạng thái rời `idle`
- [X] T052 [US1] Viết vòng đời vào/ra trong `src/web/scene/employee-lifecycle.ts`: nhân viên mới đi từ cửa vào bàn (`entering`). Nhân viên bị xoá đi ra cửa rồi biến mất (`leaving`). Nhân viên không có bàn đứng ở khu chờ cạnh cửa
- [X] T053 [US1] Viết camera toàn cảnh trong `src/web/scene/cameras/Overview.tsx` bằng `CameraControls` của drei (xoay, phóng to, kéo, có giới hạn góc và khoảng cách) (FR-014)
- [X] T054 [US1] Viết hiệu ứng `disconnected` trong `src/web/scene/OfficeMood.tsx`: văn phòng tối và mờ, nhân viên đứng yên, kèm banner. Trở lại bình thường khi `connected`
- [X] T055 [P] [US1] Viết danh sách "nhân viên khác" (phần `overflow` ngoài 20 người) dưới dạng thanh bên có thể mở, trong `src/web/ui/OverflowList.tsx`
- [X] T056 [P] [US1] Viết chú giải màu project (tên lấy từ `GET /api/projects`) và bộ lọc hoặc làm nổi bật theo project (FR-013) trong `src/web/ui/ProjectLegend.tsx`
- [X] T057 [US1] Thể hiện subagent trong `src/web/scene/Employee.tsx` và `src/server/services/employees.ts`: subagent ngồi ở bàn trống gần nhân viên cha nhất, có đường nối mảnh tới cha. Nếu không còn bàn trống thì gom thành huy hiệu số trên nhân viên cha
- [X] T058 [US1] Viết **lõi benchmark FPS** trong `src/web/bench/Bench.tsx` (route `/bench`) và script `bench:fps` trong `scripts/bench-fps.ts` (Playwright mở Chrome 1920×1080 tại `/bench`): 20 nhân viên giả với trạng thái thay đổi mỗi 2 giây trong bố cục mặc định, camera bay theo lộ trình cố định trong 60 giây. In FPS trung bình và p1, thoát mã lỗi nếu trung bình < 60 (SC-004, cổng chất lượng 4). Benchmark được mở rộng thêm công viên ở US6
- [X] T059 [US1] Viết test độ trễ và độ khớp trạng thái với App thật trong `tests/live/latency.live.test.ts` (chỉ khi `AGENT_OFFICE_LIVE=1`): tạo conversation `[agent-office-test] latency` và cho agent làm một việc dài khoảng 60 giây. Trong ≥ 10 phút, lấy mẫu song song mỗi 250 ms `status` thật từ App (đọc qua adapter) và `VisualState` server đã phát. Khẳng định p95 độ trễ ≤ 2 giây (FR-003) và tỷ lệ khớp ≥ 99% (SC-002, cổng chất lượng 2). Dọn conversation sau khi chạy
- [X] T060 [P] [US1] Kiểm thử suy giảm có kiểm soát trong `tests/e2e/resilience.spec.ts` với App giả lập `tests/e2e/mock-app.ts` (tạo mock nếu chưa có): tắt App giả lập thì văn phòng chuyển `disconnected` và có banner (FR-006); bật lại thì kết nối lại ≤ 10 giây không cần tải lại trang (SC-010); App giả lập đổi cổng hoặc token thì tự dò lại (cổng chất lượng 1)

**Checkpoint**: chạy quickstart V1, `npm test` (gồm `check-guards.sh`), `npm run test:e2e -- resilience`, `npm run bench:fps` và `AGENT_OFFICE_LIVE=1 npm run test:live -- latency`. US1 dùng được độc lập.

---

## Phase 4: User Story 2 - Trò chuyện với nhân viên bằng 1 lần bấm (Priority: P1)

**Goal**: Bấm 1 lần vào nhân viên là mở chat đầy đủ lịch sử. Gửi tin như người dùng, câu trả lời hiện dần, chọn model, dừng agent, tuyển nhân viên mới.

**Independent Test**: quickstart V2. Bấm 1 lần mở chat. Tin gửi đi xuất hiện trong App như tin của người dùng. Dừng agent về idle trong ≤ 3 giây. Tạo conversation mới.

### Tests for User Story 2

- [X] T061 [P] [US2] Contract test ghi trong `tests/contract/adapter-write.test.ts` (dùng RPC giả): `sendMessage` gửi đúng `SendUserCascadeMessage {cascadeId, items[{text}|{item:{file:{absoluteUri}}}], cascadeConfig.plannerConfig.planModel}`; `cancel` gửi `CancelCascadeInvocation {cascadeId}`; `getModels` đọc `clientModelConfigs[]` từ fixture `GetUserStatus`
- [X] T062 [P] [US2] Live test trong `tests/live/chat.live.test.ts` (chỉ khi `AGENT_OFFICE_LIVE=1`): tạo conversation `[agent-office-test] chat`, gửi tin rồi kiểm tra bước mới là `USER_INPUT` (A6, không phải `SYSTEM_MESSAGE`), cancel rồi kiểm tra `IDLE` trong ≤ 3 giây (A7), cuối cùng dọn conversation

### Implementation for User Story 2

- [X] T063 [US2] Cài `sendMessage`, `cancel`, `getModels`, `startConversation` (dùng kết quả spike T028; dự phòng bằng `agy agentapi new-conversation` rồi `SendUserCascadeMessage`) và `watchConversation` (luồng nếu spike T028 thành công, nếu không thì poll `GetCascadeTrajectorySteps` mỗi 500 ms khi `RUNNING` và mỗi 5 giây khi rảnh) trong `src/server/app-adapter/index.ts` và `src/server/app-adapter/mappers/model.ts`
- [X] T064 [US2] Viết các route trong `src/server/http/routes/conversations.ts`: `GET /api/conversations/:id/steps?from=`, `POST /api/conversations/:id/messages` (`202`), `POST /api/conversations` (`201 {conversationId}`, nhận `deskId` tuỳ chọn để ghi vào hồ sơ), `POST /api/conversations/:id/cancel` (`202`), `GET /api/models`. Trả `503 APP_UNAVAILABLE` khi App chưa kết nối. Kiểm tra body bằng zod
- [X] T065 [US2] Nối `watch`/`unwatch` của ws-hub với `adapter.watchConversation` để đẩy `steps.append { conversationId, steps }` trong `src/server/http/ws-hub.ts`
- [X] T066 [US2] Bắt sự kiện bấm 1 lần trên nhân viên trong `src/web/scene/Employee.tsx` (raycast, con trỏ đổi thành bàn tay khi rê chuột): `ui.openConversation(id)`. Không cần double-click hay menu trung gian (FR-020, SC-003)
- [X] T067 [US2] Viết `ChatPanel` trong `src/web/ui/chat/ChatPanel.tsx`: khung bên phải, thu gọn hoặc đóng được, tiêu đề là tên nhân viên kèm trạng thái. Tải lịch sử qua `GET steps`, gửi `watch` khi mở và `unwatch` khi đóng. Cuộn xuống cuối khi có bước mới
- [X] T068 [US2] Xử lý "cùng lúc thao tác ở App và ở hệ thống" trong `src/web/ui/chat/ChatPanel.tsx` và `src/web/state/` (bước của conversation): gộp và khử trùng bước theo `index` khi tải lại lịch sử hoặc nhận `steps.append`, tin gửi từ App hiện ngay trong chat, không hiện tin nhắn trùng (Edge case)
- [X] T069 [P] [US2] Viết `StepView` trong `src/web/ui/chat/StepView.tsx`: hiển thị từng `Step.kind` (user, agent bằng markdown `react-markdown` + `remark-gfm`, code tô màu bằng Shiki với ngôn ngữ và theme **đóng gói local**; `thinking` thu gọn mặc định; `tool`/`command` có kết quả lệnh; `file_view` hiện đường dẫn; `file_change` hiện đường dẫn cùng tóm tắt thay đổi, **không hiện diff** trong tính năng này (xem diff bằng nút "Mở trong Antigravity App"); `system` nhạt; `other` thu gọn dạng thô) (FR-021)
- [X] T070 [P] [US2] Viết `Composer` trong `src/web/ui/chat/Composer.tsx`: ô nhập nhiều dòng, Enter để gửi, Shift+Enter xuống dòng. Khi gửi lỗi thì giữ nguyên nội dung kèm nút "Gửi lại" (Edge case). Có nút "Dừng" khi nhân viên đang `working`/`thinking`
- [X] T071 [P] [US2] Viết `ModelPicker` trong `src/web/ui/chat/ModelPicker.tsx`: danh sách từ `GET /api/models` theo `label`, mỗi model hiện % quota còn lại của nhóm (từ `quotaInfo` trong `GetUserStatus`). Mặc định là model của lượt trước, hoặc `Settings.defaultModel`. **Cảnh báo trước khi gửi** nếu nhóm quota của model đã chọn còn dưới 10%, và chặn gửi kèm gợi ý đổi model nếu còn 0% (Edge case "Hết quota")
- [X] T072 [US2] Viết "Tuyển nhân viên mới" trong `src/web/ui/chat/HireDialog.tsx`: nút trên thanh công cụ và khi bấm vào bàn trống. Nhập yêu cầu ban đầu, chọn model và project (danh sách từ `GET /api/projects`), bấm xác nhận gọi `POST /api/conversations` với `deskId` của bàn đã chọn (FR-026)
- [X] T073 [US2] Viết bộ đếm sử dụng (phục vụ đo SC-001 và SC-006) trong `src/server/services/usage.ts`: mỗi ngày ghi vào `usage.json` **chỉ các con số**, không có nội dung hay ID tin nhắn. Gồm: số tin nhắn người dùng gửi **qua hệ thống** (đếm khi `POST messages`/`POST conversations` thành công) và tổng số bước `USER_INPUT` mới xuất hiện trong App (đếm trong `EmployeesService`). Phần chênh lệch là số tin gửi trực tiếp từ App. Thêm route `GET /api/usage` trong `src/server/http/routes/usage.ts` và hiển thị tỷ lệ theo tuần trong `src/web/ui/settings/UsageStats.tsx`
- [X] T074 [P] [US2] E2E test trong `tests/e2e/chat.spec.ts` với App giả lập `tests/e2e/mock-app.ts` (phục vụ fixture): bấm 1 lần vào nhân viên thì chat mở; gửi tin thì App giả lập nhận đúng request; bấm dừng thì gọi cancel; tắt App giả lập rồi gửi tin thì nội dung được giữ, hiện nút "Gửi lại", bật App lại và bấm gửi lại thì thành công (Edge case "Gửi tin nhắn thất bại")

**Checkpoint**: chạy quickstart V2. US1 + US2 tạo thành **bản dùng được hằng ngày đầu tiên**.

---

## Phase 5: User Story 8 - Cài đặt lên một máy khác (Priority: P1)

**Goal**: Một người mới cài và chạy được trên macOS trong ≤ 15 phút.

**Independent Test**: quickstart V8. Bấm giờ một lượt cài mới trên macOS.

- [X] T075 [US8] Viết `scripts/install.sh` (bash, `set -euo pipefail`): kiểm tra `uname` là Darwin (khác thì báo "chỉ hỗ trợ macOS"); kiểm tra Node ≥ 22, nếu thiếu thì in lệnh cài `fnm` và dừng; chạy `npm ci`, `npm run build`. **Không** đọc dữ liệu hay phiên bản của Antigravity App trong script (Constitution II). Việc kiểm tra App và phiên bản do adapter làm khi `npm start`, và script chỉ in lời nhắc "Hãy mở Antigravity App 2.24.0 trước khi chạy `npm start`"
- [X] T076 [US8] Viết `docs/INSTALL.md`: yêu cầu (macOS 13+, Antigravity App 2.24.0 đang mở, Chrome/Edge/Firefox), các bước cài Node qua `fnm`, `git clone`, `./scripts/install.sh`, `npm start`; mục "Xử lý sự cố" (App chưa mở, cảnh báo sai phiên bản, cổng 4317 bận thì dùng `AGENT_OFFICE_PORT`, trình duyệt không mở tự động); vị trí dữ liệu `~/Library/Application Support/agent-office/`
- [X] T077 [US8] Cập nhật `README.md` ở thư mục gốc: giới thiệu ngắn, ảnh chụp màn hình, liên kết `docs/INSTALL.md`, ghi rõ "Linux: hoãn"
- [X] T078 [US8] Kiểm chứng cài đặt mới trên macOS (máy sạch hoặc user macOS mới), có bấm giờ. Ghi kết quả (thời gian, vướng mắc) vào `docs/INSTALL.md` mục "Đã kiểm chứng" và sửa hướng dẫn nếu vượt 15 phút

**Checkpoint**: **Kết thúc Đợt 1** (US1 + US2 + US8). Chạy đủ 5 cổng chất lượng: (1) `npm test`; (2) `AGENT_OFFICE_LIVE=1 npm run test:live -- latency`; (3) `npm run test:leaks`; (4) `npm run bench:fps` (văn phòng, chưa có công viên); (5) quickstart V8. Thêm quickstart V1 và V2. Bắt đầu đo SC-001 bằng bộ đếm sử dụng trong 2–4 tuần.

---

## Phase 5b: US2 bổ sung — Tạo project gắn thư mục (FR-031, FR-032) (Priority: P1, bổ sung 2026-11-07)

**Goal**: Tạo project mới trong App bằng cách chọn thư mục trên máy. Tuyển nhân viên bắt buộc chọn project có sẵn hoặc tạo mới.

**Independent Test**: Tạo project trỏ vào một thư mục, tuyển nhân viên trong project đó, gõ `@` và thấy file của thư mục.

- [X] T079 [US2] Spike tạo project với App thật (CreateProject cần `id` tự sinh, `projectResources.resources[{folderUri}]`; conversation trong project có `workspaceUris`; xoá bằng `DeleteProject {id}`), ghi vào `specs/001-3d-agent-office/research.md`
- [X] T080 [US2] Cài `createProject({ name, folderUri })` (sinh UUID, gọi `CreateProject`, đọc lại qua `ReadProjects`) và bổ sung `folderUri` vào `Project` trong `src/server/app-adapter/index.ts`, `src/server/app-adapter/mappers/project.ts`, `src/shared/domain.ts`; thêm `deleteTestProject` (chỉ xoá project tên bắt đầu bằng "[agent-office-test]"); contract test trong `tests/contract/adapter-project.test.ts`
- [X] T081 [US2] Viết `src/server/services/folders.ts` + route `GET /api/fs/dirs?path=` và `POST /api/projects { name, folderPath }` trong `src/server/http/routes/projects.ts`: chỉ liệt kê **thư mục** (bỏ thư mục ẩn), chỉ trong **home** (so `realpath`, từ chối symlink trỏ ra ngoài), sắp xếp theo tên, tối đa 500 mục; unit test trong `tests/unit/folders.test.ts`
- [X] T082 [US2] Viết `src/web/ui/projects/ProjectDialog.tsx` (tên project + trình duyệt thư mục: đường dẫn hiện tại, nút lên thư mục cha, danh sách thư mục con, chọn thư mục hiện tại) và sửa `src/web/ui/chat/HireDialog.tsx`: project là trường bắt buộc (không chọn sẵn), có lựa chọn "+ Tạo project mới…" mở `ProjectDialog`, tạo xong thì tự chọn project vừa tạo; thêm nút "Tạo project" trên thanh công cụ
- [X] T083 [US2] E2E trong `tests/e2e/projects.spec.ts` với App giả lập: duyệt thư mục, tạo project (App giả lập nhận `CreateProject` có `folderUri`), nút "Tuyển" bị khoá khi chưa chọn project

**Checkpoint**: tạo project → tuyển nhân viên trong project → `@` gợi ý file của thư mục.

---

## Phase 6: User Story 3 - Ra lệnh bằng `/` và `@`, duyệt quyền (Priority: P2)

**Goal**: Gõ `/` hiện danh sách lệnh và skill giống App. `@` gợi ý file và gửi như mục nhắc tới. Duyệt hoặc từ chối quyền ngay trong chat.

**Independent Test**: quickstart V3.

- [X] T084 [US3] **Spike duyệt quyền (R8)**: dùng cấu trúc bước `WAITING` đã ghi ở spike T029 (Phase 2). Nhờ người dùng tạm bật lại chế độ hỏi quyền, cho conversation `[agent-office-test] perm` chạy một lệnh, rồi tìm định dạng `interaction` của `HandleCascadeUserInteraction` để **cho phép** và **từ chối**. Ghi kết quả vào `specs/001-3d-agent-office/research.md` (R8, "Kết quả spike"), thêm fixture đã làm sạch vào `tests/contract/fixtures/app-2.24.0/permission-*.json`, rồi dọn conversation
- [X] T085 [P] [US3] Cài `getSlashCommands(model)` (gọi `GetSlashCommands` với `{cascadeConfig:{plannerConfig:{planModel}}}`, lưu đệm 60 giây theo từng model, ánh xạ `SLASH_COMMAND_TYPE_SYSTEM`→`system`, `SLASH_COMMAND_TYPE_SKILL`→`skill`) trong `src/server/app-adapter/mappers/command.ts` và `src/server/app-adapter/index.ts`
- [X] T086 [P] [US3] Viết dịch vụ gợi ý file trong `src/server/services/mentions.ts`: thử `adapter.suggestMentions` (dựa trên `GetMatchingContextScopeItems`). Nếu rỗng thì tự liệt kê file trong `workspaceUris` của conversation: bỏ qua `.git`, `node_modules`, `dist`; tối đa 5.000 file mỗi workspace, lưu đệm 30 giây; lọc mờ theo tên; trả tối đa 50 kết quả trong ≤ 300 ms (A9)
- [X] T087 [US3] Cài `answerPermission` trong `src/server/app-adapter/index.ts` theo kết quả spike T084, và ánh xạ bước xin quyền thành `Step.kind = 'permission_request'` với `permission: { requestId, description, options }` trong `src/server/app-adapter/mappers/step.ts`. Nếu spike thất bại: chuyển FR-029 sang nút "Mở trong Antigravity App" và ghi lại trong spec Assumptions
- [X] T088 [US3] Viết các route `GET /api/commands?model=`, `GET /api/conversations/:id/mentions?q=`, `POST /api/conversations/:id/permissions/:requestId` (`{ decision: 'allow' | 'deny' }`) trong `src/server/http/routes/commands.ts`
- [X] T089 [P] [US3] Contract test trong `tests/contract/adapter-commands.test.ts`: ánh xạ lệnh `/` từ fixture; `sendMessage` có mục nhắc file tạo `{item:{file:{absoluteUri}}}`; `answerPermission` gửi đúng định dạng đã tìm được ở spike
- [X] T090 [US3] Thêm menu `/` vào `Composer` trong `src/web/ui/chat/SlashMenu.tsx`: mở khi `/` là ký tự đầu, lọc khi gõ tiếp, điều hướng bằng phím mũi tên và Enter, hiện nhãn system hoặc skill cùng mô tả (FR-027)
- [X] T091 [US3] Thêm menu `@` vào `Composer` trong `src/web/ui/chat/MentionMenu.tsx`: gọi `/mentions?q=` (debounce 120 ms). Mục được chọn hiện thành "chip" trong ô nhập và được gửi như phần `{ mention }` của `UserInput`, không phải văn bản thường (FR-028)
- [X] T092 [US3] Viết `PermissionPrompt` trong `src/web/ui/chat/PermissionPrompt.tsx`: hiện trong chat khi có `permission_request` chưa trả lời, kèm nút "Cho phép" và "Từ chối". Nhân viên rời `waiting_for_boss` sau khi trả lời (FR-029)

**Checkpoint**: chạy quickstart V3.

---

## Phase 7: User Story 4 - Theo dõi quota tài khoản (Priority: P2)

**Goal**: Màn hình quota treo tường trong văn phòng. Bấm vào mở bảng chi tiết.

**Independent Test**: quickstart V4. Đối chiếu từng con số với App.

- [X] T093 [P] [US4] Viết mapper quota trong `src/server/app-adapter/mappers/quota.ts`: từ `GetUserStatus`, **xoá `name` và `email` ngay lập tức**; `planName` lấy từ `userTier.name`; gom `clientModelConfigs[]` theo cặp `quotaInfo.remainingFraction` + `quotaInfo.resetTime` thành `QuotaGroup { models[{label, modelId}], remainingPercent: 0–100, resetAt, low: remainingPercent < 10 }`; `credits` lấy từ `planStatus.availablePromptCredits/availableFlowCredits` và `planInfo.monthlyPromptCredits/monthlyFlowCredits`
- [X] T094 [P] [US4] Contract test quota trong `tests/contract/adapter-quota.test.ts`: dùng fixture `GetUserStatus`, khẳng định không có `name`/`email` trong kết quả, gom nhóm đúng, `low` khi dưới 10% (A8)
- [X] T095 [US4] Viết `QuotaService` trong `src/server/services/quota.ts`: làm mới mỗi **5 phút** và ngay khi một conversation chuyển từ `RUNNING` sang `IDLE` (nghe sự kiện từ `EmployeesService`) (FR-042). Phát `quota` qua ws-hub. Kèm route `GET /api/quota` trong `src/server/http/routes/quota.ts`
- [X] T096 [US4] Viết `QuotaScreen` trong `src/web/ui/quota/QuotaScreen.tsx`: một màn hình 3D gắn trên vật `wall_screen` của bố cục, hiện thanh % của các nhóm model (vẽ texture bằng canvas). Đổi sang màu cảnh báo khi có nhóm `low` (FR-040, FR-043). Bấm 1 lần mở bảng chi tiết
- [X] T097 [US4] Viết `QuotaPanel` trong `src/web/ui/quota/QuotaPanel.tsx`: gói tài khoản, bảng các nhóm model (tên model, % còn lại, thời điểm làm mới theo giờ địa phương và dạng "còn x giờ"), credits, thời điểm cập nhật (FR-041). Kèm nút quota nhỏ trên thanh công cụ, dự phòng khi bố cục không có `wall_screen`

**Checkpoint**: chạy quickstart V4. **Kết thúc Đợt 2**, chạy cổng chất lượng.

---

## Phase 8: User Story 5 - Tự xây và sắp xếp văn phòng (Priority: P3)

**Goal**: Chế độ xây dựng: đặt, xoay, di chuyển và xoá đồ vật trên lưới, kéo thả nhân viên vào bàn, lưu bố cục.

**Independent Test**: quickstart V5.

- [X] T098 [P] [US5] Viết danh mục đồ vật trong `src/shared/catalog.ts`: mỗi `type` (`desk`, `chair`, `wall`, `glass_wall`, `door`, `plant`, `water_cooler`, `sofa`, `wall_screen`) có footprint (số ô), vật chặn ô hay chặn cạnh, và mô hình 3D tương ứng (FR-050)
- [X] T099 [US5] Viết hàm kiểm tra bố cục trong `src/shared/layout-validation.ts`, áp dụng các quy tắc ở data-model §5 nguyên văn: "Mọi ô trong footprint đều nằm trong `floor`"; "Không có hai vật chặn nhau chiếm cùng một ô. Tường và vách kính chỉ chặn cạnh ô"; "Mỗi `desk` có đúng một ô ngồi đi tới được từ cửa (kiểm tra bằng A*)". Trả danh sách `invalidItems`
- [X] T100 [P] [US5] Unit test kiểm tra bố cục trong `tests/unit/layout-validation.test.ts` (chồng vật, ra ngoài sàn, bàn bị chắn lối, bố cục mặc định hợp lệ)
- [X] T101 [US5] Viết route `PUT /api/layout` (kiểm tra bằng `layout-validation`, trả `422 { error, invalidItems }` nếu sai, ghi atomic `layout.json`) và `PUT /api/employees/:conversationId/profile` (`{ deskId?, appearance? }`) trong `src/server/http/routes/layout.ts`
- [X] T102 [US5] Viết chế độ xây dựng trong `src/web/ui/build/BuildMode.tsx` và `src/web/scene/BuildGizmo.tsx`: thanh đồ vật theo danh mục; xem trước vật đặt khớp lưới, xanh khi hợp lệ và đỏ khi không; phím R để xoay 90°; kéo để di chuyển; phím Delete để xoá; hoàn tác/làm lại (Cmd+Z / Cmd+Shift+Z); nút "Lưu" và "Huỷ"
- [X] T103 [US5] Viết kéo thả nhân viên vào bàn trong `src/web/scene/EmployeeDrag.tsx` (FR-052): thả vào bàn trống thì gọi `PUT profile`; thả vào bàn có người thì hai người đổi chỗ. Bàn được gán phải đúng là bàn nhân viên quay về sau hành động ngẫu nhiên
- [X] T104 [US5] Hiển thị khu chờ và gợi ý "Thêm bàn" khi số nhân viên nhiều hơn số bàn, trong `src/web/scene/employee-lifecycle.ts` và `src/web/ui/build/AddDeskHint.tsx`

**Checkpoint**: chạy quickstart V5.

---

## Phase 9: User Story 6 - Văn phòng trong công viên giữa thành phố, có thời tiết thật (Priority: P3)

**Goal**: Công viên "sống", 5 thành phố, thời tiết thật, chế độ sáng/tối, 3 mức chi tiết, vẫn giữ ≥ 60 FPS.

**Independent Test**: quickstart V6 và `npm run bench:fps`.

- [X] T105 [P] [US6] Viết `WeatherService` trong `src/server/services/weather.ts`: gọi `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day` với tọa độ cố định của `hanoi`, `hcmc`, `singapore`, `tokyo`, `newyork`. Lưu đệm **30 phút** mỗi thành phố vào `weather-cache.json`. Ánh xạ mã WMO thành `'clear' | 'cloudy' | 'rain' | 'storm' | 'fog_snow'`. Lỗi mạng thì trả `clear` và không ném lỗi. Kèm route `GET /api/weather?city=` trong `src/server/http/routes/weather.ts`
- [X] T106 [P] [US6] Viết route `GET/PUT /api/settings` trong `src/server/http/routes/settings.ts` với mặc định `city: 'hanoi'`, `theme` theo hệ điều hành ở lần đầu, `detailLevel: 'medium'`, `autoLowerDetail: true`, `camera: 'overview'`, `defaultModel: null`
- [X] T107 [P] [US6] Thêm tài nguyên CC0 cho công viên và thành phố vào `assets/models/park/` và `assets/models/city/`: Kenney Nature Kit (nhiều loại cây và hoa), City Kit, Car Kit, nhân vật đi bộ/chạy/tập thể dục của Quaternius. Dựng khối low-poly cảnh đặc trưng (Hà Nội: Tháp Rùa/Lotte; TP.HCM: Landmark 81; Singapore: Marina Bay Sands; Tokyo: Tokyo Tower/Skytree; New York: Empire State). Nén và cập nhật `assets/LICENSES.md`
- [X] T108 [US6] Viết công viên trong `src/web/scene/park/Park.tsx`: thảm cỏ, lối đi, cây và hoa vẽ bằng `Instances` của drei, có LOD 2–3 cấp (R4). Số lượng theo mức chi tiết (Thấp/Vừa/Cao)
- [X] T109 [US6] Viết người và xe trong `src/web/scene/park/Ambient.tsx`: người đi dạo, chạy bộ, tập thể dục và xe cộ đi theo **lối định sẵn** (spline), không tương tác. Số lượng theo mức chi tiết. Chỉ cập nhật hoạt ảnh khi ở trong tầm nhìn
- [X] T110 [US6] Viết cảnh thành phố trong `src/web/scene/city/CitySkyline.tsx`: mô hình cảnh đặc trưng phía xa cộng skybox hoặc impostor cho từng thành phố (FR-062). Đổi thành phố không cần tải lại trang
- [X] T111 [US6] Viết hiệu ứng thời tiết trong `src/web/scene/weather/Weather.tsx`: bầu trời, mây, mưa (hạt instanced), giông (chớp), sương. Khi mưa thì giảm số người trong công viên hoặc cho cầm ô. Hiển thị dòng "Weather data by Open-Meteo.com" kèm liên kết (FR-063)
- [X] T112 [US6] Viết chế độ sáng/tối trong `src/web/scene/Lighting.tsx` và `src/web/ui/settings/ThemeToggle.tsx`: ánh sáng mặt trời ban ngày hoặc đèn văn phòng và đèn đường ban đêm cho cảnh 3D, cùng tông màu giao diện 2D. Lưu vào `Settings.theme` (FR-064)
- [X] T113 [US6] Viết bảng cài đặt trong `src/web/ui/settings/SettingsPanel.tsx`: chọn thành phố (FR-060), mức chi tiết Thấp/Vừa/Cao (FR-065), tự giảm chi tiết bật/tắt, model mặc định (`Settings.defaultModel`, danh sách từ `GET /api/models`), và mục thống kê sử dụng (`UsageStats`)
- [X] T114 [US6] Viết quản lý hiệu năng trong `src/web/scene/perf/PerfManager.tsx`: `PerformanceMonitor` của drei. Hạ mức chi tiết **bối cảnh** khi FPS dưới 60 liên tục 3 giây (nếu `autoLowerDetail`) và phát cảnh báo `DETAIL_LOWERED`. **Không bao giờ** hạ chi tiết văn phòng và nhân viên. Dừng vòng lặp vẽ khi tab bị ẩn
- [X] T115 [US6] **Mở rộng** benchmark (lõi đã có từ US1) trong `src/web/bench/Bench.tsx`: thêm công viên, người, xe, thành phố và hiệu ứng mưa ở mức chi tiết mặc định ("Vừa"); thêm tuỳ chọn `?detail=low|medium|high`. Vẫn yêu cầu FPS trung bình ≥ 60 ở mức mặc định (SC-004)

**Checkpoint**: chạy quickstart V6 và `bench:fps` trên máy tham chiếu (MacBook Pro M1 Pro, 1920×1080, Chrome). **Kết thúc Đợt 3**, chạy cổng chất lượng.

---

## Phase 10: User Story 7 - Đi lại trong văn phòng bằng góc nhìn thứ nhất (Priority: P4)

**Goal**: Chuyển qua lại giữa toàn cảnh và góc nhìn thứ nhất. Đi bằng WASD và chuột, không xuyên tường. Bấm vào nhân viên để mở chat.

**Independent Test**: quickstart V7.

- [ ] T116 [US7] Viết camera góc nhìn thứ nhất trong `src/web/scene/cameras/FirstPerson.tsx`: `PointerLockControls` của drei, tầm mắt 1,65 m, WASD/phím mũi tên, Shift để đi nhanh. Va chạm hình tròn (bán kính 0,3 m) với bản đồ ô ở `src/web/scene/grid/grid.ts`, nên không xuyên tường hay đồ vật (FR-071)
- [ ] T117 [US7] Viết bấm vào nhân viên ở góc nhìn thứ nhất trong `src/web/scene/cameras/FirstPerson.tsx`: hiện tâm ngắm; bấm chuột khi tâm ngắm trỏ vào nhân viên trong phạm vi 4 m thì mở `ChatPanel`, đồng thời tạm thoát pointer lock để gõ
- [ ] T118 [US7] Viết chuyển camera trong `src/web/ui/CameraToggle.tsx` và `src/web/state/ui.ts`: nút cộng phím `V` để chuyển. Nhớ vị trí toàn cảnh trước đó để quay lại đúng chỗ. Lưu `Settings.camera` (FR-070)

**Checkpoint**: chạy quickstart V7. **Kết thúc Đợt 4**.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Hoàn thiện, rà soát theo Constitution

- [ ] T119 [P] Rà soát rò rỉ toàn hệ thống: mở rộng `tests/leaks/redaction.test.ts` để chạy toàn bộ e2e rồi quét log, `~/Library/Application Support/agent-office/` và phản hồi API, tìm token, email, tên và nội dung tin nhắn (SC-009, cổng chất lượng 3)
- [ ] T120 Chạy toàn bộ `quickstart.md` (V1–V8) trên máy tham chiếu và cập nhật `docs/INSTALL.md` cùng `README.md` theo kết quả cuối
- [ ] T121 Xoá phần "Sync Impact Report" ở đầu `.specify/memory/constitution.md` trước bản phát hành đầu tiên (theo ghi chú của constitution)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: không phụ thuộc. Bắt đầu ngay, T001 trước mọi thứ.
- **Foundational (Phase 2)**: phụ thuộc Setup và **chặn mọi user story**. T023 (ghi fixture), T028 (spike) và T029 (spike chờ/lỗi) cần App thật đang mở. T029 cần người dùng bật chế độ hỏi quyền.
- **US1 (Phase 3)**: phụ thuộc Foundational.
- **US2 (Phase 4)**: phụ thuộc Foundational và T028. Dùng `Employee.tsx` của US1 để bấm (T066 sau T050).
- **US8 (Phase 5)**: phụ thuộc US1 + US2 (hướng dẫn mô tả bản đã chạy được).
- **US3 (Phase 6)**: phụ thuộc US2 (`Composer`, `ChatPanel`). T084 cần người dùng bật chế độ hỏi quyền.
- **US4 (Phase 7)**: phụ thuộc Foundational. Chỉ T096 cần `wall_screen` của bố cục (T044). **Có thể làm song song với US3.**
- **US5 (Phase 8)**: phụ thuộc US1 (bố cục, lưới, nhân viên).
- **US6 (Phase 9)**: phụ thuộc US1 (cảnh, lõi benchmark T058). Độc lập với US5. T114/T115 nên làm sớm trong phase để đo FPS liên tục.
- **US7 (Phase 10)**: phụ thuộc US1 (lưới, va chạm) và US2 (mở chat).
- **Polish (Phase 11)**: sau các đợt mong muốn.

### Thứ tự đợt (Constitution IV, plan.md)

```text
Đợt 1: Setup → Foundational → US1 → US2 → US8   (cổng chất lượng, đo SC-001)
Đợt 2: US3 ∥ US4                                  (cổng chất lượng)
Đợt 3: US5 ∥ US6                                  (cổng chất lượng, bench:fps)
Đợt 4: US7 → Polish
```

### Within Each User Story

- Contract/unit test (nếu có) viết trước phần cài đặt tương ứng
- server (adapter → service → route) trước web (store → scene/UI)
- Kết thúc mỗi story: chạy kịch bản quickstart tương ứng

### Parallel Opportunities

- Setup: T006–T010 song song sau T002–T005.
- Foundational: T012, T013, T014, T015 song song; T017, T018, T019 song song; T024, T025 song song; T027, T035, T036, T037, T038 song song.
- US1: T041, T042, T043, T044, T047, T048, T055, T056 song song (khác file); T060 song song với T058/T059.
- US2: T061, T062, T069, T070, T071, T074 song song.
- US3 ∥ US4 (khác người hoặc khác phiên làm việc); trong US4, T093 ∥ T094.
- US5 ∥ US6; trong US6, T105, T106, T107 song song.

---

## Parallel Example: User Story 1

```bash
# Sau khi Foundational xong, chạy song song:
Task: "T042 [US1] computeVisualState trong src/server/services/visual-state.ts"
Task: "T043 [US1] employee-profiles trong src/server/services/employee-profiles.ts"
Task: "T044 [US1] default-layout + layout-store trong src/server/services/"
Task: "T047 [US1] tài nguyên 3D CC0 trong assets/models/"
Task: "T048 [US1] grid + A* trong src/web/scene/grid/"
# Rồi tuần tự: T045 → T046 → T049 → T050 → T051 → T052 → T053 → T054 → T057 → T058 → T059 → T060
```

## Parallel Example: User Story 2

```bash
Task: "T061 [US2] contract test ghi trong tests/contract/adapter-write.test.ts"
Task: "T069 [US2] StepView trong src/web/ui/chat/StepView.tsx"
Task: "T070 [US2] Composer trong src/web/ui/chat/Composer.tsx"
Task: "T071 [US2] ModelPicker trong src/web/ui/chat/ModelPicker.tsx"
# Rồi: T063 → T064 → T065 → T066 → T067 → T068 → T072 → T073 → T074
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (gồm ghi fixture và các spike).
2. Phase 3 US1 → **DỪNG và kiểm chứng** bằng quickstart V1: nhân viên có đúng trạng thái thật không, có tạo cảm hứng không?
3. Ngay sau đó là US2, vì một văn phòng chỉ để xem chưa thay được App (SC-001).

### Incremental Delivery

1. **Đợt 1** (US1 + US2 + US8) → dùng hằng ngày 2–4 tuần → đo SC-001 và SC-007.
2. Nếu đạt: **Đợt 2** (US3 + US4) → **Đợt 3** (US5 + US6) → **Đợt 4** (US7).
3. Mỗi đợt kết thúc bằng cổng chất lượng của Constitution: contract test, độ trễ ≤ 2 giây, không rò rỉ, ≥ 60 FPS, cài đặt macOS ≤ 15 phút.

### Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Commit sau mỗi task hoặc mỗi nhóm logic (git đã khởi tạo, branch `001-3d-agent-office`)
- Spike T028, T029 và T084 có thể làm thay đổi cách cài đặt của T026, T063 và T087. Luôn cập nhật research.md trước khi viết mã
- Linux được hoãn: chỉ có `DarwinProcessFinder`. Không viết mã cho Linux trong tính năng này
