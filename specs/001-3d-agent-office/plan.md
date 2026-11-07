# Implementation Plan: Văn phòng 3D cho agent trên Antigravity App

**Branch**: `001-3d-agent-office` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-3d-agent-office/spec.md`

## Summary

Xây dựng một ứng dụng web chạy local, biến các conversation của **Antigravity App 2.24.0** thành
**nhân viên trong một văn phòng 3D**. Văn phòng do người dùng tự xây, đặt trong một công viên giữa
1 trong 5 thành phố, có thời tiết thật. Nhân viên chuyển động theo trạng thái thật. Bấm 1 lần vào
nhân viên là mở khung chat tương đương App (gửi tin như người dùng, `/`, `@`, chọn model, dừng,
duyệt quyền, tuyển nhân viên mới). Có bảng quota.

**Cách tiếp cận kỹ thuật** (research.md):
- Một **server Node.js/TypeScript** chỉ lắng nghe `127.0.0.1`. Server chứa một **lớp kết nối App
  duy nhất**. Lớp này tự dò tiến trình language server của App, lấy CSRF token và cổng, rồi gọi API
  HTTPS/JSON nội bộ của App (đã chạy thử thành công).
- Server cập nhật trạng thái mỗi 1 giây và đẩy phần thay đổi xuống trình duyệt qua **WebSocket**.
- **Giao diện React + three.js (React Three Fiber)** vẽ cảnh low-poly CC0, có instancing, LOD và 3
  mức chi tiết để giữ **≥ 60 FPS**.
- Làm theo **4 đợt** theo thứ tự ưu tiên của spec.

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22 LTS (server). TypeScript 5.x + React 19 chạy
trong trình duyệt (web).

**Primary Dependencies**:
- Server: Fastify 5 (HTTP + `@fastify/websocket`, `@fastify/static`), `undici`/`node:https`, `zod`
  (kiểm tra dữ liệu), `pino` (log, có bộ lọc che thông tin nhạy cảm), `env-paths`.
- Web: Vite 8 (bản ổn định hiện tại; plugin React mới nhất yêu cầu Vite 8), React 19, three.js, @react-three/fiber, @react-three/drei, zustand, react-markdown +
  Shiki.

**Storage**: File JSON có version schema trong thư mục cấu hình người dùng (`layout.json`,
`settings.json`, `employees.json`, `weather-cache.json`). Không có cơ sở dữ liệu. Không lưu nội dung
chat.

**Testing**: Vitest (unit, contract test adapter bằng fixture App 2.24.0 đã làm sạch), Playwright
(e2e với App giả lập), `test:live` tuỳ chọn với App thật, `test:leaks` (SC-009), `bench:fps` (SC-004).

**Target Platform**: macOS 13+ (Apple Silicon và Intel). Trình duyệt Chromium hoặc Firefox mới có
WebGL 2. Cùng máy với Antigravity App 2.24.0. **Linux được hoãn** (Constitution VI v2.0.0); phần dò
tiến trình đặt sau một giao diện theo hệ điều hành để thêm Linux về sau.

**Project Type**: Ứng dụng web local, gồm server cầu nối và client 3D, trong một package.

**Performance Goals**:
- ≥ 60 FPS với 20 nhân viên ở mức chi tiết mặc định, trên máy tham chiếu (MacBook Pro M1 Pro,
  1920×1080, Chrome).
- Thay đổi trạng thái hiển thị trong ≤ 2 giây.
- Kết nối lại App trong ≤ 10 giây.
- Gợi ý `@` trong ≤ 300 ms.

**Constraints**:
- Chỉ `127.0.0.1`. Token, tên, email và nội dung chat không rời bộ nhớ.
- Kết nối ra ngoài duy nhất là Open-Meteo.
- Không dùng Docker. Cài đặt ≤ 15 phút.
- App phải đang mở.
- Phụ thuộc API nội bộ của App 2.24.0.

**Scale/Scope**:
- 1 người dùng, 1 máy.
- ≤ 20 nhân viên hiển thị cùng lúc, số conversation không giới hạn (phần dư xem qua danh sách).
- 5 thành phố, khoảng 10 loại đồ nội thất, 3 mức chi tiết.
- 8 user story, 43 yêu cầu chức năng.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Kiểm tra | Trước Phase 0 | Sau Phase 1 |
|---|---|---|---|
| I. App là nguồn dữ liệu duy nhất | Không tự chạy agent. Chỉ lưu bố cục, cài đặt và hồ sơ ngoại hình. Trạng thái `unknown` khi không chắc. Độ trễ ≤ 2 giây | ✅ | ✅ data-model §1–§6 không lưu dữ liệu App; VisualState có `unknown`; polling 1 giây (R7) |
| II. Lớp kết nối App được cô lập | Mọi RPC, dò cổng và token nằm trong `src/server/app-adapter/`. Kiểm tra phiên bản. Suy giảm có kiểm soát. Contract test bằng fixture | ✅ | ✅ contracts/app-adapter.md (A1–A10), R6, R13 |
| III. Local-first, bảo mật | `127.0.0.1`, che log, token chỉ trong bộ nhớ, chỉ gọi Open-Meteo, mọi thao tác ghi do người dùng thực hiện | ✅ | ✅ R11 thêm kiểm tra Host/Origin cộng session token (chống DNS rebinding); contracts/local-api.md; R9 lọc email |
| IV. Giao hàng theo đợt | Đợt 1 = US1 + US2 + US8. Phần nặng để sau | ✅ | ✅ xem "Các đợt giao hàng" bên dưới |
| V. Trải nghiệm, ≥ 60 FPS, 1 lần bấm | Ngân sách khung hình, instancing, LOD, 3 mức chi tiết, tài nguyên CC0 thống nhất, mở chat bằng 1 lần bấm | ✅ | ✅ R4, R5, FR-020, `bench:fps` |
| VI. Cài đặt macOS ≤ 15 phút (v2.0.0) | Không Docker, script cài đặt, kiểm chứng trên macOS, phần phụ thuộc hệ điều hành nằm sau giao diện trong adapter | ✅ | ✅ R6 (`ProcessFinder` theo hệ điều hành, chỉ cài bản macOS), R12 |

**Kết luận gate**: **PASS**. Không có vi phạm. Ghi chú 2026-11-06: Linux được người dùng hoãn, và
constitution đã được sửa lên 2.0.0 để phản ánh điều này.

## Các đợt giao hàng (Constitution IV)

| Đợt | User story | Kết quả dùng được hằng ngày | Cổng chất lượng riêng |
|---|---|---|---|
| **1** | US1, US2, US8 (+ spike `StartCascade`, luồng cập nhật và nguồn project T028; spike chờ/lỗi T029, **cần người dùng bật chế độ hỏi quyền trong App**) | Văn phòng mặc định, nhân viên theo trạng thái thật, chat 1 lần bấm (gửi, model, dừng, tuyển mới), hướng dẫn cài đặt macOS | V1, V2, V8. Đo SC-001 sau 2–4 tuần |
| **2** | US3, US4 (+ spike duyệt quyền) | `/`, `@`, duyệt quyền, bảng quota | V3, V4 |
| **3** | US5, US6 | Tự xây văn phòng, công viên, 5 thành phố, thời tiết, chế độ sáng/tối, mức chi tiết | V5, V6, `bench:fps` với công viên |
| **4** | US7 | Góc nhìn thứ nhất | V7 |

Sau mỗi đợt: đối chiếu SC-001/SC-007, rồi quyết định làm tiếp, điều chỉnh hay dừng.

## Project Structure

### Documentation (this feature)

```text
specs/001-3d-agent-office/
├── plan.md              # This file
├── research.md          # Phase 0: quyết định kỹ thuật R1–R16
├── data-model.md        # Phase 1: thực thể, trạng thái, quy tắc kiểm tra
├── quickstart.md        # Phase 1: cài đặt và kịch bản kiểm chứng V1–V8
├── contracts/
│   ├── app-adapter.md   # giao diện lớp kết nối App (Constitution II)
│   └── local-api.md     # REST + WebSocket giữa trình duyệt và server
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks), chưa tạo
```

### Source Code (repository root)

```text
package.json                 # một package: scripts start, dev, build, test, test:e2e, test:live, test:leaks, bench:fps
tsconfig.json
vite.config.ts
scripts/
├── install.sh               # kiểm tra Node ≥ 22, npm ci, build
├── record-fixtures.ts       # ghi fixture App 2.24.0 qua recordRaw() của adapter (chỉ dùng khi phát triển)
├── bench-fps.ts             # npm run bench:fps (SC-004)
└── check-guards.sh          # cách ly adapter, chặn URL ngoài, chỉ người dùng gọi lệnh ghi (chạy trong npm test)
docs/
└── INSTALL.md               # hướng dẫn cài đặt macOS (US8)

