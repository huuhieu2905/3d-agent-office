# Concept: Văn phòng 3D cho agent trên Antigravity App

- **Slug**: 3d-agent-office
- **Ngày tạo**: 2026-11-06
- **Phương án được chọn**: **Phương án B, "Toàn bộ tầm nhìn"**, bản điều chỉnh ngày 2026-11-06: văn phòng trong công viên giữa thành phố, chat tương đương Antigravity App. **Người dùng đã chọn phương án này.** Trước đó tài liệu đề xuất Phương án A, phần so sánh vẫn giữ bên dưới để tham khảo.

> Tài liệu này chỉ ở mức **khái niệm**: người dùng trải nghiệm gì và phạm vi đến đâu. Kiến trúc, mô hình dữ liệu, API và danh sách công việc thuộc về `/speckit-specify` trở đi.

## Các phương án

### Phương án A — "Văn phòng đầu tiên" (lát cắt nhỏ nhất chạy được)

- **Phác thảo**: Người dùng mở trình duyệt và thấy **một văn phòng 3D ở một thành phố** (chọn sẵn một thành phố, ví dụ Hà Nội, có cảnh nhìn ra ngoài cửa kính). Mỗi conversation trong Antigravity App là **một nhân viên ngồi ở một bàn**. Nhân viên **gõ phím khi agent đang chạy**, **ngả lưng hoặc vươn vai, đi uống nước khi rảnh**, và nổi bật lên khi **vừa làm xong việc**. Người dùng **bấm vào một nhân viên** để mở khung trò chuyện: đọc câu trả lời gần nhất, **nhắn tiếp** cho nhân viên đó, hoặc **"tuyển" một nhân viên mới** (tạo conversation mới). Người dùng **kéo-thả bàn ghế** có sẵn trên một mặt bằng dạng lưới để sắp xếp văn phòng, và **chọn chỗ ngồi** cho từng nhân viên. Có **chế độ sáng/tối** và một **góc nhìn toàn cảnh** (xoay, phóng to). Hệ thống chạy local trên máy có Antigravity App, kèm **hướng dẫn cài đặt** cho máy khác.
- **Quy mô dự kiến**: **medium**, khoảng 3–5 tuần cho một người. Đây là ngân sách, không phải ước lượng. Độ chắc chắn trung bình, vì phần kết nối với App đã chạy thử được, còn phần đồ hoạ là chỗ dễ phình to.
- **Đánh đổi**:
  - **Được**: chạm tới cả 5 mục tiêu ở mức tối thiểu. Cảm hứng và cảm giác "người thật" (G1, G2) đến từ nhân viên có chuyển động. Nắm tình hình trong nháy mắt (G3) nhờ các trạng thái đã quan sát được (IDLE/RUNNING). Không phải quay về App với hai thao tác đã chạy thử là nhắn tiếp và tạo mới (G4). Dễ cài đặt (G5). Kiểm chứng được giả thuyết quan trọng nhất là *"người dùng có thực sự thấy hứng thú hơn không"* (M1, M2) **trước khi** đầu tư vào phần đồ hoạ tốn kém.
  - **Mất**: chưa có 5 thành phố, chưa có thời tiết thật, chưa có công cụ xây tường hay kính tự do, chưa có góc nhìn thứ nhất. Trải nghiệm ban đầu sẽ "nhỏ" hơn tầm nhìn.
  - **Rủi ro**: phụ thuộc vào cơ chế nội bộ của App (cổng ngẫu nhiên, CSRF token, `agentapi`). App phải đang mở. Chưa biết trạng thái "chờ duyệt quyền" và "lỗi" trông thế nào.
- **Chỗ dễ sa lầy**:
  - **Tài nguyên 3D**: tìm, chỉnh sửa và đồng bộ phong cách nhân vật, nội thất, hoạt ảnh là chỗ dễ tiêu tốn thời gian nhất. Nên dùng một bộ asset có sẵn, phong cách thống nhất (ví dụ low-poly) thay vì tự làm.
  - **Hoạt ảnh nhân vật** (đứng dậy, đi tới máy nước, quay về chỗ): tìm đường đi trong văn phòng tự sắp xếp có thể phức tạp hơn tưởng tượng.
  - **Hiển thị nội dung trò chuyện đầy đủ** (markdown, code, diff, artifact): dễ trượt thành "làm lại giao diện App". Chỉ nên hiện tóm tắt và câu trả lời gần nhất, còn lại mở App.
  - **Duyệt quyền từ bên ngoài**: chưa biết có làm được không. Không nên hứa trong phạm vi này.

