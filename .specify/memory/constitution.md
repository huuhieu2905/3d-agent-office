# Simulate Organization (3D Agent Office) Constitution

## Core Principles

### I. Antigravity App là nguồn sự thật duy nhất

- Antigravity App là nơi agent thực sự chạy và là nguồn dữ liệu duy nhất cho conversation,
  trạng thái, project, model và quota. Hệ thống KHÔNG ĐƯỢC tự chạy agent, tự gọi model hay
  lưu một bản sao "chính thức" của conversation.
- Mọi thứ hiển thị cho người dùng (trạng thái nhân viên, nội dung chat, quota) PHẢI phản ánh
  trung thực dữ liệu của App. Trạng thái nhân viên PHẢI cập nhật chậm không quá 2 giây so với
  App. Khi không chắc chắn về trạng thái, hệ thống PHẢI hiển thị là "không rõ" thay vì đoán.
- Dữ liệu hệ thống tự lưu chỉ được là dữ liệu riêng của trải nghiệm 3D (bố cục văn phòng, vị
  trí bàn, lựa chọn thành phố, cài đặt giao diện), không trùng lặp dữ liệu của App.

**Lý do**: Phép ẩn dụ "nhân viên" chỉ có giá trị khi nó trung thực. Nếu hiển thị sai trạng
thái, người dùng mất niềm tin và phải quay về App, nghĩa là dự án thất bại.

### II. Lớp kết nối App được cô lập

- Mọi giao tiếp với Antigravity App (API HTTPS nội bộ `LanguageServerService`, dò cổng, lấy
  CSRF token, đọc file trong `~/.gemini/antigravity/`) PHẢI nằm trong **một lớp kết nối duy
  nhất** (adapter). Phần còn lại của hệ thống chỉ được dùng các khái niệm của miền nghiệp vụ
  (nhân viên, cuộc trò chuyện, trạng thái, quota), KHÔNG ĐƯỢC gọi API nội bộ hay đọc file của
  App trực tiếp.
- Lớp kết nối PHẢI nhắm tới **danh sách phiên bản App đã kiểm chứng**, ghi rõ mỗi phiên bản
  được kiểm chứng trên **hệ điều hành nào**. Danh sách hiện gồm, trên macOS: **2.29.0** (kiểm
  chứng 2026-11-09, feature `003-antigravity-2-29-compat`) và **2.24.0** (giữ lại để hỗ trợ máy
  chưa cập nhật). Trên Linux: **chưa có** phiên bản nào. Danh sách này PHẢI nằm ở **một nơi duy
  nhất** trong lớp kết nối.
  - **Mã nguồn** và mọi **thông báo hiển thị cho người dùng** (cảnh báo phiên bản, log ở
    terminal) PHẢI lấy phiên bản từ danh sách đó, KHÔNG ĐƯỢC ghi cứng số phiên bản.
  - **Tài liệu, script cài đặt và kiểm thử** được phép nêu số phiên bản cụ thể, vì chúng không
    đọc được danh sách lúc chạy, và kiểm thử cần giá trị cụ thể để so sánh. Nhưng chúng PHẢI được
    cập nhật **trong cùng một thay đổi** với danh sách, để không bao giờ lệch nhau.
- Một phiên bản chỉ được thêm vào danh sách **cho một hệ điều hành** sau khi, trên đúng hệ điều
  hành đó: (1) bộ dữ liệu mẫu ghi từ chính bản đó đã được thêm vào kiểm thử hợp đồng và chạy
  qua, và (2) kiểm thử với App thật, gồm cả thao tác **đọc và ghi** và tự kết nối lại, đã chạy
  qua trên bản đó. Bỏ một phiên bản khỏi danh sách
  cũng PHẢI được ghi lại lý do.
- Khi khởi động, lớp kết nối PHẢI kiểm tra phiên bản App. Với bản ngoài danh sách, hệ thống vẫn
  chạy nhưng PHẢI cảnh báo rõ ràng, nêu cả bản đang chạy lẫn các bản đã kiểm chứng. Hệ thống
  không có nghĩa vụ hỗ trợ tính năng của các phiên bản chưa kiểm chứng.
- Khi App tự cập nhật lên bản mới, PHẢI rà soát tương thích bằng thao tác **chỉ đọc** trước khi
  sửa code. Rà soát xem phiên bản, các API nội bộ đang dùng còn hay mất, định dạng dữ liệu thêm
  hay bớt gì, và loại bước nào chưa được nhận ra.
