# Concept decision — 002-realistic-ui-refresh

Cổng chặn US6/US7 (plan.md, đợt B0). Chỉ bắt đầu Phase 8–9 khi `status: chosen`.

- **status**: chosen
- **chosen**: E (Soft Studio) — bản kết hợp "E+" (Soft Studio · Sài Gòn)
- **date**: 2026-11-07
- **feedback** (nguyên văn):
  1. Vòng 1: "Thích ánh sáng và màu sắc của D, giữ lại màu sàn của A."
  2. Vòng 2 (chốt E+): "Sửa lại cây cối và khung cảnh xung quanh cho giống thực tế hơn. Bổ sung thêm xe cộ, người tập thể dục, đi bộ trong công viên nữa nhé."
  3. Vòng 3: "Tôi muốn khung cảnh thành phố ở góc camera xa thôi, trong phạm vi văn phòng thì vẫn muốn có công viên bao quanh làm giao diện chính."
  4. Vòng 4: "Tôi muốn thêm không gian trống nhiều hơn để có thể mở rộng văn phòng hơn nữa, như hiện tại nếu mở rộng văn phòng sẽ dễ bị dính vào cây cối và quán xung quanh."
- **preview**: https://claude.ai/artifact/P3UD3QsTaxNMyJKiXENQiW, thẻ "E+" (preset `id: 'f'` trong `concepts/index.html`)

## Diễn giải góp ý

| Lấy từ | Phần |
|---|---|
| **E** Soft Studio | Hình khối bo tròn (bo 6 cm cho đồ vật), nhân vật kiểu hoạt hình 3D (đầu to, mắt tròn), font Baloo 2 / Nunito, bo góc UI 20 px, ô dù ở quán, đèn và bóng mềm (VSM). Toà nhà bo góc và cây tán tròn của E bị thay ở vòng 2 |
| **D** Saigon Co-working | Ánh sáng (nắng nhiệt đới, ánh đèn vàng ban đêm), toàn bộ bảng màu (3D, UI sáng/tối, trang phục nhân viên, màu phố, quán) |
| **A** Nordic Daylight | Sàn gỗ sồi sáng |
| Vòng 2 | Cảnh **bên ngoài** văn phòng dựng thật hơn (không bo tròn kiểu đồ chơi): phố nhà ống, cây thật, xe cộ, người trong công viên. Văn phòng và nhân viên vẫn theo E |

## tokens

### UI (`src/web/styles.css`)

| Token | Sáng | Tối |
|---|---|---|
| `--bg` | `#f5eedf` | `#121819` |
| `--panel` | `#fffaf0` | `#1a2222` |
| `--text` | `#2a221a` | `#f1e8d8` |
| `--muted` | `#74675a` | `#a49a8b` |
| `--accent` | `#1f6f6a` | `#5fb3a9` |
| `--accent-ink` | `#ffffff` | `#0f1a19` |
| `--line` | `#e6dac3` | `#2c3534` |
| `--chip` | `#e4efe7` | `#203130` |
| `--accent-2` (nhấn phụ) | `#c2603a` | `#e08a66` |
| `--radius` | 20px | 20px |

Màu trạng thái giữ nguyên ngữ nghĩa: đang làm `#2f9e6b`, chờ sếp `#e0a21b`, lỗi `#d1453b`, rảnh `#8a8f98`.

### Font

- Tiêu đề: **Baloo 2** (800), nội dung: **Nunito** (400/600/800). Cả hai SIL OFL 1.1, có subset tiếng Việt.
- Sản phẩm: `@fontsource-variable/baloo-2`, `@fontsource-variable/nunito` (T065), không tải từ mạng.

### 3D (`src/web/theme/concept.ts`)

| Nhóm | Giá trị |
|---|---|
| Bo cạnh đồ vật | 0,06 m (RoundedBox) |
| Sàn | gỗ sồi sáng `#dcc09a` / `#cfae82`, ron `#b9966b` |
| Tường | vôi kem `#eadcbc` / `#dfcea9`, khung `#fffaf0` |
| Bàn | mặt kem `#fffaf0`, chân tròn xanh ngọc `#1f6f6a` |
| Ghế | màu mây `#c99a5b`, khung `#fffaf0` |
| Thảm | tròn `#9cc9bd` |
| Cây / chậu | `#2f7a45` / đất nung `#c2603a` |
| Đèn trần | chụp mây tre `#c99a5b` |
| Ánh sáng ngày | trời `#bfe0ec`, đất `#d9c79f`, mặt trời `#fff0c8` cường độ 3.0, hemi 0.8, env 0.4, exposure 1.0 |
| Ánh sáng đêm | trời `#0d1a1f`, đèn trong nhà `#ffc977` |
| Bóng | VSM, radius 8 (mềm) |
| HDRI | CC0 ban ngày nắng ấm, ban đêm đô thị (chọn khi làm T068) |

