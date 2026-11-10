# Feature Specification: Giao diện tiếng Anh và cải tiến điều khiển

**Feature Branch**: `006-english-ui-controls`
**Created**: 2026-11-10
**Status**: Draft
**Input**: Mô tả của người dùng: "1. Chuyển toàn bộ ngôn ngữ hệ thống về tiếng Anh, không sử dụng tiếng Việt nữa. 2. Bổ sung thêm chế độ fullscreen ở Chế độ "Tổng quan" và Chế độ "Góc nhìn thứ nhất" (nếu chế độ nào đã có sẵn rồi thì bỏ qua). 3. Sử dụng phím tắt esc để tắt khung chat, thay vì chỉ có click vào dấu X mới tắt được chat. 4. Bổ sung thêm chức năng điều chỉnh độ nhạy của chuột. 5. Bổ sung thêm chức năng xoá đồ vật bằng chuột phải. Click 1 lần vào đồ vật bằng chuột trái, sau đó click chuột phải để xoá đồ vật đó đi."

## Clarifications

### Session 2026-11-10

- Q: Xoá bằng chuột phải chỉ dùng trong chế độ Xây dựng, hay cả ở chế độ xem bình thường? → A: Chỉ trong chế độ Xây dựng. Việc xoá chỉ sửa bản nháp, hoàn tác được, và bấm Huỷ thì bố cục đã lưu không đổi.
- Q: "Toàn bộ hệ thống" bằng tiếng Anh có gồm cả tài liệu dự án (README, INSTALL, `docs/`) không? → A: Không. Chỉ chữ hiển thị trong ứng dụng, kể cả thông báo lỗi từ server. Không dịch tài liệu.
- Q: Độ nhạy chuột chỉ áp dụng cho góc nhìn thứ nhất, hay cả khi kéo xoay camera ở chế độ Toàn cảnh? → A: Một thanh trượt chung cho cả hai chế độ.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dùng ứng dụng hoàn toàn bằng tiếng Anh (Priority: P1)

Người dùng mở văn phòng và mọi chữ ứng dụng hiển thị đều là tiếng Anh: nút, bảng, gợi ý, tooltip, hộp thoại, trạng thái trống, thông báo lỗi và cảnh báo (kể cả thông báo do server gửi), tên thành phố và đồ vật, và nhãn cho trình đọc màn hình.

**Why this priority**: Chạm tới mọi màn hình và là thay đổi lớn nhất. Các câu chuyện người dùng (user story) khác thêm chữ mới, nên chữ đó cần là tiếng Anh ngay từ đầu.

**Independent Test**: Đi qua mọi màn hình và chế độ (Toàn cảnh, góc nhìn thứ nhất, chế độ Xây dựng, chat, cài đặt, thống kê sử dụng, quota, project, tuyển nhân viên, xoá nhân viên, hộp xin quyền và hộp câu hỏi). Gây ra các lỗi thường gặp (App không chạy, không có quyền đọc thư mục, lưu bố cục thất bại). Không có chữ tiếng Việt nào xuất hiện.

**Acceptance Scenarios**:

1. **Given** ứng dụng đang mở ở bất kỳ chế độ nào, **When** người dùng đọc nhãn, gợi ý, tooltip hay nút bất kỳ, **Then** chữ đó là tiếng Anh.
2. **Given** một thao tác thất bại (ví dụ lưu bố cục), **When** lỗi hiện ra, **Then** thông báo lỗi là tiếng Anh.
3. **Given** người dùng dùng trình đọc màn hình, **When** nó đọc các nút điều khiển (ví dụ nút đóng chat hay thanh công cụ Xây dựng), **Then** tên đọc được là tiếng Anh và trang khai báo ngôn ngữ là tiếng Anh.
4. **Given** một cuộc trò chuyện có chữ tiếng Việt do người dùng hoặc agent viết, **When** nó được hiển thị, **Then** giữ nguyên, không dịch (nội dung của người dùng không bao giờ bị dịch).

---

### User Story 2 - Đóng khung chat bằng Esc (Priority: P1)

