# Research: Đời sống văn phòng — tương tác đồ vật, đi ra công viên, xoá nhân viên

**Feature**: `004-office-life-interactions` | **Date**: 2026-11-09

Nguồn bằng chứng: mã nguồn hiện tại. Feature này không cần thêm RPC mới. `DeleteCascadeTrajectory`
đã nằm trong `USED_RPCS` và đang được dùng để dọn dữ liệu trong các test live chạy trên 2.29.0
(`tests/live/sweep.ts`, `*.live.test.ts`).

---

## R4-01. Panel chú giải: thu gọn và lưu trạng thái

**Decision**:
- Thêm `legendCollapsed?: boolean` vào `Settings` (zod: `.optional()`), lưu qua `PUT /api/settings`
  giống `camera`.
- `ProjectLegend` có nút ▾/▸. Khi thu gọn, chỉ còn nút "Dự án (n)", kèm chấm màu nếu đang có dự án
  được làm nổi bật (FR-004).
- Khi mở: `max-height: calc(100vh - <top> - 16px)` cộng `overflow-y: auto`. Bỏ `flex-wrap` để liệt
  kê theo cột, dễ cuộn.

**Rationale**: Settings đã là nơi lưu tuỳ chọn giao diện (Nguyên tắc I cho phép). Server lưu thì
trạng thái giữ được qua các trình duyệt hoặc cửa sổ riêng tư.

**Alternatives considered**:
- `localStorage`: ít code hơn một chút, nhưng mất trạng thái trong cửa sổ riêng tư và lệch với cách
  lưu `camera` / `theme`.
- Trường bắt buộc trong schema: **không được**. `JsonStore` gặp file không qua `safeParse` sẽ trả về
  mặc định, tức là xoá sạch cài đặt cũ của người dùng. Mọi trường mới PHẢI là optional.

## R4-02. Xoá nhân viên = xoá conversation trong App

**Decision**:
- Adapter có thêm `deleteConversation(id)`, gọi `DeleteCascadeTrajectory { cascadeId }`. RPC này đã
  có trong `USED_RPCS`.
- Route mới `DELETE /api/conversations/:id` nằm trong `routes/conversations.ts`. Guard (c) được mở
  rộng thêm `deleteConversation`.
- Trước khi xoá, server **kiểm tra lại trạng thái ngay lúc đó** (FR-015): gọi `listConversations()`
  và `getSteps()` của đúng conversation đó, rồi dùng `computeVisualState`. Nếu kết quả là `working`,
  `thinking` hoặc `waiting_for_boss`, hoặc `runStatus` là `CANCELING`, thì trả `409 AGENT_BUSY`.
- Sau khi App xác nhận: `profiles.update(id, { deskId: null })` rồi `employees.refresh()`. Bản vá
  `employees.patch` có `removed: [id]`. Client đã có sẵn luồng `leaving`
  (`employee-lifecycle.ts`), nên nhân viên tự đi ra cửa.
- Nếu App lỗi hoặc mất kết nối thì trả 503/502. Server không đụng vào profile, nên nhân viên ở lại
  (FR-014).
- Client: nút 🗑 trong `chat-head`. Nút bị khoá khi `visualState ∈ {working, thinking,
  waiting_for_boss}`, kèm tooltip "Dừng agent trước khi xoá". Bấm vào thì mở `ConfirmDeleteDialog`:
  hiện tên conversation, nút mặc định là "Huỷ", nút xoá màu đỏ.

**Rationale**:
- Không cần RPC mới, và RPC này đã chạy thật trên 2.29.0 trong test live.
- Kiểm tra lại ở server chặn được trường hợp trạng thái đổi trong lúc hộp xác nhận đang mở
  (acceptance US2-6).
- Tận dụng luồng nhân viên rời văn phòng sẵn có.

**Alternatives considered**:
- Chỉ kiểm tra ở client: không chặn được trường hợp agent vừa bắt đầu chạy.
- Tự gọi `cancel` rồi xoá: người dùng đã loại phương án này ở Clarifications.

**Subagent con** (người dùng xác nhận, 2026-11-09): xoá conversation cha thì App **xoá luôn mọi
subagent con** (theo `parentId`, mọi cấp). Hệ quả:
- Kiểm tra "bận" áp dụng cho **cả cây**: cha hoặc một con bất kỳ đang bận thì trả `409 AGENT_BUSY`, và
  nút 🗑 bị khoá.
