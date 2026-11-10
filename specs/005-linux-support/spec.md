# Feature Specification: Phiên bản Linux

**Feature Branch**: `005-linux-support`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "Hiện tại tôi đã thấy ứng dụng đáp ứng được đầy đủ các logic mà tôi mong muốn. Bây giờ tôi muốn bạn đề xuất cho tôi phương án để triển khai phiên bản dành cho Linux, kết nối được với Antigravity App của Linux"

## Clarifications

### Session 2026-11-10

- Q: Máy Linux tham chiếu để kiểm chứng là máy nào? → A: Máy thật chạy **CachyOS** (dựa trên Arch Linux), CPU Intel (x86_64), GPU AMD Radeon RX 6900 XT.
- Q: (người dùng chủ động nêu) Có cần đo hiệu năng trên Linux không? → A: **Chưa**. Feature này chỉ kiểm chứng kết nối và toàn bộ logic chạy ổn định với App Linux. Đo FPS và tối ưu hiệu năng trên Linux nằm ngoài phạm vi, để một feature sau.

## Hiện trạng (rà soát mã nguồn 2026-11-10)

Phần này ghi lại những chỗ hiện đang gắn với macOS. Chỉ đọc mã, chưa chạy gì trên Linux.

| # | Hạng mục | Hiện trạng | Cần thay đổi cho Linux? |
|---|---|---|---|
| H1 | Nguyên tắc dự án | Constitution VI: "Linux được hoãn", thêm Linux PHẢI qua một lần sửa constitution | **Có**: sửa constitution trước khi làm |
| H2 | Tìm tiến trình App | Chỉ có cách tìm cho macOS; trên hệ điều hành khác hệ thống báo "chưa hỗ trợ" và dừng | **Có**: thêm cách tìm cho Linux sau cùng giao diện sẵn có |
| H3 | Dò cổng App đang nghe | Dùng công cụ chỉ chắc chắn có trên macOS | **Có**: cách dò cổng cho Linux |
| H4 | Nhận diện đúng tiến trình App | Dựa vào tên chương trình và các tham số khởi động của bản macOS | **Không** (đã đo, xem L1–L3 bên dưới) |
| H5 | Gọi API, luồng cập nhật, dữ liệu | Không phụ thuộc hệ điều hành | Không (chỉ cần kiểm chứng) |
| H6 | Lưu dữ liệu riêng (bố cục, cài đặt) | Đã dùng thư mục chuẩn theo hệ điều hành | Không (chỉ cần kiểm chứng) |
| H7 | Tự mở trình duyệt khi khởi động | Đã chạy được đa nền tảng | Không (chỉ cần kiểm chứng) |
| H8 | Script cài đặt | Từ chối chạy nếu không phải macOS | **Có** |
| H9 | Hướng dẫn cài đặt, README | Chỉ viết cho macOS | **Có** |
| H10 | Danh sách phiên bản App đã kiểm chứng | Chỉ gồm bản macOS (2.29.0, 2.24.0) | **Có**: kiểm chứng riêng bản Linux |

**Kết luận**: Phần lớn hệ thống (văn phòng 3D, chat, trạng thái, quota) không phụ thuộc hệ điều
hành. Việc cần làm tập trung ở 3 chỗ: (1) cách tìm và kết nối App trên Linux, (2) cài đặt và tài
liệu, (3) kiểm chứng trên App Linux thật. Rủi ro lớn nhất là H4: chưa biết App Linux khởi động
giống bản macOS đến đâu, nên bước đầu tiên PHẢI là rà soát chỉ đọc trên máy Linux thật.

## Kết quả rà soát Linux

### Bước 0 (2026-11-10, máy CachyOS tham chiếu, chỉ đọc)

Chạy 2 lệnh `ps` và `ss` khi App Linux đang mở, đối chiếu với App macOS 2.29.0 đang chạy cùng lúc.

