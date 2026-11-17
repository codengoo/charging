/**
 * Tìm trạm dọc một tuyến đường. Port RouteCorridor.kt + StationRepository.alongRoute
 * (charge-map-android).
 *
 * Mọi phép đo ở đây làm trên MẶT PHẲNG chứ không phải haversine: quy lat/lng ra km bằng hai hệ
 * số cố định lấy tại vĩ độ giữa tuyến. Ở phạm vi một chuyến xe trong nước sai số dưới 0,3% —
 * không đáng kể so với bán kính hành lang tính bằng km, mà rẻ hơn haversine hàng chục lần. Và ở
 * đây phải chạy HÀNG TRIỆU phép đo: mỗi trạm ứng viên đối chiếu với mỗi đoạn của tuyến.
 */
import { KM_PER_LAT, KM_PER_LNG, toRad, type GeoPoint } from '../lib/geo'
import { CELL_SIZE, cellOf, type StationIndex } from './stations'
import type { Station } from './types'
import type { RoutePath } from './tripTypes'

/** Một trạm trong hành lang. */
export interface AlongRoute {
  station: Station
  /** Đã đi được bao nhiêu km kể từ điểm xuất phát khi ngang qua trạm. */
  atKm: number
  /** Trạm cách tim đường bao nhiêu km. */
  offsetKm: number
  /**
   * Trạm sát CAO TỐC nhưng không phải trạm dừng nghỉ cùng chiều: muốn vào phải ra nút giao rồi
   * quay lại, quãng vòng thật lớn hơn nhiều so với `offsetKm`. Vẫn hiện trong danh sách, kế hoạch
   * sạc không chọn.
   */
  viaExit: boolean
}

/** `items` là phần hiện được, `total` là tổng trạm thật sự nằm trong hành lang. */
export interface RouteHits {
  items: AlongRoute[]
  total: number
}

/** Đường đã bớt điểm, kèm cờ cao tốc đi theo từng điểm. */
export interface ThinRoute {
  points: GeoPoint[]
  limited: boolean[]
}

/**
 * Số điểm tối đa giữ lại. HERE trả rất dày — tuyến 300 km có thể hơn 10 nghìn điểm, đủ vẽ mượt
 * nhưng để đo khoảng cách thì thừa: hai điểm cách nhau vài trăm mét không thể giấu một trạm ở giữa.
 */
const MAX_POINTS = 1500
/** Bước lấy mẫu nhỏ nhất. Dưới mức này thì giữ hết cũng không tốn thêm gì. */
const MIN_STEP_KM = 0.25
/**
 * Trong bao xa thì một trạm bên trái cao tốc được coi là "bên kia dải phân cách". Trạm ở làn
 * ngược chiều cao tốc Việt Nam thường cách tim đường 30–80 m; 300 m đủ rộng mà chưa chạm khu dân
 * cư cạnh đường — chỗ đó vào bằng nút giao, không liên quan gì tới chiều xe chạy.
 */
const OPPOSITE_SIDE_KM = 0.3
/**
 * Trạm bên PHẢI cao tốc trong chừng này = trạm dừng nghỉ cùng chiều, rẽ vào thẳng từ cao tốc.
 * Xa hơn (bên nào cũng vậy) là trạm trong làng / khu đô thị cạnh cao tốc — phải ra nút giao.
 * Đo trên tuyến Hà Nội – Ninh Bình (2026-11-17): 119 trạm trong 1,5 km quanh đoạn cao tốc, gần
 * như không trạm nào nằm trên cao tốc.
 */
const REST_STOP_KM = 0.15
/** Trần số trạm hiện trong danh sách (giống ALONG_ROUTE_LIMIT bên Android). */
export const ALONG_ROUTE_LIMIT = 400

const sq = (v: number) => v * v

function flatKm(a: GeoPoint, b: GeoPoint, kx: number): number {
  return Math.sqrt(sq((b.lng - a.lng) * kx) + sq((b.lat - a.lat) * KM_PER_LAT))
}

/**
 * Bớt điểm. Lấy mẫu theo QUÃNG ĐƯỜNG chứ không theo góc (Douglas-Peucker): chỉ cần các điểm rải
 * đều để đo khoảng cách, không cần giữ đúng hình khúc cua. Điểm đầu và cuối luôn được giữ.
 */