- Hộp xác nhận nêu số subagent sẽ bị xoá theo, ví dụ "và 2 subagent con".
- Nhân viên con rời văn phòng bằng cùng bản vá `removed`, vì lần `refresh` sau App không còn liệt kê
  chúng. Server đặt `deskId = null` cho cả cây.
- Xoá một subagent con thì chỉ xoá con đó (và các con của nó), không đụng tới cha.
- Live test A4-1d kiểm chứng việc App xoá theo cả cây.

## R4-03. Đi ra ngoài văn phòng: một lưới chung cho cả khu đất (`SiteGrid`)

**Vấn đề**: `OfficeGrid` chỉ phủ sàn văn phòng. `Crowd.step`, A* và `fp-motion.slide` đều chặn mọi
ô nằm ngoài lưới, nên cả nhân viên lẫn người dùng đều không ra được ngoài.

**Decision**: Thêm `src/shared/site-nav.ts` với lớp `SiteGrid`. Lớp này có **cùng giao diện** với
`OfficeGrid` (`toCell`, `toWorld`, `walkable`, `canStep`, `inside`, `neighbours`, `width`), ô cũng
0.25 m, và phủ một hình vuông bao quanh công viên.
- Các ô nằm trong sàn văn phòng hỏi lại `OfficeGrid` (lệch một số nguyên ô, nên toạ độ khớp tuyệt
  đối).
- Cạnh chu vi văn phòng bị chặn, trừ các ô của cửa chính. Vì vậy tường và kính vẫn chặn (FR-034).
- Ô ngoài trời đi được nếu nằm trong `PARK_RADIUS − 1` và không trúng vật cản. Vật cản gồm hình chữ
  nhật của quán (R4-04) và vòng tròn thân cây (0.35 m) của **đúng bộ cây đang được vẽ** theo mức chi
  tiết.
- Phần ngoài trời không lưu mảng mà tính khi được hỏi. Cây được tra qua một bảng băm 4 m, nên mỗi
  lần hỏi chỉ xét vài cây.

Sau đó `Crowd`, `fp-motion` và `EmployeeBrain` nhận một `SiteGrid` thay cho `OfficeGrid`.

**Một hệ ô duy nhất**: `Crowd.occupiedCells` trả về chỉ số ô theo `width` của lưới mà `Crowd` đang
dùng. Nếu brain chạy A* trên `OfficeGrid` mà lấy ô bận từ `Crowd` trên `SiteGrid` thì chỉ số sẽ lệch.
Vì vậy brain chạy A* trong nhà trên `site.indoorView()`: cùng hệ ô của `SiteGrid`, nhưng `inside()`
và `neighbours()` chỉ nhận ô trong sàn. Như vậy A* không bao giờ "đi đường vòng" ra ngoài cửa, và
vùng tìm kiếm vẫn chỉ là sàn văn phòng.
`OfficeGrid` vẫn được giữ cho build mode, việc kiểm tra bố cục ở server và A* trong nhà.

**Đường đi ngoài trời**: không chạy A* trên lưới khoảng 400 × 400 ô. Hàm thuần `outdoorRoute(frame,
door, spot)` trả về một đường gấp khúc theo toạ độ thế giới:
- Từ ô cửa đi thẳng ra 1.5 m.
- Từ đó đi thẳng qua bãi cỏ tới điểm gần nhất trên vòng đường dạo. Bãi cỏ luôn trống cây
  (`CLEAR = 8`).
- Đi dọc vòng đường dạo theo chiều ngắn hơn.
- Rẽ vào chỗ ngồi hoặc chỗ đứng của quán.

Trong nhà vẫn dùng A* như cũ, từ bàn ra ô cửa. `Crowd` lo việc tránh người trên toàn tuyến. Khi bị
kẹt ngoài trời, nhân viên bỏ qua một điểm trung gian (như hiện tại). Họ không cần lập lại đường, vì
ngoài trời không có ngõ cụt.

**Rationale**: Dùng lại toàn bộ cơ chế va chạm, tránh người và trượt dọc tường đang chạy tốt. Không
có hệ thống va chạm thứ hai, và người dùng lẫn nhân viên theo cùng một luật.

