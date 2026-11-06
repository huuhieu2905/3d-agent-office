# Quyết định: Văn phòng 3D cho agent trên Antigravity App

- **Slug**: 3d-agent-office
- **Ngày quyết định**: 2026-11-06
- **Kết luận**: **go** (làm)
- **Tài liệu đã xem xét**: intake.md, research.md, problem.md, concept.md, `.specify/memory/constitution.md` (mới là bản mẫu, chưa điền)

## Bảng chấm điểm

| Tiêu chí | Mức | Lý do |
|---|---|---|
| Vấn đề có thật và đáng giải quyết | adequate | Vấn đề có thật nhưng mang tính cá nhân và cảm xúc: thiếu cảm hứng khi làm việc với agent qua text (problem.md). Người dùng tự nói ra nhu cầu, chưa có hành vi đo được. Nhiều dự án tương tự ra đời cho thấy nhu cầu chung là có thật (research.md). |
| Độ mạnh của bằng chứng | adequate | Phần kỹ thuật quyết định tính khả thi **đã được chạy thử trực tiếp** trên máy người dùng: đọc trạng thái, chat như người dùng, `/`, `@`, dừng agent, quota (research.md). Phần "cảm hứng" mới chỉ là nhu cầu người dùng nói ra (low), và Linux chưa được kiểm chứng. Vì vậy không đạt mức strong. |
| Giá trị so với không làm | adequate | Không làm thì chức năng không mất gì, vì App vẫn hoạt động (problem.md, chi phí nếu không làm). Nhưng đây là dự án cá nhân mà người dùng chủ động muốn làm, và chưa có công cụ sẵn có nào hỗ trợ Antigravity App (research.md). Giá trị nằm ở trải nghiệm, và tiêu chí đo đã được chốt (M1 > 70%). |
| Khả thi / phù hợp ngân sách | adequate | Phương án B có quy mô **large** (nhiều tháng) và độ chắc chắn thấp. Nhưng phạm vi đã được chặn lại: tính năng chat chốt theo App 2.24.0, không đuổi theo phiên bản tương lai; công viên không mô phỏng giao thông thật; không hỗ trợ Windows. concept.md cũng có lộ trình chia đợt, đợt nào dùng được ngay. Nếu không chia đợt thì tiêu chí này sẽ là weak. |
| Phù hợp chiến lược | adequate | Khớp với mục đích của repo (`simulate-organization-claude`: mô phỏng tổ chức, agent là nhân viên). Tuy nhiên **constitution của dự án chưa được điền**, nên chưa đối chiếu được với nguyên tắc chính thức. |
| Mức kiểm soát rủi ro | adequate | Các rủi ro chính đều đã được nhận diện: phụ thuộc API nội bộ không công bố, App phải mở, App cập nhật có thể làm hỏng, Linux chưa kiểm chứng, tài nguyên 3D, quy mô lớn. Người dùng **đã chấp nhận rõ ràng** rủi ro API nội bộ và chọn chốt theo App 2.24.0. Rủi ro quy mô được giảm bằng cách chia đợt. Chưa đạt strong vì rủi ro API nội bộ chỉ được chấp nhận, không được giảm thiểu về bản chất. |

Không có tiêu chí nào ở mức `unknown`. Những điểm chưa chắc chắn (Linux, duyệt quyền, gợi ý `@`, hiệu ứng "cảm hứng" có bền không) đã được ghi lại và chuyển tiếp xuống dưới.

## Kết luận & Lý do

**Go.** Vấn đề đạt mức adequate. Bằng chứng ở phần quyết định tính khả thi là bằng chứng thực nghiệm chứ không phải giả định: mọi tính năng chính người dùng yêu cầu đều đã chạy thử được với Antigravity App 2.24.0. Người dùng đã chọn một phương án (B) với phạm vi đã được chặn. Rủi ro lớn nhất (phụ thuộc API nội bộ) đã được người dùng chấp nhận có ý thức. Rủi ro lớn thứ hai (quy mô nhiều tháng cho một dự án cá nhân) chỉ chấp nhận được với điều kiện **làm theo từng đợt, đợt nào cũng dùng được**, nên đây là điều kiện đi kèm quyết định go.

**Điều kiện đi kèm** (nên đưa vào spec và plan):
1. **Chia đợt giao hàng**, mỗi đợt dùng được ngay. Đợt đầu: văn phòng, nhân viên theo trạng thái thật, chat cơ bản. Sau mỗi đợt, đối chiếu với tiêu chí M1/M2 để quyết định có làm tiếp phần nặng (công viên, 5 thành phố, công cụ xây dựng, góc nhìn thứ nhất) hay không.
2. **Kiểm chứng Linux sớm**, trước khi cam kết hướng dẫn cài đặt cho Linux.
3. **Gom toàn bộ phần kết nối với App vào một chỗ** để khi App cập nhật chỉ phải sửa một nơi. Đây là yêu cầu ở mức nguyên tắc; cách làm cụ thể thuộc về plan.
4. **Bảo vệ thông tin tài khoản**: tên, email và CSRF token đọc được từ App không được ghi log, không lưu ra file, không gửi ra ngoài máy.