Khi khung chat đang mở, người dùng bấm Esc thì khung chat đóng lại, giống như bấm nút ×.

**Why this priority**: Thay đổi nhỏ nhưng người dùng gặp nhiều lần mỗi ngày.

**Independent Test**: Mở chat với một nhân viên, bấm Esc: khung chat đóng. Mở lại, bấm ×: vẫn đóng như cũ.

**Acceptance Scenarios**:

1. **Given** khung chat đang mở và không có hộp thoại hay popup nào đè lên, **When** người dùng bấm Esc (kể cả khi đang gõ trong ô tin nhắn), **Then** khung chat đóng.
2. **Given** có popup hoặc hộp thoại đè lên khung chat (hộp xác nhận xoá nhân viên, menu nhắc file hoặc lệnh, menu chọn model), **When** người dùng bấm Esc, **Then** chỉ popup đó đóng và khung chat vẫn mở; bấm Esc lần nữa mới đóng chat.
3. **Given** khung chat đang mở, **When** người dùng bấm ×, **Then** khung chat vẫn đóng như trước.

---

### User Story 3 - Xoá đồ vật bằng chuột phải (Priority: P2)

Trong chế độ Xây dựng, người dùng bấm chuột trái vào một đồ vật để chọn, rồi bấm chuột phải vào chính đồ vật đó để xoá, không cần dùng bàn phím hay thanh công cụ.

**Why this priority**: Giúp sắp xếp lại văn phòng nhanh hơn. Việc xoá đã có sẵn (phím Delete và nút trên thanh công cụ), nên đây chỉ là đường tắt.

**Independent Test**: Vào chế độ Xây dựng, bấm chuột trái vào một chậu cây, rồi bấm chuột phải vào chậu cây đó: nó biến mất khỏi bố cục nháp, và hoàn tác thì nó quay lại.

**Acceptance Scenarios**:

1. **Given** chế độ Xây dựng đang bật và có một đồ vật đang được chọn, **When** người dùng bấm chuột phải vào đúng đồ vật đó, **Then** đồ vật bị xoá khỏi bố cục nháp, không còn gì được chọn, và menu chuột phải của trình duyệt không hiện ra.
2. **Given** chế độ Xây dựng đang bật và chưa chọn đồ vật nào, **When** người dùng bấm chuột phải vào một đồ vật, **Then** không có gì bị xoá (bắt buộc phải chọn trước).
3. **Given** đang chọn một đồ vật, **When** người dùng bấm chuột phải vào đồ vật khác hoặc vào sàn trống, **Then** không có gì bị xoá.
4. **Given** một đồ vật vừa bị xoá bằng chuột phải, **When** người dùng hoàn tác, **Then** đồ vật quay lại; **When** người dùng huỷ chế độ Xây dựng, **Then** bố cục đã lưu không đổi.
5. **Given** đồ vật đang chọn không xoá được theo quy tắc hiện có của chế độ Xây dựng (ví dụ một bàn vẫn còn nhân viên ngồi), **When** người dùng bấm chuột phải vào nó, **Then** kết quả giống hệt bấm phím Delete.

---

### User Story 4 - Fullscreen ở chế độ Toàn cảnh và Góc nhìn thứ nhất (Priority: P2)

Người dùng bấm nút fullscreen (hoặc phím tắt) để văn phòng chiếm toàn màn hình, ở cả chế độ Toàn cảnh lẫn Góc nhìn thứ nhất, và thoát fullscreen bằng cùng cách đó hoặc bằng Esc.

**Why this priority**: Tăng cảm giác nhập vai, nhất là ở góc nhìn thứ nhất. Hiện cả hai chế độ đều chưa có fullscreen.

**Independent Test**: Ở mỗi chế độ, bật fullscreen: ứng dụng chiếm toàn màn hình và vẫn dùng được. Đổi chế độ xem khi đang fullscreen: vẫn giữ fullscreen. Tắt đi: cửa sổ trở về bình thường.

**Acceptance Scenarios**:

1. **Given** đang ở chế độ Toàn cảnh, **When** người dùng bật fullscreen, **Then** ứng dụng chiếm toàn màn hình và mọi bảng (chat, cài đặt, thanh công cụ Xây dựng) vẫn hoạt động.
2. **Given** đang ở chế độ Góc nhìn thứ nhất, **When** người dùng bật fullscreen, **Then** ứng dụng chiếm toàn màn hình, vẫn nhìn bằng chuột và đi lại được.
3. **Given** fullscreen đang bật, **When** người dùng chuyển giữa Toàn cảnh và Góc nhìn thứ nhất, **Then** fullscreen vẫn bật.
4. **Given** fullscreen đang bật, **When** người dùng dùng nút bật/tắt hoặc bấm Esc, **Then** fullscreen tắt và nút hiển thị đúng trạng thái hiện tại.
5. **Given** trình duyệt từ chối fullscreen, **When** người dùng thử bật, **Then** một thông báo ngắn bằng tiếng Anh cho biết fullscreen không dùng được, ngoài ra không có gì thay đổi.

---

### User Story 5 - Điều chỉnh độ nhạy chuột (Priority: P3)

Trong Settings, người dùng đổi độ nhạy chuột bằng một thanh trượt. Thay đổi áp dụng ngay vào tốc độ xoay camera khi di chuột, và được ghi nhớ sau khi tải lại trang.

**Why this priority**: Là cài đặt cho thoải mái. Giá trị mặc định đã dùng tốt với đa số người.

**Independent Test**: Ở góc nhìn thứ nhất, di chuột một khoảng cố định và để ý góc nhìn xoay bao nhiêu. Tăng độ nhạy rồi làm lại: góc nhìn xoay nhiều hơn. Tải lại trang: giá trị vẫn giữ. Bấm Reset: về mặc định.

**Acceptance Scenarios**:

1. **Given** Settings đang mở, **When** người dùng kéo thanh trượt độ nhạy, **Then** camera xoay nhanh hơn hoặc chậm hơn với cùng một chuyển động chuột, không cần tải lại trang.
2. **Given** người dùng đã đổi độ nhạy, **When** tải lại ứng dụng, **Then** giá trị đã chọn vẫn có hiệu lực.
3. **Given** file cài đặt được lưu từ trước khi có tính năng này, **When** ứng dụng nạp, **Then** dùng độ nhạy mặc định và không có gì khác thay đổi.

---

### Edge Cases

- Bấm Esc khi đang khoá chuột ở góc nhìn thứ nhất: trình duyệt nhả chuột trước; khung chat (nếu đang mở) chỉ đóng khi ứng dụng thực sự nhận được phím Esc.
- Bấm Esc khi đang fullscreen và khung chat đang mở: trình duyệt có thể dùng lần Esc đó để thoát fullscreen mà không chuyển cho ứng dụng; bấm Esc lần nữa mới đóng chat. Điều này chấp nhận được.
- Bấm Esc khi chế độ Xây dựng đang bật và khung chat đang đóng: hành vi Esc hiện có của chế độ Xây dựng (huỷ thao tác kéo, bỏ chọn đồ trong bảng hoặc bỏ chọn đồ vật) giữ nguyên.
- Bấm chuột phải khi đang kéo một đồ vật: thao tác kéo không bị ảnh hưởng và không có gì bị xoá.
- Bấm chuột phải ngoài chế độ Xây dựng hoặc vào một nhân viên: không có gì bị xoá; không thể xoá nhân viên theo cách này.
- Bấm chuột phải khi đang ở góc nhìn thứ nhất: không xoá (chế độ Xây dựng luôn dùng góc Toàn cảnh).
- Độ nhạy đặt ở mức thấp nhất hoặc cao nhất: camera vẫn xoay được (không bao giờ đứng im, không bao giờ nhanh tới mức không điều khiển được).
- Trình duyệt không hỗ trợ fullscreen (ví dụ một số trình duyệt nhúng): nút bị ẩn hoặc vô hiệu hoá, kèm giải thích bằng tiếng Anh.
- Thoát fullscreen bằng điều khiển của chính trình duyệt (F11, Esc): nút cập nhật theo đúng trạng thái.

