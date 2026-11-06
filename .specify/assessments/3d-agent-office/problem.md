# Định nghĩa vấn đề: Làm việc với AI agent trên Antigravity App khô khan, thiếu cảm hứng

- **Slug**: 3d-agent-office
- **Ngày tạo**: 2026-11-06
- **Đầu vào đã dùng**: intake.md, research.md (gồm kiểm tra và chạy thử trực tiếp trên máy người dùng)

## Phát biểu vấn đề

Người dùng giao việc và theo dõi nhiều AI agent trên Antigravity App. Hiện tại họ chỉ làm việc qua **danh sách và những đoạn text**, nên trải nghiệm khô khan, không tạo cảm hứng. Người dùng cũng không có cảm giác mình đang dẫn dắt một "đội ngũ" có tình trạng làm việc nhìn thấy được. Vấn đề không nằm ở chỗ thiếu chức năng (App vẫn làm được mọi việc), mà nằm ở **động lực và cảm xúc khi làm việc với agent hằng ngày**.

> Lưu ý: ý tưởng ban đầu được đưa ra dưới dạng giải pháp ("văn phòng 3D, thành phố, thời tiết…"). Vấn đề phía sau mà giải pháp đó muốn giải quyết là **cảm hứng và cảm giác làm việc với "người thật"**, theo đúng lời người dùng: "thay vì đọc các đoạn text khô khan thì mình có cảm giác như đang tương tác với người thật (nhân viên)". — [intake.md]

## Người dùng & Các bên liên quan

- **Người dùng chính**: chủ dự án. Đây là một lập trình viên dùng Antigravity App (2.24.0) trên macOS để làm việc với AI agent. Họ bị ảnh hưởng trực tiếp: mỗi ngày đọc text để biết agent nào đang làm, agent nào rảnh, agent nào cần mình. — [intake.md, research.md]
- **Người dùng tiềm năng**: ~~những người dùng Antigravity App khác~~ → **Đã chốt (2026-11-06): trước mắt chỉ chủ dự án**, trên **macOS và Linux**. "Máy khác" là các máy macOS hoặc Linux có cài Antigravity App. — [intake.md]
- **Các bên liên quan**:
  - **Chủ dự án**: vừa là người dùng, vừa là người quyết định và tự đầu tư thời gian (dự án cá nhân). — [intake.md]
  - **Google / Antigravity App**: không phải người quyết định, nhưng **ảnh hưởng trực tiếp đến tính khả thi**. Cơ chế kết nối dựa vào phần nội bộ không công bố, nên mỗi lần App cập nhật đều có thể làm thay đổi điều kiện. — [research.md]
  - **Nhà cung cấp dữ liệu và tài nguyên bên ngoài** (dữ liệu thời tiết, tài nguyên 3D): có điều khoản bản quyền và ghi nguồn cần tuân thủ. — [research.md: Open-Meteo CC BY 4.0, chỉ miễn phí cho phi thương mại]

## Mục tiêu

