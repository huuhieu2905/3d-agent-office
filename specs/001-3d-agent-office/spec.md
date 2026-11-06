# Feature Specification: Văn phòng 3D cho agent trên Antigravity App

**Feature Branch**: `001-3d-agent-office`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Bàn giao từ `.specify/assessments/3d-agent-office/decision.md` (kết luận: go, Phương án B bản điều chỉnh): ứng dụng chạy trên trình duyệt, chạy local, kết nối với Antigravity App trên cùng máy. Mỗi conversation là một nhân viên trong văn phòng 3D do người dùng tự xây, đặt trong một công viên giữa 1 trong 5 thành phố, có thời tiết thật. Nhân viên chuyển động theo trạng thái thật. Chat tương đương Antigravity App 2.24.0 (gồm `@` và `/`). Có bảng quota nhỏ, góc nhìn thứ nhất và toàn cảnh, chế độ sáng/tối. Chạy trên macOS và Linux, kèm hướng dẫn cài đặt."

## User Scenarios & Testing *(mandatory)*

Các câu chuyện người dùng được sắp theo thứ tự ưu tiên, cũng là thứ tự các đợt giao hàng
(Constitution, Nguyên tắc IV). Mỗi câu chuyện khi hoàn thành phải dùng được độc lập.

### User Story 1 - Nhìn thấy đội nhân viên làm việc theo trạng thái thật (Priority: P1)

Người dùng ("sếp") mở hệ thống trên trình duyệt và thấy văn phòng 3D của mình. Mỗi
conversation trong Antigravity App là một nhân viên có tên (theo tiêu đề conversation) và ngồi
ở một bàn. Nhìn vào là biết ngay ai đang làm, ai rảnh, ai cần mình:
- nhân viên đang chạy thì ngồi gõ phím
- nhân viên chờ sếp duyệt thì giơ tay hoặc có biểu tượng chờ
- nhân viên gặp lỗi thì có dấu hiệu lỗi rõ ràng
- nhân viên rảnh thì thỉnh thoảng đứng dậy vươn vai, đi uống nước rồi quay về chỗ

Nhân viên mới (conversation mới tạo trong App) tự xuất hiện ở một bàn trống.

**Why this priority**: Đây là trái tim của phép ẩn dụ "đội nhân viên" và là nguồn cảm hứng
chính (Mục tiêu G1–G3). Không có phần này thì mọi phần khác không có ý nghĩa.

**Independent Test**: Mở Antigravity App với vài conversation, mở hệ thống, rồi cho một agent
chạy việc trong App. Kiểm tra nhân viên tương ứng chuyển sang trạng thái "đang làm" trong vòng
2 giây, và về "rảnh" khi agent xong.

**Acceptance Scenarios**:

1. **Given** Antigravity App đang mở và có 5 conversation, **When** người dùng mở hệ thống,
   **Then** văn phòng hiển thị đúng 5 nhân viên, mỗi người mang tên conversation tương ứng.
2. **Given** một nhân viên đang rảnh, **When** agent tương ứng bắt đầu chạy trong App, **Then**
   nhân viên đó chuyển sang hoạt ảnh "đang làm" trong vòng 2 giây.
3. **Given** một agent đang chờ người dùng duyệt quyền, **When** người dùng nhìn văn phòng,
   **Then** nhân viên tương ứng hiển thị trạng thái "chờ sếp", phân biệt rõ với "đang làm" và
   "rảnh".
4. **Given** một nhân viên rảnh trong vài phút, **When** người dùng quan sát, **Then** nhân viên
   thỉnh thoảng thực hiện một hành động ngẫu nhiên (vươn vai, đi uống nước) rồi quay về bàn.
5. **Given** người dùng tạo một conversation mới ngay trong App, **When** vài giây trôi qua,
   **Then** một nhân viên mới xuất hiện ở một bàn trống.
6. **Given** Antigravity App đang đóng, **When** người dùng mở hệ thống, **Then** hệ thống báo
   rõ "chưa kết nối được Antigravity App", và tự kết nối khi App được mở.

---

### User Story 2 - Trò chuyện với nhân viên bằng 1 lần bấm (Priority: P1)

