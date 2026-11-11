# Nghiên cứu: Tuyển nhân viên từ conversation có sẵn

## R1. Lưu tư cách thành viên ở đâu

- **Quyết định**: thêm trường tuỳ chọn `memberSince: ISODateTime | null` vào `EmployeeProfile` trong `employees.json`.
- **Lý do**: hồ sơ đã chứa dữ liệu văn phòng theo từng conversation (bàn, ghế họp, ngoại hình, model) và đã tự biến mất 30 ngày sau khi App không còn liệt kê conversation đó. Chỉ một trường, không thêm file, không tăng phiên bản schema (trường tuỳ chọn, file cũ vẫn hợp lệ).
- **Phương án khác**: một file `members.json` riêng (thêm một kho phải đồng bộ với bàn — loại); một trường trong `layout.json` (layout nói về nội thất, không phải con người — loại).

## R2. Conversation nào được tính là thành viên

- **Quyết định**: một conversation là thành viên khi hồ sơ của nó có `memberSince` **và** App đang liệt kê nó **và** nó là cấp cao nhất (`parentId == null`). Visible = thành viên, cộng các subagent có tổ tiên gốc là thành viên, sắp theo `lastActivityAt` giảm dần, lấy tới khi tổng số người hiện đạt `MAX_VISIBLE = 20` (FR-018). Thành viên (≤ 20) luôn hiện, nên chỉ subagent bị cắt.
- **Vì sao có trần 20 người hiện**: Nguyên tắc V yêu cầu 60 FPS với số nhân viên tối đa mà spec cam kết; 20 là con số đã được đo từ các feature trước, nên giữ nguyên `MAX_VISIBLE` là cách không cần đo lại.
- **Lý do**: việc kiểm tra "App còn liệt kê" làm cho "bị xoá trong App ⇒ rời văn phòng, nhả chỗ" tự xảy ra (trường hợp biên trong spec), không cần tác vụ dọn dẹp. Subagent theo conversation cha và không bao giờ được tính (giả định trong spec).
- **Phương án khác**: xoá `memberSince` khi conversation biến mất — dễ sai khi App trục trặc tạm thời (danh sách rỗng đã được coi là trục trặc ở chỗ khác); không cần vì kiểm tra "App còn liệt kê" đã xử lý.

## R3. Đảm bảo giới hạn 20, kể cả khi tranh chấp

- **Quyết định**: `EmployeesService.admit(fn)` chạy `fn` dưới một khoá dạng chuỗi promise (mỗi lúc chỉ một lần tuyển trong tiến trình): đếm thành viên; nếu đã đủ 20 thì cho một thành viên rời đi theo R8 (hoặc ném `OfficeFullError` khi không ai rời được); chạy `fn` (có thể gọi `startConversation`), rồi đặt `memberSince`. Mọi quyết định này xảy ra trước mọi lời gọi tới App, và `OfficeFullError` → route trả `409 OFFICE_FULL`.
- **Cách đếm**: số thành viên = hồ sơ có `memberSince`, là cấp cao nhất, và (App đang liệt kê **hoặc** vừa được thêm sau lần poll gần nhất). Phần "vừa được thêm" là một tập `pendingMembers` trong bộ nhớ, xoá dần khi conversation xuất hiện trong lần poll sau. Một id chờ quá `PENDING_POLLS = 10` lần poll thành công (~10 giây) mà App vẫn chưa liệt kê cũng bị bỏ khỏi tập, để nó không giữ một chỗ vô hình mà không có nhân viên nào để bấm Remove. Khi hết hạn, `memberSince` của id đó cũng bị xoá (`setMember(id, false)`), để nếu App liệt kê nó muộn hơn thì nó không âm thầm thành thành viên thứ 21. Không có phần này, conversation vừa tạo bằng `startConversation` chưa có trong danh sách sẽ không bị đếm, và hai lần tuyển liên tiếp có thể vượt 20. `refresh()` được await bên trong khoá.
- **Bàn ngồi**: chỉ gán `deskId` khi bàn đó đang trống (không ai giữ trong hồ sơ); nếu không thì để `assignDesks` tự xếp bàn trống khác. Không dùng `profiles.update({ deskId })` vì hàm này đổi chỗ với người đang ngồi.
- **Lý do**: server là một tiến trình Node; xếp hàng vài yêu cầu tuyển là đủ để hai lần tuyển cùng lúc mỗi lần cho đúng một người rời đi (trường hợp biên trong spec). `startConversation` vẫn nằm đúng trong file route (guard c).
- **Phương án khác**: chỉ kiểm tra ở client (hai tab vẫn tranh nhau — loại); bộ đếm giữ chỗ (thêm trạng thái mà hiệu quả như nhau).

## R4. Nguồn của danh sách conversation theo project

- **Quyết định**: `GET /api/projects/:id/conversations` gọi `adapter.listConversations()` ngay lúc nhận yêu cầu và lọc `projectId === id && parentId == null && stepCount > 0`; sắp theo `lastActivityAt` giảm dần; thêm `inOffice` (có là thành viên không).
- **Lý do**: "đồng bộ chính xác với App" (SC-002) — dùng đúng mapper văn phòng đang dùng, dữ liệu mới lúc mở, cùng quy tắc project như khi tô màu project. `stepCount > 0` loại các conversation rỗng mà App tạo nhưng không bao giờ hiện (bước kiểm tra tương thích đã lọc theo cách này).
- **Phương án khác**: lấy từ kho nhân viên ở client — kho chứa mọi conversation nhưng tiêu đề có thể trễ tới 1 giây và danh sách sẽ phụ thuộc bộ poll; một lần đọc riêng vừa rẻ vừa đúng nguồn.

