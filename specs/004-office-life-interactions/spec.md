# Feature Specification: Đời sống văn phòng — tương tác đồ vật, đi ra công viên, xoá nhân viên

**Feature Branch**: `004-office-life-interactions`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Sửa lại giao diện ở phần panel 'Chú giải dự án': bổ sung nút để ẩn panel này, tránh việc có nhiều project làm panel tràn màn hình. Ở chế độ giao diện thứ nhất (góc nhìn thứ nhất), bổ sung tương tác với đồ vật trong văn phòng: bật tắt màn hình treo tường, nằm nghỉ trên sofa, uống nước, tưới cây. Cho phép điều khiển nhân vật đi ra ngoài phạm vi văn phòng, bổ sung cửa văn phòng để nhân viên và người dùng di chuyển ra ngoài. Bổ sung hành động cho nhân viên khi rảnh: uống nước, đi ra quán cà phê, tạp hoá trong công viên; ngồi lên sofa ngủ hoặc nghỉ ngơi ngắn, khi có việc thì quay lại chỗ ngồi. Bổ sung các quán hàng quanh công viên; nhân viên chỉ cần đi ra và giả vờ ngồi vào quán / đứng gần quán một lúc, không cần thao tác mua hàng hay tương tác với chủ quán. Bổ sung action xoá nhân viên ra khỏi văn phòng: chỉ xoá nhân viên ra khỏi giao diện, và được phép xoá conversation ra khỏi project."

## Clarifications

### Session 2026-11-09

- Q: Khi chọn "xoá conversation ra khỏi project", hệ thống làm gì với conversation trong App? → A: Xoá vĩnh viễn conversation trong App, có xác nhận rõ ràng.
- Q: "Chế độ giao diện thứ nhất" (nơi người dùng điều khiển nhân vật) là chế độ nào? → A: Góc nhìn thứ nhất (phím V); ở toàn cảnh chỉ bật/tắt được màn hình treo tường.
- Q: Thao tác "Xoá nhân viên" có những lựa chọn nào? → A: Một thao tác duy nhất: xoá vĩnh viễn conversation trong App (có xác nhận) rồi nhân viên rời văn phòng; không có lựa chọn chỉ ẩn nhân viên.
- Q: Xoá nhân viên khi agent đang chạy hoặc đang chờ thì xử lý thế nào? → A: Không cho xoá; nút xoá bị khoá kèm lời nhắc dừng agent trước; hệ thống không tự dừng agent.
- Q: Xoá conversation có subagent con thì sao? → A: App xoá luôn mọi subagent con (người dùng xác nhận sau khi lập plan).
- Q: Khi trời mưa hoặc bão, nhân viên rảnh có ra quán không? → A: Không; chỉ chọn hoạt động trong nhà. Ai đang ở ngoài khi trời bắt đầu mưa/bão thì cầm ô và chạy nhanh về văn phòng. Sương mù, ban đêm vẫn ra bình thường.

## User Scenarios & Testing *(mandatory)*

Các câu chuyện được sắp theo thứ tự ưu tiên và thứ tự giao hàng (Constitution, Nguyên tắc IV).
Hai việc nhỏ, dùng hằng ngày (ẩn panel chú giải, xoá nhân viên) làm trước; phần "đời sống văn
phòng" nặng hơn làm sau và chia đợt.

### User Story 1 - Thu gọn panel "Chú giải dự án" (Priority: P1)

Khi văn phòng có nhiều dự án, panel "Chú giải dự án" dài ra và che mất cảnh hoặc tràn khỏi màn
hình. Người dùng bấm một nút trên panel để thu gọn nó thành một nút nhỏ; bấm lại để mở ra. Khi
đang mở mà danh sách dài hơn chỗ trống, panel tự giới hạn chiều cao và cho cuộn bên trong, không
bao giờ tràn ra ngoài màn hình. Trạng thái thu gọn/mở được nhớ qua các lần tải lại trang.