Người dùng bấm một lần vào một nhân viên và khung trò chuyện mở ra, hiển thị toàn bộ cuộc trò
chuyện như trong Antigravity App: tin nhắn của sếp, câu trả lời, phần suy nghĩ của agent, các
công cụ agent đã dùng, các lệnh đã chạy và kết quả, các thay đổi file. Người dùng gõ và gửi
tin nhắn mới với tư cách chính mình, chọn model cho lượt tiếp theo, và có thể dừng agent đang
chạy. Người dùng cũng "tuyển nhân viên mới" (tạo conversation mới) với yêu cầu ban đầu, model
và project được chọn.

**Why this priority**: Thiếu phần này thì người dùng phải quay về App để làm việc, nên mục tiêu
G4 không đạt được và tiêu chí M1 (> 70% số lần dùng) thất bại. Phần này cùng User Story 1 tạo
thành đợt đầu tiên.

**Independent Test**: Bấm vào một nhân viên, gửi một tin nhắn, kiểm tra tin nhắn xuất hiện
trong App như tin của người dùng và agent trả lời. Bấm "dừng" khi agent đang chạy và kiểm tra
agent dừng lại.

**Acceptance Scenarios**:

1. **Given** văn phòng đang hiển thị, **When** người dùng bấm 1 lần vào một nhân viên, **Then**
   khung trò chuyện của conversation đó mở ra với toàn bộ lịch sử.
2. **Given** khung trò chuyện đang mở, **When** người dùng gửi một tin nhắn, **Then** tin nhắn
   xuất hiện trong cả hệ thống lẫn App như tin nhắn của người dùng, và câu trả lời của agent
   hiện ra dần khi agent làm việc.
3. **Given** một agent đang chạy, **When** người dùng bấm "dừng", **Then** agent dừng, nhân
   viên trở về trạng thái rảnh và App cũng hiển thị đã dừng.
4. **Given** người dùng chọn "tuyển nhân viên mới", **When** người dùng nhập yêu cầu ban đầu,
   chọn model và project rồi xác nhận, **Then** một conversation mới được tạo trong App và một
   nhân viên mới xuất hiện ở bàn do người dùng chọn hoặc ở bàn trống.
5. **Given** khung trò chuyện đang mở, **When** người dùng chọn một model khác, **Then** lượt
   tiếp theo được chạy bằng model đó.
6. **Given** cuộc trò chuyện có kết quả là code, lệnh hoặc thay đổi file, **When** người dùng
   xem, **Then** nội dung được trình bày dễ đọc (định dạng văn bản, khối code, kết quả lệnh).

---

### User Story 3 - Ra lệnh bằng `/` và `@`, duyệt quyền (Priority: P2)

Trong khung trò chuyện, người dùng gõ `/` để thấy danh sách lệnh và skill giống như trong App
(ví dụ `/plan`, `/goal`, `/compact` và các skill đã cài), chọn một lệnh để gửi. Người dùng gõ
`@` để nhắc tới một file (và các loại ngữ cảnh mà App hỗ trợ), chọn từ danh sách gợi ý. Khi
agent xin quyền (chạy lệnh, truy cập file), người dùng duyệt hoặc từ chối ngay trong khung trò
chuyện.

**Why this priority**: Người dùng yêu cầu rõ ràng chat "giống App", có `@` và `/`. Tuy vậy,
chat cơ bản (User Story 2) đã đủ để làm việc hằng ngày, nên phần này đi ở đợt thứ hai.

**Independent Test**: Gõ `/` và kiểm tra danh sách lệnh trùng với danh sách trong App. Gửi một
lệnh skill và kiểm tra agent dùng đúng skill. Nhắc một file bằng `@` và kiểm tra agent nhận
được file đó. Cho agent làm một việc cần xin quyền, rồi duyệt hoặc từ chối từ hệ thống.

**Acceptance Scenarios**:

1. **Given** khung trò chuyện đang mở, **When** người dùng gõ `/`, **Then** danh sách lệnh hệ
   thống và skill hiện ra, giống danh sách trong App, có thể lọc khi gõ tiếp.
2. **Given** người dùng chọn một lệnh `/` và gửi, **When** agent xử lý, **Then** agent thực thi
   đúng lệnh hoặc skill đó như khi gửi từ App.
3. **Given** khung trò chuyện đang mở, **When** người dùng gõ `@` và vài ký tự, **Then** danh
   sách file phù hợp trong workspace của conversation hiện ra, và mục được chọn được gửi kèm
   tin nhắn như một mục nhắc tới.
