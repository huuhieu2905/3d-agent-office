# Data Model: Làm mới giao diện theo concept thực tế hơn

**Feature**: `002-realistic-ui-refresh` | **Date**: 2026-11-07

Chỉ ghi phần **thay đổi** so với `specs/001-3d-agent-office/data-model.md`. Mọi dữ liệu dưới đây là
dữ liệu trải nghiệm riêng của hệ thống (Constitution I), lưu trong file JSON ở thư mục cấu hình người
dùng.

---

## §1 · EmployeeProfile (`employees.json`) — mở rộng

| Trường | Kiểu | Mới? | Ghi chú |
|---|---|---|---|
| `appearance` | object | | Không đổi |
| `deskId` | string \| null | | Không đổi. Ghi qua `PUT /api/layout` (`seating`) khi ở chế độ sắp xếp |
| `lastSeenAt` | ISO date | | Không đổi. Dùng để dọn hồ sơ khi conversation biến mất |
| `preferredModel` | `{ modelId: string; chosenAt: ISODate }` \| null | ✅ | Model người dùng chọn cho conversation này (FR-001) |

**Quy tắc**:
- `preferredModel` được ghi ngay khi người dùng đổi model trong picker, không chờ gửi tin.
- `preferredModel` bị xoá cùng hồ sơ khi conversation không còn trong App (FR-005), theo cơ chế dọn
  hồ sơ hiện có.
- Server không kiểm tra `modelId` có trong danh sách App khi ghi. Việc kiểm tra tính khả dụng làm khi
  hiển thị (FR-004), vì danh sách model thay đổi theo quota.

## §2 · Conversation (domain, từ App) — điền trường có sẵn

| Trường | Thay đổi |
|---|---|
| `currentModel` | Lớp kết nối App điền từ step gần nhất có model (`requestedModel` của lượt người dùng, nếu không có thì `generatorModel`), thay vì luôn `null` |

**Model hiển thị** (tính ở client, không lưu):
`preferredModel?.modelId ?? currentModel ?? settings.defaultModel ?? models[0]`, kèm cờ
`unavailable` khi model đó không có trong danh sách hoặc nhóm quota còn 0%.

---

## §3 · OfficeLayout (`layout.json`) — schema v2

```text
OfficeLayout v2
├── schemaVersion: 2
├── floor:  { width: number, depth: number }          // mét, 6..40, bước 0.5 (FR-022/023)
├── shell:  {                                         // vỏ văn phòng, sinh theo floor (R2-05)
│     glassSide: 'north',                             // mặt kính hướng công viên
│     door: { side: 'south'|'east'|'west', offset: number }  // mét tính từ góc tây/bắc của cạnh đó
│   }
├── items:  PlacedItemV2[]
└── seating?: never                                   // chỗ ngồi KHÔNG lưu ở đây (thuộc EmployeeProfile)

PlacedItemV2
├── id: string
├── type: ItemType                                    // không đổi danh sách, bỏ 'door' khỏi items (về shell)
├── pos: { x: number, z: number }                     // mét từ góc tây bắc, bội số 0.05 (FR-007)
├── rotation: 0 | 90 | 180 | 270
```

**Hệ toạ độ**: gốc ở góc tây bắc của sàn, `x` tăng về đông, `z` tăng về nam. Khi vẽ, sàn được đặt sao
cho tâm trùng gốc thế giới (giống v1).

**Quy tắc kiểm tra** (`src/shared/layout-validation.ts`, dùng chung client/server):
1. `6 ≤ floor.width, floor.depth ≤ 40`, là bội số của 0,5 (FR-023).
2. Furniture (`desk`, `chair`, `plant`, `water_cooler`, `sofa`, `wall_screen`): `pos` là bội số 0,05.
   Hình chữ nhật footprint (kích thước trong `CATALOG` tính bằng mét, đổi chiều khi xoay 90/270) nằm
   trọn trong sàn.
3. Vách trong (`wall`, `glass_wall`): `pos` là bội số 0,5 (bám cạnh lưới).
4. Không có hai vật chặn (`blocks: 'cell'`) chồng hình chữ nhật lên nhau (sai số 1 mm). Ghế được chồng
   lên vùng ngồi của bàn mà nó thuộc về.
5. Mỗi bàn có điểm ngồi đi tới được từ cửa trên **lưới điều hướng 0,25 m** (đã nới bán kính nhân viên
   0,28 m) (FR-008).
6. `shell.door.offset` nằm trong chiều dài cạnh trừ chiều rộng cửa (1 m).

**Chuyển đổi v1 → v2** (khi đọc file, trước khi kiểm tra):
- `floor.width = widthCells × 0,5`, `floor.depth = depthCells × 0,5`.
- Furniture: `pos = { x: cell.x × 0,5, z: cell.z × 0,5 }`.
- `wall`/`glass_wall` nằm trên chu vi (x = 0, x = widthCells − 1 với rotation 90, z = 0, z =
  depthCells − 1) → bỏ khỏi `items`. Nếu mọi ô trên cạnh bắc là `glass_wall` → `glassSide: 'north'`.
