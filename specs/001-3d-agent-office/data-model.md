# Data Model: Văn phòng 3D cho agent trên Antigravity App

**Feature**: `001-3d-agent-office` | **Date**: 2026-11-06

Có hai loại dữ liệu:
- **Dữ liệu của App** (chỉ đọc, chỉ nằm trong bộ nhớ): Conversation, Step, Quota, Command. Server
  ánh xạ dữ liệu thô của App sang các kiểu dưới đây. **Chỉ lớp kết nối biết dạng dữ liệu thô**
  (Constitution II).
- **Dữ liệu riêng của hệ thống** (lưu file JSON, R10): OfficeLayout, EmployeeProfile, Settings,
  cùng WeatherSnapshot (chỉ lưu đệm).

Tên trường viết theo kiểu TypeScript. Kiểu dùng chung nằm ở `src/shared/domain.ts`.

---

## 1. Conversation *(App, chỉ đọc)*

| Trường | Kiểu | Nguồn trong App | Ghi chú |
|---|---|---|---|
| `id` | string (UUID) | `trajectoryId` / `cascadeId` | khoá chính |
| `title` | string | `summary` | rỗng thì dùng "Nhân viên mới" |
| `projectId` | string \| null | metadata project | để tô màu (FR-013) |
| `parentId` | string \| null | `parentConversationId` | subagent |
| `runStatus` | `RunStatus` | `status` | xem §6 |
| `stepCount` | number | `stepCount` | |
| `lastActivityAt` | ISO datetime | `lastModifiedTime` | sắp xếp và giới hạn 20 người |
| `lastUserInputAt` | ISO datetime \| null | `lastUserInputTime` | |
| `workspaceUris` | string[] | metadata | gợi ý `@` (R8) |
| `currentModel` | string \| null | `plannerConfig.planModel` của lượt gần nhất | |

**Ràng buộc**: không lưu ra đĩa. Danh sách được làm mới mỗi 1 giây (R7).

## 2. Step *(App, chỉ đọc)*: một phần tử trong cuộc trò chuyện

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `index` | number | thứ tự |
| `kind` | `'user' \| 'agent' \| 'thinking' \| 'tool' \| 'command' \| 'file_view' \| 'file_change' \| 'system' \| 'permission_request' \| 'error' \| 'other'` | ánh xạ từ `CORTEX_STEP_TYPE_*`. Loại chưa biết thì là `other` và vẫn hiển thị dạng thô thu gọn |
| `status` | `StepStatus` | §6 |
| `createdAt` | ISO datetime | |
| `text` | string \| null | markdown của người dùng hoặc agent |
| `thinking` | string \| null | thu gọn mặc định (FR-021) |
| `toolCalls` | `{ id, name, argumentsJson }[]` | |
| `mentions` | `Mention[]` | với tin của người dùng |
| `command` | `{ commandLine, output, exitCode } \| null` | |
| `file` | `{ uri, summary } \| null` | |
| `permission` | `{ requestId, description, options } \| null` | cần spike (R8) |

## 3. Employee *(kết hợp)*: thể hiện của một Conversation trong văn phòng

| Trường | Kiểu | Nguồn | Ghi chú |
|---|---|---|---|
| `conversationId` | string | Conversation.id | quan hệ 1–1 (FR-010) |
| `name` | string | Conversation.title | |
| `visualState` | `VisualState` | tính từ §6 | |
| `appearance` | `AppearanceId` | EmployeeProfile, hoặc tạo từ hash(id) | ổn định giữa các lần mở |
| `deskId` | string \| null | EmployeeProfile | null thì đứng ở khu chờ |
| `projectColor` | màu | bảng màu từ hash(projectId) | có chú giải |
| `isSubagent` | boolean | `parentId != null` | ngồi gần cha |
| `visible` | boolean | nằm trong 20 người hoạt động gần nhất (FR-004) | |

## 4. EmployeeProfile *(hệ thống, lưu `employees.json`)*

```text
{ schemaVersion: 1, profiles: { [conversationId]: { appearance: AppearanceId, deskId: string|null } } }
```

- Hồ sơ của conversation không còn tồn tại trong App được dọn sau 30 ngày.

## 5. OfficeLayout *(hệ thống, lưu `layout.json`)*

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `schemaVersion` | number | hiện là 1 |
| `floor` | `{ widthCells, depthCells, cellSize: 0.5 }` | mặt bằng cố định của tầng (FR-051) |
| `items` | `PlacedItem[]` | |
| `PlacedItem.id` | string | |
| `PlacedItem.type` | `'desk' \| 'chair' \| 'wall' \| 'glass_wall' \| 'door' \| 'plant' \| 'water_cooler' \| 'sofa' \| 'wall_screen' \| …` | danh mục ở FR-050 |
| `PlacedItem.cell` | `{ x, z }` | ô góc trái trên |
| `PlacedItem.rotation` | `0 \| 90 \| 180 \| 270` | |
| `PlacedItem.footprint` | lấy theo `type` (danh mục) | không lưu |

