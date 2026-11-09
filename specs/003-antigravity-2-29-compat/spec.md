# Feature Specification: Tương thích Antigravity App 2.29.0

**Feature Branch**: `003-antigravity-2-29-compat`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Hiện tại app Antigravity đã tự update lên phiên bản mới, bạn hãy điều tra xem hệ thống hiện tại có cần thay đổi gì để phù hợp với phiên bản mới này hay không?"

## Kết quả điều tra (2026-11-08)

Phần này ghi lại những gì đã kiểm tra trên máy thật trước khi viết yêu cầu. Toàn bộ chỉ dùng thao
tác **đọc**, không tạo, gửi hay xoá gì trong App.

| # | Hạng mục | Kết quả trên 2.29.0 | Cần thay đổi? |
|---|---|---|---|
| F1 | Phiên bản App | App đã tự cập nhật **2.24.0 → 2.29.0**. Hệ thống nhận ra bản 2.29.0, đánh dấu "chưa được kiểm chứng" và cảnh báo mỗi lần kết nối | **Có**: xác nhận và công nhận 2.29.0 |
| F2 | Tìm App, lấy khoá kết nối, dò cổng | Dòng lệnh khởi động của App vẫn như cũ; kết nối thành công | Không |
| F3 | 18 lệnh nội bộ hệ thống đang dùng | Tất cả vẫn có trong bản 2.29.0 | Không |
| F4 | Đọc danh sách conversation, các bước, model, quota, project, lệnh `/` | Đều chạy: 46 conversation, 13 model, 7 project, 16 lệnh `/`; các bước được đọc đủ | Không |
| F5 | Luồng cập nhật trực tiếp | Vẫn chạy. Có thêm thông tin mới: mức dùng cửa sổ ngữ cảnh, cờ "rảnh hẳn", cập nhật theo lượt | Không bắt buộc (có thể tận dụng) |
| F6 | Định dạng dữ liệu | Chỉ **thêm** trường, không mất trường nào hệ thống đang dùng. Thêm: tên nhánh git, tên repo và gốc git của workspace. Mất: cờ "model được đề xuất" (hệ thống không dùng) | Không bắt buộc (có thể tận dụng) |
| F7 | Bộ kiểm thử tự động | 155/155 pass, nhưng vẫn chạy trên dữ liệu mẫu ghi từ 2.24.0, nên chưa chứng minh được gì về 2.29.0 | **Có**: ghi lại dữ liệu mẫu từ 2.29.0 |
| F8 | Thao tác ghi (gửi tin, tuyển nhân viên, dừng agent, duyệt quyền, tạo project) | **Chưa kiểm chứng** trên 2.29.0, vì kiểm chứng cần tạo conversation thật và tốn quota | **Có**: chạy kiểm thử với App thật |
| F9 | Bước "agent hỏi sếp" (câu hỏi trắc nghiệm) | App có loại bước này (thấy 10 lần). Hệ thống không nhận ra; khi bước đang chờ trả lời, nó sẽ bị hiện **sai** thành yêu cầu "cho phép / từ chối" | **Có**: lỗi có sẵn từ trước, nhưng làm sai trạng thái "chờ sếp" |
| F10 | Bước lỗi | Nhận ra là lỗi nhưng **nội dung lỗi trống**, vì App để thông báo ở chỗ hệ thống không đọc | **Có**: lỗi có sẵn từ trước |
| F11 | Bước "tìm kiếm web" | Không nhận ra, hiện là bước chung chung | Nên có |
| F12 | Tài liệu, script cài đặt, nguyên tắc dự án | Đều ghi cứng "2.24.0" (README, hướng dẫn cài đặt, script cài, thông báo cảnh báo, constitution) | **Có** |

**Kết luận**: Không có thay đổi nào làm hỏng hệ thống. Phần đọc và theo dõi trạng thái vẫn chạy
đúng trên 2.29.0. Việc cần làm: (1) kiểm chứng phần ghi rồi chính thức công nhận 2.29.0, (2) cập
nhật dữ liệu mẫu và tài liệu, (3) sửa 3 loại bước chưa được hiểu đúng (F9–F11). F9–F11 có từ
bản 2.24.0, nhưng đợt rà soát này mới phát hiện ra.

## Clarifications

### Session 2026-11-08