4. **Given** agent đang chờ duyệt quyền, **When** người dùng bấm "cho phép" hoặc "từ chối" trong
   hệ thống, **Then** agent tiếp tục hoặc dừng thao tác đó tương ứng, và nhân viên rời trạng
   thái "chờ sếp".

---

### User Story 4 - Theo dõi quota tài khoản (Priority: P2)

Người dùng luôn nhìn thấy một chỉ báo quota nhỏ trong văn phòng, ví dụ một màn hình treo
tường. Bấm vào thì mở bảng chi tiết: gói tài khoản đang dùng, phần quota còn lại của từng
model hoặc nhóm model, thời điểm quota được làm mới, và số credits còn lại.

**Why this priority**: Đây là yêu cầu bổ sung rõ ràng của người dùng (Mục tiêu G6), giúp người
dùng không phải mở App để xem quota. Phần này nhỏ và độc lập.

**Independent Test**: Mở bảng quota và đối chiếu từng con số với thông tin quota mà Antigravity
App hiển thị.

**Acceptance Scenarios**:

1. **Given** hệ thống đã kết nối App, **When** người dùng nhìn văn phòng, **Then** có một chỉ báo
   quota tổng quát, và nó cảnh báo rõ khi một nhóm model sắp hết (dưới 10%).
2. **Given** người dùng bấm vào chỉ báo quota, **When** bảng chi tiết mở ra, **Then** bảng hiển
   thị gói tài khoản, phần còn lại (dạng phần trăm) và thời điểm làm mới của từng model hoặc
   nhóm model, cùng số credits.
3. **Given** quota thay đổi sau khi agent chạy, **When** vài phút trôi qua, **Then** số liệu
   trong bảng được cập nhật mà không cần tải lại trang.

---

### User Story 5 - Tự xây và sắp xếp văn phòng (Priority: P3)

Người dùng vào chế độ "xây dựng" để thiết kế văn phòng trên mặt bằng tầng của toà nhà: đặt,
xoay, di chuyển và xoá bàn ghế, tường, vách kính, cây cảnh, máy nước. Người dùng gán từng
nhân viên vào một bàn bằng cách kéo thả. Bố cục được lưu lại và giữ nguyên cho lần mở sau.

**Why this priority**: Đây là yếu tố "văn phòng của riêng mình" tạo cảm giác sở hữu, nhưng một
bố cục mặc định đã đủ cho hai đợt đầu.

**Independent Test**: Vào chế độ xây dựng, thêm một vách kính và hai bàn, gán một nhân viên vào
bàn mới, đóng rồi mở lại hệ thống, và kiểm tra mọi thứ còn nguyên.

**Acceptance Scenarios**:

1. **Given** chế độ xây dựng đang bật, **When** người dùng đặt một món đồ, **Then** món đồ khớp
   vào mặt bằng, không chồng lên món khác và không ra ngoài tường toà nhà.
2. **Given** có một bàn trống, **When** người dùng kéo một nhân viên vào bàn đó, **Then** nhân
   viên chuyển sang bàn mới và luôn quay về đúng bàn đó sau các chuyển động ngẫu nhiên.
3. **Given** người dùng đã thay đổi bố cục, **When** người dùng đóng rồi mở lại hệ thống,
   **Then** bố cục và chỗ ngồi được giữ nguyên.
4. **Given** số nhân viên nhiều hơn số bàn, **When** văn phòng hiển thị, **Then** nhân viên chưa
   có bàn được xếp vào một khu chờ dễ thấy, và người dùng được gợi ý thêm bàn.

---

### User Story 6 - Văn phòng trong công viên giữa thành phố, có thời tiết thật (Priority: P3)

Người dùng chọn 1 trong 5 thành phố: Hà Nội, TP. Hồ Chí Minh, Singapore, Tokyo, New York. Văn
phòng nằm giữa một công viên có nhiều loại cây và hoa, có người đi dạo, tập thể dục và xe cộ
di chuyển quanh khuôn viên. Phía xa là cảnh đặc trưng nhận ra được của thành phố đã chọn. Bầu
trời và hiệu ứng ngoài trời (nắng, mây, mưa…) theo thời tiết thật hiện tại của thành phố đó.
Người dùng tự chọn chế độ sáng hoặc tối.

**Why this priority**: Đây là phần tạo ấn tượng và khác biệt nhưng tốn công nhất. Constitution
(Nguyên tắc IV) yêu cầu làm sau khi phần trung tâm đã dùng được.

