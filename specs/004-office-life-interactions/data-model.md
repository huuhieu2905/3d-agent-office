# Data Model: Đời sống văn phòng

**Feature**: `004-office-life-interactions` | **Date**: 2026-11-09

Dữ liệu chia làm hai loại:
- **Dữ liệu lưu**: chỉ thêm hai trường tuỳ chọn vào `Settings`, và xoá `deskId` khỏi profile khi xoá
  conversation.
- **Dữ liệu lúc chạy**: chỉ nằm trong bộ nhớ của trình duyệt, không bao giờ lưu.

Không có dữ liệu conversation nào bị sao chép (Nguyên tắc I).

---

## 1. `Settings` (sửa, `src/shared/domain.ts` + `schemas.ts`)

| Trường | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `legendCollapsed` | `boolean?` | `false` | FR-003. Optional trong zod. Nếu là trường bắt buộc, file cũ sẽ không qua `safeParse` và bị reset về mặc định (R4-01) |
| `screensOff` | `string[]?` (≤ 50 id, mỗi id ≤ 100 ký tự) | `[]` | FR-031. Id các `wall_screen` **đã tắt**. Mặc định mọi màn hình bật, vì màn hình đầu tiên hiện quota từ 001 (FR-040); nếu đổi sang lưu danh sách "đang bật" thì quota sẽ biến mất mặc định. Client lọc bỏ id không còn trong layout trước khi lưu (đổi khi làm, 2026-11-09) |

`schemaVersion` giữ nguyên là `1`, vì thay đổi này chỉ thêm trường, tương thích ngược.

## 2. `EmployeeProfile` (vòng đời sửa)

Khi `DELETE /api/conversations/:id` thành công, server đặt `deskId = null` cho profile đó và cho mọi
subagent con của nó (theo `parentId`, mọi cấp), vì App xoá luôn các con. Lần
`refresh` sau, App không còn liệt kê conversation này, nên `forgetMissingModels` xoá luôn model đã
nhớ (như hiện tại).

```text
present ──(người dùng xác nhận xoá, App OK)──▶ deskId=null ──(refresh: App không còn liệt kê)──▶ removed (patch)
present ──(App lỗi / mất kết nối / agent bận)──▶ present (không đổi gì)
```

## 3. Trạng thái "agent bận" dùng để chặn xoá (FR-015)

Server tính từ dữ liệu App ngay lúc nhận yêu cầu xoá, cho **conversation và mọi subagent con** của nó.
Nếu bất kỳ conversation nào trong cây đúng **một trong hai** điều kiện sau thì không xoá:
- `computeVisualState(...)` ∈ `{working, thinking, waiting_for_boss}`;
- `conversation.runStatus === 'CANCELING'`.

Client dùng cùng tập trạng thái trên `employee.visualState` để khoá nút (chỉ là gợi ý; server mới
quyết định).

## 4. `SiteGrid` (lúc chạy, `src/shared/site-nav.ts`)

| Thuộc tính | Ý nghĩa |
|---|---|
| `office: OfficeGrid` | Lưới sàn văn phòng (giữ nguyên) |
| `ox, oz` | Lệch ô (số nguyên) từ góc tây bắc của khu đất tới góc tây bắc của sàn |
| `width, depth` | Số ô của khu đất: `2·ceil(PARK_RADIUS/0.25)` |
| `doorCells` | Các ô ở mép sàn thuộc cửa chính; cạnh chu vi chỉ mở tại các ô này |
| `obstacles` | Hình chữ nhật của quán và vòng tròn thân cây (bộ cây đang vẽ), qua bảng băm 4 m |

**Luật**:
- `walkable(ô trong sàn)` = `office.walkable`.
- `walkable(ô ngoài)` = trong `PARK_RADIUS − 1` **và** không trúng vật cản.
- `canStep` qua chu vi sàn chỉ đúng khi ô trong sàn thuộc `doorCells`.
- `indoorView()`: cùng hệ ô, nhưng `inside` / `neighbours` chỉ nhận ô trong sàn. A* trong nhà và
  `avoiding(...)` dùng view này, để chỉ số ô luôn khớp với `Crowd` (R4-03).

