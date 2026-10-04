# Đặc tả thiết kế: Auto Video Editor Du Học cho Windows

Ngày: 04/10/2026  
Trạng thái: Chờ người dùng duyệt đặc tả  
Phiên bản: 1.0

## 1. Tóm tắt

Auto Video Editor Du Học là ứng dụng Windows chạy cục bộ, dành cho một khách hàng tư vấn du học trong phiên bản đầu tiên. Ứng dụng tự khởi động cùng Windows, theo dõi một thư mục đầu vào, phân tích video mới, dựng video dọc bằng Remotion theo bộ nhận diện đã khóa, tạo bản xem trước và chờ khách hàng duyệt trước khi xuất MP4.

Mục tiêu của sản phẩm là giảm tối đa thao tác lặp lại và chi phí token. AI chỉ đảm nhiệm những quyết định cần hiểu ngữ nghĩa; các quy tắc thiết kế, hiệu ứng, chuyển cảnh, font, màu, CTA và cấu trúc Remotion được thực hiện bằng preset cố định và mã cục bộ.

## 2. Mục tiêu

1. Khách hàng chỉ cần đưa video vào thư mục `01_INBOX`.
2. Ứng dụng tự động hoàn thành bản dựng mà không yêu cầu nhập prompt lặp lại.
3. Mỗi video có hook, cắt lỗi, phụ đề, chữ nhấn, cảnh trám, âm thanh và nhận diện thương hiệu.
4. Khách hàng xem trước, sau đó bấm `Duyệt & Xuất MP4`.
5. Hệ thống có thể tiếp tục hàng đợi sau khi ứng dụng hoặc máy tính khởi động lại.
6. Dữ liệu video gốc và bản render mặc định được giữ trên máy khách.
7. Kết quả phân tích được lưu đệm để không tiêu tốn token khi dựng lại.

## 3. Ngoài phạm vi phiên bản đầu tiên

- Hệ thống tài khoản cho nhiều doanh nghiệp.
- Thanh toán, phân quyền và quản lý thuê bao.
- Đăng video tự động lên Facebook, TikTok hoặc YouTube.
- Chỉnh sửa timeline chuyên sâu như Premiere Pro.
- Tự tìm và tải tư liệu trên Internet.
- Tự xác minh tính đúng sai của học phí, visa, học bổng hoặc chính sách tuyển sinh.
- Render trên đám mây.
- Ứng dụng macOS hoặc điện thoại.

## 4. Người dùng chính

### 4.1. Khách hàng tư vấn du học

Nhu cầu:

- Có nhiều video nói trực tiếp và kho cảnh trám.
- Muốn tạo đều video dọc cho mạng xã hội.
- Không muốn học phần mềm dựng phim.
- Không muốn nhập prompt hoặc trả lời lại các câu hỏi giống nhau.
- Cần video chuyên nghiệp, đáng tin cậy và đồng nhất thương hiệu.

### 4.2. Quản trị viên thiết lập

Người thiết lập ban đầu có quyền:

- Nhập logo, font, bảng màu, CTA, nhạc và SFX.
- Chọn các video tham chiếu.
- Khóa hoặc cập nhật hồ sơ phong cách.
- Quản lý preset dựng.
- Xem nhật ký lỗi và trạng thái hàng đợi.

## 5. Nguyên tắc sản phẩm

1. **Thư mục là giao diện đầu vào chính:** khách hàng không phải tải video qua trình duyệt.
2. **AI quyết định ít nhưng đúng chỗ:** chỉ dùng AI cho chép lời, phân tích nội dung, hook, từ khóa và tìm cảnh trám theo ngữ nghĩa.
3. **Thiết kế mang tính xác định:** cùng một timeline JSON và cùng tài nguyên phải tạo ra cùng kết quả render.
4. **Duyệt trước khi xuất:** phiên bản đầu không tự xuất hàng loạt nếu chưa có thao tác duyệt.
5. **Không bịa thông tin du học:** không tự thêm cam kết, học phí, tỷ lệ đỗ visa, học bổng hoặc chính sách.
6. **Có thể phục hồi:** mọi công việc đều có trạng thái và checkpoint.
7. **Bảo vệ dữ liệu cá nhân:** phát hiện và cảnh báo giấy tờ có dữ liệu nhạy cảm.