**Independent Test**: Đổi thành phố và kiểm tra cảnh phía xa thay đổi. Đối chiếu hiệu ứng thời
tiết với thời tiết thật của thành phố. Bật và tắt chế độ tối.

**Acceptance Scenarios**:

1. **Given** người dùng đang ở Hà Nội, **When** người dùng chọn Tokyo, **Then** cảnh phía xa đổi
   sang cảnh đặc trưng của Tokyo và thời tiết đổi theo thời tiết thật của Tokyo.
2. **Given** thành phố đang mưa thật, **When** người dùng nhìn ra ngoài, **Then** cảnh ngoài trời
   có hiệu ứng mưa, và người trong công viên thưa hơn hoặc che ô.
3. **Given** không lấy được dữ liệu thời tiết, **When** cảnh hiển thị, **Then** cảnh dùng thời
   tiết mặc định (trời quang) và không báo lỗi gây phiền.
4. **Given** người dùng bật chế độ tối, **When** cảnh hiển thị, **Then** cả cảnh 3D và giao diện
   chuyển sang tông tối, và lựa chọn được ghi nhớ.
5. **Given** cảnh công viên có nhiều chi tiết, **When** máy không giữ được độ mượt yêu cầu,
   **Then** người dùng có thể giảm mức chi tiết của bối cảnh mà văn phòng không bị ảnh hưởng.

---

### User Story 7 - Đi lại trong văn phòng bằng góc nhìn thứ nhất (Priority: P4)

Ngoài góc nhìn toàn cảnh (xoay, phóng to, kéo), người dùng chuyển sang góc nhìn thứ nhất để đi
lại trong văn phòng như sếp đi kiểm tra. Ở góc nhìn này, người dùng nhìn vào một nhân viên và
bấm để mở trò chuyện.

**Why this priority**: Góc nhìn này tăng cảm giác "người thật" nhưng không cần cho việc làm
việc hằng ngày. Đây là phần cuối của tầm nhìn.

**Independent Test**: Chuyển sang góc nhìn thứ nhất, đi tới một bàn, bấm vào nhân viên và kiểm
tra khung trò chuyện mở ra. Chuyển lại góc nhìn toàn cảnh.

**Acceptance Scenarios**:

1. **Given** đang ở góc nhìn toàn cảnh, **When** người dùng chuyển sang góc nhìn thứ nhất,
   **Then** camera đặt ở tầm mắt người trong văn phòng, và người dùng đi lại được bằng bàn phím
   và chuột mà không xuyên qua tường hay bàn ghế.
2. **Given** đang ở góc nhìn thứ nhất, **When** người dùng bấm vào một nhân viên, **Then** khung
   trò chuyện mở ra như ở góc nhìn toàn cảnh.
3. **Given** đang ở góc nhìn thứ nhất, **When** người dùng chuyển lại góc nhìn toàn cảnh,
   **Then** camera trở về góc nhìn toàn cảnh trước đó.

---

### User Story 8 - Cài đặt lên một máy khác (Priority: P1)

Người dùng làm theo hướng dẫn cài đặt để chạy hệ thống trên một máy macOS khác đã có
Antigravity App. Hướng dẫn nói rõ yêu cầu, các bước cài, cách mở hệ thống, và cách xử lý các
lỗi thường gặp (App chưa mở, sai phiên bản App).

**Why this priority**: Người dùng yêu cầu rõ ràng, và Constitution (Nguyên tắc VI) coi đây là
cổng chất lượng của mọi đợt. Hướng dẫn phải đi cùng ngay từ đợt đầu.

**Independent Test**: Một người chưa từng cài hệ thống làm theo hướng dẫn trên một máy macOS,
có bấm giờ.

**Acceptance Scenarios**:

1. **Given** một máy macOS có Antigravity App, **When** người dùng làm theo hướng dẫn,
   **Then** hệ thống chạy được và hiển thị đúng nhân viên trong vòng 15 phút.
2. **Given** phiên bản Antigravity App khác 2.24.0, **When** hệ thống khởi động, **Then** hệ
   thống hiển thị cảnh báo rõ ràng về phiên bản nhưng vẫn cố gắng hoạt động.

---

### Edge Cases

- **App đóng giữa chừng**: hệ thống chuyển cả văn phòng sang trạng thái "mất kết nối" (ví dụ
  đèn văn phòng mờ, nhân viên đứng yên), không mất bố cục, và tự kết nối lại khi App mở lại.
