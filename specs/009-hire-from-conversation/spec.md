# Đặc tả tính năng: Tuyển nhân viên từ conversation có sẵn

**Feature Branch**: `009-hire-from-conversation`

**Ngày tạo**: 2026-11-11

**Trạng thái**: Bản nháp

**Đầu vào**: Mô tả của người dùng: "Tôi muốn bổ sung thêm tính năng chọn conversation cũ trong project khi tạo nhân viên/tuyển nhân viên mới (các conversation cũ được đồng bộ chính xác từ antigravity app). Từ giờ hành vi khi tạo nhân viên mới sẽ là: Chọn conversation cũ, sau đó chat tiếp từ conversation cũ (nếu chọn conversation cũ thì không cần ô giao việc đầu tiên như hiện tại); Tạo conversation mới → Giữ nguyên như hiện tại."

## Làm rõ

### Phiên 2026-11-11

- H: Nhân viên tuyển lại có được "ghim" để luôn hiện trong văn phòng không? → Đ: Có, giữ cơ chế ghim. Hơn nữa, văn phòng chứa tối đa 20 conversation do người dùng tạo hoặc chọn, không phải 20 conversation hoạt động gần nhất.
- H: Khi văn phòng đã đầy mà người dùng tuyển thêm thì sao? → Đ: Cảnh báo và yêu cầu người dùng bớt một nhân viên trước khi tuyển thêm.
- H: "Xoá nhân viên" có còn xoá conversation trong App không? → Đ: Giữ cả hai nút: "Remove from office" (chỉ đưa ra khỏi văn phòng) và "Fire" (xoá trong App như hiện tại).
- H (sửa lại câu trả lời thứ hai): Khi văn phòng đầy mà tuyển thêm thì sao? → Đ: Không chặn nữa. Nhân viên lâu không hoạt động nhất tự rời văn phòng để nhường chỗ; conversation của họ vẫn còn trong App và tuyển lại được bằng "Existing conversation".

## Bối cảnh *(hiện trạng sản phẩm, sau feature 008)*

- **Hộp thoại tuyển hiện nay**: "Hire a new employee" (mở từ nút "+ Hire employee" hoặc từ một bàn trống) hỏi Project (bắt buộc, có sẵn hoặc tạo mới), "First task for the employee" (bắt buộc) và Model. Bấm Hire sẽ tạo một conversation mới trong Antigravity App và mở chat của nó. Tuyển từ bàn trống thì nhân viên mới ngồi vào bàn đó.
- **Ai đang ở trong văn phòng hiện nay**: mọi conversation của App đều là một nhân viên, giới hạn 20 conversation hoạt động gần nhất (subagent cũng tính); số còn lại bị ẩn vào danh sách "+N more". Người dùng không chọn được ai ở trong văn phòng, và không có cách chủ động đưa một conversation cũ trở lại.
- **Sa thải (Fire) xoá conversation trong App** (cùng các subagent), nên nó không còn tồn tại ở đâu nữa.

## Kịch bản người dùng & kiểm thử *(bắt buộc)*

### User Story 1 - Tuyển lại nhân viên từ conversation có sẵn (Ưu tiên: P1)

Sếp mở hộp thoại tuyển, chọn project, chọn "Existing conversation", chọn một conversation của project đó từ App rồi xác nhận. Nhân viên của conversation đó vào văn phòng (ngồi đúng bàn đã chọn nếu tuyển từ bàn) và chat của nó mở ra với toàn bộ lịch sử, sẵn sàng để sếp nhắn tiếp.

**Vì sao ưu tiên này**: Đây là cốt lõi của tính năng: làm tiếp việc cũ ngay trong văn phòng mà không phải gõ lại ngữ cảnh.

**Kiểm thử độc lập**: Với một project có conversation chưa ở trong văn phòng, mở hộp thoại tuyển, chọn nó, bấm Hire: nhân viên bước vào, chat hiện đúng lịch sử như trong App, và tin nhắn gửi từ chat nối tiếp đúng conversation đó trong App.

**Kịch bản chấp nhận**:

1. **Cho** hộp thoại tuyển đã chọn project, **Thì** sếp chọn được giữa "New conversation" (mặc định) và "Existing conversation".
2. **Cho** đã chọn "Existing conversation", **Thì** hiện danh sách conversation của project đó lấy từ App, mỗi mục có tiêu đề và thời điểm hoạt động gần nhất, mới nhất ở trên; ô "First task" và bộ chọn Model bị ẩn và không bắt buộc.
3. **Cho** đã chọn một conversation và bấm Hire, **Thì** không có conversation mới nào được tạo trong App, hộp thoại đóng lại và chat của conversation đó mở ra với lịch sử có sẵn.
4. **Cho** conversation được chọn chưa ở trong văn phòng, **Thì** nó trở thành thành viên văn phòng: nhân viên xuất hiện trong vòng 2 giây và ở lại văn phòng bất kể các conversation khác hoạt động thế nào, cho tới khi sếp đưa họ ra.
5. **Cho** việc tuyển bắt đầu từ một bàn trống, **Thì** nhân viên ngồi vào bàn đó.
6. **Cho** sếp gửi tin nhắn trong chat vừa mở, **Thì** tin nhắn được thêm vào đúng conversation đó trong App (App hiện nó trong cùng một luồng).

---

### User Story 2 - Tuyển với conversation mới giữ nguyên như cũ (Ưu tiên: P1)

Khi chọn "New conversation" (mặc định), hộp thoại và kết quả giống hệt hiện nay, và conversation mới trở thành thành viên văn phòng.

**Vì sao ưu tiên này**: Người dùng yêu cầu giữ nguyên luồng này; đây là luồng dùng nhiều nhất.

**Kiểm thử độc lập**: Tuyển bằng "New conversation" khi văn phòng còn chỗ: cùng các trường, cùng kiểm tra hợp lệ, cùng kết quả như trước tính năng này.

**Kịch bản chấp nhận**:

1. **Cho** hộp thoại tuyển vừa mở, **Thì** "New conversation" được chọn sẵn và các trường Project, First task, Model hiện ra, bắt buộc như hiện nay.
2. **Cho** sếp chuyển sang "Existing conversation" rồi quay lại, **Thì** nội dung đã gõ trong First task và model đã chọn vẫn còn.
3. **Cho** đã tuyển một conversation mới, **Thì** nó là thành viên văn phòng (tính vào giới hạn 20).

---

### User Story 3 - Văn phòng chứa tối đa 20 nhân viên do sếp chọn (Ưu tiên: P1)

Văn phòng gồm các conversation sếp đã tạo hoặc chọn qua hộp thoại tuyển, tối đa 20. Khi văn phòng đầy mà sếp tuyển thêm, nhân viên lâu không hoạt động nhất tự rời văn phòng để nhường chỗ. Conversation của họ vẫn còn trong App và tuyển lại được bất cứ lúc nào.

**Vì sao ưu tiên này**: Người dùng yêu cầu trực tiếp; nó thay đổi ai xuất hiện trong văn phòng và giữ ngân sách 20 nhân viên.

**Kiểm thử độc lập**: Lấp đầy văn phòng tới 20 thành viên, mở hộp thoại tuyển: hộp thoại báo trước ai sẽ rời đi; bấm Hire: nhân viên mới vào, nhân viên lâu không hoạt động nhất rời đi, số đếm vẫn 20/20, và conversation của người rời đi vẫn có trong "Existing conversation". Tạo một conversation trực tiếp trong App: nó không xuất hiện trong văn phòng.

**Kịch bản chấp nhận**:

1. **Cho** văn phòng có 20 thành viên, **Khi** mở hộp thoại tuyển, **Thì** Hire vẫn dùng được ở cả hai chế độ, và hộp thoại báo trước ai sẽ rời đi, ví dụ "The office is full (20/20). Hiring will send Fix CI cache (last active 3 weeks ago) out of the office."
1a. **Cho** văn phòng có 20 thành viên, **Khi** sếp bấm Hire với một conversation mới hoặc chưa ở văn phòng, **Thì** thành viên có thời điểm hoạt động gần nhất cũ nhất rời văn phòng (bàn và ghế họp được nhả, subagent của họ rời theo), nhân viên mới vào, số đếm vẫn là 20/20, và conversation của người rời đi không bị động tới trong App.
1b. **Cho** một nhân viên vừa tự rời văn phòng, **Khi** sếp tuyển lại họ bằng "Existing conversation", **Thì** họ quay lại như mọi lần tuyển khác (và nếu văn phòng đầy thì người lâu không hoạt động nhất khác sẽ nhường chỗ).
2. **Cho** văn phòng có ít hơn 20 thành viên, **Thì** hộp thoại hiện số chỗ đã dùng (ví dụ "18/20") và tuyển bình thường.
3. **Cho** một conversation được tạo hoặc hoạt động trực tiếp trong App (không qua văn phòng), **Thì** nó không tự vào văn phòng; sếp có thể đưa nó vào sau bằng "Existing conversation".
4. **Cho** một thành viên lâu không hoạt động, **Thì** họ vẫn ở trong văn phòng (mức độ hoạt động không còn quyết định ai được hiện).
5. **Cho** văn phòng đầy và sếp chọn một conversation đã ở trong văn phòng, **Thì** Hire chỉ mở chat của họ: không ai phải rời đi.