## 5. Quán hàng `ParkShop` (lúc chạy, `park-layout.ts`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | `'cafe' \| 'grocery' \| 'sugarcane' \| 'banhmi'` | |
| `kind` | `'kiosk' \| 'grocery' \| 'cart'` | Kiểu vẽ |
| `name` | string | Tên hư cấu |
| `x, z, facing` | number | Tính từ `parkFrame`, sát mép ngoài vòng đường dạo |
| `footprint` | `{ w, d }` (m) | Vật cản trong `SiteGrid` |
| `seats` | `Spot[]` (2–4) | Ghế đẩu |
| `stands` | `Spot[]` (1–2) | Chỗ đứng trước quầy |

`Spot = { id: string; x: number; z: number; facing: number }`

## 6. `SpotBook` (lúc chạy, `src/web/scene/break-spots.ts`)

| Thao tác | Ý nghĩa |
|---|---|
| `reserve(owner, spotId) → boolean` | Giữ chỗ. Thất bại nếu chỗ đã có người giữ |
| `release(owner)` | Trả mọi chỗ mà owner đang giữ |
| `outingSlots(n)` / `tryOuting(owner)` | Giới hạn số người ở ngoài cùng lúc: `max(1, floor(n/3))` |
| `revalidate(layout, shops)` | Huỷ chỗ không còn tồn tại, rồi trả về danh sách owner bị ảnh hưởng (họ sẽ `recall()`) |

Chỗ ngồi sofa: 2 chỗ mỗi sofa (`<itemId>:L`, `<itemId>:R`). Nằm thì giữ cả 2. Người dùng ở góc nhìn
thứ nhất có owner là `__player__`.

## 7. `EmployeeBrain` (sửa, `employee-behaviors.ts`)

Mode mới: `outing`, `resting`. `then` của `walking` có thêm giá trị `go-out`.

```text
seated ─(đến lượt nghỉ)─▶ chọn hoạt động
  ├─ vươn vai ──▶ acting(ThumbsUp) ──▶ seated
  ├─ uống nước ─▶ walking(drink) ─▶ acting(Drinking) ─▶ walking(sit) ─▶ seated
  ├─ sofa ──────▶ walking(sofa) ──▶ resting(sit|lie, 20–90 s) ─▶ walking(sit) ─▶ seated
  └─ quán ──────▶ walking(go-out) ─▶ outing(shop) ─▶ resting(sit|stand, 20–90 s)
                    ─▶ outing(home) ─▶ walking(sit) ─▶ seated

bất kỳ mode nghỉ nào ─(setVisual: có việc)─▶ recall(): nhả chỗ, chạy (2.8 m/s) về bàn
bất kỳ mode nghỉ nào ─(build mode / mất chỗ / mất kết nối)─▶ recall(): đi bộ về bàn
outing|resting ngoài trời ─(thời tiết: rain|storm)─▶ recall({ umbrella }): cầm ô, chạy về; ô tắt khi vào trong
outing|resting ngoài trời ─(leave)─▶ outing tới rìa gần nhất ─▶ left
```

**Bất biến**:
- Một brain giữ tối đa một chỗ.
- Mọi chỗ được nhả khi về `seated` hoặc `left`, hoặc khi `dispose()`.

## 8. Tương tác góc nhìn thứ nhất (lúc chạy)

| Thực thể | Trường | Lưu? |
|---|---|---|
| `Interactable` | `itemId`, `type`, `x, y, z`, `label` (ví dụ "Bật màn hình") | Không |
| `PlayerPose` | `standing` \| `{ sofa: spotId; pose: 'sit' \| 'lie' }` | Không |
| `freshPlants` | `Map<itemId, until>` trong `useUi` | Không |
| màn hình bật | `Settings.screensOff` | **Có** (§1) |
