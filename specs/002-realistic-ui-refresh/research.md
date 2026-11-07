# Research: Làm mới giao diện theo concept thực tế hơn

**Feature**: `002-realistic-ui-refresh` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

Mỗi mục ghi: Quyết định, Lý do, Phương án đã cân nhắc. Các mục có mã `R2-xx` để tasks tham chiếu
(tránh trùng với R1–R15 của tính năng 001).

---

## R2-01 · Nguyên nhân lỗi model không được nhớ (US1)

**Phát hiện trong code**:
- `src/web/ui/chat/ChatPanel.tsx:55` gán cứng `const lastModel = null;` nên `Composer` luôn nhận
  `defaultModel` từ cài đặt.
- `src/web/ui/chat/ModelPicker.tsx:25`: khi `value` rỗng, picker tự chọn `list[0]` (= "4 Argon").
- `Composer` giữ model trong `useState` cục bộ, mất khi khung chat đóng.
- `src/server/app-adapter/mappers/conversation.ts:38` đặt `currentModel: null`. Dữ liệu App lại có
  model của từng lượt (`generatorModel` / `requestedModel` trong step, fixture
  `GetCascadeTrajectorySteps.json`).

**Quyết định**:
1. Thêm `preferredModel` vào **hồ sơ nhân viên** (`employees.json`, đã là dữ liệu riêng theo từng
   conversation và đã được dọn khi conversation biến mất). Lưu ngay khi người dùng đổi model,
   không chờ gửi tin (Acceptance 1.5).
2. Lớp kết nối App điền `currentModel` từ step gần nhất có model (chỉ đọc, Constitution II).
3. Thứ tự hiển thị (FR-003): `preferredModel` → `currentModel` → `settings.defaultModel` → model
   đầu danh sách.
4. Nếu model không còn trong danh sách App hoặc quota bằng 0: picker hiển thị cảnh báo và giữ
   nguyên lựa chọn cũ (bị vô hiệu). Nút gửi bị chặn cho tới khi người dùng chọn model khác; hệ
   thống không tự đổi (FR-004).
5. Bỏ hành vi "tự chọn `list[0]`" trong `ModelPicker` khi đã có giá trị đã giải quyết.

**Lý do**: Hồ sơ nhân viên đã có vòng đời đúng theo conversation, không cần thêm file mới.
Model gần nhất từ App giúp conversation tạo bên App vẫn hiển thị đúng.

**Phương án đã cân nhắc**: `localStorage` trên trình duyệt (bị loại: mất khi đổi trình duyệt và
không dọn được theo conversation). Chỉ dùng model gần nhất của App (bị loại: không nhớ được lựa
chọn khi chưa gửi tin).

---

## R2-02 · Vì sao kéo nhân viên vào bàn không hoạt động (US2)

**Phát hiện trong code** (`BuildGizmo.tsx`, `EmployeeDrag.tsx`, `routes/layout.ts`):
1. `onPointerDown` trên nhân viên chỉ ghi `draggingEmployee`. `CameraControls` không bị tắt, nên
   thao tác kéo xoay camera thay vì kéo nhân viên. Không có bóng nhân viên đi theo chuột.
2. Việc thả dựa vào `onPointerUp` của mặt phẳng trong suốt ở `y = 0.01`. Bàn, ghế và hộp va chạm
   của nhân viên nằm phía trên mặt phẳng nên nhận sự kiện trước. Không có pointer capture.
3. `PUT /api/employees/:id/profile` chỉ chấp nhận bàn đã **lưu** trong `layout.json`. Bàn mới đặt
   trong bản nháp của chế độ xây dựng bị từ chối, và lỗi bị nuốt bởi `.catch(() => undefined)`.

**Quyết định**: Viết lại kéo thả bằng một **bộ điều khiển kéo dùng chung** cho đồ vật và nhân
viên:
- Nhấn chuột lên đối tượng → `setPointerCapture` → tắt `CameraControls` trong lúc kéo.
- Vị trí con trỏ được tính bằng giao điểm tia với **mặt phẳng toán học** `y = 0` (`THREE.Plane`),
  không phụ thuộc mesh nào được bắn trúng.
