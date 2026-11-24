# Changelog

Giữ đồng bộ với `src/data/changelog.ts` (nguồn hiển thị trong app).

## [0.19.0] — 2026-11-24 — Thời tiết tại trạm

- Mở trạm để xem thời tiết hiện tại và 6 giờ tới, kèm nhắc mang ô khi sắp mưa.

## [0.18.3] — 2026-11-24 — Sửa ô nhập trên iPhone

- Bấm vào ô nhập không còn đẩy tay cầm, tiêu đề của bảng ra khỏi màn hình.

## [0.18.2] — 2026-11-24 — Sửa bảng trên iPhone

- Bảng Xe của bạn luôn dính đáy và đủ bề rộng sau khi chọn trong danh sách.
- Chạm ra ngoài ô nhập để đóng bàn phím.

## [0.18.1] — 2026-11-24 — Nhiều xe

- Lưu được tối đa 6 xe, chọn xe đang dùng trong danh sách; thêm, xoá xe ngay trong Xe của bạn.
- Sửa lỗi đổi xe trên iPhone làm bảng Xe của bạn trôi khuất dưới màn hình.
- Sửa lỗi bàn phím iPhone che ô đang nhập trong Xe của bạn.

## [0.18.0] — 2026-11-24 — Giờ tới nơi, hai xe & cổng trống trạm đã lưu

- Kế hoạch sạc ghi giờ theo đồng hồ: chọn giờ đi, xem giờ tới từng trạm dừng và giờ tới nơi.
- Xe của bạn: chọn mức pin còn lại (pin đã chai) và kiểu lái tiết kiệm / bình thường / nhanh.
- Gia đình có hai xe: đổi Xe 1 / Xe 2, mỗi xe nhớ riêng mẫu xe, pin và % pin.
- Dọc đường nhớ 5 hành trình gần đây — bấm là mở lại.
- % pin khi tới trạm tính cả độ dốc trên đường đi.
- Danh sách trạm đã lưu hiện số cổng trống của các trạm gần nhất.

## [0.17.0] — 2026-11-24 — Tìm địa chỉ, độ dốc & so với xe xăng

- Gõ địa chỉ vào ô tìm kiếm để xem trạm sạc quanh đó.
- Tìm bằng giọng nói: bấm micro trong ô tìm kiếm rồi nói tên trạm hoặc địa chỉ.
- Bấm vào ô tìm kiếm để mở lại các trạm vừa xem.
- Kế hoạch sạc tính cả độ dốc: leo đèo tốn pin hơn, đổ đèo lấy lại một phần.
- Mở kế hoạch sạc trong Google Maps để dẫn đường qua các trạm dừng.
- So chi phí cả chuyến với xe xăng — đặt mức tiêu thụ và giá xăng trong Xe của bạn.
- Tầm pin: trạm ngoài tầm vẽ mờ, kèm số trạm sạc nhanh trong tầm.

## [0.16.1] — 2026-11-24 — Gọn hơn

- Số phiên bản chuyển sang góc dưới phải, ghi công bản đồ sang góc trái và tự thu gọn.
- Thông tin & ghi công chuyển vào Lịch sử cập nhật.
- Lịch sử cập nhật hiện 3 bản mới nhất, bấm để xem các bản cũ hơn.
- Ô giá sạc hiện dấu phân tách hàng nghìn (3.858).

## [0.16.0] — 2026-11-24 — Tiền sạc, tầm pin & lọc thêm

- Nút định vị ở góc dưới phải bản đồ: bấm để về chỗ bạn đứng.
- Ước tính tiền sạc ở từng trạm và cho cả kế hoạch sạc dọc đường — đặt giá sạc trong Xe của bạn.
- Tầm pin: xem trên bản đồ với % pin hiện tại đi được bao xa, đi rồi về được bao xa.
- Lọc thêm trong Cài đặt: chỉ trạm công cộng, miễn phí gửi xe, số cổng tối thiểu.
- Nhấn giữ biểu tượng app để mở nhanh Gần tôi, Dọc đường, Quét QR.

## [0.15.1] — 2026-11-17 — Đường cong sạc

- Xem đường cong sạc nhanh của xe trong Xe của bạn, so ở trụ 60 / 120 / 250 kW.

## [0.15.0] — 2026-11-17 — Địa điểm hay dùng

- Lưu Nhà, Công ty và địa điểm hay đi — bấm là tìm đường kèm trạm dọc đường.
- Chạm giữ bản đồ để lưu địa điểm, tìm đường hoặc xem trạm gần đó.
- Xem trạm gần Nhà, Công ty ngay trong Gần tôi.
- Quét QR mở toàn màn hình trên điện thoại.

## [0.14.0] — 2026-11-17 — Quét QR, kế hoạch sạc thông minh hơn, dùng khi mất sóng

