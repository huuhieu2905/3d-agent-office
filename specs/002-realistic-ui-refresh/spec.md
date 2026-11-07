# Feature Specification: Làm mới giao diện theo concept thực tế hơn

**Feature Branch**: `002-realistic-ui-refresh`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Sửa lại một số vấn đề về giao diện: (1) giao diện theo concept thực tế hơn — tạo 5 giao diện mẫu để chọn rồi sửa lại toàn bộ concept hệ thống, tham khảo https://khanh020905.github.io/my-office/vi/; (2) kéo thả khó dùng — click vào đồ vật thì chọn đồ vật đó và kéo thả được tới vị trí bất kỳ; click vào nhân viên vẫn chưa kéo được nhân viên vào bàn làm việc; (3) dùng font chữ khác nổi bật, đẹp hơn; (4) model chọn cho một conversation phải được lưu lại cho conversation đó — hiện chọn 3.8 Flash, thoát ra mở lại thì bị về mặc định 4 Argon; (5) khung cảnh thành phố dùng toà nhà nhìn thực tế hơn, bổ sung quán cà phê, quán ăn. Bổ sung (2026-11-07): kéo nhân viên vào bàn cũng chỉ dùng ở chế độ sắp xếp để tránh thao tác nhầm; nhân viên không được đứng chồng lấn lên nhau, khi vấp vào nhau hoặc vào đồ vật thì có hiệu ứng va chạm thực tế; cho phép kéo dài / mở rộng văn phòng (chọn chiều dài, chiều rộng) ở chế độ sắp xếp. Bổ sung khi chốt concept E+ (2026-11-07): cây cối và khung cảnh xung quanh giống thực tế hơn; thêm xe cộ, người tập thể dục, đi bộ trong công viên. Thành phố chỉ ở góc camera xa; trong phạm vi văn phòng vẫn là công viên bao quanh làm giao diện chính. Thêm không gian trống quanh văn phòng để mở rộng văn phòng mà không dính vào cây cối và quán xung quanh."

## User Scenarios & Testing *(mandatory)*

Các câu chuyện được sắp theo thứ tự ưu tiên và thứ tự giao hàng (Constitution, Nguyên tắc IV).
Hai lỗi đang làm hỏng trải nghiệm hằng ngày (model không được nhớ, kéo thả nhân viên không
được) được làm trước; phần làm mới concept phụ thuộc vào lựa chọn của người dùng nên đi sau.

### User Story 1 - Model đã chọn được nhớ theo từng conversation (Priority: P1)

Người dùng mở chat với một nhân viên, chọn model "3.8 Flash" và gửi tin nhắn. Sau đó họ đóng
khung chat, làm việc khác, rồi mở lại đúng nhân viên đó. Ô chọn model vẫn hiển thị "3.8 Flash",
không bị nhảy về model mặc định (hiện là "4 Argon"). Mỗi conversation nhớ model riêng: đổi model
ở conversation A không ảnh hưởng conversation B.

**Why this priority**: Đây là lỗi đang xảy ra mỗi ngày và dễ khiến người dùng vô tình gửi việc
bằng sai model (tốn quota, sai chất lượng). Sửa nhỏ, giá trị ngay.

**Independent Test**: Chọn một model khác mặc định ở một conversation, đóng chat, mở lại (và
tải lại trang), kiểm tra model vẫn đúng; kiểm tra một conversation khác vẫn dùng model của nó.

**Acceptance Scenarios**:

1. **Given** conversation A đang dùng model mặc định "4 Argon", **When** người dùng chọn
   "3.8 Flash", đóng khung chat rồi mở lại A, **Then** ô chọn model hiển thị "3.8 Flash".
2. **Given** người dùng đã chọn "3.8 Flash" cho A, **When** người dùng tải lại trang hoặc khởi
   động lại hệ thống rồi mở A, **Then** ô chọn model vẫn là "3.8 Flash".
3. **Given** A dùng "3.8 Flash" và B chưa từng được chọn model, **When** người dùng mở B,
   **Then** B hiển thị model gần nhất mà B đã dùng theo dữ liệu App, hoặc model mặc định trong
   cài đặt nếu B chưa có.
4. **Given** model đã nhớ của A không còn khả dụng (bị gỡ hoặc hết quota), **When** người dùng
   mở A, **Then** hệ thống báo rõ model cũ không dùng được và đề xuất model mặc định, không âm
   thầm đổi.
5. **Given** người dùng chọn model nhưng chưa gửi tin nhắn nào, **When** đóng rồi mở lại chat,
   **Then** lựa chọn vẫn được giữ.

---

### User Story 2 - Chọn và kéo thả đồ vật, nhân viên một cách trực tiếp (Priority: P1)

Khi sắp xếp văn phòng, người dùng bấm vào một đồ vật (bàn, ghế, cây, tủ...) thì đồ vật đó được
chọn, có viền/đánh dấu rõ ràng. Người dùng giữ chuột và kéo đồ vật tới bất kỳ vị trí nào trên
sàn văn phòng, không bị giới hạn theo ô lưới thô. Thả ra là đồ vật nằm tại đó. Đồ vật đang chọn
có thể xoay hoặc xoá.