- Ngưỡng 4 px để phân biệt bấm và kéo.
- Esc, `pointercancel`, mất tiêu điểm cửa sổ → huỷ và trả về vị trí cũ (Edge Cases).
- Chỗ ngồi được **ghi vào bản nháp** của chế độ sắp xếp (có undo/redo) và lưu cùng bố cục trong một
  lần `PUT /api/layout` (xem contracts/local-api.md). Mọi lỗi đều hiển thị cho người dùng.
- Ngoài chế độ sắp xếp, các handler kéo không được gắn (FR-010).

Bước đầu tiên của US2 là viết **e2e test tái hiện lỗi**, chạy đỏ trước khi sửa.

**Phương án đã cân nhắc**: `DragControls` của drei (bị loại: kéo theo mặt phẳng camera, khó ràng
buộc trong sàn và không có điểm thả). Sửa vá từng lỗi riêng (bị loại: ba lỗi có chung một nguyên
nhân là mô hình sự kiện).

---

## R2-03 · Đặt đồ vật tự do và lưu bố cục phiên bản 2 (US2, US4)

**Quyết định**: Đổi `OfficeLayout` sang `schemaVersion: 2`:
- Đồ nội thất có `pos: {x, z}` tính bằng mét, làm tròn 0,05 m (FR-007), tính từ góc tây bắc của
  sàn. Góc xoay vẫn theo bước 90°.
- Vách ngăn bên trong (`wall`, `glass_wall`) và cửa vẫn bám cạnh lưới 0,5 m. Đây là kết cấu, bám
  lưới giúp nối tường liền mạch. Người dùng chỉ yêu cầu đặt tự do cho đồ vật.
- **Vỏ văn phòng** (tường bao, mặt kính hướng công viên, cửa chính) tách khỏi `items` thành `shell`,
  được sinh ra từ kích thước sàn. Nhờ vậy đổi kích thước không phải sửa hàng trăm item tường (R2-05).
- Va chạm giữa đồ vật: kiểm tra chồng hình chữ nhật (AABB, vì xoay theo 90°), dùng chung cho client
  và server (`src/shared/layout-validation.ts`).
- Lối đi: **lưới điều hướng suy ra** ở độ phân giải 0,25 m, đánh dấu ô bị chiếm bởi footprint đã nới
  thêm bán kính nhân viên. Kiểm tra "mỗi bàn có lối từ cửa" chuyển sang lưới này.
- **Chuyển đổi v1 → v2** tự động khi đọc. `pos = cell × 0,5`. Tường và cửa trên chu vi được gom vào
  `shell`. Trước khi ghi đè, file cũ được sao lưu thành `layout.v1.bak.json` (FR-014).

**Lý do**: Toạ độ liên tục là điều kiện để đặt tự do. Lưới điều hướng suy ra giữ nguyên được A*
hiện có (`grid/astar.ts`) với chi phí nhỏ.

**Phương án đã cân nhắc**: Giữ lưới và chỉ làm mịn ô xuống 0,05 m (bị loại: lưới 800 × 800 ô cho
văn phòng 40 m, A* chậm). Navmesh đa giác (bị loại: phức tạp, chưa cần).

---

## R2-04 · Nhân viên không chồng lấn và hiệu ứng va chạm (US3)

**Quyết định**: Thêm một **hệ thống đám đông** (crowd) thuần TypeScript, một instance cho cả văn
phòng, chạy mỗi khung hình trước khi vẽ nhân viên:
- Mỗi nhân viên là một hình tròn bán kính 0,28 m. Nhân viên đang ngồi là vật cản tĩnh, không bị đẩy (FR-020).
- **Đi theo đường**: A* trên lưới điều hướng (R2-03). `EmployeeBrain` giữ vai trò quyết định *đi
  đâu*; crowd quyết định *đi thế nào*.
- **Tránh nhau**: lực tách (separation) kèm luật nhường đường. Nhân viên có độ ưu tiên thấp hơn (đi
  rảnh thấp hơn đi về bàn; hoà thì so mã băm của id) sẽ dừng và đứng sang bên.
