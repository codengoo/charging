/**
 * Quãng đường LÁI XE thật từ vị trí người dùng tới một trạm (HERE Routing qua `/api/drive`).
 * Port HereRouting.route() + fetchRoute() của app Android: chỉ gọi cho trạm người dùng thực sự
 * mở. Danh sách "Gần tôi" vẫn xếp bằng đường chim bay — HERE Matrix tính tiền theo từng ô
 * (1 điểm × 20 trạm = 20 lượt, hạn mức miễn phí chỉ 2.500), nên chỉ mượn lại kết quả đã có
 * trong cache cho trạm từng mở.
 */
import { useEffect, useRef, useState } from 'react'
import { distanceKm, type GeoPoint } from '../lib/geo'
import type { Station } from './types'
import { fetchJson } from '../lib/http'
import { parseHereRoutes, sumSummary, type HereRoute } from './here'
import { elevationProfile } from './elevation'

export interface DriveInfo {
  meters: number
  seconds: number
  /** Tổng mét leo / xuống trên đường đi (HERE trả độ cao); thiếu = không biết. */
  upM?: number
  downM?: number
}

/** GPS dịch dưới mức này thì giữ điểm gốc cũ — trackUserLocation báo vị trí liên tục. */
const REANCHOR_KM = 0.5

/** Làm tròn ~100 m: cache trình duyệt và cache trong bộ nhớ trúng nhiều hơn. */
const round = (v: number) => Math.round(v * 1000) / 1000
const coord = (p: GeoPoint) => `${round(p.lat)},${round(p.lng)}`
const keyOf = (o: GeoPoint, st: Station) => `${coord(o)}|${st.entityId}`

/** Kết quả theo cặp (điểm gốc đã làm tròn, trạm). `null` = HERE không tìm được đường. */
const cache = new Map<string, DriveInfo | null>()

export function cachedDrive(origin: GeoPoint | null, st: Station): DriveInfo | null | undefined {
  return origin ? cache.get(keyOf(origin, st)) : undefined
}

async function fetchDrive(origin: GeoPoint, st: Station, signal: AbortSignal): Promise<DriveInfo | null> {
  // 429 / 503 / lỗi mạng: fetchJson ném → không cache để lần mở sau thử lại.
  const body = await fetchJson<HereRoute>(`/api/drive?from=${coord(origin)}&to=${st.lat},${st.lng}`, { signal })
  return driveInfoOf(body)
}

/**
 * Body HERE → quãng đường + tổng leo / xuống. Chỉ giữ hai con số độ cao, không giữ cả đường đi
 * (cache theo từng trạm). Bản Worker cũ chỉ trả summary → không có độ cao, vẫn dùng được.
 */
export function driveInfoOf(body: HereRoute): DriveInfo | null {
  const sections = body.routes?.[0]?.sections
  if (!sections?.length) return null
  const sum = sumSummary(sections)
  if (!(sum.meters > 0)) return null
  const path = parseHereRoutes(body)[0]
  const prof = path ? elevationProfile(path.points, path.elev) : null
  return prof ? { ...sum, upM: prof.totalUp, downM: prof.totalDown } : sum
}

/**
 * Điểm gốc ổn định: chỉ đổi khi GPS dịch quá REANCHOR_KM, để mỗi lần vị trí nhích vài mét
 * không bắn request mới và key cache không đổi.
 */
export function useStableOrigin(pos: GeoPoint | null): GeoPoint | null {
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
export function useDriveDistance(origin: GeoPoint | null, station: Station | null, enabled: boolean): DriveState {
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