## 6. Luồng sử dụng chính

### 6.1. Nhận video

1. Ứng dụng tự khởi động cùng Windows.
2. Tiến trình theo dõi `01_INBOX`.
3. Khi xuất hiện file mới, hệ thống chờ đến khi kích thước file ổn định và file có thể mở độc quyền.
4. Hệ thống tính dấu vân tay file để tránh xử lý trùng.
5. File được đăng ký vào cơ sở dữ liệu hàng đợi và chuyển sang `02_PROCESSING`.

### 6.2. Phân tích

1. Đọc codec, duration, dimensions, FPS và audio stream.
2. Trích âm thanh và chép lời tiếng Việt.
3. Phát hiện khoảng lặng, đoạn lặp và điểm cắt tiềm năng.
4. Xác định hook, luận điểm, bằng chứng, giải pháp và CTA có sẵn.
5. Tạo `edit-plan.json` theo schema cố định.
6. Tìm cảnh trám phù hợp từ chỉ mục tài nguyên cục bộ.

### 6.3. Dựng

1. Cắt A-roll theo edit plan.
2. Chèn B-roll theo ngữ nghĩa và vùng an toàn.
3. Tạo Caption JSON chuẩn Remotion.
4. Áp dụng typography, text highlight, lower-third và CTA.
5. Áp dụng chuyển cảnh, SFX, nhạc nền và ducking.
6. Tạo composition 1080 × 1920, 30fps.
7. Tạo proxy hoặc preview chất lượng vừa để duyệt nhanh.

### 6.4. Duyệt

Khách hàng có thể:

- Phát, tạm dừng và tua video.
- Bấm `Duyệt & Xuất MP4`.
- Bấm `Dựng lại`.
- Chọn `Giảm hiệu ứng`, `Tăng nhịp`, `Đổi nhạc` hoặc `Sửa một đoạn`.
- Ghi một ghi chú ngắn nếu cần thay đổi cụ thể.

Các lệnh preset phải sửa edit plan hiện có thay vì phân tích lại toàn bộ video.

### 6.5. Xuất file

1. Kiểm tra trước render.
2. Render MP4 H.264 với âm thanh AAC.
3. Ghi file vào `04_DONE`.
4. Lưu metadata, checksum và nhật ký hoàn thành.
5. Gửi thông báo Windows.

## 7. Cấu trúc thư mục

| Đường dẫn | Mục đích |
|---|---|
| `01_INBOX` | Video thô mới |
| `02_PROCESSING` | Video đang xử lý |
| `03_REVIEW` | Bản xem trước và edit plan |
| `04_DONE` | MP4 đã duyệt |
| `ERROR` | File lỗi kèm báo cáo |
| `assets/a-roll` | Tư liệu nói trực tiếp dùng lại nếu có |
| `assets/b-roll` | Cảnh trám đã phân loại |
| `assets/music` | Nhạc được phép sử dụng |
| `assets/sfx` | Hiệu ứng âm thanh |
| `brand/logo` | Logo thương hiệu |
| `brand/fonts` | Font cục bộ |
| `brand/reference` | Video mẫu |
| `cache/transcripts` | Bản chép lời theo checksum |
| `cache/plans` | Edit plan theo checksum và phiên bản preset |
| `cache/proxies` | Proxy phục vụ duyệt |
| `logs` | Nhật ký kỹ thuật |

Không xóa video nguồn tự động trong phiên bản đầu tiên.

## 8. Giao diện

### 8.1. Dashboard

Hiển thị năm nhóm:

- Video mới.
- Đang xử lý.
- Chờ duyệt.
- Đang render.
- Hoàn thành hoặc lỗi.