export function thinRoute(points: GeoPoint[], limited: boolean[]): ThinRoute {
  // Cờ đi kèm từng điểm nên phải bớt cùng nhịp; lệch một điểm là cả đoạn sau gán nhầm hạng đường.
  const flag = (i: number) => limited[i] ?? false
  if (points.length <= 2) return { points, limited: points.map((_, i) => flag(i)) }

  const kx = KM_PER_LNG * Math.cos(toRad(points[points.length >> 1].lat))
  let total = 0
  for (let i = 0; i < points.length - 1; i++) total += flatKm(points[i], points[i + 1], kx)
  const step = Math.max(MIN_STEP_KM, total / MAX_POINTS)

  const out: GeoPoint[] = [points[0]]
  const flags: boolean[] = [flag(0)]
  let acc = 0
  // "Có bất kỳ điểm nào bị bỏ là cao tốc" thì đoạn gộp là cao tốc: thà chặn nhầm còn hơn bỏ lọt
  // một trạm bên kia dải phân cách.
  let pending = false
  for (let i = 1; i < points.length - 1; i++) {
    acc += flatKm(points[i - 1], points[i], kx)
    pending = pending || flag(i)
    if (acc >= step) {
      out.push(points[i])
      flags.push(pending || flag(i))
      acc = 0
      pending = false
    }
  }
  out.push(points[points.length - 1])
  flags.push(flag(points.length - 1))
  return { points: out, limited: flags }
}

/**
 * Các ô lưới hành lang chạm tới. Tra theo ô (`index.byCell`) thay vì quét cả nước: tuyến 300 km
 * với hành lang 5 km chạm khoảng vài chục ô, mỗi ô trung vị ~4 trạm.
 */
export function corridorCells(points: GeoPoint[], radiusKm: number): number[] {
  // Ô rộng 0,1° ~ 11,1 km theo vĩ độ và ~10,4 km theo kinh độ ở vĩ độ 21. Lấy 10 km cho chắc.
  const pad = Math.ceil(radiusKm / 10)
  const out = new Set<number>()
  for (const p of points) {
    const la0 = Math.floor(p.lat / CELL_SIZE)
    const ln0 = Math.floor(p.lng / CELL_SIZE)
    for (let la = la0 - pad; la <= la0 + pad; la++) {
      for (let ln = ln0 - pad; ln <= ln0 + pad; ln++) {
        out.add(cellOf(la * CELL_SIZE + CELL_SIZE / 2, ln * CELL_SIZE + CELL_SIZE / 2))
      }
    }
  }
  return [...out]
}

/**
 * Lọc trạm trong `radiusKm` quanh tuyến, sắp theo THỨ TỰ GẶP TRÊN ĐƯỜNG (không theo khoảng cách
 * tới người dùng): danh sách để đọc khi đang lái, trạm thứ nhất phải là trạm gặp đầu tiên.
 */
export function pickAlongRoute(route: ThinRoute, stations: Station[], radiusKm: number): AlongRoute[] {
  const path = route.points
  const n = path.length
  if (n < 2 || stations.length === 0) return []

  const kx = KM_PER_LNG * Math.cos(toRad(path[n >> 1].lat))
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    xs[i] = path[i].lng * kx
    ys[i] = path[i].lat * KM_PER_LAT
  }
  // Quãng đường cộng dồn tới từng điểm, để biết trạm nằm ở km thứ mấy.
  const cum = new Float64Array(n)
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.sqrt(sq(xs[i] - xs[i - 1]) + sq(ys[i] - ys[i - 1]))

  // Khung bao cả tuyến nới bằng bán kính: trạm ngoài khung khỏi đo với từng đoạn.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    if (xs[i] < minX) minX = xs[i]
    if (xs[i] > maxX) maxX = xs[i]
    if (ys[i] < minY) minY = ys[i]
    if (ys[i] > maxY) maxY = ys[i]
  }
  minX -= radiusKm; maxX += radiusKm; minY -= radiusKm; maxY += radiusKm

  const out: AlongRoute[] = []
  for (const s of stations) {
    const px = s.lng * kx
    const py = s.lat * KM_PER_LAT
    if (px < minX || px > maxX || py < minY || py > maxY) continue

    let best = Infinity
    let bestAt = 0
    let bestSeg = 0
    let bestCross = 0
    for (let i = 0; i < n - 1; i++) {
      const dx = xs[i + 1] - xs[i]
      const dy = ys[i + 1] - ys[i]
      const len2 = dx * dx + dy * dy
      // Chiếu điểm lên đoạn, kẹp t về [0,1] để không rơi ra ngoài đoạn.
      const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - xs[i]) * dx + (py - ys[i]) * dy) / len2))
      const qx = xs[i] + t * dx
      const qy = ys[i] + t * dy
      const d2 = sq(px - qx) + sq(py - qy)
      if (d2 < best) {
        best = d2
        bestAt = cum[i] + t * Math.sqrt(len2)
        bestSeg = i
        // Tích có hướng (x đông, y bắc): DƯƠNG là trạm nằm bên TRÁI hướng đi.
        bestCross = dx * (py - qy) - dy * (px - qx)
      }
    }
    const d = Math.sqrt(best)
    if (d > radiusKm) continue
    if (isOppositeCarriageway(route, bestSeg, d, bestCross)) continue
    const onHighway = route.limited[bestSeg] ?? false
    const viaExit = onHighway && !(bestCross <= 0 && d <= REST_STOP_KM)
    out.push({ station: s, atKm: bestAt, offsetKm: d, viaExit })
  }
  return out.sort((a, b) => a.atKm - b.atKm)
}

