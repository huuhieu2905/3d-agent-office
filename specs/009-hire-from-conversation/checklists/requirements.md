# Checklist chất lượng đặc tả: Tuyển nhân viên từ conversation có sẵn

**Mục đích**: Kiểm tra đặc tả đủ và đạt chất lượng trước khi lập plan
**Ngày tạo**: 2026-11-11
**Feature**: [spec.md](../spec.md)

## Chất lượng nội dung

- [x] Không có chi tiết triển khai (ngôn ngữ, framework, API)
- [x] Tập trung vào giá trị cho người dùng và nhu cầu thực tế
- [x] Viết cho người không chuyên kỹ thuật đọc được
- [x] Đã điền đủ các mục bắt buộc

## Độ đầy đủ của yêu cầu

- [x] Không còn đánh dấu [NEEDS CLARIFICATION]
- [x] Yêu cầu kiểm thử được và không mơ hồ
- [x] Tiêu chí thành công đo được
- [x] Tiêu chí thành công không phụ thuộc công nghệ
- [x] Đã định nghĩa đủ kịch bản chấp nhận
- [x] Đã xác định các trường hợp biên
- [x] Phạm vi được giới hạn rõ
- [x] Đã nêu phụ thuộc và giả định

## Mức sẵn sàng của tính năng

- [x] Mọi yêu cầu chức năng có tiêu chí chấp nhận rõ
- [x] Kịch bản người dùng bao phủ các luồng chính
- [x] Tính năng đạt các kết quả đo được trong Tiêu chí thành công
- [x] Không có chi tiết triển khai lọt vào đặc tả

## Ghi chú

- Đạt ngay lần kiểm tra đầu. Các mặc định tự chọn khi không hỏi: không đưa subagent vào danh sách; ẩn bộ chọn Model ở chế độ conversation có sẵn.
- Kiểm tra lại sau phần làm rõ (2026-11-11): văn phòng = tối đa 20 thành viên do người dùng tạo/chọn, văn phòng đầy thì chặn tuyển kèm cảnh báo. Mặc định thêm: hành động "Remove from office" (giữ conversation; người dùng xác nhận giữ cả hai nút), subagent không tính vào 20, lần chạy đầu lấy thành viên từ các nhân viên đang hiện. Vẫn đạt.
- Sửa spec (2026-11-11) theo yêu cầu của người dùng: văn phòng đầy thì không chặn tuyển nữa, mà cho thành viên rảnh lâu không hoạt động nhất tự rời đi. Mặc định tự chọn: không cho người đang bận rời đi; nếu cả 20 đều bận thì chặn và báo; hộp thoại báo trước ai sẽ rời đi. Vẫn đạt.