Với nhân viên: cũng trong chế độ sắp xếp, người dùng nhấn giữ vào một nhân viên và kéo tới một
bàn làm việc. Khi kéo qua một bàn trống, bàn đó sáng lên; thả ra thì nhân viên ngồi vào bàn đó.
Ngoài chế độ sắp xếp, nhân viên không kéo được để tránh thao tác chuột nhầm; bấm một lần vào
nhân viên vẫn mở chat như hiện tại.

**Why this priority**: Kéo thả hiện tại khó dùng và kéo nhân viên vào bàn không hoạt động — một
tính năng đã hứa nhưng hỏng. Cần sửa trước khi đổi concept vì concept mới sẽ có bố cục mới mà
người dùng muốn tự sắp xếp.

**Independent Test**: Vào chế độ sắp xếp, bấm một cái bàn, kéo sang vị trí khác giữa hai ô
lưới cũ, thả ra; kéo một nhân viên vào một bàn trống khác; tải lại trang và kiểm tra vị trí
được giữ nguyên.

**Acceptance Scenarios**:

1. **Given** đang ở chế độ sắp xếp, **When** người dùng bấm một đồ vật, **Then** đồ vật đó được
   đánh dấu đang chọn và mọi đồ vật khác bỏ chọn.
2. **Given** một đồ vật đang được chọn, **When** người dùng kéo nó tới một chỗ trống bất kỳ trên
   sàn và thả ra, **Then** đồ vật nằm đúng chỗ thả (sai lệch không quá 5 cm theo tỉ lệ cảnh) và
   vị trí được lưu.
3. **Given** người dùng kéo đồ vật tới chỗ chồng lên đồ vật khác hoặc ra ngoài sàn, **When**
   đang kéo, **Then** bóng xem trước chuyển màu báo không hợp lệ; **When** thả ra, **Then** đồ
   vật quay về vị trí cũ.
4. **Given** đang ở chế độ sắp xếp, người dùng nhấn giữ vào một nhân viên và kéo, **When** đi
   qua một bàn trống,
   **Then** bàn đó được làm nổi bật; **When** thả lên bàn đó, **Then** nhân viên đi tới và ngồi
   vào bàn mới, chỗ ngồi được lưu.
5. **Given** người dùng thả nhân viên lên bàn đã có người, **When** thả ra, **Then** hai nhân
   viên đổi chỗ cho nhau.
6. **Given** người dùng thả nhân viên ra chỗ không phải bàn, **When** thả ra, **Then** nhân viên
   quay về bàn cũ.
7. **Given** ở màn hình chính (không ở chế độ sắp xếp), **When** người dùng nhấn giữ và kéo
   một nhân viên hoặc một đồ vật, **Then** không có gì bị di chuyển.
8. **Given** ở màn hình chính, **When** người dùng bấm một lần vào nhân viên, **Then** khung chat
   mở ra như cũ (vẫn đúng 1 lần bấm, Constitution Nguyên tắc V).
9. **Given** đồ vật đang chọn, **When** người dùng bấm vào khoảng trống hoặc nhấn Esc, **Then**
   bỏ chọn.

---

### User Story 3 - Nhân viên không chồng lấn, va chạm trông thực tế (Priority: P2)

Nhân viên đi lại trong văn phòng (đi uống nước, vươn vai, về bàn, đổi chỗ) không bao giờ đứng
hay đi xuyên qua nhau, cũng không đi xuyên qua đồ vật. Khi hai nhân viên gặp nhau trên lối đi,
họ tránh nhau hoặc nhường đường. Khi một nhân viên vấp vào người khác hay vào đồ vật, có hiệu
ứng va chạm nhìn thực tế: khựng lại, lảo đảo nhẹ, đổi hướng, và đồ vật nhẹ (ghế) có thể xê dịch
hoặc rung nhẹ, rồi mọi thứ trở lại bình thường.

**Why this priority**: Nhân viên đứng chồng lên nhau phá vỡ cảm giác thật của văn phòng, đi
ngược mục tiêu "thực tế hơn" của cả tính năng.

**Independent Test**: Cho nhiều nhân viên rảnh cùng đi lại trong văn phòng chật trong 10 phút,
quan sát không có lúc nào hai nhân viên chồng lên nhau hoặc xuyên qua đồ vật, và các lần va chạm
có hiệu ứng.

**Acceptance Scenarios**:

1. **Given** nhiều nhân viên đi lại cùng lúc, **When** quan sát bất kỳ thời điểm nào, **Then**
   không có hai nhân viên nào chồng lấn lên nhau.
2. **Given** hai nhân viên đi ngược chiều trên cùng lối đi, **When** họ tới gần nhau, **Then** họ
   tránh nhau hoặc một người dừng nhường đường, rồi cả hai tiếp tục tới đích.