Mỗi hàng có thumbnail, tên file, duration, preset, tiến độ, thời gian nhận và trạng thái.

### 8.2. Màn hình duyệt

- Trình phát bản preview.
- Transcript đồng bộ theo thời gian.
- Danh sách cảnh chính và cảnh trám.
- Các nút duyệt hoặc dựng lại theo preset.
- Trường ghi chú ngắn.
- Cảnh báo về dữ liệu nhạy cảm hoặc thông tin cần xác minh.

### 8.3. Cài đặt thương hiệu

- Tên thương hiệu.
- Logo.
- Font chính và phụ.
- Màu chính, phụ và cảnh báo.
- CTA cố định.
- Số điện thoại hoặc Zalo.
- Thị trường du học chính.
- Nhạc và SFX mặc định.
- Chế độ watermark.

### 8.4. Cài đặt tự động

- Khởi động cùng Windows.
- Tự theo dõi thư mục.
- Số công việc chạy đồng thời; mặc định là một.
- Thời lượng tối đa của video.
- Chất lượng preview.
- Chất lượng render.
- Thông báo khi hoàn thành hoặc lỗi.

## 9. Preset dựng

### 9.1. Chuyên gia — mặc định

- Nhịp nhanh vừa phải.
- Typography sạch và rõ.
- Cảnh trám đúng nội dung.
- Hiệu ứng vừa đủ.
- Ưu tiên uy tín và khả năng đọc.

### 9.2. Viral giáo dục

- Hook mạnh hơn.
- Nhiều thay đổi thị giác hơn.
- Chữ nhấn rõ hơn.
- Cắt nhịp nhanh hơn nhưng không làm méo lời.

### 9.3. Câu chuyện học viên

- Nhạc cảm xúc nhẹ.
- Nhịp chậm hơn.
- Ưu tiên testimonial, hành trình và kết quả có thật.

Mỗi preset là dữ liệu cấu hình có version, không phải một prompt tự do.

## 10. Hồ sơ phong cách

`style-profile.json` được tạo từ 3–5 video mẫu đã được duyệt. Nội dung gồm:

- Khoảng thời gian cắt trung bình.
- Loại hook.
- Tỷ lệ A-roll/B-roll.
- Loại chuyển cảnh và tần suất.
- Typography.
- Bảng màu.
- Caption layout.
- Loại text highlight.
- Nhịp và mức âm lượng nhạc.
- SFX signature.
- Cách đặt logo, lower-third và CTA.

Hồ sơ chỉ phân tích lại khi quản trị viên bấm `Cập nhật phong cách`.

## 11. Hợp đồng dữ liệu edit plan

Edit plan phải là JSON có schema và version. Tối thiểu gồm:

- ID công việc.
- Checksum file nguồn.
- Preset và phiên bản preset.
- Tỷ lệ, kích thước, FPS.
- Danh sách segment với source, in, out, timeline start và duration.
- Caption.
- Keyword highlight.
- B-roll assignment.
- Transition.
- Music và SFX cue.
- Lower-third, logo và CTA.
- Cảnh báo và confidence.

Mọi giá trị thời gian được chuẩn hóa bằng milliseconds trong dữ liệu và đổi sang frame tại lớp Remotion.

## 12. Kiến trúc kỹ thuật

### 12.1. Các thành phần

1. **Windows Desktop Shell:** giao diện và thông báo hệ thống.
2. **Folder Watcher:** theo dõi file mới và chống xử lý file chưa sao chép xong.
3. **Job Queue:** quản lý trạng thái, retry, checkpoint và tính tuần tự.
4. **Media Inspector:** đọc metadata và kiểm tra file bằng Mediabunny/FFmpeg.
5. **Transcription Engine:** tạo Caption JSON tiếng Việt.
6. **Content Planner:** tạo edit plan nhỏ, có schema.
7. **Asset Indexer:** lập chỉ mục và tìm cảnh trám cục bộ.
8. **Remotion Template Engine:** dựng composition từ edit plan.
9. **Preview Service:** tạo proxy và phát trong giao diện.
10. **Render Worker:** render MP4 sau khi duyệt.
11. **Local Database:** lưu job, checksum, cache, version và lỗi.
12. **Settings Manager:** lưu brand kit, preset và cấu hình.

