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
| `TAMMI_GROUP_URL` | Link nhóm HTTPS, chèn vào email xác nhận cho khách. |
| `ZOOM_TRIGGER_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự, dùng cả trong Vercel và Script Properties của Apps Script. |
| `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` | Tùy chọn xuất Sheet. Dùng ID bảng tính và toàn bộ JSON service account trên một dòng. Bật Google Sheets API, chia sẻ Sheet quyền Editor cho email service account. |
| `GOOGLE_LEGACY_SHEETS_ID` | Chỉ dùng khi nhập bảng v25. Đặt biến này ở máy đang chạy lệnh import và cấp quyền Viewer cho cùng service account. |

Tạo hash qua stdin. PowerShell 7 hỗ trợ `-MaskInput`.

~~~powershell
Read-Host -MaskInput 'Mật khẩu quản trị 12–200 ký tự' | npm run --silent admin:hash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
~~~

Lệnh thứ hai tạo secret Zoom. Đặt các khoá và chuỗi kết nối trong Environment Variables của Vercel. Tránh đưa file `.env.local` vào Git.

## Vercel Preview riêng

1. Đẩy riêng nội dung thư mục này vào repo của anh Hùng. Tạo project Vercel thuộc tài khoản của anh Hùng và import repo bằng preset Next.js. Nếu dùng repo chung, đặt Root Directory trỏ vào thư mục dự án.
2. Bật **Settings → Deployment Protection → Vercel Authentication** cho Preview. Tạo Preview từ nhánh riêng và thử mở URL bằng cửa sổ chưa đăng nhập để xác nhận quyền. Giữ tên miền thật đến lúc nghiệm thu. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
3. Điền biến Preview, khởi tạo Neon trên đúng nhánh database Preview. Dùng dữ liệu giả và hai email thử. Sau khi cập nhật biến, deploy lại Preview.
4. Vào `/admin` để thử lưu hotline, banner, FAQ, giá, dịch vụ và lịch Zoom. Kiểm tra lại giá cùng thông số theo nguồn Viettel trước ngày công bố.
5. Sau khi duyệt, điền biến Production, chạy khởi tạo trên Neon Production rồi deploy và gán tên miền. Dùng checklist [nghiệm thu](NGHIEM-THU.md).

## Form tư vấn, TAMMI và Zoom

Form xác thực số điện thoại, email, sự đồng ý và gói đang mở trên server. Yêu cầu vào Neon trước. Mã hiển thị ngay sau khi lưu. Backend gửi hai email riêng và ghi kết quả từng email. Sửa trạng thái xử lý và quyền nhận nhắc Zoom trong **Yêu cầu tư vấn**. Nút **Xuất Google Sheets** sao chép dữ liệu vào tab `YeuCauTuVanWeb`. Lần xuất tiếp thay toàn bộ dữ liệu tab này theo Neon, mỗi yêu cầu có một mã.

1. Tạo một Apps Script project. Chép `apps-script/Code.gs` và manifest `apps-script/appsscript.json`.
2. Trong **Project Settings → Script Properties**, đặt `ZOOM_TRIGGER_URL` thành URL đầy đủ `https://<tên-miền>/api/zoom/remind` và `ZOOM_TRIGGER_SECRET` bằng secret trên Vercel. Chạy `runZoomReminders` một lần để cấp quyền và kiểm tra kết nối. Chạy `installZoomTrigger` để đặt lịch mỗi phút.
3. Trong **Lịch Zoom**, nhập giờ Việt Nam, link và dịch vụ áp dụng. Để trống dịch vụ để nhắc mọi khách đủ điều kiện. Hệ thống nhắc trong 30 phút trước giờ bắt đầu, một lần cho mỗi email, mã buổi và giờ bắt đầu. Trên Preview có bảo vệ, kiểm tra endpoint từ phiên được cấp quyền. Khi chạy Apps Script trên Preview, đặt thêm Script Property `VERCEL_AUTOMATION_BYPASS_SECRET` nếu dự án đã cấp secret tương ứng. [Vercel Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-for-automation)

## Nhập bảng v25 và chuyển hệ thống

1. Cấu hình Neon đích, Google Sheets API và các biến import ở máy chạy lệnh. Chạy `npm run db:init`.
2. Chạy `npm run db:import -- --dry-run` để đếm bản ghi và xác định dòng lỗi ở `Registrations`, `Sessions`, `ReminderLog`.
3. Sao lưu Sheet cũ. Khi chuyển chính thức, tắt trigger `processQueue` và ngừng nhận form Apps Script cũ, sau đó chạy `npm run db:import -- --apply`. Lệnh giữ mã cũ, trạng thái đồng ý/nhận Zoom, trạng thái email và các mốc nhắc đã gửi. Chạy lại giữ các bản ghi đã có. Yêu cầu nhập từ v25 giữ trạng thái email cũ và chờ anh Hùng xử lý nếu còn việc.
4. Đối chiếu các dòng đã nhập, kiểm tra lịch và bật trigger mới. Dùng link form trên tên miền mới.
