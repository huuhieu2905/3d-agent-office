# Đề xuất sửa Constitution (PATCH) — từ tính năng 002

**Trạng thái**: đã duyệt và áp dụng ngày 2026-11-07 qua `/speckit-constitution` (research.md R2-10,
task T089). Constitution lên bản **2.0.1**; cả hai mục dưới đây đã được đưa vào
`.specify/memory/constitution.md`.

## 1. Nguyên tắc V — phong cách tài nguyên 3D

Hiện tại:

> Mọi tài nguyên 3D PHẢI theo một phong cách thống nhất (mặc định là low-poly cách điệu, trừ khi spec quyết định
> khác) và PHẢI có giấy phép cho phép dùng phi thương mại, được ghi lại nguồn và giấy phép.

Đề xuất:

> Mọi tài nguyên 3D PHẢI theo một phong cách thống nhất — concept đã chốt trong
> `specs/002-realistic-ui-refresh/concept-decision.md` ("Soft Studio · Sài Gòn") trừ khi một spec sau quyết định
> khác — và PHẢI có giấy phép cho phép dùng phi thương mại, được ghi lại nguồn và giấy phép.

Lý do: spec 002 (FR-032) đã thay phong cách mặc định; câu chữ hiện tại vẫn đúng ("trừ khi spec quyết định
khác") nhưng gây hiểu nhầm cho người đọc constitution mà không đọc spec 002.

## 2. Cổng chất lượng 4 — đo hiệu năng và e2e trên GPU

Đề xuất thêm một câu vào "Cổng chất lượng" mục 4:

> Kiểm tra hiệu năng và e2e PHẢI chạy trên GPU thật (Chromium với ANGLE/Metal); kết quả đo bằng render
> phần mềm (SwiftShader) không được dùng để kết luận đạt hay không đạt. Lấy kết quả của lần đo thứ hai trở
> đi (lần đầu sau khi build là lần khởi động nguội).

Lý do: trong 002, cùng một cảnh đạt khoảng 122 FPS trên GPU nhưng làm e2e treo 15 phút trở lên khi Chromium
headless rơi về SwiftShader.

## Phân loại

Cả hai là PATCH (làm rõ câu chữ, không đổi ý nghĩa nguyên tắc): 2.0.0 → 2.0.1 (đã áp dụng).