---

### User Story 4 - Đưa nhân viên ra khỏi văn phòng mà không xoá conversation (Ưu tiên: P2)

Để nhả chỗ, sếp có thể cho một nhân viên rời văn phòng. Conversation của họ vẫn còn trong App và có thể tuyển lại sau. Sa thải (xoá conversation trong App) vẫn giữ như hiện nay.

**Vì sao ưu tiên này**: Với giới hạn cứng 20 người, việc nhả chỗ không được buộc sếp phải huỷ công việc cũ.

**Kiểm thử độc lập**: Với một nhân viên trong văn phòng, chọn "Remove from office": nhân viên rời đi, số đếm giảm 1, conversation vẫn còn trong App và hiện trong "Existing conversation" của project đó.

**Kịch bản chấp nhận**:

1. **Cho** một nhân viên trong văn phòng, **Thì** sếp có hai hành động: "Remove from office" (giữ conversation trong App) và "Fire" (xoá trong App như hiện nay, có xác nhận).
2. **Cho** sếp đưa một nhân viên ra khỏi văn phòng, **Thì** nhân viên rời đi, bàn của họ được nhả, số đếm giảm 1 và conversation trong App không bị động tới.
3. **Cho** văn phòng đầy, **Thì** sếp vẫn có thể tự chọn ai rời đi bằng "Remove from office" trước khi tuyển, thay vì để hệ thống chọn người lâu không hoạt động nhất.

---

### User Story 5 - Danh sách khớp chính xác với App (Ưu tiên: P2)

Danh sách conversation của một project hiện đúng các conversation mà Antigravity App có cho project đó, cùng tiêu đề, và phản ánh các thay đổi làm trong App.

**Vì sao ưu tiên này**: Người dùng nhấn mạnh đồng bộ chính xác với App; danh sách sai hoặc cũ sẽ khiến làm tiếp nhầm việc.

**Kiểm thử độc lập**: So danh sách của một project với danh sách conversation của project đó trong App: cùng các mục, cùng tiêu đề; đổi tên hoặc xoá một conversation trong App rồi mở lại danh sách: thay đổi hiện ra.

**Kịch bản chấp nhận**:

1. **Cho** một project, **Thì** danh sách chứa mọi conversation cấp cao nhất mà App gắn với project đó và không có gì khác (không có conversation của project khác, không có subagent).
2. **Cho** một conversation vừa được đổi tên, tạo hoặc xoá trong App, **Khi** mở danh sách (hoặc chọn lại project), **Thì** danh sách phản ánh thay đổi đó.
3. **Cho** project không có conversation nào, **Thì** danh sách báo như vậy và Hire bị khoá ở chế độ "Existing conversation".
4. **Cho** App không kết nối, **Thì** danh sách báo App không khả dụng thay vì hiện danh sách rỗng hoặc cũ.

---

### Trường hợp biên