### Nhân vật

- Kiểu hoạt hình 3D (concept E): đầu to, mắt tròn, má hồng, tóc khối.
- Da: `#ffd9c2`, `#e8bf9c`, `#ffe3cf`, `#c98d6a`. Tóc: `#1a1513`, `#2b211b`, `#5a3b22`, `#1f1814`.
- Trang phục (áo/quần): `#f2c94c`/`#1f6f6a`, `#fffaf0`/`#c2603a`, `#2f80a5`/`#efe4cc`, `#c2603a`/`#3b3b3b`.
- T069: tìm bộ nhân vật CC0 kiểu hoạt hình có Idle/Walk/Sit/Typing/Wave; nếu không có thì dựng thủ tục theo tỉ lệ bản phác thảo.

### Bố cục cảnh (vòng 3)

- Văn phòng nằm giữa công viên. Trong bán kính ≥ 30 m chỉ có công viên: lối đi vòng quanh văn phòng,
  lối đi thẳng ra phố, hồ nước có bờ đá và lá súng, ghế đá, ki-ốt "Cà Phê Công Viên" (nhìn thấy từ góc
  camera mặc định), cây rải khắp công viên (tránh lối đi, hồ, và tầm nhìn từ camera tới văn phòng).
- Dãy phố (đường, vỉa hè, xe cộ, cột điện, nhà ống, quán) ở xa (bản xem thử: 54 m từ tâm văn phòng); cao ốc kính
  ở vòng xa hơn. Sương mù bắt đầu từ 45 m để phố mờ dần, văn phòng luôn là trung tâm.
- **Vòng 4, công viên tự giãn theo văn phòng**: dải cỏ trống ≥ 5 m tới lối đi và ≥ 8 m tới cây gần nhất;
  lối đi, ghế, ki-ốt, hồ, nhóm tập thể dục đặt tương đối với văn phòng nên tự dời ra khi mở rộng; cây lấy
  từ một tập cố định, chỉ ẩn những cây rơi vào vùng trống. Văn phòng tối đa 40 × 40 m vẫn có công viên
  ≥ 15 m tới đường: đường dời ra xa (`PARK_RADIUS` 38 → 54, `ROAD_RADIUS` 44 → 60). Dùng ô "Văn phòng"
  trên thẻ E+ để xem 6×5, 16×12, 28×20, 40×40 m.

### Thành phố và công viên (vòng 2)

- Phố nhà ống có ban công, cửa chớp xanh `#2f7a5a`, cây trên ban công, bồn nước; cột điện và dây điện
  võng. Màu nhà `#f2c14e`, `#9ccfb4`, `#f2a7a0`, `#e8e1cf`, `#7fb3d5`, `#f4d58d`, `#c9e4ca`, `#f0b07a`.
  Các thành phố khác dùng kiểu nhà đặc trưng của thành phố đó, cùng mức độ thực tế.
- Cỏ có texture nhiều sắc xanh (`#8fb26a`), quảng trường `#efe4cc`, đường `#4b4d50`, vỉa hè `#d8cab2`.
- Cây: tán nhiều tầng lá (nhiều cụm, 4 sắc xanh quanh `#3d7f3f`, thân có cành), cây ra hoa (phượng
  `#e0503a`), hàng dừa trên vỉa hè, bụi cây ven lối đi, bồn hoa.
- Công viên: lối đi bộ vòng quanh văn phòng, ghế đá, đèn công viên (sáng về đêm).
- Người trong công viên (kiểu nhân vật E, quần áo thể thao): người đi bộ, người chạy bộ theo hai chiều,
  nhóm tập thể dục trên bãi cỏ, người ngồi đọc sách trên ghế đá.
- Xe cộ: xe hơi, xe máy (có người lái, đội mũ bảo hiểm), xe buýt xanh; chạy hai chiều theo làn; đèn
  pha và đèn hậu sáng về đêm.
- Quán: "Cà Phê Vỉa Hè" (mặt tiền `#1f6f6a`, mái sọc xanh ngọc/kem, biển `#c2603a`), "Cơm Tấm Cô Ba" (mặt tiền `#c2603a`, mái sọc đỏ/kem, biển `#f2c14e`), ô dù `#1f6f6a` / `#c2603a`.
- Tên quán cho 4 thành phố còn lại đặt khi làm T077, cùng phong cách.