### Phương án B — "Toàn bộ tầm nhìn" ✅ ĐÃ CHỌN (bản điều chỉnh 2026-11-06)

- **Phác thảo (bản đã chọn)**:
  - **Trung tâm là văn phòng và nhân viên.** Mọi thứ khác là phần làm nền.
  - **Văn phòng nằm trong một công viên giữa thành phố.** Có nhiều loại cây, hoa lá khác nhau, có **người đi dạo, tập thể dục** và **xe cộ di chuyển** trong và quanh khuôn viên. Người dùng **chọn 1 trong 5 thành phố**: phía xa là cảnh đặc trưng của thành phố đó, còn trời và cảnh vật đổi theo **thời tiết thật**.
  - **Chat tương đương Antigravity App:** bấm vào một nhân viên là mở cuộc trò chuyện đầy đủ như trong App. Người dùng gõ **`@`** để nhắc file hoặc ngữ cảnh và **`/`** để gọi lệnh, skill. Mục tiêu là **mô phỏng càng nhiều tính năng của App càng tốt** (chọn model hoặc chế độ, duyệt quyền, dừng agent, xem kết quả, lịch sử…, mức ưu tiên sẽ chốt khi specify).
  - **Phạm vi tính năng chat** (chốt 2026-11-06): chỉ các tính năng chính, **tương đồng với Antigravity App 2.24.0** đang cài, không đuổi theo phiên bản tương lai. Dựa trên những gì đã kiểm chứng: xem đầy đủ cuộc trò chuyện (gồm phần suy nghĩ, tool call, lệnh đã chạy), gửi tin nhắn, `/` (lệnh hệ thống và skill), `@` (nhắc file), chọn model, dừng agent, tạo conversation mới, và duyệt quyền (có API, cần kiểm chứng thêm).
  - **Bảng quota nhỏ**: một góc giao diện cho biết gói tài khoản, **phần quota còn lại theo từng nhóm model**, **thời điểm reset** và credits. Có thể thể hiện "đời thường" trong văn phòng (ví dụ một bảng thông báo hay màn hình trên tường), kèm một bảng chi tiết khi bấm vào.
  - Các phần còn lại giữ như ý tưởng gốc: tự xây văn phòng, nhân viên chuyển động theo trạng thái thật, góc nhìn thứ nhất và toàn cảnh, chế độ sáng/tối.
- **Phác thảo (ý tưởng gốc, để đối chiếu)**: Mọi thứ trong ý tưởng gốc. Người dùng **chọn 1 trong 5 thành phố** (Hà Nội, TP. Hồ Chí Minh, Singapore, Tokyo, New York), mỗi thành phố có **phong cảnh 3D riêng** và **thời tiết thật** (mưa, nắng, mây hiện ngoài cửa sổ). Người dùng **tự xây văn phòng** trên mặt bằng một toà nhà, gồm tường, kính và bàn ghế. Nhân viên có **chuyển động ngẫu nhiên** phong phú và phản ánh trạng thái thật. Có **góc nhìn thứ nhất** (đi lại trong văn phòng như sếp đi kiểm tra) và **góc nhìn toàn cảnh**. Tất cả thao tác với agent đều làm được trong 3D.
- **Quy mô dự kiến**: **large**, nhiều tháng cho một người. Độ chắc chắn thấp, vì riêng 5 cảnh thành phố và công cụ xây dựng đã có thể chiếm phần lớn thời gian.
- **Đánh đổi**:
  - **Được**: trải nghiệm ấn tượng nhất, khác biệt rõ nhất so với các dự án sẵn có (chưa dự án nào kết hợp thành phố thật, thời tiết thật và tự xây văn phòng, theo research.md).
  - **Mất**: rất lâu mới có thứ dùng được hằng ngày. Đầu tư lớn **trước khi** biết hiệu ứng "cảm hứng" có bền không (research.md cảnh báo hiệu ứng mới lạ có thể giảm nhanh). Dễ bỏ dở giữa chừng với dự án cá nhân.
  - **Rủi ro**: như Phương án A, cộng thêm bản quyền tài nguyên 3D cho cảnh thành phố, điều khoản dữ liệu thời tiết (Open-Meteo chỉ miễn phí cho phi thương mại và bắt buộc ghi nguồn), và hiệu năng trình duyệt trên máy yếu.
