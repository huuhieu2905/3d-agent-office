# Contract: Settings API (có thay đổi)

Endpoint không đổi: `GET /api/settings`, `PUT /api/settings` (vẫn cần mã phiên như trước).

## Thay đổi trong nội dung gửi

```jsonc
{
  "schemaVersion": 1,
  "city": "hanoi",
  "theme": "light",
  "detailLevel": "medium",
  "autoLowerDetail": true,
  "camera": "overview",
  "defaultModel": null,
  "legendCollapsed": false,
  "screensOff": [],
  "mouseSensitivity": 1.5        // MỚI, tuỳ chọn, số trong khoảng [0.25, 3]
}
```

| Yêu cầu | Phản hồi |
|---|---|
| Nội dung không có `mouseSensitivity` | 200; lưu không có trường này; `GET` không trả trường này (trình duyệt dùng 1) |
| `mouseSensitivity: 0.25` / `3` | 200 |
| `mouseSensitivity: 0.2`, `3.1`, `"1"` | 400, thông báo lỗi tiếng Anh |

## Thông báo lỗi

Mọi chuỗi `error.message` server trả về đều là tiếng Anh, ví dụ lý do bố cục không hợp lệ từ `src/shared/layout-validation.ts`, lỗi truy cập thư mục và lỗi của route project. Mã lỗi không đổi.