**Why this priority**: Lỗi hiển thị đang gặp mỗi ngày khi có nhiều dự án, sửa nhỏ, giá trị ngay.

**Independent Test**: Tạo đủ nhiều dự án có nhân viên để panel dài hơn màn hình; kiểm tra panel
không tràn, thu gọn được, mở lại được, và giữ trạng thái sau khi tải lại trang.

**Acceptance Scenarios**:

1. **Given** panel đang mở, **When** người dùng bấm nút thu gọn, **Then** panel chỉ còn một nút
   nhỏ (có nhãn hoặc biểu tượng dễ hiểu, ví dụ "Dự án") và cảnh 3D phía sau không bị che.
2. **Given** panel đang thu gọn, **When** người dùng bấm nút đó, **Then** panel mở ra với đầy đủ
   danh sách dự án như trước.
3. **Given** có 20 dự án đang có nhân viên, **When** panel mở, **Then** panel nằm trọn trong màn
   hình (kể cả cửa sổ trình duyệt thấp 600 px) và cuộn được để xem hết.
4. **Given** người dùng đã thu gọn panel, **When** tải lại trang, **Then** panel vẫn thu gọn.
5. **Given** một dự án đang được làm nổi bật, **When** thu gọn panel, **Then** việc làm nổi bật
   vẫn giữ nguyên và nút thu gọn cho thấy đang có một dự án được làm nổi bật.

---

### User Story 2 - Xoá nhân viên (Priority: P1)

Người dùng muốn dọn văn phòng: một nhân viên ứng với conversation đã xong việc hoặc không còn
dùng. Từ khung chat của nhân viên đó, người dùng chọn "Xoá nhân viên". Đây là **một thao tác duy
nhất**: conversation bị xoá vĩnh viễn trong Antigravity App và nhân viên rời văn phòng (đi ra cửa
rồi biến mất), bàn được trả lại. Vì không hoàn tác được, hệ thống luôn hỏi xác nhận rõ ràng trước.

**Why this priority**: Văn phòng chỉ đầy lên chứ không bao giờ vơi đi; người dùng không có cách
dọn dẹp. Làm sớm để người dùng kiểm soát được số nhân viên (cũng giúp giữ hiệu năng).

**Independent Test**: Với một conversation thử nghiệm, chọn "Xoá nhân viên", xác nhận, kiểm tra
nhân viên rời văn phòng, bàn trống lại, conversation không còn trong App, và tải lại trang nhân
viên không quay lại. Thử lại khi App đang đóng để kiểm tra không có gì bị xoá.

**Acceptance Scenarios**:

1. **Given** người dùng chọn "Xoá nhân viên", **When** hộp xác nhận hiện ra, **Then** hộp này nêu
   rõ tên conversation, rằng conversation sẽ bị xoá vĩnh viễn trong Antigravity App, số subagent con
   sẽ bị xoá theo (nếu có), và nút xác nhận khác biệt rõ với nút huỷ (mặc định là huỷ).
2. **Given** người dùng bấm huỷ, **When** hộp xác nhận đóng, **Then** không có gì thay đổi.
3. **Given** người dùng xác nhận, **When** App xoá thành công, **Then** nhân viên đi ra cửa và biến
   mất, bàn của họ trở thành bàn trống, conversation không còn trong App, và tải lại trang nhân
   viên không xuất hiện lại.
4. **Given** người dùng xác nhận, **When** App báo lỗi hoặc đang mất kết nối, **Then** nhân viên
   vẫn ở lại, người dùng thấy thông báo lỗi dễ hiểu và không có gì bị xoá nửa vời.
5. **Given** nhân viên đang làm việc (agent đang chạy) hoặc đang chờ duyệt quyền / trả lời,
   **When** người dùng mở khung chat, **Then** nút "Xoá nhân viên" bị khoá kèm lời nhắc "Dừng agent
   trước khi xoá"; **When** agent đã dừng hoặc xong việc, **Then** nút dùng được trở lại.