- Q: Bạn muốn feature 003 gồm cả việc sửa 3 loại bước hiện sai (câu hỏi trắc nghiệm, nội dung lỗi trống, tìm kiếm web), hay chỉ làm phần tương thích phiên bản 2.29.0? → A: Giữ cả 4 user story trong 003. US1 (tương thích) giao trước; 2.29.0 được công nhận ngay khi US1 xong, không chờ US2–4.
- Q: Khi agent hỏi sếp một câu trắc nghiệm, người dùng được trả lời theo những cách nào? → A: Chọn một hoặc nhiều đáp án, tuỳ theo App cho phép với từng câu, và luôn có thêm ô "Khác" để gõ câu trả lời tự do.
- Q: Khi Agent Office phát hiện App đang chạy một phiên bản chưa kiểm chứng, hệ thống có nên tự chạy kiểm tra tương thích chỉ-đọc và báo kết quả cho người dùng không? → A: Không tự chạy; chỉ có lệnh dành cho người phát triển.

## User Scenarios & Testing *(mandatory)*

Các câu chuyện được sắp theo thứ tự ưu tiên và thứ tự giao hàng (Constitution, Nguyên tắc IV).

### User Story 1 - Dùng bình thường trên App 2.29.0, không còn cảnh báo sai (Priority: P1)

Người dùng mở Agent Office khi App đã lên 2.29.0. Hệ thống kết nối, hiện nhân viên đúng trạng
thái, và cho phép chat, gửi việc, tuyển nhân viên mới, dừng agent, duyệt hoặc từ chối quyền,
tạo project, y như trên 2.24.0. Cảnh báo "phiên bản chưa được kiểm chứng" không còn hiện, vì
2.29.0 đã được kiểm chứng.

**Why this priority**: App tự cập nhật, người dùng không chọn được bản. Nếu chưa chắc chắn các
thao tác ghi còn chạy, người dùng có thể gửi việc mà không biết việc đó có tới App hay không.
Cảnh báo hiện mãi cũng làm người dùng quen bỏ qua cảnh báo.

**Independent Test**: Với App 2.29.0 đang mở, chạy bộ kiểm thử với App thật (chỉ dùng
conversation và project có đánh dấu kiểm thử, tự dọn sau khi xong). Mở Agent Office và kiểm tra
không có cảnh báo phiên bản.

**Acceptance Scenarios**:

1. **Given** App 2.29.0 đang mở, **When** người dùng khởi động Agent Office, **Then** hệ thống
   kết nối trong ≤ 10 giây, báo đang dùng bản 2.29.0 và không hiện cảnh báo "chưa được kiểm chứng".
2. **Given** đã kết nối với 2.29.0, **When** người dùng gửi tin nhắn cho một nhân viên, **Then**
   tin nhắn xuất hiện trong App dưới dạng tin của người dùng và nhân viên chuyển sang trạng thái
   làm việc trong ≤ 2 giây.
3. **Given** đã kết nối với 2.29.0, **When** người dùng tuyển nhân viên mới vào một project,
   **Then** conversation mới được tạo trong đúng project và nhân viên mới xuất hiện trong văn phòng.
4. **Given** một nhân viên đang làm việc, **When** người dùng bấm dừng, **Then** agent dừng hẳn
   trong ≤ 3 giây.
5. **Given** một nhân viên đang chờ duyệt quyền (chạy lệnh, sửa file), **When** người dùng chọn
   cho phép hoặc từ chối, **Then** App nhận đúng lựa chọn đó và nhân viên tiếp tục làm hoặc dừng.
6. **Given** người dùng tạo project mới gắn một thư mục, **When** thao tác hoàn tất, **Then**
   project xuất hiện cả trong App lẫn trong Agent Office.
7. **Given** App vẫn đang chạy bản 2.24.0 (máy khác chưa cập nhật), **When** người dùng khởi động
   Agent Office, **Then** hệ thống vẫn chạy và cũng không cảnh báo, vì 2.24.0 vẫn nằm trong danh sách đã kiểm chứng.

---

### User Story 2 - Nhân viên hỏi sếp thì sếp thấy và trả lời được (Priority: P2)

Trong lúc làm, agent có thể hỏi người dùng một câu trắc nghiệm, ví dụ "Dùng nhãn nào cho bài
test?" kèm 2 đến 4 lựa chọn. Trong văn phòng, nhân viên đó vẫy tay báo "chờ sếp" như khi chờ
duyệt quyền. Mở chat ra, người dùng thấy câu hỏi và các lựa chọn, bấm chọn một đáp án. Agent
nhận đáp án và làm tiếp. Với câu hỏi đã trả lời từ trước, lịch sử chat hiện câu hỏi kèm đáp án
đã chọn.

