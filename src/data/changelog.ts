export interface ChangelogEntry {
  version: string
  date: string // YYYY-MM-DD
  title?: string
  changes: string[]
  /** Bản tiếng Anh (trang /en). Thiếu thì hiện bản tiếng Việt. */
  titleEn?: string
  changesEn?: string[]
}

/** Lịch sử phiên bản. Mục mới nhất để đầu mảng. Giữ đồng bộ với CHANGELOG.md. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.12.0',
    date: '2026-11-17',
    title: 'Pin dự phòng, trạm trên cao tốc & bảng gọn hơn',
    changes: [
      "Tự đặt mức pin dự phòng khi lên kế hoạch sạc.",
      "Kế hoạch sạc bỏ trạm phải ra khỏi cao tốc hoặc ở chiều ngược.",
      "Bảng Dọc đường gọn hơn: thu gọn tuỳ chọn, cuộn mượt.",
      "Nút \"Dùng vị trí của tôi\" trong Trạm gần bạn.",
      "iPhone: status bar trong suốt.",
    ],
    titleEn: 'Battery reserve, highway stations & a tidier panel',
    changesEn: [
      "Set your own battery reserve for the charging plan.",
      "The charging plan skips stations that need a highway exit or are on the opposite side.",
      "Tidier Along route panel: collapsible options, smooth scrolling.",
      "\"Use my location\" button in Stations near you.",
      "iPhone: transparent status bar.",
    ],
  },
  {
    version: '0.11.0',
    date: '2026-11-17',
    title: 'Chọn tuyến đường',
    changes: [
      "Xem tối đa 3 tuyến và chọn tuyến muốn đi.",
      "Tránh thu phí / cao tốc / phà.",
      "Đọc đúng link có kéo tuyến và link chia sẻ từ iPhone.",
    ],
    titleEn: 'Pick your route',
    changesEn: [
      "See up to 3 routes and pick the one you'll drive.",
      "Avoid tolls / highways / ferries.",
      "Reads dragged-route links and links shared from iPhone correctly.",
    ],
  },
  {
    version: '0.10.0',
    date: '2026-11-17',
    title: 'Kế hoạch sạc, ghi chú & đánh giá trạm',
    changes: [
      "Tự lên kế hoạch dừng sạc: trong \"Dọc đường\", bấm \"Lên kế hoạch sạc\" để app chọn các trạm sạc nhanh cần ghé, ước tính thời gian sạc, giờ tới nơi và pin còn lại. Bản đồ chỉ hiện các điểm dừng.",
      "Nhập mức tiêu thụ thực tế (đọc trên màn hình xe) cho mẫu xe đang chọn — mọi ước tính pin dùng số này.",
      "Ghi chú riêng cho từng trạm (\"cổng 2 hay lỗi\", \"đỗ tầng B2\"…), lưu trên máy, hiện trong danh sách đã lưu và đi kèm khi sao lưu / chuyển máy.",
      "Đánh giá sao và bình luận công khai cho từng trạm: điểm trung bình, phân bố sao, sửa / xoá đánh giá của mình, báo cáo bình luận không phù hợp.",
    ],
    titleEn: 'Charging plan, notes & station reviews',
    changesEn: [
      "Automatic charging plan: in \"Along route\", tap \"Plan charging stops\" to pick the fast chargers to stop at, with estimated charging time, arrival time and battery left. The map shows only the planned stops.",
      "Enter your car's real consumption (from the car's display) for the selected model — all battery estimates use it.",
      "Private notes for each station (\"port 2 is often faulty\", \"park on level B2\"…), saved on this device, shown in the saved list and included in backups.",
      "Public star ratings and comments for each station: average rating, rating breakdown, edit / delete your own review, report inappropriate comments.",
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-17',
    title: '% pin khi đến trạm',
    changes: [
      'Chọn xe của bạn trong ⚙ Cài đặt (10 mẫu VinFast hoặc tự nhập dung lượng pin và mức tiêu thụ), kèm công tắc điều hoà.',
      'Mở trạm: kéo thanh "Pin hiện tại" để thấy còn khoảng bao nhiêu % pin khi tới (theo quãng đường lái thật), cảnh báo cam / đỏ khi pin thấp.',
      'Ước tính thời gian sạc lên 80% ở cổng mạnh nhất đang trống.',
      'Trạm dọc đường: mỗi trạm ghi % pin khi ngang qua, kèm vạch "Trạm cuối còn kịp" (còn ≥ 10% pin).',
      '% pin được nhớ trên máy; nhập quá 2 giờ thì app nhắc cập nhật.',
    ],
    titleEn: 'Battery on arrival',
    changesEn: [
      'Pick your car in ⚙ Settings (10 VinFast models, or enter battery size and consumption yourself), with an air-conditioning toggle.',
      "Open a station and drag \"Current battery\" to see roughly how much battery you'll have on arrival (by real driving distance), with orange / red warnings when low.",
      'Estimated time to charge to 80% at the fastest free port.',
      'Along route: each station shows your battery when you pass it, plus a "Last station you can reach" marker (≥ 10% left).',
      'Battery level is remembered on this device; after 2 hours the app asks you to update it.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-11-17',
    title: 'Cổng trống thời gian thực & cài đặt hiển thị',
    changes: [
      'Mở trạm thấy ngay số cổng đang trống theo từng mức kW, số xe đang sạc và cổng bảo trì (nguồn EVCS, gần như tức thời).',
      'Biểu đồ "24 giờ qua": số xe sạc theo giờ, giờ đông / vắng nhất, tỉ lệ lấp đầy — xem riêng từng mức kW.',
      'Phóng to bản đồ (zoom 13+) để thấy số cổng trống ngay trên ghim, ví dụ "120kW×3 · 60kW×2".',
      'Quãng đường lái xe thật và thời gian tới trạm đang mở (thay cho đường chim bay).',
      'Nút ⚙ Cài đặt hiển thị: chọn mức công suất ưu tiên (≥ 120 / 60–119 / dưới 60 kW), chỉ trạm đang hoạt động, bề rộng hành lang dọc đường, ẩn/hiện chú giải màu.',
      'Trạm dọc đường lọc theo mức công suất đã chọn, chỉnh được ngay trong bảng hành trình.',
      'Số cổng sạc chính xác hơn: đọc đủ mọi mức công suất của trạm, tách đúng cổng AC/DC.',
      'Icon trạm sạc mới (phích cắm), chú giải màu và icon trong danh sách to hơn.',
      'Thêm giao diện tiếng Anh (đổi trong Cài đặt hiển thị, hoặc mở /en/).',
      'Số cổng và số cổng đang cắm gộp chung một khối: mỗi mức kW một màu, chip tô dần theo số cổng đang dùng.',
    ],
    titleEn: 'Real-time free ports & display settings',
    changesEn: [
      'Open a station to see free ports per kW level, cars charging and ports under maintenance right away (from EVCS, near real-time).',
      '"Last 24 hours" chart: cars charging per hour, busiest / quietest hours and occupancy — viewable per kW level.',
      'Zoom in (zoom 13+) to see free ports right on the pins, e.g. "120kW×3 · 60kW×2".',
      'Real driving distance and travel time to the open station (instead of straight-line distance).',
      'New ⚙ Display settings: choose preferred power level (≥ 120 / 60–119 / under 60 kW), operating stations only, corridor width along the route, show/hide color legend.',
      'Stations along the route are filtered by the chosen power level, adjustable right in the trip panel.',
      'More accurate port counts: all power levels of a station are read, AC/DC ports split correctly.',
      'New charging station icon (plug); larger color legend and list icons.',
      'English interface (switch in Display settings, or open /en/).',
      'Ports and ports in use shown together: one colour per power level, each chip fills up as ports are taken.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-16',
    title: 'Trạm sạc dọc đường',
    changes: [
      'Trạm sạc dọc đường: chia sẻ chỉ đường từ Google Maps (Android, khi đã cài app lên màn hình chính) hoặc dán link vào app — app vẽ tuyến và liệt kê trạm theo thứ tự gặp trên đường.',
      'Chọn bề rộng hành lang 2 / 5 / 10 km; mỗi trạm ghi km trên tuyến và khoảng cách lệch khỏi đường.',
      'Trên cao tốc, tự bỏ trạm ở chiều ngược lại (bên kia dải phân cách).',
      'Link hành trình /trip?link=… mở lại được hành trình.',
      'Link trạm đổi sang /station/<id>-<tên>; link /tram/… cũ và mã QR đã in vẫn mở được.',
    ],
    titleEn: 'Charging stations along the route',
    changesEn: [
      'Stations along the route: share directions from Google Maps (Android, with the app installed to the home screen) or paste a link into the app — it draws the route and lists stations in the order you pass them.',
      'Choose a corridor width of 2 / 5 / 10 km; each station shows its km along the route and its detour distance from the road.',
      'On expressways, stations on the opposite side (across the median) are skipped automatically.',
      'Trip links /trip?link=… reopen the trip.',
      'Station links changed to /station/<id>-<name>; old /tram/… links and printed QR codes still work.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-16',
    title: 'Lọc sạc nhanh, trạng thái trạm, trạm gần bạn',
    changes: [
      'Lọc trạm có sạc nhanh DC hoặc từ 120 kW; ghim trạm đổi màu theo công suất (có chú giải màu).',
      'Trạm đang bảo trì, ngừng hoạt động hoặc sắp khai trương hiện mờ trên bản đồ, kèm nhãn trong chi tiết trạm.',
      'Lọc "Đang hoạt động" để ẩn các trạm không sạc được.',
      '"Gần tôi": 20 trạm đang hoạt động gần nhất, theo đúng bộ lọc đang bật.',
      'Sao lưu trạm đã lưu và chuyển sang máy khác bằng link, mã QR hoặc file.',
      'Bản đồ gọn hơn: bỏ nút phóng to / thu nhỏ và nút định vị.',
    ],
    titleEn: 'Fast-charging filter, station status, stations near you',
    changesEn: [
      'Filter stations with DC fast charging or 120 kW and up; station pins are colored by power (with a color legend).',
      'Stations under maintenance, out of service or opening soon are dimmed on the map and labeled in station details.',
      '"Operating" filter to hide stations you can\'t charge at.',
      '"Near me": the 20 nearest operating stations, matching the filters currently on.',
      'Back up saved stations and move them to another device via link, QR code or file.',
      'Cleaner map: removed the zoom in / out buttons and the locate button.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-16',
    title: 'Dữ liệu cập nhật hằng ngày & số cổng sạc',
    changes: [
      'Dữ liệu trạm tải từ CDN và được làm mới hằng ngày (~25.000 trạm) — không còn gói dữ liệu cố định trong app.',
      'Chi tiết trạm hiện số cổng, công suất tối đa và từng mức kW (AC/DC).',
      'Để app mở lâu: quay lại tab sẽ tự nhận bản dữ liệu mới, không tải lại trang.',
      'Chuyển sang domain charging.cangao.asia; link chia sẻ và mã QR trỏ về domain mới.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-16',
    title: 'Chia sẻ trạm bằng mã QR',
    changes: [
      'Chia sẻ trạm bằng mã QR: nút QR trong chi tiết trạm.',
      'QR "Link trạm": mở thẳng trạm trong app (đường dẫn /tram/<id>-<tên>), có tên + địa chỉ trạm khi gửi qua Zalo, Messenger.',
      'QR "Google Maps": mở đúng vị trí trạm trên Google Maps để chỉ đường.',
      'Tải ảnh thẻ QR (kèm tên trạm) hoặc chia sẻ thẳng từ điện thoại; sao chép link một chạm.',
      'Thanh địa chỉ đổi theo trạm đang mở — copy URL là ra link chia sẻ.',
      'Trang từng trạm không cho máy tìm kiếm lập chỉ mục (dữ liệu nội bộ); sitemap chỉ có trang chủ.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-16',
    title: 'Nhóm trạm đã lưu & ghim mới',
    changes: [
      'Lưu trạm vào nhóm: Yêu thích, Sao, Đánh dấu sẽ đến — một trạm nằm được nhiều nhóm.',
      'Tự tạo nhóm với tên, biểu tượng và màu riêng; xoá nhóm (bấm hai lần để xác nhận).',
      'Nhóm tự tạo có thể tự gỡ trạm sau 6 giờ / 1 ngày / 3 ngày / 1 tuần / 30 ngày, kèm đếm ngược.',
      'Danh sách trạm đã lưu, lọc theo nhóm, xếp theo khoảng cách khi có vị trí.',
      'Ghim trạm kiểu giọt nước: trụ sạc cho trạm thường, hình + màu của nhóm cho trạm đã lưu, tia sét cho trạm đang chọn.',
      'Danh sách yêu thích cũ được tự chuyển sang nhóm "Yêu thích".',
      'Bỏ bộ lọc Công cộng / Trụ LINK trên bản đồ — thông tin này vẫn hiện trong chi tiết trạm.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-16',
    title: 'Đồng bộ giao diện với app Chia Tiền',
    changes: [
      'Chuyển sang hệ thiết kế shadcn (Tailwind v4) dùng chung với app Chia Tiền.',
      'Font Be Vietnam Pro, bo góc mềm, bảng màu iOS neutral, hỗ trợ chế độ tối.',
      'Tông chủ đạo xanh (emerald) — cùng hệ màu với Chia Tiền.',
      'Bảng chi tiết trạm chuyển thành drawer kéo từ dưới lên; hộp thoại mượt hơn.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-16',
    title: 'Phiên bản đầu tiên',
    changes: [
      'Bản đồ 23.942 trạm sạc ô tô VinFast trên toàn quốc (MapLibre + OpenFreeMap).',
      'Nền bản đồ xám tối giản (Positron) để ghim trạm nổi bật.',
      'Tự gom cụm marker, bấm cụm để phóng to.',
      'Mở trang tự xác định vị trí và bay về chỗ bạn.',
      'Tìm trạm theo tên/địa chỉ, không phân biệt dấu.',
      'Lọc: Công cộng / Trụ LINK / Yêu thích.',
      'Lưu trạm yêu thích và chỉ đường nhanh sang Google Maps.',
      'Thêm app icon, thẻ SEO/Open Graph và web manifest (cài được như app).',
    ],
  },
]

/** Phiên bản hiện tại (mục đầu tiên). */
export const APP_VERSION = CHANGELOG[0].version