6. **Given** hộp xác nhận đang mở, **When** agent bắt đầu chạy (ví dụ người dùng gửi việc từ App),
   **Then** hệ thống không xoá và báo lý do.

---

### User Story 3 - Nhân viên có đời sống khi rảnh, ra công viên và quán hàng (Priority: P2)

Khi rảnh, nhân viên không chỉ vươn vai hay ra bình nước như trước mà có thêm các hoạt động ngắn:
uống nước ở bình nước, ngồi nghỉ hoặc ngả lưng ngủ trên sofa, đi ra khỏi văn phòng qua cửa chính
để tới một quán hàng quanh công viên (quán cà phê, tạp hoá, quán nước...) rồi ngồi ở bàn của quán
hoặc đứng gần quán một lúc, sau đó đi về. Ngay khi nhân viên có việc (trạng thái chuyển sang làm
việc, chờ duyệt, chờ trả lời...), họ bỏ hoạt động đang làm và quay về bàn của mình.

Công viên có thêm vài quán hàng nhỏ đặt quanh rìa, cùng phong cách với cảnh hiện có. Quán chỉ là
nơi để nhân viên ghé; không có mua bán, không có chủ quán tương tác.

**Why this priority**: Đây là phần làm văn phòng "sống" và tạo cảm hứng (mục tiêu của dự án),
nhưng không chặn việc dùng hằng ngày, nên làm sau hai câu chuyện P1.

**Independent Test**: Bật chế độ thử với khoảng nghỉ ngắn; quan sát vài nhân viên rảnh lần lượt
uống nước, nằm sofa, đi ra quán; trong lúc một nhân viên đang ở quán, gửi việc cho họ và kiểm tra
họ quay về bàn và trạng thái hiển thị đúng ngay lập tức.

**Acceptance Scenarios**:

1. **Given** một nhân viên rảnh đã đến lượt nghỉ, **When** hệ thống chọn hoạt động, **Then** hoạt
   động là một trong: vươn vai tại chỗ, uống nước, nghỉ trên sofa (ngồi hoặc ngả lưng ngủ), ghé
   một quán ngoài công viên; mỗi lần nghỉ chỉ một hoạt động.
2. **Given** nhân viên chọn ghé quán, **When** họ di chuyển, **Then** họ đi qua cửa chính văn
   phòng (không xuyên tường), theo lối đi trong công viên, tới đúng một quán, ngồi vào chỗ ngồi
   của quán hoặc đứng cạnh quán trong một khoảng thời gian ngắn, rồi đi về đúng bàn của mình.
3. **Given** sofa đang có người dùng hoặc nhân viên khác chiếm, **When** một nhân viên chọn nghỉ
   sofa, **Then** họ chọn chỗ khác còn trống hoặc hoạt động khác, không ngồi chồng lên nhau.
4. **Given** nhân viên đang ở quán, trên đường, hoặc đang ngủ trên sofa, **When** conversation của
   họ chuyển sang trạng thái có việc, **Then** trong ≤ 2 giây biểu tượng/nhãn trạng thái trên đầu
   nhân viên đổi đúng trạng thái mới, nhân viên dừng hoạt động và bắt đầu đi về bàn, và về tới bàn
   trong ≤ 30 giây.
5. **Given** nhân viên đang ở ngoài văn phòng, **When** người dùng bấm vào họ (một lần), **Then**
   khung chat mở như khi họ ngồi ở bàn.
6. **Given** văn phòng không có sofa hoặc bình nước, **When** đến lượt nghỉ, **Then** nhân viên
   chỉ chọn các hoạt động có đồ vật tương ứng.
7. **Given** công viên, **When** người dùng quan sát, **Then** có ít nhất 3 quán hàng nhỏ quanh
   rìa công viên (ít nhất một quán cà phê và một tạp hoá), không chắn lối đi, không đè lên khoảng
   trống dành cho mở rộng văn phòng.
