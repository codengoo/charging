/**
 * Tự lên kế hoạch dừng sạc cho một hành trình. Tính hoàn toàn ở client trên danh sách trạm dọc
 * đường đã có (routeCorridor) — không gọi thêm HERE / EVCS.
 *
 * Tham lam, kiểu "đi xa nhất có thể": từ chỗ đang đứng, tới được đích thì thôi; không thì ghé
 * trạm sạc nhanh XA NHẤT còn tới được với ước tính bi quan ≥ RESERVE_PCT, sạc lên TARGET_PCT,
 * lặp lại. Điểm dừng nào từ đó tới được đích thì chỉ sạc VỪA ĐỦ (đích vẫn còn ≥ RESERVE_PCT theo
 * ước tính bi quan) thay vì lên 80% — đỡ ngồi chờ sạc thừa. Ít điểm dừng nhất với ngưỡng an toàn
 * cố định — đủ tốt cho một gợi ý; không tối ưu tổng thời gian (trạm 250 kW xa hơn chút có thể
 * nhanh hơn trạm 60 kW).
 */
import { RESERVE_PCT, TARGET_PCT, arrivalPct, avgKmh, chargeMinutes, type ArrivalEstimate } from './battery'
import type { AlongRoute } from './routeCorridor'
import type { StationPower } from './types'
import type { Vehicle } from './vehicles'

/** Chỉ ghé trạm có cổng DC từ mức này — AC hay DC chậm thì một lần dừng mất hàng giờ. */
export const PLAN_MIN_DC_KW = 50

export interface PlanStop {
  item: AlongRoute
  /** % pin khi tới trạm. */
  arrive: ArrivalEstimate
  /** Cổng DC mạnh nhất của trạm. */
  kw: number
  /** Sạc tới mức này: 80%, hoặc vừa đủ tới đích ở điểm dừng cuối. */
  toPct: number
  /** Phút sạc; null = tới nơi đã đủ. */
  chargeMin: number | null
}

export type ChargePlan =
  | { ok: true; stops: PlanStop[]; arriveDest: ArrivalEstimate; chargeMin: number; totalSeconds: number }
  | { ok: false; stops: PlanStop[]; stuckAtKm: number }

/** Cổng DC mạnh nhất; 0 = không có DC / chưa có dữ liệu. */
function dcMax(p: StationPower | undefined): number {
  return p ? p.groups.reduce((m, g) => (g.dc ? Math.max(m, g.kw) : m), 0) : 0
}

/** Trạm sau phải xa hơn trạm trước ít nhất chừng này — tránh "ghé" lại trạm cạnh nhau. */
const MIN_HOP_KM = 1
const MAX_STOPS = 30

/**
 * `items` phải xếp theo `atKm` (như alongRoute trả). Quãng tới một trạm = đoạn trên tuyến +
 * độ lệch (rẽ vào); rời trạm thì chặng sau cộng độ lệch đó (quay ra). Tốc độ trung bình = cả tuyến.
 */
export function planCharging(
  items: AlongRoute[],
  power: Map<string, StationPower> | null,
  route: { meters: number; seconds: number },
  startPct: number,
  v: Vehicle,
  climate: boolean,
): ChargePlan {
  const totalKm = route.meters / 1000
  const speed = avgKmh(route.meters, route.seconds)
  const candidates = items
    .map((item) => ({ item, kw: dcMax(power?.get(item.station.entityId)) }))
    .filter((c) => c.kw >= PLAN_MIN_DC_KW)

  const stops: PlanStop[] = []
  let pos = 0
  let soc = startPct
  /** Km quay ra tuyến từ trạm vừa ghé. */
  let rejoin = 0
  let chargeMin = 0

  while (stops.length <= MAX_STOPS) {
    const arriveDest = arrivalPct(soc, rejoin + Math.max(0, totalKm - pos), speed, v, climate)
    if (arriveDest.low >= RESERVE_PCT) {
      return { ok: true, stops, arriveDest, chargeMin, totalSeconds: route.seconds + chargeMin * 60 }
    }

    let best: { item: AlongRoute; kw: number; arrive: ArrivalEstimate } | null = null
    for (const c of candidates) {
      if (c.item.atKm < pos + MIN_HOP_KM) continue
      const arrive = arrivalPct(soc, rejoin + c.item.atKm - pos + c.item.offsetKm, speed, v, climate)
      // Xếp theo atKm nên trạm tới được sau cùng là trạm xa nhất.
      if (arrive.low >= RESERVE_PCT) best = { ...c, arrive }
    }
    if (!best) return { ok: false, stops, stuckAtKm: pos }

    const mid = (best.arrive.low + best.arrive.high) / 2
    // % cần để từ trạm này tới đích còn RESERVE_PCT (bi quan); quá 80% thì sạc 80% và dừng tiếp.
    const used = 100 - arrivalPct(100, best.item.offsetKm + totalKm - best.item.atKm, speed, v, climate).low
    const toPct = Math.max(mid, Math.min(TARGET_PCT, Math.ceil(RESERVE_PCT + used)))
    const minutes = chargeMinutes(mid, { kw: best.kw, dc: true }, v, toPct)
    stops.push({ item: best.item, arrive: best.arrive, kw: best.kw, toPct: Math.round(toPct), chargeMin: minutes })
    chargeMin += minutes ?? 0
    pos = best.item.atKm
    rejoin = best.item.offsetKm
    soc = toPct
  }
  return { ok: false, stops, stuckAtKm: pos }
}