- **App khởi động lại (đổi cổng hay mã xác thực)**: hệ thống tự phát hiện và kết nối lại mà
  người dùng không phải làm gì.
- **Conversation bị xoá trong App**: nhân viên tương ứng rời văn phòng (ví dụ đi ra cửa), và bàn
  trở thành bàn trống.
- **Rất nhiều conversation**: khi số conversation vượt quá số nhân viên tối đa hiển thị cùng lúc
  (FR-004), hệ thống ưu tiên hiển thị conversation hoạt động gần đây nhất, và cho phép xem
  những conversation còn lại qua một danh sách.
- **Subagent** (conversation con do agent khác tạo): hiển thị như "nhân viên cấp dưới" ngồi gần
  nhân viên cha, hoặc gom vào nhân viên cha, không làm rối văn phòng.
- **Trạng thái không xác định**: nếu hệ thống không xác định được trạng thái, nhân viên hiển thị
  "không rõ" thay vì đoán (Constitution, Nguyên tắc I).
- **Gửi tin nhắn thất bại** (App đóng, lỗi mạng của App, hết quota): tin nhắn không bị mất, người
  dùng thấy lý do và có thể gửi lại.
- **Hết quota**: chỉ báo quota chuyển sang cảnh báo, và khi gửi tin nhắn bằng model đã hết quota
  thì người dùng được báo trước.
- **Cùng lúc thao tác ở App và ở hệ thống**: thay đổi ở bên nào cũng được phản ánh ở bên kia,
  không tạo tin nhắn trùng.
- **Mất Internet**: chat và trạng thái vẫn hoạt động nếu App còn hoạt động. Chỉ thời tiết rơi
  về mặc định.
- **Máy cấu hình yếu**: hệ thống tự gợi ý giảm mức chi tiết bối cảnh khi độ mượt tụt dưới
  ngưỡng.

## Requirements *(mandatory)*

### Functional Requirements

**Kết nối & dữ liệu (nền tảng)**

- **FR-001**: Hệ thống PHẢI tự phát hiện Antigravity App đang chạy trên cùng máy và kết nối mà
  người dùng không phải nhập cổng hay mã xác thực.
- **FR-002**: Hệ thống PHẢI lấy danh sách conversation, tiêu đề, project, trạng thái và lịch sử
  từ Antigravity App, và KHÔNG ĐƯỢC tự chạy agent hay gọi model.
- **FR-003**: Hệ thống PHẢI phản ánh thay đổi trạng thái của conversation chậm không quá 2 giây.
- **FR-004**: Hệ thống PHẢI hiển thị cùng lúc tối đa 20 nhân viên, bao gồm cả các thể hiện cho
  subagent. Conversation vượt quá số này được truy cập qua danh sách.
- **FR-005**: Hệ thống PHẢI kiểm tra phiên bản Antigravity App khi khởi động và cảnh báo nếu khác
  2.24.0.
- **FR-006**: Hệ thống PHẢI báo rõ khi mất kết nối với App, và tự kết nối lại khi App sẵn sàng.

**Văn phòng & nhân viên**

- **FR-010**: Mỗi conversation PHẢI được thể hiện bằng đúng một nhân viên, mang tên conversation
  và có ngoại hình ổn định giữa các lần mở.
- **FR-011**: Nhân viên PHẢI thể hiện các trạng thái phân biệt được bằng mắt: rảnh, đang làm,
  chờ sếp (chờ duyệt quyền), gặp lỗi, bị dừng, không rõ.
- **FR-012**: Khi rảnh, nhân viên PHẢI thỉnh thoảng thực hiện hành động ngẫu nhiên (khoảng 5
  phút một lần, có dao động) như vươn vai, đi uống nước, rồi quay về đúng bàn.
- **FR-013**: Văn phòng KHÔNG chia khu theo project: mọi nhân viên ngồi chung một không gian, ở
  vị trí do người dùng tự sắp xếp. Project trong App PHẢI được thể hiện bằng một **nhãn màu**
  trên nhân viên (mỗi project một màu ổn định, có chú giải). Người dùng PHẢI lọc hoặc làm nổi bật
  được nhân viên theo project.
- **FR-014**: Hệ thống PHẢI có góc nhìn toàn cảnh cho phép xoay, phóng to và kéo.