8. **Given** thời tiết trong cảnh là mưa hoặc bão, **When** nhân viên rảnh đến lượt nghỉ, **Then** họ
   chỉ chọn hoạt động trong nhà; **When** trời chuyển sang mưa/bão lúc có nhân viên đang ở ngoài,
   **Then** trong ≤ 2 giây họ cầm ô, rời quán và chạy nhanh về văn phòng.
9. **Given** cùng lúc có nhiều nhân viên rảnh, **When** quan sát trong 10 phút, **Then** số nhân
   viên ở ngoài văn phòng cùng lúc không bao giờ vượt giới hạn của FR-024.

---

### User Story 4 - Góc nhìn thứ nhất: tương tác với đồ vật và đi ra ngoài (Priority: P3)

Ở góc nhìn thứ nhất, người dùng nhắm vào một đồ vật và bấm (hoặc nhấn phím tương tác) để dùng nó:

- **Màn hình treo tường**: bật / tắt. Trạng thái bật tắt được nhớ.
- **Sofa**: ngồi xuống hoặc nằm nghỉ; góc nhìn hạ xuống tương ứng; di chuyển hoặc nhấn lại phím
  tương tác để đứng dậy.
- **Bình nước**: uống nước (một hiệu ứng ngắn).
- **Cây**: tưới cây (một hiệu ứng ngắn, cây trông tươi hơn một lúc).
- **Cửa văn phòng**: tự mở khi tới gần, đi qua được.

Khi nhắm vào một đồ vật dùng được, màn hình hiện gợi ý ngắn (ví dụ "E — Bật màn hình"). Người dùng
có thể đi qua cửa chính ra ngoài công viên, đi dạo quanh công viên và các quán hàng, rồi quay lại
văn phòng. Nhân vật của người dùng không đi xuyên tường, đồ vật, quán hàng hay nhân viên, và không
đi ra khỏi rìa khu công viên.

**Why this priority**: Tăng cảm giác "sống trong văn phòng" nhưng là phần phụ của góc nhìn thứ
nhất, vốn đã là tính năng ưu tiên thấp (Constitution, Nguyên tắc IV). Phụ thuộc vào cửa đi qua
được và quán hàng của US3.

**Independent Test**: Vào góc nhìn thứ nhất, lần lượt bật tắt màn hình, ngồi/nằm sofa rồi đứng
dậy, uống nước, tưới cây; đi ra cửa, đi tới một quán ngoài công viên rồi quay về văn phòng.

**Acceptance Scenarios**:

1. **Given** ở góc nhìn thứ nhất, **When** người dùng nhắm vào một đồ vật dùng được trong phạm vi
   khoảng 2 m, **Then** gợi ý thao tác hiện ra; nhắm ra chỗ khác thì gợi ý biến mất.
2. **Given** đang nhắm vào màn hình treo tường đang bật, **When** người dùng tương tác, **Then**
   màn hình tắt; tương tác lần nữa thì bật lại; tải lại trang vẫn giữ trạng thái đó.
3. **Given** đang nhắm vào sofa còn chỗ, **When** người dùng tương tác, **Then** góc nhìn chuyển
   về tư thế ngồi/nằm trên sofa; **When** người dùng nhấn phím đi lại hoặc tương tác lần nữa,
   **Then** nhân vật đứng dậy ngay cạnh sofa.
4. **Given** đang nhắm vào bình nước hoặc cây, **When** người dùng tương tác, **Then** có một hiệu
   ứng ngắn (dưới 3 giây) và người dùng điều khiển lại được ngay sau đó.
5. **Given** người dùng đi tới cửa chính, **When** đi tiếp, **Then** cửa tự mở và người dùng
   ra được công viên; đi qua chỗ khác trên tường hoặc kính thì bị chặn.
6. **Given** người dùng ở ngoài công viên, **When** đi tới rìa ngoài cùng của khu vực, **Then** bị
   chặn lại một cách tự nhiên, không rơi ra khỏi cảnh.