- Khi App đóng, đổi cổng hoặc API thay đổi, hệ thống PHẢI suy giảm có kiểm soát: hiển thị
  trạng thái mất kết nối, tự kết nối lại khi App mở lại, KHÔNG ĐƯỢC treo hay hỏng dữ liệu cục bộ.
- Lớp kết nối PHẢI có kiểm thử dựa trên dữ liệu mẫu ghi lại từ App thật, đã loại bỏ thông tin
  cá nhân, để phát hiện ngay khi App cập nhật làm thay đổi định dạng.

**Lý do**: API nội bộ không được công bố và có thể đổi bất cứ lúc nào. Người dùng đã chấp
nhận rủi ro này, với điều kiện chỉ phải sửa ở một nơi. App tự cập nhật và người dùng không chọn
được phiên bản (2026-11-08: 2.24.0 → 2.29.0). Vì vậy cam kết với đúng một phiên bản cố định là
không thực tế; cam kết với danh sách bản đã kiểm chứng thì vẫn giữ được tính trung thực.

### III. Local-first, bảo mật và riêng tư

- Hệ thống PHẢI chạy hoàn toàn trên máy người dùng. Server local PHẢI chỉ lắng nghe trên
  `127.0.0.1`, không mở ra mạng ngoài.
- CSRF token của App, tên, email tài khoản và nội dung conversation KHÔNG ĐƯỢC ghi vào log,
  lưu ra file, đưa vào thông báo lỗi hay gửi ra khỏi máy. Token chỉ được giữ trong bộ nhớ.
- Kết nối ra Internet duy nhất được phép là lấy dữ liệu thời tiết công khai (không gửi dữ
  liệu người dùng). Mọi kết nối ra ngoài mới PHẢI được ghi rõ trong spec và được duyệt.
- Thao tác thay đổi trạng thái agent (gửi tin nhắn, tạo conversation, dừng, duyệt quyền) PHẢI
  do người dùng chủ động thực hiện. Hệ thống KHÔNG ĐƯỢC tự động gửi lệnh tới agent.

**Lý do**: Hệ thống đọc được toàn bộ hội thoại và thông tin tài khoản Antigravity. Lộ token
hay nội dung là rủi ro nghiêm trọng hơn mọi lợi ích về trải nghiệm.

### IV. Giao hàng theo từng đợt dùng được

- Công việc PHẢI được chia thành các đợt. Kết thúc mỗi đợt, hệ thống PHẢI dùng được hằng ngày
  từ đầu đến cuối, không có tính năng "làm dở" chặn việc sử dụng.
- Đợt đầu tiên PHẢI ưu tiên trung tâm của trải nghiệm: văn phòng, nhân viên theo trạng thái
  thật, chat cơ bản. Các phần nặng (công viên "sống", 5 thành phố, thời tiết, công cụ xây
  dựng tự do, góc nhìn thứ nhất) chỉ được làm sau khi đợt trước đã dùng được.
- Sau mỗi đợt, PHẢI đối chiếu với các thước đo thành công (tỷ lệ sử dụng > 70%, cảm hứng tự
  chấm, độ trễ trạng thái ≤ 2 giây) để quyết định làm tiếp, điều chỉnh hay dừng.
- Mỗi tính năng PHẢI có lý do gắn với mục tiêu trong `problem.md`. Tính năng không phục vụ mục
  tiêu nào thì không làm (YAGNI).

**Lý do**: Phạm vi đã chọn là "large", nhiều tháng cho một người. Chia đợt là điều kiện kèm
theo quyết định "go" để tránh bỏ dở và để kiểm chứng sớm giả thuyết "cảm hứng".

### V. Trải nghiệm là trọng tâm, có ngân sách hiệu năng

- Văn phòng và nhân viên PHẢI luôn là trung tâm thị giác. Bối cảnh xung quanh (công viên, cây,
  người, xe, thành phố, thời tiết) chỉ làm nền và KHÔNG ĐƯỢC lấn át hay làm chậm phần chính.
- Mọi tài nguyên 3D PHẢI theo một phong cách thống nhất, là concept đã chốt trong
  `specs/002-realistic-ui-refresh/concept-decision.md` ("Soft Studio · Sài Gòn") trừ khi một spec
  sau quyết định khác, và PHẢI có giấy phép cho phép dùng phi thương mại, được ghi lại nguồn và
  giấy phép.
