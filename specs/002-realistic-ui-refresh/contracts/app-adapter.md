# Contract: App adapter — thay đổi cho 002

Bổ sung vào `specs/001-3d-agent-office/contracts/app-adapter.md`. Không thêm RPC mới. Chỉ đọc thêm
trường từ dữ liệu đã lấy (Constitution II).

## A2-1 · `Conversation.currentModel`

| | |
|---|---|
| Nguồn | Step mới nhất trong các step đã tải có thông tin model: ưu tiên model mà người dùng yêu cầu ở lượt nhập (`requestedModel` hoặc trường tương đương trong cấu hình lượt), nếu không có thì `generatorModel` của step agent |
| Kiểu | `string \| null` (modelId dạng `MODEL_*`, giống `ModelOption.modelId`) |
| Khi không chắc | `null` (Constitution I: không đoán) |
| Chỉ đọc | Không gửi gì tới App |

**Contract test** (fixture `tests/contract/fixtures/app-2.24.0/`):
1. `GetCascadeTrajectorySteps.json` → `currentModel` bằng model của lượt cuối (fixture có
   `MODEL_PLACEHOLDER_M318`).
2. Conversation không có step model → `null`.
3. Trường model sai kiểu → `null` và không ném lỗi.

Nếu khi ghi fixture từ App thật thấy tên trường khác, cập nhật mapper và test ở lớp này, không sửa nơi
khác.

**Đã cài (2026-11-07)**: trong App 2.24.0, model người dùng chọn cho một lượt nằm ở
`userInput.userConfig.plannerConfig.planModel` (dự phòng `lastUserConfig`). Danh sách conversation
(`GetAllCascadeTrajectories`) không có trường model, nên:
- `Step.model` (chỉ lượt người dùng) do `mapStep` điền; `latestRequestedModel(steps)` trong
  `src/shared/model.ts` lấy model của lượt người dùng mới nhất.
- `Employee.currentModel` được service nhân viên điền từ các step đã tải; khung chat còn tự tính lại từ
  toàn bộ lịch sử khi mở. `Conversation.currentModel` vẫn là `null` từ danh sách.
- Test: `tests/contract/adapter-current-model.test.ts`.