- **Chỗ dễ sa lầy**: 5 cảnh thành phố "nhận ra được"; công cụ xây dựng tự do (tường, kính, va chạm, lưu và tải lại); góc nhìn thứ nhất (điều khiển, va chạm, say chuyển động); thời tiết kết hợp ánh sáng ngày đêm theo giờ thật; tối ưu hiệu năng khi có nhiều nhân vật.
- **Chỗ dễ sa lầy mới của bản điều chỉnh**:
  - **Công viên "sống"**: nhiều loài cây và hoa, người đi bộ, tập thể dục, xe cộ có đường đi riêng. Đây gần như là **một mô phỏng thành phố thu nhỏ**, rất tốn tài nguyên 3D, hoạt ảnh và hiệu năng. Cần một mức độ chi tiết vừa phải để không lấn át văn phòng.
  - **Chat tương đương App**: rủi ro **đã giảm** vì phạm vi được chốt theo App 2.24.0 và chỉ gồm tính năng chính. Hiển thị đầy đủ các loại bước (markdown, code, diff, artifact, kết quả tool) vẫn là phần tốn công, nhưng giờ đã có điểm dừng.
  - **`@` và `/`**: **đã kiểm chứng chạy được** qua API nội bộ `SendUserCascadeMessage`, và lấy được danh sách lệnh `/` qua `GetSlashCommands`. Còn thiếu: **gợi ý file khi gõ `@`** (API trả về rỗng, chưa tìm ra cách gọi đúng), nên có thể phải tự liệt kê file trong workspace.
  - **Phụ thuộc hoàn toàn vào API nội bộ của App**: mọi tính năng chính (chat như người dùng, `/`, `@`, dừng, quota) đều đi qua API HTTPS nội bộ (`exa.language_server_pb.LanguageServerService`), Google không công bố. Rủi ro hỏng khi App cập nhật **vẫn còn**, nhưng việc chốt theo bản 2.24.0 đã biến rủi ro này thành **một quyết định có ý thức**: nếu App cập nhật làm hỏng thì sửa theo, hoặc giữ nguyên phiên bản App.
  - **Duyệt quyền**: có API (`HandleCascadeUserInteraction`) nhưng chưa thử được vì App đang tự chạy lệnh. Chưa biết định dạng tham số.

### Phương án C — "Mở rộng dự án có sẵn" (mua hoặc kế thừa thay vì tự xây)

- **Phác thảo**: Lấy một dự án mã nguồn mở có sẵn như **agent-office-3d, Roster hay Claw3D** (research.md) và **thêm phần kết nối với Antigravity App**. Người dùng có ngay một văn phòng 3D hoặc pixel đã có nhân vật, hoạt ảnh và trạng thái. Sau đó tuỳ biến dần theo sở thích.
- **Quy mô dự kiến**: **small → medium**, vài ngày đến 2 tuần, *nếu* dự án đó có chỗ cắm thêm nguồn dữ liệu mới và giấy phép cho phép. Độ chắc chắn thấp, vì chưa đọc trực tiếp mã nguồn của các dự án này (research.md chỉ dựa trên đoạn trích tìm kiếm).
- **Đánh đổi**:
  - **Được**: nhanh nhất để có thứ dùng được. Kiểm chứng giả thuyết "cảm hứng" với chi phí thấp nhất.
  - **Mất**: phong cách hình ảnh và trải nghiệm bị giới hạn bởi dự án gốc, khó đạt "bắt mắt, đúng ý mình" (trọng tâm của intake). Thành phố, thời tiết và tự xây văn phòng có thể không hợp với kiến trúc có sẵn. Phải theo kịp dự án gốc khi họ cập nhật.
  - **Rủi ro**: giấy phép (chưa kiểm chứng; Roster được ghi là MIT); chất lượng và mức độ duy trì của dự án gốc; nhiều dự án chỉ là bản thử nghiệm.
