/**
 * Ước tính % pin khi đến trạm + thời gian sạc lên 80%. Tính hoàn toàn ở client từ quãng đường
 * đã có (`/api/drive`, km trên tuyến của routeCorridor) — không gọi thêm HERE / EVCS.
 *
 * Mô hình cố ý đơn giản: tiêu thụ cố định theo xe × hệ số tốc độ trung bình × điều hoà, hiện
 * thành KHOẢNG ±8% thay vì một con số chính xác giả. Không tính độ dốc (đường đèo tốn hơn).
 */
import type { LivePorts } from './live'
import type { PortGroup, StationPower } from './types'
import type { Vehicle } from './vehicles'

/** % pin người dùng nhập, kèm lúc nhập. */
export interface BatteryReading {
  pct: number
  at: number
}

/** % pin khi đến; `low` = bi quan, `high` = lạc quan. Có thể âm (không tới được). */
export interface ArrivalEstimate {
  low: number
  high: number
}

/** Nhập quá 2 giờ thì coi là cũ — vẫn tính, nhưng nhắc nhập lại. */
export const STALE_MS = 2 * 60 * 60 * 1000
/** "Còn kịp" = ước tính bi quan vẫn còn ít nhất mức này. Mặc định; người dùng đổi ở Settings.reservePct. */
export const RESERVE_PCT = 10
/** Mẫu pin dự phòng trong "Xe của bạn"; ngoài các mức này người dùng tự nhập trong RESERVE_MIN..RESERVE_MAX. */
export const RESERVE_OPTIONS = [10, 15, 20, 30] as const
export const RESERVE_MIN = 1
export const RESERVE_MAX = 50
export const TARGET_PCT = 80
/** % pin hiện khi chưa nhập lần nào. */
export const DEFAULT_PCT = 80
/** Điều hoà bật: tiêu thụ ×1,08. */
export const CLIMATE = 1.08
/** Nửa bề rộng khoảng ước tính (±8%). */
export const SPREAD = 0.08
/** Đường chim bay → đường lái ~1,3 lần (đường VN vòng vèo). */
export const ROAD_DETOUR = 1.3

/** Đi phố chậm tốn ít hơn (tái sinh khi phanh), cao tốc tốn hơn hẳn (cản gió). */
export function speedFactor(avgKmh: number): number {
  if (avgKmh < 40) return 0.95
  if (avgKmh < 70) return 1
  if (avgKmh < 90) return 1.12
  return 1.25
}

/** kWh xe dùng cho `km` (giữa khoảng ước tính, chưa gồm độ dốc) — chi phí cả chuyến. */
export function driveKwh(km: number, avgKmh: number, v: Vehicle, climate: boolean): number {
  return ((km * v.kwhPer100) / 100) * speedFactor(avgKmh) * (climate ? CLIMATE : 1)
}

/**
 * `extraKwh`: năng lượng thêm do độ dốc (elevation.ts `climbKwh`; âm = đổ dốc lấy lại được). Không
 * nhân khoảng ±SPREAD — phần đó đã ước tính riêng. Tổng tiêu thụ không âm (không "sạc" thêm pin).
 */
export function arrivalPct(
  startPct: number,
  km: number,
  avgKmh: number,
  v: Vehicle,
  climate: boolean,
  extraKwh = 0,
): ArrivalEstimate {
  const kwh = ((km * v.kwhPer100) / 100) * speedFactor(avgKmh) * (climate ? CLIMATE : 1)
  const used = (k: number) => (Math.max(0, k + extraKwh) / v.kwh) * 100
  return { low: startPct - used(kwh * (1 + SPREAD)), high: startPct - used(kwh * (1 - SPREAD)) }
}

/** Tốc độ trung bình giả định khi không có thời gian lái (đường hỗn hợp). */
export const FALLBACK_KMH = 50

/** Tốc độ trung bình (km/h) của một quãng; thiếu thời gian thì coi như đường hỗn hợp. */
export function avgKmh(meters: number, seconds: number): number {
  return seconds > 0 ? meters / 1000 / (seconds / 3600) : FALLBACK_KMH
}

export type ChargePort = Omit<PortGroup, 'count'>

/** Live chỉ có kW: trên mức này coi là DC khi không tra được nhóm cổng. */
const AC_MAX_KW = 22
/** Xe không có đường cong DC: phẳng 75% công suất đỉnh (mức trung bình dưới 80%). AC gần như phẳng (~90%). */
const DC_FLAT = 0.75
const AC_CURVE = 0.9
/** Bước tích phân đường cong sạc (% pin). */
const CURVE_STEP = 0.5