**Why this priority**: "Ai đang chờ sếp" là một giá trị cốt lõi của sản phẩm. Hiện tại câu hỏi
đang chờ sẽ bị hiện thành nút "cho phép / từ chối". Đó là câu trả lời vô nghĩa với một câu hỏi
trắc nghiệm, và có thể làm agent bị kẹt.

**Independent Test**: Nhờ một nhân viên thử (có đánh dấu kiểm thử) hỏi một câu trắc nghiệm.
Kiểm tra nhân viên hiện trạng thái chờ, chat hiện đúng các lựa chọn, chọn một đáp án và kiểm
tra agent tiếp tục với đúng đáp án đó.

**Acceptance Scenarios**:

1. **Given** agent đang chờ người dùng trả lời một câu hỏi trắc nghiệm, **When** người dùng nhìn
   văn phòng, **Then** nhân viên đó hiện trạng thái "chờ sếp" trong ≤ 2 giây.
2. **Given** câu hỏi đang chờ, **When** người dùng mở chat, **Then** thấy nội dung câu hỏi và
   từng lựa chọn, không thấy nút "cho phép / từ chối".
3. **Given** câu hỏi đang chờ, **When** người dùng chọn một đáp án, **Then** App nhận đúng đáp án
   đó, câu hỏi chuyển sang đã trả lời và nhân viên tiếp tục làm việc.
4. **Given** một câu hỏi đã được trả lời hoặc đã bị huỷ, **When** người dùng xem lịch sử chat,
   **Then** thấy câu hỏi kèm đáp án đã chọn, hoặc ghi chú "đã huỷ".
5. **Given** một câu hỏi có nhiều câu con, **When** người dùng trả lời, **Then** mỗi câu con có
   phần chọn riêng và chỉ gửi được khi đã trả lời hết các câu con.
6. **Given** App cho phép chọn nhiều đáp án ở một câu con, **When** người dùng chọn 2 đáp án và
   gửi, **Then** App nhận đủ cả 2 đáp án. Nếu câu con chỉ cho chọn một, giao diện không cho chọn
   quá một.
7. **Given** không đáp án nào phù hợp, **When** người dùng gõ vào ô "Khác" rồi gửi, **Then** App
   nhận câu trả lời tự do đó cho đúng câu con, và lịch sử chat hiện lại nội dung đã gõ.

---

### User Story 3 - Thấy rõ nhân viên gặp lỗi gì và đã tra cứu gì (Priority: P3)

Khi một nhân viên gặp lỗi (ví dụ mất kết nối tới dịch vụ model), nhân viên lắc đầu như hiện tại,
và chat hiện **thông báo lỗi ngắn gọn** thay vì một khối trống. Khi agent tìm kiếm trên web, chat
hiện một dòng "Đã tìm: <nội dung tìm>" thay vì một bước không rõ nghĩa.

**Why this priority**: Không chặn công việc, nhưng giúp người dùng quyết định nhanh: thử lại,
đổi model, hay bỏ qua.

**Independent Test**: Mở một conversation có sẵn bước lỗi và bước tìm kiếm web (đã có trong dữ
liệu thật của người dùng), kiểm tra cả hai hiện đúng nội dung.

**Acceptance Scenarios**:

1. **Given** một conversation có bước lỗi, **When** người dùng mở chat, **Then** thấy thông báo
   lỗi ngắn gọn (tối đa 300 ký tự, có nút xem thêm nếu dài hơn).
2. **Given** một conversation có bước tìm kiếm web, **When** người dùng mở chat, **Then** thấy
   nội dung đã tìm.
3. **Given** thông báo lỗi có chứa token, email hay khoá bí mật, **When** hiển thị, **Then** các
   phần đó được che như mọi chỗ khác.

---

### User Story 4 - Lần cập nhật sau kiểm tra nhanh và lặp lại được (Priority: P3)

App sẽ còn tự cập nhật. Khi đó, người phát triển chạy một lệnh kiểm tra tương thích. Lệnh này
chỉ dùng thao tác đọc và in ra bảng tóm tắt giống phần "Kết quả điều tra" ở trên: phiên bản App,
các lệnh nội bộ còn hay mất, định dạng dữ liệu thêm hay bớt trường gì so với dữ liệu mẫu, và
loại bước nào chưa được nhận ra. Dựa vào bảng đó có thể kết luận "an toàn" hoặc "cần sửa" trong
vài phút, không phải điều tra tay như lần này.