**Alternatives considered**:
- Một lưới ngoài trời thứ hai, rồi nối hai lưới ở cửa: `Crowd` phải biết cả hai lưới, phức tạp hơn.
- A* trên toàn `SiteGrid`: khoảng 150 nghìn ô, tốn tới hàng chục ms mỗi lần, và không cần thiết vì
  bãi cỏ đã trống sẵn.
- Thư viện vật lý hoặc navmesh: thêm phụ thuộc, vượt quá nhu cầu (Nguyên tắc IV, VI).

## R4-04. Quán hàng quanh công viên

**Decision**:
- Hàm thuần `parkShops(frame)` trong `park-layout.ts` trả về 4 quán, đặt sát mép ngoài vòng đường dạo
  ở 4 góc khác nhau:
  - quán cà phê kiosk (thay `kioskSpot` cũ, giữ đúng vị trí cũ),
  - tạp hoá,
  - xe nước mía,
  - xe bánh mì.
- Mỗi quán có `footprint` (để chặn), `seats` (ghế đẩu, 2–4 chỗ, quay mặt vào quán) và `stands` (1–2
  chỗ đứng trước quầy).
- Vẽ bằng `Shop` / `Kiosk` sẵn có trong `city/Shops.tsx`. Thêm kiểu `grocery` và `cart` (xe đẩy nhỏ
  có mái che), cùng bảng màu concept. Tên quán là tên hư cấu, như `city-layout.ts`.
- `treeAllowed` loại thêm vùng 4 m quanh mọi quán.
- Vì vị trí quán đi theo `parkFrame`, quán tự dời khi văn phòng mở rộng và không bao giờ lấn vào bãi
  cỏ (FR-026).

**Rationale**: Dùng lại component đã đạt concept. Vị trí quán cũng tính bằng hàm thuần, nên kiểm thử
được như `park-layout.test.ts`.

**Alternatives considered**: Dùng các quán trên phố của thành phố. Bị loại vì chúng nằm sau vòng
đường xe chạy (60 m), quá xa và phải băng qua đường.

## R4-05. Chọn hoạt động nghỉ và giữ chỗ

**Decision**:
- Thêm module thuần `src/web/scene/break-spots.ts` với lớp `SpotBook`. Mỗi cảnh có một `SpotBook`
  chung, giữ chỗ cho:
  - ghế sofa: 2 chỗ mỗi sofa, nằm thì giữ cả 2;
  - ghế và chỗ đứng ở quán;
  - suất "ra ngoài": tối đa `max(1, floor(n/3))` (FR-024).
  - `SpotBook` cũng biết chỗ nào người dùng đang ngồi ở góc nhìn thứ nhất (FR-032).
- `EmployeeBrain.startBreak` chọn hoạt động theo trọng số trong số những hoạt động còn khả dụng (đồ
  vật có tồn tại và còn chỗ):

  | Hoạt động | Trọng số | Thời gian ở nơi đến |
  |---|---|---|
  | vươn vai | 0.15 | 3.5 s (như cũ) |
  | uống nước | 0.30 | 3 s (như cũ) |
  | sofa: ngồi (60%) / nằm (40%) | 0.25 | 20–90 s |
  | ghé quán: ngồi (70%) / đứng (30%) | 0.30 | 20–90 s |

- Chỉ chọn quán có tuyến đường **≤ 55 m** tính từ cửa (R4-06).
- Nhịp nghỉ giữ 5 ± 2 phút. `?debug=crowd` và `breakMeanMs` tiếp tục dùng để rút ngắn khi thử.

**Mode mới của brain**:
- `{ kind: 'outing'; pts: {x,z}[]; i; then: 'shop' | 'home' }`: đi theo đường gấp khúc ngoài trời.
- `{ kind: 'resting'; at: Spot; pose: 'sit' | 'lie' | 'stand'; until }`: ngồi hoặc nằm ở sofa, ngồi
  hoặc đứng ở quán.
- Chuỗi ra quán:
  1. `walking` (A* tới ô cửa, `then: 'go-out'`)
  2. `outing` tới quán
  3. `resting`
  4. `outing` về cửa (`then: 'home'`)
  5. `walking` (A* về bàn, `then: 'sit'`)
- Sofa: `walking` tới ô trước sofa, rồi "ngồi xuống" ở toạ độ chỗ ngồi. `crowd.place(seated)` được
  gọi giống chỗ ngồi ở bàn.