- Cảnh 3D PHẢI đạt tối thiểu **60 FPS** trên trình duyệt của một máy cấu hình phổ thông (máy
  tham chiếu sẽ được ghi rõ trong plan) với số nhân viên tối đa mà spec cam kết. Tính năng làm
  tụt dưới ngưỡng này PHẢI có cơ chế giảm chi tiết hoặc tắt được.
- Ngưỡng 60 FPS hiện **chỉ áp dụng cho macOS**. Trên Linux, hiệu năng chưa được đo và chưa là
  cổng chất lượng; muốn áp dụng cho Linux PHẢI có một spec riêng và một lần sửa constitution.
- Mở cuộc trò chuyện với một nhân viên PHẢI chỉ cần **đúng 1 lần bấm** vào nhân viên đó từ màn
  hình chính.

**Lý do**: Giá trị cốt lõi của dự án là cảm hứng và trải nghiệm. Đẹp mà giật lag hay khó dùng
thì người dùng sẽ quay về App.

### VI. Cài đặt đơn giản trên macOS và Linux

- Hệ thống PHẢI chạy được trên **macOS** và **Linux**. Windows nằm ngoài phạm vi.
- Với Linux, chỉ cam kết **một bản phân phối tham chiếu**: **CachyOS trên x86_64** (máy thật của
  chủ dự án: CPU Intel, GPU AMD Radeon RX 6900 XT). Bản phân phối hay kiến trúc CPU khác chạy được
  thì tốt nhưng không được cam kết và không kiểm chứng. Đổi bản phân phối tham chiếu PHẢI qua một
  lần sửa constitution.
- Linux chỉ được coi là **đã hỗ trợ** khi trong danh sách của Nguyên tắc II có ít nhất một phiên
  bản App được kiểm chứng trên Linux. Trước đó, khi chạy trên Linux hệ thống PHẢI cảnh báo rằng
  nền tảng này đang ở giai đoạn thử nghiệm.
- KHÔNG dùng Docker. Hệ thống PHẢI cài và chạy local bằng một quy trình được mô tả trong hướng
  dẫn cài đặt. Một người mới PHẢI cài xong và chạy được trong ≤ 15 phút trên máy macOS, hoặc máy
  Linux tham chiếu, đã có Antigravity App, chỉ dựa vào hướng dẫn.
- Mọi phần phụ thuộc hệ điều hành (đường dẫn, cách dò tiến trình App và cổng) PHẢI nằm trong lớp
  kết nối (Nguyên tắc II), sau giao diện riêng theo hệ điều hành. Phần còn lại của hệ thống KHÔNG
  ĐƯỢC rẽ nhánh theo hệ điều hành.
- Trên hệ điều hành không hỗ trợ, hệ thống PHẢI báo rõ "chưa hỗ trợ" và nêu các hệ điều hành
  được hỗ trợ.

**Lý do**: Ngày 2026-11-10 chủ dự án có máy Linux để kiểm chứng và cho biết Antigravity App có
bản Linux. Mã đã tách phần phụ thuộc hệ điều hành từ đầu (v2.0.0), nên thêm Linux chỉ chạm lớp
kết nối và phần cài đặt. Chỉ cam kết một bản phân phối và chưa đặt ngưỡng hiệu năng để cổng chất
lượng vẫn kiểm chứng được bằng đúng một máy.

## Ràng buộc kỹ thuật

- **Nền tảng**: ứng dụng web chạy trên trình duyệt, kèm một tiến trình server local làm cầu
  nối với Antigravity App (trình duyệt không thể tự đọc tiến trình hay file của App).
- **Đối tượng kết nối**: chỉ Antigravity App (desktop) trên macOS và Linux, các phiên bản trong
  danh sách đã kiểm chứng của Nguyên tắc II (hiện gồm 2.29.0 và 2.24.0 trên macOS; Linux chưa có). CLI `agy` và Antigravity IDE không phải
  nguồn dữ liệu.
- **Điều kiện chạy**: Antigravity App PHẢI đang mở thì hệ thống mới thao tác được. Đây là ràng
  buộc đã được chấp nhận, không phải lỗi.
- **Dữ liệu thời tiết**: dùng nguồn miễn phí cho mục đích phi thương mại (mặc định Open-Meteo)
  và PHẢI hiển thị ghi nguồn theo giấy phép CC BY 4.0. Số request PHẢI nằm xa dưới giới hạn
  của nhà cung cấp (lưu đệm dữ liệu).