**Why this priority**: Không ảnh hưởng trực tiếp người dùng cuối, nhưng biến một việc chắc chắn
lặp lại thành một bước có quy trình (Nguyên tắc II: chỉ phải sửa ở một nơi).

**Independent Test**: Chạy lệnh kiểm tra với App 2.29.0. Kết quả phải khớp với bảng điều tra
ở trên, và không có conversation hay project nào bị tạo, sửa hoặc xoá.

**Acceptance Scenarios**:

1. **Given** App đang mở, **When** chạy lệnh kiểm tra tương thích, **Then** trong ≤ 2 phút nhận
   được bảng tóm tắt gồm: phiên bản, lệnh nội bộ còn/mất, trường thêm/bớt, loại bước chưa nhận ra.
2. **Given** lệnh kiểm tra đang chạy, **When** nó kết thúc, **Then** dữ liệu trong App không đổi
   gì (chỉ đọc).
3. **Given** kết quả có ghi thông tin cá nhân hay khoá, **When** in ra hoặc lưu file, **Then**
   các thông tin đó đã được che.

---

### Edge Cases

- App tự cập nhật **trong lúc** Agent Office đang chạy (App khởi động lại với phiên bản mới):
  hệ thống tự kết nối lại trong ≤ 10 giây và hiện đúng phiên bản mới (đã có hành vi tự kết nối
  lại, nay cần kiểm chứng trên 2.29.0).
- App lên một bản mới hơn chưa kiểm chứng (ví dụ 2.30.0): hệ thống vẫn chạy và cảnh báo như hiện
  tại. Cảnh báo phải ghi đúng danh sách các bản đã kiểm chứng, không ghi cứng "2.24.0".
- Câu hỏi trắc nghiệm bị agent huỷ trong lúc người dùng đang chọn: phần chọn bị khoá, hiện "câu
  hỏi đã bị huỷ", không gửi đáp án.
- Hai cửa sổ Agent Office cùng trả lời một câu hỏi: lần trả lời thứ hai bị từ chối nhẹ nhàng, hiện
  câu trả lời đã được ghi nhận.
- Người dùng vừa chọn đáp án có sẵn vừa gõ vào ô "Khác" ở cùng một câu con: gửi cả hai nếu App
  chấp nhận. Nếu App chỉ nhận một loại, giao diện PHẢI yêu cầu người dùng chọn một trước khi gửi.
- Câu hỏi có lựa chọn với nội dung rất dài hoặc định dạng markdown: hiển thị gọn, không vỡ khung chat.
- Bước lỗi không có thông báo ở bất kỳ chỗ nào đã biết: hiện "Lỗi không rõ nguyên nhân" kèm mã lỗi
  nếu có, không hiện khối trống.
- Kiểm thử với App thật bị gián đoạn giữa chừng: các conversation và project thử (có đánh dấu kiểm
  thử) vẫn được dọn ở lần chạy sau.

## Requirements *(mandatory)*

### Functional Requirements

**Tương thích phiên bản**

- **FR-001**: Hệ thống PHẢI coi cả **2.24.0 và 2.29.0** là phiên bản đã kiểm chứng: không cảnh báo
  với hai bản này, vẫn cảnh báo với mọi bản khác.
- **FR-002**: Cảnh báo phiên bản chưa kiểm chứng PHẢI ghi phiên bản đang chạy và danh sách các phiên
  bản đã kiểm chứng, lấy từ cùng một nguồn cấu hình, không ghi cứng trong câu chữ.
- **FR-003**: Chỉ được thêm 2.29.0 vào danh sách đã kiểm chứng sau khi toàn bộ kiểm thử với App thật
  (đọc **và** ghi) đã chạy qua trên 2.29.0, kể cả hành vi tự kết nối lại khi App khởi động lại.
  Việc công nhận 2.29.0 chỉ phụ thuộc vào User Story 1. Nó KHÔNG chờ User Story 2–4, vốn được
  giao ở các đợt sau trong cùng feature.
- **FR-004**: Mọi thay đổi để tương thích PHẢI nằm trong lớp kết nối App. Phần giao diện và phần
  còn lại của server chỉ được thay đổi để hiển thị khái niệm nghiệp vụ mới (câu hỏi trắc nghiệm,
  nội dung lỗi, tìm kiếm web).

**Dữ liệu mẫu và kiểm thử**

