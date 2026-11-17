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
const CLIMATE = 1.08
const SPREAD = 0.08

/** Đi phố chậm tốn ít hơn (tái sinh khi phanh), cao tốc tốn hơn hẳn (cản gió). */
export function speedFactor(avgKmh: number): number {
  if (avgKmh < 40) return 0.95
  if (avgKmh < 70) return 1
  if (avgKmh < 90) return 1.12
  return 1.25
}

export function arrivalPct(startPct: number, km: number, avgKmh: number, v: Vehicle, climate: boolean): ArrivalEstimate {
  const kwh = ((km * v.kwhPer100) / 100) * speedFactor(avgKmh) * (climate ? CLIMATE : 1)
  const used = (kwh / v.kwh) * 100
  return { low: startPct - used * (1 + SPREAD), high: startPct - used * (1 - SPREAD) }
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

/** Công suất DC xe nhận ở `soc`% — nội suy tuyến tính trên `dcCurve`. */
export function dcCurveKw(v: Vehicle, soc: number): number {
  const c = v.dcCurve
  if (!c || c.length === 0) return v.dcKw * DC_FLAT
  if (soc <= c[0][0]) return c[0][1]
  for (let i = 1; i < c.length; i++) {
    const [s1, k1] = c[i]
    if (soc <= s1) {
      const [s0, k0] = c[i - 1]
      return k0 + ((k1 - k0) * (soc - s0)) / (s1 - s0)
    }
  }
  return c[c.length - 1][1]
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
