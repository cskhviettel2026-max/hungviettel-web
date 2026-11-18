# Viettel Đồng Nai · Lê Ngọc Hùng

Bản Next.js từ website v25. Chạy từ thư mục này bằng Node.js 22 và npm.

~~~powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
~~~

Trang khách mở tại [localhost:3000](http://localhost:3000). Điền cấu hình bên dưới và chạy `npm run db:init` để bật `/admin` và form tư vấn. Lệnh khởi tạo có thể chạy lại mà vẫn giữ dữ liệu đã xuất bản.

## Thiết lập dịch vụ

| Biến | Dùng cho |
|---|---|
| `DATABASE_URL` | Chuỗi kết nối Neon của riêng anh Hùng. Chạy `npm run db:init` trên từng database dùng cho Preview và Production. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | Tài khoản quản trị. Tạo hash bằng lệnh dưới đây. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob **Public**. Admin chọn JPG, PNG hoặc WebP tối đa 10 MB. Trình duyệt chuyển WebP và tải trực tiếp bằng URL giới hạn thời gian. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | API key và địa chỉ gửi thuộc domain đã xác minh trong Resend. Điền email nhận của anh Hùng trong **Admin → Liên hệ**. |

Tạo hash qua stdin. PowerShell 7 hỗ trợ `-MaskInput`.

~~~powershell
Read-Host -MaskInput 'Mật khẩu quản trị 12–200 ký tự' | npm run --silent admin:hash
~~~

Đặt các khoá và chuỗi kết nối trong Environment Variables của Vercel. Tránh đưa file `.env.local` vào Git.

## Vercel Preview riêng

1. Đẩy riêng nội dung thư mục này vào repo của anh Hùng. Tạo project Vercel thuộc tài khoản của anh Hùng và import repo bằng preset Next.js. Nếu dùng repo chung, đặt Root Directory trỏ vào thư mục dự án.
2. Bật **Settings → Deployment Protection → Vercel Authentication** cho Preview. Tạo Preview từ nhánh riêng và thử mở URL bằng cửa sổ chưa đăng nhập để xác nhận quyền. Giữ tên miền thật đến lúc nghiệm thu. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
3. Điền biến Preview, khởi tạo Neon trên đúng nhánh database Preview. Dùng dữ liệu giả và hai email thử. Sau khi cập nhật biến, deploy lại Preview.
4. Vào `/admin` để thử lưu hotline, banner, FAQ, giá và dịch vụ. Kiểm tra lại giá cùng thông số theo nguồn Viettel trước ngày công bố.
5. Sau khi duyệt, điền biến Production, chạy khởi tạo trên Neon Production rồi deploy và gán tên miền. Dùng checklist [nghiệm thu](NGHIEM-THU.md).

## Form tư vấn và email

Form xác thực số điện thoại, email, sự đồng ý và gói đang mở trên server. Yêu cầu vào Neon trước. Mã hiển thị ngay sau khi lưu. Backend gửi hai email riêng và ghi kết quả từng email. Sửa trạng thái xử lý trong **Yêu cầu tư vấn**. Trong **Yêu cầu tư vấn**, chọn **Từ ngày** và **Đến ngày** để lọc theo ngày gửi (giờ Việt Nam). **Xuất Excel** tải file `.xlsx` chứa toàn bộ yêu cầu trong khoảng đã chọn. Để trống cả hai ô để xuất tất cả.

## Nhập bảng v25 và chuyển hệ thống

1. Tải bảng v25 thành file Excel `.xlsx` có tab `Registrations`. Các ngày trong file được đọc theo giờ Việt Nam.
2. Cấu hình Neon đích rồi chạy `npm run db:init`.
3. Chạy `npm run db:import -- "dang-ky-v25.xlsx" --dry-run` để đếm bản ghi và xác định dòng cần kiểm tra.
4. Khi chuyển chính thức, ngừng nhận form cũ và chạy `npm run db:import -- "dang-ky-v25.xlsx" --apply`. Lệnh giữ mã cũ, trạng thái đồng ý và trạng thái email. Chạy lại giữ các bản ghi đã có.