- **Chỗ dễ sa lầy**: chỉnh sửa sâu vào mã của người khác để đạt đúng tầm nhìn. Đến một lúc nào đó, việc này còn tốn hơn tự làm.

### Phương án D — "Không làm" (để so sánh)

- **Phác thảo**: Tiếp tục dùng Antigravity App như hiện tại.
- **Quy mô dự kiến**: không có.
- **Đánh đổi**: không tốn công và không có rủi ro phụ thuộc vào cơ chế nội bộ của App. Nhưng không giải quyết vấn đề cảm hứng (problem.md: chi phí nếu không làm là thấp về chức năng, có thật về trải nghiệm).
- **Chỗ dễ sa lầy**: không có.

## Quyết định của người dùng (2026-11-06)

**Người dùng chọn Phương án B**, bản điều chỉnh: văn phòng và nhân viên là trung tâm, xung quanh là công viên trong 1 trong 5 thành phố, có thời tiết thật, và chat tương đương Antigravity App với `@` và `/`.

**Quy mô cập nhật**: **large**, nhiều tháng cho một người. Độ chắc chắn **thấp**. So với B gốc, bản điều chỉnh **lớn hơn** vì thêm công viên "sống" và chat tương đương App.

**Lời khuyên để giảm rủi ro nhưng vẫn giữ tầm nhìn B** (không thay đổi lựa chọn, chỉ là cách đi):

1. **Làm theo từng đợt, đợt nào cũng dùng được ngay.** Thứ tự gợi ý: (1) văn phòng, nhân viên và chat cơ bản; (2) `@` và `/`, các tính năng App quan trọng nhất; (3) công viên và một thành phố; (4) thời tiết thật và 5 thành phố; (5) công cụ xây dựng tự do; (6) góc nhìn thứ nhất. Thứ tự cụ thể sẽ chốt khi specify.
2. **Chốt một danh sách tính năng App "bắt buộc" có giới hạn** trước khi specify, thay vì để "càng nhiều càng tốt". Phần còn lại cho phép **mở conversation trong App** khi cần.
3. **Kiểm chứng sớm `@` và `/` cùng các thao tác ngoài 3 lệnh đã biết** (duyệt quyền, dừng agent). Đây là điều kiện để mục tiêu "chat như App" khả thi.
4. **Định mức độ chi tiết cho công viên**: nhiều cây, hoa và người, nhưng phong cách đơn giản, thống nhất (ví dụ low-poly), để văn phòng vẫn là trung tâm và máy vẫn chạy mượt.

## Đề xuất ban đầu (trước khi người dùng chọn, giữ để tham khảo)

**Chọn Phương án A, "Văn phòng đầu tiên", và coi Phương án B là lộ trình mở rộng theo từng đợt.**

Lý do, gắn với mục tiêu và thước đo trong problem.md:

- **Kiểm chứng điều quan trọng nhất trước.** Giá trị của dự án nằm ở cảm hứng (G1), một thứ chưa được chứng minh. A cho phép đo M1 (mức độ sử dụng thực tế) và M2 (tự chấm cảm hứng) sau vài tuần, trước khi đổ nhiều tháng vào thành phố, thời tiết và công cụ xây dựng.
- **Đứng trên phần đã kiểm chứng.** Đọc trạng thái IDLE/RUNNING, tạo conversation và gửi tin nhắn đều **đã chạy thử thành công** với App (research.md). A chỉ hứa những gì đã chứng minh được, nên M3 và M4 khả thi.
- **Giữ đúng trọng tâm "giao diện bắt mắt".** Khác với C, A giữ quyền kiểm soát hoàn toàn phong cách hình ảnh, vốn là điều intake nhấn mạnh nhất.
- **Lộ trình mở rộng rõ ràng.** Mỗi đợt sau là một phần của B và có thể dừng ở bất kỳ đợt nào nếu thước đo cho thấy không đáng làm tiếp. Thứ tự gợi ý (sẽ quyết định khi specify):
  1. thêm thành phố và thời tiết thật
  2. công cụ xây tường, kính tự do
  3. góc nhìn thứ nhất
  4. hiển thị trạng thái "chờ duyệt" và "lỗi" khi đã tìm ra tín hiệu