- **Conversation đã ở trong văn phòng**: được đánh dấu "in the office"; chọn nó không nhân đôi nhân viên mà chỉ mở chat của họ (và khi tuyển từ bàn thì không đổi chỗ ngồi của họ).
- **Conversation đang chạy hoặc đang chờ sếp**: vẫn chọn được; chat mở ra đúng trạng thái hiện tại, giống như khi bấm vào nhân viên đó.
- **Conversation bị xoá trong App**: nếu bị xoá giữa lúc mở danh sách và lúc bấm Hire, Hire báo "This conversation no longer exists in the Antigravity App" và danh sách tải lại. Một thành viên bị xoá trong App thì rời văn phòng và nhả chỗ.
- **Hai lần tuyển cùng lúc khi văn phòng đầy** (ví dụ hai tab trình duyệt): các lần tuyển được xử lý lần lượt; mỗi lần cho đúng một người lâu không hoạt động nhất rời đi, nên văn phòng không bao giờ vượt 20 thành viên.
- **Người lâu không hoạt động nhất đang bận** (đang làm việc, đang suy nghĩ, hoặc đang chờ sếp trả lời): không bị cho rời đi; hệ thống chọn thành viên rảnh lâu không hoạt động nhất kế tiếp. Nếu cả 20 thành viên đều đang bận, Hire bị khoá và hộp thoại báo "The office is full (20/20) and everyone is busy. Remove an employee from the office before hiring another."
- **Người rời đi đang được mở chat**: khung chat của họ vẫn mở; họ chỉ không còn trong văn phòng (tuyển lại được).
- **Subagent**: subagent của một thành viên vẫn hiện trong văn phòng cùng conversation cha như hiện nay và không tính vào giới hạn 20 thành viên (sếp không tạo hay chọn chúng). Nếu không còn bàn trống thì chúng chờ ở sảnh như hiện nay.
- **Quá nhiều người hiện cùng lúc**: tổng số người hiện trong văn phòng (thành viên + subagent) không vượt quá 20, để giữ ngân sách hiệu năng (Nguyên tắc V). Khi vượt, các subagent ít hoạt động gần đây nhất bị ẩn trước; thành viên luôn hiện. Subagent bị ẩn hiện lại khi có chỗ.
- **Danh sách dài**: project có nhiều conversation thì danh sách cuộn được và có ô lọc theo tiêu đề.
- **Project mới tạo ngay trong hộp thoại**: chưa có conversation nên "Existing conversation" hiện trạng thái rỗng.
- **Bàn bị chiếm trong lúc chọn**: nếu bàn đã chọn bị người khác chiếm trước khi bấm Hire, nhân viên được xếp vào một bàn trống khác (như cách tuyển hiện nay).
- **Lần chạy đầu sau khi cập nhật (chuyển đổi)**: những nhân viên đang hiện trong văn phòng ngay trước khi cập nhật trở thành thành viên (tối đa 20 conversation cấp cao nhất), để văn phòng không bỗng dưng trống.

## Yêu cầu *(bắt buộc)*

### Yêu cầu chức năng

- **FR-001**: Hộp thoại tuyển PHẢI có hai chế độ: "New conversation" (mặc định) và "Existing conversation", hiện ra sau khi chọn project.
- **FR-002**: "New conversation" PHẢI giữ nguyên các trường, kiểm tra hợp lệ và kết quả như hiện nay, và conversation mới PHẢI trở thành thành viên văn phòng.
- **FR-003**: "Existing conversation" PHẢI liệt kê các conversation cấp cao nhất mà Antigravity App có cho project đã chọn, đọc từ App lúc danh sách được hiện, kèm tiêu đề và thời điểm hoạt động gần nhất, mới nhất ở trên.
- **FR-004**: Danh sách KHÔNG ĐƯỢC chứa conversation subagent, conversation của project khác, hay conversation mà App không còn.
- **FR-005**: Ở chế độ "Existing conversation", trường First task và Model KHÔNG ĐƯỢC hiện hay bắt buộc; Hire dùng được khi đã chọn một conversation.
- **FR-006**: Tuyển từ conversation có sẵn KHÔNG ĐƯỢC tạo conversation hay gửi bất kỳ tin nhắn nào tới App.
- **FR-007**: Sau khi tuyển từ conversation có sẵn, hệ thống PHẢI mở chat của conversation đó với lịch sử của nó, và tin nhắn gửi từ đó PHẢI nối tiếp đúng conversation đó trong App.
- **FR-008**: Văn phòng PHẢI chỉ hiện các conversation thành viên (được tạo hoặc chọn qua hộp thoại tuyển) và subagent của chúng; KHÔNG ĐƯỢC tự thêm conversation dựa trên mức độ hoạt động. Thành viên ở lại cho tới khi bị đưa ra, bị sa thải, hoặc bị xoá trong App.
- **FR-009**: Văn phòng PHẢI chứa tối đa 20 thành viên (không tính subagent). Khi đầy mà tuyển một conversation mới hoặc chưa là thành viên, hệ thống PHẢI cho thành viên **không bận** có thời điểm hoạt động gần nhất cũ nhất rời văn phòng (như "Remove from office": giữ conversation trong App, nhả bàn và ghế họp), rồi mới nhận người mới. Việc chọn người rời đi PHẢI do server quyết định lúc xác nhận Hire, trước khi tạo bất cứ thứ gì trong App. Nếu mọi thành viên đều bận, hệ thống KHÔNG ĐƯỢC tuyển và PHẢI báo cho sếp.
- **FR-010**: Hộp thoại tuyển PHẢI hiện số chỗ đã dùng trên 20, và khi văn phòng đầy PHẢI báo trước tên nhân viên sẽ rời đi.
- **FR-011**: Sếp PHẢI đưa được một nhân viên ra khỏi văn phòng mà không xoá conversation của họ; hành động Fire hiện có (xoá trong App) PHẢI giữ nguyên.
- **FR-012**: Thành viên mới PHẢI xuất hiện trong văn phòng trong vòng 2 giây sau khi bấm Hire; khi tuyển từ một bàn trống, họ PHẢI ngồi vào bàn đó nếu bàn còn trống.
- **FR-013**: Chọn một conversation đã là thành viên KHÔNG ĐƯỢC nhân đôi nhân viên hay tốn thêm chỗ; nó mở chat của họ.
- **FR-014**: Danh sách PHẢI hiện rõ các trạng thái: đang tải, project chưa có conversation, App không kết nối, và conversation đã biến mất lúc bấm Hire.
- **FR-015**: Danh sách PHẢI có ô lọc theo tiêu đề khi có hơn 10 conversation.
- **FR-016**: Tư cách thành viên PHẢI được lưu như dữ liệu riêng của văn phòng (conversation nào, từ khi nào, bàn nào), giữ qua các lần khởi động lại, không bao giờ lưu bản sao conversation.
- **FR-017**: Ở lần chạy đầu sau tính năng này, những nhân viên đang hiện (cấp cao nhất, tối đa 20) PHẢI trở thành các thành viên ban đầu. Việc này PHẢI chờ tới lần đọc đầu tiên mà App trả về danh sách không rỗng, để một trục trặc tạm thời không làm văn phòng trống.
- **FR-018**: Tổng số nhân viên hiện trong văn phòng, kể cả subagent, PHẢI ≤ 20. Khi thành viên cộng subagent vượt 20, hệ thống PHẢI ẩn các subagent ít hoạt động gần đây nhất trước; thành viên KHÔNG ĐƯỢC bị ẩn.