- **Mục đích sử dụng**: dự án cá nhân, phi thương mại. Mọi lựa chọn giấy phép (thư viện, tài
  nguyên 3D, dữ liệu) PHẢI tương thích với điều này.
- **Ngoài phạm vi cố định**: thay thế phần chạy agent của App; triển khai đám mây; gom
  conversation từ nhiều máy; mô phỏng giao thông hoặc đám đông thật; bản đồ thành phố chính xác.

## Quy trình phát triển & cổng chất lượng

- **Quy trình**: mọi tính năng đi theo Spec Kit: `/speckit-specify` → `/speckit-clarify` (khi
  cần) → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Ý tưởng lớn mới PHẢI qua
  pipeline đánh giá (`/speckit-assess-*`) trước.
- **Cổng chất lượng** trước khi một đợt được coi là xong:
  1. Kiểm thử lớp kết nối App (Nguyên tắc II) chạy qua, bao gồm các trường hợp App đóng, đổi
     cổng và phản hồi sai định dạng.
  2. Kiểm tra độ trễ trạng thái ≤ 2 giây trên App thật (Nguyên tắc I).
  3. Kiểm tra không có token, email hay nội dung conversation trong log và file xuất ra
     (Nguyên tắc III).
  4. Kiểm tra ngân sách hiệu năng ≥ 60 FPS trên máy tham chiếu, và mở chat bằng 1 lần bấm
     (Nguyên tắc V), trên macOS. Đo hiệu năng và chạy e2e PHẢI dùng GPU thật (Chromium với ANGLE/Metal);
     kết quả đo bằng render phần mềm (SwiftShader) không được dùng để kết luận đạt hay không
     đạt. Lấy kết quả từ lần đo thứ hai trở đi, vì lần đầu sau khi build là lần khởi động nguội.
  5. Hướng dẫn cài đặt được chạy thử trên macOS (Nguyên tắc VI). Nếu đợt thay đổi lớp kết nối,
     phần phụ thuộc hệ điều hành hoặc quy trình cài đặt, thì cổng 1, 2, 3 và 5 PHẢI chạy qua cả
     trên máy Linux tham chiếu.
- **Thử nghiệm với App thật**: thao tác ghi (tạo conversation, gửi tin nhắn) khi phát triển
  PHẢI dùng conversation thử nghiệm được đặt tên rõ ràng, và PHẢI được dọn sau khi thử.
- **Phức tạp phải có lý do**: mọi thành phần, thư viện hay lớp trừu tượng vượt quá nhu cầu của
  đợt hiện tại PHẢI được giải thích trong plan (mục Complexity Tracking).

## Governance

- Constitution này có hiệu lực cao hơn mọi quy ước khác của dự án. Spec, plan và tasks PHẢI
  tuân thủ. Mọi vi phạm PHẢI được ghi rõ và giải thích trong plan, nếu không thì phải sửa.
- **Sửa đổi**: mọi thay đổi PHẢI được thực hiện qua `/speckit-constitution`, ghi lại lý do,
  cập nhật Sync Impact Report và được chủ dự án duyệt.
- **Đánh phiên bản** theo semantic versioning:
  - MAJOR: bỏ hoặc định nghĩa lại một nguyên tắc theo cách không tương thích.
  - MINOR: thêm nguyên tắc hoặc mục mới, hoặc mở rộng đáng kể hướng dẫn.
  - PATCH: làm rõ câu chữ, sửa lỗi chính tả, thay đổi không mang nghĩa.
- **Rà soát tuân thủ**: `/speckit-plan` PHẢI có bước Constitution Check đối chiếu với 6 nguyên
  tắc. `/speckit-analyze` PHẢI coi vi phạm constitution là lỗi nghiêm trọng. Khi Antigravity
  App đổi phiên bản mục tiêu, trên bất kỳ hệ điều hành nào, Nguyên tắc II và mục Ràng buộc kỹ
  thuật PHẢI được xem lại.
- **Thay đổi danh sách phiên bản đã kiểm chứng**: thêm hoặc bớt một phiên bản trong danh sách
  của Nguyên tắc II mà không đổi quy tắc kiểm chứng được tính là sửa đổi **PATCH**. Việc này vẫn
  PHẢI qua `/speckit-constitution` và nêu bằng chứng kiểm chứng (feature spec và kết quả kiểm thử
  với App thật).

**Version**: 2.2.0 | **Ratified**: 2026-11-06 | **Last Amended**: 2026-11-10