| # | Hạng mục | App Linux | So với macOS | Cần thay đổi? |
|---|---|---|---|---|
| L1 | App có bản Linux | Có, cài ở `/opt/Antigravity/`, tiến trình nền `language_server` | Cùng tên chương trình | Không |
| L2 | Tham số khởi động | `--app_data_dir antigravity`, `--subclient_type hub`, `--csrf_token`, `--override_ide_version` đều có | **Giống hệt** từng tham số | Không: cách nhận diện App và lấy khoá kết nối hiện có dùng được nguyên |
| L3 | Phiên bản | **2.29.1** | macOS đang chạy 2.29.0 | **Có**: 2.29.1 chưa có trong danh sách đã kiểm chứng; hệ thống sẽ cảnh báo cho tới khi kiểm chứng xong |
| L4 | Cổng đang nghe | 3 cổng, đều chỉ trên `127.0.0.1`, cổng ngẫu nhiên mỗi lần mở App. Một cổng dùng chung với tiến trình giao diện của App | Giống kiểu macOS (thử lần lượt từng cổng) | **Có**: cần cách liệt kê cổng cho Linux, vì `lsof` không chắc có sẵn trên CachyOS, còn `ss` thì có |
| L5 | Khoá phụ `--host_bridge_token` | Có trong tham số khởi động | macOS cũng có | Không bắt buộc: hệ thống không dùng và không ghi log tham số khởi động. Nên che luôn khoá này trong mọi lệnh/hướng dẫn rà soát |

**Kết luận bước 0**: Rủi ro lớn nhất (H4) đã được gỡ. Bản Linux khởi động giống bản macOS, nên chỉ cần
thêm cách liệt kê cổng cho Linux. Bước tiếp theo: có cách tìm App cho Linux, chạy `npm run check:compat`
trên CachyOS để rà soát API và dữ liệu của bản 2.29.1.

### Bước 1 (2026-11-10, CachyOS, chỉ đọc)

| Hạng mục | Kết quả |
|---|---|
| Phiên bản App | 2.29.1, lúc đó "CHƯA kiểm chứng" (đúng như dự kiến) |
| Lệnh nội bộ đang dùng | **19/19 còn** |
| Trường thêm/bớt | Lần chạy đầu không so được: Linux chưa có bản kiểm chứng nên không chọn được fixture gốc. Đã sửa: so với bộ mới nhất đã kiểm chứng ở bất kỳ hệ nào (2.29.0). Contract test trên fixture 2.29.1 qua hết, không cần sửa mapper |
| Loại bước chưa nhận ra | `GENERIC` 28, `CHECKPOINT` 1. Cả hai cũng là `other` trên macOS, không riêng Linux |
| `npm start` | Trình duyệt mở văn phòng, nhân viên khớp App, có cảnh báo thử nghiệm. Tắt/mở App 5 lần đều tự kết nối lại. Khởi động khi App tắt: báo mất kết nối, không treo (SC-001, SC-004) |

### Bước 2 (2026-11-10, CachyOS, đọc và ghi)

| Hạng mục | Kết quả |
|---|---|
| Dữ liệu mẫu | `tests/contract/fixtures/app-2.29.1/` (cơ bản + 1 conversation thử nghiệm; chưa có các biến thể `tools`, `question`, `search-web`) |
| `npm test` | 275 qua, 0 lỗi, `check-guards` qua |
| `npm run test:live` | 8/8 qua: chat + dừng ≤ 3 s, xoá, câu hỏi (chọn một, chọn nhiều, tự nhập), project, duyệt/từ chối lệnh (chạy riêng khi App bật "hỏi trước khi chạy lệnh") |
| Độ trễ trạng thái | p95 **840 ms** (mục tiêu ≤ 2 s), khớp **100%** trên 2070 mẫu, 27 lần chuyển trạng thái, 10 phút |
| `npm run test:leaks` | 6/6 qua; `--sweep` không còn conversation thử nghiệm |

**Khác biệt tìm thấy trên Linux** (đã sửa):
- App Linux mới cài **không có** project `default-cli-project` (chỉ có sau khi dùng CLI). Tạo nhân viên
  không chọn project từng gửi project này và bị HTTP 404. Nay dùng project mặc định mà App thật sự có
  (`default-cli-project`, rồi `outside-of-project`).
