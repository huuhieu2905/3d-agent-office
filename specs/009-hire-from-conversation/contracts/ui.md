# Hợp đồng giao diện (009)

Chữ trên giao diện giữ bằng tiếng Anh (feature 006, guard f); phần mô tả bằng tiếng Việt.

## Hộp thoại tuyển (`HireDialog`, mở từ "+ Hire employee" hoặc từ bàn trống)

```text
Hire a new employee                         18/20 in the office
Project  [ my-app ▾ ]
( • New conversation )  ( Existing conversation )

-- New conversation (không đổi) --
First task for the employee  [ textarea ]
Model                        [ picker ]

-- Existing conversation --
[ Filter by title… ]           (hiện khi > 10 mục)
┌──────────────────────────────────────────────┐
│ ◉ Refactor login            2 days ago        │
│ ○ Fix CI cache              in the office     │
│ ○ Write docs                3 weeks ago       │
└──────────────────────────────────────────────┘
                                  [Cancel] [Hire]
```

- Nút chuyển chế độ hiện ra khi đã chọn project; chuyển qua lại vẫn giữ nội dung đã gõ và model đã chọn.
- Các trạng thái của danh sách: "Loading conversations…", "No conversations in this project yet.", "The Antigravity App is not connected.", và khi Hire trả `404`: "This conversation no longer exists in the Antigravity App." (danh sách tải lại).
- Mỗi mục: tiêu đề, thời điểm hoạt động gần nhất dạng tương đối; mục là thành viên hiện "in the office".
- Hire dùng được khi: New → có task + model + project (như hiện nay); Existing → đã chọn một mục.
- Văn phòng đầy (20/20), có người rảnh: băng thông báo `hire-office-full` "The office is full (20/20). Hiring will send {title} (last active {relative time}) out of the office." Người được nêu tên do `pickLeaver` chọn trên kho nhân viên (nghiên cứu R8). Hire vẫn dùng được ở cả hai chế độ. Mục được chọn có "in the office" thì không hiện băng này (không ai phải rời đi).
- Văn phòng đầy và cả 20 đều bận: băng cảnh báo `hire-office-full` "The office is full (20/20) and everyone is busy. Remove an employee from the office before hiring another." Hire bị khoá, trừ khi mục được chọn có "in the office". Server trả `409 OFFICE_FULL` thì hiện đúng băng cảnh báo này.
- Sau khi Hire: hộp thoại đóng, chat của conversation đó mở ra.

## Khung chat

- Hành động mới **"Remove from office"** cạnh nút Fire có sẵn. Không cần xác nhận (không mất gì; conversation có thể tuyển lại). Khi thành công, khung chat đóng và nhân viên rời văn phòng.

## Danh sách "+N more employees" (thay đổi)

- Chỉ liệt kê subagent bị ẩn của thành viên (FR-018); `N` = số mục trong danh sách. Không có mục nào thì không hiện. Bấm một mục mở chat của subagent đó như hiện nay.

## Test id (thêm vào `tests/e2e/testids.ts`)

`hire-mode-new`, `hire-mode-existing`, `hire-conversation-list`, `hire-conversation-item`, `hire-filter`, `hire-office-count`, `hire-office-full`, `chat-remove-from-office`.