3. **Given** một nhân viên chạm vào nhân viên khác, **When** va chạm xảy ra, **Then** cả hai có
   phản ứng va chạm nhìn thấy được (khựng, lảo đảo nhẹ, quay đầu nhìn) trong khoảng 1 giây rồi
   tiếp tục việc đang làm.
4. **Given** một nhân viên vấp vào đồ vật, **When** va chạm xảy ra, **Then** nhân viên có phản
   ứng va chạm và đồ vật nhẹ rung hoặc xê dịch nhẹ; vị trí đồ vật đã lưu không bị thay đổi vĩnh
   viễn.
5. **Given** nhân viên đang ngồi làm việc, **When** người khác đi ngang qua, **Then** người đang
   ngồi không bị đẩy khỏi chỗ và trạng thái hiển thị không bị ảnh hưởng.
6. **Given** đường tới đích bị chặn hoàn toàn, **When** nhân viên không tìm được đường, **Then**
   nhân viên đứng chờ hoặc quay về bàn, không đi xuyên qua vật cản.

---

### User Story 4 - Mở rộng, thay đổi kích thước văn phòng (Priority: P2)

Trong chế độ sắp xếp, người dùng chọn chiều dài và chiều rộng của văn phòng, để kéo dài hoặc mở
rộng văn phòng khi đội nhân viên đông lên (hoặc thu gọn khi muốn ấm cúng hơn). Văn phòng, tường,
cửa sổ và khu vực xung quanh tự điều chỉnh theo kích thước mới; đồ vật và nhân viên giữ nguyên vị
trí.

**Why this priority**: Văn phòng cỡ cố định giới hạn khả năng tự bố trí, nhất là khi đã có kéo
thả tự do và nhân viên cần chỗ đi lại không chồng lấn.

**Independent Test**: Vào chế độ sắp xếp, tăng chiều dài và chiều rộng, đặt thêm bàn vào phần mới,
tải lại trang và kiểm tra kích thước, đồ vật vẫn đúng.

**Acceptance Scenarios**:

1. **Given** đang ở chế độ sắp xếp, **When** người dùng đặt chiều dài và chiều rộng mới trong giới
   hạn cho phép, **Then** văn phòng đổi kích thước ngay, xem trước được trước khi xác nhận.
2. **Given** văn phòng đã mở rộng, **When** người dùng kéo đồ vật vào phần sàn mới, **Then** đồ
   vật đặt được bình thường.
3. **Given** có đồ vật hoặc bàn có người nằm ở phần sẽ bị thu hẹp, **When** người dùng thu nhỏ
   văn phòng, **Then** hệ thống không cho thu nhỏ quá phạm vi đó và chỉ rõ đồ vật nào đang chặn.
4. **Given** kích thước mới đã xác nhận, **When** tải lại trang, **Then** kích thước và bố cục được
   giữ nguyên.
5. **Given** người dùng nhập giá trị ngoài giới hạn, **When** xác nhận, **Then** hệ thống báo rõ
   giới hạn và không thay đổi văn phòng.
6. **Given** văn phòng có kích thước lớn nhất, **When** chạy với số nhân viên tối đa, **Then** vẫn
   đạt ngưỡng hiệu năng.
7. **Given** văn phòng đang có cây, ghế, ki-ốt và lối đi bao quanh, **When** người dùng mở rộng văn
   phòng lên 40 × 40 m, **Then** công viên tự giãn ra: vẫn có dải cỏ trống quanh văn phòng, không cây
   hay quán nào chồng lên văn phòng, và phố vẫn ở xa ngoài công viên.

---

### User Story 5 - Chọn concept giao diện thực tế hơn từ 5 mẫu (Priority: P2)

Trước khi làm lại giao diện, người dùng được xem **5 concept giao diện mẫu** khác nhau, đặt cạnh
nhau để so sánh. Mỗi mẫu thể hiện cùng một khung cảnh (văn phòng có vài nhân viên ở các trạng
thái khác nhau, một khung chat đang mở, bảng quota, nền thành phố) theo một phong cách riêng,
đều theo hướng thực tế hơn hiện tại. Người dùng chọn một mẫu (có thể kèm góp ý chỉnh sửa).

**Why this priority**: Đây là thay đổi lớn nhất và phụ thuộc vào gu của người dùng. Phải chốt
concept trước khi làm Story 6 và 7, để không phải làm lại hai lần.

**Independent Test**: Người dùng xem được cả 5 mẫu, phân biệt được chúng, và ghi lại được lựa
chọn cuối cùng.

**Acceptance Scenarios**:

1. **Given** spec được duyệt, **When** đến bước chọn concept, **Then** người dùng nhận được
   đúng 5 mẫu, mỗi mẫu có tên, mô tả ngắn phong cách (vật liệu, ánh sáng, bảng màu, font, kiểu
   nhân vật, kiểu thành phố) và hình minh hoạ cùng một khung cảnh.
