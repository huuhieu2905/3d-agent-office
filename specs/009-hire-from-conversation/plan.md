# Kế hoạch triển khai: Tuyển nhân viên từ conversation có sẵn

**Branch**: `009-hire-from-conversation` | **Ngày**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Đầu vào**: Đặc tả tính năng từ `specs/009-hire-from-conversation/spec.md`

## Tóm tắt

Văn phòng không còn hiện "20 conversation hoạt động gần nhất" mà hiện các **thành viên**: tối đa 20 conversation cấp cao nhất do sếp tạo hoặc chọn, cùng subagent của chúng.

1. **Tư cách thành viên** là một trường tuỳ chọn trên hồ sơ nhân viên có sẵn (`memberSince`, trong `employees.json`). `EmployeesService.rebuild()` tính `visible` từ trường này thay vì từ thứ tự hoạt động; tổng số người hiện (kể cả subagent) vẫn ≤ `MAX_VISIBLE = 20`, chỉ subagent bị cắt. Một lần chuyển đổi duy nhất (cờ `membersSeeded`) biến các nhân viên đang hiện trước khi cập nhật thành thành viên.
2. **Giới hạn** (20, không tính subagent) được server kiểm tra dưới một khoá nhỏ trong tiến trình, trước khi tạo bất cứ thứ gì trong App. Khi đầy, thành viên rảnh lâu không hoạt động nhất rời văn phòng để nhường chỗ (hàm thuần dùng chung `pickLeaver`, nghiên cứu R8); chỉ khi cả 20 đều bận mới trả `409 OFFICE_FULL`.
3. **Route**: `GET /api/projects/:id/conversations` (các conversation cấp cao nhất của project, đọc từ App ngay lúc gọi), `POST /api/conversations/:id/join`, `POST /api/conversations/:id/leave`. `POST /api/conversations` (tuyển mới) giờ kiểm tra giới hạn và đánh dấu conversation mới là thành viên. `DELETE` xoá dấu thành viên cùng với bàn.
4. **Giao diện**: `HireDialog` có nút chuyển New/Existing, danh sách conversation kèm ô lọc và các trạng thái, bộ đếm `n/20` và băng báo trước ai sẽ rời đi khi văn phòng đầy. Khung chat có thêm "Remove from office" cạnh nút Fire. `OverflowList` chỉ còn liệt kê subagent bị ẩn vì trần 20 người hiện (conversation không phải thành viên được đưa vào qua hộp thoại tuyển).

## Bối cảnh kỹ thuật

**Ngôn ngữ/Phiên bản**: TypeScript 6, Node ≥ 22

**Phụ thuộc chính**: React 19, zustand 5, zod 4, Fastify 5 — không thêm phụ thuộc mới

**Lưu trữ**: `employees.json` (`JsonStore` có sẵn): `memberSince` tuỳ chọn trên từng hồ sơ, `membersSeeded` tuỳ chọn ở cấp file; schemaVersion giữ là 1

**Kiểm thử**: vitest (unit + contract test cho route với fixture đã ghi), Playwright e2e với `tests/e2e/mock-app.ts`

**Nền tảng đích**: Chromium trên macOS / Linux; server local ở 127.0.0.1

**Loại dự án**: ứng dụng web local (Fastify + React/three.js)

**Mục tiêu hiệu năng**: danh sách mở trong < 1 giây (một lần gọi `GetAllCascadeTrajectories`, vốn đã được bộ poll gọi mỗi giây); thành viên mới hiện ≤ 2 giây sau khi bấm Hire (một lần ép `employees.refresh()`)

**Ràng buộc**: không lưu bản sao conversation (Constitution I); không thêm RPC mới tới App; bản cài sẵn giữ nguyên văn phòng hiện tại (chuyển đổi lần đầu)

**Quy mô/Phạm vi**: sửa ~9 file nguồn; 1 file unit test, 1 file contract test, 1 spec e2e

## Kiểm tra Constitution

*CỔNG: Phải đạt trước Phase 0 (nghiên cứu). Kiểm tra lại sau Phase 1 (thiết kế).*

