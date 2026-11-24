/**
 * Năng lượng leo / đổ dốc dọc tuyến, từ độ cao từng điểm HERE trả (`return=elevation`).
 *
 * Mức tiêu thụ của xe (vehicles.ts) là đường hỗn hợp ĐƯỜNG BẰNG. Tuyến có chênh độ cao thì cộng
 * thêm thế năng: leo H mét tốn m·g·H ÷ hiệu suất truyền động; đổ dốc lấy lại một phần (thả trôi +
 * phanh tái sinh). Đổ dốc lấy lại ÍT hơn leo tốn — ước tính nghiêng về bi quan.
 *
 * Độ cao HERE lấy từ mô hình địa hình, nhiễu vài mét từ điểm này sang điểm kia: cộng thẳng từng
 * chênh lệch nhỏ sẽ ra hàng nghìn mét "leo" ảo trên đường bằng. Chỉ cộng khi lệch khỏi mốc trước
 * ít nhất HYSTERESIS_M (lọc trễ).
 */
import { KM_PER_LAT, kmPerLng, type GeoPoint } from '../lib/geo'

const G = 9.81
/** Hiệu suất pin → bánh khi leo. */
const CLIMB_EFFICIENCY = 0.85
/** Phần thế năng lấy lại khi đổ dốc (thả trôi đỡ tốn điện + tái sinh khi phanh). */
const DESCENT_RECOVERY = 0.6
/** Lệch khỏi mốc độ cao trước bao nhiêu mét mới tính là lên / xuống. */
const HYSTERESIS_M = 5
/** Người + hành lý cộng vào khối lượng xe. */
export const LOAD_KG = 150
const J_PER_KWH = 3.6e6

/** Độ cao tích luỹ theo km trên tuyến (cùng cách đo phẳng với routeCorridor). */
export interface ElevationProfile {
  /** km tích luỹ tại từng điểm. */
  km: Float64Array
  /** Tổng mét đã leo / đã xuống tính tới từng điểm. */
  up: Float64Array
  down: Float64Array
  /** Tổng cả tuyến. */
  totalUp: number
  totalDown: number
}

export function elevationProfile(points: GeoPoint[], elev: number[] | undefined): ElevationProfile | null {
  const n = points.length
  if (!elev || elev.length !== n || n < 2) return null
  const kx = kmPerLng((points[0].lat + points[n - 1].lat) / 2)
  const km = new Float64Array(n)
  const up = new Float64Array(n)
  const down = new Float64Array(n)
  let anchor = elev[0]
  let u = 0
  let d = 0
  for (let i = 1; i < n; i++) {
    const dx = (points[i].lng - points[i - 1].lng) * kx
    const dy = (points[i].lat - points[i - 1].lat) * KM_PER_LAT
    km[i] = km[i - 1] + Math.sqrt(dx * dx + dy * dy)
    const diff = elev[i] - anchor
    if (diff >= HYSTERESIS_M) {
      u += diff
      anchor = elev[i]
    } else if (diff <= -HYSTERESIS_M) {
      d -= diff
      anchor = elev[i]
    }
    up[i] = u
    down[i] = d
  }
  return { km, up, down, totalUp: u, totalDown: d }
}

/** Giá trị tích luỹ tại `atKm` (nội suy tuyến tính, kẹp trong tuyến). */
function at(p: ElevationProfile, arr: Float64Array, atKm: number): number {
  const n = p.km.length
  if (atKm <= 0) return arr[0]
  if (atKm >= p.km[n - 1]) return arr[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (p.km[mid] <= atKm) lo = mid
    else hi = mid
  }
  const span = p.km[hi] - p.km[lo]
  const t = span > 0 ? (atKm - p.km[lo]) / span : 0
  return arr[lo] + (arr[hi] - arr[lo]) * t
}

/**
 * kWh THÊM (âm = bớt) do chênh độ cao giữa hai vị trí trên tuyến, với xe nặng `massKg` (đã gồm tải).
 * `fromKm > toKm` thì đổi chỗ — luôn tính theo chiều đi.
 */
export function climbKwh(p: ElevationProfile, fromKm: number, toKm: number, massKg: number): number {
  const a = Math.min(fromKm, toKm)
  const b = Math.max(fromKm, toKm)
  const upM = at(p, p.up, b) - at(p, p.up, a)
  const downM = at(p, p.down, b) - at(p, p.down, a)
  return (massKg * G * (upM / CLIMB_EFFICIENCY - downM * DESCENT_RECOVERY)) / J_PER_KWH
}