- **Không bao giờ chồng lấn**: sau bước di chuyển là bước giải ràng buộc vị trí, đẩy các cặp chồng
  nhau ra (lặp 4 lần) rồi kẹp vào ô đi được. Bất biến được kiểm thử: khoảng cách giữa hai tâm luôn
  ≥ 2r − 1 cm.
- **Đặt chỗ đích**: điểm đến dùng chung (máy nước, sofa) có các ô xếp hàng. Nhân viên chờ đến lượt,
  không dồn vào một điểm.
- **Phản ứng va chạm**: khi hai nhân viên chạm nhau với vận tốc tương đối > 0,3 m/s, hoặc bị chặn
  > 0,4 giây, cả hai phát sự kiện `bump`. Brain chơi phản ứng 0,6–1,0 giây: khựng, nghiêng thân về
  sau, quay đầu về phía va chạm, mặt "Surprised" rồi đi tiếp. Va vào đồ vật thì nhân viên khựng, và
  đồ vật nhẹ (ghế, chậu cây, thùng rác) được rung bằng lò xo tắt dần **chỉ ở lớp hiển thị**, không
  đổi `pos` đã lưu (FR-019).
- Bị chặn đường hoàn toàn quá 5 giây: tìm đường lại; vẫn không có thì quay về bàn hoặc đứng chờ.

**Lý do**: Tối đa 20 nhân viên nên thuật toán O(n²) mỗi khung hình là quá rẻ (< 0,1 ms). Logic thuần
dễ kiểm thử mô phỏng 10 phút trong vài giây (SC về không chồng lấn).

**Phương án đã cân nhắc**: Engine vật lý Rapier/cannon (bị loại: thêm WASM ~1 MB, va chạm vật lý
thật làm nhân viên ngã hoặc trôi, khó giữ trung thực trạng thái). RVO2/ORCA đầy đủ (bị loại: thừa
với 20 agent; separation + nhường đường + giải ràng buộc là đủ).

---

## R2-05 · Đổi kích thước văn phòng (US4)

**Quyết định**:
- `floor: {width, depth}` tính bằng mét, từ 6 đến 40, bước 0,5 (FR-023). Kiểm tra bằng
  zod ở server và trong bảng sắp xếp.
- Đổi kích thước neo ở **góc tây bắc**. Mặt kính hướng công viên ở cạnh bắc giữ nguyên; văn phòng
  dài ra về phía đông và nam. Toạ độ đồ vật không đổi nên đồ vật đứng yên.
- Có hai cách điều khiển: ô nhập số trong bảng sắp xếp, và tay kéo ở cạnh đông, cạnh nam của sàn.
  Kéo tay cũng làm tròn 0,5 m. Xem trước bằng bản nháp, chỉ ghi khi bấm "Lưu" như các thay đổi khác
  ở chế độ sắp xếp.
- Thu nhỏ: giới hạn dưới động bằng cạnh xa nhất của đồ vật (cộng lối đi). Các đồ vật đang chặn
  được tô đỏ và liệt kê tên.
- Cửa chính nằm trong `shell`, giữ vị trí tương đối trên cạnh nam. Nếu cạnh quá ngắn thì cửa được
  kẹp vào trong.
