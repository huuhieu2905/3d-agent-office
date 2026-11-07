# Contract: Local API (giữa trình duyệt và server local)

**Feature**: `001-3d-agent-office` | **Constitution**: Nguyên tắc I, III

Server chỉ lắng nghe `http://127.0.0.1:<PORT>` (mặc định `4317`, đổi được bằng biến
`AGENT_OFFICE_PORT`). Kiểu dữ liệu tham chiếu `data-model.md`.

## Bảo mật (áp dụng cho mọi request)

- Header `Host` PHẢI là `127.0.0.1:<PORT>` hoặc `localhost:<PORT>`, ngược lại trả `421`.
- Với request có `Origin`, `Origin` PHẢI cùng nguồn, ngược lại trả `403`.
- Header `Authorization: Bearer <sessionToken>` PHẢI có trên mọi request (trừ `GET /` và file tĩnh),
  thiếu thì trả `401`. Với WebSocket, token gửi qua tham số `?k=<sessionToken>`.
- `sessionToken` được tạo ngẫu nhiên mỗi lần khởi động (32 byte). Lệnh `npm start` in nó ra và mở
  trình duyệt bằng URL `/#k=<token>`.
- Phản hồi lỗi có dạng `{ error: { code: string, message: string } }`, KHÔNG chứa token, email hay
  nội dung tin nhắn.

## REST

| Method | Path | Request | Response | Ghi chú |
|---|---|---|---|---|
| GET | `/api/health` | — | `{ connection: ConnectionState, serverVersion }` | |
| GET | `/api/employees` | — | `Employee[]` | đã gộp hồ sơ, tối đa 20 người hiển thị cùng `overflow: number` |
| GET | `/api/conversations/:id/steps?from=` | — | `Step[]` | |
| POST | `/api/conversations/:id/messages` | `UserInput` | `202 {}` | FR-022 |
| POST | `/api/conversations` | `UserInput & { projectId?, deskId? }` | `201 { conversationId }` | FR-026 |
| POST | `/api/conversations/:id/cancel` | — | `202 {}` | FR-025 |
| POST | `/api/conversations/:id/permissions/:requestId` | `{ decision: 'allow' \| 'deny' }` | `202 {}` | FR-029 |
| GET | `/api/commands?model=` | — | `Command[]` | FR-027 |
| GET | `/api/conversations/:id/mentions?q=` | — | `Mention[]` | FR-028 |
| GET | `/api/models` | — | `ModelOption[]` | FR-024 |
| GET | `/api/projects` | — | `Project[]` | FR-013, FR-026 |
| POST | `/api/projects` | `{ name, folderPath }` | `201 Project` | FR-031; `folderPath` phải là thư mục có thật trong home |
| GET | `/api/fs/dirs?path=` | — | `{ path, parent \| null, home, dirs: { name, path }[] }` | FR-031; chỉ thư mục, chỉ trong home; mặc định là home |
| GET | `/api/usage` | — | `{ weeks: { weekStart, sentViaOffice, userInputsTotal }[] }` | đo SC-001/SC-006, chỉ là số đếm |
| GET | `/api/quota` | — | `Quota` | FR-041 |
| GET | `/api/layout` | — | `OfficeLayout` | |
| PUT | `/api/layout` | `OfficeLayout` | `200` hoặc `422 { error, invalidItems: string[] }` | kiểm tra theo data-model §5 |
| PUT | `/api/employees/:conversationId/profile` | `{ deskId?, appearance? }` | `200` | FR-052 |
| GET/PUT | `/api/settings` | `Settings` | `Settings` | FR-053 |
| GET | `/api/weather?city=` | — | `WeatherSnapshot` | lưu đệm 30 phút |

Lệnh ghi khi App chưa kết nối thì trả `503 { error: { code: 'APP_UNAVAILABLE' } }`. Giao diện giữ lại
tin nhắn để gửi lại (Edge case).

## WebSocket `/ws?k=<token>`

Server → client (JSON, trường `type`):

| type | payload | Khi nào |
|---|---|---|
| `connection` | `ConnectionState` | khi trạng thái kết nối đổi |
| `employees.snapshot` | `Employee[]`, `overflow` | khi mới kết nối |
| `employees.patch` | `{ upserted: Employee[], removed: string[] }` | mỗi lần trạng thái đổi (≤ 1 giây sau lần lấy dữ liệu) |
| `steps.append` | `{ conversationId, steps: Step[] }` | với conversation client đang theo dõi |
| `quota` | `Quota` | mỗi 5 phút, hoặc sau khi một lượt chạy xong |
| `warning` | `{ code: 'APP_VERSION_UNSUPPORTED' \| 'DETAIL_LOWERED' \| …, message }` | |

Client → server:

| type | payload |
|---|---|
| `watch` | `{ conversationId }`: bắt đầu nhận `steps.append` |
| `unwatch` | `{ conversationId }` |

**Đảm bảo**: các `employees.patch` có thứ tự. Khi kết nối lại, client nhận lại `employees.snapshot`.