7. **Given** người dùng ở ngoài văn phòng, **When** nhắm vào một nhân viên đang ghé quán và bấm,
   **Then** khung chat với nhân viên đó mở ra.
8. **Given** ở chế độ toàn cảnh, **When** người dùng bấm nút bật/tắt dưới màn hình treo tường,
   **Then** màn hình bật/tắt (ngoài chế độ sắp xếp); bấm vào màn hình quota vẫn mở bảng quota; các tương
   tác khác chỉ có ở góc nhìn thứ nhất.

---

### Edge Cases

- Nhân viên đang ở ngoài công viên thì người dùng xoá nhân viên đó: nhân viên đi thẳng ra rìa công
  viên gần nhất rồi biến mất, không quay lại văn phòng.
- Người dùng bật chế độ sắp xếp trong lúc nhân viên đang ở ngoài hoặc trên sofa: mọi nhân viên đang
  nghỉ đứng dậy ngay và đi về bàn, nên thao tác sắp xếp không bị chặn; sofa vừa có người vẫn kéo đi
  được.
- Người dùng xoá hoặc di chuyển sofa / bình nước / cây trong lúc có nhân viên đang dùng: nhân viên
  dừng hoạt động và về bàn.
- Đổi vị trí cửa văn phòng hoặc mở rộng văn phòng khi có nhân viên ở ngoài: nhân viên tìm đường
  về qua cửa mới.
- Người dùng (góc nhìn thứ nhất) đứng chắn cửa: nhân viên chờ hoặc đi vòng như với vật cản khác,
  không xuyên qua người dùng.
- Mất kết nối App trong lúc nhân viên ở ngoài: trạng thái hiển thị "mất kết nối" như hiện tại,
  nhân viên đi về bàn rồi đứng yên.
- Trời tạnh khi nhân viên đang chạy về: họ vẫn về văn phòng (không quay lại quán), lần nghỉ sau mới
  được ra ngoài lại.
- Mọi quán đều đã đủ người ghé: nhân viên chọn hoạt động khác trong văn phòng.
- Xoá conversation thất bại một phần (App xoá xong nhưng hệ thống chưa kịp cập nhật): khi đồng bộ
  lại thấy conversation không còn, nhân viên rời văn phòng bình thường.
- Panel chú giải đang thu gọn khi chỉ còn 0 dự án có nhân viên: panel và nút đều ẩn như hiện tại.
- Conversation bị xoá ngay trong App (không qua hệ thống): nhân viên rời văn phòng như khi xoá từ
  hệ thống.

## Requirements *(mandatory)*

### Functional Requirements

**Panel chú giải dự án (US1)**

- **FR-001**: Panel "Chú giải dự án" PHẢI có nút thu gọn/mở; khi thu gọn chỉ còn một nút nhỏ.
- **FR-002**: Khi mở, panel PHẢI không bao giờ vượt quá vùng hiển thị; nội dung dài PHẢI cuộn được
  bên trong panel.
- **FR-003**: Trạng thái thu gọn/mở PHẢI được nhớ qua các lần tải lại trang.
- **FR-004**: Khi thu gọn mà đang có dự án được làm nổi bật, nút thu gọn PHẢI cho thấy điều đó
  (ví dụ chấm màu của dự án).

**Xoá nhân viên (US2)**

- **FR-010**: Mỗi nhân viên PHẢI có thao tác "Xoá nhân viên", truy cập được từ khung chat của nhân
  viên đó và không nằm trên đường bấm một lần để mở chat (Constitution, Nguyên tắc V).
- **FR-011**: "Xoá nhân viên" là một thao tác duy nhất: xoá vĩnh viễn conversation trong App, rồi
  nhân viên rời văn phòng. KHÔNG có lựa chọn chỉ ẩn nhân viên mà giữ conversation.