2. **Given** 5 mẫu, **When** người dùng so sánh, **Then** các mẫu khác nhau rõ rệt về phong cách,
   không chỉ khác màu.
3. **Given** người dùng đã chọn một mẫu, **When** lựa chọn được ghi lại, **Then** concept được
   chọn trở thành chuẩn duy nhất cho Story 6 và 7; 4 mẫu còn lại không được đưa vào sản phẩm.
4. **Given** không mẫu nào phù hợp, **When** người dùng góp ý, **Then** có thể làm một vòng mẫu
   chỉnh sửa trước khi chốt.

---

### User Story 6 - Toàn bộ hệ thống mang concept mới và font mới (Priority: P2)

Sau khi chốt concept, toàn bộ hệ thống được làm lại theo concept đó: văn phòng (sàn, tường, cửa
sổ, đồ nội thất, ánh sáng), nhân viên, các bảng giao diện (chat, quota, cài đặt, danh sách
project, chế độ xây dựng), cả chế độ sáng và tối. Font chữ được thay bằng font nổi bật, dễ đọc,
đẹp hơn, hiển thị đúng tiếng Việt có dấu.

**Why this priority**: Đây là mục tiêu chính của yêu cầu, nhưng phải sau Story 5.

**Independent Test**: Đi qua mọi màn hình và chế độ (sáng/tối, toàn cảnh/góc nhìn thứ nhất,
chat, quota, cài đặt, xây dựng) và kiểm tra tất cả theo concept đã chọn, không còn phần nào
mang phong cách cũ.

**Acceptance Scenarios**:

1. **Given** concept đã chốt, **When** người dùng mở hệ thống, **Then** văn phòng, nhân viên và
   mọi bảng giao diện đều theo concept đó, khớp với mẫu đã chọn.
2. **Given** chế độ sáng và tối, **When** người dùng chuyển đổi, **Then** cả hai đều theo concept
   mới và chữ vẫn đủ tương phản để đọc.
3. **Given** font mới, **When** hiển thị tiêu đề, tên nhân viên, nội dung chat tiếng Việt có
   dấu, **Then** mọi ký tự hiển thị đúng, không rơi về font hệ thống ở bất kỳ chữ nào.
4. **Given** nhân viên ở các trạng thái (đang làm, chờ sếp, lỗi, rảnh), **When** nhìn văn phòng
   theo concept mới, **Then** các trạng thái vẫn phân biệt rõ ràng như trước.
5. **Given** máy không có mạng Internet, **When** mở hệ thống, **Then** font và mọi tài nguyên
   giao diện vẫn hiển thị đầy đủ.

---

### User Story 7 - Thành phố và công viên thực tế hơn, có quán, xe cộ và người (Priority: P3)

Trong phạm vi quanh văn phòng, khung cảnh chính là **công viên bao quanh mọi phía**: cây, lối đi,
hồ nước, ghế đá, một ki-ốt cà phê, người đi bộ, chạy bộ, tập thể dục. **Thành phố chỉ ở góc camera
xa** (cách văn phòng khoảng 30 m trở lên), làm nền: dãy phố có toà nhà trông thực tế hơn (có cửa sổ,
tầng, mặt tiền, mái, vật liệu như kính, gạch, bê tông) thay cho khối hộp đơn giản, các quán cà phê và
quán ăn với biển hiệu, mái che, bàn ghế ngoài trời, đèn sáng vào buổi tối, xe cộ trên đường, cao ốc
phía sau.

**Why this priority**: Làm phong phú bối cảnh, nhưng chỉ là nền (Constitution Nguyên tắc V) và
phải theo concept của Story 5.

**Independent Test**: Xem toàn cảnh ở từng thành phố, ban ngày và ban đêm, đếm được quán cà phê
và quán ăn, kiểm tra FPS vẫn đạt ngưỡng.

**Acceptance Scenarios**:

1. **Given** bất kỳ thành phố nào trong 5 thành phố, **When** người dùng xem toàn cảnh, **Then**
   các toà nhà gần có chi tiết mặt tiền rõ ràng (cửa sổ, tầng, mái) theo concept đã chọn.
2. **Given** toàn cảnh ở góc camera mặc định, **When** người dùng nhìn quanh văn phòng, **Then**
   mọi phía quanh văn phòng là công viên, có ki-ốt cà phê nhìn thấy được; dãy phố chỉ xuất hiện ở xa
   phía sau. **When** người dùng xoay hoặc phóng xa, **Then** thấy ít nhất 2 quán cà phê và 2 quán ăn
   ở dãy phố, nhận ra được nhờ biển hiệu và bàn ghế bên ngoài.
3. **Given** ban đêm, **When** người dùng xem thành phố, **Then** cửa sổ toà nhà và các quán sáng
   đèn.
4. **Given** thành phố mới, **When** hệ thống chạy với số nhân viên tối đa đã cam kết, **Then**
   vẫn đạt ngưỡng hiệu năng; nếu không đạt, chi tiết thành phố được giảm trước chi tiết văn phòng.