- Quét mã QR trên thẻ trạm để mở trạm ngay.
- Kế hoạch sạc chọn ít lần sạc nhất, rồi sạc nhanh nhất.
- Thời gian sạc tính theo đường cong của từng mẫu xe.
- Mất sóng vẫn mở được bản đồ, trạm và hành trình vừa xem.

## [0.13.0] — 2026-11-17 — Dọn mã, ổn định hơn

- Các bảng dùng chung một kiểu tiêu đề.
- Dữ liệu trạm cập nhật đúng cả khi chỉ số cổng thay đổi trong ngày.
- Bản dữ liệu hỏng không còn được đẩy lên.

## [0.12.1] — 2026-11-17 — Sửa lỗi & bảo vệ máy chủ

- Không còn kẹt lỗi "không có ảnh" ở trạm sau một lần tải lỗi.
- Đánh giá: "Xem thêm" không bỏ sót bài; bài đang bị ẩn không xoá được.
- Chặn quét dữ liệu trạm hàng loạt.
- Mở link trạm / hành trình không còn bị GPS kéo bản đồ đi chỗ khác.
- Trạm gần bạn không bỏ sót trạm gần hơn ở hướng đông-tây.
- Ô tìm kiếm đóng khi bấm ra ngoài hoặc nhấn Esc.

## [0.12.0] — 2026-11-17 — Pin dự phòng, trạm trên cao tốc & bảng gọn hơn

- Tự đặt mức pin dự phòng khi lên kế hoạch sạc.
- Kế hoạch sạc bỏ trạm phải ra khỏi cao tốc hoặc ở chiều ngược.
- Bảng Dọc đường gọn hơn: thu gọn tuỳ chọn, cuộn mượt.
- Nút "Dùng vị trí của tôi" trong Trạm gần bạn.
- iPhone: status bar trong suốt.

## [0.11.0] — 2026-11-17 — Chọn tuyến đường

- Xem tối đa 3 tuyến và chọn tuyến muốn đi.
- Tránh thu phí / cao tốc / phà.
- Đọc đúng link có kéo tuyến và link chia sẻ từ iPhone.

## [0.10.0] — 2026-11-17 — Kế hoạch sạc, ghi chú & đánh giá trạm

- Tự lên kế hoạch dừng sạc cho hành trình.
- Nhập mức tiêu thụ thực tế của xe.
- Ghi chú riêng cho từng trạm.
- Đánh giá sao và bình luận cho trạm.

## [0.9.0] — 2026-11-17 — % pin khi đến trạm

- Chọn mẫu xe của bạn.
- Ước tính % pin khi tới trạm và thời gian sạc.
- Dọc đường: % pin tại từng trạm, vạch "Trạm cuối còn kịp".

## [0.8.0] — 2026-11-17 — Cổng trống thời gian thực & cài đặt hiển thị

- Số cổng trống thời gian thực và biểu đồ 24 giờ.
- Quãng đường lái xe thật tới trạm.
- Cài đặt hiển thị: mức công suất, chỉ trạm hoạt động, chú giải.
- Giao diện tiếng Anh.

## [0.7.0] — 2026-11-16 — Trạm sạc dọc đường

- Tìm trạm dọc tuyến từ link Google Maps.
- Chọn bề rộng hành lang 2 / 5 / 10 km.
- Bỏ trạm ở chiều ngược trên cao tốc.

## [0.6.0] — 2026-11-16 — Lọc sạc nhanh, trạng thái trạm, trạm gần bạn

- Lọc theo công suất, ghim đổi màu theo kW.
- Hiện trạm bảo trì / ngừng hoạt động.
- "Gần tôi": 20 trạm gần nhất.
- Sao lưu và chuyển trạm đã lưu sang máy khác.

## [0.5.0] — 2026-11-16 — Dữ liệu cập nhật hằng ngày & số cổng sạc

- Dữ liệu trạm cập nhật hằng ngày.
- Hiện số cổng và công suất từng trạm.
- Chuyển sang domain charging.cangao.asia.

## [0.4.0] — 2026-11-16 — Chia sẻ trạm bằng mã QR

- Chia sẻ trạm bằng mã QR hoặc link.
- Tải ảnh thẻ QR, mở nhanh trên Google Maps.

## [0.3.0] — 2026-11-16 — Nhóm trạm đã lưu & ghim mới

- Lưu trạm vào nhóm, tự tạo nhóm riêng.
- Nhóm tự gỡ trạm sau thời hạn đặt trước.
- Ghim trạm kiểu mới.

## [0.2.0] — 2026-11-16 — Đồng bộ giao diện với app Chia Tiền

- Giao diện mới, có chế độ tối.
- Chi tiết trạm dạng ngăn kéo từ dưới lên.

## [0.1.0] — 2026-11-16 — Phiên bản đầu tiên

- Bản đồ trạm sạc VinFast toàn quốc.
- Tìm trạm, lưu yêu thích, chỉ đường Google Maps.
- Cài được như app.