**Quy tắc kiểm tra** (FR-051):
- Mọi ô trong footprint đều nằm trong `floor`.
- Không có hai vật chặn nhau chiếm cùng một ô. Tường và vách kính chỉ chặn cạnh ô.
- Mỗi `desk` có đúng một ô ngồi đi tới được từ cửa (kiểm tra bằng A*, R15).
- Bố cục không hợp lệ thì không được lưu. Giao diện báo vị trí lỗi.

**Mặc định** (FR-054): 12 bàn, 1 máy nước, 1 sofa, 1 màn hình quota treo tường, cây cảnh, vách kính
phía công viên.

## 6. Trạng thái

### RunStatus *(từ App)*

`IDLE | RUNNING | BUSY | CANCELING | UNKNOWN`

### StepStatus *(từ App)*

`PENDING | QUEUED | GENERATING | RUNNING | WAITING | DONE | ERROR | CANCELED | INTERRUPTED | HALTED | CLEARED | INVALID | UNKNOWN`

### VisualState *(hệ thống tính, FR-011)*

Xét theo thứ tự ưu tiên, điều kiện đúng đầu tiên thắng:

| # | Điều kiện | VisualState | Hoạt ảnh |
|---|---|---|---|
| 1 | mất kết nối App | `disconnected` | đứng yên, văn phòng mờ |
| 2 | có bước cuối `WAITING`, hoặc có yêu cầu xin quyền chưa trả lời | `waiting_for_boss` | giơ tay, kèm "!" |
| 3 | bước cuối `ERROR` và `runStatus = IDLE` | `error` | ôm đầu, kèm biểu tượng đỏ |
| 4 | `runStatus ∈ {RUNNING, BUSY}` và bước cuối `GENERATING` | `thinking` | chống cằm |
| 5 | `runStatus ∈ {RUNNING, BUSY}` | `working` | gõ phím |
| 6 | `runStatus = CANCELING`, hoặc bước cuối `CANCELED`/`INTERRUPTED`/`HALTED` | `stopped` | ngồi yên, kèm biểu tượng xám |
| 7 | `runStatus = IDLE` | `idle` | ngồi, có hành động ngẫu nhiên (FR-012) |
| 8 | còn lại | `unknown` | mờ, kèm "?" (Constitution I) |

- Một trạng thái mới chỉ được coi là ổn định sau 1 lần lấy dữ liệu (≤ 1 giây), để tránh nhấp nháy.
  Tổng độ trễ vẫn ≤ 2 giây (SC-002).
- `stopped` và `error` trở về `idle` khi có tin nhắn mới hoặc sau 10 phút.

### Vòng đời của Employee

```text
(conversation xuất hiện) → entering (đi từ cửa vào bàn) → [idle ⇄ thinking ⇄ working ⇄ waiting_for_boss ⇄ error ⇄ stopped]
(conversation bị xoá) → leaving (đi ra cửa) → (biến mất, bàn trống)
```

## 7. Quota *(App, chỉ đọc, đã lọc thông tin cá nhân)*

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `planName` | string | ví dụ "Google AI Pro" |
| `groups` | `QuotaGroup[]` | gom theo cặp `remainingFraction` + `resetTime` (R9) |
| `QuotaGroup.models` | `{ label, modelId }[]` | |
| `QuotaGroup.remainingPercent` | number 0–100 | |
| `QuotaGroup.resetAt` | ISO datetime | |
| `QuotaGroup.low` | boolean | `remainingPercent < 10` (FR-043) |
| `credits` | `{ prompt: { available, monthly }, flow: { available, monthly } }` | |
| `fetchedAt` | ISO datetime | |

**Ràng buộc**: KHÔNG có `name` và `email` (FR-081).

## 8. Command & Mention *(App)*

- `Command`: `{ name: string, kind: 'system' | 'skill' | 'workflow', description?: string }`, lấy từ
  `GetSlashCommands`.
- `Mention`: `{ kind: 'file' | 'directory', uri: string, label: string }`. Đây là kiểu mà đợt 2 hỗ
  trợ. Các loại khác (`rule`, `mcp_resource`…) để sau.

## 9. Settings *(hệ thống, lưu `settings.json`)*

| Trường | Kiểu | Mặc định |
|---|---|---|
| `schemaVersion` | number | 1 |
| `city` | `'hanoi' \| 'hcmc' \| 'singapore' \| 'tokyo' \| 'newyork'` | `hanoi` |
| `theme` | `'light' \| 'dark'` | theo hệ điều hành ở lần đầu |
| `detailLevel` | `'low' \| 'medium' \| 'high'` | `medium` |
| `autoLowerDetail` | boolean | true |
| `camera` | `'overview' \| 'first_person'` | `overview` |
| `defaultModel` | string \| null | null (dùng mặc định của App) |

## 10. WeatherSnapshot *(lưu đệm `weather-cache.json`, 30 phút)*

| Trường | Kiểu |
|---|---|
| `city` | City |
| `condition` | `'clear' \| 'cloudy' \| 'rain' \| 'storm' \| 'fog_snow'` |
| `isDay` | boolean |
| `temperatureC` | number |
| `fetchedAt` | ISO datetime |
| `source` | `'open-meteo'` |