**Trò chuyện (tương đương Antigravity App 2.24.0)**

- **FR-020**: Người dùng PHẢI mở được khung trò chuyện của một nhân viên bằng đúng 1 lần bấm vào
  nhân viên đó.
- **FR-021**: Khung trò chuyện PHẢI hiển thị đầy đủ lịch sử: tin nhắn người dùng, câu trả lời,
  phần suy nghĩ (thu gọn được), công cụ đã dùng, lệnh đã chạy và kết quả, thay đổi file.
- **FR-022**: Người dùng PHẢI gửi được tin nhắn với tư cách người dùng, và tin nhắn PHẢI xuất
  hiện trong App như tin nhắn người dùng gửi từ chính App.
- **FR-023**: Câu trả lời của agent PHẢI hiện dần trong khi agent làm việc, không đợi xong mới
  hiện.
- **FR-024**: Người dùng PHẢI chọn được model cho lượt tiếp theo, trong danh sách model mà tài
  khoản được dùng.
- **FR-025**: Người dùng PHẢI dừng được agent đang chạy.
- **FR-026**: Người dùng PHẢI tạo được conversation mới ("tuyển nhân viên") với yêu cầu ban đầu,
  model và project.
- **FR-027**: Gõ `/` PHẢI hiển thị danh sách lệnh hệ thống và skill giống App, lọc được, và gửi
  được.
- **FR-028**: Gõ `@` PHẢI gợi ý file trong workspace của conversation, và mục được chọn PHẢI được
  gửi như một mục nhắc tới (giống App), không phải văn bản thường.
- **FR-029**: Người dùng PHẢI duyệt hoặc từ chối được các yêu cầu xin quyền của agent ngay trong
  khung trò chuyện.
- **FR-030**: Mọi thao tác thay đổi trạng thái agent (gửi, tạo, dừng, duyệt) PHẢI do người dùng
  chủ động thực hiện. Hệ thống KHÔNG ĐƯỢC tự gửi lệnh tới agent.

**Quota**

- **FR-040**: Hệ thống PHẢI hiển thị một chỉ báo quota luôn thấy được trong văn phòng.
- **FR-041**: Bảng quota chi tiết PHẢI hiển thị gói tài khoản, phần còn lại (%) và thời điểm làm
  mới của từng model hoặc nhóm model, cùng số credits còn lại.
- **FR-042**: Số liệu quota PHẢI tự cập nhật ít nhất mỗi 5 phút và ngay sau mỗi lượt agent chạy
  xong.
- **FR-043**: Chỉ báo quota PHẢI cảnh báo khi một nhóm model còn dưới 10%.

**Xây dựng văn phòng**

- **FR-050**: Người dùng PHẢI đặt, xoay, di chuyển và xoá được đồ vật trong văn phòng từ một bộ
  sưu tập có sẵn, tối thiểu gồm: bàn, ghế, tường, vách kính, cửa, cây cảnh, máy nước, ghế sofa,
  bảng/màn hình treo tường.
- **FR-051**: Đồ vật PHẢI khớp theo mặt bằng tầng, không chồng lên nhau và không vượt ra ngoài
  tường toà nhà.
- **FR-052**: Người dùng PHẢI gán được nhân viên vào bàn bằng kéo thả.
- **FR-053**: Bố cục văn phòng, chỗ ngồi, thành phố, chế độ sáng/tối và mức chi tiết PHẢI được
  lưu trên máy và giữ nguyên giữa các lần mở.
- **FR-054**: Lần đầu sử dụng, hệ thống PHẢI cung cấp một bố cục văn phòng mặc định dùng được
  ngay.

**Bối cảnh, thành phố & thời tiết**

- **FR-060**: Người dùng PHẢI chọn được 1 trong 5 thành phố: Hà Nội, TP. Hồ Chí Minh, Singapore,
  Tokyo, New York.
- **FR-061**: Văn phòng PHẢI nằm trong một công viên có nhiều loại cây và hoa khác nhau, có người
  đi dạo, tập thể dục và xe cộ di chuyển theo các lối định sẵn.
- **FR-062**: Cảnh phía xa PHẢI có đặc trưng nhận ra được của thành phố đã chọn.
- **FR-063**: Thời tiết ngoài trời PHẢI theo dữ liệu thời tiết thật hiện tại của thành phố đã
  chọn, cập nhật ít nhất mỗi 30 phút, và PHẢI hiển thị ghi nguồn dữ liệu thời tiết.