- **FR-005**: PHẢI ghi một bộ dữ liệu mẫu mới từ App 2.29.0 (đã che thông tin cá nhân), gồm ít
  nhất: danh sách conversation, các bước (có lệnh, xem file, sửa file, câu hỏi trắc nghiệm, lỗi,
  tìm kiếm web), trạng thái người dùng và quota, project, lệnh `/`.
- **FR-006**: Kiểm thử hợp đồng của lớp kết nối PHẢI chạy trên **cả hai** bộ dữ liệu mẫu 2.24.0
  và 2.29.0, và cùng pass.
- **FR-007**: Các trường mới chỉ có ở 2.29.0 (như nhánh git) không được làm hỏng việc đọc dữ
  liệu 2.24.0, và ngược lại.

**Câu hỏi trắc nghiệm của agent**

- **FR-008**: Hệ thống PHẢI nhận ra bước "agent hỏi người dùng" và đưa ra nội dung câu hỏi, các
  lựa chọn, trạng thái (đang chờ, đã trả lời, đã huỷ) và đáp án đã chọn nếu có.
- **FR-009**: Khi có câu hỏi đang chờ, nhân viên PHẢI ở trạng thái "chờ sếp", giống khi chờ
  duyệt quyền.
- **FR-010**: Câu hỏi đang chờ KHÔNG ĐƯỢC hiện thành yêu cầu "cho phép / từ chối". Với mỗi câu con,
  người dùng PHẢI trả lời được bằng cách chọn một hoặc nhiều đáp án (đúng số lượng App cho phép
  với câu con đó), hoặc gõ câu trả lời tự do vào ô "Khác" luôn có sẵn. Hệ thống gửi đúng câu trả
  lời đó cho App.
- **FR-010a**: Nếu App không nhận câu trả lời tự do (ô "Khác"), hệ thống PHẢI báo rõ cho người
  dùng, giữ nguyên nội dung đã gõ để họ chọn đáp án có sẵn hoặc gửi lại. Hệ thống KHÔNG ĐƯỢC âm
  thầm bỏ câu trả lời hay tự đổi sang một đáp án khác.
- **FR-011**: Việc trả lời câu hỏi chỉ xảy ra khi người dùng chủ động chọn (giống mọi thao tác
  ghi khác), không bao giờ tự động.

**Lỗi và tìm kiếm web**

- **FR-012**: Bước lỗi PHẢI hiện thông báo lỗi ngắn gọn lấy từ App. Nếu không có thông báo, hiện
  "Lỗi không rõ nguyên nhân" kèm mã lỗi nếu có.
- **FR-013**: Thông báo lỗi PHẢI đi qua bước che thông tin nhạy cảm trước khi hiển thị hoặc ghi log.
- **FR-014**: Bước tìm kiếm web PHẢI hiện nội dung đã tìm.

**Kiểm tra tương thích lặp lại được**

- **FR-015**: PHẢI có một lệnh dành cho người phát triển để kiểm tra tương thích với App đang
  chạy, chỉ dùng thao tác đọc, và in ra: phiên bản App; các lệnh nội bộ hệ thống dùng còn hay
  mất; các trường được thêm hoặc bớt so với bộ dữ liệu mẫu mới nhất; các loại bước chưa được
  nhận ra cùng số lần xuất hiện.
- **FR-016**: Lệnh kiểm tra KHÔNG ĐƯỢC in hoặc lưu token, email hay nội dung chat chưa che.
- **FR-016a**: Lệnh kiểm tra chỉ chạy khi người phát triển gọi. Agent Office KHÔNG tự chạy nó khi
  gặp phiên bản lạ. Khi đó vẫn chỉ hiện cảnh báo phiên bản như FR-002, không kèm kết quả kiểm tra.

**Tài liệu và nguyên tắc**

- **FR-017**: README, hướng dẫn cài đặt, script cài đặt và thông báo cảnh báo PHẢI ghi đúng các
  phiên bản App đã kiểm chứng. Nhật ký chạy thử cài đặt PHẢI có thêm một dòng trên App 2.29.0.
- **FR-018**: Constitution đã được sửa (v2.1.0, làm rõ câu chữ ở v2.1.1, ngày 2026-11-08): nhắm tới
  danh sách phiên bản đã kiểm chứng, bản mục tiêu là 2.29.0. Khi User Story 1 đạt FR-003, PHẢI sửa PATCH qua
  `/speckit-constitution` để chuyển 2.29.0 vào danh sách đã kiểm chứng, kèm bằng chứng kiểm thử.

