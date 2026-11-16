/**
 * Quãng đường LÁI XE thật từ vị trí người dùng tới một trạm (HERE Routing qua `/api/drive`).
 * Port HereRouting.route() + fetchRoute() của app Android: chỉ gọi cho trạm người dùng thực sự
 * mở. Danh sách "Gần tôi" vẫn xếp bằng đường chim bay — HERE Matrix tính tiền theo từng ô
 * (1 điểm × 20 trạm = 20 lượt, hạn mức miễn phí chỉ 2.500), nên chỉ mượn lại kết quả đã có
 * trong cache cho trạm từng mở.
 */
import { useEffect, useRef, useState } from 'react'
import { distanceKm } from './stations'
import { pick } from '../i18n'
import type { Station } from './types'

export interface DriveInfo {
  meters: number
  seconds: number
}

export type LatLng = { lat: number; lng: number }

/** GPS dịch dưới mức này thì giữ điểm gốc cũ — trackUserLocation báo vị trí liên tục. */
const REANCHOR_KM = 0.5

/** Làm tròn ~100 m: cache trình duyệt và cache trong bộ nhớ trúng nhiều hơn. */
const round = (v: number) => Math.round(v * 1000) / 1000
const coord = (p: LatLng) => `${round(p.lat)},${round(p.lng)}`
const keyOf = (o: LatLng, st: Station) => `${coord(o)}|${st.entityId}`

/** Kết quả theo cặp (điểm gốc đã làm tròn, trạm). `null` = HERE không tìm được đường. */
const cache = new Map<string, DriveInfo | null>()

export function cachedDrive(origin: LatLng | null, st: Station): DriveInfo | null | undefined {
  return origin ? cache.get(keyOf(origin, st)) : undefined
}

async function fetchDrive(origin: LatLng, st: Station, signal: AbortSignal): Promise<DriveInfo | null> {
  const res = await fetch(`/api/drive?from=${coord(origin)}&to=${st.lat},${st.lng}`, { signal })
  // 429 / 503 / lỗi mạng: không cache để lần mở sau thử lại.
  if (!res.ok) throw new Error(String(res.status))
  const body = (await res.json()) as {
    routes?: Array<{ sections?: Array<{ summary?: { length?: number; duration?: number } }> }>
  }
  const sections = body.routes?.[0]?.sections
  if (!sections?.length) return null
  let meters = 0
  let seconds = 0
  for (const s of sections) {
    meters += s.summary?.length ?? 0
    seconds += s.summary?.duration ?? 0
  }
  return meters > 0 ? { meters, seconds } : null
}

/**
 * Điểm gốc ổn định: chỉ đổi khi GPS dịch quá REANCHOR_KM, để mỗi lần vị trí nhích vài mét
 * không bắn request mới và key cache không đổi.
 */
export function useStableOrigin(pos: LatLng | null): LatLng | null {
  const [anchor, setAnchor] = useState(pos)
  useEffect(() => {
    if (!pos) return
    setAnchor((a) => (a && distanceKm(a.lat, a.lng, pos.lat, pos.lng) < REANCHOR_KM ? a : pos))
  }, [pos])
  return anchor
}

export type DriveState =
  | { kind: 'none' } // chưa có GPS → không hiện gì (như Android)
  | { kind: 'loading'; straightKm: number }
  | { kind: 'ok'; info: DriveInfo }
  | { kind: 'fallback'; straightKm: number } // lỗi / không có đường → đường chim bay

/** Quãng đường lái tới `station`. `enabled=false` (bảng đã đóng) thì giữ kết quả, không gọi. */
export function useDriveDistance(origin: LatLng | null, station: Station | null, enabled: boolean): DriveState {
  const [, bump] = useState(0)
  const failed = useRef(new Set<string>())

  const key = origin && station ? keyOf(origin, station) : null
  useEffect(() => {
    if (!enabled || !origin || !station || !key || cache.has(key) || failed.current.has(key)) return
    const ctrl = new AbortController()
    fetchDrive(origin, station, ctrl.signal)
      .then((info) => cache.set(key, info))
      .catch(() => {
        if (!ctrl.signal.aborted) failed.current.add(key)
      })
      .finally(() => {
        if (!ctrl.signal.aborted) bump((n) => n + 1)
      })
    // Đổi trạm / đóng bảng giữa chừng: huỷ request cũ.
    return () => ctrl.abort()
  }, [enabled, key, origin, station])

  if (!origin || !station || !key) return { kind: 'none' }
  const straightKm = distanceKm(origin.lat, origin.lng, station.lat, station.lng)
  const hit = cache.get(key)
  if (hit) return { kind: 'ok', info: hit }
  if (hit === null || failed.current.has(key)) return { kind: 'fallback', straightKm }
  return { kind: 'loading', straightKm }
}

/** "khoảng 18 phút", "khoảng 1 giờ 5 phút". */
const T = pick({
  vi: {
    min: (m: number) => `${m} phút`,
    hr: (h: number) => `${h} giờ`,
    hrMin: (h: number, m: number) => `${h} giờ ${m} phút`,
  },
  en: {
    min: (m: number) => `${m} min`,
    hr: (h: number) => `${h} h`,
    hrMin: (h: number, m: number) => `${h} h ${m} min`,
  },
})

export function fmtMinutes(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60))
  if (m < 60) return T.min(m)
  const h = Math.floor(m / 60)
  return m % 60 ? T.hrMin(h, m % 60) : T.hr(h)
}