### 12.2. Hướng triển khai khuyến nghị

- Desktop shell: Electron hoặc Tauri; quyết định cuối cùng ở kế hoạch thi công sau khi kiểm tra yêu cầu đóng gói Remotion và Chromium.
- UI: React + TypeScript.
- Video: Remotion + `@remotion/media` + `@remotion/transitions`.
- Media analysis: FFmpeg và Mediabunny.
- Dữ liệu cục bộ: SQLite.
- File watcher: tiến trình nền có debounce và file-stability check.
- Render: Node worker cục bộ, giới hạn một job đồng thời trong MVP.

### 12.3. Nguyên tắc Remotion

- Mỗi clip có thể chỉnh riêng là một JSX node riêng.
- Dùng `Series` cho cảnh liên tiếp và `TransitionSeries` khi có chuyển cảnh.
- Dùng `useCurrentFrame()`, `interpolate()` và easing; không dùng CSS animation.
- Caption dùng kiểu `Caption` của `@remotion/captions`.
- Tài nguyên cục bộ được quản lý bằng đường dẫn an toàn và checksum.
- Tổng duration phải trừ phần overlap của transition.
- Preview và render phải dùng cùng edit plan.

## 13. Trạng thái công việc

Một job có một trong các trạng thái:

`discovered` → `validating` → `transcribing` → `planning` → `assembling` → `previewing` → `awaiting_review` → `rendering` → `completed`

Trạng thái lỗi:

- `blocked_missing_asset`
- `failed_input`
- `failed_transcription`
- `failed_planning`
- `failed_preview`
- `failed_render`
- `cancelled`

Mỗi bước lưu checkpoint. Khi khởi động lại, hệ thống tiếp tục từ checkpoint hợp lệ gần nhất.

## 14. Xử lý lỗi

- File chưa sao chép xong: chờ và kiểm tra lại.
- File trùng: không xử lý lại; hiển thị liên kết đến job cũ.
- Không có audio: cho phép dựng hình nhưng đánh dấu không thể tạo caption.
- Không có cảnh trám phù hợp: dùng A-roll với punch-in nhẹ; không chèn cảnh sai.
- AI hoặc mạng lỗi: retry có giới hạn, sau đó giữ job ở trạng thái chờ.
- Render lỗi: giữ nguyên edit plan và cache để render lại.
- Ổ đĩa sắp đầy: dừng nhận job mới và cảnh báo.
- Thiếu font: dùng font dự phòng hỗ trợ tiếng Việt.
- File bị lỗi codec: chuyển sang `ERROR` cùng thông báo dễ hiểu.

## 15. Bảo mật và quyền riêng tư

- Video nguồn, transcript, edit plan và MP4 mặc định nằm trên máy khách.
- Chỉ phần dữ liệu cần thiết mới được gửi đến dịch vụ AI nếu cấu hình dùng API.
- Khóa API lưu trong kho thông tin bảo mật của Windows, không ghi thẳng vào file cấu hình.
- Nhật ký không ghi nội dung khóa API hoặc dữ liệu giấy tờ đầy đủ.
- Ứng dụng cảnh báo khi phát hiện hộ chiếu, visa, số điện thoại, ngày sinh hoặc mã hồ sơ.
- Không tải tài nguyên Internet nếu chưa có cấu hình cho phép.

## 16. Chiến lược tiết kiệm token

1. Phân tích video mẫu một lần để tạo style profile.
2. Lưu transcript theo checksum.
3. Lưu edit plan theo checksum + phiên bản preset.
4. Không gọi AI cho render, transition, font, màu, logo và CTA.
5. Chỉ gửi transcript và metadata cần thiết, không gửi toàn bộ video nếu không bắt buộc.
6. Dùng schema JSON ngắn thay vì yêu cầu AI sinh mã Remotion cho từng video.
7. Lệnh `Dựng lại` sửa edit plan hiện có thay vì phân tích từ đầu.
8. Có thống kê token hoặc chi phí theo job khi dùng API có tính phí.