5. **Given** toàn cảnh, **When** người dùng nhìn màn hình, **Then** văn phòng và nhân viên vẫn
   là trung tâm thị giác, thành phố không lấn át.
6. **Given** công viên quanh văn phòng, **When** người dùng quan sát, **Then** cây có tán nhiều tầng lá,
   có cây ra hoa và hàng cây ven đường, trông giống cây thật hơn khối cầu đơn giản.
7. **Given** ban ngày trời không mưa, **When** người dùng quan sát 30 giây, **Then** thấy người đi bộ,
   người chạy bộ trên lối đi, một nhóm tập thể dục trên bãi cỏ, và xe hơi, xe máy, xe buýt chạy hai chiều
   trên đường.
8. **Given** ban đêm, **When** xe chạy qua, **Then** xe có đèn pha và đèn hậu sáng.

### Edge Cases

- Conversation bị xoá trong App: lựa chọn model đã nhớ của nó được dọn, không tích tụ mãi.
- Chọn model ngay trong lúc agent đang chạy: lựa chọn áp dụng cho lượt sau và vẫn được nhớ.
- Kéo đồ vật nhưng chuột rời khỏi cửa sổ trình duyệt hoặc mất tiêu điểm: huỷ thao tác, đồ vật về
  vị trí cũ.
- Kéo nhân viên khi không còn bàn trống: vẫn cho đổi chỗ với nhân viên khác; thả ra chỗ khác thì
  về bàn cũ.
- Di chuyển một cái bàn đang có nhân viên ngồi: nhân viên đi theo bàn.
- Bấm vào nhân viên trong chế độ sắp xếp (không kéo): không mở chat, để tránh lẫn với thao tác kéo; rê chuột nhẹ vài pixel khi bấm ở màn hình chính vẫn là bấm mở chat.
- Màn hình nhỏ hoặc thiết bị cảm ứng (trackpad): chọn và kéo vẫn dùng được.
- Bố cục văn phòng cũ (đặt theo ô lưới) phải mở được nguyên vẹn sau khi chuyển sang đặt tự do.
- Chế độ giảm chi tiết tự động: concept mới vẫn phải có phiên bản chi tiết thấp trông hợp lý.
- Nhiều nhân viên cùng muốn tới một điểm (máy nước): xếp hàng hoặc chờ, không chồng lên nhau.
- Hai nhân viên được đổi chỗ cho nhau: cả hai đi về bàn mới mà không xuyên qua nhau.
- Người dùng đặt đồ vật lên chỗ một nhân viên đang đứng: nhân viên bước sang bên, hoặc thao tác
  đặt bị coi là không hợp lệ nếu nhân viên đang ngồi ở đó.
- Văn phòng mở rộng nhưng cảnh xung quanh (công viên) không đủ chỗ: văn phòng vẫn nằm trọn trong
  công viên, cảnh xung quanh co giãn theo.
- Góc nhìn thứ nhất khi văn phòng mở rộng: người dùng đi lại được trong toàn bộ văn phòng mới.

## Requirements *(mandatory)*

### Functional Requirements

**Model theo conversation**

- **FR-001**: Hệ thống MUST nhớ model người dùng đã chọn cho từng conversation, độc lập giữa các
  conversation.
- **FR-002**: Lựa chọn MUST được giữ qua việc đóng/mở chat, tải lại trang và khởi động lại hệ
  thống.
- **FR-003**: Khi mở chat, model hiển thị MUST theo thứ tự ưu tiên: (1) model người dùng đã chọn
  cho conversation đó trong hệ thống, (2) model conversation đó dùng gần nhất theo dữ liệu App,
  (3) model mặc định trong cài đặt.
- **FR-004**: Nếu model đã nhớ không còn khả dụng, hệ thống MUST báo cho người dùng và đề xuất
  model khác, không tự đổi âm thầm.
- **FR-005**: Lựa chọn model đã nhớ MUST bị xoá khi conversation không còn tồn tại trong App.

**Chọn và kéo thả**

- **FR-006**: Ở chế độ sắp xếp, bấm vào một đồ vật MUST chọn đồ vật đó và đánh dấu rõ ràng; chỉ
  một đồ vật được chọn tại một thời điểm.
- **FR-007**: Đồ vật đang chọn MUST kéo được tới vị trí bất kỳ trên sàn văn phòng với độ mịn
  không thô hơn 5 cm theo tỉ lệ cảnh, có bóng xem trước báo hợp lệ/không hợp lệ trong lúc kéo.
- **FR-008**: Hệ thống MUST không cho thả đồ vật chồng lên đồ vật khác, chắn lối đi bắt buộc
  hoặc ra ngoài sàn; thả không hợp lệ MUST trả đồ vật về vị trí cũ.
- **FR-009**: Đồ vật đang chọn MUST xoay được và xoá được bằng thao tác trực tiếp (nút hoặc
  phím tắt).