- **FR-013**: Hệ thống PHẢI chỉ xoá conversation sau khi người dùng xác nhận một hộp thoại nêu rõ tên
  conversation và tính không hoàn tác được (nút mặc định là huỷ). Hệ thống KHÔNG được tự xoá
  conversation trong bất kỳ trường hợp nào khác.
- **FR-014**: Nhân viên chỉ rời văn phòng sau khi App xác nhận đã xoá. Nếu App xoá thất bại hoặc mất
  kết nối, nhân viên PHẢI ở lại và người dùng PHẢI thấy thông báo lỗi; không có trạng thái xoá nửa
  vời.
- **FR-015**: Khi nhân viên đang làm việc hoặc đang chờ người dùng (duyệt quyền, trả lời câu hỏi),
  thao tác xoá PHẢI bị khoá kèm lời nhắc dừng agent trước; hệ thống KHÔNG tự dừng agent. Trạng thái
  PHẢI được kiểm tra lại ngay trước khi xoá, và nếu agent đang chạy thì không xoá.
- **FR-016**: Xoá một conversation thì App xoá luôn mọi subagent con của nó. Các nhân viên con PHẢI
  cùng rời văn phòng và trả lại bàn. Chặn xoá ở FR-015 áp dụng cho cả cha lẫn mọi con.
- **FR-018**: Khi nhân viên rời văn phòng, bàn của họ PHẢI trở thành bàn trống dùng được cho nhân
  viên khác.

**Đời sống nhân viên khi rảnh (US3)**

- **FR-020**: Khi đến lượt nghỉ, nhân viên rảnh PHẢI chọn một trong các hoạt động: vươn vai, uống
  nước ở bình nước, nghỉ trên sofa (ngồi hoặc ngả lưng ngủ), ghé một quán ngoài công viên. Hoạt
  động chỉ được chọn khi đồ vật/quán tương ứng tồn tại và còn chỗ.
- **FR-021**: Mỗi hoạt động nghỉ PHẢI ngắn: nghỉ sofa và ghé quán kéo dài trong khoảng 20–90 giây
  ở nơi đến (không tính đường đi); sau đó nhân viên về đúng bàn của mình.
- **FR-022**: Nhân viên PHẢI ra vào văn phòng chỉ qua cửa chính và đi theo lối đi trong công viên,
  không xuyên tường, kính, đồ vật, quán hàng hay người khác.
- **FR-023**: Khi conversation của một nhân viên rời trạng thái "rảnh" sang bất kỳ trạng thái nào
  trừ "mất kết nối" (đang suy nghĩ, đang làm việc, chờ sếp, lỗi, đã dừng, không rõ), nhãn trạng thái
  của nhân viên PHẢI đổi trong ≤ 2 giây ở bất cứ đâu họ đang đứng (Constitution, Nguyên tắc I), nhân
  viên PHẢI dừng hoạt động ngay và chạy về bàn trong ≤ 30 giây. "Mất kết nối" xử lý theo FR-028.
- **FR-024**: Số nhân viên ở ngoài văn phòng cùng lúc PHẢI bị giới hạn (mặc định tối đa 1/3 số
  nhân viên, ít nhất 1); mỗi chỗ ngồi ở sofa hoặc quán chỉ có một người.
- **FR-025**: Bấm một lần vào nhân viên đang ở bất cứ đâu (sofa, đường đi, quán) PHẢI mở khung chat.
- **FR-026**: Công viên PHẢI có ít nhất 3 quán hàng nhỏ quanh rìa (ít nhất một quán cà phê, một tạp
  hoá), mỗi quán có ít nhất một chỗ để nhân viên ngồi hoặc đứng, cùng phong cách concept đã chốt,
  không chắn lối đi và không lấn vào khoảng trống mở rộng văn phòng.
- **FR-027**: Quán hàng chỉ là bối cảnh: KHÔNG có giao dịch mua bán, tiền, kho hàng hay hội thoại
  với chủ quán.