| Nguyên tắc | Kiểm tra | Kết quả |
|---|---|---|
| I. App là nguồn sự thật | Danh sách đọc trực tiếp từ App; chỉ lưu tư cách thành viên và bàn (dữ liệu trải nghiệm 3D). Thành viên bị xoá trong App rời văn phòng ở lần poll kế tiếp. | ✅ |
| II. Lớp kết nối cô lập | Không sửa adapter; dùng `listConversations()`, `startConversation()` có sẵn. | ✅ |
| III. Local-first, riêng tư | Route mới là local, sau session token có sẵn; id được kiểm tra bằng regex `ID` có sẵn; log chỉ ghi id và mã kết quả. | ✅ |
| IV. Giao theo đợt dùng được | US1+US2+US3 ra cùng nhau (giới hạn là thứ làm tư cách thành viên nhất quán); US4 (đưa ra) và US5 (trạng thái danh sách) là phần thêm nhỏ trên cùng các route. | ✅ |
| V. Trải nghiệm + hiệu năng | Không đổi scene; nhân viên vào/ra theo đường visible → hidden có sẵn. Tổng số người hiện giữ ≤ 20 như mức đã đo 60 FPS (FR-018), nên không cần đo lại. | ✅ |
| VI. macOS + Linux | Không có mã riêng cho hệ điều hành. | ✅ |
| Cổng chất lượng | Guard (c): `startConversation` vẫn nằm trong `src/server/http/routes/`. Guard (f): chữ trên giao diện bằng tiếng Anh. Thử với App thật chỉ ghi vào conversation tên `[test-009] …` và dọn sau khi thử (quickstart). | ✅ |

Không có vi phạm. **Kiểm tra lại sau thiết kế**: không đổi, ✅.

## Cấu trúc dự án

### Tài liệu (feature này)

```text
specs/009-hire-from-conversation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── contracts/ui.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Mã nguồn (gốc repo)

```text
src/
├── shared/
│   ├── domain.ts                    EmployeeProfile.memberSince, EmployeeProfilesFile.membersSeeded, OFFICE_LIMIT = 20
│   ├── office.ts                    pickLeaver(members) + BUSY_STATES, dùng chung cho server và hộp thoại (R8)
│   └── schemas.ts                   các trường tuỳ chọn tương ứng; joinSchema { deskId? }
├── server/
│   ├── services/employee-profiles.ts   setMember(id, on), đọc/ghi membersSeeded
│   ├── services/employees.ts           visible = thành viên hoặc subagent của thành viên; chuyển đổi một lần; memberCount(); khoá admit(fn)
│   └── http/routes/
│       ├── employees.ts             GET /api/projects/:id/conversations, POST join / leave
│       └── conversations.ts         POST /api/conversations: giới hạn + thành viên; DELETE xoá dấu thành viên
└── web/
    ├── ui/chat/HireDialog.tsx       chuyển chế độ, danh sách, ô lọc, trạng thái, n/20, báo trước người rời đi
    ├── ui/chat/ChatPanel.tsx        hành động "Remove from office"
    ├── ui/OverflowList.tsx          chỉ liệt kê subagent bị ẩn của thành viên; nhãn đếm = độ dài danh sách
    └── state/employees.ts           selectHidden → chỉ subagent bị ẩn có tổ tiên gốc đang hiện

tests/
├── unit/employees-membership.test.ts      quy tắc visible, chuyển đổi, giới hạn, không tính subagent
├── unit/office-leaver.test.ts             pickLeaver: bỏ qua người bận, cũ nhất, hoà, không ai
├── contract/routes-membership.test.ts     lọc danh sách, join/leave, nhường chỗ + evicted, OFFICE_FULL khi cả 20 bận, delete xoá dấu thành viên
└── e2e/hire-existing.spec.ts              US1/US3/US4 qua hộp thoại với mock App
```

**Quyết định cấu trúc**: giữ cấu trúc một repo như các feature 001–008; không thêm module mới, thay đổi nằm trong service nhân viên, kho hồ sơ, route và hộp thoại tuyển có sẵn.

## Theo dõi độ phức tạp

Không có vi phạm cần giải trình.