/**
 * Trạm có nằm BÊN KIA DẢI PHÂN CÁCH của đoạn cao tốc không. Đo chim bay thì trạm làn ngược chiều
 * chỉ cách 40 m, nhưng muốn vào phải chạy tới nút giao, quay đầu rồi chạy ngược — không phải
 * "trạm dọc đường" theo nghĩa hữu ích nào. Phải đúng cả ba:
 *   1. Đoạn gần trạm nhất là CAO TỐC (đường thường cắt ngang được);
 *   2. Trạm RẤT SÁT đường (≤ OPPOSITE_SIDE_KM);
 *   3. Trạm bên TRÁI hướng đi (Việt Nam đi bên phải).
 */
function isOppositeCarriageway(route: ThinRoute, segment: number, offsetKm: number, cross: number): boolean {
  return offsetKm <= OPPOSITE_SIDE_KM && cross > 0 && (route.limited[segment] ?? false)
}

/** Khung bao `[[w, s], [e, n]]` cho maplibre `fitBounds`, nới 12% để tuyến không dính mép. */
export function routeBounds(points: GeoPoint[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null
  let s = 90, n = -90, w = 180, e = -180
  for (const p of points) {
    if (p.lat < s) s = p.lat
    if (p.lat > n) n = p.lat
    if (p.lng < w) w = p.lng
    if (p.lng > e) e = p.lng
  }
  const padLat = Math.max(0.01, Math.abs(n - s) * 0.12)
  const padLng = Math.max(0.01, Math.abs(e - w) * 0.12)
  return [[w - padLng, s - padLat], [e + padLng, n + padLat]]
}

/**
 * thin → ô lưới → ứng viên → pick → trần `limit`. Bỏ trạm không hoạt động (bảo trì, ngừng, chưa
 * khai trương) như bản Android mặc định — đang tìm chỗ sạc dọc đường.
 *
 * Vượt trần thì bỏ theo ĐỘ LỆCH KHỎI TUYẾN, không cắt đuôi: cắt đuôi giữ trạm đầu chuyến và vứt
 * hết phần cuối — đúng đoạn người ta lo hết pin nhất.
 */
export function alongRoute(
  index: StationIndex,
  route: RoutePath,
  radiusKm: number,
  /** Bộ lọc thêm (vd. mức công suất) — áp TRƯỚC trần `limit` để trần không ăn mất trạm hợp lệ. */
  keep: (st: Station) => boolean = () => true,
  limit = ALONG_ROUTE_LIMIT,
): RouteHits {
  const thin = thinRoute(route.points, route.limited)
  if (thin.points.length < 2) return { items: [], total: 0 }
  const candidates: Station[] = []
  for (const cell of corridorCells(thin.points, radiusKm)) {
    for (const st of index.byCell.get(cell) ?? []) if (st.status === 0 && keep(st)) candidates.push(st)
  }
  const all = pickAlongRoute(thin, candidates, radiusKm)
  if (all.length <= limit) return { items: all, total: all.length }
  const kept = [...all].sort((a, b) => a.offsetKm - b.offsetKm).slice(0, limit).sort((a, b) => a.atKm - b.atKm)
  return { items: kept, total: all.length }
}