**Clip mới** (hoạt hình thủ tục, chỉ cần thêm tư thế đích cho các khớp trong `character.ts`):
- `Lying`: nằm nghiêng trên sofa, mắt nhắm.
- `Drinking`: tay cầm cốc đưa lên. `drink` hiện dùng `Yes`, sẽ đổi sang clip này.

Không cần tài nguyên ngoài (Nguyên tắc V, giấy phép).

**Rationale**: `SpotBook` là một nơi duy nhất trả lời "chỗ này còn trống không", nên không bao giờ có
hai người ngồi chồng lên nhau (US3-3, SC-004).

**Alternatives considered**: Để từng brain tự hỏi `Crowd` xem chỗ có trống không. Cách này có tranh
chấp khi hai người cùng chọn một chỗ trong cùng một khung hình.

## R4-06. Quay về khi có việc trong ≤ 30 s

**Phép tính**:
- Văn phòng lớn nhất là 40 × 40 m, nên vòng đường dạo có bán kính khoảng 34 m.
- Nửa vòng dài khoảng 107 m. Đi bộ 1.1 m/s thì mất khoảng 97 s, vượt xa 30 s.

**Decision**:
1. Chỉ chọn quán có tổng tuyến đường (cửa → quán) ≤ 55 m. Luôn có ít nhất quán gần cửa nhất, vì có 4
   quán ở 4 góc.
2. Khi bị gọi về (`setVisual` sang trạng thái có việc), nhân viên **chạy về** với tốc độ 2.8 m/s
   (clip `Walking` với `timeScale` 1.8).
   - Phần ngoài trời mất ≤ 55 / 2.8 ≈ 20 s.
   - Phần trong nhà (≤ khoảng 20 m) mất ≤ 7 s.
   - Tổng < 30 s.
3. Nhãn trạng thái trên đầu (`BADGE` trong `Employee.tsx`) không phụ thuộc vị trí, nên vẫn đổi trong
   ≤ 2 s như hiện tại (FR-023).
4. Đang `resting` thì đứng dậy ngay. Nếu bị kẹt chỗ đứng dậy thì thử lại ở khung hình sau, như
   `standUp()`.

**Alternatives considered**: Dịch chuyển tức thời về bàn. Phá cảm giác thực tế và va chạm, nên loại.

## R4-07. Góc nhìn thứ nhất: đi ra ngoài, va chạm

**Decision**:
- `FirstPersonCamera` nhận `SiteGrid`. `slide()` giữ nguyên thuật toán. Kết quả:
  - đi ra được qua cửa;
  - bị chặn bởi tường, kính, quán, thân cây và rìa công viên (FR-035);
  - không rơi khỏi cảnh, vì ô ngoài `PARK_RADIUS − 1` không đi được.
- Người dùng được đăng ký vào `Crowd` như một agent có `priority` cao nhất và id `__player__`.
  Nhân viên vì vậy đi vòng quanh người dùng. Nhân viên cũng chặn người dùng: `freeAt` kiểm tra thêm
  khoảng cách tới các vị trí trong `positions`.
- Vị trí xuất phát giữ như cũ (trong sảnh, cạnh cửa).
- Cửa: đổi `Door` (hiện chỉ là tấm thảm) thành cửa kính trượt. Cửa tự mở khi có người dùng hoặc nhân
  viên trong bán kính 1.5 m (FR-034), chỉ để nhìn, không ảnh hưởng va chạm.

## R4-08. Tương tác đồ vật (góc nhìn thứ nhất và toàn cảnh)

**Decision**:
- Module thuần `src/web/scene/interaction/interactables.ts`. Từ `layout.items` cùng tâm thế giới của
  từng đồ vật, module này dựng danh sách thứ dùng được: `wall_screen`, `sofa`, `water_cooler`,
  `plant`. Cửa không nằm trong danh sách vì cửa tự mở (FR-034).
- Hàm `aimTarget(camera, list)` chọn đồ vật gần tâm ngắm nhất: trong 2 m, góc lệch ≤ 12°. Đây là cùng
  cách ngắm `AIM_COS` đang dùng để chọn nhân viên.
- Phím **E** hoặc bấm chuột để tương tác. Bấm chuột ưu tiên nhân viên (giữ 1 lần bấm để chat), sau
  đó mới tới đồ vật. Gợi ý "E — <hành động>" hiện dưới tâm ngắm.