- **Công viên tự xếp lại theo kích thước văn phòng** (cập nhật 2026-11-07 theo góp ý người dùng: mở
  rộng văn phòng không được dính vào cây và quán):
  - Lối đi vòng là elip đi qua ngoài góc văn phòng: `rx = w/2·1,414 + 4,5`, `rz = d/2·1,414 + 4,5`. Dải
    cỏ trống giữa mép văn phòng và lối đi luôn ≥ 5 m.
  - Ghế, bồn hoa, đèn, nhóm tập thể dục, ki-ốt, hồ đặt **tương đối** với elip (ngoài lối đi), nên tự dời
    ra khi văn phòng lớn lên.
  - Cây lấy từ **một tập cố định theo seed** cho cả công viên. Mỗi cây chỉ hiện khi nằm ngoài dải cỏ trống
    (mép văn phòng + 8 m), ngoài lối đi, hồ, ki-ốt, và không chắn tầm nhìn camera. Đổi kích thước chỉ ẩn
    hoặc hiện cây, cây không nhảy chỗ.
  - Văn phòng tối đa 40 × 40 m cho elip `rx = rz ≈ 33 m`, cộng dải cây và ki-ốt khoảng 15 m, nên đường phải
    ở ≥ 54 m: đổi `PARK_RADIUS` 38 → 54, `ROAD_RADIUS` 44 → 60, skyline dời theo.
  - Bản xem thử: ô "Văn phòng" trên thẻ E+ của `concepts/index.html` (`parkFrame`, `buildParkLife`).
  - Phương án bị loại: vùng cấm cố định bằng kích thước tối đa (văn phòng nhỏ sẽ nằm giữa bãi cỏ trống
    quá rộng, ki-ốt và người đi bộ ở quá xa camera).
- Camera toàn cảnh và góc nhìn thứ nhất đã nhận `size` từ sàn, chỉ cần truyền kích thước mới.

**Phương án đã cân nhắc**: Neo ở tâm (bị loại: mọi đồ vật bị dời). Cho phép văn phòng hình chữ L (bị
loại: ngoài phạm vi theo Assumptions).

---

## R2-06 · Quy trình 5 concept mẫu (US5)

**Quyết định**:
- Làm **một trang xem concept độc lập** `concepts/index.html`, nằm ngoài sản phẩm và không được
  bundle vào app. Trang có 5 thẻ concept. Mỗi thẻ gồm:
  1. Một cảnh 3D nhỏ dùng chung bộ dựng hình hiện có. Cảnh có văn phòng 4 bàn, 4 nhân viên ở 4 trạng
     thái và nền thành phố có 1 quán cà phê, 1 quán ăn. Chỉ vật liệu, ánh sáng và bảng màu theo concept.
  2. Bản dựng khung chat, bảng quota và thẻ tên bằng HTML/CSS thật, dùng token màu và font của concept.
  3. Bảng mô tả: vật liệu, ánh sáng, bảng màu, font, kiểu nhân vật, kiểu thành phố.
- Trang được công bố riêng tư để người dùng xem. Ảnh chụp được lưu trong
  `specs/002-realistic-ui-refresh/concepts/`.
- Lựa chọn được ghi vào `specs/002-realistic-ui-refresh/concept-decision.md` (mẫu được chọn và góp ý).
  Đây là **cổng chặn**: task của US6 và US7 chỉ bắt đầu khi file này có trạng thái `chosen`.

**5 hướng concept đề xuất** (đều thực tế hơn low-poly hiện tại, lấy cảm hứng từ trang tham khảo
nhưng không sao chép):

| # | Tên | Vật liệu và ánh sáng | Bảng màu | Font (tiêu đề / nội dung) | Nhân vật | Thành phố |
|---|---|---|---|---|---|---|
| A | **Nordic Daylight** | Gỗ sồi sáng, tường trắng ngà, vải nỉ; nắng tự nhiên, bóng mềm | Trắng ấm, xám đá, xanh lá xô thơm | Fraunces / Manrope | Người tỉ lệ thật, phong cách tối giản | Toà nhà kính và đá sáng màu, quán cà phê gỗ |
| B | **Urban Loft** | Gạch trần, bê tông, ống thép đen, đèn Edison; ánh sáng ấm | Đỏ gạch, than chì, vàng đồng | Big Shoulders Display / Archivo | Người tỉ lệ thật, trang phục casual | Phố cũ có ban công, quán ăn có mái hiên |
| C | **Glass HQ** | Kính, đá granite, kim loại xước; ánh sáng lạnh, phản chiếu | Xanh navy, bạc, trắng | Plus Jakarta Sans / Be Vietnam Pro | Người tỉ lệ thật, trang phục công sở | Cao ốc kính, plaza có quán cà phê |
| D | **Saigon Co-working** | Gạch bông, mây tre, gỗ tếch, cây nhiệt đới; nắng gắt, bóng lá | Xanh ngọc, cam đất, kem | Bricolage Grotesque / Lexend | Người tỉ lệ thật, áo phông, áo sơ mi | Nhà phố ống, quán cóc vỉa hè, xe đẩy cà phê |
| E | **Soft Studio** (gần trang tham khảo nhất) | Nhựa mờ, vải bông, bo tròn; bóng mềm, ánh sáng studio | Pastel ấm | Baloo 2 / Nunito | Kiểu hoạt hình 3D, mắt to | Toà nhà bo tròn, quán xinh xắn |