## Requirements *(mandatory)*

### Functional Requirements

**Ngôn ngữ**

- **FR-001**: Mọi chữ ứng dụng hiển thị cho người dùng PHẢI là tiếng Anh: nhãn, nút, gợi ý, tooltip, chữ gợi ý trong ô nhập, hộp thoại, trạng thái trống, thông báo, cảnh báo và lỗi, kể cả thông báo do server gửi.
- **FR-002**: Tên hiển thị của nội dung có sẵn (thành phố, đồ vật trong danh mục, thời tiết, tên trạng thái, tên mặc định) PHẢI là tiếng Anh.
- **FR-003**: Tên và mô tả dành cho công nghệ hỗ trợ (trình đọc màn hình) PHẢI là tiếng Anh, và trang PHẢI khai báo ngôn ngữ là tiếng Anh.
- **FR-004**: Ngày, giờ và số PHẢI theo định dạng tiếng Anh (ví dụ "0.5 m", tên tháng và tên thứ bằng tiếng Anh).
- **FR-005**: Chữ do người dùng hoặc agent viết (tin nhắn, tiêu đề cuộc trò chuyện, tên project và tên thư mục) PHẢI hiển thị nguyên văn, không bao giờ bị dịch.
- **FR-006**: KHÔNG ĐƯỢC còn chữ tiếng Việt nào trên giao diện, và ứng dụng KHÔNG ĐƯỢC có nút chuyển ngôn ngữ (chỉ tiếng Anh).

**Khung chat**

- **FR-007**: Bấm Esc khi khung chat đang mở PHẢI đóng khung chat, giống bấm ×, kể cả khi con trỏ đang ở ô nhập tin nhắn.
- **FR-008**: Nếu có popup, menu hoặc hộp thoại đè lên khung chat, Esc PHẢI chỉ đóng cái trên cùng trước. Menu chọn model là danh sách thả xuống có sẵn của trình duyệt, tự xử lý Esc.
- **FR-009**: Đóng chat bằng Esc KHÔNG ĐƯỢC làm mất bản nháp tin nhắn chưa gửi theo cách mà bấm × không làm.

**Xoá bằng chuột phải**

- **FR-010**: Chỉ trong chế độ Xây dựng (không bao giờ ở chế độ Toàn cảnh hay Góc nhìn thứ nhất bình thường), bấm chuột phải vào đồ vật đang được chọn PHẢI xoá nó, theo đúng quy tắc của thao tác phím Delete hiện có.
- **FR-011**: Bấm chuột phải vào đồ vật chưa được chọn, vào sàn trống hoặc vào nhân viên KHÔNG ĐƯỢC xoá bất cứ thứ gì.
- **FR-012**: Menu chuột phải của trình duyệt KHÔNG ĐƯỢC hiện ra khi bấm chuột phải trong văn phòng 3D.
- **FR-013**: Việc xoá bằng chuột phải PHẢI hoàn tác được và PHẢI chỉ thay đổi bản nháp cho tới khi người dùng lưu bố cục.

**Fullscreen**

- **FR-014**: Cả chế độ Toàn cảnh và Góc nhìn thứ nhất PHẢI có nút bật/tắt fullscreen nhìn thấy được và phím tắt F; phím tắt không kích hoạt khi đang gõ trong ô nhập chữ.
- **FR-015**: Fullscreen PHẢI được giữ khi chuyển giữa hai chế độ xem và KHÔNG ĐƯỢC làm gián đoạn việc đi lại, nhìn bằng chuột, chat, cài đặt hay chế độ Xây dựng.
- **FR-016**: Nút bật/tắt PHẢI phản ánh đúng trạng thái fullscreen thật, kể cả khi thoát bằng Esc hoặc điều khiển của trình duyệt.
- **FR-017**: Nếu fullscreen không dùng được hoặc bị từ chối, ứng dụng PHẢI hiện một thông báo ngắn bằng tiếng Anh và vẫn hoạt động bình thường.

**Độ nhạy chuột**