**Hành vi từng đồ vật**:
- **Màn hình**: bật/tắt. Lưu trong `Settings.screensOff?: string[]` (id các màn hình **đã tắt**).
  **Đổi khi làm** (2026-11-09): màn hình đầu tiên vốn hiện quota (001 FR-040), và bấm vào nó mở bảng
  quota (001 FR-043). Vì vậy mặc định mọi màn hình **bật**; màn hình quota tắt thì không hiện quota.
  Ở toàn cảnh, bật/tắt bằng nút ⏻ nhỏ dưới màn hình (bấm vào màn hình quota vẫn mở bảng quota).
  - Khi bật: mặt màn hình phát sáng và hiện một bảng nhỏ vẽ bằng canvas, gồm giờ và số nhân viên
    theo trạng thái. Chỉ dùng dữ liệu đã có ở client.
  - Id của màn hình đã bị xoá được tự bỏ khi lưu.
  - Ở toàn cảnh (không ở build mode), bấm vào màn hình cũng bật/tắt được.
- **Sofa**: ngồi hoặc nằm. Mắt hạ xuống 1.05 m khi ngồi, 0.6 m khi nằm, và camera đặt tại chỗ ngồi
  đã giữ trong `SpotBook`. Bấm WASD hoặc E thì đứng dậy, đặt ở ô đi được gần nhất trước sofa.
- **Bình nước**: hiện cốc nước trước camera trong 1.5 s. Không khoá di chuyển.
- **Cây**: hiện tia nước (vài hạt) trong 1.5 s. Cây "tươi hơn" trong 60 s: lá sáng hơn và rung nhẹ
  qua `PropJiggle`. Trạng thái này chỉ ở bộ nhớ (`useUi`), không lưu.

**Rationale**:
- Dùng lại cách ngắm đã có.
- Chỉ trạng thái màn hình cần lưu (US4-2). Những trạng thái khác là hiệu ứng tạm thời (Assumptions
  của spec).

## R4-09. Những tình huống làm gián đoạn hoạt động nghỉ

| Sự kiện | Xử lý |
|---|---|
| Vào build mode | Mọi brain đang `outing` hoặc `resting` gọi `recall()`, tức là về bàn. Người dùng đang ngồi sofa (FP) thì không xảy ra, vì build mode luôn ở toàn cảnh |
| Bố cục đổi (sofa, bình nước hay cây bị xoá hoặc dời) | Lưới được dựng lại. `SpotBook.revalidate(layout)` huỷ các chỗ không còn, brain đang giữ chỗ đó sẽ `recall()` |
| Đổi vị trí cửa hoặc đổi kích thước văn phòng | Dựng lại `SiteGrid`, rồi brain ngoài trời lập lại `outdoorRoute` tới cửa mới |
| Mất kết nối (`disconnected`) | Brain đang ở ngoài hoặc ở sofa thì `recall()` rồi mới đứng yên. Hiện nay brain đứng yên tại chỗ |
| Xoá nhân viên khi đang ở ngoài | `leave()` từ ngoài trời: nhân viên đi thẳng về phía đường ở rìa gần nhất rồi biến mất, không quay vào văn phòng |
| Thời tiết chuyển `rain` / `storm` (Clarifications) | Không chọn "ghé quán". Brain đang `outing` hoặc `resting` ngoài trời gọi `recall({ umbrella: true })`: hiện ô (mesh thủ tục gắn tay phải, dùng lại màu dù của quán), chạy 2.8 m/s về cửa; ô tắt khi bước vào ô trong sàn. `fog_snow` và ban đêm không chặn. Tạnh giữa chừng: vẫn về |
| Mọi quán đều hết chỗ, hoặc đã đủ suất ra ngoài | Loại hoạt động "ghé quán" khỏi lựa chọn của lần nghỉ đó |

## R4-10. Hiệu năng

**Decision**:
- Bốn quán dùng lại material dùng chung. Ở mức chi tiết `low`, quán không có ghế đẩu và dù.
- Truy vấn ô ngoài trời đi qua bảng băm cây 4 m, nên tốn O(vài cây) mỗi lần.
- `outdoorRoute` chỉ được tính khi bắt đầu một chuyến đi.
- Bench (`src/web/bench`) thêm kịch bản "outing": số nhân viên tối đa, rút khoảng nghỉ xuống 10 s, đo
  FPS (SC-007).

**Rationale**: Nguyên tắc V. Đo bằng GPU thật, lấy kết quả từ lần đo thứ hai trở đi.
