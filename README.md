# Trợ Giúp Sinh Viên — Buffer Automation

Mục tiêu: tự động đưa nội dung marketing vào Buffer để Buffer đăng lên Facebook Page "Trợ giúp sinh viên" theo lịch đã cấu hình.

## Kiến trúc

GitHub Actions → Buffer GraphQL API → Facebook Page → trogiupsinhvien.vercel.app → Booking

## HUMAN setup một lần

1. Tạo một GitHub repository riêng (private cũng được).
2. Upload toàn bộ thư mục này vào repository.
3. Vào **Settings → Secrets and variables → Actions → New repository secret**.
4. Tạo secret tên chính xác: `BUFFER_API_KEY`.
5. Dán Personal Key của Buffer vào secret. Không ghi key vào file/code/chat.
6. Vào **Actions → Buffer Publisher → Run workflow** để test lần đầu.
7. Mở Buffer → Queue để xác nhận bài đầu tiên đã được thêm.

Sau lần test thành công, GitHub Actions chạy tự động mỗi ngày lúc khoảng 06:10 giờ Việt Nam. Script chỉ thêm bài mới khi Buffer queue còn dưới 6 bài. Buffer chịu trách nhiệm phát bài theo lịch của channel.

## Cách script hoạt động

- Tự tìm Buffer Organization của tài khoản.
- Tự tìm Facebook channel có tên "Trợ giúp sinh viên"; nếu không khớp sẽ dùng Facebook channel đầu tiên.
- Kiểm tra số bài đang scheduled.
- Nếu queue < 6, lấy bài chưa dùng đầu tiên từ `content/queue.json`.
- Gọi Buffer `createPost(... mode: addToQueue)`.
- Ghi `bufferPostId`, `queuedAt`, `dueAt` vào queue.
- GitHub Action tự commit trạng thái mới.

## Bảo mật

- Personal Key chỉ nằm trong GitHub Actions Secret.
- Không commit API key vào repository.
- Không paste API key vào ChatGPT.
- Nếu nghi ngờ key lộ, revoke key trong Buffer và tạo key mới.

## Campaign hiện tại

Các link đều dùng UTM:

- `utm_source=facebook`
- `utm_medium=organic`
- `utm_campaign=thesis_pilot`
- `utm_content=fb001...fb010`

Điều này cho phép sau này phân biệt bài nào kéo được traffic/booking.