- Dữ liệu mẫu ghi trên Linux lộ đường dẫn ổ `/mnt/<uuid>`, danh sách quyền đã cấp, tên thư mục project
  và nội dung prompt. Bộ lọc fixture nay che các phần này; lịch sử git đã được lọc lại.

**Kết luận**: 2.29.1 được công nhận cho Linux (2026-11-10).

## Phương án đề xuất (tóm tắt)

Đi theo 3 bước, mỗi bước dùng được độc lập:

1. **Rà soát chỉ đọc trên Linux** (giống cách làm ở feature 003), 2 bước: bước 0 trước khi viết mã
   (App có tồn tại, cách khởi động, phiên bản); bước 1 ngay sau khi tìm được App trên Linux (các API
   hệ thống đang dùng còn đủ không, định dạng dữ liệu).
2. **Kết nối trên Linux**: thêm cách tìm App và dò cổng cho Linux, đặt cạnh cách làm của macOS
   (Constitution VI đã chuẩn bị sẵn chỗ này). Phần còn lại của hệ thống giữ nguyên.
3. **Cài đặt và kiểm chứng**: script cài và hướng dẫn chạy được trên Linux, kiểm thử đọc/ghi với
   App thật, rồi mới công nhận Linux là nền tảng được hỗ trợ. Không đo hiệu năng trong feature này.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mở văn phòng trên Linux và thấy nhân viên thật (Priority: P1)

Người dùng có máy Linux đã cài và đang mở Antigravity App. Họ khởi động hệ thống, trình duyệt mở
văn phòng 3D, và thấy các nhân viên tương ứng với conversation trong App, với trạng thái đúng
như trên macOS.

**Why this priority**: Đây là lõi của yêu cầu, "kết nối được với Antigravity App của Linux".
Không có bước này thì mọi thứ khác vô nghĩa.

**Independent Test**: Trên máy Linux tham chiếu đang mở App, khởi động hệ thống và so sánh danh
sách nhân viên, trạng thái, model, quota với những gì App hiển thị.

**Acceptance Scenarios**:

1. **Given** App Linux đang mở, có ít nhất 1 conversation, **When** người dùng khởi động hệ thống,
   **Then** văn phòng hiện đúng số nhân viên và trạng thái khớp App, không có lỗi "chưa hỗ trợ".
2. **Given** hệ thống đã kết nối, **When** một agent trong App chuyển trạng thái (làm việc → chờ
   sếp → xong), **Then** nhân viên tương ứng đổi trạng thái trong ≤ 2 giây.
3. **Given** App Linux chưa mở, **When** người dùng khởi động hệ thống, **Then** hệ thống hiện
   trạng thái "mất kết nối", không treo, và tự kết nối khi App được mở.
4. **Given** App đóng hoặc khởi động lại trong lúc đang dùng, **When** App mở lại (có thể với cổng
   khác), **Then** hệ thống tự kết nối lại mà không cần khởi động lại.

---

### User Story 2 - Thao tác với nhân viên trên Linux (Priority: P1)

Trên Linux, người dùng làm được mọi thao tác đã có trên macOS: chat, tuyển nhân viên mới, dừng
agent, duyệt quyền, trả lời câu hỏi của agent, tạo project, xoá nhân viên.

**Why this priority**: Người dùng nói ứng dụng đã "đáp ứng đầy đủ logic mong muốn". Bản Linux chỉ
có giá trị khi giữ được toàn bộ logic đó, không chỉ xem.

**Independent Test**: Trên App Linux thật, dùng conversation thử nghiệm có tên rõ ràng, chạy lần
lượt từng thao tác ghi và đối chiếu kết quả trong App, rồi dọn dữ liệu thử.

**Acceptance Scenarios**:

1. **Given** đã kết nối App Linux, **When** người dùng gửi tin nhắn cho một nhân viên, **Then** tin
   nhắn xuất hiện trong conversation tương ứng của App và câu trả lời hiện trong khung chat.
2. **Given** agent đang chờ duyệt quyền hoặc hỏi sếp, **When** người dùng trả lời trong hệ thống,
   **Then** App nhận câu trả lời và agent chạy tiếp.