- `door` trên chu vi → `shell.door`. Nếu không có cửa thì cửa giữa cạnh nam.
- Vách trong giữ nguyên, `pos = cell × 0,5`.
- File cũ được sao lưu `layout.v1.bak.json` trước khi ghi bản v2 lần đầu (FR-014).
- Kiểm thử: bố cục mặc định v1 chuyển sang v2 giữ đủ 12 bàn, 12 ghế, đồ vật khác và chỗ ngồi.

**Đổi kích thước** (FR-024):
- `minWidth = max(6, ceil0.5(max(item.pos.x + footprint.w) + 0,5))`, tương tự cho `minDepth`.
- Thu nhỏ dưới mức này bị từ chối. Danh sách item đang chặn được trả về để tô đỏ.

**Bàn di chuyển** (FR-015): `deskId` của nhân viên giữ nguyên khi `pos` của bàn đổi, nên nhân viên tự
đi theo. Ghế đi kèm bàn được dời cùng `delta` nếu nằm trong vùng ngồi của bàn.

---

## §4 · BuildDraft (client, không lưu) — mở rộng

| Trường | Mới? | Ghi chú |
|---|---|---|
| `draft: OfficeLayout v2` | | Có thêm `floor` để xem trước khi đổi kích thước |
| `seating: Record<conversationId, deskId \| null>` | ✅ | Chỗ ngồi thay đổi trong phiên sắp xếp, có undo/redo |
| `selectedId` | | Một đồ vật hoặc `null` (FR-006) |
| `drag: { kind: 'item' \| 'employee'; id; origin; pointerId; startedPx } \| null` | ✅ | Trạng thái kéo (R2-02) |
| `resizeBlockers: string[]` | ✅ | Item chặn thu nhỏ (FR-024) |

Lưu (`PUT /api/layout`) gửi `{ layout, seating }` trong một lần. Thoát không lưu thì bỏ cả hai.

---

## §5 · Crowd agent (client, không lưu)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | conversationId | |
| `pos`, `vel` | vec2 (m, m/s) | |
| `radius` | 0,28 m | |
| `state` | `'seated' \| 'moving' \| 'waiting' \| 'reacting'` | `seated` = vật cản tĩnh, khối lượng vô hạn |
| `priority` | number | Đi về bàn > đi rảnh. Hoà thì so mã băm id (R2-04) |
| `path` | Cell[] | Từ A* trên lưới 0,25 m |
| `blockedFor` | giây | > 0,4 s → sự kiện `bump`; > 5 s → tìm đường lại hoặc về bàn (FR-021) |
| `reaction` | `{ kind: 'bump_person' \| 'bump_object'; towards: vec2; until: t } \| null` | 0,6–1,0 s (FR-018) |

**Chuyển trạng thái**:

```text
seated ──(break / đổi bàn)──▶ moving ──(chạm, |Δv| > 0.3)──▶ reacting ──(hết thời gian)──▶ moving
moving ──(bị chặn > 0.4 s)──▶ waiting ──(đường thông)──▶ moving
waiting ──(> 5 s, tìm đường lại thất bại)──▶ moving (về bàn) | waiting
moving ──(tới chỗ ngồi)──▶ seated
```

**Bất biến** (kiểm thử mô phỏng): với mọi cặp agent và mọi bước, `|pᵢ − pⱼ| ≥ rᵢ + rⱼ − 0,01`. Không
agent nào nằm trong ô bị chặn của lưới điều hướng (FR-016).

## §6 · Prop jiggle (client, không lưu)

`Map<itemId, { offset: vec2; angle: number; vel }>` theo lò xo tắt dần (≈ 0,8 s), chỉ cho
`chair`, `plant` (và `bin` nếu concept có). Không bao giờ ghi ngược vào `layout` (FR-019).

---

## §7 · Concept decision (tài liệu, không phải dữ liệu runtime)

`specs/002-realistic-ui-refresh/concept-decision.md`:

| Trường | Ghi chú |
|---|---|
| `status` | `pending` \| `chosen` |
| `chosen` | A–E (R2-06) |
| `feedback` | Góp ý chỉnh sửa của người dùng |
| `tokens` | Bảng màu sáng/tối, font tiêu đề/nội dung, bán kính bo góc, vật liệu chủ đạo, HDRI, bộ nhân vật |

Token được chép vào `src/web/theme/concept.ts` (3D) và `src/web/styles.css` (UI) khi làm US6.

## §8 · Settings — không đổi schema

`defaultModel` vẫn là mức dự phòng cuối cùng. Không thêm trường `concept` (chỉ có một concept).