**Nên làm thêm một việc nhỏ trước khi specify:** dành khoảng nửa ngày đọc trực tiếp mã nguồn của 1–2 dự án ở Phương án C (ví dụ agent-office-3d, Roster) để **học cách họ thể hiện trạng thái và hoạt ảnh**, hoặc tái sử dụng một phần nếu giấy phép cho phép. Đây không phải chọn C, mà để A tránh lặp lại sai lầm của người đi trước.

## Ngoài phạm vi (cho Phương án B đã chọn)

- **Không thay thế phần "chạy agent" của App.** Agent vẫn chạy trong Antigravity App, và hệ thống chỉ là giao diện khác cho App. App phải đang mở.
- **Không cam kết bằng 100% tính năng của App.** Chỉ cam kết danh sách tính năng "bắt buộc" sẽ chốt khi specify. Tính năng nào chưa có thì mở conversation trong App.
- Không nhằm tăng năng suất hay đo chi phí agent.
- Không hỗ trợ CLI `agy` hay bản Antigravity IDE làm nguồn dữ liệu.
- Không dùng Docker, không triển khai đám mây.
- Không gom conversation từ nhiều máy về một chỗ.
- Không dùng cho mục đích thương mại (đã xác nhận 2026-11-06).
- **Không hỗ trợ Windows.** Chỉ macOS và Linux (đã chốt 2026-11-06).
- **Không mô phỏng giao thông hay đám đông thật.** Người và xe trong công viên chỉ để trang trí, đi theo các đường định sẵn, không tương tác với người dùng.
- **Không tái hiện thành phố chính xác về bản đồ.** Mỗi thành phố chỉ có cảnh đặc trưng phía xa (nhận ra được), không phải bản đồ 3D thật.

## Ngoài phạm vi (cho Phương án A, giữ để tham khảo)

Kế thừa từ problem.md:

- Không thay thế Antigravity App. Không làm lại xem diff, quản lý cấu hình agent hay model.
- Không nhằm tăng năng suất hay đo chi phí agent.
- Không hỗ trợ CLI `agy` hay bản Antigravity IDE làm nguồn dữ liệu.
- Không dùng Docker, không triển khai đám mây.
- Không gom conversation từ nhiều máy về một chỗ.
- Không dùng cho mục đích thương mại (chờ xác nhận).

Mới loại trừ cho Phương án A (để dành cho các đợt sau):

- **Chọn thành phố**: chỉ một thành phố cố định, chưa có 5 thành phố.
- **Thời tiết thật**: chưa có. Phong cảnh ngoài cửa sổ là tĩnh, chỉ đổi theo chế độ sáng/tối.
- **Công cụ xây dựng tự do** (tường, kính, đổi hình dạng mặt bằng): chưa có. Chỉ sắp xếp đồ nội thất có sẵn trên mặt bằng cố định.
- **Góc nhìn thứ nhất**: chưa có. Chỉ có góc nhìn toàn cảnh.
- **Duyệt hoặc từ chối quyền, dừng agent, lưu trữ conversation** từ giao diện 3D: chưa có (chưa kiểm chứng được là làm được).
- **Hiển thị trạng thái "chờ duyệt" và "lỗi"**: chưa có (chưa tìm ra tín hiệu trong dữ liệu).
- **Hiển thị đầy đủ nội dung trò chuyện** (code, diff, artifact): chưa có. Chỉ hiện tóm tắt và câu trả lời gần nhất, kèm cách mở conversation trong App.
- **Hỗ trợ Windows và Linux**: chưa cam kết, chỉ macOS trước (chờ xác nhận hệ điều hành của các máy khác).

## Giả định cần kiểm chứng