- **FR-010**: Ở chế độ sắp xếp, người dùng MUST kéo được nhân viên tới một bàn làm việc bằng cách
  nhấn giữ và kéo; bàn đích MUST được làm nổi bật khi rê qua. Ngoài chế độ sắp xếp, nhân viên và
  đồ vật MUST không kéo được.
- **FR-011**: Thả nhân viên lên bàn trống MUST xếp nhân viên vào bàn đó; lên bàn có người MUST
  đổi chỗ hai nhân viên; ra chỗ khác MUST trả nhân viên về bàn cũ.
- **FR-012**: Ở màn hình chính, bấm một lần vào nhân viên MUST vẫn mở chat.
- **FR-013**: Vị trí đồ vật và chỗ ngồi nhân viên MUST được lưu và giữ nguyên sau khi tải lại.
- **FR-014**: Bố cục đã lưu từ phiên bản trước MUST mở được mà không mất đồ vật hay chỗ ngồi.
- **FR-015**: Di chuyển một bàn có người ngồi MUST mang nhân viên theo.

**Nhân viên không chồng lấn và va chạm**

- **FR-016**: Nhân viên MUST không bao giờ chồng lấn lên nhau hay đi xuyên qua đồ vật, tường
  khi đi lại, kể cả khi đổi chỗ hoặc đi tới cùng một điểm.
- **FR-017**: Nhân viên đang di chuyển MUST tránh nhau hoặc nhường đường khi gặp nhau.
- **FR-018**: Khi nhân viên chạm vào nhân viên khác hoặc đồ vật, MUST có hiệu ứng va chạm nhìn
  thấy được (khựng lại, lảo đảo nhẹ, đổi hướng, quay đầu nhìn), kéo dài không quá khoảng 1 giây
  rồi tiếp tục việc đang làm.
- **FR-019**: Đồ vật nhẹ (ghế, thùng rác, chậu cây nhỏ) MAY rung hoặc xê dịch nhẹ khi bị va vào,
  nhưng MUST trở về vị trí đã lưu; vị trí lưu không bị thay đổi do va chạm.
- **FR-020**: Hiệu ứng va chạm MUST không làm sai hay che khuất trạng thái thật của nhân viên
  (Constitution Nguyên tắc I); nhân viên đang ngồi làm việc không bị đẩy khỏi chỗ.
- **FR-021**: Khi không có đường tới đích, nhân viên MUST chờ hoặc quay về bàn, không xuyên vật cản.

**Kích thước văn phòng**

- **FR-022**: Ở chế độ sắp xếp, người dùng MUST chọn được chiều dài và chiều rộng văn phòng (nhập
  số hoặc kéo cạnh văn phòng), có xem trước trước khi xác nhận.
- **FR-023**: Kích thước MUST nằm trong giới hạn từ 6 m đến 40 m mỗi chiều, bước 0,5 m; giá trị
  ngoài giới hạn MUST bị từ chối kèm thông báo rõ.
- **FR-024**: Thu nhỏ MUST không được làm đồ vật hay bàn có người nằm ngoài sàn; hệ thống MUST chỉ
  rõ đồ vật đang chặn.
- **FR-025**: Khi đổi kích thước, tường, cửa sổ, sàn và cảnh xung quanh MUST tự điều chỉnh; đồ vật
  và nhân viên MUST giữ nguyên vị trí.
- **FR-026**: Công viên MUST tự xếp lại theo kích thước văn phòng: luôn có dải cỏ trống ít nhất 5 m
  giữa mép văn phòng và lối đi, ít nhất 8 m tới cây gần nhất; lối đi, ghế, bồn hoa, ki-ốt, hồ, nhóm
  tập thể dục tự dời ra ngoài khi văn phòng lớn lên. Ở mọi kích thước tới 40 × 40 m, không vật nào của
  công viên hay thành phố chồng lên văn phòng, và việc đổi kích thước không bao giờ bị chặn bởi cảnh
  bên ngoài (chỉ bị chặn bởi đồ vật bên trong văn phòng, FR-024).
- **FR-027**: Kích thước văn phòng MUST được lưu cùng bố cục và giữ nguyên sau khi tải lại.

**Concept giao diện**

- **FR-028**: Trước khi làm lại giao diện, MUST có đúng 5 concept mẫu khác nhau rõ rệt, cùng thể
  hiện một khung cảnh tiêu chuẩn (văn phòng, nhân viên ở 4 trạng thái, khung chat, bảng quota,
  nền thành phố), để người dùng chọn.
- **FR-029**: Các concept mẫu MUST theo hướng thực tế hơn giao diện hiện tại và lấy cảm hứng (không
  sao chép) từ trang tham khảo của người dùng.
- **FR-030**: Concept được chọn MUST được ghi lại trong tài liệu của tính năng và áp dụng cho toàn
  bộ hệ thống: văn phòng, nội thất, nhân viên, ánh sáng, mọi bảng giao diện, chế độ sáng và tối,
  góc nhìn toàn cảnh và thứ nhất, chế độ xây dựng.