type Curve = NonNullable<Vehicle['dcCurve']>

/**
 * Hệ số góc tại từng điểm cho nội suy cubic ĐƠN ĐIỆU (Fritsch–Carlson / PCHIP): đường đi mượt qua
 * các điểm mà không vọt quá giá trị hai bên (không "lồi" lên trên đỉnh, không âm). Tính một lần
 * cho mỗi đường cong.
 */
const slopesCache = new WeakMap<Curve, number[]>()
function slopesOf(c: Curve): number[] {
  const hit = slopesCache.get(c)
  if (hit) return hit
  const n = c.length
  const d = Array.from({ length: n - 1 }, (_, i) => (c[i + 1][1] - c[i][1]) / (c[i + 1][0] - c[i][0]))
  const m = new Array<number>(n)
  m[0] = d[0] ?? 0
  m[n - 1] = d[n - 2] ?? 0
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0 // đỉnh / đáy / đoạn phẳng: tiếp tuyến nằm ngang
    else {
      const h0 = c[i][0] - c[i - 1][0]
      const h1 = c[i + 1][0] - c[i][0]
      const w0 = 2 * h1 + h0
      const w1 = h1 + 2 * h0
      m[i] = (w0 + w1) / (w0 / d[i - 1] + w1 / d[i]) // trung bình điều hoà có trọng số
    }
  }
  slopesCache.set(c, m)
  return m
}

/** Công suất DC xe nhận ở `soc`% — nội suy cubic đơn điệu trên `dcCurve` (ngoài đầu mút giữ giá trị mút). */
export function dcCurveKw(v: Vehicle, soc: number): number {
  const c = v.dcCurve
  if (!c || c.length === 0) return v.dcKw * DC_FLAT
  if (soc <= c[0][0]) return c[0][1]
  if (soc >= c[c.length - 1][0]) return c[c.length - 1][1]
  const m = slopesOf(c)
  let i = 1
  while (soc > c[i][0]) i++
  const [s0, k0] = c[i - 1]
  const [s1, k1] = c[i]
  const h = s1 - s0
  const t = (soc - s0) / h
  const t2 = t * t
  const t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * k0 + (t3 - 2 * t2 + t) * h * m[i - 1] + (-2 * t3 + 3 * t2) * k1 + (t3 - t2) * h * m[i]
}

/**
 * Cổng sẽ cắm: mạnh nhất còn trống theo live nếu có, không thì nhóm cổng mạnh nhất (ưu tiên DC).
 * Live chỉ có kW — tra AC/DC theo nhóm cổng, không có thì trên 22 kW là DC.
 */
export function chargePort(power: StationPower | undefined, live: LivePorts[] | null): ChargePort | null {
  const groups = power?.groups ?? []
  const free = live?.filter((p) => p.free > 0).sort((a, b) => b.kw - a.kw)[0]
  if (free) return { kw: free.kw, dc: groups.find((g) => g.kw === free.kw)?.dc ?? free.kw > AC_MAX_KW }
  const best = [...groups].sort((a, b) => Number(b.dc) - Number(a.dc) || b.kw - a.kw)[0]
  return best ? { kw: best.kw, dc: best.dc } : null
}

/**
 * Phút sạc từ `fromPct` lên `toPct` (mặc định 80%). DC: tích phân theo đường cong của xe, mỗi bước
 * lấy min(đường cong, cổng trạm). AC: gần như phẳng (~90% min(cổng, bộ sạc xe)). Đã đủ → null.
 */
export function chargeMinutes(fromPct: number, port: ChargePort, v: Vehicle, toPct = TARGET_PCT): number | null {
  const from = Math.max(0, fromPct)
  if (from >= toPct || port.kw <= 0) return null
  if (!port.dc) {
    const kw = Math.min(port.kw, v.acKw) * AC_CURVE
    return kw > 0 ? ((((toPct - from) / 100) * v.kwh) / kw) * 60 : null
  }
  let hours = 0
  for (let s = from; s < toPct; s += CURVE_STEP) {
    const step = Math.min(CURVE_STEP, toPct - s)
    const kw = Math.min(port.kw, dcCurveKw(v, s + step / 2))
    if (kw <= 0) return null
    hours += ((step / 100) * v.kwh) / kw
  }
  return hours * 60
}
