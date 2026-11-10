# Contract: Giao diện và tương tác — thay đổi cho 004

Theo quy ước U-6 của 002:
- Chỉ phần tử DOM mang `data-testid`.
- Đối tượng 3D được truy cập qua `window.__agentOffice` (chỉ bật trong dev/webdriver).

## U4-1 · Panel chú giải dự án (US1)

| Phần tử | `data-testid` | Hành vi |
|---|---|---|
| Nút thu gọn/mở | `legend-toggle` | `aria-expanded` phản ánh trạng thái. Nhãn khi thu gọn: "Dự án (n)", kèm chấm màu của dự án đang làm nổi bật (nếu có) |
| Danh sách | `legend-list` | Chỉ hiện khi mở. Chiều cao không vượt quá vùng nhìn, cuộn bên trong |

Trạng thái được lưu ở `Settings.legendCollapsed` (L4-2).

## U4-2 · Xoá nhân viên (US2)

| Phần tử | `data-testid` | Hành vi |
|---|---|---|
| Nút 🗑 trong `chat-head` | `employee-delete` | Bị `disabled` khi nhân viên **hoặc một subagent con** có `visualState ∈ {working, thinking, waiting_for_boss}`, kèm `title="Dừng agent trước khi xoá"` |
| Hộp xác nhận | `confirm-delete` | `role="alertdialog"`. Nêu tên conversation, chữ "xoá vĩnh viễn trong Antigravity App" và, nếu có, "cùng N subagent con". Focus mặc định ở nút Huỷ; Esc là huỷ |
| Nút xác nhận | `confirm-delete-ok` | Màu nguy hiểm. Gọi L4-1. Đang chờ thì khoá cả hai nút |
| Lỗi | `confirm-delete-error` | Câu chữ theo mã lỗi: `AGENT_BUSY` → "Agent vừa bắt đầu chạy — dừng agent rồi thử lại"; `APP_UNAVAILABLE` → "Chưa kết nối được Antigravity App"; `APP_REJECTED` → "App không xoá được conversation này" |

Khi thành công: khung chat đóng và nhân viên đi ra cửa. Tổng cộng ≤ 3 lần bấm tính từ lúc mở chat
(SC-002).

## U4-3 · Góc nhìn thứ nhất (US4)

| Phím / thao tác | Hành vi |
|---|---|
| Nhắm vào đồ vật dùng được (≤ 2 m, lệch ≤ 12°) | Hiện gợi ý `fp-hint` dưới tâm ngắm: "E — Bật màn hình", "E — Tắt màn hình", "E — Ngồi" / "Shift+E — Nằm", "E — Uống nước", "E — Tưới cây" |
| `E` hoặc bấm chuột | Tương tác. Bấm chuột ưu tiên nhân viên trong tầm ngắm (mở chat, như cũ) |
| `WASD` hoặc `E` khi đang ngồi/nằm | Đứng dậy |
| Đi qua cửa | Cửa tự mở. Ra được công viên |

`FirstPersonHelp` thêm `<kbd>E</kbd> dùng đồ vật` (FR-036).

**Toàn cảnh**: nút ⏻ (`data-testid="screen-power"`, `aria-pressed`) dưới mỗi `wall_screen` (khi không ở
build mode) để bật/tắt. Bấm vào chính màn hình quota vẫn mở bảng quota (001 FR-043). Bấm vào nhân viên vẫn
mở chat. Mặc định mọi màn hình bật (`Settings.screensOff`).

## U4-4 · Test hook (`window.__agentOffice`, chỉ bật trong dev/webdriver)

Thêm vào `TestHooks.tsx`:

```ts
player(): { x: number; z: number; pose: 'standing' | 'sit' | 'lie'; aim: { itemId: string; action: string } | null };
teleportPlayer(x: number, z: number, yaw: number): void;   // chỉ cho e2e
brains(): { id: string; mode: string; activity: string | null; x: number; z: number; outside: boolean }[];
setBreakInterval(ms: number): void;                       // rút ngắn khoảng nghỉ khi thử
shops(): { id: string; x: number; z: number }[];
```