- **FR-028**: Khi có thay đổi làm mất nơi nhân viên đang dùng (sofa bị xoá/di chuyển, vào chế độ
  sắp xếp, mất kết nối App), nhân viên PHẢI dừng hoạt động và về bàn.
- **FR-029**: Khi thời tiết trong cảnh là mưa hoặc bão, nhân viên KHÔNG được chọn hoạt động ghé quán.
  Nhân viên đang ở ngoài khi trời chuyển mưa/bão PHẢI cầm ô (hiệu ứng nhìn thấy được) và chạy nhanh
  về văn phòng rồi về bàn; ô biến mất khi vào trong. Sương mù và ban đêm không chặn hoạt động ngoài
  trời.

**Góc nhìn thứ nhất (US4)**

- **FR-030**: Ở góc nhìn thứ nhất, khi nhắm vào một đồ vật dùng được trong phạm vi khoảng 2 m, hệ
  thống PHẢI hiện gợi ý thao tác và cho phép tương tác bằng bấm chuột hoặc một phím tương tác.
- **FR-031**: Màn hình treo tường PHẢI bật/tắt được; trạng thái mỗi màn hình được nhớ qua các lần
  tải lại trang. Mặc định mọi màn hình bật (màn hình đầu tiên hiện quota như từ 001). Ở chế độ toàn
  cảnh (ngoài chế độ sắp xếp), mỗi màn hình có một nút bật/tắt nhỏ; bấm vào màn hình quota vẫn mở bảng
  quota như trước.
- **FR-032**: Sofa PHẢI cho người dùng ngồi hoặc nằm nghỉ (góc nhìn hạ theo tư thế) và đứng dậy khi
  di chuyển hoặc tương tác lại; không ngồi vào chỗ đã có nhân viên.
- **FR-033**: Bình nước và cây PHẢI có tương tác uống nước / tưới cây với hiệu ứng ngắn dưới 3 giây,
  không khoá điều khiển lâu hơn thời gian đó.
- **FR-034**: Cửa chính văn phòng PHẢI tự mở khi người dùng hoặc nhân viên tới gần (trong khoảng
  1.5 m) để đi qua, và tự đóng khi không còn ai; tường và kính vẫn chặn.
- **FR-035**: Người dùng PHẢI đi được khắp công viên và tới các quán hàng, bị chặn bởi đồ vật, quán,
  cây lớn, nhân viên và rìa ngoài của khu vực; không được rơi ra khỏi cảnh.
- **FR-036**: Hướng dẫn phím ở góc nhìn thứ nhất PHẢI được cập nhật để nêu phím tương tác.

**Chung**

- **FR-040**: Tất cả tính năng mới PHẢI giữ ngân sách ≥ 60 FPS với số nhân viên tối đa đã cam kết
  (Constitution, Nguyên tắc V); quán hàng và hiệu ứng mới PHẢI giảm chi tiết được theo mức chi tiết
  hiện có.
- **FR-041**: Mọi dữ liệu mới hệ thống lưu (trạng thái panel, trạng thái màn hình)
  PHẢI chỉ là dữ liệu riêng của trải nghiệm 3D, không sao chép dữ liệu conversation của App.

### Key Entities *(include if feature involves data)*

- **Hoạt động nghỉ (Break activity)**: loại (vươn vai, uống nước, sofa, ghé quán), nơi đến, thời
  lượng ở nơi đến. Chỉ tồn tại trong lúc chạy, không lưu.
- **Quán hàng (Shop)**: loại (cà phê, tạp hoá, quán nước...), vị trí quanh công viên, các chỗ ngồi
  hoặc đứng cho nhân viên. Là bối cảnh cố định, không do người dùng đặt.
- **Trạng thái đồ vật tương tác (Interactive item state)**: màn hình treo tường bật/tắt, gắn với
  đồ vật trong bố cục văn phòng.