3. **Given** đã kết nối, **When** người dùng tuyển nhân viên mới hoặc tạo project, **Then** App có
   conversation/project mới tương ứng.

---

### User Story 3 - Cài đặt trên Linux chỉ theo hướng dẫn (Priority: P2)

Một người mới có máy Linux đã cài Antigravity App làm theo hướng dẫn cài đặt và chạy được hệ
thống, giống trải nghiệm trên macOS.

**Why this priority**: Constitution VI yêu cầu cài đặt đơn giản là cổng chất lượng. Nhưng chỉ có
ý nghĩa khi US1–US2 đã chạy.

**Independent Test**: Trên máy Linux sạch (chỉ có App và trình duyệt), một người chỉ đọc hướng
dẫn, bấm giờ từ lúc bắt đầu đến lúc thấy văn phòng.

**Acceptance Scenarios**:

1. **Given** máy Linux tham chiếu đã có App, **When** người mới làm theo hướng dẫn, **Then** họ chạy
   được hệ thống trong ≤ 15 phút.
2. **Given** máy thiếu điều kiện (Node.js quá cũ, thiếu công cụ hệ thống cần thiết), **When** chạy
   script cài, **Then** script dừng và nói rõ thiếu gì, cách cài, bằng tiếng Việt.
3. **Given** người dùng đang dùng macOS, **When** cài và chạy như trước, **Then** không có gì thay
   đổi so với trước feature này.

---

### Edge Cases

- App Linux không tồn tại hoặc khởi động khác hẳn bản macOS (tên chương trình, tham số, cách lấy
  khoá kết nối): rà soát ở bước 1 PHẢI phát hiện và dừng feature lại để quyết định, không đoán.
- Phiên bản App Linux khác số với bản macOS, hoặc cùng số nhưng hành vi khác: hệ thống cảnh báo
  "chưa kiểm chứng" như với bản macOS ngoài danh sách.
- Nhiều phiên bản App cùng chạy, hoặc có cả Antigravity IDE/CLI đang chạy: chỉ kết nối đúng App
  desktop, bỏ qua IDE và CLI (theo Ràng buộc kỹ thuật của constitution).
- App cài kiểu đóng gói cô lập (sandbox), hoặc chạy dưới user khác, khiến không đọc được thông tin
  tiến trình hay cổng: hệ thống hiện trạng thái lỗi với lý do cụ thể (không đọc được thông tin
  tiến trình App), không treo. Hỗ trợ các kiểu cài này nằm ngoài phạm vi.
- Máy dùng Wayland hay X11 (CachyOS mặc định có thể là cả hai, tuỳ môi trường desktop): không ảnh
  hưởng tới kết nối App; trình duyệt mở được thì dùng được.
- CachyOS/Arch cập nhật liên tục (rolling release), nên công cụ hệ thống có thể đổi phiên bản: phần
  tìm App chỉ dựa vào những gì chắc chắn có sẵn trên một bản cài CachyOS mặc định.
- Không có lệnh mở trình duyệt mặc định: hệ thống in địa chỉ ra terminal để người dùng tự mở.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Rà soát **chỉ đọc** trên App Linux thật PHẢI chia 2 bước, kết quả ghi vào mục "Kết quả
  rà soát Linux" của spec này:
  - **Bước 0**, trước khi viết mã: App Linux có tồn tại không, cách khởi động và cấp khoá kết nối,
    phiên bản, cổng đang nghe. *(Đã xong 2026-11-10.)*
  - **Bước 1**, ngay sau khi hệ thống tìm được App trên Linux và trước mọi thao tác ghi: các API hệ
    thống đang dùng còn đủ không, định dạng dữ liệu khác bản macOS ở đâu. Nếu thiếu API nào, PHẢI
    dừng để quyết định lại trước khi làm tiếp.