## 17. Kiểm tra chất lượng tự động

Trước khi chuyển sang `awaiting_review` hoặc `completed`, hệ thống kiểm tra:

- Không có frame đen ngoài chủ ý.
- Không có khoảng trống trên timeline.
- Không mất hoặc trùng audio.
- Caption không vượt vùng an toàn.
- Font hiển thị đủ dấu tiếng Việt.
- Không cắt cụt từ ở điểm dựng.
- B-roll tồn tại và đọc được.
- Logo không méo.
- Nhạc không vượt ngưỡng so với giọng.
- Duration composition khớp timeline.
- Không có dữ liệu nhạy cảm chưa được cảnh báo.
- File đầu ra mở và đọc được.

## 18. Tiêu chí nghiệm thu MVP

MVP đạt yêu cầu khi:

1. Cài được trên một máy Windows mục tiêu.
2. Tự khởi động và theo dõi `01_INBOX`.
3. Xử lý liên tiếp ít nhất 10 video hợp lệ mà không mất job.
4. Mỗi video tạo được transcript, edit plan và preview.
5. Người dùng duyệt được preview và xuất MP4.
6. Khởi động lại máy giữa một job không làm mất trạng thái.
7. Video trùng không bị xử lý hai lần.
8. Không tự bịa thông tin du học.
9. Preset, logo, font, màu và CTA được áp dụng đồng nhất.
10. File lỗi được chuyển sang `ERROR` với thông báo dễ hiểu.
11. Preview và bản MP4 cuối không khác nhau về nội dung timeline.
12. Cache giúp thao tác dựng lại không phải chép lời từ đầu.

## 19. Dữ liệu cần nhận trước khi thi công và hiệu chỉnh

- 3–5 video mẫu đã được khách xác nhận là đúng phong cách.
- 5–10 video thô đại diện cho chất lượng nguồn thực tế.
- Kho cảnh trám có quyền sử dụng.
- Logo PNG nền trong.
- Font thương hiệu nếu có.
- Nhạc và SFX có quyền sử dụng.
- Tên thương hiệu, CTA, số điện thoại/Zalo.
- Máy Windows mục tiêu hoặc cấu hình tối thiểu của máy.
- Quyết định về dịch vụ chép lời/AI và ngân sách API.

## 20. Các quyết định đã khóa

- Nền tảng: Windows.
- Cách vận hành: ứng dụng cục bộ tự theo dõi thư mục.
- Phạm vi: một khách hàng tư vấn du học.
- Luồng đầu ra: duyệt trước, sau đó mới render MP4.
- Video chính: dọc 9:16, 1080 × 1920, 30fps.
- Preset mặc định: Chuyên gia.
- Render: cục bộ bằng Remotion.
- Chiến lược AI: hybrid, cache-first, schema-first.

## 21. Quyết định còn mở cho kế hoạch thi công

Các mục sau không thay đổi phạm vi sản phẩm nhưng cần được chọn trong kế hoạch triển khai:

- Electron hay Tauri sau khi thử đóng gói Remotion renderer.
- Công cụ chép lời tiếng Việt chạy cục bộ hay qua API.
- Nhà cung cấp mô hình phân tích nội dung.
- Cấu hình phần cứng tối thiểu để đạt thời gian render chấp nhận được.
- Codec và bitrate xuất mặc định dựa trên nền tảng đăng chính.

## 22. Điều kiện chuyển sang lập kế hoạch

Chỉ lập kế hoạch thi công sau khi người dùng xác nhận đặc tả này phản ánh đúng sản phẩm mong muốn. Kế hoạch phải chia thành các mốc nhỏ có thể kiểm thử: ingest, queue, transcription, edit plan, Remotion template, preview, approval, render, recovery và installer.
