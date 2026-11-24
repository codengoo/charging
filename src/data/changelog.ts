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
    version: '0.16.1',
    date: '2026-11-24',
    title: 'Gọn hơn',
    changes: [
      "Số phiên bản chuyển sang góc dưới phải, ghi công bản đồ sang góc trái và tự thu gọn.",
      "Thông tin & ghi công chuyển vào Lịch sử cập nhật.",
      "Lịch sử cập nhật hiện 3 bản mới nhất, bấm để xem các bản cũ hơn.",
      "Ô giá sạc hiện dấu phân tách hàng nghìn (3.858).",
    ],
    titleEn: 'Tidier',
    changesEn: [
      "Version number moved to the bottom right; map credits moved to the left and collapse on their own.",
      "About & credits moved into the Changelog.",
      "The Changelog shows the 3 latest versions — tap to see older ones.",
      "The charging price field shows thousands separators (3,858).",
    ],
  },
  {
    version: '0.16.0',
    date: '2026-11-24',
    title: 'Tiền sạc, tầm pin & lọc thêm',
    changes: [
      "Nút định vị ở góc dưới phải bản đồ: bấm để về chỗ bạn đứng.",
      "Ước tính tiền sạc ở từng trạm và cho cả kế hoạch sạc dọc đường — đặt giá sạc trong Xe của bạn.",
      "Tầm pin: xem trên bản đồ với % pin hiện tại đi được bao xa, đi rồi về được bao xa.",
      "Lọc thêm trong Cài đặt: chỉ trạm công cộng, miễn phí gửi xe, số cổng tối thiểu.",
      "Nhấn giữ biểu tượng app để mở nhanh Gần tôi, Dọc đường, Quét QR.",
    ],
    titleEn: 'Charging cost, range & more filters',
    changesEn: [
      "Locate button in the bottom-right corner of the map: tap to jump to where you are.",
      "Estimated charging cost at each station and for the whole charging plan — set your price in Your car.",
      "Range: see on the map how far you can go, and go and come back, with your current battery.",
      "More filters in Settings: public stations only, free parking, minimum number of ports.",
      "Long-press the app icon for quick access to Near me, Along route and QR scan.",
    ],
  },
  {
    version: '0.15.1',
    date: '2026-11-17',
    title: 'Đường cong sạc',
    changes: ["Xem đường cong sạc nhanh của xe trong Xe của bạn, so ở trụ 60 / 120 / 250 kW."],
    titleEn: 'Charging curve',
    changesEn: ["See your car's fast-charging curve in Your car, compared on 60 / 120 / 250 kW chargers."],
  },
  {
    version: '0.15.0',
    date: '2026-11-17',
    title: 'Địa điểm hay dùng',
    changes: [
      "Lưu Nhà, Công ty và địa điểm hay đi — bấm là tìm đường kèm trạm dọc đường.",
      "Chạm giữ bản đồ để lưu địa điểm, tìm đường hoặc xem trạm gần đó.",
      "Xem trạm gần Nhà, Công ty ngay trong Gần tôi.",
      "Quét QR mở toàn màn hình trên điện thoại.",
    ],
    titleEn: 'Saved places',
    changesEn: [
      "Save Home, Work and favourite places — one tap for a route with stations along the way.",
      "Long-press the map to save a place, get directions or see stations nearby.",
      "See stations near Home or Work right in Near me.",
      "QR scanning opens full screen on phones.",
    ],
  },
  {
    version: '0.14.0',
    date: '2026-11-17',
    title: 'Quét QR, kế hoạch sạc thông minh hơn, dùng khi mất sóng',
    changes: [
      "Quét mã QR trên thẻ trạm để mở trạm ngay.",
      "Kế hoạch sạc chọn ít lần sạc nhất, rồi sạc nhanh nhất.",
      "Thời gian sạc tính theo đường cong của từng mẫu xe.",
      "Mất sóng vẫn mở được bản đồ, trạm và hành trình vừa xem.",
    ],
    titleEn: 'QR scan, smarter charging plan, offline',
    changesEn: [
      "Scan a station card QR code to open the station.",
      "The charging plan picks the fewest stops, then the fastest charging.",
      "Charging time follows each car model's charging curve.",
      "Works without signal: map, stations and your last trip stay available.",
    ],
  },
  {
    version: '0.13.0',
    date: '2026-11-17',
    title: "Dọn mã, ổn định hơn",
    changes: [
      "Các bảng dùng chung một kiểu tiêu đề.",
      "Dữ liệu trạm cập nhật đúng cả khi chỉ số cổng thay đổi trong ngày.",
      "Bản dữ liệu hỏng không còn được đẩy lên.",
    ],
    titleEn: "Code cleanup, more stable",
    changesEn: [
      "All panels share one header style.",
      "Station data refreshes even when only port counts change during the day.",
      "Broken data builds are no longer published.",
    ],
  },
  {
    version: '0.12.1',
    date: '2026-11-17',
    title: "Sửa lỗi & bảo vệ máy chủ",
    changes: [
      "Không còn kẹt lỗi \"không có ảnh\" ở trạm sau một lần tải lỗi.",
      "Đánh giá: \"Xem thêm\" không bỏ sót bài; bài đang bị ẩn không xoá được.",
      "Chặn quét dữ liệu trạm hàng loạt.",
      "Mở link trạm / hành trình không còn bị GPS kéo bản đồ đi chỗ khác.",
      "Trạm gần bạn không bỏ sót trạm gần hơn ở hướng đông-tây.",
      "Ô tìm kiếm đóng khi bấm ra ngoài hoặc nhấn Esc.",
    ],
    titleEn: "Fixes & server protection",
    changesEn: [
      "A station no longer stays stuck without photos after one failed load.",
      "Reviews: \"Show more\" no longer skips posts; hidden posts can't be deleted.",
      "Blocks bulk scraping of station data.",
      "Opening a station or trip link no longer gets pulled away by GPS.",
      "Stations near you no longer misses closer stations to the east or west.",
      "Search results close when you tap outside or press Esc.",
    ],
  },
  {
    version: '0.12.0',
    date: '2026-11-17',
    title: "Pin dự phòng, trạm trên cao tốc & bảng gọn hơn",
    changes: [
      "Tự đặt mức pin dự phòng khi lên kế hoạch sạc.",
      "Kế hoạch sạc bỏ trạm phải ra khỏi cao tốc hoặc ở chiều ngược.",
      "Bảng Dọc đường gọn hơn: thu gọn tuỳ chọn, cuộn mượt.",
      "Nút \"Dùng vị trí của tôi\" trong Trạm gần bạn.",
      "iPhone: status bar trong suốt.",
    ],
    titleEn: "Battery reserve, highway stations & a tidier panel",
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
    title: "Chọn tuyến đường",
    changes: [
      "Xem tối đa 3 tuyến và chọn tuyến muốn đi.",
      "Tránh thu phí / cao tốc / phà.",
      "Đọc đúng link có kéo tuyến và link chia sẻ từ iPhone.",
    ],
    titleEn: "Pick your route",
    changesEn: [
      "See up to 3 routes and pick the one you'll drive.",
      "Avoid tolls / highways / ferries.",
      "Reads dragged-route links and links shared from iPhone correctly.",
    ],
  },
  {
    version: '0.10.0',
    date: '2026-11-17',
    title: "Kế hoạch sạc, ghi chú & đánh giá trạm",
    changes: [
      "Tự lên kế hoạch dừng sạc cho hành trình.",
      "Nhập mức tiêu thụ thực tế của xe.",
      "Ghi chú riêng cho từng trạm.",
      "Đánh giá sao và bình luận cho trạm.",
    ],
    titleEn: "Charging plan, notes & station reviews",
    changesEn: [
      "Automatic charging stops for your trip.",
      "Enter your car's real consumption.",
      "Private notes for each station.",
      "Star ratings and comments for stations.",
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-17',
    title: "% pin khi đến trạm",
    changes: [
      "Chọn mẫu xe của bạn.",
      "Ước tính % pin khi tới trạm và thời gian sạc.",
      "Dọc đường: % pin tại từng trạm, vạch \"Trạm cuối còn kịp\".",
    ],
    titleEn: "Battery on arrival",
    changesEn: [
      "Pick your car model.",
      "Estimated battery on arrival and charging time.",
      "Along route: battery at each station, \"last station you can reach\" marker.",
    ],
  },
  {
    version: '0.8.0',
    date: '2026-11-17',
    title: "Cổng trống thời gian thực & cài đặt hiển thị",
    changes: [
      "Số cổng trống thời gian thực và biểu đồ 24 giờ.",
      "Quãng đường lái xe thật tới trạm.",
      "Cài đặt hiển thị: mức công suất, chỉ trạm hoạt động, chú giải.",
      "Giao diện tiếng Anh.",
    ],
    titleEn: "Real-time free ports & display settings",
    changesEn: [
      "Real-time free ports and a 24-hour chart.",
      "Real driving distance to the station.",
      "Display settings: power level, operating only, legend.",
      "English interface.",
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-16',
    title: "Trạm sạc dọc đường",
    changes: [
      "Tìm trạm dọc tuyến từ link Google Maps.",
      "Chọn bề rộng hành lang 2 / 5 / 10 km.",
      "Bỏ trạm ở chiều ngược trên cao tốc.",
    ],
    titleEn: "Charging stations along the route",
    changesEn: [
      "Find stations along a Google Maps route.",
      "Corridor width 2 / 5 / 10 km.",
      "Skips stations on the opposite side of expressways.",
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-16',
    title: "Lọc sạc nhanh, trạng thái trạm, trạm gần bạn",
    changes: [
      "Lọc theo công suất, ghim đổi màu theo kW.",
      "Hiện trạm bảo trì / ngừng hoạt động.",
      "\"Gần tôi\": 20 trạm gần nhất.",
      "Sao lưu và chuyển trạm đã lưu sang máy khác.",
    ],
    titleEn: "Fast-charging filter, station status, stations near you",
    changesEn: [
      "Filter by power, pins colored by kW.",
      "Shows stations under maintenance / out of service.",
      "\"Near me\": the 20 nearest stations.",
      "Back up saved stations and move them to another device.",
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-16',
    title: "Dữ liệu cập nhật hằng ngày & số cổng sạc",
    changes: [
      "Dữ liệu trạm cập nhật hằng ngày.",
      "Hiện số cổng và công suất từng trạm.",
      "Chuyển sang domain charging.cangao.asia.",
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-16',
    title: "Chia sẻ trạm bằng mã QR",
    changes: [
      "Chia sẻ trạm bằng mã QR hoặc link.",
      "Tải ảnh thẻ QR, mở nhanh trên Google Maps.",
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-16',
    title: "Nhóm trạm đã lưu & ghim mới",
    changes: [
      "Lưu trạm vào nhóm, tự tạo nhóm riêng.",
      "Nhóm tự gỡ trạm sau thời hạn đặt trước.",
      "Ghim trạm kiểu mới.",
    ],
  },
  {
    version: '0.2.0',
    date: '2026-11-16',
    title: "Đồng bộ giao diện với app Chia Tiền",
    changes: [
      "Giao diện mới, có chế độ tối.",
      "Chi tiết trạm dạng ngăn kéo từ dưới lên.",
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-16',
    title: "Phiên bản đầu tiên",
    changes: [
      "Bản đồ trạm sạc VinFast toàn quốc.",
      "Tìm trạm, lưu yêu thích, chỉ đường Google Maps.",
      "Cài được như app.",
    ],
  },
]

/** Phiên bản hiện tại (mục đầu tiên). */
export const APP_VERSION = CHANGELOG[0].version