- **FR-031**: Trạng thái nhân viên (đang làm, chờ sếp, lỗi, rảnh, không rõ) MUST vẫn phân biệt
  được rõ ràng trong concept mới.
- **FR-032**: Quyết định concept này MUST thay thế phong cách "low-poly cách điệu" mặc định
  (Constitution Nguyên tắc V cho phép spec quyết định khác); mọi tài nguyên MUST thống nhất theo
  concept mới và có giấy phép phi thương mại được ghi nguồn.

**Font chữ**

- **FR-033**: Hệ thống MUST dùng font mới nổi bật hơn cho tiêu đề và font dễ đọc cho nội dung,
  phù hợp concept đã chọn.
- **FR-034**: Font MUST hỗ trợ đầy đủ tiếng Việt có dấu và MUST đi kèm hệ thống (hoạt động khi
  không có Internet, không tải từ dịch vụ bên ngoài — Constitution Nguyên tắc III).
- **FR-035**: Font MUST có giấy phép cho phép dùng và đóng gói kèm dự án.

**Thành phố**

- **FR-036**: Văn phòng MUST nằm giữa công viên: giữa văn phòng và đường xe chạy luôn có công viên
  (cây, cỏ, lối đi, hồ, ghế, ki-ốt) rộng ít nhất 15 m, kể cả khi văn phòng ở kích thước tối đa
  40 × 40 m; ở kích thước mặc định, đường cách văn phòng hơn 30 m. Toà nhà
  trong 5 thành phố chỉ ở vòng xa, MUST có chi tiết thực tế hơn (cửa sổ, tầng, mặt tiền, mái, vật liệu)
  theo concept đã chọn, vẫn giữ các công trình biểu tượng hiện có của từng thành phố.
- **FR-037**: Công viên MUST có ít nhất 1 ki-ốt cà phê nhìn thấy được từ góc camera mặc định. Dãy phố
  xa của mỗi thành phố MUST có ít nhất 2 quán cà phê và 2 quán ăn, nhận diện được qua biển hiệu, mái
  che và bàn ghế ngoài trời khi xoay hoặc phóng xa camera.
- **FR-038**: Ban đêm, cửa sổ toà nhà và các quán MUST sáng đèn.
- **FR-039**: Quán cà phê và quán ăn chỉ là cảnh nền, không cần tương tác.
- **FR-040**: Cây trong công viên và ven đường MUST có tán nhiều cụm lá, nhiều sắc xanh, thân có cành;
  MUST có ít nhất ba loại: cây tán rộng, cây ra hoa, cây hàng (ví dụ dừa ở Sài Gòn) theo thành phố.
- **FR-041**: Công viên MUST có lối đi bộ, ghế đá, đèn công viên, bồn hoa hoặc bụi cây.
- **FR-042**: Công viên MUST có người đi bộ và chạy bộ theo hai chiều trên lối đi, một nhóm tập thể dục,
  và ít nhất một người ngồi nghỉ. Họ dùng cùng kiểu nhân vật với nhân viên nhưng không có thẻ tên và
  không bấm vào được. Khi trời mưa, số người giảm.
- **FR-043**: Đường phố MUST có xe hơi, xe máy và xe buýt chạy hai chiều theo làn, không xe nào chồng lên
  xe nào; ban đêm xe có đèn pha và đèn hậu sáng.
- **FR-044**: Khi hiệu năng không đạt ngưỡng, chi tiết thành phố MUST được giảm trước chi tiết văn
  phòng và nhân viên.

### Key Entities

- **Lựa chọn model theo conversation**: gắn một conversation với model người dùng đã chọn và thời
  điểm chọn; là dữ liệu trải nghiệm riêng của hệ thống, không thay thế dữ liệu model của App.
- **Concept giao diện**: một phong cách có tên, mô tả bảng màu, vật liệu, ánh sáng, font, kiểu
  nhân vật, kiểu thành phố, kèm hình minh hoạ; đúng 1 concept được chọn.
- **Văn phòng**: chiều dài, chiều rộng trong giới hạn cho phép, chứa các đồ vật; là một phần của
  bố cục đã lưu.
- **Đồ vật đặt trong văn phòng**: loại đồ vật, vị trí tự do trên sàn, hướng xoay; bàn làm việc có
  thể gắn với một nhân viên.
- **Quán (cà phê / ăn)**: một công trình nền trong thành phố, có loại, biển hiệu, khu bàn ngoài
  trời, trạng thái đèn theo ngày/đêm.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các lần mở lại conversation hiển thị đúng model người dùng đã chọn lần cuối
  cho conversation đó (kiểm thử với ít nhất 5 conversation, mỗi cái một model khác nhau, qua cả
  tải lại trang).
- **SC-002**: Người dùng di chuyển một đồ vật tới vị trí mong muốn trong không quá 5 giây và
  không quá 1 lần thử.
- **SC-003**: Người dùng xếp một nhân viên vào bàn khác trong không quá 5 giây, thành công 10/10
  lần thử.