### Cho Phương án B đã chọn (ưu tiên kiểm chứng trước)

1. ~~`@` và `/` có tác dụng~~ → **Đã kiểm chứng** qua `SendUserCascadeMessage`. Còn lại: tìm cách gợi ý file khi gõ `@`.
2. ~~Có cách làm các thao tác ngoài 3 lệnh đã biết~~ → **Dừng agent, chọn model, quota đã kiểm chứng.** Còn lại: **duyệt hoặc từ chối quyền** (`HandleCascadeUserInteraction`) cần thử khi App ở chế độ hỏi quyền.
3. ~~Đọc được đầy đủ nội dung conversation~~ → **Đã kiểm chứng**: `GetCascadeTrajectorySteps` trả về JSON đầy đủ từng bước.
3b. **API nội bộ của App 2.24.0 giữ ổn định** trong suốt thời gian phát triển. Người dùng chấp nhận việc **giữ nguyên hoặc sửa theo** khi App cập nhật.
3c. **Quota đọc từ `GetUserStatus` khớp với những gì App hiển thị** (cần người dùng đối chiếu).
3d. **Antigravity App trên Linux hoạt động giống macOS**: cùng thư mục `~/.gemini/antigravity/`, cùng language server, cùng API nội bộ và cùng cách lấy cổng và CSRF token từ tham số tiến trình. **Chưa kiểm chứng.** Cần thử trên một máy Linux sớm, trước khi viết hướng dẫn cài đặt.
4. **Trình duyệt chạy mượt** cả văn phòng nhiều nhân viên lẫn công viên có cây, người và xe chuyển động, trên máy cấu hình phổ thông.
5. **Có bộ tài nguyên 3D** (cây, hoa, người, xe, nội thất, nhân vật có hoạt ảnh, cảnh thành phố) với phong cách thống nhất và giấy phép phù hợp.
6. **Người dùng duy trì được động lực** qua một dự án nhiều tháng. Làm theo từng đợt, đợt nào dùng được ngay, là cách giảm rủi ro này.
7. Các giả định 4, 5, 6 của Phương án A bên dưới (cơ chế kết nối ổn định, App phải mở, đọc trạng thái đủ nhanh) **vẫn áp dụng**.

### Cho Phương án A (giữ để tham khảo)

Các giả định mà đề xuất ban đầu dựa vào:

1. **Cảm hứng đến từ nhân viên có chuyển động theo trạng thái, không nhất thiết từ thành phố và thời tiết.** Nếu sai, tức người dùng chỉ thấy hứng thú khi có cảnh thành phố, thì A sẽ chưa đủ và phải đưa thành phố lên sớm hơn.
2. **Hai trạng thái IDLE/RUNNING đã đủ để nhân viên "có hồn"** ở đợt đầu, chưa cần "chờ duyệt" hay "lỗi".
3. **Nhắn tiếp và tạo conversation mới là hai thao tác "thường ngày" quan trọng nhất.** Nếu người dùng thường xuyên phải duyệt quyền, M4 sẽ không đạt được với A.
4. **Cơ chế kết nối với App (`agentapi`, cổng ngẫu nhiên, CSRF token) vẫn hoạt động trong vài phiên bản App tới**, và việc tự dò lại cổng và token mỗi lần App khởi động là làm được một cách ổn định.
5. **Người dùng chấp nhận hệ thống chỉ thao tác được khi Antigravity App đang mở.**
6. **Đọc trạng thái đủ nhanh và nhẹ** để bắt kịp những lần RUNNING ngắn (khoảng 3,5 giây trong lần thử) mà không làm chậm máy hay ảnh hưởng tới App.
7. **Có sẵn một bộ tài nguyên 3D** (nhân vật có hoạt ảnh và nội thất văn phòng) với phong cách thống nhất và giấy phép phù hợp cho dự án cá nhân, không cần tự dựng.
8. **Trình duyệt trên máy cấu hình phổ thông chạy mượt** một văn phòng với khoảng 10–20 nhân viên (quy mô chưa được xác nhận).
9. **Hướng dẫn cài đặt local trên macOS là đủ** cho "các máy khác" ở đợt đầu.