src/
├── shared/
│   └── domain.ts            # kiểu dữ liệu miền nghiệp vụ dùng chung (data-model.md)
├── server/
│   ├── main.ts              # khởi động, in URL kèm token, mở trình duyệt
│   ├── http/                # Fastify: REST, WebSocket, file tĩnh, bảo vệ Host/Origin/token
│   │   └── routes/          # index.ts (registerRoutes), health, employees (+ /api/projects), conversations, commands, quota, layout, settings, weather, usage
│   ├── app-adapter/         # ⟵ NƠI DUY NHẤT phụ thuộc Antigravity App (contracts/app-adapter.md)
│   │   ├── discovery/       # process-finder.ts (giao diện), process-darwin.ts, probe.ts (Linux: hoãn)
│   │   ├── rpc-client.ts
│   │   ├── mappers/
│   │   └── redact.ts
│   ├── services/
│   │   ├── employees.ts     # Conversation + EmployeeProfile → Employee, VisualState, diff/patch
│   │   ├── quota.ts
│   │   ├── weather.ts       # Open-Meteo + lưu đệm
│   │   ├── mentions.ts      # dự phòng: tự liệt kê file trong workspace
│   │   └── usage.ts         # bộ đếm sử dụng (chỉ số đếm) cho SC-001/SC-006
│   ├── storage/             # đọc/ghi JSON atomic, migrate theo schemaVersion
│   └── log.ts               # pino + bộ lọc che thông tin nhạy cảm
└── web/
    ├── main.tsx
    ├── api/                 # client REST + WebSocket (có token)
    ├── state/               # zustand stores
    ├── scene/
    │   ├── Office.tsx       # mặt bằng, đồ nội thất (instanced)
    │   ├── Employee.tsx     # nhân vật, hoạt ảnh theo VisualState, hành động ngẫu nhiên
    │   ├── grid/            # bản đồ ô, A*, va chạm
    │   ├── park/            # cây/hoa (instanced), người, xe theo lối định sẵn
    │   ├── city/            # cảnh đặc trưng 5 thành phố
    │   ├── weather/         # mưa, mây, sương
    │   ├── cameras/         # Overview, FirstPerson
    │   └── perf/            # PerformanceMonitor, mức chi tiết
    ├── ui/
    │   ├── chat/            # ChatPanel, StepView, Composer (`/`, `@`), ModelPicker, PermissionPrompt
    │   ├── quota/           # QuotaScreen (treo tường), QuotaPanel
    │   ├── build/           # chế độ xây dựng
    │   └── settings/
    └── bench/               # trang benchmark FPS