- **Tuỳ chọn giao diện**: panel chú giải thu gọn hay mở.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Với 20 dự án có nhân viên, panel chú giải không bao giờ tràn khỏi màn hình (cửa sổ cao
  từ 600 px), và người dùng thu gọn / mở được bằng 1 lần bấm.
- **SC-002**: Người dùng xoá một nhân viên trong ≤ 3 lần bấm kể từ khi mở chat của nhân viên đó;
  100% lần xoá thất bại (App lỗi hoặc mất kết nối) để lại nhân viên và conversation nguyên vẹn.
- **SC-003**: Không có conversation nào bị xoá trong App mà không có xác nhận rõ ràng của người dùng
  (kiểm tra bằng kiểm thử và rà soát mọi đường xoá).
- **SC-004**: Trong 30 phút quan sát với ≥ 6 nhân viên rảnh (khoảng nghỉ rút ngắn để thử), mỗi loại
  hoạt động nghỉ (uống nước, sofa, ghé quán) xuất hiện ít nhất một lần, và không có lần nào nhân
  viên đi xuyên tường, ngồi chồng lên nhau hoặc kẹt quá 5 giây.
- **SC-005**: 100% lần nhân viên có việc trong lúc đang nghỉ (kể cả đang ở quán), nhãn trạng thái
  đúng trong ≤ 2 giây và nhân viên về tới bàn trong ≤ 30 giây.
- **SC-006**: Ở góc nhìn thứ nhất, người dùng dùng được cả 4 loại tương tác (màn hình, sofa, nước,
  cây), đi qua cửa tự mở, và đi được từ bàn làm việc tới một quán ngoài công viên rồi về trong ≤ 2 phút mà không
  bị kẹt.
- **SC-007**: Cảnh vẫn đạt ≥ 60 FPS trên máy tham chiếu với số nhân viên tối đa, kể cả khi số nhân
  viên ngoài công viên ở mức tối đa cho phép.

## Assumptions

- "Chế độ giao diện thứ nhất" trong yêu cầu là **góc nhìn thứ nhất** (nút "🚶 Góc nhìn thứ nhất",
  phím V) đã có từ feature 001 (đã chốt ở Clarifications 2026-11-09). Chế độ toàn cảnh không có
  nhân vật người dùng; chỉ thêm bật/tắt màn hình treo tường (FR-031).
- "Xoá conversation ra khỏi project" là **xoá vĩnh viễn conversation trong Antigravity App** (đã
  chốt ở Clarifications 2026-11-09; App có thao tác xoá conversation). Không có thao tác "chuyển conversation sang project
  khác" hay "gỡ conversation khỏi project mà vẫn giữ" trong phạm vi này.
- Xoá conversation là thao tác do người dùng chủ động và được xác nhận, phù hợp Nguyên tắc III của
  Constitution. Khi phát triển và kiểm thử, chỉ xoá conversation thử nghiệm được đặt tên rõ ràng.
- Văn phòng đã có một cửa chính trong vỏ văn phòng (vị trí đổi được); tính năng này làm cửa đó đi
  qua được chứ không thêm cửa thứ hai.
- Nhịp nghỉ giữ như hiện tại (khoảng 5 ± 2 phút); chỉ thêm loại hoạt động. Tỉ lệ chọn giữa các
  hoạt động là chi tiết thiết kế, quyết định trong plan.
- Bàn ghế của quán hàng là bối cảnh cố định do hệ thống đặt, không xuất hiện trong công cụ sắp xếp
  văn phòng.
- Trạng thái "tưới cây" chỉ là hiệu ứng tạm thời, không mô phỏng cây héo hay cần tưới định kỳ.
- Nhân vật người dùng ở góc nhìn thứ nhất không bị nhân viên khác nhìn thấy như một nhân vật có
  hình dáng; chỉ cần là vật cản để nhân viên đi vòng.
- Các tài nguyên 3D mới (quán hàng, chỗ ngồi, hiệu ứng) theo concept "Soft Studio · Sài Gòn" và có
  giấy phép phi thương mại được ghi nguồn.
