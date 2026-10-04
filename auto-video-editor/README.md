# Đậu Ánh Video Editor — Windows / Remotion 0.1.0

Bản triển khai đầu tiên nằm cạnh app Flask cũ. Nhận video từ thư mục → dựng preview → khách duyệt đúng revision → xuất MP4. Không đăng mạng xã hội.

## Chạy trên Windows

Yêu cầu Windows x64, Node 22.22+ hoặc 24, Python 3.10+, FFmpeg và ffprobe trên PATH. Máy nên có 16GB RAM và ít nhất 10GB dung lượng trống. Đây là mức đề xuất ban đầu, chưa phải benchmark trên máy khách.

1. Tải repository, mở PowerShell tại `auto-video-editor`.
2. Cài Python, Node và FFmpeg nếu chưa có.
3. Chạy `powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1`.
4. Chạy `npm run dev` hoặc `npm run package:win` để tạo bộ cài NSIS trong `release`.
5. Khởi động app, mở **Thư mục đầu vào**, đặt video vào `01_INBOX`.
6. Chờ trạng thái **Chờ duyệt**, xem phụ đề và nội dung, bấm **Duyệt & Xuất MP4**.

Setup tải model Whisper và Chromium một lần. Setup cần mạng; xử lý video sau setup chạy cục bộ. Bộ cài NSIS hiện chưa gói Python/FFmpeg/model: phải chuẩn bị runtime trên máy đích bằng bước 3. Không coi bản này là bộ cài offline trọn gói.

## Thư mục dữ liệu

Mặc định `%USERPROFILE%\Documents\DauAnhVideoEditor`; đặt `DAU_ANH_EDITOR_ROOT` nếu muốn đổi trước khi khởi động.

- `01_INBOX`: video nguồn; không xóa tự động.
- `02_PROCESSING`: snapshot nguồn theo SHA-256.
- `03_REVIEW`: preview 540×960 và revision tương ứng.
- `04_DONE`: MP4 1080×1920, 30fps, H.264/AAC nếu có audio.
- `ERROR`: báo cáo lỗi JSON.
- `jobs.sqlite3`: hàng đợi, checkpoint, phê duyệt và lịch sử.
- `cache/transcripts`: chép lời theo checksum + phiên bản provider.
- `cache/plans`: edit plan từng revision.
- `assets/music`: nhạc được phép dùng, chọn track theo thứ tự tên để tái lập.
- `assets/b-roll`: video cảnh trám kèm metadata `.json`.
- `brand/logo`, `brand/fonts`: tài nguyên thương hiệu cục bộ.

Ví dụ metadata `dormitory-taiwan.mp4.json`:

```json
{"tags":["dormitory","taiwan"]}
```

Nhận file sau 10 giây ổn định, kiểm tra truy cập độc quyền trên Windows và quét lại các file chép tiếp/bị bận. Queue chạy tuần tự, một video lỗi không chặn video sau. Đóng cửa sổ sẽ ẩn ứng dụng và tiếp tục xử lý; mở lại shortcut để xem. Thoát bằng menu ứng dụng để dừng sau job đang chạy.

## Những gì đã làm

- SQLite bền vững, checksum chống trùng cả khi đổi tên, snapshot nguồn và tài nguyên xác minh checksum; duyệt ràng buộc cả nội dung tài nguyên.
- Whisper local tiếng Việt, cache transcript, bỏ caption và cảnh báo khi không có audio.
- Phát hiện đoạn đứng hình giao với im lặng; không cắt phần có transcript lời nói; remap caption sau cắt.
- Planner giữ thứ tự nguồn, hook lấy nguyên văn câu đầu, CTA lấy cấu hình. Không sinh thông tin du học mới.
- Cảnh trám dựa trên tags đã gắn; không tìm tư liệu Internet.
- Remotion dynamic timeline, caption, brand/logo/font, nhạc giảm theo khoảng lời thoại và fade đầu/cuối.
- Preview và render cuối cùng dùng cùng plan revision; sửa plan làm mất hiệu lực duyệt cũ.
- Retry preview/render có giới hạn; checkpoint và cache giúp restart không chép lời lại.
- Dashboard, review player, nhảy tới thời gian phụ đề, cài đặt thương hiệu và tự khởi động Windows.
- Kiểm tra font tiếng Việt; IPC allowlist, kiểm tra sender/frame, file media qua URL ngẫu nhiên chỉ bind loopback.

## Giới hạn công khai

- Planner hiện dùng quy tắc và tags, chưa có AI hiểu nội dung hay tự học phong cách 3–5 video mẫu.
- Ba preset có cấu hình khác nhau nhưng nhịp dựng/ngữ nghĩa còn cần hiệu chỉnh với video thật. Không tự tăng tốc hoặc chọn highlight theo chuyển động.
- Lệnh giảm hiệu ứng bỏ cảnh trám; nút bỏ nhạc bỏ track. Ghi chú chỉ được lưu để người dựng xử lý, không giả vờ thực hiện tự động.
- Cảnh báo dữ liệu cá nhân dựa trên transcript, chưa OCR hộ chiếu/visa trong khung hình.
- QC kiểm tra schema/timeline, asset tồn tại và metadata output. Chưa tự nhận mọi frame đen, âm thanh lặp hay lỗi nghĩa; người dùng phải xem bản preview.
- Phụ đề ở cấp câu theo Whisper; không phải phụ đề từng từ.
- Giữ hình với contain/padding để tránh crop mất người/slide. Chưa có theo dõi gương mặt để crop thông minh.
- Kiểm thử giao diện hiện dùng browser bridge test-only gọi backend thật; smoke test Electron và bộ cài trên Windows mục tiêu còn cần thực hiện.

## Kiểm thử / build

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run package:win
node scripts/verify-windows-package.mjs
```

Test thực dùng FFmpeg. Đặt `DAU_ANH_BROWSER` tới Chromium đã cài để chạy render/E2E. Trên Linux sandbox thử nghiệm có fallback network-interface chỉ trong tests; không đưa vào sản phẩm.

App Flask cũ vẫn chạy theo README ở thư mục gốc. Chưa merge vào main, chưa có video khách nào được xử lý trong quá trình phát triển.

## Trạng thái kiểm chứng ngày 05/10/2026

32 kiểm thử unit/integration và một E2E giao diện với backend thật đã qua trên Linux; có render preview/full MP4 thực và giải mã FFmpeg. Bản Windows ZIP có resources renderer ngoài ASAR được đóng gói thử; chưa chạy trên Windows. NSIS chưa build được ở môi trường Linux do thiếu Wine, đã có workflow Windows chạy thủ công. Chưa thử Whisper bằng lời nói/video khách thật hoặc benchmark 10 video trên máy khách.