- **SC-004**: Bấm một lần vào nhân viên vẫn mở chat trong 100% các lần (không bị nhầm thành kéo).
- **SC-005**: Trong 10 phút quan sát với số nhân viên tối đa đã cam kết, không có lúc nào hai
  nhân viên chồng lấn lên nhau hoặc một nhân viên xuyên qua đồ vật.
- **SC-006**: 100% các lần va chạm có hiệu ứng va chạm nhìn thấy được, và nhân viên tiếp tục tới
  đích trong vòng 2 giây sau va chạm (trừ khi đường bị chặn hoàn toàn).
- **SC-007**: Người dùng đổi kích thước văn phòng trong không quá 15 giây; kích thước và bố cục
  được giữ nguyên 100% sau khi tải lại.
- **SC-008**: Ở kích thước văn phòng lớn nhất với số nhân viên tối đa, cảnh vẫn đạt 60 FPS trên
  máy tham chiếu.
- **SC-009**: Người dùng chọn được 1 trong 5 concept mẫu, và tự chấm concept được triển khai khớp
  với mẫu đã chọn ở mức "khớp" hoặc "rất khớp".
- **SC-010**: Không còn màn hình hay bảng nào mang phong cách hoặc font cũ (kiểm tra toàn bộ danh
  sách màn hình và chế độ).
- **SC-011**: Mọi ký tự tiếng Việt có dấu trong giao diện hiển thị bằng font mới, kể cả khi máy
  không có Internet.
- **SC-012**: Ở góc camera mặc định, mọi phía quanh văn phòng là công viên và người dùng chỉ ra được
  ki-ốt cà phê trong 10 giây; khi xoay hoặc phóng xa, chỉ ra được 2 quán cà phê và 2 quán ăn ở dãy phố
  trong 20 giây.
- **SC-013**: Trong 30 giây quan sát ban ngày (không mưa), người dùng chỉ ra được người đi bộ, người
  chạy bộ, nhóm tập thể dục, xe hơi, xe máy và xe buýt.
- **SC-014**: Cảnh vẫn đạt tối thiểu 60 FPS trên máy tham chiếu với số nhân viên tối đa đã cam kết,
  ở concept mới và thành phố mới.
- **SC-015**: Người dùng tự chấm điểm "giao diện thực tế và đẹp hơn" cao hơn giao diện hiện tại.

## Assumptions

- "Thực tế hơn" nghĩa là gần đời thực hơn về vật liệu, ánh sáng, tỉ lệ và chi tiết, không bắt buộc
  là ảnh chụp chân thực; mức độ thực tế cụ thể do concept người dùng chọn quyết định. Trang tham
  khảo (văn phòng 3D kiểu đồ chơi/hoạt hình bóng mềm, nhiều bố cục, nền thành phố đêm/nông
  thôn/biển) là nguồn cảm hứng, không sao chép tài nguyên hay nhận diện của nó.
- 5 concept mẫu là hình minh hoạ/trang xem trước để chọn, không phải 5 giao diện có thể chuyển
  đổi trong sản phẩm. Chỉ concept được chọn được triển khai.
- Chọn, kéo đồ vật và kéo nhân viên vào bàn chỉ hoạt động ở chế độ sắp xếp, để tránh thao tác
  chuột nhầm khi đang làm việc. Ở màn hình chính, bấm vào nhân viên chỉ mở chat.
- Hiệu ứng va chạm là hoạt ảnh trông thực tế ở mức văn phòng (khựng, lảo đảo, nhường đường), không
  phải mô phỏng vật lý đầy đủ; không có ngã, bị thương hay âm thanh bắt buộc.
- Giới hạn kích thước văn phòng 6–40 m mỗi chiều (hiện tại là 16 × 12 m) là mặc định hợp lý để giữ
  ngân sách hiệu năng; có thể điều chỉnh trong plan nếu đo hiệu năng cho phép.
- Văn phòng vẫn là một sàn hình chữ nhật một tầng; văn phòng nhiều tầng hay hình dạng tuỳ ý nằm
  ngoài phạm vi.
- "Vị trí bất kỳ" nghĩa là đặt tự do trên sàn văn phòng (không theo ô lưới thô), vẫn chịu các ràng
  buộc va chạm và ở trong sàn.
- Model đã chọn được lưu như dữ liệu trải nghiệm riêng của hệ thống (Constitution Nguyên tắc I),
  ưu tiên hơn model gần nhất App ghi nhận. Tên "3.8 Flash" và "4 Argon" là các model hiện có trong
  App của người dùng; danh sách model vẫn lấy từ App.
- Phạm vi thiết bị, số nhân viên tối đa, máy tham chiếu và 5 thành phố giữ nguyên như tính năng
  001.
- Quán cà phê, quán ăn mang tên và biển hiệu hư cấu, không dùng thương hiệu thật.
- Không thêm kết nối Internet mới nào (font và tài nguyên đều đóng gói kèm).
