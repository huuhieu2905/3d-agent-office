# Contract: App Adapter (lớp kết nối Antigravity App)

**Feature**: `001-3d-agent-office` | **Constitution**: Nguyên tắc II

Đây là **giao diện duy nhất** mà phần còn lại của server được dùng để nói chuyện với Antigravity
App. Mọi chi tiết như tên RPC, cổng, CSRF token, chứng chỉ tự ký, khác biệt macOS/Linux đều nằm
**bên trong** adapter (`src/server/app-adapter/`). Kiểu dữ liệu tham chiếu tới `data-model.md`.

## Giao diện

```ts
interface AppAdapter {
  // Vòng đời và kết nối
  start(): Promise<void>                       // bắt đầu dò tìm và theo dõi sức khoẻ (R6)
  stop(): Promise<void>
  onConnectionChange(cb: (s: ConnectionState) => void): Unsubscribe
  getConnection(): ConnectionState

  // Đọc
  listConversations(): Promise<Conversation[]>
  getSteps(conversationId: string, fromIndex?: number): Promise<Step[]>
  watchConversation(conversationId: string, cb: (steps: Step[]) => void): Unsubscribe // luồng hoặc polling (R7)
  getSlashCommands(model: string): Promise<Command[]>
  suggestMentions(conversationId: string, query: string): Promise<Mention[]>
  getModels(): Promise<ModelOption[]>
  getQuota(): Promise<Quota>                   // đã lọc tên và email

  // Ghi (chỉ gọi khi người dùng chủ động, FR-030)
  sendMessage(conversationId: string, input: UserInput): Promise<void>
  startConversation(input: UserInput & { projectId?: string }): Promise<{ conversationId: string }>
  cancel(conversationId: string): Promise<void>
  answerPermission(conversationId: string, requestId: string, decision: 'allow' | 'deny'): Promise<void>
}

type ConnectionState =
  | { kind: 'searching' }                          // chưa thấy tiến trình App
  | { kind: 'connected', appVersion: string, versionSupported: boolean }
  | { kind: 'error', reason: 'auth' | 'protocol' | 'unreachable', detail: string } // detail đã được che thông tin nhạy cảm

type UserInput = {
  parts: ({ text: string } | { mention: Mention })[]
  model: string                                    // bắt buộc (App yêu cầu planModel)
}

type ModelOption = { label: string, modelId: string, quotaGroupKey: string }
```

## Hành vi bắt buộc

| # | Hành vi | Kiểm thử |
|---|---|---|
| A1 | Không có tiến trình App thì `getConnection()` là `searching`. Mọi lệnh đọc hoặc ghi ném lỗi `AppUnavailableError`, không treo quá 3 giây | unit, dùng process finder giả |
| A2 | Tự phát hiện App khởi động lại (PID, cổng hoặc token đổi) và chuyển về `connected` trong ≤ 10 giây | unit + live |
| A3 | `appVersion != '2.24.0'` thì `versionSupported = false`, nhưng vẫn hoạt động | unit |
| A4 | Token và email KHÔNG xuất hiện trong log, trong thông báo lỗi, hay trong giá trị trả về | test rà log |
| A5 | Phản hồi sai định dạng (trường thiếu hoặc lạ) không làm sập adapter. Bước không nhận ra được ánh xạ thành `kind: 'other'`. Lỗi cấu trúc nghiêm trọng thì `error.reason = 'protocol'` | contract test dùng fixture có biến thể |
| A6 | `sendMessage` tạo bước `user` trong App, không phải `system` | live test |
| A7 | `cancel` làm `runStatus` về `IDLE` trong ≤ 3 giây | live test |
| A8 | `getQuota` gom nhóm theo cặp `remainingFraction` + `resetTime` và đánh dấu `low` khi dưới 10% | contract test |
| A9 | `suggestMentions` trả tối đa 50 kết quả trong ≤ 300 ms. Nếu API của App rỗng thì tự liệt kê file trong workspace | unit |
| A10 | Chỉ kết nối tới `127.0.0.1`. Bỏ qua kiểm tra chứng chỉ chỉ áp dụng cho agent kết nối tới đúng cổng đã dò | unit |

## Tổ chức bên trong (tham khảo, không ràng buộc phần ngoài)

```text
src/server/app-adapter/
├── index.ts              # createAppAdapter(): AppAdapter
├── discovery/
│   ├── process-darwin.ts # ps + lsof
│   ├── process-linux.ts  # /proc
│   └── probe.ts          # thử cổng bằng GetAllWorkflows
├── rpc-client.ts         # HTTPS + JSON, header x-codeium-csrf-token, https.Agent riêng
├── mappers/              # dữ liệu thô của App → kiểu miền nghiệp vụ (Conversation, Step, Quota…)
├── redact.ts             # che thông tin nhạy cảm
└── fixtures/             # (trong tests/) phản hồi App 2.24.0 đã làm sạch
```

## Các RPC đang dùng (App 2.24.0, chỉ adapter được biết)

`GetAllCascadeTrajectories`, `GetCascadeTrajectorySteps`, `StreamCascadeReactiveUpdates` (tuỳ chọn),
`SendUserCascadeMessage`, `StartCascade`, `CancelCascadeInvocation`, `HandleCascadeUserInteraction`,
`GetSlashCommands`, `GetAllSkills`, `GetMatchingContextScopeItems`, `GetUserStatus`, `GetAllWorkflows`
(thử cổng). Dịch vụ: `exa.language_server_pb.LanguageServerService`.
