# Phạm vi quản trị và cách nghiệm thu

| Trang hoặc phần hiện có | Dữ liệu v25 | Thao tác trong admin | Đối chiếu |
|---|---|---|---|
| Trang chủ, dòng chạy, thẻ liên hệ và sáu trang chi tiết | Tên, chức danh, hotline, địa chỉ, ảnh đại diện | Liên hệ, lưu từng trường, chọn file ảnh và xem trước | Đổi hotline rồi tải lại bảy trang. Kiểm tra chữ, link gọi và ticker. |
| Banner và ảnh dịch vụ | Sáu slide và sáu ảnh | Ảnh & poster, lưu từng ảnh, thêm/sửa/xóa/ẩn/đổi thứ tự slide | Xem WebP đã lưu. Kiểm tra slide tự chạy và các nút chuyển ảnh. |
| Danh sách giải pháp, menu, trang chi tiết và form | Sáu dịch vụ | Dịch vụ, sửa/ẩn/sắp xếp hoặc thêm trang dịch vụ riêng | Mở tất cả URL cũ. Ẩn một dịch vụ và kiểm tra thẻ, form, URL chi tiết. Tạo một dịch vụ và mở URL mới. |
| Popup và bảng giá theo từng dịch vụ | 159 dòng gói và thiết bị | Gói cước, lưu từng gói hoặc danh sách của dịch vụ được chọn | Sửa một gói trong popup Tendoo rồi xem lại trang chi tiết. Chọn gói và kiểm tra form tự điền. |
| Góc khám phá | Năm video YouTube và một MP4 | Video, nhập ID/link/playlist/MP4, gắn dịch vụ | Mở danh sách video, xem link gốc, thử nút tư vấn. |
| FAQ, tiêu đề, menu, nội dung trang và thông báo | Bốn câu FAQ và nội dung HTML | FAQ, Trang khách, lưu từng phần, bật/tắt khu vực hoặc thêm khối trước form | Sửa tiêu đề, ẩn FAQ, thêm khối rồi tải lại đúng trang. |
| Form và popup xác nhận | Google Apps Script v25 | Form gửi vào Neon. Yêu cầu tư vấn có giá lúc gửi, trạng thái và tuỳ chọn nhận nhắc | Kiểm tra email/điện thoại/đồng ý, gửi cùng mã hai lần, thử gói vừa ẩn, đối chiếu hai email. |
| Lịch Zoom và TAMMI | Apps Script và cấu hình nhóm | Lịch Zoom trong admin, TAMMI từ biến máy chủ | Kiểm thử cửa sổ 30 phút, đúng dịch vụ, gửi một lần và bỏ qua sau giờ bắt đầu. Đối chiếu link TAMMI trong mail khách. |
| Bảng Google Sheets | Sheet v25 | Xuất theo nút trong Yêu cầu tư vấn, nhập v25 qua CLI | Xuất hai lần, so số mã duy nhất. Dry-run, import hai lần và kiểm tra mốc nhắc cũ. |

Các nhóm giữ theo v25. Giá và thông số kỹ thuật cần anh Hùng đối chiếu theo bảng Viettel hiện hành trước khi công bố.


## Kết quả kiểm thử local

- Build production Next.js thành công. Đối chiếu tiêu đề, font, màu và chiều rộng bố cục của bảy trang với v25 ở 390 px và 1440 px. Kiểm tra popup Tendoo, link chọn dịch vụ cũ và đủ 159 dòng báo giá.
- Thử đăng nhập, chặn API quản trị khi chưa đăng nhập, lưu riêng hotline, thay ảnh WebP, sửa tiêu đề, đổi giá, mở playlist, ẩn FAQ, thêm thông báo và thử dịch vụ mới.
- Thử form trực tiếp trên Chrome, thiếu đồng ý, email sai, gói/dịch vụ vừa ẩn, gửi lặp, Resend chấp nhận, Resend lỗi và thiếu cấu hình. Kiểm tra hai email độc lập và link TAMMI trong email khách.
- Thử nhắc Zoom theo dịch vụ, chạy trigger lặp, giờ Zoom đã qua, xuất dữ liệu hai lần và nhập dữ liệu v25 theo chế độ dry-run/apply. Kiểm tra nhập lại giữ bản ghi cũ và không thêm lại lịch đã xóa.
- Kiểm thử dùng Postgres cục bộ và phản hồi mô phỏng cho Blob, Resend và Google. Vercel Preview, tài khoản dịch vụ thật, link TAMMI thật và Sheet v25 của anh Hùng cần cấu hình riêng để nghiệm thu.
