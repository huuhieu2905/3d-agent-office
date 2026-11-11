# Mô hình dữ liệu: Tuyển nhân viên từ conversation có sẵn

## EmployeeProfile (`employees.json`, thuộc văn phòng) — có thay đổi

| Trường | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| appearance, deskId, meetingSeatId, lastSeenAt, preferredModel | — | không đổi | |
| `memberSince` | ISODateTime \| null, tuỳ chọn | **mới** | Đặt khi sếp tuyển (mới hoặc có sẵn); null/không có = không ở trong văn phòng. |

## EmployeeProfilesFile — có thay đổi

| Trường | Kiểu | Thay đổi | Ghi chú |
|---|---|---|---|
| schemaVersion | 1 | không đổi | File cũ vẫn hợp lệ. |
| profiles | record | không đổi | |
| `membersSeeded` | boolean, tuỳ chọn | **mới** | Đặt một lần sau khi chuyển đổi (nghiên cứu R5). |

## Giá trị suy ra (không lưu)

- **Thành viên**: hồ sơ có `memberSince` ∧ App đang liệt kê conversation ∧ `parentId == null`.
- **Employee.visible**: là thành viên, hoặc là subagent có tổ tiên gốc là thành viên và nằm trong trần: tổng số người hiện ≤ `MAX_VISIBLE = 20`, subagent ít hoạt động gần đây nhất bị cắt trước (FR-018).
- **Thành viên chờ (`pendingMembers`, chỉ trong bộ nhớ)**: id vừa được tuyển nhưng App chưa liệt kê ở lần poll gần nhất; vẫn được đếm vào giới hạn 20. Bị bỏ khi App liệt kê nó, hoặc sau `PENDING_POLLS = 10` lần poll thành công mà App vẫn chưa liệt kê.
- **Số thành viên**: số lượng thành viên; giới hạn `OFFICE_LIMIT = 20` (hằng số dùng chung, server và hộp thoại cùng dùng).

## ProjectConversation (một mục trong phản hồi API, không lưu)

| Trường | Kiểu | Nguồn |
|---|---|---|
| id | string | App |
| title | string | App |
| lastActivityAt | ISODateTime | App |
| runStatus | RunStatus | App |
| inOffice | boolean | là thành viên? |

## Chuyển trạng thái (một conversation cấp cao nhất)

```text
không phải thành viên ──tuyển (mới) / join (có sẵn), số đếm < 20──▶ thành viên
không phải thành viên ──tuyển / join, số đếm = 20──▶ thành viên   (thành viên rảnh lâu không hoạt động nhất ──▶ không phải thành viên)
thành viên ──leave──▶ không phải thành viên   (conversation vẫn còn trong App)
thành viên ──fire (DELETE)──▶ mất              (conversation bị xoá trong App)
thành viên ──bị xoá trong App──▶ mất           (không còn được đếm ở lần poll sau)
không phải thành viên ──tuyển / join, số đếm = 20, cả 20 đều bận──▶ bị từ chối (409 OFFICE_FULL)
```

## Người rời đi (suy ra, không lưu)

- `pickLeaver(members)`: trong các thành viên có trạng thái hiển thị không thuộc `working`, `thinking`, `waiting_for_boss`, người có `lastActivityAt` cũ nhất (hoà → `memberSince` cũ hơn); `null` nếu không có ai (nghiên cứu R8).

## Kiểm tra hợp lệ

- Id: regex `ID` có sẵn `^[A-Za-z0-9-]{1,100}$` cho tham số `:id`.
- Body của `join`: `{ deskId?: string ≤ 200 }` (giống `newConversationSchema.deskId`).
- `join` vào một subagent → 400 (subagent không được tuyển trực tiếp).