- **FR-018**: Settings PHẢI có điều khiển độ nhạy chuột trong một khoảng giới hạn (mặc định 1.0×, từ 0.25× tới 3.0×) và có cách đưa về mặc định.
- **FR-019**: Độ nhạy PHẢI điều chỉnh góc xoay camera theo mỗi chuyển động chuột ở Góc nhìn thứ nhất, và tốc độ xoay camera Toàn cảnh khi kéo bằng chuột.
- **FR-020**: Thay đổi PHẢI có hiệu lực ngay và PHẢI được lưu cùng các cài đặt khác của người dùng; cài đặt cũ chưa có giá trị này PHẢI nạp với giá trị mặc định.

### Key Entities

- **Settings**: các tuỳ chọn đã lưu của người dùng; có thêm giá trị độ nhạy chuột (số, mặc định 1.0, khoảng 0.25–3.0).
- **Đồ vật đang chọn trong chế độ Xây dựng**: chuột phải chỉ xoá nó khi bấm trúng đúng đồ vật đó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Đi qua toàn bộ màn hình, chế độ và các trạng thái lỗi thường gặp, tìm thấy 0 chuỗi chữ giao diện tiếng Việt.
- **SC-002**: Người dùng đóng được khung chat bằng một lần bấm phím trong 100% trường hợp không có popup đè lên.
- **SC-003**: Xoá một đồ vật đã chọn chỉ cần 1 thao tác chuột (chuột phải) thay vì chuyển sang bàn phím hay thanh công cụ, và 100% lần xoá bằng chuột phải đều hoàn tác được.
- **SC-004**: Người dùng bật hoặc tắt fullscreen từ cả hai chế độ xem bằng 1 thao tác, và nút bật/tắt khớp với trạng thái thật 100% thời gian.
- **SC-005**: Ở độ nhạy cao nhất, cùng một chuyển động chuột làm camera xoay khoảng 12 lần so với độ nhạy thấp nhất, và giá trị đã chọn được giữ sau khi tải lại trang 100% lần.
- **SC-006**: Mọi hành vi hiện có mà bộ test đang kiểm tra vẫn hoạt động, ngoài các thay đổi chữ dự kiến.

## Assumptions

- "Toàn bộ hệ thống" là mọi thứ ứng dụng hiển thị cho người dùng, kể cả thông báo lỗi từ server. Tài liệu dự án (README, INSTALL, `docs/`, các spec cũ trong `specs/`, thư mục `speckit-skills-vi`), comment trong code, và dữ liệu test ghi lại từ App thật nằm ngoài phạm vi, vì không phải giao diện. Ngoại lệ duy nhất: các tên nút và thông báo được trích trong `docs/INSTALL.md` và `README.md` được đổi sang tên tiếng Anh mới để hướng dẫn cài đặt vẫn khớp với màn hình. Phần văn bản xung quanh giữ tiếng Việt.
- Chỉ dùng tiếng Anh; không cần nút chuyển ngôn ngữ hay thư viện dịch.
- Toàn cảnh và Góc nhìn thứ nhất là hai chế độ xem hiện có (người dùng gọi là "Tổng quan" và "Góc nhìn thứ nhất"); hiện cả hai đều chưa có fullscreen, nên cả hai đều được bổ sung.
- Xoá bằng chuột phải chỉ áp dụng trong chế độ Xây dựng, vì đó là nơi duy nhất hiện chọn và xoá được đồ vật. Tính năng dùng lại quy tắc xoá, lịch sử hoàn tác và luồng Lưu/Huỷ có sẵn.
- Không có hộp xác nhận khi xoá bằng chuột phải, vì phải chọn trước và hoàn tác được.
- Độ nhạy chuột là một cài đặt chung cho cả hai chế độ xem, không tách riêng. Tốc độ zoom bằng con lăn không bị ảnh hưởng.
- Phím tắt F cho fullscreen không trùng với phím tắt hiện có (V đổi chế độ xem, E dùng đồ vật, R xoay đồ trong chế độ Xây dựng, WASD di chuyển).