- **FR-064**: Người dùng PHẢI chọn được chế độ sáng hoặc tối, áp dụng cho cả cảnh 3D và giao diện.
- **FR-065**: Người dùng PHẢI điều chỉnh được mức chi tiết của bối cảnh (ít nhất 3 mức) mà không
  ảnh hưởng đến văn phòng và nhân viên.

**Góc nhìn thứ nhất**

- **FR-070**: Người dùng PHẢI chuyển qua lại được giữa góc nhìn toàn cảnh và góc nhìn thứ nhất.
- **FR-071**: Ở góc nhìn thứ nhất, người dùng PHẢI đi lại được bằng bàn phím và chuột, không
  xuyên qua tường hay đồ vật, và mở được trò chuyện bằng cách bấm vào nhân viên.

**Bảo mật, riêng tư & cài đặt**

- **FR-080**: Hệ thống PHẢI chỉ truy cập được từ chính máy đang chạy, không mở ra mạng ngoài.
- **FR-081**: Mã xác thực của App, tên, email tài khoản và nội dung conversation KHÔNG ĐƯỢC ghi
  vào log, lưu ra file hay gửi ra khỏi máy.
- **FR-082**: Kết nối ra Internet duy nhất được phép là lấy dữ liệu thời tiết công khai.
- **FR-083**: Hệ thống PHẢI chạy được trên macOS, kèm hướng dẫn cài đặt. Linux được hoãn (xem
  Assumptions).

### Key Entities *(include if feature involves data)*

- **Nhân viên (Employee)**: thể hiện của một conversation trong App. Thuộc tính: tên (tiêu đề
  conversation), ngoại hình, trạng thái hiện tại, bàn được gán, project, quan hệ cha–con (với
  subagent), thời điểm hoạt động gần nhất. Dữ liệu gốc thuộc về App; chỉ ngoại hình và bàn được
  gán là dữ liệu riêng của hệ thống.
- **Cuộc trò chuyện (Conversation)**: dữ liệu của App. Gồm chuỗi các bước: tin nhắn người dùng,
  câu trả lời, suy nghĩ, công cụ, lệnh, thay đổi file, yêu cầu xin quyền. Có trạng thái chạy và
  model đang dùng.
- **Project**: nhóm conversation trong App. Trong văn phòng, project chỉ được thể hiện bằng
  nhãn màu trên nhân viên và bộ lọc, không phải một khu vực riêng (FR-013).
- **Văn phòng (Office Layout)**: dữ liệu riêng của hệ thống. Gồm mặt bằng tầng, danh sách đồ vật
  (loại, vị trí, hướng) và danh sách bàn với nhân viên được gán.
- **Bối cảnh (Scene Settings)**: dữ liệu riêng của hệ thống. Gồm thành phố đã chọn, chế độ
  sáng/tối, mức chi tiết, góc nhìn.
- **Thời tiết (Weather Snapshot)**: tình trạng thời tiết hiện tại của thành phố đã chọn, kèm thời
  điểm lấy dữ liệu và nguồn.
- **Quota**: dữ liệu của App. Gồm gói tài khoản, danh sách model hoặc nhóm model với phần còn lại
  và thời điểm làm mới, cùng số credits.
- **Lệnh (Command) và Mục nhắc tới (Mention)**: danh sách lệnh `/` và skill lấy từ App; mục `@`
  là tham chiếu tới file hoặc ngữ cảnh gửi kèm tin nhắn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau 2–4 tuần sử dụng, hơn 70% số lần người dùng làm việc với agent là qua hệ thống
  này thay vì mở Antigravity App.
- **SC-002**: Trạng thái nhân viên khớp với trạng thái thật trong App trong ít nhất 99% thời gian
  quan sát, và mọi thay đổi trạng thái được thể hiện trong vòng 2 giây.
- **SC-003**: Người dùng mở được cuộc trò chuyện với bất kỳ nhân viên nào bằng đúng 1 lần bấm.
- **SC-004**: Văn phòng với 20 nhân viên, ở mức chi tiết bối cảnh mặc định, chuyển động mượt ở
  ít nhất 60 khung hình/giây trên máy tham chiếu.
- **SC-005**: Một người mới cài và chạy được hệ thống trong vòng 15 phút trên macOS, chỉ dựa vào
  hướng dẫn.