- **FR-002**: Constitution PHẢI được sửa (qua `/speckit-constitution`) để đưa Linux vào phạm vi hỗ
  trợ trước khi feature được coi là xong. Windows vẫn nằm ngoài phạm vi. Lần sửa này PHẢI ghi rõ
  rằng cổng chất lượng về hiệu năng (≥ 60 FPS, Nguyên tắc V) tạm thời chỉ áp dụng cho macOS; trên
  Linux chưa đo cho tới một feature sau.
- **FR-003**: Trên Linux, hệ thống PHẢI tự tìm được App desktop đang chạy, lấy khoá kết nối và cổng
  API mà không cần người dùng nhập tay.
- **FR-004**: Mọi phần riêng của Linux PHẢI nằm trong lớp kết nối App, sau giao diện theo hệ điều
  hành đã có. Phần còn lại của hệ thống (văn phòng, chat, trạng thái, quota) KHÔNG ĐƯỢC có nhánh
  riêng cho Linux.
- **FR-005**: Trên Linux, toàn bộ chức năng đọc (nhân viên, trạng thái, chat, model, quota, project,
  lệnh `/`) và ghi (gửi tin, tuyển, dừng, duyệt quyền, trả lời câu hỏi, tạo project, xoá) PHẢI chạy
  như trên macOS.
- **FR-006**: Trên Linux, hệ thống PHẢI suy giảm có kiểm soát khi App đóng, chưa mở hoặc đổi cổng,
  và tự kết nối lại khi App mở lại.
- **FR-007**: Hệ thống PHẢI kiểm tra phiên bản App Linux khi kết nối và cảnh báo nếu bản đó chưa
  kiểm chứng. Danh sách phiên bản đã kiểm chứng PHẢI ghi rõ phiên bản nào được kiểm chứng trên hệ
  điều hành nào.
- **FR-008**: Phiên bản App Linux chỉ được đánh dấu đã kiểm chứng sau khi có dữ liệu mẫu ghi từ App
  Linux trong kiểm thử hợp đồng và kiểm thử đọc/ghi/kết nối lại với App Linux thật đã chạy qua
  (theo Constitution II).
- **FR-009**: Trên hệ điều hành không hỗ trợ (ví dụ Windows), hệ thống PHẢI báo rõ "chưa hỗ trợ"
  và nêu các hệ điều hành được hỗ trợ.
- **FR-010**: Script cài đặt PHẢI chạy được trên cả macOS và Linux, kiểm tra Node.js đủ phiên bản và
  báo rõ cách cài khi thiếu. Việc tìm App trên Linux không được cần cài thêm công cụ hệ thống nào.
- **FR-011**: Hướng dẫn cài đặt và README PHẢI có phần cho Linux, với lệnh cài gói theo trình quản lý
  gói của CachyOS/Arch.
- **FR-012**: *(Bỏ: cảnh báo render phần mềm thuộc về hiệu năng, ngoài phạm vi feature này.)*
- **FR-013**: Các yêu cầu bảo mật hiện có PHẢI giữ nguyên trên Linux: server chỉ nghe trên
  `127.0.0.1`, khoá kết nối chỉ nằm trong bộ nhớ, không ghi token, email hay nội dung chat vào log
  hay file.
- **FR-014**: Dữ liệu riêng của hệ thống (bố cục, cài đặt) trên Linux PHẢI lưu ở thư mục dữ liệu
  chuẩn của người dùng theo quy ước Linux, và đường dẫn đó PHẢI được ghi trong hướng dẫn.
- **FR-015**: Hệ thống trên macOS PHẢI hoạt động y như trước feature này (không hồi quy). Toàn bộ
  kiểm thử hiện có PHẢI tiếp tục chạy qua.
- **FR-016**: Kiểm thử tự động của phần tìm App trên Linux PHẢI chạy được trên máy macOS của nhà
  phát triển (dựa trên dữ liệu mẫu đã loại thông tin cá nhân), để phát hiện hồi quy mà không cần
  máy Linux mỗi lần.
- **FR-017**: Máy Linux tham chiếu dùng để kiểm chứng là máy thật chạy CachyOS, CPU Intel x86_64,
  GPU AMD Radeon RX 6900 XT. Cổng chất lượng trên Linux (kết nối, đọc/ghi, tự kết nối lại, độ trễ
  trạng thái, cài đặt, không lộ dữ liệu) PHẢI chạy qua trên máy này.
