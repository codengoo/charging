/**
 * Đọc body HERE Routing v8 (Worker trả nguyên văn) — thuần, không mạng, để test được.
 * Dùng cho tuyến Dọc đường (trip.ts) và quãng đường lái tới một trạm (drive.ts).
 */
import { decodeFlexiblePolyline } from '../lib/flexiblePolyline'
import type { GeoPoint } from '../lib/geo'
import type { RoutePath } from './tripTypes'

/** functionalClass 1 = hạng cao nhất (cao tốc / đường có kiểm soát lối ra). */
const LIMITED_ACCESS_CLASS = 1

export interface HereSpan {
  offset?: number
  functionalClass?: number
}
export interface HereSection {
  polyline?: string
  summary?: { length?: number; duration?: number }
  spans?: HereSpan[]
}
export interface HereRoute {
  routes?: Array<{ sections?: HereSection[] }>
}

/**
 * Mảng spans của HERE → một cờ cho TỪNG điểm. Mỗi span có `offset` là chỉ số điểm đầu, kéo dài tới
 * ngay trước `offset` của span kế tiếp. Không có spans thì coi như không đoạn nào là cao tốc —
 * mất tính năng lọc chiều ngược, nhưng không bao giờ bỏ nhầm trạm.
 */
export function limitedFlags(spans: HereSpan[] | undefined, size: number): boolean[] {
  const out = new Array<boolean>(size).fill(false)
  if (!spans) return out
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].functionalClass !== LIMITED_ACCESS_CLASS) continue
    const from = Math.min(Math.max(spans[i].offset ?? 0, 0), size)
    const to = Math.min(Math.max(spans[i + 1]?.offset ?? size, from), size)
    for (let k = from; k < to; k++) out[k] = true
  }
  return out
}

/** Body HERE Routing v8 → mọi tuyến (tuyến 0 là tuyến HERE đề xuất). Tách riêng để test được không cần mạng. */
export function parseHereRoutes(body: HereRoute): RoutePath[] {
  return (body.routes ?? []).map((r) => pathOf(r.sections ?? [])).filter((p): p is RoutePath => p !== null)
}

/** Các section của một tuyến → một đường liền. */
function pathOf(sections: HereSection[]): RoutePath | null {
  const points: GeoPoint[] = []
  const limited: boolean[] = []
  for (const sec of sections) {
    const pts = decodeFlexiblePolyline(sec.polyline ?? '')
    const flags = limitedFlags(sec.spans, pts.length)
    pts.forEach((pt, k) => {
      // Điểm nối giữa hai section bị lặp; bỏ điểm trùng thì phải bỏ cả cờ đi kèm, không thì hai
      // mảng lệch nhau từ đó trở đi (và đoạn dài 0 làm phép chiếu chia cho 0).
      const last = points[points.length - 1]
      if (last && last.lat === pt.lat && last.lng === pt.lng) return
      points.push(pt)
      limited.push(flags[k])
    })
  }
  return points.length >= 2 ? { points, limited, ...sumSummary(sections) } : null
}

/** Cộng quãng đường (m) + thời gian (s) của mọi section. */
export function sumSummary(sections: Array<Pick<HereSection, 'summary'>>): { meters: number; seconds: number } {
  let meters = 0
  let seconds = 0
  for (const s of sections) {
    meters += s.summary?.length ?? 0
    seconds += s.summary?.duration ?? 0
  }
  return { meters, seconds }
}