**Lý do**: Năm hướng khác nhau về vật liệu, ánh sáng, nhân vật và typography, không chỉ khác màu
(Acceptance 5.2). Cảnh xem trước dùng chung bộ dựng hình nên rẻ và trung thực với kết quả cuối.

**Phương án đã cân nhắc**: Ảnh vẽ tĩnh (bị loại: không có công cụ vẽ, và không trung thực với 3D
thật). Đưa cả 5 concept vào app làm theme chuyển đổi được (bị loại theo Assumptions; tốn gấp 5 lần
tài nguyên).

---

## R2-07 · Hướng "thực tế hơn" trong 3D, giữ 60 FPS (US6, US7)

**Quyết định** (áp dụng cho mọi concept, tham số cụ thể theo concept đã chọn):
- **Vật liệu PBR** (`MeshStandardMaterial`/`MeshPhysicalMaterial` cho kính). Texture tối đa 1024 px,
  dùng chung bằng atlas.
- **Ánh sáng môi trường** bằng HDRI CC0 (Poly Haven, 1k, đóng gói trong `assets/hdri/`, không tải
  qua mạng), một ánh sáng mặt trời có bóng, tone mapping AgX hoặc ACES.
- **Theo mức chi tiết** (3 mức có sẵn trong `PerfManager`):
  - *Thấp*: không bóng mềm, không AO, ánh sáng ban đêm giả bằng emissive.
  - *Trung bình* (mặc định): bóng PCF mềm cho văn phòng, AO nướng sẵn trong vertex color cho đồ vật.
  - *Cao*: thêm SSAO/N8AO và bóng cho thành phố gần.
  - Khi FPS tụt, giảm thành phố trước, văn phòng sau.
- **Nhân vật**: thay robot bằng bộ nhân vật CC0 có hoạt ảnh Idle, Walk, Sit, Typing, Wave, Stagger
  (ứng viên: Quaternius "Ultimate Animated Characters", CC0). Với concept E thì dùng nhân vật kiểu
  hoạt hình CC0 tương ứng. Thiếu clip nào thì dựng thủ tục (procedural) trong `character.ts`. Mỗi
  file glb ≤ 3 MB, không dùng Draco (FR-082 của tính năng 001: không tải decoder từ CDN). Nén meshopt nếu cần,
  decoder đóng gói kèm.
- **Đồ nội thất**: chuyển dần từ khối hình học sang mô hình CC0 (Poly Haven, Kenney Furniture Kit
  bản chi tiết, Quaternius). Mọi file được ghi vào `assets/LICENSES.md`.
- Ngân sách: tổng tài nguyên tải lần đầu ≤ 25 MB; ≤ 300 draw call ở mức trung bình.

**Lý do**: PBR cộng HDRI là bước nhảy lớn nhất về độ "thật" với chi phí GPU thấp. Phần đắt (SSAO,
bóng thành phố) chỉ bật ở mức Cao.

**Phương án đã cân nhắc**: Path tracing hoặc lightmap nướng toàn cảnh (bị loại: bố cục do người dùng
thay đổi nên không nướng trước được).

---

## R2-08 · Font chữ (US6)

**Quyết định**: Dùng các gói **Fontsource** (`@fontsource-variable/<font>`), cài qua npm. Vite đóng
gói file woff2 vào bản build, nên không có request nào ra Internet (Constitution III, FR-034). Chỉ
nạp subset `latin` + `vietnamese`. Font cụ thể theo concept đã chọn (bảng R2-06). Cả 10 font trong
bảng đều có giấy phép SIL OFL 1.1 và có subset tiếng Việt.