- **FR-018**: Khi chạy trên Linux mà chưa có phiên bản App nào được kiểm chứng trên Linux, hệ thống
  PHẢI cảnh báo (ở terminal và giao diện) rằng Linux đang ở giai đoạn thử nghiệm (Constitution VI
  v2.2.0). Cảnh báo tự hết khi có phiên bản Linux đầu tiên trong danh sách đã kiểm chứng.

### Key Entities

- **Hệ điều hành được hỗ trợ**: macOS và Linux. Mỗi hệ điều hành có cách tìm App và dò cổng riêng,
  nằm trong lớp kết nối.
- **Phiên bản App đã kiểm chứng**: mở rộng để ghi thêm hệ điều hành mà phiên bản đó được kiểm chứng.
  Một số phiên bản có thể chỉ được kiểm chứng trên một hệ điều hành.
- **Máy Linux tham chiếu**: CachyOS, Intel x86_64, AMD RX 6900 XT. Trình duyệt cụ thể được ghi
  trong plan.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Trên máy Linux tham chiếu đang mở App, khởi động hệ thống tới khi thấy nhân viên đúng
  trạng thái mất ≤ 10 giây, không cần nhập tay thông tin kết nối nào.
- **SC-002**: Trạng thái nhân viên trên Linux trễ ≤ 2 giây so với App, đo trên App Linux thật.
- **SC-003**: 100% thao tác ghi đang có trên macOS chạy đúng trên App Linux thật.
- **SC-004**: Đóng rồi mở lại App Linux 5 lần liên tiếp, hệ thống tự kết nối lại cả 5 lần trong ≤ 10
  giây sau khi App sẵn sàng, không cần khởi động lại.
- **SC-005**: Người mới cài xong và chạy được trên máy Linux tham chiếu trong ≤ 15 phút, chỉ dựa vào
  hướng dẫn.
- **SC-006**: Dùng hệ thống hằng ngày trên máy Linux tham chiếu trong 1 tuần mà không gặp lỗi kết nối
  hay thao tác nào không xảy ra trên macOS.
- **SC-007**: Toàn bộ kiểm thử tự động hiện có vẫn chạy qua trên macOS, và hệ thống trên macOS vẫn
  kết nối App mà không có cảnh báo mới.
- **SC-008**: Quét log và file dữ liệu trên Linux sau một phiên dùng: 0 lần xuất hiện token, email
  hay nội dung conversation.

## Assumptions

- Antigravity App có bản desktop cho Linux (người dùng nói vậy). Nếu rà soát FR-001 cho thấy không
  có, hoặc khác bản macOS tới mức phải thiết kế lại cách kết nối, feature dừng để quyết định lại.
- App Linux dùng cùng kiểu API nội bộ như bản macOS (một tiến trình nền nghe trên cổng local, khoá
  kết nối nằm trong tham số khởi động). Chỉ cách tìm tiến trình và cổng là khác.
- Chỉ cam kết một bản phân phối tham chiếu: CachyOS trên x86_64. Các bản phân phối khác (Ubuntu,
  Fedora…) và CPU ARM chạy được thì tốt, nhưng không cam kết và không kiểm chứng.
- Hiệu năng 3D trên Linux nằm ngoài phạm vi: không đo FPS, không tối ưu, không cảnh báo render phần
  mềm. Văn phòng chỉ cần hiện và thao tác được.
- Không làm gói cài đặt riêng cho Linux (.deb, AppImage, Flatpak): cài giống macOS bằng script và
  hướng dẫn. Vẫn không dùng Docker (Constitution VI).
- Không chạy hệ thống trên Linux để kết nối với App trên máy macOS khác (hoặc ngược lại): hệ thống
  và App luôn cùng một máy (Constitution III).
- Trình duyệt tham chiếu là Chromium/Chrome bản mới, giống macOS.
- Phát triển vẫn chủ yếu trên macOS; máy Linux chỉ dùng để rà soát, kiểm chứng và đo.