assets/
├── models/                  # .glb đã nén (Kenney, Quaternius, KayKit: CC0)
└── LICENSES.md

tests/
├── unit/
├── contract/                # adapter + fixtures/app-2.24.0/*.json (đã làm sạch)
├── e2e/                     # Playwright + mock App server
├── live/                    # AGENT_OFFICE_LIVE=1
└── leaks/
```

**Structure Decision**: Dùng **một package** (không monorepo) gồm `src/server`, `src/web` và
`src/shared`, để cài đặt chỉ cần một lần `npm ci` và một lệnh `npm start` (Constitution VI). Vite
build `src/web` thành file tĩnh, server Fastify phục vụ các file đó. Toàn bộ phụ thuộc vào
Antigravity App nằm trong `src/server/app-adapter/` (Constitution II).

## Complexity Tracking

Không có vi phạm Constitution cần giải thích.

| Điểm cần lưu ý | Lý do cần | Phương án đơn giản hơn bị loại vì |
|---|---|---|
| WebSocket ngoài REST | Đẩy thay đổi trạng thái ≤ 2 giây cho 20 nhân viên và luồng chat | Trình duyệt tự polling REST mỗi giây làm tăng tải và độ trễ, và vẫn phải có kênh đẩy cho luồng chat |
| Session token + kiểm tra Host/Origin | Server có quyền điều khiển agent, mà agent có thể chạy lệnh trên máy | Chỉ dựa vào `127.0.0.1` vẫn bị DNS rebinding hoặc trang web khác gửi request tới localhost |