- Dùng 2 họ font: tiêu đề và nội dung. Số và mã dùng font monospace có sẵn (`ui-monospace`).
- `font-display: swap`, preload font nội dung.
- Thẻ tên 3D (`Html` của drei) kế thừa CSS nên tự dùng font mới.
- Kiểm thử e2e: `document.fonts.check('16px "<font>"', 'Đặng Thị Hương Ưng ỡ')` trả về true khi
  chặn mạng ngoài.

**Phương án đã cân nhắc**: Google Fonts CDN (bị loại: kết nối ra ngoài mới, vi phạm Constitution
III). Tự copy woff2 thủ công (bị loại: Fontsource đã đóng gói sẵn kèm giấy phép).

---

## R2-09 · Thành phố thực tế hơn, quán cà phê và quán ăn (US7)

> **Cập nhật 2026-11-07 (góp ý vòng 3)**: thành phố chỉ ở góc camera xa. Văn phòng nằm giữa công
> viên; trong bán kính ≥ 30 m chỉ có công viên (cây, hồ, lối đi, ghế, ki-ốt cà phê). Dãy phố có quán
> nằm ở vòng đường hiện có (`ROAD_RADIUS = 44`), nên "vòng gần" dưới đây là vòng gần **của dãy phố**,
> không phải gần văn phòng. Thêm 1 ki-ốt cà phê trong công viên để vẫn thấy quán từ góc mặc định.

**Quyết định**:
- Thay khối hộp `Blocks` bằng **bộ toà nhà dạng mô-đun**: đế, thân lặp tầng, mái. Thân lặp có texture
  cửa sổ dùng atlas cùng bản đồ emissive cho ban đêm. 6–8 mẫu toà nhà theo concept, mỗi thành phố pha
  lẫn theo hạt giống ngẫu nhiên. Vẫn vẽ bằng `InstancedMesh` theo từng mẫu.
- 3 vòng LOD: vòng gần (≤ 25 m quanh đường) có mặt tiền chi tiết, vòng giữa dùng toà nhà mô-đun đơn
  giản, vòng xa giữ khối kèm texture cửa sổ.
- **Quán**: 2 mẫu quán cà phê và 2 mẫu quán ăn. Mỗi mẫu có biển hiệu (tên hư cấu, vẽ bằng
  CanvasTexture dùng font của concept), mái hiên, bàn ghế ngoài trời, đèn ban đêm. Mỗi thành phố đặt
  ≥ 2 quán mỗi loại ở tầng trệt dọc đường vòng quanh công viên, trong góc nhìn mặc định. Biển hiệu
  theo ngôn ngữ thành phố (ví dụ: "Cà Phê Gió" ở Hà Nội, "Kissa Hoshi" ở Tokyo).
- Công trình biểu tượng hiện có được giữ, nâng vật liệu sang PBR.
- Đèn ban đêm của quán và cửa sổ dùng emissive, không thêm ánh sáng thật (giữ ngân sách).
- `PerfManager` giảm theo thứ tự: tắt vòng gần → bớt toà nhà xa → mới đến văn phòng (FR-044).

**Phương án đã cân nhắc**: Tải mô hình thành phố có sẵn (bị loại: dung lượng lớn, không khớp 5 thành
phố, khó thống nhất phong cách). Dữ liệu bản đồ thật (bị loại: ngoài phạm vi theo Constitution).

---

## R2-10 · Ảnh hưởng tới Constitution

- **Nguyên tắc V** ("low-poly cách điệu, trừ khi spec quyết định khác"): spec 002 (FR-032) quyết
  định đổi phong cách. Hợp lệ, không cần sửa constitution. Nên cập nhật câu chữ ở một lần PATCH sau
  (đề xuất, không chặn).
- **Nguyên tắc III**: không thêm kết nối ra ngoài. Font, HDRI và mô hình đều đóng gói kèm.
- **Nguyên tắc I**: `preferredModel` là lựa chọn giao diện, không phải bản sao dữ liệu App. Hiệu ứng
  va chạm không được che hay đổi trạng thái hiển thị.