- **SC-006**: Số lần người dùng phải quay về App để làm một việc thường ngày (chat, `/`, `@`, chọn
  model, dừng, tạo mới, duyệt quyền, xem quota) giảm xuống dưới 2 lần mỗi tuần sau khi hoàn thành
  User Story 1–4.
- **SC-007**: Người dùng tự chấm mức hứng thú khi làm việc với agent (thang 1–5) cao hơn ít nhất
  1 điểm so với khi dùng App gốc, đo sau 2 tuần sử dụng.
- **SC-008**: Số liệu quota hiển thị khớp với số liệu Antigravity App hiển thị trong 100% lần đối
  chiếu.
- **SC-009**: Không có mã xác thực, email hay nội dung conversation trong bất kỳ log hoặc file nào
  hệ thống tạo ra (kiểm tra bằng rà soát sau mỗi đợt).
- **SC-010**: Khi App đóng rồi mở lại, hệ thống tự kết nối lại trong vòng 10 giây kể từ khi App
  sẵn sàng, không cần tải lại trang.

## Assumptions

- Không gom nhân viên theo project vào phòng ban hay tầng riêng, vì người dùng tự sắp xếp chỗ
  ngồi và bàn ghế (quyết định của người dùng ngày 2026-11-06).
- Chỉ chủ dự án sử dụng, trên một máy mỗi lần. Không có tài khoản, đăng nhập hay phân quyền
  trong hệ thống. Danh tính người dùng là tài khoản đang đăng nhập trong Antigravity App.
- Antigravity App 2.24.0 đang mở trên cùng máy. Khi App đóng, hệ thống chỉ hiển thị trạng thái
  mất kết nối và bố cục văn phòng (đã được người dùng chấp nhận).
- Các khả năng của App đã được kiểm chứng trên macOS ngày 2026-11-06 (research.md): đọc trạng
  thái và lịch sử, gửi tin nhắn với tư cách người dùng, `/`, `@` (gửi mục nhắc), dừng agent, chọn
  model, quota. Hai khả năng **chưa kiểm chứng hoàn toàn**: gợi ý file khi gõ `@` và duyệt hoặc
  từ chối quyền. Nếu khả năng nào không làm được, yêu cầu tương ứng (FR-028, FR-029) sẽ được điều
  chỉnh qua `/speckit-clarify` hoặc plan, và người dùng được dẫn về App cho thao tác đó.
- **Linux được hoãn** (quyết định của người dùng ngày 2026-11-06): hiện chưa có máy Linux để kiểm
  chứng. Phạm vi của tính năng này chỉ gồm macOS. Sau khi hệ thống chạy ổn định trên máy macOS của
  người dùng, việc triển khai lên Linux sẽ được bàn và lên kế hoạch riêng.
- Số nhân viên tối đa hiển thị cùng lúc là 20 (FR-004). Đây là mặc định hợp lý cho một người làm
  việc với agent và giúp đạt 60 FPS.
- Phong cách hình ảnh mặc định là low-poly cách điệu, thống nhất (Constitution, Nguyên tắc V).
  Tài nguyên 3D dùng bộ có sẵn với giấy phép cho phép dùng phi thương mại.
- Ánh sáng ban ngày/ban đêm của cảnh theo lựa chọn sáng/tối của người dùng, không theo giờ thật
  của thành phố. Chỉ thời tiết theo dữ liệu thật.
- Hành động ngẫu nhiên khi rảnh diễn ra khoảng 5 phút một lần mỗi nhân viên, có dao động để
  nhiều nhân viên không đứng dậy cùng lúc.
- Người, xe trong công viên chỉ để trang trí, đi theo lối định sẵn, không tương tác với người
  dùng. Cảnh thành phố là phong cảnh đặc trưng, không phải bản đồ thật.
- "Máy tham chiếu" cho tiêu chí 60 FPS sẽ được chọn và ghi rõ ở bước plan.
- Dữ liệu riêng của hệ thống (bố cục, cài đặt) chỉ lưu trên máy, không đồng bộ giữa các máy.
- Ngoài phạm vi: Linux (hoãn); Windows; Docker hoặc đám mây; CLI `agy` hay Antigravity IDE làm nguồn dữ liệu;
  tính năng của các phiên bản App sau 2.24.0; gom conversation từ nhiều máy; mục đích thương mại;
  chạy khi App đóng.
