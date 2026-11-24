/**
 * Giờ theo đồng hồ cho kế hoạch sạc: xuất phát lúc `departMs` → giờ tới / rời từng điểm dừng và
 * giờ tới nơi. Lái với tốc độ trung bình cả tuyến (như planCharging), cộng phút sạc; quãng vòng ra
 * nút giao (`viaExit`) cộng thời gian như `totalSeconds` của kế hoạch — giờ tới nơi khớp tóm tắt.
 */
import type { ChargePlan } from './chargePlan'

export interface StopTimes {
  arrive: number
  leave: number
}

export function planTimeline(
  plan: ChargePlan,
  route: { meters: number; seconds: number },
  departMs: number,
): { stops: StopTimes[]; arriveDest: number | null } {
  const kmPerSec = route.seconds > 0 ? route.meters / 1000 / route.seconds : 0
  const secs = (km: number) => (kmPerSec > 0 ? km / kmPerSec : 0)
  const stops: StopTimes[] = []
  let t = departMs
  let prevKm = 0
  for (const s of plan.stops) {
    // Vòng ra nút giao: nửa quãng vòng lúc vào, nửa lúc quay ra tuyến.
    const half = s.item.viaExit ? s.detourKm / 2 : 0
    const arrive = t + (secs(s.item.atKm - prevKm) + secs(half)) * 1000
    const leave = arrive + (s.chargeMin ?? 0) * 60_000
    stops.push({ arrive, leave })
    t = leave + secs(half) * 1000
    prevKm = s.item.atKm
  }
  return { stops, arriveDest: plan.ok ? departMs + plan.totalSeconds * 1000 : null }
}

/** Bây giờ làm tròn LÊN 5 phút — giờ xuất phát mặc định. */
export function nextFiveMinutes(now = Date.now()): number {
  const step = 5 * 60_000
  return Math.ceil(now / step) * step
}