## Nếu cần làm rõ thêm

Không áp dụng (kết luận là go).

## Bàn giao cho `/speckit-specify`

- **Vấn đề**: Làm việc với nhiều AI agent trên Antigravity App chỉ qua danh sách và text nên khô khan, thiếu cảm hứng. Người dùng muốn cảm giác như đang làm "sếp" của một đội nhân viên thật, nhìn là biết ai đang làm, ai rảnh, ai cần mình.
- **Cách tiếp cận đã chọn**: **Phương án B (bản điều chỉnh)**, làm theo từng đợt.
  - Ứng dụng **chạy trên trình duyệt, chạy local**, kết nối với **Antigravity App** (không phải CLI hay IDE) trên cùng máy, qua API nội bộ của App.
  - **Trung tâm là văn phòng và nhân viên.** Mỗi conversation là một nhân viên có chỗ ngồi do người dùng chọn. Chuyển động thể hiện **trạng thái thật** (rảnh, đang nghĩ, đang làm, chờ sếp, lỗi, bị dừng), kèm chuyển động ngẫu nhiên khi rảnh (vươn vai, đi uống nước).
  - **Chat tương đương App 2.24.0** với các tính năng chính: xem đầy đủ hội thoại (gồm suy nghĩ, tool, lệnh đã chạy), gửi tin nhắn với tư cách người dùng, lệnh `/` (lệnh hệ thống và skill), `@` (nhắc file), chọn model, dừng agent, tạo conversation mới ("tuyển nhân viên"), duyệt quyền (nếu kiểm chứng được).
  - **Bảng quota nhỏ**: gói tài khoản, phần còn lại theo từng nhóm model, thời điểm reset, credits.
  - **Bối cảnh**: văn phòng nằm trong **một công viên giữa thành phố**, gồm nhiều loại cây, hoa, người đi dạo và tập thể dục, xe cộ. Có **5 thành phố** để chọn (Hà Nội, TP. Hồ Chí Minh, Singapore, Tokyo, New York), cảnh phía xa đặc trưng cho từng thành phố, và **thời tiết thật**.
  - **Người dùng tự xây văn phòng** (bàn ghế, tường, kính). Có **góc nhìn toàn cảnh** và **góc nhìn thứ nhất**. Có **chế độ sáng/tối** do người dùng chọn.
  - **Cài đặt**: chạy local, không dùng Docker, kèm **hướng dẫn cài đặt** cho máy khác.
- **Trong phạm vi / ngoài phạm vi**:
  - *Trong*: các mục ở trên. Nền tảng **macOS và Linux**.
  - *Ngoài*: thay thế phần chạy agent của App; theo kịp tính năng các phiên bản App tương lai; CLI `agy` hoặc Antigravity IDE làm nguồn dữ liệu; Windows; Docker hoặc đám mây; gom conversation từ nhiều máy; mục đích thương mại; mô phỏng giao thông hoặc đám đông thật; bản đồ thành phố chính xác; chạy khi App đóng.
- **Thước đo thành công**:
  - M1: > 70% số lần làm việc với agent là qua hệ thống, sau 2–4 tuần.
  - M2: người dùng tự chấm cảm hứng 1–5, trước và sau (định tính).
  - M3: trạng thái nhân viên chậm ≤ 2 giây so với App.
  - M4: số lần phải quay về App mỗi tuần để làm việc thường ngày.
  - M5: người mới cài xong ≤ 15 phút chỉ nhờ hướng dẫn (macOS và Linux).
  - M6: số lần App cập nhật làm hỏng kết nối, và thời gian khôi phục.
- **Câu hỏi mở chuyển tiếp**:
  - Antigravity App trên **Linux** có cùng thư mục dữ liệu, language server, API và cách lấy cổng và token như macOS không?
  - Định dạng tham số của `HandleCascadeUserInteraction` (duyệt hoặc từ chối quyền). Trạng thái `WAITING` và `ERROR` trông thế nào khi xảy ra thật?
  - Cách gợi ý file khi gõ `@` (`GetMatchingContextScopeItems`/`SearchContext` trả về rỗng).
  - Có dùng được `StreamCascadeReactiveUpdates` để nhận cập nhật theo thời gian thực (phục vụ M3) không?
  - **Project** trong App tương ứng với gì trong văn phòng (phòng ban, tầng, toà nhà)?
  - Phong cách hình ảnh (gợi ý low-poly thống nhất), số nhân viên tối đa, giờ trong ngày có theo giờ thật của thành phố không.
  - Nguồn tài nguyên 3D (cây, hoa, người, xe, nội thất, nhân vật, cảnh thành phố) và giấy phép của chúng (phi thương mại).
  - Ở góc nhìn thứ nhất người dùng được làm gì (đi lại, bấm vào bàn để mở chat…)?
  - Quota đọc từ API có khớp với số liệu App hiển thị không (người dùng đối chiếu)?
  - **Constitution** của dự án chưa được điền. Nên chạy `/speckit-constitution` trước hoặc ngay sau `/speckit-specify`.