### Thực thể chính

- **Conversation (thuộc App)**: một conversation của Antigravity App; tiêu đề, project, cha (nếu là subagent), thời điểm hoạt động gần nhất, trạng thái chạy. Tính năng này chỉ đọc.
- **Tư cách thành viên văn phòng (thuộc văn phòng)**: tập hợp tối đa 20 conversation cấp cao nhất mà sếp đã tạo hoặc chọn, mỗi cái kèm thời điểm vào văn phòng và bàn ngồi. Quyết định ai ở trong văn phòng.

## Tiêu chí thành công *(bắt buộc)*

### Kết quả đo được

- **SC-001**: Sếp đưa được một conversation có sẵn vào văn phòng làm nhân viên trong chưa tới 20 giây kể từ lúc mở hộp thoại tuyển.
- **SC-002**: Với mọi project, 100% conversation trong danh sách khớp với conversation của project đó trong App (cùng tập hợp, cùng tiêu đề) lúc mở danh sách.
- **SC-003**: Tuyển từ conversation có sẵn tạo 0 conversation mới trong App.
- **SC-004**: Văn phòng không bao giờ có quá 20 thành viên; khi văn phòng đầy, mỗi lần tuyển cho đúng 1 nhân viên rời đi, và đó là thành viên rảnh lâu không hoạt động nhất ở 100% số lần.
- **SC-005**: Conversation tạo trực tiếp trong App xuất hiện trong văn phòng 0% số lần, trừ khi sếp chọn chúng.
- **SC-006**: Đưa nhân viên ra khỏi văn phòng giữ nguyên conversation trong App ở 100% trường hợp.
- **SC-007**: Ngoài nút chuyển chế độ và bộ đếm chỗ, luồng "New conversation" hoạt động như trước (các test hiện có vẫn qua, chỉ cần thêm hai phần đó).

## Giả định

- "Conversation trong project" là các conversation mà App gắn với project đó, theo đúng quy tắc văn phòng đang dùng để tô màu project.
- Subagent không bao giờ có trong danh sách và không tính vào giới hạn 20 thành viên; chúng theo conversation cha vào văn phòng như hiện nay, trong trần 20 người hiện (FR-018). Trần này bằng số người tối đa mà ngân sách 60 FPS đã được đo, nên không cần đo lại.
- Tuyển lại không đổi model của conversation; sếp vẫn chọn model theo từng tin nhắn trong chat như hiện nay.
- Danh sách "+N more" được giữ, nhưng chỉ liệt kê các subagent bị ẩn vì trần 20 người hiện (FR-018), để vẫn mở được chat của chúng. Conversation không phải thành viên không có trong danh sách này; chúng được đưa vào qua "Existing conversation".
- Không cần thay đổi gì trong Antigravity App; làm tiếp conversation dùng đúng khung chat mà văn phòng đã có cho mọi nhân viên.