### Key Entities

- **Phiên bản App đã kiểm chứng**: danh sách phiên bản đã kiểm chứng (2.24.0, 2.29.0), kèm ngày kiểm
  chứng. Dùng để quyết định có cảnh báo hay không.
- **Câu hỏi của agent**: thuộc về một bước trong conversation. Gồm một hoặc nhiều câu con, mỗi câu
  con có nội dung, danh sách lựa chọn (mã và nội dung), cho chọn một hay nhiều, các lựa chọn đã
  chọn, câu trả lời tự do (nếu có), và trạng thái chung
  (đang chờ, đã trả lời, đã huỷ).
- **Báo cáo tương thích**: kết quả của lệnh kiểm tra. Gồm phiên bản, lệnh nội bộ còn/mất, trường
  thêm/bớt, loại bước chưa nhận ra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Trên App 2.29.0, 100% kiểm thử với App thật (đọc và ghi) pass. Một test bị bỏ qua
  vì cài đặt của App (ví dụ App tự duyệt lệnh) được tính là đạt khi phần tương ứng đã được kiểm
  chứng bằng tay theo quickstart (M4). Không còn cảnh báo
  phiên bản trong 10 lần khởi động liên tiếp.
- **SC-002**: Mọi tính năng chạy được trên 2.24.0 đều chạy được trên 2.29.0 (không mất tính năng nào).
- **SC-003**: Câu hỏi trắc nghiệm đang chờ làm nhân viên chuyển sang "chờ sếp" trong ≤ 2 giây;
  người dùng trả lời và agent tiếp tục được trong ≤ 3 thao tác bấm.
- **SC-004**: 0 bước lỗi hiện nội dung trống. 0 bước câu hỏi hoặc tìm kiếm web bị hiện thành bước
  không rõ nghĩa, tính trên toàn bộ conversation hiện có của người dùng (46 conversation tại thời
  điểm điều tra).
- **SC-005**: Lần App cập nhật sau, người phát triển có kết luận "an toàn / cần sửa" trong ≤ 10
  phút nhờ lệnh kiểm tra tương thích (lần này mất khoảng một buổi điều tra tay).
- **SC-006**: Không có token, email hay nội dung chat chưa che trong log, báo cáo tương thích hay
  dữ liệu mẫu mới (kiểm tra bằng bước rà rò rỉ hiện có).

## Assumptions

- Máy của người dùng đang chạy App 2.29.0 và **không** hạ cấp được về 2.24.0, nên kiểm chứng 2.29.0
  chỉ làm được trên máy này. 2.24.0 vẫn được giữ hỗ trợ dựa trên bộ dữ liệu mẫu cũ, cho các máy
  chưa cập nhật.
- Kiểm thử với App thật được phép tạo rồi tự xoá conversation và project có đánh dấu
  `[agent-office-test]`, và được dùng một lượng quota model nhỏ, như quy trình hiện có.
- Câu hỏi trắc nghiệm, bước lỗi và tìm kiếm web đã có từ 2.24.0. Chủ dự án đã chốt đưa chúng vào
  feature này (Clarifications 2026-11-08), vì đợt rà soát tương thích phát hiện ra và vì câu hỏi
  trắc nghiệm làm sai trạng thái "chờ sếp". Thứ tự giao hàng: US1 → US2 → US3/US4.
- Ô "Khác" (trả lời tự do) luôn hiện theo quyết định của chủ dự án. Dữ liệu thật chưa có câu trả
  lời tự do nào, nên bước lập kế hoạch PHẢI thử nghiệm cách App nhận loại trả lời này. Nếu App
  không nhận, áp dụng FR-010a.
- Cách gửi đáp án câu hỏi cho App được xác định bằng một lần thử nghiệm ở bước lập kế hoạch. Dữ
  liệu đã thấy: App lưu đáp án theo mã lựa chọn của từng câu con.
- Các thông tin mới chỉ có ở 2.29.0 (nhánh git, repo, mức dùng cửa sổ ngữ cảnh, cờ "rảnh hẳn")
  **không** nằm trong phạm vi đợt này. Có thể dùng ở feature sau, ví dụ hiện nhánh git trên bàn
  nhân viên, hoặc thanh "độ đầy trí nhớ" của nhân viên.
- Cờ "model được đề xuất" mà 2.29.0 đã bỏ không được hệ thống dùng ở đâu, nên không cần xử lý.