- **G1 — Cảm hứng**: Người dùng *muốn* mở hệ thống để làm việc với agent và thấy hứng thú hơn so với dùng App gốc. — [intake.md]
- **G2 — Cảm giác "người thật"**: Mỗi conversation được nhận biết và đối xử như một "nhân viên" có danh tính và chỗ làm, có tình trạng làm việc nhìn thấy được. Người dùng có cảm giác mình là "sếp" của một đội. — [intake.md]
- **G3 — Nắm tình hình trong nháy mắt**: Người dùng nhận ra ngay agent nào đang làm, agent nào rảnh, agent nào cần mình, mà **không phải đọc text**. Thông tin này phải **trung thực** với trạng thái thật trong App. — [intake.md câu trả lời #3; research.md: đã quan sát được IDLE/RUNNING]
- **G4 — Không phải quay về App** (mở rộng ngày 2026-11-06): Người dùng **làm việc với agent ngang bằng như trong Antigravity App**: trò chuyện, ra lệnh bằng `@` và `/`, và dùng được **càng nhiều tính năng của App càng tốt** mà không phải chuyển sang App gốc. — [intake.md câu trả lời #2 và cập nhật 2026-11-06; research.md: đã chạy thử tạo conversation và gửi tin nhắn, chưa kiểm chứng `@` và `/`]
- **G6 — Biết còn bao nhiêu quota** (thêm ngày 2026-11-06): người dùng theo dõi được quota của tài khoản Antigravity (theo model hoặc nhóm model, thời điểm reset, credits) ngay trong hệ thống, không cần mở App. — [intake.md; research.md: `GetUserStatus` đã trả về đủ dữ liệu]
- **G5 — Dễ mang sang máy khác**: Một người khác có thể tự cài và dùng trên máy có Antigravity App, chỉ cần làm theo hướng dẫn. — [intake.md: bỏ Docker, chạy local, kèm hướng dẫn cài đặt]

## Ngoài phạm vi (Non-Goals)

- **Không thay thế phần "chạy agent" của Antigravity App.** App vẫn là nơi agent thực sự chạy, và hệ thống chỉ là một giao diện khác cho App. ~~Không làm lại các tính năng phức tạp của App~~: **đã bỏ ngày 2026-11-06**, vì người dùng muốn mô phỏng càng nhiều tính năng của App càng tốt (xem G4). — [intake.md]
- **Không theo kịp tính năng của các phiên bản App tương lai.** Phạm vi tính năng được chốt theo **Antigravity App 2.24.0** đang cài trên máy, và chỉ gồm các tính năng chính người dùng đã nêu. — [intake.md, cập nhật 2026-11-06]
- **Không tăng năng suất hay tối ưu chi phí agent.** Mục tiêu là trải nghiệm và cảm hứng, không phải đo hay cải thiện hiệu suất của agent. — [intake.md]
- **Không hỗ trợ CLI `agy` hay bản Antigravity IDE** như nguồn dữ liệu. Chỉ hỗ trợ Antigravity App. — [intake.md, cập nhật 2026-11-06]
- **Không dùng Docker hay triển khai đám mây.** Hệ thống chạy local. — [intake.md]
- **Không gom conversation từ nhiều máy về một chỗ.** Mỗi máy chỉ làm việc với Antigravity App của chính máy đó, trừ khi người dùng làm rõ khác. — [research.md, ASSUMPTION; xem Câu hỏi mở]
- **Không hướng tới mục đích thương mại.** Đây là dự án cá nhân (đã xác nhận 2026-11-06). — [intake.md]
- **Không hỗ trợ Windows** (đã chốt 2026-11-06). Chỉ macOS và Linux. — [intake.md]
- **Không có giải pháp thay thế khi App đóng hoặc API nội bộ đổi.** Người dùng chấp nhận rủi ro này (2026-11-06). — [intake.md]

## Thước đo thành công

Đây là dự án cá nhân với mục tiêu cảm xúc, nên nhiều thước đo là **định tính** và được ghi rõ là định tính.

- **M1 — Mức độ sử dụng thực tế** (định lượng): tỷ lệ phiên làm việc với agent mà người dùng chọn mở hệ thống mới thay vì chỉ dùng App gốc, đo trong 2–4 tuần sau khi bắt đầu dùng. (Baseline: 0%. **Mục tiêu: > 70%**, đã chốt 2026-11-06)
- **M2 — Cảm hứng** (định tính): người dùng tự đánh giá mức hứng thú khi làm việc với agent theo thang 1–5, so giữa trước và sau. (Baseline: [CẦN LÀM RÕ: người dùng tự chấm trải nghiệm App gốc hiện tại])
- **M3 — Độ trung thực của trạng thái** (định lượng): tỷ lệ thời gian mà tình trạng hiển thị của "nhân viên" khớp với trạng thái thật trong App, và độ trễ từ lúc App đổi trạng thái đến lúc người dùng thấy. (Baseline: chưa có. Tham chiếu: trong lần thử, App ở trạng thái `RUNNING` khoảng 3,5 giây, nên độ trễ phải nhỏ hơn nhiều mới bắt kịp. **Mục tiêu: độ trễ ≤ 2 giây**, đã chốt 2026-11-06)
- **M4 — Không phải quay về App** (định lượng): số lần người dùng phải mở App gốc để làm một việc thường ngày mà hệ thống không làm được, đếm theo tuần. (Baseline: 100% thao tác đang làm trong App. Mục tiêu: [CẦN LÀM RÕ: những thao tác nào là "thường ngày"?])
- **M5 — Dễ cài đặt** (định lượng): thời gian để một người lần đầu cài và chạy được trên máy khác đã có Antigravity App, chỉ dựa vào hướng dẫn và không cần hỏi thêm. (Baseline: chưa có. **Mục tiêu: ≤ 15 phút** trên macOS và Linux, đã chốt 2026-11-06)
- **M6 — Khả năng chịu cập nhật** (định lượng): số lần App cập nhật làm hệ thống mất kết nối, và thời gian để khôi phục. (Baseline: chưa có. Research đã ghi nhận đây là rủi ro chính.)

## Chi phí nếu không làm

**Thấp về chức năng, có thật về trải nghiệm.** Nếu không làm gì, người dùng vẫn làm việc bình thường với Antigravity App: mọi chức năng đều còn đó và không có việc nào bị chặn. Cái mất đi là **động lực và cảm hứng**: trải nghiệm tiếp tục là đọc danh sách và text. Ngoài ra, người dùng có thể dùng thử một trong các dự án "văn phòng cho AI agent" sẵn có (Claw3D, Roster, agent-office-3d, …), nhưng **chưa dự án nào được ghi nhận là hỗ trợ Antigravity App**. — [research.md]

Đây là mốc để `/speckit-assess-decide` so sánh: lợi ích chủ yếu là cảm xúc và trải nghiệm cá nhân, phải đặt cạnh khối lượng công việc lớn và rủi ro phụ thuộc vào cơ chế nội bộ của App.

## Câu hỏi mở

Các câu hỏi chuyển từ intake và research, cộng thêm câu hỏi mới phát sinh khi định nghĩa vấn đề:

**Về người dùng và mục tiêu**
- ~~Đối tượng sử dụng, hệ điều hành, mục đích thương mại, ngưỡng thành công~~ → **Đã chốt 2026-11-06**: chỉ chủ dự án; macOS và Linux; phi thương mại; M1 > 70%, M3 ≤ 2 giây, M5 ≤ 15 phút.
- [CẦN LÀM RÕ: Trên **Linux**, Antigravity App có cùng thư mục dữ liệu (`~/.gemini/antigravity/`), cùng language server và API nội bộ như trên macOS không? Hiện **chỉ mới kiểm chứng trên macOS**.]
- [CẦN LÀM RÕ: Mức ưu tiên giữa M1 (sử dụng) và M2 (cảm hứng tự chấm), cùng baseline của M2. Có thể để sang lúc dùng thử.]

**Về trạng thái và thao tác**
- [CẦN LÀM RÕ: Trong các tính năng của Antigravity App, tính năng nào **bắt buộc** phải có, tính năng nào là "có thì tốt"? Ví dụ: chat, `@` (nhắc file hoặc ngữ cảnh), `/` (skill, workflow), chọn model hoặc chế độ, duyệt quyền, dừng agent, xem diff, artifact, lịch sử, lưu trữ.]
- [CẦN LÀM RÕ: Lệnh `@` và `/` khi gửi qua `agentapi send-message` có được agent hiểu như khi gõ trong App không? Hay việc mở rộng các lệnh này do giao diện App tự làm? — chưa kiểm chứng]
- [CẦN LÀM RÕ: Trạng thái "chờ duyệt quyền" và "lỗi" thể hiện thế nào trong dữ liệu của App? Duyệt quyền từ bên ngoài có làm được không? — chuyển từ research.md]
- [CẦN LÀM RÕ: Project trong App tương ứng với khái niệm nào trong trải nghiệm của người dùng (phòng ban, tầng, toà nhà)? — chuyển từ intake.md]
- [CẦN LÀM RÕ: Người dùng có chấp nhận việc hệ thống chỉ thao tác được khi App đang mở, và có thể ngừng hoạt động sau mỗi lần App cập nhật không? — chuyển từ research.md]

**Về trải nghiệm hình ảnh**
- [CẦN LÀM RÕ: Phong cách hình ảnh mong muốn (low-poly/cách điệu hay chân thực), và hệ thống cần chạy mượt trên cấu hình máy nào? — chuyển từ intake.md]
- [CẦN LÀM RÕ: Thời gian trong ngày của cảnh có theo giờ thật của thành phố được chọn không? — chuyển từ intake.md]
- [CẦN LÀM RÕ: Quy mô dự kiến: bao nhiêu conversation hiển thị cùng lúc? — chuyển từ intake.md]
- [CẦN LÀM RÕ: Tài nguyên 3D (thành phố, nội thất, nhân vật) lấy từ đâu, và có ràng buộc bản quyền không? — chuyển từ intake.md]