## R5. Chuyển đổi một lần cho bản cài sẵn

- **Quyết định**: ở lần poll thành công đầu tiên khi App đã kết nối **và danh sách không rỗng**, nếu chưa có `membersSeeded`: đánh dấu thành viên cho các conversation cấp cao nhất trong 20 conversation hoạt động gần nhất (quy tắc cũ), rồi đặt `membersSeeded = true`. Danh sách rỗng được coi là trục trặc tạm thời (giống `forgetMissingModels`) nên không chạy chuyển đổi và không đặt cờ. Hệ quả nhỏ được chấp nhận: bản cài mới hoàn toàn chưa có conversation nào sẽ chạy chuyển đổi ở lần đầu App có conversation.
- **Lý do**: FR-017; văn phòng không bị trống sau khi cập nhật. Đồng thời giữ cho các spec e2e hiện có (tạo conversation trong mock App trước khi văn phòng khởi động) vẫn chạy.
- **Rủi ro**: spec e2e nào thêm conversation cấp cao nhất vào mock App *sau khi* khởi động mà vẫn chờ nó hiện trong văn phòng thì giờ phải tuyển nó; được kiểm tra trong tasks.

## R6. Đưa ra khỏi văn phòng so với sa thải

- **Quyết định**: `POST /api/conversations/:id/leave` đặt `memberSince = null`, `deskId = null`, `meetingSeatId = null` cho conversation đó (subagent rời theo nhờ quy tắc visible). Sa thải (`DELETE`) cũng xoá `memberSince` cho cả cây.
- **Lý do**: nhả chỗ mà không động tới App (SC-006). Nhân viên biến mất theo đường visible → hidden có sẵn; không thêm hoạt ảnh mới.
- **Hoạt ảnh vào/ra**: theo đúng hành vi hiện có, không làm mới. Khi tuyển (mới hoặc có sẵn), nhân viên vào văn phòng như một nhân viên mới hiện nay. Khi bị đưa ra, bị sa thải hoặc bị ẩn, nhân viên biến mất như khi một nhân viên chuyển sang hidden hiện nay. Các chữ "bước vào" và "rời đi" trong spec hiểu theo nghĩa này.

## R7. Danh sách "+N more"

- **Quyết định**: giữ `OverflowList`, nhưng chỉ liệt kê **subagent bị ẩn của thành viên**: nhân viên có `isSubagent && !visible` và tổ tiên gốc (đi ngược theo `parentId` trong kho nhân viên ở client) là nhân viên đang hiện. Nhãn đếm dùng độ dài danh sách này thay cho trường `overflow`. Trường `overflow` trong payload WS đặt bằng 0 và giữ để tương thích định dạng.
- **Lý do**: FR-018 có thể ẩn subagent, và subagent không có trong danh sách "Existing conversation", nên đây là cách duy nhất để mở chat của chúng. Conversation không phải thành viên không được liệt kê, vì chúng được đưa vào qua "Existing conversation".
- **Phương án khác**: xoá hẳn `OverflowList` (subagent bị ẩn không mở được nữa — loại); cho subagent vào danh sách Existing (subagent không được tuyển trực tiếp — loại).

## R8. Nhường chỗ khi văn phòng đầy

- **Quyết định**: khi tuyển một conversation mới hoặc chưa là thành viên mà đã có 20 thành viên, `admit` chọn **người rời đi** bằng một hàm thuần dùng chung `pickLeaver(members)` trong `src/shared/office.ts`: trong các thành viên **không bận** (trạng thái hiển thị không thuộc `working`, `thinking`, `waiting_for_boss`), lấy người có `lastActivityAt` cũ nhất; hoà thì lấy `memberSince` cũ hơn. Người đó rời văn phòng y như "Remove from office" (`setMember(id, false)`: nhả bàn và ghế họp; subagent rời theo nhờ quy tắc visible). Không ai rời được (cả 20 đều bận) → `OfficeFullError` → `409 OFFICE_FULL`, không tạo gì trong App.
- **Báo trước trong hộp thoại**: client gọi cùng `pickLeaver` trên kho nhân viên của nó (thành viên = nhân viên `visible`, không phải subagent; có sẵn `visualState` và `lastActivityAt`) để hiện tên người sẽ rời đi. Server vẫn là bên quyết định; response của tuyển trả `evicted` để biết chắc ai đã rời.
- **Lý do**: một hàm thuần dùng chung giữ một quy tắc duy nhất cho cả xem trước và quyết định, dễ unit test. Trạng thái bận lấy từ chính trạng thái hiển thị mà văn phòng đang tính (`computeVisualState`), nên khớp với những gì sếp thấy. Không cho người đang bận rời đi để không làm mất dấu một agent đang chạy hoặc đang chờ sếp.
- **Phương án khác**: chọn theo `memberSince` (người vào sớm nhất) — không đúng yêu cầu "lâu không hoạt động"; cho cả người bận rời đi — agent đang chờ sếp trả lời sẽ biến khỏi văn phòng, dễ bị bỏ quên (loại); chặn như trước — người dùng đã đổi yêu cầu (loại).
