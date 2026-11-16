# Changelog

Giữ đồng bộ với `src/data/changelog.ts` (nguồn hiển thị trong app).

## [0.6.0] — 2026-11-16 — Lọc sạc nhanh, trạng thái trạm, trạm gần bạn

- Lọc trạm có sạc nhanh DC hoặc từ 120 kW; ghim trạm đổi màu theo công suất (có chú giải màu).
- Trạm đang bảo trì, ngừng hoạt động hoặc sắp khai trương hiện mờ trên bản đồ, kèm nhãn trong chi tiết trạm.
- Lọc "Đang hoạt động" để ẩn các trạm không sạc được.
- "Gần tôi": 20 trạm đang hoạt động gần nhất, theo đúng bộ lọc đang bật.
- Sao lưu trạm đã lưu và chuyển sang máy khác bằng link, mã QR hoặc file.
- Bản đồ gọn hơn: bỏ nút phóng to / thu nhỏ và nút định vị.

## [0.5.0] — 2026-11-16 — Dữ liệu cập nhật hằng ngày & số cổng sạc

- Dữ liệu trạm tải từ CDN và được làm mới hằng ngày (~25.000 trạm) — không còn gói dữ liệu cố định trong app.
- Chi tiết trạm hiện số cổng, công suất tối đa và từng mức kW (AC/DC).
- Để app mở lâu: quay lại tab sẽ tự nhận bản dữ liệu mới, không tải lại trang.
- Chuyển sang domain charging.cangao.asia; link chia sẻ và mã QR trỏ về domain mới.

## [0.4.0] — 2026-11-16 — Chia sẻ trạm bằng mã QR

- Chia sẻ trạm bằng mã QR: nút QR trong chi tiết trạm.
- QR "Link trạm": mở thẳng trạm trong app (đường dẫn /tram/<id>-<tên>), có tên + địa chỉ trạm khi gửi qua Zalo, Messenger.
- QR "Google Maps": mở đúng vị trí trạm trên Google Maps để chỉ đường.
- Tải ảnh thẻ QR (kèm tên trạm) hoặc chia sẻ thẳng từ điện thoại; sao chép link một chạm.
- Thanh địa chỉ đổi theo trạm đang mở — copy URL là ra link chia sẻ.
- Trang từng trạm không cho máy tìm kiếm lập chỉ mục (dữ liệu nội bộ); sitemap chỉ có trang chủ.

## [0.3.0] — 2026-11-16 — Nhóm trạm đã lưu & ghim mới

- Lưu trạm vào nhóm: Yêu thích, Sao, Đánh dấu sẽ đến — một trạm nằm được nhiều nhóm.
- Tự tạo nhóm với tên, biểu tượng và màu riêng; xoá nhóm (bấm hai lần để xác nhận).
- Nhóm tự tạo có thể tự gỡ trạm sau 6 giờ / 1 ngày / 3 ngày / 1 tuần / 30 ngày, kèm đếm ngược.
- Danh sách trạm đã lưu, lọc theo nhóm, xếp theo khoảng cách khi có vị trí.
- Ghim trạm kiểu giọt nước: trụ sạc cho trạm thường, hình + màu của nhóm cho trạm đã lưu, tia sét cho trạm đang chọn.
- Danh sách yêu thích cũ được tự chuyển sang nhóm "Yêu thích".
- Bỏ bộ lọc Công cộng / Trụ LINK trên bản đồ — thông tin này vẫn hiện trong chi tiết trạm.

## [0.2.0] — 2026-11-16 — Đồng bộ giao diện với app Chia Tiền

- Chuyển sang hệ thiết kế shadcn (Tailwind v4) dùng chung với app Chia Tiền.
- Font Be Vietnam Pro, bo góc mềm, bảng màu iOS neutral, hỗ trợ chế độ tối.
- Tông chủ đạo xanh (emerald) — cùng hệ màu với Chia Tiền.
- Bảng chi tiết trạm chuyển thành drawer kéo từ dưới lên; hộp thoại mượt hơn.

## [0.1.0] — 2026-11-16 — Phiên bản đầu tiên

- Bản đồ 23.942 trạm sạc ô tô VinFast trên toàn quốc (MapLibre + OpenFreeMap).
- Nền bản đồ xám tối giản (Positron) để ghim trạm nổi bật.
- Tự gom cụm marker, bấm cụm để phóng to.
- Mở trang tự xác định vị trí và bay về chỗ bạn.
- Tìm trạm theo tên/địa chỉ, không phân biệt dấu.
- Lọc: Công cộng / Trụ LINK / Yêu thích.
- Lưu trạm yêu thích và chỉ đường nhanh sang Google Maps.
- Thêm app icon, thẻ SEO/Open Graph và web manifest (cài được như app).
